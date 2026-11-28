/**
 * Provenance des valeurs (ADR-0010) : dans un relevé d'installation existante, une valeur proposée par l'application
 * n'est jamais une caractéristique de l'installation. Chemins de création, contrôle et aller-retour du fichier.
 */
import { describe, expect, it } from 'vitest';
import { SURVEY_UNSET } from '../src/model/schema';
import { createNode, emptyProject, findNode } from '../src/model/tree';
import type { ElNode, Project } from '../src/model/types';
import { checkProject, isSurveyPart } from '../src/rules';

const existingProject = (date = '1998-01-01'): Project => {
  const p = emptyProject();
  p.meta.installationKind = 'existing';
  p.meta.installationDate = date;
  return p;
};
const boardOf = (p: Project) => p.roots[0].children[0].children[0].children[0];

describe('Création d’un élément : relevé sans valeur par défaut réglementaire', () => {
  it.each(Object.entries(SURVEY_UNSET))('%s : en relevé, les valeurs réglementaires restent inconnues', (kind, keys) => {
    const n = createNode(kind as ElNode['kind'], {}, { survey: true });
    for (const k of keys!) expect(n.props[k], `${kind}.${k}`).toBeUndefined();
  });

  it('en conception, les valeurs par défaut restent proposées (comportement inchangé)', () => {
    expect(createNode('protection').props).toMatchObject({ device: 'mcb', ratedCurrent: 20, poles: '1P+N', curve: 'C' });
    expect(createNode('socket').props).toMatchObject({ earth: true, childSafety: true });
  });

  it('une valeur fournie est gardée, même en relevé', () => {
    expect(createNode('protection', { ratedCurrent: 16 }, { survey: true }).props.ratedCurrent).toBe(16);
  });

  it('les valeurs sans effet réglementaire gardent leur défaut en relevé (symbole, placement)', () => {
    expect(createNode('cable', {}, { survey: true }).props.inConduit).toBe(true);
    expect(createNode('socket', {}, { survey: true }).props.count).toBe(1);
  });
});

describe('Partie de relevé ou de conception', () => {
  it('projet neuf : conception ; projet existant : relevé', () => {
    expect(isSurveyPart(emptyProject(), [])).toBe(false);
    expect(isSurveyPart(existingProject(), [])).toBe(true);
  });

  it('partie ancienne dans un projet neuf : relevé', () => {
    const p = emptyProject();
    const b = boardOf(p);
    b.props.oldPart = true;
    expect(isSurveyPart(p, [...p.roots[0].children[0].children[0].children, b])).toBe(true);
  });
});

describe('Store : ajout et mise en série dans un relevé', () => {
  it('ajout d’une protection dans un relevé : calibre, pôles, courbe inconnus', async () => {
    const { useStore } = await import('../src/store');
    const p = existingProject();
    useStore.getState().loadProject(p, 'releve.voltaplan');
    const board = boardOf(useStore.getState().project);
    useStore.getState().addChild(board.id, 'protection');
    const id = useStore.getState().selectedId!;
    const n = findNode(useStore.getState().project.roots, id)!;
    expect(n.props.ratedCurrent).toBeUndefined();
    expect(n.props.poles).toBeUndefined();
    expect(n.props.curve).toBeUndefined();
  });

  it('ajout d’une protection en conception : valeurs proposées (inchangé)', async () => {
    const { useStore } = await import('../src/store');
    useStore.getState().loadProject(emptyProject(), 'neuf.voltaplan');
    const board = boardOf(useStore.getState().project);
    useStore.getState().addChild(board.id, 'protection');
    const n = findNode(useStore.getState().project.roots, useStore.getState().selectedId!)!;
    expect(n.props.ratedCurrent).toBe(20);
  });

  it('appareil en série dans un relevé : n’hérite pas du calibre du disjoncteur du dessus', async () => {
    const { useStore } = await import('../src/store');
    const p = existingProject();
    const board = boardOf(p);
    const up = createNode('protection', { device: 'mcb', ratedCurrent: 32, curve: 'C', poles: '1P+N', circuitName: 'A' });
    board.children.push(up);
    useStore.getState().loadProject(p, 'releve.voltaplan');
    const id = useStore.getState().insertSeries(up.id);
    const n = findNode(useStore.getState().project.roots, id)!;
    expect(n.props.ratedCurrent).toBeUndefined();
    expect(n.props.curve).toBeUndefined();
    expect(n.props.series).toBe(true);
  });
});

describe('Contrôle : terre et obturateurs d’une prise de relevé non renseignés', () => {
  const withSocket = (p: Project, props: ElNode['props']) => {
    const s = createNode('socket', props, { survey: p.meta.installationKind === 'existing' });
    const c = createNode('protection', { device: 'mcb', ratedCurrent: 20, curve: 'C', poles: '1P+N', circuitName: 'P' });
    c.children.push({ ...createNode('cable', { section: 2.5 }), children: [s] });
    boardOf(p).children.push(c);
    return s;
  };

  it('relevé : terre non renseignée → informations insuffisantes, pas « présente »', () => {
    const p = existingProject();
    const s = withSocket(p, {});
    const f = checkProject(p).find((x) => x.ruleId === 'R-SOCKET-EARTH' && x.nodeId === s.id);
    expect(f).toMatchObject({ status: 'insufficientData', knowledge: 'unknown' });
  });

  it('relevé : obturateurs non renseignés → informations insuffisantes', () => {
    const p = existingProject();
    const s = withSocket(p, { earth: true });
    const f = checkProject(p).find((x) => (x.ruleId === 'R-SOCKET-CHILD' || x.ruleId === 'R-SOCKET-IPXXD') && x.nodeId === s.id);
    expect(f).toMatchObject({ knowledge: 'unknown' });
    expect(f?.status).not.toBe('nonCompliant');
  });

  it('relevé : prise rasoir sans terre renseignée → pas de constat de terre', () => {
    const p = existingProject();
    const s = withSocket(p, { socketKind: 'shaver' });
    expect(checkProject(p).find((x) => x.ruleId === 'R-SOCKET-EARTH' && x.nodeId === s.id)).toBeUndefined();
  });

  it('conception : valeur absente = symbole par défaut (pas de constat)', () => {
    const p = emptyProject();
    const s = withSocket(p, {});
    delete s.props.earth;
    expect(checkProject(p).find((x) => x.ruleId === 'R-SOCKET-EARTH' && x.nodeId === s.id)).toBeUndefined();
  });
});
