# Spécification — Format de projet v2 (`.voltaplan` en ZIP)

Statut : **à valider** avant toute implémentation. Date : 2026-11-24.
Décision de principe : [ADR-0004](../adr/0004-format-projet-v2-zip.md). Étude et mesures : [FORMAT-V2.md](FORMAT-V2.md).
Modèle de l'assistant (contenu de `sources.json`) : [SPEC-ASSISTANT-MODELE.md](SPEC-ASSISTANT-MODELE.md).

## 1. Contenu de l'archive

| Chemin | Obligatoire | Compression | Contenu |
|---|---|---|---|
| `mimetype` | oui, **premier**, non compressé | stockée | `application/vnd.voltaplan+zip` : identification rapide, sans tout lire (comme ODF et EPUB) |
| `manifest.json` | oui | deflate | voir § 2 |
| `project.json` | oui | deflate | modèle (structure v1 actuelle), images remplacées par des références `asset:<sha256>` |
| `sources.json` | non | deflate | dossier de preuves de l'assistant (`Evidence`) |
| `assets/<sha256>.<ext>` | non | **stockée** si l'original est déjà compressé (jpg, png, webp, heic, pdf, mp4), sinon deflate | originaux (photos, PDF, plans) |
| `derived/<sha256>-<rôle>.<ext>` | non | stockée | images d'affichage (réduites, redressées), régénérables |
| `README.txt` | oui | deflate | explication en clair, en FR, NL et EN |

**Tout autre chemin est ignoré à la lecture** (liste blanche) et signalé.

## 2. `manifest.json`

```json
{
  "format": "voltaplan",
  "formatVersion": 2,
  "minReaderVersion": 2,
  "app": { "name": "Voltaplan", "version": "0.2.0" },
  "createdAt": "2026-11-24T14:02:00Z",
  "savedAt": "2026-11-24T16:40:00Z",
  "files": [
    { "path": "project.json", "size": 481233, "sha256": "…", "role": "model" },
    { "path": "assets/9f…c2.jpg", "size": 3145728, "sha256": "9f…c2", "role": "original", "mime": "image/jpeg", "source": "src_…" },
    { "path": "derived/9f…c2-display.jpg", "size": 402112, "sha256": "…", "role": "derived", "of": "9f…c2" }
  ]
}
```

- `minReaderVersion` : une version future qui ajoute des éléments **facultatifs** garde `minReaderVersion: 2` et
  reste lisible par une version plus ancienne de Voltaplan. Un changement incompatible l'augmente, et l'ancienne
  version affiche alors « mettez Voltaplan à jour » (message `file.error.newerVersion`, déjà existant).
- Les tailles et SHA-256 du manifest sont vérifiés à la lecture (§ 5).

## 3. Références aux médias depuis `project.json`

- Fonds de plan, photo du tableau : `href: "asset:<sha256>"` au lieu de `data:image/…;base64,…`.
- Lecture : le lien `asset:` est résolu en URL d'objet (`blob:`) d'une image **dérivée** pour l'affichage, et de
  l'original pour l'IA ou l'export.
- Le filtrage d'images actuel (`src/io/sanitize.ts`), qui n'accepte que les images intégrées, est étendu aux liens
  `asset:` existants dans l'archive. Tout autre lien reste refusé.

## 4. Écriture

1. **État de travail**, indépendant du fichier :
   - `project.json` et `sources.json` en mémoire et dans le brouillon IndexedDB (déjà en place, par onglet) ;
   - assets dans un magasin IndexedDB `assets` (clé : SHA-256, valeur : `Blob`), écrits **une seule fois** à leur
     ajout.
2. **Enregistrement** : assemblage **en flux** dans l'ordre `mimetype`, `manifest.json`, `project.json`,
   `sources.json`, `README.txt`, `assets/*`, `derived/*`.
   - Les médias stockés sont copiés tels quels ; leur CRC-32 est calculé une fois et mémorisé avec l'asset.
   - Destinations :
     - File System Access : `createWritable()` (fichier temporaire, remplacement à `close()`) ;
     - Tauri : écriture puis renommage (à confirmer selon les droits du système de fichiers de Tauri) ;
     - cloud : envoi conditionnel déjà en place, avec une session d'envoi au-delà du seuil du fournisseur.
3. **Ce qu'une petite modification réécrit** :
   - le brouillon IndexedDB : `project.json` seul, en quelques millisecondes ;
   - le fichier : au prochain « Enregistrer ». Les médias ne sont jamais recompressés.
4. **Bibliothèque** : écriture ZIP minimale **faite maison** (en-têtes locaux, répertoire central, ZIP64 si besoin
   au-delà de 4 Go), environ 200 lignes testées. La compression deflate utilise `CompressionStream('deflate-raw')`
   quand il existe, sinon `fflate` chargé à la demande **[licence et taille à vérifier]**.
   - La lecture et l'écriture en flux, dont nous avons besoin, sont simples à écrire ;
   - une bibliothèque complète chargerait l'archive en mémoire.

## 5. Lecture et validation

1. **Signature** :
   - `PK\x03\x04` : archive v2 ;
   - `{` : JSON v1, lu par la chaîne actuelle ;
   - autre : refus.
2. **Répertoire central lu en premier** : grâce à `File.slice()`, on lit la fin du fichier, sans charger toute
   l'archive en mémoire.
3. **Contrôles par entrée** :

   | Contrôle | Règle |
   |---|---|
   | Chemin | liste blanche du § 1 : pas de `..`, pas de chemin absolu, pas de `\`, en ASCII |
   | Entrées | pas de doublon, pas de lien symbolique (attributs externes), pas d'entrée chiffrée |
   | Taille | décompressée déclarée ≤ plafond par type (§ 6) ; taux de compression ≤ 100:1 pour les entrées deflate |
   | Intégrité | CRC-32 du ZIP, puis taille et SHA-256 annoncés par le manifest |
   | Type | signature (« magic bytes ») cohérente avec l'extension ; SVG et HTML refusés |

4. **Médias stockés sans compression** : ils deviennent des `Blob` obtenus par `File.slice(début, fin)`. **Aucune
   copie en mémoire** : un projet de 500 Mo s'ouvre en ne lisant que `project.json`. C'est le point clé pour les
   appareils à peu de mémoire.
5. **Modèle** : `project.json` passe par la chaîne existante (taille, migration, zod, nettoyage, intégrité).
6. **Mode de récupération** :
   - une entrée invalide est isolée et signalée (« 2 photos illisibles ») ;
   - le reste s'ouvre ;
   - le projet est marqué « récupéré », et « Enregistrer » ne réécrit jamais l'original sans confirmation : la
     première fois, il propose « Enregistrer sous ».
7. **Archive tronquée** (répertoire central absent) : on tente une lecture séquentielle des en-têtes locaux, pour
   récupérer au moins `project.json`.

## 6. Plafonds (proposés, à confirmer par les mesures)

| Élément | Plafond |
|---|---|
| `project.json` décompressé | 50 Mo (comme aujourd'hui) |
| Une photo | 50 Mo |
| Un PDF | 200 Mo |
| Archive totale | 2 Go ; avertissement au-delà de 500 Mo |
| Nombre d'entrées | 10 000 |

## 7. Migration v1 → v2

1. Les `data:` URL du JSON v1 sont décodées en assets (SHA-256), remplacées par `asset:<sha256>`, et le reste est
   conservé tel quel.
2. À la première sauvegarde d'un projet v1, un avertissement unique s'affiche : « Ce projet sera enregistré au
   nouveau format (archive). Les anciennes versions de Voltaplan ne pourront plus l'ouvrir. » On peut choisir
   « Enregistrer une copie au format v1 » tant que le projet ne contient pas de documents joints.
3. Les versions locales et les brouillons restent en JSON (seul le modèle est versionné) ; les assets sont partagés.

## 8. Export en répertoire

- Sur ordinateur (Tauri, ou Chromium avec `showDirectoryPicker`), « Exporter en dossier » écrit :
  - `Projet/projet.voltaplan.json` (modèle lisible) ;
  - `Projet/photos/`, `Projet/plans/`, `Projet/documents/`, sous les noms d'origine (catégorie de `sources.json`) ;
  - `Projet/LISEZMOI.txt`.
- Ailleurs, décompresser le `.voltaplan` avec l'outil du système donne le même contenu, nommé par empreinte. Le
  `README.txt` et `sources.json` font la correspondance avec les noms d'origine.

## 9. Plan de tests de performance

**Corpus généré** par un script (dans le dépôt, sans données réelles) : 10, 50, 100, 250 et 500 Mo, avec des
photos de 12 Mpx (3 à 5 Mo), des PDF de 2 à 40 Mo et un modèle de 400 circuits.

**Appareils** :

- ordinateur de référence ;
- Android d'entrée de gamme (≤ 4 Go de mémoire vive, Chrome) ;
- iPhone d'au moins 5 ans (Safari, et PWA installée) ;
- émulation « peu de mémoire » en CI : Chromium sans interface, sous Playwright, avec mémoire limitée
  **[faisabilité à vérifier]**.

**Mesures** :

| Mesure | Méthode | Objectif ordinateur | Objectif mobile |
|---|---|---|---|
| Ouverture jusqu'au premier affichage | `performance.now()` | < 1 s jusqu'à 500 Mo | < 3 s jusqu'à 500 Mo |
| Mémoire maximale | `performance.memory` (Chromium), profils | < 300 Mo à 500 Mo | aucun plantage à 500 Mo |
| Enregistrement complet | idem | < 3 s pour 500 Mo | < 15 s pour 500 Mo |
| Petite modification (brouillon) | idem | < 50 ms | < 200 ms |
| Ajout d'une photo de 5 Mo | idem | < 500 ms | < 2 s |
| Migration v1 → v2 (projet v1 de 50 Mo) | idem | < 3 s | < 10 s |

- **Automatisation** : les mesures sur ordinateur tournent en CI à chaque modification du format (avec une marge),
  et les résultats sont ajoutés au rapport du run.
- **Mobile** : protocole manuel documenté, relancé avant chaque version.

## 10. Décisions à valider

| # | Question | Recommandation |
|---|---|---|
| F1 | Entrée `mimetype` en tête (identification sans tout lire) | oui |
| F2 | Écriture ZIP faite maison, deflate natif ou `fflate` | oui (lecture et écriture en flux, peu de mémoire) |
| F3 | Médias en `Blob` découpés dans le fichier (aucune copie) | oui |
| F4 | Assets de travail dans IndexedDB (et non dans OPFS) | oui pour commencer (pris en charge partout, déjà utilisé) ; OPFS si les mesures l'exigent |
| F5 | Plafonds du § 6 | à confirmer après mesures |
| F6 | Images dérivées enregistrées dans l'archive (ouverture plus rapide) ou régénérées | enregistrées (facultatives) |
| F7 | Avertissement unique à la première sauvegarde d'un projet v1 | oui |

## 11. Révision après le retour du 2026-11-24 : séparation du stockage et cycle complet

### 11.1 Séparation des données (stockage de travail local)

| Catégorie | Contenu | Mutable ? | Stockage de travail (IndexedDB) | Versionné ? | Taille type |
|---|---|---|---|---|---|
| **Documents sources** | photos, PDF, plans originaux | **non** (immuables) | magasin `assets`, clé SHA-256, `Blob` ; **un seul exemplaire** quel que soit le nombre de versions | non (référencés par empreinte) | Mo à centaines de Mo |
| **Modèle électrique** | `project.json` | oui | brouillon et versions | **oui** (20 versions) | 0,1 à 1 Mo |
| **Métadonnées** | `sources.json` (preuves de l'assistant), manifest | oui | avec le modèle | oui, avec le modèle | 10 Ko à quelques Mo |
| **Brouillons** | modèle de l'onglet en cours | oui | magasin `projects` (déjà en place) | non (dernier état) | comme le modèle |
| **Dérivés et exports** | images d'affichage, PDF du dossier, exports Trikker | régénérables | magasin `derived` (cache) | non | variable |

**Conséquence** : 20 versions d'un projet de 500 Mo occupent environ 500 Mo plus 20 × 1 Mo, et non 20 × 500 Mo.
Une photo partagée par deux projets n'est stockée qu'une fois.

**Rétention selon l'espace disponible** (prolonge ce qui est déjà en place pour les versions) :

1. supprimer d'abord les **dérivés** (régénérables), les plus anciens en premier ;
2. puis les **versions** au-delà du plafond, réduit selon l'espace (20, 10 ou 3 par projet) ;
3. puis les **assets** qu'aucune version gardée ni aucun projet ouvert ne référence (ramasse-miettes par
   empreinte) ;
4. **jamais** : un asset référencé par le projet ouvert, un projet du navigateur ou un brouillon. Au-delà, on
   demande à l'utilisateur d'enregistrer en fichier.

### 11.2 Cycle complet : performances prévues

**À mesurer** selon le plan du § 9. Les durées ci-dessous sont des ordres de grandeur, fondés sur le banc
d'essai ZIP (0,08 s pour 27 Mo) et sur les débits courants.

| Opération | Ce qui est lu ou écrit | Ordre de grandeur, projet de 500 Mo |
|---|---|---|
| Ouverture d'un fichier local | répertoire central et `project.json` ; médias en tranches du fichier, sans copie | < 1 s |
| Modification | mémoire | instantané |
| Sauvegarde automatique (brouillon) | `project.json` seul, dans IndexedDB | < 50 ms |
| Enregistrement complet sur l'appareil | archive écrite en flux, médias copiés sans recompression | environ 1 à 3 s sur ordinateur (vitesse du disque) ; à mesurer sur mobile |
| Ajout d'une photo de 5 Mo | empreinte SHA-256 et stockage dans `assets`, une fois ; image dérivée | < 0,5 s |
| Suppression d'un document | retrait de la référence ; l'asset est libéré au prochain nettoyage | instantané |
| Export (dossier PDF, Trikker) | régénéré depuis le modèle | inchangé |
| **Enregistrement dans OneDrive** (archive unique) | **toute l'archive est renvoyée** | **environ 7 min à 10 Mbit/s en envoi** : inacceptable à chaque modification |
| Récupération après interruption | brouillon (modèle) et assets immuables déjà stockés | rien n'est perdu |

### 11.3 Proposition F8 : dossier de projet dans le cloud

Le seul vrai problème du cycle est l'envoi complet vers le cloud. La réponse simple, **sans synchronisation
différentielle**, consiste à stocker dans le cloud le **contenu de l'archive à plat** plutôt que l'archive :

```
OneDrive/Applications/Voltaplan/Maison Dupont/
  manifest.json        petit, réécrit à chaque enregistrement (écriture conditionnelle déjà en place)
  project.json         petit, réécrit à chaque enregistrement (conditionnel)
  sources.json         petit
  assets/<sha256>.jpg  envoyé UNE SEULE FOIS (immuable ; s'il existe déjà, on ne le renvoie pas)
```

- **Enregistrement** : les nouveaux assets sont envoyés d'abord, s'il y en a. Ensuite seulement le modèle,
  conditionnellement. Le modèle ne référence donc jamais un asset absent, même après une coupure.
- **Ouverture** : le modèle d'abord ; les photos sont téléchargées quand on les affiche, puis gardées dans le
  stockage de travail.
- **Conflit** : seul `project.json` est mutable, donc le mécanisme de conflit actuel s'applique tel quel.
- **Ce n'est pas un moteur de synchronisation** : il n'y a ni fusion, ni suivi des modifications, ni envoi
  différentiel d'un fichier. Des fichiers immuables nommés par leur contenu, plus un petit fichier conditionnel.
- **Portabilité** : « Exporter en `.voltaplan` » produit à tout moment l'archive unique, pour l'envoyer par
  courriel, la copier sur une clé USB ou l'ouvrir ailleurs. Le dossier cloud se lit aussi sans Voltaplan (des
  fichiers normaux).
- **Applicable à** OneDrive, Dropbox, Google Drive et GitHub. Le fichier local et Tauri gardent l'archive unique,
  car leur écriture est rapide.
