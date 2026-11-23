import { useMemo } from 'react';
import { useStore } from '../store';
import { chainIds, computeNumbering, findNode } from '../model/tree';
import { checkProject, type Finding } from '../rules';
import { makeLabelFn } from './labels';
import type { ElNode } from '../model/types';

/** Données calculées à partir du projet (numérotation, contrôles RGIE…), mémorisées. */
export function useDerived() {
  const project = useStore((s) => s.project);
  const lang = useStore((s) => s.lang);
  const t = useStore((s) => s.t);
  return useMemo(() => {
    const numbering = computeNumbering(project.roots);
    const findings = checkProject(project);
    const byNode = new Map<string, Finding[]>();
    for (const f of findings) if (f.nodeId) byNode.set(f.nodeId, [...(byNode.get(f.nodeId) ?? []), f]);
    const labelFn = makeLabelFn(project, numbering, lang, t);
    const find = (id: string): ElNode | undefined => findNode(project.roots, id) ?? findNode(project.loose, id);
    return { numbering, findings, byNode, labelFn, find };
  }, [project, lang, t]);
}

/** Chaîne de l'élément sélectionné (amont jusqu'à l'origine + tout l'aval), pour la mise en évidence. */
export function useChain(): Set<string> {
  const roots = useStore((s) => s.project.roots);
  const selectedId = useStore((s) => s.selectedId);
  return useMemo(() => chainIds(roots, selectedId), [roots, selectedId]);
}
