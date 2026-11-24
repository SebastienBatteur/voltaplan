/**
 * Gestes au doigt du dessin (src/ui/usePanZoom.ts) : pincement à deux doigts et menu par appui long.
 * Événements de pointeur synthétiques dans jsdom (qui n'a pas de PointerEvent : on en fabrique un), dessin de
 * 1000 × 500 px à l'écran. Vérifie aussi qu'à la souris rien ne change (pas de menu à l'appui long).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { LONG_PRESS, pinchViewBox, screenToSvg, usePanZoom, type ViewBox } from '../src/ui/usePanZoom';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RECT = { left: 0, top: 0, width: 1000, height: 500 };

/** Événement de pointeur : un MouseEvent auquel on ajoute les champs du pointeur. */
function pointer(type: string, id: number, x: number, y: number, kind: 'touch' | 'mouse' = 'touch', primary = true): MouseEvent {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: type === 'pointermove' ? -1 : 0 });
  Object.defineProperties(e, { pointerId: { value: id }, pointerType: { value: kind }, isPrimary: { value: primary } });
  return e;
}

let vb: ViewBox = { x: 0, y: 0, w: 0, h: 0 };
let ups: boolean[] = [];
let menus: { x: number; y: number }[] = [];

function Probe({ hold }: { hold: boolean }) {
  const pz = usePanZoom({ w: 1000, h: 500 }, 'k', { holdMenu: hold });
  vb = pz.vb;
  return (
    <svg
      ref={pz.svgRef}
      onPointerDown={(e) => pz.onPointerDown(e, true)}
      onPointerMove={pz.onPointerMove}
      onPointerUp={() => ups.push(pz.onPointerUp())}
      onContextMenu={(e) => {
        e.preventDefault();
        menus.push({ x: e.clientX, y: e.clientY });
      }}
    >
      <rect data-bg="1" />
      <g className="sym">
        <rect className="hitbox" />
      </g>
    </svg>
  );
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;
const origRect = Element.prototype.getBoundingClientRect;

beforeEach(() => {
  vi.useFakeTimers();
  Element.prototype.getBoundingClientRect = function () {
    return { ...RECT, x: 0, y: 0, right: RECT.width, bottom: RECT.height, toJSON: () => ({}) } as DOMRect;
  };
  // jsdom n'implémente pas la capture du pointeur
  (Element.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => undefined;
  ups = [];
  menus = [];
});
afterEach(() => {
  const r = root;
  if (r) act(() => r.unmount());
  host?.remove();
  root = null;
  host = null;
  Element.prototype.getBoundingClientRect = origRect;
  vi.useRealTimers();
});

function mount(hold = true) {
  const h = document.createElement('div');
  document.body.appendChild(h);
  const r = createRoot(h);
  host = h;
  root = r;
  act(() => r.render(<Probe hold={hold} />));
  return h.querySelector('svg')!;
}
const fire = (el: Element, e: Event) => act(() => void el.dispatchEvent(e));

describe('pincement (calcul)', () => {
  const vb0: ViewBox = { x: 0, y: 0, w: 1000, h: 500 };
  it('écarter les doigts du double divise la largeur visible par deux, le point sous les doigts reste en place', () => {
    const m = { x: 300, y: 200 };
    const out = pinchViewBox(vb0, RECT, m, 100, m, 200);
    expect(out.w).toBeCloseTo(500);
    expect(out.h).toBeCloseTo(250);
    const before = screenToSvg(vb0, RECT, m.x, m.y);
    const after = screenToSvg(out, RECT, m.x, m.y);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });
  it('déplacer les deux doigts sans les écarter fait glisser la vue', () => {
    const out = pinchViewBox(vb0, RECT, { x: 300, y: 200 }, 100, { x: 350, y: 220 }, 100);
    expect(out.w).toBeCloseTo(1000);
    expect(out.x).toBeCloseTo(-50);
    expect(out.y).toBeCloseTo(-20);
  });
  it('zoom borné', () => {
    expect(pinchViewBox(vb0, RECT, { x: 0, y: 0 }, 1, { x: 0, y: 0 }, 1e6).w).toBe(50);
  });
});

describe('gestes au doigt sur le dessin', () => {
  it('deux doigts : la vue zoome autour du milieu des doigts, et le relâcher n’est pas un clic', () => {
    const svg = mount();
    const bg = svg.querySelector('rect[data-bg]')!;
    const w0 = vb.w;
    const p0 = screenToSvg(vb, RECT, 500, 250);
    fire(bg, pointer('pointerdown', 1, 450, 250, 'touch', true));
    fire(bg, pointer('pointerdown', 2, 550, 250, 'touch', false));
    for (let i = 1; i <= 5; i++) {
      fire(bg, pointer('pointermove', 1, 450 - i * 10, 250, 'touch', true));
      fire(bg, pointer('pointermove', 2, 550 + i * 10, 250, 'touch', false));
    }
    // Doigts écartés de 100 à 200 px : deux fois plus près
    expect(vb.w).toBeCloseTo(w0 / 2);
    const p1 = screenToSvg(vb, RECT, 500, 250);
    expect(p1.x).toBeCloseTo(p0.x);
    expect(p1.y).toBeCloseTo(p0.y);
    fire(bg, pointer('pointerup', 2, 600, 250, 'touch', false));
    fire(bg, pointer('pointerup', 1, 400, 250, 'touch', true));
    // Chaque relâcher est marqué « geste » : l'appelant ne le prend pas pour un clic
    expect(ups).toEqual([true, true]);
    // Pas de menu malgré la durée du geste
    act(() => void vi.advanceTimersByTime(LONG_PRESS * 2));
    expect(menus).toEqual([]);
  });

  it('un doigt qui glisse déplace la vue (comme avant)', () => {
    const svg = mount();
    const bg = svg.querySelector('rect[data-bg]')!;
    const x0 = vb.x;
    fire(bg, pointer('pointerdown', 1, 500, 250));
    fire(bg, pointer('pointermove', 1, 540, 250));
    fire(bg, pointer('pointerup', 1, 540, 250));
    expect(vb.x).toBeLessThan(x0);
    expect(ups).toEqual([true]);
    act(() => void vi.advanceTimersByTime(LONG_PRESS * 2));
    expect(menus).toEqual([]);
  });

  it('appui long au doigt sur un élément : menu « clic droit » à cet endroit, puis le relâcher n’est pas un clic', () => {
    const svg = mount();
    const hit = svg.querySelector('.hitbox')!;
    fire(hit, pointer('pointerdown', 1, 120, 80));
    act(() => void vi.advanceTimersByTime(LONG_PRESS - 10));
    expect(menus).toEqual([]);
    act(() => void vi.advanceTimersByTime(20));
    expect(menus).toEqual([{ x: 120, y: 80 }]);
    // Le doigt bouge ensuite un peu : la vue ne part pas
    const x0 = vb.x;
    fire(hit, pointer('pointermove', 1, 160, 80));
    expect(vb.x).toBe(x0);
    fire(hit, pointer('pointerup', 1, 160, 80));
    expect(ups).toEqual([true]);
    expect(menus).toHaveLength(1);
  });

  it('appui bref, ou doigt qui bouge : pas de menu', () => {
    const svg = mount();
    const hit = svg.querySelector('.hitbox')!;
    fire(hit, pointer('pointerdown', 1, 120, 80));
    fire(hit, pointer('pointerup', 1, 120, 80));
    act(() => void vi.advanceTimersByTime(LONG_PRESS * 2));
    fire(hit, pointer('pointerdown', 2, 120, 80));
    fire(hit, pointer('pointermove', 2, 140, 80));
    act(() => void vi.advanceTimersByTime(LONG_PRESS * 2));
    fire(hit, pointer('pointerup', 2, 140, 80));
    expect(menus).toEqual([]);
  });

  it('à la souris, l’appui long ne fait rien de nouveau (le clic droit reste le chemin)', () => {
    const svg = mount();
    const hit = svg.querySelector('.hitbox')!;
    fire(hit, pointer('pointerdown', 1, 120, 80, 'mouse'));
    act(() => void vi.advanceTimersByTime(LONG_PRESS * 2));
    fire(hit, pointer('pointerup', 1, 120, 80, 'mouse'));
    expect(menus).toEqual([]);
    expect(ups).toEqual([false]);
  });

  it('sans holdMenu (vue du tableau), pas de menu à l’appui long', () => {
    const svg = mount(false);
    const hit = svg.querySelector('.hitbox')!;
    fire(hit, pointer('pointerdown', 1, 120, 80));
    act(() => void vi.advanceTimersByTime(LONG_PRESS * 2));
    fire(hit, pointer('pointerup', 1, 120, 80));
    expect(menus).toEqual([]);
  });
});
