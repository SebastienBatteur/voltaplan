/**
 * Fichiers du moteur OCR local (Tesseract compilé en WebAssembly), servis par Voltaplan lui-même : aucun
 * téléchargement depuis un service tiers, fonctionne hors ligne, aucune image ne quitte l'appareil.
 *
 * Publiés sous `ocr/<version de tesseract.js>/` (le nom change à chaque version : pas de mélange de fichiers) :
 *  - worker.min.js (tesseract.js), trois variantes du cœur LSTM (le navigateur n'en charge qu'une, selon ses
 *    capacités SIMD) ;
 *  - langues anglaise, française et néerlandaise (modèles « best_int », compressés).
 * Ces fichiers ne sont PAS mis en cache d'office par le service worker (≈ 18 Mo) : ils le sont à la première lecture
 * (voir src/sw/sw.js). Licences : tesseract.js et tesseract.js-core Apache-2.0, données de langue MIT (paquets
 * @tesseract.js-data, modèles Tesseract Apache-2.0).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';

const require = createRequire(import.meta.url);

export const OCR_LANGS = ['eng', 'fra', 'nld'] as const;

/** Fichiers publiés : chemin publié → fichier source. */
export function ocrFiles(): Record<string, string> {
  const tjs = dirname(require.resolve('tesseract.js/package.json'));
  const core = dirname(require.resolve('tesseract.js-core/package.json'));
  const version = JSON.parse(readFileSync(join(tjs, 'package.json'), 'utf8')).version as string;
  const dir = `ocr/${version}/`;
  const out: Record<string, string> = { [dir + 'worker.min.js']: join(tjs, 'dist', 'worker.min.js') };
  for (const f of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']) out[dir + 'core/' + f] = join(core, f);
  for (const l of OCR_LANGS) {
    const data = dirname(require.resolve(`@tesseract.js-data/${l}/package.json`));
    out[dir + `lang/${l}.traineddata.gz`] = join(data, '4.0.0_best_int', `${l}.traineddata.gz`);
  }
  return out;
}

export function ocrAssets(): Plugin {
  const files = ocrFiles();
  return {
    name: 'voltaplan-ocr-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\/+/, '');
        const src = files[path];
        if (!src) return next();
        res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
        res.end(readFileSync(src));
      });
    },
    generateBundle() {
      for (const [fileName, src] of Object.entries(files)) this.emitFile({ type: 'asset', fileName, source: readFileSync(src) });
    },
  };
}
