// @vitest-environment node
/**
 * Reprise après une fermeture brutale (plantage, batterie, onglet tué), SIMULÉE avec fake-indexeddb : coupure
 * pendant la mise à niveau de la base, entre l'écriture d'un document et celle du modèle, entre le brouillon et le
 * fichier, avec un envoi en attente. Au lancement suivant : le brouillon et l'envoi en attente sont proposés, et
 * aucun modèle gardé ne référence un document absent.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetStore, GC_GRACE_MS } from '../src/format/assets';
import { idbAssetBackend, idbReferences } from '../src/format/assetsIdb';
import { AssetSession } from '../src/format/session';
import { addVersion, browserLoad, browserSave, draftId, latestVersion, listPending, openDb, orphanDrafts, parseProject, setPending } from '../src/io/storage';
import { emptyProject } from '../src/model/tree';
import type { Project } from '../src/model/types';

const jpeg = (seed: number) => {
  const b = new Uint8Array(700);
  for (let i = 0; i < b.length; i++) b[i] = (i * seed + 9) & 0xff;
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  return new Blob([b], { type: 'image/jpeg' });
};

/** localStorage du navigateur (signal de vie des onglets, envois en attente), survit au « redémarrage ». */
const ls = new Map<string, string>();
beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => ls.get(k) ?? null,
    setItem: (k: string, v: string) => void ls.set(k, v),
    removeItem: (k: string) => void ls.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

function withPhoto(sha: string): Project {
  const p = emptyProject();
  p.meta.title = 'Maison';
  p.boards = { b1: { slots: {}, photo: { href: 'asset:' + sha, x: 0, y: 0, w: 1, h: 1 } } } as Project['boards'];
  return p;
}

describe('fermeture brutale', () => {
  // En premier : la base n'a encore jamais été ouverte par l'application dans ce fichier de test
  it('pendant la mise à niveau de la base : rien n’est perdu, la mise à niveau est refaite au lancement suivant', async () => {
    const open = (v: number, upgrade: (r: IDBOpenDBRequest, old: number) => void) =>
      new Promise<IDBDatabase | 'aborted'>((resolve, reject) => {
        const r = indexedDB.open('voltaplan', v);
        r.onupgradeneeded = (ev) => upgrade(r, ev.oldVersion);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => (r.error?.name === 'AbortError' ? resolve('aborted') : reject(r.error));
      });
    // Base de la version précédente, avec un projet
    const v2 = await open(2, (r) => {
      r.result.createObjectStore('projects', { keyPath: 'id' }).put({ id: 'p1', name: 'Ancien', updated: '2026-01-01', size: 2, data: '{"x":1}', rev: 3 });
      r.result.createObjectStore('versions', { keyPath: 'vid' });
    });
    (v2 as IDBDatabase).close();
    // Coupure au milieu de la mise à niveau : magasins créés puis transaction interrompue (onglet tué)
    const cut = await open(3, (r) => {
      r.result.createObjectStore('assets', { keyPath: 'sha256' });
      r.transaction!.abort();
    });
    expect(cut).toBe('aborted');
    // Lancement suivant : la mise à niveau (création des magasins manquants seulement) est refaite, sans perte
    const d = await openDb();
    expect(d.version).toBe(3);
    expect([...d.objectStoreNames].sort()).toEqual(['assets', 'derived', 'projects', 'versions']);
    expect(await browserLoad('p1')).toMatchObject({ name: 'Ancien', data: '{"x":1}', rev: 3 });
  });

  it('entre l’écriture d’un document et celle du modèle : document gardé (délai de grâce), aucun modèle ne référence un absent', async () => {
    const t0 = new Date('2026-11-24T10:00:00Z');
    const store = new AssetStore(idbAssetBackend, { now: () => t0 });
    const meta = await store.add(jpeg(1));
    // … plantage ici : le brouillon qui l'aurait référencé n'a jamais été écrit.
    // Lancement suivant (nouvelle instance) : le document est là, gardé pendant le délai de grâce
    const after = new AssetStore(idbAssetBackend, { now: () => new Date(t0.getTime() + 60_000) });
    expect(await after.has(meta.sha256)).toBe(true);
    expect(await after.collectGarbage(idbReferences)).toEqual([]);
    // Ordre inverse impossible : un modèle n'est écrit qu'APRÈS son document (vérifié par relecture)
    const p = withPhoto(meta.sha256);
    await browserSave(draftId('onglet-plante'), 'Maison', p, 'any');
    const later = new AssetStore(idbAssetBackend, { now: () => new Date(t0.getTime() + 2 * GC_GRACE_MS) });
    // Référencé par le brouillon : jamais supprimé, même après le délai de grâce
    expect(await later.collectGarbage(idbReferences)).toEqual([]);
    const session = new AssetSession(() => later);
    expect(await session.missing(parseProject((await browserLoad(draftId('onglet-plante')))!.data))).toEqual([]);
  });

  it('entre le brouillon et l’écriture du fichier : le brouillon de l’onglet fermé est proposé au lancement suivant', async () => {
    const meta = await new AssetStore(idbAssetBackend).add(jpeg(2));
    // Onglet A : brouillon écrit AVANT l'enregistrement (App.tsx save), puis plantage pendant l'écriture du fichier
    const crashed = draftId('ongletA');
    await browserSave(crashed, 'Maison', withPhoto(meta.sha256), 'any');
    ls.set('voltaplan.tab.ongletA', String(Date.now() - 60_000)); // dernier signal de vie : il y a une minute
    // Un autre onglet encore ouvert : son brouillon n'est pas proposé
    await browserSave(draftId('ongletB'), 'Autre', emptyProject(), 'any');
    ls.set('voltaplan.tab.ongletB', String(Date.now()));
    const orphans = await orphanDrafts();
    expect(orphans.map((o) => o.id)).toContain(crashed);
    expect(orphans.map((o) => o.id)).not.toContain(draftId('ongletB'));
    const recovered = parseProject(orphans.find((o) => o.id === crashed)!.data);
    expect(recovered.boards!.b1.photo!.href).toBe('asset:' + meta.sha256);
    expect(await new AssetSession(() => new AssetStore(idbAssetBackend)).missing(recovered)).toEqual([]);
  });

  it('envoi en attente au moment du plantage : mémorisé (sans le contenu), sa version locale est rouverte au lancement suivant', async () => {
    const meta = await new AssetStore(idbAssetBackend).add(jpeg(3));
    const key = 'folder:onedrive:Maison/project.json';
    const p = withPhoto(meta.sha256);
    await addVersion(key, 'Maison', p, 'pending');
    setPending({ key, loc: { kind: 'folder', provider: 'onedrive', folder: 'Maison', modelPath: 'project.json', rev: 'e1' }, fileName: '', name: 'Maison', at: new Date().toISOString(), reason: 'offline' });
    // « Redémarrage » : seul le stockage persistant compte
    const pend = listPending();
    expect(pend).toHaveLength(1);
    expect(JSON.stringify(pend)).not.toContain('asset:'); // jamais le contenu dans localStorage
    const v = await latestVersion(pend[0].key);
    expect(parseProject(v!.data).boards!.b1.photo!.href).toBe('asset:' + meta.sha256);
    expect(await new AssetSession(() => new AssetStore(idbAssetBackend)).missing(parseProject(v!.data))).toEqual([]);
  });
});
