/**
 * Vérifications RGIE (Belgique) — installations domestiques basse tension.
 *
 * IMPORTANT : ces règles sont une aide. Elles couvrent les points les plus souvent relevés
 * lors des contrôles et ne remplacent ni le texte officiel du RGIE (Livre 1, 2020)
 * ni l'avis de l'organisme agréé. Chaque règle a un id stable (ex. "R-CABLE-PROT")
 * et ses textes (message + conseil) sont dans les fichiers de traduction.
 *
 * Sévérité :
 *  - installation neuve (nouveau RGIE) : non-conformité = « error » → bloque l'export du dossier ;
 *  - installation existante / ancien RGIE : non-conformité = « warning » (non bloquant) + conseil de mise en conformité.
 */
import type { ElNode, Project } from '../../model/types';
import { DEDICATED_CIRCUIT_APPLIANCES, RCD30_APPLIANCES } from '../../model/schema';
import { circuitContent, isCircuit, isRcd } from '../../model/tree';
import type { Finding, RulePack, Severity } from '../types';
import { calcProject } from '../../calc/electrical';

/**
 * Courant maximal de la protection selon la section (cuivre, pose courante encastrée sous tube).
 * Valeurs prudentes usuelles en Belgique — à adapter si le mode de pose ou la longueur l'exige.
 */
export const MAX_PROTECTION_BY_SECTION: [number, number][] = [
  [1.5, 16],
  [2.5, 20],
  [4, 25],
  [6, 32],
  [10, 50],
  [16, 63],
  [25, 80],
  [35, 100],
  [50, 125],
];

export function maxProtectionFor(section: number): number | undefined {
  let best: number | undefined;
  for (const [s, a] of MAX_PROTECTION_BY_SECTION) if (section >= s) best = a;
  return best;
}

const WET_ROOM = /salle\s*de\s*bain|sdb|douche|badkamer|bathroom|\bbad\b|wellness|sauna|piscine|zwembad/i;
const OVERCURRENT = new Set(['mcb', 'rcbo', 'fuse']);
const LOAD_KINDS = new Set(['socket', 'light', 'appliance', 'motor', 'domotic', 'bell', 'solarPanel', 'inverter']);

interface Info {
  node: ElNode;
  ancestors: ElNode[];
}

function collect(roots: ElNode[]): Info[] {
  const out: Info[] = [];
  const rec = (list: ElNode[], anc: ElNode[]) => {
    for (const n of list) {
      out.push({ node: n, ancestors: anc });
      rec(n.children, [...anc, n]);
    }
  };
  rec(roots, []);
  return out;
}

function text(n: ElNode): string {
  return [n.location, n.props.circuitName, n.props.name].filter(Boolean).join(' ');
}

function n(v: unknown): number | undefined {
  const x = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(x) ? x : undefined;
}

function meta_supply(p: Project): string {
  return String(p.meta.supply ?? '');
}

function checkRgie(project: Project): Finding[] {
  const strict = project.meta.installationKind === 'new' && project.meta.rgieVersion === 'new';
  const nc: Severity = strict ? 'error' : 'warning'; // non-conformité
  const findings: Finding[] = [];
  const add = (ruleId: string, severity: Severity, nodeId?: string, params?: Finding['params']) => findings.push({ ruleId, severity, nodeId, params });

  const infos = collect(project.roots);
  // 3 × 230 V : réseau triphasé sans neutre (fréquent à Bruxelles et dans les anciens réseaux)
  const noNeutral = /3\s*[x×]\s*230/i.test(meta_supply(project));
  const byId = new Map(infos.map((i) => [i.node.id, i]));

  if (project.meta.rgieVersion === 'old') add('R-OLD-RGIE', 'info');

  // --- Mentions obligatoires sur les schémas et plans (RGIE 3.1.2.1) ---
  const meta = project.meta;
  if (!meta.installer?.name?.trim()) add('R-DOC-INSTALLER', nc);
  const site = meta.site ?? {};
  if (!site.street?.trim() || !site.city?.trim()) add('R-DOC-ADDRESS', nc);
  if (!meta.supply?.trim()) add('R-DOC-SUPPLY', nc);

  // --- Terre ---
  if (!infos.some((i) => i.node.kind === 'earth')) add('R-EARTH-MISSING', nc);
  const re = project.measurements.earthResistanceOhm;
  if (re !== undefined) {
    if (re > 100) add('R-EARTH-VALUE', nc, undefined, { value: re });
    else if (re > 30) add('R-EARTH-30', 'warning', undefined, { value: re });
  }
  const iso = project.measurements.insulationMOhm;
  if (iso !== undefined && iso < 0.5) add('R-INSULATION', nc, undefined, { value: iso });
  if (project.measurements.bondingOk === false) add('R-BONDING', nc);
  // Essais des différentiels : déclenchement au courant nominal différentiel en 300 ms maximum
  // (500 ms pour un différentiel sélectif « S »), ou résultat « non conforme » noté par l'installateur.
  for (const [id, test] of Object.entries(project.measurements.rcdTests ?? {})) {
    const node = infos.find((i) => i.node.id === id)?.node;
    if (!node) continue;
    const max = String(node.props.rcdType ?? '').toUpperCase().includes('S') ? 500 : 300;
    if (test.ok === false) add('R-RCD-TEST', nc, id);
    else if (test.tripMs !== undefined && test.tripMs > max) add('R-RCD-TRIP', nc, id, { value: test.tripMs, max });
  }
  if (re === undefined || iso === undefined) add('R-MEAS-MISSING', 'info');

  for (const { node, ancestors } of infos) {
    // --- Protections ---
    if (node.kind === 'protection') {
      if (n(node.props.ratedCurrent) === undefined) add('R-PROT-RATING-MISSING', nc, node.id);
      // Réseau 3 × 230 V (sans neutre distribué) : les deux conducteurs d'un circuit sont des phases,
      // les deux doivent être protégés et coupés → disjoncteur bipolaire (2P), pas 1P+N ni 1P.
      const poles = String(node.props.poles ?? '');
      if (noNeutral && OVERCURRENT.has(String(node.props.device ?? 'mcb')) && (poles === '1P+N' || poles === '1P'))
        add('R-POLES-NO-NEUTRAL', nc, node.id, { poles });
      if (node.props.device !== 'rcd' && node.props.device !== 'switch' && n(node.props.breakingCapacity) === undefined) add('R-PROT-KA-MISSING', 'info', node.id);
      if (isRcd(node)) {
        const rc = n(node.props.residualCurrent);
        if (rc === undefined) add('R-RCD-SENS-MISSING', nc, node.id);
        const upRcd = [...ancestors].reverse().find(isRcd);
        const up = upRcd ? n(upRcd.props.residualCurrent) : undefined;
        if (rc !== undefined && up !== undefined && rc >= up) add('R-RCD-SELECTIVITY', 'warning', node.id, { up, value: rc });
      }
    }

    // --- Canalisations : section ↔ protection ---
    if (node.kind === 'cable') {
      const parent = ancestors.at(-1);
      // Côté continu photovoltaïque : hors périmètre de ces règles AC.
      const dcSide = ancestors.some((a) => a.kind === 'inverter' || a.kind === 'solarPanel');
      // Un câble dans le prolongement d'un autre câble/élément sans données hérite de celui du départ.
      const isStart = !parent || parent.kind === 'protection' || parent.kind === 'board' || parent.kind === 'meter' || parent.kind === 'origin';
      const section = n(node.props.section);
      const prot = [...ancestors].reverse().find((a) => a.kind === 'protection' && OVERCURRENT.has(String(a.props.device)));
      const anyProtection = ancestors.some((a) => a.kind === 'protection');
      const feedsLoads = circuitContent(node).some((c) => LOAD_KINDS.has(c.kind)) || [...node.children].some((c) => LOAD_KINDS.has(c.kind));
      if (section === undefined) {
        if (isStart && !dcSide) add(node.props.cableType || node.props.conductors ? 'R-CABLE-SECTION-MISSING' : 'R-CABLE-DATA-MISSING', nc, node.id);
      } else if (!dcSide) {
        if (section < 1.5) add('R-CABLE-MIN', nc, node.id, { section });
        const rating = prot ? n(prot.props.ratedCurrent) : undefined;
        const max = maxProtectionFor(section);
        if (rating !== undefined && max !== undefined && rating > max) add('R-CABLE-PROT', nc, node.id, { section, rating, max });
      }
      // Les câbles de branchement/alimentation en amont sont protégés par le gestionnaire de réseau.
      if (!prot && anyProtection && feedsLoads && !dcSide) add('R-CABLE-NO-OVERCURRENT', nc, node.id);
    }

    // --- Prises ---
    if (node.kind === 'socket') {
      if (node.props.earth === false) add('R-SOCKET-EARTH', nc, node.id);
      if (node.props.childSafety === false && !node.props.threePhase) add('R-SOCKET-CHILD', nc, node.id);
    }
  }

  // --- Règles par circuit ---
  for (const { node: circuit, ancestors } of infos) {
    if (!isCircuit(circuit)) continue;
    const content = circuitContent(circuit);
    const cables = content.filter((c) => c.kind === 'cable');
    const sockets = content.filter((c) => c.kind === 'socket');
    const loads = content.filter((c) => LOAD_KINDS.has(c.kind));
    const rcds = ancestors.filter(isRcd).concat(isRcd(circuit) ? [circuit] : []);
    const minRcd = Math.min(...rcds.map((r) => n(r.props.residualCurrent) ?? Infinity));
    const label = String(circuit.props.circuitName ?? '');

    if (!label) add('R-CIRCUIT-NAME', 'info', circuit.id);

    if (sockets.length > 8) add('R-SOCKET-MAX', nc, circuit.id, { count: sockets.length });
    if (sockets.length) {
      const minSection = Math.min(...cables.map((c) => n(c.props.section) ?? Infinity));
      if (Number.isFinite(minSection) && minSection < 2.5) add('R-SOCKET-SECTION', nc, circuit.id, { section: minSection });
    }

    // Appareils devant avoir un circuit spécialisé
    const appliances = content.filter((c) => c.kind === 'appliance');
    for (const ap of appliances) {
      const type = String(ap.props.applianceType);
      if (!DEDICATED_CIRCUIT_APPLIANCES.has(type)) continue;
      // L'appareil et la prise qui l'alimente comptent pour un seul point.
      const parent = byId.get(ap.id)?.ancestors.at(-1);
      const others = loads.filter((l) => l !== ap && !(parent && l === parent && parent.kind === 'socket'));
      if (others.length) add('R-DEDICATED-CIRCUIT', nc, ap.id, { appliance: type, others: others.length });
    }

    // Différentiels
    if (!rcds.length || minRcd > 300) add('R-RCD-MAIN', nc, circuit.id);
    const wet = WET_ROOM.test(label) || content.some((c) => WET_ROOM.test(text(c)));
    const wetAppliance = appliances.find((a) => RCD30_APPLIANCES.has(String(a.props.applianceType)));
    if ((wet || wetAppliance) && !(minRcd <= 30)) add('R-RCD30', nc, circuit.id, { reason: wet ? 'wetRoom' : String(wetAppliance!.props.applianceType) });
    if (wetAppliance) {
      const rcd30 = rcds.find((r) => (n(r.props.residualCurrent) ?? Infinity) <= 30);
      if (rcd30 && rcd30.props.rcdType === 'AC') add('R-RCD-TYPE-A', nc, rcd30.id);
    }
  }

  // --- Calculs (longueurs connues) : chute de tension et protection contre les courts-circuits ---
  for (const c of calcProject(project)) {
    if (c.dropPct !== undefined && c.dropPct > c.dropLimit) add('R-VDROP', 'warning', c.circuitId, { value: c.dropPct, max: c.dropLimit, length: c.length ?? 0 });
    if (c.iccMin !== undefined && c.magnetic !== undefined && c.iccMin < c.magnetic)
      add('R-ICC-LMAX', 'warning', c.circuitId, { length: c.length ?? 0, lmax: c.lmax ?? 0, icc: c.iccMin, magnetic: c.magnetic });
  }

  // Une même règle sur un même nœud une seule fois
  const seen = new Set<string>();
  return findings.filter((f) => {
    const k = f.ruleId + '|' + (f.nodeId ?? '');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Référentiel belge : RGIE / AREI, Livre 1 (installations à basse et très basse tension).
 * Les textes des règles (« rule.R-… », « advice.R-… ») sont dans src/i18n, car le RGIE est le référentiel d'origine.
 */
export const belgium: RulePack = {
  id: 'BE-RGIE',
  country: 'BE',
  label: { fr: 'Belgique — RGIE (Livre 1)', nl: 'België — AREI (Boek 1)', en: 'Belgium — RGIE (Book 1)', de: 'Belgien — AREI (Buch 1)' },
  versions: ['new', 'old'],
  check: checkRgie,
  // Désignations belges des câbles (NBN) → équivalent harmonisé CENELEC quand il existe
  equivalents: {
    'cableType.VOB': 'H07V-U / H07V-R',
    'cableType.H07V-U': 'H07V-U',
    'cableType.H07V-K': 'H07V-K',
    'cableType.VFVB': 'H05VV-F',
    'cableType.XVB': '0,6/1 kV (≈ FR U-1000 R2V, DE N2XY)',
    socket: 'NBN C 61-112-1 (type E)',
  },
};
