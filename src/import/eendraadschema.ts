/**
 * Import des fichiers Eendraadschema (.eds) — https://eendraadschema.goethals-jacobs.be, logiciel libre belge.
 *
 * Lecteur écrit pour Voltaplan d'après la description du format (aucun code d'Eendraadschema n'est repris).
 * Format, tel qu'il ressort du code source public (src/importExport/importExport.ts, src/List_Item/*) :
 *  - « EDS » + version sur 3 chiffres + « 0000 », puis le JSON compressé (deflate, en-tête zlib) en base64 ;
 *  - « TXT » + version + « 0000 », puis le JSON en clair ;
 *  - sans en-tête : JSON en clair, version 1.
 *  Versions 1 et 2 : chaque élément porte `keys`, un tableau de triplets [nom, type, valeur] lus par position ;
 *  versions 3 et 4 : chaque élément porte `props` (propriétés nommées, `type` = nom du symbole).
 *  JSON : data[] = { id, parent, indent, collapsed, props }, active[], id[], length, curid, properties
 *  (owner, installer, control, info, en HTML), print_table, sitplanjson (plan de situation).
 *  L'ordre des enfants d'un élément est celui du tableau `data`.
 *
 * Règles :
 *  - une valeur absente du fichier reste absente (aucune valeur par défaut ajoutée aux éléments) ;
 *  - les propriétés d'origine de chaque élément sont gardées dans `node.source` (format 'eendraadschema') ;
 *  - l'installation importée est une installation existante.
 *  - Le plan de situation d'Eendraadschema n'est pas repris (avertissement s'il contient des éléments).
 */
import type { Address, ElNode, NodeKind, Project, PropValue } from '../model/types';
import type { MigrationWarning } from '../model/migrate';
import { ALLOWED_CHILDREN, CABLE_TYPES } from '../model/schema';
import { emptyProject, uid } from '../model/tree';

/** Dernière version du format connue (Eendraadschema écrit « EDS004… » / « TXT004… »). */
export const EDS_MAX_VERSION = 4;
/** JSON décompressé : au-delà, fichier piégé ou sans rapport avec un schéma unifilaire. */
export const EDS_MAX_JSON = 100 * 1024 * 1024;
/** Nombre maximal d'éléments lus. */
export const EDS_MAX_ITEMS = 50_000;

export type EdsErrorCode = 'notEds' | 'corrupt' | 'newerVersion' | 'tooLarge';

/** Fichier illisible : message traduit par `eds.error.<code>` (src/ui/errors.ts). */
export class EdsError extends Error {
  constructor(
    readonly code: EdsErrorCode,
    readonly params: Record<string, string | number> = {},
  ) {
    super(
      {
        notEds: "Ce fichier n'est pas un fichier Eendraadschema (.eds) lisible.",
        corrupt: 'Fichier Eendraadschema endommagé ou incomplet.',
        newerVersion: `Fichier Eendraadschema d'une version plus récente (${params.version ?? '?'}) que celles connues.`,
        tooLarge: 'Fichier Eendraadschema trop volumineux une fois décompressé.',
      }[code],
    );
    this.name = 'EdsError';
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Lecture du conteneur (en-tête, base64, deflate)

/** Le texte commence-t-il par un en-tête Eendraadschema (« EDS004… » ou « TXT004… ») ? */
export function hasEdsHeader(head: string): boolean {
  return /^(EDS|TXT)/.test(head);
}

function base64Bytes(b64: string): Uint8Array {
  const s = b64.replace(/\s+/g, '');
  if (!s || !/^[A-Za-z0-9+/]+={0,2}$/.test(s)) throw new EdsError('corrupt');
  let bin: string;
  try {
    bin = atob(s);
  } catch {
    throw new EdsError('corrupt');
  }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Décompression zlib (deflate avec en-tête) par le navigateur, plafonnée à `max` octets. */
export async function inflateZlib(bytes: Uint8Array, max = EDS_MAX_JSON): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new EdsError('corrupt');
  const input = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(bytes);
      c.close();
    },
  });
  const reader = input.pipeThrough(new DecompressionStream('deflate') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        void reader.cancel().catch(() => undefined);
        throw new EdsError('tooLarge', { max: Math.round(max / 1048576) });
      }
      chunks.push(value);
    }
  } catch (e) {
    if (e instanceof EdsError) throw e;
    throw new EdsError('corrupt');
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

export interface EdsContent {
  json: string;
  version: number;
  compressed: boolean;
}

/** Contenu JSON et version d'un fichier .eds (texte du fichier). */
export async function decodeEds(text: string): Promise<EdsContent> {
  const s = text.replace(/^\uFEFF/, '');
  const kind = s.slice(0, 3);
  if (kind === 'EDS' || kind === 'TXT') {
    const digits = s.slice(3, 6);
    // Version absente ou illisible : version 1 pour « EDS », 3 pour « TXT » (comme le lit Eendraadschema)
    const version = /^\d{3}$/.test(digits) ? Number(digits) : kind === 'EDS' ? 1 : 3;
    if (version < 1) throw new EdsError('corrupt');
    if (version > EDS_MAX_VERSION) throw new EdsError('newerVersion', { version });
    if (kind === 'TXT') return { json: s.slice(10), version, compressed: false };
    const bytes = await inflateZlib(base64Bytes(s.slice(10)));
    return { json: new TextDecoder('utf-8').decode(bytes), version, compressed: true };
  }
  if (/^\s*\{/.test(s)) return { json: s, version: 1, compressed: false };
  throw new EdsError('notEds');
}

// ---------------------------------------------------------------------------------------------------------------
// Éléments (versions 1 à 4 ramenées à des propriétés nommées)

type Raw = Record<string, unknown>;
interface Item {
  id: number;
  parent: number;
  props: Raw;
}

/**
 * Versions 1 et 2 : position des propriétés dans `keys` (relevées dans les fonctions de conversion des anciens
 * fichiers d'Eendraadschema, pour chaque type). Types non listés (Container, Leiding, Media, Zekering…, qui
 * n'existaient pas encore) : seul le type est lu.
 */
const NR_ADRES = { nr: 10, adres: 15 };
const SCHAKELAARS_KEYS = { aantal_schakelaars: 4, type_schakelaar: 5, nr: 10, adres: 15, heeft_signalisatielampje: 19, is_halfwaterdicht: 20, heeft_verklikkerlampje: 21, is_trekschakelaar: 25 };
const LEGACY_KEYS: Record<string, Record<string, number>> = {
  ...Object.fromEntries(
    [
      'Aansluitpunt', 'Aardingsonderbreker', 'Aftakdoos', 'Batterij', 'Bel', 'Diepvriezer', 'Droogkast', 'EV lader', 'Elektriciteitsmeter',
      'Elektrische oven', 'Koelkast', 'Kookfornuis', 'Meerdere verbruikers', 'Microgolfoven', 'Motor', 'Omvormer', 'Overspanningsbeveiliging',
      'Stoomoven', 'Vaatwasmachine', 'Ventilator', 'Wasmachine', 'Boiler', 'Verwarmingstoestel',
    ].map((t) => [t, NR_ADRES]),
  ),
  Ketel: { aantal: 4, ...NR_ADRES },
  'Warmtepomp/airco': { aantal: 4, ...NR_ADRES },
  'USB lader': { aantal: 4, ...NR_ADRES },
  Zonnepaneel: { aantal: 4, ...NR_ADRES },
  Transformator: { voltage: 14, ...NR_ADRES },
  'Zeldzame symbolen': { symbool: 16, ...NR_ADRES },
  Domotica: { nr: 10, tekst: 15, adres: 23 },
  'Domotica gestuurde verbruiker': NR_ADRES,
  'Vrije tekst': { nr: 10, tekst: 15, vrije_tekst_type: 16, adres: 23 },
  Verlenging: { nr: 10, adres: 23 },
  Lichtcircuit: { ...SCHAKELAARS_KEYS, aantal_lichtpunten: 13 },
  Schakelaars: SCHAKELAARS_KEYS,
  Aansluiting: { aantal_polen: 4, bescherming: 7, amperage: 8, type_kabel_na_teller: 9, nr: 10, differentieel_delta_amperage: 11, adres: 15, differentieel_is_selectief: 20, kortsluitvermogen: 22, naam: 23, type_kabel_voor_teller: 24 },
  Kring: { aantal_polen: 4, bescherming: 7, amperage: 8, type_kabel: 9, naam: 10, differentieel_delta_amperage: 11, kabel_is_aanwezig: 12, tekst: 15, kabel_locatie: 16, kabel_is_in_buis: 19, differentieel_is_selectief: 20, kortsluitvermogen: 22 },
  Bord: { is_geaard: 1, naam: 10, adres: 15 },
  Contactdoos: { is_geaard: 1, is_kinderveilig: 2, aantal: 4, nr: 10, adres: 15, aantal_fases_indien_meerfasig: 16, heeft_ingebouwde_schakelaar: 19, is_halfwaterdicht: 20, is_meerfasig: 21, heeft_nul_indien_meerfasig: 25, in_verdeelbord: 26 },
  Lichtpunt: { aantal: 4, nr: 10, aantal_buizen_indien_TL: 13, adres: 15, type_lamp: 16, type_noodverlichting: 17, is_wandlamp: 19, is_halfwaterdicht: 20, heeft_ingebouwde_schakelaar: 21 },
  Drukknop: { aantal: 4, nr: 10, aantal_knoppen_per_armatuur: 13, adres: 15, type_knop: 16, is_afgeschermd: 19, is_halfwaterdicht: 20, heeft_verklikkerlampje: 21 },
  Verbruiker: { nr: 10, tekst: 15, adres: 23 },
  Splitsing: { adres: 15 },
};

function legacyValue(keys: unknown, i: number): unknown {
  if (!Array.isArray(keys) || keys.length <= i || !Array.isArray(keys[i])) return undefined;
  return keys[i][2];
}

function legacyProps(keys: unknown): Raw {
  let type = legacyValue(keys, 0);
  if (type === 'Stopcontact') type = 'Contactdoos';
  if (type === 'Leeg') type = 'Aansluitpunt';
  const props: Raw = { type };
  const map = LEGACY_KEYS[String(type)] ?? {};
  for (const [k, i] of Object.entries(map)) props[k] = legacyValue(keys, i);
  if (type === 'Aansluiting' || type === 'Kring') {
    // Position 17 / 18 selon la protection
    const b = props.bescherming;
    if (b === 'differentieel') props.type_differentieel = legacyValue(keys, 17);
    if (b === 'automatisch') props.curve_automaat = legacyValue(keys, 17);
    if (b === 'differentieelautomaat') {
      props.type_differentieel = legacyValue(keys, 17);
      props.curve_automaat = legacyValue(keys, 18);
    }
  }
  return props;
}

const present = (v: unknown) => v !== undefined && v !== null && v !== '';
const str = (v: unknown): string | undefined => (present(v) ? String(v).trim() || undefined : undefined);
function num(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const s = str(v);
  if (!s) return undefined;
  const n = parseFloat(s.replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}
function bool(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return undefined;
}

function clean(o: Record<string, PropValue>): Record<string, PropValue> {
  for (const k of Object.keys(o)) if (o[k] === undefined || o[k] === '') delete o[k];
  return o;
}

function sourceOf(type: string, props: Raw): ElNode['source'] {
  const attrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) if (v !== undefined && v !== null && typeof v !== 'object') attrs[k] = String(v);
  return { format: 'eendraadschema', tag: type, attrs };
}

function node(kind: NodeKind, props: Record<string, PropValue>, type?: string, raw?: Raw, location?: string): ElNode {
  const n: ElNode = { id: uid(), kind, props: clean(props), children: [] };
  if (location) n.location = location;
  if (type && raw) n.source = sourceOf(type, raw);
  return n;
}

// ---------------------------------------------------------------------------------------------------------------
// Correspondance Eendraadschema → Voltaplan

const DEVICE: Record<string, string> = {
  automatisch: 'mcb',
  differentieel: 'rcd',
  differentieelautomaat: 'rcbo',
  smelt: 'fuse',
  zekeringscheider: 'fuse',
  contact: 'switch',
  schakelaar: 'switch', // ancien nom de « contact »
};
const POLES: Record<string, string> = { '1': '1P', '2': '2P', '3': '3P', '4': '4P' };
const METHOD: Record<string, string> = { 'In wand': 'inWall', 'Op wand': 'onWall', Ondergronds: 'underground', Luchtleiding: 'air' };
const APPLIANCE: Record<string, string> = {
  'Elektrische oven': 'oven',
  Kookfornuis: 'cooker',
  Microgolfoven: 'microwave',
  Koelkast: 'fridge',
  Diepvriezer: 'freezer',
  Vaatwasmachine: 'dishwasher',
  Wasmachine: 'washingMachine',
  Droogkast: 'dryer',
  Boiler: 'waterHeater',
  'Warmtepomp/airco': 'heatPump',
  Ketel: 'boiler',
  'EV lader': 'evCharger',
  Ventilator: 'fan',
  Verwarmingstoestel: 'heater',
};
/** Appareils sans équivalent dans la liste de Voltaplan : appareil « autre » nommé comme dans Eendraadschema. */
const NAMED_APPLIANCES = new Set(['Stoomoven', 'USB lader']);
/** Symboles gardés comme élément « autre », nommé comme dans Eendraadschema. */
const NAMED_OTHERS = new Set(['Batterij', 'Media', 'Overspanningsbeveiliging', 'Aardingsonderbreker', 'Zeldzame symbolen']);
/** Éléments de structure : leurs enfants sont rattachés au parent. */
const PASS_THROUGH = new Set(['Splitsing', 'Meerdere verbruikers', 'Container', 'Aansluitpunt', 'Verlenging', 'Domotica gestuurde verbruiker']);
const LAMP: Record<string, string> = { standaard: 'standard', led: 'led', TL: 'fluo', spot: 'spot' };
const FEED_KINDS = new Set<NodeKind>(['protection', 'board', 'meter', 'cable', 'earthBar', 'earth']);

/** Désignation de câble (texte libre) : type, nombre de conducteurs, section. */
export function parseCable(text: string | undefined): { props: Record<string, PropValue>; recognized: boolean } {
  const props: Record<string, PropValue> = {};
  if (!text) return { props, recognized: false };
  let recognized = false;
  const type = text.split(/\s+/).map((t) => t.toUpperCase()).find((t) => (CABLE_TYPES as readonly string[]).includes(t) && t !== 'OTHER');
  if (type) {
    props.cableType = type;
    recognized = true;
  }
  const m = /(\d+)\s*[Gx×X*]\s*(\d+(?:[.,]\d+)?)/.exec(text);
  if (m) {
    props.conductors = Number(m[1]);
    props.section = Number(m[2].replace(',', '.'));
    recognized = true;
  } else {
    const s = /(\d+(?:[.,]\d+)?)\s*mm/.exec(text);
    if (s) {
      props.section = Number(s[1].replace(',', '.'));
      recognized = true;
    }
  }
  return { props, recognized };
}

interface Ctx {
  warnings: MigrationWarning[];
  ignored: Set<string>;
  texts: string[];
  cables: Set<string>;
}

function cableNode(p: Raw, typeKey: string, ctx: Ctx, type?: string): ElNode {
  const text = str(p[typeKey]);
  const { props, recognized } = parseCable(text);
  if (text && !recognized) ctx.cables.add(text);
  const loc = str(p.kabel_locatie);
  if (loc && METHOD[loc]) props.method = METHOD[loc];
  const conduit = bool(p.kabel_is_in_buis);
  if (conduit !== undefined && loc !== 'Luchtleiding') props.inConduit = conduit;
  return node('cable', props, type, type ? p : undefined);
}

/** Protection d'une « Aansluiting », d'un « Kring » ou d'une « Zekering/differentieel ». `null` : aucune. */
function protectionNode(p: Raw, type: string, extra: Record<string, PropValue>): ElNode | null {
  const b = str(p.bescherming);
  const device = b ? DEVICE[b] : undefined;
  if (!device) return null;
  const withRcd = device === 'rcd' || device === 'rcbo';
  const curve = str(p.curve_automaat);
  const rcdType = str(p.type_differentieel);
  const phase = str(p.fase);
  return node(
    'protection',
    {
      device,
      ratedCurrent: num(p.amperage),
      poles: POLES[str(p.aantal_polen) ?? ''],
      curve: (device === 'mcb' || device === 'rcbo') && curve && ['B', 'C', 'D'].includes(curve) ? curve : undefined,
      residualCurrent: withRcd ? num(p.differentieel_delta_amperage) : undefined,
      rcdType: withRcd && rcdType && ['A', 'B'].includes(rcdType) ? rcdType : undefined,
      breakingCapacity: device === 'mcb' || withRcd ? num(p.kortsluitvermogen) : undefined,
      phase: phase && ['L1', 'L2', 'L3'].includes(phase) ? phase : undefined,
      ...extra,
    },
    type,
    p,
  );
}

/** Commande ou dispositif qui n'est pas une protection (Kring « relais », « schemer », parafoudre). */
function controlInsteadOfProtection(p: Raw, type: string): ElNode | null {
  const b = str(p.bescherming);
  if (b === 'relais') return node('relay', { relayType: 'relay' }, type, p);
  if (b === 'schemer') return node('other', { name: 'Schemerschakelaar' }, type, p);
  if (b === 'overspanningsbeveiliging') return node('other', { name: 'Overspanningsbeveiliging' }, type, p);
  return null;
}

/** Interrupteur(s) d'un « Schakelaars » ou d'un « Lichtcircuit » : chaîne de nœuds (le dernier porte la suite). */
function switchChain(p: Raw, type: string, location: string | undefined, ctx: Ctx): ElNode[] {
  let t = str(p.type_schakelaar);
  if (t === 'schakelaar') t = 'contact';
  const n = Math.max(1, Math.min(20, num(p.aantal_schakelaars) ?? 1));
  const opts = (): Record<string, PropValue> => ({
    pilotLight: bool(p.heeft_verklikkerlampje),
    signalLamp: bool(p.heeft_signalisatielampje),
    splashProof: bool(p.is_halfwaterdicht),
  });
  const sw = (switchType: string | undefined) => node('switch', { switchType, ...opts() }, type, p, location);
  const chain: ElNode[] = [];
  switch (t) {
    case 'enkelpolig':
      if (n === 1) chain.push(sw(bool(p.is_trekschakelaar) ? 'pullCord' : 'single'));
      else {
        // Dessiné par Eendraadschema comme va-et-vient, permutateur(s), va-et-vient
        chain.push(sw('twoWay'));
        for (let i = 2; i < n; i++) chain.push(sw('intermediate'));
        chain.push(sw('twoWay'));
      }
      break;
    case 'dubbelpolig':
      if (n === 1) chain.push(sw('bipolar'));
      else chain.push(sw('twoWay'), sw('twoWay'));
      break;
    case 'dubbelaansteking':
      chain.push(sw('double'));
      break;
    case 'wissel_enkel':
    case 'wissel_dubbel':
      chain.push(sw('twoWay'));
      break;
    case 'kruis_enkel':
      chain.push(sw('intermediate'));
      break;
    case 'dimschakelaar':
    case 'dimschakelaar wissel':
    case 'dimmer':
      chain.push(sw('dimmer'));
      break;
    case 'rolluikschakelaar':
      chain.push(sw('shutter'));
      break;
    case 'bewegingsschakelaar':
      chain.push(node('detector', {}, type, p, location));
      break;
    case 'teleruptor':
      chain.push(node('relay', { relayType: 'teleswitch' }, type, p, location));
      break;
    case 'relais':
      chain.push(node('relay', { relayType: 'relay' }, type, p, location));
      break;
    case 'minuterie':
      chain.push(node('relay', { relayType: 'timer' }, type, p, location));
      break;
    case 'driepolig':
      // Pas d'interrupteur tripolaire dans Voltaplan : type laissé vide
      chain.push(sw(undefined));
      ctx.ignored.add('Schakelaars: driepolig');
      break;
    default:
      // contact, magneetcontact, schemerschakelaar, tijdschakelaar, thermostaat… : élément nommé
      chain.push(t ? node('other', { name: t }, type, p, location) : sw(undefined));
  }
  for (let i = 0; i + 1 < chain.length; i++) chain[i].children.push(chain[i + 1]);
  return chain;
}

/** Enlève les chevrons qu'Eendraadschema ajoute autour du nom d'un tableau converti d'une ancienne version. */
const boardName = (s: string | undefined) => s?.replace(/^<(.*)>$/, '$1').trim() || undefined;

interface Tree {
  item: Item;
  children: Tree[];
}

/**
 * Rattache `child` au plus bas élément de `chain` qui peut le porter. Sinon : une protection, un tableau ou un
 * compteur remonte au niveau du parent (`overflow`), tout autre élément reste sous le dernier maillon.
 */
function attach(chain: ElNode[], child: ElNode, overflow: ElNode[]): void {
  for (let i = chain.length - 1; i >= 0; i--) {
    if (ALLOWED_CHILDREN[chain[i].kind]?.includes(child.kind)) {
      chain[i].children.push(child);
      return;
    }
  }
  if (!chain.length || child.kind === 'protection' || child.kind === 'board' || child.kind === 'meter') overflow.push(child);
  else chain[chain.length - 1].children.push(child);
}

function convertChildren(trees: Tree[], ctx: Ctx): ElNode[] {
  return trees.flatMap((t) => convert(t, ctx));
}

/** Rattache les enfants convertis à la chaîne ; renvoie ce qui remonte au niveau du parent. */
function withChain(top: ElNode[], chain: ElNode[], kids: ElNode[]): ElNode[] {
  const overflow: ElNode[] = [];
  for (const k of kids) attach(chain, k, overflow);
  return [...top, ...overflow];
}

/**
 * Circuit (« Kring » ou « Zekering/differentieel ») : protection, câble, puis le contenu. Un circuit qui alimente
 * des points sans câble indiqué reçoit un câble sans caractéristiques : le câble existe forcément, ses
 * caractéristiques sont inconnues.
 */
function circuit(p: Raw, type: string, kids: ElNode[], withCable: boolean, ctx: Ctx, location: string | undefined): ElNode[] {
  const naam = str(p.naam) === '---' ? undefined : str(p.naam);
  const hasLoads = kids.some((k) => !FEED_KINDS.has(k.kind));
  // Nom du Kring : lettre du circuit s'il alimente des points ; sinon (différentiel d'un groupe, « Diff »),
  // simple libellé
  const names: Record<string, PropValue> = type !== 'Kring' ? {} : hasLoads ? { fixedLetter: naam, circuitName: str(p.tekst) } : { circuitName: str(p.tekst) ?? naam };
  const prot = protectionNode(p, type, names);
  const control = prot ? null : controlInsteadOfProtection(p, type);
  const head = prot ?? control;
  if (head && location) head.location = location;
  let cable: ElNode | undefined;
  if (withCable) cable = cableNode(p, 'type_kabel', ctx, head ? undefined : type);
  else if (head && hasLoads) cable = node('cable', {});
  if (cable && !head && location) cable.location = location;
  const chain = [head, cable].filter((n): n is ElNode => !!n);
  for (let i = 0; i + 1 < chain.length; i++) chain[i].children.push(chain[i + 1]);
  if (!chain.length) return kids; // ni protection ni câble : regroupement seulement
  return withChain([chain[0]], chain, kids);
}

const COMMANDS = new Set<NodeKind>(['switch', 'relay', 'pushButton', 'detector']);

/**
 * « Meerdere verbruikers » : Eendraadschema dessine ses éléments en série sur une ligne. Une commande sans
 * enfant (interrupteur, télérupteur…) commande ce qui la suit : les éléments suivants deviennent ses enfants,
 * tant que Voltaplan les accepte sous une commande (une prise commandée reste à côté de l'interrupteur).
 */
function inSeries(nodes: ElNode[]): ElNode[] {
  const out: ElNode[] = [];
  let command: ElNode | undefined;
  for (const n of nodes) {
    if (command && ALLOWED_CHILDREN[command.kind]?.includes(n.kind)) {
      command.children.push(n);
      continue;
    }
    out.push(n);
    command = COMMANDS.has(n.kind) && n.children.length === 0 ? n : undefined;
  }
  return out;
}

function convert(t: Tree, ctx: Ctx): ElNode[] {
  const p = t.item.props;
  const type = str(p.type) ?? '';
  const location = str(p.adres);
  const kids = () => convertChildren(t.children, ctx);
  if (type === 'Meerdere verbruikers') return inSeries(kids());
  if (PASS_THROUGH.has(type)) return kids();
  switch (type) {
    case 'Bord': {
      const b = node('board', { name: boardName(str(p.naam)) }, type, p, location);
      if (bool(p.is_geaard) === true) b.children.push(node('earthBar', {}));
      return withChain([b], [b], kids());
    }
    case 'Kring':
      return circuit(p, type, kids(), bool(p.kabel_is_aanwezig) === true, ctx, location);
    case 'Zekering/differentieel':
      return circuit(p, type, kids(), false, ctx, location);
    case 'Leiding': {
      const c = cableNode(p, 'type_kabel', ctx, type);
      if (location) c.location = location;
      return withChain([c], [c], kids());
    }
    case 'Elektriciteitsmeter': {
      const m = node('meter', {}, type, p, location);
      return withChain([m], [m], kids());
    }
    case 'Schakelaars':
    case 'Lichtcircuit': {
      const chain = switchChain(p, type, location, ctx);
      const last = chain[chain.length - 1];
      if (type === 'Lichtcircuit') {
        const count = num(p.aantal_lichtpunten);
        last.children.push(node('light', { count }));
      }
      return withChain([chain[0]], [last], kids());
    }
    case 'Vrije ruimte':
      return kids();
    case 'Vrije tekst': {
      const text = str(p.tekst);
      if (str(p.vrije_tekst_type) === 'verbruiker' && text) {
        const a = node('appliance', { applianceType: 'other', name: text }, type, p, location);
        return withChain([a], [a], kids());
      }
      if (text) ctx.texts.push(text);
      return kids();
    }
  }
  let leaf: ElNode;
  switch (type) {
    case 'Contactdoos':
      leaf = node(
        'socket',
        {
          count: num(p.aantal),
          earth: bool(p.is_geaard),
          childSafety: bool(p.is_kinderveilig),
          splashProof: bool(p.is_halfwaterdicht),
          threePhase: bool(p.is_meerfasig),
        },
        type,
        p,
        location,
      );
      break;
    case 'Lichtpunt': {
      const nood = str(p.type_noodverlichting);
      const lightType = nood && nood !== 'Geen' ? 'emergency' : bool(p.is_wandlamp) ? 'wall' : LAMP[str(p.type_lamp) ?? ''];
      leaf = node('light', { lightType, count: num(p.aantal), splashProof: bool(p.is_halfwaterdicht) }, type, p, location);
      break;
    }
    case 'Drukknop':
      leaf = node('pushButton', {}, type, p, location);
      break;
    case 'Verbruiker':
      leaf = node('appliance', { applianceType: 'other', name: str(p.tekst) }, type, p, location);
      break;
    case 'Aftakdoos':
      leaf = node('junctionBox', {}, type, p, location);
      break;
    case 'Transformator':
      leaf = node('transformer', {}, type, p, location);
      break;
    case 'Motor':
      leaf = node('motor', {}, type, p, location);
      break;
    case 'Bel':
      leaf = node('bell', {}, type, p, location);
      break;
    case 'Zonnepaneel':
      leaf = node('solarPanel', { count: num(p.aantal) }, type, p, location);
      break;
    case 'Omvormer':
      leaf = node('inverter', {}, type, p, location);
      break;
    case 'Domotica':
    case 'Domotica module (verticaal)':
      leaf = node('domotic', { name: str(p.tekst) }, type, p, location);
      break;
    default:
      if (APPLIANCE[type]) leaf = node('appliance', { applianceType: APPLIANCE[type] }, type, p, location);
      else if (NAMED_APPLIANCES.has(type)) leaf = node('appliance', { applianceType: 'other', name: type }, type, p, location);
      else if (NAMED_OTHERS.has(type)) leaf = node('other', { name: type === 'Zeldzame symbolen' ? (str(p.symbool) ?? type) : type }, type, p, location);
      else {
        ctx.ignored.add(type || '?');
        leaf = node('other', { name: type || undefined }, type, p, location);
      }
  }
  return withChain([leaf], [leaf], kids());
}

/** Raccordement : origine → compteur → protection générale éventuelle → câble après compteur éventuel. */
function aansluiting(t: Tree, ctx: Ctx): ElNode {
  const p = t.item.props;
  const origin = node('origin', {}, 'Aansluiting', p);
  const meter = node('meter', {});
  const location = str(p.adres);
  if (location) origin.location = location;
  origin.children.push(meter);
  const chain: ElNode[] = [origin, meter];
  const prot = protectionNode(p, 'Aansluiting', {});
  if (prot) {
    delete prot.source; // les propriétés d'origine sont gardées sur l'origine
    chain.push(prot);
  }
  if (str(p.type_kabel_na_teller)) chain.push(cableNode(p, 'type_kabel_na_teller', ctx));
  for (let i = 1; i + 1 < chain.length; i++) chain[i].children.push(chain[i + 1]);
  const overflow: ElNode[] = [];
  for (const k of convertChildren(t.children, ctx)) attach(chain.slice(1), k, overflow);
  for (const k of overflow) origin.children.push(k);
  return origin;
}

// ---------------------------------------------------------------------------------------------------------------
// Métadonnées (champs HTML d'Eendraadschema)

/** Lignes de texte d'un champ HTML (contenteditable) : <br>, <div>, <p> → lignes ; balises et entités retirées. */
export function htmlLines(html: unknown): string[] {
  const s = str(html);
  if (!s) return [];
  const withBreaks = s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p)>/gi, '\n');
  const text = new DOMParser().parseFromString(withBreaks, 'text/html').body.textContent ?? '';
  return text
    .split('\n')
    .map((l) => l.replace(/\u00a0/g, ' ').trim())
    .filter(Boolean);
}

interface Person {
  name?: string;
  address: Address;
  email?: string;
  vat?: string;
  /** Lignes non reprises (téléphone…). */
  rest: string[];
}

/**
 * Personne (champ « owner » ou « installer ») : nom (1re ligne), e-mail, n° de TVA, adresse (ligne « code postal
 * commune » et la rue juste au-dessus). Les autres lignes vont dans `rest`.
 */
function person(lines: string[]): Person {
  const out: Person = { name: lines[0], address: {}, rest: [] };
  const others = lines.slice(1);
  const used = new Set<number>();
  others.forEach((l, i) => {
    const mail = /([^\s:<>]+@[^\s:<>]+\.[a-z]{2,})/i.exec(l);
    const vat = /^(BTW|TVA|VAT)\s*:?\s*(\S.*)$/i.exec(l);
    if (mail && !out.email) {
      out.email = mail[1];
      used.add(i);
    } else if (vat && !out.vat) {
      out.vat = vat[2];
      used.add(i);
    }
  });
  const pc = others.findIndex((l, i) => !used.has(i) && /^(B-)?\d{4}\s+\S/.test(l));
  if (pc >= 0) {
    const m = /^(?:B-)?(\d{4})\s+(.+)$/.exec(others[pc])!;
    out.address.postalCode = m[1];
    out.address.city = m[2];
    used.add(pc);
    if (pc > 0 && !used.has(pc - 1)) {
      out.address.street = others[pc - 1];
      used.add(pc - 1);
    }
  }
  out.rest = others.filter((_, i) => !used.has(i));
  return out;
}

function metaFrom(props: Raw, ctx: Ctx): Partial<Project['meta']> {
  const owner = person(htmlLines(props.owner));
  const inst = person(htmlLines(props.installer));
  const info = htmlLines(props.info);
  const client: Project['meta']['client'] = { name: owner.name, address: owner.address };
  if (owner.email) client.email = owner.email;
  const installer: Project['meta']['installer'] = { name: inst.name, address: inst.address };
  if (inst.vat) installer.vat = inst.vat;
  if (inst.email) installer.email = inst.email;
  const meta: Partial<Project['meta']> = { client, site: {}, installer };
  const control = htmlLines(props.control).join(', ');
  if (control) meta.inspectionBodyName = control;
  const rest: string[] = [...owner.rest, ...inst.rest];
  for (const l of info) {
    const ean = /^EAN\s*:?\s*(\d{18})$/i.exec(l);
    const earth = /^(Aarding|Mise à la terre|Earthing)\s*:?\s*(TT|TN|IT)$/i.exec(l);
    if (ean) meta.ean = ean[1];
    else if (earth) meta.earthing = earth[2].toUpperCase() as 'TT' | 'TN' | 'IT';
    else if (/^\d?N?\s*x\s*\d{3}\s*V\b/i.test(l)) meta.supply = l;
    else rest.push(l);
  }
  if (rest.length) ctx.warnings.push({ key: 'eds.warn.info', params: { list: rest.join(' / ') } });
  return meta;
}

// ---------------------------------------------------------------------------------------------------------------

export interface EdsImportResult {
  project: Project;
  warnings: MigrationWarning[];
}

/** Projet Voltaplan à partir du JSON d'Eendraadschema (déjà décompressé) et de sa version. */
export function parseEdsJson(json: string, version: number, fileName = 'Eendraadschema'): EdsImportResult {
  let doc: Raw;
  try {
    doc = JSON.parse(json) as Raw;
  } catch {
    throw new EdsError('corrupt');
  }
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.data)) throw new EdsError('notEds');
  const data = doc.data as Raw[];
  if (data.length > EDS_MAX_ITEMS) throw new EdsError('tooLarge', { max: Math.round(EDS_MAX_JSON / 1048576) });
  const active = Array.isArray(doc.active) ? (doc.active as unknown[]) : [];
  // Fichiers de janvier 2023 marqués version 1 mais déjà écrits avec `props` (lu ainsi par Eendraadschema)
  const legacy = version < 3 && !(data.length > 0 && data[0] && typeof data[0] === 'object' && data[0].keys === undefined && data[0].props !== undefined);

  const ctx: Ctx = { warnings: [], ignored: new Set(), texts: [], cables: new Set() };
  const items: Item[] = [];
  data.forEach((d, i) => {
    if (!d || typeof d !== 'object' || active[i] === false) return;
    const props = legacy ? legacyProps(d.keys) : d.props && typeof d.props === 'object' ? { ...(d.props as Raw) } : null;
    const id = Number(d.id);
    if (!props || !Number.isFinite(id)) return;
    if (props.type === 'Stopcontact') props.type = 'Contactdoos';
    if (props.type === 'Leeg') props.type = 'Aansluitpunt';
    items.push({ id, parent: Number(d.parent) || 0, props });
  });
  if (!items.length && data.length) throw new EdsError('corrupt');

  // Arbre (ordre des enfants = ordre du tableau) ; un élément dont le parent manque n'est pas repris
  const trees = new Map<number, Tree>(items.map((it) => [it.id, { item: it, children: [] }]));
  const top: Tree[] = [];
  for (const it of items) {
    const t = trees.get(it.id)!;
    if (it.parent === 0) top.push(t);
    else if (it.parent !== it.id) trees.get(it.parent)?.children.push(t);
  }
  // Parent absent ou boucle parent ↔ enfant (fichier fabriqué) : éléments inaccessibles depuis la racine, ignorés
  const reachable = new Set<Tree>();
  const mark = (t: Tree) => {
    if (reachable.has(t)) return;
    reachable.add(t);
    t.children.forEach(mark);
  };
  top.forEach(mark);
  const orphans = trees.size - reachable.size;

  const project = emptyProject();
  project.roots = [];
  project.loose = [];
  for (const t of top) {
    const type = str(t.item.props.type);
    if (type === 'Aansluiting') {
      project.roots.push(aansluiting(t, ctx));
      continue;
    }
    const nodes = convert(t, ctx);
    for (const n of nodes) {
      if (n.kind === 'board' || n.kind === 'protection' || n.kind === 'meter' || (n.kind === 'cable' && n.children.length)) {
        project.roots.push({ id: uid(), kind: 'origin', props: {}, children: [n] });
      } else project.loose.push(n);
    }
  }

  const props = doc.properties && typeof doc.properties === 'object' ? (doc.properties as Raw) : {};
  const meta = metaFrom(props, ctx);
  // Titre : nom du fichier ouvert ; à défaut, celui gardé dans le fichier par Eendraadschema
  const title = (fileName !== 'Eendraadschema' ? fileName : (str(props.filename) ?? fileName)).replace(/\.eds$/i, '');
  project.meta = { ...project.meta, ...meta, title, installationKind: 'existing', rgieVersion: 'old' } as Project['meta'];

  const sit = doc.sitplanjson as Raw | undefined;
  if (sit && Array.isArray(sit.elements) && sit.elements.length) ctx.warnings.push({ key: 'eds.warn.sitplan', params: { n: sit.elements.length } });
  if (legacy) ctx.warnings.push({ key: 'eds.warn.legacy', params: { version } });
  if (orphans > 0) ctx.warnings.push({ key: 'eds.warn.orphans', params: { n: orphans } });
  if (ctx.ignored.size) ctx.warnings.push({ key: 'eds.warn.unknown', params: { list: [...ctx.ignored].join(', ') } });
  if (ctx.texts.length) ctx.warnings.push({ key: 'eds.warn.texts', params: { list: ctx.texts.join(' / ') } });
  if (ctx.cables.size) ctx.warnings.push({ key: 'eds.warn.cables', params: { list: [...ctx.cables].join(', ') } });
  if (!meta.earthing || !meta.supply) ctx.warnings.push({ key: 'eds.warn.checkSupply' });
  return { project, warnings: ctx.warnings };
}

/** Import d'un fichier .eds (texte du fichier). */
export async function importEendraadschema(text: string, fileName = 'Eendraadschema'): Promise<EdsImportResult> {
  const { json, version } = await decodeEds(text);
  return parseEdsJson(json, version, fileName);
}
