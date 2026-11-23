import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { useChain, useDerived } from './derived';
import { usePanZoom } from './usePanZoom';
import type { BoardLayout, ElNode, Pt } from '../model/types';
import { autoLayout, boardSize, compareRow, enclosures, moduleWidth, placeDevice, placed, unplaceDevice, type Placed } from '../board/model';
import { boundaries, rowProfile, rowTransform } from '../board/photo';
import { pickFile } from '../io/files';
import { readBackground } from '../io/background';
import { loadRGBA } from '../plan/traceImage';
import { toGray } from '../plan/trace';
import { loadAiSettings, getSessionKey } from '../ai/settings';
import { compareReading, extraDevices, readBoardPhoto, type DeviceDiff } from '../ai/boardPhoto';

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
  const device = String(n.props.device ?? 'mcb');
  const a = n.props.ratedCurrent ? `${n.props.curve && device !== 'rcd' ? n.props.curve : ''}${n.props.ratedCurrent}A` : '';
  const b = n.props.residualCurrent ? `${n.props.residualCurrent}mA` : '';
  return [a, b].filter(Boolean);
}

/** Dessin d'un appareil modulaire (face avant simplifiée), coin haut-gauche (0,0). */
export function DeviceFace({ n, width, ref_, selected, check, chain }: { n: ElNode; width: number; ref_?: string; selected?: boolean; check?: 'ok' | 'ko' | 'width' | 'unsure'; chain?: boolean }) {
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
  const { select, setProps, setBoardLayout } = useStore.getState();
  const { numbering, labelFn } = useDerived();
  const encs = useMemo(() => enclosures(project.roots), [project.roots]);
  const [idx, setIdx] = useState(0);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [corners, setCorners] = useState<Pt[] | null>(null);
  const [detect, setDetect] = useState<Map<string, 'ok' | 'width' | 'unsure'> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [aiDiffs, setAiDiffs] = useState<{ diffs: DeviceDiff[]; extra: { row: number; startModule: number; kind: string }[]; notes: string | null } | null>(null);
  const lang = useStore((s) => s.lang);
  const ai = loadAiSettings();
  const aiAllowed = ai.enabled && ai.permissions.boardFromPhoto;

  const enc = encs[Math.min(idx, encs.length - 1)];
  const size = enc ? boardSize(enc.board) : { rows: 2, perRow: 13 };
  const layout: BoardLayout = (enc && project.boards?.[enc.board.id]) ?? { slots: {} };
  const { placed: devs, unplaced } = enc ? placed(enc, layout) : { placed: [] as Placed[], unplaced: [] as ElNode[] };
  const W = size.perRow * MOD + 2 * MARGIN;
  const fieldTop = rowTop(0);
  const reserveTop = ROW0 + size.rows * ROW_PITCH + 30;
  const H = reserveTop + 40 + Math.ceil(Math.max(1, unplaced.length) / Math.max(1, Math.floor(size.perRow / 2))) * (DEV_H + 20) + MARGIN;
  const pz = usePanZoom({ w: W, h: H }, (enc?.board.id ?? '') + '|' + size.rows + '|' + size.perRow);

  if (!enc)
    return (
      <div className="page-panel muted">
        <p>{t('board.none')}</p>
      </div>
    );

  const save = (l: BoardLayout) => setBoardLayout(enc.board.id, l);
  const nameOf = (n: ElNode) => {
    // Étiquette (RGIE 3.1.3) : repère du circuit et usage ; différentiel : sensibilité
    if (n.props.circuitName) return [numbering.get(n.id), String(n.props.circuitName)].filter(Boolean).join(' ');
    if (Number(n.props.residualCurrent) > 0) return `${t('label.diff')} ${n.props.residualCurrent} mA`;
    return [numbering.get(n.id), labelFn.title(n)].filter(Boolean).join(' ');
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
      setMsg(t('board.photoRow', { row: 1, end: t('board.photoRowLeft') }));
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
  const finishCalibration = (pts: Pt[]) => {
    const ph = layout.photo;
    if (!ph) return;
    const rows = [];
    for (let r = 0; r < size.rows; r++) rows.push({ a: toPhotoPx(pts[2 * r]), b: toPhotoPx(pts[2 * r + 1]) });
    save({ ...layout, photo: { ...ph, rows } });
    setCorners(null);
    setMsg(t('board.photoFitted'));
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
      ph.rows.forEach((line, r) => {
        if (r >= size.rows) return;
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

  const readWithAi = async () => {
    const ph = layout.photo;
    if (!ph) return;
    const key = getSessionKey();
    if (!key) {
      setMsg(t('ai.needUnlock'));
      return;
    }
    setBusy(true);
    setMsg(t('ai.reading'));
    try {
      const reading = await readBoardPhoto({ apiKey: key, model: ai.model, photoDataUrl: ph.href, rows: size.rows, perRow: size.perRow, lang });
      const diffs = compareReading(devs, reading);
      setAiDiffs({ diffs, extra: extraDevices(devs, reading), notes: reading.notes });
      setDetect(new Map(diffs.map((d) => [d.nodeId, d.ok ? 'ok' : 'width'])));
      setMsg(t('ai.readDone', { ok: diffs.filter((d) => d.ok).length, bad: diffs.filter((d) => !d.ok).length }));
    } catch (e) {
      const m = (e as Error).message;
      setMsg(m === 'refusal' ? t('ai.refused') : t('ai.error', { msg: m }));
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
  const target = drag && dragged && drag.moved ? slotAt({ x: drag.pos.x + MOD / 2, y: drag.pos.y + DEV_H / 2 }, moduleWidth(dragged)) : null;

  return (
    <div className="canvas-wrap">
      <div className="plan-toolbar">
        {encs.length > 1 &&
          encs.map((e, i) => (
            <button key={e.board.id} className={i === idx ? 'active' : ''} onClick={() => setIdx(i)}>
              {labelFn.title(e.board)}
            </button>
          ))}
        <label className="inline">
          {t('board.rows')}
          <input type="number" min={1} max={12} value={size.rows} onChange={(e) => setProps(enc.board.id, { rows: Math.max(1, Number(e.target.value) || 1) })} />
        </label>
        <label className="inline">
          {t('board.perRow')}
          <input type="number" min={4} max={36} value={size.perRow} onChange={(e) => setProps(enc.board.id, { modulesPerRow: Math.max(4, Number(e.target.value) || 13) })} />
        </label>
        <button
          onClick={() => {
            // Ajoute les rangées nécessaires pour placer tous les appareils
            const all = autoLayout(enc, 99, size.perRow);
            const need = Math.max(size.rows, ...Object.values(all.slots).map((s) => s.row + 1));
            if (need > size.rows) setProps(enc.board.id, { rows: need });
            save({ ...layout, slots: autoLayout(enc, need, size.perRow).slots });
          }}
        >
          {t('board.auto')}
        </button>
        <span className="sep" />
        <button onClick={importPhoto} disabled={busy}>
          {t('board.photo')}
        </button>
        {layout.photo && (
          <>
            <button
              className={corners ? 'active' : ''}
              onClick={() => {
                setCorners([]);
                // Recalage : on revient à la photo brute
                save({ ...layout, photo: { ...layout.photo!, rows: undefined } });
                setMsg(t('board.photoRow', { row: 1, end: t('board.photoRowLeft') }));
              }}
            >
              {t('board.photoFit')}
            </button>
            <button onClick={compare} disabled={busy || !devs.length}>
              {t('board.compare')}
            </button>
            {aiAllowed && (
              <button onClick={readWithAi} disabled={busy || !devs.length} title={t('ai.boardHelp')}>
                {t('ai.boardRead')}
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
          </>
        )}
      </div>
      <div className="canvas-tools">
        <button onClick={pz.fit}>{t('action.zoomFit')}</button>
      </div>
      {(msg || unplaced.length > 0) && <div className="hint">{msg ?? t('board.reserveHint', { n: unplaced.length })}</div>}
      {aiDiffs && (
        <div className="plan-item-panel ai-results">
          <strong>{t('ai.resultsTitle')}</strong>
          <ul>
            {aiDiffs.diffs
              .filter((d) => !d.ok)
              .map((d) => {
                const n = enc.devices.find((x) => x.id === d.nodeId);
                return (
                  <li key={d.nodeId}>
                    <button className="link" onClick={() => select(d.nodeId)}>
                      {n ? nameOf(n) : d.nodeId}
                    </button>{' '}
                    : {d.issues.map((i) => t(i.key, i.params)).join(' ; ')}
                  </li>
                );
              })}
            {aiDiffs.extra.map((x, i) => (
              <li key={'x' + i}>{t('ai.diff.extra', { row: x.row + 1, col: x.startModule + 1, kind: t('enum.device.' + x.kind) })}</li>
            ))}
          </ul>
          {aiDiffs.notes && <p className="muted small">{aiDiffs.notes}</p>}
          <p className="muted small">{t('ai.resultsHelp')}</p>
          <button onClick={() => setAiDiffs(null)}>{t('ai.close')}</button>
        </div>
      )}
      <svg
        ref={pz.svgRef}
        className={'canvas board' + (corners ? ' placing calibrating' : '') + (pz.panning ? ' panning' : '')}
        viewBox={`${pz.vb.x} ${pz.vb.y} ${pz.vb.w} ${pz.vb.h}`}
        onPointerDown={(e) => pz.onPointerDown(e, !!corners)}
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
            if (pts.length === 2 * size.rows) finishCalibration(pts);
            else {
              setCorners(pts);
              setMsg(t('board.photoRow', { row: Math.floor(pts.length / 2) + 1, end: t(pts.length % 2 ? 'board.photoRowRight' : 'board.photoRowLeft') }));
            }
            return;
          }
          if ((e.target as Element).getAttribute('data-bg') === '1') select(null);
        }}
      >
        <rect data-bg="1" x={pz.vb.x - 1e5} y={pz.vb.y - 1e5} width={2e5 + pz.vb.w} height={2e5 + pz.vb.h} className="canvas-bg" />
        {/* Enveloppe et rails */}
        <rect x={MARGIN - 12} y={ROW0 - 12} width={size.perRow * MOD + 24} height={size.rows * ROW_PITCH + 4} rx={6} className="board-frame" />
        {layout.photo?.rows &&
          layout.photo.rows.slice(0, size.rows).map((line, r) => {
            const cy = rowTop(r) + DEV_H / 2;
            const tf = rowTransform(line.a, line.b, { x: MARGIN, y: cy }, { x: MARGIN + size.perRow * MOD, y: cy });
            return (
              <g key={'ph' + r} clipPath={`url(#rowclip${r})`} style={{ pointerEvents: 'none' }}>
                <clipPath id={`rowclip${r}`}>
                  <rect x={MARGIN - 8} y={rowTop(r) - LABEL_H - 6} width={size.perRow * MOD + 16} height={DEV_H + LABEL_H + 14} />
                </clipPath>
                <image href={layout.photo!.href} width={layout.photo!.imgW} height={layout.photo!.imgH} transform={tf.svg} opacity={layout.photo!.opacity ?? 0.6} />
              </g>
            );
          })}
        {layout.photo && !layout.photo.rows && (
          <image
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
                <DeviceFace n={d.node} width={d.width} ref_={numbering.get(d.node.id)} selected={d.node.id === selectedId} chain={chain.has(d.node.id)} check={checkOf(d.node.id)} />
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
            {target && (
              <rect x={MARGIN + target.col * MOD} y={rowTop(target.row)} width={moduleWidth(dragged) * MOD} height={DEV_H} className="drop-target" />
            )}
            <g transform={`translate(${drag.pos.x},${drag.pos.y})`} opacity={0.85} style={{ pointerEvents: 'none' }}>
              <DeviceFace n={dragged} width={moduleWidth(dragged)} ref_={numbering.get(dragged.id)} selected />
            </g>
          </>
        )}
        {/* Calage : la photo passe au premier plan (le dessin du tableau reste estompé derrière) pour cliquer ses repères */}
        {corners && layout.photo && (
          <image
            href={layout.photo.href}
            x={layout.photo.x}
            y={layout.photo.y}
            width={layout.photo.w}
            height={layout.photo.h}
            preserveAspectRatio="none"
            style={{ pointerEvents: 'none' }}
          />
        )}
        {corners?.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={4} className="snap" />)}
      </svg>
    </div>
  );
}

function truncateFit(s: string, modules: number): string {
  const max = Math.max(3, Math.floor(modules * 5));
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
