# Tests avec de vrais comptes cloud : procédure

Date : 2026-11-24. Tout ce qui concerne le cloud n'a été testé jusqu'ici **qu'avec des réponses simulées**. Cette
procédure sert à le vérifier avec **tes propres comptes**.

**Règle absolue : jamais de dossier de client.** Utilise uniquement un projet d'essai, par exemple
« Essai conflit », créé pour l'occasion, avec des photos sans personne ni adresse.

## 1. Google Drive : analyse détaillée

Analyse complète (limites, quota, appareils simultanés, nettoyage) : [google-drive.md](google-drive.md).

### Ce que l'API permet

- L'API Drive v3 n'offre **pas d'écriture conditionnelle** (pas d'équivalent à `If-Match`) **[à vérifier sur la
  documentation actuelle]**.
- Une modification concurrente entre notre vérification et notre envoi ne peut donc pas être **empêchée**. On peut
  seulement la **rendre récupérable** et la **détecter**.
- Drive garde l'historique des révisions d'un fichier. Les révisions ordinaires peuvent être supprimées
  automatiquement : au-delà d'un nombre de révisions, ou après environ 30 jours **[à vérifier]**. Une révision
  marquée `keepForever` n'est **jamais** supprimée automatiquement, dans la limite d'un nombre maximal de révisions
  ainsi marquées par fichier (200 selon la documentation **[à vérifier]**).

### Stratégie conservatrice mise en place (`src/io/drive.ts`)

1. **Avant l'envoi** : relire la version et la révision de tête.
   - Si elles ont changé depuis l'ouverture, c'est un **conflit** : rien n'est envoyé, et notre version est
     enregistrée en copie.
2. **Avant l'envoi**, toujours : marquer la révision actuelle (celle qu'on va remplacer) « à conserver
   indéfiniment ».
   - **Si ce marquage échoue, l'envoi n'a pas lieu.**
3. **Envoi** avec `keepRevisionForever=true` : notre propre révision est aussi conservée indéfiniment.
4. **Après l'envoi** : relire l'historique des révisions.
   - Si une révision d'un autre appareil s'est intercalée entre celle de l'ouverture et la nôtre, son contenu est
     **recopié dans un nouveau fichier** « … (conflit date) », et l'utilisateur est prévenu.
5. **Plafond** : au-delà de 150 révisions conservées indéfiniment, les plus anciennes sont libérées, en en gardant
   100. Les 20 dernières ne sont jamais libérées.

### Ce qui reste possible, et comment récupérer

| Situation | Conséquence | Récupération |
|---|---|---|
| Un autre appareil Voltaplan enregistre pendant notre envoi | sa révision était déjà marquée « à conserver » (étape 3 de son côté) ; elle est détectée (étape 4) et recopiée | automatique : fichier « (conflit …) » |
| Un **autre logiciel** (client Drive, application tierce) enregistre pendant notre envoi | sa révision n'est pas marquée ; elle est détectée et recopiée, sauf si Drive l'a déjà supprimée entre-temps (improbable en quelques secondes) | automatique, sinon dans « Gérer les versions » de Drive |
| L'étape 4 échoue (coupure juste après l'envoi) | la course éventuelle n'est pas détectée | les deux révisions sont dans l'historique Drive, la nôtre conservée indéfiniment. Sur drive.google.com : clic droit sur le fichier → **Informations sur le fichier → Gérer les versions** → télécharger la version voulue |
| Révisions purgées au-delà du plafond | seules d'anciennes révisions libérées par Voltaplan peuvent disparaître, jamais les 20 dernières | — |

**Ce que nous ne garantissons pas** : l'absence absolue d'écrasement sur Google Drive. Le comportement de
l'historique et des révisions « conservées indéfiniment » doit être **vérifié avec de vrais comptes** (scénarios
G1 à G3 ci-dessous).

**Alternative encore plus prudente, si les tests la rendent nécessaire.** Avec le futur format en dossier (F8),
les enregistrements vers Drive ne remplaceraient jamais un fichier : chaque modèle serait écrit dans un **nouveau
fichier** (`models/<date>-<appareil>.json`), et Voltaplan lirait le plus récent. C'est sans risque d'écrasement,
mais demande un ménage des anciens modèles. Ce n'est pas implémenté.

## 2. Préparation

1. Pour chaque service testé : créer l'identifiant d'application (voir l'en-tête de `src/io/cloud.ts` ou le
   guide), sur l'adresse de test.
2. Deux appareils (ou deux navigateurs différents, par exemple Chrome et Firefox), connectés au même compte.
3. Un projet d'essai « Essai conflit », enregistré dans le service depuis l'appareil A, puis ouvert sur
   l'appareil B.
4. Noter pour chaque scénario : service, appareils, heure, résultat, capture d'écran.

## 3. Scénarios (pour chaque service : OneDrive, Dropbox, Google Drive, GitHub)

| # | Scénario | Comment | Résultat attendu |
|---|---|---|---|
| C1 | **Deux appareils modifient le même projet** | A et B ouvrent le projet ; A modifie et enregistre ; puis B modifie et enregistre | B : message « modifié ailleurs », copie « (conflit …) » créée ; le fichier de A est intact ; les deux sont ouvrables |
| C2 | **Enregistrements presque simultanés** | A et B enregistrent à moins d'une seconde d'intervalle (compter « 3, 2, 1 ») | un seul gagne ; l'autre crée une copie. Drive : éventuellement une copie créée après coup (« Quelqu'un a enregistré pendant votre envoi ») |
| C3 | **Coupure réseau pendant l'enregistrement** | projet avec quelques photos ; lancer l'enregistrement puis couper le Wi-Fi immédiatement | « En attente d'envoi » ; au retour du réseau, envoi automatique ; le fichier distant est soit l'ancien, soit le nouveau, jamais un mélange |
| C4 | **Fermeture pendant un transfert** | lancer l'enregistrement puis fermer l'onglet ou l'application aussitôt | au lancement suivant : « Enregistrement en attente… Reprendre » et/ou « Travail non enregistré retrouvé » ; après reprise, fichier complet |
| C5 | **Expiration de l'autorisation** | révoquer l'accès de l'application dans les réglages du compte (Microsoft : compte → Confidentialité → Applications ; Google : Sécurité → Accès tiers ; Dropbox : Paramètres → Applications connectées ; GitHub : supprimer le jeton), puis enregistrer | message « Connexion à … à refaire » ; la version est gardée ; « Enregistrer » ouvre la connexion et envoie |
| C6 | **Quota dépassé** | compte presque plein (ou dossier d'application limité), enregistrer | erreur claire ; la version reste dans le navigateur ; rien n'est perdu |
| C7 | **Fichier distant supprimé** | supprimer le fichier depuis le site du service, puis enregistrer dans Voltaplan | pas de recréation silencieuse au même nom sans le dire ; message clair (à observer : comportement actuel non spécifié, **à corriger si nécessaire**) |
| C8 | **Fichier distant déplacé ou renommé** | le déplacer depuis le site du service, puis enregistrer | OneDrive et Drive suivent l'identifiant (enregistrement au nouvel emplacement attendu) ; Dropbox et GitHub travaillent par chemin (conflit ou recréation : **à observer**) |
| C9 | **Ajout simultané de documents** | (format v2, plus tard) A et B ajoutent chacun une photo différente puis enregistrent | les deux photos sont conservées (fichiers immuables) ; le modèle perdant devient une copie de conflit référençant sa photo |
| C10 | **Récupération des versions en conflit** | après C1 ou C2, ouvrir les deux fichiers et Fichier → Versions locales | les deux versions sont lisibles ; les versions locales contiennent la version « Conflit » |
| G1 | Drive : historique | après plusieurs enregistrements, drive.google.com → Gérer les versions | chaque version enregistrée par Voltaplan est présente et marquée « Conserver indéfiniment » |
| G2 | Drive : course avec un autre logiciel | modifier le fichier par le client Drive de l'ordinateur pendant un envoi Voltaplan (difficile à provoquer : plusieurs essais) | copie « (conflit …) » créée, ou la version présente dans Gérer les versions |
| G3 | Drive : plafond | non testable manuellement (plus de 150 enregistrements) : vérifié seulement par les tests automatiques | — |

### Dossiers de projet (F8 : OneDrive, Dropbox, Google Drive)

Choisir « Dossier de projet » dans Enregistrer sous → Drive, OneDrive, Dropbox. Projet d'essai avec au moins trois
photos, dont une de plus de 10 Mo (et, si possible, un PDF de plus de 160 Mo pour Dropbox).

| # | Scénario | Comment | Résultat attendu |
|---|---|---|---|
| F1 | Premier enregistrement | enregistrer en dossier | `project.json`, `README.txt`, `assets/<empreinte>.<ext>` visibles sur le site du service ; Drive : dossier dans « Mon Drive » |
| F2 | Modification du schéma seul | changer un circuit, Enregistrer | seul `project.json` change (date de modification des photos inchangée) |
| F3 | Coupure pendant l'envoi des photos | couper le Wi-Fi pendant le premier enregistrement | « En attente » ; au retour du réseau, seules les photos manquantes partent ; `project.json` n'apparaît qu'à la fin |
| F4 | Deux appareils ajoutent chacun une photo | A et B ouvrent le dossier, ajoutent chacun une photo, enregistrent l'un après l'autre | les deux photos dans `assets/` ; B obtient `project (conflit …).json` qui affiche sa photo ; rien n'est supprimé |
| F5 | Gros document | PDF > 150 Mo (Dropbox), > 5 Mo (Drive), > 250 Mo (OneDrive) | envoi par tranches ; fichier complet ; une coupure pendant l'envoi reprend sans tout renvoyer |
| F6 | Espace plein | compte presque plein | message « Espace … plein » ; photos déjà envoyées gardées ; `project.json` inchangé ; pas de nouvel essai en boucle |
| F7 | Import d'une archive | « Importer un fichier .voltaplan… » | nouveau dossier ; ouverture identique à l'archive |
| F8 | Transfert entre services | ouvrir un dossier Dropbox, « Enregistrer comme dossier de projet » sur Drive | même projet, mêmes photos ; dossier Dropbox intact |
| F9 | Drive : version concurrente | difficile à provoquer : deux appareils enregistrent en même temps | soit conflit avant envoi, soit « project (conflit …).json » recopié après coup |

### Google Drive : « Ouvrir avec Voltaplan » (configuration : oauth-configuration.md)

| # | Scénario | Comment | Résultat attendu |
|---|---|---|---|
| D1 | Apparition dans le menu | sans Marketplace : bouton « Ajouter à « Ouvrir avec » de Drive » ; puis clic droit sur un `.voltaplan` dans Drive | Voltaplan apparaît dans « Ouvrir avec » (délai possible). Noter si une fiche Marketplace est malgré tout exigée |
| D2 | Ouvrir | « Ouvrir avec → Voltaplan » sur une archive v2 | bandeau ; clic → connexion (compte suggéré) → projet ouvert ; adresse sans `state` ; recharger ne rouvre rien |
| D3 | Enregistrer après ouverture | modifier, Enregistrer | même fichier mis à jour (pas de doublon) ; une version de plus dans « Gérer les versions » |
| D4 | Fichier v1 / lecture seule | ouvrir un ancien `.voltaplan` (JSON) ; puis un fichier partagé en lecture seule | nouveau fichier créé à l'enregistrement, original intact |
| D5 | Nouveau | Drive → Nouveau → Plus → Voltaplan, dans un sous-dossier | projet vide ; premier Enregistrer crée le fichier dans ce sous-dossier (noter une éventuelle erreur d'autorisation avec `drive.file`) |
| D6 | Autre compte | ouvrir depuis le compte B alors que Voltaplan est connecté au compte A | message clair (fichier introuvable avec ce compte) ou connexion au bon compte |

## 4. Résultats

Checklist pratique des 15 scénarios F1 à F9 et D1 à D6, avec ce que fait le propriétaire et ce qui est automatisé :
[checklist-tests-cloud.md](checklist-tests-cloud.md).

| Scénario | OneDrive | Dropbox | Google Drive | GitHub |
|---|---|---|---|---|
| C1 à C10, G1 et G2 | non testé | non testé | non testé | non testé |
| F1 à F9 | F1 ✅ (F2, F7 à faire) | F1, F2, F7 ✅ ; F4 iOS ❌ (connexion, voir S1) | F1, F2, F3, F4, F5, F7, F9 ✅ (avec écarts S3 à S5) | sans objet |
| F10 | — | ✅ rapide (accès retiré) | ✅ long (expiration naturelle) | sans objet |
| D1 à D6 | sans objet | sans objet | D1 : autorisation accordée (depuis iOS), apparition non vérifiée ; D2 à D6 non testés | sans objet |

À remplir au fur et à mesure. Chaque écart observé devient une demande de correction.

### Journal des essais réels

**2026-11-24, voltaplan.org (3b8cfe8), navigateur intégré de Claude Desktop, comptes d'essai du propriétaire.**
Projet « Essai cloud (a supprimer) », sans photo ni donnée de client. Connexions OAuth faites par le propriétaire
(la fenêtre de connexion ne s'ouvre que sur un clic humain) ; le reste piloté et vérifié par Claude (journal des
requêtes du navigateur, site du service).

| # | Service | Résultat | Preuve |
|---|---|---|---|
| F1 | Google Drive | ✅ réel : dossier créé, `project.json` et `README.txt` présents ; pas de `assets/` (aucune photo) | drive.google.com ; requêtes 200 ; liste « Dossiers de projet » |
| F1 | OneDrive | ✅ réel : `README.txt` et `project.json` créés (201) dans `Apps/…` | requêtes Graph 201 |
| F1 | Dropbox | ✅ réel : `README.txt` et `project.json` envoyés (200) ; dossier listé par Voltaplan | requêtes Dropbox ; liste « Dossiers de projet » |
| F2 | Dropbox | ⚠️ réel partiel : seul le modèle change, mais `README.txt` est renvoyé à chaque enregistrement (mode `add`, contenu identique : Dropbox répond 200). Sans photo, la non-réexpédition des documents reste à vérifier | 1 `list_folder` (409, pas de `assets/`), 2 `upload` |
| D1 | Google Drive | ⏳ autorisation `drive.install` accordée par le propriétaire ; apparition dans « Ouvrir avec » à vérifier | message de Voltaplan |

**2026-11-25 (nuit), même configuration, sans le propriétaire** : connexions de la veille encore valides (Google
Drive, Dropbox) ; documents de test **synthétiques** générés dans la page (photo JPEG de 13,7 Mo, PDF valide de
7,3 Mo) et donnés au sélecteur de fichiers de l'application.

| # | Service | Type | Résultat | Preuve |
|---|---|---|---|---|
| F1 | Dropbox | réel | ✅ 2 documents puis `README.txt` et `project.json` envoyés (17 s) | requêtes 409 (pas encore de `assets/`) puis 4 `upload` 200 |
| F2 | Dropbox | réel | ✅ schéma modifié : **aucun document renvoyé** ; seuls `README.txt` et `project.json` (1 s) | 1 `list_folder` 200, 2 `upload` |
| F1 | Google Drive | réel | ✅ nouveau dossier, photo de 13,7 Mo envoyée par tranches (308 puis 200), PDF, README, modèle | 18 requêtes, toutes 200 ou 308 |
| F2 | Google Drive | réel | ❌ **faux conflit** au 2ᵉ enregistrement : copie « project (conflit …).json » créée alors que personne d'autre n'avait modifié le projet. Rien de perdu. **Corrigé** (voir B1), à revérifier en réel | journal des versions Drive |
| F7 | Dropbox | réel | ✅ archive `.voltaplan` de 21 Mo (exportée par l'application) importée dans un nouveau dossier ; projet rouvert avec son plan PDF et la photo du tableau | 2 documents, README, modèle, relecture : toutes 200 |
| F7 | Google Drive | réel | ✅ même archive, nouveau dossier ; projet rouvert | 22 requêtes, toutes 200 ou 308 |
| F1, F2, F7 | OneDrive | — | ⏳ connexion perdue (voir O1) : à faire avec le propriétaire | — |

**B1. Faux conflit Google Drive (corrigé).** Mesure sur le vrai service : la réponse de création donne
`version` 1 ; relu une minute plus tard, `version` 2, avec **la même révision de tête** (contenu identique). Drive
augmente `version` pour des traitements internes et pour le marquage « à conserver » d'une révision. Voltaplan
comparait « version|révision » en entier : chaque 2ᵉ enregistrement d'un projet créé dans la session devenait un
conflit. Correction : seule la révision de tête désigne le contenu (`sameDriveContent`, `src/io/drive.ts`). Le
service simulé reproduit maintenant ce comportement ; sans la correction, 7 tests échouent.

**O1. Perte de la connexion OneDrive : analyse (cause non établie, code non modifié).**

- Faits relevés dans la page : jeton obtenu à 22:50:51 UTC ; dernier appel Graph réussi à 22:54:47 (200) ;
  vers 22:57:30, plus de jeton en mémoire (bouton « Se déconnecter » absent, connexion demandée sans aucun appel
  Graph). Aucun 401 ni autre erreur Graph, aucun rechargement de la page (même chargement depuis 22:46:55).
  Google Drive et Dropbox, obtenus dans la même page, restaient valides.
- Code : le jeton n'est gardé qu'en mémoire (aucune persistance locale, par choix : voir la politique de
  confidentialité) ; pas de renouvellement automatique (ni `offline_access`, ni jeton de rafraîchissement). Il
  n'est oublié qu'à deux endroits : le bouton « Se déconnecter » et une réponse 401 (aucune observée). Il est
  considéré expiré à `expires_in − 60` secondes après son obtention.
- Il ne reste donc que deux explications : une durée `expires_in` très courte renvoyée par Microsoft (moins de
  7 minutes environ ; d'ordinaire une heure **[à vérifier]**) ou un clic involontaire sur « Se déconnecter » (dans
  la fenêtre d'enregistrement, ce bouton prend la place de « Ajouter à « Ouvrir avec » de Drive » quand on passe de
  Google Drive à OneDrive). Le propriétaire n'a pas cliqué sur « Se déconnecter ».
- Mesure prévue à la prochaine connexion : relevé de `expires_in`, `scope` et `token_type` de la réponse de
  Microsoft (jamais le jeton), puis vérification de la connexion toutes les quelques minutes.

Observations :

- **O1** : environ 7 minutes après la connexion OneDrive, le jeton n'était plus en mémoire (bouton « Se déconnecter »
  absent, nouvelle connexion demandée), alors que Google Drive et Dropbox restaient connectés. **Non reproduit**
  à la séance du 2026-11-25 : jeton valable environ 1 h (voir plus bas).
- **O2** (corrigé) : `README.txt` renvoyé à chaque enregistrement Dropbox. Confirme que Dropbox accepte un `add` de
  contenu identique. De plus, son texte était celui de l'archive (« renommez-le en .zip »), faux pour un dossier.
  Désormais : texte propre aux dossiers, écrit s'il manque ou si son texte a changé (titre), au plus une lecture par
  dossier et par session (`syncReadme`, `src/format/folder.ts`).
- **O3** (corrigé) : dates harmonisées. Date affichée = celle du modèle `project.json` (Dropbox ne date pas les
  dossiers, Drive ne change pas la date d'un dossier quand son contenu change ; OneDrive : date du dossier, qui
  suit son contenu, constaté sur `Apps`). Coût : Dropbox, une liste récursive au lieu d'une liste simple ; Drive,
  une requête de plus pour tous les dossiers. Même tri partout : le plus récent d'abord.
- **O4** (corrigé) : l'archive téléchargée par « Cet appareil » (sans sélecteur de fichiers du système) était typée
  `application/zip`. Elle porte maintenant `application/vnd.voltaplan+zip`, comme son entrée `mimetype` et comme
  sur Google Drive. Le nom finit **toujours** par `.voltaplan`, y compris pour une copie de conflit
  (`deviceFileName`, `src/io/files.ts`). Testé automatiquement (`test/localDownload.test.ts`). Que chaque navigateur
  garde bien l'extension avec ce type est **[à vérifier]**, surtout Safari et iOS (séance commune, F4 sur téléphone).

**2026-11-25, vérifications sans le propriétaire**

- **B1 ne masque pas de vrai conflit** (automatique, service simulé qui reproduit les changements de `version`) :
  toute écriture de contenu par un autre appareil crée une nouvelle révision de tête, donc un conflit. C'est vrai
  même avec un contenu identique, même suivie d'un changement de `version` seul, et avec une version mémorisée
  ancienne sans révision. Une écriture pendant notre envoi est recopiée à part. Seul un changement de `version`
  sans nouvelle révision passe sans conflit. 6 tests dans `test/driveVersion.test.ts`. Limite : la détection
  **pendant** l'envoi lit la liste des révisions ; Drive peut supprimer d'anciennes révisions non conservées, mais
  la dernière écrite par l'autre appareil reste la révision de tête, donc elle est toujours vue **[à vérifier en réel,
  F9]**.
- **Lien GitHub Sponsors sans connexion** (réel, requête sans cookie) : `https://github.com/sponsors/SebastienBatteur`
  répond 200, sans redirection, avec les paliers mensuels et ponctuels visibles. Choisir un palier mène à la
  connexion GitHub : GitHub exige un compte pour parrainer.
- **Jetons OAuth** : analyse dans [oauth-jetons.md](oauth-jetons.md) ; aucun changement de code.

**2026-11-25 (07:34 à 08:39 UTC), séance commune avec le propriétaire.** voltaplan.org (version publiée ce jour),
navigateur intégré de Claude Desktop (Windows, Wi-Fi) en deux onglets ; iPhone, Safari (iOS). Projet « Essai cloud
2026-11-25 (à supprimer) ». Documents de test **synthétiques** générés dans la page (images JPEG de 12 Mo, PDF de
49 Mo), sauf la photo du tableau prise par le propriétaire sur le téléphone. Mesures par un enregistreur placé dans
la page : heure et code de chaque requête, champs `expires_in`, `scope`, `token_type` des réponses de jeton (jamais
le jeton), ouvertures de fenêtre de connexion. Aucun code modifié pendant la séance.

| # | Service | Type | Résultat | Preuve |
|---|---|---|---|---|
| B1 | Google Drive | réel | ✅ 2ᵉ enregistrement après modification : **aucun faux conflit** | 7 requêtes, toutes 200 |
| F9 | Google Drive | réel partiel (2 onglets) | ✅ deux enregistrements lancés à la même seconde : l'un écrit, l'autre détecte le changement et crée une **copie de conflit** ; dossier d'origine rouvert = version A (18 modules), copie = version B (14) | requêtes des deux onglets ; relecture des deux versions |
| F4 | Google Drive | réel (iPhone + ordinateur) | ✅ le téléphone ajoute la photo du tableau et enregistre ; l'ordinateur, ouvert avant, ajoute une image de plan et enregistre : conflit détecté, copie créée. Dossier d'origine = photo du téléphone, copie = image de l'ordinateur. Rien de perdu. ⚠️ voir S3 | relecture des deux versions |
| F4 | Dropbox | réel (iPhone) | ❌ connexion impossible depuis Safari (S1) ; essai fait sur Google Drive | captures du propriétaire |
| F3, F5 | Google Drive | réel (Wi-Fi coupé 15 s pendant l'envoi d'un PDF de 49 Mo) | ✅ aucune perte : 2 requêtes en échec, état « ⏸ En attente d'envoi », modèle non envoyé. ❌ pas de reprise automatique (S4). ⚠️ après clic sur « Enregistrer », le PDF repart **depuis le début** (S5) ; l'image de 12 Mo déjà envoyée n'est pas renvoyée | 2 tranches (308) avant la coupure, 7 après, puis 200 |
| F5 | — | — | Limite d'import d'un PDF : **50 Mo** (`IMPORT_LIMITS`) ; un PDF de 160 Mo est refusé avec un message clair. Les tailles 160 et 260 Mo prévues dans la checklist étaient impossibles | message « Fichier trop volumineux… maximum 50 Mo » |
| F10 rapide | Dropbox | réel | ✅ modification + image non enregistrées ; accès de Voltaplan retiré sur dropbox.com ; clic « Enregistrer » : 401, fenêtre de connexion ouverte, reconnexion, **un seul** enregistrement (image + modèle) ; projet rouvert depuis Dropbox : modification et image présentes | 401 puis 2 `upload` 200 |
| F10 long | Google Drive | réel | ✅ jeton obtenu à 07:35:51 ; à 08:35:32, enregistrement lancé par script (sans geste) : expiration vue **sans appel à Google**, fenêtre de connexion bloquée par le navigateur, état « en attente », message « Connexion à Google Drive à refaire (session expirée) » ; au clic du propriétaire : fenêtre ouverte et refermée seule (accord déjà donné), enregistrement, **vrai conflit** (modification du téléphone) → copie | journal de la page |
| O1 | OneDrive | réel | ✅ jeton obtenu à 07:35:29, accepté par Graph à chaque vérification (toutes les 5 min) jusqu'à 08:32:41 ; vu expiré à 08:37:37. Durée normale d'**environ 1 h** : la perte après 7 minutes de la veille ne s'est pas reproduite (clic involontaire sur « Se déconnecter » ou cas isolé) | 9 listes Graph 200 |
| iOS | Google Drive | réel | ✅ connexion depuis Safari ; autorisation `drive.install` (D1) accordée ; photo du tableau (appareil photo ou photothèque) ; mode avion : « ⏸ En attente… », badge « Hors ligne », message clair ; au retour du réseau, **envoi repris seul** (« Connexion rétablie : enregistrement envoyé ») | captures du propriétaire |
| O4 | iOS | réel | ✅ « Enregistrer sous → Cet appareil » : téléchargement direct, fichier `….voltaplan` de 3,6 Mo dans Fichiers. ❌ réouverture impossible (S2) | captures du propriétaire |

Durées de jeton mesurées (`expires_in`) : **Google 3599 s** (`drive.file`) ; **Dropbox 14 400 s** (4 h, sans jeton de
rafraîchissement, 3 portées attendues) ; **OneDrive environ 3600 s** (déduit : réponse de jeton antérieure à la
mise en place de l'enregistreur).

Écarts à corriger (aucun corrigé pendant la séance, à traiter après) :

- **S1 (bloquant, iOS ; corrigé, ✅ revérifié sur iPhone le 2026-11-25 : fenêtres Dropbox et OneDrive ouvertes, listes affichées) : connexion Dropbox et OneDrive impossible depuis
  Safari.** Correction : fenêtre ouverte vide dès le geste, adresse donnée après le calcul PKCE ; tests
  `test/iosPopupPicker.test.ts` (échouent sans la correction). Aucune fenêtre ne s'ouvre ;
  message « session expirée ». Cause : `cloudConnect` (`src/io/cloud.ts`) calcule la paire PKCE (`crypto.subtle`,
  asynchrone) **avant** `window.open` ; Safari ne relie plus l'ouverture au geste et la bloque. Confirmé : Google,
  sans PKCE, s'ouvre sur le même téléphone. Piste : ouvrir la fenêtre vide dès le geste, puis y charger l'adresse
  de connexion ; ou préparer la paire PKCE à l'avance.
- **S2 (bloquant, iOS ; corrigé, ✅ revérifié sur iPhone le 2026-11-25 : fichier sélectionnable, projet rouvert avec la photo du tableau, 3 rangées et 18 modules) : un fichier `.voltaplan` ne peut pas être rouvert.**
  Correction : `pickerAccept` (`src/io/files.ts`) retire le filtre sur iPhone et iPad quand il contient une
  extension inconnue d'iOS ; les filtres photo et PDF sont gardés. Il est grisé dans le sélecteur
  d'iOS : le filtre `accept` ne contient que des extensions (`.voltaplan,.openrgie,.json,.trik`) que Safari ne sait
  pas relier à un type connu. Piste : sur iOS, ne pas filtrer (ou ajouter des types génériques) ; le contenu est
  déjà vérifié par sa signature à l'ouverture.
- **S3 (✅ ne se reproduit plus, vérifié sur iPhone le 2026-11-25 : double toucher sur « Enregistrer », un seul
  envoi, aucun message ; un second clic pendant un envoi est ignoré depuis la correction de S4) : fausse alerte
  « Quelqu'un a enregistré … pendant votre envoi »** après deux « Enregistrer » rapprochés du
  même appareil (iPhone, 09:03 puis 09:04) ; aucun autre appareil n'écrivait (journal de l'ordinateur). Effet :
  fichier inutile `project (conflit …).json`, rien de perdu. Piste : la détection pendant l'envoi
  (`driveRevisionsBetween`, `src/io/drive.ts`) prend la révision de notre propre enregistrement précédent pour
  celle d'un autre ; à reproduire avec le service simulé (deux enregistrements qui se chevauchent).
- **S4 (corrigé, ✅ revérifié en réel le 2026-11-25 : envoi en échec à 09:13:52 UTC, 1er essai à +10 s encore
  hors ligne, 2ᵉ à +30 s réussi, « Enregistré » à 09:14:38, sans aucun évènement `online` ni clic) : pas de reprise
  automatique sous Windows.** Correction : nouvel essai
  à 10 s, 30 s, 1 min, 2 min puis toutes les 5 min, en plus de `online` (`src/io/retry.ts`) ; jamais deux envois à
  la fois (un clic pendant un envoi en cours est ignoré, ce qui évite aussi le cas de S3) ; pas de reprise
  automatique quand la connexion au service est à refaire ; un nouvel échec ne répète pas le message. Tests :
  `test/pendingRetry.test.ts`. La reprise attend l'évènement `online` (`src/App.tsx`) ; le
  navigateur n'a signalé ni la coupure ni le retour (`navigator.onLine` resté vrai, autres cartes réseau actives).
  L'enregistrement reste « en attente » jusqu'au clic suivant. Piste : nouvel essai périodique (délai croissant)
  tant qu'un envoi est en attente, en plus de `online`.
- **S5 (corrigé pour Google Drive, ✅ revérifié en réel le 2026-11-25 : PDF de 49 Mo, Wi-Fi coupé pendant la 1re
  tranche à 09:31:39 UTC ; reprise automatique à 09:31:59 (S4), Drive indique 512 Ko reçus, l'envoi reprend à
  l'octet 524 288 dans la **même** session (aucune nouvelle session), « Enregistré » à 09:32:38) : un document
  interrompu est renvoyé depuis le début.**
  Correction : la session d'envoi est gardée en mémoire pour un document désigné par son empreinte
  (`assets/<sha256>.<ext>`) ; à l'essai suivant, Drive dit où reprendre ; session expirée : nouvelle session ;
  réponse perdue après la dernière tranche : pas de doublon. Tests : `test/driveResume.test.ts` (la reprise échoue
  sans la correction). Dropbox (au-delà de 150 Mo) et OneDrive (au-delà de 250 Mo) : non traités, tailles
  inatteignables par un document importé (50 Mo au plus). La session d'envoi par tranches de Drive n'est pas
  gardée. Piste : la garder (en mémoire) et reprendre au dernier octet accepté.
- **S6 (corrigé) : messages.** Correction : la connexion à refaire porte sa raison (`AuthError.reason` : première
  connexion ou session expirée) ; première connexion : « Connexion à … nécessaire » (enregistrement) ou « La fenêtre de
  connexion n'a pas pu s'ouvrir : cliquez à nouveau sur le bouton » (fenêtre des services) ; messages de réussite en
  vert ; « Projet ouvert : … » à l'ouverture d'un projet, « Import terminé » gardé pour Trikker. Tests :
  `test/authMessages.test.ts`. « Session expirée » affiché à une première connexion bloquée, avec « cliquez sur
  Enregistrer » alors qu'on est dans « Ouvrir » ; message de succès « Autorisation donnée » affiché en rouge ; « Import terminé : 4 éléments… » affiché à
  l'ouverture d'un simple projet `.voltaplan` (le mot « Import » prête à confusion).
- **S7 (hors code ; demande de passage en production envoyée par le propriétaire le 2026-11-25 ; Dropbox ne
  l'examine qu'à partir de 50 utilisateurs, et elle doit être faite au plus tard deux semaines après ce seuil ; en
  développement, jusqu'à 500 utilisateurs ; disparition de l'avertissement après approbation **[à vérifier]**) :
  Dropbox affiche « peu d'utilisateurs… »** avant de connecter l'application (statut
  développement). Demander le statut production avant la bêta publique.
- **S8 (navigateur intégré seulement)** : la boîte `alert()` (fichier trop volumineux) n'est pas montrée par le
  navigateur intégré, et `createWritable` y est refusé (« Cet appareil » échoue). Sans effet dans un navigateur
  ordinaire ; à garder en tête pour les essais futurs.

**Suite de la séance, D1 à D5 (2026-11-25, après-midi)** : fichier d'essai « Essai Ouvrir avec 2026-11-25 (à
supprimer).voltaplan » (55 Mo) créé sur Drive par Voltaplan.

- **D1** ✅ : clic droit → « Ouvrir avec » propose Voltaplan, sans fiche Marketplace.
- **D2** ✅ : ouverture depuis Drive, bandeau, connexion, projet ouvert (photo, 3 rangées) ; adresse ensuite sans
  `state`.
- **D3** ✅ : enregistré au même endroit (« Enregistré (Google Drive, 11:13) ») ; un seul fichier dans Drive ; « Gérer
  les versions » : 2 versions (11:08 création, 11:13 mise à jour).
- **D5** ❌ puis corrigé : « Nouveau → Voltaplan » ouvrait l'application **sans** bandeau « Créer le projet », et
  « Enregistrer » proposait l'appareil. Cause probable : Drive envoie `"folderResourceKey":""` (vide) pour un dossier
  de « Mon Drive » ; le contrôle exigeait au moins un caractère et rejetait toute la demande sans rien dire.
  Correction : champ vide traité comme absent ; message « demande non reconnue » si la demande est rejetée ;
  bandeau Drive placé en haut (il ne peut plus être recouvert par un autre message). ✅ **Revérifié en réel** (d27995b) :
  bandeau « Créer le projet » affiché en haut ; « Nouveau projet.voltaplan » créé dans Mon Drive › Essai cloud
  2026-11-25 (à supprimer), le sous-dossier choisi. La cause supposée (clé vide) est donc confirmée.
- **S10** (corrigé, à revérifier en réel à la prochaine mise à jour) : la demande de Drive est gardée pour l'onglet
  (sessionStorage) jusqu'à la réponse de l'utilisateur, 10 minutes au plus, revalidée à la relecture, effacée dès
  que le bandeau est accepté ou annulé. Tests : `test/driveOpenWith.test.ts`. Constat initial : quand Drive ouvre Voltaplan alors qu'une nouvelle version est en attente, l'onglet
  démarre sur l'ancienne version (cache) et propose « Recharger » ; recharger fait perdre la demande de Drive (déjà
  retirée de l'adresse). Constaté au 1er essai de D5 après la correction.
- **S9** (corrigé) : « Enregistrer » avant d'avoir répondu au bandeau Drive proposait d'enregistrer sur
  l'appareil ; il renvoie maintenant au bandeau.

- **F8** ✅ (Dropbox → Google Drive) : « Essai cloud 2026-11-25 (à supprimer) » ouvert depuis Dropbox (20 modules, image
  de plan F10), enregistré sur Drive en dossier « Essai transfert F8 (à supprimer) » : 2 dossiers créés, 3 envois
  (image, README, modèle) ; rouvert depuis Drive : 20 modules, image 1600×1000 ; côté Dropbox, uniquement des
  lectures (aucune écriture). Remarque : l'image relue peut venir du cache local de l'onglet.
- **S11** (bloquant OneDrive ; corrigé (554f353) : domaine ajouté à la CSP du site et de l'application de bureau ;
  ✅ revérifié en réel : « Nouveau projet/ » rouvert, `project.json` lu) : **ouvrir un dossier OneDrive échoue** (« Failed to fetch »). Le
  téléchargement de `project.json` est redirigé par Graph vers `https://my.microsoftpersonalcontent.com/…`
  (comptes personnels), domaine absent de la CSP (`connect-src`, `src/security/csp.ts`, où il était marqué « à
  vérifier avec de vrais comptes »). F2 et F7 OneDrive bloqués tant que ce n'est pas corrigé. Incident d'essai :
  le script de F2 a ensuite modifié (21 modules) et enregistré la copie Drive « Essai transfert F8 », projet d'essai.

- **F2 OneDrive** ✅ : « Nouveau projet/ » rouvert, modules 13 → 15, enregistré : un seul envoi (`project.json`, PUT
  200) ; `README.txt` lu, pas renvoyé.
- **F7 OneDrive** ✅ : archive `.voltaplan` de 46 Ko produite par l'application (type `application/vnd.voltaplan+zip`,
  capturée en mémoire, rien d'écrit sur l'ordinateur), importée dans « Essai import F7 OneDrive (à supprimer)/ » :
  image `assets/<sha256>.jpg`, `README.txt`, `project.json` créés (201), puis relus ; projet identique (15 modules,
  image 1600×1000). Enregistrement suivant (16 modules) : **image non renvoyée** ; `project.json` et `README.txt`
  renvoyés.
- **O5** (mineur) : le premier enregistrement après un import réécrit `README.txt` (texte différent de celui écrit à
  l'import, probablement le titre). Une requête de plus, sans effet sur les données.

Reste à faire en réel : D4 et D6 (second compte Google), F6 (compte presque plein), Android ; S10 à revérifier en réel. S1 et S2 : corrigés (16ca66a) et revérifiés sur iPhone.

