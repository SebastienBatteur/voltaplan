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
import { isAuthError, isConflict } from '../io/conflict';
import { useOnline } from './UpdateBanner';
import { formatBytes, needsInstallAdvice, requestPersistence, storageInfo, type StorageInfo } from '../io/persist';
import {
  CLOUDS,
  DRIVE_INSTALL_SCOPE,
  PROVIDERS,
  clientId,
  cloudConnect,
  cloudForget,
  cloudList,
  cloudLoad,
  cloudSave,
  cloudToken,
  redirectUri,
  setClientId,
  withToken,
  type CloudFile,
  type CloudId,
} from '../io/cloud';
import { openProjectData } from '../io/projectData';
import { MIMETYPE } from '../format/manifest';
import type { ProjectFolder } from '../io/cloudFolder';
import type { DriveIntent } from '../io/driveOpenWith';
import { useModalDialog } from './a11y';

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
  const dialogRef = useModalDialog(onClose);
  const t = useStore((s) => s.t);
  const online = useOnline();
  const project = useStore((s) => s.project);
  const fileName = useStore((s) => s.fileName);
  const lang = useStore((s) => s.lang);
  // « Cet appareil » d'abord (audit visuel du 2026-11-25) : le stockage du navigateur peut être effacé avec les
  // données du site ; il reste proposé, avec GitHub, sous « Autres emplacements ».
  const [tab, setTab] = useState<Tab>('device');
  const [moreTabs, setMoreTabs] = useState(false);
  const [name, setName] = useState(safeName((fileName || project.meta.title || 'projet').replace(/\.[^.]*$/, '')));
  const [items, setItems] = useState<Omit<BrowserEntry, 'data'>[]>([]);
  const [gh, setGh] = useState<GithubSettings>(loadGithubSettings);
  const [ghToken, setGhTokenInput] = useState('');
  const [pass, setPass] = useState('');
  const [ghFiles, setGhFiles] = useState<{ name: string; path: string; size: number }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  /** Message de réussite (en vert, pas en rouge comme les erreurs). */
  const [note, setNote] = useState<string | null>(null);
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
    setNote(null);
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

  const showMore = moreTabs || tab === 'browser' || tab === 'github';
  const tabs: Tab[] = showMore ? ['device', 'cloud', 'browser', 'github'] : ['device', 'cloud'];
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" ref={dialogRef} aria-label={t(mode === 'open' ? 'storage.openTitle' : 'storage.saveTitle')}>
        <h2>{t(mode === 'open' ? 'storage.openTitle' : 'storage.saveTitle')}</h2>
        <div className="tabs-row">
          {tabs.map((k) => (
            <button key={k} className={tab === k ? 'active' : ''} aria-pressed={tab === k} onClick={() => setTab(k)}>
              {t('storage.tab.' + k)}
            </button>
          ))}
          {!showMore && (
            <button className="link-button" aria-expanded={false} onClick={() => setMoreTabs(true)}>
              {t('storage.moreTabs')} ▸
            </button>
          )}
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
                      const done = await download(new Blob([bytes], { type: 'application/xml' }), safeName(name) + '.trik');
                      if (done) setNote(t('storage.exported', { name: done }));
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
                      const done = await download(new Blob([exportEendraadschema(project, file)], { type: 'application/eds' }), file);
                      if (done) setNote(t('storage.exported', { name: done }));
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
                      if (!r.name) return;
                      setNote(t('storage.exported', { name: r.name }));
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
                      setNote(t('storage.tokenReady'));
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
        {note && <p className="small ok-text">{note}</p>}
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

/** Message d'une erreur de connexion ou de service (identifiant manquant, fenêtre bloquée, annulation…). */
function cloudErrorText(e: unknown, t: (k: string, p?: Record<string, string | number>) => string): string {
  const m = (e as Error).message;
  if ((e as Error).name === 'DriveOpenError') return t('driveOpen.error.' + (e as { code: string }).code);
  // Dans cette fenêtre, une connexion impossible se règle par un nouveau clic sur le bouton (pas « Enregistrer »)
  if (isAuthError(e)) return t('cloud.needsLogin', { where: e.where });
  return m === 'client-id' ? t('cloud.needClientId') : m === 'popup' ? t('cloud.popupBlocked') : m === 'cancelled' ? t('cloud.cancelled') : errorText(e, t);
}

/**
 * Google Drive, OneDrive, Dropbox : identifiant d'application (une fois), connexion, liste, ouvrir, enregistrer.
 * Deux formes au choix, pour chaque service : dossier de projet (documents envoyés une fois, modèle seul renvoyé)
 * ou fichier unique `.voltaplan` (archive complète renvoyée à chaque enregistrement).
 */
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
  const [form, setForm] = useState<'folder' | 'file'>('folder');
  const [files, setFiles] = useState<CloudFile[] | null>(null);
  const [folders, setFolders] = useState<ProjectFolder[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    setNote(null);
    try {
      await fn();
    } catch (e) {
      setMsg(cloudErrorText(e, t));
    } finally {
      setBusy(false);
    }
  };
  const fileName = safeName(name) + FILE_EXT;
  const label = PROVIDERS[svc].label;

  const saveFile = () =>
    run(async () => {
      setClientId(svc, cid);
      const existing = (await cloudList(svc)).find((f) => f.name === fileName);
      if (existing && !confirm(t('storage.overwrite', { name: fileName }))) return;
      // Remplacement confirmé ci-dessus, sinon création (refusée si un fichier du même nom apparaît entre-temps)
      const f = await cloudSave(svc, fileName, project, existing ? 'overwrite' : 'create', existing);
      onSaved(name.trim(), { kind: 'cloud', provider: svc, file: f });
      onClose();
    });

  const saveFolder = () =>
    run(async () => {
      // Format v2, dossier de projet (F8) : documents envoyés une fois, modèle seul ensuite. Un projet ouvert depuis
      // un autre service y est transféré (documents lus à leur source, vérifiés, envoyés s'ils manquent).
      setClientId(svc, cid);
      const { folderSave, listProjectFolders, prepareProjectFolder } = await import('../io/cloudFolder');
      const { safeFolderName } = await import('../io/oneDriveFolder');
      const list = await listProjectFolders(svc);
      const exists = list.some((f) => f.name === safeFolderName(name.trim()));
      if (exists && !confirm(t('storage.overwrite', { name: safeFolderName(name.trim()) }))) return;
      const { loc } = await prepareProjectFolder(svc, name.trim(), { existing: list });
      const r = await folderSave(loc, project, exists ? 'overwrite' : 'create');
      onSaved(name.trim(), { ...loc, rev: r.rev });
      onClose();
    });

  const importArchive = () =>
    run(async () => {
      setClientId(svc, cid);
      const { pickFile } = await import('../io/files');
      const file = await pickFile([FILE_EXT, MIMETYPE].join(','));
      if (!file) return;
      const { folderOpen, importArchiveToCloudFolder } = await import('../io/cloudFolder');
      const title = file.name.replace(/\.[^.]*$/, '');
      const loc = await importArchiveToCloudFolder(file, svc, title);
      const r = await folderOpen(loc);
      onOpened(r.project, loc.folder, { ...loc, rev: r.rev });
      onClose();
    });

  return (
    <div>
      <div className="tabs-row">
        {CLOUDS.map((c) => (
          <button
            key={c}
            className={svc === c ? 'active' : ''}
            aria-pressed={svc === c}
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
      <p className="muted small">{t('cloud.help', { service: label })}</p>
      <label className="field">
        <span>{t('cloud.clientId')}</span>
        <input value={cid} placeholder="…" onChange={(e) => setCid(e.target.value)} onBlur={() => setClientId(svc, cid)} />
      </label>
      <p className="muted small">
        {t('cloud.redirect')} <code>{redirectUri()}</code>
      </p>
      <fieldset className="cloud-form">
        <legend>{t('cloudFolder.formTitle')}</legend>
        <label>
          <input type="radio" name="cloud-form" checked={form === 'folder'} onChange={() => setForm('folder')} /> <strong>{t('cloudFolder.folder')}</strong>
          <span className="muted small"> — {t('cloudFolder.folderHelp')}</span>
        </label>
        <label>
          <input type="radio" name="cloud-form" checked={form === 'file'} onChange={() => setForm('file')} /> <strong>{t('cloudFolder.file')}</strong>
          <span className="muted small"> — {t('cloudFolder.fileHelp')}</span>
        </label>
      </fieldset>
      <div className="row">
        {mode === 'save' ? (
          <button className="primary" disabled={busy || !cid || !name.trim()} title={form === 'folder' ? t('format.saveAsFolderHelp') : undefined} onClick={form === 'folder' ? saveFolder : saveFile}>
            {t(form === 'folder' ? 'format.saveAsFolder' : 'storage.saveHere')}
          </button>
        ) : (
          <button
            className="primary"
            disabled={busy || !cid}
            onClick={() =>
              run(async () => {
                setClientId(svc, cid);
                if (form === 'file') {
                  setFolders(null);
                  setFiles(await cloudList(svc));
                } else {
                  setFiles(null);
                  setFolders(await (await import('../io/cloudFolder')).listProjectFolders(svc));
                }
              })
            }
          >
            {t(form === 'folder' ? 'format.folders' : 'storage.list')}
          </button>
        )}
        {form === 'folder' && (
          <button title={t('cloudFolder.importHelp')} disabled={busy || !cid} onClick={importArchive}>
            {t('cloudFolder.import')}
          </button>
        )}
        {svc === 'gdrive' && (
          <button
            title={t('driveOpen.installHelp')}
            disabled={busy || !cid}
            onClick={() =>
              run(async () => {
                setClientId(svc, cid);
                // Portée drive.install demandée pour cette connexion seulement : Voltaplan apparaît dans « Ouvrir avec »
                await cloudConnect('gdrive', { extraScope: DRIVE_INSTALL_SCOPE });
                setNote(t('driveOpen.installDone'));
              })
            }
          >
            {t('driveOpen.install')}
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
      {mode === 'open' && folders && (
        <ul className="storage-list">
          {folders.length === 0 && <li className="muted">{t('storage.empty')}</li>}
          {folders.map((f) => (
            <li key={f.id ?? f.name}>
              <button
                className="link"
                onClick={() =>
                  run(async () => {
                    const { folderOpen } = await import('../io/cloudFolder');
                    const loc = { kind: 'folder', provider: svc, folder: f.name, folderId: f.id, modelPath: 'project.json' } as const;
                    const r = await folderOpen(loc);
                    onOpened(r.project, f.name, { ...loc, rev: r.rev });
                    onClose();
                  })
                }
              >
                {f.name}/
              </button>
              <span className="muted small">{f.modified ? new Date(f.modified).toLocaleString() : ''}</span>
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
      {note && <p className="small ok-text">{note}</p>}
    </div>
  );
}

/**
 * « Ouvrir avec Voltaplan » / « Nouveau → Voltaplan » depuis Google Drive (src/io/driveOpenWith.ts) : rien n'est
 * lu avant le clic de l'utilisateur, qui autorise aussi la fenêtre de connexion (compte suggéré : celui de Drive).
 * Le fichier ouvert garde son identifiant et sa version (enregistrement prudent au même endroit) ; un fichier en
 * lecture seule ou converti (v1) est enregistré dans un NOUVEAU fichier, jamais par-dessus l'original.
 */
export function DriveOpenPrompt({
  intent,
  confirmDiscard,
  onOpened,
  onCreate,
  onClose,
}: {
  intent: DriveIntent;
  confirmDiscard: () => boolean;
  onOpened: (p: Project, name: string, loc: Location, notes: string[]) => void;
  onCreate: (loc: Location) => void;
  onClose: () => void;
}) {
  const t = useStore((s) => s.t);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const others = intent.action === 'open' ? intent.ids.length - 1 : 0;

  const go = async () => {
    if (!confirmDiscard()) return;
    setBusy(true);
    setMsg(null);
    try {
      const { runDriveIntent } = await import('../io/driveOpenWith');
      const r = await runDriveIntent(intent, {
        // Fenêtre de connexion ouverte par ce clic ; compte suggéré : celui qui a choisi « Ouvrir avec » dans Drive
        withToken: (fn, loginHint) => withToken('gdrive', fn, (c) => cloudConnect(c, { loginHint })),
        openData: (data, name) => openProjectData(data, name),
        openFolder: async (loc) => (await import('../io/cloudFolder')).folderOpen(loc),
      });
      if (r.kind === 'create') onCreate(r.loc);
      else onOpened(r.project, r.name, r.loc, r.notes.map((w) => (typeof w === 'string' ? w : t(w.key, w.params))));
      onClose();
    } catch (e) {
      setMsg(cloudErrorText(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="toast drive-open" role="alertdialog">
      <div>{t(intent.action === 'open' ? 'driveOpen.open' : 'driveOpen.create')}</div>
      {others > 0 && <div className="muted small">{t('driveOpen.others', { n: others })}</div>}
      {msg && <div className="small error-text">{msg}</div>}
      <button className="primary" disabled={busy} onClick={() => void go()}>
        {busy ? '…' : t(intent.action === 'open' ? 'driveOpen.openButton' : 'driveOpen.createButton')}
      </button>{' '}
      <button disabled={busy} onClick={onClose}>
        {t('save.cancel')}
      </button>
    </div>
  );
}
