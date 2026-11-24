# Audit avant publication du dépôt (passage en public)

Date : 2026-11-24. Dépôt : `SebastienBatteur/voltaplan` (privé), branche `main` au commit `e3e68e4`.
Périmètre : **tout l'historique** (`git rev-list --all`, y compris les branches locales de travail, la branche
distante `worktree-agent-ab851763ebd9da010` et les 20 têtes de demandes de fusion `refs/pull/*/head` de
Dependabot récupérées pour l'occasion), la configuration, les dépendances, et ce que GitHub exposerait
(artifacts, journaux de runs, releases, demandes de fusion).

Rien n'a été modifié côté GitHub (visibilité, historique, branches, artifacts) : ce document **constate et
recommande** seulement.

## Verdict

**GO sous conditions** : aucun élément bloquant trouvé dans le contenu versionné ni dans l'historique (aucun
secret réel, aucun fichier de client, aucune adresse e-mail personnelle). Trois actions **sans risque** sont
recommandées avant de basculer la visibilité (voir la liste de contrôle), et une vérification humaine reste à
faire sur le contenu éditorial des documents de stratégie (choix de les publier ou non).

## Méthode

- Scanner Python écrit pour l'occasion (non versionné), appliqué à **chaque blob texte** de chaque commit
  (623 blobs distincts, 74 commits + 18 commits propres aux demandes de fusion Dependabot) : règles Anthropic
  (`sk-ant-`), OpenAI (`sk-`, `sk-proj-`), Google (`AIza…`), GitHub (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`,
  `github_pat_`), Slack (`xox?-`, webhooks), AWS (`AKIA`/`ASIA`), clés privées (`-----BEGIN … PRIVATE KEY-----`),
  `client_secret`, affectations `password=`/`pwd:`, jetons `Bearer`, JWT, adresses e-mail, numéros de téléphone
  belges et français, chemins locaux (`C:\Users\…`, `/Users/…`, `/home/…`), adresses postales (rue, avenue,
  straat, steenweg…).
- Liste de tous les chemins ayant existé (`git log --all --diff-filter=A --name-only`) et des suppressions
  (`--diff-filter=D`).
- Métadonnées : auteurs et committers de tous les commits (`%an %ae %cn %ce`), messages de commit.
- Métadonnées des images PNG (blocs `tEXt`, `iTXt`, `zTXt`, `eXIf`) et des SVG (traces d'éditeur).
- Licences : champ `license` de chaque paquet de `package-lock.json` ; pour `src-tauri/Cargo.lock`, licence de
  chaque crate à sa version exacte via l'API publique de crates.io (cargo n'est pas installé sur ce poste).
- GitHub : `gh release list`, `gh api …/actions/artifacts`, liste des runs, variables et secrets d'Actions (noms
  seulement), environnements, protection de branche, demandes de fusion et tickets.

## 1. Secrets

| Règle | Fichier | Commit | Valeur (masquée) | Analyse |
|---|---|---|---|---|
| OpenAI / Anthropic (`sk-…`) | `test/secureStore.test.ts` | présent depuis l'ajout du chiffrement local, toujours dans `main` | `sk-a…` (24 et 25 caractères) | **Faux positif** : fausses clés de test, manifestement factices (suite « secret » / chiffres consécutifs), déjà couvertes par l'exception `^test/` de `.gitleaks.toml`. |
| Téléphone BE / FR | `src-tauri/Cargo.lock` | idem | `0404…`, `0901…` | **Faux positif** : fragments d'empreintes SHA-256 (`checksum = "…"`). |

Aucune autre correspondance : pas de clé Google, GitHub, Slack, AWS, de clé privée, de `client_secret`, de mot de
passe, de jeton Bearer ni de JWT, **dans aucun commit**. Aucun fichier `.env*` n'a jamais été versionné
(`.env*` est ignoré). Les identifiants d'application OAuth (`VITE_GOOGLE_CLIENT_ID`, etc.) sont lus depuis des
*variables* d'Actions, publiques par nature, et aucune variable ni aucun secret d'Actions n'est défini
aujourd'hui.

La CI fait déjà tourner gitleaks (règles par défaut) sur tout l'historique ; ce scan indépendant confirme
l'absence de secret.

## 2. Fichiers ayant existé dans l'historique

200 chemins ont existé ; un seul a été supprimé (`public/sw.js`, remplacé par un service worker généré).

Fichiers binaires ou non textuels ayant existé :

| Type | Fichiers | Analyse |
|---|---|---|
| Icônes PNG | `public/icons/icon-256.png`, `public/icons/icon-512.png`, 16 fichiers `src-tauri/icons/*.png` | icônes de l'application ; **aucune métadonnée** texte ni EXIF |
| Icônes Windows / macOS | `src-tauri/icons/icon.ico`, `src-tauri/icons/icon.icns` | icônes générées |
| SVG | `public/icon.svg`, `site/icon.svg` | 4 lignes, sans trace d'éditeur |
| JSON | `package.json`, `package-lock.json`, `tsconfig.json`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `.claude/launch.json`, `public/manifest.webmanifest` | configuration ; aucune donnée de projet |

**Aucun** fichier `.trik`, `.voltaplan`, `.eds`, `.jpg`, `.jpeg`, `.pdf`, `.zip` ni aucune photo n'a jamais été
commité, dans aucune branche ni demande de fusion. Le dossier `test/fixtures/` n'apparaît **dans aucun commit** :
les fichiers de clients réels n'ont jamais quitté le poste (ils sont ignorés par `.gitignore` :
`test/fixtures/*.trik`, `*.voltaplan`, `*.eds`, `*.jpg`, `*.png`). Les tests qui les utilisent
(`test/bom.test.ts`, `test/eendraadschema.test.ts`, `test/integrity.test.ts`, `test/sync.test.ts`) ne
contiennent que leurs noms génériques (`maison-a`, `maison-b`) et sont sautés s'ils sont absents.

## 3. Données personnelles

**Contenu** : aucune adresse e-mail, aucun numéro de téléphone, aucune adresse postale ni aucun nom de client
dans le contenu de l'historique (les seules correspondances sont les faux positifs du §1 et un nom de fichier
`128x128@2x.png` reconnu comme e-mail). Les exemples des tests sont génériques (`PRISES I`, `photo.jpg`,
`maison.trik`…). Les messages de commit décrivent des fonctionnalités, sans nom ni adresse.

**Métadonnées des commits** :

| Nom | Adresse | Commits |
|---|---|---|
| Sebastien Batteur (auteur et committer) | adresse *noreply* GitHub (`…+SebastienBatteur@users.noreply.github.com`) | 67 |
| dependabot[bot] / GitHub | adresses *noreply* | 7 |

Aucune adresse e-mail personnelle n'apparaît dans l'historique : **aucune réécriture n'est nécessaire**. Le nom
de l'auteur et le compte GitHub sont publics par nature (ils figurent déjà dans l'adresse du site Pages).

Pour garder cet état :

- garder `user.email` sur l'adresse *noreply* (dans chaque clone / poste) ;
- activer *Settings → Emails → « Keep my email addresses private »* et *« Block command line pushes that expose
  my email »* sur le compte GitHub (sans risque) ;
- si une adresse personnelle apparaissait un jour, la seule correction possible serait de **réécrire
  l'historique** (`git filter-repo --mailmap`) et de forcer le push : opération **destructive**, qui change tous
  les identifiants de commit, casse les clones et les liens existants, et doit être faite **avant** le passage
  en public et **seulement avec l'accord du propriétaire**. Ce n'est pas le cas aujourd'hui.

## 4. Configuration

| Fichier | Constat | Action |
|---|---|---|
| `.claude/launch.json` (versionné) | deux configurations de serveur de développement (`npm run dev` port 5174, `npm run preview` port 4174) ; ni chemin local, ni nom d'utilisateur | sans conséquence ; à garder ou retirer selon le souhait du propriétaire |
| `.claude/` (reste) | `.claude/settings.local.json` et `.claude/worktrees/` sont ignorés ; mais un futur `.claude/settings.json`, des agents ou des mémoires créés dans ce dossier seraient versionnés | **recommandé** : ignorer `.claude/*` sauf `!.claude/launch.json` (sans risque) |
| `.vscode/` | jamais versionné | — |
| `src-tauri/tauri.conf.json` | identifiant `app.voltaplan.desktop`, CSP, `devUrl` `http://localhost:5174` ; rien de privé | — |
| `src-tauri/capabilities/default.json` | droits Tauri ; rien de privé | — |
| Workflows `.github/workflows/*` | aucun chemin local, aucune URL interne ; seuls `secrets.GITHUB_TOKEN` (fourni par GitHub) et des `vars.VITE_*` (publics) | voir aussi [docs/ci.md](../ci.md) |
| `.github/codeql-accepted.txt` | exceptions CodeQL justifiées ; publiables | — |
| `.github/dependabot.yml` | rien de privé | — |
| `.gitleaks.toml` | exception `^test/` pour les fausses clés | — |
| Documentation | liens vers des runs `github.com/SebastienBatteur/voltaplan/actions/runs/…` (`docs/desktop-tauri.md`) : deviendront consultables, sans problème | — |

Le fichier `.git` des copies de travail (worktrees) contient un chemin local (`C:/Users/…`), mais il n'est pas
versionné.

## 5. Licences des dépendances

Licence du projet : **AGPL-3.0-or-later** (`LICENSE`, `package.json`, `tauri.conf.json`).

### npm (`package-lock.json`)

| Licence | Production (livrées) | Développement |
|---|---|---|
| MIT | 28 | 250 |
| Apache-2.0 | 3 | 16 |
| MIT OR Apache-2.0 / Apache-2.0 OR MIT | 3 | 12 |
| Unlicense | 1 | — |
| ISC | — | 13 |
| BSD-2-Clause | — | 8 |
| BSD-3-Clause | — | 3 |
| BlueOak-1.0.0 | — | 2 |
| MIT-0 | — | 1 |
| CC-BY-4.0 | — | 1 (`caniuse-lite`, données utilisées à la construction, non livrées) |
| **Total** | **35** | **306** |

Aucune licence propriétaire, SSPL, BUSL, « non commercial » ni inconnue. Toutes les licences des dépendances
livrées (MIT, Apache-2.0, Unlicense) sont compatibles avec une distribution sous AGPL-3.0-or-later (Apache-2.0 est
compatible avec la GPLv3 et donc l'AGPLv3). `CC-BY-4.0` ne concerne qu'un outil de développement.

### Rust (`src-tauri/Cargo.lock`)

436 crates de crates.io (plus la crate `voltaplan` elle-même), licences lues à leur version exacte :

| Licence (expression SPDX déclarée) | Crates |
|---|---|
| MIT OR Apache-2.0 (et variantes d'écriture : `Apache-2.0 OR MIT`, `MIT/Apache-2.0`, `Apache-2.0 / MIT`…) | 248 |
| MIT | 105 |
| Unicode-3.0 (ICU4X : `icu_*`, `zerovec`, `yoke`, `tinystr`, `writeable`, `litemap`…) | 18 |
| Zlib OR Apache-2.0 OR MIT (`objc2-*`, `tinyvec`, `bytemuck`…) et `MIT OR Apache-2.0 OR Zlib` | 21 |
| Unlicense OR MIT | 16 |
| MPL-2.0 (`cssparser`, `cssparser-macros`, `selectors`, `dtoa-short`, `option-ext`) | 7 |
| Apache-2.0 WITH LLVM-exception (seule ou en alternative) | 4 |
| Zlib (`foldhash`, `zlib-rs`) | 2 |
| Apache-2.0 | 2 |
| BSD-3-Clause, ou en alternative / conjonction avec MIT / Apache-2.0 | 6 |
| MIT OR Apache-2.0 OR LGPL-2.1-or-later (`r-efi`) | 2 |
| Autres combinaisons permissives (`0BSD OR MIT OR Apache-2.0`, `CC0-1.0 OR MIT-0 OR Apache-2.0`, `Apache-2.0 AND MIT`, `(MIT OR Apache-2.0) AND Unicode-3.0`, ISC) | 5 |
| Licence absente ou inconnue | 0 |

Aucune licence propriétaire, SSPL, BUSL ou « non commercial ». Points à connaître :

- **MPL-2.0** (7 crates, dépendances de Tauri / wry pour l'analyse CSS) : licence « copyleft par fichier »,
  **compatible** avec la GPL / l'AGPL (MPL-2.0 §3.3, aucune des crates n'est marquée
  « Incompatible With Secondary Licenses ») ; obligation : le code source de ces fichiers MPL reste disponible
  sous MPL — satisfait par la publication des sources et des versions exactes (`Cargo.lock`).
- **Unicode-3.0**, **Zlib**, **BSD-3-Clause**, **Apache-2.0 WITH LLVM-exception** : permissives, compatibles ;
  conserver les mentions de copyright dans une éventuelle notice des paquets de bureau (voir action 11).
- **LGPL-2.1-or-later** n'apparaît qu'en alternative (`r-efi` : on retient MIT ou Apache-2.0).

## 6. Ce que GitHub rendrait public

| Élément | État | Exposition après passage en public |
|---|---|---|
| Releases | **aucune** | — |
| Site Pages | `https://sebastienbatteur.github.io/voltaplan/` est **déjà public** (Pages d'un dépôt privé publié en public) | inchangée : l'application web compilée est déjà accessible à tous |
| Artifacts de runs (non expirés au 24/11) | 64 `voltaplan-web` (54 Mo, expiration 14 jours), 27 `codeql-sarif` (2 Mo, 30 jours), 3 `voltaplan-desktop-linux` + 3 `-windows` + 3 `-macos-arm64` (285 Mo, 7 jours), 3 `cargo-lock` (7 jours), 4 paquets `release.yml` manuels `voltaplan-linux/-windows/-macos-arm64/-macos-x64` (98 Mo, 30 jours, expiration le 24/12), 1 `github-pages` (1 jour) | **téléchargeables par toute personne connectée à GitHub** jusqu'à leur expiration. Contenu : version web compilée (déjà publique sur Pages), résultats CodeQL (liste des alertes acceptées, déjà documentées), **installateurs de bureau non signés et non testés** |
| Journaux des runs | ~200 runs (CI, CodeQL, Pages, Dependabot, Desktop build, Release) | lisibles par tous ; ils ne contiennent aucun secret (aucun secret défini, `GITHUB_TOKEN` masqué) |
| Demandes de fusion | 20, toutes de Dependabot | lisibles par tous ; rien de personnel |
| Tickets | aucun | — |
| Branches distantes | `main` et `worktree-agent-ab851763ebd9da010` (branche de vérification, dont un commit « TEMPORAIRE ») | lisibles par tous ; sans donnée sensible |
| Description du dépôt | « … tableaux électriques **conformes au RGIE** … » | formulation à revoir : l'application est une **aide à la vérification** (voir les décisions du projet), elle ne certifie pas la conformité |

## 7. Documentation interne

Relu : `docs/adr/*`, `docs/audit/*`, `docs/strategie/*`, `docs/*.md`, `CHANGELOG.md`, `README.md`,
`SECURITY.md`, `PRIVACY.md`.

- Aucune donnée personnelle (nom ou adresse de client, téléphone, e-mail), aucun chemin local, aucun secret.
- Les hypothèses de coût (certificats de signature, domaine, minutes de CI) et les analyses stratégiques
  (`docs/strategie/`) ne posent pas de problème de confidentialité ; elles exposent la feuille de route et les
  arbitrages du projet, ce qui est un choix éditorial du propriétaire, pas un risque.
- Les fichiers de test réels sont mentionnés par leurs noms génériques seulement.
- `SECURITY.md` renvoie au signalement privé de GitHub (*Security → Report a vulnerability*) : la fonction
  *Private vulnerability reporting* doit être **activée** dans les réglages du dépôt une fois public, sinon le
  lien décrit ne fonctionne pas.

## Liste de contrôle GO / NO-GO

| # | Contrôle | Résultat |
|---|---|---|
| 1 | Aucun secret réel dans le code actuel | GO |
| 2 | Aucun secret réel dans l'historique (toutes branches, demandes de fusion comprises) | GO |
| 3 | Aucun fichier de client (`.trik`, `.voltaplan`, photos, PDF) jamais commité | GO |
| 4 | Aucune donnée personnelle dans le contenu | GO |
| 5 | Métadonnées des commits sans e-mail personnel | GO |
| 6 | Configuration sans chemin local ni URL interne | GO (recommandation `.claude/`) |
| 7 | Licences npm compatibles AGPL-3.0-or-later | GO |
| 8 | Licences Rust compatibles AGPL-3.0-or-later | GO |
| 9 | Artifacts et journaux publiables | GO, avec réserve sur les installateurs non signés (expirent d'eux-mêmes) |
| 10 | Documentation interne publiable | GO |

**Éléments bloquants** : aucun.

## Actions recommandées

Avant le passage en public :

1. Ignorer le reste du dossier `.claude/` (`.claude/*` puis `!.claude/launch.json` dans `.gitignore`) — **sans
   risque**.
2. Corriger la description du dépôt (« conformes au RGIE » → « avec aide à la vérification du RGIE ») — **sans
   risque**.
3. Laisser expirer, ou supprimer à la main dans l'onglet Actions, les artifacts d'installateurs non signés
   (`voltaplan-desktop-*`, `voltaplan-linux/-windows/-macos-*`) si l'on ne veut pas qu'ils soient téléchargés
   avant la première release officielle — **destructif (suppression d'artifacts) — validation du propriétaire
   requise** ; sinon ils expirent seuls au plus tard le 24/12/2026.
4. Supprimer la branche distante `worktree-agent-ab851763ebd9da010` si elle n'est plus utile — **destructif —
   validation du propriétaire requise**.

Au moment du passage en public :

5. Activer *Private vulnerability reporting* (Settings → Code security) — **sans risque**.
6. Activer *Secret scanning* et *Push protection* (gratuits pour un dépôt public) — **sans risque**.
7. CodeQL : passer `upload: never` à `upload: always` dans `.github/workflows/codeql.yml` (le code scanning
   devient disponible) — **sans risque**.
8. Sur le compte : *Keep my email addresses private* et *Block command line pushes that expose my email* —
   **sans risque**.
9. Revoir la fréquence des workflows (les minutes des runners standard deviennent gratuites, voir
   [docs/ci.md](../ci.md)) — **sans risque**.

Avant la première release officielle des paquets de bureau :

11. Joindre une notice des licences tierces (npm et Rust, par exemple générée avec `cargo about` ou
    `cargo deny` et un outil équivalent côté npm) aux installateurs — **sans risque**.

À ne pas faire sans décision explicite :

12. Réécriture de l'historique (`git filter-repo`, push forcé) : **inutile aujourd'hui** (aucune donnée à
    retirer) ; **destructif — validation du propriétaire requise** si un jour nécessaire.

## Non vérifié

- Le contenu des journaux des ~200 runs n'a pas été relu ligne à ligne (aucun secret n'étant défini, le risque
  est faible).
- Le contenu des artifacts n'a pas été téléchargé (la version web est la même que celle de Pages ; les paquets
  sont produits par la CI à partir du dépôt).
- Les licences Rust viennent des métadonnées de crates.io (champ `license` de chaque version) et non d'un
  `cargo deny` ; les fichiers `LICENSE` des crates n'ont pas été lus.
