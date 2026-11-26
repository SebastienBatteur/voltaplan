/**
 * Import des projets PlanElec Sketch (export « .planelec.json », « format » planelec-sketch, « version » 2), établi
 * sur trois projets d'essai exportés de sketch.planelec.be. Schéma en arbre proche de celui de Voltaplan
 * (raccordement → compteur → différentiels → groupes → disjoncteurs → câble → points) ; plan en mètres (nœuds et
 * murs, ouvertures, pièces, escaliers, textes, formes et meubles) ; symboles posés sur une feuille en mm à
 * l'échelle 1:`scale`. Un type inconnu devient « autre » avec un avertissement ; les données d'origine de chaque
 * élément sont gardées dans `node.source`.
 */
import { ALLOWED_CHILDREN, CABLE_TYPES } from '../model/schema';
import { createNode, emptyPage, emptyProject, letterFor, uid } from '../model/tree';
import type { ElNode, Furniture, NodeKind, PlanPage, Project, Pt, PropValue } from '../model/types';
import { parseAddress } from './draadwijs';

type Obj = Record<string, unknown>;
type Props = Record<string, PropValue>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : undefined);
const num = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string' || !v.trim()) return undefined;
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};
const clean = (o: Props): Props => {
  for (const k of Object.keys(o)) if (o[k] === undefined || o[k] === '') delete o[k];
  return o;
};

/** Fichier PlanElec Sketch ? (d'après le début du texte, pour un .json quelconque) */
export const isPlanelec = (head: string) => /"format"\s*:\s*"planelec-sketch"/.test(head);

const POLES: Record<string, string> = { '1': '1P', '1+N': '1P+N', '2': '2P', '3': '3P', '4': '4P', '3+N': '4P' };
const SWITCHES: Record<string, string> = { single: 'single', double: 'double', twoWay: 'twoWay', 'two-way': 'twoWay', intermediate: 'intermediate', cross: 'intermediate', bipolar: 'bipolar', 'two-pole': 'bipolar' };
const APPLIANCES: Record<string, string> = {
  cooker: 'cooker',
  hob: 'hob',
  oven: 'oven',
  microwave: 'microwave',
  fridge: 'fridge',
  freezer: 'freezer',
  dishwasher: 'dishwasher',
  'washing-machine': 'washingMachine',
  dryer: 'dryer',
  'water-heater': 'waterHeater',
  boiler: 'boiler',
  'heat-pump': 'heatPump',
  heater: 'heater',
  fan: 'fan',
  'ev-charger': 'evCharger',
};
const METHODS: Record<string, string> = { 'in-wall': 'inWall', 'on-wall': 'onWall', underground: 'underground', air: 'air' };
/** Réseau PlanElec (« supply ») → libellé Voltaplan. */
export function planelecSupply(s: unknown): string | undefined {
  const v = typeof s === 'string' ? s.replace(/\s/g, '').toLowerCase() : '';
  if (/^3x400(v)?\+?n|^3n/.test(v)) return '3N x 400V ~ 50Hz';
  if (/^3x230/.test(v)) return '3 x 230V ~ 50Hz';
  if (/^(2x230|1x230)/.test(v)) return '2 x 230V ~ 50Hz';
  return undefined;
}
/** Meubles (« clipart ») → catalogue Voltaplan. */
const FURNITURE: Record<string, string> = {
  bathtub: 'bathtub',
  shower: 'shower',
  toilet: 'wc',
  washbasin: 'washbasin',
  doubleWashbasin: 'doubleWashbasin',
  bedSingle: 'bedSingle',
  bedDouble: 'bedDouble',
  loungeSofa: 'sofa',
  sofa: 'sofa',
  loungeChair: 'armchair',
  armchair: 'armchair',
  table: 'diningTable',
  tableRound: 'roundTable',
  wardrobe: 'wardrobe',
  desk: 'desk',
  sink: 'sink',
  hob: 'hob',
  fridge: 'fridge',
  car: 'car',
};
/** Symboles libres du plan (« elements ») : préfixe de `symbolId` → élément Voltaplan non raccordé. */
const ELEMENTS: [RegExp, NodeKind, string?][] = [
  [/^junction/, 'junctionBox'],
  [/^domotics/, 'domotic'],
  [/^appliance$/, 'appliance'],
  [/^sounder-/, 'bell'],
  [/^lock-door-opener/, 'other'],
  [/^detector-/, 'detector'],
  [/^(data-outlet|tv-outlet|phone-outlet)/, 'other'],
  [/^(communication|lock|security|emergency)/, 'other'],
];

export interface PlanelecImportResult {
  project: Project;
  warnings: string[];
}

export function importPlanelec(text: string, fileName = 'Projet PlanElec'): PlanelecImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    throw new Error("Ce fichier n'est pas un projet PlanElec valide (JSON illisible).");
  }
  if (!isObj(data) || data.format !== 'planelec-sketch' || !isObj(data.singleLine) || !isObj(data.singleLine.root))
    throw new Error("Ce fichier n'est pas un projet PlanElec Sketch valide.");
  const warnings = new Set<string>();
  if (data.version !== 2) warnings.add(`Version de fichier PlanElec ${String(data.version)} : seule la version 2 a été testée, vérifiez le résultat.`);
  const meta = isObj(data.meta) ? data.meta : {};
  const root = data.singleLine.root;
  const rp = isObj(root.props) ? root.props : {};
  const project = emptyProject();

  // ——— Métadonnées ———
  const supply = planelecSupply(rp.supply);
  if (!supply && rp.supply) warnings.add(`Réseau PlanElec « ${String(rp.supply)} » non reconnu : à choisir dans les infos du projet.`);
  const email = (v: unknown) => (str(v)?.includes('@') ? str(v) : undefined);
  const customerAddress = parseAddress(str(meta.customerAddress));
  project.meta = {
    ...project.meta,
    title: str(data.title) ?? fileName.replace(/(\.planelec)?\.json$/i, ''),
    client: { name: str(meta.customerName), email: email(meta.customerEmail), address: customerAddress },
    site: meta.siteSameAsCustomer === true ? customerAddress : parseAddress(str(meta.siteAddress)),
    installer: { name: str(meta.installerName), vat: str(meta.installerVat), phone: str(meta.installerPhone), email: email(meta.installerEmail), address: parseAddress(str(meta.installerAddress)) },
    inspectionBodyName: str(meta.inspectionBodyName),
    supply: supply ?? project.meta.supply,
    earthing: rp.earthing === 'TN' ? 'TN' : rp.earthing === 'IT' ? 'IT' : 'TT',
    ean: str(meta.ean),
  };
  const date = str(meta.date);
  if (date && /^\d{4}-\d{2}-\d{2}/.test(date)) project.meta.date = date.slice(0, 10);

  // ——— Schéma ———
  const nodeOf = new Map<string, ElNode>();
  const allowed = (parent: ElNode, child: ElNode) => ALLOWED_CHILDREN[parent.kind]?.includes(child.kind) ?? false;
  const make = (src: Obj, kind: NodeKind, props: Props, location?: string): ElNode => {
    const n = createNode(kind, clean(props));
    n.id = str(src.id) ?? n.id;
    if (location) n.location = location;
    const attrs: Record<string, string> = {};
    if (isObj(src.props)) for (const [k, v] of Object.entries(src.props)) if (v !== null && v !== '' && v !== undefined) attrs[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
    n.source = { format: 'planelec', tag: String(src.family), attrs };
    nodeOf.set(n.id, n);
    return n;
  };
  const attach = (parent: ElNode, child: ElNode) => {
    if (!allowed(parent, child)) warnings.add(`PlanElec : « ${child.source?.tag ?? child.kind} » sous « ${parent.source?.tag ?? parent.kind} » gardé tel quel (non prévu par le modèle de Voltaplan).`);
    parent.children.push(child);
  };
  let earthResistance: number | undefined;
  // Repères comme dans PlanElec : une lettre par protection dans l'ordre du schéma, différentiels compris (A = général)
  let nextLetter = 0;

  const convert = (src: Obj, parent: ElNode): void => {
    const p = isObj(src.props) ? src.props : {};
    const family = String(src.family);
    const kids = arr(src.children);
    const text = str(p.text) ?? str(p.location);
    let node: ElNode;
    switch (family) {
      case 'meter':
        node = make(src, 'meter', {});
        break;
      case 'breaker': {
        const kind = String(p.kind ?? 'mcb');
        const device = kind === 'rcd' ? 'rcd' : kind === 'rcbo' ? 'rcbo' : kind === 'fuse' ? 'fuse' : kind === 'switch' || kind === 'isolator' ? 'switch' : 'mcb';
        const residual = device === 'rcd' || device === 'rcbo';
        const letter = letterFor(nextLetter++);
        node = make(src, 'protection', {
          device,
          circuitName: str(src.circuitName),
          fixedLetter: device === 'rcd' ? undefined : letter,
          ratedCurrent: num(p.ratedCurrent),
          poles: POLES[String(p.poles ?? '')],
          curve: device === 'mcb' || device === 'rcbo' ? str(p.curve) : undefined,
          // Pouvoir de coupure : en A dans PlanElec (« 3000 ») ou en kA ; Voltaplan : kA
          breakingCapacity: num(p.breakingCapacity) !== undefined ? (num(p.breakingCapacity)! >= 100 ? num(p.breakingCapacity)! / 1000 : num(p.breakingCapacity)) : undefined,
          // Disjoncteur simple : PlanElec y recopie la sensibilité du différentiel en amont, sans signification
          residualCurrent: residual ? num(p.residualCurrent) : undefined,
          rcdType: residual ? str(p.rcdType) : undefined,
          phase: ['L1', 'L2', 'L3'].includes(String(p.phase)) ? String(p.phase) : undefined,
        });
        if (kind && !['rcd', 'rcbo', 'fuse', 'mcb', 'switch', 'isolator'].includes(kind)) warnings.add(`Protection PlanElec « ${kind} » importée comme disjoncteur.`);
        break;
      }
      case 'board':
        node = make(src, 'board', { name: str(p.name) ?? str(src.circuitName), fixedLetter: str(p.number) }, str(p.location));
        break;
      case 'cable': {
        const t = str(p.type);
        node = make(src, 'cable', {
          cableType: t && (CABLE_TYPES as readonly string[]).includes(t) ? t : t ? 'other' : undefined,
          section: num(p.crossSection),
          conductors: num(p.cores),
          method: METHODS[String(p.installation ?? '')],
          inConduit: typeof p.inConduit === 'boolean' ? p.inConduit : undefined,
          length: num(p.length) ? num(p.length) : undefined,
          reference: str(p.fireClass) ? `CPR ${str(p.fireClass)}` : undefined,
        });
        break;
      }
      case 'earth':
        earthResistance = num(p.resistance);
        node = make(src, 'earthBar', {});
        node.children.push(createNode('earth'));
        break;
      case 'switch': {
        const k = String(p.kind ?? 'single');
        const switchType = p.dimmer === true ? 'dimmer' : p.pull === true ? 'pullCord' : p.shutter === true ? 'shutter' : (SWITCHES[k] ?? 'single');
        if (!SWITCHES[k]) warnings.add(`Interrupteur PlanElec « ${k} » importé comme simple allumage.`);
        node = make(src, 'switch', { switchType, pilotLight: p.pilotLamp === true ? true : undefined, signalLamp: p.signalLamp === true ? true : undefined, splashProof: p.splashProof === true ? true : undefined }, text);
        break;
      }
      case 'luminaire': {
        const k = String(p.kind ?? 'standard');
        const lightType = p.emergency && p.emergency !== 'none' ? 'emergency' : k === 'fluorescent' ? 'fluo' : k === 'led' ? 'led' : k === 'spot' ? 'spot' : k === 'wall' ? 'wall' : 'standard';
        node = make(src, 'light', { lightType, count: num(p.count) ?? 1, splashProof: p.splashProof === true ? true : undefined }, text);
        break;
      }
      case 'socket':
        node = make(
          src,
          'socket',
          {
            count: num(p.count) ?? 1,
            earth: typeof p.pe === 'boolean' ? p.pe : undefined,
            childSafety: typeof p.childProtection === 'boolean' ? p.childProtection : undefined,
            splashProof: p.splashProof === true ? true : undefined,
            threePhase: String(p.phases) === '3' ? true : undefined,
            reference: [p.usb === true ? 'USB' : '', p.builtInSwitch === true ? 'avec interrupteur' : ''].filter(Boolean).join(', ') || undefined,
          },
          text,
        );
        break;
      case 'appliance': {
        const k = String(p.kind ?? '');
        node = make(src, 'appliance', { applianceType: APPLIANCES[k] ?? 'other', name: APPLIANCES[k] ? undefined : k || undefined }, text);
        break;
      }
      case 'pushButton':
      case 'push-button':
        node = make(src, 'pushButton', {}, text);
        break;
      default:
        node = make(src, 'other', { name: family }, text);
        warnings.add(`Élément PlanElec non reconnu, importé comme « autre » : ${family}`);
    }
    attach(parent, node);
    for (const k of kids) convert(k, node);
  };

  // Raccordement : origine (porte l'id du raccordement PlanElec), puis l'arbre tel quel
  const origin = project.roots[0];
  origin.id = str(root.id) ?? origin.id;
  origin.children = [];
  nodeOf.set(origin.id, origin);
  for (const c of arr(root.children)) convert(c, origin);
  if (earthResistance !== undefined) project.measurements = { ...project.measurements, earthResistanceOhm: earthResistance };
  if (arr(data.singleLine.notes).length || arr(root.notes).length) warnings.add('Notes du schéma PlanElec non reprises.');

  // ——— Plan ———
  const plan = isObj(data.situation) ? data.situation : {};
  project.plan = { pages: [], width: 20000, height: 15000 };
  let maxX = 0;
  let maxY = 0;
  const grow = (p: Pt) => {
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  };
  const skipped = new Set<string>();
  arr(plan.floors).forEach((f, fi) => {
    const page: PlanPage = emptyPage(str(f.name) ?? (fi === 0 ? 'Rez-de-chaussée' : `Niveau ${fi}`));
    page.furniture = [];
    const fp = isObj(f.floorPlan) ? f.floorPlan : {};
    const org = isObj(fp.origin) ? fp.origin : {};
    // Plan en mètres (repère du plan) ; symboles posés sur la feuille en mm, à l'échelle 1:scale
    const scale = num(f.scale) ?? 50;
    const m = (x: unknown, y: unknown): Pt => ({ x: Math.round(((num(x) ?? 0) - (num(org.x) ?? 0)) * 1000), y: Math.round(((num(y) ?? 0) - (num(org.y) ?? 0)) * 1000) });
    const sheet = (v: unknown): Pt => (isObj(v) ? { x: Math.round((num(v.x) ?? 0) * scale), y: Math.round((num(v.y) ?? 0) * scale) } : { x: 0, y: 0 });
    const nodes = new Map(arr(fp.nodes).map((n) => [str(n.id) ?? '', m(n.x, n.y)]));
    for (const w of arr(fp.walls)) {
      const a = nodes.get(str(w.fromNodeId) ?? '');
      const b = nodes.get(str(w.toNodeId) ?? '');
      if (!a || !b) continue;
      const thickness = Math.round((num(w.thickness) ?? 0.15) * 1000);
      page.walls.push({ a, b, thickness });
      grow(a);
      grow(b);
      // Ouvertures : « positionRatio » = milieu de l'ouverture sur le mur ; « width » en m. Sens des portes :
      // INWARD = battant du côté -y local du mur (Voltaplan : hinge 'left'), OUTWARD = côté +y ; RIGHT = charnière au
      // bout d'arrivée du mur (mirrored). Vérifié sur cinq portes du plan affiché par PlanElec (projet d'essai 3).
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ux = (b.x - a.x) / len;
      const uy = (b.y - a.y) / len;
      for (const o of arr(w.openings)) {
        const width = (num(o.width) ?? 0.9) * 1000;
        const s = Math.max(0, (num(o.positionRatio) ?? 0.5) * len - width / 2);
        const oa = { x: Math.round(a.x + ux * s), y: Math.round(a.y + uy * s) };
        const ob = { x: Math.round(a.x + ux * (s + width)), y: Math.round(a.y + uy * (s + width)) };
        const type = String(o.type ?? '');
        const variant = String(o.doorVariant ?? 'SINGLE');
        const swing = String(o.swingDirection ?? '');
        if (type === 'WINDOW') page.openings.push({ kind: 'window', a: oa, b: ob, width: thickness });
        else if (type === 'GARAGE_DOOR') page.openings.push({ kind: 'garageDoor', a: oa, b: ob, width: thickness });
        else if (type === 'DOOR') {
          if (variant === 'PASSAGE') {
            // Baie libre (sans porte) : Voltaplan n'a pas d'ouverture vide ; dessinée comme une baie (trait pointillé)
            page.openings.push({ kind: 'garageDoor', a: oa, b: ob, width: thickness });
            continue;
          }
          page.openings.push({
            kind: variant === 'DOUBLE' ? 'doubleDoor' : variant === 'SLIDING' ? 'slidingDoor' : 'door',
            a: oa,
            b: ob,
            width: thickness,
            hinge: /^OUTWARD/.test(swing) ? 'right' : 'left',
            mirrored: /RIGHT$/.test(swing),
          });
        } else warnings.add(`Ouverture PlanElec « ${type} » ignorée.`);
      }
    }
    // Pièces : nom au centre (sommets du contour)
    for (const r of arr(fp.rooms)) {
      const label = str(r.label);
      const pts = (Array.isArray(r.boundaryNodeIds) ? r.boundaryNodeIds : []).map((id) => nodes.get(String(id))).filter((p): p is Pt => !!p);
      if (label && pts.length) page.labels.push({ id: uid(), text: label, pos: { x: Math.round(pts.reduce((s, p) => s + p.x, 0) / pts.length), y: Math.round(pts.reduce((s, p) => s + p.y, 0) / pts.length) }, size: 3 });
    }
    for (const st of arr(fp.stairs)) {
      const spiral = isObj(st.spiral) ? st.spiral : undefined;
      const w = (num(st.width) ?? 1) * 1000;
      if (spiral && isObj(spiral.center)) {
        const c = m(spiral.center.x, spiral.center.y);
        page.furniture.push({ id: str(st.id) ?? uid(), kind: 'spiralStairs', center: c, w: 2 * w, h: 2 * w, angle: 0 });
      } else if (isObj(st.from) && isObj(st.to)) {
        const a = m(st.from.x, st.from.y);
        const b = m(st.to.x, st.to.y);
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI - 90;
        page.furniture.push({ id: str(st.id) ?? uid(), kind: 'stairs', center: { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) }, w: Math.round(w), h: Math.round(len), angle: Math.round(angle) });
      }
    }
    for (const tx of arr(fp.texts)) {
      const t = str(tx.text);
      if (t && isObj(tx.position)) page.labels.push({ id: str(tx.id) ?? uid(), text: t, pos: m(tx.position.x, tx.position.y), size: 3 });
    }
    for (const sh of arr(fp.shapes)) {
      const k = String(sh.kind);
      if (k === 'clipart') {
        const kind = FURNITURE[String(sh.clipart)];
        if (!kind || !isObj(sh.center)) {
          skipped.add(String(sh.clipart));
          continue;
        }
        const fu: Furniture = { id: str(sh.id) ?? uid(), kind, center: m(sh.center.x, sh.center.y), w: Math.round((num(sh.width) ?? 1) * 1000), h: Math.round((num(sh.height) ?? 1) * 1000), angle: num(sh.rotation) ?? 0 };
        page.furniture.push(fu);
      } else if (k === 'rectangle' && isObj(sh.center)) {
        page.rects.push({ center: m(sh.center.x, sh.center.y), w: Math.round((num(sh.width) ?? 1) * 1000), h: Math.round((num(sh.height) ?? 1) * 1000), angle: num(sh.rotation) ?? 0 });
      } else if (k === 'area' || k === 'line') {
        // Voltaplan n'a pas de polyligne : surface → rectangle englobant ; trait → ignoré
        const pts = arr(sh.points).map((q) => m(q.x, q.y));
        if (k === 'area' && pts.length > 1) {
          const xs = pts.map((q) => q.x);
          const ys = pts.map((q) => q.y);
          const x0 = Math.min(...xs);
          const y0 = Math.min(...ys);
          page.rects.push({ center: { x: Math.round((x0 + Math.max(...xs)) / 2), y: Math.round((y0 + Math.max(...ys)) / 2) }, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0, angle: 0 });
        } else skipped.add('trait');
      } else skipped.add(k);
    }
    // Symboles du schéma posés sur le plan (un seul par élément et par page)
    const placed = new Set<string>();
    for (const pl of arr(f.placements)) {
      const id = str(pl.nodeId);
      if (!id || !nodeOf.has(id)) continue;
      if (placed.has(id)) {
        warnings.add('Élément PlanElec posé plusieurs fois sur un même plan : seule la première position est reprise.');
        continue;
      }
      placed.add(id);
      const pos = sheet(pl.position);
      grow(pos);
      page.symbols.push({ nodeId: id, pos, rotation: num(pl.rotation) ?? 0 });
    }
    // Symboles libres (hors schéma) : éléments non raccordés
    for (const el of arr(f.elements)) {
      const sid = String(el.symbolId ?? '');
      const pos = sheet(el.position);
      if (sid === 'meter') {
        const meter = [...nodeOf.values()].find((n) => n.kind === 'meter');
        if (meter && !placed.has(meter.id)) {
          page.symbols.push({ nodeId: meter.id, pos, rotation: num(el.rotation) ?? 0 });
          placed.add(meter.id);
        }
        continue;
      }
      const hit = ELEMENTS.find(([re]) => re.test(sid));
      // Variantes du tableau 2.23 quand PlanElec les distingue (sonnerie, vibreur, trompe, sirène, gâche, prise data)
      const bellType = ({ 'sounder-bell': 'bell', 'sounder-buzzer': 'buzzer', 'sounder-horn': 'horn', 'sounder-siren': 'siren' } as Record<string, string>)[sid];
      const otherType = /^lock-door-opener/.test(sid) ? 'doorStrike' : /^data-outlet/.test(sid) ? 'dataOutlet' : undefined;
      const n = createNode(hit?.[1] ?? 'other', clean({ name: bellType || otherType ? undefined : sid, bellType, otherType, ...(hit?.[1] === 'appliance' ? { applianceType: 'other' } : {}) }));
      if (str(el.label)) n.location = str(el.label);
      n.source = { format: 'planelec', tag: sid, attrs: {} };
      project.loose.push(n);
      page.symbols.push({ nodeId: n.id, pos, rotation: num(el.rotation) ?? 0 });
      grow(pos);
    }
    if (arr(f.wires).length) warnings.add('Tracés de câbles PlanElec non repris.');
    project.plan.pages.push(page);
  });
  if (project.loose.length) warnings.add(`${project.loose.length} symbole(s) PlanElec hors schéma (détecteurs, sonnerie, prises data…) : posés sur le plan, non raccordés.`);
  if (skipped.size) warnings.add(`Éléments de plan PlanElec non repris : ${[...skipped].join(', ')}.`);
  if (!project.plan.pages.length) project.plan.pages.push(emptyPage('Rez-de-chaussée'));
  project.plan.width = Math.max(20000, Math.ceil((maxX + 2000) / 1000) * 1000);
  project.plan.height = Math.max(15000, Math.ceil((maxY + 2000) / 1000) * 1000);
  return { project, warnings: [...warnings] };
}
