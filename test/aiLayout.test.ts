import { describe, expect, it } from 'vitest';
import { layoutFromReading, type PhotoDeviceT, type PhotoReadingT } from '../src/ai/boardPhoto';
import { createNode } from '../src/model/tree';

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

  it("sans indice, suit l'ordre de l'arbre ; un appareil plus large que sur la photo pousse ses voisins", () => {
    const wide = dev({ device: 'mcb', poles: '2P', ratedCurrent: 20 }); // 2 modules dans le projet
    const reading: PhotoReadingT = {
      rows: [{ row: 1, devices: [seen(0, 1, 'mcb'), seen(1, 1, 'mcb'), seen(2, 1, 'mcb')] }],
      notes: null,
    };
    const r = layoutFromReading([wide, a, b], reading, 4);
    expect(r.slots[wide.id]).toEqual({ row: 1, col: 0 });
    expect(r.slots[a.id]).toEqual({ row: 1, col: 2 });
    // b poussé en 3 : tient encore dans la rangée de 4
    expect(r.slots[b.id]).toEqual({ row: 1, col: 3 });
    // Rangée trop courte : ce qui déborde reste en réserve
    const r2 = layoutFromReading([wide, a, b], reading, 3);
    expect(r2.unplaced).toEqual([b]);
  });

  it('les appareils en trop dans le projet restent en réserve', () => {
    const reading: PhotoReadingT = { rows: [{ row: 0, devices: [seen(0, 1, 'mcb', { ratedCurrentA: 20 })] }], notes: null };
    const r = layoutFromReading([a, b, c], reading, 13);
    expect(Object.keys(r.slots)).toEqual([b.id]);
    expect(r.unplaced).toEqual([a, c]);
  });
});
