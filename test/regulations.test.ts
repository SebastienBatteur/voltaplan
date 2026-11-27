/**
 * Registre réglementaire (ADR-0009) : intégrité des fiches, et résultat par exigence (gestion de l'incertitude).
 * Ces contrôles empêchent d'ajouter une règle sans fiche (nature, source, statut de validation, applicabilité).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BE_RULES } from '../src/rules/be/catalog';
import { CHECKS } from '../src/regulations/be/applicability';
import { DEROGATIONS } from '../src/regulations/be/derogations';
import { REQUIREMENTS, evaluateProject, requirementOfRule, summarize } from '../src/regulations';
import { evaluateRequirements } from '../src/regulations/evaluate';
import * as V from '../src/regulations/be/values';
import { createNode as baseNode, emptyProject } from '../src/model/tree';
import type { ElNode, NodeKind } from '../src/model/types';
import type { RegRequirement } from '../src/regulations/types';

const ROOT = join(__dirname, '..');
const createNode = (kind: NodeKind, props: ElNode['props'] = {}, children: ElNode[] = []): ElNode => ({ ...baseNode(kind, props), children });
const NATURES = ['rgie', 'normative', 'goodPractice', 'recommendation', 'needsExpert', 'insufficientlyDocumented', 'tool'];

describe('Registre : intégrité (aucune règle sans fiche, sans nature, sans source ni statut)', () => {
  it('chaque règle du catalogue appartient à exactement une exigence, et inversement', () => {
    for (const id of Object.keys(BE_RULES)) expect(REQUIREMENTS.filter((r) => r.rules.includes(id)).length, id).toBe(1);
    for (const r of REQUIREMENTS) for (const id of r.rules) expect(BE_RULES[id], `${r.id} → ${id}`).toBeDefined();
  });

  it('identifiants stables et uniques, indépendants de la numérotation du RGIE', () => {
    const ids = REQUIREMENTS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^BE-[A-Z0-9-]+$/);
    for (const id of ids) expect(id, id).not.toMatch(/\d+-\d+-\d+/);
  });

  it.each(REQUIREMENTS.map((r) => [r.id, r] as const))('%s : nature, source, références, statuts, applicabilité', (_id, r: RegRequirement) => {
    expect(NATURES).toContain(r.nature);
    expect(r.source).toBe('RGIE-L1-v07');
    expect(r.title.length).toBeGreaterThan(5);
    expect(r.statement.length).toBeGreaterThan(20);
    // Une exigence du RGIE cite au moins une référence avec page et citation ; une bonne pratique n'en invente pas
    if (r.nature === 'rgie') {
      expect(r.references.length).toBeGreaterThan(0);
      expect(r.references.every((x) => x.page && x.quote), 'page et citation').toBe(true);
      expect(r.docValidation).toBe('verified');
    }
    if (r.nature === 'tool') expect(r.docValidation).toBe('notApplicable');
    // Validation humaine : aucune à ce jour (ne jamais l'affirmer sans réponse d'un spécialiste)
    expect(['none', 'requested']).toContain(r.humanValidation);
    if (r.openQuestions.some((q) => q.startsWith('Dossier de validation externe'))) expect(r.humanValidation).toBe('requested');
    // Applicabilité déclarée (sinon le résultat serait « données insuffisantes » en permanence)
    expect(CHECKS[r.id], 'contrôle d’applicabilité').toBeDefined();
    // Tests déclarés existants
    for (const t of r.tests) expect(existsSync(join(ROOT, t)), t).toBe(true);
    // Articles pédagogiques existants
    for (const a of r.articles) expect(existsSync(join(ROOT, 'learn', 'fr', a + '.html')), a).toBe(true);
  });

  it('les paramètres d’une exigence sont les objets de values.ts (pas de copie de valeur)', () => {
    const all = new Set(Object.values(V));
    for (const r of REQUIREMENTS) for (const [k, p] of Object.entries(r.parameters ?? {})) expect(all.has(p as never), `${r.id}.${k}`).toBe(true);
  });

  it('les dérogations visent des règles existantes et citent leur référence', () => {
    for (const d of DEROGATIONS) {
      expect(d.ref).toMatch(/^8\.2\.[12]/);
      for (const rule of d.rules) expect(BE_RULES[rule], `${d.id} → ${rule}`).toBeDefined();
    }
  });

  it('aucune valeur réglementaire du registre recopiée en dur dans le moteur', () => {
    const src = readFileSync(join(ROOT, 'src', 'rules', 'be', 'rgie.ts'), 'utf8');
    expect(src).not.toMatch(/\[1\.5, 1[06], 16\]|\[2\.5, 16, 20\]/); // tableau 4.11
    expect(src).not.toMatch(/(?:>=|<|>) ?2600\b/);
    expect(src).not.toMatch(/re (?:>=|>) 100\b/);
    expect(src).not.toMatch(/'2023-06-01'|'2025-03-01'|'1991-09-16'/);
  });

  it('requirementOfRule retrouve l’exigence d’une règle', () => {
    expect(requirementOfRule('R-CABLE-PROT')?.id).toBe('BE-SECTION-RATING');
  });
});

describe('Résultat par exigence : l’incertitude n’est jamais une conformité', () => {
  const base = () => {
    const p = emptyProject();
    p.meta.installer = { name: 'I', quality: 'Installateur', address: {} };
    p.meta.docNumber = '1';
    p.meta.site = { street: 'Rue', number: '1', postalCode: '1000', city: 'Bruxelles', country: 'Belgique' };
    p.measurements = { earthResistanceOhm: 20, insulationMOhm: 10, bondingOk: true };
    return p;
  };
  const result = (p: ReturnType<typeof base>, id: string) => evaluateProject(p).find((r) => r.id === id)!;

  it('mesure de terre absente : « données insuffisantes », jamais « satisfaite »', () => {
    const p = base();
    delete p.measurements.earthResistanceOhm;
    expect(['insufficientData', 'toVerify', 'notSatisfied']).toContain(result(p, 'BE-EARTH-RESISTANCE').outcome);
    expect(result(p, 'BE-EARTH-RESISTANCE').outcome).not.toBe('satisfied');
  });

  it('terre ≤ 30 Ω : les mesures complémentaires sont « non applicables », pas « satisfaites »', () => {
    expect(result(base(), 'BE-EARTH-ABOVE-30').outcome).toBe('notApplicable');
  });

  it('aucune prise : les exigences des socles sont « non applicables »', () => {
    const p = base();
    expect(result(p, 'BE-SOCKETS-PER-CIRCUIT').outcome).toBe('notApplicable');
  });

  it('terre de 20 Ω mesurée : exigence satisfaite', () => {
    expect(result(base(), 'BE-EARTH-RESISTANCE').outcome).toBe('satisfied');
  });

  it('terre de 150 Ω : non satisfaite', () => {
    const p = base();
    p.measurements.earthResistanceOhm = 150;
    expect(result(p, 'BE-EARTH-RESISTANCE').outcome).toBe('notSatisfied');
  });

  it('interprétation à confirmer (nature needsExpert) : « à vérifier » même sans constat', () => {
    const r = REQUIREMENTS.find((x) => x.nature === 'needsExpert')!;
    const out = evaluateRequirements(base(), [], [r], { [r.id]: { applies: () => 'yes', hasData: () => true } });
    expect(out[0].outcome).toBe('toVerify');
  });

  it('exigence sans contrôle d’applicabilité : « données insuffisantes » (jamais satisfaite par défaut)', () => {
    const r = REQUIREMENTS[0];
    expect(evaluateRequirements(base(), [], [r], {})[0].outcome).toBe('insufficientData');
  });

  it('constat « à vérifier » ou « potentiel » : jamais une non-conformité certaine', () => {
    const r = REQUIREMENTS.find((x) => x.id === 'BE-SOCKETS-PER-CIRCUIT')!;
    const f = { ruleId: 'R-SOCKET-MAX', severity: 'info' as const, status: 'manualCheck' as const };
    expect(evaluateRequirements(base(), [f], [r], CHECKS)[0].outcome).toBe('toVerify');
  });

  it('dérogation : « non applicable » avec la raison, pas « satisfaite »', () => {
    const r = REQUIREMENTS.find((x) => x.id === 'BE-DEDICATED-CIRCUITS')!;
    const f = { ruleId: 'R-DEDICATED-CIRCUIT', severity: 'info' as const, status: 'derogation' as const };
    expect(evaluateRequirements(base(), [f], [r], CHECKS)[0]).toMatchObject({ outcome: 'notApplicable', reason: 'derogation' });
  });

  it('le résumé compte séparément satisfaites, non applicables et à compléter', () => {
    const p = base();
    p.roots[0].children[0].children[0].children[0].children.push(
      createNode('protection', { device: 'mcb', ratedCurrent: 20, curve: 'C', poles: '1P+N', circuitName: 'P', breakingCapacity: 6 }, [createNode('cable', { section: 2.5 }, [createNode('socket', {})])]),
    );
    const s = summarize(evaluateProject(p));
    expect(s.satisfied).toBeGreaterThan(0);
    expect(s.notApplicable).toBeGreaterThan(0);
    expect(s.satisfied + s.notSatisfied + s.notApplicable + s.insufficientData + s.toVerify + s.recommendation).toBe(REQUIREMENTS.length);
  });
});
