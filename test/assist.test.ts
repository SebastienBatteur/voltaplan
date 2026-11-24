/**
 * Assistant (A1 à A6) : dossier de preuves conservé, aucune valeur inventée, structure tracée, validation groupée
 * limitée aux propositions sûres et non critiques, fidélité d'une installation non conforme, relevé figé.
 */
import type { PhotoReadingT } from '../src/ai/boardPhoto';
import { answer, answerUsage, bulkAcceptable, decide, needsReview, noteManualEdit, snapshotSurvey, surveyFrozen, unconfirmed } from '../src/assist/apply';
import { bindBoard, boardDraft } from '../src/assist/boardDraft';
import { emptyEvidence, purgeEvidence, type Evidence } from '../src/assist/evidence';
import { interpretLabel } from '../src/assist/labels';
import { mainBoardId, newExistingProject } from '../src/assist/project';
import { pruneReferences } from '../src/model/integrity';
import { parseProjectText } from '../src/model/migrate';
import { findNode, walk } from '../src/model/tree';
import type { Project } from '../src/model/types';
import { checkProject } from '../src/rules';
import { paramsText } from '../src/ui/CheckPanel';
import { translate } from '../src/i18n';

const dev = (o: Partial<PhotoReadingT['rows'][number]['devices'][number]>) => ({
  startModule: 0,
  widthModules: 1,
  kind: 'mcb' as const,
  brand: null,
  model: null,
  poles: null,
  ratedCurrentA: null,
  curve: null,
  residualCurrentmA: null,
  rcdType: null,
  label: null,
  circuitRef: null,
  confidence: 'high' as const,
  ...o,
});

/** Tableau type : différentiel 300 mA « A-C », trois disjoncteurs dont un illisible, un cache, un différentiel sans étiquette à droite. */
const reading: PhotoReadingT = {
  rows: [
    {
      row: 0,
      devices: [
        dev({ startModule: 0, widthModules: 2, kind: 'rcd', residualCurrentmA: 300, rcdType: 'A', ratedCurrentA: 40, label: 'A-C' }),
        dev({ startModule: 2, ratedCurrentA: 16, curve: 'C', label: 'PRISES CUISINE', circuitRef: 'A' }),
        dev({ startModule: 3, ratedCurrentA: 10, curve: 'B', label: 'Eclairage living', circuitRef: 'B' }),
        dev({ startModule: 4, label: 'XYZ', circuitRef: 'C', confidence: 'low' }),
        dev({ startModule: 5, kind: 'blank' }),
      ],
    },
    {
      row: 1,
      devices: [
        dev({ startModule: 0, widthModules: 2, kind: 'rcd', residualCurrentmA: 30, rcdType: 'A', ratedCurrentA: 40, label: null }),
        dev({ startModule: 2, ratedCurrentA: 20, curve: 'C', label: 'LL', circuitRef: 'D' }),
      ],
    },
  ],
  notes: null,
};

function draftProject() {
  const p = newExistingProject('Essai');
  const board = mainBoardId(p)!;
  const d = bindBoard(boardDraft({ reading, boardId: board, sourceId: 'src_1', now: '2026-11-24T10:00:00Z' }), board);
  const ev: Evidence = { ...emptyEvidence(), observations: d.observations, proposals: d.proposals, questions: d.questions };
  return { p: { ...p, evidence: ev } as Project, d, board };
}
const nodesOf = (p: Project, kind: string) => [...walk(p.roots)].filter((x) => x.node.kind === kind).map((x) => x.node);

describe('projet existant et dossier de preuves', () => {
  it('squelette sans protection générale inventée', () => {
    const p = newExistingProject('X');
    expect(nodesOf(p, 'protection')).toHaveLength(0);
    expect(p.meta.installationKind).toBe('existing');
  });

  it('le dossier de preuves survit à la lecture et à l’enregistrement (A1)', () => {
    const { p } = draftProject();
    const back = parseProjectText(JSON.stringify(p)).project;
    expect(back.evidence?.proposals.length).toBe(p.evidence!.proposals.length);
    expect(back.evidence?.questions.length).toBe(p.evidence!.questions.length);
  });

  it('dossier illisible : gardé tel quel (evidenceRaw), le projet s’ouvre', () => {
    const { p } = draftProject();
    const r = parseProjectText(JSON.stringify({ ...p, evidence: { version: 99, n: 'importé' } }));
    expect(r.project.evidence).toBeUndefined();
    expect((r.project as unknown as { evidenceRaw: unknown }).evidenceRaw).toEqual({ version: 99, n: 'importé' });
    expect(r.warnings.some((w) => w.key === 'file.evidenceUnreadable')).toBe(true);
    // Réenregistré : rien n'est perdu
    expect(JSON.parse(JSON.stringify(r.project)).evidenceRaw).toBeDefined();
  });
});

describe('brouillon depuis une photo de tableau', () => {
  it('aucune valeur par défaut : seules les valeurs lues sont proposées (A2)', () => {
    const { d } = draftProject();
    const unreadable = d.proposals.find((x) => x.change.op === 'createNode' && x.change.kind === 'protection' && x.change.props.fixedLetter === 'C')!;
    expect(unreadable.change.op === 'createNode' && unreadable.change.props).toEqual({ device: 'mcb', modules: 1, circuitName: 'XYZ', fixedLetter: 'C' });
    const cables = d.proposals.filter((x) => x.change.op === 'createNode' && x.change.kind === 'cable');
    expect(cables.every((x) => x.change.op === 'createNode' && Object.keys(x.change.props).length === 0)).toBe(true);
    expect(d.questions.some((q) => q.about.prop === 'ratedCurrent' && q.priority === 'high')).toBe(true);
    expect(d.questions.filter((q) => q.about.prop === 'section')).toHaveLength(4);
  });

  it('structure : étiquette « A-C » sûre ; position seule = critique + question', () => {
    const { d } = draftProject();
    const crit = d.proposals.filter((x) => x.change.op === 'createNode' && x.change.kind === 'protection' && x.critical);
    // 2 différentiels (toujours critiques), D rattaché par position, C illisible (confiance basse)
    expect(crit).toHaveLength(4);
    expect(d.questions.some((q) => q.text.key === 'assist.q.parentByPosition')).toBe(true);
  });

  it('usage d’après l’étiquette ; étiquette inconnue : question, aucun point inventé', () => {
    const { d } = draftProject();
    const usages = d.proposals.filter((x) => x.change.op === 'createNode' && x.change.tempKey.startsWith('u_'));
    expect(usages.map((x) => x.change.op === 'createNode' && [x.change.kind, x.change.location ?? '', x.change.props.applianceType ?? ''])).toEqual([
      ['socket', 'Cuisine', ''],
      ['light', 'Salon', ''],
      ['appliance', '', 'washingMachine'],
    ]);
    expect(d.summary.unknownUsage).toBe(1);
    expect(d.proposals.every((x) => x.purpose === 'reconstruction' && x.basis !== 'confirmed')).toBe(true);
  });

  it('validation groupée : d’abord les différentiels (critiques) un par un, puis le reste en bloc', () => {
    const { p } = draftProject();
    // Tout dépend des différentiels, toujours à voir individuellement : rien en bloc tant qu'ils ne sont pas vus
    expect(bulkAcceptable(p.evidence)).toHaveLength(0);
    const rcds = needsReview(p.evidence).filter((x) => x.change.op === 'createNode' && x.change.props.device === 'rcd');
    expect(rcds).toHaveLength(2);
    const q = decide(p, { accept: rcds.map((x) => x.id), confirm: rcds.map((x) => x.id) });
    const bulk = bulkAcceptable(q.evidence);
    expect(bulk.length).toBeGreaterThan(5);
    expect(bulk.every((x) => !x.critical && x.confidence >= 0.8)).toBe(true);
  });

  it('ordre : les dépendances d’une proposition à vérifier attendent, puis suivent (rien d’abandonné)', () => {
    const { p } = draftProject();
    // 1. Accepter seulement les sûres : le câble du circuit D (sous un disjoncteur critique) reste en attente
    let q = decide(p, { accept: bulkAcceptable(p.evidence).map((x) => x.id) });
    expect(q.evidence!.proposals.some((x) => x.status === 'superseded')).toBe(false);
    const rest = needsReview(q.evidence);
    expect(rest.length).toBeGreaterThan(0);
    expect(rest.every((x) => x.critical || x.confidence < 0.8)).toBe(true);
    // 2. Accepter les propositions à vérifier une par une, puis de nouveau les sûres : tout est appliqué
    q = decide(q, { accept: rest.map((x) => x.id), confirm: rest.map((x) => x.id) });
    q = decide(q, { accept: bulkAcceptable(q.evidence).map((x) => x.id) });
    q = decide(q, { accept: q.evidence!.proposals.filter((x) => x.status === 'pending').map((x) => x.id) });
    expect(q.evidence!.proposals.filter((x) => x.status === 'pending' || x.status === 'superseded')).toHaveLength(0);
    expect(nodesOf(q, 'cable')).toHaveLength(4);
  });

  it('refus d’un différentiel : ses circuits dépendants sont abandonnés, pas rattachés ailleurs', () => {
    const { p } = draftProject();
    const rcd = p.evidence!.proposals.find((x) => x.change.op === 'createNode' && x.change.props.residualCurrent === 300)!;
    const q = decide(p, { reject: [rcd.id], accept: p.evidence!.proposals.filter((x) => x.id !== rcd.id).map((x) => x.id) });
    expect(nodesOf(q, 'protection').some((n) => n.props.residualCurrent === 300)).toBe(false);
    expect(q.evidence!.proposals.filter((x) => x.status === 'superseded').length).toBeGreaterThan(0);
  });

  it('tout accepter : arbre construit, rien de « confirmé », valeurs signalées au contrôle (A3, A6)', () => {
    const { p, board } = draftProject();
    const all = p.evidence!.proposals.map((x) => x.id);
    const q = decide(p, { accept: all }, '2026-11-24T10:05:00Z');
    expect(nodesOf(q, 'protection')).toHaveLength(6);
    expect(Object.keys(q.boards![board].slots)).toHaveLength(6);
    expect(q.evidence!.provenance.some((x) => x.basis === 'confirmed')).toBe(false);
    expect(unconfirmed(q).length).toBeGreaterThan(0);
    const findings = checkProject(q);
    expect(findings.some((f) => f.ruleId === 'R-UNCONFIRMED')).toBe(true);
    // Disjoncteur sans calibre lisible : information manquante, pas de valeur inventée
    expect(findings.some((f) => f.ruleId === 'R-PROT-RATING-MISSING')).toBe(true);
  });

  it('fidélité : un circuit sans différentiel sur la photo reste sans différentiel (non-conformité conservée)', () => {
    const p = newExistingProject('Sans différentiel');
    const board = mainBoardId(p)!;
    const r: PhotoReadingT = { rows: [{ row: 0, devices: [dev({ ratedCurrentA: 16, curve: 'C', label: 'Prises salon', circuitRef: 'A' })] }], notes: null };
    const d = bindBoard(boardDraft({ reading: r, boardId: board, sourceId: 's', now: '2026-11-24T10:00:00Z' }), board);
    const q0 = { ...p, evidence: { ...emptyEvidence(), proposals: d.proposals, questions: d.questions, observations: d.observations } };
    const q = decide(q0, { accept: d.proposals.map((x) => x.id) });
    const mcb = nodesOf(q, 'protection')[0];
    expect(findNode(q.roots, board)!.children.map((c) => c.id)).toContain(mcb.id); // directement sous le tableau
    expect(d.proposals.some((x) => x.purpose !== 'reconstruction')).toBe(false); // aucune « correction » glissée
    expect(d.questions.some((x) => x.text.key === 'assist.q.parentUnknown')).toBe(true);
  });

  it('proposition critique modifiée par l’utilisateur : valeur corrigée et confirmée', () => {
    const { p } = draftProject();
    const rcd = p.evidence!.proposals.find((x) => x.change.op === 'createNode' && x.change.props.residualCurrent === 300)!;
    const setRating = { ...rcd };
    const q = decide(p, { accept: [setRating.id], confirm: [setRating.id] });
    const node = nodesOf(q, 'protection')[0];
    expect(q.evidence!.provenance.find((x) => x.nodeId === node.id && x.prop === 'residualCurrent')!.basis).toBe('confirmed');
  });
});

describe('acceptation en un seul lot', () => {
  it('parent accepté mais en attente (son différentiel n’est pas décidé) : ses enfants attendent aussi, rien n’est abandonné', () => {
    const { p } = draftProject();
    // Tout sauf les différentiels : disjoncteurs, câbles, usages et places attendent leur différentiel
    const notRcd = p.evidence!.proposals.filter((x) => !(x.change.op === 'createNode' && x.change.props.device === 'rcd')).map((x) => x.id);
    const q = decide(p, { accept: notRcd });
    expect(q.evidence!.proposals.filter((x) => x.status === 'superseded')).toHaveLength(0);
    // Une fois les différentiels acceptés, tout le reste s'applique
    const r = decide(q, { accept: q.evidence!.proposals.filter((x) => x.status === 'pending').map((x) => x.id) });
    expect(r.evidence!.proposals.filter((x) => x.status === 'superseded' || x.status === 'pending')).toHaveLength(0);
    expect(nodesOf(r, 'cable')).toHaveLength(4);
  });
});

describe('questions, relevé, corrections tracées', () => {
  it('réponse : valeur écrite et confirmée ; « je ne sais pas » : rien d’écrit', () => {
    const { p } = draftProject();
    let q = decide(p, { accept: p.evidence!.proposals.map((x) => x.id) });
    const rating = q.evidence!.questions.find((x) => x.about.prop === 'ratedCurrent')!;
    q = answer(q, rating.id, 16);
    const node = findNode(q.roots, rating.about.nodeId!)!;
    expect(node.props.ratedCurrent).toBe(16);
    expect(q.evidence!.provenance.find((x) => x.nodeId === node.id && x.prop === 'ratedCurrent')!.basis).toBe('confirmed');
    const curve = q.evidence!.questions.find((x) => x.about.prop === 'curve' && x.status === 'open')!;
    q = answer(q, curve.id, null);
    expect(findNode(q.roots, curve.about.nodeId!)!.props.curve).toBeUndefined();
    expect(q.evidence!.questions.find((x) => x.id === curve.id)!.status).toBe('dismissed');
  });

  it('structure confirmée : aucune propriété « @parent » écrite dans l’arbre', () => {
    const { p } = draftProject();
    let q = decide(p, { accept: p.evidence!.proposals.map((x) => x.id) });
    const par = q.evidence!.questions.find((x) => x.about.prop === '@parent')!;
    q = answer(q, par.id, true);
    const n = findNode(q.roots, par.about.nodeId!)!;
    expect('@parent' in n.props).toBe(false);
    expect(q.evidence!.provenance.find((x) => x.nodeId === n.id && x.prop === '@parent')!.basis).toBe('confirmed');
  });

  it('usage répondu : câble et point créés, confirmés', () => {
    const { p } = draftProject();
    let q = decide(p, { accept: p.evidence!.proposals.map((x) => x.id) });
    const u = q.evidence!.questions.find((x) => x.about.prop === '@usage')!;
    const before = nodesOf(q, 'light').length;
    q = answerUsage(q, u.id, { kind: 'light', room: 'Cave' });
    expect(nodesOf(q, 'light').length).toBe(before + 1);
  });

  it('relevé figé puis correction tracée (A4)', () => {
    const { p } = draftProject();
    let q = decide(p, { accept: p.evidence!.proposals.map((x) => x.id) });
    q = snapshotSurvey(q, 'Relevé du 24/11/2026 (installation existante, tel que relevé)', '2026-11-24T11:00:00Z');
    expect(surveyFrozen(q)).toBe(true);
    expect(q.meta.revisions!.at(-1)!.description).toContain('Relevé');
    const prot = nodesOf(q, 'protection').find((n) => n.props.ratedCurrent === 16)!;
    q = noteManualEdit(q, prot.id, { ratedCurrent: 20 }, prot.props);
    const h = q.evidence!.history.at(-1)!;
    expect([h.action, h.before, h.after]).toEqual(['edit', 16, 20]);
    expect(q.evidence!.provenance.find((x) => x.nodeId === prot.id && x.prop === 'ratedCurrent')!.basis).toBe('manual');
  });

  it('suppression d’un nœud : propositions remplacées, questions closes, historique gardé', () => {
    const { p } = draftProject();
    let q = decide(p, { accept: p.evidence!.proposals.filter((x) => x.change.op === 'createNode' && x.change.kind === 'protection').map((x) => x.id) });
    const prot = nodesOf(q, 'protection')[1];
    const removed: Project = { ...q, roots: q.roots.map((r) => ({ ...r })) };
    const parent = [...walk(removed.roots)].find((x) => x.node.children.some((c) => c.id === prot.id))!.node;
    parent.children = parent.children.filter((c) => c.id !== prot.id);
    const histLen = q.evidence!.history.length;
    q = pruneReferences(removed);
    expect(q.evidence!.provenance.some((x) => x.nodeId === prot.id)).toBe(false);
    expect(q.evidence!.history.length).toBe(histLen);
  });

  it('purge : jamais les propositions acceptées ni les observations citées (A5)', () => {
    const { p } = draftProject();
    const q = decide(p, { accept: [p.evidence!.proposals[0].id], reject: p.evidence!.proposals.slice(1).map((x) => x.id) });
    const e = purgeEvidence(q.evidence!, 0, 1);
    expect(e.proposals.some((x) => x.status === 'accepted')).toBe(true);
    expect(e.proposals.every((x) => x.status !== 'pending')).toBe(true);
    const cited = new Set(e.proposals.flatMap((x) => x.observations));
    for (const id of cited) expect(e.observations.some((o) => o.id === id)).toBe(true);
    expect(e.history.at(-1)!.action).toBe('purge');
  });
});

describe('affichage des valeurs non confirmées', () => {
  it('noms de propriétés traduits (contrôle et dossier)', () => {
    const t = (k: string) => translate('fr', k);
    const txt = paramsText({ ruleId: 'R-UNCONFIRMED', severity: 'info', params: { props: '@parent, ratedCurrent' } }, t);
    expect(txt.props).toBe('raccordement (différentiel amont), Calibre');
  });
});

describe('étiquettes', () => {
  it.each([
    ['PRISES CUISINE', 'socket', 'Cuisine'],
    ['Eclairage living', 'light', 'Salon'],
    ['Stopcontacten keuken', 'socket', 'Cuisine'],
    ['Verlichting slaapkamer 2', 'light', 'Chambre 2'],
    ['LL', 'appliance', undefined],
    ['Taque induction', 'appliance', undefined],
    ['Borne de recharge', 'appliance', undefined],
    ['XYZ', undefined, undefined],
    ['', undefined, undefined],
  ])('« %s »', (label, kind, room) => {
    const r = interpretLabel(label);
    expect(r.usage?.kind).toBe(kind);
    expect(r.room).toBe(room);
  });
});
