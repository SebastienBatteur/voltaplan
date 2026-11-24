/**
 * Modifications concurrentes : un enregistrement n'écrase jamais une version que l'utilisateur n'a pas vue.
 *
 * Chaque emplacement mémorise, à l'ouverture et après chaque enregistrement, l'identifiant de version du fichier
 * (eTag OneDrive, rev Dropbox, version Google Drive, sha GitHub, date de modification d'un fichier local,
 * révision IndexedDB). L'enregistrement suivant est conditionnel : si le fichier a changé entre-temps, le
 * fournisseur refuse (ou la comparaison échoue) et une `ConflictError` est levée. Voltaplan enregistre alors la
 * version en cours sous un autre nom (copie de conflit) : les deux versions sont conservées, l'utilisateur choisit.
 * Aucune fusion automatique.
 */

/** Le fichier a été modifié ailleurs depuis son ouverture (ou son dernier enregistrement ici). */
export class ConflictError extends Error {
  constructor(
    readonly where: string,
    readonly detail?: string,
  ) {
    super(`Conflit : ${where} a été modifié ailleurs${detail ? ` (${detail})` : ''}.`);
    this.name = 'ConflictError';
  }
}

export const isConflict = (e: unknown): e is ConflictError => e instanceof ConflictError;

/**
 * Connexion au service à refaire : jeton expiré ou révoqué (401), ou fenêtre de connexion bloquée par le
 * navigateur (une connexion ne peut s'ouvrir qu'après un clic). Rien n'est perdu : la version reste dans le
 * navigateur et l'enregistrement est repris au prochain clic sur « Enregistrer ».
 */
export class AuthError extends Error {
  constructor(readonly where: string) {
    super(`Connexion à ${where} à refaire.`);
    this.name = 'AuthError';
  }
}

export const isAuthError = (e: unknown): e is AuthError => e instanceof AuthError;

/**
 * Espace de stockage du navigateur plein (IndexedDB, localStorage ; aussi `write()` d'un fichier File System
 * Access, voir StorageFullError). Chrome, Safari : `QuotaExceededError` ; Firefox : `NS_ERROR_DOM_QUOTA_REACHED`
 * (localStorage) ; anciens navigateurs : code 22. Une erreur qui en enveloppe une autre (`cause`) est examinée aussi.
 */
export function isQuotaError(e: unknown, depth = 0): boolean {
  if (!e || typeof e !== 'object' || depth > 3) return false;
  const n = (e as { name?: string }).name;
  if (n === 'QuotaExceededError' || n === 'NS_ERROR_DOM_QUOTA_REACHED' || (e as { code?: number }).code === 22) return true;
  return isQuotaError((e as { cause?: unknown }).cause, depth + 1);
}

/**
 * Plus de place à la destination : disque de l'appareil plein (`where: 'device'`), espace du service épuisé
 * (OneDrive 507 `quotaLimitReached`, Dropbox `insufficient_space`, Google Drive 403 `storageQuotaExceeded`).
 * Rien n'est perdu : la version est gardée dans le navigateur ; l'envoi n'est PAS remis en attente (il échouerait
 * de nouveau) : l'utilisateur libère de la place puis clique sur « Enregistrer ».
 */
export class StorageFullError extends Error {
  constructor(
    readonly where: string,
    readonly detail?: string,
  ) {
    super(`Plus de place : ${where}${detail ? ` (${detail})` : ''}.`);
    this.name = 'StorageFullError';
  }
}

/** Fichier trop gros pour la destination (GitHub : 100 Mo par fichier avec l'API « contents »). */
export class FileTooLargeError extends Error {
  constructor(
    readonly where: string,
    readonly size: number,
    readonly limit: number,
  ) {
    super(`Fichier trop gros pour ${where} : ${size} octets (limite ${limit}).`);
    this.name = 'FileTooLargeError';
  }
}

/** Destination pleine ou fichier trop gros : à ne jamais réessayer automatiquement. */
export const isDestinationFull = (e: unknown): e is StorageFullError | FileTooLargeError => e instanceof StorageFullError || e instanceof FileTooLargeError;

/**
 * Réponse d'un service signalant un espace épuisé (corps lu par l'appelant, tronqué). Comportements d'après la
 * documentation des services, testés avec des réponses simulées [à vérifier avec de vrais comptes] :
 *  - OneDrive (Microsoft Graph) : 507 Insufficient Storage, code `quotaLimitReached` ;
 *  - Dropbox : 409 avec `insufficient_space` dans `error_summary` (ex. « path/insufficient_space/ ») ;
 *  - Google Drive : 403 avec la raison `storageQuotaExceeded`.
 */
export function cloudQuotaReached(status: number, body: string): boolean {
  if (status === 507) return true;
  if (/quotaLimitReached|insufficient_space|storageQuotaExceeded/.test(body)) return status === 403 || status === 409 || status === 400 || status === 413;
  return false;
}

/**
 * Erreur réseau (hors ligne, DNS, coupure) : `fetch` rejette avec une TypeError, sans réponse du serveur.
 * Dans ce cas, l'enregistrement est mis en attente et repris au retour du réseau.
 */
export function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError || (typeof navigator !== 'undefined' && navigator.onLine === false);
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Nom de la copie de conflit, dans le même dossier : « Maison (conflit 2026-11-24 14h02).voltaplan ».
 * L'extension est conservée ; un suffixe de conflit précédent est remplacé (pas d'empilement).
 */
export function conflictName(name: string, date = new Date(), label = 'conflit'): string {
  const m = /^(.*?)(\.[A-Za-z0-9]{1,12})?$/.exec(name.trim()) ?? [name, name, ''];
  const base = (m[1] || 'projet').replace(/\s*\((?:conflit|conflict|conflict-kopie|conflictkopie)[^)]*\)\s*$/i, '');
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}h${pad(date.getMinutes())}`;
  return `${base} (${label} ${stamp})${m[2] ?? ''}`;
}
