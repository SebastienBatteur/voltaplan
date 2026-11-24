// @vitest-environment node
/**
 * Format v2 en dossier (F8) : un seul modèle logique pour l'archive et le dossier, documents envoyés une fois et
 * vérifiés AVANT le modèle, modèle conditionnel (seul fichier modifiable), reprise après interruption, aucune
 * suppression ; OneDrive (Microsoft Graph simulé) ; politique de révisions Google Drive selon la taille.
 */
import { describe, expect, it } from 'vitest';
import { writeArchive } from '../src/format/archive';
import { openFromFolder, RemoteAssetMismatchError, saveToFolder, transferToFolder, type FolderDoc } from '../src/format/folder';
import { MemoryFolderBackend } from '../src/format/storageBackend';
import { sha256Hex } from '../src/format/sha256';
import { importArchiveToFolder, transferFolder } from '../src/io/cloudFolder';
import { AuthError, ConflictError } from '../src/io/conflict';
import { OneDriveFolderBackend, safeFolderName, SIMPLE_UPLOAD_MAX, UPLOAD_CHUNK } from '../src/io/oneDriveFolder';
import { DRIVE_PINS_MIN_BUDGET, drivePinsBudget, pinsToReleaseBySize } from '../src/io/cloud';
import { saveAt, type SaveDeps } from '../src/io/saveFlow';
import type { FolderLocation } from '../src/io/storage';
import { emptyProject } from '../src/model/tree';
import type { Project } from '../src/model/types';

const jpeg = (seed: number, n = 1000) => {
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) b[i] = (i * seed + 1) & 0xff;
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  return b;
};

async function docsAndModel(seeds: number[]) {
  const p = emptyProject();
  const docs: FolderDoc[] = [];
  const boards: Record<string, unknown> = {};
  for (const s of seeds) {
    const bytes = jpeg(s);
    const sha = await sha256Hex(bytes);
    docs.push({ sha256: sha, mime: 'image/jpeg', size: bytes.length, blob: async () => new Blob([bytes], { type: 'image/jpeg' }) });
    boards['b' + s] = { slots: {}, photo: { href: 'asset:' + sha, x: 0, y: 0, w: 1, h: 1 } };
  }
  p.boards = boards as Project['boards'];
  return { text: JSON.stringify(p), docs, project: p };
}

describe('dossier de projet : logique commune', () => {
  it('documents d’abord, modèle en dernier ; envoyés une seule fois', async () => {
    const b = new MemoryFolderBackend();
    const { text, docs } = await docsAndModel([1, 2]);
    const r = await saveToFolder(b, text, docs, 'Maison', { expected: null });
    expect(r).toMatchObject({ uploaded: 2, skipped: 0 });
    expect(b.writes[b.writes.length - 1]).toBe('project.json');
    expect(b.writes.filter((w) => w.startsWith('assets/'))).toHaveLength(2);
    // Changement du modèle (ou de son format) : aucun document renvoyé
    const again = await saveToFolder(b, text.replace('Nouveau', 'Autre'), docs, 'Maison', { expected: r.version! });
    expect(again).toMatchObject({ uploaded: 0, skipped: 2 });
  });

  it('coupure pendant l’envoi : modèle non publié ; reprise sans renvoyer ce qui est déjà là', async () => {
    const b = new MemoryFolderBackend();
    const { text, docs } = await docsAndModel([1, 2, 3]);
    let n = 0;
    b.beforeWrite = (path) => {
      if (path.startsWith('assets/') && ++n === 2) throw new TypeError('réseau coupé');
    };
    await expect(saveToFolder(b, text, docs, 'M', { expected: null })).rejects.toBeInstanceOf(TypeError);
    expect(b.files.has('project.json')).toBe(false);
    b.beforeWrite = undefined;
    const r = await saveToFolder(b, text, docs, 'M', { expected: null });
    expect(r).toMatchObject({ uploaded: 2, skipped: 1 });
    expect(b.files.has('project.json')).toBe(true);
  });

  it('document distant différent : rien n’est publié, rien n’est remplacé', async () => {
    const b = new MemoryFolderBackend();
    const { text, docs } = await docsAndModel([4]);
    const path = `assets/${docs[0].sha256}.jpg`;
    b.files.set(path, { data: new Blob(['autre contenu']), version: 99 });
    await expect(saveToFolder(b, text, docs, 'M', { expected: null })).rejects.toBeInstanceOf(RemoteAssetMismatchError);
    expect(b.files.has('project.json')).toBe(false);
    expect(await b.files.get(path)!.data.text()).toBe('autre contenu');
  });

  it('modèle modifié ailleurs : conflit, rien n’est écrasé', async () => {
    const b = new MemoryFolderBackend();
    const { text, docs } = await docsAndModel([5]);
    const v1 = (await saveToFolder(b, text, docs, 'M', { expected: null })).version!;
    await b.writeConditional('project.json', '{"autre":1}', v1); // autre appareil
    await expect(saveToFolder(b, text, docs, 'M', { expected: v1 })).rejects.toBeInstanceOf(ConflictError);
    expect((await b.readText('project.json'))!.text).toBe('{"autre":1}');
    await expect(saveToFolder(b, text, docs, 'M', { expected: null })).rejects.toBeInstanceOf(ConflictError);
  });

  it('vérification par relecture (option) et ouverture : document altéré isolé', async () => {
    const b = new MemoryFolderBackend();
    const { text, docs } = await docsAndModel([6, 7]);
    await saveToFolder(b, text, docs, 'M', { expected: null, verify: 'download' });
    // Altération d'un document distant (même taille)
    const path = `assets/${docs[1].sha256}.jpg`;
    const bad = jpeg(7);
    bad[500] ^= 1;
    b.files.set(path, { data: new Blob([bad]), version: 50 });
    const o = await openFromFolder(b);
    expect(o.missing).toEqual([]);
    expect((await o.sources.get(docs[0].sha256)!.open()).size).toBe(1000);
    await expect(o.sources.get(docs[1].sha256)!.open()).rejects.toMatchObject({ reason: 'shaMismatch' });
  });

  it('document référencé absent du dossier : signalé', async () => {
    const b = new MemoryFolderBackend();
    const { text } = await docsAndModel([8]);
    await b.writeConditional('project.json', text, null);
    expect((await openFromFolder(b)).missing).toHaveLength(1);
  });

  it('archive → dossier, puis dossier → autre service : mêmes documents, rien supprimé à la source', async () => {
    const { project, docs } = await docsAndModel([9, 10]);
    const { blob } = await writeArchive({ projectText: JSON.stringify(project), title: 'M', appVersion: '0', originals: docs });
    const a = new MemoryFolderBackend('A');
    expect(await importArchiveToFolder(blob!, a, 'M')).toMatchObject({ uploaded: 2 });
    const b = new MemoryFolderBackend('B');
    expect(await transferFolder(a, b, 'M')).toMatchObject({ uploaded: 2 });
    expect([...b.files.keys()].sort()).toEqual([...a.files.keys()].sort());
    expect(a.files.size).toBe(4); // 2 documents, README, modèle : la source est intacte
    const opened = await openFromFolder(b);
    expect(opened.sources.size).toBe(2);
    // Un projet existe déjà à la destination : jamais remplacé sans confirmation
    await expect(transferToFolder(opened.projectText, opened.sources, b, 'M')).rejects.toBeInstanceOf(ConflictError);
  });

  it('l’interface de stockage ne permet aucune suppression', () => {
    const b = new MemoryFolderBackend();
    expect('delete' in b || 'remove' in b).toBe(false);
  });
});

describe('enregistrement en dossier : copie de conflit dans le même dossier', () => {
  it('modèle modifié ailleurs : copie « project (conflit …).json », documents partagés', async () => {
    const calls: { loc: FolderLocation; mode: string }[] = [];
    const deps = {
      folderSave: async (loc: FolderLocation, _p: Project, mode: string) => {
        calls.push({ loc, mode });
        if (mode === 'update') throw new ConflictError('OneDrive', '412');
        return { rev: 'e9' };
      },
      addVersion: async () => undefined,
      setPending: () => undefined,
      clearPending: () => undefined,
      now: () => new Date(2026, 10, 24, 14, 2),
    } as unknown as SaveDeps;
    const loc: FolderLocation = { kind: 'folder', provider: 'onedrive', folder: 'Maison', modelPath: 'project.json', rev: 'e1' };
    const r = await saveAt(loc, emptyProject(), '', deps);
    expect(r.status).toBe('conflictCopy');
    expect(calls[1]).toMatchObject({ mode: 'create', loc: { folder: 'Maison', modelPath: 'project (conflit 2026-11-24 14h02).json' } });
  });
});

describe('OneDrive (Graph simulé)', () => {
  type Call = { url: string; init: RequestInit };
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } });
  function fake(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
    const calls: Call[] = [];
    const f = (async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      return handler(url, init);
    }) as unknown as typeof fetch;
    return { calls, f };
  }
  const hdr = (c: Call) => new Headers(c.init.headers);

  it('petit document : création « fail » ; déjà présent : jamais remplacé', async () => {
    const { calls, f } = fake((_url, init) => (init.method === 'PUT' ? json({ error: 'nameAlreadyExists' }, 409) : json({ size: 3 })));
    const b = new OneDriveFolderBackend('tok', 'Maison', f);
    expect(await b.putIfAbsent('assets/x.jpg', new Blob(['abc']))).toEqual({ status: 'exists', size: 3 });
    expect(calls[0].url).toContain('/special/approot:/Maison/assets/x.jpg:/content?@microsoft.graph.conflictBehavior=fail');
    expect(hdr(calls[0]).get('Authorization')).toBe('Bearer tok');
  });

  it('gros document : session d’envoi par tranches, reprise après coupure', async () => {
    const size = SIMPLE_UPLOAD_MAX + UPLOAD_CHUNK + 10;
    let cut = true;
    let received = 0;
    const { calls, f } = fake((url, init) => {
      if (url.endsWith('/createUploadSession')) return json({ uploadUrl: 'https://upload.example/s1' });
      if (url === 'https://upload.example/s1' && !init.method) return json({ nextExpectedRanges: [`${received}-`] });
      if (url === 'https://upload.example/s1') {
        const range = hdr({ url, init }).get('Content-Range')!;
        const [a, b] = range.replace('bytes ', '').split('/')[0].split('-').map(Number);
        if (a > 0 && cut) {
          cut = false;
          throw new TypeError('réseau coupé');
        }
        received = b + 1;
        return received >= size ? json({ size }, 201) : json({ nextExpectedRanges: [`${received}-`] }, 202);
      }
      return json({}, 500);
    });
    const b = new OneDriveFolderBackend('tok', 'Maison', f);
    const r = await b.putIfAbsent('assets/big.pdf', new Blob([new Uint8Array(size)]));
    expect(r).toEqual({ status: 'created', size });
    const session = calls.find((c) => c.url.endsWith('/createUploadSession'))!;
    expect(JSON.parse(String(session.init.body))).toEqual({ item: { '@microsoft.graph.conflictBehavior': 'fail' } });
    const chunks = calls.filter((c) => c.url === 'https://upload.example/s1' && c.init.method === 'PUT');
    expect(chunks.every((c) => !hdr(c).has('Authorization'))).toBe(true);
    expect(calls.some((c) => c.url === 'https://upload.example/s1' && !c.init.method)).toBe(true); // reprise demandée
  });

  it('modèle : If-Match (412 → conflit), création « fail » (409 → conflit), 401 → reconnexion', async () => {
    let status = 412;
    const { calls, f } = fake(() => (status === 200 ? json({ eTag: '"e2"' }) : json({}, status)));
    const b = new OneDriveFolderBackend('tok', 'Maison', f);
    await expect(b.writeConditional('project.json', '{}', '"e1"')).rejects.toBeInstanceOf(ConflictError);
    expect(hdr(calls[0]).get('If-Match')).toBe('"e1"');
    status = 409;
    await expect(b.writeConditional('project.json', '{}', null)).rejects.toBeInstanceOf(ConflictError);
    expect(calls[1].url).toContain('conflictBehavior=fail');
    status = 200;
    expect(await b.writeConditional('project.json', '{}', '"e1"')).toEqual({ version: '"e2"' });
    status = 401;
    await expect(b.readText('project.json')).rejects.toBeInstanceOf(AuthError);
  });

  it('liste paginée des documents ; dossier absent = vide', async () => {
    const { f } = fake((url) =>
      url.includes('page2')
        ? json({ value: [{ name: 'b.jpg', size: 2, file: {} }] })
        : url.includes('/children')
          ? json({ value: [{ name: 'a.jpg', size: 1, file: {} }, { name: 'sous-dossier', size: 0 }], '@odata.nextLink': 'https://graph.example/page2' })
          : json({}, 404),
    );
    const b = new OneDriveFolderBackend('tok', 'Maison', f);
    expect(await b.list('assets')).toEqual([
      { name: 'a.jpg', size: 1 },
      { name: 'b.jpg', size: 2 },
    ]);
    const { f: f404 } = fake(() => json({}, 404));
    expect(await new OneDriveFolderBackend('tok', 'X', f404).list('assets')).toEqual([]);
  });

  it('nom de dossier sûr', () => {
    expect(safeFolderName('Maison / Dupont : 2*')).toBe('Maison _ Dupont _ 2_');
    expect(safeFolderName('..')).toBe('projet');
  });
});

describe('Google Drive : révisions conservées selon le nombre ET la taille', () => {
  const MB = 1024 * 1024;
  const revs = (n: number, size: number) => Array.from({ length: n }, (_, i) => ({ id: 'r' + i, keepForever: true, size: String(size), modifiedTime: `2026-01-01T00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}Z` }));

  it('budget : max(10 × taille du fichier, 200 Mo)', () => {
    expect(drivePinsBudget(1 * MB)).toBe(DRIVE_PINS_MIN_BUDGET);
    expect(drivePinsBudget(50 * MB)).toBe(500 * MB);
  });

  it('fichiers v1 lourds : on libère les plus anciennes jusqu’au budget', () => {
    const list = revs(40, 50 * MB); // 2 Go conservés, budget 500 Mo ; les 20 dernières restent quoi qu'il arrive
    const rel = pinsToReleaseBySize(list, { fileSize: 50 * MB });
    expect(rel).toHaveLength(20);
    // 30 × 10 Mo = 300 Mo pour un budget de 200 Mo : les 10 plus anciennes sont libérées
    expect(pinsToReleaseBySize(revs(30, 10 * MB), { fileSize: 10 * MB })).toHaveLength(10);
    expect(rel[0]).toBe('r0');
    expect(rel).not.toContain('r39');
  });

  it('jamais les 20 dernières, ni une révision désignée par un conflit ouvert', () => {
    const list = revs(30, 100 * MB);
    const rel = pinsToReleaseBySize(list, { fileSize: 1 * MB, protect: new Set(['r0', 'r3']) });
    expect(rel).toEqual(['r1', 'r2', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9']);
  });

  it('nombre : au plus 100 même si elles sont petites', () => {
    const rel = pinsToReleaseBySize(revs(130, 1000), { fileSize: 1000 });
    expect(rel).toHaveLength(30);
  });

  it('ordre chronologique d’après modifiedTime', () => {
    const list = revs(25, 300 * MB).reverse();
    expect(pinsToReleaseBySize(list, { fileSize: 1 })[0]).toBe('r0');
  });
});

describe('répertoire local (File System Access simulé)', () => {
  const notFound = () => Object.assign(new Error('absent'), { name: 'NotFoundError' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function memDir(name = 'racine'): any {
    const files = new Map<string, File>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dirs = new Map<string, any>();
    let tick = 1;
    return {
      kind: 'directory',
      name,
      async getDirectoryHandle(n: string, o?: { create?: boolean }) {
        if (!dirs.has(n)) {
          if (!o?.create) throw notFound();
          dirs.set(n, memDir(n));
        }
        return dirs.get(n);
      },
      async getFileHandle(n: string, o?: { create?: boolean }) {
        if (!files.has(n) && !o?.create) throw notFound();
        return {
          kind: 'file',
          name: n,
          getFile: async () => files.get(n) ?? new File([], n),
          createWritable: async () => {
            const parts: BlobPart[] = [];
            return {
              write: async (d: BlobPart) => void parts.push(d),
              close: async () => void files.set(n, new File(parts, n, { lastModified: tick++ })),
              abort: async () => undefined,
            };
          },
        };
      },
      async *values() {
        for (const [n, f] of files) yield { kind: 'file', name: n, getFile: async () => f };
        for (const d of dirs.values()) yield d;
      },
    };
  }

  it('même contenu logique qu’un dossier cloud, relu à l’identique ; conflit détecté', async () => {
    const { DirectoryBackend } = await import('../src/io/directoryBackend');
    const b = new DirectoryBackend(memDir());
    const { text, docs } = await docsAndModel([11, 12]);
    const r = await saveToFolder(b, text, docs, 'M', { expected: null });
    expect(r.uploaded).toBe(2);
    const o = await openFromFolder(b);
    expect(o.projectText).toBe(text);
    expect(await sha256Hex(await o.sources.get(docs[0].sha256)!.open())).toBe(docs[0].sha256);
    await b.writeConditional('project.json', '{"autre":1}', o.version!);
    await expect(b.writeConditional('project.json', text, o.version!)).rejects.toBeInstanceOf(ConflictError);
  });
});
