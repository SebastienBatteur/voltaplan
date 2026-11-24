/**
 * Bilan de puissance et équilibre des phases par tableau (fonctions pures, sans React).
 *
 *  - Puissance installée d'un circuit = somme des puissances saisies de ses charges
 *    (appareil, moteur : `power` ; point lumineux : `power` × `count`). Les prises sans appareil
 *    de puissance connue et les charges sans puissance sont comptées comme « inconnues » : le total
 *    est alors un minimum. Les productions (panneaux, onduleurs) ne sont pas des charges.
 *  - Tableau : circuits dont le tableau le plus proche au-dessus est ce tableau (les sous-tableaux
 *    ont leur propre bilan). Circuits hors tableau : groupe `boardId = null`.
 *  - Phase : propriété `phase` (L1/L2/L3) de la protection du circuit ou, à défaut, de la plus proche
 *    protection au-dessus. Circuit triphasé (3P, 3P+N, 4P) : 1/3 de sa puissance sur chaque phase.
 *    Circuit monophasé sans phase : « non attribué ».
 *  - Déséquilibre (réseau triphasé seulement, toute la puissance attribuée) :
 *    100 · max |P phase − P moyenne| / P moyenne.
 *  - Aucun facteur de simultanéité n'est supposé : la puissance appelée n'est donnée que si un
 *    facteur est saisi sur le tableau (`simultaneity`, entre 0 et 1).
 */
import type { ElNode, Project } from '../model/types';
import { ancestors, circuitContent, isCircuit, walk } from '../model/tree';

export type Phase = 'L1' | 'L2' | 'L3';
export const PHASES: Phase[] = ['L1', 'L2', 'L3'];

export interface BoardBalance {
  boardId: string | null;
  circuits: number;
  /** Puissance installée connue (W). */
  installedW: number;
  /** Charges dont la puissance est inconnue (le total est alors un minimum). */
  unknownLoads: number;
  perPhase: Record<Phase, number>;
  /** Puissance des circuits monophasés sans phase indiquée (W). */
  unassignedW: number;
  /** Déséquilibre (%), si calculable. */
  imbalancePct?: number;
  /** Facteur saisi et puissance appelée correspondante (W). */
  simultaneity?: number;
  demandW?: number;
}

function num(v: unknown): number | undefined {
  const x = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(x) && x > 0 ? x : undefined;
}

/** Puissance installée connue d'un circuit et nombre de charges inconnues. */
export function circuitPower(circuit: ElNode): { w: number; unknown: number } {
  let w = 0;
  let unknown = 0;
  for (const n of circuitContent(circuit)) {
    const p = num(n.props.power);
    switch (n.kind) {
      case 'appliance':
      case 'motor':
        if (p === undefined) unknown++;
        else w += p;
        break;
      case 'light':
        if (p === undefined) unknown++;
        else w += p * (num(n.props.count) ?? 1);
        break;
      case 'socket': {
        const apps = n.children.filter((c) => c.kind === 'appliance');
        // Socle(s) sans appareil désigné : charge inconnue (les appareils désignés sont comptés à part)
        if (!apps.length || (num(n.props.count) ?? 1) > apps.length) unknown++;
        break;
      }
      case 'other':
        unknown++;
        break;
    }
  }
  return { w, unknown };
}

export function imbalance(perPhase: Record<Phase, number>): number | undefined {
  const vals = PHASES.map((p) => perPhase[p]);
  const avg = vals.reduce((a, b) => a + b, 0) / 3;
  if (!(avg > 0)) return undefined;
  return (100 * Math.max(...vals.map((v) => Math.abs(v - avg)))) / avg;
}

export function balanceProject(project: Project): BoardBalance[] {
  const threePhaseSupply = /^\s*3/.test(String(project.meta.supply ?? ''));
  const byBoard = new Map<string | null, BoardBalance>();
  const get = (board: ElNode | undefined): BoardBalance => {
    const id = board?.id ?? null;
    let b = byBoard.get(id);
    if (!b) {
      const s = num(board?.props.simultaneity);
      b = { boardId: id, circuits: 0, installedW: 0, unknownLoads: 0, perPhase: { L1: 0, L2: 0, L3: 0 }, unassignedW: 0 };
      if (s !== undefined && s <= 1) b.simultaneity = s;
      byBoard.set(id, b);
    }
    return b;
  };
  for (const { node } of walk(project.roots)) {
    if (!isCircuit(node)) continue;
    const chain = ancestors(project.roots, node.id);
    const board = [...chain].reverse().find((a) => a.kind === 'board');
    const b = get(board);
    const { w, unknown } = circuitPower(node);
    b.circuits++;
    b.installedW += w;
    b.unknownLoads += unknown;
    if (/^[34]/.test(String(node.props.poles ?? ''))) {
      for (const p of PHASES) b.perPhase[p] += w / 3;
    } else {
      const ph = [node, ...[...chain].reverse()].find((a) => a.kind === 'protection' && PHASES.includes(a.props.phase as Phase))?.props.phase as Phase | undefined;
      if (ph) b.perPhase[ph] += w;
      else b.unassignedW += w;
    }
  }
  for (const b of byBoard.values()) {
    if (threePhaseSupply && b.unassignedW === 0) b.imbalancePct = imbalance(b.perPhase);
    if (b.simultaneity !== undefined) b.demandW = b.installedW * b.simultaneity;
  }
  return [...byBoard.values()];
}
