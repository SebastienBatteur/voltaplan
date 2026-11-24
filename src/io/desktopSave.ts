/**
 * Application de bureau (Tauri) : boîte « Enregistrer », écriture et état d'un fichier, par les commandes Rust de
 * src-tauri/src/atomic_save.rs (docs/desktop-tauri.md, section 13).
 *
 * - La boîte est ouverte côté Rust (`pick_save_path`) ; les autres commandes n'acceptent que les chemins qui y ont
 *   été choisis pendant la session, et les extensions produites par l'application.
 * - L'écriture est atomique et vérifiée : fichier temporaire dans le même dossier, relecture, renommage ; la
 *   version précédente d'un projet est gardée en `<nom>.bak` (option `backup`).
 * - Les données sont envoyées par morceaux (`save_begin`, `save_chunk`, `save_commit`) : une archive de plusieurs
 *   centaines de Mo n'est jamais entière en mémoire, ni côté page ni côté Rust, et chaque requête IPC reste bornée.
 */

/** État d'un fichier : date de modification (ms) et taille. */
export interface DesktopFileState {
  mtime: number;
  size: number;
}

/** Taille des morceaux envoyés à Rust (corps brut d'une requête IPC). */
export const CHUNK_SIZE = 4 * 1024 * 1024;

async function call<T>(cmd: string, args?: Record<string, unknown> | Uint8Array, headers?: Record<string, string>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  try {
    return await invoke<T>(cmd, args, headers ? { headers } : undefined);
  } catch (e) {
    // Les commandes Rust rejettent avec un texte : en faire une Error pour l'affichage habituel.
    throw e instanceof Error ? e : new Error(typeof e === 'string' ? e : String(e));
  }
}

/** Boîte « Enregistrer » du système (ouverte par Rust) ; `null` si l'utilisateur annule. */
export function desktopPickPath(name: string, ext: string, description: string): Promise<string | null> {
  return call<string | null>('pick_save_path', { defaultName: name, ext: ext.replace(/^\./, ''), description });
}

/** État actuel du fichier, `null` s'il n'existe plus ou n'est pas lisible. */
export async function desktopFileState(path: string): Promise<DesktopFileState | null> {
  try {
    const st = await call<[number, number] | null>('file_state', { path });
    return st ? { mtime: st[0], size: st[1] } : null;
  } catch {
    return null;
  }
}

/** Écriture en cours côté Rust (identifiant de `save_begin`). */
class Upload {
  private constructor(private readonly id: number) {}

  static async begin(path: string, backup: boolean): Promise<Upload> {
    return new Upload(await call<number>('save_begin', { path, backup }));
  }

  /** Envoie un morceau (octets bruts). En cas d'échec, Rust a déjà abandonné l'écriture. */
  chunk(data: Uint8Array): Promise<void> {
    return call<void>('save_chunk', data, { 'upload-id': String(this.id) });
  }

  async commit(): Promise<DesktopFileState> {
    const [mtime, size] = await call<[number, number, boolean]>('save_commit', { id: this.id });
    return { mtime, size };
  }

  abort(): Promise<void> {
    return call<void>('save_abort', { id: this.id }).catch(() => undefined);
  }
}

/**
 * Flux d'écriture vers `path` : les octets sont regroupés en morceaux de CHUNK_SIZE ; `close()` vérifie et remplace
 * le fichier, `abort()` le laisse intact. `done` donne l'état du fichier écrit (rejetée si l'écriture échoue).
 * `cancel()` : abandon même quand le flux est verrouillé par un écrivain (erreur du producteur, p. ex. zip.js).
 */
export function desktopWritable(
  path: string,
  opts: { backup: boolean },
): { stream: WritableStream<Uint8Array>; done: Promise<DesktopFileState>; cancel(reason?: unknown): Promise<void> } {
  let upload: Upload | null = null;
  let started: Promise<void> | null = null;
  let buf = new Uint8Array(CHUNK_SIZE);
  let used = 0;
  let resolveDone!: (s: DesktopFileState) => void;
  let rejectDone!: (e: unknown) => void;
  const done = new Promise<DesktopFileState>((res, rej) => {
    resolveDone = res;
    rejectDone = rej;
  });
  done.catch(() => undefined); // l'erreur est aussi signalée par le flux
  const fail = (e: unknown) => {
    rejectDone(e);
    throw e;
  };
  const flush = async () => {
    if (!used) return;
    const part = buf.subarray(0, used);
    await upload!.chunk(part);
    buf = new Uint8Array(CHUNK_SIZE); // le morceau envoyé n'est pas réutilisé (envoi éventuellement différé)
    used = 0;
  };
  const stream = new WritableStream<Uint8Array>({
    start() {
      started = Upload.begin(path, opts.backup).then((u) => {
        upload = u;
      }, fail);
      return started;
    },
    async write(chunk) {
      try {
        let off = 0;
        while (off < chunk.length) {
          const n = Math.min(CHUNK_SIZE - used, chunk.length - off);
          buf.set(chunk.subarray(off, off + n), used);
          used += n;
          off += n;
          if (used === CHUNK_SIZE) await flush();
        }
      } catch (e) {
        fail(e);
      }
    },
    async close() {
      try {
        await flush();
        resolveDone(await upload!.commit());
      } catch (e) {
        fail(e);
      }
    },
    async abort(reason) {
      await cancel(reason);
    },
  });
  const cancel = async (reason?: unknown) => {
    await started?.catch(() => undefined);
    await upload?.abort();
    upload = null;
    rejectDone(reason ?? new Error('Enregistrement interrompu.'));
  };
  return { stream, done, cancel };
}

/** Écrit un Blob (export) par morceaux, sans le charger entier en mémoire. */
export async function desktopWriteBlob(path: string, blob: Blob, opts: { backup: boolean }): Promise<DesktopFileState> {
  const upload = await Upload.begin(path, opts.backup);
  try {
    for (let off = 0; off < blob.size; off += CHUNK_SIZE) {
      await upload.chunk(new Uint8Array(await blob.slice(off, off + CHUNK_SIZE).arrayBuffer()));
    }
  } catch (e) {
    await upload.abort();
    throw e;
  }
  return upload.commit();
}
