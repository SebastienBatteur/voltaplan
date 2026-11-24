/**
 * Banc d'évaluation de la lecture des photos de tableaux : comparaison (sans IA) entre la lecture produite par le
 * modèle et une vérité terrain saisie à la main. Fonctions pures, testées (test/aiEval.test.ts).
 *
 * Format de la vérité terrain : docs/assistant-evaluation.md (« voltaplan-ai-eval/1 »).
 */
import type { PhotoDeviceT, PhotoReadingT } from '../../src/ai/boardPhoto';
import { interpretLabel, normLabel, usageKey } from '../../src/assist/labels';

export const TRUTH_FORMAT = 'voltaplan-ai-eval/1';

/** Appareil de la vérité terrain. Champ absent : non évalué ; `null` : réellement absent ou illisible sur l'appareil. */
export interface TruthDevice {
  row: number;
  startModule: number;
  widthModules?: number;
  kind: PhotoDeviceT['kind'];
  ratedCurrentA?: number | null;
  curve?: string | null;
  residualCurrentmA?: number | null;
  rcdType?: string | null;
  label?: string | null;
  circuitRef?: string | null;
}

export interface GroundTruth {
  format: typeof TRUTH_FORMAT;
  /** Image (chemin relatif au fichier de vérité). */
  image: string;
  /** Image composée par Voltaplan (bouton « Image pour l'IA ») ; sinon photo brute. */
  composed: boolean;
  rows: number;
  perRow: number;
  lang?: string;
  notes?: string;
  devices: TruthDevice[];
}

/** Champs comparés, et leur nom dans la lecture. */
export const FIELDS = ['kind', 'position', 'width', 'rating', 'curve', 'sensitivity', 'rcdType', 'label', 'labelUsage', 'circuitRef'] as const;
export type Field = (typeof FIELDS)[number];

export interface FieldScore {
  /** Appareils appariés où la vérité donne ce champ. */
  n: number;
  correct: number;
  /** Les deux ont une valeur, différente. */
  wrong: number;
  /** Vérité « absent » (null), lecture avec une valeur : valeur INVENTÉE (le plus grave pour un relevé). */
  invented: number;
  /** Vérité avec une valeur, lecture vide (null) : prudent, l'assistant posera une question. */
  missed: number;
}

export interface PhotoScore {
  name: string;
  truth: number;
  predicted: number;
  matched: number;
  /** Appareils de la vérité non lus. */
  missedDevices: number;
  /** Appareils lus en trop (absents de la vérité). */
  extraDevices: number;
  fields: Record<Field, FieldScore>;
  /** Confusion des types : « vérité → lu » → nombre. */
  confusion: Record<string, number>;
  latencyMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  cost?: number;
  error?: string;
}

const zero = (): FieldScore => ({ n: 0, correct: 0, wrong: 0, invented: 0, missed: 0 });
const emptyFields = () => Object.fromEntries(FIELDS.map((f) => [f, zero()])) as Record<Field, FieldScore>;

type Val = string | number | null | undefined;
const normStr = (v: Val) => (v === null || v === undefined || v === '' ? null : String(v).trim().toUpperCase().replace(/\s+/g, ''));
const normText = (v: Val) => (v === null || v === undefined || v === '' ? null : normLabel(String(v)) || null);
const usageOf = (v: Val) => {
  if (v === null || v === undefined || v === '') return null;
  const it = interpretLabel(String(v));
  return it.usages.map(usageKey).join('+') + '|' + (it.room ?? '');
};

function count(s: FieldScore, truth: Val, pred: Val, eq: (a: Val, b: Val) => boolean) {
  if (truth === undefined) return; // non évalué
  s.n++;
  const t = truth === '' ? null : truth;
  const p = pred === undefined || pred === '' ? null : pred;
  if (t === null) {
    if (p === null) s.correct++;
    else s.invented++;
  } else if (p === null) s.missed++;
  else if (eq(t, p)) s.correct++;
  else s.wrong++;
}

/** Appariement vérité ↔ lecture : même rangée et même module d'abord, puis recouvrement d'au moins la moitié. */
export function matchDevices(truth: TruthDevice[], pred: { row: number; d: PhotoDeviceT }[]): [number, number][] {
  const pairs: { ti: number; pi: number; score: number }[] = [];
  truth.forEach((t, ti) =>
    pred.forEach((p, pi) => {
      if (p.row !== t.row) return;
      const tw = Math.max(1, t.widthModules ?? 1);
      const pw = Math.max(1, Math.round(p.d.widthModules));
      const overlap = Math.min(t.startModule + tw, p.d.startModule + pw) - Math.max(t.startModule, p.d.startModule);
      if (p.d.startModule === t.startModule) pairs.push({ ti, pi, score: 100 + overlap });
      else if (overlap > 0 && overlap >= 0.5 * Math.min(tw, pw)) pairs.push({ ti, pi, score: overlap });
    }),
  );
  pairs.sort((a, b) => b.score - a.score);
  const usedT = new Set<number>();
  const usedP = new Set<number>();
  const out: [number, number][] = [];
  for (const p of pairs) {
    if (usedT.has(p.ti) || usedP.has(p.pi)) continue;
    usedT.add(p.ti);
    usedP.add(p.pi);
    out.push([p.ti, p.pi]);
  }
  return out;
}

/** Score d'une photo. */
export function scorePhoto(name: string, truth: GroundTruth, reading: PhotoReadingT): PhotoScore {
  const t = truth.devices.filter((d) => d.kind !== 'blank');
  const p = reading.rows.flatMap((r) => r.devices.filter((d) => d.kind !== 'blank').map((d) => ({ row: r.row, d })));
  const pairs = matchDevices(t, p);
  const fields = emptyFields();
  const confusion: Record<string, number> = {};
  const eq = (a: Val, b: Val) => a === b;
  const eqStr = (a: Val, b: Val) => normStr(a) === normStr(b);
  for (const [ti, pi] of pairs) {
    const a = t[ti];
    const b = p[pi].d;
    count(fields.kind, a.kind, b.kind, eq);
    const key = `${a.kind} → ${b.kind}`;
    confusion[key] = (confusion[key] ?? 0) + 1;
    count(fields.position, a.startModule, b.startModule, eq);
    count(fields.width, a.widthModules, Math.round(b.widthModules), eq);
    count(fields.rating, a.ratedCurrentA, b.ratedCurrentA, eq);
    count(fields.curve, a.curve === undefined ? undefined : normStr(a.curve), normStr(b.curve), eq);
    count(fields.sensitivity, a.residualCurrentmA, b.residualCurrentmA, eq);
    count(fields.rcdType, a.rcdType === undefined ? undefined : normStr(a.rcdType), normStr(b.rcdType), eq);
    count(fields.label, a.label === undefined ? undefined : normText(a.label), normText(b.label), eq);
    // Ce que l'assistant en déduit (usage et pièce) : une petite faute de lecture peut ne rien changer
    count(fields.labelUsage, a.label === undefined ? undefined : usageOf(a.label), usageOf(b.label), eq);
    count(fields.circuitRef, a.circuitRef, b.circuitRef ?? null, eqStr);
  }
  return {
    name,
    truth: t.length,
    predicted: p.length,
    matched: pairs.length,
    missedDevices: t.length - pairs.length,
    extraDevices: p.length - pairs.length,
    fields,
    confusion,
  };
}

/** Somme de plusieurs photos. */
export function total(scores: PhotoScore[]): PhotoScore {
  const out: PhotoScore = { name: 'total', truth: 0, predicted: 0, matched: 0, missedDevices: 0, extraDevices: 0, fields: emptyFields(), confusion: {} };
  for (const s of scores) {
    for (const k of ['truth', 'predicted', 'matched', 'missedDevices', 'extraDevices'] as const) out[k] += s[k];
    for (const f of FIELDS) for (const k of ['n', 'correct', 'wrong', 'invented', 'missed'] as const) out.fields[f][k] += s.fields[f][k];
    for (const [k, v] of Object.entries(s.confusion)) out.confusion[k] = (out.confusion[k] ?? 0) + v;
    for (const k of ['latencyMs', 'tokensIn', 'tokensOut', 'cost'] as const) if (s[k] !== undefined) out[k] = (out[k] ?? 0) + s[k]!;
  }
  return out;
}

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)} %` : '—');

/** Rapport Markdown (français). */
export function report(scores: PhotoScore[], meta: { title: string; mode: string; provider?: string; model?: string; date: string; currency?: string }): string {
  const all = total(scores.filter((s) => !s.error));
  const cur = meta.currency ?? '';
  const ok = scores.filter((s) => !s.error);
  const lines: string[] = [];
  lines.push(`# ${meta.title}`, '');
  lines.push(`- Date : ${meta.date}`);
  lines.push(`- Mode : ${meta.mode}`);
  if (meta.provider) lines.push(`- Fournisseur : ${meta.provider}${meta.model ? ` · modèle : ${meta.model}` : ''}`);
  lines.push(`- Photos : ${scores.length} (${scores.length - ok.length} en erreur)`, '');
  lines.push(
    '> Ce rapport mesure la lecture sur CE corpus seulement. Un résultat obtenu avec des lectures simulées ou des',
    "> exemples synthétiques ne dit rien de la qualité réelle de la reconnaissance : seules des photos réelles",
    '> (anonymisées) avec une vérité terrain vérifiée sur place le peuvent.',
    '',
  );
  lines.push('## Détection des appareils', '');
  lines.push('| Vérité | Lus | Appariés | Rappel | Précision | Non lus | En trop |', '|---:|---:|---:|---:|---:|---:|---:|');
  lines.push(`| ${all.truth} | ${all.predicted} | ${all.matched} | ${pct(all.matched, all.truth)} | ${pct(all.matched, all.predicted)} | ${all.missedDevices} | ${all.extraDevices} |`, '');
  lines.push('## Exactitude par champ (appareils appariés)', '');
  lines.push(
    '« Inventé » : la vérité dit absent ou illisible, la lecture donne une valeur (le plus grave). « Manqué » : valeur',
    "réelle non lue (l'assistant posera une question).",
    '',
  );
  lines.push('| Champ | Évalués | Exact | Faux | Inventé | Manqué | Exactitude |', '|---|---:|---:|---:|---:|---:|---:|');
  const names: Record<Field, string> = {
    kind: 'Type',
    position: 'Position (module)',
    width: 'Largeur (modules)',
    rating: 'Calibre',
    curve: 'Courbe',
    sensitivity: 'Sensibilité',
    rcdType: 'Type de différentiel',
    label: 'Étiquette (texte)',
    labelUsage: 'Étiquette (usage et pièce déduits)',
    circuitRef: 'Repère du circuit',
  };
  for (const f of FIELDS) {
    const s = all.fields[f];
    lines.push(`| ${names[f]} | ${s.n} | ${s.correct} | ${s.wrong} | ${s.invented} | ${s.missed} | ${pct(s.correct, s.n)} |`);
  }
  lines.push('', '## Confusion des types (vérité → lu)', '');
  const conf = Object.entries(all.confusion).sort((a, b) => b[1] - a[1]);
  if (!conf.length) lines.push('Aucun appareil apparié.');
  else {
    lines.push('| Vérité → lu | Nombre |', '|---|---:|');
    for (const [k, v] of conf) lines.push(`| ${k}${k.split(' → ')[0] === k.split(' → ')[1] ? '' : ' ⚠'} | ${v} |`);
  }
  lines.push('', '## Par photo', '');
  lines.push(`| Photo | Vérité | Lus | Appariés | Type | Calibre | Inventés | Durée (s) | Jetons (entrée / sortie) | Coût${cur ? ` (${cur})` : ''} |`, '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const s of scores) {
    if (s.error) {
      lines.push(`| ${s.name} | — | — | — | — | — | — | ${s.latencyMs !== undefined ? (s.latencyMs / 1000).toFixed(1) : '—'} | — | — |  ⚠ ${s.error.replace(/\|/g, '/')}`);
      continue;
    }
    const inv = FIELDS.reduce((n, f) => n + s.fields[f].invented, 0);
    lines.push(
      `| ${s.name} | ${s.truth} | ${s.predicted} | ${s.matched} | ${pct(s.fields.kind.correct, s.fields.kind.n)} | ${pct(s.fields.rating.correct, s.fields.rating.n)} | ${inv} | ${
        s.latencyMs !== undefined ? (s.latencyMs / 1000).toFixed(1) : '—'
      } | ${s.tokensIn ?? '—'} / ${s.tokensOut ?? '—'} | ${s.cost !== undefined ? s.cost.toFixed(4) : '—'} |`,
    );
  }
  if (ok.length && all.latencyMs !== undefined) {
    lines.push('', `Durée moyenne : ${(all.latencyMs / ok.length / 1000).toFixed(1)} s par photo.`);
    if (all.cost !== undefined) lines.push(`Coût moyen : ${(all.cost / ok.length).toFixed(4)} ${cur} par photo (tarif saisi au lancement).`);
  }
  lines.push('');
  return lines.join('\n');
}

/** Vérité terrain valide ? (message d'erreur lisible, sinon null) */
export function checkTruth(x: unknown): string | null {
  const t = x as Partial<GroundTruth>;
  if (!t || typeof t !== 'object') return 'pas un objet JSON';
  if (t.format !== TRUTH_FORMAT) return `format attendu « ${TRUTH_FORMAT} »`;
  if (typeof t.image !== 'string' || !t.image) return 'image manquante';
  if (!(Number(t.rows) >= 1) || !(Number(t.perRow) >= 1)) return 'rows / perRow manquants';
  if (!Array.isArray(t.devices)) return 'devices manquant';
  for (const [i, d] of t.devices.entries()) if (typeof d.row !== 'number' || typeof d.startModule !== 'number' || typeof d.kind !== 'string') return `appareil ${i} : row, startModule et kind obligatoires`;
  return null;
}
