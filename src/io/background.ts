/**
 * Import d'un fond de plan : photo (JPG, PNG…) ou PDF (première page).
 * L'image est réduite (2400 px max) et enregistrée dans le projet en JPEG, pour garder des fichiers légers.
 */
import { checkFileSize, checkImagePixels } from './limits';

const MAX_PX = 2400;

export interface RasterImage {
  href: string;
  /** Taille en pixels. */
  w: number;
  h: number;
}

function canvasToImage(c: HTMLCanvasElement): RasterImage {
  return { href: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height };
}

async function pdfFirstPage(file: File): Promise<RasterImage> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
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
  await doc.destroy();
  return canvasToImage(c);
}

async function photo(file: File): Promise<RasterImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    checkImagePixels(file.name, img.naturalWidth, img.naturalHeight);
    const k = Math.min(1, MAX_PX / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return canvasToImage(c);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function readBackground(file: File): Promise<RasterImage> {
  const pdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
  // Taille vérifiée avant toute lecture
  checkFileSize(file, pdf ? 'pdf' : 'image');
  return pdf ? pdfFirstPage(file) : photo(file);
}
