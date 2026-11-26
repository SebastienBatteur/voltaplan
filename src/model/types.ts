/**
 * Modèle de données Voltaplan.
 *
 * L'installation est un arbre de nœuds (comme Trikker / Eendraadschema) :
 *   origine → compteur → différentiel → tableau → disjoncteurs → câbles → points (prises, lampes…)
 * Le plan de position référence les nœuds par leur id : un même objet existe donc
 * une seule fois et est visible à la fois sur l'unifilaire et sur le plan.
 */

export type NodeKind =
  | 'origin' // départ (réseau)
  | 'meter' // compteur
  | 'protection' // disjoncteur, différentiel, fusible, sectionneur
  | 'board' // tableau / sous-tableau
  | 'cable' // canalisation
  | 'socket' // prise(s)
  | 'switch' // interrupteur
  | 'pushButton' // bouton poussoir
  | 'light' // point lumineux
  | 'appliance' // appareil (four, lave-linge…)
  | 'earthBar' // barrette de terre
  | 'earth' // prise de terre
  | 'junctionBox' // boîte de dérivation
  | 'relay' // relais / télérupteur / contacteur
  | 'transformer' // transformateur (TBTS, sonnette)
  | 'domotic' // module domotique
  | 'motor'
  | 'solarPanel'
  | 'inverter'
  | 'battery' // batterie de stockage (accumulateur)
  | 'bell' // sonnerie / source sonore
  | 'detector' // détecteur
  | 'other';

export type PropValue = string | number | boolean | undefined;

export interface ElNode {
  id: string;
  kind: NodeKind;
  /** Propriétés typées par kind (voir PROP_SCHEMAS dans schema.ts). */
  props: Record<string, PropValue>;
  /** Localisation / commentaire libre (ex. « Chambre 1 »). */
  location?: string;
  children: ElNode[];
  /** Données sources (import Trikker, Volter ou Eendraadschema) conservées pour un export sans perte. */
  source?: { format: 'trikker' | 'volter' | 'eendraadschema'; tag: string; attrs: Record<string, string> };
}

export type RgieVersion = 'new' | 'old';

/**
 * Faits du relevé qu'on peut déclarer sans les dessiner (ADR-0007) : prise de terre, différentiel général,
 * différentiel 30 mA des circuits qui l'exigent.
 */
export type SurveyFact = 'earth' | 'rcd' | 'rcd30';
/** Déclaration explicite de l'utilisateur : confirmé présent ou confirmé absent (clé absente = inconnu). */
export type SurveyStatement = 'present' | 'absent';
export type InstallationKind = 'new' | 'existing';
/** Avancement du dossier, choisi par l'utilisateur (étiquette personnelle, sans lien avec un organisme). */
export type ProjectStatus = 'draft' | 'ready' | 'inspected';

export interface Address {
  street?: string;
  number?: string;
  box?: string;
  postalCode?: string;
  city?: string;
  country?: string;
}

export interface Revision {
  version: string;
  date: string; // ISO
  description: string;
}

export interface ProjectMeta {
  title: string;
  client: { name?: string; email?: string; address: Address };
  site: Address;
  /** Responsable de l'exécution des travaux (nom, qualité, n° de TVA : mentions obligatoires, RGIE 3.1.2.1). */
  installer: { name?: string; quality?: string; vat?: string; address: Address; phone?: string; email?: string };
  inspectionBody?: string;
  drawnBy?: string;
  date: string; // ISO
  supply: string; // ex. "3 x 230V ~ 50Hz" (sans neutre) ou "3N x 400V ~ 50Hz"
  earthing: 'TT' | 'TN' | 'IT';
  /** Code EAN du point de raccordement (demandé par les organismes agréés). */
  ean?: string;
  /** Courant nominal du raccordement (A). */
  mainCurrent?: number;
  /** Emplacement du sectionneur de terre. */
  earthSwitchLocation?: string;
  /** Organisme agréé (nom), pour le cartouche. */
  inspectionBodyName?: string;
  installationKind: InstallationKind;
  /**
   * Versions du dossier (RGIE 3.1.2 : numéro, version et date ; une modification ou extension
   * doit être reportée sur le plan de position, qui montre toujours la situation existante).
   */
  revisions?: Revision[];
  /** Numéro du dossier (RGIE 3.1.2 : « numéro, version et date de la version » sur les schémas et plans). */
  docNumber?: string;
  /** Avancement du dossier : en cours, prêt pour le contrôle, contrôlé. Absent = en cours. */
  status?: ProjectStatus;
  /**
   * Lien vers le dossier PDF partagé par l'installateur depuis son propre cloud (Drive, OneDrive, Dropbox…) : repris
   * dans le QR code collé sur le coffret. Absent : le QR code contient les informations en texte (hors ligne).
   */
  dossierUrl?: string;
  /** Référentiel (pays et règlement), voir src/rules. Absent = « BE-RGIE ». */
  ruleset?: string;
  /** Sens de l'unifilaire : 'up' (défaut, alimentation en bas comme la figure 3.1 du RGIE) ou 'down'. */
  unifilarDirection?: 'up' | 'down';
  rgieVersion: RgieVersion;
  /**
   * Date de réalisation de l'installation (ISO ou « AAAA »). Détermine l'édition du référentiel applicable
   * (prioritaire sur rgieVersion) ; une partie peut avoir sa propre date (propriété `installedOn`).
   */
  installationDate?: string;
  /** Dérogations applicables, saisies et justifiées par l'utilisateur (voir src/rules/types.ts). */
  derogations?: { ruleId: string; nodeId?: string; reason: string; reference?: string }[];
  /**
   * Déclarations explicites du relevé (ADR-0007) : un fait non dessiné n'est pas pour autant absent de
   * l'installation. Facultatif ; absent dans les anciens fichiers (= rien de déclaré).
   */
  survey?: Partial<Record<SurveyFact, SurveyStatement>>;
  /** Éléments connus à la dernière « Mise à jour » (src/model/sync.ts) : les autres sont nouveaux. */
  syncedIds?: string[];
}

export interface Measurements {
  earthResistanceOhm?: number;
  insulationMOhm?: number;
  /** Test des différentiels, par id de nœud. */
  rcdTests?: Record<string, { tripMs?: number; ok?: boolean }>;
  bondingOk?: boolean; // liaisons équipotentielles
  /** Date des mesures (ISO) et appareil de mesure utilisé. */
  measuredOn?: string;
  instrument?: string;
}

export interface Pt {
  x: number;
  y: number;
}

/** Plan simplifié à l'échelle : unités = millimètres. */
export interface Furniture {
  id: string;
  /** Type de meuble (clé du catalogue FURNITURE). */
  kind: string;
  center: Pt;
  /** Largeur et profondeur en mm. */
  w: number;
  h: number;
  /** Rotation en degrés. */
  angle: number;
}

export interface PlanPage {
  id: string;
  name: string;
  walls: { a: Pt; b: Pt; thickness: number }[];
  openings: { kind: 'door' | 'doubleDoor' | 'frenchDoor' | 'slidingDoor' | 'window' | 'garageDoor' | 'stairs'; a: Pt; b: Pt; width?: number; /** Porte : côté d'ouverture ('left' = -y local du segment a→b). */ hinge?: 'left' | 'right'; /** Porte : charnière en b au lieu de a. */ mirrored?: boolean }[];
  rects: { center: Pt; w: number; h: number; angle: number }[];
  /** Images (meubles Trikker, ou fond de plan importé : `background`). */
  images: {
    center: Pt;
    w: number;
    h: number;
    angle: number;
    href: string;
    opacity?: number;
    background?: boolean;
    /** Fond redressé : rectangle connu (façades) sur la page, en mm. */
    frame?: { x: number; y: number; w: number; h: number };
  }[];
  /** Mobilier (pictogrammes vectoriels, voir src/plan/furniture.tsx). Absent dans les anciens fichiers. */
  furniture?: Furniture[];
  /** Position des symboles des nœuds électriques sur le plan. */
  /**
   * Symboles placés. `autoRotate` : élément posé au mur (prise, interrupteur, applique…) dont le trait de
   * raccordement est tourné automatiquement vers le mur le plus proche ; une rotation à la main l'arrête.
   */
  symbols: { nodeId: string; pos: Pt; rotation: number; labelSide?: string; autoRotate?: boolean }[];
  /** Textes libres (noms de pièces). */
  labels: { id: string; text: string; pos: Pt; size?: number }[];
}

/** Disposition d'un tableau : position de chaque appareil (rangée, colonne en modules), photo et vérifications. */
export interface BoardLayout {
  slots: Record<string, { row: number; col: number }>;
  /** Photo du tableau, redressée sur la zone des appareils (de la 1re à la dernière rangée). */
  photo?: {
    href: string;
    opacity?: number;
    /** Position de la photo brute sur le dessin (mm), avant calage. */
    x: number;
    y: number;
    w: number;
    h: number;
    /** Taille de l'image en pixels. */
    imgW?: number;
    imgH?: number;
    /** Calage : pour chaque rangée, bord gauche du 1er module (a) et bout de la rangée (b), en pixels de la photo. */
    rows?: { a: { x: number; y: number }; b: { x: number; y: number } }[];
    /** Photo partielle (une photo par rangée) : rangée du tableau de la 1re rangée calée (0 par défaut). */
    firstRow?: number;
  };
  /** Contrôle de l'appareil sur la photo : confirmé par l'utilisateur, ou différence relevée. */
  checks?: Record<string, 'ok' | 'ko'>;
}

export interface Project {
  /** Identifiant du format (voir src/brand.ts). */
  format: string;
  /** Version du modèle (src/model/migrate.ts : CURRENT_VERSION). 2 : images en références « asset:<sha256> » possibles. */
  version: 1 | 2;
  meta: ProjectMeta;
  /** Racines de l'arbre (en général une seule : l'origine). */
  roots: ElNode[];
  /** Éléments présents sur le plan mais pas raccordés dans le schéma (ex. repère de tableau). */
  loose: ElNode[];
  plan: { pages: PlanPage[]; width: number; height: number };
  measurements: Measurements;
  /** Disposition des tableaux, par id du nœud « tableau ». */
  boards?: Record<string, BoardLayout>;
  /**
   * Dossier de preuves de l'assistant (src/assist/evidence.ts) : sources, observations, propositions, questions,
   * provenance, historique. Facultatif ; jamais lu par le moteur électrique, les calculs ni les exports.
   */
  evidence?: import('../assist/evidence').Evidence;
}
