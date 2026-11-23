import { layoutUnifilar, type LabelFn } from '../src/unifilar/layout';
import { createNode } from '../src/model/tree';
import type { ElNode } from '../src/model/types';

const L: LabelFn = { ref: () => undefined, protection: () => ['C20'], cable: () => 'XVB 3G2,5', title: (n) => n.kind };

function tree() {
  const n = (kind: ElNode['kind'], kids: ElNode[] = [], props = {}) => {
    const x = createNode(kind, props);
    x.children = kids;
    return x;
  };
  const s1 = n('socket');
  const s2 = n('socket');
  const light = n('light');
  const cA = n('cable', [s1, s2]);
  const pA = n('protection', [cA], { device: 'mcb', ratedCurrent: 20 });
  const cB = n('cable', [n('switch', [light])]);
  const pB = n('protection', [cB], { device: 'mcb', ratedCurrent: 16 });
  const board = n('board', [pA, pB]);
  const rcd = n('protection', [board], { device: 'rcd', residualCurrent: 300 });
  const meter = n('meter', [rcd]);
  const origin = n('origin', [meter]);
  return { roots: [origin], origin, meter, rcd, board, pA, s1, s2 };
}

function y(layout: ReturnType<typeof layoutUnifilar>, id: string) {
  const p = layout.pos.get(id);
  if (!p) throw new Error('position manquante');
  return p.y;
}

describe('mise en page de l’unifilaire', () => {
  it('par défaut, de bas en haut (RGIE fig. 3.1) : alimentation en bas, points numérotés en montant', () => {
    const t = tree();
    const lay = layoutUnifilar(t.roots, L);
    expect(y(lay, t.origin.id)).toBeGreaterThan(y(lay, t.meter.id));
    expect(y(lay, t.meter.id)).toBeGreaterThan(y(lay, t.rcd.id));
    expect(y(lay, t.rcd.id)).toBeGreaterThan(y(lay, t.board.id));
    expect(y(lay, t.board.id)).toBeGreaterThan(y(lay, t.pA.id));
    expect(y(lay, t.pA.id)).toBeGreaterThan(y(lay, t.s1.id));
    // Premier point (le plus proche de la protection) en bas
    expect(y(lay, t.s1.id)).toBeGreaterThan(y(lay, t.s2.id));
  });

  it('option de haut en bas', () => {
    const t = tree();
    const lay = layoutUnifilar(t.roots, L, { up: false });
    expect(y(lay, t.origin.id)).toBeLessThan(y(lay, t.meter.id));
    expect(y(lay, t.board.id)).toBeLessThan(y(lay, t.pA.id));
    expect(y(lay, t.s1.id)).toBeLessThan(y(lay, t.s2.id));
  });

  it('reste dans le cadre du dessin', () => {
    for (const up of [true, false]) {
      const lay = layoutUnifilar(tree().roots, L, { up });
      for (const p of lay.prims) {
        const ys = p.t === 'line' ? [p.y1, p.y2] : [p.y];
        for (const v of ys) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(lay.h);
        }
      }
    }
  });
});

it('mise à la terre : du côté opposé aux circuits, comme l’alimentation, et reliée à la barre du tableau', async () => {
  const { createNode } = await import('../src/model/tree');
  const { layoutUnifilar } = await import('../src/unifilar/layout');
  const board = createNode('board');
  const mcb = createNode('protection', { device: 'mcb' });
  const cable = createNode('cable');
  cable.children = [createNode('socket')];
  mcb.children = [cable];
  const bar = createNode('earthBar');
  const earth = createNode('earth');
  bar.children = [earth];
  board.children = [mcb, bar];
  const L = { ref: () => undefined, protection: () => ['x'], cable: () => 'c', title: () => 't' };
  for (const up of [true, false]) {
    const { prims } = layoutUnifilar([board], L, { up });
    const bus = prims.find((p) => p.t === 'bus')!;
    const y = (id: string) => (prims.find((p) => p.t === 'sym' && p.node.id === id) as { y: number }).y;
    const bx = bus.t === 'bus' ? bus : null;
    // Circuits d'un côté de la barre, terre de l'autre
    if (up) {
      expect(y(mcb.id)).toBeLessThan(bx!.y);
      expect(y(bar.id)).toBeGreaterThanOrEqual(bx!.y);
      expect(y(earth.id)).toBeGreaterThan(y(bar.id));
    } else {
      expect(y(mcb.id)).toBeGreaterThan(bx!.y);
      expect(y(bar.id)).toBeLessThan(bx!.y);
      expect(y(earth.id)).toBeLessThan(y(bar.id));
    }
    // La barre du tableau va jusqu'à la colonne de terre
    const barX = (prims.find((p) => p.t === 'sym' && p.node.id === bar.id) as { x: number }).x;
    expect(bx!.x2).toBeGreaterThanOrEqual(barX);
  }
});
