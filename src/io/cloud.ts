/**
 * Google Drive, OneDrive et Dropbox, directement depuis le navigateur (aucun serveur Voltaplan).
 *
 * Chaque service demande d'enregistrer l'application une fois (identifiant client OAuth, public, pas de secret) :
 *  - Dropbox : https://www.dropbox.com/developers/apps → « Scoped access », « App folder »,
 *    autorisations files.content.read + files.content.write, Redirect URI = <adresse de Voltaplan>/oauth.html ;
 *  - OneDrive : https://entra.microsoft.com → Inscriptions d'applications → plateforme « Application monopage (SPA) »,
 *    URI de redirection = <adresse>/oauth.html, comptes personnels et professionnels, autorisation Files.ReadWrite.AppFolder ;
 *  - Google Drive : https://console.cloud.google.com → Identifiants → « ID client OAuth » de type Application Web,
 *    origine JavaScript autorisée = <adresse>, URI de redirection = <adresse>/oauth.html, API Google Drive activée,
 *    portée drive.file (Voltaplan ne voit que les fichiers qu'il a créés ou qu'on lui ouvre).
 * L'identifiant est saisi dans Voltaplan (Enregistrer sous… → Drive, OneDrive, Dropbox) ou fixé à la compilation
 * (variables VITE_DROPBOX_CLIENT_ID, VITE_ONEDRIVE_CLIENT_ID, VITE_GOOGLE_CLIENT_ID) pour une version publiée.
 *
 * Connexion : fenêtre du service (OAuth 2, PKCE pour Dropbox et OneDrive ; jeton direct pour Google, dont le
 * flux « code » exige un secret). Le jeton d'accès reste en mémoire le temps de la session, jamais enregistré.
 * Les fichiers sont rangés dans le dossier de l'application (Dropbox, OneDrive) ou créés par elle (Drive).
 */
import type { Project } from '../model/types';
import { FILE_EXT, STORAGE_PREFIX } from '../brand';

export type CloudId = 'gdrive' | 'onedrive' | 'dropbox';
export const CLOUDS: CloudId[] = ['gdrive', 'onedrive', 'dropbox'];

export interface CloudFile {
  id: string;
  name: string;
  size?: number;
  modified?: string;
}

interface Provider {
  label: string;
  authUrl: string;
  tokenUrl?: string; // absent : jeton reçu directement (Google)
  scope: string;
  extraAuth?: Record<string, string>;
  list: (token: string) => Promise<CloudFile[]>;
  load: (token: string, f: CloudFile) => Promise<string>;
  save: (token: string, name: string, data: string, existing?: CloudFile) => Promise<CloudFile>;
}

const env = import.meta.env as Record<string, string | undefined>;
const BUILT_IN: Record<CloudId, string | undefined> = {
  gdrive: env.VITE_GOOGLE_CLIENT_ID,
  onedrive: env.VITE_ONEDRIVE_CLIENT_ID,
  dropbox: env.VITE_DROPBOX_CLIENT_ID,
};
const KEY = STORAGE_PREFIX + 'cloudClientIds';

export function clientId(id: CloudId): string {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string>;
    return saved[id] || BUILT_IN[id] || '';
  } catch {
    return BUILT_IN[id] || '';
  }
}

export function setClientId(id: CloudId, value: string) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string>;
    saved[id] = value.trim();
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    /* stockage indisponible */
  }
}

export function redirectUri(): string {
  return new URL('oauth.html', location.href).href.split('?')[0];
}

async function check(r: Response): Promise<Response> {
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${(await r.text()).slice(0, 200)}`);
  return r;
}

const isProjectName = (n: string) => n.endsWith(FILE_EXT) || n.endsWith('.openrgie');

export const PROVIDERS: Record<CloudId, Provider> = {
  dropbox: {
    label: 'Dropbox',
    authUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    scope: 'files.content.read files.content.write',
    extraAuth: { token_access_type: 'online' },
    list: async (token) => {
      const r = await check(
        await fetch('https://api.dropboxapi.com/2/files/list_folder', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: '' }),
        }),
      );
      const j = (await r.json()) as { entries: { '.tag': string; id: string; name: string; path_lower: string; size?: number; server_modified?: string }[] };
      return j.entries.filter((e) => e['.tag'] === 'file' && isProjectName(e.name)).map((e) => ({ id: e.path_lower, name: e.name, size: e.size, modified: e.server_modified }));
    },
    load: async (token, f) => {
      const r = await check(
        await fetch('https://content.dropboxapi.com/2/files/download', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'Dropbox-API-Arg': JSON.stringify({ path: f.id }) },
        }),
      );
      return r.text();
    },
    save: async (token, name, data) => {
      const r = await check(
        await fetch('https://content.dropboxapi.com/2/files/upload', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/octet-stream',
            'Dropbox-API-Arg': asciiJson({ path: '/' + name, mode: 'overwrite', mute: true }),
          },
          body: new TextEncoder().encode(data),
        }),
      );
      const j = (await r.json()) as { path_lower: string; name: string; size: number };
      return { id: j.path_lower, name: j.name, size: j.size };
    },
  },
  onedrive: {
    label: 'OneDrive',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'Files.ReadWrite.AppFolder',
    list: async (token) => {
      const r = await check(await fetch('https://graph.microsoft.com/v1.0/me/drive/special/approot/children', { headers: { Authorization: 'Bearer ' + token } }));
      const j = (await r.json()) as { value: { id: string; name: string; size: number; lastModifiedDateTime: string; file?: unknown }[] };
      return j.value.filter((e) => e.file && isProjectName(e.name)).map((e) => ({ id: e.id, name: e.name, size: e.size, modified: e.lastModifiedDateTime }));
    },
    load: async (token, f) => (await check(await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(f.id)}/content`, { headers: { Authorization: 'Bearer ' + token } }))).text(),
    save: async (token, name, data) => {
      const r = await check(
        await fetch(`https://graph.microsoft.com/v1.0/me/drive/special/approot:/${encodeURIComponent(name)}:/content`, {
          method: 'PUT',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: data,
        }),
      );
      const j = (await r.json()) as { id: string; name: string; size: number };
      return { id: j.id, name: j.name, size: j.size };
    },
  },
  gdrive: {
    label: 'Google Drive',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'https://www.googleapis.com/auth/drive.file',
    list: async (token) => {
      const q = encodeURIComponent(`name contains '${FILE_EXT}' and trashed = false`);
      const r = await check(
        await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,size,modifiedTime)&orderBy=modifiedTime desc`, { headers: { Authorization: 'Bearer ' + token } }),
      );
      const j = (await r.json()) as { files: { id: string; name: string; size?: string; modifiedTime: string }[] };
      return j.files.map((f) => ({ id: f.id, name: f.name, size: f.size ? Number(f.size) : undefined, modified: f.modifiedTime }));
    },
    load: async (token, f) => (await check(await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(f.id)}?alt=media`, { headers: { Authorization: 'Bearer ' + token } }))).text(),
    save: async (token, name, data, existing) => {
      if (existing) {
        const r = await check(
          await fetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existing.id)}?uploadType=media`, {
            method: 'PATCH',
            headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: data,
          }),
        );
        const j = (await r.json()) as { id: string; name: string };
        return { id: j.id, name: j.name };
      }
      const boundary = 'voltaplan' + Math.random().toString(36).slice(2);
      const body =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, mimeType: 'application/json' })}\r\n` +
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n${data}\r\n--${boundary}--`;
      const r = await check(
        await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'multipart/related; boundary=' + boundary },
          body,
        }),
      );
      const j = (await r.json()) as { id: string; name: string };
      return { id: j.id, name: j.name };
    },
  },
};

/** En-tête HTTP Dropbox-API-Arg : JSON en ASCII (caractères non ASCII échappés). */
export function asciiJson(v: unknown): string {
  return JSON.stringify(v).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

// ---------------------------------------------------------------------------
// Connexion OAuth 2 (fenêtre surgissante + page oauth.html qui renvoie la réponse)
// ---------------------------------------------------------------------------

const tokens: Partial<Record<CloudId, { token: string; expires: number }>> = {};

export function cloudToken(id: CloudId): string | null {
  const t = tokens[id];
  return t && t.expires > Date.now() ? t.token : null;
}

export function cloudForget(id: CloudId) {
  delete tokens[id];
}

function b64url(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  return { verifier, challenge };
}

/** Attend la réponse de oauth.html (postMessage de la fenêtre de connexion). */
function waitForRedirect(popup: Window, state: string): Promise<URLSearchParams> {
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer);
        window.removeEventListener('message', onMsg);
        reject(new Error('cancelled'));
      }
    }, 500);
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || typeof e.data !== 'object' || e.data?.type !== 'voltaplan-oauth') return;
      const p = new URLSearchParams(String(e.data.search || '').replace(/^\?/, '') + '&' + String(e.data.hash || '').replace(/^#/, ''));
      if (p.get('state') !== state) return;
      clearInterval(timer);
      window.removeEventListener('message', onMsg);
      popup.close();
      if (p.get('error')) reject(new Error(p.get('error_description') || p.get('error')!));
      else resolve(p);
    };
    window.addEventListener('message', onMsg);
  });
}

export async function cloudConnect(id: CloudId): Promise<string> {
  const p = PROVIDERS[id];
  const client = clientId(id);
  if (!client) throw new Error('client-id');
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const redirect = redirectUri();
  const q = new URLSearchParams({ client_id: client, redirect_uri: redirect, state, scope: p.scope, ...(p.extraAuth ?? {}) });
  let verifier = '';
  if (p.tokenUrl) {
    const pk = await pkcePair();
    verifier = pk.verifier;
    q.set('response_type', 'code');
    q.set('code_challenge', pk.challenge);
    q.set('code_challenge_method', 'S256');
  } else q.set('response_type', 'token');
  const popup = window.open(p.authUrl + '?' + q.toString(), 'voltaplan-oauth', 'width=520,height=680');
  if (!popup) throw new Error('popup');
  const res = await waitForRedirect(popup, state);
  let token = res.get('access_token') ?? '';
  let expiresIn = Number(res.get('expires_in') ?? 3600);
  if (p.tokenUrl) {
    const body = new URLSearchParams({ grant_type: 'authorization_code', code: res.get('code') ?? '', client_id: client, redirect_uri: redirect, code_verifier: verifier });
    const r = await check(await fetch(p.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }));
    const j = (await r.json()) as { access_token: string; expires_in?: number };
    token = j.access_token;
    expiresIn = j.expires_in ?? 3600;
  }
  if (!token) throw new Error('no-token');
  tokens[id] = { token, expires: Date.now() + (expiresIn - 60) * 1000 };
  return token;
}

export async function cloudList(id: CloudId): Promise<CloudFile[]> {
  return PROVIDERS[id].list(cloudToken(id) ?? (await cloudConnect(id)));
}

export async function cloudLoad(id: CloudId, f: CloudFile): Promise<string> {
  return PROVIDERS[id].load(cloudToken(id) ?? (await cloudConnect(id)), f);
}

export async function cloudSave(id: CloudId, name: string, project: Project, existing?: CloudFile): Promise<CloudFile> {
  return PROVIDERS[id].save(cloudToken(id) ?? (await cloudConnect(id)), name, JSON.stringify(project), existing);
}
