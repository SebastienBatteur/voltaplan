// @vitest-environment node
/**
 * Format v2 : migration v1 ↔ v2, ouverture et enregistrement par la chaîne commune (src/io/projectData.ts),
 * documents manquants, fichier devenu illisible pendant la session (F3).
 */
import { describe, expect, it } from 'vitest';
import { writeArchive } from '../src/format/archive';
import { AssetStore, MemoryAssetBackend } from '../src/format/assets';
import { assetShaOf } from '../src/format/manifest';
import { dataUrlToBlob, exportV1, extractEmbeddedImages } from '../src/format/migrateV1';
import { mergeSources, projectAssetRefs, splitProject } from '../src/format/projectFile';
import { AssetSession, AssetUnavailableError } from '../src/format/session';
import { sha256Hex } from '../src/format/sha256';
import { detectFormat, MissingAssetsError, openProjectData, projectWriteInput, serializeProject } from '../src/io/projectData';
import { emptyProject } from '../src/model/tree';
import type { Project } from '../src/model/types';

const jpegBytes = (seed: number, n = 800) => {
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) b[i] = (i * seed + 5) & 0xff;
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  return b;
};
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const dataJpeg = (seed: number) => 'data:image/jpeg;base64,' + b64(jpegBytes(seed));
const PNG_FURNITURE = 'data:image/png;base64,iVBORw0KGgo=';

function newSession() {
  const store = new AssetStore(new MemoryAssetBackend());
  return new AssetSession(() => store);
}

function v1Project(): Project {
  const p = emptyProject();
  (p as { version: number }).version = 1;
  p.meta.title = 'Maison';
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
        { center: { x: 0, y: 0 }, w: 100, h: 80, angle: 0, href: dataJpeg(3), background: true },
        { center: { x: 5, y: 5 }, w: 10, h: 10, angle: 0, href: PNG_FURNITURE },
      ],
    },
  ];
  p.boards = { b1: { slots: {}, photo: { href: dataJpeg(7), x: 0, y: 0, w: 10, h: 10 } } } as Project['boards'];
  return p;
}

describe('migration v1 → v2', () => {
  it('reconnaît le format par sa signature', () => {
    const enc = new TextEncoder();
    expect(detectFormat(new Uint8Array([0x50, 0x4b, 3, 4]))).toBe('v2');
    expect(detectFormat(enc.encode('  {"format"'))).toBe('v1');
    expect(detectFormat(new Uint8Array([0xef, 0xbb, 0xbf, 0x7b]))).toBe('v1');
    expect(detectFormat(enc.encode('<?xml'))).toBe('trik');
    expect(detectFormat(enc.encode('%PDF'))).toBeNull();
  });

  it('décode une image intégrée', async () => {
    const b = dataUrlToBlob(dataJpeg(3))!;
    expect(b.type).toBe('image/jpeg');
    expect(new Uint8Array(await b.arrayBuffer())).toEqual(jpegBytes(3));
    expect(dataUrlToBlob('javascript:alert(1)')).toBeNull();
  });

  it('range les fonds de plan et photos de tableau ; les meubles Trikker restent intégrés', async () => {
    const p = v1Project();
    const s = newSession();
    const r = await extractEmbeddedImages(p, async (b, n) => (await s.store.add(b, { name: n })).sha256);
    expect(r).toEqual({ converted: 2, keptInline: 0 });
    expect(assetShaOf(p.plan.pages[0].images[0].href)).toBe(await sha256Hex(jpegBytes(3)));
    expect(p.plan.pages[0].images[1].href).toBe(PNG_FURNITURE);
    expect(assetShaOf(p.boards!.b1.photo!.href)).toBe(await sha256Hex(jpegBytes(7)));
  });

  it('ouverture d’un JSON v1 : converti, signalé, original jamais réécrit (nouveau fichier demandé)', async () => {
    const s = newSession();
    const text = JSON.stringify(v1Project());
    const original = new Blob([text]);
    const r = await openProjectData(original, 'maison.voltaplan', s, { background: false });
    expect(r.format).toBe('v1');
    expect(r.needsNewFile).toBe(true);
    expect(r.warnings).toContainEqual({ key: 'format.v1Converted' });
    expect(r.project.version).toBe(2);
    expect(projectAssetRefs(r.project)).toHaveLength(2);
    expect(await original.text()).toBe(text);
  });

  it('aller-retour v1 → archive v2 → réouverture sur un autre « appareil »', async () => {
    const s1 = newSession();
    const opened = await openProjectData(JSON.stringify(v1Project()), 'maison.voltaplan', s1, { background: false });
    opened.project.evidence = { version: 1, sources: [{ id: 'src_1', sha256: '0'.repeat(64), kind: 'boardPhoto', label: 'Photo', addedAt: '' }], observations: [], proposals: [], questions: [], provenance: [], history: [] } as unknown as Project['evidence'];
    const archive = (await serializeProject(opened.project, undefined, s1))!;
    // Autre appareil : stockage de travail vide
    const s2 = newSession();
    const r = await openProjectData(archive, 'maison.voltaplan', s2, { background: false });
    expect(r.format).toBe('v2');
    expect(r.needsNewFile).toBe(false);
    expect(r.report?.invalid).toEqual([]);
    expect(r.project.plan.pages[0].images.map((i) => i.href)).toEqual(opened.project.plan.pages[0].images.map((i) => i.href));
    expect((r.project.evidence as { sources: unknown[] }).sources).toHaveLength(1);
    const sha = assetShaOf(r.project.boards!.b1.photo!.href)!;
    const blob = await s2.blob(sha);
    expect(await sha256Hex(blob)).toBe(sha);
    expect(await s2.store.has(sha)).toBe(true); // copié au premier accès
  });

  it('document indisponible : l’enregistrement est refusé avant d’écrire quoi que ce soit', async () => {
    const s = newSession();
    const p = emptyProject();
    p.boards = { b: { slots: {}, photo: { href: 'asset:' + 'a'.repeat(64), x: 0, y: 0, w: 1, h: 1 } } } as Project['boards'];
    let written = 0;
    const sink = new WritableStream<Uint8Array>({ write: (c) => void (written += c.length) });
    await expect(serializeProject(p, sink, s)).rejects.toBeInstanceOf(MissingAssetsError);
    expect(written).toBe(0);
    // Les documents sources de l'assistant absents ne bloquent pas (description seule)
    const q = emptyProject();
    q.evidence = { version: 1, sources: [{ id: 's', sha256: 'b'.repeat(64), kind: 'other', label: 'x', addedAt: '' }] } as unknown as Project['evidence'];
    expect((await projectWriteInput(q, s)).originals).toEqual([]);
  });

  it('modèle et dossier de preuves séparés puis réunis ; sources illisibles gardées telles quelles', () => {
    const p = emptyProject();
    p.evidence = { version: 1, sources: [] } as unknown as Project['evidence'];
    const { projectText, sourcesText } = splitProject(p);
    expect(JSON.parse(projectText).evidence).toBeUndefined();
    expect(JSON.parse(mergeSources(projectText, sourcesText).text).evidence).toEqual({ version: 1, sources: [] });
    const bad = mergeSources(projectText, '{pas du json');
    expect(bad.sourcesUnreadable).toBe(true);
    expect(JSON.parse(bad.text).evidenceRaw).toBe('{pas du json');
  });
});

describe('export v1 : liste de ce qui ne peut pas être gardé', () => {
  it('images réintégrées, PDF remplacé par son image, documents sources listés', async () => {
    const s = newSession();
    const photo = await s.store.add(new Blob([jpegBytes(9)], { type: 'image/jpeg' }));
    const pdfBytes = new TextEncoder().encode('%PDF-1.7 contenu');
    const pdf = await s.store.add(new Blob([pdfBytes]));
    s.setDisplayMaker(async () => new Blob([jpegBytes(11)], { type: 'image/jpeg' }));
    const p = emptyProject();
    p.plan.pages = [{ id: 'pg', name: 'Étage', walls: [], openings: [], rects: [], symbols: [], labels: [], images: [{ center: { x: 0, y: 0 }, w: 1, h: 1, angle: 0, href: 'asset:' + pdf.sha256, background: true }] }];
    p.boards = {
      b1: { slots: {}, photo: { href: 'asset:' + photo.sha256, x: 0, y: 0, w: 1, h: 1 } },
      b2: { slots: {}, photo: { href: 'asset:' + 'c'.repeat(64), x: 0, y: 0, w: 1, h: 1 } },
    } as Project['boards'];
    p.evidence = { version: 1, sources: [{ id: 'src_9', sha256: 'd'.repeat(64), kind: 'report', label: 'Rapport', addedAt: '' }] } as unknown as Project['evidence'];
    const { json, losses } = await exportV1(p, { original: (sha) => s.blob(sha), display: (sha) => s.displayBlob(sha) });
    const out = JSON.parse(json) as Project;
    expect(out.version).toBe(1);
    expect(json).not.toContain('asset:');
    expect(out.boards!.b1.photo!.href.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(out.plan.pages[0].images[0].href.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(out.boards!.b2.photo).toBeUndefined();
    expect(losses.map((l) => l.kind).sort()).toEqual(['missing', 'pdfOriginal', 'sourceDocument']);
    // Le projet en mémoire n'est pas modifié
    expect(p.boards!.b1.photo!.href).toBe('asset:' + photo.sha256);
  });
});

describe('fichier déplacé ou modifié pendant la session (F3)', () => {
  it('documents déjà copiés : disponibles ; les autres : erreur claire', async () => {
    const a = jpegBytes(21, 5000);
    const b = jpegBytes(22, 5000);
    const shaA = await sha256Hex(a);
    const shaB = await sha256Hex(b);
    const p = emptyProject();
    p.boards = {
      x: { slots: {}, photo: { href: 'asset:' + shaA, x: 0, y: 0, w: 1, h: 1 } },
      y: { slots: {}, photo: { href: 'asset:' + shaB, x: 0, y: 0, w: 1, h: 1 } },
    } as Project['boards'];
    const { blob } = await writeArchive({
      projectText: JSON.stringify(p),
      title: 't',
      appVersion: '0',
      originals: [
        { sha256: shaA, mime: 'image/jpeg', size: a.length, blob: async () => new Blob([a]) },
        { sha256: shaB, mime: 'image/jpeg', size: b.length, blob: async () => new Blob([b]) },
      ],
    });
    // Fichier dont la lecture échoue après un « déplacement » (comme un File devenu illisible)
    let moved = false;
    class Broken extends Blob {
      arrayBuffer(): Promise<ArrayBuffer> {
        return Promise.reject(Object.assign(new Error('déplacé'), { name: 'NotReadableError' }));
      }
    }
    class Fragile extends Blob {
      slice(start?: number, end?: number, type?: string): Blob {
        return moved ? new Broken([]) : super.slice(start, end, type);
      }
    }
    const s = newSession();
    const r = await openProjectData(new Fragile([blob!]), 'p.voltaplan', s, { background: false });
    expect(r.format).toBe('v2');
    await s.blob(shaA); // affiché, donc copié
    moved = true;
    expect((await s.blob(shaA)).size).toBe(a.length);
    await expect(s.blob(shaB)).rejects.toMatchObject({ reason: 'unreadable' });
    await expect(s.blob(shaB)).rejects.toBeInstanceOf(AssetUnavailableError);
    expect((await s.missing(r.project)).map((m) => m.sha256)).toEqual([shaB]);
  });

  it('copie en arrière-plan : tout est copié, la source n’est plus nécessaire', async () => {
    const a = jpegBytes(31, 3000);
    const sha = await sha256Hex(a);
    const p = emptyProject();
    p.boards = { x: { slots: {}, photo: { href: 'asset:' + sha, x: 0, y: 0, w: 1, h: 1 } } } as Project['boards'];
    const { blob } = await writeArchive({ projectText: JSON.stringify(p), title: 't', appVersion: '0', originals: [{ sha256: sha, mime: 'image/jpeg', size: a.length, blob: async () => new Blob([a]) }] });
    const s = newSession();
    await openProjectData(blob!, 'p.voltaplan', s, { background: false });
    expect(s.hasSource(sha)).toBe(true);
    let progress = '';
    await s.copyInBackground((d, t) => (progress = `${d}/${t}`));
    expect(progress).toBe('1/1');
    expect(s.hasSource(sha)).toBe(false);
    expect(await s.store.has(sha)).toBe(true);
  });
});
