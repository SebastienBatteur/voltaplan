/**
 * Interface interne minimale au-dessus de zip.js (BSD-3-Clause, docs/strategie/F2-COMPARAISON-ZIP.md).
 *
 * Le reste de Voltaplan ne dépend que de cette interface (`openZip`, `writeZip`) : changer de bibliothèque ne
 * modifie pas le format. Réglages :
 *  - version « native » (compression du navigateur, `CompressionStream`), chargée à la demande seulement ;
 *  - `useWebWorkers: false` : pas de worker, CSP inchangée ;
 *  - lecture du répertoire central à la fin du fichier, par tranches de `Blob` : rien n'est chargé en entier ;
 *  - CRC-32 vérifié à chaque lecture (`checkCrc32`, successeur de l'option `checkSignature`) ; le SHA-256 du
 *    manifest est vérifié en plus par archive.ts (le CRC n'est pas une protection cryptographique) ;
 *  - lecture « stricte » : doublons de noms, données ajoutées avant ou après l'archive, répertoires centraux
 *    multiples sont refusés (archives ambiguës, lues différemment selon les outils).
 *
 * La sécurité (liste blanche, plafonds, taux de compression, types) est à notre charge : voir archive.ts.
 */
type ZipLib = typeof import('@zip.js/zip.js/lib/zip-core-native.js');
type ZipEntry = Awaited<ReturnType<InstanceType<ZipLib['ZipReader']>['getEntries']>>[number];

let libPromise: Promise<ZipLib> | null = null;

/** Chargement à la demande (ouverture ou enregistrement d'un projet v2 seulement). */
export function loadZipLib(): Promise<ZipLib> {
  libPromise ??= import('@zip.js/zip.js/lib/zip-core-native.js').then((lib) => {
    lib.configure({ useWebWorkers: false });
    return lib;
  });
  return libPromise;
}

export const METHOD_STORED = 0;
export const METHOD_DEFLATE = 8;

export interface ZipEntryInfo {
  path: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  /** Position de l'en-tête local dans le fichier. */
  offset: number;
  encrypted: boolean;
  symlink: boolean;
  directory: boolean;
  crc32: number;
}

export type ZipErrorCode = 'notZip' | 'truncated' | 'ambiguous' | 'corrupt' | 'crc' | 'tooLarge' | 'unsupported' | 'unreadable';

export class ZipFormatError extends Error {
  constructor(
    readonly code: ZipErrorCode,
    readonly path = '',
    detail = '',
  ) {
    super(`ZIP ${code}${path ? ' : ' + path : ''}${detail ? ' (' + detail + ')' : ''}`);
    this.name = 'ZipFormatError';
  }
}

/** Traduction des erreurs de zip.js (messages constants) en codes stables. */
function mapError(lib: ZipLib, e: unknown, path = ''): Error {
  if (e instanceof ZipFormatError) return e;
  const msg = (e as Error)?.message ?? String(e);
  const name = (e as Error)?.name;
  if (name === 'NotReadableError' || name === 'NotFoundError') return new ZipFormatError('unreadable', path, msg);
  if (msg === lib.ERR_EOCDR_NOT_FOUND || msg === lib.ERR_CENTRAL_DIRECTORY_NOT_FOUND || msg === lib.ERR_EOCDR_LOCATOR_ZIP64_NOT_FOUND || msg === lib.ERR_ENTRY_DATA_OUT_OF_BOUNDS)
    return new ZipFormatError('truncated', path, msg);
  if (msg === lib.ERR_AMBIGUOUS_ARCHIVE || msg === lib.ERR_DUPLICATED_NAME || msg === lib.ERR_OVERLAPPING_ENTRY) return new ZipFormatError('ambiguous', path, msg);
  if (msg === lib.ERR_INVALID_CRC32) return new ZipFormatError('crc', path, msg);
  if (msg === lib.ERR_ENCRYPTED || msg === lib.ERR_UNSUPPORTED_ENCRYPTION || msg === lib.ERR_UNSUPPORTED_COMPRESSION || msg === lib.ERR_ENCRYPTED_CENTRAL_DIRECTORY)
    return new ZipFormatError('unsupported', path, msg);
  return new ZipFormatError('corrupt', path, msg);
}

/** Flux d'écriture qui accumule les octets et s'interrompt au-delà de `max` (bombe de décompression). */
function boundedSink(max: number, path: string): { stream: WritableStream<Uint8Array>; chunks: Uint8Array[]; size: () => number } {
  const chunks: Uint8Array[] = [];
  let n = 0;
  const stream = new WritableStream<Uint8Array>({
    write(chunk) {
      n += chunk.length;
      if (n > max) throw new ZipFormatError('tooLarge', path, `> ${max}`);
      chunks.push(chunk);
    },
  });
  return { stream, chunks, size: () => n };
}

function concat(chunks: Uint8Array[], n: number): Uint8Array {
  if (chunks.length === 1) return chunks[0];
  const out = new Uint8Array(n);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

export interface ZipArchiveReader {
  readonly entries: ZipEntryInfo[];
  /** Diagnostics non bloquants de zip.js (ex. répertoire central non trié). */
  readonly warnings: string[];
  /** Contenu décompressé, CRC vérifié ; ZipFormatError('tooLarge') au-delà de `max` octets réellement produits. */
  readBytes(e: ZipEntryInfo, max: number, signal?: AbortSignal): Promise<Uint8Array>;
  /** Même chose, en `Blob` (contenu reconstitué en mémoire : réservé aux entrées compressées). */
  readBlob(e: ZipEntryInfo, max: number, type: string, signal?: AbortSignal): Promise<Blob>;
  /**
   * Entrée stockée sans compression : tranche du fichier d'origine, sans aucune copie (F3). Le contenu n'est PAS
   * vérifié ici (lecture paresseuse) : l'appelant vérifie la taille, la signature et le SHA-256 à l'usage.
   */
  storedSlice(e: ZipEntryInfo, type: string): Promise<Blob>;
}

/** Ouvre une archive : seul le répertoire central est lu (fin du fichier). */
export async function openZip(blob: Blob): Promise<ZipArchiveReader> {
  const lib = await loadZipLib();
  const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  if (!(head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04)) throw new ZipFormatError('notZip');
  const reader = new lib.ZipReader(new lib.BlobReader(blob), {
    strictness: 'strict',
    // Les noms sont classés par notre liste blanche (archive.ts) : un nom dangereux est isolé et signalé,
    // jamais utilisé comme chemin, au lieu de rendre toute l'archive illisible.
    filenameValidation: 'tolerant',
    useWebWorkers: false,
  });
  let raw: ZipEntry[];
  try {
    raw = await reader.getEntries();
  } catch (e) {
    throw mapError(lib, e);
  }
  const byInfo = new Map<ZipEntryInfo, ZipEntry>();
  const entries = raw.map((e) => {
    const info: ZipEntryInfo = {
      path: e.filename,
      method: e.compressionMethod,
      compressedSize: e.compressedSize,
      uncompressedSize: e.uncompressedSize,
      offset: e.offset,
      encrypted: e.encrypted,
      symlink: !!e.symlink,
      directory: e.directory,
      crc32: e.signature ?? 0,
    };
    byInfo.set(info, e);
    return info;
  });
  const entryOf = (info: ZipEntryInfo): ZipEntry => {
    const e = byInfo.get(info);
    if (!e || e.directory) throw new ZipFormatError('corrupt', info.path, 'entrée inconnue');
    return e;
  };
  const read = async (info: ZipEntryInfo, max: number, signal?: AbortSignal) => {
    const e = entryOf(info);
    if (e.encrypted) throw new ZipFormatError('unsupported', info.path, 'chiffrée');
    const sink = boundedSink(max, info.path);
    try {
      await (e as Extract<ZipEntry, { directory: false }>).getData(sink.stream, { checkCrc32: true, signal, useWebWorkers: false });
    } catch (err) {
      // L'erreur « trop gros » levée par notre flux peut revenir enveloppée par la bibliothèque
      if (sink.size() > max) throw new ZipFormatError('tooLarge', info.path, `> ${max}`);
      throw mapError(lib, err, info.path);
    }
    return sink;
  };
  return {
    entries,
    warnings: (reader.warnings ?? []).map((w) => w.reason + (w.filename ? ' : ' + w.filename : '')),
    async readBytes(info, max, signal) {
      const s = await read(info, max, signal);
      return concat(s.chunks, s.size());
    },
    async readBlob(info, max, type, signal) {
      const s = await read(info, max, signal);
      return new Blob(s.chunks as BlobPart[], { type });
    },
    async storedSlice(info, type) {
      entryOf(info);
      if (info.method !== METHOD_STORED || info.encrypted) throw new ZipFormatError('unsupported', info.path, 'non stockée');
      // En-tête local : signature, puis longueurs du nom (octet 26) et du champ supplémentaire (octet 28)
      const h = new Uint8Array(await blob.slice(info.offset, info.offset + 30).arrayBuffer());
      const dv = new DataView(h.buffer, h.byteOffset, h.byteLength);
      if (h.length < 30 || dv.getUint32(0, true) !== 0x04034b50) throw new ZipFormatError('corrupt', info.path, 'en-tête local');
      const start = info.offset + 30 + dv.getUint16(26, true) + dv.getUint16(28, true);
      const end = start + info.compressedSize;
      if (end > blob.size) throw new ZipFormatError('truncated', info.path);
      return blob.slice(start, end, type);
    },
  };
}

export interface ZipInput {
  path: string;
  /** Contenu ; une fonction est appelée au moment d'écrire cette entrée (lecture paresseuse d'un document). */
  data: Blob | Uint8Array | string | (() => Promise<Blob>);
  /** true : stockée sans recompression (médias déjà compressés, mimetype). */
  store: boolean;
}

/**
 * Écrit une archive en flux, dans l'ordre donné. `sink` : flux de destination (fichier choisi avec File System
 * Access, `createWritable()` : fichier temporaire, remplacement à la fermeture). Sans `sink`, renvoie un `Blob`.
 * Les entrées sont écrites sans descripteur de données quand la taille est connue (en-têtes locaux complets :
 * récupération possible d'une archive tronquée).
 */
export async function writeZip(inputs: Iterable<ZipInput> | AsyncIterable<ZipInput>, sink?: WritableStream<Uint8Array>): Promise<Blob | null> {
  const lib = await loadZipLib();
  const blobWriter = sink ? null : new lib.BlobWriter('application/zip');
  const writer = new lib.ZipWriter(sink ?? blobWriter!, { extendedTimestamp: false, useWebWorkers: false, keepOrder: true });
  try {
    for await (const input of inputs) {
      const data = typeof input.data === 'function' ? await input.data() : input.data;
      const reader = typeof data === 'string' ? new lib.TextReader(data) : data instanceof Uint8Array ? new lib.Uint8ArrayReader(data) : new lib.BlobReader(data);
      await writer.add(input.path, reader, { level: input.store ? 0 : 9, dataDescriptor: false, useWebWorkers: false });
    }
    const out = await writer.close();
    return blobWriter ? (out as Blob) : null;
  } catch (e) {
    // Destination laissée à l'appelant (abort() d'un createWritable() : l'original reste intact).
    // Erreurs propres à Voltaplan (document altéré pendant l'écriture…) transmises telles quelles.
    throw e instanceof Error && e.name !== 'Error' ? e : mapError(lib, e);
  }
}
