import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../store';
import { STORAGE_PREFIX } from '../brand';

const KEY = STORAGE_PREFIX + 'sidePanels';

interface Layout {
  treeOpen: boolean;
  propsOpen: boolean;
  /** Part de la hauteur donnée à « Installation » quand les deux sont ouverts (0,15 … 0,85). */
  split: number;
  /** Largeur de la colonne (px). */
  width: number;
}

function load(): Layout {
  const def: Layout = { treeOpen: true, propsOpen: true, split: 0.5, width: 340 };
  try {
    return { ...def, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Layout>) };
  } catch {
    return def;
  }
}

/**
 * Colonne de gauche : « Installation » et « Propriétés ».
 * Chaque partie se replie en cliquant son titre ; la séparation entre les deux se fait glisser ;
 * le bord droit de la colonne aussi (largeur). La disposition est retenue sur cet appareil.
 */
export function SidePanels({ tree, props }: { tree: ReactNode; props: ReactNode }) {
  const t = useStore((s) => s.t);
  const [l, setL] = useState<Layout>(load);
  const ref = useRef<HTMLElement>(null);
  const drag = useRef<'split' | 'width' | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(l));
    } catch {
      /* stockage indisponible */
    }
  }, [l]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const el = ref.current;
      if (!drag.current || !el) return;
      const r = el.getBoundingClientRect();
      if (drag.current === 'split') setL((x) => ({ ...x, split: Math.min(0.85, Math.max(0.15, (e.clientY - r.top) / r.height)) }));
      else setL((x) => ({ ...x, width: Math.round(Math.min(Math.max(220, e.clientX - r.left), window.innerWidth * 0.6)) }));
    };
    const up = () => {
      drag.current = null;
      document.body.classList.remove('resizing', 'resizing-v', 'resizing-h');
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  const start = (what: 'split' | 'width') => (e: React.PointerEvent) => {
    e.preventDefault();
    drag.current = what;
    document.body.classList.add('resizing', what === 'split' ? 'resizing-v' : 'resizing-h');
  };

  const both = l.treeOpen && l.propsOpen;
  const header = (key: 'treeOpen' | 'propsOpen', label: string) => (
    <h3>
      <button className="side-toggle" aria-expanded={l[key]} onClick={() => setL((x) => ({ ...x, [key]: !x[key] }))}>
        <span className="twisty">{l[key] ? '▾' : '▸'}</span> {label}
      </button>
    </h3>
  );

  return (
    <aside className="side" ref={ref} style={{ width: l.width }}>
      <section className={'side-tree' + (l.treeOpen ? '' : ' folded')} style={both ? { flex: `${l.split} 1 0` } : undefined}>
        {header('treeOpen', t('panel.tree'))}
        {l.treeOpen && tree}
      </section>
      {both && <div className="side-splitter" role="separator" aria-orientation="horizontal" title={t('panel.resize')} onPointerDown={start('split')} />}
      <section className={'side-props' + (l.propsOpen ? '' : ' folded')} style={both ? { flex: `${1 - l.split} 1 0` } : undefined}>
        {header('propsOpen', t('panel.props'))}
        {l.propsOpen && props}
      </section>
      <div className="side-resizer" role="separator" aria-orientation="vertical" title={t('panel.resize')} onPointerDown={start('width')} />
    </aside>
  );
}
