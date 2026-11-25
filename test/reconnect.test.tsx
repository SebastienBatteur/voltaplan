/**
 * R2 (docs/oauth-jetons.md) : repère discret de reconnexion avant l'expiration de la session du service cloud du
 * projet courant. Règles (src/io/reconnect.ts) et composant (src/ui/ReconnectBadge.tsx).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cloudExpire, cloudForget, cloudTokenExpiry, setClientId, setCloudTokenForTest, withToken } from '../src/io/cloud';
import { AuthError } from '../src/io/conflict';
import { RECONNECT_WARN_MS, reconnectState } from '../src/io/reconnect';
import { ReconnectBadge } from '../src/ui/ReconnectBadge';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('R2 : quand afficher le repère', () => {
  const NOW = 1_000_000_000;
  const base = { provider: 'gdrive' as const, dismissedFor: null, now: NOW };

  it('exigence 2 : seulement pour un projet sur un service cloud, connecté dans cet onglet', () => {
    expect(reconnectState({ ...base, provider: null, expires: NOW + 60_000 })).toEqual({ kind: 'hidden' });
    expect(reconnectState({ ...base, expires: null })).toEqual({ kind: 'hidden' });
  });

  it('caché tant qu’il reste plus de 5 minutes ; « fin dans N min » ensuite ; « expirée » à l’échéance', () => {
    expect(reconnectState({ ...base, expires: NOW + RECONNECT_WARN_MS + 1 })).toEqual({ kind: 'hidden' });
    expect(reconnectState({ ...base, expires: NOW + RECONNECT_WARN_MS })).toEqual({ kind: 'soon', minutes: 5 });
    expect(reconnectState({ ...base, expires: NOW + 61_000 })).toEqual({ kind: 'soon', minutes: 2 });
    expect(reconnectState({ ...base, expires: NOW + 1 })).toEqual({ kind: 'soon', minutes: 1 });
    expect(reconnectState({ ...base, expires: NOW })).toEqual({ kind: 'expired' });
    expect(reconnectState({ ...base, expires: NOW - 3_600_000 })).toEqual({ kind: 'expired' });
  });

  it('exigence 6 : fermé pour une échéance, il ne revient qu’avec une nouvelle échéance (nouveau jeton)', () => {
    const expires = NOW + 60_000;
    expect(reconnectState({ ...base, expires, dismissedFor: expires })).toEqual({ kind: 'hidden' });
    expect(reconnectState({ ...base, expires, dismissedFor: expires, now: expires + 1 })).toEqual({ kind: 'hidden' }); // même échéance, même passée
    const next = NOW + 3_600_000;
    expect(reconnectState({ ...base, expires: next, dismissedFor: expires, now: next - 60_000 })).toEqual({ kind: 'soon', minutes: 1 });
  });
});

describe('échéance du jeton (cloud.ts)', () => {
  it('connue même passée ; « Se déconnecter » l’efface ; un 401 la rend passée sans oublier la connexion', async () => {
    cloudForget('dropbox');
    expect(cloudTokenExpiry('dropbox')).toBeNull();
    setCloudTokenForTest('dropbox', 'tok', 120_000);
    expect(cloudTokenExpiry('dropbox')).toBeGreaterThan(Date.now());
    cloudExpire('dropbox');
    expect(cloudTokenExpiry('dropbox')!).toBeLessThan(Date.now());
    cloudForget('dropbox');
    expect(cloudTokenExpiry('dropbox')).toBeNull();

    // 401 puis fenêtre bloquée : la connexion reste « expirée » (repère affiché), pas « jamais ouverte »
    setCloudTokenForTest('dropbox', 'revoque');
    await withToken(
      'dropbox',
      async () => {
        throw new AuthError('service');
      },
      async () => {
        throw new Error('popup');
      },
    ).catch(() => undefined);
    expect(cloudTokenExpiry('dropbox')!).toBeLessThan(Date.now());
    cloudForget('dropbox');
  });
});

describe('R2 : le repère dans la page', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
    cloudForget('gdrive');
    cloudForget('dropbox');
  });

  const render = (provider: 'gdrive' | 'dropbox' | null, onReconnected = () => undefined) =>
    act(() => root.render(<ReconnectBadge getProvider={() => provider} onReconnected={onReconnected} />));

  it('rien quand la session a plus de 5 minutes, ou quand le projet n’est pas sur ce service', () => {
    setCloudTokenForTest('gdrive', 'tok', 3_600_000);
    render('gdrive');
    expect(host.textContent).toBe('');
    setCloudTokenForTest('dropbox', 'tok', 60_000); // Dropbox expire bientôt, mais le projet est sur Drive
    render('gdrive');
    expect(host.textContent).toBe('');
    render(null);
    expect(host.textContent).toBe('');
  });

  it('exigences 1 et 4 : repère discret, sans prendre le focus ni ouvrir de boîte de dialogue', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    setCloudTokenForTest('gdrive', 'tok', 3 * 60_000);
    render('gdrive');
    expect(host.textContent).toMatch(/Google Drive/);
    expect(host.querySelector('[role="status"]')).not.toBeNull();
    expect(host.querySelector('dialog, [role="dialog"], [role="alertdialog"]')).toBeNull();
    expect(document.activeElement).toBe(input); // le travail en cours garde le focus
    input.remove();
  });

  it('exigence 6 : ✕ le masque jusqu’à l’échéance suivante', () => {
    setCloudTokenForTest('gdrive', 'tok', 3 * 60_000);
    render('gdrive');
    const close = [...host.querySelectorAll('button')].find((b) => b.textContent === '✕')!;
    act(() => close.click());
    expect(host.textContent).toBe('');
    // Nouveau jeton puis, plus tard, nouvelle échéance proche : le repère peut revenir
    setCloudTokenForTest('gdrive', 'neuf', 2 * 60_000);
    render('gdrive');
    expect(host.textContent).toMatch(/Google Drive/);
  });

  it('exigences 3 et 5 : un clic ouvre la fenêtre de connexion, sans recharger la page', async () => {
    setClientId('dropbox', 'essai-dropbox');
    setCloudTokenForTest('dropbox', 'tok', -1_000); // expirée
    const popup = { closed: false, close: vi.fn(), location: { href: '' } };
    const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    render('dropbox');
    expect(host.textContent).toMatch(/Dropbox/);
    const btn = [...host.querySelectorAll('button')].find((b) => b.textContent !== '✕')!;
    act(() => btn.click());
    expect(open).toHaveBeenCalledTimes(1); // ouverte dans le clic (Safari)
    popup.closed = true; // l'utilisateur ferme la fenêtre : rien d'autre ne se passe
    await act(async () => {
      await new Promise((r) => setTimeout(r, 700));
    });
    expect(host.textContent).toMatch(/Dropbox/); // repère toujours là, aucune erreur affichée
    expect(host.querySelector('.error-text')).toBeNull();
  });
});
