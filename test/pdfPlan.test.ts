import { describe, expect, it } from 'vitest';
import { distToWalls, planFromShapes, scaleFromDoors, shapesFromOperatorList, wallsInPolygon, type PdfShape } from '../src/import/pdfPlan';
import { importPdfDossier, type PdfText } from '../src/import/pdfDossier';
import { noWallZones } from '../src/import/pdfInfo';
import type { Pt } from '../src/model/types';
import { frWarnings } from './warnText';

const P = (x: number, y: number): Pt => ({ x, y });
const BLACK: [number, number, number] = [30, 30, 30];
const WHITE: [number, number, number] = [255, 255, 255];
const line = (a: Pt, b: Pt, lw: number, stroke = BLACK): PdfShape => ({ paths: [[a, b]], curve: [false], closed: [false], fill: null, stroke, lw });
const arc = (pts: Pt[]): PdfShape => ({ paths: [pts], curve: [true], closed: [false], fill: null, stroke: BLACK, lw: 0.5 });
const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)];
/** Pièce de 200 × 100 pt, murs en traits épais (5 pt), porte « effacée » en blanc sur le mur du haut, avec son arc. */
function room(): PdfShape[] {
  return [
    line(P(100, 100), P(300, 100), 5),
    line(P(300, 100), P(300, 200), 5),
    line(P(300, 200), P(100, 200), 5),
    line(P(100, 200), P(100, 100), 5),
    // Porte de 20 pt (x 150 → 170) : trait blanc, battant vers le bas (dans la pièce), charnière en x = 150
    line(P(150, 100), P(170, 100), 5.5, WHITE),
    arc([P(150, 120), P(161, 119), P(168, 112), P(170, 100)]),
    // Fenêtre de 40 pt sur le mur de droite
    line(P(300, 130), P(300, 170), 5.5, WHITE),
    // Traits fins (cotes, symboles) : ignorés
    line(P(110, 150), P(140, 150), 0.3),
  ];
}

describe('plan lu dans le dessin du PDF', () => {
  it('murs, porte (côté et charnière) et fenêtre à partir de traits', () => {
    const { walls, openings } = planFromShapes(room());
    expect(walls).toHaveLength(4);
    expect(walls.every((w) => w.thickness === 5)).toBe(true);
    const door = openings.find((o) => o.kind === 'door')!;
    expect(door).toBeTruthy();
    // a = (150,100) → b = (170,100) : le battant est vers +y (dans la pièce) ; poignée en b, donc charnière en a
    expect(door.plusY).toBe(true);
    expect(door.hingeAtB).toBe(false);
    expect(openings.filter((o) => o.kind === 'window')).toHaveLength(1);
  });

  it('murs dans une surface remplie (rectangle ou contour d’un ensemble de murs)', () => {
    const w = wallsInPolygon(box(0, 0, 100, 5), 1.5, 16, 8);
    expect(w).toHaveLength(1);
    expect(w[0].thickness).toBeCloseTo(5);
    expect(w[0].a.y).toBeCloseTo(2.5);
    // Contour en L : deux murs
    const L = [P(0, 0), P(100, 0), P(100, 5), P(5, 5), P(5, 80), P(0, 80)];
    expect(wallsInPolygon(L, 1.5, 16, 8)).toHaveLength(2);
    // Pièce remplie (grande) : pas un mur
    expect(wallsInPolygon(box(0, 0, 100, 80), 1.5, 16, 8)).toHaveLength(0);
  });

  it('murs interrompus (Condui) : ouverture dans le trou, porte si un arc la touche ; angles raccordés', () => {
    const fill = (pts: Pt[]): PdfShape => ({ paths: [pts], curve: [false], closed: [true], fill: [209, 213, 219], stroke: null, lw: 0 });
    const shapes = [
      fill(box(100, 98, 150, 103)),
      fill(box(170, 98, 300, 103)),
      fill(box(298, 103, 303, 200)),
      // Arc aller-retour (comme Condui) de la poignée (170,100) au bout du battant (150,80)
      arc([P(150, 80), P(160, 82), P(168, 90), P(170, 100), P(168, 90), P(160, 82), P(150, 80)]),
    ];
    const { walls, openings } = planFromShapes(shapes);
    expect(walls).toHaveLength(3);
    expect(openings).toHaveLength(1);
    expect(openings[0]).toMatchObject({ kind: 'door', plusY: false });
    // Angle : le mur vertical est prolongé jusqu'à l'axe du mur du haut
    const v = walls.find((w) => Math.abs(w.a.x - w.b.x) < 1)!;
    expect(Math.min(v.a.y, v.b.y)).toBeCloseTo(100.5, 0);
  });

  it('échelle estimée par les portes (85 cm) ; distance aux murs', () => {
    const { openings, walls } = planFromShapes(room());
    expect(scaleFromDoors(openings)).toBeNull(); // une seule porte : pas d'estimation
    const two = [...openings, { ...openings.find((o) => o.kind === 'door')! }];
    expect(scaleFromDoors(two)).toBeCloseTo(850 / 20, 5);
    expect(distToWalls(P(200, 150), walls)).toBeCloseTo(50);
    expect(distToWalls(P(200, 102), walls)).toBeCloseTo(2);
  });

  it('lit les opérations pdf.js : transformations, couleurs, rectangles, courbes', () => {
    const OPS = { save: 1, restore: 2, transform: 3, setFillRGBColor: 4, setStrokeRGBColor: 5, setLineWidth: 6, constructPath: 7, stroke: 8, fill: 9, moveTo: 10, lineTo: 11, curveTo: 12, rectangle: 13, closePath: 14, endPath: 15 };
    const view = [1, 0, 0, -1, 0, 842]; // origine en haut à gauche
    const shapes = shapesFromOperatorList(
      [OPS.save, OPS.setLineWidth, OPS.setStrokeRGBColor, OPS.transform, OPS.constructPath, OPS.stroke, OPS.restore, OPS.setFillRGBColor, OPS.constructPath, OPS.fill],
      [[], [2], ['#ff0000'], [2, 0, 0, 2, 0, 0], [[OPS.moveTo, OPS.lineTo, OPS.curveTo], [10, 10, 20, 10, 25, 15, 30, 20, 35, 25]], [], [], [0, 0, 255], [[OPS.rectangle], [0, 0, 10, 5]], []],
      OPS,
      view,
    );
    expect(shapes).toHaveLength(2);
    expect(shapes[0]).toMatchObject({ stroke: [255, 0, 0], fill: null, lw: 4, curve: [true] });
    expect(shapes[0].paths[0][0]).toEqual({ x: 20, y: 822 });
    expect(shapes[1]).toMatchObject({ fill: [0, 0, 255], stroke: null, closed: [true] });
    expect(shapes[1].paths[0]).toHaveLength(4);
  });

  it('import : murs et ouvertures en mm sur la page de plan, lampe posée au repère loin des murs', () => {
    const t = (page: number, x: number, y: number, str: string): PdfText => ({ page, x, y, str, size: 6 });
    const items: PdfText[] = [
      t(1, 50, 90, 'Circuit'),
      t(1, 100, 90, 'Description'),
      t(1, 300, 90, 'Protection'),
      t(1, 50, 108, 'A'),
      t(1, 100, 108, 'Éclairage'),
      t(1, 300, 108, 'C16'),
      t(2, 400, 440, 'Plan · Rez'),
      t(2, 60, 560, 'échelle 1:50'),
      // Même repère A1 pour l'interrupteur (contre le mur) et la lampe (au milieu de la pièce)
      t(2, 155, 106, 'A1'),
      t(2, 200, 150, 'A1'),
    ];
    const pages = [
      { width: 595, height: 842 },
      { width: 842, height: 595 },
    ];
    const { project, warnings } = importPdfDossier(items, pages, 'p.pdf', [[], room()]);
    const pg = project.plan.pages[0];
    const k = (25.4 / 72) * 50;
    expect(pg.walls).toHaveLength(4);
    expect(pg.walls[0].thickness).toBe(Math.round(5 * k));
    expect(pg.openings.find((o) => o.kind === 'door')).toMatchObject({ hinge: 'right', mirrored: false });
    expect(pg.images[0]).toMatchObject({ background: true, linked: true });
    // La lampe prend le repère du milieu de la pièce
    expect(pg.symbols).toHaveLength(1);
    expect(pg.symbols[0].pos.y).toBeGreaterThan(140 * k);
    expect(frWarnings(warnings).some((w) => /mur\(s\) et .* lus dans le dessin/.test(w))).toBe(true);
  });

  it('import : noms de pièces lus sur le plan, pièce de chaque point posé', () => {
    const t = (page: number, x: number, y: number, str: string, size = 6): PdfText => ({ page, x, y, str, size });
    const items: PdfText[] = [
      t(1, 50, 90, 'Circuit'),
      t(1, 100, 90, 'Description'),
      t(1, 300, 90, 'Protection'),
      t(1, 50, 108, 'A'),
      t(1, 100, 108, 'Prises'),
      t(1, 300, 108, 'C20'),
      t(2, 400, 440, 'Plan · Rez'),
      t(2, 60, 560, 'échelle 1:50'),
      t(2, 180, 150, 'Keuken', 9),
      // Hors des murs (cartouche) : pas une pièce
      t(2, 600, 500, 'Salon', 9),
      t(2, 120, 106, 'A1'),
    ];
    const pages = [
      { width: 595, height: 842 },
      { width: 842, height: 595 },
    ];
    const { project } = importPdfDossier(items, pages, 'p.pdf', [[], room()]);
    const pg = project.plan.pages[0];
    expect(pg.labels.map((l) => l.text)).toEqual(['Keuken']);
    const node = project.roots[0].children[0].children[0].children[0].children.find((n) => n.props.fixedLetter === 'A')!.children[0].children[0];
    expect(node.location).toBe('Keuken');
  });

  it('import : face avant du tableau (rangées et colonnes en modules) ; différentiel laissé à placer', () => {
    const t = (page: number, x: number, y: number, str: string): PdfText => ({ page, x, y, str, size: 7 });
    const items: PdfText[] = [
      t(1, 50, 90, 'Circuit'),
      t(1, 100, 90, 'Description'),
      t(1, 300, 90, 'Protection'),
      ...['A', 'B', 'C', 'D'].map((c, i) => [t(1, 50, 108 + 18 * i, c), t(1, 100, 108 + 18 * i, 'Prises'), t(1, 300, 108 + 18 * i, 'C20 2P')]).flat(),
      t(2, 40, 40, 'Tableau'),
      t(2, 40, 230, 'FACE AVANT'),
      // Rangée 1 : différentiel (sans repère de circuit), A, B ; rangée 2 : C, D
      t(2, 80, 281, 'D1'),
      t(2, 158, 281, 'A'),
      t(2, 160, 288, 'C20'),
      t(2, 236, 281, 'B'),
      t(2, 237, 288, 'C20'),
      t(2, 83, 318, 'C'),
      t(2, 83, 325, 'C20'),
      t(2, 158, 318, 'D'),
      t(2, 160, 325, 'C20'),
    ];
    const { project, warnings } = importPdfDossier(items, [{ width: 595, height: 842 }, { width: 595, height: 842 }], 'p.pdf');
    const board = project.roots[0].children[0].children[0].children[0];
    const slots = project.boards![board.id].slots;
    const at = (c: string) => slots[board.children.find((n) => n.props.fixedLetter === c)!.id];
    // 2P = 2 modules ; une case de 78 pt = 2 modules : A en colonne 2 (le différentiel garde les colonnes 0-1)
    expect(at('A')).toEqual({ row: 0, col: 2 });
    expect(at('B')).toEqual({ row: 0, col: 4 });
    expect(at('C')).toEqual({ row: 1, col: 0 });
    expect(at('D')).toEqual({ row: 1, col: 2 });
    expect(frWarnings(warnings).some((w) => /Face avant du tableau lue/.test(w))).toBe(true);
  });

  it('cartouche et légende repérés d’abord : un trait épais dedans n’est pas un mur', () => {
    const t = (page: number, x: number, y: number, str: string, size = 6): PdfText => ({ page, x, y, str, size });
    const items: PdfText[] = [
      t(1, 50, 90, 'Circuit'),
      t(1, 100, 90, 'Description'),
      t(1, 300, 90, 'Protection'),
      t(1, 50, 108, 'A'),
      t(1, 100, 108, 'Prises'),
      t(1, 300, 108, 'C20'),
      t(2, 430, 440, 'PLAN DE POSITION – Rez'),
      t(2, 430, 460, 'Adresse de l’installation'),
      t(2, 520, 460, 'Rue 1, 1000 Bruxelles'),
      t(2, 430, 480, 'Organisme agréé'),
      t(2, 30, 440, 'Légende', 8),
    ];
    const pages = [
      { width: 595, height: 842 },
      { width: 842, height: 595 },
    ];
    const zones = noWallZones(items, 2, pages[1]);
    expect(zones).toHaveLength(2);
    expect(zones[0].y0).toBeLessThan(440);
    expect(zones[0].y1).toBe(595);
    expect(zones[1].x1).toBeLessThan(zones[0].x0);
    // Barre d'échelle (trait noir épais) dans la légende et cadre épais dans le cartouche : ignorés
    const shapes = [...room(), line(P(40, 560), P(90, 560), 5), line(P(440, 520), P(800, 520), 5)];
    const { project } = importPdfDossier(items, pages, 'p.pdf', [[], shapes]);
    expect(project.plan.pages[0].walls).toHaveLength(4);
  });
});
