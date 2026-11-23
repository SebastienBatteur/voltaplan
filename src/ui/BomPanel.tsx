import { useMemo } from 'react';
import { useStore } from '../store';
import { useDerived } from './derived';
import { billOfMaterials, bomCsv, BOM_CATEGORIES, type BomLine } from '../bom/bom';
import { getRulePack } from '../rules';
import { download } from '../io/files';
import { safeName } from '../io/storage';
import { fmtNum } from './labels';

/** Hook : liste du matériel du projet (mémorisée). */
export function useBom(): BomLine[] {
  const project = useStore((s) => s.project);
  const lang = useStore((s) => s.lang);
  const t = useStore((s) => s.t);
  const { numbering } = useDerived();
  return useMemo(
    () => billOfMaterials(project, numbering, lang, t, getRulePack(project.meta.ruleset).equivalents),
    [project, numbering, lang, t],
  );
}

export function BomTable({ lines, compact }: { lines: BomLine[]; compact?: boolean }) {
  const t = useStore((s) => s.t);
  const lang = useStore((s) => s.lang);
  return (
    <table className={compact ? 'print-table' : 'bom-table'}>
      <thead>
        <tr>
          <th className="num">{t('bom.col.qty')}</th>
          <th>{t('bom.col.desc')}</th>
          <th>{t('bom.col.std')}</th>
          <th>{t('bom.col.reference')}</th>
          <th>{t('bom.col.refs')}</th>
        </tr>
      </thead>
      <tbody>
        {BOM_CATEGORIES.flatMap((cat) => {
          const ls = lines.filter((l) => l.cat === cat);
          if (!ls.length) return [];
          return [
            <tr key={cat} className="bom-cat">
              <td colSpan={5}>{t('bom.cat.' + cat)}</td>
            </tr>,
            ...ls.map((l, i) => (
              <tr key={cat + i}>
                <td className="num">
                  {l.qty}
                  {l.cat === 'cable' && (
                    <div className="muted small">
                      {l.length ? fmtNum(Math.round(l.length * 10) / 10, lang) + ' m' : ''}
                      {l.missingLength ? (l.length ? ' + ' : '') + t('bom.noLength', { n: l.missingLength }) : ''}
                    </div>
                  )}
                </td>
                <td>{l.desc}</td>
                <td className="muted">{l.std}</td>
                <td>{l.reference}</td>
                <td className="refs">{l.refs.join(' ')}</td>
              </tr>
            )),
          ];
        })}
      </tbody>
    </table>
  );
}

/** Onglet « Matériel » : liste du matériel, export CSV (tableur, devis, commande). */
export function BomPanel() {
  const t = useStore((s) => s.t);
  const project = useStore((s) => s.project);
  const fileName = useStore((s) => s.fileName);
  const lines = useBom();
  const pack = getRulePack(project.meta.ruleset);
  return (
    <div className="page-panel">
      <div className="row">
        <button
          className="primary"
          disabled={!lines.length}
          onClick={() =>
            void download(
              new Blob([bomCsv(lines, t)], { type: 'text/csv;charset=utf-8' }),
              safeName((fileName || project.meta.title || 'projet').replace(/\.[^.]*$/, '')) + '-' + t('bom.file') + '.csv',
            )
          }
        >
          {t('bom.exportCsv')}
        </button>
      </div>
      <p className="muted small">{t('bom.help', { country: pack.country })}</p>
      {lines.length ? <BomTable lines={lines} /> : <p className="muted">{t('bom.empty')}</p>}
    </div>
  );
}
