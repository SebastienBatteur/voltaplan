/**
 * Magasin IndexedDB des documents (base « voltaplan », magasins `assets` et `derived`, voir src/io/storage.ts).
 * Logique et règles de suppression : assets.ts.
 */
import { ASSETS_STORE, DERIVED_STORE, openDb } from '../io/storage';
import { AssetStore, MemoryAssetBackend, reclaimSpace, type AssetBackend, type AssetMeta, type AssetRecord, type DerivedMeta, type DerivedRecord, type ReferenceSources } from './assets';

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await openDb();
  const t = d.transaction(store, mode);
  const result = await req(fn(t.objectStore(store)));
  if (mode === 'readwrite')
    await new Promise<void>((resolve, reject) => {
      t.oncomplete = () => resolve();
      t.onabort = () => reject(t.error);
      t.onerror = () => reject(t.error);
    });
  return result;
}

/** Parcours sans charger les contenus (curseur : métadonnées seulement copiées). */
async function listMeta<T extends { blob: Blob }>(store: string): Promise<Omit<T, 'blob'>[]> {
  const d = await openDb();
  return new Promise((resolve, reject) => {
    const out: Omit<T, 'blob'>[] = [];
    const c = d.transaction(store, 'readonly').objectStore(store).openCursor();
    c.onsuccess = () => {
      const cur = c.result;
      if (!cur) return resolve(out);
      const { blob: _b, ...m } = cur.value as T;
      out.push(m);
      cur.continue();
    };
    c.onerror = () => reject(c.error);
  });
}

export const idbAssetBackend: AssetBackend = {
  getAsset: (sha) => run<AssetRecord | undefined>(ASSETS_STORE, 'readonly', (s) => s.get(sha)),
  async putAssetIfAbsent(rec) {
    // Lecture et écriture dans la même transaction : jamais de réécriture d'un document existant
    const d = await openDb();
    return new Promise<boolean>((resolve, reject) => {
      const t = d.transaction(ASSETS_STORE, 'readwrite');
      const s = t.objectStore(ASSETS_STORE);
      let wrote = false;
      const g = s.getKey(rec.sha256);
      g.onsuccess = () => {
        if (g.result === undefined) {
          s.add(rec);
          wrote = true;
        }
      };
      t.oncomplete = () => resolve(wrote);
      t.onabort = () => reject(t.error);
      t.onerror = () => reject(t.error);
    });
  },
  deleteAsset: (sha) => run(ASSETS_STORE, 'readwrite', (s) => s.delete(sha)).then(() => undefined),
  listAssets: () => listMeta<AssetRecord>(ASSETS_STORE) as Promise<AssetMeta[]>,
  getDerived: (key) => run<DerivedRecord | undefined>(DERIVED_STORE, 'readonly', (s) => s.get(key)),
  putDerived: (rec) => run(DERIVED_STORE, 'readwrite', (s) => s.put(rec)).then(() => undefined),
  deleteDerived: (key) => run(DERIVED_STORE, 'readwrite', (s) => s.delete(key)).then(() => undefined),
  listDerived: () => listMeta<DerivedRecord>(DERIVED_STORE) as Promise<DerivedMeta[]>,
};

/** Modèles ouverts dans cet onglet (fournis par l'application, voir setOpenModels). */
let openModels: () => string[] = () => [];
export function setOpenModels(fn: () => string[]) {
  openModels = fn;
}

/** Textes de tous les modèles gardés : projets du navigateur, brouillons (tous onglets), versions locales. */
async function storedModels(): Promise<string[]> {
  const d = await openDb();
  const texts: string[] = [];
  for (const store of ['projects', 'versions']) {
    await new Promise<void>((resolve, reject) => {
      const c = d.transaction(store, 'readonly').objectStore(store).openCursor();
      c.onsuccess = () => {
        const cur = c.result;
        if (!cur) return resolve();
        const v = cur.value as { data?: unknown };
        if (typeof v.data === 'string') texts.push(v.data);
        cur.continue();
      };
      c.onerror = () => reject(c.error);
    });
  }
  return texts;
}

export const idbReferences: ReferenceSources = { storedModels, openModels: () => openModels() };

/**
 * IndexedDB indisponible (navigation privée de certains navigateurs, environnement de test) : magasin en mémoire
 * pour la session, pour que l'application reste utilisable (les documents restent lus depuis leur fichier).
 */
const memory = new MemoryAssetBackend();
let mode: 'idb' | 'memory' | null = null;
async function backend(): Promise<AssetBackend> {
  if (!mode) {
    if (typeof indexedDB === 'undefined') mode = 'memory';
    else
      try {
        await openDb();
        mode = 'idb';
      } catch (e) {
        // Base bloquée par un autre onglet : on réessaiera ; autre erreur : mémoire pour la session
        if ((e as Error)?.name === 'BlockedError') return memory;
        mode = 'memory';
      }
  }
  return mode === 'idb' ? idbAssetBackend : memory;
}

const resilientBackend: AssetBackend = {
  getAsset: async (s) => (await backend()).getAsset(s),
  putAssetIfAbsent: async (r) => (await backend()).putAssetIfAbsent(r),
  deleteAsset: async (s) => (await backend()).deleteAsset(s),
  listAssets: async () => (await backend()).listAssets(),
  getDerived: async (k) => (await backend()).getDerived(k),
  putDerived: async (r) => (await backend()).putDerived(r),
  deleteDerived: async (k) => (await backend()).deleteDerived(k),
  listDerived: async () => (await backend()).listDerived(),
};

let store: AssetStore | null = null;
/** Magasin de travail de l'application (IndexedDB, à défaut mémoire). */
export function workingStore(): AssetStore {
  store ??= new AssetStore(resilientBackend);
  return store;
}

/** Les documents sont-ils gardés durablement sur cet appareil ? (false : mémoire de la session seulement) */
export async function isDurable(): Promise<boolean> {
  return (await backend()) === idbAssetBackend;
}

/** Libération d'espace (après la réduction des versions, voir src/io/storage.ts addVersion). Jamais d'exception. */
export async function reclaimWorkingSpace(): Promise<void> {
  try {
    const e = await navigator.storage?.estimate?.();
    await reclaimSpace(workingStore(), idbReferences, e?.usage ?? null, e?.quota ?? null);
  } catch {
    /* stockage indisponible : rien à faire */
  }
}
