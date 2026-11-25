/**
 * Services SIMULÉS pour les tests (aucun appel réseau) : Dropbox (API v2) et Google Drive (API v3), réduits aux
 * appels de Voltaplan et écrits d'après leur documentation [à vérifier avec de vrais comptes]. Chaque faux service
 * garde ses fichiers en mémoire, journalise les appels et permet d'injecter des pannes (`before`).
 */
export type Call = { url: string; method: string; headers: Record<string, string>; body?: unknown };

const json = (v: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const hdrs = (init: RequestInit = {}) => {
  const h: Record<string, string> = {};
  new Headers(init.headers).forEach((v, k) => (h[k.toLowerCase()] = v));
  return h;
};
async function bodyBytes(body: unknown): Promise<Uint8Array> {
  if (body == null) return new Uint8Array();
  if (typeof body === 'string') return new TextEncoder().encode(body);
  if (body instanceof Blob) return new Uint8Array(await body.arrayBuffer());
  throw new Error('corps inattendu');
}
/** `fetch` d'un faux service : traitement, puis panne éventuelle « réponse perdue » (`after`). */
function wrap(f: { handle: (url: string, init?: RequestInit) => Promise<Response>; calls: Call[]; after?: (c: Call) => void }): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    const r = await f.handle(url, init);
    f.after?.(f.calls[f.calls.length - 1]);
    return r;
  }) as unknown as typeof fetch;
}

// ---------------------------------------------------------------------------
// Dropbox
// ---------------------------------------------------------------------------

export class FakeDropbox {
  files = new Map<string, { data: Uint8Array; rev: string; path?: string; modified?: string }>();
  sessions = new Map<string, Uint8Array>();
  calls: Call[] = [];
  /** Panne injectée : appelée avant chaque requête ; lever une TypeError simule une coupure réseau. */
  before?: (c: Call) => void;
  /** Réponse perdue : appelée après le traitement (lever une TypeError simule une coupure après réception). */
  after?: (c: Call) => void;
  /** Espace épuisé : toute écriture de contenu échoue (409 insufficient_space). */
  full = false;
  private n = 0;
  token = 'tok';

  handle = async (url: string, init: RequestInit = {}): Promise<Response> => {
    const headers = hdrs(init);
    const c: Call = { url, method: init.method ?? 'GET', headers, body: init.body };
    this.calls.push(c);
    this.before?.(c);
    if (headers.authorization !== 'Bearer ' + this.token) return json({ error_summary: 'expired_access_token/' }, 401);
    const ep = url.replace(/^https:\/\/(api|content)\.dropboxapi\.com\/2\//, '');
    const arg = JSON.parse(headers['dropbox-api-arg'] ?? (typeof init.body === 'string' ? init.body : '{}'));
    const key = (p: string) => p.toLowerCase();
    const meta = (p: string) => {
      const f = this.files.get(key(p))!;
      return { '.tag': 'file', name: (f.path ?? p).split('/').pop(), path_lower: key(p), size: f.data.length, rev: f.rev, ...(f.modified ? { server_modified: f.modified } : {}) };
    };
    const notFound = () => json({ error_summary: 'path/not_found/..' }, 409);
    const commit = async (path: string, mode: unknown, data: Uint8Array, strict?: boolean) => {
      const cur = this.files.get(key(path));
      const tag = typeof mode === 'string' ? mode : (mode as { '.tag': string })['.tag'];
      if (tag === 'add' && cur) {
        // Dropbox : contenu identique → pas de conflit [à vérifier]
        if (cur.data.length === data.length && cur.data.every((b, i) => b === data[i])) return json(meta(path));
        return json({ error_summary: 'path/conflict/file/..' }, 409);
      }
      if (tag === 'update' && (cur ? cur.rev !== (mode as { update: string }).update : strict)) return json({ error_summary: 'path/conflict/file/..' }, 409);
      if (this.full) return json({ error_summary: 'path/insufficient_space/..' }, 409);
      this.files.set(key(path), { data, rev: 'r' + ++this.n, path, modified: new Date(Date.UTC(2026, 10, 24, 12, 0, this.n)).toISOString().replace('.000', '') });
      return json(meta(path));
    };
    switch (ep) {
      case 'files/upload':
        return commit(arg.path, arg.mode, await bodyBytes(init.body), arg.strict_conflict);
      case 'files/download': {
        if (!this.files.has(key(arg.path))) return notFound();
        return new Response(new Blob([this.files.get(key(arg.path))!.data as BlobPart]), { status: 200, headers: { 'Dropbox-API-Result': JSON.stringify(meta(arg.path)) } });
      }
      case 'files/get_metadata':
        return this.files.has(key(arg.path)) ? json(meta(arg.path)) : notFound();
      case 'files/list_folder':
      case 'files/list_folder/continue': {
        const cur = ep.endsWith('continue') ? JSON.parse(atob(arg.cursor)) : { dir: key(arg.path), page: 0, recursive: !!arg.recursive };
        const { dir, page, recursive } = cur as { dir: string; page: number; recursive: boolean };
        const prefix = dir ? dir + '/' : '/';
        const all = new Map<string, unknown>();
        for (const p of this.files.keys())
          if (p.startsWith(prefix)) {
            const rest = p.slice(prefix.length);
            const segs = rest.split('/');
            const display = (this.files.get(p)!.path ?? p).slice(prefix.length).split('/');
            if (!rest.includes('/')) all.set(rest, meta(p));
            else if (!recursive) all.set(segs[0], { '.tag': 'folder', name: display[0], path_lower: prefix + segs[0] });
            else {
              // Liste récursive : chaque dossier intermédiaire, puis le fichier (Dropbox ne date pas les dossiers)
              for (let i = 1; i < segs.length; i++) all.set(segs.slice(0, i).join('/'), { '.tag': 'folder', name: display[i - 1], path_lower: prefix + segs.slice(0, i).join('/') });
              all.set(rest, meta(p));
            }
          }
        if (!all.size && dir) return notFound();
        const entries = [...all.values()];
        // Deux éléments par page : la pagination est exercée
        const slice = entries.slice(page * 2, page * 2 + 2);
        const more = entries.length > page * 2 + 2;
        return json({ entries: slice, has_more: more, cursor: btoa(JSON.stringify({ dir, page: page + 1, recursive })) });
      }
      case 'files/upload_session/start': {
        const id = 's' + ++this.n;
        this.sessions.set(id, await bodyBytes(init.body));
        return json({ session_id: id });
      }
      case 'files/upload_session/append_v2': {
        const cur = this.sessions.get(arg.cursor.session_id)!;
        if (arg.cursor.offset !== cur.length) return json({ error_summary: 'incorrect_offset/..', error: { '.tag': 'incorrect_offset', correct_offset: cur.length } }, 409);
        const add = await bodyBytes(init.body);
        const next = new Uint8Array(cur.length + add.length);
        next.set(cur);
        next.set(add, cur.length);
        this.sessions.set(arg.cursor.session_id, next);
        return json(null);
      }
      case 'files/upload_session/finish': {
        const data = this.sessions.get(arg.cursor.session_id)!;
        if (arg.cursor.offset !== data.length) return json({ error_summary: 'lookup_failed/incorrect_offset/..' }, 409);
        return commit(arg.commit.path, arg.commit.mode, data);
      }
    }
    return json({ error_summary: 'inconnu ' + ep }, 400);
  };
  fetch = wrap(this);
}

// ---------------------------------------------------------------------------
// Google Drive
// ---------------------------------------------------------------------------

interface DFile {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  appProperties?: Record<string, string>;
  createdTime: string;
  revisions: { id: string; data: Uint8Array; keepForever: boolean; modifiedTime: string }[];
  version: number;
  trashed?: boolean;
}

const FOLDER = 'application/vnd.google-apps.folder';

export class FakeDrive {
  files = new Map<string, DFile>();
  calls: Call[] = [];
  before?: (c: Call) => void;
  after?: (c: Call) => void;
  full = false;
  token = 'tok';
  private n = 0;
  private sessions = new Map<string, { meta: Partial<DFile>; target?: string; data: Uint8Array; size: number; doneId?: string }>();
  /** Sessions d'envoi expirées (Drive les garde environ une semaine) : 404. */
  expireSessions() {
    this.sessions.clear();
  }
  /**
   * Comme le vrai service (constaté le 2026-11-24) : `version` augmente aussi sans changement de contenu, juste après
   * une création et à chaque marquage d'une révision. Désactivable pour les tests qui comptent les versions.
   */
  bumpsVersionOnMetadata = true;
  /** Écriture « concurrente » injectée juste après le prochain envoi de contenu sur ce fichier (course). */
  raceAfterUpload?: { id: string; data: string };

  private tick() {
    return new Date(Date.UTC(2026, 10, 24, 12, 0, ++this.n)).toISOString();
  }
  newId(prefix = 'F') {
    return prefix + String(++this.n).padStart(12, '0');
  }

  addFile(name: string, data: string | Uint8Array, parents: string[] = ['root'], mimeType = 'application/json', appProperties?: Record<string, string>): DFile {
    const f: DFile = { id: this.newId(mimeType === FOLDER ? 'D' : 'F'), name, mimeType, parents, appProperties, createdTime: this.tick(), revisions: [], version: 0 };
    if (mimeType !== FOLDER) this.addRevision(f, typeof data === 'string' ? new TextEncoder().encode(data) : data);
    this.files.set(f.id, f);
    return f;
  }
  addRevision(f: DFile, data: Uint8Array, keepForever = false) {
    f.revisions.push({ id: 'rev' + ++this.n, data, keepForever, modifiedTime: this.tick() });
    f.version = this.n;
  }
  text(id: string) {
    const f = this.files.get(id)!;
    return new TextDecoder().decode(f.revisions[f.revisions.length - 1].data);
  }
  byName(name: string) {
    return [...this.files.values()].filter((f) => f.name === name);
  }

  private view(f: DFile) {
    const head = f.revisions[f.revisions.length - 1];
    return {
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      parents: f.parents,
      appProperties: f.appProperties,
      createdTime: f.createdTime,
      modifiedTime: head?.modifiedTime ?? f.createdTime,
      ...(head ? { size: String(head.data.length), version: String(f.version), headRevisionId: head.id } : {}),
      capabilities: { canEdit: true },
    };
  }

  private query(q: string): DFile[] {
    const parents = [...q.matchAll(/'([^']+)' in parents/g)].map((m) => m[1]);
    const name = /name = '((?:[^'\\]|\\.)*)'/.exec(q)?.[1]?.replace(/\\(.)/g, '$1');
    const isFolder = /mimeType = 'application\/vnd\.google-apps\.folder'/.test(q);
    const notFolder = /mimeType != 'application\/vnd\.google-apps\.folder'/.test(q);
    const prop = /appProperties has \{ key='([^']+)' and value='([^']+)' \}/.exec(q);
    return [...this.files.values()]
      .filter((f) => !f.trashed)
      .filter((f) => !parents.length || f.parents.some((p) => parents.includes(p)))
      .filter((f) => name === undefined || f.name === name)
      .filter((f) => !isFolder || f.mimeType === FOLDER)
      .filter((f) => !notFolder || f.mimeType !== FOLDER)
      .filter((f) => !prop || f.appProperties?.[prop[1]] === prop[2])
      .sort((a, b) => a.createdTime.localeCompare(b.createdTime));
  }

  private upload(f: DFile, data: Uint8Array, keep: boolean) {
    if (this.full) return json({ error: { code: 403, errors: [{ reason: 'storageQuotaExceeded' }] } }, 403);
    this.addRevision(f, data, keep);
    const r = this.raceAfterUpload;
    if (r && r.id === f.id) {
      // Un autre appareil enregistre juste après nous (notre contrôle avant envoi est déjà passé)
      this.raceAfterUpload = undefined;
      const theirs = f.revisions.pop()!;
      this.addRevision(f, new TextEncoder().encode(r.data));
      f.revisions.push(theirs);
      f.version++;
    }
    return json(this.view(f));
  }

  private create(meta: Partial<DFile>, data: Uint8Array, keep: boolean) {
    if (this.full) return json({ error: { code: 403, errors: [{ reason: 'storageQuotaExceeded' }] } }, 403);
    const f: DFile = { id: this.newId(), name: meta.name!, mimeType: meta.mimeType ?? 'application/octet-stream', parents: meta.parents ?? ['root'], appProperties: meta.appProperties, createdTime: this.tick(), revisions: [], version: 0 };
    this.addRevision(f, data, keep);
    this.files.set(f.id, f);
    const res = json(this.view(f));
    // Traitement interne de Drive après la création : la version lue ensuite n'est plus celle de la réponse
    if (this.bumpsVersionOnMetadata) f.version++;
    return res;
  }

  handle = async (url: string, init: RequestInit = {}): Promise<Response> => {
    const headers = hdrs(init);
    const method = init.method ?? 'GET';
    const c: Call = { url, method, headers, body: init.body };
    this.calls.push(c);
    this.before?.(c);
    if (headers.authorization !== 'Bearer ' + this.token) return json({ error: { code: 401 } }, 401);
    const u = new URL(url);
    const p = u.pathname;
    const keep = u.searchParams.get('keepRevisionForever') === 'true';
    // Session d'envoi « resumable »
    if (u.searchParams.get('upload_id')) {
      const s = this.sessions.get(u.searchParams.get('upload_id')!);
      if (!s) return json({ error: { code: 404, message: 'session expirée' } }, 404);
      // Session terminée : comme le vrai service, le fichier déjà créé (jamais un second)
      if (s.doneId) return json(this.view(this.files.get(s.doneId)!));
      const range = headers['content-range'];
      const add = await bodyBytes(init.body);
      if (range.startsWith('bytes */')) {
        if (s.data.length < s.size) return new Response(null, { status: 308, headers: s.data.length ? { Range: `bytes=0-${s.data.length - 1}` } : {} });
      } else {
        const start = Number(/bytes (\d+)-/.exec(range)![1]);
        if (start !== s.data.length) return new Response(null, { status: 308, headers: s.data.length ? { Range: `bytes=0-${s.data.length - 1}` } : {} });
        const next = new Uint8Array(s.data.length + add.length);
        next.set(s.data);
        next.set(add, s.data.length);
        s.data = next;
        if (s.data.length < s.size) return new Response(null, { status: 308, headers: { Range: `bytes=0-${s.data.length - 1}` } });
      }
      const res = s.target ? this.upload(this.files.get(s.target)!, s.data, keep) : this.create(s.meta, s.data, true);
      s.doneId = s.target ?? [...this.files.values()].pop()!.id;
      return res;
    }
    if (p === '/upload/drive/v3/files' && u.searchParams.get('uploadType') === 'multipart') {
      const bytes = await bodyBytes(init.body);
      const text = new TextDecoder('latin1').decode(bytes);
      const boundary = '--' + /boundary=(.+)$/.exec(headers['content-type'])![1];
      const h1 = text.indexOf('\r\n\r\n');
      const metaEnd = text.indexOf('\r\n' + boundary, h1);
      const meta = JSON.parse(new TextDecoder().decode(bytes.slice(h1 + 4, metaEnd)));
      const h2 = text.indexOf('\r\n\r\n', metaEnd);
      const end = text.lastIndexOf('\r\n' + boundary + '--');
      return this.create(meta, bytes.slice(h2 + 4, end), keep);
    }
    if (u.searchParams.get('uploadType') === 'resumable') {
      const id = String(++this.n);
      const target = /\/upload\/drive\/v3\/files\/([^/?]+)/.exec(p)?.[1];
      this.sessions.set(id, { meta: JSON.parse(String(init.body ?? '{}')), target: target && decodeURIComponent(target), data: new Uint8Array(), size: Number(headers['x-upload-content-length']) });
      return new Response('', { status: 200, headers: { Location: `https://www.googleapis.com/upload/drive/v3/files?upload_id=${id}` } });
    }
    const up = /^\/upload\/drive\/v3\/files\/([^/]+)$/.exec(p);
    if (up && method === 'PATCH') {
      const f = this.files.get(decodeURIComponent(up[1]));
      if (!f) return json({}, 404);
      return this.upload(f, await bodyBytes(init.body), keep);
    }
    if (p === '/drive/v3/files' && method === 'GET') {
      const all = this.query(u.searchParams.get('q') ?? '').map((f) => this.view(f));
      // Une page de 2 éléments : la pagination est exercée
      const page = Number(u.searchParams.get('pageToken') ?? 0);
      const next = all.length > page + 2 ? String(page + 2) : undefined;
      return json({ files: all.slice(page, page + 2), ...(next ? { nextPageToken: next } : {}) });
    }
    if (p === '/drive/v3/files' && method === 'POST') {
      const meta = JSON.parse(String(init.body));
      const f = this.addFile(meta.name, '', meta.parents ?? ['root'], meta.mimeType, meta.appProperties);
      return json(this.view(f));
    }
    const rev = /^\/drive\/v3\/files\/([^/]+)\/revisions(?:\/([^/]+))?$/.exec(p);
    if (rev) {
      const f = this.files.get(decodeURIComponent(rev[1]))!;
      if (!rev[2]) return json({ revisions: f.revisions.map((r) => ({ id: r.id, keepForever: r.keepForever, size: String(r.data.length), modifiedTime: r.modifiedTime })) });
      const r = f.revisions.find((x) => x.id === decodeURIComponent(rev[2]));
      if (!r) return json({}, 404);
      if (method === 'PATCH') {
        r.keepForever = JSON.parse(String(init.body)).keepForever;
        if (this.bumpsVersionOnMetadata) f.version++;
        return json({ id: r.id, keepForever: r.keepForever });
      }
      return new Response(new Blob([r.data as BlobPart]));
    }
    const one = /^\/drive\/v3\/files\/([^/]+)$/.exec(p);
    if (one) {
      const f = this.files.get(decodeURIComponent(one[1]));
      if (!f || f.trashed) return json({ error: { code: 404 } }, 404);
      if (method === 'PATCH') {
        Object.assign(f, JSON.parse(String(init.body)));
        return json(this.view(f));
      }
      if (u.searchParams.get('alt') === 'media') return new Response(new Blob([f.revisions[f.revisions.length - 1].data as BlobPart]));
      return json(this.view(f));
    }
    return json({ error: 'inconnu ' + p }, 400);
  };
  fetch = wrap(this);
}
