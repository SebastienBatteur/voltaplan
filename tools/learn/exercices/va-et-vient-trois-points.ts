// Exercice : va-et-vient à trois points de commande (va-et-vient + inverseur + va-et-vient)
import type { Exercise, MakeNode } from '../types';

export const exercise: Exercise = {
  id: 'va-et-vient-trois-points',
  title: 'commander une lampe depuis trois endroits',
  task: 'Reliez l’arrivée, les deux va-et-vient, l’inverseur placé entre eux et la lampe pour que <strong>chacune</strong> des trois commandes change l’état de la lampe, quelle que soit la position des deux autres. Les navettes passent par l’inverseur. Essayez toutes les positions, puis cliquez sur « Vérifier ».',
  devices: [
    { id: 'src', type: 'supply', label: 'Arrivée (tableau)', x: 10, y: 10 },
    { id: 's1', type: 'twoway', label: 'Va-et-vient 1', x: 160, y: 10 },
    { id: 'inv', type: 'intermediate', label: 'Inverseur', x: 310, y: 10 },
    { id: 'lamp', type: 'lamp', label: 'Lampe', x: 10, y: 250, side: 'top' },
    { id: 's2', type: 'twoway', label: 'Va-et-vient 2', x: 327, y: 250, side: 'top' },
  ],
  h: 350,
  toggle: { inputs: ['s1', 'inv', 's2'], output: 'lamp' },
  solution: [
    { a: 'src.L', b: 's1.C', color: 'brown' },
    { a: 's1.1', b: 'inv.1', color: 'black' },
    { a: 's1.2', b: 'inv.2', color: 'grey' },
    { a: 'inv.3', b: 's2.1', color: 'black' },
    { a: 'inv.4', b: 's2.2', color: 'grey' },
    { a: 's2.C', b: 'lamp.L', color: 'black' },
    { a: 'src.N', b: 'lamp.N', color: 'blue' },
    { a: 'src.PE', b: 'lamp.PE', color: 'gy' },
  ],
};

export const unifilar = (node: MakeNode) => [
  node('protection', { device: 'mcb', circuitName: 'Éclairage', ratedCurrent: 16, poles: '1P+N', curve: 'C' }, [
    node('cable', { cableType: 'XVB', section: 1.5, conductors: 3 }, [
      node('switch', { switchType: 'twoWay' }, [
        node('switch', { switchType: 'intermediate' }, [node('switch', { switchType: 'twoWay' }, [node('light')])]),
      ]),
    ]),
  ]),
];

export const unifilarCaption =
  'Disjoncteur 16 A, câble 3G1,5 mm², puis la chaîne va-et-vient, inverseur, va-et-vient et le point lumineux. Pour un quatrième point de commande, on ajouterait un second inverseur dans la chaîne.';
