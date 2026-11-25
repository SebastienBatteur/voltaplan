/**
 * Application de bureau : avertissement à la fermeture de la fenêtre quand le projet n'est pas enregistré
 * (écart O10). La fermeture est interceptée côté Rust (src-tauri/src/close_guard.rs) ; la page lui transmet
 * seulement l'état du projet et le texte traduit, à chaque changement.
 */
import { APP_NAME } from '../brand';

export interface CloseWarningArgs {
  [key: string]: unknown;
  /** `null` : rien à enregistrer, la fenêtre se ferme sans question. */
  message: string | null;
  title: string;
  close: string;
  cancel: string;
}

export function closeWarningArgs(dirty: boolean, t: (key: string) => string): CloseWarningArgs {
  return {
    message: dirty ? t('app.closeUnsaved') : null,
    title: APP_NAME,
    close: t('app.closeAnyway'),
    cancel: t('app.closeCancel'),
  };
}

/** Transmet l'état à Rust ; sans effet hors de l'application de bureau. */
export async function syncCloseWarning(args: CloseWarningArgs): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('set_close_warning', args);
}
