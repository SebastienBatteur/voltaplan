import { AddMenu } from './AddMenu';
import { ALLOWED_CHILDREN } from '../model/schema';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useStore } from '../store';
import { useChain, useDerived } from './derived';
import { shortLabel } from './labels';
import { isWallMounted, Symbol, symbolSize } from '../unifilar/symbols';
import { ancestors, findNode } from '../model/tree';
import type { ElNode } from '../model/types';

/**
 * Pictogramme d'un élément : son symbole RGIE (tableau 2.23) en miniature, le même que dans le schéma, la palette
 * et l'impression. Auparavant des caractères Unicode (⚡ ▣ ⊘ ⏚ ◖ ⊸…) : absents de certaines polices (Android),
 * affichés en emoji couleur sur téléphone, et différents des symboles du schéma.
 */
function TreeIcon({ node }: { node: ElNode }) {
  // La protection n'a qu'un symbole vertical (sur le fil) : couché pour tenir sur la ligne
  if (node.kind === 'protection') {
    const s = symbolSize(node, 'v');
    return (
      <svg viewBox={`-4 ${-s.w / 2 - 4} ${s.h + 8} ${s.w + 8}`} className="palette-icon tree-icon" aria-hidden="true" focusable="false">
        <g transform="rotate(-90)">
          <Symbol node={node} orient="v" />
        </g>
      </svg>
    );
  }
  const s = symbolSize(node, 'h');
  return (
    <svg viewBox={`-4 -16 ${s.w + 8} 32`} className="palette-icon tree-icon" aria-hidden="true" focusable="false">
      <Symbol node={node} orient="h" bare={!isWallMounted(node)} />
    </svg>
  );
}

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

  // Clavier (motif ARIA « tree ») : un seul élément de l'arbre dans l'ordre de tabulation (le sélectionné, sinon le
  // premier) ; flèches haut et bas : élément visible précédent ou suivant ; droite : déplier, puis premier enfant ;
  // gauche : replier, puis parent ; Début et Fin ; « + » ou Inser : menu d'ajout. Se déplacer sélectionne l'élément,
  // comme un clic.
  const rows = () => [...(listRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [])];
  const focusRow = (id: string) => {
    select(id);
    requestAnimationFrame(() => rows().find((r) => r.dataset.id === id)?.focus());
  };
  const openAdd = (n: ElNode, el: HTMLElement) => {
    if (!ALLOWED_CHILDREN[n.kind].length) return;
    select(n.id);
    const r = el.getBoundingClientRect();
    setAdding({ node: n, at: { x: r.right + 4, y: r.top } });
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[role="treeitem"]');
    const id = el?.dataset.id;
    if (!el || !id || e.target !== el) return;
    const n = findNode(project.roots, id) ?? findNode(project.loose, id);
    if (!n) return;
    const list = rows();
    const i = list.indexOf(el);
    const go = (j: number) => list[j]?.dataset.id && focusRow(list[j].dataset.id!);
    const open = n.children.length > 0 && !collapsed.has(n.id);
    switch (e.key) {
      case 'ArrowDown':
        go(i + 1);
        break;
      case 'ArrowUp':
        go(i - 1);
        break;
      case 'Home':
        go(0);
        break;
      case 'End':
        go(list.length - 1);
        break;
      case 'ArrowRight':
        if (n.children.length && !open) toggle(n.id);
        else if (open) go(i + 1);
        break;
      case 'ArrowLeft': {
        if (open) toggle(n.id);
        else {
          const anc = ancestors([...project.roots, ...project.loose], n.id);
          const parent = anc[anc.length - 1];
          if (parent) focusRow(parent.id);
        }
        break;
      }
      case 'Enter':
      case ' ':
        select(n.id);
        break;
      case '+':
      case 'Insert':
        openAdd(n, el);
        break;
      default:
        return;
    }
    e.preventDefault();
  };
  const tabStop = selectedId && (findNode(project.roots, selectedId) || findNode(project.loose, selectedId)) ? selectedId : null;

  let first = true;
  const row = (n: ElNode, depth: number): JSX.Element => {
    const fs = byNode.get(n.id);
    const sev = fs?.some((f) => f.severity === 'error') ? 'error' : fs?.some((f) => f.severity === 'warning') ? 'warning' : null;
    const open = !collapsed.has(n.id);
    const isFirst = first;
    first = false;
    return (
      <div key={n.id} role="none">
        <div
          className={'tree-row' + (n.id === selectedId ? ' selected' : chain.has(n.id) ? ' chain' : '')}
          style={{ paddingLeft: 4 + depth * 12 }}
          role="treeitem"
          data-id={n.id}
          aria-level={depth + 1}
          aria-selected={n.id === selectedId}
          aria-expanded={n.children.length ? open : undefined}
          aria-keyshortcuts={ALLOWED_CHILDREN[n.kind].length ? '+ Insert' : undefined}
          tabIndex={(tabStop ? n.id === tabStop : isFirst) ? 0 : -1}
          onClick={() => select(n.id)}
        >
          <span
            className="twisty"
            aria-hidden="true"
            onClick={(e) => {
              e.stopPropagation();
              toggle(n.id);
            }}
          >
            {n.children.length ? (open ? '▾' : '▸') : ''}
          </span>
          <span className="icon" aria-hidden="true">
            <TreeIcon node={n} />
          </span>
          <span className="label">{shortLabel(n, project, numbering, lang, t)}</span>
          {sev && <span className={'dot ' + sev} />}
          {ALLOWED_CHILDREN[n.kind].length > 0 && (
            <button
              className="tree-add"
              tabIndex={-1}
              title={t('action.addChild') + ' ' + shortLabel(n, project, numbering, lang, t)}
              aria-label={t('action.addChild') + ' ' + shortLabel(n, project, numbering, lang, t)}
              onClick={(e) => {
                e.stopPropagation();
                openAdd(n, e.currentTarget);
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
    <div className="tree" ref={listRef} role="tree" aria-label={t('panel.tree')} aria-describedby="tree-keys" onKeyDown={onKeyDown}>
      <span id="tree-keys" className="sr-only">
        {t('tree.keys')}
      </span>
      {adding && <AddMenu node={adding.node} at={adding.at} onClose={() => setAdding(null)} />}
      {project.roots.map((r) => row(r, 0))}
      {project.loose.length > 0 && (
        <>
          <div className="tree-sep" role="none">
            Plan
          </div>
          {project.loose.map((r) => row(r, 0))}
        </>
      )}
    </div>
  );
}
