import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { syncProject, type SyncReport } from '../model/sync';
import { useModalDialog } from './a11y';

/**
 * Bouton « Mettre à jour » : après une nouvelle installation ou l'ajout de circuits, pose les nouveaux
 * appareils dans le tableau et les nouveaux points sur le plan, et ajoute une révision au dossier.
 * Le résultat est affiché ; « Annuler » revient en arrière en une fois.
 */
export function SyncDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useModalDialog(onClose);
  const t = useStore((s) => s.t);
  const [report, setReport] = useState<SyncReport | null>(null);

  const done = useRef(false);
  useEffect(() => {
    if (done.current) return; // une seule fois (React StrictMode appelle l'effet deux fois en développement)
    done.current = true;
    const { project, applyProject } = useStore.getState();
    const r = syncProject(project, {
      today: new Date().toISOString().slice(0, 10),
      firstRevisionText: t('project.revInitial'),
      revisionText: (list) => t('sync.revText', { list }),
    });
    const changed = r.report.newNodes > 0 || r.report.boardPlaced > 0 || r.report.planByRoom + r.report.planToPlace > 0 || !!r.report.revision;
    if (changed) applyProject(() => r.project);
    setReport(r.report);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!report) return null;
  const r = report;
  const items: string[] = [];
  items.push(
    r.firstSync
      ? t('sync.first', { n: r.newNodes })
      : r.newNodes
        ? t('sync.new', {
            n: r.newNodes,
            list: r.newCircuits.join(', ') || '—',
          })
        : t('sync.nothingNew'),
  );
  if (r.boardPlaced) items.push(t('sync.board', { n: r.boardPlaced }));
  if (r.boardNoRoom) items.push(t('sync.boardNoRoom', { n: r.boardNoRoom }));
  if (r.planByRoom) items.push(t('sync.planRoom', { n: r.planByRoom }));
  if (r.planToPlace) items.push(t('sync.planToPlace', { n: r.planToPlace }));
  if (r.revision) items.push(t('sync.revision', { v: r.revision }));
  items.push(t('sync.derived'));
  const changed = r.newNodes > 0 || r.boardPlaced > 0 || r.planByRoom + r.planToPlace > 0 || !!r.revision;
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" ref={dialogRef} aria-label={t('sync.title')}>
        <h2>{t('sync.title')}</h2>
        <ul className="sync-list">
          {items.map((s, i) => (
            <li key={i} className={i === items.length - 1 ? 'muted small' : undefined}>
              {s}
            </li>
          ))}
        </ul>
        <div className="row end">
          {changed && (
            <button
              onClick={() => {
                useStore.getState().undo();
                onClose();
              }}
            >
              {t('menu.undo')}
            </button>
          )}
          <button className="primary" onClick={onClose}>
            {t('sync.ok')}
          </button>
        </div>
      </div>
    </div>
  );
}
