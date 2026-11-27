/**
 * Dérogations du RGIE pour les installations existantes (partie 8 et dispositions transitoires), telles que relevées
 * dans le texte officiel (version 07). Une non-conformité d'une partie existante ne devient jamais d'office une
 * recommandation : seule une dérogation applicable à la règle, à l'époque de la partie et à sa condition change le
 * constat. Données seulement ; le moteur (src/rules/be/rgie.ts) vérifie la condition quand il le peut.
 *
 * `regimes` : époque de la partie (`pre1981` : exécution avant le 1/10/1981, 8.2.1 ; `old` : ancien RGIE 1981-2020,
 * 8.2.2, qui ne vaut que pour une partie ayant fait l'objet d'un examen de conformité — fait non connu du modèle, d'où
 * une vérification plutôt qu'une dérogation acquise).
 */
export type Regime = 'pre1981' | 'old';

export interface Derogation {
  id: string;
  /** Référence exacte, ex. « 8.2.1, point 6 b ». */
  ref: string;
  page: string;
  rules: string[];
  regimes: Regime[];
  /** Condition du texte (en clair), à vérifier quand le moteur ne peut pas la calculer. */
  condition: string;
}

export const DEROGATIONS: Derogation[] = [
  {
    id: 'D-8.2.1-6b-earth',
    ref: '8.2.1, point 6 b',
    page: '274-275',
    rules: ['R-SOCKET-EARTH'],
    regimes: ['pre1981'],
    condition: 'socle sans contact de terre parce que la canalisation est sans conducteur de protection, et protégé par un différentiel à haute ou très haute sensibilité',
  },
  {
    id: 'D-8.2.1-6b-count',
    ref: '8.2.1, point 6 b ; 8.2.2, point 6',
    page: '274-275, 278',
    rules: ['R-SOCKET-MAX'],
    regimes: ['pre1981', 'old'],
    condition: 'plus de huit socles par circuit si la puissance des appareils fixes et à poste fixe raccordés ne dépasse pas la puissance admissible de la canalisation',
  },
  {
    id: 'D-8.2.x-5-dedicated',
    ref: '8.2.1, point 5 ; 8.2.2, point 5',
    page: '274, 277',
    rules: ['R-DEDICATED-CIRCUIT'],
    regimes: ['pre1981', 'old'],
    condition: 'circuits existants non dédiés laissés en service (5.2.1.2)',
  },
  {
    id: 'D-8.2.1-5-section',
    ref: '8.2.1, point 5',
    page: '274',
    rules: ['R-CABLE-MIN', 'R-SOCKET-SECTION'],
    regimes: ['pre1981'],
    condition: 'section d’au moins 1 mm² ; 1 mm² protégé par un fusible de 6 A au plus ou un disjoncteur de 10 A au plus',
  },
  {
    id: 'D-8.2.2-5-section',
    ref: '8.2.2, point 5',
    page: '277-278',
    rules: ['R-CABLE-MIN'],
    regimes: ['old'],
    condition: 'câbles EMCB / EMCVB 1 mm² ou CTLB / VTLB 0,75 mm² d’une exécution entamée avant le 17/5/1986, circuit sans socle, protection adaptée',
  },
  {
    id: 'D-8.2.1-13-bonding',
    ref: '8.2.1, point 13',
    page: '276',
    rules: ['R-BONDING'],
    regimes: ['pre1981'],
    condition: 'absence de liaison équipotentielle principale dans une partie d’avant le 1/10/1981, aux conditions du point 13',
  },
];

/** Dérogations d'une règle pour un régime de partie. */
export function derogationsFor(ruleId: string, regime: Regime): Derogation[] {
  return DEROGATIONS.filter((d) => d.rules.includes(ruleId) && d.regimes.includes(regime));
}
