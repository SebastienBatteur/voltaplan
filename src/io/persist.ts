/**
 * Protection des données gardées dans le navigateur (projets, brouillon : IndexedDB ; réglages : localStorage).
 *
 * Par défaut, un navigateur peut effacer ces données s'il manque de place (stockage « au mieux »).
 * `navigator.storage.persist()` demande un stockage « persistant », effacé seulement par l'utilisateur.
 * Le navigateur accepte ou refuse selon ses propres critères (site installé, favori, usage…).
 * Tout est facultatif : sans l'API, ou en cas d'erreur, rien ne se passe (jamais d'exception).
 */
import { STORAGE_PREFIX } from '../brand';
import { browserList, listVersions, orphanDrafts } from './storage';

/** Demande automatique faite une seule fois (certains navigateurs affichent une question). */
const ASKED_KEY = STORAGE_PREFIX + 'persistAsked';

type Manager = Partial<Pick<StorageManager, 'persist' | 'persisted' | 'estimate'>>;

function manager(): Manager | undefined {
  try {
    return typeof navigator !== 'undefined' ? (navigator.storage as Manager | undefined) : undefined;
  } catch {
    return undefined;
  }
}

/** Stockage persistant accordé ? `null` : inconnu (API absente). */
export async function isPersisted(): Promise<boolean | null> {
  const m = manager();
  if (!m?.persisted) return null;
  try {
    return await m.persisted();
  } catch {
    return null;
  }
}

function asked(): boolean {
  try {
    return localStorage.getItem(ASKED_KEY) === '1';
  } catch {
    return false;
  }
}

function markAsked() {
  try {
    localStorage.setItem(ASKED_KEY, '1');
  } catch {
    /* stockage indisponible */
  }
}

/**
 * Demande le stockage persistant. Automatiquement : une seule fois ; `explicit` (bouton) : à chaque fois.
 * Retour : accordé (true), refusé ou pas redemandé (false), API absente (null).
 */
export async function requestPersistence(explicit = false): Promise<boolean | null> {
  const m = manager();
  if (!m?.persist) return null;
  const already = await isPersisted();
  if (already) return true;
  if (!explicit && asked()) return false;
  markAsked();
  try {
    return await m.persist();
  } catch {
    return false;
  }
}

export interface StorageInfo {
  persisted: boolean | null;
  /** Octets utilisés par le site (estimation du navigateur), `null` si inconnu. */
  usage: number | null;
  /** Octets disponibles pour le site (estimation), `null` si inconnu. */
  quota: number | null;
}

export async function storageInfo(): Promise<StorageInfo> {
  const m = manager();
  let usage: number | null = null;
  let quota: number | null = null;
  if (m?.estimate) {
    try {
      const e = await m.estimate();
      usage = typeof e.usage === 'number' ? e.usage : null;
      quota = typeof e.quota === 'number' ? e.quota : null;
    } catch {
      /* estimation indisponible */
    }
  }
  return { persisted: await isPersisted(), usage, quota };
}

/** Des projets, brouillons ou versions locales sont-ils gardés dans le navigateur ? */
async function hasStoredData(): Promise<boolean> {
  try {
    if ((await browserList()).length > 0) return true;
    if ((await orphanDrafts()).length > 0) return true;
    return (await listVersions()).length > 0;
  } catch {
    return false;
  }
}

/** Au démarrage : s'il y a des données gardées dans le navigateur, demander leur protection (une fois). */
export async function persistIfDataStored(hasData: () => Promise<boolean> = hasStoredData): Promise<boolean | null> {
  try {
    if (!manager()?.persist) return null;
    if (!(await hasData())) return false;
    return await requestPersistence();
  } catch {
    return null;
  }
}

/**
 * Safari (macOS) ou tout navigateur sur iPhone / iPad, hors application installée : les données du site
 * peuvent être effacées après quelques jours sans visite [à vérifier selon la version]. On conseille
 * d'installer Voltaplan sur l'écran d'accueil ou de garder les projets en fichier.
 */
export function needsInstallAdvice(nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'> & { standalone?: boolean } = navigator, standalone?: boolean): boolean {
  try {
    const ua = nav.userAgent || '';
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (nav.maxTouchPoints ?? 0) > 1);
    const safari = /Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\/|OPR\/|Firefox\//.test(ua);
    if (!ios && !safari) return false;
    const installed =
      standalone ??
      (nav.standalone === true || (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches));
    return !installed;
  } catch {
    return false;
  }
}

/** Taille lisible (« 1,2 Mo »), dans la langue donnée. */
export function formatBytes(n: number, locale = 'fr'): string {
  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;
  let i = 0;
  let v = n;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  try {
    return new Intl.NumberFormat(locale, { style: 'unit', unit: units[i], unitDisplay: 'short', maximumFractionDigits: v < 10 && i > 0 ? 1 : 0 }).format(v);
  } catch {
    return `${Math.round(v)} ${['o', 'ko', 'Mo', 'Go'][i]}`;
  }
}
