import type { OfficialSource } from '../types';

/** Texte officiel de référence du registre belge. */
export const RGIE_L1_V07: OfficialSource = {
  id: 'RGIE-L1-v07',
  title: 'RGIE — Livre 1 : installations à basse tension et à très basse tension',
  version: '07',
  publishedOn: '2026-09-15',
  appliesFrom: '2026-11-01',
  legal: 'Arrêté royal du 13/08/2026 (réf. C-2026/006432), SPF Économie',
  url: 'https://economie.fgov.be/sites/default/files/Files/Publications/files/RGIE-Annexe-Livre-1-Installations-a-basse-tenstion-et-a-tres-basse-tension-2026.pdf',
};

export const SOURCES: Record<string, OfficialSource> = { [RGIE_L1_V07.id]: RGIE_L1_V07 };

/** Date de la dernière révision documentaire du registre (relecture du texte officiel). */
export const REGISTRY_REVIEWED_ON = '2026-11-27';
