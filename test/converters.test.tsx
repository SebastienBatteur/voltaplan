import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { checkProject } from '../src/rules';
import { createNode, emptyProject } from '../src/model/tree';
import { PROP_SCHEMAS } from '../src/model/schema';
import { translate } from '../src/i18n';
import { Symbol as NodeSymbol } from '../src/unifilar/symbols';

const withInverter = (type?: string) => {
  const p = emptyProject();
  const board = p.roots[0].children[0].children[0].children[0];
  const inv = createNode('inverter', type ? { inverterType: type } : {});
  if (!type) delete inv.props.inverterType; // ancien fichier : propriété absente
  const cable = createNode('cable', { section: 2.5 });
  cable.children.push(inv);
  const mcb = createNode('protection', { device: 'mcb', ratedCurrent: 20, circuitName: 'Conv' });
  mcb.children.push(cable);
  board.children.push(mcb);
  return { p, inv };
};

describe('convertisseurs (RGIE tableau 2.23, H. Sources)', () => {
  it('trois types, onduleur DC → AC par défaut, libellés traduits', () => {
    const def = PROP_SCHEMAS.inverter!.find((d) => d.key === 'inverterType')!;
    expect(def.options).toEqual(['dcAc', 'acDc', 'dcDc']);
    expect(def.default).toBe('dcAc');
    for (const lang of ['fr', 'nl', 'en'] as const)
      for (const o of def.options!) expect(translate(lang, `enum.inverterType.${o}` as never)).not.toBe(`enum.inverterType.${o}`);
  });

  it('le rappel photovoltaïque ne vise pas un convertisseur de batterie', () => {
    const pv = (type?: string) => checkProject(withInverter(type).p).some((f) => f.ruleId === 'R-PV-MANUAL');
    expect(pv(undefined)).toBe(true);
    expect(pv('dcAc')).toBe(true);
    expect(pv('acDc')).toBe(false);
    expect(pv('dcDc')).toBe(false);
  });

  it('chaque type a son propre dessin', () => {
    const svg = (type: string) => renderToStaticMarkup(<svg><NodeSymbol node={withInverter(type).inv} orient="v" /></svg>);
    const all = new Set(['dcAc', 'acDc', 'dcDc'].map(svg));
    expect(all.size).toBe(3);
  });
});
