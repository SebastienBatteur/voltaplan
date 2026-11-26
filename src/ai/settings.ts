import { useSyncExternalStore } from 'react';
/**
 * Réglages de l'IA (optionnelle). Enregistrés localement (navigateur, ou dossier de l'application de bureau),
 * jamais dans les fichiers de projet : ceux-ci sont transmis à des tiers (organisme agréé, client).
 */
import { STORAGE_PREFIX } from '../brand';
import type { SealedSecret } from './secureStore';
import { isLocalUrl, PROVIDERS, type ProviderConfig, type ProviderId } from './provider';

/** Ce que l'utilisateur autorise l'IA à générer. Tout est désactivé par défaut. */
export interface AiPermissions {
  /** Plan : noms de pièces et pictogrammes électriques à partir d'une photo ou d'un PDF de plan (après l'OCR local). */
  planFromPhoto: boolean;
  /** Compteur : tension et phases lues sur la photo de la plaque, quand l'OCR local n'a pas tout lu. */
  meterFromPhoto: boolean;
  /** Disposition des modules à partir d'une photo du tableau. */
  boardFromPhoto: boolean;
  /** Schéma unifilaire à partir d'un ancien dossier (PDF, photo). */
  unifilarFromDocument: boolean;
  /** Suggestions de correction des non-conformités. */
  fixSuggestions: boolean;
}

export interface AiSettings {
  enabled: boolean;
  provider: ProviderId;
  model: string;
  /** API compatible OpenAI : adresse (ex. https://api.openai.com/v1, http://localhost:11434/v1 pour Ollama). */
  baseUrl?: string;
  key?: SealedSecret;
  permissions: AiPermissions;
}

export const DEFAULT_AI: AiSettings = {
  enabled: false,
  provider: 'anthropic',
  model: 'claude-opus-5-5',
  permissions: { planFromPhoto: false, meterFromPhoto: false, boardFromPhoto: false, unifilarFromDocument: false, fixSuggestions: false },
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

/** L'IA peut-elle être appelée ? (activée, et clé déverrouillée si le fournisseur en exige une) */
export function aiReady(s: AiSettings, unlocked: boolean): boolean {
  return s.enabled && (unlocked || !PROVIDERS[s.provider]?.needsKey(s));
}

/**
 * État de l'IA pour un usage : `ready` (configuration d'appel fournie), `off` (désactivée ou usage non autorisé),
 * `locked` (clé à déverrouiller), `offline` (pas de réseau, et pas de modèle local).
 */
export function aiFor(perm: keyof AiPermissions): { state: 'ready'; config: ProviderConfig } | { state: 'off' | 'locked' | 'offline' } {
  const s = loadAiSettings();
  if (!s.enabled || !s.permissions[perm]) return { state: 'off' };
  const key = getSessionKey();
  if (!aiReady(s, key !== null)) return { state: 'locked' };
  const online = typeof navigator === 'undefined' || navigator.onLine !== false;
  if (!online && !(s.provider === 'openaiCompatible' && isLocalUrl(s.baseUrl ?? ''))) return { state: 'offline' };
  return { state: 'ready', config: { provider: s.provider, model: s.model, baseUrl: s.baseUrl, apiKey: key ?? undefined } };
}
