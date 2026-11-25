import { describe, expect, it } from 'vitest';
import { closeWarningArgs } from '../src/io/closeGuard';
import { translate } from '../src/i18n';
import { APP_NAME } from '../src/brand';

// Écart O10 : la page transmet à Rust (src-tauri/src/close_guard.rs) l'état du projet et le texte traduit.
describe('avertissement à la fermeture (bureau)', () => {
  const t = (k: string) => translate('fr', k);

  it('projet modifié : message et boutons traduits', () => {
    const a = closeWarningArgs(true, t);
    expect(a.message).toBe(translate('fr', 'app.closeUnsaved'));
    expect(a.message).toMatch(/Fermer quand même/);
    expect(a).toMatchObject({ title: APP_NAME, close: 'Fermer sans enregistrer', cancel: 'Annuler' });
  });

  it('projet enregistré : pas de message, la fenêtre se ferme sans question', () => {
    expect(closeWarningArgs(false, t).message).toBeNull();
  });

  it('textes présents en français, néerlandais et anglais', () => {
    for (const lang of ['fr', 'nl', 'en'] as const)
      for (const key of ['app.closeUnsaved', 'app.closeAnyway', 'app.closeCancel'])
        expect(translate(lang, key), `${lang} ${key}`).not.toBe(key);
  });
});
