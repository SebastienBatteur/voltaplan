/**
 * Lecteur RÉEL du banc (appel au fournisseur) : exactement la fonction de l'application (`readBoardPhoto` de
 * src/ai/boardPhotoAi.ts : même consigne, même schéma, même validation). N'est chargé que par les points d'entrée en
 * ligne de commande (run-matrix.ts) ; les tests n'utilisent jamais ce module.
 *
 * La clé est lue dans une variable d'environnement (jamais dans un fichier ni un argument). Rien n'est envoyé
 * ailleurs qu'au fournisseur choisi ; les résultats restent sur la machine.
 */
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { readBoardPhoto } from '../../src/ai/boardPhotoAi';
import { costClass, defaultKeyEnv, type Reader } from './matrix';

const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

/** Jetons consommés par la dernière requête (relevés sur la réponse, quel que soit le fournisseur). */
let lastUsage: { in?: number; out?: number } = {};
let watching = false;
function watchUsage() {
  if (watching) return;
  watching = true;
  const orig = globalThis.fetch;
  globalThis.fetch = async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const r = await orig(input, init);
    try {
      const j = (await r.clone().json()) as { usage?: Record<string, number> };
      const u = j.usage ?? {};
      lastUsage = { in: u.input_tokens ?? u.prompt_tokens, out: u.output_tokens ?? u.completion_tokens };
    } catch {
      // réponse non JSON : pas de comptage
    }
    return r;
  };
}

export function liveReader(env: Record<string, string | undefined>): Reader {
  return async (entry, photo) => {
    watchUsage();
    if (!photo.imagePath) throw new Error(`image introuvable pour ${photo.name}`);
    const mime = MIME[extname(photo.imagePath).toLowerCase()];
    if (!mime) throw new Error(`format d'image non pris en charge : ${extname(photo.imagePath)}`);
    const dataUrl = `data:${mime};base64,` + readFileSync(photo.imagePath).toString('base64');
    const apiKey = costClass(entry) === 'local' ? env[entry.keyEnv ?? ''] : env[defaultKeyEnv(entry)];
    lastUsage = {};
    const reading = await readBoardPhoto({
      config: { provider: entry.provider, model: entry.model, baseUrl: entry.baseUrl, apiKey },
      photoDataUrl: dataUrl,
      rows: photo.truth.rows,
      perRow: photo.truth.perRow,
      lang: photo.truth.lang ?? 'fr',
      composed: !!photo.truth.composed,
    });
    return { reading, tokensIn: lastUsage.in, tokensOut: lastUsage.out };
  };
}
