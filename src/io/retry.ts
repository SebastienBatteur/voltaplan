/**
 * Reprise d'un enregistrement en attente (pas de réseau).
 *
 * L'évènement `online` ne suffit pas : sous Windows, quand une autre carte réseau reste active (câble, carte
 * virtuelle), le navigateur ne signale ni la coupure du Wi-Fi ni son retour (`navigator.onLine` reste vrai). La
 * séance réelle du 2026-11-25 l'a montré (écart S4, docs/tests-cloud-reels.md) : l'envoi restait en attente jusqu'au
 * clic suivant. On réessaie donc aussi à intervalles croissants, sans jamais lancer deux envois à la fois.
 */

/** Délais entre deux essais : 10 s, 30 s, 1 min, 2 min, puis toutes les 5 min. */
export const RETRY_DELAYS_MS = [10_000, 30_000, 60_000, 120_000, 300_000];

/** Délai avant l'essai numéro `attempt` (0 pour le premier). */
export function retryDelay(attempt: number, delays: readonly number[] = RETRY_DELAYS_MS): number {
  return delays[Math.min(Math.max(0, attempt), delays.length - 1)];
}

/**
 * Lance les essais. `run` envoie et renvoie `true` si l'envoi est toujours en attente (on continue), `false` sinon
 * (enregistré, conflit traité, connexion à refaire, erreur : on s'arrête). Au retour du réseau (`online`), essai
 * immédiat. Renvoie la fonction d'arrêt.
 */
export function startRetries(run: () => Promise<boolean>, opts: { target?: EventTarget; delays?: readonly number[] } = {}): () => void {
  const target = opts.target ?? (typeof window === 'undefined' ? undefined : window);
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let stopped = false;

  const schedule = () => {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(() => void tryNow(), retryDelay(attempt, opts.delays));
  };
  const tryNow = async () => {
    if (stopped || running) return;
    clearTimeout(timer);
    running = true;
    attempt++;
    const again = await run().then(
      (v) => v,
      () => false,
    );
    running = false;
    if (again) schedule();
    else stop();
  };
  const onOnline = () => void tryNow();
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    target?.removeEventListener('online', onOnline);
  };

  target?.addEventListener('online', onOnline);
  schedule();
  return stop;
}
