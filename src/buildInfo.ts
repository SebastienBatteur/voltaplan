/**
 * Identité de cette version (constantes fixées à la compilation par tools/provenance/plugin.ts) : affichée par
 * « À propos », jamais envoyée nulle part. Déclarative : n'authentifie pas une version officielle.
 */
import type { EmbeddedBuild } from '../tools/provenance/identity';

declare const __OSP_BUILD__: EmbeddedBuild | undefined;

/** Valeurs de repli (exécution sans le greffon) : état « inconnu ». */
const FALLBACK: EmbeddedBuild = {
  projectId: 'urn:uuid:55b25e7a-c2a4-4787-bebc-42ecee353f9e',
  upstreamId: 'urn:uuid:55b25e7a-c2a4-4787-bebc-42ecee353f9e',
  name: 'Voltaplan',
  version: '0.0.0',
  commit: null,
  commitDate: null,
  dirty: null,
  status: 'unknown',
  derived: false,
  repository: null,
  upstreamRepository: 'https://github.com/SebastienBatteur/voltaplan',
  correspondingSource: null,
  sourceDeclared: false,
  spdx: 'AGPL-3.0-only',
  licenseUrl: 'https://www.gnu.org/licenses/agpl-3.0.html',
  copyright: 'Copyright (C) 2026 Sébastien Batteur and VoltaPlan contributors',
  homepage: 'https://voltaplan.org/',
  environment: 'local',
};

export const BUILD: EmbeddedBuild = typeof __OSP_BUILD__ !== 'undefined' ? __OSP_BUILD__ : FALLBACK;

/** Adresse du code source à proposer (AGPL §13) : celui de CETTE version, à défaut son dépôt, à défaut l'origine. */
export function sourceUrl(b: EmbeddedBuild = BUILD): string {
  return b.correspondingSource ?? b.repository ?? b.upstreamRepository;
}

/** Informations techniques à copier (signalement d'un problème, vérification d'une instance). */
export function technicalInfo(b: EmbeddedBuild = BUILD, extra: Record<string, string> = {}): string {
  const lines: [string, string | null][] = [
    ['Project', `${b.name} ${b.version}`],
    ['Project-ID', b.projectId],
    ...(b.upstreamId !== b.projectId ? ([['Upstream-ID', b.upstreamId]] as [string, string][]) : []),
    ['Commit', b.commit ?? 'unknown'],
    ['Commit date', b.commitDate],
    ['Status', b.status + (b.derived ? ', derived' : '')],
    ['Repository', b.repository ?? 'unknown'],
    ['Upstream repository', b.upstreamRepository],
    ['Corresponding source', b.correspondingSource ?? 'unknown'],
    ['License', b.spdx],
    ['Built in', b.environment],
    ...Object.entries(extra),
  ];
  return lines.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
}
