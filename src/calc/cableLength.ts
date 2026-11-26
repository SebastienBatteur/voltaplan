/**
 * Longueur des câbles estimée d'après le plan de position (fonction pure, testée), comme le font les logiciels qui
 * estiment « selon le plan » : trajet du tableau aux points du circuit, dans l'ordre du schéma, à angles droits (le
 * long des murs plutôt qu'à vol d'oiseau), plus les montées et descentes, plus une marge de raccordement.
 *
 * Les tracés de câbles dessinés entre deux points (`page.wires`, repris de Condui) sont suivis à la place du trajet à
 * angles droits ; le départ du tableau, rarement tracé, reste estimé.
 *
 * La longueur obtenue est marquée « estimée » (`lengthEstimated`) : une longueur saisie à la main n'est jamais
 * remplacée, et la saisie d'une longueur enlève la marque. Le RGIE n'exige pas la longueur des canalisations sur le
 * schéma d'une installation domestique (3.1.2.2 a) ; elle sert au calcul de la chute de tension et à la liste du
 * matériel.
 */
import { ancestors, circuitContent, isCircuit, walk } from '../model/tree';
import type { ElNode, PlanPage, Project, Pt } from '../model/types';

/** Hauteur sous plafond (mm). */
const CEILING = 2600;

/**
 * Montée et descente (mm) jusqu'au point, aller et retour, selon sa hauteur de pose courante : un interrupteur à
 * hauteur de main (1,10 m) est alimenté par le plafond, un interrupteur à tirette est en haut près du plafond, une
 * prise basse (0,25 m) est reliée par le bas, un point lumineux au plafond n'ajoute que son raccordement.
 */
function vertical(n: ElNode): number {
  const fromCeiling = (h: number) => 2 * Math.max(0, CEILING - h);
  const fromFloor = (h: number) => 2 * h;
  switch (n.kind) {
    case 'switch':
      return n.props.switchType === 'pullCord' ? fromCeiling(2300) : fromCeiling(1100);
    case 'pushButton':
      return fromCeiling(1100);
    case 'socket':
      return fromFloor(250);
    case 'light':
      // Applique murale (≈ 1,90 m) ; point au plafond : raccordement dans la boîte
      return n.props.lightType === 'wall' ? fromCeiling(1900) : 300;
    case 'detector':
      return fromCeiling(2400);
    case 'bell':
      return fromCeiling(2000);
    case 'motor':
      return fromCeiling(2300); // volet, porte : moteur en haut
    case 'appliance':
      return fromFloor(600);
    default:
      return 1500;
  }
}
const BOARD_RISE = 1500;
/** Changement d'étage (hauteur d'étage, montée comprise). */
const FLOOR = 3000;
/** Marge de raccordement et de cheminement. */
const MARGIN = 1.1;

const manhattan = (a: Pt, b: Pt) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const polyline = (pts: Pt[]) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);

export interface LengthEstimate {
  project: Project;
  /** Câbles dont la longueur a été (ré)estimée. */
  estimated: number;
  /** Câbles sans longueur et sans point posé sur le plan : impossible d'estimer. */
  notPlaced: number;
  /** Câbles estimés sans le tableau sur le plan : trajet compté depuis le premier point (trop court). */
  noBoard: number;
  /** Câbles dont au moins un tronçon suit un tracé dessiné. */
  traced: number;
}

/**
 * Points d'un câble dans l'ordre du schéma (ordre de pose), précédés du tableau du circuit : le trajet que suit
 * l'estimation (tableau → premier point → suivants, les commandes avant les points qu'elles commandent).
 */
function cableRuns(project: Project): { cable: ElNode; board?: ElNode; points: ElNode[] }[] {
  const out: { cable: ElNode; board?: ElNode; points: ElNode[] }[] = [];
  for (const { node: circuit } of walk(project.roots)) {
    if (!isCircuit(circuit)) continue;
    const board = [...ancestors(project.roots, circuit.id)].reverse().find((n) => n.kind === 'board');
    for (const cable of circuitContent(circuit).filter((c) => c.kind === 'cable')) {
      const points: ElNode[] = [];
      const rec = (list: ElNode[]) => {
        for (const c of list) {
          if (c.kind === 'board' || c.kind === 'protection' || c.kind === 'cable') continue;
          points.push(c);
          rec(c.children);
        }
      };
      rec(cable.children);
      out.push({ cable, board, points });
    }
  }
  return out;
}

/**
 * Tracés de câbles créés d'après l'unifilaire, pour un import qui n'en a pas : pour chaque câble, du tableau au
 * premier point puis de point en point dans l'ordre du schéma, à angles droits (un coude), sur une même page. Un
 * câble qui a déjà un tracé (repris de Condui) n'est pas touché. Marqués `auto` ; même longueur que l'estimation.
 */
export function autoWires(project: Project): { project: Project; added: number } {
  const where = new Map<string, { page: number; pos: Pt }>();
  project.plan.pages.forEach((pg, i) => {
    for (const s of pg.symbols) if (!where.has(s.nodeId)) where.set(s.nodeId, { page: i, pos: s.pos });
  });
  const existing = project.plan.pages.map((pg) => pg.wires ?? []);
  const added = project.plan.pages.map((): NonNullable<PlanPage['wires']> => []);
  for (const { board, points } of cableRuns(project)) {
    const seq = [...(board ? [board] : []), ...points].filter((n) => where.has(n.id));
    const ids = new Set(seq.map((n) => n.id));
    if (existing.some((ws) => ws.some((w) => ids.has(w.a) && ids.has(w.b)))) continue;
    for (let i = 1; i < seq.length; i++) {
      const a = where.get(seq[i - 1].id)!;
      const b = where.get(seq[i].id)!;
      if (a.page !== b.page || seq[i - 1].id === seq[i].id) continue;
      const pts = a.pos.x === b.pos.x || a.pos.y === b.pos.y ? [] : [{ x: b.pos.x, y: a.pos.y }];
      added[a.page].push({ a: seq[i - 1].id, b: seq[i].id, pts, auto: true });
    }
  }
  const n = added.reduce((s, l) => s + l.length, 0);
  if (!n) return { project, added: 0 };
  const pages = project.plan.pages.map((pg, i) => (added[i].length ? { ...pg, wires: [...(pg.wires ?? []), ...added[i]] } : pg));
  return { project: { ...project, plan: { ...project.plan, pages } }, added: n };
}

/** Estime la longueur des câbles des circuits dont les points sont posés sur le plan (sans toucher aux saisies). */
export function estimateCableLengths(project: Project): LengthEstimate {
  const where = new Map<string, { page: number; pos: Pt }>();
  project.plan.pages.forEach((pg: PlanPage, i) => {
    for (const s of pg.symbols) if (!where.has(s.nodeId)) where.set(s.nodeId, { page: i, pos: s.pos });
  });
  // Tracés dessinés : longueur de chaque tronçon entre deux points posés sur la même page
  const wires: { a: string; b: string; mm: number }[] = [];
  project.plan.pages.forEach((pg, i) => {
    for (const w of pg.wires ?? []) {
      const a = where.get(w.a);
      const b = where.get(w.b);
      if (a?.page === i && b?.page === i && w.a !== w.b) wires.push({ a: w.a, b: w.b, mm: polyline([a.pos, ...w.pts, b.pos]) });
    }
  });
  let traced = 0;
  const lengths = new Map<string, number>();
  let notPlaced = 0;
  let noBoard = 0;
  for (const { cable, board, points: pts } of cableRuns(project)) {
    // Départ : le tableau qui contient la protection du circuit, s'il est posé sur le plan
    const start = board ? where.get(board.id) : undefined;
    {
      if (Number(cable.props.length) > 0 && cable.props.lengthEstimated !== true) continue;
      const placed = pts.filter((p) => where.has(p.id));
      if (!placed.length) {
        if (!(Number(cable.props.length) > 0)) notPlaced++;
        continue;
      }
      // Tronçons tracés entre points de ce câble : groupes de points reliés (union-find)
      const ids = new Set(placed.map((p) => p.id));
      const mine = wires.filter((w) => ids.has(w.a) && ids.has(w.b));
      const root = new Map<string, string>();
      const up = (x: string): string => (root.get(x) ?? x) === x ? x : up(root.get(x)!);
      for (const w of mine) root.set(up(w.a), up(w.b));
      const tracedOf = new Map<string, number>();
      for (const w of mine) tracedOf.set(up(w.a), (tracedOf.get(up(w.a)) ?? 0) + w.mm);
      if (mine.length) traced++;
      const reached = new Set<string>();
      let mm = 0;
      let cur = start ?? where.get(placed[0].id)!;
      if (start) mm += BOARD_RISE;
      else noBoard++;
      for (const p of placed) {
        const w = where.get(p.id)!;
        const g = up(p.id);
        // Premier point d'un groupe tracé : on y va (angles droits), puis tout le groupe suit son tracé
        if (!reached.has(g)) {
          mm += w.page === cur.page ? manhattan(cur.pos, w.pos) : FLOOR * Math.abs(w.page - cur.page) + manhattan(cur.pos, w.pos);
          mm += tracedOf.get(g) ?? 0;
          reached.add(g);
        }
        mm += vertical(p);
        cur = w;
      }
      lengths.set(cable.id, Math.max(1, Math.ceil((mm * MARGIN) / 1000)));
    }
  }
  if (!lengths.size) return { project, estimated: 0, notPlaced, noBoard, traced };
  // Copie seulement des câbles modifiés et de leurs parents : les autres nœuds restent les mêmes objets
  const upd = (list: ElNode[]): ElNode[] => {
    let changed = false;
    const out = list.map((n) => {
      const kids = upd(n.children);
      const L = lengths.get(n.id);
      if (L === undefined && kids === n.children) return n;
      changed = true;
      return { ...n, props: L === undefined ? n.props : { ...n.props, length: L, lengthEstimated: true }, children: kids };
    });
    return changed ? out : list;
  };
  return { project: { ...project, roots: upd(project.roots) }, estimated: lengths.size, notPlaced, noBoard, traced };
}
