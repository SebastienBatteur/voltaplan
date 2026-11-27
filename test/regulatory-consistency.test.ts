/**
 * Cohérence entre le moteur réglementaire et la rubrique « Apprendre » (proposition de CI, ADR-0009, étape 1).
 * Détecte : une valeur réglementaire du moteur différente de celle d'un article (tableau 4.11, 2 600 W, 100 Ω) ;
 * une règle du catalogue dont l'article n'est pas dans la liste des références vérifiées ; une règle sans test.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BE_RULES } from '../src/rules/be/catalog';
import { DEDICATED_POWER_W, TABLE_4_11 } from '../src/rules/be/rgie';

const ROOT = join(__dirname, '..');
const LEARN = join(ROOT, 'learn', 'fr');
const articles = readdirSync(LEARN)
  .filter((f) => f.endsWith('.html'))
  .map((f) => ({ slug: f.slice(0, -5), html: readFileSync(join(LEARN, f), 'utf8') }));
const plan = JSON.parse(readFileSync(join(LEARN, 'plan.json'), 'utf8')) as { rgieRefs: string[] };
const strip = (s: string) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ') // \s ci-dessous couvre aussi les espaces insécables
    .replace(/\s+/g, ' ')
    .trim();
const num = (s: string) => parseFloat(s.replace(/\s/g, '').replace(',', '.'));

describe('Cohérence moteur ↔ articles : valeurs réglementaires', () => {
  it('tableau 4.11 : les colonnes « disjoncteur » et « fusible » des tableaux d’articles reprennent les valeurs du moteur', () => {
    const errors: string[] = [];
    let checked = 0;
    for (const a of articles) {
      for (const t of a.html.matchAll(/<table>([\s\S]*?)<\/table>/g)) {
        const heads = [...t[1].matchAll(/<th>([\s\S]*?)<\/th>/g)].map((m) => strip(m[1]).toLowerCase());
        const mcbCol = heads.findIndex((h) => h.includes('disjoncteur'));
        const fuseCol = heads.findIndex((h) => h.includes('fusible'));
        if (mcbCol < 0 && fuseCol < 0) continue;
        if (!heads[0]?.includes('section')) continue;
        for (const row of t[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
          const cells = [...row[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) => strip(m[1]));
          if (!cells.length) continue;
          const line = TABLE_4_11.find(([s]) => s === num(cells[0]));
          if (!line) continue;
          for (const [col, want] of [
            [mcbCol, line[2]],
            [fuseCol, line[1]],
          ] as const) {
            if (col < 0 || cells[col] === undefined) continue;
            checked++;
            if (num(cells[col]) !== want) errors.push(`${a.slug} : ${cells[0]} mm² « ${heads[col]} » = ${cells[col]} (moteur : ${want} A)`);
          }
        }
      }
    }
    expect(errors).toEqual([]);
    expect(checked).toBeGreaterThan(0);
  });

  it('circuit dédié : tout seuil de puissance cité dans un article vaut celui du moteur (2 600 W)', () => {
    const errors: string[] = [];
    for (const a of articles)
      for (const s of strip(a.html).split(/(?<=[.;:])\s/))
        if (/dédié/i.test(s))
          for (const m of s.matchAll(/(\d[\d ]*)\s?W\s*(?:ou plus|et plus)|(?:à partir de|au moins|≥)\s*(\d[\d ]*)\s?W/g)) {
            const w = num(m[1] ?? m[2]);
            if (w !== DEDICATED_POWER_W) errors.push(`${a.slug} : ${w} W — « ${s.slice(0, 120)} »`);
          }
    expect(errors).toEqual([]);
  });

  it('résistance de terre : toute limite « inférieure à / moins de … Ω » citée vaut 100 Ω', () => {
    const errors: string[] = [];
    for (const a of articles)
      for (const s of strip(a.html).split(/(?<=[.;])\s/))
        if (/terre|dispersion/i.test(s))
          for (const m of s.matchAll(/(?:inférieure? à|moins de)\s*(\d+)\s?Ω/g)) if (num(m[1]) !== 100) errors.push(`${a.slug} : ${m[1]} Ω — « ${s.slice(0, 120)} »`);
    expect(errors).toEqual([]);
  });
});

describe('Cohérence moteur ↔ références vérifiées', () => {
  it('chaque article RGIE renseigné dans le catalogue figure dans la liste des références vérifiées', () => {
    const errors: string[] = [];
    for (const r of Object.values(BE_RULES)) {
      if (!r.article) continue;
      for (const part of r.article.split(';')) {
        const ref = part.replace(/\(.*?\)/g, '').trim();
        if (!plan.rgieRefs.includes(ref)) errors.push(`${r.id} : ${ref}`);
      }
    }
    expect(errors).toEqual([]);
  });
});

describe('Règles et tests', () => {
  const testFiles = readdirSync(join(ROOT, 'test'))
    .filter((f) => f.endsWith('.test.ts') && f !== 'regulatory-consistency.test.ts')
    .map((f) => readFileSync(join(ROOT, 'test', f), 'utf8'))
    .join('\n');
  /** Règles sans test dédié au 27/11/2026 (à résorber ; une règle ajoutée sans test fait échouer ce contrôle). */
  const KNOWN_UNTESTED = new Set<string>(KNOWN());

  it('toute règle du catalogue est citée par au moins un test (sauf la liste connue, qui ne doit que diminuer)', () => {
    const untested = Object.keys(BE_RULES).filter((id) => !testFiles.includes(`'${id}'`) && !testFiles.includes(`"${id}"`));
    expect(untested.filter((id) => !KNOWN_UNTESTED.has(id))).toEqual([]);
    // La liste connue ne doit pas contenir de règle désormais testée (la tenir à jour)
    expect([...KNOWN_UNTESTED].filter((id) => !untested.includes(id))).toEqual([]);
  });

  it('toute règle corrigée avec un article vérifié a une date de vérification et un fichier de test existant', () => {
    for (const r of Object.values(BE_RULES)) {
      if (!r.article) continue;
      expect(r.verifiedOn, r.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(readdirSync(join(ROOT, 'test')), r.id).toContain(String(r.tests).replace(/^test\//, ''));
    }
  });
});

function KNOWN(): string[] {
  return ['R-CABLE-DATA-MISSING', 'R-DOC-ADDRESS', 'R-DOC-SUPPLY', 'R-ICC-LMAX', 'R-INSULATION', 'R-RCD-SELECTIVITY'];
}
