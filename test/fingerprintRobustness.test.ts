// @vitest-environment node
/**
 * Robustesse des empreintes de similarité (tools/provenance/robustness.ts) : un dérivé reste repérable après les
 * transformations courantes, et du code indépendant n'est pas confondu. Sous-ensemble rapide ; tableau complet :
 * `npm run provenance -- eval` (docs/security/artifact-integrity.md). Les seuils sont des MINIMA observés, pas des
 * garanties : la similarité reste un indice, jamais une preuve.
 */
import { describe, expect, it } from 'vitest';
import { dependencyBackground } from '../tools/provenance/history';
import { evaluate, type Row } from '../tools/provenance/robustness';

const VARIANTS = [
  'esbuild full minification',
  'variables renamed (minifyIdentifiers)',
  'comments and formatting (minifyWhitespace)',
  'project renamed + minified',
  '1/2 of statements removed + minified',
  'embedded in a larger app (with libraries)',
];
const INDEPENDENT = ['typescript-estree', 'eslint linter', 'jsdom window', 'vite client'];

describe('empreintes de similarité : robustesse et faux positifs', () => {
  let rows: Row[] = [];
  it('calcul (2 composants, 6 transformations, 4 codes indépendants)', async () => {
    const bg = dependencyBackground(process.cwd(), 300_000).bg;
    rows = (await evaluate(process.cwd(), { components: ['rgie-rules', 'file-format'], variants: VARIANTS, independent: INDEPENDENT, bg })).rows;
    expect(rows.length).toBe(VARIANTS.length + INDEPENDENT.length);
  }, 120_000);

  it.each(VARIANTS)('%s : le composant reste repérable', (v) => {
    const r = rows.find((x) => x.variant === v)!;
    for (const [name, s] of Object.entries(r.scores)) {
      // Seuil de signalement documenté : chaînes ≥ 35 % OU jetons ≥ 35 %
      expect(Math.max(s.strings, s.tokens), `${v} / ${name}`).toBeGreaterThanOrEqual(0.35);
    }
  });

  it('renommage des variables et formatage : chaînes intactes, jetons quasi intacts', () => {
    for (const v of ['variables renamed (minifyIdentifiers)', 'comments and formatting (minifyWhitespace)']) {
      const r = rows.find((x) => x.variant === v)!;
      for (const s of Object.values(r.scores)) {
        expect(s.strings).toBe(1);
        expect(s.tokens).toBeGreaterThanOrEqual(0.75);
      }
    }
  });

  it.each(INDEPENDENT)('%s (code indépendant) : sous le seuil de signalement', (v) => {
    const r = rows.find((x) => x.variant === v)!;
    for (const s of Object.values(r.scores)) {
      expect(s.strings).toBeLessThan(0.1);
      expect(s.tokens).toBeLessThan(0.1);
    }
  });
});
