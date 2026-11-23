import { useStore } from '../store';
import { useDerived } from './derived';
import type { Finding } from '../rules';
import { ancestors } from '../model/tree';
import { calcProject } from '../calc/electrical';
import { fmtNum } from './labels';

function paramsText(f: Finding, t: (k: string) => string): Record<string, string | number> {
  const p: Record<string, string | number> = { ...(f.params ?? {}) };
  if (typeof p.appliance === 'string') p.appliance = t('enum.applianceType.' + p.appliance);
  if (typeof p.reason === 'string') {
    const k = p.reason === 'wetRoom' ? 'reason.wetRoom' : 'enum.applianceType.' + p.reason;
    p.reason = t(k);
  }
  return p;
}

export function FindingItem({ f, compact }: { f: Finding; compact?: boolean }) {
  const t = useStore((s) => s.t);
  const select = useStore((s) => s.select);
  const setView = useStore((s) => s.setView);
  const { numbering, find, labelFn } = useDerived();
  const roots = useStore((s) => s.project.roots);
  const node = f.nodeId ? find(f.nodeId) : undefined;
  // Pour une canalisation, on nomme le circuit qui l'alimente.
  const circuit = node?.kind === 'cable' ? [...ancestors(roots, node.id)].reverse().find((a) => a.kind === 'protection') : undefined;
  const advice = t('advice.' + f.ruleId);
  return (
    <div
      className={'finding ' + f.severity + (node && !compact ? ' clickable' : '')}
      onClick={
        node && !compact
          ? () => {
              select(node.id);
              setView('unifilar');
            }
          : undefined
      }
    >
      <div className="finding-head">
        <span className={'badge ' + f.severity}>{t('severity.' + f.severity)}</span>
        {node && !compact && (
          <span className="finding-node">
            {circuit
              ? [t('kind.cable'), numbering.get(circuit.id), circuit.props.circuitName].filter(Boolean).join(' · ')
              : [numbering.get(node.id), node.kind === 'protection' ? node.props.circuitName : labelFn.title(node), node.location].filter(Boolean).join(' · ')}
          </span>
        )}
        <span className="rule-id">{f.ruleId}</span>
      </div>
      <div>{t('rule.' + f.ruleId, paramsText(f, t))}</div>
      {advice !== 'advice.' + f.ruleId && (
        <div className="advice">
          <strong>{t('check.advice')} :</strong> {advice}
        </div>
      )}
    </div>
  );
}

export function CheckPanel() {
  const t = useStore((s) => s.t);
  const project = useStore((s) => s.project);
  const { findings } = useDerived();
  const errors = findings.filter((f) => f.severity === 'error').length;
  const order = { error: 0, warning: 1, info: 2 };
  const sorted = [...findings].sort((a, b) => order[a.severity] - order[b.severity]);
  return (
    <div className="page-panel">
      <p className="muted small">{t('check.disclaimer')}</p>
      <p>
        <strong>{t('project.installationKind')} :</strong> {t('project.installationKind.' + project.meta.installationKind)} —{' '}
        {t('project.rgieVersion.' + project.meta.rgieVersion)}
      </p>
      {errors > 0 && <div className="banner error">{t('check.blocking', { n: errors })}</div>}
      {findings.length === 0 && <div className="banner ok">{t('check.ok')}</div>}
      {sorted.map((f, i) => (
        <FindingItem key={i} f={f} />
      ))}
      <CalcTable />
    </div>
  );
}

/** Chute de tension et court-circuit par circuit (src/calc/electrical.ts). */
function CalcTable() {
  const t = useStore((s) => s.t);
  const lang = useStore((s) => s.lang);
  const project = useStore((s) => s.project);
  const select = useStore((s) => s.select);
  const { numbering, find } = useDerived();
  const rows = calcProject(project);
  if (!rows.length) return null;
  const f = (v: number | undefined) => (v === undefined ? '—' : fmtNum(v, lang));
  return (
    <>
      <h3>{t('calc.title')}</h3>
      <p className="muted small">{t('calc.help')}</p>
      <table className="bom-table">
        <thead>
          <tr>
            <th />
            <th>{t('print.col.name')}</th>
            <th className="num">{t('calc.col.length')}</th>
            <th className="num">{t('calc.col.section')}</th>
            <th className="num">{t('calc.col.drop')}</th>
            <th className="num">{t('calc.col.icc')}</th>
            <th className="num">{t('calc.col.lmax')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const n = find(r.circuitId);
            const badDrop = r.dropPct !== undefined && r.dropPct > r.dropLimit;
            const badIcc = r.iccMin !== undefined && r.magnetic !== undefined && r.iccMin < r.magnetic;
            return (
              <tr key={r.circuitId} className="clickable" onClick={() => select(r.circuitId)}>
                <td className="b">{numbering.get(r.circuitId)}</td>
                <td>{String(n?.props.circuitName ?? '')}</td>
                <td className="num">{r.missingLength ? <span className="muted small">{t('calc.missing', { n: r.missingLength })}</span> : f(r.length)}</td>
                <td className="num">{f(r.section)}</td>
                <td className={'num' + (badDrop ? ' warn-text' : '')}>{f(r.dropPct)}</td>
                <td className={'num' + (badIcc ? ' warn-text' : '')}>{f(r.iccMin)}</td>
                <td className="num">{f(r.lmax)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
