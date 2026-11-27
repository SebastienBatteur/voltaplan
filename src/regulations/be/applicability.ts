/**
 * Applicabilité et données nécessaires de chaque exigence du registre belge (src/regulations/evaluate.ts). Quand aucun
 * constat du moteur ne concerne une exigence, ces contrôles disent si elle est non applicable, si les données manquent
 * (jamais « satisfaite » par défaut) ou si elle est satisfaite. Une exigence sans contrôle ici est « données
 * insuffisantes » (la CI exige un contrôle pour chaque exigence du registre).
 */
import type { ElNode, Project } from '../../model/types';
import { circuitContent, isCircuit, isRcd, walk } from '../../model/tree';
import type { ApplicabilityCheck } from '../evaluate';

const nodes = (p: Project): ElNode[] => [...walk(p.roots)].map((w) => w.node);
const kinds = (p: Project, ...k: string[]) => nodes(p).filter((x) => k.includes(x.kind));
const has = (p: Project, ...k: string[]) => kinds(p, ...k).length > 0;
const filled = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== '';
const yes = (b: boolean): 'yes' | 'no' => (b ? 'yes' : 'no');
const circuits = (p: Project) => nodes(p).filter(isCircuit);
const rcds = (p: Project) => nodes(p).filter(isRcd);
const protections = (p: Project) => kinds(p, 'protection');
const cables = (p: Project) => kinds(p, 'cable');
const appliances = (p: Project) => kinds(p, 'appliance');
const always = { applies: () => 'yes' as const, hasData: () => true };

export const CHECKS: Record<string, ApplicabilityCheck> = {
  'BE-TOOL-RULESET': always,
  'BE-TOOL-EDITION': { applies: () => 'yes', hasData: (p) => p.meta.installationKind === 'new' || filled(p.meta.installationDate) },
  'BE-DOC-MENTIONS': always,
  'BE-DOC-SCHEMA-CONTENT': { applies: (p) => yes(has(p, 'protection', 'cable')), hasData: () => true },
  'BE-DOC-BREAKING-CAPACITY': { applies: (p) => yes(protections(p).some((x) => x.props.device !== 'rcd' && x.props.device !== 'switch')), hasData: () => true },
  'BE-DOC-CIRCUIT-NAME': { applies: (p) => yes(circuits(p).length > 0), hasData: () => true },
  'BE-MEASUREMENTS': always,
  'BE-EARTH-ELECTRODE': always,
  'BE-EARTH-RESISTANCE': { applies: () => 'yes', hasData: (p) => p.measurements.earthResistanceOhm !== undefined },
  // Ne s'applique qu'au-delà de 30 Ω ; sans mesure, on ne sait pas.
  'BE-EARTH-ABOVE-30': {
    applies: (p) => (p.measurements.earthResistanceOhm === undefined ? 'unknown' : yes(p.measurements.earthResistanceOhm > 30)),
    hasData: (p) => rcds(p).every((r) => filled(r.props.residualCurrent)),
  },
  'BE-INSULATION': { applies: () => 'yes', hasData: (p) => p.measurements.insulationMOhm !== undefined },
  'BE-BONDING': { applies: () => 'yes', hasData: (p) => p.measurements.bondingOk !== undefined },
  'BE-RCD-TESTS': { applies: (p) => yes(rcds(p).length > 0), hasData: (p) => rcds(p).every((r) => p.measurements.rcdTests?.[r.id] !== undefined) },
  'BE-RCD-TRIP-TIME': { applies: (p) => yes(rcds(p).length > 0), hasData: (p) => rcds(p).every((r) => p.measurements.rcdTests?.[r.id]?.tripMs !== undefined) },
  'BE-WETROOM-HINT': { applies: (p) => yes(circuits(p).length > 0), hasData: () => true },
  'BE-EV-CHARGER': { applies: (p) => yes(appliances(p).some((a) => a.props.applianceType === 'evCharger')), hasData: () => true },
  'BE-PV': { applies: (p) => yes(has(p, 'solarPanel') || kinds(p, 'inverter').some((i) => (i.props.inverterType ?? 'dcAc') === 'dcAc')), hasData: () => true },
  'BE-RCD-ORIGIN': { applies: (p) => yes(circuits(p).length > 0), hasData: (p) => rcds(p).every((r) => filled(r.props.residualCurrent)) },
  'BE-RCD-HIGH-SENSITIVITY': { applies: (p) => yes(circuits(p).length > 0), hasData: (p) => rcds(p).every((r) => filled(r.props.residualCurrent)) },
  'BE-RCD-HIGH-SENS-MAX-CIRCUITS': { applies: (p) => yes(rcds(p).some((r) => Number(r.props.residualCurrent) > 0 && Number(r.props.residualCurrent) <= 30)), hasData: () => true },
  'BE-RCD-TYPE-A': { applies: (p) => yes(rcds(p).length > 0), hasData: (p) => rcds(p).every((r) => filled(r.props.rcdType)) },
  'BE-RCD-HEAD-RATING': { applies: (p) => yes(rcds(p).length > 0), hasData: (p) => rcds(p).every((r) => filled(r.props.ratedCurrent)) },
  'BE-RCD-SELECTIVITY': { applies: (p) => yes(rcds(p).length > 1), hasData: (p) => rcds(p).every((r) => filled(r.props.residualCurrent)) },
  'BE-OVERCURRENT-CONDUCTORS': { applies: (p) => yes(protections(p).length > 0), hasData: (p) => filled(p.meta.supply) && protections(p).every((x) => filled(x.props.poles)) },
  'BE-OVERCURRENT-PRESENT': { applies: (p) => yes(cables(p).length > 0), hasData: (p) => protections(p).every((x) => filled(x.props.device)) },
  'BE-SECTION-RATING': {
    applies: (p) => yes(cables(p).length > 0),
    hasData: (p) => circuits(p).every((c) => filled(c.props.ratedCurrent) && circuitContent(c).filter((x) => x.kind === 'cable').every((x) => filled(x.props.section))),
  },
  'BE-SECTION-MIN': { applies: (p) => yes(cables(p).length > 0), hasData: (p) => cables(p).every((x) => filled(x.props.section)) },
  'BE-SOCKET-EARTH': { applies: (p) => yes(has(p, 'socket')), hasData: () => true },
  'BE-SOCKET-SHUTTERS': { applies: (p) => yes(has(p, 'socket')), hasData: () => true },
  'BE-SOCKET-CHILD-OLD': { applies: (p) => yes(has(p, 'socket') && p.meta.installationKind !== 'new'), hasData: () => true },
  'BE-SOCKETS-PER-CIRCUIT': { applies: (p) => yes(has(p, 'socket')), hasData: () => true },
  'BE-DEDICATED-CIRCUITS': { applies: (p) => yes(appliances(p).length > 0), hasData: () => true },
  // Calculs : ne s'appliquent qu'aux circuits dont les longueurs sont connues.
  'BE-VOLTAGE-DROP': { applies: (p) => yes(circuits(p).length > 0), hasData: (p) => cables(p).every((x) => filled(x.props.length)) },
  'BE-VOLTAGE-DROP-RATING': { applies: (p) => yes(circuits(p).length > 0), hasData: (p) => cables(p).every((x) => filled(x.props.length)) },
  'BE-SHORT-CIRCUIT-LMAX': { applies: (p) => yes(circuits(p).some((c) => c.props.device === 'mcb' || c.props.device === 'rcbo')), hasData: (p) => cables(p).every((x) => filled(x.props.length)) },
};
