// @vitest-environment node
/**
 * Dossiers de projet Dropbox et Google Drive (F8) : mêmes garanties que OneDrive, avec des services SIMULÉS
 * (test/cloudFakes.ts, d'après la documentation [à vérifier avec de vrais comptes]) :
 * documents envoyés une fois et vérifiés AVANT le modèle, modèle conditionnel, copie de conflit dans le même
 * dossier, reprise après coupure, gros envois par tranches, espace plein, deux appareils, transfert, import.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeArchive } from '../src/format/archive';
import { openFromFolder, saveToFolder, transferToFolder, type FolderDoc } from '../src/format/folder';
import { sha256Hex } from '../src/format/sha256';
import type { FolderBackend } from '../src/format/storageBackend';
import { AssetStore, MemoryAssetBackend } from '../src/format/assets';
import { AssetSession } from '../src/format/session';
import { folderSave, importArchiveToFolder, transferFolder } from '../src/io/cloudFolder';
import { cloudSave, PROVIDERS, setCloudTokenForTest } from '../src/io/cloud';
import { AuthError, ConflictError, StorageFullError } from '../src/io/conflict';
import { DRIVE_CHUNK, DRIVE_MULTIPART_MAX, nextOffset } from '../src/io/drive';
import { createDriveProjectFolder, DriveFolderBackend, listDriveFolders } from '../src/io/driveFolder';
import { DropboxFolderBackend, listDropboxFolders } from '../src/io/dropboxFolder';
import { assetSession, projectWriteInput } from '../src/io/projectData';
import { saveAt, type SaveDeps } from '../src/io/saveFlow';
import type { FolderLocation, Location } from '../src/io/storage';
import { emptyProject } from '../src/model/tree';
import type { Project } from '../src/model/types';
import { FakeDrive, FakeDropbox } from './cloudFakes';

afterEach(() => vi.unstubAllGlobals());

const NOW = new Date(2026, 10, 24, 14, 2);
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

function withPhotos(base: Project, shas: string[]): Project {
  const p = structuredClone(base);
  p.boards = Object.fromEntries(shas.map((s, i) => ['b' + i, { slots: {}, photo: { href: 'asset:' + s, x: 0, y: 0, w: 1, h: 1 } }])) as Project['boards'];
  return p;
}

/** Deux services, même scénario : backend simulé, inspection de ses fichiers. */
interface Svc {
  name: 'dropbox' | 'gdrive';
  make: () => Promise<{ backend: () => FolderBackend; loc: FolderLocation; names: () => string[]; read: (name: string) => string | undefined; fake: FakeDropbox | FakeDrive }>;
}

const SERVICES: Svc[] = [
  {
    name: 'dropbox',
    make: async () => {
      const fake = new FakeDropbox();
      return {
        fake,
        loc: { kind: 'folder', provider: 'dropbox', folder: 'Maison', modelPath: 'project.json' },
        backend: () => new DropboxFolderBackend('tok', 'Maison', fake.fetch),
        names: () => [...fake.files.values()].map((f) => (f.path ?? '').replace('/Maison/', '')),
        read: (n) => {
          const f = fake.files.get('/maison/' + n.toLowerCase());
          return f && new TextDecoder().decode(f.data);
        },
      };
    },
  },
  {
    name: 'gdrive',
    make: async () => {
      const fake = new FakeDrive();
      const folder = await createDriveProjectFolder('tok', 'Maison', undefined, fake.fetch);
      const inFolder = () => [...fake.files.values()].filter((f) => f.parents.includes(folder.id) && f.mimeType !== 'application/vnd.google-apps.folder');
      const assetsIds = () => [...fake.files.values()].filter((f) => f.parents.includes(folder.id) && f.name === 'assets').map((f) => f.id);
      return {
        fake,
        loc: { kind: 'folder', provider: 'gdrive', folder: 'Maison', folderId: folder.id, modelPath: 'project.json' },
        backend: () => new DriveFolderBackend('tok', folder.id, 'Maison', fake.fetch),
        names: () => [
          ...inFolder().map((f) => f.name),
          ...[...fake.files.values()].filter((f) => f.parents.some((p) => assetsIds().includes(p))).map((f) => 'assets/' + f.name),
        ],
        read: (n) => {
          const f = inFolder().find((x) => x.name === n);
          return f && fake.text(f.id);
        },
      };
    },
  },
];

for (const svc of SERVICES)
  describe(`${svc.name} : dossier de projet`, () => {
    it('documents d’abord (vérifiés), modèle en dernier ; une modification du modèle ne renvoie aucun document', async () => {
      const s = await svc.make();
      const { text, docs } = await docsAndModel([1, 2]);
      const r = await saveToFolder(s.backend(), text, docs, 'Maison', { expected: null, verify: 'download' });
      expect(r).toMatchObject({ uploaded: 2, skipped: 0 });
      expect(s.names().sort()).toEqual([...docs.map((d) => `assets/${d.sha256}.jpg`), 'README.txt', 'project.json'].sort());
      // Ordre : le modèle est la DERNIÈRE écriture de contenu
      const writes = s.fake.calls.filter((c) => c.url.includes('upload') && c.method !== 'GET').map((c) => c.url + ' ' + (c.headers['dropbox-api-arg'] ?? ''));
      expect(writes[writes.length - 1].includes('project.json') || writes[writes.length - 1].includes('uploadType=multipart')).toBe(true);
      const again = await saveToFolder(s.backend(), text.replace('Nouveau', 'Autre'), docs, 'Maison', { expected: r.version! });
      expect(again).toMatchObject({ uploaded: 0, skipped: 2 });
      expect(again.version).not.toBe(r.version);
      // Relecture : même contenu, documents vérifiés par empreinte
      const o = await openFromFolder(s.backend());
      expect(o.missing).toEqual([]);
      expect(await sha256Hex(await o.sources.get(docs[0].sha256)!.open())).toBe(docs[0].sha256);
    });

    it('coupure pendant l’envoi : modèle non publié ; reprise sans renvoyer ce qui est déjà là', async () => {
      const s = await svc.make();
      const { text, docs } = await docsAndModel([1, 2, 3]);
      let n = 0;
      s.fake.before = (c) => {
        const isAsset = (c.headers['dropbox-api-arg'] ?? '').includes('assets') || (c.method === 'POST' && c.url.includes('uploadType=multipart'));
        if (isAsset && ++n === 2) throw new TypeError('réseau coupé');
      };
      await expect(saveToFolder(s.backend(), text, docs, 'M', { expected: null })).rejects.toBeInstanceOf(TypeError);
      expect(s.names()).not.toContain('project.json');
      s.fake.before = undefined;
      const r = await saveToFolder(s.backend(), text, docs, 'M', { expected: null });
      expect(r).toMatchObject({ uploaded: 2, skipped: 1 });
      expect(s.read('project.json')).toBe(text);
    });

    it('modèle modifié ailleurs : conflit ; saveAt écrit « project (conflit …).json » dans le même dossier, documents partagés', async () => {
      const s = await svc.make();
      assetSession.resetForTests();
      const sha = (await assetSession.store.add(new Blob([jpeg(7) as BlobPart], { type: 'image/jpeg' }))).sha256;
      const project = withPhotos(emptyProject(), [sha]);
      const run = <T>(fn: (b: FolderBackend) => Promise<T>) => fn(s.backend());
      const first = await folderSave(s.loc, project, 'create', run);
      // L'autre appareil enregistre : la version mémorisée devient périmée
      const theirs = JSON.stringify(emptyProject());
      await s.backend().writeConditional('project.json', theirs, first.rev!);
      const before = s.fake.calls.length;
      await expect(folderSave({ ...s.loc, rev: first.rev }, project, 'update', run)).rejects.toBeInstanceOf(ConflictError);
      // Rien d'envoyé : ni document, ni modèle
      expect(s.fake.calls.slice(before).filter((c) => c.method === 'PATCH' && /upload/.test(c.url))).toEqual([]);
      const deps = {
        folderSave: (loc: FolderLocation, p: Project, mode: 'update' | 'create' | 'overwrite') => folderSave(loc, p, mode, run),
        addVersion: async () => undefined,
        setPending: () => undefined,
        clearPending: () => undefined,
        now: () => NOW,
      } as unknown as SaveDeps;
      const out = await saveAt({ ...s.loc, rev: first.rev }, project, '', deps);
      expect(out).toMatchObject({ status: 'conflictCopy', copyName: 'Maison (conflit 2026-11-24 14h02)' });
      expect((out as { loc: FolderLocation }).loc.modelPath).toBe('project (conflit 2026-11-24 14h02).json');
      expect(s.names().filter((n) => n.startsWith('assets/'))).toEqual([`assets/${sha}.jpg`]);
      expect(s.read('project (conflit 2026-11-24 14h02).json')).toContain('asset:' + sha);
      // L'original de l'autre appareil est intact
      expect(s.read('project.json')).toBe(theirs);
    });

    it('espace plein : StorageFullError, modèle non publié, aucune mise en attente', async () => {
      const s = await svc.make();
      assetSession.resetForTests();
      const sha = (await assetSession.store.add(new Blob([jpeg(9) as BlobPart], { type: 'image/jpeg' }))).sha256;
      s.fake.full = true;
      const pending: string[] = [];
      const deps = {
        folderSave: (loc: FolderLocation, p: Project, mode: 'update' | 'create' | 'overwrite') => folderSave(loc, p, mode, (fn) => fn(s.backend())),
        addVersion: async () => undefined,
        setPending: (p: { key: string }) => pending.push(p.key),
        clearPending: () => undefined,
        now: () => NOW,
      } as unknown as SaveDeps;
      const e = await saveAt({ ...s.loc, rev: '1' }, withPhotos(emptyProject(), [sha]), '', deps).catch((x) => x);
      expect(e).toBeInstanceOf(StorageFullError);
      expect(pending).toEqual([]);
      expect(s.names()).not.toContain('project.json');
    });

    it('jeton expiré (401) : AuthError (reconnexion), rien d’écrit', async () => {
      const s = await svc.make();
      s.fake.token = 'autre';
      const { text, docs } = await docsAndModel([4]);
      await expect(saveToFolder(s.backend(), text, docs, 'M', { expected: null })).rejects.toBeInstanceOf(AuthError);
    });

    it('deux appareils ajoutent chacun une photo : les deux gardées, le perdant devient une copie qui référence la sienne', async () => {
      const s = await svc.make();
      const device = () => {
        const store = new AssetStore(new MemoryAssetBackend());
        return new AssetSession(() => store);
      };
      const a = device();
      const b = device();
      const base = await saveToFolder(s.backend(), JSON.stringify(emptyProject()), [], 'M', { expected: null });
      const pa = (await a.store.add(new Blob([jpeg(11) as BlobPart], { type: 'image/jpeg' }))).sha256;
      const pb = (await b.store.add(new Blob([jpeg(12) as BlobPart], { type: 'image/jpeg' }))).sha256;
      const docsOf = async (p: Project, sess: AssetSession) => (await projectWriteInput(p, sess)).originals.map((o) => ({ sha256: o.sha256, mime: o.mime, size: o.size, blob: o.blob }));
      const projA = withPhotos(emptyProject(), [pa]);
      const projB = withPhotos(emptyProject(), [pb]);
      await saveToFolder(s.backend(), JSON.stringify(projA), await docsOf(projA, a), 'M', { expected: base.version! });
      // B part de la même version : conflit sur le modèle, mais SA photo est déjà envoyée (immuable)
      await expect(saveToFolder(s.backend(), JSON.stringify(projB), await docsOf(projB, b), 'M', { expected: base.version! })).rejects.toBeInstanceOf(ConflictError);
      await saveToFolder(s.backend(), JSON.stringify(projB), await docsOf(projB, b), 'M', { expected: null, modelPath: 'project (conflit).json' });
      expect(s.names().filter((n) => n.startsWith('assets/')).sort()).toEqual([`assets/${pa}.jpg`, `assets/${pb}.jpg`].sort());
      const copy = await openFromFolder(s.backend(), 'project (conflit).json');
      expect(copy.missing).toEqual([]);
      expect([...copy.sources.keys()]).toEqual([pb]);
      expect((await openFromFolder(s.backend())).projectText).toContain(pa);
    });
  });

describe('Dropbox : détails de l’API', () => {
  it('document : mode « add » sans renommage ; déjà présent (autre contenu) → jamais remplacé', async () => {
    const fake = new FakeDropbox();
    fake.files.set('/maison/assets/x.jpg', { data: new Uint8Array([1, 2, 3]), rev: 'r0' });
    const b = new DropboxFolderBackend('tok', 'Maison', fake.fetch);
    expect(await b.putIfAbsent('assets/x.jpg', new Blob(['abcd']))).toEqual({ status: 'exists', size: 3 });
    expect(JSON.parse(fake.calls[0].headers['dropbox-api-arg'])).toEqual({ path: '/Maison/assets/x.jpg', mode: 'add', autorename: false, mute: true });
    expect(fake.files.get('/maison/assets/x.jpg')!.data).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('gros document : session par tranches ; réponse perdue → reprise à la position donnée par Dropbox', async () => {
    const fake = new FakeDropbox();
    const b = new DropboxFolderBackend('tok', 'M', fake.fetch, 10, 4);
    let lost = false;
    fake.after = (c) => {
      if (c.url.endsWith('append_v2') && JSON.parse(c.headers['dropbox-api-arg']).cursor.offset === 4 && !lost) {
        lost = true;
        throw new TypeError('réponse perdue');
      }
    };
    const data = new Uint8Array(18).map((_, i) => i);
    expect(await b.putIfAbsent('assets/big.pdf', new Blob([data]))).toEqual({ status: 'created', size: 18 });
    expect(fake.files.get('/m/assets/big.pdf')!.data).toEqual(data);
    const appends = fake.calls.filter((c) => c.url.endsWith('append_v2')).map((c) => JSON.parse(c.headers['dropbox-api-arg']).cursor.offset);
    // Tranche 4–8 reçue mais réponse perdue : renvoyée, Dropbox indique 8 (incorrect_offset), on reprend à 8
    expect(appends).toEqual([0, 4, 4, 8, 12, 16]);
    const finish = fake.calls.find((c) => c.url.endsWith('finish'))!;
    expect(JSON.parse(finish.headers['dropbox-api-arg']).commit).toMatchObject({ mode: 'add', autorename: false });
  });

  it('modèle : « update » avec la révision et strict_conflict ; création en « add » ; liste paginée ; dossier absent = vide', async () => {
    const fake = new FakeDropbox();
    const b = new DropboxFolderBackend('tok', 'Maison', fake.fetch);
    const v1 = (await b.writeConditional('project.json', '{"a":1}', null)).version!;
    await expect(b.writeConditional('project.json', '{}', null)).rejects.toBeInstanceOf(ConflictError);
    const v2 = (await b.writeConditional('project.json', '{"a":2}', v1)).version!;
    const arg = JSON.parse(fake.calls[fake.calls.length - 1].headers['dropbox-api-arg']);
    expect(arg).toMatchObject({ mode: { '.tag': 'update', update: v1 }, autorename: false, strict_conflict: true });
    await expect(b.writeConditional('project.json', '{}', v1)).rejects.toBeInstanceOf(ConflictError);
    expect(await b.readText('project.json')).toEqual({ text: '{"a":2}', version: v2 });
    expect(await b.readText('absent.json')).toBeNull();
    for (const n of ['a', 'b', 'c', 'd', 'e']) await b.putIfAbsent(`assets/${n}.jpg`, new Blob([n]));
    expect((await b.list('assets')).map((e) => e.name).sort()).toEqual(['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg']);
    expect(fake.calls.some((c) => c.url.endsWith('list_folder/continue'))).toBe(true);
    expect(await b.list('vide')).toEqual([]);
    // Dossier listé avec la date de son modèle (voir cloudFolderDates.test.ts)
    expect(await listDropboxFolders('tok', fake.fetch)).toEqual([{ name: 'Maison', modified: fake.files.get('/maison/project.json')!.modified }]);
  });
});

describe('Google Drive : détails de l’API', () => {
  it('dossiers créés par Voltaplan (marqués) ; sous-dossier « assets » marqué ; modèle en application/json', async () => {
    const fake = new FakeDrive();
    fake.addFile('Autre dossier', '', ['root'], 'application/vnd.google-apps.folder');
    const f = await createDriveProjectFolder('tok', 'Maison', undefined, fake.fetch);
    const { text, docs } = await docsAndModel([1]);
    await saveToFolder(new DriveFolderBackend('tok', f.id, 'Maison', fake.fetch), text, docs, 'Maison', { expected: null });
    expect(await listDriveFolders('tok', fake.fetch)).toEqual([expect.objectContaining({ id: f.id, name: 'Maison' })]);
    const assets = fake.byName('assets')[0];
    expect(assets.appProperties).toEqual({ voltaplan: 'assets' });
    expect(fake.byName('project.json')[0]).toMatchObject({ mimeType: 'application/json', parents: [f.id] });
    expect(fake.byName(`${docs[0].sha256}.jpg`)[0]).toMatchObject({ mimeType: 'image/jpeg', parents: [assets.id] });
  });

  it('modèle : version vérifiée avant, révision remplacée conservée AVANT l’envoi, notre envoi conservé', async () => {
    const fake = new FakeDrive();
    const f = await createDriveProjectFolder('tok', 'M', undefined, fake.fetch);
    const b = new DriveFolderBackend('tok', f.id, 'M', fake.fetch);
    const v1 = (await b.writeConditional('project.json', '{"a":1}', null)).version!;
    const model = fake.byName('project.json')[0];
    const head1 = model.revisions[0].id;
    const start = fake.calls.length;
    const v2 = (await b.writeConditional('project.json', '{"a":2}', v1)).version!;
    const calls = fake.calls.slice(start);
    const pin = calls.findIndex((c) => c.method === 'PATCH' && c.url.includes('/revisions/' + head1));
    const upload = calls.findIndex((c) => c.method === 'PATCH' && c.url.includes('/upload/'));
    expect(pin).toBeGreaterThanOrEqual(0);
    expect(pin).toBeLessThan(upload);
    expect(calls[upload].url).toContain('keepRevisionForever=true');
    expect(model.revisions.map((r) => r.keepForever)).toEqual([true, true]);
    expect(v2).not.toBe(v1);
    // Modifié ailleurs (version différente) : conflit, rien n'est envoyé
    fake.addRevision(model, new TextEncoder().encode('{"autre":1}'));
    const n = fake.calls.length;
    await expect(b.writeConditional('project.json', '{"a":3}', v2)).rejects.toBeInstanceOf(ConflictError);
    expect(fake.calls.slice(n).some((c) => c.url.includes('/upload/'))).toBe(false);
    // Mis à la corbeille ailleurs : conflit, jamais de recréation silencieuse
    model.trashed = true;
    await expect(b.writeConditional('project.json', '{"a":3}', v2)).rejects.toBeInstanceOf(ConflictError);
  });

  it('course pendant l’envoi : la version de l’autre est recopiée en « project (conflit …).json » dans le même dossier', async () => {
    const fake = new FakeDrive();
    const f = await createDriveProjectFolder('tok', 'M', undefined, fake.fetch);
    const b = new DriveFolderBackend('tok', f.id, 'M', fake.fetch);
    const v1 = (await b.writeConditional('project.json', '{"a":1}', null)).version!;
    const model = fake.byName('project.json')[0];
    fake.raceAfterUpload = { id: model.id, data: '{"autre":true}' };
    const r = await b.writeConditional('project.json', '{"a":2}', v1);
    expect(r.concurrentCopy).toMatch(/^project \(conflit .*\)\.json$/);
    const copy = fake.byName(r.concurrentCopy!)[0];
    expect(copy.parents).toEqual([f.id]);
    expect(fake.text(copy.id)).toBe('{"autre":true}');
    expect(fake.text(model.id)).toBe('{"a":2}');
  });

  it('saveFlow : la copie concurrente détectée par Drive est signalée (« saved » + concurrentCopy)', async () => {
    const fake = new FakeDrive();
    const f = await createDriveProjectFolder('tok', 'M', undefined, fake.fetch);
    const run = <T>(fn: (b: FolderBackend) => Promise<T>) => fn(new DriveFolderBackend('tok', f.id, 'M', fake.fetch));
    assetSession.resetForTests();
    const loc: FolderLocation = { kind: 'folder', provider: 'gdrive', folder: 'M', folderId: f.id, modelPath: 'project.json' };
    const first = await folderSave(loc, emptyProject(), 'create', run);
    fake.raceAfterUpload = { id: fake.byName('project.json')[0].id, data: '{"autre":true}' };
    const deps = {
      folderSave: (l: FolderLocation, p: Project, mode: 'update') => folderSave(l, p, mode, run),
      addVersion: async () => undefined,
      setPending: () => undefined,
      clearPending: () => undefined,
      now: () => NOW,
    } as unknown as SaveDeps;
    const out = await saveAt({ ...loc, rev: first.rev }, emptyProject(), '', deps);
    expect(out.status).toBe('saved');
    expect((out as { concurrentCopy?: string }).concurrentCopy).toMatch(/^project \(conflit/);
  });

  it('gros document : envoi « resumable » par tranches ; réponse perdue → reprise à la position donnée par Drive', async () => {
    const fake = new FakeDrive();
    const f = await createDriveProjectFolder('tok', 'M', undefined, fake.fetch);
    const b = new DriveFolderBackend('tok', f.id, 'M', fake.fetch);
    const size = DRIVE_CHUNK + DRIVE_MULTIPART_MAX;
    let lost = false;
    fake.after = (c) => {
      if (c.method === 'PUT' && c.url.includes('upload_id') && c.headers['content-range']?.startsWith('bytes 0-') && !lost) {
        lost = true;
        throw new TypeError('réponse perdue');
      }
    };
    const r = await b.putIfAbsent('assets/big.pdf', new Blob([new Uint8Array(size)], { type: 'application/pdf' }));
    expect(r).toEqual({ status: 'created', size });
    const puts = fake.calls.filter((c) => c.method === 'PUT').map((c) => c.headers['content-range']);
    // 1re tranche reçue, réponse perdue : on demande où reprendre, puis seulement la suite
    expect(puts).toEqual([`bytes 0-${DRIVE_CHUNK - 1}/${size}`, `bytes */${size}`, `bytes ${DRIVE_CHUNK}-${size - 1}/${size}`]);
    const init = fake.calls.find((c) => c.url.includes('uploadType=resumable'))!;
    expect(JSON.parse(String(init.body))).toMatchObject({ name: 'big.pdf', parents: [fake.byName('assets')[0].id] });
    expect(nextOffset('bytes=0-41')).toBe(42);
    expect(nextOffset(null)).toBe(0);
  });

  it('deux dossiers « assets » créés en même temps par deux appareils : lus ensemble, rien de renvoyé ni supprimé', async () => {
    const fake = new FakeDrive();
    const f = await createDriveProjectFolder('tok', 'M', undefined, fake.fetch);
    const a1 = fake.addFile('assets', '', [f.id], 'application/vnd.google-apps.folder');
    const a2 = fake.addFile('assets', '', [f.id], 'application/vnd.google-apps.folder');
    const { text, docs } = await docsAndModel([1, 2]);
    fake.addFile(`${docs[1].sha256}.jpg`, jpeg(2), [a2.id], 'image/jpeg');
    const r = await saveToFolder(new DriveFolderBackend('tok', f.id, 'M', fake.fetch), text, docs, 'M', { expected: null });
    expect(r).toMatchObject({ uploaded: 1, skipped: 1 });
    expect(fake.byName(`${docs[0].sha256}.jpg`)[0].parents).toEqual([a1.id]);
    const o = await openFromFolder(new DriveFolderBackend('tok', f.id, 'M', fake.fetch));
    expect(o.missing).toEqual([]);
  });

  it('création simultanée du même modèle : le nôtre est renommé en copie (rien supprimé), conflit signalé', async () => {
    const fake = new FakeDrive();
    const f = await createDriveProjectFolder('tok', 'M', undefined, fake.fetch);
    const b = new DriveFolderBackend('tok', f.id, 'M', fake.fetch);
    let once = false;
    fake.before = (c) => {
      // L'autre appareil crée project.json juste après notre vérification d'absence
      if (c.method === 'POST' && c.url.includes('uploadType=multipart') && !once) {
        once = true;
        fake.addFile('project.json', '{"autre":1}', [f.id]);
      }
    };
    await expect(b.writeConditional('project.json', '{"a":1}', null)).rejects.toBeInstanceOf(ConflictError);
    expect(fake.byName('project.json')).toHaveLength(1);
    expect(fake.text(fake.byName('project.json')[0].id)).toBe('{"autre":1}');
    expect([...fake.files.values()].some((x) => /^project \(conflit .*\)\.json$/.test(x.name))).toBe(true);
  });
});

describe('import et transfert vers les nouveaux services', () => {
  it('archive → dossier Drive ; dossier Drive → dossier Dropbox : mêmes documents, rien supprimé à la source', async () => {
    const { project, docs } = await docsAndModel([21, 22]);
    const { blob } = await writeArchive({ projectText: JSON.stringify(project), title: 'M', appVersion: '0', originals: docs });
    const drive = new FakeDrive();
    const f = await createDriveProjectFolder('tok', 'Maison', undefined, drive.fetch);
    const from = new DriveFolderBackend('tok', f.id, 'Maison', drive.fetch);
    const r = await importArchiveToFolder(blob!, from, 'Maison');
    expect(r).toMatchObject({ uploaded: 2 });
    const driveFiles = drive.files.size;
    const dbx = new FakeDropbox();
    const t = await transferFolder(from, new DropboxFolderBackend('tok', 'Maison', dbx.fetch), 'Maison');
    expect(t).toMatchObject({ uploaded: 2, skipped: 0 });
    expect(drive.files.size).toBe(driveFiles);
    const o = await openFromFolder(new DropboxFolderBackend('tok', 'Maison', dbx.fetch));
    expect(o.missing).toEqual([]);
    for (const d of docs) expect(await sha256Hex(await o.sources.get(d.sha256)!.open())).toBe(d.sha256);
    // Transfert relancé : rien n'est renvoyé ; un modèle différent ne remplace jamais celui qui existe (Dropbox
    // accepte en revanche le même contenu à l'identique [à vérifier])
    const n = dbx.calls.length;
    await expect(transferToFolder(o.projectText.replace('Nouveau', 'Autre'), o.sources, new DropboxFolderBackend('tok', 'Maison', dbx.fetch), 'Maison')).rejects.toBeInstanceOf(ConflictError);
    expect(dbx.calls.slice(n).filter((c) => (c.headers['dropbox-api-arg'] ?? '').includes('assets') && c.url.endsWith('files/upload'))).toEqual([]);
  });
});

describe('saveFlow : fichier à créer (« Nouveau » depuis Google Drive)', () => {
  it('emplacement sans identifiant : création dans le dossier choisi, puis mises à jour prudentes', async () => {
    const fake = new FakeDrive();
    vi.stubGlobal('fetch', fake.fetch);
    setCloudTokenForTest('gdrive', 'tok');
    assetSession.resetForTests();
    const folder = fake.addFile('Chantiers', '', ['root'], 'application/vnd.google-apps.folder');
    const deps = {
      cloudSave,
      addVersion: async () => undefined,
      setPending: () => undefined,
      clearPending: () => undefined,
      now: () => NOW,
    } as unknown as SaveDeps;
    const p = emptyProject();
    p.meta.title = 'Maison Dupont';
    const loc: Location = { kind: 'cloud', provider: 'gdrive', file: { id: '', name: '', parentId: folder.id } };
    const out = await saveAt(loc, p, '', deps);
    expect(out.status).toBe('saved');
    const created = fake.byName('Maison Dupont.voltaplan')[0];
    expect(created).toMatchObject({ parents: [folder.id], mimeType: 'application/vnd.voltaplan+zip' });
    const next = (out as { loc: Location }).loc;
    expect(next).toMatchObject({ kind: 'cloud', file: { id: created.id, parentId: folder.id } });
    expect((next as { file: { rev?: string } }).file.rev).toMatch(/\|/);
    // Enregistrement suivant : mise à jour du même fichier (aucun doublon)
    const again = await saveAt(next, p, '', deps);
    expect(again.status).toBe('saved');
    expect(fake.byName('Maison Dupont.voltaplan')).toHaveLength(1);
    expect(PROVIDERS.gdrive.label).toBe('Google Drive');
  });
});
