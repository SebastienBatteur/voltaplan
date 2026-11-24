/**
 * Format de projet v2 : contenu logique commun à l'archive `.voltaplan` (ZIP) et au dossier de projet (cloud ou
 * répertoire local). Spécification : docs/strategie/SPEC-FORMAT-V2.md ; décision : docs/adr/0004 et 0006.
 *
 *   mimetype                      « application/vnd.voltaplan+zip » (archive seulement, premier, non compressé)
 *   manifest.json                 format, versions, liste des fichiers (taille, SHA-256, rôle)
 *   project.json                  modèle électrique (images : références « asset:<sha256> »)
 *   sources.json                  dossier de preuves de l'assistant (facultatif)
 *   README.txt                    explication en clair (FR, NL, EN) pour une récupération sans Voltaplan
 *   assets/<sha256>.<ext>         documents originaux, immuables, nommés par leur empreinte
 *   derived/<sha256>-<rôle>.<ext> images d'affichage régénérables (jamais la seule copie d'un document)
 *
 * Tout autre chemin est ignoré (liste blanche) et signalé.
 */
import { z } from 'zod';
import { APP_NAME, FILE_FORMAT } from '../brand';
import { isSha256Hex } from './sha256';

export const MIMETYPE = 'application/vnd.voltaplan+zip';
/** Version du conteneur (archive ou dossier). */
export const FORMAT_VERSION = 2;
/** Version minimale de Voltaplan capable de lire ce que nous écrivons (ajouts facultatifs : inchangée). */
export const MIN_READER_VERSION = 2;

export const PATH_MIMETYPE = 'mimetype';
export const PATH_MANIFEST = 'manifest.json';
export const PATH_PROJECT = 'project.json';
export const PATH_SOURCES = 'sources.json';
export const PATH_README = 'README.txt';

/** Préfixe des références de médias dans project.json. */
export const ASSET_SCHEME = 'asset:';
export const assetHref = (sha: string) => ASSET_SCHEME + sha;
/** Empreinte d'une référence « asset:<sha256> », ou null. */
export function assetShaOf(href: unknown): string | null {
  if (typeof href !== 'string' || !href.startsWith(ASSET_SCHEME)) return null;
  const sha = href.slice(ASSET_SCHEME.length);
  return isSha256Hex(sha) ? sha : null;
}

/** Types de documents acceptés : extension ↔ type MIME. SVG, HTML et tout format actif sont exclus. */
export const ASSET_TYPES = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  avif: 'image/avif',
  tif: 'image/tiff',
  pdf: 'application/pdf',
} as const;
export type AssetExt = keyof typeof ASSET_TYPES;
export const DERIVED_EXTS = ['jpg', 'png', 'webp'] as const;

export function extForMime(mime: string): AssetExt | null {
  const m = mime.toLowerCase();
  if (m === 'image/jpg' || m === 'image/pjpeg') return 'jpg';
  for (const [ext, t] of Object.entries(ASSET_TYPES)) if (t === m) return ext as AssetExt;
  return null;
}

/** Formats déjà compressés : stockés sans recompression dans l'archive. Tous nos types le sont. */
export const isPrecompressed = (ext: string) => ext in ASSET_TYPES;

export const assetPath = (sha: string, ext: AssetExt) => `assets/${sha}.${ext}`;
export const derivedPath = (sha: string, role: string, ext: (typeof DERIVED_EXTS)[number]) => `derived/${sha}-${role}.${ext}`;

export type PathClass =
  | { kind: 'mimetype' | 'manifest' | 'project' | 'sources' | 'readme' }
  | { kind: 'asset'; sha256: string; ext: AssetExt }
  | { kind: 'derived'; of: string; role: string; ext: string }
  | { kind: 'directory' }
  | { kind: 'ignored'; reason: 'unknown' }
  | { kind: 'dangerous'; reason: 'traversal' | 'absolute' | 'backslash' | 'nonAscii' | 'control' | 'tooLong' };

const FIXED: Record<string, PathClass['kind']> = {
  [PATH_MIMETYPE]: 'mimetype',
  [PATH_MANIFEST]: 'manifest',
  [PATH_PROJECT]: 'project',
  [PATH_SOURCES]: 'sources',
  [PATH_README]: 'readme',
};
const ASSET_RE = new RegExp(`^assets/([0-9a-f]{64})\\.(${Object.keys(ASSET_TYPES).join('|')})$`);
const DERIVED_RE = new RegExp(`^derived/([0-9a-f]{64})-([a-z0-9]{1,16})\\.(${DERIVED_EXTS.join('|')})$`);

/**
 * Classement d'un chemin d'entrée (liste blanche). Les chemins dangereux (sortie de l'archive, chemin absolu,
 * séparateur Windows, caractères non ASCII ou de contrôle) sont distingués des chemins simplement inconnus.
 */
export function classifyPath(path: string): PathClass {
  if (path.length > 255) return { kind: 'dangerous', reason: 'tooLong' };
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(path)) return { kind: 'dangerous', reason: 'control' };
  if (/[^ -~]/.test(path)) return { kind: 'dangerous', reason: 'nonAscii' };
  if (path.includes('\\')) return { kind: 'dangerous', reason: 'backslash' };
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) return { kind: 'dangerous', reason: 'absolute' };
  if (path.split('/').some((seg) => seg === '..' || seg === '.')) return { kind: 'dangerous', reason: 'traversal' };
  const fixed = FIXED[path];
  if (fixed) return { kind: fixed } as PathClass;
  if (path === 'assets/' || path === 'derived/') return { kind: 'directory' };
  let m = ASSET_RE.exec(path);
  if (m) return { kind: 'asset', sha256: m[1], ext: m[2] as AssetExt };
  m = DERIVED_RE.exec(path);
  if (m) return { kind: 'derived', of: m[1], role: m[2], ext: m[3] };
  return { kind: 'ignored', reason: 'unknown' };
}

/**
 * Type réel d'un contenu d'après sa signature (« magic bytes »), jamais d'après son extension.
 * Renvoie null pour tout contenu non reconnu (dont SVG, HTML, scripts).
 */
export function sniffType(head: Uint8Array): AssetExt | null {
  const b = head;
  const at = (i: number, s: string) => s.split('').every((c, k) => b[i + k] === c.charCodeAt(0));
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length >= 8 && b[0] === 0x89 && at(1, 'PNG') && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'png';
  if (b.length >= 6 && (at(0, 'GIF87a') || at(0, 'GIF89a'))) return 'gif';
  if (b.length >= 12 && at(0, 'RIFF') && at(8, 'WEBP')) return 'webp';
  if (b.length >= 5 && at(0, '%PDF-')) return 'pdf';
  if (b.length >= 4 && ((at(0, 'II') && b[2] === 42 && b[3] === 0) || (at(0, 'MM') && b[2] === 0 && b[3] === 42))) return 'tif';
  if (b.length >= 12 && at(4, 'ftyp')) {
    const brand = String.fromCharCode(...b.subarray(8, 12));
    if (/^(avif|avis)$/.test(brand)) return 'avif';
    if (/^(heic|heix|hevc|hevx|heim|heis)$/.test(brand)) return 'heic';
    if (/^(mif1|msf1)$/.test(brand)) return 'heif';
  }
  return null;
}

/** Signature cohérente avec l'extension annoncée (heic et heif sont interchangeables, comme avif/mif1). */
export function typeMatches(declared: string, sniffed: AssetExt | null): boolean {
  if (!sniffed) return false;
  if (declared === 'jpeg') declared = 'jpg';
  if (declared === sniffed) return true;
  const heif = ['heic', 'heif', 'avif'];
  return heif.includes(declared) && heif.includes(sniffed);
}

export type FileRole = 'model' | 'sources' | 'readme' | 'original' | 'derived';

export interface ManifestFile {
  path: string;
  size: number;
  sha256: string;
  role: FileRole;
  mime?: string;
  /** Identifiant de la source (sources.json) d'un original. */
  source?: string;
  /** Nom d'origine (affichage, export en dossier) ; jamais un chemin. */
  name?: string;
  /** Dérivé : empreinte de l'original dont il est tiré. */
  of?: string;
}

export interface Manifest {
  format: string;
  formatVersion: number;
  minReaderVersion: number;
  app: { name: string; version: string };
  createdAt: string;
  savedAt: string;
  files: ManifestFile[];
}

const manifestSchema = z.looseObject({
  format: z.string(),
  formatVersion: z.number().int().positive(),
  minReaderVersion: z.number().int().positive().default(FORMAT_VERSION),
  app: z.looseObject({ name: z.string().default(APP_NAME), version: z.string().default('') }).default({ name: APP_NAME, version: '' }),
  createdAt: z.string().default(''),
  savedAt: z.string().default(''),
  files: z
    .array(
      z.looseObject({
        path: z.string().max(255),
        size: z.number().int().nonnegative(),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
        role: z.enum(['model', 'sources', 'readme', 'original', 'derived']),
        mime: z.string().max(100).optional(),
        source: z.string().max(200).optional(),
        name: z.string().max(255).optional(),
        of: z.string().regex(/^[0-9a-f]{64}$/).optional(),
      }),
    )
    .max(100_000),
});

export class ManifestError extends Error {
  constructor(
    readonly code: 'invalid' | 'notVoltaplan' | 'newerVersion',
    readonly detail = '',
  ) {
    super(`manifest.json : ${code}${detail ? ' (' + detail + ')' : ''}`);
    this.name = 'ManifestError';
  }
}

/** Lecture et validation de manifest.json. Version future incompatible : ManifestError('newerVersion'). */
export function parseManifest(text: string): Manifest {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ManifestError('invalid', 'JSON');
  }
  const r = manifestSchema.safeParse(data);
  if (!r.success) {
    const i = r.error.issues[0];
    throw new ManifestError('invalid', `${i.path.join('.')} : ${i.message}`);
  }
  const m = r.data as unknown as Manifest;
  if (m.format !== FILE_FORMAT) throw new ManifestError('notVoltaplan', m.format);
  if (m.minReaderVersion > FORMAT_VERSION) throw new ManifestError('newerVersion', String(m.formatVersion));
  return m;
}

export function buildManifest(files: ManifestFile[], appVersion: string, createdAt: string, now = new Date()): Manifest {
  return {
    format: FILE_FORMAT,
    formatVersion: FORMAT_VERSION,
    minReaderVersion: MIN_READER_VERSION,
    app: { name: APP_NAME, version: appVersion },
    createdAt: createdAt || now.toISOString(),
    savedAt: now.toISOString(),
    files,
  };
}

/** README.txt d'un DOSSIER de projet (pas une archive) : récupération sans Voltaplan (FR, NL, EN). */
export function folderReadmeText(title: string): string {
  const t = title.replace(/[\r\n]+/g, ' ').slice(0, 200);
  return [
    `${APP_NAME} — ${t || 'projet'}`,
    '',
    '[FR] Ce dossier est un projet Voltaplan. Vos données restent lisibles sans Voltaplan :',
    '  - project.json : le projet (installation, plan, tableaux), en JSON lisible ;',
    '  - assets/ : les documents originaux (photos, PDF), nommés par leur empreinte SHA-256 ;',
    '  - « project (conflit …).json » : une autre version enregistrée en même temps ailleurs (rien n’est écrasé).',
    'Ne renommez ni ne déplacez les fichiers de assets/ : project.json les désigne par leur nom.',
    '',
    '[NL] Deze map is een Voltaplan-project. Uw gegevens blijven leesbaar zonder Voltaplan: project.json (het',
    'project, leesbare JSON), assets/ (originele foto’s en PDF’s, genoemd naar hun SHA-256), « project (conflit …).json »',
    '(een andere versie die tegelijk elders werd opgeslagen; niets wordt overschreven). Hernoem of verplaats de',
    'bestanden in assets/ niet: project.json verwijst ernaar met hun naam.',
    '',
    '[EN] This folder is a Voltaplan project. Your data stays readable without Voltaplan: project.json (the project,',
    'readable JSON), assets/ (original photos and PDFs, named by SHA-256), "project (conflit …).json" (another version',
    'saved elsewhere at the same time; nothing is overwritten). Do not rename or move the files in assets/:',
    'project.json refers to them by name.',
    '',
    'Format : voltaplan v2, dossier (documentation : docs/file-format.md du dépôt Voltaplan).',
    '',
  ].join('\r\n');
}

/** README.txt : récupération des données sans Voltaplan (FR, NL, EN). */
export function readmeText(title: string): string {
  const t = title.replace(/[\r\n]+/g, ' ').slice(0, 200);
  return [
    `${APP_NAME} — ${t || 'projet'}`,
    '',
    '[FR] Ce fichier est une archive ZIP ordinaire. Pour récupérer vos données sans Voltaplan, renommez-le en',
    '.zip (ou ouvrez-le avec un outil ZIP) :',
    '  - project.json : le projet (installation, plan, tableaux), en JSON lisible ;',
    '  - sources.json : les documents sources et leur nom d’origine ;',
    '  - assets/ : les documents originaux (photos, PDF), nommés par leur empreinte SHA-256 ;',
    '  - derived/ : des images réduites pour l’affichage, régénérables ;',
    '  - manifest.json : la liste des fichiers avec leur taille et leur empreinte (vérification d’intégrité).',
    '',
    '[NL] Dit bestand is een gewoon ZIP-archief. Om uw gegevens zonder Voltaplan terug te halen, hernoem het naar',
    '.zip (of open het met een ZIP-programma): project.json (het project), sources.json (bronnen en hun',
    'oorspronkelijke naam), assets/ (originele foto’s en PDF’s, genoemd naar hun SHA-256), derived/ (verkleinde',
    'afbeeldingen, opnieuw aan te maken), manifest.json (lijst van bestanden met grootte en vingerafdruk).',
    '',
    '[EN] This file is a regular ZIP archive. To recover your data without Voltaplan, rename it to .zip (or open',
    'it with any ZIP tool): project.json (the project), sources.json (source documents and their original',
    'names), assets/ (original photos and PDFs, named by SHA-256), derived/ (reduced display images, can be',
    'regenerated), manifest.json (file list with sizes and checksums).',
    '',
    'Format : voltaplan v2 (documentation : docs/file-format.md du dépôt Voltaplan).',
    '',
  ].join('\r\n');
}
