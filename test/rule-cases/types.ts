/**
 * Cas de test fonctionnels par règle du moteur (couverture vérifiée par test/rules.cases.test.ts). Un cas construit un
 * projet et dit ce que la règle doit produire : rien (`silent`), ou un constat avec ce statut / caractère bloquant.
 */
import type { Project } from '../../src/model/types';
import type { FindingStatus } from '../../src/rules/types';

export type CaseKind = 'compliant' | 'nonCompliant' | 'boundary' | 'exception' | 'transitional' | 'missingData' | 'notApplicable';

export interface RuleCase {
  rule: string;
  kind: CaseKind;
  title: string;
  build: () => Project;
  /** `silent` : aucun constat de cette règle ; sinon, le constat attendu (premier constat de la règle). */
  expect: 'silent' | { status: FindingStatus; blocking?: boolean; params?: Record<string, string | number> };
  /**
   * Anomalie connue du moteur que ce cas met en évidence (le cas décrit le comportement attendu, pas l'actuel) : le cas
   * est alors exécuté comme « doit échouer » et listé dans le rapport. À corriger, puis retirer ce champ.
   */
  knownIssue?: string;
  /** Pour un cas impossible à construire avec le modèle actuel : la raison (limite documentée, pas de test exécuté). */
  notModelled?: string;
}
