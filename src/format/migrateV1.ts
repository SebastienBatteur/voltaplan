/**
 * Passage entre le format v1 (JSON unique, images intégrées en base64) et le format v2 (F7).
 *
 * v1 → v2 : à l'ouverture, les fonds de plan et photos de tableau intégrés (`data:image/…`) sont rangés dans le
 * stockage de travail (empreinte SHA-256) et remplacés par « asset:<sha256> ». Le fichier d'origine n'est jamais
 * réécrit : « Enregistrer » propose un nouvel emplacement (boîte « Enregistrer sous » du système, qui demande
 * confirmation avant de remplacer un fichier). Une image impossible à convertir reste intégrée (aucune perte).
 * Les petites images non « fond de plan » (meubles importés de Trikker) restent intégrées : l'export Trikker les
 * lit en base64.
 *
 * v2 → v1 (« Exporter au format v1 », pour une ancienne version de Voltaplan) : les images sont réintégrées en
 * base64 ; ce qui ne peut pas l'être est listé clairement (originaux PDF, documents sources de l'assistant,
 * documents manquants, fichier trop gros pour les anciennes versions).
 */
import { FILE_FORMAT } from '../brand';
import type { Project } from '../model/types';
import { IMPORT_LIMITS } from '../io/limits';
import { assetShaOf, assetHref } from './manifest';
import { projectAssetRefs } from './projectFile';
import { blobBytes } from './sha256';

/** Décodage d'une image intégrée ; null si ce n'est pas une data URL d'image. */
export function dataUrlToBlob(href: string): Blob | null {
  const m = /^data:(image\/[a-z0-9.+-]+)((?:;[a-z0-9=.+-]+)*?)(;base64)?,(.*)$/is.exec(href);
  if (!m) return null;
  try {
    if (m[3]) {
      const bin = atob(m[4].replace(/\s+/g, ''));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes], { type: m[1].toLowerCase() });
    }
    return new Blob([decodeURIComponent(m[4])], { type: m[1].toLowerCase() });
  } catch {
    return null;
  }
}

export async function blobToDataUrl(blob: Blob, mime = blob.type): Promise<string> {
  const bytes = await blobBytes(blob);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(bin)}`;
}

export interface ConvertResult {
  converted: number;
  /** Images laissées intégrées (type non reconnu, stockage indisponible) : rien n'est perdu. */
  keptInline: number;
}

/**
 * v1 → v2 : range les images intégrées (fonds de plan, photos de tableau) dans le stockage de travail.
 * Modifie `project` (fraîchement lu). `add` : ajout d'un document, renvoie son empreinte.
 */
export async function extractEmbeddedImages(project: Project, add: (blob: Blob, name: string) => Promise<string>): Promise<ConvertResult> {
  const r: ConvertResult = { converted: 0, keptInline: 0 };
  const convert = async (href: string, name: string): Promise<string> => {
    const blob = dataUrlToBlob(href);
    if (!blob) return href;
    try {
      const sha = await add(blob, name);
      r.converted++;
      return assetHref(sha);
    } catch {
      r.keptInline++;
      return href;
    }
  };
  for (const page of project.plan?.pages ?? [])
    for (const im of page.images ?? []) if (im.background && im.href.startsWith('data:')) im.href = await convert(im.href, `${page.name || 'plan'}.jpg`);
  for (const [id, layout] of Object.entries(project.boards ?? {})) if (layout?.photo?.href.startsWith('data:')) layout.photo.href = await convert(layout.photo.href, `tableau-${id}.jpg`);
  return r;
}

export type V1LossKind = 'pdfOriginal' | 'originalReplaced' | 'missing' | 'sourceDocument' | 'tooLarge';
export interface V1Loss {
  kind: V1LossKind;
  label: string;
}

/** Types qu'une ancienne version de Voltaplan affiche directement (image intégrée). */
const V1_IMAGE = /^image\/(jpeg|png|webp|gif)$/;

export interface V1Deps {
  /** Original (stockage de travail, archive, dossier) ; undefined si indisponible. */
  original(sha: string): Promise<Blob | undefined>;
  /** Image d'affichage dérivée (JPEG), régénérée si besoin ; undefined si impossible. */
  display(sha: string): Promise<Blob | undefined>;
}

/**
 * v2 → v1 : JSON lisible par les anciennes versions, et liste de ce qui ne peut pas être gardé. Le projet en
 * mémoire n'est pas modifié.
 */
export async function exportV1(project: Project, deps: V1Deps): Promise<{ json: string; losses: V1Loss[] }> {
  const p = JSON.parse(JSON.stringify(project)) as Project & { evidenceRaw?: unknown };
  p.format = FILE_FORMAT;
  p.version = 1;
  const losses: V1Loss[] = [];
  const cache = new Map<string, string | null>();
  const inline = async (href: string, label: string): Promise<string | null> => {
    const sha = assetShaOf(href);
    if (!sha) return href;
    if (cache.has(sha)) return cache.get(sha)!;
    let out: string | null = null;
    const orig = await deps.original(sha).catch(() => undefined);
    if (orig && V1_IMAGE.test(orig.type)) out = await blobToDataUrl(orig);
    else {
      const disp = await deps.display(sha).catch(() => undefined);
      if (disp) {
        out = await blobToDataUrl(disp, 'image/jpeg');
        losses.push({ kind: orig?.type === 'application/pdf' ? 'pdfOriginal' : 'originalReplaced', label });
      } else losses.push({ kind: 'missing', label });
    }
    cache.set(sha, out);
    return out;
  };
  const embedded = new Set<string>();
  for (const page of p.plan?.pages ?? []) {
    const kept: typeof page.images = [];
    for (const im of page.images ?? []) {
      const sha = assetShaOf(im.href);
      const h = await inline(im.href, page.name || page.id);
      if (h) {
        kept.push({ ...im, href: h });
        if (sha) embedded.add(sha);
      }
    }
    page.images = kept;
  }
  for (const [id, layout] of Object.entries(p.boards ?? {})) {
    if (!layout?.photo) continue;
    const sha = assetShaOf(layout.photo.href);
    const h = await inline(layout.photo.href, id);
    if (h) {
      layout.photo.href = h;
      if (sha) embedded.add(sha);
    } else delete layout.photo;
  }
  // Documents sources de l'assistant : le dossier de preuves reste dans le JSON, mais les documents eux-mêmes ne
  // peuvent pas être intégrés au format v1.
  for (const r of projectAssetRefs(project)) if (r.kind === 'source' && !embedded.has(r.sha256)) losses.push({ kind: 'sourceDocument', label: r.label });
  const json = JSON.stringify(p);
  if (json.length > IMPORT_LIMITS.project) losses.push({ kind: 'tooLarge', label: String(json.length) });
  return { json, losses };
}
