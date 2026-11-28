/**
 * Essai de compatibilité des fichiers avec une version précédente (ADR-0010, décision 4) : un fichier écrit par la
 * version courante est ouvert, contrôlé, réenregistré puis rouvert par la version précédente (un commit git), et
 * par la version courante pour comparaison. Rien n'est supposé sur le comportement de l'ancienne version : elle
 * s'exécute réellement.
 *
 *   npm run test:compat [-- <ref git>]   (défaut : origin/main ; lancé à la main, ≈ 1 min)
 *
 * Distingue :
 *  - compatibilité TECHNIQUE (le fichier s'ouvre sans erreur, aucune valeur n'est inventée ni perdue) : vérifiée,
 *    l'essai échoue sinon ;
 *  - compatibilité SÉMANTIQUE (l'ancienne version ignore la provenance et peut présenter une valeur non confirmée
 *    autrement) : constatée et affichée, à juger (minReaderVersion).
 *
 * Un arbre de travail git temporaire est créé pour la version précédente (dans le dossier temporaire du système,
 * node_modules partagé par une jonction) et retiré à la fin.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');
const ref = process.argv.slice(2).filter((x) => x !== '--')[0] ?? 'origin/main';
const work = mkdtempSync(join(tmpdir(), 'voltaplan-compat-'));
const prev = join(work, 'prev');
const viteNode = (cwd: string, ...args: string[]) =>
  execFileSync(process.execPath, [join(root, 'node_modules', 'vite-node', 'vite-node.mjs'), ...args], { cwd, stdio: 'pipe' });

type Side = { opened: boolean; error?: string; warnings?: string[]; read?: Record<string, unknown>; resaved?: Record<string, unknown> };
const read = (f: string) => JSON.parse(readFileSync(f, 'utf8')) as Side;

let failures = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failures++;
};

try {
  const file = join(work, 'essai.voltaplan');
  const ids = join(work, 'ids.json');
  viteNode(root, 'tools/compat/fixture.ts', file, ids);
  const sha = execFileSync('git', ['rev-parse', '--short', ref], { cwd: root }).toString().trim();
  execFileSync('git', ['worktree', 'add', '--detach', prev, ref], { cwd: root, stdio: 'pipe' });
  symlinkSync(join(root, 'node_modules'), join(prev, 'node_modules'), 'junction');
  mkdirSync(join(prev, 'tools', 'compat'), { recursive: true });
  copyFileSync(join(root, 'tools', 'compat', 'reader.ts'), join(prev, 'tools', 'compat', 'reader.ts'));
  viteNode(prev, 'tools/compat/reader.ts', file, ids, join(work, 'prev.json'));
  copyFileSync(file, file + '.cur');
  viteNode(root, 'tools/compat/reader.ts', file + '.cur', ids, join(work, 'cur.json'));
  // Fichier réenregistré par la version précédente, rouvert par la version courante
  copyFileSync(file + '.resaved', join(work, 'retour.voltaplan'));
  viteNode(root, 'tools/compat/reader.ts', join(work, 'retour.voltaplan'), ids, join(work, 'back.json'));

  const old = read(join(work, 'prev.json'));
  const cur = read(join(work, 'cur.json'));
  const back = read(join(work, 'back.json'));
  console.log(`\nVersion précédente : ${ref} (${sha})\n`);
  console.log('— Compatibilité technique');
  check(old.opened, `la version précédente ouvre le fichier${old.error ? ' : ' + old.error : ''}`);
  if (old.opened && cur.opened) {
    const o = old.read!;
    const c = cur.read!;
    check(JSON.stringify(o.emptyProtProps) === JSON.stringify(c.emptyProtProps), `aucune valeur inventée à la lecture (protection de relevé : ${JSON.stringify(o.emptyProtProps)})`);
    check(o.supply === c.supply && o.supply === '', `réseau inconnu gardé inconnu (« ${String(o.supply)} »)`);
    const r = old.resaved!;
    check(r.provenanceSince === c.provenanceSince, 'marqueur de suivi gardé après enregistrement par la version précédente');
    check(r.historicUnknown === c.historicUnknown, `valeurs historiques gardées (${String(r.historicUnknown)} / ${String(c.historicUnknown)})`);
    check(r.confirmedWithOrigin === c.confirmedWithOrigin && JSON.stringify(r.confirmedBy) === JSON.stringify(c.confirmedBy), 'origine et auteur des confirmations gardés');
    check(back.opened && back.warnings !== undefined && !back.warnings.includes('file.historicValues'), 'retour dans la version courante sans nouveau marquage');
    console.log('\n— Compatibilité sémantique (constat, à juger)');
    const of = o.findings as Record<string, unknown>;
    const cf = c.findings as Record<string, unknown>;
    const row = (label: string, k: string) => console.log(`  ${label.padEnd(58)} précédente : ${JSON.stringify(of[k])}   courante : ${JSON.stringify(cf[k])}`);
    row('« Valeurs non confirmées » (R-UNCONFIRMED)', 'unconfirmed');
    row('« Valeurs à confirmer » (R-HISTORIC)', 'historic');
    row('Anomalies potentielles', 'potential');
    row('Non-conformités bloquantes', 'blockingNonCompliant');
    row('Prise sans terre (valeur historique)', 'socketNoEarth');
    row('Prise de relevé, terre et obturateurs non renseignés', 'unsetSocket');
  }
} catch (e) {
  const err = e as { stderr?: Buffer; message?: string };
  console.error('✗ essai interrompu :', err.stderr?.toString() || err.message);
  failures++;
} finally {
  // La jonction vers node_modules est retirée AVANT l'arbre de travail : sinon la suppression la suivrait et
  // viderait le node_modules de la version courante.
  const link = join(prev, 'node_modules');
  if (existsSync(link) && lstatSync(link).isSymbolicLink()) unlinkSync(link);
  if (existsSync(link)) {
    // Jamais de suppression qui pourrait suivre la jonction : arbre temporaire laissé en place
    console.error(`✗ jonction node_modules non retirée : arbre temporaire laissé en place (${prev})`);
    failures++;
  } else {
    try {
      execFileSync('git', ['worktree', 'remove', '--force', prev], { cwd: root, stdio: 'pipe' });
    } catch {
      /* pas créé */
    }
    rmSync(work, { recursive: true, force: true });
  }
}
if (failures) process.exitCode = 1;
