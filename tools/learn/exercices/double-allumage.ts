// Exercice : double allumage (un interrupteur double commande deux lampes séparément)
import type { Exercise, MakeNode } from '../types';

export const exercise: Exercise = {
  id: 'double-allumage',
  title: 'câbler un double allumage',
  task: 'Reliez l’arrivée, l’interrupteur double et les deux lampes pour que la touche 1 commande la lampe 1 et la touche 2 la lampe 2. Choisissez la couleur de chaque fil, essayez les deux touches, puis cliquez sur « Vérifier ».',
  devices: [
    { id: 'src', type: 'supply', label: 'Arrivée (tableau)', x: 10, y: 10 },
    { id: 'd1', type: 'double', label: 'Interrupteur double', x: 200, y: 10 },
    { id: 'lamp1', type: 'lamp', label: 'Lampe 1', x: 10, y: 250, side: 'top' },
    { id: 'lamp2', type: 'lamp', label: 'Lampe 2', x: 200, y: 250, side: 'top' },
  ],
  h: 350,
  cases: [
    { set: { d1: '00' }, expect: { lamp1: false, lamp2: false } },
    { set: { d1: '10' }, expect: { lamp1: true, lamp2: false } },
    { set: { d1: '01' }, expect: { lamp1: false, lamp2: true } },
    { set: { d1: '11' }, expect: { lamp1: true, lamp2: true } },
  ],
  solution: [
    { a: 'src.L', b: 'd1.L', color: 'brown' },
    { a: 'd1.1', b: 'lamp1.L', color: 'black' },
    { a: 'd1.2', b: 'lamp2.L', color: 'grey' },
    { a: 'src.N', b: 'lamp1.N', color: 'blue' },
    { a: 'lamp1.N', b: 'lamp2.N', color: 'blue' },
    { a: 'src.PE', b: 'lamp1.PE', color: 'gy' },
    { a: 'lamp1.PE', b: 'lamp2.PE', color: 'gy' },
  ],
};

export const unifilar = (node: MakeNode) => [
  node('protection', { device: 'mcb', circuitName: 'Éclairage', ratedCurrent: 16, poles: '1P+N', curve: 'C' }, [
    node('cable', { cableType: 'XVB', section: 1.5, conductors: 3 }, [node('switch', { switchType: 'double' }, [node('light'), node('light')])]),
  ]),
];

export const unifilarCaption =
  'Disjoncteur 16 A, câble 3G1,5 mm², interrupteur double et deux points lumineux. Les deux lampes sont dessinées derrière le même symbole d’interrupteur double : chacune dépend de sa touche.';
