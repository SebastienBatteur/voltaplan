/**
 * Appel à l'IA pour lire une photo de tableau (chargé à la demande : le SDK et le schéma ne pèsent
 * sur l'application que si l'utilisateur utilise l'option IA).
 */
import { z } from 'zod/v4';
import type { PhotoReadingT } from './boardPhoto';

export const PhotoDevice = z.object({
  startModule: z.number().int().describe('Position du bord gauche, en modules depuis le début de la rangée (0 = premier module)'),
  widthModules: z.number().int().describe("Largeur de l'appareil en modules de 17,5 mm"),
  kind: z.enum(['mcb', 'rcd', 'rcbo', 'fuse', 'switch', 'other', 'blank']).describe('mcb = disjoncteur, rcd = interrupteur différentiel, rcbo = disjoncteur différentiel, blank = cache/obturateur'),
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



/** Appel à l'IA : la photo (JPEG en data URL) est redressée sur la zone des appareils. */
export async function readBoardPhoto(opts: { apiKey: string; model: string; photoDataUrl: string; rows: number; perRow: number; lang: string }): Promise<PhotoReadingT> {
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
            text:
              `Photo of a residential electrical distribution board (Belgium), straightened so that the image covers ` +
              `${opts.rows} DIN rail row(s) of ${opts.perRow} modules (17.5 mm each), top row first, with a small margin around. ` +
              `For each row, list every modular device from left to right with its start position and width in modules, ` +
              `its type, and the ratings printed on it (rated current, curve, residual current, RCD type) and its label text. ` +
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
