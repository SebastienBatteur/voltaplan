/**
 * Registre des référentiels. Pour ajouter un pays : créer src/rules/<pays>/… qui exporte un RulePack,
 * puis l'ajouter ici. Rien d'autre à modifier.
 */
import type { Project } from '../model/types';
import { walk } from '../model/tree';
import { addMessages, type Lang } from '../i18n';
import { belgium } from './be/rgie';
import type { Finding, RulePack, Severity } from './types';

export type { Finding, RulePack, Severity } from './types';

export const RULE_PACKS: RulePack[] = [belgium];
export const DEFAULT_RULE_PACK = belgium.id;

for (const p of RULE_PACKS) if (p.messages) addMessages(p.messages);

export function getRulePack(id: string | undefined): RulePack {
  return RULE_PACKS.find((p) => p.id === id) ?? belgium;
}

export function packLabel(p: RulePack, lang: Lang): string {
  return p.label[lang] ?? p.label.en ?? p.label.fr ?? p.id;
}

/** Contrôle du projet selon son référentiel (Belgique par défaut). */
export function checkProject(project: Project): Finding[] {
  const pack = getRulePack(project.meta.ruleset);
  return [...pack.check(project), ...countryOptionFindings(project, pack)];
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
        out.push({ ruleId: 'R-COUNTRY-OPTION', severity: 'warning', nodeId: node.id, params: { prop: key, value: String(v), country: pack.country } });
    }
  return out;
}

export function isBlocking(findings: Finding[]): boolean {
  return findings.some((f) => f.severity === 'error');
}

/** Pour les tests et le rapport : nombre de constats par sévérité. */
export function summarize(findings: Finding[]): Record<Severity, number> {
  const s: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const f of findings) s[f.severity]++;
  return s;
}
