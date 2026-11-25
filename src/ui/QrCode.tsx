import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/**
 * QR code dessiné en SVG (bibliothèque qrcode-generator, MIT), sans HTML injecté. Toujours noir sur blanc, avec la
 * marge de 4 modules exigée par la norme, pour être lu par l'appareil photo d'un téléphone dans les deux thèmes.
 */
export function QrCode({ text, size = 240, label }: { text: string; size?: number; label: string }) {
  const { n, d } = useMemo(() => {
    const q = qrcode(0, 'L');
    q.addData(text, 'Byte');
    q.make();
    const count = q.getModuleCount();
    let path = '';
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (q.isDark(r, c)) path += `M${c + 4} ${r + 4}h1v1h-1z`;
    return { n: count + 8, d: path };
  }, [text]);
  return (
    <svg viewBox={`0 0 ${n} ${n}`} width={size} height={size} role="img" aria-label={label} shapeRendering="crispEdges" className="qr-code">
      <rect width={n} height={n} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
