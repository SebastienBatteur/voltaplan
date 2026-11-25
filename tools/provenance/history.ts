/**
 * Empreintes d'un commit existant (versions historiques), sans toucher à l'historique : les fichiers sont lus avec
 * `git show <commit>:<chemin>`, rien n'est extrait ni modifié. Seules les empreintes de SOURCE et de similarité sont
 * produites (pas d'intégrité : les fichiers publiés de l'époque ne sont pas reconstruits).
 * Corpus de fond : fichiers JavaScript des dépendances de production installées (node_modules actuel).
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { COMPONENTS } from './components';
import { fingerprintsDoc, type FileEntry } from './fingerprints';
import type { FingerprintsDoc } from './schemas';
import { background, type Background } from './similarity';

const git = (root: string, ...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });

/** Fichiers JavaScript des dépendances de production (au plus `capPerPackage` octets par paquet). */
export function dependencyBackground(root: string, capPerPackage = 4 * 1024 * 1024): { bg: Background; files: number } {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> };
  const codes: string[] = [];
  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    const dir = join(root, 'node_modules', dep);
    let used = 0;
    const walk = (d: string): void => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (used >= capPerPackage) return;
        const p = join(d, e.name);
        if (e.isDirectory()) {
          if (!/^(node_modules|test|tests|legacy|types|web|image_decoders)$/.test(e.name)) walk(p);
        } else if (/\.(c|m)?js$/.test(e.name) && !e.name.endsWith('.d.ts')) {
          const size = statSync(p).size;
          if (used + size > capPerPackage) continue;
          used += size;
          codes.push(readFileSync(p, 'utf8'));
        }
      }
    };
    try {
      walk(dir);
    } catch {
      /* dépendance absente */
    }
  }
  return { bg: background(codes), files: codes.length };
}

export function historicFingerprints(root: string, ref: string, bg: { bg: Background; files: number }, projectId: string): FingerprintsDoc {
  const commit = git(root, 'rev-parse', `${ref}^{commit}`).trim();
  const prefixes = [...new Set(COMPONENTS.flatMap((c) => c.paths))];
  const paths = git(root, 'ls-tree', '-r', '--name-only', commit, '--', ...prefixes)
    .split('\n')
    .filter((p) => /\.tsx?$/.test(p));
  const sources: FileEntry[] = paths.map((p) => ({ path: p, content: git(root, 'show', `${commit}:${p}`) }));
  let version = '0.0.0';
  let name = 'Voltaplan';
  try {
    const pj = JSON.parse(git(root, 'show', `${commit}:package.json`)) as { version: string };
    version = pj.version;
    const cm = JSON.parse(git(root, 'show', `${commit}:codemeta.json`)) as { name: string };
    name = cm.name;
  } catch {
    /* commit antérieur à codemeta.json : identité actuelle */
  }
  return fingerprintsDoc({
    build: { projectId, name, version, commit },
    kind: 'source',
    dist: null,
    sources,
    background: bg.bg,
    backgroundMethod: `JavaScript files of the installed production dependencies (${bg.files} files), not the historical build`,
  });
}
