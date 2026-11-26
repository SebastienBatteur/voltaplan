import { FILE_FORMAT } from '../brand';
import type { ElNode, NodeKind, PlanPage, Project } from './types';
import { defaultProps } from './schema';

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function createNode(kind: NodeKind, props: ElNode['props'] = {}): ElNode {
  return { id: uid(), kind, props: { ...defaultProps(kind), ...props }, children: [] };
}

export function* walk(nodes: ElNode[], parent: ElNode | null = null, depth = 0): Generator<{ node: ElNode; parent: ElNode | null; depth: number }> {
  for (const node of nodes) {
    yield { node, parent, depth };
    yield* walk(node.children, node, depth + 1);
  }
}

export function findNode(nodes: ElNode[], id: string): ElNode | undefined {
  for (const { node } of walk(nodes)) if (node.id === id) return node;
  return undefined;
}

/** Chemin des ancêtres (racine → parent direct), sans le nœud lui-même. */
export function ancestors(nodes: ElNode[], id: string): ElNode[] {
  const path: ElNode[] = [];
  const rec = (list: ElNode[]): boolean => {
    for (const n of list) {
      if (n.id === id) return true;
      path.push(n);
      if (rec(n.children)) return true;
      path.pop();
    }
    return false;
  };
  return rec(nodes) ? path : [];
}

export function findParent(nodes: ElNode[], id: string): ElNode | null {
  const a = ancestors(nodes, id);
  return a.length ? a[a.length - 1] : null;
}

/** Copie modifiée de l'arbre (immutabilité simple : les projets restent petits). */
export function mapTree(nodes: ElNode[], fn: (n: ElNode) => ElNode): ElNode[] {
  return nodes.map((n) => {
    const m = fn(n);
    return { ...m, children: mapTree(m.children, fn) };
  });
}

export function updateNode(nodes: ElNode[], id: string, patch: (n: ElNode) => ElNode): ElNode[] {
  return nodes.map((n) => (n.id === id ? patch(n) : { ...n, children: updateNode(n.children, id, patch) }));
}

export function removeNode(nodes: ElNode[], id: string): ElNode[] {
  return nodes.filter((n) => n.id !== id).map((n) => ({ ...n, children: removeNode(n.children, id) }));
}

export function insertChild(nodes: ElNode[], parentId: string, child: ElNode, index?: number): ElNode[] {
  return updateNode(nodes, parentId, (p) => {
    const children = [...p.children];
    children.splice(index ?? children.length, 0, child);
    return { ...p, children };
  });
}

/** Déplace un nœud parmi ses frères (delta = -1 haut, +1 bas). */
export function moveSibling(nodes: ElNode[], id: string, delta: number): ElNode[] {
  const idx = nodes.findIndex((n) => n.id === id);
  if (idx >= 0) {
    const j = idx + delta;
    if (j < 0 || j >= nodes.length) return nodes;
    const copy = [...nodes];
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    return copy;
  }
  return nodes.map((n) => ({ ...n, children: moveSibling(n.children, id, delta) }));
}

export function cloneWithNewIds(node: ElNode): ElNode {
  return { ...node, id: uid(), props: { ...node.props }, source: undefined, children: node.children.map(cloneWithNewIds) };
}

/**
 * Protection montée en série dans le même circuit (ex. disjoncteur connecté avec mesure derrière le disjoncteur
 * du circuit) : elle fait partie du circuit au-dessus, ne prend pas de lettre et n'en crée pas un nouveau.
 */
export const isSeries = (n: ElNode): boolean => n.kind === 'protection' && n.props.series === true;

/** Éléments en aval d'un nœud, sans descendre dans un sous-tableau ou une autre protection (sauf en série). */
export function circuitContent(circuit: ElNode): ElNode[] {
  const out: ElNode[] = [];
  const rec = (list: ElNode[]) => {
    for (const c of list) {
      if (c.kind === 'board' || (c.kind === 'protection' && !isSeries(c))) continue;
      out.push(c);
      rec(c.children);
    }
  };
  rec(circuit.children);
  return out;
}

/**
 * Un « circuit terminal » = une protection qui alimente une canalisation menant à des points
 * d'utilisation (et pas seulement un câble d'alimentation vers un sous-tableau).
 */
export function isCircuit(n: ElNode): boolean {
  if (n.kind !== 'protection' || isSeries(n)) return false;
  const content = circuitContent(n);
  return content.some((c) => c.kind === 'cable') && content.some((c) => c.kind !== 'cable' && c.kind !== 'protection');
}

/**
 * Insère une protection en série sous `parentId` : elle reprend les enfants du parent qu'elle peut porter
 * (câbles, sous-tableaux, protections) ; le parent ne garde que les autres. Le circuit ne change pas.
 */
export function insertInSeries(nodes: ElNode[], parentId: string, child: ElNode): ElNode[] {
  return updateNode(nodes, parentId, (p) => {
    const allowed = new Set<string>(['cable', 'board', 'protection']);
    const moved = p.children.filter((c) => allowed.has(c.kind));
    return { ...p, children: [...p.children.filter((c) => !allowed.has(c.kind)), { ...child, children: [...child.children, ...moved] }] };
  });
}

export function isRcd(n: ElNode): boolean {
  return n.kind === 'protection' && (n.props.device === 'rcd' || n.props.device === 'rcbo' || Number(n.props.residualCurrent) > 0);
}

function letterFor(i: number): string {
  let s = '';
  i += 1;
  while (i > 0) {
    const r = (i - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

/**
 * Numérotation belge : chaque circuit reçoit une lettre (A, B, C…), chaque élément
 * du circuit un numéro (A1, A2…). Ce repère est affiché sur l'unifilaire ET sur le plan.
 */
/** Éléments numérotés sur l'unifilaire et le plan (RGIE 3.1.2.1). */
const NUMBERED = new Set(['socket', 'light', 'appliance', 'domotic', 'motor', 'bell', 'detector', 'other']);
/** Commandes : elles prennent le numéro du point qu'elles commandent. */
const COMMANDS = new Set(['switch', 'pushButton', 'relay']);

export function computeNumbering(roots: ElNode[]): Map<string, string> {
  const labels = new Map<string, string>();
  let next = 0;
  const used = new Set<string>();
  for (const { node } of walk(roots)) {
    const fl = String(node.props.fixedLetter ?? '').trim();
    if (fl) used.add(fl.toUpperCase());
  }
  /**
   * RGIE 3.1.2.1 : chaque point lumineux, socle de prise et unité de commande reçoit un numéro dans l'ordre
   * où on le rencontre depuis la protection. Un interrupteur (ou bouton-poussoir, télérupteur) porte
   * la lettre du circuit et le numéro du point qu'il commande.
   */
  const numberCircuit = (circuit: ElNode, letter: string) => {
    labels.set(circuit.id, letter);
    const sep = /\d$/.test(letter) ? '.' : '';
    let k = 0;
    const commands: ElNode[] = [];
    const rec = (list: ElNode[]) => {
      for (const c of list) {
        if (c.kind === 'board' || (c.kind === 'protection' && c !== circuit && !isSeries(c))) continue; // sous-tableau : numérotation propre
        if (NUMBERED.has(c.kind)) labels.set(c.id, `${letter}${sep}${++k}`);
        else if (COMMANDS.has(c.kind)) commands.push(c);
        rec(c.children);
      }
    };
    rec(circuit.children);
    // Commandes : numéro du premier point commandé (à travers les va-et-vient, télérupteurs…)
    const firstPoint = (n: ElNode): string | undefined => {
      for (const c of n.children) {
        if (labels.has(c.id) && NUMBERED.has(c.kind)) return labels.get(c.id);
        if (COMMANDS.has(c.kind) || c.kind === 'cable' || c.kind === 'junctionBox' || c.kind === 'transformer') {
          const r = firstPoint(c);
          if (r) return r;
        }
      }
      return undefined;
    };
    for (const c of commands) {
      const r = firstPoint(c);
      labels.set(c.id, r ?? `${letter}${sep}${++k}`);
    }
  };
  for (const { node } of walk(roots)) {
    if (!isCircuit(node)) continue;
    const fl = String(node.props.fixedLetter ?? '').trim().toUpperCase();
    let letter = fl;
    if (!letter) {
      do letter = letterFor(next++);
      while (used.has(letter));
    }
    numberCircuit(node, letter);
  }
  return labels;
}

export function emptyPage(name: string): PlanPage {
  return { id: uid(), name, walls: [], openings: [], rects: [], images: [], symbols: [], labels: [] };
}

/**
 * Numéro de dossier proposé automatiquement (RGIE 3.1.2 : « numéro, version et date de la version ») : c'est
 * l'installateur qui le donne, pas l'organisme agréé. Date du projet + 3 caractères au hasard (ex. 2026-11-25-K7Q),
 * modifiable dans l'onglet Projet.
 */
/** Date du jour au format AAAA-MM-JJ, à l'heure locale (et non UTC : un projet créé à 0 h 30 garde sa date). */
export function localIsoDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function autoDocNumber(date: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rnd = new Uint8Array(3);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(rnd);
  else for (let i = 0; i < rnd.length; i++) rnd[i] = Math.floor(Math.random() * 256);
  const day = /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : localIsoDate();
  return day + '-' + [...rnd].map((b) => chars[b % chars.length]).join('');
}

export function emptyProject(): Project {
  const origin = createNode('origin');
  const meter = createNode('meter');
  const main = createNode('protection', { device: 'rcd', ratedCurrent: 40, residualCurrent: 300, poles: '2P', rcdType: 'A' });
  const board = createNode('board', { name: 'Tableau principal' });
  // RGIE 4.2.4.3 b (depuis le 1/6/2023) : prises et éclairage derrière un différentiel 30 mA ; un premier 30 mA
  // est donc prévu, avec son groupe de circuits (même tableau).
  const rcd30 = createNode('protection', { device: 'rcd', ratedCurrent: 40, residualCurrent: 30, poles: '2P', rcdType: 'A' });
  rcd30.children.push(createNode('board', { name: '30 mA' }));
  board.children.push(rcd30);
  main.children.push(board);
  meter.children.push(main);
  origin.children.push(meter);
  return {
    format: FILE_FORMAT,
    version: 2,
    meta: {
      title: 'Nouveau projet',
      client: { address: { country: 'Belgique' } },
      site: { country: 'Belgique' },
      installer: { address: {} },
      date: localIsoDate(),
      docNumber: autoDocNumber(localIsoDate()),
      supply: '2 x 230V ~ 50Hz',
      earthing: 'TT',
      installationKind: 'new',
      rgieVersion: 'new',
    },
    roots: [origin],
    loose: [],
    plan: { pages: [emptyPage('Rez-de-chaussée')], width: 20000, height: 15000 },
    measurements: {},
  };
}

/**
 * Chaîne d'un élément : tout ce qui l'alimente (jusqu'à l'origine) et tout ce qu'il alimente.
 * Sert à mettre la chaîne en évidence quand on sélectionne un élément.
 */
export function chainIds(nodes: ElNode[], id: string | null): Set<string> {
  const out = new Set<string>();
  if (!id) return out;
  const node = findNode(nodes, id);
  if (!node) return out;
  for (const a of ancestors(nodes, id)) out.add(a.id);
  for (const { node: n } of walk([node])) out.add(n.id);
  return out;
}
