/**
 * Assistant, suite : plusieurs photos d'un même tableau (fusion, contradictions, doublons, cache), plusieurs tableaux
 * (sous-tableau rattaché à son alimentation), questions groupées et non redondantes, correction avant acceptation.
 * Toutes les lectures sont SIMULÉES (inventées pour les tests) : elles ne disent rien de la qualité réelle de l'IA.
 */
import type { PhotoDeviceT, PhotoReadingT } from '../src/ai/boardPhoto';
import { answer, answerGroup, decide, deferQuestions, needsReview, questionReady, splitGroup } from '../src/assist/apply';
import { draftFromObservations, fuseObservations, observeReading } from '../src/assist/boardDraft';
import { addBoard, sameBoardName, subBoardLinks } from '../src/assist/boards';
import type { Proposal, Question } from '../src/assist/evidence';
import { mainBoardId, newExistingProject } from '../src/assist/project';
import { addBoardReading } from '../src/assist/survey';
import { enclosures } from '../src/board/model';
import { findNode, findParent, walk } from '../src/model/tree';
import type { Project } from '../src/model/types';

const dev = (o: Partial<PhotoDeviceT>): PhotoDeviceT => ({
  startModule: 0,
  widthModules: 1,
  kind: 'mcb',
  brand: null,
  model: null,
  poles: null,
  ratedCurrentA: null,
  curve: null,
  residualCurrentmA: null,
  rcdType: null,
  label: null,
  circuitRef: null,
  confidence: 'high',
  ...o,
});
const reading = (...rows: PhotoDeviceT[][]): PhotoReadingT => ({ rows: rows.map((devices, row) => ({ row, devices })), notes: null });
const T = (m: number) => `2026-11-24T10:${String(m).padStart(2, '0')}:00Z`;
const nodesOf = (p: Project, kind: string) => [...walk(p.roots)].filter((x) => x.node.kind === kind).map((x) => x.node);
const open = (p: Project) => p.evidence!.questions.filter((q) => q.status === 'open');
const pending = (p: Project) => p.evidence!.proposals.filter((x) => x.status === 'pending');
const creates = (p: Project, kind: string) => pending(p).filter((x) => x.change.op === 'createNode' && x.change.kind === kind);
const acceptAll = (p: Project, now = T(30), except: string[] = []) => {
  let q = p;
  for (let i = 0; i < 6; i++) q = decide(q, { accept: pending(q).filter((x) => !except.includes(x.id)).map((x) => x.id) }, now);
  return q;
};

/** Ajoute une photo (lecture simulée) au tableau principal. */
function photo(p: Project, sha: string, r: PhotoReadingT, m: number, extra: Partial<Parameters<typeof addBoardReading>[1]> = {}) {
  return addBoardReading(p, { boardId: mainBoardId(p)!, sha256: sha, label: 'Photo du tableau', reading: r, now: T(m), ...extra });
}

const row0 = [
  dev({ startModule: 0, widthModules: 2, kind: 'rcd', residualCurrentmA: 30, ratedCurrentA: 40, label: 'A-C' }),
  dev({ startModule: 2, ratedCurrentA: 16, curve: 'C', label: 'Prises cuisine', circuitRef: 'A' }),
  dev({ startModule: 3, ratedCurrentA: null, curve: 'B', label: 'Ecl. salon', circuitRef: 'B', confidence: 'medium' }),
];

describe('plusieurs photos d’un même tableau', () => {
  it('même appareil vu deux fois : fusionné, certitude accrue, valeur illisible complétée', () => {
    const a = observeReading({ reading: reading(row0), sourceId: 's1', now: T(1) });
    const b = observeReading({ reading: reading([row0[0], row0[1], { ...row0[2], ratedCurrentA: 10 }]), sourceId: 's2', now: T(2) });
    const f = fuseObservations([...a, ...b]);
    expect(f).toHaveLength(3);
    expect(f.every((d) => d.obs.length === 2)).toBe(true);
    expect(f[1].values.ratedCurrent.confidence).toBeGreaterThan(0.9); // 0,9 et 0,9 d'accord
    expect(f[1].values.ratedCurrent.confidence).toBeLessThanOrEqual(0.97); // jamais « certain » sans l'utilisateur
    expect(f[2].values.ratedCurrent.value).toBe(10); // illisible sur la 1re photo, lu sur la 2e
    expect(f[2].contradictions).toHaveLength(0);
  });

  it('désaccord : aucune valeur proposée, UNE question sourcée, aucune question « inconnue » en plus', () => {
    let p = newExistingProject('X');
    p = photo(p, 'h1', reading(row0), 1).project;
    p = photo(p, 'h2', reading([row0[0], { ...row0[1], ratedCurrentA: 20 }, row0[2]]), 2).project;
    const mcbA = creates(p, 'protection').find((x) => x.change.op === 'createNode' && x.change.props.fixedLetter === 'A')!;
    expect(mcbA.change.op === 'createNode' && mcbA.change.props.ratedCurrent).toBeUndefined();
    const about = (q: Question) => q.about.tempKey === (mcbA.change.op === 'createNode' && mcbA.change.tempKey) && q.about.prop === 'ratedCurrent';
    const qs = open(p).filter(about);
    expect(qs).toHaveLength(1);
    expect(qs[0].kind).toBe('contradiction');
    expect(qs[0].options!.map((o) => o.value)).toEqual([16, 20]);
    // Chaque option cite l'observation de sa photo
    const obs = p.evidence!.observations;
    const src = (id: string) => obs.find((o) => o.id === id)!.region.sourceId;
    const s1 = p.evidence!.sources[0].id;
    const s2 = p.evidence!.sources[1].id;
    expect(qs[0].options!.map((o) => o.observations.map(src))).toEqual([[s1], [s2]]);
    expect(obs.some((o) => o.kind === 'contradiction' && o.note === 'ratedCurrent')).toBe(true);
    // Troisième photo d'accord avec la 1re (cadrée sur les deux premiers appareils) : toujours une seule question
    // ouverte, options mises à jour
    p = photo(p, 'h3', reading([row0[0], row0[1]]), 3).project;
    const again = open(p).filter((q) => q.about.prop === 'ratedCurrent' && q.kind === 'contradiction');
    expect(again).toHaveLength(1);
    expect(again[0].options!.map((o) => [o.value, o.observations.length])).toEqual([
      [16, 2],
      [20, 1],
    ]);
    // Pas de proposition en double : un seul brouillon en attente
    expect(creates(p, 'protection')).toHaveLength(3);
    // Réponse : la valeur choisie est écrite, sa provenance cite la photo choisie
    p = acceptAll(p);
    const q = open(p).find((x) => x.kind === 'contradiction' && x.about.prop === 'ratedCurrent')!;
    p = answer(p, q.id, 20);
    expect(findNode(p.roots, q.about.nodeId!)!.props.ratedCurrent).toBe(20);
    const prov = p.evidence!.provenance.find((x) => x.nodeId === q.about.nodeId && x.prop === 'ratedCurrent')!;
    expect(prov.observations.map(src)).toEqual([s2]);
  });

  it('une photo par rangée : positions décalées, appareils des deux rangées', () => {
    let p = newExistingProject('X');
    p = photo(p, 'h1', reading(row0), 1).project;
    const r = photo(p, 'h2', reading([dev({ startModule: 0, ratedCurrentA: 20, curve: 'C', label: 'LL' })]), 2, { offset: { row: 1, module: 0 } });
    p = r.project;
    expect(r.summary!.sources).toBe(2);
    const places = pending(p).filter((x) => x.change.op === 'place').map((x) => x.change.op === 'place' && [x.change.row, x.change.col]);
    expect(places).toEqual([
      [0, 0],
      [0, 2],
      [0, 3],
      [1, 0],
    ]);
    expect(p.evidence!.sources[1].offset).toEqual({ row: 1, module: 0 });
  });

  it('photos qui se recouvrent : la partie commune est fusionnée, rien en double', () => {
    const left = reading([...row0, dev({ startModule: 4, ratedCurrentA: 20, label: 'LV' })]);
    // Deuxième prise décalée de 3 modules : voit B (3) et LV (4), puis un nouvel appareil en 6
    const right = reading([dev({ startModule: 0, ratedCurrentA: 10, curve: 'B', label: 'Ecl. salon', circuitRef: 'B' }), dev({ startModule: 1, ratedCurrentA: 20, label: 'LV' }), dev({ startModule: 3, ratedCurrentA: 16, label: 'Four' })]);
    let p = newExistingProject('X');
    p = photo(p, 'h1', left, 1).project;
    p = photo(p, 'h2', right, 2, { offset: { row: 0, module: 3 } }).project;
    const prot = creates(p, 'protection');
    expect(prot).toHaveLength(5); // rcd, A, B, LV, Four
    const b = prot.find((x) => x.change.op === 'createNode' && x.change.props.fixedLetter === 'B')!;
    expect(b.change.op === 'createNode' && b.change.props.ratedCurrent).toBe(10); // illisible à gauche, lu à droite
    expect(b.observations.length).toBeGreaterThanOrEqual(2);
  });

  it('positions en désaccord (un 2 modules contre deux 1 module) : à voir individuellement', () => {
    const a = observeReading({ reading: reading([dev({ startModule: 0, widthModules: 2, kind: 'rcd', residualCurrentmA: 30 })]), sourceId: 's1', now: T(1) });
    const b = observeReading({ reading: reading([dev({ startModule: 0, kind: 'mcb', ratedCurrentA: 16 }), dev({ startModule: 1, kind: 'mcb', ratedCurrentA: 16 })]), sourceId: 's2', now: T(2) });
    const d = draftFromObservations({ observations: [...a, ...b], boardId: 'B', now: T(3) });
    const prot = d.proposals.filter((x) => x.change.op === 'createNode' && x.change.kind === 'protection');
    expect(prot.every((x) => x.critical)).toBe(true);
    expect(d.questions.some((q) => q.kind === 'contradiction' && q.about.prop === 'device')).toBe(true);
  });

  it('même photo, même entrée de l’IA : lecture réutilisée (cache), rien ajouté', () => {
    let p = newExistingProject('X');
    const engine = { provider: 'anthropic', model: 'm', promptVersion: 'board-photo-1', inputHash: 'in1' };
    p = photo(p, 'h1', reading(row0), 1, { engine }).project;
    const nObs = p.evidence!.observations.length;
    const r = photo(p, 'h1', reading(row0), 2, { engine, reading: undefined });
    expect(r.cached).toBe(true);
    expect(r.project.evidence!.sources).toHaveLength(1);
    expect(r.project.evidence!.observations.filter((o) => o.kind === 'reading')).toHaveLength(p.evidence!.observations.filter((o) => o.kind === 'reading').length);
    expect(nObs).toBeGreaterThan(0);
    // Même photo relue (autre calage) : même source, seule la dernière lecture compte (pas d'auto-confirmation)
    const r2 = photo(p, 'h1', reading(row0), 3, { engine: { ...engine, inputHash: 'in2' } });
    expect(r2.project.evidence!.sources).toHaveLength(1);
    expect(r2.summary!.sources).toBe(1);
    expect(creates(r2.project, 'protection')).toHaveLength(3);
  });

  it('autre photo mais lecture identique (même calage) : doublon signalé, aucune observation ajoutée', () => {
    let p = newExistingProject('X');
    p = photo(p, 'h1', reading(row0), 1, { calibration: 'c1' }).project;
    const before = p.evidence!.observations.length;
    const r = photo(p, 'h2', reading(row0), 2, { calibration: 'c1' });
    expect(r.duplicateOf).toBe(p.evidence!.sources[0].id);
    expect(r.project.evidence!.observations.length).toBe(before);
    expect(r.project.evidence!.sources[1].duplicateOf).toBe(r.duplicateOf);
    // La certitude n'est pas gonflée par le doublon
    const r3 = photo(r.project, 'h3', reading([row0[0]]), 3, { calibration: 'c2' });
    expect(r3.summary!.sources).toBe(2);
  });

  it('nouvelle photo après acceptation : complète seulement ce qui manque, ne repose aucune question', () => {
    let p = newExistingProject('X');
    p = photo(p, 'h1', reading(row0), 1).project;
    p = acceptAll(p);
    const nProt = nodesOf(p, 'protection').length;
    const q = open(p).find((x) => x.about.prop === 'ratedCurrent')!; // calibre illisible de B
    p = answer(p, q.id, null); // « je ne sais pas »
    p = photo(p, 'h2', reading([row0[0], { ...row0[1], rcdType: null }, { ...row0[2], ratedCurrentA: 10 }]), 2).project;
    expect(creates(p, 'protection')).toHaveLength(0);
    const set = pending(p).filter((x) => x.change.op === 'setProp');
    expect(set.map((x) => x.change.op === 'setProp' && [x.change.prop, x.change.value])).toEqual([['ratedCurrent', 10]]);
    // Ni la section ni le calibre ne sont redemandés
    const keys = open(p).map((x) => `${x.about.nodeId ?? ''}|${x.about.prop}`);
    expect(new Set(keys).size).toBe(keys.length);
    p = acceptAll(p);
    expect(nodesOf(p, 'protection')).toHaveLength(nProt);
    expect(findNode(p.roots, q.about.nodeId!)!.props.ratedCurrent).toBe(10);
  });

  it('fidélité sur plusieurs photos : un circuit sans différentiel reste sans différentiel', () => {
    let p = newExistingProject('X');
    const r = reading([dev({ startModule: 0, ratedCurrentA: 32, curve: 'C', label: 'Prises salon', circuitRef: 'A' })]);
    p = photo(p, 'h1', r, 1).project;
    p = photo(p, 'h2', reading([dev({ startModule: 0, ratedCurrentA: 32, label: 'Prises salon', circuitRef: 'A' })]), 2).project;
    expect(p.evidence!.proposals.every((x) => x.purpose === 'reconstruction' && x.basis !== 'confirmed')).toBe(true);
    p = acceptAll(p);
    const mcb = nodesOf(p, 'protection')[0];
    expect(mcb.props.ratedCurrent).toBe(32); // 32 A sur des prises : non conforme, conservé tel quel
    expect(findParent(p.roots, mcb.id)!.id).toBe(mainBoardId(p));
    expect(nodesOf(p, 'protection').some((n) => n.props.device === 'rcd')).toBe(false);
  });
});

describe('plusieurs tableaux', () => {
  it('sous-tableau ajouté puis repéré sur l’étiquette d’un circuit : rattachement proposé (critique + question)', () => {
    let p = newExistingProject('X');
    p = photo(p, 'h1', reading([dev({ startModule: 0, ratedCurrentA: 25, curve: 'C', label: 'Sous-tableau garage', circuitRef: 'A' })]), 1).project;
    const board = creates(p, 'board');
    expect(board).toHaveLength(1);
    expect(board[0].critical).toBe(true);
    const added = addBoard(p, 'Garage');
    p = added.project;
    // Le point « tableau » déduit est remplacé par le rattachement du vrai sous-tableau
    expect(creates(p, 'board')).toHaveLength(0);
    const move = pending(p).find((x) => x.change.op === 'move')!;
    expect(move.critical).toBe(true);
    expect(open(p).some((q) => q.about.proposalId === move.id && q.about.nodeId === added.boardId)).toBe(true);
    // Accepter le reste, puis le rattachement vu une par une : la question liée est close d'office
    p = acceptAll(p, T(30), [move.id]);
    expect(needsReview(p.evidence).map((x) => x.id)).toEqual([move.id]);
    p = decide(p, { accept: [move.id], confirm: [move.id] });
    expect(findParent(p.roots, added.boardId)!.kind).toBe('cable');
    expect(open(p).some((q) => q.about.proposalId === move.id)).toBe(false);
    expect(enclosures(p.roots).map((e) => e.board.id)).toContain(added.boardId);
  });

  it('un brouillon par tableau : lire le sous-tableau ne remplace pas le brouillon du principal', () => {
    let p = newExistingProject('X');
    p = photo(p, 'h1', reading(row0), 1).project;
    const sub = addBoard(p, 'Cave');
    p = sub.project;
    p = addBoardReading(p, { boardId: sub.boardId, sha256: 'h9', label: 'Photo', reading: reading([dev({ startModule: 0, ratedCurrentA: 16, label: 'Prises cave' })]), now: T(5) }).project;
    expect(pending(p).filter((x) => x.batch.startsWith(`photo:${mainBoardId(p)}:`)).length).toBeGreaterThan(0);
    expect(pending(p).filter((x) => x.batch.startsWith(`photo:${sub.boardId}:`)).length).toBeGreaterThan(0);
  });

  it('nom concordant, jamais deux rattachements, jamais de cycle', () => {
    expect(sameBoardName('Garage', 'SOUS-TABLEAU GARAGE')).toBe(true);
    expect(sameBoardName('Tuinhuis', 'Onderverdeling tuinhuis')).toBe(true);
    expect(sameBoardName('Cave', 'Sous-tableau garage')).toBe(false);
    let p = newExistingProject('X');
    p = photo(p, 'h1', reading([dev({ startModule: 0, ratedCurrentA: 25, label: 'Sous-tableau garage' })]), 1).project;
    p = addBoard(p, 'Garage').project;
    expect(subBoardLinks(p).proposals).toHaveLength(0); // déjà proposé
    // Un sous-tableau sous lui-même : refusé (remplacé), l'arbre ne change pas
    const b = mainBoardId(p)!;
    const loop: Proposal = { ...pending(p)[0], id: 'prp_loop', change: { op: 'move', target: { nodeId: findParent(p.roots, b)!.id }, newParent: { nodeId: b } } };
    const q = decide({ ...p, evidence: { ...p.evidence!, proposals: [...p.evidence!.proposals, loop] } }, { accept: ['prp_loop'] });
    expect(q.evidence!.proposals.find((x) => x.id === 'prp_loop')!.status).toBe('superseded');
    expect(q.roots).toEqual(p.roots);
  });
});

describe('questions pertinentes et non redondantes', () => {
  const sockets = reading([
    dev({ startModule: 0, ratedCurrentA: 20, curve: 'C', label: 'PC cuis.' }),
    dev({ startModule: 1, ratedCurrentA: 20, curve: 'C', label: 'Prises salon' }),
    dev({ startModule: 2, ratedCurrentA: 20, curve: 'C', label: 'Stopc. slpk 1' }),
    dev({ startModule: 3, ratedCurrentA: 10, curve: 'B', label: 'Ecl. ch.1' }),
    dev({ startModule: 4, ratedCurrentA: 16, label: 'Réserve' }),
    dev({ startModule: 5, kind: 'teleswitch', label: 'TL hall' }),
  ]);

  it('section : une question groupée pour les circuits de prises, rien pour la réserve ni le télérupteur', () => {
    let p = newExistingProject('X');
    const r = photo(p, 'h1', sockets, 1);
    p = r.project;
    const sec = open(p).filter((q) => q.about.prop === 'section');
    expect(sec).toHaveLength(2); // groupe « prises » (3) + éclairage seul
    const group = sec.find((q) => q.members)!;
    expect(group.members).toHaveLength(3);
    expect(group.text.params).toMatchObject({ usage: 'socket', n: 3 });
    expect(group.options!.map((o) => o.value)).toEqual([2.5, 4]);
    expect(r.summary!.others).toBe(1); // télérupteur : signalé dans le résumé, pas de question inutile
    expect(open(p).some((q) => q.text.key === 'assist.q.other')).toBe(false);
    // Réserve : pas de câble, pas d'usage demandé
    expect(open(p).filter((q) => q.about.prop === '@usage')).toHaveLength(0);
    expect(creates(p, 'cable')).toHaveLength(4);
    // Prête quand les câbles existent ; une réponse pour tous, confirmée
    expect(questionReady(p, group)).toBe(false);
    p = acceptAll(p);
    const g = open(p).find((q) => q.id === group.id)!;
    expect(questionReady(p, g)).toBe(true);
    p = answerGroup(p, g.id, 2.5);
    const cables = g.members!.map((m) => findNode(p.roots, m.nodeId!)!);
    expect(cables.map((c) => c.props.section)).toEqual([2.5, 2.5, 2.5]);
    expect(p.evidence!.provenance.filter((x) => x.prop === 'section').every((x) => x.basis === 'confirmed')).toBe(true);
  });

  it('« chacun séparément » puis « tout à vérifier plus tard »', () => {
    let p = acceptAll(photo(newExistingProject('X'), 'h1', sockets, 1).project);
    const group = open(p).find((q) => q.members)!;
    p = splitGroup(p, group.id);
    expect(open(p).filter((q) => q.about.prop === 'section' && !q.members)).toHaveLength(4);
    const n = open(p).length;
    p = deferQuestions(p);
    expect(open(p).every((q) => q.deferred)).toBe(true);
    expect(open(p)).toHaveLength(n); // rien n'est perdu ni écrit
    p = deferQuestions(p, true);
    expect(open(p).some((q) => q.deferred)).toBe(false);
  });

  it('raccordement deviné vérifié une par une : sa question est close d’office', () => {
    const r = reading([dev({ startModule: 0, widthModules: 2, kind: 'rcd', residualCurrentmA: 30 }), dev({ startModule: 2, ratedCurrentA: 16, label: 'Prises' })]);
    let p = photo(newExistingProject('X'), 'h1', r, 1).project;
    const q = open(p).find((x) => x.text.key === 'assist.q.parentByPosition')!;
    expect(q.about.proposalId).toBeTruthy();
    const rcd = creates(p, 'protection').find((x) => x.change.op === 'createNode' && x.change.props.device === 'rcd')!;
    p = decide(p, { accept: [rcd.id], confirm: [rcd.id] });
    p = decide(p, { accept: [q.about.proposalId!], confirm: [q.about.proposalId!] });
    expect(p.evidence!.questions.find((x) => x.id === q.id)!.status).toBe('answered');
  });
});

describe('correction avant acceptation', () => {
  const r = reading([
    dev({ startModule: 0, widthModules: 2, kind: 'rcd', residualCurrentmA: 300, label: 'A-B' }),
    dev({ startModule: 2, widthModules: 2, kind: 'rcd', residualCurrentmA: 30, label: 'C' }),
    dev({ startModule: 4, ratedCurrentA: 16, curve: 'C', label: 'Ecl. salon', circuitRef: 'A' }),
  ]);

  it('calibre, courbe et différentiel amont modifiés : valeurs retenues, confirmées, tracées', () => {
    let p = photo(newExistingProject('X'), 'h1', r, 1).project;
    const rcds = creates(p, 'protection').filter((x) => x.change.op === 'createNode' && x.change.props.device === 'rcd');
    const rcd30 = rcds.find((x) => x.change.op === 'createNode' && x.change.props.residualCurrent === 30)!;
    p = decide(p, { accept: rcds.map((x) => x.id), confirm: rcds.map((x) => x.id) });
    const mcb = creates(p, 'protection')[0];
    const to = rcd30.change.op === 'createNode' ? rcd30.change.tempKey : '';
    p = decide(p, { accept: [mcb.id], edits: { [mcb.id]: { props: { ratedCurrent: 20, curve: 'B' }, parent: { tempKey: to } } } });
    const node = findNode(p.roots, p.evidence!.proposals.find((x) => x.id === mcb.id)!.createdNodeId!)!;
    expect([node.props.ratedCurrent, node.props.curve]).toEqual([20, 'B']);
    expect(findParent(p.roots, node.id)!.props.residualCurrent).toBe(30);
    const prov = p.evidence!.provenance.filter((x) => x.nodeId === node.id);
    expect(prov.every((x) => x.basis === 'confirmed')).toBe(true);
    const edits = p.evidence!.history.filter((h) => h.action === 'edit' && h.refs.nodeId === node.id);
    expect(edits.map((h) => [h.refs.prop, h.before, h.after])).toEqual([
      ['ratedCurrent', 16, 20],
      ['curve', 'C', 'B'],
      ['@parent', undefined, findParent(p.roots, node.id)!.id],
    ]);
  });

  it('usage et pièce modifiés ; valeur retirée = absente (jamais une valeur par défaut)', () => {
    let p = photo(newExistingProject('X'), 'h1', r, 1).project;
    p = decide(p, { accept: needsReview(p.evidence).map((x) => x.id), confirm: needsReview(p.evidence).map((x) => x.id) });
    p = decide(p, { accept: pending(p).filter((x) => !(x.change.op === 'createNode' && x.change.tempKey.startsWith('u_'))).map((x) => x.id) });
    const u = pending(p).find((x) => x.change.op === 'createNode' && x.change.tempKey.startsWith('u_'))!;
    p = decide(p, { accept: [u.id], edits: { [u.id]: { kind: 'socket', location: 'Bureau' } } });
    const n = findNode(p.roots, p.evidence!.proposals.find((x) => x.id === u.id)!.createdNodeId!)!;
    expect([n.kind, n.location]).toEqual(['socket', 'Bureau']);
    // Calibre retiré avant acceptation : absent de l'arbre
    let q = photo(newExistingProject('Y'), 'h1', reading([dev({ ratedCurrentA: 16, label: 'Prises' })]), 1).project;
    const m = creates(q, 'protection')[0];
    q = decide(q, { accept: [m.id], edits: { [m.id]: { props: { ratedCurrent: null } } } });
    expect(nodesOf(q, 'protection')[0].props.ratedCurrent).toBeUndefined();
  });
});
