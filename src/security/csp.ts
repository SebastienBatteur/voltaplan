/**
 * Politique de sécurité du contenu (CSP) de la version publiée.
 *
 * Une seule source pour :
 *  - la balise <meta http-equiv="Content-Security-Policy"> ajoutée à index.html à la construction
 *    (voir vite.config.ts ; pas en développement, où Vite injecte des scripts en ligne) ;
 *  - `app.security.csp` de l'application de bureau (src-tauri/tauri.conf.json), vérifiée par test/csp.test.ts.
 *
 * Seuls les services réellement appelés par l'application sont autorisés en `connect-src` :
 * IA (Anthropic), GitHub, Dropbox, OneDrive (Microsoft Graph + connexion), Google Drive.
 * Les pages de connexion OAuth s'ouvrent dans une fenêtre séparée (navigation, non concernée par connect-src).
 */

/** Services distants appelés par fetch (src/ai, src/io/storage.ts, src/io/cloud.ts). */
export const CONNECT_HOSTS = [
  'https://api.anthropic.com',
  'https://api.github.com',
  'https://api.dropboxapi.com',
  'https://content.dropboxapi.com',
  'https://graph.microsoft.com',
  'https://login.microsoftonline.com',
  'https://www.googleapis.com',
] as const;

export type CspDirectives = Record<string, string>;

/** Directives communes au web et au bureau. */
export function webCsp(): CspDirectives {
  return {
    'default-src': "'self'",
    'script-src': "'self'",
    // Attributs style="" de React : 'unsafe-inline' est nécessaire (aucun <style> injecté).
    'style-src': "'self' 'unsafe-inline'",
    // Fonds de plan, photos de tableau et images Trikker : data: ou blob: uniquement.
    'img-src': "'self' data: blob:",
    'font-src': "'self' data:",
    'connect-src': ["'self'", ...CONNECT_HOSTS].join(' '),
    // Lecteur PDF (pdfjs, fichier du site) et service worker.
    'worker-src': "'self' blob:",
    'manifest-src': "'self'",
    'object-src': "'none'",
    'base-uri': "'self'",
    'form-action': "'none'",
  };
}

/** Bureau (Tauri 2) : en plus, le canal IPC entre la page et l'application. */
export function desktopCsp(): CspDirectives {
  const d = webCsp();
  d['connect-src'] = ["'self'", 'ipc:', 'http://ipc.localhost', ...CONNECT_HOSTS].join(' ');
  return d;
}

export function cspString(d: CspDirectives): string {
  return Object.entries(d)
    .map(([k, v]) => `${k} ${v}`)
    .join('; ');
}
