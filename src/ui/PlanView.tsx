import { NumberField } from './NumberField';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { useChain, useDerived } from './derived';
import { usePanZoom } from './usePanZoom';
import { isWallMounted, Symbol, symbolSize } from '../unifilar/symbols';
import type { ElNode, PlanPage, Pt } from '../model/types';
import { uid } from '../model/tree';
import {
  alignBackground,
  inRotatedRect,
  dist,
  moveWallEnd,
  nearestWall,
  openingOnWall,
  parseLength,
  project,
  scaleBackground,
  scalePage,
  slideOpening,
  snapPoint,
  translateWall,
} from '../plan/geometry';
import { PlanItemPanel } from './PlanItemPanel';
import { usePlanUi, type PlanTool } from './planUi';
import { PlanAddDialog } from './PlanAddDialog';
import { FURNITURE, FURNITURE_GROUPS, FurnitureShape, type FurnitureKind } from '../plan/furniture';
import { readBackground } from '../io/background';
import { pickFile } from '../io/files';
import { parseSize } from '../plan/trace';
import { rectifyBackground, tracePlan } from '../plan/traceImage';

/** Échelle des symboles sur le plan (unités symbole → mm). */
export const S = 12;
/** Largeur par défaut d'un fond de plan importé, avant mise à l'échelle (mm). */
const BG_DEFAULT_W = 12000;

type Tool = PlanTool;
export type PlanSel = { type: 'wall' | 'opening' | 'label' | 'image' | 'furniture'; index: number } | null;
/** Glisser d'un élément du plan : la page d'origine est gardée pour annuler en une étape. */
type ItemDrag = { sel: NonNullable<PlanSel>; handle?: 'a' | 'b'; start: Pt; orig: PlanPage; moved: boolean };

export function PlanSymbol({ node, selected, sev, chain }: { node: ElNode; selected: boolean; sev: string | null; chain?: boolean }) {
  // Tous les éléments ont un symbole de plan (tableau 2.23), sauf la protection : simple étiquette.
  if (node.kind === 'protection') {
    return (
      <g className={'hit sym' + (selected ? ' selected' : chain ? ' chain' : '')}>
        <rect x={-20} y={-12} width={40} height={24} className="bg" />
        <text x={0} y={4} textAnchor="middle" fontSize={10}>
          P
        </text>
        {sev && <circle cx={20} cy={-12} r={4} className={'mark ' + sev} />}
      </g>
    );
  }
  const s = symbolSize(node, 'h');
  return (
    <g className={'hit sym' + (selected ? ' selected' : chain ? ' chain' : '')} transform={`translate(${-s.w / 2},0)`}>
      <rect x={-2} y={-s.h / 2 - 2} width={s.w + 4} height={s.h + 4} className="hitbox" />
      <Symbol node={node} orient="h" bare={!isWallMounted(node)} />
      {sev && <circle cx={s.w + 2} cy={-s.h / 2 - 2} r={4} className={'mark ' + sev} />}
    </g>
  );
}

export function Walls({ page, sel }: { page: PlanPage; sel: PlanSel }) {
  return (
    <g>
      {page.images.map((im, i) => (
        <image
          key={'i' + i}
          href={im.href}
          x={im.center.x - im.w / 2}
          y={im.center.y - im.h / 2}
          width={im.w}
          height={im.h}
          opacity={im.opacity ?? (im.background ? 0.45 : 0.6)}
          preserveAspectRatio="none"
          transform={`rotate(${im.angle} ${im.center.x} ${im.center.y})`}
          style={{ pointerEvents: 'none' }}
          className={sel?.type === 'image' && sel.index === i ? 'sel-image' : undefined}
        />
      ))}
      <g className="furniture">
        {(page.furniture ?? []).map((f, i) => (
          <g
            key={f.id}
            transform={`translate(${f.center.x},${f.center.y}) rotate(${f.angle})`}
            className={sel?.type === 'furniture' && sel.index === i ? 'sel' : undefined}
          >
            <FurnitureShape kind={f.kind} w={f.w} h={f.h} />
          </g>
        ))}
      </g>
      {page.walls.map((w, i) => (
        <line
          key={'w' + i}
          x1={w.a.x}
          y1={w.a.y}
          x2={w.b.x}
          y2={w.b.y}
          style={{ strokeWidth: w.thickness }}
          className={'wall' + (sel?.type === 'wall' && sel.index === i ? ' sel' : '')}
        />
      ))}
      {page.rects.map((r, i) => (
        <rect key={'r' + i} x={r.center.x - r.w / 2} y={r.center.y - r.h / 2} width={r.w} height={r.h} transform={`rotate(${r.angle} ${r.center.x} ${r.center.y})`} className="plan-rect" />
      ))}
      {page.openings.map((o, i) => {
        const len = Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y);
        const ang = (Math.atan2(o.b.y - o.a.y, o.b.x - o.a.x) * 180) / Math.PI;
        const th = o.width ?? 150;
        const selected = sel?.type === 'opening' && sel.index === i;
        if (o.kind === 'stairs') {
          const steps = Math.max(3, Math.round(len / 250));
          return (
            <g key={'o' + i} transform={`translate(${o.a.x},${o.a.y}) rotate(${ang})`} className={'plan-thin' + (selected ? ' sel' : '')}>
              <rect x={0} y={-th / 2} width={len} height={th} />
              {Array.from({ length: steps }).map((_, k) => (
                <line key={k} x1={(len / steps) * k} y1={-th / 2} x2={(len / steps) * k} y2={th / 2} />
              ))}
            </g>
          );
        }
        // Charnière en a (ou en b si `mirrored`) ; 'left' : le battant s'ouvre du côté -y local, 'right' : +y.
        const side = o.hinge === 'right' ? 1 : -1;
        const hx = o.mirrored ? len : 0;
        const ex = o.mirrored ? 0 : len;
        const sweep = side < 0 === ex > hx ? 1 : 0;
        return (
          <g key={'o' + i} transform={`translate(${o.a.x},${o.a.y}) rotate(${ang})`} className={selected ? 'sel' : undefined}>
            <rect x={0} y={-th / 2 - 20} width={len} height={th + 40} className="opening-gap" />
            {o.kind === 'window' && (
              <g className="plan-thin">
                <line x1={0} y1={-th / 4} x2={len} y2={-th / 4} />
                <line x1={0} y1={th / 4} x2={len} y2={th / 4} />
              </g>
            )}
            {o.kind === 'door' && (
              <g className="plan-thin">
                <line x1={hx} y1={0} x2={hx} y2={side * len} />
                <path d={`M${hx} ${side * len} A${len} ${len} 0 0 ${sweep} ${ex} 0`} fill="none" strokeDasharray="40 30" />
              </g>
            )}
            {(o.kind === 'doubleDoor' || o.kind === 'frenchDoor') && (
              <g className="plan-thin">
                {/* Deux battants de largeur len/2, charnières aux deux extrémités */}
                <line x1={0} y1={0} x2={0} y2={(side * len) / 2} />
                <path d={`M0 ${(side * len) / 2} A${len / 2} ${len / 2} 0 0 ${side < 0 ? 1 : 0} ${len / 2} 0`} fill="none" strokeDasharray="40 30" />
                <line x1={len} y1={0} x2={len} y2={(side * len) / 2} />
                <path d={`M${len} ${(side * len) / 2} A${len / 2} ${len / 2} 0 0 ${side < 0 ? 0 : 1} ${len / 2} 0`} fill="none" strokeDasharray="40 30" />
                {o.kind === 'frenchDoor' && <line x1={0} y1={0} x2={len} y2={0} />}
              </g>
            )}
            {o.kind === 'garageDoor' && <line x1={0} y1={0} x2={len} y2={0} className="plan-thin" strokeDasharray="80 40" />}
            {o.kind === 'slidingDoor' && (
              <g className="plan-thin" transform={o.mirrored ? `translate(${len},0) scale(-1,1)` : undefined}>
                {/* Baie vitrée coulissante : deux vantaux vitrés qui se chevauchent, flèche du sens de glissement
                    (« mirrored » : elle coulisse dans l'autre sens) */}
                <rect x={0} y={-th / 4 - 15} width={len * 0.55} height={30} />
                <rect x={len * 0.45} y={th / 4 - 15} width={len * 0.55} height={30} />
                <path d={`M${len * 0.2} ${side * th * 0.9} H${len * 0.5} m-60 -40 l60 40 l-60 40`} fill="none" />
              </g>
            )}
          </g>
        );
      })}
      {page.labels.map((l, i) => (
        <text
          key={l.id}
          x={l.pos.x}
          y={l.pos.y}
          fontSize={(l.size ?? 3) * 90}
          className={'room-label' + (sel?.type === 'label' && sel.index === i ? ' sel-text' : '')}
          textAnchor="middle"
        >
          {l.text}
        </text>
      ))}
    </g>
  );
}

/** Élément de plan sous le pointeur (outil Sélection). */
export function hitTest(page: PlanPage, p: Pt, tol: number): PlanSel {
  for (let i = page.labels.length - 1; i >= 0; i--) {
    const l = page.labels[i];
    const fs = (l.size ?? 3) * 90;
    if (Math.abs(p.x - l.pos.x) < (l.text.length * fs * 0.3 + tol) && p.y < l.pos.y + tol && p.y > l.pos.y - fs - tol) return { type: 'label', index: i };
  }
  for (let i = page.openings.length - 1; i >= 0; i--) {
    const o = page.openings[i];
    if (project(p, o.a, o.b).d < (o.width ?? 150) / 2 + tol) return { type: 'opening', index: i };
    // Porte : clic sur le battant ou dans l'arc d'ouverture (quart de disque côté ouverture)
    if (o.kind === 'door' || o.kind === 'doubleDoor' || o.kind === 'frenchDoor') {
      const len = Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y);
      if (!len) continue;
      const ux = (o.b.x - o.a.x) / len;
      const uy = (o.b.y - o.a.y) / len;
      const side = o.hinge === 'right' ? 1 : -1;
      const along = (p.x - o.a.x) * ux + (p.y - o.a.y) * uy; // le long du mur, depuis a
      const across = side * ((p.x - o.a.x) * -uy + (p.y - o.a.y) * ux); // vers le côté d'ouverture
      const hx = o.mirrored ? len : 0;
      const r = o.kind === 'door' ? len : len / 2;
      const inSwing = (h: number) => across > 0 && Math.hypot(along - h, across) < r + tol && (h === 0 ? along > -tol : along < len + tol);
      if (o.kind === 'door' ? inSwing(hx) : inSwing(0) || inSwing(len)) return { type: 'opening', index: i };
    }
  }
  for (let i = page.walls.length - 1; i >= 0; i--) {
    const w = page.walls[i];
    if (project(p, w.a, w.b).d < w.thickness / 2 + tol) return { type: 'wall', index: i };
  }
  const furn = page.furniture ?? [];
  for (let i = furn.length - 1; i >= 0; i--) {
    const f = furn[i];
    if (inRotatedRect(p, f.center, f.w, f.h, f.angle, tol / 2)) return { type: 'furniture', index: i };
  }
  // Meubles importés (images Trikker) : sélectionnables comme le mobilier
  for (let i = page.images.length - 1; i >= 0; i--) {
    const im = page.images[i];
    if (!im.background && inRotatedRect(p, im.center, im.w, im.h, im.angle, tol / 2)) return { type: 'image', index: i };
  }
  for (let i = page.images.length - 1; i >= 0; i--) {
    const im = page.images[i];
    if (im.background && Math.abs(p.x - im.center.x) < im.w / 2 && Math.abs(p.y - im.center.y) < im.h / 2) return { type: 'image', index: i };
  }
  return null;
}

export function PlanView() {
  const project_ = useStore((s) => s.project);
  const pageIndex = useStore((s) => s.pageIndex);
  const setPage = useStore((s) => s.setPage);
  const selectedId = useStore((s) => s.selectedId);
  const selChain = useChain();
  const select = useStore((s) => s.select);
  const placingId = useStore((s) => s.placingId);
  const { placeSymbol, moveSymbol, startPlacing, rotateSymbol, unplaceSymbol, editPage, addPage } = useStore.getState();
  const fileName = useStore((s) => s.fileName);
  const t = useStore((s) => s.t);
  const { find, numbering, byNode, labelFn } = useDerived();

  const page = project_.plan.pages[Math.min(pageIndex, project_.plan.pages.length - 1)];
  const bounds = planBounds(page, project_.plan);
  const pz = usePanZoom(bounds, fileName + '|' + page.id);
  const [dragging, setDragging] = useState<{ id: string; pos: Pt; start: Pt; moved: boolean } | null>(null);
  const draggingRef = useRef(dragging);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  draggingRef.current = dragging;

  const tool = usePlanUi((u) => u.tool);
  const setTool = usePlanUi((u) => u.setTool);
  const furnKind = usePlanUi((u) => u.furnKind);
  const elementKind = usePlanUi((u) => u.elementKind);
  const [chain, setChain] = useState<Pt | null>(null);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [scalePts, setScalePts] = useState<Pt[]>([]);
  const [sel, setSel] = useState<PlanSel>(null);
  const [thickness, setThickness] = useState(200);
  const [busy, setBusy] = useState(false);
  const [itemDrag, setItemDrag] = useState<ItemDrag | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [preview, setPreview] = useState<PlanPage | null>(null);
  /** Ajout d'un élément de l'unifilaire à cet endroit du plan (clic droit, ou outil « Élément »). */
  const [adding, setAdding] = useState<{ at: { x: number; y: number }; pos: Pt } | null>(null);

  /** Tolérance d'accroche : 12 pixels écran, en mm. */
  const tol = () => {
    const el = pz.svgRef.current;
    const r = el?.getBoundingClientRect();
    return r ? 12 * Math.max(pz.vb.w / r.width, pz.vb.h / r.height) : 100;
  };

  const chooseTool = (tl: Tool) => {
    setTool(tl);
    setChain(null);
    setScalePts([]);
    setSel(null);
    if (placingId) startPlacing(null);
  };

  // Afficher la bonne page quand on sélectionne un élément placé ailleurs
  useEffect(() => {
    if (!selectedId) return;
    setSel(null);
    const pi = project_.plan.pages.findIndex((p) => p.symbols.some((s) => s.nodeId === selectedId));
    if (pi >= 0 && pi !== pageIndex) setPage(pi);
    const sym = project_.plan.pages[pi]?.symbols.find((s) => s.nodeId === selectedId);
    if (sym) pz.reveal(sym.pos.x, sym.pos.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Outil choisi dans la palette de gauche : dessin en cours abandonné, placement annulé
  useEffect(() => {
    setChain(null);
    setScalePts([]);
    if (tool !== 'select') {
      setSel(null);
      if (useStore.getState().placingId) startPlacing(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);

  // On repart de zéro en changeant de page
  useEffect(() => {
    setChain(null);
    setSel(null);
    setScalePts([]);
  }, [page.id]);

  const deleteSel = () => {
    if (!sel) return;
    const key = ({ wall: 'walls', opening: 'openings', label: 'labels', image: 'images', furniture: 'furniture' } as const)[sel.type];
    editPage((pg) => ({ ...pg, [key]: ((pg[key] ?? []) as unknown[]).filter((_, i) => i !== sel.index) }));
    setSel(null);
  };

  // Clavier : Échap termine le dessin ; Suppr efface l'élément de plan sélectionné.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape' && (chain || scalePts.length || tool !== 'select')) {
        e.stopImmediatePropagation();
        if (chain) setChain(null);
        else if (scalePts.length) setScalePts([]);
        else setTool('select');
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.stopImmediatePropagation();
        e.preventDefault();
        deleteSel();
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  });

  const importBackground = async () => {
    const file = await pickFile('image/*,.pdf,application/pdf');
    if (!file) return;
    setBusy(true);
    try {
      const img = await readBackground(file);
      const w = BG_DEFAULT_W;
      const h = (img.h / img.w) * w;
      editPage((pg) => ({ ...pg, images: [{ center: { x: w / 2, y: h / 2 }, w, h, angle: 0, href: img.href, background: true }, ...pg.images.filter((i) => !i.background)] }));
      pz.reveal(w / 2, h / 2);
      // Plan déjà dessiné (ex. import Trikker) : on cale la photo dessus ; sinon on la met à l'échelle.
      chooseTool(page.walls.length ? 'align' : 'scale');
    } catch (err) {
      alert(String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  };

  const onClick = (p: Pt) => {
    switch (tool) {
      case 'wall': {
        const q = snapPoint(p, page, tol(), chain);
        if (chain && dist(chain, q) > 1) editPage((pg) => ({ ...pg, walls: [...pg.walls, { a: chain, b: q, thickness }] }));
        setChain(q);
        return;
      }
      case 'door':
      case 'window': {
        const w = nearestWall(p, page, tol());
        if (!w) return;
        const o = openingOnWall(page, w.index, p, tool === 'door' ? 900 : 1200);
        // La porte s'ouvre du côté du mur où l'on a cliqué.
        const cross = (o.b.x - o.a.x) * (p.y - o.a.y) - (o.b.y - o.a.y) * (p.x - o.a.x);
        editPage((pg) => ({ ...pg, openings: [...pg.openings, { kind: tool, ...o, hinge: cross > 0 ? 'right' : 'left' }] }));
        return;
      }
      case 'label': {
        const text = prompt(t('plan.labelPrompt'));
        if (text?.trim()) editPage((pg) => ({ ...pg, labels: [...pg.labels, { id: uid(), text: text.trim(), pos: { x: Math.round(p.x), y: Math.round(p.y) }, size: 3 }] }));
        return;
      }
      case 'scale': {
        // Avec un fond de plan : on met le fond à l'échelle. Sans fond : toute la page (ex. plan Trikker hors échelle).
        const hasBg = page.images.some((i) => i.background);
        if (!hasBg && !page.walls.length) {
          alert(t('plan.noBackground'));
          return;
        }
        const pts = [...scalePts, p];
        if (pts.length < 2) {
          setScalePts(pts);
          return;
        }
        setScalePts([]);
        const answer = prompt(t('plan.scalePrompt'));
        const mm = answer ? parseLength(answer) : null;
        if (mm) {
          if (hasBg) {
            editPage((pg) => scaleBackground(pg, pts[0], pts[1], mm));
            chooseTool('wall');
          } else {
            editPage((pg) => scalePage(pg, pts[0], pts[1], mm));
            chooseTool('select');
          }
        }
        return;
      }
      case 'furniture': {
        if (!furnKind) return;
        const def = FURNITURE[furnKind];
        const item = { id: uid(), kind: furnKind, center: { x: Math.round(p.x / 10) * 10, y: Math.round(p.y / 10) * 10 }, w: def.w, h: def.h, angle: 0 };
        const index = (page.furniture ?? []).length;
        editPage((pg) => ({ ...pg, furniture: [...(pg.furniture ?? []), item] }));
        setTool('select');
        setSel({ type: 'furniture', index });
        return;
      }
      case 'element':
        // Outil « Élément » (palette) : même fenêtre que le clic droit, avec l'élément choisi
        if (lastPointer.current) setAdding({ at: lastPointer.current, pos: p });
        return;
      case 'rectify': {
        // 4 coins d'un rectangle connu (façades), puis ses dimensions réelles.
        const pts = [...scalePts, p];
        if (pts.length < 4) {
          setScalePts(pts);
          return;
        }
        setScalePts([]);
        const answer = prompt(t('plan.rectifyPrompt'), '13 x 8,5');
        const size = answer ? parseSize(answer) : null;
        const bgImg = page.images.find((i) => i.background);
        if (!size || !bgImg) return;
        setBusy(true);
        rectifyBackground(bgImg, pts, size)
          .then((nb) => {
            editPage((pg) => ({ ...pg, images: pg.images.map((i) => (i.background ? nb : i)) }));
            chooseTool('select');
          })
          .catch((err) => alert(String((err as Error).message ?? err)))
          .finally(() => setBusy(false));
        return;
      }
      case 'align': {
        // Clics : point de la photo, point du plan, 2e point de la photo, 2e point du plan.
        const pts = [...scalePts, scalePts.length % 2 === 1 ? snapPoint(p, page, tol()) : p];
        if (pts.length < 4) {
          setScalePts(pts);
          return;
        }
        setScalePts([]);
        editPage((pg) => alignBackground(pg, pts[0], pts[1], pts[2], pts[3]));
        chooseTool('select');
        return;
      }
      default: {
        const hit = hitTest(page, p, tol());
        setSel(hit);
        select(null); // clic ailleurs que sur un symbole : plus rien de sélectionné dans l'installation
      }
    }
  };

  const placingNode = placingId ? find(placingId) : undefined;
  const isWallNode = (id: string) => {
    const n = find(id);
    return !!n && isWallMounted(n);
  };
  const selSymbol = selectedId ? page.symbols.find((s) => s.nodeId === selectedId) : undefined;
  const snapped = cursor && tool === 'wall' ? snapPoint(cursor, page, tol(), chain) : null;
  const bg = page.images.find((i) => i.background);
  const hint =
    tool === 'furniture'
      ? t('plan.hint.furniture', { name: furnKind ? t('furniture.' + furnKind) : '' })
      : tool === 'element'
      ? t('plan.hint.element', { name: elementKind ? t('kind.' + elementKind) : '' })
      : tool === 'align'
      ? t('plan.hint.align' + scalePts.length)
      : tool === 'rectify'
        ? t('plan.hint.rectify' + scalePts.length)
      : tool === 'scale' && !page.images.some((i) => i.background)
      ? page.walls.length
        ? t('plan.hint.scalePage')
        : t('plan.noBackground')
      : tool !== 'select'
        ? t('plan.hint.' + tool)
        : null;
  const empty = !page.walls.length && !page.symbols.length && !page.images.length;

  return (
    <div className="canvas-wrap">
      <div className="plan-toolbar">
        {(['select', 'wall', 'door', 'window', 'label'] as Tool[]).map((tl) => (
          <button key={tl} className={tool === tl ? 'active' : ''} onClick={() => chooseTool(tl)} title={t('plan.hint.' + tl)}>
            {t('plan.tool.' + tl)}
          </button>
        ))}
        <span className="catalog-wrap">
          <button className={tool === 'furniture' || catalogOpen ? 'active' : ''} onClick={() => setCatalogOpen((v) => !v)}>
            {t('plan.tool.furniture')} ▾
          </button>
          {catalogOpen && (
            <div className="catalog" onMouseLeave={() => setCatalogOpen(false)}>
              {FURNITURE_GROUPS.map((g) => (
                <div key={g}>
                  <div className="catalog-group">{t('furniture.group.' + g)}</div>
                  <div className="catalog-items">
                    {(Object.keys(FURNITURE) as FurnitureKind[])
                      .filter((k) => FURNITURE[k].group === g)
                      .map((k) => {
                        const d = FURNITURE[k];
                        const box = Math.max(d.w, d.h) * 1.1;
                        return (
                          <button
                            key={k}
                            title={t('furniture.' + k)}
                            onClick={() => {
                              chooseTool('furniture');
                              usePlanUi.getState().pickFurniture(k);
                              setCatalogOpen(false);
                            }}
                          >
                            <svg viewBox={`${-box / 2} ${-box / 2} ${box} ${box}`} className="catalog-icon">
                              <FurnitureShape kind={k} w={d.w} h={d.h} />
                            </svg>
                            <span>{t('furniture.' + k)}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </span>
        {tool === 'wall' && (
          <label className="inline">
            {t('plan.thickness')}
            <NumberField min={50} max={600} step={10} value={thickness} onCommit={setThickness} />
          </label>
        )}
        <span className="sep" />
        <button onClick={importBackground} disabled={busy}>
          {busy ? '…' : t('plan.background')}
        </button>
        <button className={tool === 'scale' ? 'active' : ''} onClick={() => chooseTool('scale')}>
          {t('plan.tool.scale')}
        </button>
        {bg && (
          <button className={tool === 'rectify' ? 'active' : ''} onClick={() => chooseTool('rectify')} title={t('plan.hint.rectify0')}>
            {t('plan.tool.rectify')}
          </button>
        )}
        {bg && (
          <button
            disabled={busy}
            title={t('plan.traceHelp')}
            onClick={async () => {
              if ((page.walls.length || page.openings.length) && !confirm(t('plan.traceReplace', { n: page.walls.length }))) return;
              setBusy(true);
              try {
                const r = await tracePlan(bg);
                editPage((pg) => ({ ...pg, walls: r.walls, openings: r.openings }));
                alert(
                  t('plan.traceDone', {
                    n: r.walls.length,
                    d: r.openings.filter((o) => o.kind === 'door').length,
                    w: r.openings.filter((o) => o.kind === 'window').length,
                  }),
                );
              } catch (err) {
                alert(String((err as Error).message ?? err));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('plan.tool.trace')}
          </button>
        )}
        {bg && page.walls.length > 0 && (
          <button className={tool === 'align' ? 'active' : ''} onClick={() => chooseTool('align')} title={t('plan.hint.align0')}>
            {t('plan.tool.align')}
          </button>
        )}
        {bg && (
          <label className="inline" title={t('plan.bgOpacity')}>
            {t('plan.bgOpacity')}
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={bg.opacity ?? 0.45}
              onChange={(e) => {
                const v = Number(e.target.value);
                editPage((pg) => ({ ...pg, images: pg.images.map((i) => (i.background ? { ...i, opacity: v } : i)) }));
              }}
            />
          </label>
        )}
        {page.walls.length > 0 && page.symbols.some((x) => !x.autoRotate && isWallNode(x.nodeId)) && (
          // Prises, interrupteurs, appliques… : trait de raccordement tourné vers le mur le plus proche
          <button title={t('plan.faceWallsHelp')} onClick={() => editPage((pg) => ({ ...pg, symbols: pg.symbols.map((x) => (isWallNode(x.nodeId) ? { ...x, autoRotate: true } : x)) }))}>
            {t('plan.faceWalls')}
          </button>
        )}
        {selSymbol && (
          <>
            {isWallNode(selSymbol.nodeId) && !selSymbol.autoRotate && (
              <button
                onClick={() => editPage((pg) => ({ ...pg, symbols: pg.symbols.map((x) => (x.nodeId === selSymbol.nodeId ? { ...x, autoRotate: true } : x)) }))}
              >
                {t('plan.faceWall')}
              </button>
            )}
            <button onClick={() => rotateSymbol(selSymbol.nodeId, 90)}>{t('plan.rotate')}</button>
            <button onClick={() => unplaceSymbol(selSymbol.nodeId)}>{t('plan.unplace')}</button>
          </>
        )}
      </div>
      <div className="canvas-tools">
        {project_.plan.pages.map((p, i) => (
          <button key={p.id} className={i === pageIndex ? 'active' : ''} onClick={() => setPage(i)}>
            {p.name}
          </button>
        ))}
        <button
          onClick={() => {
            const name = prompt(t('plan.pageName'), t('plan.page') + ' ' + (project_.plan.pages.length + 1));
            if (name?.trim()) addPage(name.trim());
          }}
          title={t('plan.addPage')}
        >
          ＋
        </button>
        <button onClick={pz.fit}>{t('action.zoomFit')}</button>
      </div>
      {placingNode ? (
        <div className="hint">
          {t('plan.placeHint', { name: [numbering.get(placingNode.id), labelFn.title(placingNode)].filter(Boolean).join(' ') })}{' '}
          <button onClick={() => startPlacing(null)}>✕</button>
        </div>
      ) : (
        hint && <div className="hint">{hint}</div>
      )}
      {empty && tool === 'select' && <div className="empty-hint">{t('plan.empty')}</div>}
      {sel && tool === 'select' && <PlanItemPanel page={page} sel={sel} onDelete={deleteSel} />}
      {adding && (
        <PlanAddDialog
          at={adding.at}
          pos={adding.pos}
          page={page}
          initialKind={elementKind}
          onClose={() => {
            setAdding(null);
            if (tool === 'element') setTool('select');
          }}
        />
      )}
      <svg
        ref={pz.svgRef}
        className={'canvas plan' + (placingId || tool !== 'select' ? ' placing' : '') + (pz.panning ? ' panning' : '')}
        viewBox={`${pz.vb.x} ${pz.vb.y} ${pz.vb.w} ${pz.vb.h}`}
        onPointerDown={(e) => {
          if ((placingId || tool !== 'select') && e.button === 0) {
            // Les outils de dessin réagissent au clic ; on garde le glisser pour se déplacer.
            pz.onPointerDown(e, true);
            return;
          }
          if (tool === 'select' && e.button === 0) {
            const p = pz.toSvg(e.clientX, e.clientY);
            // Poignée d'extrémité du mur sélectionné
            if (sel?.type === 'wall') {
              const w = page.walls[sel.index];
              for (const end of ['a', 'b'] as const)
                if (w && dist(w[end], p) < tol() * 1.2) {
                  setItemDrag({ sel, handle: end, start: p, orig: page, moved: false });
                  (e.currentTarget as Element).setPointerCapture(e.pointerId);
                  return;
                }
            }
            const hit = hitTest(page, p, tol());
            if (hit && !(hit.type === 'image' && page.images[hit.index]?.background)) {
              setSel(hit);
              select(null);
              setItemDrag({ sel: hit, start: p, orig: page, moved: false });
              (e.currentTarget as Element).setPointerCapture(e.pointerId);
              // Appui long : déplacer toute la vue plutôt que l'élément
              pz.armLongPress(e, () => {
                setItemDrag(null);
                setPreview(null);
              });
              return;
            }
            // Zone vide (fond, intérieur d'une pièce, fond de plan) : glisser déplace tout le plan
            pz.onPointerDown(e, true);
            return;
          }
          pz.onPointerDown(e);
        }}
        onPointerMove={(e) => {
          if (pz.onPointerMove(e)) return; // la vue se déplace (zone vide ou appui long)
          if (itemDrag) {
            const p = pz.toSvg(e.clientX, e.clientY);
            const d = { x: Math.round((p.x - itemDrag.start.x) / 10) * 10, y: Math.round((p.y - itemDrag.start.y) / 10) * 10 };
            if (!itemDrag.moved && Math.hypot(d.x, d.y) < tol() * 0.4) return;
            const o = itemDrag.orig;
            const i = itemDrag.sel.index;
            let next = o;
            if (itemDrag.handle) {
              // Accroche aux extrémités des autres murs et à la grille (pas d'angle droit forcé : on peut biaiser un mur)
              const from = o.walls[i][itemDrag.handle];
              const others = { ...o, walls: o.walls.filter((w, k) => k !== i && dist(w.a, from) > 1 && dist(w.b, from) > 1) };
              next = moveWallEnd(o, i, itemDrag.handle, snapPoint(p, others, tol()));
            } else if (itemDrag.sel.type === 'label') {
              next = { ...o, labels: o.labels.map((l, k) => (k === i ? { ...l, pos: { x: l.pos.x + d.x, y: l.pos.y + d.y } } : l)) };
            } else if (itemDrag.sel.type === 'opening') {
              next = slideOpening(o, i, p);
            } else if (itemDrag.sel.type === 'wall') {
              next = translateWall(o, i, d);
            } else if (itemDrag.sel.type === 'furniture') {
              next = { ...o, furniture: (o.furniture ?? []).map((f, k) => (k === i ? { ...f, center: { x: f.center.x + d.x, y: f.center.y + d.y } } : f)) };
            } else if (itemDrag.sel.type === 'image' && !o.images[i]?.background) {
              next = { ...o, images: o.images.map((im, k) => (k === i ? { ...im, center: { x: im.center.x + d.x, y: im.center.y + d.y } } : im)) };
            }
            setPreview(next);
            if (!itemDrag.moved) setItemDrag({ ...itemDrag, moved: true });
            return;
          }
          const d = draggingRef.current;
          if (d) {
            const p = pz.toSvg(e.clientX, e.clientY);
            setDragging({ ...d, pos: { x: p.x - d.start.x, y: p.y - d.start.y }, moved: true });
            return;
          }
          if (tool !== 'select') setCursor(pz.toSvg(e.clientX, e.clientY));
        }}
        onPointerLeave={() => setCursor(null)}
        onPointerUp={(e) => {
          const panned = pz.onPointerUp();
          if (panned) return;
          if (itemDrag) {
            if (itemDrag.moved && preview) {
              const done = preview;
              editPage(() => done);
            }
            setItemDrag(null);
            setPreview(null);
            return;
          }
          const d = draggingRef.current;
          if (d) {
            if (d.moved) moveSymbol(d.id, { x: Math.round(d.pos.x), y: Math.round(d.pos.y) });
            setDragging(null);
            return;
          }
          if (e.button !== 0) return;
          lastPointer.current = { x: e.clientX, y: e.clientY };
          const p = pz.toSvg(e.clientX, e.clientY);
          if (placingId) placeSymbol(placingId, { x: Math.round(p.x), y: Math.round(p.y) });
          else onClick(p);
        }}
        onDoubleClick={() => setChain(null)}
        onContextMenu={(e) => {
          // Clic droit : ajouter un élément de l'unifilaire à cet endroit
          e.preventDefault();
          setChain(null);
          setAdding({ at: { x: e.clientX, y: e.clientY }, pos: pz.toSvg(e.clientX, e.clientY) });
        }}
      >
        <rect data-bg="1" x={pz.vb.x - 1e6} y={pz.vb.y - 1e6} width={2e6 + pz.vb.w} height={2e6 + pz.vb.h} className="canvas-bg" />
        <Walls page={preview ?? page} sel={sel} />
        {/* Poignées d'extrémité du mur sélectionné */}
        {tool === 'select' &&
          sel?.type === 'wall' &&
          (preview ?? page).walls[sel.index] &&
          (['a', 'b'] as const).map((end) => {
            const q = (preview ?? page).walls[sel.index][end];
            return <rect key={end} x={q.x - tol() * 0.6} y={q.y - tol() * 0.6} width={tol() * 1.2} height={tol() * 1.2} className="handle" />;
          })}
        {page.symbols.map((s) => {
          const node = find(s.nodeId);
          if (!node) return null;
          const pos = dragging?.id === s.nodeId ? dragging.pos : s.pos;
          const fs = byNode.get(node.id);
          const sev = fs?.some((f) => f.severity === 'error') ? 'error' : fs?.some((f) => f.severity === 'warning') ? 'warning' : null;
          const ref = numbering.get(node.id);
          return (
            <g
              key={s.nodeId}
              transform={`translate(${pos.x},${pos.y})`}
              onPointerDown={(e) => {
                if (e.button !== 0 || placingId || tool !== 'select') return;
                e.stopPropagation();
                setSel(null);
                select(node.id);
                const p = pz.toSvg(e.clientX, e.clientY);
                setDragging({ id: node.id, pos: s.pos, start: { x: p.x - s.pos.x, y: p.y - s.pos.y }, moved: false });
                (e.currentTarget.ownerSVGElement as SVGSVGElement).setPointerCapture(e.pointerId);
                pz.armLongPress(e, () => setDragging(null));
              }}
              style={{ cursor: tool === 'select' ? 'move' : undefined }}
            >
              <g transform={`scale(${S}) rotate(${s.rotation})`}>
                <PlanSymbol node={node} selected={node.id === selectedId} sev={sev} chain={selChain.has(node.id)} />
              </g>
              {ref && (
                <text x={0} y={-S * 16} fontSize={S * 9} textAnchor="middle" className={'plan-ref' + (node.id === selectedId ? ' sel-text' : selChain.has(node.id) ? ' chain' : '')}>
                  {ref}
                </text>
              )}
            </g>
          );
        })}
        {tool === 'furniture' && furnKind && cursor && (
          <g className="furniture draft" transform={`translate(${cursor.x},${cursor.y})`}>
            <FurnitureShape kind={furnKind} w={FURNITURE[furnKind].w} h={FURNITURE[furnKind].h} />
          </g>
        )}
        {/* Aperçu du mur en cours et cote */}
        {tool === 'wall' && chain && snapped && (
          <g className="draft">
            <line x1={chain.x} y1={chain.y} x2={snapped.x} y2={snapped.y} style={{ strokeWidth: thickness }} className="wall draft-wall" />
            <text x={(chain.x + snapped.x) / 2} y={(chain.y + snapped.y) / 2 - thickness} fontSize={tol() * 1.4} textAnchor="middle" className="draft-text">
              {(dist(chain, snapped) / 1000).toFixed(2).replace('.', ',')} m
            </text>
          </g>
        )}
        {snapped && <circle cx={snapped.x} cy={snapped.y} r={tol() * 0.5} className="snap" />}
        {/* Mise à l'échelle : points cliqués */}
        {tool === 'rectify' && scalePts.length > 0 && (
          <polyline
            points={[...scalePts, ...(cursor ? [cursor] : [])].map((p) => `${p.x},${p.y}`).join(' ')}
            className="measure"
            style={{ strokeWidth: tol() * 0.2, fill: 'none' }}
          />
        )}
        {tool === 'rectify' &&
          scalePts.map((p, i) => <circle key={'rc' + i} cx={p.x} cy={p.y} r={tol() * 0.5} className="snap" />)}
        {tool === 'align' &&
          scalePts.map((p, i) => (
            <g key={'al' + i} className="draft">
              <circle cx={p.x} cy={p.y} r={tol() * 0.5} className="snap" />
              <text x={p.x + tol()} y={p.y - tol() * 0.5} fontSize={tol() * 1.4} className="draft-text">
                {i % 2 ? '→ ' : ''}
                {i < 2 ? 'A' : 'B'}
              </text>
            </g>
          ))}
        {tool === 'scale' &&
          [...scalePts, ...(cursor && scalePts.length === 1 ? [cursor] : [])].map((p, i, arr) => (
            <g key={i} className="draft">
              <circle cx={p.x} cy={p.y} r={tol() * 0.5} className="snap" />
              {i === 1 && <line x1={arr[0].x} y1={arr[0].y} x2={p.x} y2={p.y} className="measure" style={{ strokeWidth: tol() * 0.2 }} />}
            </g>
          ))}
      </svg>
    </div>
  );
}

export function planBounds(page: PlanPage, plan: { width: number; height: number }) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const upd = (p: Pt) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  };
  page.walls.forEach((w) => (upd(w.a), upd(w.b)));
  page.symbols.forEach((s) => upd(s.pos));
  page.labels.forEach((l) => upd(l.pos));
  (page.furniture ?? []).forEach((f) => (upd({ x: f.center.x - f.w / 2, y: f.center.y - f.h / 2 }), upd({ x: f.center.x + f.w / 2, y: f.center.y + f.h / 2 })));
  page.images.forEach((im) => (upd({ x: im.center.x - im.w / 2, y: im.center.y - im.h / 2 }), upd({ x: im.center.x + im.w / 2, y: im.center.y + im.h / 2 })));
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: plan.width, h: plan.height };
  return { x: minX - 500, y: minY - 500, w: maxX - minX + 1000, h: maxY - minY + 1000 };
}
