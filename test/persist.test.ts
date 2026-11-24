/**
 * Protection des données du navigateur (src/io/persist.ts) avec navigator.storage simulé.
 */
import { formatBytes, isPersisted, needsInstallAdvice, persistIfDataStored, requestPersistence, storageInfo } from '../src/io/persist';

const original = Object.getOwnPropertyDescriptor(navigator, 'storage');

function mockStorage(s: unknown) {
  Object.defineProperty(navigator, 'storage', { value: s, configurable: true });
}

function manager(opts: { persisted?: boolean; grant?: boolean; estimate?: StorageEstimate | Error } = {}) {
  let persisted = opts.persisted ?? false;
  return {
    persisted: vi.fn(async () => persisted),
    persist: vi.fn(async () => {
      if (opts.grant) persisted = true;
      return !!opts.grant;
    }),
    estimate: vi.fn(async () => {
      if (opts.estimate instanceof Error) throw opts.estimate;
      return opts.estimate ?? { usage: 1500000, quota: 2e9 };
    }),
  };
}

describe('protection des données du navigateur', () => {
  beforeEach(() => localStorage.clear());
  afterAll(() => {
    if (original) Object.defineProperty(navigator, 'storage', original);
    else delete (navigator as { storage?: unknown }).storage;
  });

  it('API absente : rien, sans erreur', async () => {
    mockStorage(undefined);
    expect(await isPersisted()).toBeNull();
    expect(await requestPersistence()).toBeNull();
    expect(await storageInfo()).toEqual({ persisted: null, usage: null, quota: null });
    expect(await persistIfDataStored(async () => true)).toBeNull();
  });

  it('demande automatique : une seule fois ; bouton : à chaque fois', async () => {
    const m = manager();
    mockStorage(m);
    expect(await requestPersistence()).toBe(false);
    expect(await requestPersistence()).toBe(false);
    expect(m.persist).toHaveBeenCalledTimes(1);
    expect(await requestPersistence(true)).toBe(false);
    expect(m.persist).toHaveBeenCalledTimes(2);
  });

  it('déjà persistant : pas de nouvelle demande', async () => {
    const m = manager({ persisted: true });
    mockStorage(m);
    expect(await requestPersistence()).toBe(true);
    expect(m.persist).not.toHaveBeenCalled();
  });

  it('accordé', async () => {
    const m = manager({ grant: true });
    mockStorage(m);
    expect(await requestPersistence()).toBe(true);
    expect(await isPersisted()).toBe(true);
  });

  it('erreurs du navigateur : jamais d’exception', async () => {
    mockStorage({
      persisted: async () => Promise.reject(new Error('x')),
      persist: async () => Promise.reject(new Error('x')),
      estimate: async () => Promise.reject(new Error('x')),
    });
    expect(await requestPersistence(true)).toBe(false);
    expect(await storageInfo()).toEqual({ persisted: null, usage: null, quota: null });
  });

  it('espace utilisé et protection', async () => {
    mockStorage(manager({ estimate: { usage: 1500000, quota: 2e9 } }));
    expect(await storageInfo()).toEqual({ persisted: false, usage: 1500000, quota: 2e9 });
  });

  it('au démarrage : demande seulement s’il y a des données gardées', async () => {
    const m = manager();
    mockStorage(m);
    expect(await persistIfDataStored(async () => false)).toBe(false);
    expect(m.persist).not.toHaveBeenCalled();
    expect(await persistIfDataStored(async () => true)).toBe(false);
    expect(m.persist).toHaveBeenCalledTimes(1);
    expect(await persistIfDataStored(async () => Promise.reject(new Error('idb')))).toBeNull();
  });

  it('conseil d’installation : Safari et iPhone/iPad non installés seulement', () => {
    const nav = (userAgent: string, maxTouchPoints = 0, standalone?: boolean) => ({ userAgent, maxTouchPoints, standalone });
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const macSafari = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
    const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
    const firefox = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0';
    expect(needsInstallAdvice(nav(iphone), false)).toBe(true);
    expect(needsInstallAdvice(nav(iphone, 5, true))).toBe(false);
    expect(needsInstallAdvice(nav(macSafari), false)).toBe(true);
    expect(needsInstallAdvice(nav(macSafari, 5), false)).toBe(true); // iPad en mode bureau
    expect(needsInstallAdvice(nav(chrome), false)).toBe(false);
    expect(needsInstallAdvice(nav(firefox), false)).toBe(false);
  });

  it('tailles lisibles', () => {
    expect(formatBytes(1500000, 'en')).toBe('1.5 MB');
    expect(formatBytes(2e9, 'en')).toBe('2 GB');
    expect(formatBytes(500, 'en')).toBe('500 byte');
  });
});
