/**
 * Banc d'évaluation, chaîne complète (tools/ai-eval/pipeline.ts) : lectures → brouillons de l'assistant (fusion,
 * plusieurs tableaux) → tout accepté → arbre comparé à la vérité de l'installation. Toutes les lectures sont
 * SIMULÉES (écrites à la main) : ces tests vérifient le calcul des scores de structure, JAMAIS la qualité réelle de
 * la reconnaissance d'une photo.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PhotoDeviceT, PhotoReadingT } from '../src/ai/boardPhoto';
import { boardTruth, checkCase, scoreCase, summarizeCases, type EvalCase } from '../tools/ai-eval/pipeline';
import type { GroundTruth, TruthDevice } from '../tools/ai-eval/score';

const dir = join(__dirname, '../tools/ai-eval/examples/installation');
const load = <T>(f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as T;
const NAMES = ['principal-r1', 'principal-r2', 'principal-r1-partielle', 'garage'];

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
const truth = (devices: TruthDevice[], perRow = 12): GroundTruth => ({ format: 'voltaplan-ai-eval/1', image: 'x.jpg', composed: true, rows: 1, perRow, devices });
const tdev = (o: Partial<TruthDevice>): TruthDevice => ({ row: 0, startModule: 0, widthModules: 1, kind: 'mcb', ...o });

describe('banc : installation complète (exemple synthétique)', () => {
  const c = load<EvalCase>('maison.case.json');
  const truths = new Map(NAMES.map((n) => [n, load<GroundTruth>(`${n}.truth.json`)]));
  const readings = new Map(NAMES.map((n) => [n, load<PhotoReadingT>(`lectures/${n}.prediction.json`)]));

  it('format du cas valide ; erreurs lisibles', () => {
    expect(checkCase(c)).toBeNull();
    expect(checkCase({ ...c, format: 'x' })).toMatch(/format/);
    expect(checkCase({ ...c, boards: [{ ...c.boards[0], fedBy: { board: 'garage', at: 'r0m0' } }, c.boards[1]] })).toMatch(/principal/);
    expect(checkCase({ ...c, boards: [c.boards[0], { ...c.boards[1], fedBy: { board: 'inconnu', at: 'r0m0' } }] })).toMatch(/fedBy/);
    expect(checkCase({ ...c, boards: [{ ...c.boards[0], upstream: { A: null } }] })).toMatch(/upstream/);
  });

  it('vérité du tableau : réunion des photos, décalage appliqué, protections seulement', () => {
    const t = boardTruth(c.boards[0], truths);
    expect(t.map((d) => `r${d.row}m${d.startModule}`)).toEqual(['r0m0', 'r0m2', 'r0m3', 'r0m4', 'r0m5', 'r1m0', 'r1m2', 'r1m3']); // télérupteur exclu
    expect(t.find((d) => d.startModule === 5)!.ratedCurrentA).toBeNull(); // illisible sur les deux photos
  });

  it('une valeur lue sur une photo l’emporte sur « illisible » sur l’autre', () => {
    const b = { id: 'b', name: 'B', photos: [{ truth: 'a.truth.json' }, { truth: 'b.truth.json', offset: { row: 0, module: 1 } }] };
    const t = boardTruth(
      b,
      new Map([
        ['a', truth([tdev({ startModule: 1, ratedCurrentA: null, unreadable: ['ratedCurrentA'] })])],
        ['b', truth([tdev({ startModule: 0, ratedCurrentA: 16 })])],
      ]),
    );
    expect(t).toHaveLength(1);
    expect(t[0].ratedCurrentA).toBe(16);
    expect(t[0].unreadable).toEqual([]);
  });

  it('score : détection, valeurs, raccordements, sous-tableau, désaccords', () => {
    const s = scoreCase('maison', c, truths, readings);
    expect(s.error).toBeUndefined();
    const [main, garage] = s.boards;
    expect([main.photo.truth, main.photo.matched, garage.photo.matched]).toEqual([8, 8, 2]);
    // 16 A lu sur une photo, 20 A sur l'autre : désaccord → aucune valeur (manqué) ; 16 A inventé sur un illisible
    expect(main.photo.fields.rating).toMatchObject({ n: 8, correct: 6, missed: 1, invented: 1 });
    // « Ecl. ch.7 » contre « Ecl. ch.1 » : désaccord, aucune étiquette écrite
    expect(main.photo.fields.label.missed).toBe(1);
    expect(main.upstream).toMatchObject({ n: 8, correct: 8, wrong: 0, missing: 0, invented: 0 });
    expect(garage.upstream).toMatchObject({ n: 2, correct: 2 });
    expect(garage.link).toBe('correct');
    expect(main.link).toBeUndefined();
    expect(main.contradictions).toEqual({ facts: 2, evaluated: 2, withTruth: 2, proposedDespite: 0 });
    expect(s.missingReadings).toEqual([]);
    expect(s.questions).toBeGreaterThan(0);
  });

  it('synthèse : structure = raccordements + rattachements', () => {
    const p = summarizeCases([scoreCase('maison', c, truths, readings)]);
    expect(p.boards).toBe(2);
    expect(p.upstream).toMatchObject({ k: 10, n: 10 });
    expect(p.links).toEqual({ n: 1, correct: 1, wrong: 0, absent: 0 });
    expect(p.structure).toMatchObject({ k: 11, n: 11 });
    expect(p.inventedAll!.k).toBe(1);
  });

  it('photo sans lecture (erreur du modèle) : ignorée, signalée', () => {
    const r = new Map(readings);
    r.delete('principal-r1-partielle');
    const s = scoreCase('maison', c, truths, r);
    expect(s.missingReadings).toEqual(['principal-r1-partielle']);
    expect(s.boards[0].contradictions.facts).toBe(0);
  });
});

describe('banc : score de structure (lectures simulées)', () => {
  const twoRcd = truth([
    tdev({ startModule: 0, widthModules: 2, kind: 'rcd', label: 'A-B' }),
    tdev({ startModule: 2, circuitRef: 'A' }),
    tdev({ startModule: 3, circuitRef: 'B' }),
    tdev({ startModule: 4, widthModules: 2, kind: 'rcd', label: 'C-D' }),
    tdev({ startModule: 6, circuitRef: 'C' }),
    tdev({ startModule: 7, circuitRef: 'D' }),
  ]);
  const caseOf = (upstream: Record<string, string | null>, extra: Partial<EvalCase> = {}): EvalCase => ({
    format: 'voltaplan-ai-eval-case/1',
    boards: [{ id: 'tp', name: 'Tableau', photos: [{ truth: 't.truth.json' }], upstream }],
    ...extra,
  });
  const up = { r0m0: null, r0m2: 'r0m0', r0m3: 'r0m0', r0m4: null, r0m6: 'r0m4', r0m7: 'r0m4' };
  const good = [
    dev({ startModule: 0, widthModules: 2, kind: 'rcd', label: 'A-B' }),
    dev({ startModule: 2, circuitRef: 'A' }),
    dev({ startModule: 3, circuitRef: 'B' }),
    dev({ startModule: 4, widthModules: 2, kind: 'rcd', label: 'C-D' }),
    dev({ startModule: 6, circuitRef: 'C' }),
    dev({ startModule: 7, circuitRef: 'D' }),
  ];

  it('lecture exacte : tout le raccordement est juste', () => {
    const s = scoreCase('x', caseOf(up), new Map([['t', twoRcd]]), new Map([['t', reading(...good)]]));
    expect(s.boards[0].upstream).toMatchObject({ n: 6, correct: 6 });
  });

  it('repère mal lu (« B » au lieu de « C ») : circuit rattaché au mauvais différentiel', () => {
    const bad = good.map((d) => (d.startModule === 6 ? { ...d, circuitRef: 'B' } : d));
    const s = scoreCase('x', caseOf(up), new Map([['t', twoRcd]]), new Map([['t', reading(...bad)]]));
    expect(s.boards[0].upstream).toMatchObject({ n: 6, correct: 5, wrong: 1 });
  });

  it('circuit réellement sans différentiel, rattaché par position : différentiel « inventé »', () => {
    const s = scoreCase('x', caseOf({ ...up, r0m7: null }), new Map([['t', twoRcd]]), new Map([['t', reading(...good.map((d) => (d.startModule === 7 ? { ...d, circuitRef: null } : d)))]]));
    expect(s.boards[0].upstream).toMatchObject({ correct: 5, invented: 1 });
  });

  it('appareil non lu : raccordement non évalué (compté à part)', () => {
    const s = scoreCase('x', caseOf(up), new Map([['t', twoRcd]]), new Map([['t', reading(...good.filter((d) => d.startModule !== 3))]]));
    expect(s.boards[0].upstream).toMatchObject({ n: 5, correct: 5, unmatched: 1 });
    expect(s.boards[0].photo.missedDevices).toBe(1);
  });

  it('sous-tableau : alimentation non repérée sur l’étiquette → non rattaché (« absent »), rien d’inventé', () => {
    const c: EvalCase = {
      format: 'voltaplan-ai-eval-case/1',
      boards: [
        { id: 'tp', name: 'Tableau', photos: [{ truth: 'm.truth.json' }] },
        { id: 'g', name: 'Garage', photos: [{ truth: 'g.truth.json' }], fedBy: { board: 'tp', at: 'r0m1' } },
      ],
    };
    const truths = new Map([
      ['m', truth([tdev({ startModule: 0, label: 'Prises' }), tdev({ startModule: 1, label: 'Sous-tableau garage' })])],
      ['g', truth([tdev({ startModule: 0, label: 'Prises garage' })])],
    ]);
    const lu = (label: string | null) =>
      new Map([
        ['m', reading(dev({ startModule: 0, label: 'Prises' }), dev({ startModule: 1, label }))],
        ['g', reading(dev({ startModule: 0, label: 'Prises garage' }))],
      ]);
    expect(scoreCase('x', c, truths, lu(null)).boards[1].link).toBe('absent');
    expect(scoreCase('x', c, truths, lu('Sous-tableau garage')).boards[1].link).toBe('correct');
  });
});
