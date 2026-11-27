// Exercice : télérupteur commandé par deux boutons-poussoirs en parallèle
import type { Exercise, MakeNode } from '../types';

export const exercise: Exercise = {
  id: 'telerupteur',
  title: 'câbler un télérupteur et deux boutons-poussoirs',
  task: 'Reliez l’arrivée, les deux boutons-poussoirs, le télérupteur et la lampe : chaque appui, sur l’un ou l’autre bouton, doit allumer la lampe si elle est éteinte et l’éteindre si elle est allumée. Les boutons alimentent la bobine (A1, A2) ; le contact (1, 2) alimente la lampe. Appuyez sur les boutons pour essayer, puis cliquez sur « Vérifier ».',
  devices: [
    { id: 'src', type: 'supply', label: 'Arrivée (tableau)', x: 10, y: 10 },
    { id: 'p1', type: 'push', label: 'Poussoir 1', x: 170, y: 10 },
    { id: 'p2', type: 'push', label: 'Poussoir 2', x: 306, y: 10 },
    { id: 'tl', type: 'relay', label: 'Télérupteur', x: 10, y: 250, side: 'top' },
    { id: 'lamp', type: 'lamp', label: 'Lampe', x: 230, y: 250, side: 'top' },
  ],
  h: 350,
  sequence: [
    { expect: { lamp: false } },
    { press: 'p1', expect: { lamp: true } },
    { press: 'p2', expect: { lamp: false } },
    { press: 'p2', expect: { lamp: true } },
    { press: 'p1', expect: { lamp: false } },
  ],
  solution: [
    { a: 'src.L', b: 'p1.1', color: 'brown' },
    { a: 'p1.1', b: 'p2.1', color: 'brown' },
    { a: 'p1.2', b: 'tl.A1', color: 'black' },
    { a: 'p2.2', b: 'p1.2', color: 'black' },
    { a: 'src.N', b: 'tl.A2', color: 'blue' },
    { a: 'src.L', b: 'tl.1', color: 'brown' },
    { a: 'tl.2', b: 'lamp.L', color: 'grey' },
    { a: 'tl.A2', b: 'lamp.N', color: 'blue' },
    { a: 'src.PE', b: 'lamp.PE', color: 'gy' },
  ],
};

export const unifilar = (node: MakeNode) => [
  node('protection', { device: 'mcb', circuitName: 'Éclairage', ratedCurrent: 16, poles: '1P+N', curve: 'C' }, [
    node('cable', { cableType: 'XVB', section: 1.5, conductors: 3 }, [
      node('pushButton', {}, [
        node('cable', { cableType: 'XVB', section: 1.5, conductors: 3 }, [
          node('pushButton', {}, [node('relay', { relayType: 'teleswitch' }, [node('light')])]),
        ]),
      ]),
    ]),
  ]),
];

export const unifilarCaption =
  'Disjoncteur 16 A, câble 3G1,5 mm², deux boutons-poussoirs, le télérupteur (dans le tableau) et le point lumineux. Pour un point de commande de plus, il suffit d’ajouter un bouton-poussoir dans la chaîne.';
