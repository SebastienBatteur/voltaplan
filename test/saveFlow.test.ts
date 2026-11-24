/**
 * Enregistrement sans perte silencieuse : écritures conditionnelles chez chaque fournisseur (fetch simulé),
 * copie de conflit, mise en attente hors ligne, versions locales, brouillons par onglet.
 */
import { PROVIDERS, pinsToRelease, revisionsBetween, withToken, setCloudTokenForTest, cloudToken, type CloudFile } from '../src/io/cloud';
import { AuthError, ConflictError, conflictName, isConflict, isQuotaError } from '../src/io/conflict';
import { changedSince } from '../src/io/files';
import { saveAt, locationKey, type SaveDeps } from '../src/io/saveFlow';
import { AUTOSAVE_ID, draftIsLive, githubSave, isDraftId, listPending, retentionFor, TAB_ID, versionsToDelete } from '../src/io/storage';
import { emptyProject } from '../src/model/tree';

type Call = { url: string; init: RequestInit };
function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return handler(url, init);
  });
  return calls;
}
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });
const headers = (c: Call) => (c.init.headers ?? {}) as Record<string, string>;

afterEach(() => vi.unstubAllGlobals());

describe('OneDrive : If-Match sur l’eTag', () => {
  const file: CloudFile = { id: 'ID1', name: 'Maison.voltaplan', rev: '"etag-1"' };

  it('mise à jour conditionnelle, nouvelle version renvoyée', async () => {
    const calls = mockFetch(() => json({ id: 'ID1', name: 'Maison.voltaplan', size: 10, eTag: '"etag-2"' }));
    const r = await PROVIDERS.onedrive.save('tok', file.name, '{}', 'update', file);
    expect(calls[0].url).toBe('https://graph.microsoft.com/v1.0/me/drive/items/ID1/content');
    expect(headers(calls[0])['If-Match']).toBe('"etag-1"');
    expect(r.rev).toBe('"etag-2"');
  });

  it('412 (modifié ailleurs) : ConflictError', async () => {
    mockFetch(() => new Response('', { status: 412 }));
    await expect(PROVIDERS.onedrive.save('tok', file.name, '{}', 'update', file)).rejects.toBeInstanceOf(ConflictError);
  });

  it('création : jamais de remplacement (conflictBehavior=fail, 409 → conflit)', async () => {
    const calls = mockFetch(() => new Response('', { status: 409 }));
    await expect(PROVIDERS.onedrive.save('tok', file.name, '{}', 'create')).rejects.toBeInstanceOf(ConflictError);
    expect(calls[0].url).toContain('conflictBehavior=fail');
  });

  it('lecture : version lue avant le contenu', async () => {
    const calls = mockFetch((url) => (url.endsWith('/content') ? new Response('{"x":1}') : json({ eTag: '"e9"' })));
    const r = await PROVIDERS.onedrive.load('tok', file);
    expect(r).toEqual({ text: '{"x":1}', rev: '"e9"' });
    expect(calls[0].url.endsWith('/content')).toBe(false);
  });

  it('mise à jour sans version connue : refusée (pas d’écrasement à l’aveugle)', async () => {
    const calls = mockFetch(() => json({}));
    await expect(PROVIDERS.onedrive.save('tok', file.name, '{}', 'update', { ...file, rev: undefined })).rejects.toBeInstanceOf(ConflictError);
    expect(calls).toHaveLength(0);
  });
});

describe('Dropbox : mode update avec la révision', () => {
  const file: CloudFile = { id: '/maison.voltaplan', name: 'Maison.voltaplan', rev: 'r1' };

  it('envoie mode {update: rev} sans renommage automatique', async () => {
    const calls = mockFetch(() => json({ path_lower: '/maison.voltaplan', name: 'Maison.voltaplan', size: 2, rev: 'r2' }));
    const r = await PROVIDERS.dropbox.save('tok', file.name, '{}', 'update', file);
    const arg = JSON.parse(headers(calls[0])['Dropbox-API-Arg']);
    expect(arg.mode).toEqual({ '.tag': 'update', update: 'r1' });
    expect(arg.autorename).toBe(false);
    expect(r.rev).toBe('r2');
  });

  it('409 path/conflict : ConflictError ; autre 409 : erreur ordinaire', async () => {
    mockFetch(() => json({ error_summary: 'path/conflict/file/..' }, 409));
    await expect(PROVIDERS.dropbox.save('tok', file.name, '{}', 'update', file)).rejects.toBeInstanceOf(ConflictError);
    mockFetch(() => json({ error_summary: 'path/insufficient_space/..' }, 409));
    const e = await PROVIDERS.dropbox.save('tok', file.name, '{}', 'update', file).catch((x) => x);
    expect(isConflict(e)).toBe(false);
  });

  it('création : mode add', async () => {
    const calls = mockFetch(() => json({ path_lower: '/a', name: 'a', size: 1, rev: 'r' }));
    await PROVIDERS.dropbox.save('tok', 'a', '{}', 'create');
    expect(JSON.parse(headers(calls[0])['Dropbox-API-Arg']).mode).toBe('add');
  });
});

describe('Google Drive : contrôle avant et après l’envoi', () => {
  const file: CloudFile = { id: 'F1', name: 'Maison.voltaplan', rev: '7|r7' };

  it('version changée : conflit, aucun envoi', async () => {
    const calls = mockFetch(() => json({ version: '9', headRevisionId: 'r9' }));
    await expect(PROVIDERS.gdrive.save('tok', file.name, '{}', 'update', file)).rejects.toBeInstanceOf(ConflictError);
    expect(calls.some((c) => c.init.method === 'PATCH')).toBe(false);
  });

  it('personne d’autre pendant l’envoi : nouvelle version, pas de copie', async () => {
    const calls = mockFetch((url, init) =>
      init.method === 'PATCH'
        ? json({ id: 'F1', name: file.name, version: '8', headRevisionId: 'r8' })
        : url.includes('/revisions')
          ? json({ revisions: [{ id: 'r6' }, { id: 'r7' }, { id: 'r8' }] })
          : json({ version: '7', headRevisionId: 'r7' }),
    );
    const r = await PROVIDERS.gdrive.save('tok', file.name, '{}', 'update', file);
    const uploads = calls.filter((c) => c.init.method === 'PATCH' && c.url.includes('/upload/'));
    expect(uploads).toHaveLength(1);
    expect(uploads[0].url).toContain('keepRevisionForever=true');
    // La révision remplacée (r7) est marquée « à conserver » AVANT l'envoi
    const pin = calls.findIndex((c) => c.init.method === 'PATCH' && c.url.includes('/revisions/r7'));
    expect(pin).toBeGreaterThanOrEqual(0);
    expect(JSON.parse(String(calls[pin].init.body))).toEqual({ keepForever: true });
    expect(pin).toBeLessThan(calls.indexOf(uploads[0]));
    expect(r.rev).toBe('8|r8');
    expect(r.concurrentCopy).toBeUndefined();
  });

  it('marquage impossible même après libération : rien n’est envoyé', async () => {
    const calls = mockFetch((url, init) => {
      if (init.method === 'PATCH' && url.includes('/revisions/')) return new Response('quota', { status: 403 });
      if (url.includes('/revisions')) return json({ revisions: [] });
      return json({ version: '7', headRevisionId: 'r7' });
    });
    await expect(PROVIDERS.gdrive.save('tok', file.name, '{}', 'update', file)).rejects.toThrow();
    expect(calls.some((c) => c.url.includes('/upload/'))).toBe(false);
  });

  it('révisions conservées : on libère les plus anciennes au-delà du seuil, jamais les 20 dernières', () => {
    const revs = Array.from({ length: 200 }, (_, i) => ({ id: 'r' + i, keepForever: true }));
    const rel = pinsToRelease(revs, 150, 100);
    expect(rel).toHaveLength(100);
    expect(rel[0]).toBe('r0');
    expect(rel).not.toContain('r199');
    expect(pinsToRelease(revs.slice(0, 120), 150, 100)).toEqual([]);
  });

  it('enregistrement d’un autre appareil pendant notre envoi : sa version est recopiée (les deux sont gardées)', async () => {
    const calls = mockFetch((url, init) => {
      if (init.method === 'PATCH') return json({ id: 'F1', name: file.name, version: '9', headRevisionId: 'r9' });
      if (init.method === 'POST') return json({ id: 'F2', name: 'copie', version: '1', headRevisionId: 'c1' });
      if (url.includes('/revisions/rX')) return new Response('{"autre":true}');
      if (url.includes('/revisions')) return json({ revisions: [{ id: 'r7' }, { id: 'rX' }, { id: 'r9' }] });
      return json({ version: '7', headRevisionId: 'r7' });
    });
    const r = await PROVIDERS.gdrive.save('tok', file.name, '{}', 'update', file);
    expect(r.concurrentCopy).toMatch(/^Maison \(conflit .*\)\.voltaplan$/);
    const post = calls.find((c) => c.init.method === 'POST')!;
    expect(String(post.init.body)).toContain('{"autre":true}');
  });

  it('révisions entre deux bornes', () => {
    expect(revisionsBetween(['a', 'b', 'c', 'd'], 'a', 'd')).toEqual(['b', 'c']);
    expect(revisionsBetween(['a', 'b'], 'a', 'b')).toEqual([]);
    expect(revisionsBetween(['b', 'c'], 'a', 'c')).toEqual([]); // borne purgée par Drive : on ne conclut rien
  });
});

describe('jetons expirés', () => {
  it('401 : jeton oublié, reconnexion une fois, puis réussite', async () => {
    setCloudTokenForTest('dropbox', 'vieux');
    const seen: string[] = [];
    const r = await withToken(
      'dropbox',
      async (t) => {
        seen.push(t);
        if (t === 'vieux') throw new AuthError('service');
        return 'ok';
      },
      async () => 'neuf',
    );
    expect(r).toBe('ok');
    expect(seen).toEqual(['vieux', 'neuf']);
  });

  it('fenêtre de connexion bloquée (pas de clic) : AuthError nommant le service, jeton oublié', async () => {
    setCloudTokenForTest('onedrive', 'vieux');
    const e = await withToken(
      'onedrive',
      async () => {
        throw new AuthError('service');
      },
      async () => {
        throw new Error('popup');
      },
    ).catch((x) => x);
    expect(e).toBeInstanceOf(AuthError);
    expect((e as AuthError).where).toBe('OneDrive');
    expect(cloudToken('onedrive')).toBeNull();
  });

  it('OneDrive et GitHub : 401 traduit en AuthError', async () => {
    mockFetch(() => new Response('', { status: 401 }));
    await expect(PROVIDERS.onedrive.list('tok')).rejects.toBeInstanceOf(AuthError);
    mockFetch(() => new Response('{"message":"Bad credentials"}', { status: 401 }));
    await expect(githubSave('tok', { repo: 'a/b', branch: 'main', folder: 'v' }, 'v/x', emptyProject(), 'overwrite')).rejects.toBeInstanceOf(AuthError);
  });
});

describe('stockage du navigateur', () => {
  it('rétention adaptée à l’espace utilisé', () => {
    expect(retentionFor(null, null)).toEqual({ perKey: 20, total: 300 });
    expect(retentionFor(10, 100)).toEqual({ perKey: 20, total: 300 });
    expect(retentionFor(60, 100)).toEqual({ perKey: 10, total: 150 });
    expect(retentionFor(90, 100)).toEqual({ perKey: 3, total: 50 });
  });

  it('stockage plein reconnu (Chrome, Firefox, ancien code 22)', () => {
    expect(isQuotaError({ name: 'QuotaExceededError' })).toBe(true);
    expect(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true);
    expect(isQuotaError({ code: 22 })).toBe(true);
    expect(isQuotaError(new Error('x'))).toBe(false);
  });

  it('envois en attente : lecture tolérante', () => {
    expect(listPending(() => null)).toEqual([]);
    expect(listPending(() => '{oups')).toEqual([]);
    expect(listPending(() => JSON.stringify([{ key: 'k' }]))).toHaveLength(1);
  });
});

describe('GitHub : SHA mémorisé à l’ouverture', () => {
  const gh = { repo: 'me/d', branch: 'main', folder: 'v' };

  it('update : envoie le SHA mémorisé (pas celui relu), 409 → conflit', async () => {
    const calls = mockFetch(() => json({ message: 'is at abc but expected old' }, 409));
    await expect(githubSave('tok', gh, 'v/M.voltaplan', emptyProject(), 'update', 'old')).rejects.toBeInstanceOf(ConflictError);
    expect(calls).toHaveLength(1);
    expect(JSON.parse(String(calls[0].init.body)).sha).toBe('old');
  });

  it('create sur un nom pris (422 « sha ») : conflit', async () => {
    mockFetch(() => json({ message: '"sha" wasn\'t supplied.' }, 422));
    await expect(githubSave('tok', gh, 'v/M.voltaplan', emptyProject(), 'create')).rejects.toBeInstanceOf(ConflictError);
  });

  it('renvoie le nouveau SHA', async () => {
    mockFetch(() => json({ content: { sha: 'new' } }));
    expect(await githubSave('tok', gh, 'v/M.voltaplan', emptyProject(), 'update', 'old')).toBe('new');
  });
});

describe('saveAt : orchestration', () => {
  function deps(over: Partial<SaveDeps> = {}) {
    const versions: { key: string; reason: string }[] = [];
    const pending: string[] = [];
    const d: SaveDeps = {
      browserSave: async () => 1,
      cloudSave: async (_p, name) => ({ id: 'new-' + name, name, rev: 'r1' }),
      githubSave: async () => 'sha2',
      githubToken: () => 'tok',
      githubSettings: () => ({ repo: 'me/d', branch: 'main', folder: 'v' }),
      deviceSave: async (_p, n) => n || 'projet.voltaplan',
      addVersion: async (key, _n, _p, reason) => void versions.push({ key, reason }),
      setPending: (x) => void pending.push(`set:${x.reason}:${x.key}`),
      clearPending: (k) => void pending.push(`clear:${k}`),
      newId: () => 'id2',
      now: () => new Date(2026, 10, 24, 14, 2),
      ...over,
    };
    return { d, versions, pending };
  }
  const p = emptyProject();
  const cloudLoc = { kind: 'cloud' as const, provider: 'onedrive' as const, file: { id: 'ID1', name: 'Maison.voltaplan', rev: 'e1' } };

  it('succès : nouvelle version mémorisée et version locale gardée', async () => {
    const { d, versions } = deps({ cloudSave: async () => ({ id: 'ID1', name: 'Maison.voltaplan', rev: 'e2' }) });
    const r = await saveAt(cloudLoc, p, 'Maison.voltaplan', d);
    expect(r.status).toBe('saved');
    expect(r.status === 'saved' && r.loc.kind === 'cloud' && r.loc.file.rev).toBe('e2');
    expect(versions).toEqual([{ key: 'cloud:onedrive:ID1', reason: 'save' }]);
  });

  it('conflit : copie au même endroit, en création, sous un nom daté ; les deux versions restent', async () => {
    const modes: string[] = [];
    const { d, versions } = deps({
      cloudSave: async (_p, name, _pr, mode) => {
        modes.push(mode);
        if (mode === 'update') throw new ConflictError('OneDrive');
        return { id: 'ID2', name, rev: 'c1' };
      },
    });
    const r = await saveAt(cloudLoc, p, 'Maison.voltaplan', d);
    expect(modes).toEqual(['update', 'create']);
    expect(r.status).toBe('conflictCopy');
    if (r.status !== 'conflictCopy') return;
    expect(r.copyName).toBe('Maison (conflit 2026-11-24 14h02).voltaplan');
    expect(r.loc.kind === 'cloud' && r.loc.file.id).toBe('ID2');
    expect(versions[0].reason).toBe('conflict');
  });

  it('conflit GitHub : copie dans le même dossier', async () => {
    const paths: string[] = [];
    const { d } = deps({
      githubSave: async (_t, _s, path, _p, mode) => {
        paths.push(`${mode}:${path}`);
        if (mode === 'update') throw new ConflictError('GitHub');
        return 'sha-copy';
      },
    });
    const r = await saveAt({ kind: 'github', repo: 'me/d', branch: 'main', path: 'v/M.voltaplan', sha: 's1' }, p, '', d);
    expect(paths).toEqual(['update:v/M.voltaplan', 'create:v/M (conflit 2026-11-24 14h02).voltaplan']);
    expect(r.status === 'conflictCopy' && r.loc.kind === 'github' && r.loc.sha).toBe('sha-copy');
  });

  it('pas de réseau : en attente, version locale gardée, reprise mémorisée (survit à la fermeture)', async () => {
    const { d, versions, pending } = deps({
      cloudSave: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const r = await saveAt(cloudLoc, p, '', d);
    expect(r.status).toBe('pending');
    expect(versions[0].reason).toBe('pending');
    expect(pending).toEqual(['set:offline:cloud:onedrive:ID1']);
  });

  it('jeton expiré : reconnexion demandée, version gardée, reprise mémorisée', async () => {
    const { d, versions, pending } = deps({
      cloudSave: async () => {
        throw new AuthError('OneDrive');
      },
    });
    expect((await saveAt(cloudLoc, p, '', d)).status).toBe('needsAuth');
    expect(versions[0].reason).toBe('pending');
    expect(pending).toEqual(['set:auth:cloud:onedrive:ID1']);
  });

  it('succès : reprise effacée ; copie faite par Drive pendant l’envoi signalée, hors de l’emplacement', async () => {
    const { d, pending } = deps({ cloudSave: async () => ({ id: 'ID1', name: 'Maison.voltaplan', rev: 'e2', concurrentCopy: 'Maison (conflit).voltaplan' }) });
    const r = await saveAt(cloudLoc, p, '', d);
    expect(pending).toEqual(['clear:cloud:onedrive:ID1']);
    expect(r.status === 'saved' && r.concurrentCopy).toBe('Maison (conflit).voltaplan');
    expect(r.status === 'saved' && r.loc.kind === 'cloud' && 'concurrentCopy' in r.loc.file).toBe(false);
  });

  it('fichier de l’appareil modifié ailleurs : décision de l’utilisateur', async () => {
    const { d } = deps({
      deviceSave: async () => {
        throw new ConflictError('M.voltaplan');
      },
    });
    expect((await saveAt({ kind: 'device' }, p, 'M.voltaplan', d)).status).toBe('deviceConflict');
  });

  it('GitHub verrouillé : demande de connexion ; boîte annulée : rien', async () => {
    const gh = deps({ githubToken: () => null });
    expect((await saveAt({ kind: 'github', repo: 'r', branch: 'b', path: 'p' }, p, '', gh.d)).status).toBe('needsAuth');
    expect(gh.pending).toEqual(['set:auth:github:r@b:p']);
    expect((await saveAt({ kind: 'device' }, p, '', deps({ deviceSave: async () => null }).d)).status).toBe('cancelled');
  });

  it('autre erreur : remontée telle quelle', async () => {
    const { d } = deps({
      browserSave: async () => {
        throw new Error('quota');
      },
    });
    await expect(saveAt({ kind: 'browser', id: 'x', rev: 1 }, p, '', d)).rejects.toThrow('quota');
  });

  it('clés d’emplacement stables', () => {
    expect(locationKey({ kind: 'browser', id: 'a' }, '')).toBe('browser:a');
    expect(locationKey({ kind: 'device' }, 'M.voltaplan')).toBe('device:M.voltaplan');
  });
});

describe('outils', () => {
  it('nom de copie de conflit : extension gardée, pas d’empilement', () => {
    const d = new Date(2026, 0, 5, 9, 7);
    expect(conflictName('Maison.voltaplan', d)).toBe('Maison (conflit 2026-01-05 09h07).voltaplan');
    expect(conflictName('Maison (conflit 2025-12-01 10h00).voltaplan', d)).toBe('Maison (conflit 2026-01-05 09h07).voltaplan');
    expect(conflictName('sans extension', d)).toBe('sans extension (conflit 2026-01-05 09h07)');
  });

  it('versions locales : 20 par projet, plafond global', () => {
    const list = Array.from({ length: 25 }, (_, i) => ({ vid: 'a' + i, key: 'A', at: `2026-01-01T00:00:${String(i).padStart(2, '0')}Z` }));
    const del = versionsToDelete(list);
    expect(del).toHaveLength(5);
    expect(del).toContain('a0'); // les plus anciennes partent
    expect(del).not.toContain('a24');
    expect(versionsToDelete([...list, { vid: 'b', key: 'B', at: '2026-01-02T00:00:00Z' }], 20, 3)).toHaveLength(23);
  });

  it('brouillons : celui d’un onglet vivant n’est pas proposé, celui d’un onglet fermé oui', () => {
    const now = 1_000_000;
    const read = (k: string) => (k.endsWith('.alive') ? String(now - 5_000) : k.endsWith('.old') ? String(now - 120_000) : null);
    expect(draftIsLive(`${AUTOSAVE_ID}:alive`, now, read)).toBe(true);
    expect(draftIsLive(`${AUTOSAVE_ID}:old`, now, read)).toBe(false);
    expect(draftIsLive(`${AUTOSAVE_ID}:gone`, now, read)).toBe(false);
    expect(draftIsLive(`${AUTOSAVE_ID}:${TAB_ID}`, now, () => String(now))).toBe(false);
    expect(isDraftId(AUTOSAVE_ID) && isDraftId(`${AUTOSAVE_ID}:x`) && !isDraftId('projet')).toBe(true);
  });

  it('fichier local modifié ailleurs : date ou taille différente', () => {
    expect(changedSince({ mtime: 1, size: 2 }, { mtime: 1, size: 2 })).toBe(false);
    expect(changedSince({ mtime: 1, size: 2 }, { mtime: 3, size: 2 })).toBe(true);
    expect(changedSince({ mtime: 1, size: 2 }, { mtime: 1, size: 5 })).toBe(true);
    expect(changedSince(null, { mtime: 1, size: 2 })).toBe(false);
  });
});
