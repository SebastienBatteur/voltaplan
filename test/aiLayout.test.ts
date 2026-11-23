import { describe, expect, it } from 'vitest';
import { layoutFromReading, type PhotoDeviceT, type PhotoReadingT } from '../src/ai/boardPhoto';
import { createNode } from '../src/model/tree';
import { enclosures, moduleWidth } from '../src/board/model';

const dev = (props: Record<string, string | number>) => createNode('protection', props);
const seen = (startModule: number, widthModules: number, kind: PhotoDeviceT['kind'], more: Partial<PhotoDeviceT> = {}): PhotoDeviceT => ({
  startModule,
  widthModules,
  kind,
  poles: null,
  ratedCurrentA: null,
  curve: null,
  residualCurrentmA: null,
  rcdType: null,
  label: null,
  confidence: 'high',
  ...more,
});

describe("disposition d'après la lecture de l'IA", () => {
  const rcd = dev({ device: 'rcd', poles: '2P', residualCurrent: 30, ratedCurrent: 40 });
  const a = dev({ device: 'mcb', poles: '1P+N', ratedCurrent: 16, curve: 'B' });
  const b = dev({ device: 'mcb', poles: '1P+N', ratedCurrent: 20, curve: 'B' });
  const c = dev({ device: 'mcb', poles: '1P+N', ratedCurrent: 10, curve: 'B' });
  const labels = new Map([
    [a.id, 'A Prises cuisine'],
    [b.id, 'B Four'],
    [c.id, 'C Éclairage'],
  ]);

  it('place chaque appareil, y compris ceux de la réserve, selon calibre et étiquette', () => {
    // Photo : disjoncteurs dans l'ordre C, A, B après le différentiel ; une rangée plus bas, un cache
    const reading: PhotoReadingT = {
      rows: [
        {
          row: 0,
          devices: [
            seen(0, 2, 'rcd', { residualCurrentmA: 30 }),
            seen(2, 1, 'mcb', { ratedCurrentA: 10, label: 'Eclairage' }),
            seen(3, 1, 'mcb', { ratedCurrentA: 16 }),
            seen(4, 1, 'mcb', { label: 'B' }),
            seen(5, 3, 'blank'),
          ],
        },
      ],
      notes: null,
    };
    const r = layoutFromReading([rcd, a, b, c], reading, 13, (n) => labels.get(n.id) ?? '');
    expect(r.slots).toEqual({ [rcd.id]: { row: 0, col: 0 }, [c.id]: { row: 0, col: 2 }, [a.id]: { row: 0, col: 3 }, [b.id]: { row: 0, col: 4 } });
    expect(r.unplaced).toEqual([]);
  });

  it("sans indice, suit l'ordre de l'arbre ; la largeur lue sur la photo remplace celle du projet", () => {
    const wide = dev({ device: 'mcb', poles: '2P', ratedCurrent: 20 }); // 2 modules dans le projet, 1 sur la photo
    const reading: PhotoReadingT = {
      rows: [{ row: 1, devices: [seen(0, 1, 'mcb'), seen(1, 1, 'mcb'), seen(2, 1, 'mcb')] }],
      notes: null,
    };
    const r = layoutFromReading([wide, a, b], reading, 3);
    expect(r.slots).toEqual({ [wide.id]: { row: 1, col: 0 }, [a.id]: { row: 1, col: 1 }, [b.id]: { row: 1, col: 2 } });
    expect(r.props).toEqual({ [wide.id]: { modules: 1 } });
    expect(r.unplaced).toEqual([]);
  });

  it('les appareils en trop dans le projet restent en réserve', () => {
    const reading: PhotoReadingT = { rows: [{ row: 0, devices: [seen(0, 1, 'mcb', { ratedCurrentA: 20 })] }], notes: null };
    const r = layoutFromReading([a, b, c], reading, 13);
    expect(Object.keys(r.slots)).toEqual([b.id]);
    expect(r.unplaced).toEqual([a, c]);
  });

  it('tableau réel : tétrapolaires de 2 modules, différentiel 300 mA, compteur connecté ; marque et modèle repris', () => {
    // Projet : U (C32, 4P → 4 modules par défaut), V (C20 4P), W (C32 4P), différentiel 300 mA 4P, compteur divisionnaire
    const U = dev({ device: 'mcb', poles: '4P', ratedCurrent: 32, curve: 'C' });
    const V = dev({ device: 'mcb', poles: '4P', ratedCurrent: 20, curve: 'C' });
    const W = dev({ device: 'mcb', poles: '4P', ratedCurrent: 32, curve: 'C' });
    const rcd300 = dev({ device: 'rcd', poles: '4P', ratedCurrent: 40, residualCurrent: 300 });
    const meter = createNode('meter', { name: 'Compteur connecté' });
    expect(moduleWidth(U)).toBe(4);
    // Photo, rangée 3 : cache de 5 modules, U et V en 2 modules, différentiel 4 modules, compteur 4 modules
    const reading: PhotoReadingT = {
      rows: [
        {
          row: 2,
          devices: [
            seen(0, 5, 'blank'),
            seen(5, 2, 'mcb', { ratedCurrentA: 32, curve: 'C', brand: 'Hager', model: 'MBN432' }),
            seen(7, 2, 'mcb', { ratedCurrentA: 20, curve: 'C', brand: 'Hager', model: 'MBN420' }),
            seen(9, 4, 'rcd', { residualCurrentmA: 300 }),
            seen(13, 4, 'domotic', { brand: 'EARU', model: 'EAKCB-Z-M' }),
          ],
        },
      ],
      notes: null,
    };
    const r = layoutFromReading([U, V, W, rcd300, meter], reading, 18);
    expect(r.slots[U.id]).toEqual({ row: 2, col: 5 });
    expect(r.slots[V.id]).toEqual({ row: 2, col: 7 });
    expect(r.slots[rcd300.id]).toEqual({ row: 2, col: 9 });
    // Compteur du projet et module connecté de la photo : compatibles
    expect(r.slots[meter.id]).toEqual({ row: 2, col: 13 });
    expect(r.props[U.id]).toEqual({ modules: 2, reference: 'Hager MBN432' });
    expect(r.props[V.id]).toEqual({ modules: 2, reference: 'Hager MBN420' });
    expect(r.props[meter.id]).toEqual({ modules: 4, reference: 'EARU EAKCB-Z-M' });
    // W n'est pas sur la photo : réserve, jamais à la place du compteur
    expect(r.unplaced).toEqual([W]);
  });

  it('relais et compteur après le tableau comptent comme appareils du tableau ; un transformateur seulement si coché', () => {
    const board = createNode('board');
    const mcb = dev({ device: 'mcb' });
    const cable = createNode('cable');
    const relay = createNode('relay', { relayType: 'teleswitch' });
    const trafo = createNode('transformer', { inBoard: false });
    const trafo2 = createNode('transformer', { inBoard: true });
    relay.children = [trafo, trafo2];
    cable.children = [relay];
    mcb.children = [cable];
    board.children = [mcb];
    const e = enclosures([board])[0];
    expect(e.devices.map((n) => n.id)).toEqual([mcb.id, relay.id, trafo2.id]);
  });
});
