/**
 * Dimensions d'une image (PNG, JPEG, WebP) lues dans son en-tête, sans dépendance : sert à ESTIMER le nombre de
 * jetons d'entrée avant tout appel (mode simulation du banc). Renvoie null si le format n'est pas reconnu.
 */
export function imageSize(b: Uint8Array): { width: number; height: number } | null {
  const be16 = (i: number) => (b[i] << 8) | b[i + 1];
  const le16 = (i: number) => b[i] | (b[i + 1] << 8);
  const le24 = (i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
  const ascii = (i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
  // PNG : signature, puis bloc IHDR (largeur et hauteur sur 4 octets, gros-boutiste)
  if (b.length >= 24 && b[0] === 0x89 && ascii(1, 3) === 'PNG') {
    const w = ((b[16] << 24) >>> 0) + (b[17] << 16) + (b[18] << 8) + b[19];
    const h = ((b[20] << 24) >>> 0) + (b[21] << 16) + (b[22] << 8) + b[23];
    return { width: w, height: h };
  }
  // JPEG : parcours des segments jusqu'au premier « début de trame » (SOF0…SOF15, sauf DHT, JPG, DAC)
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const m = b[i + 1];
      if (m === 0xff) {
        i++;
        continue;
      }
      if (m === 0x01 || (m >= 0xd0 && m <= 0xd9)) {
        i += 2;
        continue;
      }
      const len = be16(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { width: be16(i + 7), height: be16(i + 5) };
      if (len < 2) return null;
      i += 2 + len;
    }
    return null;
  }
  // WebP : conteneur RIFF, bloc VP8 (avec pertes), VP8L (sans pertes) ou VP8X (étendu)
  if (b.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const chunk = ascii(12, 4);
    if (chunk === 'VP8 ') return { width: le16(26) & 0x3fff, height: le16(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const [b0, b1, b2, b3] = [b[21], b[22], b[23], b[24]];
      return { width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
    }
    if (chunk === 'VP8X') return { width: 1 + le24(24), height: 1 + le24(27) };
  }
  return null;
}
