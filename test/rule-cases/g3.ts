/**
 * Cas des règles du lot g3 : protections et différentiels (voir types.ts et test/rules.cases.test.ts). Références : RGIE,
 * Livre 1, version 07 (15/09/2026) ; audit du lot g3 (4.2.4.3 b, 5.3.5.3 a, 4.4.4, 3.1.2.2 a, 8.2.1, 8.2.2, 6.5.8.1).
 */
import type { ElNode } from '../../src/model/types';
import type { RuleCase } from './types';
import { circuit, existing, node, project, type Built } from './fixtures';

const SOCKETS = () => circuit('mcb', 20, 2.5, [node('socket', {})], 'Prises');
const LIGHTS = () => circuit('mcb', 16, 1.5, [node('light', {})], 'Éclairage');
const appliance = (applianceType: string) => circuit('mcb', 20, 2.5, [node('socket', {}, [node('appliance', { applianceType })])], applianceType);
const lights = (count: number) => Array.from({ length: count }, (_, i) => circuit('mcb', 16, 1.5, [node('light', {})], 'C' + i));

/** Circuits raccordés directement au tableau principal, sous le seul différentiel général (300 mA). */
function onBoard(b: Built, ...cs: ElNode[]): Built {
  b.board.children.push(...cs);
  return b;
}

/** Aucun différentiel : l'appareil de tête devient un interrupteur et le 30 mA est retiré ; `cs` sur le tableau. */
function noRcd(b: Built, ...cs: ElNode[]): Built {
  b.main.props.device = 'switch';
  delete b.main.props.residualCurrent;
  delete b.main.props.rcdType;
  b.board.children = b.board.children.filter((c) => c !== b.rcd30);
  return onBoard(b, ...cs);
}

const threePhase230 = (b: Built): Built => {
  b.p.meta.supply = '3 x 230V ~ 50Hz';
  return b;
};

/** Projet neuf avec un circuit de prises ; `edit` modifie le premier circuit. */
function withCircuit(edit: (c: ElNode, b: Built) => void, c: ElNode = SOCKETS()): Built {
  const b = project(c);
  edit(c, b);
  return b;
}

export const CASES: RuleCase[] = [
  // --- R-PROT-RATING-MISSING (3.1.2.2 a, p. 64 : caractéristiques des protections sur l'unifilaire) ---
  { rule: 'R-PROT-RATING-MISSING', kind: 'compliant', title: 'calibres renseignés : rien', build: () => project(SOCKETS()).p, expect: 'silent' },
  {
    rule: 'R-PROT-RATING-MISSING',
    kind: 'compliant',
    title: 'calibre saisi en texte numérique (« 16 A ») : lu, rien',
    build: () => withCircuit((c) => (c.props.ratedCurrent = '16 A')).p,
    expect: 'silent',
  },
  {
    rule: 'R-PROT-RATING-MISSING',
    kind: 'missingData',
    title: 'neuf : calibre du disjoncteur absent → informations insuffisantes, bloquant',
    build: () => withCircuit((c) => delete c.props.ratedCurrent).p,
    expect: { status: 'insufficientData', blocking: true },
  },
  {
    rule: 'R-PROT-RATING-MISSING',
    kind: 'missingData',
    title: 'neuf : calibre du différentiel général absent → informations insuffisantes, bloquant',
    build: () => {
      const b = project(SOCKETS());
      delete b.main.props.ratedCurrent;
      return b.p;
    },
    expect: { status: 'insufficientData', blocking: true },
  },
  {
    rule: 'R-PROT-RATING-MISSING',
    kind: 'missingData',
    title: 'existant (2021) : calibre absent → informations insuffisantes, non bloquant',
    build: () => existing(withCircuit((c) => delete c.props.ratedCurrent), '2021-01-01').p,
    expect: { status: 'insufficientData', blocking: false },
  },
  {
    rule: 'R-PROT-RATING-MISSING',
    kind: 'exception',
    title: 'partie d’avant 1981 : schéma simplifié admis mais caractéristiques exigées (8.2.1, 7) → toujours signalé, non bloquant',
    build: () => existing(withCircuit((c) => delete c.props.ratedCurrent), '1975-01-01').p,
    expect: { status: 'insufficientData', blocking: false },
  },
  {
    rule: 'R-PROT-RATING-MISSING',
    kind: 'missingData',
    title: 'différentiel ajouté sans calibre saisi (valeur par défaut du modèle) → informations insuffisantes',
    build: () => {
      const b = project(SOCKETS());
      b.board.children.push(node('protection', { device: 'rcd', residualCurrent: 30, rcdType: 'A', poles: '2P' }));
      return b.p;
    },
    expect: { status: 'insufficientData' },
    knownIssue: 'calibre par défaut de 20 A appliqué par createNode (schema.ts) : aucune donnée manquante signalée (ADR-0007)',
  },

  // --- R-POLES-NO-NEUTRAL (4.4.4.1, 4.4.4.2, p. 119 : détection sur tous les conducteurs de ligne) ---
  {
    rule: 'R-POLES-NO-NEUTRAL',
    kind: 'nonCompliant',
    title: '3 × 230 V : disjoncteur 1P+N → non conforme, bloquant',
    build: () => threePhase230(project(SOCKETS())).p,
    expect: { status: 'nonCompliant', blocking: true, params: { poles: '1P+N' } },
  },
  {
    rule: 'R-POLES-NO-NEUTRAL',
    kind: 'nonCompliant',
    title: '3 × 230 V : disjoncteur 1P → non conforme, bloquant',
    build: () => threePhase230(withCircuit((c) => (c.props.poles = '1P'))).p,
    expect: { status: 'nonCompliant', blocking: true, params: { poles: '1P' } },
  },
  {
    rule: 'R-POLES-NO-NEUTRAL',
    kind: 'nonCompliant',
    title: 'alimentation notée « 3×230 V » (signe ×, sans espace) : reconnue, 1P+N non conforme',
    build: () => {
      const b = project(SOCKETS());
      b.p.meta.supply = '3×230 V';
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-POLES-NO-NEUTRAL',
    kind: 'compliant',
    title: '3 × 230 V : disjoncteur 2P → rien',
    build: () => threePhase230(withCircuit((c) => (c.props.poles = '2P'))).p,
    expect: 'silent',
  },
  {
    rule: 'R-POLES-NO-NEUTRAL',
    kind: 'exception',
    title: '3 × 230 V : disjoncteur différentiel 1P+N (exception de 4.4.4.2, à confirmer) → à vérifier, non bloquant',
    build: () => threePhase230(project(circuit('rcbo', 20, 2.5, [node('socket', {})], 'Prises', { residualCurrent: 30, rcdType: 'A' }))).p,
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-POLES-NO-NEUTRAL',
    kind: 'exception',
    title: 'partie d’avant 1981 : aucune dérogation (8.2.1, 1) → non conforme, bloquant',
    build: () => existing(threePhase230(project(SOCKETS())), '1975-01-01').p,
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-POLES-NO-NEUTRAL',
    kind: 'notApplicable',
    title: '2 × 230 V (monophasé avec neutre) : 1P+N → rien',
    build: () => project(SOCKETS()).p,
    expect: 'silent',
  },
  {
    rule: 'R-POLES-NO-NEUTRAL',
    kind: 'notApplicable',
    title: '3N × 400 V (neutre distribué) : 1P+N → rien',
    build: () => {
      const b = project(SOCKETS());
      b.p.meta.supply = '3N x 400V ~ 50Hz';
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-POLES-NO-NEUTRAL',
    kind: 'missingData',
    title: 'alimentation non renseignée : pas de constat ici (R-DOC-SUPPLY signale la donnée manquante)',
    build: () => {
      const b = project(SOCKETS());
      b.p.meta.supply = '';
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-POLES-NO-NEUTRAL',
    kind: 'missingData',
    title: '3 × 230 V : pôles du disjoncteur non renseignés → informations insuffisantes (on ne peut pas conclure)',
    build: () => threePhase230(withCircuit((c) => delete c.props.poles)).p,
    expect: { status: 'insufficientData' },
  },
  {
    rule: 'R-POLES-NO-NEUTRAL',
    kind: 'notApplicable',
    title: 'raccordement 2 × 230 V entre deux phases d’un réseau 3 × 230 V',
    build: () => project(SOCKETS()).p,
    expect: { status: 'nonCompliant' },
    notModelled: 'pas de champ « neutre distribué » ni « tension entre conducteurs » : l’absence de neutre ne se lit que dans le libellé 3 × 230 V',
  },

  // --- R-PROT-KA-MISSING (3.1.2.2 a / b, p. 64 ; 5.3.5.5 e, p. 171) ---
  { rule: 'R-PROT-KA-MISSING', kind: 'compliant', title: 'pouvoir de coupure renseigné : rien', build: () => project(SOCKETS()).p, expect: 'silent' },
  {
    rule: 'R-PROT-KA-MISSING',
    kind: 'missingData',
    title: 'neuf : disjoncteur sans pouvoir de coupure → informations insuffisantes, jamais bloquant',
    build: () => withCircuit((c) => delete c.props.breakingCapacity).p,
    expect: { status: 'insufficientData', blocking: false },
  },
  {
    rule: 'R-PROT-KA-MISSING',
    kind: 'missingData',
    title: 'fusible sans pouvoir de coupure → informations insuffisantes, non bloquant',
    build: () => project(circuit('fuse', 16, 2.5, [node('socket', {})], 'Prises', { breakingCapacity: undefined })).p,
    expect: { status: 'insufficientData', blocking: false },
  },
  {
    rule: 'R-PROT-KA-MISSING',
    kind: 'missingData',
    title: 'appareil non renseigné et pouvoir de coupure absent → informations insuffisantes',
    build: () =>
      withCircuit((c) => {
        delete c.props.device;
        delete c.props.breakingCapacity;
      }).p,
    expect: { status: 'insufficientData', blocking: false },
  },
  {
    rule: 'R-PROT-KA-MISSING',
    kind: 'exception',
    title: 'existant d’avant le 31/12/2007 (marquage classe 3 toléré, 8.2.2, 3) : la donnée reste demandée, non bloquante',
    build: () => existing(withCircuit((c) => delete c.props.breakingCapacity), '2005-01-01').p,
    expect: { status: 'insufficientData', blocking: false },
  },
  {
    rule: 'R-PROT-KA-MISSING',
    kind: 'notApplicable',
    title: 'interrupteur différentiel sans pouvoir de coupure : pas une protection contre les surintensités → rien',
    build: () => {
      const b = project(SOCKETS());
      delete b.main.props.breakingCapacity;
      delete b.rcd30.props.breakingCapacity;
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-PROT-KA-MISSING',
    kind: 'notApplicable',
    title: 'interrupteur-sectionneur sans pouvoir de coupure → rien',
    build: () => {
      const b = project(SOCKETS());
      b.board.children.push(node('protection', { device: 'switch', ratedCurrent: 40, breakingCapacity: undefined }));
      return b.p;
    },
    expect: 'silent',
  },

  // --- R-RCD-SENS-MISSING (3.1.2.2 a, p. 64 ; 8.2.1, 7, p. 274) ---
  { rule: 'R-RCD-SENS-MISSING', kind: 'compliant', title: 'sensibilités renseignées : rien', build: () => project(SOCKETS()).p, expect: 'silent' },
  {
    rule: 'R-RCD-SENS-MISSING',
    kind: 'missingData',
    title: 'neuf : sensibilité du 30 mA absente → informations insuffisantes, bloquant',
    build: () => {
      const b = project(SOCKETS());
      delete b.rcd30.props.residualCurrent;
      return b.p;
    },
    expect: { status: 'insufficientData', blocking: true },
  },
  {
    rule: 'R-RCD-SENS-MISSING',
    kind: 'missingData',
    title: 'existant (2021) : sensibilité absente → informations insuffisantes, non bloquant',
    build: () => {
      const b = existing(project(SOCKETS()), '2021-01-01');
      delete b.main.props.residualCurrent;
      return b.p;
    },
    expect: { status: 'insufficientData', blocking: false },
  },
  {
    rule: 'R-RCD-SENS-MISSING',
    kind: 'missingData',
    title: 'disjoncteur différentiel sans sensibilité → informations insuffisantes',
    build: () => project(circuit('rcbo', 20, 2.5, [node('socket', {})], 'Prises', { rcdType: 'A' })).p,
    expect: { status: 'insufficientData', blocking: true },
  },
  {
    rule: 'R-RCD-SENS-MISSING',
    kind: 'exception',
    title: 'partie d’avant 1981 : caractéristiques exigées sur le schéma simplifié (8.2.1, 7) → signalé, non bloquant',
    build: () => {
      const b = existing(project(SOCKETS()), '1975-01-01');
      delete b.main.props.residualCurrent;
      return b.p;
    },
    expect: { status: 'insufficientData', blocking: false },
  },
  {
    rule: 'R-RCD-SENS-MISSING',
    kind: 'notApplicable',
    title: 'disjoncteur simple (pas un différentiel) sans sensibilité → rien',
    build: () => project(LIGHTS()).p,
    expect: 'silent',
  },

  // --- R-RCD-SELECTIVITY (bonne pratique, pas d'exigence RGIE en domestique) ---
  { rule: 'R-RCD-SELECTIVITY', kind: 'compliant', title: '30 mA sous 300 mA : rien', build: () => project(SOCKETS()).p, expect: 'silent' },
  {
    rule: 'R-RCD-SELECTIVITY',
    kind: 'nonCompliant',
    title: '300 mA sous 300 mA → avertissement, jamais bloquant',
    build: () => {
      const b = project(SOCKETS());
      b.rcd30.props.residualCurrent = 300;
      return b.p;
    },
    expect: { status: 'warning', blocking: false, params: { up: 300, value: 300 } },
  },
  {
    rule: 'R-RCD-SELECTIVITY',
    kind: 'boundary',
    title: 'sensibilité aval égale à l’amont (30 sous 30) → avertissement',
    build: () => {
      const b = project(SOCKETS());
      b.main.props.residualCurrent = 30;
      return b.p;
    },
    expect: { status: 'warning', blocking: false, params: { up: 30, value: 30 } },
  },
  {
    rule: 'R-RCD-SELECTIVITY',
    kind: 'boundary',
    title: 'aval juste plus sensible (299 sous 300) → rien',
    build: () => {
      const b = project(SOCKETS());
      b.rcd30.props.residualCurrent = 299;
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-RCD-SELECTIVITY',
    kind: 'boundary',
    title: 'aval moins sensible (301 sous 300) → avertissement',
    build: () => {
      const b = project(SOCKETS());
      b.rcd30.props.residualCurrent = 301;
      return b.p;
    },
    expect: { status: 'warning', blocking: false },
  },
  {
    rule: 'R-RCD-SELECTIVITY',
    kind: 'nonCompliant',
    title: 'existant (2005) : 300 sous 300 → avertissement, non bloquant',
    build: () => {
      const b = existing(project(SOCKETS()), '2005-01-01');
      b.rcd30.props.residualCurrent = 300;
      return b.p;
    },
    expect: { status: 'warning', blocking: false },
  },
  {
    rule: 'R-RCD-SELECTIVITY',
    kind: 'missingData',
    title: 'sensibilité amont inconnue : pas de constat ici (R-RCD-SENS-MISSING la signale)',
    build: () => {
      const b = project(SOCKETS());
      delete b.main.props.residualCurrent;
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-RCD-SELECTIVITY',
    kind: 'missingData',
    title: 'différentiel amont retardé ou de type S (sélectivité temporelle)',
    build: () => project(SOCKETS()).p,
    expect: 'silent',
    notModelled: 'rcdType n’accepte que AC, A, F, B : ni type S ni retard représentables',
  },

  // --- R-RCD-MAIN (4.2.4.3 b, 1er alinéa, p. 100 : ≤ 300 mA à l'origine) ---
  { rule: 'R-RCD-MAIN', kind: 'compliant', title: 'circuit sous le 30 mA et le 300 mA : rien', build: () => project(SOCKETS()).p, expect: 'silent' },
  {
    rule: 'R-RCD-MAIN',
    kind: 'nonCompliant',
    title: 'neuf : aucun différentiel → non conforme, bloquant',
    build: () => noRcd(project(), LIGHTS()).p,
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-RCD-MAIN',
    kind: 'boundary',
    title: 'différentiel général de 300 mA exactement : rien',
    build: () => onBoard(project(), LIGHTS()).p,
    expect: 'silent',
  },
  {
    rule: 'R-RCD-MAIN',
    kind: 'boundary',
    title: 'différentiel général de 301 mA seul en amont → non conforme, bloquant',
    build: () => {
      const b = onBoard(project(), LIGHTS());
      b.main.props.residualCurrent = 301;
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-RCD-MAIN',
    kind: 'missingData',
    title: 'neuf : sensibilité du différentiel général inconnue → informations insuffisantes, bloquant',
    build: () => {
      const b = onBoard(project(), LIGHTS());
      delete b.main.props.residualCurrent;
      return b.p;
    },
    expect: { status: 'insufficientData', blocking: true },
  },
  {
    rule: 'R-RCD-MAIN',
    kind: 'missingData',
    title: 'relevé (2010) sans différentiel dessiné ni déclaration → informations insuffisantes, non bloquant',
    build: () => existing(noRcd(project(), LIGHTS()), '2010-01-01').p,
    expect: { status: 'insufficientData', blocking: false },
  },
  {
    rule: 'R-RCD-MAIN',
    kind: 'nonCompliant',
    title: 'relevé (2010) : absence confirmée → non conforme, bloquant',
    build: () => {
      const b = existing(noRcd(project(), LIGHTS()), '2010-01-01');
      b.p.meta.survey = { rcd: 'absent' };
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-RCD-MAIN',
    kind: 'missingData',
    title: 'relevé : absence déclarée alors qu’un ≤ 300 mA est dessiné ailleurs → informations contradictoires',
    build: () => {
      const b = existing(project(), '2010-01-01');
      b.main.props.device = 'switch';
      delete b.main.props.residualCurrent;
      onBoard(b, LIGHTS());
      b.p.meta.survey = { rcd: 'absent' };
      return b.p;
    },
    expect: { status: 'contradictory', blocking: false },
  },
  {
    rule: 'R-RCD-MAIN',
    kind: 'exception',
    title: 'partie d’avant 1981 avec un différentiel de 500 mA : aucune dérogation à la présence (8.2.1) → non conforme, bloquant',
    build: () => {
      const b = existing(onBoard(project(), LIGHTS()), '1975-01-01');
      b.main.props.residualCurrent = 500;
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-RCD-MAIN',
    kind: 'exception',
    title: 'différentiel au tableau principal, canalisation d’alimentation de classe II (2e alinéa)',
    build: () => project(SOCKETS()).p,
    expect: 'silent',
    notModelled: 'ni l’« origine » ni la classe II de la canalisation d’alimentation du tableau ne sont représentées',
  },

  // --- R-RCD30 (4.2.4.3 b, 5e alinéa, p. 101 ; dérogations 6.5.8.1, 1 ; 8.2.1, 16 ; 8.2.2, 10) ---
  { rule: 'R-RCD30', kind: 'compliant', title: 'neuf : prises sous le 30 mA → rien', build: () => project(SOCKETS()).p, expect: 'silent' },
  {
    rule: 'R-RCD30',
    kind: 'nonCompliant',
    title: 'neuf : prises sous le 300 mA seul → non conforme, bloquant',
    build: () => onBoard(project(), SOCKETS()).p,
    expect: { status: 'nonCompliant', blocking: true, params: { reason: 'sockets' } },
  },
  {
    rule: 'R-RCD30',
    kind: 'nonCompliant',
    title: 'neuf : éclairage sous le 300 mA seul → non conforme, bloquant',
    build: () => onBoard(project(), LIGHTS()).p,
    expect: { status: 'nonCompliant', blocking: true, params: { reason: 'lighting' } },
  },
  {
    rule: 'R-RCD30',
    kind: 'nonCompliant',
    title: 'neuf : salle de bain indiquée sous le 300 mA seul → non conforme, bloquant',
    build: () => onBoard(project(), circuit('mcb', 16, 2.5, [node('socket', {})], 'Salle de bain', { wetRoom: 'yes' })).p,
    expect: { status: 'nonCompliant', blocking: true, params: { reason: 'wetRoom' } },
  },
  {
    rule: 'R-RCD30',
    kind: 'nonCompliant',
    title: 'neuf : lave-linge sous le 300 mA seul → non conforme, bloquant',
    build: () => onBoard(project(), appliance('washingMachine')).p,
    expect: { status: 'nonCompliant', blocking: true, params: { reason: 'washingMachine' } },
  },
  {
    rule: 'R-RCD30',
    kind: 'nonCompliant',
    title: 'neuf : lave-vaisselle sous le 300 mA seul → non conforme, bloquant',
    build: () => onBoard(project(), appliance('dishwasher')).p,
    expect: { status: 'nonCompliant', blocking: true, params: { reason: 'dishwasher' } },
  },
  {
    rule: 'R-RCD30',
    kind: 'boundary',
    title: 'différentiel de 30 mA exactement (haute sensibilité, 2.6.4) → rien',
    build: () => project(SOCKETS()).p,
    expect: 'silent',
  },
  {
    rule: 'R-RCD30',
    kind: 'boundary',
    title: 'différentiel de 31 mA → pas de haute sensibilité : non conforme, bloquant',
    build: () => {
      const b = project(SOCKETS());
      b.rcd30.props.residualCurrent = 31;
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-RCD30',
    kind: 'boundary',
    title: 'différentiel de 10 mA (très haute sensibilité) → rien',
    build: () => {
      const b = project(SOCKETS());
      b.rcd30.props.residualCurrent = 10;
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-RCD30',
    kind: 'transitional',
    title: 'projet entamé la veille du 1/6/2023 (31/5/2023) : prises sous 300 mA → rien',
    build: () => {
      const b = onBoard(project(), SOCKETS());
      b.p.meta.installationDate = '2023-05-31';
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-RCD30',
    kind: 'transitional',
    title: 'projet entamé le 1/6/2023 : prises sous 300 mA → non conforme, bloquant',
    build: () => {
      const b = onBoard(project(), SOCKETS());
      b.p.meta.installationDate = '2023-06-01';
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-RCD30',
    kind: 'transitional',
    title: 'date partielle « 2023 » (à cheval sur le 1/6) : pas de constat R-RCD30, la question R-RCD30-DATE est posée',
    build: () => {
      const b = existing(onBoard(project(), SOCKETS()), '2023');
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-RCD30',
    kind: 'transitional',
    title: 'existant sans date : prises sous 300 mA → pas de constat R-RCD30, question R-RCD30-DATE sur le tableau',
    build: () => existing(onBoard(project(), SOCKETS())).p,
    expect: 'silent',
  },
  {
    rule: 'R-RCD30',
    kind: 'transitional',
    title: 'tableau ancien (2010) mais circuit de prises ajouté en 2024, absence de 30 mA confirmée → non conforme, bloquant',
    build: () => {
      const c = SOCKETS();
      c.props.installedOn = '2024-03';
      const b = existing(onBoard(project(), c), '2010-01-01');
      b.p.meta.survey = { rcd30: 'absent' };
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true, params: { reason: 'sockets' } },
  },
  {
    rule: 'R-RCD30',
    kind: 'exception',
    title: 'existant Livre 1 entamé avant le 1/6/2023 (2021) : prises et éclairage hors 30 mA (6.5.8.1, 1) → rien',
    build: () => existing(onBoard(project(), SOCKETS(), LIGHTS()), '2021-01-01').p,
    expect: 'silent',
  },
  {
    rule: 'R-RCD30',
    kind: 'exception',
    title: 'ancien RGIE (2005) : prises hors 30 mA (8.2.2, 10) → rien',
    build: () => existing(onBoard(project(), SOCKETS()), '2005-01-01').p,
    expect: 'silent',
  },
  {
    rule: 'R-RCD30',
    kind: 'exception',
    title: 'partie d’avant 1981 : prises hors 30 mA (8.2.1, 16) → rien',
    build: () => existing(onBoard(project(), SOCKETS()), '1975-01-01').p,
    expect: 'silent',
  },
  {
    rule: 'R-RCD30',
    kind: 'exception',
    title: 'neuf : prise dédiée à un appareil fixe (frigo) sous le 300 mA → rien',
    build: () => onBoard(project(), appliance('fridge')).p,
    expect: 'silent',
  },
  {
    rule: 'R-RCD30',
    kind: 'exception',
    title: 'partie d’avant 1981 : salle de bain sans 30 mA (absence confirmée) — point 3 sans dérogation → non conforme, bloquant',
    build: () => {
      const b = existing(onBoard(project(), circuit('mcb', 16, 2.5, [node('socket', {})], 'Salle de bain', { wetRoom: 'yes' })), '1975-01-01');
      b.p.meta.survey = { rcd30: 'absent' };
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true, params: { reason: 'wetRoom' } },
  },
  {
    rule: 'R-RCD30',
    kind: 'exception',
    title: 'ancien RGIE (2005) : sèche-linge sans 30 mA (absence confirmée) — point 4 sans dérogation → non conforme, bloquant',
    build: () => {
      const b = existing(onBoard(project(), appliance('dryer')), '2005-01-01');
      b.p.meta.survey = { rcd30: 'absent' };
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true, params: { reason: 'dryer' } },
  },
  {
    rule: 'R-RCD30',
    kind: 'missingData',
    title: 'relevé (1975) : salle de bain, 30 mA non dessiné et non déclaré → informations insuffisantes, non bloquant',
    build: () => existing(onBoard(project(), circuit('mcb', 16, 2.5, [node('socket', {})], 'Salle de bain', { wetRoom: 'yes' })), '1975-01-01').p,
    expect: { status: 'insufficientData', blocking: false },
  },
  {
    rule: 'R-RCD30',
    kind: 'missingData',
    title: 'neuf : sensibilité du différentiel amont inconnue → informations insuffisantes, bloquant',
    build: () => {
      const b = project(SOCKETS());
      delete b.rcd30.props.residualCurrent;
      return b.p;
    },
    expect: { status: 'insufficientData', blocking: true },
  },
  {
    rule: 'R-RCD30',
    kind: 'notApplicable',
    title: 'neuf : circuit de chauffe-eau (aucune raison du 5e alinéa) sous le 300 mA → rien',
    build: () => onBoard(project(), circuit('mcb', 20, 2.5, [node('appliance', { applianceType: 'waterHeater' })], 'Chauffe-eau')).p,
    expect: 'silent',
  },

  // --- R-RCD30-MAX (4.2.4.3 b, 6e alinéa, p. 101 : 8 circuits terminaux au plus par 30 mA) ---
  {
    rule: 'R-RCD30-MAX',
    kind: 'boundary',
    title: '8 circuits sous le 30 mA → rien',
    build: () => project(...lights(8)).p,
    expect: 'silent',
  },
  {
    rule: 'R-RCD30-MAX',
    kind: 'boundary',
    title: '9 circuits sous le 30 mA → non conforme, bloquant',
    build: () => project(...lights(9)).p,
    expect: { status: 'nonCompliant', blocking: true, params: { count: 9 } },
  },
  {
    rule: 'R-RCD30-MAX',
    kind: 'transitional',
    title: 'projet entamé le 31/5/2023, 9 circuits → rien',
    build: () => {
      const b = project(...lights(9));
      b.p.meta.installationDate = '2023-05-31';
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-RCD30-MAX',
    kind: 'transitional',
    title: 'projet entamé le 1/6/2023, 9 circuits → non conforme, bloquant',
    build: () => {
      const b = project(...lights(9));
      b.p.meta.installationDate = '2023-06-01';
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true, params: { count: 9 } },
  },
  {
    rule: 'R-RCD30-MAX',
    kind: 'nonCompliant',
    title: 'existant exécuté après le 1/6/2023 (2024), 9 circuits : aucune dérogation → non conforme, non bloquant',
    build: () => existing(project(...lights(9)), '2024-01-01').p,
    expect: { status: 'nonCompliant', blocking: false },
  },
  {
    rule: 'R-RCD30-MAX',
    kind: 'exception',
    title: 'existant Livre 1 d’avant le 1/6/2023 (2021), 9 circuits (6.5.8.1, 1) → rien',
    build: () => existing(project(...lights(9)), '2021-01-01').p,
    expect: 'silent',
  },
  {
    rule: 'R-RCD30-MAX',
    kind: 'exception',
    title: 'ancien RGIE (2005), 12 circuits (8.2.2, 10) → rien',
    build: () => existing(project(...lights(12)), '2005-01-01').p,
    expect: 'silent',
  },
  {
    rule: 'R-RCD30-MAX',
    kind: 'exception',
    title: 'partie d’avant 1981, 10 circuits (8.2.1, 16) → rien',
    build: () => existing(project(...lights(10)), '1975-01-01').p,
    expect: 'silent',
  },
  {
    rule: 'R-RCD30-MAX',
    kind: 'missingData',
    title: 'existant sans date, 9 circuits : pas de constat R-RCD30-MAX, question R-RCD30-DATE sur le tableau',
    build: () => existing(project(...lights(9))).p,
    expect: 'silent',
  },
  {
    rule: 'R-RCD30-MAX',
    kind: 'transitional',
    title: 'tableau de 2021 avec 8 circuits, 9e circuit ajouté en 2024 (nouvelle exécution, plus de dérogation) → non conforme, non bloquant',
    build: () => {
      const cs = lights(9);
      cs[8].props.installedOn = '2024-02';
      return existing(project(...cs), '2021-01-01').p;
    },
    expect: { status: 'nonCompliant', blocking: false },
  },
  {
    rule: 'R-RCD30-MAX',
    kind: 'notApplicable',
    title: '9 circuits d’éclairage sous le 300 mA seul (pas un 30 mA) → rien',
    build: () => onBoard(project(), ...lights(9)).p,
    expect: 'silent',
  },
  {
    rule: 'R-RCD30-MAX',
    kind: 'exception',
    title: '30 mA supplémentaire à l’origine alimentant plus de 8 circuits d’appareils fixes (8e alinéa)',
    build: () => project(...lights(9)).p,
    expect: { status: 'manualCheck' },
    notModelled: 'le modèle ne distingue pas un différentiel du 5e alinéa d’un différentiel supplémentaire placé à l’origine',
  },

  // --- R-RCD-TYPE-A (5.3.5.3 a, p. 168 : au moins type A) ---
  {
    rule: 'R-RCD-TYPE-A',
    kind: 'nonCompliant',
    title: 'neuf : différentiel général de type AC → non conforme, bloquant',
    build: () => {
      const b = project(SOCKETS());
      b.main.props.rcdType = 'AC';
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-RCD-TYPE-A',
    kind: 'nonCompliant',
    title: 'neuf : disjoncteur différentiel de type AC → non conforme, bloquant',
    build: () => project(circuit('rcbo', 20, 2.5, [node('socket', {})], 'Prises', { residualCurrent: 30, rcdType: 'AC' })).p,
    expect: { status: 'nonCompliant', blocking: true },
  },
  { rule: 'R-RCD-TYPE-A', kind: 'compliant', title: 'différentiels de type A → rien', build: () => project(SOCKETS()).p, expect: 'silent' },
  {
    rule: 'R-RCD-TYPE-A',
    kind: 'compliant',
    title: 'différentiels de type F et B → rien',
    build: () => {
      const b = project(SOCKETS());
      b.main.props.rcdType = 'B';
      b.rcd30.props.rcdType = 'F';
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-RCD-TYPE-A',
    kind: 'missingData',
    title: 'neuf : type non renseigné → informations insuffisantes, bloquant',
    build: () => {
      const b = project(SOCKETS());
      delete b.main.props.rcdType;
      return b.p;
    },
    expect: { status: 'insufficientData', blocking: true },
  },
  {
    rule: 'R-RCD-TYPE-A',
    kind: 'missingData',
    title: 'existant (2021) : type non renseigné → informations insuffisantes, non bloquant',
    build: () => {
      const b = existing(project(SOCKETS()), '2021-01-01');
      delete b.main.props.rcdType;
      return b.p;
    },
    expect: { status: 'insufficientData', blocking: false },
  },
  {
    rule: 'R-RCD-TYPE-A',
    kind: 'exception',
    title: 'existant Livre 1 (2021) : type AC, aucune dérogation → non conforme, non bloquant (gravité moyenne)',
    build: () => {
      const b = existing(project(SOCKETS()), '2021-01-01');
      b.main.props.rcdType = 'AC';
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: false },
  },
  {
    rule: 'R-RCD-TYPE-A',
    kind: 'exception',
    title: 'ancien RGIE (2010) : type AC, exigence de l’époque inconnue → à vérifier, non bloquant',
    build: () => {
      const b = existing(project(SOCKETS()), '2010-01-01');
      b.main.props.rcdType = 'AC';
      return b.p;
    },
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-RCD-TYPE-A',
    kind: 'exception',
    title: 'partie d’avant 1981 : type AC → à vérifier, non bloquant',
    build: () => {
      const b = existing(project(SOCKETS()), '1975-01-01');
      b.main.props.rcdType = 'AC';
      return b.p;
    },
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-RCD-TYPE-A',
    kind: 'transitional',
    title: 'Livre 1 entré en vigueur le 1/6/2020 : existant du 31/5/2020 à vérifier, du 1/6/2020 non conforme',
    build: () => {
      const b = existing(project(SOCKETS()), '2020-05-31');
      b.main.props.rcdType = 'AC';
      return b.p;
    },
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-RCD-TYPE-A',
    kind: 'transitional',
    title: 'existant entamé le 1/6/2020 (Livre 1) : type AC → non conforme, non bloquant',
    build: () => {
      const b = existing(project(SOCKETS()), '2020-06-01');
      b.main.props.rcdType = 'AC';
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: false },
  },
  {
    rule: 'R-RCD-TYPE-A',
    kind: 'missingData',
    title: 'existant sans date : type AC → à vérifier, non bloquant',
    build: () => {
      const b = existing(project(SOCKETS()));
      b.main.props.rcdType = 'AC';
      return b.p;
    },
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-RCD-TYPE-A',
    kind: 'notApplicable',
    title: 'disjoncteur simple (pas un différentiel) sans type → rien',
    build: () => project(LIGHTS()).p,
    expect: 'silent',
  },

  // --- R-RCD-HEAD-RATING (5.3.5.3 a, p. 168 : différentiel de tête ≥ 40 A ; 8.2.1, 2 ; 8.2.2, 2) ---
  {
    rule: 'R-RCD-HEAD-RATING',
    kind: 'boundary',
    title: 'neuf : différentiel de tête de 39 A → non conforme, bloquant',
    build: () => {
      const b = project(SOCKETS());
      b.main.props.ratedCurrent = 39;
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true, params: { value: 39 } },
  },
  { rule: 'R-RCD-HEAD-RATING', kind: 'boundary', title: 'différentiel de tête de 40 A → rien', build: () => project(SOCKETS()).p, expect: 'silent' },
  {
    rule: 'R-RCD-HEAD-RATING',
    kind: 'compliant',
    title: 'différentiel de tête de 63 A → rien',
    build: () => {
      const b = project(SOCKETS());
      b.main.props.ratedCurrent = 63;
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-RCD-HEAD-RATING',
    kind: 'notApplicable',
    title: 'différentiel en aval (30 mA de 25 A) : pas en tête → rien',
    build: () => {
      const b = project(SOCKETS());
      b.rcd30.props.ratedCurrent = 25;
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-RCD-HEAD-RATING',
    kind: 'exception',
    title: 'ancien RGIE entamé le 15/9/1991 : 25 A laissé en service (8.2.2, 2) → rien',
    build: () => {
      const b = existing(project(SOCKETS()), '1991-09-15');
      b.main.props.ratedCurrent = 25;
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-RCD-HEAD-RATING',
    kind: 'exception',
    title: 'existant entamé le 16/9/1991 : 25 A, plus de dérogation → non conforme, non bloquant',
    build: () => {
      const b = existing(project(SOCKETS()), '1991-09-16');
      b.main.props.ratedCurrent = 25;
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: false, params: { value: 25 } },
  },
  {
    rule: 'R-RCD-HEAD-RATING',
    kind: 'exception',
    title: 'partie d’avant 1981 : 25 A (8.2.1, 2, sans date limite) → rien',
    build: () => {
      const b = existing(project(SOCKETS()), '1975-01-01');
      b.main.props.ratedCurrent = 25;
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-RCD-HEAD-RATING',
    kind: 'exception',
    title: 'différentiel marqué « partie ancienne » dans un existant de 2005 → rien',
    build: () => {
      const b = existing(project(SOCKETS()), '2005-01-01');
      b.main.props.ratedCurrent = 25;
      b.main.props.oldPart = true;
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-RCD-HEAD-RATING',
    kind: 'exception',
    title: 'disjoncteur différentiel de 20 A sans différentiel en amont (« en tête » ?) → à vérifier, non bloquant',
    build: () => noRcd(project(), circuit('rcbo', 20, 2.5, [node('socket', {})], 'Prises', { residualCurrent: 30, rcdType: 'A' })).p,
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-RCD-HEAD-RATING',
    kind: 'transitional',
    title: 'existant daté « 1991 » (à cheval sur le 16/9) : 25 A → à vérifier, non bloquant',
    build: () => {
      const b = existing(project(SOCKETS()), '1991');
      b.main.props.ratedCurrent = 25;
      return b.p;
    },
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-RCD-HEAD-RATING',
    kind: 'missingData',
    title: 'existant sans date : 25 A → à vérifier, non bloquant',
    build: () => {
      const b = existing(project(SOCKETS()));
      b.main.props.ratedCurrent = 25;
      return b.p;
    },
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-RCD-HEAD-RATING',
    kind: 'missingData',
    title: 'calibre du différentiel de tête inconnu : pas de constat ici (R-PROT-RATING-MISSING le signale)',
    build: () => {
      const b = project(SOCKETS());
      delete b.main.props.ratedCurrent;
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-RCD-HEAD-RATING',
    kind: 'missingData',
    title: 'différentiel de tête créé sans calibre saisi (20 A par défaut du modèle) : ne pas conclure sur une valeur jamais saisie',
    build: () => {
      const b = project(SOCKETS());
      const head = node('protection', { device: 'rcd', residualCurrent: 300, rcdType: 'A', poles: '2P' }, b.main.children);
      b.p.roots[0].children[0].children = [head];
      return b.p;
    },
    expect: 'silent',
    knownIssue: 'calibre par défaut de 20 A appliqué par createNode : non-conformité déclarée sur une valeur jamais saisie (audit g3, verdict c)',
  },
];
