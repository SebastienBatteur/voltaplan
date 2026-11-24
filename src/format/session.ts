/**
 * Accès aux documents pendant la session (F3) : résolution d'une référence « asset:<sha256> » quel que soit
 * l'endroit où se trouve le document.
 *
 *  1. stockage de travail (IndexedDB) : documents déjà copiés ou ajoutés sur cet appareil ;
 *  2. sources attachées à l'ouverture : tranches de l'archive ouverte, fichiers d'un dossier cloud (téléchargés
 *     à la demande). Au premier accès, le document est vérifié (taille, signature, SHA-256) puis copié dans le
 *     stockage de travail ; une copie en arrière-plan fait de même pour tous les autres.
 *
 * Fichier déplacé, modifié ou supprimé pendant la session : les documents déjà copiés restent disponibles ; les
 * autres donnent une erreur claire (`AssetUnavailableError`, raison « unreadable »), jamais un projet corrompu.
 *
 * Affichage : image dérivée (réduite) d'abord — cache, archive, ou régénérée — jamais l'original de 12 Mpx
 * décodé en entier pour un fond de plan. L'original sert à l'IA, à l'export et à la vérification.
 */
import type { AssetStore } from './assets';
import { ASSET_SCHEME, assetShaOf } from './manifest';
import { projectAssetRefs, type AssetRef } from './projectFile';
import type { Project } from '../model/types';

export interface DocSource {
  /** Contenu vérifié (AssetIntegrityError ou erreur réseau sinon). */
  open(signal?: AbortSignal): Promise<Blob>;
  name?: string;
  /** Type et taille annoncés (archive), connus sans lire le contenu. */
  mime?: string;
  size?: number;
}

export type UnavailableReason = 'missing' | 'unreadable' | 'invalid' | 'storage';

export class AssetUnavailableError extends Error {
  constructor(
    readonly sha256: string,
    readonly reason: UnavailableReason,
  ) {
    super(`Document indisponible (${reason}) : ${sha256.slice(0, 12)}…`);
    this.name = 'AssetUnavailableError';
  }
}

/** Fabrique d'image d'affichage (navigateur : canvas, pdf.js ; voir src/io/background.ts). */
export type DisplayMaker = (original: Blob) => Promise<Blob>;

/** Images que le navigateur affiche directement (sans image dérivée si elle manque). */
const DISPLAYABLE = /^image\/(jpeg|png|webp|gif|avif)$/;
export const DISPLAY_ROLE = 'display';

export class AssetSession {
  private sources = new Map<string, DocSource>();
  private derivedSources = new Map<string, DocSource>();
  private urls = new Map<string, Promise<string>>();
  private failures = new Map<string, UnavailableReason>();
  private copying: Promise<void> | null = null;
  private maker: DisplayMaker | null = null;
  private listeners = new Set<() => void>();

  constructor(private readonly storeOf: () => AssetStore) {}

  get store(): AssetStore {
    return this.storeOf();
  }

  setDisplayMaker(m: DisplayMaker | null) {
    this.maker = m;
  }

  /** Changement d'état (copie terminée, document en échec) : pour rafraîchir l'affichage. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const l of this.listeners) l();
  }

  /** Sources d'un projet ouvert (archive, dossier) ; les sources précédentes restent utilisables. */
  attach(originals: Map<string, DocSource>, derived: Map<string, DocSource> = new Map()) {
    for (const [k, v] of originals) {
      this.sources.set(k, v);
      this.failures.delete(k);
    }
    for (const [k, v] of derived) this.derivedSources.set(k, v);
  }

  hasSource(sha: string): boolean {
    return this.sources.has(sha);
  }

  failed(): Map<string, UnavailableReason> {
    return new Map(this.failures);
  }

  /** Original vérifié. Copié dans le stockage de travail au passage. */
  async blob(sha: string, signal?: AbortSignal): Promise<Blob> {
    let stored: Blob | undefined;
    try {
      stored = await this.store.get(sha);
    } catch {
      /* stockage indisponible : on tente la source */
    }
    if (stored) return stored;
    const src = this.sources.get(sha);
    if (!src) throw new AssetUnavailableError(sha, 'missing');
    let b: Blob;
    try {
      b = await src.open(signal);
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') throw e;
      const reason: UnavailableReason = (e as Error)?.name === 'AssetIntegrityError' && (e as { reason?: string }).reason !== 'unreadable' ? 'invalid' : 'unreadable';
      this.failures.set(sha, reason);
      this.emit();
      throw new AssetUnavailableError(sha, reason);
    }
    try {
      await this.store.ingest(sha, b, src.name);
      // Copie faite : la source n'est plus nécessaire (le fichier d'origine peut disparaître sans perte)
      this.sources.delete(sha);
    } catch {
      /* stockage plein ou indisponible : le document reste lu depuis sa source */
    }
    return b;
  }

  /** Tous les documents du projet sont-ils disponibles ? Liste de ceux qui manquent (sources de l'assistant exclues). */
  async missing(project: Project): Promise<AssetRef[]> {
    const out: AssetRef[] = [];
    for (const r of projectAssetRefs(project)) {
      if (r.kind === 'source') continue;
      if (this.failures.has(r.sha256)) {
        out.push(r);
        continue;
      }
      let ok = this.sources.has(r.sha256);
      if (!ok) ok = await this.store.has(r.sha256).catch(() => false);
      if (!ok) out.push(r);
    }
    return out;
  }

  /**
   * Copie en arrière-plan, dans le stockage de travail, de tous les documents encore lus depuis leur source
   * (un à la fois : mémoire bornée). Les échecs sont mémorisés et signalés.
   */
  copyInBackground(onProgress?: (done: number, total: number) => void, signal?: AbortSignal): Promise<void> {
    this.copying ??= (async () => {
      const shas = [...this.sources.keys()];
      let done = 0;
      for (const sha of shas) {
        if (signal?.aborted) break;
        await this.blob(sha, signal).catch(() => undefined);
        onProgress?.(++done, shas.length);
      }
      this.emit();
    })().finally(() => {
      this.copying = null;
    });
    return this.copying;
  }

  /** Copie dans le stockage de travail les documents du projet (avant un enregistrement dans le navigateur). */
  async ensureStored(project: Project): Promise<AssetRef[]> {
    const failed: AssetRef[] = [];
    for (const r of projectAssetRefs(project)) {
      if (await this.store.has(r.sha256).catch(() => false)) continue;
      if (!this.sources.has(r.sha256)) {
        if (r.kind !== 'source') failed.push(r);
        continue;
      }
      await this.blob(r.sha256).catch(() => failed.push(r));
    }
    return failed;
  }

  /** Image d'affichage : dérivée en cache, dérivée de l'archive, régénérée, ou l'original s'il s'affiche tel quel. */
  async displayBlob(sha: string): Promise<Blob> {
    const cached = await this.store.getDerived(sha, DISPLAY_ROLE).catch(() => undefined);
    if (cached) return cached;
    const fromArchive = this.derivedSources.get(`${sha}-${DISPLAY_ROLE}`);
    if (fromArchive) {
      try {
        const b = await fromArchive.open();
        await this.store.putDerived(sha, DISPLAY_ROLE, b).catch(() => undefined);
        return b;
      } catch {
        /* dérivé invalide : régénéré ci-dessous */
      }
    }
    const orig = await this.blob(sha);
    if (this.maker) {
      try {
        const d = await this.maker(orig);
        await this.store.putDerived(sha, DISPLAY_ROLE, d).catch(() => undefined);
        return d;
      } catch {
        /* génération impossible : original si affichable */
      }
    }
    if (DISPLAYABLE.test(orig.type)) return orig;
    throw new AssetUnavailableError(sha, 'invalid');
  }

  /**
   * Adresse affichable d'une image du projet : inchangée pour une image intégrée (`data:`), URL d'objet (`blob:`)
   * pour une référence « asset: ». Mise en cache pour la session.
   */
  displayUrl(href: string): Promise<string> {
    if (!href.startsWith(ASSET_SCHEME)) return Promise.resolve(href);
    const sha = assetShaOf(href);
    if (!sha) return Promise.reject(new AssetUnavailableError(href, 'invalid'));
    let p = this.urls.get(sha);
    if (!p) {
      p = this.displayBlob(sha).then((b) => URL.createObjectURL(b));
      p.catch(() => this.urls.delete(sha));
      this.urls.set(sha, p);
    }
    return p;
  }

  /** Adresse de l'original (IA, calage), URL d'objet à révoquer par l'appelant (`release`). */
  async originalUrl(href: string): Promise<{ url: string; release: () => void }> {
    const sha = assetShaOf(href);
    if (!sha) return { url: href, release: () => undefined };
    const url = URL.createObjectURL(await this.blob(sha));
    return { url, release: () => URL.revokeObjectURL(url) };
  }

  /** Pour les tests et le changement de stockage. */
  resetForTests() {
    this.sources.clear();
    this.derivedSources.clear();
    this.failures.clear();
    for (const p of this.urls.values()) void p.then((u) => URL.revokeObjectURL(u)).catch(() => undefined);
    this.urls.clear();
  }
}
