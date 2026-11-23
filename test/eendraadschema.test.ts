import { readFileSync, existsSync } from 'node:fs';
import { importTrikker } from '../src/import/trikker';
import { exportEendraadschema } from '../src/export/eendraadschema';

interface Doc {
  length: number;
  curid: number;
  id: number[];
  data: { id: number; parent: number; props: Record<string, string | boolean> }[];
}
const parse = (s: string): Doc => {
  expect(s.startsWith('TXT0040000')).toBe(true);
  return JSON.parse(s.slice(10));
};

describe.each(['maison-a', 'maison-b'].filter((f) => existsSync(`test/fixtures/${f}.trik`)))('export Eendraadschema %s', (name) => {
  const { project } = importTrikker(readFileSync(`test/fixtures/${name}.trik`, 'utf8'));
  const doc = parse(exportEendraadschema(project, name + '.eds'));
  it('liste hiérarchique valide (format v4)', () => {
    expect(doc.length).toBe(doc.data.length);
    expect(doc.id).toEqual(doc.data.map((d) => d.id));
    expect(doc.curid).toBeGreaterThan(Math.max(...doc.id));
    const ids = new Set<number>();
    for (const d of doc.data) {
      expect(d.parent === 0 || ids.has(d.parent)).toBe(true); // parent avant enfant
      ids.add(d.id);
      expect(typeof d.props.type).toBe('string');
    }
    expect(doc.data[0].props.type).toBe('Aansluiting');
  });
  it('règles de structure d’Eendraadschema', () => {
    const byId = new Map(doc.data.map((d) => [d.id, d]));
    for (const d of doc.data) {
      const parent = byId.get(d.parent);
      if (parent?.props.type === 'Bord') expect(['Kring', 'Vrije ruimte']).toContain(d.props.type);
      if (parent?.props.type === 'Aansluiting') expect(['Bord', 'Kring', 'Splitsing']).toContain(d.props.type);
    }
    const kringen = doc.data.filter((d) => d.props.type === 'Kring' && d.props.naam);
    expect(kringen.length).toBeGreaterThan(5);
    expect(kringen.every((k) => k.props.autoKringNaam === 'manueel')).toBe(true);
    expect(doc.data.some((d) => d.props.type === 'Contactdoos')).toBe(true);
  });
});

it('export d’un petit projet (sans fichier de test) : différentiel, circuit, va-et-vient', async () => {
  const { createNode, emptyProject } = await import('../src/model/tree');
  const p = emptyProject();
  const origin = createNode('origin');
  const rcd = createNode('protection', { device: 'rcd', ratedCurrent: 40, residualCurrent: 300, poles: '2P' });
  const board = createNode('board', { name: 'TG' });
  const mcb = createNode('protection', { device: 'mcb', ratedCurrent: 20, curve: 'C', poles: '2P' });
  const cable = createNode('cable', { cableType: 'XVB', conductors: 3, section: 2.5 });
  const s1 = createNode('switch', { switchType: 'twoWay' });
  const s2 = createNode('switch', { switchType: 'twoWay' });
  const light = createNode('light');
  s2.children = [light];
  s1.children = [s2];
  cable.children = [createNode('socket', { count: 2 }), s1];
  mcb.children = [cable];
  board.children = [mcb];
  rcd.children = [board];
  origin.children = [rcd];
  p.roots = [origin];
  const doc = parse(exportEendraadschema(p));
  const types = doc.data.map((d) => d.props.type);
  expect(types).toEqual(['Aansluiting', 'Bord', 'Kring', 'Contactdoos', 'Schakelaars', 'Lichtpunt']);
  expect(doc.data[0].props).toMatchObject({ bescherming: 'differentieel', amperage: '40', differentieel_delta_amperage: '300' });
  expect(doc.data[2].props).toMatchObject({ naam: 'A', bescherming: 'automatisch', curve_automaat: 'C', aantal_polen: '2', type_kabel: 'XVB 3G2,5' });
  expect(doc.data[4].props).toMatchObject({ type_schakelaar: 'enkelpolig', aantal_schakelaars: '2' });
  expect(doc.data[3].props.aantal).toBe('2');
});
