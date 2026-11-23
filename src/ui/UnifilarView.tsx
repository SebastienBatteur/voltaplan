import { useEffect, useMemo } from 'react';
import { useStore } from '../store';
import { useChain, useDerived } from './derived';
import { layoutUnifilar } from '../unifilar/layout';
import { Symbol, symbolSize } from '../unifilar/symbols';
import { usePanZoom } from './usePanZoom';

export function UnifilarView() {
  const project = useStore((s) => s.project);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const fileName = useStore((s) => s.fileName);
  const t = useStore((s) => s.t);
  const setMeta = useStore((s) => s.setMeta);
  const { labelFn, byNode } = useDerived();
  const chain = useChain();
  const inChain = (id?: string) => (id && chain.has(id) && id !== selectedId ? ' chain' : '');
  const up = project.meta.unifilarDirection !== 'down';

  const layout = useMemo(() => layoutUnifilar(project.roots, labelFn, { up }), [project.roots, labelFn, up]);
  const pz = usePanZoom({ w: layout.w, h: layout.h }, fileName + '|' + project.roots[0]?.id + '|' + up);

  // Lien plan ↔ unifilaire : centrer sur l'élément sélectionné
  useEffect(() => {
    if (!selectedId) return;
    const p = layout.pos.get(selectedId);
    if (p) pz.reveal(p.x, p.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div className="canvas-wrap">
      <div className="canvas-tools">
        <button onClick={pz.fit}>{t('action.zoomFit')}</button>
        <button onClick={() => setMeta({ unifilarDirection: up ? 'down' : 'up' })} title={t(up ? 'unifilar.dirDown' : 'unifilar.dirUp')}>
          {t(up ? 'unifilar.dirUp' : 'unifilar.dirDown')}
        </button>
      </div>
      <svg
        ref={pz.svgRef}
        className={'canvas unifilar' + (selectedId ? ' has-sel' : '') + (pz.panning ? ' panning' : '')}
        viewBox={`${pz.vb.x} ${pz.vb.y} ${pz.vb.w} ${pz.vb.h}`}
        onPointerDown={(e) => pz.onPointerDown(e, true)}
        onPointerMove={pz.onPointerMove}
        onPointerUp={(e) => {
          const moved = pz.onPointerUp();
          if (!moved && (e.target as Element).getAttribute('data-bg') === '1') select(null);
        }}
      >
        <rect data-bg="1" x={pz.vb.x - 1e5} y={pz.vb.y - 1e5} width={2e5 + pz.vb.w} height={2e5 + pz.vb.h} className="canvas-bg" />
        {layout.prims.map((p, i) => {
          switch (p.t) {
            case 'line':
              return <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} className={'wire' + (p.n && chain.has(p.n) ? ' chain' : '')} style={p.w ? { strokeWidth: p.w } : undefined} />;
            case 'bus':
              return (
                <g key={i} className={'hit' + (p.node.id === selectedId ? ' selected' : '') + inChain(p.node.id)} onClick={() => select(p.node.id)}>
                  <line x1={p.x1} y1={p.y} x2={p.x2} y2={p.y} className="bus" />
                  <rect x={p.x1} y={p.y - 6} width={p.x2 - p.x1} height={12} className="hitbox" />
                </g>
              );
            case 'text':
              return (
                <text
                  key={i}
                  x={p.x}
                  y={p.y}
                  fontSize={p.size ?? 10}
                  textAnchor={p.anchor ?? 'start'}
                  className={(p.bold ? 'bold ' : '') + (p.muted ? 'muted ' : '') + (p.nodeId === selectedId ? 'sel-text' : '') + inChain(p.nodeId)}
                  onClick={p.nodeId ? () => select(p.nodeId!) : undefined}
                  style={p.nodeId ? { cursor: 'pointer' } : undefined}
                >
                  {p.text}
                </text>
              );
            case 'sym': {
              const s = symbolSize(p.node, p.orient);
              const fs = byNode.get(p.node.id);
              const sev = fs?.some((f) => f.severity === 'error') ? 'error' : fs?.some((f) => f.severity === 'warning') ? 'warning' : null;
              const box = p.orient === 'v' ? { x: -s.w / 2 - 4, y: 0, w: s.w + 8, h: s.h } : { x: -2, y: -s.h / 2 - 2, w: s.w + 4, h: s.h + 4 };
              return (
                <g
                  key={i}
                  transform={`translate(${p.x},${p.y})`}
                  className={'hit sym' + (p.node.id === selectedId ? ' selected' : '') + inChain(p.node.id)}
                  onClick={() => select(p.node.id)}
                >
                  <rect x={box.x} y={box.y} width={box.w} height={box.h} className="hitbox" />
                  <Symbol node={p.node} orient={p.orient} />
                  {sev && <circle cx={box.x + box.w} cy={box.y} r={4} className={'mark ' + sev} />}
                </g>
              );
            }
          }
        })}
      </svg>
    </div>
  );
}
