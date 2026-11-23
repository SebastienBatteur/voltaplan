import { AddMenu } from './AddMenu';
import { ALLOWED_CHILDREN } from '../model/schema';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { useChain, useDerived } from './derived';
import { shortLabel } from './labels';
import { ancestors } from '../model/tree';
import type { ElNode } from '../model/types';

const ICON: Record<string, string> = {
  origin: '⚡',
  meter: '▣',
  protection: '⊘',
  board: '▭',
  cable: '╱',
  socket: '◖',
  switch: '⊸',
  pushButton: '◉',
  light: '⊗',
  appliance: '▢',
  earthBar: '▬',
  earth: '⏚',
};

export function TreePanel() {
  const project = useStore((s) => s.project);
  const selectedId = useStore((s) => s.selectedId);
  const chain = useChain();
  const select = useStore((s) => s.select);
  const lang = useStore((s) => s.lang);
  const t = useStore((s) => s.t);
  const { numbering, byNode } = useDerived();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const [adding, setAdding] = useState<{ node: ElNode; at: { x: number; y: number } } | null>(null);

  // Déplier les ancêtres de l'élément sélectionné et le rendre visible
  useEffect(() => {
    if (!selectedId) return;
    const anc = ancestors(project.roots, selectedId);
    if (anc.some((a) => collapsed.has(a.id))) {
      const next = new Set(collapsed);
      anc.forEach((a) => next.delete(a.id));
      setCollapsed(next);
    }
    requestAnimationFrame(() => listRef.current?.querySelector('.tree-row.selected')?.scrollIntoView({ block: 'nearest' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const toggle = (id: string) => {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCollapsed(next);
  };

  const row = (n: ElNode, depth: number): JSX.Element => {
    const fs = byNode.get(n.id);
    const sev = fs?.some((f) => f.severity === 'error') ? 'error' : fs?.some((f) => f.severity === 'warning') ? 'warning' : null;
    const open = !collapsed.has(n.id);
    return (
      <div key={n.id}>
        <div className={'tree-row' + (n.id === selectedId ? ' selected' : chain.has(n.id) ? ' chain' : '')} style={{ paddingLeft: 4 + depth * 12 }} onClick={() => select(n.id)}>
          <span
            className="twisty"
            onClick={(e) => {
              e.stopPropagation();
              toggle(n.id);
            }}
          >
            {n.children.length ? (open ? '▾' : '▸') : ''}
          </span>
          <span className="icon">{ICON[n.kind] ?? '·'}</span>
          <span className="label">{shortLabel(n, project, numbering, lang, t)}</span>
          {sev && <span className={'dot ' + sev} />}
          {ALLOWED_CHILDREN[n.kind].length > 0 && (
            <button
              className="tree-add"
              title={t('action.addChild') + ' ' + shortLabel(n, project, numbering, lang, t)}
              onClick={(e) => {
                e.stopPropagation();
                select(n.id);
                const r = e.currentTarget.getBoundingClientRect();
                setAdding({ node: n, at: { x: r.right + 4, y: r.top } });
              }}
            >
              ＋
            </button>
          )}
        </div>
        {open && n.children.map((c) => row(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="tree" ref={listRef}>
      {adding && <AddMenu node={adding.node} at={adding.at} onClose={() => setAdding(null)} />}
      {project.roots.map((r) => row(r, 0))}
      {project.loose.length > 0 && (
        <>
          <div className="tree-sep">Plan</div>
          {project.loose.map((r) => row(r, 0))}
        </>
      )}
    </div>
  );
}
