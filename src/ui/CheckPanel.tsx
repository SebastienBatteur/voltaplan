import { useState } from 'react';
import { useStore } from '../store';
import { useDerived } from './derived';
import { findRulePack, projectContext, type Finding, type FindingStatus } from '../rules';
import { ancestors } from '../model/tree';
import { calcProject, roundTo } from '../calc/electrical';
import { balanceProject, PHASES } from '../calc/balance';
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

/** Ordre d'affichage des constats : bloquants d'abord, puis par statut. */
const STATUS_ORDER: Record<FindingStatus, number> = {
  nonCompliant: 0,
  insufficientData: 1,
  warning: 2,
  manualCheck: 3,
  recommendation: 4,
  derogation: 5,
  notApplicable: 6,
};

export function findingRank(f: Finding): number {
  return (f.blocking ? 0 : 10) + STATUS_ORDER[f.status ?? 'warning'];
}

export function FindingItem({ f, compact }: { f: Finding; compact?: boolean }) {
  const t = useStore((s) => s.t);
  const select = useStore((s) => s.select);
  const setView = useStore((s) => s.setView);
  const setMeta = useStore((s) => s.setMeta);
  const project = useStore((s) => s.project);
  const { numbering, find, labelFn } = useDerived();
  const [derog, setDerog] = useState<{ reason: string; reference: string } | null>(null);
  const node = f.nodeId ? find(f.nodeId) : undefined;
  // Pour une canalisation, on nomme le circuit qui l'alimente.
  const circuit = node?.kind === 'cable' ? [...ancestors(project.roots, node.id)].reverse().find((a) => a.kind === 'protection') : undefined;
  const advice = t('advice.' + f.ruleId);
  const pageOf = node ? project.plan.pages.findIndex((pg) => pg.symbols.some((s) => s.nodeId === node.id)) : -1;
  const inBoard = !!node && Object.values(project.boards ?? {}).some((b) => b.slots[node.id]);
  const go = (view: 'unifilar' | 'plan' | 'board') => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!node) return;
    select(node.id);
    if (view === 'plan' && pageOf >= 0) useStore.getState().setPage(pageOf);
    setView(view);
  };
  const canDerogate = !compact && (f.status === 'nonCompliant' || f.status === 'recommendation' || f.status === 'warning');
  const saveDerogation = () => {
    if (!derog?.reason.trim()) return;
    const list = project.meta.derogations ?? [];
    setMeta({ derogations: [...list, { ruleId: f.ruleId, nodeId: f.nodeId, reason: derog.reason.trim(), reference: derog.reference.trim() || undefined }] });
    setDerog(null);
  };
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
        <span className={'badge ' + f.severity}>
          {t('status.' + (f.status ?? 'warning'))}
          {f.blocking ? ' · ' + t('status.blocking') : ''}
        </span>
        {f.hazard && f.hazard !== 'none' && f.status !== 'derogation' && <span className={'hazard ' + f.hazard}>{t('hazard.' + f.hazard)}</span>}
        {node && !compact && (
          <span className="finding-node">
            {circuit
              ? [t('kind.cable'), numbering.get(circuit.id), circuit.props.circuitName].filter(Boolean).join(' · ')
              : [numbering.get(node.id), node.kind === 'protection' ? node.props.circuitName : labelFn.title(node), node.location].filter(Boolean).join(' · ')}
          </span>
        )}
        <span className="rule-id">{f.ruleId}</span>
      </div>
      <div>
        {t('rule.' + f.ruleId, paramsText(f, t))}
        {f.inferred && <em className="muted"> ({t('check.inferred')})</em>}
      </div>
      {f.derogation ? (
        <div className="advice">
          <strong>{t('status.derogation')} :</strong> {f.derogation.reason}
          {f.derogation.reference ? ' (' + f.derogation.reference + ')' : ''}
        </div>
      ) : (
        advice !== 'advice.' + f.ruleId && (
          <div className="advice">
            <strong>{t('check.advice')} :</strong> {advice}
          </div>
        )
      )}
      {!compact && (node || canDerogate) && (
        <div className="finding-actions" onClick={(e) => e.stopPropagation()}>
          {node && <button onClick={go('unifilar')}>{t('check.goUnifilar')}</button>}
          {pageOf >= 0 && <button onClick={go('plan')}>{t('check.goPlan')}</button>}
          {inBoard && <button onClick={go('board')}>{t('check.goBoard')}</button>}
          {canDerogate && !derog && <button onClick={() => setDerog({ reason: '', reference: '' })}>{t('check.derogate')}</button>}
        </div>
      )}
      {derog && (
        <form
          className="derogation-form"
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            saveDerogation();
          }}
        >
          <input autoFocus required placeholder={t('check.derogationReason')} value={derog.reason} onChange={(e) => setDerog({ ...derog, reason: e.target.value })} />
          <input placeholder={t('check.derogationRef')} value={derog.reference} onChange={(e) => setDerog({ ...derog, reference: e.target.value })} />
          <div className="row">
            <button type="submit" className="primary" disabled={!derog.reason.trim()}>
              {t('check.derogationSave')}
            </button>
            <button type="button" onClick={() => setDerog(null)}>
              {t('action.cancel')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function CheckPanel() {
  const t = useStore((s) => s.t);
  const lang = useStore((s) => s.lang);
  const project = useStore((s) => s.project);
  const setMeta = useStore((s) => s.setMeta);
  const { findings, numbering } = useDerived();
  const blocking = findings.filter((f) => f.blocking).length;
  const nc = findings.filter((f) => f.status === 'nonCompliant').length;
  const sorted = [...findings].sort((a, b) => findingRank(a) - findingRank(b));
  const pack = findRulePack(project.meta.ruleset);
  const edition = pack?.editions?.find((e) => e.id === projectContext(project, pack).edition);
  const derogations = project.meta.derogations ?? [];
  return (
    <div className="page-panel">
      <p className="muted small">{t('check.disclaimer')}</p>
      <p>
        <strong>{t('project.installationKind')} :</strong> {t('project.installationKind.' + project.meta.installationKind)}
        {edition && <> — {t('check.edition', { edition: edition.label[lang] ?? edition.label.en ?? edition.id })}</>}
      </p>
      {blocking > 0 && <div className="banner error">{t('check.blocking', { n: blocking })}</div>}
      {findings.length === 0 && <div className="banner ok">{t('check.ok')}</div>}
      {findings.length > 0 && <p className="muted small">{t('check.summary', { blocking, nc, other: findings.length - nc })}</p>}
      {sorted.map((f, i) => (
        <FindingItem key={i} f={f} />
      ))}
      {derogations.length > 0 && (
        <>
          <h3>{t('check.derogations')}</h3>
          <ul className="derogation-list">
            {derogations.map((d, i) => (
              <li key={i}>
                <span className="rule-id">{d.ruleId}</span> {d.nodeId ? numbering.get(d.nodeId) ?? '' : ''} — {d.reason}
                {d.reference ? ' (' + d.reference + ')' : ''}{' '}
                <button onClick={() => setMeta({ derogations: derogations.filter((_, j) => j !== i) })}>{t('check.derogationRemove')}</button>
              </li>
            ))}
          </ul>
        </>
      )}
      <CalcTable />
    </div>
  );
}

/** Chute de tension et court-circuit par circuit (src/calc/electrical.ts) ; valeurs brutes arrondies ici seulement. */
function CalcTable() {
  const t = useStore((s) => s.t);
  const lang = useStore((s) => s.lang);
  const project = useStore((s) => s.project);
  const select = useStore((s) => s.select);
  const { numbering, find } = useDerived();
  const rows = calcProject(project);
  if (!rows.length) return null;
  const f = (v: number | undefined, d = 2) => (v === undefined ? '—' : fmtNum(roundTo(v, d), lang));
  const over = (v: number | undefined, max: number) => (v !== undefined && v > max ? ' warn-text' : '');
  const assumptions = [...new Set(rows.flatMap((r) => r.assumptions))];
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
            <th className="num">{t('calc.col.dropTotal')}</th>
            <th className="num">{t('calc.col.dropDetailed')}</th>
            <th className="num">{t('calc.col.icc')}</th>
            <th className="num">{t('calc.col.lmax')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const n = find(r.circuitId);
            const badIcc = r.iccMin !== undefined && r.magnetic !== undefined && r.iccMin < r.magnetic;
            const detailed = r.detailedTotalDropPct ?? r.detailedDropPct;
            return (
              <tr key={r.circuitId} className="clickable" onClick={() => select(r.circuitId)}>
                <td className="b">{numbering.get(r.circuitId)}</td>
                <td>{String(n?.props.circuitName ?? '')}</td>
                <td className="num">{r.missingLength ? <span className="muted small">{t('calc.missing', { n: r.missingLength })}</span> : f(r.length, 1)}</td>
                <td className="num">{f(r.section)}</td>
                <td className={'num' + over(r.dropPct, r.dropLimit)}>{f(r.dropPct)}</td>
                <td
                  className={'num' + over(r.totalDropPct, r.dropLimit)}
                  title={r.upstreamDropPct !== undefined ? `${t('calc.col.dropUp')} ${f(r.upstreamDropPct)}` : undefined}
                >
                  {r.upstreamMissing ? <span className="muted small">{t('calc.upMissing')}</span> : f(r.totalDropPct)}
                </td>
                <td className={'num' + over(detailed, r.dropLimit)}>{f(detailed)}</td>
                <td className={'num' + (badIcc ? ' warn-text' : '')}>{f(r.iccMin, 0)}</td>
                <td className="num">{f(r.lmax, 1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {assumptions.length > 0 && (
        <p className="muted small">
          {t('calc.assumptions')} : {assumptions.map((a) => t('calc.assumption.' + a)).join(' ; ')}.
        </p>
      )}
      <BalanceTable />
    </>
  );
}

/** Bilan de puissance et équilibre des phases par tableau (src/calc/balance.ts). */
function BalanceTable() {
  const t = useStore((s) => s.t);
  const lang = useStore((s) => s.lang);
  const project = useStore((s) => s.project);
  const { numbering, find } = useDerived();
  const rows = balanceProject(project).filter((b) => b.installedW > 0 || b.unknownLoads > 0);
  if (!rows.length) return null;
  const kw = (w: number | undefined) => (w === undefined ? '—' : fmtNum(roundTo(w / 1000, 2), lang));
  const showDemand = rows.some((b) => b.demandW !== undefined);
  return (
    <>
      <h3>{t('balance.title')}</h3>
      <p className="muted small">{t('balance.help')}</p>
      <table className="bom-table">
        <thead>
          <tr>
            <th>{t('balance.col.board')}</th>
            <th className="num">{t('balance.col.installed')}</th>
            {showDemand && <th className="num">{t('balance.col.demand')}</th>}
            {PHASES.map((p) => (
              <th key={p} className="num">
                {p}
              </th>
            ))}
            <th className="num">{t('balance.col.imbalance')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const board = b.boardId ? find(b.boardId) : undefined;
            const name = board ? String(board.props.name || numbering.get(board.id) || t('kind.board')) : t('balance.noBoard');
            const notes = [
              b.unassignedW > 0 ? t('balance.unassigned', { p: kw(b.unassignedW) }) : '',
              b.unknownLoads > 0 ? t('balance.unknown', { n: b.unknownLoads }) : '',
            ].filter(Boolean);
            return (
              <tr key={b.boardId ?? '-'}>
                <td>
                  {name}
                  {notes.length > 0 && <div className="muted small">{notes.join(' ; ')}</div>}
                </td>
                <td className="num">{kw(b.installedW)}</td>
                {showDemand && <td className="num">{kw(b.demandW)}</td>}
                {PHASES.map((p) => (
                  <td key={p} className="num">
                    {kw(b.perPhase[p])}
                  </td>
                ))}
                <td className="num">{b.imbalancePct === undefined ? '—' : fmtNum(roundTo(b.imbalancePct, 0), lang)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
