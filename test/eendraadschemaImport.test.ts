/**
 * Import Eendraadschema (.eds). Tous les fichiers sont fabriqués ici (export Voltaplan ou JSON écrit à la main) :
 * aucun fichier réel de client.
 */
import { deflateSync } from 'node:zlib';
import { exportEendraadschema } from '../src/export/eendraadschema';
import { EdsError, decodeEds, importEendraadschema, inflateZlib, parseCable } from '../src/import/eendraadschema';
import { detectFormat, openProjectData } from '../src/io/projectData';
import { createNode, emptyProject, walk } from '../src/model/tree';
import type { ElNode, Project } from '../src/model/types';
import { errorText } from '../src/ui/errors';
import { translate } from '../src/i18n';

/** Forme d'un arbre sans les identifiants ni les données d'origine. */
interface Shape {
  kind: string;
  props: ElNode['props'];
  location?: string;
  children: Shape[];
}
const shape = (n: ElNode): Shape => ({ kind: n.kind, props: n.props, ...(n.location ? { location: n.location } : {}), children: n.children.map(shape) });

/** .eds compressé comme Eendraadschema : « EDS0040000 » + base64 du JSON en deflate (zlib). */
const compress = (txt: string) => 'EDS0040000' + deflateSync(Buffer.from(txt.slice(10), 'utf8')).toString('base64');

/** Petit projet : différentiel général, tableau, circuit de prises et va-et-vient, circuit de cuisson, sous 30 mA. */
function sample(): Project {
  const p = emptyProject();
  // L'export écrit le nom du client et l'adresse du chantier dans « owner »
  p.meta.client = { name: 'Client Test', address: {} };
  p.meta.site = { street: 'Rue de l’Essai', number: '1', postalCode: '1000', city: 'Bruxelles' };
  p.meta.installer = { name: 'Installateur Test', vat: 'BE0123456789', address: {} };
  p.meta.ean = '541448800000000000';
  const origin = createNode('origin');
  const rcd = createNode('protection', { device: 'rcd', ratedCurrent: 40, residualCurrent: 300, poles: '2P', rcdType: 'A' });
  const board = createNode('board', { name: 'TG' });
  const mcb = createNode('protection', { device: 'mcb', ratedCurrent: 20, curve: 'C', poles: '2P', breakingCapacity: 6 });
  const cable = createNode('cable', { cableType: 'XVB', conductors: 3, section: 2.5, method: 'inWall', inConduit: true });
  const s1 = createNode('switch', { switchType: 'twoWay' });
  const s2 = createNode('switch', { switchType: 'twoWay' });
  s2.children = [createNode('light', { count: 2 })];
  s1.children = [s2];
  const socket = createNode('socket', { count: 2 });
  socket.location = 'Salon';
  cable.children = [socket, s1];
  mcb.children = [cable];
  const rcd30 = createNode('protection', { device: 'rcd', ratedCurrent: 40, residualCurrent: 30, poles: '2P', rcdType: 'A' });
  const group = createNode('board', { name: '' });
  const oven = createNode('protection', { device: 'mcb', ratedCurrent: 20, curve: 'B', poles: '2P' });
  const ovenCable = createNode('cable', { cableType: 'XVB', conductors: 3, section: 2.5 });
  ovenCable.children = [createNode('appliance', { applianceType: 'oven' })];
  oven.children = [ovenCable];
  group.children = [oven];
  rcd30.children = [group];
  board.children = [mcb, rcd30];
  rcd.children = [board];
  origin.children = [rcd];
  p.roots = [origin];
  return p;
}

const byKind = (p: Project, kind: string) => [...walk(p.roots)].map((x) => x.node).filter((n) => n.kind === kind);

describe('import Eendraadschema : aller-retour avec l’export de Voltaplan', () => {
  const txt = exportEendraadschema(sample(), 'essai.eds');

  it('fichier non compressé (TXT0040000)', async () => {
    const { project, warnings } = await importEendraadschema(txt, 'essai.eds');
    expect(project.roots).toHaveLength(1);
    const root = shape(project.roots[0]);
    // origine → compteur → différentiel général → tableau (mis à la terre) → circuits
    expect(root.kind).toBe('origin');
    const meter = root.children[0];
    expect(meter.kind).toBe('meter');
    const main = meter.children[0];
    expect(main).toMatchObject({ kind: 'protection', props: { device: 'rcd', ratedCurrent: 40, residualCurrent: 300, poles: '2P', rcdType: 'A' } });
    const tg = main.children[0];
    expect(tg).toMatchObject({ kind: 'board', props: { name: 'TG' } });
    expect(tg.children.map((c) => c.kind)).toEqual(['earthBar', 'protection', 'protection']);
    const a = tg.children[1];
    expect(a.props).toEqual({ device: 'mcb', ratedCurrent: 20, curve: 'C', poles: '2P', breakingCapacity: 6, fixedLetter: 'A' });
    const cable = a.children[0];
    expect(cable).toMatchObject({ kind: 'cable', props: { cableType: 'XVB', conductors: 3, section: 2.5, method: 'inWall', inConduit: true } });
    expect(cable.children.map((c) => c.kind)).toEqual(['socket', 'switch']);
    expect(cable.children[0]).toMatchObject({ props: { count: 2, earth: true, childSafety: true, splashProof: false, threePhase: false }, location: 'Salon' });
    // Va-et-vient : un « Schakelaars » à 2 interrupteurs redevient deux va-et-vient en chaîne
    const sw = cable.children[1];
    expect(sw.props.switchType).toBe('twoWay');
    expect(sw.children[0].props.switchType).toBe('twoWay');
    expect(sw.children[0].children[0]).toMatchObject({ kind: 'light', props: { count: 2, lightType: 'standard' } });
    // 30 mA : Kring différentiel → Bord non mis à la terre → circuit
    const r30 = tg.children[2];
    expect(r30.props).toMatchObject({ device: 'rcd', residualCurrent: 30 });
    expect(r30.children[0].kind).toBe('board');
    expect(r30.children[0].children[0].children[0].children[0]).toMatchObject({ kind: 'appliance', props: { applianceType: 'oven' } });
    // Installation existante ; données d'origine gardées
    expect(project.meta.installationKind).toBe('existing');
    expect(project.meta.title).toBe('essai');
    const prot = byKind(project, 'protection').find((n) => n.props.fixedLetter === 'A')!;
    expect(prot.source).toMatchObject({ format: 'eendraadschema', tag: 'Kring', attrs: { naam: 'A', type_kabel: 'XVB 3G2,5' } });
    // Métadonnées
    expect(project.meta.client).toEqual({ name: 'Client Test', address: { street: 'Rue de l’Essai 1', postalCode: '1000', city: 'Bruxelles' } });
    expect(project.meta.installer).toMatchObject({ name: 'Installateur Test', vat: 'BE0123456789' });
    expect(project.meta.ean).toBe('541448800000000000');
    expect(project.meta.earthing).toBe('TT');
    expect(warnings).toEqual([]);
  });

  it('fichier compressé (EDS0040000) : même résultat', async () => {
    const eds = compress(txt);
    const d = await decodeEds(eds);
    expect(d).toMatchObject({ version: 4, compressed: true });
    expect(d.json).toBe(txt.slice(10));
    const a = await importEendraadschema(txt, 'essai.eds');
    const b = await importEendraadschema(eds, 'essai.eds');
    expect(b.project.roots.map(shape)).toEqual(a.project.roots.map(shape));
  });

  it('ouverture par le chemin habituel (reconnu par son en-tête ou son extension)', async () => {
    expect(detectFormat(new TextEncoder().encode('EDS0040000eJw'))).toBe('eds');
    expect(detectFormat(new TextEncoder().encode('TXT0040000{'))).toBe('eds');
    const r = await openProjectData(compress(txt), 'essai.eds');
    expect(r.format).toBe('eds');
    expect(r.needsNewFile).toBe(true);
    const r2 = await openProjectData(txt, 'sans-extension');
    expect(r2.format).toBe('eds');
    expect(byKind(r2.project, 'socket')).toHaveLength(1);
  });
});

describe('import Eendraadschema : fichiers fabriqués', () => {
  const v4 = (data: object[], extra: object = {}) => 'TXT0040000' + JSON.stringify({ length: data.length, data, active: data.map(() => true), id: data.map((d) => (d as { id: number }).id), curid: 99, ...extra });
  const it_ = (id: number, parent: number, props: object) => ({ id, parent, indent: 0, collapsed: false, props });

  it('rien d’inventé : valeur absente = absente ; types de structure traversés', async () => {
    const txt = v4(
      [
        it_(1, 0, { type: 'Aansluiting', bescherming: 'geen' }),
        it_(2, 1, { type: 'Bord', naam: '<B>' }),
        it_(3, 2, { type: 'Kring', bescherming: 'automatisch', kabel_is_aanwezig: true, type_kabel: 'iets vreemds' }),
        it_(4, 3, { type: 'Meerdere verbruikers' }),
        it_(5, 4, { type: 'Lichtcircuit', type_schakelaar: 'enkelpolig', aantal_schakelaars: '3', aantal_lichtpunten: '2' }),
        it_(6, 4, { type: 'Contactdoos' }),
        it_(7, 4, { type: 'Vrije tekst', tekst: 'Nota' }),
        it_(8, 4, { type: 'Onbekend ding' }),
        it_(9, 4, { type: 'Stopcontact' }),
        it_(10, 77, { type: 'Lichtpunt' }), // parent absent
      ],
      { sitplanjson: { elements: [{}, {}] }, properties: { owner: 'Jan Peeters<br>Kerkstraat 5<br>9000 Gent', info: 'Iets anders' } },
    );
    const { project, warnings } = await importEendraadschema(txt, 'x.eds');
    const board = byKind(project, 'board')[0];
    expect(board.props).toEqual({ name: 'B' });
    expect(board.children).toHaveLength(1); // pas de barrette de terre : « is_geaard » absent
    expect(byKind(project, 'protection')).toHaveLength(1); // Aansluiting sans protection
    const prot = byKind(project, 'protection')[0];
    expect(prot.props).toEqual({ device: 'mcb' }); // ni calibre, ni courbe, ni pôles inventés
    const cable = prot.children[0];
    expect(cable.props).toEqual({});
    // Meerdere verbruikers : ses enfants rejoignent le câble
    expect(cable.children.map((c) => c.kind)).toEqual(['switch', 'socket', 'other', 'socket']);
    const chain: string[] = [];
    for (let n: ElNode | undefined = cable.children[0]; n; n = n.children[0]) chain.push(n.kind === 'switch' ? String(n.props.switchType) : n.kind);
    expect(chain).toEqual(['twoWay', 'intermediate', 'twoWay', 'light']);
    expect(byKind(project, 'light')[0].props).toEqual({ count: 2 });
    expect(cable.children[1].props).toEqual({});
    expect(project.meta.client).toEqual({ name: 'Jan Peeters', address: { street: 'Kerkstraat 5', postalCode: '9000', city: 'Gent' } });
    const keys = warnings.map((w) => w.key);
    expect(keys).toEqual(expect.arrayContaining(['eds.warn.sitplan', 'eds.warn.orphans', 'eds.warn.unknown', 'eds.warn.texts', 'eds.warn.cables', 'eds.warn.info', 'eds.warn.checkSupply']));
    expect(warnings.find((w) => w.key === 'eds.warn.texts')?.params?.list).toBe('Nota');
    expect(warnings.find((w) => w.key === 'eds.warn.orphans')?.params?.n).toBe(1);
  });

  it('éléments inactifs ignorés', async () => {
    const data = [it_(1, 0, { type: 'Bord', naam: 'X' }), it_(2, 1, { type: 'Kring', bescherming: 'automatisch', amperage: '16' })];
    const txt = 'TXT0040000' + JSON.stringify({ length: 2, data, active: [true, false], id: [1, 2], curid: 3 });
    const { project } = await importEendraadschema(txt);
    expect(byKind(project, 'protection')).toHaveLength(0);
    expect(byKind(project, 'board')).toHaveLength(1);
  });

  it('ancien format sans en-tête (version 1, propriétés par position)', async () => {
    const keys = (vals: Record<number, unknown>) => Array.from({ length: 27 }, (_, i) => ['k' + i, 'STRING', vals[i] ?? '']);
    const doc = {
      length: 3,
      data: [
        { id: 1, parent: 0, indent: 0, collapsed: false, keys: keys({ 0: 'Bord', 1: true, 10: 'A' }) },
        { id: 2, parent: 1, indent: 1, collapsed: false, keys: keys({ 0: 'Kring', 4: '2', 7: 'automatisch', 8: '16', 9: 'XVB 3G1,5', 10: 'A1', 12: true, 16: 'In wand', 17: 'C' }) },
        { id: 3, parent: 2, indent: 2, collapsed: false, keys: keys({ 0: 'Stopcontact', 1: true, 2: false, 4: '2' }) },
      ],
      active: [true, true, true],
      id: [1, 2, 3],
      curid: 4,
    };
    const { project, warnings } = await importEendraadschema(JSON.stringify(doc), 'oud.eds');
    const prot = byKind(project, 'protection')[0];
    expect(prot.props).toEqual({ device: 'mcb', ratedCurrent: 16, poles: '2P', curve: 'C', fixedLetter: 'A1' });
    expect(prot.children[0].props).toEqual({ cableType: 'XVB', conductors: 3, section: 1.5, method: 'inWall' });
    expect(byKind(project, 'socket')[0].props).toEqual({ count: 2, earth: true, childSafety: false });
    expect(byKind(project, 'earthBar')).toHaveLength(1);
    expect(warnings.map((w) => w.key)).toContain('eds.warn.legacy');
  });

  it('désignations de câble', () => {
    expect(parseCable('XVB Cca 3G2,5').props).toEqual({ cableType: 'XVB', conductors: 3, section: 2.5 });
    expect(parseCable('2x16').props).toEqual({ conductors: 2, section: 16 });
    expect(parseCable('VOB 6 mm²').props).toEqual({ cableType: 'VOB', section: 6 });
    expect(parseCable('kabel').recognized).toBe(false);
  });
});

describe('import Eendraadschema : fichiers refusés avec un message clair', () => {
  const t = (k: string, p?: Record<string, string | number>) => translate('fr', k, p);

  it('version inconnue, fichier endommagé, pas un .eds', async () => {
    await expect(importEendraadschema('EDS0050000eJw=')).rejects.toMatchObject({ code: 'newerVersion', params: { version: 5 } });
    await expect(importEendraadschema('EDS0040000@@@')).rejects.toMatchObject({ code: 'corrupt' });
    await expect(importEendraadschema('EDS0040000' + Buffer.from('pas du deflate').toString('base64'))).rejects.toMatchObject({ code: 'corrupt' });
    // Compressé mais tronqué
    const full = deflateSync(Buffer.from(JSON.stringify({ data: [] }))).toString('base64');
    await expect(importEendraadschema('EDS0040000' + full.slice(0, 8))).rejects.toBeInstanceOf(EdsError);
    await expect(importEendraadschema('TXT0040000{pas du json')).rejects.toMatchObject({ code: 'corrupt' });
    await expect(importEendraadschema('TXT0040000{"a":1}')).rejects.toMatchObject({ code: 'notEds' });
    await expect(importEendraadschema('bonjour')).rejects.toMatchObject({ code: 'notEds' });
  });

  it('bombe de décompression arrêtée', async () => {
    const bomb = new Uint8Array(deflateSync(Buffer.alloc(200_000, 32)));
    await expect(inflateZlib(bomb, 10_000)).rejects.toMatchObject({ code: 'tooLarge' });
    expect((await inflateZlib(bomb)).byteLength).toBe(200_000);
  });

  it('messages traduits (FR, NL, EN)', () => {
    const e = new EdsError('newerVersion', { version: 7 });
    expect(errorText(e, t)).toContain('(7)');
    for (const lang of ['fr', 'nl', 'en'] as const)
      for (const code of ['notEds', 'corrupt', 'newerVersion', 'tooLarge'])
        expect(translate(lang, 'eds.error.' + code, { version: 5, max: 100 })).not.toBe('eds.error.' + code);
  });
});
