/**
 * Nouvelle version publiée pendant que l'application est ouverte : les morceaux chargés à la demande
 * (lecture IA, export Trikker, PDF…) changent de nom à chaque version, et l'ancienne page ne les trouve
 * plus. On le détecte pour proposer de recharger, au lieu d'afficher une erreur incompréhensible.
 */
const EVENT = 'voltaplan:update';

/** Erreur de chargement d'un module (fichier disparu après une mise à jour du site). */
export function isStaleChunk(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e ?? '');
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Unable to preload CSS|ChunkLoadError/i.test(m);
}

export function notifyUpdate() {
  window.dispatchEvent(new Event(EVENT));
}

export function onUpdate(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

/** À appeler une fois au démarrage. */
export function watchStaleChunks() {
  window.addEventListener('vite:preloadError', (e) => {
    e.preventDefault();
    notifyUpdate();
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (isStaleChunk(e.reason)) notifyUpdate();
  });
}

/*
 * Service worker (version web publiée, src/sw/sw.js) : mise à jour sûre et annoncée. Voir docs/offline.md.
 * Une nouvelle version s'installe en arrière-plan puis ATTEND : la page ouverte continue avec ses propres
 * fichiers. Le bandeau (src/ui/UpdateBanner.tsx) propose de recharger : on garde d'abord le brouillon
 * (projet non enregistré), puis on demande au service worker en attente de prendre la main (SKIP_WAITING)
 * et on recharge quand il l'a prise (controllerchange).
 */

/** Service worker de la nouvelle version, installé et en attente. */
let waiting: ServiceWorker | null = null;
/** Rechargement demandé depuis le bandeau (brouillon déjà gardé) : ne plus avertir à la fermeture. */
let reloading = false;
let reloaded = false;
let reloadFn: () => void = () => window.location.reload();

function reloadOnce() {
  if (reloaded) return;
  reloaded = true;
  reloadFn();
}

/** Vrai pendant le rechargement demandé depuis le bandeau : le brouillon est gardé, pas d'avertissement. */
export function isReloadingForUpdate(): boolean {
  return reloading;
}

/** Nouvelle version installée, en attente d'activation. */
export function hasWaitingWorker(): boolean {
  return waiting !== null;
}

/** Suit une inscription : nouvelle version installée → bandeau (sauf première installation). */
export function watchRegistration(reg: ServiceWorkerRegistration, container: ServiceWorkerContainer) {
  const found = (w: ServiceWorker) => {
    // Aucune page contrôlée : première installation, rien à annoncer (la page est déjà de cette version).
    if (!container.controller) return;
    waiting = w;
    notifyUpdate();
  };
  if (reg.waiting) found(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const w = reg.installing;
    if (!w) return;
    w.addEventListener('statechange', () => {
      if (w.state === 'installed') found(w);
    });
  });
}

/**
 * Inscrit le service worker. Sans effet (et sans erreur) si le navigateur ne le permet pas.
 * `opts` sert surtout aux tests.
 */
export async function registerServiceWorker(
  container: ServiceWorkerContainer | undefined = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined,
  opts: { url?: string; reload?: () => void; checkEveryMs?: number } = {},
): Promise<ServiceWorkerRegistration | undefined> {
  if (!container) return undefined;
  if (opts.reload) reloadFn = opts.reload;
  const hadController = !!container.controller;
  container.addEventListener('controllerchange', () => {
    if (reloading) reloadOnce();
    else if (hadController) notifyUpdate(); // nouvelle version activée depuis un autre onglet
  });
  try {
    const reg = await container.register(opts.url ?? './sw.js');
    watchRegistration(reg, container);
    // Application laissée ouverte longtemps : chercher de temps en temps une nouvelle version
    const every = opts.checkEveryMs ?? 60 * 60 * 1000;
    if (every > 0)
      setInterval(() => {
        if (navigator.onLine !== false) reg.update().catch(() => undefined);
      }, every);
    return reg;
  } catch {
    return undefined;
  }
}

/**
 * Recharger sur la nouvelle version, après avoir gardé le brouillon.
 * `saveDraft` enregistre le projet non enregistré (ou ne fait rien s'il n'y en a pas). S'il échoue, on ne
 * recharge pas (retour `false`) : l'utilisateur doit d'abord enregistrer son projet.
 */
export async function applyUpdate(saveDraft: () => Promise<void>, opts: { fallbackMs?: number } = {}): Promise<boolean> {
  try {
    await saveDraft();
  } catch {
    return false;
  }
  reloading = true;
  const w = waiting;
  if (!w) {
    reloadOnce();
    return true;
  }
  // Rechargement sur « controllerchange » (registerServiceWorker) ; secours si rien ne se passe.
  w.postMessage({ type: 'SKIP_WAITING' });
  setTimeout(reloadOnce, opts.fallbackMs ?? 5000);
  return true;
}

/** Pour les tests uniquement. */
export function _resetUpdateState(reload?: () => void) {
  waiting = null;
  reloading = false;
  reloaded = false;
  reloadFn = reload ?? (() => window.location.reload());
}
