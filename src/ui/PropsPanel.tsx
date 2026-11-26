import { useState } from 'react';
import { AddMenu } from './AddMenu';
import { useStore } from '../store';
import { useDerived } from './derived';
import { ALLOWED_CHILDREN, PROP_SCHEMAS, type PropDef } from '../model/schema';
import type { ElNode, PropValue } from '../model/types';
import { FindingItem } from './CheckPanel';
import { getRulePack } from '../rules';
import { isModularInBoard } from '../board/model';
import { PV_STUDY_URL } from '../brand';

function Field({ def, node }: { def: PropDef; node: ElNode }) {
  const t = useStore((s) => s.t);
  const setProps = useStore((s) => s.setProps);
  const ruleset = useStore((s) => s.project.meta.ruleset);
  const value = node.props[def.key];
  const set = (v: PropValue) => setProps(node.id, { [def.key]: v });
  const label = t('prop.' + def.key) + (def.unit ? ` (${def.unit})` : '');
  let input: JSX.Element;
  switch (def.type) {
    case 'bool':
      // « Dans le tableau » : valeur réellement utilisée (par défaut selon le type d'élément si absente)
      input = <input type="checkbox" checked={def.key === 'inBoard' ? isModularInBoard(node) : value === true} onChange={(e) => set(e.target.checked)} />;
      break;
    case 'number':
      input = (
        <input
          type="number"
          step="any"
          value={value === undefined ? '' : String(value)}
          onChange={(e) => set(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      );
      break;
    case 'enum': {
      // Un référentiel national peut fournir ses propres listes (ex. désignations des câbles).
      const opts = getRulePack(ruleset).options?.[def.key] ?? def.options ?? [];
      const known = value === undefined || opts.includes(String(value));
      input = (
        <select value={value === undefined ? '' : String(value)} onChange={(e) => set(e.target.value || undefined)}>
          <option value="">—</option>
          {!known && <option value={String(value)}>{String(value)}</option>}
          {opts.filter(Boolean).map((o) => {
            const key = `enum.${def.key}.${o}`;
            const tr = t(key);
            return (
              <option key={o} value={o}>
                {tr === key ? o : tr}
              </option>
            );
          })}
        </select>
      );
      break;
    }
    default:
      input = <input type="text" value={value === undefined ? '' : String(value)} onChange={(e) => set(e.target.value)} />;
  }
  return (
    <label className={'field' + (def.type === 'bool' ? ' bool' : '')}>
      <span>{label}</span>
      {input}
    </label>
  );
}

export function PropsPanel() {
  const selectedId = useStore((s) => s.selectedId);
  const project = useStore((s) => s.project);
  const t = useStore((s) => s.t);
  const view = useStore((s) => s.view);
  const { setLocation, remove, duplicate, move, setView, startPlacing, insertSeries } = useStore.getState();
  const { find, numbering, byNode, labelFn } = useDerived();
  const node = selectedId ? find(selectedId) : undefined;
  const [adding, setAdding] = useState<{ x: number; y: number } | null>(null);
  if (!node) return <div className="props empty">{t('panel.nothingSelected')}</div>;

  const placed = project.plan.pages.some((p) => p.symbols.some((s) => s.nodeId === node.id));
  const ref = numbering.get(node.id);
  const findings = byNode.get(node.id) ?? [];
  const canHaveSymbol = node.kind !== 'cable' && node.kind !== 'origin';

  return (
    <div className="props">
      <div className="props-head">
        {ALLOWED_CHILDREN[node.kind].length > 0 && (
          <button
            className="primary add-btn"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setAdding({ x: r.left, y: r.bottom + 4 });
            }}
          >
            ＋ {t('add.button')}
          </button>
        )}
        {adding && <AddMenu node={node} at={adding} onClose={() => setAdding(null)} />}
        <strong>{t('kind.' + node.kind)}</strong>
        {ref && <span className="ref">{ref}</span>}
        {node.kind !== 'protection' && labelFn.title(node) !== t('kind.' + node.kind) && <span className="title">{labelFn.title(node)}</span>}
      </div>

      {findings.length > 0 && (
        <div className="props-findings">
          {findings.map((f, i) => (
            <FindingItem key={i} f={f} compact />
          ))}
        </div>
      )}

      {(PROP_SCHEMAS[node.kind] ?? []).map((d) => (
        <Field key={d.key} def={d} node={node} />
      ))}
      {(node.kind === 'solarPanel' || node.kind === 'inverter' || node.kind === 'battery') && (
        <p className="hint pv-study">
          <a href={PV_STUDY_URL} target="_blank" rel="noopener noreferrer">
            {t('pv.study')} ↗
          </a>
          <br />
          <span className="muted small">{t('pv.studyHelp')}</span>
        </p>
      )}
      {node.kind !== 'origin' && (
        <label className="field">
          <span>{t('field.location')}</span>
          <input type="text" value={node.location ?? ''} onChange={(e) => setLocation(node.id, e.target.value)} />
        </label>
      )}

      <div className="props-actions">
        <div className="row">
          <button onClick={() => move(node.id, -1)} title={t('action.moveUp')}>
            ↑
          </button>
          <button onClick={() => move(node.id, 1)} title={t('action.moveDown')}>
            ↓
          </button>
          {node.kind !== 'origin' && <button onClick={() => duplicate(node.id)}>{t('action.duplicate')}</button>}
          {node.kind === 'protection' && (
            <button onClick={() => insertSeries(node.id)} title={t('action.insertSeriesHelp')}>
              {t('action.insertSeries')}
            </button>
          )}
          {node.kind !== 'origin' && (
            <button className="danger" onClick={() => remove(node.id)}>
              {t('action.delete')}
            </button>
          )}
        </div>
        {canHaveSymbol && (
          <div className="row">
            {placed ? (
              view !== 'plan' ? (
                <button onClick={() => setView('plan')}>{t('action.showOnPlan')}</button>
              ) : (
                <button onClick={() => setView('unifilar')}>{t('action.showOnUnifilar')}</button>
              )
            ) : (
              <>
                <span className="muted small">{t('plan.notPlaced')}</span>
                <button
                  onClick={() => {
                    setView('plan');
                    startPlacing(node.id);
                  }}
                >
                  {t('action.placeOnPlan')}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
