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
