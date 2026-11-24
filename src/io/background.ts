/**
 * Import d'un fond de plan ou d'une photo de tableau : photo (JPG, PNG…) ou PDF (première page).
 *
 * Format v2 : le document ORIGINAL est gardé tel quel (stockage de travail, puis archive ou dossier du projet),
 * sous son empreinte SHA-256. Une image d'affichage (2 400 px maximum, JPEG) en est dérivée ; elle est
 * régénérable (`makeDisplayImage`) et n'est jamais la seule copie. Le projet référence l'original :
 * « asset:<sha256> ». Si le document ne peut pas être gardé (type non reconnu, stockage indisponible), l'image
 * réduite est intégrée au projet comme avant (data URL) : rien n'est perdu pour l'utilisateur.
 */
import { assetHref } from '../format/manifest';
import { checkFileSize, checkImagePixels } from './limits';

const MAX_PX = 2400;

export interface RasterImage {
  href: string;
  /** Taille en pixels. */
  w: number;
  h: number;
}

function canvasToBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('image'))), 'image/jpeg', 0.85));
}

async function pdfFirstPage(data: Blob): Promise<HTMLCanvasElement> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await data.arrayBuffer()) }).promise;
  try {
    const page = await doc.getPage(1);
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

const isPdf = (b: { name?: string; type?: string }) => (b.name ? /\.pdf$/i.test(b.name) : false) || b.type === 'application/pdf';

/** Image d'affichage (JPEG réduit) d'un original : régénération à la demande (src/format/session.ts). */
export async function makeDisplayImage(original: Blob): Promise<Blob> {
  return canvasToBlob(isPdf(original) ? await pdfFirstPage(original) : await photo(original, 'image'));
}

export async function readBackground(file: File): Promise<RasterImage> {
  const pdf = isPdf(file);
  // Taille vérifiée avant toute lecture
  checkFileSize(file, pdf ? 'pdf' : 'image');
  const c = pdf ? await pdfFirstPage(file) : await photo(file, file.name);
  const display = await canvasToBlob(c);
  try {
    const { assetSession } = await import('./projectData');
    const meta = await assetSession.store.add(file, { name: file.name });
    await assetSession.store.putDerived(meta.sha256, 'display', display).catch(() => undefined);
    return { href: assetHref(meta.sha256), w: c.width, h: c.height };
  } catch {
    // Original impossible à garder : image réduite intégrée au projet (comportement du format v1)
    return { href: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height };
  }
}
