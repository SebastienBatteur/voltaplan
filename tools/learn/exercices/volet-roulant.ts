// Exercice : volet roulant (une commande de volet à deux sens commande un moteur tubulaire)
import type { Exercise, MakeNode } from '../types';

export const exercise: Exercise = {
  id: 'volet-roulant',
  title: 'câbler un volet roulant',
  task: 'Reliez l’arrivée du tableau, la commande de volet et le moteur pour que la touche « montée » fasse monter le volet et la touche « descente » le fasse descendre. Choisissez la couleur de chaque fil, essayez les trois positions (arrêt, montée, descente), puis cliquez sur « Vérifier ».',
  devices: [
    { id: 'src', type: 'supply', label: 'Arrivée (tableau)', x: 10, y: 10 },
    { id: 'cmd', type: 'shutterSwitch', label: 'Commande de volet', x: 168, y: 10 },
    { id: 'motor', type: 'motor', label: 'Moteur du volet', x: 326, y: 10 },
  ],
  h: 190,
  cases: [
    { set: { cmd: 'stop' }, expect: { motor: { up: false, down: false } } },
    { set: { cmd: 'up' }, expect: { motor: { up: true, down: false } } },
    { set: { cmd: 'down' }, expect: { motor: { up: false, down: true } } },
  ],
  solution: [
    { a: 'src.L', b: 'cmd.L', color: 'brown' },
    { a: 'cmd.up', b: 'motor.up', color: 'black' },
    { a: 'cmd.down', b: 'motor.down', color: 'grey' },
    { a: 'src.N', b: 'motor.N', color: 'blue' },
    { a: 'src.PE', b: 'motor.PE', color: 'gy' },
  ],
};

export const unifilar = (node: MakeNode) => [
  node('protection', { device: 'mcb', circuitName: 'Volets', ratedCurrent: 16, poles: '1P+N', curve: 'C' }, [
    node('cable', { cableType: 'XVB', section: 1.5, conductors: 3 }, [
      node('switch', { switchType: 'shutter' }, [node('cable', { cableType: 'XVB', section: 1.5, conductors: 4 }, [node('motor')])]),
    ]),
  ]),
];

export const unifilarCaption =
  'Disjoncteur 16 A, câble 3G1,5 mm² jusqu’à la commande de volet (symbole d’interrupteur avec deux flèches), puis câble à 4 conducteurs (montée, descente, neutre, terre) jusqu’au moteur, représenté par un M dans un cercle.';
