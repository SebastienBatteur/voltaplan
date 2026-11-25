import { useDerived } from './derived';
import { walk } from '../model/tree';
import type { ElNode } from '../model/types';
import type { Revision } from '../model/types';
import { RULE_PACKS, findRulePack, getRulePack, packLabel, projectContext } from '../rules';
import { useStore } from '../store';
import type { Address } from '../model/types';

function AddressFields({ value, onChange }: { value: Address; onChange: (a: Address) => void }) {
  const t = useStore((s) => s.t);
  const f = (k: keyof Address, cls = '') => (
    <label className={'field ' + cls}>
      <span>{t('addr.' + k)}</span>
      <input value={value[k] ?? ''} onChange={(e) => onChange({ ...value, [k]: e.target.value || undefined })} />
    </label>
  );
  return (
    <div className="grid-addr">
      {f('street', 'wide')}
      {f('number')}
      {f('box')}
      {f('postalCode')}
      {f('city', 'wide')}
    </div>
  );
}

export function ProjectPanel() {
  const t = useStore((s) => s.t);
  const meta = useStore((s) => s.project.meta);
  const lang = useStore((s) => s.lang);
  const revisions = meta.revisions ?? [];
  const project = useStore((s) => s.project);
  const { numbering } = useDerived();
  /** Circuits protégés par un différentiel : « A–F » ou « A, C, D ». */
  const coveredCircuits = (r: ElNode) => {
    const letters = [...walk(r.children)].filter((w) => w.node.kind === 'protection' && numbering.get(w.node.id)).map((w) => numbering.get(w.node.id)!);
    if (!letters.length) return '';
    return letters.length > 3 ? `${letters[0]}–${letters[letters.length - 1]}` : letters.join(', ');
  };
  const rcds = [...walk(project.roots)].map((w) => w.node).filter((n) => n.kind === 'protection' && Number(n.props.residualCurrent) > 0);
  const setRev = (i: number, patch: Partial<Revision>) => setMeta({ revisions: revisions.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const m = useStore((s) => s.project.measurements);
  const setMeta = useStore((s) => s.setMeta);
  const setMeasurements = useStore((s) => s.setMeasurements);
  const num = (v: string) => (v === '' ? undefined : Number(v.replace(',', '.')));

  return (
    <div className="page-panel form">
      <label className="field">
        <span>{t('project.title')}</span>
        <input value={meta.title} onChange={(e) => setMeta({ title: e.target.value })} />
      </label>

      <label className="field">
        <span>{t('project.ruleset')}</span>
        <select value={getRulePack(meta.ruleset).id} onChange={(e) => setMeta({ ruleset: e.target.value })}>
          {RULE_PACKS.map((p) => (
            <option key={p.id} value={p.id}>
              {packLabel(p, lang)}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend>{t('project.installationKind')}</legend>
        {(['new', 'existing'] as const).map((k) => (
          <label key={k} className="radio">
            <input type="radio" checked={meta.installationKind === k} onChange={() => setMeta({ installationKind: k })} /> {t('project.installationKind.' + k)}
          </label>
        ))}
        <div className="spacer" />
        <legend className="sub">{t('project.rgieVersion')}</legend>
        {getRulePack(meta.ruleset).versions.map((k) => (
          <label key={k} className="radio">
            <input type="radio" checked={meta.rgieVersion === k} onChange={() => setMeta({ rgieVersion: k })} /> {t('project.rgieVersion.' + k)}
          </label>
        ))}
        <label className="field">
          <span>{t('project.installationDate')}</span>
          <input value={meta.installationDate ?? ''} placeholder="2024-03-15" onChange={(e) => setMeta({ installationDate: e.target.value || undefined })} />
        </label>
        <p className="muted small">
          {t('project.installationDateHelp')} <EditionApplied />
        </p>
      </fieldset>

      <fieldset>
        <legend>{t('project.client')}</legend>
        <label className="field">
          <span>{t('addr.name')}</span>
          <input value={meta.client.name ?? ''} onChange={(e) => setMeta({ client: { ...meta.client, name: e.target.value } })} />
        </label>
        <AddressFields value={meta.client.address} onChange={(a) => setMeta({ client: { ...meta.client, address: a } })} />
      </fieldset>

      <fieldset>
        <legend>{t('project.site')}</legend>
        <AddressFields value={meta.site} onChange={(a) => setMeta({ site: a })} />
      </fieldset>

      <fieldset>
        <legend>{t('project.installer')}</legend>
        <label className="field">
          <span>{t('addr.name')}</span>
          <input value={meta.installer.name ?? ''} onChange={(e) => setMeta({ installer: { ...meta.installer, name: e.target.value } })} />
        </label>
        <label className="field">
          <span>{t('project.installerQuality')}</span>
          <input value={meta.installer.quality ?? ''} onChange={(e) => setMeta({ installer: { ...meta.installer, quality: e.target.value } })} />
        </label>
        <label className="field">
          <span>{t('project.installerVat')}</span>
          <input value={meta.installer.vat ?? ''} placeholder="BE0123.456.789" onChange={(e) => setMeta({ installer: { ...meta.installer, vat: e.target.value } })} />
        </label>
        <AddressFields value={meta.installer.address} onChange={(a) => setMeta({ installer: { ...meta.installer, address: a } })} />
        <label className="field">
          <span>{t('project.drawnBy')}</span>
          <input value={meta.drawnBy ?? ''} onChange={(e) => setMeta({ drawnBy: e.target.value })} />
        </label>
      </fieldset>

      <fieldset>
        <legend>{t('project.supply')}</legend>
        <label className="field">
          <span>{t('project.supply')}</span>
          <select value={meta.supply} onChange={(e) => setMeta({ supply: e.target.value })}>
            {Array.from(new Set(['2 x 230V ~ 50Hz', '3 x 230V ~ 50Hz', '3N x 400V ~ 50Hz', meta.supply])).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('project.earthing')}</span>
          <select value={meta.earthing} onChange={(e) => setMeta({ earthing: e.target.value as 'TT' })}>
            <option>TT</option>
            <option>TN</option>
            <option>IT</option>
          </select>
        </label>
        <label className="field">
          <span>{t('project.mainCurrent')}</span>
          <input type="number" min={0} value={meta.mainCurrent ?? ''} onChange={(e) => setMeta({ mainCurrent: e.target.value === '' ? undefined : Number(e.target.value) })} />
        </label>
        <label className="field">
          <span>{t('project.ean')}</span>
          <input value={meta.ean ?? ''} placeholder="5414…" onChange={(e) => setMeta({ ean: e.target.value })} />
        </label>
        <label className="field">
          <span>{t('project.earthSwitch')}</span>
          <input value={meta.earthSwitchLocation ?? ''} onChange={(e) => setMeta({ earthSwitchLocation: e.target.value })} />
        </label>
        <label className="field">
          <span>{t('project.inspectionBody')}</span>
          <input value={meta.inspectionBodyName ?? ''} placeholder="Vinçotte, BTV, ACA…" onChange={(e) => setMeta({ inspectionBodyName: e.target.value })} />
        </label>
        <label className="field">
          <span>{t('project.date')}</span>
          <input type="date" value={meta.date} onChange={(e) => setMeta({ date: e.target.value })} />
        </label>
      </fieldset>

      <fieldset>
        <legend>{t('project.measurements')}</legend>
        <label className="field">
          <span>{t('project.earthResistance')}</span>
          <input type="number" step="any" value={m.earthResistanceOhm ?? ''} onChange={(e) => setMeasurements({ earthResistanceOhm: num(e.target.value) })} />
        </label>
        <label className="field">
          <span>{t('project.insulation')}</span>
          <input type="number" step="any" value={m.insulationMOhm ?? ''} onChange={(e) => setMeasurements({ insulationMOhm: num(e.target.value) })} />
        </label>
        <label className="field bool">
          <span>{t('project.bonding')}</span>
          <select
            value={m.bondingOk === undefined ? '' : m.bondingOk ? 'ok' : 'ko'}
            onChange={(e) => setMeasurements({ bondingOk: e.target.value === '' ? undefined : e.target.value === 'ok' })}
          >
            <option value="">—</option>
            <option value="ok">{t('meas.ok')}</option>
            <option value="ko">{t('meas.ko')}</option>
          </select>
        </label>
        <label className="field">
          <span>{t('project.measuredOn')}</span>
          <input type="date" value={m.measuredOn ?? ''} onChange={(e) => setMeasurements({ measuredOn: e.target.value || undefined })} />
        </label>
        <label className="field">
          <span>{t('project.instrument')}</span>
          <input value={m.instrument ?? ''} onChange={(e) => setMeasurements({ instrument: e.target.value || undefined })} />
        </label>
        {rcds.length > 0 && (
          <table className="rcd-tests">
            <thead>
              <tr>
                <th>{t('meas.rcd')}</th>
                <th>{t('meas.tripMs')}</th>
                <th>{t('meas.result')}</th>
              </tr>
            </thead>
            <tbody>
              {rcds.map((r) => {
                const test = m.rcdTests?.[r.id] ?? {};
                const setTest = (patch: { tripMs?: number; ok?: boolean }) =>
                  setMeasurements({ rcdTests: { ...m.rcdTests, [r.id]: { ...test, ...patch } } });
                return (
                  <tr key={r.id}>
                    <td>
                      {numbering.get(r.id) ? numbering.get(r.id) + ' · ' : ''}
                      {r.props.ratedCurrent ? r.props.ratedCurrent + ' A · ' : ''}
                      {String(r.props.residualCurrent)} mA{r.props.rcdType ? ' ' + String(r.props.rcdType) : ''}
                      {coveredCircuits(r) && <span className="muted"> ({coveredCircuits(r)})</span>}
                    </td>
                    <td>
                      <input type="number" min={0} step="1" value={test.tripMs ?? ''} onChange={(e) => setTest({ tripMs: num(e.target.value) })} />
                    </td>
                    <td>
                      <select value={test.ok === undefined ? '' : test.ok ? 'ok' : 'ko'} onChange={(e) => setTest({ ok: e.target.value === '' ? undefined : e.target.value === 'ok' })}>
                        <option value="">—</option>
                        <option value="ok">{t('meas.ok')}</option>
                        <option value="ko">{t('meas.ko')}</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </fieldset>

      <fieldset>
        <legend>{t('project.revisions')}</legend>
        <p className="muted small">{t('project.revisionsHelp')}</p>
        <label className="field">
          <span>{t('project.docNumber')}</span>
          <input value={meta.docNumber ?? ''} placeholder={t('project.docNumberHint')} onChange={(e) => setMeta({ docNumber: e.target.value })} />
        </label>
        <p className="muted small">{t('project.docNumberHelp')}</p>
        {revisions.map((r, i) => (
          <div key={i} className="revision">
            <input className="rev-version" value={r.version} onChange={(e) => setRev(i, { version: e.target.value })} aria-label={t('project.revVersion')} />
            <input type="date" value={r.date} onChange={(e) => setRev(i, { date: e.target.value })} aria-label={t('project.date')} />
            <input className="rev-desc" value={r.description} placeholder={t('project.revDescription')} onChange={(e) => setRev(i, { description: e.target.value })} />
            <button className="danger" onClick={() => setMeta({ revisions: revisions.filter((_, j) => j !== i) })} title={t('action.delete')}>
              ✕
            </button>
          </div>
        ))}
        <button
          onClick={() =>
            setMeta({
              revisions: [
                ...revisions,
                { version: String(revisions.length + 1), date: new Date().toISOString().slice(0, 10), description: revisions.length ? '' : t('project.revInitial') },
              ],
            })
          }
        >
          ＋ {t('project.revAdd')}
        </button>
      </fieldset>
    </div>
  );
}

/** Édition du référentiel applicable au projet (d'après la date, sinon le choix ci-dessus). */
function EditionApplied() {
  const t = useStore((s) => s.t);
  const lang = useStore((s) => s.lang);
  const project = useStore((s) => s.project);
  const pack = findRulePack(project.meta.ruleset);
  const e = pack?.editions?.find((x) => x.id === projectContext(project, pack).edition);
  if (!e) return null;
  return <strong>{t('project.editionApplied', { edition: e.label[lang] ?? e.label.en ?? e.id })}</strong>;
}
