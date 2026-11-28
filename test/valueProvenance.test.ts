// @vitest-environment node
/**
 * Provenance des valeurs (ADR-0010) : dans un relevé d'installation existante, une valeur proposée par l'application
 * n'est jamais une caractéristique de l'installation. Chemins de création, contrôle et aller-retour du fichier.
 */
import { describe, expect, it } from 'vitest';
import { SURVEY_UNSET } from '../src/model/schema';
import { createNode, emptyProject, findNode, walk } from '../src/model/tree';
import { importPdfDossier, type PdfText } from '../src/import/pdfDossier';
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

describe('Imports : seulement ce que dit le fichier (ADR-0010)', () => {
  const t = (page: number, x: number, y: number, str: string): PdfText => ({ page, x, y, str, size: 7 });
  const table = (): PdfText[] => [
    t(1, 50, 90, 'Circuit'),
    t(1, 100, 90, 'Description'),
    t(1, 300, 90, 'Protection'),
    t(1, 400, 90, 'Points'),
    ...['A', 'B'].map((c, i) => [t(1, 50, 108 + 18 * i, c), t(1, 100, 108 + 18 * i, 'Prises'), t(1, 300, 108 + 18 * i, 'C20'), t(1, 400, 108 + 18 * i, '2')]).flat(),
  ];
  const nodes = (p: Project) => [...walk(p.roots)].map((w) => w.node);

  it('PDF sans différentiel général lisible : aucun différentiel inventé, tableau sous le compteur', () => {
    const { project, warnings } = importPdfDossier(table(), [{ width: 595, height: 842 }], 'dossier.pdf');
    expect(nodes(project).filter((n) => n.props.device === 'rcd')).toEqual([]);
    const meter = project.roots[0].children[0];
    expect(meter.children[0].kind).toBe('board');
    expect(warnings.map((w) => w.key)).toContain('imp.pdf.mainDefault');
  });

  it('PDF : installation existante, réseau inconnu s’il n’est pas écrit, avertissement', () => {
    const { project, warnings } = importPdfDossier(table(), [{ width: 595, height: 842 }], 'dossier.pdf');
    expect(project.meta.installationKind).toBe('existing');
    expect(project.meta.supply).toBe('');
    expect(warnings.map((w) => w.key)).toContain('imp.kindExisting');
  });

  it('PDF : pôles, pouvoir de coupure, section et terre des prises non écrits restent inconnus', () => {
    const { project } = importPdfDossier(table(), [{ width: 595, height: 842 }], 'dossier.pdf');
    const prot = nodes(project).filter((n) => n.kind === 'protection');
    expect(prot.length).toBeGreaterThan(0);
    for (const n of prot) {
      expect(n.props.ratedCurrent).toBe(20);
      expect(n.props.poles).toBeUndefined();
      expect(n.props.breakingCapacity).toBeUndefined();
    }
    for (const c of nodes(project).filter((n) => n.kind === 'cable')) expect(c.props.section).toBeUndefined();
    const sockets = nodes(project).filter((n) => n.kind === 'socket');
    expect(sockets.length).toBeGreaterThan(0);
    for (const s of sockets) {
      expect(s.props.earth).toBeUndefined();
      expect(s.props.childSafety).toBeUndefined();
    }
  });

  it('PDF importé puis contrôlé : prises sans terre renseignée → informations insuffisantes, jamais « conforme »', () => {
    const { project } = importPdfDossier(table(), [{ width: 595, height: 842 }], 'dossier.pdf');
    const earth = checkProject(project).filter((f) => f.ruleId === 'R-SOCKET-EARTH');
    expect(earth.length).toBeGreaterThan(0);
    expect(earth.every((f) => f.status === 'insufficientData')).toBe(true);
  });
});

describe('Aller-retour .voltaplan : une donnée inconnue reste inconnue', () => {
  it('protection et prise de relevé sans valeurs : rien n’apparaît après enregistrement et relecture', async () => {
    const { AssetStore, MemoryAssetBackend } = await import('../src/format/assets');
    const { AssetSession } = await import('../src/format/session');
    const { openProjectData, serializeProject } = await import('../src/io/projectData');
    const session = () => {
      const store = new AssetStore(new MemoryAssetBackend());
      return new AssetSession(() => store);
    };
    const buildArchive = async (pr: Project) => (await serializeProject(pr, undefined, session()))!;
    const readArchive = async (b: Blob) => (await openProjectData(b, 'releve.voltaplan', session(), { background: false })).project;
    const p = existingProject();
    const prot = createNode('protection', { circuitName: 'P' }, { survey: true });
    const cable = createNode('cable', {}, { survey: true });
    const sock = createNode('socket', {}, { survey: true });
    cable.children.push(sock);
    prot.children.push(cable);
    boardOf(p).children.push(prot);
    const back = await readArchive(await buildArchive(p));
    const q = (id: string) => findNode(back.roots, id)!;
    for (const k of SURVEY_UNSET.protection!) expect(q(prot.id).props[k], k).toBeUndefined();
    for (const k of SURVEY_UNSET.cable!) expect(q(cable.id).props[k], k).toBeUndefined();
    for (const k of SURVEY_UNSET.socket!) expect(q(sock.id).props[k], k).toBeUndefined();
  });
});
