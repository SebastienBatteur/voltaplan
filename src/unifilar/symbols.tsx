/**
 * Symboles graphiques du RGIE (Livre 1, chapitre 2.13, tableau 2.23).
 *
 * Orientation 'v' (structure) : le fil entre en haut (0,0) et sort en bas (0,h).
 *   Sur l'unifilaire « de bas en haut », le bloc est placé tel quel : seule sa position change.
 * Orientation 'h' (points d'utilisation) : le fil arrive de la gauche en (0,0) et le symbole s'étend vers la droite.
 *   C'est le symbole du plan de position tourné d'un quart de tour, comme dans la figure 3.1 du RGIE.
 * Les mêmes symboles servent sur l'unifilaire et sur le plan de position.
 */
import type { ElNode } from '../model/types';

/** Unité de commande domotique (tableau 2.23 J) : au moins un type de commande coché. */
export const domoticControls = (n: ElNode) => (['ctlPush', 'ctlWireless', 'ctlTimer', 'ctlDetection', 'ctlExtension'] as const).filter((k) => n.props[k] === true);
const framed = (n: ElNode) => (n.kind === 'switch' || n.kind === 'socket') && (n.props.inBoard === true || domoticControls(n).length > 0);

export function symbolSize(n: ElNode, orient: 'v' | 'h'): { w: number; h: number } {
  const s = baseSymbolSize(n, orient);
  if (orient === 'h' && framed(n)) return { w: s.w + (n.props.ctlExtension === true ? 14 : 4), h: s.h + (domoticControls(n).length ? 12 : 6) };
  return s;
}

function baseSymbolSize(n: ElNode, orient: 'v' | 'h'): { w: number; h: number } {
  if (orient === 'v') {
    switch (n.kind) {
      case 'origin':
        return { w: 16, h: 30 };
      case 'meter':
        return { w: 30, h: 46 };
      case 'protection':
        return n.props.device === 'fuse' ? { w: 16, h: 48 } : { w: 24, h: 56 };
      case 'cable':
        return { w: 14, h: 34 };
      case 'earthBar':
        return { w: 30, h: 18 };
      case 'earth':
        return { w: 24, h: 30 };
      default:
        return { w: 30, h: 40 };
    }
  }
  switch (n.kind) {
    case 'socket': {
      const c = socketArcs(n);
      return { w: 24 + (c - 1) * 7 + (n.props.splashProof === true || Number(n.props.count) > 3 ? 8 : 0), h: 28 };
    }
    case 'switch':
      return { w: n.props.signalLamp === true ? 44 : 32, h: 32 };
    case 'pushButton':
      return { w: n.props.protected === true ? 28 : 22, h: 22 };
    case 'light':
      return { w: 32, h: 24 };
    case 'cable':
      return { w: 44, h: 10 };
    case 'junctionBox':
      return { w: 24, h: 20 };
    case 'bell':
      return { w: n.props.bellType === 'horn' ? 30 : 26, h: 20 };
    case 'motor':
      return { w: 28, h: 24 };
    case 'appliance':
      return { w: n.props.applianceType === 'storageHeaterFan' ? 38 : 30, h: 24 };
    case 'board':
      return { w: 40, h: 16 };
    case 'meter':
      return { w: 32, h: 20 };
    default:
      return { w: 32, h: 24 };
  }
}

const socketArcs = (n: ElNode) => {
  const c = Number(n.props.count ?? 1) || 1;
  return c > 3 ? 1 : c;
};

const APPLIANCE_ABBR: Record<string, string> = {
  heatPump: 'PAC',
  boiler: 'Chaud.',
};

const KIND_ABBR: Record<string, string> = {
  relay: 'R',
  domotic: 'Dom',
  other: '?',
};

export function abbr(n: ElNode): string {
  if (n.kind === 'appliance') return APPLIANCE_ABBR[String(n.props.applianceType)] ?? String(n.props.name ?? '').slice(0, 5);
  if (n.kind === 'relay') return ({ teleswitch: 'TR', contactor: 'K', timer: 't' } as Record<string, string>)[String(n.props.relayType)] ?? 'R';
  return KIND_ABBR[n.kind] ?? n.kind.slice(0, 3);
}

/** Caractéristiques d'une source sous son symbole (tableau 2.23 H : Pmax, U prim./U sec., quantité). */
function SourceNote({ lines }: { lines: string[] }) {
  const l = lines.filter(Boolean);
  return (
    <>
      {l.map((t, i) => (
        <text key={i} x={6} y={17 + i * 7} fontSize={6}>
          {t}
        </text>
      ))}
    </>
  );
}

/** Petits traits au bout du levier d'un interrupteur (1 = unipolaire, 2 = bipolaire…). */
function Ticks({ x, y, n, dir = 1 }: { x: number; y: number; n: number; dir?: 1 | -1 }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <line key={i} x1={x - dir * i * 1.6} y1={y + dir * i * 3.6} x2={x - dir * i * 1.6 + dir * 5} y2={y + dir * i * 3.6} />
      ))}
    </>
  );
}

/** Symbole vertical (structure). */
function Vertical({ n }: { n: ElNode }) {
  const { h } = symbolSize(n, 'v');
  switch (n.kind) {
    case 'origin':
      // Coffret de branchement
      return (
        <g>
          <line x1={0} y1={0} x2={0} y2={h} />
          <rect x={-5} y={6} width={10} height={18} className="nofill" />
          <circle cx={0} cy={15} r={2} className="fill" />
        </g>
      );
    case 'meter':
      return (
        <g>
          <line x1={0} y1={0} x2={0} y2={8} />
          <rect x={-15} y={8} width={30} height={30} className="bg" />
          <line x1={-15} y1={15} x2={15} y2={15} />
          <text x={0} y={30} textAnchor="middle" fontSize={9}>
            kWh
          </text>
          <line x1={0} y1={38} x2={0} y2={h} />
        </g>
      );
    case 'protection': {
      const device = String(n.props.device ?? 'mcb');
      if (device === 'fuse')
        return (
          <g>
            <line x1={0} y1={0} x2={0} y2={h} />
            <rect x={-5} y={12} width={10} height={24} className="bg" />
            <line x1={0} y1={12} x2={0} y2={36} />
          </g>
        );
      const rcd = device === 'rcd' || device === 'rcbo' || Number(n.props.residualCurrent) > 0;
      const auto = device === 'mcb' || device === 'rcbo';
      return (
        <g>
          {/* contact fixe */}
          <line x1={0} y1={0} x2={0} y2={16} />
          {/* levier ouvert */}
          <line x1={0} y1={40} x2={-10} y2={19} />
          {/* marque du déclencheur automatique (rectangle noir au bout du levier) */}
          {auto && <line x1={-11.5} y1={15} x2={-8.5} y2={21.5} style={{ strokeWidth: 4.5 }} />}
          <line x1={0} y1={40} x2={0} y2={h} />
          {rcd && (
            <>
              <ellipse cx={0} cy={47} rx={8} ry={3.5} className="nofill" />
              <path d="M-8 47 H-14 V30 H-6" className="nofill" strokeDasharray="2 2" />
            </>
          )}
        </g>
      );
    }
    case 'cable': {
      const nC = Number(n.props.conductors) || 0;
      const m = String(n.props.method ?? '');
      return (
        <g>
          <line x1={0} y1={0} x2={0} y2={h} />
          <line x1={-5} y1={h / 2 + 4} x2={5} y2={h / 2 - 4} />
          {nC > 0 && (
            <text x={-7} y={h / 2 - 3} fontSize={7} textAnchor="end">
              {nC}
            </text>
          )}
          <MethodMark method={m} conduit={n.props.inConduit === true} x={0} y={h / 2 + 12} vertical />
        </g>
      );
    }
    case 'earthBar':
      // Sectionneur de terre (tableau 2.23 B, figure 3.1) : ─┤├──┤├─, ici vertical sur le fil
      return (
        <g>
          <line x1={0} y1={0} x2={0} y2={3} />
          <line x1={-6} y1={3} x2={6} y2={3} />
          <line x1={-6} y1={6} x2={6} y2={6} />
          <line x1={0} y1={6} x2={0} y2={12} />
          <line x1={-6} y1={12} x2={6} y2={12} />
          <line x1={-6} y1={15} x2={6} y2={15} />
          <line x1={0} y1={15} x2={0} y2={h} />
        </g>
      );
    case 'earth':
      return (
        <g>
          <line x1={0} y1={0} x2={0} y2={14} />
          <line x1={-12} y1={14} x2={12} y2={14} />
          <line x1={-8} y1={19} x2={8} y2={19} />
          <line x1={-4} y1={24} x2={4} y2={24} />
        </g>
      );
    default:
      return (
        <g>
          <line x1={0} y1={0} x2={0} y2={8} />
          <g transform="translate(-15,20)">
            <Horizontal n={n} bare />
          </g>
          <line x1={0} y1={32} x2={0} y2={h} />
        </g>
      );
  }
}

/** Marque du mode de pose (tableau 2.23 C) : encastré ⊓, apparent ‾⊓, souterrain ≡, aérien ○, conduit ○. */
function MethodMark({ method, conduit, x, y, vertical }: { method: string; conduit: boolean; x: number; y: number; vertical?: boolean }) {
  const t = vertical ? `translate(${x - 9},${y}) rotate(90)` : `translate(${x},${y})`;
  let mark: JSX.Element | null = null;
  if (method === 'inWall' || method === 'onWall')
    mark = (
      <>
        <path d="M-3 4 V0 H3 V4" className="nofill" />
        {method === 'onWall' && <line x1={-4} y1={-3} x2={4} y2={-3} />}
      </>
    );
  else if (method === 'underground')
    mark = (
      <>
        <line x1={-4} y1={-3} x2={4} y2={-3} />
        <line x1={-3} y1={-1} x2={3} y2={-1} />
        <line x1={-2} y1={1} x2={2} y2={1} />
      </>
    );
  else if (method === 'air') mark = <circle cx={0} cy={0} r={2.5} className="nofill" />;
  return (
    <g transform={t} className="thin">
      {mark}
      {conduit && <circle cx={method ? 8 : 0} cy={1} r={2.5} className="nofill" />}
    </g>
  );
}

/** Interrupteur (tableau 2.23 E), cercle sur le fil en (cx,0). */
function SwitchSym({ n, cx }: { n: ElNode; cx: number }) {
  const type = String(n.props.switchType ?? 'single');
  const r = 4;
  // Levier vers le haut à droite (≈ 60°), longueur 13.
  const up = { x1: cx + r * 0.5, y1: -r * 0.87, x2: cx + 7, y2: -16 };
  const poles = type === 'bipolar' || type === 'twoWayBipolar' ? 2 : type === 'tripolar' ? 3 : 1;
  return (
    <g>
      <circle cx={cx} cy={0} r={r} className="bg" />
      {n.props.pilotLight === true && (
        <>
          <line x1={cx - 2.8} y1={-2.8} x2={cx + 2.8} y2={2.8} />
          <line x1={cx + 2.8} y1={-2.8} x2={cx - 2.8} y2={2.8} />
        </>
      )}
      <line {...up} />
      {type === 'dimmer' ? (
        <path d={`M${up.x2} ${up.y2} l6 -2 v5 z`} className="nofill" />
      ) : type !== 'double' ? (
        <Ticks x={up.x2} y={up.y2} n={poles} />
      ) : null}
      {type === 'double' && (
        <>
          <line x1={cx - r * 0.5} y1={-r * 0.87} x2={cx - 7} y2={-16} />
          <Ticks x={up.x2} y={up.y2} n={1} />
          <line x1={cx - 7} y1={-16} x2={cx - 12} y2={-16} />
        </>
      )}
      {(type === 'twoWay' || type === 'twoWayBipolar' || type === 'intermediate') && (
        <>
          <line x1={cx - r * 0.5} y1={r * 0.87} x2={cx - 7} y2={16} />
          <line x1={cx - 7} y1={16} x2={cx - 12} y2={16} />
          {/* Va-et-vient bipolaire (tableau 2.23 E) : deux traits aux deux bouts */}
          {type === 'twoWayBipolar' && <line x1={cx - 5.4} y1={12.4} x2={cx - 10.4} y2={12.4} />}
        </>
      )}
      {/* Ouverture retardée (tableau 2.23 E) : « t » au bout du levier */}
      {type === 'delayed' && (
        <text x={up.x2 + 3} y={up.y2 + 7} fontSize={7}>
          t
        </text>
      )}
      {type === 'intermediate' && (
        <>
          <line x1={cx - r * 0.5} y1={-r * 0.87} x2={cx - 7} y2={-16} />
          <line x1={cx - 7} y1={-16} x2={cx - 12} y2={-16} />
          <line x1={cx + r * 0.5} y1={r * 0.87} x2={cx + 7} y2={16} />
          <line x1={cx + 7} y1={16} x2={cx + 12} y2={16} />
        </>
      )}
      {type === 'pullCord' && <path d={`M${cx + 4} -9 v7 m-2 -3 l2 3 l2 -3`} className="nofill" />}
      {type === 'shutter' && <path d={`M${cx + 10} -2 l3 -4 l3 4 z M${cx + 10} 2 l3 4 l3 -4 z`} className="nofill" />}
    </g>
  );
}

/** Appareil d'utilisation (tableau 2.23 G) : carré avec pictogramme. Boîte x∈[x0,x0+w], y∈[-h/2,h/2]. */
function ApplianceSym({ n, x0 }: { n: ElNode; x0: number; w?: number }) {
  const t = String(n.props.applianceType ?? 'other');
  const s = 20;
  const cx = x0 + s / 2;
  if (t === 'evCharger') {
    // Tableau 2.23 G : borne de charge = colonne avec écran, « VE | EV », socle, câble et fiche à droite
    const b = x0 + 1;
    return (
      <g>
        <rect x={b} y={-10} width={11} height={18} className="bg" />
        <rect x={b + 2} y={-8} width={7} height={4} className="nofill" style={{ strokeWidth: 0.6 }} />
        <line x1={b + 5.5} y1={-2.5} x2={b + 5.5} y2={7} style={{ strokeWidth: 0.5 }} />
        <text x={b + 3} y={1} fontSize={3.2} textAnchor="middle">V</text>
        <text x={b + 3} y={5} fontSize={3.2} textAnchor="middle">E</text>
        <text x={b + 8} y={1} fontSize={3.2} textAnchor="middle">E</text>
        <text x={b + 8} y={5} fontSize={3.2} textAnchor="middle">V</text>
        <rect x={b - 1.5} y={8} width={14} height={2.2} className="bg" />
        <path d={`M${b + 11} -2 h2.5 v8 h1.6 v-13`} className="nofill" style={{ strokeWidth: 0.6 }} />
        <rect x={b + 14.2} y={-10} width={1.6} height={4} className="fill" />
      </g>
    );
  }
  const box = <rect x={x0} y={-s / 2} width={t === 'storageHeaterFan' ? s + 8 : s} height={s} className="bg" />;
  const flake = (x: number, size = 5) => (
    <g key={x} className="thin">
      <line x1={x - size} y1={0} x2={x + size} y2={0} />
      <line x1={x - size / 2} y1={-size * 0.87} x2={x + size / 2} y2={size * 0.87} />
      <line x1={x + size / 2} y1={-size * 0.87} x2={x - size / 2} y2={size * 0.87} />
    </g>
  );
  let inner: JSX.Element | null;
  switch (t) {
    case 'cooker':
    case 'hob':
      inner = (
        <>
          {/* Tableau 2.23 G : trois points, deux en haut et un en bas à droite */}
          {[
            [-4, -4],
            [4, -4],
            [4, 4],
          ].map(([dx, dy]) => (
            <circle key={dx + ',' + dy} cx={cx + dx} cy={dy} r={2.2} className="fill" />
          ))}
        </>
      );
      break;
    case 'microwave':
      inner = <path d={`M${cx - 6} -4 q3 -3 6 0 t6 0 M${cx - 6} 0 q3 -3 6 0 t6 0 M${cx - 6} 4 q3 -3 6 0 t6 0`} className="nofill" />;
      break;
    case 'oven':
      inner = (
        <>
          <line x1={x0} y1={-5} x2={x0 + s} y2={-5} />
          <circle cx={cx} cy={2} r={2.2} className="fill" />
        </>
      );
      break;
    case 'washingMachine':
      inner = (
        <>
          <circle cx={cx} cy={0} r={6} className="nofill" />
          <circle cx={cx} cy={0} r={2} className="fill" />
        </>
      );
      break;
    case 'dryer':
      inner = (
        <>
          <circle cx={cx - 3} cy={-3} r={2.6} className="nofill" />
          <circle cx={cx + 3} cy={-3} r={2.6} className="nofill" />
          <circle cx={cx} cy={4.5} r={2} className="fill" />
        </>
      );
      break;
    case 'dishwasher':
      inner = (
        <>
          <line x1={x0} y1={-s / 2} x2={x0 + s} y2={s / 2} />
          <line x1={x0 + s} y1={-s / 2} x2={x0} y2={s / 2} />
          <circle cx={cx} cy={0} r={3} className="bg" />
        </>
      );
      break;
    case 'fridge':
      inner = flake(cx);
      break;
    case 'freezer':
      // Congélateur : carré, trois étoiles côte à côte (« *** »)
      inner = <>{[-6, 0, 6].map((dx) => flake(cx + dx, 2.6))}</>;
      break;
    case 'heater':
      inner = (
        <>
          {[-5, -2.5, 0, 2.5, 5].map((dx) => (
            <line key={dx} x1={cx + dx} y1={-7} x2={cx + dx} y2={7} style={{ strokeWidth: 0.8 }} />
          ))}
        </>
      );
      break;
    case 'fan':
      inner = (
        <>
          <circle cx={cx - 3.2} cy={0} r={3} className="nofill" />
          <circle cx={cx + 3.2} cy={0} r={3} className="nofill" />
        </>
      );
      break;
    case 'electricWaterHeater':
      // Chauffe-eau électrique (sans accumulation) : cercle hachuré
      return (
        <g>
          <circle cx={cx} cy={0} r={10} className="bg" />
          {[-6, -3, 0, 3, 6].map((dx) => (
            <line key={dx} x1={cx + dx} y1={-Math.sqrt(100 - dx * dx)} x2={cx + dx} y2={Math.sqrt(100 - dx * dx)} style={{ strokeWidth: 0.8 }} />
          ))}
        </g>
      );
    case 'storageHeater':
    case 'storageHeaterFan':
      // Chauffage à accumulation : hachures dans un cadre intérieur ; avec ventilateur : deux petits cercles
      inner = (
        <>
          <rect x={x0 + 2.5} y={-7.5} width={t === 'storageHeaterFan' ? 9 : 15} height={15} className="nofill" />
          {(t === 'storageHeaterFan' ? [-6, -4, -2] : [-5, -2.5, 0, 2.5, 5]).map((dx) => (
            <line key={dx} x1={cx + dx} y1={-6} x2={cx + dx} y2={6} style={{ strokeWidth: 0.8 }} />
          ))}
          {t === 'storageHeaterFan' && (
            <>
              <circle cx={x0 + 17} cy={0} r={2.4} className="nofill" />
              <circle cx={x0 + 22} cy={0} r={2.4} className="nofill" />
            </>
          )}
        </>
      );
      break;
    case 'waterHeater': {
      // Chauffe-eau à accumulation : double cercle hachuré
      return (
        <g>
          <circle cx={cx} cy={0} r={10} className="bg" />
          <circle cx={cx} cy={0} r={7} className="nofill" />
          {[-4, -2, 0, 2, 4].map((dx) => (
            <line key={dx} x1={cx + dx} y1={-Math.sqrt(49 - dx * dx)} x2={cx + dx} y2={Math.sqrt(49 - dx * dx)} style={{ strokeWidth: 0.8 }} />
          ))}
        </g>
      );
    }
    case 'other':
      inner = n.props.name ? (
        <text x={cx} y={3} fontSize={6} textAnchor="middle">
          {String(n.props.name).slice(0, 4)}
        </text>
      ) : null;
      break;
    default:
      inner = (
        <text x={cx} y={3} fontSize={6} textAnchor="middle">
          {abbr(n)}
        </text>
      );
  }
  return (
    <g>
      {box}
      {inner}
    </g>
  );
}

/** Symbole horizontal (points d'utilisation). `bare` : sans fil d'arrivée (usage dans un autre symbole). */
function Horizontal({ n, bare }: { n: ElNode; bare?: boolean }) {
  const { w, h } = symbolSize(n, 'h');
  const lead = (x2: number) => (bare ? null : <line x1={0} y1={0} x2={x2} y2={0} />);
  switch (n.kind) {
    case 'socket': {
      // Tableau 2.23 F : arc ouvert vers la droite, terre = barre au sommet, sécurité enfant = petits pieds.
      const c = socketArcs(n);
      const els: JSX.Element[] = [];
      for (let i = 0; i < c; i++) {
        const ax = 10 + i * 7; // sommet de l'arc
        els.push(<path key={'a' + i} d={`M${ax + 8} -8 A8 8 0 0 0 ${ax + 8} 8`} className="nofill" />);
        if (n.props.childSafety !== false)
          els.push(<path key={'c' + i} d={`M${ax + 8} -8 v-3 M${ax + 8} 8 v3`} className="nofill" />);
      }
      const last = 10 + (c - 1) * 7 + 8;
      return (
        <g>
          {lead(10)}
          {c > 1 && <line x1={10} y1={0} x2={10 + (c - 1) * 7} y2={0} />}
          {els}
          {n.props.earth !== false && <line x1={10} y1={-10} x2={10} y2={10} />}
          {Number(n.props.count) > 3 && (
            <>
              <line x1={last - 4} y1={6} x2={last + 2} y2={-2} />
              <text x={last + 1} y={-6} fontSize={8}>
                {String(n.props.count)}
              </text>
            </>
          )}
          {n.props.splashProof === true && (
            <text x={last + 1} y={12} fontSize={8} fontWeight="bold">
              h
            </text>
          )}
          {/* Avec interrupteur bipolaire (de verrouillage : point noir) ; avec transformateur de séparation (rasoir) */}
          {(n.props.socketKind === 'switched' || n.props.socketKind === 'switchedLocked') && (
            <>
              <line x1={last - 2} y1={-6} x2={last + 6} y2={-14} />
              <Ticks x={last + 6} y={-14} n={2} />
              {n.props.socketKind === 'switchedLocked' && <circle cx={last - 2} cy={0} r={2.2} className="fill" />}
            </>
          )}
          {n.props.socketKind === 'shaver' && (
            <>
              <circle cx={last - 3} cy={-3} r={3} className="nofill" />
              <circle cx={last - 3} cy={3} r={3} className="nofill" />
            </>
          )}
          {n.props.threePhase === true && (
            <text x={last - 9} y={3} fontSize={7}>
              3~
            </text>
          )}
        </g>
      );
    }
    case 'switch': {
      if (n.props.signalLamp === true) {
        // Interrupteur à lampe de signalisation : ⊗—○
        return (
          <g>
            {lead(4)}
            <circle cx={9} cy={0} r={5} className="bg" />
            <line x1={5.5} y1={-3.5} x2={12.5} y2={3.5} />
            <line x1={12.5} y1={-3.5} x2={5.5} y2={3.5} />
            <line x1={14} y1={0} x2={20} y2={0} />
            <SwitchSym n={n} cx={24} />
          </g>
        );
      }
      return (
        <g>
          {lead(10)}
          <SwitchSym n={n} cx={14} />
          {n.props.splashProof === true && (
            <text x={22} y={12} fontSize={8} fontWeight="bold">
              h
            </text>
          )}
        </g>
      );
    }
    case 'pushButton':
      // Bouton-poussoir : ◎ (avec ⊗ au centre si lampe témoin)
      return (
        <g>
          {lead(6)}
          <circle cx={13} cy={0} r={7} className="bg" />
          {n.props.pilotLight === true ? (
            <>
              <line x1={10.5} y1={-2.5} x2={15.5} y2={2.5} />
              <line x1={15.5} y1={-2.5} x2={10.5} y2={2.5} />
            </>
          ) : (
            <circle cx={13} cy={0} r={3} className="nofill" />
          )}
          {/* Accès protégé (glace à briser, tableau 2.23 E) : capot à droite */}
          {n.props.protected === true && <path d="M21 -9 h3 v18 h-3 M24 -9 h2 M24 9 h2" className="nofill" />}
        </g>
      );
    case 'light': {
      const t = String(n.props.lightType ?? 'standard');
      const nb = Number(n.props.count) || 1;
      if (t === 'fluo')
        return (
          <g>
            {lead(6)}
            {nb > 1 ? (
              <>
                <line x1={6} y1={-3} x2={28} y2={-3} />
                <line x1={6} y1={0} x2={28} y2={0} />
                <line x1={6} y1={3} x2={28} y2={3} />
                <text x={20} y={-6} fontSize={8}>
                  {nb}
                </text>
              </>
            ) : (
              <line x1={6} y1={0} x2={28} y2={0} />
            )}
            <line x1={6} y1={-6} x2={6} y2={6} />
            <line x1={28} y1={-6} x2={28} y2={6} />
          </g>
        );
      if (t === 'auxiliary')
        // Appareil auxiliaire pour lampe à décharge (tableau 2.23 G) : rectangle dans un rectangle
        return (
          <g>
            {lead(4)}
            <rect x={4} y={-6} width={26} height={12} className="bg" />
            <rect x={8} y={-2.5} width={18} height={5} className="nofill" />
          </g>
        );
      const cx = 17;
      const r = 8;
      const cross = (
        <>
          <line x1={cx - r} y1={-r} x2={cx + r} y2={r} />
          <line x1={cx + r} y1={-r} x2={cx - r} y2={r} />
        </>
      );
      return (
        <g>
          {lead(t === 'spot' || t === 'floodNarrow' || t === 'floodWide' ? 4 : t === 'emergencyUnit' ? cx - r - 2 : cx)}
          {t === 'spot' || t === 'floodNarrow' || t === 'floodWide' ? (
            // Projecteur : ⊗ entouré d'un arc
            <>
              <path d={`M${cx - 3} -10 A11 11 0 0 0 ${cx - 3} 10`} className="nofill" />
              <circle cx={cx + 3} cy={0} r={7} className="bg" />
              <line x1={cx - 2} y1={-5} x2={cx + 8} y2={5} />
              <line x1={cx + 8} y1={-5} x2={cx - 2} y2={5} />
            </>
          ) : (
            cross
          )}
          {/* Projecteur à faisceau peu divergent (flèches parallèles) ou divergent (flèches écartées) */}
          {t === 'floodNarrow' && <path d={`M${cx + 11} -3 h8 m-3 -2 l3 2 l-3 2 M${cx + 11} 3 h8 m-3 -2 l3 2 l-3 2`} className="nofill" />}
          {t === 'floodWide' && <path d={`M${cx + 10} -3 l7 -5 m-3.5 0 l3.5 0 l-1 3 M${cx + 10} 3 l7 5 m-3.5 0 l3.5 0 l-1 -3`} className="nofill" />}
          {/* Luminaire avec interrupteur unipolaire incorporé : une branche de la croix se termine en levier */}
          {t === 'withSwitch' && <line x1={cx + r} y1={-r} x2={cx + r + 4} y2={-r + 4} />}
          {/* Bloc autonome d'éclairage de sécurité : croix et point dans un carré */}
          {t === 'emergencyUnit' && (
            <>
              <rect x={cx - r - 2} y={-r - 2} width={2 * r + 4} height={2 * r + 4} className="nofill" />
              <circle cx={cx} cy={0} r={3} className="fill" />
            </>
          )}
          {t === 'wall' && <line x1={cx + r + 3} y1={-r - 2} x2={cx + r + 3} y2={r + 2} style={{ strokeWidth: 2 }} />}
          {t === 'emergency' && <circle cx={cx} cy={0} r={3} className="fill" />}
          {t === 'led' && (
            <text x={cx + r + 1} y={-6} fontSize={7}>
              LED
            </text>
          )}
          {nb > 1 && (
            <text x={cx + r + 1} y={t === 'led' ? 12 : -6} fontSize={7}>
              ×{nb}
            </text>
          )}
          {n.props.splashProof === true && (
            <text x={cx + r + 1} y={12} fontSize={8} fontWeight="bold">
              h
            </text>
          )}
        </g>
      );
    }
    case 'cable':
      return (
        <g>
          <line x1={0} y1={0} x2={w} y2={0} />
          <line x1={w / 2 - 3} y1={4} x2={w / 2 + 3} y2={-4} />
        </g>
      );
    case 'junctionBox':
      // Boîte de connexion / dérivation : cercle avec point
      return (
        <g>
          {lead(4)}
          <circle cx={13} cy={0} r={9} className="bg" />
          <circle cx={13} cy={0} r={3} className="fill" />
        </g>
      );
    case 'bell': {
      // Tableau 2.23 G : sonnerie (demi-disque), vibreur (demi-disque tourné vers le fil), trompe (carré et pavillon),
      // sirène (triangle)
      const bt = String(n.props.bellType ?? 'bell');
      return (
        <g>
          {lead(bt === 'buzzer' ? 18 : 8)}
          {bt === 'buzzer' ? (
            <path d="M18 -8 A8 8 0 0 0 18 8 Z" className="bg" />
          ) : bt === 'horn' ? (
            <>
              <rect x={8} y={-6} width={12} height={12} className="bg" />
              <path d="M20 0 L28 -5 V5 Z" className="nofill" />
            </>
          ) : bt === 'siren' ? (
            <path d="M8 -9 L24 0 L8 9 Z" className="bg" />
          ) : (
            <path d="M8 -8 A8 8 0 0 1 8 8 Z" className="bg" />
          )}
        </g>
      );
    }
    case 'motor':
      return (
        <g>
          {lead(6)}
          <circle cx={17} cy={0} r={10} className="bg" />
          <text x={17} y={4} fontSize={11} textAnchor="middle" fontWeight="bold">
            M
          </text>
        </g>
      );
    case 'appliance':
      return (
        <g>
          {lead(8)}
          <ApplianceSym n={n} x0={8} w={w} />
        </g>
      );
    case 'transformer':
      return (
        <g>
          {lead(4)}
          <circle cx={12} cy={0} r={7} className="nofill" />
          <circle cx={21} cy={0} r={7} className="nofill" />
          {bare === undefined && <SourceNote lines={[n.props.uPrimary && n.props.uSecondary ? `${n.props.uPrimary}/${n.props.uSecondary} V` : '', n.props.power ? `${n.props.power} VA` : '']} />}
        </g>
      );
    case 'solarPanel':
      return (
        <g>
          {lead(6)}
          <rect x={6} y={-10} width={22} height={20} className="bg" />
          <path d="M6 -10 L17 6 L28 -10" className="nofill" />
          {bare === undefined && <SourceNote lines={[n.props.count ? `${n.props.count} ×` : '', n.props.name ? String(n.props.name) : '']} />}
        </g>
      );
    case 'battery':
      // Accumulateur (tableau 2.23 H. Sources) : éléments « trait long fin / trait court épais » en série
      return (
        <g>
          {lead(8)}
          {[8, 16].map((x) => (
            <g key={x}>
              <line x1={x} y1={-9} x2={x} y2={9} />
              <line x1={x + 4} y1={-4.5} x2={x + 4} y2={4.5} style={{ strokeWidth: 2.4 }} />
            </g>
          ))}
          <line x1={12} y1={0} x2={16} y2={0} />
          <text x={6} y={-6} fontSize={6} textAnchor="middle">+</text>
        </g>
      );
    case 'inverter': {
      // RGIE tableau 2.23 (H. Sources) : carré barré ; en haut à gauche l'entrée, en bas à droite la sortie.
      // DC → AC (onduleur) : « ═ » puis « ~ » ; AC ↔ DC (redresseur/onduleur) : « ~ » puis « ═ » et double flèche ;
      // DC → DC (hacheur) : « ═ » des deux côtés. « ═ » = trait plein sur trait interrompu (courant continu).
      const type = String(n.props.inverterType ?? 'dcAc');
      const dc = (x: number, y: number) => (
        <>
          <path d={`M${x} ${y} h7`} className="nofill" />
          <path d={`M${x} ${y + 3} h7`} className="nofill" strokeDasharray="2 1" />
        </>
      );
      const ac = (x: number, y: number) => <path d={`M${x} ${y} q2 -3 4 0 t4 0`} className="nofill" />;
      return (
        <g>
          {lead(6)}
          <rect x={6} y={-10} width={22} height={20} className="bg" />
          <line x1={6} y1={10} x2={28} y2={-10} />
          {type === 'acDc' ? ac(8, -5) : dc(8, -7)}
          {type === 'dcAc' ? ac(18, 5) : dc(19, 2)}
          {type === 'acDc' && <path d="M19 8.5 h7 M20.5 7 l-1.5 1.5 l1.5 1.5 M24.5 7 l1.5 1.5 l-1.5 1.5" className="nofill" style={{ strokeWidth: 0.7 }} />}
          {bare === undefined && <SourceNote lines={[n.props.power ? `Pmax ${n.props.power} W` : '']} />}
        </g>
      );
    }
    case 'detector':
      return (
        <g>
          {lead(6)}
          <rect x={6} y={-10} width={20} height={20} className="bg" />
          <path d="M12 -5 q3 5 0 10 M16 -6 q4 6 0 12" className="nofill" />
        </g>
      );
    case 'relay': {
      const rt = String(n.props.relayType ?? 'relay');
      return (
        <g>
          {lead(4)}
          <rect x={4} y={-7} width={26} height={14} className="bg" />
          {rt === 'teleswitch' ? (
            // Tableau 2.23 E : ┘ └ (deux équerres ouvertes vers le haut)
            <path d="M9 3 h4 v-5 M25 3 h-4 v-5" className="nofill" />
          ) : rt === 'timeSwitch' ? (
            // Interrupteur horaire : horloge et contact
            <>
              <circle cx={10} cy={0} r={4} className="nofill" />
              <path d="M10 0 v-3 M10 0 h2.5 M16 1 h4 l5 -3 M25 1 h2" className="nofill" />
            </>
          ) : rt === 'thermostat' ? (
            // Thermostat : θ
            <>
              <ellipse cx={17} cy={0} rx={3.5} ry={5} className="nofill" />
              <line x1={13.5} y1={0} x2={20.5} y2={0} />
            </>
          ) : rt === 'lockControl' ? (
            // Contrôleur de ronde / verrouillage électrique par serrure : trou de serrure
            <path d="M17 -4.5 a2.2 2.2 0 1 1 0.01 0 Z M15.8 -1 L14.8 5 H19.2 L18.2 -1 Z" className="fill" />
          ) : (
            <text x={17} y={3} fontSize={8} textAnchor="middle">
              {abbr(n)}
            </text>
          )}
        </g>
      );
    }
    case 'other': {
      const ot = String(n.props.otherType ?? '');
      if (ot === 'clock' || ot === 'masterClock')
        // Horloge (cercle et aiguilles) ; horloge mère : double cercle
        return (
          <g>
            {lead(4)}
            <circle cx={15} cy={0} r={11} className="bg" />
            {ot === 'masterClock' && <circle cx={15} cy={0} r={8} className="nofill" />}
            <path d="M15 0 v-6 M15 0 h-5" className="nofill" />
            <circle cx={15} cy={0} r={1.2} className="fill" />
          </g>
        );
      if (ot === 'doorStrike')
        // Gâche électrique : bobine dans un boîtier et pêne (triangle)
        return (
          <g>
            {lead(4)}
            <rect x={4} y={-7} width={18} height={14} className="bg" />
            <path d="M7 1 q1.5 -4 3 0 q1.5 -4 3 0 q1.5 -4 3 0 q1.5 -4 3 0" className="nofill" />
            <path d="M22 -7 L30 7 H22" className="nofill" />
          </g>
        );
      if (ot === 'dataOutlet')
        // Socle de prise data : trait et crochet (sans arc)
        return (
          <g>
            {lead(10)}
            <path d="M16 -8 H10 V8 H16" className="nofill" />
          </g>
        );
      return (
        <g>
          {lead(4)}
          <rect x={4} y={-h / 2} width={w - 4} height={h} className="bg" />
          <text x={4 + (w - 4) / 2} y={3} textAnchor="middle" fontSize={8}>
            {n.props.name ? String(n.props.name).slice(0, 4) : abbr(n)}
          </text>
        </g>
      );
    }
    case 'board':
      // Tableau de répartition et de manœuvre
      return (
        <g>
          {lead(4)}
          <rect x={4} y={-6} width={36} height={12} className="bg" />
        </g>
      );
    case 'origin':
      // Coffret de branchement
      return (
        <g>
          <line x1={0} y1={0} x2={30} y2={0} />
          <rect x={6} y={-5} width={18} height={10} className="nofill" />
          <circle cx={15} cy={0} r={2} className="fill" />
        </g>
      );
    case 'meter':
      return (
        <g>
          {lead(4)}
          <rect x={4} y={-9} width={28} height={18} className="bg" />
          <line x1={4} y1={-4} x2={32} y2={-4} />
          <text x={18} y={6} fontSize={7} textAnchor="middle">
            kWh
          </text>
        </g>
      );
    case 'earth':
      // Prise de terre (tableau 2.23 D) : ⏚ couché, branché par le trait de gauche
      return (
        <g>
          {lead(10)}
          <line x1={10} y1={-8} x2={10} y2={8} />
          <line x1={14} y1={-5} x2={14} y2={5} />
          <line x1={18} y1={-2} x2={18} y2={2} />
        </g>
      );
    case 'earthBar':
      // Sectionneur de terre (tableau 2.23 B) : ─┤├──┤├─ (auparavant le même dessin que la prise de terre)
      return (
        <g>
          {lead(6)}
          <line x1={6} y1={-6} x2={6} y2={6} />
          <line x1={9} y1={-6} x2={9} y2={6} />
          <line x1={9} y1={0} x2={15} y2={0} />
          <line x1={15} y1={-6} x2={15} y2={6} />
          <line x1={18} y1={-6} x2={18} y2={6} />
          <line x1={18} y1={0} x2={24} y2={0} />
        </g>
      );
    default:
      return (
        <g>
          {lead(4)}
          <rect x={4} y={-h / 2} width={w - 4} height={h} className="bg" rx={n.kind === 'domotic' ? 4 : 0} />
          <text x={4 + (w - 4) / 2} y={3} textAnchor="middle" fontSize={8}>
            {abbr(n)}
          </text>
        </g>
      );
  }
}

/**
 * `up` : unifilaire dessiné de bas en haut (le fil arrive par le bas). Les symboles orientés — la prise de terre,
 * dont les barres terminent la ligne — sont alors retournés pour que la tige rejoigne le fil.
 */
export function Symbol({ node, orient, up, bare }: { node: ElNode; orient: 'v' | 'h'; up?: boolean; bare?: boolean }) {
  if (orient === 'v' && up && node.kind === 'earth') {
    const { h } = symbolSize(node, 'v');
    return (
      <g transform={`translate(0,${h}) scale(1,-1)`}>
        <Vertical n={node} />
      </g>
    );
  }
  if (orient === 'h' && framed(node)) return <Framed n={node} bare={bare} />;
  return orient === 'v' ? <Vertical n={node} /> : <Horizontal n={node} bare={bare} />;
}

/**
 * Interrupteur ou socle dans un cadre (tableau 2.23) : installé dans un tableau de répartition (cadre, double trait en
 * bas) ou unité de commande domotique (partie J : rectangle en deux parties, en haut le type de commande — bouton-
 * poussoir local, sans fil, programmée, par détection — et, à droite, l'extension par bouton-poussoir).
 */
function Framed({ n, bare }: { n: ElNode; bare?: boolean }) {
  const { w, h } = baseSymbolSize(n, 'h');
  const ctls = domoticControls(n).filter((k) => k !== 'ctlExtension');
  const dom = domoticControls(n).length > 0;
  const x0 = 6;
  const x1 = w + 3;
  const yb = h / 2 + 2;
  const yt = -h / 2 - (dom ? 12 : 2);
  const ys = -h / 2 - 2; // séparation des deux parties
  const icon = (k: string, cx: number) => {
    const cy = yt + 5;
    switch (k) {
      case 'ctlPush':
        return (
          <g key={k}>
            <circle cx={cx} cy={cy} r={3.5} className="nofill" />
            <circle cx={cx} cy={cy} r={1.5} className="nofill" />
          </g>
        );
      case 'ctlTimer':
        return (
          <g key={k}>
            <circle cx={cx} cy={cy} r={3.5} className="nofill" />
            <path d={`M${cx} ${cy} v-2.5 M${cx} ${cy} h-2`} className="nofill" />
          </g>
        );
      case 'ctlWireless':
        return <path key={k} d={`M${cx - 3} ${cy - 1} v2 M${cx - 1} ${cy - 3} q2 3 0 6 M${cx + 1.5} ${cy - 4} q3 4 0 8`} className="nofill" />;
      default:
        // Détection : deux arcs
        return <path key={k} d={`M${cx - 1.5} ${cy - 3} q2 3 0 6 M${cx + 1.5} ${cy - 4} q3 4 0 8`} className="nofill" />;
    }
  };
  return (
    <g>
      <Horizontal n={n} bare={bare} />
      <rect x={x0} y={yt} width={x1 - x0} height={yb - yt} className="nofill" />
      {dom && <line x1={x0} y1={ys} x2={x1} y2={ys} />}
      {ctls.map((k, i) => icon(k, x0 + 6 + i * 9))}
      {n.props.ctlExtension === true && (
        <g>
          <line x1={x1} y1={yt + 5} x2={x1 + 5} y2={yt + 5} />
          <circle cx={x1 + 9} cy={yt + 5} r={3.5} className="nofill" />
          <circle cx={x1 + 9} cy={yt + 5} r={1.5} className="nofill" />
        </g>
      )}
      {n.props.inBoard === true && <line x1={x0} y1={yb + 2} x2={x1} y2={yb + 2} />}
    </g>
  );
}

/**
 * Élément posé au mur : sur le plan, il garde son petit trait de raccordement, tourné vers le mur (prise,
 * interrupteur, bouton-poussoir, sonnerie, applique). Les autres (point lumineux au plafond, tube néon,
 * appareil, moteur, éléments carrés…) sont dessinés sans ce trait.
 */
export function isWallMounted(n: ElNode): boolean {
  return (
    n.kind === 'socket' ||
    n.kind === 'switch' ||
    n.kind === 'pushButton' ||
    n.kind === 'bell' ||
    (n.kind === 'light' && String(n.props.lightType ?? 'standard') === 'wall')
  );
}
