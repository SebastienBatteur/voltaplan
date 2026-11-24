/**
 * Ligne de commande du mode matrice (logique testable : le lecteur réel est injecté par run-matrix.ts). Mode d'emploi :
 * docs/assistant-evaluation.md § 9.
 *
 *   npm run ai-eval:matrix -- --config <matrice.json> --dir <corpus>                 # plan seulement, AUCUN appel
 *   npm run ai-eval:matrix -- --config <matrice.json> --dir <corpus> --live --i-authorize-costs --max-cost 5
 *   npm run ai-eval:matrix -- --config <matrice.json> --dir <corpus> --rescore <dossier d'un lancement>
 *
 * Codes de sortie : 0 (plan affiché ou lancement terminé), 2 (erreur d'usage, de configuration ou de corpus),
 * 3 (lecture réelle refusée : autorisation, prix, clé ou plafond manquants).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import type { PhotoReadingT } from '../../src/ai/boardPhoto';
import { imageSize } from './imageSize';
import {
  authorize,
  checkMatrix,
  compareReport,
  costClass,
  evaluateEntry,
  formatPlan,
  planMatrix,
  previousTokens,
  RESULTS_FORMAT,
  runMatrix,
  type CorpusPhoto,
  type MatrixConfig,
  type Reader,
  type Readings,
  type RunRecord,
} from './matrix';
import { checkCase, photoName, type EvalCase } from './pipeline';
import { checkTruth, report, type GroundTruth } from './score';

export interface CliDeps {
  /** Lecteur réel (appel au fournisseur) : n'est appelé qu'après autorisation. */
  reader: Reader;
  env: Record<string, string | undefined>;
  log: (s: string) => void;
  err: (s: string) => void;
  now: () => Date;
  /** Dossier par défaut des résultats (ignoré par git). */
  defaultOutRoot: string;
}

export const USAGE = `Banc d'évaluation, mode matrice (voir docs/assistant-evaluation.md § 9)

  --config <matrice.json>     fournisseurs et modèles à comparer              [obligatoire]
  --dir <corpus>              fichiers <nom>.truth.json (+ images, + <cas>.case.json) [obligatoire]
  --repetitions <n>           relectures de chaque photo (variance)          [config, sinon 1]
  --only <id,id…>             seulement ces entrées de la configuration
  --limit <n>                 seulement les n premières photos
  --previous <results.json>   jetons mesurés lors d'un lancement précédent (meilleure estimation)
  --out <dossier>             résultats                                      [tools/ai-eval/resultats/<date>]
  --rescore <dossier>         recalcule le rapport d'un lancement (aucun appel)
  --live                      lecture réelle…
  --i-authorize-costs         … ET autorisation explicite des appels et de leur coût (les deux sont exigés)
  --max-cost <montant>        plafond de dépense (obligatoire pour un fournisseur payant)

Sans --live --i-authorize-costs : AUCUN appel, le plan (appels, jetons, coût estimés) est seulement affiché.`;

function parse(argv: string[]): Map<string, string | true> {
  const a = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--') || k === '--') continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) a.set(k.slice(2), true);
    else {
      a.set(k.slice(2), next);
      i++;
    }
  }
  return a;
}

export interface Corpus {
  truths: Map<string, GroundTruth>;
  photos: CorpusPhoto[];
  cases: { name: string; c: EvalCase }[];
  errors: string[];
}

/** Charge le corpus : vérités (avec dimensions des images, si présentes) et installations. Rien n'est envoyé. */
export function loadCorpus(dir: string, limit?: number): Corpus {
  const errors: string[] = [];
  const truths = new Map<string, GroundTruth>();
  const photos: CorpusPhoto[] = [];
  const files = readdirSync(dir).sort();
  for (const f of files.filter((x) => x.endsWith('.truth.json')).slice(0, limit ?? Infinity)) {
    const name = basename(f, '.truth.json');
    let t: GroundTruth;
    try {
      t = JSON.parse(readFileSync(join(dir, f), 'utf8')) as GroundTruth;
    } catch (e) {
      errors.push(`${f} : JSON illisible (${(e as Error).message})`);
      continue;
    }
    const bad = checkTruth(t);
    if (bad) {
      errors.push(`${f} : ${bad}`);
      continue;
    }
    truths.set(name, t);
    const img = join(dir, t.image);
    const size = existsSync(img) ? imageSize(readFileSync(img)) : null;
    photos.push({ name, truth: t, ...(existsSync(img) ? { imagePath: img } : {}), ...(size ? { image: size } : {}) });
  }
  const cases: { name: string; c: EvalCase }[] = [];
  for (const f of files.filter((x) => x.endsWith('.case.json'))) {
    let c: EvalCase;
    try {
      c = JSON.parse(readFileSync(join(dir, f), 'utf8')) as EvalCase;
    } catch (e) {
      errors.push(`${f} : JSON illisible (${(e as Error).message})`);
      continue;
    }
    const bad = checkCase(c);
    if (bad) {
      errors.push(`${f} : ${bad}`);
      continue;
    }
    const missing = c.boards.flatMap((b) => b.photos.map((p) => photoName(p.truth))).filter((n) => !truths.has(n));
    if (missing.length && limit === undefined) errors.push(`${f} : vérités introuvables (${missing.join(', ')})`);
    else if (!missing.length) cases.push({ name: basename(f, '.case.json'), c });
  }
  return { truths, photos, cases, errors };
}

const readJson = <T>(f: string) => JSON.parse(readFileSync(f, 'utf8')) as T;

export async function cli(argv: string[], deps: CliDeps): Promise<number> {
  const a = parse(argv);
  const str = (k: string) => (typeof a.get(k) === 'string' ? (a.get(k) as string) : undefined);
  const fail = (msg: string) => {
    deps.err('Erreur : ' + msg + '\n\n' + USAGE);
    return 2;
  };
  if (a.has('help')) {
    deps.log(USAGE);
    return 0;
  }
  if (!str('config')) return fail('--config est obligatoire');
  if (!str('dir')) return fail('--dir est obligatoire');
  const configPath = resolve(str('config')!);
  const dir = resolve(str('dir')!);
  if (!existsSync(configPath)) return fail(`configuration introuvable : ${configPath}`);
  if (!existsSync(dir)) return fail(`corpus introuvable : ${dir}`);
  let raw: unknown;
  try {
    raw = readJson(configPath);
  } catch (e) {
    return fail(`configuration illisible : ${(e as Error).message}`);
  }
  const checked = checkMatrix(raw);
  if (!checked.ok) return fail('configuration invalide :\n  - ' + checked.errors.join('\n  - '));
  const only = str('only')?.split(',').map((s) => s.trim());
  const entries = checked.config.entries
    .filter((e) => !only || only.includes(e.id))
    .map((e) => (e.replayDir ? { ...e, replayDir: resolve(dirname(configPath), e.replayDir) } : e));
  if (!entries.length) return fail(`aucune entrée retenue (--only ${only?.join(',')})`);
  const config: MatrixConfig = { ...checked.config, entries };
  const currency = config.currency ?? 'USD';
  const repetitions = str('repetitions') !== undefined ? Number(str('repetitions')) : (config.repetitions ?? 1);
  if (!(Number.isInteger(repetitions) && repetitions >= 1 && repetitions <= 20)) return fail('--repetitions : entier de 1 à 20');
  const limit = str('limit') !== undefined ? Number(str('limit')) : undefined;
  const corpus = loadCorpus(dir, limit);
  if (corpus.errors.length) return fail('corpus invalide :\n  - ' + corpus.errors.join('\n  - '));
  if (!corpus.photos.length) return fail(`aucun fichier *.truth.json dans ${dir}`);
  for (const e of entries) if (e.replayDir && !existsSync(e.replayDir)) return fail(`${e.id} : dossier de rejeu introuvable (${e.replayDir})`);

  const replay = (e: (typeof entries)[number], p: CorpusPhoto): PhotoReadingT | undefined => {
    const f = join(e.replayDir!, `${p.name}.prediction.json`);
    return existsSync(f) ? readJson<PhotoReadingT>(f) : undefined;
  };
  const stamp = deps.now().toISOString().slice(0, 19).replace(/:/g, '-');
  const writeReport = (outDir: string, records: RunRecord[], readings: Readings, plan?: ReturnType<typeof planMatrix>, stopped?: string) => {
    const results = entries.map((e) => evaluateEntry(e, records, readings, corpus.truths, corpus.cases));
    const md = compareReport({ results, date: deps.now().toISOString().slice(0, 16).replace('T', ' '), corpus: basename(dir), photos: corpus.photos.length, cases: corpus.cases.length, currency, plan, stopped });
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'comparaison.md'), md);
    // Détail par entrée (rapport habituel du banc)
    for (const r of results)
      writeFileSync(
        join(outDir, `rapport-${r.entry.id}.md`),
        report(r.photoScores, { title: `Lecture des photos de tableaux — ${r.entry.id}`, mode: costClass(r.entry) === 'replay' ? 'rejeu de lectures enregistrées' : `lecture réelle, ${r.reps} répétition(s)`, provider: r.entry.provider, model: r.entry.model, date: deps.now().toISOString().slice(0, 16).replace('T', ' '), currency }),
      );
    deps.log(`Rapport : ${join(outDir, 'comparaison.md')}`);
  };

  // Recalcul d'un lancement déjà fait : aucun appel
  if (str('rescore')) {
    const runDir = resolve(str('rescore')!);
    const resFile = join(runDir, 'results.json');
    if (!existsSync(resFile)) return fail(`results.json introuvable dans ${runDir}`);
    const res = readJson<{ format: string; records: RunRecord[] }>(resFile);
    if (res.format !== RESULTS_FORMAT) return fail(`${resFile} : format attendu « ${RESULTS_FORMAT} »`);
    const records = res.records.filter((r) => entries.some((e) => e.id === r.entry) && corpus.truths.has(r.photo));
    const readings: Readings = new Map();
    for (const r of records) {
      const e = entries.find((x) => x.id === r.entry)!;
      const reading = r.prediction && existsSync(join(runDir, r.prediction)) ? readJson<PhotoReadingT>(join(runDir, r.prediction)) : e.replayDir ? replay(e, corpus.photos.find((p) => p.name === r.photo)!) : undefined;
      if (!reading) continue;
      if (!readings.has(r.entry)) readings.set(r.entry, new Map());
      const byRep = readings.get(r.entry)!;
      if (!byRep.has(r.rep)) byRep.set(r.rep, new Map());
      byRep.get(r.rep)!.set(r.photo, reading);
    }
    writeReport(runDir, records, readings);
    return 0;
  }

  let previous: Map<string, { in: number; out: number }> | undefined;
  if (str('previous')) {
    const f = resolve(str('previous')!);
    if (!existsSync(f)) return fail(`--previous : fichier introuvable (${f})`);
    previous = previousTokens(readJson<{ records: RunRecord[] }>(f).records ?? []);
  }
  const plan = planMatrix(config, corpus.photos, { repetitions, previous });
  deps.log(formatPlan(plan, currency));
  deps.log('');

  const allReplay = entries.every((e) => costClass(e) === 'replay');
  const maxCost = str('max-cost') !== undefined ? Number(str('max-cost')) : undefined;
  const live = a.get('live') === true;
  if (!allReplay) {
    const auth = authorize(config, plan, { live, authorize: a.get('i-authorize-costs') === true, maxCost }, deps.env);
    if (!auth.ok) {
      if (!live) {
        deps.log('Mode simulation : AUCUN appel fait. Pour lancer réellement (après accord du porteur du projet) :');
        deps.log('  --live --i-authorize-costs [--max-cost <montant> pour un fournisseur payant]');
        return 0;
      }
      deps.err('Lecture réelle REFUSÉE, aucun appel fait :\n  - ' + auth.reasons.join('\n  - '));
      return 3;
    }
  }
  const outDir = resolve(str('out') ?? join(deps.defaultOutRoot, stamp));
  const run = await runMatrix({ config, photos: corpus.photos, repetitions, reader: deps.reader, replay, maxCost, outDir, log: deps.log });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'results.json'),
    JSON.stringify({ format: RESULTS_FORMAT, date: deps.now().toISOString(), corpus: basename(dir), repetitions, config, plan, stopped: run.stopped, records: run.records }, null, 2) + '\n',
  );
  writeReport(outDir, run.records, run.readings, plan, run.stopped);
  return 0;
}
