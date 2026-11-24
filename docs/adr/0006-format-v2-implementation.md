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
    (Microsoft Graph : création `fail`, `If-Match`, session d'envoi par tranches en repli), répertoire local (File
    System Access), mémoire (tests). Dropbox, Google Drive et GitHub : à brancher sur la même interface.
11. **Plafonds (F5)** : provisoires (`src/format/limits.ts`) ; 2 Go est un plafond de sécurité, jamais une capacité
    garantie ; limites adaptées à la mémoire de l'appareil pour les entrées compressées, conseil selon l'espace de
    stockage (« projet volumineux », « pas de copie de travail possible »).
12. **Révisions Google Drive conservées** (fichiers v1 et archives) : gardées tant que le nombre (≤ 100) ET la
    taille totale (≤ max(10 × taille du fichier, 200 Mo)) le permettent ; jamais les 20 dernières, ni celles
    qu'un enregistrement en attente ou un conflit désigne encore (`pinsToReleaseBySize`). Ces révisions comptent
    dans l'espace de l'utilisateur **[à vérifier]**. Avec les dossiers, seul le modèle (petit) est réécrit.

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
- Navigateurs réels : durée d'IndexedDB avec des centaines de Mo de documents, quotas, éviction.
