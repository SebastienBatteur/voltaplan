import { useSyncExternalStore } from 'react';
/**
 * Réglages de l'IA (optionnelle). Enregistrés localement (navigateur, ou dossier de l'application de bureau),
 * jamais dans les fichiers de projet : ceux-ci sont transmis à des tiers (organisme agréé, client).
 */
import { STORAGE_PREFIX } from '../brand';
import type { SealedSecret } from './secureStore';

/** Ce que l'utilisateur autorise l'IA à générer. Tout est désactivé par défaut. */
export interface AiPermissions {
  /** Murs, portes et fenêtres à partir d'une photo ou d'un PDF de plan. */
  planFromPhoto: boolean;
  /** Disposition des modules à partir d'une photo du tableau. */
  boardFromPhoto: boolean;
  /** Schéma unifilaire à partir d'un ancien dossier (PDF, photo). */
  unifilarFromDocument: boolean;
  /** Suggestions de correction des non-conformités. */
  fixSuggestions: boolean;
}

export interface AiSettings {
  enabled: boolean;
  provider: 'anthropic';
  model: string;
  key?: SealedSecret;
  permissions: AiPermissions;
}

export const DEFAULT_AI: AiSettings = {
  enabled: false,
  provider: 'anthropic',
  model: 'claude-opus-5-5',
  permissions: { planFromPhoto: false, boardFromPhoto: false, unifilarFromDocument: false, fixSuggestions: false },
};

const KEY = STORAGE_PREFIX + 'ai';

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_AI;
    const s = JSON.parse(raw) as Partial<AiSettings>;
    return { ...DEFAULT_AI, ...s, permissions: { ...DEFAULT_AI.permissions, ...s.permissions } };
  } catch {
    return DEFAULT_AI;
  }
}

export function saveAiSettings(s: AiSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* stockage indisponible (navigation privée) : réglages pour cette session seulement */
  }
}

/** Clé déchiffrée, en mémoire uniquement (perdue à la fermeture de l'application). */
let sessionKey: string | null = null;
const listeners = new Set<() => void>();
export const getSessionKey = () => sessionKey;
export const setSessionKey = (k: string | null) => {
  sessionKey = k;
  listeners.forEach((l) => l());
};
/** Abonnement aux changements de la clé déverrouillée (pour `useSyncExternalStore`). */
export const subscribeSessionKey = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
/** Vrai tant que la clé de l'IA est déverrouillée pour cette session ; l'interface se met à jour d'elle-même. */
export const useAiUnlocked = () => useSyncExternalStore(subscribeSessionKey, () => sessionKey !== null);
