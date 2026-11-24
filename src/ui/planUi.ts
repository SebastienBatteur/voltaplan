import { create } from 'zustand';
import type { NodeKind } from '../model/types';
import type { FurnitureKind } from '../plan/furniture';

/** Outils du plan. */
export type PlanTool = 'select' | 'wall' | 'door' | 'window' | 'label' | 'scale' | 'align' | 'rectify' | 'furniture' | 'element';

/**
 * État de l'outil du plan, partagé entre la barre du plan et la palette « Éléments » de la colonne de gauche
 * (pas d'historique : ce n'est pas le projet).
 */
interface PlanUi {
  tool: PlanTool;
  furnKind: FurnitureKind | null;
  /** Élément de l'unifilaire à ajouter au prochain clic sur le plan (outil « element »). */
  elementKind: NodeKind | null;
  setTool: (tool: PlanTool) => void;
  pickFurniture: (k: FurnitureKind) => void;
  pickElement: (k: NodeKind) => void;
}

export const usePlanUi = create<PlanUi>((set) => ({
  tool: 'select',
  furnKind: null,
  elementKind: null,
  setTool: (tool) => set({ tool, ...(tool !== 'furniture' ? { furnKind: null } : {}), ...(tool !== 'element' ? { elementKind: null } : {}) }),
  pickFurniture: (furnKind) => set({ tool: 'furniture', furnKind, elementKind: null }),
  pickElement: (elementKind) => set({ tool: 'element', elementKind, furnKind: null }),
}));
