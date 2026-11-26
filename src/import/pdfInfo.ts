/**
 * Informations d'un dossier PDF repris (cartouche, page de garde, fiche de l'installation) et contrôle par sa liste
 * du matériel. Lecture du texte seulement, en français, néerlandais, anglais ou allemand.
 *
 * Un libellé (« Adresse de l'installation », « Installateur », « Klant »…) est suivi de sa valeur, soit à droite sur
 * la même ligne (Draadwijs), soit sur les lignes en dessous (Volter, Condui, Amperio).
 */
import { walk } from '../model/tree';
import type { Address, ElNode, Project } from '../model/types';
import type { PdfText } from './pdfDossier';

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/[\s:]+$/, '')
    .trim();

type Field = 'site' | 'client' | 'installer' | 'inspection' | 'mainCurrent';
const LABELS: [Field, RegExp][] = [
  ['site', /^(adresse d'installation|adresse de l'installation|adresse du chantier|adresse|installatieadres|adres van de installatie|adres installatie|adres|installation address|site address|address|anlagenadresse|installationsadresse|adresse der anlage|standort)$/],
  ['client', /^(client|cliente|klant|opdrachtgever|customer|client name|kunde|auftraggeber|bauherr|proprietaire|eigenaar|owner)$/],
  ['installer', /^(installateur|installer|electricien|elektricien|elektriker|errichter|resp\. de l'execution|responsable de l'execution|responsable des travaux|verantwoordelijke voor de uitvoering|uitvoerder|verantwoordelijke|responsible for the works|contractor)$/],
  ['inspection', /^(organisme agree|organisme de controle|erkend organisme|keuringsorganisme|inspection body|approved body|inspecteur|prufstelle|prufer)$/],
  ['mainCurrent', /^(protection de branchement( \(in\))?|courant de branchement|aansluitbeveiliging|hoofdzekering|aansluitstroom|main fuse|service fuse|hausanschlusssicherung|hauptsicherung)$/],
];
/** Autres libellés d'un cartouche : ils arrêtent la lecture d'une valeur (ce ne sont pas des valeurs). */
const OTHER_LABEL = /^(tension, courant|tension|spanning|spanning, stroom|voltage|spannung|ean|code ean|date|datum|n°|reseau|net|network|netz|usage|gebruik|use|verwendung|type de chantier|type werf|site type|job site type|type of site|baustellentyp|contact sur place|contact ter plaatse|on-site contact|ansprechpartner vor ort|document|schema unifilaire|eendraadschema|eendraadsschema|one-wire diagram|single-line diagram|eindrahtdiagramm|einliniendiagramm|stromlaufplan|plan de situation|situatieschema|situation plan|lageplan|plan de position|tableau|bord|board|panel|verteiler|legende|legend)$/;
/** Valeur sans contenu (case à remplir, signature) : ignorée. */
const EMPTY_VALUE = /(signature|visa|visum|sign-off|handtekening|unterschrift|cachet|stempel|non renseigne|niet ingevuld|not filled)/;
const fieldOf = (s: string): Field | null => {
  const f = fold(s);
  for (const [k, re] of LABELS) if (re.test(f)) return k;
  return null;
};
const COUNTRY = /^(belgique|belgie|belgium|belgien|belgica|nederland|france|deutschland|luxembourg)$/i;

/** Valeur d'un libellé : à droite sur la même ligne, sinon les lignes en dessous (jusqu'au libellé suivant). */
function valueOf(label: PdfText, list: PdfText[]): string[] {
  const isLabel = (q: PdfText) => !!fieldOf(q.str) || OTHER_LABEL.test(fold(q.str));
  // À droite, dans la même case (formulaire « libellé | valeur ») : pas la colonne voisine d'un formulaire à colonnes
  const right = list.filter((q) => q !== label && Math.abs(q.y - label.y) <= 3 && q.x > label.x + 15 && q.x < label.x + 130).sort((a, b) => a.x - b.x);
  const rightVals: string[] = [];
  for (const q of right) {
    if (isLabel(q)) break;
    rightVals.push(q.str.trim());
  }
  if (rightVals.length) return EMPTY_VALUE.test(fold(rightVals.join(' '))) ? [] : [rightVals.join(' ')];
  // Libellé d'un formulaire sans valeur : la ligne suivante est un autre libellé (« Tension, courant | 230 V »). Une
  // voisine de droite alignée sur un autre libellé de la page est la colonne suivante d'un cartouche, pas une valeur.
  const labelXs = list.filter((o) => isLabel(o)).map((o) => o.x);
  const formRow = (q: PdfText) => list.some((o) => o !== q && Math.abs(o.y - q.y) <= 3 && o.x > q.x + 15 && o.x < q.x + 130 && !labelXs.some((x) => Math.abs(x - o.x) <= 3));
  // Sous le libellé, dans sa colonne (jusqu'au libellé suivant de la même ligne)
  const nextCol = Math.min(label.x + 140, ...list.filter((o) => o !== label && Math.abs(o.y - label.y) <= 3 && o.x > label.x + 15 && isLabel(o)).map((o) => o.x - 4));
  const below = list.filter((q) => q.y > label.y + 2 && q.y < label.y + 70 && q.x >= label.x - 4 && q.x < nextCol).sort((a, b) => a.y - b.y || a.x - b.x);
  const out: string[] = [];
  let lastY = label.y;
  for (const q of below) {
    if (isLabel(q) || formRow(q) || EMPTY_VALUE.test(fold(q.str)) || q.y - lastY > 2.6 * Math.max(q.size, 6.5)) break;
    const sameLine = out.length && Math.abs(q.y - lastY) <= 3;
    if (sameLine) out[out.length - 1] += ' ' + q.str.trim();
    else out.push(q.str.trim());
    lastY = q.y;
    if (out.length >= 5) break;
  }
  return out.filter(Boolean);
}

export interface Party {
  name?: string;
  address: Address;
  phone?: string;
  email?: string;
  vat?: string;
}

/** Lignes d'un bloc (nom, rue, code postal et localité, pays, téléphone, e-mail) → coordonnées. */
export function parseParty(lines: string[]): Party {
  const out: Party = { address: {} };
  const rest: string[] = [];
  for (const raw of lines.flatMap((l) => l.split(/\s+·\s+/))) {
    const l = raw.trim();
    if (!l) continue;
    const mail = /[\w.+-]+@[\w-]+\.[\w.]+/.exec(l)?.[0];
    if (mail) {
      out.email ??= mail;
      continue;
    }
    const vat = /\bBE\s?0?\d{3}[.\s]?\d{3}[.\s]?\d{3}\b/i.exec(l)?.[0];
    if (vat) {
      out.vat ??= vat.replace(/\s/g, '');
      continue;
    }
    if (/^\+?\d[\d\s/.-]{7,}$/.test(l)) {
      out.phone ??= l;
      continue;
    }
    if (COUNTRY.test(l)) {
      out.address.country = l;
      continue;
    }
    // « Rue de la Loi 16, 1000 Bruxelles » ou « 9000 Gent »
    const m = /^(?:(.+?),\s*)?(\d{4,5})\s+([^\d,]{2,})$/.exec(l);
    if (m && !out.address.postalCode) {
      if (m[1]) out.address.street = m[1].trim();
      out.address.postalCode = m[2];
      out.address.city = m[3].trim();
      continue;
    }
    rest.push(l);
  }
  // Rue : la ligne qui précède le code postal et contient un numéro ; nom : la première autre ligne
  if (!out.address.street) {
    const i = rest.findIndex((l) => /\d/.test(l) && /[a-zà-ÿ]{3,}/i.test(l));
    if (i >= 0) out.address.street = rest.splice(i, 1)[0];
    // Rue sans numéro (« rue toto ») : la ligne juste avant le code postal, après le nom
    else if (rest.length >= 2 && out.address.postalCode) out.address.street = rest.splice(rest.length - 1, 1)[0];
  }
  if (rest.length) out.name = rest[0];
  return out;
}

export interface PdfInfo {
  title?: string;
  site?: Party;
  client?: Party;
  installer?: Party;
  inspection?: string;
  mainCurrent?: number;
  date?: string;
  docNumber?: string;
  installationKind?: 'new' | 'existing';
}

/** Date du dossier : AAAA-MM-JJ, JJ/MM/AAAA (ou MM/JJ/AAAA quand le jour dépasse 12, format américain). */
export function parseDate(s: string): string | undefined {
  const iso = /\b(20\d{2})-(\d{2})-(\d{2})\b/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = /\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/.exec(s);
  if (!m) return undefined;
  let d = Number(m[1]);
  let mo = Number(m[2]);
  if (mo > 12 && d <= 12) [d, mo] = [mo, d];
  if (mo > 12 || d > 31) return undefined;
  return `${m[3]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Informations du dossier, d'après le premier libellé trouvé de chaque sorte (pages dans l'ordre). */
export function readPdfInfo(items: PdfText[]): PdfInfo {
  const info: PdfInfo = {};
  const pagesOf = [...new Set(items.map((i) => i.page))].sort((a, b) => a - b);
  const done = new Set<Field>();
  for (const p of pagesOf) {
    const list = items.filter((i) => i.page === p);
    for (const it of list) {
      const f = fieldOf(it.str);
      if (!f || done.has(f)) continue;
      const v = valueOf(it, list);
      if (!v.length) continue;
      done.add(f);
      if (f === 'mainCurrent') {
        const a = /(\d{2,3})\s?A\b/.exec(v.join(' '));
        if (a) info.mainCurrent = Number(a[1]);
      } else if (f === 'inspection') info.inspection = v[0];
      else info[f] = parseParty(v);
    }
  }
  // Nom du projet : première ligne du bloc « adresse de l'installation » quand ce n'est pas l'adresse (Condui,
  // Volter), sinon le plus grand texte de la première page (page de garde)
  const firstPage = items.filter((i) => i.page === pagesOf[0]);
  const big = [...firstPage].filter((i) => i.str.trim().length > 3 && !/^(dossier|schema|plan|tableau|sommaire|inhoud|contents|inhalt)/.test(fold(i.str))).sort((a, b) => b.size - a.size)[0];
  // Intitulé du document (« Tableau », « Schéma unifilaire »…) : pas un nom de projet
  const docWord = (t?: string) => !!t && /^(tableau|bord|board|verteiler|schema|eendraad|eindraht|one-wire|single-line|plan|situatie|dossier|legende|liste)/.test(fold(t));
  const cover = big && big.size >= 16 && !docWord(big.str) ? big.str.trim() : undefined;
  info.title = cover ?? (docWord(info.site?.name) ? undefined : info.site?.name);
  const all = items.map((i) => i.str).join(' ');
  info.date = parseDate(all);
  info.docNumber = /N°\s*([A-Z][A-Z0-9]*-[A-Z0-9-]{2,})/.exec(all)?.[1];
  const f = fold(all);
  if (/(nouvelle installation|installation nouvelle|domestique, nouvelle|nieuwe installatie|new installation|neuanlage)/.test(f)) info.installationKind = 'new';
  else if (/(installation existante|bestaande installatie|existing installation|bestandsanlage)/.test(f)) info.installationKind = 'existing';
  return info;
}

/** Reporte les informations lues dans le projet (sans écraser ce qui est déjà rempli). */
export function applyPdfInfo(project: Project, info: PdfInfo): string[] {
  const m = project.meta;
  const got: string[] = [];
  const merge = (a: Address, b: Address) => ({ ...b, ...Object.fromEntries(Object.entries(a).filter(([, v]) => v)) });
  if (info.title) {
    m.title = info.title;
    got.push('nom du projet');
  }
  if (info.site && Object.keys(info.site.address).length) {
    m.site = merge(info.site.address, m.site ?? {});
    got.push("adresse de l'installation");
  }
  if (info.client && (info.client.name || Object.keys(info.client.address).length)) {
    m.client = { ...m.client, name: info.client.name ?? m.client.name, email: info.client.email ?? m.client.email, address: merge(info.client.address, m.client.address ?? {}) };
    got.push('client');
  }
  if (info.installer && (info.installer.name || Object.keys(info.installer.address).length)) {
    m.installer = { ...m.installer, name: info.installer.name ?? m.installer.name, phone: info.installer.phone ?? m.installer.phone, email: info.installer.email ?? m.installer.email, vat: info.installer.vat ?? m.installer.vat, address: merge(info.installer.address, m.installer.address ?? {}) };
    got.push('installateur');
  }
  if (info.inspection && !/^(-|–|signature)/i.test(info.inspection)) {
    m.inspectionBodyName = info.inspection;
    got.push('organisme agréé');
  }
  if (info.mainCurrent) {
    m.mainCurrent = info.mainCurrent;
    got.push('calibre du branchement');
  }
  if (info.date) {
    m.date = info.date;
    got.push('date');
  }
  if (info.docNumber) {
    m.docNumber = info.docNumber;
    got.push('numéro du dossier');
  }
  if (info.installationKind) {
    m.installationKind = info.installationKind;
    got.push(info.installationKind === 'new' ? 'installation nouvelle' : 'installation existante');
  }
  return got;
}

// ————— Cartouche et légende : zones sans mur —————

/** Libellés d'un cartouche (et mentions du logiciel) : ancres de la zone du cartouche. */
const CARTOUCHE_ANCHOR =
  /^(installation|installatie|installateur|installer|inspecteur|inspector|keurder|prufer|organisme agree.*|organisme|erkend organisme|document|documenttype|adresse.*|adres.*|address|client|klant|customer|kunde|responsable.*|resp\. .*|tension.*|spanning.*|ean|cree avec.*|genere avec.*|realise avec.*|made with.*|gemaakt met.*|erstellt mit.*|plan de position.*|plan de situation|situatieschema.*|situation plan|lageplan.*|plan · .*|feuille.*|blad .*|sheet .*|n° .*|visa .*|visum .*|date|datum|reseau.*|net.*|responsable des travaux|verantwoordelijke.*|organisme agree – .*)$/;
const LEGEND_TITLE = /^(legende|legend|legenda|zeichenerklarung)( .*)?$/;

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Zones d'une page de plan où il n'y a jamais de mur : le cartouche (libellés dans le bas de la page, jusqu'au bord)
 * et la légende (à partir de son titre). Elles sont retirées avant de lire les murs, les pièces et les repères.
 */
export function noWallZones(items: PdfText[], page: number, size: { width: number; height: number }): Rect[] {
  const list = items.filter((i) => i.page === page);
  const zones: Rect[] = [];
  const anchors = list.filter((i) => i.y > size.height * 0.55 && (CARTOUCHE_ANCHOR.test(fold(i.str)) || !!fieldOf(i.str)));
  let cartouche: Rect | null = null;
  if (anchors.length >= 2) {
    const x0 = Math.min(...anchors.map((a) => a.x)) - 10;
    const y0 = Math.min(...anchors.map((a) => a.y)) - Math.max(...anchors.map((a) => a.size)) - 8;
    // Jusqu'au bord droit de la dernière colonne (valeurs comprises), et jusqu'en bas de la page
    const lastCol = Math.max(...anchors.map((a) => a.x));
    // Cartouche à droite de la page : jusqu'au bord (son cadre y va)
    const x1 = x0 > size.width * 0.3 ? size.width : Math.min(size.width, Math.max(lastCol + 160, ...list.filter((i) => i.y >= y0 && i.x >= x0).map((i) => i.x + i.str.length * i.size * 0.55)));
    cartouche = { x0: Math.max(0, x0), y0, x1, y1: size.height };
    zones.push(cartouche);
  }
  for (const l of list.filter((i) => LEGEND_TITLE.test(fold(i.str)) && i.y > size.height * 0.4)) {
    const right = cartouche && cartouche.x0 > l.x ? cartouche.x0 - 2 : Math.min(size.width, l.x + 400);
    zones.push({ x0: Math.max(0, l.x - 10), y0: l.y - l.size - 6, x1: right, y1: size.height });
  }
  return zones;
}

export const inZone = (p: { x: number; y: number }, zones: Rect[]) => zones.some((z) => p.x >= z.x0 && p.x <= z.x1 && p.y >= z.y0 && p.y <= z.y1);

// ————— Liste du matériel —————

const BOM_TITLE = /^(liste du materiel|liste des materiels|liste de materiel|materiaallijst|materiaallijst|materialenlijst|stuklijst|bill of materials|material list|materials list|materialliste|stuckliste)$/;
const QTY = /^(quantite|qte|aantal|hoeveelheid|qty|quantity|menge|anzahl|stuck)$/;

export interface BomCount {
  lights: number;
  switches: number;
  /** Socles de prise (une prise double = 1 socle) et prises (une prise double = 2). */
  socketPoints: number;
  outlets: number;
}

/** Totaux de la liste du matériel du PDF (points lumineux, commandes, prises), ou null s'il n'y en a pas. */
export function readBom(items: PdfText[]): BomCount | null {
  // Page du titre et pages suivantes tant qu'elles ont une colonne « quantité » (liste sur plusieurs pages)
  const all = [...new Set(items.map((i) => i.page))].sort((a, b) => a - b);
  const hasQty = (p: number) => items.some((i) => i.page === p && QTY.test(fold(i.str)));
  const pagesOf: number[] = [];
  for (const p of all) {
    const titled = items.some((i) => i.page === p && BOM_TITLE.test(fold(i.str)));
    if ((titled || pagesOf.includes(p - 1)) && hasQty(p)) pagesOf.push(p);
  }
  if (!pagesOf.length) return null;
  const c: BomCount = { lights: 0, switches: 0, socketPoints: 0, outlets: 0 };
  let rowsRead = 0;
  for (const p of pagesOf) {
    const list = items.filter((i) => i.page === p);
    const qtyHead = list.find((i) => QTY.test(fold(i.str)));
    if (!qtyHead) continue;
    // Lignes : même hauteur ; quantité = nombre seul dans la colonne « quantité » (à 40 points près)
    const ys = [...new Set(list.filter((i) => i.y > qtyHead.y + 3).map((i) => Math.round(i.y)))].sort((a, b) => a - b);
    for (const y of ys) {
      const row = list.filter((i) => Math.abs(i.y - y) <= 2);
      const q = row.find((i) => Math.abs(i.x - qtyHead.x) < 40 && /^\d{1,4}$/.test(i.str.trim()));
      if (!q) continue;
      const n = Number(q.str.trim());
      const text = fold(row.filter((i) => i !== q).map((i) => i.str).join(' '));
      if (/\b(m|metres?|meter)\b/.test(text) && /(cable|kabel|leitung|gaine|buis)/.test(text)) continue;
      rowsRead++;
      if (/(interrupteur|schakelaar|switch|schalter|variateur|dimmer|bouton-poussoir|drukknop|push-?button|taster|telerupteur|teleruptor|stromstoss)/.test(text)) c.switches += n;
      else if (/(prise|stopcontact|contactdoos|socket|outlet|steckdose)/.test(text)) {
        const mult = /(triple|3 postes|driedubbel|drievoudig|3-voudig|dreifach|triple socket)/.test(text) ? 3 : /(double|2 postes|dubbel|tweevoudig|2-voudig|zweifach)/.test(text) ? 2 : 1;
        c.socketPoints += n;
        c.outlets += n * mult;
      } else if (/(point lumineux|lichtpunt|luminaire|armatuur|lamp|light|leuchte|applique|wandlamp|spot|projecteur|reglette|ruban led|dalle led|plafonnier|tl\b)/.test(text)) c.lights += n;
    }
  }
  return rowsRead ? c : null;
}

/** Compare la liste du matériel du PDF au schéma importé : écarts à vérifier (aucun si tout concorde). */
export function checkBom(project: Project, bom: BomCount): string {
  const nodes: ElNode[] = [...walk(project.roots)].map((x) => x.node);
  const lights = nodes.filter((n) => n.kind === 'light').reduce((s, n) => s + (Number(n.props.count) || 1), 0);
  const sockets = nodes.filter((n) => n.kind === 'socket');
  const outlets = sockets.reduce((s, n) => s + (Number(n.props.count) || 1), 0);
  const switches = nodes.filter((n) => n.kind === 'switch' || n.kind === 'pushButton').length;
  const gaps: string[] = [];
  if (bom.lights !== lights) gaps.push(`${bom.lights} point(s) lumineux (importé : ${lights})`);
  if (bom.socketPoints !== sockets.length) gaps.push(`${bom.socketPoints} prise(s) (importé : ${sockets.length})`);
  else if (bom.outlets !== outlets) gaps.push(`${bom.outlets} socles en comptant les prises doubles et triples (importé : ${outlets}) : nombre de socles des prises à préciser`);
  if (bom.switches !== switches) gaps.push(`${bom.switches} interrupteur(s) ou bouton(s)-poussoir(s) (importé : ${switches})`);
  return gaps.length
    ? `Liste du matériel du PDF : ${gaps.join(' ; ')}. À compléter ou vérifier.`
    : 'Liste du matériel du PDF : points lumineux, prises et commandes concordent avec le schéma importé.';
}
