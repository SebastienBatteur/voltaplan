/**
 * Import des projets Condui (export « .zip » : `manifest.json` « project-with-assets » + `project.json`, schéma
 * 2.3.0), établi sur deux exports du projet de démonstration de app.condui.be et le schéma unifilaire affiché par
 * Condui. Schéma : `disciplines.electrical` (tableaux → protections → circuits → points, différentiels par
 * `subCircuitIds`, sous-tableaux par `subPanelId`, appareils en ligne `trunkDevices`) ; plan en cm (`elements` :
 * murs en polylignes, portes et fenêtres sur un segment de mur, escaliers, meubles, notes) ; un étage = une page.
 * Un symbole inconnu devient « autre » avec un avertissement ; les données d'origine sont gardées dans `node.source`.
 */
import { ALLOWED_CHILDREN, CABLE_TYPES } from '../model/schema';
import { createNode, emptyPage, emptyProject, uid } from '../model/tree';
import type { ElNode, NodeKind, PlanPage, Project, Pt, PropValue } from '../model/types';
import { Warnings } from './warnings';
import type { MigrationWarning } from '../model/migrate';
import { I18nError } from '../i18n/error';

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

/** Manifeste d'un export Condui ? */
export const isConduiManifest = (text: string) => /"format"\s*:\s*"project-with-assets"/.test(text) && /"projectId"/.test(text);

/** Réseau Condui (`nominalVoltage`) → libellé Voltaplan. */
export function conduiSupply(v: unknown): string | undefined {
  if (!isObj(v)) return undefined;
  const sys = String(v.system ?? '');
  const ull = num(v.uLineToLine);
  if (/^3N/i.test(sys) || (sys.startsWith('3') && ull === 400)) return '3N x 400V ~ 50Hz';
  if (sys.startsWith('3')) return '3 x 230V ~ 50Hz';
  if (sys.startsWith('2') || sys.startsWith('1')) return '2 x 230V ~ 50Hz';
  return undefined;
}

const POLES: Record<string, string> = {
  '1P': '1P',
  '1P+N': '1P+N',
  '2P': '2P',
  '3P': '3P',
  '3P+N': '4P',
  '4P': '4P',
};
const SWITCHES: Record<string, string> = {
  switch: 'single',
  switch_1p_twoway: 'twoWay',
  switch_cross: 'intermediate',
  switch_dimmer: 'dimmer',
  switch_1p_pull: 'pullCord',
  switch_shutter: 'shutter',
  switch_2p: 'bipolar',
  switch_double: 'double',
};
const APPLIANCES: Record<string, string> = {
  stove: 'cooker',
  oven: 'oven',
  washer: 'washingMachine',
  dryer: 'dryer',
  dishwasher: 'dishwasher',
  fridge: 'fridge',
  freezer: 'freezer',
  microwave: 'microwave',
  ev: 'evCharger',
  boiler: 'electricWaterHeater',
  heating: 'heater',
  ventilation: 'fan',
  fixed_appliance_generic: 'other',
  hvac_source: 'other',
};
const BELLS: Record<string, string> = {
  bell: 'bell',
  buzzer: 'buzzer',
  horn: 'horn',
  siren: 'siren',
};
const LIGHTS: Record<string, string> = {
  light_point: 'standard',
  light_spot: 'spot',
  light_led: 'led',
  light_fluorescent: 'fluo',
};
/** Meubles du plan (« building.graphic.* ») → catalogue Voltaplan. */
const FURNITURE: Record<string, string> = {
  car: 'car',
  bathtub: 'bathtub',
  toilet: 'wc',
  shower: 'shower',
  sink: 'washbasin',
  washbasin: 'washbasin',
  bed: 'bedDouble',
  sofa: 'sofa',
  table: 'diningTable',
};
/** Commandes qui reçoivent les éléments suivants de leur branche (va-et-vient, croisement, transformateur…). */
const CHAIN = new Set<NodeKind>(['switch', 'pushButton', 'relay', 'transformer', 'detector']);

/** Point sur le contour d'un polygone (à `tol` près) ? */
function onOutline(pts: Pt[], p: Pt, tol: number): boolean {
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    if (Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)) <= tol) return true;
  }
  return false;
}

/** Point dans un polygone (règle pair-impair). */
function inPolygon(p: Pt, pts: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export interface ConduiImportResult {
  project: Project;
  warnings: MigrationWarning[];
}

export function importCondui(text: string, fileName = 'Projet Condui'): ConduiImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    throw new I18nError('imp.condui.invalidJson', undefined, "Ce fichier n'est pas un projet Condui valide (JSON illisible).");
  }
  if (!isObj(data) || !isObj(data.disciplines) || !isObj(data.disciplines.electrical) || !isObj(data.building)) throw new I18nError('imp.condui.invalid', undefined, "Ce fichier n'est pas un projet Condui valide.");
  const warnings = new Warnings();
  warnings.add('imp.kindExisting');
  if (data.schemaVersion !== '2.3.0') warnings.add('imp.condui.version', { version: String(data.schemaVersion) });
  const el = data.disciplines.electrical;
  const inst = isObj(el.installation) ? el.installation : {};
  const pj = isObj(data.project) ? data.project : {};
  const project = emptyProject();

  // ——— Métadonnées ———
  const addr = (a: unknown) =>
    isObj(a)
      ? clean({
          street: str(a.street),
          postalCode: str(a.postalCode),
          city: str(a.city),
          country: str(a.country),
        })
      : {};
  const site = isObj(data.site) ? data.site : {};
  const installer = isObj(pj.installerOverride) ? pj.installerOverride : {};
  const supply = conduiSupply(inst.nominalVoltage);
  if (!supply) warnings.add('imp.condui.supply');
  project.meta = {
    ...project.meta,
    title: str(pj.name) ?? fileName.replace(/\.zip$/i, ''),
    client: {
      name: isObj(pj.customer) ? str(pj.customer.name) : undefined,
      address: {},
    },
    site: addr(site.address ?? inst.address),
    installer: { name: str(installer.name), address: addr(installer.address) },
    supply: supply ?? '',
    // Fichier d'un autre logiciel : installation existante (relevé) tant que le porteur ne dit pas « neuf » (ADR-0010)
    installationKind: 'existing',
    ean: str(pj.meterEanCode),
  };
  const year = num(pj.yearOfConstruction);
  if (year && year > 1900) project.meta.installationDate = String(year);

  // ——— Schéma ———
  const nodeOf = new Map<string, ElNode>();
  const make = (src: Obj, kind: NodeKind, props: Props, tag: string): ElNode => {
    const n = createNode(kind, clean(props), { survey: true });
    n.id = str(src.id) ?? n.id;
    if (nodeOf.has(n.id)) n.id = uid();
    const attrs: Record<string, string> = {};
    for (const [k, v] of Object.entries(src)) if (k !== 'placements' && v !== null && v !== '' && v !== undefined) attrs[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
    n.source = { format: 'condui', tag, attrs };
    nodeOf.set(n.id, n);
    return n;
  };
  const allowed = (parent: ElNode, child: ElNode) => ALLOWED_CHILDREN[parent.kind]?.includes(child.kind) ?? false;
  /** Positions sur le plan (id du nœud → poses : étage, position en cm, rotation). */
  const poses = new Map<string, { floor: string; pos: Pt; rot: number; id?: string }[]>();
  const pose = (n: ElNode, src: Obj) => {
    const list = arr(src.placements)
      .filter((p) => isObj(p.pos) && str(p.floorId))
      .map((p) => ({
        floor: str(p.floorId)!,
        pos: { x: num((p.pos as Obj).x) ?? 0, y: num((p.pos as Obj).y) ?? 0 },
        rot: num(p.rotationDeg) ?? 0,
        id: str(p.id),
      }));
    if (list.length) poses.set(n.id, [...(poses.get(n.id) ?? []), ...list]);
  };

  /** Point du schéma (« endpoint » ou appareil en ligne « trunkDevice »). */
  const point = (ep: Obj): ElNode => {
    const sym = String(ep.symbol ?? ep.type ?? '');
    const count = arr(ep.placements).length > 1 ? arr(ep.placements).length : undefined;
    const sp = isObj(ep.socketProps) ? ep.socketProps : {};
    const lp = isObj(ep.lightPointProps) ? ep.lightPointProps : {};
    const hv = isObj(ep.hvacProps) ? ep.hvacProps : {};
    const cp = isObj(ep.conversionProps) ? ep.conversionProps : {};
    const name = [str(cp.brand), str(cp.model)].filter(Boolean).join(' ') || undefined;
    let n: ElNode;
    if (/^socket/.test(sym)) {
      n = make(
        ep,
        'socket',
        {
          count: num(sp.socketCount) ?? (/double/.test(sym) ? 2 : 1),
          earth: /gnd/.test(sym),
          childSafety: /child/.test(sym),
          splashProof: sp.waterproof === true ? true : undefined,
        },
        sym,
      );
    } else if (SWITCHES[sym]) n = make(ep, 'switch', { switchType: SWITCHES[sym] }, sym);
    else if (sym === 'switch_impulse' || sym === 'push_button') n = make(ep, 'pushButton', {}, sym);
    else if (sym === 'switch_1p_changeover') n = make(ep, 'switch', { switchType: 'single', reference: 'à bascule' }, sym);
    else if (LIGHTS[sym]) {
      const lightType = lp.safety === true || lp.autonomous === true ? 'emergency' : lp.onWall === true && sym === 'light_point' ? 'wall' : LIGHTS[sym];
      n = make(ep, 'light', { lightType, count }, sym);
    } else if (sym === 'smoke_detector') n = make(ep, 'detector', { detectorType: 'smoke' }, sym);
    else if (sym === 'motion_detector') n = make(ep, 'detector', { detectorType: 'motion' }, sym);
    else if (sym === 'relay') n = make(ep, 'relay', { relayType: 'relay', inBoard: false }, sym);
    else if (BELLS[sym]) n = make(ep, 'bell', { bellType: BELLS[sym] }, sym);
    else if (sym === 'door_lock') n = make(ep, 'other', { otherType: 'doorStrike' }, sym);
    else if (sym === 'motor') n = make(ep, 'motor', {}, sym);
    else if (sym === 'furnace') {
      // Chauffage (CVC) : pompe à chaleur (échange de chaleur à l'électricité), sinon chaudière
      const hp = hv.hvacType === 'heat_exchange' || hv.energySource === 'electricity';
      n = make(ep, 'appliance', { applianceType: hp ? 'heatPump' : 'boiler' }, sym);
    } else if (APPLIANCES[sym]) n = make(ep, 'appliance', { applianceType: APPLIANCES[sym] }, sym);
    else if (sym === 'solar_panel') {
      const s = isObj(ep.solarPanelProps) ? ep.solarPanelProps : {};
      n = make(
        ep,
        'solarPanel',
        {
          count,
          name: [str(s.brand), str(s.model), num(s.wattageW) ? `${num(s.wattageW)} Wc` : ''].filter(Boolean).join(' ') || undefined,
        },
        sym,
      );
    } else if (sym === 'inverter' || sym === 'rectifier' || sym === 'dc_dc_converter' || sym === 'converter_dc_dc') {
      const kw = num(String(cp.power ?? '').replace(/kw/i, ''));
      n = make(
        ep,
        'inverter',
        {
          inverterType: sym === 'rectifier' ? 'acDc' : sym === 'inverter' ? 'dcAc' : 'dcDc',
          power: kw ? Math.round(kw * (/kw/i.test(String(cp.power)) ? 1000 : 1)) : undefined,
          name,
        },
        sym,
      );
    } else if (sym === 'transformer') n = make(ep, 'transformer', { safety: true, name: str(ep.labelNotes) }, sym);
    else if (sym === 'battery') n = make(ep, 'battery', {}, sym);
    else if (sym === 'junction_box' || sym === 'terminal_strip' || sym === 'junction_panel')
      n = make(
        ep,
        'junctionBox',
        {
          name: sym === 'junction_panel' ? (str(ep.label) ?? 'Panneau de jonction') : sym === 'terminal_strip' ? `Bornier ${str(ep.label) ?? ''}`.trim() : undefined,
        },
        sym,
      );
    else if (sym === 'energy_meter') n = make(ep, 'other', { otherType: 'subMeter' }, sym);
    else if (/^domotic/.test(sym)) n = make(ep, 'domotic', {}, sym);
    else if (sym === 'light_sensor') {
      n = make(ep, 'other', { name: 'Interrupteur crépusculaire' }, sym);
    } else {
      n = make(ep, 'other', { name: sym }, sym);
      warnings.add('imp.condui.symbol', { sym });
    }
    if (str(ep.notes)) n.location = str(ep.notes);
    pose(n, ep);
    return n;
  };

  /** Circuit : câble, puis les points branche par branche (commandes en chaîne), appareils en ligne à leur rang. */
  const circuitCable = (c: Obj, protection: ElNode): ElNode => {
    const cb = isObj(c.cable) ? c.cable : {};
    const t = str(cb.kind);
    const ov = arr(c.sectionWireOverrides)[0];
    const cable = make(
      { id: uid() },
      'cable',
      {
        cableType: t && (CABLE_TYPES as readonly string[]).includes(t) ? t : t ? 'other' : undefined,
        section: num(cb.sectionMm2),
        conductors: num(cb.conductors),
        inConduit: ov && typeof ov.inTube === 'boolean' ? ov.inTube : undefined,
        reference: str(cb.fireClass) ? `CPR ${str(cb.fireClass)}` : undefined,
      },
      'cable',
    );
    const eps = arr(c.endpoints);
    const byId = new Map(eps.map((e) => [str(e.id) ?? '', e]));
    // Branches (E1, E2…) ; sans branches : regroupées par repère
    let branches: Obj[][] = arr(c.branches).map((b) => (Array.isArray(b.endpointIds) ? b.endpointIds.map((id) => byId.get(String(id))).filter((e): e is Obj => !!e) : []));
    const inBranch = new Set(branches.flat());
    const rest = eps.filter((e) => !inBranch.has(e));
    if (rest.length) {
      const groups = new Map<string, Obj[]>();
      for (const e of rest) groups.set(str(e.label) ?? uid(), [...(groups.get(str(e.label) ?? '') ?? []), e]);
      branches = [...branches, ...groups.values()];
    }
    const trunk = arr(c.trunkDevices).sort((a, b) => (num(a.trunkPosition) ?? 0) - (num(b.trunkPosition) ?? 0));
    let ti = 0;
    const flushTrunk = (pos: number) => {
      while (ti < trunk.length && (num(trunk[ti].trunkPosition) ?? 0) <= pos) cable.children.push(point(trunk[ti++]));
    };
    branches.forEach((br, bi) => {
      flushTrunk(bi);
      let host: ElNode | null = null;
      for (const ep of br) {
        const n = point(ep);
        if (host && allowed(host, n) && (host.kind !== 'detector' || n.kind === 'light')) host.children.push(n);
        else if (host && host.kind === 'socket' && n.kind === 'appliance') host.children.push(n);
        else cable.children.push(n);
        if (CHAIN.has(n.kind) || (n.kind === 'socket' && !host)) host = n;
      }
    });
    flushTrunk(Infinity);
    protection.children.push(cable);
    return cable;
  };

  const protectionNode = (p: Obj, prefix: string): ElNode => {
    const type = String(p.type ?? 'MCB');
    const device = type === 'RCD' ? 'rcd' : type === 'RCBO' ? 'rcbo' : type === 'FUSE' ? 'fuse' : 'mcb';
    if (!['RCD', 'RCBO', 'MCB', 'FUSE'].includes(type)) warnings.add('imp.condui.protection', { type });
    const c0 = arr(p.circuits)[0];
    const label = str(p.label);
    const n = make(
      p,
      'protection',
      {
        device,
        circuitName: str(c0?.notes) ?? str(p.labelNotes) ?? str(p.notes),
        fixedLetter: device !== 'rcd' && label ? prefix + label : undefined,
        ratedCurrent: num(p.ratingA),
        poles: POLES[String(p.polesConfig ?? '')],
        curve: device === 'mcb' || device === 'rcbo' ? str(p.curve) : undefined,
        breakingCapacity: num(p.breakingCapacityKa),
        residualCurrent: device === 'rcd' || device === 'rcbo' ? num(p.sensitivityMa) : undefined,
        rcdType: device === 'rcd' || device === 'rcbo' ? str(p.residualCurrentType) : undefined,
        installedOn: num(c0?.rulesetDateOverride) ? String(num(c0?.rulesetDateOverride)) : undefined,
      },
      type,
    );
    // Valeurs absentes dans Condui (différentiel sans calibre) : pas de valeur par défaut inventée
    if (num(p.ratingA) === undefined) {
      delete n.props.ratedCurrent;
      warnings.add('imp.condui.rcdRating');
    }
    if (device === 'rcd') delete n.props.curve;
    if (num(p.breakingCapacityKa) === undefined) delete n.props.breakingCapacity;
    return n;
  };

  /** Points de raccordement des tableaux sur le plan (circuit « PANEL » de chaque tableau). */
  const panelPose = new Map<string, Obj>();
  const board = (pn: Obj, prefix: string, letter?: string): ElNode => {
    const b = make(pn, 'board', { name: str(pn.name), fixedLetter: letter }, 'panel');
    for (const c of arr(pn.circuits)) for (const ep of arr(c.endpoints)) if (ep.symbol === 'panel_distribution') panelPose.set(b.id, ep);
    const prots = arr(pn.protections);
    const subs = new Map(arr(pn.subPanels).map((s) => [str(s.id) ?? '', s]));
    const nodes = new Map<string, ElNode>();
    // Circuit → protection qui le porte
    const ownerOfCircuit = new Map<string, Obj>();
    for (const p of prots) for (const c of arr(p.circuits)) ownerOfCircuit.set(str(c.id) ?? '', p);
    const child = new Set<Obj>();
    for (const p of prots)
      for (const c of arr(p.circuits))
        for (const id of Array.isArray(c.subCircuitIds) ? c.subCircuitIds : []) {
          const o = ownerOfCircuit.get(String(id));
          if (o) child.add(o);
        }
    const build = (p: Obj): ElNode => {
      const n = protectionNode(p, prefix);
      nodes.set(str(p.id) ?? '', n);
      for (const c of arr(p.circuits)) {
        const subIds = Array.isArray(c.subCircuitIds) ? c.subCircuitIds.map(String) : [];
        if (subIds.length) {
          // Différentiel (ou disjoncteur différentiel) de groupe : les circuits qu'il protège, dans l'ordre de Condui
          for (const id of subIds) {
            const o = ownerOfCircuit.get(id);
            if (o) n.children.push(build(o));
          }
          continue;
        }
        const cable = circuitCable(c, n);
        const sub = str(p.subPanelId);
        if (sub && subs.has(sub)) {
          const sb = board(subs.get(sub)!, `${str(p.label) ?? ''}-`, str(p.label));
          cable.children.push(sb);
          subs.delete(sub);
        }
      }
      return n;
    };
    for (const p of prots) if (!child.has(p)) b.children.push(build(p));
    for (const s of subs.values()) b.children.push(board(s, `${str(s.name) ?? ''}-`));
    if (isObj(pn.gridView)) grids.push({ b, gv: pn.gridView });
    return b;
  };

  /** Face avant de chaque tableau (`gridView`), appliquée une fois l'arbre complet (général compris). */
  const grids: { b: ElNode; gv: Obj }[] = [];
  const origin = project.roots[0];
  const meter = origin.children[0];
  meter.children = [];
  const feed = isObj(inst.feedTopology) ? inst.feedTopology : {};
  const shared = isObj(feed.sharedFeed) ? feed.sharedFeed : isObj(inst.mainSupply) ? inst.mainSupply : {};
  // Avant le compteur : disjoncteur de branchement (calibre du raccordement)
  for (const t of arr(shared.trunkDevices ?? shared.supplyTrunkDevices)) {
    if (t.type === 'protection') {
      const a = num(t.ratingA);
      if (a) project.meta.mainCurrent = a;
    } else if (t.type === 'energy_meter') {
      meter.id = str(t.id) ?? meter.id;
      nodeOf.set(meter.id, meter);
      pose(meter, t);
    }
  }
  const panels = arr(el.panels);
  const rootFeeds = arr(feed.rootFeeds);
  let mainBoard: ElNode | null = null;
  let mainIsMain = false;
  for (const pn of panels) {
    const b = board(pn, '');
    const rf = rootFeeds.find((r) => r.panelId === pn.id);
    // Têtes de tableau (général différentiel « Hoofd »…) entre le compteur et le tableau
    let parent: ElNode = meter;
    for (const t of arr(rf?.trunkDevices)) {
      if (t.type !== 'protection') continue;
      const n = protectionNode({ ...t, type: t.protectionType, label: '' }, '');
      parent.children.push(n);
      parent = n;
    }
    parent.children.push(b);
    // Tableau principal : le premier marqué « isMain », sinon le premier
    if (!mainBoard || (pn.isMain === true && !mainIsMain)) {
      mainBoard = b;
      mainIsMain = pn.isMain === true;
    }
  }
  if (!mainBoard) warnings.add('imp.condui.noBoard');
  // Terre : barrette (sectionneur de terre) et prise de terre dans le tableau principal
  let earthBar: ElNode | null = null;
  if (mainBoard) {
    earthBar = createNode('earthBar', {});
    earthBar.children.push(createNode('earth'));
    nodeOf.set(earthBar.id, earthBar);
    mainBoard.children.push(earthBar);
  }
  for (const jp of arr(inst.junctionPanelPlacements)) {
    const n = [...nodeOf.values()].find((x) => x.source?.tag === 'junction_panel' && x.props.name === str(jp.label));
    if (n)
      poses.set(n.id, [
        ...(poses.get(n.id) ?? []),
        {
          floor: str(jp.floorId) ?? '',
          pos: {
            x: num((jp.pos as Obj)?.x) ?? 0,
            y: num((jp.pos as Obj)?.y) ?? 0,
          },
          rot: 0,
          id: str(jp.id),
        },
      ]);
  }
  if (earthBar)
    for (const e of arr(inst.earthingPlacements))
      poses.set(earthBar.id, [
        {
          floor: str(e.floorId) ?? '',
          pos: {
            x: num((e.pos as Obj)?.x) ?? 0,
            y: num((e.pos as Obj)?.y) ?? 0,
          },
          rot: 0,
          id: str(e.id),
        },
      ]);
  // Face avant exacte : rangée et colonne (en modules) de chaque appareil, telles que dans Condui
  project.boards = { ...(project.boards ?? {}) };
  for (const { b, gv } of grids) {
    const slots: Record<string, { row: number; col: number }> = {};
    for (const sl of arr(gv.slots)) {
      const m = isObj(sl.module) ? sl.module : {};
      const n = nodeOf.get(str(m.id) ?? '');
      const row = num(sl.row);
      const col = num(sl.col);
      if (n && row !== undefined && col !== undefined) slots[n.id] = { row, col };
    }
    if (!Object.keys(slots).length) continue;
    project.boards[b.id] = { slots };
    if (num(gv.rows)) b.props.rows = num(gv.rows);
    if (num(gv.columns)) b.props.modulesPerRow = num(gv.columns);
  }
  for (const [bid, ep] of panelPose) {
    const b = nodeOf.get(bid);
    if (b) pose(b, ep);
  }

  // ——— Plan (cm → mm) ———
  const floors = arr(data.building.floors);
  const elements = arr(data.elements);
  const hidden = new Set(floors.flatMap((f) => (Array.isArray(f.hiddenSitplanElementIds) ? f.hiddenSitplanElementIds.map(String) : [])));
  // Origine commune à tous les étages (les coordonnées Condui peuvent être négatives)
  const xs: number[] = [];
  const ys: number[] = [];
  const see = (p: unknown) => {
    if (isObj(p) && num(p.x) !== undefined && num(p.y) !== undefined) {
      xs.push(num(p.x)!);
      ys.push(num(p.y)!);
    }
  };
  for (const e of elements) {
    const g = isObj(e.geometry) ? e.geometry : {};
    if (Array.isArray(g.points)) g.points.forEach(see);
    see(g.position);
  }
  for (const l of poses.values()) for (const p of l) see(p.pos);
  const ox = xs.length ? Math.min(...xs) : 0;
  const oy = ys.length ? Math.min(...ys) : 0;
  const mm = (p: unknown): Pt =>
    isObj(p)
      ? {
          x: Math.round(((num(p.x) ?? 0) - ox) * 10 + 1000),
          y: Math.round(((num(p.y) ?? 0) - oy) * 10 + 1000),
        }
      : { x: 1000, y: 1000 };
  project.plan = { pages: [], width: 20000, height: 15000 };
  let maxX = 0;
  let maxY = 0;
  const grow = (p: Pt) => {
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  };
  const skipped = new Set<string>();
  const pageOf = new Map<string, PlanPage>();
  for (const f of floors) {
    const page = emptyPage(str(f.name) ?? `Niveau ${pageOf.size}`);
    page.furniture = [];
    pageOf.set(str(f.id) ?? '', page);
    project.plan.pages.push(page);
  }
  // Murs (polylignes) : segments, par identifiant pour poser les ouvertures
  const wallSegs = new Map<string, { a: Pt; b: Pt; th: number }[]>();
  /** Murs fermés (pièces) de chaque étage : contour et surface, pour le sens d'ouverture des portes. */
  const rooms = new Map<string, { pts: Pt[]; area: number }[]>();
  for (const e of elements) {
    const page = pageOf.get(str(e.floorId) ?? '');
    if (!page) continue;
    const kind = String(e.kind);
    const v1 = isObj(e.properties) && isObj(e.properties.v1) ? e.properties.v1 : {};
    const g = isObj(e.geometry) ? e.geometry : {};
    if (kind === 'building.wall') {
      const th = (num(v1.thickness) ?? num((e.properties as Obj).masterWallThickness) ?? 20) * 10;
      const pts = arr(g.points).map(mm);
      const segs: { a: Pt; b: Pt; th: number }[] = [];
      for (let i = 0; i + 1 < pts.length; i++) {
        if (pts[i].x === pts[i + 1].x && pts[i].y === pts[i + 1].y) continue;
        page.walls.push({ a: pts[i], b: pts[i + 1], thickness: th });
        segs.push({ a: pts[i], b: pts[i + 1], th });
        grow(pts[i]);
        grow(pts[i + 1]);
      }
      // Index des segments tels que Condui les compte (segments nuls compris)
      wallSegs.set(
        str(v1.id) ?? '',
        pts.slice(0, -1).map((a, i) => ({ a, b: pts[i + 1], th })),
      );
      const closed = pts.length > 3 && pts[0].x === pts[pts.length - 1].x && pts[0].y === pts[pts.length - 1].y;
      if (closed) {
        const area = Math.abs(pts.slice(0, -1).reduce((s, q, i) => s + q.x * pts[i + 1].y - pts[i + 1].x * q.y, 0)) / 2;
        rooms.set(str(e.floorId) ?? '', [...(rooms.get(str(e.floorId) ?? '') ?? []), { pts, area }]);
      }
    }
  }
  for (const e of elements) {
    const page = pageOf.get(str(e.floorId) ?? '');
    if (!page) continue;
    const kind = String(e.kind);
    const v1 = isObj(e.properties) && isObj(e.properties.v1) ? e.properties.v1 : {};
    const g = isObj(e.geometry) ? e.geometry : {};
    if (kind === 'building.door' || kind === 'building.window') {
      const seg = wallSegs.get(str(v1.wallId) ?? '')?.[num(v1.segmentIndex) ?? 0];
      if (!seg) {
        skipped.add(kind === 'building.door' ? 'porte sans mur' : 'fenêtre sans mur');
        continue;
      }
      const len = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y) || 1;
      const ux = (seg.b.x - seg.a.x) / len;
      const uy = (seg.b.y - seg.a.y) / len;
      const w = (num(v1.width) ?? 90) * 10;
      const c = Math.min(len, Math.max(0, (num(v1.centerAlongSegment) ?? len / 20) * 10));
      const a = {
        x: Math.round(seg.a.x + ux * (c - w / 2)),
        y: Math.round(seg.a.y + uy * (c - w / 2)),
      };
      const b = {
        x: Math.round(seg.a.x + ux * (c + w / 2)),
        y: Math.round(seg.a.y + uy * (c + w / 2)),
      };
      if (kind === 'building.window') page.openings.push({ kind: 'window', a, b, width: seg.th });
      else if (v1.isOpening === true || v1.swing === 'none')
        // Porte sans battant (porte de garage, baie) : dessinée comme une baie (trait pointillé)
        page.openings.push({ kind: 'garageDoor', a, b, width: seg.th });
      else {
        // Sens d'ouverture, relevé sur le plan PDF de Condui (projet de démonstration) : « out » = vers l'extérieur
        // de la plus petite pièce fermée dont le mur porte la porte ; sur une cloison seule (mur ouvert), à droite
        // du sens de tracé du mur (côté +y local de Voltaplan). « in » : l'inverse. « swing » : right = charnière au
        // bout d'arrivée du segment (Voltaplan : mirrored).
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const plusY = { x: mid.x - uy * 300, y: mid.y + ux * 300 };
        const host = (rooms.get(str(e.floorId) ?? '') ?? []).filter((r) => onOutline(r.pts, mid, seg.th / 2 + 20)).sort((r, q) => r.area - q.area)[0];
        let toPlusY = host ? !inPolygon(plusY, host.pts) : true;
        if (v1.direction === 'in') toPlusY = !toPlusY;
        page.openings.push({
          kind: w >= 1400 ? 'doubleDoor' : 'door',
          a,
          b,
          width: seg.th,
          hinge: toPlusY ? 'right' : 'left',
          mirrored: v1.swing === 'right',
        });
      }
    } else if (kind === 'building.stair') {
      // Escalier en L ou en U : une volée droite par segment
      const pts = arr(v1.points ?? g.points).map(mm);
      const w = (num(v1.width) ?? 80) * 10;
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len < 1) continue;
        page.furniture!.push({
          id: uid(),
          kind: 'stairs',
          center: {
            x: Math.round((a.x + b.x) / 2),
            y: Math.round((a.y + b.y) / 2),
          },
          w: Math.round(w),
          h: Math.round(len),
          angle: Math.round((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI - 90),
        });
      }
    } else if (kind.startsWith('building.graphic.')) {
      const k = FURNITURE[kind.slice('building.graphic.'.length)];
      if (!k || !isObj(g.position)) {
        skipped.add(kind.slice('building.graphic.'.length));
        continue;
      }
      page.furniture!.push({
        id: str(v1.id) ?? uid(),
        kind: k,
        center: mm(g.position),
        w: Math.round((num(g.width) ?? 100) * 10),
        h: Math.round((num(g.height) ?? 100) * 10),
        angle: num(g.rotationDeg) ?? 0,
      });
    } else if (kind === 'annotation.note') {
      const t = str(v1.text) ?? str(e.name);
      if (t && isObj(g.position)) page.labels.push({ id: uid(), text: t, pos: mm(g.position), size: 3 });
    } else if (kind === 'building.room') {
      const t = str(v1.name) ?? str(e.name) ?? str(v1.label);
      const pts = arr(v1.points ?? g.points).map(mm);
      if (t && pts.length)
        page.labels.push({
          id: uid(),
          text: t,
          pos: {
            x: Math.round(pts.reduce((s, p) => s + p.x, 0) / pts.length),
            y: Math.round(pts.reduce((s, p) => s + p.y, 0) / pts.length),
          },
          size: 3,
        });
    } else if (!kind.startsWith('electrical.') && kind !== 'building.wall') skipped.add(kind);
  }
  // Symboles : une pose par élément et par page (Condui en permet plusieurs : quantité « 2x »)
  let multi = false;
  for (const [id, list] of poses) {
    const n = nodeOf.get(id) ?? (meter.id === id ? meter : undefined);
    if (!n) continue;
    const done = new Set<string>();
    for (const p of list) {
      if (p.id && hidden.has(p.id)) continue;
      const page = pageOf.get(p.floor);
      if (!page) continue;
      if (done.has(p.floor)) {
        multi = true;
        continue;
      }
      done.add(p.floor);
      const pos = mm(p.pos);
      grow(pos);
      const wall = ['socket', 'switch', 'pushButton'].includes(n.kind) || (n.kind === 'light' && n.props.lightType === 'wall');
      page.symbols.push({
        nodeId: n.id,
        pos,
        rotation: wall ? 0 : 0,
        autoRotate: wall || undefined,
      });
    }
  }
  // Tracés de câbles (« plan-wire ») : de la pose de départ à la pose d'arrivée par les points de passage
  const nodeAt = new Map<string, string>();
  for (const [id, list] of poses) for (const p of list) if (p.id) nodeAt.set(p.id, id);
  let wires = 0;
  for (const e of elements) {
    if (!String(e.kind).startsWith('electrical.plan-wire')) continue;
    const r = isObj(e.properties) && isObj(e.properties.route) ? e.properties.route : {};
    const a = isObj(r.from) ? nodeAt.get(str(r.from.placementId) ?? '') : undefined;
    const b = isObj(r.to) ? nodeAt.get(str(r.to.placementId) ?? '') : undefined;
    const page = pageOf.get(str(r.floorId) ?? str(e.floorId) ?? '');
    if (!a || !b || a === b || !page) continue;
    const g = isObj(e.geometry) ? e.geometry : {};
    (page.wires ??= []).push({ a, b, pts: arr(g.points).map(mm) });
    wires++;
  }
  if (multi) warnings.add('imp.condui.multi');
  if (skipped.size) warnings.add('imp.condui.skipped', { list: [...skipped].join(', ') });
  if (!wires && elements.some((e) => String(e.kind).startsWith('electrical.plan-wire'))) warnings.add('imp.condui.wires');
  if (arr(data.assets).length) warnings.add('imp.condui.assets', { n: arr(data.assets).length });
  if (!project.plan.pages.length) project.plan.pages.push(emptyPage('Rez-de-chaussée'));
  project.plan.width = Math.max(20000, Math.ceil((maxX + 2000) / 1000) * 1000);
  project.plan.height = Math.max(15000, Math.ceil((maxY + 2000) / 1000) * 1000);
  return { project, warnings: warnings.list() };
}
