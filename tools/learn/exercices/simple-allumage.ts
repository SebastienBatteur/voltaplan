// Exercice : simple allumage (un interrupteur commande une lampe)
import type { Exercise, MakeNode } from '../types';

export const exercise: Exercise = {
  id: 'simple-allumage',
  title: 'câbler un simple allumage',
  task: 'Reliez l’arrivée du tableau, l’interrupteur et la lampe pour que l’interrupteur allume et éteigne la lampe. Choisissez la couleur de chaque fil, essayez l’interrupteur, puis cliquez sur « Vérifier ».',
  devices: [
    { id: 'src', type: 'supply', label: 'Arrivée (tableau)', x: 10, y: 10 },
    { id: 's1', type: 'switch', label: 'Interrupteur', x: 170, y: 10 },
    { id: 'lamp', type: 'lamp', label: 'Lampe', x: 310, y: 10 },
  ],
  h: 190,
  cases: [
    { set: { s1: 'off' }, expect: { lamp: false } },
    { set: { s1: 'on' }, expect: { lamp: true } },
  ],
  solution: [
    { a: 'src.L', b: 's1.L', color: 'brown' },
    { a: 's1.1', b: 'lamp.L', color: 'black' },
    { a: 'src.N', b: 'lamp.N', color: 'blue' },
    { a: 'src.PE', b: 'lamp.PE', color: 'gy' },
  ],
};

export const unifilar = (node: MakeNode) => [
  node('protection', { device: 'mcb', circuitName: 'Éclairage', ratedCurrent: 16, poles: '1P+N', curve: 'C' }, [
    node('cable', { cableType: 'XVB', section: 1.5, conductors: 3 }, [node('switch', { switchType: 'single' }, [node('light')])]),
  ]),
];

export const unifilarCaption =
  'Disjoncteur 16 A, câble 3G1,5 mm², interrupteur simple et point lumineux. L’unifilaire montre le circuit sur un seul trait : le nombre de conducteurs est indiqué par le câble, pas dessiné fil par fil.';
