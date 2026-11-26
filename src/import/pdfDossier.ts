/**
 * Reprise d'un dossier PDF d'un autre logiciel (Volter, Condui, Draadwijs, Amperio…), quand il n'existe pas de fichier
 * de projet à importer. On lit le TEXTE du PDF (pas d'image, pas d'IA) : le tableau des circuits (repère, nom,
 * protection, câble, différentiel, nombre de points), en français, néerlandais, anglais ou allemand, puis les repères
 * des points (A1, A2…) sur les autres pages pour compter les points d'un circuit.
 *
 * Ce que le texte ne dit pas reste à compléter, et on le dit : le type exact de chaque point (déduit du nom du
 * circuit quand c'est possible), la position des points sur le plan, le différentiel général. Un PDF sans texte
 * (texte dessiné en traits, document scanné) ne peut pas être lu ainsi.
 */
import { interpretLabel } from '../assist/labels';
import { createNode, emptyPage, emptyProject, uid } from '../model/tree';
import type { ElNode, NodeKind, PlanPage, Project, PropValue } from '../model/types';
import { distToWalls, planFromShapes, scaleFromDoors, type PdfShape } from './pdfPlan';
import { roomBounds } from '../plan/roomKit';
import { enclosures, moduleWidth } from '../board/model';

/** Morceau de texte d'une page (origine en haut à gauche, en points PDF). */
export interface PdfText {
  page: number;
  x: number;
  y: number;
  str: string;
  /** Taille de la police. */
  size: number;
}

export interface PdfPageSize {
  width: number;
  height: number;
}

type Col = 'code' | 'name' | 'type' | 'protection' | 'cable' | 'diff' | 'points' | 'rooms' | 'board' | 'other';

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** En-têtes de colonnes du tableau des circuits (FR, NL, EN, DE), comparés sans accents ni majuscules. */
const HEADERS: [Col, RegExp][] = [
  ['code', /^(lettre|repere|code|circuit|kring|stroomkring|kringcode|letter|aanduiding|ref|reference|nr|n°|stromkreis|kreis|bezeichner|kennzeichen|buchstabe)$/],
  ['protection', /(disjoncteur|protection|dispositif|automaat|beveiliging|zekering|breaker|protective|schutz|sicherung|absicherung|sicherheitsger)/],
  ['cable', /^(cable|kabel|leitung|leiding|geleider|conductor|wire|canalisation|leidingen)s?$/],
  ['diff', /^(diff|differentiel|differentieel|rcd|fi|fehlerstrom|aardlek|verliesstroom)/],
  ['points', /^(points|punten|punkte|pts|aantal punten|nombre de points)$/],
  ['rooms', /^(pieces|locaux|ruimtes|lokalen|rooms|raume|zimmer)$/],
  ['board', /^(tableau|bord|board|verteiler|verdeelbord|panel)$/],
  ['type', /^(type|soort|typ|art)$/],
  ['name', /^(nom|designation|description|naam|benaming|omschrijving|name|bezeichnung|beschreibung|notes?|opmerkingen?|bemerkung|hinweise?|usage|gebruik|verwendung)$/],
];
const colOf = (s: string): Col | null => {
  const f = fold(s).replace(/[.:]$/, '');
  for (const [c, re] of HEADERS) if (re.test(f)) return c;
  return null;
};

/** Repère de circuit : « A », « AB », « E-A », « Tuinhuis A » non. */
const CODE = /^([A-Z]{1,3}-)?[A-Z]{1,3}$/;
/** Ligne de tableau « sous-tableau » (type ou nom). */
const SUBBOARD = /(sous-?tableau|tableau divisionnaire|onderbord|onderverdeel|subpanel|sub-?board|unterverteil)/;
/** Circuit vide / réserve. */
const SPARE = /(circuit vide|reserve|libre|leeg|vrij|spare|empty|frei)/;

export interface DossierCircuit {
  code: string;
  board: string;
  name?: string;
  type?: string;
  protection?: string;
  cable?: string;
  diff?: string;
  points?: number;
  rooms?: string;
}

/** Tableaux des circuits trouvés dans le texte (toutes pages, dans l'ordre). */
export function readCircuitTables(items: PdfText[], pages: PdfPageSize[]): DossierCircuit[] {
  const out: DossierCircuit[] = [];
  const byPage = new Map<number, PdfText[]>();
  for (const it of items) byPage.set(it.page, [...(byPage.get(it.page) ?? []), it]);
  let board = '';
  for (const [p, list] of [...byPage].sort((a, b) => a[0] - b[0])) {
    const h = pages[p - 1]?.height ?? 842;
    // En-tête : au moins trois colonnes reconnues sur une même ligne, dont le repère et la protection (une liste
    // des câbles et de leurs longueurs n'est pas un tableau des circuits)
    const rows = groupRows(list);
    let headerIdx = -1;
    let cols: { x: number; col: Col }[] = [];
    rows.forEach((r, i) => {
      if (headerIdx >= 0) return;
      const found = r.items.map((it) => ({ x: it.x, col: colOf(it.str) })).filter((c): c is { x: number; col: Col } => !!c.col);
      const kinds = new Set(found.map((c) => c.col));
      if (found.length >= 3 && kinds.has('code') && kinds.has('protection')) {
        headerIdx = i;
        cols = found.sort((a, b) => a.x - b.x);
      }
    });
    if (headerIdx < 0) continue;
    const x0 = cols[0].x - 6;
    const column = (x: number): Col => {
      let c: Col = 'other';
      for (const k of cols) if (k.x <= x + 4) c = k.col;
      return c;
    };
    let cur: DossierCircuit | null = null;
    const add = (c: DossierCircuit, col: Col, s: string) => {
      if (col === 'other' || col === 'code') return;
      if (col === 'points') {
        const n = parseInt(s, 10);
        if (Number.isFinite(n)) c.points = n;
        return;
      }
      const prev = c[col] as string | undefined;
      (c as unknown as Record<string, string>)[col] = prev ? `${prev} ${s}` : s;
    };
    for (const r of rows.slice(headerIdx + 1)) {
      // Pied de page (cartouche, numéro de page) : fin du tableau
      if (r.y > h - 60) break;
      // Autre tableau à la suite (liste des câbles, longueurs…) : nouvelle ligne d'en-têtes ou titre de liste
      if (r.items.filter((it) => colOf(it.str)).length >= 2) break;
      if (r.items.length === 1 && /^(liste|lijst|list|overzicht|ubersicht|legende|legend)\b/.test(fold(r.items[0].str))) break;
      const first = r.items.filter((it) => it.x >= x0 && column(it.x) === 'code');
      const codeItem = first.find((it) => CODE.test(it.str.trim()));
      if (codeItem) {
        cur = { code: codeItem.str.trim(), board };
        out.push(cur);
        for (const it of r.items) if (it !== codeItem && it.x >= x0) add(cur, column(it.x), it.str.trim());
        continue;
      }
      // Ligne de titre dans la première colonne : nom du tableau (« Tableau de distribution: Hoofdbord / Tuinhuis »)
      const title = r.items.filter((it) => it.x >= x0 && it.x < x0 + 30);
      if (title.length && r.items.every((it) => column(it.x) === 'code')) {
        const t = title.map((it) => it.str).join(' ').trim();
        board = t.replace(/^.*:\s*/, '').split('/').pop()!.trim();
        cur = null;
        continue;
      }
      // Suite d'une cellule sur plusieurs lignes
      if (cur) for (const it of r.items) if (it.x >= x0) add(cur, column(it.x), it.str.trim());
    }
  }
  return out;
}

/** Lignes de texte (même hauteur à 3 points près), de haut en bas, chaque ligne de gauche à droite. */
function groupRows(list: PdfText[]): { y: number; items: PdfText[] }[] {
  const rows: { y: number; items: PdfText[] }[] = [];
  for (const it of [...list].filter((i) => i.str.trim()).sort((a, b) => a.y - b.y || a.x - b.x)) {
    const r = rows.find((q) => Math.abs(q.y - it.y) <= 3);
    if (r) r.items.push(it);
    else rows.push({ y: it.y, items: [it] });
  }
  for (const r of rows) r.items.sort((a, b) => a.x - b.x);
  return rows.sort((a, b) => a.y - b.y);
}

/** Protection : « C16 2P », « C20A · 2P · 3000 A », « 2P - B16A », « B32 2P 30mA A », « 16A ». */
export function parseProtection(s = ''): Record<string, PropValue> {
  const t = s.replace(/·/g, ' ');
  const cr = /\b([BCDK])\s?(\d{1,3})\s?A?\b/.exec(t);
  const amps = cr ? Number(cr[2]) : Number(/\b(\d{1,3})\s?A\b/.exec(t)?.[1] ?? NaN);
  const poles = /\b([1-4])\s?P(\s?\+\s?N)?\b/i.exec(t);
  const ka = /(\d+(?:[.,]\d+)?)\s?kA\b/i.exec(t);
  const icc = /\b(3000|4500|6000|10000|15000|25000)\b/.exec(t);
  const ma = residualMa(t);
  return clean({
    ratedCurrent: Number.isFinite(amps) ? amps : undefined,
    curve: cr?.[1],
    poles: poles ? (poles[2] ? `${poles[1]}P+N` : `${poles[1]}P`) : undefined,
    breakingCapacity: ka ? Number(ka[1].replace(',', '.')) : icc ? Number(icc[1]) / 1000 : undefined,
    residualCurrent: ma,
    rcdType: ma !== undefined ? /\btype\s?(AC|A|F|B)\b/i.exec(t)?.[1]?.toUpperCase() ?? (/\b(\d+)\s?mA\s+(AC|A|F|B)\b/i.exec(t)?.[2]?.toUpperCase() as string | undefined) : undefined,
  });
}

/** Sensibilité différentielle en mA : « 30mA », « 30 mA », « 0,03A », « 40/0,03A ». */
export function residualMa(s = ''): number | undefined {
  const m = /(\d+)\s?mA\b/i.exec(s);
  if (m) return Number(m[1]);
  const a = /(?:\/|\b)0[.,](0?3|1|3|5)\s?A\b/i.exec(s);
  return a ? Math.round(Number('0.' + a[1]) * 1000) : undefined;
}

/** Câble : « XVB Cca 3G2,5 », « XV(B) Cca 3G1,5mm² », « 2,5mm² », « XVB Cca 3G2,5² · encastré ». */
export function parseCable(s = ''): Record<string, PropValue> {
  const t = s.replace(/XV\(B\)/i, 'XVB');
  const type = /\b(EXVB|XVB|VOB|XGB|XFVB|VFVB|CRVB|H07V-?[UKR])\b/i.exec(t)?.[1]?.toUpperCase().replace(/^H07V([UKR])$/, 'H07V-$1');
  const g = /\b(\d)\s?G\s?(\d+(?:[.,]\d+)?)/i.exec(t);
  const mm = /(\d+(?:[.,]\d+)?)\s?(?:mm)?²/.exec(t);
  const cpr = /\b(B2ca|Cca|Dca|Eca)\b/.exec(t)?.[1];
  const section = g ? Number(g[2].replace(',', '.')) : mm ? Number(mm[1].replace(',', '.')) : undefined;
  return clean({
    cableType: type,
    conductors: g ? Number(g[1]) : undefined,
    section,
    reference: cpr ? `CPR ${cpr}` : undefined,
    method: /encastr|ingebouwd|in de muur|unterputz|in wall/i.test(t) ? 'inWall' : undefined,
  });
}

const clean = (o: Record<string, PropValue>) => {
  for (const k of Object.keys(o)) if (o[k] === undefined || (typeof o[k] === 'number' && !Number.isFinite(o[k] as number))) delete o[k];
  return o;
};

/**
 * Nombre de points d'un circuit d'après ses repères sur les autres pages (« A1 », « A2 », « E-A3 ») : la plus longue
 * suite sans trou depuis 1. Un calibre (« C16 », « B32 ») ressemble à un repère : il ne compte que si tous les repères
 * précédents existent aussi.
 */
export function countPoints(items: PdfText[], code: string): number {
  const re = new RegExp(`^${code.replace(/[-]/g, '\\-')}\\.?(\\d{1,2})$`);
  const seen = new Set<number>();
  for (const it of items) {
    const m = re.exec(it.str.trim());
    if (m) seen.add(Number(m[1]));
  }
  let k = 0;
  while (seen.has(k + 1)) k++;
  return k;
}

/** Réseau d'après tout le texte. */
export function detectSupply(text: string): string | undefined {
  const t = text.replace(/\s+/g, ' ');
  if (/3\s?[x×]\s?400\s?V?\s?\+?\s?N|3N\s?[x×~]?\s?400|400\s?V\s?\+\s?N/i.test(t)) return '3N x 400V ~ 50Hz';
  if (/3\s?[x×]\s?230|triphas\w* 230|driefasig 230/i.test(t)) return '3 x 230V ~ 50Hz';
  if (/2\s?[x×]\s?230|1\s?~|monophas|eenfasig|single[- ]phase|einphasig|230\s?V/i.test(t)) return '2 x 230V ~ 50Hz';
  return undefined;
}

export interface PdfDossierResult {
  project: Project;
  warnings: string[];
  circuits: number;
  /** Fonds de plan à rendre : page Voltaplan (index) ← page du PDF (1…). L'image de fond y est déjà, sans contenu. */
  backgrounds: { pageIndex: number; pdfPage: number }[];
}

/** Page de plan du PDF : nom de l'étage, tableau dont elle montre les points (Condui : « Beneden - Tuinhuis »), échelle. */
export interface PdfPlanPage {
  pdfPage: number;
  name: string;
  board?: string;
  /** mm (réels) par point PDF : échelle écrite sur le plan (« 1:75 »), sinon plan de 12 m de large, à mettre à l'échelle. */
  mmPerPt: number;
  scaled: boolean;
}

/** Largeur supposée d'un plan sans échelle (comme un fond de plan importé, voir PlanView). */
const DEFAULT_PLAN_WIDTH_MM = 12000;
const PT_MM = 25.4 / 72;
const PLAN_TITLE =
  /^(plan de position|plan de situation|situation plan|site plan|floor plan|position plan|situatieschema|situatieplan|liggingsplan|grondplan|lageplan|installationsplan|grundriss|plan)(?:\s*[-–·:]\s*(.+))?$/;
const LEGEND = /(legende|legend|legenda|zeichenerklarung)/;
/** Repère d'un point : « A1 », « AB12 », « E-A3 ». */
const POINT_LABEL = /^((?:[A-Z]{1,3}-)?[A-Z]{1,3})(\d{1,2})$/;

/** Pages de plan du PDF (titre « Plan de position – Rez », « Plan · Toiture », « Plan de situation »…). */
export function findPlanPages(items: PdfText[], pages: PdfPageSize[]): PdfPlanPage[] {
  const out: PdfPlanPage[] = [];
  pages.forEach((size, i) => {
    const page = i + 1;
    const list = items.filter((it) => it.page === page);
    let name: string | undefined;
    let found = false;
    for (const it of list) {
      const m = PLAN_TITLE.exec(fold(it.str));
      if (!m) continue;
      // Sommaire : numéro de page sur la même ligne, à droite
      if (list.some((q) => q !== it && Math.abs(q.y - it.y) <= 3 && q.x > it.x + 150 && /^\d{1,3}$/.test(q.str.trim()))) continue;
      if (m[2] && LEGEND.test(m[2])) {
        found = false;
        name = undefined;
        break;
      }
      found = true;
      if (m[2]) name = it.str.trim().replace(/^[^-–·:]*[-–·:]\s*/, '');
    }
    if (!found) return;
    // Sans nom dans le titre (Condui) : grand titre en haut de page « Étage - Tableau »
    let board: string | undefined;
    if (!name) {
      const top = list.filter((it) => it.y < size.height * 0.12 && it.str.trim().length > 1).sort((a, b) => b.size - a.size)[0];
      if (top) {
        const parts = top.str.split(/\s+[-–]\s+/);
        name = parts[0].trim();
        board = parts[1]?.trim();
      }
    }
    const sc = list.map((it) => /(?:echelle|schaal|scale|massstab|maßstab)\s*1\s*[:/]\s*(\d{1,4})/i.exec(fold(it.str))).find(Boolean);
    const scaled = !!sc;
    out.push({ pdfPage: page, name: name || `Plan ${out.length + 1}`, board, mmPerPt: sc ? PT_MM * Number(sc[1]) : DEFAULT_PLAN_WIDTH_MM / size.width, scaled });
  });
  return out;
}

/** Projet Voltaplan à partir du texte d'un dossier PDF. */
export function importPdfDossier(items: PdfText[], pages: PdfPageSize[], fileName = 'Dossier PDF', shapes: PdfShape[][] = []): PdfDossierResult {
  const rows = readCircuitTables(items, pages);
  if (!rows.length) {
    if (!items.length) throw new Error("Ce PDF ne contient pas de texte lisible (texte dessiné ou document scanné) : il ne peut pas être repris automatiquement. Importez-le comme fond de plan, ou utilisez la lecture d'une photo du tableau.");
    throw new Error("Aucun tableau des circuits trouvé dans ce PDF (colonnes « repère », « protection », « câble »…). Il ne peut pas être repris automatiquement.");
  }
  const warnings = new Set<string>();
  const project = emptyProject();
  const all = items.map((i) => i.str).join(' ');
  const supply = detectSupply(all);
  project.meta = { ...project.meta, title: fileName.replace(/\.pdf$/i, ''), supply: supply ?? project.meta.supply };
  const ean = /\b(54\d{16})\b/.exec(all.replace(/\s/g, ' '))?.[1];
  if (ean) project.meta.ean = ean;
  const meter = project.roots[0].children[0];
  const mainRcd = meter.children[0];
  const mainBoard = mainRcd.children[0];
  // Le différentiel général n'est pas dans le tableau des circuits : celui du modèle (300 mA) est gardé, à vérifier
  warnings.add('Différentiel général et compteur : valeurs par défaut de Voltaplan, à vérifier sur le schéma du PDF.');
  const otherKids = mainBoard.children.filter((n) => n.kind !== 'protection');
  mainBoard.children = [];

  // Tableaux : le premier nommé (ou sans nom) = tableau principal ; les autres sont des sous-tableaux
  const boardNames = [...new Set(rows.map((r) => r.board))];
  const boards = new Map<string, ElNode>();
  boardNames.forEach((name, i) => {
    if (i === 0) {
      if (name) mainBoard.props.name = name;
      boards.set(name, mainBoard);
    } else boards.set(name, createNode('board', { name }));
  });
  const nodesByCode = new Map<string, ElNode>();
  let lastRcd: { board: ElNode; ma: number; node: ElNode } | null = null;
  let unknown = 0;
  const pointsOf: { row: DossierCircuit; points: ElNode[] }[] = [];
  // Même repère dans plusieurs tableaux (« A » du principal et du sous-tableau) : repères des points ambigus
  const shared = new Set(rows.filter((r, i) => rows.findIndex((q) => q.code === r.code) !== i).map((r) => r.code));
  for (const r of rows) {
    const board = boards.get(r.board)!;
    const prot = parseProtection(r.protection);
    const diffMa = residualMa(r.diff);
    const label = [r.name, r.type].filter(Boolean).join(' ');
    const isSpare = SPARE.test(fold(label));
    const mcb = createNode('protection', {
      device: prot.residualCurrent !== undefined ? 'rcbo' : 'mcb',
      circuitName: r.name ?? r.type,
      fixedLetter: r.code,
      ...prot,
    });
    if (prot.curve === undefined) delete mcb.props.curve;
    if (prot.breakingCapacity === undefined) delete mcb.props.breakingCapacity;
    if (prot.poles === undefined) delete mcb.props.poles;
    if (prot.ratedCurrent === undefined) delete mcb.props.ratedCurrent;
    const cable = createNode('cable', parseCable(r.cable));
    for (const k of ['cableType', 'section', 'conductors', 'inConduit', 'method'] as const) if (!(k in parseCable(r.cable))) delete cable.props[k];
    mcb.children.push(cable);
    nodesByCode.set(r.code, mcb);
    const points: ElNode[] = [];
    pointsOf.push({ row: r, points });
    // Points : nombre (colonne « points » ou repères A1, A2… des autres pages), type d'après le nom du circuit
    const n = r.points ?? countPoints(items, r.code);
    if (r.points === undefined && shared.has(r.code) && n > 0) warnings.add(`Repère ${r.code} utilisé dans plusieurs tableaux : nombre de points à vérifier.`);
    const it = interpretLabel(label);
    const room = r.rooms && !/,/.test(r.rooms) ? r.rooms : it.room;
    // Catégorie seule (« Appareil fixe », « Vast toestel », « CVC ») : un appareil à préciser
    const fixed = /(appareil fixe|vast toestel|vaste verbruiker|fixed appliance|festanschluss|fest angeschlossen|\bcvc\b|\bhvac\b)/.test(fold(label));
    const usage = SUBBOARD.test(fold(label)) || isSpare ? null : (it.usage ?? (fixed ? ({ kind: 'appliance', applianceType: 'other' } as const) : undefined));
    if (usage && n > 0) {
      const count = usage.kind === 'appliance' ? Math.max(1, Math.min(n, 1)) : n;
      for (let i = 0; i < count; i++) {
        const kind: NodeKind = usage.kind === 'board' ? 'other' : (usage.kind as NodeKind);
        const p = createNode(kind, usage.kind === 'appliance' ? { applianceType: usage.applianceType } : {});
        if (room) p.location = room;
        cable.children.push(p);
        points.push(p);
      }
      if (usage.kind === 'appliance' && n > 1) warnings.add(`Circuit ${r.code} : ${n} points pour un appareil, un seul repris ; complétez les autres.`);
    } else if (!isSpare && !SUBBOARD.test(fold(label)) && n > 0) unknown++;
    // Différentiel de groupe : circuits consécutifs avec le même 30 mA (colonne « différentiel ») ; 300 mA = général
    if (diffMa !== undefined && diffMa < 100 && prot.residualCurrent === undefined) {
      if (!lastRcd || lastRcd.board !== board || lastRcd.ma !== diffMa) {
        const rcd = createNode('protection', { device: 'rcd', residualCurrent: diffMa, poles: prot.poles ?? '2P' });
        delete rcd.props.curve;
        delete rcd.props.breakingCapacity;
        delete rcd.props.ratedCurrent;
        const t = /\btype\s?(AC|A|F|B)\b/i.exec(r.diff ?? '')?.[1];
        if (t) rcd.props.rcdType = t.toUpperCase();
        board.children.push(rcd);
        lastRcd = { board, ma: diffMa, node: rcd };
      }
      lastRcd.node.children.push(mcb);
    } else {
      lastRcd = null;
      board.children.push(mcb);
    }
  }
  // Sous-tableaux : sous le circuit qui porte leur nom ou un type « sous-tableau », sinon dans le tableau principal
  for (const [name, b] of boards) {
    if (b === mainBoard) continue;
    const feeder = rows.find((r) => r.board !== name && (fold(r.name ?? '') === fold(name) || SUBBOARD.test(fold(r.type ?? '')) || fold(r.name ?? '').includes(fold(name))));
    const cable = feeder ? nodesByCode.get(feeder.code)?.children[0] : undefined;
    if (cable) {
      cable.children.push(b);
      b.props.fixedLetter = feeder!.code;
    } else {
      mainBoard.children.push(b);
      warnings.add(`Sous-tableau « ${name} » : circuit d'alimentation non trouvé, placé dans le tableau principal.`);
    }
  }
  mainBoard.children.push(...otherKids);
  if (unknown) warnings.add(`${unknown} circuit(s) dont le type de points n'a pas pu être déduit du nom : points à ajouter.`);
  const backgrounds = placeOnPlans(project, items, pages, pointsOf, boardNames[0] ?? '', warnings, shapes);
  readBoardFronts(project, items, pages, nodesByCode, shared, warnings);
  warnings.add(
    backgrounds.length
      ? 'Le type exact des points et leurs commandes (interrupteurs) ne sont pas dans le texte du PDF : à compléter.'
      : 'Le type exact des points, leurs commandes (interrupteurs) et leur position sur le plan ne sont pas dans le texte du PDF : à compléter. Le plan peut être importé comme fond de plan (onglet Plan).',
  );
  return { project, warnings: [...warnings], circuits: rows.length, backgrounds };
}

/** Page de face avant d'un tableau (« Disposition du tableau », « Face avant », « Bordindeling »…), pas un schéma. */
const FRONT_TITLE = /^(disposition du tableau.*|face avant|tableau|bordindeling.*|bordopstelling|board layout|switchboard layout|panel layout|verteilerbelegung|frontansicht|aanzicht bord)$/;
const DIAGRAM = /(schema unifilaire|eendraadschema|single-line|single line|einlinien|stroomkringschema|plan de position|plan de situation|situatieschema|situation plan)/;
/** Calibre écrit sous le repère dans une case de la face avant (« C16 », « B16 », « 16A »). */
const RATING = /^([BCDK]\s?\d{1,3}\s?A?|\d{1,3}\s?A)$/i;

/**
 * Face avant des tableaux : sur une page de disposition, chaque case porte le repère du circuit (A, B…) et son calibre
 * juste en dessous. Rangées = lignes de repères ; colonne (en modules) d'après l'abscisse, ramenée à la largeur des
 * appareils. Les différentiels (sans repère de circuit) restent à placer : la disposition habituelle les complète.
 */
function readBoardFronts(
  project: Project,
  items: PdfText[],
  pages: PdfPageSize[],
  nodesByCode: Map<string, ElNode>,
  shared: Set<string>,
  warnings: Set<string>,
): void {
  const frontPages = pages
    .map((_, i) => i + 1)
    .filter((p) => {
      const list = items.filter((it) => it.page === p);
      return list.some((it) => FRONT_TITLE.test(fold(it.str))) && !list.some((it) => DIAGRAM.test(fold(it.str)));
    });
  if (!frontPages.length) return;
  const encs = enclosures(project.roots);
  const encOf = new Map<string, (typeof encs)[number]>();
  for (const e of encs) for (const d of e.devices) encOf.set(d.id, e);
  const found = new Map<string, { page: number; x: number; y: number; node: ElNode }>();
  for (const p of frontPages) {
    const list = items.filter((it) => it.page === p);
    const here: { x: number; y: number; node: ElNode; code: string }[] = [];
    for (const it of list) {
      const code = it.str.trim();
      const node = nodesByCode.get(code);
      if (!node || shared.has(code) || found.has(code)) continue;
      const below = list.some((q) => q !== it && q.y > it.y + 2 && q.y < it.y + 45 && Math.abs(q.x - it.x) < 25 && RATING.test(q.str.trim()));
      if (below) here.push({ x: it.x, y: it.y, node, code });
    }
    if (here.length < 3) continue;
    for (const h of here) found.set(h.code, { page: p, x: h.x, y: h.y, node: h.node });
  }
  if (!found.size) return;
  let placedN = 0;
  project.boards = { ...(project.boards ?? {}) };
  for (const e of encs) {
    const mine = [...found.values()].filter((f) => encOf.get(f.node.id) === e);
    if (mine.length < 2) continue;
    // Rangées : repères à la même hauteur (à 8 points près), de haut en bas
    const lines: (typeof mine)[] = [];
    for (const f of [...mine].sort((a, b) => a.y - b.y)) {
      const l = lines.find((q) => q[0].page === f.page && Math.abs(q[0].y - f.y) <= 8);
      if (l) l.push(f);
      else lines.push([f]);
    }
    for (const l of lines) l.sort((a, b) => a.x - b.x);
    // Largeur d'un module (points) : plus petit écart entre deux cases voisines, divisé par la largeur de la première
    let unit = Infinity;
    for (const l of lines) for (let i = 0; i + 1 < l.length; i++) unit = Math.min(unit, (l[i + 1].x - l[i].x) / moduleWidth(l[i].node));
    if (!Number.isFinite(unit) || unit <= 0) continue;
    const x0 = Math.min(...mine.map((f) => f.x));
    const slots: Record<string, { row: number; col: number }> = {};
    let perRow = 0;
    lines.forEach((l, row) => {
      let end = 0;
      for (const f of l) {
        const col = Math.max(end, Math.round((f.x - x0) / unit));
        slots[f.node.id] = { row, col };
        end = col + moduleWidth(f.node);
        placedN++;
      }
      perRow = Math.max(perRow, end);
    });
    project.boards[e.board.id] = { slots };
    const size = { rows: Math.max(1, Number(e.board.props.rows) || 2), perRow: Math.max(4, Number(e.board.props.modulesPerRow) || 13) };
    if (lines.length > size.rows) e.board.props.rows = lines.length;
    if (perRow > size.perRow) e.board.props.modulesPerRow = perRow;
  }
  if (placedN) warnings.add(`Face avant du tableau lue dans le PDF : ${placedN} disjoncteur(s) placé(s) à leur rangée ; différentiels et généraux à placer (onglet Tableau, « Mettre à jour »).`);
}

/** Éléments posés contre un mur (trait de raccordement tourné vers le mur le plus proche). */
const WALL_KINDS = new Set(['socket', 'switch', 'pushButton']);

/**
 * Plans : une page Voltaplan par étage (pages du PDF de même nom regroupées), avec le fond de plan à rendre, et
 * chaque point posé à côté de son repère (« A1 » : point n° 1 du circuit A). Les repères d'une page « Étage -
 * Tableau » appartiennent à ce tableau (un « A » de sous-tableau n'est pas le « A » du tableau principal).
 */
function placeOnPlans(
  project: Project,
  items: PdfText[],
  pages: PdfPageSize[],
  pointsOf: { row: DossierCircuit; points: ElNode[] }[],
  mainBoard: string,
  warnings: Set<string>,
  shapes: PdfShape[][] = [],
): { pageIndex: number; pdfPage: number }[] {
  const plans = findPlanPages(items, pages);
  if (!plans.length) return [];
  // Murs, portes et fenêtres lus dans le dessin de chaque page de plan ; échelle estimée par les portes si besoin
  const drawn = new Map<number, ReturnType<typeof planFromShapes>>();
  let byDoors = 0;
  for (const pl of plans) {
    // Moins de 3 murs : pas un plan dessiné en traits (bâtiment en image, Volter) ; relevé sur l'image ensuite
    const d0 = planFromShapes(shapes[pl.pdfPage - 1] ?? []);
    const d = d0.walls.length >= 3 ? d0 : { walls: [], openings: [] };
    drawn.set(pl.pdfPage, d);
    if (!pl.scaled) {
      const k = scaleFromDoors(d.openings);
      if (k) {
        pl.mmPerPt = k;
        pl.scaled = true;
        byDoors++;
      }
    }
  }
  const backgrounds: { pageIndex: number; pdfPage: number }[] = [];
  const byName = new Map<string, { page: PlanPage; mmPerPt: number }>();
  project.plan.pages = [];
  for (const pl of plans) {
    if (byName.has(pl.name)) continue;
    const size = pages[pl.pdfPage - 1];
    const page = emptyPage(pl.name);
    const w = Math.round(size.width * pl.mmPerPt);
    const h = Math.round(size.height * pl.mmPerPt);
    const d = drawn.get(pl.pdfPage);
    const k = pl.mmPerPt;
    const mm = (p: { x: number; y: number }) => ({ x: Math.round(p.x * k), y: Math.round(p.y * k) });
    if (d) {
      page.walls = d.walls.map((v) => ({ a: mm(v.a), b: mm(v.b), thickness: Math.round(v.thickness * k) }));
      page.openings = d.openings.map((o) =>
        o.kind === 'door'
          ? { kind: 'door' as const, a: mm(o.a), b: mm(o.b), width: Math.round(o.width * k), hinge: o.plusY ? ('right' as const) : ('left' as const), mirrored: o.hingeAtB }
          : { kind: 'window' as const, a: mm(o.a), b: mm(o.b), width: Math.round(o.width * k) },
      );
    }
    page.images.push({ center: { x: Math.round(w / 2), y: Math.round(h / 2) }, w, h, angle: 0, href: '', background: true, linked: true });
    byName.set(pl.name, { page, mmPerPt: pl.mmPerPt });
    backgrounds.push({ pageIndex: project.plan.pages.length, pdfPage: pl.pdfPage });
    project.plan.pages.push(page);
    project.plan.width = Math.max(project.plan.width, w + 1000);
    project.plan.height = Math.max(project.plan.height, h + 1000);
  }
  // Repères des points sur chaque page de plan
  const labels = plans.flatMap((pl) =>
    items
      .filter((it) => it.page === pl.pdfPage && POINT_LABEL.test(it.str.trim()))
      .map((it) => ({ it, pl, code: POINT_LABEL.exec(it.str.trim())![1], n: Number(POINT_LABEL.exec(it.str.trim())![2]) })),
  );
  const boardOf = (pl: PdfPlanPage) => (pl.board && pl.board !== mainBoard ? pl.board : mainBoard);
  let placed = 0;
  let missing = 0;
  for (const { row, points } of pointsOf) {
    points.forEach((node, i) => {
      const same = (x: (typeof labels)[number]) => x.code === row.code && x.n === i + 1;
      let cands = labels.filter((x) => same(x) && boardOf(x.pl) === (row.board || mainBoard));
      if (!cands.length) cands = labels.filter((x) => same(x) && !x.pl.board);
      // Même repère pour la lampe et son interrupteur : la lampe est le repère le plus loin des murs, une prise ou un
      // interrupteur le plus près (murs lus dans le dessin de la page)
      const wallsOf = (x: (typeof labels)[number]) => drawn.get(x.pl.pdfPage)?.walls ?? [];
      const dw = (x: (typeof labels)[number]) => distToWalls({ x: x.it.x, y: x.it.y }, wallsOf(x));
      const l = cands.length > 1 && cands.some((x) => wallsOf(x).length) ? [...cands].sort((p, q) => (WALL_KINDS.has(node.kind) ? dw(p) - dw(q) : dw(q) - dw(p)))[0] : cands[0];
      if (!l) {
        missing++;
        return;
      }
      const target = byName.get(l.pl.name)!;
      // Le repère est écrit à côté du symbole : point posé juste à sa gauche
      const k = l.pl.mmPerPt;
      target.page.symbols.push({ nodeId: node.id, pos: { x: Math.round((l.it.x - l.it.size) * k), y: Math.round((l.it.y - l.it.size * 0.4) * k) }, rotation: 0, autoRotate: WALL_KINDS.has(node.kind) || undefined });
      placed++;
    });
  }
  // Noms des pièces : textes du plan reconnus comme une pièce (FR, NL, EN, DE), dans l'emprise des murs ; chaque
  // point prend la pièce dont il est le plus proche du nom, à l'intérieur de ses murs
  let rooms = 0;
  for (const pl of plans) {
    const target = byName.get(pl.name)!;
    if (target.page.labels.length && pl !== plans.find((q) => q.name === pl.name)) continue;
    const k = pl.mmPerPt;
    const d = drawn.get(pl.pdfPage);
    const xs = d?.walls.flatMap((v) => [v.a.x, v.b.x]) ?? [];
    const ys = d?.walls.flatMap((v) => [v.a.y, v.b.y]) ?? [];
    const inside = (x: number, y: number) => !xs.length || (x > Math.min(...xs) && x < Math.max(...xs) && y > Math.min(...ys) && y < Math.max(...ys));
    for (const it of items) {
      if (it.page !== pl.pdfPage) continue;
      const str = it.str.trim();
      if (str.length < 2 || str.split(/\s+/).length > 4 || POINT_LABEL.test(str)) continue;
      const r = interpretLabel(str);
      if (!r.room || r.usage || !inside(it.x, it.y)) continue;
      if (target.page.labels.some((l) => l.text === str)) continue;
      const w = str.length * it.size * 0.5;
      target.page.labels.push({ id: uid(), text: str, pos: { x: Math.round((it.x + w / 2) * k), y: Math.round(it.y * k) }, size: 3 });
      rooms++;
    }
  }
  for (const { page } of byName.values()) {
    if (!page.labels.length) continue;
    const zones = page.labels.map((l) => ({ l, b: roomBounds(page, l.pos) }));
    for (const s of page.symbols) {
      const hit = zones
        .filter(({ b }) => s.pos.x >= b.x0 - 50 && s.pos.x <= b.x1 + 50 && s.pos.y >= b.y0 - 50 && s.pos.y <= b.y1 + 50)
        .sort((p, q) => (p.b.x1 - p.b.x0) * (p.b.y1 - p.b.y0) - (q.b.x1 - q.b.x0) * (q.b.y1 - q.b.y0))[0];
      const node = pointsOf.flatMap((x) => x.points).find((n) => n.id === s.nodeId);
      if (hit && node) node.location = hit.l.text;
    }
  }
  if (rooms) warnings.add(`${rooms} nom(s) de pièce lu(s) sur le plan ; les points posés y prennent leur pièce.`);
  const nWalls = [...byName.values()].reduce((s, v) => s + v.page.walls.length, 0);
  const nOpen = [...byName.values()].reduce((s, v) => s + v.page.openings.length, 0);
  if (nWalls) warnings.add(`${nWalls} mur(s) et ${nOpen} porte(s) ou fenêtre(s) lus dans le dessin du PDF : à vérifier.`);
  if (byDoors) warnings.add("Échelle estimée d'après les portes (largeur courante 85 cm) : vérifiez une cote, et corrigez avec « Mettre à l'échelle » si besoin.");
  const unscaled = plans.filter((pl) => !pl.scaled).map((pl) => pl.name);
  warnings.add(
    `Plans du PDF repris en fond de plan (${[...byName.keys()].join(', ')})${placed ? ` ; ${placed} point(s) posé(s) à côté de leur repère, position à vérifier` : ''}${missing ? ` ; ${missing} sans repère trouvé (à placer)` : ''}.`,
  );
  if (unscaled.length) warnings.add(`Échelle non indiquée sur le plan (${[...new Set(unscaled)].join(', ')}) : utilisez « Mettre à l'échelle » (onglet Plan) sur une cote connue.`);
  return backgrounds;
}
