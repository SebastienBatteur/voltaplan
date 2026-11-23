import { applyH, bandGaps, darkMask, doorsFromGaps, extractWalls, homography, opening, parseSize, rectify, toGray, type RGBA } from '../src/plan/trace';

function blank(w: number, h: number): RGBA {
  return { w, h, data: new Uint8ClampedArray(w * h * 4).fill(230) };
}
function fill(img: RGBA, x0: number, y0: number, x1: number, y1: number, v = 40) {
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const o = (y * img.w + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
    }
}

describe('reconnaissance d’un plan photographié', () => {
  it('homographie : envoie les 4 coins au bon endroit', () => {
    const src = [
      { x: 10, y: 20 },
      { x: 300, y: 5 },
      { x: 320, y: 250 },
      { x: 0, y: 230 },
    ];
    const dst = [
      { x: 0, y: 0 },
      { x: 1300, y: 0 },
      { x: 1300, y: 850 },
      { x: 0, y: 850 },
    ];
    const H = homography(src, dst);
    src.forEach((p, i) => {
      const q = applyH(H, p);
      expect(q.x).toBeCloseTo(dst[i].x, 6);
      expect(q.y).toBeCloseTo(dst[i].y, 6);
    });
  });

  it('trouve les murs épais et ignore les traits fins (cotes, meubles)', () => {
    const img = blank(400, 300);
    // Cadre de murs de 12 px
    fill(img, 20, 20, 380, 32);
    fill(img, 20, 268, 380, 280);
    fill(img, 20, 20, 32, 280);
    fill(img, 368, 20, 380, 280);
    // Cloison de 8 px
    fill(img, 200, 32, 208, 268);
    // Trait fin (cote) et petit carré (texte)
    fill(img, 40, 150, 190, 152);
    fill(img, 60, 60, 66, 66);
    const mask = opening(darkMask(toGray(img), 61), img.w, img.h, 2);
    const walls = extractWalls(mask, img.w, img.h, 40, 30);
    expect(walls.length).toBe(5);
    const thick = walls.map((w) => Math.round(w.thickness)).sort((a, b) => a - b);
    expect(thick).toEqual([8, 12, 12, 12, 12]);
    // La cloison rejoint les murs du cadre (axe à y = 26 et 274)
    const part = walls.find((w) => w.thickness === 8)!;
    expect([part.a.y, part.b.y].sort((a, b) => a - b)).toEqual([26, 274]);
  });

  it('redresse une image : le rectangle choisi devient droit et à la bonne taille', () => {
    const img = blank(200, 200);
    fill(img, 50, 50, 150, 150, 0);
    const corners = [
      { x: 50, y: 50 },
      { x: 150, y: 50 },
      { x: 150, y: 150 },
      { x: 50, y: 150 },
    ];
    const { img: out, origin } = rectify(img, corners, { w: 50, h: 50 }, 10);
    expect(out.w).toBe(70);
    expect(origin).toEqual({ x: 10, y: 10 });
    const px = (x: number, y: number) => out.data[(y * out.w + x) * 4];
    expect(px(35, 35)).toBeLessThan(20); // intérieur noir
    expect(px(3, 3)).toBeGreaterThan(200); // marge claire
  });

  it('lit les dimensions saisies', () => {
    expect(parseSize('13 x 8,5')).toEqual({ w: 13000, h: 8500 });
    expect(parseSize('13,00 × 8,50 m')).toEqual({ w: 13000, h: 8500 });
    expect(parseSize('1300x850 cm')).toEqual({ w: 13000, h: 8500 });
    expect(parseSize('treize')).toBeNull();
  });
});

describe('portes et fenêtres', () => {
  it('une cloison interrompue de 90 cm devient une porte', () => {
    const { walls, doors } = doorsFromGaps([
      { a: { x: 0, y: 3000 }, b: { x: 2000, y: 3000 }, thickness: 100 },
      { a: { x: 2900, y: 3000 }, b: { x: 5000, y: 3000 }, thickness: 100 },
    ]);
    expect(walls).toHaveLength(1);
    expect(walls[0]).toMatchObject({ a: { x: 0, y: 3000 }, b: { x: 5000, y: 3000 } });
    expect(doors).toEqual([{ a: { x: 2000, y: 3000 }, b: { x: 2900, y: 3000 }, width: 100 }]);
  });

  it('une cloison qui s’arrête à 85 cm d’un mur reçoit une porte et rejoint le mur', () => {
    const { walls, doors } = doorsFromGaps([
      { a: { x: 0, y: 0 }, b: { x: 0, y: 4000 }, thickness: 200 },
      { a: { x: 950, y: 2000 }, b: { x: 4000, y: 2000 }, thickness: 100 },
    ]);
    expect(doors).toHaveLength(1);
    expect(doors[0].b).toEqual({ x: 100, y: 2000 });
    expect(walls[1].a).toEqual({ x: 0, y: 2000 });
  });

  it('les parties claires d’une façade sont des ouvertures', () => {
    const img = blank(300, 40);
    fill(img, 0, 10, 300, 30, 110); // mur gris
    fill(img, 100, 10, 160, 30, 225); // fenêtre (claire)
    fill(img, 100, 19, 160, 21, 60); // trait du châssis
    const gaps = bandGaps(toGray(img), { x0: 0, y0: 10, x1: 299, y1: 29 }, true, 20, 200);
    expect(gaps).toHaveLength(1);
    expect(Math.abs(gaps[0][0] - 100)).toBeLessThanOrEqual(3);
    expect(Math.abs(gaps[0][1] - 160)).toBeLessThanOrEqual(3);
  });
});
