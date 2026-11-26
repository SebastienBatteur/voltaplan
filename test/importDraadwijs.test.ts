import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { draadwijsSupply, importDraadwijs, parseAddress } from '../src/import/draadwijs';
import { ALLOWED_CHILDREN } from '../src/model/schema';
import { walk } from '../src/model/tree';
import type { ElNode, Project } from '../src/model/types';

const node = (id: string, type: string, props: Record<string, unknown>, children: unknown[] = []) => ({ id, type, props, children });
const mcb = (id: string, name: string, amps: string, section: string, children: unknown[]) =>
  node(id, 'automaat', { omschrijving: name, label: '', beveiliging: 'Automaat', In: amps, polen: '2', curve: 'C', Icn: '3000', kabeltype: 'XVB', brandklasse: 'Cca', aders: '3', sectie: section, plaatsing: 'In de wand', lengte: 0 }, children);

/** Projet Draadwijs fabriqué pour le test (même forme que les fichiers d'exemple, données inventées). */
function sample() {
  return {
    id: 'p',
    version: 3,
    project: { naam: 'Essai', adres: 'Rue Fictive 12 bus 3, 1000 Bruxelles', installateur: 'Électro Fictif', hoedanigheid: 'Installateur électricien', nummer: '7', versie: '2', datum: '2026-11-26', ean: '', aanvang: '2025-06-01' },
    root: node('root1', 'aansluiting', { net: '4P 400V', netsysteem: 'TT', In: 25, kabel: 'EXVB 4x16', aarding: 18 }, [
      node('gen', 'differentieel', { mA: '300', In: '40', polen: '4', type: 'A', omschrijving: 'Général' }, [
        node('g1', 'differentieel', { mA: '30', In: '40', polen: '2', type: 'A', omschrijving: 'Groupe 1' }, [
          mcb('c-light', 'Éclairage', '16', '1,5', [
            node('s1', 'schakelaar', { soort: 'Wissel', plaats: 'hall' }, [node('s2', 'schakelaar', { soort: 'Wissel', plaats: 'hall' }, [node('l1', 'lichtpunt', { aantal: 1, soort: 'Gewoon', plaats: 'hall' })])]),
          ]),
          mcb('c-sock', 'Prises séjour', '20', '2,5', [node('o1', 'stopcontact', { aantal: 2, aarding: true, kinderveiligheid: true, waterdicht: false, vochtig: false, plaats: 'séjour' })]),
        ]),
        mcb('c-hob', 'Taque', '32', '6', [node('ap', 'aansluitpunt', { plaats: 'cuisine' }, [node('hob', 'toestel', { soort: 'Kookplaat', vermogen: 7400, plaats: 'cuisine' })])]),
        mcb('c-pv', 'Panneaux', '16', '2,5', [node('pv', 'zonnepanelen', { panelen: 12, Wp: 420, kVA: 5, plaats: 'grenier' })]),
        mcb('c-bat', 'Batterie', '16', '2,5', [node('bat', 'batterij', { kWh: 10, kVA: 5, plaats: 'débarras' })]),
        mcb('c-sub', 'Garage', '25', '4', [node('sub', 'bord', { naam: 'Tableau garage', plaats: 'garage' }, [mcb('c-g', 'Prises garage', '20', '2,5', [node('o2', 'stopcontact', { aantal: 1, aarding: true, kinderveiligheid: true })])])]),
        node('ats', 'omschakelaar', { bron: 'Hybride omvormer met back-up', soort: 'Automatisch (ATS)' }, [
          node('g2', 'differentieel', { mA: '30', In: '40', polen: '2', type: 'A' }, [mcb('c-sec', 'Prises secourues', '16', '2,5', [node('o3', 'stopcontact', { aantal: 1 })])]),
        ]),
        mcb('c-x', 'Inconnu', '16', '2,5', [node('x', 'vliegtuig', {})]),
      ]),
      node('ev', 'differentieel', { mA: '30', In: '40', polen: '4', type: 'B', omschrijving: 'Borne' }, [mcb('c-ev', 'Borne', '16', '2,5', [node('evc', 'laadpaal', { kW: 11, fasen: '3-fasig', plaats: 'allée' })])]),
    ]),
    plan: {
      floors: [
        {
          id: 'f',
          naam: 'Rez',
          walls: [{ id: 'w', x1: 0, y1: 0, x2: 1000, y2: 0, dikte: 30 }],
          openings: [
            { id: 'o', wallId: 'w', t: 0.5, breedte: 100, soort: 'deur', flip: true, kant: true },
            { id: 'r', wallId: 'w', t: 0.2, breedte: 150, soort: 'raam', flip: false, kant: false },
            { id: 'g', wallId: 'w', t: 0.8, breedte: 240, soort: 'poort', flip: false, kant: false },
          ],
          texts: [{ id: 't', tekst: 'Séjour', x: 500, y: 300, grootte: 32 }],
          symbols: [
            { id: 'a', nodeId: 'o1', x: 100, y: 20, rot: 90 },
            { id: 'b', nodeId: 'root1', x: 60, y: 470, rot: 90 },
            { id: 'c', nodeId: 'pv', x: 300, y: 300, rot: 0 },
          ],
          meubels: [
            { id: 'm1', soort: 'zetel', x: 300, y: 340, w: 200, h: 90, rot: 0 },
            { id: 'm2', soort: 'meetklem', x: 200, y: 445, w: 30, h: 22, rot: 0 },
            { id: 'm3', soort: 'equipotentiaal', x: 150, y: 505, w: 34, h: 34, rot: 0 },
            { id: 'm4', soort: 'kerstboom', x: 0, y: 0, w: 10, h: 10, rot: 0 },
          ],
          background: null,
        },
      ],
    },
    offerte: { uurloon: 50 },
    metingen: { aardelektrode: 'Aardlus in de funderingssleuf', isolatieAlgemeen: null, equipotentiaal: null },
  };
}

const byId = (p: Project, id: string) => [...walk(p.roots)].find((x) => x.node.id === id);
function checkTree(nodes: ElNode[]) {
  for (const { node: n, parent } of walk(nodes)) if (parent) expect(ALLOWED_CHILDREN[parent.kind], `${parent.kind} → ${n.kind}`).toContain(n.kind);
}

describe('import Draadwijs (.draadwijs)', () => {
  it('métadonnées, réseau, terre, date de début des travaux', () => {
    const { project } = importDraadwijs(JSON.stringify(sample()));
    expect(project.meta).toMatchObject({ title: 'Essai', supply: '3N x 400V ~ 50Hz', earthing: 'TT', mainCurrent: 25, installationDate: '2025-06-01', docNumber: '7 v2' });
    expect(project.meta.site).toMatchObject({ street: 'Rue Fictive', number: '12', box: '3', postalCode: '1000', city: 'Bruxelles' });
    expect(project.meta.installer).toMatchObject({ name: 'Électro Fictif', quality: 'Installateur électricien' });
    expect(project.measurements.earthResistanceOhm).toBe(18);
  });

  it('arbre du schéma : général, 30 mA, disjoncteurs et câbles, sous-tableau, inverseur, borne à part', () => {
    const { project, warnings } = importDraadwijs(JSON.stringify(sample()));
    checkTree(project.roots);
    expect(byId(project, 'gen')!.node.props).toMatchObject({ device: 'rcd', residualCurrent: 300, poles: '4P' });
    expect(byId(project, 'c-light')!.node.props).toMatchObject({ device: 'mcb', circuitName: 'Éclairage', ratedCurrent: 16, curve: 'C', breakingCapacity: 3 });
    expect(byId(project, 'c-light')!.node.children[0].props).toMatchObject({ cableType: 'XVB', section: 1.5, conductors: 3, method: 'inWall' });
    expect(byId(project, 'l1')!.parent?.id).toBe('s2');
    expect(byId(project, 's1')!.node.props.switchType).toBe('twoWay');
    expect(byId(project, 'o1')!.node).toMatchObject({ location: 'Séjour', props: { count: 2, earth: true, childSafety: true } });
    expect(byId(project, 'hob')!.parent?.kind).toBe('junctionBox');
    expect(byId(project, 'pv')!.parent?.kind).toBe('inverter');
    expect(byId(project, 'bat')!.node.props).toMatchObject({ capacity: 10, power: 5000 });
    expect(byId(project, 'sub')!.parent?.kind).toBe('cable');
    expect(byId(project, 'ats')!.node.props.device).toBe('switch');
    expect(byId(project, 'g2')!.parent?.id).toBe('ats');
    expect(byId(project, 'ev')!.node.props).toMatchObject({ residualCurrent: 30, rcdType: 'B' });
    expect(byId(project, 'evc')!.node.props).toMatchObject({ applianceType: 'evCharger', power: 11000 });
    expect(warnings.join('\n')).toMatch(/vliegtuig/);
  });

  it('plan en mm : murs, ouvertures, textes, symboles, meubles, compteur et barrette de terre', () => {
    const { project, warnings } = importDraadwijs(JSON.stringify(sample()));
    const pg = project.plan.pages[0];
    expect(pg.name).toBe('Rez');
    expect(pg.walls[0]).toEqual({ a: { x: 0, y: 0 }, b: { x: 10000, y: 0 }, thickness: 300 });
    expect(pg.openings.map((o) => o.kind)).toEqual(['door', 'window', 'garageDoor']);
    expect(pg.openings[0]).toMatchObject({ a: { x: 4500, y: 0 }, b: { x: 5500, y: 0 }, width: 300, hinge: 'right', mirrored: true });
    expect(pg.labels.map((l) => l.text)).toContain('Séjour');
    expect(pg.symbols.find((s) => s.nodeId === 'o1')).toMatchObject({ pos: { x: 1000, y: 200 }, rotation: 90 });
    // Symbole du raccordement → compteur ; barrette de terre (« meetklem ») placée
    expect(pg.symbols.some((s) => s.nodeId === 'root1')).toBe(true);
    expect(byId(project, 'root1')!.node.kind).toBe('meter');
    const bar = [...walk(project.roots)].find((x) => x.node.kind === 'earthBar')!.node;
    expect(pg.symbols.some((s) => s.nodeId === bar.id)).toBe(true);
    expect(pg.furniture?.[0]).toMatchObject({ kind: 'sofa', center: { x: 3000, y: 3400 }, w: 2000, h: 900 });
    expect(warnings.join('\n')).toMatch(/kerstboom/);
  });

  it('adresses et réseaux', () => {
    expect(parseAddress("Rue de l'Exemple 1, 5000 Namur")).toMatchObject({ street: "Rue de l'Exemple", number: '1', postalCode: '5000', city: 'Namur' });
    expect(parseAddress('Sans numéro')).toEqual({ street: 'Sans numéro' });
    expect(draadwijsSupply('2P 230V')).toBe('2 x 230V ~ 50Hz');
    expect(draadwijsSupply('3P 230V')).toBe('3 x 230V ~ 50Hz');
  });

  it('refuse un fichier qui n’est pas un projet Draadwijs', () => {
    expect(() => importDraadwijs('pas du json')).toThrow(/Draadwijs/);
    expect(() => importDraadwijs('{"version":3}')).toThrow(/Draadwijs/);
  });

  // Fichiers d'exemple réels (hors dépôt) : DRAADWIJS_SAMPLES="chemin1;chemin2"
  const real = (process.env.DRAADWIJS_SAMPLES ?? '').split(';').filter((p) => p && existsSync(p));
  it.runIf(real.length > 0)('fichiers d’exemple Draadwijs réels', () => {
    for (const p of real) {
      const { project, warnings } = importDraadwijs(readFileSync(p, 'utf-8'));
      checkTree(project.roots);
      const nodes = [...walk(project.roots)].length;
      const symbols = project.plan.pages.reduce((a, pg) => a + pg.symbols.length, 0);
      console.log(p, { nodes, symbols, pages: project.plan.pages.length, furniture: project.plan.pages[0].furniture?.length }, warnings);
      expect(warnings.join('\n')).not.toMatch(/non reconnu/);
    }
  });
});
