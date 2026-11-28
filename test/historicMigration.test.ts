// @vitest-environment node
/**
 * Impact de la provenance historique (ADR-0010, décision 2) mesuré sur les projets d'essai : chaque cas fonctionnel
 * du moteur (test/rule-cases) est ouvert comme un fichier enregistré AVANT le suivi de la provenance, puis comme un
 * fichier récent. La migration ne doit qu'ajouter « à confirmer » (R-HISTORIC) : aucun autre constat ne change,
 * aucune valeur n'est modifiée.
 */
import { describe, expect, it } from 'vitest';
import { checkProject } from '../src/rules';
import { parseProjectText } from '../src/model/migrate';
import type { Finding } from '../src/rules';
import type { Project } from '../src/model/types';
import type { RuleCase } from './rule-cases/types';
import { CASES as G1 } from './rule-cases/g1';
import { CASES as G2 } from './rule-cases/g2';
import { CASES as G3 } from './rule-cases/g3';
import { CASES as G4 } from './rule-cases/g4';

const CASES: RuleCase[] = [...G1, ...G2, ...G3, ...G4].filter((c) => !c.notModelled);
const key = (f: Finding) => JSON.stringify([f.ruleId, f.nodeId ?? '', f.status, f.blocking, f.knowledge ?? '', f.params ?? {}]);
const open = (p: Project, since: string | undefined) => {
  const meta = { ...p.meta, provenanceSince: since };
  if (!since) delete meta.provenanceSince;
  return parseProjectText(JSON.stringify({ ...p, meta })).project;
};

describe('Provenance historique : impact sur les projets d’essai', () => {
  it('ancien fichier : seul « à confirmer » s’ajoute, aucun autre constat ne change, aucune valeur modifiée', () => {
    let withHistoric = 0;
    let existing = 0;
    for (const c of CASES) {
      const p = c.build();
      const recent = open(p, '2026-11-28T00:00:00.000Z');
      const old = open(p, undefined);
      expect(JSON.stringify(old.roots), c.title).toBe(JSON.stringify(recent.roots));
      const before = checkProject(recent).map(key).sort();
      const all = checkProject(old);
      const after = all.filter((f) => f.ruleId !== 'R-HISTORIC').map(key).sort();
      expect(after, `${c.rule} — ${c.title}`).toEqual(before);
      const h = all.filter((f) => f.ruleId === 'R-HISTORIC');
      expect(h.length).toBeLessThanOrEqual(1);
      if (h.length) withHistoric++;
      if (p.meta.installationKind === 'existing') existing++;
    }
    // Mesure : affichée dans le rapport, et bornée pour détecter une dérive
    console.log(`[impact] ${CASES.length} cas, ${existing} en installation existante, ${withHistoric} avec « à confirmer »`);
    expect(withHistoric).toBeGreaterThan(0);
    expect(withHistoric).toBeLessThanOrEqual(CASES.length);
  });
});
