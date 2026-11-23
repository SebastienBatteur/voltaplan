/**
 * Mise en page automatique du schéma unifilaire.
 *
 * Convention (figure 3.1 du RGIE, Livre 1) :
 *  - l'alimentation est en bas ; les éléments de structure (origine, compteur, protections, tableaux)
 *    montent verticalement ; un tableau est une barre horizontale d'où partent ses circuits ;
 *  - option « de haut en bas » pour ceux qui préfèrent l'autre sens ;
 *  - les points d'un circuit (prises, interrupteurs, lampes…) sont des lignes horizontales
 *    branchées sur la canalisation verticale, chaque ligne se lisant de gauche à droite
 *    (ex. interrupteur → lampe).
 *
 * Fonction pure : (arbre) → primitives positionnées + position de chaque nœud.
 */
import type { ElNode } from '../model/types';
import { symbolSize } from './symbols';

export type Prim =
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; w?: number; /** Élément dont ce fil est l'alimentation. */ n?: string }
  | { t: 'sym'; node: ElNode; x: number; y: number; orient: 'v' | 'h'; /** Dessin de bas en haut : fil par le bas. */ up?: boolean }
  | { t: 'text'; x: number; y: number; text: string; size?: number; anchor?: 'start' | 'middle' | 'end'; bold?: boolean; nodeId?: string; muted?: boolean }
  | { t: 'bus'; node: ElNode; x1: number; x2: number; y: number };

interface Box {
  w: number;
  h: number;
  /** Point d'entrée : x (mode vertical) ou y (mode horizontal) relatif au coin haut-gauche. */
  entry: number;
  prims: Prim[];
}

export interface LabelFn {
  ref: (id: string) => string | undefined;
  protection: (n: ElNode) => string[];
  cable: (n: ElNode) => string;
  title: (n: ElNode) => string;
}

const GAP = 28;
const ROW_GAP = 6;
const STUB = 16;
const FONT = 10;

export function textWidth(s: string, size = FONT): number {
  return s.length * size * 0.56;
}

function shift(prims: Prim[], dx: number, dy: number): Prim[] {
  return prims.map((p) => {
    switch (p.t) {
      case 'line':
        return { ...p, x1: p.x1 + dx, x2: p.x2 + dx, y1: p.y1 + dy, y2: p.y2 + dy };
      case 'bus':
        return { ...p, x1: p.x1 + dx, x2: p.x2 + dx, y: p.y + dy };
      default:
        return { ...p, x: p.x + dx, y: p.y + dy };
    }
  });
}

const STRUCT = new Set(['origin', 'meter', 'protection', 'board', 'earthBar', 'earth']);

export function isStructural(n: ElNode): boolean {
  if (STRUCT.has(n.kind)) return true;
  return n.kind === 'cable' && n.children.length > 0 && n.children.every(isStructural);
}

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function wrap(s: string, max: number, lines = 2): string[] {
  const words = s.split(/\s+/);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) {
      out.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  if (out.length > lines) {
    const kept = out.slice(0, lines);
    kept[lines - 1] = truncate(kept[lines - 1] + ' ' + out.slice(lines).join(' '), max);
    return kept;
  }
  return out;
}

export interface LayoutOptions {
  /**
   * Sens de lecture. `true` (défaut) : de bas en haut, comme la figure 3.1 du RGIE
   * (alimentation en bas, tableaux, puis circuits qui montent ; points numérotés depuis la protection).
   * `false` : de haut en bas.
   */
  up?: boolean;
}

export function layoutUnifilar(
  roots: ElNode[],
  L: LabelFn,
  opts: LayoutOptions = {},
): { prims: Prim[]; w: number; h: number; pos: Map<string, { x: number; y: number }> } {
  const UP = opts.up ?? true;
  /**
   * Chaque bloc est calculé « de haut en bas » puis, en mode UP, retourné verticalement
   * au niveau des sous-blocs (les sous-blocs gardent leur propre dessin, seule leur place change).
   */
  const at = (top: number, bh: number, h: number) => (UP ? h - top - bh : top);
  const my = (y: number, h: number) => (UP ? h - y : y);

  /** Disposition côte à côte de plusieurs blocs verticaux, reliés par une barre. */
  const sideBySide = (boxes: Box[], busY: number, busNode?: ElNode, ids?: string[], ownerId?: string): Box => {
    const top = busY + 14;
    const xs: number[] = [];
    const entries: number[] = [];
    let x = 0;
    let h = 0;
    for (const b of boxes) {
      xs.push(x);
      entries.push(x + b.entry);
      h = Math.max(h, top + b.h);
      x += b.w + GAP;
    }
    const prims: Prim[] = [];
    boxes.forEach((b, i) => {
      prims.push(...shift(b.prims, xs[i], at(top, b.h, h)));
      prims.push({ t: 'line', x1: entries[i], y1: my(busY, h), x2: entries[i], y2: my(top, h), n: ids?.[i] });
    });
    const w = Math.max(0, x - GAP);
    const by = my(busY, h);
    if (busNode) prims.push({ t: 'bus', node: busNode, x1: Math.min(...entries) - 8, x2: Math.max(...entries) + 8, y: by });
    else prims.push({ t: 'line', x1: entries[0], x2: entries[entries.length - 1], y1: by, y2: by, w: 1.5, n: ownerId });
    return { w, h, entry: (entries[0] + entries[entries.length - 1]) / 2, prims };
  };

  /** Bloc vertical (structure). */
  const down = (node: ElNode): Box => {
    // Une canalisation est toujours verticale ; ses points sont des lignes horizontales.
    const goesDown = (c: ElNode) => isStructural(c) || c.kind === 'cable';
    const loads = node.children.filter((c) => !goesDown(c));
    const structs = node.children.filter(goesDown);

    if (node.kind === 'board') {
      const title = L.title(node);
      const kids = node.children.map(down);
      if (!kids.length) {
        const w = Math.max(90, textWidth(title) + 10);
        const by = UP ? 18 : 22;
        return {
          w,
          h: 40,
          entry: w / 2,
          prims: [
            { t: 'line', x1: w / 2, y1: UP ? 40 : 0, x2: w / 2, y2: by, n: node.id },
            { t: 'bus', node, x1: 0, x2: w, y: by },
            { t: 'text', x: 0, y: UP ? 32 : 14, text: title, bold: true, nodeId: node.id },
          ],
        };
      }
      const box = sideBySide(kids, 22, node, node.children.map((c) => c.id));
      const bus = box.prims.find((p): p is Extract<Prim, { t: 'bus' }> => p.t === 'bus' && p.node === node)!;
      // Titre à gauche, du côté de l'arrivée (sous la barre en mode UP, au-dessus sinon)
      box.prims.push({ t: 'text', x: bus.x1, y: UP ? bus.y + 15 : 14, text: title, bold: true, nodeId: node.id });
      box.prims.unshift({ t: 'line', x1: box.entry, y1: my(0, box.h), x2: box.entry, y2: my(22, box.h), n: node.id });
      return box;
    }

    // Symbole propre (vertical) + étiquettes à droite
    const { h: H, w: SW } = symbolSize(node, 'v');
    const labels: string[] = [];
    if (node.kind === 'protection') labels.push(...L.protection(node));
    else if (node.kind === 'cable') labels.push(L.cable(node));
    else labels.push(L.title(node));
    if (node.location && node.kind !== 'protection') labels.push(truncate(node.location, 26));
    const labelW = Math.max(0, ...labels.map((s, i) => textWidth(s, i === 0 && node.kind === 'protection' ? FONT + 1 : FONT)));

    // 1) Calcul « de haut en bas »
    let y = H;
    let right = SW / 2 + 6 + labelW; // étendue à droite de l'axe
    let left = SW / 2;
    const rows: { top: number; r: Box; id: string }[] = [];
    for (const c of loads) {
      const r = rightChain(c);
      rows.push({ top: y + 8, r, id: c.id });
      y += 8 + r.h + ROW_GAP;
      right = Math.max(right, STUB + r.w);
    }
    let structBox: Box | null = null;
    if (structs.length === 1) structBox = down(structs[0]);
    else if (structs.length > 1) structBox = sideBySide(structs.map(down), 10, undefined, structs.map((c) => c.id), node.id);
    const sy = y + 6;
    if (structBox) {
      left = Math.max(left, structBox.entry);
      right = Math.max(right, structBox.w - structBox.entry);
    }
    const h = structBox ? sy + structBox.h : Math.max(H, y);

    // 2) Placement final
    const ax = left;
    const prims: Prim[] = [];
    const symY = at(0, H, h);
    prims.push({ t: 'sym', node, x: ax, y: symY, orient: 'v', up: UP });
    labels.forEach((s, i) =>
      prims.push({
        t: 'text',
        x: ax + SW / 2 + 6,
        y: symY + (node.kind === 'protection' ? 14 : H / 2 + 4) + i * 12 - (node.kind === 'protection' ? 0 : (labels.length - 1) * 6),
        text: s,
        bold: i === 0 && node.kind === 'protection',
        size: i === 0 && node.kind === 'protection' ? FONT + 1 : FONT,
        muted: node.kind === 'cable' || i > 0,
        nodeId: node.id,
      }),
    );
    const ends: number[] = [];
    for (const { top, r, id } of rows) {
      const rt = at(top, r.h, h);
      const ty = rt + r.entry;
      ends.push(ty);
      prims.push({ t: 'line', x1: ax, y1: ty, x2: ax + STUB, y2: ty, n: id });
      prims.push(...shift(r.prims, ax + STUB, rt));
    }
    if (structBox) {
      ends.push(my(sy, h));
      if (structs.length > 1) prims.push({ t: 'line', x1: ax, y1: my(sy, h), x2: ax, y2: my(sy + 10, h), n: node.id });
      prims.push(...shift(structBox.prims, ax - structBox.entry, at(sy, structBox.h, h)));
    }
    if (ends.length) {
      const from = UP ? symY : symY + H;
      const to = UP ? Math.min(...ends) : Math.max(...ends);
      if (Math.abs(to - from) > 0.5) prims.push({ t: 'line', x1: ax, y1: from, x2: ax, y2: to, n: node.id });
    }
    return { w: ax + right, h, entry: ax, prims };
  };

  /** Chaîne horizontale (points d'un circuit). entry = y de l'entrée. */
  const rightChain = (node: ElNode): Box => {
    if (isStructural(node)) {
      const b = down(node);
      const ey = UP ? b.h : 0; // entrée du bloc : en bas (UP) ou en haut
      return { w: b.w + 10, h: b.h, entry: ey, prims: [{ t: 'line', x1: 0, y1: ey, x2: 10 + b.entry, y2: ey, n: node.id }, ...shift(b.prims, 10, 0)] };
    }
    const prims: Prim[] = [];
    const ref = L.ref(node.id);
    let { w: SW } = symbolSize(node, 'h');
    const cy = 16; // y de l'axe dans la ligne
    if (node.kind === 'cable') SW = Math.max(44, textWidth(L.cable(node), 9) + 8);
    const loc = node.location ? wrap(node.location, 18, 2) : [];
    const ownW = Math.max(SW, ...loc.map((s) => textWidth(s, 9)));
    prims.push({ t: 'sym', node, x: 0, y: cy, orient: 'h' });
    if (node.kind === 'cable') prims.push({ t: 'text', x: SW / 2, y: cy - 6, text: L.cable(node), size: 9, anchor: 'middle', muted: true, nodeId: node.id });
    else if (ref) prims.push({ t: 'text', x: SW / 2, y: cy - symbolSize(node, 'h').h / 2 - 3, text: ref, size: 9, anchor: 'middle', bold: true, nodeId: node.id });
    loc.forEach((s, i) => prims.push({ t: 'text', x: SW / 2, y: cy + symbolSize(node, 'h').h / 2 + 11 + i * 10, text: s, size: 9, anchor: 'middle', muted: true, nodeId: node.id }));
    const ownH = cy + symbolSize(node, 'h').h / 2 + 4 + loc.length * 10 + 2;
    const kids = node.children.map(rightChain);
    if (ownW > SW && kids.length) prims.push({ t: 'line', x1: SW, y1: cy, x2: ownW, y2: cy, n: node.id });
    if (!kids.length) return { w: ownW, h: Math.max(40, ownH), entry: cy, prims };
    if (kids.length === 1) {
      const k = kids[0];
      const dy = cy - k.entry;
      const top = Math.min(0, dy);
      prims.push({ t: 'line', x1: ownW, y1: cy, x2: ownW + 12, y2: cy, n: node.children[0].id });
      prims.push(...shift(k.prims, ownW + 12, dy));
      const all = shift(prims, 0, -top);
      return { w: ownW + 12 + k.w, h: Math.max(ownH, dy + k.h) - top, entry: cy - top, prims: all };
    }
    // Plusieurs enfants : colonne montante puis lignes empilées
    const rx = ownW + 8;
    prims.push({ t: 'line', x1: ownW, y1: cy, x2: rx, y2: cy, n: node.id });
    let y = 0;
    let w = 0;
    let lastY = cy;
    kids.forEach((k, i) => {
      const ty = y + k.entry;
      prims.push({ t: 'line', x1: rx, y1: ty, x2: rx + 10, y2: ty, n: node.children[i].id });
      prims.push(...shift(k.prims, rx + 10, y));
      lastY = ty;
      y += k.h + ROW_GAP;
      w = Math.max(w, rx + 10 + k.w);
    });
    prims.push({ t: 'line', x1: rx, y1: cy, x2: rx, y2: lastY, n: node.id });
    return { w, h: Math.max(ownH, y - ROW_GAP), entry: cy, prims };
  };

  const boxes = roots.map(down);
  const maxH = Math.max(0, ...boxes.map((b) => b.h));
  const prims: Prim[] = [];
  let x = 20;
  for (const b of boxes) {
    // En mode UP, les départs sont alignés en bas (sur l'alimentation).
    prims.push(...shift(b.prims, x, 20 + (UP ? maxH - b.h : 0)));
    x += b.w + GAP * 2;
  }
  const h = maxH + 40;
  const pos = new Map<string, { x: number; y: number }>();
  for (const p of prims) if (p.t === 'sym') pos.set(p.node.id, { x: p.x, y: p.y });
  for (const p of prims) if (p.t === 'bus' && !pos.has(p.node.id)) pos.set(p.node.id, { x: (p.x1 + p.x2) / 2, y: p.y });
  return { prims, w: x, h, pos };
}
