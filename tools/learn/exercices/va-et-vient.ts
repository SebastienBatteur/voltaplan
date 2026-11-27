// Exercice : va-et-vient (deux interrupteurs à deux directions commandent une lampe)
import type { Exercise, MakeNode } from '../types';

export const exercise: Exercise = {
  id: 'va-et-vient',
  title: 'câbler un va-et-vient',
  task: 'Reliez l’arrivée, les deux interrupteurs va-et-vient et la lampe pour que <strong>chaque</strong> interrupteur allume ou éteigne la lampe, quelle que soit la position de l’autre. Pensez aux deux navettes entre les interrupteurs, essayez toutes les positions, puis cliquez sur « Vérifier ».',
  devices: [
    { id: 'src', type: 'supply', label: 'Arrivée (tableau)', x: 10, y: 10 },
    { id: 's1', type: 'twoway', label: 'Va-et-vient 1', x: 190, y: 10 },
    { id: 'lamp', type: 'lamp', label: 'Lampe', x: 10, y: 250, side: 'top' },
    { id: 's2', type: 'twoway', label: 'Va-et-vient 2', x: 190, y: 250, side: 'top' },
  ],
  h: 350,
  toggle: { inputs: ['s1', 's2'], output: 'lamp' },
  solution: [
    { a: 'src.L', b: 's1.C', color: 'brown' },
    { a: 's1.1', b: 's2.1', color: 'black' },
    { a: 's1.2', b: 's2.2', color: 'grey' },
    { a: 's2.C', b: 'lamp.L', color: 'black' },
    { a: 'src.N', b: 'lamp.N', color: 'blue' },
    { a: 'src.PE', b: 'lamp.PE', color: 'gy' },
  ],
};

export const unifilar = (node: MakeNode) => [
  node('protection', { device: 'mcb', circuitName: 'Éclairage', ratedCurrent: 16, poles: '1P+N', curve: 'C' }, [
    node('cable', { cableType: 'XVB', section: 1.5, conductors: 3 }, [
      node('switch', { switchType: 'twoWay' }, [node('switch', { switchType: 'twoWay' }, [node('light')])]),
    ]),
  ]),
];

export const unifilarCaption =
  'Disjoncteur 16 A, câble 3G1,5 mm², deux interrupteurs va-et-vient en chaîne puis le point lumineux. Les navettes ne sont pas dessinées une à une : l’unifilaire indique seulement que les deux interrupteurs commandent la même lampe.';
