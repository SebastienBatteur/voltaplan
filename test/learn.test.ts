// Section « Apprendre l'électricité » : sources complètes et valides, pages produites à jour, exercices corrects,
// et simulateur de câblage (site/apprendre/cablage-sim.js) sur des montages justes et faux.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { build, readArticles, readLexique, stripTags } from '../tools/learn/build';
import { checkArticle, checkExercise, loadSim, readPlan } from '../tools/learn/validate';
import type { Exercise, ExoWire } from '../tools/learn/types';

const ROOT = join(__dirname, '..');
const plan = readPlan(ROOT);
const articles = readArticles(ROOT);
const sim = loadSim(ROOT) as ReturnType<typeof loadSim> & {
  evaluate: (ex: Exercise, w: ExoWire[], s: Record<string, string>) => { on: Record<string, unknown>; faults: { code: string }[] };
  press: (ex: Exercise, w: ExoWire[], s: Record<string, string>, id: string) => { after: Record<string, string> };
  initialState: (ex: Exercise) => Record<string, string>;
};

describe('Apprendre : sources', () => {
  it('les balises sont retirées jusqu’au bout, même imbriquées', () => {
    expect(stripTags('Le <strong>différentiel</strong>')).toBe('Le différentiel');
    expect(stripTags('Circuit <> commande')).toBe('Circuit <> commande');
    for (const s of ['<<script>script>alert(1)', '<scr<b>ipt>alert(1)</scr</b>ipt>', '<<a>a>']) expect(stripTags(s)).not.toMatch(/<[a-z/!]/i);
  });

  it('chaque article prévu existe, et rien d’autre', () => {
    expect(articles.map((a) => a.slug).sort()).toEqual(plan.articles.map((a) => a.slug).sort());
  });

  it.each(articles.map((a) => [a.slug, a] as const))('%s : en-tête, liens, références RGIE', (_slug, a) => {
    expect(checkArticle(a, plan)).toEqual([]);
  });

  it.each(plan.articles.filter((a) => a.exercise).map((a) => [a.exercise!] as const))('exercice %s : la solution fonctionne, le vide échoue', async (id) => {
    expect(await checkExercise(ROOT, id, sim)).toEqual([]);
  });

  it('le lexique définit chaque mot prévu, une seule fois', () => {
    const lex = readLexique(ROOT);
    const ids = lex.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of plan.lexique) expect(ids, id).toContain(id);
    for (const e of lex) expect(e.def.length, e.id).toBeGreaterThan(20);
  });

  it('les pages de site/apprendre sont à jour (npm run learn:build)', async () => {
    const pages = await build(ROOT);
    const dir = join(ROOT, 'site', 'apprendre');
    for (const [f, html] of pages) expect(readFileSync(join(dir, f), 'utf8'), f).toBe(html);
    const onDisk = readdirSync(dir).filter((f) => f.endsWith('.html'));
    expect(onDisk.sort()).toEqual([...pages.keys()].sort());
  });
});

describe('Apprendre : simulateur de câblage', () => {
  const ex: Exercise = {
    id: 't',
    title: 't',
    task: '',
    devices: [
      { id: 'src', type: 'supply', label: 'Arrivée', x: 0, y: 0 },
      { id: 's1', type: 'twoway', label: 'VV 1', x: 0, y: 0 },
      { id: 's2', type: 'twoway', label: 'VV 2', x: 0, y: 0 },
      { id: 'lamp', type: 'lamp', label: 'Lampe', x: 0, y: 0 },
    ],
    cases: [
      { set: { s1: '1', s2: '1' }, expect: { lamp: true } },
      { set: { s1: '1', s2: '2' }, expect: { lamp: false } },
      { set: { s1: '2', s2: '1' }, expect: { lamp: false } },
      { set: { s1: '2', s2: '2' }, expect: { lamp: true } },
    ],
    solution: [
      { a: 'src.L', b: 's1.C', color: 'brown' },
      { a: 's1.1', b: 's2.1', color: 'black' },
      { a: 's1.2', b: 's2.2', color: 'black' },
      { a: 's2.C', b: 'lamp.L', color: 'grey' },
      { a: 'src.N', b: 'lamp.N', color: 'blue' },
      { a: 'src.PE', b: 'lamp.PE', color: 'gy' },
    ],
  };
  const codes = (w: ExoWire[]) => sim.check(ex, w).errors.map((e) => e.code);

  it('va-et-vient juste : accepté', () => {
    expect(sim.check(ex, ex.solution)).toEqual({ ok: true, errors: [], warnings: [] });
  });

  it('navettes croisées : refusées par une table fixe, acceptées par « chaque commande inverse la lampe »', () => {
    const crossed = ex.solution.map((w) => (w.a === 's1.1' ? { ...w, b: 's2.2' } : w.a === 's1.2' ? { ...w, b: 's2.1' } : w));
    expect(codes(crossed)).toEqual(['behaviour']);
    const tog: Exercise = { ...ex, cases: undefined, toggle: { inputs: ['s1', 's2'], output: 'lamp' } };
    expect(sim.check(tog, crossed).ok).toBe(true);
    expect(sim.check(tog, ex.solution).ok).toBe(true);
    // Une seule commande qui marche ne suffit pas
    const one = ex.solution.filter((w) => w.a !== 's1.2');
    expect(sim.check(tog, one).ok).toBe(false);
  });

  it('court-circuit détecté en premier', () => {
    expect(codes([...ex.solution, { a: 's2.C', b: 'src.N', color: 'blue' }])[0]).toBe('short');
  });

  it('interrupteur sur le neutre refusé', () => {
    const w: ExoWire[] = [
      { a: 'src.N', b: 's1.C', color: 'blue' },
      { a: 's1.1', b: 's2.1', color: 'black' },
      { a: 's1.2', b: 's2.2', color: 'black' },
      { a: 's2.C', b: 'lamp.N', color: 'grey' },
      { a: 'src.L', b: 'lamp.L', color: 'brown' },
      { a: 'src.PE', b: 'lamp.PE', color: 'gy' },
    ];
    expect(codes(w)).toContain('switchOnNeutral');
  });

  it('bleu hors neutre refusé (RGIE 5.1.6.2), neutre d’une autre couleur seulement signalé', () => {
    const blueReturn = ex.solution.map((x) => (x.color === 'grey' ? { ...x, color: 'blue' as const } : x));
    expect(codes(blueReturn)).toContain('blueMisuse');
    const blackNeutral = ex.solution.map((x) => (x.color === 'blue' ? { ...x, color: 'black' as const } : x));
    const r = sim.check(ex, blackNeutral);
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.code)).toEqual(['neutralColor']);
  });

  it('terre absente et vert-jaune détourné refusés', () => {
    const w = ex.solution.filter((x) => x.color !== 'gy').map((x) => (x.color === 'grey' ? { ...x, color: 'gy' as const } : x));
    expect(codes(w)).toEqual(expect.arrayContaining(['noEarth', 'gyMisuse']));
  });

  it('télérupteur : chaque appui change l’état', () => {
    const tex: Exercise = {
      id: 'tr',
      title: '',
      task: '',
      devices: [
        { id: 'src', type: 'supply', label: '', x: 0, y: 0 },
        { id: 'p1', type: 'push', label: '', x: 0, y: 0 },
        { id: 'k', type: 'relay', label: '', x: 0, y: 0 },
        { id: 'lamp', type: 'lamp', label: '', x: 0, y: 0 },
      ],
      solution: [
        { a: 'src.L', b: 'p1.1', color: 'brown' },
        { a: 'p1.2', b: 'k.A1', color: 'black' },
        { a: 'k.A2', b: 'src.N', color: 'blue' },
        { a: 'src.L', b: 'k.1', color: 'brown' },
        { a: 'k.2', b: 'lamp.L', color: 'black' },
        { a: 'lamp.N', b: 'src.N', color: 'blue' },
        { a: 'lamp.PE', b: 'src.PE', color: 'gy' },
      ],
    };
    let s = sim.initialState(tex);
    s = sim.press(tex, tex.solution, s, 'p1').after;
    expect(sim.evaluate(tex, tex.solution, s).on.lamp).toBe(true);
    s = sim.press(tex, tex.solution, s, 'p1').after;
    expect(sim.evaluate(tex, tex.solution, s).on.lamp).toBe(false);
    // Bobine A2 au neutre : normal. Contact du télérupteur sur le neutre : refusé (RGIE 5.3.3.2 c)
    tex.sequence = [{ press: 'p1', expect: { lamp: true } }];
    expect(sim.check(tex, tex.solution).errors.map((e) => e.code)).not.toContain('switchOnNeutral');
    const contactOnNeutral: ExoWire[] = [
      { a: 'src.L', b: 'p1.1', color: 'brown' },
      { a: 'p1.2', b: 'k.A1', color: 'black' },
      { a: 'k.A2', b: 'src.N', color: 'blue' },
      { a: 'src.L', b: 'lamp.L', color: 'brown' },
      { a: 'lamp.N', b: 'k.1', color: 'blue' },
      { a: 'k.2', b: 'src.N', color: 'blue' },
      { a: 'lamp.PE', b: 'src.PE', color: 'gy' },
    ];
    expect(sim.check(tex, contactOnNeutral).errors.map((e) => e.code)).toContain('switchOnNeutral');
  });

  it('volet : montée et descente en même temps signalées', () => {
    const v: Exercise = {
      id: 'v',
      title: '',
      task: '',
      devices: [
        { id: 'src', type: 'supply', label: '', x: 0, y: 0 },
        { id: 'm', type: 'motor', label: 'Moteur', x: 0, y: 0 },
      ],
      solution: [],
    };
    const r = sim.evaluate(
      v,
      [
        { a: 'src.L', b: 'm.up', color: 'brown' },
        { a: 'src.L', b: 'm.down', color: 'black' },
        { a: 'src.N', b: 'm.N', color: 'blue' },
      ],
      sim.initialState(v),
    );
    expect(r.faults.map((f) => f.code)).toContain('bothDirections');
  });
});
