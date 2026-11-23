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
 *  - appui long (LONG_PRESS ms sans bouger) n'importe où, y compris sur un élément : la vue suit ensuite
 *    le doigt ou la souris (utile au doigt sur tablette, et quand le plan est couvert d'éléments).
 * La capture du pointeur n'est prise qu'une fois le geste commencé : un simple clic sélectionne toujours.
 */
export const LONG_PRESS = 450;
const MOVE_TOL = 5; // px : au-delà, ce n'est plus un appui long
/** `content` : zone à afficher ; x,y = coin haut-gauche (0,0 par défaut). */
export function usePanZoom(content: { x?: number; y?: number; w: number; h: number }, key: string) {
  const cx = content.x ?? 0;
  const cy = content.y ?? 0;
  const svgRef = useRef<SVGSVGElement>(null);
  const [vb, setVb] = useState<ViewBox>({ x: 0, y: 0, w: Math.max(content.w, 400), h: Math.max(content.h, 300) });
  const drag = useRef<{ sx: number; sy: number; vb: ViewBox; moved: boolean; pointerId: number } | null>(null);
  const press = useRef<{ timer: number; sx: number; sy: number; pointerId: number; onStart?: () => void } | null>(null);
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
      const r = el.getBoundingClientRect();
      // preserveAspectRatio="xMidYMid meet" : on calcule l'échelle réelle
      const s = Math.max(vb.w / r.width, vb.h / r.height);
      const ox = (r.width * s - vb.w) / 2;
      const oy = (r.height * s - vb.h) / 2;
      return { x: vb.x - ox + (clientX - r.left) * s, y: vb.y - oy + (clientY - r.top) * s };
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
        const w = Math.min(Math.max(v.w * f, 50), 200000);
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
   * `onStart` permet à l'appelant d'annuler son propre geste (ex. déplacement d'un symbole).
   */
  const armLongPress = (e: React.PointerEvent, onStart?: () => void) => {
    if (e.button !== 0) return;
    cancelPress();
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

  /** `anywhere` : le glisser au clic gauche déplace la vue même hors du fond (outils de dessin, zones vides). */
  const onPointerDown = (e: React.PointerEvent, anywhere = false) => {
    const onBackground = anywhere || (e.target as Element).getAttribute('data-bg') === '1';
    if (e.button === 1 || (e.button === 0 && onBackground)) startPan(e.clientX, e.clientY, e.pointerId, e.button === 1);
    else armLongPress(e);
  };
  /** Renvoie true si la vue est en train d'être déplacée (l'appelant ignore alors le mouvement). */
  const onPointerMove = (e: React.PointerEvent): boolean => {
    const p = press.current;
    if (p && Math.abs(e.clientX - p.sx) + Math.abs(e.clientY - p.sy) > MOVE_TOL) cancelPress();
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
  /** Renvoie true si le geste était un déplacement de la vue (et pas un simple clic). */
  const onPointerUp = (): boolean => {
    cancelPress();
    const moved = drag.current?.moved ?? false;
    drag.current = null;
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
