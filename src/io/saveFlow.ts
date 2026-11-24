/**
 * « Enregistrer » sans perte silencieuse, quel que soit l'emplacement (appareil, navigateur, GitHub, cloud).
 *
 * 1. Écriture conditionnelle : seulement si le fichier n'a pas changé depuis son ouverture (voir conflict.ts).
 * 2. Conflit : la version en cours est enregistrée sous un autre nom, au même endroit (copie de conflit) ; les deux
 *    versions sont conservées. Sur l'appareil (pas d'accès au dossier), l'utilisateur choisit : copie ou
 *    remplacement.
 * 3. Pas de réseau : rien n'est perdu, la version reste dans le navigateur et l'envoi est repris plus tard.
 * 4. Chaque enregistrement, conflit ou attente laisse une version locale (historique dans le navigateur).
 *
 * Fonctions d'accès injectables : testé sans navigateur ni réseau.
 */
import type { Project } from '../model/types';
import { conflictName, isConflict, isNetworkError } from './conflict';
import type { CloudFile, CloudId, SaveMode } from './cloud';
import type { GithubSettings, LocalVersion, Location } from './storage';

export interface SaveDeps {
  browserSave: (id: string, name: string, project: Project, expectedRev: number | 'any') => Promise<number>;
  cloudSave: (id: CloudId, name: string, project: Project, mode: SaveMode, existing?: CloudFile) => Promise<CloudFile>;
  githubSave: (token: string, s: GithubSettings, path: string, project: Project, mode: SaveMode, sha?: string) => Promise<string | undefined>;
  githubToken: () => string | null;
  githubSettings: () => GithubSettings;
  deviceSave: (project: Project, fileName: string) => Promise<string | null>;
  addVersion: (key: string, name: string, project: Project, reason: LocalVersion['reason']) => Promise<void>;
  newId: () => string;
  now: () => Date;
}

export type SaveOutcome =
  | { status: 'saved'; loc: Location; name: string }
  /** Modifié ailleurs : notre version a été enregistrée sous `copyName` ; `loc` désigne désormais la copie. */
  | { status: 'conflictCopy'; loc: Location; name: string; copyName: string }
  /** Fichier de l'appareil modifié ailleurs : à l'utilisateur de choisir (copie ou remplacement). */
  | { status: 'deviceConflict'; name: string }
  /** Pas de réseau : version gardée dans le navigateur, envoi à reprendre. */
  | { status: 'pending'; loc: Location; name: string }
  | { status: 'cancelled' }
  /** GitHub : jeton à déverrouiller. */
  | { status: 'needsAuth' };

/** Clé stable d'un emplacement (versions locales, messages). */
export function locationKey(loc: Location, fileName: string): string {
  switch (loc.kind) {
    case 'browser':
      return `browser:${loc.id}`;
    case 'cloud':
      return `cloud:${loc.provider}:${loc.file.id}`;
    case 'github':
      return `github:${loc.repo}@${loc.branch}:${loc.path}`;
    default:
      return `device:${fileName || 'sans-nom'}`;
  }
}

const dirOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '');
const baseOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);

/** Enregistre `project` à l'emplacement `loc`, sans jamais écraser une version modifiée ailleurs. */
export async function saveAt(loc: Location, project: Project, fileName: string, deps: SaveDeps): Promise<SaveOutcome> {
  const name = loc.kind === 'cloud' ? loc.file.name : loc.kind === 'github' ? baseOf(loc.path) : fileName || project.meta.title || 'projet';
  const key = locationKey(loc, fileName);
  const keep = (reason: LocalVersion['reason']) => deps.addVersion(key, name, project, reason).catch(() => undefined);
  try {
    const saved = await write(loc, project, fileName, deps);
    if (!saved) return { status: 'cancelled' };
    if ('status' in saved) return saved;
    await keep('save');
    return { status: 'saved', loc: saved.loc, name: saved.name };
  } catch (e) {
    if (isNetworkError(e)) {
      await keep('pending');
      return { status: 'pending', loc, name };
    }
    if (!isConflict(e)) throw e;
    await keep('conflict');
    if (loc.kind === 'device') return { status: 'deviceConflict', name };
    const copyName = conflictName(name, deps.now());
    try {
      const copy = await writeCopy(loc, project, copyName, deps);
      return { status: 'conflictCopy', loc: copy, name, copyName };
    } catch (e2) {
      if (isNetworkError(e2)) return { status: 'pending', loc, name };
      throw e2;
    }
  }
}

async function write(loc: Location, project: Project, fileName: string, deps: SaveDeps): Promise<{ loc: Location; name: string } | SaveOutcome | null> {
  switch (loc.kind) {
    case 'browser': {
      const name = fileName || project.meta.title || 'projet';
      const rev = await deps.browserSave(loc.id, name, project, loc.rev ?? 'any');
      return { loc: { ...loc, rev }, name };
    }
    case 'cloud': {
      const file = await deps.cloudSave(loc.provider, loc.file.name, project, 'update', loc.file);
      return { loc: { ...loc, file: { ...loc.file, ...file } }, name: file.name };
    }
    case 'github': {
      const token = deps.githubToken();
      if (!token) return { status: 'needsAuth' };
      const sha = await deps.githubSave(token, deps.githubSettings(), loc.path, project, 'update', loc.sha);
      return { loc: { ...loc, sha }, name: baseOf(loc.path) };
    }
    default: {
      const name = await deps.deviceSave(project, fileName);
      return name ? { loc, name } : null;
    }
  }
}

/** Copie de conflit, au même endroit, sans jamais remplacer un fichier existant. */
async function writeCopy(loc: Exclude<Location, { kind: 'device' }>, project: Project, copyName: string, deps: SaveDeps): Promise<Location> {
  switch (loc.kind) {
    case 'browser': {
      const id = deps.newId();
      const rev = await deps.browserSave(id, copyName, project, 'any');
      return { kind: 'browser', id, rev };
    }
    case 'cloud': {
      const file = await deps.cloudSave(loc.provider, copyName, project, 'create');
      return { kind: 'cloud', provider: loc.provider, file };
    }
    case 'github': {
      const token = deps.githubToken();
      if (!token) throw new Error('GitHub : jeton verrouillé');
      const path = dirOf(loc.path) + copyName;
      const sha = await deps.githubSave(token, deps.githubSettings(), path, project, 'create');
      return { ...loc, path, sha };
    }
  }
}
