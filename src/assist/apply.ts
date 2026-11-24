/**
 * Application contrôlée des propositions de l'assistant (code déterministe, testé). L'IA ne passe jamais par ici
 * directement : elle produit des observations, la fusion produit des propositions, l'utilisateur décide.
 *
 * Chaque fonction renvoie un NOUVEAU projet (arbre et dossier de preuves modifiés ensemble) : une seule étape
 * d'annulation (A1).
 */
import type { BoardLayout, ElNode, Project, PropValue } from '../model/types';
import { ALLOWED_CHILDREN } from '../model/schema';
import { ancestors, findNode, insertChild, mapTree, removeNode, uid } from '../model/tree';
import { emptyEvidence, evidenceId, type Basis, type Evidence, type HistoryEntry, type Proposal, type Provenance, type Question } from './evidence';

const ev = (p: Project): Evidence => p.evidence ?? emptyEvidence();

/** Clés temporaires dont dépend une proposition (parent ou cible encore à créer). */
function dependsOn(p: Proposal): string[] {
  const c = p.change;
  const out: string[] = [];
  if (c.op === 'createNode' && 'tempKey' in c.parent) out.push(c.parent.tempKey);
  if ((c.op === 'setProp' || c.op === 'place') && 'tempKey' in c.target) out.push(c.target.tempKey);
  if (c.op === 'move' && 'tempKey' in c.newParent) out.push(c.newParent.tempKey);
  return out;
}

/**
 * Modification d'une proposition par l'utilisateur AVANT de l'accepter (calibre, courbe, usage, pièce,
 * différentiel amont…). La proposition acceptée avec une modification devient « confirmée ».
 *  - props : valeurs remplacées (null : retirée) ;
 *  - kind : type du point d'utilisation (prise, éclairage, appareil…) ;
 *  - location : pièce (null : retirée) ;
 *  - parent : autre parent (ex. un autre différentiel du même tableau).
 */
export interface ProposalEdit {
  props?: Record<string, PropValue | null>;
  kind?: string;
  location?: string | null;
  parent?: { nodeId: string } | { tempKey: string };
}

/**
 * Propositions acceptables « en bloc » : en attente, non critiques, assez sûres, et dont le parent n'attend pas
 * lui-même une décision individuelle (sinon elles le seront après lui). Les autres doivent être vues une par une.
 */
export function bulkAcceptable(e: Evidence | undefined, batch?: string, minConfidence = 0.8): Proposal[] {
  const pending = (e?.proposals ?? []).filter((p) => p.status === 'pending' && (!batch || p.batch === batch));
  const ok = new Set(pending.filter((p) => !p.critical && p.confidence >= minConfidence).map((p) => p.id));
  const createdBy = new Map<string, Proposal>();
  for (const p of pending) if (p.change.op === 'createNode') createdBy.set(p.change.tempKey, p);
  // Exclusion transitive : un enfant d'une proposition à voir individuellement attend aussi
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of pending)
      if (ok.has(p.id) && dependsOn(p).some((k) => createdBy.has(k) && !ok.has(createdBy.get(k)!.id))) {
        ok.delete(p.id);
        changed = true;
      }
  }
  return pending.filter((p) => ok.has(p.id));
}

/** Propositions à voir une par une (critiques, incertaines) ; leurs dépendances suivent quand elles sont acceptées. */
export function needsReview(e: Evidence | undefined): Proposal[] {
  const bulk = new Set(bulkAcceptable(e).map((p) => p.id));
  return (e?.proposals ?? []).filter((p) => p.status === 'pending' && !bulk.has(p.id) && !dependsOn(p).some((k) => (e?.proposals ?? []).some((x) => x.status === 'pending' && x.change.op === 'createNode' && x.change.tempKey === k)));
}

/**
 * Décide un ensemble de propositions. `accept` est appliqué dans l'ordre du dossier (un parent avant ses enfants).
 * `values` : valeur modifiée par l'utilisateur avant acceptation (la base devient alors « confirmée »).
 * `confirm` : propositions vues et validées une par une (base « confirmée ») ; les autres acceptées gardent leur
 * base d'origine (observée, déduite…) et restent signalées comme non confirmées (A3, A6).
 */
export function decide(
  project: Project,
  opts: { accept?: string[]; reject?: string[]; values?: Record<string, PropValue>; confirm?: string[]; edits?: Record<string, ProposalEdit> },
  now = new Date().toISOString(),
): Project {
  const e0 = ev(project);
  const accept = new Set(opts.accept ?? []);
  const reject = new Set(opts.reject ?? []);
  const confirm = new Set(opts.confirm ?? []);
  let roots = project.roots;
  let boards = project.boards;
  const temp = new Map<string, string>(); // tempKey → nodeId (déjà créés)
  for (const p of e0.proposals) if (p.status === 'accepted' && p.createdNodeId && p.change.op === 'createNode') temp.set(p.change.tempKey, p.createdNodeId);
  const resolve = (t: { nodeId: string } | { tempKey: string }) => ('nodeId' in t ? t.nodeId : temp.get(t.tempKey));
  // Parent ou cible encore en attente de décision (et pas accepté maintenant) : la proposition attend aussi
  const waiting = (t: { nodeId: string } | { tempKey: string }) =>
    'tempKey' in t && !temp.has(t.tempKey) && e0.proposals.some((x) => x.status === 'pending' && x.change.op === 'createNode' && x.change.tempKey === t.tempKey && !accept.has(x.id) && !reject.has(x.id));

  const provenance: Provenance[] = [...e0.provenance];
  const history: HistoryEntry[] = [...e0.history];
  const setProv = (nodeId: string, prop: string, basis: Basis, p: Proposal) => {
    const i = provenance.findIndex((x) => x.nodeId === nodeId && x.prop === prop);
    const entry: Provenance = { nodeId, prop, basis, observations: p.observations, confidence: p.confidence, at: now };
    if (i >= 0) provenance[i] = entry;
    else provenance.push(entry);
  };

  const proposals = e0.proposals.map((p): Proposal => {
    if (p.status !== 'pending') return p;
    if (reject.has(p.id)) {
      history.push({ at: now, actor: 'user', action: 'reject', refs: { proposal: p.id, batch: p.batch } });
      return { ...p, status: 'rejected', decidedAt: now };
    }
    if (!accept.has(p.id)) return p;
    const edit = opts.edits?.[p.id];
    const edited = Object.prototype.hasOwnProperty.call(opts.values ?? {}, p.id) || !!edit;
    const basis: Basis = edited || confirm.has(p.id) ? 'confirmed' : p.basis;
    const c = p.change;
    if (c.op === 'createNode') {
      const parentRef = edit?.parent ?? c.parent;
      if (waiting(parentRef)) return p;
      const parentId = resolve(parentRef);
      if (!parentId || !findNode(roots, parentId)) return { ...p, status: 'superseded', decidedAt: now };
      // Uniquement les propriétés observées ou déduites (ou corrigées par l'utilisateur) : AUCUNE valeur par défaut (A2)
      const props: Record<string, PropValue> = { ...c.props };
      for (const [k, v] of Object.entries(edit?.props ?? {})) {
        if (v === null || v === undefined || v === '') delete props[k];
        else props[k] = v;
      }
      const kind = (edit?.kind ?? c.kind) as ElNode['kind'];
      if (kind !== 'appliance') delete props.applianceType;
      const location = edit && 'location' in edit ? (edit.location ?? undefined) : c.location;
      const node: ElNode = { id: uid(), kind, props, children: [], ...(location ? { location } : {}) };
      roots = insertChild(roots, parentId, node);
      temp.set(c.tempKey, node.id);
      setProv(node.id, '@node', basis, p);
      // Raccordement (quel différentiel protège ce circuit) : incertain si la proposition est critique
      setProv(node.id, '@parent', basis === 'confirmed' ? basis : p.critical ? 'deduced' : basis, p);
      for (const k of Object.keys(props)) setProv(node.id, k, basis, p);
      history.push({ at: now, actor: 'user', action: 'accept', refs: { proposal: p.id, nodeId: node.id, batch: p.batch } });
      // Corrections avant acceptation : tracées (valeur proposée → valeur retenue)
      if (edit) {
        for (const k of Object.keys(edit.props ?? {}))
          if (c.props[k] !== props[k]) history.push({ at: now, actor: 'user', action: 'edit', refs: { proposal: p.id, nodeId: node.id, prop: k }, before: c.props[k] ?? null, after: props[k] ?? null });
        if (kind !== c.kind) history.push({ at: now, actor: 'user', action: 'edit', refs: { proposal: p.id, nodeId: node.id, prop: '@kind' }, before: c.kind, after: kind });
        if (location !== c.location) history.push({ at: now, actor: 'user', action: 'edit', refs: { proposal: p.id, nodeId: node.id, prop: '@location' }, before: c.location ?? null, after: location ?? null });
        if (edit.parent && JSON.stringify(edit.parent) !== JSON.stringify(c.parent))
          history.push({ at: now, actor: 'user', action: 'edit', refs: { proposal: p.id, nodeId: node.id, prop: '@parent' }, after: parentId });
      }
      return { ...p, status: 'accepted', decidedAt: now, createdNodeId: node.id };
    }
    if (c.op === 'move') {
      if (waiting(c.newParent)) return p;
      const id = c.target.nodeId;
      const parentId = resolve(c.newParent);
      const target = findNode(roots, id);
      const parent = parentId ? findNode(roots, parentId) : undefined;
      // Jamais de cycle (un nœud sous lui-même ou sous un de ses enfants), jamais un parent interdit
      if (!target || !parent || parent.id === id || ancestors(roots, parent.id).some((a) => a.id === id) || !ALLOWED_CHILDREN[parent.kind]?.includes(target.kind))
        return { ...p, status: 'superseded', decidedAt: now };
      roots = insertChild(removeNode(roots, id), parent.id, target);
      setProv(id, '@parent', basis, p);
      history.push({ at: now, actor: 'user', action: 'accept', refs: { proposal: p.id, nodeId: id, prop: '@parent', batch: p.batch } });
      return { ...p, status: 'accepted', decidedAt: now };
    }
    if (c.op === 'setProp') {
      if (waiting(c.target)) return p;
      const id = resolve(c.target);
      const target = id ? findNode(roots, id) : undefined;
      if (!id || !target) return { ...p, status: 'superseded', decidedAt: now };
      const value = edited ? opts.values![p.id] : c.value;
      const before = target.props[c.prop];
      roots = mapTree(roots, (n) => (n.id === id ? { ...n, props: { ...n.props, [c.prop]: value } } : n));
      setProv(id, c.prop, basis, p);
      history.push({ at: now, actor: 'user', action: 'accept', refs: { proposal: p.id, nodeId: id, prop: c.prop, batch: p.batch }, before: before ?? null, after: value ?? null });
      return { ...p, status: 'accepted', decidedAt: now };
    }
    // place : position dans le tableau
    if (waiting(c.target)) return p;
    const id = resolve(c.target);
    if (!id || !findNode(roots, id)) return { ...p, status: 'superseded', decidedAt: now };
    const layout: BoardLayout = boards?.[c.boardId] ?? { slots: {} };
    boards = { ...(boards ?? {}), [c.boardId]: { ...layout, slots: { ...layout.slots, [id]: { row: c.row, col: c.col } } } };
    history.push({ at: now, actor: 'user', action: 'accept', refs: { proposal: p.id, nodeId: id, batch: p.batch } });
    return { ...p, status: 'accepted', decidedAt: now };
  });

  // Questions qui portaient sur un objet à créer : rattachées au nœud créé (membres d'une question groupée compris)
  const decided = new Map(proposals.filter((p) => p.decidedAt === now && p.status !== 'pending').map((p) => [p.id, p]));
  const questions = e0.questions.map((q0): Question => {
    let q = q0;
    if (q.about.tempKey && temp.has(q.about.tempKey) && !q.about.nodeId) q = { ...q, about: { ...q.about, nodeId: temp.get(q.about.tempKey) } };
    if (q.members?.some((m) => m.tempKey && !m.nodeId && temp.has(m.tempKey)))
      q = { ...q, members: q.members.map((m) => (m.tempKey && !m.nodeId && temp.has(m.tempKey) ? { ...m, nodeId: temp.get(m.tempKey) } : m)) };
    // Question liée à une proposition (raccordement deviné…) : réglée par la décision de l'utilisateur sur celle-ci
    const linked = q.status === 'open' && q.about.proposalId ? decided.get(q.about.proposalId) : undefined;
    if (linked?.status === 'rejected' || linked?.status === 'superseded') q = { ...q, status: 'dismissed', answeredAt: now };
    else if (linked?.status === 'accepted' && (confirm.has(linked.id) || opts.edits?.[linked.id] || Object.prototype.hasOwnProperty.call(opts.values ?? {}, linked.id)))
      q = { ...q, status: 'answered', answer: true, answeredAt: now };
    return q;
  });
  return { ...project, roots, ...(boards ? { boards } : {}), evidence: { ...e0, proposals, questions, provenance, history } };
}

/**
 * Réponse à une question : la valeur est écrite dans l'arbre (si la question vise une propriété d'un nœud existant)
 * et devient « confirmée ». Réponse vide (null) : la question est close sans valeur (« je ne sais pas »), la propriété
 * reste absente.
 */
export function answer(project: Project, questionId: string, value: PropValue | null, now = new Date().toISOString()): Project {
  const e0 = ev(project);
  const q = e0.questions.find((x) => x.id === questionId);
  if (!q || q.status !== 'open') return project;
  let roots = project.roots;
  const provenance = [...e0.provenance];
  const nodeId = q.about.nodeId;
  const pseudo = q.about.prop?.startsWith('@');
  if (pseudo && value === true && nodeId) {
    // Confirmation d'une structure (« ce différentiel protège bien ce circuit ») : aucune valeur écrite dans l'arbre
    const i = provenance.findIndex((x) => x.nodeId === nodeId && x.prop === q.about.prop);
    const entry: Provenance = { nodeId, prop: q.about.prop!, basis: 'confirmed', observations: [], confidence: 1, at: now };
    if (i >= 0) provenance[i] = entry;
    else provenance.push(entry);
  } else if (!pseudo && value !== null && value !== undefined && value !== '' && nodeId && q.about.prop && findNode(roots, nodeId)) {
    roots = mapTree(roots, (n) => (n.id === nodeId ? { ...n, props: { ...n.props, [q.about.prop!]: value } } : n));
    const i = provenance.findIndex((x) => x.nodeId === nodeId && x.prop === q.about.prop);
    const chosen = q.options?.find((o) => o.value === value);
    const entry: Provenance = { nodeId, prop: q.about.prop, basis: 'confirmed', observations: chosen ? chosen.observations : (q.options?.flatMap((o) => o.observations) ?? []), confidence: 1, at: now };
    if (i >= 0) provenance[i] = entry;
    else provenance.push(entry);
  }
  const questions = e0.questions.map((x) =>
    x.id === questionId ? { ...x, status: value === null ? ('dismissed' as const) : ('answered' as const), answer: value ?? undefined, answeredAt: now } : x,
  );
  const history: HistoryEntry[] = [...e0.history, { at: now, actor: 'user', action: value === null ? 'dismiss' : 'answer', refs: { question: questionId, nodeId, prop: q.about.prop }, after: value ?? null }];
  return { ...project, roots, evidence: { ...e0, questions, provenance, history } };
}

/**
 * Réponse à « Qu'alimente ce circuit ? » : câble (déjà créé, sinon créé) et point d'utilisation choisi, confirmés par
 * l'utilisateur. Rien n'est créé si la protection n'existe pas (proposition non acceptée).
 */
export function answerUsage(
  project: Project,
  questionId: string,
  usage: { kind: 'socket' | 'light' | 'appliance' | 'other'; applianceType?: string; room?: string } | null,
  now = new Date().toISOString(),
): Project {
  const e0 = ev(project);
  const q = e0.questions.find((x) => x.id === questionId);
  const protId = q?.about.nodeId;
  if (!q || q.status !== 'open' || !protId) return project;
  if (!usage) return answer(project, questionId, null, now);
  const prot = findNode(project.roots, protId);
  if (!prot) return project;
  let roots = project.roots;
  let cable = prot.children.find((c) => c.kind === 'cable');
  if (!cable) {
    cable = { id: uid(), kind: 'cable', props: {}, children: [] };
    roots = insertChild(roots, protId, cable);
  }
  const load: ElNode = {
    id: uid(),
    kind: usage.kind,
    props: usage.kind === 'appliance' ? { applianceType: usage.applianceType ?? 'other' } : {},
    children: [],
    ...(usage.room ? { location: usage.room } : {}),
  };
  roots = insertChild(roots, cable.id, load);
  const provenance: Provenance[] = [...e0.provenance, { nodeId: load.id, prop: '@node', basis: 'confirmed', observations: [], confidence: 1, at: now }];
  const questions = e0.questions.map((x) => (x.id === questionId ? { ...x, status: 'answered' as const, answer: usage.applianceType ?? usage.kind, answeredAt: now } : x));
  const history: HistoryEntry[] = [...e0.history, { at: now, actor: 'user', action: 'answer', refs: { question: questionId, nodeId: load.id }, after: usage.applianceType ?? usage.kind }];
  return { ...project, roots, evidence: { ...e0, provenance, questions, history } };
}

/** L'utilisateur confirme qu'une valeur issue de l'assistant est exacte (vérifiée sur place). */
export function confirmValue(project: Project, nodeId: string, prop: string, now = new Date().toISOString()): Project {
  const e0 = ev(project);
  const provenance = e0.provenance.map((p) => (p.nodeId === nodeId && p.prop === prop ? { ...p, basis: 'confirmed' as const, at: now } : p));
  return { ...project, evidence: { ...e0, provenance, history: [...e0.history, { at: now, actor: 'user', action: 'edit', refs: { nodeId, prop }, note: 'confirmé' }] } };
}

/**
 * Correction manuelle d'une valeur dont la provenance est connue (erreur de relevé corrigée ensuite, A4) : la
 * provenance devient « manuelle » et l'historique garde l'ancienne et la nouvelle valeur. Sans provenance (valeur
 * saisie à la main dès le départ), rien n'est ajouté : le projet reste léger.
 */
export function noteManualEdit(project: Project, nodeId: string, patch: Record<string, PropValue>, before: Record<string, PropValue>, now = new Date().toISOString()): Project {
  const e0 = project.evidence;
  if (!e0) return project;
  const touched = Object.keys(patch).filter((k) => e0.provenance.some((p) => p.nodeId === nodeId && p.prop === k) && patch[k] !== before[k]);
  if (!touched.length) return project;
  const provenance = e0.provenance.map((p) => (p.nodeId === nodeId && touched.includes(p.prop) ? { ...p, basis: 'manual' as const, at: now } : p));
  const history: HistoryEntry[] = [...e0.history, ...touched.map((k): HistoryEntry => ({ at: now, actor: 'user', action: 'edit', refs: { nodeId, prop: k }, before: before[k] ?? null, after: patch[k] ?? null }))];
  return { ...project, evidence: { ...e0, provenance, history } };
}

/**
 * Fige le relevé de l'installation existante (A4) : révision datée « Relevé du … » ajoutée au dossier, et entrée
 * « snapshot » dans l'historique. Ce n'est PAS une certification : seulement l'état tel que relevé à cette date ; il
 * reste corrigeable ensuite (corrections tracées par noteManualEdit).
 */
export function snapshotSurvey(project: Project, description: string, now = new Date().toISOString()): Project {
  const revs = project.meta.revisions ?? [];
  const version = String(revs.length + 1);
  const e0 = ev(project);
  return {
    ...project,
    meta: { ...project.meta, revisions: [...revs, { version, date: now.slice(0, 10), description }] },
    evidence: { ...e0, history: [...e0.history, { at: now, actor: 'user', action: 'snapshot', refs: {}, note: `révision ${version}` }] },
  };
}

/** Vrai si un relevé a déjà été figé. */
export const surveyFrozen = (p: Project) => !!p.evidence?.history.some((h) => h.action === 'snapshot');

/** Valeurs de l'arbre issues de l'assistant et pas encore confirmées par l'utilisateur. */
export function unconfirmed(project: Project): Provenance[] {
  return (project.evidence?.provenance ?? []).filter((p) => p.basis !== 'confirmed' && p.basis !== 'manual' && p.prop !== '@node');
}

// ---------------------------------------------------------------------------
// Questions groupées, report « à vérifier plus tard »
// ---------------------------------------------------------------------------

/** Membres d'une question groupée qui existent dans l'arbre. */
const liveMembers = (project: Project, q: Question) => (q.members ?? []).filter((m) => m.nodeId && findNode(project.roots, m.nodeId));

/**
 * Une question groupée est prête quand chacun de ses objets existe dans l'arbre ou ne sera jamais créé (proposition
 * refusée ou remplacée). Une question simple : quand son objet existe (ou qu'elle ne vise pas d'objet à créer).
 */
export function questionReady(project: Project, q: Question): boolean {
  if (!q.members) return !!q.about.nodeId || !q.about.tempKey;
  const pending = new Set((project.evidence?.proposals ?? []).filter((p) => p.status === 'pending' && p.change.op === 'createNode').map((p) => (p.change.op === 'createNode' ? p.change.tempKey : '')));
  return q.members.every((m) => m.nodeId || !m.tempKey || !pending.has(m.tempKey)) && liveMembers(project, q).length > 0;
}

/**
 * Réponse à une question groupée (« 2,5 mm² pour tous les circuits de prises ? ») : la valeur est écrite sur chaque
 * objet existant, confirmée. `null` : « je ne sais pas » pour tous (rien n'est écrit).
 */
export function answerGroup(project: Project, questionId: string, value: PropValue | null, now = new Date().toISOString()): Project {
  const e0 = ev(project);
  const q = e0.questions.find((x) => x.id === questionId);
  if (!q || q.status !== 'open' || !q.members || !q.about.prop) return project;
  if (value === null || value === undefined || value === '') return answer(project, questionId, null, now);
  const ids = new Set(liveMembers(project, q).map((m) => m.nodeId!));
  const prop = q.about.prop;
  const roots = mapTree(project.roots, (n) => (ids.has(n.id) ? { ...n, props: { ...n.props, [prop]: value } } : n));
  const provenance = e0.provenance.filter((x) => !(ids.has(x.nodeId) && x.prop === prop));
  for (const id of ids) provenance.push({ nodeId: id, prop, basis: 'confirmed', observations: [], confidence: 1, at: now });
  const questions = e0.questions.map((x) => (x.id === questionId ? { ...x, status: 'answered' as const, answer: value, answeredAt: now } : x));
  const history: HistoryEntry[] = [...e0.history, ...[...ids].map((id): HistoryEntry => ({ at: now, actor: 'user', action: 'answer', refs: { question: questionId, nodeId: id, prop }, after: value }))];
  return { ...project, roots, evidence: { ...e0, questions, provenance, history } };
}

/** « Chacun séparément » : la question groupée est remplacée par une question par objet. */
export function splitGroup(project: Project, questionId: string, textKey = 'assist.q.section'): Project {
  const e0 = ev(project);
  const q = e0.questions.find((x) => x.id === questionId);
  if (!q || q.status !== 'open' || !q.members) return project;
  const singles: Question[] = q.members.map((m) => ({
    id: evidenceId('q'),
    kind: 'unknown',
    about: { nodeId: m.nodeId, tempKey: m.tempKey, prop: q.about.prop },
    text: { key: textKey, params: { label: m.label ?? '' } },
    priority: q.priority,
    status: 'open',
  }));
  const questions = [...e0.questions.map((x) => (x.id === questionId ? { ...x, status: 'dismissed' as const, answeredAt: new Date().toISOString() } : x)), ...singles];
  return { ...project, evidence: { ...e0, questions } };
}

/**
 * « Tout à vérifier plus tard » : les questions ouvertes sont mises de côté (toujours ouvertes, rien n'est écrit) ;
 * les valeurs restent inconnues et le contrôle les signale. `resume` les fait revenir.
 */
export function deferQuestions(project: Project, resume = false, now = new Date().toISOString()): Project {
  const e0 = ev(project);
  let n = 0;
  const questions = e0.questions.map((q) => {
    if (q.status !== 'open' || !!q.deferred === !resume) return q;
    n++;
    return { ...q, deferred: !resume || undefined };
  });
  if (!n) return project;
  const history: HistoryEntry[] = [...e0.history, { at: now, actor: 'user', action: 'dismiss', refs: {}, note: `${resume ? 'reprise' : 'report'} de ${n} question(s)` }];
  return { ...project, evidence: { ...e0, questions, history } };
}
