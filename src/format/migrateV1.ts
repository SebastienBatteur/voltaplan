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
import { ASSET_SCHEME, assetShaOf, assetHref } from './manifest';
import { projectAssetRefs } from './projectFile';
import { blobBytes, sha256Hex } from './sha256';

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
export async function extractEmbeddedImages(project: Project, add: (blob: Blob, name: string) => Promise<string>, skip?: WeakSet<object>): Promise<ConvertResult> {
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
    for (const im of page.images ?? []) if (im.background && im.href.startsWith('data:') && !skip?.has(im)) im.href = await convert(im.href, `${page.name || 'plan'}.jpg`);
  for (const [id, layout] of Object.entries(project.boards ?? {})) if (layout?.photo?.href.startsWith('data:') && !skip?.has(layout.photo)) layout.photo.href = await convert(layout.photo.href, `tableau-${id}.jpg`);
  return r;
}

// ---------------------------------------------------------------------------
// Lecture d'un gros fichier v1 à mémoire réduite
// ---------------------------------------------------------------------------

/** Taille d'une tranche lue du fichier v1. */
export const V1_SCAN_CHUNK = 4 * 1024 * 1024;

const ASCII = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const DATA_MARK = ASCII('"data:image/');
/** Longueur maximale de l'en-tête « data:image/…;base64, » reconnu. */
const HEADER_MAX = 128;
const B64 = (() => {
  const t = new Int8Array(256).fill(-1);
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < abc.length; i++) t[abc.charCodeAt(i)] = i;
  return t;
})();

/** Images intégrées extraites d'un fichier v1 : empreinte → contenu décodé (type MIME déclaré). */
export type ExtractedImages = Map<string, Blob>;

/** Contenu inattendu (échappement \u, caractère hors base64…) : lecture habituelle (repli). */
class ScanBail extends Error {}

/** Bloc de sortie du décodeur : multiple de 3 (les octets sont écrits par groupes de 3). */
const B64_BLOCK = 3 << 18;

/** Décodeur base64 incrémental, par blocs de 768 Kio (jamais de chaîne intermédiaire). */
class B64Decoder {
  private parts: Uint8Array<ArrayBuffer>[] = [];
  private block: Uint8Array<ArrayBuffer> = new Uint8Array(B64_BLOCK);
  private pos = 0;
  private acc = 0;
  private n = 0;
  private padded = false;
  private put(byte: number) {
    if (this.pos === this.block.length) this.next();
    this.block[this.pos++] = byte;
  }
  private next() {
    this.parts.push(this.block);
    this.block = new Uint8Array(B64_BLOCK);
    this.pos = 0;
  }
  /** Décode les caractères base64 à partir de `i` ; s'arrête au premier autre caractère (renvoie sa position). */
  run(buf: Uint8Array, i: number): number {
    let { acc, n, pos, block } = this;
    const len = buf.length;
    for (; i < len; i++) {
      const v = B64[buf[i]];
      if (v < 0) break;
      if (this.padded) throw new ScanBail();
      acc = (acc << 6) | v;
      if (++n === 4) {
        if (pos === block.length) {
          this.block = block;
          this.pos = pos;
          this.next();
          block = this.block;
          pos = 0;
        }
        block[pos++] = (acc >> 16) & 0xff;
        block[pos++] = (acc >> 8) & 0xff;
        block[pos++] = acc & 0xff;
        acc = 0;
        n = 0;
      }
    }
    this.acc = acc;
    this.n = n;
    this.pos = pos;
    this.block = block;
    return i;
  }
  pad() {
    this.padded = true;
  }
  push(ch: number) {
    this.run(Uint8Array.of(ch), 0);
  }
  finish(type: string): Blob {
    if (this.n === 1) throw new ScanBail();
    if (this.n === 2) this.put((this.acc >> 4) & 0xff);
    if (this.n === 3) {
      this.put((this.acc >> 10) & 0xff);
      this.put((this.acc >> 2) & 0xff);
    }
    const blob = new Blob([...this.parts, this.block.subarray(0, this.pos)], { type });
    this.parts = [];
    return blob;
  }
}

function indexOfBytes(buf: Uint8Array, pat: Uint8Array, from: number): number {
  const first = pat[0];
  for (let i = buf.indexOf(first, from); i !== -1 && i <= buf.length - pat.length; i = buf.indexOf(first, i + 1)) {
    let k = 1;
    while (k < pat.length && buf[i + k] === pat[k]) k++;
    if (k === pat.length) return i;
  }
  return -1;
}

/**
 * Lecture d'un fichier v1 (JSON) à mémoire réduite : le fichier est lu par tranches de 4 Mo ; chaque image intégrée
 * en base64 (`"data:image/…;base64,…"`) est décodée au fil de la lecture directement en `Blob`, sans jamais créer
 * la chaîne base64 ni le texte complet, et remplacée dans le texte par « asset:<sha256> ». Le texte qui reste (le
 * modèle sans ses images) est petit. Avant : texte complet + objet lu + copies décodées en même temps (plusieurs
 * fois la taille du fichier).
 *
 * Renvoie null si le contenu sort de ce cas simple (échappement \uXXXX, caractère hors base64…) : l'appelant
 * revient alors à la lecture habituelle (même résultat, plus de mémoire). Les images extraites qui ne sont ni des
 * fonds de plan ni des photos de tableau sont réintégrées ensuite (`placeExtractedImages`).
 */
export async function scanV1(file: Blob, chunk = V1_SCAN_CHUNK): Promise<{ text: string; images: ExtractedImages } | null> {
  const out: Uint8Array[] = [];
  let outSize = 0;
  /** Dernier octet recopié (guillemet échappé à cheval sur deux tranches). */
  let prev = -1;
  const emit = (b: Uint8Array) => {
    if (!b.length) return;
    out.push(b.slice());
    outSize += b.length;
    prev = b[b.length - 1];
  };
  const images: ExtractedImages = new Map();
  let mode: 'out' | 'header' | 'b64' = 'out';
  let dec: B64Decoder | null = null;
  let mime = '';
  let carry = new Uint8Array(0);
  try {
    for (let off = 0; off < file.size || carry.length; off += chunk) {
      const last = off + chunk >= file.size;
      const piece = off < file.size ? new Uint8Array(await file.slice(off, off + chunk).arrayBuffer()) : new Uint8Array(0);
      let buf: Uint8Array = piece;
      if (carry.length) {
        buf = new Uint8Array(carry.length + piece.length);
        buf.set(carry);
        buf.set(piece, carry.length);
      }
      carry = new Uint8Array(0);
      let i = 0;
      scan: while (i < buf.length) {
        if (mode === 'out') {
          const at = indexOfBytes(buf, DATA_MARK, i);
          if (at === -1) {
            // Fin de tranche : on garde de quoi reconnaître une marque coupée en deux
            const keep = last ? 0 : Math.min(DATA_MARK.length - 1, buf.length - i);
            emit(buf.subarray(i, buf.length - keep));
            carry = buf.slice(buf.length - keep);
            break;
          }
          // Guillemet échappé (« \"data:image/ » à l'intérieur d'un texte) : pas une valeur, recopié tel quel
          const before = at > 0 ? buf[at - 1] : prev;
          emit(buf.subarray(i, at));
          if (before === 0x5c) {
            emit(buf.subarray(at, at + 1));
            i = at + 1;
            continue;
          }
          i = at;
          mode = 'header';
        } else if (mode === 'header') {
          const end = Math.min(buf.length, i + HEADER_MAX);
          const comma = buf.subarray(i, end).indexOf(0x2c);
          if (comma === -1) {
            if (end === buf.length && !last) {
              carry = buf.slice(i);
              break;
            }
            // Pas une image intégrée reconnue : recopiée telle quelle
            emit(buf.subarray(i, i + 1));
            i++;
            mode = 'out';
            continue;
          }
          const header = String.fromCharCode(...buf.subarray(i + 1, i + comma));
          const m = /^data:(image\/[a-z0-9.+-]+)(?:;[a-z0-9=.+-]+)*?;base64$/i.exec(header);
          if (!m) {
            emit(buf.subarray(i, i + comma + 1));
            i += comma + 1;
            mode = 'out';
            continue;
          }
          mime = m[1].toLowerCase();
          dec = new B64Decoder();
          i += comma + 1;
          mode = 'b64';
        } else {
          const d = dec!;
          for (; i < buf.length; i++) {
            i = d.run(buf, i);
            if (i >= buf.length) break;
            const c = buf[i];
            if (c === 0x22) {
              // Fin de l'image : décodée, identifiée par son empreinte, remplacée par une référence
              const blob = d.finish(mime);
              dec = null;
              const sha = await sha256Hex(blob);
              if (!images.has(sha)) images.set(sha, blob);
              emit(ASCII(`"${assetHref(sha)}"`));
              i++;
              mode = 'out';
              continue scan;
            }
            if (c === 0x5c) {
              if (i + 1 >= buf.length) {
                if (last) throw new ScanBail();
                carry = buf.slice(i);
                break scan;
              }
              const e = buf[++i];
              if (e === 0x2f) d.push(0x2f); // « \/ »
              else if (e !== 0x6e && e !== 0x72 && e !== 0x74) throw new ScanBail(); // \n \r \t ignorés (comme atob)
              continue;
            }
            if (c === 0x3d) d.pad();
            else if (c !== 0x20) throw new ScanBail(); // caractère hors base64 : lecture habituelle
          }
        }
      }
      if (last && !carry.length) break;
    }
    if (mode !== 'out') throw new ScanBail();
  } catch (e) {
    if (e instanceof ScanBail) return null;
    throw e;
  }
  const all = new Uint8Array(outSize);
  let p = 0;
  for (const b of out.splice(0)) {
    all.set(b, p);
    p += b.length;
  }
  return { text: decodeV1Text(all), images };
}

/** Texte UTF-8, sinon Windows-1252 (comme src/io/projectData.ts decodeText). */
function decodeV1Text(buf: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}

/**
 * Après `scanV1` et la lecture du modèle : les fonds de plan et photos de tableau extraits sont rangés dans le
 * stockage de travail (`add`) ; toute autre référence à une image extraite (meubles Trikker, autres champs) est
 * réintégrée en base64, comme avant. Un rangement impossible (type non reconnu, stockage plein) réintègre l'image :
 * rien n'est perdu. `tried` : images déjà traitées (à ne pas retenter avec extractEmbeddedImages).
 */
export async function placeExtractedImages(project: Project, images: ExtractedImages, add: (blob: Blob, name: string) => Promise<string>): Promise<ConvertResult & { tried: WeakSet<object> }> {
  const placed = new WeakSet<object>();
  const r = { converted: 0, keptInline: 0, tried: placed };
  if (!images.size) return r;
  const inline = new Map<string, string>();
  const asInline = async (sha: string) => {
    let s = inline.get(sha);
    if (s === undefined) {
      const b = images.get(sha)!;
      s = await blobToDataUrl(b, b.type);
      inline.set(sha, s);
    }
    return s;
  };
  const store = async (holder: { href: string }, name: string) => {
    const sha = assetShaOf(holder.href);
    const blob = sha ? images.get(sha) : undefined;
    if (!sha || !blob) return;
    try {
      const got = await add(blob, name);
      holder.href = assetHref(got);
      r.converted++;
    } catch {
      holder.href = await asInline(sha);
      r.keptInline++;
    }
    placed.add(holder);
  };
  for (const page of project.plan?.pages ?? []) for (const im of page.images ?? []) if (im.background) await store(im, `${page.name || 'plan'}.jpg`);
  for (const [id, layout] of Object.entries(project.boards ?? {})) if (layout?.photo) await store(layout.photo, `tableau-${id}.jpg`);
  // Toute autre place : image réintégrée telle qu'elle était
  const walk = async (v: unknown): Promise<void> => {
    if (!v || typeof v !== 'object') return;
    const o = v as Record<string, unknown>;
    for (const k of Object.keys(o)) {
      const x = o[k];
      if (typeof x === 'string') {
        const sha = x.startsWith(ASSET_SCHEME) ? assetShaOf(x) : null;
        if (sha && images.has(sha) && !(k === 'href' && placed.has(o))) o[k] = await asInline(sha);
      } else await walk(x);
    }
  };
  await walk(project);
  images.clear();
  return r;
}

export type V1LossKind ='pdfOriginal' | 'originalReplaced' | 'missing' | 'sourceDocument' | 'tooLarge';
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
