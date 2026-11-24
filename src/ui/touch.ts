import { useEffect, useState } from 'react';

/** Écran tactile comme pointeur principal (téléphone, tablette) : pas de clic droit, cibles au doigt. */
export const COARSE_QUERY = '(pointer: coarse)';

export function isCoarsePointer(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(COARSE_QUERY).matches;
}

/** Vrai sur un écran tactile ; suit les changements (tablette avec clavier et souris branchés, émulation). */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(isCoarsePointer);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(COARSE_QUERY);
    const on = () => setCoarse(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return coarse;
}
