import { useState } from 'react';
import { useStore } from '../store';
import { useDerived } from './derived';
import {
  checkedRuleCount,
  findRulePack,
  isDocumentary,
  isPhysicalNonCompliance,
  needsVerification,
  projectContext,
  type Finding,
  type FindingStatus,
  type SurveyFact,
} from '../rules';
import { ancestors } from '../model/tree';
import { calcProject, roundTo } from '../calc/electrical';
import { balanceProject, PHASES } from '../calc/balance';
import { fmtNum } from './labels';

type T = (k: string, p?: Record<string, string | number>) => string;

/** Paramètres d'un constat traduits pour l'affichage (contrôle et dossier imprimé). */
export function paramsText(f: Finding, t: (k: string) => string): Record<string, string | number> {
  const p: Record<string, string | number> = { ...(f.params ?? {}) };
  if (typeof p.fact === 'string') p.fact = t('survey.fact.' + p.fact);
  // Valeurs non confirmées ou contradictoires (assistant) : noms de propriétés lisibles
  if ((f.ruleId === 'R-UNCONFIRMED' || f.ruleId === 'R-CONTRADICTION') && typeof p.props === 'string')
    p.props = p.props
      .split(', ')
      .map((k) => (k === '@parent' ? t('assist.prop.parent') : k === '@node' ? t('knowledge.node') : t('prop.' + k)))
      .join(', ');
  if (typeof p.appliance === 'string') p.appliance = t('enum.applianceType.' + p.appliance);
  if (typeof p.reason === 'string') {
    const k = p.reason === 'wetRoom' ? 'reason.wetRoom' : 'enum.applianceType.' + p.reason;
    p.reason = t(k);
  }
  return p;
}

/**
 * Texte d'un constat selon l'état de connaissance (ADR-0007) : « rule.<id>.<knowledge> » s'il existe
 * (ex. terre inconnue, absence confirmée, contradiction), sinon « rule.<id> ».
 */
export function ruleText(f: Finding, t: T): string {
  const p = paramsText(f, t);
  if (f.knowledge) {
    const k = 'rule.' + f.ruleId + '.' + f.knowledge;
    const s = t(k, p);
    if (s !== k) return s;
  }
  return t('rule.' + f.ruleId, p);
}

/** Conseil d'un constat (variante selon l'état de connaissance), ou undefined. */
export function adviceText(f: Finding, t: T): string | undefined {
  for (const k of [f.knowledge ? 'advice.' + f.ruleId + '.' + f.knowledge : '', 'advice.' + f.ruleId]) {
    if (!k) continue;
    const s = t(k);
    if (s !== k) return s;
  }
  return undefined;
}

/** Libellé « bloquant » : pour une exigence documentaire, bloquant pour le dossier de réception seulement. */
export function blockingText(f: Finding, t: T): string {
  return f.blocking ? ' · ' + t(isDocumentary(f) ? 'status.blockingDoc' : 'status.blocking') : '';
}

/** État de connaissance affiché (rien pour une présence confirmée ou des données connues). */
export function knowledgeText(f: Finding, t: T): string {
  return f.knowledge && f.knowledge !== 'present' ? t('knowledge.' + f.knowledge) : '';
}

/** Ordre d'affichage des constats : bloquants d'abord, puis par statut. */
export const STATUS_ORDER: Record<FindingStatus, number> = {
  nonCompliant: 0,
  contradictory: 1,
  potential: 2,
  insufficientData: 3,
  notEvaluated: 4,
  warning: 5,
  manualCheck: 6,
  recommendation: 7,
  derogation: 8,
  notApplicable: 9,
};

export function findingRank(f: Finding): number {
  return (f.blocking ? 0 : 20) + STATUS_ORDER[f.status ?? 'warning'];
}

/** Boutons « Confirmer présent / Confirmer absent / Je ne sais pas » d'un fait du relevé (écrit meta.survey). */
function SurveyButtons({ fact }: { fact: SurveyFact }) {
  const t = useStore((s) => s.t);
  const survey = useStore((s) => s.project.meta.survey);
  const setMeta = useStore((s) => s.setMeta);
  const cur = survey?.[fact];
  const set = (v: 'present' | 'absent' | undefined) => (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = { ...(survey ?? {}) };
    if (v) next[fact] = v;
    else delete next[fact];
    setMeta({ survey: Object.keys(next).length ? next : undefined });
  };
  return (
    <>
      <button className={cur === 'present' ? 'primary' : undefined} aria-pressed={cur === 'present'} onClick={set('present')}>
        {t('survey.present')}
      </button>
      <button className={cur === 'absent' ? 'primary' : undefined} aria-pressed={cur === 'absent'} onClick={set('absent')}>
        {t('survey.absent')}
      </button>
      <button aria-pressed={!cur} onClick={set(undefined)}>
        {t('survey.unknown')}
      </button>
    </>
  );
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
  const advice = adviceText(f, t);
  const knowledge = knowledgeText(f, t);
  const knowledgeHelp = f.knowledge ? t('knowledge.help.' + f.knowledge) : '';
  const pageOf = node ? project.plan.pages.findIndex((pg) => pg.symbols.some((s) => s.nodeId === node.id)) : -1;
  const inBoard = !!node && Object.values(project.boards ?? {}).some((b) => b.slots[node.id]);
  const go = (view: 'unifilar' | 'plan' | 'board') => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!node) return;
    select(node.id);
    if (view === 'plan' && pageOf >= 0) useStore.getState().setPage(pageOf);
    setView(view);
  };
  const canDerogate = !compact && (f.status === 'nonCompliant' || f.status === 'recommendation' || f.status === 'warning' || f.status === 'potential');
  // Fait du relevé non dessiné (terre, différentiels) : l'utilisateur confirme ce qu'il a constaté sur place.
  const survey = !compact && f.fact ? f.fact : undefined;
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
          {blockingText(f, t)}
        </span>
        {knowledge && (
          <em className="muted small" title={knowledgeHelp !== 'knowledge.help.' + f.knowledge ? knowledgeHelp : undefined}>
            {knowledge}
          </em>
        )}
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
        {ruleText(f, t)}
        {f.inferred && f.knowledge !== 'deduced' && <em className="muted"> ({t('check.inferred')})</em>}
      </div>
      {f.derogation ? (
        <div className="advice">
          <strong>{t('status.derogation')} :</strong> {f.derogation.reason}
          {f.derogation.reference ? ' (' + f.derogation.reference + ')' : ''}
        </div>
      ) : (
        (advice || (knowledgeHelp && knowledgeHelp !== 'knowledge.help.' + f.knowledge)) && (
          <div className="advice">
            <strong>{t('check.advice')} :</strong> {advice ?? knowledgeHelp}
          </div>
        )
      )}
      {!compact && (node || canDerogate || survey) && (
        <div className="finding-actions" onClick={(e) => e.stopPropagation()}>
          {survey && <SurveyButtons fact={survey} />}
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
  const nc = findings.filter(isPhysicalNonCompliance).length;
  const verify = findings.filter(needsVerification).length;
  const sorted = [...findings].sort((a, b) => findingRank(a) - findingRank(b));
  // Exigences de l'installation d'abord, puis exigences documentaires (jamais des non-conformités physiques).
  const groups = [
    { key: 'physical', list: sorted.filter((f) => !isDocumentary(f)) },
    { key: 'documentary', list: sorted.filter(isDocumentary) },
  ].filter((g) => g.list.length);
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
      {findings.length === 0 && <div className="banner ok">{t('check.okN', { n: checkedRuleCount(project) })}</div>}
      {findings.length > 0 && (
        <p className="muted small">
          {t('check.summary', { blocking, nc, other: findings.length - nc })}
          <br />
          {t('check.counts', { nc, verify, doc: findings.filter(isDocumentary).length })}
        </p>
      )}
      {groups.map((g) => (
        <section key={g.key}>
          <h3>{t('requirement.' + g.key)}</h3>
          {g.key === 'documentary' && <p className="muted small">{t('requirement.documentary.help')}</p>}
          {g.list.map((f, i) => (
            <FindingItem key={i} f={f} />
          ))}
        </section>
      ))}
      <p className="muted small">{t('check.liability')}</p>
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
