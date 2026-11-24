// @vitest-environment node
/**
 * Stockage de travail des documents (F4) : dédoublonnage, immuabilité, vérification après écriture, jamais de
 * suppression d'un document référencé, cache de dérivés, libération d'espace.
 */
import { describe, expect, it } from 'vitest';
import { AssetStore, AssetStoreError, GC_GRACE_MS, MemoryAssetBackend, reclaimSpace, referencedShas, type ReferenceSources } from '../src/format/assets';
import { sha256Hex } from '../src/format/sha256';

const jpeg = (seed: number, n = 1000) => {
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) b[i] = (i * seed + 13) & 0xff;
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  return new Blob([b], { type: 'image/jpeg' });
};
const DAY = 24 * 3600 * 1000;

function setup(now = new Date('2026-11-24T12:00:00Z')) {
  const backend = new MemoryAssetBackend();
  let t = now.getTime();
  const store = new AssetStore(backend, { now: () => new Date(t) });
  const stored: string[] = [];
  const open: string[] = [];
  const refs: ReferenceSources = { storedModels: async () => stored, openModels: () => open };
  return { backend, store, refs, stored, open, advance: (ms: number) => (t += ms) };
}

describe('stockage de travail des documents', () => {
  it('ajout : empreinte, type par signature, dédoublonnage', async () => {
    const { store, backend } = setup();
    const a = await store.add(jpeg(3), { name: 'tableau.jpg' });
    expect(a.sha256).toBe(await sha256Hex(jpeg(3)));
    expect(a.mime).toBe('image/jpeg');
    const again = await store.add(jpeg(3), { name: 'autre nom.jpg' });
    expect(again.name).toBe('tableau.jpg'); // immuable : le premier enregistrement reste
    expect(backend.assets.size).toBe(1);
    await expect(store.add(new Blob(['<svg/>'], { type: 'image/svg+xml' }))).rejects.toMatchObject({ code: 'unsupportedType' });
  });

  it('vérifie après écriture : un stockage défaillant n’est jamais pris pour bon', async () => {
    const { store, backend } = setup();
    const orig = backend.getAsset.bind(backend);
    backend.getAsset = async (sha) => {
      const r = await orig(sha);
      return r ? { ...r, blob: jpeg(99) } : r; // relu altéré
    };
    await expect(store.add(jpeg(4))).rejects.toMatchObject({ code: 'verifyFailed' });
    backend.getAsset = orig;
    expect(backend.assets.size).toBe(0);
  });

  it('copie depuis une archive : empreinte recalculée', async () => {
    const { store } = setup();
    const sha = await sha256Hex(jpeg(5));
    await expect(store.ingest(sha, jpeg(6))).rejects.toMatchObject({ code: 'shaMismatch' });
    expect((await store.ingest(sha, jpeg(5))).sha256).toBe(sha);
    expect(await store.has(sha)).toBe(true);
  });

  it('jamais de suppression d’un document référencé (projet, brouillon, version, projet ouvert)', async () => {
    const { store, refs, stored, open, advance } = setup();
    const a = await store.add(jpeg(1));
    const b = await store.add(jpeg(2));
    const c = await store.add(jpeg(3));
    const d = await store.add(jpeg(4));
    stored.push(JSON.stringify({ plan: { pages: [{ images: [{ href: 'asset:' + a.sha256 }] }] } })); // version
    stored.push(JSON.stringify({ evidence: { sources: [{ sha256: b.sha256 }] } })); // brouillon (source de l'assistant)
    open.push(JSON.stringify({ boards: { x: { photo: { href: 'asset:' + c.sha256 } } } })); // projet ouvert
    await expect(store.deleteIfUnreferenced(a.sha256, refs)).rejects.toBeInstanceOf(AssetStoreError);
    await expect(store.deleteIfUnreferenced(c.sha256, refs)).rejects.toMatchObject({ code: 'referenced' });
    // Délai de grâce : rien n'est nettoyé tout de suite
    expect(await store.collectGarbage(refs)).toEqual([]);
    advance(GC_GRACE_MS + DAY);
    expect(await store.collectGarbage(refs)).toEqual([d.sha256]);
    expect(await store.has(a.sha256)).toBe(true);
    expect(await store.has(b.sha256)).toBe(true);
    expect(await store.has(c.sha256)).toBe(true);
  });

  it('référence ajoutée pendant le nettoyage : le document est gardé', async () => {
    const { store, stored, open, advance } = setup();
    const a = await store.add(jpeg(1));
    advance(GC_GRACE_MS + DAY);
    let calls = 0;
    const refs: ReferenceSources = {
      storedModels: async () => {
        calls++;
        return calls > 1 ? ['asset:' + a.sha256, ...stored] : stored; // enregistré entre les deux lectures
      },
      openModels: () => open,
    };
    expect(await store.collectGarbage(refs)).toEqual([]);
    expect(await store.has(a.sha256)).toBe(true);
  });

  it('recherche des références large et prudente', () => {
    const s = 'f'.repeat(64);
    expect([...referencedShas(`{"href":"asset:${s}"}`)]).toEqual([s]);
    expect([...referencedShas(`{"sha256" : "${s}"}`)]).toEqual([s]);
    expect(referencedShas('asset:abc').size).toBe(0);
  });

  it('images dérivées : cache régénérable, libéré d’abord, les plus anciennes en premier', async () => {
    const { store, refs, stored, advance } = setup();
    const a = await store.add(jpeg(1));
    stored.push('asset:' + a.sha256);
    await store.putDerived(a.sha256, 'display', jpeg(10, 300));
    advance(1000);
    await store.putDerived(a.sha256, 'thumb', jpeg(11, 200));
    expect((await store.getDerived(a.sha256, 'display'))?.size).toBe(300);
    expect(await store.pruneDerived(1)).toBeGreaterThan(0);
    // Remplissage < 50 % : rien
    expect(await reclaimSpace(store, refs, 10, 100)).toEqual({ derivedFreed: 0, assetsDeleted: [] });
    // > 80 % : tous les dérivés, mais jamais l'original référencé
    const r = await reclaimSpace(store, refs, 90, 100);
    expect(r.assetsDeleted).toEqual([]);
    expect((await store.usage()).derived).toBe(0);
    expect(await store.has(a.sha256)).toBe(true);
    await expect(store.putDerived(a.sha256, 'display', new Blob(['%PDF-1.4']))).rejects.toMatchObject({ code: 'unsupportedType' });
  });

  it('plafond de taille par type', async () => {
    const backend = new MemoryAssetBackend();
    const store = new AssetStore(backend, { limits: { ...(await import('../src/format/limits')).DEFAULT_LIMITS, image: 500 } });
    await expect(store.add(jpeg(1, 1000))).rejects.toMatchObject({ code: 'tooLarge' });
  });
});
