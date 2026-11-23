import { File as NodeFile } from 'node:buffer';
import { readProjectFile } from '../src/io/files';
import { emptyProject } from '../src/model/tree';
import { FILE_FORMAT } from '../src/brand';

describe('fichiers de projet', () => {
  it('un nouveau projet porte le format Voltaplan', () => {
    expect(emptyProject().format).toBe(FILE_FORMAT);
    expect(FILE_FORMAT).toBe('voltaplan');
  });

  it('les fichiers .openrgie des premières versions s’ouvrent toujours', async () => {
    const old = { ...emptyProject(), format: 'openrgie' };
    const file = new NodeFile([JSON.stringify(old)], 'maison.openrgie');
    const r = await readProjectFile(file as unknown as File);
    expect(r.project.meta.title).toBe(old.meta.title);
    expect(r.fileName).toBe('maison.openrgie');
  });

  it('refuse un fichier qui n’est pas un projet', async () => {
    const file = new NodeFile([JSON.stringify({ format: 'autre' })], 'x.json');
    await expect(readProjectFile(file as unknown as File)).rejects.toThrow();
  });
});
