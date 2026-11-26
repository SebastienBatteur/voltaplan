import { describe, expect, it } from 'vitest';
import { plausibleLabel, readDevice, readMeterPlate, roomLabels, type OcrWord } from '../src/ocr/parse';

describe('OCR — plaque de compteur', () => {
  it('ancien compteur triphasé : 220/380 V, 3x10(40) A → 3N x 400V proposé', () => {
    const m = readMeterPlate('AEG\nT2C14G11 NO 40 005\n220/380 V Y 3x10(40) A 50 Hz\n150 tr/kWh');
    expect(m).toMatchObject({ phases: 3, voltage: '220/380', baseA: 10, maxA: 40, frequencyHz: 50, supply: '3N x 400V ~ 50Hz' });
    expect(m.evidence).toContain('220/380 V');
  });

  it('compteur numérique monophasé : 230V, 0,25-5 (60)A → deux alimentations possibles, aucune choisie', () => {
    const m = readMeterPlate('230V ~ 50Hz\n0,25 - 5 (60)A\n-25°C / +55°C\nIP51');
    expect(m).toMatchObject({ phases: 1, voltage: '230', baseA: 5, maxA: 60 });
    expect(m.supply).toBeUndefined();
    expect(m.supplyOptions).toEqual(['2 x 230V ~ 50Hz', '1N x 230V ~ 50Hz']);
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
    expect(r.map((x) => x.text)).toEqual(['garage', 'chambre 3', 'hall de nuit', 'keuken']);
    expect(r[1]).toMatchObject({ x: (400 + 482) / 2, y: 110 });
  });

  it('un mot hors vocabulaire ou un numéro après une pièce qui n’en prend pas n’est pas une pièce', () => {
    expect(roomLabels([w('frigo', 0, 0), w('stéréo', 100, 0)])).toEqual([]);
    expect(roomLabels([w('living', 0, 0), w('2', 65, 0, 10)]).map((x) => x.text)).toEqual(['living']);
  });
});
