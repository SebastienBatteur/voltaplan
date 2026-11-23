/**
 * Géométrie du plan (unités : mm). Fonctions pures, testées.
 */
import type { PlanPage, Pt } from '../model/types';

export const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);

/** Projection de p sur le segment [a,b] : t ∈ [0,1] et point projeté. */
export function project(p: Pt, a: Pt, b: Pt): { t: number; q: Pt; d: number } {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const l2 = vx * vx + vy * vy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2)) : 0;
  const q = { x: a.x + t * vx, y: a.y + t * vy };
  return { t, q, d: dist(p, q) };
}

/**
 * Accroche d'un point pendant le dessin d'un mur :
 * extrémité de mur proche, sinon angle droit par rapport au point précédent, puis grille de 10 mm.
 */
export function snapPoint(p: Pt, page: PlanPage, tol: number, from?: Pt | null): Pt {
  let best: Pt | null = null;
  let bd = tol;
  for (const w of page.walls)
    for (const e of [w.a, w.b]) {
      const d = dist(p, e);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
  if (best) return { ...best };
  let q = { ...p };
  if (from) {
    const dx = q.x - from.x;
    const dy = q.y - from.y;
    // Horizontal ou vertical si l'angle est à moins de ~8°
    if (Math.abs(dy) < Math.abs(dx) * 0.14) q.y = from.y;
    else if (Math.abs(dx) < Math.abs(dy) * 0.14) q.x = from.x;
  }
  q = { x: Math.round(q.x / 10) * 10, y: Math.round(q.y / 10) * 10 };
  if (from) {
    if (Math.abs(q.y - from.y) < 10) q.y = from.y;
    if (Math.abs(q.x - from.x) < 10) q.x = from.x;
  }
  return q;
}

/** Mur le plus proche de p (à moins de tol + demi-épaisseur). */
export function nearestWall(p: Pt, page: PlanPage, tol: number): { index: number; t: number; q: Pt } | null {
  let best: { index: number; t: number; q: Pt } | null = null;
  let bd = Infinity;
  page.walls.forEach((w, index) => {
    const { t, q, d } = project(p, w.a, w.b);
    if (d < w.thickness / 2 + tol && d < bd) {
      bd = d;
      best = { index, t, q };
    }
  });
  return best;
}

/** Ouverture (porte, fenêtre) de longueur `len` centrée sur le point cliqué d'un mur. */
export function openingOnWall(page: PlanPage, wallIndex: number, at: Pt, len: number): { a: Pt; b: Pt; width: number } {
  const w = page.walls[wallIndex];
  const L = dist(w.a, w.b);
  const l = Math.min(len, L);
  const ux = (w.b.x - w.a.x) / L;
  const uy = (w.b.y - w.a.y) / L;
  const s = Math.max(l / 2, Math.min(L - l / 2, (at.x - w.a.x) * ux + (at.y - w.a.y) * uy));
  const c = { x: w.a.x + ux * s, y: w.a.y + uy * s };
  const r = (v: number) => Math.round(v);
  return { a: { x: r(c.x - (ux * l) / 2), y: r(c.y - (uy * l) / 2) }, b: { x: r(c.x + (ux * l) / 2), y: r(c.y + (uy * l) / 2) }, width: w.thickness };
}

/**
 * Mise à l'échelle du fond de plan : deux points mesurés sur l'image et la distance réelle (mm).
 * Le premier point reste fixe. Renvoie la page modifiée (images de fond uniquement).
 */
export function scaleBackground(page: PlanPage, p1: Pt, p2: Pt, realMm: number): PlanPage {
  const measured = dist(p1, p2);
  if (!measured || !(realMm > 0)) return page;
  const k = realMm / measured;
  return {
    ...page,
    images: page.images.map((im) =>
      im.background
        ? { ...im, w: im.w * k, h: im.h * k, center: { x: p1.x + (im.center.x - p1.x) * k, y: p1.y + (im.center.y - p1.y) * k } }
        : im,
    ),
  };
}

/** Lecture d'une distance saisie : « 4,5 » ou « 4.5 m », « 450 cm », « 4500 mm » ou « 4500 ». Résultat en mm. */
export function parseLength(s: string): number | null {
  const m = s.trim().toLowerCase().replace(',', '.').match(/^([0-9]*\.?[0-9]+)\s*(mm|cm|m)?$/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  // Sans unité : mètres pour une petite valeur (4,5), millimètres au-delà de 100 (4500).
  const unit = m[2] ?? (v >= 100 ? 'mm' : 'm');
  return v * (unit === 'mm' ? 1 : unit === 'cm' ? 10 : 1000);
}

/**
 * Mise à l'échelle de toute la page (plan dessiné ou importé sans fond, ex. plan Trikker tracé hors échelle) :
 * positions et longueurs des murs, ouvertures, meubles, textes et symboles. Le premier point reste fixe ;
 * l'épaisseur des murs et la taille des symboles ne changent pas.
 */
export function scalePage(page: PlanPage, p1: Pt, p2: Pt, realMm: number): PlanPage {
  const measured = dist(p1, p2);
  if (!measured || !(realMm > 0)) return page;
  const k = realMm / measured;
  const f = (p: Pt): Pt => ({ x: Math.round(p1.x + (p.x - p1.x) * k), y: Math.round(p1.y + (p.y - p1.y) * k) });
  return {
    ...page,
    walls: page.walls.map((w) => ({ ...w, a: f(w.a), b: f(w.b) })),
    openings: page.openings.map((o) => ({ ...o, a: f(o.a), b: f(o.b) })),
    rects: page.rects.map((r) => ({ ...r, center: f(r.center), w: r.w * k, h: r.h * k })),
    images: page.images.map((im) => ({ ...im, center: f(im.center), w: im.w * k, h: im.h * k })),
    labels: page.labels.map((l) => ({ ...l, pos: f(l.pos) })),
    symbols: page.symbols.map((s) => ({ ...s, pos: f(s.pos) })),
    furniture: page.furniture?.map((m) => ({ ...m, center: f(m.center) })),
  };
}

/**
 * Calage du fond de plan sur un plan existant : deux points de la photo (i1, i2) sont amenés
 * sur les deux points correspondants du plan (q1, q2). Translation + rotation + échelle (similitude).
 */
export function alignBackground(page: PlanPage, i1: Pt, q1: Pt, i2: Pt, q2: Pt): PlanPage {
  const di = dist(i1, i2);
  if (!di || !dist(q1, q2)) return page;
  const s = dist(q1, q2) / di;
  const rot = Math.atan2(q2.y - q1.y, q2.x - q1.x) - Math.atan2(i2.y - i1.y, i2.x - i1.x);
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  const T = (p: Pt): Pt => {
    const dx = (p.x - i1.x) * s;
    const dy = (p.y - i1.y) * s;
    return { x: q1.x + dx * c - dy * sn, y: q1.y + dx * sn + dy * c };
  };
  return {
    ...page,
    images: page.images.map((im) =>
      im.background ? { ...im, center: T(im.center), w: im.w * s, h: im.h * s, angle: im.angle + (rot * 180) / Math.PI } : im,
    ),
  };
}

// ---------------------------------------------------------------------------
// Édition des éléments du plan (fonctions pures : la page modifiée est renvoyée)
// ---------------------------------------------------------------------------

type Opening = PlanPage['openings'][number];

/** Mur qui porte une ouverture : parallèle et le plus proche de son milieu. */
export function hostWall(page: PlanPage, o: Opening): number {
  const mid = { x: (o.a.x + o.b.x) / 2, y: (o.a.y + o.b.y) / 2 };
  const ang = Math.atan2(o.b.y - o.a.y, o.b.x - o.a.x);
  let best = -1;
  let bd = Infinity;
  page.walls.forEach((w, i) => {
    const wa = Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x);
    const par = Math.abs(Math.sin(wa - ang)) < 0.05;
    const d = project(mid, w.a, w.b).d;
    if (par && d < Math.max(w.thickness, 300) && d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

const same = (p: Pt, q: Pt) => dist(p, q) <= 1;

/**
 * Après une modification des murs : chaque ouverture garde sa position relative (centre à la même fraction
 * de son mur) et sa largeur, et suit la nouvelle direction du mur.
 */
function reattachOpenings(before: PlanPage, after: PlanPage): PlanPage {
  return {
    ...after,
    openings: before.openings.map((o) => {
      const wi = hostWall(before, o);
      if (wi < 0) return o;
      const w0 = before.walls[wi];
      const w1 = after.walls[wi];
      if (same(w0.a, w1.a) && same(w0.b, w1.b)) return o;
      const L0 = dist(w0.a, w0.b);
      const L1 = dist(w1.a, w1.b);
      if (!L0 || !L1) return o;
      const c = { x: (o.a.x + o.b.x) / 2, y: (o.a.y + o.b.y) / 2 };
      const t = project(c, w0.a, w0.b).t;
      const len = Math.min(dist(o.a, o.b), L1);
      const ux = (w1.b.x - w1.a.x) / L1;
      const uy = (w1.b.y - w1.a.y) / L1;
      const s = Math.max(len / 2, Math.min(L1 - len / 2, t * L1));
      // Sens a→b de l'ouverture conservé par rapport au mur
      const dir = (o.b.x - o.a.x) * (w0.b.x - w0.a.x) + (o.b.y - o.a.y) * (w0.b.y - w0.a.y) >= 0 ? 1 : -1;
      const r = Math.round;
      const a = { x: r(w1.a.x + ux * (s - (dir * len) / 2)), y: r(w1.a.y + uy * (s - (dir * len) / 2)) };
      const b = { x: r(w1.a.x + ux * (s + (dir * len) / 2)), y: r(w1.a.y + uy * (s + (dir * len) / 2)) };
      return { ...o, a, b };
    }),
  };
}

/** Déplace une extrémité de mur ; les murs raccordés au même point suivent. */
export function moveWallEnd(page: PlanPage, wi: number, end: 'a' | 'b', to: Pt): PlanPage {
  const from = page.walls[wi][end];
  return reattachOpenings(page, {
    ...page,
    walls: page.walls.map((w, i) => ({
      ...w,
      a: i === wi && end === 'a' ? to : same(w.a, from) ? to : w.a,
      b: i === wi && end === 'b' ? to : same(w.b, from) ? to : w.b,
    })),
  });
}

/** Déplace un mur entier (et ses ouvertures) ; les extrémités raccordées des autres murs suivent. */
export function translateWall(page: PlanPage, wi: number, d: Pt): PlanPage {
  const w0 = page.walls[wi];
  const mv = (p: Pt): Pt => ({ x: p.x + d.x, y: p.y + d.y });
  return reattachOpenings(page, {
    ...page,
    walls: page.walls.map((w, i) =>
      i === wi ? { ...w, a: mv(w.a), b: mv(w.b) } : { ...w, a: same(w.a, w0.a) || same(w.a, w0.b) ? mv(w.a) : w.a, b: same(w.b, w0.a) || same(w.b, w0.b) ? mv(w.b) : w.b },
    ),
  });
}

/** Change la longueur d'un mur (l'extrémité b se déplace dans l'axe). */
export function setWallLength(page: PlanPage, wi: number, len: number): PlanPage {
  const w = page.walls[wi];
  const L = dist(w.a, w.b);
  if (!L || !(len > 0)) return page;
  const to = { x: Math.round(w.a.x + ((w.b.x - w.a.x) / L) * len), y: Math.round(w.a.y + ((w.b.y - w.a.y) / L) * len) };
  return moveWallEnd(page, wi, 'b', to);
}

/** Fait glisser une ouverture le long de son mur, centrée sur la projection de p. */
export function slideOpening(page: PlanPage, oi: number, p: Pt): PlanPage {
  const o = page.openings[oi];
  const wi = hostWall(page, o);
  if (wi < 0) return page;
  const len = dist(o.a, o.b);
  const n = openingOnWall(page, wi, p, len);
  // Conserver le sens a→b de l'ouverture (sens d'ouverture des portes)
  const keep = (o.b.x - o.a.x) * (n.b.x - n.a.x) + (o.b.y - o.a.y) * (n.b.y - n.a.y) >= 0;
  return { ...page, openings: page.openings.map((x, i) => (i === oi ? { ...x, a: keep ? n.a : n.b, b: keep ? n.b : n.a } : x)) };
}

/** Change la largeur d'une ouverture en gardant son centre. */
export function setOpeningWidth(page: PlanPage, oi: number, width: number): PlanPage {
  const o = page.openings[oi];
  const L = dist(o.a, o.b);
  if (!L || !(width > 0)) return page;
  const c = { x: (o.a.x + o.b.x) / 2, y: (o.a.y + o.b.y) / 2 };
  const ux = (o.b.x - o.a.x) / L;
  const uy = (o.b.y - o.a.y) / L;
  const r = (v: number) => Math.round(v);
  const a = { x: r(c.x - (ux * width) / 2), y: r(c.y - (uy * width) / 2) };
  const b = { x: r(c.x + (ux * width) / 2), y: r(c.y + (uy * width) / 2) };
  return { ...page, openings: page.openings.map((x, i) => (i === oi ? { ...x, a, b } : x)) };
}

/** Le point p est-il dans le rectangle tourné (centre, w × h, angle en degrés), avec une marge `tol` ? */
export function inRotatedRect(p: Pt, center: Pt, w: number, h: number, angle: number, tol = 0): boolean {
  const a = (-angle * Math.PI) / 180;
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  const x = dx * Math.cos(a) - dy * Math.sin(a);
  const y = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(x) <= w / 2 + tol && Math.abs(y) <= h / 2 + tol;
}
