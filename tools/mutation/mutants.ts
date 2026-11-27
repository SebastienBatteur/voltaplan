/** Mutants des règles de sécurité (voir run.ts). `find` doit apparaître exactement une fois dans `file`. */
export interface Mutant {
  id: string;
  file: string;
  find: string;
  replace: string;
  why: string;
}

const V = 'src/regulations/be/values.ts';
const R = 'src/rules/be/rgie.ts';

export const MUTANTS: Mutant[] = [
  { id: 'terre-100-vers-101', file: V, find: 'p(100, \'Ω\'', replace: 'p(101, \'Ω\'', why: 'seuil de 100 Ω (4.2.3.2)' },
  { id: 'terre-operateur', file: R, find: 're >= EARTH_MAX.value', replace: 're > EARTH_MAX.value', why: '100 Ω pile non conforme' },
  { id: 'terre-30-vers-35', file: V, find: 'p(30, \'Ω\'', replace: 'p(35, \'Ω\'', why: 'seuil de 30 Ω (4.2.4.3 b)' },
  { id: 'isolement-0,5-vers-0,4', file: V, find: 'p(0.5, \'MΩ\'', replace: 'p(0.4, \'MΩ\'', why: 'résistance d\'isolement minimale' },
  { id: 'tableau-4.11-2,5-fusible', file: V, find: '[2.5, 16, 20]', replace: '[2.5, 20, 20]', why: 'fusible 16 A sur 2,5 mm²' },
  { id: 'tableau-4.11-1,5-disjoncteur', file: V, find: '[1.5, 10, 16]', replace: '[1.5, 10, 20]', why: 'disjoncteur 16 A sur 1,5 mm²' },
  { id: 'tableau-4.11-6-disjoncteur', file: V, find: '[6, 32, 40]', replace: '[6, 32, 32]', why: 'disjoncteur 40 A sur 6 mm²' },
  { id: 'calibre-operateur', file: R, find: 'rating > max) add(\'R-CABLE-PROT\'', replace: 'rating >= max) add(\'R-CABLE-PROT\'', why: 'calibre égal au maximum admis' },
  { id: 'colonne-fusible-ignoree', file: R, find: "best = device === 'fuse' ? fuse : mcb;", replace: 'best = mcb;', why: 'colonne des fusibles' },
  { id: 'puissance-dediee-2600', file: V, find: 'p(2600, \'W\'', replace: 'p(3000, \'W\'', why: 'circuit dédié dès 2 600 W' },
  { id: 'socles-8-vers-9', file: V, find: 'p(8, \'points\'', replace: 'p(9, \'points\'', why: '8 socles par circuit' },
  { id: 'circuits-30mA-8-vers-9', file: V, find: 'p(8, \'circuits\'', replace: 'p(9, \'circuits\'', why: '8 circuits par 30 mA' },
  { id: 'differentiel-tete-40-vers-32', file: V, find: 'p(40, \'A\'', replace: 'p(32, \'A\'', why: 'différentiel de tête ≥ 40 A' },
  { id: 'differentiel-300-vers-500', file: V, find: 'p(300, \'mA\'', replace: 'p(500, \'mA\'', why: 'différentiel d\'origine ≤ 300 mA' },
  { id: 'differentiel-30-vers-100', file: V, find: 'p(30, \'mA\'', replace: 'p(100, \'mA\'', why: 'haute sensibilité ≤ 30 mA' },
  { id: 'type-AC-ignore', file: R, find: "if (node.props.rcdType === 'AC') {", replace: "if (node.props.rcdType === 'X') {", why: 'type A obligatoire' },
  { id: 'date-2023', file: V, find: "rcd30Extended: '2023-06-01'", replace: "rcd30Extended: '2024-06-01'", why: 'date des nouvelles règles 30 mA' },
  { id: 'section-prises-2,5', file: V, find: 'p(2.5, \'mm²\'', replace: 'p(1.5, \'mm²\'', why: '2,5 mm² dès qu\'il y a une prise' },
  { id: 'prise-sans-terre', file: R, find: 'if (node.props.earth === false) {', replace: 'if (node.props.earth === null) {', why: 'terre des socles' },
  { id: 'neutre-3x230', file: R, find: 'const noNeutral = /3\\s*[x×]\\s*230/i.test(meta_supply(project));', replace: 'const noNeutral = false;', why: 'réseau 3 × 230 V sans neutre' },
  { id: 'terre-30-operateur', file: R, find: 're > EARTH_EXTRA_MEASURES_ABOVE.value', replace: 're >= EARTH_EXTRA_MEASURES_ABOVE.value', why: '30 Ω pile : pas de mesures complémentaires' },
  { id: 'terre-30-deux-differentiels', file: R, find: 'hs.length >= 2 &&', replace: 'hs.length >= 1 &&', why: 'au moins deux différentiels haute sensibilité au-delà de 30 Ω' },
  { id: 'terre-30-16-socles', file: R, find: 'maxSockets <= EARTH_EXTRA_SOCKETS_PER_RCD.value', replace: 'maxSockets <= EARTH_EXTRA_SOCKETS_PER_RCD.value + 1', why: '16 socles par différentiel au-delà de 30 Ω' },
  { id: 'terre-30-100mA', file: R, find: 'without100 === 0', replace: 'without100 <= 1', why: '100 mA pour les autres circuits au-delà de 30 Ω' },
  { id: 'isolement-operateur', file: R, find: 'iso < INSULATION_MIN.value', replace: 'iso <= INSULATION_MIN.value', why: '0,5 MΩ pile conforme' },
  { id: 'differentiel-tete-operateur', file: R, find: 'rating < RCD_HEAD_MIN_RATING.value', replace: 'rating <= RCD_HEAD_MIN_RATING.value', why: '40 A pile conforme' },
  { id: 'socles-operateur', file: R, find: 'count > SOCKETS_PER_CIRCUIT_MAX.value', replace: 'count >= SOCKETS_PER_CIRCUIT_MAX.value', why: '8 socles pile conforme' },
  { id: 'circuits-30mA-operateur', file: R, find: 'count <= CIRCUITS_PER_RCD30_MAX.value', replace: 'count < CIRCUITS_PER_RCD30_MAX.value', why: '8 circuits pile conforme' },
  { id: 'puissance-dediee-operateur', file: R, find: 'w >= DEDICATED_POWER_W', replace: 'w > DEDICATED_POWER_W', why: '2 600 W pile : circuit dédié' },
  { id: 'section-min-commande', file: R, find: 'section < SECTION_MIN_NO_SOCKET.value', replace: 'section < 1', why: '1,5 mm² minimum sans prise' },
  { id: 'selectivite-operateur', file: R, find: 'rc >= up', replace: 'rc > up', why: 'sensibilités égales : pas de sélectivité' },
  { id: 'date-1991', file: V, find: "rcdHead40aFrom: '1991-09-16'", replace: "rcdHead40aFrom: '1992-09-16'", why: 'dérogation du différentiel de tête (8.2.2)' },
  { id: 'date-1981', file: V, find: "pre1981Until: '1981-10-01'", replace: "pre1981Until: '1982-10-01'", why: 'parties anciennes (8.2.1)' },
  { id: 'date-2025', file: V, find: "rgie2025: '2025-03-01'", replace: "rgie2025: '2026-03-01'", why: 'socles IPXX-D (5.3.5.2)' },
];
