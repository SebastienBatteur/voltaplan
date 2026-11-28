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
import { checkProject, isSurveyPart, needsVerification } from '../src/rules';
import { markHistoric } from '../src/assist/historic';
import { emptyEvidence, isConfirmed, originOf } from '../src/assist/evidence';
import { confirmHistoric, historicProps, unconfirmed } from '../src/assist/apply';
import { parseProjectText } from '../src/model/migrate';

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

// ---------------------------------------------------------------------------
// Étape 4 : origine et confirmation, provenance historique, duplication (ADR-0010, décisions 1 et 2)
// ---------------------------------------------------------------------------

/** Projet d'avant le suivi de la provenance : relevé avec un circuit de prises (valeurs égales aux défauts). */
const oldSurvey = () => {
  const p = existingProject();
  delete p.meta.provenanceSince;
  p.meta.installer = { name: 'Installateur Test', address: {} };
  const prot = createNode('protection', { device: 'mcb', ratedCurrent: 16, curve: 'C', poles: '1P+N', circuitName: 'P' });
  const cable = createNode('cable', { cableType: 'XVB', section: 2.5, conductors: 3 });
  const sock = createNode('socket', { earth: true, childSafety: true });
  cable.children.push(sock);
  prot.children.push(cable);
  boardOf(p).children.push(prot);
  return { p, prot, cable, sock };
};
const entries = (p: Project, nodeId: string) => (p.evidence?.provenance ?? []).filter((e) => e.nodeId === nodeId);
const hist = (p: Project, nodeId: string) => historicProps(p, nodeId);

describe('Provenance historique inconnue (anciens projets)', () => {
  it('un nouveau projet porte le marqueur de suivi : rien n’est historique', () => {
    expect(emptyProject().meta.provenanceSince).toBeTruthy();
    const { project, marked } = markHistoric(existingProject(), () => true);
    expect(marked).toBe(0);
    expect(project.evidence).toBeUndefined();
  });

  it('ancien relevé : chaque valeur utile au contrôle devient « historique », égale ou non au défaut, sans être modifiée', () => {
    const { p, prot, sock } = oldSurvey();
    const before = JSON.stringify(p.roots);
    const { project, marked } = markHistoric(p, (chain) => isSurveyPart(p, chain), '2026-11-28T00:00:00.000Z');
    expect(marked).toBeGreaterThan(0);
    expect(JSON.stringify(project.roots)).toBe(before);
    expect(project.meta.provenanceSince).toBe('2026-11-28T00:00:00.000Z');
    // Y compris les valeurs que l'ancien modèle avait mises d'office (pouvoir de coupure…)
    expect(hist(project, prot.id)).toEqual(expect.arrayContaining(['breakingCapacity', 'curve', 'device', 'poles', 'ratedCurrent']));
    expect(hist(project, sock.id)).toEqual(expect.arrayContaining(['childSafety', 'earth']));
    // Seulement les valeurs présentes
    for (const e of project.evidence!.historic!) expect(findNode(project.roots, e.nodeId)!.props[e.prop], e.prop).toBeDefined();
    // Rangées à part de la provenance (que les versions précédentes lisent) ; jamais « confirmées », jamais promues
    expect(project.evidence!.provenance).toEqual([]);
  });

  it('ancien projet en conception : rien n’est marqué (une valeur par défaut y est un choix)', () => {
    const { p } = oldSurvey();
    p.meta.installationKind = 'new';
    delete p.meta.installationDate;
    const { project, marked } = markHistoric(p, (chain) => isSurveyPart(p, chain));
    expect(marked).toBe(0);
    expect(project.evidence).toBeUndefined();
    expect(project.meta.provenanceSince).toBeTruthy();
  });

  it('une provenance existante (photo lue par l’assistant) n’est pas remplacée ; deuxième ouverture : rien de plus', () => {
    const { p, prot } = oldSurvey();
    p.evidence = { ...emptyEvidence(), provenance: [{ nodeId: prot.id, prop: 'ratedCurrent', basis: 'aiInferred', observations: [], confidence: 0.8, at: 'x' }] };
    const once = markHistoric(p, (chain) => isSurveyPart(p, chain)).project;
    expect(entries(once, prot.id).find((e) => e.prop === 'ratedCurrent')?.basis).toBe('aiInferred');
    expect(hist(once, prot.id)).not.toContain('ratedCurrent');
    expect(hist(once, prot.id)).toContain('curve');
    const twice = markHistoric(once, () => true);
    expect(twice.marked).toBe(0);
    expect(twice.project).toBe(once);
  });

  it('ouverture d’un fichier ancien : migration avec avertissement, valeurs intactes', () => {
    const { p, sock } = oldSurvey();
    const { project, warnings } = parseProjectText(JSON.stringify(p));
    expect(warnings.map((w) => w.key)).toContain('file.historicValues');
    expect(findNode(project.roots, sock.id)!.props).toEqual(sock.props);
    expect(hist(project, sock.id)).toEqual(expect.arrayContaining(['earth', 'childSafety']));
  });

  it('contrôle : « à confirmer » (non bloquant, projet « vérifications à faire »), jamais « conforme » en silence', () => {
    const { p } = oldSurvey();
    const project = parseProjectText(JSON.stringify(p)).project;
    const f = checkProject(project).find((x) => x.ruleId === 'R-HISTORIC');
    expect(f).toMatchObject({ status: 'manualCheck', blocking: false, knowledge: 'unknown' });
    expect(Number(f!.params!.count)).toBeGreaterThan(0);
    expect(needsVerification(f!)).toBe(true);
    // Le même ancien projet sans marquage (comportement précédent) ne demandait rien
    const plain = { ...p, meta: { ...p.meta, provenanceSince: 'x' } };
    expect(checkProject(plain).some((x) => x.ruleId === 'R-HISTORIC')).toBe(false);
  });

  it('une non-conformité établie sur une valeur historique reste une non-conformité bloquante (pas reclassée)', () => {
    const { p, sock } = oldSurvey();
    sock.props.earth = false;
    const project = parseProjectText(JSON.stringify(p)).project;
    const f = checkProject(project).find((x) => x.ruleId === 'R-SOCKET-EARTH' && x.nodeId === sock.id);
    expect(f).toMatchObject({ status: 'nonCompliant', blocking: true });
    expect(f!.knowledge).not.toBe('deduced');
  });

  it('projet repassé en conception : plus de « à confirmer » (seules les parties existantes sont concernées)', () => {
    const { p } = oldSurvey();
    const project = parseProjectText(JSON.stringify(p)).project;
    const design = { ...project, meta: { ...project.meta, installationKind: 'new' as const, installationDate: undefined } };
    expect(checkProject(design).some((x) => x.ruleId === 'R-HISTORIC')).toBe(false);
  });

  it('confirmation par l’utilisateur : origine gardée à côté, auteur et date ; le signalement disparaît pour cet élément', () => {
    const { p, prot, sock } = oldSurvey();
    let project = parseProjectText(JSON.stringify(p)).project;
    const count = () => Number(checkProject(project).find((x) => x.ruleId === 'R-HISTORIC')?.params?.count ?? 0);
    const n0 = count();
    const nSock = historicProps(project, sock.id).length;
    project = confirmHistoric(project, sock.id, '2026-11-28T10:00:00.000Z');
    expect(entries(project, sock.id)).toHaveLength(nSock);
    for (const e of entries(project, sock.id)) {
      expect(e).toMatchObject({ basis: 'confirmed', origin: 'historicUnknown', by: 'Installateur Test', at: '2026-11-28T10:00:00.000Z' });
      expect(originOf(e)).toBe('historicUnknown');
      expect(isConfirmed(e)).toBe(true);
    }
    expect(historicProps(project, sock.id)).toEqual([]);
    expect(historicProps(project, prot.id).length).toBeGreaterThan(0);
    expect(count()).toBe(n0 - 1);
    expect(project.evidence!.history.filter((h) => h.refs.nodeId === sock.id && h.note === 'confirmé')).toHaveLength(nSock);
  });

  it('valeur historique ou lue par l’assistant : exclue ou non des valeurs « non confirmées » de l’assistant', () => {
    const { p, prot } = oldSurvey();
    const project = parseProjectText(JSON.stringify(p)).project;
    expect(unconfirmed(project)).toEqual([]);
    const withImport = { ...project, evidence: { ...project.evidence!, provenance: [...project.evidence!.provenance, { nodeId: prot.id, prop: 'section', basis: 'imported' as const, observations: [], confidence: 1, at: 'x' }] } };
    expect(unconfirmed(withImport).map((e) => e.basis)).toEqual(['imported']);
  });
});

describe('Store : correction à la main et duplication gardent une provenance juste', () => {
  it('valeur historique corrigée à la main : « manuelle » ; les autres restent à confirmer', async () => {
    const { useStore } = await import('../src/store');
    const { p, prot } = oldSurvey();
    useStore.getState().loadProject(parseProjectText(JSON.stringify(p)).project, 'ancien.voltaplan');
    useStore.getState().setProps(prot.id, { ratedCurrent: 20 });
    const project = useStore.getState().project;
    expect(hist(project, prot.id)).not.toContain('ratedCurrent');
    expect(hist(project, prot.id)).toContain('curve');
    expect(project.evidence!.history.some((h) => h.refs.nodeId === prot.id && h.before === 16 && h.after === 20)).toBe(true);
  });

  it('même valeur réécrite : rien ne change (pas de confirmation implicite)', async () => {
    const { useStore } = await import('../src/store');
    const { p, prot } = oldSurvey();
    useStore.getState().loadProject(parseProjectText(JSON.stringify(p)).project, 'ancien.voltaplan');
    useStore.getState().setProps(prot.id, { ratedCurrent: 16 });
    expect(hist(useStore.getState().project, prot.id)).toContain('ratedCurrent');
  });

  it('duplication : la copie garde l’origine des valeurs copiées (une valeur non confirmée le reste)', async () => {
    const { useStore } = await import('../src/store');
    const { p, prot, sock } = oldSurvey();
    useStore.getState().loadProject(parseProjectText(JSON.stringify(p)).project, 'ancien.voltaplan');
    useStore.getState().duplicate(prot.id);
    const project = useStore.getState().project;
    const copyId = useStore.getState().selectedId!;
    expect(copyId).not.toBe(prot.id);
    const copy = findNode(project.roots, copyId)!;
    const copySock = [...walk([copy])].find((x) => x.node.kind === 'socket')!.node;
    expect(hist(project, copyId).sort()).toEqual(hist(project, prot.id).sort());
    expect(hist(project, copySock.id).sort()).toEqual(hist(project, sock.id).sort());
    // L'original n'est pas touché, et confirmer la copie ne confirme pas l'original
    const confirmedCopy = confirmHistoric(project, copySock.id);
    expect(historicProps(confirmedCopy, copySock.id)).toEqual([]);
    expect(historicProps(confirmedCopy, sock.id)).toEqual(historicProps(project, sock.id));
  });
});

describe('Aller-retour .voltaplan : provenance historique et marqueur conservés', () => {
  it('ancien projet ouvert, enregistré, rouvert : mêmes entrées, pas de nouveau marquage', async () => {
    const { AssetStore, MemoryAssetBackend } = await import('../src/format/assets');
    const { AssetSession } = await import('../src/format/session');
    const { openProjectData, serializeProject } = await import('../src/io/projectData');
    const session = () => new AssetSession(() => new AssetStore(new MemoryAssetBackend()));
    const { p } = oldSurvey();
    const opened = parseProjectText(JSON.stringify(p)).project;
    const blob = (await serializeProject(opened, undefined, session()))!;
    const back = await openProjectData(blob, 'ancien.voltaplan', session(), { background: false });
    expect(back.project.meta.provenanceSince).toBe(opened.meta.provenanceSince);
    const key = (e: { nodeId: string; prop: string }) => `${e.nodeId}|${e.prop}`;
    expect(back.project.evidence!.historic!.map(key).sort()).toEqual(opened.evidence!.historic!.map(key).sort());
    expect(back.warnings.map((w) => (typeof w === 'string' ? w : w.key))).not.toContain('file.historicValues');
  });
});
