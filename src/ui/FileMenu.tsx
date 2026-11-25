import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { focusFirstItem, menuKeyDown, restoreFocus } from './a11y';

export interface FileAction {
  label: string;
  shortcut?: string;
  run: () => void;
  separatorBefore?: boolean;
}

/** Menu « Fichier » : les actions peu fréquentes (nouveau, ouvrir, importer, enregistrer sous, imprimer). */
export function FileMenu({ actions }: { actions: FileAction[] }) {
  const t = useStore((s) => s.t);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Ouvert au clavier comme à la souris : le focus va sur la première entrée (flèches ensuite) ; Échap le rend
    // au bouton « Fichier ».
    focusFirstItem(list.current);
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent) {
        if (e.key !== 'Escape') return;
        setOpen(false);
        restoreFocus(button.current, list.current);
      } else if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close, true);
      window.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div className="file-menu" ref={ref}>
      <button ref={button} aria-haspopup="menu" aria-expanded={open} className={open ? 'active' : ''} onClick={() => setOpen(!open)}>
        {t('menu.file')} ▾
      </button>
      {open && (
        <div className="add-menu file-menu-list" role="menu" ref={list} onKeyDown={menuKeyDown}>
          {actions.map((a) => (
            <div key={a.label} role="none">
              {a.separatorBefore && <div className="menu-sep" role="separator" />}
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  // Focus rendu au bouton avant l'action : une fenêtre ouverte par l'action le lui rendra à sa fermeture.
                  button.current?.focus({ preventScroll: true });
                  a.run();
                }}
              >
                <span>{a.label}</span>
                {a.shortcut && <kbd>{a.shortcut}</kbd>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
