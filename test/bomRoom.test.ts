/** Matériel par pièce : pièce de l'élément, d'un parent, sinon étage du plan ; tableaux et câbles à part. */
import { describe, expect, it } from 'vitest';
import { billOfMaterialsByRoom, roomOf } from '../src/bom/bom';
import { computeNumbering, createNode, emptyProject } from '../src/model/tree';
import { translate } from '../src/i18n';
import type { ElNode, NodeKind } from '../src/model/types';

const node = (kind: NodeKind, children: ElNode[] = [], location?: string): ElNode => ({ ...createNode(kind), children, location });
const t = (k: string, p?: Record<string, string | number>) => translate('fr', k, p);

describe('matériel par pièce', () => {
  it('regroupe les points par pièce, dans l’ordre : pièces, étages, non placés ; le reste à part', () => {
    const s1 = node('socket', [], 'Cuisine');
    const s2 = node('socket', [], 'Chambre 2');
    const s3 = node('socket', [], 'Chambre 10');
    const box = node('junctionBox', [node('light')], 'Salon');
    const lone = node('light');
    const placed = node('light');
    const p = emptyProject();
    const board = [...(function* w(ns: ElNode[]): Generator<ElNode> { for (const n of ns) { yield n; yield* w(n.children); } })(p.roots)].find((n) => n.kind === 'board')!;
    board.children.push(node('protection', [node('cable', [s1, s2, s3, box, lone, placed])]));
    p.plan.pages[0].symbols.push({ nodeId: placed.id, pos: { x: 0, y: 0 }, rotation: 0 });
    const lightInBox = box.children[0];
    expect(roomOf(p, lightInBox)?.key).toBe('Salon');
    expect(roomOf(p, placed)).toEqual({ key: p.plan.pages[0].name, floorOnly: true });
    expect(roomOf(p, lone)).toBeNull();
    const r = billOfMaterialsByRoom(p, computeNumbering(p.roots), 'fr', t);
    expect(r.rooms.map((x) => x.room)).toEqual(['Chambre 2', 'Chambre 10', 'Cuisine', 'Salon', p.plan.pages[0].name, null]);
    expect(r.rooms[2].lines.find((l) => l.cat === 'socket')?.qty).toBe(1);
    expect(r.shared.some((l) => l.cat === 'cable')).toBe(true);
    expect(r.shared.some((l) => l.cat === 'socket')).toBe(false);
  });
});
