/**
 * Point d'entrée du registre réglementaire (ADR-0009) : exigences, valeurs, dérogations, résultat par exigence.
 */
import type { Project } from '../model/types';
import { checkProject } from '../rules';
import type { Finding } from '../rules/types';
import { CHECKS } from './be/applicability';
import { REQUIREMENTS } from './be/requirements';
import { evaluateRequirements, type RequirementResult } from './evaluate';

export { REQUIREMENTS } from './be/requirements';
export { SOURCES, RGIE_L1_V07, REGISTRY_REVIEWED_ON } from './be/source';
export { DEROGATIONS } from './be/derogations';
export { summarize, type Outcome, type RequirementResult } from './evaluate';
export type { RegRequirement, RequirementNature, DocValidation, HumanValidation } from './types';

/** Exigence du registre qui porte une règle du moteur. */
export function requirementOfRule(ruleId: string) {
  return REQUIREMENTS.find((r) => r.rules.includes(ruleId));
}

/** Résultat par exigence pour un projet (Belgique). Les constats peuvent être fournis s'ils sont déjà calculés. */
export function evaluateProject(project: Project, findings: Finding[] = checkProject(project)): RequirementResult[] {
  return evaluateRequirements(project, findings, REQUIREMENTS, CHECKS);
}
