// Exercice : détecteur de mouvement (modèle à 3 fils : phase, neutre, sortie vers la lampe)
import type { Exercise, MakeNode } from '../types';

export const exercise: Exercise = {
  id: 'detecteur-de-mouvement',
  title: 'câbler un détecteur de mouvement',
  task: 'Ce détecteur se raccorde en trois fils : phase (L), neutre (N) et sortie vers la lampe. Reliez l’arrivée, le détecteur et la lampe pour que la lampe s’allume quand un mouvement est détecté, puis cliquez sur « Vérifier ».',
  devices: [
    { id: 'src', type: 'supply', label: 'Arrivée (tableau)', x: 10, y: 10 },
    { id: 'det', type: 'detector', label: 'Détecteur', x: 168, y: 10 },
    { id: 'lamp', type: 'lamp', label: 'Lampe', x: 326, y: 10 },
  ],
  h: 190,
  cases: [
    { set: { det: 'idle' }, expect: { lamp: false } },
    { set: { det: 'motion' }, expect: { lamp: true } },
  ],
  solution: [
    { a: 'src.L', b: 'det.L', color: 'brown' },
    { a: 'src.N', b: 'det.N', color: 'blue' },
    { a: 'det.out', b: 'lamp.L', color: 'black' },
    { a: 'det.N', b: 'lamp.N', color: 'blue' },
    { a: 'src.PE', b: 'lamp.PE', color: 'gy' },
  ],
};

export const unifilar = (node: MakeNode) => [
  node('protection', { device: 'mcb', circuitName: 'Éclairage extérieur', ratedCurrent: 16, poles: '1P+N', curve: 'C' }, [
    node('cable', { cableType: 'XVB', section: 1.5, conductors: 3 }, [node('detector', { detectorType: 'motion' }, [node('light')])]),
  ]),
];

export const unifilarCaption =
  'Disjoncteur 16 A, câble 3G1,5 mm², détecteur de mouvement et point lumineux. Le détecteur prend la place de l’interrupteur dans la chaîne : c’est lui qui commande la lampe.';
