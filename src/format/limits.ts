/**
 * Plafonds du format v2 (F5 : provisoires, à confirmer par les mesures ; docs/format-v2-performance.md).
 *
 * Les médias stockés sans compression ne sont jamais chargés en mémoire à l'ouverture (tranches du fichier) :
 * la taille de l'archive n'est donc pas limitée par la mémoire vive, mais par l'espace de stockage de l'appareil
 * (copie de travail) et par la mémoire nécessaire aux entrées compressées (décompressées en mémoire).
 * « 2 Go » est un plafond de sécurité, jamais une capacité garantie : les limites réelles sont calculées pour
 * l'appareil (`deviceLimits`) et expliquées à l'utilisateur.
 */
const MB = 1024 * 1024;

export interface ArchiveLimits {
  /** Taille décompressée maximale de project.json. */
  model: number;
  sources: number;
  manifest: number;
  readme: number;
  /** Une photo (tout type d'image). */
  image: number;
  pdf: number;
  derived: number;
  /** Somme des tailles décompressées déclarées. */
  total: number;
  /** Au-delà : avertissement (projet lourd pour un téléphone). */
  warnTotal: number;
  entries: number;
  /** Taux de compression maximal d'une entrée deflate de plus de `ratioMinSize` octets. */
  ratio: number;
  ratioMinSize: number;
  /** Entrée compressée (deflate) décompressée en mémoire : plafond selon la mémoire de l'appareil. */
  inflateInMemory: number;
}

export const DEFAULT_LIMITS: ArchiveLimits = {
  model: 50 * MB,
  sources: 20 * MB,
  manifest: 5 * MB,
  readme: 1 * MB,
  image: 50 * MB,
  pdf: 200 * MB,
  derived: 20 * MB,
  total: 2048 * MB,
  warnTotal: 500 * MB,
  entries: 10_000,
  ratio: 100,
  ratioMinSize: 1 * MB,
  inflateInMemory: 200 * MB,
};

export interface DeviceInfo {
  /** `navigator.deviceMemory` (Go, arrondi, Chromium seulement) ; null si inconnu. */
  memoryGb: number | null;
  /** `navigator.storage.estimate()` ; null si inconnu. */
  quota: number | null;
  usage: number | null;
}

/**
 * Limites adaptées à l'appareil (fonction pure, testée). Mémoire faible : les entrées compressées (rares : nos
 * médias sont stockés) sont plafonnées plus bas. L'espace disponible ne limite pas l'ouverture (lecture dans le
 * fichier) mais la copie de travail : voir `capacityAdvice`.
 */
export function deviceLimits(d: DeviceInfo, base: ArchiveLimits = DEFAULT_LIMITS): ArchiveLimits {
  const mem = d.memoryGb;
  const inflate = mem === null ? 100 * MB : mem <= 2 ? 50 * MB : mem <= 4 ? 100 * MB : base.inflateInMemory;
  return { ...base, inflateInMemory: Math.min(base.inflateInMemory, inflate), pdf: Math.min(base.pdf, Math.max(inflate, 100 * MB)) };
}

export type CapacityAdvice =
  | { level: 'ok' }
  /** Projet lourd : utilisable, mais lent sur un téléphone. */
  | { level: 'heavy'; size: number }
  /** L'espace libre ne permet pas d'en garder une copie de travail complète : documents lus depuis le fichier. */
  | { level: 'noWorkingCopy'; size: number; free: number }
  /** Au-delà du plafond de sécurité. */
  | { level: 'tooLarge'; size: number; max: number };

export function capacityAdvice(size: number, d: DeviceInfo, limits: ArchiveLimits = DEFAULT_LIMITS): CapacityAdvice {
  if (size > limits.total) return { level: 'tooLarge', size, max: limits.total };
  if (d.quota !== null && d.usage !== null) {
    const free = Math.max(0, d.quota - d.usage);
    // Marge de 20 % : le navigateur compte large, et les versions locales ont aussi besoin de place.
    if (size > free * 0.8) return { level: 'noWorkingCopy', size, free };
  }
  if (size > limits.warnTotal) return { level: 'heavy', size };
  return { level: 'ok' };
}

/** Informations de l'appareil courant (jamais d'exception). */
export async function currentDevice(): Promise<DeviceInfo> {
  let memoryGb: number | null = null;
  let quota: number | null = null;
  let usage: number | null = null;
  try {
    const m = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    if (typeof m === 'number' && m > 0) memoryGb = m;
    const e = await navigator.storage?.estimate?.();
    if (typeof e?.quota === 'number') quota = e.quota;
    if (typeof e?.usage === 'number') usage = e.usage;
  } catch {
    /* API absente */
  }
  return { memoryGb, quota, usage };
}

/** Plafond applicable à un document selon son type. */
export function assetLimit(ext: string, limits: ArchiveLimits): number {
  return ext === 'pdf' ? limits.pdf : limits.image;
}
