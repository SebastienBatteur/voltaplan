/**
 * Murs, portes et fenêtres d'un plan PDF, lus dans son DESSIN (tracés vectoriels), sans IA : un plan exporté par un
 * logiciel de dessin contient les murs comme des traits ou des surfaces, avec leurs coordonnées exactes.
 *
 * Trois façons de dessiner un mur, relevées sur les dossiers PDF de Volter, Draadwijs et Amperio :
 *  - trait épais foncé (Draadwijs, Amperio) : le trait est le mur, son épaisseur celle du mur ;
 *  - quadrilatère rempli foncé, long et étroit (Volter) : axe du mur et épaisseur ;
 *  - ouverture : trait blanc aussi épais que le mur, posé dessus (il « efface » le mur) ; porte s'il touche un arc
 *    (battant), fenêtre sinon.
 * Coordonnées en points PDF (origine en haut à gauche) ; la conversion en mm est faite par l'appelant.
 */
import type { Pt } from '../model/types';

/** Chemin d'une page : sous-chemins (suite de points), avec les morceaux courbes repérés. */
export interface PdfShape {
  /** Sous-chemins ; `curve[i]` : le sous-chemin contient une courbe. */
  paths: Pt[][];
  curve: boolean[];
  closed: boolean[];
  fill: [number, number, number] | null;
  stroke: [number, number, number] | null;
  /** Épaisseur du trait en points. */
  lw: number;
}

export interface PdfWall {
  a: Pt;
  b: Pt;
  thickness: number;
}

export interface PdfOpening {
  kind: 'door' | 'window';
  a: Pt;
  b: Pt;
  width: number;
  /** Porte : battant du côté +y local du segment a→b (Voltaplan : hinge 'right'). */
  plusY?: boolean;
  /** Porte : charnière en b. */
  hingeAtB?: boolean;
}

const lum = (c: [number, number, number] | null) => (c ? 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] : 255);
const dist = (p: Pt, q: Pt) => Math.hypot(p.x - q.x, p.y - q.y);

/** Projection d'un point sur un segment : position (0…1), point projeté, distance. */
function proj(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  const q = { x: a.x + t * dx, y: a.y + t * dy };
  return { t, q, d: dist(p, q) };
}

/** Segments droits d'un sous-chemin sans courbe. */
function segments(pts: Pt[], closed: boolean): [Pt, Pt][] {
  const out: [Pt, Pt][] = [];
  for (let i = 0; i + 1 < pts.length; i++) if (dist(pts[i], pts[i + 1]) > 0.01) out.push([pts[i], pts[i + 1]]);
  if (closed && pts.length > 2 && dist(pts[pts.length - 1], pts[0]) > 0.01) out.push([pts[pts.length - 1], pts[0]]);
  return out;
}

/**
 * Murs d'une surface remplie (rectangle d'un mur, ou contour d'un ensemble de murs) : chaque paire de bords
 * parallèles, de sens opposés, séparés d'une épaisseur de mur et qui se recouvrent, donne un mur (axe et épaisseur).
 */
export function wallsInPolygon(pts: Pt[], minWall: number, maxWall: number, minLen: number): (PdfWall & { len: number })[] {
  const ring = dist(pts[0], pts[pts.length - 1]) < 0.5 ? pts.slice(0, -1) : pts;
  const edges = ring.map((p, i) => [p, ring[(i + 1) % ring.length]] as [Pt, Pt]).filter(([a, b]) => dist(a, b) >= minLen * 0.5);
  return wallsFromEdgePairs(edges, minWall, maxWall, minLen, true);
}

/**
 * Murs entre deux bords parallèles séparés d'une épaisseur de mur et qui se recouvrent. `opposite` : bords d'un même
 * contour (sens opposés) ; sinon traits séparés. (Volter dessine le bâtiment en image : murs relevés sur l'image.)
 */
export function wallsFromEdgePairs(edges: [Pt, Pt][], minWall: number, maxWall: number, minLen: number, opposite: boolean): (PdfWall & { len: number })[] {
  const out: (PdfWall & { len: number })[] = [];
  for (let i = 0; i < edges.length; i++)
    for (let j = i + 1; j < edges.length; j++) {
      const [a, b] = edges[i];
      const [c, d] = edges[j];
      const la = dist(a, b);
      const ux = (b.x - a.x) / la;
      const uy = (b.y - a.y) / la;
      const lc = dist(c, d);
      // Parallèles (de sens opposés pour un contour)
      const dot = ((d.x - c.x) / lc) * ux + ((d.y - c.y) / lc) * uy;
      if (opposite ? dot > -0.995 : Math.abs(dot) < 0.995) continue;
      const t = Math.abs((c.x - a.x) * -uy + (c.y - a.y) * ux);
      if (t < minWall || t > maxWall) continue;
      // Recouvrement le long de l'axe
      const s0 = 0;
      const s1 = la;
      const sc = (c.x - a.x) * ux + (c.y - a.y) * uy;
      const sd = (d.x - a.x) * ux + (d.y - a.y) * uy;
      const lo = Math.max(s0, Math.min(sc, sd));
      const hi = Math.min(s1, Math.max(sc, sd));
      if (hi - lo < Math.max(0.6 * minLen, 1.2 * t)) continue;
      // Côté de c par rapport à a→b : l'axe est à mi-épaisseur
      const side = Math.sign((c.x - a.x) * -uy + (c.y - a.y) * ux) || 1;
      const nx = -uy * side * (t / 2);
      const ny = ux * side * (t / 2);
      out.push({ a: { x: a.x + ux * lo + nx, y: a.y + uy * lo + ny }, b: { x: a.x + ux * hi + nx, y: a.y + uy * hi + ny }, thickness: t, len: hi - lo });
    }
  return out;
}

/** Épaisseur la plus fréquente parmi les candidats (à 15 % près), pondérée par la longueur. */
function dominant(cands: { thickness: number; len: number }[]): number | null {
  let best: number | null = null;
  let bestW = 0;
  for (const c of cands) {
    const w = cands.filter((o) => Math.abs(o.thickness - c.thickness) <= 0.15 * c.thickness).reduce((s, o) => s + o.len, 0);
    if (w > bestW) {
      bestW = w;
      best = c.thickness;
    }
  }
  return best;
}

/**
 * Murs et ouvertures d'une page. `zone` : rectangle du dessin (hors cartouche et légende) s'il est connu ; `minWall`
 * et `maxWall` : épaisseurs de mur admises, en points (dépend de l'échelle du plan).
 */
export function planFromShapes(shapes: PdfShape[], opts: { minWall?: number; maxWall?: number; minLen?: number } = {}): { walls: PdfWall[]; openings: PdfOpening[] } {
  const minWall = opts.minWall ?? 1.5;
  const maxWall = opts.maxWall ?? 16;
  const minLen = opts.minLen ?? 8;
  // 1. Traits épais foncés et quadrilatères foncés allongés
  const cands: (PdfWall & { len: number })[] = [];
  for (const s of shapes) {
    for (let i = 0; i < s.paths.length; i++) {
      if (s.curve[i]) continue;
      const pts = s.paths[i];
      if (s.stroke && !s.fill && s.lw >= minWall && s.lw <= maxWall && lum(s.stroke) < 170)
        for (const [a, b] of segments(pts, s.closed[i])) if (dist(a, b) >= minLen) cands.push({ a, b, thickness: s.lw, len: dist(a, b) });
      // Surface remplie (toujours fermée) foncée ou grise : murs entre deux bords parallèles
      if (s.fill && lum(s.fill) < 235 && pts.length >= 4) cands.push(...wallsInPolygon(pts, minWall, maxWall, minLen));
    }
  }
  const t0 = dominant(cands);
  if (t0 === null) return { walls: [], openings: [] };
  // Murs : l'épaisseur dominante (murs porteurs) et les cloisons un peu plus fines ; pas les battants ni les cotes
  const walls = cands.filter((c) => c.thickness >= 0.6 * t0 && c.thickness <= 2.2 * t0).map(({ a, b, thickness }) => ({ a, b, thickness }));
  // Morceaux isolés (barre d'échelle, pictogramme de légende) : ni raccordés à un autre mur, ni longs
  // (un bout de mur entre deux ouvertures reste : il a un voisin à moins d'une largeur de baie)
  const segDist = (p: Pt, w: PdfWall) => {
    const r = proj(p, w.a, w.b);
    return r.t < 0 ? dist(p, w.a) : r.t > 1 ? dist(p, w.b) : r.d;
  };
  if (walls.length >= 4) {
    const keep = walls.filter((w, i) => dist(w.a, w.b) >= 10 * w.thickness || walls.some((v, j) => j !== i && Math.min(segDist(w.a, v), segDist(w.b, v)) < 12 * w.thickness));
    walls.splice(0, walls.length, ...keep);
  }
  // 2. Ouvertures : traits blancs épais posés sur un mur
  // Arcs (battants) : extrémités = premier point et point le plus éloigné (un arc peut être tracé en aller-retour)
  const arcs = shapes.flatMap((s) =>
    s.paths
      .filter((_, i) => s.curve[i])
      .map((p) => ({ start: p[0], end: p.reduce((f, q) => (dist(q, p[0]) > dist(f, p[0]) ? q : f), p[0]), pts: p })),
  );
  const openings: PdfOpening[] = [];
  for (const s of shapes) {
    if (!s.stroke || s.fill || lum(s.stroke) < 240 || s.lw < 0.6 * t0) continue;
    for (let i = 0; i < s.paths.length; i++) {
      if (s.curve[i]) continue;
      for (const [a, b] of segments(s.paths[i], s.closed[i])) {
        const len = dist(a, b);
        if (len < 2 * t0) continue;
        const host = walls.find((w) => proj(a, w.a, w.b).d < w.thickness && proj(b, w.a, w.b).d < w.thickness);
        if (!host) continue;
        const tol = Math.max(2, 0.6 * host.thickness);
        // Battant : un arc dont une extrémité touche un bout de l'ouverture (côté poignée, sur le mur)
        const arc = arcs.find((r) => [r.start, r.end].some((e) => Math.min(dist(e, a), dist(e, b)) < tol + 1) && dist(r.start, r.end) > 0.5 * len);
        if (!arc) {
          openings.push({ kind: 'window', a, b, width: host.thickness });
          continue;
        }
        // Extrémité de l'arc sur le mur = poignée ; la charnière est l'autre bout de l'ouverture
        const onWall = [arc.start, arc.end].sort((p, q) => proj(p, a, b).d - proj(q, a, b).d)[0];
        const hingeAtB = dist(onWall, a) < dist(onWall, b);
        // Côté du battant : centre des points de l'arc (contrôles compris) par rapport au mur
        const mid = { x: arc.pts.reduce((v, q) => v + q.x, 0) / arc.pts.length, y: arc.pts.reduce((v, q) => v + q.y, 0) / arc.pts.length };
        const cross = (b.x - a.x) * (mid.y - a.y) - (b.y - a.y) * (mid.x - a.x);
        openings.push({ kind: 'door', a, b, width: host.thickness, plusY: cross > 0, hingeAtB });
      }
    }
  }
  // 3. Murs interrompus sans trait blanc (Condui) : chaque trou entre deux morceaux alignés est une ouverture
  for (let i = 0; i < walls.length; i++)
    for (let j = 0; j < walls.length; j++) {
      if (i === j) continue;
      const w = walls[i];
      const v = walls[j];
      const len = dist(w.a, w.b);
      const ux = (w.b.x - w.a.x) / len;
      const uy = (w.b.y - w.a.y) / len;
      const vl = dist(v.a, v.b);
      if (Math.abs(((v.b.x - v.a.x) / vl) * ux + ((v.b.y - v.a.y) / vl) * uy) < 0.995) continue;
      if (proj(v.a, w.a, w.b).d > 0.3 * w.thickness || Math.abs(v.thickness - w.thickness) > 0.3 * w.thickness) continue;
      // Bout de w le plus en avant, bout de v le plus en arrière, le long de w
      const s = (p: Pt) => (p.x - w.a.x) * ux + (p.y - w.a.y) * uy;
      const wEnd = Math.max(s(w.a), s(w.b));
      const vStart = Math.min(s(v.a), s(v.b));
      const gap = vStart - wEnd;
      if (gap < 2 * w.thickness || gap > 12 * w.thickness) continue;
      // Pas d'autre morceau du même mur dans le trou
      if (walls.some((o, k) => k !== i && k !== j && proj(o.a, w.a, w.b).d < 0.3 * w.thickness && Math.max(s(o.a), s(o.b)) > wEnd + 0.5 && Math.min(s(o.a), s(o.b)) < vStart - 0.5)) continue;
      const a = { x: w.a.x + ux * wEnd, y: w.a.y + uy * wEnd };
      const b = { x: w.a.x + ux * vStart, y: w.a.y + uy * vStart };
      if (openings.some((o) => dist(o.a, a) + dist(o.b, b) < w.thickness || dist(o.a, b) + dist(o.b, a) < w.thickness)) continue;
      const tol = Math.max(2, w.thickness);
      const arc = arcs.find((r) => [r.start, r.end].some((e) => Math.min(dist(e, a), dist(e, b)) < tol + 1) && dist(r.start, r.end) > 0.5 * gap);
      if (arc) {
        const onWall = [arc.start, arc.end].sort((p, q) => proj(p, a, b).d - proj(q, a, b).d)[0];
        const mid = { x: arc.pts.reduce((m, q) => m + q.x, 0) / arc.pts.length, y: arc.pts.reduce((m, q) => m + q.y, 0) / arc.pts.length };
        const cross = (b.x - a.x) * (mid.y - a.y) - (b.y - a.y) * (mid.x - a.x);
        openings.push({ kind: 'door', a, b, width: w.thickness, plusY: cross > 0, hingeAtB: dist(onWall, a) < dist(onWall, b) });
      } else openings.push({ kind: 'window', a, b, width: w.thickness });
    }
  // 4. Angles : un bout de mur proche d'un autre mur (non parallèle) est prolongé jusqu'à l'axe de celui-ci
  for (const w of walls)
    for (const end of ['a', 'b'] as const) {
      const p = w[end];
      for (const v of walls) {
        if (v === w) continue;
        const r = proj(p, v.a, v.b);
        if (r.t < -0.02 || r.t > 1.02 || r.d > 0.8 * Math.max(v.thickness, w.thickness) || r.d < 0.05) continue;
        // Prolongement le long de w jusqu'à la droite de v
        const dx = w.b.x - w.a.x;
        const dy = w.b.y - w.a.y;
        const ex = v.b.x - v.a.x;
        const ey = v.b.y - v.a.y;
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-6) continue;
        const k = ((v.a.x - w.a.x) * ey - (v.a.y - w.a.y) * ex) / den;
        // Prolongement court seulement (presque parallèles : intersection lointaine, ignorée)
        const q = { x: w.a.x + k * dx, y: w.a.y + k * dy };
        if (dist(q, p) > 1.5 * Math.max(v.thickness, w.thickness)) continue;
        w[end] = q;
        break;
      }
    }
  return { walls, openings };
}

/** Échelle estimée d'après les portes (largeur courante 80 à 90 cm) : mm réels par point PDF, ou null. */
export function scaleFromDoors(openings: PdfOpening[], doorMm = 850): number | null {
  const w = openings.filter((o) => o.kind === 'door').map((o) => dist(o.a, o.b)).sort((x, y) => x - y);
  if (w.length < 2) return null;
  return doorMm / w[Math.floor(w.length / 2)];
}

type Ops = Record<string, number>;
type M6 = number[];
const mul = (m: M6, n: M6): M6 => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const rgb = (a: unknown[]): [number, number, number] | null => {
  if (typeof a[0] === 'string' && /^#[0-9a-f]{6}$/i.test(a[0])) return [parseInt(a[0].slice(1, 3), 16), parseInt(a[0].slice(3, 5), 16), parseInt(a[0].slice(5, 7), 16)];
  if (typeof a[0] === 'number' && typeof a[1] === 'number' && typeof a[2] === 'number') return [a[0], a[1], a[2]].map((v) => (v <= 1 && a.every((x) => typeof x === 'number' && x <= 1) ? v * 255 : v)) as [number, number, number];
  return null;
};

/**
 * Tracés d'une page à partir de la liste d'opérations de pdf.js (`page.getOperatorList()`), avec la matrice de la vue
 * à l'échelle 1 (`viewport.transform`) : coordonnées en points, origine en haut à gauche.
 */
export function shapesFromOperatorList(fnArray: number[], argsArray: unknown[][], OPS: Ops, viewTransform: M6): PdfShape[] {
  let ctm = viewTransform.slice();
  type Rgb = [number, number, number] | null;
  let fill = [0, 0, 0] as Rgb;
  let stroke = [0, 0, 0] as Rgb;
  let lw = 1;
  const stack: { ctm: M6; fill: Rgb; stroke: Rgb; lw: number }[] = [];
  let pending: { paths: Pt[][]; curve: boolean[]; closed: boolean[]; scale: number } | null = null;
  const out: PdfShape[] = [];
  const P = (x: number, y: number): Pt => ({ x: ctm[0] * x + ctm[2] * y + ctm[4], y: ctm[1] * x + ctm[3] * y + ctm[5] });
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const a = argsArray[i] ?? [];
    if (fn === OPS.save) stack.push({ ctm, fill, stroke, lw });
    else if (fn === OPS.restore) ({ ctm, fill, stroke, lw } = stack.pop() ?? { ctm, fill, stroke, lw });
    else if (fn === OPS.transform) ctm = mul(ctm, a as number[]);
    else if (fn === OPS.setFillRGBColor) fill = rgb(a);
    else if (fn === OPS.setStrokeRGBColor) stroke = rgb(a);
    else if (fn === OPS.setFillGray) fill = [Number(a[0]) * 255, Number(a[0]) * 255, Number(a[0]) * 255];
    else if (fn === OPS.setStrokeGray) stroke = [Number(a[0]) * 255, Number(a[0]) * 255, Number(a[0]) * 255];
    else if (fn === OPS.setLineWidth) lw = Number(a[0]);
    else if (fn === OPS.constructPath) {
      const ops = a[0] as number[];
      const c = a[1] as number[];
      const paths: Pt[][] = [];
      const curve: boolean[] = [];
      const closed: boolean[] = [];
      let k = 0;
      const cur = () => paths[paths.length - 1];
      // Tracé qui commence sans « moveTo » : un sous-chemin vide est ouvert
      const ensure = () => {
        if (paths.length) return;
        paths.push([]);
        curve.push(false);
        closed.push(false);
      };
      for (const op of ops) {
        if (op === OPS.rectangle) {
          const [x, y, w, h] = c.slice(k, k + 4);
          k += 4;
          paths.push([P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)]);
          curve.push(false);
          closed.push(true);
        } else if (op === OPS.moveTo) {
          paths.push([P(c[k], c[k + 1])]);
          k += 2;
          curve.push(false);
          closed.push(false);
        } else if (op === OPS.lineTo) {
          ensure();
          cur().push(P(c[k], c[k + 1]));
          k += 2;
        } else if (op === OPS.curveTo) {
          ensure();
          // Points de contrôle gardés : ils donnent le côté où l'arc se bombe (battant d'une porte)
          cur().push(P(c[k], c[k + 1]), P(c[k + 2], c[k + 3]), P(c[k + 4], c[k + 5]));
          k += 6;
          curve[curve.length - 1] = true;
        } else if (op === OPS.curveTo2 || op === OPS.curveTo3) {
          ensure();
          cur().push(P(c[k], c[k + 1]), P(c[k + 2], c[k + 3]));
          k += 4;
          curve[curve.length - 1] = true;
        } else if (op === OPS.closePath && closed.length) closed[closed.length - 1] = true;
      }
      pending = { paths, curve, closed, scale: Math.hypot(ctm[0], ctm[1]) };
    } else if (pending && (fn === OPS.fill || fn === OPS.eoFill || fn === OPS.stroke || fn === OPS.closeStroke || fn === OPS.fillStroke || fn === OPS.eoFillStroke || fn === OPS.closeFillStroke || fn === OPS.closeEOFillStroke)) {
      const doFill = fn !== OPS.stroke && fn !== OPS.closeStroke;
      const doStroke = fn !== OPS.fill && fn !== OPS.eoFill;
      if (fn === OPS.closeStroke || fn === OPS.closeFillStroke || fn === OPS.closeEOFillStroke) pending.closed = pending.closed.map(() => true);
      out.push({ paths: pending.paths, curve: pending.curve, closed: pending.closed, fill: doFill ? fill : null, stroke: doStroke ? stroke : null, lw: lw * pending.scale });
      pending = null;
    } else if (fn === OPS.endPath) pending = null;
  }
  return out;
}

/** Distance d'un point au mur le plus proche (Infinity sans mur). */
export function distToWalls(p: Pt, walls: PdfWall[]): number {
  let d = Infinity;
  for (const w of walls) d = Math.min(d, Math.max(0, proj(p, w.a, w.b).t < 0 ? dist(p, w.a) : proj(p, w.a, w.b).t > 1 ? dist(p, w.b) : proj(p, w.a, w.b).d));
  return d;
}
