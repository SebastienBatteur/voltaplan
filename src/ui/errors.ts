import { ProjectFileError } from '../model/migrate';

type T = (k: string, p?: Record<string, string | number>) => string;

/** Message d'erreur traduit quand l'erreur est connue (lecture d'un projet), sinon son texte. */
export function errorText(e: unknown, t: T): string {
  if (e instanceof ProjectFileError) return t('file.error.' + e.code, e.params);
  return e instanceof Error ? e.message : String(e);
}
