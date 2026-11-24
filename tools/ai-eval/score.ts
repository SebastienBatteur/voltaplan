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
  /** Nombre de pôles (« 1P », « 1P+N », « 2P », « 3P », « 4P »…) tel que marqué sur l'appareil. */
  poles?: string | null;
  /**
   * Champs dont l'annotateur n'est PAS sûr (noms de la vérité : « ratedCurrentA », « label »…) : non évalués,
   * comptés à part. Ne pas confondre avec `null` (l'annotateur est sûr que la valeur est absente ou illisible).
   */
  unsure?: string[];
  /**
   * Champs à `null` parce que la valeur existe sur l'appareil mais est ILLISIBLE sur la photo (sinon `null` = absente
   * de l'appareil). Sert à distinguer, parmi les valeurs inventées, celles inventées sur un illisible.
   */
  unreadable?: string[];
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
export const FIELDS = ['kind', 'position', 'width', 'rating', 'curve', 'sensitivity', 'rcdType', 'poles', 'label', 'labelExact', 'labelUsage', 'circuitRef'] as const;
export type Field = (typeof FIELDS)[number];

/** Champ de la vérité terrain correspondant à chaque champ évalué (pour `unsure` et `unreadable`). */
export const TRUTH_KEY: Record<Field, keyof TruthDevice> = {
  kind: 'kind',
  position: 'startModule',
  width: 'widthModules',
  rating: 'ratedCurrentA',
  curve: 'curve',
  sensitivity: 'residualCurrentmA',
  rcdType: 'rcdType',
  poles: 'poles',
  label: 'label',
  labelExact: 'label',
  labelUsage: 'label',
  circuitRef: 'circuitRef',
};
/** Champs de la vérité qu'on peut marquer `unsure` / `unreadable`. */
export const ANNOTABLE = new Set<string>(Object.values(TRUTH_KEY));

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
  /** Évalués où la vérité dit « absent ou illisible » (null) : dénominateur du taux d'invention. */
  truthNull: number;
  /** Parmi les inventés : valeur présente sur l'appareil mais illisible sur la photo (`unreadable`). */
  inventedOnUnreadable: number;
  /** Non évalués : l'annotateur n'était pas sûr (`unsure`). */
  unsure: number;
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

export const FIELD_COUNTS = ['n', 'correct', 'wrong', 'invented', 'missed', 'truthNull', 'inventedOnUnreadable', 'unsure'] as const;
const zero = (): FieldScore => ({ n: 0, correct: 0, wrong: 0, invented: 0, missed: 0, truthNull: 0, inventedOnUnreadable: 0, unsure: 0 });
export const emptyFields = () => Object.fromEntries(FIELDS.map((f) => [f, zero()])) as Record<Field, FieldScore>;

type Val = string | number | null | undefined;
const normStr = (v: Val) => (v === null || v === undefined || v === '' ? null : String(v).trim().toUpperCase().replace(/\s+/g, ''));
const normText = (v: Val) => (v === null || v === undefined || v === '' ? null : normLabel(String(v)) || null);
const exactText = (v: Val) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim().replace(/\s+/g, ' '));
const usageOf = (v: Val) => {
  if (v === null || v === undefined || v === '') return null;
  const it = interpretLabel(String(v));
  return it.usages.map(usageKey).join('+') + '|' + (it.room ?? '');
};

/** Résultat d'une comparaison (un champ d'un appareil apparié). `skip` : champ non évalué (absent de la vérité). */
export type Outcome = 'correct' | 'wrong' | 'invented' | 'missed' | 'unsure' | 'skip';

function outcome(truth: Val, pred: Val, eq: (a: Val, b: Val) => boolean): Outcome {
  if (truth === undefined) return 'skip';
  const t = truth === '' ? null : truth;
  const p = pred === undefined || pred === '' ? null : pred;
  if (t === null) return p === null ? 'correct' : 'invented';
  if (p === null) return 'missed';
  return eq(t, p) ? 'correct' : 'wrong';
}

export interface Comparison {
  field: Field;
  /** Valeurs comparées, normalisées (null : vide ; undefined : non évalué). */
  truth: Val;
  pred: Val;
  outcome: Outcome;
  /** Vérité à null parce qu'illisible (et non absente). */
  unreadable: boolean;
}

/** Compare champ par champ un appareil de la vérité et l'appareil lu qui lui est apparié. */
export function compareDevice(a: TruthDevice, b: PhotoDeviceT): Comparison[] {
  const eq = (x: Val, y: Val) => x === y;
  const eqStr = (x: Val, y: Val) => normStr(x) === normStr(y);
  const opt = <T>(v: T | undefined, f: (x: T) => Val): Val => (v === undefined ? undefined : f(v));
  const rows: [Field, Val, Val, (x: Val, y: Val) => boolean][] = [
    ['kind', a.kind, b.kind, eq],
    ['position', a.startModule, b.startModule, eq],
    ['width', a.widthModules, Math.round(b.widthModules), eq],
    ['rating', a.ratedCurrentA, b.ratedCurrentA, eq],
    ['curve', opt(a.curve, normStr), normStr(b.curve), eq],
    ['sensitivity', a.residualCurrentmA, b.residualCurrentmA, eq],
    ['rcdType', opt(a.rcdType, normStr), normStr(b.rcdType), eq],
    ['poles', opt(a.poles, normStr), normStr(b.poles), eq],
    ['label', opt(a.label, normText), normText(b.label), eq],
    ['labelExact', opt(a.label, exactText), exactText(b.label), eq],
    // Ce que l'assistant en déduit (usage et pièce) : une petite faute de lecture peut ne rien changer
    ['labelUsage', opt(a.label, usageOf), usageOf(b.label), eq],
    ['circuitRef', a.circuitRef, b.circuitRef ?? null, eqStr],
  ];
  return rows.map(([field, t, p, e]) => {
    const key = TRUTH_KEY[field];
    const unsure = t !== undefined && !!a.unsure?.includes(key);
    return { field, truth: t, pred: p, outcome: unsure ? 'unsure' : outcome(t, p, e), unreadable: !!a.unreadable?.includes(key) };
  });
}

function count(s: FieldScore, c: Comparison) {
  if (c.outcome === 'skip') return;
  if (c.outcome === 'unsure') {
    s.unsure++;
    return;
  }
  s.n++;
  if (c.truth === null || c.truth === '') s.truthNull++;
  s[c.outcome]++;
  if (c.outcome === 'invented' && c.unreadable) s.inventedOnUnreadable++;
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

/** Appareils évalués d'une vérité (caches exclus) et d'une lecture (caches exclus, avec leur rangée). */
export const truthDevices = (truth: GroundTruth) => truth.devices.filter((d) => d.kind !== 'blank');
export const readDevices = (reading: PhotoReadingT) => reading.rows.flatMap((r) => r.devices.filter((d) => d.kind !== 'blank').map((d) => ({ row: r.row, d })));

/** Score d'une photo. */
export function scorePhoto(name: string, truth: GroundTruth, reading: PhotoReadingT): PhotoScore {
  const t = truthDevices(truth);
  const p = readDevices(reading);
  const pairs = matchDevices(t, p);
  const fields = emptyFields();
  const confusion: Record<string, number> = {};
  for (const [ti, pi] of pairs) {
    const a = t[ti];
    const b = p[pi].d;
    const key = `${a.kind} → ${b.kind}`;
    confusion[key] = (confusion[key] ?? 0) + 1;
    for (const c of compareDevice(a, b)) count(fields[c.field], c);
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
    for (const f of FIELDS) for (const k of FIELD_COUNTS) out.fields[f][k] += s.fields[f]?.[k] ?? 0;
    for (const [k, v] of Object.entries(s.confusion)) out.confusion[k] = (out.confusion[k] ?? 0) + v;
    for (const k of ['latencyMs', 'tokensIn', 'tokensOut', 'cost'] as const) if (s[k] !== undefined) out[k] = (out[k] ?? 0) + s[k]!;
  }
  return out;
}

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)} %` : '—');

/** Nom des champs dans les rapports. */
export const FIELD_NAMES: Record<Field, string> = {
  kind: 'Type',
  position: 'Position (module)',
  width: 'Largeur (modules)',
  rating: 'Calibre',
  curve: 'Courbe',
  sensitivity: 'Sensibilité',
  rcdType: 'Type de différentiel',
  poles: 'Pôles',
  label: 'Étiquette (texte normalisé)',
  labelExact: 'Étiquette (texte exact)',
  labelUsage: 'Étiquette (usage et pièce déduits)',
  circuitRef: 'Repère du circuit',
};

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
    "réelle non lue (l'assistant posera une question). « Incertains » : l'annotateur n'était pas sûr, non évalués.",
    '',
  );
  lines.push('| Champ | Évalués | Exact | Faux | Inventé | Manqué | Exactitude | Incertains (non évalués) |', '|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const f of FIELDS) {
    const s = all.fields[f];
    lines.push(`| ${FIELD_NAMES[f]} | ${s.n} | ${s.correct} | ${s.wrong} | ${s.invented} | ${s.missed} | ${pct(s.correct, s.n)} | ${s.unsure} |`);
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
  for (const [i, d] of t.devices.entries()) {
    if (typeof d.row !== 'number' || typeof d.startModule !== 'number' || typeof d.kind !== 'string') return `appareil ${i} : row, startModule et kind obligatoires`;
    for (const k of ['unsure', 'unreadable'] as const) {
      const v = d[k];
      if (v === undefined) continue;
      if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || !ANNOTABLE.has(x))) return `appareil ${i} : ${k} doit lister des champs de la vérité (${[...ANNOTABLE].join(', ')})`;
    }
    for (const k of d.unreadable ?? []) if ((d as unknown as Record<string, unknown>)[k] !== null) return `appareil ${i} : « ${k} » marqué illisible doit valoir null`;
  }
  return null;
}
