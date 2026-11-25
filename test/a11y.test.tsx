/**
 * Accessibilité au clavier (audit visuel du 2026-11-25) : fenêtres (focus entrant, Tab gardé, Échap, retour du
 * focus), arborescence (motif ARIA « tree »), menus (flèches), onglets de vue.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useModalDialog } from '../src/ui/a11y';
import { TreePanel } from '../src/ui/TreePanel';
import { FileMenu } from '../src/ui/FileMenu';
import { ViewTabs } from '../src/ui/ViewTabs';
import { useStore } from '../src/store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom n'implémente pas scrollIntoView (l'arborescence ramène la ligne sélectionnée dans le champ)
Element.prototype.scrollIntoView ??= () => undefined;

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null;
  document.body.innerHTML = '';
});
function mount(el: JSX.Element) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(el));
  return host;
}
function key(target: Element, k: string, opts: KeyboardEventInit = {}) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts }));
  });
}
const tick = () => act(() => new Promise((r) => setTimeout(r, 30)));

function Dialog({ onClose }: { onClose: () => void }) {
  const ref = useModalDialog(onClose);
  return (
    <div role="dialog" aria-modal="true" ref={ref} className="modal">
      <button>premier</button>
      <input aria-label="champ" />
      <button>dernier</button>
    </div>
  );
}

describe('fenêtres', () => {
  function Host({ open, onClose }: { open: boolean; onClose: () => void }) {
    return (
      <>
        <button id="opener">ouvrir</button>
        {open && <Dialog onClose={onClose} />}
      </>
    );
  }

  it('focus dans la fenêtre à l’ouverture, Échap ferme, focus rendu à l’ouvreur', () => {
    const onClose = vi.fn();
    const h = mount(<Host open={false} onClose={onClose} />);
    const opener = h.querySelector<HTMLButtonElement>('#opener')!;
    opener.focus();
    act(() => root!.render(<Host open onClose={onClose} />));
    const dlg = h.querySelector('[role="dialog"]')!;
    expect(dlg.contains(document.activeElement)).toBe(true);
    key(document.activeElement!, 'Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => root!.render(<Host open={false} onClose={onClose} />));
    expect(document.activeElement).toBe(opener);
  });

  it('Tab et Maj+Tab restent dans la fenêtre', () => {
    const h = mount(<Dialog onClose={() => undefined} />);
    const [first, , last] = [...h.querySelectorAll<HTMLElement>('button, input')];
    last.focus();
    key(last, 'Tab');
    expect(document.activeElement).toBe(first);
    key(first, 'Tab', { shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('Échap déjà traité (liste déroulante, menu) : la fenêtre reste ouverte', () => {
    const onClose = vi.fn();
    const h = mount(<Dialog onClose={onClose} />);
    const input = h.querySelector('input')!;
    input.addEventListener('keydown', (e) => e.preventDefault());
    key(input, 'Escape');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('arborescence', () => {
  const items = (h: HTMLElement) => [...h.querySelectorAll<HTMLElement>('[role="treeitem"]')];

  it('motif ARIA tree : un seul arrêt de tabulation, niveaux, état déplié', () => {
    act(() => useStore.getState().select(null));
    const h = mount(<TreePanel />);
    expect(h.querySelector('[role="tree"]')?.getAttribute('aria-label')).toBeTruthy();
    const rows = items(h);
    expect(rows.length).toBeGreaterThan(2);
    expect(rows.filter((r) => r.tabIndex === 0)).toHaveLength(1);
    expect(rows[0].tabIndex).toBe(0);
    expect(rows[0].getAttribute('aria-level')).toBe('1');
    expect(rows[1].getAttribute('aria-level')).toBe('2');
    expect(rows[0].getAttribute('aria-expanded')).toBe('true');
  });

  it('flèches : parcourir en sélectionnant, gauche replie puis remonte, droite déplie', async () => {
    act(() => useStore.getState().select(null));
    const h = mount(<TreePanel />);
    const rows = items(h);
    rows[0].focus();
    key(rows[0], 'ArrowDown');
    await tick();
    expect(useStore.getState().selectedId).toBe(rows[1].dataset.id);
    expect(document.activeElement?.getAttribute('data-id')).toBe(rows[1].dataset.id);
    // Gauche sur un élément déplié : il se replie
    const second = items(h)[1];
    key(second, 'ArrowLeft');
    expect(items(h)[1].getAttribute('aria-expanded')).toBe('false');
    // Gauche encore : retour au parent
    key(items(h)[1], 'ArrowLeft');
    await tick();
    expect(useStore.getState().selectedId).toBe(rows[0].dataset.id);
    // Droite sur le parent déplié : premier enfant ; droite sur l'enfant replié : il se déplie
    key(items(h)[0], 'ArrowRight');
    await tick();
    key(items(h)[1], 'ArrowRight');
    expect(items(h)[1].getAttribute('aria-expanded')).toBe('true');
    // Fin et Début
    key(items(h)[1], 'End');
    await tick();
    expect(useStore.getState().selectedId).toBe(items(h).at(-1)!.dataset.id);
    key(items(h).at(-1)!, 'Home');
    await tick();
    expect(useStore.getState().selectedId).toBe(items(h)[0].dataset.id);
  });

  it('« + » ouvre le menu d’ajout au clavier ; Échap le ferme et rend le focus à la ligne', async () => {
    act(() => useStore.getState().select(null));
    const h = mount(<TreePanel />);
    const board = items(h).at(-1)!; // tableau principal
    board.focus();
    key(board, '+');
    await tick();
    const menu = document.querySelector('[role="menu"]')!;
    expect(menu).toBeTruthy();
    const entries = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    expect(document.activeElement).toBe(entries[0]);
    key(entries[0], 'ArrowDown');
    expect(document.activeElement).toBe(entries[1]);
    key(entries[1], 'ArrowUp');
    key(entries[0], 'ArrowUp');
    expect(document.activeElement).toBe(entries.at(-1));
    key(document.activeElement!, 'Escape');
    await tick();
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement?.getAttribute('data-id')).toBe(board.dataset.id);
  });
});

describe('menu Fichier et onglets de vue', () => {
  it('menu Fichier : focus sur la première entrée, flèches, Échap rend le focus au bouton', () => {
    const run = vi.fn();
    const h = mount(
      <FileMenu
        actions={[
          { label: 'Nouveau', run },
          { label: 'Ouvrir…', run, separatorBefore: true },
        ]}
      />,
    );
    const button = h.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;
    button.focus();
    act(() => button.click());
    const entries = [...h.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    expect(document.activeElement).toBe(entries[0]);
    key(entries[0], 'ArrowDown');
    expect(document.activeElement).toBe(entries[1]);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(h.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('onglets de vue : navigation nommée, vue active signalée', () => {
    act(() => useStore.getState().setView('plan'));
    const h = mount(<ViewTabs errors={0} warnings={0} />);
    expect(h.querySelector('nav')?.getAttribute('aria-label')).toBeTruthy();
    const current = [...h.querySelectorAll('button')].filter((b) => b.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toBe(useStore.getState().t('view.plan'));
  });
});
