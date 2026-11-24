/**
 * Intégrité du modèle : un seul endroit pour nettoyer les références vers des éléments disparus et pour contrôler
 * la cohérence d'un projet (ids dupliqués, références inexistantes, branchements interdits, valeurs invalides).
 *
 * Toutes les données qui référencent un nœud par son id :
 *  - plan.pages[*].symbols[*].nodeId      (position sur le plan)
 *  - boards[boardId]                      (disposition du tableau, clé = id du nœud « tableau »)
 *  - boards[*].slots[nodeId], boards[*].checks[nodeId]
 *  - measurements.rcdTests[nodeId]
 *  - meta.syncedIds[]
 *  - meta.derogations[*].nodeId
 *  - evidence (dossier de preuves de l'assistant) : provenance, propositions, questions (src/assist/evidence.ts)
 * Ajouter ici toute nouvelle référence (et un test dans test/integrity.test.ts).
 */
import { pruneEvidence } from '../assist/evidence';
import { ALLOWED_CHILDREN, PROP_SCHEMAS } from './schema';
import { walk } from './tree';
import type { Project } from './types';

/** Ids de tous les nœuds (arbre et éléments non raccordés). */
export function nodeIds(project: Project): Set<string> {
  const ids = new Set<string>();
  for (const { node } of walk(project.roots)) ids.add(node.id);
  for (const { node } of walk(project.loose ?? [])) ids.add(node.id);
  return ids;
}

const filterKeys = <V>(rec: Record<string, V> | undefined, keep: (k: string) => boolean): Record<string, V> | undefined =>
  rec && Object.fromEntries(Object.entries(rec).filter(([k]) => keep(k)));

/**
 * Retire les références vers des éléments qui n'existent plus. Renvoie le même objet si rien ne change.
 * `alsoDerogations` : retire aussi les dérogations liées à un élément disparu (vrai lors d'une suppression demandée
 * par l'utilisateur ; faux à l'ouverture d'un fichier, où elles sont seulement signalées par validateProject).
 */
export function pruneReferences(project: Project, alsoDerogations = true): Project {
  const ids = nodeIds(project);
  const has = (id: string) => ids.has(id);
  let changed = false;
  const pages = project.plan.pages.map((pg) => {
    const symbols = pg.symbols.filter((s) => has(s.nodeId));
    if (symbols.length === pg.symbols.length) return pg;
    changed = true;
    return { ...pg, symbols };
  });
  let boards = project.boards;
  if (boards) {
    const next: NonNullable<Project['boards']> = {};
    for (const [boardId, layout] of Object.entries(boards)) {
      if (!has(boardId)) {
        changed = true;
        continue;
      }
      // Comparaison par nombre de clés (pas de sérialisation : la disposition contient la photo du tableau)
      const slots = filterKeys(layout.slots, has) ?? {};
      const checks = filterKeys(layout.checks, has);
      const same = Object.keys(slots).length === Object.keys(layout.slots ?? {}).length && Object.keys(checks ?? {}).length === Object.keys(layout.checks ?? {}).length;
      if (same) next[boardId] = layout;
      else {
        changed = true;
        next[boardId] = { ...layout, slots, ...(checks ? { checks } : {}) };
      }
    }
    boards = next;
  }
  const rcdTests = filterKeys(project.measurements.rcdTests, has);
  if (rcdTests && Object.keys(rcdTests).length !== Object.keys(project.measurements.rcdTests ?? {}).length) changed = true;
  const syncedIds = project.meta.syncedIds?.filter(has);
  if (syncedIds && syncedIds.length !== project.meta.syncedIds!.length) changed = true;
  const derogations = alsoDerogations ? project.meta.derogations?.filter((d) => !d.nodeId || has(d.nodeId)) : project.meta.derogations;
  if (derogations && derogations.length !== project.meta.derogations!.length) changed = true;
  // Dossier de preuves de l'assistant : provenances retirées, propositions et questions closes (rien n'est effacé de
  // l'historique ni des sources)
  const evidence = project.evidence ? pruneEvidence(project.evidence, ids) : undefined;
  if (evidence !== project.evidence) changed = true;
  if (!changed) return project;
  return {
    ...project,
    ...(evidence ? { evidence } : {}),
    plan: { ...project.plan, pages },
    boards,
    measurements: rcdTests ? { ...project.measurements, rcdTests } : project.measurements,
    meta: { ...project.meta, ...(syncedIds ? { syncedIds } : {}), ...(derogations ? { derogations } : {}) },
  };
}

export type IssueCode = 'duplicateId' | 'missingRef' | 'invalidChild' | 'invalidValue' | 'notABoard';

export interface Issue {
  code: IssueCode;
  /**
   * « error » : incohérence réelle (id dupliqué, référence absente, valeur d'un mauvais type) ;
   * « notice » : structure inhabituelle mais valide (branchement que la palette ne propose pas, valeur hors liste,
   * fréquents dans les fichiers Trikker réels) : jamais corrigée automatiquement.
   */
  level: 'error' | 'notice';
  nodeId?: string;
  /** Où se trouve la référence ou la valeur (ex. « plan », « boards », « rcdTests », « prop:ratedCurrent »). */
  where?: string;
  detail?: string;
}

/** Contrôle de cohérence complet, sans rien modifier. */
export function validateProject(project: Project): Issue[] {
  const issues: Issue[] = [];
  const seen = new Set<string>();
  const kinds = new Map<string, string>();
  for (const tree of [project.roots, project.loose ?? []])
    for (const { node, parent } of walk(tree)) {
      if (seen.has(node.id)) issues.push({ code: 'duplicateId', level: 'error', nodeId: node.id });
      seen.add(node.id);
      kinds.set(node.id, node.kind);
      if (parent && !ALLOWED_CHILDREN[parent.kind]?.includes(node.kind)) issues.push({ code: 'invalidChild', level: 'notice', nodeId: node.id, detail: `${parent.kind} → ${node.kind}` });
      for (const def of PROP_SCHEMAS[node.kind] ?? []) {
        const v = node.props[def.key];
        if (v === undefined || v === '') continue;
        if (def.type === 'number' && (typeof v !== 'number' || !Number.isFinite(v) || v < 0)) issues.push({ code: 'invalidValue', level: 'error', nodeId: node.id, where: 'prop:' + def.key, detail: String(v) });
        if (def.type === 'enum' && def.options && !def.options.includes(String(v))) issues.push({ code: 'invalidValue', level: 'notice', nodeId: node.id, where: 'prop:' + def.key, detail: String(v) });
        if (def.type === 'bool' && typeof v !== 'boolean') issues.push({ code: 'invalidValue', level: 'error', nodeId: node.id, where: 'prop:' + def.key, detail: String(v) });
      }
    }
  const ref = (id: string, where: string) => {
    if (!seen.has(id)) issues.push({ code: 'missingRef', level: 'error', nodeId: id, where });
  };
  for (const pg of project.plan.pages) for (const s of pg.symbols) ref(s.nodeId, 'plan');
  for (const [boardId, layout] of Object.entries(project.boards ?? {})) {
    ref(boardId, 'boards');
    if (seen.has(boardId) && kinds.get(boardId) !== 'board') issues.push({ code: 'notABoard', level: 'error', nodeId: boardId, where: 'boards' });
    for (const id of Object.keys(layout.slots ?? {})) ref(id, 'boards.slots');
    for (const id of Object.keys(layout.checks ?? {})) ref(id, 'boards.checks');
  }
  for (const id of Object.keys(project.measurements.rcdTests ?? {})) ref(id, 'rcdTests');
  for (const id of project.meta.syncedIds ?? []) ref(id, 'syncedIds');
  for (const d of project.meta.derogations ?? []) if (d.nodeId) ref(d.nodeId, 'derogations');
  return issues;
}
