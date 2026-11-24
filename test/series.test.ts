import { describe, expect, it } from 'vitest';
import { computeNumbering, createNode, insertInSeries, isCircuit } from '../src/model/tree';

describe('protection en série (disjoncteur connecté derrière le disjoncteur du circuit)', () => {
  it('reprend les câbles, garde la lettre du circuit et la numérotation des points', () => {
    const board = createNode('board');
    const n = createNode('protection', { device: 'mcb', ratedCurrent: 20, circuitName: 'Four' });
    const o = createNode('protection', { device: 'mcb', ratedCurrent: 25, circuitName: 'Pompe à chaleur' });
    const mk = () => {
      const c = createNode('cable');
      c.children = [createNode('appliance')];
      return c;
    };
    n.children = [mk()];
    o.children = [mk()];
    board.children = [n, o];
    const before = computeNumbering([board]);
    expect(before.get(o.id)).toBe('B');
    const earu = createNode('protection', { device: 'mcb', ratedCurrent: 25, reference: 'EARU EAKCB-Z-M', series: true });
    const roots = insertInSeries([board], o.id, earu);
    const o2 = roots[0].children[1];
    expect(o2.children.map((c) => c.id)).toEqual([earu.id]);
    expect(o2.children[0].children[0].kind).toBe('cable');
    expect(isCircuit(o2)).toBe(true);
    expect(isCircuit(o2.children[0])).toBe(false);
    const after = computeNumbering(roots);
    expect(after.get(o.id)).toBe('B');
    expect(after.get(earu.id)).toBeUndefined();
    expect(after.get(o2.children[0].children[0].children[0].id)).toBe('B1');
  });
});
