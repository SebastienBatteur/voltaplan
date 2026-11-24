// @vitest-environment node
/**
 * Format v2 : archive ZIP. Toutes les archives piégées sont fabriquées ici, jamais de fichiers réels.
 */
import { describe, expect, it } from 'vitest';
import { ArchiveError, AssetIntegrityError, crc32, readArchive, verifyArchive, writeArchive, type ArchiveWriteInput } from '../src/format/archive';
import { DEFAULT_LIMITS, capacityAdvice, deviceLimits } from '../src/format/limits';
import { buildManifest, classifyPath, ManifestError, MIMETYPE, parseManifest, sniffType, typeMatches, assetShaOf } from '../src/format/manifest';
import { Sha256, sha256Hex } from '../src/format/sha256';
import { loadZipLib } from '../src/format/zip';

const enc = new TextEncoder();
const fakeJpeg = (n = 2000, seed = 1) => {
  const b = new Uint8Array(n);
  let x = seed;
  for (let i = 0; i < n; i++) b[i] = (x = (x * 1103515245 + 12345) >>> 0) >>> 24;
  b.set([0xff, 0xd8, 0xff, 0xe0], 0);
  return b;
};
const fakePdf = (n = 3000) => {
  const b = fakeJpeg(n, 7);
  b.set(enc.encode('%PDF-1.7\n'), 0);
  return b;
};
const project = JSON.stringify({ format: 'voltaplan', version: 2, meta: { title: 'Test' }, roots: [] });

async function input(extra: Partial<ArchiveWriteInput> = {}): Promise<{ input: ArchiveWriteInput; jpg: Uint8Array; pdf: Uint8Array; jpgSha: string; pdfSha: string }> {
  const jpg = fakeJpeg();
  const pdf = fakePdf();
  const jpgSha = await sha256Hex(jpg);
  const pdfSha = await sha256Hex(pdf);
  const disp = fakeJpeg(500, 3);
  return {
    jpg,
    pdf,
    jpgSha,
    pdfSha,
    input: {
      projectText: project,
      sourcesText: JSON.stringify({ sources: [] }),
      title: 'Test',
      appVersion: '0.1.0',
      originals: [
        { sha256: jpgSha, mime: 'image/jpeg', size: jpg.length, name: 'tableau.jpg', blob: async () => new Blob([jpg]) },
        { sha256: pdfSha, mime: 'application/pdf', size: pdf.length, name: 'plan.pdf', blob: async () => new Blob([pdf]) },
      ],
      derived: [{ of: pdfSha, role: 'display', sha256: await sha256Hex(disp), mime: 'image/jpeg', size: disp.length, blob: async () => new Blob([disp]) }],
      ...extra,
    },
  };
}

async function validArchive() {
  const i = await input();
  const { blob, manifest } = await writeArchive(i.input);
  return { ...i, blob: blob!, manifest };
}

/** Archive fabriquée entrée par entrée (zip.js), pour les cas piégés. */
async function craft(entries: { path: string; data: Uint8Array | string; level?: number; opts?: Record<string, unknown> }[]): Promise<Blob> {
  const lib = await loadZipLib();
  const w = new lib.ZipWriter(new lib.BlobWriter('application/zip'), { extendedTimestamp: false });
  for (const e of entries) {
    const r = typeof e.data === 'string' ? new lib.TextReader(e.data) : new lib.Uint8ArrayReader(e.data);
    await w.add(e.path, r, { level: e.level ?? 0, dataDescriptor: false, ...(e.opts ?? {}) });
  }
  return w.close();
}

async function bytesOf(b: Blob) {
  return new Uint8Array(await b.arrayBuffer());
}

/** Remplace la première occurrence de `from` par `to` (même longueur) dans tous les en-têtes. */
function patchAll(buf: Uint8Array, from: string, to: string) {
  const f = enc.encode(from);
  const t = enc.encode(to);
  for (let i = 0; i + f.length <= buf.length; i++) if (f.every((c, k) => buf[i + k] === c)) buf.set(t, i);
}

describe('SHA-256', () => {
  it('incrémental = Web Crypto, pour toutes les tailles de remplissage', async () => {
    for (const n of [0, 1, 55, 56, 63, 64, 65, 119, 120, 1000, 100_000]) {
      const d = fakeJpeg(Math.max(n, 4)).subarray(0, n);
      const h = new Sha256();
      // découpage irrégulier
      for (let i = 0; i < n; i += 37) h.update(d.subarray(i, i + 37));
      expect(h.digestHex()).toBe(await sha256Hex(d));
    }
  });
  it('vecteur connu', async () => {
    expect(new Sha256().update(enc.encode('abc')).digestHex()).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('Blob volumineux : calcul par tranches', async () => {
    const big = new Uint8Array(65 * 1024 * 1024);
    big[12345] = 7;
    const viaBlob = await sha256Hex(new Blob([big]));
    expect(viaBlob).toBe(new Sha256().update(big).digestHex());
  });
});

describe('manifest et liste blanche', () => {
  it('classe les chemins', () => {
    const sha = 'a'.repeat(64);
    expect(classifyPath('project.json').kind).toBe('project');
    expect(classifyPath(`assets/${sha}.jpg`)).toEqual({ kind: 'asset', sha256: sha, ext: 'jpg' });
    expect(classifyPath(`derived/${sha}-display.jpg`)).toMatchObject({ kind: 'derived', of: sha, role: 'display' });
    expect(classifyPath('../evil')).toEqual({ kind: 'dangerous', reason: 'traversal' });
    expect(classifyPath('assets/../../x')).toMatchObject({ reason: 'traversal' });
    expect(classifyPath('/etc/passwd')).toMatchObject({ reason: 'absolute' });
    expect(classifyPath('C:/Windows/x')).toMatchObject({ reason: 'absolute' });
    expect(classifyPath('assets\\x.jpg')).toMatchObject({ reason: 'backslash' });
    expect(classifyPath('assets/é.jpg')).toMatchObject({ reason: 'nonAscii' });
    expect(classifyPath('a\u0000b')).toMatchObject({ reason: 'control' });
    expect(classifyPath(`assets/${sha}.svg`).kind).toBe('ignored');
    expect(classifyPath(`assets/${sha}.html`).kind).toBe('ignored');
    expect(classifyPath(`assets/${sha.toUpperCase()}.jpg`).kind).toBe('ignored');
    expect(classifyPath('index.html').kind).toBe('ignored');
  });
  it('reconnaît le type réel par sa signature (SVG et HTML refusés)', () => {
    expect(sniffType(fakeJpeg(16))).toBe('jpg');
    expect(sniffType(enc.encode('%PDF-1.4 xxxxxxx'))).toBe('pdf');
    expect(sniffType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png');
    expect(sniffType(enc.encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('webp');
    expect(sniffType(enc.encode('\0\0\0\x18ftypheic\0\0'))).toBe('heic');
    expect(sniffType(enc.encode('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(sniffType(enc.encode('<!DOCTYPE html><html>'))).toBeNull();
    expect(typeMatches('jpg', 'png')).toBe(false);
    expect(typeMatches('heif', 'heic')).toBe(true);
  });
  it('valide le manifest et refuse une version future incompatible', () => {
    const m = buildManifest([], '0.1.0', '');
    expect(parseManifest(JSON.stringify(m)).formatVersion).toBe(2);
    expect(() => parseManifest('{')).toThrow(ManifestError);
    expect(() => parseManifest(JSON.stringify({ ...m, minReaderVersion: 3 }))).toThrow(/newerVersion/);
    expect(() => parseManifest(JSON.stringify({ ...m, format: 'autre' }))).toThrow(/notVoltaplan/);
    expect(() => parseManifest(JSON.stringify({ ...m, files: [{ path: 'x', size: -1, sha256: 'z', role: 'model' }] }))).toThrow(ManifestError);
    // Version future compatible (ajouts facultatifs) : lisible
    expect(parseManifest(JSON.stringify({ ...m, formatVersion: 3, minReaderVersion: 2, extra: 1 })).formatVersion).toBe(3);
  });
  it('références asset:', () => {
    expect(assetShaOf('asset:' + 'b'.repeat(64))).toBe('b'.repeat(64));
    expect(assetShaOf('asset:../x')).toBeNull();
    expect(assetShaOf('data:image/png;base64,')).toBeNull();
  });
});

describe('archive : écriture et lecture', () => {
  it('aller-retour : mimetype en tête, médias stockés, SHA-256 vérifiés', async () => {
    const { blob, jpg, jpgSha, pdfSha, manifest } = await validArchive();
    const raw = await bytesOf(blob);
    expect([...raw.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(new TextDecoder().decode(raw.subarray(30, 38))).toBe('mimetype');
    expect(new TextDecoder().decode(raw.subarray(38, 38 + MIMETYPE.length))).toBe(MIMETYPE);
    expect(manifest.files.map((f) => f.role)).toEqual(['model', 'sources', 'readme', 'original', 'original', 'derived']);
    const a = await readArchive(blob);
    expect(a.report.invalid).toEqual([]);
    expect(a.report.ignored).toEqual([]);
    expect(a.report.recovered).toBe(false);
    expect(a.projectText).toBe(project);
    expect(a.originals.get(jpgSha)!.name).toBe('tableau.jpg');
    const got = await bytesOf(await a.originals.get(jpgSha)!.open());
    expect(got).toEqual(jpg);
    expect(a.originals.get(pdfSha)!.mime).toBe('application/pdf');
    expect(a.derived).toHaveLength(1);
    await verifyArchive(a);
    expect(a.report.invalid).toEqual([]);
    expect(raw.length).toBeGreaterThan(jpg.length); // médias non recompressés
  });

  it('lecture sélective : les documents ne sont pas lus à l’ouverture', async () => {
    const big = fakeJpeg(2_000_000, 9);
    const sha = await sha256Hex(big);
    const { blob } = await writeArchive({ projectText: project, title: 't', appVersion: '0', originals: [{ sha256: sha, mime: 'image/jpeg', size: big.length, blob: async () => new Blob([big]) }] });
    let read = 0;
    class Spy extends Blob {
      slice(a?: number, b?: number, t?: string): Blob {
        const s = super.slice(a, b, t);
        read += s.size;
        return s;
      }
    }
    const spy = new Spy([blob!]);
    const a = await readArchive(spy);
    expect(read).toBeLessThan(blob!.size / 10);
    const doc = a.originals.get(sha)!;
    expect(doc.state).toBe('unverified');
    const slice = await doc.open();
    expect(slice.size).toBe(big.length);
    expect(doc.state).toBe('ok');
  });

  it('document stocké altéré d’un octet : SHA-256 incorrect, document isolé, le projet s’ouvre', async () => {
    const { blob, jpgSha, jpg } = await validArchive();
    const raw = await bytesOf(blob);
    // Position du contenu de la photo : recherche de ses 64 premiers octets
    const needle = jpg.subarray(100, 164);
    const at = raw.findIndex((_, i) => needle.every((c, k) => raw[i + k] === c));
    raw[at] ^= 0xff;
    const a = await readArchive(new Blob([raw]));
    expect(a.projectText).toBe(project);
    await expect(a.originals.get(jpgSha)!.open()).rejects.toMatchObject({ name: 'AssetIntegrityError', reason: 'shaMismatch' });
    expect(a.report.invalid).toContainEqual({ path: `assets/${jpgSha}.jpg`, reason: 'shaMismatch' });
  });

  it('modèle compressé altéré : CRC ou données invalides, rien n’est ouvert', async () => {
    const { blob } = await validArchive();
    const raw = await bytesOf(blob);
    const name = enc.encode('project.json');
    const lh = raw.findIndex((_, i) => raw[i] === 0x50 && raw[i + 1] === 0x4b && raw[i + 2] === 3 && raw[i + 3] === 4 && name.every((c, k) => raw[i + 30 + k] === c));
    const start = lh + 30 + name.length + (raw[lh + 28] | (raw[lh + 29] << 8));
    raw[start + 5] ^= 0x55;
    await expect(readArchive(new Blob([raw]))).rejects.toBeInstanceOf(ArchiveError);
  });

  it('chemins dangereux et inconnus : isolés ou ignorés, jamais lus', async () => {
    const blob = await craft([
      { path: 'mimetype', data: MIMETYPE },
      { path: 'project.json', data: project, level: 9 },
      { path: '../evil.txt', data: 'x' },
      { path: '/abs.txt', data: 'x' },
      { path: 'assets\\win.jpg', data: 'x' },
      { path: 'index.html', data: '<script>alert(1)</script>' },
      { path: `assets/${'c'.repeat(64)}.svg`, data: '<svg/>' },
    ]);
    const a = await readArchive(blob);
    expect(a.report.invalid.map((i) => i.reason).sort()).toEqual(['absolute', 'backslash', 'traversal']);
    expect(a.report.ignored.map((i) => i.path).sort()).toEqual([`assets/${'c'.repeat(64)}.svg`, 'index.html']);
    expect(a.report.warnings).toContain('noManifest');
    expect(a.report.recovered).toBe(true);
    expect(a.originals.size).toBe(0);
  });

  it('lien symbolique refusé', async () => {
    const sha = 'd'.repeat(64);
    const blob = await craft([
      { path: 'project.json', data: project },
      { path: `assets/${sha}.jpg`, data: '/etc/passwd', opts: { unixMode: 0o120777 } },
    ]);
    const a = await readArchive(blob);
    expect(a.report.invalid).toContainEqual({ path: `assets/${sha}.jpg`, reason: 'symlink' });
    expect(a.originals.size).toBe(0);
  });

  it('entrée chiffrée refusée', async () => {
    const sha = await sha256Hex(fakeJpeg());
    const blob = await craft([
      { path: 'project.json', data: project },
      { path: `assets/${sha}.jpg`, data: fakeJpeg(), opts: { password: 'secret', encryptionStrength: 3 } },
    ]);
    const a = await readArchive(blob);
    expect(a.report.invalid).toContainEqual({ path: `assets/${sha}.jpg`, reason: 'encrypted' });
  });

  it('noms en double : archive ambiguë refusée', async () => {
    const blob = await craft([
      { path: 'project.json', data: project },
      { path: 'projecX.json', data: '{"format":"voltaplan","roots":[{"evil":1}]}' },
    ]);
    const raw = await bytesOf(blob);
    patchAll(raw, 'projecX.json', 'project.json');
    await expect(readArchive(new Blob([raw]))).rejects.toMatchObject({ code: 'ambiguous' });
  });

  it('bombe de décompression : taux de compression borné', async () => {
    const sha = 'e'.repeat(64);
    const zeros = new Uint8Array(3 * 1024 * 1024);
    zeros.set([0xff, 0xd8, 0xff], 0);
    const blob = await craft([
      { path: 'project.json', data: project },
      { path: `assets/${sha}.jpg`, data: zeros, level: 9 },
    ]);
    const a = await readArchive(blob);
    expect(a.report.invalid).toContainEqual({ path: `assets/${sha}.jpg`, reason: 'ratio' });
  });

  it('taille déclarée mensongère : la décompression s’arrête au plafond', async () => {
    // Modèle de 2 Mo de texte aléatoire-ish (taux de compression modéré), plafond du modèle à 1 Mo,
    // et taille déclarée réécrite à 1 000 octets dans le répertoire central.
    const big = JSON.stringify({ format: 'voltaplan', pad: Array.from({ length: 200_000 }, (_, i) => (i * 7919) % 1000).join(',') });
    const blob = await craft([{ path: 'project.json', data: big, level: 9 }]);
    const raw = await bytesOf(blob);
    const dv = new DataView(raw.buffer);
    for (let i = raw.length - 22; i >= 0; i--)
      if (dv.getUint32(i, true) === 0x02014b50) {
        dv.setUint32(i + 24, 1000, true);
        break;
      }
    // et dans l'en-tête local
    dv.setUint32(22, 1000, true);
    await expect(readArchive(new Blob([raw]), { limits: { ...DEFAULT_LIMITS, model: 1024 * 1024 } })).rejects.toBeInstanceOf(ArchiveError);
  });

  it('modèle trop gros : refusé avant lecture', async () => {
    const blob = await craft([{ path: 'project.json', data: 'x'.repeat(200_000), level: 9 }]);
    await expect(readArchive(blob, { limits: { ...DEFAULT_LIMITS, model: 100_000 } })).rejects.toBeInstanceOf(ArchiveError);
  });

  it('trop d’entrées, archive totale trop grosse', async () => {
    const { blob } = await validArchive();
    await expect(readArchive(blob, { limits: { ...DEFAULT_LIMITS, entries: 3 } })).rejects.toMatchObject({ code: 'tooManyEntries' });
    await expect(readArchive(blob, { limits: { ...DEFAULT_LIMITS, total: 1000 } })).rejects.toMatchObject({ code: 'tooLarge' });
  });

  it('type trompeur : HTML ou SVG sous une extension d’image refusé à l’usage', async () => {
    const html = enc.encode('<!DOCTYPE html><script>alert(1)</script>');
    const svg = enc.encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
    const s1 = await sha256Hex(html);
    const s2 = await sha256Hex(svg);
    const blob = await craft([
      { path: 'project.json', data: project },
      { path: `assets/${s1}.jpg`, data: html },
      { path: `assets/${s2}.png`, data: svg },
    ]);
    const a = await readArchive(blob);
    await expect(a.originals.get(s1)!.open()).rejects.toMatchObject({ reason: 'typeMismatch' });
    await expect(a.originals.get(s2)!.open()).rejects.toMatchObject({ reason: 'typeMismatch' });
  });

  it('document annoncé mais absent, taille incohérente avec le manifest', async () => {
    const { input: i, jpgSha, pdfSha } = await input();
    const { manifest } = await writeArchive(i);
    const jpg = fakeJpeg();
    const m = { ...manifest, files: manifest.files.map((f) => (f.sha256 === pdfSha && f.role === 'original' ? { ...f, size: f.size + 1 } : f)) };
    const blob = await craft([
      { path: 'mimetype', data: MIMETYPE },
      { path: 'manifest.json', data: JSON.stringify(m), level: 9 },
      { path: 'project.json', data: project, level: 9 },
      { path: `assets/${pdfSha}.pdf`, data: fakePdf() },
    ]);
    const a = await readArchive(blob);
    expect(jpg.length).toBeGreaterThan(0);
    expect(a.report.invalid).toContainEqual({ path: `assets/${jpgSha}.jpg`, reason: 'missing' });
    expect(a.report.invalid).toContainEqual({ path: `assets/${pdfSha}.pdf`, reason: 'sizeMismatch' });
    expect(a.report.recovered).toBe(true);
  });

  it('version future incompatible : message « mettez à jour »', async () => {
    const m = { ...buildManifest([], '9', ''), minReaderVersion: 3, formatVersion: 3 };
    const blob = await craft([
      { path: 'mimetype', data: MIMETYPE },
      { path: 'manifest.json', data: JSON.stringify(m) },
      { path: 'project.json', data: project },
    ]);
    await expect(readArchive(blob)).rejects.toMatchObject({ code: 'newerVersion' });
  });

  it('pas une archive ; archive sans projet', async () => {
    await expect(readArchive(new Blob([project]))).rejects.toMatchObject({ code: 'notZip' });
    await expect(readArchive(await craft([{ path: 'mimetype', data: MIMETYPE }]))).rejects.toMatchObject({ code: 'noProject' });
  });

  it('archive tronquée : récupération du modèle et des documents complets', async () => {
    const { blob, jpgSha, pdfSha } = await validArchive();
    const raw = await bytesOf(blob);
    // Coupe au milieu du dernier document (le dérivé) : répertoire central perdu
    const cut = raw.subarray(0, raw.length - 800);
    const a = await readArchive(new Blob([cut]));
    expect(a.report.warnings).toContain('truncated');
    expect(a.report.recovered).toBe(true);
    expect(a.projectText).toBe(project);
    expect((await a.originals.get(jpgSha)!.open()).size).toBe(2000);
    expect((await a.originals.get(pdfSha)!.open()).size).toBe(3000);
  });

  it('écriture : un document dont la taille a changé fait échouer l’écriture', async () => {
    const { input: i } = await input();
    i.originals[0].blob = async () => new Blob([fakeJpeg(10)]);
    await expect(writeArchive(i)).rejects.toBeInstanceOf(AssetIntegrityError);
  });

  it('CRC-32 conforme', () => {
    expect(crc32(enc.encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('limites adaptées à l’appareil (F5)', () => {
  it('mémoire faible : entrées compressées plafonnées plus bas', () => {
    expect(deviceLimits({ memoryGb: 2, quota: null, usage: null }).inflateInMemory).toBe(50 * 1024 * 1024);
    expect(deviceLimits({ memoryGb: 8, quota: null, usage: null }).inflateInMemory).toBe(DEFAULT_LIMITS.inflateInMemory);
  });
  it('conseils : lourd, pas de copie de travail possible, trop gros', () => {
    const MB = 1024 * 1024;
    expect(capacityAdvice(10 * MB, { memoryGb: null, quota: null, usage: null })).toEqual({ level: 'ok' });
    expect(capacityAdvice(600 * MB, { memoryGb: null, quota: null, usage: null }).level).toBe('heavy');
    expect(capacityAdvice(600 * MB, { memoryGb: 4, quota: 1000 * MB, usage: 500 * MB }).level).toBe('noWorkingCopy');
    expect(capacityAdvice(3000 * MB, { memoryGb: null, quota: null, usage: null }).level).toBe('tooLarge');
  });
});
