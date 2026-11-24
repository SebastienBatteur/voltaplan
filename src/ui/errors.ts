import { ProjectFileError } from '../model/migrate';
import { importErrorText } from '../io/limits';
import { isAuthError, isQuotaError } from '../io/conflict';

type T = (k: string, p?: Record<string, string | number>) => string;

/** Message d'erreur traduit quand l'erreur est connue (lecture d'un projet, fichier trop gros), sinon son texte. */
export function errorText(e: unknown, t: T): string {
  if (e instanceof ProjectFileError) return t('file.error.' + e.code, e.params);
  if (isQuotaError(e)) return t('storage.quota');
  if (isAuthError(e)) return t('save.needsAuth', { where: e.where });
  return importErrorText(e, t);
}
