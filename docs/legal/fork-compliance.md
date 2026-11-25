# Forks et versions modifiées

Les forks sont bienvenus : l'AGPL garantit le droit de modifier et de redistribuer. Voltaplan ne contrôle ni
n'autorise les forks, et ne cherche pas à les empêcher. Ce guide distingue **ce que la licence impose** de **ce qui
est seulement recommandé**.

> Document technique, pas un avis juridique.

## Ce que la licence impose (AGPL-3.0-only)

| Vous… | Obligations |
|---|---|
| utilisez une version modifiée pour vous seul ou dans votre organisation, sans utilisateurs externes | aucune publication obligatoire |
| **distribuez** une version, modifiée ou non (fichiers, paquets, application de bureau) | garder les mentions de licence et de copyright (§4, §5) ; indiquer que vous avez modifié le code, avec une date (§5 a) ; licence AGPL-3.0 pour l'ensemble (§5 c) ; fournir le **code source correspondant** (§6) |
| **proposez à distance** une version modifiée (site web, service) | en plus : proposer « en évidence » à chaque utilisateur le code source correspondant de **votre** version (§13) |

Le « code source correspondant » est celui de **votre** version : vos modifications comprises, avec les scripts
nécessaires pour la compiler. Un lien vers le dépôt d'origine ne suffit pas si vous avez modifié le code.

## Comment Voltaplan vous aide

Une compilation depuis votre fork le reconnaît automatiquement :
- sur GitHub Actions, à partir de `GITHUB_REPOSITORY` ;
- en local, à partir de `git remote origin`.

Dans ce cas :
- **« Code source »**, dans le menu « ⋯ », le pied de page et « À propos », mène à
  `<votre dépôt>/tree/<votre commit>`, et non au dépôt d'origine ;
- `build.derived` vaut `true` et « À propos » affiche « Version dérivée » ;
- `upstream` garde le projet d'origine.

Variables de compilation, toutes facultatives :

| Variable | Usage |
|---|---|
| `OSP_REPOSITORY_URL` | votre dépôt, si la détection ne convient pas |
| `OSP_SOURCE_URL` | votre code source correspondant hébergé ailleurs (archive, autre forge) : affiché comme « déclaré » |
| `OSP_COMMIT` | commit, pour une compilation depuis une archive sans `.git` (état « declared ») |
| `OSP_PROJECT_ID` | votre propre identifiant permanent (`urn:uuid:` que vous générez), si votre projet prend son identité ; la filiation (`upstream.id`) est gardée |

Une compilation avec des modifications **non commitées** est autorisée. Elle porte l'état `modified`, et
« À propos » prévient que le code source correspondant n'est pas publié tel quel. Avant de distribuer ou de mettre
en ligne, commitez et publiez vos modifications.

## Recommandé, non obligatoire

- **Garder `codemeta.json` et son `upstream.id`.** La filiation reste lisible. Changez `name`, `codeRepository` et
  `url`, et ajoutez votre propre `identifier` si vous le souhaitez.
- **Garder la mention générale de copyright et `REUSE.toml`.** Ajoutez la vôtre pour vos modifications :
  « Copyright (C) <année> <vous> » dans les fichiers modifiés, ou une nouvelle entrée dans `REUSE.toml`. N'en
  retirez aucune existante : retirer une mention de copyright est, en revanche, contraire à la licence (§4, §5).
- **Tenir un journal de vos modifications** (`CHANGELOG.md`), daté.
- **Publier `build-info.json` et `/.well-known/oss-provenance.json`**, et garder le bandeau des fichiers JS.
- **Produire vos propres SBOM et attestations** : le workflow `release.yml` fonctionne tel quel dans un fork
  public.

Aucune de ces recommandations n'est une condition d'utilisation : Voltaplan n'ajoute aucune restriction à l'AGPL
(§7). Vous pouvez retirer les métadonnées et le bandeau d'identification. Les mentions de licence et de copyright
exigées par l'AGPL, elles, doivent rester.

## Renommer le projet

Le nom « Voltaplan » et le logo ne sont pas couverts par une marque déposée à ce jour **[à vérifier par le porteur
du projet]**. Il est néanmoins recommandé de renommer un fork distribué, pour éviter toute confusion avec la
version d'origine : `codemeta.json` (`name`), `src/brand.ts`, le manifeste web et les icônes.
