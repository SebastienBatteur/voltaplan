import { afterEach, describe, expect, it } from 'vitest';
import { MeterAiReading, PlanAiReading, supplyFromAi, type MeterAiReadingT } from '../src/ai/photoAi';
import { mergeRooms } from '../src/ocr/plan';
import { aiFor, DEFAULT_AI, saveAiSettings, setSessionKey } from '../src/ai/settings';

const meter = (r: Partial<MeterAiReadingT>): MeterAiReadingT => ({ phases: null, voltage: null, neutral: null, baseCurrentA: null, maxCurrentA: null, frequencyHz: null, problem: 'none', ...r });

describe('IA après l’OCR — compteur', () => {
  it('alimentation déduite seulement sans ambiguïté', () => {
    expect(supplyFromAi(meter({ phases: 1, voltage: '230' }))).toBe('2 x 230V ~ 50Hz');
    expect(supplyFromAi(meter({ phases: 3, voltage: '220/380' }))).toBe('3N x 400V ~ 50Hz');
    expect(supplyFromAi(meter({ phases: 3, neutral: false }))).toBe('3 x 230V ~ 50Hz');
    expect(supplyFromAi(meter({ phases: 3 }))).toBeUndefined();
    expect(supplyFromAi(meter({}))).toBeUndefined();
  });

  it('schémas de réponse valides', () => {
    expect(MeterAiReading.safeParse(meter({ phases: 3, problem: 'glare' })).success).toBe(true);
    expect(PlanAiReading.safeParse({ rooms: [{ name: 'Cuisine', x: 0.7, y: 0.2 }], symbols: [{ kind: 'socket', count: 2, x: 0.5, y: 0.5, confidence: 'high' }], problem: 'none' }).success).toBe(true);
    expect(PlanAiReading.safeParse({ rooms: [], symbols: [{ kind: 'sofa', count: null, x: 0, y: 0, confidence: 'high' }], problem: 'none' }).success).toBe(false);
  });
});

describe('IA après l’OCR — plan', () => {
  it('pièces de l’IA ajoutées seulement si l’OCR ne les a pas déjà trouvées au même endroit', () => {
    const r = (text: string, x: number) => ({ text, pos: { x, y: 0 } });
    expect(mergeRooms([r('Garage', 0), r('Cuisine', 5000)], [r('garage', 100), r('Chambre 1', 2000), r('Cuisine', 9000)], 650).map((x) => x.text)).toEqual([
      'Garage',
      'Cuisine',
      'Chambre 1',
      'Cuisine',
    ]);
  });
});

describe('IA par usage : état', () => {
  afterEach(() => {
    saveAiSettings(DEFAULT_AI);
    setSessionKey(null);
  });

  it('désactivée ou usage non autorisé → off ; clé verrouillée → locked ; déverrouillée → ready', () => {
    expect(aiFor('meterFromPhoto').state).toBe('off');
    saveAiSettings({ ...DEFAULT_AI, enabled: true, permissions: { ...DEFAULT_AI.permissions, meterFromPhoto: true } });
    expect(aiFor('planFromPhoto').state).toBe('off');
    expect(aiFor('meterFromPhoto').state).toBe('locked');
    setSessionKey('sk-test');
    expect(aiFor('meterFromPhoto')).toMatchObject({ state: 'ready', config: { provider: 'anthropic', apiKey: 'sk-test' } });
  });

  it('modèle local sans clé : prêt sans déverrouillage', () => {
    saveAiSettings({ ...DEFAULT_AI, enabled: true, provider: 'openaiCompatible', baseUrl: 'http://localhost:11434/v1', model: 'llava', permissions: { ...DEFAULT_AI.permissions, planFromPhoto: true } });
    expect(aiFor('planFromPhoto').state).toBe('ready');
  });
});
