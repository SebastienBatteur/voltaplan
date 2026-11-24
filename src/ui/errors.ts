import { ProjectFileError } from '../model/migrate';
import { importErrorText } from '../io/limits';
import { isAuthError, isQuotaError } from '../io/conflict';
import { ArchiveError, AssetIntegrityError } from '../format/archive';
import { AssetStoreError } from '../format/assets';
import { AssetUnavailableError } from '../format/session';
import { MissingAssetsError } from '../io/projectData';
import { RemoteAssetMismatchError } from '../format/folder';

type T = (k: string, p?: Record<string, string | number>) => string;

/** Message d'erreur traduit quand l'erreur est connue (lecture d'un projet, fichier trop gros), sinon son texte. */
export function errorText(e: unknown, t: T): string {
  if (e instanceof ProjectFileError) return t('file.error.' + e.code, e.params);
  if (isQuotaError(e)) return t('storage.quota');
  if (isAuthError(e)) return t('save.needsAuth', { where: e.where });
  // Format v2 (src/format)
  if (e instanceof ArchiveError) return t('format.error.' + e.code);
  if (e instanceof MissingAssetsError) return t('format.missingOnSave', { n: e.missing.length, list: e.missing.map((m) => m.label || m.sha256.slice(0, 12)).join(', ') });
  if (e instanceof AssetUnavailableError) return t('format.docUnavailable.' + e.reason);
  if (e instanceof AssetIntegrityError) return t('format.docUnavailable.invalid');
  if (e instanceof AssetStoreError) return t('format.assetError.' + e.code);
  if (e instanceof RemoteAssetMismatchError) return t('format.remoteAssetMismatch', { path: e.path });
  return importErrorText(e, t);
}
