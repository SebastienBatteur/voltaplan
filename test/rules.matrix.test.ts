/**
 * Matrice réglementaire (interprétation du RGIE) : cas conformes, non conformes, limites, installations existantes,
 * parties anciennes, dérogations, données manquantes, réseaux 230 V / 3 × 230 V / 3N × 400 V.
 *
 * Ces tests décrivent l'interprétation retenue par Voltaplan (src/rules/be/catalog.ts, toutes les règles
 * `needsReview`). Les tests techniques du moteur (contexte, classement) sont dans test/rulesEngine.test.ts.
 */
import { checkProject, isBlocking } from '../src/rules';
import { createNode as baseNode, emptyProject } from '../src/model/tree';
import type { ElNode, NodeKind, Project } from '../src/model/types';

/** Nœud avec ses enfants. */
const createNode = (kind: NodeKind, props: ElNode['props'] = {}, children: ElNode[] = []): ElNode => ({ ...baseNode(kind, props), children });

/** Projet complet et conforme : documents, terre, mesures, un circuit de prises et un circuit d'éclairage. */
function compliant(): { p: Project; board: ElNode; sockets: ElNode; lights: ElNode } {
  const p = emptyProject();
  p.meta.installer = { name: 'Installateur', address: {} };
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
  board.children.push(sockets, lights);
  return { p, board, sockets, lights };
}

const ids = (p: Project) => checkProject(p).map((f) => f.ruleId);
const get = (p: Project, ruleId: string) => checkProject(p).find((f) => f.ruleId === ruleId);

describe('matrice RGIE — cas conformes', () => {
  it('installation neuve complète : aucun constat bloquant ni non conforme', () => {
    const { p } = compliant();
    const f = checkProject(p);
    expect(f.filter((x) => x.status === 'nonCompliant')).toEqual([]);
    expect(isBlocking(f)).toBe(false);
  });

  it('salle de bain indiquée et protégée par un 30 mA : conforme', () => {
    const { p, board, sockets } = compliant();
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
    const { p, sockets } = compliant();
    sockets.props.wetRoom = 'yes';
    expect(get(p, 'R-RCD30')).toMatchObject({ status: 'nonCompliant', blocking: true });
  });
});

describe('matrice RGIE — locaux humides', () => {
  it('nom évocateur sans indication : vérification manuelle, pas une non-conformité', () => {
    const { p, sockets } = compliant();
    sockets.props.circuitName = 'Prises salle de bain';
    expect(ids(p)).not.toContain('R-RCD30');
    expect(get(p, 'R-WETROOM-NAME')).toMatchObject({ status: 'manualCheck', blocking: false, inferred: true });
  });

  it('nom évocateur mais « non » indiqué : plus de constat', () => {
    const { p, sockets } = compliant();
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

  it('existante : une règle de conception devient une recommandation', () => {
    const { p, sockets } = compliant();
    p.meta.installationKind = 'existing';
    sockets.children[0].children = Array.from({ length: 10 }, () => createNode('socket'));
    expect(get(p, 'R-SOCKET-MAX')).toMatchObject({ status: 'recommendation', blocking: false, severity: 'info' });
  });

  it('ancien RGIE (rgieVersion « old ») : édition 1981 appliquée, jamais « conforme » en silence', () => {
    const { p, board } = compliant();
    p.meta.rgieVersion = 'old';
    board.children = board.children.filter((c) => c.kind !== 'earthBar');
    expect(get(p, 'R-EARTH-MISSING')).toMatchObject({ status: 'nonCompliant', edition: '1981' });
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
  it('circuit ancien (partie ancienne) dans une installation neuve : règle de conception en recommandation', () => {
    const { p, sockets, lights } = compliant();
    sockets.props.oldPart = true;
    sockets.children[0].children = Array.from({ length: 10 }, () => createNode('socket'));
    lights.children[0].children = [createNode('socket'), ...lights.children[0].children]; // prise sur 1,5 mm² (neuf)
    const f = checkProject(p);
    expect(f.find((x) => x.ruleId === 'R-SOCKET-MAX')).toMatchObject({ status: 'recommendation', edition: 'pre1981' });
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
    const { p, sockets } = compliant();
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
