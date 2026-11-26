import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { countPoints, detectSupply, importPdfDossier, parseCable, parseProtection, readCircuitTables, residualMa, type PdfText } from '../src/import/pdfDossier';
import { interpretLabel } from '../src/assist/labels';
import { ALLOWED_CHILDREN } from '../src/model/schema';
import { computeNumbering, walk } from '../src/model/tree';

const A4 = [{ width: 595, height: 842 }];
/** Tableau fabriqué : une ligne d'en-têtes puis des lignes, colonnes aux abscisses données. */
function table(headers: string[], rows: string[][], xs = [50, 100, 300, 420, 520], page = 1, y0 = 90): PdfText[] {
  const out: PdfText[] = headers.map((h, i) => ({ page, x: xs[i], y: y0, str: h, size: 8 }));
  rows.forEach((r, j) => r.forEach((c, i) => c && out.push({ page, x: xs[i], y: y0 + 18 * (j + 1), str: c, size: 9 })));
  return out;
}
const kinds = (p: ReturnType<typeof importPdfDossier>['project']) => [...walk(p.roots)].map((x) => x.node);

describe('reprise d’un dossier PDF (texte)', () => {
  it('lit protections, câbles et différentiels écrits de plusieurs façons', () => {
    expect(parseProtection('C20A · 2P · 3000 A')).toMatchObject({ curve: 'C', ratedCurrent: 20, poles: '2P', breakingCapacity: 3 });
    expect(parseProtection('2P - B16A')).toMatchObject({ curve: 'B', ratedCurrent: 16, poles: '2P' });
    expect(parseProtection('B32 2P 30mA A')).toMatchObject({ ratedCurrent: 32, residualCurrent: 30, rcdType: 'A' });
    expect(parseProtection('16A')).toEqual({ ratedCurrent: 16 });
    expect(parseCable('XV(B) Cca 3G1,5mm²')).toMatchObject({ cableType: 'XVB', conductors: 3, section: 1.5, reference: 'CPR Cca' });
    expect(parseCable('XVB Cca 3G2,5² · encastré dans la paroi')).toMatchObject({ section: 2.5, method: 'inWall' });
    expect(parseCable('2,5mm²')).toEqual({ section: 2.5 });
    expect(residualMa('30 mA')).toBe(30);
    expect(residualMa('40/0,03A')).toBe(30);
    expect(residualMa('-')).toBeUndefined();
    expect(detectSupply('Réseau 3x400V+N')).toBe('3N x 400V ~ 50Hz');
    expect(detectSupply('Monophasé 230 V')).toBe('2 x 230V ~ 50Hz');
  });

  it('compte les points par leurs repères sans prendre un calibre pour un repère', () => {
    const items = ['C1', 'C16', 'C20', 'A1', 'A2', 'A3', 'A5'].map((str) => ({ page: 2, x: 0, y: 0, str, size: 6 }));
    expect(countPoints(items, 'A')).toBe(3);
    expect(countPoints(items, 'C')).toBe(1);
    expect(countPoints(items, 'B')).toBe(0);
  });

  it('en-têtes en français, néerlandais, anglais et allemand', () => {
    const rows = [
      ['A', 'Éclairage salon', 'C16A · 2P', 'XVB Cca 3G1,5'],
      ['B', 'Prises cuisine', 'C20A · 2P', 'XVB Cca 3G2,5'],
    ];
    for (const h of [
      ['REPÈRE', 'DÉSIGNATION', 'PROTECTION', 'CÂBLE'],
      ['AANDUIDING', 'BENAMING', 'BEVEILIGING', 'KABEL'],
      ['Letter', 'Naam', 'Automaat', 'Kabel'],
      ['Ref', 'Name', 'Breaker', 'Cable'],
      ['Stromkreis', 'Bezeichnung', 'Absicherung', 'Leitung'],
    ]) {
      const c = readCircuitTables(table(h, rows), A4);
      expect(c.map((x) => [x.code, x.name, x.protection]), h.join(' ')).toEqual([
        ['A', 'Éclairage salon', 'C16A · 2P'],
        ['B', 'Prises cuisine', 'C20A · 2P'],
      ]);
    }
  });

  it('noms de circuits en allemand reconnus', () => {
    expect(interpretLabel('Steckdosen Küche').usage?.kind).toBe('socket');
    expect(interpretLabel('Steckdosen Küche').room).toBe('Cuisine');
    expect(interpretLabel('Beleuchtung Wohnzimmer').usage?.kind).toBe('light');
    expect(interpretLabel('Waschmaschine')).toMatchObject({ usage: { applianceType: 'washingMachine' } });
    expect(interpretLabel('Geschirrspüler')).toMatchObject({ usage: { applianceType: 'dishwasher' } });
  });

  it('projet : circuits, points déduits du nom, différentiel de groupe, sous-tableau, cellules sur plusieurs lignes', () => {
    const xs = [46, 81, 173, 232, 316, 442];
    const items = table(
      ['Circuit', 'Description', 'Protection', 'Câble', 'Différentiel', 'Points'],
      [
        ['A', 'Prises séjour,', 'C20 · 2P ·', 'XVB Cca 3G2,5²', '30 mA', '3'],
        ['', 'chambre 1', '3000 A', '', '', ''],
        ['B', 'Éclairage 1', 'C16 · 2P', 'XVB Cca 3G1,5²', '30 mA', '2'],
        ['C', 'Lave-linge', 'C20 · 2P', 'XVB Cca 3G2,5²', '30 mA', '1'],
        ['D', 'Taque de cuisson', 'C32 · 2P', 'XVB Cca 3G6²', '300 mA', '1'],
        ['E', 'Garage', 'C20 · 2P', 'XVB Cca 3G4²', '-', ''],
        ['F', 'Circuit vide', 'C16 · 2P', '', '-', ''],
      ],
      xs,
    );
    // Sous-tableau « Garage » (titre dans la première colonne), alimenté par E
    items.push({ page: 1, x: 46, y: 250, str: 'Tableau de distribution: Garage', size: 10 });
    items.push({ page: 1, x: 46, y: 268, str: 'E-A', size: 9 }, { page: 1, x: 81, y: 268, str: 'Prises garage', size: 9 }, { page: 1, x: 173, y: 268, str: 'C20 · 2P', size: 9 });
    // Pied de page (cartouche) : ignoré
    items.push({ page: 1, x: 46, y: 820, str: 'Z', size: 6 });
    // Repères des points sur le plan
    for (const s of ['E-A1', 'E-A2']) items.push({ page: 2, x: 10, y: 10, str: s, size: 6 });
    items.push({ page: 2, x: 0, y: 0, str: 'EAN 541448820001234567 · 3x400V+N', size: 6 });
    const { project, warnings, circuits } = importPdfDossier(items, [...A4, ...A4], 'Essai.pdf');
    expect(circuits).toBe(7);
    expect(project.meta).toMatchObject({ title: 'Essai', supply: '3N x 400V ~ 50Hz', ean: '541448820001234567' });
    const nodes = kinds(project);
    const a = nodes.find((n) => n.props.fixedLetter === 'A')!;
    expect(a.props).toMatchObject({ device: 'mcb', ratedCurrent: 20, curve: 'C', poles: '2P', breakingCapacity: 3, circuitName: 'Prises séjour, chambre 1' });
    expect(a.children[0].props).toMatchObject({ cableType: 'XVB', section: 2.5 });
    expect(a.children[0].children.map((n) => n.kind)).toEqual(['socket', 'socket', 'socket']);
    // A, B, C sous un même 30 mA ; D (300 mA = le général) directement dans le tableau
    const rcd = nodes.find((n) => n.props.device === 'rcd' && n.props.residualCurrent === 30)!;
    expect(rcd.children.map((n) => n.props.fixedLetter)).toEqual(['A', 'B', 'C']);
    expect(nodes.find((n) => n.props.fixedLetter === 'B')!.children[0].children.map((n) => n.kind)).toEqual(['light', 'light']);
    expect(nodes.find((n) => n.props.fixedLetter === 'C')!.children[0].children[0].props.applianceType).toBe('washingMachine');
    expect(nodes.find((n) => n.props.fixedLetter === 'D')!.children[0].children[0].props.applianceType).toBe('hob');
    // Sous-tableau sous le câble de E ; ses points comptés sur le plan
    const sub = nodes.find((n) => n.kind === 'board' && n.props.name === 'Garage')!;
    expect(nodes.find((n) => n.props.fixedLetter === 'E')!.children[0].children[0]).toBe(sub);
    expect(sub.children[0].children[0].children).toHaveLength(2);
    expect(nodes.some((n) => n.props.fixedLetter === 'Z')).toBe(false);
    // Circuit vide : aucun point ; numérotation des points comme dans le PDF
    expect(nodes.find((n) => n.props.fixedLetter === 'F')!.children[0].children).toHaveLength(0);
    const num = computeNumbering(project.roots);
    expect(num.get(sub.children[0].children[0].children[1].id)).toBe('E-A2');
    expect(warnings.some((w) => /à compléter/.test(w))).toBe(true);
    for (const { node, parent } of walk(project.roots)) if (parent) expect(ALLOWED_CHILDREN[parent.kind], `${node.kind} sous ${parent.kind}`).toContain(node.kind);
  });

  it('s’arrête au tableau suivant (liste des câbles) et refuse un PDF sans tableau ou sans texte', () => {
    const items = table(['Circuit', 'Description', 'Protection', 'Câble'], [['A', 'Prises', 'C20', 'XVB 3G2,5']]);
    items.push({ page: 1, x: 50, y: 200, str: 'Liste des câbles', size: 12 });
    items.push(...table(['Circuit', 'Câble', 'Longueur'], [['A', 'XVB 3G2,5', '12 m']], [50, 100, 300], 1, 220));
    expect(readCircuitTables(items, A4)).toHaveLength(1);
    expect(() => importPdfDossier([], A4)).toThrow(/pas de texte/);
    expect(() => importPdfDossier([{ page: 1, x: 0, y: 0, str: 'Bonjour', size: 9 }], A4)).toThrow(/tableau des circuits/);
  });

  // Texte extrait de vrais dossiers PDF (jamais dans le dépôt) : PDF_TEXT_SAMPLES=chemin1;chemin2 (format « x,y r= s= | texte »)
  const samples = (process.env.PDF_TEXT_SAMPLES ?? '').split(';').filter((p) => p && existsSync(p));
  it.skipIf(!samples.length)('dossiers réels : un tableau des circuits lu', () => {
    for (const f of samples) {
      const items: PdfText[] = [];
      const pages: { width: number; height: number }[] = [];
      let page = 0;
      for (const l of readFileSync(f, 'utf-8').split('\n')) {
        const m = /^=== PAGE (\d+) (\d+)x(\d+)/.exec(l);
        if (m) {
          page = +m[1];
          pages.push({ width: +m[2], height: +m[3] });
          continue;
        }
        const t = /^(-?\d+),(-?\d+) r=(-?\d+) s=(\d+) \| (.*)$/.exec(l);
        if (t && t[3] === '0') items.push({ page, x: +t[1], y: +t[2], size: +t[4], str: t[5] });
      }
      if (!items.length) continue;
      expect(importPdfDossier(items, pages, f).circuits, f).toBeGreaterThan(5);
    }
  });
});
