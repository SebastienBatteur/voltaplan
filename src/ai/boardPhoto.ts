/**
 * IA optionnelle : lecture d'une photo de tableau (appareils, calibres, sensibilités) et comparaison
 * avec le matériel défini dans le projet.
 *
 * - N'est appelée que si l'utilisateur a activé l'IA, autorisé « Disposition des modules depuis une photo
 *   du tableau » et déverrouillé sa clé (src/ai/settings.ts).
 * - La requête part directement du navigateur vers l'API d'Anthropic (aucun serveur intermédiaire).
 * - La réponse est contrainte par un schéma (sortie structurée), puis comparée sans IA (fonction pure testée).
 */
import { moduleWidth, type Placed } from '../board/model';
import type { BoardLayout, ElNode } from '../model/types';

/** Lecture de la photo par l'IA (forme garantie par le schéma de src/ai/boardPhotoAi.ts). */
export interface PhotoDeviceT {
  startModule: number;
  widthModules: number;
  kind: 'mcb' | 'rcd' | 'rcbo' | 'fuse' | 'switch' | 'other' | 'blank';
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
      const device = String(p.device ?? 'mcb');
      if (seen.widthModules !== d.width) issues.push({ key: 'ai.diff.width', params: { photo: seen.widthModules, project: d.width } });
      if (seen.kind !== 'other' && seen.kind !== device) issues.push({ key: 'ai.diff.kind', params: { photo: seen.kind, project: device } });
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
export function extraDevices(placedDevices: Placed[], reading: PhotoReadingT): { row: number; startModule: number; kind: string }[] {
  const extra: { row: number; startModule: number; kind: string }[] = [];
  for (const r of reading.rows)
    for (const x of r.devices) {
      if (x.kind === 'blank') continue;
      const covered = placedDevices.some((d) => d.row === r.row && x.startModule >= d.col && x.startModule < d.col + d.width);
      if (!covered) extra.push({ row: r.row, startModule: x.startModule, kind: x.kind });
    }
  return extra;
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Disposition d'après la lecture de l'IA (sans IA, fonction pure) : chaque appareil vu sur la photo reçoit
 * l'appareil du projet qui lui ressemble le plus (type, calibre, sensibilité, courbe, texte de l'étiquette,
 * largeur), à égalité le plus proche dans l'ordre de l'arbre. Les appareils du projet restants prennent
 * ensuite, dans l'ordre, les appareils de la photo encore libres. La largeur reste celle du projet : si elle
 * diffère de la photo, les voisins sont poussés vers la droite, et ce qui déborde reste en réserve.
 * `labelOf` donne le repère du circuit et son usage (« A Cuisine ») pour reconnaître l'étiquette.
 */
export function layoutFromReading(
  devices: ElNode[],
  reading: PhotoReadingT,
  perRow: number,
  labelOf: (n: ElNode) => string = () => '',
): { slots: BoardLayout['slots']; unplaced: ElNode[] } {
  const seen = reading.rows
    .flatMap((r) => r.devices.filter((x) => x.kind !== 'blank').map((x) => ({ row: r.row, x })))
    .sort((a, b) => a.row - b.row || a.x.startModule - b.x.startModule);
  const score = (s: PhotoDeviceT, n: ElNode, si: number, ni: number) => {
    const p = n.props;
    const device = String(p.device ?? 'mcb');
    let v = 0;
    if (s.kind === device) v += 3;
    else if (s.kind !== 'other') v -= 3;
    if (s.widthModules === moduleWidth(n)) v += 1;
    const rated = Number(p.ratedCurrent);
    if (s.ratedCurrentA != null && rated) v += s.ratedCurrentA === rated ? 3 : -2;
    const res = Number(p.residualCurrent);
    if (s.residualCurrentmA != null && res) v += s.residualCurrentmA === res ? 3 : -2;
    if (s.curve && p.curve) v += s.curve.toUpperCase() === String(p.curve).toUpperCase() ? 1 : -1;
    if (s.label) {
      const lab = norm(s.label);
      const words = norm(labelOf(n)).split(/[^a-z0-9]+/).filter(Boolean);
      // Repère du circuit (« A », « B2 ») comme mot entier, ou un mot d'usage de 3 lettres ou plus
      if (words.some((w) => (w.length >= 3 || /\d/.test(w) || w.length === 1) && new RegExp(`(^|[^a-z0-9])${w}($|[^a-z0-9])`).test(lab))) v += 4;
    }
    return v - 0.01 * Math.abs(si - ni);
  };
  const pairs: { si: number; ni: number; v: number }[] = [];
  seen.forEach((s, si) => devices.forEach((n, ni) => pairs.push({ si, ni, v: score(s.x, n, si, ni) })));
  pairs.sort((a, b) => b.v - a.v);
  const bySeen = new Map<number, number>();
  const taken = new Set<number>();
  for (const p of pairs) {
    if (p.v < 0) break;
    if (bySeen.has(p.si) || taken.has(p.ni)) continue;
    bySeen.set(p.si, p.ni);
    taken.add(p.ni);
  }
  // Restants : dans l'ordre de l'arbre, sur les appareils de la photo encore libres (de gauche à droite)
  const freeSeen = seen.map((_, i) => i).filter((i) => !bySeen.has(i));
  devices.forEach((_, ni) => {
    if (taken.has(ni) || !freeSeen.length) return;
    bySeen.set(freeSeen.shift()!, ni);
    taken.add(ni);
  });
  // Positions, puis chevauchements résolus rangée par rangée
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
      const w = moduleWidth(n);
      if (c + w > perRow) {
        unplaced.push(n);
        continue;
      }
      slots[n.id] = { row: r, col: c };
      end = c + w;
    }
  }
  return { slots, unplaced: devices.filter((n) => unplaced.includes(n)) };
}

/** Appel à l'IA (module chargé seulement quand on s'en sert). */
export async function readBoardPhoto(opts: { apiKey: string; model: string; photoDataUrl: string; rows: number; perRow: number; lang: string; composed: boolean }): Promise<PhotoReadingT> {
  const m = await import('./boardPhotoAi');
  return m.readBoardPhoto(opts);
}
