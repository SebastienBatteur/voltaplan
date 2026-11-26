# Outils concurrents et améliorations possibles — novembre 2026

Recherche du 26 novembre 2026 sur les sites publics des éditeurs, les fiches de l'App Store et des forums
belges (bricozone, bouwinfo). **Rien n'a été testé dans les applications elles-mêmes** : ce sont les
descriptions des éditeurs. Les prix sont ceux affichés ce jour-là et peuvent changer.

## 1. Les outils

| Outil | Modèle | Plateformes | Compte | Données | Points saillants |
| --- | --- | --- | --- | --- | --- |
| **Volter** (volter.be) | 19 €/mois ; équipe 29 € ; IA +10 € | Web | Oui | Serveur de l'éditeur (Firebase) | DXF, étiquettes QR, matériel par pièce, IA photo/PDF ; ni enregistrement ni PDF sans abonnement |
| **Amperio** (amperio.be) | Pro 39 € HTVA/mois ; particulier 29 € une fois (1 chantier) ; essai 7 jours | Web | Oui (inscription) | « Hébergées dans l'UE » | Dictée vocale, IA qui reconstruit un schéma depuis un PDF ou une photo, 240+ symboles, PV et domotique, gestion de chantier (tâches, planning, photos), outils gratuits (section de câble, va-et-vient), exemple de dossier PDF téléchargeable |
| **Condui** (condui.be) | Gratuit en local (PDF avec filigrane) ; 20 €/projet ; 30 €/mois ; équipe 45 €/mois | Web installable | Non en local, oui pour le nuage | Navigateur ou nuage de l'éditeur | Import Trikker, partage par lien ou QR, historique des versions (nuage), date d'installation des composants, off-grid et batterie, modèles, EN/NL/FR/DE |
| **Tricity** (Netwalk) | 34,99 $ + abonnements in-app | iPad, Mac | Non indiqué | « Aucune donnée collectée » | Domotique (Niko, KNX, Bticino), solaire, bornes, AREI 2026, nomenclature, plan depuis JPG/PDF |
| **Schneider eDesign**, **ABB EasyPro** | Gratuits | Web | Oui | Éditeur | Tableaux et devis avec les produits de la marque |
| **PlanElec** (planelec.be) | « Sketch » gratuit (PDF avec filigrane « Aperçu ») ; pass site 10 € par bien (15 € après 2026) ; abonnement 24 €/mois (29 € après 2026), 3 places, +12 €/place ; essai Pro 1 mois | Web | Facultatif pour Sketch, oui pour Pro | Nuage de l'éditeur ; Sketch dans le navigateur | Ouvre les .trik et les archives Trikker, plusieurs étages, tableau sur rails DIN avec bornes et barres N/PE, KNX (export ETS), tracé des câbles et chute de tension, PV (strings, MPPT, PVGIS, liste Synergrid), profils de charge Fluvius, 3D et étude d'éclairage, IA (plan, photo de tableau, dictée, réponses sourcées du RGIE), MCP, QR « vérifier le document » |
| **Draadwijs** (draadwijs.be, YSM SComm, Beringen) | Démo gratuite (3 circuits, 3 différentiels, 1 page de plan, filigrane) ; Pass Projet 29 € HTVA par habitation (5 pour 99 €), 18 mois ; Pro 29 €/mois ou 299 €/an HTVA ; gratuit pour l'enseignement ; crédit IA en plus (10 conversions 10 €) | Web installable (hors ligne) | Non pour la démo | Sur l'appareil ; nuage chiffré avec Pass ou Pro | « RGIE Livre 1 version 07 », 70+ règles avec article, « Pourquoi ? » et bouton qui corrige, volumes de salle de bain, assistant habitation, placement automatique sur le plan, ouvre les .trik, photo d'un schéma papier → schéma (IA), chute de tension et courant de court-circuit, devis, étiquettes, dossier de contrôle, « garantie contrôle » (remboursement) |
| **Trikker** | Licence payante | Windows | — | Local | Référence historique ; plan et unifilaire liés |
| **QElectroTech** | Gratuit, open source | Windows, macOS, Linux | Non | Local | Dessin électrique généraliste, sans règles RGIE |

Sources : amperio.be (accueil, /tarifs, /schema-unifilaire) ; condui.be et /nl/pricing ; fil bouwinfo
« Condui.be – logiciel gratuit » ; apps.apple.com/app/id1044577046 (Tricity) ; se.com (eDesign) ;
volter.be (analyse du 25 novembre) ; planelec.be/fr/pricing (tableau des fonctions, 26 novembre) ; draadwijs.be/fr (accueil et tarifs, 26 novembre) ; forums bricozone et circuitsonline.

## 2. Où se situe Voltaplan

**Ce que Voltaplan est seul à réunir** : entièrement gratuit et open source (AGPL), **sans compte**, **sans
filigrane**, fonctionne **entièrement hors ligne** (dessin, contrôle, PDF), fichiers chez l'utilisateur ou dans
son propre nuage (Drive, OneDrive, Dropbox, GitHub), application de bureau Windows/macOS/Linux en plus du web.

**Ce que d'autres ont aussi** : l'import Trikker (Condui l'a également), le contrôle RGIE pendant la saisie
(tous), les étiquettes QR (Volter, Condui — chez eux hébergées par l'éditeur).

**Déjà présent dans Voltaplan, à mieux faire connaître** : versions locales (20 dernières par projet), date d'installation
d'une protection ou d'un tableau, panneaux solaires et onduleur, domotique, bornes de recharge (type
d'appareil), calculs de chute de tension et de court-circuit, IA facultative avec la clé de l'utilisateur.

## 3. Écarts et améliorations

Classées par intérêt pour l'utilisateur, avec la faisabilité **dans la philosophie** (sans serveur, sans compte,
sans télémétrie, sans dépense).

| # | Amélioration | Vu chez | Intérêt | Faisabilité | Effort | Décision proposée |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | **Modèle de départ « maison type »** dans l'assistant : tableau, différentiels, circuits courants déjà en place, à adapter | Condui (modèles) | Fort pour les débutants | Oui, local | Petit | **Fait cette nuit** (branche `nuit`) |
| A2 | **Exemple de dossier PDF** téléchargeable sur le site, fait avec un projet fictif | Amperio | Fort pour convaincre | Oui (fichier statique) | Petit | À faire après validation du rendu du dossier |
| A3 | **Outils gratuits en accès direct** depuis le site (section de câble, chute de tension) | Amperio | Moyen (visibilité) | Oui : lien vers l'onglet calculs | Petit | Proposé |
| A4 | **Batterie domestique, off-grid, commutateur de secours** | Condui, Tricity, Amperio | Moyen, en hausse | Le tableau 2.23 du RGIE (p. 56–57) n'a **pas de symbole de batterie**, mais il a « Redresseur/Onduleur AC ↔ DC » et « Hacheur DC → DC » | Petit | **Fait cette nuit** : type de convertisseur (DC → AC, AC ↔ DC, DC → DC) avec les symboles officiels ; la batterie se note en « Autre » sous le convertisseur. Commutateur de secours : à discuter |
| A5 | **IA : reconstruire un unifilaire depuis un PDF ou une photo** d'un ancien schéma | Amperio, Volter | Fort pour les installations existantes | Oui avec la clé de l'utilisateur (même chemin que la photo de tableau) | Moyen | Proposé, après essais réels de l'IA photo |
| A6 | **Dictée vocale** (« ajoute un différentiel 30 mA ») | Amperio | Moyen sur chantier | **Problème** : la reconnaissance vocale de Chrome envoie l'audio à Google. Possible seulement si le traitement reste sur l'appareil, ou via la clé IA de l'utilisateur, avec un avertissement clair | Moyen | En attente : contraire à la philosophie tel quel |
| A7 | **Domotique détaillée** (Niko Home Control, KNX : modules, actionneurs) | Tricity | Moyen | Oui ; à cadrer (ce que l'organisme agréé demande vraiment) | Moyen | À discuter |
| A8 | **Gestion de chantier** (tâches, planning, photos) | Amperio | Faible pour le dossier RGIE | Oui en local, mais élargit beaucoup le produit | Grand | Non : rester centré sur le dossier |
| A9 | **Travail en équipe** | Volter, Condui, Amperio | Moyen | Déjà possible par un dossier partagé (Drive, OneDrive) avec gestion des conflits ; à **documenter** | Petit (guide) | Proposé |
| A10 | **Guide RGIE questions/réponses** avec renvoi aux articles | Amperio | Fort, mais risqué | Seulement à partir du texte officiel (PDF Livre 1), relu par vous ; jamais de référence inventée | Moyen | À faire avec vous |
| A11 | **Allemand complet** | Condui | Faible (Communauté germanophone) | Oui (traduction partielle existante) | Moyen | Plus tard |
| A12 | **Page « Pourquoi Voltaplan »** sur le site : gratuit, sans compte, hors ligne, sans filigrane | — | Fort (visibilité) | Oui | Petit | Proposé (sans nommer de concurrent) |
| A13 | **Guides NL et EN** à jour des nouveautés | — | Moyen | Oui | Petit | À faire |

### PlanElec (ajouté le 26/11/2026, d'après sa page de tarifs)

Concurrent le plus complet à ce jour, en accès anticipé depuis l'automne 2026 (formules payantes depuis le 2/11).
Même idée d'entrée gratuite que Voltaplan (« Sketch » sans compte, circuits illimités), mais **PDF avec
filigrane** sans pass site ni abonnement, et autocontrôle RGIE, tableau et IA réservés aux formules payantes.

| N° | Idée vue chez PlanElec | Intérêt | Compatible Voltaplan (local, gratuit, sans compte) | Effort | Proposition |
| --- | --- | --- | --- | --- | --- |
| P1 | **Équipement standard selon le type de local** (une chambre reçoit ses prises et son point lumineux) | Fort, gain de temps | Oui, règles locales ; à relier au catalogue des pièces | Moyen | Proposé |
| P2 | **Longueurs de câbles depuis le tracé** sur le plan (le long des murs, par le plafond, changement d'étage) puis chute de tension | Fort | Oui (le plan est à l'échelle) | Grand | Proposé, après l'échelle des plans importés |
| P3 | **Tableau : bornes, barres N et PE, proposition de coffret** selon l'encombrement et la réserve | Moyen | Oui (le rangement automatique existe déjà) | Moyen | À discuter |
| P4 | **Liste Synergrid C10/26** des onduleurs et calculateur de section public | Moyen | Oui si la liste publique peut être reprise (licence à vérifier) | Petit | À vérifier |
| P5 | **PV : strings, MPPT, prévision PVGIS, profils Fluvius, taille de batterie** | Moyen, en hausse | PVGIS est un service en ligne (appel externe, à signaler) ; le reste en local | Petit (lien) | **Décision du 26/11** : pas de calcul PV avancé dans Voltaplan ; un lien « Étude photovoltaïque détaillée » renvoie vers le site de l'auteur (SBG Energy, adresse exacte à confirmer). Lien ouvert seulement au clic, dans un nouvel onglet, sans aucune donnée du projet dans l'adresse ; la batterie existe maintenant comme élément |
| P6 | **KNX : adresses et export ETS** | Faible à moyen | Oui en local | Grand | Non pour l'instant (A7) |
| P7 | **3D et étude d'éclairage** | Faible pour le dossier RGIE | Oui (WebGL) mais très lourd | Très grand | Non |
| P8 | **QR « vérifier le document »** (origine et état du PDF) | Moyen | Sans serveur : empreinte du PDF dans le QR, vérifiable dans Voltaplan | Moyen | À discuter |
| P9 | **Connexion d'un assistant IA personnel par MCP** | Moyen (utilisateurs avancés) | Oui : serveur MCP local sur le fichier ouvert (bureau) | Moyen | À discuter |
| P10 | **Liste des circuits** exportée | Moyen | Oui | Petit | Proposé |

**Ce que Voltaplan garde d'avance sur PlanElec** : tout est gratuit, y compris le contrôle RGIE, le tableau et les
PDF **sans filigrane** ; aucun compte ni serveur de l'éditeur ; hors ligne complet ; application de bureau ;
code ouvert ; lecture locale des photos sans IA (OCR) ; import **Volter** en plus de Trikker ; IA facultative avec
la clé de l'utilisateur, sans quota imposé.

### Draadwijs (ajouté le 26/11/2026, d'après sa page d'accueil)

Le plus proche de Voltaplan dans l'esprit : centré sur le dossier pour le contrôleur, contrôle RGIE pendant le
dessin, hors ligne, projets sur l'appareil. Mais la démo gratuite est bridée (3 circuits, 1 page, filigrane) et
tout dossier réel est payant (29 € par habitation).

| N° | Idée vue chez Draadwijs | Intérêt | Compatible Voltaplan | Effort | Proposition |
| --- | --- | --- | --- | --- | --- |
| D1 | **Bouton « corriger » sur chaque remarque du contrôle** (« Choisir 20 A », « Circuit dédié », « Câble Cca ») | Très fort | Oui ; existe déjà pour la date 2023, à généraliser aux règles où la correction est sans ambiguïté | Moyen | **Proposé en priorité** |
| D2 | **« Pourquoi ? »** : chaque règle expliquée en mots simples, avec l'article | Fort (particuliers, étudiants) | Oui, à partir du PDF officiel uniquement, relu par vous | Moyen | Proposé (rejoint A10) |
| D3 | **Volumes de la salle de bain** dessinés autour de la baignoire ou de la douche, et chaque appareil vérifié par volume | Fort | Oui : le plan et le mobilier existent ; règles 7.01 à lire dans le PDF | Moyen à grand | Proposé |
| D4 | **Placement automatique des points dans leur pièce** (prises au mur, interrupteurs près de la porte, lampes au centre) | Fort | Oui (pièces et emplacements connus) | Moyen | Proposé (avec P1) |
| D5 | **Insertion intelligente** : interrupteur croisé placé entre deux va-et-vient, nouveau circuit avec le câble du précédent, pièce reprise d'un point à l'autre | Moyen à fort | Oui | Petit à moyen | Proposé |
| D6 | **Liste « Prêt pour le contrôleur »** (8 points, chacun avec un bouton qui y mène) | Fort | Oui ; l'assistant a déjà les données manquantes | Petit | Proposé |
| D7 | **Courant de court-circuit par circuit** avec les longueurs du plan | Moyen | Oui (calculs existants + longueurs, voir P2) | Moyen | Plus tard |
| D8 | **Source de secours / inverseur** : contrôle aussi quand seule la source de secours alimente | Moyen, en hausse (batteries) | Oui | Moyen | À discuter |
| D9 | **Recherche multilingue** dans la palette (« stopcontact » trouve la prise) | Petit mais agréable | Oui | Petit | Proposé |
| D10 | **Base de connaissances** (articles sur le schéma, le contrôle à la vente, les erreurs fréquentes) | Fort pour être trouvé | Oui (site statique) ; références RGIE vérifiées dans le PDF | Moyen | À faire avec vous |
| D11 | **Version du RGIE affichée** (« Livre 1, version 07 ») | Confiance | Oui : rejoint la question en attente sur les versions 2022, 2025 et 2026 | Petit | En attente de votre réponse |

Non retenus : la « garantie contrôle » remboursée (engagement commercial, sans objet pour un outil gratuit) et le
service payant de transfert de schémas.

**Ce que Voltaplan garde d'avance sur Draadwijs** : complet et gratuit, sans limite de circuits ni filigrane ;
aucun compte ; import Volter ; lecture des photos de compteur, de plan et de tableau sans IA ; IA avec la clé de
l'utilisateur, sans crédit à acheter ; code ouvert ; application de bureau.

## 4. Ce qu'on ne copie pas, et pourquoi

- **Compte obligatoire, nuage de l'éditeur, abonnement** : contraire au projet ; le nuage reste celui de
  l'utilisateur.
- **Filigrane ou limite de projets en gratuit** : Voltaplan n'en a pas et n'en aura pas.
- **Sélection de produits d'une marque** (eDesign, EasyPro) : Voltaplan désigne le matériel par ses
  caractéristiques et sa norme, avec une référence fabricant facultative.
- **Ping d'usage quotidien** (Volter) : aucune télémétrie.

## Fichiers de sauvegarde des concurrents (recherche du 26/11/2026)

Sources : sites et documentation des éditeurs, code source public d'Eendraadschema. Aucun fichier réel examiné.

| Logiciel | Fichier de sauvegarde | Format connu ? | Lecture par Voltaplan |
| --- | --- | --- | --- |
| Trikker | `.trik` | Oui | **Fait** (import) |
| Eendraadschema (logiciel libre) | `.eds` | **Oui, code public** (github.com/igoethal/eendraadschema, `src/importExport/importExport.ts`) : en-tête `EDS0040000` + base64 d'un JSON compressé (deflate, pako), ou `TXT0040000` + JSON non compressé ; versions 1 à 4 | **Fait** (`src/import/eendraadschema.ts`, 2026-11-26) : lecture native (`DecompressionStream`), sans dépendance ; versions 3 et 4 complètes, versions 1 et 2 pour les propriétés principales |
| Condui | `.zip` « projet téléchargé » (données du projet + fonds de plan) ; PDF « éditable » contenant le projet (premium nuage) | Non publié (docs.condui.be : ZIP, contenu non décrit) | Possible après examen d'un **fichier d'exemple** (projet local gratuit, sans compte) |
| Volter | `.vschema` (« Back-up importeren ») | **Examiné le 26/11** sur 5 projets d'essai : JSON lisible, non compressé (voir `FORMAT-VOLTER.md`) | **Fait** (import, dans `main`) |
| PlanElec | Sketch : export `*.planelec.json` (« format » planelec-sketch, « version » 2 : schéma en arbre, plan en m, symboles sur feuille à 1:50) ; ouvre les `.trik` | **Examiné le 26/11** sur 3 exports d'essai | **Fait** (import) |
| Draadwijs | `.draadwijs` (JSON, « version » 3, clés en néerlandais) : schéma en arbre, plan en cm, mesures, devis ; ouvre aussi les `.trik` | **Examiné le 26/11** sur 4 projets d'exemple | **Fait** (import) |
| 1draad | Cité par Draadwijs comme « autre logiciel » | Non examiné | Inconnu |
| Amperio | « exportable à tout moment », format non indiqué ; import seulement PDF/photo | Non | Inconnu ; essai de 7 jours avec compte |
| Tricity | Non indiqué (app iPad/Mac payante) | Non | Inconnu |
| QElectroTech | `.qet` (XML) | Oui (logiciel libre) | Faisable mais peu utile : schémas industriels, pas de dossier RGIE |

Lire le fichier qu'un utilisateur a lui-même enregistré, pour l'interopérabilité, ne copie pas le code de
l'éditeur ; vérifier tout de même les conditions d'utilisation de chaque service avant de publier un import.
Les fichiers d'exemple doivent être des projets fictifs (jamais de données de clients dans le dépôt).
