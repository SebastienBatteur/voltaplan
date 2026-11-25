/**
 * fingerprints.json : intégrité exacte (SHA-256 des fichiers publiés), empreintes des sources caractéristiques et
 * empreintes de similarité des composants (voir similarity.ts). Les trois sont séparées : seule l'intégrité est une
 * vérification exacte ; la similarité n'est qu'un indice.
 *
 * Pas de dépendance circulaire : fingerprints.json et build-info.json ne sont ni dans la liste d'intégrité ni dans
 * le précache du service worker ; build-info.json référence fingerprints.json (empreinte), jamais l'inverse.
 */
import { createHash } from 'node:crypto';
import { COMPONENTS } from './components';
import type { EmbeddedBuild } from './identity';
import { SCHEMA_BASE } from './identity';
import type { FingerprintsDoc } from './schemas';
import { componentPrint, FP_ALGORITHM, SHINGLE, SKETCH_K, transpile, type Background } from './similarity';

/** Fichiers produits APRÈS la liste d'intégrité (ils la référencent) : jamais dedans. */
export const PROVENANCE_FILES = ['build-info.json', 'fingerprints.json'];
export const DISCLAIMER =
  'Similarity scores are indications of possible derivation, never proof of copying or of a license violation. ' +
  'They must be reviewed by a human, with the source code, before any conclusion.';

export const sha256hex = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
/** Texte normalisé (fins de ligne LF) : même empreinte de source sous Windows, macOS et Linux. */
export const lf = (s: string) => s.replace(/\r\n?/g, '\n');

export interface FileEntry {
  path: string;
  content: string | Uint8Array;
}

export function integrityList(files: FileEntry[]) {
  return files
    .map((f) => ({ path: f.path.replace(/\\/g, '/').replace(/^\.?\//, ''), content: f.content }))
    .filter((f) => !PROVENANCE_FILES.includes(f.path) && !f.path.endsWith('.map'))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map((f) => ({ path: f.path, sha256: sha256hex(f.content), size: typeof f.content === 'string' ? Buffer.byteLength(f.content) : f.content.length }));
}

/** Identifiant de compilation adressé par le contenu : même fichiers publiés, même identifiant. */
export function buildIdOf(list: { path: string; sha256: string }[]): string {
  return 'sha256:' + sha256hex(list.map((f) => `${f.sha256}  ${f.path}`).join('\n'));
}

/** Fichiers source des composants caractéristiques (chemin relatif à la racine, séparateur « / »). */
export function componentSources(all: FileEntry[]): Map<string, FileEntry[]> {
  const m = new Map<string, FileEntry[]>();
  for (const c of COMPONENTS) m.set(c.name, all.filter((f) => /\.tsx?$/.test(f.path) && !/\.test\.tsx?$/.test(f.path) && c.paths.some((p) => f.path.startsWith(p))));
  return m;
}

export function fingerprintsDoc(opts: {
  build: Pick<EmbeddedBuild, 'projectId' | 'name' | 'version' | 'commit'>;
  kind: 'build' | 'source';
  dist: FileEntry[] | null;
  sources: FileEntry[];
  background: Background;
  backgroundMethod: string;
}): FingerprintsDoc {
  const bySrc = componentSources(opts.sources);
  const srcFiles = [...new Set([...bySrc.values()].flat())].sort((a, b) => (a.path < b.path ? -1 : 1));
  return {
    $schema: SCHEMA_BASE + 'fingerprints-1.0.schema.json',
    schemaVersion: '1.0',
    project: { id: opts.build.projectId, name: opts.build.name },
    subject: { version: opts.build.version, commit: opts.build.commit, kind: opts.kind },
    integrity: opts.dist
      ? { algorithm: 'sha256', note: 'Exact hashes of every published file, except build-info.json and fingerprints.json (which reference this list).', files: integrityList(opts.dist) }
      : null,
    sources: { algorithm: 'sha256', files: srcFiles.map((f) => ({ path: f.path, sha256: sha256hex(lf(String(f.content))) })) },
    similarity: {
      algorithm: FP_ALGORITHM,
      shingle: SHINGLE,
      sketch: SKETCH_K,
      background: opts.backgroundMethod,
      disclaimer: DISCLAIMER,
      components: COMPONENTS.map((c) => {
        const files = bySrc.get(c.name) ?? [];
        const p = componentPrint(c.name, files.map((f) => transpile(lf(String(f.content)), f.path)), opts.background);
        return { name: c.name, description: c.description, paths: c.paths, strings: p.strings, tokens: p.tokens, counts: p.counts };
      }),
    },
  };
}
