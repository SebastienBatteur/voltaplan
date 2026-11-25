/**
 * Écart S5 de la séance réelle du 2026-11-25 (docs/tests-cloud-reels.md) : un document coupé en plein envoi repartait
 * de zéro à l'essai suivant (PDF de 49 Mo : 2 tranches acceptées avant la coupure, 7 renvoyées après). La session
 * d'envoi Drive est maintenant gardée en mémoire pour un document désigné par son empreinte (`assets/<sha256>.<ext>`).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { DRIVE_CHUNK, driveResumeKey, resetDriveSessions } from '../src/io/drive';
import { createDriveProjectFolder, DriveFolderBackend } from '../src/io/driveFolder';
import { FakeDrive } from './cloudFakes';

const HASH = 'a'.repeat(64);
const SIZE = 2 * DRIVE_CHUNK + 100;

function content() {
  const b = new Uint8Array(SIZE);
  for (let i = 0; i < SIZE; i++) b[i] = (i * 31) & 255;
  return b;
}

/** Service simulé, et coupure du réseau juste après la 1re tranche acceptée. */
async function setup() {
  const fake = new FakeDrive();
  const f = await createDriveProjectFolder('tok', 'M', undefined, fake.fetch);
  const b = new DriveFolderBackend('tok', f.id, 'M', fake.fetch);
  let offline = false;
  fake.before = () => {
    if (offline) throw new TypeError('Failed to fetch');
  };
  fake.after = (c) => {
    if (c.method === 'PUT' && c.headers['content-range']?.startsWith('bytes 0-')) offline = true;
  };
  return { fake, b, back: () => ((offline = false), (fake.after = undefined)) };
}

const puts = (fake: FakeDrive, from = 0) =>
  fake.calls
    .slice(from)
    .filter((c) => c.method === 'PUT')
    .map((c) => c.headers['content-range']);
const sessionsOpened = (fake: FakeDrive, from = 0) => fake.calls.slice(from).filter((c) => c.url.includes('uploadType=resumable')).length;

describe('S5 : reprise d’un document interrompu (Google Drive)', () => {
  beforeEach(() => resetDriveSessions());

  it('clé de reprise seulement pour un nom fait de l’empreinte du contenu', () => {
    expect(driveResumeKey(HASH + '.pdf', ['P'], 10)).toBe(`create|P|${HASH}.pdf|10`);
    expect(driveResumeKey(HASH, undefined, 10)).toBe(`create||${HASH}|10`);
    expect(driveResumeKey('plan.pdf', ['P'], 10)).toBeUndefined();
    expect(driveResumeKey('project.json', ['P'], 10)).toBeUndefined();
  });

  it('coupure après la 1re tranche : au retour du réseau, reprise au dernier octet accepté, sans nouvelle session', async () => {
    const { fake, b, back } = await setup();
    const data = content();
    await expect(b.putIfAbsent(`assets/${HASH}.pdf`, new Blob([data], { type: 'application/pdf' }))).rejects.toThrow(TypeError);
    expect(sessionsOpened(fake)).toBe(1);

    back();
    const mark = fake.calls.length;
    const r = await b.putIfAbsent(`assets/${HASH}.pdf`, new Blob([data], { type: 'application/pdf' }));
    expect(r).toEqual({ status: 'created', size: SIZE });
    expect(sessionsOpened(fake, mark)).toBe(0);
    // On demande où reprendre, puis seulement la suite : la 1re tranche n'est pas renvoyée
    expect(puts(fake, mark)).toEqual([`bytes */${SIZE}`, `bytes ${DRIVE_CHUNK}-${2 * DRIVE_CHUNK - 1}/${SIZE}`, `bytes ${2 * DRIVE_CHUNK}-${SIZE - 1}/${SIZE}`]);
    // Un seul fichier, contenu exact
    const files = fake.byName(`${HASH}.pdf`);
    expect(files).toHaveLength(1);
    const f = files[0];
    const got = f.revisions[f.revisions.length - 1].data;
    expect(got.length).toBe(SIZE);
    // Comparaison octet par octet sans diff géant en cas d'échec
    let diff = -1;
    for (let i = 0; i < SIZE && diff < 0; i++) if (got[i] !== data[i]) diff = i;
    expect(diff).toBe(-1);
  });

  it('nom qui ne désigne pas le contenu : nouvelle session, envoi depuis le début (aucun risque de mélanger deux contenus)', async () => {
    const { fake, b, back } = await setup();
    const data = content();
    await expect(b.putIfAbsent('assets/plan.pdf', new Blob([data]))).rejects.toThrow(TypeError);
    back();
    const mark = fake.calls.length;
    await b.putIfAbsent('assets/plan.pdf', new Blob([data]));
    expect(sessionsOpened(fake, mark)).toBe(1);
    expect(puts(fake, mark)[0]).toBe(`bytes 0-${DRIVE_CHUNK - 1}/${SIZE}`);
  });

  it('session expirée entre-temps : nouvelle session, envoi complet, un seul fichier', async () => {
    const { fake, b, back } = await setup();
    const data = content();
    await expect(b.putIfAbsent(`assets/${HASH}.pdf`, new Blob([data]))).rejects.toThrow(TypeError);
    back();
    fake.expireSessions();
    const mark = fake.calls.length;
    const r = await b.putIfAbsent(`assets/${HASH}.pdf`, new Blob([data]));
    expect(r).toEqual({ status: 'created', size: SIZE });
    expect(sessionsOpened(fake, mark)).toBe(1);
    expect(fake.byName(`${HASH}.pdf`)).toHaveLength(1);
  });

  it('dernière tranche reçue mais réponse perdue : le fichier existe, il n’est ni recréé ni renvoyé', async () => {
    const fake = new FakeDrive();
    const f = await createDriveProjectFolder('tok', 'M', undefined, fake.fetch);
    const b = new DriveFolderBackend('tok', f.id, 'M', fake.fetch);
    let offline = false;
    fake.before = () => {
      if (offline) throw new TypeError('Failed to fetch');
    };
    fake.after = (c) => {
      // La dernière tranche arrive ; la coupure survient avant la réponse
      if (c.method === 'PUT' && c.headers['content-range']?.startsWith(`bytes ${2 * DRIVE_CHUNK}-`)) {
        offline = true;
        throw new TypeError('réponse perdue');
      }
    };
    const data = content();
    await expect(b.putIfAbsent(`assets/${HASH}.pdf`, new Blob([data]))).rejects.toThrow(TypeError);
    offline = false;
    fake.after = undefined;
    const r = await b.putIfAbsent(`assets/${HASH}.pdf`, new Blob([data]));
    expect(r.status === 'created' || r.status === 'exists').toBe(true);
    expect(fake.byName(`${HASH}.pdf`)).toHaveLength(1);
  });
});
