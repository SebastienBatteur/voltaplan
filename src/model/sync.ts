/**
 * « Mettre à jour » après une nouvelle installation ou l'ajout de circuits (fonction pure, testée).
 *
 * En un clic :
 *  - tableau : les nouveaux appareils sont posés dans le premier emplacement libre, sans déplacer les autres
 *    (tableau encore jamais disposé : disposition automatique complète) ;
 *  - plan : les nouveaux points sont posés près du nom de leur pièce (texte du plan identique à leur
 *    emplacement), sinon dans une colonne « à placer » à gauche du plan ;
 *  - dossier : une révision est ajoutée avec la liste des circuits ajoutés (RGIE 3.1.2 : une extension
 *    est reportée sur les plans, avec une nouvelle version et sa date).
 * La numérotation, les étiquettes, la liste du matériel et le contrôle se recalculent d'office.
 * « Nouveau » = absent à la mise à jour précédente (meta.syncedIds) ; sans mise à jour précédente, tout est nouveau.
 */
import type { BoardLayout, ElNode, PlanPage, Project, Pt } from './types';
import { computeNumbering, isCircuit, walk } from './tree';
import { autoLayout, boardSize, conventionalLayout, enclosures, moduleWidth, placed } from '../board/model';

/** Éléments posés automatiquement sur le plan. */
export const PLAN_KINDS = new Set(['board', 'socket', 'switch', 'pushButton', 'light', 'appliance', 'motor', 'bell', 'detector', 'domotic']);

export interface SyncReport {
  firstSync: boolean;
  /** Repères des circuits ajoutés (A, B…). */
  newCircuits: string[];
  newNodes: number;
  boardPlaced: number;
  /** Appareils qui ne tiennent plus dans le tableau (rangée à ajouter). */
  boardNoRoom: number;
  planByRoom: number;
  planToPlace: number;
  revision?: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Premier emplacement libre de `w` modules (rangée, colonne), ou null. */
export function freeSlot(occupied: boolean[][], w: number): { row: number; col: number } | null {
  for (let r = 0; r < occupied.length; r++)
    for (let c = 0; c + w <= occupied[r].length; c++) if (occupied[r].slice(c, c + w).every((x) => !x)) return { row: r, col: c };
  return null;
}

function syncBoards(project: Project, isNew: (id: string) => boolean, rep: SyncReport): Record<string, BoardLayout> {
  const boards = { ...(project.boards ?? {}) };
  for (const enc of enclosures(project.roots)) {
    const { rows, perRow } = boardSize(enc.board);
    const layout = boards[enc.board.id];
    if (!layout || !Object.keys(layout.slots).length) {
      // Rangement habituel s'il tient dans le tableau, sinon rangement compact dans l'ordre du schéma
      const usual = conventionalLayout(enc, rows, perRow, enc.board.props.mainRow === 'bottom' ? 'bottom' : 'top');
      const auto = usual.rows <= rows ? usual : autoLayout(enc, rows, perRow);
      boards[enc.board.id] = { ...(layout ?? {}), slots: auto.slots };
      rep.boardPlaced += Object.keys(auto.slots).length;
      rep.boardNoRoom += enc.devices.length - Object.keys(auto.slots).length;
      continue;
    }
    const { placed: done, unplaced } = placed(enc, layout);
    const occ = Array.from({ length: rows }, () => Array<boolean>(perRow).fill(false));
    for (const d of done) for (let c = d.col; c < d.col + d.width && c < perRow; c++) if (occ[d.row]) occ[d.row][c] = true;
    const slots = { ...layout.slots };
    for (const n of unplaced) {
      if (!isNew(n.id)) continue; // laissé volontairement en réserve : on n'y touche pas
      const w = moduleWidth(n);
      const s = freeSlot(occ, w);
      if (!s) {
        rep.boardNoRoom++;
        continue;
      }
      for (let c = s.col; c < s.col + w; c++) occ[s.row][c] = true;
      slots[n.id] = s;
      rep.boardPlaced++;
    }
    boards[enc.board.id] = { ...layout, slots };
  }
  return boards;
}

function pageBounds(pg: PlanPage): { x: number; y: number } | null {
  const pts: Pt[] = [...pg.walls.flatMap((w) => [w.a, w.b]), ...pg.labels.map((l) => l.pos), ...pg.symbols.map((s) => s.pos)];
  if (!pts.length) return null;
  return { x: Math.min(...pts.map((p) => p.x)), y: Math.min(...pts.map((p) => p.y)) };
}

const STEP = 450; // mm entre deux symboles posés automatiquement
const COLS = 4;

function syncPlan(project: Project, isNew: (id: string) => boolean, rep: SyncReport): PlanPage[] {
  const pages = project.plan.pages.map((p) => ({ ...p, symbols: [...p.symbols] }));
  if (!pages.length) return pages;
  const onPlan = new Set(pages.flatMap((p) => p.symbols.map((s) => s.nodeId)));
  const perLabel = new Map<string, number>();
  const leftover: ElNode[] = [];
  for (const { node } of walk(project.roots)) {
    if (!PLAN_KINDS.has(node.kind) || onPlan.has(node.id) || !isNew(node.id)) continue;
    const loc = node.location ? norm(node.location) : '';
    let hit: { page: number; label: PlanPage['labels'][number] } | undefined;
    if (loc)
      for (let i = 0; i < pages.length && !hit; i++)
        for (const l of pages[i].labels) {
          const lt = norm(l.text);
          if (lt && (lt === loc || loc.startsWith(lt + ' ') || lt.startsWith(loc + ' '))) {
            hit = { page: i, label: l };
            break;
          }
        }
    if (!hit) {
      leftover.push(node);
      continue;
    }
    const k = perLabel.get(hit.label.id) ?? 0;
    perLabel.set(hit.label.id, k + 1);
    const pos = { x: hit.label.pos.x + ((k % COLS) - (COLS - 1) / 2) * STEP, y: hit.label.pos.y + STEP * (1 + Math.floor(k / COLS)) };
    pages[hit.page].symbols.push({ nodeId: node.id, pos, rotation: 0 });
    rep.planByRoom++;
  }
  if (leftover.length) {
    const b = pageBounds(pages[0]) ?? { x: 0, y: 0 };
    leftover.forEach((node, i) => {
      pages[0].symbols.push({ nodeId: node.id, pos: { x: b.x - 900 - Math.floor(i / 20) * STEP, y: b.y + (i % 20) * STEP }, rotation: 0 });
    });
    rep.planToPlace += leftover.length;
  }
  return pages;
}

export function syncProject(
  project: Project,
  opts: { today: string; revisionText: (list: string) => string; firstRevisionText: string; addRevision?: boolean },
): { project: Project; report: SyncReport } {
  const known = project.meta.syncedIds ? new Set(project.meta.syncedIds) : null;
  const isNew = (id: string) => !known || !known.has(id);
  const numbering = computeNumbering(project.roots);
  const rep: SyncReport = { firstSync: !known, newCircuits: [], newNodes: 0, boardPlaced: 0, boardNoRoom: 0, planByRoom: 0, planToPlace: 0 };
  const all: string[] = [];
  for (const { node } of walk(project.roots)) {
    all.push(node.id);
    if (!isNew(node.id)) continue;
    rep.newNodes++;
    if (isCircuit(node)) rep.newCircuits.push(numbering.get(node.id) ?? '?');
  }
  const boards = syncBoards(project, isNew, rep);
  const pages = syncPlan(project, isNew, rep);
  const revisions = [...(project.meta.revisions ?? [])];
  if (opts.addRevision !== false && (rep.newNodes > 0 || !revisions.length)) {
    const version = String(revisions.length + 1);
    const description = !revisions.length ? opts.firstRevisionText : opts.revisionText(rep.newCircuits.join(', ') || String(rep.newNodes));
    revisions.push({ version, date: opts.today, description });
    rep.revision = version;
  }
  return {
    project: { ...project, boards, plan: { ...project.plan, pages }, meta: { ...project.meta, revisions, syncedIds: all } },
    report: rep,
  };
}
