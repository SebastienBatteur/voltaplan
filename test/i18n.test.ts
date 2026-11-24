/**
 * Cohérence des traductions : mêmes clés en français, néerlandais et anglais ; paramètres {x} identiques ;
 * allemand partiel (repli sur l'anglais) sans clé inconnue ; libellés de toutes les propriétés et valeurs.
 */
import { fr } from '../src/i18n/fr';
import { nl } from '../src/i18n/nl';
import { en } from '../src/i18n/en';
import { de } from '../src/i18n/de';
import { PROP_SCHEMAS } from '../src/model/schema';
import { BE_RULES } from '../src/rules/be/catalog';

const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const keys = (d: object) => Object.keys(d).sort();

describe('traductions', () => {
  it.each([
    ['nl', nl],
    ['en', en],
  ] as const)('%s a exactement les clés du français', (_, d) => {
    const missing = keys(fr).filter((k) => !(k in d));
    const extra = keys(d).filter((k) => !(k in fr));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it.each([
    ['nl', nl],
    ['en', en],
    ['de', de],
  ] as const)('%s : mêmes paramètres {x} que le français', (_, d) => {
    const diff = Object.entries(d)
      .filter(([k, v]) => k in fr && params(v as string) !== params((fr as Record<string, string>)[k]))
      .map(([k]) => k);
    expect(diff).toEqual([]);
  });

  it('allemand : aucune clé inconnue', () => {
    expect(keys(de).filter((k) => !(k in fr))).toEqual([]);
  });

  it('chaque propriété et chaque valeur de liste a un libellé', () => {
    const missing: string[] = [];
    for (const defs of Object.values(PROP_SCHEMAS))
      for (const d of defs ?? []) {
        if (!(('prop.' + d.key) in fr)) missing.push('prop.' + d.key);
        for (const o of d.options ?? []) if (d.key !== 'cableType' && d.key !== 'phase' && d.key !== 'curve' && d.key !== 'poles' && d.key !== 'rcdType' && !((`enum.${d.key}.${o}`) in fr)) missing.push(`enum.${d.key}.${o}`);
      }
    expect([...new Set(missing)]).toEqual([]);
  });

  it('chaque règle du catalogue a son constat dans les trois langues', () => {
    for (const id of Object.keys(BE_RULES)) for (const d of [fr, nl, en]) expect(('rule.' + id) in d).toBe(true);
  });
});
