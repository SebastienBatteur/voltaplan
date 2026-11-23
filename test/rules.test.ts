import { RULE_PACKS, checkProject, getRulePack } from '../src/rules';
import type { RulePack } from '../src/rules';
import { addMessages, translate } from '../src/i18n';
import { emptyProject } from '../src/model/tree';

describe('référentiels par pays', () => {
  it('Belgique (RGIE) par défaut', () => {
    const p = emptyProject();
    expect(getRulePack(p.meta.ruleset).id).toBe('BE-RGIE');
    expect(checkProject(p).some((f) => f.ruleId === 'R-EARTH-MISSING')).toBe(true);
  });

  it('un autre pays se branche sans modifier le moteur', () => {
    const demo: RulePack = {
      id: 'XX-DEMO',
      country: 'XX',
      label: { en: 'Demo country' },
      versions: ['new'],
      check: () => [{ ruleId: 'XX-1', severity: 'warning' }],
      messages: { fr: { 'rule.XX-1': 'Règle de démonstration' } },
    };
    RULE_PACKS.push(demo);
    addMessages(demo.messages!);
    try {
      const p = emptyProject();
      p.meta.ruleset = 'XX-DEMO';
      expect(checkProject(p)).toEqual([{ ruleId: 'XX-1', severity: 'warning' }]);
      expect(translate('fr', 'rule.XX-1')).toBe('Règle de démonstration');
      expect(translate('nl', 'rule.XX-1')).toBe('Règle de démonstration'); // repli sur le français
    } finally {
      RULE_PACKS.pop();
    }
  });
});

describe('mesures', () => {
  it('signale un différentiel trop lent et une liaison équipotentielle non conforme', () => {
    const p = emptyProject();
    const rcd = p.roots[0].children[0].children[0]; // origine → compteur → différentiel 300 mA
    p.measurements = { earthResistanceOhm: 20, insulationMOhm: 5, bondingOk: false, rcdTests: { [rcd.id]: { tripMs: 420 } } };
    const ids = checkProject(p).map((f) => f.ruleId);
    expect(ids).toContain('R-RCD-TRIP');
    expect(ids).toContain('R-BONDING');
    expect(ids).not.toContain('R-MEAS-MISSING');
  });
});
