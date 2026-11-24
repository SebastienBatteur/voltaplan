import { describe, expect, it } from 'vitest';
import { orientSymbols, wallFacing } from '../src/plan/geometry';
import { emptyPage } from '../src/model/tree';

describe('éléments posés au mur : trait orienté vers le mur le plus proche', () => {
  // Pièce de 4 m × 3 m
  const page = {
    ...emptyPage('RDC'),
    walls: [
      { a: { x: 0, y: 0 }, b: { x: 4000, y: 0 }, thickness: 200 },
      { a: { x: 4000, y: 0 }, b: { x: 4000, y: 3000 }, thickness: 200 },
      { a: { x: 4000, y: 3000 }, b: { x: 0, y: 3000 }, thickness: 200 },
      { a: { x: 0, y: 3000 }, b: { x: 0, y: 0 }, thickness: 200 },
    ],
  };
  it('le côté gauche du symbole (son trait) regarde le mur', () => {
    expect(wallFacing(page, { x: 300, y: 1500 })).toBe(0); // mur de gauche : pas de rotation
    expect(wallFacing(page, { x: 3700, y: 1500 })).toBe(180); // mur de droite
    expect(wallFacing(page, { x: 2000, y: 250 })).toBe(90); // mur du haut (y vers le bas)
    expect(wallFacing(page, { x: 2000, y: 2750 })).toBe(270); // mur du bas
    expect(wallFacing(page, { x: 2000, y: 1500 }, 1000)).toBeNull(); // milieu de la pièce : trop loin
  });
  it('seuls les symboles en orientation automatique sont tournés', () => {
    const p = orientSymbols({
      ...page,
      symbols: [
        { nodeId: 'a', pos: { x: 3700, y: 1500 }, rotation: 0, autoRotate: true },
        { nodeId: 'b', pos: { x: 3700, y: 1500 }, rotation: 0 },
      ],
    });
    expect(p.symbols.map((s) => s.rotation)).toEqual([180, 0]);
  });
});
