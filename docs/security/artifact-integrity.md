# Intégrité des artefacts et empreintes

`fingerprints.json` sépare trois familles. **Ne pas les confondre** :

| Famille | Question à laquelle elle répond | Valeur probante |
|---|---|---|
| **Intégrité** (`integrity`) | « Ce fichier est-il exactement celui de cette compilation ? » | exacte (SHA-256) ; ne dit rien de l'**origine** sans attestation ni signature |
| **Sources** (`sources`) | « Ces fichiers source sont-ils ceux de ce commit ? » | exacte, après normalisation des fins de ligne (LF) |
| **Similarité** (`similarity`) | « Ce code ressemble-t-il à un composant de Voltaplan ? » | **indice seulement**, jamais une preuve de copie ni de violation de licence |

La **provenance** (qui a produit l'artefact, dans quel workflow, à partir de quel commit) ne vient que des
attestations GitHub des releases. Les métadonnées de `build-info.json` sont **déclaratives**.

## Intégrité

- SHA-256 de chaque fichier publié, sauf `build-info.json` et `fingerprints.json`, qui référencent cette liste.
  Les cartes de sources (`.map`) sont aussi exclues.
- `build.id` = `sha256:` + SHA-256 de la liste triée `"<sha256>  <chemin>"`. Il est identique pour deux
  compilations reproductibles.
- Vérification : `npm run provenance -- verify dist`.
- Pour une release, `SHA256SUMS` (format `sha256sum -c`) et l'attestation :
  `gh attestation verify voltaplan-web-<v>.zip --repo SebastienBatteur/voltaplan`.

## Similarité : algorithme `oss-fp/1`

**Composants caractéristiques** (`tools/provenance/components.ts`). Ce sont le cœur métier, pas l'interface :
- `rgie-rules` (`src/rules/`) ;
- `electrical-model` (`src/model/`, `src/calc/`) ;
- `file-format` (`src/format/`) ;
- `graphics` (`src/unifilar/`, `src/plan/`, `src/board/`).

**Étapes :**
1. TypeScript → JavaScript sans types ni commentaires (`typescript.transpileModule`), fins de ligne LF.
2. **Chaînes** : chaque littéral, normalisé (NFC, espaces réduits), d'au moins 6 caractères et contenant une
   lettre. Empreinte = SHA-256 tronqué à 64 bits (16 caractères hexadécimaux).
3. **Jetons normalisés**, lus par l'analyseur lexical de TypeScript :
   - un identifiant devient `i`, sauf un nom de propriété après `.` ou `?.`, que les minifieurs ne renomment pas ;
   - une chaîne devient `s`, un nombre `n`, une expression régulière `r` ;
   - `const`, `let` et `var` deviennent `v` ; `true`, `false`, `!0` et `!1` deviennent `b` ; `undefined` et
     `void 0` deviennent `u` ;
   - la ponctuation `; , { } ( )` est ignorée.

   On prend ensuite des séquences de 6 jetons consécutifs, chacune hachée sur 64 bits.
4. **Corpus de fond** : tout ce qui figure aussi dans le code des bibliothèques est retiré, chaînes comme
   séquences. À la compilation, ce corpus est le code des modules tiers réellement inclus. Pour l'historique et
   l'évaluation, ce sont les fichiers JavaScript des dépendances de production.

   Ainsi, React, zod, pdf.js et le code générique ne comptent pas.
5. **Publié** : toutes les chaînes caractéristiques (hachées) et un échantillon *bottom-k* (MinHash, k = 512) des
   séquences.
6. **Score d'une cible** (n'importe quel JavaScript, minifié ou non) :
   - part des chaînes du composant retrouvées dans la cible ;
   - part de son échantillon de séquences retrouvée dans la cible (contenance : une cible bien plus grande
     n'est pas pénalisée).

**Seuil de signalement proposé** : chaînes ≥ 35 % **ou** jetons ≥ 35 %, sur au moins un composant. Ce n'est pas un
verdict : un humain doit ensuite comparer le code source.

## Robustesse mesurée (2026-11-25, `npm run provenance -- eval`)

Référence : les sources du commit `392fb60`. Cibles : les transformations indiquées, appliquées au code transpilé.
Chaque cellule donne la part retrouvée, chaînes / jetons.

| Cible | rgie-rules | electrical-model | file-format | graphics |
|---|---|---|---|---|
| compilation de production Vite (autre chaîne de minification) | 90 % / 52 % | 94 % / 64 % | 90 % / 61 % | 95 % / 71 % |
| minification esbuild complète | 100 % / 56 % | 100 % / 70 % | 100 % / 74 % | 100 % / 77 % |
| variables renommées | 100 % / 82 % | 100 % / 88 % | 100 % / 90 % | 100 % / 93 % |
| commentaires et formatage modifiés | 100 % / 88 % | 100 % / 95 % | 100 % / 97 % | 100 % / 100 % |
| syntaxe réécrite | 100 % / 61 % | 100 % / 74 % | 100 % / 79 % | 100 % / 81 % |
| projet renommé, puis minifié | 100 % / 56 % | 100 % / 70 % | 92 % / 74 % | 100 % / 77 % |
| métadonnées retirées (bandeau, balises) | 90 % / 52 % | 94 % / 64 % | 90 % / 61 % | 95 % / 71 % |
| 1/3 des instructions retirées, puis minifié | 93 % / 25 % | 78 % / 46 % | 73 % / 55 % | 70 % / 53 % |
| 1/2 des instructions retirées, puis minifié | 80 % / 45 % | 40 % / 39 % | 57 % / 42 % | 82 % / 47 % |
| la moitié des modules seulement, minifiés | 78 % / 19 % | 81 % / 35 % | 83 % / 51 % | 73 % / 39 % |
| intégré dans une application plus grande, avec ses bibliothèques | 100 % / 57 % | 100 % / 70 % | 100 % / 74 % | 100 % / 77 % |

**Faux positifs**, sur du code indépendant (aucun ne dépasse 1 %) :

| Code indépendant | rgie-rules | electrical-model | file-format | graphics |
|---|---|---|---|---|
| typescript-estree, client Vite, linter ESLint, fenêtre jsdom, fake-indexeddb | ≤ 1 % / 0 % | 0 % / 0 % | ≤ 1 % / 0 % | 0 % / 0 % |
| react-dom, zod, pdf.js, @zip.js, zustand (bibliothèques **utilisées** par Voltaplan) | 0 % / 0 % | 0 % / 0 % | 0 % / 0 % | 0 % / 0 % |

**À lire avec prudence :**
- Pour les bibliothèques utilisées, 0 % est **obtenu par construction** : elles forment le corpus de fond. C'est
  voulu, puisque les empreintes ne doivent pas reposer sur elles, mais ce n'est pas une mesure indépendante.
- Avant ce filtrage, lors du premier essai, pdf.js atteignait 7 % (chaînes) et 9 % (jetons) sur le composant
  graphique. Le seuil de 35 % laisse donc une marge nette.
- **Non mesuré : une application indépendante qui utilise les mêmes bibliothèques** (React avec zustand, par
  exemple). Aucune n'est disponible dans les dépendances du projet. C'est le faux positif le plus réaliste ; la
  future plateforme devra le mesurer sur un corpus d'applications réelles.
- Les ressources graphiques remplacées (logo, icônes) ne changent pas les empreintes de similarité, qui ne
  portent que sur le code. Elles changent les empreintes d'intégrité des fichiers concernés, comme attendu.

## Limites, à ne pas dépasser

- **Une seule famille de minifieurs mesurée** : esbuild, seul ou dans Vite / Rollup. Terser, SWC, Closure Compiler
  et l'obfuscation ne sont **pas** mesurés. L'obfuscation (chaînes chiffrées, flot de contrôle aplati) fait
  probablement chuter les deux scores.
- **Réécriture profonde** (le code est réécrit, traduit dans un autre langage, ou les chaînes sont toutes changées)
  : les deux scores baissent fortement. Les empreintes ne détectent alors rien, et ne doivent pas prétendre le
  contraire.
- **Les chaînes dominent la détection.** Un dérivé qui traduit ou remplace toutes les chaînes du moteur RGIE
  (références d'articles, messages) ne garde que le score des jetons. Celui-ci tombe entre 19 et 56 % selon la
  transformation.
- **Code partagé légitimement.** Un autre projet qui intègre un composant de Voltaplan en respectant l'AGPL sera
  signalé, ce qui est correct. La similarité ne dit pas si la licence est respectée : c'est l'objet des
  vérifications de licence et de code source de la plateforme.
- **Le corpus de fond** dépend des versions des bibliothèques. Deux compilations à des dates éloignées peuvent
  publier des échantillons légèrement différents ; `similarity.background` l'indique.
- **Pas de MinHash pondéré, d'AST, ni de TLSH** : ils sont renvoyés à la future plateforme (voir ci-dessous).

## Recommandations pour la future plateforme de surveillance

1. **Découvrir** : `/.well-known/oss-provenance.json`, puis `rel="describedby"`, les balises `osp:*`, le bandeau
   JS. En dernier recours, les empreintes de similarité.
2. **Relier sans faire confiance** : `build-info.json` est déclaratif. Comparer l'intégrité avec la release
   officielle de même `build.id`, et vérifier l'attestation (`gh attestation verify`) avant de qualifier une
   instance d'« officielle ».
3. **Vérifier la conformité, pas seulement la ressemblance** : licence affichée, lien « code source » présent et
   accessible, code au commit annoncé, correspondance des sources (`sources.files`).
4. **Historiser** : conserver chaque observation (date, adresse, `build-info.json` reçu, empreintes, scores) sans
   rien collecter sur les utilisateurs des instances.
5. **Corpus et étalonnage** : mesurer les faux positifs sur des applications indépendantes réelles, ajouter Terser
   et SWC aux transformations, puis évaluer l'analyse AST (structure des fonctions) et TLSH comme second avis.
6. **Présentation** : toujours afficher « similarité X % (indice) » avec l'algorithme et sa version
   (`oss-fp/1`), jamais « copie » ou « violation ». Toute mise en cause passe par une revue humaine et un contact
   avec le mainteneur.
