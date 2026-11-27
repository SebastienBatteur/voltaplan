// Section « Apprendre » : formats des sources (learn/) et des exercices (tools/learn/exercices/).
import type { ElNode } from '../../src/model/types';

/** Appareil d'un exercice de câblage ; ses bornes dépendent du type (site/apprendre/cablage-sim.js). */
export interface ExoDevice {
  id: string;
  type:
    | 'supply'
    | 'switch'
    | 'double'
    | 'twoway'
    | 'intermediate'
    | 'push'
    | 'shutterSwitch'
    | 'relay'
    | 'detector'
    | 'lamp'
    | 'socket'
    | 'motor'
    | 'box';
  label: string;
  /** Coin haut-gauche de la boîte (unités du dessin). */
  x: number;
  y: number;
  /** Côté des bornes (bas par défaut). */
  side?: 'top' | 'bottom';
}

export type ExoColor = 'brown' | 'blue' | 'gy' | 'black' | 'grey';
export interface ExoWire {
  a: string;
  b: string;
  color: ExoColor;
}

/** État attendu : récepteur en marche (lampe, prise) ou sens du moteur ({ up, down }). */
export type ExoExpect = Record<string, boolean | { up?: boolean; down?: boolean }>;

export interface Exercise {
  id: string;
  title: string;
  /** Consigne (HTML simple). */
  task: string;
  devices: ExoDevice[];
  /** Taille du dessin (sinon calculée). */
  w?: number;
  h?: number;
  /** Positions des commandes → état attendu (montages sans mémoire). */
  cases?: { set: Record<string, string>; expect: ExoExpect }[];
  /**
   * Chaque commande (va-et-vient, inverseur) inverse l'état du récepteur, quelle que soit la position des autres :
   * accepte toutes les conventions de câblage justes (navettes croisées ou non). À préférer à `cases` dans ce cas.
   */
  toggle?: { inputs: string[]; output: string };
  /** Suite d'appuis (télérupteur) → état attendu après chaque appui. */
  sequence?: { press?: string; set?: Record<string, string>; expect: ExoExpect }[];
  /** Une solution correcte (montrée sur demande ; toute autre solution correcte est acceptée). */
  solution: ExoWire[];
}

export type MakeNode = (kind: ElNode['kind'], props?: ElNode['props'], children?: ElNode[]) => ElNode;

export interface ExerciseModule {
  exercise: Exercise;
  /** Le même circuit dans Voltaplan (arbre sous le tableau : protection → câble → points). */
  unifilar: (node: MakeNode) => ElNode[];
  /** Légende de l'unifilaire. */
  unifilarCaption: string;
}

/** En-tête JSON d'un article (commentaire au début de learn/fr/<slug>.html). */
export interface ArticleMeta {
  title: string;
  /** Titre de l'onglet si différent (≤ 70 caractères avec « — Voltaplan »). */
  pageTitle?: string;
  /** 70 à 160 caractères. */
  description: string;
  rubrique: string;
  order: number;
  exercise?: string;
  related?: string[];
  retenir: string[];
  faq?: { q: string; a: string }[];
  sources?: { label: string; url?: string }[];
  updated: string;
}

export interface Rubrique {
  id: string;
  title: string;
  intro: string;
}

export interface LexEntry {
  id: string;
  term: string;
  def: string;
  /** Articles où le mot est expliqué (slugs). */
  see?: string[];
}
