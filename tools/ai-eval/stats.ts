/**
 * Statistiques du banc d'évaluation (fonctions pures) : intervalle de confiance d'une proportion (Wilson), quantiles,
 * moyenne et écart-type. Sur un petit corpus (30 tableaux), un taux de 0 % peut cacher un vrai taux de plusieurs % :
 * toujours lire la borne haute de l'intervalle, pas seulement l'estimation.
 */

export interface Proportion {
  /** Succès (ou événements comptés). */
  k: number;
  n: number;
  /** Estimation k / n. */
  p: number;
  /** Intervalle de confiance à 95 % (Wilson), borné à [0, 1]. */
  lo: number;
  hi: number;
}

/** Proportion k / n avec son intervalle de Wilson (z = 1,96 : 95 %). `null` si n = 0 (rien à estimer). */
export function wilson(k: number, n: number, z = 1.96): Proportion | null {
  if (!(n > 0)) return null;
  const p = k / n;
  const z2 = z * z;
  const den = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / den;
  return { k, n, p, lo: Math.max(0, center - half), hi: Math.min(1, center + half) };
}

/** Quantile q (0…1) par interpolation linéaire ; undefined si la liste est vide. */
export function quantile(values: number[], q: number): number | undefined {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return undefined;
  const pos = (v.length - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

export const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined);

/** Écart-type d'échantillon (n − 1) ; 0 pour une seule valeur, undefined pour aucune. */
export function sd(v: number[]): number | undefined {
  const m = mean(v);
  if (m === undefined) return undefined;
  if (v.length < 2) return 0;
  return Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (v.length - 1));
}

/** « 1,5 % [0,4 – 5,2] (n = 64) » ; « — » si rien à estimer. */
export function fmtProp(x: Proportion | null, digits = 1): string {
  if (!x) return '—';
  const f = (v: number) => (100 * v).toFixed(digits).replace('.', ',');
  return `${f(x.p)} % [${f(x.lo)} – ${f(x.hi)}] (n = ${x.n})`;
}

/** « 85 % » ; « — » si rien à estimer. */
export const fmtPct = (x: Proportion | null | undefined) => (x ? `${Math.round(100 * x.p)} %` : '—');
