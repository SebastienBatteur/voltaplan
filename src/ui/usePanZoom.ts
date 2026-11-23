import { useCallback, useEffect, useRef, useState } from 'react';

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Zoom à la molette (centré sur la souris) et déplacement par glisser
 * (clic milieu, ou clic gauche sur le fond, ou espace + glisser).
 */
/** `content` : zone à afficher ; x,y = coin haut-gauche (0,0 par défaut). */
export function usePanZoom(content: { x?: number; y?: number; w: number; h: number }, key: string) {
  const cx = content.x ?? 0;
  const cy = content.y ?? 0;
  const svgRef = useRef<SVGSVGElement>(null);
  const [vb, setVb] = useState<ViewBox>({ x: 0, y: 0, w: Math.max(content.w, 400), h: Math.max(content.h, 300) });
  const drag = useRef<{ sx: number; sy: number; vb: ViewBox; moved: boolean } | null>(null);

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

  /** `anywhere` : le glisser au clic gauche déplace la vue même hors du fond (outils de dessin). */
  const onPointerDown = (e: React.PointerEvent, anywhere = false) => {
    const onBackground = anywhere || (e.target as Element).getAttribute('data-bg') === '1';
    if (e.button === 1 || (e.button === 0 && onBackground)) {
      drag.current = { sx: e.clientX, sy: e.clientY, vb, moved: false };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const s = Math.max(d.vb.w / r.width, d.vb.h / r.height);
    const dx = (e.clientX - d.sx) * s;
    const dy = (e.clientY - d.sy) * s;
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3) d.moved = true;
    setVb({ ...d.vb, x: d.vb.x - dx, y: d.vb.y - dy });
  };
  /** Renvoie true si le geste était un déplacement (et pas un simple clic). */
  const onPointerUp = (): boolean => {
    const moved = drag.current?.moved ?? false;
    drag.current = null;
    return moved;
  };

  /** Centre la vue sur un point s'il est hors champ (ou si force). */
  const reveal = useCallback((x: number, y: number, force = false) => {
    setVb((v) => {
      const margin = v.w * 0.08;
      const inside = x > v.x + margin && x < v.x + v.w - margin && y > v.y + margin && y < v.y + v.h - margin;
      if (inside && !force) return v;
      return { ...v, x: x - v.w / 2, y: y - v.h / 2 };
    });
  }, []);

  return { svgRef, vb, fit, toSvg, reveal, onPointerDown, onPointerMove, onPointerUp, setVb };
}
