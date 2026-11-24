/**
 * Liaison entre l'interface et l'assistant : enregistre la source (photo), ajoute le brouillon au dossier de preuves
 * (une étape d'annulation) et ouvre le panneau de l'assistant.
 */
import type { PhotoReadingT } from '../ai/boardPhoto';
import { useStore } from '../store';
import { bindBoard, boardDraft } from './boardDraft';
import { emptyEvidence, evidenceId, purgeEvidence, type Observation, type SourceDoc } from './evidence';

export const ASSIST_EVENT = 'voltaplan:assistant';

export function openAssistant() {
  window.dispatchEvent(new Event(ASSIST_EVENT));
}

async function sha256(text: string): Promise<string> {
  try {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return '';
  }
}

/** Lecture d'une photo de tableau → source + brouillon dans le dossier de preuves. Renvoie le résumé. */
export async function draftFromReading(opts: { reading: PhotoReadingT; boardId: string; photoHref: string; engine?: Observation['engine'] }) {
  const hash = await sha256(opts.photoHref);
  const st = useStore.getState();
  const existing = st.project.evidence?.sources.find((s) => s.sha256 && s.sha256 === hash);
  const source: SourceDoc = existing ?? {
    id: evidenceId('src'),
    sha256: hash,
    kind: 'boardPhoto',
    label: st.t('assist.sourceBoardPhoto'),
    mime: opts.photoHref.slice(5, opts.photoHref.indexOf(';')) || undefined,
    addedAt: new Date().toISOString(),
    about: { nodeId: opts.boardId },
  };
  const engine = opts.engine ? { ...opts.engine, inputHash: hash } : undefined;
  const d = bindBoard(boardDraft({ reading: opts.reading, boardId: opts.boardId, sourceId: source.id, engine }), opts.boardId);
  st.applyProject((p) => {
    const e = p.evidence ?? emptyEvidence();
    // Un nouveau brouillon remplace les propositions encore en attente d'un brouillon précédent du même tableau
    const proposals = e.proposals.map((x) => (x.status === 'pending' && x.batch.startsWith('photo:') ? { ...x, status: 'superseded' as const } : x));
    return {
      ...p,
      evidence: purgeEvidence({
        ...e,
        sources: existing ? e.sources : [...e.sources, source],
        observations: [...e.observations, ...d.observations],
        proposals: [...proposals, ...d.proposals],
        questions: [...e.questions, ...d.questions],
      }),
    };
  });
  return d.summary;
}
