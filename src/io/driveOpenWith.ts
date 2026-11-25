/**
 * « Ouvrir avec Voltaplan » et « Nouveau → Voltaplan » depuis Google Drive (intégration à l'interface de Drive).
 *
 * Drive ouvre l'adresse configurée dans la console Google Cloud (`https://voltaplan.org/app/`) avec un paramètre
 * `state` : JSON encodé dans l'adresse (documentation « Integrate with the Drive UI », consultée le 2026-11-24) :
 *   ouvrir : {"ids":["…"],"action":"open","userId":"…","resourceKeys":{"<id>":"<clé>"}}
 *   créer  : {"action":"create","folderId":"…","folderResourceKey":"…","userId":"…"}
 *
 * Sécurité : `state` vient de l'adresse, donc de n'importe qui (un lien piégé). Il n'est utilisé QUE pour des
 * identifiants de fichier et de dossier, validés (zod, caractères [A-Za-z0-9_-], longueur bornée), toujours
 * encodés (encodeURIComponent) dans les adresses de l'API Drive ; jamais inséré dans la page comme HTML, jamais
 * suivi comme adresse. Rien n'est ouvert sans un clic de l'utilisateur (le clic autorise aussi la fenêtre de
 * connexion). Le paramètre est retiré de l'adresse dès sa lecture (un rechargement ne relance rien).
 */
import { z } from 'zod';
import { DRIVE_FOLDER_MIME, driveGet, driveMedia, driveVersion, type DriveCtx, type Fetch } from './drive';
import { DRIVE_APP_PROP } from './driveFolder';
import type { CloudFile } from './cloud';
import type { FolderLocation, Location } from './storage';
import type { Project } from '../model/types';
import type { MigrationWarning } from '../model/migrate';
import type { ProjectOpen } from './projectData';

/** Identifiant Drive (fichier, dossier) : lettres, chiffres, « - » et « _ » seulement. */
const ID = z.string().regex(/^[A-Za-z0-9_-]{10,200}$/);
/** Clé de ressource (fichiers partagés par lien) : même jeu de caractères. */
const KEY = z.string().regex(/^[A-Za-z0-9_-]{1,200}$/);
/** Identifiant de profil Google (sert seulement d'indication de compte à la connexion). */
const USER = z.string().regex(/^[A-Za-z0-9_.@+-]{1,200}$/);

const OpenState = z.object({
  action: z.literal('open'),
  ids: z.array(ID).min(1).max(100),
  userId: z.preprocess((v) => (v === '' || v === null ? undefined : v), USER.optional()),
  resourceKeys: z.record(z.string(), z.unknown()).optional(),
});
/** Champ facultatif que Drive peut envoyer VIDE (ex. `"folderResourceKey":""` pour un dossier de « Mon Drive ») : absent. */
const emptyAsAbsent = <T extends z.ZodTypeAny>(s: T) => z.preprocess((v) => (v === '' || v === null ? undefined : v), s.optional());
const CreateState = z.object({
  action: z.literal('create'),
  folderId: emptyAsAbsent(ID),
  folderResourceKey: emptyAsAbsent(KEY),
  userId: emptyAsAbsent(USER),
});

export type DriveIntent =
  /** `resourceKeys` : table (identifiant → clé), jamais un objet indexé par une valeur reçue. */
  | { action: 'open'; ids: string[]; userId?: string; resourceKeys: Map<string, string> }
  | { action: 'create'; folderId?: string; folderResourceKey?: string; userId?: string };

/** Longueur maximale du paramètre (100 identifiants avec leurs clés tiennent largement). */
const MAX_STATE = 16384;

/**
 * Lit le paramètre `state` d'une adresse (partie `?…`). Renvoie null pour tout ce qui n'est pas exactement une
 * demande valide (JSON invalide, action inconnue, identifiant douteux, fichiers Google Workspace `exportIds`…).
 */
export function parseDriveState(search: string): DriveIntent | null {
  let raw: string | null;
  try {
    raw = new URLSearchParams(search).get('state');
  } catch {
    return null;
  }
  if (!raw || raw.length > MAX_STATE) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  const o = OpenState.safeParse(v);
  if (o.success) {
    const ids = [...new Set(o.data.ids)];
    // Clés de ressource gardées seulement pour les fichiers demandés, et seulement si elles sont valides
    const resourceKeys = new Map<string, string>();
    for (const [id, key] of Object.entries(o.data.resourceKeys ?? {})) if (ids.includes(id) && typeof key === 'string' && KEY.safeParse(key).success) resourceKeys.set(id, key);
    return { action: 'open', ids, userId: o.data.userId, resourceKeys };
  }
  const c = CreateState.safeParse(v);
  if (c.success) return { action: 'create', folderId: c.data.folderId, folderResourceKey: c.data.folderId ? c.data.folderResourceKey : undefined, userId: c.data.userId };
  return null;
}

/**
 * Lit la demande de Drive dans l'adresse de la page et retire `state` de l'adresse (history.replaceState) : un
 * rechargement ou un favori ne relance rien. Les autres paramètres (ex. `lang`) sont gardés.
 */
export function takeDriveIntent(loc: Pick<globalThis.Location, 'search' | 'href'> = location, hist: Pick<History, 'replaceState' | 'state'> = history): DriveIntent | null {
  if (!/[?&]state=/.test(loc.search)) return null;
  const intent = parseDriveState(loc.search);
  try {
    const u = new URL(loc.href);
    u.searchParams.delete('state');
    hist.replaceState(hist.state, '', u.pathname + (u.search === '?' ? '' : u.search) + u.hash);
  } catch {
    /* adresse non modifiable : sans conséquence, la demande n'est traitée qu'après un clic */
  }
  return intent;
}

/** En-tête X-Goog-Drive-Resource-Keys (« id/clé,… ») à partir de valeurs déjà validées. */
export function resourceKeysHeader(keys: [id: string, key: string | undefined][]): string | undefined {
  const parts = keys
    .filter((e): e is [string, string] => !!e[1])
    .map(([id, key]) => `${id}/${key}`);
  return parts.length ? parts.join(',') : undefined;
}

export type DriveOpened =
  /** Fichier de projet (archive v2 ou JSON v1, reconnu ensuite par sa signature). */
  | { kind: 'file'; data: Blob; file: CloudFile; canEdit: boolean }
  /** `project.json` d'un dossier de projet créé par Voltaplan : ouvert comme dossier. */
  | { kind: 'folder'; loc: FolderLocation };

/** Fichier non pris en charge (dossier, document Google, fichier inaccessible…). */
export class DriveOpenError extends Error {
  constructor(readonly code: 'folder' | 'workspace' | 'notFound') {
    super('Google Drive : ' + code);
    this.name = 'DriveOpenError';
  }
}

/**
 * Lit le fichier demandé par « Ouvrir avec » : métadonnées (nom, type, version), puis contenu. La version est lue
 * AVANT le contenu : si le fichier change entre les deux, le prochain enregistrement est refusé (conflit), jamais
 * l'inverse. Le fichier ouvert garde son identifiant et sa version : « Enregistrer » y réécrit de façon prudente.
 */
export async function fetchDriveFile(token: string, id: string, resourceKey?: string, fetchFn?: Fetch): Promise<DriveOpened> {
  const c: DriveCtx = { token, fetch: fetchFn, resourceKeys: resourceKeysHeader([[id, resourceKey]]) };
  let meta;
  try {
    meta = await driveGet(c, id, 'id,name,mimeType,size,version,headRevisionId,parents,capabilities(canEdit)');
  } catch (e) {
    if ((e as { status?: number }).status === 404) throw new DriveOpenError('notFound');
    throw e;
  }
  if (meta.mimeType === DRIVE_FOLDER_MIME) throw new DriveOpenError('folder');
  if (meta.mimeType?.startsWith('application/vnd.google-apps.')) throw new DriveOpenError('workspace');
  const parent = meta.parents?.[0];
  // project.json d'un dossier de projet Voltaplan : ouvert comme dossier (documents à la demande)
  if (meta.name.toLowerCase().endsWith('.json') && parent && ID.safeParse(parent).success) {
    const folder = await driveGet(c, parent, 'id,name,appProperties').catch(() => null);
    if (folder?.appProperties?.[DRIVE_APP_PROP] === 'project') return { kind: 'folder', loc: { kind: 'folder', provider: 'gdrive', folder: folder.name, folderId: folder.id, modelPath: meta.name } };
  }
  const rev = meta.version ? `${meta.version}|${meta.headRevisionId ?? ''}` : await driveVersion(c, id);
  const data = await driveMedia(c, id);
  const file: CloudFile = {
    id: meta.id,
    name: meta.name,
    size: meta.size ? Number(meta.size) : undefined,
    rev,
    parentId: parent && ID.safeParse(parent).success ? parent : undefined,
    resourceKeys: c.resourceKeys,
  };
  return { kind: 'file', data, file, canEdit: meta.capabilities?.canEdit !== false };
}

/** Emplacement d'un nouveau projet créé par « Nouveau → Voltaplan » : fichier à créer dans le dossier choisi. */
export function createLocationFile(intent: Extract<DriveIntent, { action: 'create' }>): CloudFile {
  return { id: '', name: '', parentId: intent.folderId, resourceKeys: intent.folderId ? resourceKeysHeader([[intent.folderId, intent.folderResourceKey]]) : undefined };
}

/** Résultat d'une demande de Drive, prêt à être appliqué par l'application. */
export type DriveIntentResult =
  | { kind: 'create'; loc: Location }
  | { kind: 'opened'; project: Project; name: string; loc: Location; notes: (string | MigrationWarning)[] };

export interface DriveIntentDeps {
  /** Appel avec un jeton Google valide (fenêtre de connexion si nécessaire, compte suggéré `loginHint`). */
  withToken: <T>(fn: (token: string) => Promise<T>, loginHint?: string) => Promise<T>;
  openData: (data: Blob, name: string) => Promise<ProjectOpen>;
  openFolder: (loc: FolderLocation) => Promise<{ project: Project; warnings: MigrationWarning[]; rev?: string }>;
  fetch?: Fetch;
}

/**
 * Traite une demande de Drive, après le clic de l'utilisateur :
 *  - `create` : emplacement d'un nouveau fichier dans le dossier choisi (créé au premier enregistrement) ;
 *  - `open` : premier fichier lu (les autres sont signalés), ouvert par la chaîne habituelle (signature v2 / v1) ;
 *    il garde son identifiant et sa version (enregistrement prudent au même endroit). Lecture seule ou fichier
 *    converti (v1, récupération) : nouveau fichier, jamais par-dessus l'original.
 */
export async function runDriveIntent(intent: DriveIntent, deps: DriveIntentDeps): Promise<DriveIntentResult> {
  if (intent.action === 'create') return { kind: 'create', loc: { kind: 'cloud', provider: 'gdrive', file: createLocationFile(intent) } };
  const id = intent.ids[0];
  const notes: (string | MigrationWarning)[] = intent.ids.length > 1 ? [{ key: 'driveOpen.others', params: { n: intent.ids.length - 1 } }] : [];
  const opened = await deps.withToken((tk) => fetchDriveFile(tk, id, intent.resourceKeys.get(id), deps.fetch), intent.userId);
  if (opened.kind === 'folder') {
    const r = await deps.openFolder(opened.loc);
    return { kind: 'opened', project: r.project, name: opened.loc.folder, loc: { ...opened.loc, rev: r.rev }, notes: [...notes, ...r.warnings] };
  }
  const r = await deps.openData(opened.data, opened.file.name);
  const keep = opened.canEdit && !r.needsNewFile;
  const file: CloudFile = keep
    ? opened.file
    : { id: '', name: '', parentId: opened.canEdit ? opened.file.parentId : undefined, resourceKeys: opened.canEdit ? opened.file.resourceKeys : undefined };
  if (!opened.canEdit) notes.push({ key: 'driveOpen.readOnly' });
  else if (!keep) notes.push({ key: 'driveOpen.converted' });
  return { kind: 'opened', project: r.project, name: opened.file.name, loc: { kind: 'cloud', provider: 'gdrive', file }, notes: [...notes, ...r.warnings] };
}
