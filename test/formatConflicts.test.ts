// @vitest-environment node
/**
 * Deux appareils modifient le même projet (SIMULÉ : dossier en mémoire, réponses des services d'après leur
 * documentation [à vérifier avec de vrais comptes]).
 *  - Dossier : documents immuables partagés, modèle conditionnel ; le perdant devient une copie de conflit qui
 *    référence SES documents, tous présents ; aucune suppression distante, jamais.
 *  - Archive (OneDrive, Dropbox, Google Drive, GitHub) : la copie de conflit est une archive complète (documents
 *    compris), l'original de l'autre appareil n'est pas touché.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readArchive } from '../src/format/archive';
import { AssetStore, MemoryAssetBackend } from '../src/format/assets';
import { openFromFolder, saveToFolder } from '../src/format/folder';
import { AssetSession } from '../src/format/session';
import { sha256Hex } from '../src/format/sha256';
import { MemoryFolderBackend } from '../src/format/storageBackend';
import { cloudSave, setCloudTokenForTest, type CloudId } from '../src/io/cloud';
import { assetSession, projectWriteInput } from '../src/io/projectData';
import { saveAt, type SaveDeps, type SaveOutcome } from '../src/io/saveFlow';
import { githubSave, type FolderLocation, type Location } from '../src/io/storage';
import { emptyProject } from '../src/model/tree';
import type { Project } from '../src/model/types';

const jpeg = (seed: number) => {
  const b = new Uint8Array(4000);
  for (let i = 0; i < b.length; i++) b[i] = (i * seed + 7) & 0xff;
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  return new Blob([b], { type: 'image/jpeg' });
};
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });
const NOW = new Date(2026, 10, 24, 14, 2);

afterEach(() => vi.unstubAllGlobals());

/** Un appareil : son propre stockage de travail. */
function device() {
  const store = new AssetStore(new MemoryAssetBackend());
  return new AssetSession(() => store);
}

function withPhotos(base: Project, shas: string[]): Project {
  const p = structuredClone(base);
  p.boards = Object.fromEntries(shas.map((s, i) => ['b' + i, { slots: {}, photo: { href: 'asset:' + s, x: 0, y: 0, w: 1, h: 1 } }])) as Project['boards'];
  return p;
}

function folderDeps(remote: MemoryFolderBackend, session: AssetSession): SaveDeps {
  return {
    folderSave: async (loc: FolderLocation, project: Project, mode: string) => {
      const input = await projectWriteInput(project, session);
      const docs = input.originals.map((o) => ({ sha256: o.sha256, mime: o.mime, size: o.size, blob: o.blob }));
      const expected = mode === 'update' ? loc.rev! : mode === 'create' ? null : 'any';
      const r = await saveToFolder(remote, JSON.stringify(project), docs, project.meta.title, { modelPath: loc.modelPath, expected });
      return { rev: r.version };
    },
    addVersion: async () => undefined,
    setPending: () => undefined,
    clearPending: () => undefined,
    now: () => NOW,
  } as unknown as SaveDeps;
}

const modelOf = (o: SaveOutcome) => (o.status === 'saved' || o.status === 'conflictCopy' ? (o.loc as FolderLocation).modelPath : '');

describe('dossier de projet : deux appareils', () => {
  it('chacun ajoute une photo en même temps : les deux photos gardées, le perdant devient une copie qui référence la sienne', async () => {
    const remote = new MemoryFolderBackend();
    const base = emptyProject();
    base.meta.title = 'Maison';
    const start = await saveToFolder(remote, JSON.stringify(base), [], 'Maison', { expected: null });
    const loc: FolderLocation = { kind: 'folder', provider: 'onedrive', folder: 'Maison', modelPath: 'project.json', rev: start.version };
    const A = device();
    const B = device();
    const pa = (await A.store.add(jpeg(1))).sha256;
    const pb = (await B.store.add(jpeg(2))).sha256;
    const [ra, rb] = await Promise.all([saveAt(loc, withPhotos(base, [pa]), '', folderDeps(remote, A)), saveAt(loc, withPhotos(base, [pb]), '', folderDeps(remote, B))]);
    const statuses = [ra.status, rb.status].sort();
    expect(statuses).toEqual(['conflictCopy', 'saved']);
    const [winner, loser] = ra.status === 'saved' ? [pa, pb] : [pb, pa];
    const copyPath = modelOf(ra.status === 'conflictCopy' ? ra : rb);
    expect(copyPath).toBe('project (conflit 2026-11-24 14h02).json');
    // Les deux documents sont dans le dossier ; chaque modèle trouve les siens
    const assets = (await remote.list('assets')).map((e) => e.name);
    expect(assets.sort()).toEqual([`${pa}.jpg`, `${pb}.jpg`].sort());
    const main = await openFromFolder(remote);
    expect([...main.sources.keys()]).toEqual([winner]);
    expect(main.missing).toEqual([]);
    const copy = await openFromFolder(remote, copyPath);
    expect([...copy.sources.keys()]).toEqual([loser]);
    expect(copy.missing).toEqual([]);
    expect(await sha256Hex(await copy.sources.get(loser)!.open())).toBe(loser);
  });

  it('l’un retire une photo, l’autre la référence encore : rien n’est supprimé à distance, la copie de conflit la retrouve', async () => {
    const remote = new MemoryFolderBackend();
    const A = device();
    const B = device();
    const p = (await A.store.add(jpeg(3))).sha256;
    await B.store.add(jpeg(3));
    const base = withPhotos(emptyProject(), [p]);
    const start = await saveToFolder(remote, JSON.stringify(base), [{ sha256: p, mime: 'image/jpeg', size: 4000, blob: async () => jpeg(3) }], 'M', { expected: null });
    const loc: FolderLocation = { kind: 'folder', provider: 'onedrive', folder: 'M', modelPath: 'project.json', rev: start.version };
    // A retire la photo et enregistre
    const ra = await saveAt(loc, withPhotos(base, []), '', folderDeps(remote, A));
    expect(ra.status).toBe('saved');
    expect(await remote.list('assets')).toEqual([{ name: `${p}.jpg`, size: 4000 }]);
    // B, qui la référence encore (version périmée), enregistre : copie de conflit, photo toujours là
    const edited = withPhotos(base, [p]);
    edited.meta.title = 'M (B)';
    const rb = await saveAt(loc, edited, '', folderDeps(remote, B));
    expect(rb.status).toBe('conflictCopy');
    const copy = await openFromFolder(remote, modelOf(rb));
    expect(copy.missing).toEqual([]);
    expect(await sha256Hex(await copy.sources.get(p)!.open())).toBe(p);
    // L'interface du dossier n'a aucune opération de suppression
    expect(remote.writes.every((w) => w === 'README.txt' || w.endsWith('.json') || w.startsWith('assets/'))).toBe(true);
    expect('delete' in remote || 'remove' in remote).toBe(false);
  });
});

describe('archive chez chaque service : deux appareils, chacun sa photo', () => {
  /** Archive envoyée par la copie de conflit (corps de la requête). */
  async function archiveBytes(body: unknown, provider: CloudId | 'github'): Promise<Uint8Array<ArrayBuffer>> {
    if (provider === 'github') return new Uint8Array(Buffer.from((JSON.parse(body as string) as { content: string }).content, 'base64'));
    const bytes = new Uint8Array(await (body as Blob).arrayBuffer());
    if (provider !== 'gdrive') return bytes;
    // Envoi « multipart » de Drive : l'archive est entre la 2e partie et la limite finale
    const start = bytes.findIndex((b, i) => b === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 3 && bytes[i + 3] === 4);
    const tail = new TextDecoder('latin1').decode(bytes).lastIndexOf('\r\n--voltaplan');
    return bytes.slice(start, tail);
  }

  const cases: { provider: CloudId | 'github'; respond: (url: string, init: RequestInit) => Response | 'capture' }[] = [
    {
      provider: 'onedrive',
      respond: (_u, init) => ((init.headers as Record<string, string>)['If-Match'] ? new Response('', { status: 412 }) : 'capture'),
    },
    {
      provider: 'dropbox',
      respond: (_u, init) => (/"update"/.test((init.headers as Record<string, string>)['Dropbox-API-Arg']) ? json({ error_summary: 'path/conflict/file/..' }, 409) : 'capture'),
    },
    {
      // Drive : version changée depuis l'ouverture → conflit détecté avant tout envoi
      provider: 'gdrive',
      respond: (url, init) => (init.method === 'POST' ? 'capture' : url.includes('fields=version') ? json({ version: '9', headRevisionId: 'h9' }) : json({}, 404)),
    },
    {
      provider: 'github',
      respond: (_u, init) => (JSON.parse(init.body as string).sha ? json({ message: 'is at abc but expected def' }, 409) : 'capture'),
    },
  ];

  for (const c of cases)
    it(`${c.provider} : notre version (avec SA photo) devient une copie complète ; l’original de l’autre n’est pas touché`, async () => {
      assetSession.resetForTests();
      const mine = (await assetSession.store.add(jpeg(40 + c.provider.length))).sha256;
      const project = withPhotos(emptyProject(), [mine]);
      let captured: unknown = null;
      const writes: string[] = [];
      vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
        const r = c.respond(url, init);
        if (r !== 'capture') return r;
        writes.push(url);
        captured = init.body;
        return json({ id: 'COPY', name: 'copie', path_lower: '/copie', size: 1, eTag: '"c"', rev: 'c', version: '1', headRevisionId: 'h1', content: { sha: 'new' } }, 201);
      });
      let loc: Location;
      const deps: SaveDeps = {
        browserSave: async () => 1,
        cloudSave,
        githubSave,
        githubToken: () => 'tok',
        githubSettings: () => ({ repo: 'me/d', branch: 'main', folder: 'v' }),
        deviceSave: async () => null,
        addVersion: async () => undefined,
        setPending: () => undefined,
        clearPending: () => undefined,
        newId: () => 'x',
        now: () => NOW,
      };
      if (c.provider === 'github') loc = { kind: 'github', repo: 'me/d', branch: 'main', path: 'v/Maison.voltaplan', sha: 'def' };
      else {
        setCloudTokenForTest(c.provider, 'tok');
        loc = { kind: 'cloud', provider: c.provider, file: { id: c.provider === 'dropbox' ? '/maison.voltaplan' : 'ID1', name: 'Maison.voltaplan', rev: c.provider === 'gdrive' ? '5|h5' : 'r1' } };
      }
      const r = await saveAt(loc, project, 'Maison.voltaplan', deps);
      expect(r).toMatchObject({ status: 'conflictCopy', copyName: 'Maison (conflit 2026-11-24 14h02).voltaplan' });
      // Une seule écriture réussie : la copie, jamais l'original
      expect(writes).toHaveLength(1);
      const a = await readArchive(new Blob([await archiveBytes(captured, c.provider)]));
      expect([...a.originals.keys()]).toEqual([mine]);
      expect(a.projectText).toContain('asset:' + mine);
      expect(await sha256Hex(await a.originals.get(mine)!.open())).toBe(mine);
    });
});
