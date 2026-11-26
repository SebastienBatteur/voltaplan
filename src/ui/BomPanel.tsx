import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { useDerived } from './derived';
import { billOfMaterials, billOfMaterialsByRoom, bomCsv, BOM_CATEGORIES, type BomLine } from '../bom/bom';
import { getRulePack } from '../rules';
import { download } from '../io/files';
import { safeName } from '../io/storage';
import { fmtNum } from './labels';
import { circuitCsv, circuitRows } from '../print/circuitList';

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

/** Onglet « Matériel » : liste du matériel, par article ou par pièce, export CSV (tableur, devis, commande). */
export function BomPanel() {
  const t = useStore((s) => s.t);
  const lang = useStore((s) => s.lang);
  const project = useStore((s) => s.project);
  const fileName = useStore((s) => s.fileName);
  const { numbering, labelFn } = useDerived();
  const lines = useBom();
  const pack = getRulePack(project.meta.ruleset);
  const [byRoom, setByRoom] = useState(false);
  const rooms = useMemo(
    () => (byRoom ? billOfMaterialsByRoom(project, numbering, lang, t, pack.equivalents) : null),
    [byRoom, project, numbering, lang, t, pack.equivalents],
  );
  const roomName = (r: { room: string | null; floorOnly?: boolean }) =>
    r.room === null ? t('bom.noRoom') : r.floorOnly ? t('bom.floorOnly', { floor: r.room }) : r.room;
  const exportCsv = () => {
    let csv: string;
    if (rooms) {
      const all = [...rooms.rooms.flatMap((r) => r.lines.map((l) => ({ l, room: roomName(r) }))), ...rooms.shared.map((l) => ({ l, room: t('bom.shared') }))];
      const where = new Map(all.map((x) => [x.l, x.room]));
      csv = bomCsv(all.map((x) => x.l), t, (l) => where.get(l) ?? '');
    } else csv = bomCsv(lines, t);
    void download(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      safeName((fileName || project.meta.title || 'projet').replace(/\.[^.]*$/, '')) + '-' + t('bom.file') + (rooms ? '-' + t('bom.byRoomFile') : '') + '.csv',
    );
  };
  return (
    <div className="page-panel">
      <div className="row">
        <div className="tabs-row" role="group" aria-label={t('bom.view')}>
          <button aria-pressed={!byRoom} className={!byRoom ? 'active' : ''} onClick={() => setByRoom(false)}>
            {t('bom.byItem')}
          </button>
          <button aria-pressed={byRoom} className={byRoom ? 'active' : ''} onClick={() => setByRoom(true)}>
            {t('bom.byRoom')}
          </button>
        </div>
        <button className="primary" disabled={!lines.length} onClick={exportCsv}>
          {t('bom.exportCsv')}
        </button>
        <button
          title={t('bom.circuitsCsvHelp')}
          onClick={() =>
            void download(
              new Blob([circuitCsv(circuitRows(project, numbering, labelFn), t)], { type: 'text/csv;charset=utf-8' }),
              safeName((fileName || project.meta.title || 'projet').replace(/\.[^.]*$/, '')) + '-' + t('bom.circuitsFile') + '.csv',
            )
          }
        >
          {t('bom.circuitsCsv')}
        </button>
      </div>
      <p className="muted small">{t(byRoom ? 'bom.byRoomHelp' : 'bom.help', { country: pack.country })}</p>
      {!lines.length && <p className="muted">{t('bom.empty')}</p>}
      {!!lines.length && !rooms && <BomTable lines={lines} />}
      {rooms && (
        <>
          {rooms.rooms.map((r) => (
            <section key={(r.floorOnly ? 'f:' : '') + (r.room ?? '')} className="bom-room">
              <h3>
                {roomName(r)} <span className="muted small">({r.lines.reduce((a, l) => a + l.qty, 0)})</span>
              </h3>
              <BomTable lines={r.lines} />
            </section>
          ))}
          {rooms.shared.length > 0 && (
            <section className="bom-room">
              <h3>{t('bom.shared')}</h3>
              <BomTable lines={rooms.shared} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
