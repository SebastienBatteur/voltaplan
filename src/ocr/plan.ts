/**
 * Noms de pièces lus sur le fond de plan (OCR local) : proposés comme textes du plan, à leur place. Le plan peut être
 * photographié de travers : si l'image droite donne moins de deux pièces, elle est relue tournée d'un quart de tour
 * (dans les deux sens) et la meilleure lecture est gardée.
 */
import type { PlanPage, Pt } from '../model/types';
import { ocrImage } from './engine';
import { roomLabels, type RoomLabel } from './parse';

type Bg = PlanPage['images'][number];

/** Point de l'image préparée (tournée, agrandie) → pixel de l'image d'origine. */
export function toOriginal(p: Pt, rotate: 0 | 90 | 270, preparedW: number, preparedH: number, scale: number): Pt {
  const q = rotate === 90 ? { x: p.y, y: preparedW - p.x } : rotate === 270 ? { x: preparedH - p.y, y: p.x } : p;
  return { x: q.x / scale, y: q.y / scale };
}

export async function readPlanRooms(bg: Bg, progress?: (f: number) => void): Promise<{ rooms: (RoomLabel & { pos: Pt })[] }> {
  const { resolveImageSrc } = await import('../io/projectData');
  const { pxToPage } = await import('../plan/traceImage');
  const blob = await (await fetch(await resolveImageSrc(bg.href))).blob();
  const bmp = await createImageBitmap(blob);
  const ow = bmp.width;
  const oh = bmp.height;
  bmp.close();
  // Deux réglages d'image par orientation (mesuré : chacun trouve des pièces que l'autre manque), lectures réunies
  const passes = [
    { target: 4000, stretch: true },
    { target: 6000, stretch: false },
  ];
  const near = bg.w / 20;
  let best: (RoomLabel & { pos: Pt })[] = [];
  const rotations: (0 | 90 | 270)[] = [0, 90, 270];
  let step = 0;
  const steps = rotations.length * passes.length;
  for (const rot of rotations) {
    const found: (RoomLabel & { pos: Pt })[] = [];
    for (const pass of passes) {
      const r = await ocrImage(blob, { rotate: rot, ...pass, progress: (f) => progress?.((step + f) / steps) });
      step++;
      for (const l of roomLabels(r.words)) {
        const pos = pxToPage(bg, toOriginal({ x: l.x, y: l.y }, rot, r.width, r.height, r.scale), ow, oh);
        if (!found.some((x) => x.text === l.text && Math.hypot(x.pos.x - pos.x, x.pos.y - pos.y) < near)) found.push({ ...l, pos });
      }
    }
    if (found.length > best.length) best = found;
    if (rot === 0 && found.length >= 2) break;
  }
  progress?.(1);
  return { rooms: best };
}
