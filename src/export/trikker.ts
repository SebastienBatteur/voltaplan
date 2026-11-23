/**
 * Export vers Trikker (.trik, XML en néerlandais, testé sur le format 1.5.17).
 *
 * - Les éléments importés de Trikker repartent de leurs attributs d'origine (rien n'est perdu), mis à jour
 *   avec les valeurs modifiées dans Voltaplan.
 * - Les éléments créés dans Voltaplan reçoivent les attributs Trikker correspondants.
 * - Le fichier est écrit comme Trikker l'écrit : Windows-1252, sans déclaration d'encodage.
 * Ce qui n'existe pas dans Trikker (mobilier vectoriel, disposition du tableau, mesures, IA) n'est pas exporté.
 */
import type { Address, ElNode, PlanPage, Project } from '../model/types';
import { APPLIANCES, COUNT_WORDS, LIGHTS, METHODS, POLES, TAG_KIND } from '../import/trikker';

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Retours à la ligne gardés dans les attributs (notes sur plusieurs lignes)
    .replace(/\r/g, '&#xD;')
    .replace(/\n/g, '&#xA;');
const invert = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]));
const KIND_TAG: Record<string, string> = invert(TAG_KIND as Record<string, string>);
KIND_TAG.protection = 'AutomatischeSchakelaar';
KIND_TAG.board = 'Verdeelbord';
KIND_TAG.detector = 'Bewegingsdetector';
const APPLIANCE_TYPE = invert(APPLIANCES);
APPLIANCE_TYPE.heater = 'Elektrischeverwarming';
const POLE_WORD = invert(POLES);
const METHOD_WORD = invert(METHODS);
const LIGHT_WORD = invert(LIGHTS);
const COUNT_WORD = Object.fromEntries(Object.entries(COUNT_WORDS).map(([k, v]) => [v, k]));
const ja = (b: boolean) => (b ? 'Ja' : 'Nee');
const dec = (v: unknown) => String(v).replace('.', ',');
const n = (v: unknown) => (v === undefined || v === null || v === '' ? undefined : Number(v));

/** Attributs Trikker d'un nœud : attributs d'origine + valeurs Voltaplan (une valeur vide retire l'attribut). */
function attributes(node: ElNode): { tag: string; attrs: Record<string, string> } {
  const p = node.props;
  const src = node.source?.format === 'trikker' ? node.source : undefined;
  let tag = src?.tag ?? KIND_TAG[node.kind] ?? 'Toestel';
  const a: Record<string, string> = { ...(src?.attrs ?? {}) };
  const set = (k: string, v: string | undefined) => {
    if (v === undefined || v === '') delete a[k];
    else a[k] = v;
  };
  a.Id = node.id;
  switch (node.kind) {
    case 'protection': {
      tag = p.device === 'fuse' ? 'Smeltzekering' : tag === 'Smeltzekering' ? 'AutomatischeSchakelaar' : tag;
      set('NaamKring', p.circuitName ? String(p.circuitName) : undefined);
      set('VasteLetter', p.fixedLetter ? String(p.fixedLetter) : undefined);
      set('NominaleStroomsterkte', n(p.ratedCurrent) !== undefined ? dec(p.ratedCurrent) : undefined);
      const poles = String(p.poles ?? '');
      set('AantalPolen', POLE_WORD[poles] ?? (poles && poles !== '1P+N' ? poles : undefined));
      set('Uitschakelcurve', p.device === 'rcd' ? undefined : p.curve ? String(p.curve) : undefined);
      const bc = n(p.breakingCapacity);
      set('Kortsluitstroom', bc !== undefined ? `${bc >= 100 ? bc / 1000 : bc}kA` : undefined);
      set('VerliesStroomsterkte', n(p.residualCurrent) ? dec(p.residualCurrent) : undefined);
      if ('Fase' in a || p.phase) set('Fase', p.phase ? String(p.phase) : '');
      break;
    }
    case 'board':
      set('NaamKring', p.name ? String(p.name) : undefined);
      set('VasteLetter', p.fixedLetter ? String(p.fixedLetter) : undefined);
      break;
    case 'meter':
      set('NaamKring', p.name ? String(p.name) : undefined);
      break;
    case 'cable':
      set('GeleiderType', p.cableType ? String(p.cableType) : undefined);
      set('GeleiderDoorsnede', n(p.section) !== undefined ? dec(p.section) : undefined);
      set('AantalGeleiders', n(p.conductors) !== undefined ? String(p.conductors) : undefined);
      set('InBuis', p.inConduit === undefined ? undefined : ja(p.inConduit === true));
      set('Plaatsing', p.method ? METHOD_WORD[String(p.method)] ?? String(p.method) : undefined);
      break;
    case 'socket': {
      const c = Number(p.count) || 1;
      set('Aantal', c > 1 ? COUNT_WORD[c] ?? String(c) : undefined);
      set('Beschermingsgeleider', p.earth === false ? 'Nee' : undefined);
      set('Kinderbescherming', p.childSafety === false ? 'Nee' : undefined);
      set('HalfWaterdicht', p.splashProof === true ? 'Ja' : undefined);
      set('AantalFasen', p.threePhase === true ? 'Drie' : undefined);
      break;
    }
    case 'switch': {
      const st = String(p.switchType ?? 'single');
      set('Type', st === 'twoWay' ? 'Wissel' : st === 'intermediate' ? 'Kruis' : st === 'double' ? 'Dubbel' : undefined);
      set('Dimmer', st === 'dimmer' ? 'Ja' : undefined);
      set('Rolluikschakelaar', st === 'shutter' ? 'Ja' : undefined);
      set('Trekschakelaar', st === 'pullCord' ? 'Ja' : undefined);
      set('AantalPolen', st === 'bipolar' ? 'Dubbelpolig' : undefined);
      set('Verklikkerlamp', p.pilotLight === true ? 'Ja' : undefined);
      set('Signalisatielamp', p.signalLamp === true ? 'Ja' : undefined);
      set('HalfWaterdicht', p.splashProof === true ? 'Ja' : undefined);
      break;
    }
    case 'light': {
      const lt = String(p.lightType ?? 'standard');
      set('Type', lt === 'wall' || lt === 'standard' ? (a.Type && LIGHTS[a.Type] === undefined ? a.Type : undefined) : LIGHT_WORD[lt]);
      set('Wandverlichting', lt === 'wall' ? 'Ja' : undefined);
      set('AantalBuislampen', (Number(p.count) || 1) > 1 ? String(p.count) : undefined);
      set('HalfWaterdicht', p.splashProof === true ? 'Ja' : undefined);
      break;
    }
    case 'appliance':
      set('Type', APPLIANCE_TYPE[String(p.applianceType)] ?? (p.name ? String(p.name) : undefined));
      break;
  }
  return { tag, attrs: a };
}

class Xml {
  lines: string[] = [];
  open(tag: string, attrs: Record<string, string | undefined> = {}, depth = 0, selfClose = false) {
    const at = Object.entries(attrs)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => ` ${k}="${esc(String(v))}"`)
      .join('');
    this.lines.push(`${'  '.repeat(depth)}<${tag}${at}${selfClose ? ' />' : '>'}`);
  }
  close(tag: string, depth: number) {
    this.lines.push(`${'  '.repeat(depth)}</${tag}>`);
  }
  text(tag: string, value: string | number | undefined, depth: number) {
    if (value === undefined || value === '') return;
    this.lines.push(`${'  '.repeat(depth)}<${tag}>${esc(String(value))}</${tag}>`);
  }
}

function writeNode(x: Xml, node: ElNode, depth: number) {
  const { tag, attrs } = attributes(node);
  const kids = node.children;
  const note = node.location?.trim();
  if (!kids.length && !note) {
    x.open(tag, attrs, depth, true);
    return;
  }
  x.open(tag, attrs, depth);
  x.open('Children', {}, depth + 1);
  for (const c of kids) writeNode(x, c, depth + 2);
  if (note) x.open('Nota', { Id: noteId(node.id), Width: String(Math.max(10, note.length * 1.1)), Height: '10', Tekst: note }, depth + 2, true);
  x.close('Children', depth + 1);
  x.close(tag, depth);
}

/** Id stable de la note d'un nœud (même résultat à chaque export). */
function noteId(id: string): string {
  const h = Array.from(id).reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16).padStart(8, '0');
  return `${h}-0000-4000-8000-${id.replace(/-/g, '').slice(-12).padStart(12, '0')}`;
}

function writeAddress(x: Xml, tag: string, a: Address | undefined, depth: number) {
  if (!a || !Object.values(a).some(Boolean)) return;
  x.open(tag, {}, depth);
  x.text('Land', a.country, depth + 1);
  x.text('Gemeente', a.city, depth + 1);
  x.text('Postcode', a.postalCode, depth + 1);
  x.text('Bus', a.box, depth + 1);
  x.text('Nummer', a.number, depth + 1);
  x.text('Straat', a.street, depth + 1);
  x.close(tag, depth);
}

function writePage(x: Xml, pg: PlanPage, depth: number) {
  const pt = (tag: string, p: { x: number; y: number }, d: number) => x.open(tag, { X: String(p.x), Y: String(p.y) }, d, true);
  x.open('GrondplanPage', { Id: pg.id }, depth);
  x.open('GrondplanElementen', {}, depth + 1);
  const e = depth + 2;
  for (const w of pg.walls) {
    x.open('Muur', { Breedte: String(w.thickness) }, e);
    pt('P1', w.a, e + 1);
    pt('P2', w.b, e + 1);
    x.close('Muur', e);
  }
  for (const o of pg.openings) {
    const tag = o.kind === 'window' || o.kind === 'slidingDoor' ? 'Raam' : o.kind === 'garageDoor' ? 'Garagepoort' : o.kind === 'stairs' ? 'Trap' : 'Deur';
    const attrs: Record<string, string | undefined> = { Breedte: o.width !== undefined ? String(o.width) : undefined };
    if (tag === 'Deur') {
      // Segment inversé quand la charnière est en b : le côté gauche devient le droit
      attrs.Type = (o.hinge === 'left') !== !!o.mirrored ? 'LinksDraaiend' : 'RechtsDraaiend';
      attrs.Gespiegeld = 'Nee';
    }
    if (tag === 'Garagepoort') attrs.Gespiegeld = ja(!!o.mirrored);
    // Charnière en b dans Voltaplan : on inverse les points pour Trikker (charnière au point de départ)
    const [a, b] = tag === 'Deur' && o.mirrored ? [o.b, o.a] : [o.a, o.b];
    x.open(tag, attrs, e);
    pt('P1', a, e + 1);
    pt('P2', b, e + 1);
    x.close(tag, e);
  }
  for (const r of pg.rects) {
    x.open('Rechthoek', { Breedte: String(r.w), Hoogte: String(r.h), Hoek: String(r.angle) }, e);
    pt('Center', r.center, e + 1);
    x.close('Rechthoek', e);
  }
  for (const im of pg.images) {
    const m = /^data:image\/png;base64,(.*)$/.exec(im.href);
    if (!m || im.background) continue; // Trikker : images PNG (meubles) seulement
    x.open('Figuur', { Breedte: String(im.w), Hoek: String(im.angle), Hoogte: String(im.h), ImageAsBase64: m[1] }, e);
    pt('Center', im.center, e + 1);
    x.close('Figuur', e);
  }
  x.close('GrondplanElementen', depth + 1);
  x.open('GrondplanNodes', {}, depth + 1);
  const node = (id: string, pos: { x: number; y: number }, rotationDeg: number, side?: string) => {
    x.open('GrondplanNode', {}, depth + 2);
    x.text('NodeId', id, depth + 3);
    pt('Position', pos, depth + 3);
    x.text('Rotation', String((rotationDeg * Math.PI) / 180), depth + 3);
    x.text('TekstPlaatsing', side, depth + 3);
    x.close('GrondplanNode', depth + 2);
  };
  for (const s of pg.symbols) node(s.nodeId, s.pos, s.rotation, s.labelSide);
  for (const l of pg.labels) node(l.id, l.pos, 0);
  x.close('GrondplanNodes', depth + 1);
  x.close('GrondplanPage', depth);
}

/** Texte XML Trikker du projet. */
export function exportTrikkerXml(project: Project, lang = 'fr'): string {
  const x = new Xml();
  const m = project.meta;
  x.lines.push('<?xml version="1.0"?>');
  x.open('Document', {
    'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
    'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    Version: '1.5.17.0',
    Datum: new Date().toISOString().slice(0, 19),
    Papierformaat: 'A3',
    PrintDatum: 'true',
    Stroomtype: m.supply,
    ExtraInfo: '',
    Taal: lang,
  });
  x.open('RootNodes', {}, 1);
  const roots = project.roots.length ? project.roots : [];
  roots.forEach((origin, i) => {
    x.open('StartNode', { Id: origin.id }, 2);
    x.open('Children', {}, 3);
    for (const c of origin.children) writeNode(x, c, 4);
    if (i === 0) {
      for (const l of project.loose) writeNode(x, l, 4);
      // Noms de pièces : notes libres placées sur le plan
      for (const pg of project.plan.pages) for (const l of pg.labels) x.open('Nota', { Id: l.id, Width: String(Math.max(10, l.text.length * 1.1)), Height: '10', Tekst: l.text, TekstGrootte: String(l.size ?? 3) }, 4, true);
    }
    x.close('Children', 3);
    x.close('StartNode', 2);
  });
  x.close('RootNodes', 1);

  x.open('Installateur', {}, 1);
  writeAddress(x, 'Adres', m.installer?.address, 2);
  x.text('Naam', m.installer?.name, 2);
  x.text('Email', m.installer?.email, 2);
  x.text('Gsm', m.installer?.phone, 2);
  x.close('Installateur', 1);
  x.open('Controleorganisme', {}, 1);
  x.text('Naam', m.inspectionBodyName ?? m.inspectionBody, 2);
  x.close('Controleorganisme', 1);
  x.open('Klant', {}, 1);
  writeAddress(x, 'Adres', m.client?.address, 2);
  x.text('Naam', m.client?.name, 2);
  x.text('Email', m.client?.email, 2);
  writeAddress(x, 'Werfadres', m.site, 2);
  x.close('Klant', 1);
  if (m.drawnBy) x.open('Gebruiker', { Naam: m.drawnBy }, 1, true);

  x.open('Grondplan', {}, 1);
  x.open('Pages', {}, 2);
  for (const pg of project.plan.pages) writePage(x, pg, 3);
  x.close('Pages', 2);
  x.text('Breedte', project.plan.width, 2);
  x.text('Hoogte', project.plan.height, 2);
  x.close('Grondplan', 1);
  x.close('Document', 0);
  return x.lines.join('\r\n') + '\r\n';
}

/** Encodage Windows-1252 (celui de Trikker). Les caractères absents deviennent « ? ». */
const CP1252_EXTRA: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};
export function toWindows1252(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  let j = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    out[j++] = c < 0x80 || (c >= 0xa0 && c <= 0xff) ? c : CP1252_EXTRA[c] ?? 0x3f;
  }
  return out.slice(0, j);
}
