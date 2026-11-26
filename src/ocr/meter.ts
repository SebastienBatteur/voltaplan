/**
 * Lecture de la plaque d'un compteur : deux passages au plus (mesuré sur de vraies photos : image de 4 000 px avec
 * contraste étiré, puis 6 000 px sans retouche si rien de décisif n'a été lu), textes réunis puis interprétés.
 */
import { ocrImage } from './engine';
import { readMeterPlate, type MeterPlate } from './parse';

export async function readMeter(photo: Blob, progress?: (f: number) => void): Promise<MeterPlate> {
  const a = await ocrImage(photo, { target: 4000, stretch: true, progress: (f) => progress?.(f / 2) });
  const first = readMeterPlate(a.text);
  if (first.supply) return first;
  const b = await ocrImage(photo, { target: 6000, stretch: false, progress: (f) => progress?.(0.5 + f / 2) });
  return readMeterPlate(a.text + '\n' + b.text);
}
