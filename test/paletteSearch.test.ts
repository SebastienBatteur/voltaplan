import { describe, expect, it } from 'vitest';
import { kindKeywords, matches, normalize, searchFurniture } from '../src/ui/paletteSearch';

describe('recherche de pictogrammes', () => {
  it('sans accents ni casse', () => {
    expect(normalize('Prise étanche')).toBe('prise etanche');
  });

  it('trouve un élément dans n’importe quelle langue et par ses variantes', () => {
    expect(matches('prise', kindKeywords('socket'))).toBe(true);
    expect(matches('stopcontact', kindKeywords('socket'))).toBe(true);
    expect(matches('Steckdose', kindKeywords('socket'))).toBe(true);
    expect(matches('lave-linge', kindKeywords('appliance'))).toBe(true);
    expect(matches('wasmachine', kindKeywords('appliance'))).toBe(true);
    expect(matches('va-et-vient', kindKeywords('switch'))).toBe(true);
    expect(matches('lave', kindKeywords('appliance'))).toBe(true);
    expect(matches('prise', kindKeywords('light'))).toBe(false);
  });

  it('mobilier : colimaçon, wenteltrap, lit', () => {
    expect([...searchFurniture('colimaçon')]).toEqual(['spiralStairs']);
    expect([...searchFurniture('wenteltrap')]).toEqual(['spiralStairs']);
    expect(searchFurniture('lit').has('bedDouble')).toBe(true);
    expect(searchFurniture('').size).toBeGreaterThan(20);
  });
});
