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

describe('numéro du dossier proposé automatiquement (RGIE 3.1.2, donné par l’installateur)', () => {
  it('date du projet + code de 3 caractères ; présent dès la création', async () => {
    const { autoDocNumber, emptyProject } = await import('../src/model/tree');
    expect(autoDocNumber('2026-11-25')).toMatch(/^2026-11-25-[A-Z2-9]{3}$/);
    expect(autoDocNumber('date illisible')).toMatch(/^\d{4}-\d{2}-\d{2}-[A-Z2-9]{3}$/);
    expect(emptyProject().meta.docNumber).toMatch(/^\d{4}-\d{2}-\d{2}-[A-Z2-9]{3}$/);
  });

  it('projet ouvert sans numéro : numéro proposé, projet non marqué modifié ; numéro existant gardé', async () => {
    const { useStore } = await import('../src/store');
    const { emptyProject } = await import('../src/model/tree');
    const p = emptyProject();
    p.meta.date = '2025-03-04';
    delete p.meta.docNumber;
    useStore.getState().loadProject(p, 'ancien.voltaplan');
    expect(useStore.getState().project.meta.docNumber).toMatch(/^2025-03-04-[A-Z2-9]{3}$/);
    expect(useStore.getState().dirty).toBe(false);
    const q = emptyProject();
    q.meta.docNumber = 'D-42';
    useStore.getState().loadProject(q, 'x.voltaplan');
    expect(useStore.getState().project.meta.docNumber).toBe('D-42');
  });
});
