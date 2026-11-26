import { useState } from 'react';
import { useStore } from '../store';
import { pickFile } from '../io/files';
import { checkFileSize } from '../io/limits';
import type { MeterOutcome } from '../ocr/meter';
import { PhotoAdvice } from './PhotoAdvice';

/**
 * Lecture de la plaque du compteur, en une seule étape : lecture locale (OCR, aucune image envoyée), puis l'IA
 * seulement si la lecture locale est incomplète et que l'IA est configurée pour cet usage. L'alimentation lue est
 * PROPOSÉE ; une photo insuffisante donne sa raison et la façon de la refaire.
 */
export function MeterOcr({ onApply }: { onApply: (supply: string) => void }) {
  const t = useStore((s) => s.t);
  const lang = useStore((s) => s.lang);
  const [busy, setBusy] = useState<number | null>(null);
  const [out, setOut] = useState<MeterOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    const file = await pickFile('image/*');
    if (!file) return;
    setError(null);
    setOut(null);
    setBusy(0);
    try {
      checkFileSize(file, 'image');
      const { readMeter } = await import('../ocr/meter');
      setOut(await readMeter(file, lang, (f) => setBusy(f)));
    } catch (e) {
      setError(t('ocr.error', { msg: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(null);
    }
  };

  const apply = (s: string) => {
    onApply(s);
    setOut(null);
  };
  const r = out?.plate;
  const aiNote =
    out?.ai === 'locked' ? t('ocr.aiLocked') : out?.ai === 'offline' ? t('ocr.aiOffline') : out?.ai === 'error' ? t('ocr.aiError', { msg: out.aiError ?? '' }) : '';

  return (
    <div className="ocr-box">
      <button type="button" onClick={() => void run()} disabled={busy !== null} title={t('ocr.meterHelp')}>
        {t('ocr.meter')}
      </button>
      {busy !== null && (
        <p className="muted small" role="status">
          {busy > 0 ? t('ocr.reading', { pct: Math.round(busy * 100) }) : t('ocr.loading')}
        </p>
      )}
      {error && <p className="error-text small">{error}</p>}
      {out && r && (
        <div className="ocr-result" role="status">
          {r.evidence.length > 0 && <p className="small">{t('ocr.readOn', { what: r.evidence.join(' · ') })}</p>}
          {r.supply ? (
            <p>
              <strong>{t('ocr.proposeSupply', { supply: r.supply })}</strong>{' '}
              <button type="button" className="primary" onClick={() => apply(r.supply!)}>
                {t('ocr.apply')}
              </button>{' '}
              <button type="button" onClick={() => setOut(null)}>
                {t('ocr.dismiss')}
              </button>
            </p>
          ) : r.options ? (
            <p>
              <strong>{t('ocr.threePhase')}</strong>{' '}
              {r.options.map((o) => (
                <button key={o} type="button" onClick={() => apply(o)}>
                  {o}
                </button>
              ))}{' '}
              <button type="button" onClick={() => setOut(null)}>
                {t('ocr.dismiss')}
              </button>
            </p>
          ) : (
            <p className="muted small">{t('ocr.nothing')}</p>
          )}
          <p className="muted small">{out.source === 'ai' ? t('ocr.byAi') : t('ocr.byOcr')}</p>
          {aiNote && <p className="muted small">{aiNote}</p>}
          <PhotoAdvice issues={out.issues} />
        </div>
      )}
    </div>
  );
}
