/**
 * Banc d'essai : MÉMOIRE de la migration v1 → v2 à l'ouverture (MESURES NODE SUR ORDINATEUR, PAS MOBILE).
 *
 *   npx vite-node --options.node.execArgv=--expose-gc tools/perf-v2/migration.ts [taille en Mo, défaut 50]
 *   (ou npm run perf:v2:migration)
 *
 * Projet v1 100 % synthétique : photos de tableau de 3,5 Mo au contenu aléatoire (incompressible, comme de vrais
 * JPEG), intégrées en base64, jusqu'à ~70 % de la taille visée (le base64 ajoute un tiers). Le fichier est écrit
 * dans un dossier temporaire puis lu avec `fs.openAsBlob` (équivalent Node du `File` du navigateur : rien n'est
 * en mémoire avant l'ouverture), et supprimé à la fin.
 *
 * Mesure : pic de RSS et du tas JavaScript (échantillonné toutes les 5 ms) au-dessus du niveau de départ, pendant
 * `openProjectData` (lecture, extraction des images, modèle, rangement des documents dans un stockage de travail
 * EN MÉMOIRE : les documents rangés comptent donc dans la mesure, ~70 % de la taille du fichier).
 */
import { randomFillSync } from 'node:crypto';
import { mkdtempSync, openAsBlob, rmSync, writeFileSync } from 'node:fs';
import { cpus, tmpdir, totalmem } from 'node:os';
import { join } from 'node:path';
import { AssetStore, MemoryAssetBackend } from '../../src/format/assets';
import { AssetSession } from '../../src/format/session';
import { openProjectData } from '../../src/io/projectData';
import { emptyProject } from '../../src/model/tree';

const MB = 1024 * 1024;
const target = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 50);
// Dossier temporaire au nom imprévisible, créé atomiquement avec des droits réservés à l'utilisateur (mkdtemp)
const DIR = mkdtempSync(join(tmpdir(), 'voltaplan-perf-migration-'));
const gc = () => (globalThis as { gc?: () => void }).gc?.();

async function main() {
  const path = join(DIR, 'v1.voltaplan');
  let photos = 0;
  {
    // Fichier v1 écrit sur le disque, puis toutes les chaînes libérées avant la mesure
    const v1 = emptyProject();
    (v1 as { version: number }).version = 1;
    v1.boards = {};
    let size = 0;
    while (size < target * MB * 0.7) {
      const buf = Buffer.allocUnsafe(Math.round(3.5 * MB));
      randomFillSync(buf);
      buf.set([0xff, 0xd8, 0xff, 0xe0], 0);
      (v1.boards as Record<string, unknown>)['b' + photos++] = { slots: {}, photo: { href: 'data:image/jpeg;base64,' + buf.toString('base64'), x: 0, y: 0, w: 1, h: 1 } };
      size += buf.length;
    }
    writeFileSync(path, JSON.stringify(v1));
  }
  const file = await openAsBlob(path);
  for (let i = 0; i < 3; i++) gc();
  await new Promise((r) => setTimeout(r, 200));
  gc();
  const m0 = process.memoryUsage();
  let rss = m0.rss;
  let heap = m0.heapUsed;
  const timer = setInterval(() => {
    const m = process.memoryUsage();
    rss = Math.max(rss, m.rss);
    heap = Math.max(heap, m.heapUsed);
  }, 5);
  const t0 = performance.now();
  const session = new AssetSession(() => store);
  const store = new AssetStore(new MemoryAssetBackend());
  const r = await openProjectData(file, 'v1.voltaplan', session, { background: false });
  const ms = performance.now() - t0;
  clearInterval(timer);
  const m = process.memoryUsage();
  rss = Math.max(rss, m.rss);
  heap = Math.max(heap, m.heapUsed);
  const stored = await store.usage();
  const result = {
    node: process.version,
    cpu: cpus()[0].model,
    ramGb: Math.round(totalmem() / 1e9),
    fileMb: Math.round((file.size / MB) * 10) / 10,
    photos,
    converted: stored.assets,
    storedMb: Math.round((stored.assetBytes / MB) * 10) / 10,
    ms: Math.round(ms),
    rssMb: Math.round(((rss - m0.rss) / MB) * 10) / 10,
    heapMb: Math.round(((heap - m0.heapUsed) / MB) * 10) / 10,
    format: r.format,
  };
  console.log(JSON.stringify(result));
  rmSync(DIR, { recursive: true, force: true });
}

main().catch((e) => {
  console.error(e);
  rmSync(DIR, { recursive: true, force: true });
  process.exit(1);
});
