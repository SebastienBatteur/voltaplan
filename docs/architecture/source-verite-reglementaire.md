# Proposition : une source de vérité réglementaire commune

Statut : **proposition, à valider par le porteur du projet** (voir ADR-0009). Aucune refactorisation majeure n'a été
faite ; seule une première vérification de cohérence a été ajoutée en CI (`test/regulatory-consistency.test.ts`).

## 1. Situation actuelle

La connaissance réglementaire est répartie en cinq endroits qui ne se connaissent pas :

| Où | Ce qu'il contient | Lien avec le RGIE |
|---|---|---|
| `src/rules/be/rgie.ts` | logique des règles, constantes (`TABLE_4_11`, `DEDICATED_POWER_W`, 30 / 100 Ω, 8 points, dates 2023 / 2025) | commentaires ; depuis 2026 : `article` et `verifiedOn` dans le catalogue pour 6 règles |
| `src/rules/be/catalog.ts` | fiche de chaque règle : nature, gravité, régime de l'existant, `needsReview`, fichier de test | champ `article` facultatif ; une source unique (« AR du 8 septembre 2019 ») |
| `src/model/schema.ts` | listes d'appareils (circuits dédiés, 30 mA) | aucune |
| `src/i18n/*.ts` | messages et conseils des règles, en 4 langues, avec des valeurs écrites en dur | références dans le texte |
| `learn/fr/*.html`, `lexique.json`, `plan.json` | 54 articles, 152 définitions ; `rgieRefs` (86 références vérifiées) | références citées en clair, contrôlées par `npm run learn:check` |
| `site/apprendre/cablage-sim.js` | règles des exercices (bleu, vert-jaune, interrupteur sur le neutre) | références dans les messages |

Conséquences observées pendant l'audit de 2026 : la même valeur existait en plusieurs exemplaires divergents (tableau
section / calibre : un dans le moteur, un autre dans trois articles, un troisième dans un schéma SVG) ; des
références « vérifiées » ne portaient que sur l'existence du numéro, pas sur le contenu ; aucune trace ne reliait une
exigence à ses articles pédagogiques et à ses tests.

## 2. Ce qu'une « exigence » devrait porter

Une fiche par exigence (et non par règle du moteur : une règle peut vérifier plusieurs exigences, et beaucoup
d'exigences ne sont qu'enseignées) :

| Champ | Exemple |
|---|---|
| `id` stable | `BE-RGIE-4.4.1.4-T4.11` |
| juridiction | `BE` |
| texte et version | RGIE Livre 1, version 07 (15/09/2026) |
| référence exacte | 4.4.1.4, tableau 4.11, p. 116-117 |
| citation courte | « Pour les installations domestiques, l'intensité nominale maximale … est donnée au tableau 4.11 » |
| entrée en vigueur | 01/11/2026 (version) ; date propre de l'exigence si différente (ex. 01/06/2023) |
| champ d'application | domestique ; neuf et existant ; schémas TT / TN / IT ; types de circuits |
| conditions et exceptions | « le courant admissible IZ peut imposer moins » ; « au-delà de 35 mm² : non couvert » |
| dispositions transitoires | ex. 6.5.8.1, 8.2.1 |
| valeurs et unités | `{ "1.5": { "fuse": 10, "mcb": 16 }, … }` (A, mm²) |
| sources complémentaires | normes citées par le RGIE, documentation fabricant (avec « non consultée » si c'est le cas) |
| criticité | P0 à P3 / gravité pour les personnes |
| statut de validation humaine | `non vérifiée` / `vérifiée sur le texte (date, par qui)` / `validée par un spécialiste (date, qui)` / `à trancher` |
| règles du moteur | `R-CABLE-PROT` |
| tests | `test/rules.rgie2026.test.ts > M1-M2` |
| articles pédagogiques | `section-des-cables`, `courant`, `disjoncteur`, `disjoncteur-qui-saute`, `contacteur-jour-nuit` |
| termes du lexique | `calibre`, `section` |
| exercices | — |

## 3. Architectures possibles

### A. Statu quo outillé

Garder les cinq emplacements ; ajouter seulement des tests de cohérence qui comparent les valeurs (déjà commencé pour
le tableau 4.11, 2 600 W et 100 Ω).

- Avantages : aucun changement de code ; immédiat ; ne casse rien.
- Inconvénients : chaque nouvelle valeur demande un test sur mesure ; les tests reposent sur l'analyse du texte HTML,
  fragile ; la traçabilité reste reconstruite après coup ; le statut de validation n'existe nulle part.
- Maintenance : faible au début, croissante avec le nombre d'exigences.

### B. Registre de données (JSON ou YAML) consommé partout

Un dossier `regulations/be/` avec une fiche par exigence (format ci-dessus), validée par un schéma (zod, déjà une
dépendance). Le moteur importe les valeurs (`registry['BE-RGIE-4.4.1.4-T4.11'].values`) au lieu de constantes ; les
articles citent l'exigence par identifiant (`<span data-req="BE-RGIE-4.4.1.4-T4.11">`) et le générateur insère la
valeur et la référence ; le lexique et les exercices pointent vers les mêmes identifiants ; un script produit la
matrice de traçabilité.

- Avantages : une seule valeur ; traçabilité et statut de validation natifs ; un changement de version du RGIE se voit
  dans un seul dossier, avec la liste des articles, règles et tests touchés ; relisible par un non-développeur.
- Inconvénients : migration progressive des articles (balises) et du moteur ; les tableaux HTML des articles doivent
  être produits par le générateur plutôt qu'écrits à la main ; discipline de rédaction.
- Maintenance : moyenne au départ (migration), faible ensuite ; c'est l'option qui passe le mieux à l'échelle.

### C. Registre en TypeScript typé

Même contenu que B, mais en modules TypeScript (`regulations/be/rgie-4-4-1-4.ts`) : typage à la compilation, valeurs
importées directement par le moteur et le générateur.

- Avantages : erreurs détectées par `tsc` ; pas de schéma séparé ; refactorisation outillée.
- Inconvénients : moins accessible à un relecteur non développeur (spécialiste RGIE) ; diffs plus bruyants ; mélange
  données et code.
- Maintenance : faible pour les développeurs, plus élevée pour la relecture réglementaire.

### D. Base documentaire externe (wiki, tableur partagé, base de données)

- Avantages : édition facile par des non-développeurs.
- Inconvénients : hors du dépôt, donc hors des tests et de la CI ; versionnement et revue moins fiables ; dépendance à
  un service (contraire à l'architecture locale du projet, sans serveur obligatoire).
- Maintenance : élevée (synchronisation).

## 4. Recommandation

**Option B**, introduite par étapes, sans grand remplacement :

1. Créer `regulations/be/` et son schéma, avec d'abord les exigences déjà vérifiées en 2026 (tableau 4.11, type A,
   40 A en tête, 8 points et circuits mixtes, circuits dédiés et 2 600 W, terre < 100 Ω et 30 Ω, 30 mA et 8 circuits,
   bleu et vert-jaune, commande unipolaire). Le moteur lit ces valeurs ; `catalog.ts` référence les identifiants.
2. Générer `plan.json → rgieRefs` à partir du registre (fin de la liste tenue à la main) et la matrice de traçabilité.
3. Dans le générateur des articles, une balise de citation qui insère valeur, unité et référence ; migrer d'abord les
   articles qui répètent des valeurs (section des câbles, différentiel, mise à la terre, prises).
4. Ajouter le statut de validation humaine, renseigné par les réponses au dossier `VALIDATION-EXTERNE-RGIE.md`.

Coût estimé : étape 1, petite (une dizaine de fiches, adaptation de six règles) ; étapes 2 et 3, moyennes ; aucune ne
demande de serveur ni de dépendance nouvelle.

## 5. Contrôles de CI proposés (prévention des régressions)

| Risque | Contrôle | État |
|---|---|---|
| Valeur du moteur ≠ valeur d'un article | Comparer les tableaux et valeurs citées des articles au registre (aujourd'hui : aux constantes du moteur) | **Fait** pour tableau 4.11, 2 600 W, 100 Ω (`test/regulatory-consistency.test.ts`) ; à étendre via le registre |
| Référence inexistante | `learn:check` refuse tout numéro hors `rgieRefs` | **Fait** |
| Référence obsolète (nouvelle version du RGIE) | Chaque fiche porte la version et un extrait cité ; un script local (le PDF n'est pas dans le dépôt) recherche l'extrait dans le texte de la nouvelle version et liste les fiches dont la citation a disparu ou changé | Proposé |
| Règle sans test | Toute règle du catalogue doit être citée par un test ; liste des exceptions qui ne peut que diminuer | **Fait** (6 règles en dette) |
| Règle corrigée sans source | Règle avec `article` ⇒ `verifiedOn` et fichier de test existant ; `article` présent dans `rgieRefs` | **Fait** |
| Modification réglementaire touchant plusieurs articles | Matrice de traçabilité générée ; un changement de fiche liste dans la CI les articles, règles et tests liés | Proposé (avec le registre) |
| Obligation sans source | Repérer dans les articles les tournures d'obligation (« le RGIE impose », « obligatoire », « interdit ») sans `data-req` ni référence dans la phrase | Proposé (avertissement d'abord, pour éviter les faux positifs) |
| Champ d'application ou exceptions incomplets | Schéma du registre : champs `scope`, `exceptions`, `transitional` obligatoires (valeur « aucun » explicite) | Proposé |
| Exercice contraire au registre | Les règles du simulateur (`cablage-sim.js`) citent leurs identifiants ; test qui vérifie leur existence | Proposé |
