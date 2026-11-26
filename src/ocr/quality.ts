/**
 * Qualité d'une photo pour la lecture (OCR ou IA) : raison et solution à afficher quand il faut refaire la photo.
 *
 * Mesures sur l'image réduite à 1 200 px de côté (niveaux de gris) ; seuils réglés sur 18 vraies photos de
 * compteurs, tableaux et plans (26/11/2026) : les photos lues correctement ont une netteté (variance du laplacien)
 * de 140 à 2 000, une luminosité moyenne de 75 à 170, moins de 1 % de pixels brûlés. Une photo n'est déclarée
 * insuffisante que si la lecture a échoué ou est incomplète, ou si une mesure est franchement mauvaise : une photo
 * un peu sombre mais bien lue ne déclenche aucun message.
 */

export interface PhotoMetrics {
  /** Plus petit côté de la photo d'origine (pixels). */
  minSide: number;
  /** Luminosité moyenne (0–255). */
  mean: number;
  /** Écart entre les centiles 5 et 95 (contraste). */
  spread: number;
  /** Part de pixels brûlés (≥ 250), 0–1 : reflets, flash. */
  glare: number;
  /** Netteté : variance du laplacien. */
  sharpness: number;
}

/** `framing` : photo correcte mais rien trouvé (plaque ou texte trop petit dans l'image, ou hors champ). */
export type QualityIssue = 'small' | 'dark' | 'glare' | 'blur' | 'lowContrast' | 'framing';

/** Mesures à partir d'une image en niveaux de gris (déjà réduite vers 1 200 px). */
export function measureGray(gray: Uint8Array | Uint8ClampedArray, w: number, h: number, minSide: number): PhotoMetrics {
  const n = w * h;
  const hist = new Uint32Array(256);
  let sum = 0;
  let burnt = 0;
  for (let i = 0; i < n; i++) {
    const v = gray[i];
    hist[v]++;
    sum += v;
    if (v >= 250) burnt++;
  }
  const pct = (q: number) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) if ((acc += hist[v]) >= n * q) return v;
    return 255;
  };
  let s1 = 0;
  let s2 = 0;
  let m = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w] - 4 * gray[i];
      s1 += l;
      s2 += l * l;
      m++;
    }
  const lapMean = m ? s1 / m : 0;
  return { minSide, mean: n ? sum / n : 0, spread: pct(0.95) - pct(0.05), glare: n ? burnt / n : 0, sharpness: m ? s2 / m - lapMean * lapMean : 0 };
}

/**
 * Problèmes de la photo, du plus probable au moins probable.
 * @param readFailed la lecture n'a rien donné d'utile (ou est incomplète) : les seuils « tolérants » s'appliquent.
 */
export function qualityIssues(q: PhotoMetrics, readFailed: boolean): QualityIssue[] {
  const out: QualityIssue[] = [];
  const strict = !readFailed;
  if (q.minSide < (strict ? 600 : 1000)) out.push('small');
  if (q.glare > (strict ? 0.1 : 0.03)) out.push('glare');
  if (q.mean < (strict ? 45 : 70)) out.push('dark');
  if (q.sharpness < (strict ? 60 : 160)) out.push('blur');
  if (q.spread < (strict ? 40 : 70)) out.push('lowContrast');
  if (readFailed && !out.length) out.push('framing');
  return out;
}

/** Mesures d'une photo (navigateur). */
export async function measurePhoto(photo: Blob): Promise<PhotoMetrics> {
  const bmp = await createImageBitmap(photo);
  const minSide = Math.min(bmp.width, bmp.height);
  const k = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k));
  const h = Math.max(1, Math.round(bmp.height * k));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const d = ctx.getImageData(0, 0, w, h).data;
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++) gray[i] = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000;
  return measureGray(gray, w, h, minSide);
}
