/**
 * Import des sauvegardes Volter (.vschema) — JSON, clés en néerlandais ou en anglais (format décrit dans
 * docs/strategie/FORMAT-VOLTER.md, établi sur deux projets d'essai exportés par Volter bêta, « version » 2).
 * Lecture seule et tolérante : un élément inconnu devient « autre » (nom Volter conservé) avec un avertissement.
 * Les données d'origine de chaque élément sont gardées dans `node.source`.
 */
import { moduleWidth } from '../board/model';
import { ALLOWED_CHILDREN, CABLE_TYPES } from '../model/schema';
import { createNode, emptyPage, emptyProject, letterFor, uid } from '../model/tree';
import type { ElNode, Furniture, NodeKind, PlanPage, Project, Pt, PropValue } from '../model/types';

/** Unité Volter : 1 = 1 cm ; Voltaplan : mm. */
const CM = 10;

type Props = Record<string, PropValue>;
interface Kind {
  kind: NodeKind;
  props?: Props;
  /** Organe de commande (interrupteur, bouton, relais) : commande les autres éléments du même groupe. */
  control?: boolean;
  /** Posé au mur : orientation automatique sur le plan. */
  wall?: boolean;
}

const sw = (switchType: string, extra: Props = {}): Kind => ({ kind: 'switch', props: { switchType, ...extra }, control: true, wall: true });
const light = (lightType: string, extra: Props = {}): Kind => ({ kind: 'light', props: { lightType, ...extra } });
const sock = (extra: Props = {}): Kind => ({ kind: 'socket', props: { earth: true, childSafety: true, ...extra }, wall: true });
const app = (applianceType: string, extra: Props = {}): Kind => ({ kind: 'appliance', props: { applianceType, ...extra } });
const other = (name: string, kind: NodeKind = 'other'): Kind => ({ kind, props: { name } });

/** Types de composants Volter → Voltaplan (clés relevées dans les fichiers d'essai). */
export const VOLTER_TYPES: Record<string, Kind> = {
  // Éclairage
  lightPoint: light('standard'),
  wallLight: { ...light('wall'), wall: true },
  spotLight: light('spot'),
  projectorDiverging: light('floodWide'),
  projectorNarrow: light('floodNarrow'),
  fluorescentLight: light('fluo'),
  emergencyLight: light('emergencyUnit'),
  emergencyLightSpecial: light('emergency'),
  builtInSwitchLight: light('withSwitch'),
  ballast: light('auxiliary'),
  // Interrupteurs et commandes
  singleSwitch: sw('single'),
  doubleSwitch: sw('double'),
  toggleSwitch: sw('twoWay'),
  crossSwitch: sw('intermediate'),
  dimmer: sw('dimmer'),
  twoPoleSwitch: sw('bipolar'),
  twoPoleSwitchIndicator: sw('bipolar', { pilotLight: true }),
  twoWayToggleSwitch: sw('twoWayBipolar'),
  tripleSwitch: sw('tripolar'),
  pullSwitch: sw('pullCord'),
  delayedSwitch: sw('delayed'),
  indicatorSwitch: sw('single', { pilotLight: true }),
  signalSwitch: sw('single', { signalLamp: true }),
  // « Contrôleur de ronde ou dispositif de verrouillage électrique par serrure » (tableau 2.23 E)
  roundControl: { kind: 'relay', props: { relayType: 'lockControl', inBoard: false }, control: true, wall: true },
  thermostat: { kind: 'relay', props: { relayType: 'thermostat', inBoard: false }, control: true, wall: true },
  pushButton: { kind: 'pushButton', control: true, wall: true },
  pushButtonIndicator: { kind: 'pushButton', props: { pilotLight: true }, control: true, wall: true },
  pushButtonProtected: { kind: 'pushButton', props: { protected: true }, control: true, wall: true },
  motionDetector: { kind: 'detector', props: { detectorType: 'motion' }, control: true },
  presenceDetector: { kind: 'detector', props: { detectorType: 'presence' }, control: true },
  impulseSwitch: { kind: 'relay', props: { relayType: 'teleswitch' }, control: true },
  timer: { kind: 'relay', props: { relayType: 'timer' }, control: true },
  timerClock: { kind: 'relay', props: { relayType: 'timeSwitch' }, control: true },
  // Prises
  singleOutlet: sock({ earth: false, childSafety: false }),
  groundedOutlet: sock({ childSafety: false }),
  childSafeGroundedOutlet: sock(),
  childSafeOutlet: sock({ earth: false }),
  waterproofOutlet: sock({ childSafety: false, splashProof: true }),
  hermeticChildSafeGroundedOutlet: sock({ splashProof: true }),
  transformerOutlet: sock({ socketKind: 'shaver' }),
  switchedOutlet: sock({ socketKind: 'switched' }),
  lockedSwitchedOutlet: sock({ socketKind: 'switchedLocked' }),
  ceeOutlet2P: sock({ childSafety: false, reference: 'CEE 2P+T' }),
  ceeOutlet3P: sock({ childSafety: false, threePhase: true, reference: 'CEE 3P+T' }),
  ceeOutlet3PN: sock({ childSafety: false, threePhase: true, reference: 'CEE 3P+N+T' }),
  dataOutlet: { kind: 'other', props: { otherType: 'dataOutlet' }, wall: true },
  coaxOutlet: { kind: 'other', props: { otherType: 'tvOutlet' }, wall: true },
  // Appareils
  oven: app('oven'),
  cooktop: app('hob'),
  boiler: app('electricWaterHeater'),
  boilerAccumulation: app('waterHeater'),
  washingMachine: app('washingMachine'),
  dryer: app('dryer'),
  dishwasher: app('dishwasher'),
  genericAppliance: app('other'),
  fridge: app('fridge'),
  freezer: app('freezer'),
  microwave: app('microwave'),
  fan: app('fan'),
  heater: app('heater'),
  heaterAccumulation: app('storageHeater'),
  heaterAccumulationFan: app('storageHeaterFan'),
  airco: app('airConditioner'),
  laadpaal: app('evCharger'),
  // Panneaux solaires et batteries
  solarPanel: { kind: 'solarPanel' },
  inverter: { kind: 'inverter', props: { inverterType: 'dcAc' } },
  inverterAcDc: { kind: 'inverter', props: { inverterType: 'acDc' } },
  battery: { kind: 'battery' },
  // Autres
  doorbell: { kind: 'bell', props: { bellType: 'bell' } },
  horn: { kind: 'bell', props: { bellType: 'horn' } },
  siren: { kind: 'bell', props: { bellType: 'siren' } },
  buzzer: { kind: 'bell', props: { bellType: 'buzzer' } },
  electricDoorLock: { kind: 'other', props: { otherType: 'doorStrike' } },
  clock: { kind: 'other', props: { otherType: 'clock' } },
  motherClock: { kind: 'other', props: { otherType: 'masterClock' } },
  kwhMeter: { kind: 'other', props: { otherType: 'subMeter' } },
  motor: { kind: 'motor' },
  transformer: { kind: 'transformer' },
  connectionBox: { kind: 'junctionBox', props: { name: 'Boîte de connexion' } },
  junctionBox: { kind: 'junctionBox' },
  alarmPanel: { kind: 'other', props: { otherType: 'alarmPanel' } },
  firePanel: { kind: 'other', props: { otherType: 'firePanel' } },
  distributionBoard: { kind: 'board', props: { name: 'Tableau de distribution' } },
};

/** Mobilier Volter (`meubels.soort`) → catalogue de Voltaplan (src/plan/furniture.tsx). */
const FURNITURE: Record<string, string> = {
  kookplaat: 'hob',
  spoelbak: 'sink',
  aanrecht: 'counter',
  wc: 'wc',
  wastafel: 'washbasin',
  dubbeleWastafel: 'doubleWashbasin',
  bad: 'bathtub',
  douche: 'shower',
  tafel: 'diningTable',
  rondeTafel: 'roundTable',
  zetel: 'sofa',
  hoekzetel: 'sofa',
  fauteuil: 'armchair',
  bed1: 'bedSingle',
  bed2: 'bedDouble',
  kleerkast: 'wardrobe',
};

const METHODS: Record<string, string> = { inMuur: 'inWall', opMuur: 'onWall', ondergronds: 'underground', inDeLucht: 'air' };

/** Réseau Volter (`spanning`) → libellé Voltaplan. */
export function volterSupply(s: unknown): string | undefined {
  const v = typeof s === 'string' ? s.replace(/\s/g, '').toLowerCase() : '';
  if (/^3x400v?\+?n/.test(v)) return '3N x 400V ~ 50Hz';
  if (/^3x230/.test(v)) return '3 x 230V ~ 50Hz';
  if (/^(2x230|1x230)/.test(v)) return '2 x 230V ~ 50Hz';
  return undefined;
}

// ——— lecture tolérante ———
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const pt = (v: unknown): Pt => (isObj(v) ? { x: (num(v.x) ?? 0) * CM, y: (num(v.y) ?? 0) * CM } : { x: 0, y: 0 });
const round = (p: Pt): Pt => ({ x: Math.round(p.x), y: Math.round(p.y) });

function clean(o: Props): Props {
  for (const k of Object.keys(o)) if (o[k] === undefined || o[k] === '') delete o[k];
  return o;
}

/** Attributs d'origine (valeurs simples) pour `node.source`. */
function attrs(o: Obj): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    if (k === 'position' || k === 'automaatIds') continue;
    if (v === null || v === undefined) continue;
    out[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
  }
  return out;
}

const poles = (v: unknown) => {
  const p = str(v);
  return p && /^[1-4]P(\+N)?$/.test(p) ? p : undefined;
};

export interface VolterImportResult {
  project: Project;
  warnings: string[];
}

export function importVolter(text: string, fileName = 'Projet Volter'): VolterImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    throw new Error("Ce fichier n'est pas une sauvegarde Volter valide (JSON illisible).");
  }
  if (!isObj(data) || !isObj(data.project) || !Array.isArray(data.boards)) throw new Error("Ce fichier n'est pas une sauvegarde Volter valide.");
  const warnings = new Set<string>();
  if (data.version !== 2) warnings.add(`Version de sauvegarde Volter ${String(data.version)} : seule la version 2 a été testée, vérifiez le résultat.`);
  const vp = data.project;
  const project = emptyProject();

  // ——— Métadonnées ———
  const werf = isObj(vp.werf) ? vp.werf : {};
  const inst = isObj(vp.installateur) ? vp.installateur : {};
  const supply = volterSupply(vp.spanning);
  if (!supply && vp.spanning) warnings.add(`Réseau Volter « ${String(vp.spanning)} » non reconnu : à choisir dans les infos du projet.`);
  const ean = arr(vp.eanCodes).map((e) => str(e.code)).find(Boolean);
  const email = str(inst.email);
  project.meta = {
    ...project.meta,
    title: str(vp.name) ?? str(werf.naam) ?? fileName.replace(/\.vschema$/i, ''),
    site: { street: str(werf.straat), postalCode: str(werf.postcode), city: str(werf.gemeente), country: 'Belgique' },
    installer: {
      name: str(inst.naam),
      vat: str(inst.btw),
      phone: str(inst.telefoon),
      email: email?.includes('@') ? email : undefined,
      address: { street: str(inst.straat), city: str(inst.gemeente) },
    },
    supply: supply ?? project.meta.supply,
    ean,
  };
  const updated = str(vp.updatedAt);
  if (updated && /^\d{4}-\d{2}-\d{2}/.test(updated)) project.meta.date = updated.slice(0, 10);
  // Période d'installation de Volter (« tot2020 »…) : sens exact non documenté, à confirmer par l'utilisateur
  if (str(vp.installatiePeriode)) warnings.add(`Période d'installation indiquée dans Volter : « ${String(vp.installatiePeriode)} ». Vérifiez le type d'installation et sa date dans les infos du projet.`);

  // ——— Composants, par circuit ———
  const floors = arr(vp.floors).sort((a, b) => (num(a.level) ?? 0) - (num(b.level) ?? 0));
  const nodeOf = new Map<string, ElNode>();
  const kindOf = new Map<string, Kind>();
  const byCircuit = new Map<string, Obj[]>();
  const loose: Obj[] = [];
  const links = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!links.has(a)) links.set(a, new Set());
    links.get(a)!.add(b);
  };
  for (const f of floors) {
    for (const c of arr(f.components)) {
      const id = str(c.id) ?? uid();
      const type = str(c.type) ?? '?';
      const k = VOLTER_TYPES[type] ?? other(type);
      if (!VOLTER_TYPES[type]) warnings.add(`Symbole Volter non reconnu, importé comme « autre » : ${type}`);
      const props: Props = { ...(k.props ?? {}) };
      const qty = num(c.quantity);
      if (qty && qty > 1 && (k.kind === 'socket' || k.kind === 'light' || k.kind === 'solarPanel')) props.count = qty;
      if (type === 'solarPanel' && num(c.wattpiek)) props.name = `${num(c.wattpiek)} Wc`;
      if (k.kind === 'inverter' && num(c.maximaalVermogen)) props.power = num(c.maximaalVermogen)! * 1000;
      if (isObj(c.ledmaat)) props.lightType = 'led';
      const node = createNode(k.kind, clean(props));
      node.id = id;
      const label = str(c.label);
      if (label) node.location = label;
      node.source = { format: 'volter', tag: type, attrs: attrs(c) };
      nodeOf.set(id, node);
      kindOf.set(id, k);
      const circuit = str(c.circuitId);
      if (circuit) {
        if (!byCircuit.has(circuit)) byCircuit.set(circuit, []);
        byCircuit.get(circuit)!.push(c);
      } else loose.push(c);
    }
    for (const l of arr(f.connections)) {
      const a = str(l.fromId);
      const b = str(l.toId);
      if (a && b) {
        link(a, b);
        link(b, a);
      }
    }
  }
  // Liaisons entre étages (ex. bouton-poussoir à l'étage commandant un télérupteur du rez) : liaisons ordinaires
  for (const l of arr(vp.crossFloorConnections)) {
    const a = str(l.fromId);
    const b = str(l.toId);
    if (a && b) {
      link(a, b);
      link(b, a);
    }
  }
  const allowed = (parent: ElNode, child: ElNode) => ALLOWED_CHILDREN[parent.kind]?.includes(child.kind) ?? false;

  /**
   * Points d'un circuit : les éléments reliés (liaisons de commande de Volter, sans sens fiable) forment un
   * groupe ; dans un groupe, les commandes s'enchaînent (bouton → télérupteur, va-et-vient → croisé → va-et-vient)
   * et les autres éléments sont commandés par la dernière. Ce que le modèle n'autorise pas reste sous le câble.
   */
  const circuitItems = (comps: Obj[]): ElNode[] => {
    const ids = comps.map((c) => str(c.id)).filter((x): x is string => !!x);
    const inCircuit = new Set(ids);
    const seen = new Set<string>();
    const out: ElNode[] = [];
    for (const start of ids) {
      if (seen.has(start)) continue;
      // Groupe connexe, parcouru depuis une extrémité (ordre du câblage de Volter)
      const group: string[] = [];
      const collect = (id: string) => {
        const stack = [id];
        while (stack.length) {
          const x = stack.pop()!;
          if (seen.has(x)) continue;
          seen.add(x);
          group.push(x);
          for (const y of links.get(x) ?? []) if (inCircuit.has(y) && !seen.has(y)) stack.push(y);
        }
      };
      collect(start);
      const controls = group.filter((id) => kindOf.get(id)?.control);
      const rank = (id: string) => ({ pushButton: 0, detector: 1, switch: 2, other: 2, relay: 3 } as Record<string, number>)[nodeOf.get(id)!.kind] ?? 2;
      controls.sort((a, b) => rank(a) - rank(b));
      const loads = group.filter((id) => !kindOf.get(id)?.control);
      // Sans commande (onduleur → panneaux, batterie) : l'élément le plus relié porte les autres
      if (!controls.length && loads.length > 1) loads.sort((a, b) => (links.get(b)?.size ?? 0) - (links.get(a)?.size ?? 0));
      let parent: ElNode | null = null;
      const attach = (n: ElNode) => {
        if (parent && allowed(parent, n)) parent.children.push(n);
        else out.push(n);
      };
      for (const id of controls) {
        const n = nodeOf.get(id)!;
        attach(n);
        parent = n;
      }
      const head = parent;
      for (const id of loads) {
        const n = nodeOf.get(id)!;
        if (!controls.length && !head && id !== loads[0]) parent = nodeOf.get(loads[0])!;
        attach(n);
      }
    }
    return out;
  };

  // ——— Tableaux ———
  const origin = project.roots[0];
  const meter = origin.children[0];
  meter.children = [];
  let mainBoard: ElNode | null = null;
  // Sous-tableaux : alimentés par un disjoncteur d'un autre tableau (`feedsBoardId`), placés sous son câble
  const boardsIn = arr(data.boards);
  const fed = new Set(boardsIn.flatMap((b) => arr(b.modules).map((m) => str(m.feedsBoardId)).filter((x): x is string => !!x)));
  const boardNode = new Map<string, ElNode>();
  const feeds: { cable: ElNode; boardId: string }[] = [];
  // Tableau principal (non alimenté par un autre) d'abord
  boardsIn.sort((a, b) => Number(fed.has(str(a.id) ?? '')) - Number(fed.has(str(b.id) ?? '')));
  for (const b of boardsIn) {
    const modules = arr(b.modules);
    const board = createNode('board', clean({ name: str(b.naam), fixedLetter: str(b.code) }));
    const boardId = str(b.id) ?? board.id;
    boardNode.set(boardId, board);
    board.source = { format: 'volter', tag: 'board', attrs: attrs(b) };
    const order = (m: Obj) => (num(m.rijIndex) ?? 0) * 1000 + (num(m.kolom) ?? num(m.position) ?? 0);
    const sorted = [...modules].sort((a, c) => order(a) - order(c));
    const protection = (m: Obj, props: Props): ElNode => {
      const n = createNode('protection', clean(props));
      n.id = str(m.id) ?? n.id;
      n.source = { format: 'volter', tag: str(m.moduleType) ?? 'module', attrs: attrs(m) };
      return n;
    };
    const rcd = (m: Obj) =>
      protection(m, {
        device: 'rcd',
        ratedCurrent: num(m.ampere),
        residualCurrent: num(m.foutstroom),
        poles: poles(m.polen),
        rcdType: str(m.rcdType),
        breakingCapacity: num(m.kortsluitstroom),
        circuitName: str(m.naam),
      });
    const mcb = (m: Obj): ElNode => {
      const n = protection(m, {
        device: 'mcb',
        circuitName: str(m.naam),
        ratedCurrent: num(m.ampere),
        poles: poles(m.polen),
        curve: str(m.breakerCurve),
        breakingCapacity: num(m.kortsluitstroom),
      });
      const cableType = str(m.kabelType);
      const cable = createNode(
        'cable',
        clean({
          cableType: cableType && (CABLE_TYPES as readonly string[]).includes(cableType) ? cableType : cableType ? 'other' : undefined,
          section: num(m.draaddikte),
          conductors: num(m.aantalAders),
          inConduit: typeof m.inBuis === 'boolean' ? m.inBuis : undefined,
          method: METHODS[str(m.kabelLocatie) ?? ''] ?? undefined,
          reference: str(m.cprClass) ? `CPR ${str(m.cprClass)}` : undefined,
        }),
      );
      cable.children = circuitItems(byCircuit.get(n.id) ?? []);
      const feedsBoard = str(m.feedsBoardId);
      if (feedsBoard) feeds.push({ cable, boardId: feedsBoard });
      byCircuit.delete(n.id);
      n.children = [cable];
      return n;
    };
    const main = sorted.find((m) => m.moduleType === 'hoofddifferentieel');
    const rcds = sorted.filter((m) => m.moduleType === 'differentieel');
    const mcbs = sorted.filter((m) => m.moduleType === 'automaat');
    for (const m of sorted)
      if (!['hoofddifferentieel', 'differentieel', 'automaat'].includes(String(m.moduleType))) warnings.add(`Module de tableau Volter non reconnu ignoré : ${String(m.moduleType)}`);
    const rcdNode = new Map(rcds.map((m) => [str(m.id)!, rcd(m)]));
    const placed = new Set<string>();
    // Disjoncteurs : sous leur différentiel (differentieelId, sinon liste automaatIds du différentiel)
    const ownerOf = (m: Obj) => str(m.differentieelId) ?? rcds.find((r) => Array.isArray(r.automaatIds) && r.automaatIds.includes(m.id))?.id;
    for (const m of rcds) {
      const n = rcdNode.get(str(m.id)!)!;
      for (const c of rcds)
        if (str(c.ouderId) === str(m.id) && c !== m) {
          n.children.push(rcdNode.get(str(c.id)!)!);
          placed.add(str(c.id)!);
        }
    }
    const top: ElNode[] = [];
    for (const m of mcbs) {
      const owner = ownerOf(m);
      const n = mcb(m);
      if (typeof owner === 'string' && rcdNode.has(owner)) rcdNode.get(owner)!.children.push(n);
      else top.push(n);
    }
    // Ordre de l'unifilaire de Volter : disjoncteurs sans différentiel, puis groupes des différentiels, chacun par
    // rangée puis colonne
    const firstLevel = [...rcds.filter((m) => !placed.has(str(m.id)!)).map((m) => ({ o: order(m), n: rcdNode.get(str(m.id)!)! })), ...mcbs.filter((m) => !(typeof ownerOf(m) === 'string' && rcdNode.has(ownerOf(m) as string))).map((m, i) => ({ o: order(m), n: top[i] }))];
    firstLevel.sort((a, c) => Number(a.n.props.device === 'rcd') - Number(c.n.props.device === 'rcd') || a.o - c.o);
    board.children = firstLevel.map((x) => x.n);
    // Repères de Volter (A, B, C… dans cet ordre, circuits vides compris ; « E-A » dans le sous-tableau de code E) :
    // ce sont ceux des étiquettes du tableau, gardés tels quels
    const prefix = str(b.code) ? `${str(b.code)}-` : '';
    let k = 0;
    const letter = (nodes: ElNode[]) => {
      for (const n of nodes) {
        if (n.kind !== 'protection') continue;
        if (n.props.device === 'mcb') n.props.fixedLetter = prefix + letterFor(k++);
        else letter(n.children);
      }
    };
    letter(board.children);
    if (fed.has(boardId)) continue;
    if (!mainBoard) {
      // Volter dessine toujours la terre sous le compteur : barrette et prise de terre (valeurs à compléter)
      board.children.push(createNode('earthBar', {}));
      board.children[board.children.length - 1].children.push(createNode('earth'));
      mainBoard = board;
      if (main) {
        const m = rcd(main);
        m.children = [board];
        meter.children.push(m);
      } else meter.children.push(board);
    } else mainBoard.children.splice(mainBoard.children.length - 1, 0, board);
  }
  if (!mainBoard) warnings.add('Aucun tableau dans la sauvegarde Volter.');
  // Face avant : rangée (rijIndex) et ordre (kolom, sinon position) de chaque appareil ; colonnes en modules d'après la
  // largeur des appareils (l'unité de « kolom » n'est pas celle des modules)
  const byId = new Map<string, ElNode>();
  const index = (ns: ElNode[]) => {
    for (const n of ns) {
      byId.set(n.id, n);
      index(n.children);
    }
  };
  index(meter.children);
  project.boards = { ...(project.boards ?? {}) };
  for (const b of boardsIn) {
    const node = boardNode.get(str(b.id) ?? '');
    if (!node) continue;
    const rowsOf = new Map<number, Obj[]>();
    for (const m of arr(b.modules)) rowsOf.set(num(m.rijIndex) ?? 0, [...(rowsOf.get(num(m.rijIndex) ?? 0) ?? []), m]);
    const slots: Record<string, { row: number; col: number }> = {};
    let perRow = 0;
    [...rowsOf.keys()].sort((x, y) => x - y).forEach((r, row) => {
      let col = 0;
      const ms = rowsOf.get(r)!.sort((x, y) => (num(x.kolom) ?? num(x.position) ?? -1) - (num(y.kolom) ?? num(y.position) ?? -1));
      for (const m of ms) {
        const n = byId.get(str(m.id) ?? '');
        if (!n) continue;
        slots[n.id] = { row, col };
        col += moduleWidth(n);
      }
      perRow = Math.max(perRow, col);
    });
    if (Object.keys(slots).length) {
      project.boards[node.id] = { slots };
      if (rowsOf.size > (Number(node.props.rows) || 2)) node.props.rows = rowsOf.size;
      if (perRow > (Number(node.props.modulesPerRow) || 13)) node.props.modulesPerRow = perRow;
    }
  }
  for (const id of fed) {
    const sub = boardNode.get(id);
    if (!sub) continue;
    const feed = feeds.find((f) => f.boardId === id);
    if (feed) feed.cable.children.push(sub);
    else if (mainBoard) mainBoard.children.splice(mainBoard.children.length - 1, 0, sub);
  }
  // Composants rattachés à un circuit absent, ou sans circuit : non raccordés
  for (const comps of byCircuit.values()) loose.push(...comps);
  project.loose = loose.map((c) => nodeOf.get(str(c.id)!)).filter((n): n is ElNode => !!n);
  if (project.loose.length) warnings.add(`${project.loose.length} symbole(s) Volter sans circuit : posés sur le plan, non raccordés.`);

  // ——— Plans (un étage = une page) ———
  project.plan = { pages: [], width: 20000, height: 15000 };
  let maxX = 0;
  let maxY = 0;
  const grow = (p: Pt) => {
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  };
  const skipped = new Set<string>();
  for (const f of floors) {
    const page: PlanPage = emptyPage(str(f.name) ?? `Niveau ${num(f.level) ?? 0}`);
    page.furniture = [];
    const walls = new Map<string, { a: Pt; b: Pt; thickness: number }>();
    for (const w of arr(f.walls)) {
      const a = pt(w.start);
      const b = pt(w.end);
      const thickness = (num(w.thickness) ?? 15) * CM;
      walls.set(str(w.id) ?? uid(), { a, b, thickness });
      page.walls.push({ a: round(a), b: round(b), thickness });
      grow(a);
      grow(b);
    }
    // Ouvertures : position = milieu de l'ouverture, en fraction de la longueur du mur ; largeur Volter = longueur
    // de l'ouverture (a → b). Voltaplan : `width` = épaisseur du mur percé (profondeur de l'ouverture)
    const opening = (o: Obj) => {
      const w = walls.get(str(o.wallId) ?? '');
      if (!w) return null;
      const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y) || 1;
      const ux = (w.b.x - w.a.x) / len;
      const uy = (w.b.y - w.a.y) / len;
      const width = (num(o.width) ?? 80) * CM;
      const mid = (num(o.position) ?? 0.5) * len;
      const s = Math.max(0, mid - width / 2);
      return { a: round({ x: w.a.x + ux * s, y: w.a.y + uy * s }), b: round({ x: w.a.x + ux * (s + width), y: w.a.y + uy * (s + width) }), width: w.thickness };
    };
    for (const d of arr(f.doors)) {
      const o = opening(d);
      if (!o) continue;
      // Genre de porte (`soort`) : absent = porte battante simple
      const soort = str(d.soort) ?? '';
      const kind = /^garage/i.test(soort) ? 'garageDoor' : /^schuif/i.test(soort) ? 'slidingDoor' : /^dubbel/i.test(soort) ? 'doubleDoor' : /^(raamdeur|franse)/i.test(soort) ? 'frenchDoor' : 'door';
      if (soort && kind === 'door') warnings.add(`Porte Volter de genre inconnu, dessinée comme une porte simple : ${soort}`);
      // Sens vérifié sur le plan de Volter (schéma d'essai 5) : `hingeSide` right = charnière au bout b du mur
      // (Voltaplan : mirrored) ; `openDirection` right = battant du côté -y local du mur (Voltaplan : hinge 'left')
      page.openings.push({ kind, ...o, hinge: d.openDirection === 'right' ? 'left' : 'right', mirrored: d.hingeSide === 'right' });
    }
    for (const d of arr(f.windows)) {
      const o = opening(d);
      if (o) page.openings.push({ kind: 'window', ...o });
    }
    const furniture = (kind: string, center: Pt, w: number, h: number, angle: number): Furniture => ({ id: uid(), kind, center: round(center), w: Math.round(w), h: Math.round(h), angle });
    for (const m of arr(f.meubels)) {
      const kind = FURNITURE[str(m.soort) ?? ''];
      if (!kind) {
        skipped.add(str(m.soort) ?? '?');
        continue;
      }
      // Volter : `position` = coin supérieur gauche du meuble (rotation autour de ce coin) ; Voltaplan : centre
      const w = (num(m.breedte) ?? 60) * CM;
      const h = (num(m.diepte) ?? 60) * CM;
      const angle = num(m.rotation) ?? 0;
      const corner = pt(m.position);
      const t = (angle * Math.PI) / 180;
      const center = { x: corner.x + (w / 2) * Math.cos(t) - (h / 2) * Math.sin(t), y: corner.y + (w / 2) * Math.sin(t) + (h / 2) * Math.cos(t) };
      page.furniture.push(furniture(kind, center, w, h, angle % 360));
    }
    for (const s of arr(f.architecturalElements)) {
      const c = pt(s.position);
      const r = (num(s.radius) ?? 0) * CM;
      if (s.kind === 'stairSpiral') page.furniture.push(furniture('spiralStairs', c, 2 * r, 2 * r, num(s.rotation) ?? 0));
      else if (s.kind === 'stairStraight') page.furniture.push(furniture('stairs', c, (num(s.width) ?? 80) * CM, (num(s.length) ?? 200) * CM, num(s.rotation) ?? 0));
      else if (s.kind === 'stairQuarterTurn') page.furniture.push(furniture('stairs', c, (num(s.legALength) ?? 140) * CM, (num(s.legBLength) ?? 120) * CM, num(s.rotation) ?? 0));
      else skipped.add(String(s.kind));
    }
    // Surfaces extérieures (jardin, terrasse, allée) : contour rectangulaire et nom
    for (const v of arr(f.buitenvlakken)) {
      const vorm = isObj(v.vorm) ? v.vorm : {};
      // Polygone (« veelhoek », points) ou cercle (« cirkel », centre et rayon)
      const radius = (num(vorm.straal) ?? 0) * CM;
      const mid = pt(vorm.midden);
      const pts =
        vorm.soort === 'cirkel' && radius > 0
          ? [
              { x: mid.x - radius, y: mid.y - radius },
              { x: mid.x + radius, y: mid.y + radius },
            ]
          : arr(vorm.punten).map(pt);
      if (pts.length < 2) {
        warnings.add(`Surface extérieure Volter de forme inconnue ignorée : ${String(vorm.soort)}.`);
        continue;
      }
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const x0 = Math.min(...xs);
      const y0 = Math.min(...ys);
      const center = { x: (x0 + Math.max(...xs)) / 2, y: (y0 + Math.max(...ys)) / 2 };
      page.rects.push({ center: round(center), w: Math.round(Math.max(...xs) - x0), h: Math.round(Math.max(...ys) - y0), angle: 0 });
      const name = str(v.naam);
      if (name) page.labels.push({ id: uid(), text: name, pos: round(center), size: 3 });
      if (vorm.soort !== 'veelhoek' || pts.length !== 4) warnings.add('Surface extérieure Volter non rectangulaire (cercle, forme libre) : reprise comme rectangle englobant.');
    }
    for (const l of arr(f.labels)) {
      const t = str(l.text);
      if (t) page.labels.push({ id: str(l.id) ?? uid(), text: t, pos: round(pt(l.position)), size: 3 });
    }
    for (const r of arr(f.rooms)) {
      const name = str(r.naam) ?? str(r.name);
      if (name && isObj(r.position)) page.labels.push({ id: uid(), text: name, pos: round(pt(r.position)), size: 3 });
    }
    for (const c of arr(f.components)) {
      const id = str(c.id);
      if (!id || !nodeOf.has(id)) continue;
      const p = pt(c.position);
      grow(p);
      const rotation = num(c.rotation) ?? 0;
      page.symbols.push({ nodeId: id, pos: round(p), rotation, ...(kindOf.get(id)?.wall && !rotation ? { autoRotate: true } : {}) });
    }
    project.plan.pages.push(page);
  }
  if (skipped.size) warnings.add(`Éléments d'aménagement Volter non repris (pas d'équivalent dans Voltaplan) : ${[...skipped].join(', ')}.`);
  if (!project.plan.pages.length) project.plan.pages.push(emptyPage('Rez-de-chaussée'));
  project.plan.width = Math.max(20000, Math.ceil((maxX + 2000) / 1000) * 1000);
  project.plan.height = Math.max(15000, Math.ceil((maxY + 2000) / 1000) * 1000);
  warnings.add('Volter ne sauvegarde ni le compteur ni la prise de terre : complétez le raccordement et la résistance de terre.');
  return { project, warnings: [...warnings] };
}
