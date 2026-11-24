/**
 * Coffre chiffré pour la clé d'API de l'IA.
 *
 * - La clé ne quitte jamais l'ordinateur : pas de serveur. Elle est envoyée uniquement au fournisseur d'IA
 *   choisi, directement depuis l'application, au moment d'une demande.
 * - Elle est chiffrée (AES-GCM 256 bits) avec une clé dérivée d'une phrase secrète (PBKDF2-SHA-256,
 *   600 000 itérations, sel aléatoire). Sans la phrase secrète, le contenu enregistré est inutilisable.
 * - La phrase secrète n'est jamais enregistrée ; la clé déchiffrée reste en mémoire le temps de la session.
 *
 * Le format est un petit objet JSON, qu'on peut garder dans les réglages locaux (par défaut)
 * ou, si l'utilisateur le demande, dans un fichier de configuration à part.
 */

export interface SealedSecret {
  v: 1;
  alg: 'AES-GCM/PBKDF2-SHA256';
  iter: number;
  salt: string; // base64
  iv: string; // base64
  data: string; // base64 (texte chiffré + étiquette d'authentification)
}

const ITER = 600_000;

const b64 = (b: ArrayBuffer | Uint8Array) => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = '';
  for (const c of u) s += String.fromCharCode(c);
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(passphrase: string, salt: BufferSource, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function seal(secret: string, passphrase: string, iter = ITER): Promise<SealedSecret> {
  if (passphrase.length < 8) throw new Error('La phrase secrète doit contenir au moins 8 caractères.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(passphrase, salt, iter);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(secret));
  return { v: 1, alg: 'AES-GCM/PBKDF2-SHA256', iter, salt: b64(salt), iv: b64(iv), data: b64(data) };
}

/** Déchiffre ; lève une erreur si la phrase secrète est fausse (l'authentification AES-GCM échoue). */
export async function unseal(sealed: SealedSecret, passphrase: string): Promise<string> {
  const key = await derive(passphrase, unb64(sealed.salt), sealed.iter);
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(sealed.iv) }, key, unb64(sealed.data));
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error('Phrase secrète incorrecte.');
  }
}

/** Affichage sûr d'une clé : « sk-ant-…a1b2 ». */
export function maskKey(key: string): string {
  return key.length <= 10 ? '••••' : key.slice(0, 7) + '…' + key.slice(-4);
}
