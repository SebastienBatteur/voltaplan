# ADR-0001 — Moteur réglementaire versionné par partie d'installation

Date : 2026-11-24 · Statut : accepté

## Contexte

Le projet ne connaissait que `rgieVersion: 'new' | 'old'` et `installationKind: 'new' | 'existing'`, appliqués à
toute l'installation. Une installation belge réelle mêle souvent plusieurs générations (tableau ancien,
circuits ajoutés), et le RGIE a connu plusieurs textes (avant 1981, AR de 1981, Livre 1 en 2020, modifié en 2023).

## Décision

- Chaque référentiel (`RulePack`) déclare des **éditions datées** (`editions`) et un **catalogue** (`rules`) de
  métadonnées par règle : nature, gravité, statut pour l'existant, source, date de vérification, `needsReview`.
- Les règles produisent des **constats bruts** ; `classify()` (src/rules/context.ts) leur donne un statut,
  un caractère bloquant et une sévérité selon le **contexte de la partie** (édition, neuve / existante).
- Le contexte se lit de l'élément vers la racine : `oldPart`, `installedOn`, `installationKind` de la partie,
  puis la date du projet, puis l'ancien `rgieVersion` (compatibilité : aucun fichier existant à migrer).
- Un référentiel inconnu ne retombe plus sur la Belgique : `R-RULESET-UNKNOWN`, bloquant, aucune règle appliquée.

## Conséquences

- Ajouter une édition = ajouter une entrée datée ; ajouter un pays = un nouveau `RulePack`.
- Les références d'articles restent vides tant qu'elles ne sont pas vérifiées (pas d'invention).
- `severity` reste disponible pour l'interface et les référentiels tiers qui ne fournissent pas de statut.
