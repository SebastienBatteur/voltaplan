// @vitest-environment node
/**
 * README.txt d'un dossier de projet : écrit s'il manque ou si son texte a changé, jamais renvoyé à chaque
 * enregistrement. Constaté sur un vrai compte Dropbox (2026-11-24) : avant, il repartait à chaque enregistrement.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { resetReadmeCache, saveToFolder, syncReadme } from '../src/format/folder';
import { folderReadmeText } from '../src/format/manifest';
import { MemoryFolderBackend } from '../src/format/storageBackend';
import { DropboxFolderBackend } from '../src/io/dropboxFolder';
import { FakeDropbox } from './cloudFakes';

beforeEach(() => resetReadmeCache());

describe('README.txt du dossier', () => {
  it('décrit un dossier (pas une archive ZIP) et porte le titre', () => {
    const t = folderReadmeText('Maison Dupont');
    expect(t).toContain('Maison Dupont');
    expect(t).toContain('project.json');
    expect(t).toContain('assets/');
    expect(t).not.toMatch(/renommez-le en|ZIP/);
  });

  it('absent → créé ; même texte → rien (sans même relire, avec un identifiant) ; titre changé → remplacé', async () => {
    const b = new MemoryFolderBackend();
    expect(await syncReadme(b, folderReadmeText('A'), 'k')).toBe('created');
    const writes = b.writes.length;
    expect(await syncReadme(b, folderReadmeText('A'), 'k')).toBe('cached');
    expect(b.writes.length).toBe(writes);
    expect(await syncReadme(b, folderReadmeText('B'), 'k')).toBe('updated');
    expect(await (await b.readBlob('README.txt')).text()).toContain('B');
  });

  it('sans identifiant : relu, pas réécrit s’il est déjà à jour', async () => {
    const b = new MemoryFolderBackend();
    await syncReadme(b, folderReadmeText('A'));
    const writes = b.writes.length;
    expect(await syncReadme(b, folderReadmeText('A'))).toBe('unchanged');
    expect(b.writes.length).toBe(writes);
  });

  it('ancien README d’archive dans un dossier existant : actualisé une fois', async () => {
    const b = new MemoryFolderBackend();
    await b.putIfAbsent('README.txt', new Blob(['Ce fichier est une archive ZIP ordinaire.']));
    expect(await syncReadme(b, folderReadmeText('A'), 'k')).toBe('updated');
    expect(await syncReadme(b, folderReadmeText('A'), 'k')).toBe('cached');
  });

  it('Dropbox : le 2e enregistrement n’envoie que project.json', async () => {
    const fake = new FakeDropbox();
    const b = () => new DropboxFolderBackend('tok', 'Maison', fake.fetch);
    const r = await saveToFolder(b(), '{"v":1}', [], 'Maison', { expected: null, readmeKey: 'dropbox:Maison' });
    const before = fake.calls.length;
    await saveToFolder(b(), '{"v":2}', [], 'Maison', { expected: r.version!, readmeKey: 'dropbox:Maison' });
    const uploads = fake.calls.slice(before).filter((c) => c.url.endsWith('/files/upload')).map((c) => JSON.parse(c.headers['dropbox-api-arg']).path);
    expect(uploads).toEqual(['/Maison/project.json']);
  });

  it('un README illisible ou refusé n’empêche jamais l’enregistrement', async () => {
    const b = new MemoryFolderBackend();
    b.beforeWrite = (p) => {
      if (p === 'README.txt') throw new Error('refusé');
    };
    const r = await saveToFolder(b, '{"v":1}', [], 'M', { expected: null });
    expect(r.version).toBeDefined();
  });
});
