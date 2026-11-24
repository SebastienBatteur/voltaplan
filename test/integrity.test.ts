import { pruneReferences, validateProject } from '../src/model/integrity';
import { CURRENT_VERSION, migrateProject, parseProjectText, ProjectFileError } from '../src/model/migrate';
import { createNode, emptyProject } from '../src/model/tree';
import { useStore } from '../src/store';
import type { Project } from '../src/model/types';

/** Projet avec un circuit référencé partout : plan, tableau, vérification photo, essai, synchro, dérogation. */
function referenced(): { p: Project; prot: string; socket: string; board: string } {
  const p = emptyProject();
  const board = p.roots[0].children[0].children[0].children[0];
  const socket = createNode('socket');
  const cable = createNode('cable', { section: 2.5 });
  cable.children = [socket];
  const prot = createNode('protection', { device: 'rcbo', ratedCurrent: 20, residualCurrent: 30 });
  prot.children = [cable];
  board.children.push(prot);
  p.plan.pages[0].symbols.push({ nodeId: socket.id, pos: { x: 0, y: 0 }, rotation: 0 });
  p.boards = { [board.id]: { slots: { [prot.id]: { row: 0, col: 0 } }, checks: { [prot.id]: 'ok' } } };
  p.measurements.rcdTests = { [prot.id]: { tripMs: 20 } };
  p.meta.syncedIds = [prot.id, socket.id, board.id];
  p.meta.derogations = [{ ruleId: 'R-X', nodeId: socket.id, reason: 'motif' }];
  return { p, prot: prot.id, socket: socket.id, board: board.id };
}

describe('intégrité : suppression', () => {
  it('supprimer un circuit retire toutes ses références (plan, tableau, mesures, synchro, dérogations)', () => {
    const { p, prot, socket, board } = referenced();
    useStore.getState().loadProject(p, 'test');
    useStore.getState().remove(prot);
    const after = useStore.getState().project;
    expect(validateProject(after)).toEqual([]);
    expect(after.plan.pages[0].symbols).toEqual([]);
    expect(after.boards![board].slots[prot]).toBeUndefined();
    expect(after.boards![board].checks![prot]).toBeUndefined();
    expect(after.measurements.rcdTests![prot]).toBeUndefined();
    expect(after.meta.syncedIds).toEqual([board]);
    expect(after.meta.derogations).toEqual([]);
    expect(socket).toBeTruthy();
  });

  it('annuler la suppression rend tout, rétablir la refait', () => {
    const { p, prot } = referenced();
    const s = useStore.getState();
    s.loadProject(p, 'test');
    s.remove(prot);
    useStore.getState().undo();
    expect(useStore.getState().project).toBe(p);
    useStore.getState().redo();
    expect(validateProject(useStore.getState().project)).toEqual([]);
  });

  it('pruneReferences ne change rien sur un projet sain (même objet)', () => {
    const { p } = referenced();
    expect(pruneReferences(p)).toBe(p);
  });

  it('supprimer un tableau retire sa disposition', () => {
    const { p, board } = referenced();
    useStore.getState().loadProject(p, 'test');
    useStore.getState().remove(board);
    expect(useStore.getState().project.boards?.[board]).toBeUndefined();
  });
});

describe('intégrité : validation', () => {
  it('détecte ids dupliqués, références absentes, branchements interdits et valeurs invalides', () => {
    const { p } = referenced();
    const board = p.roots[0].children[0].children[0].children[0];
    const dup = createNode('socket');
    dup.id = board.id;
    board.children.push(dup); // id dupliqué + prise directement sous un tableau
    p.plan.pages[0].symbols.push({ nodeId: 'fantome', pos: { x: 0, y: 0 }, rotation: 0 });
    (board.children[0] as { props: Record<string, unknown> }).props.ratedCurrent = -5;
    const codes = validateProject(p).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['duplicateId', 'missingRef', 'invalidChild', 'invalidValue']));
  });

  it('une disposition rattachée à un élément qui n’est pas un tableau est signalée', () => {
    const { p, prot } = referenced();
    p.boards![prot] = { slots: {} };
    expect(validateProject(p).some((i) => i.code === 'notABoard')).toBe(true);
  });
});

describe('lecture et migration des fichiers', () => {
  it('aller-retour JSON sans perte, champs inconnus conservés', () => {
    const { p } = referenced();
    const withExtra = { ...p, futureField: { a: 1 }, meta: { ...p.meta, customNote: 'x' } };
    const { project, issues } = parseProjectText(JSON.stringify(withExtra));
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(project).toEqual({ ...JSON.parse(JSON.stringify(withExtra)), version: CURRENT_VERSION });
  });

  it('ancien format OpenRGIE : ouvert et converti, signalé', () => {
    const { p } = referenced();
    const r = migrateProject({ ...JSON.parse(JSON.stringify(p)), format: 'openrgie', loose: undefined });
    expect(r.project.format).toBe('voltaplan');
    expect(r.project.loose).toEqual([]);
    expect(r.warnings.map((w) => w.key)).toContain('file.legacyFormat');
  });

  it('références orphelines à l’ouverture : signalées, rien n’est supprimé', () => {
    const { p } = referenced();
    p.plan.pages[0].symbols.push({ nodeId: 'fantome', pos: { x: 1, y: 1 }, rotation: 0 });
    const r = parseProjectText(JSON.stringify(p));
    expect(r.project.plan.pages[0].symbols).toHaveLength(2);
    expect(r.warnings.map((w) => w.key)).toContain('file.integrityIssues');
  });

  it('erreurs explicites : JSON tronqué, format inconnu, version plus récente, structure invalide', () => {
    const { p } = referenced();
    const code = (f: () => unknown) => {
      try {
        f();
      } catch (e) {
        return e instanceof ProjectFileError ? e.code : 'other';
      }
      return 'none';
    };
    expect(code(() => parseProjectText(JSON.stringify(p).slice(0, 100)))).toBe('notJson');
    expect(code(() => migrateProject({ ...p, format: 'autre' }))).toBe('unknownFormat');
    expect(code(() => migrateProject({ ...p, version: CURRENT_VERSION + 1 }))).toBe('newerVersion');
    expect(code(() => migrateProject({ ...p, roots: [{ kind: 'socket' }] }))).toBe('invalidStructure');
  });
});

describe('intégrité : fichiers Trikker réels', () => {
  it('aucune erreur d’intégrité après import (structures inhabituelles = remarques seulement)', async () => {
    const { existsSync, readFileSync } = await import('fs');
    const { importTrikker } = await import('../src/import/trikker');
    for (const n of ['a', 'b', 'c']) {
      const f = `test/fixtures/maison-${n}.trik`;
      if (!existsSync(f)) continue;
      const { project } = importTrikker(readFileSync(f, 'utf8'));
      expect(validateProject(project).filter((i) => i.level === 'error')).toEqual([]);
    }
  });
});
