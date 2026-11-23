import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

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
    <div className="file-menu" ref={ref}>
      <button aria-haspopup="menu" aria-expanded={open} className={open ? 'active' : ''} onClick={() => setOpen(!open)}>
        {t('menu.file')} ▾
      </button>
      {open && (
        <div className="add-menu file-menu-list" role="menu">
          {actions.map((a) => (
            <div key={a.label}>
              {a.separatorBefore && <div className="menu-sep" />}
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
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
