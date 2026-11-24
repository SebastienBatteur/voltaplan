/**
 * Banc d'essai du format v2 (SPEC-FORMAT-V2 § 9), MESURES NODE SUR ORDINATEUR, PAS MOBILE.
 *
 *   npx vite-node tools/perf-v2/run.ts [tailles en Mo, ex. 10,50,100,250,500] [--keep]
 *
 * Corpus 100 % synthétique (aucune donnée réelle) : « photos » de 3 à 5 Mo et « PDF » de 2 à 40 Mo au contenu
 * aléatoire (incompressible, comme de vrais JPEG/PDF), signatures de fichier valides, modèle de 400 circuits.
 * Les fichiers sont créés dans un dossier temporaire du système et supprimés à la fin (sauf --keep).
 *
 * Mesures (code réel de src/format et src/io) :
 *  - enregistrement complet : archive écrite en flux sur le disque (documents lus sur le disque) ;
 *  - ouverture : répertoire central, manifest, modèle, validation (sans lire les documents) ;
 *  - lecture sélective : une photo, et le plus gros PDF, vérifiés (taille, signature, SHA-256) ;
 *  - vérification complète de l'intégrité (tous les documents) ;
 *  - sauvegarde automatique : brouillon (modèle seul) dans IndexedDB simulé (fake-indexeddb, en mémoire) ;
 *  - ajout d'une photo de 5 Mo au stockage de travail (empreinte, type, vérification après écriture) ;
 *  - migration d'un projet v1 de 50 Mo (photos en base64) ;
 *  - mémoire : RSS et tas JavaScript, pic échantillonné toutes les 5 ms pendant chaque opération.
 */
import 'fake-indexeddb/auto';
import { createHash, randomFillSync } from 'node:crypto';
import { createWriteStream, mkdirSync, openAsBlob, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir, cpus, totalmem } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { readArchive, verifyArchive, writeArchive, type ArchiveOriginal } from '../../src/format/archive';
import { AssetStore, MemoryAssetBackend } from '../../src/format/assets';
import { AssetSession } from '../../src/format/session';
import { openProjectData } from '../../src/io/projectData';
import { browserSave, draftId, parseProjectChecked } from '../../src/io/storage';
import { mergeSources } from '../../src/format/projectFile';
import { emptyProject } from '../../src/model/tree';
import type { ElNode, Project } from '../../src/model/types';

const MB = 1024 * 1024;
const args = process.argv.slice(2);
const SIZES = (args.find((a) => /^[\d,]+$/.test(a)) ?? '10,50,100,250,500').split(',').map(Number);
const KEEP = args.includes('--keep');
const DIR = join(tmpdir(), 'voltaplan-perf-v2-' + process.pid);

/** Générateur pseudo-aléatoire déterministe (tailles reproductibles d'une exécution à l'autre). */
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);

interface Doc {
  path: string;
  sha256: string;
  mime: string;
  size: number;
}

function makeDoc(i: number, kind: 'jpg' | 'pdf', size: number): Doc {
  const buf = Buffer.allocUnsafe(size);
  randomFillSync(buf);
  if (kind === 'jpg') buf.set([0xff, 0xd8, 0xff, 0xe0], 0);
  else buf.write('%PDF-1.7\n', 0, 'latin1');
  const path = join(DIR, `doc-${i}.${kind}`);
  writeFileSync(path, buf);
  return { path, sha256: createHash('sha256').update(buf).digest('hex'), mime: kind === 'jpg' ? 'image/jpeg' : 'application/pdf', size };
}

/** Modèle de 400 circuits (tableau → circuits → points), sans données réelles. */
function model(docs: Doc[]): Project {
  const p = emptyProject();
  p.meta.title = 'Projet synthétique';
  const circuits: ElNode[] = Array.from({ length: 400 }, (_, i) => ({
    id: `c${i}`,
    kind: 'circuit',
    props: { name: `Circuit ${i}`, section: 2.5, rating: 20 },
    children: Array.from({ length: 4 }, (_, k) => ({ id: `c${i}s${k}`, kind: 'socket', props: { count: 1 }, children: [] })),
  })) as unknown as ElNode[];
  p.loose = circuits;
  p.boards = {};
  docs.forEach((d, i) => {
    const href = 'asset:' + d.sha256;
    if (d.mime === 'application/pdf') p.plan.pages.push({ id: 'pg' + i, name: 'Plan ' + i, walls: [], openings: [], rects: [], symbols: [], labels: [], images: [{ center: { x: 0, y: 0 }, w: 10000, h: 8000, angle: 0, href, background: true }] });
    else (p.boards as Record<string, unknown>)['b' + i] = { slots: {}, photo: { href, x: 0, y: 0, w: 100, h: 80 } };
  });
  return p;
}

/** Mesure : durée, et pic de mémoire (RSS, tas) au-dessus du niveau de départ. */
async function measure<T>(fn: () => Promise<T>): Promise<{ ms: number; rssMb: number; heapMb: number; value: T }> {
  (globalThis as { gc?: () => void }).gc?.();
  const m0 = process.memoryUsage();
  let rss = m0.rss;
  let heap = m0.heapUsed;
  const timer = setInterval(() => {
    const m = process.memoryUsage();
    rss = Math.max(rss, m.rss);
    heap = Math.max(heap, m.heapUsed);
  }, 5);
  const t0 = performance.now();
  try {
    const value = await fn();
    const ms = performance.now() - t0;
    const m = process.memoryUsage();
    rss = Math.max(rss, m.rss);
    heap = Math.max(heap, m.heapUsed);
    return { ms, rssMb: (rss - m0.rss) / MB, heapMb: (heap - m0.heapUsed) / MB, value };
  } finally {
    clearInterval(timer);
  }
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const fmtMs = (n: number) => (n >= 1000 ? `${r1(n / 1000)} s` : `${Math.round(n)} ms`);

async function main() {
  mkdirSync(DIR, { recursive: true });
  const max = Math.max(...SIZES);
  console.log(`# Banc format v2 — Node ${process.version}, ${cpus()[0].model} (${cpus().length} fils), ${Math.round(totalmem() / 1e9)} Go`);
  console.log(`Dossier temporaire : ${DIR}`);
  // Réserve de documents pour la plus grande taille ; les petites tailles en prennent le début
  const pool: Doc[] = [];
  let total = 0;
  let i = 0;
  // Photos et PDF mélangés : une photo et un petit PDF d'abord (présents dès 10 Mo), un PDF de 40 Mo passé 50 Mo
  let big = false;
  while (total < max * MB) {
    let pdf = i === 1 || rnd() < 0.08;
    let size = i === 1 ? 3 * MB : pdf ? Math.round((2 + rnd() * 30) * MB) : Math.round((3 + rnd() * 2) * MB);
    if (i === 0) pdf = false;
    if (!big && total >= 50 * MB) {
      big = true;
      pdf = true;
      size = 40 * MB;
    }
    pool.push(makeDoc(i++, pdf ? 'pdf' : 'jpg', size));
    total += size;
  }
  console.log(`Réserve : ${pool.length} documents, ${Math.round(total / MB)} Mo\n`);

  const rows: Record<string, string | number>[] = [];
  for (const target of SIZES) {
    const docs: Doc[] = [];
    let sum = 0;
    for (const d of pool) {
      if (sum >= target * MB) break;
      docs.push(d);
      sum += d.size;
    }
    const project = model(docs);
    const projectText = JSON.stringify(project);
    const archivePath = join(DIR, `projet-${target}.voltaplan`);
    const originals: ArchiveOriginal[] = docs.map((d) => ({ sha256: d.sha256, mime: d.mime, size: d.size, blob: () => openAsBlob(d.path, { type: d.mime }) }));

    const save = await measure(async () => {
      const sink = Writable.toWeb(createWriteStream(archivePath)) as WritableStream<Uint8Array>;
      await writeArchive({ projectText, title: project.meta.title, appVersion: 'perf', originals }, sink);
    });
    const archiveSize = statSync(archivePath).size;

    const open = await measure(async () => {
      const blob = await openAsBlob(archivePath);
      const a = await readArchive(blob);
      const { text } = mergeSources(a.projectText, a.sourcesText);
      parseProjectChecked(text, 'perf');
      return a;
    });
    const a = open.value;
    const photo = docs.find((d) => d.mime === 'image/jpeg')!;
    const pdf = docs.filter((d) => d.mime === 'application/pdf').sort((x, y) => y.size - x.size)[0];
    const readPhoto = await measure(() => a.originals.get(photo.sha256)!.open());
    const readPdf = pdf ? await measure(() => a.originals.get(pdf.sha256)!.open()) : null;
    const verifyAll = await measure(async () => {
      const fresh = await readArchive(await openAsBlob(archivePath));
      await verifyArchive(fresh);
      if (fresh.report.invalid.length) throw new Error('invalide : ' + JSON.stringify(fresh.report.invalid.slice(0, 3)));
    });
    const autosave = await measure(() => browserSave(draftId('perf'), 'perf', project, 'any'));
    const addPhoto = await measure(async () => {
      const store = new AssetStore(new MemoryAssetBackend());
      const buf = Buffer.allocUnsafe(5 * MB);
      randomFillSync(buf);
      buf.set([0xff, 0xd8, 0xff, 0xe0], 0);
      await store.add(new Blob([buf]));
    });

    rows.push({
      'Taille visée': `${target} Mo`,
      Documents: docs.length,
      Archive: `${r1(archiveSize / MB)} Mo`,
      'Enregistrement complet': fmtMs(save.ms),
      'Mém. enreg. (RSS)': `+${r1(save.rssMb)} Mo`,
      Ouverture: fmtMs(open.ms),
      'Mém. ouverture (RSS / tas)': `+${r1(open.rssMb)} / +${r1(open.heapMb)} Mo`,
      'Lecture 1 photo': fmtMs(readPhoto.ms),
      'Lecture plus gros PDF': readPdf ? `${fmtMs(readPdf.ms)} (${r1(pdf.size / MB)} Mo)` : '—',
      'Vérification complète': fmtMs(verifyAll.ms),
      'Brouillon (modèle seul)': fmtMs(autosave.ms),
      'Ajout photo 5 Mo': fmtMs(addPhoto.ms),
    });
    console.log(JSON.stringify(rows[rows.length - 1]));
    if (!KEEP) rmSync(archivePath, { force: true });
  }

  // Migration v1 → v2 : projet v1 de 50 Mo (photos intégrées en base64)
  const v1 = emptyProject();
  (v1 as { version: number }).version = 1;
  v1.boards = {};
  let v1size = 0;
  let k = 0;
  while (v1size < 50 * MB * 0.7) {
    const buf = Buffer.allocUnsafe(Math.round(3.5 * MB));
    randomFillSync(buf);
    buf.set([0xff, 0xd8, 0xff, 0xe0], 0);
    (v1.boards as Record<string, unknown>)['b' + k++] = { slots: {}, photo: { href: 'data:image/jpeg;base64,' + buf.toString('base64'), x: 0, y: 0, w: 1, h: 1 } };
    v1size += buf.length;
  }
  const v1Text = JSON.stringify(v1);
  const migrate = await measure(async () => {
    const session = new AssetSession(() => new AssetStore(new MemoryAssetBackend()));
    return openProjectData(new Blob([v1Text]), 'v1.voltaplan', session, { background: false });
  });

  console.log('\n## Résultats (mesures Node sur ordinateur, pas mobile)\n');
  const cols = Object.keys(rows[0]);
  console.log('| ' + cols.join(' | ') + ' |');
  console.log('|' + cols.map(() => '---').join('|') + '|');
  for (const r of rows) console.log('| ' + cols.map((c) => r[c]).join(' | ') + ' |');
  console.log(`\nMigration v1 → v2 d'un projet v1 de ${r1(v1Text.length / MB)} Mo (${k} photos intégrées) : ${fmtMs(migrate.ms)}, mémoire +${r1(migrate.rssMb)} Mo (RSS).`);
  writeFileSync(join(process.cwd(), 'tools/perf-v2/results.json'), JSON.stringify({ node: process.version, cpu: cpus()[0].model, threads: cpus().length, ramGb: Math.round(totalmem() / 1e9), rows, migration: { sizeMb: r1(v1Text.length / MB), photos: k, ms: Math.round(migrate.ms), rssMb: r1(migrate.rssMb) } }, null, 1));
  if (!KEEP) rmSync(DIR, { recursive: true, force: true });
}

main().catch((e) => {
  console.error(e);
  if (!KEEP) rmSync(DIR, { recursive: true, force: true });
  process.exit(1);
});
