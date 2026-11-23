/**
 * Photo du tableau, sans IA.
 *
 * Calage par rangée : pour chaque rail, on clique sur la photo le bord gauche du premier module et le bout
 * de la rangée (fin du dernier module possible). Chaque rangée a ainsi sa propre position, inclinaison et
 * échelle : les rangées d'un vrai tableau ne sont ni régulièrement espacées ni toujours alignées.
 *
 * Détection : le long de la rangée, on mesure la force des bords verticaux sur la hauteur des appareils.
 * Une séparation entre deux appareils est un bord fort (fente sombre). La jointure entre les pôles d'un
 * appareil multipolaire (ex. disjoncteur 2P en 2 modules) est un bord plus faible : on la distingue par sa force.
 */
import type { Pt } from '../model/types';
import type { Gray } from '../plan/trace';

export interface Edge {
  /** Position en modules depuis le début de la rangée. */
  pos: number;
  strength: number;
}

/**
 * Profil de bords le long du segment a→b (pixels de la photo), sur une bande de ±halfBand pixels
 * perpendiculaire à la rangée. Valeur par pixel le long du segment : médiane de |I(p+u) - I(p-u)|.
 */
export function rowProfile(g: Gray, a: Pt, b: Pt, halfBand: number): number[] {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (!len) return [];
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const nx = -uy;
  const ny = ux;
  const at = (x: number, y: number) => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    return xi < 0 || yi < 0 || xi >= g.w || yi >= g.h ? 0 : g.d[yi * g.w + xi];
  };
  const steps = Math.max(4, Math.round(halfBand));
  const prof: number[] = [];
  const col: number[] = [];
  for (let t = 0; t <= len; t++) {
    const cx = a.x + ux * t;
    const cy = a.y + uy * t;
    col.length = 0;
    for (let k = -steps; k <= steps; k += 2) {
      const px = cx + nx * k;
      const py = cy + ny * k;
      col.push(Math.abs(at(px + ux, py + uy) - at(px - ux, py - uy)));
    }
    col.sort((p, q) => p - q);
    prof.push(col[Math.floor(col.length / 2)]);
  }
  return prof;
}

/** Pics du profil (positions en modules), suppression des voisins à moins de 0,35 module. */
export function profileEdges(prof: number[], modules: number): Edge[] {
  if (prof.length < 3) return [];
  const pxPerModule = (prof.length - 1) / modules;
  const minGap = Math.max(2, pxPerModule * 0.35);
  const peaks: number[] = [];
  for (let i = 1; i < prof.length - 1; i++) {
    if (prof[i] < 3 || prof[i] < prof[i - 1] || prof[i] < prof[i + 1]) continue;
    const last = peaks[peaks.length - 1];
    if (last !== undefined && i - last < minGap) {
      if (prof[i] > prof[last]) peaks[peaks.length - 1] = i;
      continue;
    }
    peaks.push(i);
  }
  // Force : maximum autour du pic (± 2 px), pour ne pas dépendre de l'arrondi
  return peaks.map((i) => ({ pos: i / pxPerModule, strength: Math.max(...prof.slice(Math.max(0, i - 2), i + 3)) }));
}

/**
 * Séparations entre appareils : bords forts. Seuil relatif à la rangée (les photos n'ont pas toutes le même
 * contraste) : 45 % de la force typique des séparations nettes (3e quartile des pics proches d'un module entier).
 */
export function strongEdges(edges: Edge[], minAbs = 8): Edge[] {
  const onGrid = edges.filter((e) => Math.abs(e.pos - Math.round(e.pos)) < 0.25);
  if (!onGrid.length) return [];
  const s = onGrid.map((e) => e.strength).sort((p, q) => p - q);
  const q75 = s[Math.floor(s.length * 0.75)];
  const thr = Math.max(minAbs, q75 * 0.45);
  return onGrid.filter((e) => e.strength >= thr);
}

/** Version simple (photo redressée, bande horizontale) — gardée pour les tests et l'ancien calage. */
export function deviceEdges(g: Gray, band: { x0: number; y0: number; x1: number; y1: number }, modulePx: number): number[] {
  const y = (band.y0 + band.y1) / 2;
  const prof = rowProfile(g, { x: band.x0, y }, { x: band.x1, y }, (band.y1 - band.y0) / 2);
  const modules = (band.x1 - band.x0) / modulePx;
  return strongEdges(profileEdges(prof, modules), 8).map((e) => e.pos);
}

/** Transformation (similitude) qui amène le segment a→b de la photo sur le segment c→d du dessin. */
export function rowTransform(a: Pt, b: Pt, c: Pt, d: Pt): { s: number; deg: number; svg: string } {
  const s = Math.hypot(d.x - c.x, d.y - c.y) / Math.hypot(b.x - a.x, b.y - a.y);
  const rot = Math.atan2(d.y - c.y, d.x - c.x) - Math.atan2(b.y - a.y, b.x - a.x);
  const deg = (rot * 180) / Math.PI;
  return { s, deg, svg: `translate(${c.x},${c.y}) rotate(${deg}) scale(${s}) translate(${-a.x},${-a.y})` };
}

/**
 * Séparations aux positions entières (0 … modules) : force mesurée au voisinage de chaque position (± 0,2 module),
 * comparée à ses voisines à ± 1 module (contraste local : insensible aux reflets et aux variations d'éclairage
 * le long de la rangée). Réglé sur de vraies photos de tableaux (Hager 2P, ABB 1 module, Legrand).
 */
export function boundaries(prof: number[], modules: number, ratio = 1.6, minAbs = 6): { pos: number; strength: number; boundary: boolean }[] {
  const ppm = (prof.length - 1) / modules;
  const strength = (p: number) => {
    const c = Math.round(p * ppm);
    const r = Math.max(1, Math.round(ppm * 0.2));
    let m = 0;
    for (let i = Math.max(0, c - r); i <= Math.min(prof.length - 1, c + r); i++) m = Math.max(m, prof[i]);
    return m;
  };
  const s = Array.from({ length: modules + 1 }, (_, p) => strength(p));
  return s.map((v, p) => {
    const nb = [s[p - 1], s[p + 1]].filter((x) => x !== undefined) as number[];
    const lo = nb.length ? Math.min(...nb) : 0;
    const hi = nb.length ? Math.max(...nb) : 0;
    // Séparation : nettement plus forte que la plus faible voisine (une jointure entre pôles est plus faible
    // que les séparations qui l'entourent), ou comparable à la plus forte (suite d'appareils d'un module).
    return { pos: p, strength: v, boundary: v >= minAbs && (v >= ratio * lo || v >= 0.6 * hi) };
  });
}
