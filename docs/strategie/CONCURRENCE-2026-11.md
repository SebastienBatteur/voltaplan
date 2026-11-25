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
| **Trikker** | Licence payante | Windows | — | Local | Référence historique ; plan et unifilaire liés |
| **QElectroTech** | Gratuit, open source | Windows, macOS, Linux | Non | Local | Dessin électrique généraliste, sans règles RGIE |

Sources : amperio.be (accueil, /tarifs, /schema-unifilaire) ; condui.be et /nl/pricing ; fil bouwinfo
« Condui.be – logiciel gratuit » ; apps.apple.com/app/id1044577046 (Tricity) ; se.com (eDesign) ;
volter.be (analyse du 25 novembre) ; forums bricozone et circuitsonline.

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

## 4. Ce qu'on ne copie pas, et pourquoi

- **Compte obligatoire, nuage de l'éditeur, abonnement** : contraire au projet ; le nuage reste celui de
  l'utilisateur.
- **Filigrane ou limite de projets en gratuit** : Voltaplan n'en a pas et n'en aura pas.
- **Sélection de produits d'une marque** (eDesign, EasyPro) : Voltaplan désigne le matériel par ses
  caractéristiques et sa norme, avec une référence fabricant facultative.
- **Ping d'usage quotidien** (Volter) : aucune télémétrie.
