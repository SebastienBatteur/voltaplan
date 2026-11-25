/**
 * Écart S6 de la séance réelle du 2026-11-25 (docs/tests-cloud-reels.md) : sur iPhone, une PREMIÈRE connexion
 * bloquée affichait « session expirée » et renvoyait vers « Enregistrer ». La raison de la connexion à refaire est
 * maintenant transmise : première connexion (`login`) ou session expirée (`expired`).
 */
import { describe, expect, it } from 'vitest';
import { cloudForget, setCloudTokenForTest, withToken } from '../src/io/cloud';
import { AuthError } from '../src/io/conflict';
import { saveAt, type SaveDeps } from '../src/io/saveFlow';
import type { Location } from '../src/io/storage';
import { emptyProject } from '../src/model/tree';
import { errorText } from '../src/ui/errors';
import { fr } from '../src/i18n/fr';

const blocked = async (): Promise<string> => {
  throw new Error('popup'); // fenêtre de connexion bloquée par le navigateur
};
const t = (k: string, p?: Record<string, string | number>) => (fr as Record<string, string>)[k].replace(/\{(\w+)\}/g, (_, x) => String(p?.[x] ?? ''));

describe('S6 : première connexion ou session expirée', () => {
  it('aucune connexion encore ouverte dans l’onglet : raison « login », message sans « session expirée »', async () => {
    cloudForget('dropbox');
    const e = await withToken('dropbox', async () => 'ok', blocked).catch((x) => x);
    expect(e).toBeInstanceOf(AuthError);
    expect((e as AuthError).reason).toBe('login');
    expect(errorText(e, t)).toBe(t('save.needsLogin', { where: 'Dropbox' }));
    expect(errorText(e, t)).not.toMatch(/expir/i);
  });

  it('jeton obtenu puis expiré : raison « expired »', async () => {
    setCloudTokenForTest('onedrive', 'vieux', -1_000); // expiré
    const e = await withToken('onedrive', async () => 'ok', blocked).catch((x) => x);
    expect((e as AuthError).reason).toBe('expired');
    expect(errorText(e, t)).toMatch(/expirée/);
    cloudForget('onedrive');
  });

  it('jeton refusé (401) puis fenêtre bloquée : raison « expired »', async () => {
    setCloudTokenForTest('gdrive', 'revoque');
    const e = await withToken(
      'gdrive',
      async () => {
        throw new AuthError('service');
      },
      blocked,
    ).catch((x) => x);
    expect((e as AuthError).reason).toBe('expired');
    cloudForget('gdrive');
  });

  it('enregistrement : la raison est transmise à l’appelant (message adapté)', async () => {
    const loc: Location = { kind: 'folder', provider: 'dropbox', folder: 'M', modelPath: 'project.json' };
    const deps = {
      folderSave: async () => {
        throw new AuthError('Dropbox', 'login');
      },
      addVersion: async () => undefined,
      setPending: () => undefined,
      clearPending: () => undefined,
      now: () => new Date(),
    } as unknown as SaveDeps;
    const out = await saveAt(loc, emptyProject(), '', deps);
    expect(out).toMatchObject({ status: 'needsAuth', login: true });
  });

  it('textes présents en français, néerlandais et anglais', async () => {
    const { nl } = await import('../src/i18n/nl');
    const { en } = await import('../src/i18n/en');
    for (const d of [fr, nl, en] as Record<string, string>[]) for (const k of ['save.needsLogin', 'cloud.needsLogin', 'open.done']) expect(d[k]).toBeTruthy();
  });
});
