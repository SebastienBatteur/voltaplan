/**
 * Vérifications RGIE (Belgique) — installations domestiques basse tension.
 *
 * IMPORTANT : ces règles sont une aide. Elles couvrent les points les plus souvent relevés
 * lors des contrôles et ne remplacent ni le texte officiel du RGIE (Livre 1)
 * ni l'avis de l'organisme agréé. Chaque règle a un id stable (ex. "R-CABLE-PROT"), une fiche de traçabilité
 * (src/rules/be/catalog.ts) et ses textes (message + conseil) dans les fichiers de traduction.
 *
 * Les règles relèvent des constats bruts ; leur statut (non conforme, recommandation, dérogation…), leur caractère
 * bloquant et leur sévérité affichée sont décidés ensuite selon la partie d'installation concernée
 * (édition applicable, neuve ou existante) : voir src/rules/context.ts.
 *
 * Inconnu ≠ absent (ADR-0007, src/rules/knowledge.ts) : une règle qui porte sur la présence d'un équipement
 * (terre, différentiels) ou sur une valeur (sensibilité, section, calibre) précise l'état de connaissance du fait
 * (`knowledge`). En conception (partie neuve), le dessin est la référence ; en relevé (partie existante), ce qui
 * n'est pas dessiné est inconnu tant que l'utilisateur n'a pas confirmé son absence (meta.survey).
 */
import type { ElNode, Project } from '../../model/types';
import { DEDICATED_CIRCUIT_APPLIANCES, RCD30_APPLIANCES } from '../../model/schema';
import { circuitContent, isCircuit, isRcd } from '../../model/tree';
import type { Finding, FindingStatus, Knowledge, RulePack, Severity, SurveyFact } from '../types';
import { classify, normDate, partContext, projectContext } from '../context';
import { presence, surveyStatement } from '../knowledge';
import { BE_EDITIONS, BE_RULES } from './catalog';
import { calcProject, roundTo } from '../../calc/electrical';

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

/** Noms de pièces évoquant un local avec baignoire ou douche : simple indice, à confirmer (propriété wetRoom). */
export const WET_ROOM = /salle\s*de\s*bain|sdb|douche|badkamer|bathroom|\bbad\b|wellness|sauna|piscine|zwembad/i;
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

/** Constat brut, avant classement (le 2e paramètre des appels `add` est l'ancienne sévérité, ignorée). */
type Raw = Omit<Finding, 'severity'>;
type Extra = { status?: FindingStatus; inferred?: boolean; knowledge?: Knowledge; fact?: SurveyFact };

function checkRgie(project: Project): Finding[] {
  const nc: Severity = 'error'; // non-conformité (statut final décidé par classify selon la partie)
  const raws: Raw[] = [];
  const add = (ruleId: string, _hint: Severity, nodeId?: string, params?: Finding['params'], extra?: Extra) => raws.push({ ruleId, nodeId, params, ...extra });
  /** Constat de présence d'un équipement (ADR-0007) : absent/inconnu/contradictoire ; rien si présent. */
  const addPresence = (ruleId: string, k: Knowledge, fact: SurveyFact, nodeId?: string, params?: Finding['params']) => {
    if (k === 'present') return;
    add(ruleId, nc, nodeId, params, { knowledge: k, fact });
  };

  const infos = collect(project.roots);
  // Faits déclarés présents sans être dessinés : schéma incomplet (exigence documentaire), une fois par fait.
  const notDrawn = new Set<SurveyFact>();
  // 3 × 230 V : réseau triphasé sans neutre (fréquent à Bruxelles et dans les anciens réseaux)
  const noNeutral = /3\s*[x×]\s*230/i.test(meta_supply(project));
  const byId = new Map(infos.map((i) => [i.node.id, i]));

  const projCtx = projectContext(project, belgium);
  if (!projCtx.current) add('R-OLD-RGIE', 'info');
  const instDate = normDate(project.meta.installationDate);
  if (instDate && instDate < '2020-06-01' && project.meta.installationKind === 'new') add('R-INSTALL-DATE', 'info', undefined, { date: String(project.meta.installationDate) });

  // --- Mentions obligatoires sur les schémas et plans (RGIE 3.1.2.1) ---
  const meta = project.meta;
  if (!meta.installer?.name?.trim()) add('R-DOC-INSTALLER', nc);
  const site = meta.site ?? {};
  if (!site.street?.trim() || !site.city?.trim()) add('R-DOC-ADDRESS', nc);
  if (!meta.supply?.trim()) add('R-DOC-SUPPLY', nc);
  // RGIE 3.1.2 : « numéro, version et date de la version » ; 3.1.2.1 : « nom, qualité » du responsable
  if (!meta.docNumber?.trim()) add('R-DOC-NUMBER', nc);
  if (meta.installer?.name?.trim() && !meta.installer.quality?.trim()) add('R-DOC-QUALITY', nc);

  // --- Terre ---
  // Installation neuve (conception) : terre non dessinée = absente du projet → non-conformité.
  // Installation existante (relevé) : non dessinée = inconnue, sauf absence confirmée (meta.survey.earth).
  const earthDrawn = infos.some((i) => i.node.kind === 'earth');
  const earthStated = surveyStatement(project, 'earth');
  addPresence('R-EARTH-MISSING', presence(earthDrawn, earthStated, projCtx.isNew), 'earth');
  if (!earthDrawn && earthStated === 'present') notDrawn.add('earth');
  const re = project.measurements.earthResistanceOhm;
  if (re !== undefined) {
    if (re > 100) add('R-EARTH-VALUE', nc, undefined, { value: re });
    else if (re > 30) add('R-EARTH-30', 'warning', undefined, { value: re });
  }
  const iso = project.measurements.insulationMOhm;
  if (iso !== undefined && iso < 0.5) add('R-INSULATION', nc, undefined, { value: iso });
  // Liaisons équipotentielles : « non » saisi = violation constatée ; non saisi = vérification sur place nécessaire.
  if (project.measurements.bondingOk === false) add('R-BONDING', nc);
  else if (project.measurements.bondingOk === undefined) add('R-BONDING', nc, undefined, undefined, { knowledge: 'measureNeeded' });
  // Essais des différentiels : déclenchement au courant nominal différentiel en 300 ms maximum
  // (500 ms pour un différentiel sélectif « S »), ou résultat « non conforme » noté par l'installateur.
  for (const [id, test] of Object.entries(project.measurements.rcdTests ?? {})) {
    const node = infos.find((i) => i.node.id === id)?.node;
    if (!node) continue;
    const max = String(node.props.rcdType ?? '').toUpperCase().includes('S') ? 500 : 300;
    if (test.ok === false) add('R-RCD-TEST', nc, id);
    else if (test.tripMs !== undefined && test.tripMs > max) add('R-RCD-TRIP', nc, id, { value: test.tripMs, max });
  }
  // Différentiel dessiné sans essai noté : l'essai reste à faire (vérification, jamais bloquant).
  const tests = project.measurements.rcdTests ?? {};
  for (const { node } of infos) if (isRcd(node) && !tests[node.id]) add('R-RCD-TEST', nc, node.id, undefined, { knowledge: 'measureNeeded' });
  if (re === undefined || iso === undefined) add('R-MEAS-MISSING', 'info', undefined, undefined, { knowledge: 'measureNeeded' });

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
      // Relevé (partie existante) : section ou calibre inconnus → la coordination section / protection est à vérifier
      // sur place (le schéma incomplet est signalé à part, R-CABLE-*-MISSING / R-PROT-RATING-MISSING). En conception,
      // la valeur manquante est une lacune du projet, déjà signalée et bloquante : pas de second constat.
      if (isStart && !dcSide && prot && feedsLoads && (section === undefined || n(prot.props.ratedCurrent) === undefined)) {
        if (!partContext(project, belgium, [...ancestors, node]).isNew) add('R-CABLE-PROT', nc, node.id, undefined, { knowledge: 'unknown' });
      }
      // Les câbles de branchement/alimentation en amont sont protégés par le gestionnaire de réseau.
      // Une protection amont de nature inconnue (appareil non renseigné) : la protection est inconnue, pas absente.
      if (!prot && anyProtection && feedsLoads && !dcSide) {
        const unknownDevice = ancestors.some((a) => a.kind === 'protection' && (a.props.device === undefined || a.props.device === ''));
        add('R-CABLE-NO-OVERCURRENT', nc, node.id, undefined, unknownDevice ? { knowledge: 'unknown' } : undefined);
      }
    }

    // --- Installations particulières : points à vérifier à la main (non automatisés) ---
    if (node.kind === 'appliance' && node.props.applianceType === 'evCharger') add('R-EV-MANUAL', 'info', node.id);

    // --- Prises ---
    if (node.kind === 'socket') {
      // Valeur non renseignée = symbole par défaut (prise avec terre et sécurité enfant) : présent dans le dessin.
      // « false » = absence déclarée (saisie, ou reprise par l'assistant : « déduite » tant que non confirmée).
      if (node.props.earth === false) add('R-SOCKET-EARTH', nc, node.id, undefined, { knowledge: 'absent' });
      if (node.props.childSafety === false && !node.props.threePhase) add('R-SOCKET-CHILD', nc, node.id, undefined, { knowledge: 'absent' });
    }
  }

  // --- Règles par circuit ---
  const rcd300Drawn = infos.some((i) => isRcd(i.node) && (n(i.node.props.residualCurrent) ?? Infinity) <= 300);
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

    // Différentiels (ADR-0007). Sensibilité inconnue d'un différentiel dessiné : valeur inconnue (pas une violation).
    // Aucun différentiel adéquat dessiné : conception → absent ; relevé → inconnu, sauf déclaration (meta.survey).
    const design = partContext(project, belgium, [...ancestors, circuit]).isNew;
    const unknownSens = rcds.some((r) => n(r.props.residualCurrent) === undefined);
    if (!(minRcd <= 300)) {
      if (unknownSens) add('R-RCD-MAIN', nc, circuit.id, undefined, { knowledge: 'unknown' });
      else {
        const stated = surveyStatement(project, 'rcd');
        const k = stated === 'absent' && rcd300Drawn ? 'contradictory' : presence(false, stated, design);
        if (k === 'present') notDrawn.add('rcd');
        addPresence('R-RCD-MAIN', k, 'rcd', circuit.id);
      }
    }
    // Local avec baignoire ou douche : indiqué explicitement (propriété wetRoom) ; un nom de pièce évocateur
    // n'est qu'un indice (information déduite → anomalie potentielle) tant que la propriété n'est pas renseignée.
    const nodes = [circuit, ...content];
    const wet = nodes.some((c) => c.props.wetRoom === 'yes');
    const wetByName = !wet && nodes.some((c) => c.props.wetRoom !== 'no' && WET_ROOM.test(c === circuit ? label + ' ' + text(c) : text(c)));
    const wetAppliance = appliances.find((a) => RCD30_APPLIANCES.has(String(a.props.applianceType)));
    const rcd30Stated = surveyStatement(project, 'rcd30');
    if ((wet || wetAppliance) && !(minRcd <= 30)) {
      const reason = wet ? 'wetRoom' : String(wetAppliance!.props.applianceType);
      if (unknownSens) add('R-RCD30', nc, circuit.id, { reason }, { knowledge: 'unknown' });
      else {
        const k = presence(false, rcd30Stated, design);
        if (k === 'present') notDrawn.add('rcd30');
        addPresence('R-RCD30', k, 'rcd30', circuit.id, { reason });
      }
    } else if (wetByName && !(minRcd <= 30) && rcd30Stated !== 'present') add('R-WETROOM-NAME', 'info', circuit.id, undefined, { knowledge: 'deduced' });
    if (wetAppliance) {
      const rcd30 = rcds.find((r) => (n(r.props.residualCurrent) ?? Infinity) <= 30);
      if (rcd30 && rcd30.props.rcdType === 'AC') add('R-RCD-TYPE-A', nc, rcd30.id);
    }
  }

  const pv = infos.find((i) => i.node.kind === 'inverter' || i.node.kind === 'solarPanel');
  if (pv) add('R-PV-MANUAL', 'info', pv.node.id);

  // Équipements confirmés présents mais non dessinés : le schéma est incomplet (exigence documentaire).
  for (const fact of notDrawn) add('R-DOC-NOT-DRAWN', nc, undefined, { fact }, { fact });

  // --- Calculs (longueurs connues) : chute de tension et protection contre les courts-circuits ---
  // Comparaisons sur les valeurs brutes ; arrondi seulement pour le message.
  // Chute : totale depuis l'origine si l'amont est connu, détaillée si toutes les puissances sont connues
  // (voir src/calc/electrical.ts) ; un dépassement au calibre non confirmé par le détail reste signalé (info).
  for (const c of calcProject(project)) {
    const len = roundTo(c.length, 1) ?? 0;
    if (c.checkDropPct !== undefined && c.checkDropPct > c.dropLimit)
      add('R-VDROP', 'warning', c.circuitId, { value: roundTo(c.checkDropPct, 2)!, max: c.dropLimit, length: len });
    else if (c.method === 'detailed') {
      const conservative = c.totalDropPct ?? c.dropPct;
      if (conservative !== undefined && conservative > c.dropLimit)
        add('R-VDROP-RATING', 'info', c.circuitId, { value: roundTo(conservative, 2)!, detailed: roundTo(c.checkDropPct, 2) ?? 0, max: c.dropLimit });
    }
    if (c.iccMin !== undefined && c.magnetic !== undefined && c.iccMin < c.magnetic)
      add('R-ICC-LMAX', 'warning', c.circuitId, { length: len, lmax: roundTo(c.lmax, 1) ?? 0, icc: Math.round(c.iccMin), magnetic: c.magnetic });
  }

  // Une même règle sur un même nœud une seule fois, puis classement selon la partie concernée
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const raw of raws) {
    const k = raw.ruleId + '|' + (raw.nodeId ?? '') + '|' + (raw.fact ?? '');
    if (seen.has(k)) continue;
    seen.add(k);
    const info = raw.nodeId ? byId.get(raw.nodeId) : undefined;
    const ctx = info ? partContext(project, belgium, [...info.ancestors, info.node]) : projCtx;
    out.push(classify(raw, BE_RULES[raw.ruleId], ctx, project.meta.derogations));
  }
  return out;
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
  editions: BE_EDITIONS,
  rules: BE_RULES,
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
