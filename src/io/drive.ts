/**
 * Google Drive (API v3), appels communs au fichier unique (cloud.ts), au dossier de projet (driveFolder.ts) et à
 * « Ouvrir avec Voltaplan » (driveOpenWith.ts). Tout part du navigateur, avec la portée `drive.file` : Voltaplan
 * ne voit que ce qu'il a créé ou ce que l'utilisateur lui a ouvert.
 *
 * L'API v3 n'a pas d'écriture conditionnelle (pas d'If-Match). Stratégie prudente pour tout fichier modifiable
 * (fichier `.voltaplan` ou `project.json` d'un dossier), voir docs/google-drive.md :
 *  1. avant l'envoi : version et révision de tête relues, comparées à celles de l'ouverture (sinon conflit) ;
 *  2. la révision remplacée est marquée « à conserver indéfiniment » (keepForever), notre envoi aussi ;
 *  3. après l'envoi : une révision intercalée entre l'ouverture et la nôtre est recopiée en copie de conflit ;
 *  4. libération des plus anciennes révisions marquées, selon le nombre ET la taille (pinsToReleaseBySize).
 * Comportements tirés de la documentation de Google, testés avec des réponses simulées [à vérifier avec de vrais
 * comptes].
 *
 * Fonction `fetch` injectable (tests) ; par défaut celle du navigateur, résolue à chaque appel.
 */
import type { CloudFile, SaveMode } from './cloud';
import { AuthError, cloudQuotaReached, ConflictError, conflictName, StorageFullError } from './conflict';
import { MIMETYPE } from '../format/manifest';
import { listPending } from './storage';

export type Fetch = typeof fetch;
export const DRIVE_API = 'https://www.googleapis.com/drive/v3';
export const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
export const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const FILE_FIELDS = 'id,name,size,modifiedTime,version,headRevisionId';
/** Envoi « multipart » (une requête) jusqu'à 5 Mo, comme le conseille Google ; envoi « resumable » au-delà [à vérifier]. */
export const DRIVE_MULTIPART_MAX = 5 * 1024 * 1024;
/** Tranche d'un envoi « resumable » : multiple de 256 Kio exigé par Drive. */
export const DRIVE_CHUNK = 32 * 256 * 1024;

/** Contexte d'appel : jeton, fetch (injectable), clés de ressource (fichiers partagés par lien, en-tête dédié). */
export interface DriveCtx {
  token: string;
  fetch?: Fetch;
  /** Valeur de l'en-tête X-Goog-Drive-Resource-Keys (« id/clé,id/clé »), construite à partir de valeurs validées. */
  resourceKeys?: string;
}

export interface DriveItem {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  version?: string;
  headRevisionId?: string;
  parents?: string[];
  appProperties?: Record<string, string>;
  capabilities?: { canEdit?: boolean };
}

/** Requête authentifiée (en-têtes en objet simple). */
export function driveFetch(c: DriveCtx, url: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = { Authorization: 'Bearer ' + c.token, ...((init.headers as Record<string, string> | undefined) ?? {}) };
  if (c.resourceKeys) headers['X-Goog-Drive-Resource-Keys'] = c.resourceKeys;
  return (c.fetch ?? ((...a: Parameters<Fetch>) => fetch(...a)))(url, { ...init, headers });
}

/** Réponse contrôlée : 401 → AuthError (reconnexion), espace épuisé → StorageFullError, autre erreur → Error. */
export async function driveCheck(r: Response): Promise<Response> {
  if (r.status === 401) throw new AuthError('Google Drive');
  if (!r.ok) {
    const text = (await r.text().catch(() => '')).slice(0, 2000);
    // 403 « storageQuotaExceeded » : espace Google épuisé [à vérifier avec un vrai compte]
    if (cloudQuotaReached(r.status, text)) throw new StorageFullError('Google Drive', `${r.status}`);
    throw Object.assign(new Error(`${r.status} ${r.statusText} — ${text.slice(0, 200)}`), { status: r.status });
  }
  return r;
}

const call = async (c: DriveCtx, url: string, init?: RequestInit) => driveCheck(await driveFetch(c, url, init));

/** Chaîne de requête Drive (`q`) : apostrophes et barres obliques inverses échappées. */
export const qstr = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

export function driveFile(j: DriveItem): CloudFile {
  return { id: j.id, name: j.name, size: j.size ? Number(j.size) : undefined, modified: j.modifiedTime, rev: j.version ? `${j.version}|${j.headRevisionId ?? ''}` : undefined };
}

/** Recherche (toutes les pages), du plus ancien au plus récent. */
export async function driveFind(c: DriveCtx, q: string, fields = 'id,name,mimeType,size,createdTime,modifiedTime,version,headRevisionId,parents,appProperties'): Promise<DriveItem[]> {
  const out: DriveItem[] = [];
  let page: string | undefined;
  do {
    const u = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(`nextPageToken,files(${fields})`)}&orderBy=createdTime&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true${page ? '&pageToken=' + encodeURIComponent(page) : ''}`;
    const j = (await (await call(c, u)).json()) as { files?: DriveItem[]; nextPageToken?: string };
    out.push(...(j.files ?? []));
    page = j.nextPageToken;
  } while (page);
  return out;
}

/** Métadonnées d'un fichier (ou d'un dossier). */
export async function driveGet(c: DriveCtx, id: string, fields: string): Promise<DriveItem> {
  return (await (await call(c, `${DRIVE_API}/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}&supportsAllDrives=true`)).json()) as DriveItem;
}

/** Contenu d'un fichier. */
export async function driveMedia(c: DriveCtx, id: string): Promise<Blob> {
  return (await call(c, `${DRIVE_API}/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`)).blob();
}

/**
 * Version complète d'un fichier Drive : « version|révision de tête ». `version` change aussi SANS modification du
 * contenu (traitements internes de Drive juste après la création, marquage « à conserver » d'une révision : constaté
 * sur un vrai compte le 2026-11-24, version 1 → 2, révision de tête identique). Pour détecter une modification faite
 * ailleurs, seule la révision de tête compte : voir sameDriveContent.
 */
export async function driveVersion(c: DriveCtx, id: string): Promise<string | undefined> {
  const r = await call(c, `${DRIVE_API}/files/${encodeURIComponent(id)}?fields=version,headRevisionId`);
  const j = (await r.json()) as { version?: string; headRevisionId?: string };
  return j.version ? `${j.version}|${j.headRevisionId ?? ''}` : undefined;
}

/**
 * Même contenu ? Compare la révision de tête (elle change à chaque envoi de contenu, par n'importe quel appareil ou
 * logiciel) ; à défaut (ancienne version mémorisée sans révision), la version complète.
 */
export function sameDriveContent(a: string | undefined, b: string | undefined): boolean {
  const ha = a?.split('|')[1];
  const hb = b?.split('|')[1];
  return ha && hb ? ha === hb : a === b;
}

/** Début de la partie manquante d'après l'en-tête Range d'une réponse 308 (« bytes=0-N » → N+1 ; absent → 0). */
export function nextOffset(range: string | null): number {
  const m = /bytes=\d+-(\d+)/.exec(range ?? '');
  return m ? Number(m[1]) + 1 : 0;
}

/**
 * Envoi « resumable » : session ouverte par `init` (création POST ou mise à jour PATCH), puis tranches ; après une
 * coupure, on demande au service où reprendre (PUT « bytes * / taille ») au lieu de tout renvoyer. L'adresse de
 * session est sur www.googleapis.com (CSP inchangée) [à vérifier : en-têtes Location et Range lisibles depuis le
 * navigateur (CORS)].
 */
async function driveResumable(c: DriveCtx, url: string, method: 'POST' | 'PATCH', meta: object, blob: Blob, type: string): Promise<DriveItem> {
  const s = await call(c, url, {
    method,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': type, 'X-Upload-Content-Length': String(blob.size) },
    body: JSON.stringify(meta),
  });
  const session = s.headers.get('Location');
  if (!session) throw new Error('Google Drive : adresse de session d’envoi absente');
  const size = blob.size;
  let start = 0;
  let retries = 0;
  // Garde-fou : jamais de boucle sans fin si le service ne progresse pas
  for (let guard = Math.ceil(size / DRIVE_CHUNK) + 8; guard > 0; guard--) {
    const end = Math.min(start + DRIVE_CHUNK, size);
    let r: Response;
    try {
      r = await driveFetch(c, session, { method: 'PUT', headers: { 'Content-Range': size ? `bytes ${start}-${end - 1}/${size}` : 'bytes */0' }, body: blob.slice(start, end) });
    } catch (e) {
      if (!(e instanceof TypeError) || retries++ >= 3) throw e;
      const st = await driveFetch(c, session, { method: 'PUT', headers: { 'Content-Range': `bytes */${size}` } });
      if (st.status === 308) {
        start = nextOffset(st.headers.get('Range'));
        continue;
      }
      if (st.ok) return (await st.json()) as DriveItem;
      throw e;
    }
    if (r.status === 308) {
      start = nextOffset(r.headers.get('Range'));
      continue;
    }
    return (await (await driveCheck(r)).json()) as DriveItem;
  }
  throw new Error('Google Drive : envoi incomplet');
}

export interface DriveCreateOptions {
  parents?: string[];
  mimeType?: string;
  appProperties?: Record<string, string>;
}

/**
 * Création d'un fichier (jamais de remplacement : Drive admet plusieurs fichiers de même nom). Archive v2 :
 * type `application/vnd.voltaplan+zip` ; texte (JSON v1, project.json) : `application/json`.
 */
export async function driveCreate(c: DriveCtx, name: string, data: Blob | string, opts: DriveCreateOptions = {}): Promise<CloudFile> {
  const type = opts.mimeType ?? (typeof data === 'string' ? 'application/json' : MIMETYPE);
  const body = typeof data === 'string' ? new Blob([data], { type }) : data;
  const meta = { name, mimeType: type, ...(opts.parents ? { parents: opts.parents } : {}), ...(opts.appProperties ? { appProperties: opts.appProperties } : {}) };
  const q = `keepRevisionForever=true&supportsAllDrives=true&fields=${FILE_FIELDS}`;
  if (body.size > DRIVE_MULTIPART_MAX) return driveFile(await driveResumable(c, `${DRIVE_UPLOAD}/files?uploadType=resumable&${q}`, 'POST', meta, body, type));
  const boundary = 'voltaplan' + Math.random().toString(36).slice(2);
  const multipart = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`,
    `--${boundary}\r\nContent-Type: ${type}\r\n\r\n`,
    body,
    `\r\n--${boundary}--`,
  ]);
  const r = await call(c, `${DRIVE_UPLOAD}/files?uploadType=multipart&${q}`, {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
    body: multipart,
  });
  return driveFile((await r.json()) as DriveItem);
}

/** Dossier créé par Voltaplan (portée drive.file : il reste visible pour Voltaplan). */
export async function driveCreateFolder(c: DriveCtx, name: string, parents?: string[], appProperties?: Record<string, string>): Promise<DriveItem> {
  const r = await call(c, `${DRIVE_API}/files?supportsAllDrives=true&fields=id,name,createdTime`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: DRIVE_FOLDER_MIME, ...(parents ? { parents } : {}), ...(appProperties ? { appProperties } : {}) }),
  });
  return (await r.json()) as DriveItem;
}

/** Renommage (métadonnées seules ; jamais de suppression). */
export async function driveRename(c: DriveCtx, id: string, name: string): Promise<void> {
  await call(c, `${DRIVE_API}/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
}

/**
 * Révisions écrites entre `from` (révision de l'ouverture) et `to` (notre envoi), exclues : vide si personne d'autre
 * n'a enregistré pendant notre envoi. Si `from` n'est plus dans l'historique (purgé par Drive), on ne conclut rien.
 */
async function driveRevisionsBetween(c: DriveCtx, id: string, from: string, to: string | undefined): Promise<string[]> {
  const r = await call(c, `${DRIVE_API}/files/${encodeURIComponent(id)}/revisions?fields=revisions(id)&pageSize=1000`);
  const ids = ((await r.json()) as { revisions?: { id: string }[] }).revisions?.map((x) => x.id) ?? [];
  return revisionsBetween(ids, from, to);
}

/** Marque une révision « à conserver indéfiniment ». Plafond atteint : on libère d'anciennes révisions et on réessaie. */
async function drivePin(c: DriveCtx, id: string, rev: string, protect: Set<string>): Promise<void> {
  const pin = () =>
    driveFetch(c, `${DRIVE_API}/files/${encodeURIComponent(id)}/revisions/${encodeURIComponent(rev)}?fields=id,keepForever`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keepForever: true }),
    });
  const r = await pin();
  if (r.ok) return;
  if (r.status === 401) throw new AuthError('Google Drive');
  // Refus (plafond du service probablement atteint) : libération plus large, puis nouvel essai
  await driveReleaseOldPins(c, id, { fileSize: 0, protect, maxCount: DRIVE_PINS_MAX_COUNT / 2 });
  await driveCheck(await pin());
}

async function driveReleaseOldPins(c: DriveCtx, id: string, opts: { fileSize: number; protect: Set<string>; maxCount?: number }): Promise<void> {
  const r = await call(c, `${DRIVE_API}/files/${encodeURIComponent(id)}/revisions?fields=revisions(id,keepForever,size,modifiedTime)&pageSize=1000`);
  const revs = ((await r.json()) as { revisions?: DriveRevision[] }).revisions ?? [];
  for (const rid of pinsToReleaseBySize(revs, opts))
    await call(c, `${DRIVE_API}/files/${encodeURIComponent(id)}/revisions/${encodeURIComponent(rid)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keepForever: false }),
    });
}

/** Révisions Drive encore désignées par un enregistrement en attente (conflit, hors ligne) : fichier ou dossier. */
export function pendingDriveRevisions(fileId: string): string[] {
  try {
    return listPending()
      .map((p) =>
        p.loc.kind === 'cloud' && p.loc.provider === 'gdrive' && p.loc.file.id === fileId
          ? p.loc.file.rev?.split('|')[1]
          : // Dossier : l'identifiant du modèle n'est pas mémorisé ; protéger une révision d'un autre fichier est sans effet
            p.loc.kind === 'folder' && p.loc.provider === 'gdrive'
            ? p.loc.rev?.split('|')[1]
            : undefined,
      )
      .filter((x): x is string => !!x);
  } catch {
    return [];
  }
}

/**
 * Remplacement prudent d'un fichier modifiable (voir l'en-tête). `mode` : 'update' (version mémorisée, conflit si
 * elle a changé) ou 'overwrite' (remplacement confirmé : la révision remplacée est tout de même conservée).
 * `copy` : où et sous quel type recopier une version concurrente détectée après coup (même dossier).
 */
export async function driveUpdate(
  c: DriveCtx,
  existing: CloudFile,
  name: string,
  data: Blob | string,
  mode: Exclude<SaveMode, 'create'>,
  copy: { parents?: string[]; mimeType?: string } = {},
): Promise<CloudFile> {
  const now = await driveVersion(c, existing.id);
  if (mode === 'update') {
    if (!existing.rev) throw new ConflictError('Google Drive : ' + name, 'version inconnue');
    if (!sameDriveContent(now, existing.rev)) throw new ConflictError('Google Drive : ' + name, `version ${existing.rev} → ${now}`);
  }
  const current = now?.split('|')[1];
  // Révisions jamais libérées : celle que nous remplaçons, celle de l'ouverture, celles qu'un enregistrement en
  // attente (conflit ou hors ligne) désigne encore.
  const protect = new Set([current, existing.rev?.split('|')[1], ...pendingDriveRevisions(existing.id)].filter((x): x is string => !!x));
  if (current) await drivePin(c, existing.id, current, protect);
  const type = typeof data === 'string' ? 'application/json' : MIMETYPE;
  const body = typeof data === 'string' ? new Blob([data], { type }) : data;
  const q = `keepRevisionForever=true&supportsAllDrives=true&fields=${FILE_FIELDS}`;
  let item: DriveItem;
  if (body.size > DRIVE_MULTIPART_MAX) item = await driveResumable(c, `${DRIVE_UPLOAD}/files/${encodeURIComponent(existing.id)}?uploadType=resumable&${q}`, 'PATCH', {}, body, type);
  else {
    const r = await call(c, `${DRIVE_UPLOAD}/files/${encodeURIComponent(existing.id)}?uploadType=media&${q}`, {
      method: 'PATCH',
      headers: { 'Content-Type': type },
      body,
    });
    item = (await r.json()) as DriveItem;
  }
  const saved = driveFile(item);
  const head = mode === 'update' ? existing.rev?.split('|')[1] : undefined;
  if (head) {
    const between = await driveRevisionsBetween(c, existing.id, head, saved.rev?.split('|')[1]);
    if (between.length) {
      // Recopie de la dernière version écrite par l'autre appareil (les révisions intermédiaires restent dans Drive)
      const theirs = await (await call(c, `${DRIVE_API}/files/${encodeURIComponent(existing.id)}/revisions/${encodeURIComponent(between[between.length - 1])}?alt=media`)).blob();
      const copyName = conflictName(name);
      await driveCreate(c, copyName, theirs, { parents: copy.parents, mimeType: copy.mimeType ?? (typeof data === 'string' ? 'application/json' : MIMETYPE) });
      saved.concurrentCopy = copyName;
    }
  }
  // Drive limite le nombre de révisions conservées indéfiniment par fichier : on libère les plus anciennes au-delà
  // d'un seuil (jamais les plus récentes). Échec sans conséquence pour l'enregistrement.
  const head2 = saved.rev?.split('|')[1];
  if (head2) protect.add(head2);
  await driveReleaseOldPins(c, existing.id, { fileSize: saved.size ?? body.size, protect }).catch(() => undefined);
  return saved;
}

// ---------------------------------------------------------------------------
// Révisions conservées : règles pures (testées)
// ---------------------------------------------------------------------------

/**
 * Révisions « conservées indéfiniment » (keepForever) d'un fichier Drive. Elles comptent dans l'espace de
 * stockage de l'utilisateur [à vérifier] : avec le format v1 (photos intégrées, jusqu'à 50 Mo par fichier), 150
 * révisions pourraient occuper plusieurs Go. On en garde tant que les DEUX limites sont respectées :
 *  - nombre ≤ DRIVE_PINS_MAX_COUNT (le service en accepte 200 par fichier [à vérifier]) ;
 *  - taille totale ≤ budget = max(DRIVE_PINS_SIZE_FACTOR × taille actuelle du fichier, DRIVE_PINS_MIN_BUDGET).
 * Jamais libérées : les DRIVE_PINS_RECENT dernières révisions, et celles qu'un conflit ou un enregistrement en
 * attente désigne encore. Avec les dossiers de projet (F8), seul le modèle (petit) est modifiable : le budget
 * concerne surtout les fichiers v1 et les archives.
 */
export const DRIVE_PINS_MAX_COUNT = 100;
export const DRIVE_PINS_SIZE_FACTOR = 10;
export const DRIVE_PINS_MIN_BUDGET = 200 * 1024 * 1024;
export const DRIVE_PINS_RECENT = 20;
/** Anciens seuils (nombre seul), gardés pour pinsToRelease. */
export const DRIVE_PINS_MAX = 150;
export const DRIVE_PINS_KEEP = 100;

export interface DriveRevision {
  id: string;
  keepForever?: boolean;
  /** Octets (l'API renvoie une chaîne). */
  size?: number | string;
  modifiedTime?: string;
}

export const drivePinsBudget = (fileSize: number) => Math.max(DRIVE_PINS_SIZE_FACTOR * Math.max(0, fileSize), DRIVE_PINS_MIN_BUDGET);

/**
 * Fonction pure (testée) : révisions conservées à libérer, des plus anciennes aux plus récentes, jusqu'à respecter
 * le nombre ET le budget de taille. Ordre chronologique d'après modifiedTime (à défaut, l'ordre de la liste).
 */
export function pinsToReleaseBySize(
  revs: DriveRevision[],
  opts: { fileSize: number; protect?: Set<string>; maxCount?: number; budget?: number; recent?: number },
): string[] {
  const maxCount = opts.maxCount ?? DRIVE_PINS_MAX_COUNT;
  const budget = opts.budget ?? drivePinsBudget(opts.fileSize);
  const recent = opts.recent ?? DRIVE_PINS_RECENT;
  const ordered = revs.every((r) => r.modifiedTime) ? [...revs].sort((a, b) => a.modifiedTime!.localeCompare(b.modifiedTime!)) : revs;
  const untouchable = new Set([...ordered.slice(Math.max(0, ordered.length - recent)).map((r) => r.id), ...(opts.protect ?? [])]);
  const pinned = ordered.filter((r) => r.keepForever);
  let count = pinned.length;
  let bytes = pinned.reduce((t, r) => t + (Number(r.size) || 0), 0);
  const out: string[] = [];
  for (const r of pinned) {
    if (count <= maxCount && bytes <= budget) break;
    if (untouchable.has(r.id)) continue;
    out.push(r.id);
    count--;
    bytes -= Number(r.size) || 0;
  }
  return out;
}

/**
 * Fonction pure (testée) : révisions « conservées indéfiniment » à libérer selon le seul nombre (ancienne règle,
 * remplacée par pinsToReleaseBySize), seulement quand il y en a plus de `max`, pour revenir à `keep`. Les 20
 * dernières révisions ne sont jamais libérées.
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
