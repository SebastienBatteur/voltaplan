/**
 * Point d'entrée du mode matrice (comparaison de plusieurs fournisseurs et modèles). À lancer par le propriétaire du
 * projet, jamais en intégration continue. Sans `--live --i-authorize-costs`, AUCUN appel : seul le plan (appels,
 * jetons, coût estimés) est affiché. Mode d'emploi : docs/assistant-evaluation.md § 9.
 *
 *   npm run ai-eval:matrix -- --config tools/ai-eval/examples/matrice.exemple.json --dir <corpus>
 */
import { fileURLToPath } from 'node:url';
import { liveReader } from './live';
import { cli } from './matrixCli';

cli(process.argv.slice(2), {
  reader: liveReader(process.env),
  env: process.env,
  log: (s) => console.log(s),
  err: (s) => console.error(s),
  now: () => new Date(),
  // Résultats hors suivi git (dossier ignoré), jamais envoyés ailleurs
  defaultOutRoot: fileURLToPath(new URL('./resultats/', import.meta.url)),
})
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
