/**
 * IA optionnelle : lecture d'une photo de tableau (appareils, marques, modèles, calibres, sensibilités),
 * disposition des appareils du projet aux places lues et comparaison avec le matériel défini.
 *
 * - N'est appelée que si l'utilisateur a activé l'IA, autorisé « Disposition des modules depuis une photo
 *   du tableau » et déverrouillé sa clé (src/ai/settings.ts).
 * - La requête part directement du navigateur vers l'API d'Anthropic (aucun serveur intermédiaire).
 * - La réponse est contrainte par un schéma (sortie structurée), puis exploitée sans IA (fonctions pures testées).
 */
import { moduleWidth, type Placed } from '../board/model';
import type { BoardLayout, ElNode, PropValue } from '../model/types';

/** Types d'appareils lus sur la photo. */
export type PhotoKind =
  | 'mcb'
  | 'rcd'
  | 'rcbo'
  | 'fuse'
  | 'switch'
  | 'spd'
  | 'contactor'
  | 'teleswitch'
  | 'timer'
  | 'transformer'
  | 'meter'
  | 'domotic'
  | 'other'
  | 'blank';

/** Lecture de la photo par l'IA (forme garantie par le schéma de src/ai/boardPhotoAi.ts). */
export interface PhotoDeviceT {
  startModule: number;
  widthModules: number;
  kind: PhotoKind;
  brand?: string | null;
  model?: string | null;
  poles: string | null;
  ratedCurrentA: number | null;
  curve: string | null;
  residualCurrentmA: number | null;
  rcdType: string | null;
  label: string | null;
  confidence: 'high' | 'medium' | 'low';
}
export interface PhotoReadingT {
  rows: { row: number; devices: PhotoDeviceT[] }[];
  notes: string | null;
}

export interface DeviceDiff {
  nodeId: string;
  ok: boolean;
  /** Différences relevées (clés de traduction et valeurs). */
  issues: { key: string; params?: Record<string, string | number> }[];
}

/** Type d'un appareil du projet, dans le vocabulaire de la lecture. */
export function projectKind(n: ElNode): PhotoKind {
  switch (n.kind) {
    case 'protection':
      return String(n.props.device ?? 'mcb') as PhotoKind;
    case 'relay':
      return n.props.relayType === 'teleswitch' ? 'teleswitch' : n.props.relayType === 'timer' ? 'timer' : 'contactor';
    case 'transformer':
    case 'meter':
    case 'domotic':
      return n.kind;
    default:
      return 'other';
  }
}

/**
 * Un appareil vu sur la photo peut-il être cet appareil du projet ? Même type, ou types que la photo
 * distingue mal : relais / contacteur / télérupteur, disjoncteur / disjoncteur différentiel, compteur /
 * module connecté. Jamais un disjoncteur à la place d'un compteur ou d'un transformateur.
 */
export function compatible(seen: PhotoKind, n: ElNode): boolean {
  const k = projectKind(n);
  if (seen === k || seen === 'other' || k === 'other') return true;
  const pairs: PhotoKind[][] = [
    ['contactor', 'teleswitch'],
    ['mcb', 'rcbo'],
    ['meter', 'domotic'],
    // Disjoncteur connecté (Zigbee, avec mesure) pris pour un module domotique
    ['mcb', 'domotic'],
    ['rcbo', 'domotic'],
  ];
  if (pairs.some((p) => p.includes(seen) && p.includes(k))) return true;
  // Relais générique du schéma : contacteur, télérupteur ou horloge sur la photo
  return n.kind === 'relay' && (n.props.relayType ?? 'relay') === 'relay' && (seen === 'contactor' || seen === 'teleswitch' || seen === 'timer');
}

/** Pour le menu « Associer à… » : types compatibles, sans le dernier recours disjoncteur ↔ module connecté. */
export function closeKind(seen: PhotoKind, n: ElNode): boolean {
  const k = projectKind(n);
  const breaker = (x: PhotoKind) => x === 'mcb' || x === 'rcbo';
  return compatible(seen, n) && !((breaker(seen) && k === 'domotic') || (seen === 'domotic' && breaker(k)));
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
const compact = (s: string) => norm(s).replace(/[^a-z0-9]/g, '');

/**
 * Repères de circuits cités sur une étiquette : lettres isolées (« G H I J », « A, B »), éventuellement suivies
 * d'un chiffre (« B2 »), et plages (« A-F », « A à F », « A→F », « A tot F », « A to F »).
 */
export function circuitRefs(label: string): Set<string> {
  const out = new Set<string>();
  const txt = label.toUpperCase().replace(/[–—→>]/g, '-');
  const range = /(?:^|[^A-Z0-9])([A-Z])\s*(?:-|À|TOT|TO|T\/M)\s*([A-Z])(?![A-Z0-9])/g;
  for (const m of txt.matchAll(range)) {
    const a = m[1].charCodeAt(0);
    const b = m[2].charCodeAt(0);
    if (b > a && b - a < 26) for (let c = a; c <= b; c++) out.add(String.fromCharCode(c));
  }
  for (const m of txt.matchAll(/(?:^|[^A-Z0-9])([A-Z]\d{0,2})(?![A-Z0-9])/g)) out.add(m[1]);
  return out;
}

/** Marque et modèle lus, en une référence (« Hager MBN116 »). */
export function readReference(s: PhotoDeviceT): string {
  return [s.brand, s.model].filter((x) => x && x.trim()).join(' ').trim();
}

/** Types lus qui correspondent à une protection du projet (créable sous le tableau). */
export const PROTECTION_KINDS = new Set<PhotoKind>(['mcb', 'rcd', 'rcbo', 'fuse', 'switch']);
const POLE_VALUES = ['1P', '1P+N', '2P', '3P', '3P+N', '4P'];

/** Propriétés d'une nouvelle protection créée d'après la photo. */
export function protectionFromReading(x: PhotoDeviceT): Record<string, PropValue> {
  const p: Record<string, PropValue> = { device: PROTECTION_KINDS.has(x.kind) ? x.kind : 'mcb', modules: Math.max(1, Math.round(x.widthModules)) };
  if (x.ratedCurrentA) p.ratedCurrent = x.ratedCurrentA;
  if (x.curve && /^[BCD]$/i.test(x.curve)) p.curve = x.curve.toUpperCase();
  if (x.residualCurrentmA) p.residualCurrent = x.residualCurrentmA;
  if (x.rcdType && /^(AC|A|F|B)$/i.test(x.rcdType)) p.rcdType = x.rcdType.toUpperCase();
  const poles = x.poles?.toUpperCase().replace(/\s/g, '');
  if (poles && POLE_VALUES.includes(poles)) p.poles = poles;
  const ref = readReference(x);
  if (ref) p.reference = ref;
  if (x.label) p.circuitName = x.label;
  return p;
}

/** Caractéristique lue sur la photo, à confirmer avant de l'écrire dans l'unifilaire. */
export interface Proposal {
  nodeId: string;
  prop: 'ratedCurrent' | 'curve' | 'residualCurrent' | 'rcdType' | 'poles';
  /** Valeur actuelle du projet (null si vide). */
  from: PropValue | null;
  to: PropValue;
}

/**
 * Caractéristiques lues sur un appareil reconnu : une valeur absente du projet et lue avec une confiance
 * élevée est sûre (complétée d'office) ; une valeur lue avec peu de confiance, ou différente de celle du
 * projet, devient une proposition (le projet n'est jamais écrasé sans accord).
 */
export function fieldsFromReading(s: PhotoDeviceT, n: ElNode): { sure: Record<string, PropValue>; proposals: Proposal[] } {
  const sure: Record<string, PropValue> = {};
  const proposals: Proposal[] = [];
  if (n.kind !== 'protection') return { sure, proposals };
  const k = projectKind(n);
  const read: [Proposal['prop'], PropValue | null][] = [
    ['ratedCurrent', s.ratedCurrentA && s.ratedCurrentA > 0 ? s.ratedCurrentA : null],
    ['curve', k !== 'rcd' && s.curve && /^[BCD]$/i.test(s.curve.trim()) ? s.curve.trim().toUpperCase() : null],
    ['residualCurrent', (k === 'rcd' || k === 'rcbo') && s.residualCurrentmA && s.residualCurrentmA > 0 ? s.residualCurrentmA : null],
    ['rcdType', (k === 'rcd' || k === 'rcbo') && s.rcdType && /^(AC|A|F|B)$/i.test(s.rcdType.trim()) ? s.rcdType.trim().toUpperCase() : null],
    ['poles', (() => {
      const v = s.poles?.toUpperCase().replace(/\s/g, '');
      return v && POLE_VALUES.includes(v) ? v : null;
    })()],
  ];
  for (const [prop, to] of read) {
    if (to == null) continue;
    const cur = n.props[prop];
    const empty = cur == null || cur === '' || cur === 0;
    if (empty) {
      if (s.confidence === 'high') sure[prop] = to;
      else proposals.push({ nodeId: n.id, prop, from: null, to });
    } else if (String(cur).toUpperCase() !== String(to).toUpperCase()) proposals.push({ nodeId: n.id, prop, from: cur, to });
  }
  return { sure, proposals };
}

/** Comparaison (sans IA) entre le matériel défini et ce que l'IA a lu sur la photo. */
export function compareReading(placedDevices: Placed[], reading: PhotoReadingT): DeviceDiff[] {
  const out: DeviceDiff[] = [];
  for (const d of placedDevices) {
    const row = reading.rows.find((r) => r.row === d.row);
    const seen = row?.devices.find((x) => x.startModule === d.col && x.kind !== 'blank');
    const issues: DeviceDiff['issues'] = [];
    if (!seen) {
      issues.push({ key: 'ai.diff.missing' });
    } else {
      const p = d.node.props;
      const kind = projectKind(d.node);
      if (seen.widthModules > 0 && seen.widthModules !== d.width) issues.push({ key: 'ai.diff.width', params: { photo: seen.widthModules, project: d.width } });
      if (seen.kind !== 'other' && kind !== 'other' && seen.kind !== kind) issues.push({ key: 'ai.diff.kind', params: { photo: seen.kind, project: kind } });
      if (seen.ratedCurrentA != null && Number(p.ratedCurrent) && seen.ratedCurrentA !== Number(p.ratedCurrent))
        issues.push({ key: 'ai.diff.rating', params: { photo: seen.ratedCurrentA, project: Number(p.ratedCurrent) } });
      if (seen.residualCurrentmA != null && Number(p.residualCurrent) && seen.residualCurrentmA !== Number(p.residualCurrent))
        issues.push({ key: 'ai.diff.sensitivity', params: { photo: seen.residualCurrentmA, project: Number(p.residualCurrent) } });
      if (seen.curve && p.curve && seen.curve.toUpperCase() !== String(p.curve).toUpperCase())
        issues.push({ key: 'ai.diff.curve', params: { photo: seen.curve, project: String(p.curve) } });
      if (seen.rcdType && p.rcdType && seen.rcdType.toUpperCase() !== String(p.rcdType).toUpperCase())
        issues.push({ key: 'ai.diff.rcdType', params: { photo: seen.rcdType, project: String(p.rcdType) } });
      if (seen.confidence === 'low') issues.push({ key: 'ai.diff.lowConfidence' });
    }
    out.push({ nodeId: d.node.id, ok: issues.length === 0, issues });
  }
  return out;
}

/** Appareils vus sur la photo à un endroit vide du projet. */
export interface ExtraDevice {
  row: number;
  startModule: number;
  width: number;
  kind: PhotoKind;
  model: string;
  /** Lecture complète (calibre, courbe, sensibilité…), pour créer l'appareil dans le projet. */
  seen: PhotoDeviceT;
}
export function extraDevices(placedDevices: Placed[], reading: PhotoReadingT): ExtraDevice[] {
  const extra: ExtraDevice[] = [];
  for (const r of reading.rows)
    for (const x of r.devices) {
      if (x.kind === 'blank') continue;
      const covered = placedDevices.some((d) => d.row === r.row && x.startModule >= d.col && x.startModule < d.col + d.width);
      if (!covered) extra.push({ row: r.row, startModule: x.startModule, width: Math.max(1, Math.round(x.widthModules)), kind: x.kind, model: readReference(x), seen: x });
    }
  return extra;
}

/**
 * Disposition d'après la lecture de l'IA (sans IA, fonction pure) :
 *  1. chaque appareil vu sur la photo reçoit l'appareil du projet de type compatible qui lui ressemble le plus
 *     (référence, calibre, sensibilité, courbe, texte de l'étiquette, largeur), à égalité le plus proche dans
 *     l'ordre de l'arbre ; les appareils restants prennent, dans l'ordre, les places libres de type compatible ;
 *  2. la largeur mesurée sur la photo devient celle de l'appareil (propriété « modules »), et la marque et le
 *     modèle lus remplissent la référence si elle est vide : `props` donne ces changements, à appliquer avec
 *     la disposition (une seule annulation) ;
 *  3. ce qui ne trouve pas de place de type compatible reste en réserve.
 * `labelOf` donne le repère du circuit et son usage (« A Cuisine ») pour reconnaître l'étiquette.
 */
export function layoutFromReading(
  devices: ElNode[],
  reading: PhotoReadingT,
  perRow: number,
  labelOf: (n: ElNode) => string = () => '',
  circuitsOf: (n: ElNode) => string[] = () => [],
): { slots: BoardLayout['slots']; unplaced: ElNode[]; props: Record<string, Record<string, PropValue>>; proposals: Proposal[] } {
  const seen = reading.rows
    .flatMap((r) => r.devices.filter((x) => x.kind !== 'blank').map((x) => ({ row: r.row, x })))
    .sort((a, b) => a.row - b.row || a.x.startModule - b.x.startModule);
  /** L'étiquette lue contient le repère du circuit (« A », « B2 ») ou un mot de son usage, comme mot entier. */
  const labelHit = (s: PhotoDeviceT, n: ElNode) => {
    if (!s.label) return false;
    // Différentiel : l'étiquette donne souvent les circuits qu'il protège (« A-F », « G H I J », « K à M »)
    const own = circuitsOf(n);
    if (own.length) {
      const got = circuitRefs(s.label);
      if (got.size && own.filter((c) => got.has(c.toUpperCase())).length * 2 >= own.length) return true;
    }
    const lab = norm(s.label);
    const words = norm(labelOf(n))
      .split(/[^a-z0-9]+/)
      .filter((w) => w && (w.length >= 3 || /\d/.test(w) || w.length === 1));
    return words.some((w) => new RegExp(`(^|[^a-z0-9])${w}($|[^a-z0-9])`).test(lab));
  };
  const score = (s: PhotoDeviceT, n: ElNode, si: number, ni: number) => {
    const p = n.props;
    // Même type : 3 ; type voisin (compteur / module connecté, contacteur / télérupteur…) : 2 ;
    // disjoncteur ↔ module connecté (disjoncteur Zigbee mal classé) : 0, en dernier recours
    const k = projectKind(n);
    const breaker = (x: PhotoKind) => x === 'mcb' || x === 'rcbo';
    let v = s.kind === k ? 3 : (breaker(s.kind) && k === 'domotic') || (s.kind === 'domotic' && breaker(k)) ? 0 : 2;
    if (s.widthModules === moduleWidth(n)) v += 1;
    const ref = readReference(s);
    if (ref && p.reference) {
      const a = compact(ref);
      const b = compact(String(p.reference));
      if (a && b && (a.includes(b) || b.includes(a))) v += 5;
    }
    const rated = Number(p.ratedCurrent);
    if (s.ratedCurrentA != null && rated) v += s.ratedCurrentA === rated ? 3 : -2;
    const res = Number(p.residualCurrent);
    if (s.residualCurrentmA != null && res) v += s.residualCurrentmA === res ? 3 : -2;
    if (s.curve && p.curve) v += s.curve.toUpperCase() === String(p.curve).toUpperCase() ? 1 : -1;
    if (labelHit(s, n)) v += 4;
    return v - 0.01 * Math.abs(si - ni);
  };
  const pairs: { si: number; ni: number; v: number }[] = [];
  seen.forEach((s, si) => devices.forEach((n, ni) => compatible(s.x.kind, n) && pairs.push({ si, ni, v: score(s.x, n, si, ni) })));
  pairs.sort((a, b) => b.v - a.v);
  const bySeen = new Map<number, number>();
  const taken = new Set<number>();
  for (const p of pairs) {
    if (p.v < 0) break;
    if (bySeen.has(p.si) || taken.has(p.ni)) continue;
    bySeen.set(p.si, p.ni);
    taken.add(p.ni);
  }
  // Restants : places libres de la photo (de gauche à droite), appareil compatible suivant dans l'ordre de l'arbre
  seen.forEach((s, si) => {
    if (bySeen.has(si)) return;
    const ni = devices.findIndex((n, i) => !taken.has(i) && compatible(s.x.kind, n));
    if (ni < 0) return;
    bySeen.set(si, ni);
    taken.add(ni);
  });
  // Appareils identiques (ex. trois différentiels 40 A 30 mA) que la photo ne distingue pas (pas d'étiquette
  // reconnue) : dans l'ordre de l'unifilaire, de gauche à droite et de haut en bas. Sinon l'appariement « meilleur
  // d'abord » peut les croiser, et chaque différentiel semble alors protéger les circuits d'un autre.
  const signature = (n: ElNode) =>
    [projectKind(n), n.props.ratedCurrent, n.props.residualCurrent, n.props.curve, n.props.poles, n.props.reference, n.props.relayType].map((v) => String(v ?? '')).join('|');
  const groups = new Map<string, { si: number[]; ni: number[] }>();
  for (const [si, ni] of bySeen) {
    if (labelHit(seen[si].x, devices[ni])) continue;
    const g = groups.get(signature(devices[ni])) ?? { si: [], ni: [] };
    g.si.push(si);
    g.ni.push(ni);
    groups.set(signature(devices[ni]), g);
  }
  for (const g of groups.values()) {
    if (g.si.length < 2) continue;
    g.si.sort((x, y) => x - y); // `seen` est trié par rangée puis position
    g.ni.sort((x, y) => x - y); // ordre de l'arbre
    g.si.forEach((si, k) => bySeen.set(si, g.ni[k]));
  }
  // Largeur et référence lues
  const props: Record<string, Record<string, PropValue>> = {};
  const proposals: Proposal[] = [];
  const widthOf = new Map<string, number>();
  for (const [si, ni] of bySeen) {
    const s = seen[si].x;
    const n = devices[ni];
    const ch: Record<string, PropValue> = {};
    const w = s.widthModules > 0 && s.widthModules <= perRow ? Math.round(s.widthModules) : moduleWidth(n);
    if (w !== moduleWidth(n)) ch.modules = w;
    const ref = readReference(s);
    if (ref && !String(n.props.reference ?? '').trim()) ch.reference = ref;
    const f = fieldsFromReading(s, n);
    Object.assign(ch, f.sure);
    proposals.push(...f.proposals);
    if (Object.keys(ch).length) props[n.id] = ch;
    widthOf.set(n.id, w);
  }
  // Positions, chevauchements résolus rangée par rangée (ne devrait plus arriver avec les largeurs lues)
  const slots: BoardLayout['slots'] = {};
  const unplaced: ElNode[] = devices.filter((_, ni) => !taken.has(ni));
  const rows = new Map<number, { n: ElNode; col: number }[]>();
  for (const [si, ni] of bySeen) {
    const r = seen[si].row;
    if (!rows.has(r)) rows.set(r, []);
    rows.get(r)!.push({ n: devices[ni], col: Math.max(0, seen[si].x.startModule) });
  }
  for (const [r, list] of rows) {
    list.sort((a, b) => a.col - b.col);
    let end = 0;
    for (const { n, col } of list) {
      const c = Math.max(col, end);
      const w = widthOf.get(n.id) ?? moduleWidth(n);
      if (c + w > perRow) {
        unplaced.push(n);
        delete props[n.id];
        for (let i = proposals.length - 1; i >= 0; i--) if (proposals[i].nodeId === n.id) proposals.splice(i, 1);
        continue;
      }
      slots[n.id] = { row: r, col: c };
      end = c + w;
    }
  }
  return { slots, unplaced: devices.filter((n) => unplaced.includes(n)), props, proposals };
}

/** Appel à l'IA (module chargé seulement quand on s'en sert). */
export async function readBoardPhoto(opts: { apiKey: string; model: string; photoDataUrl: string; rows: number; perRow: number; lang: string; composed: boolean }): Promise<PhotoReadingT> {
  const m = await import('./boardPhotoAi');
  return m.readBoardPhoto(opts);
}
