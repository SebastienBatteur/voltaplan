import { AiSettingsDialog } from './ui/AiSettingsDialog';
import { useAiUnlocked } from './ai/settings';
import { BoardView } from './ui/BoardView';
import { PrintDialog } from './print/PrintDialog';
import { StorageDialog } from './ui/StorageDialog';
import { AUTOSAVE_ID, browserDelete, browserLoad, browserSave, getGithubToken, githubSave, loadGithubSettings, parseProject, type Location } from './io/storage';
import { APP_NAME, FILE_EXT, LEGACY_EXTS } from './brand';
import { useEffect, useRef, useState } from 'react';
import { onUpdate } from './appUpdate';
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
      const nodes = [...walk(r.project.roots)].length;
      const symbols = r.project.plan.pages.reduce((a, p) => a + p.symbols.length, 0);
      setToast({ text: t('import.done', { nodes, symbols }), warnings: r.warnings });
    } catch (e) {
      setToast({ text: (e as Error).message });
    }
  };

  /** Enregistrer : au même endroit que la dernière fois (appareil, navigateur, GitHub). */
  const save = async (saveAs = false) => {
    const loc = location.current;
    try {
      if (saveAs) {
        setStorage('save');
        return;
      }
      const st = useStore.getState();
      if (loc.kind === 'browser') {
        await browserSave(loc.id, st.fileName || st.project.meta.title, st.project);
        s.markSaved(st.fileName);
      } else if (loc.kind === 'cloud') {
        const { cloudSave } = await import('./io/cloud');
        await cloudSave(loc.provider, loc.file.name, st.project, loc.file);
        s.markSaved(st.fileName);
      } else if (loc.kind === 'github') {
        const token = getGithubToken();
        if (!token) {
          setStorage('save');
          return;
        }
        await githubSave(token, loadGithubSettings(), loc.path, st.project);
        s.markSaved(st.fileName);
      } else {
        const name = await saveProject(st.project, st.fileName, false);
        if (name) s.markSaved(name);
      }
      void browserDelete(AUTOSAVE_ID).catch(() => undefined);
    } catch (e) {
      setToast({ text: (e as Error).message });
    }
  };

  // Raccourcis clavier
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as Element).tagName);
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !typing) (e.preventDefault(), e.shiftKey ? s.redo() : s.undo());
      else if (mod && e.key.toLowerCase() === 'y' && !typing) (e.preventDefault(), s.redo());
      else if (mod && e.key.toLowerCase() === 's') (e.preventDefault(), save(e.shiftKey));
      else if (mod && e.key.toLowerCase() === 'p') (e.preventDefault(), setPrintOpen(true));
      else if (mod && e.key.toLowerCase() === 'o') (e.preventDefault(), open([FILE_EXT, ...LEGACY_EXTS, '.json', '.trik'].join(',')));
      else if (e.key === 'Delete' && !typing && s.selectedId) s.remove(s.selectedId);
      else if (e.key === 'Escape') s.startPlacing(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Avertir avant de fermer avec des modifications
  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (useStore.getState().dirty) e.preventDefault();
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
  const [recover, setRecover] = useState<{ name: string; updated: string; data: string } | null>(null);
  // Nouvelle version publiée pendant que la page est ouverte (src/appUpdate.ts)
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => onUpdate(() => setUpdateReady(true)), []);

  // Brouillon automatique dans le navigateur (toutes les 20 s s'il y a des modifications), récupérable au démarrage
  useEffect(() => {
    browserLoad(AUTOSAVE_ID)
      .then((e) => e && setRecover({ name: e.name, updated: e.updated, data: e.data }))
      .catch(() => undefined);
    const id = setInterval(() => {
      const st = useStore.getState();
      if (st.dirty) void browserSave(AUTOSAVE_ID, st.fileName || st.project.meta.title, st.project).catch(() => undefined);
    }, 20000);
    return () => clearInterval(id);
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
              },
            },
            { label: t('menu.open'), shortcut: 'Ctrl+O', run: () => setStorage('open') },
            { label: t('menu.importTrikker'), run: () => open('.trik') },
            { label: t('menu.save'), shortcut: 'Ctrl+S', run: () => save(false), separatorBefore: true },
            { label: t('menu.saveAs'), shortcut: 'Ctrl+Maj+S', run: () => save(true) },
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
              void saveProject(useStore.getState().project, useStore.getState().fileName, true).then((name) => {
                if (name) {
                  location.current = { kind: 'device' };
                  s.markSaved(name);
                }
              });
          }}
          onOpened={(p, name, loc) => {
            if (!confirmDiscard()) return;
            s.loadProject(p, name);
            location.current = loc;
          }}
          onSaved={(name, loc) => {
            location.current = loc;
            s.markSaved(name);
            void browserDelete(AUTOSAVE_ID).catch(() => undefined);
          }}
        />
      )}
      {updateReady && (
        <div className="toast">
          {t('app.updateReady')}{' '}
          <button className="primary" onClick={() => window.location.reload()}>
            {t('app.reload')}
          </button>{' '}
          <button onClick={() => setUpdateReady(false)}>✕</button>
        </div>
      )}
      {recover && (
        <div className="toast">
          {t('storage.recover', { name: recover.name, date: new Date(recover.updated).toLocaleString() })}{' '}
          <button
            onClick={() => {
              try {
                s.loadProject(parseProject(recover.data), recover.name);
              } catch (e) {
                setToast({ text: (e as Error).message });
              }
              setRecover(null);
            }}
          >
            {t('storage.recoverYes')}
          </button>{' '}
          <button
            onClick={() => {
              void browserDelete(AUTOSAVE_ID).catch(() => undefined);
              setRecover(null);
            }}
          >
            {t('storage.recoverNo')}
          </button>
        </div>
      )}
      <main className={showSide ? 'with-side' : ''}>
        {showSide && (
          <SidePanels tree={<TreePanel />} props={<PropsPanel />} />
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
