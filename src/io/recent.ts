/**
 * Projets récents de cet appareil (page d'accueil « Mes projets ») : une fiche par projet ouvert ou enregistré,
 * gardée dans les réglages locaux (`localStorage`). Seulement de quoi reconnaître et rouvrir le projet : titre,
 * client, commune, statut, emplacement, date. Jamais le contenu du projet ni de jeton. Rien ne quitte l'appareil.
 */
import { STORAGE_PREFIX } from '../brand';
import type { Project, ProjectStatus } from '../model/types';
import type { Location } from './storage';

const KEY = STORAGE_PREFIX + 'recent';
export const RECENT_MAX = 12;

export interface RecentEntry {
  /** Identifiant de l'emplacement (même projet = même fiche). */
  key: string;
  /** Nom du fichier ou du projet enregistré. */
  name: string;
  title: string;
  client?: string;
  city?: string;
  status?: ProjectStatus;
  installationKind?: 'new' | 'existing';
  /** Où le rouvrir. Les fichiers de l'appareil : par la boîte « Ouvrir » (nom rappelé). */
  loc: Location;
  /** Ouvert ou enregistré (ISO). */
  at: string;
}

type Read = (k: string) => string | null;
type Write = (k: string, v: string) => void;

const ls = {
  read: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  write: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* stockage indisponible : la liste ne sera simplement pas retenue */
    }
  },
};

/** Clé d'une fiche : l'emplacement, et le nom pour les fichiers de l'appareil (sans chemin). */
export function recentKey(loc: Location, name: string): string {
  switch (loc.kind) {
    case 'browser':
      return 'browser:' + loc.id;
    case 'device':
      return 'device:' + name;
    default:
      return loc.kind + ':' + JSON.stringify(loc).slice(0, 200) + ':' + name;
  }
}

export function listRecent(read: Read = ls.read): RecentEntry[] {
  try {
    const list = JSON.parse(read(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((e) => e && typeof e.key === 'string' && typeof e.name === 'string' && e.loc) : [];
  } catch {
    return [];
  }
}

/** Ajoute ou remonte la fiche du projet. Rien pour un projet jamais enregistré ni ouvert (sans nom). */
export function rememberRecent(project: Project, name: string, loc: Location, now = new Date(), read: Read = ls.read, write: Write = ls.write): void {
  if (!name.trim()) return;
  const m = project.meta;
  const entry: RecentEntry = {
    key: recentKey(loc, name),
    name,
    title: m.title?.trim() || name,
    client: m.client?.name?.trim() || undefined,
    city: m.site?.city?.trim() || undefined,
    status: m.status,
    installationKind: m.installationKind,
    loc,
    at: now.toISOString(),
  };
  const list = [entry, ...listRecent(read).filter((e) => e.key !== entry.key)].slice(0, RECENT_MAX);
  write(KEY, JSON.stringify(list));
}

/** Retire une fiche de la liste (le projet lui-même n'est pas supprimé). */
export function forgetRecent(key: string, read: Read = ls.read, write: Write = ls.write): void {
  write(KEY, JSON.stringify(listRecent(read).filter((e) => e.key !== key)));
}

/** Coordonnées de l'installateur reprises d'un projet à l'autre (assistant de nouveau projet). */
const INSTALLER_KEY = STORAGE_PREFIX + 'installer';
export type InstallerProfile = { name?: string; quality?: string; vat?: string };

export function loadInstallerProfile(read: Read = ls.read): InstallerProfile {
  try {
    const p = JSON.parse(read(INSTALLER_KEY) ?? '{}');
    return p && typeof p === 'object' ? { name: p.name, quality: p.quality, vat: p.vat } : {};
  } catch {
    return {};
  }
}

export function saveInstallerProfile(p: InstallerProfile, write: Write = ls.write): void {
  write(INSTALLER_KEY, JSON.stringify({ name: p.name?.trim() || undefined, quality: p.quality?.trim() || undefined, vat: p.vat?.trim() || undefined }));
}
