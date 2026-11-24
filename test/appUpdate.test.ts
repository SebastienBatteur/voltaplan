/**
 * Mise à jour annoncée (src/appUpdate.ts) : bandeau quand une nouvelle version attend, brouillon gardé
 * avant de recharger, rechargement seulement quand la nouvelle version a pris la main.
 */
import { _resetUpdateState, applyUpdate, hasWaitingWorker, isReloadingForUpdate, onUpdate, registerServiceWorker } from '../src/appUpdate';

class FakeWorker extends EventTarget {
  state = 'installing';
  postMessage = vi.fn();
  install() {
    this.state = 'installed';
    this.dispatchEvent(new Event('statechange'));
  }
}

class FakeReg extends EventTarget {
  waiting: FakeWorker | null = null;
  installing: FakeWorker | null = null;
  update = vi.fn(async () => undefined);
  newVersion() {
    const w = new FakeWorker();
    this.installing = w;
    this.dispatchEvent(new Event('updatefound'));
    return w;
  }
}

function container(controller: object | null, reg = new FakeReg()) {
  const c = new EventTarget() as EventTarget & { controller: object | null; register: ReturnType<typeof vi.fn> };
  c.controller = controller;
  c.register = vi.fn(async () => reg);
  return { c: c as unknown as ServiceWorkerContainer, reg, raw: c };
}

describe('mise à jour du service worker', () => {
  let reload: ReturnType<typeof vi.fn>;
  let updates: number;
  let off: () => void;
  beforeEach(() => {
    reload = vi.fn();
    _resetUpdateState(reload);
    updates = 0;
    off = onUpdate(() => updates++);
  });
  afterEach(() => off());

  it('première installation : aucun bandeau', async () => {
    const { c, reg } = container(null);
    await registerServiceWorker(c, { reload, checkEveryMs: 0 });
    reg.newVersion().install();
    expect(updates).toBe(0);
    expect(hasWaitingWorker()).toBe(false);
  });

  it('nouvelle version installée pendant que la page est ouverte : bandeau, pas de rechargement', async () => {
    const { c, reg } = container({});
    await registerServiceWorker(c, { reload, checkEveryMs: 0 });
    const w = reg.newVersion();
    expect(updates).toBe(0);
    w.install();
    expect(updates).toBe(1);
    expect(hasWaitingWorker()).toBe(true);
    expect(reload).not.toHaveBeenCalled();
    expect(w.postMessage).not.toHaveBeenCalled();
  });

  it('version déjà en attente au chargement : bandeau', async () => {
    const reg = new FakeReg();
    reg.waiting = new FakeWorker();
    await registerServiceWorker(container({}, reg).c, { reload, checkEveryMs: 0 });
    expect(updates).toBe(1);
  });

  it('Recharger : brouillon gardé, SKIP_WAITING, rechargement à la prise de main (une seule fois)', async () => {
    const { c, reg, raw } = container({});
    await registerServiceWorker(c, { reload, checkEveryMs: 0 });
    const w = reg.newVersion();
    w.install();
    const order: string[] = [];
    const saveDraft = vi.fn(async () => {
      order.push('brouillon');
    });
    w.postMessage.mockImplementation(() => order.push('skip'));
    expect(await applyUpdate(saveDraft, { fallbackMs: 60000 })).toBe(true);
    expect(order).toEqual(['brouillon', 'skip']);
    expect(w.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(isReloadingForUpdate()).toBe(true);
    expect(reload).not.toHaveBeenCalled();
    raw.dispatchEvent(new Event('controllerchange'));
    raw.dispatchEvent(new Event('controllerchange'));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('brouillon impossible à garder : pas de rechargement', async () => {
    const { c, reg, raw } = container({});
    await registerServiceWorker(c, { reload, checkEveryMs: 0 });
    const w = reg.newVersion();
    w.install();
    expect(await applyUpdate(async () => Promise.reject(new Error('quota')))).toBe(false);
    expect(w.postMessage).not.toHaveBeenCalled();
    expect(isReloadingForUpdate()).toBe(false);
    raw.dispatchEvent(new Event('controllerchange'));
    expect(reload).not.toHaveBeenCalled();
  });

  it('nouvelle version activée depuis un autre onglet : bandeau ici aussi', async () => {
    const { c, raw } = container({});
    await registerServiceWorker(c, { reload, checkEveryMs: 0 });
    raw.dispatchEvent(new Event('controllerchange'));
    expect(updates).toBe(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it('fichier d’une ancienne version introuvable (sans service worker en attente) : rechargement direct après le brouillon', async () => {
    const saveDraft = vi.fn(async () => undefined);
    expect(await applyUpdate(saveDraft)).toBe(true);
    expect(saveDraft).toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('secours : rechargement si la nouvelle version ne prend pas la main', async () => {
    vi.useFakeTimers();
    try {
      const { c, reg } = container({});
      await registerServiceWorker(c, { reload, checkEveryMs: 0 });
      reg.newVersion().install();
      await applyUpdate(async () => undefined, { fallbackMs: 1000 });
      expect(reload).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1000);
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('navigateur sans service worker ou inscription refusée : aucune erreur', async () => {
    expect(await registerServiceWorker(undefined)).toBeUndefined();
    const { c, raw } = container(null);
    raw.register.mockRejectedValue(new Error('SecurityError'));
    expect(await registerServiceWorker(c, { reload, checkEveryMs: 0 })).toBeUndefined();
  });
});
