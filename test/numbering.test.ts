/**
 * Repérage RGIE 3.1.2.1 (Livre 1, 2026) : « Chaque circuit élémentaire est identifié par une lettre majuscule »,
 * chaque point lumineux, socle de prise et unité de commande par « un numéro donnant l'ordre dans lequel on rencontre
 * ces éléments dans le circuit en partant du dispositif de protection » ; « Chaque interrupteur [est identifié] par
 * la lettre du circuit [...] et le numéro d'ordre du point lumineux ou de l'appareil qu'il commande ».
 */
import { describe, expect, it } from 'vitest';
import { computeNumbering, createNode } from '../src/model/tree';
import type { ElNode, NodeKind } from '../src/model/types';

const node = (kind: NodeKind, props: ElNode['props'], children: ElNode[] = []): ElNode => ({ ...createNode(kind, props), children });

describe('repérage des circuits (RGIE 3.1.2.1)', () => {
  it('lettre par circuit, numéros dans l’ordre depuis la protection, interrupteur = numéro du point commandé', () => {
    const socket1 = node('socket', {});
    const socket2 = node('socket', {});
    const light = node('light', {});
    const sw = node('switch', {}, [light]);
    const c1 = node('protection', { device: 'mcb', ratedCurrent: 20 }, [node('cable', {}, [socket1, socket2])]);
    const c2 = node('protection', { device: 'mcb', ratedCurrent: 16 }, [node('cable', {}, [sw])]);
    const board = node('board', {}, [c1, c2]);
    const n = computeNumbering([board]);
    expect(n.get(c1.id)).toBe('A');
    expect(n.get(c2.id)).toBe('B');
    expect([n.get(socket1.id), n.get(socket2.id)]).toEqual(['A1', 'A2']);
    expect(n.get(light.id)).toBe('B1');
    expect(n.get(sw.id)).toBe('B1');
  });
});
