import { NumberField } from './NumberField';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { ancestors, createNode, insertChild, insertInSeries, isCircuit, mapTree, uid } from '../model/tree';
import { useChain, useDerived } from './derived';
import { usePanZoom } from './usePanZoom';
import type { BoardLayout, ElNode, Pt } from '../model/types';
import {
  conventionalLayout,
  BOARD_EXTRA_KINDS,
  boardCandidates,
  boardSize,
  compareRow,
  enclosures,
  layoutFromPhotoRows,
  moduleWidth,
  placeDevice,
  placed,
  unplaceDevice,
  type Placed,
} from '../board/model';
import { analyzeRow, boundaries, moduleStats, rowProfile, rowTransform } from '../board/photo';
import { download, pickFile } from '../io/files';
import { importErrorText } from '../io/limits';
import { AssetImage } from '../format/AssetImage';
import { readBackground } from '../io/background';
import { assetShaOf } from '../format/manifest';
import { loadRGBA } from '../plan/traceImage';
import { toGray } from '../plan/trace';
import { aiReady, loadAiSettings, getSessionKey, setSessionKey, useAiUnlocked } from '../ai/settings';
import { AiError, isLocalUrl, PROVIDERS } from '../ai/provider';
import { useOnline } from './UpdateBanner';
import { unseal } from '../ai/secureStore';
import { composeBoardImage, shrinkPhoto } from '../ai/boardImage';
import { aiInputHash, BOARD_PROMPT_VERSION, calibrationKey, draftFromReading, hasCachedReading, openAssistant, sha256 } from '../assist/ui';
import { addBoard } from '../assist/boards';
import { isStaleChunk, notifyUpdate } from '../appUpdate';
import {
  closeKind,
  compareReading,
  extraDevices,
  layoutFromReading,
  projectKind as projectKindOf,
  PROTECTION_KINDS,
  protectionFromReading,
  readBoardPhoto,
  type DeviceDiff,
  type ExtraDevice,
  type Proposal,
} from '../ai/boardPhoto';
import { matchesNow, SHORT_LANDSCAPE_QUERY } from './PropsSheet';

/** Différence de la comparaison qu'une proposition règle. */
const ISSUE_OF: Record<Proposal['prop'], string> = {
  ratedCurrent: 'ai.diff.rating',
  residualCurrent: 'ai.diff.sensitivity',
  curve: 'ai.diff.curve',
  rcdType: 'ai.diff.rcdType',
  poles: '',
};

/** Valeur du menu « Associer à… » pour créer une nouvelle protection. */
const NEW = '__new';
/** Préfixe de valeur : créer l'appareil en série sous ce circuit. */
const SERIES = '__series:';
/** Appareils de la photo qui peuvent être un disjoncteur en série (disjoncteur connecté, module avec mesure…). */
const SERIES_KINDS = new Set(['mcb', 'rcbo', 'domotic', 'meter', 'other']);

/** Dimensions du dessin (mm, échelle réelle) : module DIN de 17,5 mm. */
export const MOD = 17.5;
export const DEV_H = 85;
export const LABEL_H = 14;
export const ROW_PITCH = 150;
export const MARGIN = 30;
const ROW0 = MARGIN + 20;

export function rowTop(row: number) {
  return ROW0 + row * ROW_PITCH + LABEL_H + 6;
}

/** Texte court d'un appareil : calibre et sensibilité. */
export function deviceText(n: ElNode): string[] {
  // Relais, transformateur, compteur… : nom, sinon référence (abrégée)
  if (n.kind !== 'protection') return [String(n.props.name ?? n.props.reference ?? '').slice(0, 14)].filter(Boolean);
  const device = String(n.props.device ?? 'mcb');
  const a = n.props.ratedCurrent ? `${n.props.curve && device !== 'rcd' ? n.props.curve : ''}${n.props.ratedCurrent}A` : '';
  const b = n.props.residualCurrent ? `${n.props.residualCurrent}mA` : '';
  return [a, b].filter(Boolean);
}

/** Dessin d'un appareil modulaire (face avant simplifiée), coin haut-gauche (0,0). */
export function DeviceFace({
  n,
  width,
  ref_,
  selected,
  check,
  chain,
}: {
  n: ElNode;
  width: number;
  ref_?: string;
  selected?: boolean;
  check?: 'ok' | 'ko' | 'width' | 'unsure';
  chain?: boolean;
}) {
  const w = width * MOD;
  const device = String(n.props.device ?? 'mcb');
  const rcd = device === 'rcd' || device === 'rcbo' || Number(n.props.residualCurrent) > 0;
  const txt = deviceText(n);
  const fs = Math.min(9, w / 3.2);
  return (
    <g className={'device' + (rcd ? ' rcd' : '') + (selected ? ' selected' : chain ? ' chain' : '')}>
      <rect x={0.6} y={0} width={w - 1.2} height={DEV_H} rx={2} className="device-body" />
      {/* poignée */}
      <rect x={w / 2 - Math.min(5, w / 4)} y={DEV_H * 0.42} width={Math.min(10, w / 2)} height={14} rx={1.5} className="device-lever" />
      {rcd && <circle cx={w - 6} cy={DEV_H * 0.3} r={3} className="device-test" />}
      {ref_ && (
        <text x={w / 2} y={16} fontSize={Math.min(12, w / 2)} textAnchor="middle" className="device-ref">
          {ref_}
        </text>
      )}
      {txt.map((s, i) => (
        <text key={i} x={w / 2} y={DEV_H - 16 + i * (fs + 1)} fontSize={fs} textAnchor="middle" className="device-txt">
          {s}
        </text>
      ))}
      {check && (
        <g transform={`translate(${w - 7},${DEV_H - 7})`} className={'check ' + check}>
          <circle r={5.5} />
          <text y={3} fontSize={8} textAnchor="middle">
            {check === 'ok' ? '✓' : check === 'unsure' ? '?' : '!'}
          </text>
        </g>
      )}
    </g>
  );
}

type Drag = { id: string; from: 'rail' | 'reserve'; offset: Pt; pos: Pt; moved: boolean };

export function BoardView() {
  const project = useStore((s) => s.project);
  const t = useStore((s) => s.t);
  const selectedId = useStore((s) => s.selectedId);
  const chain = useChain();
  const { select, setProps, setBoardLayout, applyProject } = useStore.getState();
  const { numbering, labelFn } = useDerived();
  const encs = useMemo(() => enclosures(project.roots), [project.roots]);
  const [idx, setIdx] = useState(0);
  /** Petit écran : réglages empilés au-dessus du dessin, repliables (le bouton n'apparaît que là). */
  // Téléphone à l'horizontale : réglages repliés au départ (la hauteur manque)
  const [toolsOpen, setToolsOpen] = useState(() => !matchesNow(SHORT_LANDSCAPE_QUERY));
  const [drag, setDrag] = useState<Drag | null>(null);
  const [corners, setCorners] = useState<Pt[] | null>(null);
  const [detect, setDetect] = useState<Map<string, 'ok' | 'width' | 'unsure'> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  /** Rangées montrées par la photo à caler (une photo par rangée possible) ; `to` = -1 : jusqu'à la dernière. */
  const [span, setSpan] = useState<{ from: number; to: number }>({ from: 0, to: -1 });
  const [aiDiffs, setAiDiffs] = useState<{ diffs: DeviceDiff[]; extra: ExtraDevice[]; proposals: Proposal[]; notes: string | null } | null>(
    null,
  );
  const lang = useStore((s) => s.lang);
  /** Phrase secrète demandée sur place pour déverrouiller la clé de l'IA (null = champ caché). */
  const [unlock, setUnlock] = useState<string | null>(null);
  const unlockInput = useRef<HTMLInputElement>(null);
  const ai = loadAiSettings();
  const aiAllowed = ai.enabled && ai.permissions.boardFromPhoto;
  const aiUnlocked = useAiUnlocked();
  // Clé exigée par le fournisseur (un modèle local n'en demande pas)
  const aiNeedsKey = PROVIDERS[ai.provider]?.needsKey(ai) ?? true;
  const online = useOnline();
  // Hors ligne : seul un modèle local (sur cet ordinateur) reste utilisable
  const aiReachable = online || (ai.provider === 'openaiCompatible' && isLocalUrl(ai.baseUrl ?? ''));
  const aiOk = aiReady(ai, aiUnlocked) && aiReachable;

  const enc = encs[Math.min(idx, encs.length - 1)];
  const size = enc ? boardSize(enc.board) : { rows: 2, perRow: 13 };
  const layout: BoardLayout = (enc && project.boards?.[enc.board.id]) ?? { slots: {} };
  const { placed: devs, unplaced } = enc ? placed(enc, layout) : { placed: [] as Placed[], unplaced: [] as ElNode[] };
  const W = size.perRow * MOD + 2 * MARGIN;
  const fieldTop = rowTop(0);
  const reserveTop = ROW0 + size.rows * ROW_PITCH + 30;
  const H = reserveTop + 40 + Math.ceil(Math.max(1, unplaced.length) / Math.max(1, Math.floor(size.perRow / 2))) * (DEV_H + 20) + MARGIN;
  const pz = usePanZoom({ w: W, h: H }, (enc?.board.id ?? '') + '|' + size.rows + '|' + size.perRow);

  // Calage : la vue cadre la photo (au téléphone, cadrée avec tout le tableau elle ne faisait que ~120 px de large) ;
  // la vue d'ensemble revient à la fin
  const calibrating = corners !== null;
  const wasCalibrating = useRef(false);
  useEffect(() => {
    const ph = layout.photo;
    if (calibrating && ph) requestAnimationFrame(() => pz.fitRect({ x: ph.x, y: ph.y, w: ph.w, h: ph.h }));
    else if (!calibrating && wasCalibrating.current) pz.fit();
    wasCalibrating.current = calibrating;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calibrating]);
  /** Calage d'avant un recalage, rendu si l'utilisateur annule. */
  const prevCalibration = useRef<{ rows?: NonNullable<typeof layout.photo>['rows']; firstRow?: number } | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);

  if (!enc)
    return (
      <div className="page-panel muted">
        <p>{t('board.none')}</p>
      </div>
    );

  const save = (l: BoardLayout) => setBoardLayout(enc.board.id, l);
  // Rangées de la photo à caler, et rangées calées de la photo actuelle (photo partielle : décalées de `firstRow`)
  const spanFrom = Math.min(Math.max(0, span.from), size.rows - 1);
  const spanTo = span.to < 0 ? size.rows - 1 : Math.min(Math.max(span.to, spanFrom), size.rows - 1);
  const spanRows = spanTo - spanFrom + 1;
  const phFirst = Math.min(layout.photo?.firstRow ?? 0, size.rows - 1);
  const phRows = layout.photo?.rows?.slice(0, size.rows - phFirst) ?? [];
  const phPartial = !!layout.photo?.rows && (phFirst > 0 || phRows.length < size.rows);
  /** Relevé en cours sur ce tableau (une photo déjà lue par l'assistant) : une nouvelle photo complète le brouillon. */
  const surveying = !!project.evidence?.sources.some((s) => s.kind === 'boardPhoto' && s.about?.nodeId === enc.board.id);
  const nameOf = (n: ElNode) => {
    // Étiquette (RGIE 3.1.3) : repère du circuit et usage ; différentiel : sensibilité
    if (n.props.circuitName) return [numbering.get(n.id), String(n.props.circuitName)].filter(Boolean).join(' ');
    if (Number(n.props.residualCurrent) > 0) return `${t('label.diff')} ${n.props.residualCurrent} mA`;
    return [numbering.get(n.id), labelFn.title(n)].filter(Boolean).join(' ');
  };

  /** Repères des circuits protégés par un différentiel (pour reconnaître « A-F » sur son étiquette). */
  const circuitsOf = (n: ElNode): string[] =>
    projectKindOf(n) !== 'rcd'
      ? []
      : enc.devices
          .filter((d) => d.id !== n.id && [...ancestors(project.roots, d.id)].some((a) => a.id === n.id))
          .map((d) => numbering.get(d.id) ?? '')
          .filter(Boolean);
  /** Applique des caractéristiques lues sur la photo (une seule annulation). */
  const applyProposals = (list: Proposal[]) => {
    if (!list.length) return;
    applyProject((p) => ({
      ...p,
      roots: mapTree(p.roots, (n) => {
        const mine = list.filter((x) => x.nodeId === n.id);
        return mine.length ? { ...n, props: { ...n.props, ...Object.fromEntries(mine.map((x) => [x.prop, x.to])) } } : n;
      }),
    }));
    setAiDiffs((d) =>
      d
        ? {
            ...d,
            proposals: d.proposals.filter((x) => !list.includes(x)),
            // Différences réglées par ces propositions
            diffs: d.diffs.map((df) => {
              const issues = df.issues.filter((i) => !list.some((x) => x.nodeId === df.nodeId && ISSUE_OF[x.prop] === i.key));
              return { ...df, issues, ok: issues.length === 0 };
            }),
          }
        : d,
    );
  };
  const propText = (x: Proposal) => {
    const unit = x.prop === 'ratedCurrent' ? ' A' : x.prop === 'residualCurrent' ? ' mA' : '';
    return t('ai.proposal', {
      prop: t('ai.prop.' + x.prop),
      from: x.from == null ? '—' : `${x.from}${unit}`,
      to: `${x.to}${unit}`,
    });
  };

  // Position de la réserve (appareils non placés)
  const perReserveRow = Math.max(1, Math.floor((W - 2 * MARGIN) / (MOD * 2.5)));
  const reservePos = (i: number): Pt => ({ x: MARGIN + (i % perReserveRow) * MOD * 2.5, y: reserveTop + 30 + Math.floor(i / perReserveRow) * (DEV_H + 20) });

  const slotAt = (p: Pt, width: number): { row: number; col: number } | null => {
    for (let r = 0; r < size.rows; r++) {
      const top = rowTop(r);
      if (p.y >= top - 40 && p.y <= top + DEV_H + 40) {
        const col = Math.round((p.x - MARGIN) / MOD);
        return { row: r, col: Math.max(0, Math.min(size.perRow - width, col)) };
      }
    }
    return null;
  };

  const importPhoto = async () => {
    const f = await pickFile('image/*');
    if (!f) return;
    setBusy(true);
    try {
      const img = await readBackground(f);
      // Affichée sur toute la zone des appareils en attendant le calage
      const w = size.perRow * MOD;
      const h = (img.h / img.w) * w;
      save({ ...layout, photo: { href: img.href, x: MARGIN, y: fieldTop, w, h, opacity: 0.6, imgW: img.w, imgH: img.h } });
      setCorners([]);
      setMsg(t('board.photoRow', { row: spanFrom + 1, end: t('board.photoRowLeft') }));
    } catch (e) {
      setMsg(importErrorText(e, t));
    } finally {
      setBusy(false);
    }
  };

  /** Point du dessin → pixel de la photo brute (affichée sur la zone des appareils avant le calage). */
  const toPhotoPx = (p: Pt): Pt => {
    const ph = layout.photo!;
    return { x: ((p.x - ph.x) / ph.w) * (ph.imgW ?? 1), y: ((p.y - ph.y) / ph.h) * (ph.imgH ?? 1) };
  };

  /** Calage : 2 clics par rangée (bord gauche du 1er module, puis bout de la rangée), à mi-hauteur des appareils. */
  const cancelCalibration = () => {
    const prev = prevCalibration.current;
    if (prev && layout.photo) save({ ...layout, photo: { ...layout.photo, rows: prev.rows, firstRow: prev.firstRow } });
    prevCalibration.current = null;
    setCorners(null);
    setMsg(null);
  };

  const finishCalibration = (pts: Pt[]) => {
    const ph = layout.photo;
    if (!ph) return;
    const rows = [];
    for (let r = 0; r < spanRows; r++) rows.push({ a: toPhotoPx(pts[2 * r]), b: toPhotoPx(pts[2 * r + 1]) });
    save({ ...layout, photo: { ...ph, rows, firstRow: spanFrom || undefined } });
    prevCalibration.current = null;
    setCorners(null);
    setMsg(t('board.photoFitted'));
  };

  /** Disposition proposée d'après la photo calée (sans IA) : emplacements occupés, puis appareils par largeur. */
  const layoutFromPhoto = async () => {
    const ph = layout.photo;
    if (!ph?.rows) {
      setMsg(t('board.photoCalibrateFirst'));
      return;
    }
    if (phPartial) {
      setMsg(t('assist.partialPhotoOnly'));
      return;
    }
    setBusy(true);
    try {
      const g = toGray(await loadRGBA(ph.href));
      const rows = ph.rows.slice(0, size.rows).map((line) => {
        const pxPerMm = Math.hypot(line.b.x - line.a.x, line.b.y - line.a.y) / (size.perRow * MOD);
        return analyzeRow(rowProfile(g, line.a, line.b, 0.3 * DEV_H * pxPerMm), moduleStats(g, line.a, line.b, size.perRow), size.perRow);
      });
      const r = layoutFromPhotoRows(enc.devices, rows, layout.slots);
      save({ ...layout, slots: r.slots, checks: undefined });
      setDetect(null);
      // Modules occupés sur la photo sans appareil du projet : listés, à associer à un élément de l'unifilaire
      setAiDiffs(
        r.extra.length
          ? {
              diffs: [],
              proposals: [],
              notes: null,
              extra: r.extra.map((x) => ({
                row: x.row,
                startModule: x.col,
                width: x.width,
                kind: 'other' as const,
                model: '',
                seen: {
                  startModule: x.col,
                  widthModules: x.width,
                  kind: 'other' as const,
                  poles: null,
                  ratedCurrentA: null,
                  curve: null,
                  residualCurrentmA: null,
                  rcdType: null,
                  label: null,
                  confidence: 'low' as const,
                },
              })),
            }
          : null,
      );
      setMsg(t('board.fromPhotoDone', { placed: Object.keys(r.slots).length, reserve: r.unplaced.length, extra: r.extra.length }));
    } finally {
      setBusy(false);
    }
  };

  const compare = async () => {
    const ph = layout.photo;
    if (!ph?.rows) {
      setMsg(t('board.photoCalibrateFirst'));
      return;
    }
    setBusy(true);
    try {
      const g = toGray(await loadRGBA(ph.href));
      const res = new Map<string, 'ok' | 'width' | 'unsure'>();
      phRows.forEach((line, i) => {
        const r = i + phFirst;
        const pxPerMm = Math.hypot(line.b.x - line.a.x, line.b.y - line.a.y) / (size.perRow * MOD);
        const prof = rowProfile(g, line.a, line.b, 0.3 * DEV_H * pxPerMm);
        const bounds = boundaries(prof, size.perRow);
        compareRow(
          devs.filter((d) => d.row === r),
          (p) => bounds[p]?.boundary,
          size.perRow,
        ).forEach((v, id) => res.set(id, v));
      });
      setDetect(res);
      const bad = [...res.values()].filter((v) => v !== 'ok').length;
      setMsg(t('board.compared', { ok: res.size - bad, bad }));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Lecture de la photo, en une seule étape pour l'utilisateur : par l'IA si elle est configurée, autorisée et
   * déverrouillée, sinon par l'OCR local (sans IA, rien n'est envoyé ; photo calée nécessaire). Même suite dans les
   * deux cas : brouillon de relevé, ou disposition et comparaison avec le projet.
   */
  const readPhoto = async () => {
    const ph = layout.photo;
    if (!ph) return;
    const key = getSessionKey();
    const useAi = aiAllowed && aiReachable && aiReady(ai, !!key);
    if (!useAi && !phRows.length) {
      setMsg(t('board.photoCalibrateFirst'));
      return;
    }
    setUnlock(null);
    setBusy(true);
    const t0 = Date.now();
    const label = useAi ? t('ai.reading') : t('ocr.boardReading');
    setMsg(label);
    const tick = useAi ? window.setInterval(() => setMsg(`${label} ${Math.round((Date.now() - t0) / 1000)} s`), 1000) : undefined;
    try {
      // Image composée (rangées redressées + règle des modules) si la photo est calée, sinon photo réduite
      const calibrated = phRows.length > 0;
      const draftMode = !enc.devices.length || surveying;
      if (phPartial && !draftMode) {
        setMsg(t('assist.partialPhotoOnly'));
        return;
      }
      // Format v2 : la photo est un document « asset:<sha256> » — son empreinte est celle du fichier d'origine
      const photoSha = assetShaOf(ph.href) ?? (await sha256(ph.href));
      const { OCR_VERSION } = await import('../ocr/engine');
      const image = useAi ? (calibrated ? await composeBoardImage(ph.href, phRows, size.perRow) : await shrinkPhoto(ph.href)) : photoSha + '|' + calibrationKey(phRows);
      const engine = useAi ? { provider: ai.provider, model: ai.model, promptVersion: BOARD_PROMPT_VERSION } : { provider: 'local', model: 'tesseract.js ' + OCR_VERSION, promptVersion: 'ocr-1' };
      const inputHash = await aiInputHash(image, engine);
      // Même photo, même image (même calage), même moteur : lecture déjà faite, aucune nouvelle lecture (cache)
      const cached = draftMode && hasCachedReading(photoSha, inputHash, enc.board.id);
      const reading = cached
        ? undefined
        : useAi
          ? await readBoardPhoto({
              config: { provider: ai.provider, model: ai.model, baseUrl: ai.baseUrl, apiKey: key ?? undefined },
              photoDataUrl: image,
              rows: calibrated ? phRows.length : size.rows,
              perRow: size.perRow,
              lang,
              composed: calibrated,
            })
          : await (await import('../ocr/board')).readBoardOcr(ph.href, phRows, size.perRow, (f) => setMsg(`${label} ${Math.round(f * 100)} %`));
      if (draftMode) {
        // Relevé d'une installation existante : brouillon proposé (fusionné avec les autres photos du tableau), rien
        // n'est appliqué
        const r = await draftFromReading({
          reading,
          boardId: enc.board.id,
          photoHref: ph.href,
          photoSha,
          engine: { ...engine, inputHash },
          method: useAi ? 'ai' : 'deterministic',
          calibration: calibrationKey(phRows),
          offset: { row: phFirst, module: 0 },
        });
        if (r.duplicateOf) {
          const dup = useStore.getState().project.evidence?.sources.find((x) => x.id === r.duplicateOf);
          setMsg(t('assist.duplicatePhoto', { label: dup?.label ?? '' }));
          return;
        }
        const sum = r.summary!;
        setMsg(
          [
            r.cached ? t('assist.cachedReading') : '',
            t('assist.draftReady', { devices: sum.devices, questions: sum.questions }),
            sum.sources > 1 ? t('assist.draftMerged', { sources: sum.sources, contradictions: sum.contradictions }) : '',
            sum.others ? t('assist.othersSeen', { n: sum.others }) : '',
          ]
            .filter(Boolean)
            .join(' '),
        );
        openAssistant();
        return;
      }
      if (!reading) return;
      // Disposer les appareils du projet aux places lues sur la photo (annulable), puis comparer
      const { slots, unplaced: left, props, proposals } = layoutFromReading(enc.devices, reading, size.perRow, nameOf, circuitsOf);
      const next: BoardLayout = { ...layout, slots };
      // Disposition, largeurs et références lues : une seule étape d'annulation
      const changed = Object.keys(props);
      applyProject((p) => ({
        ...p,
        roots: changed.length ? mapTree(p.roots, (n) => (props[n.id] ? { ...n, props: { ...n.props, ...props[n.id] } } : n)) : p.roots,
        boards: { ...p.boards, [enc.board.id]: next },
      }));
      // Appareils à jour (nouvelles largeurs) pour la comparaison
      const devsNow = enc.devices.map((n) => (props[n.id] ? { ...n, props: { ...n.props, ...props[n.id] } } : n));
      const now = placed({ ...enc, devices: devsNow }, next).placed;
      const diffs = compareReading(now, reading);
      setAiDiffs({ diffs, extra: extraDevices(now, reading), proposals, notes: reading.notes });
      setDetect(new Map(diffs.map((d) => [d.nodeId, d.ok ? 'ok' : 'width'])));
      setMsg(
        t('ai.readPlaced', { placed: now.length, left: left.length }) +
          ' ' +
          (changed.length ? t('ai.readApplied', { n: changed.length }) + ' ' : '') +
          t('ai.readDone', { ok: diffs.filter((d) => d.ok).length, bad: diffs.filter((d) => !d.ok).length }),
      );
    } catch (e) {
      const m = (e as Error).message;
      if (isStaleChunk(e)) {
        notifyUpdate();
        setMsg(t('app.updateReady'));
      } else if (e instanceof AiError) setMsg(e.code === 'refusal' ? t('ai.refused') : t('ai.error.' + e.code, { detail: e.detail }));
      else setMsg(m === 'refusal' ? t('ai.refused') : t('ai.error', { msg: m }));
    } finally {
      if (tick !== undefined) window.clearInterval(tick);
      setBusy(false);
    }
  };

  /** Nouveau tableau (sous-tableau), alimentation inconnue : l'assistant proposera de le rattacher à son circuit. */
  const addSubBoard = () => {
    const name = prompt(t('assist.addBoardPrompt'), t('assist.subBoardDefault'));
    if (!name?.trim()) return;
    let id = '';
    applyProject((p) => {
      const r = addBoard(p, name.trim());
      id = r.boardId;
      return r.project;
    });
    const i = enclosures(useStore.getState().project.roots).findIndex((e) => e.board.id === id);
    if (i >= 0) setIdx(i);
    setMsg(t('assist.boardAdded'));
  };

  /** Enregistre l'image composée (celle envoyée à l'IA), sans rien envoyer. */
  const saveAiImage = async () => {
    const ph = layout.photo;
    if (!ph || !phRows.length) return;
    setBusy(true);
    try {
      const url = await composeBoardImage(ph.href, phRows, size.perRow);
      const bin = atob(url.slice(url.indexOf(',') + 1));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      await download(new Blob([bytes], { type: 'image/jpeg' }), `tableau-${phRows.length}r-${size.perRow}m.jpg`);
    } finally {
      setBusy(false);
    }
  };

  const checkOf = (id: string): 'ok' | 'ko' | 'width' | 'unsure' | undefined => layout.checks?.[id] ?? detect?.get(id);
  const toggleCheck = (id: string) => {
    const cur = layout.checks?.[id];
    const next = cur === 'ok' ? 'ko' : cur === 'ko' ? undefined : 'ok';
    const checks = { ...layout.checks };
    if (next) checks[id] = next;
    else delete checks[id];
    save({ ...layout, checks });
  };

  const dragged = drag ? enc.devices.find((d) => d.id === drag.id) : undefined;

  /** Appareil vu sur la photo et absent du projet : éléments du tableau en réserve, ou de l'unifilaire hors rail. */
  const associable = aiDiffs?.extra.length ? [...unplaced, ...boardCandidates(enc, encs)] : [];
  /** Nom dans le menu : pour un élément hors protections, le circuit qui l'alimente (« Transformateur — Q Sonnette »). */
  const candidateLabel = (n: ElNode) => {
    const circuit = n.kind === 'protection' ? undefined : [...ancestors(project.roots, n.id)].reverse().find((a) => a.kind === 'protection');
    return [nameOf(n), circuit ? nameOf(circuit) : '', n.location ?? ''].filter(Boolean).join(' — ');
  };
  const associate = (x: ExtraDevice, id: string) => {
    const n = associable.find((a) => a.id === id);
    if (!n) return;
    const patch: Record<string, string | number | boolean> = {};
    if (BOARD_EXTRA_KINDS.has(n.kind)) patch.inBoard = true;
    if (x.width !== moduleWidth(n)) patch.modules = x.width;
    if (x.model && !String(n.props.reference ?? '').trim()) patch.reference = x.model;
    // Propriétés et place sur le rail : une seule annulation
    applyProject((p) => ({
      ...p,
      roots: mapTree(p.roots, (m) => (m.id === id ? { ...m, props: { ...m.props, ...patch } } : m)),
      boards: { ...p.boards, [enc.board.id]: { ...layout, slots: { ...layout.slots, [id]: { row: x.row, col: x.startModule } } } },
    }));
    setAiDiffs((d) => (d ? { ...d, extra: d.extra.filter((e) => e !== x) } : d));
  };
  /** Protection vue sur la photo et absente de l'unifilaire : créée sous ce tableau d'après la lecture, et placée. */
  const createFromPhoto = (x: ExtraDevice) => {
    // Seulement les valeurs lues : aucune valeur par défaut (calibre, courbe…) qui passerait pour une observation
    const node: ElNode = { id: uid(), kind: 'protection', props: protectionFromReading(x.seen), children: [] };
    applyProject((p) => ({
      ...p,
      roots: insertChild(p.roots, enc.board.id, node),
      boards: { ...p.boards, [enc.board.id]: { ...layout, slots: { ...layout.slots, [node.id]: { row: x.row, col: x.startModule } } } },
    }));
    setAiDiffs((d) => (d ? { ...d, extra: d.extra.filter((e) => e !== x) } : d));
    select(node.id);
    setMsg(t('ai.created'));
  };
  /** Circuits de ce tableau sous lesquels un appareil de la photo peut être monté en série. */
  const seriesTargets = enc ? enc.devices.filter((n) => isCircuit(n)) : [];
  /** Disjoncteur vu sur la photo, monté en série derrière le disjoncteur d'un circuit (ex. EARU derrière O). */
  const createInSeries = (x: ExtraDevice, upId: string) => {
    const up = enc.devices.find((n) => n.id === upId);
    if (!up) return;
    const read = protectionFromReading(x.seen);
    // Calibre : celui du circuit (le seuil réglé ne dépasse pas la protection au-dessus), à corriger au besoin
    const node = createNode('protection', {
      device: read.device === 'rcbo' ? 'rcbo' : 'mcb',
      poles: up.props.poles,
      ratedCurrent: up.props.ratedCurrent,
      curve: up.props.curve,
      phase: up.props.phase,
      modules: read.modules,
      ...(read.reference ? { reference: read.reference } : {}),
      series: true,
    });
    applyProject((p) => ({
      ...p,
      roots: insertInSeries(p.roots, upId, node),
      boards: { ...p.boards, [enc.board.id]: { ...layout, slots: { ...layout.slots, [node.id]: { row: x.row, col: x.startModule } } } },
    }));
    setAiDiffs((d) => (d ? { ...d, extra: d.extra.filter((e) => e !== x) } : d));
    select(node.id);
    setMsg(t('ai.createdSeries', { circuit: nameOf(up) }));
  };
  const target = drag && dragged && drag.moved ? slotAt({ x: drag.pos.x + MOD / 2, y: drag.pos.y + DEV_H / 2 }, moduleWidth(dragged)) : null;

  return (
    <div className={'canvas-wrap stacked' + (corners ? ' calibrating' : '')}>
      {/* Téléphone, calage en cours : une seule ligne (étape, Annuler) au lieu de tous les réglages et d'une bulle */}
      {corners && (
        <div className="calib-bar narrow-only" role="status">
          <span className="calib-step">{msg}</span>
          <button onClick={cancelCalibration}>{t('board.calibCancel')}</button>
        </div>
      )}
      <button className="stack-toggle narrow-only" aria-expanded={toolsOpen || !!corners} onClick={() => setToolsOpen((v) => !v)}>
        <span className="twisty">{toolsOpen || corners ? '▾' : '▸'}</span> {t('board.settings')}
      </button>
      {/* Calage de la photo en cours : ses réglages restent visibles */}
      <div className={'plan-toolbar' + (toolsOpen || corners ? '' : ' folded')}>
        {encs.length > 1 &&
          encs.map((e, i) => (
            <button key={e.board.id} className={i === idx ? 'active' : ''} onClick={() => setIdx(i)}>
              {labelFn.title(e.board)}
            </button>
          ))}
        {(project.evidence || project.meta.installationKind === 'existing') && (
          <button onClick={addSubBoard} title={t('assist.addBoardHelp')}>
            {t('assist.addBoard')}
          </button>
        )}
        <label className="inline">
          {t('board.rows')}
          <NumberField min={1} max={12} value={size.rows} onCommit={(n) => setProps(enc.board.id, { rows: Math.round(n) })} />
        </label>
        <label className="inline">
          {t('board.perRow')}
          <NumberField min={4} max={36} value={size.perRow} onCommit={(n) => setProps(enc.board.id, { modulesPerRow: Math.round(n) })} />
        </label>
        <button
          title={t('board.autoHelp')}
          onClick={() => {
            // Rangement habituel ; ajoute les rangées nécessaires pour placer tous les appareils
            const usual = conventionalLayout(enc, size.rows, size.perRow, enc.board.props.mainRow === 'bottom' ? 'bottom' : 'top');
            if (usual.rows > size.rows) setProps(enc.board.id, { rows: usual.rows });
            save({ ...layout, slots: usual.slots });
          }}
        >
          {t('board.auto')}
        </button>
        <span className="sep" />
        {!layout.photo && (
          <button onClick={importPhoto} disabled={busy}>
            {t('board.photo')}
          </button>
        )}
        {layout.photo && (
          <>
            {/* Barre compacte : les actions sur la photo dans un menu « Photo ▾ » (réglages sur deux lignes au lieu de six) */}
            <button className="photo-toggle" aria-expanded={photoOpen} onClick={() => setPhotoOpen((v) => !v)}>
              {t('board.photoMenu')} {photoOpen ? '▴' : '▾'}
            </button>
            <span className={'photo-actions' + (photoOpen ? ' open' : '')}>
            <button onClick={importPhoto} disabled={busy}>
              {t('board.photo')}
            </button>
            <button
              className={corners ? 'active' : ''}
              onClick={() => {
                prevCalibration.current = { rows: layout.photo!.rows, firstRow: layout.photo!.firstRow };
                setCorners([]);
                // Recalage : on revient à la photo brute
                save({ ...layout, photo: { ...layout.photo!, rows: undefined, firstRow: undefined } });
                setMsg(t('board.photoRow', { row: spanFrom + 1, end: t('board.photoRowLeft') }));
              }}
            >
              {t('board.photoFit')}
            </button>
            {corners && size.rows > 1 && (
              // Photo d'une partie du tableau (une photo par rangée) : rangées visibles sur cette photo
              <label className="inline calib-keep" title={t('assist.photoRowsHelp')}>
                {t('assist.photoRows')}
                <select
                  value={spanFrom}
                  onChange={(e) => {
                    setSpan({ from: Number(e.target.value), to: Math.max(Number(e.target.value), spanTo) });
                    setCorners([]);
                    setMsg(t('board.photoRow', { row: Number(e.target.value) + 1, end: t('board.photoRowLeft') }));
                  }}
                >
                  {Array.from({ length: size.rows }, (_, i) => (
                    <option key={i} value={i}>
                      {i + 1}
                    </option>
                  ))}
                </select>
                {t('assist.photoRowsTo')}
                <select
                  value={spanTo}
                  onChange={(e) => {
                    setSpan({ from: spanFrom, to: Number(e.target.value) });
                    setCorners([]);
                    setMsg(t('board.photoRow', { row: spanFrom + 1, end: t('board.photoRowLeft') }));
                  }}
                >
                  {Array.from({ length: size.rows - spanFrom }, (_, i) => (
                    <option key={i} value={spanFrom + i}>
                      {spanFrom + i + 1}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button onClick={layoutFromPhoto} disabled={busy || !layout.photo.rows || phPartial} title={t('board.fromPhotoHelp')}>
              {t('board.fromPhoto')}
            </button>
            <button onClick={compare} disabled={busy || !devs.length}>
              {t('board.compare')}
            </button>
            {/* Un seul bouton : l'IA si elle est prête, sinon la lecture locale (OCR) ; le cadenas déverrouille l'IA */}
            <button onClick={readPhoto} disabled={busy} title={aiOk ? t('ai.boardHelp') : t('ocr.boardHelp')}>
              {aiOk ? t('ai.boardRead') : t('ocr.boardRead')}
            </button>
            {aiAllowed && aiNeedsKey && !aiUnlocked && ai.key && unlock === null && (
              <button
                onClick={() => {
                  setUnlock('');
                  setMsg(t('ai.askPass'));
                }}
                title={t('ai.unlockShort')}
                aria-label={t('ai.unlockShort')}
              >
                🔒
              </button>
            )}
            {aiAllowed && aiNeedsKey && !aiUnlocked && unlock !== null && (
              <form
                className="inline"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    setSessionKey(await unseal(ai.key!, unlock));
                  } catch {
                    setMsg(t('ai.badPass'));
                    unlockInput.current?.select();
                    return;
                  }
                  setUnlock(null);
                  setMsg(t('ai.on'));
                }}
              >
                <input
                  ref={unlockInput}
                  type="password"
                  autoFocus
                  autoComplete="current-password"
                  placeholder={t('ai.passphrase')}
                  value={unlock}
                  onChange={(e) => setUnlock(e.target.value)}
                />
                <button type="submit" className="primary" disabled={!unlock}>
                  {t('ai.unlock')}
                </button>
                <button type="button" onClick={() => setUnlock(null)}>
                  ✕
                </button>
              </form>
            )}
            {aiAllowed && phRows.length > 0 && (
              // Transparence : l'image exacte qui serait envoyée à l'IA (aussi utile pour le banc d'évaluation)
              <button onClick={saveAiImage} disabled={busy} title={t('assist.saveAiImageHelp')}>
                {t('assist.saveAiImage')}
              </button>
            )}
            <label className="inline">
              {t('plan.bgOpacity')}
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={layout.photo.opacity ?? 0.6}
                onChange={(e) => save({ ...layout, photo: { ...layout.photo!, opacity: Number(e.target.value) } })}
              />
            </label>
            <button className="danger" onClick={() => save({ ...layout, photo: undefined, checks: undefined })}>
              {t('board.photoRemove')}
            </button>
            </span>
          </>
        )}
      </div>
      <div className="canvas-tools">
        <button onClick={pz.fit}>{t('action.zoomFit')}</button>
      </div>
      {/* Résultat d'une action : bulle ; aide permanente de la réserve : ligne discrète, pas sur le dessin */}
      {msg ? <div className="hint">{msg}</div> : unplaced.length > 0 && <div className="view-note">{t('board.reserveHint', { n: unplaced.length })}</div>}
      {aiDiffs && (
        <div className="plan-item-panel ai-results">
          <strong>{t('ai.resultsTitle')}</strong>
          <ul>
            {aiDiffs.diffs
              .map((d) => ({
                ...d,
                issues: d.issues.filter((i) => !aiDiffs.proposals.some((x) => x.nodeId === d.nodeId && ISSUE_OF[x.prop] === i.key)),
              }))
              .filter((d) => d.issues.length > 0)
              .map((d) => {
                const n = enc.devices.find((x) => x.id === d.nodeId);
                return (
                  <li key={d.nodeId}>
                    <button className="link" onClick={() => select(d.nodeId)}>
                      {n ? nameOf(n) : d.nodeId}
                    </button>{' '}
                    :{' '}
                    {d.issues
                      .map((i) =>
                        t(i.key, i.key === 'ai.diff.kind' && i.params ? { photo: t('ai.kind.' + i.params.photo), project: t('ai.kind.' + i.params.project) } : i.params),
                      )
                      .join(' ; ')}
                  </li>
                );
              })}
            {aiDiffs.extra.map((x, i) => (
              <li key={'x' + i}>
                {t('ai.diff.extra2', { row: x.row + 1, col: x.startModule + 1, kind: t('ai.kind.' + x.kind), model: x.model ? ` ${x.model}` : '' })}{' '}
                {(PROTECTION_KINDS.has(x.kind) || x.kind === 'other' || associable.length > 0) && (
                  // Types proches d'abord, puis tout autre élément de l'unifilaire de ce tableau (choix libre)
                  <select
                    value=""
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === NEW) createFromPhoto(x);
                      else if (v.startsWith(SERIES)) createInSeries(x, v.slice(SERIES.length));
                      else if (v) associate(x, v);
                    }}
                  >
                    <option value="">{t('ai.associate')}</option>
                    {(PROTECTION_KINDS.has(x.kind) || x.kind === 'other') && (
                      <option value={NEW}>{t('ai.newProtection', { kind: t('ai.kind.' + (x.kind === 'other' ? 'mcb' : x.kind)) })}</option>
                    )}
                    {SERIES_KINDS.has(x.kind) && seriesTargets.length > 0 && (
                      <optgroup label={t('ai.inSeries')}>
                        {seriesTargets.map((n) => (
                          <option key={n.id} value={SERIES + n.id}>
                            {t('ai.inSeriesUnder', { circuit: nameOf(n) })}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {x.kind !== 'other' && associable.some((n) => closeKind(x.kind, n)) && (
                      <optgroup label={t('ai.closeKinds')}>
                        {associable
                          .filter((n) => closeKind(x.kind, n))
                          .map((n) => (
                            <option key={n.id} value={n.id}>
                              {candidateLabel(n)}
                            </option>
                          ))}
                      </optgroup>
                    )}
                    {associable.some((n) => x.kind === 'other' || !closeKind(x.kind, n)) && (
                      <optgroup label={t('ai.otherElements')}>
                        {associable
                          .filter((n) => x.kind === 'other' || !closeKind(x.kind, n))
                          .map((n) => (
                            <option key={n.id} value={n.id}>
                              {candidateLabel(n)}
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </select>
                )}
              </li>
            ))}
          </ul>
          {aiDiffs.proposals.length > 0 && (
            <>
              <strong>{t('ai.proposalsTitle')}</strong>
              <ul>
                {aiDiffs.proposals.map((x, i) => {
                  const n = enc.devices.find((d) => d.id === x.nodeId);
                  return (
                    <li key={'p' + i}>
                      <button className="link" onClick={() => select(x.nodeId)}>
                        {n ? nameOf(n) : x.nodeId}
                      </button>{' '}
                      : {propText(x)}{' '}
                      <button onClick={() => applyProposals([x])}>{t('ai.apply')}</button>
                    </li>
                  );
                })}
              </ul>
              {aiDiffs.proposals.length > 1 && <button onClick={() => applyProposals(aiDiffs.proposals)}>{t('ai.applyAll')}</button>}
            </>
          )}
          {aiDiffs.notes && <p className="muted small">{aiDiffs.notes}</p>}
          <p className="muted small">{t('ai.resultsHelp')}</p>
          <button onClick={() => setAiDiffs(null)}>{t('ai.close')}</button>
        </div>
      )}
      <svg
        ref={pz.svgRef}
        className={'canvas board' + (corners ? ' placing calibrating' : '') + (pz.panning ? ' panning' : '')}
        viewBox={`${pz.vb.x} ${pz.vb.y} ${pz.vb.w} ${pz.vb.h}`}
        // Les appareils arrêtent l'événement : ce qui arrive ici est le fond, le cadre, les rails ou la photo,
        // donc un glisser déplace toute la vue (un simple clic désélectionne ou place un point de calage).
        onPointerDown={(e) => pz.onPointerDown(e, true)}
        onPointerMove={(e) => {
          if (pz.onPointerMove(e)) return; // la vue se déplace (glisser sur le fond ou appui long)
          if (drag) {
            const p = pz.toSvg(e.clientX, e.clientY);
            setDrag({ ...drag, pos: { x: p.x - drag.offset.x, y: p.y - drag.offset.y }, moved: true });
          }
        }}
        onPointerUp={(e) => {
          if (pz.onPointerUp()) return;
          if (drag) {
            if (drag.moved && dragged) {
              const tgt = slotAt({ x: drag.pos.x + MOD / 2, y: drag.pos.y + DEV_H / 2 }, moduleWidth(dragged));
              if (tgt) {
                const next = placeDevice(enc, layout, drag.id, tgt.row, tgt.col, size.perRow);
                if (next) save(next);
                else setMsg(t('board.noRoom'));
              } else if (drag.pos.y > reserveTop - 20) save(unplaceDevice(layout, drag.id));
            }
            setDrag(null);
            return;
          }
          if (corners) {
            const pts = [...corners, pz.toSvg(e.clientX, e.clientY)];
            if (pts.length === 2 * spanRows) finishCalibration(pts);
            else {
              setCorners(pts);
              setMsg(t('board.photoRow', { row: spanFrom + Math.floor(pts.length / 2) + 1, end: t(pts.length % 2 ? 'board.photoRowRight' : 'board.photoRowLeft') }));
            }
            return;
          }
          select(null); // clic hors d'un appareil : désélectionner
        }}
      >
        <rect data-bg="1" x={pz.vb.x - 1e5} y={pz.vb.y - 1e5} width={2e5 + pz.vb.w} height={2e5 + pz.vb.h} className="canvas-bg" />
        {/* Enveloppe et rails */}
        <rect x={MARGIN - 12} y={ROW0 - 12} width={size.perRow * MOD + 24} height={size.rows * ROW_PITCH + 4} rx={6} className="board-frame" />
        {layout.photo?.rows &&
          phRows.map((line, i) => {
            const r = i + phFirst;
            const cy = rowTop(r) + DEV_H / 2;
            const tf = rowTransform(line.a, line.b, { x: MARGIN, y: cy }, { x: MARGIN + size.perRow * MOD, y: cy });
            return (
              <g key={'ph' + r} clipPath={`url(#rowclip${r})`} style={{ pointerEvents: 'none' }}>
                <clipPath id={`rowclip${r}`}>
                  <rect x={MARGIN - 8} y={rowTop(r) - LABEL_H - 6} width={size.perRow * MOD + 16} height={DEV_H + LABEL_H + 14} />
                </clipPath>
                <AssetImage
                  href={layout.photo!.href}
                  width={layout.photo!.imgW}
                  height={layout.photo!.imgH}
                  transform={tf.svg}
                  opacity={layout.photo!.opacity ?? 0.6}
                />
              </g>
            );
          })}
        {layout.photo && !layout.photo.rows && (
          <AssetImage
            href={layout.photo.href}
            x={layout.photo.x}
            y={layout.photo.y}
            width={layout.photo.w}
            height={layout.photo.h}
            opacity={layout.photo.opacity ?? 0.6}
            preserveAspectRatio="none"
            style={{ pointerEvents: 'none' }}
          />
        )}
        {Array.from({ length: size.rows }).map((_, r) => (
          <g key={r}>
            <rect x={MARGIN - 4} y={rowTop(r) + DEV_H / 2 - 17.5} width={size.perRow * MOD + 8} height={35} className="rail" />
            {/* Bande d'étiquettes (à la taille réelle : un module = 17,5 mm) */}
            <rect x={MARGIN} y={rowTop(r) - LABEL_H - 4} width={size.perRow * MOD} height={LABEL_H} className="label-strip" />
            {Array.from({ length: size.perRow + 1 }).map((_, c) => (
              <line key={c} x1={MARGIN + c * MOD} y1={rowTop(r) + DEV_H + 3} x2={MARGIN + c * MOD} y2={rowTop(r) + DEV_H + 7} className="tick" />
            ))}
          </g>
        ))}
        {/* Appareils placés */}
        {devs.map((d) => {
          const isDrag = drag?.id === d.node.id && drag.moved;
          const x = MARGIN + d.col * MOD;
          const y = rowTop(d.row);
          return (
            <g key={d.node.id}>
              <text x={x + (d.width * MOD) / 2} y={y - LABEL_H + 6} fontSize={Math.min(7, (d.width * MOD) / 4)} textAnchor="middle" className="label-text">
                {truncateFit(nameOf(d.node), d.width)}
              </text>
              <g
                transform={`translate(${x},${y})`}
                // Avec une photo : appareils semi-transparents pour comparer à l'œil
                opacity={isDrag ? 0.3 : layout.photo?.rows ? 0.55 : 1}
                style={{ cursor: 'grab' }}
                onPointerDown={(e) => {
                  if (e.button !== 0 || corners) return;
                  e.stopPropagation();
                  select(d.node.id);
                  const p = pz.toSvg(e.clientX, e.clientY);
                  setDrag({ id: d.node.id, from: 'rail', offset: { x: p.x - x, y: p.y - y }, pos: { x, y }, moved: false });
                  (e.currentTarget.ownerSVGElement as SVGSVGElement).setPointerCapture(e.pointerId);
                  pz.armLongPress(e, () => setDrag(null)); // appui long : déplacer la vue plutôt que l'appareil
                }}
              >
                <DeviceFace
                  n={d.node}
                  width={d.width}
                  ref_={numbering.get(d.node.id)}
                  selected={d.node.id === selectedId}
                  chain={chain.has(d.node.id)}
                  check={checkOf(d.node.id)}
                />
              </g>
              {(layout.photo || layout.checks?.[d.node.id]) && (
                <rect
                  x={x + d.width * MOD - 13}
                  y={y + DEV_H - 13}
                  width={12}
                  height={12}
                  className="check-hit"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => toggleCheck(d.node.id)}
                >
                  <title>{t('board.checkToggle')}</title>
                </rect>
              )}
            </g>
          );
        })}
        {/* Réserve : appareils pas encore placés */}
        <text x={MARGIN} y={reserveTop + 12} fontSize={11} className="muted">
          {t('board.reserve')} ({unplaced.length})
        </text>
        {unplaced.map((n, i) => {
          const p = reservePos(i);
          const isDrag = drag?.id === n.id && drag.moved;
          return (
            <g
              key={n.id}
              transform={`translate(${p.x},${p.y})`}
              opacity={isDrag ? 0.3 : 1}
              style={{ cursor: 'grab' }}
              onPointerDown={(e) => {
                if (e.button !== 0 || corners) return;
                e.stopPropagation();
                select(n.id);
                const q = pz.toSvg(e.clientX, e.clientY);
                setDrag({ id: n.id, from: 'reserve', offset: { x: q.x - p.x, y: q.y - p.y }, pos: p, moved: false });
                (e.currentTarget.ownerSVGElement as SVGSVGElement).setPointerCapture(e.pointerId);
                pz.armLongPress(e, () => setDrag(null));
              }}
            >
              <DeviceFace n={n} width={moduleWidth(n)} ref_={numbering.get(n.id)} selected={n.id === selectedId} chain={chain.has(n.id)} />
            </g>
          );
        })}
        {/* Glisser : appareil sous le pointeur et emplacement visé */}
        {drag?.moved && dragged && (
          <>
            {target && <rect x={MARGIN + target.col * MOD} y={rowTop(target.row)} width={moduleWidth(dragged) * MOD} height={DEV_H} className="drop-target" />}
            <g transform={`translate(${drag.pos.x},${drag.pos.y})`} opacity={0.85} style={{ pointerEvents: 'none' }}>
              <DeviceFace n={dragged} width={moduleWidth(dragged)} ref_={numbering.get(dragged.id)} selected />
            </g>
          </>
        )}
        {/* Calage : la photo passe au premier plan (le dessin du tableau reste estompé derrière) pour cliquer ses repères */}
        {corners && layout.photo && (
          <AssetImage
            href={layout.photo.href}
            x={layout.photo.x}
            y={layout.photo.y}
            width={layout.photo.w}
            height={layout.photo.h}
            preserveAspectRatio="none"
            style={{ pointerEvents: 'none' }}
          />
        )}
        {corners?.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} className="snap" />
        ))}
      </svg>
    </div>
  );
}

function truncateFit(s: string, modules: number): string {
  const max = Math.max(3, Math.floor(modules * 5));
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
