import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from '../store';
import { useDerived } from './derived';
import { shortLabel } from './labels';
import { findNode } from '../model/tree';

/** `true` quand la colonne est empilée au-dessus du dessin (même seuil que styles.css). */
export const NARROW_QUERY = '(max-width: 800px)';

export function useNarrow(): boolean {
  const get = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(NARROW_QUERY).matches;
  const [narrow, setNarrow] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(NARROW_QUERY);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return narrow;
}

/**
 * Téléphone, colonne masquée : propriétés de l'élément sélectionné dans un panneau sous le dessin (audit visuel du
 * 2026-11-25 : toucher un élément ne montrait rien). Le panneau est dans le flux, pas par-dessus : le dessin se
 * réduit sans être caché, et l'élément reste visible (le schéma garde tout son cadre).
 *  - replié : une ligne (nom de l'élément, ▴, ✕) ;
 *  - déplié : propriétés, hauteur plafonnée (styles.css, `.props-sheet`) pour laisser au moins la moitié de
 *    l'écran au dessin ;
 *  - ✕ désélectionne l'élément, ce qui ferme le panneau.
 * L'état replié ou déplié est retenu (SidePanels).
 */
export function PropsSheet({ open, onToggle, children }: { open: boolean; onToggle: () => void; children: ReactNode }) {
  const t = useStore((s) => s.t);
  const lang = useStore((s) => s.lang);
  const project = useStore((s) => s.project);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const { numbering } = useDerived();
  const node = selectedId ? (findNode(project.roots, selectedId) ?? findNode(project.loose, selectedId)) : undefined;
  if (!node) return null;
  const label = shortLabel(node, project, numbering, lang, t);
  return (
    <section className={'props-sheet' + (open ? ' open' : '')} aria-label={t('panel.props')}>
      <div className="props-sheet-head">
        <button className="props-sheet-toggle" aria-expanded={open} onClick={onToggle}>
          <span className="props-sheet-name">{label}</span>
          <span className="props-sheet-hint">
            {t(open ? 'sheet.less' : 'sheet.more')} {open ? '▾' : '▴'}
          </span>
        </button>
        <button className="props-sheet-close" aria-label={t('sheet.close')} title={t('sheet.close')} onClick={() => select(null)}>
          ✕
        </button>
      </div>
      {open && <div className="props-sheet-body">{children}</div>}
    </section>
  );
}
