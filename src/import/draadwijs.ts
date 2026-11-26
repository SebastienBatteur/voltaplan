/**
 * Import des projets Draadwijs (.draadwijs) — JSON, clés en néerlandais (« version » 3), établi sur quatre projets
 * d'exemple exportés par Draadwijs (habitation, appartement, secours, solaire/batterie/borne). Arbre du schéma
 * (raccordement → différentiels → disjoncteurs → points), plan en centimètres (murs, ouvertures, textes, symboles,
 * meubles repérés par leur centre), mesures. Un type inconnu devient « autre » avec un avertissement ; les données
 * d'origine de chaque élément sont gardées dans `node.source`.
 */
import { ALLOWED_CHILDREN, CABLE_TYPES } from '../model/schema';
import { createNode, emptyPage, emptyProject, uid } from '../model/tree';
import type { Address, ElNode, Furniture, NodeKind, PlanPage, Project, Pt, PropValue } from '../model/types';

/** Unité Draadwijs : 1 = 1 cm ; Voltaplan : mm. */
const CM = 10;

type Obj = Record<string, unknown>;
type Props = Record<string, PropValue>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : undefined);
/** Nombre, aussi écrit en texte avec une virgule (« 2,5 »). */
const num = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string' || !v.trim()) return undefined;
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};
const bool = (v: unknown) => (typeof v === 'boolean' ? v : undefined);
const clean = (o: Props): Props => {
  for (const k of Object.keys(o)) if (o[k] === undefined || o[k] === '') delete o[k];
  return o;
};
const cap = (s: string | undefined) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : undefined);

const POLES: Record<string, string> = { '1': '1P', '1+N': '1P+N', '2': '2P', '3': '3P', '4': '4P' };
const SWITCHES: Record<string, string> = {
  Enkelpolig: 'single',
  'Dubbel aansteek': 'double',
  Wissel: 'twoWay',
  Kruis: 'intermediate',
  Kruisschakelaar: 'intermediate',
  Dimmer: 'dimmer',
  Dubbelpolig: 'bipolar',
  Rolluik: 'shutter',
  Rolluikschakelaar: 'shutter',
  Trekschakelaar: 'pullCord',
};
const LIGHTS: Record<string, string> = { Gewoon: 'standard', 'TL / LED-armatuur': 'led', TL: 'fluo', LED: 'led', Spot: 'spot', Wandlamp: 'wall', Noodverlichting: 'emergency' };
const APPLIANCES: Record<string, string> = {
  Koelkast: 'fridge',
  Diepvriezer: 'freezer',
  Kookplaat: 'hob',
  Kookfornuis: 'cooker',
  Oven: 'oven',
  Microgolfoven: 'microwave',
  Vaatwasser: 'dishwasher',
  Wasmachine: 'washingMachine',
  Droogkast: 'dryer',
  Warmtepomp: 'heatPump',
  Boiler: 'waterHeater',
  Ventilator: 'fan',
  Laadpaal: 'evCharger',
};
/** Lieux de pose (« plaatsing ») → mode de pose Voltaplan. */
const METHODS: [RegExp, string][] = [
  [/in de wand|ingewerkt/i, 'inWall'],
  [/op de wand|opbouw/i, 'onWall'],
  [/ondergronds|in de grond/i, 'underground'],
  [/in de lucht|luchtlijn/i, 'air'],
];
/** Réseau Draadwijs (« net ») → libellé Voltaplan. */
export function draadwijsSupply(net: unknown): string | undefined {
  const v = typeof net === 'string' ? net.replace(/\s/g, '').toUpperCase() : '';
  if (/^4P400/.test(v)) return '3N x 400V ~ 50Hz';
  if (/^3P230/.test(v)) return '3 x 230V ~ 50Hz';
  if (/^2P230/.test(v)) return '2 x 230V ~ 50Hz';
  return undefined;
}
/** Meubles Draadwijs → catalogue Voltaplan. */
const FURNITURE: Record<string, string> = {
  bed1: 'bedSingle',
  bed2: 'bedDouble',
  douche: 'shower',
  bad: 'bathtub',
  wastafel: 'washbasin',
  dubbeleWastafel: 'doubleWashbasin',
  wc: 'wc',
  keuken: 'counter',
  aanrecht: 'counter',
  tafel: 'diningTable',
  rondeTafel: 'roundTable',
  zetel: 'sofa',
  fauteuil: 'armchair',
  kast: 'wardrobe',
  bureau: 'desk',
  trap: 'stairs',
  wenteltrap: 'spiralStairs',
  auto: 'car',
};

/** Adresse « Rue de l'Exemple 1 bus 3, 5000 Namur » → champs. */
export function parseAddress(s: string | undefined): Address {
  if (!s) return {};
  const m = /^\s*(.*?)\s+(\d+[A-Za-z]?)(?:\s+(?:bus|bte|boîte)\s+(\S+))?\s*,\s*(\d{4})\s+(.+?)\s*$/i.exec(s);
  if (!m) return { street: s.trim() };
  return { street: m[1], number: m[2], box: m[3], postalCode: m[4], city: m[5], country: 'Belgique' };
}

export interface DraadwijsImportResult {
  project: Project;
  warnings: string[];
}

export function importDraadwijs(text: string, fileName = 'Projet Draadwijs'): DraadwijsImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    throw new Error("Ce fichier n'est pas un projet Draadwijs valide (JSON illisible).");
  }
  if (!isObj(data) || !isObj(data.project) || !isObj(data.root)) throw new Error("Ce fichier n'est pas un projet Draadwijs valide.");
  const warnings = new Set<string>();
  if (data.version !== 3) warnings.add(`Version de fichier Draadwijs ${String(data.version)} : seule la version 3 a été testée, vérifiez le résultat.`);
  const dp = data.project;
  const root = data.root;
  const rp = isObj(root.props) ? root.props : {};
  const project = emptyProject();

  // ——— Métadonnées ———
  const supply = draadwijsSupply(rp.net);
  if (!supply && rp.net) warnings.add(`Réseau Draadwijs « ${String(rp.net)} » non reconnu : à choisir dans les infos du projet.`);
  const email = str(dp.klantEmail);
  project.meta = {
    ...project.meta,
    title: str(dp.naam) ?? fileName.replace(/\.draadwijs$/i, ''),
    client: { name: str(dp.klant), email: email?.includes('@') ? email : undefined, address: parseAddress(str(dp.klantAdres)) },
    site: parseAddress(str(dp.adres)),
    installer: { name: str(dp.installateur), quality: str(dp.hoedanigheid), vat: str(dp.btw), address: {} },
    supply: supply ?? project.meta.supply,
    earthing: rp.netsysteem === 'TN' ? 'TN' : rp.netsysteem === 'IT' ? 'IT' : 'TT',
    mainCurrent: num(rp.In),
    ean: str(dp.ean),
    docNumber: str(dp.nummer) ? `${str(dp.nummer)}${str(dp.versie) ? ' v' + str(dp.versie) : ''}` : project.meta.docNumber,
  };
  const date = str(dp.datum);
  if (date && /^\d{4}-\d{2}-\d{2}/.test(date)) project.meta.date = date.slice(0, 10);
  // « aanvang » : début des travaux (règles du RGIE applicables selon la date)
  const start = str(dp.aanvang);
  if (start && /^\d{4}(-\d{2}-\d{2})?$/.test(start)) project.meta.installationDate = start;

  // Mesures
  const met = isObj(data.metingen) ? data.metingen : {};
  project.measurements = {
    ...project.measurements,
    ...(num(rp.aarding) !== undefined ? { earthResistanceOhm: num(rp.aarding) } : {}),
    ...(num(met.isolatieAlgemeen) !== undefined ? { insulationMOhm: num(met.isolatieAlgemeen) } : {}),
    ...(typeof met.equipotentiaal === 'boolean' ? { bondingOk: met.equipotentiaal } : {}),
  };

  // ——— Schéma ———
  const nodeOf = new Map<string, ElNode>();
  const allowed = (parent: ElNode, child: ElNode) => ALLOWED_CHILDREN[parent.kind]?.includes(child.kind) ?? false;
  const make = (src: Obj, kind: NodeKind, props: Props, location?: string): ElNode => {
    const n = createNode(kind, clean(props));
    n.id = str(src.id) ?? n.id;
    const where = cap(location);
    if (where) n.location = where;
    const attrs: Record<string, string> = {};
    if (isObj(src.props)) for (const [k, v] of Object.entries(src.props)) if (v !== null && v !== '' && v !== undefined) attrs[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
    n.source = { format: 'draadwijs', tag: String(src.type), attrs };
    nodeOf.set(n.id, n);
    return n;
  };
  /** Ajoute un enfant, ou le remonte au premier ancêtre qui l'accepte (sinon sous le câble du circuit). */
  const attach = (parent: ElNode, child: ElNode, fallback?: ElNode) => {
    if (allowed(parent, child)) parent.children.push(child);
    else if (fallback && allowed(fallback, child)) fallback.children.push(child);
    else {
      warnings.add(`Draadwijs : « ${child.source?.tag ?? child.kind} » sous « ${parent.source?.tag ?? parent.kind} » rangé à côté (non admis par le modèle de Voltaplan).`);
      (fallback ?? parent).children.push(child);
    }
  };

  const convert = (src: Obj, parent: ElNode, cable?: ElNode): void => {
    const p = isObj(src.props) ? src.props : {};
    const type = String(src.type);
    const kids = arr(src.children);
    const plaats = str(p.plaats);
    switch (type) {
      case 'differentieel':
      case 'automaat': {
        const isRcd = type === 'differentieel' || /diff/i.test(String(p.beveiliging ?? ''));
        const device = type === 'differentieel' ? 'rcd' : /zekering|smelt/i.test(String(p.beveiliging ?? '')) ? 'fuse' : isRcd ? 'rcbo' : 'mcb';
        const prot = make(src, 'protection', {
          device,
          circuitName: str(p.omschrijving),
          fixedLetter: str(p.label),
          ratedCurrent: num(p.In),
          poles: POLES[String(p.polen ?? '')],
          curve: type === 'automaat' ? str(p.curve) : undefined,
          breakingCapacity: num(p.Icn) !== undefined ? num(p.Icn)! / 1000 : undefined,
          residualCurrent: type === 'differentieel' ? num(p.mA) : device === 'rcbo' ? num(p.diffMA) : undefined,
          rcdType: type === 'differentieel' ? str(p.type) : device === 'rcbo' ? str(p.diffType) : undefined,
          phase: ['L1', 'L2', 'L3'].includes(String(p.fase)) ? String(p.fase) : undefined,
          oldPart: p.oud === true ? true : undefined,
        });
        attach(parent, prot, cable);
        if (type === 'differentieel') {
          for (const c of kids) convert(c, prot);
          return;
        }
        const kt = str(p.kabeltype);
        const cableType = kt && (CABLE_TYPES as readonly string[]).includes(kt) ? kt : kt || str(p.kabelAnders) ? 'other' : undefined;
        const lay = String(p.plaatsing ?? '');
        const c = createNode(
          'cable',
          clean({
            cableType,
            section: num(p.sectie),
            conductors: num(p.aders),
            method: METHODS.find(([re]) => re.test(lay))?.[1],
            inConduit: /buis/i.test(lay) ? true : undefined,
            length: num(p.lengte) ? num(p.lengte) : undefined,
            reference: [str(p.kabelAnders), str(p.brandklasse) ? `CPR ${str(p.brandklasse)}` : undefined].filter(Boolean).join(' · ') || undefined,
          }),
        );
        prot.children.push(c);
        for (const k of kids) convert(k, c, c);
        return;
      }
      case 'bord': {
        const b = make(src, 'board', { name: str(p.naam) }, plaats);
        attach(parent, b, cable);
        for (const k of kids) convert(k, b);
        return;
      }
      case 'omschakelaar': {
        // Inverseur (source de secours) : coupure de tous les pôles ; règles propres à venir (idée D8)
        const sw = make(src, 'protection', { device: 'switch', circuitName: ['Inverseur', str(p.soort), str(p.bron)].filter(Boolean).join(' — ') });
        attach(parent, sw, cable);
        warnings.add("Inverseur de source (alimentation de secours) importé comme interrupteur-sectionneur : le contrôle de Voltaplan ne vérifie pas encore le fonctionnement sur la source de secours.");
        for (const k of kids) convert(k, sw);
        return;
      }
      default:
    }
    // Points d'utilisation et commandes
    let node: ElNode;
    let into: ElNode | undefined;
    switch (type) {
      case 'stopcontact':
        node = make(
          src,
          'socket',
          {
            count: num(p.aantal) ?? 1,
            earth: bool(p.aarding),
            childSafety: bool(p.kinderveiligheid),
            splashProof: p.waterdicht === true ? true : undefined,
            threePhase: p.driefasig === true ? true : undefined,
            wetRoom: p.vochtig === true ? 'yes' : undefined,
            reference: [p.usb === true ? 'USB' : '', p.schakelaar === true ? 'avec interrupteur' : '', p.scheiding === true ? 'transformateur de séparation' : ''].filter(Boolean).join(', ') || undefined,
          },
          plaats,
        );
        break;
      case 'schakelaar':
        node = make(src, 'switch', { switchType: SWITCHES[String(p.soort)] ?? 'single', splashProof: p.waterdicht === true ? true : undefined }, plaats);
        if (p.soort && !SWITCHES[String(p.soort)]) warnings.add(`Interrupteur Draadwijs « ${String(p.soort)} » importé comme simple allumage.`);
        break;
      case 'drukknop':
        node = make(src, 'pushButton', {}, plaats);
        break;
      case 'lichtpunt':
        node = make(
          src,
          'light',
          { lightType: LIGHTS[String(p.soort)] ?? 'standard', count: num(p.aantal) ?? 1, splashProof: p.waterdicht === true ? true : undefined, wetRoom: p.vochtig === true ? 'yes' : undefined, name: LIGHTS[String(p.soort)] ? undefined : str(p.soort) },
          plaats,
        );
        break;
      case 'bel':
        node = make(src, 'bell', {}, plaats);
        break;
      case 'toestel': {
        const soort = String(p.soort ?? '');
        if (/omvormer/i.test(soort)) node = make(src, 'inverter', { inverterType: /hybride/i.test(soort) ? 'acDc' : 'dcAc', power: num(p.vermogen) || undefined }, plaats);
        else node = make(src, 'appliance', { applianceType: APPLIANCES[soort] ?? 'other', power: num(p.vermogen) || undefined, name: APPLIANCES[soort] ? undefined : soort || undefined }, plaats);
        break;
      }
      case 'verwarming':
        node = make(src, 'appliance', { applianceType: 'heater', power: num(p.vermogen) || undefined, wetRoom: p.vochtig === true ? 'yes' : undefined, name: str(p.soort) }, plaats);
        break;
      case 'laadpaal':
        node = make(src, 'appliance', { applianceType: 'evCharger', power: num(p.kW) !== undefined ? num(p.kW)! * 1000 : undefined, name: str(p.fasen) }, plaats);
        break;
      case 'motor':
        node = make(src, 'motor', { power: num(p.vermogen) || undefined }, plaats);
        break;
      case 'zonnepanelen': {
        // Draadwijs : panneaux et onduleur en un seul élément → onduleur (puissance AC) portant les panneaux
        node = createNode('inverter', clean({ inverterType: 'dcAc', power: num(p.kVA) !== undefined ? num(p.kVA)! * 1000 : undefined }));
        if (plaats) node.location = cap(plaats);
        const panels = make(src, 'solarPanel', { count: num(p.panelen), name: num(p.Wp) ? `${num(p.Wp)} Wc` : undefined }, plaats);
        node.children.push(panels);
        break;
      }
      case 'batterij':
        node = make(src, 'battery', { capacity: num(p.kWh), power: num(p.kVA) !== undefined ? num(p.kVA)! * 1000 : undefined }, plaats);
        break;
      case 'aansluitpunt':
        node = make(src, 'junctionBox', { name: str(p.omschrijving) ?? 'Point de raccordement' }, plaats);
        into = node;
        break;
      default:
        node = make(src, 'other', { name: type }, plaats);
        warnings.add(`Élément Draadwijs non reconnu, importé comme « autre » : ${type}`);
    }
    attach(parent, node, cable);
    for (const k of kids) convert(k, into ?? node, cable);
  };

  // Raccordement : origine → compteur (porte l'id du raccordement : son symbole du plan) → tableau principal
  const origin = project.roots[0];
  const meter = origin.children[0];
  meter.id = str(root.id) ?? meter.id;
  meter.props = clean({ ...meter.props, name: str(rp.kabel) });
  nodeOf.set(meter.id, meter);
  const board = createNode('board', { name: 'Tableau principal' });
  meter.children = [board];
  for (const c of arr(root.children)) convert(c, board);
  // Terre : barrette (« meetklem ») et prise de terre (« aarding ») en fin de tableau
  const earthBar = createNode('earthBar', {});
  const earth = createNode('earth', clean({ name: str(met.aardelektrode) }));
  earthBar.children.push(earth);
  board.children.push(earthBar);

  // ——— Plan ———
  const pt = (x: unknown, y: unknown): Pt => ({ x: Math.round((num(x) ?? 0) * CM), y: Math.round((num(y) ?? 0) * CM) });
  const plan = isObj(data.plan) ? data.plan : {};
  project.plan = { pages: [], width: 20000, height: 15000 };
  let maxX = 0;
  let maxY = 0;
  const grow = (p: Pt) => {
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  };
  const skipped = new Set<string>();
  for (const f of arr(plan.floors)) {
    const page: PlanPage = emptyPage(str(f.naam) ?? 'Plan');
    page.furniture = [];
    const walls = new Map<string, { a: Pt; b: Pt; thickness: number }>();
    for (const w of arr(f.walls)) {
      const a = pt(w.x1, w.y1);
      const b = pt(w.x2, w.y2);
      const thickness = (num(w.dikte) ?? 15) * CM;
      walls.set(str(w.id) ?? uid(), { a, b, thickness });
      page.walls.push({ a, b, thickness });
      grow(a);
      grow(b);
    }
    // Ouvertures : « t » = milieu de l'ouverture en fraction du mur ; « breedte » = largeur (cm). Voltaplan : `width`
    // = épaisseur du mur percé. « flip » : charnière à l'autre bout ; « kant » : battant de l'autre côté du mur.
    for (const o of arr(f.openings)) {
      const w = walls.get(str(o.wallId) ?? '');
      if (!w) continue;
      const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y) || 1;
      const ux = (w.b.x - w.a.x) / len;
      const uy = (w.b.y - w.a.y) / len;
      const width = (num(o.breedte) ?? 90) * CM;
      const s = Math.max(0, (num(o.t) ?? 0.5) * len - width / 2);
      const a = { x: Math.round(w.a.x + ux * s), y: Math.round(w.a.y + uy * s) };
      const b = { x: Math.round(w.a.x + ux * (s + width)), y: Math.round(w.a.y + uy * (s + width)) };
      const soort = String(o.soort ?? '');
      const kind = soort === 'raam' ? 'window' : soort === 'poort' ? 'garageDoor' : soort === 'schuifdeur' ? 'slidingDoor' : soort === 'dubbeleDeur' ? 'doubleDoor' : 'door';
      if (!['raam', 'poort', 'deur', 'schuifdeur', 'dubbeleDeur'].includes(soort)) warnings.add(`Ouverture Draadwijs « ${soort} » dessinée comme une porte.`);
      page.openings.push({ kind, a, b, width: w.thickness, ...(kind === 'window' ? {} : { hinge: o.kant === true ? 'right' : 'left', mirrored: o.flip === true }) });
    }
    for (const tx of arr(f.texts)) {
      const t = str(tx.tekst);
      if (t) page.labels.push({ id: str(tx.id) ?? uid(), text: t, pos: pt(tx.x, tx.y), size: 3 });
    }
    for (const s of arr(f.symbols)) {
      const id = str(s.nodeId);
      if (!id || !nodeOf.has(id)) continue;
      const pos = pt(s.x, s.y);
      grow(pos);
      page.symbols.push({ nodeId: id, pos, rotation: num(s.rot) ?? 0 });
    }
    // Meubles (centre, largeur, profondeur en cm) ; compteur, barrette et prise de terre : symboles électriques
    const placedHere = new Set(page.symbols.map((s) => s.nodeId));
    for (const m of arr(f.meubels)) {
      const soort = String(m.soort ?? '');
      const center = pt(m.x, m.y);
      const elec = soort === 'teller' ? meter : soort === 'meetklem' ? earthBar : soort === 'aarding' ? earth : undefined;
      if (elec) {
        if (!placedHere.has(elec.id)) {
          page.symbols.push({ nodeId: elec.id, pos: center, rotation: num(m.rot) ?? 0 });
          placedHere.add(elec.id);
        }
        continue;
      }
      if (soort === 'equipotentiaal') {
        page.labels.push({ id: uid(), text: 'Liaison équipotentielle principale', pos: center, size: 2 });
        continue;
      }
      const kind = FURNITURE[soort];
      if (!kind) {
        skipped.add(soort);
        continue;
      }
      const fu: Furniture = { id: str(m.id) ?? uid(), kind, center, w: Math.round((num(m.w) ?? 60) * CM), h: Math.round((num(m.h) ?? 60) * CM), angle: num(m.rot) ?? 0 };
      page.furniture.push(fu);
    }
    project.plan.pages.push(page);
  }
  if (skipped.size) warnings.add(`Meubles Draadwijs non repris (pas d'équivalent dans Voltaplan) : ${[...skipped].join(', ')}.`);
  if (!project.plan.pages.length) project.plan.pages.push(emptyPage('Rez-de-chaussée'));
  project.plan.width = Math.max(20000, Math.ceil((maxX + 2000) / 1000) * 1000);
  project.plan.height = Math.max(15000, Math.ceil((maxY + 2000) / 1000) * 1000);
  if (isObj(data.offerte)) warnings.add('Devis Draadwijs (taux horaire, TVA, remise) non repris : Voltaplan ne fait pas de devis.');
  return { project, warnings: [...warnings] };
}
