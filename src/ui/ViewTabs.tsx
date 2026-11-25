import { useEffect, useRef } from 'react';
import { useStore, type View } from '../store';

const VIEWS: View[] = ['unifilar', 'plan', 'board', 'bom', 'project', 'check'];

/**
 * Onglets des vues. Sur petit écran, ils tiennent sur une ligne qui défile horizontalement (styles.css) :
 * l'onglet actif est ramené dans le champ à chaque changement de vue.
 */
export function ViewTabs({ errors, warnings }: { errors: number; warnings: number }) {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const t = useStore((s) => s.t);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = ref.current;
    const b = nav?.querySelector<HTMLElement>('button.active');
    if (!nav || !b || nav.scrollWidth <= nav.clientWidth) return;
    const left = b.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
    if (left < nav.scrollLeft || left + b.offsetWidth > nav.scrollLeft + nav.clientWidth)
      nav.scrollLeft = Math.max(0, left - (nav.clientWidth - b.offsetWidth) / 2);
  }, [view]);

  return (
    <nav className="tabs" ref={ref} aria-label={t('view.navLabel')}>
      {VIEWS.map((v) => (
        <button key={v} className={view === v ? 'active' : ''} aria-current={view === v ? 'page' : undefined} onClick={() => setView(v)}>
          {t('view.' + v)}
          {v === 'check' && (errors || warnings) ? <span className={'count ' + (errors ? 'error' : 'warning')}>{errors || warnings}</span> : null}
        </button>
      ))}
    </nav>
  );
}
