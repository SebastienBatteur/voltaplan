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
    expect(await sniffFormat(blob('<?xml version="1.0"?><project/>'), 'plan.xml')).toBe('trik');
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

  it('format inconnu : message clair', async () => {
    expect(await sniffFormat(blob('bonjour'), 'notes.txt')).toBeNull();
    await expect(openProjectData(blob('bonjour'), 'notes.txt')).rejects.toThrow(/non reconnu/);
    // Extension seule en repli (contenu sans signature)
    expect(await sniffFormat(blob('bonjour'), 'x.draadwijs')).toBe('draadwijs');
  });
});
