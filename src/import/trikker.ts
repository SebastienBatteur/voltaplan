/**
 * Import des fichiers Trikker (.trik) — format XML, balises en néerlandais.
 * Testé avec Trikker 1.5.17. Les attributs d'origine sont conservés dans `node.source`
 * pour permettre un export Trikker sans perte.
 */
import type { Address, ElNode, NodeKind, PlanPage, Project, Pt, PropValue } from '../model/types';
import { emptyProject, uid } from '../model/tree';

export const TAG_KIND: Record<string, NodeKind> = {
  Teller: 'meter',
  AutomatischeSchakelaar: 'protection',
  Smeltzekering: 'protection',
  Verdeelbord: 'board',
  VerdeelbordGrondplan: 'board',
  Leiding: 'cable',
  Contactdoos: 'socket',
  Schakelaar: 'switch',
  Drukknop: 'pushButton',
  Lichtpunt: 'light',
  Toestel: 'appliance',
  Aardingsstrip: 'earthBar',
  Aarding: 'earth',
  Aftakkast: 'junctionBox',
  Relais: 'relay',
  Transformator: 'transformer',
  DomoticaModule: 'domotic',
  Motor: 'motor',
  Zonnepaneel: 'solarPanel',
  Omvormer: 'inverter',
  Geluidsbron: 'bell',
  Trillingsdetector: 'detector',
  Bewegingsdetector: 'detector',
};

export const APPLIANCES: Record<string, string> = {
  ElektrischeOven: 'oven',
  Kookfornuis: 'cooker',
  Kookplaat: 'hob',
  Microgolfoven: 'microwave',
  Koelkast: 'fridge',
  Diepvriezer: 'freezer',
  Vaatwasmachine: 'dishwasher',
  Wasmachine: 'washingMachine',
  Droogkast: 'dryer',
  Ventilator: 'fan',
  Boiler: 'waterHeater',
  Warmtepomp: 'heatPump',
  Verwarming: 'heater',
  Elektrischeverwarming: 'heater',
  Laadpaal: 'evCharger',
};

export const POLES: Record<string, string> = {
  Eenpolig: '1P',
  Dubbelpolig: '2P',
  Driepolig: '3P',
  Vierpolig: '4P',
};

export const COUNT_WORDS: Record<string, number> = { Een: 1, Twee: 2, Drie: 3, Vier: 4, Vijf: 5, Zes: 6, Zeven: 7, Acht: 8 };

export const METHODS: Record<string, string> = {
  InWand: 'inWall',
  OpWand: 'onWall',
  Ondergronds: 'underground',
  InDeLucht: 'air',
  Evenwijdig: 'parallel',
};

export const LIGHTS: Record<string, string> = { LED: 'led', TL: 'fluo', Spot: 'spot', Geen: 'standard', Noodverlichting: 'emergency' };

function num(v: string | undefined | null): number | undefined {
  if (v == null || v === '') return undefined;
  const n = parseFloat(v.replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function count(v: string | undefined): number | undefined {
  if (!v) return undefined;
  return COUNT_WORDS[v] ?? num(v);
}

const yes = (v: string | undefined) => v === 'Ja';

function attrs(el: Element): Record<string, string> {
  const o: Record<string, string> = {};
  for (const a of Array.from(el.attributes)) o[a.name] = a.value;
  return o;
}

function childEls(el: Element | null | undefined, tag?: string): Element[] {
  if (!el) return [];
  return Array.from(el.children).filter((c) => !tag || c.tagName === tag);
}

function child(el: Element | null | undefined, tag: string): Element | undefined {
  return childEls(el, tag)[0];
}

function text(el: Element | null | undefined, tag: string): string | undefined {
  const c = child(el, tag);
  const t = c?.textContent?.trim();
  return t || undefined;
}

function pt(el: Element | undefined): Pt {
  return { x: num(el?.getAttribute('X')) ?? 0, y: num(el?.getAttribute('Y')) ?? 0 };
}

function clean(o: Record<string, PropValue>): Record<string, PropValue> {
  for (const k of Object.keys(o)) if (o[k] === undefined || o[k] === '') delete o[k];
  return o;
}

function mapProps(tag: string, a: Record<string, string>): Record<string, PropValue> {
  switch (tag) {
    case 'AutomatischeSchakelaar':
    case 'Smeltzekering': {
      const residual = num(a.VerliesStroomsterkte);
      const curve = a.Uitschakelcurve || undefined;
      const device = tag === 'Smeltzekering' ? 'fuse' : residual ? (curve ? 'rcbo' : 'rcd') : 'mcb';
      return clean({
        device,
        circuitName: a.NaamKring?.trim(),
        fixedLetter: a.VasteLetter?.trim(),
        ratedCurrent: num(a.NominaleStroomsterkte),
        poles: POLES[a.AantalPolen] ?? (a.AantalPolen ? a.AantalPolen : '1P+N'),
        curve,
        breakingCapacity: num(a.Kortsluitstroom),
        residualCurrent: residual,
        phase: a.Fase || undefined,
      });
    }
    case 'Verdeelbord':
    case 'VerdeelbordGrondplan':
      return clean({ name: a.NaamKring?.trim(), fixedLetter: a.VasteLetter?.trim(), number: a.Nummer });
    case 'Teller':
      return clean({ name: a.NaamKring?.trim() });
    case 'Leiding':
      return clean({
        cableType: a.GeleiderType,
        section: num(a.GeleiderDoorsnede),
        conductors: num(a.AantalGeleiders),
        inConduit: a.InBuis ? yes(a.InBuis) : undefined,
        method: METHODS[a.Plaatsing] ?? a.Plaatsing,
        circuitName: a.NaamKring?.trim(),
      });
    case 'Contactdoos':
      return clean({
        count: count(a.Aantal) ?? 1,
        earth: a.Beschermingsgeleider !== 'Nee',
        childSafety: a.Kinderbescherming !== 'Nee',
        splashProof: yes(a.HalfWaterdicht),
        threePhase: a.AantalFasen === '3' || a.AantalFasen === 'Drie',
      });
    case 'Schakelaar': {
      let switchType = 'single';
      if (a.Type === 'Wissel') switchType = 'twoWay';
      else if (a.Type === 'Kruis') switchType = 'intermediate';
      else if (a.Type === 'Dubbel') switchType = 'double';
      else if (yes(a.Dimmer)) switchType = 'dimmer';
      else if (yes(a.Rolluikschakelaar)) switchType = 'shutter';
      else if (yes(a.Trekschakelaar)) switchType = 'pullCord';
      else if (a.AantalPolen === 'Dubbelpolig') switchType = 'bipolar';
      return clean({
        switchType,
        pilotLight: yes(a.Verklikkerlamp),
        signalLamp: yes(a.Signalisatielamp),
        splashProof: yes(a.HalfWaterdicht),
      });
    }
    case 'Lichtpunt':
      return clean({
        lightType: yes(a.Wandverlichting) ? 'wall' : LIGHTS[a.Type] ?? 'standard',
        count: num(a.AantalBuislampen) ?? 1,
        splashProof: yes(a.HalfWaterdicht),
      });
    case 'Toestel':
      return clean({ applianceType: APPLIANCES[a.Type] ?? 'other', name: APPLIANCES[a.Type] ? undefined : a.Type });
    case 'Transformator':
      return clean({ safety: yes(a.Veiligheidstransformator) });
    case 'DomoticaModule':
      return clean({ name: a.NaamModule });
    case 'Zonnepaneel':
      return clean({ count: count(a.Aantal), name: a.NaamKring?.trim() });
    case 'Relais':
      return { relayType: 'relay' };
    case 'Trillingsdetector':
      return { detectorType: 'vibration' };
    case 'Bewegingsdetector':
      return { detectorType: 'motion' };
    default:
      return clean({ name: TAG_KIND[tag] ? undefined : tag });
  }
}

function noteText(n: Element): string | undefined {
  return n.getAttribute('Tekst')?.replace(/\r\n|\r/g, '\n').trim() || undefined;
}

interface Ctx {
  /** Ids Trikker des notes repliées dans la localisation de leur parent. */
  foldedNotes: Set<string>;
  warnings: string[];
}

function convert(el: Element, ctx: Ctx): ElNode | null {
  const tag = el.tagName;
  const a = attrs(el);
  const kind: NodeKind = TAG_KIND[tag] ?? 'other';
  const node: ElNode = {
    id: a.Id || uid(),
    kind,
    props: mapProps(tag, a),
    children: [],
    source: { format: 'trikker', tag, attrs: a },
  };
  if (!TAG_KIND[tag]) ctx.warnings.push(`Élément Trikker non reconnu importé comme « autre » : ${tag}`);

  const notes: string[] = [];
  const collectNote = (n: Element) => {
    const t = noteText(n);
    if (t) notes.push(t);
    const id = n.getAttribute('Id');
    if (id) ctx.foldedNotes.add(id);
  };
  for (const c of childEls(child(el, 'Children'))) {
    if (c.tagName === 'Nota') {
      collectNote(c);
      continue;
    }
    const sub = convert(c, ctx);
    if (sub) node.children.push(sub);
  }
  for (const n of childEls(child(el, 'Satellites'), 'Nota')) collectNote(n);
  if (notes.length) node.location = notes.join(' / ');
  return node;
}

function address(el: Element | undefined): Address {
  return {
    street: text(el, 'Straat'),
    number: text(el, 'Nummer'),
    box: text(el, 'Bus'),
    postalCode: text(el, 'Postcode'),
    city: text(el, 'Gemeente'),
    country: text(el, 'Land'),
  };
}

export interface TrikkerImportResult {
  project: Project;
  warnings: string[];
}

/**
 * Trikker n'écrit jamais de DTD. Une déclaration <!DOCTYPE> ou <!ENTITY> ne peut venir que d'un fichier
 * fabriqué : refusée avant l'analyse (entités externes, « milliard de rires » / expansion d'entités).
 */
export function hasDtd(xml: string): boolean {
  return /<!\s*(DOCTYPE|ENTITY)/i.test(xml);
}

/** Données base64 d'une image Trikker (espaces et retours à la ligne tolérés). */
function cleanBase64(b64: string): string | null {
  const s = b64.replace(/\s+/g, '');
  return s.length > 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(s) ? s : null;
}

export function importTrikker(xml: string, fileName = 'Projet Trikker'): TrikkerImportResult {
  if (hasDtd(xml)) throw new Error("Ce fichier n'est pas un fichier Trikker valide (déclaration DOCTYPE/ENTITY refusée).");
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const root = doc.documentElement;
  if (!root || root.tagName !== 'Document' || doc.getElementsByTagName('parsererror').length) {
    throw new Error("Ce fichier n'est pas un fichier Trikker valide.");
  }
  const ctx: Ctx = { foldedNotes: new Set(), warnings: [] };
  const project = emptyProject();
  project.roots = [];
  project.loose = [];
  const roomNotes = new Map<string, string>(); // id → texte (notes libres = noms de pièces)

  for (const start of childEls(child(root, 'RootNodes'), 'StartNode')) {
    for (const c of childEls(child(start, 'Children'))) {
      if (c.tagName === 'Nota') {
        const t = noteText(c);
        if (t) roomNotes.set(c.getAttribute('Id') ?? uid(), t);
        continue;
      }
      const n = convert(c, ctx);
      if (!n) continue;
      if (c.tagName === 'VerdeelbordGrondplan' || n.children.length === 0) project.loose.push(n);
      else {
        const origin: ElNode = { id: start.getAttribute('Id') || uid(), kind: 'origin', props: {}, children: [n] };
        project.roots.push(origin);
      }
    }
  }
  // Plusieurs départs dans un même StartNode : on les regroupe sous une seule origine.
  if (project.roots.length > 1) {
    const merged: ElNode = { ...project.roots[0], children: project.roots.flatMap((r) => r.children) };
    project.roots = [merged];
  }

  // Métadonnées
  const klant = child(root, 'Klant');
  const inst = child(root, 'Installateur');
  project.meta = {
    ...project.meta,
    title: fileName.replace(/\.trik$/i, ''),
    supply: root.getAttribute('Stroomtype') ?? project.meta.supply,
    date: (root.getAttribute('Datum') ?? '').slice(0, 10) || project.meta.date,
    client: { name: text(klant, 'Naam'), email: text(klant, 'Email'), address: address(child(klant, 'Adres')) },
    site: address(child(klant, 'Werfadres')),
    installer: { name: text(inst, 'Naam'), address: address(child(inst, 'Adres')) },
    inspectionBody: text(child(root, 'Controleorganisme'), 'Naam'),
    drawnBy: child(root, 'Gebruiker')?.getAttribute('Naam') ?? undefined,
  };
  if (project.meta.client.email && !project.meta.client.email.includes('@')) project.meta.client.email = undefined;

  // Plan
  const gp = child(root, 'Grondplan');
  project.plan = { pages: [], width: num(text(gp, 'Breedte')) ?? 20000, height: num(text(gp, 'Hoogte')) ?? 15000 };
  childEls(child(gp, 'Pages'), 'GrondplanPage').forEach((pg, i) => {
    const page: PlanPage = { id: pg.getAttribute('Id') || uid(), name: `Plan ${i + 1}`, walls: [], openings: [], rects: [], images: [], symbols: [], labels: [] };
    for (const e of childEls(child(pg, 'GrondplanElementen'))) {
      const width = num(e.getAttribute('Breedte'));
      const a = pt(child(e, 'P1'));
      const b = pt(child(e, 'P2'));
      switch (e.tagName) {
        case 'Muur':
          page.walls.push({ a, b, thickness: width ?? 150 });
          break;
        case 'Deur':
          // Trikker : charnière au point de départ (P1) ; « LinksDraaiend » ouvre du côté gauche du segment,
          // « Gespiegeld » (miroir par rapport au mur) ouvre de l'autre côté. Vérifié sur des plans réels :
          // sans cette inversion, une porte « gespiegeld » du plan de référence s'ouvrait dans un mur.
          {
            const links = e.getAttribute('Type') === 'LinksDraaiend';
            const mirrored = e.getAttribute('Gespiegeld') === 'Ja';
            page.openings.push({ kind: 'door', a, b, width, hinge: links !== mirrored ? 'left' : 'right' });
          }
          break;
        case 'Raam':
          page.openings.push({ kind: 'window', a, b, width });
          break;
        case 'Garagepoort':
          page.openings.push({ kind: 'garageDoor', a, b, width, mirrored: e.getAttribute('Gespiegeld') === 'Ja' });
          break;
        case 'Trap':
          page.openings.push({ kind: 'stairs', a, b, width });
          break;
        case 'Rechthoek':
          page.rects.push({ center: pt(child(e, 'Center')), w: width ?? 0, h: num(e.getAttribute('Hoogte')) ?? 0, angle: num(e.getAttribute('Hoek')) ?? 0 });
          break;
        case 'Figuur': {
          const raw = e.getAttribute('ImageAsBase64');
          const b64 = raw ? cleanBase64(raw) : null;
          if (raw && !b64) ctx.warnings.push('Image de plan illisible ignorée.');
          if (b64)
            page.images.push({
              center: pt(child(e, 'Center')),
              w: width ?? 0,
              h: num(e.getAttribute('Hoogte')) ?? 0,
              angle: num(e.getAttribute('Hoek')) ?? 0,
              href: 'data:image/png;base64,' + b64,
            });
          break;
        }
        default:
          ctx.warnings.push(`Élément de plan non reconnu ignoré : ${e.tagName}`);
      }
    }
    for (const gn of childEls(child(pg, 'GrondplanNodes'), 'GrondplanNode')) {
      const id = text(gn, 'NodeId');
      if (!id) continue;
      const pos = pt(child(gn, 'Position'));
      const rotation = ((num(text(gn, 'Rotation')) ?? 0) * 180) / Math.PI;
      if (roomNotes.has(id)) page.labels.push({ id, text: roomNotes.get(id)!, pos, size: 3 });
      else if (ctx.foldedNotes.has(id)) continue;
      else page.symbols.push({ nodeId: id, pos, rotation: Math.round(rotation * 100) / 100, labelSide: text(gn, 'TekstPlaatsing') });
    }
    project.plan.pages.push(page);
  });
  if (!project.plan.pages.length) project.plan.pages.push(emptyProject().plan.pages[0]);

  // Trikker ne sait pas si l'installation est neuve : on part sur « neuve » (règles les plus strictes),
  // l'utilisateur peut changer dans les infos du projet.
  return { project, warnings: Array.from(new Set(ctx.warnings)) };
}
