import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { ALLOWED_CHILDREN } from '../model/schema';
import type { ElNode, NodeKind } from '../model/types';

/** Éléments proposés en premier (les plus courants), le reste ensuite. */
const COMMON: NodeKind[] = ['protection', 'cable', 'board', 'socket', 'switch', 'light', 'appliance'];

/**
 * Menu « Ajouter » : la liste des éléments permis sous `node` (règles de src/model/schema.ts).
 * Ouvert depuis le « ＋ » d'une ligne de l'arborescence, le bouton des propriétés ou un clic droit sur
 * l'unifilaire ; l'élément ajouté est sélectionné, prêt à être rempli.
 */
export function AddMenu({ node, at, onClose }: { node: ElNode; at: { x: number; y: number }; onClose: () => void }) {
  const t = useStore((s) => s.t);
  const addChild = useStore((s) => s.addChild);
  const ref = useRef<HTMLDivElement>(null);
  const kinds = [...ALLOWED_CHILDREN[node.kind]].sort((a, b) => {
    const ia = COMMON.indexOf(a);
    const ib = COMMON.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  useEffect(() => {
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close, true);
      window.removeEventListener('keydown', close);
    };
  }, [onClose]);

  // Rester dans la fenêtre
  const style = { left: Math.min(at.x, window.innerWidth - 230), top: Math.min(at.y, window.innerHeight - 40 - kinds.length * 30) };
  return (
    <div className="add-menu" ref={ref} style={style} role="menu">
      <div className="add-menu-title">{t('action.addChild')}</div>
      {kinds.length === 0 && <div className="muted small">{t('add.none')}</div>}
      {kinds.map((k) => (
        <button
          key={k}
          role="menuitem"
          onClick={() => {
            addChild(node.id, k);
            onClose();
          }}
        >
          {t('kind.' + k)}
        </button>
      ))}
    </div>
  );
}
