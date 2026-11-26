/**
 * Texte d'un PDF (pdf.js, dans le navigateur, sans envoi) : chaque morceau de texte horizontal avec sa page, sa
 * position (origine en haut à gauche, en points) et sa taille. Sert à reprendre un dossier PDF d'un autre logiciel
 * (src/import/pdfDossier.ts).
 */
import type { PdfPageSize, PdfText } from '../import/pdfDossier';
import { shapesFromOperatorList, type PdfShape } from '../import/pdfPlan';

/** Au-delà, un « dossier » n'en est plus un (et la lecture deviendrait longue). */
const MAX_PAGES = 60;

export async function readPdfText(data: Blob): Promise<{ items: PdfText[]; pages: PdfPageSize[]; shapes: PdfShape[][] }> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await data.arrayBuffer()) }).promise;
  try {
    const items: PdfText[] = [];
    const pages: PdfPageSize[] = [];
    const shapes: PdfShape[][] = [];
    for (let i = 1; i <= Math.min(doc.numPages, MAX_PAGES); i++) {
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: 1 });
      pages.push({ width: vp.width, height: vp.height });
      // Tracés (murs, portes, fenêtres des plans) : voir src/import/pdfPlan.ts
      const ol = await page.getOperatorList();
      shapes.push(shapesFromOperatorList(ol.fnArray, ol.argsArray as unknown[][], pdfjs.OPS as unknown as Record<string, number>, vp.transform));
      const tc = await page.getTextContent();
      for (const it of tc.items) {
        if (!('str' in it) || !it.str.trim()) continue;
        const [a, b, , , e, f] = it.transform as number[];
        // Texte tourné (filigrane, libellés verticaux du schéma) : pas dans un tableau
        if (Math.abs(b) > 0.01 * Math.abs(a)) continue;
        items.push({ page: i, x: e, y: vp.height - f, str: it.str, size: Math.hypot(a, b) });
      }
    }
    return { items, pages, shapes };
  } finally {
    await doc.destroy();
  }
}
