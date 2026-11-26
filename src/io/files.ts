/**
 * Ouverture / enregistrement de fichiers locaux.
 * Utilise l'API File System Access quand elle existe (Chrome, Edge : « Enregistrer » réécrit le même fichier),
 * dans l'application de bureau (Tauri), la boîte de dialogue du système ;
 * sinon un simple téléchargement (Firefox, Safari).
 *
 * Format v2 (docs/file-format.md) : un projet est enregistré en archive `.voltaplan` (ZIP), écrite en flux ; un
 * fichier v1 (JSON) ou Trikker est lu puis converti, et son original n'est jamais réécrit sans que
 * l'utilisateur choisisse l'emplacement (boîte « Enregistrer sous »).
 */
import { APP_NAME, FILE_EXT, LEGACY_EXTS } from '../brand';
import { MIMETYPE } from '../format/manifest';
import type { ArchiveReport } from '../format/archive';
import type { Project } from '../model/types';
import type { MigrationWarning } from '../model/migrate';
import { ConflictError, isQuotaError, StorageFullError } from './conflict';
import { DesktopSaveError, desktopFileState, desktopOpenFile, desktopPickPath, desktopWritable, desktopWriteBlob } from './desktopSave';
import { openProjectData, projectToV1, serializeProject } from './projectData';

export { decodeText } from './projectData';

export const EXT = FILE_EXT;

let currentHandle: FileSystemFileHandleLike | null = null;
/** Chemin du fichier courant dans l'application de bureau. */
let currentPath: string | null = null;
/**
 * État du fichier juste après notre dernière écriture (date de modification, taille). Avant de réécrire, on le
 * compare au fichier actuel : s'il a changé (autre onglet, autre logiciel, client de synchronisation OneDrive…),
 * ConflictError au lieu d'écraser.
 */
let lastWritten: { mtime: number; size: number } | null = null;

/** Vrai si l'état actuel du fichier diffère de celui laissé par notre dernière écriture. */
export function changedSince(known: { mtime: number; size: number } | null, now: { mtime: number; size: number } | null): boolean {
  if (!known || !now) return false;
  return known.mtime !== now.mtime || known.size !== now.size;
}

/** Vrai dans l'application de bureau (Tauri). */
export const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// Bureau : boîte « Enregistrer », état et écriture atomique par les commandes Rust (src/io/desktopSave.ts).
const desktopSavePath = desktopPickPath;

interface FileSystemFileHandleLike {
  name: string;
  getFile?(): Promise<{ lastModified: number; size: number }>;
  createWritable(): Promise<WritableStream<Uint8Array> & { abort(reason?: unknown): Promise<void> }>;
}

async function handleState(h: FileSystemFileHandleLike): Promise<{ mtime: number; size: number } | null> {
  try {
    const f = await h.getFile?.();
    return f ? { mtime: f.lastModified, size: f.size } : null;
  } catch {
    return null; // fichier supprimé ou déplacé : il sera recréé à l'écriture
  }
}

const pathState = desktopFileState;

type PickerWindow = Window & {
  showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandleLike>;
};

/** iPhone, iPad (iPadOS se présente comme un Mac tactile) : tous les navigateurs y sont des Safari (WebKit). */
export function isAppleMobile(nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'> | undefined = typeof navigator === 'undefined' ? undefined : navigator): boolean {
  const ua = nav?.userAgent || '';
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav?.maxTouchPoints ?? 0) > 1);
}

/** Extensions qu'iOS relie à un type connu : un filtre fait uniquement de celles-ci (ou de types MIME) reste utilisable. */
const IOS_KNOWN_EXTS = ['.pdf', '.json', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.zip', '.txt'];

/**
 * Filtre du sélecteur de fichiers. Sur iPhone et iPad, Safari ne relie pas une extension inconnue (.voltaplan,
 * .openrgie, .trik) à un type : le fichier était grisé, donc impossible à rouvrir. Dans ce cas, aucun filtre ; le
 * contenu est de toute façon reconnu par sa signature à l'ouverture (projectData.ts), et refusé s'il ne convient pas.
 */
export function pickerAccept(accept: string, appleMobile = isAppleMobile()): string {
  if (!appleMobile) return accept;
  const unknown = accept
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .some((s) => s.startsWith('.') && !IOS_KNOWN_EXTS.includes(s));
  return unknown ? '' : accept;
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = pickerAccept(accept);
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export interface OpenResult {
  project: Project;
  fileName: string;
  /** Avertissements : texte (import Trikker) ou clé de traduction (lecture d'un projet). */
  warnings: (string | MigrationWarning)[];
  /** Archive v2 : rapport de validation. */
  report?: ArchiveReport;
  /**
   * Fichier converti (v1, Trikker) ou ouvert en mode de récupération : « Enregistrer » ne réécrit jamais
   * l'original, il demande un emplacement (le fichier ouvert n'est jamais la cible par défaut).
   */
  needsNewFile: boolean;
}

/**
 * Ouvre un fichier de projet : archive v2, JSON v1 (.voltaplan, .openrgie) ou Trikker, reconnu par sa signature
 * (src/io/projectData.ts). Taille vérifiée avant toute lecture complète.
 */
/**
 * Bureau : boîte « Ouvrir » du système (côté Rust), puis lecture comme readProjectFile. Le chemin du fichier est
 * gardé : « Enregistrer » réécrit ce fichier, avec la détection d'une modification faite ailleurs (écart O9 de
 * l'essai réel du 2026-11-25). Fichier converti (v1, Trikker) : jamais réécrit sans « Enregistrer sous ».
 * `null` si l'utilisateur annule.
 */
export async function openDesktopProject(): Promise<(OpenResult & { name: string }) | null> {
  const picked = await desktopOpenFile('Projet ' + APP_NAME);
  if (!picked) return null;
  const r = await readProjectFile(picked.file);
  if (!r.needsNewFile && picked.path.toLowerCase().endsWith(EXT)) {
    currentPath = picked.path;
    lastWritten = await pathState(picked.path);
  }
  return { ...r, name: picked.file.name };
}

export async function readProjectFile(file: File): Promise<OpenResult> {
  currentHandle = null;
  currentPath = null;
  lastWritten = null;
  const r = await openProjectData(file, file.name);
  const fileName = r.format === 'trik' || r.format === 'vschema' || r.format === 'eds' ? file.name.replace(/\.(trik|vschema|eds)$/i, EXT) : file.name;
  return { project: r.project, fileName, warnings: r.warnings, report: r.report, needsNewFile: r.needsNewFile };
}

/**
 * Nom du fichier enregistré sur l'appareil : caractères interdits remplacés, extension .voltaplan TOUJOURS présente
 * (une extension .voltaplan ou ancienne est remplacée, toute autre est gardée devant). Vaut aussi pour la copie de
 * conflit et pour le téléchargement sans sélecteur de fichiers.
 */
export function deviceFileName(raw: string | undefined): string {
  const clean = (raw?.trim() || 'projet').replace(/[\\/:*?"<>|]/g, '_');
  return clean.replace(/\.[^.]*$/, (e) => (e.toLowerCase() === EXT || LEGACY_EXTS.includes(e.toLowerCase()) ? '' : e)) + EXT;
}

/**
 * Enregistre sur l'appareil. « Enregistrer » réécrit le fichier courant, sauf s'il a été modifié ailleurs depuis
 * notre dernière écriture : ConflictError (l'appelant propose alors une copie). `force` : remplacement confirmé.
 * `suggestedName` : nom proposé dans la boîte « Enregistrer sous » (copie de conflit).
 */
export async function saveProject(project: Project, fileName: string, saveAs = false, opts: { force?: boolean; suggestedName?: string } = {}): Promise<string | null> {
  const name = deviceFileName(opts.suggestedName ?? (fileName || project.meta.title));
  if (isDesktop) {
    if (currentPath && !saveAs && !opts.force && changedSince(lastWritten, await pathState(currentPath))) throw new ConflictError(currentPath.split(/[\\/]/).pop() ?? name);
    const path = !currentPath || saveAs ? await desktopSavePath(name, EXT, 'Projet ' + APP_NAME) : currentPath;
    if (!path) return null;
    // Archive écrite en flux dans un fichier temporaire du même dossier, vérifiée puis renommée (atomic_save.rs) ;
    // version précédente gardée en `<nom>.bak`. En cas d'erreur, le fichier d'origine reste intact.
    const { stream, done, cancel } = desktopWritable(path, { backup: true });
    try {
      await serializeProject(project, stream);
      lastWritten = await done;
    } catch (e) {
      await cancel(e);
      // Disque ou clé plein : même message que dans le navigateur ; les autres échecs gardent leur type (O7)
      throw e instanceof DesktopSaveError && e.kind === 'full' ? new StorageFullError('device', e.detail) : e;
    }
    currentPath = path;
    return path.split(/[\\/]/).pop() ?? name;
  }
  const w = window as PickerWindow;
  try {
    if (w.showSaveFilePicker) {
      if (currentHandle && !saveAs && !opts.force && changedSince(lastWritten, await handleState(currentHandle))) throw new ConflictError(currentHandle.name);
      const handle =
        !currentHandle || saveAs
          ? await w.showSaveFilePicker({
              suggestedName: name,
              types: [{ description: 'Projet ' + APP_NAME, accept: { [MIMETYPE]: [EXT] } }],
            })
          : currentHandle;
      // createWritable écrit dans un fichier temporaire, qui ne remplace l'original qu'à close() : un enregistrement
      // interrompu (ou un document illisible) laisse l'ancien fichier intact. L'archive y est écrite en flux.
      const writable = await handle.createWritable();
      try {
        await serializeProject(project, writable);
      } catch (e) {
        await writable.abort(e).catch(() => undefined);
        // Disque plein (QuotaExceededError de write()) : message propre au fichier, pas au navigateur
        throw isQuotaError(e) ? new StorageFullError('device', (e as Error).message) : e;
      }
      currentHandle = handle;
      lastWritten = await handleState(handle);
      return handle.name;
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return null;
    throw e;
  }
  await download((await serializeProject(project))!, name);
  return name;
}

/**
 * « Exporter au format v1 » : copie JSON lisible par les anciennes versions de Voltaplan, toujours sous un nouveau
 * nom (« … (v1).voltaplan »), jamais à la place du fichier courant. Renvoie le nom et la liste de ce qui n'a pas pu
 * être gardé, à afficher à l'utilisateur.
 */
export async function exportProjectV1(project: Project, fileName: string): Promise<{ name: string | null; losses: Awaited<ReturnType<typeof projectToV1>>['losses'] }> {
  const { json, losses } = await projectToV1(project);
  const base = (fileName || project.meta.title || 'projet').replace(/[\\/:*?"<>|]/g, '_').replace(/\.[^.]*$/, '');
  const name = `${base} (v1)${EXT}`;
  return { name: await download(new Blob([json], { type: 'application/json' }), name), losses };
}

/**
 * Enregistre un fichier produit (export) : boîte « Enregistrer » sur le bureau, téléchargement dans le navigateur.
 * Rend le nom du fichier créé, ou `null` si l'utilisateur a annulé (bureau) : l'appelant peut le confirmer (écart O8).
 */
export async function download(blob: Blob, name: string): Promise<string | null> {
  if (isDesktop) {
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
    const path = await desktopSavePath(name, ext, ext.toUpperCase());
    if (!path) return null;
    await desktopWriteBlob(path, blob, { backup: false });
    return path.split(/[\\/]/).pop() ?? name;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}

export function resetHandle() {
  currentHandle = null;
  currentPath = null;
  lastWritten = null;
}

/** Vrai si « Enregistrer » réécrira un fichier déjà choisi (sinon, la boîte « Enregistrer sous » s'ouvre). */
export const hasDeviceTarget = () => currentHandle !== null || currentPath !== null;
