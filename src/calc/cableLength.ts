/**
 * Longueur des câbles estimée d'après le plan de position (fonction pure, testée), comme le font les logiciels qui
 * estiment « selon le plan » : trajet du tableau aux points du circuit, dans l'ordre du schéma, à angles droits (le
 * long des murs plutôt qu'à vol d'oiseau), plus les montées et descentes, plus une marge de raccordement.
 *
 * La longueur obtenue est marquée « estimée » (`lengthEstimated`) : une longueur saisie à la main n'est jamais
 * remplacée, et la saisie d'une longueur enlève la marque. Le RGIE n'exige pas la longueur des canalisations sur le
 * schéma d'une installation domestique (3.1.2.2 a) ; elle sert au calcul de la chute de tension et à la liste du
 * matériel.
 */
import { ancestors, circuitContent, isCircuit, walk } from '../model/tree';
import type { ElNode, PlanPage, Project, Pt } from '../model/types';

/** Montées et descentes (mm) : par point selon sa hauteur de pose, et au départ du tableau. */
const VERTICAL: Partial<Record<ElNode['kind'], number>> = {
  socket: 2500, // descente du plafond (ou montée du sol) jusqu'au socle, et retour vers le point suivant
  switch: 2500,
  pushButton: 2500,
  detector: 1500,
  bell: 1500,
  appliance: 1500,
  motor: 1500,
  other: 1500,
  light: 300, // point lumineux au plafond : raccordement dans la boîte
};
const BOARD_RISE = 1500;
/** Changement d'étage (hauteur d'étage, montée comprise). */
const FLOOR = 3000;
/** Marge de raccordement et de cheminement. */
const MARGIN = 1.1;

const manhattan = (a: Pt, b: Pt) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export interface LengthEstimate {
  project: Project;
  /** Câbles dont la longueur a été (ré)estimée. */
  estimated: number;
  /** Câbles sans longueur et sans point posé sur le plan : impossible d'estimer. */
  notPlaced: number;
  /** Câbles estimés sans le tableau sur le plan : trajet compté depuis le premier point (trop court). */
  noBoard: number;
}

/** Estime la longueur des câbles des circuits dont les points sont posés sur le plan (sans toucher aux saisies). */
export function estimateCableLengths(project: Project): LengthEstimate {
  const where = new Map<string, { page: number; pos: Pt }>();
  project.plan.pages.forEach((pg: PlanPage, i) => {
    for (const s of pg.symbols) if (!where.has(s.nodeId)) where.set(s.nodeId, { page: i, pos: s.pos });
  });
  const lengths = new Map<string, number>();
  let notPlaced = 0;
  let noBoard = 0;
  for (const { node: circuit } of walk(project.roots)) {
    if (!isCircuit(circuit)) continue;
    // Départ : le tableau qui contient la protection du circuit, s'il est posé sur le plan
    const board = [...ancestors(project.roots, circuit.id)].reverse().find((n) => n.kind === 'board');
    const start = board ? where.get(board.id) : undefined;
    for (const cable of circuitContent(circuit).filter((c) => c.kind === 'cable')) {
      if (Number(cable.props.length) > 0 && cable.props.lengthEstimated !== true) continue;
      // Points alimentés par ce câble, dans l'ordre du schéma (ordre de pose)
      const pts: ElNode[] = [];
      const rec = (list: ElNode[]) => {
        for (const c of list) {
          if (c.kind === 'board' || c.kind === 'protection' || c.kind === 'cable') continue;
          pts.push(c);
          rec(c.children);
        }
      };
      rec(cable.children);
      const placed = pts.filter((p) => where.has(p.id));
      if (!placed.length) {
        if (!(Number(cable.props.length) > 0)) notPlaced++;
        continue;
      }
      let mm = 0;
      let cur = start ?? where.get(placed[0].id)!;
      if (start) mm += BOARD_RISE;
      else noBoard++;
      for (const p of placed) {
        const w = where.get(p.id)!;
        mm += w.page === cur.page ? manhattan(cur.pos, w.pos) : FLOOR * Math.abs(w.page - cur.page) + manhattan(cur.pos, w.pos);
        mm += VERTICAL[p.kind] ?? 1000;
        cur = w;
      }
      lengths.set(cable.id, Math.max(1, Math.ceil((mm * MARGIN) / 1000)));
    }
  }
  if (!lengths.size) return { project, estimated: 0, notPlaced, noBoard };
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
  return { project: { ...project, roots: upd(project.roots) }, estimated: lengths.size, notPlaced, noBoard };
}
