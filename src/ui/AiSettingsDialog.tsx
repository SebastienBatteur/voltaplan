import { useState } from 'react';
import { useStore } from '../store';
import { loadAiSettings, saveAiSettings, getSessionKey, setSessionKey, type AiPermissions, type AiSettings } from '../ai/settings';
import { maskKey, seal, unseal } from '../ai/secureStore';

const PERMS: (keyof AiPermissions)[] = ['planFromPhoto', 'boardFromPhoto', 'unifilarFromDocument', 'fixSuggestions'];

/**
 * Réglages de l'IA optionnelle : fournisseur, modèle, clé d'API chiffrée localement, et ce que l'IA a le droit de générer.
 */
export function AiSettingsDialog({ onClose }: { onClose: () => void }) {
  const t = useStore((s) => s.t);
  const [s, setS] = useState<AiSettings>(loadAiSettings);
  const [newKey, setNewKey] = useState('');
  const [pass, setPass] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [unlocked, setUnlocked] = useState(getSessionKey());

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

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={t('ai.title')}>
        <h2>{t('ai.title')}</h2>
        <p className="muted small">{t('ai.intro')}</p>

        <label className="field bool">
          <span>{t('ai.enabled')}</span>
          <input type="checkbox" checked={s.enabled} onChange={(e) => update({ enabled: e.target.checked })} />
        </label>

        <fieldset disabled={!s.enabled}>
          <legend>{t('ai.provider')}</legend>
          <label className="field">
            <span>{t('ai.provider')}</span>
            <select value={s.provider} onChange={() => update({ provider: 'anthropic' })}>
              <option value="anthropic">Anthropic (Claude)</option>
            </select>
          </label>
          <label className="field">
            <span>{t('ai.model')}</span>
            <input value={s.model} onChange={(e) => update({ model: e.target.value.trim() })} />
          </label>
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
              <input type="password" autoComplete="off" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
            </label>
          ) : null}
          {(!s.key || newKey || !unlocked) && (
            <label className="field">
              <span>{t('ai.passphrase')}</span>
              <input type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} />
            </label>
          )}
          <div className="row">
            {(newKey || !s.key) && (
              <button
                className="primary"
                disabled={busy || !newKey || pass.length < 8}
                onClick={() =>
                  run(async () => {
                    const sealed = await seal(newKey.trim(), pass);
                    update({ key: sealed });
                    setSessionKey(newKey.trim());
                    setUnlocked(newKey.trim());
                    setNewKey('');
                    setPass('');
                    setMsg({ ok: true, text: t('ai.saved') });
                  })
                }
              >
                {t('ai.saveKey')}
              </button>
            )}
            {s.key && !newKey && !unlocked && (
              <button
                disabled={busy || !pass}
                onClick={() =>
                  run(async () => {
                    const k = await unseal(s.key!, pass);
                    setSessionKey(k);
                    setUnlocked(k);
                    setPass('');
                  })
                }
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

        <div className="row end">
          <button onClick={onClose}>{t('ai.close')}</button>
        </div>
      </div>
    </div>
  );
}
