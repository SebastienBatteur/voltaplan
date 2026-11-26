/**
 * Lecture du fond de plan, en une seule étape pour l'utilisateur :
 *  1. OCR local : noms de pièces, à leur place (relu tourné si le plan est photographié de travers) ;
 *  2. l'IA si elle est activée et autorisée pour le plan : les pictogrammes électriques (l'OCR ne lit que du texte)
 *     et les pièces que l'OCR a manquées ;
 *  3. lecture pauvre : raison et solution pour refaire la photo.
 * Tout est proposé (textes et éléments non raccordés posés sur le plan), annulable d'un Ctrl+Z.
 */
import type { PlanPage, Pt } from '../model/types';
import { ocrImage, photoDataUrl } from './engine';
import { roomLabels, type RoomLabel } from './parse';
import { measurePhoto, qualityIssues, type QualityIssue } from './quality';
import { AI_PROBLEM, type AiUse } from './meter';

type Bg = PlanPage['images'][number];

/** Point de l'image préparée (tournée, agrandie) → pixel de l'image d'origine. */
export function toOriginal(p: Pt, rotate: 0 | 90 | 270, preparedW: number, preparedH: number, scale: number): Pt {
  const q = rotate === 90 ? { x: p.y, y: preparedW - p.x } : rotate === 270 ? { x: preparedH - p.y, y: p.x } : p;
  return { x: q.x / scale, y: q.y / scale };
}

export interface PlanSymbolFound {
  kind: 'socket' | 'switch' | 'light' | 'pushButton' | 'board' | 'appliance' | 'detector' | 'bell';
  count?: number;
  pos: Pt;
}

export interface PlanOutcome {
  rooms: (RoomLabel & { pos: Pt; byAi?: boolean })[];
  symbols: PlanSymbolFound[];
  ai: AiUse;
  aiError?: string;
  issues: QualityIssue[];
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/** Pièces lues par l'OCR complétées par celles de l'IA : un nom déjà trouvé à proximité n'est pas ajouté deux fois. */
export function mergeRooms<T extends { text: string; pos: Pt }>(ocr: T[], ai: T[], near: number): T[] {
  const out = [...ocr];
  for (const r of ai) if (!out.some((x) => fold(x.text) === fold(r.text) && Math.hypot(x.pos.x - r.pos.x, x.pos.y - r.pos.y) < near)) out.push(r);
  return out;
}

export async function readPlan(bg: Bg, lang: string, progress?: (f: number) => void): Promise<PlanOutcome> {
  const { resolveImageSrc } = await import('../io/projectData');
  const { pxToPage } = await import('../plan/traceImage');
  const blob = await (await fetch(await resolveImageSrc(bg.href))).blob();
  const bmp = await createImageBitmap(blob);
  const ow = bmp.width;
  const oh = bmp.height;
  bmp.close();
  const toPage = (p: Pt) => pxToPage(bg, p, ow, oh);

  // 1. OCR : deux réglages d'image par orientation (chacun trouve des pièces que l'autre manque), lectures réunies
  const passes = [
    { target: 4000, stretch: true },
    { target: 6000, stretch: false },
  ];
  const near = bg.w / 20;
  let best: PlanOutcome['rooms'] = [];
  const rotations: (0 | 90 | 270)[] = [0, 90, 270];
  let step = 0;
  const steps = rotations.length * passes.length;
  for (const rot of rotations) {
    const found: PlanOutcome['rooms'] = [];
    for (const pass of passes) {
      const r = await ocrImage(blob, { rotate: rot, ...pass, progress: (f) => progress?.((0.8 * (step + f)) / steps) });
      step++;
      for (const l of roomLabels(r.words)) {
        const pos = toPage(toOriginal({ x: l.x, y: l.y }, rot, r.width, r.height, r.scale));
        if (!found.some((x) => x.text === l.text && Math.hypot(x.pos.x - pos.x, x.pos.y - pos.y) < near)) found.push({ ...l, pos });
      }
    }
    if (found.length > best.length) best = found;
    if (rot === 0 && found.length >= 2) break;
  }

  // 2. IA (si configurée et autorisée pour le plan) : pictogrammes et pièces manquées
  const { aiFor } = await import('../ai/settings');
  const st = aiFor('planFromPhoto');
  let ai: AiUse = st.state === 'ready' ? 'error' : st.state;
  let aiError: string | undefined;
  let symbols: PlanSymbolFound[] = [];
  const issues = new Set<QualityIssue>();
  if (st.state === 'ready') {
    try {
      const { readPlanAi } = await import('../ai/photoAi');
      progress?.(0.85);
      const r = await readPlanAi(st.config, await photoDataUrl(blob, 2000), lang, best.map((x) => x.text));
      ai = 'used';
      const at = (x: number, y: number) => toPage({ x: Math.max(0, Math.min(1, x)) * ow, y: Math.max(0, Math.min(1, y)) * oh });
      best = mergeRooms(
        best,
        r.rooms.filter((x) => x.name.trim()).map((x) => ({ text: x.name.trim(), x: 0, y: 0, pos: at(x.x, x.y), byAi: true })),
        near,
      );
      symbols = r.symbols.filter((s) => s.confidence !== 'low').map((s) => ({ kind: s.kind, count: s.count ?? undefined, pos: at(s.x, s.y) }));
      const p = AI_PROBLEM[r.problem];
      if (p) issues.add(p);
    } catch (e) {
      ai = 'error';
      aiError = e instanceof Error ? e.message : String(e);
    }
  }
  progress?.(1);

  // 3. Lecture pauvre (moins de deux pièces) : raison et solution
  if (best.length < 2) for (const i of qualityIssues(await measurePhoto(blob), true)) issues.add(i);
  if (issues.size > 1) issues.delete('framing');
  return { rooms: best, symbols, ai, aiError, issues: [...issues] };
}
