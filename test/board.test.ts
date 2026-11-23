import { autoLayout, compareRow, enclosures, moduleWidth, placeDevice, placed } from '../src/board/model';
import { createNode } from '../src/model/tree';
import type { ElNode } from '../src/model/types';

function tree() {
  const n = (kind: ElNode['kind'], kids: ElNode[] = [], props = {}) => {
    const x = createNode(kind, props);
    x.children = kids;
    return x;
  };
  const sub = n('board', [n('protection', [n('cable', [n('socket')])], { device: 'mcb', poles: '1P+N' })], { name: 'Garage' });
  const c1 = n('protection', [n('cable', [n('socket')])], { device: 'mcb', poles: '1P+N' });
  const c2 = n('protection', [n('cable', [n('light')])], { device: 'mcb', poles: '2P' });
  const c3 = n('protection', [n('cable', [sub])], { device: 'mcb', poles: '1P+N', modules: 2 });
  const group = n('board', [c1, c2]);
  const rcd30 = n('protection', [group], { device: 'rcd', poles: '2P', residualCurrent: 30 });
  const main = n('board', [rcd30, c3]);
  const rcd300 = n('protection', [main], { device: 'rcd', poles: '4P', residualCurrent: 300 });
  const root = n('origin', [n('cable', [n('meter', [n('cable', [rcd300])])])]);
  return { roots: [root], rcd300, rcd30, c1, c2, c3, main, sub };
}

describe('tableaux', () => {
  it('reconnaît les enveloppes : groupe sous différentiel = même tableau, divisionnaire = autre tableau', () => {
    const t = tree();
    const e = enclosures(t.roots);
    expect(e).toHaveLength(2);
    expect(e[0].board).toBe(t.main);
    expect(e[0].devices.map((d) => d.id)).toEqual([t.rcd300.id, t.rcd30.id, t.c1.id, t.c2.id, t.c3.id]);
    expect(e[1].board).toBe(t.sub);
    expect(e[1].devices).toHaveLength(1);
  });

  it('largeurs usuelles, et largeur imposée prioritaire', () => {
    const t = tree();
    expect([t.rcd300, t.rcd30, t.c1, t.c2, t.c3].map(moduleWidth)).toEqual([4, 2, 1, 2, 2]);
  });

  it('disposition automatique sans couper un appareil entre deux rangées', () => {
    const t = tree();
    const enc = enclosures(t.roots)[0];
    const lay = autoLayout(enc, 2, 8);
    // 4 + 2 + 1 = 7 ; le disjoncteur 2P (2 modules) passe à la rangée suivante
    expect(lay.slots[t.c2.id]).toEqual({ row: 1, col: 0 });
    expect(lay.slots[t.c3.id]).toEqual({ row: 1, col: 2 });
  });

  it('glisser un appareil pousse les suivants, et refuse un débordement', () => {
    const t = tree();
    const enc = enclosures(t.roots)[0];
    // c3 (2) en tête : rcd300 (4) → col 2, rcd30 (2) → col 6, c1 (1) → col 8 : débordement
    expect(placeDevice(enc, autoLayout(enc, 2, 8), t.c3.id, 0, 0, 8)).toBeNull();
    const ok = placeDevice(enc, autoLayout(enc, 2, 13), t.c3.id, 0, 0, 13)!;
    expect(ok.slots[t.rcd300.id]).toEqual({ row: 0, col: 2 });
    expect(placed(enc, ok).unplaced).toHaveLength(0);
  });

  it('compare avec la photo : séparations détectées', () => {
    const t = tree();
    const enc = enclosures(t.roots)[0];
    const p = placed(enc, autoLayout(enc, 1, 13)).placed; // 0-4, 4-6, 6-7, 7-9, 9-11
    const edges = new Set([0, 4, 6, 7, 8, 9, 11]);
    const r = compareRow(p, (x) => edges.has(x), 13);
    expect(r.get(t.rcd300.id)).toBe('ok');
    expect(r.get(t.c2.id)).toBe('width'); // séparation au milieu : 2 appareils d'un module sur la photo
  });
});

import { boundaries, deviceEdges } from '../src/board/photo';

describe('photo du tableau', () => {
  it('trouve les séparations entre appareils sur une rangée', () => {
    // Rangée de 6 modules de 20 px : appareils de 2, 1, 1 et 2 modules, tons différents
    const w = 140;
    const h = 60;
    const d = new Uint8Array(w * h).fill(200);
    const blocks: [number, number, number][] = [
      [10, 50, 235],
      [50, 70, 170],
      [70, 90, 235],
      [90, 130, 170],
    ];
    for (const [a, b, v] of blocks) for (let y = 5; y < 55; y++) for (let x = a; x < b; x++) d[y * w + x] = v;
    // Un levier (petit rectangle sombre) ne doit pas compter comme séparation
    for (let y = 25; y < 35; y++) for (let x = 25; x < 35; x++) d[y * w + x] = 60;
    const edges = deviceEdges({ w, h, d }, { x0: 10, y0: 5, x1: 130, y1: 54 }, 20);
    const rounded = edges.map((e) => Math.round(e));
    expect(rounded).toEqual(expect.arrayContaining([2, 3, 4]));
    expect(rounded).not.toContain(1);
  });
});

import { compareReading, extraDevices } from '../src/ai/boardPhoto';

describe('comparaison avec la lecture de la photo (IA)', () => {
  it('relève calibre, largeur et appareils manquants ou en trop', () => {
    const t = tree();
    const enc = enclosures(t.roots)[0];
    t.c1.props.ratedCurrent = 20;
    t.c1.props.curve = 'C';
    const p = placed(enc, autoLayout(enc, 1, 13)).placed; // rcd300 0-4, rcd30 4-6, c1 6-7, c2 7-9, c3 9-11
    const d = (startModule: number, widthModules: number, kind: 'mcb' | 'rcd', extra: object = {}) => ({
      startModule, widthModules, kind, poles: null, ratedCurrentA: null, curve: null, residualCurrentmA: null, rcdType: null, label: null, confidence: 'high' as const, ...extra,
    });
    const reading = {
      notes: null,
      rows: [{ row: 0, devices: [d(0, 4, 'rcd'), d(4, 2, 'rcd', { residualCurrentmA: 30 }), d(6, 1, 'mcb', { ratedCurrentA: 16, curve: 'C' }), d(7, 1, 'mcb'), d(11, 1, 'mcb')] }],
    };
    const res = new Map(compareReading(p, reading).map((x) => [x.nodeId, x]));
    expect(res.get(t.rcd300.id)!.ok).toBe(true);
    expect(res.get(t.rcd30.id)!.ok).toBe(true);
    expect(res.get(t.c1.id)!.issues.map((i) => i.key)).toEqual(['ai.diff.rating']);
    expect(res.get(t.c2.id)!.issues.map((i) => i.key)).toEqual(['ai.diff.width']);
    expect(res.get(t.c3.id)!.issues.map((i) => i.key)).toEqual(['ai.diff.missing']);
    expect(extraDevices(p, reading)).toEqual([{ row: 0, startModule: 11, kind: 'mcb' }]);
  });
});

describe('photo réelle : jointure entre pôles ou séparation entre appareils', () => {
  it('reconnaît des disjoncteurs 2P (2 modules) malgré la jointure entre leurs pôles et les reflets', () => {
    // Profil mesuré sur une vraie photo (tableau Hager, 6 disjoncteurs 2P) : forces aux positions 0…13
    const forces = [7, 4, 14, 4, 38, 17, 97, 17, 94, 10, 14, 5, 6, 9];
    const prof: number[] = [];
    for (let p = 0; p <= 13; p++) for (let k = 0; k < 10; k++) prof.push(k === 0 ? forces[p] : 1);
    const b = boundaries(prof.slice(0, 13 * 10 + 1), 13);
    const seps = b.filter((x) => x.boundary).map((x) => x.pos);
    expect(seps).toEqual(expect.arrayContaining([2, 4, 6, 8, 10]));
    expect(seps).not.toContain(5);
    expect(seps).not.toContain(7);
    expect(seps).not.toContain(9);
  });
});

it('photo réelle : suite de disjoncteurs d’un module (forces mesurées sur un tableau ABB)', () => {
  const forces = [12, 8, 8, 18, 15, 22, 31, 35, 30, 39, 38, 31, 26, 36, 35, 31, 29, 12, 8];
  const prof: number[] = [];
  for (let p = 0; p < forces.length; p++) for (let k = 0; k < 10; k++) prof.push(k === 0 ? forces[p] : 1);
  const seps = boundaries(prof.slice(0, 18 * 10 + 1), 18).filter((x) => x.boundary).map((x) => x.pos);
  for (const p of [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) expect(seps).toContain(p);
});
