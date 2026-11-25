import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { deleteVersion, listVersions, loadVersion, parseProject, VERSIONS_PER_PROJECT, type LocalVersion } from '../io/storage';
import { errorText } from './errors';
import { useModalDialog } from './a11y';

/**
 * Versions locales : historique gardé dans le navigateur à chaque enregistrement, conflit ou enregistrement en
 * attente, et brouillons mis de côté. Ouvrir une version la charge comme un nouveau projet non enregistré (le
 * fichier d'origine n'est jamais modifié depuis ici).
 */
export function VersionsDialog({ onClose, onOpened }: { onClose: () => void; onOpened: (message: string) => void }) {
  const dialogRef = useModalDialog(onClose);
  const t = useStore((s) => s.t);
  const [items, setItems] = useState<Omit<LocalVersion, 'data'>[] | null>(null);
  const [msg, setMsg] = useState('');

  const refresh = () =>
    listVersions()
      .then(setItems)
      .catch((e) => {
        setItems([]);
        setMsg(errorText(e, t));
      });
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = async (v: Omit<LocalVersion, 'data'>) => {
    if (useStore.getState().dirty && !window.confirm(t('file.unsaved'))) return;
    try {
      const full = await loadVersion(v.vid);
      if (!full) return;
      useStore.getState().loadProject(parseProject(full.data, v.name), '');
      // Projet ouvert comme nouveau : « Enregistrer » demandera un emplacement (jamais de remplacement implicite)
      useStore.setState({ dirty: true });
      onOpened(t('versions.opened', { date: new Date(v.at).toLocaleString() }));
      onClose();
    } catch (e) {
      setMsg(errorText(e, t));
    }
  };

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" ref={dialogRef} aria-label={t('versions.title')}>
        <h2>{t('versions.title')}</h2>
        <p className="muted small">{t('versions.help', { n: VERSIONS_PER_PROJECT })}</p>
        <ul className="storage-list">
          {items && items.length === 0 && <li className="muted">{t('versions.empty')}</li>}
          {items?.map((v) => (
            <li key={v.vid}>
              <button className="link" onClick={() => void open(v)}>
                {v.name}
              </button>
              <span className="muted small">
                {new Date(v.at).toLocaleString()} — {t('versions.reason.' + v.reason)} — {Math.round(v.size / 1024)} ko
              </span>
              <button
                className="danger"
                title={t('versions.delete')}
                onClick={() =>
                  void deleteVersion(v.vid)
                    .then(refresh)
                    .catch((e) => setMsg(errorText(e, t)))
                }
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        {msg && <p className="small error-text">{msg}</p>}
        <div className="row end">
          <button className="primary" onClick={onClose}>
            {t('sync.ok')}
          </button>
        </div>
      </div>
    </div>
  );
}
