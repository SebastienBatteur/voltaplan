import { describe, expect, it } from 'vitest';
import { readingFromWords, segmentsFromRow, type PlacedWord } from '../src/ocr/board';
import { composedGeometry } from '../src/ai/boardImage';

describe('OCR tableau — appareils et inscriptions', () => {
  it('appareils : modules occupés coupés aux séparations, vides ignorés', () => {
    const occ = [true, true, true, true, false, true, true];
    const sep = [true, false, true, true, false, true, false];
    expect(segmentsFromRow(occ, sep)).toEqual([
      { start: 0, width: 2 },
      { start: 2, width: 1 },
      { start: 3, width: 1 },
      { start: 5, width: 2 },
    ]);
  });

  it('mots rattachés à leur appareil : corps → calibre/sensibilité, au-dessus → étiquette ; mots peu sûrs écartés', () => {
    const modPx = 100;
    const g = composedGeometry([{ a: { x: 0, y: 0 }, b: { x: 400, y: 0 } }], 4, modPx);
    const axis = g.bandTop[0] + g.axis;
    const w = (text: string, module: number, dy: number, confidence = 90): PlacedWord => ({
      text,
      cx: g.margin + (module + 0.5) * modPx,
      cy: axis + dy,
      bbox: { x0: 0, y0: 0, x1: 0, y1: 0 },
      confidence,
    });
    const words = [w('40A', 0.5, 10), w('30mA', 0.5, 30), w('C16', 2, 0), w('PRISES', 2, -300), w('CUISINE', 2, -260), w('C32', 3, 0, 20)];
    const r = readingFromWords(words, g, modPx, [[{ start: 0, width: 2 }, { start: 2, width: 1 }, { start: 3, width: 1 }]], 240);
    const [rcd, mcb, unknown] = r.rows[0].devices;
    expect(rcd).toMatchObject({ kind: 'rcd', residualCurrentmA: 30, startModule: 0, widthModules: 2, confidence: 'low' });
    expect(mcb).toMatchObject({ kind: 'mcb', ratedCurrentA: 16, curve: 'C', label: 'PRISES CUISINE' });
    expect(unknown).toMatchObject({ kind: 'other', ratedCurrentA: null });
  });
});
