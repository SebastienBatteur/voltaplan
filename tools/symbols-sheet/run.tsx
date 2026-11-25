/**
 * Planche des symboles électriques (src/unifilar/symbols.tsx) : chaque élément, et chaque variante de ses propriétés
 * qui changent le dessin, en forme unifilaire et en forme plan de position.
 *
 *   npm run symbols:sheet            → docs/symboles/planche-symboles.html
 *
 * Page HTML autonome (styles de l'application inclus, aucun appel réseau) : à ouvrir sur chaque appareil (Windows,
 * macOS, iPhone, Android) pour vérifier que le rendu est le même partout, et à comparer au tableau 2.23 du RGIE
 * (vérification humaine : l'outil ne juge pas la conformité).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { Symbol, symbolSize, isWallMounted } from '../../src/unifilar/symbols';
import { PROP_SCHEMAS } from '../../src/model/schema';
import type { ElNode, NodeKind, PropValue } from '../../src/model/types';

const KINDS: NodeKind[] = [
  'origin', 'meter', 'protection', 'board', 'cable', 'earthBar', 'earth', 'socket', 'switch', 'pushButton', 'light',
  'appliance', 'junctionBox', 'bell', 'motor', 'transformer', 'solarPanel', 'inverter', 'detector', 'relay',
] as NodeKind[];
/** Propriétés sans effet sur le dessin. */
const SKIP = new Set(['wetRoom', 'installationKind', 'phase', 'material', 'curve', 'cableType']);

function node(kind: NodeKind, props: Record<string, PropValue>): ElNode {
  const p: Record<string, PropValue> = {};
  for (const d of PROP_SCHEMAS[kind] ?? []) if (d.default !== undefined) p[d.key] = d.default;
  return { id: kind + JSON.stringify(props), kind, props: { ...p, ...props }, children: [] } as ElNode;
}

function variants(kind: NodeKind): { label: string; n: ElNode }[] {
  const out = [{ label: 'par défaut', n: node(kind, {}) }];
  for (const d of PROP_SCHEMAS[kind] ?? []) {
    if (SKIP.has(d.key)) continue;
    if (d.type === 'enum') for (const o of d.options ?? []) if (o && o !== d.default) out.push({ label: `${d.key} = ${o}`, n: node(kind, { [d.key]: o }) });
    if (d.type === 'bool') out.push({ label: `${d.key} = ${!(d.default ?? false)}`, n: node(kind, { [d.key]: !(d.default ?? false) }) });
    if (d.key === 'count') for (const c of [2, 3]) out.push({ label: `count = ${c}`, n: node(kind, { count: c }) });
  }
  return out;
}

function Cell({ label, n }: { label: string; n: ElNode }) {
  const v = symbolSize(n, 'v');
  const h = symbolSize(n, 'h');
  return (
    <figure className="cell">
      <div className="pair">
        <svg className="canvas" viewBox={`${-v.w / 2 - 30} -6 ${v.w + 60} ${v.h + 12}`} width={84} height={100} role="img" aria-label={`${n.kind} unifilaire`}>
          <Symbol node={n} orient="v" />
        </svg>
        <svg className="canvas" viewBox={`-6 -20 ${h.w + 12} 40`} width={100} height={48} role="img" aria-label={`${n.kind} plan`}>
          <Symbol node={n} orient="h" bare={!isWallMounted(n)} />
        </svg>
      </div>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

function Sheet() {
  return (
    <div className="sheet">
      <h1>Voltaplan — planche des symboles</h1>
      <p>
        Pour chaque élément : forme <strong>unifilaire</strong> (à gauche) et <strong>plan de position</strong> (à droite), puis une variante par
        propriété qui change le dessin. À comparer au tableau 2.23 du RGIE ; à ouvrir sur chaque appareil pour vérifier que le rendu est identique.
      </p>
      {KINDS.map((k) => (
        <section key={k}>
          <h2>{k}</h2>
          <div className="grid">
            {variants(k).map((x) => (
              <Cell key={x.label} {...x} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const root = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
const css = readFileSync(resolve(root, 'src/styles.css'), 'utf-8');
const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Voltaplan — planche des symboles</title>
<style>
${css}
/* Planche : toujours en clair, comme à l'impression */
:root { color-scheme: light; --ink: #000; --panel: #fff; --bg: #fff; --text: #000; --muted: #555; --border: #ccc; }
html, body { height: auto; background: #fff; color: #000; }
.sheet { display: block; padding: 12px; max-width: 1200px; margin: 0 auto; }
.sheet h1 { font-size: 20px; } .sheet h2 { font-size: 15px; margin: 16px 0 6px; }
.grid { display: flex; flex-wrap: wrap; gap: 6px; }
.cell { margin: 0; border: 1px solid #ccc; border-radius: 4px; padding: 4px; width: 200px; }
.pair { display: flex; align-items: center; justify-content: space-around; height: 104px; }
.cell svg.canvas { background: transparent; }
figcaption { text-align: center; font-size: 12px; word-break: break-word; }
</style>
</head>
<body>
${renderToStaticMarkup(<Sheet />)}
</body>
</html>
`;
const out = resolve(root, 'docs/symboles/planche-symboles.html');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`Planche écrite : ${out} (${KINDS.length} éléments, ${KINDS.reduce((n, k) => n + variants(k).length, 0)} variantes)`);
