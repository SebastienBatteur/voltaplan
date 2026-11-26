/**
 * Nom et identifiants de l'application, réunis ici pour qu'un changement de nom se fasse en un seul endroit
 * (plus package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml, index.html et les workflows).
 */
export const APP_NAME = 'Voltaplan';
/** Extension des fichiers de projet. */
export const FILE_EXT = '.voltaplan';
/** Extensions des anciennes versions, toujours lisibles. */
export const LEGACY_EXTS = ['.openrgie'];
/** Valeur du champ `format` des fichiers de projet. Les anciens formats restent lisibles. */
export const FILE_FORMAT = 'voltaplan';
export const LEGACY_FORMATS = ['openrgie'];
/** Préfixe des réglages enregistrés localement. */
export const STORAGE_PREFIX = 'voltaplan.';
const LEGACY_STORAGE_PREFIXES = ['openrgie.'];

/** Reprend une seule fois les réglages enregistrés sous l'ancien nom (langue, réglages de l'IA). */
export function migrateStorage() {
  try {
    for (const old of LEGACY_STORAGE_PREFIXES)
      for (const k of Object.keys(localStorage)) {
        if (!k.startsWith(old)) continue;
        const nk = STORAGE_PREFIX + k.slice(old.length);
        if (localStorage.getItem(nk) === null) localStorage.setItem(nk, localStorage.getItem(k) ?? '');
        localStorage.removeItem(k);
      }
  } catch {
    /* stockage indisponible */
  }
}
migrateStorage();

/**
 * Étude photovoltaïque détaillée (production, strings, stockage) : hors de Voltaplan, sur le site de l'auteur.
 * Ouvert seulement au clic, dans un nouvel onglet, sans aucune donnée du projet dans l'adresse.
 */
export const PV_STUDY_URL = 'https://sbg-energy.com/';
