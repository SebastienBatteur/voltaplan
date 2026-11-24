import type { KeyboardEvent, RefObject } from 'react';

/**
 * Entrée dans un champ (phrase secrète, clé, jeton) : même effet qu'un clic sur le bouton qui le valide.
 * Rien ne se passe si le bouton est désactivé (champ incomplet).
 */
export const enterClicks =
  (button: RefObject<HTMLButtonElement | null>) =>
  (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    const b = button.current;
    if (b && !b.disabled) b.click();
  };
