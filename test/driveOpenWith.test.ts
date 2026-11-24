// @vitest-environment node
/**
 * « Ouvrir avec Voltaplan » / « Nouveau → Voltaplan » depuis Google Drive : lecture du paramètre `state`
 * (valide, invalide, malveillant), nettoyage de l'adresse, ouverture par la chaîne habituelle avec Drive SIMULÉ
 * (test/cloudFakes.ts) : version mémorisée, lecture seule, fichier v1, dossier de projet, création.
 */
import { describe, expect, it, vi } from 'vitest';
import { createDriveProjectFolder, DriveFolderBackend } from '../src/io/driveFolder';
import { DriveOpenError, fetchDriveFile, parseDriveState, resourceKeysHeader, runDriveIntent, takeDriveIntent, type DriveIntent } from '../src/io/driveOpenWith';
import { folderOpen } from '../src/io/cloudFolder';
import { assetSession, openProjectData, serializeProject } from '../src/io/projectData';
import { emptyProject } from '../src/model/tree';
import { saveToFolder } from '../src/format/folder';
import { FakeDrive } from './cloudFakes';

const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz_-0123';
const q = (v: unknown) => '?state=' + encodeURIComponent(typeof v === 'string' ? v : JSON.stringify(v));

describe('paramètre state de Drive', () => {
  it('ouvrir : identifiants, compte, clés de ressource (seulement pour les fichiers demandés)', () => {
    expect(parseDriveState(q({ ids: [ID, ID], action: 'open', userId: '1234567890', resourceKeys: { [ID]: '0-abc_DEF', autre_id_inconnu: 'k' } }))).toEqual({
      action: 'open',
      ids: [ID],
      userId: '1234567890',
      resourceKeys: new Map([[ID, '0-abc_DEF']]),
    });
  });

  it('créer : dossier, clé du dossier, compte ; propriétés inconnues ignorées', () => {
    expect(parseDriveState(q({ action: 'create', folderId: ID, folderResourceKey: 'k1', userId: 'u1', extra: '<b>' }))).toEqual({ action: 'create', folderId: ID, folderResourceKey: 'k1', userId: 'u1' });
    expect(parseDriveState(q({ action: 'create' }))).toEqual({ action: 'create', folderId: undefined, folderResourceKey: undefined, userId: undefined });
  });

  it.each([
    ['absent', ''],
    ['JSON invalide', q('{"ids":')],
    ['pas un objet', q('"open"')],
    ['action inconnue', q({ action: 'delete', ids: [ID] })],
    ['liste vide', q({ action: 'open', ids: [] })],
    ['documents Google (exportIds)', q({ action: 'open', exportIds: [ID] })],
    ['chemin dans l’identifiant', q({ action: 'open', ids: ['../../files/x?alt=media'] })],
    ['script dans l’identifiant', q({ action: 'open', ids: ['<img src=x onerror=alert(1)>'] })],
    ['adresse en guise d’identifiant', q({ action: 'open', ids: ['https://evil.example/a'] })],
    ['identifiant trop court', q({ action: 'open', ids: ['abc'] })],
    ['identifiant non texte', q({ action: 'open', ids: [{ toString: 1 }] })],
    ['compte douteux', q({ action: 'open', ids: [ID], userId: 'a"onload="x' })],
    ['dossier douteux', q({ action: 'create', folderId: 'x/../y' })],
    ['trop long', q({ action: 'open', ids: [ID], pad: 'x'.repeat(20000) })],
    ['prototype', q('{"__proto__":{"action":"open"},"ids":["' + ID + '"]}')],
  ])('refusé : %s', (_, search) => {
    expect(parseDriveState(search)).toBeNull();
  });

  it('clé de ressource douteuse : ignorée (le fichier reste ouvrable)', () => {
    expect(parseDriveState(q({ action: 'open', ids: [ID], resourceKeys: { [ID]: 'a,b/c' } }))).toMatchObject({ resourceKeys: new Map() });
    expect(resourceKeysHeader([[ID, 'k'], ['autre', undefined]])).toBe(`${ID}/k`);
    expect(resourceKeysHeader([])).toBeUndefined();
    // Noms de propriétés spéciaux : simples identifiants, jamais des propriétés d'objet
    expect(parseDriveState(q({ action: 'open', ids: ['constructor', '__proto__xx'], resourceKeys: { constructor: 'k1', __proto__xx: 'k2' } }))).toMatchObject({
      resourceKeys: new Map([
        ['constructor', 'k1'],
        ['__proto__xx', 'k2'],
      ]),
    });
  });

  it('adresse nettoyée (replaceState) : `state` retiré, autres paramètres gardés ; rien sans `state`', () => {
    const replace = vi.fn();
    const href = `https://voltaplan.org/app/${q({ action: 'open', ids: [ID] })}&lang=nl#x`;
    const intent = takeDriveIntent({ href, search: new URL(href).search }, { replaceState: replace, state: null });
    expect(intent).toMatchObject({ action: 'open', ids: [ID] });
    expect(replace).toHaveBeenCalledWith(null, '', '/app/?lang=nl#x');
    // Paramètre invalide : retiré aussi, sans effet
    const replace2 = vi.fn();
    expect(takeDriveIntent({ href: 'https://voltaplan.org/app/?state=%3Cscript%3E', search: '?state=%3Cscript%3E' }, { replaceState: replace2, state: null })).toBeNull();
    expect(replace2).toHaveBeenCalledWith(null, '', '/app/');
    const replace3 = vi.fn();
    expect(takeDriveIntent({ href: 'https://voltaplan.org/app/?lang=fr', search: '?lang=fr' }, { replaceState: replace3, state: null })).toBeNull();
    expect(replace3).not.toHaveBeenCalled();
  });
});

describe('ouverture depuis Drive (service simulé)', () => {
  const deps = (fake: FakeDrive, hints: (string | undefined)[] = []) => ({
    withToken: <T>(fn: (t: string) => Promise<T>, hint?: string) => {
      hints.push(hint);
      return fn('tok');
    },
    openData: (data: Blob, name: string) => openProjectData(data, name),
    openFolder: (loc: Parameters<typeof folderOpen>[0]) => folderOpen(loc, (fn) => fn(new DriveFolderBackend('tok', loc.folderId!, loc.folder, fake.fetch))),
    fetch: fake.fetch,
  });

  it('archive v2 : ouverte, emplacement Drive avec sa version (enregistrement prudent au même endroit) ; autres fichiers signalés', async () => {
    assetSession.resetForTests();
    const fake = new FakeDrive();
    const p = emptyProject();
    p.meta.title = 'Maison';
    const bytes = new Uint8Array(await (await serializeProject(p))!.arrayBuffer());
    const parent = fake.addFile('Chantiers', '', ['root'], 'application/vnd.google-apps.folder');
    const f = fake.addFile('Maison.voltaplan', bytes, [parent.id], 'application/vnd.voltaplan+zip');
    const hints: (string | undefined)[] = [];
    const intent: DriveIntent = { action: 'open', ids: [f.id, 'F99999999999'], userId: '42', resourceKeys: new Map([[f.id, 'rk1']]) };
    const r = await runDriveIntent(intent, deps(fake, hints));
    expect(hints).toEqual(['42']); // compte suggéré à la connexion
    expect(r.kind).toBe('opened');
    if (r.kind !== 'opened') return;
    expect(r.project.meta.title).toBe('Maison');
    expect(r.loc).toEqual({
      kind: 'cloud',
      provider: 'gdrive',
      file: { id: f.id, name: 'Maison.voltaplan', size: bytes.length, rev: `${f.version}|${f.revisions[0].id}`, parentId: parent.id, resourceKeys: `${f.id}/rk1` },
    });
    expect(r.notes).toContainEqual({ key: 'driveOpen.others', params: { n: 1 } });
    // Clé de ressource transmise ; identifiant encodé dans le chemin ; jamais d'autre hôte
    expect(fake.calls.every((c) => c.headers['x-goog-drive-resource-keys'] === `${f.id}/rk1`)).toBe(true);
    expect(fake.calls.every((c) => c.url.startsWith('https://www.googleapis.com/drive/v3/files/' + f.id))).toBe(true);
  });

  it('fichier v1 (JSON) : converti, enregistré dans un NOUVEAU fichier à côté (original intact)', async () => {
    const fake = new FakeDrive();
    const parent = fake.addFile('Chantiers', '', ['root'], 'application/vnd.google-apps.folder');
    const v1 = { ...emptyProject(), version: 1 };
    const f = fake.addFile('Ancien.voltaplan', JSON.stringify(v1), [parent.id], 'application/json');
    const r = await runDriveIntent({ action: 'open', ids: [f.id], resourceKeys: new Map() }, deps(fake));
    expect(r).toMatchObject({ kind: 'opened', loc: { kind: 'cloud', provider: 'gdrive', file: { id: '', name: '', parentId: parent.id } }, notes: expect.arrayContaining([{ key: 'driveOpen.converted' }]) });
  });

  it('lecture seule : nouveau fichier dans « Mon Drive », jamais par-dessus l’original', async () => {
    const fake = new FakeDrive();
    const bytes = new Uint8Array(await (await serializeProject(emptyProject()))!.arrayBuffer());
    const f = fake.addFile('Partagé.voltaplan', bytes, ['root'], 'application/vnd.voltaplan+zip');
    const handle = fake.handle;
    fake.handle = async (url, init) => {
      const r = await handle(url, init);
      if (!url.includes('fields=') || !url.includes('capabilities')) return r;
      const j = await r.json();
      return new Response(JSON.stringify({ ...j, capabilities: { canEdit: false } }), { status: 200 });
    };
    const r = await runDriveIntent({ action: 'open', ids: [f.id], resourceKeys: new Map() }, deps(fake));
    expect(r).toMatchObject({ kind: 'opened', loc: { file: { id: '', parentId: undefined } }, notes: [{ key: 'driveOpen.readOnly' }] });
  });

  it('project.json d’un dossier de projet Voltaplan : ouvert comme dossier (documents à la demande)', async () => {
    assetSession.resetForTests();
    const fake = new FakeDrive();
    const folder = await createDriveProjectFolder('tok', 'Maison', undefined, fake.fetch);
    const p = emptyProject();
    await saveToFolder(new DriveFolderBackend('tok', folder.id, 'Maison', fake.fetch), JSON.stringify(p), [], 'Maison', { expected: null });
    const model = fake.byName('project.json')[0];
    const r = await runDriveIntent({ action: 'open', ids: [model.id], resourceKeys: new Map() }, deps(fake));
    expect(r).toMatchObject({ kind: 'opened', name: 'Maison', loc: { kind: 'folder', provider: 'gdrive', folderId: folder.id, folder: 'Maison', modelPath: 'project.json' } });
    expect((r as { loc: { rev?: string } }).loc.rev).toMatch(/\|/);
  });

  it('dossier, document Google, fichier inaccessible : erreur claire, rien d’ouvert', async () => {
    const fake = new FakeDrive();
    const dir = fake.addFile('Dossier', '', ['root'], 'application/vnd.google-apps.folder');
    const doc = fake.addFile('Notes', '', ['root'], 'application/vnd.google-apps.document');
    await expect(fetchDriveFile('tok', dir.id, undefined, fake.fetch)).rejects.toEqual(new DriveOpenError('folder'));
    await expect(fetchDriveFile('tok', doc.id, undefined, fake.fetch)).rejects.toEqual(new DriveOpenError('workspace'));
    await expect(fetchDriveFile('tok', 'F00000000000404', undefined, fake.fetch)).rejects.toEqual(new DriveOpenError('notFound'));
  });

  it('« Nouveau » : nouveau fichier à créer dans le dossier choisi, aucune connexion avant l’enregistrement', async () => {
    const hints: (string | undefined)[] = [];
    const r = await runDriveIntent({ action: 'create', folderId: ID, folderResourceKey: 'k', userId: 'u' }, deps(new FakeDrive(), hints));
    expect(r).toEqual({ kind: 'create', loc: { kind: 'cloud', provider: 'gdrive', file: { id: '', name: '', parentId: ID, resourceKeys: `${ID}/k` } } });
    expect(hints).toEqual([]);
  });
});
