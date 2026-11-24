# Validation par plateforme : hors ligne, stockage, application installée

Date : 2026-11-24. **Seul l'état « testé » prouve quelque chose** ; tout le reste est marqué « non testé ».
Complète [offline.md](offline.md) (fonctionnement) et [desktop-tauri.md](desktop-tauri.md) (application de bureau).

## 1. Trois catégories de fonctions

| Catégorie | Fonctions | Hors ligne |
|---|---|---|
| **A. Entièrement disponibles** | unifilaire, plan de position, tableau, liste du matériel, calculs, contrôle RGIE, dossier imprimé / PDF (impression du navigateur), import et export Trikker, export Eendraadschema, fond de plan depuis une image ou un PDF, détection des murs, calage de la photo du tableau, ouverture et enregistrement de fichiers sur l'appareil, projets du navigateur, versions locales, brouillons, langues | **oui**, dès la première visite (tout est mis en cache à l'installation) |
| **B. Interface disponible, service nécessaire** | IA en ligne (Anthropic, OpenAI, Gemini, Mistral), GitHub, Google Drive, OneDrive, Dropbox | la fenêtre s'ouvre ; l'action est **désactivée ou mise en attente** avec le message « Nécessite une connexion Internet » ; un enregistrement vers ces services est **mis en attente** (gardé dans le navigateur, repris au retour du réseau ou au prochain lancement) |
| **C. Service local** | IA locale (Ollama, LM Studio sur le même ordinateur) | **oui**, si le service tourne sur l'ordinateur ; le bouton de lecture IA reste actif hors ligne dans ce cas |

**Comment l'utilisateur le sait** :

- un repère « Hors ligne » dans la barre, dont l'info-bulle liste ce qui est disponible et ce qui ne l'est pas ;
- le bouton IA grisé, avec l'explication en info-bulle ;
- l'avertissement dans les onglets GitHub et services en ligne ;
- l'état d'enregistrement « En attente d'envoi ».

## 2. Procédure de validation (à dérouler par plateforme)

**Préparation** : ouvrir https://voltaplan.org/app/ (domaine définitif ; l'ancienne adresse
`sebastienbatteur.github.io/voltaplan/` y redirige). Ouvrir un projet d'exemple et l'enregistrer dans le navigateur.

| # | Étape | Résultat attendu |
|---|---|---|
| 1 | Première visite en ligne, attendre 10 s | aucune erreur ; dans les outils de développement (si disponibles), le cache `voltaplan-<version>` contient environ 22 fichiers |
| 2 | Passer en mode avion, recharger | l'application s'affiche ; repère « Hors ligne » |
| 3 | Catégorie A : dessiner un circuit, ouvrir le plan, le tableau, le contrôle, imprimer le dossier en PDF, importer un `.trik`, ajouter un fond de plan PDF | tout fonctionne |
| 4 | Catégorie B : bouton « Lire avec l'IA », onglet OneDrive | désactivé ou avertissement ; aucune erreur brute |
| 5 | Enregistrer un projet ouvert depuis OneDrive, toujours hors ligne | « En attente d'envoi (OneDrive) » ; message clair |
| 6 | Fermer complètement l'application, la rouvrir hors ligne | bandeau « Enregistrement en attente… Reprendre » et/ou « Travail non enregistré retrouvé » |
| 7 | Revenir en ligne, « Reprendre » | envoi fait, état « Enregistré (OneDrive, hh:mm) » |
| 8 | Fichier → Versions locales | les versions apparaissent ; « Ouvrir » charge un nouveau projet |
| 9 | Fenêtre Enregistrer → onglet Navigateur | place utilisée affichée ; « Protégé » après acceptation |
| 10 | Publier une nouvelle version du site pendant que l'application est ouverte | bandeau « Nouvelle version disponible » ; « Recharger » garde les modifications |
| 11 | Ne pas ouvrir l'application pendant 8 jours (Safari seulement) | les projets du navigateur sont toujours là (PWA installée) ; **sinon, noter la perte** |

## 3. État par plateforme

| Plateforme | Installation | 1–2 hors ligne | 3 cat. A | 4–5 cat. B | 6–7 reprise | 9 persistance | 10 mise à jour | 11 éviction | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Chrome Windows | — (onglet) | **testé** (Chrome sans interface, 2026-11-24) | **partiel** : chargement de tous les modules testé ; parcours complet non testé | **testé** par simulation dans le panneau de navigateur | **testé** (simulation, panneau de navigateur) | non testé | **testé** (Chrome sans interface) | sans objet | |
| PWA installée Chrome / Edge Windows | non testé | non testé | non testé | non testé | non testé | non testé | non testé | sans objet | ouverture des `.voltaplan` par double-clic (`file_handlers`) non testée |
| Firefox (Windows, macOS, Linux) | sans objet (pas d'installation PWA sur ordinateur) | non testé | non testé | non testé | non testé | non testé (Firefox peut demander l'autorisation) | non testé | sans objet | pas de File System Access : « Enregistrer » télécharge un fichier |
| Safari macOS | non testé (« Ajouter au Dock », macOS 14 et plus **[à vérifier]**) | non testé | non testé | non testé | non testé | non testé | non testé | non testé | pas de File System Access |
| Safari iOS (onglet) | sans objet | non testé | non testé | non testé | non testé | non testé | non testé | **risque** : éviction après 7 jours sans visite **[à vérifier]** | conseiller l'installation |
| PWA iPhone / iPad (écran d'accueil) | non testé | non testé | non testé | non testé | non testé | non testé | non testé | non testé | stockage séparé de Safari : un projet du navigateur Safari n'est **pas** visible dans la PWA **[à vérifier]** |
| Chrome Android (onglet) | sans objet | non testé | non testé | non testé | non testé | non testé | non testé | sans objet | |
| PWA installée Android | non testé | non testé | non testé | non testé | non testé | non testé | non testé | sans objet | |

« Testé » signifie : vérifié pendant le développement, dans un Chrome sans interface ou dans le panneau de
navigateur de l'outil, souvent par simulation (événement hors ligne, révision IndexedDB modifiée). Ce n'est **pas**
une validation sur un appareil réel.

## 4. Priorités de validation

1. **PWA iPhone** : la plateforme la plus restrictive (stockage, éviction, fichiers, appareil photo).
2. **Chrome Android** et sa PWA : la cible principale du relevé sur chantier.
3. **Safari macOS** et **Firefox** : ils n'ont pas File System Access, donc l'enregistrement se fait par
   téléchargement.
4. **PWA Windows** : ouverture par double-clic.

## 5. Ergonomie tactile (émulation)

Date : 2026-11-24. **Émulation seulement** : panneau de navigateur de l'outil (moteur Chrome), taille d'écran
imposée, agent utilisateur Android et écran tactile simulés (`pointer: coarse`, `hover: none`). Aucun téléphone ni
tablette réels : voir « À vérifier sur appareil » plus bas.

### Ce qui a changé

- **Cibles d'au moins 44 × 44 px au doigt** (`@media (pointer: coarse)` dans `src/styles.css`) : boutons, listes,
  champs (16 px de texte : pas de zoom d'iOS à la saisie), cases et boutons radio (via leur libellé), curseurs, lignes
  de l'arborescence, « ＋ », dépliage, titres et bande de la colonne, séparation à glisser, menus et fenêtres. À la
  souris, rien ne change.
- **Barre d'outils compacte** sous 700 px de large, et sur tablette au doigt jusqu'à 1100 px : deux lignes ;
  « Annuler », « Rétablir », « Mettre à jour », « IA » et la langue dans le menu « ⋯ » ; « Enregistrer » visible ;
  onglets des vues sur une ligne qui défile (l'onglet actif est ramené dans le champ) ; nom du fichier tronqué.
  Raccourcis clavier inchangés.
- **Plan et tableau** : sur petit écran ou tablette au doigt, les réglages sont empilés au-dessus du dessin et
  repliables ; pendant le calage de la photo du tableau, ils restent ouverts.
- **Appui long au doigt** (`src/ui/usePanZoom.ts`, option `holdMenu`) : menu « Ajouter » sur un élément de
  l'unifilaire, « Ajouter ici » sur le fond du plan (iOS n'a pas de clic droit ; sur Android, le menu natif qui
  suit est ignoré pour ne pas l'ouvrir deux fois). Sur un symbole du plan ou un appareil du tableau, l'appui long
  garde son rôle : déplacer la vue. Indications « appui long » au lieu de « clic droit ».
- **Pincement à deux doigts** : zoom autour du milieu des doigts, qui déplacent aussi la vue ; le second doigt
  n'atteint pas les outils (pas de mur ni de déplacement d'élément commencé par erreur).

### Mesure

Script exécuté dans la page : éléments visibles `button`, `input`, `select`, `textarea`, `a[href]`,
`[role=button]`, `summary`, `[role=separator]` (une case à cocher est mesurée par son libellé) ; compte de ceux
dont la zone fait moins de 44 px de large **ou** de haut. Dans une fenêtre, seuls ses éléments sont comptés.
Projet de départ (nouveau projet). Résultat : « petits / total ».

| Vue ou fenêtre | 375 × 812 avant | 375 × 812 après | 767 × 1024 avant | 767 × 1024 après |
|---|---|---|---|---|
| Unifilaire (colonne masquée) | 10 / 16 | 0 / 12 | 16 / 16 | — |
| Unifilaire (colonne ouverte) | 25 / 52 | 0 / 52 | 31 / 52 | 0 / 50 |
| Plan | 19 / 25 | 0 / 22 | 25 / 25 | 0 / 90 (colonne ouverte) |
| Tableau | 13 / 19 | 0 / 16 | 19 / 19 | 0 / 58 (colonne ouverte) |
| Tableau, photo chargée et calage en cours | non mesuré | 0 / 23 | non mesuré | non mesuré |
| Matériel | 8 / 14 | 0 / 10 | 14 / 14 | 0 / 10 |
| Projet | 49 / 55 | 0 / 51 | 55 / 55 | 0 / 51 |
| Contrôle RGIE | 12 / 18 | 0 / 14 | 18 / 18 | 0 / 14 |
| Menu Fichier | 9 / 9 | 0 / 9 | 9 / 9 | 0 / 9 |
| Menu « ⋯ » (nouveau) | — | 0 / 5 | — | — |
| Enregistrer sous | 8 / 8 | 0 / 8 | 8 / 8 | 0 / 8 |
| Versions locales | 1 / 1 | 0 / 1 | 1 / 1 | 0 / 3 |
| Assistant de relevé | 1 / 1 | 0 / 1 | 1 / 1 | 0 / 1 |
| IA | 9 / 11 | 0 / 11 | 11 / 11 | 0 / 11 |
| Ajouter ici (plan, appui long) | non mesuré | 0 / 4 | non mesuré | non mesuré |

Les totaux baissent sur petit écran parce que six commandes de la barre passent dans le menu « ⋯ ». À 767 px, la
colonne était masquée avant la mesure « avant » des vues et ouverte après : comparer la ligne « colonne ouverte ».
La largeur de 767 px est celle où l'outil simule encore un écran tactile ; le préréglage « tablette » (768 × 1024)
simule une souris et garde donc la présentation d'ordinateur.

Autres constats en émulation :

- 375 × 812 : barre d'outils sur **2 lignes** (101 px) au lieu de 3 ; plus de défilement horizontal de la page
  (largeur du document 375 px, contre 391 avant) ; tous les onglets atteignables (défilement de la ligne).
- 767 × 1024 au doigt : barre sur 2 lignes (101 px) au lieu de 3 (157 px avec des boutons de 44 px).
- Tableau à 375 px : réglages (0–105 px sous le titre repliable) puis dessin, sans chevauchement ; pendant le calage,
  réglages de la photo sur 301 px, dessin sur 322 px, indication en bas à gauche, « Ajuster » en bas à droite.
- Gestes simulés par des événements de pointeur « touch » : appui long sur un symbole de l'unifilaire → menu
  « Ajouter » ; appui long sur le fond du plan → fenêtre « Ajouter ici » ; appui bref → sélection, pas de menu ;
  glisser à un doigt → déplacement de la vue ; pincement (doigts de 80 à 240 px d'écart) → vue 3 fois plus proche,
  centre conservé. Mêmes cas en tests automatiques : `test/panZoomTouch.test.tsx`.
- **Ordinateur 1280 × 800 (souris)** : position et taille de chaque élément de l'application relevées dans les six
  vues avant et après : **identiques** (seuls changent des noms de classes et un `span` autour du nom de
  l'application, au même endroit).

### À vérifier sur appareil

- iPhone (Safari et PWA) : appui long sans bulle « copier » ni sélection de texte ; pincement sans zoom de la page
  entière ; pas de zoom à la saisie dans un champ ; liste de langue dans le menu « ⋯ ».
- Android (Chrome et PWA) : un seul menu à l'appui long (le menu natif suivant est ignoré) ; vibration courte.
- Tablette avec clavier ou souris branchés : `pointer: coarse` peut rester vrai (grandes cibles) ; vérifier que
  le clic droit marche toujours.
- Ordinateur à écran tactile : le pointeur principal est la souris, donc présentation d'ordinateur ; le pincement
  marche quand même au doigt.
- Lisibilité au soleil, gants, une main ; rotation de l'écran pendant un geste.
