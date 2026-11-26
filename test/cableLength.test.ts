import { describe, expect, it } from 'vitest';
import { autoWires, estimateCableLengths } from '../src/calc/cableLength';
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
    // Horizontal : 3 + 2 + 2 m ; vertical : tableau 1,5 + prise basse 2 × 0,25 + interrupteur à hauteur de main 2 × 1,5
    // (plafond 2,60 m, interrupteur 1,10 m) + point lumineux au plafond 0,3 ; × 1,1
    const expected = Math.ceil(((3000 + 2000 + 2000 + 1500 + 500 + 3000 + 300) * 1.1) / 1000);
    expect(findNode(r.project.roots, cable.id)!.props).toMatchObject({ length: expected, lengthEstimated: true });
  });

  it('un tracé dessiné entre deux points est suivi au lieu du trajet à angles droits', () => {
    const { p, cable } = sample();
    const sw = cable.children[1];
    const light = sw.children[0];
    // Interrupteur (3000,2000) → point lumineux (5000,2000) par (4000,4000) : 2 × √(1000² + 2000²) au lieu de 2000
    const pages = [{ ...p.plan.pages[0], wires: [{ a: light.id, b: sw.id, pts: [{ x: 4000, y: 4000 }] }] }];
    const r = estimateCableLengths({ ...p, plan: { ...p.plan, pages } });
    expect(r.traced).toBe(1);
    const expected = Math.ceil(((3000 + 2000 + 2 * Math.hypot(1000, 2000) + 1500 + 500 + 3000 + 300) * 1.1) / 1000);
    expect(findNode(r.project.roots, cable.id)!.props.length).toBe(expected);
  });

  it('tracés créés d’après l’unifilaire : tableau → prise → interrupteur → point lumineux, à angles droits ; même longueur', () => {
    const { p, cable } = sample();
    const r = autoWires(p);
    expect(r.added).toBe(3);
    const w = r.project.plan.pages[0].wires!;
    const [socket, sw] = cable.children;
    expect(w.map((x) => [x.a, x.b])).toEqual([
      [p.plan.pages[0].symbols[0].nodeId, socket.id],
      [socket.id, sw.id],
      [sw.id, sw.children[0].id],
    ]);
    expect(w.every((x) => x.auto && x.pts.length === 0)).toBe(true); // points alignés : pas de coude
    expect(findNode(estimateCableLengths(r.project).project.roots, cable.id)!.props.length).toBe(findNode(estimateCableLengths(p).project.roots, cable.id)!.props.length);
    // Câble déjà tracé (Condui) : pas touché
    expect(autoWires(r.project).added).toBe(0);
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
