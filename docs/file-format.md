# Format de fichier Voltaplan (`.voltaplan`)

Deux formats coexistent ; le type est reconnu par la **signature** du fichier, jamais par son extension :

| Début du fichier | Format | Lecture | Écriture |
|---|---|---|---|
| `PK\x03\x04` | **v2 : archive ZIP** (depuis novembre 2026) | oui | oui (format par défaut) |
| `{` (éventuellement précédé d'un BOM) | **v1 : JSON unique**, images intégrées en base64 | oui, indéfiniment | « Exporter au format v1 » seulement |
| `<?xml` | Trikker (`.trik`) | import | export |

Les fichiers `.openrgie` (ancien nom de l'application) s'ouvrent toujours. Décisions : [ADR-0004](adr/0004-format-projet-v2-zip.md)
(principe), [ADR-0006](adr/0006-format-v2-implementation.md) (implémentation) ; spécification :
[SPEC-FORMAT-V2](strategie/SPEC-FORMAT-V2.md) ; mesures : [format-v2-performance.md](format-v2-performance.md).

**Type MIME** (décision du 2026-11-24) : **`application/vnd.voltaplan+zip`** pour l'archive v2, partout où un type
est déclaré : entrée `mimetype` de l'archive, boîte « Enregistrer sous » du navigateur (`types.accept`), envois
Google Drive (`mimeType` du fichier), `file_handlers` du manifeste PWA, intégration « Ouvrir avec » de Google Drive,
filtre « Importer un fichier .voltaplan » des dossiers de projet. Les anciens fichiers v1 (JSON, `.voltaplan` ou
`.openrgie`) gardent `application/json` et s'ouvrent toujours : le manifeste accepte les deux types, Drive
reconnaît aussi l'extension `.voltaplan`. Le type n'est qu'une indication : la lecture se fait toujours d'après la
signature. OneDrive et Dropbox reçoivent le contenu en `application/octet-stream` (exigé par Dropbox, sans effet
sur OneDrive) ; dans un dossier de projet, `project.json` est en `application/json` et chaque document garde son
propre type (`image/jpeg`…). Le type `vnd.` n'est pas enregistré auprès de l'IANA **[à envisager si l'application
est largement diffusée]**. L'application de bureau (Tauri) ne déclare pas d'association de fichiers pour
l'instant (rien à harmoniser).

## 1. Le modèle (`project.json`)

JSON lisible, encodé en UTF-8 — la même structure en v1 et en v2 :

```jsonc
{
  "format": "voltaplan",        // ou "openrgie" (ancien), toujours lisible
  "version": 2,                 // version du MODÈLE (src/model/migrate.ts : CURRENT_VERSION) ; 1 en v1
  "meta": { … },                // projet : client, adresse, installateur, alimentation, référentiel, dates, dérogations
  "roots": [ … ],               // arbre de l'installation : { id, kind, props, children, location?, source? }
  "loose": [ … ],               // éléments non raccordés
  "plan": { "pages": [ … ], "width": 20000, "height": 15000 },   // millimètres
  "measurements": { … },        // terre, isolement, essais des différentiels (par id de nœud)
  "boards": { "<id du tableau>": { "slots": { "<id>": { "row": 0, "col": 0 } }, "photo": …, "checks": … } },
  "evidence": { … }             // dossier de preuves de l'assistant (facultatif ; dans l'archive : sources.json)
}
```

Le modèle complet et commenté est dans `src/model/types.ts`. Les propriétés de chaque type d'élément (`props`) sont
décrites dans `src/model/schema.ts` (`PROP_SCHEMAS`).

**Images** (fonds de plan `plan.pages[].images[].href`, photo de tableau `boards[].photo.href`) :

- v1 : image intégrée `data:image/…;base64,…` (réduite à 2 400 px ; l'original était perdu) ;
- v2 : référence `asset:<sha256>` (64 chiffres hexadécimaux) vers le **document original** (photo, PDF), rangé à
  part ; l'image d'affichage en est dérivée et régénérable. Les petites images des meubles importés de Trikker
  restent intégrées. Toute autre adresse (http:, javascript:, file:…) est retirée à la lecture
  (`src/io/sanitize.ts`).
- Le modèle v2 porte `version: 2` : une ancienne version de Voltaplan le refuse (« mettez à jour ») au lieu d'en
  retirer en silence les images.

## 2. Archive v2

```
mimetype                       « application/vnd.voltaplan+zip », PREMIÈRE entrée, stockée sans compression
manifest.json                  format, versions, liste des fichiers (taille, SHA-256, rôle, nom d'origine)
project.json                   le modèle (§ 1), sans le dossier de preuves
sources.json                   { "format": "voltaplan-sources", "version": 1, "evidence": … } (facultatif)
README.txt                     explication en clair (FR, NL, EN) : récupération sans Voltaplan
assets/<sha256>.<ext>          documents originaux, stockés sans recompression (jpg, png, webp, gif, heic, heif,
                               avif, tif, pdf)
derived/<sha256>-<rôle>.<ext>  images d'affichage (facultatives, régénérables ; Voltaplan n'en écrit pas
                               aujourd'hui, mais les lit si elles sont listées dans le manifest)
```

`manifest.json` :

```json
{
  "format": "voltaplan", "formatVersion": 2, "minReaderVersion": 2,
  "app": { "name": "Voltaplan", "version": "0.1.0" },
  "createdAt": "…", "savedAt": "…",
  "files": [
    { "path": "project.json", "size": 481233, "sha256": "…", "role": "model" },
    { "path": "assets/9f…c2.jpg", "size": 3145728, "sha256": "9f…c2", "role": "original", "mime": "image/jpeg", "name": "tableau.jpg" }
  ]
}
```

- `minReaderVersion` : une version future qui n'ajoute que des éléments facultatifs garde `2` et reste lisible ; un
  changement incompatible l'augmente (message « mettez à jour »).
- Textes en deflate niveau 9 ; médias stockés tels quels. Entrées écrites sans descripteur de données (en-têtes
  locaux complets : récupération possible d'une archive tronquée).
- Bibliothèque : zip.js (BSD-3-Clause), version « native », sans worker, chargée à la demande, derrière l'interface
  interne de `src/format/zip.ts`.

### Lecture et validation (`src/format/archive.ts`)

Une archive est une donnée non fiable. Seuls le répertoire central (fin du fichier), le manifest, le modèle et
les sources sont lus à l'ouverture ; chaque document est vérifié à son premier accès (puis copié dans le stockage
de travail), ou par la vérification complète (`verifyArchive`).

| Contrôle | Règle | En cas d'échec |
|---|---|---|
| Chemins | liste blanche ci-dessus ; `..`, chemin absolu, `\`, non-ASCII, caractères de contrôle refusés | entrée isolée et signalée ; inconnue : ignorée |
| Structure | doublons, données avant ou après l'archive, répertoires centraux multiples (archive ambiguë) | archive refusée |
| Entrées | lien symbolique, entrée chiffrée, méthode autre que « stockée » ou « deflate » | entrée isolée |
| Tailles | plafonds par type, total, nombre d'entrées (`src/format/limits.ts`) ; taux de compression ≤ 100:1 au-delà de 1 Mo ; taille réellement produite bornée pendant la décompression | entrée isolée, ou archive refusée (modèle) |
| Intégrité | CRC-32 du ZIP, puis taille et SHA-256 du manifest ; le nom d'un document est son SHA-256 | document isolé ; modèle différent du manifest : mode de récupération |
| Type | signature (« magic bytes ») cohérente avec l'extension ; SVG, HTML et tout format actif refusés | document isolé |
| Modèle | chaîne habituelle : taille, migration, zod, nettoyage des images, intégrité | ouverture refusée (message explicite) |

Le CRC-32 n'est pas une protection cryptographique : l'identité d'un document est son SHA-256, vérifié à chaque
lecture (archive, dossier, stockage de travail).

**Mode de récupération** : entrée invalide, document manquant, manifest absent ou incohérent, archive tronquée →
le reste s'ouvre, le problème est signalé, et « Enregistrer » demande toujours un nouvel emplacement (l'original
n'est jamais remplacé sans confirmation).

## 3. Projet en dossier (F8)

Même contenu logique, à plat, dans un dossier cloud (OneDrive, Dropbox, Google Drive) ou un répertoire local
(« Exporter en dossier ») :

```
<Projet>/project.json            modèle ET dossier de preuves : le SEUL fichier modifiable, écrit en dernier,
                                 de façon conditionnelle (eTag OneDrive, rev Dropbox, stratégie prudente
                                 Google Drive, date et taille sur disque)
<Projet>/assets/<sha256>.<ext>   documents originaux, immuables, envoyés une seule fois
<Projet>/README.txt              explication en clair (écrit une fois)
<Projet>/project (conflit …).json  copie de conflit éventuelle, à côté (les documents sont partagés)
```

- Pas de `manifest.json` ni de `sources.json` séparés : ce seraient des fichiers modifiables de plus, impossibles à
  écrire de façon atomique avec le modèle. Les documents se vérifient par leur nom (empreinte).
- **Enregistrement** : documents manquants d'abord (vérifiés : taille annoncée, ou relecture et SHA-256 en option),
  modèle ensuite. Une coupure laisse au pire des documents en plus ; l'enregistrement suivant reprend où il
  s'était arrêté. Un changement de format du modèle ne renvoie aucun document. Un document distant de même nom
  mais de taille différente arrête tout (rien n'est publié, rien n'est remplacé). **Rien n'est jamais supprimé** :
  l'interface de stockage n'a pas d'opération de suppression (`src/format/storageBackend.ts`).
- **Ouverture** : le modèle d'abord ; les documents sont téléchargés quand on les affiche, vérifiés, puis gardés
  dans le stockage de travail.
- **Portabilité** : « Exporter en .voltaplan » donne l'archive à tout moment ; une archive s'importe dans un dossier
  (`importArchiveToFolder`, bouton « Importer un fichier .voltaplan… ») ; un projet passe d'un service à l'autre
  (`transferFolder`, ou « Enregistrer comme dossier de projet » chez un autre service), sans rien supprimer à la
  source.
- **Services** : OneDrive (`src/io/oneDriveFolder.ts`, If-Match), Dropbox (`src/io/dropboxFolder.ts`, mode
  `update` avec la révision, `strict_conflict`), Google Drive (`src/io/driveFolder.ts`, sans If-Match : stratégie
  prudente de [google-drive.md](google-drive.md) § 8). Gros documents : session d'envoi par tranches (OneDrive au-delà
  de 250 Mo, Dropbox au-delà de 150 Mo, Drive « resumable » au-delà de 5 Mo) **[limites à vérifier]**.

## 4. Stockage de travail (navigateur)

IndexedDB, base `voltaplan` (version 3) : `projects` (projets du navigateur et brouillons, modèle seul), `versions`
(versions locales, modèle seul), `assets` (documents originaux par SHA-256, un seul exemplaire), `derived`
(images d'affichage, cache). 20 versions d'un projet de 500 Mo occupent donc environ 500 Mo + 20 × le modèle.

Un document référencé par un projet du navigateur, un brouillon, une version gardée ou le projet ouvert (historique
d'annulation compris) n'est **jamais** supprimé ; un document ajouté depuis moins de 7 jours non plus. Selon le
remplissage : images dérivées d'abord, puis versions au-delà du plafond, puis documents qu'aucun modèle ne
référence (`src/format/assets.ts`).

## 5. Compatibilité

- **v1 → v2** : à l'ouverture, les images intégrées sont rangées dans le stockage de travail ; un avertissement
  unique l'annonce ; le fichier d'origine n'est jamais réécrit (« Enregistrer » demande un emplacement).
  Le fichier v1 est lu par tranches (images base64 décodées au fil de la lecture, sans garder le texte complet :
  `scanV1`, src/format/migrateV1.ts) ; un contenu inhabituel repasse par la lecture habituelle.
- **v2 → v1** : « Exporter au format v1… » écrit une copie JSON lisible par les anciennes versions et liste ce qui
  n'a pas pu être gardé : plan PDF d'origine (remplacé par l'image de sa première page), originaux HEIC/TIFF
  (remplacés par une image réduite), documents sources de l'assistant (seule leur description reste), documents
  indisponibles, fichier de plus de 50 Mo.
- Google Drive, Dropbox, OneDrive (fichier) et GitHub enregistrent l'archive v2 et relisent les deux formats.

## 6. Références entre parties

Un élément existe une seule fois dans l'arbre ; les autres parties le désignent par son `id` :
symboles du plan, emplacements et vérifications du tableau, essais des différentiels, éléments connus à la dernière
mise à jour (`meta.syncedIds`), dérogations. La liste à jour est en tête de `src/model/integrity.ts` ; supprimer un
élément retire toutes ces références (`pruneReferences`).

## 7. Lecture et migration du modèle

À l'ouverture (fichier, navigateur, GitHub, Drive, OneDrive, Dropbox, brouillon), `parseProjectText` :

1. refuse un JSON invalide ou tronqué, un format inconnu, ou une **version plus récente** que l'application
   (message explicite, rien n'est ouvert à moitié) ;
2. applique les étapes de migration `MIGRATIONS[n]` (version n → n + 1 ; 1 → 2 : structure inchangée) ;
3. valide la structure (zod) en **conservant les champs inconnus** (un fichier d'une version future mineure ne
   perd rien) et complète les listes absentes ;
4. contrôle l'intégrité (`validateProject`) et **signale** les incohérences sans rien supprimer.

Changer le modèle de façon incompatible = incrémenter `CURRENT_VERSION`, ajouter l'étape de migration et son test.

## 8. Données sensibles

Un projet contient des données personnelles (nom et adresse du client, plans, photos). Les fichiers de test réels
(`test/fixtures/*.trik`, `*.jpg`) ne sont jamais publiés (`.gitignore`) ; les tests du format v2 fabriquent leurs
archives et leurs images. Aucun secret (clé d'IA, jeton) n'est enregistré dans le projet.
