/**
 * Liaison entre l'interface et l'assistant : enregistre la source (photo), ajoute le brouillon au dossier de preuves
 * (une étape d'annulation) et ouvre le panneau de l'assistant.
 */
import type { PhotoReadingT } from '../ai/boardPhoto';
import { useStore } from '../store';
import type { Observation, SourceDoc } from './evidence';
import { addBoardReading, cachedRun, type ReadingResult } from './survey';

export const ASSIST_EVENT = 'voltaplan:assistant';

export function openAssistant() {
  window.dispatchEvent(new Event(ASSIST_EVENT));
}

/** Empreinte SHA-256 (hexadécimale) d'un texte ; vide si indisponible. */
export async function sha256(text: string): Promise<string> {
  try {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return '';
  }
}

/** Version de la consigne et du schéma de lecture (entre dans l'empreinte du cache de l'IA). */
export const BOARD_PROMPT_VERSION = 'board-photo-1';

/** Empreinte de l'entrée de l'IA : image envoyée, fournisseur, modèle, consigne (cache des lectures). */
export const aiInputHash = (image: string, engine: { provider: string; model: string; promptVersion: string }) =>
  sha256([engine.provider, engine.model, engine.promptVersion, image].join('\n'));

/** Empreinte courte d'un calage (rangées cliquées sur la photo). */
export function calibrationKey(rows: { a: { x: number; y: number }; b: { x: number; y: number } }[] | undefined): string | undefined {
  if (!rows?.length) return undefined;
  return rows.map((r) => [r.a.x, r.a.y, r.b.x, r.b.y].map((v) => Math.round(v)).join(',')).join(';');
}

/**
 * Point d'entrée du futur magasin de fichiers (format v2, assets/<sha256>) : l'original de chaque source y sera
 * enregistré. Pour l'instant la photo reste stockée comme avant (disposition du tableau) : rien à faire ici.
 */
export function registerOriginal(_source: SourceDoc): void {
  // TODO(format v2) : enregistrer l'original (photo importée) sous son empreinte SHA-256.
}

/** Lecture en cache pour cette photo et cette entrée de l'IA ? (aucun appel à faire) */
export function hasCachedReading(photoSha: string, inputHash: string, boardId: string): boolean {
  return !!cachedRun(useStore.getState().project.evidence, photoSha, inputHash, boardId);
}

/**
 * Lecture d'une photo de tableau → source + brouillon fusionné avec les autres photos du même tableau, dans le dossier
 * de preuves (une seule étape d'annulation). Sans `reading` : lecture réutilisée depuis le cache.
 */
export async function draftFromReading(opts: {
  reading?: PhotoReadingT;
  boardId: string;
  photoHref: string;
  photoSha?: string;
  engine?: Observation['engine'];
  calibration?: string;
  offset?: { row: number; module: number };
}): Promise<ReadingResult> {
  const hash = opts.photoSha ?? (await sha256(opts.photoHref));
  const st = useStore.getState();
  let result: ReadingResult | undefined;
  st.applyProject((p) => {
    result = addBoardReading(
      p,
      {
        boardId: opts.boardId,
        sha256: hash,
        label: st.t('assist.sourceBoardPhoto'),
        mime: opts.photoHref.slice(5, opts.photoHref.indexOf(';')) || undefined,
        calibration: opts.calibration,
        offset: opts.offset,
        reading: opts.reading,
        engine: opts.engine,
      },
      registerOriginal,
    );
    return result.project;
  });
  return result!;
}
