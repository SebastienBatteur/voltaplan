import { describe, expect, it } from 'vitest';
import { checkProject } from '../src/rules';
import { typicalHouseProject } from '../src/model/templates';
import { isCircuit, walk } from '../src/model/tree';
import { translate } from '../src/i18n';

const t = (k: string) => translate('fr', k as never);

describe('modèle maison type', () => {
  for (const supply of ['2 x 230V ~ 50Hz', '3N x 400V ~ 50Hz']) {
    it(`passe le contrôle RGIE sans constat bloquant (${supply})`, () => {
      const p = typicalHouseProject(t, supply);
      p.meta.supply = supply;
      const findings = checkProject(p);
      // Adresse et installateur : remplis par l'assistant, pas par le modèle
      const blocking = findings.filter((f) => (f.severity === 'error' || f.blocking) && !f.ruleId.startsWith('R-DOC-'));
      expect(blocking.map((f) => `${f.ruleId} ${JSON.stringify(f.params ?? {})}`)).toEqual([]);
      const warnings = findings.filter((f) => f.severity === 'warning');
      expect(warnings.map((f) => f.ruleId)).toEqual([]);
    });
  }

  it('contient les circuits courants, nommés et rangés par pièce', () => {
    const p = typicalHouseProject(t, '2 x 230V ~ 50Hz');
    const nodes = [...walk(p.roots)].map((w) => w.node);
    const circuits = nodes.filter(isCircuit);
    expect(circuits.length).toBe(6);
    expect(circuits.every((c) => typeof c.props.circuitName === 'string' && c.props.circuitName.length > 0)).toBe(true);
    expect(circuits.every((c) => c.props.poles === '2P')).toBe(true);
    expect(nodes.some((n) => n.kind === 'protection' && n.props.residualCurrent === 30)).toBe(true);
    expect(nodes.filter((n) => n.kind === 'socket').every((n) => !!n.location || nodes.some((m) => m.children.includes(n) && m.location))).toBe(true);
    expect(nodes.some((n) => n.kind === 'earth')).toBe(true);
  });
});
