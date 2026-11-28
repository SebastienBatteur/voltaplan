/**
 * Matrice réglementaire (interprétation du RGIE) : cas conformes, non conformes, limites, installations existantes,
 * parties anciennes, dérogations, données manquantes, réseaux 230 V / 3 × 230 V / 3N × 400 V.
 *
 * Ces tests décrivent l'interprétation retenue par Voltaplan (src/rules/be/catalog.ts, toutes les règles
 * `needsReview`). Les tests techniques du moteur (contexte, classement) sont dans test/rulesEngine.test.ts.
 *
 * États de connaissance (ADR-0007, « inconnu ≠ absent ») : présent / absent / inconnu / déduit / contradictoire /
 * mesure nécessaire, installation neuve (conception) / existante (relevé), exigences documentaires / physiques,
 * mention du dossier imprimé.
 */
import { BE_RULES } from '../src/rules/be/catalog';
import { checkProject, draftLevel, DRAFT_KEYS, isBlocking } from '../src/rules';
import { createNode as baseNode, emptyProject, walk } from '../src/model/tree';
import type { ElNode, NodeKind, Project } from '../src/model/types';
import { emptyEvidence } from '../src/assist/evidence';
import { surveyQuestions } from '../src/assist/unconfirmed';
import { translate } from '../src/i18n';
import { fixesFor } from '../src/rules/fixes';

/** Nœud avec ses enfants. */
const createNode = (kind: NodeKind, props: ElNode['props'] = {}, children: ElNode[] = []): ElNode => ({ ...baseNode(kind, props), children });

/**
 * Projet complet et conforme : documents, terre, mesures, un circuit de prises et un circuit d'éclairage derrière
 * le 30 mA du projet vide (RGIE 4.2.4.3 b depuis le 1/6/2023). `pre2023` : installation commencée avant le
 * 1/6/2023 (dérogation), prises et éclairage directement sous le différentiel général, sans 30 mA.
 */
function compliant(opts: { pre2023?: boolean } = {}): { p: Project; board: ElNode; sockets: ElNode; lights: ElNode } {
  const p = emptyProject();
  p.meta.installer = { name: 'Installateur', quality: 'Installateur électricien', address: {} };
  p.meta.docNumber = '2026-001';
  p.meta.site = { street: 'Rue de test', number: '1', postalCode: '1000', city: 'Bruxelles', country: 'Belgique' };
  p.measurements = { earthResistanceOhm: 20, insulationMOhm: 10, bondingOk: true };
  const board = p.roots[0].children[0].children[0].children[0];
  board.children.push(createNode('earthBar', {}, [createNode('earth')]));
  const socketsCable = createNode('cable', { section: 2.5 }, [createNode('socket', {}), createNode('socket', {})]);
  const sockets = createNode('protection', { device: 'mcb', ratedCurrent: 20, curve: 'C', poles: '1P+N', circuitName: 'Prises séjour', breakingCapacity: 6 }, [socketsCable]);
  const lights = createNode(
    'protection',
    { device: 'mcb', ratedCurrent: 16, curve: 'C', poles: '1P+N', circuitName: 'Éclairage', breakingCapacity: 6 },
    [createNode('cable', { section: 1.5 }, [createNode('light')])],
  );
  const rcd30 = board.children.find((c) => c.kind === 'protection')!;
  if (opts.pre2023) {
    board.children.splice(board.children.indexOf(rcd30), 1);
    board.children.push(sockets, lights);
    p.meta.installationDate = '2023-05-01';
  } else {
    rcd30.children[0].children.push(sockets, lights);
    p.measurements.rcdTests = { [rcd30.id]: { tripMs: 20, ok: true } };
  }
  return { p, board, sockets, lights };
}

const ids = (p: Project) => checkProject(p).map((f) => f.ruleId);
const get = (p: Project, ruleId: string) => checkProject(p).find((f) => f.ruleId === ruleId);

describe('matrice RGIE — cas conformes', () => {
  it('mentions RGIE 3.1.2 : numéro du dossier et qualité du responsable exigés', () => {
    const { p } = compliant();
    p.meta.docNumber = ' ';
    p.meta.installer = { name: 'Installateur', address: {} };
    const ids = checkProject(p).map((x) => x.ruleId);
    expect(ids).toContain('R-DOC-NUMBER');
    expect(ids).toContain('R-DOC-QUALITY');
  });

  it('installation neuve complète : aucun constat bloquant ni non conforme', () => {
    const { p } = compliant();
    const f = checkProject(p);
    expect(f.filter((x) => x.status === 'nonCompliant')).toEqual([]);
    expect(isBlocking(f)).toBe(false);
  });

  it('salle de bain indiquée et protégée par un 30 mA : conforme', () => {
    const { p, board, sockets } = compliant({ pre2023: true });
    const rcd30 = createNode('protection', { device: 'rcd', residualCurrent: 30, rcdType: 'A', ratedCurrent: 40, poles: '2P' }, [createNode('board')]);
    board.children.splice(board.children.indexOf(sockets), 1);
    rcd30.children[0].children.push(sockets);
    sockets.props.wetRoom = 'yes';
    board.children.push(rcd30);
    expect(ids(p)).not.toContain('R-RCD30');
  });
});

describe('matrice RGIE — non conformités (installation neuve)', () => {
  it('câble 2,5 mm² protégé par 25 A : non conforme, bloquant, danger élevé', () => {
    const { p, sockets } = compliant();
    sockets.props.ratedCurrent = 25;
    expect(get(p, 'R-CABLE-PROT')).toMatchObject({ status: 'nonCompliant', blocking: true, hazard: 'high', severity: 'error' });
  });

  it('limite : 20 A sur 2,5 mm² est accepté, 21 A ne l’est pas', () => {
    const { p, sockets } = compliant();
    sockets.props.ratedCurrent = 20;
    expect(ids(p)).not.toContain('R-CABLE-PROT');
    sockets.props.ratedCurrent = 21;
    expect(ids(p)).toContain('R-CABLE-PROT');
  });

  it('limite : 8 points de prise acceptés, 9 refusés', () => {
    const { p, sockets } = compliant();
    const cable = sockets.children[0];
    cable.children = Array.from({ length: 8 }, () => createNode('socket'));
    expect(ids(p)).not.toContain('R-SOCKET-MAX');
    cable.children.push(createNode('socket'));
    expect(get(p, 'R-SOCKET-MAX')).toMatchObject({ status: 'nonCompliant', blocking: true });
  });

  it('salle de bain indiquée sans 30 mA : non conforme', () => {
    const { p, sockets } = compliant({ pre2023: true });
    sockets.props.wetRoom = 'yes';
    expect(get(p, 'R-RCD30')).toMatchObject({ status: 'nonCompliant', blocking: true });
  });
});

describe('matrice RGIE — locaux humides', () => {
  it('nom évocateur sans indication : anomalie potentielle (information déduite), pas une non-conformité', () => {
    const { p, sockets } = compliant({ pre2023: true });
    sockets.props.circuitName = 'Prises salle de bain';
    expect(ids(p)).not.toContain('R-RCD30');
    // ADR-0007 : un local humide déduit du nom est une information déduite → « Anomalie potentielle » (avant : « À vérifier »)
    expect(get(p, 'R-WETROOM-NAME')).toMatchObject({ status: 'potential', knowledge: 'deduced', blocking: false, inferred: true });
  });

  it('nom évocateur mais « non » indiqué : plus de constat', () => {
    const { p, sockets } = compliant({ pre2023: true });
    sockets.props.circuitName = 'Prises salle de bain';
    sockets.props.wetRoom = 'no';
    expect(ids(p)).not.toContain('R-WETROOM-NAME');
  });
});

describe('matrice RGIE — données manquantes', () => {
  it('calibre absent : information manquante, bloquante pour une installation neuve', () => {
    const { p, sockets } = compliant();
    delete sockets.props.ratedCurrent;
    expect(get(p, 'R-PROT-RATING-MISSING')).toMatchObject({ status: 'insufficientData', blocking: true });
  });

  it('pouvoir de coupure absent : information manquante, jamais bloquante', () => {
    const { p, sockets } = compliant();
    delete sockets.props.breakingCapacity;
    expect(get(p, 'R-PROT-KA-MISSING')).toMatchObject({ status: 'insufficientData', blocking: false });
  });

  it('nom de l’installateur absent : bloquant en neuf, pas en existant', () => {
    const { p } = compliant();
    p.meta.installer = { address: {} };
    expect(get(p, 'R-DOC-INSTALLER')).toMatchObject({ status: 'insufficientData', blocking: true });
    p.meta.installationKind = 'existing';
    expect(get(p, 'R-DOC-INSTALLER')).toMatchObject({ status: 'insufficientData', blocking: false });
  });
});

describe('matrice RGIE — installations existantes et anciennes', () => {
  it('existante : une règle de sécurité reste non conforme et bloquante', () => {
    const { p, sockets } = compliant();
    p.meta.installationKind = 'existing';
    sockets.props.ratedCurrent = 32;
    expect(get(p, 'R-CABLE-PROT')).toMatchObject({ status: 'nonCompliant', blocking: true });
  });

  it('existante sans date : plus de 8 prises → à vérifier (dérogation possible 8.2.1 / 8.2.2), jamais une recommandation d’office', () => {
    const { p, sockets } = compliant();
    p.meta.installationKind = 'existing';
    sockets.children[0].children = Array.from({ length: 10 }, () => createNode('socket'));
    expect(get(p, 'R-SOCKET-MAX')).toMatchObject({ status: 'manualCheck', blocking: false });
  });

  it('existante sous le Livre 1 (2021) : plus de 8 prises → non conforme (aucune dérogation), non bloquant (gravité faible)', () => {
    const { p, sockets } = compliant();
    p.meta.installationKind = 'existing';
    p.meta.installationDate = '2021-05-01';
    sockets.children[0].children = Array.from({ length: 10 }, () => createNode('socket'));
    expect(get(p, 'R-SOCKET-MAX')).toMatchObject({ status: 'nonCompliant', blocking: false });
  });

  it('ancien RGIE (rgieVersion « old ») : édition 1981 appliquée, jamais « conforme » en silence', () => {
    const { p, board } = compliant();
    p.meta.rgieVersion = 'old';
    board.children = board.children.filter((c) => c.kind !== 'earthBar');
    // Partie existante (édition antérieure) : terre non dessinée = inconnue (ADR-0007), jamais « conforme » en silence…
    expect(get(p, 'R-EARTH-MISSING')).toMatchObject({ status: 'insufficientData', knowledge: 'unknown', edition: '1981' });
    // … et non conforme dès que l'absence est confirmée.
    p.meta.survey = { earth: 'absent' };
    expect(get(p, 'R-EARTH-MISSING')).toMatchObject({ status: 'nonCompliant', blocking: true, edition: '1981' });
    expect(ids(p)).toContain('R-OLD-RGIE');
  });

  it('date de réalisation : 1995 → édition 1981, 2022 → Livre 1', () => {
    const { p, sockets } = compliant();
    sockets.props.ratedCurrent = 25;
    p.meta.installationDate = '1995';
    expect(get(p, 'R-CABLE-PROT')?.edition).toBe('1981');
    p.meta.installationDate = '2022-05-01';
    expect(get(p, 'R-CABLE-PROT')?.edition).toBe('2020');
  });

  it('installation neuve datée d’avant le 1/6/2020 : dispositions transitoires à vérifier', () => {
    const { p } = compliant();
    p.meta.installationDate = '2020-05-15';
    expect(get(p, 'R-INSTALL-DATE')).toMatchObject({ status: 'manualCheck', blocking: false });
  });
});

describe('matrice RGIE — installation mixte (plusieurs générations)', () => {
  it('circuit ancien (partie ancienne) dans une installation neuve : dérogation 8.2.1 à vérifier, le circuit neuf reste exigé', () => {
    const { p, sockets, lights } = compliant();
    sockets.props.oldPart = true;
    sockets.children[0].children = Array.from({ length: 10 }, () => createNode('socket'));
    lights.children[0].children = [createNode('socket'), ...lights.children[0].children]; // prise sur 1,5 mm² (neuf)
    const f = checkProject(p);
    expect(f.find((x) => x.ruleId === 'R-SOCKET-MAX')).toMatchObject({ status: 'manualCheck', edition: 'pre1981', derogation: { reference: '8.2.1, point 6 b ; 8.2.2, point 6' } });
    expect(f.find((x) => x.ruleId === 'R-SOCKET-SECTION' && x.nodeId === lights.id)).toMatchObject({ status: 'nonCompliant', blocking: true, edition: '2020' });
  });

  it('circuit ajouté en 2024 à une installation existante de 1990 : règles du Livre 1 pour ce circuit', () => {
    const { p, sockets } = compliant();
    p.meta.installationKind = 'existing';
    p.meta.installationDate = '1990';
    sockets.props.installedOn = '2024-03';
    sockets.props.installationKind = 'new';
    sockets.children[0].children = Array.from({ length: 9 }, () => createNode('socket'));
    expect(get(p, 'R-SOCKET-MAX')).toMatchObject({ status: 'nonCompliant', blocking: true, edition: '2020' });
  });
});

describe('matrice RGIE — dérogations', () => {
  it('dérogation motivée : statut « dérogation », non bloquante, motif conservé', () => {
    const { p, sockets } = compliant();
    sockets.props.ratedCurrent = 25;
    p.meta.derogations = [{ ruleId: 'R-CABLE-PROT', nodeId: sockets.children[0].id, reason: 'Câble 2,5 mm² posé à l’air libre, vérifié', reference: 'PV 2024-001' }];
    const f = get(p, 'R-CABLE-PROT');
    expect(f).toMatchObject({ status: 'derogation', blocking: false, derogation: { reference: 'PV 2024-001' } });
    expect(isBlocking(checkProject(p).filter((x) => x.ruleId === 'R-CABLE-PROT'))).toBe(false);
  });

  it('dérogation sans motif : ignorée', () => {
    const { p, sockets } = compliant();
    sockets.props.ratedCurrent = 25;
    p.meta.derogations = [{ ruleId: 'R-CABLE-PROT', reason: '  ' }];
    expect(get(p, 'R-CABLE-PROT')?.status).toBe('nonCompliant');
  });

  it('dérogation limitée à un autre élément : ne s’applique pas', () => {
    const { p, sockets } = compliant();
    sockets.props.ratedCurrent = 25;
    p.meta.derogations = [{ ruleId: 'R-CABLE-PROT', nodeId: 'autre', reason: 'Motif' }];
    expect(get(p, 'R-CABLE-PROT')?.status).toBe('nonCompliant');
  });
});

describe('matrice RGIE — réseaux', () => {
  it('3 × 230 V : disjoncteur 1P+N non conforme, 2P conforme', () => {
    const { p, sockets } = compliant({ pre2023: true });
    p.meta.supply = '3 x 230V ~ 50Hz';
    expect(get(p, 'R-POLES-NO-NEUTRAL')).toMatchObject({ status: 'nonCompliant', blocking: true });
    for (const c of p.roots[0].children[0].children[0].children[0].children) if (c.kind === 'protection') c.props.poles = '2P';
    sockets.props.poles = '2P';
    expect(ids(p)).not.toContain('R-POLES-NO-NEUTRAL');
  });

  it('3N × 400 V : 1P+N accepté', () => {
    const { p } = compliant();
    p.meta.supply = '3N x 400V ~ 50Hz';
    expect(ids(p)).not.toContain('R-POLES-NO-NEUTRAL');
  });

  it('2 × 230 V (monophasé) : 1P+N accepté', () => {
    const { p } = compliant();
    expect(ids(p)).not.toContain('R-POLES-NO-NEUTRAL');
  });
});

describe('matrice RGIE — installations particulières', () => {
  it('borne de recharge et photovoltaïque : vérifications manuelles signalées', () => {
    const { p, board } = compliant();
    board.children.push(
      createNode('protection', { device: 'mcb', ratedCurrent: 32, curve: 'C', poles: '1P+N', circuitName: 'Borne', breakingCapacity: 6 }, [
        createNode('cable', { section: 6 }, [createNode('appliance', { applianceType: 'evCharger' })]),
      ]),
      createNode('protection', { device: 'mcb', ratedCurrent: 16, curve: 'C', poles: '1P+N', circuitName: 'PV', breakingCapacity: 6 }, [
        createNode('cable', { section: 2.5 }, [createNode('inverter')]),
      ]),
    );
    expect(get(p, 'R-EV-MANUAL')).toMatchObject({ status: 'manualCheck' });
    expect(get(p, 'R-PV-MANUAL')).toMatchObject({ status: 'manualCheck' });
  });
});

// --- États de connaissance (ADR-0007) ---

/** Projet existant (relevé) complet ; sans terre dessinée si `noEarth`. */
function existing(noEarth = false) {
  const c = compliant({ pre2023: true });
  c.p.meta.installationKind = 'existing';
  if (noEarth) c.board.children = c.board.children.filter((x) => x.kind !== 'earthBar');
  return c;
}
/** Retire le différentiel général dessiné (origine → compteur → tableau). */
function withoutRcd(p: Project, board: ElNode) {
  p.roots[0].children[0].children = [board];
}
const prov = (nodeId: string, prop: string) => ({ nodeId, prop, basis: 'aiInferred' as const, observations: [], confidence: 0.6, at: '2026-11-24T10:00:00Z' });
const mainRcd = (p: Project) => p.roots[0].children[0].children[0];

describe('matrice RGIE — terre : inconnu ≠ absent', () => {
  it('neuf (conception), terre non dessinée : absente du projet → non-conformité bloquante (inchangé)', () => {
    const { p, board } = compliant();
    board.children = board.children.filter((x) => x.kind !== 'earthBar');
    expect(get(p, 'R-EARTH-MISSING')).toMatchObject({ status: 'nonCompliant', blocking: true, knowledge: 'absent', requirement: 'physical', hazard: 'high' });
  });

  it('existant (relevé), terre non dessinée : information inconnue, pas une non-conformité', () => {
    const { p } = existing(true);
    expect(get(p, 'R-EARTH-MISSING')).toMatchObject({ status: 'insufficientData', knowledge: 'unknown', fact: 'earth', blocking: false });
    expect(checkProject(p).some((x) => x.status === 'nonCompliant')).toBe(false);
  });

  it('existant, absence confirmée : non-conformité bloquante (règle de sécurité)', () => {
    const { p } = existing(true);
    p.meta.survey = { earth: 'absent' };
    expect(get(p, 'R-EARTH-MISSING')).toMatchObject({ status: 'nonCompliant', blocking: true, knowledge: 'absent' });
  });

  it('existant, présence confirmée mais non dessinée : schéma incomplet (documentaire), pas de constat physique', () => {
    const { p } = existing(true);
    p.meta.survey = { earth: 'present' };
    expect(ids(p)).not.toContain('R-EARTH-MISSING');
    expect(get(p, 'R-DOC-NOT-DRAWN')).toMatchObject({ requirement: 'documentary', status: 'insufficientData', fact: 'earth', blocking: false });
  });

  it('neuf, présence confirmée mais non dessinée : documentaire bloquant (dossier incomplet), jamais non conforme', () => {
    const { p, board } = compliant();
    board.children = board.children.filter((x) => x.kind !== 'earthBar');
    p.meta.survey = { earth: 'present' };
    expect(ids(p)).not.toContain('R-EARTH-MISSING');
    expect(get(p, 'R-DOC-NOT-DRAWN')).toMatchObject({ requirement: 'documentary', status: 'insufficientData', blocking: true });
  });

  it('terre dessinée (présente) : aucun constat de présence', () => {
    const { p } = existing();
    expect(ids(p)).not.toContain('R-EARTH-MISSING');
    expect(ids(p)).not.toContain('R-DOC-NOT-DRAWN');
  });

  it('terre dessinée mais déclarée absente : informations contradictoires, non bloquant', () => {
    const { p } = existing();
    p.meta.survey = { earth: 'absent' };
    expect(get(p, 'R-EARTH-MISSING')).toMatchObject({ status: 'contradictory', knowledge: 'contradictory', blocking: false, severity: 'warning' });
  });

  it('résistance de terre non mesurée : mesure nécessaire ; valeur mesurée trop élevée : non conforme', () => {
    const { p } = existing();
    delete p.measurements.earthResistanceOhm;
    expect(get(p, 'R-MEAS-MISSING')).toMatchObject({ status: 'manualCheck', knowledge: 'measureNeeded', blocking: false });
    p.measurements.earthResistanceOhm = 150;
    expect(get(p, 'R-EARTH-VALUE')).toMatchObject({ status: 'nonCompliant', blocking: true });
  });

  it('prise « sans terre » reprise d’une photo, non confirmée : anomalie potentielle, non bloquante', () => {
    const { p, sockets } = existing();
    const socket = sockets.children[0].children[0];
    socket.props.earth = false;
    expect(get(p, 'R-SOCKET-EARTH')).toMatchObject({ status: 'nonCompliant', blocking: true, knowledge: 'absent' });
    p.evidence = { ...emptyEvidence(), provenance: [prov(socket.id, 'earth')] };
    expect(get(p, 'R-SOCKET-EARTH')).toMatchObject({ status: 'potential', knowledge: 'deduced', blocking: false, inferred: true });
    expect(get(p, 'R-UNCONFIRMED')).toMatchObject({ nodeId: socket.id, status: 'manualCheck', knowledge: 'deduced' });
  });
});

describe('matrice RGIE — différentiels : inconnu ≠ absent', () => {
  it('neuf, aucun différentiel dessiné : absent du projet → non-conformité bloquante (inchangé)', () => {
    const { p, board, sockets } = compliant({ pre2023: true });
    withoutRcd(p, board);
    expect(checkProject(p).find((x) => x.ruleId === 'R-RCD-MAIN' && x.nodeId === sockets.id)).toMatchObject({ status: 'nonCompliant', blocking: true, knowledge: 'absent' });
  });

  it('existant, aucun différentiel dessiné : inconnu, pas bloquant ; question pour l’assistant', () => {
    const { p, board, sockets } = existing();
    withoutRcd(p, board);
    const f = checkProject(p);
    expect(f.find((x) => x.ruleId === 'R-RCD-MAIN' && x.nodeId === sockets.id)).toMatchObject({ status: 'insufficientData', knowledge: 'unknown', fact: 'rcd', blocking: false });
    // Crochet pour l'assistant : seulement avec un dossier de preuves, une question par fait
    expect(surveyQuestions(p, f)).toEqual([]);
    p.evidence = emptyEvidence();
    const qs = surveyQuestions(p, checkProject(p));
    expect(qs.map((q) => q.id)).toEqual(['q_survey_rcd']);
    expect(qs[0]).toMatchObject({ kind: 'unknown', status: 'open', about: { prop: 'survey.rcd' } });
  });

  it('existant, absence confirmée : non conforme et bloquant ; présence confirmée : schéma incomplet', () => {
    const { p, board, sockets } = existing();
    withoutRcd(p, board);
    p.meta.survey = { rcd: 'absent' };
    expect(checkProject(p).find((x) => x.ruleId === 'R-RCD-MAIN' && x.nodeId === sockets.id)).toMatchObject({ status: 'nonCompliant', blocking: true });
    p.meta.survey = { rcd: 'present' };
    expect(ids(p)).not.toContain('R-RCD-MAIN');
    expect(get(p, 'R-DOC-NOT-DRAWN')).toMatchObject({ fact: 'rcd', requirement: 'documentary' });
  });

  it('différentiel dessiné mais déclaré absent : informations contradictoires', () => {
    const { p } = existing();
    // Un circuit sans différentiel, alors qu'un différentiel de 300 mA est dessiné ailleurs
    const free = createNode('protection', { device: 'mcb', ratedCurrent: 16, curve: 'C', poles: '1P+N', circuitName: 'Garage', breakingCapacity: 6 }, [
      createNode('cable', { section: 1.5 }, [createNode('light')]),
    ]);
    p.roots[0].children[0].children.push(createNode('board', {}, [free]));
    p.meta.survey = { rcd: 'absent' };
    expect(checkProject(p).find((x) => x.ruleId === 'R-RCD-MAIN' && x.nodeId === free.id)).toMatchObject({ status: 'contradictory', blocking: false });
  });

  it('sensibilité inconnue : information insuffisante (avant : non conforme), bloquante seulement en neuf', () => {
    const { p } = compliant({ pre2023: true });
    delete mainRcd(p).props.residualCurrent;
    const f = checkProject(p).filter((x) => x.ruleId === 'R-RCD-MAIN');
    expect(f.length).toBeGreaterThan(0);
    for (const x of f) expect(x).toMatchObject({ status: 'insufficientData', knowledge: 'unknown', blocking: true });
    expect(get(p, 'R-RCD-SENS-MISSING')).toMatchObject({ requirement: 'documentary', status: 'insufficientData' });
    p.meta.installationKind = 'existing';
    for (const x of checkProject(p).filter((y) => y.ruleId === 'R-RCD-MAIN')) expect(x.blocking).toBe(false);
  });

  it('30 mA, local humide indiqué : relevé sans 30 mA dessiné → inconnu ; absence confirmée → non conforme', () => {
    const { p, sockets } = existing();
    sockets.props.wetRoom = 'yes';
    expect(get(p, 'R-RCD30')).toMatchObject({ status: 'insufficientData', knowledge: 'unknown', fact: 'rcd30', blocking: false });
    p.meta.survey = { rcd30: 'absent' };
    expect(get(p, 'R-RCD30')).toMatchObject({ status: 'nonCompliant', blocking: true });
    p.meta.survey = { rcd30: 'present' };
    expect(ids(p)).not.toContain('R-RCD30');
    expect(get(p, 'R-DOC-NOT-DRAWN')).toMatchObject({ fact: 'rcd30' });
  });

  /** Circuit de salle de bain protégé par un disjoncteur différentiel (RCBO) de 300 mA. */
  const bathroom = () => {
    const c = compliant({ pre2023: true });
    c.board.children.splice(c.board.children.indexOf(c.sockets), 1);
    const rcbo = createNode(
      'protection',
      { device: 'rcbo', residualCurrent: 300, ratedCurrent: 20, curve: 'C', poles: '1P+N', circuitName: 'Salle de bain', breakingCapacity: 6, wetRoom: 'yes' },
      c.sockets.children,
    );
    c.board.children.push(rcbo);
    return { ...c, rcbo };
  };

  it('30 mA : sensibilité reprise d’une photo et non confirmée → anomalie potentielle', () => {
    const { p, rcbo } = bathroom();
    expect(get(p, 'R-RCD30')).toMatchObject({ status: 'nonCompliant', blocking: true });
    p.evidence = { ...emptyEvidence(), provenance: [prov(rcbo.id, 'residualCurrent')] };
    expect(get(p, 'R-RCD30')).toMatchObject({ status: 'potential', knowledge: 'deduced', blocking: false });
  });

  it('question « contradiction » ouverte sur un différentiel : constat contradictoire', () => {
    const { p, rcbo } = bathroom();
    p.evidence = {
      ...emptyEvidence(),
      questions: [{ id: 'q_c', kind: 'contradiction', about: { nodeId: rcbo.id, prop: 'residualCurrent' }, text: { key: 'x' }, priority: 'high', status: 'open' }],
    };
    expect(get(p, 'R-RCD30')).toMatchObject({ status: 'contradictory', blocking: false });
    expect(get(p, 'R-CONTRADICTION')).toMatchObject({ nodeId: rcbo.id, status: 'contradictory', params: { props: 'residualCurrent' } });
  });

  it('essai du différentiel non noté : mesure nécessaire ; essai noté : plus de constat', () => {
    const { p } = compliant();
    expect(checkProject(p).find((x) => x.ruleId === 'R-RCD-TEST' && x.nodeId === mainRcd(p).id)).toMatchObject({ status: 'manualCheck', knowledge: 'measureNeeded', blocking: false });
    p.measurements.rcdTests = { ...p.measurements.rcdTests, [mainRcd(p).id]: { tripMs: 25, ok: true } };
    expect(ids(p)).not.toContain('R-RCD-TEST');
  });

  it('liaisons équipotentielles non vérifiées : mesure nécessaire ; « non » saisi : non conforme', () => {
    const { p } = existing();
    delete p.measurements.bondingOk;
    expect(get(p, 'R-BONDING')).toMatchObject({ status: 'manualCheck', knowledge: 'measureNeeded', blocking: false });
    p.measurements.bondingOk = false;
    expect(get(p, 'R-BONDING')).toMatchObject({ status: 'nonCompliant', blocking: true });
  });
});

describe('matrice RGIE — coordination section / protection inconnue', () => {
  it('relevé : section inconnue → vérification nécessaire (physique) et schéma incomplet (documentaire)', () => {
    const { p, sockets } = existing();
    delete sockets.children[0].props.section;
    expect(get(p, 'R-CABLE-PROT')).toMatchObject({ status: 'insufficientData', knowledge: 'unknown', requirement: 'physical', blocking: false });
    expect(get(p, 'R-CABLE-SECTION-MISSING')).toMatchObject({ requirement: 'documentary' });
  });

  it('conception : section inconnue → donnée manquante bloquante seulement (pas de second constat)', () => {
    const { p, sockets } = compliant();
    delete sockets.children[0].props.section;
    expect(ids(p)).not.toContain('R-CABLE-PROT');
    expect(get(p, 'R-CABLE-SECTION-MISSING')).toMatchObject({ status: 'insufficientData', blocking: true });
  });

  it('protection amont de nature inconnue : protection contre les surintensités inconnue, pas absente', () => {
    const { p, sockets } = existing();
    delete sockets.props.device;
    expect(get(p, 'R-CABLE-NO-OVERCURRENT')).toMatchObject({ status: 'insufficientData', knowledge: 'unknown' });
  });
});

describe('matrice RGIE — exigences documentaires / physiques et mention du dossier', () => {
  it('chaque règle du catalogue déclare une exigence documentaire ou physique', () => {
    for (const r of Object.values(BE_RULES)) expect(['documentary', 'physical']).toContain(r.requirement);
    expect(BE_RULES['R-DOC-INSTALLER'].requirement).toBe('documentary');
    expect(BE_RULES['R-EARTH-MISSING'].requirement).toBe('physical');
  });

  it('une exigence documentaire n’est jamais une non-conformité de l’installation', () => {
    const { p } = compliant();
    p.meta.installer = { address: {} };
    p.meta.site = {};
    const doc = checkProject(p).filter((x) => x.requirement === 'documentary');
    expect(doc.length).toBeGreaterThan(0);
    for (const f of doc) expect(f.status).not.toBe('nonCompliant');
  });

  /** Projet neuf sans aucun point à traiter (essai du différentiel noté, longueurs connues pour les calculs). */
  const clean = () => {
    const c = compliant();
    c.p.measurements.rcdTests = { ...c.p.measurements.rcdTests, [mainRcd(c.p).id]: { tripMs: 25, ok: true } };
    for (const { node } of walk(c.p.roots)) if (node.kind === 'cable') node.props.length = 10;
    return c;
  };

  it('mention : aucune si rien à traiter ; jamais sur le document de travail ni le rapport d’anomalies', () => {
    const { p, sockets } = clean();
    expect(draftLevel(checkProject(p), 'reception')).toBe('none');
    sockets.props.ratedCurrent = 25;
    expect(draftLevel(checkProject(p), 'working')).toBe('none');
    expect(draftLevel(checkProject(p), 'anomalies')).toBe('none');
  });

  it('mention : non-conformité physique bloquante → « NON-CONFORMITÉS À TRAITER »', () => {
    const { p, sockets } = clean();
    sockets.props.ratedCurrent = 25;
    expect(draftLevel(checkProject(p), 'reception')).toBe('nonCompliant');
    expect(translate('fr', DRAFT_KEYS.nonCompliant)).toBe('PROJET — NON-CONFORMITÉS À TRAITER');
  });

  it('mention : lacunes documentaires seules → « DOSSIER INCOMPLET », jamais « non conforme »', () => {
    const { p } = clean();
    p.meta.installer = { address: {} };
    expect(draftLevel(checkProject(p), 'reception')).toBe('incomplete');
    expect(draftLevel(checkProject(p), 'complete')).toBe('incomplete');
    expect(translate('fr', DRAFT_KEYS.incomplete)).toBe('PROJET — DOSSIER INCOMPLET');
  });

  it('mention : relevé avec terre inconnue → « VÉRIFICATIONS À FAIRE », pas « non conforme »', () => {
    const { p } = existing(true);
    p.measurements.rcdTests = { ...p.measurements.rcdTests, [mainRcd(p).id]: { tripMs: 25, ok: true } };
    expect(draftLevel(checkProject(p), 'reception')).toBe('pending');
    expect(translate('fr', DRAFT_KEYS.pending)).toBe('PROJET — VÉRIFICATIONS À FAIRE');
    expect(translate('fr', DRAFT_KEYS.pending)).not.toMatch(/NON CONFORME|NON-CONFORMIT/);
    p.meta.survey = { earth: 'absent' };
    expect(draftLevel(checkProject(p), 'reception')).toBe('nonCompliant');
  });

  it('libellés des niveaux (DECISIONS § 3) et phrase de responsabilité', () => {
    expect(translate('fr', 'status.nonCompliant')).toBe('Non-conformité détectée');
    expect(translate('fr', 'status.potential')).toBe('Anomalie potentielle');
    expect(translate('fr', 'status.manualCheck')).toBe('Vérification manuelle nécessaire');
    expect(translate('fr', 'status.insufficientData')).toBe('Informations insuffisantes');
    expect(translate('fr', 'status.notEvaluated')).toBe('Règle non évaluée');
    expect(translate('fr', 'status.contradictory')).toBe('Informations contradictoires');
    // Le résumé ne compte plus des « règles vérifiées » : il distingue satisfaites, non applicables, sans données
    expect(translate('fr', 'check.requirements', { ok: 3, nok: 1, na: 2, pending: 4, rec: 0 })).toMatch(/non applicable.*jamais comptée satisfaite/);
    expect(translate('fr', 'check.liability')).toMatch(/ni une certification/);
  });
});

describe('matrice RGIE — 30 mA depuis le 1/6/2023 (4.2.4.3 b, 5e et 6e alinéas)', () => {
  const onMain = () => {
    const c = compliant();
    const rcd30 = c.board.children.find((x) => x.kind === 'protection')!;
    rcd30.children[0].children = [];
    c.board.children.push(c.sockets, c.lights);
    return c;
  };

  it('neuf : prises et éclairage sous le 300 mA seul → non conforme, raison indiquée', () => {
    const { p, sockets, lights } = onMain();
    const f = checkProject(p).filter((x) => x.ruleId === 'R-RCD30');
    expect(f.find((x) => x.nodeId === sockets.id)).toMatchObject({ status: 'nonCompliant', blocking: true, params: { reason: 'sockets' } });
    expect(f.find((x) => x.nodeId === lights.id)).toMatchObject({ status: 'nonCompliant', params: { reason: 'lighting' } });
  });

  it('dérogation : installation commencée avant le 1/6/2023 → pas de constat', () => {
    const { p } = onMain();
    p.meta.installationDate = '2023-05-31';
    expect(ids(p)).not.toContain('R-RCD30');
    p.meta.installationDate = '2023-06-01';
    expect(ids(p)).toContain('R-RCD30');
  });

  it('existant sans date : question sur le tableau (pas de non-conformité) ; existant daté après le 1/6/2023 : règle appliquée', () => {
    const { p } = onMain();
    p.meta.installationKind = 'existing';
    expect(ids(p)).not.toContain('R-RCD30');
    p.meta.installationDate = '2024-03-01';
    expect(ids(p)).toContain('R-RCD30');
  });

  it('prise dédiée à un appareil fixe (frigo) : peut rester sous le différentiel général', () => {
    const { p, board } = onMain();
    board.children = board.children.filter((x) => x.kind !== 'protection' || x.props.device === 'rcd');
    const fridge = createNode('protection', { device: 'mcb', ratedCurrent: 16, curve: 'C', poles: '1P+N', circuitName: 'Frigo', breakingCapacity: 6 }, [
      createNode('cable', { section: 2.5 }, [createNode('socket', {}, [createNode('appliance', { applianceType: 'fridge' })])]),
    ]);
    board.children.push(fridge);
    expect(checkProject(p).find((x) => x.ruleId === 'R-RCD30' && x.nodeId === fridge.id)).toBeUndefined();
  });

  it('au plus 8 circuits par 30 mA : 8 acceptés, 9 refusés ; dérogation avant le 1/6/2023', () => {
    const { p, board } = compliant();
    const group = board.children.find((x) => x.kind === 'protection')!.children[0];
    const circuit = (i: number) =>
      createNode('protection', { device: 'mcb', ratedCurrent: 16, curve: 'C', poles: '1P+N', circuitName: 'C' + i, breakingCapacity: 6 }, [
        createNode('cable', { section: 1.5 }, [createNode('light')]),
      ]);
    group.children = Array.from({ length: 8 }, (_, i) => circuit(i));
    expect(ids(p)).not.toContain('R-RCD30-MAX');
    group.children.push(circuit(9));
    expect(get(p, 'R-RCD30-MAX')).toMatchObject({ status: 'nonCompliant', blocking: true, params: { count: 9 } });
    p.meta.installationDate = '2022-01-10';
    expect(ids(p)).not.toContain('R-RCD30-MAX');
  });
});

describe('matrice RGIE — existant sans date : question « tableau fait ou refait avant / après le 1/6/2023 »', () => {
  const undated = () => {
    const c = compliant({ pre2023: true });
    delete c.p.meta.installationDate;
    c.p.meta.installationKind = 'existing';
    return c;
  };

  it('une seule question par tableau, non bloquante, avec le nombre de points concernés', () => {
    const { p, board } = undated();
    const f = checkProject(p).filter((x) => x.ruleId === 'R-RCD30-DATE');
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ nodeId: board.id, status: 'insufficientData', knowledge: 'unknown', blocking: false, params: { count: 2, board2023: board.id } });
    expect(ids(p)).not.toContain('R-RCD30');
  });

  it('réponse « après » : règles 30 mA appliquées ; « avant » : dérogation, plus de question', () => {
    const { p, board } = undated();
    board.props.rgie2023 = 'after';
    expect(ids(p)).not.toContain('R-RCD30-DATE');
    expect(ids(p)).toContain('R-RCD30');
    board.props.rgie2023 = 'before';
    expect(ids(p)).not.toContain('R-RCD30-DATE');
    expect(ids(p)).not.toContain('R-RCD30');
  });

  it('question pour l’assistant, une seule fois par tableau', () => {
    const { p, board } = undated();
    p.evidence = emptyEvidence();
    const qs = surveyQuestions(p, checkProject(p)).filter((q) => q.id.startsWith('q_board2023_'));
    expect(qs).toEqual([expect.objectContaining({ id: 'q_board2023_' + board.id, about: { nodeId: board.id, prop: 'rgie2023' } })]);
  });
});

describe('matrice RGIE — prises, modifications du 1/3/2025 (RGIE 5.3.5.2 a)', () => {
  const firstSocket = (sockets: ElNode) => sockets.children[0].children[0];

  it('travaux commencés après le 1/3/2025 : prise sans obturateurs → IPXX-D exigé', () => {
    const { p, sockets } = compliant();
    p.meta.installationDate = '2025-06-01';
    firstSocket(sockets).props.childSafety = false;
    const f = get(p, 'R-SOCKET-IPXXD');
    expect(f).toMatchObject({ status: 'nonCompliant' });
    expect(ids(p)).not.toContain('R-SOCKET-CHILD');
  });

  it('prise réservée à un appareil précis (appareil dessiné sous elle) : exception du 5.3.5.2 a', () => {
    const { p, sockets } = compliant();
    p.meta.installationDate = '2025-06-01';
    const s = firstSocket(sockets);
    s.props.childSafety = false;
    s.children.push(createNode('appliance', { applianceType: 'washingMachine' }));
    expect(ids(p)).not.toContain('R-SOCKET-IPXXD');
  });

  it('travaux commencés avant le 1/3/2025 : la vérification d’avant reste (prise sans sécurité enfant)', () => {
    const { p, sockets } = compliant();
    p.meta.installationDate = '2024-09-01';
    firstSocket(sockets).props.childSafety = false;
    expect(ids(p)).toContain('R-SOCKET-CHILD');
    expect(ids(p)).not.toContain('R-SOCKET-IPXXD');
  });

  it('date propre à une partie (installedOn) prioritaire sur la date du projet', () => {
    const { p, sockets } = compliant();
    p.meta.installationDate = '2024-09-01';
    sockets.props.installedOn = '2025-04-01';
    firstSocket(sockets).props.childSafety = false;
    expect(ids(p)).toContain('R-SOCKET-IPXXD');
  });
});

describe('corrections en un clic (bouton « corriger »)', () => {
  const fixOnce = (p: Project, ruleId: string) => {
    const f = checkProject(p).find((x) => x.ruleId === ruleId);
    expect(f, ruleId).toBeDefined();
    const fixes = fixesFor(f!, p);
    expect(fixes.length, ruleId).toBeGreaterThan(0);
    return fixes[0].apply(p);
  };

  it('calibre trop grand pour la section : « Choisir 20 A » règle le constat, sans toucher au projet d’origine', () => {
    const { p, sockets } = compliant();
    sockets.props.ratedCurrent = 25;
    const f = checkProject(p).find((x) => x.ruleId === 'R-CABLE-PROT')!;
    expect(fixesFor(f, p)[0]).toMatchObject({ label: 'fix.rating', params: { value: 20 } });
    const q = fixOnce(p, 'R-CABLE-PROT');
    expect(ids(q)).not.toContain('R-CABLE-PROT');
    expect(sockets.props.ratedCurrent).toBe(25);
  });

  it('prise sans obturateurs, sans terre : corrigées', () => {
    const { p, sockets } = compliant();
    const s = sockets.children[0].children[0];
    s.props.childSafety = false;
    s.props.earth = false;
    let q = fixOnce(p, 'R-SOCKET-IPXXD');
    q = fixOnce(q, 'R-SOCKET-EARTH');
    expect(ids(q)).not.toContain('R-SOCKET-IPXXD');
    expect(ids(q)).not.toContain('R-SOCKET-EARTH');
  });

  it('section des prises trop faible et câble sous 1,5 mm² : corrigées', () => {
    const { p, sockets, lights } = compliant();
    sockets.children[0].props.section = 1.5;
    sockets.props.ratedCurrent = 16;
    lights.children[0].props.section = 1;
    lights.props.ratedCurrent = 10;
    let q = fixOnce(p, 'R-SOCKET-SECTION');
    q = fixOnce(q, 'R-CABLE-MIN');
    expect(ids(q)).not.toContain('R-SOCKET-SECTION');
    expect(ids(q)).not.toContain('R-CABLE-MIN');
  });

  it('réseau 3 × 230 V : disjoncteur 1P+N → bipolaire', () => {
    const { p } = compliant();
    p.meta.supply = '3 x 230V ~ 50Hz';
    const q = fixOnce(p, 'R-POLES-NO-NEUTRAL');
    expect(checkProject(q).filter((x) => x.ruleId === 'R-POLES-NO-NEUTRAL').length).toBeLessThan(checkProject(p).filter((x) => x.ruleId === 'R-POLES-NO-NEUTRAL').length);
  });

  it('circuit de prises hors 30 mA : rangé sous le 30 mA existant du tableau (place libre)', () => {
    const { p, board, sockets } = compliant();
    const rcd30 = board.children.find((c) => c.kind === 'protection')!;
    rcd30.children[0].children = rcd30.children[0].children.filter((c) => c !== sockets);
    board.children.push(sockets);
    const f = checkProject(p).find((x) => x.ruleId === 'R-RCD30')!;
    expect(fixesFor(f, p)[0]).toMatchObject({ label: 'fix.moveUnder30' });
    const q = fixOnce(p, 'R-RCD30');
    expect(ids(q)).not.toContain('R-RCD30');
  });

  it('30 mA déjà plein (8 circuits) : un nouveau 30 mA est créé avant la terre', () => {
    const { p, board, sockets } = compliant();
    const rcd30 = board.children.find((c) => c.kind === 'protection')!;
    const group = rcd30.children[0];
    group.children = group.children.filter((c) => c !== sockets);
    while (group.children.length < 8) group.children.push(structuredClone(group.children[0]));
    for (const c of group.children) c.id = Math.random().toString(36).slice(2);
    board.children.push(sockets);
    const f = checkProject(p).find((x) => x.ruleId === 'R-RCD30' && x.nodeId === sockets.id)!;
    expect(fixesFor(f, p)[0]).toMatchObject({ label: 'fix.new30' });
    const q = fixesFor(f, p)[0].apply(p);
    const qb = q.roots[0].children[0].children[0].children[0];
    expect(qb.children.at(-1)!.kind).toBe('earthBar');
    expect(checkProject(q).some((x) => x.ruleId === 'R-RCD30' && x.nodeId === sockets.id)).toBe(false);
  });

  it('pas de correction quand elle n’est pas évidente (circuit sans nom)', () => {
    const { p, sockets } = compliant();
    sockets.props.circuitName = '';
    const f = checkProject(p).find((x) => x.ruleId === 'R-CIRCUIT-NAME')!;
    expect(fixesFor(f, p)).toEqual([]);
  });
});
