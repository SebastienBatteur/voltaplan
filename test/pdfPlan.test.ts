import { describe, expect, it } from 'vitest';
import { distToWalls, planFromShapes, scaleFromDoors, shapesFromOperatorList, wallsInPolygon, type PdfShape } from '../src/import/pdfPlan';
import { importPdfDossier, type PdfText } from '../src/import/pdfDossier';
import type { Pt } from '../src/model/types';

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
    expect(warnings.some((w) => /mur\(s\) et .* lus dans le dessin/.test(w))).toBe(true);
  });
});
