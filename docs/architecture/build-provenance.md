# Provenance des compilations

Ce que chaque compilation produit, comment, et comment le vérifier. Code : `tools/provenance/`.
Décisions : [ADR-0008](../adr/0008-provenance-identification-agpl.md).

## Ce qui est produit

| Fichier ou élément | Contenu | Précaché (hors ligne) |
|---|---|---|
| constante `__OSP_BUILD__` | identité, version, commit, date du commit, état, dépôt, code source, licence | dans le JS |
| `index.html` | balises `osp:*`, `generator`, `application-name`, `rel="license"`, `rel="describedby"` | oui |
| bandeau `/*! … */` de chaque fichier `.js` | nom, version, Project-ID, SPDX, copyright, dépôt. Fichier fait seulement de code tiers : simple renvoi vers `THIRD-PARTY-LICENSES.txt`, sans revendiquer la licence du projet | oui |
| `THIRD-PARTY-LICENSES.txt` | paquets réellement inclus (graphe des modules) : licence, auteur, texte de `LICENSE`, `NOTICE` | oui (« À propos » hors ligne) |
| `fingerprints.json` | intégrité, sources, similarité | **non** |
| `build-info.json` | métadonnées complètes, avec l'empreinte de `fingerprints.json` | **non** |

**Ordre de génération, sans dépendance circulaire :**
1. fichiers de l'application ;
2. `sw.js` (liste de précache) ;
3. `fingerprints.json`, qui contient les empreintes de tous les fichiers publiés, `sw.js` compris, sauf
   `fingerprints.json` et `build-info.json` ;
4. `build-info.json`, qui contient l'empreinte de `fingerprints.json`.

Aucun fichier ne contient l'empreinte d'un fichier qui le contient. Les deux fichiers de provenance ne sont pas
précachés. Un scanner lit donc toujours la version servie, et un appareil hors ligne ne garde pas de métadonnées
périmées : l'écran « À propos » lit les constantes du code qu'il exécute.

**Stabilité et cache :**
- le bandeau ne contient ni commit ni date. Un nouveau commit ne change donc pas tous les fichiers JS (ceux qui
  n'ont pas changé gardent leur cache) ;
- la date de compilation n'apparaît que dans `build-info.json`, hors liste d'intégrité. Deux compilations du même
  commit ont le même `build.id` : vérifié en local, et en CI à chaque release.

## Origine des valeurs

| Valeur | Ordre de priorité |
|---|---|
| projet, licence, copyright | `codemeta.json` (`OSP_PROJECT_ID` pour une identité propre) |
| commit | `GITHUB_SHA` (GitHub Actions), `git rev-parse HEAD`, `OSP_COMMIT` (archive sans `.git`) |
| dépôt | `OSP_REPOSITORY_URL`, `GITHUB_SERVER_URL/GITHUB_REPOSITORY`, `git remote get-url origin` |
| code source correspondant | `OSP_SOURCE_URL`, sinon `<dépôt>/tree/<commit>` |
| état | `git status --porcelain --untracked-files=no` |

Les adresses sont **nettoyées** : https seulement, sans identifiants, sans `.git`. Un chemin local, un nom
d'utilisateur de la machine ou un jeton n'apparaît jamais (test dédié).

## Vérifier

En local comme en CI :

```
npm run build
npm run provenance -- verify dist [--commit <sha>] [--release --version <v>]
```

`verify` contrôle :
- les schémas ;
- les SHA-256 de chaque fichier publié et l'identifiant de compilation ;
- les artefacts référencés ;
- la présence du bandeau dans chaque `.js` ;
- les balises, cohérentes avec `build-info.json` ;
- les chemins relatifs, pour un déploiement en sous-répertoire ;
- un précache sans fichier de provenance.

Avec `--release`, il exige en plus :
- un arbre propre ;
- une compilation non dérivée ;
- le commit et la version attendus ;
- un code source correspondant **accessible** (requête HEAD).

Site assemblé : `npm run provenance -- well-known <site> app`, puis `npm run provenance -- verify-site <site>`.

## Dans la CI

| Workflow | Ajout | Quand |
|---|---|---|
| `ci.yml`, `ci-multi-os.yml` | `provenance -- verify dist --commit <sha>` | déjà déclenchés ; quelques secondes |
| `pages.yml` | copie de `site/.` (fichiers à point), schémas, `.well-known`, `verify`, `verify-site` | chaque publication ; quelques secondes |
| `release.yml` | arbre propre, vérification `--release`, double compilation, SBOM web et bureau, `SHA256SUMS`, attestations | **tags seulement** |

Les attestations (`actions/attest-build-provenance`) sont gratuites pour un dépôt public et ne s'exécutent pas sur
un dépôt privé. Elles se vérifient avec :

```
gh attestation verify <fichier> --repo SebastienBatteur/voltaplan
```

À défaut d'attestation (fork privé, autre hébergeur), `SHA256SUMS` reste disponible : une alternative gratuite,
mais pas une preuve d'origine. Une signature GPG ou Sigstore du fichier par le mainteneur peut s'y ajouter.

## Releases et empreintes historiques

Chaque release (tag `v*`) joint au brouillon de release :
- `voltaplan-web-<v>.zip` ;
- `build-info-<v>.json`, `fingerprints-<v>.json`, `THIRD-PARTY-LICENSES-web-<v>.txt` ;
- `sbom-web-<v>.cdx.json` et `sbom-desktop.cdx.json` ;
- `SHA256SUMS`.

Une plateforme les récupère par l'API des releases de GitHub, **sans cloner le dépôt** :

```
GET /repos/<dépôt>/releases
```

puis le téléchargement de chaque fichier joint.

Versions antérieures, sans modifier l'historique :

```
npm run provenance -- history <commit>... --out <dossier>
```

Les fichiers sont lus par `git show`, rien n'est extrait ni modifié. Le résultat donne les empreintes de sources et
de similarité, sans intégrité (les fichiers publiés de l'époque ne sont pas reconstruits). Essai réel du
2026-11-25 : premier commit et `496bb50`, 65 s.

## Tags signés (procédure, à la main du porteur du projet)

```
git config user.signingkey <clé>
git tag -s v0.2.0 -m "Voltaplan 0.2.0"
git push origin v0.2.0
```

Vérification : `git tag -v v0.2.0`. Sans clé, l'attestation GitHub de la release suffit à relier les artefacts au
workflow et au commit.
