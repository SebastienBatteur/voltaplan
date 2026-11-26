/**
 * Liste du matériel, calculée à partir de l'installation (fonction pure, testée).
 *
 * Le matériel est désigné par ses caractéristiques et par la norme européenne harmonisée qui le définit
 * (ex. disjoncteur EN 60898-1, 2P C20 6 kA), pas par une référence fabricant : les références et même
 * les gammes changent d'un pays à l'autre (un même code peut désigner un 1P+N en 1 module dans un pays
 * et un 2P en 2 modules dans un autre). La référence fabricant reste possible (propriété « reference »),
 * à vérifier dans le catalogue du pays du chantier.
 *
 * Les câbles sont désignés selon le référentiel du projet (ex. VOB, XVB en Belgique), avec l'équivalent
 * harmonisé CENELEC quand il existe (ex. VOB ≈ H07V-U) : voir RulePack.equivalents.
 */
import type { ElNode, Project } from '../model/types';
import { ancestors, walk } from '../model/tree';
import { enclosures } from '../board/model';
import { fmtNum } from '../ui/labels';
import type { Lang } from '../i18n';

export type BomCategory = 'board' | 'protection' | 'cable' | 'socket' | 'switch' | 'light' | 'control' | 'earth' | 'energy' | 'other';
export const BOM_CATEGORIES: BomCategory[] = ['board', 'protection', 'cable', 'socket', 'switch', 'light', 'control', 'earth', 'energy', 'other'];

export interface BomLine {
  cat: BomCategory;
  /** Désignation (caractéristiques). */
  desc: string;
  /** Norme harmonisée ou équivalent harmonisé (câbles). */
  std: string;
  /** Référence fabricant saisie par l'utilisateur. */
  reference: string;
  /** Nombre de pièces (ou de tronçons pour les câbles). */
  qty: number;
  /** Câbles : longueur totale connue (m) et nombre de tronçons sans longueur. */
  length?: number;
  missingLength?: number;
  /** Une partie de la longueur est estimée d'après le plan. */
  estimated?: boolean;
  /** Repères (numérotation RGIE) des éléments concernés. */
  refs: string[];
}

/** Normes européennes harmonisées (EN) des appareils de protection, valables dans toute l'UE. */
export const DEVICE_STANDARD: Record<string, string> = {
  mcb: 'EN 60898-1',
  rcd: 'EN 61008-1',
  rcbo: 'EN 61009-1',
  fuse: 'EN 60269',
  switch: 'EN 60947-3 / EN 60669-2-4',
};

const KIND_CAT: Partial<Record<string, BomCategory>> = {
  board: 'board',
  protection: 'protection',
  cable: 'cable',
  socket: 'socket',
  switch: 'switch',
  pushButton: 'switch',
  light: 'light',
  relay: 'control',
  transformer: 'control',
  domotic: 'control',
  detector: 'control',
  bell: 'control',
  junctionBox: 'other',
  earthBar: 'earth',
  earth: 'earth',
  solarPanel: 'energy',
  inverter: 'energy',
  battery: 'energy',
  other: 'other',
};

type T = (k: string, p?: Record<string, string | number>) => string;

function protectionDesc(n: ElNode, lang: Lang, t: T): string {
  const p = n.props;
  const device = String(p.device ?? 'mcb');
  const parts = [t('enum.device.' + device)];
  if (p.poles) parts.push(String(p.poles));
  if (p.ratedCurrent) parts.push((p.curve && device !== 'rcd' && device !== 'switch' ? String(p.curve) : '') + fmtNum(p.ratedCurrent, lang) + ' A');
  if (p.residualCurrent) parts.push(`${p.residualCurrent} mA${p.rcdType ? ' type ' + p.rcdType : ''}`);
  if (p.breakingCapacity && device !== 'rcd' && device !== 'switch') parts.push(fmtNum(p.breakingCapacity, lang) + ' kA');
  if (p.modules) parts.push(t('bom.modules', { n: Number(p.modules) }));
  return parts.join(' · ');
}

function cableDesc(n: ElNode, lang: Lang): string {
  const p = n.props;
  const type = p.cableType ? String(p.cableType) : '?';
  const sec = fmtNum(p.section, lang);
  const cond = p.conductors ? String(p.conductors) : '';
  return [type, cond && sec ? `${cond}G${sec} mm²` : sec ? `${sec} mm²` : cond ? `${cond}G` : ''].filter(Boolean).join(' ');
}

function flag(on: unknown, label: string): string[] {
  return on === true ? [label] : [];
}

/** Désignation et quantité d'un nœud, ou null s'il ne s'achète pas (origine, compteur, appareil du client). */
function describe(n: ElNode, lang: Lang, t: T, eq: Record<string, string>): { desc: string; std: string; qty: number } | null {
  const p = n.props;
  switch (n.kind) {
    case 'board': {
      const rows = Number(p.rows) || 0;
      const per = Number(p.modulesPerRow) || 0;
      return { desc: [t('kind.board'), rows && per ? t('bom.boardSize', { rows, per, total: rows * per }) : ''].filter(Boolean).join(' · '), std: 'EN 61439-3', qty: 1 };
    }
    case 'protection':
      return { desc: protectionDesc(n, lang, t), std: DEVICE_STANDARD[String(p.device ?? 'mcb')] ?? '', qty: 1 };
    case 'cable':
      return { desc: cableDesc(n, lang) + (p.inConduit === true ? ' · ' + t('bom.inConduit') : ''), std: eq['cableType.' + String(p.cableType)] ?? '', qty: 1 };
    case 'socket': {
      const extra = [...flag(p.earth, t('bom.earth')), ...flag(p.childSafety, t('bom.childSafety')), ...flag(p.splashProof, 'IP44'), ...flag(p.threePhase, t('bom.threePhase'))];
      return { desc: [t('kind.socket'), ...extra].join(' · '), std: p.threePhase === true ? 'EN 60309' : (eq.socket ?? 'IEC 60884-1'), qty: Math.max(1, Number(p.count) || 1) };
    }
    case 'switch': {
      const extra = [...flag(p.pilotLight, t('bom.pilotLight')), ...flag(p.signalLamp, t('bom.pilotLight')), ...flag(p.splashProof, 'IP44')];
      return { desc: [t('enum.switchType.' + String(p.switchType ?? 'single')), ...extra].join(' · '), std: 'IEC 60669-1', qty: 1 };
    }
    case 'pushButton':
      return { desc: t('kind.pushButton'), std: 'IEC 60669-1', qty: 1 };
    case 'light':
      return { desc: [t('kind.light'), t('enum.lightType.' + String(p.lightType ?? 'standard')), ...flag(p.splashProof, 'IP44')].join(' · '), std: '', qty: Math.max(1, Number(p.count) || 1) };
    case 'relay':
      return { desc: t('enum.relayType.' + String(p.relayType ?? 'relay')), std: '', qty: 1 };
    case 'transformer':
      return { desc: [t('kind.transformer'), ...flag(p.safety, t('bom.safetyTransformer'))].join(' · '), std: p.safety === true ? 'EN 61558-2-6' : '', qty: 1 };
    case 'solarPanel':
      return { desc: [t('kind.solarPanel'), p.name ? String(p.name) : ''].filter(Boolean).join(' · '), std: '', qty: Math.max(1, Number(p.count) || 1) };
    case 'inverter':
      return { desc: [t('enum.inverterType.' + String(p.inverterType ?? 'dcAc')), p.power ? fmtNum(p.power, lang) + ' W' : ''].filter(Boolean).join(' · '), std: '', qty: 1 };
    case 'battery':
      return { desc: [t('kind.battery'), p.capacity ? fmtNum(p.capacity, lang) + ' kWh' : '', p.power ? fmtNum(p.power, lang) + ' W' : '', p.name ? String(p.name) : ''].filter(Boolean).join(' · '), std: '', qty: 1 };
    case 'domotic':
    case 'other':
      return { desc: [t('kind.' + n.kind), p.name ? String(p.name) : ''].filter(Boolean).join(' · '), std: '', qty: 1 };
    default: {
      const cat = KIND_CAT[n.kind];
      return cat ? { desc: t('kind.' + n.kind), std: '', qty: 1 } : null;
    }
  }
}

/**
 * Liste du matériel groupée par catégorie puis par désignation identique.
 * `equivalents` : équivalents harmonisés fournis par le référentiel du projet (clé « cableType.VOB »).
 */
export function billOfMaterials(
  project: Project,
  numbering: Map<string, string>,
  lang: Lang,
  t: T,
  equivalents: Record<string, string> = {},
  /** Ne compter que ces éléments (liste par pièce). */
  only?: (node: ElNode) => boolean,
): BomLine[] {
  const map = new Map<string, BomLine>();
  // Un tableau qui ne fait que grouper des circuits sous un différentiel est dans la même enveloppe : on ne compte que les enveloppes
  const physical = new Set(enclosures(project.roots).map((e) => e.board.id));
  for (const { node } of walk(project.roots)) {
    const cat = KIND_CAT[node.kind];
    if (!cat) continue;
    if (only && !only(node)) continue;
    if (node.kind === 'board' && !physical.has(node.id)) continue;
    const d = describe(node, lang, t, equivalents);
    if (!d) continue;
    const reference = String(node.props.reference ?? '').trim();
    const key = `${cat}|${d.desc}|${reference}`;
    let line = map.get(key);
    if (!line) {
      line = { cat, desc: d.desc, std: d.std, reference, qty: 0, refs: [] };
      if (cat === 'cable') {
        line.length = 0;
        line.missingLength = 0;
      }
      map.set(key, line);
    }
    line.qty += d.qty;
    if (cat === 'cable') {
      const len = Number(node.props.length);
      if (len > 0) line.length! += len;
      else line.missingLength!++;
      if (len > 0 && node.props.lengthEstimated === true) line.estimated = true;
    }
    // Repère : le sien, sinon celui du circuit (canalisations)
    const ref = numbering.get(node.id) ?? [...ancestors(project.roots, node.id)].reverse().map((a) => numbering.get(a.id)).find(Boolean);
    if (ref && !line.refs.includes(ref)) line.refs.push(ref);
  }
  const order = (c: BomCategory) => BOM_CATEGORIES.indexOf(c);
  return [...map.values()].sort((a, b) => order(a.cat) - order(b.cat) || a.desc.localeCompare(b.desc, lang));
}

/** Catégories regroupées par pièce (points de l'installation) ; les autres (tableaux, protections, câbles, terre) à part. */
export const ROOM_CATEGORIES = new Set<BomCategory>(['socket', 'switch', 'light', 'control', 'energy', 'other']);

/**
 * Pièce d'un élément : sa « localisation / pièce », sinon celle d'un parent (ex. une boîte, un câble), sinon
 * l'étage du plan où il est placé (« Rez-de-chaussée — pièce non indiquée »), sinon `null`.
 */
export function roomOf(project: Project, node: ElNode): { key: string; floorOnly?: boolean } | null {
  const own = node.location?.trim();
  if (own) return { key: own };
  const up = [...ancestors(project.roots, node.id)].reverse().map((a) => a.location?.trim()).find(Boolean);
  if (up) return { key: up };
  const page = project.plan.pages.find((p) => p.symbols.some((s) => s.nodeId === node.id));
  return page ? { key: page.name, floorOnly: true } : null;
}

export interface RoomBom {
  /** Nom de la pièce ; `null` : pièce non indiquée (élément non placé). */
  room: string | null;
  /** Seulement l'étage est connu (pièce non indiquée). */
  floorOnly?: boolean;
  lines: BomLine[];
}

/** Liste du matériel par pièce (points de l'installation), puis le reste (tableau, protections, câbles, terre). */
export function billOfMaterialsByRoom(
  project: Project,
  numbering: Map<string, string>,
  lang: Lang,
  t: T,
  equivalents: Record<string, string> = {},
): { rooms: RoomBom[]; shared: BomLine[] } {
  const rooms = new Map<string, { room: string | null; floorOnly?: boolean; ids: Set<string> }>();
  for (const { node } of walk(project.roots)) {
    const cat = KIND_CAT[node.kind];
    if (!cat || !ROOM_CATEGORIES.has(cat)) continue;
    const r = roomOf(project, node);
    const key = r ? (r.floorOnly ? 'f:' : 'r:') + r.key : 'n:';
    if (!rooms.has(key)) rooms.set(key, { room: r?.key ?? null, floorOnly: r?.floorOnly, ids: new Set() });
    rooms.get(key)!.ids.add(node.id);
  }
  const rank = (v: { room: string | null; floorOnly?: boolean }) => (v.room === null ? 2 : v.floorOnly ? 1 : 0);
  const list = [...rooms.values()]
    // Pièces nommées d'abord (ordre alphabétique, « Chambre 2 » avant « Chambre 10 »), puis étages sans pièce, puis non placés
    .sort((a, b) => rank(a) - rank(b) || (a.room ?? '').localeCompare(b.room ?? '', lang, { numeric: true }))
    .map((v) => ({ room: v.room, floorOnly: v.floorOnly, lines: billOfMaterials(project, numbering, lang, t, equivalents, (n) => v.ids.has(n.id)) }));
  const shared = billOfMaterials(project, numbering, lang, t, equivalents, (n) => !ROOM_CATEGORIES.has(KIND_CAT[n.kind]!));
  return { rooms: list, shared };
}

/** Liste du matériel en CSV (séparateur « ; », lisible directement par Excel en FR/NL/BE). */
export function bomCsv(lines: BomLine[], t: T, room?: (l: BomLine) => string): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const head = [...(room ? [t('bom.col.room')] : []), t('bom.col.category'), t('bom.col.qty'), t('bom.col.length'), t('bom.col.desc'), t('bom.col.std'), t('bom.col.reference'), t('bom.col.refs')];
  const rows = lines.map((l) => [...(room ? [room(l)] : []), t('bom.cat.' + l.cat), l.qty, l.length ? l.length : '', l.desc, l.std, l.reference, l.refs.join(' ')]);
  return '﻿' + [head, ...rows].map((r) => r.map(esc).join(';')).join('\r\n') + '\r\n';
}
