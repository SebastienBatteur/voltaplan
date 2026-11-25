import { ProjectFileError } from '../model/migrate';
import { importErrorText } from '../io/limits';
import { FileTooLargeError, isAuthError, isQuotaError, StorageFullError } from '../io/conflict';
import { ArchiveError, AssetIntegrityError } from '../format/archive';
import { AssetStoreError } from '../format/assets';
import { AssetUnavailableError } from '../format/session';
import { MissingAssetsError } from '../io/projectData';
import { RemoteAssetMismatchError } from '../format/folder';
import { DesktopSaveError } from '../io/desktopSave';

type T = (k: string, p?: Record<string, string | number>) => string;

/** Message d'erreur traduit quand l'erreur est connue (lecture d'un projet, fichier trop gros), sinon son texte. */
export function errorText(e: unknown, t: T): string {
  if (e instanceof ProjectFileError) return t('file.error.' + e.code, e.params);
  // Destination pleine : disque de l'appareil, ou espace du service (version gardée, pas de reprise automatique)
  if (e instanceof StorageFullError) return e.where === 'device' ? t('storage.full.device') : t('storage.full.cloud', { where: e.where });
  if (e instanceof FileTooLargeError) return t('storage.tooLarge', { where: e.where, size: Math.ceil(e.size / 1048576), limit: Math.floor(e.limit / 1048576) });
  if (isQuotaError(e)) return t('storage.quota');
  // Bureau : fichier utilisé ailleurs, ou autre échec d'écriture ; le fichier d'origine est toujours intact (O7)
  if (e instanceof DesktopSaveError)
    return e.kind === 'busy' ? t('desktop.saveBusy', { name: e.fileName }) : t('desktop.saveFailed', { name: e.fileName, detail: e.detail.replace(/^.*impossible\s*:\s*/, '') });
  // Boîte de fichiers refusée par le navigateur (geste de l'utilisateur expiré, p. ex. après une attente) : message
  // système en anglais remplacé par une consigne
  if (e instanceof DOMException && (e.name === 'SecurityError' || e.name === 'NotAllowedError') && /picker|gesture/i.test(e.message)) return t('storage.pickerBlocked');
  if (isAuthError(e)) return t(e.reason === 'login' ? 'save.needsLogin' : 'save.needsAuth', { where: e.where });
  // Format v2 (src/format)
  if (e instanceof ArchiveError) return t('format.error.' + e.code);
  if (e instanceof MissingAssetsError) return t('format.missingOnSave', { n: e.missing.length, list: e.missing.map((m) => m.label || m.sha256.slice(0, 12)).join(', ') });
  if (e instanceof AssetUnavailableError) return t('format.docUnavailable.' + e.reason);
  if (e instanceof AssetIntegrityError) return t('format.docUnavailable.invalid');
  if (e instanceof AssetStoreError) return t('format.assetError.' + e.code);
  if (e instanceof RemoteAssetMismatchError) return t('format.remoteAssetMismatch', { path: e.path });
  return importErrorText(e, t);
}
