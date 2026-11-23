import { alignBackground, inRotatedRect, moveWallEnd, nearestWall, openingOnWall, parseLength, scaleBackground, scalePage, setOpeningWidth, setWallLength, slideOpening, snapPoint, translateWall } from '../src/plan/geometry';
import { emptyPage } from '../src/model/tree';
import type { PlanPage } from '../src/model/types';

function page(): PlanPage {
  const p = emptyPage('test');
  p.walls.push({ a: { x: 0, y: 0 }, b: { x: 5000, y: 0 }, thickness: 200 });
  return p;
}

describe('géométrie du plan', () => {
  it('accroche aux extrémités, aux angles droits et à la grille', () => {
    const p = page();
    expect(snapPoint({ x: 4980, y: 30 }, p, 100)).toEqual({ x: 5000, y: 0 });
    // Presque horizontal depuis (0,3000) → horizontal
    expect(snapPoint({ x: 4003, y: 3204 }, p, 100, { x: 0, y: 3000 })).toEqual({ x: 4000, y: 3000 });
    // Presque vertical
    expect(snapPoint({ x: 37, y: 2507 }, p, 10, { x: 0, y: 6000 })).toEqual({ x: 0, y: 2510 });
  });

  it('place une porte centrée sur le clic, sans dépasser le mur', () => {
    const p = page();
    const w = nearestWall({ x: 2500, y: 80 }, p, 50);
    expect(w?.index).toBe(0);
    expect(openingOnWall(p, 0, { x: 2500, y: 0 }, 900)).toEqual({ a: { x: 2050, y: 0 }, b: { x: 2950, y: 0 }, width: 200 });
    expect(openingOnWall(p, 0, { x: 100, y: 0 }, 900).a).toEqual({ x: 0, y: 0 });
    expect(nearestWall({ x: 2500, y: 600 }, p, 50)).toBeNull();
  });

  it('met le fond de plan à l’échelle à partir de deux points et d’une cote', () => {
    const p = emptyPage('bg');
    p.images.push({ center: { x: 6000, y: 4000 }, w: 12000, h: 8000, angle: 0, href: 'x', background: true });
    p.images.push({ center: { x: 1, y: 1 }, w: 10, h: 10, angle: 0, href: 'meuble' });
    // 1000 mm mesurés sur l'image valent en réalité 4,5 m
    const q = scaleBackground(p, { x: 0, y: 0 }, { x: 1000, y: 0 }, 4500);
    expect(q.images[0].w).toBeCloseTo(54000);
    expect(q.images[0].center.x).toBeCloseTo(27000);
    expect(q.images[1].w).toBe(10); // les images non « fond de plan » ne bougent pas
  });

  it('lit les cotes saisies', () => {
    expect(parseLength('4,5')).toBe(4500);
    expect(parseLength('4.5 m')).toBe(4500);
    expect(parseLength('450 cm')).toBe(4500);
    expect(parseLength('4500')).toBe(4500);
    expect(parseLength('abc')).toBeNull();
  });
});

describe('mise à l’échelle de toute la page', () => {
  it('agrandit ou réduit positions et longueurs, garde l’épaisseur des murs', () => {
    const p = emptyPage('trikker');
    p.walls.push({ a: { x: 1000, y: 1000 }, b: { x: 18930, y: 1000 }, thickness: 250 });
    p.symbols.push({ nodeId: 'n', pos: { x: 9965, y: 5000 }, rotation: 0 });
    const q = scalePage(p, { x: 1000, y: 1000 }, { x: 18930, y: 1000 }, 13000);
    expect(q.walls[0].b).toEqual({ x: 14000, y: 1000 });
    expect(q.walls[0].thickness).toBe(250);
    expect(q.symbols[0].pos).toEqual({ x: 7500, y: 3900 });
  });
});

describe('calage du fond de plan', () => {
  it('amène deux points de la photo sur deux points du plan (échelle et rotation)', () => {
    const p = emptyPage('bg');
    p.images.push({ center: { x: 100, y: 0 }, w: 200, h: 100, angle: 0, href: 'x', background: true });
    // Photo : (0,0)→(200,0) ; plan : (1000,1000)→(1000,1400) : ×2 et quart de tour
    const q = alignBackground(p, { x: 0, y: 0 }, { x: 1000, y: 1000 }, { x: 200, y: 0 }, { x: 1000, y: 1400 });
    const im = q.images[0];
    expect(im.w).toBeCloseTo(400);
    expect(im.angle).toBeCloseTo(90);
    expect(im.center.x).toBeCloseTo(1000);
    expect(im.center.y).toBeCloseTo(1200);
  });
});

describe('édition du plan', () => {
  function room() {
    const p = emptyPage('room');
    const c = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 3000 },
      { x: 0, y: 3000 },
    ];
    c.forEach((a, i) => p.walls.push({ a, b: c[(i + 1) % 4], thickness: 200 }));
    p.openings.push({ kind: 'door', a: { x: 1000, y: 0 }, b: { x: 1900, y: 0 }, width: 200, hinge: 'left' });
    return p;
  }

  it('déplacer un coin entraîne les deux murs raccordés', () => {
    const q = moveWallEnd(room(), 0, 'b', { x: 5000, y: 0 });
    expect(q.walls[0].b).toEqual({ x: 5000, y: 0 });
    expect(q.walls[1].a).toEqual({ x: 5000, y: 0 });
  });

  it('déplacer un mur déplace ses ouvertures et les coins raccordés', () => {
    const q = translateWall(room(), 0, { x: 0, y: -500 });
    expect(q.walls[0].a).toEqual({ x: 0, y: -500 });
    expect(q.walls[3].b).toEqual({ x: 0, y: -500 });
    expect(q.openings[0].a).toEqual({ x: 1000, y: -500 });
  });

  it('une porte glisse le long de son mur et garde son sens', () => {
    const q = slideOpening(room(), 0, { x: 3000, y: 120 });
    expect(q.openings[0].a).toEqual({ x: 2550, y: 0 });
    expect(q.openings[0].b).toEqual({ x: 3450, y: 0 });
    expect(q.openings[0].hinge).toBe('left');
  });

  it('largeur d’ouverture et longueur de mur modifiables', () => {
    expect(setOpeningWidth(room(), 0, 1200).openings[0]).toMatchObject({ a: { x: 850, y: 0 }, b: { x: 2050, y: 0 } });
    const q = setWallLength(room(), 0, 4500);
    expect(q.walls[0].b).toEqual({ x: 4500, y: 0 });
    expect(q.walls[1].a).toEqual({ x: 4500, y: 0 });
  });
});

it('les ouvertures suivent leur mur quand on déplace un coin', () => {
  const p = emptyPage('r');
  p.walls.push({ a: { x: 0, y: 0 }, b: { x: 4000, y: 0 }, thickness: 200 }, { a: { x: 4000, y: 0 }, b: { x: 4000, y: 3000 }, thickness: 200 });
  p.openings.push({ kind: 'window', a: { x: 4000, y: 1000 }, b: { x: 4000, y: 2000 }, width: 200 });
  const q = moveWallEnd(p, 1, 'b', { x: 5000, y: 3000 });
  const o = q.openings[0];
  expect(Math.abs(Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y) - 1000)).toBeLessThan(2);
  expect(o.a.x).toBeGreaterThan(4000); // sur le mur biais
});

it('sélection d’un meuble tourné', () => {
  // Lit 1600 × 2000 tourné de 90° : il occupe 2000 en x et 1600 en y
  expect(inRotatedRect({ x: 950, y: 0 }, { x: 0, y: 0 }, 1600, 2000, 90)).toBe(true);
  expect(inRotatedRect({ x: 0, y: 950 }, { x: 0, y: 0 }, 1600, 2000, 90)).toBe(false);
});
