/**
 * Projets en dossier (F8) côté application : enregistrement et ouverture d'un dossier OneDrive, import d'une
 * archive dans un dossier, transfert entre services. Logique commune : src/format/folder.ts ; service :
 * src/io/oneDriveFolder.ts (Dropbox, Google Drive et GitHub : même interface `FolderBackend`, à brancher).
 */
import type { Project } from '../model/types';
import { openFromFolder, saveToFolder, transferToFolder, type FolderSaveResult } from '../format/folder';
import type { FolderBackend } from '../format/storageBackend';
import { readArchive } from '../format/archive';
import { mergeSources } from '../format/projectFile';
import type { MigrationWarning } from '../model/migrate';
import { withToken, type SaveMode } from './cloud';
import { ConflictError } from './conflict';
import { OneDriveFolderBackend } from './oneDriveFolder';
import { archiveSources, assetSession, projectWriteInput } from './projectData';
import { parseProjectChecked, type FolderLocation } from './storage';

/** Appel au dossier du service avec un jeton valide (reconnexion si nécessaire, voir cloud.ts withToken). */
function defaultRun(loc: Pick<FolderLocation, 'provider' | 'folder'>) {
  return <T>(fn: (b: FolderBackend) => Promise<T>) => withToken(loc.provider, (token) => fn(new OneDriveFolderBackend(token, loc.folder)));
}

/**
 * Enregistre le projet dans son dossier : documents manquants d'abord, modèle ensuite (conditionnel). `mode` :
 * 'update' (version mémorisée, ConflictError si le modèle a changé ailleurs), 'create' (refusé si le modèle
 * existe), 'overwrite' (remplacement confirmé). Renvoie la nouvelle version du modèle.
 */
export async function folderSave(loc: FolderLocation, project: Project, mode: SaveMode, run = defaultRun(loc)): Promise<{ rev?: string } & FolderSaveResult> {
  if (mode === 'update' && !loc.rev) throw new ConflictError('OneDrive : ' + loc.folder, 'version inconnue');
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
