/**
 * Relevé d'un tableau à partir d'une ou plusieurs photos (fonctions pures, testées) : enregistre la source, ses
 * observations, puis refait le brouillon du tableau à partir de TOUTES ses photos (fusion), sans doublon :
 *  - même photo (même empreinte SHA-256) : même source ; même entrée de l'IA (même image envoyée, même modèle, même
 *    consigne) : la lecture déjà faite est réutilisée, sans nouvel appel (cache) ;
 *  - photo différente mais lecture identique à une autre photo du tableau (même calage, mêmes valeurs) : doublon
 *    probable, signalé, aucune observation ajoutée (sinon deux fois la même lecture passerait pour deux confirmations) ;
 *  - les propositions en attente du brouillon précédent sont remplacées ; ce qui a déjà été accepté n'est pas
 *    reproposé (seulement complété) ; une question déjà posée ne l'est jamais une seconde fois.
 */
import type { PhotoReadingT } from '../ai/boardPhoto';
import type { Project } from '../model/types';
import { findNode } from '../model/tree';
import { boardOfTempKey, draftFromObservations, observeReading, tempKeyOf, type BoardDraft, type ExistingBoard } from './boardDraft';
import { withSubBoardLinks } from './boards';
import { emptyEvidence, evidenceId, purgeEvidence, type Evidence, type Observation, type SourceDoc } from './evidence';
import { normLabel } from './labels';

export interface ReadingInput {
  boardId: string;
  /** Empreinte de l'original (photo telle qu'importée). */
  sha256: string;
  label: string;
  mime?: string;
  size?: number;
  /** Calage utilisé (empreinte courte). */
  calibration?: string;
  /** Photo partielle : première rangée / premier module visibles. */
  offset?: { row: number; module: number };
  /** Lecture faite ; absente : réutiliser la lecture en cache (même `engine.inputHash`). */
  reading?: PhotoReadingT;
  engine?: Observation['engine'];
  method?: Observation['method'];
  now?: string;
}

export interface ReadingResult {
  project: Project;
  summary?: BoardDraft['summary'];
  sourceId: string;
  /** Lecture identique à celle d'une autre photo du tableau : rien n'a été ajouté. */
  duplicateOf?: string;
  /** Lecture réutilisée (aucun appel à l'IA). */
  cached: boolean;
}

/** Lecture déjà faite pour cette photo et cette entrée de l'IA (cache) : horodatage de la lecture, sinon undefined. */
export function cachedRun(e: Evidence | undefined, sha256: string, inputHash: string | undefined, boardId?: string): string | undefined {
  if (!e || !sha256 || !inputHash) return undefined;
  const ids = new Set(e.sources.filter((s) => s.sha256 === sha256 && (!boardId || s.about?.nodeId === boardId)).map((s) => s.id));
  return e.observations.find((o) => o.kind === 'reading' && ids.has(o.region.sourceId) && o.engine?.inputHash === inputHash)?.at;
}

/** Signature d'une lecture : positions et valeurs lues, sans les identifiants ni les certitudes. */
function signature(obs: Observation[]): string {
  return obs
    .filter((o) => o.kind === 'reading')
    .map((o) => {
      const f = Object.entries(o.facts)
        .map(([k, v]) => `${k}=${typeof v.value === 'string' ? normLabel(v.value) : String(v.value)}`)
        .sort()
        .join(';');
      return `${o.region.row}/${o.region.module}/${o.region.width}|${f}`;
    })
    .sort()
    .join('\n');
}

/** Observations en vigueur d'une source (sa dernière lecture). */
const runOf = (e: Evidence, s: SourceDoc) => e.observations.filter((o) => o.kind === 'reading' && o.region.sourceId === s.id && (!s.runAt || o.at === s.runAt));

/** Photos d'un tableau prises en compte (hors doublons), dans l'ordre d'ajout. */
export const boardSources = (e: Evidence, boardId: string) => e.sources.filter((s) => s.kind === 'boardPhoto' && s.about?.nodeId === boardId && !s.duplicateOf);

/** Ce qui existe déjà pour ce tableau : nœuds créés par une acceptation (et leurs enfants), questions déjà posées. */
export function existingFor(project: Project, boardId: string): ExistingBoard {
  const e = project.evidence ?? emptyEvidence();
  const nodes: ExistingBoard['nodes'] = new Map();
  const confirmed = (id: string) => new Set(e.provenance.filter((p) => p.nodeId === id && (p.basis === 'confirmed' || p.basis === 'manual')).map((p) => p.prop));
  for (const p of e.proposals) {
    if (p.status !== 'accepted' || p.change.op !== 'createNode' || !p.createdNodeId) continue;
    if (boardOfTempKey(p.change.tempKey) !== boardId) continue;
    const n = findNode(project.roots, p.createdNodeId);
    if (!n) continue;
    nodes.set(p.change.tempKey, { id: n.id, props: n.props, confirmed: confirmed(n.id) });
    // Câble et points ajoutés autrement (réponse « Qu'alimente ce circuit ? ») : comptent aussi
    if (p.change.tempKey.startsWith('p_')) {
      const key = p.change.tempKey.slice(2, p.change.tempKey.lastIndexOf('@'));
      const cable = n.children.find((c) => c.kind === 'cable');
      if (cable && !nodes.has(tempKeyOf('c', key, boardId))) nodes.set(tempKeyOf('c', key, boardId), { id: cable.id, props: cable.props, confirmed: confirmed(cable.id) });
      const load = cable?.children.find((c) => c.kind !== 'cable');
      if (load && !nodes.has(tempKeyOf('u', key, boardId))) nodes.set(tempKeyOf('u', key, boardId), { id: load.id, props: load.props, confirmed: confirmed(load.id) });
    }
  }
  // Déjà posées : toutes les questions closes, et les questions ouvertes sur un objet qui existe déjà
  const asked = new Set<string>();
  for (const q of e.questions) {
    if (q.status === 'open' && !q.about.nodeId && !q.members?.some((m) => m.nodeId)) continue;
    const prop = q.about.prop ?? q.text.key;
    for (const t of [q.about.tempKey, q.about.nodeId]) if (t) asked.add(`${t}|${prop}`);
    for (const m of q.members ?? []) for (const t of [m.tempKey, m.nodeId]) if (t) asked.add(`${t}|${prop}`);
  }
  return { nodes, asked };
}

/** Clés « cible|propriété » d'une question (pour la remplacer sans doublon). */
const keysOf = (q: Evidence['questions'][number]) => {
  const prop = q.about.prop ?? q.text.key;
  return [q.about.tempKey, q.about.nodeId, ...(q.members ?? []).flatMap((m) => [m.tempKey, m.nodeId])].filter(Boolean).map((t) => `${t}|${prop}`);
};

/**
 * Ajoute une lecture de photo d'un tableau et refait son brouillon (une seule étape d'annulation pour l'appelant).
 * Hook format v2 : `registerOriginal` est l'endroit où l'original de la photo sera rangé dans le magasin de
 * fichiers (assets/<sha256>) ; pour l'instant la photo reste stockée comme avant (disposition du tableau).
 */
export function addBoardReading(project: Project, input: ReadingInput, registerOriginal?: (source: SourceDoc) => void): ReadingResult {
  const now = input.now ?? new Date().toISOString();
  const e0 = project.evidence ?? emptyEvidence();
  const B = input.boardId;
  // 1. Source : même empreinte = même photo
  const same = input.sha256 ? e0.sources.find((s) => s.sha256 === input.sha256 && s.about?.nodeId === B) : undefined;
  const n = e0.sources.filter((s) => s.kind === 'boardPhoto' && s.about?.nodeId === B && !s.duplicateOf).length;
  let source: SourceDoc = same ?? {
    id: evidenceId('src'),
    sha256: input.sha256,
    kind: 'boardPhoto',
    label: n ? `${input.label} ${n + 1}` : input.label,
    ...(input.mime ? { mime: input.mime } : {}),
    ...(input.size ? { size: input.size } : {}),
    addedAt: now,
    about: { nodeId: B },
  };
  if (input.calibration) source = { ...source, calibration: input.calibration };
  if (input.offset && (input.offset.row || input.offset.module)) source = { ...source, offset: input.offset };
  else if (source.offset) source = { ...source, offset: undefined };
  if (!same) registerOriginal?.(source); // TODO(format v2) : ranger l'original dans le magasin de fichiers

  // 2. Observations : cache, sinon nouvelle lecture
  const engine = input.engine;
  let added: Observation[] = [];
  let cached = false;
  const hit = cachedRun(e0, input.sha256, engine?.inputHash, B);
  if (!input.reading || hit) {
    if (!hit) throw new Error('no cached reading');
    cached = true;
    source = { ...source, runAt: hit };
  } else {
    added = observeReading({ reading: input.reading, sourceId: source.id, boardId: B, engine, method: input.method, now, offset: input.offset });
    source = { ...source, runAt: now };
    // Doublon probable : même lecture qu'une AUTRE photo de ce tableau
    const sig = signature(added);
    const dup = boardSources(e0, B).find((s) => s.id !== source.id && (!input.calibration || !s.calibration || s.calibration === input.calibration) && signature(runOf(e0, s)) === sig);
    if (dup && sig) {
      const kept: SourceDoc = { ...source, duplicateOf: dup.id, runAt: undefined };
      const sources = same ? e0.sources.map((s) => (s.id === same.id ? kept : s)) : [...e0.sources, kept];
      return { project: { ...project, evidence: { ...e0, sources } }, sourceId: kept.id, duplicateOf: dup.id, cached: false };
    }
  }
  const sources = same ? e0.sources.map((s) => (s.id === same.id ? source : s)) : [...e0.sources, source];
  const e1: Evidence = { ...e0, sources, observations: [...e0.observations, ...added] };

  // 3. Brouillon du tableau à partir de toutes ses photos
  const p1: Project = { ...project, evidence: e1 };
  const observations = boardSources(e1, B).flatMap((s) => runOf(e1, s));
  const draft = draftFromObservations({ observations, boardId: B, now, existing: existingFor(p1, B) });

  // 4. Remplacement du brouillon précédent de ce tableau (propositions en attente, questions encore sans objet)
  const prefix = `photo:${B}:`;
  const proposals = e1.proposals.map((x) => (x.status === 'pending' && x.batch.startsWith(prefix) ? { ...x, status: 'superseded' as const, decidedAt: now } : x));
  const mineOpen = (q: Evidence['questions'][number]) =>
    q.status === 'open' && !q.about.nodeId && !q.members?.some((m) => m.nodeId) && ([q.about.tempKey, ...(q.members ?? []).map((m) => m.tempKey)].some((t) => t && boardOfTempKey(t) === B) || (!!q.about.proposalId && proposals.find((x) => x.id === q.about.proposalId)?.status === 'superseded'));
  // Question précédente identique (même objet, même propriété, mêmes options) : gardée telle quelle (elle a pu être
  // reportée) ; les autres questions sans objet de ce tableau sont closes, remplacées par celles du nouveau brouillon
  const sameQ = (a: Evidence['questions'][number], b: Evidence['questions'][number]) =>
    a.kind === b.kind && a.text.key === b.text.key && JSON.stringify(keysOf(a)) === JSON.stringify(keysOf(b)) && JSON.stringify(a.options ?? null) === JSON.stringify(b.options ?? null);
  const kept = new Set<string>();
  const fresh = draft.questions.filter((q) => {
    const old = e1.questions.find((o) => mineOpen(o) && !kept.has(o.id) && sameQ(o, q));
    if (old) kept.add(old.id);
    return !old;
  });
  const questions = e1.questions.map((q) => (mineOpen(q) && !kept.has(q.id) ? { ...q, status: 'dismissed' as const, answeredAt: now } : q));
  const merged: Project = {
    ...project,
    evidence: purgeEvidence({
      ...e1,
      observations: [...e1.observations, ...draft.observations],
      proposals: [...proposals, ...draft.proposals],
      questions: [...questions, ...fresh],
    }),
  };
  return { project: withSubBoardLinks(merged, now), summary: draft.summary, sourceId: source.id, cached };
}
