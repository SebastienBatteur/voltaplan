import { readFileSync, existsSync } from 'node:fs';
import { importTrikker } from '../src/import/trikker';
import { checkProject, summarize } from '../src/rules';
import { computeNumbering, findNode, walk } from '../src/model/tree';

const fixtures = ['maison-a', 'maison-b', 'maison-c'].filter((f) => existsSync(`test/fixtures/${f}.trik`));

describe.each(fixtures)('import Trikker %s', (name) => {
  const xml = readFileSync(`test/fixtures/${name}.trik`, 'utf8');
  const { project, warnings } = importTrikker(xml, name + '.trik');

  it('produit un arbre, un plan et des symboles liés', () => {
    expect(project.roots.length).toBe(1);
    const nodes = [...walk(project.roots)].length;
    expect(nodes).toBeGreaterThan(20);
    const page = project.plan.pages[0];
    expect(page.walls.length).toBeGreaterThan(5);
    const linked = page.symbols.filter((s) => findNode(project.roots, s.nodeId) || findNode(project.loose, s.nodeId));
    // Tous les symboles du plan doivent pointer vers un nœud existant
    expect(linked.length).toBe(page.symbols.length);
    console.log(name, { nodes, symbols: page.symbols.length, labels: page.labels.length, images: page.images.length, warnings });
  });

  it('numérote les circuits', () => {
    const labels = computeNumbering(project.roots);
    const kindOf = new Map([...walk(project.roots)].map(({ node }) => [node.id, node.kind]));
    const commands = new Set(['switch', 'pushButton', 'relay']);
    // Points (prises, lampes, appareils) : repères uniques. Commandes : repère du point commandé (RGIE 3.1.2.1).
    const points = [...labels.entries()].filter(([id]) => !commands.has(kindOf.get(id)!)).map(([, v]) => v);
    expect(points.length).toBeGreaterThan(5);
    expect(new Set(points).size).toBe(points.length);
    // Un interrupteur qui commande une lampe porte son numéro
    for (const { node } of walk(project.roots))
      if (node.kind === 'switch' && node.children[0]?.kind === 'light') expect(labels.get(node.id)).toBe(labels.get(node.children[0].id));
  });

  it('vérifie le RGIE', () => {
    const f = checkProject(project);
    console.log(name, summarize(f), f.map((x) => x.ruleId + (x.params ? JSON.stringify(x.params) : '')).join('\n  '));
  });
});

it('maison-a : lave-vaisselle partagé = circuit spécialisé manquant', () => {
  if (!existsSync('test/fixtures/maison-a.trik')) return;
  const { project } = importTrikker(readFileSync('test/fixtures/maison-a.trik', 'utf8'));
  const f = checkProject(project);
  expect(f.some((x) => x.ruleId === 'R-DEDICATED-CIRCUIT' && x.params?.appliance === 'dishwasher')).toBe(true);
  // En installation existante : plus rien de bloquant
  project.meta.installationKind = 'existing';
  expect(checkProject(project).some((x) => x.severity === 'error')).toBe(false);
});
