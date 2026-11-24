/**
 * Valeurs non confirmées ayant une incidence sur le contrôle (A6).
 *
 * Le moteur RGIE ne lit jamais le dossier de preuves : il contrôle l'arbre tel qu'il est. Ici, après coup :
 *  - chaque élément dont une valeur utile au contrôle vient de l'assistant (photo, document, déduction) sans avoir été
 *    confirmée reçoit un constat « R-UNCONFIRMED » (vérification manuelle, jamais bloquant) ;
 *  - les constats du référentiel portant sur cet élément sont marqués « déduits » : résultat à confirmer.
 * Ces signalements apparaissent dans le contrôle et dans le dossier, même si la partie « Sources et hypothèses »
 * détaillée n'est pas imprimée.
 */
import type { Project } from '../model/types';
import type { Finding } from '../rules/types';
import { unconfirmed } from './apply';

/** Propriétés qui influencent le contrôle réglementaire ou les calculs. */
export const REGULATORY_PROPS = new Set([
  'device',
  'ratedCurrent',
  'curve',
  'poles',
  'breakingCapacity',
  'residualCurrent',
  'rcdType',
  'section',
  'material',
  'cableType',
  'conductors',
  'length',
  'earth',
  'childSafety',
  'threePhase',
  'wetRoom',
  'power',
  'applianceType',
  '@parent',
]);

/** Propriétés non confirmées par élément (seulement celles qui comptent pour le contrôle). */
export function unconfirmedByNode(project: Project): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const p of unconfirmed(project)) {
    if (!REGULATORY_PROPS.has(p.prop)) continue;
    out.set(p.nodeId, [...(out.get(p.nodeId) ?? []), p.prop]);
  }
  return out;
}

/** Ajoute les signalements et marque les constats concernés. Sans dossier de preuves : inchangé. */
export function withUnconfirmed(project: Project, findings: Finding[]): Finding[] {
  if (!project.evidence) return findings;
  const map = unconfirmedByNode(project);
  if (!map.size) return findings;
  const marked = findings.map((f) => (f.nodeId && map.has(f.nodeId) && !f.inferred ? { ...f, inferred: true } : f));
  const extra: Finding[] = [...map].map(([nodeId, props]) => ({
    ruleId: 'R-UNCONFIRMED',
    severity: 'info',
    status: 'manualCheck',
    hazard: 'none',
    blocking: false,
    nodeId,
    params: { props: props.join(', ') },
  }));
  return [...marked, ...extra];
}
