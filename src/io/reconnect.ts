/**
 * R2 (docs/oauth-jetons.md, décision du 2026-11-25) : bandeau discret de reconnexion au service cloud du projet
 * courant, AVANT que la session expire. Fonction pure : quand l'afficher, et avec quel texte.
 *
 * Exigences retenues par le propriétaire :
 *  1. discret et non bloquant ; 2. seulement pour le service cloud du projet courant ; 3. reconnexion en un clic ;
 *  4. aucune interruption du travail (pas de focus pris, pas de boîte de dialogue) ; 5. modifications non
 *  enregistrées intégralement conservées (la fenêtre de connexion ne recharge jamais la page) ; 6. aucune
 *  notification répétitive : une seule apparition par échéance de jeton ; fermé, il ne revient qu'à l'échéance
 *  suivante (nouveau jeton).
 */
import type { CloudId } from './cloud';

/** Le bandeau apparaît 5 minutes avant l'échéance (déjà avancée de 60 s par cloud.ts). */
export const RECONNECT_WARN_MS = 5 * 60_000;

export type ReconnectState = { kind: 'hidden' } | { kind: 'soon'; minutes: number } | { kind: 'expired' };

export function reconnectState(p: {
  /** Service cloud du projet courant ; null si le projet est ailleurs (appareil, navigateur, GitHub). */
  provider: CloudId | null;
  /** Échéance du jeton de CE service (cloudTokenExpiry) ; null si aucune connexion dans cet onglet. */
  expires: number | null;
  /** Échéance pour laquelle l'utilisateur a fermé le bandeau ; null sinon. */
  dismissedFor: number | null;
  now: number;
}): ReconnectState {
  if (!p.provider || p.expires === null) return { kind: 'hidden' };
  if (p.dismissedFor === p.expires) return { kind: 'hidden' };
  const left = p.expires - p.now;
  if (left > RECONNECT_WARN_MS) return { kind: 'hidden' };
  if (left <= 0) return { kind: 'expired' };
  return { kind: 'soon', minutes: Math.max(1, Math.ceil(left / 60_000)) };
}
