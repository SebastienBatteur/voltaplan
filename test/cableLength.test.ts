import { describe, expect, it } from 'vitest';
import { estimateCableLengths } from '../src/calc/cableLength';
import { createNode, emptyPage, emptyProject, findNode } from '../src/model/tree';
import type { ElNode, Project } from '../src/model/types';
import { syncProject } from '../src/model/sync';

/** Tableau posé en (0,0) ; circuit A : prise en (3000,0), interrupteur en (3000,2000) → point lumineux en (5000,2000). */
function sample(length?: number, estimated?: boolean): { p: Project; cable: ElNode } {
  const p = emptyProject();
  const board = p.roots[0].children[0].children[0].children[0];
  const light = createNode('light');
  const sw = createNode('switch');
  sw.children = [light];
  const socket = createNode('socket');
  const cable = createNode('cable', length ? { length, ...(estimated ? { lengthEstimated: true } : {}) } : {});
  cable.children = [socket, sw];
  const mcb = createNode('protection', { device: 'mcb' });
  mcb.children = [cable];
  board.children.push(mcb);
  const page = { ...emptyPage('Rez'), symbols: [board, socket, sw, light].map((n, i) => ({ nodeId: n.id, pos: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 2000 }, { x: 5000, y: 2000 }][i], rotation: 0 })) };
  return { p: { ...p, plan: { ...p.plan, pages: [page] } }, cable };
}

describe('longueur des câbles estimée d’après le plan', () => {
  it('trajet du tableau aux points, à angles droits, montées et descentes, marge ; marquée « estimée »', () => {
    const { p, cable } = sample();
    const r = estimateCableLengths(p);
    expect(r.estimated).toBe(1);
    // Horizontal : 3 + 2 + 2 m ; vertical : tableau 1,5 + prise 2,5 + interrupteur 2,5 + point lumineux 0,3 ; × 1,1
    const expected = Math.ceil(((3000 + 2000 + 2000 + 1500 + 2500 + 2500 + 300) * 1.1) / 1000);
    expect(findNode(r.project.roots, cable.id)!.props).toMatchObject({ length: expected, lengthEstimated: true });
  });

  it('une longueur saisie n’est jamais remplacée ; une estimation est mise à jour', () => {
    const typed = sample(42);
    expect(estimateCableLengths(typed.p).estimated).toBe(0);
    const est = sample(42, true);
    const r = estimateCableLengths(est.p);
    expect(r.estimated).toBe(1);
    expect(findNode(r.project.roots, est.cable.id)!.props.length).not.toBe(42);
  });

  it('points pas encore posés : pas d’estimation, signalé', () => {
    const { p } = sample();
    const r = estimateCableLengths({ ...p, plan: { ...p.plan, pages: [emptyPage('Rez')] } });
    expect(r).toMatchObject({ estimated: 0, notPlaced: 1 });
  });

  it('« Mettre à jour » estime les longueurs et le dit', () => {
    const { p, cable } = sample();
    const r = syncProject(p, { today: '2026-11-26', revisionText: (l) => l, firstRevisionText: 'v1' });
    expect(r.report.cablesEstimated).toBe(1);
    expect(findNode(r.project.roots, cable.id)!.props.lengthEstimated).toBe(true);
  });
});
