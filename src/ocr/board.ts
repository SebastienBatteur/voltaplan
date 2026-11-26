/**
 * Lecture d'une photo de tableau SANS IA (OCR local) : même forme de résultat que la lecture par l'IA
 * (`PhotoReadingT`), pour passer par le même chemin (brouillon de relevé ou comparaison avec le projet).
 *
 *  - Appareils : découpés sans IA à partir du calage des rangées (modules occupés et séparations, src/board/photo.ts).
 *  - Inscriptions : image composée (rangées redressées, grand format), lue droite puis tournée d'un quart de tour
 *    (étiquettes verticales) ; chaque mot est rattaché à son module ; dans le corps de l'appareil → calibre, courbe,
 *    sensibilité ; au-dessus ou en dessous → étiquette.
 *  - Confiance toujours « faible » : l'utilisateur confirme (mesuré sur de vraies photos : les petites inscriptions
 *    des anciens modules sont mal lues, les étiquettes imprimées bien mieux).
 */
import type { Pt } from '../model/types';
import type { PhotoDeviceT, PhotoKind, PhotoReadingT } from '../ai/boardPhoto';
import type { ComposedGeometry } from '../ai/boardImage';
import { plausibleLabel, readDevice, type OcrWord } from './parse';

/** Confiance minimale d'un mot (0–100) pour être pris en compte. */
export const MIN_CONFIDENCE = 55;

/** Appareils d'une rangée : suites de modules occupés, coupées aux séparations détectées. */
export function segmentsFromRow(occupied: boolean[], boundary: boolean[]): { start: number; width: number }[] {
  const out: { start: number; width: number }[] = [];
  let cur: { start: number; width: number } | null = null;
  for (let m = 0; m < occupied.length; m++) {
    if (!occupied[m]) {
      cur = null;
      continue;
    }
    if (!cur || boundary[m]) {
      cur = { start: m, width: 0 };
      out.push(cur);
    }
    cur.width++;
  }
  return out;
}

export interface PlacedWord extends OcrWord {
  /** Centre du mot dans l'image composée (pixels). */
  cx: number;
  cy: number;
  /** Ordre de lecture de l'OCR (passage puis position) : garde l'ordre des mots d'une étiquette, même tournée. */
  seq?: number;
}

/** Lecture complète à partir des mots placés dans l'image composée et des appareils découpés. */
export function readingFromWords(words: PlacedWord[], g: ComposedGeometry, modPx: number, segments: { start: number; width: number }[][], deviceHalfPx: number): PhotoReadingT {
  return {
    rows: segments.map((segs, row) => {
      const top = g.bandTop[row];
      const axis = top + g.axis;
      // Mots peu sûrs écartés : la lecture tournée produit du bruit sur le texte horizontal, et inversement
      const inRow = words.filter((w) => w.cy >= top && w.cy < top + g.bandH && (w.confidence === undefined || w.confidence >= MIN_CONFIDENCE));
      const devices: PhotoDeviceT[] = segs.map((s) => {
        const x0 = g.margin + s.start * modPx;
        const x1 = x0 + s.width * modPx;
        const mine = inRow.filter((w) => w.cx >= x0 && w.cx < x1).sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0) || a.cy - b.cy || a.cx - b.cx);
        const body = mine.filter((w) => Math.abs(w.cy - axis) <= deviceHalfPx);
        const outside = mine.filter((w) => Math.abs(w.cy - axis) > deviceHalfPx);
        const d = readDevice(body.map((w) => w.text).join(' '));
        const label = plausibleLabel(outside.map((w) => w.text).join(' ')) ?? null;
        const kind: PhotoKind = d.residualCurrentmA ? (d.curve ? 'rcbo' : 'rcd') : d.ratedCurrentA ? 'mcb' : 'other';
        return {
          startModule: s.start,
          widthModules: s.width,
          kind,
          poles: null,
          ratedCurrentA: d.ratedCurrentA ?? null,
          curve: d.curve ?? null,
          residualCurrentmA: d.residualCurrentmA ?? null,
          rcdType: null,
          label,
          confidence: 'low' as const,
        };
      });
      return { row, devices };
    }),
    notes: null,
  };
}

/** Lecture OCR d'une photo calée. */
export async function readBoardOcr(href: string, rows: { a: Pt; b: Pt }[], perRow: number, progress?: (f: number) => void): Promise<PhotoReadingT> {
  const { composeBoardCanvas, DEVICE_MODULES } = await import('../ai/boardImage');
  const { loadRGBA } = await import('../plan/traceImage');
  const { toGray } = await import('../plan/trace');
  const { analyzeRow, boundaries, moduleStats, rowProfile } = await import('../board/photo');
  const { ocrImage } = await import('./engine');
  const { toOriginal } = await import('./plan');

  // Appareils (sans IA)
  const gray = toGray(await loadRGBA(href));
  const segments = rows.map((line) => {
    const pxPerMm = Math.hypot(line.b.x - line.a.x, line.b.y - line.a.y) / (perRow * 17.5);
    const prof = rowProfile(gray, line.a, line.b, 0.3 * 85 * pxPerMm);
    const occ = analyzeRow(prof, moduleStats(gray, line.a, line.b, perRow), perRow).occupied;
    return segmentsFromRow(
      occ,
      boundaries(prof, perRow).map((b) => b.boundary),
    );
  });

  // Inscriptions : image composée grand format, lue droite puis tournée (étiquettes verticales)
  const modPx = 140;
  const { canvas, g } = await composeBoardCanvas(href, rows, perRow, modPx);
  const words: PlacedWord[] = [];
  const rotations: (0 | 90)[] = [0, 90];
  for (let i = 0; i < rotations.length; i++) {
    const rot = rotations[i];
    const r = await ocrImage(canvas, { rotate: rot, target: 6000, stretch: true, progress: (f) => progress?.((i + f) / rotations.length) });
    r.words.forEach((w, k) => {
      const c = toOriginal({ x: (w.bbox.x0 + w.bbox.x1) / 2, y: (w.bbox.y0 + w.bbox.y1) / 2 }, rot, r.width, r.height, r.scale);
      words.push({ ...w, cx: c.x, cy: c.y, seq: i * 1_000_000 + k });
    });
  }
  progress?.(1);
  return readingFromWords(words, g, modPx, segments, (DEVICE_MODULES / 2) * modPx);
}
