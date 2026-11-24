// @vitest-environment node
/**
 * Service worker (src/sw/sw.js) exécuté dans un environnement simulé : caches en mémoire, réseau simulé.
 * Vérifie l'installation complète, l'absence d'activation automatique, le nettoyage des anciennes versions,
 * et le fonctionnement hors ligne.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderServiceWorker } from '../src/sw/precache';

const SCOPE = 'https://exemple.github.io/voltaplan/app/';
const MANIFEST = {
  version: 'abc123',
  urls: ['./assets/index-1.js', './assets/pdf.worker.min-2.mjs', './assets/trikker-3.js', './index.html', './oauth.html'],
};

type Listener = (e: unknown) => void;

function setup(opts: { cacheNames?: string[] } = {}) {
  const stores = new Map<string, Map<string, Response>>();
  for (const n of opts.cacheNames ?? []) stores.set(n, new Map());
  let online = true;
  const network: string[] = [];
  const fetchMock = async (input: Request | string) => {
    const url = typeof input === 'string' ? input : input.url;
    network.push(url);
    if (!online) throw new TypeError('Failed to fetch');
    if (url.endsWith('/missing.js')) return new Response('', { status: 404 });
    return new Response('net:' + new URL(url).pathname, { status: 200 });
  };
  const keyOf = (r: Request | string, ignoreSearch = false) => {
    const u = new URL(typeof r === 'string' ? r : r.url);
    if (ignoreSearch) u.search = '';
    return u.href;
  };
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name)!;
    return {
      addAll: async (reqs: (Request | string)[]) => {
        const res = await Promise.all(reqs.map((r) => fetchMock(r)));
        if (res.some((r) => !r.ok)) throw new TypeError('addAll');
        reqs.forEach((r, i) => m.set(keyOf(r), res[i]));
      },
      match: async (r: Request | string, o?: { ignoreSearch?: boolean }) => {
        if (o?.ignoreSearch) {
          const k = keyOf(r, true);
          for (const [key, v] of m) if (keyOf(key, true) === k) return v.clone();
          return undefined;
        }
        return m.get(keyOf(r))?.clone();
      },
    };
  };
  const caches = {
    open,
    keys: async () => [...stores.keys()],
    delete: async (n: string) => stores.delete(n),
  };
  const listeners = new Map<string, Listener[]>();
  const self = {
    location: new URL(SCOPE + 'sw.js'),
    registration: { scope: SCOPE },
    clients: { claim: vi.fn(async () => undefined) },
    skipWaiting: vi.fn(async () => undefined),
    addEventListener: (t: string, f: Listener) => listeners.set(t, [...(listeners.get(t) ?? []), f]),
  };
  const code = renderServiceWorker(readFileSync(resolve(__dirname, '../src/sw/sw.js'), 'utf8'), MANIFEST);
  new Function('self', 'caches', 'fetch', code)(self, caches, fetchMock);

  const fire = async (type: string, extra: Record<string, unknown> = {}) => {
    let waited: Promise<unknown> | undefined;
    let responded: Promise<Response> | undefined;
    const e = { ...extra, waitUntil: (p: Promise<unknown>) => (waited = p), respondWith: (p: Promise<Response>) => (responded = p) };
    for (const f of listeners.get(type) ?? []) f(e);
    await waited;
    return responded;
  };
  const get = (url: string, mode: RequestMode | 'navigate' = 'no-cors', method = 'GET') => {
    const r = new Request(url, { method });
    // RequestInit ne permet pas mode « navigate » : on le simule
    Object.defineProperty(r, 'mode', { value: mode });
    return fire('fetch', { request: r });
  };
  return { stores, network, self, fire, get, setOnline: (v: boolean) => (online = v) };
}

describe('service worker', () => {
  it('installation : tous les fichiers dans un cache propre à la version, sans activation automatique', async () => {
    const sw = setup();
    await sw.fire('install');
    expect([...sw.stores.keys()]).toEqual(['voltaplan-abc123']);
    expect([...sw.stores.get('voltaplan-abc123')!.keys()]).toEqual(MANIFEST.urls.map((u) => new URL(u, SCOPE).href));
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
  });

  it('SKIP_WAITING envoyé par la page : activation', async () => {
    const sw = setup();
    const page = { url: SCOPE + 'index.html' };
    await sw.fire('message', { data: { type: 'AUTRE' }, source: page });
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
    // Origine étrangère ou expéditeur inconnu : ignoré
    await sw.fire('message', { data: { type: 'SKIP_WAITING' }, source: { url: 'https://evil.example/x' } });
    await sw.fire('message', { data: { type: 'SKIP_WAITING' }, origin: 'https://evil.example', source: page });
    await sw.fire('message', { data: { type: 'SKIP_WAITING' } });
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
    await sw.fire('message', { data: { type: 'SKIP_WAITING' }, source: page });
    expect(sw.self.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it('activation : supprime les autres versions de Voltaplan, garde les caches étrangers', async () => {
    const sw = setup({ cacheNames: ['voltaplan-v1', 'voltaplan-old', 'autre-appli'] });
    await sw.fire('install');
    await sw.fire('activate');
    expect([...sw.stores.keys()].sort()).toEqual(['autre-appli', 'voltaplan-abc123']);
    expect(sw.self.clients.claim).toHaveBeenCalled();
  });

  it('hors ligne : morceaux jamais ouverts, page et lecteur PDF servis depuis le cache', async () => {
    const sw = setup();
    await sw.fire('install');
    sw.setOnline(false);
    expect(await (await sw.get(SCOPE + 'assets/trikker-3.js'))!.text()).toBe('net:/voltaplan/app/assets/trikker-3.js');
    expect(await (await sw.get(SCOPE + 'assets/pdf.worker.min-2.mjs'))!.text()).toContain('pdf.worker');
    // Navigation vers la racine ou avec paramètres : page de la version installée
    expect(await (await sw.get(SCOPE, 'navigate'))!.text()).toBe('net:/voltaplan/app/index.html');
    expect(await (await sw.get(SCOPE + '?fichier=1', 'navigate'))!.text()).toBe('net:/voltaplan/app/index.html');
    // Autre page de l'application : la sienne
    expect(await (await sw.get(SCOPE + 'oauth.html?code=x', 'navigate'))!.text()).toBe('net:/voltaplan/app/oauth.html');
    // Page inconnue hors ligne : page de l'application
    expect(await (await sw.get(SCOPE + 'inconnu', 'navigate'))!.text()).toBe('net:/voltaplan/app/index.html');
    // Fichier absent du cache, hors ligne : erreur réseau (pas de fausse réponse)
    await expect(sw.get(SCOPE + 'assets/inconnu.js')).rejects.toThrow();
  });

  it('en ligne : la page vient du cache (cohérente avec ses fichiers), pas du réseau', async () => {
    const sw = setup();
    await sw.fire('install');
    const before = sw.network.length;
    await sw.get(SCOPE, 'navigate');
    await sw.get(SCOPE + 'assets/index-1.js');
    expect(sw.network.length).toBe(before);
  });

  it('non traité : autres origines (IA, GitHub, services en ligne), écritures, hors de la portée', async () => {
    const sw = setup();
    await sw.fire('install');
    expect(await sw.get('https://api.anthropic.com/v1/messages')).toBeUndefined();
    expect(await sw.get('https://api.github.com/repos/x')).toBeUndefined();
    expect(await sw.get(SCOPE + 'assets/index-1.js', 'cors', 'POST')).toBeUndefined();
    expect(await sw.get('https://exemple.github.io/voltaplan/guide.html')).toBeUndefined();
  });

  it('fichier hors liste en ligne : réseau, sans l’ajouter au cache', async () => {
    const sw = setup();
    await sw.fire('install');
    const r = await sw.get(SCOPE + 'assets/autre.js');
    expect(r!.status).toBe(200);
    expect(sw.stores.get('voltaplan-abc123')!.has(SCOPE + 'assets/autre.js')).toBe(false);
  });
});
