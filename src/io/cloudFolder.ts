/**
 * Projets en dossier (F8) côté application : enregistrement et ouverture d'un dossier OneDrive, Dropbox ou Google
 * Drive, import d'une archive dans un dossier, transfert entre services. Logique commune : src/format/folder.ts ;
 * services : src/io/oneDriveFolder.ts, dropboxFolder.ts, driveFolder.ts (GitHub : même interface, à brancher).
 */
import type { Project } from '../model/types';
import { FOLDER_MODEL, openFromFolder, saveToFolder, transferToFolder, type FolderSaveResult } from '../format/folder';
import type { FolderBackend } from '../format/storageBackend';
import { readArchive } from '../format/archive';
import { mergeSources } from '../format/projectFile';
import type { MigrationWarning } from '../model/migrate';
import { PROVIDERS, withToken, type CloudId, type SaveMode } from './cloud';
import { ConflictError } from './conflict';
import { listOneDriveFolders, OneDriveFolderBackend, safeFolderName } from './oneDriveFolder';
import { DropboxFolderBackend, listDropboxFolders } from './dropboxFolder';
import { createDriveProjectFolder, DriveFolderBackend, listDriveFolders } from './driveFolder';
import { archiveSources, assetSession, projectWriteInput } from './projectData';
import { parseProjectChecked, type FolderLocation } from './storage';

/** Dossier de projet d'un service, pour un jeton donné (même interface pour les trois services). */
export function folderBackend(loc: Pick<FolderLocation, 'provider' | 'folder' | 'folderId'>, token: string, fetchFn?: typeof fetch): FolderBackend {
  switch (loc.provider) {
    case 'onedrive':
      return new OneDriveFolderBackend(token, loc.folder, fetchFn);
    case 'dropbox':
      return new DropboxFolderBackend(token, loc.folder, fetchFn);
    case 'gdrive':
      // Drive : désigné par son identifiant (deux dossiers peuvent porter le même nom)
      if (!loc.folderId) throw new Error('Google Drive : dossier de projet sans identifiant');
      return new DriveFolderBackend(token, loc.folderId, loc.folder, fetchFn);
  }
}

/** Appel au dossier du service avec un jeton valide (reconnexion si nécessaire, voir cloud.ts withToken). */
function defaultRun(loc: Pick<FolderLocation, 'provider' | 'folder' | 'folderId'>) {
  return <T>(fn: (b: FolderBackend) => Promise<T>) => withToken(loc.provider, (token) => fn(folderBackend(loc, token)));
}

/** Dossier de projet existant, tel que listé pour l'utilisateur. */
export interface ProjectFolder {
  name: string;
  /** Google Drive seulement. */
  id?: string;
  modified?: string;
}

/** Dossiers de projet du service (dossier de l'application ; Drive : dossiers créés par Voltaplan). */
export async function listProjectFolders(provider: CloudId): Promise<ProjectFolder[]> {
  return withToken(provider, async (token): Promise<ProjectFolder[]> => {
    if (provider === 'onedrive') return listOneDriveFolders(token);
    if (provider === 'dropbox') return listDropboxFolders(token);
    return listDriveFolders(token);
  });
}

/**
 * Emplacement d'un NOUVEAU dossier de projet nommé `name` : OneDrive et Dropbox le créent à la première écriture ;
 * Google Drive le crée tout de suite (dans `parentId` s'il est donné) pour obtenir son identifiant. Renvoie aussi
 * le dossier existant de même nom, s'il y en a un (remplacement à confirmer par l'utilisateur).
 */
export async function prepareProjectFolder(provider: CloudId, name: string, opts: { parentId?: string; existing?: ProjectFolder[] } = {}): Promise<{ loc: FolderLocation; exists: boolean }> {
  const folder = safeFolderName(name);
  const list = opts.existing ?? (await listProjectFolders(provider));
  const same = list.find((f) => f.name === folder);
  if (same) return { loc: { kind: 'folder', provider, folder, folderId: same.id, modelPath: FOLDER_MODEL }, exists: true };
  if (provider !== 'gdrive') return { loc: { kind: 'folder', provider, folder, modelPath: FOLDER_MODEL }, exists: false };
  const created = await withToken('gdrive', (t) => createDriveProjectFolder(t, folder, opts.parentId));
  return { loc: { kind: 'folder', provider, folder: created.name, folderId: created.id, modelPath: FOLDER_MODEL }, exists: false };
}

const label = (loc: Pick<FolderLocation, 'provider' | 'folder'>) => PROVIDERS[loc.provider].label + ' : ' + loc.folder;

/**
 * Enregistre le projet dans son dossier : documents manquants d'abord, modèle ensuite (conditionnel). `mode` :
 * 'update' (version mémorisée, ConflictError si le modèle a changé ailleurs), 'create' (refusé si le modèle
 * existe), 'overwrite' (remplacement confirmé). Renvoie la nouvelle version du modèle.
 */
export async function folderSave(loc: FolderLocation, project: Project, mode: SaveMode, run = defaultRun(loc)): Promise<{ rev?: string } & FolderSaveResult> {
  if (mode === 'update' && !loc.rev) throw new ConflictError(label(loc), 'version inconnue');
  // Documents vérifiés AVANT toute connexion : un document manquant arrête tout ici (MissingAssetsError)
  const input = await projectWriteInput(project);
  const docs = input.originals.map((o) => ({ sha256: o.sha256, mime: o.mime, size: o.size, blob: o.blob }));
  // Dans un dossier, le modèle porte aussi le dossier de preuves : un seul fichier modifiable (voir folder.ts)
  const text = JSON.stringify(project);
  const expected = mode === 'update' ? loc.rev! : mode === 'create' ? null : 'any';
  const r = await run((b) => saveToFolder(b, text, docs, project.meta.title, { modelPath: loc.modelPath, expected }));
  return { ...r, rev: r.version };
}

/** Ouvre un projet en dossier : modèle tout de suite, documents à la demande (puis copiés sur l'appareil). */
export async function folderOpen(loc: Omit<FolderLocation, 'rev'>, run = defaultRun(loc)): Promise<{ project: Project; warnings: MigrationWarning[]; rev?: string }> {
  const opened = await run((b) => openFromFolder(b, loc.modelPath));
  // Les documents sont lus par l'intermédiaire du service, avec un jeton valide au moment de la lecture
  const sources = new Map([...opened.sources].map(([sha, src]) => [sha, { ...src, open: (s?: AbortSignal) => run(() => src.open(s)) }]));
  assetSession.attach(sources);
  const { project, warnings, removed } = parseProjectChecked(opened.projectText, loc.folder);
  const w: MigrationWarning[] = [...warnings];
  if (removed) w.push({ key: 'file.imagesRemoved', params: { n: removed } });
  if (opened.missing.length) w.push({ key: 'format.missingDocs', params: { n: opened.missing.length } });
  void assetSession.copyInBackground();
  return { project, warnings: w, rev: opened.version };
}

/**
 * Import d'une archive `.voltaplan` dans un dossier (nouveau projet en dossier) : documents envoyés une fois,
 * vérifiés, modèle créé en dernier (jamais par-dessus un projet existant).
 */
export async function importArchiveToFolder(archive: Blob, to: FolderBackend, title: string): Promise<FolderSaveResult> {
  const a = await readArchive(archive);
  const { originals } = archiveSources(a);
  const { text } = mergeSources(a.projectText, a.sourcesText);
  // Le modèle passe par la chaîne de lecture habituelle (validation, migration) avant d'être publié
  const { project } = parseProjectChecked(text, title);
  return transferToFolder(JSON.stringify(project), originals, to, title);
}

/** Transfert d'un projet en dossier d'un service à l'autre (aucune suppression à la source). */
export async function transferFolder(from: FolderBackend, to: FolderBackend, title: string, modelPath = 'project.json'): Promise<FolderSaveResult> {
  const opened = await openFromFolder(from, modelPath);
  return transferToFolder(opened.projectText, opened.sources, to, title);
}

/**
 * Import d'un fichier `.voltaplan` (archive v2) dans un NOUVEAU dossier de projet du service : dossier préparé
 * (Drive : créé), documents envoyés et vérifiés, modèle créé en dernier. Un dossier de même nom qui existe déjà
 * n'est jamais complété ni remplacé : ConflictError (choisir un autre nom).
 */
export async function importArchiveToCloudFolder(archive: Blob, provider: CloudId, name: string, opts: { parentId?: string } = {}): Promise<FolderLocation> {
  const { loc, exists } = await prepareProjectFolder(provider, name, opts);
  if (exists) throw new ConflictError(label(loc), 'existe');
  const r = await defaultRun(loc)((b) => importArchiveToFolder(archive, b, name));
  return { ...loc, rev: r.version };
}
