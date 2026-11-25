/**
 * Composants propres à Voltaplan dont on calcule les empreintes de similarité : le cœur métier, pas l'interface ni
 * les bibliothèques. Un dérivé qui ne garde qu'un composant (intégré dans une autre application) reste repérable.
 */
export const COMPONENTS: { name: string; description: string; paths: string[] }[] = [
  { name: 'rgie-rules', description: "Moteur d'analyse RGIE (règles, contexte, connaissances)", paths: ['src/rules/'] },
  { name: 'electrical-model', description: 'Modèle de données électriques, migrations, calculs', paths: ['src/model/', 'src/calc/'] },
  { name: 'file-format', description: 'Format de fichier .voltaplan (archive, manifeste, dossier, intégrité)', paths: ['src/format/'] },
  { name: 'graphics', description: 'Représentation graphique (unifilaire, plan, tableau)', paths: ['src/unifilar/', 'src/plan/', 'src/board/'] },
];
