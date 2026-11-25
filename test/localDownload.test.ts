/**
 * Enregistrement sur l'appareil sans sélecteur de fichiers (Firefox, Safari, mobile) : l'archive est téléchargée
 * avec son type propre (application/vnd.voltaplan+zip) et toujours l'extension .voltaplan.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MIMETYPE } from '../src/format/manifest';
import { writeArchive } from '../src/format/archive';
import { deviceFileName, resetHandle, saveProject } from '../src/io/files';
import { emptyProject } from '../src/model/tree';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('nom du fichier sur l’appareil', () => {
  it.each([
    ['Maison', 'Maison.voltaplan'],
    ['Maison.voltaplan', 'Maison.voltaplan'],
    ['Maison.VOLTAPLAN', 'Maison.voltaplan'],
    ['Ancien.openrgie', 'Ancien.voltaplan'],
    ['Maison (conflit 2026-11-25 10h02)', 'Maison (conflit 2026-11-25 10h02).voltaplan'],
    ['Rue 12.5', 'Rue 12.5.voltaplan'],
    ['a/b:c?', 'a_b_c_.voltaplan'],
    ['', 'projet.voltaplan'],
    [undefined, 'projet.voltaplan'],
  ])('%s → %s', (raw, out) => expect(deviceFileName(raw)).toBe(out));
});

describe('téléchargement sans sélecteur de fichiers', () => {
  it('archive : type application/vnd.voltaplan+zip', async () => {
    const { blob } = await writeArchive({ projectText: '{}', title: 'T', appVersion: '0', originals: [], derived: [] });
    expect(blob!.type).toBe(MIMETYPE);
  });

  it('saveProject : type propre et extension .voltaplan, même pour une copie de conflit sans extension', async () => {
    const got: { type: string; name: string }[] = [];
    let last: Blob | null = null;
    // jsdom n'a pas URL.createObjectURL : posé pour ce test
    vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: (b: Blob) => ((last = b), 'blob:x'), revokeObjectURL: () => undefined }));
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      got.push({ type: last!.type, name: this.download });
    });
    resetHandle();
    expect('showSaveFilePicker' in window).toBe(false);
    await saveProject(emptyProject(), 'Maison.voltaplan', true);
    await saveProject(emptyProject(), 'Maison.voltaplan', true, { suggestedName: 'Maison (conflit 2026-11-25 10h02)' });
    expect(got).toEqual([
      { type: MIMETYPE, name: 'Maison.voltaplan' },
      { type: MIMETYPE, name: 'Maison (conflit 2026-11-25 10h02).voltaplan' },
    ]);
  });
});
