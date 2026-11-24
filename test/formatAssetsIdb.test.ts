// @vitest-environment node
/**
 * Magasin IndexedDB (fake-indexeddb) : mise à niveau de la base sans perte, documents immuables, références lues
 * dans les projets, brouillons et versions gardés.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { GC_GRACE_MS, AssetStore } from '../src/format/assets';
import { idbAssetBackend, idbReferences } from '../src/format/assetsIdb';
import { browserSave, openDb, browserLoad } from '../src/io/storage';
import { emptyProject } from '../src/model/tree';

const jpeg = (seed: number) => {
  const b = new Uint8Array(500);
  for (let i = 0; i < b.length; i++) b[i] = (i * seed) & 0xff;
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  return new Blob([b], { type: 'image/jpeg' });
};

describe('magasin IndexedDB', () => {
  it('met à niveau une base v2 existante sans rien perdre', async () => {
    // Base telle que l'écrit la version précédente de Voltaplan
    await new Promise<void>((resolve, reject) => {
      const r = indexedDB.open('voltaplan', 2);
      r.onupgradeneeded = () => {
        r.result.createObjectStore('projects', { keyPath: 'id' }).put({ id: 'p1', name: 'Ancien', updated: '2026-01-01', size: 2, data: '{}', rev: 4 });
        r.result.createObjectStore('versions', { keyPath: 'vid' });
      };
      r.onsuccess = () => {
        r.result.close();
        resolve();
      };
      r.onerror = () => reject(r.error);
    });
    const d = await openDb();
    expect(d.version).toBe(3);
    expect([...d.objectStoreNames].sort()).toEqual(['assets', 'derived', 'projects', 'versions']);
    expect((await browserLoad('p1'))?.rev).toBe(4);
  });

  it('documents immuables, liste sans contenu', async () => {
    const store = new AssetStore(idbAssetBackend);
    const a = await store.add(jpeg(3), { name: 'a.jpg' });
    expect(await idbAssetBackend.putAssetIfAbsent({ ...a, name: 'autre', blob: jpeg(3) })).toBe(false);
    expect((await store.meta(a.sha256))?.name).toBe('a.jpg');
    const list = await idbAssetBackend.listAssets();
    expect(list.find((x) => x.sha256 === a.sha256)).not.toHaveProperty('blob');
    expect((await store.get(a.sha256))?.size).toBe(500);
  });

  it('un document référencé par un projet du navigateur n’est jamais supprimé', async () => {
    let t = Date.now();
    const store = new AssetStore(idbAssetBackend, { now: () => new Date(t) });
    const kept = await store.add(jpeg(5));
    const lost = await store.add(jpeg(7));
    const p = emptyProject();
    p.plan.pages.push({ id: 'pg', name: '', walls: [], openings: [], rects: [], symbols: [], labels: [], images: [{ center: { x: 0, y: 0 }, w: 1, h: 1, angle: 0, href: 'asset:' + kept.sha256, background: true }] });
    await browserSave('p2', 'Projet', p, 'any');
    t += GC_GRACE_MS * 2;
    const deleted = await store.collectGarbage(idbReferences);
    expect(deleted).toContain(lost.sha256);
    expect(deleted).not.toContain(kept.sha256);
    expect(await store.has(kept.sha256)).toBe(true);
  });
});
