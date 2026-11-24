/**
 * Banc d'évaluation de la lecture des photos de tableaux par l'IA (à lancer par le propriétaire, avec SA clé ou SON
 * modèle local ; jamais en intégration continue). Mode d'emploi : docs/assistant-evaluation.md.
 *
 *   npx vite-node tools/ai-eval/run.ts -- --dir <dossier> --live --i-authorize-costs --provider anthropic --model <modèle>
 *   npx vite-node tools/ai-eval/run.ts -- --dir <dossier> --live --i-authorize-costs --provider openaiCompatible --base-url http://localhost:11434/v1 --model <modèle>
 *   npx vite-node tools/ai-eval/run.ts -- --dir tools/ai-eval/examples --predictions tools/ai-eval/examples
 *
 * Le dossier contient, par photo, un fichier `<nom>.truth.json` (vérité terrain) qui désigne son image. Sans `--live`,
 * AUCUN appel n'est fait : les lectures sont prises dans `--predictions` (fichiers `<nom>.prediction.json`). Un appel
 * réel exige `--live --i-authorize-costs` (autorisation explicite du propriétaire). Plusieurs modèles : run-matrix.ts.
 * La clé n'est jamais passée en argument : elle est lue dans une variable d'environnement (`--key-env`).
 * L'appel est exactement celui de l'application (src/ai/boardPhotoAi.ts : même consigne, même schéma).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { PhotoReading, readBoardPhoto } from '../../src/ai/boardPhotoAi';
import type { PhotoReadingT } from '../../src/ai/boardPhoto';
import type { ProviderId } from '../../src/ai/provider';
import { checkTruth, report, scorePhoto, type GroundTruth, type PhotoScore } from './score';

interface Args {
  dir: string;
  live: boolean;
  authorizeCosts: boolean;
  provider: ProviderId;
  model: string;
  baseUrl?: string;
  keyEnv?: string;
  predictions?: string;
  savePredictions?: string;
  out: string;
  priceIn?: number;
  priceOut?: number;
  currency: string;
  lang?: string;
  limit?: number;
}

function parseArgs(argv: string[]): Args {
  const a = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) a.set(k.slice(2), true);
    else {
      a.set(k.slice(2), next);
      i++;
    }
  }
  const str = (k: string) => (typeof a.get(k) === 'string' ? (a.get(k) as string) : undefined);
  const num = (k: string) => (str(k) !== undefined ? Number(str(k)) : undefined);
  if (!str('dir')) usage('--dir est obligatoire');
  const provider = (str('provider') ?? 'anthropic') as ProviderId;
  if (provider !== 'anthropic' && provider !== 'openaiCompatible') usage('--provider : anthropic ou openaiCompatible');
  const dir = resolve(str('dir')!);
  return {
    dir,
    live: a.get('live') === true,
    authorizeCosts: a.get('i-authorize-costs') === true,
    provider,
    model: str('model') ?? '',
    baseUrl: str('base-url'),
    keyEnv: str('key-env'),
    predictions: str('predictions') ? resolve(str('predictions')!) : undefined,
    savePredictions: str('save-predictions') ? resolve(str('save-predictions')!) : undefined,
    out: resolve(str('out') ?? join(dir, 'rapport-evaluation.md')),
    priceIn: num('price-in'),
    priceOut: num('price-out'),
    currency: str('currency') ?? 'USD',
    lang: str('lang'),
    limit: num('limit'),
  };
}

function usage(msg?: string): never {
  if (msg) console.error('Erreur : ' + msg + '\n');
  console.error(`Banc d'évaluation de la lecture des photos de tableaux (voir docs/assistant-evaluation.md)

  --dir <dossier>            fichiers <nom>.truth.json (+ images)          [obligatoire]
  --live --i-authorize-costs appelle réellement l'IA (les deux sont exigés ; sinon : aucune requête)
  --provider <id>            anthropic | openaiCompatible                 [anthropic]
  --model <modèle>           modèle à évaluer                             [obligatoire avec --live]
  --base-url <url>           API compatible OpenAI (ex. http://localhost:11434/v1)
  --key-env <VARIABLE>       variable d'environnement qui contient la clé [ANTHROPIC_API_KEY / OPENAI_API_KEY]
  --predictions <dossier>    sans --live : lectures déjà faites (<nom>.prediction.json)
  --save-predictions <dos.>  avec --live : garder chaque lecture pour la réévaluer sans nouvel appel
  --out <fichier.md>         rapport                                      [<dir>/rapport-evaluation.md]
  --price-in / --price-out   prix par million de jetons (entrée / sortie), pour le coût
  --currency <code>          devise du prix                               [USD]
  --lang <fr|nl|en>          langue des remarques (sinon celle de la vérité terrain)
  --limit <n>                seulement les n premières photos`);
  process.exit(2);
}

const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

/** Jetons consommés par la dernière requête (relevés sur la réponse, quel que soit le fournisseur). */
let lastUsage: { in?: number; out?: number } = {};
function watchUsage() {
  const orig = globalThis.fetch;
  globalThis.fetch = async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const r = await orig(input, init);
    try {
      const j = (await r.clone().json()) as { usage?: Record<string, number> };
      const u = j.usage ?? {};
      lastUsage = { in: u.input_tokens ?? u.prompt_tokens, out: u.output_tokens ?? u.completion_tokens };
    } catch {
      // réponse non JSON : pas de comptage
    }
    return r;
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(args.dir)) usage(`dossier introuvable : ${args.dir}`);
  if (!args.live && !args.predictions) usage('sans --live, donnez --predictions <dossier> (aucun appel à l’IA sans --live)');
  if (args.live && !args.authorizeCosts) usage('--live exige aussi --i-authorize-costs (autorisation explicite des appels et de leur coût)');
  if (args.live && !args.model) usage('--model est obligatoire avec --live');
  let apiKey: string | undefined;
  if (args.live) {
    const local = !!args.baseUrl && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(args.baseUrl);
    const env = args.keyEnv ?? (args.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY');
    apiKey = process.env[env];
    if (!apiKey && !local) usage(`clé absente : définissez la variable d'environnement ${env}`);
    watchUsage();
  }
  const files = readdirSync(args.dir)
    .filter((f) => f.endsWith('.truth.json'))
    .sort()
    .slice(0, args.limit ?? Infinity);
  if (!files.length) usage(`aucun fichier *.truth.json dans ${args.dir}`);
  const scores: PhotoScore[] = [];
  for (const f of files) {
    const name = basename(f, '.truth.json');
    const truth = JSON.parse(readFileSync(join(args.dir, f), 'utf8')) as GroundTruth;
    const bad = checkTruth(truth);
    if (bad) {
      scores.push({ ...scorePhoto(name, { ...truth, devices: [] } as GroundTruth, { rows: [], notes: null }), error: `vérité terrain invalide : ${bad}` });
      continue;
    }
    let reading: PhotoReadingT;
    let latencyMs: number | undefined;
    try {
      if (args.live) {
        const img = join(args.dir, truth.image);
        const mime = MIME[extname(img).toLowerCase()];
        if (!mime) throw new Error(`format d'image non pris en charge : ${extname(img)}`);
        const dataUrl = `data:${mime};base64,` + readFileSync(img).toString('base64');
        lastUsage = {};
        const t0 = performance.now();
        reading = await readBoardPhoto({
          config: { provider: args.provider, model: args.model, baseUrl: args.baseUrl, apiKey },
          photoDataUrl: dataUrl,
          rows: truth.rows,
          perRow: truth.perRow,
          lang: args.lang ?? truth.lang ?? 'fr',
          composed: !!truth.composed,
        });
        latencyMs = performance.now() - t0;
        if (args.savePredictions) {
          mkdirSync(args.savePredictions, { recursive: true });
          // Réponse de l'IA revalidée par le schéma avant écriture (seuls les champs attendus, types contrôlés) ; nom de
          // fichier dérivé de la photo locale, jamais de la réponse (voir .github/codeql-accepted.txt)
          const safe = PhotoReading.parse(reading);
          writeFileSync(join(args.savePredictions, `${name}.prediction.json`), JSON.stringify(safe, null, 2) + '\n');
        }
      } else {
        const pf = join(args.predictions!, `${name}.prediction.json`);
        if (!existsSync(pf)) throw new Error(`lecture absente : ${pf}`);
        reading = JSON.parse(readFileSync(pf, 'utf8')) as PhotoReadingT;
      }
    } catch (e) {
      scores.push({ ...scorePhoto(name, truth, { rows: [], notes: null }), latencyMs, error: (e as Error).message.slice(0, 200) });
      console.error(`✗ ${name} : ${(e as Error).message}`);
      continue;
    }
    const s: PhotoScore = { ...scorePhoto(name, truth, reading), latencyMs, tokensIn: lastUsage.in, tokensOut: lastUsage.out };
    if (args.live && args.priceIn !== undefined && args.priceOut !== undefined && s.tokensIn !== undefined && s.tokensOut !== undefined)
      s.cost = (s.tokensIn * args.priceIn + s.tokensOut * args.priceOut) / 1e6;
    scores.push(s);
    console.log(`✓ ${name} : ${s.matched}/${s.truth} appareils appariés`);
  }
  const md = report(scores, {
    title: "Évaluation de la lecture des photos de tableaux",
    mode: args.live ? "lecture réelle par l’IA (--live)" : `lectures enregistrées (${basename(args.predictions!)})`,
    provider: args.live ? args.provider : undefined,
    model: args.live ? args.model : undefined,
    date: new Date().toISOString().slice(0, 16).replace('T', ' '),
    currency: args.priceIn !== undefined ? args.currency : undefined,
  });
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, md);
  console.log(`Rapport : ${args.out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
