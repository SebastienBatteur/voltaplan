/** Étiquette QR du coffret : lien du dossier (https) ou texte hors ligne ; QR encodé en UTF-8. */
import { describe, expect, it } from 'vitest';
import qrcode from 'qrcode-generator';
import { isHttpsUrl, qrLabelPayload } from '../src/print/qrLabel';
import { emptyProject } from '../src/model/tree';
import { translate } from '../src/i18n';

const t = (k: string, p?: Record<string, string | number>) => translate('fr', k, p);

describe('étiquette QR du coffret', () => {
  it('lien https du dossier si renseigné, sinon texte lisible hors ligne', () => {
    const m = emptyProject().meta;
    m.docNumber = '2026-014';
    m.site = { street: 'Rue des Lilas', number: '5', postalCode: '7500', city: 'Tournai' };
    m.installer = { name: 'Élec SRL', phone: '0470 00 00 00', address: {} };
    const text = qrLabelPayload(m, t);
    expect(text).toContain('2026-014');
    expect(text).toContain('Rue des Lilas 5, 7500 Tournai');
    expect(text).toContain('Élec SRL — 0470 00 00 00');
    m.dossierUrl = 'https://drive.google.com/file/d/abc/view';
    expect(qrLabelPayload(m, t)).toBe('https://drive.google.com/file/d/abc/view');
    m.dossierUrl = 'javascript:alert(1)';
    expect(qrLabelPayload(m, t)).toContain('2026-014');
    expect(isHttpsUrl('http://exemple.be')).toBe(false);
  });

  it('accents encodés en UTF-8 (2 octets pour « É »)', () => {
    const bytes = new TextEncoder().encode('É');
    expect(bytes.length).toBe(2);
    const q = qrcode(0, 'L');
    q.addData(String.fromCharCode(...bytes), 'Byte');
    q.make();
    expect(q.getModuleCount()).toBeGreaterThan(0);
  });
});
