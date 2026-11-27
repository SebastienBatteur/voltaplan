// Plan du site (sitemap.xml) : une entrée par page indexable du site assemblé, avec ses versions dans les
// autres langues (hreflang) et la date de sa dernière modification dans git.
// Écrit par cli.ts : npm run site:sitemap -- <dossier du site assemblé> [dossier source pour les dates git]
// Pages exclues : noindex (redirections, 404) et l'application (app/), qui n'a pas de contenu sans JavaScript.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const BASE = 'https://voltaplan.org/';

export function htmlFiles(dir: string, root = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return relative(root, p) === 'app' || e.name.startsWith('.') ? [] : htmlFiles(p, root);
    return e.name.endsWith('.html') ? [relative(root, p).split(sep).join('/')] : [];
  });
}

function gitDate(file: string): string | null {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cs', '--', file], { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

export interface Entry {
  loc: string;
  alternates: { lang: string; href: string }[];
  lastmod: string | null;
}

export function entries(siteDir: string, srcDir?: string): Entry[] {
  return htmlFiles(siteDir)
    .sort()
    .flatMap((rel) => {
      const html = readFileSync(join(siteDir, rel), 'utf8');
      if (/<meta name="robots" content="[^"]*noindex/.test(html)) return [];
      const loc = BASE + rel.replace(/(^|\/)index\.html$/, '$1');
      const alternates = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map((m) => ({ lang: m[1], href: m[2] }));
      return [{ loc, alternates, lastmod: srcDir ? gitDate(join(srcDir, rel)) : null }];
    });
}

export function sitemap(list: Entry[]): string {
  const url = (e: Entry) =>
    `  <url>\n    <loc>${e.loc}</loc>\n` +
    (e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>\n` : '') +
    e.alternates.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.lang}" href="${a.href}"/>\n`).join('') +
    '  </url>\n';
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    list.map(url).join('') +
    '</urlset>\n'
  );
}
