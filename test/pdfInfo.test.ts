import { describe, expect, it } from 'vitest';
import { applyPdfInfo, checkBom, parseDate, parseParty, readBom, readPdfInfo } from '../src/import/pdfInfo';
import type { PdfText } from '../src/import/pdfDossier';
import { createNode, emptyProject } from '../src/model/tree';

const t = (page: number, x: number, y: number, str: string, size = 6): PdfText => ({ page, x, y, str, size });

describe('informations d’un dossier PDF repris', () => {
  it('coordonnées : nom, rue, code postal et localité, pays, e-mail, téléphone, TVA', () => {
    expect(parseParty(['Jan Vandamme', 'Vonkenstraat 25', '1000 Brussel', 'Belgique'])).toEqual({ name: 'Jan Vandamme', address: { street: 'Vonkenstraat 25', postalCode: '1000', city: 'Brussel', country: 'Belgique' } });
    expect(parseParty(['Stroomweg 3, 9000 Gent'])).toEqual({ address: { street: 'Stroomweg 3', postalCode: '9000', city: 'Gent' } });
    expect(parseParty(['test', 'rue toto', '7000 Mons']).address).toEqual({ street: 'rue toto', postalCode: '7000', city: 'Mons' });
    expect(parseParty(['Gandalf Le Blanc', 'Rue de la Loi 16, 1000 Bruxelles', '+32 470 12 34 56', 'gandalf@example.be', 'BE 0123.456.789'])).toMatchObject({ name: 'Gandalf Le Blanc', phone: '+32 470 12 34 56', email: 'gandalf@example.be', vat: 'BE0123.456.789' });
  });

  it('dates : ISO, jour/mois/année, format américain', () => {
    expect(parseDate('N° 1 · version 1 · 2026-11-26')).toBe('2026-11-26');
    expect(parseDate('v1 du 26/11/2026')).toBe('2026-11-26');
    expect(parseDate('11/26/2026')).toBe('2026-11-26');
    expect(parseDate('sans date')).toBeUndefined();
  });

  it('cartouche à colonnes (valeurs sous les libellés) et formulaire (valeur à droite, cases vides)', () => {
    const items: PdfText[] = [
      // Cartouche à trois colonnes (Condui)
      t(1, 533, 495, 'Installateur', 5),
      t(1, 533, 509, 'Jan Vandamme', 5),
      t(1, 533, 517, 'Vonkenstraat 25', 5),
      t(1, 533, 525, '1000 Brussel', 5),
      t(1, 638, 495, 'Installatieadres', 5),
      t(1, 638, 509, 'Demo', 5),
      t(1, 638, 517, 'Kerkstraat 123', 5),
      t(1, 638, 525, '9000 Gent', 5),
      t(1, 723, 495, 'Eendraadsschema', 5),
      t(1, 723, 513, '11/26/2026', 5),
      // Formulaire « libellé | valeur » (Draadwijs) : client et organisme vides
      t(2, 422, 458, 'Client', 8),
      t(2, 422, 473, 'Tension, courant', 8),
      t(2, 512, 473, '230 V · courant alternatif', 8),
      t(2, 422, 488, 'Organisme agréé', 8),
      t(2, 422, 503, 'Responsable de l’exécution – signature et date', 7),
      // Fiche (Amperio)
      t(3, 40, 280, 'Protection de branchement (In)', 9),
      t(3, 40, 293, '63 A', 9),
      t(3, 40, 320, 'N° AMP-1677-RGIE · v1', 9),
      t(3, 40, 340, 'Type de chantier', 9),
      t(3, 40, 353, 'Nouvelle Installation', 9),
    ];
    const info = readPdfInfo(items);
    expect(info.installer).toEqual({ name: 'Jan Vandamme', address: { street: 'Vonkenstraat 25', postalCode: '1000', city: 'Brussel' } });
    expect(info.site?.address).toEqual({ street: 'Kerkstraat 123', postalCode: '9000', city: 'Gent' });
    expect(info.title).toBe('Demo');
    expect(info.client).toBeUndefined();
    expect(info.inspection).toBeUndefined();
    expect(info).toMatchObject({ mainCurrent: 63, date: '2026-11-26', docNumber: 'AMP-1677-RGIE', installationKind: 'new' });
    const p = emptyProject();
    const got = applyPdfInfo(p, info);
    expect(p.meta).toMatchObject({ title: 'Demo', mainCurrent: 63, date: '2026-11-26', docNumber: 'AMP-1677-RGIE', installationKind: 'new' });
    expect(p.meta.site).toMatchObject({ postalCode: '9000', city: 'Gent' });
    expect(p.meta.installer.name).toBe('Jan Vandamme');
    expect(got).toContain("adresse de l'installation");
  });

  it('liste du matériel : totaux (prises doubles comptées), sur plusieurs pages, et comparaison au schéma', () => {
    const items: PdfText[] = [
      t(6, 42, 700, 'Liste du matériel', 12),
      t(6, 46, 720, 'Quantité', 9),
      t(6, 118, 720, 'Description', 9),
      t(6, 66, 740, '150', 9),
      t(6, 88, 740, 'm', 9),
      t(6, 118, 740, 'Câble', 9),
      t(7, 46, 55, 'Quantité', 9),
      t(7, 118, 55, 'Description', 9),
      t(7, 76, 74, '3', 9),
      t(7, 118, 74, 'Point lumineux', 9),
      t(7, 76, 93, '2', 9),
      t(7, 118, 93, 'Prise double', 9),
      t(7, 76, 112, '1', 9),
      t(7, 118, 112, 'Prise de courant', 9),
      t(7, 76, 131, '2', 9),
      t(7, 118, 131, 'Interrupteur va-et-vient', 9),
    ];
    const bom = readBom(items)!;
    expect(bom).toEqual({ lights: 3, switches: 2, socketPoints: 3, outlets: 5 });
    const p = emptyProject();
    const cable = createNode('cable');
    cable.children = [createNode('light'), createNode('light'), createNode('light'), createNode('socket', { count: 2 }), createNode('socket'), createNode('socket')];
    p.roots[0].children[0].children[0].children[0].children.push(Object.assign(createNode('protection'), { children: [cable] }));
    const msg = checkBom(p, bom);
    expect(msg).toMatch(/socles en comptant les prises doubles/);
    expect(msg).toMatch(/2 interrupteur/);
    expect(readBom([t(1, 10, 10, 'Rien', 9)])).toBeNull();
  });
});
