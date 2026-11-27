/**
 * Cas des règles du lot g2 (voir types.ts et test/rules.cases.test.ts) : terre, isolement, liaisons, essais des
 * différentiels, salles de bain (indice au nom), borne de recharge, photovoltaïque, date du tableau (1/6/2023).
 * Références : RGIE Livre 1, version 07 du 15/09/2026 ; audit du lot g2.
 */
import type { ElNode } from '../../src/model/types';
import { circuit, existing, node, project, type Built } from './fixtures';
import type { RuleCase } from './types';

// --- Fabriques locales ---

/** Retire la barrette et la prise de terre dessinées. */
function noEarth(b: Built): Built {
  b.board.children = b.board.children.filter((x) => x.kind !== 'earthBar');
  return b;
}

/** Circuit de `n` socles. */
const sockets = (n: number, name = 'Prises') => circuit('mcb', 16, 2.5, Array.from({ length: n }, () => node('socket')), name);

/** Différentiel de sensibilité `mA` (40 A, type A) et ses circuits, avec un essai noté. */
function rcd(b: Built, mA: number, children: ElNode[], parent: ElNode = b.board): ElNode {
  const r = node('protection', { device: 'rcd', ratedCurrent: 40, residualCurrent: mA, poles: '2P', rcdType: 'A' }, children);
  parent.children.push(r);
  b.p.measurements.rcdTests = { ...b.p.measurements.rcdTests, [r.id]: { tripMs: 25, ok: true } };
  return r;
}

/**
 * Terre à `re` Ω et configuration du 10e alinéa de 4.2.4.3 b conforme : deux différentiels 30 mA (16 socles sous le
 * premier, 1 sous le second), aucun circuit hors 30 mA.
 */
function earth30(re: number, firstGroup: ElNode[] = [sockets(8), sockets(8)]): Built {
  const b = project(...firstGroup);
  rcd(b, 30, [node('board', { name: '30 mA bis' }, [sockets(1, 'Prises garage')])]);
  b.p.measurements.earthResistanceOhm = re;
  return b;
}

/** Projet à un seul différentiel 30 mA, terre à `re` Ω (configuration du 10e alinéa non respectée). */
function oneRcd30(re: number): Built {
  const b = project(sockets(4));
  b.p.measurements.earthResistanceOhm = re;
  return b;
}

/** Circuit d'un appareil fixe (radiateur) nommé `name`, placé hors 30 mA (sous le différentiel général). */
function wetNamed(name: string, b: Built = project()): Built {
  b.board.children.push(circuit('mcb', 20, 2.5, [node('appliance', { applianceType: 'heater' })], name));
  return b;
}

/** Installation existante, circuit de prises hors 30 mA au tableau principal (règles 30 mA du 1/6/2023 en jeu). */
function socketsOutside30(date?: string): Built {
  const b = existing(project(), date);
  b.board.children.push(sockets(2));
  return b;
}

const ev = () => node('appliance', { applianceType: 'evCharger' });
const evProject = () => project(circuit('mcb', 32, 6, [ev()], 'Borne'));

export const CASES: RuleCase[] = [
  // ===================== R-EARTH-MISSING (4.2.3.2, 5.4.2.1) =====================
  { rule: 'R-EARTH-MISSING', kind: 'compliant', title: 'prise de terre dessinée', build: () => project().p, expect: 'silent' },
  {
    rule: 'R-EARTH-MISSING',
    kind: 'nonCompliant',
    title: 'neuf : prise de terre non dessinée → absente du projet, bloquant',
    build: () => noEarth(project()).p,
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-EARTH-MISSING',
    kind: 'missingData',
    title: 'existant non dessiné, rien de déclaré → informations insuffisantes, non bloquant',
    build: () => noEarth(existing(project())).p,
    expect: { status: 'insufficientData', blocking: false },
  },
  {
    rule: 'R-EARTH-MISSING',
    kind: 'nonCompliant',
    title: 'existant, absence confirmée → non conforme, bloquant',
    build: () => {
      const b = noEarth(existing(project(), '2010-01-01'));
      b.p.meta.survey = { earth: 'absent' };
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-EARTH-MISSING',
    kind: 'exception',
    title: 'partie d’avant 1981, absence confirmée : aucune dérogation (partie 8, 6.5.8) → non conforme, bloquant',
    build: () => {
      const b = noEarth(existing(project(), '1975-01-01'));
      b.p.meta.survey = { earth: 'absent' };
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-EARTH-MISSING',
    kind: 'exception',
    title: 'appartement sur prise de terre commune (5.4.2.1 c) : liaison au sectionneur commun acceptée',
    build: () => noEarth(project()).p,
    expect: 'silent',
    notModelled: 'pas de notion de prise de terre commune ni de sectionneur de terre dans le modèle',
  },
  {
    rule: 'R-EARTH-MISSING',
    kind: 'transitional',
    title: 'exigence permanente : partie de 1975 non dessinée → informations insuffisantes (pas de dérogation datée)',
    build: () => noEarth(existing(project(), '1975-01-01')).p,
    expect: { status: 'insufficientData', blocking: false },
  },
  {
    rule: 'R-EARTH-MISSING',
    kind: 'transitional',
    title: 'immeuble à appartements construit depuis le 1/6/2020 : prise de terre commune obligatoire',
    build: () => project().p,
    expect: 'silent',
    notModelled: 'ni type de bâtiment, ni prise de terre commune, ni boucle à fond de fouille dans le modèle',
  },
  {
    rule: 'R-EARTH-MISSING',
    kind: 'exception',
    title: 'dessinée mais déclarée absente → informations contradictoires, non bloquant',
    build: () => {
      const b = existing(project());
      b.p.meta.survey = { earth: 'absent' };
      return b.p;
    },
    expect: { status: 'contradictory', blocking: false },
  },
  {
    rule: 'R-EARTH-MISSING',
    kind: 'notApplicable',
    title: 'déclarée présente sans être dessinée : pas de constat ici (schéma incomplet, R-DOC-NOT-DRAWN)',
    build: () => {
      const b = noEarth(existing(project()));
      b.p.meta.survey = { earth: 'present' };
      return b.p;
    },
    expect: 'silent',
  },

  // ===================== R-EARTH-VALUE (4.2.3.2 : « inférieure à 100 Ω ») =====================
  { rule: 'R-EARTH-VALUE', kind: 'compliant', title: '20 Ω', build: () => project().p, expect: 'silent' },
  {
    rule: 'R-EARTH-VALUE',
    kind: 'boundary',
    title: '99,9 Ω : conforme',
    build: () => {
      const b = project();
      b.p.measurements.earthResistanceOhm = 99.9;
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-EARTH-VALUE',
    kind: 'boundary',
    title: '100 Ω pile : non conforme (strictement inférieure exigée), bloquant',
    build: () => {
      const b = project();
      b.p.measurements.earthResistanceOhm = 100;
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true, params: { value: 100 } },
  },
  {
    rule: 'R-EARTH-VALUE',
    kind: 'boundary',
    title: '100,1 Ω : non conforme',
    build: () => {
      const b = project();
      b.p.measurements.earthResistanceOhm = 100.1;
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-EARTH-VALUE',
    kind: 'exception',
    title: 'partie d’avant 1981 à 150 Ω : aucune dérogation au seuil → non conforme, bloquant',
    build: () => {
      const b = existing(project(), '1975-01-01');
      b.p.measurements.earthResistanceOhm = 150;
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-EARTH-VALUE',
    kind: 'exception',
    title: 'prise de terre commune à 45 Ω : seuil de 30 Ω (5.4.2.1 c.2 1°) → non conforme',
    build: () => project().p,
    expect: { status: 'nonCompliant' },
    notModelled: 'pas de propriété « prise de terre commune » : le seuil de 30 Ω ne peut pas être choisi',
  },
  {
    rule: 'R-EARTH-VALUE',
    kind: 'missingData',
    title: 'résistance non mesurée : pas de conclusion ici (la mesure est demandée par R-MEAS-MISSING), jamais « conforme »',
    build: () => {
      const b = project();
      delete b.p.measurements.earthResistanceOhm;
      return b.p;
    },
    expect: 'silent',
  },

  // ===================== R-EARTH-30 (4.2.4.3 b, 10e al. ; 6.5.8.1, 1 ; 8.2.1, 16 ; 8.2.2, 10) =====================
  {
    rule: 'R-EARTH-30',
    kind: 'compliant',
    title: '50 Ω, deux 30 mA de 16 socles au plus, tous les circuits sous 30 mA',
    build: () => earth30(50).p,
    expect: 'silent',
  },
  {
    rule: 'R-EARTH-30',
    kind: 'notApplicable',
    title: '20 Ω avec un seul 30 mA : pas de mesures complémentaires',
    build: () => oneRcd30(20).p,
    expect: 'silent',
  },
  {
    rule: 'R-EARTH-30',
    kind: 'boundary',
    title: '30 Ω pile, un seul 30 mA : rien (« supérieure à 30 Ω »)',
    build: () => oneRcd30(30).p,
    expect: 'silent',
  },
  {
    rule: 'R-EARTH-30',
    kind: 'boundary',
    title: '30,1 Ω, un seul 30 mA : moins de deux différentiels haute sensibilité → non conforme, bloquant',
    build: () => oneRcd30(30.1).p,
    expect: { status: 'nonCompliant', blocking: true, params: { rcd30: 1 } },
  },
  {
    rule: 'R-EARTH-30',
    kind: 'boundary',
    title: '99,9 Ω, un seul 30 mA : non conforme (la règle des 100 Ω ne la remplace pas encore)',
    build: () => oneRcd30(99.9).p,
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-EARTH-30',
    kind: 'notApplicable',
    title: '100 Ω : relève de R-EARTH-VALUE, pas de second constat',
    build: () => oneRcd30(100).p,
    expect: 'silent',
  },
  {
    rule: 'R-EARTH-30',
    kind: 'boundary',
    title: '50 Ω, deux 30 mA, 16 socles sous le premier : conforme',
    build: () => earth30(50, [sockets(8), sockets(8)]).p,
    expect: 'silent',
  },
  {
    rule: 'R-EARTH-30',
    kind: 'boundary',
    title: '50 Ω, deux 30 mA, 17 socles sous le premier : non conforme',
    build: () => earth30(50, [sockets(8), sockets(9)]).p,
    expect: { status: 'nonCompliant', blocking: true, params: { maxSockets: 17 } },
  },
  {
    rule: 'R-EARTH-30',
    kind: 'boundary',
    title: '50 Ω, 15 socles + 2 points lumineux (appareils fixes assimilés à des socles) sous un 30 mA : 17 → non conforme',
    build: () => earth30(50, [sockets(8), sockets(7), circuit('mcb', 10, 1.5, [node('light'), node('light')], 'Éclairage')]).p,
    expect: { status: 'nonCompliant', blocking: true },
    knownIssue: 'seuls les socles sont comptés ; 4.2.4.3 b 10e al. assimile un appareil fixe (ou un ensemble sous une même commande) à un socle',
  },
  {
    rule: 'R-EARTH-30',
    kind: 'nonCompliant',
    title: '50 Ω, deux 30 mA, circuit raccordé au différentiel d’origine (300 mA) sans 100 mA → non conforme',
    build: () => {
      const b = earth30(50);
      b.board.children.push(circuit('mcb', 20, 2.5, [node('appliance', { applianceType: 'oven' })], 'Four'));
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true, params: { without100: 1 } },
  },
  {
    rule: 'R-EARTH-30',
    kind: 'boundary',
    title: '50 Ω, circuit d’origine sous un différentiel de 100 mA : conforme',
    build: () => {
      const b = earth30(50);
      rcd(b, 100, [circuit('mcb', 20, 2.5, [node('appliance', { applianceType: 'oven' })], 'Four')]);
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-EARTH-30',
    kind: 'boundary',
    title: '50 Ω, circuit d’origine sous un second différentiel de 300 mA (> 100 mA) : non conforme',
    build: () => {
      const b = earth30(50);
      rcd(b, 300, [circuit('mcb', 20, 2.5, [node('appliance', { applianceType: 'oven' })], 'Four')]);
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-EARTH-30',
    kind: 'exception',
    title: 'exécution entamée avant le 1/6/2023 (variante dérogatoire non détaillée) → à vérifier, non bloquant',
    build: () => {
      const b = existing(oneRcd30(50), '2022-05-01');
      return b.p;
    },
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-EARTH-30',
    kind: 'exception',
    title: 'projet entamé avant le 1/6/2023 et contrôlé après, organisme agréé informé (4.2.4.3 b, dernier al.)',
    build: () => oneRcd30(50).p,
    expect: { status: 'manualCheck' },
    notModelled: 'ni date de début des travaux distincte de la date de contrôle, ni information de l’organisme agréé',
  },
  {
    rule: 'R-EARTH-30',
    kind: 'transitional',
    title: 'existant du 31/05/2023 (veille) → à vérifier',
    build: () => existing(oneRcd30(50), '2023-05-31').p,
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-EARTH-30',
    kind: 'transitional',
    title: 'existant du 01/06/2023 (jour même) : règle du 10e alinéa → non conforme',
    build: () => existing(oneRcd30(50), '2023-06-01').p,
    expect: { status: 'nonCompliant' },
  },
  {
    rule: 'R-EARTH-30',
    kind: 'transitional',
    title: 'date partielle « 2023 » (à cheval sur le 1/6/2023) → à vérifier, jamais la règle ni la dérogation d’office',
    build: () => existing(oneRcd30(50), '2023').p,
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-EARTH-30',
    kind: 'transitional',
    title: 'date partielle « 2023-06 » (après le 1/6/2023) → non conforme',
    build: () => existing(oneRcd30(50), '2023-06').p,
    expect: { status: 'nonCompliant' },
  },
  {
    rule: 'R-EARTH-30',
    kind: 'missingData',
    title: 'existant sans date (date d’exécution inconnue) → à vérifier, non bloquant',
    build: () => existing(oneRcd30(50)).p,
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-EARTH-30',
    kind: 'missingData',
    title: 'neuf, 50 Ω, second différentiel de sensibilité inconnue → informations insuffisantes (jamais conclu sur une valeur inconnue)',
    build: () => {
      const b = oneRcd30(50);
      const r = rcd(b, 30, [node('board', { name: 'Sensibilité inconnue' }, [sockets(2)])]);
      delete r.props.residualCurrent;
      return b.p;
    },
    expect: { status: 'insufficientData' },
    knownIssue: 'une sensibilité inconnue est comptée comme « pas haute sensibilité » → non conforme au lieu d’informations insuffisantes',
  },
  {
    rule: 'R-EARTH-30',
    kind: 'transitional',
    title: 'prise de terre commune (immeubles depuis le 1/6/2020) à 31 Ω → non conforme (5.4.2.1 c.2 1°)',
    build: () => earth30(31).p,
    expect: { status: 'nonCompliant' },
    notModelled: 'pas de propriété « prise de terre commune »',
  },

  // ===================== R-INSULATION (6.4.5.1, tableau 6.1 : ≥ 0,5 MΩ sous 500 V) =====================
  { rule: 'R-INSULATION', kind: 'compliant', title: '10 MΩ', build: () => project().p, expect: 'silent' },
  {
    rule: 'R-INSULATION',
    kind: 'boundary',
    title: '0,49 MΩ : non conforme, bloquant',
    build: () => {
      const b = project();
      b.p.measurements.insulationMOhm = 0.49;
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true, params: { value: 0.49 } },
  },
  {
    rule: 'R-INSULATION',
    kind: 'boundary',
    title: '0,5 MΩ pile : conforme (« au moins égale »)',
    build: () => {
      const b = project();
      b.p.measurements.insulationMOhm = 0.5;
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-INSULATION',
    kind: 'boundary',
    title: '0,51 MΩ : conforme',
    build: () => {
      const b = project();
      b.p.measurements.insulationMOhm = 0.51;
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-INSULATION',
    kind: 'exception',
    title: 'partie de 1975 à 0,3 MΩ : aucune dérogation → non conforme, bloquant',
    build: () => {
      const b = existing(project(), '1975-01-01');
      b.p.measurements.insulationMOhm = 0.3;
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-INSULATION',
    kind: 'exception',
    title: 'circuit TBTS sur transformateur de sécurité : seuil de 0,25 MΩ sous 250 V (tableau 6.1)',
    build: () => project().p,
    expect: 'silent',
    notModelled: 'une seule valeur d’isolement pour le projet : ni valeur par circuit, ni tension nominale ou tension d’essai',
  },
  {
    rule: 'R-INSULATION',
    kind: 'missingData',
    title: 'valeur générale (circuits en parallèle) < 0,5 MΩ : mesure par circuit nécessaire plutôt que non-conformité',
    build: () => project().p,
    expect: { status: 'manualCheck' },
    notModelled: 'le modèle ne distingue pas la valeur générale d’une valeur par circuit',
  },
  {
    rule: 'R-INSULATION',
    kind: 'missingData',
    title: 'isolement non mesuré : pas de conclusion ici (mesure demandée par R-MEAS-MISSING)',
    build: () => {
      const b = project();
      delete b.p.measurements.insulationMOhm;
      return b.p;
    },
    expect: 'silent',
  },

  // ===================== R-BONDING (4.2.3.4 a.4 ; 8.2.1, 13 ; 6.5.8.1, 3.4) =====================
  { rule: 'R-BONDING', kind: 'compliant', title: 'liaisons notées conformes', build: () => project().p, expect: 'silent' },
  {
    rule: 'R-BONDING',
    kind: 'nonCompliant',
    title: 'neuf, « non » saisi → non conforme, bloquant',
    build: () => {
      const b = project();
      b.p.measurements.bondingOk = false;
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-BONDING',
    kind: 'missingData',
    title: 'non vérifiées → vérification nécessaire, non bloquant',
    build: () => {
      const b = project();
      delete b.p.measurements.bondingOk;
      return b.p;
    },
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-BONDING',
    kind: 'exception',
    title: 'partie de 1975, « non » saisi : dérogation 8.2.1 point 13 possible → à vérifier, non bloquant',
    build: () => {
      const b = existing(project(), '1975-01-01');
      b.p.measurements.bondingOk = false;
      return b.p;
    },
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-BONDING',
    kind: 'exception',
    title: 'existant sans date, « non » saisi : époque inconnue → à vérifier, non bloquant',
    build: () => {
      const b = existing(project());
      b.p.measurements.bondingOk = false;
      return b.p;
    },
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-BONDING',
    kind: 'transitional',
    title: 'partie du 30/09/1981 (veille) : dérogation 8.2.1 point 13 → à vérifier',
    build: () => {
      const b = existing(project(), '1981-09-30');
      b.p.measurements.bondingOk = false;
      return b.p;
    },
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-BONDING',
    kind: 'transitional',
    title: 'partie du 01/10/1981 (jour même) : plus de dérogation → non conforme, bloquant',
    build: () => {
      const b = existing(project(), '1981-10-01');
      b.p.measurements.bondingOk = false;
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-BONDING',
    kind: 'nonCompliant',
    title: 'existant de 2021, « non » saisi → non conforme, bloquant',
    build: () => {
      const b = existing(project(), '2021-03-01');
      b.p.measurements.bondingOk = false;
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-BONDING',
    kind: 'transitional',
    title: 'salle de bain d’avant le 1/3/2025, liaison supplémentaire incomplète (6.5.8.1, 3.4) → à vérifier',
    build: () => existing(project(), '2024-01-01').p,
    expect: { status: 'manualCheck' },
    notModelled: 'un seul booléen pour la liaison principale, les supplémentaires et la continuité',
  },

  // ===================== R-RCD-TEST (6.5.7.2 b.4 d-e ; 7.112.3) =====================
  { rule: 'R-RCD-TEST', kind: 'compliant', title: 'tous les différentiels essayés, résultat conforme', build: () => project().p, expect: 'silent' },
  {
    rule: 'R-RCD-TEST',
    kind: 'nonCompliant',
    title: 'essai noté non conforme → non conforme, bloquant',
    build: () => {
      const b = project();
      b.p.measurements.rcdTests![b.rcd30.id] = { ok: false };
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-RCD-TEST',
    kind: 'missingData',
    title: 'aucun essai noté → vérification nécessaire, non bloquant',
    build: () => {
      const b = project();
      delete b.p.measurements.rcdTests;
      return b.p;
    },
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-RCD-TEST',
    kind: 'missingData',
    title: 'disjoncteur différentiel (rcbo) sans essai → vérification nécessaire',
    build: () => project(circuit('rcbo', 16, 2.5, [node('socket')], 'Prises', { residualCurrent: 30, rcdType: 'A' })).p,
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-RCD-TEST',
    kind: 'exception',
    title: 'partie de 1975, essai non conforme : aucune dérogation → non conforme, bloquant',
    build: () => {
      const b = existing(project(), '1975-01-01');
      b.p.measurements.rcdTests![b.main.id] = { ok: false };
      return b.p;
    },
    expect: { status: 'nonCompliant', blocking: true },
  },
  {
    rule: 'R-RCD-TEST',
    kind: 'notApplicable',
    title: 'essai d’un différentiel supprimé (id inconnu) : ignoré',
    build: () => {
      const b = project();
      b.p.measurements.rcdTests!['inexistant'] = { ok: false };
      return b.p;
    },
    expect: 'silent',
  },

  // ===================== R-RCD-TRIP (valeurs des normes de produit, non RGIE : avertissement) =====================
  { rule: 'R-RCD-TRIP', kind: 'compliant', title: '20 ms', build: () => project().p, expect: 'silent' },
  {
    rule: 'R-RCD-TRIP',
    kind: 'boundary',
    title: '300 ms pile : rien',
    build: () => {
      const b = project();
      b.p.measurements.rcdTests![b.rcd30.id] = { tripMs: 300, ok: true };
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-RCD-TRIP',
    kind: 'boundary',
    title: '301 ms : avertissement, jamais bloquant',
    build: () => {
      const b = project();
      b.p.measurements.rcdTests![b.rcd30.id] = { tripMs: 301, ok: true };
      return b.p;
    },
    expect: { status: 'warning', blocking: false, params: { value: 301, max: 300 } },
  },
  {
    rule: 'R-RCD-TRIP',
    kind: 'notApplicable',
    title: 'essai déjà noté non conforme avec un temps long : seul R-RCD-TEST',
    build: () => {
      const b = project();
      b.p.measurements.rcdTests![b.rcd30.id] = { tripMs: 400, ok: false };
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-RCD-TRIP',
    kind: 'missingData',
    title: 'temps non noté : rien ici (l’essai est demandé par R-RCD-TEST)',
    build: () => {
      const b = project();
      b.p.measurements.rcdTests![b.rcd30.id] = { ok: true };
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-RCD-TRIP',
    kind: 'exception',
    title: 'différentiel sélectif (S) à 400 ms : limite de 500 ms',
    build: () => project().p,
    expect: 'silent',
    notModelled: 'rcdType n’accepte que AC, A, F, B : pas d’option « sélectif (S) »',
  },

  // ===================== R-WETROOM-NAME (4.2.4.3 b 5e al. 3° ; 7.1.4.3) =====================
  {
    rule: 'R-WETROOM-NAME',
    kind: 'nonCompliant',
    title: '« Salle de bain » hors 30 mA, local non indiqué → anomalie potentielle (déduite), non bloquant',
    build: () => wetNamed('Salle de bain').p,
    expect: { status: 'potential', blocking: false },
  },
  {
    rule: 'R-WETROOM-NAME',
    kind: 'missingData',
    title: 'propriété « local avec baignoire ou douche » non renseignée, nom « Salle d’eau » → anomalie potentielle',
    build: () => wetNamed('Salle d’eau').p,
    expect: { status: 'potential', blocking: false },
  },
  { rule: 'R-WETROOM-NAME', kind: 'missingData', title: 'nom anglais « Shower »', build: () => wetNamed('Shower').p, expect: { status: 'potential' } },
  { rule: 'R-WETROOM-NAME', kind: 'missingData', title: 'nom allemand « Badezimmer »', build: () => wetNamed('Badezimmer').p, expect: { status: 'potential' } },
  { rule: 'R-WETROOM-NAME', kind: 'missingData', title: 'nom néerlandais « Badkamer »', build: () => wetNamed('Badkamer').p, expect: { status: 'potential' } },
  {
    rule: 'R-WETROOM-NAME',
    kind: 'compliant',
    title: 'même circuit sous le 30 mA : rien',
    build: () => project(circuit('mcb', 20, 2.5, [node('appliance', { applianceType: 'heater' })], 'Salle de bain')).p,
    expect: 'silent',
  },
  {
    rule: 'R-WETROOM-NAME',
    kind: 'notApplicable',
    title: 'nom évocateur mais « non » indiqué : rien',
    build: () => {
      const b = wetNamed('Salle de bain');
      b.board.children.at(-1)!.props.wetRoom = 'no';
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-WETROOM-NAME',
    kind: 'notApplicable',
    title: 'local indiqué « oui » : R-RCD30 conclut, pas d’indice au nom',
    build: () => {
      const b = wetNamed('Salle de bain');
      b.board.children.at(-1)!.props.wetRoom = 'yes';
      return b.p;
    },
    expect: 'silent',
  },
  { rule: 'R-WETROOM-NAME', kind: 'notApplicable', title: 'nom sans rapport (« Bureau ») : rien', build: () => wetNamed('Bureau').p, expect: 'silent' },
  {
    rule: 'R-WETROOM-NAME',
    kind: 'transitional',
    title: 'délimitation du 1/3/2025 sans effet sur le 30 mA : existant de 2024 → anomalie potentielle',
    build: () => wetNamed('Salle de bain', existing(project(), '2024-01-01')).p,
    expect: { status: 'potential', blocking: false },
  },
  {
    rule: 'R-WETROOM-NAME',
    kind: 'exception',
    title: 'aucune dérogation au 30 mA de salle de bain : partie de 1975 → anomalie potentielle',
    build: () => wetNamed('Salle de bain', existing(project(), '1975-01-01')).p,
    expect: { status: 'potential', blocking: false },
  },
  {
    rule: 'R-WETROOM-NAME',
    kind: 'exception',
    title: 'circuit TBTS ou en séparation de sécurité (7.1.4.3) : pas de 30 mA exigé',
    build: () => wetNamed('Salle de bain').p,
    expect: 'silent',
    notModelled: 'pas de propriété TBTS / séparation de sécurité sur un circuit',
  },
  {
    rule: 'R-WETROOM-NAME',
    kind: 'missingData',
    title: '30 mA déclaré présent « quelque part », circuit dessiné hors 30 mA → l’indice reste',
    build: () => {
      const b = wetNamed('Salle de bain', existing(project()));
      b.p.meta.survey = { rcd30: 'present' };
      return b.p;
    },
    expect: { status: 'potential', blocking: false },
    knownIssue: 'la déclaration globale meta.survey.rcd30 supprime l’indice pour tous les circuits, même ceux dessinés hors 30 mA',
  },

  // ===================== R-EV-MANUAL (7.22) =====================
  {
    rule: 'R-EV-MANUAL',
    kind: 'nonCompliant',
    title: 'borne de recharge dessinée → vérification manuelle, non bloquante',
    build: () => evProject().p,
    expect: { status: 'manualCheck', blocking: false },
  },
  { rule: 'R-EV-MANUAL', kind: 'notApplicable', title: 'pas de borne', build: () => project(sockets(2)).p, expect: 'silent' },
  {
    rule: 'R-EV-MANUAL',
    kind: 'transitional',
    title: 'borne réalisée le 01/11/2022 (jour même) → vérification manuelle',
    build: () => {
      const b = existing(evProject(), '2022-11-01');
      return b.p;
    },
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-EV-MANUAL',
    kind: 'transitional',
    title: 'borne réalisée le 31/10/2022 (veille) : chapitre 7.22 non applicable (7.22.1) → pas de rappel 7.22',
    build: () => existing(evProject(), '2022-10-31').p,
    expect: 'silent',
    knownIssue: 'le rappel 7.22 est émis sans regarder la date de la borne (7.22.1 : réalisation ou remplacement à partir du 1/11/2022)',
  },
  {
    rule: 'R-EV-MANUAL',
    kind: 'exception',
    title: 'borne de 2015 : règles générales, pas le chapitre 7.22',
    build: () => existing(evProject(), '2015-01-01').p,
    expect: 'silent',
    knownIssue: 'borne antérieure au 1/11/2022 : même rappel 7.22 qu’une borne récente',
  },
  {
    rule: 'R-EV-MANUAL',
    kind: 'missingData',
    title: 'existant sans date (date de la borne inconnue) → vérification manuelle',
    build: () => existing(evProject()).p,
    expect: { status: 'manualCheck', blocking: false },
  },

  // ===================== R-PV-MANUAL (7.112) =====================
  {
    rule: 'R-PV-MANUAL',
    kind: 'nonCompliant',
    title: 'onduleur photovoltaïque → vérification manuelle, non bloquante',
    build: () => project(circuit('mcb', 16, 2.5, [node('inverter', { inverterType: 'dcAc', power: 4000 }, [node('cable', { section: 4 }, [node('solarPanel')])])], 'PV')).p,
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-PV-MANUAL',
    kind: 'nonCompliant',
    title: 'panneaux sans onduleur dessiné → vérification manuelle',
    build: () => project(circuit('mcb', 16, 2.5, [node('solarPanel')], 'PV')).p,
    expect: { status: 'manualCheck' },
  },
  {
    rule: 'R-PV-MANUAL',
    kind: 'notApplicable',
    title: 'convertisseur de batterie (AC ↔ DC) seul : pas de rappel photovoltaïque',
    build: () => project(circuit('mcb', 16, 2.5, [node('inverter', { inverterType: 'acDc' }, [node('cable', { section: 4 }, [node('battery')])])], 'Batterie')).p,
    expect: 'silent',
  },
  { rule: 'R-PV-MANUAL', kind: 'notApplicable', title: 'pas de photovoltaïque', build: () => project(sockets(2)).p, expect: 'silent' },
  {
    rule: 'R-PV-MANUAL',
    kind: 'missingData',
    title: 'onduleur sans type : supposé photovoltaïque → vérification manuelle',
    build: () => {
      const inv = node('inverter');
      delete inv.props.inverterType;
      return project(circuit('mcb', 16, 2.5, [inv], 'Onduleur')).p;
    },
    expect: { status: 'manualCheck' },
  },
  {
    rule: 'R-PV-MANUAL',
    kind: 'exception',
    title: 'ancien RGIE (1990) : documents simplifiés admis (8.2.2, 7), rappel maintenu',
    build: () => existing(project(circuit('mcb', 16, 2.5, [node('solarPanel')], 'PV')), '1990-01-01').p,
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-PV-MANUAL',
    kind: 'notApplicable',
    title: 'onduleur de 15 kVA : chapitre 7.112 limité aux installations ≤ 10 kVA → pas de rappel 7.112',
    build: () => project(circuit('mcb', 32, 6, [node('inverter', { inverterType: 'dcAc', power: 15000 })], 'PV')).p,
    expect: 'silent',
    knownIssue: 'la puissance de l’onduleur n’est pas exploitée : rappel 7.112 au-delà de 10 kVA (7.112.1)',
  },

  // ===================== R-RCD30-DATE (6.5.8.1, 1 ; 4.2.4.3 b dernier al. ; 1/6/2023) =====================
  {
    rule: 'R-RCD30-DATE',
    kind: 'missingData',
    title: 'existant sans date, prises hors 30 mA → question sur le tableau, informations insuffisantes, non bloquant',
    build: () => socketsOutside30().p,
    expect: { status: 'insufficientData', blocking: false, params: { count: 1 } },
  },
  {
    rule: 'R-RCD30-DATE',
    kind: 'missingData',
    title: 'prises et éclairage hors 30 mA : une seule question pour le tableau (2 points)',
    build: () => {
      const b = socketsOutside30();
      b.board.children.push(circuit('mcb', 10, 1.5, [node('light')], 'Éclairage'));
      return b.p;
    },
    expect: { status: 'insufficientData', params: { count: 2 } },
  },
  {
    rule: 'R-RCD30-DATE',
    kind: 'compliant',
    title: 'existant sans date, prises sous 30 mA : pas de question',
    build: () => existing(project(sockets(2))).p,
    expect: 'silent',
  },
  {
    rule: 'R-RCD30-DATE',
    kind: 'notApplicable',
    title: 'installation neuve : règles de 2023 appliquées, pas de question',
    build: () => {
      const b = project();
      b.board.children.push(sockets(2));
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-RCD30-DATE',
    kind: 'exception',
    title: 'tableau répondu « avant le 1/6/2023 » : dérogation 6.5.8.1, 1, plus de question',
    build: () => {
      const b = socketsOutside30();
      b.board.props.rgie2023 = 'before';
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-RCD30-DATE',
    kind: 'transitional',
    title: 'tableau répondu « après le 1/6/2023 » : règles appliquées (R-RCD30), plus de question',
    build: () => {
      const b = socketsOutside30();
      b.board.props.rgie2023 = 'after';
      return b.p;
    },
    expect: 'silent',
  },
  {
    rule: 'R-RCD30-DATE',
    kind: 'boundary',
    title: 'projet du 31/05/2023 : dérogation, pas de question',
    build: () => socketsOutside30('2023-05-31').p,
    expect: 'silent',
  },
  {
    rule: 'R-RCD30-DATE',
    kind: 'boundary',
    title: 'projet du 01/06/2023 : règles appliquées, pas de question',
    build: () => socketsOutside30('2023-06-01').p,
    expect: 'silent',
  },
  {
    rule: 'R-RCD30-DATE',
    kind: 'transitional',
    title: 'date partielle « 2023 » (à cheval sur le 1/6/2023) → question',
    build: () => socketsOutside30('2023').p,
    expect: { status: 'insufficientData', blocking: false },
  },
  {
    rule: 'R-RCD30-DATE',
    kind: 'transitional',
    title: 'date partielle « 2023-05 » (avant le 1/6/2023) → dérogation, pas de question',
    build: () => socketsOutside30('2023-05').p,
    expect: 'silent',
  },
  {
    rule: 'R-RCD30-DATE',
    kind: 'transitional',
    title: 'date partielle « 2023-06 » (après le 1/6/2023) → règles, pas de question',
    build: () => socketsOutside30('2023-06').p,
    expect: 'silent',
  },
  {
    rule: 'R-RCD30-DATE',
    kind: 'transitional',
    title: 'tableau daté « 2023 » (installedOn partiel), projet sans date → question',
    build: () => {
      const b = socketsOutside30();
      b.board.props.installedOn = '2023';
      return b.p;
    },
    expect: { status: 'insufficientData', blocking: false },
  },
  {
    rule: 'R-RCD30-DATE',
    kind: 'transitional',
    title: 'partie de 2015 : avant 2023, pas de question',
    build: () => socketsOutside30('2015-01-01').p,
    expect: 'silent',
  },
  {
    rule: 'R-RCD30-DATE',
    kind: 'missingData',
    title: 'ancien modèle « ancien RGIE » sans date : hypothèse, pas une dérogation → question',
    build: () => {
      const b = socketsOutside30();
      b.p.meta.rgieVersion = 'old';
      return b.p;
    },
    expect: { status: 'insufficientData', blocking: false },
  },
  {
    rule: 'R-RCD30-DATE',
    kind: 'missingData',
    title: 'plus de 8 circuits sous un 30 mA (R-RCD30-MAX seul), sans date → question',
    build: () => {
      const ovens = Array.from({ length: 9 }, (_, i) => circuit('mcb', 20, 2.5, [node('appliance', { applianceType: 'oven' })], `Four ${i + 1}`));
      return existing(project(...ovens)).p;
    },
    expect: { status: 'insufficientData', blocking: false, params: { count: 1 } },
  },
  {
    rule: 'R-RCD30-DATE',
    kind: 'missingData',
    title: 'circuit de prises sans tableau dans sa chaîne (sous le différentiel général), sans date → constat quand même',
    build: () => {
      const b = existing(project());
      b.main.children.push(sockets(2));
      return b.p;
    },
    expect: { status: 'insufficientData', blocking: false },
    knownIssue: 'sans tableau dans la chaîne, askDate ne pose aucune question : la date inconnue reste muette',
  },
  {
    rule: 'R-RCD30-DATE',
    kind: 'exception',
    title: 'modification ou extension importante après le 1/6/2023 : dérogation perdue pour les circuits concernés',
    build: () => socketsOutside30('2015-01-01').p,
    expect: 'silent',
    notModelled: 'pas de notion de modification ou d’extension importante',
  },
];
