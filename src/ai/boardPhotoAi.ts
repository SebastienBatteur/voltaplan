/**
 * Appel à l'IA pour lire une photo de tableau (chargé à la demande : le SDK et le schéma ne pèsent
 * sur l'application que si l'utilisateur utilise l'option IA).
 */
import { z } from 'zod/v4';
import { readImageStructured, type ProviderConfig } from './provider';
import type { PhotoReadingT } from './boardPhoto';

export const PhotoDevice = z.object({
  startModule: z.number().int().describe('Position du bord gauche, en modules depuis le début de la rangée (0 = premier module)'),
  widthModules: z.number().int().describe('Largeur mesurée sur la règle, en modules de 17,5 mm (pas déduite du nombre de pôles)'),
  kind: z
    .enum(['mcb', 'rcd', 'rcbo', 'fuse', 'switch', 'spd', 'contactor', 'teleswitch', 'timer', 'transformer', 'meter', 'domotic', 'other', 'blank'])
    .describe(
      'mcb = disjoncteur, rcd = interrupteur différentiel, rcbo = disjoncteur différentiel, switch = interrupteur-sectionneur, spd = parafoudre, ' +
        'contactor = contacteur ou relais, teleswitch = télérupteur, timer = horloge/minuterie, transformer = transformateur (sonnerie, sécurité), ' +
        'meter = compteur ou module de mesure sans manette, domotic = module connecté/domotique sans manette, blank = cache/obturateur. ' +
        'Un disjoncteur connecté (Zigbee, Wi-Fi, avec mesure) a une manette : c’est mcb (ou rcbo)',
    ),
  brand: z.string().nullable().describe('Marque lisible (Schneider, Hager, Legrand, ABB…)'),
  model: z.string().nullable().describe('Gamme et référence imprimées sur l’appareil (ex. « iC60N A9F79216 », « TX3 411617 »)'),
  poles: z.string().nullable().describe('1P, 1P+N, 2P, 3P, 4P… si lisible'),
  ratedCurrentA: z.number().nullable().describe('Calibre en ampères si lisible'),
  curve: z.string().nullable().describe('Courbe B, C ou D si lisible'),
  residualCurrentmA: z.number().nullable().describe('Sensibilité différentielle en mA si lisible'),
  rcdType: z.string().nullable().describe('Type de différentiel (AC, A, F, B) si lisible'),
  label: z.string().nullable().describe("Texte de l'étiquette au-dessus ou sur l'appareil, tel qu'écrit (pour un différentiel, souvent les circuits protégés : « A-F »)"),
  circuitRef: z
    .string()
    .nullable()
    .describe("Repère du circuit marqué sur l'appareil ou sur son volet juste en dessous (une lettre, parfois suivie d'un chiffre : « H », « B2 »)"),
  confidence: z.enum(['high', 'medium', 'low']),
});

export const PhotoReading = z.object({
  rows: z.array(z.object({ row: z.number().int().describe('Rangée, 0 = la plus haute'), devices: z.array(PhotoDevice) })),
  notes: z.string().nullable().describe('Remarques utiles (photo floue, appareils masqués…)'),
});

/** Consigne envoyée au modèle (indépendante du fournisseur). */
export function boardPhotoPrompt(opts: { rows: number; perRow: number; lang: string; composed: boolean }): string {
  return opts.composed
    ? `Residential electrical distribution board (Belgium). The image shows ${opts.rows} horizontal band(s), one per DIN rail row, ` +
      `top row first, each straightened and scaled so that every module (17.5 mm) has the same width. ` +
      `Each band shows the devices and, above them, the label strip of that row (label text is often rotated 90°): ` +
      `give each device the label written directly above it, word for word including roman numerals ("PRISES II" is not "PRISES I"). ` +
      `Above each band, a red ruler numbers the module positions of that row 0 to ${opts.perRow - 1}; the red ticks are the module limits. ` +
      `For each row, list every modular device from left to right: startModule = the ruler number under its left edge, ` +
      `widthModules = how many ruler positions it physically covers, measured on the ruler (compact 4-pole devices can be only 2 modules wide: ` +
      `never infer the width from the number of poles). Give its type (breakers and RCDs, but also contactors, impulse relays, timers, ` +
      `bell or safety transformers, meters and connected modules), the brand and the model/reference printed on it, the ratings ` +
      `(rated current, curve, residual current, RCD type) and its label text, copied as written, and separately ` +
      `the circuit reference letter marked on the device or on its tab just below it (circuitRef, e.g. "H"): for an RCD, the label ` +
      `often lists the circuits it protects (e.g. "A-F", "G H I J", "K à M"), keep it exactly. A connected/smart circuit breaker (Zigbee, Wi-Fi, ` +
      `energy metering) that has a breaker toggle is a "mcb" (or "rcbo"), not "domotic"; use "meter" or "domotic" only for modules ` +
      `without a breaker toggle. Adjacent devices of the same type are separate devices ` +
      `when a new front face is visible. Report blanking plates as "blank" and skip empty rail. ` +
      `Only report what you can actually read; use null when unsure. ` +
      `Write notes in language "${opts.lang}".`
    : `Photo of a residential electrical distribution board (Belgium) with ${opts.rows} DIN rail row(s) of ${opts.perRow} modules (17.5 mm each). ` +
      `For each row (0 = top), list every modular device from left to right with its start position and width in modules, ` +
      `its type, the ratings printed on it (rated current, curve, residual current, RCD type) and its label text. ` +
      `Only report what you can actually read; use null when unsure. Write notes in language "${opts.lang}".`;
}

/** Appel à l'IA : image composée à partir du calage (src/ai/boardImage.ts), ou photo réduite sans calage. */
export async function readBoardPhoto(opts: {
  config: ProviderConfig;
  photoDataUrl: string;
  rows: number;
  perRow: number;
  lang: string;
  /** Image composée (bandes redressées + règle des modules), sinon photo brute réduite. */
  composed: boolean;
  signal?: AbortSignal;
}): Promise<PhotoReadingT> {
  return readImageStructured(opts.config, {
    imageDataUrl: opts.photoDataUrl,
    prompt: boardPhotoPrompt(opts),
    schema: PhotoReading,
    name: 'board_reading',
    signal: opts.signal,
  });
}
