import { describe, expect, it } from 'vitest';
import { correctWord, plausibleLabel, readDevice, readMeterPlate, roomLabels, type OcrWord } from '../src/ocr/parse';

describe('OCR — plaque de compteur', () => {
  it('ancien compteur triphasé : 220/380 V, 3x10(40) A → 3N x 400V proposé', () => {
    const m = readMeterPlate('AEG\nT2C14G11 NO 40 005\n220/380 V Y 3x10(40) A 50 Hz\n150 tr/kWh');
    expect(m).toMatchObject({ phases: 3, voltage: '220/380', baseA: 10, maxA: 40, frequencyHz: 50, supply: '3N x 400V ~ 50Hz' });
    expect(m.evidence).toContain('220/380 V');
  });

  it('compteur numérique monophasé : 230V, 0,25-5 (60)A → 2 x 230V proposé', () => {
    const m = readMeterPlate('230V ~ 50Hz\n0,25 - 5 (60)A\n-25°C / +55°C\nIP51');
    expect(m).toMatchObject({ phases: 1, voltage: '230', baseA: 5, maxA: 60, supply: '2 x 230V ~ 50Hz' });
  });

  it('triphasé sans neutre : 3 x 230 V → 3 x 230V proposé', () => {
    expect(readMeterPlate('3 x 230 V 50 Hz 10(60) A')).toMatchObject({ phases: 3, supply: '3 x 230V ~ 50Hz' });
  });

  it('triphasé lu sans la tension : deux choix proposés, aucun imposé', () => {
    const m = readMeterPlate('AEG 3x 10(40) A 150 tr/kWh');
    expect(m.supply).toBeUndefined();
    expect(m).toMatchObject({ phases: 3, options: ['3N x 400V ~ 50Hz', '3 x 230V ~ 50Hz'] });
  });

  it('rien de reconnaissable : aucune proposition', () => {
    expect(readMeterPlate('kWh 0 7 3 3 6 3 6 T1')).toEqual({ evidence: [] });
  });
});

describe('OCR — inscriptions des appareils', () => {
  it('courbe et calibre (C16, B 20), calibre ancien entre parenthèses', () => {
    expect(readDevice('ABB EPC32 C16 3000')).toMatchObject({ curve: 'C', ratedCurrentA: 16 });
    expect(readDevice('hager B 20 400 V~')).toMatchObject({ curve: 'B', ratedCurrentA: 20 });
    expect(readDevice("hager N22-L (20 A) 220/380 V~")).toMatchObject({ ratedCurrentA: 20 });
    expect(readDevice("hager N22-L (20 A)").curve).toBeUndefined();
  });

  it('bruit écarté : C2, D0, B4 hors calibres normalisés ou isolés ne donnent rien de faux', () => {
    expect(readDevice('C0 D0 xx').ratedCurrentA).toBeUndefined();
    expect(readDevice('B29 C38').ratedCurrentA).toBeUndefined();
    expect(readDevice('EPC32').ratedCurrentA).toBeUndefined();
  });

  it('sensibilité : 30mA, 300mA, IΔn 0,03 A, 0,3 A', () => {
    expect(readDevice('TX3 40A 30mA').residualCurrentmA).toBe(30);
    expect(readDevice('Idn 300mA').residualCurrentmA).toBe(300);
    expect(readDevice('40 A/IΔn 0.03 A').residualCurrentmA).toBe(30);
    expect(readDevice('40 A I Δ n 0,3 A 50/60 Hz').residualCurrentmA).toBe(300);
    expect(readDevice('300A').residualCurrentmA).toBeUndefined();
  });
});

describe('OCR — étiquettes', () => {
  it('garde les mots, écarte le bruit', () => {
    expect(plausibleLabel('  SALLE DE BAIN ')).toBe('SALLE DE BAIN');
    expect(plausibleLabel('Prises plan de travail')).toBe('Prises plan de travail');
    expect(plausibleLabel('| ;; 1 |')).toBeUndefined();
    expect(plausibleLabel('M1200 [3000]')).toBeUndefined();
  });
});

describe('OCR — noms de pièces sur un plan', () => {
  const w = (text: string, x: number, y: number, width = 60): OcrWord => ({ text, bbox: { x0: x, y0: y, x1: x + width, y1: y + 20 } });

  it('vocabulaire FR/NL, mots voisins regroupés, numéro de chambre gardé', () => {
    const r = roomLabels([w('garage', 100, 100), w('chambre', 400, 100), w('3', 470, 100, 12), w('hall', 100, 400, 40), w('de', 150, 400, 20), w('nuit', 180, 400, 40), w('keuken', 600, 300), w('730', 700, 500, 40), w('frigo', 600, 200)]);
    expect(r.map((x) => x.text)).toEqual(['Garage', 'Chambre 3', 'Hall de nuit', 'Keuken']);
    expect(r[1]).toMatchObject({ x: (400 + 482) / 2, y: 110 });
  });

  it('un mot hors vocabulaire ou un numéro après une pièce qui n’en prend pas n’est pas une pièce', () => {
    expect(roomLabels([w('frigo', 0, 0), w('stéréo', 100, 0)])).toEqual([]);
    expect(roomLabels([w('living', 0, 0), w('2', 65, 0, 10)]).map((x) => x.text)).toEqual(['Living']);
  });
});

describe('OCR — correction vers le vocabulaire (comme un vocabulaire imposé au décodage)', () => {
  it('erreurs de lecture vues sur de vraies photos corrigées, mots courts jamais forcés', () => {
    expect(correctWord('baing')).toBe('bains');
    expect(correctWord('cuisi')).toBe('cuisine');
    expect(correctWord('charnbre')).toBe('chambre');
    expect(correctWord('CELLIER')).toBe('cellier');
    expect(correctWord('bare')).toBeUndefined();
    expect(correctWord('bale')).toBeUndefined();
    expect(correctWord('stereo')).toBeUndefined();
  });

  it('« hall-de-nuit » lu d’un bloc est reconnu comme une seule pièce', () => {
    const r = roomLabels([{ text: 'hall-de-nuit', bbox: { x0: 0, y0: 0, x1: 120, y1: 20 } }, { text: 'baing', bbox: { x0: 300, y0: 0, x1: 360, y1: 20 } }]);
    expect(r.map((x) => x.text)).toEqual(['Hall de nuit', 'Bains']);
  });
});

describe('OCR — position sur l’image d’origine après rotation', () => {
  it('quart de tour dans les deux sens, puis réduction', async () => {
    const { toOriginal } = await import('../src/ocr/plan');
    // Image d'origine 100 × 50, agrandie ×2 → 200 × 100 ; tournée de 90° → 100 × 200
    expect(toOriginal({ x: 10, y: 20 }, 0, 200, 100, 2)).toEqual({ x: 5, y: 10 });
    // Point d'origine (5, 10) → agrandi (10, 20) → tourné 90° (100 - 20, 10) = (80, 10)
    expect(toOriginal({ x: 80, y: 10 }, 90, 100, 200, 2)).toEqual({ x: 5, y: 10 });
    // Tourné 270° : (y, w - x) = (20, 200 - 10) = (20, 190)
    expect(toOriginal({ x: 20, y: 190 }, 270, 100, 200, 2)).toEqual({ x: 5, y: 10 });
  });
});
