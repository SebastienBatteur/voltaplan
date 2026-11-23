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
