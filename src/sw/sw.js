/*
 * Service worker de Voltaplan : l'application reste utilisable hors ligne.
 *
 * Modèle : à la construction, vite.config.ts (greffon « voltaplan-sw ») remplace la marque ci-dessous par la
 * liste de TOUS les fichiers publiés et leur version (src/sw/precache.ts), puis écrit dist/sw.js.
 *
 * - installation : tous les fichiers de la version (y compris lecteur PDF, import/export, lecture IA…) sont
 *   copiés dans un cache propre à cette version, même ceux jamais ouverts en ligne ;
 * - pas d'activation automatique : la nouvelle version attend que la page la demande (bandeau
 *   « Nouvelle version disponible — Recharger », message SKIP_WAITING), pour qu'une page ouverte ne
 *   charge jamais un morceau d'une autre version ;
 * - activation : les caches des versions précédentes de Voltaplan sont supprimés ;
 * - pages : la page de l'application de la version installée (cohérente avec ses fichiers), réseau en secours ;
 * - fichiers : copie locale de la version, sinon réseau (sans rien ajouter au cache).
 * Aucune donnée de projet ne passe par ici, ni aucun appel à l'IA, à GitHub ou aux services en ligne
 * (autres origines : jamais interceptés).
 */
const MANIFEST = /*__VOLTAPLAN_PRECACHE__*/ null;

const PREFIX = 'voltaplan-';
const VERSION = MANIFEST ? MANIFEST.version : 'dev';
const CACHE = PREFIX + VERSION;
const URLS = MANIFEST ? MANIFEST.urls : [];
const INDEX = './index.html';

/** Adresse absolue d'un fichier de la liste (relative à la portée du service worker). */
const abs = (u) => new URL(u, self.registration ? self.registration.scope : self.location.href).href;

/** Requêtes traitées : lecture (GET) sur la même origine, dans la portée. Le reste va directement au réseau. */
function handles(req) {
  if (req.method !== 'GET') return false;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return false;
  const scope = self.registration ? self.registration.scope : new URL('./', self.location.href).href;
  return url.href.startsWith(scope);
}

/** Caches d'autres versions de Voltaplan, à supprimer à l'activation. */
function staleCaches(keys) {
  return keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE);
}

self.addEventListener('install', (event) => {
  // { cache: 'reload' } : ne pas reprendre une ancienne copie du cache HTTP du navigateur
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(URLS.map((u) => new Request(abs(u), { cache: 'reload' })))));
  // Pas de skipWaiting() ici : voir le message SKIP_WAITING.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(staleCaches(keys).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  // Seulement une page Voltaplan de la même origine. Un service worker ne reçoit que des messages de ses propres
  // pages, mais l'origine est vérifiée explicitement (défense en profondeur).
  if (event.origin && event.origin !== self.location.origin) return;
  const from = event.source && event.source.url;
  if (!from || new URL(from).origin !== self.location.origin) return;
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/** Copie locale de la version installée, sinon réseau. */
async function fromCache(req, fallbackUrl) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
  if (hit) return hit;
  try {
    return await fetch(req);
  } catch (e) {
    const fb = fallbackUrl && (await cache.match(abs(fallbackUrl)));
    if (fb) return fb;
    throw e;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!handles(req)) return;
  if (req.mode === 'navigate') {
    const url = new URL(req.url);
    const scope = self.registration ? self.registration.scope : new URL('./', self.location.href).href;
    const isIndex = url.origin + url.pathname === scope || url.origin + url.pathname === abs(INDEX);
    // Racine de l'application : la page de la version installée ; autre page (ex. oauth.html) : la sienne.
    event.respondWith(isIndex ? fromCache(new Request(abs(INDEX)), INDEX) : fromCache(req, INDEX));
    return;
  }
  event.respondWith(fromCache(req));
});
