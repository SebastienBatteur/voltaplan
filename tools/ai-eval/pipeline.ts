/**
 * Évaluation de la chaîne COMPLÈTE (sans IA) : les lectures du modèle passent par le code déterministe de
 * l'assistant (src/assist : fusion des photos d'un tableau, plusieurs tableaux, rattachement des sous-tableaux),
 * puis TOUTES les propositions sont acceptées telles quelles (cas le plus défavorable : un utilisateur qui ne
 * corrige rien) et l'arbre obtenu est comparé à la vérité terrain de l'installation.
 *
 * Format d'une installation (« cas ») : `voltaplan-ai-eval-case/1`, voir docs/assistant-evaluation.md § 7.
 * Fonctions pures, testées avec des lectures SIMULÉES (test/aiEvalPipeline.test.ts) : ces tests vérifient le calcul
 * des scores, pas la qualité de la reconnaissance.
 */
import { basename } from 'node:path';
import { PROTECTION_KINDS, type PhotoDeviceT, type PhotoKind, type PhotoReadingT } from '../../src/ai/boardPhoto';
import { bulkAcceptable, decide, needsReview } from '../../src/assist/apply';
import { boardOfTempKey, FACT_PROP, fuseObservations } from '../../src/assist/boardDraft';
import { addBoard } from '../../src/assist/boards';
import { normLabel } from '../../src/assist/labels';
import { mainBoardId, newExistingProject } from '../../src/assist/project';
import { addBoardReading, boardSources } from '../../src/assist/survey';
import { findNode, findParent, walk } from '../../src/model/tree';
import type { ElNode, Project, PropValue } from '../../src/model/types';
import { VALUE_FIELDS } from './metrics';
import { FIELDS, matchDevices, scorePhoto, total, TRUTH_FORMAT, type Field, type GroundTruth, type PhotoScore, type TruthDevice } from './score';
import { wilson, type Proportion } from './stats';

export const CASE_FORMAT = 'voltaplan-ai-eval-case/1';

export interface CasePhoto {
  /** Fichier de vérité de la photo (`<nom>.truth.json`, même dossier que le cas). */
  truth: string;
  /** Photo partielle : rangée et module du tableau où commence la photo (0, 0 si absente). */
  offset?: { row: number; module: number };
}

export interface CaseBoard {
  /** Identifiant libre, propre au cas (« principal », « garage »). */
  id: string;
  /** Nom du tableau tel que l'utilisateur le saisirait (« Garage ») : sert au rattachement proposé. */
  name: string;
  photos: CasePhoto[];
  /**
   * Parent de chaque protection, positions dans le TABLEAU (« r0m2 » = rangée 0, module 2, après décalage) :
   * position du différentiel (ou de l'appareil) en amont, ou null = directement sous le tableau. Protection absente
   * de la liste : raccordement non évalué.
   */
  upstream?: Record<string, string | null>;
  /** Circuit qui alimente ce tableau : tableau et position de la protection. null ou absent : tableau principal. */
  fedBy?: { board: string; at: string } | null;
}

export interface EvalCase {
  format: typeof CASE_FORMAT;
  notes?: string;
  /** Le premier tableau est le tableau principal ; les autres sont ajoutés comme sous-tableaux (alimentation inconnue). */
  boards: CaseBoard[];
}

const POS = /^r(\d+)m(\d+)$/;
const posKey = (row: number, module: number) => `r${row}m${module}`;
export const photoName = (truthFile: string) => basename(truthFile, '.truth.json');

/** Cas valide ? (message d'erreur lisible, sinon null) */
export function checkCase(x: unknown): string | null {
  const c = x as Partial<EvalCase>;
  if (!c || typeof c !== 'object') return 'pas un objet JSON';
  if (c.format !== CASE_FORMAT) return `format attendu « ${CASE_FORMAT} »`;
  if (!Array.isArray(c.boards) || !c.boards.length) return 'boards manquant ou vide';
  const ids = new Set<string>();
  for (const [i, b] of c.boards.entries()) {
    if (!b || typeof b.id !== 'string' || !b.id) return `tableau ${i} : id manquant`;
    if (ids.has(b.id)) return `tableau ${i} : id « ${b.id} » en double`;
    ids.add(b.id);
    if (typeof b.name !== 'string') return `tableau ${b.id} : name manquant`;
    if (!Array.isArray(b.photos) || !b.photos.length) return `tableau ${b.id} : au moins une photo`;
    for (const p of b.photos) {
      if (typeof p.truth !== 'string' || !p.truth.endsWith('.truth.json')) return `tableau ${b.id} : photo sans fichier « .truth.json »`;
      if (p.offset && !(Number.isInteger(p.offset.row) && Number.isInteger(p.offset.module) && p.offset.row >= 0 && p.offset.module >= 0)) return `tableau ${b.id} : offset invalide`;
    }
    for (const [k, v] of Object.entries(b.upstream ?? {})) if (!POS.test(k) || (v !== null && !POS.test(v))) return `tableau ${b.id} : upstream « ${k} » → « ${v} » (positions « r0m2 »)`;
  }
  for (const [i, b] of c.boards.entries()) {
    if (!b.fedBy) continue;
    if (i === 0) return 'le premier tableau (principal) ne peut pas avoir fedBy';
    if (!ids.has(b.fedBy.board) || b.fedBy.board === b.id || !POS.test(b.fedBy.at)) return `tableau ${b.id} : fedBy invalide`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Vérité d'un tableau : réunion des vérités de ses photos (positions du tableau)
// ---------------------------------------------------------------------------

const VALUE_KEYS = ['widthModules', 'ratedCurrentA', 'curve', 'residualCurrentmA', 'rcdType', 'label', 'circuitRef', 'poles'] as const;

/**
 * Protections d'un tableau d'après les vérités de ses photos. Un appareil vu sur plusieurs photos : une valeur lue sur
 * l'une l'emporte sur « illisible » (null) sur l'autre ; « incertain » seulement si aucune photo n'en est sûre.
 */
export function boardTruth(board: CaseBoard, truths: Map<string, GroundTruth>): TruthDevice[] {
  const out = new Map<string, TruthDevice>();
  for (const ph of board.photos) {
    const t = truths.get(photoName(ph.truth));
    if (!t) continue;
    const dr = ph.offset?.row ?? 0;
    const dm = ph.offset?.module ?? 0;
    for (const d of t.devices) {
      if (!PROTECTION_KINDS.has(d.kind)) continue;
      const row = d.row + dr;
      const startModule = d.startModule + dm;
      const k = posKey(row, startModule);
      const cur = out.get(k);
      if (!cur) {
        out.set(k, { ...d, row, startModule, unsure: d.unsure ? [...d.unsure] : undefined, unreadable: d.unreadable ? [...d.unreadable] : undefined });
        continue;
      }
      for (const key of VALUE_KEYS) {
        const v = d[key];
        const sure = !d.unsure?.includes(key);
        if (v === undefined) continue;
        const c = cur[key];
        const curSure = !cur.unsure?.includes(key);
        if (c === undefined || (c === null && v !== null) || (!curSure && sure)) {
          (cur as unknown as Record<string, unknown>)[key] = v;
          cur.unsure = cur.unsure?.filter((x) => x !== key || !sure);
          cur.unreadable = cur.unreadable?.filter((x) => x !== key || v === null);
        }
      }
    }
  }
  return [...out.values()].sort((a, b) => a.row - b.row || a.startModule - b.startModule);
}

/**
 * Ce que l'arbre peut porter : l'étiquette d'un différentiel est la liste des circuits protégés (rendue par la
 * structure, pas par un nom) ; le repère n'est porté que par une protection de circuit.
 */
function scorable(d: TruthDevice): TruthDevice {
  const x = { ...d };
  if (d.kind === 'rcd') delete x.label;
  if (!(d.kind === 'mcb' || d.kind === 'rcbo' || d.kind === 'fuse')) delete x.circuitRef;
  return x;
}

// ---------------------------------------------------------------------------
// Chaîne complète : lectures → brouillons → tout accepté → arbre
// ---------------------------------------------------------------------------

const at = (s: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, s)).toISOString();

export interface CaseRun {
  /** Projet après lecture de toutes les photos (brouillon, rien accepté). */
  draft: Project;
  /** Projet après acceptation de toutes les propositions. */
  accepted: Project;
  /** Identifiant du cas → nœud « tableau ». */
  boardIds: Map<string, string>;
  /** Photos sans lecture (erreur du modèle) : ignorées. */
  missingReadings: string[];
  /** Photos signalées comme doublon d'une autre. */
  duplicates: number;
}

export function runCase(c: EvalCase, readings: Map<string, PhotoReadingT>): CaseRun {
  let p = newExistingProject('évaluation');
  const boardIds = new Map<string, string>([[c.boards[0].id, mainBoardId(p)!]]);
  for (const b of c.boards.slice(1)) {
    const r = addBoard(p, b.name);
    p = r.project;
    boardIds.set(b.id, r.boardId);
  }
  let s = 0;
  const missingReadings: string[] = [];
  let duplicates = 0;
  for (const b of c.boards)
    for (const ph of b.photos) {
      const name = photoName(ph.truth);
      const reading = readings.get(name);
      if (!reading) {
        missingReadings.push(name);
        continue;
      }
      const r = addBoardReading(p, { boardId: boardIds.get(b.id)!, sha256: `eval:${b.id}:${name}`, label: name, reading, offset: ph.offset, now: at(s++) });
      if (r.duplicateOf) duplicates++;
      p = r.project;
    }
  const draft = p;
  // Tout accepter comme dans l'application (src/ui/AssistPanel.tsx) : « Tout accepter » sur ce qui est sûr, puis
  // chaque proposition à voir une par une, acceptée sans correction ; leurs dépendances suivent au tour suivant
  const pending = () => p.evidence!.proposals.filter((x) => x.status === 'pending').length;
  for (let i = 0; i < 50 && pending(); i++) {
    const before = pending();
    const bulk = bulkAcceptable(p.evidence).map((x) => x.id);
    if (bulk.length) p = decide(p, { accept: bulk }, at(s++));
    else for (const x of needsReview(p.evidence)) p = decide(p, { accept: [x.id], confirm: [x.id] }, at(s++));
    if (pending() === before) break;
  }
  return { draft, accepted: p, boardIds, missingReadings, duplicates };
}

// ---------------------------------------------------------------------------
// Score d'une installation
// ---------------------------------------------------------------------------

export interface UpstreamScore {
  /** Raccordements évalués (protection de la vérité appariée, raccordement annoté). */
  n: number;
  correct: number;
  /** Rattachée à un autre différentiel que celui de la vérité. */
  wrong: number;
  /** Vérité : sous un différentiel ; arbre : directement sous le tableau. */
  missing: number;
  /** Vérité : directement sous le tableau ; arbre : sous un différentiel (protection différentielle inventée). */
  invented: number;
  /** Raccordement annoté mais protection non retrouvée dans l'arbre. */
  unmatched: number;
}

export interface ContradictionScore {
  /** Faits sur lesquels deux photos d'un même appareil ne sont pas d'accord. */
  facts: number;
  /** Parmi eux, ceux dont la vérité est connue (valeur). */
  evaluated: number;
  /** La bonne valeur figure parmi les options proposées à l'utilisateur. */
  withTruth: number;
  /** Valeur écrite dans l'arbre malgré le désaccord (doit rester 0 : garanti par le code déterministe). */
  proposedDespite: number;
}

export interface BoardScore {
  id: string;
  photo: PhotoScore;
  upstream: UpstreamScore;
  /** Rattachement du sous-tableau à son alimentation (absent pour le tableau principal). */
  link?: 'correct' | 'wrong' | 'absent';
  contradictions: ContradictionScore;
}

export interface CaseScore {
  name: string;
  boards: BoardScore[];
  /** Questions ouvertes après lecture de toutes les photos (ce que l'utilisateur aurait à répondre). */
  questions: number;
  /** Nœuds « tableau » créés en plus des tableaux du cas (point « sous-tableau » déduit d'une étiquette, non rattaché). */
  extraBoards: number;
  duplicates: number;
  missingReadings: string[];
  error?: string;
}

const str = (v: PropValue | undefined) => (v === undefined || v === null || v === '' ? null : String(v));
const num = (v: PropValue | undefined) => (typeof v === 'number' ? v : null);

/** Protections d'un tableau dans l'arbre reconstruit, avec leur position (clé stable des propositions). */
function treeProtections(p: Project, boardNodeId: string): { row: number; d: PhotoDeviceT; nodeId: string }[] {
  const out: { row: number; d: PhotoDeviceT; nodeId: string }[] = [];
  for (const x of p.evidence?.proposals ?? []) {
    if (x.status !== 'accepted' || x.change.op !== 'createNode' || x.change.kind !== 'protection' || !x.createdNodeId) continue;
    if (boardOfTempKey(x.change.tempKey) !== boardNodeId) continue;
    const m = /^p_r(\d+)m(\d+)@/.exec(x.change.tempKey);
    const n = findNode(p.roots, x.createdNodeId);
    if (!m || !n) continue;
    out.push({
      row: Number(m[1]),
      nodeId: n.id,
      d: {
        startModule: Number(m[2]),
        widthModules: num(n.props.modules) ?? 1,
        kind: (str(n.props.device) ?? 'mcb') as PhotoKind,
        brand: null,
        model: null,
        poles: str(n.props.poles),
        ratedCurrentA: num(n.props.ratedCurrent),
        curve: str(n.props.curve),
        residualCurrentmA: num(n.props.residualCurrent),
        rcdType: str(n.props.rcdType),
        label: str(n.props.circuitName),
        circuitRef: str(n.props.fixedLetter),
        confidence: 'high',
      },
    });
  }
  return out.sort((a, b) => a.row - b.row || a.d.startModule - b.d.startModule);
}

const FACT_TRUTH: Record<string, keyof TruthDevice | undefined> = {
  kind: 'kind',
  ratedCurrent: 'ratedCurrentA',
  curve: 'curve',
  residualCurrent: 'residualCurrentmA',
  rcdType: 'rcdType',
  poles: 'poles',
  label: 'label',
  circuitRef: 'circuitRef',
  modules: 'widthModules',
};
const same = (fact: string, a: unknown, b: unknown) =>
  typeof a === 'string' || typeof b === 'string'
    ? fact === 'label'
      ? normLabel(String(a)) === normLabel(String(b))
      : String(a).toUpperCase().replace(/\s+/g, '') === String(b).toUpperCase().replace(/\s+/g, '')
    : a === b;

export function scoreCase(name: string, c: EvalCase, truths: Map<string, GroundTruth>, readings: Map<string, PhotoReadingT>): CaseScore {
  const run = runCase(c, readings);
  const p = run.accepted;
  const per = c.boards.map((b) => {
    const nodeId = run.boardIds.get(b.id)!;
    const full = boardTruth(b, truths);
    const preds = treeProtections(p, nodeId);
    return { b, nodeId, full, preds, pairs: matchDevices(full, preds) };
  });
  // Nœud protection → (tableau du cas, position de la vérité appariée)
  const where = new Map<string, { board: string; key: string | null }>();
  for (const x of per) {
    const toTruth = new Map(x.pairs.map(([ti, pi]) => [pi, ti]));
    x.preds.forEach((pr, pi) => {
      const ti = toTruth.get(pi);
      where.set(pr.nodeId, { board: x.b.id, key: ti === undefined ? null : posKey(x.full[ti].row, x.full[ti].startModule) });
    });
  }
  const boards: BoardScore[] = per.map((x) => {
    const truth: GroundTruth = { format: TRUTH_FORMAT, image: '', composed: true, rows: 1, perRow: 1, devices: x.full.map(scorable) };
    const rows = [...new Set(x.preds.map((q) => q.row))].map((row) => ({ row, devices: x.preds.filter((q) => q.row === row).map((q) => q.d) }));
    const photo = scorePhoto(x.b.id, truth, { rows, notes: null });

    // Raccordements (différentiel → circuit)
    const up: UpstreamScore = { n: 0, correct: 0, wrong: 0, missing: 0, invented: 0, unmatched: 0 };
    const truthToPred = new Map(x.pairs);
    x.full.forEach((d, ti) => {
      const key = posKey(d.row, d.startModule);
      if (!x.b.upstream || !Object.prototype.hasOwnProperty.call(x.b.upstream, key)) return;
      const want = x.b.upstream[key];
      const pi = truthToPred.get(ti);
      if (pi === undefined) {
        up.unmatched++;
        return;
      }
      up.n++;
      const parent = findParent(p.roots, x.preds[pi].nodeId);
      const got = !parent || parent.id === x.nodeId ? null : parent.kind === 'protection' ? (where.get(parent.id)?.key ?? '?') : '?';
      if (got === want) up.correct++;
      else if (want === null) up.invented++;
      else if (got === null) up.missing++;
      else up.wrong++;
    });

    // Rattachement du sous-tableau
    let link: BoardScore['link'];
    if (x.b.fedBy) {
      const parent = findParent(p.roots, x.nodeId);
      const prot = parent?.kind === 'cable' ? findParent(p.roots, parent.id) : parent?.kind === 'protection' ? parent : null;
      const w = prot ? where.get(prot.id) : undefined;
      link = !prot ? 'absent' : w && w.board === x.b.fedBy.board && w.key === x.b.fedBy.at ? 'correct' : 'wrong';
    }

    // Désaccords entre photos de ce tableau
    const e = run.draft.evidence!;
    const srcs = new Set(boardSources(e, x.nodeId).map((s) => s.id));
    const fused = fuseObservations(e.observations.filter((o) => o.kind === 'reading' && srcs.has(o.region.sourceId)));
    const fusedPairs = new Map(matchDevices(x.full, fused.map((f) => ({ row: f.row, d: { startModule: f.start, widthModules: f.width } as PhotoDeviceT }))).map(([ti, fi]) => [fi, ti]));
    const nodeAt = new Map(x.preds.map((q) => [posKey(q.row, q.d.startModule), q.nodeId]));
    const cs: ContradictionScore = { facts: 0, evaluated: 0, withTruth: 0, proposedDespite: 0 };
    fused.forEach((f, fi) => {
      for (const ct of f.contradictions) {
        if (ct.fact === 'reference') continue;
        cs.facts++;
        const nid = nodeAt.get(f.key);
        const node: ElNode | undefined = nid ? findNode(p.roots, nid) : undefined;
        const prop = FACT_PROP[ct.fact];
        if (node && ct.fact !== 'kind' && ct.fact !== 'modules' && str(node.props[prop]) !== null) cs.proposedDespite++;
        const ti = fusedPairs.get(fi);
        const key = FACT_TRUTH[ct.fact];
        const tv = ti === undefined || !key ? undefined : x.full[ti][key];
        if (tv === undefined || tv === null) continue;
        cs.evaluated++;
        if (ct.options.some((o) => same(ct.fact, o.value, tv))) cs.withTruth++;
      }
    });
    return { id: x.b.id, photo, upstream: up, link, contradictions: cs };
  });
  const known = new Set(run.boardIds.values());
  const extraBoards = [...walk(p.roots)].filter((w) => w.node.kind === 'board' && !known.has(w.node.id)).length;
  const questions = run.draft.evidence!.questions.filter((q) => q.status === 'open').length;
  return { name, boards, questions, extraBoards, duplicates: run.duplicates, missingReadings: run.missingReadings };
}

// ---------------------------------------------------------------------------
// Synthèse de plusieurs installations
// ---------------------------------------------------------------------------

export interface PipelineSummary {
  cases: number;
  boards: number;
  recall: Proportion | null;
  precision: Proportion | null;
  accuracy: Record<Field, Proportion | null>;
  /** Valeurs inventées dans l'arbre (champs de valeur réunis) / vérités « absent ou illisible ». */
  inventedAll: Proportion | null;
  /** Raccordements différentiel → circuit exacts / évalués. */
  upstream: Proportion | null;
  upstreamDetail: UpstreamScore;
  links: { n: number; correct: number; wrong: number; absent: number };
  /** Score de structure : raccordements exacts + sous-tableaux bien rattachés, sur le total évalué. */
  structure: Proportion | null;
  contradictions: ContradictionScore;
  questionsPerBoard?: number;
  extraBoards: number;
  duplicates: number;
}

export function summarizeCases(cases: CaseScore[]): PipelineSummary {
  const ok = cases.filter((c) => !c.error);
  const bs = ok.flatMap((c) => c.boards);
  const all = total(bs.map((b) => b.photo));
  const up: UpstreamScore = { n: 0, correct: 0, wrong: 0, missing: 0, invented: 0, unmatched: 0 };
  for (const b of bs) for (const k of Object.keys(up) as (keyof UpstreamScore)[]) up[k] += b.upstream[k];
  const links = { n: 0, correct: 0, wrong: 0, absent: 0 };
  for (const b of bs)
    if (b.link) {
      links.n++;
      links[b.link]++;
    }
  const cs: ContradictionScore = { facts: 0, evaluated: 0, withTruth: 0, proposedDespite: 0 };
  for (const b of bs) for (const k of Object.keys(cs) as (keyof ContradictionScore)[]) cs[k] += b.contradictions[k];
  const F = all.fields;
  const sum = (k: 'invented' | 'truthNull') => VALUE_FIELDS.reduce((n, f) => n + F[f][k], 0);
  return {
    cases: ok.length,
    boards: bs.length,
    recall: wilson(all.matched, all.truth),
    precision: wilson(all.matched, all.predicted),
    accuracy: Object.fromEntries(FIELDS.map((f) => [f, wilson(F[f].correct, F[f].n)])) as Record<Field, Proportion | null>,
    inventedAll: wilson(sum('invented'), sum('truthNull')),
    upstream: wilson(up.correct, up.n),
    upstreamDetail: up,
    links,
    structure: wilson(up.correct + links.correct, up.n + links.n),
    contradictions: cs,
    questionsPerBoard: bs.length ? ok.reduce((n, c) => n + c.questions, 0) / bs.length : undefined,
    extraBoards: ok.reduce((n, c) => n + c.extraBoards, 0),
    duplicates: ok.reduce((n, c) => n + c.duplicates, 0),
  };
}
