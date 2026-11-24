/**
 * Dossier de projet OneDrive (F8), via Microsoft Graph, dans le dossier de l'application
 * (« Applications/Voltaplan/<projet>/ », autorisation Files.ReadWrite.AppFolder déjà demandée par cloud.ts).
 *
 *  - documents : créés avec `conflictBehavior=fail` (jamais de remplacement), par envoi simple (PUT sur
 *    graph.microsoft.com, seule adresse autorisée par la CSP) ; si le service le refuse (413, ou au-delà de 250 Mo),
 *    session d'envoi par tranches de 10 Mio (multiple de 320 Kio exigé par Graph), reprise d'une tranche après une
 *    coupure ;
 *  - modèle : `If-Match: <eTag>` (412 → conflit), création en `fail` (409 → conflit) ;
 *  - aucune suppression.
 * Comportements décrits d'après la documentation Microsoft Graph et testés avec des réponses simulées
 * [à vérifier avec un vrai compte : limite de l'envoi simple (4 Mo historiques, 250 Mo annoncés) ; l'adresse d'une
 * session d'envoi et la redirection des téléchargements (`/content`) pointent vers un autre domaine
 * (*.files.1drv.com, *.sharepoint.com), à autoriser dans la CSP (src/security/csp.ts) si nécessaire].
 */
import { AuthError, ConflictError } from './conflict';
import type { FolderBackend, FolderEntry } from '../format/storageBackend';

export const GRAPH_APPROOT = 'https://graph.microsoft.com/v1.0/me/drive/special/approot';
/** Envoi simple jusqu'à cette taille (limite annoncée par Microsoft [à vérifier]) ; session d'envoi au-delà. */
export const SIMPLE_UPLOAD_MAX = 250 * 1024 * 1024;
/** Taille d'une tranche de session d'envoi (multiple de 320 Kio). */
export const UPLOAD_CHUNK = 32 * 320 * 1024;

const encPath = (p: string) => p.split('/').filter(Boolean).map(encodeURIComponent).join('/');

/** Nom de dossier sûr (pas de séparateur, pas de caractère refusé par OneDrive). */
export function safeFolderName(name: string): string {
  return (name || 'projet').replace(/[\\/:*?"<>|#%]/g, '_').replace(/^\.+|\.+$/g, '').trim().slice(0, 120) || 'projet';
}

export class OneDriveFolderBackend implements FolderBackend {
  readonly label: string;
  constructor(
    private readonly token: string,
    readonly folder: string,
    private readonly fetchFn: typeof fetch = (...a) => fetch(...a),
    private readonly simpleMax = SIMPLE_UPLOAD_MAX,
  ) {
    this.label = 'OneDrive : ' + folder;
  }

  private url(path: string, suffix = '') {
    return `${GRAPH_APPROOT}:/${encPath(this.folder)}/${encPath(path)}:${suffix}`;
  }

  private async call(url: string, init: RequestInit = {}, auth = true): Promise<Response> {
    const headers = new Headers(init.headers);
    if (auth) headers.set('Authorization', 'Bearer ' + this.token);
    const r = await this.fetchFn(url, { ...init, headers });
    if (r.status === 401) throw new AuthError('OneDrive');
    return r;
  }

  private async fail(r: Response): Promise<never> {
    throw new Error(`OneDrive : ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`);
  }

  async readText(path: string) {
    const meta = await this.call(this.url(path));
    if (meta.status === 404) return null;
    if (!meta.ok) return this.fail(meta);
    // Version d'abord, contenu ensuite : un changement entre les deux rend l'enregistrement suivant prudent
    const version = ((await meta.json()) as { eTag?: string }).eTag;
    const c = await this.call(this.url(path, '/content'));
    if (!c.ok) return this.fail(c);
    return { text: await c.text(), version };
  }

  async readBlob(path: string) {
    const r = await this.call(this.url(path, '/content'));
    if (r.status === 404) throw Object.assign(new Error('OneDrive : absent ' + path), { name: 'NotFoundError' });
    if (!r.ok) return this.fail(r);
    return r.blob();
  }

  async list(dir: string): Promise<FolderEntry[]> {
    const out: FolderEntry[] = [];
    let next: string | undefined = `${GRAPH_APPROOT}:/${encPath(this.folder)}/${encPath(dir)}:/children?$select=name,size,file&$top=1000`;
    while (next) {
      const r = await this.call(next);
      if (r.status === 404) return [];
      if (!r.ok) return this.fail(r);
      const j = (await r.json()) as { value: { name: string; size: number; file?: unknown }[]; '@odata.nextLink'?: string };
      for (const v of j.value) if (v.file) out.push({ name: v.name, size: v.size });
      next = j['@odata.nextLink'];
    }
    return out;
  }

  private async sizeOf(path: string): Promise<number> {
    const r = await this.call(this.url(path));
    if (!r.ok) return this.fail(r);
    return ((await r.json()) as { size: number }).size;
  }

  async putIfAbsent(path: string, data: Blob): Promise<{ status: 'created' | 'exists'; size: number }> {
    if (data.size <= this.simpleMax) {
      const r = await this.call(this.url(path, '/content?@microsoft.graph.conflictBehavior=fail'), { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: data });
      if (r.status === 409) return { status: 'exists', size: await this.sizeOf(path) };
      // 413 : trop gros pour un envoi simple sur ce compte : session d'envoi ci-dessous
      if (r.status !== 413) {
        if (!r.ok) return this.fail(r);
        return { status: 'created', size: ((await r.json()) as { size: number }).size };
      }
    }
    // Session d'envoi : le fichier n'apparaît qu'une fois complet (une coupure ne laisse pas de fichier partiel)
    const s = await this.call(this.url(path, '/createUploadSession'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'fail' } }),
    });
    if (s.status === 409) return { status: 'exists', size: await this.sizeOf(path) };
    if (!s.ok) return this.fail(s);
    const uploadUrl = ((await s.json()) as { uploadUrl: string }).uploadUrl;
    let start = 0;
    let retries = 0;
    while (start < data.size) {
      const end = Math.min(start + UPLOAD_CHUNK, data.size);
      let r: Response;
      try {
        // L'adresse de session est pré-authentifiée : pas d'en-tête Authorization
        r = await this.call(uploadUrl, { method: 'PUT', headers: { 'Content-Range': `bytes ${start}-${end - 1}/${data.size}` }, body: data.slice(start, end) }, false);
      } catch (e) {
        if (!(e instanceof TypeError) || retries++ >= 3) throw e;
        // Coupure : on demande au service où reprendre
        const st = await this.call(uploadUrl, {}, false);
        if (!st.ok) throw e;
        const ranges = ((await st.json()) as { nextExpectedRanges?: string[] }).nextExpectedRanges ?? [];
        start = ranges.length ? Number(ranges[0].split('-')[0]) : start;
        continue;
      }
      if (r.status === 409) return { status: 'exists', size: await this.sizeOf(path) };
      if (r.status === 202) {
        const ranges = ((await r.json()) as { nextExpectedRanges?: string[] }).nextExpectedRanges ?? [];
        start = ranges.length ? Number(ranges[0].split('-')[0]) : end;
        continue;
      }
      if (!r.ok) return this.fail(r);
      return { status: 'created', size: ((await r.json()) as { size: number }).size };
    }
    throw new Error('OneDrive : session d’envoi incomplète');
  }

  async writeConditional(path: string, data: string, expected: string | null | 'any') {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let url: string;
    if (expected === null) url = this.url(path, '/content?@microsoft.graph.conflictBehavior=fail');
    else if (expected === 'any') url = this.url(path, '/content?@microsoft.graph.conflictBehavior=replace');
    else {
      url = this.url(path, '/content');
      headers['If-Match'] = expected;
    }
    const r = await this.call(url, { method: 'PUT', headers, body: data });
    // 412 : modifié ailleurs ; 409 : existe déjà (création) ; 404 avec If-Match : supprimé ailleurs
    if (r.status === 412 || r.status === 409 || (r.status === 404 && expected !== null && expected !== 'any')) throw new ConflictError('OneDrive : ' + this.folder + '/' + path, String(r.status));
    if (!r.ok) return this.fail(r);
    return { version: ((await r.json()) as { eTag?: string }).eTag };
  }
}

/** Dossiers de projet présents dans le dossier de l'application. */
export async function listOneDriveFolders(token: string, fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<{ name: string; modified?: string }[]> {
  const out: { name: string; modified?: string }[] = [];
  let next: string | undefined = `${GRAPH_APPROOT}/children?$select=name,folder,lastModifiedDateTime&$top=1000`;
  while (next) {
    const r = await fetchFn(next, { headers: { Authorization: 'Bearer ' + token } });
    if (r.status === 401) throw new AuthError('OneDrive');
    if (r.status === 404) return [];
    if (!r.ok) throw new Error(`OneDrive : ${r.status}`);
    const j = (await r.json()) as { value: { name: string; folder?: unknown; lastModifiedDateTime?: string }[]; '@odata.nextLink'?: string };
    for (const v of j.value) if (v.folder) out.push({ name: v.name, modified: v.lastModifiedDateTime });
    next = j['@odata.nextLink'];
  }
  return out;
}
