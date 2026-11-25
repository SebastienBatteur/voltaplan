/**
 * Identité du projet et métadonnées de compilation (provenance déclarative, jamais authentifiée).
 *
 * Trois identités distinctes :
 *  - PROJET (permanent) : `urn:uuid:` de codemeta.json, indépendant du nom, du dépôt et du domaine ; un fork qui
 *    garde la filiation garde `upstream.id` ;
 *  - DÉPÔT (variable) : adresse du dépôt qui a servi à cette compilation, et son commit ;
 *  - COMPILATION : empreinte du contenu publié (`build.id`, calculé après coup dans build-info.json).
 * Aucun identifiant par installation ni par utilisateur.
 *
 * Fonctions pures (entrées injectées) : testées sans Git ni GitHub Actions. Lecture réelle : readGit / process.env.
 * Variables pour un fork ou une archive des sources (toutes facultatives) :
 *   OSP_REPOSITORY_URL  dépôt de cette version (sinon : GitHub Actions, puis `git remote origin`) ;
 *   OSP_SOURCE_URL      code source correspondant, si ailleurs que `<dépôt>/tree/<commit>` ;
 *   OSP_COMMIT          commit, quand il n'y a pas de dossier .git (archive des sources) ;
 *   OSP_PROJECT_ID      identifiant d'un projet dérivé qui prend sa propre identité (upstream.id est gardé).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const SCHEMA_VERSION = '1.0';
export const SCHEMA_BASE = 'https://voltaplan.org/schemas/oss-provenance/';
export const LICENSE_URLS: Record<string, string> = {
  'AGPL-3.0-only': 'https://www.gnu.org/licenses/agpl-3.0.html',
  'AGPL-3.0-or-later': 'https://www.gnu.org/licenses/agpl-3.0.html',
};

export interface CodeMeta {
  identifier: string | string[];
  name: string;
  license: string;
  codeRepository: string;
  url?: string;
  copyrightHolder?: { name: string };
  copyrightYear?: number;
  /** schema.org copyrightNotice : mention générale, recopiée telle quelle. */
  copyrightNotice?: string;
}

export interface GitInfo {
  commit: string | null;
  commitDate: string | null;
  dirty: boolean | null;
  remote: string | null;
}

export interface Identity {
  projectId: string;
  aliases: string[];
  name: string;
  homepage: string | null;
  upstreamId: string;
  upstreamRepository: string;
  spdx: string;
  licenseUrl: string;
  copyright: string;
}

/** Valeurs intégrées dans l'application (« À propos ») : stables pour un même commit, sans date de compilation. */
export interface EmbeddedBuild {
  projectId: string;
  upstreamId: string;
  name: string;
  version: string;
  commit: string | null;
  commitDate: string | null;
  dirty: boolean | null;
  /** clean : commit connu, arbre vérifié sans modification ; modified : modifications non commitées ; declared : commit
   *  déclaré sans dépôt Git (archive, OSP_COMMIT) : absence de modification invérifiable ; unknown : commit inconnu. */
  status: 'clean' | 'modified' | 'declared' | 'unknown';
  /** Dépôt différent du dépôt d'origine (fork) ou identité de projet propre. */
  derived: boolean;
  repository: string | null;
  upstreamRepository: string;
  correspondingSource: string | null;
  sourceDeclared: boolean;
  spdx: string;
  licenseUrl: string;
  copyright: string;
  homepage: string | null;
  environment: 'ci' | 'local';
}

export interface BuildInfo {
  $schema: string;
  schemaVersion: string;
  project: { id: string; aliases: string[]; name: string; homepage: string | null; metadata: string };
  upstream: { id: string; repository: string };
  repository: { url: string | null; commit: string | null; commitDate: string | null; dirty: boolean | null };
  build: {
    id: string | null;
    version: string;
    timestamp: string;
    environment: 'ci' | 'local';
    ci: { provider: string; workflow: string | null; runId: string | null; runAttempt: string | null; runUrl: string | null } | null;
    status: EmbeddedBuild['status'];
    derived: boolean;
  };
  license: { spdx: string; url: string; copyright: string };
  source: { correspondingSource: string | null; archive: string | null; declared: boolean };
  artifacts: Record<string, { path: string; sha256: string }>;
  verification: { authenticated: false; note: string; attestations: string | null };
}

/** Adresse de dépôt publiable : https seulement, sans identifiants, requête ni « .git ». Sinon null (chemin local…). */
export function sanitizeRepoUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();
  const ssh = /^git@([\w.-]+):([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(s);
  if (ssh) s = `https://${ssh[1]}/${ssh[2]}`;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || !u.hostname.includes('.')) return null;
  const path = u.pathname.replace(/\.git$/, '').replace(/\/+$/, '');
  if (!/^\/[\w.-]+\/[\w.-]+(\/[\w.-]+)*$/.test(path)) return null;
  return `https://${u.hostname.toLowerCase()}${path}`;
}

const sameRepo = (a: string | null, b: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

export function readCodeMeta(root = process.cwd()): CodeMeta {
  return JSON.parse(readFileSync(resolve(root, 'codemeta.json'), 'utf8')) as CodeMeta;
}

export function identityOf(cm: CodeMeta, env: Record<string, string | undefined> = {}): Identity {
  const ids = Array.isArray(cm.identifier) ? cm.identifier : [cm.identifier];
  const upstreamId = ids.find((i) => i.startsWith('urn:uuid:'));
  if (!upstreamId) throw new Error('codemeta.json : identifiant urn:uuid: absent');
  const spdx = cm.license.replace(/^https?:\/\/spdx\.org\/licenses\//, '');
  const projectId = env.OSP_PROJECT_ID?.trim() || upstreamId;
  return {
    projectId,
    aliases: ids.filter((i) => i !== upstreamId),
    name: cm.name,
    homepage: cm.url ?? null,
    upstreamId,
    upstreamRepository: sanitizeRepoUrl(cm.codeRepository)!,
    spdx,
    licenseUrl: LICENSE_URLS[spdx] ?? cm.license,
    copyright: cm.copyrightNotice ?? `Copyright (C) ${cm.copyrightYear ?? ''} ${cm.copyrightHolder?.name ?? cm.name}`.replace(/\s+/g, ' '),
  };
}

/** Lecture Git réelle ; null partout sans dépôt (archive des sources) ou sans Git installé. */
export function readGit(root = process.cwd()): GitInfo {
  const git = (...args: string[]) => {
    try {
      return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      return null;
    }
  };
  const commit = git('rev-parse', 'HEAD');
  if (!commit || !/^[0-9a-f]{40}$/.test(commit)) return { commit: null, commitDate: null, dirty: null, remote: null };
  const status = git('status', '--porcelain', '--untracked-files=no');
  return { commit, commitDate: git('log', '-1', '--format=%cI'), dirty: status === null ? null : status.length > 0, remote: git('remote', 'get-url', 'origin') };
}

/** Valeurs intégrées à partir de l'identité, de Git et de l'environnement (CI, fork, archive). */
export function embeddedBuild(id: Identity, version: string, git: GitInfo, env: Record<string, string | undefined>): EmbeddedBuild {
  const gha = env.GITHUB_ACTIONS === 'true';
  const commit = (gha && env.GITHUB_SHA) || git.commit || (env.OSP_COMMIT && /^[0-9a-f]{40}$/.test(env.OSP_COMMIT) ? env.OSP_COMMIT : null);
  const repository =
    sanitizeRepoUrl(env.OSP_REPOSITORY_URL) ?? (gha && env.GITHUB_REPOSITORY ? sanitizeRepoUrl(`${env.GITHUB_SERVER_URL ?? 'https://github.com'}/${env.GITHUB_REPOSITORY}`) : null) ?? sanitizeRepoUrl(git.remote);
  const declared = sanitizeSourceUrl(env.OSP_SOURCE_URL);
  const correspondingSource = declared ?? (repository && commit ? `${repository}/tree/${commit}` : null);
  const dirty = git.commit ? git.dirty : null;
  const status: EmbeddedBuild['status'] = !commit ? 'unknown' : dirty === null ? 'declared' : dirty ? 'modified' : 'clean';
  return {
    projectId: id.projectId,
    upstreamId: id.upstreamId,
    name: id.name,
    version,
    commit,
    commitDate: git.commitDate,
    dirty,
    status,
    derived: id.projectId !== id.upstreamId || (repository !== null && !sameRepo(repository, id.upstreamRepository)),
    repository,
    upstreamRepository: id.upstreamRepository,
    correspondingSource,
    sourceDeclared: declared !== null,
    spdx: id.spdx,
    licenseUrl: id.licenseUrl,
    copyright: id.copyright,
    homepage: id.homepage,
    environment: gha || env.CI === 'true' ? 'ci' : 'local',
  };
}

/** URL déclarée du code source : http(s) seulement, sans identifiants. */
export function sanitizeSourceUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    u.username = '';
    u.password = '';
    return u.href;
  } catch {
    return null;
  }
}

/** build-info.json complet (après la compilation : empreintes connues). */
export function buildInfo(e: EmbeddedBuild, id: Identity, env: Record<string, string | undefined>, extra: { timestamp: string; buildId: string | null; artifacts: BuildInfo['artifacts'] }): BuildInfo {
  const gha = env.GITHUB_ACTIONS === 'true';
  const runUrl = gha && env.GITHUB_RUN_ID && e.repository ? `${e.repository}/actions/runs/${env.GITHUB_RUN_ID}` : null;
  const github = e.repository?.startsWith('https://github.com/') ?? false;
  return {
    $schema: SCHEMA_BASE + 'build-info-1.0.schema.json',
    schemaVersion: SCHEMA_VERSION,
    project: { id: e.projectId, aliases: id.aliases, name: e.name, homepage: e.homepage, metadata: 'codemeta.json' },
    upstream: { id: e.upstreamId, repository: e.upstreamRepository },
    repository: { url: e.repository, commit: e.commit, commitDate: e.commitDate, dirty: e.dirty },
    build: {
      id: extra.buildId,
      version: e.version,
      timestamp: extra.timestamp,
      environment: e.environment,
      ci: gha
        ? { provider: 'github-actions', workflow: env.GITHUB_WORKFLOW_REF ?? env.GITHUB_WORKFLOW ?? null, runId: env.GITHUB_RUN_ID ?? null, runAttempt: env.GITHUB_RUN_ATTEMPT ?? null, runUrl }
        : e.environment === 'ci'
          ? { provider: 'unknown', workflow: null, runId: null, runAttempt: null, runUrl: null }
          : null,
      status: e.status,
      derived: e.derived,
    },
    license: { spdx: e.spdx, url: e.licenseUrl, copyright: e.copyright },
    source: { correspondingSource: e.correspondingSource, archive: github && e.commit && !e.sourceDeclared ? `${e.repository}/archive/${e.commit}.tar.gz` : null, declared: e.sourceDeclared },
    artifacts: extra.artifacts,
    verification: {
      authenticated: false,
      note: 'Declarative metadata: anyone can copy them. Only a provenance attestation or a signature verifies an official artifact.',
      attestations: github && e.repository ? `${e.repository}/attestations` : null,
    },
  };
}

/**
 * Bandeau légal de chaque fichier JavaScript : stable entre deux commits (ni commit ni date). Un fichier fait
 * uniquement de code tiers ne reçoit PAS la licence du projet (mention qui serait fausse) : seulement un renvoi.
 */
export function legalBanner(e: EmbeddedBuild, thirdPartyOnly = false): string {
  if (thirdPartyOnly)
    return [`/*! Third-party code bundled with ${e.name} ${e.version} (Project-ID: ${e.projectId}).`, ` * Licenses and notices: THIRD-PARTY-LICENSES.txt`, ` */`].join('\n');
  return [
    `/*! ${e.name} ${e.version}`,
    ` * Project-ID: ${e.projectId}`,
    ` * SPDX-License-Identifier: ${e.spdx}`,
    ` * ${e.copyright}`,
    ` * Source: ${e.repository ?? e.upstreamRepository}`,
    ` * Third-party code in this file keeps its own license: THIRD-PARTY-LICENSES.txt`,
    ` */`,
  ].join('\n');
}
