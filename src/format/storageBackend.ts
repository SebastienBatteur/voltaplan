/**
 * Abstraction de stockage d'un projet en DOSSIER (F8) : dossier cloud (OneDrive, Dropbox, Google Drive ; GitHub à
 * brancher sur la même interface), répertoire local (File System Access, Tauri plus tard), ou mémoire (tests).
 * L'archive `.voltaplan` reste la forme portable ; le contenu logique est le même (src/format/folder.ts).
 *
 * Contrat volontairement réduit, qui rend impossibles par construction les écritures dangereuses :
 *  - documents (`assets/…`) : écrits seulement s'ils sont absents (`putIfAbsent`), jamais remplacés ;
 *  - un seul fichier modifiable, le modèle, écrit de façon conditionnelle (`writeConditional`), avec le mécanisme
 *    de version propre au service (eTag, rev, sha, date de modification) ;
 *  - AUCUNE suppression : rien de ce qu'une version antérieure du modèle référence ne peut disparaître.
 */
import { ConflictError } from '../io/conflict';

export interface FolderEntry {
  name: string;
  size: number;
}

export interface FolderBackend {
  /** Nom affiché (service et dossier). */
  readonly label: string;
  /** Fichier texte et sa version ; null s'il n'existe pas. */
  readText(path: string): Promise<{ text: string; version?: string } | null>;
  /** Contenu d'un fichier (document), lu à la demande. */
  readBlob(path: string): Promise<Blob>;
  /** Fichiers d'un sous-dossier (vide s'il n'existe pas). */
  list(dir: string): Promise<FolderEntry[]>;
  /** Écrit un fichier immuable s'il est absent ; renvoie la taille de ce qui est (désormais) présent. */
  putIfAbsent(path: string, data: Blob): Promise<{ status: 'created' | 'exists'; size: number }>;
  /**
   * Écrit le fichier modifiable. `expected` : version lue (remplacement seulement si inchangé), `null` (création,
   * refusée si le fichier existe) ou `'any'` (remplacement confirmé par l'utilisateur). ConflictError sinon.
   * `concurrentCopy` (Google Drive, sans écriture conditionnelle) : modification faite ailleurs pendant l'envoi,
   * détectée après coup et recopiée sous ce nom dans le même dossier.
   */
  writeConditional(path: string, data: string, expected: string | null | 'any'): Promise<{ version?: string; concurrentCopy?: string }>;
}

/** Dossier en mémoire (tests, et modèle de comportement attendu des autres implémentations). */
export class MemoryFolderBackend implements FolderBackend {
  files = new Map<string, { data: Blob; version: number }>();
  writes: string[] = [];
  /** Injection de pannes : appelée avant chaque écriture (lever une erreur pour simuler une coupure). */
  beforeWrite?: (path: string) => void;
  private n = 0;
  constructor(readonly label = 'mémoire') {}

  async readText(path: string) {
    const f = this.files.get(path);
    return f ? { text: await f.data.text(), version: String(f.version) } : null;
  }
  async readBlob(path: string) {
    const f = this.files.get(path);
    if (!f) throw Object.assign(new Error('absent : ' + path), { name: 'NotFoundError' });
    return f.data;
  }
  async list(dir: string) {
    const prefix = dir.replace(/\/?$/, '/');
    return [...this.files.entries()].filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/')).map(([p, f]) => ({ name: p.slice(prefix.length), size: f.data.size }));
  }
  async putIfAbsent(path: string, data: Blob) {
    const cur = this.files.get(path);
    if (cur) return { status: 'exists' as const, size: cur.data.size };
    this.beforeWrite?.(path);
    this.files.set(path, { data, version: ++this.n });
    this.writes.push(path);
    return { status: 'created' as const, size: data.size };
  }
  async writeConditional(path: string, data: string, expected: string | null | 'any') {
    const cur = this.files.get(path);
    if (expected === null && cur) throw new ConflictError(path, 'existe');
    if (expected !== null && expected !== 'any' && String(cur?.version) !== expected) throw new ConflictError(path, `${expected} → ${cur?.version}`);
    this.beforeWrite?.(path);
    const version = ++this.n;
    this.files.set(path, { data: new Blob([data], { type: 'application/json' }), version });
    this.writes.push(path);
    return { version: String(version) };
  }
}
