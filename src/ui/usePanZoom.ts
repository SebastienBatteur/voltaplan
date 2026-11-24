import { useCallback, useEffect, useRef, useState } from 'react';

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Zoom à la molette (centré sur la souris) et déplacement de toute la vue :
 *  - glisser depuis une zone vide (ou au clic milieu) ;
 *  - appui long (LONG_PRESS ms sans bouger) sur un élément déplaçable : la vue suit ensuite le doigt ou la
 *    souris (utile au doigt sur tablette, et quand le plan est couvert d'éléments).
 * Au doigt ou au stylet (écran tactile) :
 *  - pincer à deux doigts zoome autour du milieu des doigts, qui déplacent aussi la vue ;
 *  - avec `holdMenu`, un appui long là où un glisser déplacerait la vue ouvre le même menu que le clic droit
 *    (événement « contextmenu » envoyé à l'élément touché) : iOS n'envoie jamais ce clic droit.
 * La capture du pointeur n'est prise qu'une fois le geste commencé : un simple clic sélectionne toujours.
 */
export const LONG_PRESS = 450;
const MOVE_TOL = 5; // px : au-delà, ce n'est plus un appui long
const MIN_W = 50;
const MAX_W = 200000;

interface Pt {
  x: number;
  y: number;
}
interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Point du dessin sous un point de l'écran (preserveAspectRatio="xMidYMid meet"). */
export function screenToSvg(vb: ViewBox, r: Rect, clientX: number, clientY: number): Pt {
  const s = Math.max(vb.w / r.width, vb.h / r.height);
  const ox = (r.width * s - vb.w) / 2;
  const oy = (r.height * s - vb.h) / 2;
  return { x: vb.x - ox + (clientX - r.left) * s, y: vb.y - oy + (clientY - r.top) * s };
}

/**
 * Vue après un pincement : `vb0` au début du geste, doigts écartés de `d0` autour de `m0` ; maintenant écartés
 * de `d` autour de `m`. Le point du dessin qui était sous `m0` se retrouve sous `m` (zoom et déplacement).
 */
export function pinchViewBox(vb0: ViewBox, r: Rect, m0: Pt, d0: number, m: Pt, d: number): ViewBox {
  const w = Math.min(Math.max((vb0.w * d0) / Math.max(d, 1), MIN_W), MAX_W);
  const k = w / vb0.w;
  const p = screenToSvg(vb0, r, m0.x, m0.y);
  const s0 = Math.max(vb0.w / r.width, vb0.h / r.height);
  const ox0 = (r.width * s0 - vb0.w) / 2;
  const oy0 = (r.height * s0 - vb0.h) / 2;
  return { x: p.x - k * ((m.x - r.left) * s0 - ox0), y: p.y - k * ((m.y - r.top) * s0 - oy0), w, h: vb0.h * k };
}

/** `content` : zone à afficher ; x,y = coin haut-gauche (0,0 par défaut). */
export function usePanZoom(content: { x?: number; y?: number; w: number; h: number }, key: string, opts: { holdMenu?: boolean } = {}) {
  const cx = content.x ?? 0;
  const cy = content.y ?? 0;
  const holdMenu = !!opts.holdMenu;
  const svgRef = useRef<SVGSVGElement>(null);
  const [vb, setVb] = useState<ViewBox>({ x: 0, y: 0, w: Math.max(content.w, 400), h: Math.max(content.h, 300) });
  const drag = useRef<{ sx: number; sy: number; vb: ViewBox; moved: boolean; pointerId: number } | null>(null);
  const press = useRef<{ timer: number; sx: number; sy: number; pointerId: number; onStart?: () => void } | null>(null);
  /** Appui long au doigt qui ouvrira le menu « clic droit ». */
  const hold = useRef<{ timer: number; sx: number; sy: number } | null>(null);
  /** Moment du dernier menu ouvert par appui long (le « contextmenu » natif d'Android qui suit est ignoré). */
  const heldAt = useRef(0);
  /** Geste du doigt déjà consommé (menu ouvert ou pincement) : la suite n'est ni un glisser ni un clic. */
  const consumed = useRef(false);
  /** Annule le geste en cours de l'appelant (déplacement d'un élément) quand un pincement commence. */
  const cancelOwner = useRef<(() => void) | undefined>(undefined);
  /** Doigts posés sur le dessin, et pincement en cours. */
  const pointersRef = useRef(new Map<number, Pt>());
  const pinchRef = useRef<{ vb0: ViewBox; m0: Pt; d0: number } | null>(null);
  const vbRef = useRef<ViewBox>(vb);
  vbRef.current = vb;
  const [panning, setPanning] = useState(false);

  const fit = useCallback(() => {
    const el = svgRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Pas encore affiché (taille nulle) : on réessaiera au prochain dessin
    if (r.width < 1 || r.height < 1) {
      requestAnimationFrame(() => {
        const r2 = el.getBoundingClientRect();
        if (r2.width >= 1 && r2.height >= 1) fitRef.current?.();
      });
      return;
    }
    const ratio = r.width / Math.max(r.height, 1);
    let w = content.w + 40;
    let h = content.h + 40;
    if (w / h > ratio) h = w / ratio;
    else w = h * ratio;
    setVb({ x: cx - 20 - (w - content.w - 40) / 2, y: cy - 20 - (h - content.h - 40) / 2, w, h });
  }, [cx, cy, content.w, content.h]);

  const fitRef = useRef<(() => void) | null>(null);
  fitRef.current = fit;

  // Ajuster à chaque nouveau projet / nouvelle page
  useEffect(() => {
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const toSvg = useCallback(
    (clientX: number, clientY: number) => {
      const el = svgRef.current;
      if (!el) return { x: 0, y: 0 };
      return screenToSvg(vb, el.getBoundingClientRect(), clientX, clientY);
    },
    [vb],
  );

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toSvg(e.clientX, e.clientY);
      const f = Math.exp(e.deltaY * 0.0015);
      setVb((v) => {
        const w = Math.min(Math.max(v.w * f, MIN_W), MAX_W);
        const k = w / v.w;
        return { x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k, w, h: v.h * k };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [toSvg]);

  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };
  const cancelHold = () => {
    if (hold.current) clearTimeout(hold.current.timer);
    hold.current = null;
  };

  // Pincement à deux doigts, et menu par appui long. Écouteurs natifs en phase de capture sur le dessin : ils
  // passent avant les gestionnaires React, qui ne voient donc ni le second doigt ni les mouvements du pincement.
  // Rattachés à chaque rendu (le dessin peut n'apparaître qu'après coup) ; l'état du geste reste dans des refs.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const pointers = pointersRef.current;
    const two = () => {
      const [a, b] = [...pointers.values()];
      return { m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, d: Math.hypot(a.x - b.x, a.y - b.y) };
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      // Premier doigt d'un nouveau geste : on oublie tout doigt resté inscrit (relâché hors du dessin)
      if (e.isPrimary) {
        pointers.clear();
        pinchRef.current = null;
      }
      if (pointers.size === 0) consumed.current = false;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size < 2) return;
      e.stopPropagation();
      if (pointers.size > 2) return;
      // Second doigt : le geste devient un pincement, tout le reste est annulé
      clearTimeout(press.current?.timer);
      press.current = null;
      clearTimeout(hold.current?.timer);
      hold.current = null;
      cancelOwner.current?.();
      cancelOwner.current = undefined;
      drag.current = null;
      setPanning(false);
      consumed.current = true;
      const { m, d } = two();
      pinchRef.current = { vb0: vbRef.current, m0: m, d0: Math.max(d, 1) };
    };
    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pinch = pinchRef.current;
      if (!pinch || pointers.size < 2) return;
      e.stopPropagation();
      const { m, d } = two();
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      setVb(pinchViewBox(pinch.vb0, r, pinch.m0, pinch.d0, m, d));
    };
    const up = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return;
      if (pointers.size < 2) pinchRef.current = null;
    };
    const ctx = (e: MouseEvent) => {
      if (!e.isTrusted) return; // le nôtre (appui long)
      if (hold.current) {
        // Le navigateur (Android) a devancé notre minuterie : son « contextmenu » ouvre le menu
        clearTimeout(hold.current.timer);
        hold.current = null;
        drag.current = null;
        heldAt.current = Date.now();
        consumed.current = true;
      } else if (Date.now() - heldAt.current < 1500) {
        // Menu déjà ouvert par l'appui long : pas de second
        e.preventDefault();
        e.stopPropagation();
      }
    };
    el.addEventListener('pointerdown', down, true);
    el.addEventListener('pointermove', move, true);
    el.addEventListener('pointerup', up, true);
    el.addEventListener('pointercancel', up, true);
    el.addEventListener('contextmenu', ctx, true);
    return () => {
      el.removeEventListener('pointerdown', down, true);
      el.removeEventListener('pointermove', move, true);
      el.removeEventListener('pointerup', up, true);
      el.removeEventListener('pointercancel', up, true);
      el.removeEventListener('contextmenu', ctx, true);
    };
  });

  /** Démarre le déplacement de la vue depuis ce point de l'écran. */
  const startPan = (clientX: number, clientY: number, pointerId: number, moved = false) => {
    cancelPress();
    drag.current = { sx: clientX, sy: clientY, vb: vbRef.current, moved, pointerId };
    if (moved) {
      setPanning(true);
      try {
        svgRef.current?.setPointerCapture(pointerId);
      } catch {
        /* pointeur déjà relâché */
      }
    }
  };

  /**
   * Arme l'appui long : si le pointeur reste immobile LONG_PRESS ms, la vue se déplace avec lui.
   * `onStart` permet à l'appelant d'annuler son propre geste (ex. déplacement d'un symbole) ; il sert aussi
   * quand un second doigt commence un pincement.
   */
  const armLongPress = (e: React.PointerEvent, onStart?: () => void) => {
    if (e.button !== 0) return;
    cancelPress();
    cancelOwner.current = onStart;
    const { clientX, clientY, pointerId } = e;
    const timer = window.setTimeout(() => {
      const p = press.current;
      if (!p) return;
      p.onStart?.();
      startPan(p.sx, p.sy, p.pointerId, true);
      navigator.vibrate?.(15);
    }, LONG_PRESS);
    press.current = { timer, sx: clientX, sy: clientY, pointerId, onStart };
  };

  /** Arme le menu par appui long (doigt ou stylet seulement : la souris a le clic droit). */
  const armHold = (e: React.PointerEvent) => {
    cancelHold();
    if (!holdMenu || e.pointerType === 'mouse' || e.button !== 0) return;
    const { clientX, clientY } = e;
    const target = e.target as Element;
    const timer = window.setTimeout(() => {
      if (!hold.current) return;
      hold.current = null;
      drag.current = null;
      setPanning(false);
      heldAt.current = Date.now();
      consumed.current = true;
      navigator.vibrate?.(15);
      const to = target.isConnected ? target : svgRef.current;
      to?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX, clientY, button: 2 }));
    }, LONG_PRESS);
    hold.current = { timer, sx: clientX, sy: clientY };
  };

  /** `anywhere` : le glisser au clic gauche déplace la vue même hors du fond (outils de dessin, zones vides). */
  const onPointerDown = (e: React.PointerEvent, anywhere = false) => {
    cancelOwner.current = undefined;
    if (e.pointerType === 'mouse') consumed.current = false;
    const onBackground = anywhere || (e.target as Element).getAttribute('data-bg') === '1';
    if (e.button === 1 || (e.button === 0 && onBackground)) {
      startPan(e.clientX, e.clientY, e.pointerId, e.button === 1);
      armHold(e);
    } else armLongPress(e);
  };
  /** Renvoie true si la vue est en train d'être déplacée (l'appelant ignore alors le mouvement). */
  const onPointerMove = (e: React.PointerEvent): boolean => {
    const p = press.current;
    if (p && Math.abs(e.clientX - p.sx) + Math.abs(e.clientY - p.sy) > MOVE_TOL) cancelPress();
    const h = hold.current;
    if (h && Math.abs(e.clientX - h.sx) + Math.abs(e.clientY - h.sy) > MOVE_TOL) cancelHold();
    if (consumed.current && e.pointerType !== 'mouse') return true;
    const d = drag.current;
    if (!d || !svgRef.current) return false;
    const r = svgRef.current.getBoundingClientRect();
    const s = Math.max(d.vb.w / r.width, d.vb.h / r.height);
    if (!d.moved && Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3) {
      d.moved = true;
      setPanning(true);
      try {
        svgRef.current.setPointerCapture(d.pointerId);
      } catch {
        /* ignore */
      }
    }
    if (!d.moved) return false;
    setVb({ ...d.vb, x: d.vb.x - (e.clientX - d.sx) * s, y: d.vb.y - (e.clientY - d.sy) * s });
    return true;
  };
  /** Renvoie true si le geste était un déplacement de la vue, un pincement ou un appui long (pas un simple clic). */
  const onPointerUp = (): boolean => {
    cancelPress();
    cancelHold();
    const moved = (drag.current?.moved ?? false) || consumed.current;
    drag.current = null;
    cancelOwner.current = undefined;
    setPanning(false);
    return moved;
  };
  const isPanning = () => !!drag.current?.moved;

  /** Centre la vue sur un point s'il est hors champ (ou si force). */
  const reveal = useCallback((x: number, y: number, force = false) => {
    setVb((v) => {
      const margin = v.w * 0.08;
      const inside = x > v.x + margin && x < v.x + v.w - margin && y > v.y + margin && y < v.y + v.h - margin;
      if (inside && !force) return v;
      return { ...v, x: x - v.w / 2, y: y - v.h / 2 };
    });
  }, []);

  return { svgRef, vb, fit, toSvg, reveal, onPointerDown, onPointerMove, onPointerUp, setVb, armLongPress, startPan, isPanning, panning };
}
