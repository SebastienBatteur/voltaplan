import { hitTest } from '../src/ui/PlanView';
import { emptyPage } from '../src/model/tree';

describe('sélection des portes et fenêtres sur le plan', () => {
  const page = emptyPage('t');
  page.walls.push({ a: { x: 0, y: 0 }, b: { x: 5000, y: 0 }, thickness: 200 });
  // Porte de 900 mm, charnière en a (x=1000), s'ouvre côté +y (« right »)
  page.openings.push({ kind: 'door', a: { x: 1000, y: 0 }, b: { x: 1900, y: 0 }, width: 200, hinge: 'right' });
  page.openings.push({ kind: 'slidingDoor', a: { x: 3000, y: 0 }, b: { x: 4800, y: 0 }, width: 200 });
  it('clic dans l’embrasure', () => expect(hitTest(page, { x: 1400, y: 10 }, 50)).toEqual({ type: 'opening', index: 0 }));
  it('clic sur le battant ouvert ou dans l’arc', () => {
    expect(hitTest(page, { x: 1010, y: 600 }, 50)).toEqual({ type: 'opening', index: 0 });
    expect(hitTest(page, { x: 1400, y: 400 }, 50)).toEqual({ type: 'opening', index: 0 });
  });
  it('pas de l’autre côté du mur ni hors de l’arc', () => {
    expect(hitTest(page, { x: 1400, y: -400 }, 50)).toBeNull();
    expect(hitTest(page, { x: 1900, y: 900 }, 50)).toBeNull();
  });
  it('baie vitrée coulissante sélectionnable', () => expect(hitTest(page, { x: 3900, y: 0 }, 50)).toEqual({ type: 'opening', index: 1 }));
});

describe('meubles importés de Trikker (images)', () => {
  const page = emptyPage('t');
  // lit de 2 m × 1,6 m tourné de 90° autour de (3000, 3000) ; fond de plan en dessous
  page.images.push({ center: { x: 5000, y: 5000 }, w: 10000, h: 10000, angle: 0, href: 'x', background: true });
  page.images.push({ center: { x: 3000, y: 3000 }, w: 2000, h: 1600, angle: 90, href: 'y' });
  it('un clic sur le meuble le sélectionne, même tourné', () => {
    expect(hitTest(page, { x: 3000, y: 3900 }, 50)).toEqual({ type: 'image', index: 1 }); // dans la longueur, après rotation
  });
  it('à côté du meuble : le fond de plan', () => {
    expect(hitTest(page, { x: 3950, y: 3000 }, 50)).toEqual({ type: 'image', index: 0 });
  });
});
