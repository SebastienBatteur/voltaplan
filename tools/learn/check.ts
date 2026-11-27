// npm run learn:check -- [slug…] : vérifie les articles (tous sans argument) et leurs exercices
import { join } from 'node:path';
import { readArticles } from './build';
import { checkArticle, checkExercise, loadSim, readPlan } from './validate';

const root = join(__dirname, '..', '..');
const plan = readPlan(root);
const want = process.argv.slice(2).filter((a) => a !== '--');
const sim = loadSim(root);
const arts = readArticles(root).filter((a) => !want.length || want.includes(a.slug));
const errors: string[] = [];
for (const a of arts) {
  errors.push(...checkArticle(a, plan));
  if (a.exercise) errors.push(...(await checkExercise(root, a.exercise, sim)));
}
for (const w of want) if (!arts.some((a) => a.slug === w)) errors.push(`${w} : fichier learn/fr/${w}.html absent`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`OK : ${arts.length} article(s) vérifié(s)`);
