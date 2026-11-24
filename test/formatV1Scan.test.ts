// @vitest-environment node
/**
 * Migration v1 → v2 à mémoire réduite : lecture par tranches, images base64 décodées au fil de la lecture
 * (scanV1), puis rangées (fonds de plan, photos de tableau) ou réintégrées (autres places). Résultat identique à
 * la lecture habituelle ; repli sur celle-ci pour tout contenu inhabituel.
 */
import { describe, expect, it } from 'vitest';
import { AssetStore, MemoryAssetBackend } from '../src/format/assets';
import { assetShaOf } from '../src/format/manifest';
import { dataUrlToBlob, extractEmbeddedImages, placeExtractedImages, scanV1 } from '../src/format/migrateV1';
import { AssetSession } from '../src/format/session';
import { blobBytes, sha256Hex } from '../src/format/sha256';
import { openProjectData } from '../src/io/projectData';
import { emptyProject } from '../src/model/tree';
import type { Project } from '../src/model/types';

const jpeg = (seed: number, n = 3001) => {
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) b[i] = (i * seed + 3) & 0xff;
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  return b;
};
const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64');
const dataJpeg = (b: Uint8Array) => 'data:image/jpeg;base64,' + b64(b);

function v1(): Project {
  const p = emptyProject();
  (p as { version: number }).version = 1;
  p.meta.title = 'Église « Saint-Éloi »';
  p.plan.pages = [
    {
      id: 'pg',
      name: 'Rez',
      walls: [],
      openings: [],
      rects: [],
      symbols: [],
      labels: [],
      images: [
        { center: { x: 0, y: 0 }, w: 100, h: 80, angle: 0, href: dataJpeg(jpeg(3)), background: true },
        // Meuble Trikker : reste intégré
        { center: { x: 5, y: 5 }, w: 10, h: 10, angle: 0, href: dataJpeg(jpeg(9, 50)) },
      ],
    },
  ];
  p.boards = {
    b1: { slots: {}, photo: { href: dataJpeg(jpeg(7, 2000)), x: 0, y: 0, w: 10, h: 10 } },
    // Même photo deux fois : un seul document
    b2: { slots: {}, photo: { href: dataJpeg(jpeg(7, 2000)), x: 0, y: 0, w: 10, h: 10 } },
  } as Project['boards'];
  return p;
}

const session = () => {
  const store = new AssetStore(new MemoryAssetBackend());
  return { store, s: new AssetSession(() => store) };
};

describe('lecture v1 par tranches (scanV1)', () => {
  it('images décodées octet pour octet, quelle que soit la taille des tranches', async () => {
    const text = JSON.stringify(v1());
    for (const chunk of [1, 2, 7, 13, 64, 1000, 1 << 22]) {
      const r = (await scanV1(new Blob([text]), chunk))!;
      expect(r).not.toBeNull();
      expect(r.images.size).toBe(3);
      const p = JSON.parse(r.text) as Project;
      expect(p.meta.title).toBe('Église « Saint-Éloi »');
      const sha = assetShaOf(p.boards!.b1.photo!.href)!;
      expect(await sha256Hex(jpeg(7, 2000))).toBe(sha);
      expect(await blobBytes(r.images.get(sha)!)).toEqual(jpeg(7, 2000));
      expect(r.images.get(sha)!.type).toBe('image/jpeg');
      expect(r.text.length).toBeLessThan(text.length / 3);
    }
  });

  it('échappements \\/ et retours à la ligne base64 acceptés ; \\u et caractère inattendu : repli (null)', async () => {
    const bytes = jpeg(5, 600);
    // JSON écrit par un autre outil : « / » échappé en « \/ », base64 coupé en lignes de 76 caractères (« \n »)
    const lines: string[] = [];
    const plain = b64(bytes);
    for (let i = 0; i < plain.length; i += 76) lines.push([...plain.slice(i, i + 76)].map((ch) => (ch === '/' ? '\\/' : ch)).join(''));
    const wrapped = lines.join('\\n');
    const r = (await scanV1(new Blob([`{"a":"data:image/jpeg;base64,${wrapped}"}`]), 5))!;
    expect(await blobBytes([...r.images.values()][0])).toEqual(bytes);
    expect(await scanV1(new Blob(['{"a":"data:image/png;base64,AAAA\\u0041"}']))).toBeNull();
    expect(await scanV1(new Blob(['{"a":"data:image/png;base64,AA*A"}']))).toBeNull();
    expect(await scanV1(new Blob(['{"a":"data:image/png;base64,AAAA'])))
      .toBeNull(); // tronqué
  });

  it('ce qui n’est pas une image base64 est recopié tel quel', async () => {
    const src = '{"a":"data:image/svg+xml,%3Csvg%3E","b":"texte \\"data:image/png;base64,AAAA\\" cité","c":"data:image/' + 'x'.repeat(200) + '"}';
    const r = (await scanV1(new Blob([src]), 3))!;
    expect(r.text).toBe(src);
    expect(r.images.size).toBe(0);
  });

  it('BOM et Windows-1252 : même texte que la lecture habituelle', async () => {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('{"t":"é"}')]);
    expect(JSON.parse((await scanV1(new Blob([bom])))!.text)).toEqual({ t: 'é' });
    const cp1252 = new Uint8Array([...new TextEncoder().encode('{"t":"'), 0xc9, ...new TextEncoder().encode('glise"}')]);
    expect(JSON.parse((await scanV1(new Blob([cp1252])))!.text)).toEqual({ t: 'Église' });
  });

  it('même projet que la lecture habituelle : fonds et photos rangés, meuble réintégré', async () => {
    const text = JSON.stringify(v1());
    // Lecture habituelle (référence)
    const ref = v1();
    const { store: s1 } = session();
    await extractEmbeddedImages(ref, async (b, n) => (await s1.add(b, { name: n })).sha256);
    // Lecture par tranches
    const { s } = session();
    const r = await openProjectData(new Blob([text]), 'v1.voltaplan', s, { background: false });
    expect(r.format).toBe('v1');
    expect(r.project.boards).toEqual(ref.boards);
    const [bg, furniture] = r.project.plan.pages[0].images;
    expect(bg.href).toBe(ref.plan.pages[0].images[0].href);
    expect(furniture.href.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(await blobBytes(dataUrlToBlob(furniture.href)!)).toEqual(jpeg(9, 50));
    expect((await s.store.usage()).assets).toBe(2);
  });

  it('stockage plein pendant la migration : images laissées intégrées, rien n’est perdu, signalé', async () => {
    const full = new MemoryAssetBackend();
    full.putAssetIfAbsent = async () => {
      throw new DOMException('plein', 'QuotaExceededError');
    };
    const store = new AssetStore(full);
    const r = await openProjectData(new Blob([JSON.stringify(v1())]), 'v1.voltaplan', new AssetSession(() => store), { background: false });
    expect(await blobBytes(dataUrlToBlob(r.project.boards!.b1.photo!.href)!)).toEqual(jpeg(7, 2000));
    expect(await blobBytes(dataUrlToBlob(r.project.plan.pages[0].images[0].href)!)).toEqual(jpeg(3));
    expect(r.warnings).toContainEqual({ key: 'format.keptInline', params: { n: 3 } });
  });

  it('placeExtractedImages : une même image fond de plan ET meuble → rangée pour l’un, intégrée pour l’autre', async () => {
    const bytes = jpeg(11, 300);
    const sha = await sha256Hex(bytes);
    const p = v1();
    p.plan.pages[0].images[0].href = 'asset:' + sha;
    p.plan.pages[0].images[1].href = 'asset:' + sha;
    const added: string[] = [];
    const r = await placeExtractedImages(p, new Map([[sha, new Blob([bytes], { type: 'image/jpeg' })]]), async () => (added.push(sha), sha));
    expect(r).toMatchObject({ converted: 1, keptInline: 0 });
    expect(p.plan.pages[0].images[0].href).toBe('asset:' + sha);
    expect(p.plan.pages[0].images[1].href).toBe(dataJpeg(bytes));
  });
});
