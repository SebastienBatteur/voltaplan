/**
 * Liste des fichiers du service worker (hors ligne) calculée à la construction : src/sw/precache.ts.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PRECACHE_PLACEHOLDER, buildPrecacheManifest, isPrecached, renderServiceWorker } from '../src/sw/precache';

const files = [
  { path: 'index.html', content: '<html>' },
  { path: 'assets/index-abc.js', content: 'app' },
  { path: 'assets/pdf.worker.min-xyz.mjs', content: 'worker' },
  { path: 'assets/trikker-123.js', content: 'trik' },
  { path: 'assets\\boardPhotoAi-456.js', content: 'ai' },
  { path: 'assets/index-abc.js.map', content: 'map' },
  { path: 'sw.js', content: 'ancien' },
  { path: 'icons/icon-512.png', content: new Uint8Array([1, 2, 3]) },
  { path: 'manifest.webmanifest', content: '{}' },
  { path: '.DS_Store', content: '' },
];

describe('liste des fichiers hors ligne', () => {
  it('tous les fichiers publiés, y compris les morceaux chargés à la demande et le lecteur PDF', () => {
    const m = buildPrecacheManifest(files);
    expect(m.urls).toEqual([
      './assets/boardPhotoAi-456.js',
      './assets/index-abc.js',
      './assets/pdf.worker.min-xyz.mjs',
      './assets/trikker-123.js',
      './icons/icon-512.png',
      './index.html',
      './manifest.webmanifest',
    ]);
  });

  it('ni le service worker, ni les cartes de sources, ni les fichiers système', () => {
    expect(isPrecached('sw.js')).toBe(false);
    expect(isPrecached('assets/a.js.map')).toBe(false);
    expect(isPrecached('ocr/7.0.0/core/tesseract-core-lstm.wasm.js')).toBe(false);
    expect(isPrecached('icons/.DS_Store')).toBe(false);
    expect(isPrecached('assets/sw.js')).toBe(true);
  });

  it('version : stable, indépendante de l’ordre, change avec le contenu ou les noms', () => {
    const a = buildPrecacheManifest(files);
    expect(buildPrecacheManifest([...files].reverse()).version).toBe(a.version);
    expect(a.version).toMatch(/^[0-9a-f]{12}$/);
    const changed = files.map((f) => (f.path === 'index.html' ? { ...f, content: '<html lang="fr">' } : f));
    expect(buildPrecacheManifest(changed).version).not.toBe(a.version);
    const renamed = files.map((f) => (f.path === 'assets/trikker-123.js' ? { ...f, path: 'assets/trikker-124.js' } : f));
    expect(buildPrecacheManifest(renamed).version).not.toBe(a.version);
    // Les fichiers exclus ne changent pas la version
    const map = files.map((f) => (f.path.endsWith('.map') ? { ...f, content: 'autre' } : f));
    expect(buildPrecacheManifest(map).version).toBe(a.version);
  });

  it('le modèle du service worker contient la marque, remplacée une seule fois', () => {
    const template = readFileSync(resolve(__dirname, '../src/sw/sw.js'), 'utf8');
    expect(template).toContain(PRECACHE_PLACEHOLDER);
    const m = buildPrecacheManifest(files);
    const out = renderServiceWorker(template, m);
    expect(out).not.toContain(PRECACHE_PLACEHOLDER);
    expect(out).toContain(JSON.stringify(m));
    expect(() => renderServiceWorker('rien', m)).toThrow();
  });

  it('noms avec « $ » : insérés tels quels', () => {
    const m = { version: 'v', urls: ['./a$&b.js'] };
    expect(renderServiceWorker(PRECACHE_PLACEHOLDER, m)).toBe(JSON.stringify(m));
  });
});
