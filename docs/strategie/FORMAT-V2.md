# Format de projet v2 — étude

Statut : **proposition**, à transformer en ADR après décision. Rien n'est implémenté.

## 1. Exigences retenues

1. Lecture des anciens formats : JSON v1 `.voltaplan` et `.openrgie`.
2. Conservation des documents originaux (photos, PDF), sans les réduire.
3. Structure interne documentée, avec un manifest et un numéro de version du format.
4. Export du projet sous forme de répertoire.
5. Données récupérables sans Voltaplan.
6. Protection contre les archives corrompues ; validation sécurisée des archives importées.
7. Bonnes performances avec beaucoup de photos et de gros PDF ; pas de reconstruction complète à chaque petite
   modification.
8. Place prévue pour les sources et les propositions de l'assistant (voir [ASSISTANT.md](ASSISTANT.md)).

**Constat sur le code actuel.** L'import d'un fond de plan (`src/io/background.ts`) ne garde que la première page
d'un PDF, réduite à 2 400 px en JPEG. **L'original est perdu.** L'exigence 2 demande de changer ce comportement : on
garde l'original et on en dérive une image d'affichage.

## 2. ZIP ou 7z : mesures

**Banc d'essai local** (script dans le scratchpad, données non publiées) :

- 20 photos de 4 032 × 3 024 pixels, JPEG qualité 88, dérivées d'une vraie photo de tableau ;
- 2 PDF scannés de 4 pages à 300 dpi ;
- un modèle texte de 472 ko (volume de trois projets Trikker réels).

Total : 26,8 Mo. Outils : Python `zipfile` et 7-Zip natif (multi-cœur), sous Windows 11.

| Variante | Taille | % de l'original | Création | Lecture du modèle seul |
|---|---|---|---|---|
| ZIP, deflate 9 partout | 25,70 Mo | 95,8 % | 1,06 s | 17,5 ms |
| **ZIP, médias stockés + texte en deflate 9** | **26,51 Mo** | **98,8 %** | **0,08 s** | **2,6 ms** |
| 7z LZMA2 -mx9 solide | 24,75 Mo | 92,3 % | 4,17 s | 902,9 ms |
| 7z LZMA2 -mx9 non solide | 25,30 Mo | 94,3 % | 2,51 s | 69,6 ms |

Modèle seul : 472 ko brut, 152 ko en deflate 9, 132 ko en 7z mx9.

**Lecture des résultats :**

- **Le gain du 7z est marginal.** Il est de 1,8 Mo sur 26,8 Mo, soit 6,5 % de moins que le ZIP à médias stockés.
  Ce gain est probablement **surestimé** : les photos de test viennent d'une même image, ce que la compression
  solide exploite. Avec des photos réelles et différentes, on peut s'attendre à moins **[à confirmer sur un vrai
  projet]**.
- **Le 7z solide va contre l'exigence 7.**
  - Toute modification oblige à recompresser l'archive entière : 4,2 s ici, avec un 7-Zip natif multi-cœur.
  - Dans un navigateur (WebAssembly, souvent un seul cœur), il faut s'attendre à plusieurs fois plus ; sur
    téléphone, davantage encore **[ordre de grandeur à mesurer]**.
  - Pour un projet de 300 Mo, on parle de minutes à chaque enregistrement.
- **Il ralentit aussi la lecture** : ouvrir un projet demande d'extraire le modèle, 345 fois plus lentement ici.
- **Le ZIP à médias stockés se construit presque instantanément** : 0,08 s, essentiellement de la copie et un CRC.
- **Disponibilité** :
  - le ZIP est lu nativement par Windows, macOS, iOS (Fichiers), Android et Linux ;
  - le 7z est lu nativement par Windows 11 récent ; il faut souvent un logiciel tiers ailleurs **[à vérifier par
    plateforme]** ;
  - aucun navigateur ne lit ni n'écrit le 7z ;
  - pour le ZIP, une petite bibliothèque suffit (`fflate`, MIT, sans dépendance **[à vérifier]**) ; pour le 7z,
    il faudrait embarquer 7-Zip compilé en WebAssembly (licence LGPL avec restriction unRAR, taille à vérifier).
- **Sécurité** : le 7z ajoute un analyseur complexe, compilé, à surveiller (mises à jour de sécurité de 7-Zip).

**Recommandation : ZIP**, avec la méthode choisie fichier par fichier :

- deflate 9 pour `project.json`, `manifest.json` et les textes ;
- stockage sans compression pour JPEG, PNG, HEIC, PDF, WebP et MP4.

## 3. Structure interne proposée

```
manifest.json            format, version du format, version de Voltaplan, date, liste des fichiers
                         (chemin, taille, SHA-256, type MIME, rôle)
project.json             modèle (le JSON v1 actuel, images remplacées par des références d'assets)
sources.json             documents sources, liens « information → source », propositions en attente (ASSISTANT.md)
assets/<sha256>.<ext>    fichiers originaux (photos, PDF, plans), nommés par leur empreinte
derived/<sha256>-<rôle>.jpg   images d'affichage dérivées (réduites, redressées) : régénérables, donc facultatives
README.txt               explication en clair de la structure, pour un humain qui ouvre l'archive
```

- **Nommage par empreinte** : pas de chemins absolus, un fichier ajouté deux fois n'est stocké qu'une fois, et
  l'intégrité est vérifiable.
- **Classement « photos / plans / documents »** : c'est une **métadonnée** de `sources.json` (catégorie, étiquette
  libre, date, appareil). Ce n'est pas un dossier. L'export en répertoire, lui, peut ranger par catégorie (§ 5).
- **Version du format** : `manifest.format = "voltaplan"`, `manifest.formatVersion = 2`. La chaîne de migration
  existante (`src/model/migrate.ts`) prend en charge v1 → v2.
- **Détection à l'ouverture** :
  - le fichier commence par `PK\x03\x04` : c'est une archive v2 ;
  - il commence par `{` : c'est du JSON v1, lu comme aujourd'hui ;
  - l'extension ne suffit jamais.

## 4. Performances : ne jamais tout reconstruire pour une petite modification

Principe : **séparer l'état de travail du fichier enregistré.**

1. **État de travail** dans le navigateur :
   - `project.json` dans IndexedDB, réécrit à chaque modification (quelques centaines de ko, quelques
     millisecondes) ;
   - chaque asset dans IndexedDB ou OPFS sous son empreinte, **écrit une seule fois** à son ajout.
   - Une modification ordinaire ne touche donc **jamais** aux photos.
   - Cela remplace aussi le brouillon automatique unique actuel.
2. **Enregistrement du fichier** (« Enregistrer », ou automatiquement sur bureau) : l'archive est assemblée **en
   flux**.
   - Les médias sont stockés, sans recompression ; leur CRC-32 est calculé une fois et mis en cache.
   - Seuls `project.json`, `sources.json` et `manifest.json` sont recompressés.
   - Coût proche du temps d'écriture du disque. Ordre de grandeur : 0,08 s pour 27 Mo ici, donc environ 1 s pour
     300 Mo sur ordinateur **[à mesurer sur téléphone]**.
3. **Écriture sûre** :
   - File System Access : `createWritable()` écrit dans un fichier temporaire et ne remplace l'original qu'au
     `close()` ;
   - Tauri : écriture dans `<nom>.tmp` puis renommage ;
   - cloud : envoi complet, conditionnel (voir [STOCKAGE-ET-DOMAINE.md](STOCKAGE-ET-DOMAINE.md)).
4. **Optimisation possible plus tard** : réécrire en place seulement la fin du ZIP (modèle et répertoire central).
   Ce n'est utile que si les mesures sur téléphone le justifient, car c'est plus complexe et plus fragile.
5. **Mémoire** :
   - les images sont manipulées en `Blob` et en URL d'objet, jamais en base64 ;
   - les PDF sont rendus page par page avec pdf.js ;
   - une photo de 12 Mpx décodée occupe environ 48 Mo : on affiche les images dérivées, pas les originaux.
6. **Taille maximale** : remplacer la limite unique de 50 Mo par des limites par fichier (photo, PDF) et une limite
   totale **[valeurs à fixer après mesures ; par exemple 2 Go en tout]**. Avertir au-delà de 500 Mo.

## 5. Export en répertoire et récupération sans Voltaplan

- **« Exporter en dossier »** :
  - sur bureau (Tauri, ou Chromium avec `showDirectoryPicker`), le projet est écrit dans un répertoire, avec
    `photos/`, `plans/`, `documents/` selon les catégories, sous les noms d'origine ;
  - ailleurs, le ZIP lui-même fait office d'export : une fois décompressé, c'est un dossier.
- **Récupération sans Voltaplan** : il suffit d'ouvrir le `.voltaplan` avec n'importe quel outil ZIP. Le
  `README.txt` explique la structure, et `sources.json` donne le nom d'origine de chaque fichier.
- **Ouverture d'un répertoire** (relecture d'un export) : possible sur bureau ; non prioritaire.

## 6. Archives corrompues ou malveillantes : validation

| Risque | Protection |
|---|---|
| Chemins sortant de l'archive (`../`, chemins absolus, `\`) | refus : seuls les chemins de la liste blanche (`manifest.json`, `project.json`, `sources.json`, `README.txt`, `assets/<hex>.<ext>`, `derived/…`) sont lus ; tout le reste est ignoré |
| Bombe de décompression | taille décompressée déclarée et réelle plafonnée par fichier et au total ; rapport de compression maximal ; arrêt de la lecture en flux au dépassement |
| Entrées en double, liens symboliques, entrées chiffrées | refus |
| Contenu altéré ou tronqué | CRC-32 du ZIP, puis SHA-256 du manifest pour chaque asset ; un asset invalide est signalé et isolé, le reste du projet s'ouvre |
| Type trompeur | type déterminé par la signature (« magic bytes »), pas par l'extension ; images décodées avec les limites actuelles (`src/io/limits.ts`) |
| Modèle invalide | chaîne actuelle : validation zod, migration, nettoyage des images, contrôle d'intégrité |
| SVG ou HTML dans l'archive | refusés, ou traités comme données inertes, jamais insérés dans la page |
| Archive partiellement lisible | **mode de récupération** : ouvrir ce qui est valide, lister ce qui manque, ne jamais réenregistrer par-dessus l'original sans confirmation |

Chaque protection aura son test, avec des archives piégées fabriquées dans les tests et jamais de fichiers réels.

## 7. Compatibilité

- Lecture du v1 (JSON) : **conservée indéfiniment**.
- Écriture :
  - un projet v1 ouvert puis enregistré devient v2, avec un avertissement unique ;
  - « Enregistrer une copie au format v1 » reste possible tant que le projet ne contient pas de documents
    originaux, pour l'échange avec une version plus ancienne de Voltaplan.
- Un fichier v2 ouvert par une ancienne version de Voltaplan affiche aujourd'hui « fichier non reconnu ». Il
  faut faire évoluer le message pour inviter à mettre à jour l'application.

## 8. Estimation

| Partie | Complexité |
|---|---|
| Lecture et écriture ZIP, manifest, migration v1 → v2, tests | M (1 à 2 semaines) |
| Stockage de travail par asset (IndexedDB ou OPFS), images en Blob | M |
| Conservation des originaux PDF et photo, images dérivées | S à M |
| Validation de sécurité et mode de récupération | S à M |
| Export en répertoire (bureau) | S |
| **Total** | **environ 4 à 6 semaines** à temps partiel, tests compris |
