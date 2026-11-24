/**
 * Application de bureau : orchestration de l'enregistrement atomique (src/io/desktopSave.ts et branche isDesktop
 * de src/io/files.ts). Les commandes Rust (pick_save_path, save_begin, save_chunk, save_commit, save_abort,
 * file_state) sont simulées : ces tests vérifient les appels, l'envoi par morceaux, la détection de conflit et la
 * mise à jour de l'état, pas l'écriture elle-même (tests Rust de src-tauri/src/atomic_save.rs).
 */
import { emptyProject } from '../src/model/tree';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

type Files = typeof import('../src/io/files');
type DesktopSave = typeof import('../src/io/desktopSave');
let files: Files;
let desktop: DesktopSave;
// Chargés après vi.resetModules() : mêmes classes que celles utilisées par files.ts.
let ConflictError: typeof import('../src/io/conflict').ConflictError;
let openProjectData: typeof import('../src/io/projectData').openProjectData;

interface Sim {
  /** Octets reçus par écriture (identifiant de save_begin). */
  written: Map<number, Uint8Array[]>;
  /** Taille de chaque morceau reçu. */
  chunks: number[];
}

/** Simule les commandes Rust ; `state` : ce que renvoie file_state (état actuel du fichier sur le disque). */
function backend(
  opts: { pick?: string | null; state?: [number, number] | null; commit?: [number, number, boolean] | string; begin?: string; chunk?: string } = {},
): Sim {
  const sim: Sim = { written: new Map(), chunks: [] };
  let next = 0;
  invoke.mockReset();
  invoke.mockImplementation(async (cmd: string, args?: unknown, options?: { headers?: Record<string, string> }) => {
    if (cmd === 'pick_save_path') return opts.pick === undefined ? 'C:\\Projets\\Maison.voltaplan' : opts.pick;
    if (cmd === 'file_state') return opts.state ?? null;
    if (cmd === 'save_begin') {
      if (opts.begin) throw opts.begin;
      sim.written.set(++next, []);
      return next;
    }
    if (cmd === 'save_chunk') {
      if (opts.chunk) throw opts.chunk;
      const id = Number(options?.headers?.['upload-id']);
      // Octets bruts (corps de requête IPC) ; instanceof est faussé par les contextes jsdom/Node.
      expect(ArrayBuffer.isView(args) && (args as object).constructor.name).toBe('Uint8Array');
      sim.chunks.push((args as Uint8Array).length);
      sim.written.get(id)!.push((args as Uint8Array).slice());
      return null;
    }
    if (cmd === 'save_commit') {
      if (typeof opts.commit === 'string') throw opts.commit;
      return opts.commit ?? [1000, 42, false];
    }
    if (cmd === 'save_abort') return null;
    throw new Error('commande inconnue ' + cmd);
  });
  return sim;
}
/** Octets reçus par l'écriture `id`, réunis. */
const bytesOf = (sim: Sim, id: number) => new Uint8Array(Buffer.concat(sim.written.get(id)!));
const calls = (cmd: string) => invoke.mock.calls.filter((c) => c[0] === cmd);

beforeAll(async () => {
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
  vi.resetModules();
  files = await import('../src/io/files');
  desktop = await import('../src/io/desktopSave');
  ({ ConflictError } = await import('../src/io/conflict'));
  ({ openProjectData } = await import('../src/io/projectData'));
});
afterAll(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});
beforeEach(() => files.resetHandle());

describe('bureau : enregistrement atomique', () => {
  it('premier enregistrement : boîte Rust, puis archive envoyée en flux (begin, morceaux, commit) avec copie .bak', async () => {
    expect(files.isDesktop).toBe(true);
    const sim = backend();
    const p = emptyProject();
    p.meta.title = 'Maison';
    expect(await files.saveProject(p, 'Maison.voltaplan')).toBe('Maison.voltaplan');
    expect(calls('pick_save_path')[0][1]).toEqual({ defaultName: 'Maison.voltaplan', ext: 'voltaplan', description: 'Projet Voltaplan' });
    expect(calls('save_begin')[0][1]).toEqual({ path: 'C:\\Projets\\Maison.voltaplan', backup: true });
    expect(calls('save_chunk')[0][2]).toEqual({ headers: { 'upload-id': '1' } });
    expect(calls('save_commit')[0][1]).toEqual({ id: 1 });
    expect(calls('save_abort')).toHaveLength(0);
    // Les octets reçus forment une archive v2 lisible.
    const bytes = bytesOf(sim, 1);
    const r = await openProjectData(new Blob([bytes]), 'Maison.voltaplan');
    expect(r.format).toBe('v2');
    expect(r.project.meta.title).toBe('Maison');
    expect(files.hasDeviceTarget()).toBe(true);
  });

  it('Ctrl+S : même chemin sans boîte ; l’état renvoyé par save_commit sert à la comparaison suivante', async () => {
    backend({ commit: [1000, 42, false] });
    await files.saveProject(emptyProject(), 'Maison.voltaplan');
    // Fichier inchangé depuis notre écriture : réécriture, nouvel état [2000, 50].
    backend({ state: [1000, 42], commit: [2000, 50, true] });
    await files.saveProject(emptyProject(), 'Maison.voltaplan');
    expect(calls('pick_save_path')).toHaveLength(0);
    expect(calls('file_state')[0][1]).toEqual({ path: 'C:\\Projets\\Maison.voltaplan' });
    expect(calls('save_commit')).toHaveLength(1);
    // L'état de référence est désormais [2000, 50] : l'ancien [1000, 42] signale une modification ailleurs.
    backend({ state: [1000, 42] });
    await expect(files.saveProject(emptyProject(), 'Maison.voltaplan')).rejects.toBeInstanceOf(ConflictError);
    backend({ state: [2000, 50] });
    await files.saveProject(emptyProject(), 'Maison.voltaplan');
    expect(calls('save_commit')).toHaveLength(1);
  });

  it('fichier modifié ailleurs : ConflictError, rien n’est écrit ; force : remplacement confirmé', async () => {
    backend();
    await files.saveProject(emptyProject(), 'Maison.voltaplan');
    backend({ state: [5000, 99] });
    const err = await files.saveProject(emptyProject(), 'Maison.voltaplan').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect((err as InstanceType<typeof ConflictError>).where).toBe('Maison.voltaplan');
    expect(calls('save_begin')).toHaveLength(0);
    await files.saveProject(emptyProject(), 'Maison.voltaplan', false, { force: true });
    expect(calls('save_commit')).toHaveLength(1);
  });

  it('erreur Rust au remplacement (texte) : rejet avec une Error ; le fichier courant n’est pas changé', async () => {
    backend({ commit: 'Enregistrement de « C:\\Projets\\Maison.voltaplan » impossible : disque plein' });
    const err = await files.saveProject(emptyProject(), 'Maison.voltaplan').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('disque plein');
    expect(files.hasDeviceTarget()).toBe(false); // le prochain « Enregistrer » rouvre la boîte
  });

  it('erreur pendant l’envoi d’un morceau : rejet, écriture abandonnée', async () => {
    backend({ chunk: 'Enregistrement impossible : disque plein' });
    await expect(files.saveProject(emptyProject(), 'Maison.voltaplan')).rejects.toThrow('disque plein');
    expect(calls('save_commit')).toHaveLength(0);
    expect(files.hasDeviceTarget()).toBe(false);
  });

  it('chemin refusé par Rust à save_begin : rejet, aucun morceau envoyé', async () => {
    backend({ begin: 'Chemin non autorisé' });
    await expect(files.saveProject(emptyProject(), 'Maison.voltaplan')).rejects.toThrow('Chemin non autorisé');
    expect(calls('save_chunk')).toHaveLength(0);
  });

  it('échec après un premier enregistrement : l’état de référence reste celui de la dernière écriture réussie', async () => {
    backend({ commit: [1000, 42, false] });
    await files.saveProject(emptyProject(), 'Maison.voltaplan');
    backend({ state: [1000, 42], commit: 'Chemin non autorisé' });
    await expect(files.saveProject(emptyProject(), 'Maison.voltaplan')).rejects.toThrow('Chemin non autorisé');
    backend({ state: [1000, 42] });
    await files.saveProject(emptyProject(), 'Maison.voltaplan');
    expect(calls('save_commit')).toHaveLength(1);
  });

  it('boîte annulée : null, aucune écriture', async () => {
    backend({ pick: null });
    expect(await files.saveProject(emptyProject(), 'Maison.voltaplan')).toBeNull();
    expect(calls('save_begin')).toHaveLength(0);
  });

  it('export : extension transmise à la boîte, pas de copie .bak, octets transmis tels quels', async () => {
    const sim = backend({ pick: '/home/a/liste.csv' });
    await files.download(new Blob(['a;b\n']), 'liste.csv');
    expect(calls('pick_save_path')[0][1]).toEqual({ defaultName: 'liste.csv', ext: 'csv', description: '.CSV' });
    expect(calls('save_begin')[0][1]).toEqual({ path: '/home/a/liste.csv', backup: false });
    expect(new TextDecoder().decode(bytesOf(sim, 1))).toBe('a;b\n');
  });

  it('copie v1 : .voltaplan sans copie .bak', async () => {
    backend({ pick: '/home/a/Maison (v1).voltaplan' });
    const r = await files.exportProjectV1(emptyProject(), 'Maison.voltaplan');
    expect(r.name).toBe('Maison (v1).voltaplan');
    expect(calls('pick_save_path')[0][1]).toMatchObject({ ext: 'voltaplan' });
    expect(calls('save_begin')[0][1]).toEqual({ path: '/home/a/Maison (v1).voltaplan', backup: false });
  });

  it('gros fichier : morceaux de taille bornée, contenu reconstitué à l’identique', async () => {
    const size = 2 * desktop.CHUNK_SIZE + 12345;
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) data[i] = (i * 31) & 0xff;
    // Blob : par morceaux
    let sim = backend({ pick: '/home/a/x.trik' });
    await files.download(new Blob([data]), 'x.trik');
    expect(sim.chunks).toEqual([desktop.CHUNK_SIZE, desktop.CHUNK_SIZE, 12345]);
    expect(Buffer.compare(bytesOf(sim, 1), data)).toBe(0);
    // Flux : écritures de tailles quelconques regroupées
    sim = backend();
    const { stream, done } = desktop.desktopWritable('/home/a/y.voltaplan', { backup: true });
    const w = stream.getWriter();
    for (let off = 0; off < size; off += 1_000_003) await w.write(data.slice(off, off + 1_000_003));
    await w.close();
    expect(await done).toEqual({ mtime: 1000, size: 42 });
    expect(sim.chunks).toEqual([desktop.CHUNK_SIZE, desktop.CHUNK_SIZE, 12345]);
    expect(Buffer.compare(bytesOf(sim, 1), data)).toBe(0);
  });

  it('flux abandonné (même verrouillé par un écrivain) : save_abort, pas de commit', async () => {
    backend();
    const { stream, done, cancel } = desktop.desktopWritable('/home/a/y.voltaplan', { backup: true });
    const w = stream.getWriter();
    await w.write(new Uint8Array([1, 2, 3]));
    await cancel(new Error('document illisible'));
    await expect(done).rejects.toThrow('document illisible');
    expect(calls('save_abort')[0][1]).toEqual({ id: 1 });
    expect(calls('save_commit')).toHaveLength(0);
  });
});
