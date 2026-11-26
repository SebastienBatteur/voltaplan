/**
 * IA optionnelle, après la lecture locale (OCR) : plaque du compteur et plan (pièces, pictogrammes électriques).
 * N'est appelée que si l'OCR n'a pas tout trouvé, que l'IA est activée, l'usage autorisé et la clé déverrouillée
 * (src/ai/settings.ts : `aiFor`). Réponses contraintes par un schéma, puis exploitées sans IA (fonctions testées).
 * Tout résultat reste une proposition à confirmer.
 */
import { z } from 'zod/v4';
import { readImageStructured, type ProviderConfig } from './provider';

const PROBLEM = z
  .enum(['none', 'blur', 'dark', 'glare', 'tooFar', 'cropped', 'notFound'])
  .describe(
    "Problème de photo qui empêche la lecture : blur = floue, dark = trop sombre, glare = reflets, tooFar = texte trop petit (trop loin), " +
      'cropped = la zone utile est coupée, notFound = la zone demandée n’est pas sur la photo, none = aucun',
  );

export const MeterAiReading = z.object({
  phases: z.union([z.literal(1), z.literal(3)]).nullable().describe('1 = monophasé, 3 = triphasé (« 3x… », symbole étoile, trois bornes de phase)'),
  voltage: z.string().nullable().describe('Tension telle qu’imprimée sur la plaque (ex. « 230 », « 220/380 », « 3x230/400 »)'),
  neutral: z.boolean().nullable().describe('Triphasé avec neutre (tension double comme 230/400 ou 220/380, ou 4 fils) : true ; sans neutre (3x230) : false'),
  baseCurrentA: z.number().nullable(),
  maxCurrentA: z.number().nullable().describe('Courant maximal, entre parenthèses sur la plaque (ex. 40 dans « 10(40) A »)'),
  frequencyHz: z.number().nullable(),
  problem: PROBLEM,
});
export type MeterAiReadingT = z.infer<typeof MeterAiReading>;

export function meterPrompt(lang: string): string {
  return (
    'Photo of an electricity meter (Belgium). Read ONLY what is printed on its rating plate: voltage, number of phases, ' +
    'base and maximum current, frequency. Ignore the consumption index (kWh digits). Use null when you cannot read a value. ' +
    `If the photo quality prevents reading, set "problem". Language for any text: "${lang}".`
  );
}

export function readMeterAi(config: ProviderConfig, imageDataUrl: string, lang: string): Promise<MeterAiReadingT> {
  return readImageStructured(config, { imageDataUrl, prompt: meterPrompt(lang), schema: MeterAiReading, name: 'meter_reading', maxTokens: 800 });
}

/** Alimentation (valeurs du projet) à partir de la lecture de l'IA ; rien si ambigu. */
export function supplyFromAi(r: MeterAiReadingT): string | undefined {
  if (r.phases === 1) return '2 x 230V ~ 50Hz';
  if (r.phases === 3) {
    const v = r.voltage ?? '';
    if (r.neutral === true || /(380|400|415)/.test(v)) return '3N x 400V ~ 50Hz';
    if (r.neutral === false) return '3 x 230V ~ 50Hz';
  }
  return undefined;
}

/** Pictogrammes repérés sur un plan (sous-ensemble des éléments de Voltaplan placés sur le plan). */
export const PLAN_SYMBOLS = ['socket', 'switch', 'light', 'pushButton', 'board', 'appliance', 'detector', 'bell'] as const;

export const PlanAiReading = z.object({
  rooms: z.array(z.object({ name: z.string(), x: z.number().describe('0 = bord gauche, 1 = bord droit'), y: z.number().describe('0 = haut, 1 = bas') })),
  symbols: z.array(
    z.object({
      kind: z
        .enum(PLAN_SYMBOLS)
        .describe('socket = prise, switch = interrupteur, light = point lumineux (souvent une croix), pushButton = bouton-poussoir, board = tableau, appliance = appareil fixe, detector = détecteur, bell = sonnerie'),
      count: z.number().int().nullable().describe('Prises multiples : nombre de socles si indiqué'),
      x: z.number(),
      y: z.number(),
      confidence: z.enum(['high', 'medium', 'low']),
    }),
  ),
  problem: PROBLEM,
});
export type PlanAiReadingT = z.infer<typeof PlanAiReading>;

export function planPrompt(lang: string, knownRooms: string[]): string {
  return (
    'Architectural floor plan (Belgium), possibly hand-drawn, scanned or photographed. ' +
    'List the room names written on the plan with the position of each name, and every ELECTRICAL symbol ' +
    '(sockets, switches, light points, push buttons, distribution board, fixed appliances, detectors, bell) with its position. ' +
    'Positions are fractions of the image size (x from the left edge, y from the top edge). Do not list furniture, doors or dimensions. ' +
    (knownRooms.length ? `Rooms already found (list them too if you see them): ${knownRooms.join(', ')}. ` : '') +
    `Write room names as written on the plan. If the photo quality prevents reading, set "problem". Language: "${lang}".`
  );
}

export function readPlanAi(config: ProviderConfig, imageDataUrl: string, lang: string, knownRooms: string[]): Promise<PlanAiReadingT> {
  return readImageStructured(config, { imageDataUrl, prompt: planPrompt(lang, knownRooms), schema: PlanAiReading, name: 'plan_reading', maxTokens: 4000 });
}
