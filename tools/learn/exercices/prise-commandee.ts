// Exercice : prise commandée par un interrupteur (lampe sur pied), à côté d'une prise permanente
import type { Exercise, MakeNode } from '../types';

export const exercise: Exercise = {
  id: 'prise-commandee',
  title: 'câbler une prise commandée',
  task: 'L’interrupteur doit allumer et éteindre la prise 1 (une lampe sur pied y est branchée) ; la prise 2 reste toujours sous tension. Les deux prises reçoivent le neutre et la terre. Choisissez la couleur de chaque fil, essayez l’interrupteur, puis cliquez sur « Vérifier ».',
  devices: [
    { id: 'src', type: 'supply', label: 'Arrivée (tableau)', x: 10, y: 10 },
    { id: 's1', type: 'switch', label: 'Interrupteur', x: 168, y: 10 },
    { id: 'p1', type: 'socket', label: 'Prise 1 (commandée)', x: 304, y: 10 },
    { id: 'p2', type: 'socket', label: 'Prise 2 (permanente)', x: 462, y: 10 },
  ],
  h: 190,
  cases: [
    { set: { s1: 'off' }, expect: { p1: false, p2: true } },
    { set: { s1: 'on' }, expect: { p1: true, p2: true } },
  ],
  solution: [
    { a: 'src.L', b: 's1.L', color: 'brown' },
    { a: 's1.L', b: 'p2.L', color: 'brown' },
    { a: 's1.1', b: 'p1.L', color: 'black' },
    { a: 'src.N', b: 'p1.N', color: 'blue' },
    { a: 'p1.N', b: 'p2.N', color: 'blue' },
    { a: 'src.PE', b: 'p1.PE', color: 'gy' },
    { a: 'p1.PE', b: 'p2.PE', color: 'gy' },
  ],
};

export const unifilar = (node: MakeNode) => [
  node('protection', { device: 'mcb', circuitName: 'Prises salon', ratedCurrent: 20, poles: '1P+N', curve: 'C' }, [
    node('cable', { cableType: 'XVB', section: 2.5, conductors: 3 }, [
      node('socket', { count: 1 }),
      node('switch', { switchType: 'single' }, [node('cable', { cableType: 'XVB', section: 2.5, conductors: 3 }, [node('socket', { count: 1 })])]),
    ]),
  ]),
];

export const unifilarCaption =
  'Circuit de prises (disjoncteur 20 A, 2,5 mm²) : une prise permanente et, derrière l’interrupteur simple, une prise commandée. Tout le circuit, y compris le fil qui passe par l’interrupteur, est en 2,5 mm².';
