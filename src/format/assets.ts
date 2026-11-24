/**
 * Stockage de travail local des documents (F4), indépendant de l'emplacement du fichier :
 *  - documents originaux IMMUABLES, rangés par empreinte SHA-256 : un seul exemplaire, quel que soit le nombre de
 *    projets, de brouillons ou de versions qui les référencent ; écrits une fois, jamais modifiés ;
 *  - cache d'images dérivées (affichage), régénérables : jamais la seule copie d'un document.
 *
 * Règle absolue : un document encore référencé par un projet du navigateur, un brouillon, une version gardée ou
 * le projet ouvert n'est JAMAIS supprimé. La recherche des références est volontairement large (toute empreinte
 * citée dans un modèle compte) : en cas de doute, on garde. Un document ajouté récemment est aussi gardé (délai de
 * grâce), le temps que le modèle qui le référence soit enregistré (brouillon d'un autre onglet, par exemple).
 *
 * La logique est ici, testée avec un magasin en mémoire ; le magasin IndexedDB est dans assetsIdb.ts.
 */
import { assetLimit, DEFAULT_LIMITS, type ArchiveLimits } from './limits';
import { ASSET_TYPES, sniffType, type AssetExt } from './manifest';
import { blobBytes, isSha256Hex, sha256Hex } from './sha256';

export interface AssetMeta {
  sha256: string;
  mime: string;
  size: number;
  /** Date d'ajout (ISO) : délai de grâce avant tout nettoyage. */
  addedAt: string;
  /** Nom d'origine (affichage, export en dossier), jamais un chemin. */
  name?: string;
}
export interface AssetRecord extends AssetMeta {
  blob: Blob;
}

export interface DerivedMeta {
  /** `<sha256 de l'original>-<rôle>` */
  key: string;
  of: string;
  role: string;
  sha256: string;
  mime: string;
  size: number;
  /** Dernière utilisation (ISO) : les plus anciens sont supprimés d'abord. */
  at: string;
}
export interface DerivedRecord extends DerivedMeta {
  blob: Blob;
}

/** Accès au stockage (IndexedDB en production, mémoire dans les tests). */
export interface AssetBackend {
  getAsset(sha: string): Promise<AssetRecord | undefined>;
  /** Écrit seulement si l'empreinte est absente (immuable). Renvoie true si l'écriture a eu lieu. */
  putAssetIfAbsent(rec: AssetRecord): Promise<boolean>;
  deleteAsset(sha: string): Promise<void>;
  listAssets(): Promise<AssetMeta[]>;
  getDerived(key: string): Promise<DerivedRecord | undefined>;
  putDerived(rec: DerivedRecord): Promise<void>;
  deleteDerived(key: string): Promise<void>;
  listDerived(): Promise<DerivedMeta[]>;
}

export class MemoryAssetBackend implements AssetBackend {
  assets = new Map<string, AssetRecord>();
  derived = new Map<string, DerivedRecord>();
  async getAsset(sha: string) {
    return this.assets.get(sha);
  }
  async putAssetIfAbsent(rec: AssetRecord) {
    if (this.assets.has(rec.sha256)) return false;
    this.assets.set(rec.sha256, rec);
    return true;
  }
  async deleteAsset(sha: string) {
    this.assets.delete(sha);
  }
  async listAssets() {
    return [...this.assets.values()].map(({ blob: _b, ...m }) => m);
  }
  async getDerived(key: string) {
    return this.derived.get(key);
  }
  async putDerived(rec: DerivedRecord) {
    this.derived.set(rec.key, rec);
  }
  async deleteDerived(key: string) {
    this.derived.delete(key);
  }
  async listDerived() {
    return [...this.derived.values()].map(({ blob: _b, ...m }) => m);
  }
}

export type AssetErrorCode = 'unsupportedType' | 'tooLarge' | 'verifyFailed' | 'shaMismatch' | 'referenced';

export class AssetStoreError extends Error {
  constructor(
    readonly code: AssetErrorCode,
    readonly detail = '',
  ) {
    super(`Document : ${code}${detail ? ' (' + detail + ')' : ''}`);
    this.name = 'AssetStoreError';
  }
}

/**
 * Empreintes référencées par un modèle (texte JSON de project.json, d'un brouillon, d'une version, ou de
 * sources.json). Recherche large et volontairement prudente : toute référence « asset:<sha> » et toute valeur
 * « sha256 » (sources de l'assistant) compte.
 */
export function referencedShas(text: string, into = new Set<string>()): Set<string> {
  for (const m of text.matchAll(/asset:([0-9a-f]{64})/g)) into.add(m[1]);
  for (const m of text.matchAll(/"sha256"\s*:\s*"([0-9a-f]{64})"/g)) into.add(m[1]);
  return into;
}

/** Où chercher les références avant toute suppression. */
export interface ReferenceSources {
  /** Textes des modèles gardés : projets du navigateur, brouillons, versions locales. */
  storedModels(): Promise<string[]>;
  /** Modèles ouverts en mémoire (onglet courant), non encore enregistrés. */
  openModels(): string[];
}

export async function allReferences(refs: ReferenceSources): Promise<Set<string>> {
  const set = new Set<string>();
  for (const t of await refs.storedModels()) referencedShas(t, set);
  for (const t of refs.openModels()) referencedShas(t, set);
  return set;
}

/** Délai de grâce : un document ajouté depuis moins longtemps n'est jamais nettoyé. */
export const GC_GRACE_MS = 7 * 24 * 3600 * 1000;

export class AssetStore {
  constructor(
    readonly backend: AssetBackend,
    private readonly opts: { now?: () => Date; limits?: ArchiveLimits } = {},
  ) {}

  private now() {
    return this.opts.now?.() ?? new Date();
  }

  /**
   * Ajoute un document : type vérifié par sa signature, taille plafonnée, empreinte calculée. S'il existe déjà
   * (même empreinte), rien n'est réécrit. Après l'écriture, le document est relu et vérifié (taille, empreinte)
   * AVANT d'être renvoyé : un modèle ne référence jamais un document mal enregistré.
   */
  async add(blob: Blob, opts: { name?: string; verify?: boolean } = {}): Promise<AssetMeta> {
    const ext = sniffType(await blobBytes(blob.slice(0, 16)));
    if (!ext) throw new AssetStoreError('unsupportedType', blob.type);
    const limits = this.opts.limits ?? DEFAULT_LIMITS;
    if (blob.size > assetLimit(ext, limits)) throw new AssetStoreError('tooLarge', String(blob.size));
    const sha = await sha256Hex(blob);
    return this.putVerified(sha, ext, blob, opts.name, opts.verify ?? true);
  }

  /**
   * Copie dans le stockage de travail un document venant d'une archive ou d'un dossier cloud, dont l'empreinte
   * est connue. L'empreinte est recalculée : jamais de document enregistré sous une empreinte qui n'est pas la
   * sienne.
   */
  async ingest(expectedSha: string, blob: Blob, name?: string): Promise<AssetMeta> {
    if (!isSha256Hex(expectedSha)) throw new AssetStoreError('shaMismatch', expectedSha);
    const existing = await this.backend.getAsset(expectedSha);
    if (existing) return strip(existing);
    const ext = sniffType(await blobBytes(blob.slice(0, 16)));
    if (!ext) throw new AssetStoreError('unsupportedType', blob.type);
    const sha = await sha256Hex(blob);
    if (sha !== expectedSha) throw new AssetStoreError('shaMismatch', `${expectedSha} ≠ ${sha}`);
    return this.putVerified(sha, ext, blob, name, true);
  }

  private async putVerified(sha: string, ext: AssetExt, blob: Blob, name: string | undefined, verify: boolean): Promise<AssetMeta> {
    const existing = await this.backend.getAsset(sha);
    if (existing) return strip(existing);
    const rec: AssetRecord = { sha256: sha, mime: ASSET_TYPES[ext], size: blob.size, addedAt: this.now().toISOString(), blob, ...(name ? { name: name.slice(0, 255) } : {}) };
    await this.backend.putAssetIfAbsent(rec);
    if (verify) {
      const back = await this.backend.getAsset(sha);
      if (!back || back.blob.size !== blob.size || (await sha256Hex(back.blob)) !== sha) {
        await this.backend.deleteAsset(sha).catch(() => undefined);
        throw new AssetStoreError('verifyFailed', sha);
      }
    }
    return strip(rec);
  }

  async get(sha: string): Promise<Blob | undefined> {
    return (await this.backend.getAsset(sha))?.blob;
  }

  async meta(sha: string): Promise<AssetMeta | undefined> {
    const r = await this.backend.getAsset(sha);
    return r ? strip(r) : undefined;
  }

  async has(sha: string): Promise<boolean> {
    return !!(await this.backend.getAsset(sha));
  }

  /** Suppression explicite, refusée (AssetStoreError 'referenced') si le document est encore référencé. */
  async deleteIfUnreferenced(sha: string, refs: ReferenceSources): Promise<void> {
    if ((await allReferences(refs)).has(sha)) throw new AssetStoreError('referenced', sha);
    await this.backend.deleteAsset(sha);
    for (const d of await this.backend.listDerived()) if (d.of === sha) await this.backend.deleteDerived(d.key);
  }

  /**
   * Ramasse-miettes : supprime les documents qu'aucun modèle gardé ou ouvert ne référence, ajoutés depuis plus
   * longtemps que le délai de grâce. Renvoie les empreintes supprimées.
   */
  async collectGarbage(refs: ReferenceSources, graceMs = GC_GRACE_MS): Promise<string[]> {
    const used = await allReferences(refs);
    const limit = this.now().getTime() - graceMs;
    const deleted: string[] = [];
    for (const a of await this.backend.listAssets()) {
      if (used.has(a.sha256)) continue;
      const t = Date.parse(a.addedAt);
      if (!Number.isFinite(t) || t > limit) continue;
      // Nouvelle vérification juste avant de supprimer : un modèle a pu être enregistré entre-temps
      if ((await allReferences(refs)).has(a.sha256)) continue;
      await this.backend.deleteAsset(a.sha256);
      deleted.push(a.sha256);
    }
    for (const d of await this.backend.listDerived()) if (deleted.includes(d.of)) await this.backend.deleteDerived(d.key);
    return deleted;
  }

  // --- Images dérivées (cache régénérable) ---

  async getDerived(of: string, role: string): Promise<Blob | undefined> {
    const key = `${of}-${role}`;
    const r = await this.backend.getDerived(key);
    if (!r) return undefined;
    // Date d'usage mise à jour (sans attendre) : les plus anciens partent d'abord
    void this.backend.putDerived({ ...r, at: this.now().toISOString() }).catch(() => undefined);
    return r.blob;
  }

  async putDerived(of: string, role: string, blob: Blob): Promise<DerivedMeta> {
    const ext = sniffType(await blobBytes(blob.slice(0, 16)));
    if (ext !== 'jpg' && ext !== 'png' && ext !== 'webp') throw new AssetStoreError('unsupportedType', blob.type);
    const rec: DerivedRecord = { key: `${of}-${role}`, of, role, sha256: await sha256Hex(blob), mime: ASSET_TYPES[ext], size: blob.size, at: this.now().toISOString(), blob };
    await this.backend.putDerived(rec);
    return strip(rec);
  }

  async listDerivedOf(of: string): Promise<DerivedMeta[]> {
    return (await this.backend.listDerived()).filter((d) => d.of === of);
  }

  /** Libère au moins `bytes` octets d'images dérivées, les moins récemment utilisées d'abord. */
  async pruneDerived(bytes = Infinity): Promise<number> {
    const list = (await this.backend.listDerived()).sort((a, b) => a.at.localeCompare(b.at));
    let freed = 0;
    for (const d of list) {
      if (freed >= bytes) break;
      await this.backend.deleteDerived(d.key);
      freed += d.size;
    }
    return freed;
  }

  async usage(): Promise<{ assets: number; assetBytes: number; derived: number; derivedBytes: number }> {
    const a = await this.backend.listAssets();
    const d = await this.backend.listDerived();
    return { assets: a.length, assetBytes: a.reduce((s, x) => s + x.size, 0), derived: d.length, derivedBytes: d.reduce((s, x) => s + x.size, 0) };
  }
}

function strip<T extends { blob: Blob }>(r: T): Omit<T, 'blob'> {
  const { blob: _b, ...m } = r;
  return m;
}

/**
 * Libération d'espace selon le remplissage du stockage (SPEC-FORMAT-V2 § 11.1), après la réduction des versions :
 *  1. images dérivées (régénérables), les plus anciennes d'abord : à partir de 50 % de remplissage, toutes au-delà
 *     de 80 % ;
 *  2. documents qu'aucun modèle gardé ou ouvert ne référence (délai de grâce respecté), à partir de 50 %.
 * Jamais : un document référencé. Fonction testée avec un magasin en mémoire.
 */
export async function reclaimSpace(store: AssetStore, refs: ReferenceSources, usage: number | null, quota: number | null): Promise<{ derivedFreed: number; assetsDeleted: string[] }> {
  if (!usage || !quota) return { derivedFreed: 0, assetsDeleted: [] };
  const r = usage / quota;
  if (r < 0.5) return { derivedFreed: 0, assetsDeleted: [] };
  const derivedFreed = await store.pruneDerived(r >= 0.8 ? Infinity : Math.max(0, usage - quota * 0.5));
  const assetsDeleted = await store.collectGarbage(refs);
  return { derivedFreed, assetsDeleted };
}
