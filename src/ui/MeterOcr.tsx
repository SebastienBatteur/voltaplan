import { useState } from 'react';
import { useStore } from '../store';
import { pickFile } from '../io/files';
import { checkFileSize } from '../io/limits';
import type { MeterPlate } from '../ocr/parse';

/**
 * Lecture de la plaque du compteur par l'OCR local (aucune IA, aucune image envoyée) : l'alimentation lue est
 * PROPOSÉE, l'utilisateur l'accepte ou l'ignore.
 */
export function MeterOcr({ onApply }: { onApply: (supply: string) => void }) {
  const t = useStore((s) => s.t);
  const [busy, setBusy] = useState<number | null>(null);
  const [result, setResult] = useState<MeterPlate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    const file = await pickFile('image/*');
    if (!file) return;
    setError(null);
    setResult(null);
    setBusy(0);
    try {
      checkFileSize(file, 'image');
      const { readMeter } = await import('../ocr/meter');
      setResult(await readMeter(file, (f) => setBusy(f)));
    } catch (e) {
      setError(t('ocr.error', { msg: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(null);
    }
  };

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
      {result && (
        <div className="ocr-result" role="status">
          {result.evidence.length > 0 && <p className="small">{t('ocr.readOn', { what: result.evidence.join(' · ') })}</p>}
          {result.supply ? (
            <p>
              <strong>{t('ocr.proposeSupply', { supply: result.supply })}</strong>{' '}
              <button
                type="button"
                className="primary"
                onClick={() => {
                  onApply(result.supply!);
                  setResult(null);
                }}
              >
                {t('ocr.apply')}
              </button>{' '}
              <button type="button" onClick={() => setResult(null)}>
                {t('ocr.dismiss')}
              </button>
            </p>
          ) : result.options ? (
            <p>
              <strong>{t('ocr.threePhase')}</strong>{' '}
              {result.options.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => {
                    onApply(o);
                    setResult(null);
                  }}
                >
                  {o}
                </button>
              ))}{' '}
              <button type="button" onClick={() => setResult(null)}>
                {t('ocr.dismiss')}
              </button>
            </p>
          ) : (
            <p className="muted small">{t('ocr.nothing')}</p>
          )}
        </div>
      )}
    </div>
  );
}
