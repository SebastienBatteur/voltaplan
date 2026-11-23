/**
 * Contrat d'un « référentiel » (règlement national d'installation électrique).
 *
 * Le moteur (modèle, unifilaire, plan, contrôle, export) ne connaît que ce contrat.
 * Ajouter un pays = écrire un module qui exporte un RulePack et l'ajouter à RULE_PACKS (src/rules/index.ts),
 * sans toucher au reste de l'application.
 */
import type { Project } from '../model/types';
import type { Lang } from '../i18n';

export type Severity = 'error' | 'warning' | 'info';

export interface Finding {
  /** Identifiant stable de la règle, unique dans le référentiel (ex. « R-CABLE-PROT »). */
  ruleId: string;
  severity: Severity;
  nodeId?: string;
  params?: Record<string, string | number>;
}

export interface RulePack {
  /** Identifiant enregistré dans le projet (ex. « BE-RGIE », « FR-NFC15100 », « NL-NEN1010 »). */
  id: string;
  /** Code pays ISO 3166-1 alpha-2. */
  country: string;
  /** Nom affiché, par langue (repli sur l'anglais puis le français). */
  label: Partial<Record<Lang, string>>;
  /**
   * Versions du référentiel, la plus récente en premier (projet : meta.rgieVersion).
   * Convention : « new » = version en vigueur (règles bloquantes pour une installation neuve),
   * « old » = ancienne version (alertes et conseils de mise en conformité).
   */
  versions: ('new' | 'old')[];
  /**
   * Contrôle du projet. Sévérité attendue :
   * installation neuve + version en vigueur → « error » (bloquant) ; sinon « warning » + conseil.
   */
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
