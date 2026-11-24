import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { cspString, webCsp } from './src/security/csp';

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

export default defineConfig({
  plugins: [react(), cspMeta()],
  base: './',
  test: { globals: true, environment: 'jsdom' },
});
