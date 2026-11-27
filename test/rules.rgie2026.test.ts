/**
 * Corrections du moteur issues de l'audit de 2026 (docs/audit/APPRENDRE-RGIE-AUDIT-2026.md, « Anomalies du moteur »),
 * vérifiées dans le RGIE, Livre 1, version 07 (15/09/2026). Chaque bloc reproduit d'abord l'anomalie, puis teste les
 * valeurs limites et les exceptions du texte. Les points encore à trancher par un spécialiste ne sont pas bloquants.
 */
import { checkProject } from '../src/rules';
import { maxProtectionFor, belgium } from '../src/rules/be/rgie';
import { BE_RULES } from '../src/rules/be/catalog';
import { createNode as baseNode, emptyProject } from '../src/model/tree';
import { translate } from '../src/i18n';
import type { ElNode, NodeKind, Project } from '../src/model/types';

const createNode = (kind: NodeKind, props: ElNode['props'] = {}, children: ElNode[] = []): ElNode => ({ ...baseNode(kind, props), children });

/** Projet neuf complet et conforme (même base que la matrice) ; `circuits` sont ajoutés derrière le 30 mA. */
function project(...circuits: ElNode[]): { p: Project; main: ElNode; rcd30: ElNode } {
  const p = emptyProject();
  p.meta.installer = { name: 'Installateur', quality: 'Installateur électricien', address: {} };
  p.meta.docNumber = '2026-001';
  p.meta.site = { street: 'Rue de test', number: '1', postalCode: '1000', city: 'Bruxelles', country: 'Belgique' };
  p.measurements = { earthResistanceOhm: 20, insulationMOhm: 10, bondingOk: true };
  const main = p.roots[0].children[0].children[0];
  const board = main.children[0];
  board.children.push(createNode('earthBar', {}, [createNode('earth')]));
  const rcd30 = board.children.find((c) => c.kind === 'protection')!;
  rcd30.children[0].children.push(...circuits);
  p.measurements.rcdTests = { [rcd30.id]: { tripMs: 20, ok: true }, [main.id]: { tripMs: 30, ok: true } };
  return { p, main, rcd30 };
}

const circuit = (device: string, rating: number, section: number, loads: ElNode[] = [createNode('socket', {})], name = 'Circuit') =>
  createNode('protection', { device, ratedCurrent: rating, curve: 'C', poles: '1P+N', circuitName: name, breakingCapacity: 6 }, [
    createNode('cable', { section }, loads),
  ]);
const findings = (p: Project, ruleId: string) => checkProject(p).filter((f) => f.ruleId === ruleId);
const has = (p: Project, ruleId: string) => findings(p, ruleId).length > 0;

describe('M1-M2 — calibre maximal selon la section : tableau 4.11 (RGIE 4.4.1.4), fusible et disjoncteur', () => {
  it('reprend exactement les deux colonnes du tableau 4.11', () => {
    const rows: [number, number, number][] = [
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
    ];
    for (const [s, fuse, mcb] of rows) {
      expect(maxProtectionFor(s, 'fuse'), `${s} mm² fusible`).toBe(fuse);
      expect(maxProtectionFor(s, 'mcb'), `${s} mm² disjoncteur`).toBe(mcb);
      expect(maxProtectionFor(s, 'rcbo'), `${s} mm² disjoncteur différentiel`).toBe(mcb);
    }
  });

  it('hors du tableau (au-delà de 35 mm²) : pas de maximum inventé', () => {
    expect(maxProtectionFor(50, 'mcb')).toBeUndefined();
  });

  it('section intermédiaire : la ligne inférieure du tableau (prudent)', () => {
    expect(maxProtectionFor(3, 'mcb')).toBe(20);
  });

  it('fusible trop fort accepté auparavant : 2,5 mm² + fusible 20 A → non conforme', () => {
    const { p } = project(circuit('fuse', 20, 2.5));
    expect(findings(p, 'R-CABLE-PROT')[0]).toMatchObject({ status: 'nonCompliant', params: { max: 16 } });
  });

  it('fusibles aux limites : 2,5 mm² + 16 A conforme ; 1,5 mm² + 10 A conforme ; 1,5 mm² + 16 A non conforme', () => {
    expect(has(project(circuit('fuse', 16, 2.5)).p, 'R-CABLE-PROT')).toBe(false);
    expect(has(project(circuit('fuse', 10, 1.5, [createNode('light')])).p, 'R-CABLE-PROT')).toBe(false);
    expect(has(project(circuit('fuse', 16, 1.5, [createNode('light')])).p, 'R-CABLE-PROT')).toBe(true);
  });

  it('fausse non-conformité auparavant : 6 mm² + disjoncteur 40 A, 10 mm² + 63 A, 16 mm² + 80 A → conformes', () => {
    const ap = (t: string) => [createNode('appliance', { applianceType: t })];
    expect(has(project(circuit('mcb', 40, 6, ap('cooker'))).p, 'R-CABLE-PROT')).toBe(false);
    expect(has(project(circuit('mcb', 63, 10, ap('other'))).p, 'R-CABLE-PROT')).toBe(false);
    expect(has(project(circuit('mcb', 80, 16, ap('other'))).p, 'R-CABLE-PROT')).toBe(false);
  });

  it('disjoncteurs juste au-dessus : 6 mm² + 50 A, 4 mm² + 32 A → non conformes', () => {
    expect(has(project(circuit('mcb', 50, 6, [createNode('appliance', { applianceType: 'cooker' })])).p, 'R-CABLE-PROT')).toBe(true);
    expect(has(project(circuit('mcb', 32, 4, [createNode('appliance', { applianceType: 'cooker' })])).p, 'R-CABLE-PROT')).toBe(true);
  });

  it('le message cite le RGIE et non une valeur « conseillée »', () => {
    expect(translate('fr', 'rule.R-CABLE-PROT')).toContain('4.4.1.4');
  });
});

describe('M3 — différentiels au moins de type A (RGIE 5.3.5.3 a)', () => {
  it('différentiel général de type AC dans une installation neuve : non conforme (il n’était signalé que pour le lavage)', () => {
    const { p, main } = project(circuit('mcb', 20, 2.5));
    main.props.rcdType = 'AC';
    expect(findings(p, 'R-RCD-TYPE-A').map((f) => f.nodeId)).toContain(main.id);
    expect(findings(p, 'R-RCD-TYPE-A').find((f) => f.nodeId === main.id)).toMatchObject({ status: 'nonCompliant', blocking: true });
  });

  it('type A, F ou B : rien ; type non renseigné : pas de constat inventé', () => {
    for (const t of ['A', 'F', 'B', undefined]) {
      const { p, main } = project(circuit('mcb', 20, 2.5));
      main.props.rcdType = t;
      expect(has(p, 'R-RCD-TYPE-A'), String(t)).toBe(false);
    }
  });

  it('installation existante : recommandation, non bloquante (dérogation éventuelle à confirmer par un spécialiste)', () => {
    const { p, main } = project(circuit('mcb', 20, 2.5));
    p.meta.installationKind = 'existing';
    p.meta.installationDate = '2010-01-01';
    main.props.rcdType = 'AC';
    expect(findings(p, 'R-RCD-TYPE-A')[0]).toMatchObject({ status: 'recommendation', blocking: false });
  });
});

describe('M4 — différentiel placé en tête : au moins 40 A (RGIE 5.3.5.3 a)', () => {
  it('différentiel général de 25 A : non conforme ; 40 A et 63 A : conformes', () => {
    const a = project(circuit('mcb', 20, 2.5));
    a.main.props.ratedCurrent = 25;
    expect(findings(a.p, 'R-RCD-HEAD-RATING')[0]).toMatchObject({ status: 'nonCompliant', nodeId: a.main.id, params: { value: 25 } });
    for (const v of [40, 63]) {
      const b = project(circuit('mcb', 20, 2.5));
      b.main.props.ratedCurrent = v;
      expect(has(b.p, 'R-RCD-HEAD-RATING')).toBe(false);
    }
  });

  it('un différentiel en aval (30 mA de 25 A) n’est pas concerné', () => {
    const { p, rcd30 } = project(circuit('mcb', 20, 2.5));
    rcd30.props.ratedCurrent = 25;
    expect(has(p, 'R-RCD-HEAD-RATING')).toBe(false);
  });

  it('dérogations 8.2.1 / 8.2.2 : exécution avant le 16/9/1991 → rien ; à partir de cette date → signalé ; date inconnue → vérification', () => {
    const at = (date?: string) => {
      const x = project(circuit('mcb', 20, 2.5));
      x.p.meta.installationKind = 'existing';
      if (date) x.p.meta.installationDate = date;
      else delete x.p.meta.installationDate;
      x.main.props.ratedCurrent = 25;
      return findings(x.p, 'R-RCD-HEAD-RATING');
    };
    expect(at('1975-01-01')).toEqual([]);
    expect(at('1991-09-15')).toEqual([]);
    expect(at('1991-09-16')).toHaveLength(1);
    expect(at('2005-01-01')[0]).toMatchObject({ blocking: false });
    expect(at(undefined)[0]).toMatchObject({ status: 'manualCheck', blocking: false });
  });

  it('calibre inconnu : pas de constat (déjà signalé comme donnée manquante)', () => {
    const { p, main } = project(circuit('mcb', 20, 2.5));
    delete main.props.ratedCurrent;
    expect(has(p, 'R-RCD-HEAD-RATING')).toBe(false);
  });
});

describe('M5 — 8 points par circuit : un appareil fixe ou un groupe commandé ensemble compte comme un socle (RGIE 5.3.5.2 b)', () => {
  const sockets = (n: number) => Array.from({ length: n }, () => createNode('socket', {}));
  const switched = (lights: number) => createNode('switch', { switchType: 'single' }, Array.from({ length: lights }, () => createNode('light')));

  it('circuit mixte : 6 prises + 3 points lumineux à interrupteurs séparés = 9 points → non conforme', () => {
    const { p } = project(circuit('mcb', 20, 2.5, [...sockets(6), switched(1), switched(1), switched(1)]));
    expect(findings(p, 'R-SOCKET-MAX')[0]).toMatchObject({ status: 'nonCompliant', params: { count: 9 } });
  });

  it('6 prises + un interrupteur qui commande 3 lampes = 7 points → conforme', () => {
    expect(has(project(circuit('mcb', 20, 2.5, [...sockets(6), switched(3)])).p, 'R-SOCKET-MAX')).toBe(false);
  });

  it('va-et-vient (deux interrupteurs en chaîne) vers une lampe = un seul point', () => {
    const vv = createNode('switch', { switchType: 'twoWay' }, [createNode('switch', { switchType: 'twoWay' }, [createNode('light')])]);
    expect(has(project(circuit('mcb', 20, 2.5, [...sockets(7), vv])).p, 'R-SOCKET-MAX')).toBe(false);
    expect(has(project(circuit('mcb', 20, 2.5, [...sockets(8), vv])).p, 'R-SOCKET-MAX')).toBe(true);
  });

  it('circuit d’éclairage seul (sans prise) : pas de limite de 8', () => {
    expect(has(project(circuit('mcb', 16, 1.5, Array.from({ length: 12 }, () => switched(1)))).p, 'R-SOCKET-MAX')).toBe(false);
  });

  it('limite : 8 prises seules → conforme ; 9 → non conforme', () => {
    expect(has(project(circuit('mcb', 20, 2.5, sockets(8))).p, 'R-SOCKET-MAX')).toBe(false);
    expect(has(project(circuit('mcb', 20, 2.5, sockets(9))).p, 'R-SOCKET-MAX')).toBe(true);
  });

  it('un appareil branché sur une prise ne compte pas en plus de sa prise', () => {
    const withAppliance = [...sockets(7), createNode('socket', {}, [createNode('appliance', { applianceType: 'fridge' })])];
    expect(has(project(circuit('mcb', 20, 2.5, withAppliance)).p, 'R-SOCKET-MAX')).toBe(false);
  });
});

describe('M6 — circuits dédiés (RGIE 5.2.1.2, 7.22.3)', () => {
  const share = (ap: ElNode) => project(circuit('mcb', 20, 2.5, [createNode('socket', {}), ap])).p;

  it('liste du RGIE : lave-linge, sèche-linge, lave-vaisselle, cuisinière, taque, four → non conforme s’ils partagent', () => {
    for (const t of ['washingMachine', 'dryer', 'dishwasher', 'cooker', 'hob', 'oven'])
      expect(findings(share(createNode('appliance', { applianceType: t })), 'R-DEDICATED-CIRCUIT')[0], t).toMatchObject({ status: 'nonCompliant' });
  });

  it('borne de recharge (7.22.3) : non conforme si elle partage', () => {
    expect(findings(share(createNode('appliance', { applianceType: 'evCharger' })), 'R-DEDICATED-CIRCUIT')[0]).toMatchObject({ status: 'nonCompliant' });
  });

  it('tout appareil à poste fixe de 2 600 W ou plus (seuil inclus) ; 2 599 W : rien', () => {
    expect(has(share(createNode('appliance', { applianceType: 'other', power: 2600 })), 'R-DEDICATED-CIRCUIT')).toBe(true);
    expect(has(share(createNode('appliance', { applianceType: 'airConditioner', power: 3500 })), 'R-DEDICATED-CIRCUIT')).toBe(true);
    expect(has(share(createNode('appliance', { applianceType: 'other', power: 2599 })), 'R-DEDICATED-CIRCUIT')).toBe(false);
  });

  it('chauffe-eau, pompe à chaleur, chaudière : imposé seulement à partir de 2 600 W (faux positif corrigé)', () => {
    expect(has(share(createNode('appliance', { applianceType: 'waterHeater', power: 2000 })), 'R-DEDICATED-CIRCUIT')).toBe(false);
    expect(findings(share(createNode('appliance', { applianceType: 'waterHeater', power: 3000 })), 'R-DEDICATED-CIRCUIT')[0]).toMatchObject({
      status: 'nonCompliant',
    });
  });

  it('puissance inconnue de ces appareils : vérification à faire, jamais bloquante', () => {
    for (const t of ['waterHeater', 'heatPump', 'boiler', 'other'])
      expect(findings(share(createNode('appliance', { applianceType: t })), 'R-DEDICATED-CIRCUIT')[0], t).toMatchObject({ status: 'manualCheck', blocking: false });
  });

  it('chauffage électrique fixe : circuit(s) dédié(s), plusieurs radiateurs peuvent partager le leur', () => {
    const heaters = project(circuit('mcb', 16, 2.5, [createNode('appliance', { applianceType: 'heater' }), createNode('appliance', { applianceType: 'storageHeater' })])).p;
    expect(has(heaters, 'R-DEDICATED-CIRCUIT')).toBe(false);
    expect(findings(share(createNode('appliance', { applianceType: 'heater' })), 'R-DEDICATED-CIRCUIT')[0]).toMatchObject({ status: 'nonCompliant' });
  });

  it('appareil seul sur son circuit, ou sur sa prise dédiée : conforme', () => {
    expect(has(project(circuit('mcb', 20, 2.5, [createNode('appliance', { applianceType: 'washingMachine' })])).p, 'R-DEDICATED-CIRCUIT')).toBe(false);
    const viaSocket = createNode('socket', {}, [createNode('appliance', { applianceType: 'washingMachine' })]);
    expect(has(project(circuit('mcb', 20, 2.5, [viaSocket])).p, 'R-DEDICATED-CIRCUIT')).toBe(false);
  });
});

describe('M8 — résistance de terre « inférieure à 100 Ω » (RGIE 4.2.3.2)', () => {
  it('100 Ω pile : non conforme ; 99,9 Ω : règle des 30 Ω seulement', () => {
    const a = project(circuit('mcb', 20, 2.5));
    a.p.measurements.earthResistanceOhm = 100;
    expect(has(a.p, 'R-EARTH-VALUE')).toBe(true);
    const b = project(circuit('mcb', 20, 2.5));
    b.p.measurements.earthResistanceOhm = 99.9;
    expect(has(b.p, 'R-EARTH-VALUE')).toBe(false);
    expect(has(b.p, 'R-EARTH-30')).toBe(true);
  });
});

describe('Interprétations incertaines : jamais bloquantes (dossier de validation externe)', () => {
  it('M10 — temps de déclenchement au-delà de 300 ms : avertissement, pas une non-conformité (valeur normative, non RGIE)', () => {
    const { p, rcd30 } = project(circuit('mcb', 20, 2.5));
    p.measurements.rcdTests = { ...p.measurements.rcdTests, [rcd30.id]: { tripMs: 350, ok: true } };
    expect(findings(p, 'R-RCD-TRIP')[0]).toMatchObject({ status: 'warning', blocking: false });
  });

  it('essai déclaré non conforme par l’installateur : reste bloquant', () => {
    const { p, rcd30 } = project(circuit('mcb', 20, 2.5));
    p.measurements.rcdTests = { ...p.measurements.rcdTests, [rcd30.id]: { ok: false } };
    expect(findings(p, 'R-RCD-TEST')[0]).toMatchObject({ status: 'nonCompliant', blocking: true });
  });

  it('M9 — 3 × 230 V : disjoncteur 1P+N bloquant ; disjoncteur différentiel 1P+N à vérifier (4.4.4.2)', () => {
    const mcb = project(circuit('mcb', 20, 2.5));
    mcb.p.meta.supply = '3 x 230V ~ 50Hz';
    expect(findings(mcb.p, 'R-POLES-NO-NEUTRAL')[0]).toMatchObject({ status: 'nonCompliant', blocking: true });
    const rcbo = project(circuit('rcbo', 20, 2.5));
    rcbo.p.meta.supply = '3 x 230V ~ 50Hz';
    expect(findings(rcbo.p, 'R-POLES-NO-NEUTRAL')[0]).toMatchObject({ status: 'manualCheck', blocking: false });
  });
});

describe('M11 — désignations de câbles : pas d’équivalence fausse', () => {
  it('VFVB n’est pas présenté comme équivalent du H05VV-F (le RGIE le cite comme câble armé, 8.2.x)', () => {
    expect(belgium.equivalents?.['cableType.VFVB']).toBeUndefined();
  });
});

describe('Catalogue : chaque règle corrigée garde une fiche et reste à faire valider', () => {
  it('R-RCD-HEAD-RATING existe, avec ses textes dans les 4 langues', () => {
    expect(BE_RULES['R-RCD-HEAD-RATING']).toMatchObject({ needsReview: true });
    for (const l of ['fr', 'nl', 'en', 'de'] as const) {
      expect(translate(l, 'rule.R-RCD-HEAD-RATING', { value: 25 })).not.toBe('rule.R-RCD-HEAD-RATING');
      expect(translate(l, 'advice.R-RCD-HEAD-RATING')).not.toBe('advice.R-RCD-HEAD-RATING');
    }
  });
});
