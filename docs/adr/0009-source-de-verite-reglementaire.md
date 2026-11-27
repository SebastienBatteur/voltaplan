# ADR-0009 — Source de vérité réglementaire commune (registre des exigences)

Date : 2026-11-27 · Statut : **accepté** (principe validé par le porteur du projet ; mise en œuvre sur la branche
`regulatory-registry`, non fusionnée) · Complète ADR-0007

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

## Mise en œuvre retenue (novembre 2026)

L'option C (registre en TypeScript) a été préférée à l'option B au moment de l'implémentation : mêmes fiches, mais
typées par le compilateur, sans chargeur ni schéma à maintenir, et lisibles sans outil. Ce sont des **données**, pas un
moteur de règles générique.

- `src/regulations/types.ts` : types (nature, validation documentaire, validation humaine, référence, paramètre).
- `src/regulations/be/source.ts` : texte officiel (version 07, lien du SPF Économie) et date de révision.
- `src/regulations/be/values.ts` : chaque valeur réglementaire **une seule fois**, avec unité et source ; le moteur, le
  catalogue, la fiche imprimée, les tests de cohérence et la page publique les lisent là.
- `src/regulations/be/requirements.ts` : 35 fiches pour les 48 règles (généré depuis l'audit des règles, puis tenu à
  la main) ; `derogations.ts` : dérogations de 8.2.1 et 8.2.2 ; `applicability.ts` : applicabilité et données
  nécessaires de chaque fiche.
- `src/regulations/evaluate.ts` : résultat par exigence — satisfaite, non satisfaite, non applicable, données
  insuffisantes, à vérifier, recommandation. L'absence d'information n'est jamais une conformité ; « non applicable »
  n'est jamais compté comme satisfait ; un doute n'est jamais une non-conformité certaine.
- Le catalogue (`src/rules/be/catalog.ts`) ne porte plus de référence ni de date de vérification : c'est le registre.
- CI : `test/regulations.test.ts` (intégrité : nature, source, références avec page et citation pour une exigence du
  RGIE, statuts, applicabilité, tests et articles existants, paramètres issus de values.ts, aucune valeur recopiée dans
  le moteur), `test/rules.cases.test.ts` (cas fonctionnels de chaque règle, types de cas imposés par la fiche),
  `test/regulatory-consistency.test.ts` (registre ↔ articles ↔ lexique ↔ exercices). `npm run test:mutation` :
  mutants ciblés sur les règles de sécurité (lancé à la main).
- Page publique `site/apprendre/regles-rgie.html`, produite depuis le registre.

Rapport complet : `docs/audit/REGISTRE-RGIE-2026.md`.

## Conséquences

- Positives : une seule valeur par exigence ; impact d'un changement réglementaire visible ; statut de validation
  explicite ; dossier de validation externe directement relié aux fiches.
- Négatives : migration à planifier ; les tableaux de valeurs des articles deviennent générés ; discipline de
  rédaction (citer l'exigence plutôt que recopier la valeur).
- Les articles citent encore leurs valeurs en clair : le test de cohérence les compare au registre (insertion
  automatique depuis le registre : étape ultérieure).

## Non-objectifs

Cette décision ne rend pas Voltaplan conforme ni certifié : la validation humaine des exigences reste nécessaire
(`docs/audit/VALIDATION-EXTERNE-RGIE.md`).
