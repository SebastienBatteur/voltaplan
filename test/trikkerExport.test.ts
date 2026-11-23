import { readFileSync, existsSync } from 'node:fs';
import { importTrikker } from '../src/import/trikker';
import { exportTrikkerXml, toWindows1252 } from '../src/export/trikker';
import { computeNumbering, walk } from '../src/model/tree';
import { checkProject } from '../src/rules';
import { emptyProject, createNode } from '../src/model/tree';

const fixtures = ['maison-a', 'maison-b', 'maison-c'].filter((f) => existsSync(`test/fixtures/${f}.trik`));

describe.each(fixtures)('export Trikker %s (aller-retour)', (name) => {
  it('réimporte le même schéma, la même numérotation, le même plan et les mêmes constats', () => {
    const a = importTrikker(readFileSync(`test/fixtures/${name}.trik`, 'utf8'), name + '.trik').project;
    const b = importTrikker(exportTrikkerXml(a), name + '.trik').project;
    const sig = (p: typeof a) => [...walk(p.roots)].map(({ node, depth }) => `${depth}:${node.kind}:${JSON.stringify(node.props)}:${node.location ?? ''}`);
    expect(sig(b)).toEqual(sig(a));
    expect([...computeNumbering(b.roots)]).toEqual([...computeNumbering(a.roots)]);
    expect(checkProject(b).map((f) => f.ruleId).sort()).toEqual(checkProject(a).map((f) => f.ruleId).sort());
    for (let i = 0; i < a.plan.pages.length; i++) {
      expect(b.plan.pages[i].walls).toEqual(a.plan.pages[i].walls);
      expect(b.plan.pages[i].symbols.length).toBe(a.plan.pages[i].symbols.length);
      expect(b.plan.pages[i].labels.map((l) => l.text)).toEqual(a.plan.pages[i].labels.map((l) => l.text));
      expect(b.plan.pages[i].images.length).toBe(a.plan.pages[i].images.length);
    }
    expect(b.meta.site).toEqual(a.meta.site);
  });
});

it('exporte un projet créé dans Voltaplan', () => {
  const p = emptyProject();
  const board = [...walk(p.roots)].find((w) => w.node.kind === 'board')!.node;
  const mcb = createNode('protection', { device: 'mcb', ratedCurrent: 16, curve: 'C', circuitName: 'Éclairage' });
  const cable = createNode('cable', { cableType: 'XVB', section: 1.5, conductors: 3 });
  const sw = createNode('switch', { switchType: 'twoWay' });
  sw.children = [createNode('light', { lightType: 'led' })];
  cable.children = [sw, createNode('socket', { count: 2 })];
  mcb.children = [cable];
  board.children.push(mcb);
  const xml = exportTrikkerXml(p);
  expect(xml).toContain('NaamKring="Éclairage"');
  expect(xml).toContain('Type="Wissel"');
  expect(xml).toContain('GeleiderDoorsnede="1,5"');
  expect(xml).toContain('Aantal="Twee"');
  const back = importTrikker(xml).project;
  expect(computeNumbering(back.roots).get(sw.id)).toBe(computeNumbering(p.roots).get(sw.id));
  // Encodage Windows-1252 comme Trikker
  const bytes = toWindows1252('Église – 10 €');
  expect([...bytes]).toEqual([0xc9, 0x67, 0x6c, 0x69, 0x73, 0x65, 0x20, 0x96, 0x20, 0x31, 0x30, 0x20, 0x80]);
});

it('porte : côté d’ouverture et charnière conservés par l’aller-retour Trikker (4 positions)', () => {
  // Position physique d'une porte : charnière (point) et côté d'ouverture (normale vers la pièce)
  const phys = (o: { a: { x: number; y: number }; b: { x: number; y: number }; hinge?: string; mirrored?: boolean }) => {
    const h = o.mirrored ? o.b : o.a;
    const len = Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y);
    const side = o.hinge === 'right' ? 1 : -1;
    const n = { x: (side * -(o.b.y - o.a.y)) / len, y: (side * (o.b.x - o.a.x)) / len };
    return `${Math.round(h.x)},${Math.round(h.y)} ${Math.round(n.x)},${Math.round(n.y)}`;
  };
  for (const hinge of ['left', 'right'] as const)
    for (const mirrored of [false, true]) {
      const p = emptyProject();
      p.plan.pages[0].walls.push({ a: { x: 0, y: 0 }, b: { x: 4000, y: 0 }, thickness: 200 });
      const door = { kind: 'door' as const, a: { x: 1000, y: 0 }, b: { x: 1900, y: 0 }, width: 200, hinge, mirrored };
      p.plan.pages[0].openings.push(door);
      const back = importTrikker(exportTrikkerXml(p)).project.plan.pages[0].openings.find((o) => o.kind === 'door')!;
      expect(phys(back)).toBe(phys(door));
    }
});
