import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { cspString, webCsp } from './src/security/csp';
import { SW_FILE, buildPrecacheManifest, renderServiceWorker } from './src/sw/precache';
import { provenance } from './tools/provenance/plugin';
import { ocrAssets } from './tools/ocr/plugin';
import pkg from './package.json';

/**
 * CSP de la version web, ajoutée à index.html à la construction seulement : en développement,
 * Vite et React Refresh injectent des scripts en ligne qu'une politique stricte bloquerait.
 * Pas de balise pour l'application de bureau (TAURI_ENV_PLATFORM est fourni par la CLI Tauri) :
 * la politique vient alors de src-tauri/tauri.conf.json, avec le canal IPC autorisé.
 */
function cspMeta(): Plugin {
  return {
    name: 'voltaplan-csp',
    apply: 'build',
    transformIndexHtml() {
      if (process.env.TAURI_ENV_PLATFORM) return [];
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: cspString(webCsp()) }, injectTo: 'head-prepend' }];
    },
  };
}

/**
 * Service worker (hors ligne) : une fois tous les fichiers écrits (y compris ceux de public/), liste-les avec
 * leur version et écrit dist/sw.js à partir du modèle src/sw/sw.js. Voir docs/offline.md.
 * Pas pour l'application de bureau (aucun service worker).
 */
function serviceWorker(): Plugin {
  return {
    name: 'voltaplan-sw',
    apply: 'build',
    enforce: 'post',
    writeBundle(options) {
      if (process.env.TAURI_ENV_PLATFORM || !options.dir) return;
      const dir = options.dir;
      const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
      const files = walk(dir).map((f) => ({ path: relative(dir, f), content: readFileSync(f) }));
      const manifest = buildPrecacheManifest(files);
      const template = readFileSync(resolve(__dirname, 'src/sw/sw.js'), 'utf8');
      writeFileSync(join(dir, SW_FILE), renderServiceWorker(template, manifest));
      this.info(`service worker : ${manifest.urls.length} fichiers, version ${manifest.version}`);
    },
  };
}

export default defineConfig({
  plugins: [react(), cspMeta(), ocrAssets(), serviceWorker(), provenance({ root: __dirname, version: pkg.version })],
  base: './',
  test: { globals: true, environment: 'jsdom', setupFiles: ['test/setup.ts'], exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**', 'src-tauri/**'] },
});
