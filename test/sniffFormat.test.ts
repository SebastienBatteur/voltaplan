import { describe, expect, it } from 'vitest';
import { writeZip } from '../src/format/zip';
import { openProjectData, sniffFormat } from '../src/io/projectData';

const blob = (s: string) => new Blob([s]);
const volter = JSON.stringify({ project: { name: 'Essai' }, boards: [] });
const draadwijs = JSON.stringify({ id: 'x', version: 3, project: { naam: 'Essai' }, root: { children: [] } });
const planelec = JSON.stringify({ format: 'planelec-sketch', version: 2, singleLine: { root: {} } });

describe('un seul « Importer » : source reconnue d’après le contenu, quelle que soit l’extension', () => {
  it('JSON : PlanElec, Volter, Draadwijs, sinon projet Voltaplan v1', async () => {
    expect(await sniffFormat(blob(planelec), 'export.json')).toBe('planelec');
    expect(await sniffFormat(blob(volter), 'sauvegarde.json')).toBe('vschema');
    expect(await sniffFormat(blob(draadwijs), 'projet.txt')).toBe('draadwijs');
    expect(await sniffFormat(blob('﻿' + volter), 'sans-extension')).toBe('vschema');
    expect(await sniffFormat(blob(JSON.stringify({ format: 'voltaplan', roots: [] })), 'maison.voltaplan')).toBe('v1');
  });

  it('signatures : PDF, Trikker (XML), Eendraadschema', async () => {
    expect(await sniffFormat(blob('%PDF-1.7\n…'), 'dossier.bin')).toBe('pdf');
    expect(await sniffFormat(blob('<?xml version="1.0"?><Document><RootNodes/></Document>'), 'plan.xml')).toBe('trik');
    expect(await sniffFormat(blob('<?xml version="1.0"?><project/>'), 'autre.xml')).toBeNull();
    expect(await sniffFormat(blob('EDS0040000eJw'), 'schema')).toBe('eds');
  });

  it('archive : export Condui (manifeste) ou archive Voltaplan', async () => {
    const condui = (await writeZip([
      { path: 'manifest.json', data: JSON.stringify({ version: '1', projectId: 'demo', projectName: 'Essai', format: 'project-with-assets' }), store: false },
      { path: 'project.json', data: '{}', store: false },
    ]))!;
    expect(await sniffFormat(condui, 'telechargement.voltaplan')).toBe('condui');
    const other = (await writeZip([{ path: 'project.json', data: '{}', store: false }]))!;
    expect(await sniffFormat(other, 'export.zip')).toBe('v2');
  });

  it('archive quelconque : le fichier de schéma qu’elle contient est importé', async () => {
    const wrap = (await writeZip([
      { path: 'lisez-moi.txt', data: 'bonjour', store: false },
      { path: 'dossier/projet.json', data: draadwijs, store: false },
    ]))!;
    expect(await sniffFormat(wrap, 'envoi.zip')).toBe('zip');
    const r = await openProjectData(wrap, 'envoi.zip');
    expect(r.format).toBe('draadwijs');
    expect(r.warnings[0]).toEqual({ key: 'imp.file.fromZip', params: { path: 'dossier/projet.json', name: 'envoi.zip' } });
    const empty = (await writeZip([{ path: 'photo.txt', data: 'rien', store: false }]))!;
    await expect(openProjectData(empty, 'vide.zip')).rejects.toThrow(/aucun fichier de schéma/);
  });

  it('format inconnu : schéma électrique d’un autre logiciel, ou autre chose', async () => {
    expect(await sniffFormat(blob('bonjour'), 'notes.txt')).toBeNull();
    await expect(openProjectData(blob('bonjour'), 'notes.txt')).rejects.toThrow(/n'est pas un fichier de schéma électrique/);
    const other = JSON.stringify({ app: 'X', kringen: [{ naam: 'A', automaat: 'C16', aardlek: '30 mA', stopcontact: 2 }] });
    expect(await sniffFormat(blob(other), 'x.json')).toBeNull();
    await expect(openProjectData(blob(other), 'x.json')).rejects.toThrow(/ressemble à un schéma électrique/);
    // Extension seule en repli (contenu sans signature)
    expect(await sniffFormat(blob('bonjour'), 'x.draadwijs')).toBe('draadwijs');
  });
});
