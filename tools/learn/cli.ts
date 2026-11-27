// npm run learn:build : écrit les pages de site/apprendre/ (et retire celles dont la source a disparu)
import { readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from './build';

const root = resolve(__dirname, '..', '..');
const dir = join(root, 'site', 'apprendre');
const pages = await build(root);
let changed = 0;
for (const [f, html] of pages) {
  const p = join(dir, f);
  let old = '';
  try {
    old = readFileSync(p, 'utf8');
  } catch {
    // nouvelle page
  }
  if (old !== html) {
    writeFileSync(p, html);
    changed++;
  }
}
for (const f of readdirSync(dir)) if (f.endsWith('.html') && !pages.has(f)) {
  unlinkSync(join(dir, f));
  changed++;
}
console.log(`site/apprendre : ${pages.size} pages (${changed} modifiées)`);
