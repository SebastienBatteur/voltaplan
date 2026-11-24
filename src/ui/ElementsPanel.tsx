import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { useDerived } from './derived';
import { ALLOWED_CHILDREN } from '../model/schema';
import { ancestors, createNode, walk } from '../model/tree';
import { isWallMounted, Symbol, symbolSize } from '../unifilar/symbols';
import { FURNITURE, FURNITURE_GROUPS, FurnitureShape, type FurnitureKind } from '../plan/furniture';
import { FAMILIES, PLACEABLE } from './families';
import { usePlanUi, type PlanTool } from './planUi';
import type { ElNode, NodeKind } from '../model/types';

/** Pictogramme d'un élément de l'unifilaire (le symbole du plan de position, sans trait s'il n'est pas au mur). */
export function KindIcon({ node }: { node: ElNode }) {
  const s = symbolSize(node, 'h');
  const pad = 4;
  return (
    <svg viewBox={`${-pad} ${-16} ${s.w + 2 * pad} 32`} className="palette-icon" aria-hidden>
      <Symbol node={node} orient="h" bare={!isWallMounted(node)} />
    </svg>
  );
}

const PLAN_TOOLS: PlanTool[] = ['wall', 'door', 'window', 'label'];

/**
 * Palette « Éléments » (colonne de gauche, sous « Propriétés ») :
 *  - les éléments de l'unifilaire par grandes familles ; un clic les ajoute sous l'élément sélectionné,
 *    ou, sur le plan, les place au prochain clic (on choisit alors où ils se branchent dans l'unifilaire) ;
 *  - sur le plan : les outils (murs, portes, fenêtres, textes, mobilier) et les éléments de l'unifilaire pas
 *    encore placés, rangés par circuit ; un clic puis un clic sur le plan les place.
 */
export function ElementsPanel() {
  const t = useStore((s) => s.t);
  const view = useStore((s) => s.view);
  const project = useStore((s) => s.project);
  const selectedId = useStore((s) => s.selectedId);
  const placingId = useStore((s) => s.placingId);
  const { addChild, startPlacing } = useStore.getState();
  const { numbering, labelFn, find } = useDerived();
  const tool = usePlanUi((u) => u.tool);
  const furnKind = usePlanUi((u) => u.furnKind);
  const elementKind = usePlanUi((u) => u.elementKind);
  const [msg, setMsg] = useState<string | null>(null);
  const onPlan = view === 'plan';
  const selected = selectedId ? find(selectedId) : undefined;

  /** Un exemplaire de chaque type, pour dessiner son pictogramme. */
  const samples = useMemo(() => {
    const m = new Map<NodeKind, ElNode>();
    for (const f of FAMILIES) for (const k of f.kinds) m.set(k, createNode(k));
    return m;
  }, []);

  /** Éléments pas encore sur le plan, par circuit (lettre et nom du circuit). */
  const unplaced = useMemo(() => {
    if (!onPlan) return [];
    const placed = new Set(project.plan.pages.flatMap((p) => p.symbols.map((s) => s.nodeId)));
    const groups = new Map<string, { title: string; nodes: ElNode[] }>();
    for (const { node } of walk(project.roots)) {
      if (!PLACEABLE.has(node.kind) || placed.has(node.id)) continue;
      const circuit = [...ancestors(project.roots, node.id)].reverse().find((a) => a.kind === 'protection' && numbering.has(a.id));
      const key = circuit?.id ?? '';
      if (!groups.has(key)) groups.set(key, { title: circuit ? `${numbering.get(circuit.id)} ${labelFn.title(circuit)}` : t('palette.noCircuit'), nodes: [] });
      groups.get(key)!.nodes.push(node);
    }
    return [...groups.values()];
  }, [onPlan, project, numbering, labelFn, t]);

  const clickKind = (k: NodeKind) => {
    setMsg(null);
    if (onPlan) {
      usePlanUi.getState().pickElement(k);
      return;
    }
    if (!selected) {
      setMsg(t('palette.selectFirst'));
      return;
    }
    if (!ALLOWED_CHILDREN[selected.kind].includes(k)) {
      setMsg(t('palette.notHere', { kind: t('kind.' + k) }));
      return;
    }
    const parentName = [numbering.get(selected.id), labelFn.title(selected)].filter(Boolean).join(' ');
    addChild(selected.id, k);
    setMsg(t('palette.added', { kind: t('kind.' + k), parent: parentName }));
  };

  return (
    <div className="palette">
      {onPlan && (
        <>
          <div className="palette-title">{t('palette.plan')}</div>
          <div className="palette-items">
            {PLAN_TOOLS.map((tl) => (
              <button key={tl} className={tool === tl ? 'active' : ''} title={t('plan.hint.' + tl)} onClick={() => usePlanUi.getState().setTool(tl)}>
                {t('plan.tool.' + tl)}
              </button>
            ))}
          </div>
          {FURNITURE_GROUPS.map((g) => (
            <details key={g} className="palette-group">
              <summary>{t('furniture.group.' + g)}</summary>
              <div className="palette-items icons">
                {(Object.keys(FURNITURE) as FurnitureKind[])
                  .filter((k) => FURNITURE[k].group === g)
                  .map((k) => {
                    const d = FURNITURE[k];
                    const box = Math.max(d.w, d.h) * 1.1;
                    return (
                      <button key={k} title={t('furniture.' + k)} className={tool === 'furniture' && furnKind === k ? 'active' : ''} onClick={() => usePlanUi.getState().pickFurniture(k)}>
                        <svg viewBox={`${-box / 2} ${-box / 2} ${box} ${box}`} className="catalog-icon">
                          <FurnitureShape kind={k} w={d.w} h={d.h} />
                        </svg>
                        <span>{t('furniture.' + k)}</span>
                      </button>
                    );
                  })}
              </div>
            </details>
          ))}
        </>
      )}

      <div className="palette-title" title={onPlan ? t('palette.placeHelp') : undefined}>
        {t('palette.unifilar')}
      </div>
      {FAMILIES.map((f) => {
        const kinds = f.kinds.filter((k) => !onPlan || PLACEABLE.has(k));
        if (!kinds.length) return null;
        return (
          <details key={f.key} className="palette-group" open={f.key === 'lighting' || f.key === 'outlets' || f.key === 'controls'}>
            <summary>{t('family.' + f.key)}</summary>
            <div className="palette-items icons">
              {kinds.map((k) => {
                const ok = onPlan || (selected ? ALLOWED_CHILDREN[selected.kind].includes(k) : false);
                const title = onPlan
                  ? t('palette.placeHelp')
                  : !selected
                    ? t('palette.selectFirst')
                    : ok
                      ? t('palette.addHelp', { name: [numbering.get(selected.id), labelFn.title(selected)].filter(Boolean).join(' ') })
                      : t('palette.notHere', { kind: t('kind.' + k) });
                return (
                  <button key={k} className={(ok ? '' : 'dim ') + (onPlan && tool === 'element' && elementKind === k ? 'active' : '')} title={title} onClick={() => clickKind(k)}>
                    <KindIcon node={samples.get(k)!} />
                    <span>{t('kind.' + k)}</span>
                  </button>
                );
              })}
            </div>
          </details>
        );
      })}
      {msg && <p className="muted small">{msg}</p>}

      {onPlan && (
        <>
          <div className="palette-title">{t('palette.unplaced')}</div>
          {unplaced.length === 0 && <p className="muted small">{t('palette.noUnplaced')}</p>}
          {unplaced.map((g) => (
            <details key={g.title} className="palette-group" open>
              <summary>
                {g.title} <span className="muted">({g.nodes.length})</span>
              </summary>
              <div className="palette-list">
                {g.nodes.map((n) => (
                  <button key={n.id} className={placingId === n.id ? 'active' : ''} title={t('action.placeOnPlan')} onClick={() => {
                      usePlanUi.getState().setTool('select');
                      startPlacing(n.id);
                    }}
                  >
                    <KindIcon node={n} />
                    <span>{[numbering.get(n.id), labelFn.title(n)].filter(Boolean).join(' ')}</span>
                  </button>
                ))}
              </div>
            </details>
          ))}
        </>
      )}
    </div>
  );
}
