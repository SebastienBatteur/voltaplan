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
