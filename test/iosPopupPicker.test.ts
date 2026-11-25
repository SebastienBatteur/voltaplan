/**
 * Écarts S1 et S2 de la séance réelle du 2026-11-25 (docs/tests-cloud-reels.md), sur iPhone :
 * - S1 : la fenêtre de connexion Dropbox / OneDrive doit s'ouvrir AVANT le calcul PKCE asynchrone (sinon Safari la
 *   bloque) ;
 * - S2 : le sélecteur de fichiers ne doit pas filtrer par une extension inconnue d'iOS (.voltaplan grisé).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cloudConnect, setClientId } from '../src/io/cloud';
import { isAppleMobile, pickerAccept } from '../src/io/files';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

describe('S2 : filtre du sélecteur de fichiers', () => {
  it('reconnaît iPhone et iPad (iPadOS se présente comme un Mac tactile), pas un Mac ni Windows', () => {
    expect(isAppleMobile({ userAgent: IPHONE, maxTouchPoints: 5 })).toBe(true);
    expect(isAppleMobile({ userAgent: IPAD_AS_MAC, maxTouchPoints: 5 })).toBe(true);
    expect(isAppleMobile({ userAgent: IPAD_AS_MAC, maxTouchPoints: 0 })).toBe(false);
    expect(isAppleMobile({ userAgent: WINDOWS, maxTouchPoints: 0 })).toBe(false);
  });

  it('sur iPhone ou iPad, aucun filtre dès qu’une extension est inconnue d’iOS', () => {
    expect(pickerAccept('.voltaplan,.openrgie,.json,.trik', true)).toBe('');
    expect(pickerAccept('.voltaplan,application/vnd.voltaplan+zip', true)).toBe('');
    expect(pickerAccept('.trik', true)).toBe('');
  });

  it('sur iPhone ou iPad, un filtre fait de types connus est gardé (photos, PDF)', () => {
    expect(pickerAccept('image/*', true)).toBe('image/*');
    expect(pickerAccept('image/*,.pdf,application/pdf', true)).toBe('image/*,.pdf,application/pdf');
  });

  it('ailleurs, le filtre est inchangé', () => {
    expect(pickerAccept('.voltaplan,.openrgie,.json,.trik', false)).toBe('.voltaplan,.openrgie,.json,.trik');
  });
});

describe('S1 : fenêtre de connexion ouverte dans le geste', () => {
  beforeEach(() => {
    // Identifiants d'essai (aucun appel réseau : la fenêtre est simulée)
    setClientId('gdrive', 'essai-google');
    setClientId('onedrive', 'essai-onedrive');
    setClientId('dropbox', 'essai-dropbox');
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const fakePopup = () => ({ closed: false, close: vi.fn(), location: { href: '' } });

  it('Dropbox (PKCE) : la fenêtre s’ouvre tout de suite, puis reçoit l’adresse avec le défi PKCE', async () => {
    const popup = fakePopup();
    const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    const p = cloudConnect('dropbox');
    p.catch(() => undefined); // jamais résolue ici : pas de réponse de oauth.html
    // Appel synchrone : aucune attente entre le clic et l'ouverture
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0]).toBe('');
    await vi.waitFor(() => expect(popup.location.href).toContain('code_challenge='));
    const url = new URL(popup.location.href);
    expect(url.origin + url.pathname).toBe('https://www.dropbox.com/oauth2/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('token_access_type')).toBe('online');
    popup.closed = true; // l'utilisateur ferme la fenêtre : la connexion est annulée
    await expect(p).rejects.toThrow('cancelled');
  });

  it('OneDrive (PKCE) : même ordre', async () => {
    const popup = fakePopup();
    const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    const p = cloudConnect('onedrive');
    p.catch(() => undefined);
    expect(open).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(popup.location.href).toContain('code_challenge='));
    popup.closed = true;
    await expect(p).rejects.toThrow('cancelled');
  });

  it('Google (sans PKCE) : adresse de connexion directe, comme avant', async () => {
    const popup = fakePopup();
    const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    const p = cloudConnect('gdrive');
    p.catch(() => undefined);
    expect(open).toHaveBeenCalledTimes(1);
    const url = new URL(open.mock.calls[0][0] as string);
    expect(url.searchParams.get('response_type')).toBe('token');
    popup.closed = true;
    await expect(p).rejects.toThrow('cancelled');
  });

  it('fenêtre bloquée : erreur « popup » (l’enregistrement passe en attente de connexion)', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    await expect(cloudConnect('dropbox')).rejects.toThrow('popup');
  });
});
