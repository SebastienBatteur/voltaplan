import { NumberField } from './NumberField';
import { useStore } from '../store';
import type { PlanPage } from '../model/types';
import { dist, setOpeningWidth, setWallLength } from '../plan/geometry';
import type { PlanSel } from './PlanView';
import { FURNITURE, type FurnitureKind } from '../plan/furniture';

const OPENING_KINDS = ['door', 'doubleDoor', 'frenchDoor', 'slidingDoor', 'window', 'garageDoor', 'stairs'] as const;

/** Propriétés de l'élément de plan sélectionné (mur, ouverture, texte, fond). Valeurs en cm pour la saisie. */
export function PlanItemPanel({ page, sel, onDelete }: { page: PlanPage; sel: NonNullable<PlanSel>; onDelete: () => void }) {
  const t = useStore((s) => s.t);
  const editPage = useStore((s) => s.editPage);
  const cm = (mm: number) => Math.round(mm / 10);

  let body: JSX.Element | null = null;
  if (sel.type === 'wall') {
    const w = page.walls[sel.index];
    if (!w) return null;
    body = (
      <>
        <strong>{t('plan.item.wall')}</strong>
        <label className="field">
          <span>{t('plan.item.length')}</span>
          <NumberField min={10} step="any" value={Number(cm(dist(w.a, w.b)))} onCommit={(n) => editPage((pg) => setWallLength(pg, sel.index, n * 10))} />
        </label>
        <label className="field">
          <span>{t('plan.item.thickness')}</span>
          <NumberField
            min={3}
            max={80}
            value={Number(cm(w.thickness))}
            onCommit={(n) => editPage((pg) => ({ ...pg, walls: pg.walls.map((x, i) => (i === sel.index ? { ...x, thickness: n * 10 } : x)) }))}
          />
        </label>
        <p className="muted small">{t('plan.item.wallHelp')}</p>
      </>
    );
  } else if (sel.type === 'opening') {
    const o = page.openings[sel.index];
    if (!o) return null;
    const door = o.kind === 'door' || o.kind === 'doubleDoor' || o.kind === 'frenchDoor';
    body = (
      <>
        <strong>{t('plan.item.opening')}</strong>
        <label className="field">
          <span>{t('plan.item.kind')}</span>
          <select
            value={o.kind}
            onChange={(e) =>
              editPage((pg) => ({ ...pg, openings: pg.openings.map((x, i) => (i === sel.index ? { ...x, kind: e.target.value as typeof o.kind } : x)) }))
            }
          >
            {OPENING_KINDS.map((k) => (
              <option key={k} value={k}>
                {t('plan.opening.' + k)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('plan.item.width')}</span>
          <NumberField min={20} value={Number(cm(dist(o.a, o.b)))} onCommit={(n) => editPage((pg) => setOpeningWidth(pg, sel.index, n * 10))} />
        </label>
        {(door || o.kind === 'slidingDoor') && (
          <div className="row">
            <button
              title={t('plan.flipSideHelp')}
              onClick={() =>
                editPage((pg) => ({ ...pg, openings: pg.openings.map((x, i) => (i === sel.index ? { ...x, hinge: x.hinge === 'right' ? 'left' : 'right' } : x)) }))
              }
            >
              ⇅ {t('plan.flipSide')}
            </button>
            {o.kind === 'door' && (
              <button
                title={t('plan.flipHingeHelp')}
                onClick={() => editPage((pg) => ({ ...pg, openings: pg.openings.map((x, i) => (i === sel.index ? { ...x, mirrored: !x.mirrored } : x)) }))}
              >
                ⇆ {t('plan.flipHinge')}
              </button>
            )}
          </div>
        )}
        <p className="muted small">{t('plan.item.openingHelp')}</p>
      </>
    );
  } else if (sel.type === 'label') {
    const l = page.labels[sel.index];
    if (!l) return null;
    const setL = (patch: Partial<typeof l>) => editPage((pg) => ({ ...pg, labels: pg.labels.map((x, i) => (i === sel.index ? { ...x, ...patch } : x)) }));
    body = (
      <>
        <strong>{t('plan.item.label')}</strong>
        <label className="field">
          <span>{t('plan.item.text')}</span>
          <input value={l.text} onChange={(e) => setL({ text: e.target.value })} />
        </label>
        <label className="field">
          <span>{t('plan.item.size')}</span>
          <NumberField min={1} max={10} step={0.5} value={l.size ?? 3} onCommit={(n) => setL({ size: n })} />
        </label>
      </>
    );
  } else if (sel.type === 'furniture') {
    const f = (page.furniture ?? [])[sel.index];
    if (!f) return null;
    const setF = (patch: Partial<typeof f>) =>
      editPage((pg) => ({ ...pg, furniture: (pg.furniture ?? []).map((x, i) => (i === sel.index ? { ...x, ...patch } : x)) }));
    body = (
      <>
        <strong>{t('furniture.' + f.kind)}</strong>
        <label className="field">
          <span>{t('plan.item.kind')}</span>
          <select
            value={f.kind}
            onChange={(e) => {
              const k = e.target.value as FurnitureKind;
              setF({ kind: k, w: FURNITURE[k].w, h: FURNITURE[k].h });
            }}
          >
            {(Object.keys(FURNITURE) as FurnitureKind[]).map((k) => (
              <option key={k} value={k}>
                {t('furniture.' + k)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('plan.item.width')}</span>
          <NumberField min={10} value={Number(cm(f.w))} onCommit={(n) => setF({ w: n * 10 })} />
        </label>
        <label className="field">
          <span>{t('plan.item.depth')}</span>
          <NumberField min={10} value={Number(cm(f.h))} onCommit={(n) => setF({ h: n * 10 })} />
        </label>
        <div className="row">
          <button onClick={() => setF({ angle: (f.angle + 270) % 360 })} title="-90°">
            ⟲ 90°
          </button>
          <button onClick={() => setF({ angle: (f.angle + 90) % 360 })} title="+90°">
            ⟳ 90°
          </button>
          <button
            onClick={() => editPage((pg) => ({ ...pg, furniture: [...(pg.furniture ?? []), { ...f, id: Math.random().toString(36).slice(2), center: { x: f.center.x + 300, y: f.center.y + 300 } }] }))}
          >
            {t('action.duplicate')}
          </button>
        </div>
        <p className="muted small">{t('plan.item.furnitureHelp')}</p>
      </>
    );
  } else {
    body = <strong>{t('plan.item.image')}</strong>;
  }

  return (
    <div className="plan-item-panel">
      {body}
      <button className="danger" onClick={onDelete}>
        {t('plan.deleteItem')}
      </button>
    </div>
  );
}
