// @vitest-environment node
/**
 * Dates des dossiers de projet, présentées de la même façon pour les trois services (services SIMULÉS) : date du
 * modèle project.json (Dropbox ne date pas les dossiers ; Drive ne change pas la date d'un dossier quand son
 * contenu change), sans une requête par dossier.
 */
import { describe, expect, it } from 'vitest';
import { saveToFolder } from '../src/format/folder';
import { sortByModified } from '../src/io/cloudFolder';
import { createDriveProjectFolder, DriveFolderBackend, listDriveFolders } from '../src/io/driveFolder';
import { DropboxFolderBackend, listDropboxFolders } from '../src/io/dropboxFolder';
import { FakeDrive, FakeDropbox } from './cloudFakes';

describe('dates des dossiers de projet', () => {
  it('Dropbox : date du project.json de chaque dossier, par une liste récursive (aucune requête par dossier)', async () => {
    const fake = new FakeDropbox();
    await saveToFolder(new DropboxFolderBackend('tok', 'Maison', fake.fetch), '{"a":1}', [], 'Maison', { expected: null });
    await saveToFolder(new DropboxFolderBackend('tok', 'Atelier', fake.fetch), '{"a":2}', [], 'Atelier', { expected: null });
    fake.files.set('/vide/notes.txt', { data: new Uint8Array([1]), rev: 'x' });
    const before = fake.calls.length;
    const list = await listDropboxFolders('tok', fake.fetch);
    const model = (f: string) => fake.files.get(`/${f.toLowerCase()}/project.json`)!.modified;
    expect(list.find((f) => f.name === 'Maison')?.modified).toBe(model('Maison'));
    expect(list.find((f) => f.name === 'Atelier')?.modified).toBe(model('Atelier'));
    expect(list.find((f) => f.name === 'vide')?.modified).toBeUndefined();
    const used = fake.calls.slice(before).map((c) => c.url.replace(/^.*\/2\//, ''));
    expect(new Set(used)).toEqual(new Set(['files/list_folder', 'files/list_folder/continue']));
    expect(JSON.parse(String(fake.calls[before].body)).recursive).toBe(true);
  });

  it('Google Drive : date du project.json (et non du dossier), en une seule requête de plus pour tous les dossiers', async () => {
    const fake = new FakeDrive();
    const a = await createDriveProjectFolder('tok', 'Maison', undefined, fake.fetch);
    const b = await createDriveProjectFolder('tok', 'Atelier', undefined, fake.fetch);
    const r = await saveToFolder(new DriveFolderBackend('tok', a.id, 'Maison', fake.fetch), '{"a":1}', [], 'Maison', { expected: null });
    await saveToFolder(new DriveFolderBackend('tok', b.id, 'Atelier', fake.fetch), '{"a":2}', [], 'Atelier', { expected: null });
    // Nouvel enregistrement de Maison : son modèle devient le plus récent, la date du dossier ne bouge pas
    await saveToFolder(new DriveFolderBackend('tok', a.id, 'Maison', fake.fetch), '{"a":3}', [], 'Maison', { expected: r.version! });
    const before = fake.calls.length;
    const list = await listDriveFolders('tok', fake.fetch);
    expect(fake.calls.length - before).toBe(2);
    const modelOf = (folderId: string) => [...fake.files.values()].filter((f) => f.name === 'project.json' && f.parents.includes(folderId)).map((f) => f.revisions[f.revisions.length - 1].modifiedTime)[0];
    expect(list.find((f) => f.name === 'Maison')?.modified).toBe(modelOf(a.id));
    expect(list.find((f) => f.name === 'Atelier')?.modified).toBe(modelOf(b.id));
    expect(sortByModified(list)[0].name).toBe('Maison');
  });

  it('présentation commune : plus récent d’abord, puis sans date par nom', () => {
    const l = sortByModified([{ name: 'b' }, { name: 'x', modified: '2026-11-20T10:00:00Z' }, { name: 'a' }, { name: 'y', modified: '2026-11-24T10:00:00Z' }]);
    expect(l.map((f) => f.name)).toEqual(['y', 'x', 'a', 'b']);
  });
});
