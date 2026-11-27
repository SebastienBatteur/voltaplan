/**
 * Projet d'installation EXISTANTE pour l'assistant : origine, compteur et tableau seulement. Contrairement au modèle
 * de projet neuf, aucune protection générale n'est posée d'office (son calibre et sa sensibilité seraient inventés) :
 * elle sera lue sur la photo ou demandée.
 */
import type { Project } from '../model/types';
import { emptyProject, walk } from '../model/tree';
import { emptyEvidence } from './evidence';

export function newExistingProject(title: string): Project {
  const p = emptyProject();
  const meter = p.roots[0].children[0];
  const board = [...walk(p.roots)].find((x) => x.node.kind === 'board')!.node;
  meter.children = [{ ...board, props: { name: board.props.name }, children: [] }];
  return {
    ...p,
    // Pas d'édition supposée : sans date, les règles qui en dépendent posent la question (jamais de dérogation silencieuse).
    meta: { ...p.meta, title, installationKind: 'existing' },
    evidence: emptyEvidence(),
  };
}

/** Tableau principal du projet (premier nœud « tableau »). */
export function mainBoardId(p: Project): string | undefined {
  return [...walk(p.roots)].find((x) => x.node.kind === 'board')?.node.id;
}
