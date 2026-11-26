/**
 * Import d'un fond de plan ou d'une photo de tableau : photo (JPG, PNG…), PDF (première page) ou plan DXF.
 *
 * Format v2 : le document ORIGINAL est gardé tel quel (stockage de travail, puis archive ou dossier du projet),
 * sous son empreinte SHA-256. Une image d'affichage (2 400 px maximum, JPEG) en est dérivée ; elle est
 * régénérable (`makeDisplayImage`) et n'est jamais la seule copie. Le projet référence l'original :
 * « asset:<sha256> ». Si le document ne peut pas être gardé (type non reconnu, stockage indisponible), l'image
 * réduite est intégrée au projet comme avant (data URL) : rien n'est perdu pour l'utilisateur.
 */
import { assetHref } from '../format/manifest';
import { isDxf, readDxf, renderDxf } from './dxf';
import { checkFileSize, checkImagePixels } from './limits';

const MAX_PX = 2400;

export interface RasterImage {
  href: string;
  /** Taille en pixels. */
  w: number;
  h: number;
  /** Largeur réelle de l'image en mm, quand le document la donne (DXF avec unité) : pas besoin de mise à l'échelle. */
  widthMm?: number | null;
}

function canvasToBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('image'))), 'image/jpeg', 0.85));
}

async function pdfFirstPage(data: Blob): Promise<HTMLCanvasElement> {
  return pdfPageCanvas(data, 1);
}

/** Page `n` (1…) d'un PDF, rendue en image (fond de plan d'une page de plan d'un dossier PDF repris). */
export async function pdfPageImage(data: Blob, n: number): Promise<string> {
  return (await pdfPageCanvas(data, n)).toDataURL('image/jpeg', 0.85);
}

async function pdfPageCanvas(data: Blob, n: number): Promise<HTMLCanvasElement> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await data.arrayBuffer()) }).promise;
  try {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const scale = MAX_PX / Math.max(base.width, base.height);
    const vp = page.getViewport({ scale });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width);
    c.height = Math.round(vp.height);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return c;
  } finally {
    await doc.destroy();
  }
}

async function photo(data: Blob, name: string): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(data);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    checkImagePixels(name, img.naturalWidth, img.naturalHeight);
    const k = Math.min(1, MAX_PX / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function dxfCanvas(data: Blob) {
  return renderDxf(readDxf(await data.text()), MAX_PX);
}

const isPdf = (b: { name?: string; type?: string }) => (b.name ? /\.pdf$/i.test(b.name) : false) || b.type === 'application/pdf';

/** Image d'affichage (JPEG réduit) d'un original : régénération à la demande (src/format/session.ts). */
export async function makeDisplayImage(original: Blob): Promise<Blob> {
  return canvasToBlob(isPdf(original) ? await pdfFirstPage(original) : await photo(original, 'image'));
}

export async function readBackground(file: File): Promise<RasterImage> {
  const pdf = isPdf(file);
  const dxf = isDxf(file);
  // Taille vérifiée avant toute lecture
  checkFileSize(file, dxf ? 'dxf' : pdf ? 'pdf' : 'image');
  let widthMm: number | null = null;
  let c: HTMLCanvasElement;
  if (dxf) ({ canvas: c, widthMm } = await dxfCanvas(file));
  else c = pdf ? await pdfFirstPage(file) : await photo(file, file.name);
  const display = await canvasToBlob(c);
  try {
    const { assetSession } = await import('./projectData');
    // DXF : le format de projet ne garde que des images et des PDF ; l'original gardé est le dessin rendu (PNG net)
    const original = dxf ? await new Promise<Blob>((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error('image'))), 'image/png')) : file;
    const meta = await assetSession.store.add(original, { name: dxf ? file.name + '.png' : file.name });
    await assetSession.store.putDerived(meta.sha256, 'display', display).catch(() => undefined);
    return { href: assetHref(meta.sha256), w: c.width, h: c.height, widthMm };
  } catch {
    // Original impossible à garder : image réduite intégrée au projet (comportement du format v1)
    return { href: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height, widthMm };
  }
}
