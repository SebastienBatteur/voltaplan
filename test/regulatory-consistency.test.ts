/**
 * Cohérence entre le registre réglementaire (src/regulations), le moteur et la rubrique « Apprendre » (articles,
 * lexique, exercices). Les valeurs attendues sont lues dans values.ts (jamais recopiées ici) ; chaque contrôle exige
 * d'avoir trouvé au moins une occurrence, pour ne pas réussir sur zéro correspondance.
 * La couverture fonctionnelle des règles (un cas qui déclenche, un cas muet, limites, exceptions…) est vérifiée par
 * test/rules.cases.test.ts : la simple présence d'un identifiant dans un fichier de test ne prouve rien.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BE_RULES } from '../src/rules/be/catalog';
import { checkProject } from '../src/rules';
import { REQUIREMENTS, requirementOfRule } from '../src/regulations';
import { DEDICATED_POWER, EARTH_EXTRA_MEASURES_ABOVE, EARTH_MAX, RCD_HIGH_SENSITIVITY, RCD_ORIGIN_MAX_SENSITIVITY, SECTION_MIN_GENERAL, SECTION_MIN_NO_SOCKET, TABLE_4_11 } from '../src/regulations/be/values';
import { node, project } from './rule-cases/fixtures';
import type { ExerciseModule, LexEntry } from '../tools/learn/types';

const ROOT = join(__dirname, '..');
const LEARN = join(ROOT, 'learn', 'fr');
const articles = readdirSync(LEARN)
  .filter((f) => f.endsWith('.html'))
  .map((f) => ({ slug: f.slice(0, -5), html: readFileSync(join(LEARN, f), 'utf8') }));
const lexicon = JSON.parse(readFileSync(join(LEARN, 'lexique.json'), 'utf8')) as LexEntry[];
const strip = (s: string) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ') // \s ci-dessous couvre aussi les espaces insécables
    .replace(/\s+/g, ' ')
    .trim();
const num = (s: string) => parseFloat(s.replace(/\s/g, '').replace(',', '.'));
const sentences = (text: string) => text.split(/(?<=[.;:])\s/);
/** Textes à contrôler : articles (texte visible) et définitions du lexique. */
const texts = [...articles.map((a) => ({ where: a.slug, text: strip(a.html) })), ...lexicon.map((e) => ({ where: `lexique:${e.id}`, text: e.def }))];

describe('Cohérence registre ↔ articles ↔ lexique : valeurs réglementaires', () => {
  it('tableau 4.11 : les tableaux d’articles reprennent les valeurs du registre, et chaque ligne de 1,5 à 16 mm² y figure', () => {
    const errors: string[] = [];
    const seen = { mcb: new Set<number>(), fuse: new Set<number>() };
    for (const a of articles) {
      for (const t of a.html.matchAll(/<table>([\s\S]*?)<\/table>/g)) {
        const heads = [...t[1].matchAll(/<th>([\s\S]*?)<\/th>/g)].map((m) => strip(m[1]).toLowerCase());
        const mcbCol = heads.findIndex((h) => h.includes('disjoncteur'));
        const fuseCol = heads.findIndex((h) => h.includes('fusible'));
        if ((mcbCol < 0 && fuseCol < 0) || !heads[0]?.includes('section')) continue;
        for (const row of t[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
          const cells = [...row[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) => strip(m[1]));
          if (!cells.length) continue;
          const line = TABLE_4_11.value.find(([s]) => s === num(cells[0]));
          if (!line) {
            errors.push(`${a.slug} : section ${cells[0]} absente du tableau 4.11`);
            continue;
          }
          for (const [col, want, set] of [
            [mcbCol, line[2], seen.mcb],
            [fuseCol, line[1], seen.fuse],
          ] as const) {
            if (col < 0 || cells[col] === undefined) continue;
            set.add(line[0]);
            if (num(cells[col]) !== want) errors.push(`${a.slug} : ${cells[0]} mm² « ${heads[col]} » = ${cells[col]} (registre : ${want} A)`);
          }
        }
      }
    }
    expect(errors).toEqual([]);
    const rows = TABLE_4_11.value.map(([s]) => s).filter((s) => s >= 1.5 && s <= 16);
    expect(rows.filter((s) => !seen.mcb.has(s)), 'lignes « disjoncteur » absentes des articles').toEqual([]);
    expect(rows.filter((s) => !seen.fuse.has(s)), 'lignes « fusible » absentes des articles').toEqual([]);
  });

  it('circuit dédié : tout seuil de puissance cité vaut celui du registre', () => {
    const errors: string[] = [];
    let found = 0;
    for (const { where, text } of texts)
      for (const s of sentences(text))
        if (/dédié/i.test(s))
          for (const m of s.matchAll(/(\d[\d ]*)\s?W\s*(?:ou plus|et plus)|(?:à partir de|au moins|≥)\s*(\d[\d ]*)\s?W/g)) {
            found++;
            const w = num(m[1] ?? m[2]);
            if (w !== DEDICATED_POWER.value) errors.push(`${where} : ${w} W — « ${s.slice(0, 120)} »`);
          }
    expect(errors).toEqual([]);
    expect(found, 'aucun seuil de circuit dédié trouvé : le contrôle ne vérifie rien').toBeGreaterThan(0);
  });

  it('résistance de terre : toute limite « inférieure à / moins de … Ω » vaut la limite du registre', () => {
    const errors: string[] = [];
    let found = 0;
    for (const { where, text } of texts)
      for (const s of sentences(text))
        if (/terre|dispersion/i.test(s))
          for (const m of s.matchAll(/(?:inférieure? à|moins de)\s*(\d+)\s?Ω/g)) {
            found++;
            if (num(m[1]) !== EARTH_MAX.value) errors.push(`${where} : ${m[1]} Ω — « ${s.slice(0, 120)} »`);
          }
    expect(errors).toEqual([]);
    expect(found, 'aucune limite de terre trouvée : le contrôle ne vérifie rien').toBeGreaterThan(0);
  });

  it('terre au-delà de 30 Ω : le seuil des mesures complémentaires cité vaut celui du registre', () => {
    const errors: string[] = [];
    let found = 0;
    for (const { where, text } of texts)
      for (const s of sentences(text))
        if (/terre|dispersion/i.test(s) && /complémentaire|supplémentaire/i.test(s))
          for (const m of s.matchAll(/(?:au-delà de|plus de|dépasse)\s*(\d+)\s?Ω/g)) {
            found++;
            if (num(m[1]) !== EARTH_EXTRA_MEASURES_ABOVE.value) errors.push(`${where} : ${m[1]} Ω — « ${s.slice(0, 120)} »`);
          }
    expect(errors).toEqual([]);
    expect(found).toBeGreaterThan(0);
  });

  it('haute sensibilité : « 30 mA au plus » et différentiel général de 300 mA au plus', () => {
    const errors: string[] = [];
    let found = 0;
    for (const { where, text } of texts)
      for (const s of sentences(text)) {
        for (const m of s.matchAll(/haute sensibilité \((\d+) mA au plus|(\d+) mA au plus \(haute sensibilité/g)) {
          found++;
          if (num(m[1] ?? m[2]) !== RCD_HIGH_SENSITIVITY.value) errors.push(`${where} : « ${s.slice(0, 120)} »`);
        }
        for (const m of s.matchAll(/(?:différentiel général|à l’origine de l’installation),? de (\d+) mA au plus/g)) {
          found++;
          if (num(m[1]) !== RCD_ORIGIN_MAX_SENSITIVITY.value) errors.push(`${where} : « ${s.slice(0, 120)} »`);
        }
      }
    expect(errors).toEqual([]);
    expect(found).toBeGreaterThan(0);
  });
});

describe('Cohérence registre ↔ moteur ↔ articles : identifiants et références', () => {
  it('toute règle citée dans un article existe, et l’article figure dans la fiche de son exigence', () => {
    const errors: string[] = [];
    let found = 0;
    for (const a of articles)
      for (const id of new Set([...a.html.matchAll(/\bR-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/g)].map((m) => m[0]))) {
        found++;
        if (!BE_RULES[id]) errors.push(`${a.slug} : règle inconnue ${id}`);
        else if (!requirementOfRule(id)?.articles.includes(a.slug)) errors.push(`${a.slug} : ${id} (${requirementOfRule(id)?.id}) ne cite pas cet article`);
      }
    expect(errors).toEqual([]);
    expect(found).toBeGreaterThan(0);
  });

  it('références du registre : forme d’une subdivision du RGIE, page imprimée plausible, citation présente', () => {
    for (const r of REQUIREMENTS)
      for (const ref of r.references) {
        expect(ref.source, r.id).toBe('RGIE-L1-v07');
        expect(ref.ref, r.id).toMatch(/^(?:\d+(?:\.\d+)+|tableau \d+\.\d+)/);
        expect(Number(String(ref.page).split('-')[0]), `${r.id} ${ref.ref}`).toBeGreaterThan(0);
        expect(Number(String(ref.page).split('-')[0]), `${r.id} ${ref.ref}`).toBeLessThan(400);
        expect((ref.quote ?? '').length, `${r.id} ${ref.ref}`).toBeGreaterThan(10);
      }
  });
});

describe('Cohérence exercices ↔ registre ↔ moteur', () => {
  const dir = join(ROOT, 'tools', 'learn', 'exercices');
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));

  it('les exercices existent', () => expect(files.length).toBeGreaterThan(5));

  it.each(files)('%s : le schéma unifilaire respecte le tableau 4.11, les sections minimales, et le moteur ne relève aucune non-conformité', async (f) => {
    const mod = (await import(join(dir, f))) as ExerciseModule;
    const circuits = mod.unifilar((kind, props = {}, children = []) => node(kind, props, children));
    const b = project(...circuits);
    const errors: string[] = [];
    for (const c of circuits) {
      const cable = c.children.find((x) => x.kind === 'cable');
      if (c.kind !== 'protection' || !cable) continue;
      const section = Number(cable.props.section);
      const line = TABLE_4_11.value.find(([s]) => s === section);
      const max = line?.[c.props.device === 'fuse' ? 1 : 2];
      if (!max || Number(c.props.ratedCurrent) > max) errors.push(`${c.props.ratedCurrent} A sur ${section} mm² (max ${max} A)`);
      const sockets = JSON.stringify(cable).includes('"socket"');
      const min = sockets ? SECTION_MIN_GENERAL.value : SECTION_MIN_NO_SOCKET.value;
      if (section < min) errors.push(`${section} mm² < ${min} mm²`);
      // La légende cite le même calibre et la même section que le schéma
      const caption = mod.unifilarCaption.replace(/\s/g, ' ');
      expect(caption, 'calibre de la légende').toContain(`${c.props.ratedCurrent} A`);
      expect(caption, 'section de la légende').toContain(`${String(section).replace('.', ',')} mm²`);
    }
    expect(errors).toEqual([]);
    const nc = checkProject(b.p).filter((x) => x.status === 'nonCompliant');
    expect(nc.map((x) => x.ruleId)).toEqual([]);
    expect(b.sub.children.length).toBeGreaterThan(0);
  });
});
