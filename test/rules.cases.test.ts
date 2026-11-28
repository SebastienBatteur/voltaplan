/**
 * Cas fonctionnels de chaque règle du moteur (test/rule-cases/*), et couverture exigée selon la fiche du registre :
 *  - chaque règle : au moins un cas où elle se déclenche et un cas où elle reste muette ;
 *  - exigence avec paramètres → un cas aux valeurs limites ; avec données nécessaires → un cas de données manquantes ;
 *    avec exceptions → un cas d'exception ; avec dispositions transitoires → un cas transitoire (sauf exigence « tool »).
 * Un cas `knownIssue` décrit le comportement attendu d'une anomalie connue : le test vérifie que le projet se construit et
 * que le moteur donne un autre résultat (il échoue dès que l'anomalie est corrigée, ou sur toute autre erreur) ; un cas
 * `notModelled` documente une limite du modèle (non exécuté). Les deux sont listés dans le rapport final.
 */
import { checkProject } from '../src/rules';
import { BE_RULES } from '../src/rules/be/catalog';
import { REQUIREMENTS } from '../src/regulations';
import type { RuleCase } from './rule-cases/types';
import { CASES as G1 } from './rule-cases/g1';
import { CASES as G2 } from './rule-cases/g2';
import { CASES as G3 } from './rule-cases/g3';
import { CASES as G4 } from './rule-cases/g4';

export const ALL_CASES: RuleCase[] = [...G1, ...G2, ...G3, ...G4];

function findings(c: RuleCase) {
  return checkProject(c.build()).filter((f) => f.ruleId === c.rule);
}

function run(c: RuleCase) {
  const fs = findings(c);
  if (c.expect === 'silent') expect(fs, JSON.stringify(fs.map((f) => f.status))).toEqual([]);
  else {
    expect(fs.length, 'aucun constat').toBeGreaterThan(0);
    expect(fs[0]).toMatchObject(c.expect);
  }
}

/** Le moteur donne-t-il le résultat attendu par le cas ? (sans assertion : pour les anomalies connues) */
function meetsExpectation(c: RuleCase, fs: ReturnType<typeof findings>): boolean {
  if (c.expect === 'silent') return fs.length === 0;
  const want = c.expect;
  const f = fs[0];
  if (!f) return false;
  if (f.status !== want.status) return false;
  if (want.blocking !== undefined && f.blocking !== want.blocking) return false;
  return Object.entries(want.params ?? {}).every(([k, v]) => f.params?.[k] === v);
}

describe('Cas fonctionnels des règles', () => {
  for (const c of ALL_CASES) {
    const name = `${c.rule} [${c.kind}] ${c.title}`;
    if (c.notModelled) it.skip(`${name} — non modélisé : ${c.notModelled}`, () => undefined);
    else if (c.knownIssue)
      // Anomalie connue : le projet se construit et le moteur s'exécute sans erreur (une exception ferait échouer le
      // test), et le résultat diffère bien de l'attendu. Si l'anomalie est corrigée, ce test échoue : retirer knownIssue.
      it(`${name} — anomalie connue : ${c.knownIssue}`, () => {
        const fs = findings(c);
        expect(meetsExpectation(c, fs), 'anomalie corrigée : retirer `knownIssue` du cas').toBe(false);
      });
    else it(name, () => run(c));
  }
});

describe('Couverture des règles par les cas', () => {
  const byRule = (id: string) => ALL_CASES.filter((c) => c.rule === id && !c.notModelled && !c.knownIssue);

  it('chaque règle a un cas où elle se déclenche et un cas où elle reste muette', () => {
    const missing: string[] = [];
    for (const id of Object.keys(BE_RULES)) {
      const cs = byRule(id);
      if (!cs.some((c) => c.expect !== 'silent')) missing.push(`${id} : déclenchement`);
      if (!cs.some((c) => c.expect === 'silent')) missing.push(`${id} : silence`);
    }
    expect(missing).toEqual([]);
  });

  it('chaque exigence a les cas que sa fiche demande (limites, données manquantes, exceptions, transitoires)', () => {
    const missing: string[] = [];
    for (const r of REQUIREMENTS) {
      if (r.nature === 'tool') continue;
      const kinds = new Set(ALL_CASES.filter((c) => r.rules.includes(c.rule)).map((c) => c.kind));
      if (r.parameters && Object.keys(r.parameters).length && !kinds.has('boundary')) missing.push(`${r.id} : limites`);
      if (r.dataNeeded.length && !kinds.has('missingData')) missing.push(`${r.id} : données manquantes`);
      if (r.exceptions.length && !kinds.has('exception')) missing.push(`${r.id} : exception`);
      if (r.transitional.length && !kinds.has('transitional')) missing.push(`${r.id} : transitoire`);
    }
    expect(missing).toEqual([]);
  });

  it('les cas visent des règles du catalogue', () => {
    for (const c of ALL_CASES) expect(BE_RULES[c.rule], c.rule).toBeDefined();
  });
});
