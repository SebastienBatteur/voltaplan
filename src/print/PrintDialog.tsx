import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { useDerived } from '../ui/derived';
import { PrintDocument, type DocKind, type PaperFormat, type PrintSections } from './PrintDocument';
import { draftLevel, isDocumentary } from '../rules';
import { useModalDialog } from '../ui/a11y';

/** Parties incluses par défaut selon le type de document (modifiables ensuite). */
const PRESETS: Record<DocKind, (hasFindings: boolean) => PrintSections> = {
  working: (f) => ({ unifilar: true, plan: true, board: true, circuits: true, legend: true, labels: false, measures: true, bom: false, checks: f, qrLabel: false }),
  reception: (f) => ({ unifilar: true, plan: true, board: true, circuits: true, legend: true, labels: false, measures: true, bom: false, checks: f, qrLabel: false }),
  anomalies: () => ({ unifilar: false, plan: false, board: false, circuits: true, legend: false, labels: false, measures: true, bom: false, checks: true, qrLabel: false }),
  complete: () => ({ unifilar: true, plan: true, board: true, circuits: true, legend: true, labels: true, measures: true, bom: true, checks: true, qrLabel: true }),
};
const DOC_KINDS: DocKind[] = ['working', 'reception', 'anomalies', 'complete'];

const SECTIONS: (keyof PrintSections)[] = ['unifilar', 'plan', 'board', 'circuits', 'legend', 'measures', 'bom', 'labels', 'qrLabel', 'checks'];

/**
 * Impression du dossier : choix du format (A4 / A3 paysage) et des parties, aperçu, puis impression
 * par le navigateur (« Enregistrer en PDF » pour un fichier PDF vectoriel).
 */
export function PrintDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useModalDialog(onClose);
  const t = useStore((s) => s.t);
  const project = useStore((s) => s.project);
  const { labelFn, numbering, findings } = useDerived();
  const [docKind, setDocKind] = useState<DocKind>('working');
  // Mention du dossier de réception ou complet (ADR-0007, src/rules/knowledge.ts) : « NON-CONFORMITÉS À TRAITER »
  // seulement pour des non-conformités physiques établies ; « VÉRIFICATIONS À FAIRE » pour des informations inconnues,
  // déduites, contradictoires ou des mesures à faire ; « DOSSIER INCOMPLET » pour des exigences documentaires.
  // Document de travail : mention propre (« Document de travail »).
  const draft = draftLevel(findings, docKind);
  const draftWarning =
    draft === 'nonCompliant'
      ? t('print.draftWarning', { n: findings.filter((f) => f.blocking).length })
      : draft === 'pending'
        ? t('print.draftPendingWarning')
        : draft === 'incomplete'
          ? t('print.draftIncompleteWarning', { n: findings.filter((f) => f.blocking && isDocumentary(f)).length })
          : '';
  const [format, setFormat] = useState<PaperFormat>('A4');
  const [sections, setSections] = useState<PrintSections>(() => PRESETS.working(findings.length > 0));
  const [printing, setPrinting] = useState(false);
  const lang = useStore((s) => s.lang);
  const ctx = { project, t, labelFn, numbering, findings, draft, lang, docKind };

  useEffect(() => {
    if (!printing) return;
    const style = document.createElement('style');
    style.textContent = `@page { size: ${format} landscape; margin: 0; }`;
    document.head.appendChild(style);
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    // Laisser le navigateur dessiner les pages avant d'ouvrir la boîte d'impression
    const id = requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('afterprint', done);
      style.remove();
    };
  }, [printing, format]);

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal print-modal" role="dialog" aria-modal="true" ref={dialogRef} aria-label={t('print.title')}>
        <h2>{t('print.title')}</h2>
        <div className="print-options">
          <label className="field">
            <span>{t('print.docKind')}</span>
            <select
              value={docKind}
              onChange={(e) => {
                const k = e.target.value as DocKind;
                setDocKind(k);
                setSections(PRESETS[k](findings.length > 0));
              }}
            >
              {DOC_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t('print.kind.' + k)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('print.format')}</span>
            <select value={format} onChange={(e) => setFormat(e.target.value as PaperFormat)}>
              <option value="A4">A4 {t('print.landscape')}</option>
              <option value="A3">A3 {t('print.landscape')}</option>
            </select>
          </label>
          <div className="print-sections">
            {SECTIONS.map((k) => (
              <label key={k} className="radio">
                <input type="checkbox" checked={!!sections[k]} onChange={(e) => setSections({ ...sections, [k]: e.target.checked })} /> {t('print.sec.' + k)}
              </label>
            ))}
          </div>
        </div>
        <p className="muted small">{t('print.kindHelp.' + docKind)}</p>
        {draftWarning && <div className={'banner' + (draft === 'nonCompliant' ? ' error' : '')}>{draftWarning}</div>}
        <p className="muted small">{t('print.help')}</p>
        <div className="print-preview">
          <div className="print-preview-inner">
            <PrintDocument ctx={ctx} format={format} sections={sections} />
          </div>
        </div>
        <div className="row end">
          <button onClick={onClose}>{t('ai.close')}</button>
          <button className="primary" onClick={() => setPrinting(true)}>
            {t('print.go')}
          </button>
        </div>
      </div>
      {printing &&
        createPortal(
          <div id="print-root">
            <PrintDocument ctx={ctx} format={format} sections={sections} />
          </div>,
          document.body,
        )}
    </div>
  );
}
