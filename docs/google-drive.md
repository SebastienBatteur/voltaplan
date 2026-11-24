# Google Drive : protection contre les pertes, analyse détaillée

Date : 2026-11-24. **Rien de ce qui suit n'est vérifié avec de vrais comptes.** Les comportements de Drive sont
tirés de la documentation, consultée de mémoire et marquée **[à vérifier]**. Procédure de test :
[tests-cloud-reels.md](tests-cloud-reels.md).

**Nous ne garantissons pas l'absence de perte de données sur Google Drive avant ces tests.**

## 1. Ce que fait Voltaplan aujourd'hui (`src/io/cloud.ts`)

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
