import { readFileSync, existsSync } from 'node:fs';
import { importTrikker } from '../src/import/trikker';
import { billOfMaterials, bomCsv } from '../src/bom/bom';
import { chainIds, computeNumbering, createNode, walk } from '../src/model/tree';
import { countryOptionFindings, getRulePack } from '../src/rules';
import { layoutUnifilar } from '../src/unifilar/layout';
import { translate } from '../src/i18n';
import type { ElNode } from '../src/model/types';

const t = (k: string, p?: Record<string, string | number>) => translate('fr', k, p);

function tree() {
  const mcb1 = createNode('protection', { device: 'mcb', ratedCurrent: 20, curve: 'C', poles: '2P', breakingCapacity: 6 });
  const mcb2 = createNode('protection', { device: 'mcb', ratedCurrent: 20, curve: 'C', poles: '2P', breakingCapacity: 6 });
  const c1 = createNode('cable', { cableType: 'VOB', section: 2.5, conductors: 3, length: 12 });
  const c2 = createNode('cable', { cableType: 'VOB', section: 2.5, conductors: 3 });
  const s1 = createNode('socket', { count: 2, earth: true });
  const s2 = createNode('socket', { count: 1, earth: true });
  c1.children = [s1];
  c2.children = [s2];
  mcb1.children = [c1];
  mcb2.children = [c2];
  const board = createNode('board', { rows: 2, modulesPerRow: 13 });
  board.children = [mcb1, mcb2];
  const origin = createNode('origin');
  origin.children = [board];
  return { roots: [origin] as ElNode[], origin, board, mcb1, mcb2, c1, s1, s2 };
}

describe('chaîne de l’élément sélectionné', () => {
  it('amont jusqu’à l’origine et tout l’aval, sans les branches voisines', () => {
    const x = tree();
    const ch = chainIds(x.roots, x.mcb1.id);
    expect(ch.has(x.origin.id) && ch.has(x.board.id) && ch.has(x.mcb1.id) && ch.has(x.c1.id) && ch.has(x.s1.id)).toBe(true);
    expect(ch.has(x.mcb2.id) || ch.has(x.s2.id)).toBe(false);
    expect(chainIds(x.roots, null).size).toBe(0);
  });

  it('chaque fil de l’unifilaire connaît l’élément qu’il alimente', () => {
    const x = tree();
    const L = { ref: () => undefined, protection: () => ['x'], cable: () => 'c', title: () => 't' };
    const { prims } = layoutUnifilar(x.roots, L);
    const lines = prims.filter((p) => p.t === 'line');
    const ids = new Set<string>();
    for (const { node } of walk(x.roots)) ids.add(node.id);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l.t === 'line' && l.n && ids.has(l.n)).toBe(true);
  });
});

describe('liste du matériel', () => {
  it('regroupe le matériel identique et additionne les quantités', () => {
    const x = tree();
    const project = { roots: x.roots } as never;
    const bom = billOfMaterials(project, computeNumbering(x.roots), 'fr', t, getRulePack('BE-RGIE').equivalents);
    const mcb = bom.filter((l) => l.cat === 'protection');
    expect(mcb).toHaveLength(1);
    expect(mcb[0].qty).toBe(2);
    expect(mcb[0].std).toBe('EN 60898-1');
    expect(mcb[0].desc).toContain('C20 A');
    const cable = bom.find((l) => l.cat === 'cable')!;
    expect(cable.qty).toBe(2);
    expect(cable.length).toBe(12);
    expect(cable.missingLength).toBe(1);
    expect(cable.std).toBe('H07V-U / H07V-R');
    expect(bom.find((l) => l.cat === 'socket')!.qty).toBe(3);
    expect(bom[0].cat).toBe('board');
    const csv = bomCsv(bom, t);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.split('\r\n')[0]).toContain(';');
  });

  it('une référence fabricant différente fait une ligne à part', () => {
    const x = tree();
    x.mcb2.props.reference = 'MWN520';
    const bom = billOfMaterials({ roots: x.roots } as never, computeNumbering(x.roots), 'fr', t);
    expect(bom.filter((l) => l.cat === 'protection')).toHaveLength(2);
  });

  it('projet réel (maison-a)', () => {
    if (!existsSync('test/fixtures/maison-a.trik')) return;
    const { project } = importTrikker(readFileSync('test/fixtures/maison-a.trik', 'utf8'));
    const bom = billOfMaterials(project, computeNumbering(project.roots), 'fr', t);
    expect(bom.some((l) => l.cat === 'protection' && l.qty >= 2)).toBe(true);
    expect(bom.some((l) => l.cat === 'cable')).toBe(true);
  });
});

describe('matériel propre à un pays', () => {
  it('signale une désignation qui n’existe pas dans le pays du référentiel', () => {
    const x = tree();
    const pack = { ...getRulePack('BE-RGIE'), country: 'NL', options: { cableType: ['VMvK', 'XMvK'] } };
    const f = countryOptionFindings({ roots: x.roots } as never, pack);
    expect(f).toHaveLength(2);
    expect(f[0]).toMatchObject({ ruleId: 'R-COUNTRY-OPTION', params: { value: 'VOB', country: 'NL' } });
    expect(countryOptionFindings({ roots: x.roots } as never, getRulePack('BE-RGIE'))).toHaveLength(0);
  });
});
