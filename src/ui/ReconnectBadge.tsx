import { useEffect, useState } from 'react';
import { cloudConnect, cloudTokenExpiry, PROVIDERS, type CloudId } from '../io/cloud';
import { reconnectState } from '../io/reconnect';
import { useStore } from '../store';

/** Vérification de l'échéance : toutes les 15 s, et au retour sur l'onglet. */
const TICK_MS = 15_000;

/**
 * R2 : petit repère dans la barre, « Session Google Drive : fin dans 4 min · Reconnecter · ✕ ».
 * Jamais de focus pris ni de boîte de dialogue ; le clic sur « Reconnecter » ouvre la fenêtre de connexion du
 * service (autorisée car liée au clic), la page n'est jamais rechargée : rien de ce qui n'est pas enregistré n'est
 * touché. Règles d'affichage : src/io/reconnect.ts.
 */
export function ReconnectBadge({ getProvider, onReconnected }: { getProvider: () => CloudId | null; onReconnected: (id: CloudId) => void }) {
  const t = useStore((s) => s.t);
  const [now, setNow] = useState(() => Date.now());
  const [dismissedFor, setDismissedFor] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, TICK_MS);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const provider = getProvider();
  const expires = provider ? cloudTokenExpiry(provider) : null;
  const state = reconnectState({ provider, expires, dismissedFor, now });
  if (state.kind === 'hidden' || !provider) return null;
  const where = PROVIDERS[provider].label;

  const reconnect = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await cloudConnect(provider);
      setNow(Date.now()); // nouveau jeton : le repère disparaît
      onReconnected(provider);
    } catch (e) {
      const m = (e as Error).message;
      // Fenêtre fermée par l'utilisateur : rien à dire ; bloquée : on le dit, sans boîte de dialogue
      if (m === 'popup') setMsg(t('cloud.popupBlocked'));
      else if (m !== 'cancelled') setMsg(m);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className={'reconnect-badge ' + state.kind} role="status" title={t('reconnect.help', { where })}>
      {state.kind === 'soon' ? t('reconnect.soon', { where, min: state.minutes }) : t('reconnect.expired', { where })}{' '}
      <button className="link" disabled={busy} onClick={() => void reconnect()}>
        {busy ? '…' : t('reconnect.button')}
      </button>
      <button className="link" aria-label={t('reconnect.dismiss')} title={t('reconnect.dismiss')} onClick={() => setDismissedFor(expires)}>
        ✕
      </button>
      {msg && <span className="error-text"> {msg}</span>}
    </span>
  );
}
