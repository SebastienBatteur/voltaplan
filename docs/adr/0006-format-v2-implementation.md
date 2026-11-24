# ADR-0006 — Format de projet v2 : implémentation

Date : 2026-11-24 · Statut : accepté (implémentation des décisions F1 à F8, ADR-0004)

## Contexte

[ADR-0004](0004-format-projet-v2-zip.md) a fixé le principe (archive ZIP, originaux gardés, manifest, validation).
Les décisions F1 à F8 ([DECISIONS.md](../strategie/DECISIONS.md)) et la comparaison des bibliothèques
([F2-COMPARAISON-ZIP.md](../strategie/F2-COMPARAISON-ZIP.md)) ont été validées. Description du format :
[file-format.md](../file-format.md). Mesures : [format-v2-performance.md](../format-v2-performance.md).

## Décisions

1. **Bibliothèque** : zip.js 2.25.0 (BSD-3-Clause), version « native » (`lib/zip-core-native.js`), chargée à la
   demande, `useWebWorkers: false` (CSP inchangée), lecture `strictness: 'strict'` (archives ambiguës refusées),
   `checkCrc32: true` (successeur de l'option `checkSignature`, dépréciée). Les noms d'entrées sont classés par
   notre liste blanche (`filenameValidation: 'tolerant'` côté bibliothèque) : un nom dangereux est isolé et signalé
   au lieu de rendre toute l'archive illisible ; il n'est jamais utilisé comme chemin. Tout passe par l'interface
   interne `src/format/zip.ts` (réversible).
2. **Lecture sélective (F3)** : un document stocké devient une tranche du fichier (`Blob.slice`), sans copie ; il
   est vérifié (taille, signature, SHA-256) à son premier accès, puis copié dans le stockage de travail ; une copie
   en arrière-plan fait de même pour les autres. Fichier déplacé, modifié ou supprimé pendant la session : les
   documents copiés restent disponibles, les autres donnent une erreur claire.
3. **SHA-256** : identité de chaque document (le CRC-32 du ZIP n'est pas une protection cryptographique). Web
   Crypto jusqu'à 64 Mo, calcul JavaScript par tranches au-delà (mémoire bornée).
4. **Stockage de travail (F4)** : IndexedDB, magasins `assets` (immuables, par SHA-256) et `derived` (cache) ; base
   en version 3 ; versions et brouillons ne contiennent que le modèle. Un document référencé par un projet, un
   brouillon, une version ou le projet ouvert (historique d'annulation compris) n'est jamais supprimé ; recherche
   des références volontairement large ; délai de grâce de 7 jours ; nouvelle vérification juste avant chaque
   suppression. IndexedDB indisponible : magasin en mémoire pour la session.
5. **Modèle en version 2** : `CURRENT_VERSION = 2` (structure inchangée, références `asset:<sha256>` possibles).
   Raison : une version précédente de Voltaplan (autre onglet, application mise en cache) qui lirait un brouillon v2
   retirerait en silence les images `asset:` ; elle refuse désormais le modèle avec « mettez à jour ».
6. **`project.json` dans l'archive, `sources.json` à part** (dossier de preuves de l'assistant, déplacé tel quel) ;
   **dans un dossier, `project.json` porte aussi les sources** : c'est le seul fichier modifiable, écrit de façon
   conditionnelle ; deux fichiers modifiables ne pourraient pas être écrits ensemble de façon atomique. Le contenu
   logique (modèle, sources, documents par empreinte) est le même ; seule la répartition physique diffère.
7. **Images dérivées (F6)** : régénérées (canvas, pdf.js) et gardées en cache ; non écrites dans l'archive pour
   l'instant (facultatives, et un dérivé libéré du cache pendant l'enregistrement ferait échouer celui-ci) ; lues
   si une archive en contient. L'image d'affichage garde les dimensions mémorisées dans le projet (calage des
   photos de tableau, détection des murs).
8. **Migration (F7)** : v1 → v2 à l'ouverture (fonds de plan et photos de tableau rangés dans le stockage de
   travail ; meubles Trikker laissés intégrés, l'export Trikker les lit en base64) ; avertissement unique à
   l'ouverture plutôt qu'au premier enregistrement (l'interface d'avertissement existante est celle de l'ouverture) ;
   l'original n'est jamais réécrit : un fichier converti ou récupéré n'a pas de destination par défaut,
   « Enregistrer » ouvre toujours « Enregistrer sous » (le système demande confirmation avant de remplacer un
   fichier). « Exporter au format v1 » liste ce qui ne peut pas être gardé.
9. **Écriture** : vérification préalable que tous les documents référencés par le modèle sont disponibles
   (`MissingAssetsError` sinon, rien n'est écrit) ; archive écrite en flux vers `createWritable()` (fichier
   temporaire, remplacé à la fermeture ; annulé en cas d'erreur) ; Tauri : archive assemblée puis écrite
   **[écriture atomique à vérifier]**. Google Drive, Dropbox, OneDrive (fichier) et GitHub enregistrent l'archive
   (envoi complet) et relisent les deux formats ; mécanismes de conflit inchangés.
10. **Dossiers (F8)** : interface `FolderBackend` sans opération de suppression ; documents écrits seulement s'ils
    sont absents, vérifiés (taille ; relecture et SHA-256 en option), **avant** le modèle ; modèle conditionnel ;
    copie de conflit dans le même dossier ; reprise naturelle après interruption (les documents présents ne sont
    pas renvoyés) ; import d'une archive dans un dossier et transfert entre services. Implémentations : OneDrive
    (Microsoft Graph : création `fail`, `If-Match`, session d'envoi par tranches en repli), Dropbox (mode `add` sans
    renommage pour les documents, `update` + révision + `strict_conflict` pour le modèle, session d'envoi au-delà de
    150 Mo), Google Drive (portée `drive.file`, dossiers marqués `appProperties`, recherche par nom avant envoi,
    envoi « resumable » au-delà de 5 Mo, modèle sans If-Match : stratégie prudente du point 12 et copie de la
    version concurrente dans le même dossier), répertoire local (File System Access), mémoire (tests). GitHub : à
    brancher. Choix « dossier de projet » ou « fichier unique » pour chaque service dans la boîte d'enregistrement.
    Google Drive « Ouvrir avec Voltaplan » : paramètre `state` validé, ouverture après un clic, voir
    [google-drive.md](../google-drive.md) § 9. Type MIME unique de l'archive : `application/vnd.voltaplan+zip`
    ([file-format.md](../file-format.md)).
11. **Plafonds (F5)** : provisoires (`src/format/limits.ts`) ; 2 Go est un plafond de sécurité, jamais une capacité
    garantie ; limites adaptées à la mémoire de l'appareil pour les entrées compressées, conseil selon l'espace de
    stockage (« projet volumineux », « pas de copie de travail possible »).
12. **Révisions Google Drive conservées** (fichiers v1 et archives) : gardées tant que le nombre (≤ 100) ET la
    taille totale (≤ max(10 × taille du fichier, 200 Mo)) le permettent ; jamais les 20 dernières, ni celles
    qu'un enregistrement en attente ou un conflit désigne encore (`pinsToReleaseBySize`). Ces révisions comptent
    dans l'espace de l'utilisateur **[à vérifier]**. Avec les dossiers, seul le modèle (petit) est réécrit.
13. **Pannes : ce qui est garanti** (testé avec des pannes et des réponses de services SIMULÉES :
    `test/formatIntegrity.test.ts`, `formatRecovery.test.ts`, `formatConflicts.test.ts`, `formatV1Scan.test.ts`).

    | Situation | Garanti (testé) | Non garanti / à vérifier |
    |---|---|---|
    | Erreur pendant l'écriture d'un fichier (Chrome, Edge) | `close()` jamais appelé : l'original n'est pas remplacé ; `abort()` si le flux n'est pas déjà en erreur ; erreur remontée ; brouillon gardé (supprimé seulement après réussite, App.tsx) | suppression effective du fichier temporaire par le navigateur **[à vérifier]** |
    | Disque plein (`QuotaExceededError` de `write()`) | `StorageFullError('device')`, message « plus de place sur le disque », original intact | code d'erreur réel selon le navigateur et le système **[à vérifier]** |
    | Écriture d'archive interrompue (`AbortSignal`) | jamais terminée (pas de répertoire central), destination jamais fermée | — |
    | Dossier cloud coupé après quelques documents | modèle non publié ; attente mémorisée (réseau) ; reprise sans renvoyer les documents présents | — |
    | Répertoire local coupé | fichier vide laissé par la coupure complété à l'essai suivant ; modèle jamais écrasé | Tauri (non branché) |
    | Espace du service épuisé : OneDrive 507 `quotaLimitReached`, Dropbox 409 `insufficient_space`, Drive 403 `storageQuotaExceeded` | `StorageFullError`, version gardée dans le navigateur, **aucune mise en attente** (pas de reprise en boucle), message traduit ; dossier : documents déjà envoyés gardés, modèle non publié | réponses réelles des services **[à vérifier avec de vrais comptes]** |
    | GitHub : archive de plus de 100 Mo | refusée avant tout envoi (`FileTooLargeError`) ; 413 ou 422 « too large » idem | message exact de GitHub **[à vérifier avec un vrai compte]** |
    | Stockage du navigateur plein (ajout d'une photo, migration v1) | images dérivées libérées, puis un seul nouvel essai ; sinon image gardée intégrée (migration) ou réduite (ajout) : rien de ce qui existe n'est perdu | ajout d'une photo : l'utilisateur n'est pas prévenu que seule l'image réduite est gardée **[à ajouter dans l'interface]** ; quotas réels **[à mesurer]** |
    | Fermeture brutale pendant la mise à niveau d'IndexedDB | transaction de mise à niveau annulée en entier ; refaite au lancement suivant (magasins manquants seulement), sans perte | — |
    | Fermeture brutale entre un document et le modèle | le document est écrit et relu AVANT que le modèle le référence : aucune référence vers un absent ; un document orphelin est gardé 7 jours (délai de grâce) | — |
    | Fermeture brutale entre le brouillon et le fichier | brouillon de l'onglet fermé proposé au lancement suivant ; envoi en attente proposé (« Reprendre ») avec sa version locale | Tauri : fichier possiblement incomplet (écriture non atomique, autre chantier) |
    | Deux appareils, dossier | documents immuables tous gardés ; le perdant devient une copie de conflit qui référence ses documents ; **aucune suppression distante** (pas d'opération de suppression) ; OneDrive, Dropbox et Google Drive simulés (`test/cloudFolders.test.ts`) ; Drive : deux dossiers `assets` créés en même temps lus ensemble, deux `project.json` créés en même temps → le second renommé en copie | GitHub en dossier : non branché ; services réels **[à vérifier avec de vrais comptes]** |
    | Deux appareils, archive (OneDrive, Dropbox, Drive, GitHub) | copie de conflit complète (documents compris), original de l'autre jamais réécrit | Google Drive : course pendant l'envoi (voir STOCKAGE-ET-DOMAINE § 7.1) |
14. **Migration v1 à mémoire réduite** : le fichier v1 est lu par tranches de 4 Mo ; les images base64 sont décodées
    au fil de la lecture en `Blob` (ni texte complet, ni chaîne base64), puis rangées ou réintégrées comme avant ;
    repli sur la lecture habituelle pour un contenu inhabituel. Mesure : +184 Mo → +34 Mo pour 47 Mo
    ([format-v2-performance.md](../format-v2-performance.md)).

## Conséquences

- Dépendances : `@zip.js/zip.js` 2.25.0 (BSD-3-Clause, mention de licence à conserver) ; en développement,
  `fake-indexeddb` 6.2.8 (Apache-2.0) pour tester la mise à niveau de la base IndexedDB.
- Une ancienne version de Voltaplan ne lit ni l'archive ni un modèle v2 : elle affiche « mettez à jour ».
  L'export v1 reste disponible.
- Une base IndexedDB ouverte par un onglet d'une version précédente bloque la mise à niveau : l'ouverture
  n'attend pas indéfiniment (« fermez les autres onglets »), l'enregistrement du fichier n'est pas bloqué.
- Tests : archives piégées fabriquées dans les tests (jamais de fichiers réels).

## Non vérifié

- Tout comportement sur mobile (protocole dans format-v2-performance.md) ; Safari iOS et `deflate-raw`.
- Services réels (OneDrive, Drive, Dropbox, GitHub) : limites d'envoi, redirections de téléchargement et adresses de
  session d'envoi hors de la CSP actuelle (`*.files.1drv.com`, `*.sharepoint.com`).
- Tauri : écriture atomique de l'archive.
- Pannes réelles : réponses des services quand l'espace est épuisé, disque plein réel, suppression du fichier
  temporaire après une erreur d'écriture (tableau du § 13, tout est simulé dans les tests).
- Navigateurs réels : durée d'IndexedDB avec des centaines de Mo de documents, quotas, éviction.
