import { readFileSync, existsSync } from 'node:fs';
import { importTrikker } from '../src/import/trikker';
import { syncProject, freeSlot } from '../src/model/sync';
import { createNode, emptyProject, emptyPage, findNode, walk } from '../src/model/tree';
import type { ElNode, Project } from '../src/model/types';

const opts = { today: '2026-11-23', firstRevisionText: 'Version initiale', revisionText: (l: string) => 'Ajout ' + l };

function circuit(loc: string): ElNode {
  const p = createNode('protection', { device: 'mcb', ratedCurrent: 16, poles: '1P+N' });
  const c = createNode('cable', { cableType: 'VOB', section: 2.5, conductors: 3 });
  const s = createNode('socket', { count: 1 });
  s.location = loc;
  c.children = [s];
  p.children = [c];
  return p;
}

function project(): { p: Project; board: ElNode } {
  const p = emptyProject();
  const board = createNode('board', { rows: 1, modulesPerRow: 4 });
  board.children = [circuit('Cuisine'), circuit('Chambre 1')];
  const origin = createNode('origin');
  origin.children = [board];
  p.roots = [origin];
  const page = emptyPage('Rez');
  page.labels = [{ id: 'l1', text: 'Cuisine', pos: { x: 2000, y: 1000 } }];
  page.walls = [{ a: { x: 0, y: 0 }, b: { x: 5000, y: 0 }, thickness: 200 }] as never;
  p.plan.pages = [page];
  return { p, board };
}

describe('mise à jour après ajout de circuits', () => {
  it('premier passage : tableau disposé, points posés, révision initiale', () => {
    const { p, board } = project();
    const { project: q, report } = syncProject(p, opts);
    expect(report.firstSync).toBe(true);
    expect(Object.keys(q.boards![board.id].slots)).toHaveLength(2);
    expect(report.planByRoom).toBe(1); // la prise de la cuisine, près du texte « Cuisine »
    expect(report.planToPlace).toBe(2); // le tableau et « Chambre 1 » (pas de texte sur le plan)
    const sym = q.plan.pages[0].symbols.find((s) => s.pos.y > 1000)!;
    expect(Math.abs(sym.pos.x - 2000)).toBeLessThan(1000);
    expect(q.meta.revisions).toEqual([{ version: '1', date: '2026-11-23', description: 'Version initiale' }]);
  });

  it('ajout d’un circuit : seul le nouveau est posé, les autres ne bougent pas, révision 2', () => {
    const { p, board } = project();
    const first = syncProject(p, opts).project;
    // l'utilisateur déplace un appareil puis ajoute un circuit
    const moved = { ...first, boards: { [board.id]: { slots: { ...first.boards![board.id].slots } } } };
    const [a] = board.children;
    moved.boards[board.id].slots[a.id] = { row: 0, col: 3 };
    const added = circuit('Cuisine');
    // Le circuit est ajouté au tableau du projet mis à jour (pas à l'objet d'avant la mise à jour)
    const synced = findNode(moved.roots, board.id)!;
    synced.children = [...synced.children, added];
    const { project: q, report } = syncProject(moved, opts);
    expect(report.newCircuits).toHaveLength(1);
    expect(report.boardPlaced).toBe(1);
    expect(q.boards![board.id].slots[a.id]).toEqual({ row: 0, col: 3 });
    expect(q.boards![board.id].slots[added.id]).toEqual({ row: 0, col: 0 });
    expect(q.meta.revisions!.at(-1)!.description).toMatch(/^Ajout /);
    // une 2e mise à jour sans changement n'ajoute rien
    const again = syncProject(q, opts);
    expect(again.report.newNodes).toBe(0);
    expect(again.project.meta.revisions).toHaveLength(2);
  });

  it('tableau plein : signalé, rien n’est écrasé', () => {
    expect(freeSlot([[true, true, false, false]], 2)).toEqual({ row: 0, col: 2 });
    expect(freeSlot([[true, false, true, false]], 2)).toBeNull();
  });

  it('projet réel (maison B)', () => {
    if (!existsSync('test/fixtures/maison-b.trik')) return;
    const { project: p } = importTrikker(readFileSync('test/fixtures/maison-b.trik', 'utf8'));
    const { project: q, report } = syncProject(p, opts);
    expect(report.boardPlaced + report.boardNoRoom).toBeGreaterThan(20);
    expect([...walk(q.roots)].length).toBe(q.meta.syncedIds!.length);
  });
});
