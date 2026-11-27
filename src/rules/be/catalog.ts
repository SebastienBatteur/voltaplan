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
 * Les références vérifiées, la nature de chaque exigence, ses tests et son statut de validation sont dans le registre
 * (src/regulations/be/requirements.ts, ADR-0009), pas ici. Toutes les règles sont marquées `needsReview` : leur
 * interprétation doit être confirmée par un spécialiste (aucune validation humaine à ce jour).
 * La gravité (`hazard`) est une appréciation de Voltaplan, pas une classification du RGIE.
 */
import type { Edition, RuleMeta } from '../types';
import { DATES } from '../../regulations/be/values';

const LIVRE1 = 'RGIE Livre 1 — AR du 8 septembre 2019 (SPF Économie)';

export const BE_EDITIONS: Edition[] = [
  {
    id: 'pre1981',
    until: DATES.value.pre1981Until,
    label: { fr: 'Partie ancienne (avant le 1/10/1981)', nl: 'Oud gedeelte (vóór 1/10/1981)', en: 'Old part (before 1/10/1981)', de: 'Altteil (vor dem 1.10.1981)' },
  },
  {
    id: '1981',
    from: DATES.value.pre1981Until,
    until: '2020-06-01',
    legal: 'AR du 10 mars 1981',
    label: { fr: 'Ancien RGIE (1981–2020)', nl: 'Oud AREI (1981–2020)', en: 'Former RGIE (1981–2020)', de: 'Alte AREI (1981–2020)' },
  },
  {
    id: '2020',
    from: '2020-06-01',
    legal: 'AR du 8 septembre 2019 (Livre 1)',
    amendments: [
      { date: DATES.value.rcd30Extended, note: 'Modifications du Livre 1 (30 mA, 8 circuits)' },
      { date: DATES.value.rgie2025, note: 'Modifications du Livre 1 (socles IPXX-D, salles de bain)' },
      { date: DATES.value.v07, note: 'Version 07 du Livre 1 (15/09/2026)' },
    ],
    label: { fr: 'RGIE Livre 1 (depuis le 1/6/2020)', nl: 'AREI Boek 1 (sinds 1/6/2020)', en: 'RGIE Book 1 (since 1/6/2020)', de: 'AREI Buch 1 (seit 1.6.2020)' },
  },
];

const r = (id: string, m: Omit<RuleMeta, 'id' | 'source' | 'needsReview'> & { source?: string }): RuleMeta => ({
  id,
  source: LIVRE1,
  needsReview: true,
  ...m,
});

/** Exigence documentaire (dossier, schéma, données à renseigner) : jamais une non-conformité de l'installation. */
const DOC = { requirement: 'documentary' as const };
/** Exigence physique (installation elle-même). */
const PHY = { requirement: 'physical' as const };

/**
 * Catalogue. `requirement` : exigence documentaire ou physique (ADR-0007). Le comportement de chaque règle quand
 * l'information est inconnue, déduite ou contradictoire est décrit dans docs/audit/REGULATORY-COVERAGE.md.
 */
export const BE_RULES: Record<string, RuleMeta> = Object.fromEntries(
  [
    r('R-RULESET-UNKNOWN', { kind: 'nonCompliance', hazard: 'none', existing: 'nonCompliant', source: undefined, ...PHY }),
    r('R-OLD-RGIE', { kind: 'info', hazard: 'none', ...DOC }),
    r('R-INSTALL-DATE', { kind: 'manualCheck', hazard: 'none', ...DOC }),
    // Documents
    r('R-DOC-INSTALLER', { kind: 'missingData', hazard: 'none', ...DOC }),
    r('R-DOC-ADDRESS', { kind: 'missingData', hazard: 'none', ...DOC }),
    r('R-DOC-SUPPLY', { kind: 'missingData', hazard: 'none', ...DOC }),
    // RGIE 3.1.2 et 3.1.2.1 : numéro du dossier ; qualité du responsable de l'exécution des travaux
    r('R-DOC-NUMBER', { kind: 'missingData', hazard: 'none', ...DOC }),
    r('R-DOC-QUALITY', { kind: 'missingData', hazard: 'none', ...DOC }),
    // Équipement confirmé présent sur place mais non dessiné : schéma incomplet, pas une non-conformité physique
    r('R-DOC-NOT-DRAWN', { kind: 'missingData', hazard: 'none', ...DOC }),
    // Terre, isolement, liaisons, essais
    r('R-EARTH-MISSING', { kind: 'nonCompliance', hazard: 'high', ...PHY }),
    r('R-EARTH-VALUE', { kind: 'nonCompliance', hazard: 'high', ...PHY }),
    r('R-EARTH-30', { kind: 'nonCompliance', hazard: 'medium', ...PHY }),
    r('R-INSULATION', { kind: 'nonCompliance', hazard: 'high', ...PHY }),
    r('R-BONDING', { kind: 'nonCompliance', hazard: 'high', ...PHY }),
    r('R-RCD-TEST', { kind: 'nonCompliance', hazard: 'high', ...PHY }),
    r('R-RCD-TRIP', { kind: 'nonCompliance', hazard: 'high', ...PHY }),
    r('R-MEAS-MISSING', { kind: 'manualCheck', hazard: 'none', ...PHY }),
    // Protections. Valeur non renseignée : le schéma est incomplet (documentaire) ; les règles physiques qui en
    // dépendent signalent, elles, une vérification nécessaire (R-RCD-MAIN, R-RCD30, R-CABLE-PROT en relevé).
    r('R-PROT-RATING-MISSING', { kind: 'missingData', hazard: 'medium', ...DOC }),
    r('R-POLES-NO-NEUTRAL', { kind: 'nonCompliance', hazard: 'high', ...PHY }),
    r('R-PROT-KA-MISSING', { kind: 'missingData', hazard: 'low', neverBlocking: true, ...DOC }),
    r('R-RCD-SENS-MISSING', { kind: 'missingData', hazard: 'medium', ...DOC }),
    r('R-RCD-SELECTIVITY', { kind: 'warning', hazard: 'low', ...PHY }),
    r('R-RCD-MAIN', { kind: 'nonCompliance', hazard: 'high', ...PHY }),
    r('R-RCD30', { kind: 'nonCompliance', hazard: 'high', ...PHY }),
    r('R-RCD30-MAX', { kind: 'nonCompliance', hazard: 'medium', ...PHY }),
    r('R-RCD30-DATE', { kind: 'missingData', hazard: 'high', ...PHY }),
    r('R-RCD-TYPE-A', { kind: 'nonCompliance', hazard: 'medium', ...PHY }),
    r('R-CABLE-IZ', { kind: 'manualCheck', hazard: 'medium', ...PHY }),
    r('R-RCD-HEAD-RATING', { kind: 'nonCompliance', hazard: 'medium', ...PHY }),
    // Canalisations
    r('R-CABLE-SECTION-MISSING', { kind: 'missingData', hazard: 'medium', ...DOC }),
    r('R-CABLE-DATA-MISSING', { kind: 'missingData', hazard: 'medium', ...DOC }),
    r('R-CABLE-MIN', { kind: 'nonCompliance', hazard: 'high', ...PHY }),
    r('R-CABLE-PROT', { kind: 'nonCompliance', hazard: 'high', ...PHY }),
    r('R-CABLE-NO-OVERCURRENT', { kind: 'nonCompliance', hazard: 'high', ...PHY }),
    // Prises et circuits
    r('R-SOCKET-EARTH', { kind: 'nonCompliance', hazard: 'high', ...PHY }),
    // Exigence antérieure au 1/3/2025 dont le contenu n'a pas été retrouvé dans le texte de 2026 : à vérifier, jamais une
    // non-conformité certaine (audit 2026).
    r('R-SOCKET-CHILD', { kind: 'manualCheck', hazard: 'medium', ...PHY }),
    r('R-SOCKET-IPXXD', { kind: 'nonCompliance', hazard: 'medium', ...PHY }),
    r('R-SOCKET-MAX', { kind: 'nonCompliance', hazard: 'low', ...PHY }),
    r('R-SOCKET-SECTION', { kind: 'nonCompliance', hazard: 'medium', ...PHY }),
    r('R-DEDICATED-CIRCUIT', { kind: 'nonCompliance', hazard: 'low', ...PHY }),
    r('R-CIRCUIT-NAME', { kind: 'recommendation', hazard: 'none', ...DOC }),
    r('R-WETROOM-NAME', { kind: 'manualCheck', hazard: 'high', ...PHY }),
    // Installations particulières : vérification manuelle (règles non encore automatisées)
    r('R-EV-MANUAL', { kind: 'manualCheck', hazard: 'medium', ...PHY }),
    r('R-PV-MANUAL', { kind: 'manualCheck', hazard: 'medium', ...PHY }),
    // Calculs (méthode conventionnelle : estimation)
    r('R-VDROP', { kind: 'warning', hazard: 'low', ...PHY }),
    r('R-VDROP-RATING', { kind: 'recommendation', hazard: 'low', ...PHY }),
    r('R-ICC-LMAX', { kind: 'warning', hazard: 'high', ...PHY }),
    r('R-COUNTRY-OPTION', { kind: 'warning', hazard: 'none', ...DOC }),
  ].map((m) => [m.id, m]),
);
