import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../store';

export interface MoreAction {
  label: string;
  shortcut?: string;
  run: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Menu « ⋯ » de la barre d'outils sur petit écran (moins de 700 px de large) : les actions secondaires
 * (annuler, rétablir, mettre à jour, IA) et le choix de la langue, que la barre n'affiche plus elle-même.
 * Masqué sur grand écran par la feuille de style : la barre complète y reste inchangée.
 */
export function ToolbarMore({ actions, children }: { actions: MoreAction[]; children?: ReactNode }) {
  const t = useStore((s) => s.t);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close, true);
      window.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div className="toolbar-more narrow-only" ref={ref}>
      <button
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('menu.more')}
        title={t('menu.more')}
        className={open ? 'active' : ''}
        onClick={() => setOpen(!open)}
      >
        ⋯
      </button>
      {open && (
        <div className="add-menu toolbar-more-list" role="menu">
          {actions.map((a) => (
            <button
              key={a.label}
              role="menuitem"
              disabled={a.disabled}
              className={a.className}
              onClick={() => {
                setOpen(false);
                a.run();
              }}
            >
              <span>{a.label}</span>
              {a.shortcut && <kbd>{a.shortcut}</kbd>}
            </button>
          ))}
          {children && (
            <>
              <div className="menu-sep" />
              {children}
            </>
          )}
        </div>
      )}
    </div>
  );
}
