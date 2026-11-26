import { useStore } from '../store';
import type { QualityIssue } from '../ocr/quality';

/** Lecture incomplète : pourquoi, et comment refaire la photo (une ligne par problème). */
export function PhotoAdvice({ issues }: { issues: QualityIssue[] }) {
  const t = useStore((s) => s.t);
  if (!issues.length) return null;
  return (
    <div className="photo-advice" role="alert">
      <strong>{t('photo.retake')}</strong>
      <ul>
        {issues.map((i) => (
          <li key={i}>
            {t('photo.issue.' + i)} <em>{t('photo.fix.' + i)}</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Texte des problèmes de photo, pour un message simple (alerte, barre d'état). */
export function photoAdviceText(issues: QualityIssue[], t: (k: string) => string): string {
  return issues.length ? [t('photo.retake'), ...issues.map((i) => `• ${t('photo.issue.' + i)} ${t('photo.fix.' + i)}`)].join('\n') : '';
}
