/**
 * Section « Apprendre l'électricité » du site : pages produites à partir des sources de learn/ (articles, rubriques,
 * lexique) et des exercices de tools/learn/exercices/. Le schéma unifilaire de chaque exercice est dessiné par le
 * moteur de Voltaplan lui-même (src/unifilar), comme dans l'application.
 *
 *   npm run learn:build   → site/apprendre/*.html (pages versionnées ; test/learn.test.ts vérifie qu'elles sont à jour)
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { layoutUnifilar } from '../../src/unifilar/layout';
import { Symbol } from '../../src/unifilar/symbols';
import { computeNumbering, createNode, emptyProject } from '../../src/model/tree';
import { makeLabelFn } from '../../src/ui/labels';
import { translate } from '../../src/i18n';
import type { ElNode } from '../../src/model/types';
import type { ArticleMeta, ExerciseModule, LexEntry, MakeNode, Rubrique } from './types';
import { TRANSPARENCY_FILE, transparencyBody } from './transparency';

export const BASE = 'https://voltaplan.org/apprendre/';
const LANG = 'fr';

export interface Article extends ArticleMeta {
  slug: string;
  body: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/**
 * Retire les balises d'un texte. Répété jusqu'à ce que rien ne change : un retrait en une passe laisserait une balise
 * reconstituée (« <scr<b>ipt> » donne « <script> »). Un « < » resté seul est ensuite échappé par esc() là où il sort.
 */
export function stripTags(s: string): string {
  let prev: string;
  do {
    prev = s;
    s = s.replace(/<[^>]*>/g, '');
  } while (s !== prev);
  return s;
}
/** Texte d'un champ qui peut contenir du HTML simple (liens, <strong>) : retiré pour les attributs et les données. */
const plain = (s: string) => stripTags(s).replace(/&nbsp;/g, ' ');

export function readArticles(root: string): Article[] {
  const dir = join(root, 'learn', LANG);
  return readdirSync(dir)
    .filter((f) => f.endsWith('.html'))
    .map((f) => {
      const src = readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n');
      const m = /^<!--\s*(\{[\s\S]*?\})\s*-->\n?/.exec(src);
      if (!m) throw new Error(`learn/${LANG}/${f} : en-tête JSON absent`);
      let meta: ArticleMeta;
      try {
        meta = JSON.parse(m[1]);
      } catch (e) {
        throw new Error(`learn/${LANG}/${f} : en-tête JSON invalide (${(e as Error).message})`, { cause: e });
      }
      return { ...meta, slug: f.replace(/\.html$/, ''), body: src.slice(m[0].length).trim() };
    });
}

export const readRubriques = (root: string): Rubrique[] => JSON.parse(readFileSync(join(root, 'learn', LANG, 'rubriques.json'), 'utf8'));
export const readLexique = (root: string): LexEntry[] => JSON.parse(readFileSync(join(root, 'learn', LANG, 'lexique.json'), 'utf8'));

export async function readExercises(root: string): Promise<Map<string, ExerciseModule>> {
  const dir = join(root, 'tools', 'learn', 'exercices');
  const out = new Map<string, ExerciseModule>();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts')).sort()) {
    const mod = (await import(/* @vite-ignore */ './exercices/' + f)) as ExerciseModule;
    out.set(mod.exercise.id, mod);
  }
  return out;
}

/** Schéma unifilaire d'un exercice (SVG statique, mêmes symboles et même mise en page que l'application). */
export function unifilarSvg(mod: ExerciseModule): string {
  let n = 0;
  const node: MakeNode = (kind, props = {}, children = []) => {
    const x = createNode(kind, props);
    x.id = 'u' + ++n; // identifiants stables : pages identiques d'une construction à l'autre
    x.children = children;
    return x;
  };
  const roots: ElNode[] = mod.unifilar(node);
  const project = emptyProject();
  project.roots = roots;
  const t = (k: string) => translate(LANG, k);
  const labelFn = makeLabelFn(project, computeNumbering(roots), LANG, t);
  const lay = layoutUnifilar(roots, labelFn, { up: true });
  const pad = 12;
  const svg = (
    <svg
      className="uni"
      viewBox={`${-pad} ${-pad} ${lay.w + 2 * pad} ${lay.h + 2 * pad}`}
      width={Math.round((lay.w + 2 * pad) * 2)}
      role="img"
      aria-label={plain(mod.unifilarCaption)}
    >
      {lay.prims.map((p, i) => {
        switch (p.t) {
          case 'line':
            return <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} className="wire" style={p.w ? { strokeWidth: p.w } : undefined} />;
          case 'bus':
            return <line key={i} x1={p.x1} y1={p.y} x2={p.x2} y2={p.y} className="bus" />;
          case 'text':
            return (
              <text key={i} x={p.x} y={p.y} fontSize={p.size ?? 10} textAnchor={p.anchor ?? 'start'} className={(p.bold ? 'bold ' : '') + (p.muted ? 'muted' : '')}>
                {p.text}
              </text>
            );
          case 'sym':
            return (
              <g key={i} transform={`translate(${p.x},${p.y})`} className="sym">
                <Symbol node={p.node} orient={p.orient} up={p.up} />
              </g>
            );
        }
      })}
    </svg>
  );
  return renderToStaticMarkup(svg);
}

// ——— Gabarit des pages ———

const SPONSOR_ICON =
  '<svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M8 14.25.345 6.595a4.25 4.25 0 0 1 6.01-6.01L8 2.23l1.645-1.645a4.25 4.25 0 0 1 6.01 6.01Z"/></svg>';
const GLOBE =
  '<svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><path fill="none" stroke="currentColor" stroke-width="1.3" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm-6.5 6.5h13M8 1.5c-1.8 1.8-2.7 4-2.7 6.5s.9 4.7 2.7 6.5c1.8-1.8 2.7-4 2.7-6.5S9.8 3.3 8 1.5Z"/></svg>';

function page(o: { file: string; title: string; description: string; body: string; ld: object[]; scripts?: string[]; type?: string }): string {
  const url = BASE + (o.file === 'index.html' ? '' : o.file);
  const ld = o.ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, '\\u003c')}</script>`).join('\n');
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- Page produite par tools/learn/build.tsx à partir de learn/ : modifier la source, puis npm run learn:build -->
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${url}">
${ld}
<meta property="og:type" content="${o.type ?? 'website'}">
<meta property="og:site_name" content="Voltaplan">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="fr_BE">
<meta name="twitter:card" content="summary">
<link rel="icon" href="../icon.svg">
<link rel="stylesheet" href="../style.css">
</head>
<body>
<header class="top"><div class="in">
  <a class="brand" href="../"><img src="../icon.svg" alt="">Voltaplan</a>
  <nav class="links">
    <a href="../guide.html">Guide</a>
    <a href="./"${o.file === 'index.html' ? ' aria-current="page"' : ''}>Apprendre</a>
    <a href="../faq.html">FAQ</a>
    <a class="repo-link" href="#">Code source</a>
    <a class="btn sponsor" href="https://github.com/sponsors/SebastienBatteur" title="Soutenir Voltaplan sur GitHub Sponsors (facultatif)">${SPONSOR_ICON}<span>Soutenir</span></a>
    <a class="btn primary" href="../app/">Ouvrir l'application</a>
    <details class="lang"><summary aria-label="Langue : Français">${GLOBE}FR</summary><div class="lang-menu"><a href="./" aria-current="true" lang="fr">Français</a><a href="../nl/" lang="nl" hreflang="nl" title="Deze rubriek bestaat alleen in het Frans">Nederlands</a><a href="../en/" lang="en" hreflang="en" title="This section is only available in French">English</a><a href="../de/" lang="de" hreflang="de" title="Diese Rubrik gibt es nur auf Französisch">Deutsch</a></div></details>
  </nav>
</div></header>
${o.body}
<footer>Voltaplan — gratuit et open source — <a href="./">Apprendre l'électricité</a> — <a href="lexique.html">Lexique</a> — <a href="regles-rgie.html">Ce que Voltaplan vérifie du RGIE</a> — <a href="../faq.html">FAQ</a> — <a href="../privacy.html">Confidentialité</a> — <a href="../terms.html">Conditions d'utilisation</a> — licence <a href="https://www.gnu.org/licenses/agpl-3.0.html">GNU AGPL v3</a> — <a class="repo-link" href="https://github.com/SebastienBatteur/voltaplan">code source</a></footer>
<script src="../site.js"></script>
${(o.scripts ?? []).map((s) => `<script src="${s}"></script>`).join('\n')}
</body>
</html>
`;
}

const PUBLISHER = { '@type': 'Organization', name: 'Voltaplan', url: 'https://voltaplan.org/' };
const crumbs = (items: { name: string; url: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, item: x.url })),
});
const DISCLAIMER =
  '<p class="note learn-note">Ces pages expliquent les principes. Elles ne remplacent ni le texte officiel du RGIE ni un électricien qualifié, et un exercice réussi n’est pas un contrôle de conformité. Avant toute intervention : coupez le circuit au tableau, empêchez qu’on le remette en service pendant le travail, et vérifiez l’absence de tension avec un appareil adapté. Une installation neuve, ainsi que toute modification ou extension importante (un circuit ajouté, par exemple), est contrôlée par un organisme agréé avant sa mise en usage.</p>';

function articlePage(a: Article, all: Article[], rubs: Rubrique[], ex: Map<string, ExerciseModule>): string {
  const rub = rubs.find((r) => r.id === a.rubrique)!;
  const same = all.filter((x) => x.rubrique === a.rubrique).sort((x, y) => x.order - y.order);
  const i = same.indexOf(a);
  const prev = same[i - 1];
  const next = same[i + 1];
  const bySlug = new Map(all.map((x) => [x.slug, x]));
  const card = (x: Article) => `<li><a href="${x.slug}.html">${esc(plain(x.title))}</a><span>${esc(x.description)}</span></li>`;

  let exo = '';
  const scripts: string[] = [];
  if (a.exercise) {
    const mod = ex.get(a.exercise);
    if (!mod) throw new Error(`${a.slug} : exercice « ${a.exercise} » introuvable`);
    const json = JSON.stringify(mod.exercise).replace(/</g, '\\u003c');
    exo = `
  <section class="exo-sec" id="exercice">
    <h2>Exercice : ${mod.exercise.title}</h2>
    <p>${mod.exercise.task}</p>
    <div class="exo"><script type="application/json">${json}</script><p class="muted">L’exercice interactif demande JavaScript. La solution est décrite dans l’article ci-dessus.</p></div>
    <h3 id="unifilaire">Le même circuit dans un schéma unifilaire</h3>
    <figure class="uni-fig">${unifilarSvg(mod)}<figcaption>${mod.unifilarCaption}</figcaption></figure>
    <p><a class="btn" href="../app/">Dessiner ce circuit dans Voltaplan</a></p>
  </section>`;
    scripts.push('cablage-sim.js', 'cablage.js');
  }
  const faq = a.faq?.length
    ? `\n  <section class="learn-faq"><h2 id="questions">Questions fréquentes</h2>\n${a.faq.map((f) => `    <details><summary>${f.q}</summary><div>${f.a}</div></details>`).join('\n')}\n  </section>`
    : '';
  const sources = a.sources?.length
    ? `\n  <section class="learn-sources"><h2 id="sources">Sources</h2><ul>${a.sources.map((s) => `<li>${s.url ? `<a href="${esc(s.url)}">${s.label}</a>` : s.label}</li>`).join('')}</ul></section>`
    : '';
  const related = (a.related ?? []).map((s) => {
    const x = bySlug.get(s);
    if (!x) throw new Error(`${a.slug} : article lié « ${s} » introuvable`);
    return x;
  });
  const body = `<main class="learn">
  <nav class="crumbs" aria-label="Fil d’Ariane"><a href="../">Accueil</a> › <a href="./">Apprendre</a> › <a href="./#${rub.id}">${esc(rub.title)}</a></nav>
  <article>
  <h1>${a.title}</h1>
  ${a.body}
  <section class="retenir"><h2 id="a-retenir">À retenir</h2><ul>${a.retenir.map((r) => `<li>${r}</li>`).join('')}</ul></section>${exo}${faq}${sources}
  </article>
  <nav class="pager" aria-label="Dans la rubrique">${prev ? `<a class="prev" href="${prev.slug}.html">← ${esc(plain(prev.title))}</a>` : '<span></span>'}${next ? `<a class="next" href="${next.slug}.html">${esc(plain(next.title))} →</a>` : '<span></span>'}</nav>
  ${related.length ? `<section class="learn-more"><h2 id="complements">Articles complémentaires</h2><ul class="learn-list">${related.map(card).join('')}</ul></section>` : ''}
  <section class="learn-more"><h2 id="rubrique">Dans la même rubrique : ${esc(rub.title)}</h2><ul class="learn-list">${same.filter((x) => x !== a).map(card).join('')}</ul></section>
  ${DISCLAIMER}
</main>`;
  const url = BASE + a.slug + '.html';
  return page({
    file: a.slug + '.html',
    title: a.pageTitle ?? `${plain(a.title)} — Voltaplan`,
    description: a.description,
    type: 'article',
    body,
    scripts,
    ld: [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: plain(a.title),
        description: a.description,
        inLanguage: 'fr',
        dateModified: a.updated,
        mainEntityOfPage: url,
        isAccessibleForFree: true,
        publisher: PUBLISHER,
      },
      crumbs([
        { name: 'Accueil', url: 'https://voltaplan.org/' },
        { name: 'Apprendre', url: BASE },
        { name: plain(a.title), url },
      ]),
    ],
  });
}

function hubPage(all: Article[], rubs: Rubrique[], lex: LexEntry[]): string {
  const sections = rubs
    .map((r) => {
      const list = all.filter((a) => a.rubrique === r.id).sort((x, y) => x.order - y.order);
      return `  <section class="learn-rub" id="${r.id}">
    <h2>${esc(r.title)}</h2>
    <p>${r.intro}</p>
    <ol class="learn-tiles">${list.map((a) => `<li><a href="${a.slug}.html"><strong>${esc(plain(a.title))}</strong><span>${esc(a.description)}</span>${a.exercise ? '<em>Exercice de câblage</em>' : ''}</a></li>`).join('')}</ol>
  </section>`;
    })
    .join('\n');
  const body = `<main class="learn hub">
  <h1>Apprendre l’électricité de la maison</h1>
  <p class="lead">De la tension et du courant jusqu’à la domotique : les notions de base, les câbles, les protections, les contrôles et les montages courants, expliqués simplement. Chaque montage a son exercice de câblage interactif et son schéma unifilaire.</p>
  <nav class="learn-toc" aria-label="Rubriques">${rubs.map((r) => `<a href="#${r.id}">${esc(r.title)}</a>`).join('')}<a href="lexique.html">Lexique (${lex.length} mots)</a></nav>
${sections}
  ${DISCLAIMER}
</main>`;
  return page({
    file: 'index.html',
    title: 'Apprendre l’électricité de la maison — Voltaplan',
    description: 'Cours gratuits sur l’électricité domestique en Belgique : bases, câbles, protections, contrôles, câblages avec exercices interactifs, volets et domotique.',
    body,
    ld: [
      { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Apprendre l’électricité de la maison', url: BASE, inLanguage: 'fr', publisher: PUBLISHER },
      crumbs([
        { name: 'Accueil', url: 'https://voltaplan.org/' },
        { name: 'Apprendre', url: BASE },
      ]),
    ],
  });
}

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function lexiquePage(lex: LexEntry[], all: Article[]): string {
  const bySlug = new Map(all.map((a) => [a.slug, a]));
  const sorted = [...lex].sort((a, b) => norm(a.term).localeCompare(norm(b.term), 'fr'));
  const letter = (e: LexEntry) => norm(e.term).replace(/[^a-z0-9]/g, '').charAt(0).toUpperCase();
  const letters = [...new Set(sorted.map(letter))];
  const groups = letters
    .map(
      (L) => `  <section class="lex-group" id="lettre-${L.toLowerCase()}"><h2>${L}</h2><dl>
${sorted
  .filter((e) => letter(e) === L)
  .map((e) => {
    const see = (e.see ?? []).map((s) => {
      const a = bySlug.get(s);
      if (!a) throw new Error(`lexique « ${e.id} » : article « ${s} » introuvable`);
      return `<a href="${s}.html">${esc(plain(a.title))}</a>`;
    });
    return `    <div class="lex" id="${e.id}"><dt>${e.term}</dt><dd>${e.def}${see.length ? ` <span class="lex-see">Voir : ${see.join(', ')}</span>` : ''}</dd></div>`;
  })
  .join('\n')}
  </dl></section>`,
    )
    .join('\n');
  const body = `<main class="learn lexique">
  <nav class="crumbs" aria-label="Fil d’Ariane"><a href="../">Accueil</a> › <a href="./">Apprendre</a></nav>
  <h1>Lexique de l’électricité</h1>
  <p class="lead">${lex.length} mots de l’électricité domestique, du courant à la domotique, avec un lien vers l’article qui les explique.</p>
  <div class="lex-tools" hidden><input type="search" class="lex-filter" placeholder="Filtrer (ex. différentiel)…" aria-label="Filtrer le lexique"></div>
  <nav class="lex-letters" aria-label="Lettres">${letters.map((L) => `<a href="#lettre-${L.toLowerCase()}">${L}</a>`).join('')}</nav>
${groups}
  <p class="muted lex-empty" hidden>Aucun mot trouvé.</p>
</main>`;
  return page({
    file: 'lexique.html',
    title: 'Lexique de l’électricité domestique — Voltaplan',
    description: `Lexique de l’électricité de la maison : ${lex.length} mots expliqués simplement, de l’ampère à la domotique, avec un lien vers l’article de chaque notion.`,
    body,
    scripts: ['lexique.js'],
    ld: [
      {
        '@context': 'https://schema.org',
        '@type': 'DefinedTermSet',
        name: 'Lexique de l’électricité domestique',
        url: BASE + 'lexique.html',
        inLanguage: 'fr',
        hasDefinedTerm: sorted.map((e) => ({ '@type': 'DefinedTerm', name: plain(e.term), description: plain(e.def), url: BASE + 'lexique.html#' + e.id })),
      },
      crumbs([
        { name: 'Accueil', url: 'https://voltaplan.org/' },
        { name: 'Apprendre', url: BASE },
        { name: 'Lexique', url: BASE + 'lexique.html' },
      ]),
    ],
  });
}

/** Page de transparence réglementaire, produite à partir du registre (tools/learn/transparency.ts). */
function transparencyPage(all: Article[]): string {
  const bySlug = new Map(all.map((a) => [a.slug, plain(a.title)]));
  return page({
    file: TRANSPARENCY_FILE,
    title: 'Ce que Voltaplan vérifie du RGIE — Voltaplan',
    description: 'Version du RGIE, méthode, exigences contrôlées et leurs références, limites et validations en attente. Voltaplan aide à vérifier, il ne certifie pas.',
    body: transparencyBody((slug) => bySlug.get(slug)),
    ld: [
      crumbs([
        { name: 'Accueil', url: 'https://voltaplan.org/' },
        { name: 'Apprendre', url: BASE },
        { name: 'Ce que Voltaplan vérifie du RGIE', url: BASE + TRANSPARENCY_FILE },
      ]),
    ],
  });
}

/** Toutes les pages de la section : chemin dans site/apprendre → contenu. */
export async function build(root: string): Promise<Map<string, string>> {
  const all = readArticles(root);
  const rubs = readRubriques(root);
  const lex = readLexique(root);
  const ex = await readExercises(root);
  for (const a of all) if (!rubs.some((r) => r.id === a.rubrique)) throw new Error(`${a.slug} : rubrique « ${a.rubrique} » inconnue`);
  const ids = new Set<string>();
  for (const e of lex) {
    if (ids.has(e.id)) throw new Error(`lexique : « ${e.id} » en double`);
    ids.add(e.id);
  }
  const out = new Map<string, string>();
  out.set('index.html', hubPage(all, rubs, lex));
  out.set('lexique.html', lexiquePage(lex, all));
  for (const a of all) out.set(a.slug + '.html', articlePage(a, all, rubs, ex));
  out.set(TRANSPARENCY_FILE, transparencyPage(all));
  return out;
}
