import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { importVolter, VOLTER_TYPES, volterSupply } from '../src/import/volter';
import { walk } from '../src/model/tree';
import { ALLOWED_CHILDREN } from '../src/model/schema';
import type { ElNode, Project } from '../src/model/types';

/** Sauvegarde Volter fabriquée pour le test (même forme que les fichiers d'essai, données inventées). */
function sample() {
  const comp = (id: string, type: string, circuitId: string | null, x = 100, y = 100) => ({
    id,
    type,
    position: { x, y },
    rotation: 0,
    roomId: null,
    circuitId,
    label: '',
    labelOffset: null,
    quantity: 1,
    scale: 1,
  });
  const mcb = (id: string, naam: string, ampere: number, curve: string, section: number, rcd: string | null, rij: number, kolom: number) => ({
    id,
    moduleType: 'automaat',
    naam,
    ampere,
    polen: '2P',
    breakerCurve: curve,
    kortsluitstroom: 3,
    draaddikte: section,
    aantalAders: 3,
    kabelType: 'XVB',
    cprClass: 'Cca',
    kabelLocatie: 'inMuur',
    inBuis: false,
    differentieelId: rcd,
    rijIndex: rij,
    kolom,
  });
  return {
    version: 2,
    metadata: { address: 'rue Fictive 1, 7000 Exemple', werfNaam: 'Essai', floorCount: 2 },
    project: {
      id: 'p',
      name: 'Essai',
      spanning: '3x400V+N',
      werf: { naam: 'Essai', straat: 'rue Fictive 1', postcode: '7000', gemeente: 'Exemple' },
      installateur: { naam: 'Électricien fictif', btw: 'BE0000000000', email: 'pas-un-mail' },
      eanCodes: [{ id: 'e', label: '', code: '541400000000000000' }],
      crossFloorConnections: [],
      floors: [
        {
          id: 'f0',
          name: 'Rez',
          level: 0,
          walls: [{ id: 'w1', start: { x: 0, y: 0 }, end: { x: 1000, y: 0 }, thickness: 30 }],
          doors: [
            { id: 'd1', wallId: 'w1', position: 0.5, width: 80, openDirection: 'left', hingeSide: 'left' },
            { id: 'd2', wallId: 'w1', position: 0.8, width: 250, openDirection: 'left', hingeSide: 'left', soort: 'garage' },
            { id: 'd3', wallId: 'w1', position: 0.2, width: 90, openDirection: 'left', hingeSide: 'left', soort: 'schuifOpbouw' },
          ],
          windows: [],
          rooms: [],
          components: [
            comp('l1', 'lightPoint', 'c-light'),
            comp('s1', 'toggleSwitch', 'c-light'),
            comp('x1', 'crossSwitch', 'c-light'),
            comp('s2', 'toggleSwitch', 'c-light'),
            comp('b1', 'pushButton', 'c-light'),
            comp('b2', 'pushButton', 'c-light'),
            comp('t1', 'impulseSwitch', 'c-light'),
            comp('l2', 'lightPoint', 'c-light'),
            comp('o1', 'childSafeGroundedOutlet', 'c-sock'),
            comp('o2', 'childSafeGroundedOutlet', 'c-sock'),
            comp('k1', 'cooktop', 'c-hob'),
            { ...comp('i1', 'inverterAcDc', 'c-pv'), maximaalVermogen: 6 },
            comp('p1', 'solarPanel', 'c-pv'),
            comp('bat', 'battery', 'c-pv'),
            comp('z1', 'unknownThing', null),
          ],
          connections: [
            { id: 'a', fromId: 's1', toId: 'l1' },
            { id: 'b', fromId: 'l1', toId: 'x1' },
            { id: 'c', fromId: 'x1', toId: 's2' },
            { id: 'd', fromId: 't1', toId: 'b1' },
            { id: 'e', fromId: 'b1', toId: 'l2' },
            { id: 'f', fromId: 'b2', toId: 'l2' },
            { id: 'g', fromId: 'bat', toId: 'i1' },
            { id: 'h', fromId: 'i1', toId: 'p1' },
          ],
          labels: [{ id: 'lb', type: 'label', position: { x: 50, y: 50 }, text: 'Séjour' }],
          architecturalElements: [{ kind: 'stairSpiral', radius: 70, rotation: 0, position: { x: 500, y: 500 }, id: 'st' }],
          meubels: [
            { soort: 'wc', breedte: 37, diepte: 65, rotation: 0, position: { x: 900, y: 600 }, id: 'm1' },
            { soort: 'lift', breedte: 100, diepte: 100, rotation: 0, position: { x: 0, y: 0 }, id: 'm2' },
          ],
          buitenvlakken: [
            {
              soort: 'terras',
              naam: 'Terrasse',
              vorm: { soort: 'veelhoek', punten: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }] },
              id: 'bv',
            },
            { soort: 'oprit', naam: 'Rond-point', vorm: { soort: 'cirkel', midden: { x: 500, y: 500 }, straal: 100 }, id: 'bc' },
          ],
        },
        { id: 'f1', name: 'Étage', level: 1, walls: [], doors: [], windows: [], rooms: [], components: [], connections: [], labels: [], architecturalElements: [], meubels: [], buitenvlakken: [] },
      ],
    },
    boards: [
      {
        id: 'b',
        naam: 'Tableau principal',
        modules: [
          { id: 'main', moduleType: 'hoofddifferentieel', naam: 'Général', ampere: 40, polen: '4P', kortsluitstroom: 6, foutstroom: 300, rcdType: 'A', position: 0, rijIndex: 0 },
          { id: 'r30', moduleType: 'differentieel', naam: 'Diff 2', ampere: 40, polen: '2P', foutstroom: 30, rcdType: 'A', automaatIds: ['c-light', 'c-sock'], ouderId: null, rijIndex: 1, kolom: 0 },
          mcb('c-light', 'Circuit 1', 16, 'C', 1.5, 'r30', 1, 2),
          // Rattaché seulement par la liste automaatIds du différentiel
          mcb('c-sock', 'Circuit 2', 20, 'C', 2.5, null, 1, 3),
          mcb('c-hob', 'Circuit 3', 32, 'B', 6, null, 0, 2),
          mcb('c-pv', 'Circuit 4', 16, 'B', 2.5, null, 0, 3),
        ],
      },
    ],
  };
}

const byId = (p: Project, id: string) => [...walk(p.roots)].find((x) => x.node.id === id);

function checkTree(nodes: ElNode[]) {
  for (const { node, parent } of walk(nodes)) if (parent) expect(ALLOWED_CHILDREN[parent.kind], `${parent.kind} → ${node.kind}`).toContain(node.kind);
}

describe('import Volter (.vschema)', () => {
  it('lit les métadonnées et le réseau', () => {
    const { project } = importVolter(JSON.stringify(sample()));
    expect(project.meta.title).toBe('Essai');
    expect(project.meta.supply).toBe('3N x 400V ~ 50Hz');
    expect(project.meta.ean).toBe('541400000000000000');
    expect(project.meta.installer.vat).toBe('BE0000000000');
    expect(project.meta.installer.email).toBeUndefined();
    expect(project.meta.site.city).toBe('Exemple');
  });

  it('reconstruit le tableau : général 300 mA, 30 mA et ses disjoncteurs', () => {
    const { project } = importVolter(JSON.stringify(sample()));
    checkTree(project.roots);
    const main = byId(project, 'main')!.node;
    expect(main.props).toMatchObject({ device: 'rcd', residualCurrent: 300, poles: '4P', ratedCurrent: 40 });
    const board = main.children[0];
    expect(board.kind).toBe('board');
    const r30 = byId(project, 'r30')!;
    expect(r30.parent?.id).toBe(board.id);
    expect(r30.node.children.map((c) => c.id)).toEqual(['c-light', 'c-sock']);
    const light = byId(project, 'c-light')!.node;
    expect(light.props).toMatchObject({ device: 'mcb', circuitName: 'Circuit 1', ratedCurrent: 16, curve: 'C', breakingCapacity: 3 });
    expect(light.children[0].props).toMatchObject({ cableType: 'XVB', section: 1.5, conductors: 3, inConduit: false, method: 'inWall' });
    // Rangée 0 avant rangée 1 ; terre en dernier
    expect(board.children.map((c) => c.id).slice(0, 3)).toEqual(['c-hob', 'c-pv', 'r30']);
    expect(board.children.at(-1)!.kind).toBe('earthBar');
    // Repères de Volter : disjoncteurs directs puis groupes des différentiels
    expect(['c-hob', 'c-pv', 'c-light', 'c-sock'].map((id) => byId(project, id)!.node.props.fixedLetter)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('groupe les points reliés : va-et-vient et télérupteur', () => {
    const { project } = importVolter(JSON.stringify(sample()));
    expect(byId(project, 'l1')!.parent?.kind).toBe('switch');
    expect(byId(project, 'x1')!.node.props.switchType).toBe('intermediate');
    const relay = byId(project, 't1')!;
    expect(relay.node.props.relayType).toBe('teleswitch');
    expect(relay.node.children.map((c) => c.id)).toEqual(['l2']);
    expect(relay.parent?.kind).toBe('pushButton');
    expect(byId(project, 'i1')!.node.props).toMatchObject({ inverterType: 'acDc', power: 6000 });
    expect(byId(project, 'p1')!.parent?.id).toBe('i1');
  });

  it('pose les symboles et le plan en mm, un étage par page', () => {
    const { project, warnings } = importVolter(JSON.stringify(sample()));
    expect(project.plan.pages.map((p) => p.name)).toEqual(['Rez', 'Étage']);
    const pg = project.plan.pages[0];
    expect(pg.walls[0]).toEqual({ a: { x: 0, y: 0 }, b: { x: 10000, y: 0 }, thickness: 300 });
    expect(pg.openings[0]).toMatchObject({ kind: 'door', a: { x: 4600, y: 0 }, b: { x: 5400, y: 0 }, width: 300, hinge: 'right', mirrored: false });
    expect(pg.openings[1]).toMatchObject({ kind: 'garageDoor', a: { x: 6750, y: 0 }, b: { x: 9250, y: 0 } });
    expect(pg.openings[2].kind).toBe('slidingDoor');
    // Volter openDirection right, hingeSide right → battant côté -y, charnière en b
    const s2 = sample();
    Object.assign(s2.project.floors[0].doors[0], { openDirection: 'right', hingeSide: 'right' });
    expect(importVolter(JSON.stringify(s2)).project.plan.pages[0].openings[0]).toMatchObject({ hinge: 'left', mirrored: true });
    expect(pg.symbols).toHaveLength(15);
    expect(pg.furniture?.map((f) => f.kind).sort()).toEqual(['spiralStairs', 'wc']);
    // Meuble Volter : coin supérieur gauche (900, 600) cm, 37 × 65 cm → centre en mm
    expect(pg.furniture?.find((f) => f.kind === 'wc')).toMatchObject({ center: { x: 9185, y: 6325 }, w: 370, h: 650 });
    expect(pg.furniture?.find((f) => f.kind === 'spiralStairs')).toMatchObject({ center: { x: 5000, y: 5000 }, w: 1400 });
    expect(pg.labels.map((l) => l.text).sort()).toEqual(['Rond-point', 'Séjour', 'Terrasse']);
    expect(pg.rects).toContainEqual({ center: { x: 5000, y: 5000 }, w: 2000, h: 2000, angle: 0 });
    expect(project.loose.map((n) => n.props.name)).toEqual(['unknownThing']);
    expect(warnings.join('\n')).toMatch(/unknownThing/);
    expect(warnings.join('\n')).toMatch(/lift/);
  });

  it('place le sous-tableau sous son disjoncteur et suit les liaisons entre étages', () => {
    const s = sample();
    const modules = s.boards[0].modules as Record<string, unknown>[];
    modules.push({ ...modules[2], id: 'feed', naam: 'Alimentation étage', ampere: 25, draaddikte: 4, differentieelId: null, feedsBoardId: 'sub', rijIndex: 0, kolom: 9 });
    // Sous-tableau listé avant le principal : l'ordre du fichier ne doit pas compter
    s.boards.unshift({ id: 'sub', naam: 'Étage', code: 'E', modules: [{ ...modules[2], id: 'c-up', naam: 'Circuit étage', differentieelId: null, rijIndex: 0, kolom: 1 }] } as never);
    const up = s.project.floors[1];
    up.components.push({ id: 'b9', type: 'pushButton', position: { x: 1, y: 1 }, rotation: 0, roomId: null, circuitId: 'c-light', label: '', labelOffset: null, quantity: 1, scale: 1 } as never);
    (s.project as Record<string, unknown>).crossFloorConnections = [{ id: 'cf', fromId: 'b9', fromFloorId: 'f1', toId: 't1', toFloorId: 'f0' }];
    const { project } = importVolter(JSON.stringify(s));
    checkTree(project.roots);
    const sub = [...walk(project.roots)].find((x) => x.node.kind === 'board' && x.node.props.name === 'Étage')!;
    expect(sub.node.props.fixedLetter).toBe('E');
    expect(sub.parent?.kind).toBe('cable');
    expect(byId(project, 'feed')!.node.children[0].children).toContain(sub.node);
    expect(sub.node.children.map((c) => c.id)).toEqual(['c-up']);
    expect(byId(project, 'c-up')!.node.props.fixedLetter).toBe('E-A');
    expect(byId(project, 'feed')!.node.props.fixedLetter).toBe('C');
    // Le bouton de l'étage rejoint le circuit et le groupe du télérupteur du rez (un seul bouton peut porter le
    // télérupteur dans Voltaplan : les autres restent des points du même circuit)
    const cableIds = [...walk(byId(project, 'c-light')!.node.children)].map((x) => x.node.id);
    expect(cableIds).toContain('b9');
    expect(byId(project, 't1')!.parent?.kind).toBe('pushButton');
  });

  it('refuse un fichier qui n’est pas une sauvegarde Volter', () => {
    expect(() => importVolter('pas du json')).toThrow(/Volter/);
    expect(() => importVolter('{"a":1}')).toThrow(/Volter/);
  });

  it('réseaux', () => {
    expect(volterSupply('3x230V')).toBe('3 x 230V ~ 50Hz');
    expect(volterSupply('3x400V+N')).toBe('3N x 400V ~ 50Hz');
    expect(volterSupply('???')).toBeUndefined();
  });

  it('chaque type Volter connu peut se placer sous un câble', () => {
    for (const [type, k] of Object.entries(VOLTER_TYPES)) expect(ALLOWED_CHILDREN.cable, type).toContain(k.kind);
  });

  // Fichiers d'essai réels (hors dépôt) : VOLTER_SAMPLES="chemin1;chemin2"
  const real = (process.env.VOLTER_SAMPLES ?? '').split(';').filter((p) => p && existsSync(p));
  it.runIf(real.length > 0)('fichiers d’essai Volter réels', () => {
    for (const p of real) {
      const { project, warnings } = importVolter(readFileSync(p, 'utf-8'));
      checkTree(project.roots);
      const nodes = [...walk(project.roots)].length;
      const symbols = project.plan.pages.reduce((a, pg) => a + pg.symbols.length, 0);
      console.log(p, { nodes, symbols, loose: project.loose.length, pages: project.plan.pages.length }, warnings);
      expect(warnings.join('\n')).not.toMatch(/non reconnu/);
    }
  });
});
