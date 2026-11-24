/**
 * Dossier de projet Dropbox (F8), dans le dossier de l'application (« Applications/Voltaplan/<projet>/ »), avec
 * les autorisations déjà demandées (files.metadata.read, files.content.read, files.content.write).
 *
 *  - documents : envoi en mode `add` sans renommage automatique (jamais de remplacement ; conflit = déjà présent) ;
 *    au-delà de 150 Mo (limite de l'envoi simple [à vérifier]) ou si le service refuse (413), session d'envoi par
 *    tranches de 8 Mio, reprise à la position indiquée par le service après une coupure (`incorrect_offset`) ;
 *  - modèle : mode `update` avec la révision lue (`strict_conflict` : un fichier supprimé ailleurs est aussi un
 *    conflit), création en `add` ; conflit → ConflictError, la copie de conflit est écrite dans le même dossier ;
 *  - aucune suppression.
 * Comportements d'après la documentation de l'API Dropbox v2, testés avec des réponses simulées [à vérifier avec
 * un vrai compte].
 */
import { asciiJson } from './cloud';
import { AuthError, cloudQuotaReached, ConflictError, StorageFullError } from './conflict';
import type { FolderBackend, FolderEntry } from '../format/storageBackend';
import { FOLDER_MODEL } from '../format/folder';

const API = 'https://api.dropboxapi.com/2';
const CONTENT = 'https://content.dropboxapi.com/2';
/** Envoi simple jusqu'à cette taille (150 Mo selon la documentation Dropbox [à vérifier]) ; session au-delà. */
export const DROPBOX_SIMPLE_MAX = 150 * 1024 * 1024;
/** Taille d'une tranche de session d'envoi (multiple de 4 Mio). */
export const DROPBOX_CHUNK = 8 * 1024 * 1024;

type Fetch = typeof fetch;
interface Meta {
  '.tag'?: string;
  name: string;
  size?: number;
  rev?: string;
  path_lower?: string;
  server_modified?: string;
}

export class DropboxFolderBackend implements FolderBackend {
  readonly label: string;
  constructor(
    private readonly token: string,
    readonly folder: string,
    private readonly fetchFn: Fetch = (...a) => fetch(...a),
    private readonly simpleMax = DROPBOX_SIMPLE_MAX,
    private readonly chunk = DROPBOX_CHUNK,
  ) {
    this.label = 'Dropbox : ' + folder;
  }

  /** Chemin dans le dossier de l'application (la racine « / » est le dossier de l'application). */
  private p(path: string) {
    return '/' + [this.folder, ...path.split('/')].filter(Boolean).join('/');
  }

  private async call(url: string, headers: Record<string, string>, body?: BodyInit): Promise<Response> {
    const r = await this.fetchFn(url, { method: 'POST', headers: { Authorization: 'Bearer ' + this.token, ...headers }, body });
    if (r.status === 401) throw new AuthError('Dropbox');
    return r;
  }
  private rpc(endpoint: string, arg: unknown) {
    return this.call(`${API}/${endpoint}`, { 'Content-Type': 'application/json' }, JSON.stringify(arg));
  }
  private content(endpoint: string, arg: unknown, body?: Blob) {
    return this.call(`${CONTENT}/${endpoint}`, { 'Dropbox-API-Arg': asciiJson(arg), ...(body ? { 'Content-Type': 'application/octet-stream' } : {}) }, body);
  }

  /** Erreur du service : espace épuisé → StorageFullError ; autre → Error (texte tronqué). */
  private async fail(r: Response, text?: string): Promise<never> {
    const t = (text ?? (await r.text().catch(() => ''))).slice(0, 2000);
    // 409 « path/insufficient_space » : espace Dropbox épuisé [à vérifier avec un vrai compte]
    if (cloudQuotaReached(r.status, t)) throw new StorageFullError('Dropbox', `${r.status} insufficient_space`);
    throw new Error(`Dropbox : ${r.status} ${t.slice(0, 200)}`);
  }

  private async meta(path: string): Promise<Meta | null> {
    const r = await this.rpc('files/get_metadata', { path: this.p(path) });
    if (r.status === 409) {
      const t = await r.text();
      if (/not_found/.test(t)) return null;
      return this.fail(r, t);
    }
    if (!r.ok) return this.fail(r);
    return (await r.json()) as Meta;
  }

  async readText(path: string) {
    const r = await this.content('files/download', { path: this.p(path) });
    if (r.status === 409) {
      const t = await r.text();
      if (/not_found/.test(t)) return null;
      return this.fail(r, t);
    }
    if (!r.ok) return this.fail(r);
    let version: string | undefined;
    try {
      version = (JSON.parse(r.headers.get('Dropbox-API-Result') ?? '{}') as { rev?: string }).rev;
    } catch {
      /* en-tête illisible */
    }
    const text = await r.text();
    // En-tête non exposé au navigateur : révision demandée à part ; si elle a changé entre-temps, l'enregistrement
    // suivant sera refusé (prudent), jamais l'inverse [à vérifier : en-tête lisible (CORS)]
    if (!version) version = (await this.meta(path))?.rev;
    return { text, version };
  }

  async readBlob(path: string) {
    const r = await this.content('files/download', { path: this.p(path) });
    if (r.status === 409) {
      const t = await r.text();
      if (/not_found/.test(t)) throw Object.assign(new Error('Dropbox : absent ' + path), { name: 'NotFoundError' });
      return this.fail(r, t);
    }
    if (!r.ok) return this.fail(r);
    return r.blob();
  }

  async list(dir: string): Promise<FolderEntry[]> {
    const out: FolderEntry[] = [];
    let r = await this.rpc('files/list_folder', { path: this.p(dir), limit: 2000 });
    for (;;) {
      if (r.status === 409) {
        const t = await r.text();
        if (/not_found/.test(t)) return [];
        return this.fail(r, t);
      }
      if (!r.ok) return this.fail(r);
      const j = (await r.json()) as { entries: Meta[]; cursor: string; has_more: boolean };
      for (const e of j.entries) if (e['.tag'] === 'file') out.push({ name: e.name, size: e.size ?? 0 });
      if (!j.has_more) return out;
      r = await this.rpc('files/list_folder/continue', { cursor: j.cursor });
    }
  }

  private async existing(path: string): Promise<{ status: 'exists'; size: number }> {
    const m = await this.meta(path);
    return { status: 'exists', size: m?.size ?? -1 };
  }

  async putIfAbsent(path: string, data: Blob): Promise<{ status: 'created' | 'exists'; size: number }> {
    const commit = { path: this.p(path), mode: 'add', autorename: false, mute: true };
    if (data.size <= this.simpleMax) {
      const r = await this.content('files/upload', commit, data);
      if (r.status === 409) {
        const t = await r.text();
        // Déjà présent (nommé par son contenu) : jamais remplacé
        if (/conflict/.test(t)) return this.existing(path);
        return this.fail(r, t);
      }
      // 413 : trop gros pour un envoi simple : session d'envoi ci-dessous
      if (r.status !== 413) {
        if (!r.ok) return this.fail(r);
        return { status: 'created', size: ((await r.json()) as Meta).size ?? -1 };
      }
    }
    // Session d'envoi : le fichier n'apparaît qu'à la fin (une coupure ne laisse pas de fichier partiel)
    const s = await this.content('files/upload_session/start', { close: false }, new Blob([]));
    if (!s.ok) return this.fail(s);
    const session_id = ((await s.json()) as { session_id: string }).session_id;
    let offset = 0;
    let retries = 0;
    for (let guard = Math.ceil(data.size / this.chunk) + 8; offset < data.size && guard > 0; guard--) {
      const end = Math.min(offset + this.chunk, data.size);
      let r: Response;
      try {
        r = await this.content('files/upload_session/append_v2', { cursor: { session_id, offset }, close: false }, data.slice(offset, end));
      } catch (e) {
        // Coupure : même tranche renvoyée ; si le service l'avait reçue, il répond avec la bonne position
        if (!(e instanceof TypeError) || retries++ >= 3) throw e;
        continue;
      }
      if (r.status === 409) {
        const t = await r.text();
        const m = /"correct_offset":\s*(\d+)/.exec(t);
        if (/incorrect_offset/.test(t) && m) {
          offset = Number(m[1]);
          continue;
        }
        return this.fail(r, t);
      }
      if (!r.ok) return this.fail(r);
      offset = end;
    }
    if (offset < data.size) throw new Error('Dropbox : session d’envoi incomplète');
    const f = await this.content('files/upload_session/finish', { cursor: { session_id, offset: data.size }, commit }, new Blob([]));
    if (f.status === 409) {
      const t = await f.text();
      if (/conflict/.test(t)) return this.existing(path);
      return this.fail(f, t);
    }
    if (!f.ok) return this.fail(f);
    return { status: 'created', size: ((await f.json()) as Meta).size ?? -1 };
  }

  async writeConditional(path: string, data: string, expected: string | null | 'any') {
    const mode = expected === null ? 'add' : expected === 'any' ? 'overwrite' : { '.tag': 'update', update: expected };
    const r = await this.content('files/upload', { path: this.p(path), mode, autorename: false, mute: true, strict_conflict: true }, new Blob([data], { type: 'application/json' }));
    if (r.status === 409) {
      const t = await r.text();
      // Modifié (rev différente), supprimé ailleurs (strict_conflict) ou déjà créé : conflit
      if (/conflict/.test(t)) throw new ConflictError(this.label + '/' + path, t.slice(0, 120));
      return this.fail(r, t);
    }
    if (!r.ok) return this.fail(r);
    return { version: ((await r.json()) as Meta).rev };
  }
}

/** Dossiers de projet présents dans le dossier de l'application Dropbox. */
/**
 * Dossiers de projet du dossier de l'application, avec la date de leur project.json. Dropbox ne date pas les
 * dossiers : une seule liste récursive (mêmes appels qu'une liste simple, plus de pages seulement s'il y a beaucoup
 * de documents) donne les dossiers et la date de leur modèle.
 */
export async function listDropboxFolders(token: string, fetchFn: Fetch = (...a) => fetch(...a)): Promise<{ name: string; modified?: string }[]> {
  const names = new Map<string, string>();
  const dates = new Map<string, string>();
  const post = (endpoint: string, arg: unknown) =>
    fetchFn(`${API}/${endpoint}`, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(arg) });
  let r = await post('files/list_folder', { path: '', recursive: true, limit: 2000 });
  for (;;) {
    if (r.status === 401) throw new AuthError('Dropbox');
    if (!r.ok) throw new Error(`Dropbox : ${r.status}`);
    const j = (await r.json()) as { entries: Meta[]; cursor: string; has_more: boolean };
    for (const e of j.entries) {
      const parts = (e.path_lower ?? '').split('/').filter(Boolean);
      if (e['.tag'] === 'folder' && parts.length === 1) names.set(parts[0], e.name);
      else if (e['.tag'] === 'file' && parts.length === 2 && parts[1] === FOLDER_MODEL && e.server_modified) dates.set(parts[0], e.server_modified);
    }
    if (!j.has_more) break;
    r = await post('files/list_folder/continue', { cursor: j.cursor });
  }
  return [...names].map(([k, name]) => ({ name, ...(dates.has(k) ? { modified: dates.get(k) } : {}) }));
}
