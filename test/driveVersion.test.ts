import { describe, expect, it } from 'vitest';
import { sameDriveContent } from '../src/io/drive';

// Constaté sur un vrai compte (2026-11-24) : la réponse de création donne version 1, une relecture une minute plus tard
// version 2, avec la même révision de tête. Le comparer en entier provoquait un faux conflit au 2e enregistrement.
describe('Google Drive : même contenu', () => {
  it('version changée, même révision de tête : même contenu (pas de conflit)', () => {
    expect(sameDriveContent('1|0Bx-head', '2|0Bx-head')).toBe(true);
  });
  it('révision de tête différente : modifié ailleurs', () => {
    expect(sameDriveContent('2|0Bx-head', '3|0By-other')).toBe(false);
  });
  it('sans révision mémorisée : comparaison complète, prudente', () => {
    expect(sameDriveContent('2|', '2|')).toBe(true);
    expect(sameDriveContent('2|', '3|')).toBe(false);
    expect(sameDriveContent(undefined, '2|x')).toBe(false);
  });
});
