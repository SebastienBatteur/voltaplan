/**
 * États de connaissance et nature des exigences (ADR-0007) : « inconnu ≠ absent ».
 *
 * Sources de vérité, dans l'ordre :
 *  1. l'arbre : un élément dessiné est présent (dans le dessin) ;
 *  2. les déclarations explicites de l'utilisateur : `meta.survey` (« present » / « absent ») pour les faits qu'on ne
 *     dessine pas forcément (prise de terre, différentiel général, différentiel 30 mA), et les valeurs explicites
 *     des propriétés (ex. prise `earth: false` = absence déclarée) ;
 *  3. le dossier de preuves de l'assistant (provenance non confirmée → « déduit », question « contradiction »
 *     ouverte → « contradictoire ») : appliqué après coup par src/assist/unconfirmed.ts.
 *
 * Non dessiné :
 *  - installation NEUVE en conception (partie neuve sous l'édition en vigueur) : le dessin est la référence, un
 *    élément non dessiné est absent du projet → la règle reste une non-conformité ;
 *  - installation EXISTANTE (relevé) : non dessiné = inconnu, sauf absence confirmée → « Informations
 *    insuffisantes », plus une question pour l'assistant.
 */
import type { Project } from '../model/types';
import type { Finding, Knowledge, SurveyFact } from './types';

export const SURVEY_FACTS: SurveyFact[] = ['earth', 'rcd', 'rcd30'];

/** Déclaration explicite de l'utilisateur pour un fait du relevé (undefined = rien de déclaré). */
export function surveyStatement(project: Project, fact: SurveyFact): 'present' | 'absent' | undefined {
  const v = project.meta?.survey?.[fact];
  return v === 'present' || v === 'absent' ? v : undefined;
}

/**
 * Présence d'un équipement selon le dessin, la déclaration et le contexte.
 * @param drawn  l'équipement est dessiné dans l'arbre
 * @param stated déclaration explicite (meta.survey)
 * @param design la partie est une installation neuve en conception : le dessin est la référence
 */
export function presence(drawn: boolean, stated: 'present' | 'absent' | undefined, design: boolean): Knowledge {
  if (drawn) return stated === 'absent' ? 'contradictory' : 'present';
  if (stated) return stated;
  return design ? 'absent' : 'unknown';
}

/** Le constat porte-t-il sur une exigence documentaire ? (physique par défaut) */
export function isDocumentary(f: Finding): boolean {
  return f.requirement === 'documentary';
}

/** Le constat établit-il une non-conformité de l'installation (exigence physique, données connues ou absence confirmée) ? */
export function isPhysicalNonCompliance(f: Finding): boolean {
  return !isDocumentary(f) && f.status === 'nonCompliant';
}

/** Le constat demande-t-il une information ou une vérification avant de conclure ? */
export function needsVerification(f: Finding): boolean {
  return (
    !isDocumentary(f) &&
    (f.status === 'insufficientData' || f.status === 'potential' || f.status === 'contradictory' || f.knowledge === 'measureNeeded' || f.knowledge === 'unknown')
  );
}

/**
 * Mention portée par le dossier imprimé (réception ou complet) :
 *  - `nonCompliant` : au moins une non-conformité physique bloquante → « PROJET — NON-CONFORMITÉS À TRAITER » ;
 *  - `pending`      : sinon, au moins une information physique inconnue, déduite, contradictoire ou à mesurer
 *                     (ou une information manquante bloquante) → « PROJET — VÉRIFICATIONS À FAIRE » ;
 *  - `incomplete`   : sinon, au moins une exigence documentaire bloquante → « PROJET — DOSSIER INCOMPLET » ;
 *  - `none`         : aucune mention.
 * Le document de travail et le rapport d'anomalies ne portent jamais ces mentions (« Document de travail »).
 * Une lacune documentaire ou une inconnue ne fait jamais apparaître « non conforme ».
 */
export type DraftLevel = 'none' | 'nonCompliant' | 'pending' | 'incomplete';

/** Clé de traduction de la mention en filigrane, par niveau. */
export const DRAFT_KEYS: Record<Exclude<DraftLevel, 'none'>, string> = {
  nonCompliant: 'print.draft',
  pending: 'print.draftPending',
  incomplete: 'print.draftIncomplete',
};

export function draftLevel(findings: Finding[], docKind: string): DraftLevel {
  if (docKind !== 'reception' && docKind !== 'complete') return 'none';
  if (findings.some((f) => f.blocking && isPhysicalNonCompliance(f))) return 'nonCompliant';
  if (findings.some((f) => (!isDocumentary(f) && f.blocking) || needsVerification(f))) return 'pending';
  if (findings.some((f) => f.blocking && isDocumentary(f))) return 'incomplete';
  return 'none';
}
