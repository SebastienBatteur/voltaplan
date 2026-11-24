/**
 * Brouillon d'une installation EXISTANTE à partir des lectures de photos d'un tableau (assistant de relevé). Code
 * déterministe : chaque lecture (IA ou saisie) devient des observations, une par appareil et par photo ; la fusion
 * regroupe les observations d'un même appareil vu sur plusieurs photos, puis produit propositions et questions.
 * Rien n'est appliqué ici.
 *
 * Fidélité (A2, A3, reconstruction) :
 *  - seules les valeurs lues sont proposées ; une valeur illisible reste ABSENTE et donne une question ;
 *  - aucune valeur par défaut (calibre, courbe, section…) ; aucune règle RGIE consultée ;
 *  - deux photos d'accord : la certitude augmente ; en désaccord : AUCUNE valeur proposée et UNE question de
 *    contradiction, avec une option sourcée par valeur lue ;
 *  - la structure (quel différentiel protège quel circuit) vient des étiquettes (« A-F ») ; à défaut, de la position
 *    sur le rail, signalée comme déduction incertaine (proposition critique + question) ;
 *  - l'usage d'un circuit vient de son étiquette (« PRISES CUISINE ») ; non reconnu : question, aucun point créé.
 */
import type { PropValue } from '../model/types';
import { circuitRefs, PROTECTION_KINDS, protectionFromReading, type PhotoDeviceT, type PhotoKind, type PhotoReadingT } from '../ai/boardPhoto';
import { evidenceId, type Observation, type Proposal, type Question } from './evidence';
import { interpretLabel, normLabel, usageKey } from './labels';

export const CONFIDENCE = { high: 0.9, medium: 0.7, low: 0.4 } as const;
/** Plafond de certitude après accord de plusieurs photos : seule l'utilisateur rend une valeur « confirmée ». */
export const MAX_FUSED_CONFIDENCE = 0.97;

export interface BoardDraft {
  batch: string;
  /** Observations nouvelles (lectures, interprétations, contradictions) à ajouter au dossier. */
  observations: Observation[];
  proposals: Proposal[];
  questions: Question[];
  summary: {
    devices: number;
    protections: number;
    rcds: number;
    circuits: number;
    unknownUsage: number;
    questions: number;
    /** Appareils non protecteurs vus (télérupteurs, parafoudres…), non ajoutés au schéma. */
    others: number;
    /** Faits sur lesquels deux photos ne sont pas d'accord. */
    contradictions: number;
    /** Photos prises en compte. */
    sources: number;
  };
}

/** Faits lus par appareil et propriété correspondante de l'arbre. */
export const FACT_PROP: Record<string, string> = {
  kind: 'device',
  ratedCurrent: 'ratedCurrent',
  curve: 'curve',
  residualCurrent: 'residualCurrent',
  rcdType: 'rcdType',
  poles: 'poles',
  label: 'circuitName',
  circuitRef: 'fixedLetter',
  reference: 'reference',
  modules: 'modules',
};
const FACTS = Object.keys(FACT_PROP);

const isRcdOnly = (d: PhotoDeviceT) => d.kind === 'rcd';
const isCircuitProtection = (d: PhotoDeviceT) => d.kind === 'mcb' || d.kind === 'rcbo' || d.kind === 'fuse';
const where = (row: number, module: number) => `${row + 1}/${module + 1}`;

/** Clés des objets proposés : stables d'une lecture à l'autre (position sur le rail) et propres au tableau. */
export const tempKeyOf = (prefix: 'p' | 'c' | 'u', key: string, boardId: string, i = 0) => `${prefix}_${key}${i ? '_' + i : ''}@${boardId}`;
/** Tableau d'une clé temporaire (« p_r0m2@<tableau> »). */
export const boardOfTempKey = (k: string) => (k.includes('@') ? k.slice(k.lastIndexOf('@') + 1) : undefined);

// ---------------------------------------------------------------------------
// 1. Observations : une lecture = une observation par appareil (cache vides ignorés)
// ---------------------------------------------------------------------------

export function observeReading(opts: {
  reading: PhotoReadingT;
  sourceId: string;
  boardId?: string;
  engine?: Observation['engine'];
  method?: Observation['method'];
  now?: string;
  /** Photo partielle : position de sa première rangée et de son premier module dans le tableau. */
  offset?: { row: number; module: number };
}): Observation[] {
  const now = opts.now ?? new Date().toISOString();
  const method = opts.method ?? (opts.engine ? 'ai' : 'manual');
  const dr = opts.offset?.row ?? 0;
  const dm = opts.offset?.module ?? 0;
  const out: Observation[] = [];
  for (const r of [...opts.reading.rows].sort((a, b) => a.row - b.row))
    for (const d of [...r.devices].sort((a, b) => a.startModule - b.startModule)) {
      if (d.kind === 'blank') continue;
      const row = r.row + dr;
      const module = d.startModule + dm;
      const conf = CONFIDENCE[d.confidence] ?? CONFIDENCE.low;
      const f = (v: PropValue | null | undefined, raw?: string | null) => ({ value: v ?? null, confidence: v === null || v === undefined || v === '' ? 0 : conf, ...(raw ? { raw } : {}) });
      out.push({
        id: evidenceId('obs'),
        kind: 'reading',
        region: { sourceId: opts.sourceId, row, module, width: d.widthModules },
        method,
        ...(opts.engine ? { engine: opts.engine } : {}),
        at: now,
        subject: { kind: 'device', key: `r${row}m${module}`, ...(opts.boardId ? { board: opts.boardId } : {}) },
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
      });
    }
  return out;
}

// ---------------------------------------------------------------------------
// 2. Fusion : un même appareil vu sur plusieurs photos
// ---------------------------------------------------------------------------

export interface FusedFact {
  value: PropValue | null;
  confidence: number;
  observations: string[];
}
export interface FusedDevice {
  /** Clé de position (« r0m4 »), celle de la première photo qui l'a vu. */
  key: string;
  row: number;
  start: number;
  width: number;
  obs: Observation[];
  /** Valeur fusionnée par fait (null : illisible partout, ou contradiction). */
  values: Record<string, FusedFact>;
  /** Faits en désaccord : une option par valeur lue, avec ses observations. */
  contradictions: { fact: string; options: { value: PropValue; observations: string[]; confidence: number }[] }[];
  /** Type retenu pour la structure (en cas de désaccord : le mieux appuyé, signalé critique). */
  kind: PhotoKind;
  /** Certitude de l'appareil (type et position). */
  conf: number;
  /** Deux appareils lus se chevauchent sur le rail (photos en désaccord sur les positions). */
  positionConflict: boolean;
}

/** Valeur comparable : étiquettes sans casse ni accents ni ponctuation ; pôles, courbe… en majuscules. */
function comparable(fact: string, v: PropValue): string {
  if (typeof v !== 'string') return String(v);
  return fact === 'label' || fact === 'reference' ? normLabel(v) : v.toUpperCase().replace(/\s+/g, '');
}
/** Accord de sources indépendantes : 1 − Π(1 − cᵢ), plafonné. */
const agree = (cs: number[]) => (cs.length === 1 ? cs[0] : Math.min(MAX_FUSED_CONFIDENCE, 1 - cs.reduce((p, c) => p * (1 - c), 1)));

/**
 * Regroupe les observations d'un même appareil. Les photos sont prises dans l'ordre (première photo d'abord) ; une
 * observation rejoint l'appareil d'une photo précédente sur la même rangée s'il commence au même module, ou s'ils se
 * recouvrent d'au moins la moitié du plus petit. Jamais deux observations d'une même photo dans un même appareil.
 */
export function fuseObservations(observations: Observation[]): FusedDevice[] {
  const readings = observations.filter((o) => o.kind === 'reading' && o.subject.kind === 'device');
  const order = [...new Set(readings.map((o) => o.region.sourceId))];
  type Cluster = { row: number; start: number; width: number; obs: Observation[]; sources: Set<string> };
  const clusters: Cluster[] = [];
  const span = (o: Observation) => ({ row: o.region.row ?? 0, start: o.region.module ?? 0, width: Math.max(1, Math.round(o.region.width ?? 1)) });
  for (const src of order) {
    const mine = readings.filter((o) => o.region.sourceId === src);
    const pairs: { o: Observation; c: Cluster; score: number }[] = [];
    for (const o of mine) {
      const s = span(o);
      for (const c of clusters) {
        if (c.row !== s.row) continue;
        const overlap = Math.min(c.start + c.width, s.start + s.width) - Math.max(c.start, s.start);
        if (c.start === s.start) pairs.push({ o, c, score: 100 + overlap });
        else if (overlap >= 0.5 * Math.min(c.width, s.width) && overlap > 0) pairs.push({ o, c, score: overlap });
      }
    }
    pairs.sort((a, b) => b.score - a.score);
    const placed = new Set<Observation>();
    const filled = new Set<Cluster>();
    for (const p of pairs) {
      if (placed.has(p.o) || filled.has(p.c)) continue;
      p.c.obs.push(p.o);
      p.c.sources.add(src);
      placed.add(p.o);
      filled.add(p.c);
    }
    for (const o of mine) if (!placed.has(o)) clusters.push({ ...span(o), obs: [o], sources: new Set([src]) });
  }
  clusters.sort((a, b) => a.row - b.row || a.start - b.start);

  return clusters.map((c): FusedDevice => {
    const values: Record<string, FusedFact> = {};
    const contradictions: FusedDevice['contradictions'] = [];
    for (const fact of FACTS) {
      const groups = new Map<string, { value: PropValue; observations: string[]; cs: number[] }>();
      for (const o of c.obs) {
        const f = o.facts[fact];
        if (!f || f.value === null || f.value === undefined || f.value === '') continue;
        const k = comparable(fact, f.value);
        const g = groups.get(k) ?? { value: f.value, observations: [], cs: [] };
        g.observations.push(o.id);
        g.cs.push(f.confidence);
        groups.set(k, g);
      }
      const list = [...groups.values()];
      if (!list.length) values[fact] = { value: null, confidence: 0, observations: [] };
      else if (list.length === 1) values[fact] = { value: list[0].value, confidence: agree(list[0].cs), observations: list[0].observations };
      else {
        values[fact] = { value: null, confidence: 0, observations: list.flatMap((g) => g.observations) };
        contradictions.push({ fact, options: list.map((g) => ({ value: g.value, observations: g.observations, confidence: Math.max(...g.cs) })) });
      }
    }
    // Type : retenu tel quel si les photos sont d'accord ; sinon le mieux appuyé, avec une certitude basse
    const kindC = contradictions.find((x) => x.fact === 'kind');
    const kind = (kindC ? [...kindC.options].sort((a, b) => b.observations.length - a.observations.length || b.confidence - a.confidence)[0].value : values.kind.value ?? 'other') as PhotoKind;
    let conf = kindC ? CONFIDENCE.low : values.kind.confidence || CONFIDENCE.low;
    const width = typeof values.modules.value === 'number' && values.modules.value > 0 ? Math.round(values.modules.value) : c.width;
    if (contradictions.some((x) => x.fact === 'modules')) conf = Math.min(conf, CONFIDENCE.medium);
    return { key: `r${c.row}m${c.start}`, row: c.row, start: c.start, width, obs: c.obs, values, contradictions, kind, conf, positionConflict: false };
  }).map((d, _i, all) => {
    // Chevauchement entre deux appareils retenus (photos en désaccord sur les positions) : à voir individuellement
    const clash = all.some((o) => o !== d && o.row === d.row && Math.min(o.start + o.width, d.start + d.width) > Math.max(o.start, d.start));
    return clash ? { ...d, positionConflict: true, conf: Math.min(d.conf, CONFIDENCE.low) } : d;
  });
}

/** Lecture équivalente à un appareil fusionné (valeurs en désaccord : absentes). */
function synth(f: FusedDevice): PhotoDeviceT {
  const v = (k: string) => f.values[k]?.value ?? null;
  const num = (k: string) => (typeof v(k) === 'number' ? (v(k) as number) : null);
  const str = (k: string) => (v(k) === null ? null : String(v(k)));
  return {
    startModule: f.start,
    widthModules: f.width,
    kind: f.kind,
    brand: null,
    model: str('reference'),
    poles: str('poles'),
    ratedCurrentA: num('ratedCurrent'),
    curve: str('curve'),
    residualCurrentmA: num('residualCurrent'),
    rcdType: str('rcdType'),
    label: str('label'),
    circuitRef: str('circuitRef'),
    confidence: f.conf >= 0.85 ? 'high' : f.conf >= 0.6 ? 'medium' : 'low',
  };
}

// ---------------------------------------------------------------------------
// 3. Propositions et questions
// ---------------------------------------------------------------------------

/** Ce qui existe déjà pour ce tableau (lectures précédentes acceptées, questions déjà posées). */
export interface ExistingBoard {
  /** Nœuds créés par une proposition acceptée : clé temporaire → nœud (propriétés actuelles, propriétés confirmées). */
  nodes: Map<string, { id: string; props: Record<string, PropValue>; confirmed: Set<string> }>;
  /** Questions déjà posées : « cible|propriété » (cible = clé temporaire ou nœud). Jamais reposées. */
  asked: Set<string>;
}

interface Seen {
  f: FusedDevice;
  d: PhotoDeviceT;
  row: number;
  key: string;
  obsIds: string[];
  conf: number;
  tempKey?: string;
  /** Nœud déjà créé par une lecture précédente. */
  node?: { id: string; props: Record<string, PropValue>; confirmed: Set<string> };
}

const empty = (v: PropValue | null | undefined) => v === undefined || v === null || v === '';

/**
 * Propositions et questions d'un tableau à partir de TOUTES ses lectures (une ou plusieurs photos). Les clés des
 * objets proposés sont stables : une nouvelle photo remplace les propositions en attente sans doublon, et ne repropose
 * pas ce qui a déjà été accepté (elle complète seulement ce qui manque).
 */
export function draftFromObservations(opts: {
  observations: Observation[];
  boardId: string;
  now?: string;
  existing?: ExistingBoard;
}): BoardDraft {
  const now = opts.now ?? new Date().toISOString();
  const B = opts.boardId;
  const batch = `photo:${B}:${now}`;
  const observations: Observation[] = [];
  const proposals: Proposal[] = [];
  const questions: Question[] = [];
  const existing = opts.existing ?? { nodes: new Map(), asked: new Set() };
  const asked = (target: { tempKey?: string; nodeId?: string }, prop: string) =>
    (!!target.tempKey && existing.asked.has(`${target.tempKey}|${prop}`)) || (!!target.nodeId && existing.asked.has(`${target.nodeId}|${prop}`));

  const prop = (p: Omit<Proposal, 'id' | 'batch' | 'purpose' | 'status'>): Proposal => {
    const x: Proposal = { id: evidenceId('prp'), batch, purpose: 'reconstruction', status: 'pending', ...p };
    proposals.push(x);
    return x;
  };
  // Une question par fait inconnu : jamais deux fois la même (cible, propriété), ni une question déjà posée
  const qKeys = new Set<string>();
  const ask = (q: Omit<Question, 'id' | 'status'>) => {
    const target = q.about.nodeId ?? q.about.tempKey ?? '';
    const k = `${target}|${q.about.prop ?? q.text.key}`;
    if (target && (qKeys.has(k) || asked({ tempKey: q.about.tempKey, nodeId: q.about.nodeId }, q.about.prop ?? q.text.key))) return;
    qKeys.add(k);
    questions.push({ id: evidenceId('q'), status: 'open', ...q });
  };

  const fused = fuseObservations(opts.observations);
  const seen: Seen[] = fused
    .filter((f) => f.kind !== 'blank')
    .map((f) => ({ f, d: synth(f), row: f.row, key: f.key, obsIds: f.obs.map((o) => o.id), conf: f.conf }));
  const sources = new Set(opts.observations.filter((o) => o.kind === 'reading').map((o) => o.region.sourceId)).size;

  // Contradictions : tracées comme observations (déterministes), puis une seule question par fait
  for (const s of seen)
    for (const c of s.f.contradictions)
      observations.push({
        id: evidenceId('obs'),
        kind: 'contradiction',
        region: { ...s.f.obs[0].region },
        method: 'deterministic',
        at: now,
        subject: { kind: 'device', key: s.key, board: B },
        facts: { [c.fact]: { value: null, confidence: 0 } },
        refs: c.options.flatMap((o) => o.observations),
        note: c.fact,
      });

  // Protections : création (valeurs lues seulement) et place sur le rail
  for (const s of seen) {
    if (!PROTECTION_KINDS.has(s.d.kind)) continue;
    s.tempKey = tempKeyOf('p', s.key, B);
    s.node = existing.nodes.get(s.tempKey);
    const props = protectionFromReading(s.d);
    // Étiquette d'un différentiel = liste des circuits protégés, pas un nom de circuit
    if (isRcdOnly(s.d)) delete props.circuitName;
    const ref = (s.d.circuitRef ?? '').trim().toUpperCase();
    if (ref && isCircuitProtection(s.d)) props.fixedLetter = ref;
    // Type en désaccord : le type retenu sert à la structure, mais sa valeur est demandée (question ci-dessous)
    const label = s.d.label || ref || where(s.row, s.d.startModule);
    const target = s.node ? { nodeId: s.node.id } : { tempKey: s.tempKey };
    let createId: string | undefined;
    if (s.node) {
      // Déjà créé par une lecture précédente : seulement ce qui manque, et les désaccords avec l'arbre
      for (const [k, v] of Object.entries(props)) {
        if (k === 'device' || k === 'modules') continue;
        const cur = s.node.props[k];
        if (empty(cur))
          prop({
            change: { op: 'setProp', target: { nodeId: s.node.id }, prop: k, value: v },
            basis: 'observed',
            confidence: s.conf,
            critical: false,
            observations: s.obsIds,
            text: { key: 'assist.p.setProp', params: { label, prop: k, value: String(v) } },
          });
        else if (comparable(k, cur!) !== comparable(k, v) && !s.node.confirmed.has(k))
          ask({
            kind: 'contradiction',
            about: { nodeId: s.node.id, prop: k },
            text: { key: 'assist.q.contradiction', params: { label, prop: k } },
            options: [
              { value: cur, observations: [], label: 'current' },
              { value: v, observations: s.obsIds },
            ],
            priority: k === 'ratedCurrent' || k === 'residualCurrent' ? 'high' : 'normal',
          });
      }
    } else {
      const parent = structureParent(s, seen, B);
      const critical = s.d.kind === 'rcd' || s.d.kind === 'rcbo' || s.conf < 0.5 || parent.critical || s.f.positionConflict || s.f.contradictions.some((c) => c.fact === 'kind');
      createId = prop({
        change: { op: 'createNode', tempKey: s.tempKey, parent: parent.ref, kind: 'protection', props },
        basis: 'observed',
        confidence: Math.min(s.conf, parent.confidence),
        critical,
        observations: [...s.obsIds, ...parent.observations],
        text: { key: 'assist.p.protection', params: { what: s.d.kind, where: where(s.row, s.d.startModule), label: s.d.label ?? '' } },
      }).id;
      // Raccordement deviné : question liée à la proposition (close d'office si l'utilisateur la vérifie une par une)
      if (parent.question) ask({ ...parent.question, about: { tempKey: s.tempKey, prop: '@parent', proposalId: createId } });
      prop({
        change: { op: 'place', target: { tempKey: s.tempKey }, boardId: B, row: s.row, col: s.d.startModule },
        basis: 'observed',
        confidence: s.conf,
        critical: false,
        observations: s.obsIds,
        text: { key: 'assist.p.place', params: { where: where(s.row, s.d.startModule) } },
      });
    }
    // Désaccords entre photos : UNE question par fait, options sourcées (la référence lue ne change pas le dossier)
    for (const c of s.f.contradictions) {
      if (c.fact === 'reference' || (c.fact === 'label' && isRcdOnly(s.d))) continue;
      if (c.fact === 'circuitRef' && !isCircuitProtection(s.d)) continue;
      ask({
        kind: 'contradiction',
        about: { ...target, prop: FACT_PROP[c.fact] },
        text: { key: 'assist.q.contradiction', params: { label, prop: FACT_PROP[c.fact] } },
        options: c.options.map((o) => ({ value: o.value, observations: o.observations })),
        priority: c.fact === 'kind' || c.fact === 'ratedCurrent' || c.fact === 'residualCurrent' ? 'high' : c.fact === 'modules' ? 'low' : 'normal',
      });
    }
    // Valeurs illisibles partout : questions (jamais de valeur par défaut) ; rien à demander si l'arbre l'a déjà
    const contradicted = new Set(s.f.contradictions.map((c) => FACT_PROP[c.fact]));
    const missing = (p: string) => !contradicted.has(p) && empty(props[p]) && (!s.node || empty(s.node.props[p]));
    if (isCircuitProtection(s.d) && missing('ratedCurrent')) ask({ kind: 'unknown', about: { ...target, prop: 'ratedCurrent' }, text: { key: 'assist.q.ratedCurrent', params: { label } }, priority: 'high' });
    if ((s.d.kind === 'mcb' || s.d.kind === 'rcbo') && missing('curve')) ask({ kind: 'unknown', about: { ...target, prop: 'curve' }, text: { key: 'assist.q.curve', params: { label } }, priority: 'normal' });
    if ((s.d.kind === 'rcd' || s.d.kind === 'rcbo') && missing('residualCurrent'))
      ask({ kind: 'unknown', about: { ...target, prop: 'residualCurrent' }, text: { key: 'assist.q.residual', params: { label } }, priority: 'high' });
  }

  // Circuits : câble (un disjoncteur alimente forcément une canalisation) et usage(s) d'après l'étiquette
  let circuits = 0;
  let unknownUsage = 0;
  const sectionGroups = new Map<string, { usage: string; members: { tempKey?: string; nodeId?: string; label: string }[] }>();
  for (const s of seen) {
    if (!s.tempKey || !isCircuitProtection(s.d)) continue;
    const it = interpretLabel(s.d.label);
    // « Général » (appareil de tête) et « Réserve » : rien n'est supposé en aval, aucune question inutile
    if (it.main || it.spare) continue;
    circuits++;
    const label = s.d.label || s.d.circuitRef || where(s.row, s.d.startModule);
    const cableKey = tempKeyOf('c', s.key, B);
    const cableNode = existing.nodes.get(cableKey);
    if (!cableNode)
      prop({
        change: { op: 'createNode', tempKey: cableKey, parent: s.node ? { nodeId: s.node.id } : { tempKey: s.tempKey }, kind: 'cable', props: {} },
        basis: 'deduced',
        confidence: 0.9,
        critical: false,
        observations: s.obsIds,
        text: { key: 'assist.p.cable', params: { label } },
      });
    // Section : regroupée par usage (une seule question pour tous les circuits de prises), sinon une par circuit
    if (!cableNode || empty(cableNode.props.section)) {
      const target = cableNode ? { nodeId: cableNode.id } : { tempKey: cableKey };
      if (!asked(target, 'section')) {
        const g = it.usages.length === 1 ? usageKey(it.usages[0]) : '';
        const entry = sectionGroups.get(g || cableKey) ?? { usage: g, members: [] };
        entry.members.push({ ...target, label });
        sectionGroups.set(g || cableKey, entry);
      }
    }
    if (!it.usages.length) {
      unknownUsage++;
      // Usage déjà connu (point créé par une réponse ou une lecture précédente) : pas de question
      if (!existing.nodes.has(tempKeyOf('u', s.key, B)))
        ask({ kind: 'choice', about: { ...(s.node ? { nodeId: s.node.id } : { tempKey: s.tempKey }), prop: '@usage' }, text: { key: 'assist.q.usage', params: { label } }, priority: 'normal' });
      continue;
    }
    const interp: Observation = {
      id: evidenceId('obs'),
      kind: 'interpretation',
      region: s.f.obs[0].region,
      method: 'deterministic',
      at: now,
      subject: { kind: 'circuit', key: s.key, board: B },
      facts: {
        usage: { value: it.usages.map(usageKey).join(' + '), confidence: 0.6, raw: it.matched.join(' ') },
        ...(it.rooms.length ? { room: { value: it.rooms.join(', '), confidence: it.room ? 0.6 : 0.3 } } : {}),
      },
      refs: s.obsIds,
    };
    observations.push(interp);
    it.usages.forEach((u, i) => {
      const uKey = tempKeyOf('u', s.key, B, i);
      if (existing.nodes.has(uKey)) return;
      const kind = u.kind;
      const props: Record<string, PropValue> = kind === 'appliance' ? { applianceType: u.applianceType } : kind === 'board' ? { name: s.d.label ?? '' } : {};
      prop({
        change: { op: 'createNode', tempKey: uKey, parent: cableNode ? { nodeId: cableNode.id } : { tempKey: cableKey }, kind, props, ...(it.room ? { location: it.room } : {}) },
        basis: 'deduced',
        confidence: 0.6,
        // Sous-tableau : structure de l'installation, à voir individuellement
        critical: kind === 'board',
        observations: [...s.obsIds, interp.id],
        text: { key: kind === 'board' ? 'assist.p.subBoard' : 'assist.p.usage', params: { label, usage: kind === 'appliance' ? u.applianceType : kind, room: it.rooms.join(', ') } },
      });
    });
  }
  // Questions de section : groupées dès que deux circuits ont le même usage
  for (const g of sectionGroups.values()) {
    if (g.members.length >= 2 && g.usage)
      ask({
        kind: 'choice',
        about: { prop: 'section' },
        members: g.members,
        text: { key: 'assist.q.sectionGroup', params: { usage: g.usage.replace(/^appliance:/, ''), n: g.members.length } },
        options: sectionChoices(g.usage).map((v) => ({ value: v, observations: [] })),
        priority: 'normal',
      });
    else for (const m of g.members) ask({ kind: 'unknown', about: { tempKey: m.tempKey, nodeId: m.nodeId, prop: 'section' }, text: { key: 'assist.q.section', params: { label: m.label } }, priority: 'normal' });
  }

  // Appareils non protecteurs (télérupteur, parafoudre…) : gardés comme observations, signalés dans le résumé ; pas
  // de question (la réponse ne changerait rien au dossier tant que leur raccordement est inconnu)
  const others = seen.filter((s) => !PROTECTION_KINDS.has(s.d.kind)).length;
  return {
    batch,
    observations,
    proposals,
    questions,
    summary: {
      devices: seen.length,
      protections: seen.filter((s) => s.tempKey).length,
      rcds: seen.filter((s) => s.d.kind === 'rcd').length,
      circuits,
      unknownUsage,
      questions: questions.length,
      others,
      contradictions: seen.reduce((n, s) => n + s.f.contradictions.length, 0),
      sources,
    },
  };
}

/** Sections courantes proposées comme boutons (jamais appliquées sans réponse) ; la plus fréquente d'abord. */
export function sectionChoices(usage: string): number[] {
  if (usage === 'light') return [1.5, 2.5];
  if (usage === 'socket') return [2.5, 4];
  return [2.5, 4, 6];
}

/** Brouillon d'UNE lecture (une photo) : observations + propositions et questions. */
export function boardDraft(opts: {
  reading: PhotoReadingT;
  boardId: string;
  sourceId: string;
  engine?: Observation['engine'];
  method?: Observation['method'];
  now?: string;
  offset?: { row: number; module: number };
}): BoardDraft {
  const readings = observeReading(opts);
  const d = draftFromObservations({ observations: readings, boardId: opts.boardId, now: opts.now });
  return { ...d, observations: [...readings, ...d.observations] };
}

/**
 * Parent d'une protection dans l'arbre :
 *  - différentiel, disjoncteur différentiel ou interrupteur général : le tableau ;
 *  - disjoncteur : le différentiel dont l'étiquette cite son repère (« A-F ») ; à défaut, le différentiel le plus
 *    proche à sa gauche sur la même rangée (déduction de position, incertaine) ; à défaut, le tableau avec une
 *    question « quel différentiel protège ce circuit ? ».
 * Un différentiel déjà créé par une lecture précédente est désigné par son nœud.
 */
function structureParent(
  s: Seen,
  all: Seen[],
  boardId: string,
): { ref: { tempKey: string } | { nodeId: string }; confidence: number; critical: boolean; observations: string[]; question?: Omit<Question, 'id' | 'status' | 'about'> } {
  const board = { nodeId: boardId };
  if (!isCircuitProtection(s.d) || s.d.kind === 'rcbo') return { ref: board, confidence: 1, critical: false, observations: [] };
  const rcds = all.filter((x) => isRcdOnly(x.d) && x.tempKey);
  const refOf = (x: Seen) => (x.node ? { nodeId: x.node.id } : { tempKey: x.tempKey! });
  const ref = (s.d.circuitRef ?? '').trim().toUpperCase();
  if (ref) {
    const byLabel = rcds.filter((x) => x.d.label && circuitRefs(x.d.label).has(ref));
    if (byLabel.length === 1) return { ref: refOf(byLabel[0]), confidence: 0.8, critical: false, observations: byLabel[0].obsIds };
  }
  const label = s.d.label || ref || where(s.row, s.d.startModule);
  const left = rcds.filter((x) => x.row === s.row && x.d.startModule < s.d.startModule).sort((a, b) => b.d.startModule - a.d.startModule)[0];
  if (left)
    return {
      ref: refOf(left),
      confidence: 0.5,
      critical: true,
      observations: left.obsIds,
      question: { kind: 'confirm', text: { key: 'assist.q.parentByPosition', params: { label, rcd: left.d.label ?? where(left.row, left.d.startModule) } }, priority: 'high' },
    };
  return {
    ref: board,
    confidence: 0.3,
    critical: true,
    observations: [],
    question: { kind: 'unknown', text: { key: 'assist.q.parentUnknown', params: { label } }, priority: 'high' },
  };
}

/** Compatibilité : les propositions écrites avec « __board__ » sont rattachées au nœud réel. */
export function bindBoard(d: BoardDraft, boardId: string): BoardDraft {
  const fix = <T>(v: T): T => JSON.parse(JSON.stringify(v).split('"__board__"').join(JSON.stringify(boardId))) as T;
  return { ...d, proposals: fix(d.proposals) };
}
