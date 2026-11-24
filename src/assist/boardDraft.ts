/**
 * Premier brouillon d'une installation EXISTANTE à partir de la lecture d'une photo de tableau (prototype de
 * l'assistant, premier parcours). Code déterministe : la lecture de l'IA (ou une saisie) devient des observations,
 * puis des propositions et des questions. Rien n'est appliqué ici.
 *
 * Fidélité (A2, A3, reconstruction) :
 *  - seules les valeurs lues sont proposées ; une valeur illisible reste ABSENTE et donne une question ;
 *  - aucune valeur par défaut (calibre, courbe, section…) ; aucune règle RGIE consultée ;
 *  - la structure (quel différentiel protège quel circuit) vient des étiquettes (« A-F ») ; à défaut, de la position
 *    sur le rail, signalée comme déduction incertaine (proposition critique + question) ;
 *  - l'usage d'un circuit vient de son étiquette (« PRISES CUISINE ») ; non reconnu : question, aucun point créé.
 */
import type { PropValue } from '../model/types';
import { circuitRefs, PROTECTION_KINDS, protectionFromReading, type PhotoDeviceT, type PhotoReadingT } from '../ai/boardPhoto';
import { evidenceId, type Observation, type Proposal, type Question } from './evidence';
import { interpretLabel } from './labels';

export const CONFIDENCE = { high: 0.9, medium: 0.7, low: 0.4 } as const;

export interface BoardDraft {
  batch: string;
  observations: Observation[];
  proposals: Proposal[];
  questions: Question[];
  summary: { devices: number; protections: number; rcds: number; circuits: number; unknownUsage: number; questions: number };
}

interface Seen {
  d: PhotoDeviceT;
  row: number;
  key: string;
  obs: Observation;
  conf: number;
  tempKey?: string;
}

const isRcdOnly = (d: PhotoDeviceT) => d.kind === 'rcd';
const isCircuitProtection = (d: PhotoDeviceT) => d.kind === 'mcb' || d.kind === 'rcbo' || d.kind === 'fuse';

export function boardDraft(opts: {
  reading: PhotoReadingT;
  boardId: string;
  sourceId: string;
  engine?: Observation['engine'];
  method?: Observation['method'];
  now?: string;
}): BoardDraft {
  const now = opts.now ?? new Date().toISOString();
  const batch = `photo:${opts.sourceId}:${now}`;
  const observations: Observation[] = [];
  const proposals: Proposal[] = [];
  const questions: Question[] = [];
  const method = opts.method ?? (opts.engine ? 'ai' : 'manual');

  const prop = (p: Omit<Proposal, 'id' | 'batch' | 'purpose' | 'status'>): Proposal => {
    const x: Proposal = { id: evidenceId('prp'), batch, purpose: 'reconstruction', status: 'pending', ...p };
    proposals.push(x);
    return x;
  };
  const ask = (q: Omit<Question, 'id' | 'status'>) => questions.push({ id: evidenceId('q'), status: 'open', ...q });

  // 1. Observations : une par appareil lu (cache vides ignorés)
  const seen: Seen[] = [];
  for (const r of [...opts.reading.rows].sort((a, b) => a.row - b.row))
    for (const d of [...r.devices].sort((a, b) => a.startModule - b.startModule)) {
      if (d.kind === 'blank') continue;
      const key = `r${r.row}m${d.startModule}`;
      const conf = CONFIDENCE[d.confidence] ?? CONFIDENCE.low;
      const f = (v: PropValue | null | undefined, raw?: string | null) => ({ value: v ?? null, confidence: v === null || v === undefined ? 0 : conf, ...(raw ? { raw } : {}) });
      const obs: Observation = {
        id: evidenceId('obs'),
        kind: 'reading',
        region: { sourceId: opts.sourceId, row: r.row, module: d.startModule, width: d.widthModules },
        method,
        ...(opts.engine ? { engine: opts.engine } : {}),
        at: now,
        subject: { kind: 'device', key },
        facts: {
          kind: f(d.kind),
          ratedCurrent: f(d.ratedCurrentA),
          curve: f(d.curve),
          residualCurrent: f(d.residualCurrentmA),
          rcdType: f(d.rcdType),
          poles: f(d.poles),
          label: f(d.label, d.label),
          circuitRef: f(d.circuitRef ?? null),
          reference: f([d.brand, d.model].filter(Boolean).join(' ') || null),
          modules: f(d.widthModules),
        },
      };
      observations.push(obs);
      seen.push({ d, row: r.row, key, obs, conf });
    }

  // 2. Protections : création (valeurs lues seulement) et place sur le rail
  for (const s of seen) {
    if (!PROTECTION_KINDS.has(s.d.kind)) continue;
    s.tempKey = 'p_' + s.key;
    const props = protectionFromReading(s.d);
    // Étiquette d'un différentiel = liste des circuits protégés, pas un nom de circuit
    if (isRcdOnly(s.d)) delete props.circuitName;
    const ref = (s.d.circuitRef ?? '').trim().toUpperCase();
    if (ref && isCircuitProtection(s.d)) props.fixedLetter = ref;
    s.obs.note = undefined;
    const parent = structureParent(s, seen);
    prop({
      change: { op: 'createNode', tempKey: s.tempKey, parent: parent.ref, kind: 'protection', props },
      basis: 'observed',
      confidence: Math.min(s.conf, parent.confidence),
      critical: s.d.kind === 'rcd' || s.d.kind === 'rcbo' || s.conf < 0.5 || parent.critical,
      observations: [s.obs.id, ...parent.observations],
      text: { key: 'assist.p.protection', params: { what: s.d.kind, where: `${s.row + 1}/${s.d.startModule + 1}`, label: s.d.label ?? '' } },
    });
    if (parent.question) ask({ ...parent.question, about: { tempKey: s.tempKey, prop: '@parent' } });
    prop({
      change: { op: 'place', target: { tempKey: s.tempKey }, boardId: opts.boardId, row: s.row, col: s.d.startModule },
      basis: 'observed',
      confidence: s.conf,
      critical: false,
      observations: [s.obs.id],
      text: { key: 'assist.p.place', params: { where: `${s.row + 1}/${s.d.startModule + 1}` } },
    });
    // Valeurs illisibles : questions (jamais de valeur par défaut)
    const label = s.d.label || ref || `${s.row + 1}/${s.d.startModule + 1}`;
    if (isCircuitProtection(s.d) && !s.d.ratedCurrentA) ask({ kind: 'unknown', about: { tempKey: s.tempKey, prop: 'ratedCurrent' }, text: { key: 'assist.q.ratedCurrent', params: { label } }, priority: 'high' });
    if ((s.d.kind === 'mcb' || s.d.kind === 'rcbo') && !s.d.curve) ask({ kind: 'unknown', about: { tempKey: s.tempKey, prop: 'curve' }, text: { key: 'assist.q.curve', params: { label } }, priority: 'normal' });
    if ((s.d.kind === 'rcd' || s.d.kind === 'rcbo') && !s.d.residualCurrentmA)
      ask({ kind: 'unknown', about: { tempKey: s.tempKey, prop: 'residualCurrent' }, text: { key: 'assist.q.residual', params: { label } }, priority: 'high' });
  }

  // 3. Circuits : câble (un disjoncteur alimente forcément une canalisation) et usage d'après l'étiquette
  let circuits = 0;
  let unknownUsage = 0;
  for (const s of seen) {
    if (!s.tempKey || !isCircuitProtection(s.d)) continue;
    circuits++;
    const it = interpretLabel(s.d.label);
    const label = s.d.label || s.d.circuitRef || `${s.row + 1}/${s.d.startModule + 1}`;
    const cableKey = 'c_' + s.key;
    prop({
      change: { op: 'createNode', tempKey: cableKey, parent: { tempKey: s.tempKey }, kind: 'cable', props: {} },
      basis: 'deduced',
      confidence: 0.9,
      critical: false,
      observations: [s.obs.id],
      text: { key: 'assist.p.cable', params: { label } },
    });
    ask({ kind: 'unknown', about: { tempKey: cableKey, prop: 'section' }, text: { key: 'assist.q.section', params: { label } }, priority: 'normal' });
    if (!it.usage) {
      unknownUsage++;
      ask({ kind: 'choice', about: { tempKey: s.tempKey, prop: '@usage' }, text: { key: 'assist.q.usage', params: { label } }, priority: 'normal' });
      continue;
    }
    const interp: Observation = {
      id: evidenceId('obs'),
      kind: 'interpretation',
      region: s.obs.region,
      method: 'deterministic',
      at: now,
      subject: { kind: 'circuit', key: s.key },
      facts: { usage: { value: it.usage.kind === 'appliance' ? it.usage.applianceType : it.usage.kind, confidence: 0.6, raw: it.matched.join(' ') }, ...(it.room ? { room: { value: it.room, confidence: 0.6 } } : {}) },
      refs: [s.obs.id],
    };
    observations.push(interp);
    const kind = it.usage.kind;
    const props: Record<string, PropValue> = kind === 'appliance' ? { applianceType: it.usage.applianceType } : kind === 'board' ? { name: s.d.label ?? '' } : {};
    prop({
      change: { op: 'createNode', tempKey: 'u_' + s.key, parent: { tempKey: cableKey }, kind, props, ...(it.room ? { location: it.room } : {}) },
      basis: 'deduced',
      confidence: 0.6,
      critical: false,
      observations: [s.obs.id, interp.id],
      text: { key: 'assist.p.usage', params: { label, usage: kind === 'appliance' ? it.usage.applianceType : kind, room: it.room ?? '' } },
    });
  }

  // 4. Appareils lus sans emplacement connu dans l'arbre (télérupteur, parafoudre…) : signalés, pas inventés
  for (const s of seen)
    if (!PROTECTION_KINDS.has(s.d.kind))
      ask({ kind: 'confirm', about: {}, text: { key: 'assist.q.other', params: { what: s.d.kind, where: `${s.row + 1}/${s.d.startModule + 1}`, label: s.d.label ?? '' } }, priority: 'low' });

  const protections = seen.filter((s) => s.tempKey).length;
  return {
    batch,
    observations,
    proposals,
    questions,
    summary: { devices: seen.length, protections, rcds: seen.filter((s) => s.d.kind === 'rcd').length, circuits, unknownUsage, questions: questions.length },
  };
}

/**
 * Parent d'une protection dans l'arbre :
 *  - différentiel, disjoncteur différentiel ou interrupteur général : le tableau ;
 *  - disjoncteur : le différentiel dont l'étiquette cite son repère (« A-F ») ; à défaut, le différentiel le plus
 *    proche à sa gauche sur la même rangée (déduction de position, incertaine) ; à défaut, le tableau avec une
 *    question « quel différentiel protège ce circuit ? ».
 */
function structureParent(
  s: Seen,
  all: Seen[],
): { ref: { tempKey: string } | { nodeId: string }; confidence: number; critical: boolean; observations: string[]; question?: Omit<Question, 'id' | 'status' | 'about'> } {
  const board = { nodeId: '__board__' };
  if (!isCircuitProtection(s.d) || s.d.kind === 'rcbo') return { ref: board, confidence: 1, critical: false, observations: [] };
  const rcds = all.filter((x) => isRcdOnly(x.d) && x.tempKey);
  const ref = (s.d.circuitRef ?? '').trim().toUpperCase();
  if (ref) {
    const byLabel = rcds.filter((x) => x.d.label && circuitRefs(x.d.label).has(ref));
    if (byLabel.length === 1) return { ref: { tempKey: byLabel[0].tempKey! }, confidence: 0.8, critical: false, observations: [byLabel[0].obs.id] };
  }
  const label = s.d.label || ref || `${s.row + 1}/${s.d.startModule + 1}`;
  const left = rcds.filter((x) => x.row === s.row && x.d.startModule < s.d.startModule).sort((a, b) => b.d.startModule - a.d.startModule)[0];
  if (left)
    return {
      ref: { tempKey: left.tempKey! },
      confidence: 0.5,
      critical: true,
      observations: [left.obs.id],
      question: { kind: 'confirm', text: { key: 'assist.q.parentByPosition', params: { label, rcd: left.d.label ?? `${left.row + 1}/${left.d.startModule + 1}` } }, priority: 'high' },
    };
  return {
    ref: board,
    confidence: 0.3,
    critical: true,
    observations: [],
    question: { kind: 'unknown', text: { key: 'assist.q.parentUnknown', params: { label } }, priority: 'high' },
  };
}

/** Le tableau visé : les propositions écrites avec « __board__ » sont rattachées au nœud réel. */
export function bindBoard(d: BoardDraft, boardId: string): BoardDraft {
  const fix = <T>(v: T): T => JSON.parse(JSON.stringify(v).split('"__board__"').join(JSON.stringify(boardId))) as T;
  return { ...d, proposals: fix(d.proposals) };
}
