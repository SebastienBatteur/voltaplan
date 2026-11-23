/**
 * IA optionnelle : lecture d'une photo de tableau (appareils, calibres, sensibilités) et comparaison
 * avec le matériel défini dans le projet.
 *
 * - N'est appelée que si l'utilisateur a activé l'IA, autorisé « Disposition des modules depuis une photo
 *   du tableau » et déverrouillé sa clé (src/ai/settings.ts).
 * - La requête part directement du navigateur vers l'API d'Anthropic (aucun serveur intermédiaire).
 * - La réponse est contrainte par un schéma (sortie structurée), puis comparée sans IA (fonction pure testée).
 */
import type { Placed } from '../board/model';

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

/** Appel à l'IA (module chargé seulement quand on s'en sert). */
export async function readBoardPhoto(opts: { apiKey: string; model: string; photoDataUrl: string; rows: number; perRow: number; lang: string }): Promise<PhotoReadingT> {
  const m = await import('./boardPhotoAi');
  return m.readBoardPhoto(opts);
}
