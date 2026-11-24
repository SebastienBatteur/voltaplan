/**
 * Interprétation déterministe d'une étiquette de tableau (« PRISES CUISINE », « Verlichting living », « LL »,
 * « PC cuis. », « Ecl. ch.1 », « SDB ») : usage(s) probable(s) du circuit et pièce. Aucune IA : mots-clés et
 * abréviations courantes des tableaux belges en français, néerlandais et anglais, testés. Ce qui n'est pas reconnu
 * reste inconnu (une question sera posée), jamais deviné.
 *
 * Règles :
 *  - une étiquette peut citer plusieurs usages (« Prises + éclairage garage ») : tous sont rendus, dans l'ordre ;
 *  - une étiquette qui cite plusieurs pièces (« Prises ch.1 et ch.2 ») ne donne PAS de pièce unique : `room` reste
 *    vide, `rooms` les liste (placer le point dans l'une d'elles serait inventé) ;
 *  - « Réserve », « Libre », « Vrij », « Spare » : disjoncteur de réserve (`spare`), rien en aval n'est supposé ;
 *  - « Général », « Algemeen », « Main » : appareil de tête (`main`), pas un circuit.
 */

export type Usage =
  | { kind: 'socket' }
  | { kind: 'light' }
  | { kind: 'appliance'; applianceType: string }
  | { kind: 'bell' }
  | { kind: 'motor' }
  | { kind: 'board' };

/**
 * Normalisation : minuscules, sans accents, ponctuation → espace, lettres et chiffres collés séparés
 * (« Ch.1 » → « ch 1 », « SLPK2 » → « slpk 2 »), lettres isolées séparées par un tiret ou un point recollées
 * (« L-L » → « ll », « S.D.B. » → « sdb »).
 */
export function normLabel(s: string): string {
  let x = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe');
  // Sigles écrits avec séparateurs : « l-l », « s.d.b. », « l/v » (lettres seules)
  x = x.replace(/\b([a-z])(?:[.\-/]([a-z]))(?:[.\-/]([a-z]))?\b\.?/g, (_m, a: string, b: string, c?: string) => a + b + (c ?? ''));
  return x
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Mots-clés → usage. Ordre important : le plus spécifique d'abord (« pompe à chaleur » avant « pompe »). */
const USAGES: [RegExp, Usage][] = [
  [/\b(borne( de)? recharge|borne|recharge|laadpaal|laadpunt|laadstation|wallbox|ev ?charger|ev)\b/, { kind: 'appliance', applianceType: 'evCharger' }],
  [/\b(pac|pompe a chaleur|warmtepomp|heat ?pump)\b/, { kind: 'appliance', applianceType: 'heatPump' }],
  [/\b(lave ?linge|machine a laver|ll|wasmachine|wasm|wm|washing( machine)?|washer)\b/, { kind: 'appliance', applianceType: 'washingMachine' }],
  [/\b(seche ?linge|sl|droogkast|droogk|droger|dk|dryer|tumble ?dryer)\b/, { kind: 'appliance', applianceType: 'dryer' }],
  [/\b(lave ?vaisselle|lv|vaatwas|vaatwasser|vaatw|dishwasher)\b/, { kind: 'appliance', applianceType: 'dishwasher' }],
  [/\b(taques?|plaques?( de cuisson)?|induction|vitro(ceramique)?|kookplaa?t(en)?|kookpl|kookvuur|hob|cooktop)\b/, { kind: 'appliance', applianceType: 'hob' }],
  [/\b(cuisiniere|fornuis|cooker)\b/, { kind: 'appliance', applianceType: 'cooker' }],
  [/\b(micro ?ondes?|mo|microgolf|microg|microwave)\b/, { kind: 'appliance', applianceType: 'microwave' }],
  [/\b(four|oven|steamer)\b/, { kind: 'appliance', applianceType: 'oven' }],
  [/\b(congelateur|congel|surgelateur|diepvries|diepvr|freezer)\b/, { kind: 'appliance', applianceType: 'freezer' }],
  [/\b(frigo|refrigerateur|koelkast|koelk|fridge)\b/, { kind: 'appliance', applianceType: 'fridge' }],
  [/\b(chauffe ?eau|ce|boiler|ballon( d eau chaude)?|water ?heater)\b/, { kind: 'appliance', applianceType: 'waterHeater' }],
  [/\b(chaudiere|chauffage central|ketel|cv( ketel)?|condensatieketel)\b/, { kind: 'appliance', applianceType: 'boiler' }],
  [/\b(chauffage|chauff|radiateurs?|convecteurs?|accumulateurs?|verwarming|verw|accu|heaters?|heating)\b/, { kind: 'appliance', applianceType: 'heater' }],
  [/\b(ventilation|ventil|vmc|ventilatie|extracteur|hotte|dampkap|afzuigkap|fan|extractor|hood)\b/, { kind: 'appliance', applianceType: 'fan' }],
  [/\b(volets?( roulants?)?|rolluik(en)?|screens?|stores?|porte de garage|garagepoort|poort|portail|pompe|pomp|pump)\b/, { kind: 'motor' }],
  [/\b(sonnette|sonnerie|carillon|bel|deurbel|bell|doorbell)\b/, { kind: 'bell' }],
  [
    /\b(sous ?tableau|sous ?tab|tableau divisionnaire|tab div|td|coffret|ondertableau|onderverdeelbord|onderverdeling|onderbord|verdeelbord|bijbord|sub ?panel|sub ?board|tableau|board)\b/,
    { kind: 'board' },
  ],
  [
    /\b(eclairages?|ecl|eclair|lumieres?|lum|lampes?|spots?|appliques?|plafonniers?|verlichting|verl|licht|lichten|lampen|lights?|lighting)\b/,
    { kind: 'light' },
  ],
  [/\b(prises?( de courant)?|pc|pcs|stopcontact(en)?|stopc|stc|contactdozen|sockets?|outlets?|plugs?)\b/, { kind: 'socket' }],
];

/** Pièces : nom affiché (celui des pièces du plan, voir src/model/sync.ts). */
const ROOMS: [RegExp, string, boolean?][] = [
  [/\b(salle de bains?|sdb|badkamer|badk|bathroom|bath)\b/, 'Salle de bain'],
  [/\b(salle de douche|sdd|douchekamer|douche|shower)\b/, 'Salle de douche'],
  [/\b(salle a manger|sam|eetkamer|eetk|dining( room)?)\b/, 'Salle à manger'],
  [/\b(cuisine|cuis|keuken|keuk|kitchen)\b/, 'Cuisine'],
  [/\b(salon|sejour|sej|living( room)?|liv|woonkamer|zitkamer|lounge)\b/, 'Salon'],
  // Chambre numérotée : « ch 1 », « slpk 2 », « bedroom 3 »
  [/\b(chambres?|chbre|ch|slaapkamers?|slpk|slk|sk|bedrooms?|bed)(?: (\d{1,2}(?: (?:et |en |and |e )?\d{1,2})*))?\b/, 'Chambre', true],
  [/\b(buanderie|buand|wasplaats|washok|wasruimte|laundry|utility)\b/, 'Buanderie'],
  [/\b(garage|gar)\b/, 'Garage'],
  [/\b(cave|kelder|cellar|basement)\b/, 'Cave'],
  [/\b(grenier|gren|combles|mansarde|zolder|attic)\b/, 'Grenier'],
  [/\b(bureau|bur|office|study)\b/, 'Bureau'],
  [/\b(hall|couloir|degagement|entree|gang|inkom|nachthal|hallway|corridor)\b/, 'Hall'],
  [/\b(wc|toilettes?|toilet)\b/, 'WC'],
  [/\b(veranda)\b/, 'Véranda'],
  [/\b(atelier|werkplaats|workshop)\b/, 'Atelier'],
  [/\b(cellier|debarras|berging|storage)\b/, 'Débarras'],
  [/\b(escalier|esc|traphal|trap|stairs)\b/, 'Escalier'],
  [/\b(jardin|jard|exterieur|ext|terrasse|terr|facade|tuin|buiten|terras|gevel|outdoor|outside|garden)\b/, 'Extérieur'],
];

const SPARE = /\b(reserve|libre|vrij|spare|leeg|vide)\b/;
const MAIN = /\b(general|generale|algemeen|hoofdschakelaar|hoofd|main)\b/;

export interface Interpretation {
  /** Premier usage reconnu (compatibilité) ; voir `usages` pour une étiquette mixte. */
  usage?: Usage;
  /** Tous les usages reconnus, sans doublon, dans l'ordre de l'étiquette. */
  usages: Usage[];
  /** Pièce, seulement si l'étiquette n'en cite qu'une. */
  room?: string;
  /** Toutes les pièces citées. */
  rooms: string[];
  /** Disjoncteur de réserve : aucun circuit supposé en aval. */
  spare?: boolean;
  /** Appareil de tête (« Général ») : pas un circuit. */
  main?: boolean;
  /** Mots reconnus (pour la traçabilité). */
  matched: string[];
}

const sameUsage = (a: Usage, b: Usage) => a.kind === b.kind && (a.kind !== 'appliance' || (b.kind === 'appliance' && a.applianceType === b.applianceType));

export function interpretLabel(label: string | null | undefined): Interpretation {
  const txt = normLabel(label ?? '');
  const out: Interpretation = { usages: [], rooms: [], matched: [] };
  if (!txt) return out;
  // « Réserve », « Réserve 3 », « Général » : seuls (à un repère près), sinon ce sont des mots parmi d'autres
  const alone = (re: RegExp) => {
    const m = re.exec(txt);
    return m && txt.replace(m[0], ' ').trim().split(/\s+/).every((w) => !w || /^([a-z]|\d+)$/.test(w)) ? m[0] : null;
  };
  const spare = alone(SPARE);
  if (spare) return { ...out, spare: true, matched: [spare] };
  const main = alone(MAIN);
  if (main) return { ...out, main: true, matched: [main] };
  // Usages : chaque passage de l'étiquette n'est attribué qu'une fois (« pompe à chaleur » ne compte pas « pompe »)
  const taken: [number, number][] = [];
  const free = (a: number, b: number) => taken.every(([x, y]) => b <= x || a >= y);
  const found: { at: number; u: Usage; m: string }[] = [];
  for (const [re, u] of USAGES) {
    const g = new RegExp(re.source, 'g');
    for (const m of txt.matchAll(g)) {
      const a = m.index ?? 0;
      const b = a + m[0].length;
      if (!free(a, b)) continue;
      taken.push([a, b]);
      found.push({ at: a, u, m: m[0] });
    }
  }
  found.sort((p, q) => p.at - q.at);
  for (const f of found) {
    if (!out.usages.some((x) => sameUsage(x, f.u))) out.usages.push(f.u);
    out.matched.push(f.m);
  }
  out.usage = out.usages[0];
  // Pièces : hors des passages déjà attribués à un usage (« porte de garage » est un moteur, et aussi le garage)
  const roomHits: { at: number; r: string; m: string }[] = [];
  for (const [re, r, numbered] of ROOMS) {
    const g = new RegExp(re.source, 'g');
    for (const m of txt.matchAll(g)) {
      const a = m.index ?? 0;
      const b = a + m[0].length;
      // Un mot déjà lu comme usage n'est pas une pièce, sauf le garage (« porte de garage »)
      if (!free(a, b) && r !== 'Garage') continue;
      taken.push([a, b]);
      // « ch 1 2 », « slpk 1 en 2 » : une chambre par numéro
      const nums = numbered && m[2] ? m[2].split(/\D+/).filter(Boolean) : [];
      if (nums.length) for (const n of nums) roomHits.push({ at: a, r: `${r} ${Number(n)}`, m: m[0].trim() });
      else roomHits.push({ at: a, r, m: m[0].trim() });
    }
  }
  roomHits.sort((p, q) => p.at - q.at);
  for (const h of roomHits) {
    if (!out.rooms.includes(h.r)) out.rooms.push(h.r);
    out.matched.push(h.m);
  }
  if (out.rooms.length === 1) out.room = out.rooms[0];
  return out;
}

/** Nom d'usage stable (pour regrouper les circuits : « socket », « light », « appliance:oven »…). */
export const usageKey = (u: Usage) => (u.kind === 'appliance' ? 'appliance:' + u.applianceType : u.kind);
