import { useState } from 'react';
import { useStore } from '../store';
import { answer, answerUsage, bulkAcceptable, decide, needsReview, snapshotSurvey, surveyFrozen } from '../assist/apply';
import type { Proposal, Question } from '../assist/evidence';
import type { PropValue } from '../model/types';
import { APPLIANCE_TYPES } from '../model/schema';

/**
 * Assistant : parcours simple, en 4 étapes, pour un électricien qui n'aime pas l'informatique.
 *  1. accepter d'un coup ce qui est sûr ;
 *  2. vérifier une par une les propositions critiques ou incertaines (différentiels, raccordements devinés) ;
 *  3. répondre aux questions (ou « je ne sais pas ») ;
 *  4. figer le relevé, puis lancer le contrôle RGIE si on le souhaite.
 * Rien n'est appliqué sans un clic ; tout est annulable (Ctrl+Z).
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
  const open = (ev?.questions ?? []).filter((q) => q.status === 'open');
  const answerable = open.filter((q) => q.about.nodeId || !q.about.tempKey).sort((a, b) => rank(a) - rank(b));
  const waiting = open.length - answerable.length;
  const frozen = surveyFrozen(project);

  const what = (k: string) => (['mcb', 'rcd', 'rcbo', 'fuse', 'switch'].includes(k) ? t('enum.device.' + k) : t('assist.kind.' + k));
  const usage = (u: string) => (['socket', 'light', 'bell', 'motor', 'board'].includes(u) ? t('kind.' + u) : t('enum.applianceType.' + u));
  const text = (p: Proposal) => {
    const params = { ...(p.text.params ?? {}) } as Record<string, string | number>;
    if (typeof params.what === 'string') params.what = what(params.what);
    if (typeof params.usage === 'string') params.usage = usage(params.usage);
    return t(p.text.key, params);
  };

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
            <li key={p.id}>
              <span className={p.critical ? 'assist-critical' : undefined}>{p.critical ? '⚠ ' : ''}{text(p)}</span>
              <span className="muted small"> — {t('assist.confidence.' + (p.confidence >= 0.8 ? 'high' : p.confidence >= 0.5 ? 'medium' : 'low'))}</span>{' '}
              <button onClick={() => applyProject((x) => decide(x, { accept: [p.id], confirm: [p.id] }))}>{t('assist.accept')}</button>{' '}
              <button onClick={() => applyProject((x) => decide(x, { reject: [p.id] }))}>{t('assist.reject')}</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">{t('assist.reviewNone')}</p>
      )}

      <h3>3. {t('assist.step.questions')}</h3>
      {answerable.length ? (
        <ul className="assist-list">
          {answerable.slice(0, 30).map((q) => (
            <QuestionRow key={q.id} q={q} what={what} />
          ))}
        </ul>
      ) : (
        <p className="muted small">{t('assist.questionsNone')}</p>
      )}
      {answerable.length > 30 && <p className="muted small">{t('assist.moreQuestions', { n: answerable.length - 30 })}</p>}
      {waiting > 0 && <p className="muted small">{t('assist.questionsWaiting', { n: waiting })}</p>}

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

function Shell({ t, onClose, children }: { t: (k: string) => string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal assist-panel" role="dialog" aria-label={t('assist.title')}>
        <h2>{t('assist.title')}</h2>
        {children}
        <div className="row end">
          <button onClick={onClose}>{t('sync.ok')}</button>
        </div>
      </div>
    </div>
  );
}

/** Une question, avec la saisie adaptée (nombre, choix, oui/non) et toujours « je ne sais pas ». */
function QuestionRow({ q, what }: { q: Question; what: (k: string) => string }) {
  const t = useStore((s) => s.t);
  const { applyProject } = useStore.getState();
  const [v, setV] = useState('');
  const [room, setRoom] = useState('');
  const send = (value: PropValue | null) => applyProject((p) => answer(p, q.id, value));
  const prop = q.about.prop ?? '';
  const params = { ...(q.text.params ?? {}) } as Record<string, string | number>;
  if (typeof params.what === 'string') params.what = what(params.what);
  const label = t(q.text.key, params);
  const unknown = (
    <button className="link" onClick={() => send(null)}>
      {t('assist.dontKnow')}
    </button>
  );
  let input: React.ReactNode;
  if (prop === 'ratedCurrent' || prop === 'residualCurrent' || prop === 'section') {
    input = (
      <>
        <input type="number" inputMode="decimal" min={0} value={v} onChange={(e) => setV(e.target.value)} style={{ width: 80 }} />{' '}
        <button disabled={!(Number(v) > 0)} onClick={() => send(Number(v))}>
          {t('assist.ok')}
        </button>
      </>
    );
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
      <div className="row">
        {input} {unknown}
      </div>
    </li>
  );
}
