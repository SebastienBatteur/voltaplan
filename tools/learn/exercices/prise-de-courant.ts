// Exercice : prise de courant (arrivée + deux prises en parallèle, avec la terre)
import type { Exercise, MakeNode } from '../types';

export const exercise: Exercise = {
  id: 'prise-de-courant',
  title: 'câbler deux prises de courant',
  task: 'Alimentez les deux prises depuis l’arrivée du tableau : chaque prise doit recevoir la phase, le neutre et la terre. Vous pouvez repiquer la seconde prise sur la première. Choisissez la couleur de chaque fil, puis cliquez sur « Vérifier ».',
  devices: [
    { id: 'src', type: 'supply', label: 'Arrivée (tableau)', x: 10, y: 10 },
    { id: 'p1', type: 'socket', label: 'Prise 1', x: 168, y: 10 },
    { id: 'p2', type: 'socket', label: 'Prise 2', x: 326, y: 10 },
  ],
  h: 190,
  cases: [{ set: {}, expect: { p1: true, p2: true } }],
  solution: [
    { a: 'src.L', b: 'p1.L', color: 'brown' },
    { a: 'src.N', b: 'p1.N', color: 'blue' },
    { a: 'src.PE', b: 'p1.PE', color: 'gy' },
    { a: 'p1.L', b: 'p2.L', color: 'brown' },
    { a: 'p1.N', b: 'p2.N', color: 'blue' },
    { a: 'p1.PE', b: 'p2.PE', color: 'gy' },
  ],
};

export const unifilar = (node: MakeNode) => [
  node('protection', { device: 'mcb', circuitName: 'Prises', ratedCurrent: 20, poles: '1P+N', curve: 'C' }, [
    node('cable', { cableType: 'XVB', section: 2.5, conductors: 3 }, [node('socket', { count: 1 }), node('socket', { count: 1 })]),
  ]),
];

export const unifilarCaption =
  'Disjoncteur 20 A, câble 3G2,5 mm² et deux points de prise sur le même circuit. Une prise double serait dessinée comme un seul point, avec le nombre 2 à côté du symbole.';
