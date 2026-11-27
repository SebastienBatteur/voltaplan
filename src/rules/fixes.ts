/**
 * Corrections en un clic des constats du contrôle (bouton « corriger ») : seulement quand la correction est sans
 * ambiguïté et découle du constat lui-même (valeur maximale admise, propriété manquante, regroupement sous un 30 mA
 * existant). Chaque correction est une fonction pure du projet, appliquée par `applyProject` : elle s'annule par
 * « Annuler » comme toute autre modification, et le contrôle se relance tout seul.
 */
import { CIRCUITS_PER_RCD30_MAX, RCD_HIGH_SENSITIVITY } from '../regulations/be/values';
import type { ElNode, Project } from '../model/types';
import { createNode, walk } from '../model/tree';
import type { Finding } from './types';

export interface Fix {
  /** Clé de traduction du libellé du bouton (« fix.… »). */
  label: string;
  params?: Record<string, string | number>;
  apply: (p: Project) => Project;
}

const clone = (p: Project): Project => structuredClone(p);

/** Nœud et ses ancêtres (du plus haut au parent), dans un projet. */
function locate(p: Project, id: string): { node: ElNode; chain: ElNode[] } | undefined {
  const rec = (nodes: ElNode[], chain: ElNode[]): { node: ElNode; chain: ElNode[] } | undefined => {
    for (const n of nodes) {
      if (n.id === id) return { node: n, chain };
      const r = rec(n.children, [...chain, n]);
      if (r) return r;
    }
    return undefined;
  };
  return rec(p.roots, []);
}

/** Modification d'un nœud d'une copie du projet. */
const patchNode = (id: string, fn: (n: ElNode, chain: ElNode[]) => void) => (p: Project) => {
  const q = clone(p);
  const hit = locate(q, id);
  if (hit) fn(hit.node, hit.chain);
  return q;
};

const isRcd30 = (n: ElNode) => n.kind === 'protection' && Number(n.props.residualCurrent) > 0 && Number(n.props.residualCurrent) <= RCD_HIGH_SENSITIVITY.value;
const OVERCURRENT = new Set(['mcb', 'rcbo', 'fuse']);
const isCircuitProt = (n: ElNode) => n.kind === 'protection' && OVERCURRENT.has(String(n.props.device ?? 'mcb'));

/** Circuits terminaux sous un différentiel (disjoncteurs qui alimentent un câble). */
const circuitsUnder = (rcd: ElNode) => [...walk(rcd.children)].filter(({ node }) => isCircuitProt(node) && node.children.some((c) => c.kind === 'cable')).length;

/** Endroit où ranger un circuit sous ce différentiel : son groupe (tableau « 30 mA ») s'il en a un, sinon lui-même. */
const groupOf = (rcd: ElNode) => rcd.children.find((c) => c.kind === 'board') ?? rcd;

export function fixesFor(f: Finding, project: Project): Fix[] {
  const id = f.nodeId;
  if (!id) return [];
  const hit = locate(project, id);
  if (!hit) return [];
  const { chain } = hit;
  switch (f.ruleId) {
    case 'R-CABLE-PROT': {
      // Calibre trop grand pour la section : choisir le calibre maximal admis pour ce câble
      const max = Number(f.params?.max);
      const prot = [...chain].reverse().find(isCircuitProt);
      if (!prot || !Number.isFinite(max)) return [];
      return [{ label: 'fix.rating', params: { value: max }, apply: patchNode(prot.id, (n) => void (n.props.ratedCurrent = max)) }];
    }
    case 'R-CABLE-MIN':
      return [{ label: 'fix.section', params: { value: '1,5' }, apply: patchNode(id, (n) => void (n.props.section = 1.5)) }];
    case 'R-SOCKET-SECTION':
      return [
        {
          label: 'fix.section',
          params: { value: '2,5' },
          apply: patchNode(id, (n) => {
            for (const { node: c } of walk(n.children)) if (c.kind === 'cable' && Number(c.props.section) < 2.5) c.props.section = 2.5;
          }),
        },
      ];
    case 'R-SOCKET-CHILD':
    case 'R-SOCKET-IPXXD':
      return [{ label: 'fix.childSafety', apply: patchNode(id, (n) => void (n.props.childSafety = true)) }];
    case 'R-SOCKET-EARTH':
      return [{ label: 'fix.earth', apply: patchNode(id, (n) => void (n.props.earth = true)) }];
    case 'R-POLES-NO-NEUTRAL':
      return [{ label: 'fix.poles2P', apply: patchNode(id, (n) => void (n.props.poles = '2P')) }];
    case 'R-RCD-TYPE-A':
      return [{ label: 'fix.rcdTypeA', apply: patchNode(id, (n) => void (n.props.rcdType = 'A')) }];
    case 'R-RCD30': {
      // Circuit qui doit être derrière un 30 mA : le ranger sous un 30 mA du même tableau qui a encore de la place
      // (8 circuits au plus, RGIE 4.2.4.3 b), sinon en créer un nouveau dans ce tableau.
      if (f.knowledge === 'unknown' || chain.some(isRcd30)) return [];
      const board = [...chain].reverse().find((a) => a.kind === 'board');
      if (!board) return [];
      const candidates = board.children.filter((c) => isRcd30(c) && circuitsUnder(c) < CIRCUITS_PER_RCD30_MAX.value);
      const move = (target: ElNode | null) => (p: Project) => {
        const q = clone(p);
        const me = locate(q, id);
        const b = locate(q, board.id)?.node;
        if (!me || !b) return q;
        const parent = me.chain.at(-1);
        if (!parent) return q;
        parent.children = parent.children.filter((c) => c.id !== id);
        let rcd = target ? locate(q, target.id)?.node : undefined;
        if (!rcd) {
          rcd = createNode('protection', { device: 'rcd', residualCurrent: 30, ratedCurrent: 40, poles: '2P', rcdType: 'A' });
          rcd.children.push(createNode('board', { name: '30 mA' }));
          // Avant la terre (barrette), qui reste en fin de tableau
          const earthAt = b.children.findIndex((c) => c.kind === 'earthBar');
          b.children.splice(earthAt < 0 ? b.children.length : earthAt, 0, rcd);
        }
        groupOf(rcd).children.push(me.node);
        return q;
      };
      if (candidates.length) {
        const best = candidates[0];
        return [{ label: 'fix.moveUnder30', params: { count: circuitsUnder(best) + 1 }, apply: move(best) }];
      }
      return [{ label: 'fix.new30', apply: move(null) }];
    }
    default:
      return [];
  }
}

/** Constats qui se règlent dans l'onglet Projet (mentions du dossier) : bouton qui y mène. */
export const PROJECT_FIELDS = new Set(['R-DOC-INSTALLER', 'R-DOC-ADDRESS', 'R-DOC-SUPPLY', 'R-DOC-NUMBER', 'R-DOC-QUALITY']);
