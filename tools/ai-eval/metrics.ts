/**
 * Indicateurs du banc d'évaluation (fonctions pures, testées : test/aiEvalMatrix.test.ts) : taux d'invention,
 * qualité de l'abstention, détection, durée, coût, répétabilité, seuils proposés pour la bêta.
 *
 * Définitions (voir docs/assistant-evaluation.md § 8) :
 *  - taux d'invention d'un champ = inventés / évalués où la vérité dit « absent ou illisible » (null) ;
 *  - abstention justifiée (précision) = lecture vide ET vérité vide / toutes les lectures vides ;
 *  - abstention sur l'illisible (rappel) = lecture vide ET vérité vide / vérités vides (= 1 − taux d'invention) ;
 *  - erreur sur lisible = faux / évalués où la vérité donne une valeur.
 */
import type { PhotoReadingT } from '../../src/ai/boardPhoto';
import { compareDevice, FIELDS, matchDevices, readDevices, total, truthDevices, type Field, type GroundTruth, type PhotoScore } from './score';
import { quantile, mean, wilson, type Proportion } from './stats';
import type { PipelineSummary } from './pipeline';

/** Valeurs lues sur l'appareil (là où une invention a un sens). */
export const VALUE_FIELDS: Field[] = ['rating', 'curve', 'sensitivity', 'rcdType', 'poles', 'label', 'circuitRef'];

export interface QualitySummary {
  photos: number;
  errors: number;
  recall: Proportion | null;
  precision: Proportion | null;
  /** Appareils lus en trop / appareils lus. */
  inventedDevices: Proportion | null;
  accuracy: Record<Field, Proportion | null>;
  wrongOnReadable: Record<Field, Proportion | null>;
  invented: Record<Field, Proportion | null>;
  /** Taux d'invention, tous les champs de valeur réunis. */
  inventedAll: Proportion | null;
  inventedOnUnreadable: number;
  abstentionPrecision: Proportion | null;
  abstentionRecall: Proportion | null;
  latencyP50?: number;
  latencyP95?: number;
  tokensInMean?: number;
  tokensOutMean?: number;
  /** Coût moyen par photo réussie (si les prix sont connus). */
  costPerPhoto?: number;
}

const byField = (f: (k: Field) => Proportion | null) => Object.fromEntries(FIELDS.map((k) => [k, f(k)])) as Record<Field, Proportion | null>;
const defined = (v: (number | undefined)[]) => v.filter((x): x is number => x !== undefined && Number.isFinite(x));

export function summarize(scores: PhotoScore[]): QualitySummary {
  const ok = scores.filter((s) => !s.error);
  const all = total(ok);
  const F = all.fields;
  const sum = (k: 'truthNull' | 'invented' | 'missed') => VALUE_FIELDS.reduce((n, f) => n + F[f][k], 0);
  const nullOk = sum('truthNull') - sum('invented');
  return {
    photos: scores.length,
    errors: scores.length - ok.length,
    recall: wilson(all.matched, all.truth),
    precision: wilson(all.matched, all.predicted),
    inventedDevices: wilson(all.extraDevices, all.predicted),
    accuracy: byField((f) => wilson(F[f].correct, F[f].n)),
    wrongOnReadable: byField((f) => wilson(F[f].wrong, F[f].n - F[f].truthNull)),
    invented: byField((f) => wilson(F[f].invented, F[f].truthNull)),
    inventedAll: wilson(sum('invented'), sum('truthNull')),
    inventedOnUnreadable: VALUE_FIELDS.reduce((n, f) => n + F[f].inventedOnUnreadable, 0),
    abstentionPrecision: wilson(nullOk, nullOk + sum('missed')),
    abstentionRecall: wilson(nullOk, sum('truthNull')),
    latencyP50: quantile(defined(ok.map((s) => s.latencyMs)), 0.5),
    latencyP95: quantile(defined(ok.map((s) => s.latencyMs)), 0.95),
    tokensInMean: mean(defined(ok.map((s) => s.tokensIn))),
    tokensOutMean: mean(defined(ok.map((s) => s.tokensOut))),
    costPerPhoto: mean(defined(ok.map((s) => s.cost))),
  };
}

// ---------------------------------------------------------------------------
// Répétabilité : le même modèle relit la même photo N fois
// ---------------------------------------------------------------------------

export interface Repeatability {
  reps: number;
  /** Champs (appareil de la vérité × champ) lus à chaque répétition. */
  compared: number;
  /** Proportion de ces champs lus à l'identique à chaque répétition. */
  stable: Proportion | null;
}

/**
 * Stabilité des valeurs entre répétitions : pour chaque appareil de la vérité et chaque champ de valeur (et le type),
 * la valeur lue (normalisée, « non lu » si l'appareil n'est pas apparié) est-elle la même à chaque répétition ?
 */
export function repeatability(truths: Map<string, GroundTruth>, reps: Map<string, PhotoReadingT>[]): Repeatability {
  let compared = 0;
  let stable = 0;
  const fields = new Set<Field>(['kind', ...VALUE_FIELDS]);
  for (const [name, truth] of truths) {
    const t = truthDevices(truth);
    const perRep = reps.map((m) => m.get(name)).filter((r): r is PhotoReadingT => !!r);
    if (perRep.length < 2) continue;
    const values = perRep.map((reading) => {
      const p = readDevices(reading);
      const pairs = new Map(matchDevices(t, p));
      return t.map((d, ti) => {
        const pi = pairs.get(ti);
        const out = new Map<Field, string>();
        if (pi === undefined) for (const f of fields) out.set(f, '∅');
        else for (const c of compareDevice(d, p[pi].d)) if (fields.has(c.field)) out.set(c.field, JSON.stringify(c.pred ?? null));
        return out;
      });
    });
    t.forEach((_d, ti) => {
      for (const f of fields) {
        compared++;
        const first = values[0][ti].get(f);
        if (values.every((v) => v[ti].get(f) === first)) stable++;
      }
    });
  }
  return { reps: reps.length, compared, stable: wilson(stable, compared) };
}

// ---------------------------------------------------------------------------
// Seuils proposés pour la bêta
// ---------------------------------------------------------------------------

export type Verdict = 'atteint' | 'non atteint' | 'échantillon insuffisant';

export interface Threshold {
  id: string;
  label: string;
  /** Proportion mesurée (null : pas mesurable sur ce corpus). */
  metric: (q: QualitySummary, p?: PipelineSummary) => Proportion | null;
  op: '<' | '>=';
  value: number;
  /** Taille minimale de l'échantillon (dénominateur) pour conclure. */
  minN: number;
}

/**
 * Seuils PROPOSÉS pour ouvrir la bêta (à valider par le porteur du projet). Même atteints, toutes les valeurs lues
 * restent affichées comme « proposition, à valider » dans l'application : aucun seuil ne rend une lecture certaine.
 */
export const BETA_THRESHOLDS: Threshold[] = [
  { id: 'inventedRating', label: 'Calibre inventé (sur illisible ou absent)', metric: (q) => q.invented.rating, op: '<', value: 0.02, minN: 30 },
  { id: 'inventedSensitivity', label: 'Sensibilité inventée', metric: (q) => q.invented.sensitivity, op: '<', value: 0.02, minN: 20 },
  { id: 'inventedAll', label: 'Valeur inventée, tous champs', metric: (q) => q.inventedAll, op: '<', value: 0.05, minN: 50 },
  { id: 'wrongRating', label: 'Calibre faux (lisible mais mal lu)', metric: (q) => q.wrongOnReadable.rating, op: '<', value: 0.05, minN: 100 },
  { id: 'inventedDevices', label: 'Appareils inventés (lus en trop)', metric: (q) => q.inventedDevices, op: '<', value: 0.03, minN: 100 },
  { id: 'recall', label: 'Appareils détectés (rappel)', metric: (q) => q.recall, op: '>=', value: 0.9, minN: 100 },
  { id: 'kind', label: 'Type exact (disjoncteur, différentiel…)', metric: (q) => q.accuracy.kind, op: '>=', value: 0.9, minN: 100 },
  { id: 'structure', label: 'Structure : différentiel → circuit exact (brouillon)', metric: (_q, p) => p?.upstream ?? null, op: '>=', value: 0.8, minN: 30 },
  { id: 'treeInvented', label: 'Valeur inventée dans l’arbre reconstruit', metric: (_q, p) => p?.inventedAll ?? null, op: '<', value: 0.02, minN: 30 },
];

export function verdict(t: Threshold, x: Proportion | null): Verdict {
  if (!x || x.n < t.minN) return 'échantillon insuffisant';
  return (t.op === '<' ? x.p < t.value : x.p >= t.value) ? 'atteint' : 'non atteint';
}

export function verdicts(q: QualitySummary, p?: PipelineSummary): { t: Threshold; x: Proportion | null; verdict: Verdict }[] {
  return BETA_THRESHOLDS.map((t) => {
    const x = t.metric(q, p);
    return { t, x, verdict: verdict(t, x) };
  });
}
