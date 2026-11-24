/**
 * Interprétation déterministe d'une étiquette de tableau (« PRISES CUISINE », « Verlichting living », « LL ») :
 * usage probable du circuit et pièce. Aucune IA : mots-clés FR, NL, EN, testés. Ce qui n'est pas reconnu reste
 * inconnu (une question sera posée), jamais deviné.
 */

export type Usage =
  | { kind: 'socket' }
  | { kind: 'light' }
  | { kind: 'appliance'; applianceType: string }
  | { kind: 'bell' }
  | { kind: 'motor' }
  | { kind: 'board' };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Mots-clés → usage. Ordre important : le plus spécifique d'abord. */
const USAGES: [RegExp, Usage][] = [
  [/\b(borne|recharge|laadpaal|laadpunt|wallbox|ev)\b/, { kind: 'appliance', applianceType: 'evCharger' }],
  [/\b(pac|pompe a chaleur|warmtepomp|heat ?pump)\b/, { kind: 'appliance', applianceType: 'heatPump' }],
  [/\b(lave ?linge|machine a laver|ll|wasmachine|washing)\b/, { kind: 'appliance', applianceType: 'washingMachine' }],
  [/\b(seche ?linge|sl|droogkast|droger|dryer)\b/, { kind: 'appliance', applianceType: 'dryer' }],
  [/\b(lave ?vaisselle|lv|vaatwas|vaatwasser|dishwasher)\b/, { kind: 'appliance', applianceType: 'dishwasher' }],
  [/\b(taque|plaque|induction|kookplaat|kookvuur|hob)\b/, { kind: 'appliance', applianceType: 'hob' }],
  [/\b(cuisiniere|fornuis|cooker)\b/, { kind: 'appliance', applianceType: 'cooker' }],
  [/\b(four|oven)\b/, { kind: 'appliance', applianceType: 'oven' }],
  [/\b(micro ?ondes?|microgolf|microwave)\b/, { kind: 'appliance', applianceType: 'microwave' }],
  [/\b(congelateur|surgelateur|diepvries|freezer)\b/, { kind: 'appliance', applianceType: 'freezer' }],
  [/\b(frigo|refrigerateur|koelkast|frigo|fridge)\b/, { kind: 'appliance', applianceType: 'fridge' }],
  [/\b(chauffe ?eau|boiler|ballon)\b/, { kind: 'appliance', applianceType: 'waterHeater' }],
  [/\b(chaudiere|chauffage central|ketel|cv)\b/, { kind: 'appliance', applianceType: 'boiler' }],
  [/\b(chauffage|radiateur|convecteur|verwarming|heater)\b/, { kind: 'appliance', applianceType: 'heater' }],
  [/\b(ventilation|vmc|ventilatie|extracteur|hotte|dampkap|fan)\b/, { kind: 'appliance', applianceType: 'fan' }],
  [/\b(volets?|rolluiken?|screens?|store|poort|porte de garage|garagepoort)\b/, { kind: 'motor' }],
  [/\b(sonnette|carillon|bel|deurbel|bell)\b/, { kind: 'bell' }],
  [/\b(sous ?tableau|tableau|tab|ondertableau|onderverdeelbord|verdeelbord|board)\b/, { kind: 'board' }],
  [/\b(eclairage|ecl|lumiere|lumieres|lampes?|lum|verlichting|licht|lichten|lights?|lighting)\b/, { kind: 'light' }],
  [/\b(prises?|pc|pcs|stopcontacten|stopcontact|stopc|sockets?|outlets?)\b/, { kind: 'socket' }],
];

const ROOMS: [RegExp, string][] = [
  [/\b(salle de bains?|sdb|badkamer|bathroom)\b/, 'Salle de bain'],
  [/\b(cuisine|keuken|kitchen)\b/, 'Cuisine'],
  [/\b(salon|sejour|living|woonkamer|living room)\b/, 'Salon'],
  [/\b(salle a manger|eetkamer|dining)\b/, 'Salle à manger'],
  [/\b(chambre|ch|slaapkamer|slpk|bedroom)\s*(\d)?/, 'Chambre'],
  [/\b(buanderie|wasplaats|washok|laundry)\b/, 'Buanderie'],
  [/\b(garage)\b/, 'Garage'],
  [/\b(cave|kelder|cellar|basement)\b/, 'Cave'],
  [/\b(grenier|combles|zolder|attic)\b/, 'Grenier'],
  [/\b(bureau|office)\b/, 'Bureau'],
  [/\b(hall|couloir|entree|gang|inkom|hallway)\b/, 'Hall'],
  [/\b(wc|toilettes?|toilet)\b/, 'WC'],
  [/\b(jardin|exterieur|terrasse|tuin|buiten|outdoor|garden)\b/, 'Extérieur'],
  [/\b(escalier|trap|stairs)\b/, 'Escalier'],
];

export interface Interpretation {
  usage?: Usage;
  room?: string;
  /** Mots reconnus (pour la traçabilité). */
  matched: string[];
}

export function interpretLabel(label: string | null | undefined): Interpretation {
  const txt = norm(label ?? '');
  if (!txt) return { matched: [] };
  const matched: string[] = [];
  let usage: Usage | undefined;
  for (const [re, u] of USAGES) {
    const m = re.exec(txt);
    if (m) {
      usage = u;
      matched.push(m[0]);
      break;
    }
  }
  let room: string | undefined;
  for (const [re, r] of ROOMS) {
    const m = re.exec(txt);
    if (m) {
      room = r === 'Chambre' && m[2] ? `Chambre ${m[2]}` : r;
      matched.push(m[0].trim());
      break;
    }
  }
  return { usage, room, matched };
}
