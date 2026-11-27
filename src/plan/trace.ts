/**
 * Reconnaissance d'un plan photographié, sans IA :
 *  1. redressement : 4 coins cliqués d'un rectangle connu (ex. façades) → image vue de face et à l'échelle ;
 *  2. détection des murs : zones foncées et épaisses, horizontales ou verticales.
 * Fonctions pures sur des tableaux de pixels (testées sans navigateur).
 */
import type { Pt } from '../model/types';
import { I18nError } from '../i18n/error';

export interface Gray {
  w: number;
  h: number;
  /** Niveaux de gris 0 (noir) … 255 (blanc), ligne par ligne. */
  d: Uint8Array;
}

export interface RGBA {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

/** Matrice 3×3 en ligne : [a b c d e f g h 1]. */
export type Mat3 = number[];

/** Homographie qui envoie src[i] sur dst[i] (4 points). */
export function homography(src: Pt[], dst: Pt[]): Mat3 {
  // Système 8×8 (méthode DLT avec h33 = 1)
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solve(A, b);
  return [...h, 1];
}

function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const piv = M[c][c];
    if (Math.abs(piv) < 1e-12) throw new I18nError('imp.trace.aligned', undefined, 'Points alignés : impossible de redresser.');
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / piv;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

export function applyH(H: Mat3, p: Pt): Pt {
  const w = H[6] * p.x + H[7] * p.y + H[8];
  return { x: (H[0] * p.x + H[1] * p.y + H[2]) / w, y: (H[3] * p.x + H[4] * p.y + H[5]) / w };
}

export function invert3(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}

/**
 * Redressement : `corners` = 4 coins dans l'image source (haut-gauche, haut-droit, bas-droit, bas-gauche),
 * `rectPx` = taille voulue du rectangle redressé en pixels. Renvoie l'image redressée (avec une marge
 * autour du rectangle) et la position du coin haut-gauche du rectangle dans cette image.
 */
export function rectify(src: RGBA, corners: Pt[], rectPx: { w: number; h: number }, marginPx: number): { img: RGBA; origin: Pt } {
  const W = Math.round(rectPx.w + 2 * marginPx);
  const H = Math.round(rectPx.h + 2 * marginPx);
  const m = marginPx;
  const dst = [
    { x: m, y: m },
    { x: m + rectPx.w, y: m },
    { x: m + rectPx.w, y: m + rectPx.h },
    { x: m, y: m + rectPx.h },
  ];
  // Pour chaque pixel de sortie, on cherche le pixel source (homographie inverse) avec interpolation bilinéaire.
  const back = homography(dst, corners);
  const out = new Uint8ClampedArray(W * H * 4);
  const sd = src.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = applyH(back, { x: x + 0.5, y: y + 0.5 });
      const sx = p.x - 0.5;
      const sy = p.y - 0.5;
      const o = (y * W + x) * 4;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 >= src.w - 1 || y0 >= src.h - 1) {
        out[o] = out[o + 1] = out[o + 2] = 255;
        out[o + 3] = 255;
        continue;
      }
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * src.w + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + src.w * 4;
      const i11 = i01 + 4;
      for (let k = 0; k < 3; k++)
        out[o + k] = (sd[i00 + k] * (1 - fx) + sd[i10 + k] * fx) * (1 - fy) + (sd[i01 + k] * (1 - fx) + sd[i11 + k] * fx) * fy;
      out[o + 3] = 255;
    }
  }
  return { img: { w: W, h: H, data: out }, origin: { x: m, y: m } };
}

export function toGray(img: RGBA): Gray {
  const d = new Uint8Array(img.w * img.h);
  for (let i = 0, j = 0; i < d.length; i++, j += 4) d[i] = (img.data[j] * 299 + img.data[j + 1] * 587 + img.data[j + 2] * 114) / 1000;
  return { w: img.w, h: img.h, d };
}

/**
 * Masque des pixels foncés, avec un seuil local (moyenne de la fenêtre × `ratio`),
 * pour supporter l'éclairage inégal d'une photo.
 */
export function darkMask(g: Gray, win: number, ratio = 0.78): Uint8Array {
  const { w, h, d } = g;
  const S = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += d[y * w + x];
      S[(y + 1) * (w + 1) + x + 1] = S[y * (w + 1) + x + 1] + row;
    }
  }
  const r = Math.max(1, Math.floor(win / 2));
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w, x + r + 1);
      const sum = S[y1 * (w + 1) + x1] - S[y0 * (w + 1) + x1] - S[y1 * (w + 1) + x0] + S[y0 * (w + 1) + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      m[y * w + x] = d[y * w + x] < mean * ratio ? 1 : 0;
    }
  }
  return m;
}

/** Érosion puis dilatation par un carré de côté 2r+1 : efface les traits plus fins que 2r+1 pixels. */
export function opening(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const er = morph(morph(mask, w, h, r, true, true), w, h, r, false, true);
  return morph(morph(er, w, h, r, true, false), w, h, r, false, false);
}

/** Passe 1D (horizontale si `horiz`) d'érosion (`erode`) ou de dilatation. */
function morph(m: Uint8Array, w: number, h: number, r: number, horiz: boolean, erode: boolean): Uint8Array {
  const out = new Uint8Array(w * h);
  const n = horiz ? w : h;
  const lines = horiz ? h : w;
  const at = (line: number, i: number) => (horiz ? line * w + i : i * w + line);
  for (let L = 0; L < lines; L++) {
    // Nombre de 1 dans la fenêtre glissante
    let cnt = 0;
    for (let i = 0; i < Math.min(r, n); i++) cnt += m[at(L, i)];
    for (let i = 0; i < n; i++) {
      if (i + r < n) cnt += m[at(L, i + r)];
      if (i - r - 1 >= 0) cnt -= m[at(L, i - r - 1)];
      const size = Math.min(n - 1, i + r) - Math.max(0, i - r) + 1;
      out[at(L, i)] = erode ? (cnt === size ? 1 : 0) : cnt > 0 ? 1 : 0;
    }
  }
  return out;
}

export interface WallPx {
  a: Pt;
  b: Pt;
  thickness: number;
}

/**
 * Murs horizontaux et verticaux d'un masque : un pixel appartient à un mur horizontal si la plage foncée
 * qui le contient est longue horizontalement (≥ minLen) et mince verticalement (≤ maxThick), et inversement.
 * Chaque groupe de pixels donne un rectangle → un mur (axe, épaisseur).
 */
export function extractWalls(mask: Uint8Array, w: number, h: number, minLen: number, maxThick: number): WallPx[] {
  const hRun = runs(mask, w, h, true);
  const vRun = runs(mask, w, h, false);
  const walls: WallPx[] = [];
  for (const horiz of [true, false]) {
    const sel = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      if (!mask[i]) continue;
      const along = horiz ? hRun[i] : vRun[i];
      const across = horiz ? vRun[i] : hRun[i];
      if (along >= minLen && across <= maxThick) sel[i] = 1;
    }
    for (const box of components(sel, w, h)) {
      const len = horiz ? box.x1 - box.x0 + 1 : box.y1 - box.y0 + 1;
      const th = horiz ? box.y1 - box.y0 + 1 : box.x1 - box.x0 + 1;
      if (len < minLen || th > maxThick || len < th * 2) continue;
      if (horiz) {
        const y = (box.y0 + box.y1 + 1) / 2;
        walls.push({ a: { x: box.x0, y }, b: { x: box.x1 + 1, y }, thickness: th });
      } else {
        const x = (box.x0 + box.x1 + 1) / 2;
        walls.push({ a: { x, y: box.y0 }, b: { x, y: box.y1 + 1 }, thickness: th });
      }
    }
  }
  return joinWalls(mergeCollinear(walls, maxThick), maxThick);
}

/** Longueur de la plage de 1 qui contient chaque pixel (horizontale ou verticale). */
function runs(m: Uint8Array, w: number, h: number, horiz: boolean): Uint16Array {
  const out = new Uint16Array(w * h);
  const n = horiz ? w : h;
  const lines = horiz ? h : w;
  const at = (L: number, i: number) => (horiz ? L * w + i : i * w + L);
  for (let L = 0; L < lines; L++) {
    let i = 0;
    while (i < n) {
      if (!m[at(L, i)]) {
        i++;
        continue;
      }
      let j = i;
      while (j < n && m[at(L, j)]) j++;
      const len = Math.min(j - i, 65535);
      for (let k = i; k < j; k++) out[at(L, k)] = len;
      i = j;
    }
  }
  return out;
}

/** Boîtes englobantes des composantes connexes (4-voisinage). */
function components(m: Uint8Array, w: number, h: number): { x0: number; y0: number; x1: number; y1: number }[] {
  const seen = new Uint8Array(w * h);
  const out: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const stack: number[] = [];
  for (let s = 0; s < w * h; s++) {
    if (!m[s] || seen[s]) continue;
    let x0 = w;
    let y0 = h;
    let x1 = 0;
    let y1 = 0;
    stack.push(s);
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w;
      const y = (i - x) / w;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const j of nb)
        if (j >= 0 && m[j] && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
    }
    out.push({ x0, y0, x1, y1 });
  }
  return out;
}

/**
 * Réunit les morceaux d'un même mur coupés par une jonction (cloison en T) :
 * même axe, même épaisseur (à 2 px près), écart ≤ `gap`.
 */
function mergeCollinear(walls: WallPx[], gap: number): WallPx[] {
  const out: WallPx[] = [];
  for (const horiz of [true, false]) {
    const list = walls
      .filter((w) => (w.a.y === w.b.y) === horiz)
      .map((w) => ({ axis: horiz ? w.a.y : w.a.x, s: horiz ? w.a.x : w.a.y, e: horiz ? w.b.x : w.b.y, t: w.thickness }))
      .sort((p, q) => p.axis - q.axis || p.s - q.s);
    const used = new Array(list.length).fill(false);
    for (let i = 0; i < list.length; i++) {
      if (used[i]) continue;
      const cur = { ...list[i] };
      used[i] = true;
      let grew = true;
      while (grew) {
        grew = false;
        for (let j = 0; j < list.length; j++) {
          if (used[j]) continue;
          const o = list[j];
          if (Math.abs(o.axis - cur.axis) <= 2 && Math.abs(o.t - cur.t) <= 2 && o.s <= cur.e + gap && o.e >= cur.s - gap) {
            cur.s = Math.min(cur.s, o.s);
            cur.e = Math.max(cur.e, o.e);
            used[j] = true;
            grew = true;
          }
        }
      }
      out.push(
        horiz
          ? { a: { x: cur.s, y: cur.axis }, b: { x: cur.e, y: cur.axis }, thickness: cur.t }
          : { a: { x: cur.axis, y: cur.s }, b: { x: cur.axis, y: cur.e }, thickness: cur.t },
      );
    }
  }
  return out;
}

/** Prolonge les extrémités des murs jusqu'à l'axe du mur perpendiculaire voisin (angles et jonctions en T). */
function joinWalls(walls: WallPx[], reach: number): WallPx[] {
  const isH = (w: WallPx) => w.a.y === w.b.y;
  return walls.map((w) => {
    const out = { a: { ...w.a }, b: { ...w.b }, thickness: w.thickness };
    for (const end of ['a', 'b'] as const) {
      const p = out[end];
      let best: number | null = null;
      let bd = reach;
      for (const o of walls) {
        if (o === w || isH(o) === isH(w)) continue;
        if (isH(w)) {
          // mur vertical o : axe x = o.a.x, couvre y entre o.a.y et o.b.y
          const inside = p.y >= Math.min(o.a.y, o.b.y) - o.thickness && p.y <= Math.max(o.a.y, o.b.y) + o.thickness;
          const d = Math.abs(o.a.x - p.x);
          if (inside && d < bd) {
            bd = d;
            best = o.a.x;
          }
        } else {
          const inside = p.x >= Math.min(o.a.x, o.b.x) - o.thickness && p.x <= Math.max(o.a.x, o.b.x) + o.thickness;
          const d = Math.abs(o.a.y - p.y);
          if (inside && d < bd) {
            bd = d;
            best = o.a.y;
          }
        }
      }
      if (best !== null) {
        if (isH(w)) p.x = best;
        else p.y = best;
      }
    }
    return out;
  });
}

/** Lecture « 13 x 8,5 » ou « 13,00 × 8,50 m » → { w, h } en mm (mètres par défaut). */
export function parseSize(s: string): { w: number; h: number } | null {
  const m = s
    .trim()
    .toLowerCase()
    .replace(/,/g, '.')
    .match(/^([0-9]*\.?[0-9]+)\s*(?:m)?\s*[x×*]\s*([0-9]*\.?[0-9]+)\s*(m|cm|mm)?$/);
  if (!m) return null;
  const u = m[3] ?? 'm';
  const k = u === 'mm' ? 1 : u === 'cm' ? 10 : 1000;
  const w = parseFloat(m[1]) * k;
  const h = parseFloat(m[2]) * k;
  return w > 0 && h > 0 ? { w, h } : null;
}

/**
 * Ouvertures d'une façade : le long d'une bande (rectangle px, dans le sens de la façade),
 * on mesure le gris moyen ; les passages nettement plus clairs que le mur sont des ouvertures.
 * Renvoie des intervalles [début, fin] en pixels le long de la bande.
 */
export function bandGaps(g: Gray, band: { x0: number; y0: number; x1: number; y1: number }, horiz: boolean, minLen: number, maxLen: number): [number, number][] {
  const x0 = Math.max(0, Math.round(band.x0));
  const x1 = Math.min(g.w - 1, Math.round(band.x1));
  const y0 = Math.max(0, Math.round(band.y0));
  const y1 = Math.min(g.h - 1, Math.round(band.y1));
  const prof: number[] = [];
  if (horiz)
    for (let x = x0; x <= x1; x++) {
      let s = 0;
      for (let y = y0; y <= y1; y++) s += g.d[y * g.w + x];
      prof.push(s / (y1 - y0 + 1));
    }
  else
    for (let y = y0; y <= y1; y++) {
      let s = 0;
      for (let x = x0; x <= x1; x++) s += g.d[y * g.w + x];
      prof.push(s / (x1 - x0 + 1));
    }
  if (!prof.length) return [];
  // Lissage léger (traits fins des châssis)
  const sm = prof.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let k = Math.max(0, i - 2); k <= Math.min(prof.length - 1, i + 2); k++) {
      s += prof[k];
      n++;
    }
    return s / n;
  });
  const sorted = [...sm].sort((a, b) => a - b);
  const wall = sorted[Math.floor(sorted.length * 0.2)];
  const open = sorted[Math.floor(sorted.length * 0.95)];
  if (open - wall < 12) return []; // pas de contraste : on ne devine pas
  const thr = (wall + open) / 2;
  const out: [number, number][] = [];
  let i = 0;
  while (i < sm.length) {
    if (sm[i] <= thr) {
      i++;
      continue;
    }
    let j = i;
    while (j < sm.length && sm[j] > thr) j++;
    if (j - i >= minLen && j - i <= maxLen) out.push([i + (horiz ? x0 : y0), j + (horiz ? x0 : y0)]);
    i = j;
  }
  return out;
}

export interface WallMm {
  a: Pt;
  b: Pt;
  thickness: number;
}

/**
 * Portes intérieures : une cloison interrompue sur 60 à 130 cm (entre deux morceaux alignés,
 * ou entre son extrémité et un mur perpendiculaire) est refermée et reçoit une porte.
 */
export function doorsFromGaps(walls: WallMm[], minGap = 600, maxGap = 1300): { walls: WallMm[]; doors: { a: Pt; b: Pt; width: number }[] } {
  const horiz = (w: WallMm) => Math.abs(w.a.y - w.b.y) < 1;
  const norm = (w: WallMm): WallMm => {
    const h = horiz(w);
    const swap = h ? w.a.x > w.b.x : w.a.y > w.b.y;
    return swap ? { ...w, a: w.b, b: w.a } : w;
  };
  let ws = walls.map(norm);
  const doors: { a: Pt; b: Pt; width: number }[] = [];

  // 1. Morceaux alignés séparés par un passage de porte
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < ws.length; i++)
      for (let j = 0; j < ws.length; j++) {
        if (i === j) continue;
        const p = ws[i];
        const q = ws[j];
        if (horiz(p) !== horiz(q)) continue;
        const h = horiz(p);
        const axis = (w: WallMm) => (h ? w.a.y : w.a.x);
        const s = (pt: Pt) => (h ? pt.x : pt.y);
        if (Math.abs(axis(p) - axis(q)) > Math.max(p.thickness, q.thickness) / 2) continue;
        const gap = s(q.a) - s(p.b);
        if (gap < minGap || gap > maxGap) continue;
        const ax = axis(p);
        const at = (v: number): Pt => (h ? { x: v, y: ax } : { x: ax, y: v });
        doors.push({ a: at(s(p.b)), b: at(s(q.a)), width: Math.max(p.thickness, q.thickness) });
        ws = ws.filter((_, k) => k !== i && k !== j);
        ws.push({ a: at(s(p.a)), b: at(s(q.b)), thickness: Math.max(p.thickness, q.thickness) });
        merged = true;
        break outer;
      }
  }

  // 2. Extrémité libre face à un mur perpendiculaire
  ws = ws.map((w) => {
    const h = horiz(w);
    let out = { ...w, a: { ...w.a }, b: { ...w.b } };
    for (const end of ['a', 'b'] as const) {
      const p = out[end];
      const dir = end === 'a' ? -1 : 1;
      let best: { v: number; face: number } | null = null;
      for (const o of ws) {
        if (o === w || horiz(o) === h) continue;
        const oAxis = h ? o.a.x : o.a.y;
        const lo = h ? Math.min(o.a.y, o.b.y) : Math.min(o.a.x, o.b.x);
        const hi = h ? Math.max(o.a.y, o.b.y) : Math.max(o.a.x, o.b.x);
        const cross = h ? p.y : p.x;
        if (cross < lo - o.thickness || cross > hi + o.thickness) continue;
        const along = h ? p.x : p.y;
        const face = oAxis - (dir * o.thickness) / 2;
        const gap = (face - along) * dir;
        if (gap < -o.thickness) continue;
        if (!best || Math.abs(gap) < Math.abs((best.face - along) * dir)) best = { v: oAxis, face };
      }
      if (!best) continue;
      const along = h ? p.x : p.y;
      const gap = (best.face - along) * dir;
      if (gap >= minGap && gap <= maxGap) {
        const at = (v: number): Pt => (h ? { x: v, y: p.y } : { x: p.x, y: v });
        doors.push({ a: at(along), b: at(best.face), width: w.thickness });
        out = { ...out, [end]: at(best.v) };
      }
    }
    return out;
  });
  return { walls: ws, doors };
}
