import { APP_NAME, FILE_EXT, LEGACY_EXTS } from '../brand';
import { checkFileSize } from './limits';
import { sanitizeProjectImages } from './sanitize';
import { parseProjectChecked } from './storage';
/**
 * Ouverture / enregistrement de fichiers locaux.
 * Utilise l'API File System Access quand elle existe (Chrome, Edge : « Enregistrer » réécrit le même fichier),
 * dans l'application de bureau (Tauri), la boîte de dialogue du système ;
 * sinon un simple téléchargement (Firefox, Safari).
 */
import type { Project } from '../model/types';
import { importTrikker } from '../import/trikker';
import type { MigrationWarning } from '../model/migrate';
import { ConflictError } from './conflict';

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

async function desktopSavePath(name: string, ext: string, description: string): Promise<string | null> {
  const { save } = await import('@tauri-apps/plugin-dialog');
  return save({ defaultPath: name, filters: [{ name: description, extensions: [ext.replace(/^\./, '')] }] });
}

interface FileSystemFileHandleLike {
  name: string;
  getFile?(): Promise<{ lastModified: number; size: number }>;
  createWritable(): Promise<{ write(data: Blob | string): Promise<void>; close(): Promise<void> }>;
}

async function handleState(h: FileSystemFileHandleLike): Promise<{ mtime: number; size: number } | null> {
  try {
    const f = await h.getFile?.();
    return f ? { mtime: f.lastModified, size: f.size } : null;
  } catch {
    return null; // fichier supprimé ou déplacé : il sera recréé à l'écriture
  }
}

async function pathState(path: string): Promise<{ mtime: number; size: number } | null> {
  try {
    const { stat } = await import('@tauri-apps/plugin-fs');
    const st = await stat(path);
    return { mtime: st.mtime ? new Date(st.mtime).getTime() : 0, size: st.size };
  } catch {
    return null;
  }
}

type PickerWindow = Window & {
  showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandleLike>;
};

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
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
}

/**
 * Texte d'un fichier : UTF-8, sinon Windows-1252. Trikker enregistre en Windows-1252 sans le déclarer :
 * lu en UTF-8, « Église » deviendrait « �glise ».
 */
export function decodeText(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^\uFEFF/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}

export async function readProjectFile(file: File): Promise<OpenResult> {
  const trik = /\.trik$/i.test(file.name);
  // Taille vérifiée avant toute lecture
  checkFileSize(file, trik ? 'trik' : 'project');
  const text = decodeText(await file.arrayBuffer());
  currentHandle = null;
  currentPath = null;
  lastWritten = null;
  if (trik || text.trimStart().startsWith('<?xml')) {
    if (!trik) checkFileSize(file, 'trik');
    const { project, warnings } = importTrikker(text, file.name);
    if (sanitizeProjectImages(project)) warnings.push('Images non intégrées ignorées.');
    return { project, fileName: file.name.replace(/\.trik$/i, EXT), warnings };
  }
  const { project, warnings, removed } = parseProjectChecked(text, file.name);
  return { project, fileName: file.name, warnings: removed ? [...warnings, { key: 'file.imagesRemoved', params: { n: removed } }] : warnings };
}

/**
 * Enregistre sur l'appareil. « Enregistrer » réécrit le fichier courant, sauf s'il a été modifié ailleurs depuis
 * notre dernière écriture : ConflictError (l'appelant propose alors une copie). `force` : remplacement confirmé.
 * `suggestedName` : nom proposé dans la boîte « Enregistrer sous » (copie de conflit).
 */
export async function saveProject(project: Project, fileName: string, saveAs = false, opts: { force?: boolean; suggestedName?: string } = {}): Promise<string | null> {
  const json = JSON.stringify(project);
  const name =
    opts.suggestedName ??
    (fileName || project.meta.title || 'projet').replace(/[\\/:*?"<>|]/g, '_').replace(/\.[^.]*$/, (e) => (e.toLowerCase() === EXT || LEGACY_EXTS.includes(e.toLowerCase()) ? '' : e)) + EXT;
  if (isDesktop) {
    if (currentPath && !saveAs && !opts.force && changedSince(lastWritten, await pathState(currentPath))) throw new ConflictError(currentPath.split(/[\\/]/).pop() ?? name);
    const path = !currentPath || saveAs ? await desktopSavePath(name, EXT, 'Projet ' + APP_NAME) : currentPath;
    if (!path) return null;
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    await writeTextFile(path, json);
    currentPath = path;
    lastWritten = await pathState(path);
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
              types: [{ description: 'Projet ' + APP_NAME, accept: { 'application/json': [EXT] } }],
            })
          : currentHandle;
      // createWritable écrit dans un fichier temporaire, qui ne remplace l'original qu'à close() : un enregistrement
      // interrompu laisse l'ancien fichier intact.
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      currentHandle = handle;
      lastWritten = await handleState(handle);
      return handle.name;
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return null;
    throw e;
  }
  await download(new Blob([json], { type: 'application/json' }), name);
  return name;
}

export async function download(blob: Blob, name: string) {
  if (isDesktop) {
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
    const path = await desktopSavePath(name, ext, ext.toUpperCase());
    if (!path) return;
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function resetHandle() {
  currentHandle = null;
  currentPath = null;
  lastWritten = null;
}

/** Vrai si « Enregistrer » réécrira un fichier déjà choisi (sinon, la boîte « Enregistrer sous » s'ouvre). */
export const hasDeviceTarget = () => currentHandle !== null || currentPath !== null;
