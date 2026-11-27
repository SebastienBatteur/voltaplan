/**
 * Calculs par circuit (fonctions pures, testées, sans React) : chute de tension et longueur maximale
 * protégée contre les courts-circuits. Méthode conventionnelle de l'IEC 60364-5-52 (annexe G) et
 * -4-43, la même que les guides belges et français (UTE C 15-105), utilisable sans logiciel de calcul.
 * Documentation complète (formules, sources, limites) : docs/calc.md.
 *
 * Constantes
 *  - Résistivité à la température de service (résistivité conventionnelle = 1,25 × ρ à 20 °C,
 *    IEC 60364-5-52 annexe G / UTE C 15-105) : cuivre ρ = 0,0225 Ω·mm²/m, aluminium ρ = 0,036 Ω·mm²/m.
 *    Matière du câble : propriété `material` ('Cu' | 'Al') ; absente = cuivre supposé (hypothèse notée).
 *  - Réactance linéique λ = 0,08 mΩ/m (même source), utilisée seulement par la méthode détaillée
 *    quand un cos φ < 1 est saisi.
 *
 * Chute de tension, méthode conservative (toujours calculée)
 *    ΔU = b · Σ(ρ·L/S) · I, avec I = calibre de la protection (cas le plus défavorable, cos φ = 1),
 *    b = 2 en monophasé (230 V phase-neutre, ou entre deux phases d'un réseau 3 × 230 V), b = √3 en
 *    triphasé ; ΔU % = 100 · ΔU / U. Trajet retenu : celui qui a la plus grande somme ρ·L/S.
 *
 * Chute cumulée depuis l'origine
 *    Les câbles situés AU-DESSUS de la protection du circuit (alimentation d'un sous-tableau, liaison
 *    compteur → tableau…) sont ajoutés (pas ceux avant le compteur : raccordement du gestionnaire de
 *    réseau, l'origine de l'installation est le compteur) : pour chacun, I = calibre de la protection qui l'alimente
 *    (la plus proche au-dessus de lui ; à défaut, le courant du raccordement `mainCurrent`), b et U
 *    selon les pôles de cette protection. Les pourcentages s'additionnent (même tension de référence
 *    phase-neutre). Si une donnée manque (longueur, section, courant), l'amont est « inconnu » et le
 *    total n'est pas donné ; s'il n'y a aucun câble en amont, la chute amont vaut 0.
 *
 * Méthode détaillée (si toutes les charges du circuit ont une puissance connue)
 *    Chaque charge : Ia = P / (k·U) (courant actif), Ir = Ia · tan φ (réactif), k = 1 en monophasé,
 *    √3 en triphasé (charge supposée équilibrée), cos φ saisi ou 1 par défaut (hypothèse notée).
 *    Chaque tronçon porte la somme des courants des charges en aval :
 *    ΔU tronçon = b · L · (ρ/S · Ia + λ · Ir). La chute d'une extrémité est la somme sur son trajet ;
 *    on retient l'extrémité la plus défavorable. L'amont reste calculé de façon conservative.
 *
 * Décision pour le contrôle R-VDROP (src/rules/be/rgie.ts) : `checkDropPct` = chute détaillée totale
 *    si la méthode détaillée est complète (le courant d'emploi réel est la base de l'annexe G), sinon
 *    la chute conservative totale (ou celle du seul circuit si l'amont est inconnu). Un dépassement au
 *    calibre que la méthode détaillée ne confirme pas reste signalé (information), jamais passé sous silence.
 *
 * Court-circuit minimal en bout de circuit (tension réduite à 80 % par l'amont non modélisé)
 *    Icc min = 0,8 · U / (b · (R amont + R circuit)), R = Σ ρ·L/S par conducteur ; il doit dépasser le
 *    seuil magnétique du disjoncteur (courbe B : 5 In, C : 10 In, D : 20 In). Les câbles amont connus
 *    (alimentation de sous-tableau) sont inclus ; l'impédance du réseau et du transformateur ne l'est pas.
 *    Longueur maximale (dans la section/matière la plus défavorable du circuit) :
 *    Lmax = (S/ρ) · (0,8 · U / (b · Ia) − R amont), soit 0,8·U·S/(b·ρ·Ia) sans amont.
 *    C'est une estimation, pas une étude de protection (ni sélectivité, ni boucle de défaut TT,
 *    protégée par le différentiel).
 *
 * Toutes les valeurs du résultat sont brutes (non arrondies) : arrondir seulement à l'affichage.
 */
import type { ElNode, Project } from '../model/types';
import { ancestors, isCircuit, isSeries, walk } from '../model/tree';

/** Résistivités conventionnelles à la température de service (1,25 × ρ20), Ω·mm²/m. */
export const RHO_CU = 0.0225;
export const RHO_AL = 0.036;
/** Réactance linéique des câbles (Ω/m), IEC 60364-5-52 annexe G : 0,08 mΩ/m. */
export const LAMBDA = 0.08e-3;
/** Seuil de déclenchement magnétique, en multiples du calibre. */
export const MAGNETIC: Record<string, number> = { B: 5, C: 10, D: 20 };
/** Limites usuelles de chute de tension depuis l'origine (IEC 60364-5-52, annexe G) : éclairage / autres usages. */
export const VDROP_LIMIT = { lighting: 3, other: 5 };

/** Hypothèses retenues pour un résultat (clés traduites par `calc.assumption.<clé>`). */
export type CalcAssumption =
  | 'copperAssumed' // au moins un câble sans matière : cuivre supposé
  | 'ratingCurrent' // chute conservative calculée au calibre de la protection
  | 'noUpstreamImpedance' // court-circuit : impédance du réseau non prise en compte (facteur 0,8)
  | 'upstreamUnknown' // câble(s) amont incomplet(s) : chute cumulée inconnue, Icc sans l'amont
  | 'cosPhiOne' // méthode détaillée : cos φ = 1 pour au moins une charge
  | 'balancedThreePhase'; // méthode détaillée en triphasé : charges supposées équilibrées

export interface CircuitCalc {
  circuitId: string;
  /** Longueur du trajet le plus défavorable (m), si toutes les longueurs sont connues. */
  length?: number;
  /** Câbles du circuit sans longueur. */
  missingLength: number;
  /** Plus petite section sur le trajet (mm²). */
  section?: number;
  ratedCurrent?: number;
  voltage: number;
  threePhase: boolean;
  /** Méthode de la chute de tension retenue pour le contrôle. */
  method: 'conservative' | 'detailed';
  /** Chute du circuit seul, au calibre de la protection (%). */
  dropPct?: number;
  /** Chute des câbles en amont (alimentation des tableaux), conservative (%) ; absente si inconnue. */
  upstreamDropPct?: number;
  /** Câbles en amont (origine → protection du circuit) pris en compte / incomplets. */
  upstreamCables: number;
  upstreamMissing: number;
  /** Chute conservative depuis l'origine = amont + circuit (%), si l'amont est connu. */
  totalDropPct?: number;
  /** Méthode détaillée (puissances connues) : chute du circuit, total depuis l'origine, courant d'emploi (A). */
  detailedDropPct?: number;
  detailedTotalDropPct?: number;
  designCurrent?: number;
  /** Valeur comparée à la limite (voir l'en-tête) et limite applicable (%). */
  checkDropPct?: number;
  dropLimit: number;
  /** Icc minimal en bout de circuit (A) et seuil magnétique (A). */
  iccMin?: number;
  magnetic?: number;
  /** Longueur maximale protégée (m). */
  lmax?: number;
  assumptions: CalcAssumption[];
}

function num(v: unknown): number | undefined {
  const x = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(x) && x > 0 ? x : undefined;
}

/** Résistivité d'un câble selon sa matière ; `assumed` vrai si la matière n'est pas renseignée. */
export function cableRho(cable: ElNode): { rho: number; assumed: boolean } {
  const m = String(cable.props.material ?? '').toLowerCase();
  if (m === 'al') return { rho: RHO_AL, assumed: false };
  return { rho: RHO_CU, assumed: m !== 'cu' };
}

const isThreePhasePoles = (p: unknown) => /^[34]/.test(String(p ?? ''));

function network(project: Project) {
  const supply = String(project.meta.supply ?? '');
  return {
    net400: /3\s*[x×]\s*400|400\s*V|3N/i.test(supply),
    threePhaseSupply: /^\s*3/.test(supply),
  };
}

/** Enfants qui appartiennent encore au circuit (pas de sous-tableau, pas d'autre protection sauf en série). */
const inCircuit = (c: ElNode) => c.kind !== 'board' && !(c.kind === 'protection' && !isSeries(c));

/** Trajets protection → extrémités : liste des câbles sur chaque trajet (sans descendre dans un sous-tableau). */
function paths(circuit: ElNode): ElNode[][] {
  const out: ElNode[][] = [];
  const rec = (n: ElNode, acc: ElNode[]) => {
    const kids = n.children.filter(inCircuit);
    const here = n.kind === 'cable' ? [...acc, n] : acc;
    if (!kids.length) {
      if (here.length) out.push(here);
      return;
    }
    for (const c of kids) rec(c, here);
  };
  rec(circuit, []);
  return out;
}

/** Éléments dont la consommation propre est négligeable ou qui ne font que transmettre le courant. */
const PASS_THROUGH = new Set(['cable', 'switch', 'pushButton', 'junctionBox', 'relay', 'detector', 'domotic', 'bell', 'transformer', 'earthBar', 'earth', 'protection']);

interface Load {
  p: number;
  cosPhi?: number;
}

/**
 * Charge propre d'un nœud du circuit : puissance (W), 'none' si négligeable, undefined si inconnue.
 * Prise : connue seulement si chacun de ses socles porte un appareil désigné (sinon on ne sait pas
 * ce qui y sera branché). Point lumineux : puissance × nombre.
 */
function ownLoad(n: ElNode): Load | 'none' | undefined {
  const cosPhi = num(n.props.cosPhi);
  switch (n.kind) {
    case 'light': {
      const p = num(n.props.power);
      return p === undefined ? undefined : { p: p * (num(n.props.count) ?? 1), cosPhi };
    }
    case 'appliance':
    case 'motor': {
      const p = num(n.props.power);
      return p === undefined ? undefined : { p, cosPhi };
    }
    case 'socket': {
      const apps = n.children.filter((c) => c.kind === 'appliance');
      // Chaque socle a son appareil désigné (compté à part, comme enfant) : la prise elle-même ne consomme rien
      return apps.length && (num(n.props.count) ?? 1) <= apps.length ? 'none' : undefined;
    }
    default:
      return PASS_THROUGH.has(n.kind) ? 'none' : undefined; // autre, panneau, onduleur… : inconnu
  }
}

/** Chute détaillée du circuit (%), ou undefined si une charge est inconnue. */
function detailedDrop(
  circuit: ElNode,
  b: number,
  k: number,
  voltage: number,
  assumptions: Set<CalcAssumption>,
): { pct: number; current: number } | undefined {
  let complete = true;
  let anyLoad = false;
  let cosOne = false;
  // Courants actif / réactif en aval d'un nœud ; accumule la chute maximale vers les extrémités.
  const down = (n: ElNode): { ia: number; ir: number } => {
    let ia = 0;
    let ir = 0;
    if (n !== circuit) {
      const l = ownLoad(n);
      if (l === undefined) complete = false;
      else if (l !== 'none') {
        anyLoad = true;
        const valid = l.cosPhi !== undefined && l.cosPhi <= 1;
        const cos = valid ? l.cosPhi! : 1;
        if (!valid) cosOne = true;
        const a = l.p / (k * voltage);
        ia += a;
        ir += a * Math.tan(Math.acos(cos));
      }
    }
    for (const c of n.children.filter(inCircuit)) {
      const d = down(c);
      ia += d.ia;
      ir += d.ir;
    }
    return { ia, ir };
  };
  const worst = (n: ElNode): number => {
    let here = 0;
    if (n.kind === 'cable') {
      const L = num(n.props.length) ?? 0;
      const S = num(n.props.section) ?? Infinity;
      const { ia, ir } = down(n);
      here = b * L * ((cableRho(n).rho / S) * ia + LAMBDA * ir);
    }
    const kids = n.children.filter(inCircuit);
    return here + (kids.length ? Math.max(...kids.map(worst)) : 0);
  };
  const total = down(circuit);
  if (!complete || !anyLoad) return undefined;
  const dU = worst(circuit);
  if (cosOne) assumptions.add('cosPhiOne');
  if (k > 1) assumptions.add('balancedThreePhase');
  return { pct: (100 * dU) / voltage, current: Math.hypot(total.ia, total.ir) };
}

/** Câbles en amont de la protection du circuit (origine → circuit) : chute conservative et résistance par conducteur. */
function upstream(circuit: ElNode, project: Project, assumptions: Set<CalcAssumption>) {
  const { net400, threePhaseSupply } = network(project);
  const chain = ancestors(project.roots, circuit.id);
  let pct = 0;
  let r = 0;
  let cables = 0;
  let missing = 0;
  // L'origine de l'installation est le compteur : le raccordement en amont appartient au gestionnaire de réseau.
  const start = chain.map((n) => n.kind).lastIndexOf('meter') + 1;
  chain.forEach((n, i) => {
    if (n.kind !== 'cable' || i < start) return;
    cables++;
    const L = num(n.props.length);
    const S = num(n.props.section);
    const { rho, assumed } = cableRho(n);
    if (assumed) assumptions.add('copperAssumed');
    const feeder = chain.slice(0, i).reverse().find((a) => a.kind === 'protection' && num(a.props.ratedCurrent) !== undefined);
    const I = feeder ? num(feeder.props.ratedCurrent) : num(project.meta.mainCurrent);
    const tri = feeder ? isThreePhasePoles(feeder.props.poles) : threePhaseSupply;
    if (L === undefined || S === undefined || I === undefined) {
      missing++;
      return;
    }
    const U = tri && net400 ? 400 : 230;
    const b = tri ? Math.sqrt(3) : 2;
    pct += (100 * b * rho * L * I) / (S * U);
    r += (rho * L) / S;
  });
  return { pct, r, cables, missing };
}

export function calcCircuit(circuit: ElNode, project: Project): CircuitCalc {
  const { net400 } = network(project);
  const threePhase = isThreePhasePoles(circuit.props.poles);
  const voltage = threePhase ? (net400 ? 400 : 230) : 230;
  const b = threePhase ? Math.sqrt(3) : 2;
  const content = [...walk(circuit.children)].map((w) => w.node);
  const lighting = content.some((c) => c.kind === 'light') && !content.some((c) => c.kind === 'socket' || c.kind === 'appliance');
  const assumptions = new Set<CalcAssumption>();
  const cables = paths(circuit).flat();
  for (const c of new Set(cables)) if (cableRho(c).assumed) assumptions.add('copperAssumed');
  const up = upstream(circuit, project, assumptions);
  const res: CircuitCalc = {
    circuitId: circuit.id,
    missingLength: [...new Set(cables)].filter((c) => !num(c.props.length)).length,
    voltage,
    threePhase,
    method: 'conservative',
    dropLimit: lighting ? VDROP_LIMIT.lighting : VDROP_LIMIT.other,
    ratedCurrent: num(circuit.props.ratedCurrent),
    upstreamCables: up.cables,
    upstreamMissing: up.missing,
    upstreamDropPct: up.missing ? undefined : up.pct,
    assumptions: [],
  };
  if (up.missing) assumptions.add('upstreamUnknown');
  const finish = () => {
    res.assumptions = [...assumptions];
    return res;
  };
  const sections = cables.map((c) => num(c.props.section)).filter((s): s is number => s !== undefined);
  if (sections.length) res.section = Math.min(...sections);
  const ps = paths(circuit);
  if (!ps.length || res.missingLength) return finish();
  // Trajet le plus défavorable : plus grande somme ρ·L/S (et longueur correspondante) ;
  // câble le plus défavorable (plus grand ρ/S) pour Lmax.
  let worst = { rl: 0, len: 0 };
  let worstRhoS = 0;
  for (const p of ps) {
    let rl = 0;
    let len = 0;
    for (const c of p) {
      const L = num(c.props.length) ?? 0;
      const S = num(c.props.section);
      if (!S) return finish();
      const { rho } = cableRho(c);
      rl += (rho * L) / S;
      len += L;
      worstRhoS = Math.max(worstRhoS, rho / S);
    }
    if (rl > worst.rl) worst = { rl, len };
  }
  res.length = worst.len;
  const I = res.ratedCurrent;
  if (I) {
    assumptions.add('ratingCurrent');
    res.dropPct = (100 * b * worst.rl * I) / voltage;
    if (res.upstreamDropPct !== undefined) res.totalDropPct = res.upstreamDropPct + res.dropPct;
  }
  const det = detailedDrop(circuit, b, threePhase ? Math.sqrt(3) : 1, voltage, assumptions);
  if (det) {
    res.method = 'detailed';
    res.detailedDropPct = det.pct;
    res.designCurrent = det.current;
    if (res.upstreamDropPct !== undefined) res.detailedTotalDropPct = res.upstreamDropPct + det.pct;
  }
  res.checkDropPct = det ? (res.detailedTotalDropPct ?? res.detailedDropPct) : (res.totalDropPct ?? res.dropPct);
  const curve = String(circuit.props.curve ?? '').toUpperCase();
  const device = String(circuit.props.device ?? 'mcb');
  if (I && MAGNETIC[curve] && (device === 'mcb' || device === 'rcbo')) {
    assumptions.add('noUpstreamImpedance');
    const rUp = up.missing ? 0 : up.r;
    res.magnetic = MAGNETIC[curve] * I;
    const rTot = rUp + worst.rl;
    // Courant de court-circuit minimal = défaut le plus faible du circuit : phase-neutre (230 V, boucle de deux
    // conducteurs) en monophasé et en 3N × 400 V ; phase-phase (230 V entre phases, deux conducteurs) en 3 × 230 V sans
    // neutre. Dans tous ces cas U = 230 V et la boucle compte deux conducteurs (b = 2). Le défaut triphasé symétrique
    // (400 V / √3) n'est pas le minimal : l'utiliser surestimait Lmax d'un facteur 2 (2/√3 sans neutre).
    const uFault = 230;
    const bFault = 2;
    res.iccMin = rTot > 0 ? (0.8 * uFault) / (bFault * rTot) : undefined;
    res.lmax = Math.max(0, (0.8 * uFault) / (bFault * res.magnetic) - rUp) / worstRhoS;
  }
  return finish();
}

export function calcProject(project: Project): CircuitCalc[] {
  const out: CircuitCalc[] = [];
  for (const { node } of walk(project.roots)) if (isCircuit(node)) out.push(calcCircuit(node, project));
  return out;
}

/** Arrondi d'affichage (ne jamais comparer une valeur arrondie). */
export function roundTo(v: number | undefined, decimals: number): number | undefined {
  if (v === undefined) return undefined;
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}
