/**
 * Transformations appliquées par les tests de robustesse des empreintes : ce qu'un dérivé peut faire au code.
 * Outils de test seulement (jamais dans l'application).
 */
import ts from 'typescript';

/** Retire une instruction de premier niveau sur `every` (suppression de fonctionnalités, code partiel). */
export function dropStatements(js: string, every: number, offset = 0): string {
  const sf = ts.createSourceFile('x.js', js, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
  return sf.statements
    .filter((_, i) => (i + offset) % every !== 0)
    .map((s) => js.slice(s.getFullStart(), s.getEnd()))
    .join('\n');
}

/** Renomme le projet dans les chaînes et le code (nouveau nom commercial). */
export function renameProject(js: string, to = 'Wattmap'): string {
  return js.replace(/Voltaplan/g, to).replace(/VoltaPlan/g, to).replace(/voltaplan/g, to.toLowerCase());
}

/** Retire les commentaires légaux et les métadonnées d'identification (bandeau « /*! … *\/ », balises). */
export function stripMetadata(js: string): string {
  return js.replace(/\/\*![\s\S]*?\*\//g, '').replace(/Project-ID:[^\n]*/g, '');
}
