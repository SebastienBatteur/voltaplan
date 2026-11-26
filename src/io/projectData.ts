/**
 * Lecture et écriture d'un projet, quel que soit son format et sa provenance (fichier, navigateur, cloud,
 * GitHub) : le type est reconnu par sa signature, jamais par son extension.
 *   - `PK\x03\x04` : archive v2 (src/format/archive.ts) ;
 *   - `{` (ou BOM) : JSON v1, converti à l'ouverture (images rangées dans le stockage de travail) ;
 *   - `<?xml` : Trikker ;
 *   - `EDS`/`TXT` suivi de la version : Eendraadschema (src/import/eendraadschema.ts).
 * Écriture : l'archive v2 est assemblée en flux à partir du modèle et des documents (stockage de travail ou
 * source de la session). Avant d'écrire, on vérifie que tous les documents sont disponibles : jamais un fichier
 * qui référence un document absent sans que l'utilisateur le sache.
 */
import { version as APP_VERSION } from '../../package.json';
import { importTrikker } from '../import/trikker';
import { importEendraadschema } from '../import/eendraadschema';
import type { MigrationWarning } from '../model/migrate';
import type { Project } from '../model/types';
import { readArchive, writeArchive, type ArchiveReport, type ArchiveWriteInput, type OpenedArchive } from '../format/archive';
import { workingStore } from '../format/assetsIdb';
import { capacityAdvice, currentDevice, deviceLimits } from '../format/limits';
import { blobToDataUrl, exportV1, extractEmbeddedImages, placeExtractedImages, scanV1, type V1Loss } from '../format/migrateV1';
import { assetShaOf } from '../format/manifest';
import { mergeSources, projectAssetRefs, splitProject, type AssetRef } from '../format/projectFile';
import { AssetSession, type DocSource } from '../format/session';
import { blobBytes } from '../format/sha256';
import { checkFileSize } from './limits';
import { sanitizeProjectImages } from './sanitize';
import { parseProjectChecked } from './storage';

export { APP_VERSION };

/** Session de documents de l'application (une par onglet). */
export const assetSession = new AssetSession(workingStore);

export type DataFormat = 'v2' | 'v1' | 'trik' | 'eds';

/** Format d'après les premiers octets. */
export function detectFormat(head: Uint8Array): DataFormat | null {
  if (head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) return 'v2';
  // Eendraadschema : « EDS » ou « TXT » suivi de la version sur 3 chiffres
  const tag = String.fromCharCode(...head.slice(0, 6));
  if (/^(EDS|TXT)\d{3}$/.test(tag)) return 'eds';
  let i = 0;
  if (head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf) i = 3;
  while (i < head.length && (head[i] === 0x20 || head[i] === 0x0a || head[i] === 0x0d || head[i] === 0x09)) i++;
  if (head[i] === 0x7b) return 'v1';
  if (head[i] === 0x3c) return 'trik';
  return null;
}

export interface ProjectOpen {
  project: Project;
  format: DataFormat;
  /** Avertissements : texte (import Trikker) ou clé de traduction (lecture d'un projet, import Eendraadschema). */
  warnings: (string | MigrationWarning)[];
  /** Archive v2 : rapport de validation (entrées ignorées, invalides, récupération). */
  report?: ArchiveReport;
  /** Projet ouvert en mode de récupération ou converti : ne jamais réécrire l'original sans confirmation. */
  needsNewFile: boolean;
}

/**
 * Texte d'un fichier : UTF-8, sinon Windows-1252. Trikker enregistre en Windows-1252 sans le déclarer :
 * lu en UTF-8, « Église » deviendrait « �glise ».
 */
export function decodeText(buf: ArrayBuffer | Uint8Array): string {
  try {
    // TextDecoder retire de lui-même une marque d'ordre des octets (BOM) en tête
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}

/** Avertissements traduisibles issus du rapport d'archive. */
export function reportWarnings(r: ArchiveReport): MigrationWarning[] {
  const w: MigrationWarning[] = [];
  const invalid = r.invalid.filter((i) => i.reason !== 'missing').length;
  const missing = r.invalid.filter((i) => i.reason === 'missing').length;
  if (r.warnings.includes('truncated')) w.push({ key: 'format.truncated' });
  if (invalid) w.push({ key: 'format.invalidEntries', params: { n: invalid } });
  if (missing) w.push({ key: 'format.missingDocs', params: { n: missing } });
  if (r.ignored.length) w.push({ key: 'format.ignoredEntries', params: { n: r.ignored.length } });
  if (r.warnings.includes('modelChecksum') || r.warnings.includes('noManifest') || r.warnings.includes('manifestInvalid')) w.push({ key: 'format.checksum' });
  if (r.recovered) w.push({ key: 'format.recovered' });
  return w;
}

/** Sources de la session pour les documents d'une archive ouverte (lecture paresseuse, vérifiée). */
export function archiveSources(a: OpenedArchive): { originals: Map<string, DocSource>; derived: Map<string, DocSource> } {
  const originals = new Map<string, DocSource>();
  for (const [sha, d] of a.originals) originals.set(sha, { open: (s) => d.open(s), name: d.name, mime: d.mime, size: d.size });
  const derived = new Map<string, DocSource>();
  for (const d of a.derived) if (d.of && d.derivedRole) derived.set(`${d.of}-${d.derivedRole}`, { open: (s) => d.open(s) });
  return { originals, derived };
}

/**
 * Ouvre un projet (contenu d'un fichier ou réponse d'un service). `session` : où attacher les documents de
 * l'archive (par défaut celle de l'application) ; la copie en arrière-plan dans le stockage de travail commence
 * aussitôt (F3 : le fichier peut être déplacé ensuite sans perte des documents déjà copiés).
 */
export async function openProjectData(data: Blob | string, name: string, session: AssetSession = assetSession, opts: { background?: boolean } = {}): Promise<ProjectOpen> {
  const blob = typeof data === 'string' ? new Blob([data]) : data;
  const fmt = /\.trik$/i.test(name) ? 'trik' : /\.eds$/i.test(name) ? 'eds' : detectFormat(await blobBytes(blob.slice(0, 64)));
  if (fmt === 'v2') {
    const device = await currentDevice();
    const advice = capacityAdvice(blob.size, device, deviceLimits(device));
    const a = await readArchive(blob, { limits: deviceLimits(device) });
    const { originals, derived } = archiveSources(a);
    session.attach(originals, derived);
    const { text, sourcesUnreadable } = mergeSources(a.projectText, a.sourcesText);
    const { project, warnings, removed } = parseProjectChecked(text, name);
    const w: MigrationWarning[] = [...warnings, ...reportWarnings(a.report)];
    if (removed) w.push({ key: 'file.imagesRemoved', params: { n: removed } });
    if (sourcesUnreadable) w.push({ key: 'file.evidenceUnreadable' });
    if (advice.level === 'heavy') w.push({ key: 'format.heavy', params: { size: Math.round(advice.size / 1048576) } });
    if (advice.level === 'noWorkingCopy') w.push({ key: 'format.noWorkingCopy', params: { size: Math.round(advice.size / 1048576), free: Math.round(advice.free / 1048576) } });
    if (opts.background !== false) void session.copyInBackground();
    return { project, format: 'v2', warnings: w, report: a.report, needsNewFile: a.report.recovered };
  }
  // v1, Trikker et Eendraadschema : texte, plafond de taille de l'ancien format
  checkFileSize({ name, size: blob.size }, fmt === 'trik' ? 'trik' : fmt === 'eds' ? 'eds' : 'project');
  if (fmt === 'eds') {
    // Pas d'image dans un .eds : rien à ranger dans le stockage de travail
    const { project, warnings } = await importEendraadschema(decodeText(await blobBytes(blob)), name);
    return { project, format: 'eds', warnings, needsNewFile: true };
  }
  const add = async (b: Blob, n: string) => (await session.store.add(b, { name: n })).sha256;
  if (fmt === 'trik') {
    const { project, warnings } = importTrikker(decodeText(await blobBytes(blob)), name);
    if (sanitizeProjectImages(project)) warnings.push('Images non intégrées ignorées.');
    await extractEmbeddedImages(project, add);
    return { project, format: 'trik', warnings, needsNewFile: true };
  }
  // v1 : lu par tranches, images décodées au fil de la lecture (mémoire réduite, voir scanV1) ; repli sur la
  // lecture habituelle si le contenu sort du cas simple. Ni le texte complet ni les chaînes base64 ne sont gardés.
  const scanned = await scanV1(blob);
  const { project, warnings, removed } = parseProjectChecked(scanned ? scanned.text : decodeText(await blobBytes(blob)), name);
  const w: MigrationWarning[] = [...warnings];
  if (removed) w.push({ key: 'file.imagesRemoved', params: { n: removed } });
  const placed = scanned ? await placeExtractedImages(project, scanned.images, add) : { converted: 0, keptInline: 0, tried: undefined };
  const conv = await extractEmbeddedImages(project, add, placed.tried);
  w.push({ key: 'format.v1Converted' });
  const keptInline = placed.keptInline + conv.keptInline;
  if (keptInline) w.push({ key: 'format.keptInline', params: { n: keptInline } });
  return { project, format: 'v1', warnings: w, needsNewFile: true };
}

/** Documents indisponibles : l'enregistrement est refusé (avec leur liste) plutôt que de produire un fichier incomplet. */
export class MissingAssetsError extends Error {
  constructor(readonly missing: AssetRef[]) {
    super(`Documents indisponibles : ${missing.map((m) => m.label || m.sha256.slice(0, 12)).join(', ')}`);
    this.name = 'MissingAssetsError';
  }
}

/**
 * Contenu à écrire (archive ou dossier). Documents référencés par le modèle : obligatoires (MissingAssetsError
 * sinon, sauf `allowMissing`) ; documents sources de l'assistant : inclus s'ils sont disponibles.
 */
export async function projectWriteInput(project: Project, session: AssetSession = assetSession, opts: { allowMissing?: boolean; withDerived?: boolean } = {}): Promise<ArchiveWriteInput> {
  const missing = await session.missing(project);
  if (missing.length && !opts.allowMissing) throw new MissingAssetsError(missing);
  const { projectText, sourcesText } = splitProject(project);
  const originals: ArchiveWriteInput['originals'] = [];
  const derived: NonNullable<ArchiveWriteInput['derived']> = [];
  for (const r of projectAssetRefs(project)) {
    if (missing.some((m) => m.sha256 === r.sha256)) continue;
    let meta = await session.store.meta(r.sha256).catch(() => undefined);
    if (!meta) {
      // Encore dans sa source (archive, dossier) : lue maintenant (vérifiée et copiée au passage)
      const b = await session.blob(r.sha256).catch(() => undefined);
      if (!b) {
        if (r.kind !== 'source' && !opts.allowMissing) throw new MissingAssetsError([r]);
        continue;
      }
      meta = { sha256: r.sha256, mime: b.type, size: b.size, addedAt: '' };
    }
    const m = meta;
    originals.push({ sha256: r.sha256, mime: m.mime, size: m.size, name: m.name, source: r.source, blob: () => session.blob(r.sha256) });
    if (opts.withDerived !== false)
      for (const d of await session.store.listDerivedOf(r.sha256).catch(() => []))
        derived.push({ of: d.of, role: d.role, sha256: d.sha256, mime: d.mime, size: d.size, blob: async () => (await session.store.getDerived(d.of, d.role)) ?? Promise.reject(new Error('dérivé supprimé')) });
  }
  return { projectText, sourcesText, title: project.meta.title, appVersion: APP_VERSION, originals, derived };
}

/** Archive v2 du projet : vers `sink` (écriture en flux) ou en `Blob`. */
export async function serializeProject(project: Project, sink?: WritableStream<Uint8Array>, session: AssetSession = assetSession, signal?: AbortSignal): Promise<Blob | null> {
  // Images dérivées non écrites (F6, facultatives) : régénérables, et un dérivé libéré du cache entre la
  // préparation et l'écriture ferait échouer l'enregistrement. Elles sont lues si une archive en contient.
  return (await writeArchive(await projectWriteInput(project, session, { withDerived: false }), sink, signal)).blob;
}

/**
 * Adresse d'une image du projet utilisable par `<img>` : inchangée pour une image intégrée, URL d'objet de l'image
 * d'affichage pour une référence « asset: » (mêmes dimensions en pixels que celles mémorisées dans le projet).
 */
export function resolveImageSrc(href: string): Promise<string> {
  return assetSession.displayUrl(href);
}

/**
 * Image du projet en data URL (image d'affichage pour une référence « asset: ») : pour les traitements qui
 * attendent une image intégrée (dossier de preuves de l'assistant, comme au format v1).
 */
export async function imageAsDataUrl(href: string): Promise<string> {
  const sha = assetShaOf(href);
  if (!sha) return href;
  return blobToDataUrl(await assetSession.displayBlob(sha), 'image/jpeg');
}

/** Copie au format v1 (anciennes versions de Voltaplan) et liste de ce qui n'a pas pu être gardé. */
export async function projectToV1(project: Project, session: AssetSession = assetSession): Promise<{ json: string; losses: V1Loss[] }> {
  return exportV1(project, {
    original: (sha) => session.blob(sha),
    display: (sha) => session.displayBlob(sha),
  });
}
