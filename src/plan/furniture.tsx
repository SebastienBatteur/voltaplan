/**
 * Mobilier du plan (pictogrammes vectoriels, à l'échelle, en mm).
 * Chaque meuble est dessiné dans son rectangle [-w/2, w/2] × [-h/2, h/2] ; le haut (y négatif) est le dos
 * (tête de lit, dossier de canapé, mur côté réservoir du WC…). Traits fins, comme sur les plans d'architecte.
 */

export const FURNITURE = {
  // Séjour
  sofa: { w: 2000, h: 900, group: 'living' },
  armchair: { w: 850, h: 850, group: 'living' },
  coffeeTable: { w: 1000, h: 600, group: 'living' },
  diningTable: { w: 1800, h: 1500, group: 'living' },
  roundTable: { w: 1200, h: 1200, group: 'living' },
  tvUnit: { w: 1600, h: 450, group: 'living' },
  // Chambres
  bedDouble: { w: 1600, h: 2000, group: 'bedroom' },
  bedSingle: { w: 900, h: 2000, group: 'bedroom' },
  wardrobe: { w: 1200, h: 600, group: 'bedroom' },
  desk: { w: 1400, h: 1100, group: 'bedroom' },
  // Cuisine et buanderie
  counter: { w: 600, h: 600, group: 'kitchen' },
  sink: { w: 800, h: 600, group: 'kitchen' },
  hob: { w: 600, h: 600, group: 'kitchen' },
  fridge: { w: 600, h: 650, group: 'kitchen' },
  washer: { w: 600, h: 600, group: 'kitchen' },
  // Salle de bains
  bathtub: { w: 1700, h: 750, group: 'bathroom' },
  shower: { w: 900, h: 900, group: 'bathroom' },
  wc: { w: 400, h: 650, group: 'bathroom' },
  washbasin: { w: 600, h: 450, group: 'bathroom' },
  doubleWashbasin: { w: 1200, h: 500, group: 'bathroom' },
  // Divers
  car: { w: 1800, h: 4400, group: 'other' },
  stairs: { w: 1000, h: 3000, group: 'other' },
} as const;

export type FurnitureKind = keyof typeof FURNITURE;
export const FURNITURE_GROUPS = ['living', 'bedroom', 'kitchen', 'bathroom', 'other'] as const;

/** Dessin d'un meuble centré en (0,0), taille w × h (mm). */
export function FurnitureShape({ kind, w, h }: { kind: string; w: number; h: number }): JSX.Element {
  const x0 = -w / 2;
  const y0 = -h / 2;
  const R = (x: number, y: number, ww: number, hh: number, rx = 0, key?: string) => <rect key={key} x={x} y={y} width={ww} height={hh} rx={rx} />;
  const m = Math.min(w, h);
  switch (kind) {
    case 'sofa': {
      const back = h * 0.22;
      const arm = Math.min(w * 0.12, 220);
      const n = w > 1500 ? 3 : 2;
      const cw = (w - 2 * arm) / n;
      return (
        <g>
          {R(x0, y0, w, h, 60)}
          {R(x0 + arm, y0, w - 2 * arm, back)}
          {Array.from({ length: n }).map((_, i) => R(x0 + arm + i * cw, y0 + back, cw, h - back, 30, 'c' + i))}
        </g>
      );
    }
    case 'armchair':
      return (
        <g>
          {R(x0, y0, w, h, 60)}
          {R(x0 + w * 0.18, y0, w * 0.64, h * 0.25)}
          {R(x0 + w * 0.18, y0 + h * 0.25, w * 0.64, h * 0.75, 30)}
        </g>
      );
    case 'coffeeTable':
    case 'tvUnit':
      return (
        <g>
          {R(x0, y0, w, h, 20)}
          {kind === 'tvUnit' && <line x1={x0 + w * 0.15} y1={y0 + h * 0.3} x2={x0 + w * 0.85} y2={y0 + h * 0.3} />}
        </g>
      );
    case 'diningTable': {
      const tw = w * 0.85;
      const th = h * 0.55;
      const n = Math.max(2, Math.round(tw / 600));
      const cw = Math.min(450, (tw / n) * 0.8);
      const chairs: JSX.Element[] = [];
      for (let i = 0; i < n; i++) {
        const cx = -tw / 2 + (tw / n) * (i + 0.5) - cw / 2;
        chairs.push(R(cx, y0, cw, (h - th) / 2 - 40, 40, 't' + i), R(cx, th / 2 + 40, cw, (h - th) / 2 - 40, 40, 'b' + i));
      }
      return (
        <g>
          {chairs}
          {R(-tw / 2, -th / 2, tw, th, 20)}
        </g>
      );
    }
    case 'roundTable': {
      const r = m * 0.32;
      const cs = m * 0.2;
      return (
        <g>
          {[0, 90, 180, 270].map((a) => (
            <rect key={a} x={-cs / 2} y={-m / 2} width={cs} height={cs} rx={30} transform={`rotate(${a})`} />
          ))}
          <circle cx={0} cy={0} r={r} />
        </g>
      );
    }
    case 'bedDouble':
    case 'bedSingle': {
      const pw = kind === 'bedDouble' ? w * 0.4 : w * 0.75;
      const ph = Math.min(350, h * 0.17);
      return (
        <g>
          {R(x0, y0, w, h, 30)}
          {(kind === 'bedDouble' ? [-w / 4, w / 4] : [0]).map((c, i) => R(c - pw / 2, y0 + 80, pw, ph, 60, 'p' + i))}
          <line x1={x0} y1={y0 + h * 0.32} x2={x0 + w} y2={y0 + h * 0.32} />
          <line x1={x0 + w} y1={y0 + h * 0.32} x2={x0 + w * 0.7} y2={y0 + h * 0.45} />
        </g>
      );
    }
    case 'wardrobe':
      return (
        <g>
          {R(x0, y0, w, h)}
          <line x1={x0} y1={0} x2={x0 + w} y2={0} strokeDasharray="60 40" />
          <line x1={x0} y1={y0 + h} x2={x0 + w} y2={y0} />
        </g>
      );
    case 'desk':
      return (
        <g>
          {R(x0, y0, w, h * 0.6)}
          {R(-250, y0 + h * 0.6 + 50, 500, h * 0.4 - 50, 80)}
        </g>
      );
    case 'counter':
      return <g>{R(x0, y0, w, h)}</g>;
    case 'sink':
      return (
        <g>
          {R(x0, y0, w, h)}
          {R(x0 + w * 0.12, y0 + h * 0.18, w * 0.5, h * 0.64, 40)}
          <circle cx={x0 + w * 0.8} cy={y0 + h * 0.3} r={m * 0.06} />
        </g>
      );
    case 'hob':
      return (
        <g>
          {R(x0, y0, w, h)}
          {[
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ].map(([sx, sy], i) => (
            <circle key={i} cx={(sx * w) / 4.5} cy={(sy * h) / 4.5} r={m * (i % 3 === 0 ? 0.15 : 0.11)} />
          ))}
        </g>
      );
    case 'fridge':
      return (
        <g>
          {R(x0, y0, w, h)}
          <line x1={x0} y1={y0 + h * 0.85} x2={x0 + w} y2={y0 + h * 0.85} />
          {/* flocon : compris dans toutes les langues */}
          {[0, 60, 120].map((r) => (
            <line key={r} x1={-m * 0.22} y1={-h * 0.06} x2={m * 0.22} y2={-h * 0.06} transform={`rotate(${r} 0 ${-h * 0.06})`} />
          ))}
        </g>
      );
    case 'washer':
      return (
        <g>
          {R(x0, y0, w, h)}
          <circle cx={0} cy={h * 0.05} r={m * 0.32} />
          <circle cx={0} cy={h * 0.05} r={m * 0.2} />
        </g>
      );
    case 'bathtub':
      return (
        <g>
          {R(x0, y0, w, h, 40)}
          {R(x0 + 80, y0 + 80, w - 160, h - 160, Math.min(h, w) * 0.35)}
          <circle cx={x0 + w - 250} cy={0} r={40} />
        </g>
      );
    case 'shower':
      return (
        <g>
          {R(x0, y0, w, h)}
          <line x1={x0} y1={y0} x2={x0 + w} y2={y0 + h} />
          <line x1={x0 + w} y1={y0} x2={x0} y2={y0 + h} />
          <circle cx={0} cy={0} r={m * 0.06} />
        </g>
      );
    case 'wc':
      return (
        <g>
          {R(x0, y0, w, h * 0.28, 30)}
          <ellipse cx={0} cy={y0 + h * 0.28 + h * 0.34} rx={w * 0.42} ry={h * 0.34} />
          <ellipse cx={0} cy={y0 + h * 0.28 + h * 0.38} rx={w * 0.26} ry={h * 0.24} />
        </g>
      );
    case 'washbasin':
    case 'doubleWashbasin': {
      const n = kind === 'doubleWashbasin' ? 2 : 1;
      return (
        <g>
          {R(x0, y0, w, h, 30)}
          {Array.from({ length: n }).map((_, i) => (
            <ellipse key={i} cx={x0 + (w / n) * (i + 0.5)} cy={h * 0.08} rx={(w / n) * 0.32} ry={h * 0.3} />
          ))}
        </g>
      );
    }
    case 'car': {
      return (
        <g>
          <rect x={x0} y={y0} width={w} height={h} rx={w * 0.3} />
          {/* pare-brise et lunette arrière */}
          <path d={`M${x0 + w * 0.12} ${y0 + h * 0.3} Q0 ${y0 + h * 0.22} ${x0 + w * 0.88} ${y0 + h * 0.3}`} fill="none" />
          <path d={`M${x0 + w * 0.15} ${y0 + h * 0.78} Q0 ${y0 + h * 0.84} ${x0 + w * 0.85} ${y0 + h * 0.78}`} fill="none" />
          <rect x={x0 + w * 0.15} y={y0 + h * 0.32} width={w * 0.7} height={h * 0.44} rx={w * 0.1} />
        </g>
      );
    }
    case 'stairs': {
      const n = Math.max(3, Math.round(h / 250));
      return (
        <g>
          {R(x0, y0, w, h)}
          {Array.from({ length: n - 1 }).map((_, i) => (
            <line key={i} x1={x0} y1={y0 + (h / n) * (i + 1)} x2={x0 + w} y2={y0 + (h / n) * (i + 1)} />
          ))}
          {/* flèche de montée */}
          <path d={`M0 ${y0 + h - 150} V${y0 + 200} m-120 200 l120 -200 l120 200`} fill="none" />
        </g>
      );
    }
    default:
      return <g>{R(x0, y0, w, h)}</g>;
  }
}
