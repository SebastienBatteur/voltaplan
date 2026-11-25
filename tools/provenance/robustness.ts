/**
 * Mesure de la robustesse des empreintes de similarité : transformations qu'un dérivé peut appliquer, et faux
 * positifs sur du code indépendant (bibliothèques utilisées par le projet ou non). Utilisé par les tests
 * (seuils minimaux) et par `npm run provenance -- eval` (tableau complet de docs/security/artifact-integrity.md).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { transformWithEsbuild } from 'vite';
import { COMPONENTS } from './components';
import { dependencyBackground } from './history';
import { componentPrint, indexTarget, score, transpile, type Background, type ComponentPrint } from './similarity';
import { dropStatements, renameProject, stripMetadata } from './transforms';

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

/** Code indépendant pour les faux positifs (chemins sous node_modules ; absents ignorés). */
export const INDEPENDENT: Record<string, string> = {
  'react-dom (same library)': 'react-dom/cjs/react-dom.production.min.js',
  'zod (same library)': 'zod/v4/core/schemas.js',
  'pdfjs-dist (same library)': 'pdfjs-dist/build/pdf.mjs',
  '@zip.js (same library)': '@zip.js/zip.js/dist/zip-core.js',
  'zustand (same library)': 'zustand/esm/vanilla.mjs',
  'typescript-estree': '@typescript-eslint/typescript-estree/dist/convert.js',
  'vite client': 'vite/dist/client/client.mjs',
  'eslint linter': 'eslint/lib/linter/linter.js',
  'jsdom window': 'jsdom/lib/jsdom/browser/Window.js',
  'fake-indexeddb': 'fake-indexeddb/build/esm/FDBDatabase.js',
};

export interface Row {
  variant: string;
  kind: 'transform' | 'false-positive';
  scores: Record<string, { strings: number; tokens: number }>;
}

export async function evaluate(root: string, opts: { components?: string[]; variants?: string[]; independent?: string[]; bg?: Background } = {}): Promise<{ prints: ComponentPrint[]; rows: Row[] }> {
  const bg = opts.bg ?? dependencyBackground(root).bg;
  const comps = COMPONENTS.filter((c) => !opts.components || opts.components.includes(c.name)).map((c) => ({
    c,
    mods: c.paths.flatMap((p) => walk(join(root, p))).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f)).map((f) => transpile(readFileSync(f, 'utf8').replace(/\r\n?/g, '\n'), f)),
  }));
  const prints = comps.map(({ c, mods }) => componentPrint(c.name, mods, bg));
  const all = comps.flatMap((x) => x.mods);
  const es = async (code: string, o: Record<string, unknown>) => (await transformWithEsbuild(code, 'x.js', { loader: 'js', ...o })).code;
  const lib = (p: string) => (existsSync(join(root, 'node_modules', p)) ? readFileSync(join(root, 'node_modules', p), 'utf8') : null);
  const minified = () => Promise.all(all.map((m) => es(m, { minify: true })));
  const distJs = () => {
    const d = join(root, 'dist', 'assets');
    return existsSync(d) ? readdirSync(d).filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(d, f), 'utf8')) : [];
  };
  const T: Record<string, () => Promise<string[]>> = {
    'vite production build (other minifier pipeline)': async () => distJs(),
    'esbuild full minification': minified,
    'variables renamed (minifyIdentifiers)': () => Promise.all(all.map((m) => es(m, { minifyIdentifiers: true }))),
    'comments and formatting (minifyWhitespace)': () => Promise.all(all.map((m) => es(m, { minifyWhitespace: true }))),
    'syntax rewritten (minifySyntax)': () => Promise.all(all.map((m) => es(m, { minifySyntax: true }))),
    'project renamed + minified': async () => (await minified()).map((c) => renameProject(c)),
    'metadata stripped (vite build)': async () => distJs().map(stripMetadata),
    '1/3 of statements removed + minified': () => Promise.all(all.map((m) => es(dropStatements(m, 3), { minify: true }))),
    '1/2 of statements removed + minified': () => Promise.all(all.map((m) => es(dropStatements(m, 2), { minify: true }))),
    'half of the modules only + minified': () => Promise.all(all.filter((_, i) => i % 2 === 0).map((m) => es(m, { minify: true }))),
    'embedded in a larger app (with libraries)': async () => [...(await minified()), ...Object.values(INDEPENDENT).map(lib).filter((x): x is string => !!x)],
  };
  const rows: Row[] = [];
  for (const [name, make] of Object.entries(T)) {
    if (opts.variants && !opts.variants.includes(name)) continue;
    const codes = await make();
    if (!codes.length) continue;
    const t = indexTarget(codes);
    rows.push({ variant: name, kind: 'transform', scores: Object.fromEntries(prints.map((p) => [p.name, score(p, t)])) });
  }
  for (const [name, path] of Object.entries(INDEPENDENT)) {
    if (opts.independent && !opts.independent.includes(name)) continue;
    const code = lib(path);
    if (!code) continue;
    const t = indexTarget([code]);
    rows.push({ variant: name, kind: 'false-positive', scores: Object.fromEntries(prints.map((p) => [p.name, score(p, t)])) });
  }
  return { prints, rows };
}

export function markdownTable(prints: ComponentPrint[], rows: Row[]): string {
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  const head = `| Cible | ${prints.map((p) => `${p.name} (chaînes / jetons)`).join(' | ')} |`;
  const sep = `|---|${prints.map(() => '---').join('|')}|`;
  const line = (r: Row) => `| ${r.kind === 'false-positive' ? '⊘ ' : ''}${r.variant} | ${prints.map((p) => `${pct(r.scores[p.name].strings)} / ${pct(r.scores[p.name].tokens)}`).join(' | ')} |`;
  return [head, sep, ...rows.map(line)].join('\n');
}
