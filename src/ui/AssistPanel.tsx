import { useState } from 'react';
import { useStore } from '../store';
import {
  answer,
  answerGroup,
  answerUsage,
  bulkAcceptable,
  decide,
  deferQuestions,
  needsReview,
  questionReady,
  snapshotSurvey,
  splitGroup,
  surveyFrozen,
  type ProposalEdit,
} from '../assist/apply';
import { boardOfTempKey } from '../assist/boardDraft';
import type { Evidence, Proposal, Question } from '../assist/evidence';
import type { PropValue } from '../model/types';
import { APPLIANCE_TYPES } from '../model/schema';
import { useModalDialog } from './a11y';

/**
 * Assistant : parcours simple, en 4 étapes, pour un électricien qui n'aime pas l'informatique.
 *  1. accepter d'un coup ce qui est sûr ;
 *  2. vérifier une par une les propositions critiques ou incertaines (différentiels, raccordements devinés), en
 *     corrigeant au besoin la valeur proposée (calibre, courbe, usage, pièce, différentiel amont) avant d'accepter ;
 *  3. répondre aux questions (ou « je ne sais pas », ou « tout à vérifier plus tard ») ;
 *  4. figer le relevé, puis lancer le contrôle RGIE si on le souhaite.
 * Rien n'est appliqué sans un clic ; chaque clic est une seule étape d'annulation (Ctrl+Z).
 */
export function AssistPanel({ onClose }: { onClose: () => void }) {
  const t = useStore((s) => s.t);
  const project = useStore((s) => s.project);
  const { applyProject, setView } = useStore.getState();
  const ev = project.evidence;
  const bulk = bulkAcceptable(ev);
  const review = needsReview(ev);
  // Probables et non critiques (ex. usage déduit d'une étiquette) : acceptables ensemble, mais restent « non confirmées »
  const probable = review.filter((p) => !p.critical && p.confidence >= 0.5);
  const pendingTotal = ev?.proposals.filter((p) => p.status === 'pending').length ?? 0;
  const pendingIds = new Set(ev?.proposals.filter((p) => p.status === 'pending').map((p) => p.id));
  const open = (ev?.questions ?? []).filter((q) => q.status === 'open');
  const deferred = open.filter((q) => q.deferred);
  // Question liée à une proposition encore à vérifier : réglée par cette vérification, pas posée deux fois
  const answerable = open
    .filter((q) => !q.deferred && questionReady(project, q) && !(q.about.proposalId && pendingIds.has(q.about.proposalId)))
    .sort((a, b) => rank(a) - rank(b) || (b.members?.length ?? 1) - (a.members?.length ?? 1));
  const waiting = open.length - deferred.length - answerable.length;
  const frozen = surveyFrozen(project);

  const tr = useTr();
  const text = (p: Proposal) => tr(p.text.key, p.text.params);

  if (!ev || (!pendingTotal && !open.length && frozen)) {
    return (
      <Shell t={t} onClose={onClose}>
        <p>{ev ? t('assist.allDone') : t('assist.empty')}</p>
        {ev && (
          <button className="primary" onClick={() => (setView('check'), onClose())}>
            {t('assist.runCheck')}
          </button>
        )}
      </Shell>
    );
  }

  return (
    <Shell t={t} onClose={onClose}>
      <p className="muted small">{t('assist.intro')}</p>

      <h3>1. {t('assist.step.bulk')}</h3>
      {bulk.length ? (
        <p>
          {t('assist.bulkCount', { n: bulk.length })}{' '}
          <button className="primary" onClick={() => applyProject((p) => decide(p, { accept: bulk.map((x) => x.id) }))}>
            {t('assist.acceptAll', { n: bulk.length })}
          </button>
        </p>
      ) : (
        <p className="muted small">{review.length ? t('assist.bulkAfterReview') : t('assist.bulkNone')}</p>
      )}

      <h3>2. {t('assist.step.review')}</h3>
      {probable.length > 1 && (
        <p>
          {t('assist.probableCount', { n: probable.length })}{' '}
          <button onClick={() => applyProject((p) => decide(p, { accept: probable.map((x) => x.id) }))}>{t('assist.acceptProbable', { n: probable.length })}</button>
        </p>
      )}
      {review.length ? (
        <ul className="assist-list">
          {review.map((p) => (
            <ProposalRow key={p.id} p={p} ev={ev} text={text(p)} />
          ))}
        </ul>
      ) : (
        <p className="muted small">{t('assist.reviewNone')}</p>
      )}

      <h3>3. {t('assist.step.questions')}</h3>
      {answerable.length ? (
        <>
          <ul className="assist-list">
            {answerable.slice(0, 30).map((q) => (
              <QuestionRow key={q.id} q={q} ev={ev} />
            ))}
          </ul>
          <p>
            <button onClick={() => applyProject((p) => deferQuestions(p))} title={t('assist.deferHelp')}>
              {t('assist.deferAll')}
            </button>
          </p>
        </>
      ) : (
        <p className="muted small">{t('assist.questionsNone')}</p>
      )}
      {answerable.length > 30 && <p className="muted small">{t('assist.moreQuestions', { n: answerable.length - 30 })}</p>}
      {waiting > 0 && <p className="muted small">{t('assist.questionsWaiting', { n: waiting })}</p>}
      {deferred.length > 0 && (
        <p className="muted small">
          {t('assist.deferredCount', { n: deferred.length })}{' '}
          <button className="link" onClick={() => applyProject((p) => deferQuestions(p, true))}>
            {t('assist.resume')}
          </button>
        </p>
      )}

      <h3>4. {t('assist.step.freeze')}</h3>
      <p className="muted small">{t('assist.freezeHelp')}</p>
      <div className="row">
        <button
          disabled={frozen}
          onClick={() => applyProject((p) => snapshotSurvey(p, t('assist.surveyDesc', { date: new Date().toLocaleDateString() })))}
          title={pendingTotal ? t('assist.freezePending', { n: pendingTotal }) : undefined}
        >
          {frozen ? t('assist.frozen') : t('assist.freeze')}
        </button>
        <button className="primary" onClick={() => (setView('check'), onClose())}>
          {t('assist.runCheck')}
        </button>
      </div>
    </Shell>
  );
}

const rank = (q: Question) => (q.priority === 'high' ? 0 : q.priority === 'normal' ? 1 : 2);
const DEVICES = ['mcb', 'rcd', 'rcbo', 'fuse', 'switch'];
const USAGE_KINDS = ['socket', 'light', 'bell', 'motor', 'board'];

/** Traduction des textes de l'assistant (paramètres : types d'appareils, usages, propriétés traduits). */
function useTr() {
  const t = useStore((s) => s.t);
  const what = (k: string) => (DEVICES.includes(k) ? t('enum.device.' + k) : t('assist.kind.' + k));
  const usage = (u: string) => (USAGE_KINDS.includes(u) ? t('kind.' + u) : t('enum.applianceType.' + u));
  return (key: string, p?: Record<string, string | number>) => {
    const params = { ...(p ?? {}) } as Record<string, string | number>;
    if (typeof params.what === 'string') params.what = what(params.what);
    if (typeof params.usage === 'string') params.usage = usage(params.usage);
    if (typeof params.prop === 'string') params.prop = t('prop.' + params.prop);
    return t(key, params);
  };
}

/** Photos d'où vient une proposition (« Photo du tableau, Photo du tableau 2 »). */
function sourcesOf(ev: Evidence, obsIds: string[]): string {
  const src = new Set(ev.observations.filter((o) => obsIds.includes(o.id) && o.kind === 'reading').map((o) => o.region.sourceId));
  return ev.sources
    .filter((s) => src.has(s.id))
    .map((s) => s.label)
    .join(', ');
}

/** Différentiels du même tableau vers lesquels un circuit peut être déplacé (proposés ou déjà acceptés). */
function rcdChoices(ev: Evidence, p: Proposal): { ref: { tempKey: string } | { nodeId: string }; label: string }[] {
  if (p.change.op !== 'createNode') return [];
  const board = boardOfTempKey(p.change.tempKey);
  const out: { ref: { tempKey: string } | { nodeId: string }; label: string }[] = [];
  for (const x of ev.proposals) {
    if (x.change.op !== 'createNode' || x.change.kind !== 'protection' || x.change.props.device !== 'rcd' || boardOfTempKey(x.change.tempKey) !== board) continue;
    if (x.status === 'pending') out.push({ ref: { tempKey: x.change.tempKey }, label: rcdLabel(x) });
    else if (x.status === 'accepted' && x.createdNodeId) out.push({ ref: { nodeId: x.createdNodeId }, label: rcdLabel(x) });
  }
  if (board) out.push({ ref: { nodeId: board }, label: '' });
  return out;
}
const rcdLabel = (x: Proposal) => {
  if (x.change.op !== 'createNode') return '';
  const c = x.change.props;
  const at = x.text.params?.where ?? '';
  return [c.residualCurrent ? `${c.residualCurrent} mA` : '', c.ratedCurrent ? `${c.ratedCurrent} A` : '', at ? `(${at})` : ''].filter(Boolean).join(' ');
};

/** Une proposition à vérifier : accepter tel quel, corriger puis accepter, ou refuser. */
function ProposalRow({ p, ev, text }: { p: Proposal; ev: Evidence; text: string }) {
  const t = useStore((s) => s.t);
  const { applyProject } = useStore.getState();
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<ProposalEdit>({});
  const c = p.change;
  const src = sourcesOf(ev, p.observations);
  const isProt = c.op === 'createNode' && c.kind === 'protection';
  const isUse = c.op === 'createNode' && c.kind !== 'protection' && c.kind !== 'cable';
  const editable = isProt || isUse || c.op === 'setProp';
  const device = c.op === 'createNode' ? String(c.props.device ?? '') : '';
  const val = (k: string) => (edit.props && k in edit.props ? edit.props[k] : c.op === 'createNode' ? c.props[k] : undefined);
  const setProp = (k: string, v: PropValue | null) => setEdit((e) => ({ ...e, props: { ...e.props, [k]: v } }));
  const num = (k: string, unit: string) => (
    <label className="inline">
      {t('prop.' + k)}{' '}
      <input
        type="number"
        min={0}
        inputMode="decimal"
        style={{ width: 70 }}
        value={val(k) === undefined || val(k) === null ? '' : String(val(k))}
        onChange={(e) => setProp(k, e.target.value === '' ? null : Number(e.target.value))}
      />{' '}
      {unit}
    </label>
  );
  const choices = isProt && (device === 'mcb' || device === 'fuse') ? rcdChoices(ev, p) : [];
  const parentKey = JSON.stringify(edit.parent ?? (c.op === 'createNode' ? c.parent : null));
  const accept = () =>
    applyProject((x) =>
      c.op === 'setProp' && edit.props && 'value' in edit.props
        ? decide(x, { accept: [p.id], values: { [p.id]: edit.props.value ?? undefined } })
        : decide(x, { accept: [p.id], confirm: [p.id], ...(editing && Object.keys(edit).length ? { edits: { [p.id]: edit } } : {}) }),
    );
  return (
    <li>
      <span className={p.critical ? 'assist-critical' : undefined}>
        {p.critical ? '⚠ ' : ''}
        {text}
      </span>
      <span className="muted small">
        {' '}
        — {t('assist.confidence.' + (p.confidence >= 0.8 ? 'high' : p.confidence >= 0.5 ? 'medium' : 'low'))}
        {src ? ` · ${src}` : ''}
      </span>
      {editing && (
        <div className="row">
          {isProt && device !== 'rcd' && device !== 'switch' && num('ratedCurrent', 'A')}
          {isProt && (device === 'mcb' || device === 'rcbo') && (
            <label className="inline">
              {t('prop.curve')}{' '}
              <select value={String(val('curve') ?? '')} onChange={(e) => setProp('curve', e.target.value || null)}>
                <option value="">—</option>
                {['B', 'C', 'D'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          )}
          {isProt && (device === 'rcd' || device === 'rcbo') && num('residualCurrent', 'mA')}
          {isProt && device === 'rcd' && num('ratedCurrent', 'A')}
          {choices.length > 1 && (
            <label className="inline">
              {t('assist.parentRcd')}{' '}
              <select value={parentKey} onChange={(e) => setEdit((x) => ({ ...x, parent: JSON.parse(e.target.value) }))}>
                {choices.map((o) => (
                  <option key={JSON.stringify(o.ref)} value={JSON.stringify(o.ref)}>
                    {o.label ? `${t('enum.device.rcd')} ${o.label}` : t('assist.noRcd')}
                  </option>
                ))}
              </select>
            </label>
          )}
          {isUse && c.op === 'createNode' && c.kind !== 'board' && (
            <select
              value={edit.kind === 'appliance' || (!edit.kind && c.kind === 'appliance') ? 'appliance:' + String(val('applianceType') ?? 'other') : (edit.kind ?? c.kind)}
              onChange={(e) => {
                const v = e.target.value;
                if (v.startsWith('appliance:')) setEdit((x) => ({ ...x, kind: 'appliance', props: { ...x.props, applianceType: v.slice(10) } }));
                else setEdit((x) => ({ ...x, kind: v }));
              }}
            >
              {['socket', 'light', 'bell', 'motor'].map((k) => (
                <option key={k} value={k}>
                  {t('kind.' + k)}
                </option>
              ))}
              {APPLIANCE_TYPES.map((a) => (
                <option key={a} value={'appliance:' + a}>
                  {t('enum.applianceType.' + a)}
                </option>
              ))}
            </select>
          )}
          {isUse && c.op === 'createNode' && c.kind === 'board' && (
            <input
              placeholder={t('prop.name')}
              value={String(val('name') ?? '')}
              onChange={(e) => setProp('name', e.target.value || null)}
              style={{ width: 160 }}
            />
          )}
          {isUse && c.op === 'createNode' && (
            <input
              placeholder={t('assist.room')}
              value={edit.location !== undefined ? (edit.location ?? '') : (c.location ?? '')}
              onChange={(e) => setEdit((x) => ({ ...x, location: e.target.value || null }))}
              style={{ width: 130 }}
            />
          )}
          {c.op === 'setProp' && (
            <input
              value={String(edit.props && 'value' in edit.props ? (edit.props.value ?? '') : (c.value ?? ''))}
              onChange={(e) => setEdit({ props: { value: e.target.value === '' ? null : isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value) } })}
              style={{ width: 90 }}
            />
          )}
        </div>
      )}
      <div className="row">
        <button onClick={accept}>{editing && Object.keys(edit).length ? t('assist.acceptEdited') : t('assist.accept')}</button>
        {editable && !editing && <button onClick={() => setEditing(true)}>{t('assist.edit')}</button>}
        {editing && (
          <button
            className="link"
            onClick={() => {
              setEditing(false);
              setEdit({});
            }}
          >
            {t('assist.cancelEdit')}
          </button>
        )}
        <button onClick={() => applyProject((x) => decide(x, { reject: [p.id] }))}>{t('assist.reject')}</button>
      </div>
    </li>
  );
}

function Shell({ t, onClose, children }: { t: (k: string) => string; onClose: () => void; children: React.ReactNode }) {
  const dialogRef = useModalDialog(onClose);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal assist-panel" role="dialog" aria-modal="true" ref={dialogRef} aria-label={t('assist.title')}>
        <h2>{t('assist.title')}</h2>
        {children}
        <div className="row end">
          <button onClick={onClose}>{t('sync.ok')}</button>
        </div>
      </div>
    </div>
  );
}

/** Une question, avec la saisie adaptée (nombre, choix, oui/non, options sourcées) et toujours « je ne sais pas ». */
function QuestionRow({ q, ev }: { q: Question; ev: Evidence }) {
  const t = useStore((s) => s.t);
  const tr = useTr();
  const { applyProject } = useStore.getState();
  const [v, setV] = useState('');
  const [room, setRoom] = useState('');
  const group = !!q.members;
  const send = (value: PropValue | null) => applyProject((p) => (group ? answerGroup(p, q.id, value) : answer(p, q.id, value)));
  const prop = q.about.prop ?? '';
  const label = tr(q.text.key, q.text.params);
  const unit = prop === 'section' ? 'mm²' : prop === 'ratedCurrent' ? 'A' : prop === 'residualCurrent' ? 'mA' : '';
  const unknown = (
    <button className="link" onClick={() => send(null)}>
      {t('assist.dontKnow')}
    </button>
  );
  const numberInput = (
    <>
      <input type="number" inputMode="decimal" min={0} value={v} onChange={(e) => setV(e.target.value)} style={{ width: 80 }} />{' '}
      <button disabled={!(Number(v) > 0)} onClick={() => send(Number(v))}>
        {t('assist.ok')}
      </button>
    </>
  );
  let input: React.ReactNode;
  if (q.kind === 'contradiction' && q.options?.length) {
    // Une option par valeur lue, avec ses photos ; ou une autre valeur saisie
    input = (
      <>
        {q.options.map((o, i) => (
          <button key={i} onClick={() => send(o.value)}>
            {prop === 'device' && DEVICES.includes(String(o.value)) ? t('enum.device.' + o.value) : String(o.value)}
            {unit ? ' ' + unit : ''} <span className="muted small">({o.label === 'current' ? t('assist.currentValue') : sourcesOf(ev, o.observations) || t('assist.unknownSource')})</span>
          </button>
        ))}
        {(unit || prop === 'modules') && numberInput}
      </>
    );
  } else if (group) {
    input = (
      <>
        {(q.options ?? []).map((o, i) => (
          <button key={i} onClick={() => send(o.value)}>
            {String(o.value).replace('.', ',')} {unit}
          </button>
        ))}
        {numberInput}
        <button className="link" onClick={() => applyProject((p) => splitGroup(p, q.id))}>
          {t('assist.eachSeparately')}
        </button>
      </>
    );
  } else if (prop === 'ratedCurrent' || prop === 'residualCurrent' || prop === 'section') {
    input = numberInput;
  } else if (prop === 'curve') {
    input = ['B', 'C', 'D'].map((c) => (
      <button key={c} onClick={() => send(c)}>
        {c}
      </button>
    ));
  } else if (prop === '@parent' || q.kind === 'confirm') {
    input = (
      <>
        <button onClick={() => send(true)}>{t('assist.yes')}</button>{' '}
        <button onClick={() => send(null)} title={t('assist.noHelp')}>
          {t('assist.no')}
        </button>
      </>
    );
  } else if (prop === '@usage') {
    input = (
      <>
        <select value={v} onChange={(e) => setV(e.target.value)}>
          <option value="">—</option>
          <option value="socket">{t('kind.socket')}</option>
          <option value="light">{t('kind.light')}</option>
          {APPLIANCE_TYPES.filter((a) => a !== 'other').map((a) => (
            <option key={a} value={'appliance:' + a}>
              {t('enum.applianceType.' + a)}
            </option>
          ))}
          <option value="other">{t('assist.other')}</option>
        </select>{' '}
        <input placeholder={t('assist.room')} value={room} onChange={(e) => setRoom(e.target.value)} style={{ width: 120 }} />{' '}
        <button
          disabled={!v}
          onClick={() =>
            applyProject((p) =>
              answerUsage(p, q.id, v.startsWith('appliance:') ? { kind: 'appliance', applianceType: v.slice(10), room: room || undefined } : { kind: v as 'socket' | 'light' | 'other', room: room || undefined }),
            )
          }
        >
          {t('assist.ok')}
        </button>
      </>
    );
  } else input = <button onClick={() => send(true)}>{t('assist.ok')}</button>;
  return (
    <li className={q.priority === 'high' ? 'assist-high' : undefined}>
      <div>{label}</div>
      {group && <div className="muted small">{q.members!.map((m) => m.label).filter(Boolean).join(' · ')}</div>}
      <div className="row">
        {input} {unknown}
      </div>
    </li>
  );
}
