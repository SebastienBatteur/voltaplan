// Site public (site/) : bases du référencement vérifiées à chaque modification.
// Titres et descriptions uniques, un seul H1, adresse canonique, versions linguistiques réciproques,
// Open Graph, plan du site, robots.txt, page 404, liens internes et ancres, pas de redirection de langue.
import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { BASE, entries, htmlFiles } from '../tools/site/sitemap';

const SITE = join(__dirname, '..', 'site');
const read = (rel: string) => readFileSync(join(SITE, rel), 'utf8');
const pages = htmlFiles(SITE).map((rel) => ({ rel, html: read(rel) }));
const indexable = pages.filter((p) => !/<meta name="robots" content="[^"]*noindex/.test(p.html));
const one = (html: string, re: RegExp) => re.exec(html)?.[1] ?? null;
const urlOf = (rel: string) => BASE + rel.replace(/(^|\/)index\.html$/, '$1');

describe('site public : référencement', () => {
  it('a les 20 pages indexables attendues (5 pages × 4 langues)', () => {
    expect(indexable.length).toBe(20);
  });

  it.each(indexable.map((p) => [p.rel, p.html]))('%s : titre, description, H1, canonical, hreflang, Open Graph', (rel, html) => {
    const title = one(html, /<title>([^<]*)<\/title>/);
    expect(title && title.length >= 10 && title.length <= 70, `titre : ${title}`).toBe(true);
    const desc = one(html, /<meta name="description" content="([^"]*)">/);
    expect(desc && desc.length >= 70 && desc.length <= 160, `description (${desc?.length}) : ${desc}`).toBe(true);
    expect(html.match(/<h1[\s>]/g)?.length, 'un seul H1').toBe(1);
    expect(one(html, /<link rel="canonical" href="([^"]*)">/)).toBe(urlOf(rel));
    const alt = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map((m) => m[1]);
    expect(alt.sort()).toEqual(['de', 'en', 'fr', 'nl', 'x-default']);
    expect(html).toContain(`hreflang="${one(html, /<html lang="([^"]+)"/)}" href="${urlOf(rel)}"`);
    expect(one(html, /<meta property="og:title" content="([^"]*)">/)).toBe(title!.replace(/"/g, '&quot;'));
    expect(one(html, /<meta property="og:url" content="([^"]*)">/)).toBe(urlOf(rel));
  });

  it('titres et descriptions sont uniques', () => {
    for (const re of [/<title>([^<]*)<\/title>/, /<meta name="description" content="([^"]*)">/]) {
      const values = indexable.map((p) => one(p.html, re));
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it('les versions linguistiques se citent mutuellement', () => {
    const byUrl = new Map(indexable.map((p) => [urlOf(p.rel), p.html]));
    for (const p of indexable)
      for (const m of p.html.matchAll(/<link rel="alternate" hreflang="[^"]+" href="([^"]+)">/g)) {
        expect(byUrl.has(m[1]), `${p.rel} → ${m[1]}`).toBe(true);
        expect(byUrl.get(m[1])).toContain(`href="${urlOf(p.rel)}"`);
      }
  });

  it('accueils : données structurées valides et factuelles', () => {
    for (const rel of ['index.html', 'nl/index.html', 'en/index.html', 'de/index.html']) {
      const ld = JSON.parse(one(read(rel), /<script type="application\/ld\+json">([^<]*)<\/script>/)!);
      expect(ld['@type']).toBe('SoftwareApplication');
      expect(ld.url).toBe(urlOf(rel));
      expect(ld.offers.price).toBe('0');
      // Pas de note ni d'avis inventés
      expect(ld.aggregateRating).toBeUndefined();
      expect(ld.review).toBeUndefined();
    }
  });

  it('aucune redirection automatique selon la langue du navigateur', () => {
    expect(read('site.js')).not.toMatch(/location\.(replace|assign)\(|location\.href\s*=/);
    for (const p of pages.filter((x) => x.html.includes('http-equiv="refresh"')))
      expect(p.html, `${p.rel} : redirection non indexée`).toMatch(/<meta name="robots" content="noindex">/);
  });

  it('robots.txt autorise tout et donne le plan du site', () => {
    const robots = read('robots.txt');
    expect(robots).toMatch(/^User-agent: \*\nAllow: \/$/m);
    expect(robots).not.toMatch(/^Disallow: \/\s*$/m);
    expect(robots).toContain(`Sitemap: ${BASE}sitemap.xml`);
  });

  it('le plan du site liste exactement les pages indexables', () => {
    const locs = entries(SITE).map((e) => e.loc).sort();
    expect(locs).toEqual(indexable.map((p) => urlOf(p.rel)).sort());
  });

  it('page 404 : non indexée, chemins absolus vers des fichiers existants', () => {
    const html = read('404.html');
    expect(html).toContain('<meta name="robots" content="noindex">');
    for (const m of html.matchAll(/(?:href|src)="(\/[^"#]*)"/g)) {
      if (m[1].startsWith('/app/')) continue; // application ajoutée à la publication
      const p = m[1].endsWith('/') ? m[1] + 'index.html' : m[1];
      expect(existsSync(join(SITE, p)), m[1]).toBe(true);
    }
  });

  it('liens internes et ancres valides', () => {
    const errors: string[] = [];
    for (const p of pages) {
      if (p.rel === '404.html') continue;
      for (const m of p.html.matchAll(/<a [^>]*href="([^"]+)"/g)) {
        const href = m[1];
        if (/^(https?:|mailto:)/.test(href) || href === '#' || /(^|\/)app\/(\?|$)/.test(href)) continue;
        const [path, frag] = href.split('#');
        let target = path ? posix.normalize(posix.join(posix.dirname(p.rel), path)) : p.rel;
        if (target === '.' || path.endsWith('/')) target = posix.join(target, 'index.html');
        if (!existsSync(join(SITE, target))) {
          errors.push(`${p.rel} → ${href}`);
          continue;
        }
        if (frag && target.endsWith('.html') && !read(target).includes(`id="${frag}"`)) errors.push(`${p.rel} → ${href} (ancre)`);
      }
    }
    expect(errors).toEqual([]);
  });
});
