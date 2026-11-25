/**
 * Tailles maximales des fichiers importés (projet, Trikker, image, PDF).
 * Un fichier trop gros (ou piégé) bloquerait l'onglet : on le refuse avant de le lire, avec un message clair.
 */

const MB = 1024 * 1024;

export type ImportKind = 'project' | 'trik' | 'image' | 'pdf' | 'dxf';

export const IMPORT_LIMITS: Record<ImportKind, number> = {
  project: 50 * MB,
  trik: 20 * MB,
  image: 25 * MB,
  pdf: 50 * MB,
  dxf: 30 * MB,
};

/** Image décodée : au-delà, la mémoire nécessaire (4 octets par pixel) devient déraisonnable. */
export const MAX_IMAGE_PIXELS = 100_000_000;

export class FileTooLargeError extends Error {
  constructor(
    readonly fileName: string,
    readonly size: number,
    readonly max: number,
  ) {
    super(`Fichier trop volumineux : ${fileName} (${formatMb(size)} Mo, maximum ${formatMb(max)} Mo).`);
    this.name = 'FileTooLargeError';
  }
}

export function formatMb(bytes: number): string {
  const v = bytes / MB;
  return v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
}

/** Genre d'un fichier choisi, d'après son nom et son type. */
export function importKind(file: { name: string; type?: string }): ImportKind {
  if (/\.trik$/i.test(file.name)) return 'trik';
  if (/\.dxf$/i.test(file.name)) return 'dxf';
  if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') return 'pdf';
  if (file.type?.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|heic|heif|tiff?|avif)$/i.test(file.name)) return 'image';
  return 'project';
}

/** Refuse un fichier trop gros pour son genre (deviné si non précisé). */
export function checkFileSize(file: { name: string; size: number; type?: string }, kind: ImportKind = importKind(file)): void {
  const max = IMPORT_LIMITS[kind];
  if (file.size > max) throw new FileTooLargeError(file.name, file.size, max);
}

/** Même contrôle pour un projet reçu sous forme de texte (navigateur, GitHub, Drive…). */
export function checkTextSize(text: string, name = 'projet', kind: ImportKind = 'project'): void {
  // Longueur en caractères UTF-16 : borne basse de la taille en octets, suffisante ici.
  const max = IMPORT_LIMITS[kind];
  if (text.length > max) throw new FileTooLargeError(name, text.length, max);
}

/** Refuse une image dont le décodage demanderait trop de mémoire. */
export function checkImagePixels(name: string, w: number, h: number): void {
  if (w * h > MAX_IMAGE_PIXELS) throw new FileTooLargeError(name, w * h * 4, MAX_IMAGE_PIXELS * 4);
}

/** Message d'erreur à afficher, traduit pour les erreurs connues. */
export function importErrorText(e: unknown, t: (key: 'import.tooLarge', params?: Record<string, string | number>) => string): string {
  if (e instanceof FileTooLargeError) return t('import.tooLarge', { name: e.fileName, size: formatMb(e.size), max: formatMb(e.max) });
  return e instanceof Error ? e.message : String(e);
}
