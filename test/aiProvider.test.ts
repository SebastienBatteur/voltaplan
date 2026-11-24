/** Fournisseurs d'IA : appel compatible OpenAI (fetch simulé), validation stricte des réponses, erreurs typées. */
import { z } from 'zod';
import { AiError, isLocalUrl, PROVIDERS, readImageStructured } from '../src/ai/provider';
import { aiReady, DEFAULT_AI } from '../src/ai/settings';

const schema = z.object({ rows: z.array(z.object({ row: z.number() })) });
const req = { imageDataUrl: 'data:image/jpeg;base64,AAAA', prompt: 'lire', schema, name: 'test' };
const local = { provider: 'openaiCompatible' as const, model: 'llava', baseUrl: 'http://localhost:11434/v1' };

function mockFetch(body: unknown, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('fournisseur compatible OpenAI', () => {
  it('envoie l’image et le schéma, valide la réponse', async () => {
    const calls = mockFetch({ choices: [{ message: { content: '```json\n{"rows":[{"row":0}]}\n```' } }] });
    const r = await readImageStructured(local, req);
    expect(r).toEqual({ rows: [{ row: 0 }] });
    expect(calls[0].url).toBe('http://localhost:11434/v1/chat/completions');
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.model).toBe('llava');
    expect(body.response_format.type).toBe('json_schema');
    expect(body.messages[0].content[0].image_url.url).toBe(req.imageDataUrl);
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBeUndefined(); // modèle local : pas de clé
  });

  it('réponse hors schéma : erreur, jamais une donnée', async () => {
    mockFetch({ choices: [{ message: { content: '{"rows":[{"row":"zéro"}]}' } }] });
    await expect(readImageStructured(local, req)).rejects.toMatchObject({ code: 'invalidResponse' });
  });

  it('texte non JSON, refus et erreur HTTP : erreurs typées', async () => {
    mockFetch({ choices: [{ message: { content: 'Je ne sais pas' } }] });
    await expect(readImageStructured(local, req)).rejects.toBeInstanceOf(AiError);
    mockFetch({ choices: [{ message: { content: null, refusal: 'non' } }] });
    await expect(readImageStructured(local, req)).rejects.toMatchObject({ code: 'refusal' });
    mockFetch('quota', 429);
    await expect(readImageStructured(local, req)).rejects.toMatchObject({ code: 'http' });
  });

  it('service distant sans clé : refusé avant tout envoi', async () => {
    const calls = mockFetch({});
    await expect(readImageStructured({ provider: 'openaiCompatible', model: 'gpt', baseUrl: 'https://api.openai.com/v1' }, req)).rejects.toMatchObject({ code: 'noKey' });
    expect(calls).toHaveLength(0);
  });

  it('clé transmise en en-tête Authorization', async () => {
    const calls = mockFetch({ choices: [{ message: { content: '{"rows":[]}' } }] });
    await readImageStructured({ provider: 'openaiCompatible', model: 'gpt', baseUrl: 'https://api.openai.com/v1/', apiKey: 'sk-test' }, req);
    expect(calls[0].url).toBe('https://api.openai.com/v1/chat/completions');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
  });
});

describe('réglages', () => {
  it('adresse locale reconnue', () => {
    expect(isLocalUrl('http://localhost:11434/v1')).toBe(true);
    expect(isLocalUrl('http://127.0.0.1:1234')).toBe(true);
    expect(isLocalUrl('https://localhost.evil.com/v1')).toBe(false);
    expect(isLocalUrl('https://api.openai.com/v1')).toBe(false);
  });

  it('IA prête : clé exigée sauf modèle local', () => {
    expect(aiReady({ ...DEFAULT_AI, enabled: true }, false)).toBe(false);
    expect(aiReady({ ...DEFAULT_AI, enabled: true }, true)).toBe(true);
    expect(aiReady({ ...DEFAULT_AI, enabled: true, ...local }, false)).toBe(true);
    expect(aiReady({ ...DEFAULT_AI, enabled: false, ...local }, false)).toBe(false);
    expect(PROVIDERS.anthropic.needsKey({})).toBe(true);
  });
});
