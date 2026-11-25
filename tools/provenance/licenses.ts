/**
 * THIRD-PARTY-LICENSES.txt : paquets réellement inclus dans les fichiers distribués (graphe des modules de la
 * compilation), avec leur licence, leur auteur, le texte de leur LICENSE et leur NOTICE (Apache-2.0) s'il existe.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';

export interface ThirdParty {
  name: string;
  version: string;
  license: string;
  author: string | null;
  homepage: string | null;
  licenseText: string | null;
  noticeText: string | null;
}

/** Dossier du paquet d'un module de node_modules (paquets à portée « @x/y » et imbriqués compris). */
export function packageDirOf(moduleId: string): string | null {
  const id = moduleId.replace(/^\0/, '').split('?')[0];
  const parts = id.split(/[\\/]/);
  const i = parts.lastIndexOf('node_modules');
  if (i < 0 || i + 1 >= parts.length) return null;
  const n = parts[i + 1].startsWith('@') ? 2 : 1;
  return parts.slice(0, i + 1 + n).join(sep);
}

const firstFile = (dir: string, re: RegExp) => {
  try {
    const f = readdirSync(dir).find((x) => re.test(x));
    return f ? readFileSync(join(dir, f), 'utf8').trim() : null;
  } catch {
    return null;
  }
};

export function readThirdParty(dir: string): ThirdParty | null {
  const pj = join(dir, 'package.json');
  if (!existsSync(pj)) return null;
  const p = JSON.parse(readFileSync(pj, 'utf8')) as { name: string; version: string; license?: string | { type: string }; author?: string | { name: string }; homepage?: string };
  const license = typeof p.license === 'string' ? p.license : (p.license?.type ?? 'UNKNOWN');
  const author = typeof p.author === 'string' ? p.author : (p.author?.name ?? null);
  return {
    name: p.name,
    version: p.version,
    license,
    author,
    homepage: p.homepage ?? null,
    licenseText: firstFile(dir, /^(LICEN[CS]E|COPYING)(\.(md|txt))?$/i),
    noticeText: firstFile(dir, /^NOTICE(\.(md|txt))?$/i),
  };
}

/** Paquets distincts des modules donnés, triés par nom. */
export function collectThirdParty(moduleIds: Iterable<string>): ThirdParty[] {
  const dirs = new Set<string>();
  for (const id of moduleIds) {
    const d = packageDirOf(id);
    if (d) dirs.add(d);
  }
  const out = new Map<string, ThirdParty>();
  for (const d of dirs) {
    const t = readThirdParty(d);
    if (t) out.set(`${t.name}@${t.version}`, t);
  }
  return [...out.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

export function thirdPartyText(projectName: string, list: ThirdParty[]): string {
  const head = [
    `${projectName} — third-party software included in this build`,
    `${list.length} packages. Each keeps its own license and copyright notices, reproduced below.`,
    'Generated at build time from the modules actually bundled (tools/provenance/licenses.ts).',
    '',
  ];
  const body = list.map((t) =>
    [
      '='.repeat(78),
      `${t.name} ${t.version}`,
      `License: ${t.license}`,
      ...(t.author ? [`Author: ${t.author}`] : []),
      ...(t.homepage ? [`Homepage: ${t.homepage}`] : []),
      '-'.repeat(78),
      t.licenseText ?? '(no license file in the package: see its package.json license field)',
      ...(t.noticeText ? ['', '--- NOTICE ---', t.noticeText] : []),
      '',
    ].join('\n'),
  );
  return [...head, ...body].join('\n');
}
