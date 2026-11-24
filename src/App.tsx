import { AiSettingsDialog } from './ui/AiSettingsDialog';
import { ElementsPanel } from './ui/ElementsPanel';
import { useAiUnlocked } from './ai/settings';
import { BoardView } from './ui/BoardView';
import { PrintDialog } from './print/PrintDialog';
import { StorageDialog } from './ui/StorageDialog';
import {
  addVersion,
  browserDelete,
  browserSave,
  draftId,
  getGithubToken,
  githubSave,
  loadGithubSettings,
  orphanDrafts,
  parseProject,
  startTabHeartbeat,
  type Location,
} from './io/storage';
import { locationKey, saveAt, type SaveDeps, type SaveOutcome } from './io/saveFlow';
import { conflictName } from './io/conflict';
import { VersionsDialog } from './ui/VersionsDialog';
import { APP_NAME, FILE_EXT, LEGACY_EXTS } from './brand';
import { useEffect, useRef, useState } from 'react';
import { isReloadingForUpdate } from './appUpdate';
import { OfflineBadge, UpdateBanner } from './ui/UpdateBanner';
import { useStore, type View } from './store';
import { LANGS, type Lang } from './i18n';
import { UnifilarView } from './ui/UnifilarView';
import { PlanView } from './ui/PlanView';
import { BomPanel } from './ui/BomPanel';
import { SyncDialog } from './ui/SyncDialog';
import { SidePanels } from './ui/SidePanels';
import { FileMenu } from './ui/FileMenu';
import { TreePanel } from './ui/TreePanel';
import { PropsPanel } from './ui/PropsPanel';
import { ProjectPanel } from './ui/ProjectPanel';
import { CheckPanel } from './ui/CheckPanel';
import { useDerived } from './ui/derived';
import { errorText } from './ui/errors';
import { pickFile, readProjectFile, resetHandle, saveProject } from './io/files';
import { emptyProject, walk } from './model/tree';

const VIEWS: View[] = ['unifilar', 'plan', 'board', 'bom', 'project', 'check'];

export function App() {
  const s = useStore();
  const { t } = s;
  const { findings } = useDerived();
  const [toast, setToast] = useState<{ text: string; warnings?: string[] } | null>(null);
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.filter((f) => f.severity === 'warning').length;

  /** Emplacement du projet ouvert : « Enregistrer » y réécrit. */
  const location = useRef<Location>({ kind: 'device' });
  const confirmDiscard = () => !useStore.getState().dirty || window.confirm(t('file.unsaved'));

  const open = async (accept: string) => {
    if (!confirmDiscard()) return;
    const file = await pickFile(accept);
    if (!file) return;
    try {
      const r = await readProjectFile(file);
      s.loadProject(r.project, r.fileName);
      location.current = { kind: 'device' };
      setSaveState(null);
      const nodes = [...walk(r.project.roots)].length;
      const symbols = r.project.plan.pages.reduce((a, p) => a + p.symbols.length, 0);
      setToast({ text: t('import.done', { nodes, symbols }), warnings: r.warnings.map((w) => (typeof w === 'string' ? w : t(w.key, w.params))) });
    } catch (e) {
      setToast({ text: errorText(e, t) });
    }
  };

  /** État de l'enregistrement, affiché en permanence dans la barre (voir src/io/saveFlow.ts). */
  const [saveState, setSaveState] = useState<
    | { kind: 'saving' }
    | { kind: 'saved'; where: string; at: Date }
    | { kind: 'conflict'; copy: string }
    | { kind: 'pending'; where: string }
    | { kind: 'error'; message: string }
    | null
  >(null);
  /** Fichier de l'appareil modifié ailleurs : choix de l'utilisateur (copie ou remplacement). */
  const [deviceConflict, setDeviceConflict] = useState<string | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);

  const whereLabel = (loc: Location) =>
    loc.kind === 'cloud' ? loc.provider === 'gdrive' ? 'Google Drive' : loc.provider === 'onedrive' ? 'OneDrive' : 'Dropbox' : loc.kind === 'github' ? 'GitHub' : t('save.where.' + loc.kind);

  const saveDeps = (): SaveDeps => ({
    browserSave,
    cloudSave: async (...a) => (await import('./io/cloud')).cloudSave(...a),
    githubSave,
    githubToken: getGithubToken,
    githubSettings: loadGithubSettings,
    deviceSave: (project, fileName) => saveProject(project, fileName, false),
    addVersion,
    newId: () => Math.random().toString(36).slice(2, 10),
    now: () => new Date(),
  });

  /** Brouillon de cet onglet supprimé dès que le projet est enregistré quelque part. */
  const dropDraft = () => void browserDelete(draftId()).catch(() => undefined);

  const applyOutcome = (r: SaveOutcome, projectAtSave: unknown) => {
    // Le projet a pu changer pendant l'envoi : il ne devient « enregistré » que s'il est resté identique
    const unchanged = useStore.getState().project === projectAtSave;
    switch (r.status) {
      case 'saved':
        location.current = r.loc;
        if (unchanged) s.markSaved(r.loc.kind === 'device' ? r.name : useStore.getState().fileName || r.name);
        setSaveState({ kind: 'saved', where: whereLabel(r.loc), at: new Date() });
        dropDraft();
        break;
      case 'conflictCopy':
        location.current = r.loc;
        if (unchanged) s.markSaved(r.copyName);
        setSaveState({ kind: 'conflict', copy: r.copyName });
        setToast({ text: t('save.conflictCopy', { name: r.name, copy: r.copyName }) });
        dropDraft();
        break;
      case 'deviceConflict':
        setSaveState({ kind: 'conflict', copy: '' });
        setDeviceConflict(r.name);
        break;
      case 'pending':
        setSaveState({ kind: 'pending', where: whereLabel(r.loc) });
        setToast({ text: t('save.pending', { where: whereLabel(r.loc) }) });
        break;
      case 'needsAuth':
        setSaveState(null);
        setStorage('save');
        break;
      case 'cancelled':
        setSaveState(null);
        break;
    }
  };

  /** Enregistrer : au même endroit que la dernière fois, sans jamais écraser une version modifiée ailleurs. */
  const save = async (saveAs = false) => {
    if (saveAs) {
      setStorage('save');
      return;
    }
    const st = useStore.getState();
    setSaveState({ kind: 'saving' });
    try {
      applyOutcome(await saveAt(location.current, st.project, st.fileName, saveDeps()), st.project);
    } catch (e) {
      setSaveState({ kind: 'error', message: errorText(e, t) });
      setToast({ text: errorText(e, t) });
    }
  };

  /** Fichier de l'appareil modifié ailleurs : enregistrer une copie (choix de l'emplacement), ou remplacer. */
  const resolveDeviceConflict = async (choice: 'copy' | 'overwrite') => {
    const name = deviceConflict ?? '';
    setDeviceConflict(null);
    const st = useStore.getState();
    try {
      if (choice === 'overwrite' && !window.confirm(t('save.overwriteConfirm', { name }))) return;
      const saved =
        choice === 'copy'
          ? await saveProject(st.project, st.fileName, true, { suggestedName: conflictName(name || st.fileName || 'projet') })
          : await saveProject(st.project, st.fileName, false, { force: true });
      if (!saved) return setSaveState(null);
      location.current = { kind: 'device' };
      if (useStore.getState().project === st.project) s.markSaved(saved);
      void addVersion(locationKey({ kind: 'device' }, saved), saved, st.project, 'save').catch(() => undefined);
      setSaveState({ kind: 'saved', where: t('save.where.device'), at: new Date() });
      dropDraft();
    } catch (e) {
      setSaveState({ kind: 'error', message: errorText(e, t) });
    }
  };

  // Enregistrement en attente (pas de réseau) : repris automatiquement au retour de la connexion, toujours
  // de façon conditionnelle (un conflit donne une copie, jamais un écrasement).
  useEffect(() => {
    if (saveState?.kind !== 'pending') return;
    const retry = () => {
      void (async () => {
        const st = useStore.getState();
        try {
          const r = await saveAt(location.current, st.project, st.fileName, saveDeps());
          applyOutcome(r, st.project);
          if (r.status === 'saved') setToast({ text: t('save.retried', { where: whereLabel(r.loc) }) });
        } catch (e) {
          setSaveState({ kind: 'error', message: errorText(e, t) });
        }
      })();
    };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveState?.kind]);

  // Raccourcis clavier
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as Element).tagName);
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && key === 'y' && !typing) {
        e.preventDefault();
        s.redo();
      } else if (mod && key === 's') {
        e.preventDefault();
        save(e.shiftKey);
      } else if (mod && key === 'p') {
        e.preventDefault();
        setPrintOpen(true);
      } else if (mod && key === 'o') {
        e.preventDefault();
        open([FILE_EXT, ...LEGACY_EXTS, '.json', '.trik'].join(','));
      } else if (e.key === 'Delete' && !typing && s.selectedId) s.remove(s.selectedId);
      else if (e.key === 'Escape') s.startPlacing(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Avertir avant de fermer avec des modifications
  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      // Rechargement pour une nouvelle version : le brouillon vient d'être gardé (src/ui/UpdateBanner.tsx)
      if (useStore.getState().dirty && !isReloadingForUpdate()) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBefore);
    return () => window.removeEventListener('beforeunload', onBefore);
  }, []);

  useEffect(() => {
    document.title = `${s.dirty ? '• ' : ''}${s.project.meta.title || APP_NAME} — ${APP_NAME}`;
  }, [s.dirty, s.project.meta.title]);

  const [aiOpen, setAiOpen] = useState(false);
  const aiUnlocked = useAiUnlocked();
  const [printOpen, setPrintOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [storage, setStorage] = useState<'open' | 'save' | null>(null);
  const [recover, setRecover] = useState<{ id: string; name: string; updated: string; data: string; others: number } | null>(null);

  // Brouillon automatique dans le navigateur, un par onglet (toutes les 20 s s'il y a des modifications, et quand
  // l'onglet passe en arrière-plan ou se ferme). Au démarrage, les brouillons d'onglets fermés ou interrompus
  // (plantage, batterie, mise à jour) sont proposés à la récupération ; ceux d'onglets encore ouverts ne le sont pas.
  useEffect(() => {
    const stopBeat = startTabHeartbeat();
    orphanDrafts()
      .then((list) => {
        const e = list[0];
        if (e) setRecover({ id: e.id, name: e.name, updated: e.updated, data: e.data, others: list.length - 1 });
      })
      .catch(() => undefined);
    const keepDraft = () => {
      const st = useStore.getState();
      if (st.dirty) void browserSave(draftId(), st.fileName || st.project.meta.title, st.project, 'any').catch(() => undefined);
    };
    const id = setInterval(keepDraft, 20000);
    const onHide = () => document.visibilityState === 'hidden' && keepDraft();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', keepDraft);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', keepDraft);
      stopBeat();
    };
  }, []);
  const showSide = s.view === 'unifilar' || s.view === 'plan' || s.view === 'board';

  return (
    <div className="app">
      <header className="toolbar">
        <div className="brand">
          <span className="logo">⚡</span> {APP_NAME}
        </div>
        <FileMenu
          actions={[
            {
              label: t('menu.new'),
              run: () => {
                if (!confirmDiscard()) return;
                resetHandle();
                location.current = { kind: 'device' };
                s.loadProject(emptyProject(), '');
                setSaveState(null);
              },
            },
            { label: t('menu.open'), shortcut: 'Ctrl+O', run: () => setStorage('open') },
            { label: t('menu.importTrikker'), run: () => open('.trik') },
            { label: t('menu.save'), shortcut: 'Ctrl+S', run: () => save(false), separatorBefore: true },
            { label: t('menu.saveAs'), shortcut: 'Ctrl+Maj+S', run: () => save(true) },
            { label: t('menu.versions'), run: () => setVersionsOpen(true) },
            { label: t('menu.print'), shortcut: 'Ctrl+P', run: () => setPrintOpen(true), separatorBefore: true },
          ]}
        />
        {/* Enregistrer reste visible : action fréquente, en bleu quand il y a des modifications non enregistrées */}
        <button onClick={() => save(false)} className={s.dirty ? 'primary' : ''} title="Ctrl+S">
          {t('menu.save')}
        </button>
        <button onClick={() => setSyncOpen(true)} title={t('sync.help')}>
          ⟳ {t('sync.button')}
        </button>
        <span className="sep" />
        <button onClick={s.undo} disabled={!s.past.length} title="Ctrl+Z">
          ↶
        </button>
        <button onClick={s.redo} disabled={!s.future.length} title="Ctrl+Y">
          ↷
        </button>
        <span className="sep" />
        <nav className="tabs">
          {VIEWS.map((v) => (
            <button key={v} className={s.view === v ? 'active' : ''} onClick={() => s.setView(v)}>
              {t('view.' + v)}
              {v === 'check' && (errors || warnings) ? <span className={'count ' + (errors ? 'error' : 'warning')}>{errors || warnings}</span> : null}
            </button>
          ))}
        </nav>
        <span className="grow" />
        <span className="file-name" title={s.fileName}>
          {s.fileName || s.project.meta.title}
          {s.dirty ? ' •' : ''}
        </span>
        {saveState && (
          <span
            className={'save-state ' + saveState.kind}
            role="status"
            title={saveState.kind === 'error' ? saveState.message : saveState.kind === 'conflict' && saveState.copy ? saveState.copy : undefined}
          >
            {saveState.kind === 'saving' && t('save.state.saving')}
            {saveState.kind === 'saved' && '✓ ' + t('save.state.saved', { where: saveState.where, time: saveState.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}
            {saveState.kind === 'conflict' && '⚠ ' + t('save.state.conflict')}
            {saveState.kind === 'pending' && '⏸ ' + t('save.state.pending', { where: saveState.where })}
            {saveState.kind === 'error' && '✕ ' + t('save.state.error')}
          </span>
        )}
        <OfflineBadge />
        <button
          onClick={() => setAiOpen(true)}
          className={aiUnlocked ? 'ai-on' : undefined}
          title={aiUnlocked ? `${t('ai.title')} — ${t('ai.on')}` : t('ai.title')}
        >
          ⚙ {t('ai.button')}
        </button>
        <select value={s.lang} onChange={(e) => s.setLang(e.target.value as Lang)} aria-label="Langue">
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </header>

      {aiOpen && <AiSettingsDialog onClose={() => setAiOpen(false)} />}
      {printOpen && <PrintDialog onClose={() => setPrintOpen(false)} />}
      {syncOpen && <SyncDialog onClose={() => setSyncOpen(false)} />}
      {storage && (
        <StorageDialog
          mode={storage}
          onClose={() => setStorage(null)}
          onDevice={() => {
            if (storage === 'open') void open([FILE_EXT, ...LEGACY_EXTS, '.json', '.trik'].join(','));
            else
              void saveProject(useStore.getState().project, useStore.getState().fileName, true)
                .then((name) => {
                  if (name) {
                    location.current = { kind: 'device' };
                    s.markSaved(name);
                    void addVersion(locationKey({ kind: 'device' }, name), name, useStore.getState().project, 'save').catch(() => undefined);
                    setSaveState({ kind: 'saved', where: t('save.where.device'), at: new Date() });
                    dropDraft();
                  }
                })
                .catch((e) => setToast({ text: errorText(e, t) }));
          }}
          onOpened={(p, name, loc) => {
            if (!confirmDiscard()) return;
            s.loadProject(p, name);
            location.current = loc;
            setSaveState(null);
          }}
          onSaved={(name, loc) => {
            location.current = loc;
            s.markSaved(name);
            void addVersion(locationKey(loc, name), name, useStore.getState().project, 'save').catch(() => undefined);
            setSaveState({ kind: 'saved', where: whereLabel(loc), at: new Date() });
            dropDraft();
          }}
        />
      )}
      {versionsOpen && (
        <VersionsDialog
          onClose={() => setVersionsOpen(false)}
          onOpened={(text) => {
            resetHandle();
            location.current = { kind: 'device' };
            setSaveState(null);
            setToast({ text });
          }}
        />
      )}
      {deviceConflict !== null && (
        <div className="toast" role="alertdialog">
          {t('save.deviceConflict', { name: deviceConflict })}{' '}
          <button className="primary" onClick={() => void resolveDeviceConflict('copy')}>
            {t('save.saveCopy')}
          </button>{' '}
          <button className="danger" onClick={() => void resolveDeviceConflict('overwrite')}>
            {t('save.overwrite')}
          </button>{' '}
          <button
            onClick={() => {
              setDeviceConflict(null);
              setSaveState(null);
            }}
          >
            {t('save.cancel')}
          </button>
        </div>
      )}
      <UpdateBanner />
      {recover && (
        <div className="toast">
          {t('storage.recover', { name: recover.name, date: new Date(recover.updated).toLocaleString() })}
          {recover.others > 0 && <> {t('storage.recoverMore', { n: recover.others })}</>}{' '}
          <button
            onClick={() => {
              try {
                s.loadProject(parseProject(recover.data), recover.name);
                // Récupéré : non enregistré tant que l'utilisateur ne l'a pas fait ; le brouillon devient celui de cet onglet
                useStore.setState({ dirty: true });
                resetHandle();
                location.current = { kind: 'device' };
                void browserSave(draftId(), recover.name, useStore.getState().project, 'any')
                  .then(() => browserDelete(recover.id))
                  .catch(() => undefined);
              } catch (e) {
                setToast({ text: errorText(e, t) });
              }
              setRecover(null);
            }}
          >
            {t('storage.recoverYes')}
          </button>{' '}
          <button
            onClick={() => {
              // Mis de côté, jamais supprimé : le brouillon rejoint les versions locales
              const r = recover;
              void (async () => {
                try {
                  await addVersion(`draft:${r.name}`, r.name, parseProject(r.data), 'pending');
                  await browserDelete(r.id);
                } catch {
                  /* brouillon illisible : laissé en place */
                }
              })();
              setRecover(null);
            }}
          >
            {t('storage.recoverNo')}
          </button>
        </div>
      )}
      <main className={showSide ? 'with-side' : ''}>
        {showSide && (
          <SidePanels tree={<TreePanel />} props={<PropsPanel />} palette={<ElementsPanel />} />
        )}
        <section className="content">
          {s.view === 'unifilar' && <UnifilarView />}
          {s.view === 'plan' && <PlanView />}
          {s.view === 'board' && <BoardView />}
          {s.view === 'bom' && <BomPanel />}
          {s.view === 'project' && <ProjectPanel />}
          {s.view === 'check' && <CheckPanel />}
        </section>
      </main>

      {toast && (
        <div className="toast" onClick={() => setToast(null)}>
          <div>{toast.text}</div>
          {toast.warnings && toast.warnings.length > 0 && (
            <details>
              <summary>{t('import.warnings')} ({toast.warnings.length})</summary>
              <ul>
                {toast.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
