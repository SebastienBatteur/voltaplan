/**
 * Empreintes SHA-256 des documents (identité, dédoublonnage, vérification d'intégrité).
 *
 * Le CRC-32 du ZIP détecte une altération accidentelle, mais ce n'est PAS une protection cryptographique : il se
 * recalcule trivialement. L'identité d'un document reste donc son SHA-256, vérifié à chaque lecture depuis une
 * archive, un dossier cloud ou le stockage de travail.
 *
 * Petits contenus : `crypto.subtle.digest` (natif, rapide). Gros contenus : calcul incrémental par tranches de
 * `Blob`, pour ne jamais charger un PDF de 200 Mo en mémoire d'un coup (Web Crypto ne sait pas hacher en flux).
 */

/** Au-delà de cette taille, l'empreinte est calculée par tranches (mémoire bornée). */
export const SUBTLE_MAX_BYTES = 32 * 1024 * 1024;
/** Taille d'une tranche lue pour le calcul incrémental. */
export const CHUNK_BYTES = 4 * 1024 * 1024;

export const isSha256Hex = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
  0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** SHA-256 incrémental (FIPS 180-4), pour les contenus trop gros pour `crypto.subtle` en une fois. */
export class Sha256 {
  private h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  private w = new Uint32Array(64);
  private buf = new Uint8Array(64);
  private bufLen = 0;
  private total = 0;

  update(data: Uint8Array): this {
    let i = 0;
    this.total += data.length;
    if (this.bufLen) {
      const n = Math.min(64 - this.bufLen, data.length);
      this.buf.set(data.subarray(0, n), this.bufLen);
      this.bufLen += n;
      i = n;
      if (this.bufLen < 64) return this;
      this.block(this.buf, 0);
      this.bufLen = 0;
    }
    for (; i + 64 <= data.length; i += 64) this.block(data, i);
    if (i < data.length) {
      this.buf.set(data.subarray(i), 0);
      this.bufLen = data.length - i;
    }
    return this;
  }

  digestHex(): string {
    const bits = this.total * 8;
    const pad = new Uint8Array((this.bufLen < 56 ? 56 : 120) - this.bufLen + 8);
    pad[0] = 0x80;
    const dv = new DataView(pad.buffer);
    dv.setUint32(pad.length - 8, Math.floor(bits / 0x100000000));
    dv.setUint32(pad.length - 4, bits >>> 0);
    this.update(pad); // la longueur est déjà inscrite dans le remplissage
    let out = '';
    for (const v of this.h) out += v.toString(16).padStart(8, '0');
    return out;
  }

  private block(d: Uint8Array, o: number) {
    const w = this.w;
    for (let t = 0; t < 16; t++) w[t] = (d[o + 4 * t] << 24) | (d[o + 4 * t + 1] << 16) | (d[o + 4 * t + 2] << 8) | d[o + 4 * t + 3];
    for (let t = 16; t < 64; t++) {
      const a = w[t - 15];
      const b = w[t - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }
    const h = this.h;
    let a = h[0],
      b = h[1],
      c = h[2],
      e = h[4],
      f = h[5],
      g = h[6],
      hh = h[7],
      dd = h[3];
    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[t] + w[t]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g;
      g = f;
      f = e;
      e = (dd + t1) | 0;
      dd = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0;
    h[1] = (h[1] + b) | 0;
    h[2] = (h[2] + c) | 0;
    h[3] = (h[3] + dd) | 0;
    h[4] = (h[4] + e) | 0;
    h[5] = (h[5] + f) | 0;
    h[6] = (h[6] + g) | 0;
    h[7] = (h[7] + hh) | 0;
  }
}

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function subtleHex(bytes: Uint8Array): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>));
}

/** Lecture d'une tranche de Blob (compatible avec les Blob sans `arrayBuffer`, ex. anciens jsdom). */
export async function blobBytes(b: Blob): Promise<Uint8Array> {
  if (typeof b.arrayBuffer === 'function') return new Uint8Array(await b.arrayBuffer());
  return new Uint8Array(
    await new Promise<ArrayBuffer>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as ArrayBuffer);
      r.onerror = () => reject(r.error);
      r.readAsArrayBuffer(b);
    }),
  );
}

/**
 * SHA-256 (hexadécimal minuscule) d'un contenu. Un `Blob` volumineux est lu par tranches : la mémoire utilisée
 * reste de l'ordre de `CHUNK_BYTES`. `signal` : interruption (fermeture du projet, changement de page).
 */
export async function sha256Hex(data: Blob | Uint8Array | ArrayBuffer | string, signal?: AbortSignal): Promise<string> {
  if (typeof data === 'string') return subtleHex(new TextEncoder().encode(data));
  if (data instanceof ArrayBuffer) return subtleHex(new Uint8Array(data));
  if (data instanceof Uint8Array) {
    if (data.length <= SUBTLE_MAX_BYTES) return subtleHex(data);
    const h = new Sha256();
    for (let i = 0; i < data.length; i += CHUNK_BYTES) h.update(data.subarray(i, i + CHUNK_BYTES));
    return h.digestHex();
  }
  if (data.size <= SUBTLE_MAX_BYTES) return subtleHex(await blobBytes(data));
  const h = new Sha256();
  for (let i = 0; i < data.size; i += CHUNK_BYTES) {
    if (signal?.aborted) throw new DOMException('Interrompu', 'AbortError');
    h.update(await blobBytes(data.slice(i, i + CHUNK_BYTES)));
  }
  return h.digestHex();
}
