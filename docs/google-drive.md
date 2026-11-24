# Google Drive : protection contre les pertes, analyse détaillée

Date : 2026-11-24. **Rien de ce qui suit n'est vérifié avec de vrais comptes.** Les comportements de Drive sont
tirés de la documentation, consultée de mémoire et marquée **[à vérifier]**. Procédure de test :
[tests-cloud-reels.md](tests-cloud-reels.md).

**Nous ne garantissons pas l'absence de perte de données sur Google Drive avant ces tests.**

## 1. Ce que fait Voltaplan aujourd'hui (`src/io/drive.ts`, utilisé par `cloud.ts` et `driveFolder.ts`)

1. **Avant l'envoi**, Voltaplan relit la version et la révision de tête. Si elles ont changé depuis l'ouverture, il
   y a conflit : rien n'est envoyé, et notre version part en copie.
2. **Avant l'envoi**, il marque la révision qu'il va remplacer « à conserver indéfiniment » (`keepForever`). Si ce
   marquage échoue, il n'envoie rien.
3. **Envoi** avec `keepRevisionForever=true` : notre révision est conservée elle aussi.
4. **Après l'envoi**, il relit l'historique. Si une révision s'est intercalée entre celle de l'ouverture et la
   nôtre, son contenu est recopié dans un nouveau fichier « … (conflit date) ».
5. **Libération** des révisions conservées les plus anciennes, au-delà d'un seuil. Elle va devenir sensible à la
   taille (point 3).

## 2. Limites de Drive

| Limite | Valeur selon la documentation | Conséquence |
|---|---|---|
| Révisions conservées indéfiniment par fichier | **200** **[à vérifier]** | au-delà, le marquage échoue. Voltaplan libère d'abord les plus anciennes ; s'il échoue encore, l'envoi n'a pas lieu |
| Révisions ordinaires (non marquées) | supprimées automatiquement **30 jours** après une version plus récente, ou au-delà de **100** révisions **[à vérifier]** | une version non marquée peut disparaître : d'où le marquage avant l'écrasement |
| Révisions et quota | les révisions conservées **comptent dans l'espace de stockage** de l'utilisateur **[à vérifier]** | risque de remplir le Drive (point 3) |
| Écriture conditionnelle | **absente** de l'API v3 **[à vérifier]** | course possible entre notre vérification et notre envoi : détectée après coup (étape 4) |

## 3. Conséquences sur le quota de l'utilisateur

| Format du projet | Taille d'une révision | 100 révisions conservées |
|---|---|---|
| v1 (JSON, photos intégrées) | jusqu'à 50 Mo | jusqu'à **5 Go** : inacceptable |
| v2 archive unique (`.voltaplan` ZIP) | taille du projet (photos comprises) | idem, voire pire |
| **v2 dossier cloud (F8)** | `project.json` seul (0,1 à 1 Mo) ; photos immuables, jamais réécrites | **10 à 100 Mo** : acceptable |

**Décision en cours d'implémentation** (dans le chantier du format v2) : libération **selon la taille**.

- On garde les révisions marquées tant que leur nombre reste à 100 au plus **et** leur taille totale sous un budget,
  proposé à max(10 × la taille du fichier, 200 Mo).
- Ne sont jamais libérées : les 20 dernières révisions, et une révision liée à un conflit non résolu.
- Avec le dossier cloud (F8), le budget n'est presque jamais atteint. C'est la forme recommandée pour Drive.

## 4. Plusieurs appareils qui enregistrent en même temps

**Cas A — B enregistre après que A a fini.** La vérification d'avant envoi de B détecte la nouvelle version de A.
B crée une copie de conflit, et la version de A reste en place.

**Cas B — A et B enregistrent quasi simultanément** (les deux vérifications passent, puis les deux envois ont
lieu) :

- l'envoi de A crée la révision rA, marquée ; celui de B crée rB, marquée ;
- après son envoi, A trouve rB après rA : rien à recopier, sa propre version a été remplacée par celle de B ;
- après son envoi, B trouve rA entre la révision d'ouverture et rB : il **recopie rA** en copie de conflit ;
- **résultat** : la version de B est en place, celle de A est en copie, et rA et rB restent dans l'historique.

**Cas C — Trois appareils ou plus.** Même raisonnement : chaque révision intercalée est recopiée par l'appareil
qui la détecte, et toutes sont marquées.

**Cas D — Un autre logiciel** (client Drive pour ordinateur) enregistre pendant notre envoi :

- sa révision n'est pas marquée par lui ;
- elle est détectée et recopiée à l'étape 4, sauf si Drive l'a déjà purgée, ce qui est improbable en quelques
  secondes.

**Cas E — Coupure juste après notre envoi** (l'étape 4 n'a pas lieu) :

- la course éventuelle n'est pas détectée ;
- les deux révisions restent dans l'historique, la nôtre marquée, l'autre au moins 30 jours ;
- la récupération est manuelle.

## 5. Récupérer une version concurrente

1. **Automatique** : un fichier « Projet (conflit AAAA-MM-JJ HHhMM).voltaplan » apparaît à côté. Ouvrez les deux
   dans Voltaplan pour comparer.
2. **Dans Voltaplan** : Fichier → Versions locales. Chaque enregistrement et chaque conflit y laisse une copie,
   sur cet appareil.
3. **Dans Drive** : drive.google.com → clic droit sur le fichier → *Informations sur le fichier* → *Gérer les
   versions* → télécharger la version voulue, puis l'ouvrir dans Voltaplan. **[à vérifier : libellés exacts de
   l'interface]**

## 6. Nettoyage des anciennes révisions sans perte

- Voltaplan ne **supprime jamais** de révision : il retire seulement la marque « conserver » aux plus anciennes.
  Drive peut alors les purger selon ses règles (30 jours ou 100 révisions).
- Ce qui reste toujours :
  - la version actuelle ;
  - les 20 dernières révisions marquées ;
  - les copies de conflit (des fichiers à part) ;
  - les versions locales sur chaque appareil.
- Une ancienne version peut donc disparaître de Drive **après** avoir été remplacée par des versions plus
  récentes. C'est voulu : la limiter coûte du quota. Nous recommandons de vider les copies de conflit une fois la
  bonne version choisie.

## 7. Alternative plus prudente, si les tests la rendent nécessaire

Ne jamais remplacer de fichier sur Drive :

- chaque enregistrement écrit un **nouveau fichier modèle** (`models/<date>-<appareil>.json`) dans le dossier du
  projet ;
- Voltaplan lit le plus récent ;
- deux modèles avec le même parent signalent un conflit.

Cette méthode est sans écrasement possible, mais demande un ménage des anciens modèles et plus de code. **À ne
retenir que si les tests réels montrent une perte avec la stratégie actuelle.**

## 8. Dossier de projet sur Google Drive (F8)

Code : `src/io/driveFolder.ts` (service), `src/io/drive.ts` (appels communs, stratégie prudente),
`src/format/folder.ts` (logique commune à tous les services). Testé avec un Drive **simulé**
(`test/cloudFolders.test.ts`, `test/cloudFakes.ts`) **[à vérifier avec de vrais comptes]**.

```
Mon Drive/<Projet>/            dossier créé par Voltaplan, marqué appProperties.voltaplan = "project"
  project.json                 SEUL fichier modifiable (modèle + dossier de preuves), application/json
  assets/<sha256>.<ext>        documents immuables (sous-dossier marqué voltaplan = "assets")
  README.txt
  project (conflit …).json     copie de conflit éventuelle, à côté
```

- **Portée `drive.file`** : Voltaplan voit les dossiers et fichiers qu'il a créés. La liste « Dossiers de projet »
  cherche les dossiers marqués ; un dossier créé à la main dans Drive n'y apparaît pas.
- **Documents** : recherchés par nom dans `assets` avant tout envoi (jamais renvoyés, jamais remplacés) ; envoi
  « multipart » jusqu'à 5 Mo, « resumable » au-delà (tranches de 8 Mio ; après une coupure, Voltaplan demande au
  service où reprendre au lieu de tout renvoyer). Ils sont envoyés et vérifiés AVANT le modèle qui les référence.
- **Modèle** : pas d'If-Match : stratégie des § 1 à 6 appliquée à `project.json` (version et révision vérifiées
  avant, révision remplacée conservée, contrôle après envoi, copie de la version concurrente dans le **même
  dossier**, libération selon la taille). Le modèle étant petit, le budget de révisions conservées n'est presque
  jamais atteint.
- **Noms en double** : Drive admet deux fichiers ou dossiers de même nom.
  - deux appareils qui créent `assets` en même temps : deux dossiers `assets`, lus ensemble ; rien n'est perdu ;
  - deux appareils qui créent `project.json` en même temps : le second est renommé en copie de conflit (aucune
    suppression) et le conflit est signalé.
- **Modèle supprimé ou mis à la corbeille ailleurs** : conflit (jamais de recréation silencieuse) ; notre version
  part en copie de conflit.
- **Espace plein** (403 `storageQuotaExceeded`) : erreur typée, documents déjà envoyés gardés, modèle non publié,
  pas de nouvel essai automatique.

## 9. « Ouvrir avec Voltaplan » depuis Google Drive

Configuration et prérequis (Marketplace, portée `drive.install`) : [oauth-configuration.md](oauth-configuration.md#google-drive--ouvrir-avec-voltaplan-et-nouveau--voltaplan).

1. Drive ouvre `https://voltaplan.org/app/?state=<JSON encodé>`.
2. Au démarrage, Voltaplan lit `state` **une fois** et le retire de l'adresse (`history.replaceState`) : un
   rechargement ne relance rien.
3. `state` est validé (zod) : action `open` ou `create`, identifiants `[A-Za-z0-9_-]` de 10 à 200 caractères,
   clés de ressource et compte au format attendu ; tout le reste est ignoré (y compris `exportIds`, documents
   Google). Les identifiants ne servent qu'à des chemins de l'API Drive, encodés (`encodeURIComponent`) ; rien
   n'est inséré dans la page, aucun lien n'est suivi.
4. Un bandeau propose « Se connecter et ouvrir » (ou « Créer le projet »). Rien n'est lu avant ce clic, qui
   autorise aussi la fenêtre de connexion. Le compte attendu est suggéré (`login_hint` = `userId`)
   **[à vérifier : `userId` accepté comme indication de compte]**.
5. **Ouvrir** : métadonnées (nom, type, version, révision de tête, dossier parent, droit de modification), puis
   contenu ; ouverture par la chaîne habituelle (signature : archive v2 ou JSON v1). L'emplacement devient ce
   fichier Drive avec sa version : « Enregistrer » y réécrit avec la stratégie prudente. Plusieurs fichiers
   sélectionnés : le premier est ouvert, les autres sont signalés.
   - fichier **en lecture seule** pour ce compte : « Enregistrer » crée un nouveau fichier dans « Mon Drive » ;
   - fichier **v1** (converti) ou ouvert en récupération : nouveau fichier dans le même dossier, l'original n'est
     jamais réécrit ;
   - `project.json` d'un dossier de projet Voltaplan : ouvert comme dossier ;
   - dossier, document Google, fichier inaccessible : message clair, rien n'est ouvert.
6. **Nouveau** (`create`) : nouveau projet vide ; le premier « Enregistrer » crée `<titre>.voltaplan` dans le
   dossier choisi (création seule, jamais de remplacement), puis les enregistrements suivants le mettent à jour.

Tests (simulés) : `test/driveOpenWith.test.ts` (paramètre valide, invalide, malveillant ; adresse nettoyée ;
ouverture avec version ; lecture seule ; v1 ; dossier ; création), `test/cloudFolders.test.ts` (création dans le
dossier choisi). Non vérifié : tout ce qui dépend du vrai service (affichage dans « Ouvrir avec », consentement,
`login_hint`, accès `drive.file` au fichier ouvert, création dans un dossier non créé par Voltaplan, en-têtes
`Location` et `Range` des envois « resumable » lisibles depuis le navigateur).
