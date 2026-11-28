/**
 * Tests de mutation ciblés sur les règles de sécurité : chaque mutant modifie volontairement un seuil, un opérateur
 * de comparaison ou une condition réglementaire ; la suite de tests des règles DOIT échouer (mutant « tué »). Un
 * mutant qui survit révèle un test manquant.
 *
 *   npm run test:mutation [-- id…]   (≈ 1,5 min par mutant ; lancé à la main, pas à chaque modification)
 *
 * Sans dépendance : chaque mutant est appliqué au fichier source, la suite ciblée est lancée avec vitest, puis le
 * fichier est restauré (même en cas d'erreur).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MUTANTS } from './mutants';

const root = join(__dirname, '..', '..');
const TESTS = ['test/rules.cases.test.ts', 'test/rules.rgie2026.test.ts', 'test/rules.matrix.test.ts', 'test/regulatory-consistency.test.ts', 'test/regulations.test.ts', 'test/valueProvenance.test.ts'];

let killed = 0;
const survivors: string[] = [];
/** `npm run test:mutation -- id…` : seulement ces mutants. */
const only = process.argv.slice(2).filter((x) => x !== '--');
const selected = only.length ? MUTANTS.filter((m) => only.includes(m.id)) : MUTANTS;
for (const m of selected) {
  const file = join(root, m.file);
  const original = readFileSync(file, 'utf8');
  const count = original.split(m.find).length - 1;
  if (count !== 1) {
    console.error(`✗ ${m.id} : motif trouvé ${count} fois dans ${m.file} (mutant à mettre à jour)`);
    process.exitCode = 2;
    continue;
  }
  writeFileSync(file, original.replace(m.find, m.replace));
  let failed = false;
  try {
    execFileSync(process.execPath, [join(root, 'node_modules', 'vitest', 'vitest.mjs'), 'run', ...TESTS, '--bail=1', '--reporter=dot'], { cwd: root, stdio: 'pipe' });
  } catch {
    failed = true;
  } finally {
    writeFileSync(file, original);
  }
  if (failed) killed++;
  else survivors.push(`${m.id} — ${m.why}`);
  console.log(`${failed ? '✓ tué     ' : '✗ SURVIT  '} ${m.id}`);
}
console.log(`\n${killed} / ${selected.length} mutants tués`);
if (survivors.length) {
  console.log('Survivants (tests manquants) :\n- ' + survivors.join('\n- '));
  process.exitCode = 1;
}
