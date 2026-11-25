/**
 * Lecture d'un plan DXF (format d'échange AutoCAD, texte) pour le poser en fond de plan, à l'échelle réelle.
 *
 * Lecteur volontairement minimal, sans dépendance : seuls les traits utiles comme fond sont repris (LINE,
 * LWPOLYLINE, POLYLINE/VERTEX, ARC, CIRCLE, et les blocs insérés par INSERT : portes, fenêtres, mobilier…).
 * Les textes, cotes et hachures sont ignorés. Le dessin devient une image (traits noirs sur blanc) dont la
 * taille réelle en millimètres est connue grâce à l'unité du fichier ($INSUNITS) : pas besoin de mettre
 * à l'échelle à la main. Si l'unité n'est pas indiquée, l'image est posée et l'outil « Échelle » est proposé.
 */

export type DxfErrorCode = 'binary' | 'empty' | 'tooBig';

export class DxfError extends Error {
  constructor(readonly code: DxfErrorCode) {
    super(`DXF: ${code}`);
    this.name = 'DxfError';
  }
}

export type Pt2 = [number, number];

export interface DxfDrawing {
  /** Traits (polylignes ouvertes), dans l'unité du fichier, axe Y vers le haut comme dans le DXF. */
  paths: Pt2[][];
  /** Millimètres par unité du fichier ; null si l'unité n'est pas indiquée. */
  mmPerUnit: number | null;
}

/** Codes $INSUNITS utiles → millimètres par unité. */
const UNITS: Record<number, number> = { 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000, 14: 100 };

/** Garde-fou : au-delà, le fichier est refusé plutôt que de bloquer l'onglet. */
export const DXF_MAX_POINTS = 2_000_000;
const MAX_DEPTH = 6;

interface Entity {
  type: string;
  /** Paires (code, valeur) dans l'ordre du fichier. */
  g: [number, string][];
}

function pairs(text: string): [number, string][] {
  const lines = text.split(/\r?\n/);
  const out: [number, string][] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    if (Number.isNaN(code)) {
      i -= 1; // ligne parasite : on se recale
      continue;
    }
    out.push([code, lines[i + 1].trim()]);
  }
  return out;
}

const num = (e: Entity, code: number, d = 0) => {
  const p = e.g.find(([c]) => c === code);
  const v = p ? parseFloat(p[1]) : NaN;
  return Number.isFinite(v) ? v : d;
};
const str = (e: Entity, code: number) => e.g.find(([c]) => c === code)?.[1] ?? '';

/** Arc de cercle en segments (angles en radians, sens trigonométrique). */
function arcPts(cx: number, cy: number, r: number, a0: number, a1: number): Pt2[] {
  while (a1 <= a0) a1 += Math.PI * 2;
  const n = Math.max(4, Math.min(64, Math.ceil(((a1 - a0) / (Math.PI * 2)) * 48)));
  const pts: Pt2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/** Segment de polyligne avec renflement (« bulge » = tan(angle/4)) → points intermédiaires. */
function bulgePts(a: Pt2, b: Pt2, bulge: number): Pt2[] {
  if (!bulge) return [b];
  const theta = 4 * Math.atan(bulge);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const chord = Math.hypot(dx, dy);
  if (chord === 0) return [b];
  const r = chord / (2 * Math.sin(theta / 2));
  // Centre : milieu de la corde décalé perpendiculairement
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const h = r * Math.cos(theta / 2);
  const cx = mx - (dy / chord) * h;
  const cy = my + (dx / chord) * h;
  const a0 = Math.atan2(a[1] - cy, a[0] - cx);
  const n = Math.max(2, Math.ceil((Math.abs(theta) / (Math.PI * 2)) * 48));
  const pts: Pt2[] = [];
  for (let i = 1; i <= n; i++) {
    const t = a0 + (theta * i) / n;
    pts.push([cx + Math.abs(r) * Math.cos(t), cy + Math.abs(r) * Math.sin(t)]);
  }
  pts[pts.length - 1] = b;
  return pts;
}

/** Découpe les paires en sections, puis en entités. */
function parse(text: string) {
  const g = pairs(text);
  let mmPerUnit: number | null = null;
  const entities: Entity[] = [];
  const blocks = new Map<string, Entity[]>();
  let section = '';
  let cur: Entity | null = null;
  let block: { name: string; list: Entity[] } | null = null;
  const flush = () => {
    if (!cur) return;
    if (section === 'ENTITIES') entities.push(cur);
    else if (section === 'BLOCKS' && block && cur.type !== 'BLOCK' && cur.type !== 'ENDBLK') block.list.push(cur);
    cur = null;
  };
  for (let i = 0; i < g.length; i++) {
    const [code, v] = g[i];
    if (code === 0) {
      flush();
      if (v === 'SECTION') {
        section = g[i + 1]?.[0] === 2 ? g[i + 1][1] : '';
        continue;
      }
      if (v === 'ENDSEC') {
        section = '';
        continue;
      }
      if (v === 'EOF') break;
      cur = { type: v, g: [] };
      continue;
    }
    if (section === 'HEADER' && code === 9 && v === '$INSUNITS') {
      const u = parseInt(g[i + 1]?.[1] ?? '', 10);
      mmPerUnit = UNITS[u] ?? null;
    }
    if (cur) {
      cur.g.push([code, v]);
      if (section === 'BLOCKS' && cur.type === 'BLOCK' && code === 2) {
        block = { name: v, list: [] };
        blocks.set(v, block.list);
      }
    }
  }
  flush();
  return { entities, blocks, mmPerUnit };
}

type Xf = (p: Pt2) => Pt2;
const IDENT: Xf = (p) => p;

/** Lit un DXF texte. Lève DxfError (binaire, vide, trop gros). */
export function readDxf(text: string): DxfDrawing {
  if (text.startsWith('AutoCAD Binary DXF')) throw new DxfError('binary');
  const { entities, blocks, mmPerUnit } = parse(text);
  const paths: Pt2[][] = [];
  let count = 0;
  const add = (pts: Pt2[], xf: Xf) => {
    if (pts.length < 2) return;
    count += pts.length;
    if (count > DXF_MAX_POINTS) throw new DxfError('tooBig');
    paths.push(pts.map(xf));
  };

  const draw = (list: Entity[], xf: Xf, depth: number) => {
    for (let k = 0; k < list.length; k++) {
      const e = list[k];
      switch (e.type) {
        case 'LINE':
          add([[num(e, 10), num(e, 20)], [num(e, 11), num(e, 21)]], xf);
          break;
        case 'CIRCLE':
          add(arcPts(num(e, 10), num(e, 20), num(e, 40), 0, Math.PI * 2), xf);
          break;
        case 'ARC':
          add(arcPts(num(e, 10), num(e, 20), num(e, 40), (num(e, 50) * Math.PI) / 180, (num(e, 51) * Math.PI) / 180), xf);
          break;
        case 'LWPOLYLINE': {
          const verts: { p: Pt2; bulge: number }[] = [];
          for (const [c, v] of e.g) {
            if (c === 10) verts.push({ p: [parseFloat(v), 0], bulge: 0 });
            else if (c === 20 && verts.length) verts[verts.length - 1].p[1] = parseFloat(v);
            else if (c === 42 && verts.length) verts[verts.length - 1].bulge = parseFloat(v) || 0;
          }
          const closed = (num(e, 70) & 1) === 1;
          add(polyline(verts, closed), xf);
          break;
        }
        case 'POLYLINE': {
          // Sommets : entités VERTEX qui suivent, jusqu'à SEQEND
          const verts: { p: Pt2; bulge: number }[] = [];
          let j = k + 1;
          for (; j < list.length && list[j].type === 'VERTEX'; j++) verts.push({ p: [num(list[j], 10), num(list[j], 20)], bulge: num(list[j], 42) });
          if (list[j]?.type === 'SEQEND') k = j;
          else k = j - 1;
          // Maillages 3D / faces : ignorés (drapeaux 16 et 64)
          const flags = num(e, 70);
          if (!(flags & 16) && !(flags & 64)) add(polyline(verts, (flags & 1) === 1), xf);
          break;
        }
        case 'INSERT': {
          if (depth >= MAX_DEPTH) break;
          const inner = blocks.get(str(e, 2));
          if (!inner) break;
          const ix = num(e, 10);
          const iy = num(e, 20);
          const sx = num(e, 41, 1) || 1;
          const sy = num(e, 42, 1) || 1;
          const rot = (num(e, 50) * Math.PI) / 180;
          const cos = Math.cos(rot);
          const sin = Math.sin(rot);
          const local: Xf = ([x, y]) => {
            const ax = x * sx;
            const ay = y * sy;
            return [ix + ax * cos - ay * sin, iy + ax * sin + ay * cos];
          };
          draw(inner, (p) => xf(local(p)), depth + 1);
          break;
        }
      }
    }
  };
  draw(entities, IDENT, 0);
  if (!paths.length) throw new DxfError('empty');
  return { paths, mmPerUnit };
}

function polyline(verts: { p: Pt2; bulge: number }[], closed: boolean): Pt2[] {
  if (!verts.length) return [];
  const pts: Pt2[] = [verts[0].p];
  const n = verts.length;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % n];
    pts.push(...bulgePts(a.p, b.p, a.bulge));
  }
  return pts;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Cadre du dessin. Les points très éloignés du reste (un trait oublié à des kilomètres, fréquent dans les DXF)
 * écraseraient le plan en un point : le cadre retient 99,8 % des points, centrés sur la médiane.
 */
export function drawingBounds(paths: Pt2[][]): Bounds {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of paths) for (const [x, y] of p) if (Number.isFinite(x) && Number.isFinite(y)) {
        xs.push(x);
        ys.push(y);
      }
  xs.sort((a, b) => a - b);
  ys.sort((a, b) => a - b);
  const q = (arr: number[], f: number) => arr[Math.min(arr.length - 1, Math.max(0, Math.round((arr.length - 1) * f)))];
  const trim = xs.length > 500 ? 0.001 : 0;
  return { minX: q(xs, trim), maxX: q(xs, 1 - trim), minY: q(ys, trim), maxY: q(ys, 1 - trim) };
}

/** Plan dessiné sur une image (traits noirs, fond blanc), avec sa taille réelle en mm si l'unité est connue. */
export function renderDxf(d: DxfDrawing, maxPx = 2400): { canvas: HTMLCanvasElement; widthMm: number | null } {
  const b = drawingBounds(d.paths);
  const w0 = Math.max(b.maxX - b.minX, 1e-9);
  const h0 = Math.max(b.maxY - b.minY, 1e-9);
  const margin = Math.max(w0, h0) * 0.02;
  const W = w0 + 2 * margin;
  const H = h0 + 2 * margin;
  const k = maxPx / Math.max(W, H);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(W * k));
  c.height = Math.max(1, Math.round(H * k));
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = Math.max(1, maxPx / 1600);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  // Axe Y du DXF vers le haut, celui de l'image vers le bas
  const X = (x: number) => (x - b.minX + margin) * k;
  const Y = (y: number) => (b.maxY + margin - y) * k;
  for (const p of d.paths) {
    ctx.moveTo(X(p[0][0]), Y(p[0][1]));
    for (let i = 1; i < p.length; i++) ctx.lineTo(X(p[i][0]), Y(p[i][1]));
  }
  ctx.stroke();
  return { canvas: c, widthMm: d.mmPerUnit ? W * d.mmPerUnit : null };
}

export const isDxf = (b: { name?: string; type?: string }) => (b.name ? /\.dxf$/i.test(b.name) : false) || b.type === 'image/vnd.dxf' || b.type === 'application/dxf';
