/**
 * Calculs par circuit (fonctions pures, testées) : chute de tension et longueur maximale protégée
 * contre les courts-circuits. Méthode conventionnelle de la norme IEC 60364-5-52 / -4-43
 * (la même que les guides belges et français), utilisable sans logiciel de calcul :
 *
 *  - résistivité du cuivre à la température de service : ρ = 0,0225 Ω·mm²/m (0,036 pour l'aluminium) ;
 *  - chute de tension : ΔU = b · ρ · L · I / S, avec I = calibre de la protection (cas le plus défavorable),
 *    b = 2 en monophasé (230 V entre phase et neutre ou entre deux phases d'un réseau 3 × 230 V),
 *    b = √3 en triphasé ; ΔU % = 100 · ΔU / U ;
 *  - court-circuit minimal en bout de circuit (tension réduite à 80 % par l'amont) :
 *    Icc min = 0,8 · U / (b · ρ · L / S) ; il doit dépasser le seuil magnétique du disjoncteur
 *    (courbe B : 5 In, C : 10 In, D : 20 In), sinon la protection n'est pas garantie.
 *    Longueur maximale : Lmax = 0,8 · U · S / (b · ρ · Ia).
 *
 * L = longueur de canalisation entre la protection et le point le plus éloigné du circuit
 * (somme des longueurs des câbles sur ce trajet). Câble sans longueur : calcul impossible, signalé.
 */
import type { ElNode, Project } from '../model/types';
import { isCircuit, walk } from '../model/tree';

export const RHO_CU = 0.0225;
export const RHO_AL = 0.036;
/** Seuil de déclenchement magnétique, en multiples du calibre. */
export const MAGNETIC: Record<string, number> = { B: 5, C: 10, D: 20 };
/** Limites usuelles de chute de tension (IEC 60364-5-52, annexe G) : éclairage / autres usages. */
export const VDROP_LIMIT = { lighting: 3, other: 5 };

export interface CircuitCalc {
  circuitId: string;
  /** Longueur du trajet le plus long (m), si toutes les longueurs sont connues. */
  length?: number;
  /** Câbles du circuit sans longueur. */
  missingLength: number;
  /** Plus petite section sur le trajet (mm²). */
  section?: number;
  ratedCurrent?: number;
  voltage: number;
  threePhase: boolean;
  dropPct?: number;
  /** Limite applicable (%). */
  dropLimit: number;
  /** Icc minimal en bout de circuit (A) et seuil magnétique (A). */
  iccMin?: number;
  magnetic?: number;
  /** Longueur maximale protégée (m). */
  lmax?: number;
}

function num(v: unknown): number | undefined {
  const x = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(x) && x > 0 ? x : undefined;
}

/** Trajets protection → extrémités : liste des câbles sur chaque trajet (sans descendre dans un sous-tableau). */
function paths(circuit: ElNode): ElNode[][] {
  const out: ElNode[][] = [];
  const rec = (n: ElNode, acc: ElNode[]) => {
    const kids = n.children.filter((c) => c.kind !== 'board' && !(c.kind === 'protection'));
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

export function calcCircuit(circuit: ElNode, project: Project): CircuitCalc {
  const supply = String(project.meta.supply ?? '');
  const threePhaseNet400 = /3\s*[x×]\s*400|400\s*V|3N/i.test(supply);
  const poles = String(circuit.props.poles ?? '');
  const threePhase = poles.startsWith('3') || poles.startsWith('4');
  const voltage = threePhase ? (threePhaseNet400 ? 400 : 230) : 230;
  const b = threePhase ? Math.sqrt(3) : 2;
  const content = [...walk(circuit.children)].map((w) => w.node);
  const lighting = content.some((c) => c.kind === 'light') && !content.some((c) => c.kind === 'socket' || c.kind === 'appliance');
  const res: CircuitCalc = {
    circuitId: circuit.id,
    missingLength: content.filter((c) => c.kind === 'cable' && !num(c.props.length)).length,
    voltage,
    threePhase,
    dropLimit: lighting ? VDROP_LIMIT.lighting : VDROP_LIMIT.other,
    ratedCurrent: num(circuit.props.ratedCurrent),
  };
  const sections = content.filter((c) => c.kind === 'cable').map((c) => num(c.props.section)).filter((s): s is number => s !== undefined);
  if (sections.length) res.section = Math.min(...sections);
  const ps = paths(circuit);
  if (!ps.length || res.missingLength) return res;
  // Trajet le plus défavorable : plus grande somme L/S (et longueur correspondante)
  let worst = { rl: 0, len: 0, s: Infinity };
  for (const p of ps) {
    let rl = 0;
    let len = 0;
    let s = Infinity;
    for (const c of p) {
      const L = num(c.props.length) ?? 0;
      const S = num(c.props.section);
      if (!S) return res;
      const rho = RHO_CU; // canalisations en cuivre (l'aluminium n'est pas encore distingué dans le modèle)
      rl += (rho * L) / S;
      len += L;
      s = Math.min(s, S);
    }
    if (rl > worst.rl) worst = { rl, len, s };
  }
  res.length = Math.round(worst.len * 10) / 10;
  const I = res.ratedCurrent;
  if (I) res.dropPct = Math.round(((100 * b * worst.rl * I) / voltage) * 100) / 100;
  const curve = String(circuit.props.curve ?? '').toUpperCase();
  const device = String(circuit.props.device ?? 'mcb');
  if (I && MAGNETIC[curve] && (device === 'mcb' || device === 'rcbo')) {
    res.magnetic = MAGNETIC[curve] * I;
    res.iccMin = worst.rl > 0 ? Math.round((0.8 * voltage) / (b * worst.rl)) : undefined;
    res.lmax = Math.round(((0.8 * voltage * worst.s) / (b * RHO_CU * res.magnetic)) * 10) / 10;
  }
  return res;
}

export function calcProject(project: Project): CircuitCalc[] {
  const out: CircuitCalc[] = [];
  for (const { node } of walk(project.roots)) if (isCircuit(node)) out.push(calcCircuit(node, project));
  return out;
}
