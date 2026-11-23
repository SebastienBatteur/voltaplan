import { describe, expect, it } from 'vitest';
import { composedGeometry, MOD_PX } from '../src/ai/boardImage';

describe("image composée pour l'IA", () => {
  it('une bande par rangée, un module = MOD_PX, rangée inclinée redressée', () => {
    // Rangée 0 horizontale de 900 px ; rangée 1 inclinée (3-4-5) de 1000 px
    const g = composedGeometry(
      [
        { a: { x: 100, y: 200 }, b: { x: 1000, y: 200 } },
        { a: { x: 100, y: 600 }, b: { x: 900, y: 1200 } },
      ],
      18,
    );
    expect(g.width).toBe(18 * MOD_PX + MOD_PX);
    expect(g.rows[0].scale).toBeCloseTo((18 * MOD_PX) / 900);
    expect(g.rows[1].scale).toBeCloseTo((18 * MOD_PX) / 1000);
    expect(g.rows[1].angle).toBeCloseTo(Math.atan2(600, 800));
    expect(g.bandTop[1]).toBeGreaterThan(g.bandTop[0] + g.bandH - 1);
    expect(g.height).toBe(g.bandTop[1] + g.bandH);
    // Image petite : quelques centaines de milliers de pixels, pas une photo de 12 Mpx
    expect(g.width * g.height).toBeLessThan(1_500_000);
  });
});
