import { analyzeRow } from '../src/board/photo';
import { layoutFromPhotoRows } from '../src/board/model';
import { createNode } from '../src/model/tree';

/** Profil synthétique dont les forces aux positions entières sont celles mesurées. */
function profile(forces: number[]) {
  const prof: number[] = [];
  for (let p = 0; p < forces.length; p++) for (let k = 0; k < 10; k++) prof.push(k === 0 ? forces[p] : 1);
  return prof.slice(0, (forces.length - 1) * 10 + 1);
}
const stats = (s: string) => s.split(' ').map((x) => ({ mean: Number(x.split('/')[0]), sd: Number(x.split('/')[1]) }));

// Mesures sur une vraie photo de tableau (3 rangées de 18 modules, calage rangée par rangée) :
//  rangée 1 : 18 disjoncteurs ABB d'un module (séparations peu marquées) ;
//  rangée 2 : 3 différentiels Legrand 2P, un vide (rail nu), contacteur, horloge, 4 appareils d'un module, transformateur ;
//  rangée 3 : cache de 5 modules, 2 disjoncteurs 2P, différentiel 300 mA 4P, compteur 4 modules.
const REAL = [
  {
    force: [10, 7, 8, 12, 16, 11, 23, 29, 53, 54, 19, 24, 18, 25, 37, 45, 24, 11, 6],
    stats: stats('95/47 95/46 95/47 91/45 94/45 95/46 92/44 93/44 91/45 91/42 91/44 87/40 87/41 86/40 99/56 83/43 75/37 71/36'),
  },
  {
    force: [16, 2, 37, 2, 57, 2, 42, 60, 1, 1, 46, 7, 84, 91, 54, 64, 68, 1, 36],
    stats: stats('129/46 159/29 127/46 163/28 127/48 162/31 51/30 155/30 158/20 156/17 129/36 121/35 100/55 96/52 95/49 94/51 162/23 156/18'),
  },
  {
    force: [20, 1, 1, 1, 1, 25, 26, 2, 64, 2, 49, 2, 1, 1, 84, 6, 3, 2, 14],
    stats: stats('219/3 216/1 215/1 215/1 215/2 199/23 109/58 110/56 105/50 105/49 126/46 158/26 161/15 151/25 153/42 166/44 123/51 115/46'),
  },
];

describe('disposition d’après la photo (sans IA)', () => {
  const rows = REAL.map((r) => analyzeRow(profile(r.force), r.stats, 18));

  it('emplacements vides : cache-module et rail nu', () => {
    expect(rows[2].occupied.slice(0, 5)).toEqual([false, false, false, false, false]); // cache
    expect(rows[1].occupied[6]).toBe(false); // rail nu (sombre)
    expect(rows[0].occupied.every(Boolean)).toBe(true); // 18 disjoncteurs
  });

  it('pose les différentiels à leur place et les disjoncteurs d’un module dans l’ordre', () => {
    const rcd300 = createNode('protection', { device: 'rcd', poles: '4P', residualCurrent: 300 });
    const rcd30 = [1, 2, 3].map(() => createNode('protection', { device: 'rcd', poles: '2P', residualCurrent: 30 }));
    const mcbs = Array.from({ length: 18 }, () => createNode('protection', { device: 'mcb', poles: '1P+N' }));
    const r = layoutFromPhotoRows([rcd300, rcd30[0], ...mcbs.slice(0, 6), rcd30[1], ...mcbs.slice(6), rcd30[2]], rows);
    // Différentiels 2P : les 3 premiers emplacements de 2 modules de la rangée 2
    expect(rcd30.map((d) => r.slots[d.id])).toEqual([
      { row: 1, col: 0 },
      { row: 1, col: 2 },
      { row: 1, col: 4 },
    ]);
    // Différentiel 300 mA 4P : rangée 3, après les deux disjoncteurs 2P
    expect(r.slots[rcd300.id]).toEqual({ row: 2, col: 10 });
    // Disjoncteurs d'un module : toute la rangée 1, dans l'ordre (la suite peu séparée n'est pas prise pour un 4P)
    expect(mcbs.map((d) => r.slots[d.id])).toEqual(mcbs.map((_, i) => ({ row: 0, col: i })));
    expect(r.unplaced).toEqual([]);
    // Appareils de la photo absents du projet : signalés
    expect(r.extra.some((e) => e.row === 2 && e.col <= 6 && e.col + e.width > 6)).toBe(true);
  });

  it('un appareil sans emplacement à sa largeur reste en réserve', () => {
    const big = createNode('protection', { device: 'mcb', poles: '4P' });
    const r = layoutFromPhotoRows([big], [analyzeRow(profile([20, 2, 20]), stats('120/30 120/30'), 2)]);
    expect(r.unplaced).toEqual([big]);
  });
});
