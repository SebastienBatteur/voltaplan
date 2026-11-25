import { describe, expect, it } from 'vitest';
import { sameDriveContent } from '../src/io/drive';
import { createDriveProjectFolder, DriveFolderBackend } from '../src/io/driveFolder';
import { ConflictError } from '../src/io/conflict';
import { FakeDrive } from './cloudFakes';

// Constaté sur un vrai compte (2026-11-24) : la réponse de création donne version 1, une relecture une minute plus tard
// version 2, avec la même révision de tête. Le comparer en entier provoquait un faux conflit au 2e enregistrement.
describe('Google Drive : même contenu', () => {
  it('version changée, même révision de tête : même contenu (pas de conflit)', () => {
    expect(sameDriveContent('1|0Bx-head', '2|0Bx-head')).toBe(true);
  });
  it('révision de tête différente : modifié ailleurs', () => {
    expect(sameDriveContent('2|0Bx-head', '3|0By-other')).toBe(false);
  });
  it('sans révision mémorisée : comparaison complète, prudente', () => {
    expect(sameDriveContent('2|', '2|')).toBe(true);
    expect(sameDriveContent('2|', '3|')).toBe(false);
    expect(sameDriveContent(undefined, '2|x')).toBe(false);
  });
});

// La correction ne doit masquer AUCUNE vraie modification concurrente : toute écriture de contenu crée une nouvelle
// révision de tête, même avec un contenu identique ou suivie d'un changement de `version` seul.
describe('Google Drive : les vrais conflits restent détectés malgré les changements de version', () => {
  async function setup() {
    const fake = new FakeDrive();
    const f = await createDriveProjectFolder('tok', 'M', undefined, fake.fetch);
    const b = new DriveFolderBackend('tok', f.id, 'M', fake.fetch);
    const v1 = (await b.writeConditional('project.json', '{"a":1}', null)).version!;
    return { fake, b, v1, model: fake.byName('project.json')[0] };
  }
  const uploads = (fake: FakeDrive, from: number) => fake.calls.slice(from).filter((c) => c.url.includes('/upload/')).length;

  it('changement de version seul (traitement interne de Drive) : pas de conflit', async () => {
    const { fake, b, v1, model } = await setup();
    model.version += 5;
    await expect(b.writeConditional('project.json', '{"a":2}', v1)).resolves.toMatchObject({ version: expect.any(String) });
    expect(fake.text(model.id)).toBe('{"a":2}');
  });

  it('autre appareil : nouveau contenu → conflit, rien envoyé, sa version intacte', async () => {
    const { fake, b, v1, model } = await setup();
    fake.addRevision(model, new TextEncoder().encode('{"autre":1}'));
    const n = fake.calls.length;
    await expect(b.writeConditional('project.json', '{"a":2}', v1)).rejects.toBeInstanceOf(ConflictError);
    expect(uploads(fake, n)).toBe(0);
    expect(fake.text(model.id)).toBe('{"autre":1}');
  });

  it('autre appareil : contenu IDENTIQUE réenvoyé → conflit quand même (nouvelle révision, prudence)', async () => {
    const { fake, b, v1, model } = await setup();
    fake.addRevision(model, new TextEncoder().encode('{"a":1}'));
    await expect(b.writeConditional('project.json', '{"a":2}', v1)).rejects.toBeInstanceOf(ConflictError);
  });

  it('autre appareil puis changement de version seul : conflit', async () => {
    const { fake, b, v1, model } = await setup();
    fake.addRevision(model, new TextEncoder().encode('{"autre":1}'));
    model.version += 3;
    await expect(b.writeConditional('project.json', '{"a":2}', v1)).rejects.toBeInstanceOf(ConflictError);
  });

  it('version mémorisée sans révision de tête (ancien format) : conflit, jamais d’écrasement', async () => {
    const { b, model } = await setup();
    await expect(b.writeConditional('project.json', '{"a":2}', String(model.version - 1))).rejects.toBeInstanceOf(ConflictError);
  });

  it('écriture concurrente PENDANT notre envoi : recopiée à part (les deux versions gardées)', async () => {
    const { fake, b, v1, model } = await setup();
    model.version += 2;
    fake.raceAfterUpload = { id: model.id, data: '{"autre":true}' };
    const r = await b.writeConditional('project.json', '{"a":2}', v1);
    expect(r.concurrentCopy).toMatch(/conflit/);
    expect(fake.text(fake.byName(r.concurrentCopy!)[0].id)).toBe('{"autre":true}');
  });
});
