import type { NodeKind, PropValue } from './types';

/** Description d'une propriété éditable (sert au panneau de propriétés et aux règles). */
export interface PropDef {
  key: string;
  type: 'text' | 'number' | 'bool' | 'enum';
  /** Valeurs possibles pour 'enum' (les libellés sont traduits via `enum.<key>.<value>`). */
  options?: string[];
  unit?: string;
  default?: PropValue;
}

/** Local avec baignoire ou douche : non précisé (''), oui, non. */
export const WET_ROOM_OPTIONS = ['', 'yes', 'no'];

export const PROTECTION_DEVICES = ['mcb', 'rcd', 'rcbo', 'fuse', 'switch'] as const;
export const POLES = ['1P', '1P+N', '2P', '3P', '3P+N', '4P'] as const;
export const CABLE_TYPES = ['VOB', 'XVB', 'EXVB', 'VFVB', 'XGB', 'CRVB', 'XFVB', 'H07V-U', 'H07V-K', 'other'] as const;
export const INSTALL_METHODS = ['inWall', 'onWall', 'underground', 'air', 'parallel'] as const;
export const SWITCH_TYPES = ['single', 'double', 'twoWay', 'intermediate', 'dimmer', 'bipolar', 'shutter', 'pullCord'] as const;
export const LIGHT_TYPES = ['standard', 'led', 'fluo', 'spot', 'wall', 'emergency'] as const;
export const APPLIANCE_TYPES = [
  'oven',
  'cooker',
  'hob',
  'microwave',
  'fridge',
  'freezer',
  'dishwasher',
  'washingMachine',
  'dryer',
  'waterHeater',
  'heatPump',
  'boiler',
  'evCharger',
  'fan',
  'heater',
  'other',
] as const;

/** Appareils qui, selon le RGIE, doivent avoir leur propre circuit (installation domestique). */
export const DEDICATED_CIRCUIT_APPLIANCES = new Set<string>([
  'oven',
  'cooker',
  'hob',
  'washingMachine',
  'dryer',
  'dishwasher',
  'waterHeater',
  'heatPump',
  'boiler',
  'evCharger',
]);

/** Appareils pour lesquels un différentiel 30 mA est requis (appareils dans des locaux humides / avec eau). */
export const RCD30_APPLIANCES = new Set<string>(['washingMachine', 'dryer', 'dishwasher']);

export const PROP_SCHEMAS: Partial<Record<NodeKind, PropDef[]>> = {
  protection: [
    { key: 'device', type: 'enum', options: [...PROTECTION_DEVICES], default: 'mcb' },
    { key: 'circuitName', type: 'text' },
    { key: 'fixedLetter', type: 'text' },
    { key: 'ratedCurrent', type: 'number', unit: 'A', default: 20 },
    { key: 'poles', type: 'enum', options: [...POLES], default: '1P+N' },
    { key: 'curve', type: 'enum', options: ['B', 'C', 'D'], default: 'C' },
    { key: 'breakingCapacity', type: 'number', unit: 'kA', default: 3 },
    { key: 'residualCurrent', type: 'number', unit: 'mA' },
    { key: 'rcdType', type: 'enum', options: ['AC', 'A', 'F', 'B'] },
    { key: 'phase', type: 'enum', options: ['', 'L1', 'L2', 'L3'] },
    { key: 'modules', type: 'number', unit: 'mod' },
    { key: 'oldPart', type: 'bool' },
    { key: 'installedOn', type: 'text' },
    { key: 'installationKind', type: 'enum', options: ['', 'new', 'existing'] },
    { key: 'wetRoom', type: 'enum', options: WET_ROOM_OPTIONS },
    { key: 'series', type: 'bool' },
    { key: 'reference', type: 'text' },
  ],
  board: [
    { key: 'name', type: 'text' },
    { key: 'fixedLetter', type: 'text' },
    { key: 'rows', type: 'number', default: 2 },
    { key: 'modulesPerRow', type: 'number', default: 13 },
    { key: 'installedOn', type: 'text' },
    { key: 'installationKind', type: 'enum', options: ['', 'new', 'existing'] },
    { key: 'reference', type: 'text' },
  ],
  meter: [
    { key: 'name', type: 'text' },
    { key: 'ean', type: 'text' },
    { key: 'inBoard', type: 'bool', default: true },
    { key: 'modules', type: 'number', unit: 'mod' },
    { key: 'reference', type: 'text' },
  ],
  cable: [
    { key: 'cableType', type: 'enum', options: [...CABLE_TYPES], default: 'VOB' },
    { key: 'section', type: 'number', unit: 'mm²', default: 2.5 },
    { key: 'conductors', type: 'number', default: 3 },
    { key: 'inConduit', type: 'bool', default: true },
    { key: 'method', type: 'enum', options: [...INSTALL_METHODS], default: 'inWall' },
    { key: 'length', type: 'number', unit: 'm' },
    { key: 'reference', type: 'text' },
  ],
  socket: [
    { key: 'count', type: 'number', default: 1 },
    { key: 'earth', type: 'bool', default: true },
    { key: 'childSafety', type: 'bool', default: true },
    { key: 'splashProof', type: 'bool', default: false },
    { key: 'threePhase', type: 'bool', default: false },
    { key: 'wetRoom', type: 'enum', options: WET_ROOM_OPTIONS },
    { key: 'reference', type: 'text' },
  ],
  switch: [
    { key: 'switchType', type: 'enum', options: [...SWITCH_TYPES], default: 'single' },
    { key: 'pilotLight', type: 'bool', default: false },
    { key: 'wetRoom', type: 'enum', options: WET_ROOM_OPTIONS },
    { key: 'signalLamp', type: 'bool' },
    { key: 'splashProof', type: 'bool', default: false },
    { key: 'reference', type: 'text' },
  ],
  light: [
    { key: 'lightType', type: 'enum', options: [...LIGHT_TYPES], default: 'standard' },
    { key: 'count', type: 'number', default: 1 },
    { key: 'splashProof', type: 'bool', default: false },
    { key: 'wetRoom', type: 'enum', options: WET_ROOM_OPTIONS },
    { key: 'reference', type: 'text' },
  ],
  appliance: [
    { key: 'applianceType', type: 'enum', options: [...APPLIANCE_TYPES], default: 'other' },
    { key: 'power', type: 'number', unit: 'W' },
    { key: 'wetRoom', type: 'enum', options: WET_ROOM_OPTIONS },
  ],
  domotic: [
    { key: 'name', type: 'text' },
    { key: 'inBoard', type: 'bool', default: false },
    { key: 'modules', type: 'number', unit: 'mod' },
    { key: 'reference', type: 'text' },
  ],
  solarPanel: [
    { key: 'count', type: 'number' },
    { key: 'name', type: 'text' },
  ],
  inverter: [{ key: 'power', type: 'number', unit: 'W' }],
  motor: [{ key: 'power', type: 'number', unit: 'W' }],
  relay: [
    { key: 'relayType', type: 'enum', options: ['relay', 'teleswitch', 'contactor', 'timer'], default: 'relay' },
    { key: 'inBoard', type: 'bool', default: true },
    { key: 'modules', type: 'number', unit: 'mod' },
    { key: 'reference', type: 'text' },
  ],
  transformer: [
    { key: 'safety', type: 'bool', default: true },
    { key: 'inBoard', type: 'bool', default: false },
    { key: 'modules', type: 'number', unit: 'mod' },
    { key: 'reference', type: 'text' },
  ],
  other: [
    { key: 'name', type: 'text' },
    { key: 'inBoard', type: 'bool', default: false },
    { key: 'modules', type: 'number', unit: 'mod' },
    { key: 'reference', type: 'text' },
  ],
};

/** Quels types de nœuds peuvent être ajoutés comme enfants de quel parent. */
export const ALLOWED_CHILDREN: Record<NodeKind, NodeKind[]> = {
  origin: ['protection', 'meter', 'cable', 'board'],
  meter: ['protection', 'cable', 'board'],
  protection: ['cable', 'board', 'protection'],
  board: ['protection', 'earthBar', 'board'],
  cable: [
    'socket', 'switch', 'pushButton', 'light', 'appliance', 'junctionBox', 'relay', 'transformer',
    'domotic', 'motor', 'solarPanel', 'inverter', 'bell', 'detector', 'board', 'cable', 'other',
  ],
  socket: ['appliance', 'cable'],
  switch: ['light', 'cable', 'switch', 'appliance', 'motor', 'relay'],
  pushButton: ['relay', 'bell', 'cable'],
  light: ['appliance', 'cable', 'light'],
  appliance: ['cable'],
  earthBar: ['earth'],
  earth: [],
  junctionBox: ['cable', 'socket', 'light', 'switch', 'appliance'],
  relay: ['light', 'cable', 'transformer', 'domotic', 'appliance', 'motor'],
  transformer: ['domotic', 'light', 'bell', 'cable'],
  domotic: ['light', 'cable', 'appliance', 'motor'],
  motor: ['cable'],
  solarPanel: ['cable', 'solarPanel'],
  inverter: ['cable', 'solarPanel'],
  bell: [],
  detector: ['light', 'cable'],
  other: ['cable', 'other'],
};

export function defaultProps(kind: NodeKind): Record<string, PropValue> {
  const out: Record<string, PropValue> = {};
  for (const d of PROP_SCHEMAS[kind] ?? []) if (d.default !== undefined) out[d.key] = d.default;
  return out;
}
