/**
 * Lecture de la plaque d'un compteur, en une seule étape pour l'utilisateur :
 *  1. OCR local (deux passages au plus : 4 000 px contraste étiré, puis 6 000 px sans retouche) ;
 *  2. l'IA SEULEMENT si l'OCR n'a pas trouvé l'alimentation, et si elle est activée, autorisée (« compteur ») et
 *     déverrouillée ; aucun appel quand l'OCR a tout lu ;
 *  3. lecture encore incomplète : raison (photo floue, sombre, reflets…) et solution, pour refaire la photo.
 */
import { ocrImage, photoDataUrl } from './engine';
import { readMeterPlate, type MeterPlate } from './parse';
import { measurePhoto, qualityIssues, type QualityIssue } from './quality';
import type { AiPermissions } from '../ai/settings';

export type AiUse = 'notNeeded' | 'used' | 'off' | 'locked' | 'offline' | 'error';

export interface MeterOutcome {
  plate: MeterPlate;
  /** Lu sans IA, ou complété par l'IA. */
  source: 'ocr' | 'ai';
  ai: AiUse;
  aiError?: string;
  /** Problèmes de photo (vide si la lecture est complète). */
  issues: QualityIssue[];
}

/** Problème signalé par l'IA → problème de photo affiché. */
export const AI_PROBLEM: Record<string, QualityIssue | undefined> = { blur: 'blur', dark: 'dark', glare: 'glare', tooFar: 'small', cropped: 'framing', notFound: 'framing' };

export async function readMeter(photo: Blob, lang: string, progress?: (f: number) => void, perm: keyof AiPermissions = 'meterFromPhoto'): Promise<MeterOutcome> {
  const metrics = await measurePhoto(photo);
  const a = await ocrImage(photo, { target: 4000, stretch: true, progress: (f) => progress?.(f / 2) });
  let plate = readMeterPlate(a.text);
  if (!plate.supply) {
    const b = await ocrImage(photo, { target: 6000, stretch: false, progress: (f) => progress?.(0.5 + f / 2) });
    plate = readMeterPlate(a.text + '\n' + b.text);
  }
  if (plate.supply) return { plate, source: 'ocr', ai: 'notNeeded', issues: [] };

  // Lecture locale incomplète : l'IA si elle est prête pour cet usage
  const { aiFor } = await import('../ai/settings');
  const st = aiFor(perm);
  let ai: AiUse = st.state === 'ready' ? 'error' : st.state;
  let aiError: string | undefined;
  const issues = new Set<QualityIssue>();
  if (st.state === 'ready') {
    try {
      const { readMeterAi, supplyFromAi } = await import('../ai/photoAi');
      const r = await readMeterAi(st.config, await photoDataUrl(photo, 1600), lang);
      ai = 'used';
      const supply = supplyFromAi(r);
      const seen = [r.voltage ? r.voltage + ' V' : '', r.phases ? `${r.phases} ph` : '', r.maxCurrentA ? `${r.baseCurrentA ?? '?'}(${r.maxCurrentA}) A` : ''].filter(Boolean);
      if (supply) return { plate: { ...plate, supply, options: undefined, evidence: [...plate.evidence, ...seen] }, source: 'ai', ai, issues: [] };
      if (r.phases === 3 && !plate.options) plate = { ...plate, phases: 3, options: ['3N x 400V ~ 50Hz', '3 x 230V ~ 50Hz'], evidence: [...plate.evidence, ...seen] };
      const p = AI_PROBLEM[r.problem];
      if (p) issues.add(p);
    } catch (e) {
      ai = 'error';
      aiError = e instanceof Error ? e.message : String(e);
    }
  }
  for (const i of qualityIssues(metrics, true)) issues.add(i);
  // « Cadrage » seulement si aucune autre raison n'a été trouvée
  if (issues.size > 1) issues.delete('framing');
  return { plate, source: 'ocr', ai, aiError, issues: [...issues] };
}
