# Intégration continue (GitHub Actions) : politique et coût

Date : 2026-11-24. Contexte : les minutes GitHub Actions du dépôt privé sont épuisées (« recent account payments
have failed or your spending limit needs to be increased ») et le propriétaire ne souhaite pas de dépense
supplémentaire. Objectif : dépenser moins de minutes **sans retirer de contrôle nécessaire**.

> Les workflows modifiés n'ont pas pu être exécutés (minutes épuisées) : ils ont été relus et analysés
> (YAML valide, script de décision du job « pertinence » testé en local sur de vrais commits), mais leur
> premier passage réel reste à surveiller.

## Coût des minutes

| Système | Multiplicateur, dépôt privé | Dépôt public |
|---|---|---|
| Linux (`ubuntu-*`) | ×1 [à vérifier] | gratuit (runners standard) |
| Windows | ×2 [à vérifier] | gratuit |
| macOS | ×10 [à vérifier] | gratuit |

Chaque job est **arrondi à la minute supérieure** [à vérifier]. Le quota gratuit mensuel dépend du plan du compte
(ordre de grandeur : 2 000 minutes pour un compte gratuit, 3 000 pour Pro [à vérifier]). Le stockage des
artifacts est aussi décompté sur un dépôt privé.

Durées mesurées sur les derniers runs réussis (API GitHub, 4 runs par workflow) :

| Job | Système | Durée | Minutes facturées (×multiplicateur) |
|---|---|---|---|
| CI `test` | Linux | 1,3 min | 2 |
| CI `test` | Windows | 1,9 min | 2 × 2 = 4 |
| CI `test` | macOS | 0,6 min | 1 × 10 = 10 |
| CI `audit` / `secrets` | Linux | 0,2 min chacun | 1 + 1 |
| CodeQL `analyze` | Linux | 5,1 min | 6 |
| Pages `build` + `deploy` | Linux | 1,0 + 0,3 min | 2 |
| Desktop build | Linux / Windows / macOS | 6,3 / 9,2 / 2,9 min | 7 + 20 + 30 = 57 |
| Release | Linux / Windows / macOS ×2 | 5,5 / 6,4 / 3,1 / 3,1 min | 6 + 14 + 40 + 40 = 100 |

Avant ce changement, **chaque** push sur main et **chaque** mise à jour de demande de fusion (y compris
Dependabot, y compris un simple changement de documentation) coûtait environ 18 minutes de CI + 6 de CodeQL
(+ 2 de Pages sur main), dont 10 pour le seul job macOS.

## Règles

### Ce qui tourne à chaque modification du code (Linux, ×1)

`ci.yml`, sur push vers main, demande de fusion, chaque lundi et à la demande :

- `npm ci` avec cache npm (`actions/setup-node`, `cache: npm`) ;
- `npm run typecheck`, `npm run lint`, **tous** les tests Vitest (`npm test`, dont la matrice réglementaire
  `test/rules.matrix.test.ts` : jamais filtrés ni réduits), `npm run build` ;
- `npm audit --audit-level=high --omit=dev` (dépendances livrées) ; la planification hebdomadaire détecte les
  vulnérabilités publiées entre deux modifications ;
- l'artifact `voltaplan-web` (dossier `dist`) n'est plus déposé que sur main et en lancement manuel, gardé
  7 jours (au lieu de 14 jours à chaque run, demandes de fusion comprises).

### Documentation seule : pas de tests

`ci.yml` ignore un push / une demande de fusion dont **tous** les fichiers sont dans `docs/**`, `**/*.md`,
`site/**` ou `LICENSE` (`paths-ignore`). Dès qu'un seul autre fichier change (changement mixte), tout tourne.
`src-tauri/` n'est **pas** ignoré : `test/csp.test.ts` lit `src-tauri/tauri.conf.json`.

### Windows et macOS : seulement quand c'est utile

`ci-multi-os.yml` (mêmes étapes que `ci.yml`, sur Windows et macOS) tourne :

- sur un push vers main qui touche `src/**`, `package.json`, `package-lock.json`, `vite.config.ts` ou ce
  workflow ;
- chaque lundi (dérive des images de runners, de Node, de npm) ;
- à la demande (onglet Actions → « CI multi-OS » → *Run workflow*, sur n'importe quelle branche : c'est le moyen
  de vérifier une branche à risque avant fusion).

Justification : les différences de système (chemins, fins de ligne, casse, binaires natifs de npm) concernent
le code livré et les dépendances ; elles sont rares, et les tests ne dépendent pas du système dans l'immense
majorité des cas. Une régression propre à Windows ou macOS est donc détectée **au plus tard au push sur main**
(ou le lundi suivant), pas avant la fusion. C'est le seul compromis de cette politique ; il est assumé pour une
application web dont la cible principale est le navigateur. Les demandes de fusion ne lancent pas cette
matrice (Dependabot en ouvre plusieurs par semaine).

### Sécurité

- **Secrets** (`secrets.yml`, gitleaks sur tout l'historique) : sur chaque push vers main et chaque demande de
  fusion **sans filtre de chemins** (une clé collée dans la documentation doit être vue), chaque lundi et à la
  demande. Coût : 1 minute Linux.
- **CodeQL** (`codeql.yml`) : push vers main et demandes de fusion qui touchent du code JavaScript / TypeScript /
  HTML, `package*.json`, le workflow ou `.github/codeql-accepted.txt` ; chaque lundi sur tout le code ; à la
  demande. Pas sur un changement de documentation seule. Le contrôle des alertes acceptées est inchangé.
- **Audit npm** : voir plus haut (`ci.yml`, y compris le lundi).
- **Dependabot** : inchangé (`.github/dependabot.yml`). Ses propres runs (« Dependabot Updates », ~1 à 2 min Linux)
  sont lancés par GitHub et ne dépendent pas de ces workflows.

### Application de bureau

- `desktop-build.yml` : demandes de fusion **et** push vers main qui touchent `src-tauri/**`, `package.json`,
  `package-lock.json` ou ce workflow, plus le lancement manuel. Cache Rust (`swatinem/rust-cache`) conservé.
  Un premier job Linux (« pertinence », quelques secondes) lance la construction sur les trois systèmes seulement
  si `src-tauri/` ou le workflow ont changé, ou si la modification de `package*.json` touche un paquet Tauri
  (ligne ajoutée ou retirée contenant « tauri ») ; un lancement manuel construit toujours. Une mise à jour
  Dependabot d'une autre dépendance (zustand, outils de développement…) n'entraîne donc pas les ~57 minutes
  d'une construction native.
- `release.yml` : **portée inchangée** (4 cibles sur tag `v*` ou lancement manuel). Ajouts : `timeout-minutes`
  et une concurrence **sans annulation** (une release brouillon interrompue serait incomplète).

### Annulation des exécutions dépassées (`concurrency`)

| Workflow | Groupe | Annulation de l'exécution en cours |
|---|---|---|
| CI, Secrets, CodeQL | workflow + numéro de demande de fusion ou branche | oui pour une demande de fusion ou une branche ; **non sur main** (chaque commit de main garde un résultat ; les exécutions en attente sont remplacées par la plus récente) |
| CI multi-OS | workflow + branche | non sur main, oui ailleurs |
| Desktop build | demande de fusion ou branche | oui pour une demande de fusion, non sur main |
| Pages | `pages` | **non** : interrompre `deploy-pages` en plein déploiement peut laisser le site dans un état intermédiaire ou faire échouer la publication suivante (recommandation de GitHub). Les publications en attente sont remplacées par la plus récente. |
| Release | tag | **non** |

### Pages

`pages.yml` publie sur push vers main sauf si **tous** les fichiers modifiés sont dans `docs/**`, `**/*.md`,
`test/**`, `src-tauri/**` ou `.github/**` (hors `pages.yml` lui-même). Un changement de `site/**`, du code de
l'application (`src/**`, `public/**`, `index.html`), des dépendances ou de la configuration de construction
publie donc toujours. La construction de Pages garde `npm test` comme garde-fou avant publication.

### Garde-fous de durée (`timeout-minutes`)

| Job | Limite |
|---|---|
| CI `test` (Linux) | 15 min |
| CI `audit` | 5 min |
| CI multi-OS | 25 min |
| Secrets | 10 min |
| CodeQL | 30 min |
| Pages `build` / `deploy` | 15 / 10 min |
| Desktop « pertinence » / construction | 5 / 60 min |
| Release | 90 min |

Sans limite, un job bloqué tourne jusqu'à 6 heures (360 minutes, soit 3 600 minutes facturées sur macOS
[à vérifier]).

## Économies estimées

Par événement (minutes facturées pondérées, d'après les durées mesurées ci-dessus) :

| Événement | Avant | Après |
|---|---|---|
| Demande de fusion qui touche le code | 18 (CI) + 6 (CodeQL) = 24 | 2 + 1 (audit) + 1 (secrets) + 6 = **10** |
| Demande de fusion de documentation seule | 24 | 1 (secrets) |
| Push sur main, code de l'application | 24 + 2 (Pages) = 26 | 10 + 14 (multi-OS) + 2 = **26** |
| Push sur main, tests ou outils seulement (`test/**`, `eslint.config.js`…) | 24 (+ 2 Pages) | 10 |
| Push sur main, documentation seule | 24 + 2 = 26 | 1 |
| Push sur main, `site/**` seul | 26 | 1 + 2 (Pages) + 6 (CodeQL si HTML/JS) = 9 |
| Mise à jour Dependabot npm sans paquet Tauri (desktop-build déclenché par `package-lock.json`) | 24 + 57 | 10 + 1 (« pertinence ») |
| Chaque lundi (planifié) | 6 (CodeQL) | 4 (CI + secrets) + 14 (multi-OS) + 6 (CodeQL) = 24 |

Sur l'activité observée (environ 2 jours, 73 runs de CI dont 27 demandes de fusion, 53 CodeQL, 45 Pages,
3 desktop, 2 release ; 11 des 57 commits de main ne touchent que la documentation, 41 touchent `src/` ou les
dépendances) : environ **2 100** minutes pondérées avant (CI 1 314, CodeQL 318, Pages 90, desktop 171,
release 200), environ **1 550** après (≈ −25 %) : les demandes de fusion passent de 24 à 10 minutes, la
documentation seule de 24-26 à 1. Le poste principal restant est la matrice multi-OS sur main (~14 minutes par
push de code, dont 10 pour macOS, soit ~460 minutes sur la période) : la limiter au lundi et au lancement manuel
ramènerait le total vers **1 100** (≈ −48 %). Ces chiffres sont des ordres de grandeur (arrondis par job,
multiplicateurs [à vérifier], activité de deux journées très chargées).

Leviers supplémentaires, **non appliqués** (au choix du propriétaire) :

- grouper les pushes sur main (moins de pushes, moins de runs multi-OS : la concurrence ne regroupe que ceux en
  attente) ;
- limiter la matrice multi-OS au lundi et au lancement manuel (−14 minutes par push de code) ;
- **rendre le dépôt public** : les runners standard deviennent gratuits, toutes les vérifications peuvent alors
  retrouver leur fréquence d'origine (voir `docs/audit/PUBLICATION-AUDIT.md`).

## Limites connues

- Un workflow ignoré par un filtre de chemins ne rapporte aucun statut. Si la branche main est un jour protégée
  avec des « required status checks », un check filtré resterait « en attente » sur une demande de fusion de
  documentation : il faudra alors un job toujours présent (ou les règles de rulesets qui tolèrent l'absence).
  Aujourd'hui, main n'est pas protégée.
- `ci-multi-os.yml` ne tourne pas sur les demandes de fusion : une régression propre à Windows ou macOS
  apparaît après fusion (au plus tard le lundi suivant), sauf lancement manuel sur la branche.
- Le job « pertinence » de `desktop-build.yml` se base sur le texte du diff (`tauri`) : une dépendance qui
  casserait la construction native sans contenir « tauri » ne serait vue qu'au prochain changement de
  `src-tauri/`, au lancement manuel ou à la release (qui teste les 4 cibles).
