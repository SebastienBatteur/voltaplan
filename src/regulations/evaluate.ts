/**
 * Résultat par exigence du registre (et non plus seulement par constat) : distingue une exigence satisfaite d'une
 * exigence non applicable, et de celle qu'on ne peut pas évaluer faute de données. Règles :
 *  - une absence d'information n'est jamais une conformité (données manquantes → `insufficientData`) ;
 *  - une exigence non applicable n'est pas comptée comme satisfaite ;
 *  - une interprétation incertaine (nature `needsExpert`, ou constat « à vérifier ») n'est jamais une non-conformité
 *    certaine (`toVerify`).
 * Les constats (Finding) restent produits par le moteur, inchangés : cette couche les résume sans rien modifier aux
 * projets ni aux exports existants.
 */
import type { Project } from '../model/types';
import type { Finding } from '../rules/types';
import type { RegRequirement } from './types';

export type Outcome = 'satisfied' | 'notSatisfied' | 'notApplicable' | 'insufficientData' | 'toVerify' | 'recommendation';

export interface RequirementResult {
  id: string;
  outcome: Outcome;
  /** Constats du moteur à l'origine du résultat (vide si aucun). */
  findings: Finding[];
  /** Raison courte (code) : `finding`, `notApplicable`, `missingData`, `expert`, `derogation`. */
  reason: 'finding' | 'notApplicable' | 'missingData' | 'expert' | 'derogation' | 'none';
}

/** Applicabilité et disponibilité des données d'une exigence pour un projet (be/applicability.ts). */
export interface ApplicabilityCheck {
  /** L'exigence s'applique-t-elle à ce projet ? `unknown` : impossible à dire avec les données. */
  applies: (p: Project) => 'yes' | 'no' | 'unknown';
  /** Les données nécessaires à l'évaluation sont-elles présentes (quand elle s'applique) ? */
  hasData: (p: Project) => boolean;
}

/** Ordre de priorité des constats : le plus sévère décide du résultat. */
function fromFindings(fs: Finding[]): { outcome: Outcome; reason: RequirementResult['reason'] } | undefined {
  if (!fs.length) return undefined;
  const st = (s: string) => fs.some((f) => f.status === s);
  if (st('nonCompliant')) return { outcome: 'notSatisfied', reason: 'finding' };
  if (st('insufficientData') || st('notEvaluated') || fs.some((f) => f.knowledge === 'unknown')) return { outcome: 'insufficientData', reason: 'finding' };
  if (st('manualCheck') || st('potential') || st('contradictory') || st('warning')) return { outcome: 'toVerify', reason: 'finding' };
  if (st('recommendation')) return { outcome: 'recommendation', reason: 'finding' };
  if (st('derogation')) return { outcome: 'notApplicable', reason: 'derogation' };
  if (st('notApplicable')) return { outcome: 'notApplicable', reason: 'notApplicable' };
  return { outcome: 'toVerify', reason: 'finding' };
}

export function evaluateRequirements(
  project: Project,
  findings: Finding[],
  requirements: RegRequirement[],
  checks: Record<string, ApplicabilityCheck>,
): RequirementResult[] {
  return requirements
    .filter((r) => r.rules.length > 0)
    .map((r): RequirementResult => {
      const fs = findings.filter((f) => r.rules.includes(f.ruleId));
      const byFinding = fromFindings(fs);
      if (byFinding) return { id: r.id, findings: fs, ...byFinding };
      const c = checks[r.id];
      // Sans contrôle d'applicabilité déclaré, on ne conclut pas (jamais « satisfait » par défaut).
      if (!c) return { id: r.id, outcome: 'insufficientData', findings: fs, reason: 'missingData' };
      const applies = c.applies(project);
      if (applies === 'no') return { id: r.id, outcome: 'notApplicable', findings: fs, reason: 'notApplicable' };
      if (applies === 'unknown' || !c.hasData(project)) return { id: r.id, outcome: 'insufficientData', findings: fs, reason: 'missingData' };
      // Interprétation à confirmer : jamais « satisfaite » sans avis d'expert.
      if (r.nature === 'needsExpert') return { id: r.id, outcome: 'toVerify', findings: fs, reason: 'expert' };
      return { id: r.id, outcome: 'satisfied', findings: fs, reason: 'none' };
    });
}

/** Compte par résultat (résumé du contrôle). */
export function summarize(results: RequirementResult[]): Record<Outcome, number> {
  const out: Record<Outcome, number> = { satisfied: 0, notSatisfied: 0, notApplicable: 0, insufficientData: 0, toVerify: 0, recommendation: 0 };
  for (const r of results) out[r.outcome]++;
  return out;
}
