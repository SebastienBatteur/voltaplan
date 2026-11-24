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

export type Location =
  | { kind: 'device' }
  | { kind: 'browser'; id: string }
  | { kind: 'github'; repo: string; branch: string; path: string }
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
}

const DB = 'voltaplan';
const STORE = 'projects';
export const AUTOSAVE_ID = '__autosave__';

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const r = fn(d.transaction(STORE, mode).objectStore(STORE));
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      }),
  );
}

export async function browserList(): Promise<Omit<BrowserEntry, 'data'>[]> {
  const all = await tx<BrowserEntry[]>('readonly', (s) => s.getAll() as IDBRequest<BrowserEntry[]>);
  return all
    .filter((e) => e.id !== AUTOSAVE_ID)
    .map(({ data: _d, ...rest }) => rest)
    .sort((a, b) => b.updated.localeCompare(a.updated));
}

export async function browserSave(id: string, name: string, project: Project): Promise<void> {
  const data = JSON.stringify(project);
  await tx('readwrite', (s) => s.put({ id, name, updated: new Date().toISOString(), size: data.length, data } satisfies BrowserEntry));
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

export async function githubLoad(token: string, s: GithubSettings, path: string): Promise<string> {
  // Format « raw » : fonctionne aussi pour les fichiers de plus de 1 Mo (photos de fond)
  const r = await fetch(ghUrl(s.repo, path, s.branch), { headers: ghHeaders(token, true) });
  if (!r.ok) throw await ghError(r);
  return r.text();
}

export async function githubSave(token: string, s: GithubSettings, path: string, project: Project): Promise<void> {
  // SHA du fichier existant (obligatoire pour le remplacer)
  let sha: string | undefined;
  const head = await fetch(ghUrl(s.repo, path, s.branch), { headers: ghHeaders(token) });
  if (head.ok) sha = ((await head.json()) as { sha?: string }).sha;
  else if (head.status !== 404) throw await ghError(head);
  const body = {
    message: `Voltaplan : ${project.meta.title || path}`,
    content: utf8ToBase64(JSON.stringify(project, null, 1)),
    branch: s.branch,
    ...(sha ? { sha } : {}),
  };
  const r = await fetch(ghUrl(s.repo, path), { method: 'PUT', headers: { ...ghHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw await ghError(r);
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
