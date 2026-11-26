import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { importPlanelec, isPlanelec, planelecSupply } from '../src/import/planelec';
import { ALLOWED_CHILDREN } from '../src/model/schema';
import { walk } from '../src/model/tree';
import type { ElNode, Project } from '../src/model/types';

const n = (id: string, family: string, props: Record<string, unknown>, children: unknown[] = [], extra: Record<string, unknown> = {}) => ({ id, family, props, children, ...extra });
const breaker = (id: string, kind: string, amps: number, children: unknown[], name?: string, residual = 30) =>
  n(id, 'breaker', { kind, current: 'ac', poles: '2', ratedCurrent: amps, curve: '', breakingCapacity: '', residualCurrent: residual, rcdType: 'A', phase: '' }, children, name ? { circuitName: name } : {});
const cable = (id: string, section: string, children: unknown[]) => n(id, 'cable', { type: 'VOB', fireClass: '', cores: 3, crossSection: section, pe: true, installation: 'in-wall', inConduit: true, length: 0 }, children);

/** Projet PlanElec Sketch fabriqué pour le test (même forme que les exports d'essai, données inventées). */
function sample() {
  return {
    format: 'planelec-sketch',
    version: 2,
    title: 'Essai',
    meta: { customerName: 'Client fictif', siteAddress: 'Rue Fictive 3, 4000 Liège', installerName: 'Électro Fictif', ean: '', date: '2026-11-26' },
    singleLine: {
      root: n('sup', 'supply', { supply: '2x230V', earthing: 'TT' }, [
        n('met', 'meter', { unit: 'kWh' }, [
          breaker('gen', 'rcd', 40, [
            n('brd', 'board', { name: '', number: '', location: '', display: 'inline' }, [
              n('ear', 'earth', { resistance: 30, resistanceBelow: true }),
              breaker('r1', 'rcd', 40, [
                n('g1', 'board', { name: 'Éclairage et prises', number: '', location: '', display: 'inline' }, [
                  breaker('c1', 'mcb', 16, [cable('k1', '1,5', [n('s1', 'switch', { kind: 'single', count: 1, dimmer: false }, [n('l1', 'luminaire', { kind: 'standard', count: 1, emergency: 'none' })])])], 'Éclairage 1'),
                  breaker('c2', 'mcb', 20, [cable('k2', '2,5', [n('o1', 'socket', { count: 2, pe: true, phases: '1', childProtection: true }, [n('wm', 'appliance', { kind: 'washing-machine' })])])], 'Prises'),
                ]),
              ], 'Éclairage et prises'),
            ]),
          ], undefined, 300),
        ]),
      ]),
      notes: [{ id: 'nt', text: 'Note' }],
    },
    situation: {
      floors: [
        {
          id: 'f1',
          name: '',
          scale: 50,
          placements: [
            { id: 'p1', nodeId: 'o1', position: { x: 100, y: 130 }, rotation: 0 },
            { id: 'p2', nodeId: 'o1', position: { x: 55, y: 105 }, rotation: 0 },
          ],
          elements: [
            { id: 'e1', symbolId: 'meter', position: { x: 110, y: 130 }, rotation: 0, label: '' },
            { id: 'e2', symbolId: 'detector-smoke', position: { x: 5, y: 165 }, rotation: 0, label: '' },
          ],
          wires: [],
          floorPlan: {
            origin: { x: 0, y: 0 },
            nodes: [
              { id: 'a', x: 1, y: 2 },
              { id: 'b', x: 6, y: 2 },
            ],
            walls: [
              {
                id: 'w',
                fromNodeId: 'a',
                toNodeId: 'b',
                thickness: 0.15,
                openings: [
                  { id: 'd', type: 'DOOR', positionRatio: 0.5, width: 0.9, swingDirection: 'INWARD_RIGHT', doorVariant: 'SINGLE' },
                  { id: 'g', type: 'GARAGE_DOOR', positionRatio: 0.2, width: 0.5 },
                ],
              },
            ],
            rooms: [{ id: 'r', boundaryNodeIds: ['a', 'b'], label: 'Séjour' }],
            stairs: [{ id: 'st', from: { x: 10, y: 3.75 }, to: { x: 9.5, y: 3.15 }, width: 1, spiral: { center: { x: 9.5, y: 3.75 } } }],
            texts: [{ id: 't', position: { x: 0.75, y: 1.75 }, text: 'Texte' }],
            shapes: [{ id: 'c', kind: 'clipart', center: { x: 3, y: 6.75 }, width: 1.8, height: 0.9, rotation: 0, clipart: 'loungeSofa' }],
          },
        },
      ],
    },
  };
}

const byId = (p: Project, id: string) => [...walk(p.roots)].find((x) => x.node.id === id);
function checkTree(nodes: ElNode[]) {
  for (const { node, parent } of walk(nodes)) if (parent) expect(ALLOWED_CHILDREN[parent.kind], `${parent.kind} → ${node.kind}`).toContain(node.kind);
}

describe('import PlanElec Sketch (.planelec.json)', () => {
  it('reconnaît le format', () => {
    expect(isPlanelec('{\n  "format": "planelec-sketch",')).toBe(true);
    expect(isPlanelec('{"format":"voltaplan"}')).toBe(false);
    expect(planelecSupply('2x230V')).toBe('2 x 230V ~ 50Hz');
    expect(planelecSupply('3x400V+N')).toBe('3N x 400V ~ 50Hz');
  });

  it('métadonnées et terre', () => {
    const { project } = importPlanelec(JSON.stringify(sample()));
    expect(project.meta).toMatchObject({ title: 'Essai', supply: '2 x 230V ~ 50Hz', earthing: 'TT', date: '2026-11-26' });
    expect(project.meta.site).toMatchObject({ street: 'Rue Fictive', number: '3', postalCode: '4000', city: 'Liège' });
    expect(project.measurements.earthResistanceOhm).toBe(30);
  });

  it('arbre du schéma repris tel quel ; repères comme PlanElec (différentiels comptés)', () => {
    const { project } = importPlanelec(JSON.stringify(sample()));
    checkTree(project.roots);
    expect(byId(project, 'gen')!.node.props).toMatchObject({ device: 'rcd', residualCurrent: 300 });
    // Disjoncteur simple : la sensibilité recopiée par PlanElec n'est pas reprise
    expect(byId(project, 'c1')!.node.props).toMatchObject({ device: 'mcb', ratedCurrent: 16, circuitName: 'Éclairage 1', fixedLetter: 'C' });
    expect(byId(project, 'c1')!.node.props.residualCurrent).toBeUndefined();
    expect(byId(project, 'c2')!.node.props.fixedLetter).toBe('D');
    expect(byId(project, 'k1')!.node.props).toMatchObject({ cableType: 'VOB', section: 1.5, method: 'inWall', inConduit: true });
    expect(byId(project, 'l1')!.parent?.id).toBe('s1');
    expect(byId(project, 'wm')!.node.props.applianceType).toBe('washingMachine');
    expect(byId(project, 'g1')!.node.props.name).toBe('Éclairage et prises');
  });

  it('plan : murs en mm, portes, pièces, escalier, meubles, symboles à l’échelle de la feuille', () => {
    const { project, warnings } = importPlanelec(JSON.stringify(sample()));
    const pg = project.plan.pages[0];
    expect(pg.walls[0]).toEqual({ a: { x: 1000, y: 2000 }, b: { x: 6000, y: 2000 }, thickness: 150 });
    expect(pg.openings[0]).toMatchObject({ kind: 'door', a: { x: 3050, y: 2000 }, b: { x: 3950, y: 2000 }, hinge: 'left', mirrored: true });
    expect(pg.openings[1].kind).toBe('garageDoor');
    expect(pg.labels.map((l) => l.text).sort()).toEqual(['Séjour', 'Texte']);
    expect(pg.furniture?.map((f) => f.kind).sort()).toEqual(['sofa', 'spiralStairs']);
    // Feuille en mm à 1:50 → plan en mm
    expect(pg.symbols.find((s) => s.nodeId === 'o1')!.pos).toEqual({ x: 5000, y: 6500 });
    expect(pg.symbols.filter((s) => s.nodeId === 'o1')).toHaveLength(1);
    expect(pg.symbols.some((s) => s.nodeId === 'met')).toBe(true);
    expect(project.loose.map((x) => x.kind)).toEqual(['detector']);
    expect(warnings.join('\n')).toMatch(/plusieurs fois/);
  });

  it('refuse un autre fichier', () => {
    expect(() => importPlanelec('pas du json')).toThrow(/PlanElec/);
    expect(() => importPlanelec('{"format":"autre"}')).toThrow(/PlanElec/);
  });

  // Exports réels (hors dépôt) : PLANELEC_SAMPLES="chemin1;chemin2"
  const real = (process.env.PLANELEC_SAMPLES ?? '').split(';').filter((p) => p && existsSync(p));
  it.runIf(real.length > 0)('exports PlanElec réels', () => {
    for (const p of real) {
      const { project, warnings } = importPlanelec(readFileSync(p, 'utf-8'));
      checkTree(project.roots);
      const nodes = [...walk(project.roots)].length;
      const symbols = project.plan.pages.reduce((a, pg) => a + pg.symbols.length, 0);
      console.log(p, { nodes, symbols, pages: project.plan.pages.length, loose: project.loose.length }, warnings);
      expect(warnings.join('\n')).not.toMatch(/non reconnu/);
    }
  });
});
