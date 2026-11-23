/**
 * Export vers Eendraadschema (https://eendraadschema.goethals-jacobs.be, logiciel libre belge, GPL).
 *
 * Format v4 (lu dans le code source d'Eendraadschema, src/importExport/importExport.ts) :
 *  - fichier .eds = « TXT0040000 » suivi du JSON (variante non compressée, acceptée par le chargeur) ;
 *  - JSON = liste hiérarchique : data[] = { id, parent, indent, collapsed, props: { type, … } }, plus
 *    length, active[], id[], curid, properties (propriétaire, installateur, organisme, infos).
 *
 * Correspondance avec Voltaplan :
 *  - origine → « Aansluiting » (avec la première protection rencontrée, souvent le différentiel général) ;
 *  - tableau → « Bord » ; protection d'un circuit → « Kring » (appareil, calibre, courbe, différentiel,
 *    câble du circuit) ; différentiel qui alimente un groupe de circuits → « Kring » différentiel + « Bord »
 *    non mis à la terre (convention d'Eendraadschema) ;
 *  - prises, interrupteurs (va-et-vient regroupés), points lumineux, appareils → leurs types Eendraadschema ;
 *  - l'emplacement (pièce) va dans « adres », affiché sous le symbole.
 * Le plan de position n'est pas exporté (Eendraadschema a son propre « situatieschema »).
 */
import type { ElNode, Project } from '../model/types';
import { computeNumbering } from '../model/tree';

type Props = Record<string, string | boolean>;
interface Item {
  id: number;
  parent: number;
  indent: number;
  collapsed: boolean;
  props: Props;
  sourcelist: null;
}

const BESCHERMING: Record<string, string> = { mcb: 'automatisch', rcd: 'differentieel', rcbo: 'differentieelautomaat', fuse: 'smelt', switch: 'contact' };
const POLEN: Record<string, string> = { '1P': '1', '1P+N': '2', '2P': '2', '3P': '3', '3P+N': '4', '4P': '4' };
const LOCATIE: Record<string, string> = { inWall: 'In wand', onWall: 'Op wand', underground: 'Ondergronds', air: 'Luchtleiding' };
const APPLIANCE: Record<string, string> = {
  oven: 'Elektrische oven',
  cooker: 'Kookfornuis',
  hob: 'Kookfornuis',
  microwave: 'Microgolfoven',
  fridge: 'Koelkast',
  freezer: 'Diepvriezer',
  dishwasher: 'Vaatwasmachine',
  washingMachine: 'Wasmachine',
  dryer: 'Droogkast',
  waterHeater: 'Boiler',
  heatPump: 'Warmtepomp/airco',
  boiler: 'Ketel',
  evCharger: 'EV lader',
  fan: 'Ventilator',
  heater: 'Verwarmingstoestel',
};
const LAMP: Record<string, string> = { standard: 'standaard', led: 'led', fluo: 'TL', spot: 'spot', wall: 'standaard', emergency: 'standaard' };
const SWITCH: Record<string, string> = {
  single: 'enkelpolig',
  double: 'dubbelaansteking',
  twoWay: 'enkelpolig',
  intermediate: 'enkelpolig',
  dimmer: 'dimschakelaar',
  bipolar: 'dubbelpolig',
  shutter: 'rolluikschakelaar',
  pullCord: 'enkelpolig',
};

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v));
const dec = (v: unknown) => str(v).replace('.', ',');

/** Désignation du câble, texte libre dans Eendraadschema : « VOB 3G2,5 ». */
export function cableText(c: ElNode | undefined): string {
  if (!c) return '';
  const p = c.props;
  const spec = p.conductors && p.section ? `${p.conductors}G${dec(p.section)}` : p.section ? `${dec(p.section)} mm²` : '';
  return [p.cableType && p.cableType !== 'other' ? str(p.cableType) : '', spec].filter(Boolean).join(' ');
}

function breakerProps(p: ElNode['props']): Props {
  const device = str(p.device || 'mcb');
  const bescherming = BESCHERMING[device] ?? 'automatisch';
  const rcdType = str(p.rcdType).toUpperCase();
  const withKa = bescherming === 'automatisch' || bescherming === 'differentieel' || bescherming === 'differentieelautomaat';
  return {
    bescherming,
    aantal_polen: POLEN[str(p.poles)] ?? '2',
    amperage: str(p.ratedCurrent),
    curve_automaat: bescherming === 'automatisch' || bescherming === 'differentieelautomaat' ? str(p.curve) : '',
    differentieel_delta_amperage: str(p.residualCurrent || '300'),
    type_differentieel: rcdType === 'A' || rcdType === 'B' ? rcdType : '',
    differentieel_is_selectief: rcdType.includes('S'),
    kortsluitvermogen: withKa ? str(p.breakingCapacity) : '',
    huishoudelijk: true,
    fase: withKa || bescherming === 'smelt' ? str(p.phase) : '',
    normaalGesloten: false,
    newPage: false,
  };
}

function cableProps(c: ElNode | undefined): Props {
  return {
    kabel_is_aanwezig: !!c,
    type_kabel: cableText(c),
    kabel_locatie: c ? (LOCATIE[str(c.props.method)] ?? 'N/A') : 'N/A',
    kabel_is_in_buis: c?.props.inConduit === true,
  };
}

const BASE: Props = { nr: '', autonr: 'auto', autoKringNaam: 'manueel', adres: '' };

export function exportEendraadschema(project: Project, fileName = 'voltaplan.eds'): string {
  const items: Item[] = [];
  let next = 1;
  const num = computeNumbering(project.roots);
  const add = (parent: number, indent: number, props: Props, adres?: string): number => {
    const id = next++;
    items.push({ id, parent, indent, collapsed: false, sourcelist: null, props: { ...BASE, ...props, adres: adres ?? '' } });
    return id;
  };

  /** Points d'un circuit (sous un « Kring » ou un autre point). */
  const loads = (nodes: ElNode[], parent: number, indent: number) => {
    for (const n of nodes) {
      if (n.kind === 'cable') {
        loads(n.children, parent, indent); // câble dans le circuit : son contenu suit
        continue;
      }
      if (n.kind === 'board' || n.kind === 'protection') {
        feed([n], parent, indent, 'kring', undefined);
        continue;
      }
      let kids = n.children;
      let props: Props;
      const p = n.props;
      switch (n.kind) {
        case 'socket':
          props = {
            type: 'Contactdoos',
            is_geaard: p.earth !== false,
            is_kinderveilig: p.childSafety !== false,
            aantal: String(Math.min(6, Math.max(1, Number(p.count) || 1))),
            is_halfwaterdicht: p.splashProof === true,
            is_meerfasig: p.threePhase === true,
            aantal_fases_indien_meerfasig: '3',
            heeft_nul_indien_meerfasig: false,
            heeft_ingebouwde_schakelaar: false,
            in_verdeelbord: false,
          };
          break;
        case 'switch': {
          // Va-et-vient / permutateurs en chaîne → un seul « Schakelaars » avec le nombre d'interrupteurs
          let count = 1;
          let cur = n;
          while (
            (str(cur.props.switchType) === 'twoWay' || str(cur.props.switchType) === 'intermediate') &&
            cur.children.length === 1 &&
            cur.children[0].kind === 'switch' &&
            ['twoWay', 'intermediate'].includes(str(cur.children[0].props.switchType))
          ) {
            cur = cur.children[0];
            count++;
          }
          kids = cur.children;
          props = {
            type: 'Schakelaars',
            type_schakelaar: SWITCH[str(p.switchType || 'single')] ?? 'enkelpolig',
            aantal_schakelaars: String(count),
            heeft_signalisatielampje: p.signalLamp === true,
            is_halfwaterdicht: p.splashProof === true,
            heeft_verklikkerlampje: p.pilotLight === true,
            is_trekschakelaar: str(p.switchType) === 'pullCord',
            normaalGesloten: false,
            sturing: '',
          };
          break;
        }
        case 'pushButton':
          props = { type: 'Drukknop' };
          break;
        case 'relay':
          props = { type: 'Schakelaars', type_schakelaar: str(p.relayType) === 'teleswitch' ? 'teleruptor' : str(p.relayType) === 'timer' ? 'minuterie' : 'relais', aantal_schakelaars: '1' };
          break;
        case 'detector':
          props = { type: 'Schakelaars', type_schakelaar: 'bewegingsschakelaar', aantal_schakelaars: '1' };
          break;
        case 'light':
          props = {
            type: 'Lichtpunt',
            type_lamp: LAMP[str(p.lightType || 'standard')] ?? 'standaard',
            aantal: String(Math.min(20, Math.max(1, Number(p.count) || 1))),
            aantal_buizen_indien_TL: '1',
            type_noodverlichting: str(p.lightType) === 'emergency' ? 'Decentraal' : 'Geen',
            is_wandlamp: str(p.lightType) === 'wall',
            is_halfwaterdicht: p.splashProof === true,
            heeft_ingebouwde_schakelaar: false,
          };
          break;
        case 'appliance': {
          const t = APPLIANCE[str(p.applianceType)];
          props = t ? { type: t } : { type: 'Verbruiker', tekst: str(p.name) || 'Toestel' };
          break;
        }
        case 'junctionBox':
          props = { type: 'Aftakdoos' };
          break;
        case 'transformer':
          props = { type: 'Transformator' };
          break;
        case 'motor':
          props = { type: 'Motor' };
          break;
        case 'bell':
          props = { type: 'Bel' };
          break;
        case 'solarPanel':
          props = { type: 'Zonnepaneel' };
          break;
        case 'inverter':
          props = { type: 'Omvormer' };
          break;
        default:
          props = { type: 'Verbruiker', tekst: str(p.name) || str(p.circuitName) || 'Verbruiker' };
      }
      const id = add(parent, indent, props, n.location);
      // Un symbole n'a qu'un enfant dans Eendraadschema : plusieurs → « Meerdere verbruikers »
      if (kids.length > 1 && props.type !== 'Kring') {
        const m = add(id, indent + 1, { type: 'Meerdere verbruikers' });
        loads(kids, m, indent + 2);
      } else loads(kids, id, indent + 1);
    }
  };

  /** Alimentation et tableaux : origine, compteur, protections, câbles d'alimentation, tableaux. */
  const feed = (nodes: ElNode[], parent: number, indent: number, mode: 'aansluiting' | 'bord' | 'kring', cable: ElNode | undefined, aansluiting?: Item) => {
    for (const n of nodes) {
      switch (n.kind) {
        case 'meter':
          feed(n.children, parent, indent, mode, cable, aansluiting);
          break;
        case 'cable':
          if (n.children.some((c) => c.kind === 'protection' || c.kind === 'board' || c.kind === 'meter')) {
            if (aansluiting && mode === 'aansluiting') aansluiting.props.type_kabel_na_teller = cableText(n);
            feed(n.children, parent, indent, mode, n, aansluiting);
          } else loads([n], parent, indent);
          break;
        case 'earthBar':
        case 'earth':
          break;
        case 'board':
          if (mode === 'bord') feed(n.children, parent, indent, 'bord', undefined);
          else {
            const id = add(parent, indent, { type: 'Bord', naam: str(n.props.name), is_geaard: mode === 'aansluiting' || n.children.some((c) => c.kind === 'earthBar') });
            feed(n.children, id, indent + 1, 'bord', undefined);
          }
          break;
        case 'protection': {
          // Première protection de l'alimentation : portée par l'« Aansluiting »
          if (aansluiting && mode === 'aansluiting' && !aansluiting.props.amperage) {
            Object.assign(aansluiting.props, breakerProps(n.props));
            feed(n.children, parent, indent, mode, cable, aansluiting);
            break;
          }
          const ownCables = n.children.filter((c) => c.kind === 'cable');
          const feedsLoads = ownCables.some((c) => c.children.some((k) => !['protection', 'board', 'meter'].includes(k.kind)));
          const id = add(parent, indent, {
            type: 'Kring',
            naam: num.get(n.id) ?? '',
            tekst: str(n.props.circuitName),
            ...breakerProps(n.props),
            ...cableProps(feedsLoads ? ownCables[0] : cable),
            sturing: '',
          });
          if (feedsLoads) loads(n.children, id, indent + 1);
          else {
            // Différentiel (ou protection) qui alimente un groupe : Kring → Bord non mis à la terre
            const b = add(id, indent + 1, { type: 'Bord', naam: '', is_geaard: false });
            feed(n.children, b, indent + 2, 'bord', undefined);
          }
          break;
        }
        default:
          loads([n], parent, indent);
      }
    }
  };

  for (const root of project.roots) {
    const aId = add(0, 0, {
      type: 'Aansluiting',
      naam: '',
      type_kabel_voor_teller: '',
      type_kabel_na_teller: '',
      amperage: '',
      bescherming: 'geen',
    });
    const a = items.find((i) => i.id === aId)!;
    const before = items.length;
    feed(root.children, aId, 1, 'aansluiting', undefined, a);
    // Eendraadschema attend un tableau sous le raccordement
    if (items.length === before) add(aId, 1, { type: 'Bord', naam: '', is_geaard: true });
  }

  const m = project.meta;
  const addr = (a?: { street?: string; number?: string; box?: string; postalCode?: string; city?: string }) =>
    a ? [[a.street, a.number, a.box ? 'bus ' + a.box : ''].filter(Boolean).join(' '), [a.postalCode, a.city].filter(Boolean).join(' ')].filter(Boolean).join('<br>') : '';
  const doc = {
    length: items.length,
    data: items,
    active: items.map(() => true),
    id: items.map((i) => i.id),
    print_table: {
      enableAutopage: true,
      height: 0,
      maxwidth: 0,
      displaypage: 0,
      pages: [{ height: 0, start: 0, stop: 0 }],
      modevertical: 'alles',
      starty: 0,
      stopy: 0,
      papersize: 'A4',
    },
    properties: {
      filename: fileName,
      owner: [m.client?.name, addr(m.site ?? m.client?.address)].filter(Boolean).join('<br>'),
      installer: [m.installer?.name, m.installer?.vat ? 'BTW ' + m.installer.vat : ''].filter(Boolean).join('<br>'),
      control: m.inspectionBodyName ?? '',
      info: [m.supply, m.earthing ? 'Aarding: ' + m.earthing : '', m.ean ? 'EAN ' + m.ean : ''].filter(Boolean).join('<br>'),
      dpi: 300,
      legacySchakelaars: false,
    },
    curid: next,
    mode: 'edit',
    sitplanjson: { numPages: 1, activePage: 1, defaults: { fontsize: 11, scale: 0.7, rotate: 0 }, elements: [] },
  };
  return 'TXT0040000' + JSON.stringify(doc);
}
