/**
 * Suite de l'audit visuel du 2026-11-25 : avis regroupés dans une bande (O6), fenêtre d'enregistrement qui propose
 * d'abord « Cet appareil », confirmation des exports (O8).
 */
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Notice, NoticeHost } from '../src/ui/Notice';
import { StorageDialog } from '../src/ui/StorageDialog';
import { download } from '../src/io/files';
import { useStore } from '../src/store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null;
  vi.unstubAllGlobals();
});
function mount(el: JSX.Element) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(el));
  return host;
}

describe('bande des avis', () => {
  function App() {
    const [el, setEl] = useState<HTMLElement | null>(null);
    return (
      <NoticeHost.Provider value={el}>
        <main>
          <Notice>premier</Notice>
          <Notice role="alertdialog">conflit</Notice>
        </main>
        <div className="notices" ref={setEl} />
      </NoticeHost.Provider>
    );
  }

  it('tous les avis vont dans la bande, dans l’ordre, hors du dessin', () => {
    const h = mount(<App />);
    const band = h.querySelector('.notices')!;
    const notes = [...band.querySelectorAll('.toast')];
    expect(notes.map((n) => n.textContent)).toEqual(['premier', 'conflit']);
    expect(notes[1].getAttribute('role')).toBe('alertdialog');
    expect(h.querySelector('main .toast')).toBeNull();
  });

  it('sans bande (composant isolé), l’avis s’affiche sur place', () => {
    const h = mount(<Notice>seul</Notice>);
    expect(h.querySelector('.toast')?.textContent).toBe('seul');
  });
});

describe('fenêtre d’enregistrement', () => {
  const noop = () => undefined;
  const open = () =>
    mount(<StorageDialog mode="save" onClose={noop} onDevice={noop} onOpened={noop} onSaved={noop} />);
  const pressed = (h: HTMLElement) =>
    [...h.querySelectorAll<HTMLButtonElement>('.tabs-row button[aria-pressed]')].map((b) => [b.textContent, b.getAttribute('aria-pressed')]);

  it('« Cet appareil » présélectionné ; navigateur et GitHub sous « Autres emplacements »', () => {
    act(() => useStore.getState().setLang('fr'));
    const h = open();
    expect(pressed(h)).toEqual([
      ['Cet appareil', 'true'],
      ['Drive, OneDrive, Dropbox', 'false'],
    ]);
    const more = [...h.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Autres emplacements'))!;
    act(() => more.click());
    expect(pressed(h).map((p) => p[0])).toEqual(['Cet appareil', 'Drive, OneDrive, Dropbox', 'Navigateur', 'GitHub']);
  });
});

describe('exports (O8)', () => {
  it('download rend le nom du fichier créé, pour le confirmer', async () => {
    vi.stubGlobal('URL', Object.assign(Object.create(URL), { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await expect(download(new Blob(['x']), 'projet.trik')).resolves.toBe('projet.trik');
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });
});
