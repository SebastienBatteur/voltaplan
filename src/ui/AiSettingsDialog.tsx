import { PROVIDERS, isLocalUrl, type ProviderId } from '../ai/provider';
import { useEffect, useState } from 'react';
import { aiTransferLink, decodeAiTransfer } from '../ai/transfer';
import { QrCode } from './QrCode';
import { useStore } from '../store';
import { loadAiSettings, saveAiSettings, getSessionKey, setSessionKey, type AiPermissions, type AiSettings } from '../ai/settings';
import { maskKey, seal, unseal } from '../ai/secureStore';
import { useModalDialog } from './a11y';

const PERMS: (keyof AiPermissions)[] = ['meterFromPhoto', 'planFromPhoto', 'boardFromPhoto', 'unifilarFromDocument', 'fixSuggestions'];

/**
 * Réglages de l'IA optionnelle : fournisseur, modèle, clé d'API chiffrée localement, et ce que l'IA a le droit de générer.
 */
export function AiSettingsDialog({ onClose, incoming }: { onClose: () => void; incoming?: string | null }) {
  const dialogRef = useModalDialog(onClose);
  const t = useStore((s) => s.t);
  const [s, setS] = useState<AiSettings>(loadAiSettings);
  const [newKey, setNewKey] = useState('');
  const [pass, setPass] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [unlocked, setUnlocked] = useState(getSessionKey());
  // Transfert vers / depuis un autre appareil (src/ai/transfer.ts)
  const [showSend, setShowSend] = useState(false);
  const [pasted, setPasted] = useState('');
  const [pending, setPending] = useState<Omit<AiSettings, 'enabled'> | null>(null);
  const [importPass, setImportPass] = useState('');
  const [copied, setCopied] = useState(false);
  const readTransfer = (text: string) => {
    try {
      setPending(decodeAiTransfer(text));
      setMsg(null);
    } catch {
      setPending(null);
      setMsg({ ok: false, text: t('ai.transferInvalid') });
    }
  };
  useEffect(() => {
    if (incoming) readTransfer(incoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming]);
  const importTransfer = () =>
    run(async () => {
      if (!pending) return;
      let k: string | null = null;
      if (pending.key) {
        try {
          k = await unseal(pending.key, importPass);
        } catch {
          setMsg({ ok: false, text: t('ai.transferBadPass') });
          return;
        }
      }
      update({ ...pending, enabled: true });
      setSessionKey(k);
      setUnlocked(k);
      setPending(null);
      setImportPass('');
      setPasted('');
      setMsg({ ok: true, text: t('ai.transferDone') });
    });

  const update = (patch: Partial<AiSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    saveAiSettings(next);
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ ok: false, text: String((e as Error).message ?? e) });
    } finally {
      setBusy(false);
    }
  };

  const canSave = !busy && !!newKey && pass.length >= 8;
  const canUnlock = !busy && !!s.key && !newKey && !unlocked && !!pass;
  const saveKey = () =>
    run(async () => {
      const sealed = await seal(newKey.trim(), pass);
      update({ key: sealed });
      setSessionKey(newKey.trim());
      setUnlocked(newKey.trim());
      setNewKey('');
      setPass('');
      setMsg({ ok: true, text: t('ai.saved') });
    });
  const unlockKey = () =>
    run(async () => {
      const k = await unseal(s.key!, pass);
      setSessionKey(k);
      setUnlocked(k);
      setPass('');
    });
  /** Entrée dans un champ de la clé : même effet que le bouton affiché (enregistrer ou déverrouiller). */
  const onEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (newKey || !s.key) {
      if (canSave) saveKey();
    } else if (canUnlock) unlockKey();
  };

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" ref={dialogRef} aria-label={t('ai.title')}>
        <h2>{t('ai.title')}</h2>
        <p className="muted small">{t('ai.intro')}</p>

        {pending && (
          <div className="transfer-incoming" role="status">
            <p>
              {t('ai.transferReceived', {
                provider: pending.provider === 'anthropic' ? 'Anthropic (Claude)' : t('ai.provider.openaiCompatible'),
                model: pending.model,
                key: pending.key ? t('ai.transferWithKey') : '',
              })}{' '}
              {t('ai.transferReplace')}
            </p>
            {pending.key && (
              <label className="field">
                <span>{t('ai.transferPass')}</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={importPass}
                  onChange={(e) => setImportPass(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && importPass && importTransfer()}
                />
              </label>
            )}
            <div className="row">
              <button className="primary" disabled={busy || (!!pending.key && !importPass)} onClick={importTransfer}>
                {t('ai.transferImport')}
              </button>
              <button
                onClick={() => {
                  setPending(null);
                  setImportPass('');
                }}
              >
                {t('ai.transferCancel')}
              </button>
            </div>
          </div>
        )}

        <label className="field bool">
          <span>{t('ai.enabled')}</span>
          <input type="checkbox" checked={s.enabled} onChange={(e) => update({ enabled: e.target.checked })} />
        </label>

        <fieldset disabled={!s.enabled}>
          <legend>{t('ai.provider')}</legend>
          <label className="field">
            <span>{t('ai.provider')}</span>
            <select
              value={s.provider}
              onChange={(e) => {
                const provider = e.target.value as ProviderId;
                const p = PROVIDERS[provider];
                update({ provider, model: p.defaultModel || s.model, baseUrl: provider === 'openaiCompatible' ? s.baseUrl || p.defaultBaseUrl : undefined });
              }}
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openaiCompatible">{t('ai.provider.openaiCompatible')}</option>
            </select>
          </label>
          {s.provider === 'openaiCompatible' && (
            <label className="field">
              <span>{t('ai.baseUrl')}</span>
              <input value={s.baseUrl ?? ''} placeholder="http://localhost:11434/v1" onChange={(e) => update({ baseUrl: e.target.value.trim() })} />
            </label>
          )}
          <label className="field">
            <span>{t('ai.model')}</span>
            <input value={s.model} onChange={(e) => update({ model: e.target.value.trim() })} />
          </label>
          <p className="muted small">
            {s.provider === 'openaiCompatible' && isLocalUrl(s.baseUrl) ? t('ai.privacyLocal') : t('ai.privacyRemote', { host: providerHost(s) })}
          </p>
        </fieldset>

        <fieldset disabled={!s.enabled}>
          <legend>{t('ai.key')}</legend>
          <p className="muted small">{t('ai.keyHelp')}</p>
          {s.key && (
            <p className="small">
              {unlocked ? t('ai.keyUnlocked', { key: maskKey(unlocked) }) : t('ai.keyLocked')}
            </p>
          )}
          {!s.key || newKey ? (
            <label className="field">
              <span>{t('ai.keyNew')}</span>
              <input type="password" autoComplete="off" value={newKey} onChange={(e) => setNewKey(e.target.value)} onKeyDown={onEnter} />
            </label>
          ) : null}
          {(!s.key || newKey || !unlocked) && (
            <label className="field">
              <span>{t('ai.passphrase')}</span>
              <input
                type="password"
                autoComplete={s.key && !newKey ? 'current-password' : 'new-password'}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                onKeyDown={onEnter}
              />
            </label>
          )}
          <div className="row">
            {(newKey || !s.key) && (
              <button
                className="primary"
                disabled={!canSave}
                onClick={saveKey}
              >
                {t('ai.saveKey')}
              </button>
            )}
            {s.key && !newKey && !unlocked && (
              <button
                disabled={!canUnlock}
                onClick={unlockKey}
              >
                {t('ai.unlock')}
              </button>
            )}
            {s.key && (
              <button
                className="danger"
                disabled={busy}
                onClick={() => {
                  update({ key: undefined });
                  setSessionKey(null);
                  setUnlocked(null);
                }}
              >
                {t('ai.forget')}
              </button>
            )}
          </div>
          {busy && <p className="muted small">{t('ai.working')}</p>}
          {msg && <p className={'small ' + (msg.ok ? 'ok-text' : 'error-text')}>{msg.text}</p>}
        </fieldset>

        <fieldset disabled={!s.enabled}>
          <legend>{t('ai.permissions')}</legend>
          {PERMS.map((p) => (
            <label key={p} className="field bool">
              <span>{t('ai.perm.' + p)}</span>
              <input type="checkbox" checked={s.permissions[p]} onChange={(e) => update({ permissions: { ...s.permissions, [p]: e.target.checked } })} />
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>{t('ai.transfer')}</legend>
          <p className="muted small">{t('ai.transferHelp')}</p>
          {/* Deux façons d'envoyer : QR code (appareil photo du téléphone) ou lien copié (sans caméra : vers
              l'application de bureau du même ordinateur, ou par message / courriel à soi-même) */}
          <div className="row">
            <button onClick={() => setShowSend((v) => !v)} aria-expanded={showSend}>
              {t(showSend ? 'ai.transferHide' : 'ai.transferSend')}
            </button>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(aiTransferLink(s));
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {t('ai.transferCopy')}
            </button>
            {copied && <span className="small ok-text">{t('ai.transferCopied')}</span>}
          </div>
          <p className="muted small">{t('ai.transferNoCamera')}</p>
          {showSend && (
            <div className="transfer-send">
              <QrCode text={aiTransferLink(s)} label={t('ai.transferSend')} />
              <p className="muted small">{t('ai.transferScan')}</p>
            </div>
          )}
          <label className="field">
            <span>{t('ai.transferPaste')}</span>
            <input value={pasted} onChange={(e) => setPasted(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && pasted.trim() && readTransfer(pasted)} />
          </label>
          <div className="row">
            <button disabled={!pasted.trim()} onClick={() => readTransfer(pasted)}>
              {t('ai.transferRead')}
            </button>
          </div>
          <p className="muted small">{t('ai.transferIos')}</p>
        </fieldset>

        <div className="row end">
          <button onClick={onClose}>{t('ai.close')}</button>
        </div>
      </div>
    </div>
  );
}

/** Service qui reçoit les données (affiché avant tout envoi). */
function providerHost(s: { provider: ProviderId; baseUrl?: string }): string {
  if (s.provider === 'anthropic') return 'api.anthropic.com (Anthropic)';
  try {
    return new URL(s.baseUrl || '').host;
  } catch {
    return s.baseUrl || '?';
  }
}
