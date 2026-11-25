/**
 * Écart S4 de la séance réelle du 2026-11-25 (docs/tests-cloud-reels.md) : sous Windows, le navigateur n'a signalé
 * ni la coupure du Wi-Fi ni son retour ; l'envoi en attente ne repartait qu'au clic suivant. La reprise essaie
 * maintenant aussi à intervalles croissants (src/io/retry.ts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RETRY_DELAYS_MS, retryDelay, startRetries } from '../src/io/retry';

describe('délais de reprise', () => {
  it('croissants, puis plafonnés', () => {
    expect(RETRY_DELAYS_MS.map((_, i) => retryDelay(i))).toEqual([10_000, 30_000, 60_000, 120_000, 300_000]);
    expect(retryDelay(5)).toBe(300_000);
    expect(retryDelay(99)).toBe(300_000);
    expect(retryDelay(-1)).toBe(10_000);
  });
});

describe('startRetries', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sans évènement « online » : réessaie seul, à intervalles croissants, jusqu’à la réussite', async () => {
    const target = new EventTarget();
    const results = [true, true, false]; // en attente, en attente, enregistré
    const run = vi.fn(async () => results.shift() ?? false);
    startRetries(run, { target });

    await vi.advanceTimersByTimeAsync(9_999);
    expect(run).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1); // 10 s
    await vi.advanceTimersByTimeAsync(30_000);
    expect(run).toHaveBeenCalledTimes(2); // + 30 s
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).toHaveBeenCalledTimes(3); // + 60 s : enregistré
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(run).toHaveBeenCalledTimes(3); // plus rien ensuite
  });

  it('« online » : essai immédiat, sans attendre le délai', async () => {
    const target = new EventTarget();
    const run = vi.fn(async () => false);
    startRetries(run, { target });
    target.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('jamais deux envois à la fois', async () => {
    const target = new EventTarget();
    let finish: (v: boolean) => void = () => undefined;
    const run = vi.fn(() => new Promise<boolean>((r) => (finish = r)));
    startRetries(run, { target });
    target.dispatchEvent(new Event('online'));
    target.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(20_000); // le délai expire pendant l'envoi
    expect(run).toHaveBeenCalledTimes(1);
    finish(true); // toujours en attente : un nouvel essai est programmé
    await vi.advanceTimersByTimeAsync(30_000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('arrêt : plus aucun essai, ni au délai ni à « online »', async () => {
    const target = new EventTarget();
    const run = vi.fn(async () => true);
    const stop = startRetries(run, { target });
    stop();
    target.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(run).not.toHaveBeenCalled();
  });

  it('une erreur arrête les essais (affichée par l’appelant)', async () => {
    const target = new EventTarget();
    const run = vi.fn(async () => {
      throw new Error('quota');
    });
    startRetries(run, { target });
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
