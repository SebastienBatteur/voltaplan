/**
 * Emplacements d'enregistrement (comme draw.io) :
 *  - « Cet appareil » : fichier local (voir files.ts) ;
 *  - « Navigateur » : projets gardés dans le navigateur (IndexedDB), plus un brouillon automatique ;
 *  - « GitHub » : fichier dans un dépôt, via l'API GitHub, avec un jeton personnel chiffré localement.
 * Google Drive, OneDrive et Dropbox : voir cloud.ts (identifiant d'application OAuth à enregistrer chez chaque service).
 */
import { parseProjectText } from '../model/migrate';
import type { Project } from '../model/types';
import { FILE_EXT, STORAGE_PREFIX } from '../brand';
import type { SealedSecret } from '../ai/secureStore';
import type { CloudFile, CloudId } from './cloud';
import { checkTextSize } from './limits';
import { sanitizeProjectImages } from './sanitize';
import { ConflictError } from './conflict';
import type { SaveMode } from './cloud';

export type Location =
  | { kind: 'device' }
  | { kind: 'browser'; id: string; rev?: number }
  | { kind: 'github'; repo: string; branch: string; path: string; sha?: string }
  | { kind: 'cloud'; provider: CloudId; file: CloudFile };

// ---------------------------------------------------------------------------
// Navigateur (IndexedDB)
// ---------------------------------------------------------------------------

export interface BrowserEntry {
  id: string;
  name: string;
  updated: string; // ISO
  size: number;
  data: string; // JSON du projet
  /** Révision, augmentée à chaque enregistrement : deux onglets ne s'écrasent pas sans le savoir. */
  rev?: number;
}

/**
 * Version locale d'un projet, gardée dans le navigateur à chaque enregistrement (où qu'il ait lieu) et à chaque
 * conflit ou enregistrement en attente : on peut toujours revenir en arrière, même si le fichier distant est perdu.
 */
export interface LocalVersion {
  vid: string;
  /** Emplacement d'origine (voir locationKey). */
  key: string;
  name: string;
  at: string; // ISO
  reason: 'save' | 'conflict' | 'pending';
  size: number;
  data: string;
}

const DB = 'voltaplan';
const STORE = 'projects';
const VERSIONS = 'versions';
/** Préfixe des brouillons automatiques (un par onglet : « __autosave__:<onglet> » ; ancien brouillon unique sans suffixe). */
export const AUTOSAVE_ID = '__autosave__';
export const isDraftId = (id: string) => id === AUTOSAVE_ID || id.startsWith(AUTOSAVE_ID + ':');
/** Versions gardées par projet, et au total. */
export const VERSIONS_PER_PROJECT = 20;
export const VERSIONS_TOTAL = 300;

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' });
      if (!d.objectStoreNames.contains(VERSIONS)) d.createObjectStore(VERSIONS, { keyPath: 'vid' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>, store = STORE): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const r = fn(d.transaction(store, mode).objectStore(store));
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      }),
  );
}

export async function browserList(): Promise<Omit<BrowserEntry, 'data'>[]> {
  const all = await tx<BrowserEntry[]>('readonly', (s) => s.getAll() as IDBRequest<BrowserEntry[]>);
  return all
    .filter((e) => !isDraftId(e.id))
    .map(({ data: _d, ...rest }) => rest)
    .sort((a, b) => b.updated.localeCompare(a.updated));
}

/**
 * Enregistre dans le navigateur. `expectedRev` : révision lue à l'ouverture (ou au dernier enregistrement) ;
 * si l'entrée a changé depuis (autre onglet), ConflictError. `'any'` : sans condition (brouillons, nouvelle entrée
 * confirmée). Lecture et écriture dans la même transaction : pas de fenêtre de course entre onglets.
 * Renvoie la nouvelle révision.
 */
export async function browserSave(id: string, name: string, project: Project, expectedRev: number | 'any' = 'any'): Promise<number> {
  const data = JSON.stringify(project);
  const d = await db();
  return new Promise<number>((resolve, reject) => {
    const t = d.transaction(STORE, 'readwrite');
    const s = t.objectStore(STORE);
    let rev = 0;
    let conflict: ConflictError | null = null;
    const g = s.get(id) as IDBRequest<BrowserEntry | undefined>;
    g.onsuccess = () => {
      const cur = g.result?.rev ?? (g.result ? 0 : -1);
      if (expectedRev !== 'any' && cur !== expectedRev) {
        conflict = new ConflictError(name, `révision ${expectedRev} → ${cur}`);
        t.abort();
        return;
      }
      rev = Math.max(cur, 0) + 1;
      s.put({ id, name, updated: new Date().toISOString(), size: data.length, data, rev } satisfies BrowserEntry);
    };
    t.oncomplete = () => resolve(rev);
    t.onabort = () => reject(conflict ?? t.error);
    t.onerror = () => reject(conflict ?? t.error);
  });
}

// ---------------------------------------------------------------------------
// Versions locales
// ---------------------------------------------------------------------------

/**
 * Versions à supprimer pour respecter les plafonds (fonction pure, testée) : on garde les `perKey` plus récentes de
 * chaque projet, puis les `total` plus récentes en tout.
 */
export function versionsToDelete(list: Pick<LocalVersion, 'vid' | 'key' | 'at'>[], perKey = VERSIONS_PER_PROJECT, total = VERSIONS_TOTAL): string[] {
  const sorted = [...list].sort((a, b) => b.at.localeCompare(a.at));
  const seen = new Map<string, number>();
  const kept: string[] = [];
  const del: string[] = [];
  for (const v of sorted) {
    const n = (seen.get(v.key) ?? 0) + 1;
    seen.set(v.key, n);
    if (n > perKey || kept.length >= total) del.push(v.vid);
    else kept.push(v.vid);
  }
  return del;
}

export async function addVersion(key: string, name: string, project: Project, reason: LocalVersion['reason']): Promise<void> {
  const data = JSON.stringify(project);
  const at = new Date().toISOString();
  const vid = `${at}-${Math.random().toString(36).slice(2, 8)}`;
  await tx('readwrite', (s) => s.put({ vid, key, name, at, reason, size: data.length, data } satisfies LocalVersion), VERSIONS);
  const all = await listVersions();
  for (const v of versionsToDelete(all)) await tx('readwrite', (s) => s.delete(v), VERSIONS);
}

/** Versions locales, des plus récentes aux plus anciennes (sans le contenu). */
export async function listVersions(): Promise<Omit<LocalVersion, 'data'>[]> {
  const all = await tx<LocalVersion[]>('readonly', (s) => s.getAll() as IDBRequest<LocalVersion[]>, VERSIONS);
  return all.map(({ data: _d, ...rest }) => rest).sort((a, b) => b.at.localeCompare(a.at));
}

export async function loadVersion(vid: string): Promise<LocalVersion | undefined> {
  return tx<LocalVersion | undefined>('readonly', (s) => s.get(vid) as IDBRequest<LocalVersion | undefined>, VERSIONS);
}

export async function deleteVersion(vid: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(vid), VERSIONS);
}

// ---------------------------------------------------------------------------
// Brouillons automatiques (un par onglet) et récupération après interruption
// ---------------------------------------------------------------------------

/** Identifiant de cet onglet (brouillon et signal de vie). */
export const TAB_ID = Math.random().toString(36).slice(2, 10);
export const draftId = (tab = TAB_ID) => `${AUTOSAVE_ID}:${tab}`;
const BEAT = STORAGE_PREFIX + 'tab.';
/** Un onglet sans signal de vie depuis ce délai est considéré comme fermé (ou planté). */
export const TAB_STALE_MS = 45_000;

/** Signal de vie de cet onglet (toutes les 10 s) : ses brouillons ne sont pas proposés aux autres onglets. */
export function startTabHeartbeat(): () => void {
  const beat = () => {
    try {
      localStorage.setItem(BEAT + TAB_ID, String(Date.now()));
    } catch {
      /* stockage indisponible */
    }
  };
  beat();
  const id = setInterval(beat, 10_000);
  const bye = () => {
    try {
      localStorage.removeItem(BEAT + TAB_ID);
    } catch {
      /* stockage indisponible */
    }
  };
  window.addEventListener('pagehide', bye);
  return () => {
    clearInterval(id);
    window.removeEventListener('pagehide', bye);
    bye();
  };
}

/** Vrai si le brouillon appartient à un onglet encore ouvert (autre que celui-ci). */
export function draftIsLive(id: string, now = Date.now(), read: (k: string) => string | null = (k) => localStorage.getItem(k)): boolean {
  const tab = id.slice(AUTOSAVE_ID.length + 1);
  if (!tab || tab === TAB_ID) return false;
  const t = Number(read(BEAT + tab));
  return Number.isFinite(t) && now - t < TAB_STALE_MS;
}

/** Brouillons d'onglets fermés ou interrompus, à proposer à la récupération (plus récent d'abord). */
export async function orphanDrafts(): Promise<BrowserEntry[]> {
  const all = await tx<BrowserEntry[]>('readonly', (s) => s.getAll() as IDBRequest<BrowserEntry[]>);
  return all.filter((e) => isDraftId(e.id) && e.id !== draftId() && !draftIsLive(e.id)).sort((a, b) => b.updated.localeCompare(a.updated));
}

export async function browserLoad(id: string): Promise<BrowserEntry | undefined> {
  return tx<BrowserEntry | undefined>('readonly', (s) => s.get(id) as IDBRequest<BrowserEntry | undefined>);
}

export async function browserDelete(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

// ---------------------------------------------------------------------------
// GitHub (API REST « contents »)
// ---------------------------------------------------------------------------

export interface GithubSettings {
  repo: string; // propriétaire/nom
  branch: string;
  folder: string;
  token?: SealedSecret;
}

const GH_KEY = STORAGE_PREFIX + 'github';
export function loadGithubSettings(): GithubSettings {
  try {
    return { repo: '', branch: 'main', folder: 'voltaplan', ...JSON.parse(localStorage.getItem(GH_KEY) ?? '{}') };
  } catch {
    return { repo: '', branch: 'main', folder: 'voltaplan' };
  }
}
export function saveGithubSettings(s: GithubSettings) {
  try {
    localStorage.setItem(GH_KEY, JSON.stringify(s));
  } catch {
    /* stockage indisponible */
  }
}
let ghToken: string | null = null;
export const getGithubToken = () => ghToken;
export const setGithubToken = (t: string | null) => {
  ghToken = t;
};

/** Base64 d'un texte UTF-8 (accents, symboles). */
export function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const ghHeaders = (token: string, raw = false) => ({
  Authorization: `Bearer ${token}`,
  Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

function ghUrl(repo: string, path: string, branch?: string) {
  const p = path.split('/').map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${repo}/contents/${p}${branch ? `?ref=${encodeURIComponent(branch)}` : ''}`;
}

async function ghError(r: Response): Promise<Error> {
  let msg = `${r.status}`;
  try {
    msg += ' ' + ((await r.json()) as { message?: string }).message;
  } catch {
    /* pas de corps JSON */
  }
  return new Error('GitHub : ' + msg);
}

export async function githubList(token: string, s: GithubSettings): Promise<{ name: string; path: string; size: number }[]> {
  const r = await fetch(ghUrl(s.repo, s.folder, s.branch), { headers: ghHeaders(token) });
  if (r.status === 404) return [];
  if (!r.ok) throw await ghError(r);
  const items = (await r.json()) as { name: string; path: string; size: number; type: string }[];
  return items.filter((i) => i.type === 'file' && (i.name.endsWith(FILE_EXT) || i.name.endsWith('.openrgie'))).map(({ name, path, size }) => ({ name, path, size }));
}

/** SHA actuel du fichier (undefined s'il n'existe pas). */
async function githubSha(token: string, s: GithubSettings, path: string): Promise<string | undefined> {
  const head = await fetch(ghUrl(s.repo, path, s.branch), { headers: ghHeaders(token) });
  if (head.status === 404) return undefined;
  if (!head.ok) throw await ghError(head);
  return ((await head.json()) as { sha?: string }).sha;
}

/**
 * Lecture : texte et SHA du fichier. Le SHA est lu d'abord : si le fichier change entre les deux appels,
 * l'enregistrement suivant sera refusé (prudent), jamais l'inverse.
 */
export async function githubLoad(token: string, s: GithubSettings, path: string): Promise<{ text: string; sha?: string }> {
  const sha = await githubSha(token, s, path);
  // Format « raw » : fonctionne aussi pour les fichiers de plus de 1 Mo (photos de fond)
  const r = await fetch(ghUrl(s.repo, path, s.branch), { headers: ghHeaders(token, true) });
  if (!r.ok) throw await ghError(r);
  return { text: await r.text(), sha };
}

/**
 * Enregistrement (voir SaveMode de cloud.ts) :
 *  - `update` : avec le SHA mémorisé à l'ouverture ; GitHub refuse (409) si le fichier a changé depuis ;
 *  - `create` : sans SHA ; GitHub refuse (422) si un fichier existe déjà à ce chemin ;
 *  - `overwrite` : SHA relu juste avant (remplacement confirmé par l'utilisateur).
 * Renvoie le nouveau SHA.
 */
export async function githubSave(token: string, s: GithubSettings, path: string, project: Project, mode: SaveMode = 'overwrite', expectedSha?: string): Promise<string | undefined> {
  if (mode === 'update' && !expectedSha) throw new ConflictError('GitHub : ' + path, 'version inconnue');
  const sha = mode === 'update' ? expectedSha : mode === 'overwrite' ? await githubSha(token, s, path) : undefined;
  const body = {
    message: `Voltaplan : ${project.meta.title || path}`,
    content: utf8ToBase64(JSON.stringify(project, null, 1)),
    branch: s.branch,
    ...(sha ? { sha } : {}),
  };
  const r = await fetch(ghUrl(s.repo, path), { method: 'PUT', headers: { ...ghHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  // 409 : SHA périmé (modifié ailleurs) ; 422 « sha wasn't supplied » : un fichier existe déjà (création sur un nom pris)
  if (r.status === 409) throw new ConflictError('GitHub : ' + path, '409');
  if (r.status === 422) {
    const msg = await r.text();
    if (/sha/i.test(msg)) throw new ConflictError('GitHub : ' + path, '422');
    throw new Error('GitHub : 422 ' + msg.slice(0, 200));
  }
  if (!r.ok) throw await ghError(r);
  try {
    return ((await r.json()) as { content?: { sha?: string } }).content?.sha;
  } catch {
    return undefined;
  }
}

/**
 * Lecture d'un projet (texte JSON) quelle que soit sa provenance : taille bornée, structure validée et migrée
 * (src/model/migrate.ts), images limitées aux images intégrées (sanitize.ts). `removed` : images retirées.
 */
export function parseProjectChecked(text: string, name?: string): ReturnType<typeof parseProjectText> & { removed: number } {
  checkTextSize(text, name);
  const r = parseProjectText(text);
  const removed = sanitizeProjectImages(r.project);
  return { ...r, removed };
}

export function parseProject(text: string, name?: string): Project {
  return parseProjectChecked(text, name).project;
}

export function safeName(name: string): string {
  return (name || 'projet').replace(/[\\/:*?"<>|]/g, '_').trim() || 'projet';
}
