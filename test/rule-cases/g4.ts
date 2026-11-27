/**
 * Cas des règles du lot g4 (voir types.ts et test/rules.cases.test.ts) : canalisations (section, données, tableau 4.11,
 * surintensités), prises (terre, sécurité enfant, IPXX-D, 8 socles, section), circuits dédiés et calculs (chute de
 * tension, longueur maximale protégée). Références : RGIE Livre 1, version 07 (15/09/2026).
 */
import type { ElNode, Project } from '../../src/model/types';
import type { RuleCase } from './types';
import { circuit, existing, node, project, type Built } from './fixtures';

/** Projet neuf conforme avec ces circuits (sous le 30 mA). */
const prj = (...circuits: ElNode[]): Project => project(...circuits).p;
/** Installation existante datée (sans date : époque inconnue). */
const old = (date: string | undefined, ...circuits: ElNode[]): Project => existing(project(...circuits), date).p;
/** Câble (premier enfant) d'un circuit construit par `circuit`. */
const cableOf = (c: ElNode): ElNode => c.children[0];
/** Retire des propriétés (valeurs par défaut du schéma comprises). */
const without = (n: ElNode, ...keys: string[]): ElNode => {
  for (const k of keys) delete n.props[k];
  return n;
};
/** Circuit dont le câble a cette longueur (m). */
const long = (c: ElNode, length: number): ElNode => {
  cableOf(c).props.length = length;
  return c;
};
const sockets = (k: number, props: ElNode['props'] = {}): ElNode[] => Array.from({ length: k }, () => node('socket', props));
const light = () => node('light', {});
const lights = (k: number): ElNode[] => Array.from({ length: k }, light);
const ap = (applianceType: string, props: ElNode['props'] = {}) => node('appliance', { applianceType, ...props });
/** Prise qui porte un appareil. */
const apSocket = (applianceType: string, props: ElNode['props'] = {}) => node('socket', {}, [ap(applianceType, props)]);
/** Circuit monté directement dans le tableau principal (sous le seul différentiel 300 mA). */
const onMainBoard = (b: Built, c: ElNode): Built => {
  b.board.children.push(c);
  return b;
};
/**
 * Circuit alimenté par un sous-tableau : 30 mA → disjoncteur 40 A → câble 10 mm² (`feedLength` m) → tableau → circuit.
 * Le câble d'alimentation est en amont du circuit (chute cumulée, Icc).
 */
const behindFeeder = (feedLength: number, c: ElNode): Project =>
  prj(node('protection', { device: 'mcb', ratedCurrent: 40, curve: 'C', poles: '1P+N', breakingCapacity: 6 }, [node('cable', { section: 10, length: feedLength }, [node('board', { name: 'Sous-tableau' }, [c])])]));

const SEC_MISSING = 'R-CABLE-SECTION-MISSING';
const DATA_MISSING = 'R-CABLE-DATA-MISSING';

export const CASES: RuleCase[] = [
  // --- R-CABLE-SECTION-MISSING : section absente du schéma (3.1.2.2 a, documentaire) ---
  {
    rule: SEC_MISSING,
    kind: 'compliant',
    title: 'section renseignée',
    build: () => prj(circuit('mcb', 20, 2.5)),
    expect: 'silent',
  },
  {
    rule: SEC_MISSING,
    kind: 'missingData',
    title: 'conception : section absente (type connu) → informations insuffisantes, bloquant',
    build: () => {
      const c = circuit('mcb', 20, 2.5);
      without(cableOf(c), 'section');
      return prj(c);
    },
    expect: { status: 'insufficientData', blocking: true },
  },
  {
    rule: SEC_MISSING,
    kind: 'missingData',
    title: 'relevé (1995) : section absente → informations insuffisantes, non bloquant',
    build: () => {
      const c = circuit('mcb', 20, 2.5);
      without(cableOf(c), 'section');
      return old('1995-01-01', c);
    },
    expect: { status: 'insufficientData', blocking: false },
  },
  {
    rule: SEC_MISSING,
    kind: 'exception',
    title: 'partie d’avant 1981 : schéma simplifié, la section des départs reste exigée (8.2.1 point 7)',
    build: () => {
      const c = circuit('mcb', 16, 2.5);
      without(cableOf(c), 'section');
      return old('1975', c);
    },
    expect: { status: 'insufficientData', blocking: false },
  },
  {
    rule: SEC_MISSING,
    kind: 'notApplicable',
    title: 'câble en courant continu (nature saisie) sans section : hors règle AC',
    build: () => {
      const c = circuit('mcb', 20, 2.5);
      without(cableOf(c), 'section');
      cableOf(c).props.current = 'dc';
      return prj(c);
    },
    expect: 'silent',
  },
  {
    rule: SEC_MISSING,
    kind: 'notApplicable',
    title: 'aucune donnée du câble : c’est R-CABLE-DATA-MISSING qui le signale',
    build: () => {
      const c = circuit('mcb', 20, 2.5);
      without(cableOf(c), 'section', 'cableType', 'conductors');
      return prj(c);
    },
    expect: 'silent',
  },

  // --- R-CABLE-DATA-MISSING : type, section, nombre de conducteurs (3.1.2.2 a) ---
  {
    rule: DATA_MISSING,
    kind: 'compliant',
    title: 'type, section et conducteurs renseignés',
    build: () => prj(circuit('mcb', 20, 2.5)),
    expect: 'silent',
  },
  {
    rule: DATA_MISSING,
    kind: 'missingData',
    title: 'conception : aucune donnée du câble → informations insuffisantes, bloquant',
    build: () => {
      const c = circuit('mcb', 20, 2.5);
      without(cableOf(c), 'section', 'cableType', 'conductors');
      return prj(c);
    },
    expect: { status: 'insufficientData', blocking: true },
  },
  {
    rule: DATA_MISSING,
    kind: 'missingData',
    title: 'relevé daté : aucune donnée du câble → informations insuffisantes, non bloquant',
    build: () => {
      const c = circuit('mcb', 20, 2.5);
      without(cableOf(c), 'section', 'cableType', 'conductors');
      return old('2005-03-01', c);
    },
    expect: { status: 'insufficientData', blocking: false },
  },
  {
    rule: DATA_MISSING,
    kind: 'missingData',
    title: 'conception : section connue mais type de câble absent → donnée manquante',
    build: () => {
      const c = circuit('mcb', 20, 2.5);
      without(cableOf(c), 'cableType');
      return prj(c);
    },
    expect: { status: 'insufficientData', blocking: true },
  },
  {
    rule: DATA_MISSING,
    kind: 'missingData',
    title: 'conception : section connue mais nombre de conducteurs absent → donnée manquante',
    build: () => {
      const c = circuit('mcb', 20, 2.5);
      without(cableOf(c), 'conductors');
      return prj(c);
    },
    expect: { status: 'insufficientData', blocking: true },
  },
  {
    rule: DATA_MISSING,
    kind: 'exception',
    title: 'partie d’avant 1981 : type et section suffisent, conducteurs absents (8.2.1 point 7)',
    build: () => {
      const c = circuit('mcb', 16, 2.5);
      without(cableOf(c), 'conductors');
      return old('1975', c);
    },
    expect: 'silent',
  },

  // --- R-CABLE-MIN : 1,5 mm² au moins (tableau 5.1), 0,5 mm² pour la commande, dérogations 8.2.1 / 8.2.2 point 5 ---
  {
    rule: 'R-CABLE-MIN',
    kind: 'boundary',
    title: 'circuit d’éclairage en 1,5 mm² (limite du tableau 5.1) : accepté',
    build: () => prj(circuit('mcb', 16, 1.5, [light()])),
    expect: 'silent',
  },
  {
    rule: 'R-CABLE-MIN',
    kind: 'boundary',
    title: 'circuit d’éclairage en 1,4 mm² (juste sous 1,5) : non conforme',
    build: () => prj(circuit('mcb', 10, 1.4, [light()])),
    expect: { status: 'nonCompliant', blocking: true, params: { section: 1.4 } },
  },
  {
    rule: 'R-CABLE-MIN',
    kind: 'nonCompliant',
    title: 'conception : éclairage en 1 mm² → non conforme, bloquant',
    build: () => prj(circuit('mcb', 10, 1, [light()])),
    expect: { status: 'nonCompliant', blocking: true, params: { section: 1 } },
  },
  {
    rule: 'R-CABLE-MIN',
    kind: 'exception',
    title: 'circuit de signalisation (sonnerie seule) en 0,5 mm² : peut-être un circuit de commande → vérification',
    build: () => prj(circuit('mcb', 4, 0.5, [node('bell', {})])),
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-CABLE-MIN',
    kind: 'boundary',
    title: 'sonnerie en 0,4 mm² : sous le minimum de 0,5 mm² des circuits de commande → non conforme',
    build: () => prj(circuit('mcb', 2, 0.4, [node('bell', {})])),
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-CABLE-MIN',
    kind: 'exception',
    title: 'partie d’avant 1981 : 1 mm² sous disjoncteur 10 A → dérogation 8.2.1 point 5',
    build: () => old('1975', circuit('mcb', 10, 1, [light()])),
    expect: { status: 'derogation', blocking: false },
  },
  {
    rule: 'R-CABLE-MIN',
    kind: 'exception',
    title: 'partie d’avant 1981 : 1 mm² sous fusible 6 A → dérogation 8.2.1 point 5',
    build: () => old('1975', circuit('fuse', 6, 1, [light()])),
    expect: { status: 'derogation', blocking: false },
  },
  {
    rule: 'R-CABLE-MIN',
    kind: 'exception',
    title: 'partie d’avant 1981 : 1 mm² sous disjoncteur 16 A → condition non remplie, non conforme bloquant',
    build: () => old('1975', circuit('mcb', 16, 1, [light()])),
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-CABLE-MIN',
    kind: 'exception',
    title: 'partie d’avant 1981 : 0,75 mm² (sous 1 mm²) → pas de dérogation, non conforme bloquant',
    build: () => old('1975', circuit('mcb', 6, 0.75, [light()])),
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-CABLE-MIN',
    kind: 'transitional',
    title: 'ancien RGIE, exécution du 16/5/1986 (veille de la limite de 8.2.2 point 5) : 0,75 mm² → vérification',
    build: () => old('1986-05-16', circuit('mcb', 6, 0.75, [light()])),
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-CABLE-MIN',
    kind: 'transitional',
    title: 'ancien RGIE, exécution du 17/5/1986 (jour de la limite) : 0,75 mm² hors dérogation → non conforme',
    build: () => old('1986-05-17', circuit('mcb', 6, 0.75, [light()])),
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-CABLE-MIN',
    kind: 'transitional',
    title: 'ancien RGIE, date partielle « 1986 » (à cheval sur le 17/5/1986) : vérification',
    build: () => old('1986', circuit('mcb', 6, 0.75, [light()])),
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-CABLE-MIN',
    kind: 'exception',
    title: 'ancien RGIE (1985) : 1 mm² dans un circuit de prises → hors 8.2.2 point 5 (circuits sans socle)',
    build: () => old('1985-01-01', circuit('mcb', 10, 1, [node('socket', {})])),
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-CABLE-MIN',
    kind: 'nonCompliant',
    title: 'partie existante sous le Livre 1 (2022) : 1 mm² → aucune dérogation, non conforme bloquant',
    build: () => old('2022-05-01', circuit('mcb', 10, 1, [light()])),
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-CABLE-MIN',
    kind: 'missingData',
    title: 'existant sans date (époque inconnue) : 1 mm² → vérification, non bloquant',
    build: () => old(undefined, circuit('mcb', 10, 1, [light()])),
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-CABLE-MIN',
    kind: 'missingData',
    title: 'partie d’avant 1981 : 1 mm² sous protection de calibre inconnu → vérification',
    build: () => {
      const c = circuit('mcb', 10, 1, [light()]);
      without(c, 'ratedCurrent');
      return old('1975', c);
    },
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-CABLE-MIN',
    kind: 'notApplicable',
    title: 'câble en courant continu (nature saisie) en 1 mm² : hors règle AC',
    build: () => {
      const c = circuit('mcb', 10, 1, [light()]);
      cableOf(c).props.current = 'dc';
      return prj(c);
    },
    expect: 'silent',
  },

  // --- R-CABLE-PROT : calibre maximal du tableau 4.11 (4.4.1.4) ---
  {
    rule: 'R-CABLE-PROT',
    kind: 'boundary',
    title: '2,5 mm² + disjoncteur 20 A (maximum du tableau) : accepté',
    build: () => prj(circuit('mcb', 20, 2.5)),
    expect: 'silent',
  },
  {
    rule: 'R-CABLE-PROT',
    kind: 'boundary',
    title: '2,5 mm² + disjoncteur 21 A : non conforme, bloquant',
    build: () => prj(circuit('mcb', 21, 2.5)),
    expect: { status: 'nonCompliant', blocking: true, params: { section: 2.5, rating: 21, max: 20 } },
  },
  {
    rule: 'R-CABLE-PROT',
    kind: 'nonCompliant',
    title: '2,5 mm² + disjoncteur 25 A : non conforme, bloquant',
    build: () => prj(circuit('mcb', 25, 2.5)),
    expect: { status: 'nonCompliant', blocking: true, params: { section: 2.5, rating: 25, max: 20 } },
  },
  {
    rule: 'R-CABLE-PROT',
    kind: 'boundary',
    title: 'colonne fusible : 2,5 mm² + fusible 16 A accepté',
    build: () => prj(circuit('fuse', 16, 2.5)),
    expect: 'silent',
  },
  {
    rule: 'R-CABLE-PROT',
    kind: 'boundary',
    title: 'colonne fusible : 2,5 mm² + fusible 20 A → non conforme (maximum 16 A)',
    build: () => prj(circuit('fuse', 20, 2.5)),
    expect: { status: 'nonCompliant', blocking: true, params: { section: 2.5, rating: 20, max: 16 } },
  },
  {
    rule: 'R-CABLE-PROT',
    kind: 'nonCompliant',
    title: 'disjoncteur différentiel (colonne disjoncteur) : 2,5 mm² + 25 A → non conforme',
    build: () => prj(circuit('rcbo', 25, 2.5, undefined, 'Circuit', { residualCurrent: 30, rcdType: 'A' })),
    expect: { status: 'nonCompliant', blocking: true, params: { max: 20 } },
  },
  {
    rule: 'R-CABLE-PROT',
    kind: 'boundary',
    title: 'section intermédiaire 3 mm² : ligne inférieure (2,5 mm²), 25 A refusé',
    build: () => prj(circuit('mcb', 25, 3)),
    expect: { status: 'nonCompliant', blocking: true, params: { max: 20 } },
  },
  {
    rule: 'R-CABLE-PROT',
    kind: 'boundary',
    title: 'dernière ligne : 35 mm² + 125 A accepté',
    build: () => prj(circuit('mcb', 125, 35)),
    expect: 'silent',
  },
  {
    rule: 'R-CABLE-PROT',
    kind: 'boundary',
    title: 'dernière ligne : 35 mm² + 160 A → non conforme (maximum 125 A)',
    build: () => prj(circuit('mcb', 160, 35)),
    expect: { status: 'nonCompliant', blocking: true, params: { section: 35, rating: 160, max: 125 } },
  },
  {
    rule: 'R-CABLE-PROT',
    kind: 'nonCompliant',
    title: 'tronçon aval réduit à 1,5 mm² sous la même protection 20 A → non conforme',
    build: () =>
      prj(node('protection', { device: 'mcb', ratedCurrent: 20, curve: 'C', poles: '1P+N', circuitName: 'Prises', breakingCapacity: 6 }, [
        node('cable', { section: 2.5, length: 5 }, [node('junctionBox', {}, [node('cable', { section: 1.5, length: 5 }, [node('socket', {})])])]),
      ])),
    expect: { status: 'nonCompliant', blocking: true, params: { section: 1.5, rating: 20, max: 16 } },
  },
  {
    rule: 'R-CABLE-PROT',
    kind: 'exception',
    title: 'partie existante (1995) : pas de dérogation au tableau 4.11 (8.2.2 point 1) → non conforme bloquant',
    build: () => old('1995-01-01', circuit('mcb', 25, 2.5)),
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-CABLE-PROT',
    kind: 'exception',
    title: 'canalisations en parallèle (4.4.3.4 : IZ = somme)',
    build: () => prj(circuit('mcb', 32, 2.5)),
    expect: 'silent',
    notModelled: 'pas de notion de canalisations en parallèle dans le modèle (method « parallel » à clarifier)',
  },
  {
    rule: 'R-CABLE-PROT',
    kind: 'exception',
    title: 'fil de sonnerie 0,5 mm² au secondaire d’un transformateur : la protection du primaire ne le concerne pas',
    build: () =>
      prj(circuit('mcb', 16, 1.5, [node('transformer', {}, [node('cable', { section: 0.5, length: 5 }, [node('bell', {})])])], 'Sonnerie')),
    expect: 'silent',
  },
  {
    rule: 'R-CABLE-PROT',
    kind: 'missingData',
    title: 'relevé (1995) : section inconnue → informations insuffisantes, non bloquant',
    build: () => {
      const c = circuit('mcb', 20, 2.5);
      without(cableOf(c), 'section');
      return old('1995-01-01', c);
    },
    expect: { status: 'insufficientData', blocking: false },
  },
  {
    rule: 'R-CABLE-PROT',
    kind: 'missingData',
    title: 'relevé (1995) : calibre inconnu → informations insuffisantes, non bloquant',
    build: () => {
      const c = circuit('mcb', 20, 2.5);
      without(c, 'ratedCurrent');
      return old('1995-01-01', c);
    },
    expect: { status: 'insufficientData', blocking: false },
  },
  {
    rule: 'R-CABLE-PROT',
    kind: 'missingData',
    title: 'conception : section inconnue → seule la donnée manquante (bloquante) est signalée',
    build: () => {
      const c = circuit('mcb', 20, 2.5);
      without(cableOf(c), 'section');
      return prj(c);
    },
    expect: 'silent',
  },
  {
    rule: 'R-CABLE-PROT',
    kind: 'notApplicable',
    title: 'câble en courant continu (nature saisie) : hors règle AC',
    build: () => {
      const c = circuit('mcb', 25, 2.5);
      cableOf(c).props.current = 'dc';
      return prj(c);
    },
    expect: 'silent',
  },

  // --- R-CABLE-IZ : hors du tableau 4.11 (> 35 mm²) → IZ à vérifier (4.4.1.4, 4.4.3.2) ---
  {
    rule: 'R-CABLE-IZ',
    kind: 'boundary',
    title: '35 mm² (dans le tableau) : pas de vérification IZ',
    build: () => prj(circuit('mcb', 125, 35)),
    expect: 'silent',
  },
  {
    rule: 'R-CABLE-IZ',
    kind: 'boundary',
    title: '50 mm² + 160 A (hors tableau) → vérification manuelle, non bloquante',
    build: () => prj(circuit('mcb', 160, 50)),
    expect: { status: 'manualCheck', blocking: false, params: { section: 50, rating: 160 } },
  },
  {
    rule: 'R-CABLE-IZ',
    kind: 'exception',
    title: 'partie existante (1995) : 50 mm² + 160 A → vérification manuelle, non bloquante',
    build: () => old('1995-01-01', circuit('mcb', 160, 50)),
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-CABLE-IZ',
    kind: 'missingData',
    title: '50 mm² sous protection de calibre inconnu : pas de vérification IZ (calibre manquant signalé à part)',
    build: () => {
      const c = circuit('mcb', 160, 50);
      without(c, 'ratedCurrent');
      return prj(c);
    },
    expect: 'silent',
  },

  // --- R-CABLE-NO-OVERCURRENT : protection contre les surintensités à l'origine du circuit (4.4.2.2 a, 4.4.3.1) ---
  {
    rule: 'R-CABLE-NO-OVERCURRENT',
    kind: 'compliant',
    title: 'circuit protégé par un disjoncteur',
    build: () => prj(circuit('mcb', 20, 2.5)),
    expect: 'silent',
  },
  {
    rule: 'R-CABLE-NO-OVERCURRENT',
    kind: 'nonCompliant',
    title: 'prises derrière un interrupteur différentiel seul → non conforme, bloquant',
    build: () => prj(circuit('rcd', 40, 2.5, undefined, 'Prises', { residualCurrent: 30, rcdType: 'A' })),
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-CABLE-NO-OVERCURRENT',
    kind: 'exception',
    title: 'partie existante (1995) : aucune dérogation en partie 8 → non conforme, bloquant',
    build: () => old('1995-01-01', circuit('rcd', 40, 2.5, undefined, 'Prises', { residualCurrent: 30, rcdType: 'A' })),
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-CABLE-NO-OVERCURRENT',
    kind: 'exception',
    title: 'liaison courte d’une génératrice ou d’une batterie (4.4.2.2 b)',
    build: () => prj(circuit('mcb', 20, 2.5)),
    expect: 'silent',
    notModelled: 'les dispenses de 4.4.2.2 b et 4.4.3.3 (liaisons courtes, sources limitées) ne sont pas représentées',
  },
  {
    rule: 'R-CABLE-NO-OVERCURRENT',
    kind: 'missingData',
    title: 'protection de nature inconnue (appareil non renseigné) → informations insuffisantes',
    build: () => prj(circuit('', 20, 2.5)),
    expect: { status: 'insufficientData', blocking: true },
  },
  {
    rule: 'R-CABLE-NO-OVERCURRENT',
    kind: 'notApplicable',
    title: 'câble sans charge (vers une boîte vide) derrière un différentiel : rien à protéger',
    build: () => prj(circuit('rcd', 40, 2.5, [node('junctionBox', {})], 'Attente', { residualCurrent: 30, rcdType: 'A' })),
    expect: 'silent',
  },
  {
    rule: 'R-CABLE-NO-OVERCURRENT',
    kind: 'notApplicable',
    title: 'câble en courant continu (nature saisie) : hors règle AC',
    build: () => {
      const c = circuit('rcd', 40, 2.5, undefined, 'DC', { residualCurrent: 30, rcdType: 'A' });
      cableOf(c).props.current = 'dc';
      return prj(c);
    },
    expect: 'silent',
  },

  // --- R-SOCKET-EARTH : contact de terre des socles (5.3.5.2 b), dérogation 8.2.1 point 6 b ---
  {
    rule: 'R-SOCKET-EARTH',
    kind: 'compliant',
    title: 'prise avec terre',
    build: () => prj(circuit('mcb', 20, 2.5, [node('socket', { earth: true })])),
    expect: 'silent',
  },
  {
    rule: 'R-SOCKET-EARTH',
    kind: 'nonCompliant',
    title: 'conception : prise sans terre → non conforme, bloquant',
    build: () => prj(circuit('mcb', 20, 2.5, [node('socket', { earth: false })])),
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-SOCKET-EARTH',
    kind: 'exception',
    title: 'partie d’avant 1981 sous 30 mA : dérogation 8.2.1 point 6 b possible (canalisation à vérifier)',
    build: () => old('1975', circuit('mcb', 16, 2.5, [node('socket', { earth: false })])),
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-SOCKET-EARTH',
    kind: 'exception',
    title: 'partie d’avant 1981 sans différentiel 30 mA (300 mA seul) : pas de dérogation → non conforme bloquant',
    build: () => onMainBoard(existing(project(), '1975'), circuit('mcb', 16, 2.5, [node('socket', { earth: false })])).p,
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-SOCKET-EARTH',
    kind: 'exception',
    title: 'ancien RGIE (1995) : aucune dérogation pour une prise sans terre → non conforme bloquant',
    build: () => old('1995-01-01', circuit('mcb', 16, 2.5, [node('socket', { earth: false })])),
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-SOCKET-EARTH',
    kind: 'exception',
    title: 'prise rasoir à transformateur de séparation individuel, sans terre : admise (5.3.5.2 b)',
    build: () => prj(circuit('mcb', 16, 2.5, [node('socket', { earth: false, socketKind: 'shaver' })])),
    expect: 'silent',
  },
  {
    rule: 'R-SOCKET-EARTH',
    kind: 'missingData',
    title: 'existant sans date (époque inconnue) : prise sans terre → vérification, non bloquant',
    build: () => old(undefined, circuit('mcb', 16, 2.5, [node('socket', { earth: false })])),
    expect: { status: 'manualCheck', blocking: false },
  },

  // --- R-SOCKET-CHILD : sécurité enfant des socles d'avant le 1/3/2025 (exigence non retrouvée : à vérifier) ---
  {
    rule: 'R-SOCKET-CHILD',
    kind: 'compliant',
    title: 'prise avec sécurité enfant (2024)',
    build: () => {
      const p = prj(circuit('mcb', 20, 2.5));
      p.meta.installationDate = '2024-06-01';
      return p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-SOCKET-CHILD',
    kind: 'nonCompliant',
    title: 'travaux entamés en 2024 : prise sans sécurité enfant → à vérifier, jamais bloquant',
    build: () => {
      const p = prj(circuit('mcb', 20, 2.5, [node('socket', { childSafety: false })]));
      p.meta.installationDate = '2024-06-01';
      return p;
    },
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-SOCKET-CHILD',
    kind: 'boundary',
    title: 'travaux entamés le 28/2/2025 (veille du 1/3/2025) : règle d’avant → à vérifier',
    build: () => {
      const p = prj(circuit('mcb', 20, 2.5, [node('socket', { childSafety: false })]));
      p.meta.installationDate = '2025-02-28';
      return p;
    },
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-SOCKET-CHILD',
    kind: 'transitional',
    title: 'travaux entamés le 1/3/2025 : la règle IPXX-D remplace celle d’avant',
    build: () => {
      const p = prj(circuit('mcb', 20, 2.5, [node('socket', { childSafety: false })]));
      p.meta.installationDate = '2025-03-01';
      return p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-SOCKET-CHILD',
    kind: 'transitional',
    title: 'date partielle « 2025 » (à cheval sur le 1/3/2025) : règle d’avant, à vérifier',
    build: () => {
      const p = prj(circuit('mcb', 20, 2.5, [node('socket', { childSafety: false })]));
      p.meta.installationDate = '2025';
      return p;
    },
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-SOCKET-CHILD',
    kind: 'transitional',
    title: 'partie d’avant 1981 (8.2.1 6 a) : maintien des socles conformes au Livre 1 d’avant 2025 → à vérifier',
    build: () => old('1975', circuit('mcb', 16, 2.5, [node('socket', { childSafety: false })])),
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-SOCKET-CHILD',
    kind: 'missingData',
    title: 'existant sans date : prise sans sécurité enfant → à vérifier',
    build: () => old(undefined, circuit('mcb', 16, 2.5, [node('socket', { childSafety: false })])),
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-SOCKET-CHILD',
    kind: 'exception',
    title: 'prise réservée à un appareil (2024) : exceptions de l’ancien texte inconnues → reste à vérifier',
    build: () => old('2024-06-01', circuit('mcb', 20, 2.5, [node('socket', { childSafety: false }, [ap('fridge', { power: 150 })])])),
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-SOCKET-CHILD',
    kind: 'notApplicable',
    title: 'prise triphasée (2024) : hors règle',
    build: () => old('2024-06-01', circuit('mcb', 16, 2.5, [node('socket', { childSafety: false, threePhase: true })])),
    expect: 'silent',
  },

  // --- R-SOCKET-IPXXD : socles ≤ 16 A au moins IPXX-D depuis le 1/3/2025 (5.3.5.2 a et c) ---
  {
    rule: 'R-SOCKET-IPXXD',
    kind: 'compliant',
    title: 'prise avec obturateurs',
    build: () => prj(circuit('mcb', 20, 2.5)),
    expect: 'silent',
  },
  {
    rule: 'R-SOCKET-IPXXD',
    kind: 'nonCompliant',
    title: 'conception (sans date) : prise sans obturateurs → non conforme, bloquant',
    build: () => prj(circuit('mcb', 20, 2.5, [node('socket', { childSafety: false })])),
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-SOCKET-IPXXD',
    kind: 'boundary',
    title: 'travaux entamés le 1/3/2025 (jour même) : IPXX-D exigé',
    build: () => {
      const p = prj(circuit('mcb', 20, 2.5, [node('socket', { childSafety: false })]));
      p.meta.installationDate = '2025-03-01';
      return p;
    },
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-SOCKET-IPXXD',
    kind: 'transitional',
    title: 'travaux entamés le 28/2/2025 (veille) : 5.3.5.2 c, règle d’avant (R-SOCKET-CHILD)',
    build: () => {
      const p = prj(circuit('mcb', 20, 2.5, [node('socket', { childSafety: false })]));
      p.meta.installationDate = '2025-02-28';
      return p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-SOCKET-IPXXD',
    kind: 'transitional',
    title: 'date partielle « 2025 » : application non établie, pas de constat IPXX-D',
    build: () => {
      const p = prj(circuit('mcb', 20, 2.5, [node('socket', { childSafety: false })]));
      p.meta.installationDate = '2025';
      return p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-SOCKET-IPXXD',
    kind: 'transitional',
    title: 'circuit posé en 2025-06 (installedOn) dans un existant de 1990 : non conforme (aucune dérogation)',
    build: () => {
      const c = circuit('mcb', 20, 2.5, [node('socket', { childSafety: false })]);
      c.props.installedOn = '2025-06';
      return old('1990-01-01', c);
    },
    expect: { status: 'nonCompliant' },
  },
  {
    rule: 'R-SOCKET-IPXXD',
    kind: 'exception',
    title: 'prise réservée à un appareil d’usage spécifique : dispensée',
    build: () => prj(circuit('mcb', 20, 2.5, [node('socket', { childSafety: false }, [ap('fridge', { power: 150 })])])),
    expect: 'silent',
  },
  {
    rule: 'R-SOCKET-IPXXD',
    kind: 'exception',
    title: 'socle placé dans un tableau de répartition : dispensé (5.3.5.2 a)',
    build: () => prj(circuit('mcb', 16, 2.5, [node('socket', { childSafety: false, inBoard: true })])),
    expect: 'silent',
  },
  {
    rule: 'R-SOCKET-IPXXD',
    kind: 'missingData',
    title: 'existant sans date : application non établie → pas de constat IPXX-D (R-SOCKET-CHILD le signale)',
    build: () => old(undefined, circuit('mcb', 16, 2.5, [node('socket', { childSafety: false })])),
    expect: 'silent',
  },
  {
    rule: 'R-SOCKET-IPXXD',
    kind: 'notApplicable',
    title: 'prise triphasée : hors règle (> 250 V ou > 16 A)',
    build: () => prj(circuit('mcb', 16, 2.5, [node('socket', { childSafety: false, threePhase: true })])),
    expect: 'silent',
  },

  // --- R-SOCKET-MAX : 8 socles par circuit, circuit mixte (5.3.5.2 b), dérogations 8.2.1 6 b / 8.2.2 6 ---
  {
    rule: 'R-SOCKET-MAX',
    kind: 'boundary',
    title: '8 socles : accepté',
    build: () => prj(circuit('mcb', 20, 2.5, sockets(8))),
    expect: 'silent',
  },
  {
    rule: 'R-SOCKET-MAX',
    kind: 'boundary',
    title: '9 socles : non conforme, bloquant',
    build: () => prj(circuit('mcb', 20, 2.5, sockets(9))),
    expect: { status: 'nonCompliant', blocking: true, params: { count: 9 } },
  },
  {
    rule: 'R-SOCKET-MAX',
    kind: 'compliant',
    title: '8 socles doubles : un socle multiple compte pour un',
    build: () => prj(circuit('mcb', 20, 2.5, sockets(8, { count: 2 }))),
    expect: 'silent',
  },
  {
    rule: 'R-SOCKET-MAX',
    kind: 'nonCompliant',
    title: 'circuit mixte : 7 socles + 2 points lumineux indépendants = 9',
    build: () => prj(circuit('mcb', 16, 2.5, [...sockets(7), ...lights(2)])),
    expect: { status: 'nonCompliant', blocking: true, params: { count: 9 } },
  },
  {
    rule: 'R-SOCKET-MAX',
    kind: 'compliant',
    title: 'circuit mixte : 7 socles + 2 points lumineux commandés par un même interrupteur = 8',
    build: () => prj(circuit('mcb', 16, 2.5, [...sockets(7), node('switch', {}, lights(2))])),
    expect: 'silent',
  },
  {
    rule: 'R-SOCKET-MAX',
    kind: 'compliant',
    title: 'appareil branché sur une prise : compté avec sa prise (8 au total)',
    build: () => prj(circuit('mcb', 20, 2.5, [...sockets(7), apSocket('fridge', { power: 150 })])),
    expect: 'silent',
  },
  {
    rule: 'R-SOCKET-MAX',
    kind: 'exception',
    title: 'ancien RGIE (1995), 9 socles : dérogation 8.2.2 point 6 sous condition de puissance → vérification',
    build: () => old('1995-01-01', circuit('mcb', 16, 2.5, sockets(9))),
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-SOCKET-MAX',
    kind: 'exception',
    title: 'partie d’avant 1981, 9 socles : dérogation 8.2.1 point 6 b sous condition → vérification',
    build: () => old('1975', circuit('mcb', 16, 2.5, sockets(9))),
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-SOCKET-MAX',
    kind: 'nonCompliant',
    title: 'partie existante sous le Livre 1 (2022), 9 socles : aucune dérogation → non conforme',
    build: () => old('2022-05-01', circuit('mcb', 16, 2.5, sockets(9))),
    expect: { status: 'nonCompliant', blocking: false },
  },
  {
    rule: 'R-SOCKET-MAX',
    kind: 'missingData',
    title: 'existant sans date, 9 socles : époque inconnue → vérification',
    build: () => old(undefined, circuit('mcb', 16, 2.5, sockets(9))),
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-SOCKET-MAX',
    kind: 'notApplicable',
    title: 'circuit d’éclairage de 12 points (sans socle) : pas de limite',
    build: () => prj(circuit('mcb', 16, 1.5, lights(12))),
    expect: 'silent',
  },

  // --- R-SOCKET-SECTION : 2,5 mm² pour un circuit à socle (5.2.1.2, tableau 5.1) ---
  {
    rule: 'R-SOCKET-SECTION',
    kind: 'boundary',
    title: 'circuit de prises en 2,5 mm² : accepté',
    build: () => prj(circuit('mcb', 20, 2.5)),
    expect: 'silent',
  },
  {
    rule: 'R-SOCKET-SECTION',
    kind: 'boundary',
    title: 'circuit de prises en 2,4 mm² (juste sous 2,5) : non conforme',
    build: () => prj(circuit('mcb', 16, 2.4)),
    expect: { status: 'nonCompliant', blocking: true, params: { section: 2.4 } },
  },
  {
    rule: 'R-SOCKET-SECTION',
    kind: 'nonCompliant',
    title: 'conception : circuit de prises en 1,5 mm² → non conforme, bloquant',
    build: () => prj(circuit('mcb', 16, 1.5)),
    expect: { status: 'nonCompliant', blocking: true, params: { section: 1.5 } },
  },
  {
    rule: 'R-SOCKET-SECTION',
    kind: 'nonCompliant',
    title: 'circuit mixte : prises en 2,5 mm² et tronçon d’éclairage en 1,5 mm² → non conforme',
    build: () =>
      prj(node('protection', { device: 'mcb', ratedCurrent: 16, curve: 'C', poles: '1P+N', circuitName: 'Mixte', breakingCapacity: 6 }, [
        node('cable', { section: 2.5, length: 5 }, [node('socket', {}), node('junctionBox', {}, [node('cable', { section: 1.5, length: 5 }, [light()])])]),
      ])),
    expect: { status: 'nonCompliant', blocking: true, params: { section: 1.5 } },
  },
  {
    rule: 'R-SOCKET-SECTION',
    kind: 'exception',
    title: 'partie d’avant 1981 : prises en 1,5 mm² → dérogation 8.2.1 point 5',
    build: () => old('1975', circuit('mcb', 16, 1.5)),
    expect: { status: 'derogation', blocking: false },
  },
  {
    rule: 'R-SOCKET-SECTION',
    kind: 'exception',
    title: 'partie d’avant 1981 : prises en 1 mm² sous 10 A → dérogation 8.2.1 point 5',
    build: () => old('1975', circuit('mcb', 10, 1)),
    expect: { status: 'derogation', blocking: false },
  },
  {
    rule: 'R-SOCKET-SECTION',
    kind: 'exception',
    title: 'partie d’avant 1981 : prises en 1 mm² sous 16 A → condition non remplie, non conforme',
    build: () => old('1975', circuit('mcb', 16, 1)),
    expect: { status: 'nonCompliant' },
  },
  {
    rule: 'R-SOCKET-SECTION',
    kind: 'exception',
    title: 'ancien RGIE (1995) : prises en 1,5 mm² → aucune dérogation (8.2.2), non conforme',
    build: () => old('1995-01-01', circuit('mcb', 16, 1.5)),
    expect: { status: 'nonCompliant' },
  },
  {
    rule: 'R-SOCKET-SECTION',
    kind: 'exception',
    title: 'socle simple dans un tableau, circuit intégré au tableau en 1,5 mm² sous 16 A : admis (tableau 5.1)',
    build: () => prj(circuit('mcb', 16, 1.5, [node('socket', { inBoard: true })])),
    expect: 'silent',
  },
  {
    rule: 'R-SOCKET-SECTION',
    kind: 'transitional',
    title: 'ancien RGIE, exécution avant le 17/5/1986 : 8.2.2 point 5 ne vise que les circuits sans socle → non conforme',
    build: () => old('1985-01-01', circuit('mcb', 10, 1)),
    expect: { status: 'nonCompliant' },
  },
  {
    rule: 'R-SOCKET-SECTION',
    kind: 'missingData',
    title: 'existant sans date : prises en 1,5 mm² → vérification',
    build: () => old(undefined, circuit('mcb', 16, 1.5)),
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-SOCKET-SECTION',
    kind: 'notApplicable',
    title: 'circuit d’éclairage (sans socle) en 1,5 mm² : hors règle',
    build: () => prj(circuit('mcb', 16, 1.5, [light()])),
    expect: 'silent',
  },

  // --- R-DEDICATED-CIRCUIT : circuits dédiés (5.2.1.2, 7.22.3) ---
  {
    rule: 'R-DEDICATED-CIRCUIT',
    kind: 'compliant',
    title: 'lave-linge seul sur sa prise',
    build: () => prj(circuit('mcb', 20, 2.5, [apSocket('washingMachine')])),
    expect: 'silent',
  },
  {
    rule: 'R-DEDICATED-CIRCUIT',
    kind: 'nonCompliant',
    title: 'conception : lave-linge et une autre prise sur le même circuit → non conforme, bloquant',
    build: () => prj(circuit('mcb', 20, 2.5, [apSocket('washingMachine'), node('socket', {})])),
    expect: { status: 'nonCompliant', blocking: true, params: { appliance: 'washingMachine', others: 1 } },
  },
  {
    rule: 'R-DEDICATED-CIRCUIT',
    kind: 'nonCompliant',
    title: 'borne de recharge partageant son circuit (7.22.3) → non conforme',
    build: () => prj(circuit('mcb', 20, 2.5, [ap('evCharger', { power: 3700 }), node('socket', {})])),
    expect: { status: 'nonCompliant', blocking: true, params: { appliance: 'evCharger' } },
  },
  {
    rule: 'R-DEDICATED-CIRCUIT',
    kind: 'boundary',
    title: 'chauffe-eau de 2 599 W partageant son circuit : sous le seuil, pas de circuit dédié exigé',
    build: () => prj(circuit('mcb', 20, 2.5, [ap('waterHeater', { power: 2599 }), node('socket', {})])),
    expect: 'silent',
  },
  {
    rule: 'R-DEDICATED-CIRCUIT',
    kind: 'boundary',
    title: 'chauffe-eau de 2 600 W partageant son circuit → non conforme',
    build: () => prj(circuit('mcb', 20, 2.5, [ap('waterHeater', { power: 2600 }), node('socket', {})])),
    expect: { status: 'nonCompliant', blocking: true, params: { appliance: 'waterHeater' } },
  },
  {
    rule: 'R-DEDICATED-CIRCUIT',
    kind: 'compliant',
    title: 'chauffage électrique fixe : deux radiateurs sur un même circuit dédié',
    build: () => prj(circuit('mcb', 16, 2.5, [ap('heater', { power: 1500 }), ap('heater', { power: 1500 })])),
    expect: 'silent',
  },
  {
    rule: 'R-DEDICATED-CIRCUIT',
    kind: 'nonCompliant',
    title: 'radiateur fixe et une prise sur le même circuit → non conforme',
    build: () => prj(circuit('mcb', 16, 2.5, [ap('heater', { power: 1500 }), node('socket', {})])),
    expect: { status: 'nonCompliant', blocking: true, params: { appliance: 'heater' } },
  },
  {
    rule: 'R-DEDICATED-CIRCUIT',
    kind: 'nonCompliant',
    title: 'moteur de 3 000 W partageant son circuit : machine à poste fixe ≥ 2 600 W → non conforme',
    build: () => prj(circuit('mcb', 20, 2.5, [node('motor', { power: 3000 }), node('socket', {})])),
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-DEDICATED-CIRCUIT',
    kind: 'missingData',
    title: 'chauffe-eau de puissance inconnue partageant son circuit → vérification, non bloquante',
    build: () => prj(circuit('mcb', 20, 2.5, [ap('waterHeater'), node('socket', {})])),
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-DEDICATED-CIRCUIT',
    kind: 'exception',
    title: 'partie d’avant 1981 : circuit non dédié laissé en service → dérogation 8.2.1 point 5',
    build: () => old('1975', circuit('mcb', 16, 2.5, [apSocket('washingMachine'), node('socket', {})])),
    expect: { status: 'derogation', blocking: false },
  },
  {
    rule: 'R-DEDICATED-CIRCUIT',
    kind: 'exception',
    title: 'ancien RGIE (1995) : dérogation 8.2.2 point 5 (examen de conformité non connu) → vérification',
    build: () => old('1995-01-01', circuit('mcb', 16, 2.5, [apSocket('washingMachine'), node('socket', {})])),
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-DEDICATED-CIRCUIT',
    kind: 'nonCompliant',
    title: 'partie existante sous le Livre 1 (2022) : aucune dérogation → non conforme',
    build: () => old('2022-05-01', circuit('mcb', 16, 2.5, [apSocket('washingMachine'), node('socket', {})])),
    expect: { status: 'nonCompliant', blocking: false },
  },
  {
    rule: 'R-DEDICATED-CIRCUIT',
    kind: 'missingData',
    title: 'existant sans date : époque inconnue → vérification',
    build: () => old(undefined, circuit('mcb', 16, 2.5, [apSocket('washingMachine'), node('socket', {})])),
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-DEDICATED-CIRCUIT',
    kind: 'notApplicable',
    title: 'réfrigérateur de 150 W avec d’autres prises : pas de circuit dédié exigé',
    build: () => prj(circuit('mcb', 20, 2.5, [apSocket('fridge', { power: 150 }), node('socket', {})])),
    expect: 'silent',
  },

  // --- R-VDROP : chute de tension (5.2.5 « règles de l'art » ; 3 % / 5 % usuels, norme non consultée) ---
  // 2,5 mm² Cu, 20 A, monophasé : 0,1565 % par mètre ; 5 % à 31,9 m.
  {
    rule: 'R-VDROP',
    kind: 'boundary',
    title: 'prises 2,5 mm², 20 A, 31,9 m : 4,99 % ≤ 5 %',
    build: () => prj(long(circuit('mcb', 20, 2.5), 31.9)),
    expect: 'silent',
  },
  {
    rule: 'R-VDROP',
    kind: 'boundary',
    title: 'prises 2,5 mm², 20 A, 32 m : 5,01 % > 5 % → avertissement, non bloquant',
    build: () => prj(long(circuit('mcb', 20, 2.5), 32)),
    expect: { status: 'warning', blocking: false, params: { max: 5 } },
  },
  {
    rule: 'R-VDROP',
    kind: 'boundary',
    title: 'éclairage seul 1,5 mm², 10 A, 22 m : 2,87 % ≤ 3 %',
    build: () => prj(long(circuit('mcb', 10, 1.5, [light()]), 22)),
    expect: 'silent',
  },
  {
    rule: 'R-VDROP',
    kind: 'boundary',
    title: 'éclairage seul 1,5 mm², 10 A, 24 m : 3,13 % > 3 % → avertissement',
    build: () => prj(long(circuit('mcb', 10, 1.5, [light()]), 24)),
    expect: { status: 'warning', blocking: false, params: { max: 3 } },
  },
  {
    rule: 'R-VDROP',
    kind: 'boundary',
    title: 'triphasé 3N × 400 V, 6 mm², 32 A, 90 m : 4,68 % ≤ 5 %',
    build: () => {
      const p = prj(long(circuit('mcb', 32, 6, [node('socket', { threePhase: true })], 'Triphasé', { poles: '3P+N' }), 90));
      p.meta.supply = '3N x 400V ~ 50Hz';
      return p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-VDROP',
    kind: 'boundary',
    title: 'triphasé 3N × 400 V, 6 mm², 32 A, 100 m : 5,2 % > 5 % → avertissement',
    build: () => {
      const p = prj(long(circuit('mcb', 32, 6, [node('socket', { threePhase: true })], 'Triphasé', { poles: '3P+N' }), 100));
      p.meta.supply = '3N x 400V ~ 50Hz';
      return p;
    },
    expect: { status: 'warning', blocking: false },
  },
  {
    rule: 'R-VDROP',
    kind: 'nonCompliant',
    title: 'chute cumulée : circuit de 25 m (3,9 %) derrière une alimentation de sous-tableau de 20 m (1,6 %) → 5,5 %',
    build: () => behindFeeder(20, long(circuit('mcb', 20, 2.5), 25)),
    expect: { status: 'warning', blocking: false },
  },
  {
    rule: 'R-VDROP',
    kind: 'compliant',
    title: 'le même circuit de 25 m sans alimentation de sous-tableau : 3,9 %',
    build: () => prj(long(circuit('mcb', 20, 2.5), 25)),
    expect: 'silent',
  },
  {
    rule: 'R-VDROP',
    kind: 'nonCompliant',
    title: 'partie existante (1995) : même avertissement, non bloquant',
    build: () => old('1995-01-01', long(circuit('mcb', 20, 2.5), 40)),
    expect: { status: 'warning', blocking: false },
  },
  {
    rule: 'R-VDROP',
    kind: 'missingData',
    title: 'puissances inconnues : calcul conservatif au calibre (40 m → 6,3 %) → avertissement',
    build: () => prj(long(circuit('mcb', 20, 2.5, [node('socket', {})]), 40)),
    expect: { status: 'warning', blocking: false },
  },
  {
    rule: 'R-VDROP',
    kind: 'missingData',
    title: 'longueur inconnue : chute non calculée → signalée (vérification), jamais passée sous silence',
    build: () => {
      const c = circuit('mcb', 20, 2.5);
      without(cableOf(c), 'length');
      return prj(c);
    },
    expect: { status: 'manualCheck', blocking: false },
    knownIssue: 'circuit non calculable (longueur manquante) : aucun constat, ce qui peut se lire comme « conforme »',
  },
  {
    rule: 'R-VDROP',
    kind: 'exception',
    title: 'alimentation par poste privé (limites différentes selon la norme)',
    build: () => prj(long(circuit('mcb', 20, 2.5), 40)),
    expect: { status: 'warning' },
    notModelled: 'le modèle ne distingue pas une alimentation par poste privé ; limites de la norme non consultées',
  },

  // --- R-VDROP-RATING : dépassement au calibre non confirmé par la méthode détaillée (information) ---
  {
    rule: 'R-VDROP-RATING',
    kind: 'nonCompliant',
    title: 'appareil de 500 W sur 40 m : 0,7 % détaillé, 6,3 % au calibre → information',
    build: () => prj(long(circuit('mcb', 20, 2.5, [apSocket('fridge', { power: 500 })]), 40)),
    expect: { status: 'recommendation', blocking: false, params: { max: 5 } },
  },
  {
    rule: 'R-VDROP-RATING',
    kind: 'compliant',
    title: 'appareil de 500 W sur 20 m : 3,1 % au calibre, rien à signaler',
    build: () => prj(long(circuit('mcb', 20, 2.5, [apSocket('fridge', { power: 500 })]), 20)),
    expect: 'silent',
  },
  {
    rule: 'R-VDROP-RATING',
    kind: 'nonCompliant',
    title: 'l’amont connu fait basculer : 30 m (4,7 %) + alimentation de 20 m (1,6 %) au calibre, détail faible → information',
    build: () => behindFeeder(20, long(circuit('mcb', 20, 2.5, [apSocket('fridge', { power: 500 })]), 30)),
    expect: { status: 'recommendation', blocking: false },
  },
  {
    rule: 'R-VDROP-RATING',
    kind: 'missingData',
    title: 'puissance de l’appareil inconnue : pas de méthode détaillée → c’est R-VDROP qui conclut',
    build: () => prj(long(circuit('mcb', 20, 2.5, [apSocket('fridge')]), 40)),
    expect: 'silent',
  },
  {
    rule: 'R-VDROP-RATING',
    kind: 'notApplicable',
    title: 'la méthode détaillée dépasse aussi (4 000 W sur 40 m) : R-VDROP, pas d’information',
    build: () => prj(long(circuit('mcb', 20, 2.5, [apSocket('other', { power: 4000 })]), 40)),
    expect: 'silent',
  },

  // --- R-ICC-LMAX : longueur maximale protégée (4.4.2.2 c « règles de l'art ») ; défaut phase-neutre à 230 V ---
  // 2,5 mm² Cu, C20 : seuil magnétique 200 A, Lmax = 0,8 × 230 × 2,5 / (2 × 0,0225 × 200) = 51,1 m.
  {
    rule: 'R-ICC-LMAX',
    kind: 'boundary',
    title: '2,5 mm², courbe C 20 A, 51 m (Lmax 51,1 m) : Icc min au-dessus du seuil',
    build: () => prj(long(circuit('mcb', 20, 2.5), 51)),
    expect: 'silent',
  },
  {
    rule: 'R-ICC-LMAX',
    kind: 'boundary',
    title: '2,5 mm², courbe C 20 A, 52 m : Icc min sous le seuil magnétique → avertissement, non bloquant',
    build: () => prj(long(circuit('mcb', 20, 2.5), 52)),
    expect: { status: 'warning', blocking: false, params: { magnetic: 200, length: 52, lmax: 51.1 } },
  },
  {
    rule: 'R-ICC-LMAX',
    kind: 'compliant',
    title: 'courbe B (seuil 5 In) : 60 m acceptés (Lmax 102 m)',
    build: () => prj(long(circuit('mcb', 20, 2.5, undefined, 'Circuit', { curve: 'B' }), 60)),
    expect: 'silent',
  },
  {
    rule: 'R-ICC-LMAX',
    kind: 'nonCompliant',
    title: 'courbe D (seuil 20 In) : 30 m dépassent Lmax (25,6 m)',
    build: () => prj(long(circuit('mcb', 20, 2.5, undefined, 'Circuit', { curve: 'D' }), 30)),
    expect: { status: 'warning', blocking: false, params: { magnetic: 400 } },
  },
  {
    rule: 'R-ICC-LMAX',
    kind: 'boundary',
    title: 'triphasé avec neutre 3N × 400 V, 6 mm², C32, 75 m : défaut phase-neutre à 230 V, Lmax 76,7 m',
    build: () => {
      const p = prj(long(circuit('mcb', 32, 6, [node('socket', { threePhase: true })], 'Triphasé', { poles: '3P+N' }), 75));
      p.meta.supply = '3N x 400V ~ 50Hz';
      return p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-ICC-LMAX',
    kind: 'boundary',
    title: 'triphasé avec neutre 3N × 400 V, 6 mm², C32, 80 m : au-delà de Lmax (76,7 m) → avertissement',
    build: () => {
      const p = prj(long(circuit('mcb', 32, 6, [node('socket', { threePhase: true })], 'Triphasé', { poles: '3P+N' }), 80));
      p.meta.supply = '3N x 400V ~ 50Hz';
      return p;
    },
    expect: { status: 'warning', blocking: false, params: { magnetic: 320, lmax: 76.7 } },
  },
  {
    rule: 'R-ICC-LMAX',
    kind: 'nonCompliant',
    title: 'câble amont connu : 45 m (seul : Icc 227 A) derrière une alimentation 10 mm² de 40 m → Icc 186 A < 200 A',
    build: () => behindFeeder(40, long(circuit('mcb', 20, 2.5), 45)),
    expect: { status: 'warning', blocking: false },
  },
  {
    rule: 'R-ICC-LMAX',
    kind: 'compliant',
    title: 'le même circuit de 45 m sans câble amont : Icc 227 A ≥ 200 A',
    build: () => prj(long(circuit('mcb', 20, 2.5), 45)),
    expect: 'silent',
  },
  {
    rule: 'R-ICC-LMAX',
    kind: 'exception',
    title: 'protection par fusible (pas de seuil magnétique) : longueur protégée non vérifiée → vérification',
    build: () => prj(long(circuit('fuse', 16, 2.5), 100)),
    expect: { status: 'manualCheck', blocking: false },
    knownIssue: 'fusible : aucun calcul et aucun constat ; attendu une information « longueur protégée non vérifiée » (4.4.2.2 c)',
  },
  {
    rule: 'R-ICC-LMAX',
    kind: 'missingData',
    title: 'longueur inconnue : Icc non calculé → signalé (vérification), pas silencieux',
    build: () => {
      const c = circuit('mcb', 20, 2.5);
      without(cableOf(c), 'length');
      return prj(c);
    },
    expect: { status: 'manualCheck', blocking: false },
    knownIssue: 'circuit non calculable (longueur manquante) : aucun constat de longueur protégée',
  },
];
