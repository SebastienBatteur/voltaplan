/**
 * « Enregistrer » sans perte silencieuse, quel que soit l'emplacement (appareil, navigateur, GitHub, cloud).
 *
 * 1. Écriture conditionnelle : seulement si le fichier n'a pas changé depuis son ouverture (voir conflict.ts).
 * 2. Conflit : la version en cours est enregistrée sous un autre nom, au même endroit (copie de conflit) ; les deux
 *    versions sont conservées. Sur l'appareil (pas d'accès au dossier), l'utilisateur choisit : copie ou
 *    remplacement.
 * 3. Pas de réseau, ou connexion au service à refaire (jeton expiré) : rien n'est perdu, la version reste dans le
 *    navigateur, et l'envoi en attente est mémorisé (il survit à la fermeture de l'application) pour être repris.
 * 4. Chaque enregistrement, conflit ou attente laisse une version locale (historique dans le navigateur).
 * 5. Destination pleine (disque, espace du service épuisé) ou fichier trop gros : version gardée dans le navigateur,
 *    erreur typée remontée (message traduit) ; l'envoi n'est PAS mis en attente : il échouerait de nouveau à
 *    chaque reprise. L'utilisateur libère de la place, puis clique sur « Enregistrer ».
 *
 * Fonctions d'accès injectables : testé sans navigateur ni réseau.
 */
import type { Project } from '../model/types';
import { conflictName, isAuthError, isConflict, isDestinationFull, isNetworkError } from './conflict';
import type { CloudFile, CloudId, SaveMode } from './cloud';
import { safeName, type FolderLocation, type GithubSettings, type LocalVersion, type Location, type PendingSave } from './storage';
import { FILE_EXT } from '../brand';

export interface SaveDeps {
  browserSave: (id: string, name: string, project: Project, expectedRev: number | 'any') => Promise<number>;
  cloudSave: (id: CloudId, name: string, project: Project, mode: SaveMode, existing?: CloudFile) => Promise<CloudFile>;
  githubSave: (token: string, s: GithubSettings, path: string, project: Project, mode: SaveMode, sha?: string) => Promise<string | undefined>;
  githubToken: () => string | null;
  githubSettings: () => GithubSettings;
  deviceSave: (project: Project, fileName: string) => Promise<string | null>;
  /** Projet en dossier (format v2, F8) : documents puis modèle conditionnel ; renvoie la version du modèle. */
  folderSave?: (loc: FolderLocation, project: Project, mode: SaveMode) => Promise<{ rev?: string; concurrentCopy?: string }>;
  addVersion: (key: string, name: string, project: Project, reason: LocalVersion['reason']) => Promise<void>;
  /** Enregistrement à reprendre (persistant) ; effacé dès qu'un enregistrement aboutit à cet emplacement. */
  setPending: (p: PendingSave) => void;
  clearPending: (key: string) => void;
  newId: () => string;
  now: () => Date;
}

export type SaveOutcome =
  /** `concurrentCopy` : Google Drive, modification faite ailleurs pendant l'envoi, recopiée sous ce nom. */
  | { status: 'saved'; loc: Location; name: string; concurrentCopy?: string }
  /** Modifié ailleurs : notre version a été enregistrée sous `copyName` ; `loc` désigne désormais la copie. */
  | { status: 'conflictCopy'; loc: Location; name: string; copyName: string }
  /** Fichier de l'appareil modifié ailleurs : à l'utilisateur de choisir (copie ou remplacement). */
  | { status: 'deviceConflict'; name: string }
  /** Pas de réseau : version gardée dans le navigateur, envoi à reprendre. */
  | { status: 'pending'; loc: Location; name: string }
  | { status: 'cancelled' }
  /**
   * Connexion à refaire (jeton GitHub verrouillé, jeton expiré, fenêtre de connexion bloquée) : version gardée,
   * envoi en attente ; il reprend au prochain « Enregistrer » (un clic autorise la fenêtre de connexion).
   */
  | { status: 'needsAuth'; loc: Location; name: string };

/** Clé stable d'un emplacement (versions locales, messages). */
export function locationKey(loc: Location, fileName: string): string {
  switch (loc.kind) {
    case 'browser':
      return `browser:${loc.id}`;
    case 'cloud':
      // Fichier pas encore créé (« Nouveau » depuis Google Drive) : désigné par son dossier
      return loc.file.id ? `cloud:${loc.provider}:${loc.file.id}` : `cloud:${loc.provider}:new:${loc.file.parentId ?? ''}`;
    case 'github':
      return `github:${loc.repo}@${loc.branch}:${loc.path}`;
    case 'folder':
      return `folder:${loc.provider}:${loc.folderId ?? loc.folder}/${loc.modelPath}`;
    default:
      return `device:${fileName || 'sans-nom'}`;
  }
}

const dirOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '');
const baseOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);
/** Nom d'un fichier à créer (emplacement sans nom : « Nouveau » depuis Google Drive) : titre du projet. */
const newFileName = (project: Project, fileName: string) => safeName((fileName || project.meta.title || 'projet').replace(/\.[^.]*$/, '')) + FILE_EXT;

/** Enregistre `project` à l'emplacement `loc`, sans jamais écraser une version modifiée ailleurs. */
export async function saveAt(loc: Location, project: Project, fileName: string, deps: SaveDeps): Promise<SaveOutcome> {
  const name = loc.kind === 'cloud' ? loc.file.name || newFileName(project, fileName) : loc.kind === 'github' ? baseOf(loc.path) : loc.kind === 'folder' ? loc.folder : fileName || project.meta.title || 'projet';
  const key = locationKey(loc, fileName);
  const keep = (reason: LocalVersion['reason']) => deps.addVersion(key, name, project, reason).catch(() => undefined);
  /** Attente : version gardée et envoi mémorisé (survit à la fermeture). */
  const wait = async (reason: PendingSave['reason']): Promise<SaveOutcome> => {
    await keep('pending');
    deps.setPending({ key, loc, fileName, name, at: deps.now().toISOString(), reason });
    return reason === 'auth' ? { status: 'needsAuth', loc, name } : { status: 'pending', loc, name };
  };
  try {
    const saved = await write(loc, project, fileName, deps);
    if (!saved) return { status: 'cancelled' };
    if ('auth' in saved) return wait('auth');
    await keep('save');
    deps.clearPending(key);
    return { status: 'saved', loc: saved.loc, name: saved.name, concurrentCopy: saved.concurrentCopy };
  } catch (e) {
    if (isNetworkError(e)) return wait('offline');
    if (isAuthError(e)) return wait('auth');
    if (isDestinationFull(e)) {
      // Rien n'est perdu (version locale), et aucune reprise automatique : elle échouerait en boucle
      await keep('pending');
      throw e;
    }
    if (!isConflict(e)) throw e;
    await keep('conflict');
    if (loc.kind === 'device') return { status: 'deviceConflict', name };
    const copyName = conflictName(name, deps.now());
    try {
      const copy = await writeCopy(loc, project, copyName, deps);
      deps.clearPending(key);
      return { status: 'conflictCopy', loc: copy, name, copyName };
    } catch (e2) {
      // Copie impossible pour l'instant : notre version reste dans les versions locales (raison « conflit »)
      if (isNetworkError(e2)) return wait('offline');
      if (isAuthError(e2)) return wait('auth');
      throw e2;
    }
  }
}

async function write(
  loc: Location,
  project: Project,
  fileName: string,
  deps: SaveDeps,
): Promise<{ loc: Location; name: string; concurrentCopy?: string } | { auth: true } | null> {
  switch (loc.kind) {
    case 'browser': {
      const name = fileName || project.meta.title || 'projet';
      const rev = await deps.browserSave(loc.id, name, project, loc.rev ?? 'any');
      return { loc: { ...loc, rev }, name };
    }
    case 'cloud': {
      // Sans identifiant : fichier à créer (jamais de remplacement), dans le dossier désigné (parentId)
      const create = !loc.file.id;
      const name = loc.file.name || newFileName(project, fileName);
      const { concurrentCopy, ...file } = await deps.cloudSave(loc.provider, name, project, create ? 'create' : 'update', loc.file);
      return { loc: { ...loc, file: { ...loc.file, ...file } }, name: file.name, concurrentCopy };
    }
    case 'folder': {
      if (!deps.folderSave) throw new Error('dossier : non pris en charge');
      const { rev, concurrentCopy } = await deps.folderSave(loc, project, 'update');
      return { loc: { ...loc, rev }, name: loc.folder, concurrentCopy };
    }
    case 'github': {
      const token = deps.githubToken();
      if (!token) return { auth: true };
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
      // Même dossier que l'original quand il est connu (Google Drive)
      const where = loc.file.parentId ? { id: '', name: copyName, parentId: loc.file.parentId, resourceKeys: loc.file.resourceKeys } : undefined;
      const file = await deps.cloudSave(loc.provider, copyName, project, 'create', where);
      return { kind: 'cloud', provider: loc.provider, file: { ...file, parentId: loc.file.parentId } };
    }
    case 'folder': {
      // Copie de conflit dans le même dossier : les documents (immuables) sont partagés, rien n'est renvoyé
      if (!deps.folderSave) throw new Error('dossier : non pris en charge');
      const copy: FolderLocation = { ...loc, modelPath: dirOf(loc.modelPath) + conflictName(baseOf(loc.modelPath), deps.now()), rev: undefined };
      const { rev } = await deps.folderSave(copy, project, 'create');
      return { ...copy, rev };
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
