/**
 * Lecture, validation et écriture de l'archive `.voltaplan` v2 (SPEC-FORMAT-V2 § 4 et 5).
 *
 * Lecture sélective : seuls le répertoire central, manifest.json, project.json et sources.json sont lus à
 * l'ouverture. Les documents stockés sans compression deviennent des tranches du fichier (aucune copie) et ne sont
 * vérifiés (taille, signature, SHA-256) qu'au premier accès, ou par `verifyArchive` (« Vérifier l'intégrité »).
 *
 * Archive importée = donnée non fiable :
 *  - liste blanche des chemins (manifest.ts) ; chemins dangereux et inconnus ignorés et signalés ;
 *  - pas de lien symbolique, pas d'entrée chiffrée, méthodes « stockée » et « deflate » seulement ;
 *  - plafonds par type, au total et en nombre d'entrées ; taux de compression borné ; taille réellement produite
 *    bornée pendant la décompression (une taille déclarée mensongère ne suffit pas) ;
 *  - CRC-32 du ZIP, puis taille et SHA-256 du manifest ;
 *  - type réel d'après la signature (« magic bytes »), cohérent avec l'extension ; SVG et HTML refusés.
 * Une entrée invalide est isolée et signalée ; le reste s'ouvre (mode de récupération). Archive tronquée
 * (répertoire central absent) : lecture séquentielle des en-têtes locaux pour récupérer au moins le modèle.
 */
import { assetLimit, DEFAULT_LIMITS, type ArchiveLimits } from './limits';
import {
  ASSET_TYPES,
  buildManifest,
  classifyPath,
  derivedPath,
  assetPath,
  extForMime,
  ManifestError,
  MIMETYPE,
  parseManifest,
  PATH_MANIFEST,
  PATH_MIMETYPE,
  PATH_PROJECT,
  PATH_README,
  PATH_SOURCES,
  readmeText,
  sniffType,
  typeMatches,
  type AssetExt,
  type Manifest,
  type ManifestFile,
} from './manifest';
import { blobBytes, sha256Hex } from './sha256';
import { METHOD_DEFLATE, METHOD_STORED, openZip, writeZip, ZipFormatError, type ZipArchiveReader, type ZipEntryInfo, type ZipInput } from './zip';

export type IssueReason =
  | 'unknown'
  | 'traversal'
  | 'absolute'
  | 'backslash'
  | 'nonAscii'
  | 'control'
  | 'tooLong'
  | 'symlink'
  | 'encrypted'
  | 'method'
  | 'tooLarge'
  | 'ratio'
  | 'missing'
  | 'sizeMismatch'
  | 'shaMismatch'
  | 'typeMismatch'
  | 'crc'
  | 'unreadable'
  | 'unlisted';

export interface ArchiveIssue {
  path: string;
  reason: IssueReason;
}

export interface ArchiveReport {
  /** Entrées hors liste blanche (ignorées, jamais lues). */
  ignored: ArchiveIssue[];
  /** Entrées refusées ou documents invalides (isolés). */
  invalid: ArchiveIssue[];
  /** Remarques sans gravité (codes : mimetype, noManifest, modelChecksum, truncated…). */
  warnings: string[];
  /** Projet ouvert en mode de récupération : « Enregistrer » ne doit pas réécrire l'original sans confirmation. */
  recovered: boolean;
  /** Somme des tailles décompressées déclarées. */
  totalSize: number;
}

export type ArchiveErrorCode = 'notZip' | 'noProject' | 'newerVersion' | 'notVoltaplan' | 'tooManyEntries' | 'tooLarge' | 'corruptModel' | 'ambiguous' | 'unreadable';

/** Archive inutilisable (rien n'est ouvert à moitié). Clé de traduction : `format.error.<code>`. */
export class ArchiveError extends Error {
  constructor(
    readonly code: ArchiveErrorCode,
    readonly detail = '',
  ) {
    super(`Archive Voltaplan : ${code}${detail ? ' (' + detail + ')' : ''}`);
    this.name = 'ArchiveError';
  }
}

/** Document invalide ou devenu illisible (fichier déplacé, modifié, altéré). */
export class AssetIntegrityError extends Error {
  constructor(
    readonly sha256: string,
    readonly reason: IssueReason,
  ) {
    super(`Document ${sha256.slice(0, 12)}… : ${reason}`);
    this.name = 'AssetIntegrityError';
  }
}

/** Document d'une archive ouverte : contenu vérifié au premier accès. */
export interface ArchiveDoc {
  path: string;
  role: 'original' | 'derived';
  /** Original : empreinte du contenu (= nom du fichier). Dérivé : empreinte annoncée par le manifest (ou ''). */
  sha256: string;
  ext: string;
  mime: string;
  size: number;
  /** Dérivé : empreinte de l'original et rôle (« display »…). */
  of?: string;
  derivedRole?: string;
  name?: string;
  source?: string;
  state: 'unverified' | 'ok' | 'invalid';
  invalidReason?: IssueReason;
  /** Contenu vérifié (taille, signature, SHA-256). AssetIntegrityError sinon. */
  open(signal?: AbortSignal): Promise<Blob>;
}

export interface OpenedArchive {
  manifest: Manifest | null;
  projectText: string;
  sourcesText: string | null;
  /** Originaux par empreinte. */
  originals: Map<string, ArchiveDoc>;
  derived: ArchiveDoc[];
  report: ArchiveReport;
}

// TextDecoder retire de lui-même une marque d'ordre des octets (BOM) en tête
const dec = new TextDecoder('utf-8', { fatal: false });
const text = (b: Uint8Array) => dec.decode(b);

function sizeLimit(kind: string, ext: string, limits: ArchiveLimits): number {
  switch (kind) {
    case 'project':
      return limits.model;
    case 'sources':
      return limits.sources;
    case 'manifest':
      return limits.manifest;
    case 'readme':
      return limits.readme;
    case 'mimetype':
      return 1024;
    case 'derived':
      return limits.derived;
    default:
      return assetLimit(ext, limits);
  }
}

function makeDoc(
  base: Omit<ArchiveDoc, 'state' | 'open'>,
  load: (signal?: AbortSignal) => Promise<Blob>,
  expectedSha: string | null,
  report?: ArchiveReport,
): ArchiveDoc {
  let verified: Promise<Blob> | null = null;
  const doc: ArchiveDoc = {
    ...base,
    state: 'unverified',
    open(signal) {
      if (doc.state === 'invalid') return Promise.reject(new AssetIntegrityError(doc.sha256 || doc.path, doc.invalidReason ?? 'unreadable'));
      verified ??= (async () => {
        const fail = (reason: IssueReason): never => {
          doc.state = 'invalid';
          doc.invalidReason = reason;
          if (report && !report.invalid.some((i) => i.path === doc.path)) report.invalid.push({ path: doc.path, reason });
          throw new AssetIntegrityError(doc.sha256 || doc.path, reason);
        };
        let blob: Blob;
        try {
          blob = await load(signal);
        } catch (e) {
          verified = null;
          if ((e as Error)?.name === 'AbortError') throw e;
          const code = e instanceof ZipFormatError ? e.code : '';
          return fail(code === 'crc' ? 'crc' : code === 'tooLarge' ? 'tooLarge' : 'unreadable');
        }
        if (blob.size !== doc.size) return fail('sizeMismatch');
        if (!typeMatches(doc.ext, sniffType(await blobBytes(blob.slice(0, 16))))) return fail('typeMismatch');
        if (expectedSha) {
          let sha: string;
          try {
            sha = await sha256Hex(blob, signal);
          } catch (e) {
            verified = null;
            if ((e as Error)?.name === 'AbortError') throw e;
            return fail('unreadable');
          }
          if (sha !== expectedSha) return fail('shaMismatch');
        }
        doc.state = 'ok';
        return blob;
      })();
      return verified;
    },
  };
  return doc;
}

/**
 * Ouvre une archive v2. Lit le répertoire central, le manifest, le modèle et les sources ; prépare l'accès
 * paresseux aux documents. ArchiveError si l'archive est inutilisable ; sinon, les problèmes sont dans `report`.
 */
export async function readArchive(blob: Blob, opts: { limits?: ArchiveLimits } = {}): Promise<OpenedArchive> {
  const limits = opts.limits ?? DEFAULT_LIMITS;
  let zip: ZipArchiveReader;
  try {
    zip = await openZip(blob);
  } catch (e) {
    if (e instanceof ZipFormatError) {
      if (e.code === 'notZip') throw new ArchiveError('notZip');
      if (e.code === 'truncated') return recoverTruncated(blob, limits);
      if (e.code === 'ambiguous') throw new ArchiveError('ambiguous', e.message);
      if (e.code === 'unreadable') throw new ArchiveError('unreadable', e.message);
    }
    throw new ArchiveError('corruptModel', (e as Error).message);
  }
  const report: ArchiveReport = { ignored: [], invalid: [], warnings: zip.warnings.length ? ['zipWarnings'] : [], recovered: false, totalSize: 0 };
  if (zip.entries.length > limits.entries) throw new ArchiveError('tooManyEntries', String(zip.entries.length));
  report.totalSize = zip.entries.reduce((s, e) => s + e.uncompressedSize, 0);
  if (report.totalSize > limits.total) throw new ArchiveError('tooLarge', String(report.totalSize));

  const fixed = new Map<string, ZipEntryInfo>();
  const assetEntries = new Map<string, { e: ZipEntryInfo; ext: AssetExt }>();
  const derivedEntries: { e: ZipEntryInfo; of: string; role: string; ext: string }[] = [];
  for (const e of zip.entries) {
    const c = classifyPath(e.path);
    if (c.kind === 'dangerous') {
      report.invalid.push({ path: e.path, reason: c.reason });
      continue;
    }
    if (c.kind === 'ignored' || (e.directory && c.kind !== 'directory')) {
      report.ignored.push({ path: e.path, reason: 'unknown' });
      continue;
    }
    if (c.kind === 'directory') continue;
    if (e.symlink) {
      report.invalid.push({ path: e.path, reason: 'symlink' });
      continue;
    }
    if (e.encrypted) {
      report.invalid.push({ path: e.path, reason: 'encrypted' });
      continue;
    }
    if (e.method !== METHOD_STORED && e.method !== METHOD_DEFLATE) {
      report.invalid.push({ path: e.path, reason: 'method' });
      continue;
    }
    const ext = c.kind === 'asset' || c.kind === 'derived' ? c.ext : '';
    if (e.uncompressedSize > sizeLimit(c.kind, ext, limits)) {
      report.invalid.push({ path: e.path, reason: 'tooLarge' });
      continue;
    }
    if (e.method === METHOD_DEFLATE && e.uncompressedSize > limits.ratioMinSize && e.uncompressedSize / Math.max(1, e.compressedSize) > limits.ratio) {
      report.invalid.push({ path: e.path, reason: 'ratio' });
      continue;
    }
    if (c.kind === 'asset') assetEntries.set(c.sha256, { e, ext: c.ext });
    else if (c.kind === 'derived') derivedEntries.push({ e, of: c.of, role: c.role, ext: c.ext });
    else fixed.set(c.kind, e);
  }

  const readFixed = async (kind: string, max: number): Promise<Uint8Array | null> => {
    const e = fixed.get(kind);
    if (!e) return null;
    try {
      return await zip.readBytes(e, max);
    } catch (err) {
      if (kind === 'project') {
        if (err instanceof ZipFormatError && err.code === 'tooLarge') throw new ArchiveError('tooLarge', PATH_PROJECT);
        throw new ArchiveError('corruptModel', (err as Error).message);
      }
      report.invalid.push({ path: e.path, reason: err instanceof ZipFormatError && err.code === 'crc' ? 'crc' : 'unreadable' });
      return null;
    }
  };

  // mimetype : premier, stocké, contenu exact (identification sans tout lire). Absent après une recompression
  // par un outil du système : simple remarque.
  const mt = fixed.get('mimetype');
  if (!mt || zip.entries[0] !== mt || mt.method !== METHOD_STORED || text((await readFixed('mimetype', 1024)) ?? new Uint8Array()) !== MIMETYPE) report.warnings.push('mimetype');

  // Manifest : version et liste des fichiers. Absent ou illisible : récupération (le modèle reste lisible).
  let manifest: Manifest | null = null;
  const mBytes = await readFixed('manifest', limits.manifest);
  if (mBytes) {
    try {
      manifest = parseManifest(text(mBytes));
    } catch (e) {
      if (e instanceof ManifestError && e.code === 'newerVersion') throw new ArchiveError('newerVersion', e.detail);
      if (e instanceof ManifestError && e.code === 'notVoltaplan') throw new ArchiveError('notVoltaplan', e.detail);
      report.warnings.push('manifestInvalid');
      report.recovered = true;
    }
  } else {
    report.warnings.push('noManifest');
    report.recovered = true;
  }
  const listed = new Map<string, ManifestFile>((manifest?.files ?? []).map((f) => [f.path, f]));

  const pBytes = await readFixed('project', limits.model);
  if (!pBytes) throw new ArchiveError('noProject');
  const checkListed = async (path: string, bytes: Uint8Array, code: string) => {
    const f = listed.get(path);
    if (!manifest) return;
    if (!f || f.size !== bytes.length || f.sha256 !== (await sha256Hex(bytes))) {
      report.warnings.push(code);
      report.recovered = true;
    }
  };
  await checkListed(PATH_PROJECT, pBytes, 'modelChecksum');
  const sBytes = await readFixed('sources', limits.sources);
  if (sBytes) await checkListed(PATH_SOURCES, sBytes, 'sourcesChecksum');

  const originals = new Map<string, ArchiveDoc>();
  for (const [sha, { e, ext }] of assetEntries) {
    const f = listed.get(e.path);
    if (manifest && !f) report.warnings.push('unlisted');
    if (f && (f.sha256 !== sha || f.size !== e.uncompressedSize)) {
      report.invalid.push({ path: e.path, reason: f.sha256 !== sha ? 'shaMismatch' : 'sizeMismatch' });
      continue;
    }
    const mime = ASSET_TYPES[ext];
    const max = Math.min(assetLimit(ext, limits), e.method === METHOD_STORED ? Infinity : limits.inflateInMemory);
    originals.set(
      sha,
      makeDoc(
        { path: e.path, role: 'original', sha256: sha, ext, mime, size: e.uncompressedSize, name: f?.name, source: f?.source },
        (signal) => (e.method === METHOD_STORED ? zip.storedSlice(e, mime) : zip.readBlob(e, max, mime, signal)),
        sha,
        report,
      ),
    );
  }
  // Originaux annoncés mais absents ou refusés : signalés (le projet s'ouvre, le document manque)
  for (const f of manifest?.files ?? [])
    if (f.role === 'original' && !originals.has(f.sha256) && !report.invalid.some((i) => i.path === f.path)) report.invalid.push({ path: f.path, reason: 'missing' });

  const derived: ArchiveDoc[] = [];
  for (const { e, of, role, ext } of derivedEntries) {
    const f = listed.get(e.path);
    // Dérivé non listé : impossible à vérifier, et régénérable : ignoré
    if (!f) {
      report.ignored.push({ path: e.path, reason: 'unlisted' });
      continue;
    }
    const mime = ASSET_TYPES[ext as AssetExt];
    derived.push(
      makeDoc(
        { path: e.path, role: 'derived', sha256: f.sha256, ext, mime, size: e.uncompressedSize, of, derivedRole: role },
        (signal) => (e.method === METHOD_STORED ? zip.storedSlice(e, mime) : zip.readBlob(e, limits.derived, mime, signal)),
        f.sha256,
      ),
    );
  }
  if (report.invalid.length) report.recovered = true;
  return { manifest, projectText: text(pBytes), sourcesText: sBytes ? text(sBytes) : null, originals, derived, report };
}

/**
 * Vérification d'intégrité complète : chaque document est lu et vérifié (taille, signature, SHA-256).
 * `onProgress(fait, total)`. Les documents invalides sont ajoutés à `report.invalid`.
 */
export async function verifyArchive(a: OpenedArchive, onProgress?: (done: number, total: number) => void, signal?: AbortSignal): Promise<ArchiveReport> {
  const docs = [...a.originals.values(), ...a.derived];
  let done = 0;
  for (const d of docs) {
    try {
      await d.open(signal);
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') throw e;
      if (!a.report.invalid.some((i) => i.path === d.path)) a.report.invalid.push({ path: d.path, reason: d.invalidReason ?? 'unreadable' });
      a.report.recovered = true;
    }
    onProgress?.(++done, docs.length);
  }
  return a.report;
}

// ---------------------------------------------------------------------------
// Récupération d'une archive tronquée (répertoire central absent)
// ---------------------------------------------------------------------------

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 (ZIP) ; utilisé seulement par la récupération et les tests. */
export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = crcTable[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Archive d'une seule entrée, reconstruite autour de données brutes (pour réutiliser la lecture contrôlée). */
function singleEntryZip(name: Uint8Array, method: number, crc: number, csize: number, usize: number, data: Blob): Blob {
  const lh = new DataView(new ArrayBuffer(30));
  lh.setUint32(0, 0x04034b50, true);
  lh.setUint16(4, 20, true);
  lh.setUint16(8, method, true);
  lh.setUint32(14, crc, true);
  lh.setUint32(18, csize, true);
  lh.setUint32(22, usize, true);
  lh.setUint16(26, name.length, true);
  const cd = new DataView(new ArrayBuffer(46));
  cd.setUint32(0, 0x02014b50, true);
  cd.setUint16(4, 20, true);
  cd.setUint16(6, 20, true);
  cd.setUint16(10, method, true);
  cd.setUint32(16, crc, true);
  cd.setUint32(20, csize, true);
  cd.setUint32(24, usize, true);
  cd.setUint16(28, name.length, true);
  const cdSize = 46 + name.length;
  const cdOffset = 30 + name.length + csize;
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, 1, true);
  eocd.setUint16(10, 1, true);
  eocd.setUint32(12, cdSize, true);
  eocd.setUint32(16, cdOffset, true);
  return new Blob([lh.buffer, name as BlobPart, data, cd.buffer, name as BlobPart, eocd.buffer]);
}

async function recoverTruncated(blob: Blob, limits: ArchiveLimits): Promise<OpenedArchive> {
  const report: ArchiveReport = { ignored: [], invalid: [], warnings: ['truncated'], recovered: true, totalSize: 0 };
  const originals = new Map<string, ArchiveDoc>();
  let projectText: string | null = null;
  let sourcesText: string | null = null;
  let pos = 0;
  let count = 0;
  while (pos + 30 <= blob.size && count++ < limits.entries) {
    const h = await blobBytes(blob.slice(pos, pos + 30));
    const dv = new DataView(h.buffer, h.byteOffset, 30);
    if (dv.getUint32(0, true) !== 0x04034b50) break;
    const flags = dv.getUint16(6, true);
    const method = dv.getUint16(8, true);
    const crc = dv.getUint32(14, true);
    const csize = dv.getUint32(18, true);
    const usize = dv.getUint32(22, true);
    const n = dv.getUint16(26, true);
    const m = dv.getUint16(28, true);
    const nameBytes = await blobBytes(blob.slice(pos + 30, pos + 30 + n));
    const path = new TextDecoder().decode(nameBytes);
    const start = pos + 30 + n + m;
    const end = start + csize;
    // Taille inconnue (descripteur de données) ou données coupées : on s'arrête là
    if ((flags & 8 && csize === 0) || end > blob.size || csize === 0xffffffff) {
      report.invalid.push({ path, reason: 'unreadable' });
      break;
    }
    pos = end;
    const c = classifyPath(path);
    if (c.kind === 'dangerous') {
      report.invalid.push({ path, reason: c.reason });
      continue;
    }
    if (flags & 1) {
      report.invalid.push({ path, reason: 'encrypted' });
      continue;
    }
    if (method !== METHOD_STORED && method !== METHOD_DEFLATE) {
      report.invalid.push({ path, reason: 'method' });
      continue;
    }
    const ext = c.kind === 'asset' || c.kind === 'derived' ? c.ext : '';
    if (usize > sizeLimit(c.kind, ext, limits) || (method === METHOD_DEFLATE && usize > limits.ratioMinSize && usize / Math.max(1, csize) > limits.ratio)) {
      report.invalid.push({ path, reason: 'tooLarge' });
      continue;
    }
    report.totalSize += usize;
    const entryZip = async () => {
      const z = await openZip(singleEntryZip(nameBytes, method, crc, csize, usize, blob.slice(start, end)));
      return { z, e: z.entries[0] };
    };
    if (c.kind === 'project' || c.kind === 'sources') {
      try {
        const { z, e } = await entryZip();
        const t = text(await z.readBytes(e, c.kind === 'project' ? limits.model : limits.sources));
        if (c.kind === 'project') projectText = t;
        else sourcesText = t;
      } catch {
        report.invalid.push({ path, reason: 'crc' });
      }
    } else if (c.kind === 'asset') {
      const mime = ASSET_TYPES[c.ext];
      originals.set(
        c.sha256,
        makeDoc(
          { path, role: 'original', sha256: c.sha256, ext: c.ext, mime, size: usize },
          async (signal) => {
            if (method === METHOD_STORED) return blob.slice(start, end, mime);
            const { z, e } = await entryZip();
            return z.readBlob(e, limits.inflateInMemory, mime, signal);
          },
          c.sha256,
          report,
        ),
      );
    } else if (c.kind === 'ignored') report.ignored.push({ path, reason: 'unknown' });
  }
  if (projectText === null) throw new ArchiveError('noProject', 'archive tronquée');
  return { manifest: null, projectText, sourcesText, originals, derived: [], report };
}

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

export interface ArchiveOriginal {
  sha256: string;
  mime: string;
  size: number;
  name?: string;
  source?: string;
  /** Contenu, lu au moment de l'écrire (flux : un seul document en mémoire à la fois, au plus). */
  blob: () => Promise<Blob>;
}

export interface ArchiveDerived {
  of: string;
  role: string;
  sha256: string;
  mime: string;
  size: number;
  blob: () => Promise<Blob>;
}

export interface ArchiveWriteInput {
  projectText: string;
  sourcesText?: string | null;
  title: string;
  appVersion: string;
  createdAt?: string;
  originals: ArchiveOriginal[];
  derived?: ArchiveDerived[];
  now?: Date;
}

/** Contenu logique commun (archive, dossier cloud, répertoire) : fichiers texte et manifest. */
export async function buildLogicalFiles(input: ArchiveWriteInput): Promise<{ manifest: Manifest; texts: { path: string; bytes: Uint8Array }[] }> {
  const enc = new TextEncoder();
  const texts: { path: string; bytes: Uint8Array; role: ManifestFile['role'] }[] = [{ path: PATH_PROJECT, bytes: enc.encode(input.projectText), role: 'model' }];
  if (input.sourcesText) texts.push({ path: PATH_SOURCES, bytes: enc.encode(input.sourcesText), role: 'sources' });
  texts.push({ path: PATH_README, bytes: enc.encode(readmeText(input.title)), role: 'readme' });
  const files: ManifestFile[] = [];
  for (const t of texts) files.push({ path: t.path, size: t.bytes.length, sha256: await sha256Hex(t.bytes), role: t.role });
  const seen = new Set<string>();
  for (const o of input.originals) {
    const ext = extForMime(o.mime);
    if (!ext || seen.has(o.sha256)) continue;
    seen.add(o.sha256);
    files.push({ path: assetPath(o.sha256, ext), size: o.size, sha256: o.sha256, role: 'original', mime: ASSET_TYPES[ext], ...(o.name ? { name: o.name.slice(0, 255) } : {}), ...(o.source ? { source: o.source } : {}) });
  }
  for (const d of input.derived ?? []) {
    const ext = extForMime(d.mime);
    if (ext !== 'jpg' && ext !== 'png' && ext !== 'webp') continue;
    if (!seen.has(d.of)) continue; // un dérivé n'est jamais écrit sans son original
    files.push({ path: derivedPath(d.of, d.role, ext), size: d.size, sha256: d.sha256, role: 'derived', mime: ASSET_TYPES[ext], of: d.of });
  }
  const manifest = buildManifest(files, input.appVersion, input.createdAt ?? '', input.now);
  return { manifest, texts };
}

/**
 * Écrit l'archive, en flux, dans l'ordre : mimetype, manifest.json, project.json, sources.json, README.txt,
 * assets/*, derived/*. Médias stockés sans recompression, textes en deflate 9. Sans `sink`, renvoie un `Blob`.
 */
export async function writeArchive(input: ArchiveWriteInput, sink?: WritableStream<Uint8Array>, signal?: AbortSignal): Promise<{ blob: Blob | null; manifest: Manifest }> {
  const { manifest, texts } = await buildLogicalFiles(input);
  const byPath = new Map<string, () => Promise<Blob>>();
  for (const o of input.originals) {
    const ext = extForMime(o.mime);
    if (ext) byPath.set(assetPath(o.sha256, ext), o.blob);
  }
  for (const d of input.derived ?? []) {
    const ext = extForMime(d.mime);
    if (ext === 'jpg' || ext === 'png' || ext === 'webp') byPath.set(derivedPath(d.of, d.role, ext), d.blob);
  }
  function* entries(): Generator<ZipInput> {
    yield { path: PATH_MIMETYPE, data: MIMETYPE, store: true };
    yield { path: PATH_MANIFEST, data: JSON.stringify(manifest, null, 1), store: false };
    for (const t of texts) yield { path: t.path, data: t.bytes, store: false };
    for (const f of manifest.files) {
      if (f.role !== 'original' && f.role !== 'derived') continue;
      const get = byPath.get(f.path)!;
      const expected = f.size;
      yield {
        path: f.path,
        store: true,
        data: async () => {
          const b = await get();
          // Contrôle à la volée : jamais une archive dont le manifest ment sur la taille d'un document
          if (b.size !== expected) throw new AssetIntegrityError(f.sha256, 'sizeMismatch');
          return b;
        },
      };
    }
  }
  const blob = await writeZip(entries(), sink, signal);
  return { blob, manifest };
}
