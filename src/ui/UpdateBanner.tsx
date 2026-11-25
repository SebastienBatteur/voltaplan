import { useEffect, useState } from 'react';
import { applyUpdate, onUpdate } from '../appUpdate';
import { browserSave, draftId } from '../io/storage';
import { requestPersistence } from '../io/persist';
import { useStore } from '../store';
import { Notice } from './Notice';

/**
 * Projet non enregistré : le garder comme brouillon (le même que l'enregistrement automatique de App.tsx),
 * proposé à la récupération au redémarrage. Rien à faire sans modification.
 */
async function keepDraft() {
  const st = useStore.getState();
  if (!st.dirty) return;
  await browserSave(draftId(), st.fileName || st.project.meta.title, st.project, 'any');
  void requestPersistence();
}

/**
 * Bandeau discret « Nouvelle version disponible — Recharger » (src/appUpdate.ts) : nouvelle version du
 * service worker en attente, ou fichier de l'ancienne version introuvable. Le rechargement garde d'abord
 * le brouillon ; s'il ne peut pas être gardé, on ne recharge pas.
 */
export function UpdateBanner() {
  const t = useStore((s) => s.t);
  const dirty = useStore((s) => s.dirty);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => onUpdate(() => setReady(true)), []);
  if (!ready) return null;
  return (
    // Une seule ligne : pictogrammes au lieu des mots (idée de l'utilisateur) ; le mot reste en infobulle et lu
    <Notice role="status" line>
      <span className="notice-text">
        {t('app.updateReady')} {failed ? <span className="error-text">{t('app.updateDraftFailed')}</span> : dirty ? t('app.updateKeepsDraft') : null}
      </span>
      <button
        className="primary icon-button"
        title={t('app.reload')}
        aria-label={t('app.reload')}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setFailed(false);
          const ok = await applyUpdate(keepDraft);
          if (!ok) {
            setFailed(true);
            setBusy(false);
          }
        }}
      >
        ⟳
      </button>
      <button className="icon-button" onClick={() => setReady(false)} title={t('app.updateLater')} aria-label={t('app.updateLater')}>
        ✕
      </button>
    </Notice>
  );
}

/** Hors ligne : petit repère près des actions qui ont besoin d'Internet (IA, services en ligne). */
/** Connexion réseau (événements online / offline du navigateur). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

export function OfflineBadge() {
  const t = useStore((s) => s.t);
  const online = useOnline();
  if (online) return null;
  return (
    <span className="offline-badge" title={t('app.offlineHelp')} role="status">
      {t('app.offline')}
    </span>
  );
}
