/**
 * Contenu du QR code de l'étiquette du coffret, sans serveur Voltaplan :
 *  - le lien vers le dossier PDF partagé par l'installateur depuis son propre cloud, s'il est renseigné (https) ;
 *  - sinon un court texte lisible hors ligne par n'importe quel lecteur de QR code : dossier, adresse, installateur,
 *    téléphone.
 */
import type { ProjectMeta } from '../model/types';

type T = (k: string, p?: Record<string, string | number>) => string;

export function isHttpsUrl(s: string | undefined): s is string {
  if (!s) return false;
  try {
    return new URL(s.trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

const addr = (a: ProjectMeta['site']) =>
  [[a?.street, a?.number].filter(Boolean).join(' '), [a?.postalCode, a?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');

export function qrLabelPayload(meta: ProjectMeta, t: T): string {
  if (isHttpsUrl(meta.dossierUrl)) return meta.dossierUrl!.trim();
  const lines = [
    t('qr.textTitle', { n: meta.docNumber?.trim() || '—' }),
    addr(meta.site),
    [meta.installer?.name, meta.installer?.phone].filter(Boolean).join(' — '),
    meta.installer?.email,
  ];
  return lines.filter((l) => l && l.trim()).join('\n');
}
