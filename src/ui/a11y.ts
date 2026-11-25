/**
 * Accessibilité au clavier des fenêtres et des menus (audit visuel du 2026-11-25,
 * docs/audit/ux-audit-visuel-2026-11-25.md) :
 *  - fenêtre (`useModalDialog`) : le focus entre dans la fenêtre à l'ouverture, Tab et Maj+Tab restent dedans,
 *    Échap ferme, le focus revient à l'élément d'origine à la fermeture ;
 *  - menu (`menuKeyDown`, `focusFirstItem`) : flèches haut et bas, Début, Fin.
 */
import { useCallback, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (e) => !(e as HTMLButtonElement).disabled && e.tabIndex >= 0 && !e.closest('[hidden], [inert]'),
  );
}

/** Le focus est « perdu » (page) ou encore dans `el` : on peut le déplacer sans le voler à une autre fenêtre. */
function focusIsFree(el: HTMLElement | null): boolean {
  const a = document.activeElement;
  return !a || a === document.body || (!!el && el.contains(a));
}

/**
 * Référence à poser sur l'élément `role="dialog"` (avec `aria-modal="true"`). Référence de rappel : elle suit
 * l'apparition et la disparition de l'élément, même si le composant l'affiche plus tard.
 */
export function useModalDialog(onClose: () => void): (el: HTMLElement | null) => void {
  const close = useRef(onClose);
  close.current = onClose;
  const cleanup = useRef<(() => void) | null>(null);

  return useCallback((el: HTMLElement | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!el) return;
    const back = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    if (!el.contains(document.activeElement)) {
      if (el.tabIndex < 0) el.tabIndex = -1;
      el.focus({ preventScroll: true });
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (e.defaultPrevented) return;
        e.preventDefault();
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables(el);
      if (!list.length) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const a = document.activeElement;
      if (e.shiftKey && (a === first || a === el)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (a === last || !el.contains(a))) {
        e.preventDefault();
        first.focus();
      }
    };
    el.addEventListener('keydown', onKey);
    cleanup.current = () => {
      el.removeEventListener('keydown', onKey);
      if (back && back.isConnected && focusIsFree(el)) back.focus({ preventScroll: true });
    };
  }, []);
}

function menuItems(menu: HTMLElement): HTMLElement[] {
  return [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')].filter((e) => !(e as HTMLButtonElement).disabled);
}

/** Place le focus sur la première entrée du menu. */
export function focusFirstItem(menu: HTMLElement | null): void {
  if (menu) menuItems(menu)[0]?.focus({ preventScroll: true });
}

/** Flèches haut et bas (en boucle), Début et Fin entre les entrées d'un menu. */
export function menuKeyDown(e: ReactKeyboardEvent<HTMLElement>): void {
  const items = menuItems(e.currentTarget);
  if (!items.length) return;
  const i = items.indexOf(document.activeElement as HTMLElement);
  let next: number | null = null;
  if (e.key === 'ArrowDown') next = (i + 1) % items.length;
  else if (e.key === 'ArrowUp') next = (i - 1 + items.length) % items.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = items.length - 1;
  if (next === null) return;
  e.preventDefault();
  items[next].focus();
}

/** Rend le focus à `target` à la fermeture d'un menu, sauf si une autre fenêtre l'a déjà pris. */
export function restoreFocus(target: HTMLElement | null, menu: HTMLElement | null): void {
  if (target?.isConnected && focusIsFree(menu)) target.focus({ preventScroll: true });
}
