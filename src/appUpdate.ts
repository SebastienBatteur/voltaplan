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
