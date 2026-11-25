import { describe, expect, it } from 'vitest';
import { DXF_MAX_POINTS, DxfError, drawingBounds, isDxf, readDxf } from '../src/io/dxf';
import { importKind } from '../src/io/limits';

/** Petit DXF texte : paires code / valeur, une par ligne. */
const dxf = (header: string[], entities: string[], blocks: string[] = []) =>
  [
    '0', 'SECTION', '2', 'HEADER', ...header, '0', 'ENDSEC',
    ...(blocks.length ? ['0', 'SECTION', '2', 'BLOCKS', ...blocks, '0', 'ENDSEC'] : []),
    '0', 'SECTION', '2', 'ENTITIES', ...entities, '0', 'ENDSEC', '0', 'EOF',
  ].join('\r\n');

const line = (x1: number, y1: number, x2: number, y2: number) => ['0', 'LINE', '8', '0', '10', String(x1), '20', String(y1), '11', String(x2), '21', String(y2)];

describe('lecture DXF', () => {
  it('lit les lignes et l’unité du fichier', () => {
    const d = readDxf(dxf(['9', '$INSUNITS', '70', '6'], [...line(0, 0, 8, 0), ...line(8, 0, 8, 5)]));
    expect(d.mmPerUnit).toBe(1000);
    expect(d.paths).toEqual([[[0, 0], [8, 0]], [[8, 0], [8, 5]]]);
  });

  it('unité inconnue → mise à l’échelle à la main', () => {
    expect(readDxf(dxf([], line(0, 0, 1, 1))).mmPerUnit).toBeNull();
    expect(readDxf(dxf(['9', '$INSUNITS', '70', '0'], line(0, 0, 1, 1))).mmPerUnit).toBeNull();
    expect(readDxf(dxf(['9', '$INSUNITS', '70', '5'], line(0, 0, 1, 1))).mmPerUnit).toBe(10);
  });

  it('polyligne fermée et cercle', () => {
    const d = readDxf(
      dxf([], ['0', 'LWPOLYLINE', '90', '3', '70', '1', '10', '0', '20', '0', '10', '4', '20', '0', '10', '4', '20', '3', '0', 'CIRCLE', '10', '10', '20', '10', '40', '2']),
    );
    expect(d.paths[0]).toEqual([[0, 0], [4, 0], [4, 3], [0, 0]]);
    const circle = d.paths[1];
    for (const [x, y] of circle) expect(Math.hypot(x - 10, y - 10)).toBeCloseTo(2, 6);
  });

  it('arc de polyligne (renflement) : demi-cercle', () => {
    // bulge = 1 → demi-cercle de (0,0) à (2,0), sens trigonométrique : passe par (1,-1)
    const d = readDxf(dxf([], ['0', 'LWPOLYLINE', '90', '2', '70', '0', '10', '0', '20', '0', '42', '1', '10', '2', '20', '0']));
    const pts = d.paths[0];
    for (const [x, y] of pts) expect(Math.hypot(x - 1, y)).toBeCloseTo(1, 6);
    expect(Math.min(...pts.map((p) => p[1]))).toBeCloseTo(-1, 2);
    expect(pts[pts.length - 1]).toEqual([2, 0]);
  });

  it('ancienne polyligne (POLYLINE / VERTEX / SEQEND)', () => {
    const d = readDxf(
      dxf([], ['0', 'POLYLINE', '66', '1', '70', '0', '0', 'VERTEX', '10', '0', '20', '0', '0', 'VERTEX', '10', '5', '20', '0', '0', 'SEQEND', ...line(0, 1, 0, 2)]),
    );
    expect(d.paths).toEqual([[[0, 0], [5, 0]], [[0, 1], [0, 2]]]);
  });

  it('blocs insérés : position, échelle, rotation', () => {
    const blocks = ['0', 'BLOCK', '2', 'PORTE', '10', '0', '20', '0', ...line(0, 0, 1, 0), '0', 'ENDBLK'];
    const d = readDxf(dxf([], ['0', 'INSERT', '2', 'PORTE', '10', '10', '20', '5', '41', '2', '42', '2', '50', '90'], blocks));
    expect(d.paths).toHaveLength(1);
    const [[ax, ay], [bx, by]] = d.paths[0];
    expect([ax, ay]).toEqual([10, 5]);
    expect(bx).toBeCloseTo(10, 9);
    expect(by).toBeCloseTo(7, 9);
  });

  it('bloc qui s’insère lui-même : pas de boucle infinie', () => {
    const blocks = ['0', 'BLOCK', '2', 'A', ...line(0, 0, 1, 0), '0', 'INSERT', '2', 'A', '10', '1', '20', '0', '0', 'ENDBLK'];
    const d = readDxf(dxf([], ['0', 'INSERT', '2', 'A', '10', '0', '20', '0'], blocks));
    expect(d.paths.length).toBeGreaterThan(1);
    expect(d.paths.length).toBeLessThan(20);
  });

  it('refus clairs : binaire, vide, trop gros', () => {
    expect(() => readDxf('AutoCAD Binary DXF\r\n\u001a\u0000')).toThrow(DxfError);
    try {
      readDxf(dxf([], ['0', 'TEXT', '1', 'Salon']));
    } catch (e) {
      expect((e as DxfError).code).toBe('empty');
    }
    const many: string[] = [];
    const n = Math.ceil(DXF_MAX_POINTS / 2) + 1;
    for (let i = 0; i < n; i++) many.push('0', 'LINE', '10', '0', '20', '0', '11', '1', '21', '1');
    try {
      readDxf(dxf([], many));
      throw new Error('attendu : trop gros');
    } catch (e) {
      expect((e as DxfError).code).toBe('tooBig');
    }
  });

  it('le cadre ignore un trait égaré très loin', () => {
    const paths: [number, number][][] = [];
    for (let i = 0; i < 1000; i++) paths.push([[i % 10, 0], [i % 10, 5]]);
    paths.push([[1e7, 1e7], [1e7 + 1, 1e7]]);
    const b = drawingBounds(paths);
    expect(b.maxX).toBeLessThan(100);
    expect(b.maxY).toBeLessThan(100);
  });

  it('fichier reconnu à son extension', () => {
    expect(isDxf({ name: 'Plan RDC.DXF' })).toBe(true);
    expect(isDxf({ name: 'plan.pdf' })).toBe(false);
    expect(importKind({ name: 'plan.dxf' })).toBe('dxf');
  });
});
