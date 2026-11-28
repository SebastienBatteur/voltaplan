/**
 * Provenance historique inconnue (ADR-0010, décision 2).
 *
 * Un projet enregistré avant le suivi de la provenance ne dit pas d'où viennent ses valeurs : saisies sur place,
 * reprises d'un document ou laissées telles que le modèle les proposait. À l'ouverture, chaque valeur utile au
 * contrôle d'un élément de RELEVÉ (partie existante), sans entrée de provenance, est inscrite dans
 * `evidence.historic` (origine « historique inconnue »), quelle que soit sa valeur (égale ou non au défaut). Aucune
 * valeur n'est modifiée ni promue en « confirmée ».
 *
 * Les éléments de conception (partie neuve) ne sont pas concernés : une valeur par défaut y est un choix.
 * Le marqueur `meta.provenanceSince` (date de début du suivi) évite de refaire l'opération : un projet créé par cette
 * version le porte dès sa création.
 */
import type { ElNode, Project } from '../model/types';
import { emptyEvidence, type HistoricValue } from './evidence';
import { REGULATORY_PROPS } from './unconfirmed';

/** Propriétés dont l'origine est suivie (celles qui comptent pour le contrôle ou les calculs). Calculé à l'appel : les
 * modules du moteur et de la migration s'importent mutuellement. */
const tracked = () => [...REGULATORY_PROPS].filter((k) => !k.startsWith('@'));

/**
 * Marque les valeurs historiques d'un projet sans marqueur de suivi. `isSurvey(chaîne)` : l'élément (dernier de la
 * chaîne) appartient-il à une partie existante ? Renvoie le projet inchangé s'il porte déjà le marqueur.
 */
export function markHistoric(project: Project, isSurvey: (chain: ElNode[]) => boolean, now = new Date().toISOString()): { project: Project; marked: number } {
  if (project.meta.provenanceSince) return { project, marked: 0 };
  const known = new Set([...(project.evidence?.provenance ?? []), ...(project.evidence?.historic ?? [])].map((p) => p.nodeId + '|' + p.prop));
  const added: HistoricValue[] = [];
  const props = tracked();
  const visit = (nodes: ElNode[], chain: ElNode[]) => {
    for (const node of nodes) {
      const c = [...chain, node];
      if (isSurvey(c))
        for (const prop of props) {
          const v = node.props[prop];
          if (v === undefined || v === '' || known.has(node.id + '|' + prop)) continue;
          added.push({ nodeId: node.id, prop });
        }
      visit(node.children, c);
    }
  };
  visit(project.roots, []);
  const meta = { ...project.meta, provenanceSince: now };
  if (!added.length) return { project: { ...project, meta }, marked: 0 };
  const e0 = project.evidence ?? emptyEvidence();
  return { project: { ...project, meta, evidence: { ...e0, historic: [...(e0.historic ?? []), ...added] } }, marked: added.length };
}

/** Valeurs historiques non confirmées, par élément, limitées aux éléments donnés (parties existantes). */
export function historicByNode(project: Project, among: Set<string>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const p of project.evidence?.historic ?? []) {
    if (!among.has(p.nodeId)) continue;
    out.set(p.nodeId, [...(out.get(p.nodeId) ?? []), p.prop]);
  }
  return out;
}

/** Le projet a-t-il des valeurs historiques non confirmées ? (évite de parcourir l'arbre sinon) */
export const hasHistoric = (project: Project) => !!project.evidence?.historic?.length;
