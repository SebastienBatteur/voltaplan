# Voltaplan

Application **gratuite et open source** de création de schémas électriques — **schéma unifilaire**, **plan de position**, **tableau** — et d'**assistance réglementaire RGIE** (Belgique), pour préparer le dossier d'une installation domestique et son contrôle par un organisme agréé.

**Gratuite, sans publicité, sans compte, sans serveur** : vos projets restent sur votre appareil ou dans votre propre stockage (fichier, OneDrive, Google Drive, Dropbox, GitHub). L'IA est facultative, avec votre propre clé ou un modèle local. Fonctionne hors connexion.

**En ligne** : https://voltaplan.org (guide et application). **Soutenir le projet** (facultatif) : [GitHub Sponsors](https://github.com/sponsors/SebastienBatteur).

> ⚠️ **Aide à la vérification, pas de certification.** Les vérifications RGIE ne remplacent ni le texte officiel du RGIE ni le contrôle par un organisme agréé. « Aucune anomalie détectée » signifie seulement qu'aucune anomalie n'a été trouvée **parmi les règles vérifiées**, avec les informations saisies. Voir [les conditions d'utilisation](https://voltaplan.org/terms.html) et [la politique de confidentialité](https://voltaplan.org/privacy.html).

## Ce qui fonctionne (v0.1)

- **Import Trikker (.trik)** : schéma, plan (murs, portes, fenêtres, escaliers, images de fond, plusieurs pages), adresses, notes. Testé sur des fichiers Trikker 1.5.17, dont un dossier accepté au contrôle.
- **Schéma unifilaire** dessiné automatiquement, **de bas en haut comme la figure 3.1 du RGIE** (alimentation en bas, tableaux, circuits qui montent, points numérotés à partir de la protection) ; option « haut → bas ». Numérotation des circuits A, B, C… et des points A1, A2…, lettres imposées de Trikker respectées.
- **Symboles du RGIE** (Livre 1, tableau 2.23) sur l'unifilaire et le plan : prises (terre, sécurité enfant, multiples, étanches « h »), interrupteurs (unipolaire, bipolaire, va-et-vient, permutateur, gradateur, tirette, lampe témoin, lampe de signalisation), boutons-poussoirs, points lumineux, applique, tube fluorescent, projecteur, éclairage de sécurité, appareils (cuisinière, four, micro-ondes, lave-linge, sèche-linge, lave-vaisselle, frigo, congélateur, chauffe-eau, chauffage, ventilateur, borne VE), moteur, sonnerie, boîte de dérivation, transformateur, panneau solaire, onduleur, disjoncteur (marque du déclencheur), différentiel (tore), fusible, compteur, coffret de branchement, mode de pose des canalisations.
- **Plan de position** à l'échelle (en mm), **lié** à l'unifilaire : cliquer sur un élément le sélectionne partout ; « Voir sur le plan » / « Voir sur l'unifilaire » ; déplacer, pivoter ou retirer un symbole ; placer sur le plan un élément qui n'y est pas encore.
- **Dessin du plan** : murs (angles droits et extrémités accrochés, cote affichée), portes, doubles portes, portes-fenêtres, fenêtres, noms de pièces, plusieurs pages (étages). **Édition** : glisser un mur (les murs raccordés et les ouvertures suivent), ses extrémités, une ouverture le long de son mur, un texte ; panneau de propriétés (longueur, épaisseur, largeur, type, sens d'ouverture). **Mobilier** : catalogue de pictogrammes vectoriels à l'échelle (canapé, fauteuil, tables, meuble TV, lits, armoire, bureau, plan de travail, évier, taque, frigo, lave-linge, baignoire, douche, WC, lavabos, voiture, escalier), à placer, glisser, pivoter, redimensionner et dupliquer. **Fond de plan** importé d'une photo ou d'un PDF, puis **mis à l'échelle** en cliquant deux points et en donnant leur distance réelle. Sans fond de plan, le même outil met **toute la page** à l'échelle (utile pour un plan Trikker dessiné hors échelle). **Redresser (4 coins)** : une photo prise de biais est remise droite et à l'échelle en cliquant les 4 angles d'un rectangle connu (ex. façades 13 × 8,5 m). **Tracer les murs** : détection automatique, sans IA, des murs (façades d'après le rectangle, cloisons foncées), des **portes** (cloisons interrompues de 60 à 130 cm) et des **fenêtres** (parties claires des façades), à vérifier ensuite. **Caler le fond** : superpose une photo sur un plan existant (2 repères) pour repérer les modifications.
- **Édition** : arborescence de l'installation, propriétés (calibre, courbe, différentiel, câble, section, prises, interrupteurs…), ajout, duplication, suppression, réorganisation, annuler / rétablir (Ctrl+Z / Ctrl+Y).
- **Contrôle RGIE** (aide à la vérification, voir [couverture réglementaire](docs/audit/REGULATORY-COVERAGE.md)) :
  - éditions datées (avant 1981, ancien RGIE de 1981, Livre 1 depuis le 1/6/2020), appliquées **partie par partie** (date de réalisation d'un tableau ou d'un circuit) ;
  - statut de chaque constat : non conforme, information manquante, avertissement, à vérifier, recommandation, dérogation ; gravité électrique et caractère bloquant séparés ;
  - partie neuve → non-conformités **bloquantes** ; partie existante → règles de sécurité bloquantes, les autres en **recommandations** ;
  - dérogations saisies avec motif et référence, visibles dans le dossier ;
  - « Local avec baignoire ou douche » indiqué explicitement (le nom de la pièce n'est qu'un indice à confirmer).
- **Langues** : français, néerlandais, anglais, allemand (partiel).
- **Tableau** : rangées DIN (12 ou 13 modules), appareils en glisser-déposer à leur largeur réelle (disjoncteur 1P+N en 1 ou 2 modules, différentiel 2 ou 4 modules…), disposition automatique, réserve, étiquettes. **Photo du tableau** : calage par les 4 coins, comparaison sans IA (largeur et place de chaque appareil), et en option lecture par l'IA (type, calibre, courbe, sensibilité) comparée au matériel défini ; confirmation appareil par appareil.
- **Dossier imprimable / PDF** (A4 ou A3 paysage) : unifilaire (découpé sur plusieurs pages si nécessaire), plans, tableau, liste des circuits, légende automatique des symboles utilisés, étiquettes du tableau à l'échelle 1:1, constats du contrôle. Cartouche sur chaque page : version et date, installateur (nom, qualité, TVA), adresse, tension et nature du courant, EAN, cases de signature installateur / organisme agréé / propriétaire. Mention « PROJET » tant que des constats bloquants restent à traiter.
- **Mesures** : résistance de terre, isolement, liaisons équipotentielles, essai de chaque différentiel (temps de déclenchement, circuits protégés), date et appareil de mesure ; contrôlées (≤ 300 ms, 500 ms pour un « S ») et imprimées sur la page « Mesures » du dossier.
- **Trikker** : import et **export** (.trik, Windows-1252 comme Trikker) ; aller-retour vérifié sur des fichiers réels (schéma, numérotation, plan, pièces, adresses).
- **Hors ligne** : la version web s'installe comme une application (PWA) et fonctionne sans connexion après la première visite.
- **Enregistrement** (comme draw.io) : cet appareil (fichier), navigateur (projets gardés localement + brouillon automatique récupérable), GitHub (dépôt, jeton chiffré localement). Google Drive, OneDrive et Dropbox (identifiant d'application à enregistrer une fois chez chaque service).
- **Sélection en chaîne** : un élément sélectionné allume toute sa chaîne (amont jusqu'au compteur, tout l'aval) dans l'arborescence, l'unifilaire, le plan et le tableau.
- **⟳ Mettre à jour** (nouvelle installation, circuits ajoutés) : nouveaux appareils posés dans le tableau sans déplacer les autres, nouveaux points posés sur le plan près du nom de leur pièce, révision ajoutée au dossier.
- **Liste du matériel** : par caractéristiques et normes européennes (les références fabricant varient d'un pays à l'autre), quantités, longueurs de câble, export CSV, page du dossier.
- **Calculs** : chute de tension et longueur maximale protégée contre les courts-circuits par circuit (méthode conventionnelle IEC 60364).
- **Eendraadschema** : export `.eds` (format v4).
- **Google Drive, OneDrive, Dropbox** : prêts, à activer avec un identifiant d'application par service (voir le guide).
- **Fichiers locaux** : format `.voltaplan` (JSON lisible ; les fichiers `.openrgie` des premières versions, quand l'application s'appelait OpenRGIE, s'ouvrent toujours). Avec Chrome/Edge, « Enregistrer » réécrit le même fichier.

## Utilisation

Prérequis : [Node.js](https://nodejs.org) 20 ou plus.

```powershell
npm install
npm run dev
```

Puis ouvrir http://localhost:5173. Pour une version statique (à copier sur un serveur ou une clé USB) :

```powershell
npm run build
```

Le dossier `dist/` contient l'application complète, sans serveur.

### Application de bureau (Windows, macOS, Linux)

L'application de bureau utilise [Tauri](https://tauri.app) : petit installateur, fenêtre native, enregistrement des fichiers avec la boîte de dialogue du système.

- **Pour l'utilisateur** : télécharger l'installateur depuis la page *Releases* du dépôt GitHub (`.msi` ou `.exe` pour Windows, `.dmg` pour macOS, `.AppImage` / `.deb` / `.rpm` pour Linux).
- **Pour le développeur** : installer [Rust](https://rustup.rs), puis `npm run desktop` (développement) ou `npm run desktop:build` (installateur dans `src-tauri/target/release/bundle`).
- Paquets compilés en CI mais **pas encore testés à l'usage ni signés** : voir [docs/desktop-tauri.md](docs/desktop-tauri.md).

### Intégration continue (GitHub Actions)

| Workflow | Quand | Ce qu'il fait |
|---|---|---|
| `ci.yml` | push sur `main` et pull request qui touchent autre chose que la documentation, chaque semaine, à la demande | Linux : typage, ESLint, tous les tests, construction ; audit des dépendances livrées (`npm audit --omit=dev`) ; la version web est jointe aux runs de `main` |
| `ci-multi-os.yml` | push sur `main` qui touche `src/`, `package*.json` ou `vite.config.ts`, chaque semaine, à la demande | mêmes vérifications sur Windows et macOS |
| `secrets.yml` | chaque push sur `main` et chaque pull request (documentation comprise), chaque semaine | recherche de secrets dans tout l'historique (gitleaks) |
| `codeql.yml` | push sur `main` et pull request qui touchent du code, chaque semaine, à la demande | analyse de sécurité du code (CodeQL) |
| `desktop-build.yml` | pull request et push sur `main` qui touchent `src-tauri/` ou un paquet Tauri, à la demande | construction de l'application de bureau sur les 3 systèmes, sans publication |
| `release.yml` | tag `v*` (ex. `git tag v0.2.0 && git push --tags`) ou lancement manuel | installateurs Windows, macOS (Apple Silicon et Intel) et Linux ; release *brouillon* créée sur GitHub pour un tag |
| `pages.yml` | push sur `main` qui change le site ou l'application | publie le site (accueil + guide, dossier `site/`) et l'application web dans `app/` sur GitHub Pages (à activer une fois : *Settings → Pages → Source : GitHub Actions*) |

Politique de déclenchement et coût en minutes : [docs/ci.md](docs/ci.md).

Les installateurs ne sont pas signés : Windows SmartScreen et macOS Gatekeeper afficheront un avertissement au premier lancement. La signature demande un certificat (payant) à ajouter plus tard dans les secrets du dépôt.

Tests : `npm test` (les fichiers Trikker réels placés dans `test/fixtures/*.trik` sont utilisés s'ils existent ; ils ne sont **pas** publiés car ils contiennent des données personnelles).

## Règles RGIE vérifiées

| Id | Contrôle |
|---|---|
| R-CABLE-PROT | Calibre de la protection ≤ maximum pour la section (1,5 → 16 A, 2,5 → 20 A, 4 → 25 A, 6 → 32 A, 10 → 50 A…) |
| R-CABLE-MIN | Section ≥ 1,5 mm² |
| R-SOCKET-SECTION | Circuits de prises en 2,5 mm² minimum |
| R-SOCKET-MAX | Maximum 8 points de prise par circuit (une prise multiple = 1 point) |
| R-SOCKET-EARTH / R-SOCKET-CHILD | Prises avec terre et sécurité enfant |
| R-DEDICATED-CIRCUIT | Circuit spécialisé : four, cuisinière, taque, lave-linge, sèche-linge, lave-vaisselle, boiler, PAC, borne VE |
| R-RCD-MAIN | Différentiel ≤ 300 mA en tête de chaque circuit |
| R-RCD30 | Différentiel 30 mA : salle de bain/douche, lave-linge, sèche-linge, lave-vaisselle |
| R-RCD-TYPE-A | Type A (pas AC) pour ces appareils |
| R-RCD-SELECTIVITY | Sélectivité entre différentiels |
| R-CABLE-NO-OVERCURRENT | Protection contre les surintensités présente (un interrupteur différentiel seul ne suffit pas) |
| R-EARTH-* / R-INSULATION | Prise de terre présente, résistance ≤ 30 Ω (alerte jusqu'à 100 Ω), isolement ≥ 0,5 MΩ |
| R-*-MISSING | Données obligatoires du schéma manquantes (calibre, sensibilité, section…) |

Les valeurs sont dans [src/rules/be/rgie.ts](src/rules/be/rgie.ts) et les textes dans [src/i18n](src/i18n). **Elles doivent être relues par un professionnel** avant de s'y fier.

## Sens du schéma unifilaire et normes

- Le RGIE (Livre 1, sous-section 3.1.2.1) impose le **contenu** de l'unifilaire (lettre par circuit, numéro d'ordre des points depuis la protection, tension et nature du courant, caractéristiques des canalisations et protections, nom du responsable des travaux, adresse) et les **symboles** du tableau 2.23 ; un symbole absent du tableau peut être utilisé s'il est défini dans une légende.
- Il n'impose pas explicitement de sens de dessin, mais son **exemple officiel (figure 3.1)** est dessiné de bas en haut : c'est la pratique belge (Trikker, Eendraadschema) et le sens par défaut d'Voltaplan.
- Au niveau européen, il n'y a pas de règle commune pour les schémas de « réception » : chaque pays a sa réglementation (RGIE en Belgique, NF C 15-100 en France, NEN 1010 aux Pays-Bas…). Les normes générales sont l'**IEC/EN 60617** (symboles graphiques, dont s'inspire le tableau 2.23) et l'**IEC/EN 61082-1** (règles d'établissement des documents électrotechniques).

## Autres pays européens

Le moteur ne contient aucune règle nationale : il appelle le référentiel choisi dans l'onglet *Projet* (« Pays et réglementation »). Pour ajouter un pays (ex. France NF C 15-100, Pays-Bas NEN 1010, Luxembourg) :

1. créer `src/rules/<pays>/<reglement>.ts` qui exporte un objet `RulePack` (voir [src/rules/types.ts](src/rules/types.ts)) : identifiant, pays, nom, versions, fonction `check(project)`, textes des règles par langue, listes de choix nationales (désignations de câbles…) ;
2. l'ajouter à `RULE_PACKS` dans [src/rules/index.ts](src/rules/index.ts).

Rien d'autre à modifier : l'unifilaire, le plan, le contrôle et (bientôt) l'export s'adaptent. Un test montre qu'un référentiel de démonstration se branche ainsi ([test/rules.test.ts](test/rules.test.ts)).

## Architecture

- `src/model` : modèle de données (arbre de nœuds + plan référant les nœuds par id).
- `src/import/trikker.ts` : import Trikker (attributs d'origine conservés pour un futur export sans perte).
- `src/rules` : **référentiels par pays** (contrat `RulePack`, registre). `src/rules/be/rgie.ts` = Belgique (RGIE), fonctions pures et testées.
- `src/unifilar` : mise en page automatique et symboles SVG (tableau 2.23 du RGIE).
- `src/plan` : géométrie du plan (accroche, ouvertures, mise à l'échelle).
- `src/io` : fichiers (navigateur et application de bureau), fond de plan photo/PDF (pdf.js).
- `src-tauri` : application de bureau.
- `.github/workflows` : tests et paquets installables.
- `src/ui` : interface React.
- TypeScript + React + Vite, état avec zustand. Peu de dépendances, pour que le projet reste facile à maintenir.

## Feuille de route

1. ✅ Unifilaire + import Trikker
2. ✅ Plan : dessin des murs, portes et fenêtres, fond de plan photo/PDF mis à l'échelle (2 points + cote) ; ✅ symboles du RGIE ; ✅ unifilaire de bas en haut
3. ✅ Tableau : rangées DIN, glisser-déposer, photo et validation du matériel, étiquettes 1:1
4. ✅ Export PDF / impression du dossier (A4, A3 : cartouche, légende, circuits, mesures, étiquettes 1:1)
5. ⏳ Assistant de relevé : ✅ premier parcours (photo du tableau → brouillon, questions, relevé figé) ; ⏳ plusieurs photos et tableaux, documents existants, plans d'architecte, plan de position. IA facultative (votre clé, ou un modèle local)
6. ✅ Export Trikker ; ✅ PWA hors ligne ; ✅ version de bureau Tauri et workflows de paquets — ⏳ Eendraadschema (format à étudier)
7. ⏳ Stockage en ligne (Google Drive, OneDrive, Dropbox), avant la première bêta publique :
   - séance de validation réelle : conflits concurrents, coupures réseau, expiration des sessions, iOS ;
   - **R2** (développé et vérifié en réel le 2026-11-25) : repère discret proposant de se reconnecter en un clic avant l'expiration de la session ;
   - **R3** (à décider après les essais réels et l'analyse de sécurité) : renouvellement de session sans fenêtre pour OneDrive et Dropbox, jeton gardé en mémoire seulement.
   Détails : [docs/oauth-jetons.md](docs/oauth-jetons.md).

## Projets proches

- [Eendraadschema](https://github.com/igoethal/eendraadschema) (GPL, belge, AREI) : unifilaire + plan de situation dans le navigateur.
- [QElectroTech](https://qelectrotech.org) (GPL) : schémas électriques généralistes, sans règles RGIE.
- Trikker : gratuit mais pas open source.

## Contribuer

Contributions bienvenues : code, **signalement d'une règle RGIE incorrecte**, traductions, tests sur de vraies installations (sans données de clients). Voir [CONTRIBUTING.md](CONTRIBUTING.md). Les commits sont signés selon le DCO (`git commit -s`).

## Soutenir Voltaplan

Voltaplan est et restera **entièrement gratuit**, sans fonction réservée. Un don est **facultatif** et ne débloque rien : il aide à couvrir le temps de maintenance et de relecture réglementaire. [Devenir sponsor sur GitHub](https://github.com/sponsors/SebastienBatteur).

## Sécurité

- **Signaler une faille** : en privé, via l'onglet *Security → Report a vulnerability* du dépôt, jamais dans un ticket public. Détails dans [SECURITY.md](SECURITY.md).
- **Confidentialité** : pas de serveur ni de télémétrie ; les projets restent sur votre appareil, et rien n'est envoyé à un service (IA, GitHub, Drive, OneDrive, Dropbox) sans votre action. Détails dans [PRIVACY.md](PRIVACY.md).
- Politique de sécurité du contenu (CSP) stricte, taille maximale des fichiers importés, clé d'IA et jeton GitHub chiffrés localement ; dépendances suivies par Dependabot.

## Licence

Copyright (C) 2026 Sébastien Batteur and Voltaplan contributors.

[GNU AGPL, version 3 uniquement](LICENSE) (`AGPL-3.0-only`), la licence open source la plus stricte. Les versions
publiées avant ce changement, sous `AGPL-3.0-or-later`, le restent pour qui les a obtenues : voir
[docs/legal/license-compliance.md](docs/legal/license-compliance.md).

- toute version modifiée qui est distribuée doit rester sous AGPL, avec son code source ;
- même chose pour une version proposée **en ligne** (service web) : ses utilisateurs doivent pouvoir obtenir le code source modifié.

Les bibliothèques utilisées (React, zustand, zod, pdf.js, Tauri, SDK Anthropic…) gardent leurs licences et leurs mentions (MIT, Apache-2.0, BSD…), compatibles : liste générée à chaque compilation dans `THIRD-PARTY-LICENSES.txt`. Identification des versions et code source correspondant : [docs/architecture/project-identification.md](docs/architecture/project-identification.md).
