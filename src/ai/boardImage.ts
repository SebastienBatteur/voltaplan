/**
 * Image envoyée à l'IA pour lire un tableau : au lieu de la photo brute (plusieurs Mo, rangées à trouver,
 * modules à compter), une image composée à partir du calage, petite et sans ambiguïté :
 *  - une bande par rangée, redressée (horizontale) et mise à l'échelle : un module = MOD_PX pixels ;
 *  - au-dessus de chaque bande, une règle qui numérote les modules 0, 1, 2… de la rangée.
 * L'IA lit donc directement la position de chaque appareil sur la règle.
 */
import type { Pt } from '../model/types';

/** Largeur d'un module dans l'image composée (pixels). */
export const MOD_PX = 56;
/** Hauteur d'un appareil modulaire, en modules (85 mm / 17,5 mm), et de la bande autour (étiquettes comprises). */
const BAND_MODULES = 1.5 * (85 / 17.5);
const RULER_PX = 24;

export interface ComposedGeometry {
  width: number;
  height: number;
  /** Marge à gauche et à droite de la rangée (pixels), pour voir les bords des appareils extrêmes. */
  margin: number;
  rowTop: number[];
  bandTop: number[];
  bandH: number;
  /** Pour chaque rangée : échelle (px composés par px photo) et angle (radians) de la rangée sur la photo. */
  rows: { a: Pt; scale: number; angle: number }[];
}

export function composedGeometry(rows: { a: Pt; b: Pt }[], perRow: number): ComposedGeometry {
  const margin = MOD_PX / 2;
  const bandH = Math.round(BAND_MODULES * MOD_PX);
  const width = perRow * MOD_PX + 2 * margin;
  const rowTop: number[] = [];
  const bandTop: number[] = [];
  rows.forEach((_, i) => {
    rowTop.push(i * (RULER_PX + bandH));
    bandTop.push(i * (RULER_PX + bandH) + RULER_PX);
  });
  return {
    width,
    height: rows.length * (RULER_PX + bandH),
    margin,
    rowTop,
    bandTop,
    bandH,
    rows: rows.map(({ a, b }) => ({ a, scale: (perRow * MOD_PX) / Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), angle: Math.atan2(b.y - a.y, b.x - a.x) })),
  };
}

/** Image composée (JPEG, data URL) à partir de la photo et du calage de chaque rangée. */
export async function composeBoardImage(href: string, rows: { a: Pt; b: Pt }[], perRow: number): Promise<string> {
  const img = new Image();
  img.src = href;
  await img.decode();
  const g = composedGeometry(rows, perRow);
  const c = document.createElement('canvas');
  c.width = g.width;
  c.height = g.height;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  g.rows.forEach((r, i) => {
    // Bande redressée : le point a de la rangée arrive au bord gauche, au milieu de la bande
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, g.bandTop[i], g.width, g.bandH);
    ctx.clip();
    ctx.translate(g.margin, g.bandTop[i] + g.bandH / 2);
    ctx.scale(r.scale, r.scale);
    ctx.rotate(-r.angle);
    ctx.translate(-r.a.x, -r.a.y);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
    // Règle : traits aux limites des modules, numéro au milieu de chaque module
    const top = g.rowTop[i];
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, top, g.width, RULER_PX);
    ctx.strokeStyle = '#d00';
    ctx.fillStyle = '#d00';
    ctx.lineWidth = 1;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let k = 0; k <= perRow; k++) {
      const x = g.margin + k * MOD_PX + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, top + 2);
      ctx.lineTo(x, top + RULER_PX + 6);
      ctx.stroke();
      if (k < perRow) ctx.fillText(String(k), x + MOD_PX / 2, top + RULER_PX / 2 + 1);
    }
  });
  return c.toDataURL('image/jpeg', 0.88);
}

/** Sans calage : la photo réduite (côté le plus long ≤ 1600 px). */
export async function shrinkPhoto(href: string, maxSide = 1600): Promise<string> {
  const img = new Image();
  img.src = href;
  await img.decode();
  const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.88);
}
