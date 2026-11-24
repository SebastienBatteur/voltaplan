/**
 * Banc d'évaluation, mode matrice (tools/ai-eval) : indicateurs (invention, abstention, incertains), statistiques,
 * configuration, estimation des coûts, autorisation, exécution avec plafond, répétabilité, ligne de commande.
 *
 * AUCUN appel réseau : le lecteur est simulé et `fetch` est surveillé. Les lectures sont SIMULÉES (écrites à la main) :
 * ces tests vérifient l'outil, ils ne disent RIEN de la qualité réelle de la reconnaissance d'une photo.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PhotoDeviceT, PhotoReadingT } from '../src/ai/boardPhoto';
import { imageSize } from '../tools/ai-eval/imageSize';
import {
  authorize,
  checkMatrix,
  compareReport,
  costClass,
  evaluateEntry,
  imageTokens,
  planMatrix,
  previousTokens,
  runMatrix,
  type CorpusPhoto,
  type MatrixConfig,
  type MatrixEntry,
  type Reader,
} from '../tools/ai-eval/matrix';
import { cli, type CliDeps } from '../tools/ai-eval/matrixCli';
import { BETA_THRESHOLDS, repeatability, summarize, verdict } from '../tools/ai-eval/metrics';
import { checkTruth, scorePhoto, type GroundTruth, type TruthDevice } from '../tools/ai-eval/score';
import { quantile, sd, wilson } from '../tools/ai-eval/stats';

const dev = (o: Partial<PhotoDeviceT>): PhotoDeviceT => ({
  startModule: 0,
  widthModules: 1,
  kind: 'mcb',
  brand: null,
  model: null,
  poles: null,
  ratedCurrentA: null,
  curve: null,
  residualCurrentmA: null,
  rcdType: null,
  label: null,
  circuitRef: null,
  confidence: 'high',
  ...o,
});
const reading = (...devices: PhotoDeviceT[]): PhotoReadingT => ({ rows: [{ row: 0, devices }], notes: null });
const tdev = (o: Partial<TruthDevice>): TruthDevice => ({ row: 0, startModule: 0, widthModules: 1, kind: 'mcb', ...o });
const truth = (devices: TruthDevice[]): GroundTruth => ({ format: 'voltaplan-ai-eval/1', image: 'x.jpg', composed: true, rows: 1, perRow: 12, lang: 'fr', devices });

let fetchSpy: { mockRestore: () => void };
beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
    throw new Error('appel réseau interdit dans les tests');
  });
});
afterEach(() => {
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
});

describe('statistiques', () => {
  it('intervalle de Wilson : 0 sur 50 n’est pas « 0 % sûr »', () => {
    const w = wilson(0, 50)!;
    expect(w.p).toBe(0);
    expect(w.lo).toBe(0);
    expect(w.hi).toBeCloseTo(0.0713, 3);
    const h = wilson(5, 10)!;
    expect(h.lo).toBeCloseTo(0.237, 2);
    expect(h.hi).toBeCloseTo(0.763, 2);
    expect(wilson(0, 0)).toBeNull();
  });

  it('quantiles et écart-type', () => {
    expect(quantile([4, 1, 3, 2], 0.5)).toBe(2.5);
    expect(quantile(Array.from({ length: 101 }, (_, i) => i), 0.95)).toBe(95);
    expect(quantile([], 0.5)).toBeUndefined();
    expect(sd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 2);
    expect(sd([3])).toBe(0);
  });
});

describe('indicateurs : invention, abstention, incertains', () => {
  const t = truth([
    tdev({ startModule: 0, ratedCurrentA: null, unreadable: ['ratedCurrentA'] }), // illisible
    tdev({ startModule: 1, ratedCurrentA: null }), // absent
    tdev({ startModule: 2, ratedCurrentA: 20 }),
    tdev({ startModule: 3, ratedCurrentA: 16, unsure: ['ratedCurrentA'] }), // annotateur pas sûr
    tdev({ startModule: 4, ratedCurrentA: 10 }),
  ]);
  const r = reading(
    dev({ startModule: 0, ratedCurrentA: 16 }), // inventé sur un illisible
    dev({ startModule: 1, ratedCurrentA: null }), // abstention justifiée
    dev({ startModule: 2, ratedCurrentA: null }), // abstention injustifiée (manqué)
    dev({ startModule: 3, ratedCurrentA: 20 }), // non évalué
    dev({ startModule: 4, ratedCurrentA: 16 }), // faux
    dev({ startModule: 8, ratedCurrentA: 16 }), // appareil inventé
  );

  it('comptage par champ', () => {
    const s = scorePhoto('p', t, r);
    expect(s.fields.rating).toEqual({ n: 4, correct: 1, wrong: 1, invented: 1, missed: 1, truthNull: 2, inventedOnUnreadable: 1, unsure: 1 });
    expect(s.extraDevices).toBe(1);
  });

  it('taux : invention = inventés / vérités vides ; abstention justifiée = null justifiés / null donnés', () => {
    const q = summarize([scorePhoto('p', t, r)]);
    expect(q.invented.rating).toMatchObject({ k: 1, n: 2, p: 0.5 });
    expect(q.wrongOnReadable.rating).toMatchObject({ k: 1, n: 2 });
    expect(q.inventedDevices).toMatchObject({ k: 1, n: 6 });
    expect(q.inventedOnUnreadable).toBe(1);
    // Champs de valeur réunis : seul le calibre est renseigné dans cette vérité
    expect(q.abstentionPrecision).toMatchObject({ k: 1, n: 2 });
    expect(q.abstentionRecall).toMatchObject({ k: 1, n: 2 });
  });

  it('pôles et étiquette exacte / normalisée', () => {
    const s = scorePhoto('p', truth([tdev({ poles: '1P+N', label: 'Prises cuisine' })]), reading(dev({ poles: '1P + N', label: 'PRISES CUISINE' })));
    expect(s.fields.poles.correct).toBe(1);
    expect(s.fields.label.correct).toBe(1);
    expect(s.fields.labelExact.wrong).toBe(1);
  });

  it('vérité : « illisible » exige null ; champs annotés connus', () => {
    expect(checkTruth(truth([tdev({ ratedCurrentA: 16, unreadable: ['ratedCurrentA'] })]))).toMatch(/illisible/);
    expect(checkTruth(truth([tdev({ unsure: ['calibre'] })]))).toMatch(/unsure/);
    expect(checkTruth(t)).toBeNull();
  });

  it('seuils : échantillon insuffisant tant que n est petit', () => {
    const th = BETA_THRESHOLDS.find((x) => x.id === 'inventedRating')!;
    expect(verdict(th, wilson(0, 10))).toBe('échantillon insuffisant');
    expect(verdict(th, wilson(0, 60))).toBe('atteint');
    expect(verdict(th, wilson(3, 60))).toBe('non atteint');
  });

  it('répétabilité : valeurs identiques à chaque relecture, ou non', () => {
    const truths = new Map([['p', truth([tdev({ startModule: 0, ratedCurrentA: 16 }), tdev({ startModule: 1, ratedCurrentA: 10 })])]]);
    const a = reading(dev({ startModule: 0, ratedCurrentA: 16 }), dev({ startModule: 1, ratedCurrentA: 10 }));
    const b = reading(dev({ startModule: 0, ratedCurrentA: 16 }), dev({ startModule: 1, ratedCurrentA: 16 }));
    const same = repeatability(truths, [new Map([['p', a]]), new Map([['p', a]])]);
    expect(same.stable!.p).toBe(1);
    const diff = repeatability(truths, [new Map([['p', a]]), new Map([['p', b]])]);
    expect(diff.stable!.k).toBe(diff.compared - 1);
  });
});

describe('configuration de la matrice', () => {
  const ok: MatrixConfig = {
    format: 'voltaplan-ai-eval-matrix/1',
    currency: 'EUR',
    entries: [
      { id: 'cloud', provider: 'anthropic', model: 'm', keyEnv: 'MA_CLE', priceInPerMTok: 3, priceOutPerMTok: 15 },
      { id: 'local', provider: 'openaiCompatible', baseUrl: 'http://localhost:11434/v1', model: 'llava' },
      { id: 'rejeu', provider: 'openaiCompatible', model: '', replayDir: 'lectures' },
    ],
  };

  it('exemple livré et configuration correcte : valides', () => {
    expect(checkMatrix(ok).ok).toBe(true);
    const ex = JSON.parse(readFileSync(join(__dirname, '../tools/ai-eval/examples/matrice.exemple.json'), 'utf8'));
    expect(checkMatrix(ex)).toMatchObject({ ok: true });
  });

  it('erreurs : clé dans le fichier, doublon, adresse, prix, variable', () => {
    const bad = {
      format: 'voltaplan-ai-eval-matrix/1',
      entries: [
        { id: 'a', provider: 'anthropic', model: 'm', apiKey: 'sk-ant-xxx' },
        { id: 'a', provider: 'anthropic', model: 'm', baseUrl: 'http://x' },
        { id: 'b', provider: 'openaiCompatible', model: 'm' },
        { id: 'c', provider: 'openaiCompatible', model: 'm', baseUrl: 'ftp://x', priceInPerMTok: -1 },
        { id: 'd e', provider: 'autre', model: '', keyEnv: 'sk-123' },
      ],
    };
    const r = checkMatrix(bad);
    expect(r.ok).toBe(false);
    const errs = (r as { errors: string[] }).errors.join('\n');
    expect(errs).toMatch(/apiKey.*interdit/);
    expect(errs).toMatch(/id en double/);
    expect(errs).toMatch(/baseUrl réservé/);
    expect(errs).toMatch(/baseUrl obligatoire/);
    expect(errs).toMatch(/http\(s\)/);
    expect(errs).toMatch(/priceInPerMTok/);
    expect(errs).toMatch(/provider/);
    expect(errs).toMatch(/keyEnv/);
    expect(checkMatrix({ ...ok, repetitions: 0 }).ok).toBe(false);
  });

  it('classes de coût : local gratuit, distant payant, rejeu sans appel', () => {
    expect(ok.entries.map(costClass)).toEqual(['paid', 'local', 'replay']);
    expect(costClass({ id: 'x', provider: 'openaiCompatible', model: 'm', baseUrl: 'https://api.example.com/v1' })).toBe('paid');
    expect(costClass({ id: 'x', provider: 'openaiCompatible', model: 'm', baseUrl: 'http://127.0.0.1:1234/v1' })).toBe('local');
  });
});

describe('estimation (mode simulation)', () => {
  const photos: CorpusPhoto[] = [
    { name: 'a', truth: truth([tdev({}), tdev({ startModule: 1 })]), image: { width: 1000, height: 1000 } },
    { name: 'b', truth: truth([tdev({})]) }, // image absente : géométrie de l'image composée
  ];
  const cfg: MatrixConfig = {
    format: 'voltaplan-ai-eval-matrix/1',
    entries: [
      { id: 'cloud', provider: 'anthropic', model: 'm', priceInPerMTok: 3, priceOutPerMTok: 15 },
      { id: 'sansprix', provider: 'anthropic', model: 'm' },
      { id: 'local', provider: 'openaiCompatible', baseUrl: 'http://localhost:11434/v1', model: 'llava' },
      { id: 'rejeu', provider: 'openaiCompatible', model: '', replayDir: 'x' },
    ],
  };

  it('jetons d’une image : règle largeur × hauteur / 750, image réduite', () => {
    expect(imageTokens(1000, 1000)).toBe(1334);
    const big = imageTokens(4000, 3000);
    expect(big).toBeGreaterThan(1500);
    expect(big).toBeLessThanOrEqual(1534);
  });

  it('appels, jetons et coût par entrée ; prix inconnu signalé ; local et rejeu gratuits', () => {
    const plan = planMatrix(cfg, photos, { repetitions: 3 });
    const [cloud, sansprix, local, rejeu] = plan.entries;
    expect([cloud.calls, sansprix.calls, local.calls, rejeu.calls]).toEqual([6, 6, 6, 0]);
    expect(cloud.cost).toBeCloseTo((cloud.tokensIn * 3 + cloud.tokensOut * 15) / 1e6, 10);
    expect(cloud.costCeiling!).toBeGreaterThan(cloud.cost!);
    expect(sansprix.cost).toBeNull();
    expect([local.cost, rejeu.cost, rejeu.tokensIn]).toEqual([0, 0, 0]);
    expect(plan.unknownPrice).toEqual(['sansprix']);
    expect(plan.paidCalls).toBe(12);
    expect(plan.calls).toBe(18);
  });

  it('jetons mesurés lors d’un lancement précédent', () => {
    const prev = previousTokens([
      { entry: 'cloud', rep: 1, photo: 'a', tokensIn: 1000, tokensOut: 300 },
      { entry: 'cloud', rep: 1, photo: 'b', tokensIn: 2000, tokensOut: 500 },
      { entry: 'cloud', rep: 1, photo: 'c', error: 'x' },
    ]);
    expect(prev.get('cloud')).toEqual({ in: 1500, out: 400 });
    const plan = planMatrix(cfg, photos, { repetitions: 1, previous: prev });
    expect(plan.entries[0]).toMatchObject({ source: 'mesures précédentes', tokensIn: 3000, tokensOut: 800 });
  });

  it('autorisation : rien sans --live --i-authorize-costs, prix, clé et plafond', () => {
    const plan = planMatrix(cfg, photos);
    expect(authorize(cfg, plan, { live: false, authorize: true, maxCost: 100 }, {}).ok).toBe(false);
    const noFlag = authorize(cfg, plan, { live: true, authorize: false }, {});
    expect(noFlag.reasons.join('\n')).toMatch(/--i-authorize-costs/);
    const r = authorize(cfg, plan, { live: true, authorize: true }, {});
    expect(r.ok).toBe(false);
    expect(r.reasons.join('\n')).toMatch(/sansprix : prix inconnu/);
    expect(r.reasons.join('\n')).toMatch(/ANTHROPIC_API_KEY/);
    expect(r.reasons.join('\n')).toMatch(/--max-cost/);
    const cloudOnly: MatrixConfig = { ...cfg, entries: [cfg.entries[0]] };
    const p1 = planMatrix(cloudOnly, photos);
    expect(authorize(cloudOnly, p1, { live: true, authorize: true, maxCost: 10 }, { ANTHROPIC_API_KEY: 'x' }).ok).toBe(true);
    expect(authorize(cloudOnly, p1, { live: true, authorize: true, maxCost: p1.cost / 2 }, { ANTHROPIC_API_KEY: 'x' }).reasons.join()).toMatch(/plafond/);
    // Modèle local seul : ni clé ni plafond, mais l'autorisation explicite reste exigée
    const localOnly: MatrixConfig = { ...cfg, entries: [cfg.entries[2]] };
    expect(authorize(localOnly, planMatrix(localOnly, photos), { live: true, authorize: true }, {}).ok).toBe(true);
    expect(authorize(localOnly, planMatrix(localOnly, photos), { live: true, authorize: false }, {}).ok).toBe(false);
  });
});

describe('exécution (lecteur simulé)', () => {
  const t = truth([tdev({ startModule: 0, ratedCurrentA: 16 })]);
  const photos: CorpusPhoto[] = [
    { name: 'a', truth: t },
    { name: 'b', truth: t },
    { name: 'c', truth: t },
  ];
  const paid: MatrixEntry = { id: 'cloud', provider: 'anthropic', model: 'm', priceInPerMTok: 1_000_000, priceOutPerMTok: 0 };

  it('séquentiel, durée et jetons relevés ; plafond de coût : arrêt avant l’appel suivant', async () => {
    let now = 0;
    const reader = vi.fn<Reader>(async () => {
      now += 1500;
      return { reading: reading(dev({ ratedCurrentA: 16 })), tokensIn: 1, tokensOut: 5 };
    });
    const out = await runMatrix({ config: { format: 'voltaplan-ai-eval-matrix/1', entries: [paid] }, photos, repetitions: 2, reader, replay: () => undefined, maxCost: 2, clock: () => now });
    expect(reader).toHaveBeenCalledTimes(2); // 1 par appel, plafond 2
    expect(out.stopped).toMatch(/plafond/);
    expect(out.records).toHaveLength(2);
    expect(out.records[0]).toMatchObject({ latencyMs: 1500, tokensIn: 1, tokensOut: 5, cost: 1, costEstimated: false });
  });

  it('erreur du fournisseur : enregistrée, la suite continue ; rejeu sans appel', async () => {
    const reader = vi.fn<Reader>(async (_e, p) => {
      if (p.name === 'b') throw new Error('http 500');
      return { reading: reading(dev({ ratedCurrentA: 16 })) };
    });
    const local: MatrixEntry = { id: 'local', provider: 'openaiCompatible', baseUrl: 'http://localhost:1234/v1', model: 'm' };
    const rejeu: MatrixEntry = { id: 'rejeu', provider: 'openaiCompatible', model: '', replayDir: 'x' };
    const out = await runMatrix({
      config: { format: 'voltaplan-ai-eval-matrix/1', entries: [local, rejeu] },
      photos,
      repetitions: 2,
      reader,
      replay: (_e, p) => (p.name === 'c' ? undefined : reading(dev({ ratedCurrentA: 10 }))),
    });
    expect(reader).toHaveBeenCalledTimes(6); // local seulement, 3 photos × 2
    expect(out.records.filter((r) => r.entry === 'local' && r.error)).toHaveLength(2);
    expect(out.records.filter((r) => r.entry === 'rejeu')).toHaveLength(3); // une seule « répétition » pour un rejeu
    const res = evaluateEntry(local, out.records, out.readings, new Map(photos.map((p) => [p.name, p.truth])), []);
    expect(res.reps).toBe(2);
    expect(res.summary.errors).toBe(2);
    expect(res.summary.accuracy.rating).toMatchObject({ k: 4, n: 4 });
    expect(res.repeat!.stable!.p).toBe(1);
    expect(res.costPer100Boards).toBe(0);
  });

  it('rapport de comparaison : avertissement, tableaux, répétabilité, seuils', async () => {
    const reader: Reader = async (_e, p) => ({ reading: reading(dev({ ratedCurrentA: p.name === 'a' ? 20 : 16 })), tokensIn: 1000, tokensOut: 100 });
    const cfg: MatrixConfig = { format: 'voltaplan-ai-eval-matrix/1', entries: [{ ...paid, priceInPerMTok: 3, priceOutPerMTok: 15 }] };
    const out = await runMatrix({ config: cfg, photos, repetitions: 2, reader, replay: () => undefined, clock: () => 0 });
    const res = evaluateEntry(cfg.entries[0], out.records, out.readings, new Map(photos.map((p) => [p.name, p.truth])), []);
    expect(res.summary.costPerPhoto).toBeCloseTo((1000 * 3 + 100 * 15) / 1e6, 10);
    expect(res.costPer100Boards).toBeCloseTo(100 * res.summary.costPerPhoto!, 10);
    const md = compareReport({ results: [res], date: 'd', corpus: 'c', photos: 3, cases: 0, currency: 'EUR' });
    expect(md).toContain('ne disent RIEN de la');
    expect(md).toContain('proposition, à valider');
    expect(md).toContain('## Informations inventées et abstention');
    expect(md).toContain('## Répétabilité');
    expect(md).toContain('## Seuils proposés pour la bêta');
    expect(md).toContain('échantillon insuffisant');
    expect(md).toMatch(/\| cloud \| anthropic · m \| payant \|/);
  });
});

describe('dimensions des images (estimation sans appel)', () => {
  it('PNG, JPEG, WebP ; format inconnu', () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0x06, 0x40, 0, 0, 0x04, 0xb0]);
    expect(imageSize(png)).toEqual({ width: 1600, height: 1200 });
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0x02, 0x58, 0x03, 0x20, 3, 0, 0, 0]);
    expect(imageSize(jpg)).toEqual({ width: 800, height: 600 });
    const webp = new Uint8Array(30);
    webp.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0);
    webp.set([...'WEBPVP8X'].map((c) => c.charCodeAt(0)), 8);
    webp.set([0x3f, 0x06, 0, 0xaf, 0x04, 0], 24); // 1600 − 1, 1200 − 1
    expect(imageSize(webp)).toEqual({ width: 1600, height: 1200 });
    expect(imageSize(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe('ligne de commande : jamais d’appel sans autorisation explicite', () => {
  let root: string;
  let corpus: string;
  const config = (entries: MatrixEntry[]) => {
    const f = join(root, `cfg-${Math.random().toString(36).slice(2)}.json`);
    writeFileSync(f, JSON.stringify({ format: 'voltaplan-ai-eval-matrix/1', currency: 'EUR', entries }));
    return f;
  };
  const deps = (reader: Reader, env: Record<string, string> = {}) => {
    const logs: string[] = [];
    const d: CliDeps = { reader, env, log: (s) => logs.push(s), err: (s) => logs.push(s), now: () => new Date('2026-11-24T10:00:00Z'), defaultOutRoot: join(root, 'resultats') };
    return { d, logs };
  };
  const cloud: MatrixEntry = { id: 'cloud', provider: 'anthropic', model: 'm', priceInPerMTok: 3, priceOutPerMTok: 15 };
  const local: MatrixEntry = { id: 'local', provider: 'openaiCompatible', baseUrl: 'http://localhost:11434/v1', model: 'llava' };

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'voltaplan-ai-eval-'));
    corpus = join(root, 'corpus');
    mkdirSync(join(corpus, 'lectures'), { recursive: true });
    writeFileSync(join(corpus, 'p1.truth.json'), JSON.stringify(truth([tdev({ ratedCurrentA: 16, label: 'Prises' })])));
    writeFileSync(join(corpus, 'lectures', 'p1.prediction.json'), JSON.stringify(reading(dev({ ratedCurrentA: 16, label: 'Prises' }))));
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('sans --live : plan affiché, aucun appel, rien d’écrit', async () => {
    const reader = vi.fn<Reader>();
    const { d, logs } = deps(reader, { ANTHROPIC_API_KEY: 'x' });
    expect(await cli(['--config', config([cloud, local]), '--dir', corpus, '--repetitions', '3'], d)).toBe(0);
    expect(reader).not.toHaveBeenCalled();
    const out = logs.join('\n');
    expect(out).toMatch(/\| cloud \| .* \| payant \| 3 \|/);
    expect(out).toMatch(/\| local \| .* \| local \(gratuit\) \| 3 \| .* \| 0\.00 EUR \|/);
    expect(out).toMatch(/AUCUN appel/);
    expect(existsSync(join(root, 'resultats'))).toBe(false);
  });

  it('--live seul : refusé (code 3), aucun appel', async () => {
    const reader = vi.fn<Reader>();
    const { d, logs } = deps(reader, { ANTHROPIC_API_KEY: 'x' });
    expect(await cli(['--config', config([local]), '--dir', corpus, '--live'], d)).toBe(3);
    expect(reader).not.toHaveBeenCalled();
    expect(logs.join('\n')).toMatch(/REFUSÉE[\s\S]*--i-authorize-costs/);
  });

  it('payant sans clé ni plafond : refusé même avec --live --i-authorize-costs', async () => {
    const reader = vi.fn<Reader>();
    const { d, logs } = deps(reader);
    expect(await cli(['--config', config([cloud]), '--dir', corpus, '--live', '--i-authorize-costs'], d)).toBe(3);
    expect(reader).not.toHaveBeenCalled();
    expect(logs.join('\n')).toMatch(/ANTHROPIC_API_KEY[\s\S]*--max-cost/);
  });

  it('configuration invalide ou clé dans le fichier : code 2, aucun appel', async () => {
    const reader = vi.fn<Reader>();
    const { d } = deps(reader);
    expect(await cli(['--config', config([{ ...cloud, apiKey: 'sk-x' } as MatrixEntry]), '--dir', corpus, '--live', '--i-authorize-costs'], d)).toBe(2);
    expect(await cli(['--dir', corpus], d)).toBe(2);
    expect(reader).not.toHaveBeenCalled();
  });

  it('autorisé (modèle local) : lectures et rapport écrits dans le dossier de résultats, puis recalcul sans appel', async () => {
    const reader = vi.fn<Reader>(async () => ({ reading: reading(dev({ ratedCurrentA: 16, label: 'Prises' })), tokensIn: 900, tokensOut: 80 }));
    const { d } = deps(reader);
    const out = join(root, 'run');
    expect(await cli(['--config', config([local]), '--dir', corpus, '--live', '--i-authorize-costs', '--out', out, '--repetitions', '2'], d)).toBe(0);
    expect(reader).toHaveBeenCalledTimes(2);
    const res = JSON.parse(readFileSync(join(out, 'results.json'), 'utf8'));
    expect(res.format).toBe('voltaplan-ai-eval-results/1');
    expect(JSON.stringify(res)).not.toMatch(/apiKey/);
    expect(existsSync(join(out, 'local', 'rep2', 'p1.prediction.json'))).toBe(true);
    expect(readFileSync(join(out, 'comparaison.md'), 'utf8')).toContain('| local |');
    const again = vi.fn<Reader>();
    expect(await cli(['--config', config([local]), '--dir', corpus, '--rescore', out], deps(again).d)).toBe(0);
    expect(again).not.toHaveBeenCalled();
  });

  it('rejeu seul : aucun appel possible, rapport produit sans --live', async () => {
    const reader = vi.fn<Reader>();
    const { d } = deps(reader);
    const out = join(root, 'rejeu');
    const f = config([{ id: 'rejeu', provider: 'openaiCompatible', model: '', replayDir: join(corpus, 'lectures') }]);
    expect(await cli(['--config', f, '--dir', corpus, '--out', out], d)).toBe(0);
    expect(reader).not.toHaveBeenCalled();
    expect(readFileSync(join(out, 'comparaison.md'), 'utf8')).toMatch(/\| rejeu \| rejeu \(aucun appel\) \| 1 \(0\) \| 100 %/);
  });
});
