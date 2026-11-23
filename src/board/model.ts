/**
 * Tableaux électriques : enveloppes, appareils modulaires, disposition sur les rails DIN.
 * Fonctions pures (testées).
 *
 * - Une « enveloppe » est un tableau physique. Dans l'arbre, un tableau placé sous un différentiel du même
 *   tableau (sans canalisation entre les deux) sert seulement à grouper des circuits : il fait partie de la
 *   même enveloppe. Un tableau alimenté par une canalisation est un tableau divisionnaire (autre enveloppe).
 * - Largeur des appareils en modules de 17,5 mm : propriété `modules` si elle est remplie, sinon valeur
 *   usuelle selon l'appareil et le nombre de pôles. Un disjoncteur 1P+N peut faire 1 ou 2 modules selon la
 *   gamme : à préciser sur l'appareil.
 */
import type { BoardLayout, ElNode } from '../model/types';

export interface Enclosure {
  board: ElNode;
  /** Appareils modulaires, dans l'ordre de l'arbre (différentiel puis ses disjoncteurs). */
  devices: ElNode[];
}

export function enclosures(roots: ElNode[]): Enclosure[] {
  const out: Enclosure[] = [];
  /**
   * `enc` : tableau courant ; `crossed` : une canalisation a été franchie depuis ce tableau ;
   * `pending` : protections rencontrées depuis la dernière canalisation (ex. différentiel général
   * placé avant la barre du tableau dans le schéma : il est dans le tableau).
   */
  const walk = (n: ElNode, enc: Enclosure | null, crossed: boolean, pending: ElNode[]) => {
    let e = enc;
    let pend = pending;
    if (n.kind === 'board' && (!enc || crossed)) {
      e = { board: n, devices: [...pending] };
      out.push(e);
      crossed = false;
      pend = [];
    }
    if (n.kind === 'protection') {
      if (e && !crossed) e.devices.push(n);
      else pend = [...pend, n];
    } else if (e && isModularInBoard(n)) e.devices.push(n);
    for (const c of n.children) walk(c, e, crossed || n.kind === 'cable', n.kind === 'cable' ? [] : pend);
  };
  for (const r of roots) walk(r, null, false, []);
  return out;
}

/**
 * Éléments autres que les protections montés sur le rail : relais, télérupteur, contacteur, horloge,
 * transformateur, compteur divisionnaire, module domotique… Dans le schéma ils viennent souvent après
 * une canalisation (et un transformateur peut aussi être au plafond) : la case « Dans le tableau »
 * (`inBoard`) décide. Par défaut : relais et compteurs oui, le reste non.
 */
export const BOARD_EXTRA_KINDS = new Set(['relay', 'transformer', 'meter', 'domotic', 'other']);
export function isModularInBoard(n: ElNode): boolean {
  if (!BOARD_EXTRA_KINDS.has(n.kind)) return false;
  if (typeof n.props.inBoard === 'boolean') return n.props.inBoard;
  return n.kind === 'relay' || n.kind === 'meter';
}

/**
 * Éléments de l'unifilaire de ce tableau qui pourraient être sur le rail mais n'y sont pas comptés
 * (case « Dans le tableau » décochée) : candidats pour un appareil vu sur la photo et absent du projet.
 * Les tableaux divisionnaires (autres enveloppes) ne sont pas parcourus.
 */
export function boardCandidates(enc: Enclosure, all: Enclosure[]): ElNode[] {
  const others = new Set(all.filter((e) => e !== enc).map((e) => e.board.id));
  const out: ElNode[] = [];
  const walk = (n: ElNode) => {
    if (others.has(n.id)) return;
    if (BOARD_EXTRA_KINDS.has(n.kind) && !isModularInBoard(n)) out.push(n);
    n.children.forEach(walk);
  };
  enc.board.children.forEach(walk);
  return out;
}

/** Largeur d'un appareil en modules. */
export function moduleWidth(n: ElNode): number {
  const m = Number(n.props.modules);
  if (m > 0) return Math.round(m);
  if (n.kind === 'relay') return n.props.relayType === 'contactor' || n.props.relayType === 'timer' ? 2 : 1;
  if (n.kind === 'transformer' || n.kind === 'meter') return 2;
  if (n.kind !== 'protection') return 1;
  const device = String(n.props.device ?? 'mcb');
  const poles = String(n.props.poles ?? '1P+N');
  const p = poles.startsWith('4') || poles === '3P+N' ? 4 : poles.startsWith('3') ? 3 : poles.startsWith('2') ? 2 : 1;
  switch (device) {
    case 'rcd':
      return p >= 3 ? 4 : 2;
    case 'rcbo':
      return p >= 3 ? 4 : 2;
    case 'switch':
      return Math.max(2, p);
    case 'fuse':
      return Math.max(1, p);
    default: // disjoncteur
      return poles === '1P+N' || poles === '1P' ? 1 : p;
  }
}

export interface Placed {
  node: ElNode;
  row: number;
  col: number;
  width: number;
}

export function boardSize(board: ElNode): { rows: number; perRow: number } {
  return { rows: Math.max(1, Number(board.props.rows) || 2), perRow: Math.max(4, Number(board.props.modulesPerRow) || 13) };
}

/** Appareils placés (et non placés) selon la disposition enregistrée. */
export function placed(enc: Enclosure, layout: BoardLayout | undefined): { placed: Placed[]; unplaced: ElNode[] } {
  const out: Placed[] = [];
  const un: ElNode[] = [];
  for (const d of enc.devices) {
    const s = layout?.slots[d.id];
    if (s) out.push({ node: d, row: s.row, col: s.col, width: moduleWidth(d) });
    else un.push(d);
  }
  return { placed: out, unplaced: un };
}

/** Disposition automatique : ordre de l'arbre, un appareil ne coupe jamais une rangée. */
export function autoLayout(enc: Enclosure, rows: number, perRow: number): BoardLayout {
  const slots: BoardLayout['slots'] = {};
  let row = 0;
  let col = 0;
  for (const d of enc.devices) {
    const w = moduleWidth(d);
    if (col + w > perRow) {
      row++;
      col = 0;
    }
    if (row >= rows) break;
    slots[d.id] = { row, col };
    col += w;
  }
  return { slots };
}

/**
 * Place (ou déplace) un appareil à (row, col). Les appareils de la rangée situés à droite sont poussés
 * pour faire de la place. Renvoie null si la rangée déborde.
 */
export function placeDevice(enc: Enclosure, layout: BoardLayout, id: string, row: number, col: number, perRow: number): BoardLayout | null {
  const dev = enc.devices.find((d) => d.id === id);
  if (!dev) return null;
  const w = moduleWidth(dev);
  if (col < 0 || col + w > perRow) return null;
  const slots = { ...layout.slots };
  delete slots[id];
  // Appareils de la rangée, triés
  const inRow = enc.devices
    .filter((d) => slots[d.id]?.row === row)
    .map((d) => ({ id: d.id, col: slots[d.id].col, w: moduleWidth(d) }))
    .sort((a, b) => a.col - b.col);
  // Ceux qui chevauchent ou suivent la position choisie sont poussés vers la droite.
  let end = col + w;
  for (const d of inRow) {
    if (d.col + d.w <= col) continue; // entièrement à gauche
    if (d.col < col) {
      // chevauche par la gauche : on place le nouvel appareil juste après
      return placeDevice(enc, layout, id, row, d.col + d.w, perRow);
    }
    if (d.col < end) {
      d.col = end;
    }
    end = Math.max(end, d.col + d.w);
    if (d.col + d.w > perRow) return null;
    slots[d.id] = { row, col: d.col };
  }
  slots[id] = { row, col };
  return { ...layout, slots };
}

/** Retire un appareil du tableau (il retourne dans la réserve). */
export function unplaceDevice(layout: BoardLayout, id: string): BoardLayout {
  const slots = { ...layout.slots };
  delete slots[id];
  return { ...layout, slots };
}

/**
 * Comparaison avec la photo : `isBoundary(p)` dit si la photo montre une séparation entre deux appareils
 * à la position entière p (en modules). Un bord n'est exigé que là où il est vérifiable : pas à gauche du
 * premier appareil d'une rangée ni à côté d'un emplacement vide du projet (cache, réserve).
 *  - « width » : séparation au milieu de l'appareil (plusieurs appareils plus étroits sur la photo),
 *    ou séparation absente à un bord (appareil plus large sur la photo) ;
 *  - « ok » : bords vérifiables présents, pas de séparation intérieure.
 */
export function compareRow(devices: Placed[], isBoundary: (p: number) => boolean | undefined, perRow: number): Map<string, 'ok' | 'width' | 'unsure'> {
  const occupied = new Set<number>();
  for (const d of devices) for (let i = d.col; i < d.col + d.width; i++) occupied.add(i);
  const res = new Map<string, 'ok' | 'width' | 'unsure'>();
  for (const d of devices) {
    const left = d.col === 0 || !occupied.has(d.col - 1) ? true : isBoundary(d.col);
    const right = d.col + d.width >= perRow || !occupied.has(d.col + d.width) ? true : isBoundary(d.col + d.width);
    let inside = false;
    for (let p = d.col + 1; p < d.col + d.width; p++) if (isBoundary(p)) inside = true;
    if (left === undefined || right === undefined) res.set(d.node.id, 'unsure');
    else res.set(d.node.id, inside || !left || !right ? 'width' : 'ok');
  }
  return res;
}

/**
 * Disposition proposée d'après la photo (sans IA), rangée par rangée (voir RowAnalysis, src/board/photo.ts).
 *  1. appareils de 2 modules ou plus, dans l'ordre de l'arbre : premier emplacement (rangée par rangée, de gauche
 *     à droite) entièrement occupé sur la photo, bordé de deux bords francs, sans séparation franche à l'intérieur
 *     (la jointure entre pôles est faible). Une suite de disjoncteurs d'un module ne passe donc pas pour un 4P.
 *  2. appareils d'un module, dans l'ordre de l'arbre : modules occupés restants, de gauche à droite.
 * Ce qui ne trouve pas de place reste en réserve ; les modules occupés sur la photo sans appareil sont signalés.
 * C'est une proposition : la photo ne dit ni le calibre ni le type ; à vérifier et corriger à la souris.
 */
export function layoutFromPhotoRows(
  devices: ElNode[],
  rows: { occupied: boolean[]; force: number[] }[],
): { slots: BoardLayout['slots']; unplaced: ElNode[]; extra: { row: number; col: number; width: number }[] } {
  const used = rows.map((r) => r.occupied.map(() => false));
  const slots: BoardLayout['slots'] = {};
  const unplaced: ElNode[] = [];
  const fits = (r: number, s: number, w: number) => {
    const { occupied, force } = rows[r];
    if (s + w > occupied.length) return false;
    for (let c = s; c < s + w; c++) if (!occupied[c] || used[r][c]) return false;
    const edge = Math.min(force[s] ?? 0, force[s + w] ?? 0);
    let inner = 0;
    for (let c = s + 1; c < s + w; c++) inner = Math.max(inner, force[c] ?? 0);
    return edge >= 6 && inner < 0.5 * edge;
  };
  const take = (d: ElNode, r: number, s: number, w: number) => {
    slots[d.id] = { row: r, col: s };
    for (let c = s; c < s + w; c++) used[r][c] = true;
  };
  for (const d of devices.filter((x) => moduleWidth(x) >= 2)) {
    const w = moduleWidth(d);
    let done = false;
    for (let r = 0; r < rows.length && !done; r++)
      for (let s = 0; s + w <= rows[r].occupied.length && !done; s++)
        if (fits(r, s, w)) {
          take(d, r, s, w);
          done = true;
        }
    if (!done) unplaced.push(d);
  }
  for (const d of devices.filter((x) => moduleWidth(x) < 2)) {
    let done = false;
    for (let r = 0; r < rows.length && !done; r++)
      for (let c = 0; c < rows[r].occupied.length && !done; c++)
        if (rows[r].occupied[c] && !used[r][c]) {
          take(d, r, c, 1);
          done = true;
        }
    if (!done) unplaced.push(d);
  }
  const extra: { row: number; col: number; width: number }[] = [];
  rows.forEach((r, ri) => {
    for (let c = 0; c < r.occupied.length; c++) {
      if (!r.occupied[c] || used[ri][c]) continue;
      const last = extra[extra.length - 1];
      if (last && last.row === ri && last.col + last.width === c) last.width++;
      else extra.push({ row: ri, col: c, width: 1 });
    }
  });
  return { slots, unplaced: [...new Set(unplaced)], extra };
}
