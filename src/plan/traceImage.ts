/**
 * Liaison navigateur de src/plan/trace.ts : lecture de l'image de fond, redressement, détection des murs,
 * et conversion pixels ↔ millimètres du plan (position, taille et rotation de l'image sur la page).
 */
import type { PlanPage, Pt } from '../model/types';
import { bandGaps, darkMask, doorsFromGaps, extractWalls, opening, rectify, toGray, type RGBA } from './trace';

type Bg = PlanPage['images'][number];

export async function loadRGBA(href: string): Promise<RGBA> {
  const img = new Image();
  img.src = href;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  return { w: d.width, h: d.height, data: d.data };
}

export function toDataUrl(img: RGBA): string {
  const c = document.createElement('canvas');
  c.width = img.w;
  c.height = img.h;
  c.getContext('2d')!.putImageData(new ImageData(img.data, img.w, img.h), 0, 0);
  return c.toDataURL('image/jpeg', 0.85);
}

/** Point de la page (mm) → pixel de l'image. */
function pageToPx(bg: Bg, p: Pt, pw: number, ph: number): Pt {
  const a = (-bg.angle * Math.PI) / 180;
  const dx = p.x - bg.center.x;
  const dy = p.y - bg.center.y;
  const x = dx * Math.cos(a) - dy * Math.sin(a);
  const y = dx * Math.sin(a) + dy * Math.cos(a);
  return { x: ((x + bg.w / 2) / bg.w) * pw, y: ((y + bg.h / 2) / bg.h) * ph };
}

/** Pixel de l'image → point de la page (mm). */
function pxToPage(bg: Bg, p: Pt, pw: number, ph: number): Pt {
  const x = (p.x / pw) * bg.w - bg.w / 2;
  const y = (p.y / ph) * bg.h - bg.h / 2;
  const a = (bg.angle * Math.PI) / 180;
  return { x: bg.center.x + x * Math.cos(a) - y * Math.sin(a), y: bg.center.y + x * Math.sin(a) + y * Math.cos(a) };
}

/**
 * Redresse le fond : `corners` = 4 coins (sur la page) d'un rectangle connu, dans l'ordre
 * haut-gauche, haut-droit, bas-droit, bas-gauche ; `size` = ses dimensions réelles (mm).
 * Le fond devient droit, à l'échelle, et le rectangle est placé à partir du premier coin.
 */
export async function rectifyBackground(bg: Bg, corners: Pt[], size: { w: number; h: number }): Promise<Bg> {
  const src = await loadRGBA(bg.href);
  const cpx = corners.map((p) => pageToPx(bg, p, src.w, src.h));
  // Résolution : environ 2000 px pour le rectangle, marge de 12 % autour (cotes, légende).
  const k = 2000 / Math.max(size.w, size.h); // px par mm
  const margin = 0.12 * Math.max(size.w, size.h) * k;
  const { img, origin } = rectify(src, cpx, { w: size.w * k, h: size.h * k }, margin);
  const w = img.w / k;
  const h = img.h / k;
  const tl = corners[0];
  return {
    ...bg,
    href: toDataUrl(img),
    w,
    h,
    angle: 0,
    center: { x: tl.x - origin.x / k + w / 2, y: tl.y - origin.y / k + h / 2 },
    frame: { x: tl.x, y: tl.y, w: size.w, h: size.h },
  };
}

/**
 * Détection des murs sur le fond de plan → murs de la page (mm).
 * Fond redressé (`frame` connu) : les façades sont posées d'après le rectangle, et la détection se limite
 * à l'intérieur (les cotes et textes autour du plan sont ignorés).
 */
export async function tracePlan(bg: Bg): Promise<{ walls: PlanPage['walls']; openings: PlanPage['openings'] }> {
  const src = await loadRGBA(bg.href);
  const pxPerMm = src.w / bg.w;
  const px = (mm: number) => Math.max(1, Math.round(mm * pxPerMm));
  const gray = toGray(src);
  const mask = opening(darkMask(gray, px(3000), 0.85), src.w, src.h, px(25));
  const q = (v: number) => Math.round(v / 10) * 10;
  const f = bg.frame;
  if (f) {
    // Masque limité à l'intérieur du rectangle des façades
    const p0 = pageToPx(bg, { x: f.x, y: f.y }, src.w, src.h);
    const p1 = pageToPx(bg, { x: f.x + f.w, y: f.y + f.h }, src.w, src.h);
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) if (x < p0.x - 2 || x > p1.x + 2 || y < p0.y - 2 || y > p1.y + 2) mask[y * src.w + x] = 0;
  }
  let walls = extractWalls(mask, src.w, src.h, px(500), px(600))
    .map((w) => {
      const a = pxToPage(bg, w.a, src.w, src.h);
      const b = pxToPage(bg, w.b, src.w, src.h);
      return { a: { x: q(a.x), y: q(a.y) }, b: { x: q(b.x), y: q(b.y) }, thickness: Math.max(50, q(w.thickness / pxPerMm)) };
    })
    .filter((w) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y) >= 300);
  if (!f) return { walls, openings: [] };

  // Morceaux de façade détectés (parallèles et collés au bord du rectangle) : on les remplace par l'enveloppe.
  const band = 450;
  const facade = (w: PlanPage['walls'][number]) => {
    const horiz = w.a.y === w.b.y;
    return horiz ? Math.min(Math.abs(w.a.y - f.y), Math.abs(w.a.y - (f.y + f.h))) < band : Math.min(Math.abs(w.a.x - f.x), Math.abs(w.a.x - (f.x + f.w))) < band;
  };
  const pieces = walls.filter(facade).map((w) => w.thickness).sort((a, b) => a - b);
  // Épaisseur des façades : mesurée si possible (le remplissage gris des photos est souvent pâle, d'où le minimum de 25 cm).
  const t = Math.min(500, Math.max(250, pieces.length ? pieces[Math.floor(pieces.length / 2)] : 250));
  walls = walls.filter((w) => !facade(w));
  const x0 = q(f.x + t / 2);
  const y0 = q(f.y + t / 2);
  const x1 = q(f.x + f.w - t / 2);
  const y1 = q(f.y + f.h - t / 2);
  const c = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  const envelope = c.map((a, i) => ({ a, b: c[(i + 1) % 4], thickness: t }));
  // Portes intérieures : cloisons interrompues de 60 à 130 cm (y compris face à une façade)
  const found = doorsFromGaps([...envelope, ...walls]);
  walls = found.walls.filter((w) => !envelope.some((e) => same(e, w)));
  // Les cloisons qui s'arrêtent à moins de 60 cm d'une façade la rejoignent.
  const snap = (v: number, lo: number, hi: number) => (Math.abs(v - lo) < 600 + t / 2 ? lo : Math.abs(v - hi) < 600 + t / 2 ? hi : v);
  walls = walls.map((w) =>
    w.a.y === w.b.y
      ? { ...w, a: { ...w.a, x: snap(w.a.x, x0, x1) }, b: { ...w.b, x: snap(w.b.x, x0, x1) } }
      : { ...w, a: { ...w.a, y: snap(w.a.y, y0, y1) }, b: { ...w.b, y: snap(w.b.y, y0, y1) } },
  );
  const openings: PlanPage['openings'] = found.doors.map((d) => ({ kind: 'door', a: d.a, b: d.b, width: d.width, hinge: 'left' }));

  // Fenêtres : parties claires dans l'épaisseur des façades (hors angles)
  const P = (x: number, y: number) => pageToPx(bg, { x, y }, src.w, src.h);
  const edges = [
    { horiz: true, from: P(f.x + t, f.y), to: P(f.x + f.w - t, f.y + t), axis: y0 },
    { horiz: true, from: P(f.x + t, f.y + f.h - t), to: P(f.x + f.w - t, f.y + f.h), axis: y1 },
    { horiz: false, from: P(f.x, f.y + t), to: P(f.x + t, f.y + f.h - t), axis: x0 },
    { horiz: false, from: P(f.x + f.w - t, f.y + t), to: P(f.x + f.w, f.y + f.h - t), axis: x1 },
  ];
  for (const e of edges) {
    const band = { x0: e.from.x, y0: e.from.y, x1: e.to.x, y1: e.to.y };
    for (const [g0, g1] of bandGaps(gray, band, e.horiz, px(400), px(4000))) {
      const a = e.horiz ? pxToPage(bg, { x: g0, y: e.from.y }, src.w, src.h) : pxToPage(bg, { x: e.from.x, y: g0 }, src.w, src.h);
      const b = e.horiz ? pxToPage(bg, { x: g1, y: e.from.y }, src.w, src.h) : pxToPage(bg, { x: e.from.x, y: g1 }, src.w, src.h);
      openings.push(
        e.horiz
          ? { kind: 'window', a: { x: q(a.x), y: e.axis }, b: { x: q(b.x), y: e.axis }, width: t }
          : { kind: 'window', a: { x: e.axis, y: q(a.y) }, b: { x: e.axis, y: q(b.y) }, width: t },
      );
    }
  }
  return { walls: [...envelope, ...walls], openings };
}

const same = (p: PlanPage['walls'][number], q: PlanPage['walls'][number]) =>
  (p.a.x === q.a.x && p.a.y === q.a.y && p.b.x === q.b.x && p.b.y === q.b.y) || (p.a.x === q.b.x && p.a.y === q.b.y && p.b.x === q.a.x && p.b.y === q.a.y);
