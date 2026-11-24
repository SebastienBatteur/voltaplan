/**
 * Répertoire local comme dossier de projet (F8), avec File System Access (`showDirectoryPicker`, Chrome et Edge
 * sur ordinateur ; Tauri plus tard). Même contenu logique qu'un dossier cloud (src/format/folder.ts) : le dossier
 * exporté se relit sans Voltaplan (fichiers ordinaires) et peut être rouvert ou importé dans un service.
 */
import { ConflictError } from './conflict';
import { saveToFolder } from '../format/folder';
import type { FolderBackend, FolderEntry } from '../format/storageBackend';
import type { Project } from '../model/types';
import { projectWriteInput } from './projectData';
import { safeName } from './storage';

interface FileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(d: Blob | string): Promise<void>; close(): Promise<void>; abort(r?: unknown): Promise<void> }>;
}
interface DirHandle {
  kind: 'directory';
  name: string;
  getDirectoryHandle(name: string, o?: { create?: boolean }): Promise<DirHandle>;
  getFileHandle(name: string, o?: { create?: boolean }): Promise<FileHandle>;
  values(): AsyncIterable<FileHandle | DirHandle>;
}

const isNotFound = (e: unknown) => (e as Error)?.name === 'NotFoundError' || (e as Error)?.name === 'TypeMismatchError';
const versionOf = (f: File) => `${f.lastModified}-${f.size}`;

export class DirectoryBackend implements FolderBackend {
  readonly label: string;
  constructor(private readonly root: DirHandle) {
    this.label = root.name;
  }

  private async parent(path: string, create: boolean): Promise<{ dir: DirHandle; name: string }> {
    const parts = path.split('/').filter(Boolean);
    let dir = this.root;
    for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p, { create });
    return { dir, name: parts[parts.length - 1] };
  }

  private async file(path: string): Promise<File | null> {
    try {
      const { dir, name } = await this.parent(path, false);
      return await (await dir.getFileHandle(name)).getFile();
    } catch (e) {
      if (isNotFound(e)) return null;
      throw e;
    }
  }

  async readText(path: string) {
    const f = await this.file(path);
    return f ? { text: await f.text(), version: versionOf(f) } : null;
  }

  async readBlob(path: string) {
    const f = await this.file(path);
    if (!f) throw Object.assign(new Error('absent : ' + path), { name: 'NotFoundError' });
    return f;
  }

  async list(dir: string): Promise<FolderEntry[]> {
    let d: DirHandle;
    try {
      d = await this.root.getDirectoryHandle(dir);
    } catch (e) {
      if (isNotFound(e)) return [];
      throw e;
    }
    const out: FolderEntry[] = [];
    for await (const h of d.values()) if (h.kind === 'file') out.push({ name: h.name, size: (await h.getFile()).size });
    return out;
  }

  private async write(path: string, data: Blob | string): Promise<File> {
    const { dir, name } = await this.parent(path, true);
    const h = await dir.getFileHandle(name, { create: true });
    // Fichier temporaire du navigateur, remplacé à la fermeture : une écriture interrompue ne laisse rien à moitié
    const w = await h.createWritable();
    try {
      await w.write(data);
      await w.close();
    } catch (e) {
      await w.abort(e).catch(() => undefined);
      throw e;
    }
    return h.getFile();
  }

  async putIfAbsent(path: string, data: Blob) {
    const cur = await this.file(path);
    if (cur) return { status: 'exists' as const, size: cur.size };
    return { status: 'created' as const, size: (await this.write(path, data)).size };
  }

  async writeConditional(path: string, data: string, expected: string | null | 'any') {
    const cur = await this.file(path);
    // Pas d'écriture conditionnelle atomique sur un disque local : comparaison juste avant d'écrire (comme files.ts)
    if (expected === null && cur) throw new ConflictError(path, 'existe');
    if (expected !== null && expected !== 'any' && (!cur || versionOf(cur) !== expected)) throw new ConflictError(path, 'modifié');
    return { version: versionOf(await this.write(path, data)) };
  }
}

/**
 * « Exporter en dossier » : choisit un dossier, y crée (ou complète) « <nom du projet>/ ». Un projet déjà présent
 * n'est remplacé qu'après confirmation (`confirmReplace`). Renvoie le nombre de fichiers écrits.
 */
export async function exportToDirectory(project: Project, name: string, confirmReplace: (folder: string) => boolean = (f) => window.confirm(f)): Promise<{ files: number; folder: string } | null> {
  const picker = (window as Window & { showDirectoryPicker?: (o?: unknown) => Promise<DirHandle> }).showDirectoryPicker;
  if (!picker) return null;
  // Documents vérifiés avant de toucher au disque (MissingAssetsError sinon)
  const input = await projectWriteInput(project);
  let parent: DirHandle;
  try {
    parent = await picker({ mode: 'readwrite' });
  } catch (e) {
    if ((e as Error).name === 'AbortError') return null;
    throw e;
  }
  const folder = safeName(name || project.meta.title);
  const b = new DirectoryBackend(await parent.getDirectoryHandle(folder, { create: true }));
  const docs = input.originals.map((o) => ({ sha256: o.sha256, mime: o.mime, size: o.size, blob: o.blob }));
  const text = JSON.stringify(project);
  let r;
  try {
    r = await saveToFolder(b, text, docs, project.meta.title, { expected: null });
  } catch (e) {
    if (!(e instanceof ConflictError) || !confirmReplace(folder)) throw e;
    r = await saveToFolder(b, text, docs, project.meta.title, { expected: 'any' });
  }
  return { files: r.uploaded + 1, folder };
}
