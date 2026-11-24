# ADR-0003 — Conserver le modèle arborescent

Date : 2026-11-24 · Statut : accepté

## Contexte

L'audit demande d'évaluer un modèle en graphe pour les installations à sources multiples (photovoltaïque,
batterie, inverseur de source, secours).

## Décision

Le modèle reste un **arbre** (origine → compteur → protections → tableaux → circuits → points), source unique de
vérité pour l'unifilaire, le plan, le tableau, la liste du matériel, les calculs, les exports et le contrôle.

- Le résidentiel belge visé (Trikker, Eendraadschema) est arborescent : les deux formats d'échange le sont aussi.
- Une source de production (onduleur, panneaux, batterie) est une **branche** raccordée sur un circuit dédié ;
  le sens de l'énergie n'est pas modélisé.
- Un graphe compliquerait la numérotation, le dessin automatique et les exports, sans besoin démontré à ce jour.

## Conséquences et limites

- Pas d'inverseur de source ni de bouclage ; une alimentation de secours se dessine comme une branche distincte.
- Si ce besoin apparaît, ajouter des **liens secondaires** (référence d'un nœud vers une seconde source) plutôt
  que remplacer l'arbre.
