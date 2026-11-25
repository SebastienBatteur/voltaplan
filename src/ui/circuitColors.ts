/**
 * Couleur par circuit (plan et unifilaire) : chaque circuit reçoit une couleur, reprise par tous ses éléments
 * (canalisations, prises, points lumineux, interrupteurs…), pour voir d'un coup d'œil ce qui dépend de quoi.
 * Option d'affichage seulement (retenue sur l'appareil) : l'impression reste en noir, conforme au dossier.
 */
import { useSyncExternalStore } from 'react';
import { STORAGE_PREFIX } from '../brand';
import { isCircuit } from '../model/tree';
import type { ElNode } from '../model/types';

/**
 * Teintes bien distinctes, lisibles sur fond clair comme sombre. Sans bleu (sélection), orange (chaîne de
 * l'élément sélectionné) ni rouge (non-conformité), pour ne jamais être confondues avec ces repères.
 */
export const CIRCUIT_PALETTE = ['#2f9e44', '#ae3ec9', '#0c8599', '#d6336c', '#66a80f', '#7048e8', '#1098ad', '#a61e4d', '#5c940d', '#9c36b5', '#087f5b', '#c2255c'];

export interface CircuitColor {
  /** Protection qui ouvre le circuit. */
  circuitId: string;
  color: string;
}

/** Couleur de chaque élément d'un circuit (le circuit lui-même compris), dans l'ordre du schéma. */
export function circuitColorMap(roots: ElNode[]): Map<string, CircuitColor> {
  const map = new Map<string, CircuitColor>();
  let i = 0;
  const visit = (n: ElNode, current: CircuitColor | null) => {
    let here = current;
    if (n.kind === 'board') here = null; // sous-tableau : ses circuits ont leurs propres couleurs
    if (isCircuit(n)) here = { circuitId: n.id, color: CIRCUIT_PALETTE[i++ % CIRCUIT_PALETTE.length] };
    if (here) map.set(n.id, here);
    for (const c of n.children) visit(c, here);
  };
  for (const r of roots) visit(r, null);
  return map;
}

/** Circuits colorés, dans l'ordre, pour la légende. */
export function circuitLegend(roots: ElNode[], map = circuitColorMap(roots)): { id: string; color: string }[] {
  const seen = new Map<string, string>();
  for (const v of map.values()) if (!seen.has(v.circuitId)) seen.set(v.circuitId, v.color);
  return [...seen].map(([id, color]) => ({ id, color }));
}

// --- Option affichée ou non (retenue sur l'appareil) ---
const KEY = STORAGE_PREFIX + 'circuitColors';
const listeners = new Set<() => void>();
let on = (() => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();

export function setCircuitColors(v: boolean) {
  on = v;
  try {
    localStorage.setItem(KEY, v ? '1' : '0');
  } catch {
    /* stockage indisponible */
  }
  listeners.forEach((l) => l());
}

export function useCircuitColorsOn(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => on,
  );
}
