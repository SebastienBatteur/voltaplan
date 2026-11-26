import { describe, expect, it } from 'vitest';
import { conventionalLayout, enclosures } from '../src/board/model';
import { createNode } from '../src/model/tree';
import type { ElNode } from '../src/model/types';

const n = (kind: ElNode['kind'], kids: ElNode[] = [], props = {}) => {
  const x = createNode(kind, props);
  x.children = kids;
  return x;
};
const mcb = (poles = '1P+N') => n('protection', [n('cable', [n('socket')])], { device: 'mcb', poles });

function tree(opts: { rcd3?: boolean } = {}) {
  const g1 = [mcb(), mcb(), mcb()];
  const g2 = [mcb(), mcb()];
  const rA = n('protection', [n('board', g1)], { device: 'rcd', poles: '2P', residualCurrent: 30 });
  const rB = n('protection', [n('board', g2)], { device: 'rcd', poles: '2P', residualCurrent: 30 });
  const cooker = mcb('2P');
  const g3 = [mcb('4P')];
  const r3 = n('protection', [n('board', g3)], { device: 'rcd', poles: '4P', residualCurrent: 30 });
  const main = n('board', [rA, cooker, rB, ...(opts.rcd3 ? [r3] : [])]);
  const r300 = n('protection', [main], { device: 'rcd', poles: '4P', residualCurrent: 300 });
  const root = n('origin', [n('cable', [n('meter', [n('cable', [r300])])])]);
  return { roots: [root], r300, rA, rB, g1, g2, cooker, r3, g3 };
}

describe('rangement habituel du tableau', () => {
  it('une rangée par 30 mA, la rangée principale en haut avec le général et le hors 30 mA', () => {
    const t = tree();
    const lay = conventionalLayout(enclosures(t.roots)[0], 2, 13);
    expect(lay.rows).toBe(3);
    expect(lay.slots[t.r300.id]).toEqual({ row: 0, col: 0 });
    expect(lay.slots[t.cooker.id]).toEqual({ row: 0, col: 4 });
    expect(lay.slots[t.rA.id]).toEqual({ row: 1, col: 0 });
    expect(t.g1.map((d) => lay.slots[d.id])).toEqual([{ row: 1, col: 2 }, { row: 1, col: 3 }, { row: 1, col: 4 }]);
    expect(lay.slots[t.rB.id]).toEqual({ row: 2, col: 0 });
  });

  it('rangée principale en bas : dernière rangée du tableau', () => {
    const t = tree();
    const lay = conventionalLayout(enclosures(t.roots)[0], 4, 13, 'bottom');
    expect(lay.rows).toBe(4);
    expect(lay.slots[t.rA.id]).toEqual({ row: 0, col: 0 });
    expect(lay.slots[t.rB.id]).toEqual({ row: 1, col: 0 });
    expect(lay.slots[t.r300.id]).toEqual({ row: 3, col: 0 });
  });

  it('30 mA triphasé sur la rangée principale s\'il reste la place, sinon sa propre rangée', () => {
    const t = tree({ rcd3: true });
    const wide = conventionalLayout(enclosures(t.roots)[0], 1, 18);
    expect(wide.slots[t.r3.id]).toEqual({ row: 0, col: 6 });
    expect(wide.slots[t.g3[0].id]).toEqual({ row: 0, col: 10 });
    const narrow = conventionalLayout(enclosures(t.roots)[0], 1, 12);
    expect(narrow.slots[t.r3.id]).toEqual({ row: 1, col: 0 });
    expect(narrow.slots[t.rA.id]).toEqual({ row: 2, col: 0 });
  });

  it('un groupe trop long continue sur la rangée suivante sans couper un appareil', () => {
    const t = tree();
    const lay = conventionalLayout(enclosures(t.roots)[0], 1, 4);
    expect(lay.slots[t.rA.id]).toEqual({ row: 2, col: 0 });
    expect(lay.slots[t.g1[2].id]).toEqual({ row: 3, col: 0 });
    for (const s of Object.values(lay.slots)) expect(s.col).toBeLessThan(4);
  });
});
