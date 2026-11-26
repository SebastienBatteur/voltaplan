import { File as NodeFile } from 'node:buffer';
import { FileTooLargeError, IMPORT_LIMITS, checkFileSize, checkImagePixels, checkTextSize, importErrorText, importKind } from '../src/io/limits';
import { readProjectFile } from '../src/io/files';
import { readBackground } from '../src/io/background';
import { parseProject } from '../src/io/storage';
import { translate } from '../src/i18n';

const MB = 1024 * 1024;
/** Fichier dont seule la taille compte (le contenu n'est jamais lu s'il est refusé ; seul l'en-tête l'est, pour reconnaître le format). */
const sized = (name: string, size: number, type = '') => ({ name, size, type, slice: () => new Blob(['{']), arrayBuffer: () => Promise.reject(new Error('lu')) }) as unknown as File;

describe('taille maximale des fichiers importés', () => {
  it('reconnaît le genre du fichier', () => {
    expect(importKind({ name: 'maison.trik' })).toBe('trik');
    expect(importKind({ name: 'schema.EDS' })).toBe('eds');
    expect(importKind({ name: 'plan.PDF' })).toBe('pdf');
    expect(importKind({ name: 'x', type: 'application/pdf' })).toBe('pdf');
    expect(importKind({ name: 'photo.jpg' })).toBe('image');
    expect(importKind({ name: 'x', type: 'image/png' })).toBe('image');
    expect(importKind({ name: 'maison.voltaplan' })).toBe('project');
  });

  it('limites raisonnables par genre', () => {
    expect(IMPORT_LIMITS).toEqual({ project: 50 * MB, trik: 20 * MB, eds: 20 * MB, image: 25 * MB, pdf: 50 * MB, dxf: 30 * MB });
    expect(() => checkFileSize({ name: 'a.jpg', size: 25 * MB })).not.toThrow();
    expect(() => checkFileSize({ name: 'a.jpg', size: 25 * MB + 1 })).toThrow(FileTooLargeError);
    expect(() => checkFileSize({ name: 'a.trik', size: 21 * MB })).toThrow(FileTooLargeError);
    expect(() => checkFileSize({ name: 'a.pdf', size: 49 * MB })).not.toThrow();
    expect(() => checkTextSize('x'.repeat(10))).not.toThrow();
    expect(() => checkImagePixels('a.png', 20000, 20000)).toThrow(FileTooLargeError);
    expect(() => checkImagePixels('a.png', 4000, 3000)).not.toThrow();
  });

  it('refuse un projet ou un .trik trop gros avant de le lire', async () => {
    await expect(readProjectFile(sized('gros.voltaplan', 51 * MB))).rejects.toBeInstanceOf(FileTooLargeError);
    await expect(readProjectFile(sized('gros.trik', 21 * MB))).rejects.toBeInstanceOf(FileTooLargeError);
    await expect(readProjectFile(sized('gros.eds', 21 * MB))).rejects.toBeInstanceOf(FileTooLargeError);
  });

  it('refuse une image ou un PDF trop gros avant de le lire', async () => {
    await expect(readBackground(sized('photo.jpg', 26 * MB, 'image/jpeg'))).rejects.toBeInstanceOf(FileTooLargeError);
    await expect(readBackground(sized('plan.pdf', 51 * MB, 'application/pdf'))).rejects.toBeInstanceOf(FileTooLargeError);
  });

  it('un XML déguisé (extension inconnue) est soumis à la limite Trikker', async () => {
    const xml = '<?xml version="1.0"?>' + ' '.repeat(21 * MB);
    const f = new NodeFile([xml], 'maison.xml');
    await expect(readProjectFile(f as unknown as File)).rejects.toBeInstanceOf(FileTooLargeError);
  });

  it('message explicite et traduit', () => {
    const e = new FileTooLargeError('photo.jpg', 30 * MB, 25 * MB);
    expect(importErrorText(e, (k, p) => translate('fr', k, p))).toBe('Fichier trop volumineux : « photo.jpg » fait 30 Mo, le maximum est 25 Mo.');
    expect(importErrorText(e, (k, p) => translate('nl', k, p))).toContain('Bestand te groot');
    expect(importErrorText(e, (k, p) => translate('en', k, p))).toContain('File too large');
    // Allemand : retombe sur l'anglais
    expect(importErrorText(e, (k, p) => translate('de', k, p))).toContain('File too large');
    expect(importErrorText(new Error('autre'), (k) => k)).toBe('autre');
  });

  it('un projet distant trop gros est refusé', () => {
    expect(() => parseProject('x'.repeat(50 * MB + 1), 'gros.voltaplan')).toThrow(FileTooLargeError);
  });
});
