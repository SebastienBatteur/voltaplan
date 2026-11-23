/**
 * Appel à l'IA pour lire une photo de tableau (chargé à la demande : le SDK et le schéma ne pèsent
 * sur l'application que si l'utilisateur utilise l'option IA).
 */
import { z } from 'zod/v4';
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
  label: z.string().nullable().describe("Texte de l'étiquette au-dessus ou sur l'appareil, si lisible"),
  confidence: z.enum(['high', 'medium', 'low']),
});

export const PhotoReading = z.object({
  rows: z.array(z.object({ row: z.number().int().describe('Rangée, 0 = la plus haute'), devices: z.array(PhotoDevice) })),
  notes: z.string().nullable().describe('Remarques utiles (photo floue, appareils masqués…)'),
});

/** Appel à l'IA : image composée à partir du calage (src/ai/boardImage.ts), ou photo réduite sans calage. */
export async function readBoardPhoto(opts: {
  apiKey: string;
  model: string;
  photoDataUrl: string;
  rows: number;
  perRow: number;
  lang: string;
  /** Image composée (bandes redressées + règle des modules), sinon photo brute réduite. */
  composed: boolean;
}): Promise<PhotoReadingT> {
  const [{ default: Anthropic }, { zodOutputFormat }] = await Promise.all([import('@anthropic-ai/sdk'), import('@anthropic-ai/sdk/helpers/zod')]);
  // Clé de l'utilisateur, utilisée seulement dans son navigateur (pas de serveur) : usage voulu côté client.
  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true });
  const data = opts.photoDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const response = await client.messages.parse({
    model: opts.model,
    max_tokens: 16000,
    output_config: { format: zodOutputFormat(PhotoReading) },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
          {
            type: 'text',
            text: opts.composed
              ? `Residential electrical distribution board (Belgium). The image shows ${opts.rows} horizontal band(s), one per DIN rail row, ` +
                `top row first, each straightened and scaled so that every module (17.5 mm) has the same width. ` +
                `Above each band, a red ruler numbers the module positions of that row 0 to ${opts.perRow - 1}; the red ticks are the module limits. ` +
                `For each row, list every modular device from left to right: startModule = the ruler number under its left edge, ` +
                `widthModules = how many ruler positions it physically covers, measured on the ruler (compact 4-pole devices can be only 2 modules wide: ` +
                `never infer the width from the number of poles). Give its type (breakers and RCDs, but also contactors, impulse relays, timers, ` +
                `bell or safety transformers, meters and connected modules), the brand and the model/reference printed on it, the ratings ` +
                `(rated current, curve, residual current, RCD type) and its label text. A connected/smart circuit breaker (Zigbee, Wi-Fi, ` +
                `energy metering) that has a breaker toggle is a "mcb" (or "rcbo"), not "domotic"; use "meter" or "domotic" only for modules ` +
                `without a breaker toggle. Adjacent devices of the same type are separate devices ` +
                `when a new front face is visible. Report blanking plates as "blank" and skip empty rail. ` +
                `Only report what you can actually read; use null when unsure. ` +
                `Write notes in language "${opts.lang}".`
              : `Photo of a residential electrical distribution board (Belgium) with ${opts.rows} DIN rail row(s) of ${opts.perRow} modules (17.5 mm each). ` +
                `For each row (0 = top), list every modular device from left to right with its start position and width in modules, ` +
                `its type, the ratings printed on it (rated current, curve, residual current, RCD type) and its label text. ` +
                `Only report what you can actually read; use null when unsure. Write notes in language "${opts.lang}".`,
          },
        ],
      },
    ],
  });
  if (response.stop_reason === 'refusal') throw new Error('refusal');
  if (!response.parsed_output) throw new Error('unparsed');
  return response.parsed_output;
}
