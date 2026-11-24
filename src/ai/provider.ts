/**
 * Fournisseurs d'IA interchangeables : une seule interface pour « lire une image et renvoyer des données
 * structurées validées ». Le reste de l'application (lecture du tableau, propositions, comparaison) ne dépend
 * d'aucun fournisseur.
 *
 *  - anthropic        : Claude (SDK officiel, sortie structurée).
 *  - openaiCompatible : toute API compatible « chat/completions » (OpenAI, Gemini via son point d'accès compatible,
 *                       Mistral, et modèles locaux : Ollama, LM Studio…). Sortie JSON validée par le même schéma.
 *
 * Les réponses sont toujours validées par le schéma zod : une réponse invalide est une erreur, jamais une donnée.
 * Les requêtes sont annulables (AbortSignal) et limitées dans le temps.
 */
import { z } from 'zod';

export type ProviderId = 'anthropic' | 'openaiCompatible';

export interface ProviderConfig {
  provider: ProviderId;
  model: string;
  /** Adresse de l'API compatible OpenAI (ex. https://api.openai.com/v1, http://localhost:11434/v1). */
  baseUrl?: string;
  apiKey?: string;
}

export interface VisionRequest<T> {
  imageDataUrl: string;
  prompt: string;
  schema: z.ZodType<T>;
  /** Nom du schéma (sortie structurée). */
  name: string;
  signal?: AbortSignal;
  maxTokens?: number;
}

/** Erreur d'IA traduisible (clé `ai.error.<code>`). */
export class AiError extends Error {
  constructor(
    public code: 'refusal' | 'invalidResponse' | 'http' | 'timeout' | 'network' | 'noKey',
    public detail = '',
  ) {
    super(code + (detail ? ' : ' + detail : ''));
    this.name = 'AiError';
  }
}

export interface ProviderInfo {
  id: ProviderId;
  /** Une clé est-elle exigée pour cette configuration ? (un modèle local n'en demande pas) */
  needsKey: (c: Pick<ProviderConfig, 'baseUrl'>) => boolean;
  defaultModel: string;
  defaultBaseUrl?: string;
}

/** Adresse locale (modèle sur l'ordinateur : rien ne sort de la machine). */
export const isLocalUrl = (url?: string) => !!url && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(url);

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  anthropic: { id: 'anthropic', needsKey: () => true, defaultModel: 'claude-opus-5-5' },
  openaiCompatible: { id: 'openaiCompatible', needsKey: (c) => !isLocalUrl(c.baseUrl), defaultModel: '', defaultBaseUrl: 'http://localhost:11434/v1' },
};

/** Délai maximal d'une lecture (les modèles locaux peuvent être lents). */
export const AI_TIMEOUT_MS = 180_000;

function withTimeout(signal: AbortSignal | undefined): { signal: AbortSignal; done: () => void; timedOut: () => boolean } {
  const ctrl = new AbortController();
  let expired = false;
  const timer = setTimeout(() => {
    expired = true;
    ctrl.abort();
  }, AI_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  return {
    signal: ctrl.signal,
    timedOut: () => expired,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new AiError('invalidResponse', r.error.issues[0]?.path.join('.') ?? '');
  return r.data;
}

async function anthropicRead<T>(c: ProviderConfig, req: VisionRequest<T>): Promise<T> {
  if (!c.apiKey) throw new AiError('noKey');
  const [{ default: Anthropic }, { zodOutputFormat }] = await Promise.all([import('@anthropic-ai/sdk'), import('@anthropic-ai/sdk/helpers/zod')]);
  // Clé de l'utilisateur, utilisée seulement dans son navigateur (pas de serveur) : usage voulu côté client.
  const client = new Anthropic({ apiKey: c.apiKey, dangerouslyAllowBrowser: true });
  const media = /^data:(image\/(?:jpeg|png|webp|gif));base64,/.exec(req.imageDataUrl)?.[1] ?? 'image/jpeg';
  const data = req.imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const t = withTimeout(req.signal);
  try {
    const response = await client.messages.parse(
      {
        model: c.model,
        max_tokens: req.maxTokens ?? 16000,
        output_config: { format: zodOutputFormat(req.schema as z.ZodType<T> & z.ZodObject) },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: media as 'image/jpeg', data } },
              { type: 'text', text: req.prompt },
            ],
          },
        ],
      },
      { signal: t.signal },
    );
    if (response.stop_reason === 'refusal') throw new AiError('refusal');
    if (!response.parsed_output) throw new AiError('invalidResponse');
    return validate(req.schema, response.parsed_output);
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (t.timedOut()) throw new AiError('timeout');
    throw e;
  } finally {
    t.done();
  }
}

async function openaiCompatibleRead<T>(c: ProviderConfig, req: VisionRequest<T>): Promise<T> {
  const base = (c.baseUrl || PROVIDERS.openaiCompatible.defaultBaseUrl!).replace(/\/+$/, '');
  if (PROVIDERS.openaiCompatible.needsKey(c) && !c.apiKey) throw new AiError('noKey');
  const t = withTimeout(req.signal);
  let r: Response;
  try {
    r = await fetch(base + '/chat/completions', {
      method: 'POST',
      signal: t.signal,
      headers: { 'Content-Type': 'application/json', ...(c.apiKey ? { Authorization: 'Bearer ' + c.apiKey } : {}) },
      body: JSON.stringify({
        model: c.model,
        max_tokens: req.maxTokens ?? 16000,
        response_format: { type: 'json_schema', json_schema: { name: req.name, strict: false, schema: z.toJSONSchema(req.schema) } },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: req.imageDataUrl } },
              { type: 'text', text: req.prompt + '\nAnswer with a single JSON object matching the requested schema, without any other text.' },
            ],
          },
        ],
      }),
    });
  } catch (e) {
    t.done();
    if (t.timedOut()) throw new AiError('timeout');
    if ((e as Error).name === 'AbortError') throw e;
    throw new AiError('network', base);
  }
  try {
    if (!r.ok) throw new AiError('http', `${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`);
    const body = (await r.json()) as { choices?: { message?: { content?: string; refusal?: string | null } }[] };
    const msg = body.choices?.[0]?.message;
    if (msg?.refusal) throw new AiError('refusal');
    const text = (msg?.content ?? '').trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new AiError('invalidResponse', 'JSON');
    }
    return validate(req.schema, json);
  } finally {
    t.done();
  }
}

/** Lecture structurée d'une image par le fournisseur choisi. */
export function readImageStructured<T>(c: ProviderConfig, req: VisionRequest<T>): Promise<T> {
  return c.provider === 'openaiCompatible' ? openaiCompatibleRead(c, req) : anthropicRead(c, req);
}
