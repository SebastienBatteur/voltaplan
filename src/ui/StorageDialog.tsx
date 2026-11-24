import { errorText } from './errors';
import { useEffect, useRef, useState } from 'react';
import { enterClicks } from './enterClicks';
import { useStore } from '../store';
import {
  browserDelete,
  browserList,
  browserLoad,
  browserSave,
  getGithubToken,
  githubList,
  githubLoad,
  githubSave,
  loadGithubSettings,
  parseProject,
  safeName,
  saveGithubSettings,
  setGithubToken,
  type BrowserEntry,
  type GithubSettings,
  type Location,
} from '../io/storage';
import { seal, unseal } from '../ai/secureStore';
import { uid } from '../model/tree';
import { FILE_EXT } from '../brand';
import type { Project } from '../model/types';
import { download } from '../io/files';
import { CLOUDS, PROVIDERS, clientId, cloudForget, cloudList, cloudLoad, cloudSave, cloudToken, redirectUri, setClientId, type CloudFile, type CloudId } from '../io/cloud';

type Tab = 'device' | 'browser' | 'github' | 'cloud';

/**
 * Ouvrir / enregistrer, au choix : cet appareil, le navigateur, GitHub (et, plus tard, les services en ligne).
 * `onOpened(project, name, location)` et `onSaved(name, location)` informent l'application.
 */
export function StorageDialog({
  mode,
  onClose,
  onDevice,
  onOpened,
  onSaved,
}: {
  mode: 'open' | 'save';
  onClose: () => void;
  onDevice: () => void;
  onOpened: (p: Project, name: string, loc: Location) => void;
  onSaved: (name: string, loc: Location) => void;
}) {
  const t = useStore((s) => s.t);
  const project = useStore((s) => s.project);
  const fileName = useStore((s) => s.fileName);
  const lang = useStore((s) => s.lang);
  const [tab, setTab] = useState<Tab>('browser');
  const [name, setName] = useState(safeName((fileName || project.meta.title || 'projet').replace(/\.[^.]*$/, '')));
  const [items, setItems] = useState<Omit<BrowserEntry, 'data'>[]>([]);
  const [gh, setGh] = useState<GithubSettings>(loadGithubSettings);
  const [ghToken, setGhTokenInput] = useState('');
  const [pass, setPass] = useState('');
  const [ghFiles, setGhFiles] = useState<{ name: string; path: string; size: number }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const unlocked = getGithubToken();
  /** Bouton « Déverrouiller » / « Enregistrer la clé » du jeton : Entrée dans ses champs a le même effet. */
  const tokenBtn = useRef<HTMLButtonElement>(null);

  const refresh = () => browserList().then(setItems).catch((e) => setMsg(String(e)));
  useEffect(() => {
    void refresh();
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(errorText(e, t));
    } finally {
      setBusy(false);
    }
  };

  const updateGh = (patch: Partial<GithubSettings>) => {
    const next = { ...gh, ...patch };
    setGh(next);
    saveGithubSettings(next);
  };

  const ghPath = (n: string) => [gh.folder.replace(/^\/|\/$/g, ''), safeName(n) + FILE_EXT].filter(Boolean).join('/');

  const tabs: Tab[] = ['device', 'browser', 'github', 'cloud'];
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={t(mode === 'open' ? 'storage.openTitle' : 'storage.saveTitle')}>
        <h2>{t(mode === 'open' ? 'storage.openTitle' : 'storage.saveTitle')}</h2>
        <div className="tabs-row">
          {tabs.map((k) => (
            <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
              {t('storage.tab.' + k)}
            </button>
          ))}
        </div>

        {mode === 'save' && tab !== 'device' && (
          <label className="field">
            <span>{t('storage.name')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}

        {tab === 'device' && (
          <div>
            <p className="muted small">{t('storage.deviceHelp')}</p>
            <div className="row">
              <button
                className="primary"
                onClick={() => {
                  onClose();
                  onDevice();
                }}
              >
                {t(mode === 'open' ? 'storage.pickFile' : 'storage.saveFile')}
              </button>
              {mode === 'save' && (
                <button
                  title={t('storage.trikHelp')}
                  onClick={() =>
                    run(async () => {
                      const { exportTrikkerXml, toWindows1252 } = await import('../export/trikker');
                      const bytes = toWindows1252(exportTrikkerXml(project, lang));
                      await download(new Blob([bytes], { type: 'application/xml' }), safeName(name) + '.trik');
                    })
                  }
                >
                  {t('storage.exportTrik')}
                </button>
              )}
              {mode === 'save' && (
                <button
                  title={t('storage.edsHelp')}
                  onClick={() =>
                    run(async () => {
                      const { exportEendraadschema } = await import('../export/eendraadschema');
                      const file = safeName(name) + '.eds';
                      await download(new Blob([exportEendraadschema(project, file)], { type: 'application/eds' }), file);
                    })
                  }
                >
                  {t('storage.exportEds')}
                </button>
              )}
            </div>
            {mode === 'save' && <p className="muted small">{t('storage.trikHelp')}</p>}
          </div>
        )}

        {tab === 'browser' && (
          <div>
            <p className="muted small">{t('storage.browserHelp')}</p>
            {mode === 'save' && (
              <button
                className="primary"
                disabled={busy || !name.trim()}
                onClick={() =>
                  run(async () => {
                    const existing = items.find((i) => i.name === name.trim());
                    const id = existing?.id ?? uid();
                    if (existing && !confirm(t('storage.overwrite', { name: name.trim() }))) return;
                    await browserSave(id, name.trim(), project);
                    onSaved(name.trim(), { kind: 'browser', id });
                    onClose();
                  })
                }
              >
                {t('storage.saveHere')}
              </button>
            )}
            <ul className="storage-list">
              {items.length === 0 && <li className="muted">{t('storage.empty')}</li>}
              {items.map((i) => (
                <li key={i.id}>
                  <button
                    className="link"
                    onClick={() =>
                      mode === 'open'
                        ? run(async () => {
                            const e = await browserLoad(i.id);
                            if (!e) return;
                            onOpened(parseProject(e.data, i.name), i.name, { kind: 'browser', id: i.id });
                            onClose();
                          })
                        : setName(i.name)
                    }
                  >
                    {i.name}
                  </button>
                  <span className="muted small">
                    {new Date(i.updated).toLocaleString()} — {Math.round(i.size / 1024)} ko
                  </span>
                  <button
                    className="danger small-btn"
                    onClick={() =>
                      confirm(t('storage.deleteConfirm', { name: i.name })) &&
                      run(async () => {
                        await browserDelete(i.id);
                        await refresh();
                      })
                    }
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'github' && (
          <div>
            <p className="muted small">{t('storage.githubHelp')}</p>
            <label className="field">
              <span>{t('storage.repo')}</span>
              <input value={gh.repo} placeholder="utilisateur/dossiers-electriques" onChange={(e) => updateGh({ repo: e.target.value.trim() })} />
            </label>
            <label className="field">
              <span>{t('storage.branch')}</span>
              <input value={gh.branch} onChange={(e) => updateGh({ branch: e.target.value.trim() })} />
            </label>
            <label className="field">
              <span>{t('storage.folder')}</span>
              <input value={gh.folder} onChange={(e) => updateGh({ folder: e.target.value.trim() })} />
            </label>
            {!unlocked && (
              <>
                {!gh.token && (
                  <label className="field">
                    <span>{t('storage.token')}</span>
                    <input type="password" autoComplete="off" value={ghToken} onChange={(e) => setGhTokenInput(e.target.value)} onKeyDown={enterClicks(tokenBtn)} />
                  </label>
                )}
                <label className="field">
                  <span>{t('ai.passphrase')}</span>
                  <input
                    type="password"
                    autoComplete={gh.token ? 'current-password' : 'new-password'}
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    onKeyDown={enterClicks(tokenBtn)}
                  />
                </label>
                <button
                  ref={tokenBtn}
                  disabled={busy || pass.length < 8 || (!gh.token && !ghToken)}
                  onClick={() =>
                    run(async () => {
                      if (gh.token) setGithubToken(await unseal(gh.token, pass));
                      else {
                        updateGh({ token: await seal(ghToken.trim(), pass) });
                        setGithubToken(ghToken.trim());
                      }
                      setPass('');
                      setGhTokenInput('');
                      setMsg(t('storage.tokenReady'));
                    })
                  }
                >
                  {gh.token ? t('ai.unlock') : t('ai.saveKey')}
                </button>
              </>
            )}
            {unlocked && (
              <div className="row">
                {mode === 'save' ? (
                  <button
                    className="primary"
                    disabled={busy || !gh.repo || !name.trim()}
                    onClick={() =>
                      run(async () => {
                        const path = ghPath(name);
                        await githubSave(unlocked, gh, path, project);
                        onSaved(name.trim(), { kind: 'github', repo: gh.repo, branch: gh.branch, path });
                        onClose();
                      })
                    }
                  >
                    {t('storage.saveHere')}
                  </button>
                ) : (
                  <button disabled={busy || !gh.repo} onClick={() => run(async () => setGhFiles(await githubList(unlocked, gh)))}>
                    {t('storage.list')}
                  </button>
                )}
                <button
                  className="danger"
                  onClick={() => {
                    setGithubToken(null);
                    updateGh({ token: undefined });
                  }}
                >
                  {t('ai.forget')}
                </button>
              </div>
            )}
            {mode === 'open' && ghFiles && (
              <ul className="storage-list">
                {ghFiles.length === 0 && <li className="muted">{t('storage.empty')}</li>}
                {ghFiles.map((f) => (
                  <li key={f.path}>
                    <button
                      className="link"
                      onClick={() =>
                        run(async () => {
                          const text = await githubLoad(unlocked!, gh, f.path);
                          onOpened(parseProject(text, f.name), f.name, { kind: 'github', repo: gh.repo, branch: gh.branch, path: f.path });
                          onClose();
                        })
                      }
                    >
                      {f.name}
                    </button>
                    <span className="muted small">{Math.round(f.size / 1024)} ko</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'cloud' && <CloudTab mode={mode} name={name} onOpened={onOpened} onSaved={onSaved} onClose={onClose} />}

        {busy && <p className="muted small">…</p>}
        {msg && <p className="small error-text">{msg}</p>}
        <div className="row end">
          <button onClick={onClose}>{t('ai.close')}</button>
        </div>
      </div>
    </div>
  );
}

/** Google Drive, OneDrive, Dropbox : identifiant d'application (une fois), connexion, liste, ouvrir, enregistrer. */
function CloudTab({
  mode,
  name,
  onOpened,
  onSaved,
  onClose,
}: {
  mode: 'open' | 'save';
  name: string;
  onOpened: (p: Project, name: string, loc: Location) => void;
  onSaved: (name: string, loc: Location) => void;
  onClose: () => void;
}) {
  const t = useStore((s) => s.t);
  const project = useStore((s) => s.project);
  const [svc, setSvc] = useState<CloudId>('onedrive');
  const [cid, setCid] = useState(clientId('onedrive'));
  const [files, setFiles] = useState<CloudFile[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      const m = (e as Error).message;
      setMsg(m === 'client-id' ? t('cloud.needClientId') : m === 'popup' ? t('cloud.popupBlocked') : m === 'cancelled' ? t('cloud.cancelled') : errorText(e, t));
    } finally {
      setBusy(false);
    }
  };
  const fileName = safeName(name) + FILE_EXT;
  return (
    <div>
      <div className="tabs-row">
        {CLOUDS.map((c) => (
          <button
            key={c}
            className={svc === c ? 'active' : ''}
            onClick={() => {
              setSvc(c);
              setCid(clientId(c));
              setFiles(null);
              setMsg(null);
            }}
          >
            {PROVIDERS[c].label}
          </button>
        ))}
      </div>
      <p className="muted small">{t('cloud.help', { service: PROVIDERS[svc].label })}</p>
      <label className="field">
        <span>{t('cloud.clientId')}</span>
        <input value={cid} placeholder="…" onChange={(e) => setCid(e.target.value)} onBlur={() => setClientId(svc, cid)} />
      </label>
      <p className="muted small">
        {t('cloud.redirect')} <code>{redirectUri()}</code>
      </p>
      <div className="row">
        {mode === 'save' ? (
          <button
            className="primary"
            disabled={busy || !cid || !name.trim()}
            onClick={() =>
              run(async () => {
                setClientId(svc, cid);
                const existing = (await cloudList(svc)).find((f) => f.name === fileName);
                if (existing && !confirm(t('storage.overwrite', { name: fileName }))) return;
                const f = await cloudSave(svc, fileName, project, existing);
                onSaved(name.trim(), { kind: 'cloud', provider: svc, file: f });
                onClose();
              })
            }
          >
            {t('storage.saveHere')}
          </button>
        ) : (
          <button
            className="primary"
            disabled={busy || !cid}
            onClick={() =>
              run(async () => {
                setClientId(svc, cid);
                setFiles(await cloudList(svc));
              })
            }
          >
            {t('storage.list')}
          </button>
        )}
        {cloudToken(svc) && (
          <button
            onClick={() => {
              cloudForget(svc);
              setFiles(null);
            }}
          >
            {t('cloud.disconnect')}
          </button>
        )}
      </div>
      {mode === 'open' && files && (
        <ul className="storage-list">
          {files.length === 0 && <li className="muted">{t('storage.empty')}</li>}
          {files.map((f) => (
            <li key={f.id}>
              <button
                className="link"
                onClick={() =>
                  run(async () => {
                    const text = await cloudLoad(svc, f);
                    onOpened(parseProject(text, f.name), f.name, { kind: 'cloud', provider: svc, file: f });
                    onClose();
                  })
                }
              >
                {f.name}
              </button>
              <span className="muted small">{f.modified ? new Date(f.modified).toLocaleString() : ''}</span>
            </li>
          ))}
        </ul>
      )}
      {busy && <p className="muted small">…</p>}
      {msg && <p className="small error-text">{msg}</p>}
    </div>
  );
}
