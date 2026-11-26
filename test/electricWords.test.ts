import { describe, expect, it } from 'vitest';
import { electricScore, looksElectric } from '../src/import/electricWords';

describe('mots d’un document d’installation électrique', () => {
  it('reconnaît un dossier dans les quatre langues, sans tenir compte des accents ni de la casse', () => {
    expect(looksElectric('Schéma UNIFILAIRE — Tableau principal — Disjoncteur différentiel 30 mA')).toBe(true);
    expect(looksElectric('Eendraadschema · Situatieplan · Aardlekschakelaar 300 mA · kring A')).toBe(true);
    expect(looksElectric('Single-line diagram, circuit breaker, residual current device')).toBe(true);
    expect(looksElectric('Einliniendiagramm, Lageplan, Verteileraufbau')).toBe(true);
  });
  it('un document sans rapport n’atteint pas le seuil', () => {
    expect(looksElectric('Relevé de revenus 2024 : réservations, frais de service, versements.')).toBe(false);
    expect(electricScore('')).toBe(0);
  });
});
