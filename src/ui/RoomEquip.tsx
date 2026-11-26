import { useState } from 'react';
import { useStore } from '../store';
import { equipRoom, kitFor, pointsInRoom, roomTypeOf, ROOM_FURNITURE } from '../plan/roomKit';

/**
 * « Équiper la pièce » : sous le nom d'une pièce sélectionné sur le plan, l'équipement habituel de ce type de pièce
 * (à cocher), et le mobilier type. Les points ajoutés sont non raccordés, à relier ensuite aux circuits.
 */
export function RoomEquip({ text, labelIndex }: { text: string; labelIndex: number }) {
  const t = useStore((s) => s.t);
  const project = useStore((s) => s.project);
  const pageIndex = useStore((s) => Math.min(s.pageIndex, s.project.plan.pages.length - 1));
  const kit = kitFor(text);
  const type = roomTypeOf(text);
  const [off, setOff] = useState<string[]>([]);
  const page = project.plan.pages[pageIndex];
  const hasFurniture = !!type && !!ROOM_FURNITURE[type];
  const [furn, setFurn] = useState(true);
  if (!type || !kit.length) return <p className="muted small">{t('kit.unknown')}</p>;
  const existing = pointsInRoom(project, text);
  const apply = () => {
    useStore.getState().applyProject((p) => equipRoom(p, pageIndex, labelIndex, { items: kit.map((k) => k.key).filter((k) => !off.includes(k)), furniture: hasFurniture && furn }).project);
  };
  return (
    <div className="room-equip">
      <strong>{t('kit.title', { room: t('kit.room.' + type) })}</strong>
      {kit.map((it) => (
        <label key={it.key} className="check">
          <input type="checkbox" checked={!off.includes(it.key)} onChange={(e) => setOff((o) => (e.target.checked ? o.filter((k) => k !== it.key) : [...o, it.key]))} />
          {it.qty > 1 ? `${it.qty} × ` : ''}
          {t('kit.item.' + it.key)}
        </label>
      ))}
      {hasFurniture && (
        <label className="check">
          <input type="checkbox" checked={furn} onChange={(e) => setFurn(e.target.checked)} />
          {t('kit.furniture')}
        </label>
      )}
      {existing > 0 && <p className="warn-text small">{t('kit.existing', { n: existing })}</p>}
      <button className="primary" disabled={!page || off.length === kit.length && !(hasFurniture && furn)} onClick={apply}>
        {t('kit.apply')}
      </button>
      <p className="muted small">{t('kit.help')}</p>
    </div>
  );
}
