import { calcCircuit, cableRho, RHO_AL, RHO_CU } from '../src/calc/electrical';
import { balanceProject, imbalance } from '../src/calc/balance';
import { checkProject } from '../src/rules';
import { createNode, emptyProject } from '../src/model/tree';
import type { ElNode, Project } from '../src/model/types';

function circuit(len: number, section: number, rating: number, curve = 'C', cableProps: ElNode['props'] = {}, poles = '1P+N') {
  const p = createNode('protection', { device: 'mcb', ratedCurrent: rating, curve, poles });
  const c = createNode('cable', { section, length: len, ...cableProps });
  c.children = [createNode('socket')];
  p.children = [c];
  return p;
}

/** Tableau principal du projet vide (origine → compteur → différentiel 40 A → tableau). */
function mainBoard(p: Project): ElNode {
  return p.roots[0].children[0].children[0].children[0];
}

describe('chute de tension et court-circuit (méthode conventionnelle)', () => {
  const project = emptyProject();
  it('2,5 mm² Cu, 20 A, 30 m : ΔU = 2·0,0225·30·20/2,5 = 10,8 V = 4,696 %', () => {
    const r = calcCircuit(circuit(30, 2.5, 20, 'C', { material: 'Cu' }), project);
    expect(r.length).toBe(30);
    expect(r.dropPct).toBeCloseTo((100 * 10.8) / 230, 6); // 4,6957 %, non arrondi
    expect(r.dropLimit).toBe(5);
    expect(r.method).toBe('conservative');
    // Icc min = 0,8·230 / (2·0,0225·30/2,5) = 184 / 0,54 = 340,74 A > 10·20 = 200 A
    expect(r.iccMin).toBeCloseTo(184 / 0.54, 6);
    expect(r.magnetic).toBe(200);
    // Lmax = 0,8·230·2,5 / (2·0,0225·200) = 460 / 9 = 51,11 m
    expect(r.lmax).toBeCloseTo(460 / 9, 6);
    expect(r.assumptions).not.toContain('copperAssumed');
    expect(r.assumptions).toContain('ratingCurrent');
  });
  it('courbe B : Lmax = 0,8·230·2,5 / (2·0,0225·5·20) = 102,2 m', () => {
    const r = calcCircuit(circuit(30, 2.5, 20, 'B'), project);
    expect(r.magnetic).toBe(100);
    expect(r.lmax).toBeCloseTo(920 / 9, 6);
    expect(r.assumptions).toContain('copperAssumed');
  });
  it('aluminium 16 mm², 63 A, 40 m : ΔU = 2·0,036·40·63/16 = 11,34 V = 4,930 %', () => {
    expect(cableRho(createNode('cable', { material: 'Al' })).rho).toBe(RHO_AL);
    expect(cableRho(createNode('cable')).rho).toBe(RHO_CU);
    const r = calcCircuit(circuit(40, 16, 63, 'C', { material: 'Al' }), project);
    expect(r.dropPct).toBeCloseTo((100 * 11.34) / 230, 6);
    // Lmax = 0,8·230·16 / (2·0,036·630) = 2944 / 45,36 = 64,90 m
    expect(r.lmax).toBeCloseTo(2944 / 45.36, 6);
  });
  it('triphasé 3N × 400 V, 6 mm², 32 A, 50 m : ΔU = √3·0,0225·50·32/6 = 10,39 V = 2,598 %', () => {
    const p3 = emptyProject();
    p3.meta.supply = '3N x 400V ~ 50Hz';
    const r = calcCircuit(circuit(50, 6, 32, 'C', {}, '4P'), p3);
    expect(r.threePhase).toBe(true);
    expect(r.voltage).toBe(400);
    expect(r.dropPct).toBeCloseTo((100 * Math.sqrt(3) * 6) / 400, 6);
    // Icc min : défaut phase-neutre (le plus faible), 0,8·230 / (2·0,0225·50/6) = 490,7 A
    // (et non le défaut triphasé 0,8·400/(√3·R), qui surestimait Lmax d'un facteur 2) ;
    // Lmax = 0,8·230·6 / (2·0,0225·320) = 76,67 m
    expect(r.iccMin).toBeCloseTo(184 / (2 * 0.1875), 6);
    expect(r.lmax).toBeCloseTo(1104 / (2 * 0.0225 * 320), 6);
  });

  it('triphasé 3 × 230 V sans neutre : défaut phase-phase à 230 V, boucle de deux conducteurs', () => {
    const p3 = emptyProject();
    p3.meta.supply = '3 x 230V ~ 50Hz';
    const r = calcCircuit(circuit(50, 6, 32, 'C', {}, '3P'), p3);
    expect(r.threePhase).toBe(true);
    expect(r.iccMin).toBeCloseTo(184 / (2 * 0.1875), 6);
    expect(r.lmax).toBeCloseTo(1104 / (2 * 0.0225 * 320), 6);
  });
  it('trop long : Icc min sous le seuil magnétique', () => {
    const r = calcCircuit(circuit(80, 2.5, 20), project);
    expect(r.iccMin!).toBeLessThan(r.magnetic!);
  });
  it('longueur manquante : pas de calcul', () => {
    const p = circuit(30, 2.5, 20);
    delete p.children[0].props.length;
    const r = calcCircuit(p, project);
    expect(r.missingLength).toBe(1);
    expect(r.dropPct).toBeUndefined();
  });
  it('comparaison sur la valeur brute : 5,004 % dépasse 5 % (arrondi à 5,00 % il passerait)', () => {
    // ΔU % = 100·2·0,0225·L·20/(2,5·230) = 5,004 % → L = 5,004·2,5·230 / (100·2·0,0225·20) = 31,9700 m
    const L = (5.004 * 2.5 * 230) / (100 * 2 * 0.0225 * 20);
    const p = emptyProject();
    mainBoard(p).children.push(circuit(L, 2.5, 20));
    const f = checkProject(p).find((x) => x.ruleId === 'R-VDROP');
    expect(f).toBeDefined();
    expect(f!.params!.value).toBe(5); // message arrondi à 2 décimales : 5,00
  });
});

describe('chute cumulée depuis l’origine', () => {
  /**
   * Différentiel 40 A (1P+N) → câble 10 mm² Cu 25 m → sous-tableau → disjoncteur C20 → 2,5 mm² 30 m → prise.
   * Amont : 2·0,0225·25·40/10 = 4,5 V = 1,957 % ; circuit : 4,696 % ; total 6,652 % > 5 %.
   */
  function project() {
    const p = emptyProject();
    const main = mainBoard(p);
    const feederProt = createNode('protection', { device: 'mcb', ratedCurrent: 40, curve: 'C', poles: '1P+N' });
    const feeder = createNode('cable', { section: 10, length: 25 });
    const sub = createNode('board', { name: 'Garage' });
    const c = circuit(30, 2.5, 20);
    sub.children = [c];
    feeder.children = [sub];
    feederProt.children = [feeder];
    main.children.push(feederProt);
    return { p, c, feeder };
  }
  it('ajoute la chute du câble d’alimentation du sous-tableau', () => {
    const { p, c } = project();
    const r = calcCircuit(c, p);
    expect(r.upstreamCables).toBe(1);
    expect(r.upstreamDropPct).toBeCloseTo((100 * 4.5) / 230, 6);
    expect(r.totalDropPct).toBeCloseTo((100 * 15.3) / 230, 6); // 4,5 + 10,8 V = 6,652 %
    expect(r.checkDropPct).toBe(r.totalDropPct);
    // Icc avec l'amont : R = 0,0225·25/10 + 0,0225·30/2,5 = 0,05625 + 0,27 ; Icc = 184 / (2·0,32625) = 281,99 A
    expect(r.iccMin).toBeCloseTo(184 / (2 * 0.32625), 6);
    // Lmax = (184/(2·200) − 0,05625) · 2,5/0,0225 = 44,86 m
    expect(r.lmax).toBeCloseTo((0.46 - 0.05625) * (2.5 / 0.0225), 6);
    const f = checkProject(p).find((x) => x.ruleId === 'R-VDROP' && x.nodeId === c.id);
    expect(f?.params?.value).toBe(6.65);
  });
  it('le raccordement avant le compteur n’est pas compté (origine = compteur)', () => {
    const p = emptyProject();
    const origin = p.roots[0];
    const service = createNode('cable', { section: 16 }); // sans longueur
    service.children = origin.children;
    origin.children = [service];
    const c = circuit(30, 2.5, 20);
    service.children[0].children[0].children[0].children.push(c); // compteur → différentiel → tableau
    const r = calcCircuit(c, p);
    expect(r.upstreamCables).toBe(0);
    expect(r.totalDropPct).toBeCloseTo(r.dropPct!, 9);
  });
  it('amont incomplet : total inconnu, contrôle sur le circuit seul', () => {
    const { p, c, feeder } = project();
    delete feeder.props.length;
    const r = calcCircuit(c, p);
    expect(r.upstreamMissing).toBe(1);
    expect(r.upstreamDropPct).toBeUndefined();
    expect(r.totalDropPct).toBeUndefined();
    expect(r.checkDropPct).toBe(r.dropPct);
    expect(r.assumptions).toContain('upstreamUnknown');
  });
});

describe('méthode détaillée (puissances connues)', () => {
  it('charges réparties : chaque tronçon porte le courant aval', () => {
    // C20 → câble A 2,5 mm² 10 m → [four 2300 W ; câble B 2,5 mm² 20 m → appareil 1150 W]
    // I1 = 2300/230 = 10 A, I2 = 1150/230 = 5 A ; A porte 15 A : 2·0,0225·10·15/2,5 = 2,7 V ;
    // B porte 5 A : 2·0,0225·20·5/2,5 = 1,8 V ; extrémité la plus défavorable 4,5 V = 1,957 %.
    const p = createNode('protection', { device: 'mcb', ratedCurrent: 20, curve: 'C', poles: '1P+N' });
    const a = createNode('cable', { section: 2.5, length: 10 });
    const b = createNode('cable', { section: 2.5, length: 20 });
    b.children = [createNode('appliance', { power: 1150 })];
    a.children = [createNode('appliance', { applianceType: 'oven', power: 2300 }), b];
    p.children = [a];
    const r = calcCircuit(p, emptyProject());
    expect(r.method).toBe('detailed');
    expect(r.designCurrent).toBeCloseTo(15, 6);
    expect(r.detailedDropPct).toBeCloseTo((100 * 4.5) / 230, 6);
    expect(r.dropPct).toBeCloseTo((100 * 10.8) / 230, 6); // conservatif au calibre, toujours donné
    expect(r.checkDropPct).toBeCloseTo((100 * 4.5) / 230, 6);
    expect(r.assumptions).toContain('cosPhiOne');
  });
  it('cos φ = 0,8 : ΔU = b·L·(ρ/S·Ia + λ·Ir)', () => {
    // Moteur 2300 W, cos φ 0,8, 2,5 mm² 30 m : Ia = 10 A, Ir = 10·0,75 = 7,5 A
    // ΔU = 2·30·(0,009·10 + 0,00008·7,5) = 5,436 V = 2,363 % ; Ib = √(10² + 7,5²) = 12,5 A
    const p = createNode('protection', { device: 'mcb', ratedCurrent: 20, curve: 'C', poles: '1P+N' });
    const c = createNode('cable', { section: 2.5, length: 30 });
    c.children = [createNode('motor', { power: 2300, cosPhi: 0.8 })];
    p.children = [c];
    const r = calcCircuit(p, emptyProject());
    expect(r.detailedDropPct).toBeCloseTo((100 * 5.436) / 230, 6);
    expect(r.designCurrent).toBeCloseTo(12.5, 6);
    expect(r.assumptions).not.toContain('cosPhiOne');
  });
  it('une prise sans appareil désigné : pas de méthode détaillée', () => {
    const r = calcCircuit(circuit(30, 2.5, 20), emptyProject());
    expect(r.method).toBe('conservative');
    expect(r.detailedDropPct).toBeUndefined();
  });
  it('contrôle : dépassement au calibre non confirmé par le détail → information, pas de R-VDROP', () => {
    // 2,5 mm² 40 m, C20 : au calibre 2·0,0225·40·20/2,5 = 14,4 V = 6,26 % ; avec 1000 W : 1,36 %
    const make = (power?: number) => {
      const proj = emptyProject();
      const p = createNode('protection', { device: 'mcb', ratedCurrent: 20, curve: 'C', poles: '1P+N' });
      const c = createNode('cable', { section: 2.5, length: 40 });
      c.children = [createNode('appliance', power ? { power } : {})];
      p.children = [c];
      mainBoard(proj).children.push(p);
      return checkProject(proj).filter((f) => f.nodeId === p.id).map((f) => f.ruleId);
    };
    const withPower = make(1000);
    expect(withPower).toContain('R-VDROP-RATING');
    expect(withPower).not.toContain('R-VDROP');
    const without = make();
    expect(without).toContain('R-VDROP');
    expect(without).not.toContain('R-VDROP-RATING');
  });
});

describe('bilan de puissance et équilibre des phases', () => {
  it('par phase, déséquilibre et simultanéité saisie', () => {
    const p = emptyProject();
    p.meta.supply = '3N x 400V ~ 50Hz';
    const board = mainBoard(p);
    board.props.simultaneity = 0.5;
    const mk = (props: ElNode['props'], load: ElNode) => {
      const prot = createNode('protection', { device: 'mcb', ratedCurrent: 16, curve: 'C', poles: '1P+N', ...props });
      const c = createNode('cable', { section: 2.5, length: 10 });
      c.children = [load];
      prot.children = [c];
      board.children.push(prot);
    };
    mk({ phase: 'L1' }, createNode('appliance', { power: 2000 }));
    mk({ phase: 'L2' }, createNode('light', { power: 100, count: 4 }));
    mk({ poles: '4P' }, createNode('motor', { power: 3000 }));
    mk({ phase: 'L3' }, createNode('socket'));
    const [b] = balanceProject(p);
    // L1 = 2000 + 1000, L2 = 400 + 1000, L3 = 0 + 1000 ; moyenne 1800 ; écart max 1200 → 66,7 %
    expect(b.installedW).toBe(5400);
    expect(b.perPhase).toEqual({ L1: 3000, L2: 1400, L3: 1000 });
    expect(b.unknownLoads).toBe(1);
    expect(b.imbalancePct).toBeCloseTo((100 * 1200) / 1800, 6);
    expect(b.demandW).toBe(2700);
  });
  it('phase non attribuée : pas de déséquilibre ; pas de simultanéité inventée', () => {
    const p = emptyProject();
    p.meta.supply = '3N x 400V ~ 50Hz';
    const prot = createNode('protection', { device: 'mcb', ratedCurrent: 16, poles: '1P+N' });
    const c = createNode('cable', { section: 2.5, length: 10 });
    c.children = [createNode('appliance', { power: 1000 })];
    prot.children = [c];
    mainBoard(p).children.push(prot);
    const [b] = balanceProject(p);
    expect(b.unassignedW).toBe(1000);
    expect(b.imbalancePct).toBeUndefined();
    expect(b.demandW).toBeUndefined();
    expect(imbalance({ L1: 1000, L2: 1000, L3: 1000 })).toBe(0);
  });
});
