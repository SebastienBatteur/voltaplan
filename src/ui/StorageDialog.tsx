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
import { isConflict } from '../io/conflict';
import { useOnline } from './UpdateBanner';
import { formatBytes, needsInstallAdvice, requestPersistence, storageInfo, type StorageInfo } from '../io/persist';
import { CLOUDS, PROVIDERS, clientId, cloudForget, cloudList, cloudLoad, cloudSave, cloudToken, redirectUri, setClientId, withToken, type CloudFile, type CloudId } from '../io/cloud';
import { openProjectData } from '../io/projectData';

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
  const online = useOnline();
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
              {mode === 'save' && (
                <button
                  title={t('format.exportV1Help')}
                  onClick={() =>
                    run(async () => {
                      const { exportProjectV1 } = await import('../io/files');
                      const r = await exportProjectV1(project, name);
                      if (r.losses.length) window.alert(t('format.exportV1Losses') + '\n\n' + r.losses.map((l) => '• ' + t('format.loss.' + l.kind, { label: l.label })).join('\n'));
                    })
                  }
                >
                  {t('format.exportV1')}
                </button>
              )}
              {mode === 'save' && 'showDirectoryPicker' in window && (
                <button
                  title={t('format.exportFolderHelp')}
                  onClick={() =>
                    run(async () => {
                      const { exportToDirectory } = await import('../io/directoryBackend');
                      const r = await exportToDirectory(project, name, (f) => window.confirm(t('storage.overwrite', { name: f })));
                      if (r) window.alert(t('format.exportFolderDone', { n: r.files, folder: r.folder }));
                    })
                  }
                >
                  {t('format.exportFolder')}
                </button>
              )}
            </div>
            {mode === 'save' && <p className="muted small">{t('storage.trikHelp')}</p>}
          </div>
        )}

        {tab === 'browser' && (
          <div>
            <p className="muted small">{t('storage.browserHelp')}</p>
            <BrowserSpace />
            {mode === 'save' && (
              <button
                className="primary"
                disabled={busy || !name.trim()}
                onClick={() =>
                  run(async () => {
                    const existing = items.find((i) => i.name === name.trim());
                    const id = existing?.id ?? uid();
                    if (existing && !confirm(t('storage.overwrite', { name: name.trim() }))) return;
                    const rev = await browserSave(id, name.trim(), project, 'any');
                    void requestPersistence();
                    onSaved(name.trim(), { kind: 'browser', id, rev });
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
                            onOpened(parseProject(e.data, i.name), i.name, { kind: 'browser', id: i.id, rev: e.rev ?? 0 });
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

        {(tab === 'github' || tab === 'cloud') && !online && <p className="small warning-text">{t('app.needsNetwork')}</p>}
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
                        // Jamais de remplacement implicite : création, puis confirmation si le fichier existe déjà
                        let sha: string | undefined;
                        try {
                          sha = await githubSave(unlocked, gh, path, project, 'create');
                        } catch (e) {
                          if (!isConflict(e)) throw e;
                          if (!confirm(t('storage.overwrite', { name: name.trim() }))) return;
                          sha = await githubSave(unlocked, gh, path, project, 'overwrite');
                        }
                        onSaved(name.trim(), { kind: 'github', repo: gh.repo, branch: gh.branch, path, sha });
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
                          const { data, sha } = await githubLoad(unlocked!, gh, f.path);
                          onOpened((await openProjectData(data, f.name)).project, f.name, { kind: 'github', repo: gh.repo, branch: gh.branch, path: f.path, sha });
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

/**
 * Onglet « Navigateur » : place utilisée, protection contre l'effacement automatique (src/io/persist.ts),
 * conseil pour Safari / iPhone / iPad. Rien n'est affiché de ce que le navigateur ne dit pas.
 */
function BrowserSpace() {
  const t = useStore((s) => s.t);
  const lang = useStore((s) => s.lang);
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    let alive = true;
    void storageInfo().then((i) => alive && setInfo(i));
    return () => {
      alive = false;
    };
  }, []);
  if (!info) return null;
  const advice = needsInstallAdvice();
  return (
    <div className="muted small">
      {info.usage !== null && (
        <p>
          {info.quota
            ? t('storage.spaceQuota', { used: formatBytes(info.usage, lang), quota: formatBytes(info.quota, lang) })
            : t('storage.spaceUsed', { used: formatBytes(info.usage, lang) })}
        </p>
      )}
      {info.persisted !== null && (
        <p>
          {t(info.persisted ? 'storage.persistOn' : 'storage.persistOff')}{' '}
          {!info.persisted && (
            <button
              className="small-btn"
              onClick={async () => {
                const ok = await requestPersistence(true);
                setDenied(ok !== true);
                setInfo(await storageInfo());
              }}
            >
              {t('storage.persistAsk')}
            </button>
          )}
        </p>
      )}
      {denied && !advice && <p>{t('storage.persistDenied')}</p>}
      {advice && <p>{t('storage.installAdvice')}</p>}
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
  const [folders, setFolders] = useState<string[] | null>(null);
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
              setFolders(null);
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
                // Remplacement confirmé ci-dessus, sinon création (refusée si un fichier du même nom apparaît entre-temps)
                const f = await cloudSave(svc, fileName, project, existing ? 'overwrite' : 'create', existing);
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
        {svc === 'onedrive' && (
          <button
            title={t('format.saveAsFolderHelp')}
            disabled={busy || !cid || (mode === 'save' && !name.trim())}
            onClick={() =>
              run(async () => {
                // Format v2, dossier de projet (F8) : documents envoyés une fois, modèle seul ensuite
                setClientId(svc, cid);
                const { listOneDriveFolders, safeFolderName } = await import('../io/oneDriveFolder');
                const list = await withToken('onedrive', (tk) => listOneDriveFolders(tk));
                if (mode === 'open') return setFolders(list.map((f) => f.name));
                const folder = safeFolderName(name.trim());
                const exists = list.some((f) => f.name === folder);
                if (exists && !confirm(t('storage.overwrite', { name: folder }))) return;
                const { folderSave } = await import('../io/cloudFolder');
                const loc = { kind: 'folder', provider: 'onedrive', folder, modelPath: 'project.json' } as const;
                const r = await folderSave(loc, project, exists ? 'overwrite' : 'create');
                onSaved(name.trim(), { ...loc, rev: r.rev });
                onClose();
              })
            }
          >
            {t(mode === 'open' ? 'format.folders' : 'format.saveAsFolder')}
          </button>
        )}
        {cloudToken(svc) && (
          <button
            onClick={() => {
              cloudForget(svc);
              setFiles(null);
              setFolders(null);
            }}
          >
            {t('cloud.disconnect')}
          </button>
        )}
      </div>
      {mode === 'open' && svc === 'onedrive' && folders && (
        <ul className="storage-list">
          {folders.length === 0 && <li className="muted">{t('storage.empty')}</li>}
          {folders.map((folder) => (
            <li key={folder}>
              <button
                className="link"
                onClick={() =>
                  run(async () => {
                    const { folderOpen } = await import('../io/cloudFolder');
                    const loc = { kind: 'folder', provider: 'onedrive', folder, modelPath: 'project.json' } as const;
                    const r = await folderOpen(loc);
                    onOpened(r.project, folder, { ...loc, rev: r.rev });
                    onClose();
                  })
                }
              >
                {folder}/
              </button>
            </li>
          ))}
        </ul>
      )}
      {mode === 'open' && files && (
        <ul className="storage-list">
          {files.length === 0 && <li className="muted">{t('storage.empty')}</li>}
          {files.map((f) => (
            <li key={f.id}>
              <button
                className="link"
                onClick={() =>
                  run(async () => {
                    const { data, rev } = await cloudLoad(svc, f);
                    onOpened((await openProjectData(data, f.name)).project, f.name, { kind: 'cloud', provider: svc, file: { ...f, rev: rev ?? f.rev } });
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
