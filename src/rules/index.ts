/**
 * Registre des référentiels. Pour ajouter un pays : créer src/rules/<pays>/… qui exporte un RulePack,
 * puis l'ajouter ici. Rien d'autre à modifier.
 */
import type { Project } from '../model/types';
import { walk } from '../model/tree';
import { addMessages, type Lang } from '../i18n';
import { belgium } from './be/rgie';
import type { Finding, RulePack, Severity } from './types';
import { classify, partContext, projectContext } from './context';
import { ancestors } from '../model/tree';
import { withUnconfirmed } from '../assist/unconfirmed';

export type { Derogation, Edition, Finding, FindingStatus, Hazard, Knowledge, Requirement, RuleMeta, RulePack, Severity, SurveyFact } from './types';
export { severityOf } from './context';
export { DRAFT_KEYS, draftLevel, isDocumentary, isPhysicalNonCompliance, needsVerification, presence, surveyStatement, SURVEY_FACTS, type DraftLevel } from './knowledge';

export const RULE_PACKS: RulePack[] = [belgium];
export const DEFAULT_RULE_PACK = belgium.id;

for (const p of RULE_PACKS) if (p.messages) addMessages(p.messages);

/** Référentiel du projet : absent = Belgique (défaut historique) ; inconnu = undefined (jamais de repli silencieux). */
export function findRulePack(id: string | undefined): RulePack | undefined {
  return RULE_PACKS.find((p) => p.id === (id || DEFAULT_RULE_PACK));
}

/**
 * Référentiel pour l'affichage (listes de choix, libellés). Un id inconnu retombe sur la Belgique pour l'interface
 * seulement : le contrôle (checkProject) signale, lui, le référentiel inconnu et n'applique aucune règle.
 */
export function getRulePack(id: string | undefined): RulePack {
  return findRulePack(id) ?? belgium;
}

export function packLabel(p: RulePack, lang: Lang): string {
  return p.label[lang] ?? p.label.en ?? p.label.fr ?? p.id;
}

/** Contrôle du projet selon son référentiel (Belgique par défaut). */
export function checkProject(project: Project): Finding[] {
  const pack = findRulePack(project.meta.ruleset);
  if (!pack)
    // Aucune règle évaluée : « Règle non évaluée », bloquant (jamais présenté comme une non-conformité de l'installation).
    return [{ ruleId: 'R-RULESET-UNKNOWN', severity: 'error', status: 'notEvaluated', blocking: true, hazard: 'none', params: { id: String(project.meta.ruleset) } }];
  // Un référentiel tiers qui ne fournit que la sévérité reste accepté : le statut en est déduit.
  const own = pack.check(project).map((f) => (f.status ? f : { ...f, status: f.severity === 'error' ? 'nonCompliant' : f.severity === 'warning' ? 'warning' : 'recommendation', blocking: f.severity === 'error' } as Finding));
  // Valeurs reprises par l'assistant et non confirmées : signalées, et constats concernés marqués « déduits » (A6)
  return withUnconfirmed(project, [...own, ...countryOptionFindings(project, pack)]);
}

/**
 * Valeurs qui n'existent pas dans le pays du référentiel (ex. un câble « VOB » belge dans un projet
 * néerlandais) : désignations et matériel ne sont pas interchangeables d'un pays à l'autre.
 * Ne s'applique qu'aux listes que le référentiel définit lui-même (RulePack.options).
 */
export function countryOptionFindings(project: Project, pack: RulePack): Finding[] {
  const opts = pack.options;
  if (!opts) return [];
  const out: Finding[] = [];
  for (const { node } of walk(project.roots))
    for (const [key, allowed] of Object.entries(opts)) {
      const v = node.props[key];
      if (allowed && v !== undefined && v !== '' && !allowed.includes(String(v)))
        out.push(
          classify(
            { ruleId: 'R-COUNTRY-OPTION', nodeId: node.id, params: { prop: key, value: String(v), country: pack.country } },
            pack.rules?.['R-COUNTRY-OPTION'] ?? { id: 'R-COUNTRY-OPTION', kind: 'warning', hazard: 'none' },
            partContext(project, pack, [...ancestors(project.roots, node.id), node]),
            project.meta?.derogations,
          ),
        );
    }
  return out;
}

export function isBlocking(findings: Finding[]): boolean {
  return findings.some((f) => f.blocking ?? f.severity === 'error');
}

export { projectContext };

/** Pour les tests et le rapport : nombre de constats par sévérité. */
export function summarize(findings: Finding[]): Record<Severity, number> {
  const s: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const f of findings) s[f.severity]++;
  return s;
}
