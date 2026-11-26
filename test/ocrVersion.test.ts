import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { OCR_VERSION } from '../src/ocr/engine';
import { ocrFiles } from '../tools/ocr/plugin';

describe('moteur OCR livré avec Voltaplan', () => {
  it('version du dossier publié = version de tesseract.js installée', () => {
    expect(JSON.parse(readFileSync('node_modules/tesseract.js/package.json', 'utf8')).version).toBe(OCR_VERSION);
  });

  it('fichiers publiés : moteur, trois cœurs LSTM, langues fr/nl/en, tous présents, tous sous ocr/<version>/', () => {
    const f = ocrFiles();
    expect(Object.keys(f).sort()).toEqual(
      [
        'worker.min.js',
        'core/tesseract-core-lstm.wasm.js',
        'core/tesseract-core-relaxedsimd-lstm.wasm.js',
        'core/tesseract-core-simd-lstm.wasm.js',
        'lang/eng.traineddata.gz',
        'lang/fra.traineddata.gz',
        'lang/nld.traineddata.gz',
      ]
        .map((x) => `ocr/${OCR_VERSION}/${x}`)
        .sort(),
    );
    for (const src of Object.values(f)) expect(readFileSync(src).length).toBeGreaterThan(100_000);
  });
});
