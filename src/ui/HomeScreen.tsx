import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { APP_NAME } from '../brand';
import { browserList } from '../io/storage';
import { forgetRecent, listRecent, type RecentEntry } from '../io/recent';
import type { ProjectStatus } from '../model/types';

/**
 * Page d'accueil « Mes projets » : point de départ clair (créer, ouvrir, importer, reprendre un projet récent).
 * Affichée au lancement quand aucun projet n'est ouvert, et depuis le menu Fichier. Tout reste sur l'appareil ou
 * dans le cloud de l'utilisateur : aucun compte.
 */
export function HomeScreen({
  canClose,
  onClose,
  onNew,
  onOpenFile,
  onOpenStorage,
  onImport,
  onOpenRecent,
  whereLabel,
}: {
  /** Un projet est ouvert derrière (on peut y revenir). */
  canClose: boolean;
  onClose: () => void;
  onNew: (kind: 'new' | 'existing') => void;
  onOpenFile: () => void;
  onOpenStorage: () => void;
  /** Import d'un fichier d'un autre logiciel : la source est reconnue d'après le contenu. */
  onImport: () => void;
  onOpenRecent: (e: RecentEntry) => void;
  whereLabel: (e: RecentEntry) => string;
}) {
  const t = useStore((s) => s.t);
  const lang = useStore((s) => s.lang);
  const [recent, setRecent] = useState<RecentEntry[]>(listRecent);
  const [inBrowser, setInBrowser] = useState<{ id: string; name: string; updated: string }[]>([]);

  useEffect(() => {
    let alive = true;
    browserList()
      .then((l) => alive && setInBrowser(l.map(({ id, name, updated }) => ({ id, name, updated }))))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // Projets du navigateur pas encore dans les récents (enregistrés ailleurs, autre onglet…)
  const known = new Set(recent.filter((r) => r.loc.kind === 'browser').map((r) => (r.loc as { id: string }).id));
  const others = inBrowser.filter((b) => !known.has(b.id)).sort((a, b) => b.updated.localeCompare(a.updated));
  const date = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'nl' ? 'nl-BE' : 'fr-BE', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return iso.slice(0, 10);
    }
  };
  const status = (s?: ProjectStatus) => <span className={'status-badge ' + (s ?? 'draft')}>{t('status.' + (s ?? 'draft'))}</span>;

  return (
    <section className="home" aria-labelledby="home-title">
      <div className="home-inner">
        <header className="home-head">
          <h1 id="home-title">{t('home.title')}</h1>
          <p className="muted">{t('home.subtitle', { name: APP_NAME })}</p>
        </header>

        <div className="home-actions">
          <button className="home-card primary" onClick={() => onNew('new')}>
            <span className="home-card-icon" aria-hidden="true">＋</span>
            <strong>{t('home.new')}</strong>
            <span className="muted small">{t('home.newHelp')}</span>
          </button>
          <button className="home-card" onClick={() => onNew('existing')}>
            <span className="home-card-icon" aria-hidden="true">⌂</span>
            <strong>{t('home.survey')}</strong>
            <span className="muted small">{t('home.surveyHelp')}</span>
          </button>
          <button className="home-card" onClick={onOpenFile}>
            <span className="home-card-icon" aria-hidden="true">▤</span>
            <strong>{t('home.openFile')}</strong>
            <span className="muted small">{t('home.openFileHelp')}</span>
          </button>
          <button className="home-card" onClick={onOpenStorage}>
            <span className="home-card-icon" aria-hidden="true">☁</span>
            <strong>{t('home.openCloud')}</strong>
            <span className="muted small">{t('home.openCloudHelp')}</span>
          </button>
          <button className="home-card" onClick={onImport}>
            <span className="home-card-icon" aria-hidden="true">⇪</span>
            <strong>{t('home.import')}</strong>
            <span className="muted small">{t('home.importHelp')}</span>
          </button>
        </div>

        <h2>{t('home.recent')}</h2>
        {recent.length === 0 && others.length === 0 && <p className="muted">{t('home.noRecent')}</p>}
        {recent.length > 0 && (
          <ul className="home-list">
            {recent.map((r) => (
              <li key={r.key}>
                <button className="home-item" onClick={() => onOpenRecent(r)}>
                  <span className="home-item-main">
                    <strong>{r.title}</strong>
                    <span className="muted small">
                      {[r.client, r.city].filter(Boolean).join(' · ') || r.name}
                    </span>
                  </span>
                  <span className="home-item-side">
                    {status(r.status)}
                    <span className="muted small">
                      {whereLabel(r)} · {date(r.at)}
                    </span>
                  </span>
                </button>
                <button
                  className="home-forget"
                  title={t('home.forget')}
                  aria-label={t('home.forget') + ' : ' + r.title}
                  onClick={() => {
                    forgetRecent(r.key);
                    setRecent(listRecent());
                  }}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        {others.length > 0 && (
          <>
            <h3 className="muted small">{t('home.inBrowser')}</h3>
            <ul className="home-list">
              {others.map((b) => (
                <li key={b.id}>
                  <button
                    className="home-item"
                    onClick={() => onOpenRecent({ key: 'browser:' + b.id, name: b.name, title: b.name, loc: { kind: 'browser', id: b.id }, at: b.updated })}
                  >
                    <span className="home-item-main">
                      <strong>{b.name}</strong>
                    </span>
                    <span className="home-item-side muted small">
                      {t('save.where.browser')} · {date(b.updated)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="muted small home-privacy">{t('home.privacy')}</p>
        {canClose && (
          <div className="row">
            <button onClick={onClose}>{t('home.back')}</button>
          </div>
        )}
      </div>
    </section>
  );
}
