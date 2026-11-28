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
import { DEDICATED_CIRCUIT_APPLIANCES, DEDICATED_IF_POWERFUL, RCD30_APPLIANCES } from '../../model/schema';
import { circuitContent, isCircuit, isRcd } from '../../model/tree';
import type { Finding, FindingStatus, Knowledge, RulePack, Severity, SurveyFact } from '../types';
import { classify, normDate, onOrAfter, partContext, projectContext } from '../context';
import { presence, surveyStatement } from '../knowledge';
import { BE_EDITIONS, BE_RULES } from './catalog';
import { calcProject, roundTo } from '../../calc/electrical';
import { derogationsFor, DEROGATIONS } from '../../regulations/be/derogations';
import {
  CIRCUITS_PER_RCD30_MAX,
  DATES,
  DEDICATED_POWER,
  EARTH_EXTRA_MEASURES_ABOVE,
  EARTH_MAX,
  INSULATION_MIN,
  RCD_HEAD_MIN_RATING,
  RCD_HIGH_SENSITIVITY,
  RCD_ORIGIN_MAX_SENSITIVITY,
  RCD_TRIP_MAX,
  SECTION_MIN_GENERAL,
  SECTION_MIN_NO_SOCKET,
  SOCKETS_PER_CIRCUIT_MAX,
  EARTH_EXTRA_RCD_MAX,
  EARTH_EXTRA_SOCKETS_PER_RCD,
  PV_7112_MAX,
  TABLE_4_11 as TABLE_4_11_PARAM,
} from '../../regulations/be/values';

/**
 * Calibre maximal de la protection selon la section du conducteur, pour les installations domestiques :
 * RGIE Livre 1, sous-section 4.4.1.4, tableau 4.11 (version 07, 15/09/2026, p. 116-117). Deux colonnes : coupe-circuit
 * à fusible et disjoncteur. Ce sont des maxima : le courant admissible IZ (mode de pose, groupement, température)
 * peut imposer moins (4.4.1.4) ; Voltaplan ne le calcule pas.
 * [section mm², fusible A, disjoncteur A]
 */
export const TABLE_4_11 = TABLE_4_11_PARAM.value;

/**
 * Calibre maximal (tableau 4.11) pour une section et un type de protection (`fuse` : colonne des fusibles ; sinon
 * disjoncteur, disjoncteur différentiel compris). Section intermédiaire : ligne inférieure (prudent). Au-delà de
 * 35 mm² le tableau ne dit rien : pas de maximum (undefined).
 */
export function maxProtectionFor(section: number, device: string = 'mcb'): number | undefined {
  if (section > TABLE_4_11[TABLE_4_11.length - 1][0]) return undefined;
  let best: number | undefined;
  for (const [s, fuse, mcb] of TABLE_4_11) if (section >= s) best = device === 'fuse' ? fuse : mcb;
  return best;
}

/** Noms de pièces évoquant un local avec baignoire ou douche : simple indice, à confirmer (propriété wetRoom). */
export const WET_ROOM = /salle\s*de\s*bain|salle\s*d['’]eau|sdb|douche|badkamer|bathroom|shower|\bbad\b|badezimmer|dusche|wellness|sauna|piscine|zwembad/i;
const OVERCURRENT = new Set(['mcb', 'rcbo', 'fuse']);
const LOAD_KINDS = new Set(['socket', 'light', 'appliance', 'motor', 'domotic', 'bell', 'solarPanel', 'inverter', 'battery']);

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

/** Date d'entrée en vigueur des modifications du Livre 1 (prises et éclairage sous 30 mA, 8 circuits par 30 mA). */
export const RCD30_2023 = DATES.value.rcd30Extended;

/**
 * RGIE 4.2.4.3 b, 5e et 6e alinéas (modifications du 1/6/2023) applicables à cette partie : exécution commencée le
 * 1/6/2023 ou après. Du plus proche au plus lointain : réponse « tableau fait ou refait avant / après le 1/6/2023 »
 * (`rgie2023` du tableau) ou date de la partie (`installedOn`), puis date du projet. Sans rien : installation neuve
 * → oui ; existante → inconnu (une question est posée sur le tableau, constat R-RCD30-DATE).
 */
function since2023(project: Project, chain: ElNode[]): 'yes' | 'no' | 'unknown' {
  return sinceDate(project, chain, RCD30_2023);
}

/** Modifications du Livre 1 applicables à partir du 1/3/2025 (AR du 3/10/2024 : prises, salles de bain, piscines). */
export const RGIE_2025 = DATES.value.rgie2025;

/**
 * Règles d'une version du Livre 1 applicables à cette partie : exécution sur place commencée à la date `date` ou
 * après (dispositions transitoires de chaque version). Même ordre de recherche que pour le 1/6/2023 ; la réponse
 * « tableau fait avant / après le 1/6/2023 » ne tranche que ce qu'elle permet de déduire (avant 2023 ⇒ avant 2025).
 */
function sinceDate(project: Project, chain: ElNode[], date: string): 'yes' | 'no' | 'unknown' {
  // Du plus proche au plus lointain : date de la partie, réponse « tableau fait avant / après le 1/6/2023 », puis date
  // du projet. Une date partielle à cheval sur la limite reste « inconnu ». La réponse du tableau passe avant toute
  // édition supposée (elle était ignorée quand le projet portait l'ancien modèle « old »).
  for (const x of [...chain].reverse()) {
    if (x.props.oldPart === true) return 'no';
    const v = onOrAfter(x.props.installedOn, date);
    if (v) return v;
    if (x.props.rgie2023 === 'before' && date >= RCD30_2023) return 'no';
    if (x.props.rgie2023 === 'after' && date <= RCD30_2023) return 'yes';
  }
  const v = onOrAfter(project.meta.installationDate, date);
  if (v) return v;
  const ctx = partContext(project, belgium, chain);
  // Sans date : l'ancien modèle « ancien RGIE » (rgieVersion « old ») n'est qu'une hypothèse → inconnu, pas une dérogation.
  if (project.meta.rgieVersion === 'old') return 'unknown';
  if (!ctx.current) return 'no';
  return ctx.isNew ? 'yes' : 'unknown';
}

/** Tableau le plus proche dans la chaîne (celui à qui demander s'il a été fait ou refait avant ou après le 1/6/2023). */
const boardOf = (chain: ElNode[]) => [...chain].reverse().find((x) => x.kind === 'board');

/** Appareils d'un chauffage électrique à poste fixe : un ou plusieurs circuits dédiés (RGIE 5.2.1.2). */
const FIXED_HEATING = new Set(['heater', 'storageHeater', 'storageHeaterFan']);
/** Seuil de puissance d'un appareil à poste fixe qui impose un circuit dédié (RGIE 5.2.1.2). */
export const DEDICATED_POWER_W = DEDICATED_POWER.value;

/**
 * Circuit dédié exigé ? `yes` : liste nommée du RGIE (5.2.1.2 ; borne de recharge 7.22.3) ou puissance ≥ 2 600 W ;
 * `ifPowerKnown` : autre appareil fixe de puissance inconnue (à vérifier) ; `no` : puissance connue < 2 600 W.
 */
function dedicatedNeed(ap: ElNode): 'yes' | 'ifPowerKnown' | 'no' {
  const type = String(ap.props.applianceType);
  if (DEDICATED_CIRCUIT_APPLIANCES.has(type) || FIXED_HEATING.has(type)) return 'yes';
  const w = n(ap.props.power);
  if (w === undefined) return DEDICATED_IF_POWERFUL.has(type) ? 'ifPowerKnown' : 'no';
  return w >= DEDICATED_POWER_W ? 'yes' : 'no';
}

const COMMANDS = new Set(['switch', 'pushButton', 'relay', 'detector', 'domotic']);
/**
 * Points « appareils fixes » d'un circuit de prises (RGIE 5.3.5.2 b) : chaque appareil fixe (éclairage, appareil,
 * moteur…) compte pour un socle, sauf ceux commandés ensemble par un même appareil de manœuvre (une chaîne de commandes
 * : va-et-vient, poussoirs et télérupteur…), qui comptent pour un seul. Un appareil branché sur une prise est déjà
 * compté avec sa prise.
 */
function fixedPoints(circuit: ElNode, content: ElNode[]): Set<string> {
  const keys = new Set<string>();
  const inCircuit = new Set(content.map((c) => c.id));
  const parentOf = new Map<string, ElNode>();
  const walk = (x: ElNode) => {
    for (const c of x.children) {
      parentOf.set(c.id, x);
      walk(c);
    }
  };
  walk(circuit);
  for (const c of content) {
    if (c.kind === 'socket' || !LOAD_KINDS.has(c.kind)) continue;
    let p = parentOf.get(c.id);
    if (p?.kind === 'socket') continue;
    let top: ElNode | undefined;
    while (p && inCircuit.has(p.id) && (COMMANDS.has(p.kind) || p.kind === 'cable' || p.kind === 'junctionBox')) {
      if (COMMANDS.has(p.kind)) top = p;
      p = parentOf.get(p.id);
    }
    keys.add(top ? top.id : c.id);
  }
  return keys;
}

/** Différentiel de tête d'au moins 40 A : exigé pour les parties dont l'exécution a commencé le 16/9/1991 ou après (8.2.2). */
const RCD_40A_FROM = DATES.value.rcdHead40aFrom;

/**
 * Exécution de la partie commencée à la date `date` ou après ? Date de la partie (`installedOn`, du plus proche au plus
 * lointain), puis du projet ; partie d'avant le 1/10/1981 → non ; sans date : installation neuve → oui, existante →
 * inconnu. Contrairement à `sinceDate`, une partie réalisée sous une édition antérieure n'est pas exclue d'office.
 */
function executedSince(project: Project, chain: ElNode[], date: string): 'yes' | 'no' | 'unknown' {
  for (const x of [...chain].reverse()) {
    if (x.props.oldPart === true) return 'no';
    const v = onOrAfter(x.props.installedOn, date);
    if (v) return v;
  }
  const v = onOrAfter(project.meta.installationDate, date);
  if (v) return v;
  const ctx = partContext(project, belgium, chain);
  return ctx.isNew ? 'yes' : 'unknown';
}

/** Époque d'une partie pour les dérogations : neuve, avant 1981 (8.2.1), ancien RGIE (8.2.2), Livre 1, inconnue. */
type Regime = 'new' | 'pre1981' | 'old' | 'current' | 'unknown';
function regimeOf(project: Project, chain: ElNode[]): Regime {
  const ctx = partContext(project, belgium, chain);
  if (ctx.isNew) return 'new';
  if (ctx.edition === 'pre1981') return 'pre1981';
  if (ctx.edition === '1981') return 'old';
  return ctx.dated ? 'current' : 'unknown';
}

/**
 * Dérogation du RGIE pour une partie existante (src/regulations/be/derogations.ts). `met` : la condition du texte est
 * vérifiée (true), non vérifiée (false) ou inconnue (undefined). Résultat : constat « dérogation » (avec la référence),
 * « à vérifier » (condition inconnue, époque inconnue, ou ancien RGIE dont l'examen de conformité n'est pas connu), ou
 * rien (pas de dérogation : la non-conformité reste).
 */
function derogationExtra(ruleId: string, regime: Regime, met: boolean | undefined): Extra | undefined {
  if (regime === 'new' || regime === 'current') return undefined;
  if (regime === 'unknown') return DEROGATIONS.some((d) => d.rules.includes(ruleId)) ? { status: 'manualCheck' } : undefined;
  const d = derogationsFor(ruleId, regime)[0];
  if (!d || met === false) return undefined;
  const derogation = { reason: 'RGIE', reference: d.ref };
  if (regime === 'old' || met === undefined) return { status: 'manualCheck', derogation };
  return { status: 'derogation', derogation };
}

/** Charges de puissance (hors commande, signalisation) : un circuit qui n'en a pas peut être un circuit de commande. */
const POWER_LOADS = new Set(['socket', 'light', 'appliance', 'motor', 'solarPanel', 'inverter', 'battery', 'domotic']);

/** Constat brut, avant classement (le 2e paramètre des appels `add` est l'ancienne sévérité, ignorée). */
type Raw = Omit<Finding, 'severity'>;
type Extra = { status?: FindingStatus; inferred?: boolean; knowledge?: Knowledge; fact?: SurveyFact; derogation?: Finding['derogation'] };

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
  // 8.2.1 point 7 (p. 275) : le schéma simplifié d'une installation d'avant le 1/10/1981 n'exige pas le responsable.
  const pre1981Docs = regimeOf(project, []) === 'pre1981';
  if (!pre1981Docs && !meta.installer?.name?.trim()) add('R-DOC-INSTALLER', nc);
  const site = meta.site ?? {};
  if (!site.street?.trim() || !site.city?.trim()) add('R-DOC-ADDRESS', nc);
  if (!meta.supply?.trim()) add('R-DOC-SUPPLY', nc);
  // RGIE 3.1.2 : « numéro, version et date de la version » ; 3.1.2.1 : « nom, qualité » du responsable
  if (!meta.docNumber?.trim()) add('R-DOC-NUMBER', nc);
  if (!pre1981Docs && meta.installer?.name?.trim() && !meta.installer.quality?.trim()) add('R-DOC-QUALITY', nc);

  // --- Terre ---
  // Installation neuve (conception) : terre non dessinée = absente du projet → non-conformité.
  // Installation existante (relevé) : non dessinée = inconnue, sauf absence confirmée (meta.survey.earth).
  const earthDrawn = infos.some((i) => i.node.kind === 'earth');
  const earthStated = surveyStatement(project, 'earth');
  addPresence('R-EARTH-MISSING', presence(earthDrawn, earthStated, projCtx.isNew), 'earth');
  if (!earthDrawn && earthStated === 'present') notDrawn.add('earth');
  const re = project.measurements.earthResistanceOhm;
  if (re !== undefined) {
    // RGIE 4.2.3.2 : résistance de dispersion « inférieure à 100 Ω » (installations domestiques) → 100 Ω pile n'est pas conforme
    if (re >= EARTH_MAX.value) add('R-EARTH-VALUE', nc, undefined, { value: re });
    else if (re > EARTH_EXTRA_MEASURES_ABOVE.value) {
      // 4.2.4.3 b, 10e alinéa (p. 101) : au moins deux différentiels à haute ou très haute sensibilité, 16 socles au plus
      // chacun (un appareil fixe ou un groupe commandé ensemble compte pour un socle), et un différentiel de 100 mA au plus
      // par circuit ou groupe de circuits pour les circuits raccordés à l'origine sans 30 mA.
      const all = collect(project.roots);
      const hs = all.filter((i) => isRcd(i.node) && (n(i.node.props.residualCurrent) ?? Infinity) <= RCD_HIGH_SENSITIVITY.value);
      // Points par différentiel : socles, plus chaque appareil fixe ou ensemble commandé en commun (fixedPoints).
      const points = (rcd: ElNode) =>
        collect(rcd.children)
          .filter((x) => isCircuit(x.node))
          .reduce((s, x) => {
            const content = circuitContent(x.node);
            return s + content.filter((c) => c.kind === 'socket').length + fixedPoints(x.node, content).size;
          }, 0);
      const maxSockets = Math.max(0, ...hs.map((i) => points(i.node)));
      const unknownSensitivity = all.some((i) => isRcd(i.node) && n(i.node.props.residualCurrent) === undefined);
      const without100 = all.filter(
        (i) => isCircuit(i.node) && ![...i.ancestors, i.node].some((a) => isRcd(a) && (n(a.props.residualCurrent) ?? Infinity) <= EARTH_EXTRA_RCD_MAX.value),
      ).length;
      const ok = hs.length >= 2 && maxSockets <= EARTH_EXTRA_SOCKETS_PER_RCD.value && without100 === 0;
      if (!ok) {
        const params = { value: re, rcd30: hs.length, maxSockets, without100 };
        // Variante pour les installations entamées avant le 1/6/2023 (6.5.8.1, 8.2.1 16, 8.2.2 10) : non détaillée → vérification.
        const when = sinceDate(project, [], RCD30_2023);
        // Un différentiel de sensibilité inconnue peut être celui qui manque : on ne conclut pas (ADR-0007).
        if (unknownSensitivity) add('R-EARTH-30', nc, undefined, params, { knowledge: 'unknown' });
        else add('R-EARTH-30', nc, undefined, params, when === 'yes' ? undefined : { status: 'manualCheck' });
      }
    }
  }
  const iso = project.measurements.insulationMOhm;
  if (iso !== undefined && iso < INSULATION_MIN.value) add('R-INSULATION', nc, undefined, { value: iso });
  // Liaisons équipotentielles : « non » saisi = violation constatée ; non saisi = vérification sur place nécessaire.
  if (project.measurements.bondingOk === false) add('R-BONDING', nc, undefined, undefined, derogationExtra('R-BONDING', regimeOf(project, []), undefined));
  else if (project.measurements.bondingOk === undefined) add('R-BONDING', nc, undefined, undefined, { knowledge: 'measureNeeded' });
  // Essais des différentiels : déclenchement au courant nominal différentiel en 300 ms maximum
  // (500 ms pour un différentiel sélectif « S »), ou résultat « non conforme » noté par l'installateur.
  for (const [id, test] of Object.entries(project.measurements.rcdTests ?? {})) {
    const node = infos.find((i) => i.node.id === id)?.node;
    if (!node) continue;
    const max = String(node.props.rcdType ?? '').toUpperCase().includes('S') ? RCD_TRIP_MAX.value.selective : RCD_TRIP_MAX.value.general;
    if (test.ok === false) add('R-RCD-TEST', nc, id);
    // 300 / 500 ms : valeurs des normes de produit (EN 61008 / 61009, non consultées), pas du RGIE → avertissement non
    // bloquant tant qu'un spécialiste ne l'a pas confirmé (dossier de validation, question 13).
    else if (test.tripMs !== undefined && test.tripMs > max) add('R-RCD-TRIP', nc, id, { value: test.tripMs, max }, { status: 'warning' });
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
      // Disjoncteur différentiel 1P+N : 4.4.4.2 admet une détection sur un seul conducteur de ligne si le dispositif
      // coupe les deux ; son emploi en 3 × 230 V reste à confirmer (dossier de validation, question 1) → vérification.
      if (noNeutral && OVERCURRENT.has(String(node.props.device ?? 'mcb')) && !poles) add('R-POLES-NO-NEUTRAL', nc, node.id, { poles: '?' }, { knowledge: 'unknown' });
      if (noNeutral && OVERCURRENT.has(String(node.props.device ?? 'mcb')) && (poles === '1P+N' || poles === '1P')) {
        if (node.props.device === 'rcbo' && poles === '1P+N') add('R-POLES-NO-NEUTRAL', nc, node.id, { poles }, { status: 'manualCheck' });
        else add('R-POLES-NO-NEUTRAL', nc, node.id, { poles });
      }
      if (node.props.device !== 'rcd' && node.props.device !== 'switch' && n(node.props.breakingCapacity) === undefined) add('R-PROT-KA-MISSING', 'info', node.id);
      if (isRcd(node)) {
        const rc = n(node.props.residualCurrent);
        if (rc === undefined) add('R-RCD-SENS-MISSING', nc, node.id);
        const upRcd = [...ancestors].reverse().find(isRcd);
        const up = upRcd ? n(upRcd.props.residualCurrent) : undefined;
        if (rc !== undefined && up !== undefined && rc >= up) add('R-RCD-SELECTIVITY', 'warning', node.id, { up, value: rc });
        // RGIE 5.3.5.3 a : dans une installation domestique, tout différentiel est au moins de type A (le type AC est
        // signalé ; un type non renseigné n'est pas une violation). Partie existante : recommandation (catalogue), une
        // éventuelle dérogation pour l'existant restant à confirmer.
        const reg = regimeOf(project, [...ancestors, node]);
        if (node.props.rcdType === 'AC') {
          // Aucune dérogation au type A trouvée (8.2.1, 8.2.2, 6.5.8) ; pour une partie antérieure au Livre 1 ou d'époque
          // inconnue, l'exigence de l'époque n'est pas connue : vérification plutôt que non-conformité certaine.
          if (reg === 'new' || reg === 'current') add('R-RCD-TYPE-A', nc, node.id);
          else add('R-RCD-TYPE-A', nc, node.id, undefined, { status: 'manualCheck' });
        } else if (node.props.rcdType === undefined || node.props.rcdType === '') add('R-RCD-TYPE-A', nc, node.id, undefined, { knowledge: 'unknown' });
        // RGIE 5.3.5.3 a : le différentiel placé en tête de l'installation a une intensité nominale d'au moins 40 A.
        // Dérogations : 8.2.1 (parties d'avant le 1/10/1981) et 8.2.2 (exécution entamée avant le 16/9/1991) laissent en
        // service un différentiel de moins de 40 A. Date inconnue d'une partie existante : vérification, non bloquante.
        const rating = n(node.props.ratedCurrent);
        if (!upRcd && rating !== undefined && rating < RCD_HEAD_MIN_RATING.value) {
          const when = executedSince(project, [...ancestors, node], RCD_40A_FROM);
          // « En tête » vise l'interrupteur différentiel d'origine ; un disjoncteur différentiel sans différentiel en amont
          // est un cas à vérifier (audit 2026, lot g3).
          if (node.props.device === 'rcbo') add('R-RCD-HEAD-RATING', nc, node.id, { value: rating }, { status: 'manualCheck' });
          else if (when === 'yes') add('R-RCD-HEAD-RATING', nc, node.id, { value: rating });
          else if (when === 'unknown') add('R-RCD-HEAD-RATING', nc, node.id, { value: rating }, { status: 'manualCheck' });
        }
      }
    }

    // --- Canalisations : section ↔ protection ---
    if (node.kind === 'cable') {
      const parent = ancestors.at(-1);
      // Courant continu : hors périmètre de ces règles AC. Nature saisie (`current`), sinon déduite : en aval d'un panneau,
      // d'un onduleur ou d'une batterie (heuristique, documentée comme limite du modèle).
      const dcSide = node.props.current === 'dc' || (node.props.current !== 'ac' && ancestors.some((a) => a.kind === 'inverter' || a.kind === 'solarPanel' || a.kind === 'battery'));
      // Un câble dans le prolongement d'un autre câble/élément sans données hérite de celui du départ.
      const isStart = !parent || parent.kind === 'protection' || parent.kind === 'board' || parent.kind === 'meter' || parent.kind === 'origin';
      const section = n(node.props.section);
      const prot = [...ancestors].reverse().find((a) => a.kind === 'protection' && OVERCURRENT.has(String(a.props.device)));
      const anyProtection = ancestors.some((a) => a.kind === 'protection');
      const feedsLoads = circuitContent(node).some((c) => LOAD_KINDS.has(c.kind)) || [...node.children].some((c) => LOAD_KINDS.has(c.kind));
      if (section === undefined) {
        if (isStart && !dcSide) add(node.props.cableType || node.props.conductors ? 'R-CABLE-SECTION-MISSING' : 'R-CABLE-DATA-MISSING', nc, node.id);
      } else if (isStart && !dcSide && (!node.props.cableType || (!n(node.props.conductors) && regimeOf(project, [...ancestors, node]) !== 'pre1981'))) {
        // 3.1.2.2 a : type, section et nombre des conducteurs sur le schéma unifilaire (8.2.1 point 7 : le schéma
        // simplifié d'une partie d'avant 1981 n'exige que le type et la section).
        add('R-CABLE-DATA-MISSING', nc, node.id);
      }
      if (section !== undefined && !dcSide) {
        const rating = prot ? n(prot.props.ratedCurrent) : undefined;
        if (section < SECTION_MIN_NO_SOCKET.value) {
          const chain = [...ancestors, node];
          const powerLoads = [...circuitContent(node), ...node.children].some((c) => POWER_LOADS.has(c.kind));
          // Tableau 5.1 : 0,5 mm² admis pour les circuits de commande, contrôle, signalisation et mesure ; sans charge de
          // puissance, le câble peut en être un : vérification (le modèle ne sait pas le dire).
          if (!powerLoads && section >= 0.5) add('R-CABLE-MIN', nc, node.id, { section }, { status: 'manualCheck' });
          else {
            // 8.2.1 point 5 : au moins 1 mm² ; 1 mm² protégé par un fusible de 6 A ou un disjoncteur de 10 A au plus.
            const dev = String(prot?.props.device ?? '');
            const met = section >= 1 ? (rating === undefined ? undefined : rating <= (dev === 'fuse' ? 6 : 10)) : false;
            // 8.2.2 point 5 : 1 mm² ou 0,75 mm² selon le type, circuit sans socle, exécution entamée avant le 17/5/1986.
            const regime = regimeOf(project, chain);
            const before1986 = sinceDate(project, chain, DATES.value.oldSection1986);
            const noSocket = !circuitContent(node).some((c) => c.kind === 'socket') && !node.children.some((c) => c.kind === 'socket');
            const metOld = section < 0.75 || !noSocket || before1986 === 'yes' ? false : undefined;
            add('R-CABLE-MIN', nc, node.id, { section }, derogationExtra('R-CABLE-MIN', regime, regime === 'old' ? metOld : met));
          }
        }
        const max = prot ? maxProtectionFor(section, String(prot.props.device)) : undefined;
        // En aval d'un transformateur : le calibre du primaire ne se compare pas au câble du secondaire (tableau 4.11).
        // La présence d'un transformateur n'établit pourtant ni la TBTS ni la protection du secondaire (type de
        // transformateur et protection propre non modélisés) : protection contre les surintensités « à vérifier ».
        const belowTransformer = prot !== undefined && ancestors.slice(ancestors.indexOf(prot)).some((a) => a.kind === 'transformer');
        if (belowTransformer) add('R-CABLE-NO-OVERCURRENT', nc, node.id, undefined, { knowledge: 'unknown', status: 'manualCheck' });
        else if (rating !== undefined && max !== undefined && rating > max) add('R-CABLE-PROT', nc, node.id, { section, rating, max });
        // Hors du tableau 4.11 (au-delà de 35 mm²) : pas de maximum réglementaire tabulé → courant admissible à vérifier.
        if (prot && rating !== undefined && max === undefined) add('R-CABLE-IZ', nc, node.id, { section, rating });
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
    // Chapitre 7.22 : bornes dont la réalisation ou le remplacement est entamé à partir du 1/11/2022 (7.22.1).
    if (node.kind === 'appliance' && node.props.applianceType === 'evCharger') {
      const when = sinceDate(project, [...ancestors, node], DATES.value.evCharger722);
      if (when !== 'no') add('R-EV-MANUAL', 'info', node.id);
    }

    // --- Prises ---
    if (node.kind === 'socket') {
      // Valeur non renseignée = symbole par défaut (prise avec terre et sécurité enfant) : présent dans le dessin.
      // « false » = absence déclarée (saisie, ou reprise par l'assistant : « déduite » tant que non confirmée).
      // 5.3.5.2 b : sauf socle alimenté par un transformateur de séparation des circuits individuel (prise « rasoir »).
      if (node.props.earth === false && node.props.socketKind !== 'shaver') {
        // 8.2.1 point 6 b : partie d'avant 1981, canalisation sans conducteur de protection et différentiel ≤ 30 mA. Sans
        // 30 mA en amont la dérogation ne s'applique pas ; avec, la canalisation reste à vérifier sur place.
        const chain = [...ancestors, node];
        const rcd30 = chain.some((a) => isRcd(a) && (n(a.props.residualCurrent) ?? Infinity) <= RCD_HIGH_SENSITIVITY.value);
        add('R-SOCKET-EARTH', nc, node.id, undefined, { knowledge: 'absent', ...derogationExtra('R-SOCKET-EARTH', regimeOf(project, chain), rcd30 ? undefined : false) });
      }
      // Depuis le 1/3/2025 (RGIE 5.3.5.2 a) : socles ≤ 16 A / 250 V au moins IPXX-D (obturateurs), sauf socle réservé à
      // un ou plusieurs appareils d'un usage spécifique (prise d'un appareil dessiné sous elle). Avant cette date, la
      // vérification de Voltaplan reste celle d'avant (prise sans sécurité enfant signalée).
      // Dérogations de 5.3.5.2 a : socle réservé à des appareils d'un usage spécifique, placé dans ou sur un tableau, ou
      // muni d'un verrouillage qui met le socle hors tension après le retrait de la fiche.
      const reserved = node.children.some((c) => c.kind === 'appliance') || node.props.inBoard === true || node.props.socketKind === 'switchedLocked';
      if (node.props.childSafety === false && !node.props.threePhase) {
        const when = sinceDate(project, [...ancestors, node], RGIE_2025);
        if (when !== 'yes') add('R-SOCKET-CHILD', nc, node.id, undefined, { knowledge: 'absent' });
        else if (!reserved) add('R-SOCKET-IPXXD', nc, node.id, undefined, { knowledge: 'absent' });
      }
    }
  }

  // --- Règles par circuit ---
  // Tableaux dont la date (avant / après le 1/6/2023) décide des règles 30 mA de 2023 : une question par tableau
  const dateNeeded = new Map<string, number>();
  const askDate = (chain: ElNode[]) => {
    // Sans tableau dans la chaîne (circuit sous le différentiel général), la question est posée au premier élément.
    const b = boardOf(chain) ?? chain[0];
    if (b) dateNeeded.set(b.id, (dateNeeded.get(b.id) ?? 0) + 1);
  };
  const rcd300Drawn = infos.some((i) => isRcd(i.node) && (n(i.node.props.residualCurrent) ?? Infinity) <= RCD_ORIGIN_MAX_SENSITIVITY.value);
  for (const { node: circuit, ancestors } of infos) {
    if (!isCircuit(circuit)) continue;
    const content = circuitContent(circuit);
    const cables = content.filter((c) => c.kind === 'cable');
    const sockets = content.filter((c) => c.kind === 'socket');
    const loads = content.filter((c) => LOAD_KINDS.has(c.kind));
    const rcds = ancestors.filter(isRcd).concat(isRcd(circuit) ? [circuit] : []);
    const minRcd = Math.min(...rcds.map((r) => n(r.props.residualCurrent) ?? Infinity));
    const label = String(circuit.props.circuitName ?? '').trim();

    if (!label) add('R-CIRCUIT-NAME', 'info', circuit.id);

    // RGIE 5.3.5.2 b : 8 socles simples ou multiples au plus par circuit terminal. Un circuit qui alimente des socles
    // et aussi des appareils fixes (éclairage compris, hors appareils des circuits dédiés) suit les règles des circuits
    // de prises, « un appareil fixe ou un ensemble d'appareils fixes commandé par un appareil de manœuvre commun »
    // comptant pour un socle. Un circuit sans socle n'a pas cette limite.
    if (sockets.length) {
      const count = sockets.length + fixedPoints(circuit, content).size;
      // 8.2.1 point 6 b / 8.2.2 point 6 : plus de 8 socles admis sous une condition de puissance non calculée → vérification.
      if (count > SOCKETS_PER_CIRCUIT_MAX.value) add('R-SOCKET-MAX', nc, circuit.id, { count }, derogationExtra('R-SOCKET-MAX', regimeOf(project, [...ancestors, circuit]), undefined));
    }
    if (sockets.length) {
      const minSection = Math.min(...cables.map((c) => n(c.props.section) ?? Infinity));
      // Tableau 5.1 : 0,75 mm² admis pour un circuit intégré dans un tableau qui alimente un socle simple.
      const boardSocket = sockets.length === 1 && sockets[0].props.inBoard === true && n(sockets[0].props.count) !== 2 && minSection >= 0.75;
      if (Number.isFinite(minSection) && minSection < SECTION_MIN_GENERAL.value && !boardSocket) {
        // 8.2.1 point 5 : au moins 1 mm² (1 mm² : fusible ≤ 6 A ou disjoncteur ≤ 10 A).
        const r0 = n(circuit.props.ratedCurrent);
        const dev = String(circuit.props.device ?? '');
        const met = minSection >= 1.5 ? true : minSection >= 1 ? (r0 === undefined ? undefined : r0 <= (dev === 'fuse' ? 6 : 10)) : false;
        add('R-SOCKET-SECTION', nc, circuit.id, { section: minSection }, derogationExtra('R-SOCKET-SECTION', regimeOf(project, [...ancestors, circuit]), met));
      }
    }

    // Appareils devant avoir un circuit spécialisé
    // 5.2.1.2 : « chaque appareil ou machine […] à poste fixe » ≥ 2 600 W : les moteurs de puissance connue aussi.
    const appliances = content.filter((c) => c.kind === 'appliance' || (c.kind === 'motor' && (n(c.props.power) ?? 0) >= DEDICATED_POWER_W));
    for (const ap of appliances) {
      const type = String(ap.props.applianceType);
      const need = dedicatedNeed(ap);
      if (need === 'no') continue;
      // L'appareil et la prise qui l'alimente comptent pour un seul point ; les appareils d'un chauffage électrique
      // fixe peuvent partager leur(s) circuit(s) dédié(s) (« un ou plusieurs circuits dédiés »).
      const parent = byId.get(ap.id)?.ancestors.at(-1);
      const heating = FIXED_HEATING.has(type);
      const others = loads.filter(
        (l) => l !== ap && !(parent && l === parent && parent.kind === 'socket') && !(heating && l.kind === 'appliance' && FIXED_HEATING.has(String(l.props.applianceType))),
      );
      if (!others.length) continue;
      // Puissance inconnue d'un appareil qui n'est pas dans la liste nommée : à vérifier, jamais bloquant.
      if (need === 'ifPowerKnown') add('R-DEDICATED-CIRCUIT', nc, ap.id, { appliance: type, others: others.length }, { status: 'manualCheck' });
      // 8.2.1 / 8.2.2 point 5 : circuits existants non dédiés laissés en service (parties antérieures au Livre 1).
      else add('R-DEDICATED-CIRCUIT', nc, ap.id, { appliance: type, others: others.length }, derogationExtra('R-DEDICATED-CIRCUIT', regimeOf(project, [...ancestors, circuit]), true));
    }

    // Différentiels (ADR-0007). Sensibilité inconnue d'un différentiel dessiné : valeur inconnue (pas une violation).
    // Aucun différentiel adéquat dessiné : conception → absent ; relevé → inconnu, sauf déclaration (meta.survey).
    const design = partContext(project, belgium, [...ancestors, circuit]).isNew;
    const unknownSens = rcds.some((r) => n(r.props.residualCurrent) === undefined);
    if (!(minRcd <= RCD_ORIGIN_MAX_SENSITIVITY.value)) {
      if (unknownSens) add('R-RCD-MAIN', nc, circuit.id, undefined, { knowledge: 'unknown' });
      else if (rcds.length) add('R-RCD-MAIN', nc, circuit.id); // différentiel(s) dessiné(s), tous de sensibilité connue > 300 mA
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
    // Depuis le 1/6/2023 : aussi les prises non destinées à un appareil fixe et l'éclairage (RGIE 4.2.4.3 b, 5e al.).
    // Une prise dont le seul enfant est un appareil (prise dédiée) suit la règle de cet appareil.
    const generalSocket = sockets.some((sk) => !(sk.children.length === 1 && sk.children[0].kind === 'appliance'));
    const lighting = content.some((c) => c.kind === 'light');
    const when = generalSocket || lighting ? since2023(project, [...ancestors, circuit]) : 'no';
    const rule2023 = when === 'yes';
    if (when === 'unknown' && !(minRcd <= RCD_HIGH_SENSITIVITY.value)) askDate([...ancestors, circuit]);
    if ((wet || wetAppliance || rule2023) && !(minRcd <= RCD_HIGH_SENSITIVITY.value)) {
      const reason = wet ? 'wetRoom' : wetAppliance ? String(wetAppliance.props.applianceType) : generalSocket ? 'sockets' : 'lighting';
      if (unknownSens) add('R-RCD30', nc, circuit.id, { reason }, { knowledge: 'unknown' });
      else {
        const k = presence(false, rcd30Stated, design);
        if (k === 'present') notDrawn.add('rcd30');
        addPresence('R-RCD30', k, 'rcd30', circuit.id, { reason });
      }
    // La déclaration globale « 30 mA présent » (relevé) ne dit pas quels circuits il protège : l'indice reste.
    } else if (wetByName && !(minRcd <= RCD_HIGH_SENSITIVITY.value)) add('R-WETROOM-NAME', 'info', circuit.id, undefined, { knowledge: 'deduced' });
  }

  // Au maximum 8 circuits terminaux par différentiel 30 mA (RGIE 4.2.4.3 b, 6e al., depuis le 1/6/2023)
  for (const { node: rcd, ancestors } of infos) {
    if (!isRcd(rcd) || !((n(rcd.props.residualCurrent) ?? Infinity) <= RCD_HIGH_SENSITIVITY.value)) continue;
    const counted = collect(rcd.children).filter((i) => isCircuit(i.node));
    const count = counted.length;
    if (count <= CIRCUITS_PER_RCD30_MAX.value) continue;
    // Un circuit ajouté à partir du 1/6/2023 suit la règle, même sous un différentiel plus ancien (6.5.8.1, 1).
    const circuitDates = counted.map((i) => {
      const full = byId.get(i.node.id);
      return since2023(project, full ? [...full.ancestors, full.node] : [...ancestors, rcd, i.node]);
    });
    const when = circuitDates.includes('yes') ? 'yes' : since2023(project, [...ancestors, rcd]);
    if (when === 'yes') add('R-RCD30-MAX', nc, rcd.id, { count });
    else if (when === 'unknown') askDate([...ancestors, rcd]);
  }
  for (const [boardId, count] of dateNeeded) add('R-RCD30-DATE', nc, boardId, { count, board2023: boardId }, { knowledge: 'unknown' });

  // Photovoltaïque : panneaux ou onduleur DC → AC (un redresseur/onduleur AC ↔ DC seul est celui d'une batterie)
  const pv = infos.find((i) => i.node.kind === 'solarPanel' || (i.node.kind === 'inverter' && (i.node.props.inverterType ?? 'dcAc') === 'dcAc'));
  const pvPower = Math.max(0, ...infos.filter((i) => i.node.kind === 'inverter').map((i) => n(i.node.props.power) ?? 0));
  if (pv && !(pvPower > PV_7112_MAX.value)) add('R-PV-MANUAL', 'info', pv.node.id);

  // Équipements confirmés présents mais non dessinés : le schéma est incomplet (exigence documentaire).
  for (const fact of notDrawn) add('R-DOC-NOT-DRAWN', nc, undefined, { fact }, { fact });

  // --- Calculs (longueurs connues) : chute de tension et protection contre les courts-circuits ---
  // Comparaisons sur les valeurs brutes ; arrondi seulement pour le message.
  // Chute : totale depuis l'origine si l'amont est connu, détaillée si toutes les puissances sont connues
  // (voir src/calc/electrical.ts) ; un dépassement au calibre non confirmé par le détail reste signalé (info).
  // Circuits non calculés (longueur inconnue ; fusible : caractéristique non modélisée) : jamais un silence qui se
  // lirait comme « conforme » ; un constat « à vérifier » par calcul, avec le nombre de circuits.
  const calcs = calcProject(project);
  const noLength = calcs.filter((c) => c.length === undefined).length;
  const fuseCircuits = calcs.filter((c) => byId.get(c.circuitId)?.node.props.device === 'fuse').length;
  if (noLength) add('R-VDROP', 'info', undefined, { count: noLength }, { knowledge: 'unknown', status: 'manualCheck' });
  const iccUnchecked = calcs.filter((c) => c.length === undefined || byId.get(c.circuitId)?.node.props.device === 'fuse').length;
  if (iccUnchecked) add('R-ICC-LMAX', 'info', undefined, { count: iccUnchecked, fuses: fuseCircuits }, { knowledge: 'unknown', status: 'manualCheck' });
  for (const c of calcs) {
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
    'cableType.XVB': '0,6/1 kV (≈ FR U-1000 R2V, DE N2XY)',
    socket: 'NBN C 61-112-1 (type E)',
  },
};
