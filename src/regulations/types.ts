/**
 * Registre des exigences réglementaires (ADR-0009) : une fiche par exigence, source unique des valeurs, références,
 * champs d'application, exceptions, statuts de validation et questions ouvertes. Le moteur (src/rules), la rubrique
 * « Apprendre » (learn/, tools/learn) et la page publique de transparence lisent ce registre ; aucune valeur
 * réglementaire n'est recopiée ailleurs quand elle peut en être dérivée.
 *
 * Données seulement (pas de logique d'évaluation ici) : ce n'est pas un moteur de règles générique.
 */

/** Juridiction (pays) de l'exigence. */
export type Jurisdiction = 'BE';

/**
 * Nature de l'exigence, telle que l'audit l'a établie :
 *  - `rgie`            : exigence du RGIE, référence vérifiée dans le texte officiel ;
 *  - `normative`       : exigence d'une norme (le RGIE y renvoie ou non), vérifiée sur la norme ;
 *  - `goodPractice`    : bonne pratique professionnelle (aucune obligation trouvée) ;
 *  - `recommendation`  : recommandation de Voltaplan (aide à la conception, qualité du dossier) ;
 *  - `needsExpert`     : interprétation qui demande l'avis d'un spécialiste (jamais une non-conformité certaine) ;
 *  - `insufficientlyDocumented` : exigence probable mais source insuffisante (norme non consultée…) ;
 *  - `tool`            : fonctionnement de l'outil (référentiel, options), pas une exigence sur l'installation.
 */
export type RequirementNature = 'rgie' | 'normative' | 'goodPractice' | 'recommendation' | 'needsExpert' | 'insufficientlyDocumented' | 'tool';

/** Validation documentaire : relecture du texte officiel (faite en 2026 avec assistance d'IA, voir le rapport). */
export type DocValidation = 'verified' | 'partial' | 'notVerified' | 'notApplicable';
/** Validation humaine par un spécialiste du RGIE ou un organisme agréé. */
export type HumanValidation = 'none' | 'requested' | 'validated' | 'rejected';

/** Texte officiel et version. */
export interface OfficialSource {
  id: string;
  title: string;
  version: string;
  /** Date de la version (ISO). */
  publishedOn: string;
  /** Date d'application de la version (ISO). */
  appliesFrom: string;
  legal: string;
  url: string;
}

/** Référence exacte dans le texte officiel (ou dans une norme pour une exigence normative). */
export interface Reference {
  source: string;
  /** Section, sous-section et point, ex. « 4.4.1.4 », « 5.3.5.3 a », « tableau 4.11 ». */
  ref: string;
  /** Page imprimée. */
  page?: string;
  /** Citation courte, mot pour mot. */
  quote?: string;
}

/** Paramètre réglementaire (valeur et unité), défini une seule fois ici. */
export interface Parameter<T = unknown> {
  value: T;
  unit: string;
  /** D'où vient la valeur : référence officielle, norme, ou « choix Voltaplan ». */
  source: string;
}

export interface RegRequirement {
  /** Identifiant stable, indépendant de la numérotation du RGIE (ex. « BE-PROT-SECTION-RATING »). */
  id: string;
  jurisdiction: Jurisdiction;
  nature: RequirementNature;
  /** Titre court (français). */
  title: string;
  /** Énoncé de l'exigence. */
  statement: string;
  /** Texte officiel (id de OfficialSource). */
  source: string;
  references: Reference[];
  /** Entrée en vigueur de l'exigence (ISO), si distincte de celle du texte. */
  effectiveFrom?: string;
  /** Fin de validité (ISO) si l'exigence a été remplacée. */
  validUntil?: string;
  /** Conditions d'application (champ : domestique, schéma, type de circuit, neuf / existant…). */
  conditions: string[];
  exceptions: string[];
  transitional: string[];
  parameters?: Record<string, Parameter>;
  /** Données du projet nécessaires à l'évaluation (propriétés du modèle). */
  dataNeeded: string[];
  /** Règles du moteur qui la vérifient (ids du catalogue). Vide : enseignée seulement. */
  rules: string[];
  /** Articles pédagogiques (slugs de learn/fr). */
  articles: string[];
  /** Tests (fichier de test) qui la couvrent. */
  tests: string[];
  docValidation: DocValidation;
  humanValidation: HumanValidation;
  /** Questions ouvertes (renvoi au dossier VALIDATION-EXTERNE-RGIE.md, « Q1 »…). */
  openQuestions: string[];
}
