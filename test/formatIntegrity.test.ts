// @vitest-environment node
/**
 * Intégrité du format v2 face aux pannes (simulées) : interruption pendant l'enregistrement, disque plein, stockage
 * du navigateur plein, espace d'un service cloud épuisé, fichier trop gros. Pour chaque cas : l'original reste
 * intact, rien d'incomplet n'est publié, la version est gardée, le message est clair, et aucune reprise automatique
 * en boucle. Les réponses des services sont SIMULÉES d'après leur documentation [à vérifier avec de vrais comptes].
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readArchive, writeArchive, type ArchiveWriteInput } from '../src/format/archive';
import { AssetStore, MemoryAssetBackend } from '../src/format/assets';
import { saveToFolder, type FolderDoc } from '../src/format/folder';
import { sha256Hex } from '../src/format/sha256';
import { MemoryFolderBackend } from '../src/format/storageBackend';
import { PROVIDERS, type CloudFile } from '../src/io/cloud';
import { cloudQuotaReached, FileTooLargeError, isDestinationFull, isQuotaError, StorageFullError } from '../src/io/conflict';
import { OneDriveFolderBackend } from '../src/io/oneDriveFolder';
import { assetSession } from '../src/io/projectData';
import { saveAt, type SaveDeps } from '../src/io/saveFlow';
import { githubSave, type FolderLocation } from '../src/io/storage';
import { translate } from '../src/i18n';
import { errorText } from '../src/ui/errors';
import { emptyProject } from '../src/model/tree';
import type { Project } from '../src/model/types';

const jpeg = (seed: number, n = 5000) => {
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) b[i] = (i * seed + 1) & 0xff;
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  return b;
};
const quota = () => new DOMException('plus de place', 'QuotaExceededError');
const t = (k: string, p?: Record<string, string | number>) => translate('fr', k, p);
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });

afterEach(() => vi.unstubAllGlobals());

/** Projet avec des photos de tableau rangées dans le stockage de travail de l'application. */
async function projectWithPhotos(seeds: number[]): Promise<Project> {
  const p = emptyProject();
  p.meta.title = 'Maison';
  const boards: Record<string, unknown> = {};
  for (const s of seeds) {
    const meta = await assetSession.store.add(new Blob([jpeg(s)], { type: 'image/jpeg' }));
    boards['b' + s] = { slots: {}, photo: { href: 'asset:' + meta.sha256, x: 0, y: 0, w: 1, h: 1 } };
  }
  p.boards = boards as Project['boards'];
  return p;
}

/** Destination d'écriture simulée (fichier temporaire de `createWritable()`). */
function sinkStream(opts: { failAfter?: number; error?: () => unknown } = {}) {
  const state = { written: 0, closed: false, aborted: false, chunks: [] as Uint8Array[] };
  const stream = new WritableStream<Uint8Array>({
    write(chunk) {
      if (opts.failAfter !== undefined && state.written + chunk.length > opts.failAfter) throw opts.error?.() ?? new TypeError('écriture impossible');
      state.written += chunk.length;
      state.chunks.push(chunk.slice());
    },
    close() {
      state.closed = true;
    },
    abort() {
      state.aborted = true;
    },
  });
  return { stream, state };
}

describe('interruption pendant l’enregistrement', () => {
  it('fichier de l’appareil : erreur d’écriture en cours de route → original intact, fichier temporaire abandonné, erreur claire', async () => {
    const project = await projectWithPhotos([1, 2, 3]);
    // Le fichier d'origine n'est remplacé qu'à la fermeture (close) du fichier temporaire de createWritable()
    let sink: ReturnType<typeof sinkStream> | null = null;
    const handle = {
      name: 'Maison.voltaplan',
      getFile: async () => ({ lastModified: 1, size: 8 }),
      createWritable: async () => {
        sink = sinkStream({ failAfter: 6000, error: quota });
        return sink.stream;
      },
    };
    vi.stubGlobal('window', { showSaveFilePicker: async () => handle });
    const { saveProject, resetHandle } = await import('../src/io/files');
    resetHandle();
    const e = await saveProject(project, 'Maison.voltaplan', true).catch((x) => x);
    // Disque plein pendant write() : erreur typée, message propre au disque (pas « navigateur plein »)
    expect(e).toBeInstanceOf(StorageFullError);
    expect((e as StorageFullError).where).toBe('device');
    expect(errorText(e, t)).toMatch(/Plus de place sur le disque/);
    // Jamais fermé : l'original n'est pas remplacé. Le flux est en erreur (write() a échoué) : le navigateur
    // abandonne le fichier temporaire ; abort() n'a plus rien à faire, il n'est pas bloqué (flux libéré).
    expect(sink!.state.closed).toBe(false);
    expect(sink!.state.written).toBeLessThanOrEqual(6000);
    expect(sink!.stream.locked).toBe(false);
  });

  it('fichier de l’appareil : document devenu illisible pendant l’écriture → abort() du fichier temporaire, jamais fermé', async () => {
    const project = await projectWithPhotos([12, 13]);
    const store = assetSession.store;
    const real = store.get.bind(store);
    let calls = 0;
    // 1er document lu normalement, 2e disparu (stockage effacé, fichier source déplacé…)
    const spy = vi.spyOn(store, 'get').mockImplementation(async (sha) => (++calls >= 2 ? undefined : real(sha)));
    const sink = sinkStream();
    vi.stubGlobal('window', { showSaveFilePicker: async () => ({ name: 'y.voltaplan', createWritable: async () => sink.stream }) });
    const { saveProject, resetHandle } = await import('../src/io/files');
    resetHandle();
    const e = await saveProject(project, 'y.voltaplan', true).catch((x) => x);
    spy.mockRestore();
    expect(e).toMatchObject({ name: 'AssetUnavailableError' });
    expect(errorText(e, t)).not.toBe(String(e));
    expect(sink.state).toMatchObject({ closed: false, aborted: true });
  });

  it('fichier de l’appareil : autre erreur (support retiré) → remontée telle quelle, rien n’est publié', async () => {
    const project = await projectWithPhotos([4]);
    const sink = sinkStream({ failAfter: 100 });
    vi.stubGlobal('window', { showSaveFilePicker: async () => ({ name: 'x.voltaplan', createWritable: async () => sink.stream }) });
    const { saveProject, resetHandle } = await import('../src/io/files');
    resetHandle();
    await expect(saveProject(project, 'x.voltaplan', true)).rejects.toThrow(/écriture impossible/);
    expect(sink.state.closed).toBe(false);
  });

  it('archive interrompue (AbortSignal) : jamais terminée, destination jamais fermée ; en mémoire : rien', async () => {
    const docs = await Promise.all([5, 6, 7].map(async (s) => ({ bytes: jpeg(s), sha: await sha256Hex(jpeg(s)) })));
    const ctrl = new AbortController();
    let reads = 0;
    const input: ArchiveWriteInput = {
      projectText: '{}',
      title: 'M',
      appVersion: '0',
      originals: docs.map((d) => ({
        sha256: d.sha,
        mime: 'image/jpeg',
        size: d.bytes.length,
        blob: async () => {
          if (++reads === 2) ctrl.abort();
          return new Blob([d.bytes], { type: 'image/jpeg' });
        },
      })),
    };
    const sink = sinkStream();
    await expect(writeArchive(input, sink.stream, ctrl.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(sink.state.closed).toBe(false);
    const ctrl2 = new AbortController();
    ctrl2.abort();
    await expect(writeArchive({ ...input, originals: input.originals.slice(0, 1) }, undefined, ctrl2.signal)).rejects.toMatchObject({ name: 'AbortError' });
    // Sans interruption : archive complète et relisible
    reads = -10;
    const full = sinkStream();
    await writeArchive(input, full.stream);
    expect(full.state.closed).toBe(true);
    const a = await readArchive(new Blob(full.state.chunks as BlobPart[]));
    expect(a.originals.size).toBe(3);
  });

  it('dossier cloud coupé après quelques documents : modèle non publié, attente mémorisée, reprise sans renvoi', async () => {
    const remote = new MemoryFolderBackend();
    const docs: FolderDoc[] = [];
    for (const s of [8, 9, 10]) docs.push({ sha256: await sha256Hex(jpeg(s)), mime: 'image/jpeg', size: 5000, blob: async () => new Blob([jpeg(s)], { type: 'image/jpeg' }) });
    let cut = true;
    remote.beforeWrite = (path) => {
      if (cut && path.startsWith('assets/') && remote.writes.length === 2) throw new TypeError('Failed to fetch');
    };
    const pending: string[] = [];
    const versions: string[] = [];
    const deps = {
      folderSave: async (loc: FolderLocation, p: Project, mode: string) => {
        const r = await saveToFolder(remote, JSON.stringify(p), docs, 'M', { modelPath: loc.modelPath, expected: mode === 'create' ? null : mode === 'update' ? loc.rev! : 'any' });
        return { rev: r.version, ...r };
      },
      addVersion: async (_k: string, _n: string, _p: Project, reason: string) => void versions.push(reason),
      setPending: (x: { reason: string }) => void pending.push('set:' + x.reason),
      clearPending: () => void pending.push('clear'),
      now: () => new Date(2026, 10, 24),
    } as unknown as SaveDeps;
    await remote.writeConditional('project.json', '{"ancien":1}', null);
    const loc: FolderLocation = { kind: 'folder', provider: 'onedrive', folder: 'M', modelPath: 'project.json', rev: '1' };
    const r1 = await saveAt(loc, emptyProject(), '', deps);
    expect(r1.status).toBe('pending');
    expect(pending).toEqual(['set:offline']);
    expect(versions).toEqual(['pending']);
    expect(await (await remote.readText('project.json'))!.text).toBe('{"ancien":1}');
    expect(remote.writes.filter((w) => w.startsWith('assets/'))).toHaveLength(1);
    cut = false;
    const before = remote.writes.length;
    const r2 = await saveAt(loc, emptyProject(), '', deps);
    expect(r2.status).toBe('saved');
    // Seuls les deux documents manquants sont envoyés, puis le modèle
    expect(remote.writes.slice(before).filter((w) => w !== 'README.txt')).toEqual([...docs.slice(1).map((d) => `assets/${d.sha256}.jpg`), 'project.json']);
    expect(pending[pending.length - 1]).toBe('clear');
  });
});

describe('répertoire local : écriture interrompue', () => {
  /** File System Access simulé fidèlement : `getFileHandle({ create: true })` crée aussitôt un fichier VIDE. */
  function fsaDir(failOn: () => boolean) {
    const files = new Map<string, File>();
    const dirs = new Map<string, ReturnType<typeof fsaDir>>();
    const notFound = () => Object.assign(new Error('absent'), { name: 'NotFoundError' });
    const dir = {
      kind: 'directory' as const,
      name: 'd',
      files,
      async getDirectoryHandle(n: string, o?: { create?: boolean }) {
        if (!dirs.has(n)) {
          if (!o?.create) throw notFound();
          dirs.set(n, fsaDir(failOn));
        }
        return dirs.get(n)!;
      },
      async getFileHandle(n: string, o?: { create?: boolean }) {
        if (!files.has(n)) {
          if (!o?.create) throw notFound();
          files.set(n, new File([], n));
        }
        return {
          kind: 'file' as const,
          name: n,
          getFile: async () => files.get(n)!,
          createWritable: async () => {
            const parts: BlobPart[] = [];
            return {
              write: async (d: Blob | string) => {
                if (failOn()) throw quota();
                parts.push(d);
              },
              close: async () => void files.set(n, new File(parts, n)),
              abort: async () => undefined,
            };
          },
        };
      },
      async *values() {
        for (const [n, f] of files) yield { kind: 'file' as const, name: n, getFile: async () => f };
      },
    };
    return dir;
  }

  it('document : fichier vide laissé par la coupure complété à l’enregistrement suivant (pas de blocage)', async () => {
    const { DirectoryBackend } = await import('../src/io/directoryBackend');
    let fail = true;
    const root = fsaDir(() => fail);
    const b = new DirectoryBackend(root as never);
    const bytes = jpeg(50);
    const doc: FolderDoc = { sha256: await sha256Hex(bytes), mime: 'image/jpeg', size: bytes.length, blob: async () => new Blob([bytes], { type: 'image/jpeg' }) };
    await expect(saveToFolder(b, '{"a":1}', [doc], 'M', { expected: null })).rejects.toSatisfy(isQuotaError);
    expect((await b.list('assets'))[0].size).toBe(0); // reste de la coupure
    expect(await b.readText('project.json')).toBeNull();
    fail = false;
    const r = await saveToFolder(b, '{"a":1}', [doc], 'M', { expected: null });
    expect(r.uploaded).toBe(1);
    expect(await sha256Hex(await b.readBlob(`assets/${doc.sha256}.jpg`))).toBe(doc.sha256);
    expect((await b.readText('project.json'))!.text).toBe('{"a":1}');
  });

  it('modèle : création interrompue (fichier vide) → l’essai suivant le crée ; un modèle non vide n’est jamais écrasé', async () => {
    const { DirectoryBackend } = await import('../src/io/directoryBackend');
    let fail = true;
    const b = new DirectoryBackend(fsaDir(() => fail) as never);
    await expect(b.writeConditional('project.json', '{"v":1}', null)).rejects.toSatisfy(isQuotaError);
    fail = false;
    const w = await b.writeConditional('project.json', '{"v":1}', null);
    expect(w.version).toBeTruthy();
    await expect(b.writeConditional('project.json', '{"v":2}', null)).rejects.toMatchObject({ name: 'ConflictError' });
  });
});

describe('stockage plein (appareil, navigateur)', () => {
  it('isQuotaError : Chrome/Safari, Firefox, code 22, erreur enveloppée ; pas les autres', () => {
    expect(isQuotaError(quota())).toBe(true);
    expect(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true);
    expect(isQuotaError({ code: 22 })).toBe(true);
    expect(isQuotaError(new Error('écriture', { cause: quota() }))).toBe(true);
    expect(isQuotaError(new Error('quota'))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
    expect(isQuotaError(new TypeError('réseau'))).toBe(false);
  });

  it('ajout d’une photo, stockage plein : images dérivées libérées d’abord, puis nouvel essai ; jamais un document', async () => {
    const backend = new MemoryAssetBackend();
    const store = new AssetStore(backend);
    const kept = await store.add(new Blob([jpeg(20)]));
    await store.putDerived(kept.sha256, 'display', new Blob([jpeg(21)]));
    let fail = 1;
    const put = backend.putAssetIfAbsent.bind(backend);
    backend.putAssetIfAbsent = async (r) => {
      if (fail-- > 0) throw quota();
      return put(r);
    };
    const m = await store.add(new Blob([jpeg(22)]));
    expect(await store.has(m.sha256)).toBe(true);
    expect(await store.has(kept.sha256)).toBe(true);
    expect((await store.usage()).derived).toBe(0);
    // Toujours plein (plus rien à libérer) : l'erreur remonte, message clair, rien n’est supprimé
    backend.putAssetIfAbsent = async () => {
      throw quota();
    };
    const e = await store.add(new Blob([jpeg(23)])).catch((x) => x);
    expect(isQuotaError(e)).toBe(true);
    expect(errorText(e, t)).toMatch(/Plus assez d’espace dans le navigateur/);
    expect(await store.has(kept.sha256)).toBe(true);
  });

  it('enregistrement : destination pleine → version gardée, erreur remontée, AUCUNE attente (pas de reprise en boucle)', async () => {
    const versions: string[] = [];
    const pending: string[] = [];
    const deps: SaveDeps = {
      browserSave: async () => 1,
      cloudSave: async () => {
        throw new StorageFullError('OneDrive', '507');
      },
      githubSave: async () => {
        throw new FileTooLargeError('GitHub', 150 * 1048576, 100 * 1048576);
      },
      githubToken: () => 'tok',
      githubSettings: () => ({ repo: 'me/d', branch: 'main', folder: 'v' }),
      deviceSave: async () => {
        throw new StorageFullError('device');
      },
      addVersion: async (_k, _n, _p, reason) => void versions.push(reason),
      setPending: (x) => void pending.push(x.reason),
      clearPending: (k) => void pending.push('clear:' + k),
      newId: () => 'id',
      now: () => new Date(2026, 10, 24),
    };
    const p = emptyProject();
    const cloud = { kind: 'cloud' as const, provider: 'onedrive' as const, file: { id: 'F', name: 'M.voltaplan', rev: 'e1' } };
    await expect(saveAt(cloud, p, '', deps)).rejects.toBeInstanceOf(StorageFullError);
    await expect(saveAt({ kind: 'github', repo: 'me/d', branch: 'main', path: 'v/M.voltaplan', sha: 's' }, p, '', deps)).rejects.toBeInstanceOf(FileTooLargeError);
    await expect(saveAt({ kind: 'device' }, p, 'M.voltaplan', deps)).rejects.toBeInstanceOf(StorageFullError);
    expect(versions).toEqual(['pending', 'pending', 'pending']);
    expect(pending).toEqual([]);
    expect(errorText(new StorageFullError('OneDrive'), t)).toMatch(/Espace OneDrive plein.*gardée dans ce navigateur/);
    expect(errorText(new FileTooLargeError('GitHub', 150 * 1048576, 100 * 1048576), t)).toBe(t('storage.tooLarge', { where: 'GitHub', size: 150, limit: 100 }));
    for (const lang of ['nl', 'en'] as const) for (const k of ['storage.full.device', 'storage.full.cloud', 'storage.tooLarge']) expect(translate(lang, k)).not.toBe(k);
  });
});

describe('espace du service épuisé (réponses simulées) [à vérifier avec de vrais comptes]', () => {
  function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
      calls.push(`${init.method ?? 'GET'} ${url}`);
      return handler(url, init);
    });
    return calls;
  }
  const file: CloudFile = { id: 'ID1', name: 'M.voltaplan', rev: 'r1' };

  it('reconnaissance : 507, quotaLimitReached, insufficient_space, storageQuotaExceeded ; pas les autres', () => {
    expect(cloudQuotaReached(507, '')).toBe(true);
    expect(cloudQuotaReached(409, '{"error_summary":"path/insufficient_space/.."}')).toBe(true);
    expect(cloudQuotaReached(403, '{"error":{"errors":[{"reason":"storageQuotaExceeded"}]}}')).toBe(true);
    expect(cloudQuotaReached(403, '{"error":{"errors":[{"reason":"rateLimitExceeded"}]}}')).toBe(false);
    expect(cloudQuotaReached(409, '{"error_summary":"path/conflict/file/"}')).toBe(false);
    expect(cloudQuotaReached(500, 'quotaLimitReached')).toBe(false);
  });

  it('OneDrive : 507 quotaLimitReached → StorageFullError', async () => {
    mockFetch(() => json({ error: { code: 'quotaLimitReached', message: 'Insufficient Space Available' } }, 507));
    const e = await PROVIDERS.onedrive.save('tok', 'M.voltaplan', new Blob(['x']), 'update', { ...file, rev: '"e1"' }).catch((x) => x);
    expect(e).toBeInstanceOf(StorageFullError);
    expect(e.where).toBe('OneDrive');
  });

  it('Dropbox : 409 path/insufficient_space → StorageFullError (un 409 conflict reste un conflit)', async () => {
    mockFetch(() => json({ error_summary: 'path/insufficient_space/...', error: { '.tag': 'path', reason: { '.tag': 'insufficient_space' } } }, 409));
    const e = await PROVIDERS.dropbox.save('tok', 'M.voltaplan', new Blob(['x']), 'update', file).catch((x) => x);
    expect(e).toBeInstanceOf(StorageFullError);
    expect(e.where).toBe('Dropbox');
  });

  it('Google Drive : 403 storageQuotaExceeded à la création → StorageFullError', async () => {
    mockFetch(() => json({ error: { code: 403, errors: [{ domain: 'usageLimits', reason: 'storageQuotaExceeded' }], message: 'The user’s Drive storage quota has been exceeded.' } }, 403));
    const e = await PROVIDERS.gdrive.save('tok', 'M.voltaplan', new Blob(['x']), 'create').catch((x) => x);
    expect(e).toBeInstanceOf(StorageFullError);
    expect(e.where).toBe('Google Drive');
  });

  it('GitHub : 422 « too large » ou 413 → FileTooLargeError ; 422 « sha » reste un conflit', async () => {
    const project = await projectWithPhotos([30]);
    const s = { repo: 'me/d', branch: 'main', folder: 'v' };
    mockFetch(() => json({ message: 'File is too large (max 100 MB)' }, 422));
    await expect(githubSave('tok', s, 'v/M.voltaplan', project, 'update', 'sha1')).rejects.toBeInstanceOf(FileTooLargeError);
    mockFetch(() => new Response('', { status: 413 }));
    await expect(githubSave('tok', s, 'v/M.voltaplan', project, 'update', 'sha1')).rejects.toBeInstanceOf(FileTooLargeError);
    mockFetch(() => json({ message: 'Invalid request. "sha" wasn’t supplied.' }, 422));
    await expect(githubSave('tok', s, 'v/M.voltaplan', project, 'create')).rejects.toMatchObject({ name: 'ConflictError' });
  });

  it('dossier OneDrive : espace épuisé au 2e document → rien de publié ; place libérée → reprise sans renvoi', async () => {
    const created = new Set<string>();
    let full = true;
    const fetchFn = (async (url: string, init: RequestInit = {}) => {
      const path = decodeURIComponent(url.split('approot:/')[1]?.split(':')[0] ?? '');
      if (url.includes('/children')) return json({ value: [...created].filter((p) => p.startsWith('M/assets/')).map((p) => ({ name: p.split('/').pop(), size: 5000, file: {} })) });
      if (init.method === 'PUT') {
        if (full && created.size >= 1) return json({ error: { code: 'quotaLimitReached' } }, 507);
        created.add(path);
        return json({ size: path.endsWith('.json') ? 2 : path.endsWith('.txt') ? 10 : 5000, eTag: '"e2"' }, 201);
      }
      return json({}, 404);
    }) as typeof fetch;
    const b = new OneDriveFolderBackend('tok', 'M', fetchFn);
    const docs: FolderDoc[] = [];
    for (const s of [31, 32, 33]) docs.push({ sha256: await sha256Hex(jpeg(s)), mime: 'image/jpeg', size: 5000, blob: async () => new Blob([jpeg(s)], { type: 'image/jpeg' }) });
    const e = await saveToFolder(b, '{}', docs, 'M', { expected: null }).catch((x) => x);
    expect(e).toBeInstanceOf(StorageFullError);
    expect(isDestinationFull(e)).toBe(true);
    expect([...created].some((p) => p.endsWith('project.json'))).toBe(false);
    full = false;
    const r = await saveToFolder(b, '{}', docs, 'M', { expected: null });
    expect(r).toMatchObject({ uploaded: 2, skipped: 1 });
    expect(created.has('M/project.json')).toBe(true);
  });
});
