/**
 * Dossier de projet Google Drive (F8), portée `drive.file` : Voltaplan crée le dossier de projet (marqué
 * `appProperties.voltaplan = project`), son sous-dossier `assets` et ses fichiers ; il les voit donc toujours. Un
 * dossier qu'il n'a pas créé n'est visible que si l'utilisateur l'a ouvert avec Voltaplan [à vérifier].
 *
 *  - documents (`assets/<sha256>.<ext>`) : recherchés par nom (et taille) avant tout envoi, créés une seule fois,
 *    jamais remplacés ; envoi « multipart » jusqu'à 5 Mo, « resumable » au-delà, avec reprise après coupure ;
 *  - modèle (`project.json`) : pas d'If-Match dans l'API v3 : stratégie prudente de drive.ts (version et révision
 *    vérifiées avant, révision remplacée conservée, contrôle après envoi, copie de la version concurrente dans le
 *    même dossier, libération des anciennes révisions selon la taille) ;
 *  - Drive admet deux fichiers ou dossiers de même nom : deux appareils qui créent `assets` en même temps donnent
 *    deux dossiers `assets` ; ils sont lus ensemble (union), rien n'est perdu ni supprimé ;
 *  - aucune suppression.
 * Testé avec des réponses simulées [à vérifier avec de vrais comptes].
 */
import { ConflictError, conflictName } from './conflict';
import { DRIVE_FOLDER_MIME, driveCreate, driveCreateFolder, driveFind, driveGet, driveMedia, driveRename, driveUpdate, qstr, type DriveCtx, type DriveItem, type Fetch } from './drive';
import type { FolderBackend, FolderEntry } from '../format/storageBackend';

/** Marque des dossiers créés par Voltaplan (recherche des dossiers de projet). */
export const DRIVE_APP_PROP = 'voltaplan';

export class DriveFolderBackend implements FolderBackend {
  readonly label: string;
  private readonly c: DriveCtx;
  /** Identifiants des sous-dossiers déjà trouvés (« assets » → [id, …]). */
  private dirs = new Map<string, string[]>();

  constructor(
    token: string,
    readonly folderId: string,
    readonly folderName: string,
    fetchFn?: Fetch,
    resourceKeys?: string,
  ) {
    this.label = 'Google Drive : ' + folderName;
    this.c = { token, fetch: fetchFn, resourceKeys };
  }

  private split(path: string): { dir: string; name: string } {
    const i = path.lastIndexOf('/');
    return i < 0 ? { dir: '', name: path } : { dir: path.slice(0, i), name: path.slice(i + 1) };
  }

  private inParents(ids: string[]) {
    return '(' + ids.map((id) => `${qstr(id)} in parents`).join(' or ') + ')';
  }

  /** Fichiers (pas les dossiers) nommés `name` dans l'un des dossiers `parents`, du plus ancien au plus récent. */
  private async filesNamed(parents: string[], name: string): Promise<DriveItem[]> {
    if (!parents.length) return [];
    return driveFind(this.c, `${this.inParents(parents)} and name = ${qstr(name)} and mimeType != ${qstr(DRIVE_FOLDER_MIME)} and trashed = false`);
  }

  /** Dossiers correspondant à `dir` (plusieurs si deux appareils l'ont créé en même temps) ; créé si demandé. */
  private async dirIds(dir: string, create: boolean): Promise<string[]> {
    if (!dir) return [this.folderId];
    const cached = this.dirs.get(dir);
    if (cached?.length) return cached;
    let ids = [this.folderId];
    for (const seg of dir.split('/').filter(Boolean)) {
      const q = `${this.inParents(ids)} and name = ${qstr(seg)} and mimeType = ${qstr(DRIVE_FOLDER_MIME)} and trashed = false`;
      let found = (await driveFind(this.c, q, 'id,name,createdTime')).map((f) => f.id);
      if (!found.length) {
        if (!create) return [];
        await driveCreateFolder(this.c, seg, [ids[0]], { [DRIVE_APP_PROP]: seg });
        // Relu : un autre appareil a pu créer le même dossier au même moment (les deux sont gardés et lus)
        found = (await driveFind(this.c, q, 'id,name,createdTime')).map((f) => f.id);
        if (!found.length) throw new Error('Google Drive : dossier ' + seg + ' introuvable après création');
      }
      ids = found;
    }
    this.dirs.set(dir, ids);
    return ids;
  }

  async readText(path: string) {
    const { dir, name } = this.split(path);
    const f = (await this.filesNamed(await this.dirIds(dir, false), name))[0];
    if (!f) return null;
    // Version d'abord (dans la recherche), contenu ensuite : un changement entre les deux rend l'enregistrement
    // suivant prudent (conflit), jamais l'inverse
    const version = f.version ? `${f.version}|${f.headRevisionId ?? ''}` : undefined;
    return { text: await (await driveMedia(this.c, f.id)).text(), version };
  }

  async readBlob(path: string) {
    const { dir, name } = this.split(path);
    const f = (await this.filesNamed(await this.dirIds(dir, false), name))[0];
    if (!f) throw Object.assign(new Error('Google Drive : absent ' + path), { name: 'NotFoundError' });
    return driveMedia(this.c, f.id);
  }

  async list(dir: string): Promise<FolderEntry[]> {
    const ids = await this.dirIds(dir, false);
    if (!ids.length) return [];
    const files = await driveFind(this.c, `${this.inParents(ids)} and mimeType != ${qstr(DRIVE_FOLDER_MIME)} and trashed = false`, 'id,name,size,createdTime');
    const seen = new Map<string, FolderEntry>();
    for (const f of files) if (!seen.has(f.name)) seen.set(f.name, { name: f.name, size: Number(f.size ?? 0) });
    return [...seen.values()];
  }

  async putIfAbsent(path: string, data: Blob): Promise<{ status: 'created' | 'exists'; size: number }> {
    const { dir, name } = this.split(path);
    const parents = await this.dirIds(dir, true);
    const present = (await this.filesNamed(parents, name))[0];
    if (present) return { status: 'exists', size: Number(present.size ?? 0) };
    const saved = await driveCreate(this.c, name, data, { parents: [parents[0]], mimeType: data.type || 'application/octet-stream' });
    const size = saved.size ?? Number((await driveGet(this.c, saved.id, 'size')).size ?? -1);
    return { status: 'created', size };
  }

  async writeConditional(path: string, data: string, expected: string | null | 'any') {
    const { dir, name } = this.split(path);
    const parents = await this.dirIds(dir, true);
    const where = 'Google Drive : ' + this.folderName + '/' + path;
    const present = await this.filesNamed(parents, name);
    if (expected === null || (expected === 'any' && !present.length)) {
      if (present.length) throw new ConflictError(where, 'existe');
      const created = await driveCreate(this.c, name, data, { parents: [parents[0]], mimeType: 'application/json' });
      // Drive admet deux fichiers de même nom : si un autre appareil a créé le même modèle au même moment, le nôtre
      // est renommé en copie de conflit (rien n'est supprimé) et le conflit est signalé
      const again = await this.filesNamed(parents, name);
      if (again.length > 1 && again[0].id !== created.id) {
        await driveRename(this.c, created.id, conflictName(name));
        throw new ConflictError(where, 'créé ailleurs en même temps');
      }
      return { version: created.rev };
    }
    // Modifié, supprimé ou mis à la corbeille ailleurs : conflit (jamais de recréation silencieuse)
    if (!present.length) throw new ConflictError(where, 'absent');
    const saved = await driveUpdate(this.c, { id: present[0].id, name, rev: expected === 'any' ? undefined : expected }, name, data, expected === 'any' ? 'overwrite' : 'update', {
      parents: [parents[0]],
      mimeType: 'application/json',
    });
    return { version: saved.rev, concurrentCopy: saved.concurrentCopy };
  }
}

/** Dossiers de projet créés par Voltaplan (marqués), du plus récent au plus ancien. */
export async function listDriveFolders(token: string, fetchFn?: Fetch): Promise<{ id: string; name: string; modified?: string }[]> {
  const items = await driveFind(
    { token, fetch: fetchFn },
    `mimeType = ${qstr(DRIVE_FOLDER_MIME)} and appProperties has { key=${qstr(DRIVE_APP_PROP)} and value='project' } and trashed = false`,
    'id,name,modifiedTime,createdTime',
  );
  return items.map((f) => ({ id: f.id, name: f.name, modified: f.modifiedTime })).reverse();
}

/** Nouveau dossier de projet (à la racine de « Mon Drive », ou dans le dossier choisi depuis Drive). */
export async function createDriveProjectFolder(token: string, name: string, parentId?: string, fetchFn?: Fetch, resourceKeys?: string): Promise<{ id: string; name: string }> {
  const f = await driveCreateFolder({ token, fetch: fetchFn, resourceKeys }, name, parentId ? [parentId] : undefined, { [DRIVE_APP_PROP]: 'project' });
  return { id: f.id, name: f.name };
}
