/**
 * Mode MATRICE du banc d'évaluation : plusieurs fournisseurs et modèles comparés sur le même corpus (qualité, valeurs
 * inventées, durée, jetons, coût), avec répétitions pour mesurer la variance.
 *
 * Sécurité des coûts :
 *  - par défaut, AUCUN appel : le banc affiche le plan (nombre d'appels, jetons et coût estimés par fournisseur) ;
 *  - un appel n'est fait qu'avec `--live --i-authorize-costs`, et, pour un fournisseur payant, avec un prix connu,
 *    une clé dans une variable d'environnement et un plafond `--max-cost` (le banc s'arrête en l'atteignant) ;
 *  - les modèles locaux (Ollama, LM Studio : adresse localhost) sont gratuits ; un « rejeu » relit des lectures
 *    enregistrées, sans appel.
 *
 * Fonctions pures ou à dépendances injectées (le lecteur), testées sans réseau : test/aiEvalMatrix.test.ts. Ces tests
 * utilisent des lectures SIMULÉES : ils vérifient le calcul, jamais la qualité réelle de la reconnaissance.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { composedGeometry } from '../../src/ai/boardImage';
import type { PhotoReadingT } from '../../src/ai/boardPhoto';
import { boardPhotoPrompt, PhotoReading } from '../../src/ai/boardPhotoAi';
import { isLocalUrl, type ProviderId } from '../../src/ai/provider';
import { repeatability, summarize, verdicts, type QualitySummary } from './metrics';
import { scoreCase, summarizeCases, type EvalCase, type PipelineSummary } from './pipeline';
import { FIELDS, scorePhoto, type GroundTruth, type PhotoScore } from './score';
import { fmtPct, fmtProp, mean, sd } from './stats';

export const MATRIX_FORMAT = 'voltaplan-ai-eval-matrix/1';
export const RESULTS_FORMAT = 'voltaplan-ai-eval-results/1';
/** Plafond de jetons de sortie par appel (celui de src/ai/provider.ts) : sert au coût maximal possible. */
export const MAX_OUTPUT_TOKENS = 16000;

export interface MatrixEntry {
  /** Identifiant court (nom de dossier des résultats) : lettres, chiffres, « . », « _ », « - ». */
  id: string;
  provider: ProviderId;
  model: string;
  /** API compatible OpenAI (ex. http://localhost:11434/v1 pour Ollama). */
  baseUrl?: string;
  /** Variable d'environnement qui contient la clé (jamais la clé elle-même). */
  keyEnv?: string;
  /** Prix par million de jetons, à recopier depuis la page de tarifs du fournisseur (null : inconnu). */
  priceInPerMTok?: number | null;
  priceOutPerMTok?: number | null;
  /** Rejeu : dossier de lectures déjà faites (`<nom>.prediction.json`), relatif au fichier de configuration. */
  replayDir?: string;
  notes?: string;
}

export interface MatrixConfig {
  format: typeof MATRIX_FORMAT;
  /** Devise des prix (USD, EUR…). */
  currency?: string;
  /** Répétitions par photo (variance) ; remplaçable par --repetitions. */
  repetitions?: number;
  entries: MatrixEntry[];
}

export type CostClass = 'replay' | 'local' | 'paid';

/** Rejeu (aucun appel), modèle local (gratuit, rien ne sort de la machine) ou fournisseur payant. */
export function costClass(e: MatrixEntry): CostClass {
  if (e.replayDir) return 'replay';
  if (e.provider === 'openaiCompatible' && isLocalUrl(e.baseUrl)) return 'local';
  return 'paid';
}

export const CLASS_LABEL: Record<CostClass, string> = { replay: 'rejeu (aucun appel)', local: 'local (gratuit)', paid: 'payant' };

const ENTRY_KEYS = new Set(['id', 'provider', 'model', 'baseUrl', 'keyEnv', 'priceInPerMTok', 'priceOutPerMTok', 'replayDir', 'notes']);

/** Configuration valide ? Les erreurs sont lisibles et listées toutes ensemble. */
export function checkMatrix(x: unknown): { ok: true; config: MatrixConfig } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const c = x as Partial<MatrixConfig>;
  if (!c || typeof c !== 'object') return { ok: false, errors: ['pas un objet JSON'] };
  if (c.format !== MATRIX_FORMAT) errors.push(`format attendu « ${MATRIX_FORMAT} »`);
  if (c.currency !== undefined && (typeof c.currency !== 'string' || !/^[A-Z]{3}$/.test(c.currency))) errors.push('currency : code à 3 lettres (USD, EUR…)');
  if (c.repetitions !== undefined && !(Number.isInteger(c.repetitions) && c.repetitions >= 1 && c.repetitions <= 20)) errors.push('repetitions : entier de 1 à 20');
  if (!Array.isArray(c.entries) || !c.entries.length) errors.push('entries : au moins une entrée');
  const ids = new Set<string>();
  for (const [i, e] of (Array.isArray(c.entries) ? c.entries : []).entries()) {
    const at = `entrée ${i}${e && typeof e.id === 'string' ? ` (${e.id})` : ''}`;
    if (!e || typeof e !== 'object') {
      errors.push(`${at} : pas un objet`);
      continue;
    }
    for (const k of Object.keys(e)) {
      if (/key|token|secret|password/i.test(k) && k !== 'keyEnv') errors.push(`${at} : champ « ${k} » interdit — jamais de clé dans ce fichier, utilisez keyEnv (nom d'une variable d'environnement)`);
      else if (!ENTRY_KEYS.has(k)) errors.push(`${at} : champ inconnu « ${k} »`);
    }
    if (typeof e.id !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(e.id)) errors.push(`${at} : id (lettres, chiffres, « . », « _ », « - »)`);
    else if (ids.has(e.id)) errors.push(`${at} : id en double`);
    else ids.add(e.id);
    if (e.provider !== 'anthropic' && e.provider !== 'openaiCompatible') errors.push(`${at} : provider = anthropic ou openaiCompatible`);
    if (typeof e.model !== 'string' || (!e.model.trim() && !e.replayDir)) errors.push(`${at} : model obligatoire`);
    if (e.baseUrl !== undefined) {
      if (e.provider === 'anthropic') errors.push(`${at} : baseUrl réservé à openaiCompatible`);
      else if (typeof e.baseUrl !== 'string' || !/^https?:\/\/[^\s]+$/i.test(e.baseUrl)) errors.push(`${at} : baseUrl doit être une adresse http(s)`);
    } else if (e.provider === 'openaiCompatible' && !e.replayDir) errors.push(`${at} : baseUrl obligatoire pour openaiCompatible`);
    if (e.keyEnv !== undefined && (typeof e.keyEnv !== 'string' || !/^[A-Z_][A-Z0-9_]*$/.test(e.keyEnv))) errors.push(`${at} : keyEnv = NOM_DE_VARIABLE (majuscules), jamais la clé`);
    for (const k of ['priceInPerMTok', 'priceOutPerMTok'] as const) {
      const v = e[k];
      if (v !== undefined && v !== null && !(typeof v === 'number' && Number.isFinite(v) && v >= 0)) errors.push(`${at} : ${k} = nombre ≥ 0 ou null`);
    }
    if (e.replayDir !== undefined && (typeof e.replayDir !== 'string' || !e.replayDir)) errors.push(`${at} : replayDir = dossier`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, config: c as MatrixConfig };
}

// ---------------------------------------------------------------------------
// Estimation (mode simulation) : appels, jetons, coût
// ---------------------------------------------------------------------------

export interface CorpusPhoto {
  /** Nom (fichier de vérité sans « .truth.json »). */
  name: string;
  truth: GroundTruth;
  /** Dimensions de l'image (absentes : image introuvable, estimation d'après la vérité). */
  image?: { width: number; height: number };
  /** Chemin de l'image (pour la lecture réelle). */
  imagePath?: string;
}

/**
 * Jetons d'une image, règle publiée par Anthropic (largeur × hauteur / 750, après réduction à 1 568 px de côté et
 * environ 1,15 Mpx) ; appliquée aussi aux autres fournisseurs faute de mieux : ESTIMATION, à corriger par les mesures
 * d'une première passe (option --previous).
 */
export function imageTokens(width: number, height: number): number {
  let w = Math.max(1, width);
  let h = Math.max(1, height);
  const k1 = Math.min(1, 1568 / Math.max(w, h));
  w *= k1;
  h *= k1;
  const k2 = Math.min(1, Math.sqrt(1_150_000 / (w * h)));
  return Math.ceil((w * k2 * h * k2) / 750);
}

let schemaChars: number | undefined;
/** Jetons d'entrée (image + consigne + schéma) et de sortie (environ 120 par appareil) estimés pour une photo. */
export function estimatePhotoTokens(p: CorpusPhoto): { in: number; out: number } {
  const t = p.truth;
  const img = p.image ?? (t.composed ? composedGeometry(Array.from({ length: t.rows }, () => ({ a: { x: 0, y: 0 }, b: { x: 1, y: 0 } })), t.perRow) : { width: 1600, height: 1200 });
  schemaChars ??= JSON.stringify(z.toJSONSchema(PhotoReading)).length;
  const prompt = boardPhotoPrompt({ rows: t.rows, perRow: t.perRow, lang: t.lang ?? 'fr', composed: !!t.composed }).length;
  const devices = Math.max(1, t.devices.length);
  return { in: imageTokens(img.width, img.height) + Math.ceil((prompt + schemaChars) / 3.5) + 20, out: 60 + 120 * devices };
}

export interface EntryPlan {
  id: string;
  provider: ProviderId;
  model: string;
  cls: CostClass;
  /** Appels réels prévus (0 pour un rejeu). */
  calls: number;
  tokensIn: number;
  tokensOut: number;
  /** D'où vient l'estimation des jetons. */
  source: 'estimation' | 'mesures précédentes';
  /** Coût estimé (0 : gratuit ; null : prix inconnu). */
  cost: number | null;
  /** Coût maximal possible (sortie au plafond de jetons à chaque appel). */
  costCeiling: number | null;
}

export interface Plan {
  photos: number;
  repetitions: number;
  entries: EntryPlan[];
  calls: number;
  paidCalls: number;
  /** Coût estimé des entrées payantes au prix connu. */
  cost: number;
  costCeiling: number;
  /** Entrées payantes sans prix : coût inconnu (refusées en lecture réelle). */
  unknownPrice: string[];
}

export function planMatrix(config: MatrixConfig, photos: CorpusPhoto[], opts: { repetitions?: number; previous?: Map<string, { in: number; out: number }> } = {}): Plan {
  const reps = opts.repetitions ?? config.repetitions ?? 1;
  const est = photos.map(estimatePhotoTokens);
  const entries = config.entries.map((e): EntryPlan => {
    const cls = costClass(e);
    const calls = cls === 'replay' ? 0 : photos.length * reps;
    const prev = opts.previous?.get(e.id);
    const tokensIn = prev ? Math.round(prev.in * calls) : reps * est.reduce((n, x) => n + x.in, 0) * (calls ? 1 : 0);
    const tokensOut = prev ? Math.round(prev.out * calls) : reps * est.reduce((n, x) => n + x.out, 0) * (calls ? 1 : 0);
    const priced = e.priceInPerMTok !== undefined && e.priceInPerMTok !== null && e.priceOutPerMTok !== undefined && e.priceOutPerMTok !== null;
    const cost = cls !== 'paid' ? 0 : priced ? (tokensIn * e.priceInPerMTok! + tokensOut * e.priceOutPerMTok!) / 1e6 : null;
    const costCeiling = cls !== 'paid' ? 0 : priced ? (tokensIn * e.priceInPerMTok! + calls * MAX_OUTPUT_TOKENS * e.priceOutPerMTok!) / 1e6 : null;
    return { id: e.id, provider: e.provider, model: e.model, cls, calls, tokensIn, tokensOut, source: prev ? 'mesures précédentes' : 'estimation', cost, costCeiling };
  });
  const paid = entries.filter((x) => x.cls === 'paid');
  return {
    photos: photos.length,
    repetitions: reps,
    entries,
    calls: entries.reduce((n, x) => n + x.calls, 0),
    paidCalls: paid.reduce((n, x) => n + x.calls, 0),
    cost: paid.reduce((n, x) => n + (x.cost ?? 0), 0),
    costCeiling: paid.reduce((n, x) => n + (x.costCeiling ?? 0), 0),
    unknownPrice: paid.filter((x) => x.cost === null).map((x) => x.id),
  };
}

const money = (v: number | null, cur: string) => (v === null ? 'prix inconnu' : `${v.toFixed(v && v < 0.01 ? 4 : 2)} ${cur}`);

export function formatPlan(plan: Plan, currency = 'USD'): string {
  const l: string[] = [];
  l.push(`Plan : ${plan.photos} photo(s) × ${plan.repetitions} répétition(s)`, '');
  l.push('| Entrée | Modèle | Type | Appels | Jetons entrée | Jetons sortie | Source | Coût estimé | Coût maximal |', '|---|---|---|---:|---:|---:|---|---:|---:|');
  for (const e of plan.entries)
    l.push(`| ${e.id} | ${e.provider} · ${e.model || '—'} | ${CLASS_LABEL[e.cls]} | ${e.calls} | ${e.tokensIn} | ${e.tokensOut} | ${e.source} | ${money(e.cost, currency)} | ${money(e.costCeiling, currency)} |`);
  l.push('');
  l.push(
    `Total : ${plan.calls} appel(s) dont ${plan.paidCalls} payant(s) ; coût estimé ${money(plan.cost, currency)}, maximal ${money(plan.costCeiling, currency)}${plan.unknownPrice.length ? ' (hors entrées au prix inconnu)' : ''}.`,
  );
  if (plan.unknownPrice.length) l.push(`Prix inconnu (lecture réelle refusée) : ${plan.unknownPrice.join(', ')}.`);
  l.push('Estimation approximative (taille des images, longueur de la consigne) : vérifier les tarifs du fournisseur.');
  return l.join('\n');
}

// ---------------------------------------------------------------------------
// Autorisation : rien n'est appelé sans --live --i-authorize-costs
// ---------------------------------------------------------------------------

export interface LiveFlags {
  live: boolean;
  authorize: boolean;
  maxCost?: number;
}

export const defaultKeyEnv = (e: MatrixEntry) => e.keyEnv ?? (e.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY');

/** Lecture réelle autorisée ? Toutes les raisons de refus sont données d'un coup, AVANT tout appel. */
export function authorize(config: MatrixConfig, plan: Plan, flags: LiveFlags, env: Record<string, string | undefined>): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!flags.live) return { ok: false, reasons: ['mode simulation : aucun appel (ajoutez --live --i-authorize-costs pour lancer réellement)'] };
  if (!flags.authorize) reasons.push('--live exige aussi --i-authorize-costs (autorisation explicite des appels et de leur coût)');
  const paid = config.entries.filter((e) => costClass(e) === 'paid');
  for (const e of paid) {
    const p = plan.entries.find((x) => x.id === e.id);
    if (!p || p.cost === null) reasons.push(`${e.id} : prix inconnu (priceInPerMTok / priceOutPerMTok) — coût impossible à estimer`);
    if (!env[defaultKeyEnv(e)]) reasons.push(`${e.id} : variable d'environnement ${defaultKeyEnv(e)} absente (clé)`);
  }
  if (paid.length) {
    if (flags.maxCost === undefined || !Number.isFinite(flags.maxCost) || flags.maxCost < 0) reasons.push('fournisseur payant : plafond --max-cost <montant> obligatoire');
    else if (plan.cost > flags.maxCost) reasons.push(`coût estimé ${plan.cost.toFixed(2)} supérieur au plafond --max-cost ${flags.maxCost}`);
  }
  return { ok: !reasons.length, reasons };
}

// ---------------------------------------------------------------------------
// Exécution (séquentielle) : lecteur injecté, plafond de coût
// ---------------------------------------------------------------------------

export interface ReadResult {
  reading: PhotoReadingT;
  tokensIn?: number;
  tokensOut?: number;
}
/** Lecture réelle d'une photo par un modèle (injectée : les tests n'en fournissent qu'une simulée). */
export type Reader = (entry: MatrixEntry, photo: CorpusPhoto) => Promise<ReadResult>;
/** Lecture enregistrée (rejeu) ; undefined si absente. */
export type Replayer = (entry: MatrixEntry, photo: CorpusPhoto) => PhotoReadingT | undefined;

export interface RunRecord {
  entry: string;
  rep: number;
  photo: string;
  latencyMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  cost?: number;
  /** Coût estimé (jetons non communiqués par le fournisseur). */
  costEstimated?: boolean;
  error?: string;
  /** Lecture enregistrée, chemin relatif au dossier du lancement. */
  prediction?: string;
}

/** entrée → répétition (1…N) → photo → lecture. */
export type Readings = Map<string, Map<number, Map<string, PhotoReadingT>>>;

export interface RunOutput {
  records: RunRecord[];
  readings: Readings;
  /** Arrêt avant la fin (plafond de coût atteint). */
  stopped?: string;
}

export async function runMatrix(opts: {
  config: MatrixConfig;
  photos: CorpusPhoto[];
  repetitions: number;
  reader: Reader;
  replay: Replayer;
  maxCost?: number;
  /** Dossier des résultats (lectures enregistrées) ; absent : rien n'est écrit. */
  outDir?: string;
  log?: (s: string) => void;
  clock?: () => number;
}): Promise<RunOutput> {
  const clock = opts.clock ?? (() => performance.now());
  const log = opts.log ?? (() => {});
  const records: RunRecord[] = [];
  const readings: Readings = new Map();
  let spent = 0;
  for (const e of opts.config.entries) {
    const cls = costClass(e);
    const byRep = new Map<number, Map<string, PhotoReadingT>>();
    readings.set(e.id, byRep);
    const reps = cls === 'replay' ? 1 : opts.repetitions;
    for (let rep = 1; rep <= reps; rep++) {
      const got = new Map<string, PhotoReadingT>();
      byRep.set(rep, got);
      for (const p of opts.photos) {
        const rec: RunRecord = { entry: e.id, rep, photo: p.name };
        records.push(rec);
        if (cls === 'replay') {
          const r = opts.replay(e, p);
          if (r) got.set(p.name, r);
          else rec.error = 'lecture enregistrée absente';
          continue;
        }
        if (cls === 'paid' && opts.maxCost !== undefined && spent >= opts.maxCost) {
          rec.error = 'non lu : plafond de coût atteint';
          const stopped = `plafond --max-cost ${opts.maxCost} atteint (${spent.toFixed(4)} dépensés)`;
          log(`⚠ ${stopped} : arrêt`);
          records.pop();
          return { records, readings, stopped };
        }
        const t0 = clock();
        try {
          const r = await opts.reader(e, p);
          rec.latencyMs = clock() - t0;
          rec.tokensIn = r.tokensIn;
          rec.tokensOut = r.tokensOut;
          got.set(p.name, r.reading);
          if (opts.outDir) {
            const rel = join(e.id, `rep${rep}`, `${p.name}.prediction.json`);
            mkdirSync(join(opts.outDir, e.id, `rep${rep}`), { recursive: true });
            writeFileSync(join(opts.outDir, rel), JSON.stringify(r.reading, null, 2) + '\n');
            rec.prediction = rel.split('\\').join('/');
          }
        } catch (err) {
          rec.latencyMs = clock() - t0;
          rec.error = (err as Error).message.slice(0, 200);
        }
        if (cls === 'paid') {
          const priced = e.priceInPerMTok != null && e.priceOutPerMTok != null;
          if (priced) {
            const est = estimatePhotoTokens(p);
            const tin = rec.tokensIn ?? est.in;
            const tout = rec.tokensOut ?? (rec.error ? 0 : est.out);
            rec.costEstimated = rec.tokensIn === undefined || rec.tokensOut === undefined;
            rec.cost = (tin * e.priceInPerMTok! + tout * e.priceOutPerMTok!) / 1e6;
            spent += rec.cost;
          }
        } else rec.cost = 0;
        log(`${rec.error ? '✗' : '✓'} ${e.id} #${rep} ${p.name}${rec.error ? ' : ' + rec.error : ''}`);
      }
    }
  }
  return { records, readings };
}

/** Jetons moyens par appel et par entrée, mesurés lors d'un lancement précédent (pour --previous). */
export function previousTokens(records: RunRecord[]): Map<string, { in: number; out: number }> {
  const out = new Map<string, { in: number; out: number }>();
  for (const id of new Set(records.map((r) => r.entry))) {
    const rs = records.filter((r) => r.entry === id && r.tokensIn !== undefined && r.tokensOut !== undefined);
    if (rs.length) out.set(id, { in: mean(rs.map((r) => r.tokensIn!))!, out: mean(rs.map((r) => r.tokensOut!))! });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rapport de comparaison
// ---------------------------------------------------------------------------

export interface EntryResult {
  entry: MatrixEntry;
  cls: CostClass;
  reps: number;
  summary: QualitySummary;
  perRep: QualitySummary[];
  repeat?: ReturnType<typeof repeatability>;
  pipeline?: PipelineSummary;
  /** Coût pour 100 tableaux (coût moyen par photo × photos par tableau × 100). */
  costPer100Boards?: number;
  photoScores: PhotoScore[];
}

const EMPTY_READING: PhotoReadingT = { rows: [], notes: null };

/** Scores d'une entrée (toutes répétitions), puis chaîne complète sur les installations du corpus. */
export function evaluateEntry(
  entry: MatrixEntry,
  records: RunRecord[],
  readings: Readings,
  truths: Map<string, GroundTruth>,
  cases: { name: string; c: EvalCase }[],
): EntryResult {
  const byRep = readings.get(entry.id) ?? new Map<number, Map<string, PhotoReadingT>>();
  const repNums = [...new Set(records.filter((r) => r.entry === entry.id).map((r) => r.rep))].sort((a, b) => a - b);
  const perRepScores = repNums.map((rep) =>
    records
      .filter((r) => r.entry === entry.id && r.rep === rep)
      .map((r): PhotoScore => {
        const truth = truths.get(r.photo);
        const reading = byRep.get(rep)?.get(r.photo);
        const base = truth ? scorePhoto(repNums.length > 1 ? `${r.photo} #${rep}` : r.photo, truth, reading ?? EMPTY_READING) : scorePhoto(r.photo, { format: 'voltaplan-ai-eval/1', image: '', composed: true, rows: 1, perRow: 1, devices: [] }, EMPTY_READING);
        return { ...base, latencyMs: r.latencyMs, tokensIn: r.tokensIn, tokensOut: r.tokensOut, cost: r.cost, ...(r.error || !reading ? { error: r.error ?? 'lecture absente' } : {}) };
      }),
  );
  const photoScores = perRepScores.flat();
  const summary = summarize(photoScores);
  const perRep = perRepScores.map(summarize);
  const repMaps = repNums.map((rep) => byRep.get(rep) ?? new Map<string, PhotoReadingT>());
  const repeat = repMaps.length > 1 ? repeatability(truths, repMaps) : undefined;
  let pipeline: PipelineSummary | undefined;
  if (cases.length) {
    const scores = repMaps.flatMap((m) =>
      cases.map(({ name, c }) => {
        try {
          return scoreCase(name, c, truths, m);
        } catch (err) {
          return { name, boards: [], questions: 0, extraBoards: 0, duplicates: 0, missingReadings: [], error: (err as Error).message };
        }
      }),
    );
    pipeline = summarizeCases(scores);
  }
  const photosPerBoard = cases.length ? cases.reduce((n, x) => n + x.c.boards.reduce((m, b) => m + b.photos.length, 0), 0) / cases.reduce((n, x) => n + x.c.boards.length, 0) : 1;
  const costPer100Boards = summary.costPerPhoto !== undefined ? summary.costPerPhoto * photosPerBoard * 100 : costClass(entry) !== 'paid' ? 0 : undefined;
  return { entry, cls: costClass(entry), reps: repNums.length, summary, perRep, repeat, pipeline, costPer100Boards, photoScores };
}

const sec = (ms?: number) => (ms === undefined ? '—' : (ms / 1000).toFixed(1).replace('.', ',') + ' s');
const int = (v?: number) => (v === undefined ? '—' : String(Math.round(v)));
const cash = (v: number | undefined, cur: string) => (v === undefined ? '—' : `${v.toFixed(v && v < 0.1 ? 4 : 2)} ${cur}`);
const mSd = (v: (number | undefined)[]) => {
  const x = v.filter((n): n is number => n !== undefined);
  const m = mean(x);
  return m === undefined ? '—' : `${Math.round(100 * m)} % ± ${Math.round(100 * (sd(x) ?? 0))}`;
};

export function compareReport(opts: { results: EntryResult[]; date: string; corpus: string; photos: number; cases: number; currency: string; plan?: Plan; stopped?: string }): string {
  const { results, currency: cur } = opts;
  const l: string[] = [];
  l.push('# Comparaison des modèles : lecture des photos de tableaux', '');
  l.push(`- Date : ${opts.date}`, `- Corpus : ${opts.corpus} — ${opts.photos} photo(s), ${opts.cases} installation(s) à plusieurs photos ou tableaux`);
  if (opts.stopped) l.push(`- ⚠ Lancement interrompu : ${opts.stopped}`);
  l.push('');
  l.push(
    '> Mesure valable pour CE corpus seulement. Des lectures simulées ou des exemples synthétiques ne disent RIEN de la',
    '> qualité réelle de la reconnaissance. Sur un petit corpus, lire la borne haute des intervalles (IC 95 %, Wilson).',
    '> Quels que soient les résultats, chaque valeur lue reste affichée « proposition, à valider » dans l’application.',
    '',
  );
  l.push('## Qualité de lecture (photo par photo)', '');
  l.push('| Entrée | Type | Photos (erreurs) | Rappel | Précision | Type d’appareil | Calibre | Courbe | Sensibilité | Type diff. | Pôles | Étiquette normalisée | Étiquette exacte | Usage déduit | Repère |');
  l.push('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of results) {
    const s = r.summary;
    const a = s.accuracy;
    l.push(
      `| ${r.entry.id} | ${CLASS_LABEL[r.cls]} | ${s.photos} (${s.errors}) | ${fmtPct(s.recall)} | ${fmtPct(s.precision)} | ${fmtPct(a.kind)} | ${fmtPct(a.rating)} | ${fmtPct(a.curve)} | ${fmtPct(a.sensitivity)} | ${fmtPct(a.rcdType)} | ${fmtPct(a.poles)} | ${fmtPct(a.label)} | ${fmtPct(a.labelExact)} | ${fmtPct(a.labelUsage)} | ${fmtPct(a.circuitRef)} |`,
    );
  }
  l.push('', 'Exactitude = exact / évalués (vérité « absent » comprise). Détail par champ : rapports par entrée.', '');
  l.push('## Informations inventées et abstention', '');
  l.push('Taux d’invention = valeur donnée là où la vérité dit absent ou illisible. Abstention justifiée = part des « null » du modèle où la vérité est vide.', '');
  l.push('| Entrée | Calibre inventé | Sensibilité inventée | Tous champs inventés | dont sur illisible | Appareils inventés | Abstention justifiée | Calibre faux (lisible) |');
  l.push('|---|---|---|---|---:|---|---|---|');
  for (const r of results) {
    const s = r.summary;
    l.push(
      `| ${r.entry.id} | ${fmtProp(s.invented.rating)} | ${fmtProp(s.invented.sensitivity)} | ${fmtProp(s.inventedAll)} | ${s.inventedOnUnreadable} | ${fmtProp(s.inventedDevices)} | ${fmtProp(s.abstentionPrecision)} | ${fmtProp(s.wrongOnReadable.rating)} |`,
    );
  }
  l.push('', '## Durée, jetons et coût', '');
  l.push(`| Entrée | Modèle | Type | Durée p50 | Durée p95 | Jetons entrée (moy.) | Jetons sortie (moy.) | Coût par photo | Coût pour 100 tableaux |`);
  l.push('|---|---|---|---:|---:|---:|---:|---:|---:|');
  for (const r of results) {
    const s = r.summary;
    l.push(
      `| ${r.entry.id} | ${r.entry.provider} · ${r.entry.model || '—'} | ${CLASS_LABEL[r.cls]} | ${sec(s.latencyP50)} | ${sec(s.latencyP95)} | ${int(s.tokensInMean)} | ${int(s.tokensOutMean)} | ${r.cls === 'paid' ? cash(s.costPerPhoto, cur) : 'gratuit'} | ${r.cls === 'paid' ? cash(r.costPer100Boards, cur) : 'gratuit'} |`,
    );
  }
  l.push('', 'Coût calculé avec les prix saisis dans la configuration (jetons relevés sur la réponse du fournisseur ; estimés s’il ne les donne pas). Un modèle local reste « gratuit » hors matériel et électricité.', '');
  if (results.some((r) => r.pipeline)) {
    l.push('## Reconstruction complète (brouillon accepté tel quel)', '');
    l.push('Lectures du modèle → fusion des photos et des tableaux par le code de l’assistant → toutes les propositions acceptées sans correction → arbre comparé à la vérité de l’installation.', '');
    l.push('| Entrée | Tableaux | Protections (rappel / précision) | Calibre exact | Étiquette exacte / normalisée | Inventés dans l’arbre | Différentiel → circuit | Sous-tableaux rattachés | Structure (score) | Désaccords (bonne option proposée) | Valeur malgré désaccord | Tableaux en double | Questions par tableau |');
    l.push('|---|---:|---|---:|---|---|---|---|---|---|---:|---:|---:|');
    for (const r of results) {
      const p = r.pipeline;
      if (!p) continue;
      const u = p.upstreamDetail;
      l.push(
        `| ${r.entry.id} | ${p.boards} | ${fmtPct(p.recall)} / ${fmtPct(p.precision)} | ${fmtPct(p.accuracy.rating)} | ${fmtPct(p.accuracy.labelExact)} / ${fmtPct(p.accuracy.label)} | ${fmtProp(p.inventedAll)} | ${fmtProp(p.upstream)} (faux ${u.wrong}, manquant ${u.missing}, inventé ${u.invented}) | ${p.links.correct}/${p.links.n} (faux ${p.links.wrong}, absent ${p.links.absent}) | ${fmtProp(p.structure)} | ${p.contradictions.facts} (${p.contradictions.withTruth}/${p.contradictions.evaluated}) | ${p.contradictions.proposedDespite} | ${p.extraBoards} | ${p.questionsPerBoard === undefined ? '—' : p.questionsPerBoard.toFixed(1).replace('.', ',')} |`,
      );
    }
    l.push('');
  }
  if (results.some((r) => r.reps > 1)) {
    l.push('## Répétabilité (même photo relue plusieurs fois)', '');
    l.push('| Entrée | Répétitions | Calibre exact (moyenne ± écart-type) | Tous champs inventés (moyenne ± écart-type) | Valeurs identiques à chaque répétition |', '|---|---:|---|---|---|');
    for (const r of results.filter((x) => x.reps > 1))
      l.push(`| ${r.entry.id} | ${r.reps} | ${mSd(r.perRep.map((s) => s.accuracy.rating?.p))} | ${mSd(r.perRep.map((s) => s.inventedAll?.p))} | ${fmtProp(r.repeat?.stable ?? null)} |`);
    l.push('');
  }
  l.push('## Seuils proposés pour la bêta', '');
  l.push('Proposition à valider par le porteur du projet ; « échantillon insuffisant » : dénominateur trop petit pour conclure.', '');
  const vs = results.map((r) => verdicts(r.summary, r.pipeline));
  if (vs.length) {
    l.push(`| Seuil | Cible | ${results.map((r) => r.entry.id).join(' | ')} |`, `|---|---|${results.map(() => '---').join('|')}|`);
    vs[0].forEach((v, i) => l.push(`| ${v.t.label} | ${v.t.op} ${Math.round(v.t.value * 100)} % (n ≥ ${v.t.minN}) | ${vs.map((x) => `${x[i].verdict} — ${fmtProp(x[i].x)}`).join(' | ')} |`));
  }
  l.push('');
  if (opts.plan) l.push('## Plan du lancement', '', formatPlan(opts.plan, cur), '');
  l.push(`Champs évalués : ${FIELDS.join(', ')}.`, '');
  return l.join('\n');
}
