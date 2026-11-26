/**
 * Moteur OCR local (Tesseract en WebAssembly, tesseract.js), entièrement dans le navigateur ou l'application :
 * fichiers servis par Voltaplan (`ocr/<version>/`, voir tools/ocr/plugin.ts), aucune image envoyée, aucun service
 * tiers, fonctionne hors ligne après une première lecture. Chargé seulement quand on lance une lecture.
 */
import type { OcrWord } from './parse';

/** Version de tesseract.js livrée (dossier publié) ; vérifiée par un test contre le paquet installé. */
export const OCR_VERSION = '7.0.0';
const LANGS = ['fra', 'nld', 'eng'];

export interface OcrResult {
  text: string;
  words: OcrWord[];
  lines: string[];
  /** Taille de l'image analysée (après préparation), pour ramener les positions à l'original. */
  width: number;
  height: number;
  /** Facteur appliqué à l'original (analysée = original × scale). */
  scale: number;
}

type Progress = (fraction: number) => void;

let workerPromise: Promise<import('tesseract.js').Worker> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let onProgress: Progress | undefined;

function base(): string {
  return new URL(`ocr/${OCR_VERSION}/`, document.baseURI).href;
}

async function worker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, OEM } = await import('tesseract.js');
      return createWorker(LANGS, OEM.LSTM_ONLY, {
        workerPath: base() + 'worker.min.js',
        corePath: base() + 'core',
        langPath: base() + 'lang',
        workerBlobURL: false,
        gzip: true,
        // Les fichiers sont déjà gardés par le service worker (web) ou livrés avec l'application (bureau)
        cacheMethod: 'none',
        logger: (m) => {
          if (m.status === 'recognizing text' && onProgress) onProgress(m.progress);
        },
      });
    })();
    workerPromise.catch(() => (workerPromise = null));
  }
  return workerPromise;
}

/** Libère la mémoire (≈ 100 Mo) une minute après la dernière lecture. */
function scheduleRelease() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const w = workerPromise;
    workerPromise = null;
    void w?.then((x) => x.terminate()).catch(() => undefined);
  }, 60_000);
}

async function toBitmap(src: Blob | HTMLCanvasElement): Promise<CanvasImageSource & { width: number; height: number }> {
  if (src instanceof Blob) return createImageBitmap(src);
  return src;
}

/**
 * Image préparée pour l'OCR : niveaux de gris, contraste étiré, taille ramenée vers 2 400 px de côté (petites
 * images agrandies, grandes réduites) et rotation éventuelle (étiquettes verticales, plan photographié de travers).
 */
export async function prepareImage(src: Blob | HTMLCanvasElement, rotate: 0 | 90 | 270 = 0, target = 2400, stretch = true): Promise<{ canvas: HTMLCanvasElement; scale: number }> {
  const img = await toBitmap(src);
  const scale = Math.min(3, target / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = rotate ? h : w;
  canvas.height = rotate ? w : h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  if (rotate === 90) {
    ctx.translate(h, 0);
    ctx.rotate(Math.PI / 2);
  } else if (rotate === 270) {
    ctx.translate(0, w);
    ctx.rotate(-Math.PI / 2);
  }
  ctx.drawImage(img, 0, 0, w, h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) {
    const g = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
    px[i] = g;
    hist[Math.round(g)]++;
  }
  // Étirement du contraste entre les centiles 1 et 99
  const total = px.length / 4;
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255 && (acc += hist[lo]) < total * 0.01; lo++);
  for (let acc = 0; hi > 0 && (acc += hist[hi]) < total * 0.01; hi--);
  const span = stretch ? Math.max(1, hi - lo) : 255;
  if (!stretch) lo = 0;
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((px[i] - lo) * 255) / span));
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(data, 0, 0);
  if ('close' in img && typeof img.close === 'function') img.close();
  return { canvas, scale };
}

/** Lecture d'une image : texte, lignes et mots avec leur position (pixels de l'image préparée). */
export async function ocrImage(
  src: Blob | HTMLCanvasElement,
  opts: { rotate?: 0 | 90 | 270; sparse?: boolean; target?: number; stretch?: boolean; progress?: Progress } = {},
): Promise<OcrResult> {
  const { canvas, scale } = await prepareImage(src, opts.rotate ?? 0, opts.target, opts.stretch);
  const w = await worker();
  clearTimeout(idleTimer);
  onProgress = opts.progress;
  try {
    const { PSM } = await import('tesseract.js');
    await w.setParameters({ tessedit_pageseg_mode: opts.sparse === false ? PSM.AUTO : PSM.SPARSE_TEXT });
    const { data } = await w.recognize(canvas, {}, { text: true, blocks: true });
    const words: OcrWord[] = [];
    const lines: string[] = [];
    for (const b of data.blocks ?? [])
      for (const p of b.paragraphs)
        for (const l of p.lines) {
          if (l.text.trim()) lines.push(l.text.trim());
          for (const wd of l.words) if (wd.text.trim()) words.push({ text: wd.text, bbox: wd.bbox, confidence: wd.confidence });
        }
    return { text: data.text, words, lines, width: canvas.width, height: canvas.height, scale };
  } finally {
    onProgress = undefined;
    scheduleRelease();
  }
}
