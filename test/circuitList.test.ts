import { describe, expect, it } from 'vitest';
import { circuitCsv, circuitRows } from '../src/print/circuitList';
import { typicalHouseProject } from '../src/model/templates';
import { computeNumbering } from '../src/model/tree';

const t = (k: string) => k;
const labels = { protection: (n: { props: Record<string, unknown> }) => ['X', `${n.props.ratedCurrent} A`], cable: (n: { props: Record<string, unknown> }) => `${n.props.cableType} ${n.props.section}` };

describe('liste des circuits (PDF et CSV)', () => {
  it('une ligne par circuit de la maison type, avec lettre, points et pièces', () => {
    const p = typicalHouseProject((k) => k.split('.').pop()!);
    const rows = circuitRows(p, computeNumbering(p.roots), labels as never);
    expect(rows.map((r) => r.letter)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    const light = rows[0];
    expect(light).toMatchObject({ name: 'lights', protection: '16 A', rcd: '30 mA type A', cable: 'VOB 1.5', points: 3 });
    expect(light.rooms).toBe('living, kitchen, hall');
    expect(rows[5]).toMatchObject({ name: 'cooker', rcd: '300 mA type A' });
  });

  it('CSV : en-tête, séparateur « ; », guillemets si nécessaire, BOM pour Excel', () => {
    const csv = circuitCsv([{ id: '1', letter: 'A', name: 'Prises; séjour', protection: 'C 20 A', rcd: '30 mA', cable: 'XVB 3G2,5', points: 4, rooms: 'Séjour' }], t);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).trim().split('\r\n');
    expect(lines[0]).toBe('print.col.circuit;print.col.name;print.col.protection;print.col.rcd;print.col.cable;print.col.points;print.col.rooms');
    expect(lines[1]).toBe('A;"Prises; séjour";C 20 A;30 mA;XVB 3G2,5;4;Séjour');
  });
});
