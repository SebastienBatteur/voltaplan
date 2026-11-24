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

export const EXT = FILE_EXT;

let currentHandle: FileSystemFileHandleLike | null = null;
/** Chemin du fichier courant dans l'application de bureau. */
let currentPath: string | null = null;

/** Vrai dans l'application de bureau (Tauri). */
export const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function desktopSavePath(name: string, ext: string, description: string): Promise<string | null> {
  const { save } = await import('@tauri-apps/plugin-dialog');
  return save({ defaultPath: name, filters: [{ name: description, extensions: [ext.replace(/^\./, '')] }] });
}

interface FileSystemFileHandleLike {
  name: string;
  createWritable(): Promise<{ write(data: Blob | string): Promise<void>; close(): Promise<void> }>;
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
  warnings: string[];
}

/**
 * Texte d'un fichier : UTF-8, sinon Windows-1252. Trikker enregistre en Windows-1252 sans le déclarer :
 * lu en UTF-8, « Église » deviendrait « �glise ».
 */
export function decodeText(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '');
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
  if (trik || text.trimStart().startsWith('<?xml')) {
    if (!trik) checkFileSize(file, 'trik');
    const { project, warnings } = importTrikker(text, file.name);
    if (sanitizeProjectImages(project)) warnings.push('Images non intégrées ignorées.');
    return { project, fileName: file.name.replace(/\.trik$/i, EXT), warnings };
  }
  const { project, removed } = parseProjectChecked(text, file.name);
  return { project, fileName: file.name, warnings: removed ? [`${removed} image(s) à l'adresse non autorisée ignorée(s).`] : [] };
}

export async function saveProject(project: Project, fileName: string, saveAs = false): Promise<string | null> {
  const json = JSON.stringify(project);
  const name = (fileName || project.meta.title || 'projet').replace(/[\\/:*?"<>|]/g, '_').replace(/\.[^.]*$/, (e) => (e.toLowerCase() === EXT || LEGACY_EXTS.includes(e.toLowerCase()) ? '' : e)) + EXT;
  if (isDesktop) {
    if (!currentPath || saveAs) currentPath = await desktopSavePath(name, EXT, 'Projet ' + APP_NAME);
    if (!currentPath) return null;
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    await writeTextFile(currentPath, json);
    return currentPath.split(/[\\/]/).pop() ?? name;
  }
  const w = window as PickerWindow;
  try {
    if (w.showSaveFilePicker) {
      if (!currentHandle || saveAs) {
        currentHandle = await w.showSaveFilePicker({
          suggestedName: name,
          types: [{ description: 'Projet ' + APP_NAME, accept: { 'application/json': [EXT] } }],
        });
      }
      const writable = await currentHandle.createWritable();
      await writable.write(json);
      await writable.close();
      return currentHandle.name;
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
}
