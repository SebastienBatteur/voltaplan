# Licence et conformité AGPL

> Document technique, pas un avis juridique. Les points marqués **[à faire relire]** méritent l'avis d'un juriste
> avant une première release officielle.

## 1. Licence applicable

- **Identifiant SPDX** : `AGPL-3.0-only`, la GNU Affero General Public License, version 3 uniquement.
- **Texte de la licence** : [`LICENSE`](../../LICENSE), recopié sans modification dans
  [`LICENSES/AGPL-3.0-only.txt`](../../LICENSES/AGPL-3.0-only.txt) pour REUSE.
- **Mention générale** : `Copyright (C) 2026 Sébastien Batteur and VoltaPlan contributors`.
- **Où la licence est déclarée** : `package.json`, `src-tauri/Cargo.toml` et `src-tauri/tauri.conf.json`, plus
  `REUSE.toml` pour tous les fichiers du dépôt.
- **Où elle est publiée** :
  - dans le bandeau des fichiers JavaScript distribués ;
  - dans `build-info.json` ;
  - dans les balises `<meta>` ;
  - sur l'écran « À propos ».

## 2. Passage de `AGPL-3.0-or-later` à `AGPL-3.0-only` (audit du 2026-11-25)

### Faits relevés dans le dépôt

L'historique de `main` va du 2026-11-23 au 2026-11-25, soit 128 commits.

| Auteur | Commits | Nature |
|---|---|---|
| Sébastien Batteur | 124 | tout le code, la documentation et les ressources (deux orthographes du nom, même compte GitHub `2057112`) |
| dependabot[bot] | 4 | numéros de version dans `package.json` et `package-lock.json` (PR 9, 15, 18, 20), sans code |
| Claude, assistant IA (co-auteur indiqué) | 116 lignes `Co-Authored-By` | code écrit avec l'assistant, à la demande et sous la direction de l'auteur |

- **Aucune contribution externe** : les 20 PR du dépôt viennent toutes de Dependabot, et aucune PR humaine n'a été
  fusionnée.
- **Aucun code tiers recopié** dans les sources : aucune mention « adapted from », « copied from », « derived from »
  ni de copyright tiers dans `src/`, `tools/`, `src-tauri/src/`, `site/` et `public/`.
- **Ressources graphiques** : icônes et symboles électriques dessinés pour le projet (SVG, PNG dérivés).
- Les dépendances ne sont pas modifiées. Elles restent sous leurs propres licences, toutes compatibles avec
  l'AGPL-3.0 (voir le §4).

### Analyse

- Le **DCO** n'est pas une cession de droits : chaque contributeur garde ses droits d'auteur et accorde seulement la
  licence du projet. Changer de licence demanderait donc l'accord de chaque contributeur humain. **Il n'y en a aucun
  autre que l'auteur.**
- Les modifications de Dependabot sont des numéros de version produits automatiquement, sans apport original.
- Pour le code écrit avec un assistant IA, les conditions du fournisseur attribuent le résultat à l'utilisateur.
  Les parties qui ne seraient pas protégeables par le droit d'auteur ne bloquent pas un changement de licence :
  personne d'autre ne peut les revendiquer. **[à faire relire]**
- Passer de « version 3 ou ultérieure » à « version 3 uniquement » **restreint** ce que l'on accorde : il ne s'agit
  pas d'une licence différente. Un titulaire unique des droits peut le faire.

**Conclusion** : le changement est possible, l'auteur étant le seul titulaire des droits. Il est fait dans un commit
séparé de la branche `provenance-agpl`, que l'on peut retirer seul si la relecture juridique le déconseille.

### Conséquences pour les versions déjà publiées

- Les versions publiées sous `AGPL-3.0-or-later` **restent sous cette licence** pour toute personne qui en a obtenu
  une copie : les commits de `main` jusqu'à `496bb50` et le site déployé avant la fusion. Une licence accordée ne se
  retire pas. Quelqu'un peut donc continuer un fork de ces versions sous une future AGPL v4.
- Le changement vaut **à partir du premier commit qui porte `AGPL-3.0-only`**. Aucune release officielle (tag) n'a
  été publiée avant, ce qui limite l'ambiguïté.
- Les contributions futures sont acceptées sous `AGPL-3.0-only`, par le DCO (`git commit -s`). Il n'y a pas de CLA.

## 3. Obligations AGPL et simples recommandations

| Situation | Obligation (texte de la licence) | Comment Voltaplan aide |
|---|---|---|
| Version **non modifiée**, redistribuée | §4 et §6 : garder les mentions de licence et de copyright, fournir le code source correspondant ou une offre écrite | bandeau des fichiers JS, `build-info.json`, écran « À propos » |
| Version **modifiée**, redistribuée | §5 : indiquer que le code a été modifié, avec une date ; licence AGPL pour l'ensemble ; code source correspondant (§6) | état `modified`, `declared` ou `derived` ; variables `OSP_*` pour déclarer son dépôt et son code source (voir [fork-compliance.md](fork-compliance.md)) |
| Version **modifiée**, utilisée **à distance** (site web) | §13 : proposer « en évidence » le code source correspondant à tous ses utilisateurs | lien « Code source » de l'application, qui pointe vers le dépôt **de la version compilée**, pas vers le dépôt officiel |
| Usage privé, même modifié | aucune obligation de publier | — |

**Recommandations, non obligatoires** :
- garder l'identifiant permanent du projet d'origine (`upstream.id`) ;
- publier `build-info.json` et le manifeste `.well-known` ;
- signer ses tags et produire une SBOM.

La licence n'impose aucune de ces pratiques. Voltaplan ne peut en exiger aucune : ce serait une restriction
supplémentaire, interdite par le §7.

## 4. Composants tiers

- **Liste par compilation** : `THIRD-PARTY-LICENSES.txt`, généré avec la version web. Pour chaque paquet
  effectivement inclus dans les fichiers distribués, il donne la licence, l'auteur, le texte de `LICENSE` et le
  fichier `NOTICE` s'il existe.
- **SBOM CycloneDX** :
  - version web : `sbom-web.cdx.json`, produite par `npm sbom`, dépendances de production ;
  - application de bureau : `sbom-desktop.cdx.json`, produite par `cargo metadata`, avec les dépendances Rust et
    Tauri.

  Les deux sont générées pour les releases seulement (voir [artifact-integrity.md](../security/artifact-integrity.md)).
- Les licences relevées au 2026-11-25, dépendances de production npm : MIT, Apache-2.0, BSD-3-Clause, Unlicense,
  MIT ou Apache-2.0. Toutes sont compatibles avec l'AGPL-3.0.
- Aucune police, image ni icône tierce n'est distribuée. Les symboles électriques sont dessinés par le code du
  projet, d'après les formes du RGIE, sans recopier de fichier tiers.

## 5. REUSE et SPDX : intégration progressive

**Étape 1, faite :**
- `REUSE.toml` déclare le copyright et la licence de **tous** les fichiers, sans modifier chaque fichier source ;
- `precedence = "aggregate"` : une mention placée dans un fichier par un contributeur ou un tiers **s'ajoute** à la
  mention générale, elle n'est jamais effacée ;
- le texte de la licence est dans `LICENSES/AGPL-3.0-only.txt`.

**Étapes suivantes, proposées :**
- vérification par l'outil officiel `reuse lint`, en local ou dans un job manuel. Il n'est pas installé dans la CI
  pour ne pas consommer de quota ;
- en-têtes `SPDX-License-Identifier` seulement dans les fichiers **copiés** d'ailleurs, s'il y en a un jour, avec
  leur copyright d'origine. Ajouter un en-tête aux 325 fichiers n'apporte rien de plus que `REUSE.toml`.

**À ne pas faire :**
- attribuer au projet un fichier tiers ;
- retirer une mention de copyright existante ;
- écrire une année de copyright antérieure à la création réelle d'un fichier.
