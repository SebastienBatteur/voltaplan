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
| F1 à F9 | non testé | non testé | non testé | sans objet |
| D1 à D6 | sans objet | sans objet | non testé | sans objet |

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
  absent, nouvelle connexion demandée), alors que Google Drive et Dropbox restaient connectés. Cause inconnue : à
  reproduire (déconnexion manuelle ? durée du jeton ?).
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

