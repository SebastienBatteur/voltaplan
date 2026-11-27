// Exercice : ouvrant motorisé (coupole, fenêtre de toit) commandé par une commande ouvrir / fermer, via une boîte
import type { Exercise, MakeNode } from '../types';

export const exercise: Exercise = {
  id: 'fenetre-motorisee',
  title: 'câbler une coupole motorisée',
  task: 'Le moteur de la coupole a deux sens : « ouvrir » (borne de montée) et « fermer » (borne de descente). Passez par la boîte de dérivation pour relier l’arrivée du tableau, la commande et le moteur. Essayez les trois positions de la commande (arrêt, ouvrir, fermer), puis cliquez sur « Vérifier ».',
  devices: [
    { id: 'src', type: 'supply', label: 'Arrivée (tableau)', x: 10, y: 10 },
    { id: 'box', type: 'box', label: 'Boîte de dérivation', x: 168, y: 10 },
    { id: 'cmd', type: 'shutterSwitch', label: 'Commande ouvrir / fermer', x: 428, y: 10 },
    { id: 'motor', type: 'motor', label: 'Moteur de la coupole', x: 202, y: 250, side: 'top' },
  ],
  h: 350,
  cases: [
    { set: { cmd: 'stop' }, expect: { motor: { up: false, down: false } } },
    { set: { cmd: 'up' }, expect: { motor: { up: true, down: false } } },
    { set: { cmd: 'down' }, expect: { motor: { up: false, down: true } } },
  ],
  solution: [
    { a: 'src.L', b: 'box.a', color: 'brown' },
    { a: 'box.a', b: 'cmd.L', color: 'brown' },
    { a: 'cmd.up', b: 'box.b', color: 'black' },
    { a: 'box.b', b: 'motor.up', color: 'black' },
    { a: 'cmd.down', b: 'box.c', color: 'grey' },
    { a: 'box.c', b: 'motor.down', color: 'grey' },
    { a: 'src.N', b: 'box.d', color: 'blue' },
    { a: 'box.d', b: 'motor.N', color: 'blue' },
    { a: 'src.PE', b: 'box.e', color: 'gy' },
    { a: 'box.e', b: 'motor.PE', color: 'gy' },
  ],
};

export const unifilar = (node: MakeNode) => [
  node('protection', { device: 'mcb', circuitName: 'Coupole', ratedCurrent: 16, poles: '1P+N', curve: 'C' }, [
    node('cable', { cableType: 'XVB', section: 1.5, conductors: 3 }, [
      node('switch', { switchType: 'shutter' }, [node('cable', { cableType: 'XVB', section: 1.5, conductors: 4 }, [node('motor')])]),
    ]),
  ]),
];

export const unifilarCaption =
  'Le même schéma que pour un volet : disjoncteur 16 A, câble 3G1,5 mm², commande à deux sens (deux flèches), puis câble à 4 conducteurs vers le moteur de l’ouvrant. La boîte de dérivation n’est pas dessinée ici, pour garder le schéma lisible.';
