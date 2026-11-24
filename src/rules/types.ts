/**
 * Contrat d'un « référentiel » (règlement national d'installation électrique).
 *
 * Le moteur (modèle, unifilaire, plan, contrôle, export) ne connaît que ce contrat.
 * Ajouter un pays = écrire un module qui exporte un RulePack et l'ajouter à RULE_PACKS (src/rules/index.ts),
 * sans toucher au reste de l'application.
 *
 * Un constat (Finding) porte trois informations indépendantes (ADR-0002) :
 *  - `status`   : statut réglementaire (non conforme, avertissement, recommandation, dérogation…) ;
 *  - `hazard`   : gravité électrique (danger pour les personnes ou les biens), indépendante de l'âge de l'installation ;
 *  - `blocking` : empêche un dossier de réception « conforme » (un document de travail reste toujours exportable).
 * `severity` (error / warning / info) est dérivé de ces trois informations, pour l'affichage.
 */
import type { Project, SurveyFact } from '../model/types';
import type { Lang } from '../i18n';

export type Severity = 'error' | 'warning' | 'info';

/** Statut réglementaire d'un constat. « compliant » n'est pas émis par constat : c'est l'absence de constat. */
export type FindingStatus =
  | 'nonCompliant' // non conforme
  | 'warning' // avertissement (à examiner, pas une non-conformité établie)
  | 'recommendation' // recommandation (mise en conformité conseillée, non exigée pour cette partie)
  | 'derogation' // dérogation applicable (saisie et justifiée par l'utilisateur)
  | 'notApplicable' // règle non applicable à cette partie
  | 'insufficientData' // informations insuffisantes pour conclure
  | 'manualCheck' // vérification manuelle nécessaire (sur place, mesure, ou interprétation)
  | 'potential' // anomalie potentielle : le constat repose sur une information déduite ou non confirmée
  | 'contradictory' // informations contradictoires (dessin, déclaration, sources de l'assistant)
  | 'notEvaluated'; // règle non évaluée (hors champ, référentiel inconnu…)

/**
 * État de connaissance du fait dont dépend un constat (ADR-0007). « Absent du dessin » ne veut pas dire
 * « absent de l'installation » :
 *  - `present`       : présence confirmée (dessinée dans l'arbre, ou déclarée présente par l'utilisateur) ;
 *  - `absent`        : absence confirmée (déclarée par l'utilisateur ; ou, pour une installation neuve en conception,
 *                      non dessinée : le dessin est alors la référence) ;
 *  - `unknown`       : information inconnue (relevé d'une installation existante : non dessiné, non déclaré) ;
 *  - `deduced`       : information déduite ou reprise par l'assistant, non confirmée ;
 *  - `contradictory` : informations contradictoires (ex. terre dessinée mais déclarée absente, question
 *                      « contradiction » ouverte dans le dossier de preuves) ;
 *  - `measureNeeded` : la réponse demande une mesure ou une vérification sur place.
 * Un constat sans `knowledge` repose sur des données connues (valeurs saisies, éléments dessinés).
 */
export type Knowledge = 'present' | 'absent' | 'unknown' | 'deduced' | 'contradictory' | 'measureNeeded';

/**
 * Nature de l'exigence :
 *  - `documentary` : porte sur le dossier (mentions, schéma incomplet, données non renseignées) ; ne démontre jamais
 *                    une non-conformité de l'installation ; peut bloquer un dossier de réception (« dossier incomplet ») ;
 *  - `physical`    : porte sur l'installation elle-même (protection, terre, différentiels, sections…).
 */
export type Requirement = 'documentary' | 'physical';

export type { SurveyFact, SurveyStatement } from '../model/types';

/** Gravité électrique (risque), indépendante du statut réglementaire. */
export type Hazard = 'high' | 'medium' | 'low' | 'none';

export interface Finding {
  /** Identifiant stable de la règle, unique dans le référentiel (ex. « R-CABLE-PROT »). */
  ruleId: string;
  severity: Severity;
  nodeId?: string;
  params?: Record<string, string | number>;
  status?: FindingStatus;
  hazard?: Hazard;
  blocking?: boolean;
  /** Édition du référentiel appliquée à la partie concernée (ex. « 2020 », « 1981 », « pre1981 »). */
  edition?: string;
  /** Constat déduit indirectement (ex. local humide reconnu d'après le nom de la pièce) : à confirmer. */
  inferred?: boolean;
  /** Dérogation appliquée (motif et référence saisis par l'utilisateur). */
  derogation?: { reason: string; reference?: string };
  /** Exigence documentaire ou physique (repris du catalogue ; « physical » par défaut). */
  requirement?: Requirement;
  /** État de connaissance du fait contrôlé (voir Knowledge) ; absent = données connues. */
  knowledge?: Knowledge;
  /** Fait du relevé que l'utilisateur peut confirmer présent / absent (boutons du contrôle, question de l'assistant). */
  fact?: SurveyFact;
}

/** Édition (version) d'un référentiel, avec ses dates d'application. */
export interface Edition {
  /** Identifiant stable (enregistré dans le projet), ex. « 2020 ». */
  id: string;
  /** Installations (ou parties) réalisées à partir de cette date (ISO, inclus). */
  from?: string;
  /** … et avant cette date (ISO, exclu). */
  until?: string;
  /** Texte légal (ex. « AR du 8 septembre 2019 »). */
  legal?: string;
  /** Modifications ultérieures connues (dates d'entrée en vigueur). */
  amendments?: { date: string; note: string }[];
  /** Nom affiché, par langue. */
  label: Partial<Record<Lang, string>>;
}

/**
 * Traçabilité d'une règle. Les champs non vérifiés restent vides : aucune référence n'est inventée.
 * `needsReview` signale une interprétation à confirmer par un expert (organisme agréé, SPF Économie).
 */
export interface RuleMeta {
  id: string;
  /** Article ou sous-section officielle, quand elle a été vérifiée. */
  article?: string;
  /** Nature du constat produit par la règle. */
  kind: 'nonCompliance' | 'missingData' | 'warning' | 'manualCheck' | 'recommendation' | 'info';
  hazard: Hazard;
  /**
   * Statut pour une partie d'installation existante réalisée sous une édition antérieure (ou avant tout référentiel).
   * Par défaut : non conforme si `hazard` = high, sinon recommandation.
   */
  existing?: FindingStatus;
  /** Source officielle (texte légal, page du SPF Économie…). */
  source?: string;
  /** Date de dernière vérification réglementaire (ISO). */
  verifiedOn?: string;
  needsReview?: boolean;
  /** Jamais bloquant (donnée utile mais non exigée pour la réception, ex. pouvoir de coupure). */
  neverBlocking?: boolean;
  /** Fichier de test qui couvre la règle. */
  tests?: string;
  /** Exigence documentaire (dossier, schéma) ou physique (installation). Par défaut : physique. */
  requirement?: Requirement;
}

/** Dérogation saisie par l'utilisateur pour une règle (éventuellement limitée à un élément). */
export interface Derogation {
  ruleId: string;
  nodeId?: string;
  reason: string;
  /** Référence de la dérogation (article, décision, PV de l'organisme agréé…). */
  reference?: string;
}

export interface RulePack {
  /** Identifiant enregistré dans le projet (ex. « BE-RGIE », « FR-NFC15100 », « NL-NEN1010 »). */
  id: string;
  /** Code pays ISO 3166-1 alpha-2. */
  country: string;
  /** Nom affiché, par langue (repli sur l'anglais puis le français). */
  label: Partial<Record<Lang, string>>;
  /**
   * Versions du référentiel au sens de l'ancien modèle (projet : meta.rgieVersion) : « new » = version en vigueur,
   * « old » = ancienne version. Gardé pour la compatibilité ; les éditions datées sont dans `editions`.
   */
  versions: ('new' | 'old')[];
  /** Éditions datées, de la plus ancienne à la plus récente. */
  editions?: Edition[];
  /** Traçabilité des règles, par id. */
  rules?: Record<string, RuleMeta>;
  /** Contrôle du projet (constats avec statut ; la sévérité est complétée par le moteur). */
  check: (project: Project) => Finding[];
  /**
   * Textes propres au référentiel, par langue : « rule.<ruleId> » (constat), « advice.<ruleId> » (conseil),
   * et toute autre clé à remplacer (ex. « project.rgieVersion.new »). Ils s'ajoutent aux traductions de l'application.
   */
  messages?: Partial<Record<Lang, Record<string, string>>>;
  /**
   * Listes de choix propres au pays, par clé de propriété (ex. cableType : désignations nationales des câbles).
   * Sans valeur, les listes par défaut (belges) s'appliquent.
   */
  options?: Partial<Record<string, string[]>>;
  /**
   * Équivalents harmonisés (CENELEC / EN) des désignations nationales, pour la liste du matériel
   * (clés « cableType.<valeur> », « socket »). Les références fabricant, elles, varient d'un pays à l'autre :
   * la liste du matériel désigne le matériel par ses caractéristiques et sa norme.
   */
  equivalents?: Record<string, string>;
}
