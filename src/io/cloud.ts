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
 *
 * Enregistrement sans perte (voir conflict.ts) : la version du fichier (eTag, rev, version) est mémorisée à la
 * lecture ; l'enregistrement suivant est conditionnel et lève une ConflictError si le fichier a changé ailleurs.
 */
import type { Project } from '../model/types';
import { FILE_EXT, STORAGE_PREFIX } from '../brand';
import { AuthError, ConflictError, conflictName } from './conflict';
import { MIMETYPE } from '../format/manifest';

/** Contenu envoyé : archive v2 (Blob) ; texte accepté pour les tests et les anciens appels. */
export type CloudData = Blob | string;
const asBody = (d: CloudData): Blob => (typeof d === 'string' ? new Blob([d], { type: 'application/json' }) : d);

export type CloudId = 'gdrive' | 'onedrive' | 'dropbox';
export const CLOUDS: CloudId[] = ['gdrive', 'onedrive', 'dropbox'];

export interface CloudFile {
  id: string;
  name: string;
  size?: number;
  modified?: string;
  /**
   * Version du fichier au moment de la lecture ou du dernier enregistrement : eTag (OneDrive), rev (Dropbox),
   * version (Google Drive). L'enregistrement suivant n'aboutit que si le fichier n'a pas changé depuis.
   */
  rev?: string;
  /**
   * Google Drive seulement : une modification faite ailleurs pendant notre envoi a été détectée après coup ;
   * elle a été recopiée sous ce nom (les deux versions sont conservées).
   */
  concurrentCopy?: string;
}

/**
 * Mode d'enregistrement :
 *  - `update` : remplace `existing` seulement s'il est encore à la version `existing.rev` (sinon ConflictError) ;
 *  - `create` : crée un nouveau fichier, sans jamais remplacer un fichier du même nom (sinon ConflictError) ;
 *  - `overwrite` : remplace sans condition (uniquement après confirmation explicite de l'utilisateur).
 */
export type SaveMode = 'update' | 'create' | 'overwrite';

interface Provider {
  label: string;
  authUrl: string;
  tokenUrl?: string; // absent : jeton reçu directement (Google)
  scope: string;
  extraAuth?: Record<string, string>;
  list: (token: string) => Promise<CloudFile[]>;
  /** Contenu brut (archive v2 ou JSON v1, reconnu ensuite par sa signature) et version. */
  load: (token: string, f: CloudFile) => Promise<{ data: Blob; rev?: string }>;
  save: (token: string, name: string, data: CloudData, mode: SaveMode, existing?: CloudFile) => Promise<CloudFile>;
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
  // 401 : jeton expiré ou révoqué (reconnexion), voir withToken
  if (r.status === 401) throw new AuthError('service');
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${(await r.text()).slice(0, 200)}`);
  return r;
}

const isProjectName = (n: string) => n.endsWith(FILE_EXT) || n.endsWith('.openrgie');

/** Dropbox : un conflit est une erreur 409 dont le résumé contient « conflict ». */
async function dropboxCheck(r: Response, name: string): Promise<Response> {
  if (r.status === 409) {
    const text = await r.text();
    if (/conflict/i.test(text)) throw new ConflictError('Dropbox : ' + name, text.slice(0, 120));
    throw new Error(`409 — ${text.slice(0, 200)}`);
  }
  return check(r);
}

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
      const j = (await r.json()) as { entries: { '.tag': string; id: string; name: string; path_lower: string; size?: number; server_modified?: string; rev?: string }[] };
      return j.entries
        .filter((e) => e['.tag'] === 'file' && isProjectName(e.name))
        .map((e) => ({ id: e.path_lower, name: e.name, size: e.size, modified: e.server_modified, rev: e.rev }));
    },
    load: async (token, f) => {
      const r = await check(
        await fetch('https://content.dropboxapi.com/2/files/download', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, 'Dropbox-API-Arg': asciiJson({ path: f.id }) },
        }),
      );
      // Révision lue : en-tête Dropbox-API-Result ; à défaut (en-tête non exposé), demandée à part.
      let rev: string | undefined;
      try {
        rev = (JSON.parse(r.headers.get('Dropbox-API-Result') ?? '{}') as { rev?: string }).rev;
      } catch {
        /* en-tête illisible */
      }
      const data = await r.blob();
      if (!rev) {
        const m = await check(
          await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: f.id }),
          }),
        );
        rev = ((await m.json()) as { rev?: string }).rev;
      }
      return { data, rev };
    },
    save: async (token, name, data, mode, existing) => {
      if (mode === 'update' && !existing?.rev) throw new ConflictError('Dropbox : ' + name, 'version inconnue');
      const dbxMode = mode === 'update' ? { '.tag': 'update', update: existing!.rev } : mode === 'create' ? 'add' : 'overwrite';
      const path = mode === 'update' ? existing!.id : '/' + name;
      const r = await dropboxCheck(
        await fetch('https://content.dropboxapi.com/2/files/upload', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/octet-stream',
            'Dropbox-API-Arg': asciiJson({ path, mode: dbxMode, autorename: false, mute: true }),
          },
          body: asBody(data),
        }),
        name,
      );
      const j = (await r.json()) as { path_lower: string; name: string; size: number; rev?: string; server_modified?: string };
      return { id: j.path_lower, name: j.name, size: j.size, rev: j.rev, modified: j.server_modified };
    },
  },
  onedrive: {
    label: 'OneDrive',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'Files.ReadWrite.AppFolder',
    list: async (token) => {
      const r = await check(await fetch('https://graph.microsoft.com/v1.0/me/drive/special/approot/children', { headers: { Authorization: 'Bearer ' + token } }));
      const j = (await r.json()) as { value: { id: string; name: string; size: number; lastModifiedDateTime: string; eTag?: string; file?: unknown }[] };
      return j.value
        .filter((e) => e.file && isProjectName(e.name))
        .map((e) => ({ id: e.id, name: e.name, size: e.size, modified: e.lastModifiedDateTime, rev: e.eTag }));
    },
    load: async (token, f) => {
      // Version d'abord, contenu ensuite : si le fichier change entre les deux, l'enregistrement suivant sera
      // refusé (prudent), jamais l'inverse.
      const auth = { Authorization: 'Bearer ' + token };
      const meta = await check(await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(f.id)}`, { headers: auth }));
      const rev = ((await meta.json()) as { eTag?: string }).eTag;
      const data = await (await check(await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(f.id)}/content`, { headers: auth }))).blob();
      return { data, rev };
    },
    save: async (token, name, data, mode, existing) => {
      if (mode === 'update' && !existing?.rev) throw new ConflictError('OneDrive : ' + name, 'version inconnue');
      // Envoi simple (PUT) : jusqu'à 250 Mo [à vérifier] ; au-delà, une session d'envoi serait nécessaire.
      const headers: Record<string, string> = { Authorization: 'Bearer ' + token, 'Content-Type': typeof data === 'string' ? 'application/json' : 'application/octet-stream' };
      let url: string;
      if (mode === 'update') {
        url = `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(existing!.id)}/content`;
        headers['If-Match'] = existing!.rev!;
      } else {
        const behavior = mode === 'create' ? 'fail' : 'replace';
        url = `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${encodeURIComponent(name)}:/content?@microsoft.graph.conflictBehavior=${behavior}`;
      }
      const r = await fetch(url, { method: 'PUT', headers, body: asBody(data) });
      // 412 : version différente (If-Match) ; 409 : un fichier de ce nom existe déjà (création)
      if (r.status === 412 || r.status === 409) throw new ConflictError('OneDrive : ' + name, String(r.status));
      await check(r);
      const j = (await r.json()) as { id: string; name: string; size: number; eTag?: string; lastModifiedDateTime?: string };
      return { id: j.id, name: j.name, size: j.size, rev: j.eTag, modified: j.lastModifiedDateTime };
    },
  },
  gdrive: {
    label: 'Google Drive',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'https://www.googleapis.com/auth/drive.file',
    list: async (token) => {
      const q = encodeURIComponent(`name contains '${FILE_EXT}' and trashed = false`);
      const r = await check(
        await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,size,modifiedTime,version)&orderBy=modifiedTime desc`, {
          headers: { Authorization: 'Bearer ' + token },
        }),
      );
      const j = (await r.json()) as { files: { id: string; name: string; size?: string; modifiedTime: string; version?: string }[] };
      // Pas de révision dans la liste : la version complète (version|révision) est lue à l'ouverture (load)
      return j.files.map((f) => ({ id: f.id, name: f.name, size: f.size ? Number(f.size) : undefined, modified: f.modifiedTime }));
    },
    load: async (token, f) => {
      const rev = await driveVersion(token, f.id);
      const data = await (await check(await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(f.id)}?alt=media`, { headers: { Authorization: 'Bearer ' + token } }))).blob();
      return { data, rev };
    },
    save: async (token, name, data, mode, existing) => {
      if (mode !== 'create' && existing) {
        // L'API v3 n'a pas d'écriture conditionnelle. Deux contrôles :
        //  1. avant l'envoi : version et révision inchangées depuis l'ouverture (sinon conflit, rien n'est envoyé) ;
        //  2. après l'envoi : la révision qui précède la nôtre doit être celle de l'ouverture. Sinon, quelqu'un a
        //     enregistré pendant notre envoi : sa version (toujours dans l'historique de Drive) est recopiée en
        //     copie de conflit. Les deux versions sont donc conservées, même dans ce cas.
        //  3. stratégie conservatrice : la révision que nous allons remplacer est d'abord marquée « à conserver
        //     indéfiniment » (keepForever), et notre envoi aussi (keepRevisionForever). Drive ne purge donc jamais
        //     une version remplacée par Voltaplan : même en cas de course non détectée, elle reste récupérable
        //     (Drive → clic droit → Gérer les versions). Si ce marquage échoue, on n'envoie pas.
        const now = await driveVersion(token, existing.id);
        if (mode === 'update') {
          if (!existing.rev) throw new ConflictError('Google Drive : ' + name, 'version inconnue');
          if (now !== existing.rev) throw new ConflictError('Google Drive : ' + name, `version ${existing.rev} → ${now}`);
        }
        const current = now?.split('|')[1];
        if (current) await drivePin(token, existing.id, current);
        const r = await check(
          await fetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existing.id)}?uploadType=media&keepRevisionForever=true&fields=id,name,size,modifiedTime,version,headRevisionId`, {
            method: 'PATCH',
            headers: { Authorization: 'Bearer ' + token, 'Content-Type': typeof data === 'string' ? 'application/json' : MIMETYPE },
            body: asBody(data),
          }),
        );
        const saved = driveFile(await r.json());
        const head = mode === 'update' ? existing.rev?.split('|')[1] : undefined;
        if (head) {
          const between = await driveRevisionsBetween(token, existing.id, head, saved.rev?.split('|')[1]);
          if (between.length) {
            // Recopie de la dernière version écrite par l'autre appareil (les révisions intermédiaires restent dans Drive)
            const theirs = await (
              await check(
                await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(existing.id)}/revisions/${encodeURIComponent(between[between.length - 1])}?alt=media`, {
                  headers: { Authorization: 'Bearer ' + token },
                }),
              )
            ).blob();
            const copyName = conflictName(name);
            await driveCreate(token, copyName, theirs);
            saved.concurrentCopy = copyName;
          }
        }
        // Drive limite le nombre de révisions conservées indéfiniment par fichier : on libère les plus anciennes
        // au-delà d'un seuil (jamais les plus récentes). Échec sans conséquence pour l'enregistrement.
        await driveReleaseOldPins(token, existing.id).catch(() => undefined);
        return saved;
      }
      // Création : Drive admet plusieurs fichiers de même nom, un fichier existant n'est donc jamais remplacé.
      return driveCreate(token, name, data);
    },
  },
};

async function driveCreate(token: string, name: string, data: CloudData): Promise<CloudFile> {
  const boundary = 'voltaplan' + Math.random().toString(36).slice(2);
  const type = typeof data === 'string' ? 'application/json' : MIMETYPE;
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, mimeType: type })}\r\n`,
    `--${boundary}\r\nContent-Type: ${type}\r\n\r\n`,
    asBody(data),
    `\r\n--${boundary}--`,
  ]);
  const r = await check(
    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&keepRevisionForever=true&fields=id,name,size,modifiedTime,version,headRevisionId', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'multipart/related; boundary=' + boundary },
      body,
    }),
  );
  return driveFile(await r.json());
}

/** Version complète d'un fichier Drive : « version|révision de tête » (les deux changent à chaque envoi). */
async function driveVersion(token: string, id: string): Promise<string | undefined> {
  const r = await check(await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=version,headRevisionId`, { headers: { Authorization: 'Bearer ' + token } }));
  const j = (await r.json()) as { version?: string; headRevisionId?: string };
  return j.version ? `${j.version}|${j.headRevisionId ?? ''}` : undefined;
}

/**
 * Révisions écrites entre `from` (révision de l'ouverture) et `to` (notre envoi), exclues : vide si personne d'autre
 * n'a enregistré pendant notre envoi. Si `from` n'est plus dans l'historique (purgé par Drive), on ne conclut rien.
 */
async function driveRevisionsBetween(token: string, id: string, from: string, to: string | undefined): Promise<string[]> {
  const r = await check(await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}/revisions?fields=revisions(id)&pageSize=1000`, { headers: { Authorization: 'Bearer ' + token } }));
  const ids = ((await r.json()) as { revisions?: { id: string }[] }).revisions?.map((x) => x.id) ?? [];
  return revisionsBetween(ids, from, to);
}

/** Marque une révision « à conserver indéfiniment ». Plafond atteint : on libère d'anciennes révisions et on réessaie. */
async function drivePin(token: string, id: string, rev: string): Promise<void> {
  const pin = () =>
    fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}/revisions/${encodeURIComponent(rev)}?fields=id,keepForever`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ keepForever: true }),
    });
  const r = await pin();
  if (r.ok) return;
  if (r.status === 401) throw new AuthError('Google Drive');
  await driveReleaseOldPins(token, id, DRIVE_PINS_KEEP / 2);
  await check(await pin());
}

/** Seuils de conservation des révisions « indéfinies » (Drive en limite le nombre par fichier [à vérifier : 200]). */
export const DRIVE_PINS_MAX = 150;
export const DRIVE_PINS_KEEP = 100;

async function driveReleaseOldPins(token: string, id: string, keep = DRIVE_PINS_KEEP): Promise<void> {
  const r = await check(
    await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}/revisions?fields=revisions(id,keepForever)&pageSize=1000`, { headers: { Authorization: 'Bearer ' + token } }),
  );
  const revs = ((await r.json()) as { revisions?: { id: string; keepForever?: boolean }[] }).revisions ?? [];
  for (const rid of pinsToRelease(revs, keep === DRIVE_PINS_KEEP ? DRIVE_PINS_MAX : keep, keep))
    await check(
      await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}/revisions/${encodeURIComponent(rid)}`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepForever: false }),
      }),
    );
}

/**
 * Fonction pure (testée) : révisions « conservées indéfiniment » à libérer, des plus anciennes aux plus récentes,
 * seulement quand il y en a plus de `max`, pour revenir à `keep`. Les 20 dernières révisions ne sont jamais libérées.
 */
export function pinsToRelease(revs: { id: string; keepForever?: boolean }[], max = DRIVE_PINS_MAX, keep = DRIVE_PINS_KEEP): string[] {
  const pinned = revs.slice(0, Math.max(0, revs.length - 20)).filter((r) => r.keepForever);
  const total = revs.filter((r) => r.keepForever).length;
  if (total <= max) return [];
  return pinned.slice(0, Math.max(0, total - keep)).map((r) => r.id);
}

/** Fonction pure (testée) : identifiants strictement entre `from` et `to` dans la liste chronologique. */
export function revisionsBetween(ids: string[], from: string, to: string | undefined): string[] {
  const a = ids.indexOf(from);
  const b = to ? ids.indexOf(to) : ids.length;
  if (a < 0 || b < 0 || b <= a) return [];
  return ids.slice(a + 1, b);
}

function driveFile(j: { id: string; name: string; size?: string; modifiedTime?: string; version?: string; headRevisionId?: string }): CloudFile {
  return { id: j.id, name: j.name, size: j.size ? Number(j.size) : undefined, modified: j.modifiedTime, rev: j.version ? `${j.version}|${j.headRevisionId ?? ''}` : undefined };
}

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

/**
 * Appel avec un jeton valide. Jeton expiré ou révoqué (401) : il est oublié et la connexion est refaite une fois.
 * Si la fenêtre de connexion ne peut pas s'ouvrir (le navigateur l'exige après un clic : ex. reprise automatique au
 * retour du réseau), AuthError : l'appelant garde la version et attend le prochain clic sur « Enregistrer ».
 */
export async function withToken<T>(id: CloudId, fn: (token: string) => Promise<T>, connect: (id: CloudId) => Promise<string> = cloudConnect): Promise<T> {
  const label = PROVIDERS[id].label;
  const fresh = async () => {
    try {
      return await connect(id);
    } catch (e) {
      if ((e as Error).message === 'popup') throw new AuthError(label);
      throw e;
    }
  };
  const first = cloudToken(id);
  try {
    return await fn(first ?? (await fresh()));
  } catch (e) {
    if (!(e instanceof AuthError) || !first) throw e instanceof AuthError ? new AuthError(label) : e;
    cloudForget(id);
    try {
      return await fn(await fresh());
    } catch (e2) {
      throw e2 instanceof AuthError ? new AuthError(label) : e2;
    }
  }
}

export async function cloudList(id: CloudId): Promise<CloudFile[]> {
  return withToken(id, (t) => PROVIDERS[id].list(t));
}

/** Lecture : contenu du projet (archive v2 ou JSON v1) et version du fichier (à mémoriser pour l'enregistrement suivant). */
export async function cloudLoad(id: CloudId, f: CloudFile): Promise<{ data: Blob; rev?: string }> {
  return withToken(id, (t) => PROVIDERS[id].load(t, f));
}

/** Enregistrement (voir SaveMode) ; renvoie le fichier à jour avec sa nouvelle version. */
export async function cloudSave(id: CloudId, name: string, project: Project, mode: SaveMode, existing?: CloudFile): Promise<CloudFile> {
  // Archive v2 assemblée (documents vérifiés) avant toute connexion : un document manquant arrête tout ici.
  const data = (await (await import('./projectData')).serializeProject(project))!;
  return withToken(id, (t) => PROVIDERS[id].save(t, name, data, mode, existing));
}

/** Pour les tests : pose un jeton en mémoire. */
export function setCloudTokenForTest(id: CloudId, token: string, ttlMs = 3_600_000) {
  tokens[id] = { token, expires: Date.now() + ttlMs };
}
