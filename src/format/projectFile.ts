/**
 * Passage entre le projet en mémoire (`Project`) et le contenu logique du format v2 :
 *  - project.json : le modèle, sans le dossier de preuves ;
 *  - sources.json : le dossier de preuves de l'assistant (`Project.evidence`, src/assist/evidence.ts), rangé à
 *    part (il peut grossir, et il décrit les documents sources) ;
 *  - documents : références « asset:<sha256> » du modèle et empreintes des sources.
 * Le contenu de `evidence` n'est ni interprété ni modifié ici : il est déplacé tel quel.
 */
import type { Project } from '../model/types';
import { assetShaOf } from './manifest';
import { isSha256Hex } from './sha256';

export const SOURCES_FORMAT = 'voltaplan-sources';

/** Sépare le modèle et le dossier de preuves (texte de project.json et de sources.json). */
export function splitProject(project: Project): { projectText: string; sourcesText: string | null } {
  const p = project as Project & { evidenceRaw?: unknown };
  const { evidence, evidenceRaw, ...model } = p as Project & { evidenceRaw?: unknown };
  const sources = evidence !== undefined || evidenceRaw !== undefined ? { format: SOURCES_FORMAT, version: 1, ...(evidence !== undefined ? { evidence } : {}), ...(evidenceRaw !== undefined ? { evidenceRaw } : {}) } : null;
  return { projectText: JSON.stringify(model), sourcesText: sources ? JSON.stringify(sources) : null };
}

/**
 * Réunit project.json et sources.json en un seul texte de projet, lu ensuite par la chaîne habituelle (taille,
 * migration, zod, nettoyage, intégrité). sources.json illisible : gardé tel quel (evidenceRaw), jamais supprimé.
 */
export function mergeSources(projectText: string, sourcesText: string | null): { text: string; sourcesUnreadable: boolean } {
  if (!sourcesText) return { text: projectText, sourcesUnreadable: false };
  let model: Record<string, unknown>;
  try {
    model = JSON.parse(projectText) as Record<string, unknown>;
  } catch {
    return { text: projectText, sourcesUnreadable: false }; // erreur signalée par la lecture du modèle
  }
  if (!model || typeof model !== 'object') return { text: projectText, sourcesUnreadable: false };
  try {
    const s = JSON.parse(sourcesText) as Record<string, unknown>;
    if (!s || typeof s !== 'object' || s.format !== SOURCES_FORMAT) throw new Error('format');
    if (s.evidence !== undefined) model.evidence = s.evidence;
    if (s.evidenceRaw !== undefined) model.evidenceRaw = s.evidenceRaw;
    return { text: JSON.stringify(model), sourcesUnreadable: false };
  } catch {
    model.evidenceRaw = sourcesText;
    return { text: JSON.stringify(model), sourcesUnreadable: true };
  }
}

export interface AssetRef {
  sha256: string;
  kind: 'background' | 'image' | 'boardPhoto' | 'source';
  /** Libellé lisible (nom d'origine, page, tableau), pour les messages et l'export en dossier. */
  label: string;
  /** Source de l'assistant : identifiant. */
  source?: string;
}

/** Tous les documents référencés par le projet (modèle et dossier de preuves), sans doublon. */
export function projectAssetRefs(project: Project): AssetRef[] {
  const out = new Map<string, AssetRef>();
  const add = (r: AssetRef) => {
    if (!out.has(r.sha256)) out.set(r.sha256, r);
  };
  for (const page of project.plan?.pages ?? [])
    for (const im of page.images ?? []) {
      const sha = assetShaOf(im.href);
      if (sha) add({ sha256: sha, kind: im.background ? 'background' : 'image', label: page.name || page.id });
    }
  for (const [id, layout] of Object.entries(project.boards ?? {})) {
    const sha = assetShaOf(layout?.photo?.href);
    if (sha) add({ sha256: sha, kind: 'boardPhoto', label: id });
  }
  const sources = (project.evidence as { sources?: { id?: string; sha256?: string; label?: string }[] } | undefined)?.sources ?? [];
  for (const s of sources) if (isSha256Hex(s?.sha256)) add({ sha256: s.sha256, kind: 'source', label: s.label || s.id || '', source: s.id });
  return [...out.values()];
}
