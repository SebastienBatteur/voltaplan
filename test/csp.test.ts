import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONNECT_HOSTS, cspString, desktopCsp, webCsp } from '../src/security/csp';

const tauri = JSON.parse(readFileSync(resolve(__dirname, '../src-tauri/tauri.conf.json'), 'utf8'));

describe('politique de sécurité du contenu (CSP)', () => {
  it('web : scripts du site uniquement, pas de plugin, pas de formulaire', () => {
    const d = webCsp();
    expect(d['script-src']).toBe("'self'");
    expect(d['object-src']).toBe("'none'");
    expect(d['form-action']).toBe("'none'");
    expect(d['img-src']).toBe("'self' data: blob:");
    expect(cspString(d)).not.toMatch(/unsafe-eval/);
    // Aucune source générique (« * », « https: », « https://* ») ; seuls deux sous-domaines Microsoft nommément
    // autorisés pour les transferts OneDrive (liens de téléchargement et sessions d'envoi)
    const wild = cspString(d).split(/[\s;]+/).filter((x) => x.includes('*'));
    expect(wild).toEqual(['https://*.1drv.com', 'https://*.sharepoint.com']);
    expect(cspString(d)).not.toMatch(/(^|\s)(\*|https:|http:)(\s|;|$)/);
  });

  it('connect-src : uniquement les services utilisés', () => {
    const hosts = webCsp()['connect-src'].split(' ');
    expect(hosts).toEqual(["'self'", ...CONNECT_HOSTS]);
  });

  it('bureau : la configuration Tauri reprend la même politique, avec le canal IPC', () => {
    expect(tauri.app.security.csp).toEqual(desktopCsp());
    expect(desktopCsp()['connect-src']).toContain('ipc:');
    expect(desktopCsp()['connect-src']).toContain('http://ipc.localhost');
  });
});
