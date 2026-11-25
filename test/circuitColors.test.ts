/** Couleur par circuit : tous les éléments d'un circuit partagent la couleur de sa protection ; un sous-tableau a ses propres couleurs. */
import { describe, expect, it } from 'vitest';
import { circuitColorMap, circuitLegend, CIRCUIT_PALETTE } from '../src/ui/circuitColors';
import { createNode } from '../src/model/tree';
import type { ElNode, NodeKind } from '../src/model/types';

const node = (kind: NodeKind, children: ElNode[] = [], props: ElNode['props'] = {}): ElNode => ({ ...createNode(kind, props), children });

describe('couleurs des circuits', () => {
  it('chaque circuit sa couleur, reprise par ses éléments ; sous-tableau à part', () => {
    const socket = node('socket');
    const cable1 = node('cable', [socket]);
    const c1 = node('protection', [cable1], { device: 'mcb' });
    const light = node('light');
    const c3 = node('protection', [node('cable', [light])], { device: 'mcb' });
    const sub = node('board', [c3]);
    const c2 = node('protection', [node('cable', [sub])], { device: 'mcb' });
    const board = node('board', [c1, c2]);
    const map = circuitColorMap([board]);
    expect(map.get(socket.id)?.circuitId).toBe(c1.id);
    expect(map.get(cable1.id)?.color).toBe(map.get(c1.id)?.color);
    expect(map.has(board.id)).toBe(false);
    expect(map.get(light.id)?.circuitId).toBe(c3.id);
    expect(map.get(light.id)?.color).not.toBe(map.get(socket.id)?.color);
    expect(circuitLegend([board], map).map((x) => x.id)).toEqual([c1.id, c2.id, c3.id].filter((id) => map.has(id)));
  });

  it('palette sans bleu de sélection, orange de chaîne ni rouge d’erreur', () => {
    for (const c of CIRCUIT_PALETTE) expect(['#1f6feb', '#4c8dff', '#e8590c', '#ff922b', '#d1242f']).not.toContain(c.toLowerCase());
  });
});
