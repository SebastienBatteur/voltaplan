// @vitest-environment node
/**
 * Provenance et conformité AGPL (tools/provenance) : identité, métadonnées de compilation (local, CI, fork,
 * archive sans .git), schémas, références Git, bandeau légal après minification, empreintes exactes, vérifications
 * de release, manifeste .well-known, licences tierces, SBOM Rust, empreintes historiques, absence d'appel réseau.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { transformWithEsbuild } from 'vite';
import { buildIdOf, fingerprintsDoc, integrityList, lf, sha256hex } from '../tools/provenance/fingerprints';
import { dependencyBackground, historicFingerprints } from '../tools/provenance/history';
import { buildInfo, embeddedBuild, identityOf, legalBanner, readCodeMeta, readGit, sanitizeRepoUrl, type GitInfo } from '../tools/provenance/identity';
import { packageDirOf, readThirdParty, thirdPartyText } from '../tools/provenance/licenses';
import { provenanceTags } from '../tools/provenance/plugin';
import { cargoSbom } from '../tools/provenance/sbomCargo';
import { buildInfoSchema, fingerprintsSchema, jsonSchemaOf, SCHEMAS } from '../tools/provenance/schemas';
import { verifyRelease, verifySite, wellKnown } from '../tools/provenance/verify';
import { isPrecached } from '../src/sw/precache';
import { CONNECT_HOSTS } from '../src/security/csp';
import { sourceUrl, technicalInfo } from '../src/buildInfo';

const ROOT = process.cwd();
const id = identityOf(readCodeMeta(ROOT));
const SHA = 'a'.repeat(40);
const cleanGit: GitInfo = { commit: SHA, commitDate: '2026-11-25T10:00:00+01:00', dirty: false, remote: 'https://github.com/SebastienBatteur/voltaplan.git' };
const noGit: GitInfo = { commit: null, commitDate: null, dirty: null, remote: null };
const gha = (repo: string) => ({ GITHUB_ACTIONS: 'true', GITHUB_SHA: SHA, GITHUB_REPOSITORY: repo, GITHUB_SERVER_URL: 'https://github.com', GITHUB_RUN_ID: '42', GITHUB_RUN_ATTEMPT: '1', GITHUB_WORKFLOW_REF: `${repo}/.github/workflows/pages.yml@refs/heads/main` });
const info = (e: ReturnType<typeof embeddedBuild>, env: Record<string, string> = {}) => buildInfo(e, id, env, { timestamp: '2026-11-25T10:00:00.000Z', buildId: 'sha256:' + 'b'.repeat(64), artifacts: {} });

describe('identité permanente du projet', () => {
  it('codemeta.json : urn:uuid indépendant du nom, du dépôt et du domaine ; alias org.voltaplan', () => {
    expect(id.upstreamId).toBe('urn:uuid:55b25e7a-c2a4-4787-bebc-42ecee353f9e');
    expect(id.projectId).toBe(id.upstreamId);
    expect(id.aliases).toEqual(['org.voltaplan']);
    expect(id.upstreamId).not.toMatch(/voltaplan|github/i);
    expect(id.spdx).toBe('AGPL-3.0-only');
    expect(id.copyright).toBe('Copyright (C) 2026 Sébastien Batteur and VoltaPlan contributors');
  });
  it('licence identique partout (package.json, Cargo.toml, tauri.conf.json, REUSE.toml, codemeta.json)', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.license).toBe(id.spdx);
    expect(readFileSync('src-tauri/Cargo.toml', 'utf8')).toContain(`license = "${id.spdx}"`);
    expect(JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')).bundle.license).toBe(id.spdx);
    expect(readFileSync('REUSE.toml', 'utf8')).toContain(`SPDX-License-Identifier = "${id.spdx}"`);
    expect(readFileSync(`LICENSES/${id.spdx}.txt`, 'utf8')).toBe(readFileSync('LICENSE', 'utf8'));
  });
  it('un projet dérivé qui prend sa propre identité garde la filiation (upstream.id)', () => {
    const d = identityOf(readCodeMeta(ROOT), { OSP_PROJECT_ID: 'urn:uuid:00000000-0000-4000-8000-000000000001' });
    const e = embeddedBuild(d, '1.0.0', cleanGit, {});
    expect(e.projectId).not.toBe(e.upstreamId);
    expect(e.upstreamId).toBe(id.upstreamId);
    expect(e.derived).toBe(true);
  });
});

describe('adresse de dépôt publiable', () => {
  it.each([
    ['https://github.com/SebastienBatteur/voltaplan.git', 'https://github.com/SebastienBatteur/voltaplan'],
    ['git@github.com:someone/fork.git', 'https://github.com/someone/fork'],
    ['https://user:ghp_secret@github.com/a/b', 'https://github.com/a/b'],
    ['https://gitlab.example.org/group/sub/proj', 'https://gitlab.example.org/group/sub/proj'],
    ['C:\\Users\\SEB\\projet', null],
    ['/home/someone/repo', null],
    ['file:///tmp/repo', null],
    ['http://github.com/a/b', null],
    ['', null],
  ])('%s → %s', (raw, out) => expect(sanitizeRepoUrl(raw)).toBe(out));
});

describe('métadonnées de compilation', () => {
  it('compilation locale propre, dépôt d’origine : clean, non dérivée, source au commit', () => {
    const e = embeddedBuild(id, '0.1.0', cleanGit, {});
    expect(e).toMatchObject({ status: 'clean', derived: false, environment: 'local', repository: id.upstreamRepository, correspondingSource: `${id.upstreamRepository}/tree/${SHA}` });
    const bi = info(e);
    expect(buildInfoSchema.parse(bi).build.ci).toBeNull();
    expect(bi.verification.authenticated).toBe(false);
  });
  it('modifications non commitées : modified (pas d’authentification), code source non garanti', () => {
    const e = embeddedBuild(id, '0.1.0', { ...cleanGit, dirty: true }, {});
    expect(e.status).toBe('modified');
    expect(buildInfoSchema.parse(info(e)).build.status).toBe('modified');
  });
  it('GitHub Actions, dépôt d’origine : commit et dépôt de l’exécution, lien vers le run', () => {
    const env = gha('SebastienBatteur/voltaplan');
    const e = embeddedBuild(id, '0.1.0', { ...cleanGit, commit: 'c'.repeat(40) }, env);
    expect(e.commit).toBe(SHA);
    expect(e.environment).toBe('ci');
    const bi = buildInfoSchema.parse(info(e, env));
    expect(bi.build.ci).toMatchObject({ provider: 'github-actions', runId: '42', runUrl: 'https://github.com/SebastienBatteur/voltaplan/actions/runs/42' });
    expect(bi.source.archive).toBe(`https://github.com/SebastienBatteur/voltaplan/archive/${SHA}.tar.gz`);
  });
  it('fork compilé sur GitHub : dérivé, code source = le fork (jamais le dépôt d’origine), filiation gardée', () => {
    const env = gha('someone/voltaplan-fork');
    const e = embeddedBuild(id, '0.1.0', { ...cleanGit, remote: 'https://github.com/someone/voltaplan-fork' }, env);
    expect(e).toMatchObject({ derived: true, repository: 'https://github.com/someone/voltaplan-fork', upstreamRepository: id.upstreamRepository, upstreamId: id.upstreamId });
    expect(sourceUrl(e)).toBe(`https://github.com/someone/voltaplan-fork/tree/${SHA}`);
  });
  it('archive des sources sans .git : statut inconnu ; OSP_COMMIT et OSP_REPOSITORY_URL pris en compte', () => {
    const e = embeddedBuild(id, '0.1.0', noGit, {});
    expect(e).toMatchObject({ status: 'unknown', commit: null, repository: null, correspondingSource: null, dirty: null });
    expect(buildInfoSchema.safeParse(info(e)).success).toBe(true);
    expect(sourceUrl(e)).toBe(id.upstreamRepository);
    const e2 = embeddedBuild(id, '0.1.0', noGit, { OSP_COMMIT: SHA, OSP_REPOSITORY_URL: 'https://codeberg.org/x/y' });
    expect(e2).toMatchObject({ status: 'clean', commit: SHA, derived: true, correspondingSource: `https://codeberg.org/x/y/tree/${SHA}` });
    expect(info(e2).source.archive).toBeNull(); // forme d'archive propre à GitHub
  });
  it('adresse du code source déclarée (OSP_SOURCE_URL) : utilisée et signalée comme déclarée', () => {
    const e = embeddedBuild(id, '0.1.0', cleanGit, { OSP_SOURCE_URL: 'https://example.org/src/voltaplan-1.2.tar.gz' });
    expect(e).toMatchObject({ correspondingSource: 'https://example.org/src/voltaplan-1.2.tar.gz', sourceDeclared: true });
    expect(embeddedBuild(id, '0.1.0', cleanGit, { OSP_SOURCE_URL: 'javascript:alert(1)' }).sourceDeclared).toBe(false);
  });
  it('références Git exactes : readGit donne le commit réel du dépôt', () => {
    let head: string | null = null;
    try {
      head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    } catch {
      /* pas de Git : rien à comparer */
    }
    const g = readGit(ROOT);
    expect(g.commit).toBe(head);
    if (head) expect(g.commitDate).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(readGit(mkdtempSync(join(tmpdir(), 'osp-nogit-')))).toEqual(noGit);
  });
  it('aucun chemin local, nom d’utilisateur ni secret dans les métadonnées', () => {
    const e = embeddedBuild(id, '0.1.0', { ...cleanGit, remote: 'https://me:tok@github.com/me/fork.git' }, { HOME: 'C:\\Users\\SEB', USERNAME: 'SEB' });
    const text = JSON.stringify(info(e));
    expect(text).not.toMatch(/tok@|C:\\\\Users|SEB\b|ghp_/);
  });
  it('informations techniques à copier : sans date de compilation ni donnée personnelle', () => {
    const t = technicalInfo(embeddedBuild(id, '0.1.0', cleanGit, {}));
    expect(t).toContain(`Commit: ${SHA}`);
    expect(t).toContain('License: AGPL-3.0-only');
  });
});

describe('schémas JSON (oss-provenance 1.0)', () => {
  it('fichiers publiés identiques aux définitions (npm run provenance -- schemas)', () => {
    for (const n of Object.keys(SCHEMAS) as (keyof typeof SCHEMAS)[]) {
      expect(JSON.parse(readFileSync(`schemas/oss-provenance/${n}.schema.json`, 'utf8'))).toEqual(jsonSchemaOf(n));
    }
  });
  it('génériques : aucun champ propre à Voltaplan dans les schémas', () => {
    for (const n of Object.keys(SCHEMAS) as (keyof typeof SCHEMAS)[]) {
      const props = JSON.stringify(jsonSchemaOf(n).properties);
      expect(props).not.toMatch(/voltaplan|rgie/i);
    }
  });
  it('refuse un document non conforme (commit mal formé, champ inconnu)', () => {
    const bi = info(embeddedBuild(id, '0.1.0', cleanGit, {}));
    expect(buildInfoSchema.safeParse({ ...bi, repository: { ...bi.repository, commit: 'xyz' } }).success).toBe(false);
    expect(buildInfoSchema.safeParse({ ...bi, tracking: true }).success).toBe(false);
  });
});

describe('mentions légales dans les fichiers distribués', () => {
  const e = embeddedBuild(id, '0.1.0', cleanGit, {});
  it('bandeau : nom, identifiant, SPDX, copyright, source ; stable entre deux commits', () => {
    const b = legalBanner(e);
    expect(b.startsWith('/*!')).toBe(true);
    for (const s of [id.upstreamId, 'SPDX-License-Identifier: AGPL-3.0-only', id.copyright, 'THIRD-PARTY-LICENSES.txt']) expect(b).toContain(s);
    expect(legalBanner(embeddedBuild(id, '0.1.0', { ...cleanGit, commit: 'd'.repeat(40) }, {}))).toBe(b);
  });
  it('fichier fait seulement de code tiers : aucune licence du projet revendiquée', () => {
    const b = legalBanner(e, true);
    expect(b).not.toContain('SPDX-License-Identifier');
    expect(b).toContain('THIRD-PARTY-LICENSES.txt');
  });
  it('conservé après minification (esbuild, comme la compilation de production)', async () => {
    const code = legalBanner(e) + '\nexport function f(longName){ /* commentaire */ return longName * 2 }\n';
    const out = (await transformWithEsbuild(code, 'x.js', { minify: true })).code;
    expect(out).toContain('SPDX-License-Identifier: AGPL-3.0-only');
    expect(out).toContain(id.upstreamId);
    expect(out).not.toContain('commentaire');
  });
  it('balises : chemins relatifs (sous-répertoire), valeurs publiques uniquement', () => {
    const tags = provenanceTags(e);
    const describedby = tags.find((t) => t.attrs?.rel === 'describedby');
    expect(describedby?.attrs?.href).toBe('./build-info.json');
    expect(tags.find((t) => t.attrs?.name === 'osp:commit')?.attrs?.content).toBe(SHA);
    expect(tags.find((t) => t.attrs?.name === 'osp:upstream-id')).toBeUndefined();
  });
});

describe('empreintes exactes et intégrité', () => {
  const files = [
    { path: 'index.html', content: '<html></html>' },
    { path: 'assets/a.js', content: new Uint8Array([1, 2, 3]) },
    { path: 'assets/a.js.map', content: '{}' },
    { path: 'build-info.json', content: '{}' },
    { path: 'fingerprints.json', content: '{}' },
  ];
  it('SHA-256 de chaque fichier publié, triés ; sans les fichiers de provenance ni les cartes', () => {
    const l = integrityList(files);
    expect(l.map((f) => f.path)).toEqual(['assets/a.js', 'index.html']);
    expect(l[1].sha256).toBe(sha256hex('<html></html>'));
    expect(l[0].size).toBe(3);
  });
  it('identifiant de compilation adressé par le contenu : stable, change avec un octet', () => {
    const a = buildIdOf(integrityList(files));
    expect(buildIdOf(integrityList([...files].reverse()))).toBe(a);
    expect(buildIdOf(integrityList([{ path: 'index.html', content: '<html> </html>' }, files[1]]))).not.toBe(a);
  });
  it('empreinte de source identique sous Windows (CRLF) et ailleurs (LF)', () => {
    expect(sha256hex(lf('a\r\nb\r\n'))).toBe(sha256hex('a\nb\n'));
  });
  it('fingerprints.json conforme ; intégrité, sources et similarité séparées ; avertissement explicite', () => {
    const doc = fingerprintsDoc({
      build: { projectId: id.projectId, name: 'Voltaplan', version: '0.1.0', commit: SHA },
      kind: 'build',
      dist: files,
      sources: [{ path: 'src/rules/x.ts', content: 'export const rule = "Article 86.08 RGIE contrôle"; export function check(a: number) { return a > 30 }' }],
      background: { strings: new Set(), shingles: new Set() },
      backgroundMethod: 'test',
    });
    const p = fingerprintsSchema.parse(doc);
    expect(p.integrity!.files).toHaveLength(2);
    expect(p.sources.files.map((f) => f.path)).toEqual(['src/rules/x.ts']);
    expect(p.similarity.components.find((c) => c.name === 'rgie-rules')!.strings.length).toBe(1);
    expect(p.similarity.disclaimer).toMatch(/never proof/);
  });
});

describe('releases officielles', () => {
  const ok = async () => true;
  const bi = (git: GitInfo, env: Record<string, string> = gha('SebastienBatteur/voltaplan')) => buildInfoSchema.parse(info(embeddedBuild(id, '0.1.0', git, env), env));
  it('propre, commit attendu, source accessible : acceptée', async () => {
    expect(await verifyRelease(bi(cleanGit), { commit: SHA, version: '0.1.0', checkUrl: ok })).toEqual([]);
  });
  it('arbre modifié, fork, mauvais commit ou version, source inaccessible : refusée', async () => {
    expect((await verifyRelease(bi({ ...cleanGit, dirty: true }), { checkUrl: ok })).join()).toMatch(/non commitées/);
    expect((await verifyRelease(bi(cleanGit, gha('someone/fork')), { checkUrl: ok })).join()).toMatch(/dérivée/);
    expect((await verifyRelease(bi(cleanGit), { commit: 'f'.repeat(40), checkUrl: ok })).join()).toMatch(/commit attendu/);
    expect((await verifyRelease(bi(cleanGit), { version: '0.2.0', checkUrl: ok })).join()).toMatch(/version attendue/);
    expect((await verifyRelease(bi(cleanGit), { checkUrl: async () => false })).join()).toMatch(/inaccessible/);
    expect((await verifyRelease(bi(noGit, {}), { checkUrl: ok })).join()).toMatch(/inconnu/);
  });
});

describe('manifeste .well-known et cohérence avec la version servie', () => {
  it('écrit, conforme, puis détecte une version servie différente', () => {
    const site = mkdtempSync(join(tmpdir(), 'osp-site-'));
    mkdirSync(join(site, 'app'));
    const bi = info(embeddedBuild(id, '0.1.0', cleanGit, {}));
    writeFileSync(join(site, 'app', 'build-info.json'), JSON.stringify(bi));
    const wk = wellKnown(site, ['app']);
    expect(wk.projects[0]).toMatchObject({ id: id.upstreamId, license: 'AGPL-3.0-only', instances: [{ url: 'app/', buildInfo: 'app/build-info.json' }] });
    expect(verifySite(site)).toEqual(['.well-known/oss-provenance.json absent du site (fichiers commençant par un point non copiés ?)']);
    mkdirSync(join(site, '.well-known'));
    writeFileSync(join(site, '.well-known', 'oss-provenance.json'), JSON.stringify(wk));
    expect(verifySite(site)).toEqual([]);
    writeFileSync(join(site, 'app', 'build-info.json'), JSON.stringify({ ...bi, build: { ...bi.build, version: '0.1.1' } }));
    expect(verifySite(site).join()).toMatch(/empreinte différente/);
  });
});

describe('service worker et fonctionnement hors ligne', () => {
  it('métadonnées de provenance jamais précachées (pas de cycle, pas de version périmée) ; licences tierces précachées', () => {
    expect(isPrecached('build-info.json')).toBe(false);
    expect(isPrecached('fingerprints.json')).toBe(false);
    expect(isPrecached('THIRD-PARTY-LICENSES.txt')).toBe(true);
  });
});

describe('licences tierces', () => {
  it('dossier du paquet : simple, à portée, imbriqué, chemins Windows, module virtuel', () => {
    expect(packageDirOf(['', 'p', 'node_modules', 'react', 'index.js'].join(sep))).toBe(['', 'p', 'node_modules', 'react'].join(sep));
    expect(packageDirOf('C:\\p\\node_modules\\@zip.js\\zip.js\\dist\\a.js?url')).toBe(['C:', 'p', 'node_modules', '@zip.js', 'zip.js'].join(sep));
    expect(packageDirOf('/p/node_modules/a/node_modules/b/x.js')).toBe(['', 'p', 'node_modules', 'a', 'node_modules', 'b'].join(sep));
    expect(packageDirOf('/p/src/x.ts')).toBeNull();
  });
  it('licence, auteur et texte de LICENSE d’un vrai paquet ; NOTICE reproduit s’il existe', () => {
    const r = readThirdParty(join(ROOT, 'node_modules', 'react'))!;
    expect(r).toMatchObject({ name: 'react', license: 'MIT' });
    expect(r.licenseText).toMatch(/Permission is hereby granted/);
    const txt = thirdPartyText('Voltaplan', [r, { ...r, name: 'x', noticeText: 'NOTICE de x' }]);
    expect(txt).toContain('--- NOTICE ---\nNOTICE de x');
  });
});

describe('SBOM de l’application de bureau (Rust, Tauri)', () => {
  it('CycloneDX 1.5 depuis cargo metadata : dépendances résolues, licences en expressions SPDX, application à part', () => {
    const doc = cargoSbom(
      {
        packages: [
          { id: 'voltaplan 0.1.0', name: 'voltaplan', version: '0.1.0', license: 'AGPL-3.0-only' },
          { id: 'tauri 2.0.0', name: 'tauri', version: '2.0.0', license: 'Apache-2.0 OR MIT', repository: 'https://github.com/tauri-apps/tauri' },
          { id: 'serde 1.0.0', name: 'serde', version: '1.0.0', license: 'MIT/Apache-2.0' },
          { id: 'unused 1.0.0', name: 'unused', version: '1.0.0', license: 'MIT' },
        ],
        resolve: { root: 'voltaplan 0.1.0', nodes: [{ id: 'voltaplan 0.1.0' }, { id: 'tauri 2.0.0' }, { id: 'serde 1.0.0' }] },
        workspace_members: ['voltaplan 0.1.0'],
      },
      { serial: 'urn:uuid:00000000-0000-4000-8000-000000000000', timestamp: '2026-11-25T00:00:00Z', projectId: id.projectId },
    );
    expect(doc.metadata.component).toMatchObject({ name: 'voltaplan', purl: 'pkg:cargo/voltaplan@0.1.0' });
    expect(doc.components.map((c) => c.name)).toEqual(['serde', 'tauri']);
    expect(doc.components[0].licenses).toEqual([{ expression: 'MIT OR Apache-2.0' }]);
  });
});

describe('empreintes de versions historiques (commits existants, historique inchangé)', () => {
  it('commit courant : empreintes de sources et de similarité, sans intégrité ; dépôt non modifié', () => {
    let head: string;
    try {
      head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    } catch {
      return; // archive des sources : pas d'historique
    }
    const before = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
    const doc = fingerprintsSchema.parse(historicFingerprints(ROOT, 'HEAD', { bg: { strings: new Set(), shingles: new Set() }, files: 0 }, id.projectId));
    expect(doc.subject).toMatchObject({ commit: head, kind: 'source' });
    expect(doc.integrity).toBeNull();
    expect(doc.sources.files.length).toBeGreaterThan(10);
    expect(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })).toBe(before);
  });
  it('corpus de fond des dépendances : non vide', () => {
    expect(dependencyBackground(ROOT, 200_000).files).toBeGreaterThan(5);
  });
});

describe('aucun appel réseau ajouté', () => {
  it('modules de provenance de l’application : ni fetch, ni XHR, ni beacon, ni WebSocket', () => {
    for (const f of ['src/buildInfo.ts', 'src/ui/AboutDialog.tsx']) {
      expect(readFileSync(f, 'utf8')).not.toMatch(/\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|import\(\s*['"]https?:/);
    }
  });
  it('CSP : aucun hôte de suivi ou de signalement (voltaplan.org, GitHub Pages) autorisé en connexion', () => {
    expect(CONNECT_HOSTS.some((h) => /voltaplan|github\.io/.test(h))).toBe(false);
  });
});
