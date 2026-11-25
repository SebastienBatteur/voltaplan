/**
 * Au doigt, un appui long sur un élément qui a une infobulle (`title`) montre son explication, sans déclencher
 * l'action au relâchement ; un appui bref agit normalement ; rien à la souris.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HELP_PRESS_MS, TouchHelp } from '../src/ui/TouchHelp';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null;
  vi.useRealTimers();
});

function pointer(type: string, target: Element, pointerType: string) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, { pointerType, clientX: 10, clientY: 10 });
  act(() => {
    target.dispatchEvent(e);
  });
}

function mount(onClick: () => void) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root!.render(
      <>
        <button title="Copie lisible par Trikker" onClick={onClick}>
          Exporter
        </button>
        <TouchHelp />
      </>,
    ),
  );
  return host.querySelector('button')!;
}

describe('explication au doigt (appui long)', () => {
  it('appui long : bulle avec l’explication, et le relâchement ne déclenche pas l’action', () => {
    const onClick = vi.fn();
    const b = mount(onClick);
    pointer('pointerdown', b, 'touch');
    act(() => vi.advanceTimersByTime(HELP_PRESS_MS + 50));
    expect(document.querySelector('[role="tooltip"]')?.textContent).toBe('Copie lisible par Trikker');
    pointer('pointerup', b, 'touch');
    act(() => b.click());
    expect(onClick).not.toHaveBeenCalled();
  });

  it('appui bref : l’action se fait, pas de bulle', () => {
    const onClick = vi.fn();
    const b = mount(onClick);
    pointer('pointerdown', b, 'touch');
    act(() => vi.advanceTimersByTime(100));
    pointer('pointerup', b, 'touch');
    act(() => b.click());
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('souris : rien (l’infobulle du navigateur suffit)', () => {
    const b = mount(() => undefined);
    pointer('pointerdown', b, 'mouse');
    act(() => vi.advanceTimersByTime(HELP_PRESS_MS + 50));
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });
});
