# ADR-0009 — Source de vérité réglementaire commune (registre des exigences)

Date : 2026-11-27 · Statut : **proposé** (à valider par le porteur du projet avant toute refactorisation) · Complète
ADR-0007

## Contexte

L'audit et le contre-audit de 2026 (`docs/audit/APPRENDRE-RGIE-AUDIT-2026.md`, `CONTRE-AUDIT-RGIE-2026.md`) ont montré
que la connaissance réglementaire de Voltaplan est dispersée entre le moteur (`src/rules/be/rgie.ts`, `catalog.ts`),
le modèle (`src/model/schema.ts`), les traductions, les 54 articles de la rubrique « Apprendre », le lexique et le
simulateur des exercices. Conséquences constatées :

- une même valeur en plusieurs exemplaires divergents (tableau section / calibre : moteur ≠ articles ≠ schéma) ;
- des anomalies du moteur que les articles ne pouvaient pas révéler, et inversement ;
- aucun statut de validation humaine, aucune trace « exigence → règles → tests → articles » ;
- un changement de version du RGIE (version 07 d'application au 01/11/2026) impossible à évaluer d'un coup.

Analyse détaillée des options : `docs/architecture/source-verite-reglementaire.md`.

## Options étudiées

A. Statu quo avec tests de cohérence ; B. registre de données (JSON / YAML) validé par un schéma et consommé par le
moteur, le générateur des articles, le lexique et les exercices ; C. même registre en TypeScript ; D. base externe.

## Décision proposée

**Option B**, par étapes, dans le dépôt (pas de serveur ni de dépendance nouvelle : `zod` est déjà utilisé) :

1. `regulations/be/` : une fiche par exigence (identifiant stable, juridiction, version du RGIE, référence exacte et
   page, citation courte, entrée en vigueur, champ d'application, conditions et exceptions, dispositions transitoires,
   valeurs et unités, sources complémentaires, criticité, statut de validation humaine, règles, tests, articles,
   lexique, exercices).
2. Le moteur lit ses valeurs dans le registre ; `catalog.ts` référence les identifiants d'exigence.
3. `plan.json → rgieRefs` et la matrice de traçabilité sont générés depuis le registre.
4. Le générateur des articles insère valeurs et références à partir d'une balise ; migration progressive.
5. La CI vérifie la cohérence (voir la proposition, section 5) ; les statuts « à trancher » ne produisent jamais de
   constat bloquant.

## Conséquences

- Positives : une seule valeur par exigence ; impact d'un changement réglementaire visible ; statut de validation
  explicite ; dossier de validation externe directement relié aux fiches.
- Négatives : migration à planifier ; les tableaux de valeurs des articles deviennent générés ; discipline de
  rédaction (citer l'exigence plutôt que recopier la valeur).
- En attendant : `test/regulatory-consistency.test.ts` compare déjà le moteur aux articles pour le tableau 4.11, le
  seuil de 2 600 W et la limite de 100 Ω, vérifie les références du catalogue et repère les règles sans test.

## Non-objectifs

Cette décision ne rend pas Voltaplan conforme ni certifié : la validation humaine des exigences reste nécessaire
(`docs/audit/VALIDATION-EXTERNE-RGIE.md`).
