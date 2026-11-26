import { describe, expect, it } from 'vitest';
import { measureGray, qualityIssues, type PhotoMetrics } from '../src/ocr/quality';

const good: PhotoMetrics = { minSide: 1512, mean: 130, spread: 180, glare: 0.001, sharpness: 450 };

describe('qualité des photos', () => {
  it('photo correcte bien lue : aucun message ; mal lue : conseil de cadrage', () => {
    expect(qualityIssues(good, false)).toEqual([]);
    expect(qualityIssues(good, true)).toEqual(['framing']);
  });

  it('valeurs mesurées sur de vraies photos : floue et mal lue → floue ; sombre mais lue → rien', () => {
    // Compteur Iskra (lecture incomplète) : netteté 105
    expect(qualityIssues({ minSide: 1512, mean: 109, spread: 186, glare: 0, sharpness: 105 }, true)).toEqual(['blur']);
    // Compteur AEG avec reflets, bien lu : netteté 143, moyenne 77
    expect(qualityIssues({ minSide: 1512, mean: 77, spread: 177, glare: 0, sharpness: 143 }, false)).toEqual([]);
  });

  it('trop petite, sombre, reflets, peu contrastée', () => {
    expect(qualityIssues({ ...good, minSide: 500 }, false)).toContain('small');
    expect(qualityIssues({ ...good, mean: 30 }, false)).toContain('dark');
    expect(qualityIssues({ ...good, glare: 0.2 }, false)).toContain('glare');
    expect(qualityIssues({ ...good, spread: 50 }, true)).toContain('lowContrast');
  });

  it('mesures : image uniforme = aucune netteté, image en damier = très nette', () => {
    const w = 40;
    const flat = new Uint8Array(w * w).fill(128);
    expect(measureGray(flat, w, w, 40)).toMatchObject({ mean: 128, spread: 0, glare: 0, sharpness: 0 });
    const board = Uint8Array.from({ length: w * w }, (_, i) => (((i % w) + Math.floor(i / w)) % 2 ? 255 : 0));
    const m = measureGray(board, w, w, 40);
    expect(m.sharpness).toBeGreaterThan(10000);
    expect(m.glare).toBeCloseTo(0.5, 1);
  });
});
