/**
 * Dossier de preuves de l'assistant (spécification docs/strategie/SPEC-ASSISTANT-MODELE.md, décisions A1 à A6).
 *
 * L'arbre électrique (Project.roots) reste la SEULE source de vérité de l'installation. Ce dossier, rangé à côté
 * (Project.evidence, facultatif), dit d'où viennent les informations, ce qui est proposé, ce qui manque :
 *  - sources : documents d'origine (photos, plans…), identifiés de façon stable ;
 *  - observations : ce qui a été lu, interprété, déduit (par l'IA, un algorithme ou l'utilisateur) ;
 *  - propositions : modifications de l'arbre en attente de décision (jamais appliquées sans l'utilisateur) ;
 *  - questions : informations inconnues, contradictions, confirmations ;
 *  - provenance : base de chaque valeur de l'arbre issue de l'assistant (observée, déduite, confirmée…) ;
 *  - historique : décisions et corrections, jamais réécrit.
 *
 * Une information inconnue n'est jamais remplacée par une valeur par défaut (A2) : la propriété reste absente de
 * l'arbre et une question ouverte la signale. Seule une action de l'utilisateur rend une valeur « confirmée » (A3).
 */
import { z } from 'zod';
import type { PropValue } from '../model/types';

export type SourceKind = 'boardPhoto' | 'equipmentPhoto' | 'planPdf' | 'planImage' | 'oldSchema' | 'report' | 'datasheet' | 'note' | 'trikker' | 'other';

export interface SourceDoc {
  id: string; // src_…
  /** Empreinte SHA-256 de l'original (identité, dédoublonnage, cache de l'IA) ; vide si inconnue. */
  sha256: string;
  kind: SourceKind;
  /** Libellé affiché (jamais un chemin local). */
  label: string;
  mime?: string;
  size?: number;
  addedAt: string;
  /** Objet de l'arbre concerné (ex. photo d'un tableau → nœud « tableau »). */
  about?: { nodeId: string };
}

/** Zone d'un document, coordonnées normalisées 0..1. Pour une photo de tableau : rangée et modules. */
export interface Region {
  sourceId: string;
  page?: number;
  box?: [number, number, number, number];
  row?: number;
  module?: number;
  width?: number;
}

export type ObservationKind = 'reading' | 'interpretation' | 'match' | 'inference' | 'grouping' | 'contradiction';
export type Method = 'manual' | 'deterministic' | 'ai' | 'import';

export interface Fact {
  value: PropValue | null;
  /** Certitude 0..1 (null : illisible). */
  confidence: number;
  raw?: string;
}

export interface Observation {
  id: string; // obs_…
  kind: ObservationKind;
  region: Region;
  method: Method;
  /** IA : fournisseur, modèle, version de la consigne, empreinte de l'entrée (cache). */
  engine?: { provider: string; model: string; promptVersion: string; inputHash?: string };
  at: string;
  /** Objet observé (clé locale, ex. « r0m4 » = rangée 0, module 4). */
  subject: { kind: 'device' | 'circuit' | 'room' | 'label' | 'symbol' | 'cable' | 'board'; key: string };
  facts: Record<string, Fact>;
  /** Observations liées (correspondance, déduction, regroupement, contradiction). */
  refs?: string[];
  note?: string;
}

/** Base épistémique d'une valeur. `confirmed` n'est attribué que par une action de l'utilisateur. */
export type Basis = 'observed' | 'deduced' | 'aiInferred' | 'proposed' | 'confirmed' | 'manual';

export type ProposalChange =
  | { op: 'createNode'; tempKey: string; parent: { nodeId: string } | { tempKey: string }; kind: string; props: Record<string, PropValue>; location?: string }
  | { op: 'setProp'; target: { nodeId: string } | { tempKey: string }; prop: string; value: PropValue; previous?: PropValue }
  | { op: 'place'; target: { nodeId: string } | { tempKey: string }; boardId: string; row: number; col: number };

export interface Proposal {
  id: string; // prp_…
  batch: string;
  purpose: 'reconstruction' | 'design' | 'correction';
  change: ProposalChange;
  basis: Basis;
  confidence: number;
  /** Information critique (calibre, sensibilité, structure de protection…) : jamais acceptée « en bloc » sans être vue. */
  critical: boolean;
  observations: string[];
  ruleId?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'superseded';
  decidedAt?: string;
  createdNodeId?: string;
  /** Texte court affichable (clé de traduction + paramètres). */
  text: { key: string; params?: Record<string, string | number> };
}

export interface Question {
  id: string; // q_…
  kind: 'unknown' | 'contradiction' | 'confirm' | 'choice';
  about: { nodeId?: string; tempKey?: string; prop?: string; proposalId?: string };
  text: { key: string; params?: Record<string, string | number> };
  options?: { value: PropValue; observations: string[]; label?: string }[];
  priority: 'high' | 'normal' | 'low';
  status: 'open' | 'answered' | 'dismissed';
  answer?: PropValue;
  answeredAt?: string;
}

export interface Provenance {
  nodeId: string;
  /** Propriété, ou « @node » pour l'existence du nœud lui-même. */
  prop: string;
  basis: Basis;
  observations: string[];
  confidence: number;
  at: string;
}

export interface HistoryEntry {
  at: string;
  actor: 'user' | 'assistant';
  action: 'accept' | 'reject' | 'answer' | 'dismiss' | 'edit' | 'snapshot' | 'purge';
  refs: { proposal?: string; question?: string; nodeId?: string; prop?: string; batch?: string };
  before?: PropValue | null;
  after?: PropValue | null;
  note?: string;
}

export interface Evidence {
  version: 1;
  sources: SourceDoc[];
  observations: Observation[];
  proposals: Proposal[];
  questions: Question[];
  provenance: Provenance[];
  history: HistoryEntry[];
}

/** Plafonds initiaux, ajustables (A5). */
export const MAX_OBSERVATIONS = 20_000;
export const MAX_PROPOSALS = 5_000;

export function emptyEvidence(): Evidence {
  return { version: 1, sources: [], observations: [], proposals: [], questions: [], provenance: [], history: [] };
}

let counter = 0;
/** Identifiant stable et unique (préfixe lisible + horodatage + aléa). */
export function evidenceId(prefix: 'src' | 'obs' | 'prp' | 'q' | 'tmp'): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Validation (lecture d'un fichier) : structure tolérante, champs inconnus conservés (comme le reste du format)
// ---------------------------------------------------------------------------

const prop = z.union([z.string(), z.number(), z.boolean(), z.null()]).optional();
const loose = <T extends z.ZodRawShape>(s: T) => z.looseObject(s);

export const evidenceSchema = loose({
  version: z.literal(1),
  sources: z.array(loose({ id: z.string(), sha256: z.string(), kind: z.string(), label: z.string(), addedAt: z.string() })),
  observations: z.array(loose({ id: z.string(), kind: z.string(), method: z.string(), facts: z.record(z.string(), loose({ value: prop, confidence: z.number() })) })),
  proposals: z.array(loose({ id: z.string(), batch: z.string(), purpose: z.string(), status: z.string(), basis: z.string(), change: loose({ op: z.string() }) })),
  questions: z.array(loose({ id: z.string(), kind: z.string(), status: z.string() })),
  provenance: z.array(loose({ nodeId: z.string(), prop: z.string(), basis: z.string() })),
  history: z.array(loose({ at: z.string(), actor: z.string(), action: z.string() })),
});

/** Dossier de preuves valide, sinon undefined (un dossier illisible n'empêche jamais d'ouvrir le projet). */
export function parseEvidence(v: unknown): Evidence | undefined {
  const r = evidenceSchema.safeParse(v);
  return r.success ? (r.data as unknown as Evidence) : undefined;
}

// ---------------------------------------------------------------------------
// Intégrité : nœuds supprimés de l'arbre
// ---------------------------------------------------------------------------

/**
 * Nœuds disparus de l'arbre : leurs provenances sont retirées, les propositions en attente qui les visent deviennent
 * « superseded », les questions ouvertes « dismissed ». Rien n'est supprimé de l'historique ni des sources.
 */
export function pruneEvidence(ev: Evidence, alive: Set<string>): Evidence {
  const targets = (c: ProposalChange): string[] => {
    const ids: string[] = [];
    if ('target' in c && 'nodeId' in c.target) ids.push(c.target.nodeId);
    if (c.op === 'createNode' && 'nodeId' in c.parent) ids.push(c.parent.nodeId);
    if (c.op === 'place') ids.push(c.boardId);
    return ids;
  };
  let changed = false;
  const provenance = ev.provenance.filter((p) => alive.has(p.nodeId) || !(changed = true));
  const proposals = ev.proposals.map((p) => {
    if (p.status !== 'pending' || targets(p.change).every((id) => alive.has(id))) return p;
    changed = true;
    return { ...p, status: 'superseded' as const };
  });
  const questions = ev.questions.map((q) => {
    if (q.status !== 'open' || !q.about.nodeId || alive.has(q.about.nodeId)) return q;
    changed = true;
    return { ...q, status: 'dismissed' as const };
  });
  return changed ? { ...ev, provenance, proposals, questions } : ev;
}

// ---------------------------------------------------------------------------
// Purge (A5) : jamais les informations confirmées, les sources, la provenance ni l'historique
// ---------------------------------------------------------------------------

/**
 * Au-delà des plafonds : on retire d'abord les propositions rejetées ou remplacées (les plus anciennes), puis les
 * observations que plus aucune proposition, provenance ou question ne cite. Une entrée « purge » est ajoutée à
 * l'historique avec les nombres retirés.
 */
export function purgeEvidence(ev: Evidence, maxObs = MAX_OBSERVATIONS, maxProps = MAX_PROPOSALS, now = new Date().toISOString()): Evidence {
  if (ev.observations.length <= maxObs && ev.proposals.length <= maxProps) return ev;
  let proposals = ev.proposals;
  if (proposals.length > maxProps) {
    const removable = proposals.filter((p) => p.status === 'rejected' || p.status === 'superseded');
    const drop = new Set(removable.slice(0, proposals.length - maxProps).map((p) => p.id));
    proposals = proposals.filter((p) => !drop.has(p.id));
  }
  let observations = ev.observations;
  if (observations.length > maxObs) {
    const cited = new Set<string>();
    for (const p of proposals) p.observations.forEach((o) => cited.add(o));
    for (const p of ev.provenance) p.observations.forEach((o) => cited.add(o));
    for (const q of ev.questions) q.options?.forEach((o) => o.observations.forEach((x) => cited.add(x)));
    for (const o of observations) o.refs?.forEach((r) => cited.add(r));
    const removable = observations.filter((o) => !cited.has(o.id));
    const drop = new Set(removable.slice(0, observations.length - maxObs).map((o) => o.id));
    observations = observations.filter((o) => !drop.has(o.id));
  }
  const removedP = ev.proposals.length - proposals.length;
  const removedO = ev.observations.length - observations.length;
  if (!removedP && !removedO) return ev;
  return {
    ...ev,
    proposals,
    observations,
    history: [...ev.history, { at: now, actor: 'assistant', action: 'purge', refs: {}, note: `${removedP} proposition(s), ${removedO} observation(s)` }],
  };
}
