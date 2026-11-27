import { File as NodeFile } from 'node:buffer';
import { hasDtd, importTrikker } from '../src/import/trikker';
import { isSafeImageHref, sanitizeProjectImages } from '../src/io/sanitize';
import { parseProject } from '../src/io/storage';
import { readProjectFile } from '../src/io/files';
import { emptyProject } from '../src/model/tree';
import type { PlanPage } from '../src/model/types';
import { frWarnings } from './warnText';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

function trik(elements: string, prolog = '<?xml version="1.0" encoding="utf-8"?>') {
  return `${prolog}
<Document><RootNodes /><Grondplan><Pages><GrondplanPage Id="p1"><GrondplanElementen>${elements}</GrondplanElementen></GrondplanPage></Pages></Grondplan></Document>`;
}

const image = (href: string): PlanPage['images'][number] => ({ center: { x: 0, y: 0 }, w: 10, h: 10, angle: 0, href });

describe('import XML (Trikker) : pas de DTD ni d’entités', () => {
  it('un fichier Trikker ordinaire s’ouvre', () => {
    const { project } = importTrikker(trik(''), 'a.trik');
    expect(project.plan.pages.length).toBe(1);
  });

  it('refuse les entités externes (XXE)', () => {
    const xxe = trik('', '<?xml version="1.0"?>\n<!DOCTYPE Document [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>');
    expect(hasDtd(xxe)).toBe(true);
    expect(() => importTrikker(xxe)).toThrow(/DOCTYPE/);
  });

  it('refuse l’expansion d’entités (« milliard de rires »)', () => {
    const lol = '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;">]><Document>&lol2;</Document>';
    expect(() => importTrikker(lol)).toThrow();
    // Même sans DOCTYPE en tête, et quelle que soit la casse
    expect(hasDtd('<Document><!entity x "y"></Document>')).toBe(true);
  });

  it('via l’ouverture de fichier aussi', async () => {
    const f = new NodeFile([trik('', '<?xml version="1.0"?><!DOCTYPE x SYSTEM "http://exemple.invalid/x.dtd">')], 'x.trik');
    await expect(readProjectFile(f as unknown as File)).rejects.toThrow(/DOCTYPE/);
  });

  it('images Trikker : base64 valide uniquement, toujours en data:image/png', () => {
    const ok = importTrikker(trik('<Figuur Breedte="100" Hoogte="100" ImageAsBase64="iVBORw0K\nGgo="><Center X="1" Y="2" /></Figuur>'));
    expect(ok.project.plan.pages[0].images[0].href).toBe(PNG);
    const bad = importTrikker(trik('<Figuur Breedte="100" ImageAsBase64="&quot;);alert(1)//"><Center X="1" Y="2" /></Figuur>'));
    expect(bad.project.plan.pages[0].images).toEqual([]);
    expect(frWarnings(bad.warnings).join(' ')).toMatch(/illisible/);
  });
});

describe('images d’un projet ouvert : data:image uniquement', () => {
  it('adresses autorisées et refusées', () => {
    expect(isSafeImageHref(PNG)).toBe(true);
    expect(isSafeImageHref('data:image/jpeg;base64,/9j/')).toBe(true);
    expect(isSafeImageHref('data:image/svg+xml;charset=utf-8,%3Csvg%3E')).toBe(true);
    expect(isSafeImageHref('javascript:alert(1)')).toBe(false);
    expect(isSafeImageHref(' javascript:alert(1)')).toBe(false);
    expect(isSafeImageHref('https://suivi.exemple/pixel.png')).toBe(false);
    expect(isSafeImageHref('file:///C:/secret.png')).toBe(false);
    expect(isSafeImageHref('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeImageHref(undefined)).toBe(false);
  });

  it('retire les images non sûres du plan et des tableaux', () => {
    const p = emptyProject();
    p.plan.pages = [{ id: 'p', name: 'P', walls: [], openings: [], rects: [], images: [image(PNG), image('javascript:alert(1)'), image('http://x/y.png')], symbols: [], labels: [] }];
    p.boards = {
      a: { slots: {}, photo: { href: 'https://x/y.jpg', x: 0, y: 0, w: 1, h: 1 } },
      b: { slots: {}, photo: { href: PNG, x: 0, y: 0, w: 1, h: 1 } },
    } as typeof p.boards;
    expect(sanitizeProjectImages(p)).toBe(3);
    expect(p.plan.pages[0].images.map((i) => i.href)).toEqual([PNG]);
    expect(p.boards!.a.photo).toBeUndefined();
    expect(p.boards!.b.photo?.href).toBe(PNG);
  });

  it('parseProject et readProjectFile appliquent le filtre', async () => {
    const p = emptyProject();
    p.plan.pages = [{ id: 'p', name: 'P', walls: [], openings: [], rects: [], images: [image('javascript:alert(1)')], symbols: [], labels: [] }];
    expect(parseProject(JSON.stringify(p)).plan.pages[0].images).toEqual([]);
    const r = await readProjectFile(new NodeFile([JSON.stringify(p)], 'x.voltaplan') as unknown as File);
    expect(r.project.plan.pages[0].images).toEqual([]);
    expect(r.warnings).toContainEqual({ key: 'file.imagesRemoved', params: { n: 1 } });
  });
});
