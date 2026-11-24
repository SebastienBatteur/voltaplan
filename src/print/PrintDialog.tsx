import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { useDerived } from '../ui/derived';
import { PrintDocument, type PaperFormat, type PrintSections } from './PrintDocument';

const SECTIONS: (keyof PrintSections)[] = ['unifilar', 'plan', 'board', 'circuits', 'legend', 'measures', 'bom', 'labels', 'checks'];

/**
 * Impression du dossier : choix du format (A4 / A3 paysage) et des parties, aperçu, puis impression
 * par le navigateur (« Enregistrer en PDF » pour un fichier PDF vectoriel).
 */
export function PrintDialog({ onClose }: { onClose: () => void }) {
  const t = useStore((s) => s.t);
  const project = useStore((s) => s.project);
  const { labelFn, numbering, findings } = useDerived();
  // Constats bloquants (sécurité, ou installation neuve) : le dossier porte la mention « PROJET — NON CONFORME ».
  const draft = findings.some((f) => f.blocking);
  const [format, setFormat] = useState<PaperFormat>('A4');
  const [sections, setSections] = useState<PrintSections>({
    unifilar: true,
    plan: true,
    board: true,
    circuits: true,
    legend: true,
    labels: false,
    measures: true,
    bom: false,
    checks: findings.length > 0,
  });
  const [printing, setPrinting] = useState(false);
  const lang = useStore((s) => s.lang);
  const ctx = { project, t, labelFn, numbering, findings, draft, lang };

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
      <div className="modal print-modal" role="dialog" aria-label={t('print.title')}>
        <h2>{t('print.title')}</h2>
        <div className="print-options">
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
                <input type="checkbox" checked={sections[k]} onChange={(e) => setSections({ ...sections, [k]: e.target.checked })} /> {t('print.sec.' + k)}
              </label>
            ))}
          </div>
        </div>
        {draft && <div className="banner error">{t('print.draftWarning', { n: findings.filter((f) => f.blocking).length })}</div>}
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
