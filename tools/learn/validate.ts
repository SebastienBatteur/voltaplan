/**
 * Vérification des sources de la section « Apprendre » (utilisée par les tests et pendant la rédaction).
 *   npm run learn:check -- [slug…]   (sans argument : tous les articles présents)
 * Contrôle : en-tête JSON complet, longueurs du titre et de la description, article prévu dans learn/fr/plan.json,
 * liens vers des articles prévus et vers des mots prévus du lexique, références RGIE limitées à la liste vérifiée,
 * exercice : la solution fonctionne et respecte les règles, un montage vide ne passe pas.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import type { Article } from './build';
import type { Exercise, ExerciseModule } from './types';

interface Plan {
  articles: { slug: string; rubrique: string; order: number; title: string; exercise?: string }[];
  lexique: string[];
  rgieRefs: string[];
}

export const readPlan = (root: string): Plan => JSON.parse(readFileSync(join(root, 'learn', 'fr', 'plan.json'), 'utf8'));

interface SimApi {
  check: (ex: Exercise, wires: Exercise['solution']) => { ok: boolean; errors: { code: string }[]; warnings: { code: string }[] };
}
export function loadSim(root: string): SimApi {
  const ctx: { CablageSim?: SimApi } = {};
  runInNewContext(readFileSync(join(root, 'site', 'apprendre', 'cablage-sim.js'), 'utf8'), ctx);
  return ctx.CablageSim!;
}

export function checkArticle(a: Article, plan: Plan): string[] {
  const e: string[] = [];
  const p = plan.articles.find((x) => x.slug === a.slug);
  if (!p) return [`${a.slug} : article absent de learn/fr/plan.json`];
  if (a.rubrique !== p.rubrique || a.order !== p.order) e.push(`rubrique/ordre différents du plan (${p.rubrique} ${p.order})`);
  if ((a.exercise ?? undefined) !== (p.exercise ?? undefined)) e.push(`exercice attendu : ${p.exercise ?? 'aucun'}`);
  const tab = a.pageTitle ?? `${a.title.replace(/<[^>]+>/g, '')} — Voltaplan`;
  if (tab.length > 70 || tab.length < 10) e.push(`titre d’onglet de ${tab.length} caractères (10 à 70) : ${tab}`);
  if (a.description.length < 70 || a.description.length > 160) e.push(`description de ${a.description.length} caractères (70 à 160)`);
  if (!a.retenir?.length) e.push('« retenir » vide');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.updated)) e.push('date « updated » invalide');
  for (const r of a.related ?? []) if (!plan.articles.some((x) => x.slug === r)) e.push(`article lié inconnu : ${r}`);
  const all = [a.body, ...(a.retenir ?? []), ...(a.faq ?? []).flatMap((f) => [f.q, f.a])].join('\n');
  if (/<h1[\s>]/.test(all)) e.push('pas de <h1> dans le corps (le titre est ajouté par le générateur)');
  for (const m of a.body.matchAll(/<h2([^>]*)>/g)) if (!/\bid="[a-z0-9-]+"/.test(m[1])) e.push('chaque <h2> du corps a un id');
  for (const m of all.matchAll(/href="([^"#]*)(?:#([^"]*))?"/g)) {
    const [, file, frag] = m;
    if (/^(https?:|mailto:)/.test(file)) continue;
    if (file === 'lexique.html') {
      if (!frag || !plan.lexique.includes(frag)) e.push(`mot du lexique non prévu : ${frag}`);
    } else if (file === '../app/' || file === '../guide.html' || file === '../faq.html') continue;
    else if (file.endsWith('.html')) {
      if (!plan.articles.some((x) => x.slug + '.html' === file)) e.push(`lien vers un article non prévu : ${file}`);
    } else if (file) e.push(`lien non pris en charge : ${file}`);
  }
  // Références RGIE : seulement celles vérifiées dans le texte officiel. « RGIE, 4.2.4.3 b », « RGIE art. 3.1.2 »,
  // « article 5.3.5.2 a » ; les figures et tableaux (« figure 3.1 du RGIE ») ne sont pas des articles.
  const refs = [
    ...all.matchAll(/RGIE,?\s+(?:art(?:icle)?\.?\s*)?(\d+(?:\.\d+)+(?:\s?[a-z]\b)?)/g),
    ...all.matchAll(/\barticles?\s+(\d+(?:\.\d+)+(?:\s?[a-z]\b)?)/g),
  ];
  for (const m of refs) if (!plan.rgieRefs.includes(m[1].trim())) e.push(`référence RGIE non vérifiée : ${m[1]}`);
  // Autres numéros à points près de « RGIE » (hors figures et tableaux) : à vérifier aussi
  for (const m of all.matchAll(/(?<!figure |tableau |figures |tableaux )\b(\d+\.\d+(?:\.\d+)+)(?:\s?[a-z]\b)?[^<]{0,12}du RGIE/g))
    if (!plan.rgieRefs.some((r) => r.startsWith(m[1]))) e.push(`référence RGIE non vérifiée : ${m[1]}`);
  return e.map((x) => `${a.slug} : ${x}`);
}

export async function checkExercise(root: string, id: string, sim: SimApi): Promise<string[]> {
  const f = join(root, 'tools', 'learn', 'exercices', id + '.ts');
  if (!existsSync(f)) return [`exercice ${id} : fichier tools/learn/exercices/${id}.ts absent`];
  const mod = (await import(/* @vite-ignore */ './exercices/' + id + '.ts')) as ExerciseModule;
  const e: string[] = [];
  const ex = mod.exercise;
  if (ex.id !== id) e.push('id différent du nom du fichier');
  const r = sim.check(ex, ex.solution);
  if (!r.ok) e.push('la solution ne passe pas : ' + r.errors.map((x) => x.code).join(', '));
  if (r.warnings.length) e.push('la solution a des remarques : ' + r.warnings.map((x) => x.code).join(', '));
  if (sim.check(ex, []).ok) e.push('un montage vide passe : ajouter des cas attendus');
  if (!ex.cases?.length && !ex.sequence?.length && !ex.toggle) e.push('aucun cas attendu');
  if (typeof mod.unifilar !== 'function' || !mod.unifilarCaption) e.push('unifilar / unifilarCaption absents');
  const ids = new Set(ex.devices.map((d) => d.id));
  for (const w of ex.solution) for (const k of [w.a, w.b]) if (!ids.has(k.split('.')[0])) e.push(`borne inconnue : ${k}`);
  return e.map((x) => `exercice ${id} : ${x}`);
}
