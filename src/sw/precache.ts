/**
 * Liste des fichiers mis en cache par le service worker (hors ligne), calculée à la construction.
 *
 * Utilisé par le greffon Vite de vite.config.ts (et par les tests) : jamais importé par l'application.
 * La liste comprend tous les fichiers publiés (JS, CSS, lecteur PDF, polices, icônes, manifeste, index.html),
 * y compris les morceaux chargés à la demande : ils restent donc disponibles hors ligne même s'ils
 * n'ont jamais été utilisés en ligne.
 */
import { createHash } from 'node:crypto';

export interface BuiltFile {
  /** Chemin relatif au dossier publié, séparateur « / » (ex. « assets/index-abc.js »). */
  path: string;
  /** Contenu (pour l'empreinte de version). */
  content: string | Uint8Array;
}

export interface PrecacheManifest {
  /** Empreinte de la version publiée : change dès qu'un fichier change. */
  version: string;
  /** Adresses relatives à la portée du service worker (« ./assets/… »), triées. */
  urls: string[];
}

/** Fichier du service worker lui-même. */
export const SW_FILE = 'sw.js';

/** Fichiers publiés à ne pas mettre en cache : le service worker, les cartes de sources, fichiers système. */
export function isPrecached(path: string): boolean {
  const p = path.replace(/\\/g, '/');
  if (p === SW_FILE) return false;
  if (p.endsWith('.map')) return false;
  const base = p.split('/').pop() ?? p;
  if (base.startsWith('.') || base === 'Thumbs.db') return false;
  return true;
}

const sha256 = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');

/** Liste et version à partir des fichiers publiés (ordre indifférent). */
export function buildPrecacheManifest(files: BuiltFile[]): PrecacheManifest {
  const kept = files
    .map((f) => ({ path: f.path.replace(/\\/g, '/').replace(/^\.?\//, ''), content: f.content }))
    .filter((f) => isPrecached(f.path))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const lines = kept.map((f) => `${f.path} ${sha256(f.content)}`).join('\n');
  return { version: sha256(lines).slice(0, 12), urls: kept.map((f) => './' + f.path) };
}

/** Marque remplacée, dans src/sw/sw.js, par la liste des fichiers. */
export const PRECACHE_PLACEHOLDER = '/*__VOLTAPLAN_PRECACHE__*/ null';

/** Service worker final : le modèle avec la liste et la version insérées. */
export function renderServiceWorker(template: string, manifest: PrecacheManifest): string {
  if (!template.includes(PRECACHE_PLACEHOLDER)) throw new Error('Modèle du service worker sans marque ' + PRECACHE_PLACEHOLDER);
  return template.replace(PRECACHE_PLACEHOLDER, () => JSON.stringify(manifest));
}
