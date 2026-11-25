import { useState } from 'react';
import { useStore } from '../store';
import { emptyProject } from '../model/tree';
import { newExistingProject } from '../assist/project';
import { loadInstallerProfile, saveInstallerProfile } from '../io/recent';
import type { Project } from '../model/types';
import { useModalDialog } from './a11y';

const SUPPLIES = ['2 x 230V ~ 50Hz', '3 x 230V ~ 50Hz', '3N x 400V ~ 50Hz'];

/**
 * Assistant de nouveau projet, en 4 étapes courtes : type d'installation, lieu et client, responsable des travaux,
 * alimentation. Tout est facultatif et modifiable ensuite (onglet Projet) ; ce qui est saisi remplit les mentions
 * obligatoires du dossier (RGIE 3.1.2.1). Les coordonnées de l'installateur sont reprises d'un projet à l'autre,
 * sur cet appareil seulement.
 */
export function NewProjectWizard({ initialKind, onClose, onCreate }: { initialKind: 'new' | 'existing'; onClose: () => void; onCreate: (p: Project) => void }) {
  const dialogRef = useModalDialog(onClose);
  const t = useStore((s) => s.t);
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState(initialKind);
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [site, setSite] = useState({ street: '', number: '', postalCode: '', city: '' });
  const profile = loadInstallerProfile();
  const [inst, setInst] = useState({ name: profile.name ?? '', quality: profile.quality ?? '', vat: profile.vat ?? '' });
  const [remember, setRemember] = useState(true);
  const [supply, setSupply] = useState(SUPPLIES[0]);
  const [earthing, setEarthing] = useState<'TT' | 'TN' | 'IT'>('TT');
  const [mainCurrent, setMainCurrent] = useState('40');

  const STEPS = ['kind', 'site', 'installer', 'supply'] as const;
  const last = step === STEPS.length - 1;

  const create = () => {
    const name = title.trim() || [client.trim(), site.city.trim()].filter(Boolean).join(' — ') || t(kind === 'existing' ? 'assist.newSurveyTitle' : 'wizard.defaultTitle');
    const base = kind === 'existing' ? newExistingProject(name) : emptyProject();
    const amps = Number(mainCurrent);
    const p: Project = {
      ...base,
      meta: {
        ...base.meta,
        title: name,
        installationKind: kind,
        client: { ...base.meta.client, name: client.trim() || undefined, address: { ...base.meta.client.address } },
        site: { ...base.meta.site, ...Object.fromEntries(Object.entries(site).map(([k, v]) => [k, v.trim() || undefined])) },
        installer: { ...base.meta.installer, name: inst.name.trim() || undefined, quality: inst.quality.trim() || undefined, vat: inst.vat.trim() || undefined },
        supply,
        earthing,
        mainCurrent: Number.isFinite(amps) && amps > 0 ? amps : undefined,
      },
    };
    if (remember) saveInstallerProfile(inst);
    onCreate(p);
  };

  const field = (label: string, value: string, set: (v: string) => void, extra: { placeholder?: string; autoComplete?: string; inputMode?: 'numeric' | 'text' } = {}) => (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(e) => set(e.target.value)} {...extra} />
    </label>
  );

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wizard" role="dialog" aria-modal="true" ref={dialogRef} aria-label={t('wizard.title')}>
        <h2>{t('wizard.title')}</h2>
        <ol className="wizard-steps" aria-label={t('wizard.progress')}>
          {STEPS.map((s, i) => (
            <li key={s} className={i === step ? 'current' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
              {t('wizard.step.' + s)}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="wizard-body">
            <div className="wizard-choice" role="radiogroup" aria-label={t('wizard.step.kind')}>
              {(['new', 'existing'] as const).map((k) => (
                <button key={k} role="radio" aria-checked={kind === k} className={'home-card' + (kind === k ? ' selected' : '')} onClick={() => setKind(k)}>
                  <strong>{t('wizard.kind.' + k)}</strong>
                  <span className="muted small">{t('wizard.kind.' + k + 'Help')}</span>
                </button>
              ))}
            </div>
            {field(t('wizard.projectTitle'), title, setTitle, { placeholder: t('wizard.projectTitleHint') })}
          </div>
        )}

        {step === 1 && (
          <div className="wizard-body">
            <p className="muted small">{t('wizard.siteHelp')}</p>
            {field(t('wizard.client'), client, setClient, { autoComplete: 'name' })}
            {field(t('addr.street'), site.street, (v) => setSite({ ...site, street: v }), { autoComplete: 'address-line1' })}
            {field(t('addr.number'), site.number, (v) => setSite({ ...site, number: v }))}
            {field(t('addr.postalCode'), site.postalCode, (v) => setSite({ ...site, postalCode: v }), { autoComplete: 'postal-code', inputMode: 'numeric' })}
            {field(t('addr.city'), site.city, (v) => setSite({ ...site, city: v }), { autoComplete: 'address-level2' })}
          </div>
        )}

        {step === 2 && (
          <div className="wizard-body">
            <p className="muted small">{t('wizard.installerHelp')}</p>
            {field(t('addr.name'), inst.name, (v) => setInst({ ...inst, name: v }), { autoComplete: 'organization' })}
            {field(t('project.installerQuality'), inst.quality, (v) => setInst({ ...inst, quality: v }), { placeholder: t('wizard.qualityHint') })}
            {field(t('project.installerVat'), inst.vat, (v) => setInst({ ...inst, vat: v }), { placeholder: 'BE0123.456.789' })}
            <label className="field bool">
              <span>{t('wizard.remember')}</span>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="wizard-body">
            <p className="muted small">{t('wizard.supplyHelp')}</p>
            <label className="field">
              <span>{t('project.supply')}</span>
              <select value={supply} onChange={(e) => setSupply(e.target.value)}>
                {SUPPLIES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('project.earthing')}</span>
              <select value={earthing} onChange={(e) => setEarthing(e.target.value as 'TT' | 'TN' | 'IT')}>
                <option>TT</option>
                <option>TN</option>
                <option>IT</option>
              </select>
            </label>
            {field(t('wizard.mainCurrent'), mainCurrent, setMainCurrent, { inputMode: 'numeric' })}
          </div>
        )}

        <div className="row wizard-nav">
          {step > 0 ? <button onClick={() => setStep(step - 1)}>{t('wizard.back')}</button> : <button onClick={onClose}>{t('wizard.cancel')}</button>}
          <span className="grow" />
          {!last && (
            <button className="link-button" onClick={create}>
              {t('wizard.createNow')}
            </button>
          )}
          {last ? (
            <button className="primary" onClick={create}>
              {t('wizard.create')}
            </button>
          ) : (
            <button className="primary" onClick={() => setStep(step + 1)}>
              {t('wizard.next')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
