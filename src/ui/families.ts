import type { NodeKind } from '../model/types';

/**
 * Éléments de l'unifilaire regroupés en grandes familles (palette « Éléments », ajout depuis le plan).
 * L'origine n'y est pas : il n'y en a qu'une par installation.
 */
export const FAMILIES: { key: string; kinds: NodeKind[] }[] = [
  { key: 'distribution', kinds: ['protection', 'board', 'meter', 'earthBar', 'earth'] },
  { key: 'wiring', kinds: ['cable', 'junctionBox'] },
  { key: 'lighting', kinds: ['light'] },
  { key: 'outlets', kinds: ['socket', 'appliance', 'motor'] },
  { key: 'controls', kinds: ['switch', 'pushButton', 'relay', 'detector'] },
  { key: 'other', kinds: ['domotic', 'transformer', 'bell', 'solarPanel', 'inverter', 'other'] },
];

/** Éléments qui ont un symbole sur le plan de position (tableau 2.23). */
export const PLACEABLE = new Set<NodeKind>([
  'board',
  'socket',
  'switch',
  'pushButton',
  'light',
  'appliance',
  'junctionBox',
  'relay',
  'transformer',
  'domotic',
  'motor',
  'solarPanel',
  'inverter',
  'bell',
  'detector',
  'other',
  'meter',
  'earthBar',
]);
