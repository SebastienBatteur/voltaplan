// npm run site:sitemap -- <dossier du site assemblé> [dossier source pour les dates git] : écrit sitemap.xml
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { entries, sitemap } from './sitemap';

const [siteDir, srcDir] = process.argv.slice(2).filter((a) => a !== '--');
if (!siteDir) throw new Error('usage : npm run site:sitemap -- <site> [source]');
const list = entries(siteDir, srcDir);
writeFileSync(join(siteDir, 'sitemap.xml'), sitemap(list));
console.log(`sitemap.xml : ${list.length} pages`);
