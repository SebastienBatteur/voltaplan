/**
 * Vérifications d'une compilation publiée (dossier dist/ ou site assemblé), exécutables en local comme en CI :
 * schémas, empreintes exactes, bandeaux légaux, balises, précache, chemins relatifs ; en mode release, arbre
 * propre, commit attendu et code source correspondant accessible.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { buildIdOf, integrityList, PROVENANCE_FILES, sha256hex } from './fingerprints';
import { buildInfoSchema, fingerprintsSchema, wellKnownSchema, type BuildInfoDoc } from './schemas';

const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));

export interface VerifyResult {
  errors: string[];
  info: BuildInfoDoc | null;
}

export function verifyDist(dir: string): VerifyResult {
  const errors: string[] = [];
  const read = (p: string) => readFileSync(join(dir, p));
  const json = (p: string) => JSON.parse(read(p).toString('utf8'));
  for (const f of [...PROVENANCE_FILES, 'index.html', 'THIRD-PARTY-LICENSES.txt']) if (!existsSync(join(dir, f))) errors.push(`fichier absent : ${f}`);
  if (errors.length) return { errors, info: null };

  const bi = buildInfoSchema.safeParse(json('build-info.json'));
  if (!bi.success) errors.push('build-info.json non conforme : ' + bi.error.message.slice(0, 300));
  const fpRaw = read('fingerprints.json');
  const fp = fingerprintsSchema.safeParse(JSON.parse(fpRaw.toString('utf8')));
  if (!fp.success) errors.push('fingerprints.json non conforme : ' + fp.error.message.slice(0, 300));
  if (!bi.success || !fp.success) return { errors, info: null };
  const info = bi.data;

  // Artefacts référencés : empreintes exactes
  for (const [k, a] of Object.entries(info.artifacts)) {
    if (!existsSync(join(dir, a.path))) errors.push(`artefact ${k} absent : ${a.path}`);
    else if (sha256hex(read(a.path)) !== a.sha256) errors.push(`artefact ${k} : empreinte différente`);
  }
  // Liste d'intégrité = fichiers réellement publiés
  const files = walk(dir).map((f) => ({ path: relative(dir, f).replace(/\\/g, '/'), content: readFileSync(f) }));
  const actual = integrityList(files);
  const listed = fp.data.integrity?.files ?? [];
  const key = (l: { path: string; sha256: string }[]) => l.map((f) => `${f.sha256} ${f.path}`).join('\n');
  if (key(actual) !== key(listed)) {
    const a = new Set(actual.map((f) => `${f.sha256} ${f.path}`));
    const b = new Set(listed.map((f) => `${f.sha256} ${f.path}`));
    errors.push(`liste d'intégrité différente des fichiers publiés : ${[...a].filter((x) => !b.has(x)).slice(0, 3).join(', ')} / ${[...b].filter((x) => !a.has(x)).slice(0, 3).join(', ')}`);
  }
  if (info.build.id !== buildIdOf(listed)) errors.push('build.id ne correspond pas à la liste d’intégrité');
  if (fp.data.subject.commit !== info.repository.commit || fp.data.subject.version !== info.build.version) errors.push('fingerprints.json et build-info.json : commit ou version différents');

  // Bandeau légal dans chaque fichier JavaScript (conservé par la minification)
  for (const f of files.filter((x) => x.path.endsWith('.js'))) {
    // Fichiers .mjs : ressources tierces copiées telles quelles (lecteur PDF), avec leur propre mention de licence
    if (f.path === 'sw.js') continue;
    const head = f.content.toString('utf8');
    if (!head.includes(`/*! `) || !head.includes(info.project.id)) errors.push(`bandeau légal absent : ${f.path}`);
  }
  // Balises d'identification cohérentes avec build-info.json ; chemins relatifs (déploiement en sous-répertoire)
  const html = read('index.html').toString('utf8');
  const meta = (n: string) => new RegExp(`<meta name="${n}" content="([^"]*)"`).exec(html)?.[1] ?? null;
  if (meta('osp:project-id') !== info.project.id) errors.push('index.html : osp:project-id différent');
  if (meta('osp:version') !== info.build.version) errors.push('index.html : osp:version différent');
  if (meta('osp:commit') !== info.repository.commit) errors.push('index.html : osp:commit différent');
  if (meta('osp:license') !== info.license.spdx) errors.push('index.html : osp:license différent');
  if (!html.includes('rel="describedby" type="application/json" href="./build-info.json"')) errors.push('index.html : lien describedby absent');
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) if (m[1].startsWith('/')) errors.push(`index.html : chemin absolu ${m[1]} (sous-répertoire impossible)`);
  // Précache : jamais les fichiers de provenance (pas de dépendance circulaire, pas de métadonnées périmées hors ligne)
  if (existsSync(join(dir, 'sw.js'))) {
    const sw = read('sw.js').toString('utf8');
    for (const p of PROVENANCE_FILES) if (sw.includes(`"./${p}"`)) errors.push(`sw.js précache ${p}`);
    if (!sw.includes('"./THIRD-PARTY-LICENSES.txt"')) errors.push('sw.js : THIRD-PARTY-LICENSES.txt non précaché (À propos hors ligne)');
  }
  return { errors, info };
}

/** Exigences d'une release officielle (en plus de verifyDist). */
export async function verifyRelease(info: BuildInfoDoc, expected: { commit?: string; version?: string; checkUrl?: (u: string) => Promise<boolean> }): Promise<string[]> {
  const errors: string[] = [];
  if (info.build.status !== 'clean') errors.push(`arbre Git non propre ou commit inconnu (status ${info.build.status}) : publication refusée`);
  if (info.repository.dirty !== false) errors.push('modifications non commitées : publication refusée');
  if (info.build.derived) errors.push('compilation dérivée (dépôt ou identité différents) : pas une release du projet d’origine');
  if (expected.commit && info.repository.commit !== expected.commit) errors.push(`commit ${info.repository.commit} ≠ commit attendu ${expected.commit}`);
  if (expected.version && info.build.version !== expected.version) errors.push(`version ${info.build.version} ≠ version attendue ${expected.version}`);
  if (!info.source.correspondingSource) errors.push('code source correspondant inconnu');
  else if (expected.checkUrl) {
    for (const u of [info.source.correspondingSource, info.source.archive].filter((x): x is string => !!x)) if (!(await expected.checkUrl(u))) errors.push(`code source inaccessible : ${u}`);
  }
  return errors;
}

/** Manifeste de découverte d'un site (/.well-known/oss-provenance.json) d'après les build-info.json servis. */
export function wellKnown(siteDir: string, instances: string[]) {
  const projects = new Map<string, { id: string; name: string; license: string; upstreamRepository: string; metadata: string; instances: { url: string; buildInfo: string; buildInfoSha256: string }[] }>();
  for (const inst of instances) {
    const rel = `${inst.replace(/\/+$/, '')}/build-info.json`;
    const raw = readFileSync(join(siteDir, rel));
    const info = buildInfoSchema.parse(JSON.parse(raw.toString('utf8')));
    const p = projects.get(info.project.id) ?? {
      id: info.project.id,
      name: info.project.name,
      license: info.license.spdx,
      upstreamRepository: info.upstream.repository,
      metadata: info.repository.url && info.repository.commit ? `${info.repository.url}/blob/${info.repository.commit}/${info.project.metadata}` : `${info.upstream.repository}/blob/HEAD/${info.project.metadata}`,
      instances: [],
    };
    p.instances.push({ url: inst.replace(/\/*$/, '/'), buildInfo: rel, buildInfoSha256: sha256hex(raw) });
    projects.set(info.project.id, p);
  }
  return wellKnownSchema.parse({ $schema: 'https://voltaplan.org/schemas/oss-provenance/well-known-1.0.schema.json', schemaVersion: '1.0', projects: [...projects.values()] });
}

/** Vérifie un site assemblé : manifeste présent et cohérent avec chaque build-info.json servi. */
export function verifySite(siteDir: string): string[] {
  const errors: string[] = [];
  const p = join(siteDir, '.well-known', 'oss-provenance.json');
  if (!existsSync(p)) return ['.well-known/oss-provenance.json absent du site (fichiers commençant par un point non copiés ?)'];
  const wk = wellKnownSchema.safeParse(JSON.parse(readFileSync(p, 'utf8')));
  if (!wk.success) return ['.well-known/oss-provenance.json non conforme'];
  for (const pr of wk.data.projects)
    for (const i of pr.instances) {
      const f = join(siteDir, i.buildInfo);
      if (!existsSync(f)) errors.push(`${i.buildInfo} absent`);
      else if (sha256hex(readFileSync(f)) !== i.buildInfoSha256) errors.push(`${i.buildInfo} : empreinte différente du manifeste (version servie différente)`);
    }
  return errors;
}
