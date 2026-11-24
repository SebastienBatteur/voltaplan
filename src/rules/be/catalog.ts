/**
 * Catalogue des règles belges (RGIE / AREI) : éditions datées et traçabilité de chaque règle.
 *
 * Sources :
 *  - RGIE Livre 1 (installations à basse et très basse tension) : arrêté royal du 8 septembre 2019,
 *    en vigueur depuis le 1er juin 2020 (texte officiel : Moniteur belge, SPF Économie) ; modifications
 *    en vigueur le 1er juin 2023.
 *  - Ancien RGIE : arrêté royal du 10 mars 1981 (installations domestiques), remplacé le 1er juin 2020.
 *  - Installations antérieures au 1er octobre 1981 : « parties anciennes », régime propre aux installations existantes.
 *
 * Les numéros d'articles ne sont indiqués que lorsqu'ils ont été vérifiés dans le texte officiel. Toutes les règles
 * sont pour l'instant marquées `needsReview` : leur interprétation (seuils, applicabilité aux installations
 * existantes, gravité) doit être confirmée par un expert (organisme agréé). Voir docs/audit/REGULATORY-COVERAGE.md.
 * La gravité (`hazard`) est une appréciation de Voltaplan, pas une classification du RGIE.
 */
import type { Edition, RuleMeta } from '../types';

const LIVRE1 = 'RGIE Livre 1 — AR du 8 septembre 2019 (SPF Économie)';

export const BE_EDITIONS: Edition[] = [
  {
    id: 'pre1981',
    until: '1981-10-01',
    label: { fr: 'Partie ancienne (avant le 1/10/1981)', nl: 'Oud gedeelte (vóór 1/10/1981)', en: 'Old part (before 1/10/1981)', de: 'Altteil (vor dem 1.10.1981)' },
  },
  {
    id: '1981',
    from: '1981-10-01',
    until: '2020-06-01',
    legal: 'AR du 10 mars 1981',
    label: { fr: 'Ancien RGIE (1981–2020)', nl: 'Oud AREI (1981–2020)', en: 'Former RGIE (1981–2020)', de: 'Alte AREI (1981–2020)' },
  },
  {
    id: '2020',
    from: '2020-06-01',
    legal: 'AR du 8 septembre 2019 (Livre 1)',
    amendments: [{ date: '2023-06-01', note: 'Modifications du Livre 1' }],
    label: { fr: 'RGIE Livre 1 (depuis le 1/6/2020)', nl: 'AREI Boek 1 (sinds 1/6/2020)', en: 'RGIE Book 1 (since 1/6/2020)', de: 'AREI Buch 1 (seit 1.6.2020)' },
  },
];

const r = (id: string, m: Omit<RuleMeta, 'id' | 'source' | 'needsReview'> & { source?: string }): RuleMeta => ({
  id,
  source: LIVRE1,
  needsReview: true,
  tests: 'test/rules.matrix.test.ts',
  ...m,
});

export const BE_RULES: Record<string, RuleMeta> = Object.fromEntries(
  [
    r('R-RULESET-UNKNOWN', { kind: 'nonCompliance', hazard: 'none', existing: 'nonCompliant', source: undefined }),
    r('R-OLD-RGIE', { kind: 'info', hazard: 'none' }),
    r('R-INSTALL-DATE', { kind: 'manualCheck', hazard: 'none' }),
    // Documents
    r('R-DOC-INSTALLER', { kind: 'missingData', hazard: 'none' }),
    r('R-DOC-ADDRESS', { kind: 'missingData', hazard: 'none' }),
    r('R-DOC-SUPPLY', { kind: 'missingData', hazard: 'none' }),
    // Terre, isolement, liaisons, essais
    r('R-EARTH-MISSING', { kind: 'nonCompliance', hazard: 'high' }),
    r('R-EARTH-VALUE', { kind: 'nonCompliance', hazard: 'high' }),
    r('R-EARTH-30', { kind: 'warning', hazard: 'medium' }),
    r('R-INSULATION', { kind: 'nonCompliance', hazard: 'high' }),
    r('R-BONDING', { kind: 'nonCompliance', hazard: 'high' }),
    r('R-RCD-TEST', { kind: 'nonCompliance', hazard: 'high' }),
    r('R-RCD-TRIP', { kind: 'nonCompliance', hazard: 'high' }),
    r('R-MEAS-MISSING', { kind: 'manualCheck', hazard: 'none' }),
    // Protections
    r('R-PROT-RATING-MISSING', { kind: 'missingData', hazard: 'medium' }),
    r('R-POLES-NO-NEUTRAL', { kind: 'nonCompliance', hazard: 'high' }),
    r('R-PROT-KA-MISSING', { kind: 'missingData', hazard: 'low', neverBlocking: true }),
    r('R-RCD-SENS-MISSING', { kind: 'missingData', hazard: 'medium' }),
    r('R-RCD-SELECTIVITY', { kind: 'warning', hazard: 'low' }),
    r('R-RCD-MAIN', { kind: 'nonCompliance', hazard: 'high' }),
    r('R-RCD30', { kind: 'nonCompliance', hazard: 'high' }),
    r('R-RCD-TYPE-A', { kind: 'nonCompliance', hazard: 'medium', existing: 'recommendation' }),
    // Canalisations
    r('R-CABLE-SECTION-MISSING', { kind: 'missingData', hazard: 'medium' }),
    r('R-CABLE-DATA-MISSING', { kind: 'missingData', hazard: 'medium' }),
    r('R-CABLE-MIN', { kind: 'nonCompliance', hazard: 'high' }),
    r('R-CABLE-PROT', { kind: 'nonCompliance', hazard: 'high' }),
    r('R-CABLE-NO-OVERCURRENT', { kind: 'nonCompliance', hazard: 'high' }),
    // Prises et circuits
    r('R-SOCKET-EARTH', { kind: 'nonCompliance', hazard: 'high' }),
    r('R-SOCKET-CHILD', { kind: 'nonCompliance', hazard: 'medium', existing: 'recommendation' }),
    r('R-SOCKET-MAX', { kind: 'nonCompliance', hazard: 'low', existing: 'recommendation' }),
    r('R-SOCKET-SECTION', { kind: 'nonCompliance', hazard: 'medium' }),
    r('R-DEDICATED-CIRCUIT', { kind: 'nonCompliance', hazard: 'low', existing: 'recommendation' }),
    r('R-CIRCUIT-NAME', { kind: 'recommendation', hazard: 'none' }),
    r('R-WETROOM-NAME', { kind: 'manualCheck', hazard: 'high' }),
    // Installations particulières : vérification manuelle (règles non encore automatisées)
    r('R-EV-MANUAL', { kind: 'manualCheck', hazard: 'medium' }),
    r('R-PV-MANUAL', { kind: 'manualCheck', hazard: 'medium' }),
    // Calculs (méthode conventionnelle : estimation)
    r('R-VDROP', { kind: 'warning', hazard: 'low' }),
    r('R-VDROP-RATING', { kind: 'recommendation', hazard: 'low' }),
    r('R-ICC-LMAX', { kind: 'warning', hazard: 'high' }),
    r('R-COUNTRY-OPTION', { kind: 'warning', hazard: 'none' }),
  ].map((m) => [m.id, m]),
);
