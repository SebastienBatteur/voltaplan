import { maskKey, seal, unseal } from '../src/ai/secureStore';

describe('coffre chiffré de la clé d’IA', () => {
  // Peu d'itérations pour un test rapide ; l'application en utilise 600 000.
  it('chiffre et déchiffre avec la bonne phrase secrète', async () => {
    const s = await seal('sk-ant-api03-secret-1234', 'ma phrase secrète', 1000);
    expect(s.data).not.toContain('secret');
    expect(JSON.stringify(s)).not.toContain('sk-ant');
    expect(await unseal(s, 'ma phrase secrète')).toBe('sk-ant-api03-secret-1234');
  });

  it('refuse une mauvaise phrase secrète', async () => {
    const s = await seal('sk-ant-api03-secret-1234', 'ma phrase secrète', 1000);
    await expect(unseal(s, 'autre phrase')).rejects.toThrow('incorrecte');
  });

  it('deux chiffrements de la même clé sont différents (sel et IV aléatoires)', async () => {
    const a = await seal('cle', 'phrase-secrete', 1000);
    const b = await seal('cle', 'phrase-secrete', 1000);
    expect(a.data).not.toBe(b.data);
  });

  it('exige une phrase secrète d’au moins 8 caractères', async () => {
    await expect(seal('cle', 'court')).rejects.toThrow();
  });

  it('masque la clé à l’affichage', () => {
    expect(maskKey('sk-ant-api03-abcdefgh1234')).toBe('sk-ant-…1234');
  });
});
