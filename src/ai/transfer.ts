/**
 * Transfert de la configuration de l'IA d'un appareil à l'autre (ordinateur, téléphone, application de bureau),
 * sans serveur : un lien `…/app/#ia=<code>` (montré en QR code) ou le code seul, à coller.
 *
 * - La clé d'API reste **chiffrée par la phrase secrète** (format de `secureStore`, AES-GCM + PBKDF2) : le lien ne
 *   la contient jamais en clair ; l'appareil qui reçoit demande la phrase secrète pour vérifier et déverrouiller.
 * - Le code est placé après « # » : un navigateur n'envoie jamais cette partie de l'adresse au serveur. Il est
 *   retiré de la barre d'adresse dès l'ouverture.
 * - Seuls les réglages connus sont repris (fournisseur, modèle, adresse, clé chiffrée, autorisations) ; un code
 *   abîmé ou étranger est refusé.
 */
import { PROVIDERS, type ProviderId } from './provider';
import type { AiPermissions, AiSettings } from './settings';
import type { SealedSecret } from './secureStore';

/** Adresse publique de l'application web (lien lisible par l'appareil photo d'un téléphone). */
export const PUBLIC_APP_URL = 'https://voltaplan.org/app/';
const PREFIX = 'ia=';

const toB64Url = (s: string) => {
  let bin = '';
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64Url = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

/** Réglages transportés (sans « activé » : l'appareil qui reçoit active l'IA en important). */
interface Payload {
  v: 1;
  provider: ProviderId;
  model: string;
  baseUrl?: string;
  key?: SealedSecret;
  permissions: AiPermissions;
}

export function encodeAiTransfer(s: AiSettings): string {
  const p: Payload = { v: 1, provider: s.provider, model: s.model, permissions: s.permissions };
  if (s.baseUrl) p.baseUrl = s.baseUrl;
  if (s.key) p.key = s.key;
  return toB64Url(JSON.stringify(p));
}

/**
 * Lien à ouvrir sur l'autre appareil : l'adresse de cette page si elle est publiée (https), l'adresse publique sinon
 * (application de bureau sur tauri.localhost, serveur local : un téléphone ne pourrait pas les ouvrir).
 */
export function aiTransferLink(s: AiSettings, here: { protocol: string; hostname: string; origin: string; pathname: string } = location): string {
  const base = here.protocol === 'https:' && !/(^|\.)localhost$/.test(here.hostname) ? here.origin + here.pathname : PUBLIC_APP_URL;
  return `${base}#${PREFIX}${encodeAiTransfer(s)}`;
}

const isStr = (x: unknown): x is string => typeof x === 'string';

/**
 * Lit un lien complet, un fragment « #ia=… » ou le code seul. Lève une erreur si le contenu n'est pas une
 * configuration Voltaplan valide.
 */
export function decodeAiTransfer(text: string): Omit<AiSettings, 'enabled'> {
  const t = text.trim();
  const i = t.indexOf('#' + PREFIX);
  const code = i >= 0 ? t.slice(i + 1 + PREFIX.length) : t.startsWith(PREFIX) ? t.slice(PREFIX.length) : t;
  let p: Payload;
  try {
    p = JSON.parse(fromB64Url(code.replace(/\s+/g, '')));
  } catch {
    throw new Error('invalid');
  }
  if (!p || p.v !== 1 || !(p.provider in PROVIDERS) || !isStr(p.model) || (p.baseUrl !== undefined && !isStr(p.baseUrl))) throw new Error('invalid');
  const k = p.key;
  if (k !== undefined && !(k && k.v === 1 && isStr(k.alg) && Number.isFinite(k.iter) && isStr(k.salt) && isStr(k.iv) && isStr(k.data))) throw new Error('invalid');
  const perms = p.permissions ?? ({} as AiPermissions);
  const permissions: AiPermissions = {
    planFromPhoto: perms.planFromPhoto === true,
    boardFromPhoto: perms.boardFromPhoto === true,
    unifilarFromDocument: perms.unifilarFromDocument === true,
    fixSuggestions: perms.fixSuggestions === true,
  };
  return { provider: p.provider, model: p.model, baseUrl: p.baseUrl, key: k, permissions };
}

/**
 * Configuration reçue par l'adresse (« #ia=… ») : rendue une seule fois, et retirée de la barre d'adresse tout de
 * suite. `null` sinon.
 */
export function takeAiTransferFromLocation(loc: Location = location, hist: History = history): string | null {
  if (!loc.hash.startsWith('#' + PREFIX)) return null;
  const code = loc.hash.slice(1);
  hist.replaceState(hist.state, '', loc.pathname + loc.search);
  return code;
}
