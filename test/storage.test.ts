import { openProjectData } from '../src/io/projectData';
import { githubSave, utf8ToBase64 } from '../src/io/storage';
import { emptyProject } from '../src/model/tree';

describe('enregistrement GitHub', () => {
  it('encode en base64 un texte avec accents', () => {
    expect(atob(utf8ToBase64('é'))).toBe('Ã©');
    const s = 'Salle de bain — prise 2,5 mm²';
    expect(new TextDecoder().decode(Uint8Array.from(atob(utf8ToBase64(s)), (c) => c.charCodeAt(0)))).toBe(s);
  });

  it('remplace un fichier existant avec son SHA, sur la bonne branche', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (!init?.method) return new Response(JSON.stringify({ sha: 'abc123' }), { status: 200 });
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    const orig = globalThis.fetch;
    globalThis.fetch = fake;
    try {
      const p = emptyProject();
      p.meta.title = 'Maison';
      await githubSave('tok', { repo: 'me/dossiers', branch: 'main', folder: 'voltaplan' }, 'voltaplan/Maison.voltaplan', p);
    } finally {
      globalThis.fetch = orig;
    }
    expect(calls[0].url).toBe('https://api.github.com/repos/me/dossiers/contents/voltaplan/Maison.voltaplan?ref=main');
    expect(calls[1].init?.method).toBe('PUT');
    const body = JSON.parse(String(calls[1].init?.body));
    expect(body.sha).toBe('abc123');
    expect(body.branch).toBe('main');
    // Archive v2 : relue par la chaîne habituelle (signature PK)
    const bytes = Uint8Array.from(atob(body.content), (c) => c.charCodeAt(0));
    expect([...bytes.subarray(0, 2)]).toEqual([0x50, 0x4b]);
    expect((await openProjectData(new Blob([bytes]), 'Maison.voltaplan')).project.meta.title).toBe('Maison');
    expect((calls[1].init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });
});
