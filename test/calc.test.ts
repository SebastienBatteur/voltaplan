import { calcCircuit } from '../src/calc/electrical';
import { createNode, emptyProject } from '../src/model/tree';

function circuit(len: number, section: number, rating: number, curve = 'C') {
  const p = createNode('protection', { device: 'mcb', ratedCurrent: rating, curve, poles: '1P+N' });
  const c = createNode('cable', { section, length: len });
  c.children = [createNode('socket')];
  p.children = [c];
  return p;
}

describe('chute de tension et court-circuit', () => {
  const project = emptyProject();
  it('2,5 mm², 20 A, 30 m : ΔU = 2·0,0225·30·20/2,5/230 = 4,7 %', () => {
    const r = calcCircuit(circuit(30, 2.5, 20), project);
    expect(r.length).toBe(30);
    expect(r.dropPct).toBeCloseTo(4.7, 1);
    expect(r.dropLimit).toBe(5);
    // Lmax = 0,8·230·2,5 / (2·0,0225·200) = 51,1 m
    expect(r.lmax).toBeCloseTo(51.1, 1);
    expect(r.iccMin!).toBeGreaterThan(r.magnetic!);
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
});
