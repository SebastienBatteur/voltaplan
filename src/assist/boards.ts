/**
 * Plusieurs tableaux dans une installation : tableau principal et sous-tableaux (code déterministe).
 *
 * Un sous-tableau ajouté par l'utilisateur sans savoir encore ce qui l'alimente est rangé à la racine de l'arbre
 * (« alimentation inconnue », rien n'est inventé). Quand un circuit d'un autre tableau est étiqueté comme son
 * alimentation (« Sous-tableau garage », « Onderverdeling tuinhuis ») ou qu'un point « tableau » a été déduit d'une
 * étiquette, l'assistant PROPOSE de rattacher le sous-tableau sous ce circuit : proposition critique (vue une par
 * une) et question liée. Rien n'est déplacé sans l'accord de l'utilisateur.
 */
import type { ElNode, Project } from '../model/types';
import { createNode, walk } from '../model/tree';
import { evidenceId, emptyEvidence, type Proposal, type Question } from './evidence';
import { interpretLabel, normLabel } from './labels';

/** Mots qui disent « tableau » sans désigner lequel. */
const GENERIC = new Set(
  'sous tableau tab td div divisionnaire coffret board sub panel subpanel subboard ondertableau onderverdeelbord onderverdeling onderbord verdeelbord bijbord bord de du la le het van voor the'.split(' '),
);
const words = (s: string) => new Set(normLabel(s).split(' ').filter((w) => w.length > 1 && !GENERIC.has(w) && !/^\d+$/.test(w)));

/** Le nom (et la pièce) d'un tableau et celui d'une alimentation désignent-ils le même endroit ? */
export function sameBoardName(a: string, b: string): boolean {
  const ra = interpretLabel(a).rooms;
  const rb = interpretLabel(b).rooms;
  if (ra.length && rb.length) return ra.some((r) => rb.includes(r));
  const wa = words(a);
  return [...words(b)].some((w) => wa.has(w));
}

/** Nouveau tableau, alimentation inconnue : à la racine de l'arbre, jamais rattaché d'office. */
export function addBoard(project: Project, name: string): { project: Project; boardId: string } {
  const board = createNode('board', { name });
  return { project: withSubBoardLinks({ ...project, roots: [...project.roots, board] }), boardId: board.id };
}

/** Tableaux dont l'alimentation est inconnue (à la racine de l'arbre). */
export const unfedBoards = (p: Project) => p.roots.filter((r) => r.kind === 'board');

interface Feed {
  name: string;
  /** Où rattacher le sous-tableau : câble existant, protection existante ou câble encore proposé. */
  parent: { nodeId: string } | { tempKey: string };
  /** Proposition « créer un point tableau » qu'un rattachement rend inutile. */
  replaces?: string;
}

/** Circuits qui alimentent un sous-tableau d'après leur étiquette (arbre) ou une proposition « tableau » en attente. */
function feeds(p: Project): Feed[] {
  const out: Feed[] = [];
  for (const pr of p.evidence?.proposals ?? [])
    if (pr.status === 'pending' && pr.change.op === 'createNode' && pr.change.kind === 'board' && 'tempKey' in pr.change.parent)
      out.push({ name: `${pr.change.props.name ?? ''} ${pr.change.location ?? ''}`.trim(), parent: pr.change.parent, replaces: pr.id });
  for (const { node } of walk(p.roots)) {
    if (node.kind !== 'protection' || !node.props.circuitName) continue;
    const it = interpretLabel(String(node.props.circuitName));
    if (!it.usages.some((u) => u.kind === 'board')) continue;
    const cable = node.children.find((c) => c.kind === 'cable');
    // Déjà un tableau en aval : alimentation connue
    const below = (n: ElNode): boolean => n.children.some((c) => c.kind === 'board' || below(c));
    if (below(node)) continue;
    out.push({ name: String(node.props.circuitName), parent: { nodeId: cable?.id ?? node.id } });
  }
  return out;
}

/**
 * Propositions de rattachement des sous-tableaux à leur alimentation :
 *  - nom concordant (« Garage » ↔ « Sous-tableau garage ») : une proposition (certitude moyenne) ;
 *  - un seul sous-tableau sans alimentation et une seule alimentation repérée, sans nom concordant : proposition
 *    à certitude basse ;
 *  - sinon rien (l'utilisateur rattache à la main dans l'unifilaire).
 * Jamais deux propositions pour un même sous-tableau.
 */
export function subBoardLinks(project: Project, now = new Date().toISOString()): { proposals: Proposal[]; questions: Question[]; supersede: string[] } {
  const ev = project.evidence;
  const proposals: Proposal[] = [];
  const questions: Question[] = [];
  const supersede: string[] = [];
  const unfed = unfedBoards(project);
  if (!unfed.length) return { proposals, questions, supersede };
  const all = feeds(project);
  const taken = new Set<string>();
  for (const b of unfed) {
    const already = ev?.proposals.some((x) => x.change.op === 'move' && x.change.target.nodeId === b.id && (x.status === 'pending' || x.status === 'accepted'));
    if (already) continue;
    const name = `${b.props.name ?? ''} ${b.location ?? ''}`.trim();
    const free = all.filter((f) => !taken.has(JSON.stringify(f.parent)));
    const named = free.filter((f) => sameBoardName(name, f.name));
    // Sans nom concordant : seulement vers un circuit existant (jamais à la place d'un autre sous-tableau proposé)
    const pick =
      named.length === 1
        ? { f: named[0], confidence: 0.6 }
        : !named.length && free.length === 1 && unfed.length === 1 && !free[0].replaces
          ? { f: free[0], confidence: 0.4 }
          : undefined;
    if (!pick) continue;
    taken.add(JSON.stringify(pick.f.parent));
    const prop: Proposal = {
      id: evidenceId('prp'),
      batch: `link:${now}`,
      purpose: 'reconstruction',
      change: { op: 'move', target: { nodeId: b.id }, newParent: pick.f.parent },
      basis: 'deduced',
      confidence: pick.confidence,
      critical: true,
      observations: [],
      status: 'pending',
      text: { key: 'assist.p.subBoardLink', params: { board: String(b.props.name ?? ''), feed: pick.f.name } },
    };
    proposals.push(prop);
    questions.push({
      id: evidenceId('q'),
      kind: 'confirm',
      about: { nodeId: b.id, prop: '@parent', proposalId: prop.id },
      text: { key: 'assist.q.subBoardLink', params: { board: String(b.props.name ?? ''), feed: pick.f.name } },
      priority: 'high',
      status: 'open',
    });
    if (pick.f.replaces) supersede.push(pick.f.replaces);
  }
  return { proposals, questions, supersede };
}

/** Ajoute au dossier de preuves les propositions de rattachement (même étape d'annulation que l'action appelante). */
export function withSubBoardLinks(project: Project, now = new Date().toISOString()): Project {
  const r = subBoardLinks(project, now);
  if (!r.proposals.length) return project;
  const e = project.evidence ?? emptyEvidence();
  const sup = new Set(r.supersede);
  return {
    ...project,
    evidence: {
      ...e,
      proposals: [...e.proposals.map((p) => (sup.has(p.id) && p.status === 'pending' ? { ...p, status: 'superseded' as const, decidedAt: now } : p)), ...r.proposals],
      questions: [...e.questions, ...r.questions],
    },
  };
}
