/**
 * Téléphone, colonne masquée : les propriétés de l'élément sélectionné s'affichent sous le dessin (audit visuel du
 * 2026-11-25). Replié par défaut (une ligne), déplié à la demande et retenu ; ✕ désélectionne ; rien sur grand écran.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SidePanels } from '../src/ui/SidePanels';
import { useStore } from '../src/store';
import { STORAGE_PREFIX } from '../src/brand';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

function phone(narrow: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: narrow && q.includes('max-width: 800px'),
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

beforeEach(() => {
  localStorage.setItem(STORAGE_PREFIX + 'sidePanels', JSON.stringify({ hidden: true }));
});
afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null;
  vi.unstubAllGlobals();
  localStorage.clear();
  act(() => useStore.getState().select(null));
});

function mount() {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(<SidePanels tree={<div />} props={<div className="props-test">propriétés</div>} />));
  return host;
}
const firstId = () => useStore.getState().project.roots[0].id;

describe('panneau des propriétés au téléphone', () => {
  it('rien tant qu’aucun élément n’est sélectionné', () => {
    phone(true);
    const h = mount();
    expect(h.querySelector('.props-sheet')).toBeNull();
  });

  it('sélection : une ligne repliée, puis déplié et retenu', () => {
    phone(true);
    const h = mount();
    act(() => useStore.getState().select(firstId()));
    const sheet = h.querySelector('.props-sheet')!;
    expect(sheet).toBeTruthy();
    expect(sheet.querySelector('.props-sheet-name')?.textContent).toBeTruthy();
    expect(h.querySelector('.props-test')).toBeNull();
    const toggle = h.querySelector<HTMLButtonElement>('.props-sheet-toggle')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    act(() => toggle.click());
    expect(h.querySelector('.props-test')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'sidePanels')!).sheetOpen).toBe(true);
  });

  it('✕ désélectionne et ferme le panneau', () => {
    phone(true);
    const h = mount();
    act(() => useStore.getState().select(firstId()));
    act(() => h.querySelector<HTMLButtonElement>('.props-sheet-close')!.click());
    expect(useStore.getState().selectedId).toBeNull();
    expect(h.querySelector('.props-sheet')).toBeNull();
  });

  it('téléphone à l’horizontale (peu de hauteur) : panneau aussi, la colonne est masquée par défaut', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('max-height: 500px'),
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    localStorage.removeItem(STORAGE_PREFIX + 'sidePanels');
    const h = mount();
    expect(h.querySelector('.side-show')).toBeTruthy();
    act(() => useStore.getState().select(firstId()));
    expect(h.querySelector('.props-sheet')).toBeTruthy();
    expect(h.querySelector('.props-sheet-hint')?.textContent).toContain('◂');
  });

  it('grand écran, colonne masquée : pas de panneau', () => {
    phone(false);
    const h = mount();
    act(() => useStore.getState().select(firstId()));
    expect(h.querySelector('.props-sheet')).toBeNull();
  });
});
