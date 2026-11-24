/**
 * Projet en DOSSIER (F8) : même contenu logique que l'archive, à plat, sur n'importe quel `FolderBackend`.
 *
 *   project.json          modèle ET dossier de preuves (Project complet, JSON) : le SEUL fichier modifiable,
 *                         écrit en dernier et de façon conditionnelle (conflits : src/io/conflict.ts) ;
 *   assets/<sha256>.<ext> documents originaux, immuables, envoyés une seule fois ;
 *   README.txt            explication en clair (écrit une fois).
 *
 * Différence avec l'archive : pas de manifest.json ni de sources.json séparés, car ce seraient des fichiers
 * modifiables de plus, impossibles à écrire en même temps que le modèle de façon atomique. Les documents se
 * vérifient par leur nom (empreinte), le modèle par la version du service.
 *
 * Ordre d'enregistrement : documents manquants d'abord (vérifiés), modèle ensuite. Une coupure laisse au pire des
 * documents en plus, jamais un modèle qui référence un document absent ; l'enregistrement suivant reprend où il
 * s'était arrêté (les documents déjà présents ne sont pas renvoyés). Un changement de format du modèle ne renvoie
 * aucun document. Rien n'est jamais supprimé.
 */
import { referencedShas } from './assets';
import { ASSET_TYPES, assetPath, extForMime, readmeText, sniffType, typeMatches, type AssetExt } from './manifest';
import { blobBytes, sha256Hex } from './sha256';
import type { DocSource } from './session';
import type { FolderBackend } from './storageBackend';

export const FOLDER_MODEL = 'project.json';
export const FOLDER_ASSETS = 'assets';

/** Un document du dossier distant ne correspond pas à l'original : rien n'est publié. */
export class RemoteAssetMismatchError extends Error {
  constructor(readonly path: string) {
    super(`Document distant différent de l'original : ${path}`);
    this.name = 'RemoteAssetMismatchError';
  }
}

export interface FolderDoc {
  sha256: string;
  mime: string;
  size: number;
  blob: () => Promise<Blob>;
}

export interface FolderSaveOptions {
  /** Fichier du modèle (copie de conflit : autre nom dans le même dossier). */
  modelPath?: string;
  /** Version lue (mise à jour), null (création), 'any' (remplacement confirmé). */
  expected: string | null | 'any';
  /**
   * Vérification d'un document envoyé : 'size' (taille annoncée par le service) ou 'download' (relu et haché :
   * plus sûr, deux fois plus de trafic).
   */
  verify?: 'size' | 'download';
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export interface FolderSaveResult {
  version?: string;
  /** Google Drive : version concurrente détectée après l'envoi, recopiée sous ce nom (voir storageBackend.ts). */
  concurrentCopy?: string;
  uploaded: number;
  skipped: number;
}

/** Enregistre un projet dans un dossier : documents d'abord (vérifiés), modèle ensuite (conditionnel). */
export async function saveToFolder(b: FolderBackend, projectText: string, docs: FolderDoc[], title: string, opts: FolderSaveOptions): Promise<FolderSaveResult> {
  const present = new Map((await b.list(FOLDER_ASSETS)).map((e) => [e.name, e.size]));
  let uploaded = 0;
  let skipped = 0;
  let done = 0;
  const seen = new Set<string>();
  for (const d of docs) {
    if (opts.signal?.aborted) throw new DOMException('Interrompu', 'AbortError');
    const ext = extForMime(d.mime);
    if (!ext || seen.has(d.sha256)) continue;
    seen.add(d.sha256);
    const path = assetPath(d.sha256, ext);
    const name = path.slice(FOLDER_ASSETS.length + 1);
    const remote = present.get(name);
    // Taille 0 : reste d'une écriture interrompue (répertoire local), complété par le service s'il le permet
    if (remote !== undefined && !(remote === 0 && d.size > 0)) {
      // Déjà envoyé (nommé par son contenu) : jamais renvoyé, jamais remplacé
      if (remote !== d.size) throw new RemoteAssetMismatchError(path);
      skipped++;
    } else {
      const blob = await d.blob();
      if (blob.size !== d.size) throw new RemoteAssetMismatchError(path);
      const r = await b.putIfAbsent(path, blob);
      if (r.size !== d.size) throw new RemoteAssetMismatchError(path);
      if (opts.verify === 'download' && (await sha256Hex(await b.readBlob(path))) !== d.sha256) throw new RemoteAssetMismatchError(path);
      if (r.status === 'created') uploaded++;
      else skipped++;
    }
    opts.onProgress?.(++done, docs.length);
  }
  await b.putIfAbsent('README.txt', new Blob([readmeText(title)], { type: 'text/plain' })).catch(() => undefined);
  // Modèle publié en dernier : il ne référence que des documents présents et vérifiés
  const w = await b.writeConditional(opts.modelPath ?? FOLDER_MODEL, projectText, opts.expected);
  return { version: w.version, ...(w.concurrentCopy ? { concurrentCopy: w.concurrentCopy } : {}), uploaded, skipped };
}

export interface OpenedFolder {
  projectText: string;
  version?: string;
  /** Documents référencés par le modèle et présents dans le dossier (lecture à la demande, vérifiée). */
  sources: Map<string, DocSource>;
  /** Empreintes référencées mais absentes du dossier. */
  missing: string[];
}

/** Ouvre un projet en dossier : modèle d'abord, documents à la demande. */
export async function openFromFolder(b: FolderBackend, modelPath = FOLDER_MODEL): Promise<OpenedFolder> {
  const model = await b.readText(modelPath);
  if (!model) throw Object.assign(new Error(`${b.label} : ${modelPath} absent`), { name: 'NotFoundError' });
  const files = new Map<string, { name: string; size: number; ext: AssetExt }>();
  const re = new RegExp(`^([0-9a-f]{64})\\.(${Object.keys(ASSET_TYPES).join('|')})$`);
  for (const e of await b.list(FOLDER_ASSETS)) {
    const m = re.exec(e.name);
    if (m) files.set(m[1], { name: e.name, size: e.size, ext: m[2] as AssetExt });
  }
  const sources = new Map<string, DocSource>();
  const missing: string[] = [];
  for (const sha of referencedShas(model.text)) {
    const f = files.get(sha);
    if (!f) {
      missing.push(sha);
      continue;
    }
    sources.set(sha, {
      mime: ASSET_TYPES[f.ext],
      size: f.size,
      open: async () => {
        const blob = await b.readBlob(`${FOLDER_ASSETS}/${f.name}`);
        if (blob.size !== f.size) throw Object.assign(new Error('taille'), { name: 'AssetIntegrityError', reason: 'sizeMismatch' });
        if (!typeMatches(f.ext, sniffType(await blobBytes(blob.slice(0, 16))))) throw Object.assign(new Error('type'), { name: 'AssetIntegrityError', reason: 'typeMismatch' });
        if ((await sha256Hex(blob)) !== sha) throw Object.assign(new Error('empreinte'), { name: 'AssetIntegrityError', reason: 'shaMismatch' });
        return blob.type ? blob : blob.slice(0, blob.size, ASSET_TYPES[f.ext]);
      },
    });
  }
  return { projectText: model.text, version: model.version, sources, missing };
}

/**
 * Transfert d'un projet vers un dossier (import d'une archive dans un dossier cloud, passage d'un service à
 * l'autre) : les documents sont lus à leur source (vérifiés) et envoyés s'ils manquent ; le modèle est créé
 * (jamais de remplacement d'un projet existant sans confirmation).
 */
export async function transferToFolder(
  projectText: string,
  sources: Map<string, DocSource>,
  to: FolderBackend,
  title: string,
  opts: Omit<FolderSaveOptions, 'expected'> & { expected?: string | null | 'any' } = {},
): Promise<FolderSaveResult> {
  const docs: FolderDoc[] = [];
  for (const sha of referencedShas(projectText)) {
    const src = sources.get(sha);
    if (!src) continue;
    // Taille et type annoncés (archive) : lecture au moment de l'envoi, un document à la fois en mémoire au plus
    if (src.mime && src.size !== undefined && extForMime(src.mime)) {
      docs.push({ sha256: sha, mime: src.mime, size: src.size, blob: () => src.open(opts.signal) });
      continue;
    }
    // Sinon (dossier) : le document est lu une fois ici pour connaître son type et sa taille
    const blob = await src.open(opts.signal);
    const ext = sniffType(await blobBytes(blob.slice(0, 16)));
    if (!ext) continue;
    docs.push({ sha256: sha, mime: ASSET_TYPES[ext], size: blob.size, blob: async () => blob });
  }
  return saveToFolder(to, projectText, docs, title, { ...opts, expected: opts.expected ?? null });
}
