/**
 * Paramètres réglementaires belges : chaque valeur est définie une seule fois, avec son unité et sa source. Les fiches
 * du registre (requirements.ts) les référencent ; le moteur (src/rules/be/rgie.ts), les tests de cohérence et la page
 * de transparence les lisent ici. Référence : RGIE Livre 1, version 07 (15/09/2026), pages imprimées.
 */
import type { Parameter } from '../types';

const p = <T>(value: T, unit: string, source: string): Parameter<T> => ({ value, unit, source });

/** Tableau 4.11 : [section mm², fusible A, disjoncteur A] (4.4.1.4, p. 116-117 ; installations domestiques). */
export const TABLE_4_11 = p<[number, number, number][]>(
  [
    [0.5, 2, 4],
    [0.75, 4, 6],
    [1, 6, 10],
    [1.5, 10, 16],
    [2.5, 16, 20],
    [4, 20, 25],
    [6, 32, 40],
    [10, 50, 63],
    [16, 63, 80],
    [25, 80, 100],
    [35, 100, 125],
  ],
  'mm² / A / A',
  'RGIE 4.4.1.4, tableau 4.11, p. 116-117',
);

/** Section minimale en règle générale (5.2.1.2, p. 129) et pour un circuit sans socle de prise (tableau 5.1). */
export const SECTION_MIN_GENERAL = p(2.5, 'mm²', 'RGIE 5.2.1.2, p. 129');
export const SECTION_MIN_NO_SOCKET = p(1.5, 'mm²', 'RGIE 5.2.1.2, tableau 5.1, p. 129');

/** Circuit dédié pour tout appareil à poste fixe d'au moins cette puissance (5.2.1.2, p. 129). */
export const DEDICATED_POWER = p(2600, 'W', 'RGIE 5.2.1.2, p. 129');

/** Résistance de dispersion de la prise de terre, installation domestique : « inférieure à » (4.2.3.2, p. 84). */
export const EARTH_MAX = p(100, 'Ω', 'RGIE 4.2.3.2, p. 84');
/** Au-delà : mesures complémentaires (deux différentiels haute sensibilité, 16 socles chacun, 100 mA) (4.2.4.3 b, p. 101). */
export const EARTH_EXTRA_MEASURES_ABOVE = p(30, 'Ω', 'RGIE 4.2.4.3 b, p. 101');

/** Au-delà de 30 Ω : 16 socles au plus par différentiel haute sensibilité, et 100 mA au plus pour les autres circuits. */
export const EARTH_EXTRA_SOCKETS_PER_RCD = p(16, 'socles', 'RGIE 4.2.4.3 b, 10e alinéa, p. 101');
export const EARTH_EXTRA_RCD_MAX = p(100, 'mA', 'RGIE 4.2.4.3 b, 10e alinéa, p. 101');

/** Résistance d'isolement minimale (6.4.5.1, tableau 6.1 : 0,5 MΩ pour une tension nominale ≤ 500 V, essai à 500 V continu). */
export const INSULATION_MIN = p(0.5, 'MΩ', 'RGIE 6.4.5.1, tableau 6.1, p. 201 (tension nominale ≤ 500 V, essai sous 500 V continu)');

/** Socles de prise simples ou multiples par circuit terminal (5.3.5.2 b, p. 167). */
export const SOCKETS_PER_CIRCUIT_MAX = p(8, 'points', 'RGIE 5.3.5.2 b, p. 167');

/** Différentiel à l'origine de l'installation : sensibilité maximale (4.2.4.3 b, p. 100). */
export const RCD_ORIGIN_MAX_SENSITIVITY = p(300, 'mA', 'RGIE 4.2.4.3 b, p. 100');
/** Haute sensibilité : au plus 30 mA en courant alternatif (définitions, p. 34). */
export const RCD_HIGH_SENSITIVITY = p(30, 'mA', 'RGIE 2.6.4 (définitions), p. 34');
/** Circuits terminaux par différentiel à haute ou très haute sensibilité (4.2.4.3 b, p. 100). */
export const CIRCUITS_PER_RCD30_MAX = p(8, 'circuits', 'RGIE 4.2.4.3 b, p. 101');
/** Différentiel placé en tête : intensité nominale minimale (5.3.5.3 a, p. 168). */
export const RCD_HEAD_MIN_RATING = p(40, 'A', 'RGIE 5.3.5.3 a, p. 168');

/** Chapitre 7.112 : installations photovoltaïques domestiques à basse tension d'au plus 10 kVA (7.112.1, p. 270). */
export const PV_7112_MAX = p(10000, 'VA', 'RGIE 7.112.1, p. 270');

/** Temps de déclenchement maximal utilisé pour les essais (normes de produit EN 61008/61009, non consultées). */
export const RCD_TRIP_MAX = p({ general: 300, selective: 500 }, 'ms', 'Normes de produit (non consultées) — choix Voltaplan, non bloquant');

/** Dates d'application (dispositions transitoires). */
export const DATES = p(
  {
    /** Avant cette date : parties anciennes, dérogations de 8.2.1. */
    pre1981Until: '1981-10-01',
    /** Différentiel de tête < 40 A admis pour une exécution entamée avant cette date (8.2.2). */
    rcdHead40aFrom: '1991-09-16',
    /** Livre 1 (AR du 8/9/2019). */
    livre1From: '2020-06-01',
    /** 30 mA pour prises et éclairage, 8 circuits par 30 mA (4.2.4.3 b, modifications du 1/6/2023 ; 6.5.8.1). */
    rcd30Extended: '2023-06-01',
    /** Socles IPXX-D et autres modifications (5.3.5.2 a et c). */
    rgie2025: '2025-03-01',
    /** Version 07 du Livre 1. */
    v07: '2026-11-01',
    /** Bornes de charge : chapitre 7.22 pour une réalisation ou un remplacement entamé à partir de cette date (7.22.1). */
    evCharger722: '2022-11-01',
    /** 8.2.2 point 5 : câbles de 1 mm² (EMCB, EMCVB) ou 0,75 mm² (CTLB, VTLB) d'une exécution entamée avant cette date. */
    oldSection1986: '1986-05-17',
  },
  'date',
  'RGIE 8.2.1, 8.2.2, 4.2.4.3 b, 5.3.5.2 c, 6.5.8.1 ; version 07',
);
