# Format v2 — performances mesurées

> **Mesures Node sur ordinateur, pas mobile.** Elles valident le principe (lecture sélective, écriture en flux,
> mémoire bornée) ; elles ne disent rien d'un téléphone. Les mesures mobiles se font avec le protocole manuel du
> § 4, **[à faire]**.

## 1. Banc d'essai

- Script : `tools/perf-v2/run.ts` (`npx vite-node --options.node.execArgv=--expose-gc tools/perf-v2/run.ts
  [10,50,100,250,500]`, ou `npm run perf:v2`). Il utilise le code réel de `src/format` et `src/io`.
- Corpus **100 % synthétique**, généré à chaque exécution dans un dossier temporaire du système puis supprimé :
  « photos » de 3 à 5 Mo et « PDF » de 2 à 40 Mo au contenu aléatoire (incompressible, comme de vrais JPEG et
  PDF), signatures de fichier valides ; modèle de 400 circuits et 1 600 points. Aucune donnée réelle.
- Documents lus sur le disque avec `fs.openAsBlob` (équivalent Node du `File` du navigateur : lecture par tranches).
- Brouillon : IndexedDB simulé en mémoire (`fake-indexeddb`) : la durée réelle d'IndexedDB dans un navigateur sera
  plus longue **[à mesurer]**.
- Mémoire : pic de RSS et du tas JavaScript, échantillonné toutes les 5 ms, au-dessus du niveau de départ.
- Machine : Node 20.17, AMD Ryzen 5 PRO 5650U (12 fils), 25 Go de mémoire, SSD, Windows 11. Le 24/11/2026.

## 2. Résultats

| Taille visée | Documents | Archive | Enregistrement complet | Mém. enreg. (RSS) | Ouverture | Mém. ouverture (RSS / tas) | Lecture 1 photo | Lecture plus gros PDF | Vérification complète | Brouillon (modèle seul) | Ajout photo 5 Mo |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 10 Mo | 3 | 12,5 Mo | 294 ms | +35 Mo | 83 ms | +7 / +13 Mo | 31 ms | 15 ms (3 Mo) | 88 ms | 14 ms | 18 ms |
| 50 Mo | 12 | 53,9 Mo | 525 ms | +16 Mo | 49 ms | +2 / +12 Mo | 19 ms | 57 ms (11,8 Mo) | 260 ms | 7 ms | 20 ms |
| 100 Mo | 15 | 102 Mo | 866 ms | +34 Mo | 44 ms | +5 / +10 Mo | 18 ms | 129 ms (40 Mo) | 406 ms | 5 ms | 17 ms |
| 250 Mo | 52 | 253 Mo | 1,7 s | +0 Mo | 39 ms | +0 / +6 Mo | 17 ms | 122 ms (40 Mo) | 933 ms | 5 ms | 19 ms |
| 500 Mo | 92 | 501 Mo | 3,8 s | +36 Mo | 46 ms | +7 / +11 Mo | 16 ms | 141 ms (40 Mo) | 1,8 s | 8 ms | 19 ms |

Migration v1 → v2 d'un projet v1 de 46,7 Mo (10 photos intégrées en base64) : voir § 2.1 (mémoire réduite de
+184 Mo à +34 Mo).

### 2.1 Migration v1 → v2 : mémoire (24/11/2026)

Banc dédié : `tools/perf-v2/migration.ts` (`npm run perf:v2:migration [taille en Mo]`). Projet v1 synthétique de
46,7 Mo (10 photos aléatoires de 3,5 Mo en base64), **écrit sur le disque et lu avec `fs.openAsBlob`** comme le
`File` du navigateur (le premier banc partait d'un `Blob` en mémoire, d'où +319 Mo : il comptait aussi la copie du
fichier). Stockage de travail en mémoire : les 35 Mo de documents rangés sont **inclus** dans la mesure. Trois
exécutions avant, neuf après, Node 20.17, même machine.

| Lecture | Durée | Mémoire (pic RSS) |
|---|---|---|
| Avant : texte complet, objet JSON, chaînes base64 et copies décodées en même temps | 474 à 646 ms | **+184 Mo** |
| Après : lecture par tranches de 4 Mo, images décodées au fil de la lecture en `Blob` (`scanV1`) | 0,6 à 1,9 s | **+34 Mo** en général (de +13 à +74 Mo sur 9 exécutions), dont 35 Mo de documents rangés |

- Le surcoût mémoire, hors documents rangés, devient négligeable : le texte qui reste (modèle sans ses images) est
  petit, aucune chaîne base64 n'est créée.
- La durée augmente (décodage base64 en JavaScript au lieu de `atob`, empreinte calculée pendant la lecture puis
  au rangement), et reste sous l'objectif de 3 s.
- Contenu inhabituel (échappement `\u`, caractère hors base64) : repli sur la lecture habituelle (mémoire d'avant).
- **Mesures Node sur ordinateur, pas mobile** ; sur téléphone **[à mesurer]** (protocole du § 4).

Lecture : « Lecture 1 photo » et « plus gros PDF » comprennent la vérification complète du document (taille,
signature, SHA-256). « Ouverture » ne lit aucun document. Les valeurs varient de ±30 % d'une exécution à l'autre
(cache disque, ramasse-miettes) ; l'ordre de grandeur est stable.

## 3. Lecture des résultats et décisions

| Objectif (SPEC § 9, ordinateur) | Mesure | Verdict |
|---|---|---|
| Ouverture < 1 s jusqu'à 500 Mo | 46 ms à 500 Mo | atteint, indépendant de la taille (seul le modèle est lu) |
| Mémoire < 300 Mo à 500 Mo | +7 Mo à l'ouverture, +36 Mo à l'enregistrement | atteint |
| Enregistrement complet < 3 s pour 500 Mo | 3,8 s | **dépassé de peu** (débit ~130 Mo/s, limité par la lecture et l'écriture disque) |
| Petite modification < 50 ms | 5 à 14 ms (IndexedDB simulé) | atteint ici, **[à mesurer dans un navigateur]** |
| Ajout d'une photo de 5 Mo < 500 ms | ~20 ms (sans l'image d'affichage, qui demande un canvas) | atteint pour la partie format |
| Migration v1 de 50 Mo < 3 s | 0,6 à 1,9 s | atteint ; mémoire +34 Mo (avant : +184 Mo, § 2.1) |

- **Empreintes SHA-256** : Web Crypto est environ 12 fois plus rapide que le calcul en JavaScript
  (`tools/perf-v2/sha-bench.ts` : 35 ms contre 455 ms pour 40 Mo). Il est donc utilisé jusqu'à 64 Mo (au prix
  d'une copie temporaire du document en mémoire) ; au-delà (PDF de 64 à 200 Mo), le calcul se fait par tranches de
  4 Mo, à environ 90 Mo/s, avec une mémoire bornée. Avant ce réglage (seuil 32 Mo), le PDF de 40 Mo prenait 600 à
  830 ms.
- **Vérification complète** : environ 280 Mo/s ; elle n'est pas faite à l'ouverture (chaque document est vérifié
  à son premier accès, puis copié dans le stockage de travail en arrière-plan).
- **Migration v1** : le pic de mémoire venait du format v1 lui-même (tout le projet en une chaîne JSON, images en
  base64) ; la lecture par tranches le supprime presque entièrement (§ 2.1). Sur un appareil à peu de mémoire :
  **[à vérifier sur mobile]**.
- **Plafonds (F5)** : rien dans ces mesures n'impose d'abaisser les plafonds proposés sur ordinateur. Ils
  restent **provisoires** : 2 Go est un plafond de sécurité, jamais une capacité garantie. Sur un appareil donné,
  la limite réelle est l'espace de stockage (copie de travail) et, pour les rares entrées compressées, la mémoire
  (`deviceLimits`, `capacityAdvice` dans `src/format/limits.ts`) ; l'utilisateur reçoit un message explicite
  (« projet volumineux », « espace insuffisant pour une copie de travail »).

## 4. Protocole mobile (manuel, avant chaque version)

**Appareils** : Android d'entrée de gamme (≤ 4 Go, Chrome) ; iPhone d'au moins 5 ans (Safari, puis PWA
installée) ; une tablette.

**Préparation** (sur ordinateur) : `npx vite-node tools/perf-v2/run.ts 10,50,100,250,500 --keep` laisse les
archives synthétiques dans le dossier temporaire indiqué ; les copier sur l'appareil (câble, ou dossier OneDrive
de test). Aucune donnée réelle.

**Pour chaque taille** (application en ligne, puis hors ligne) :

1. Ouvrir l'archive (Fichier → Ouvrir). Chronométrer jusqu'à l'affichage du projet ; noter la mémoire (Chrome :
   `chrome://inspect` → Performance monitor ; Safari : Web Inspector → Timelines → Memory).
2. Afficher la vue Tableau (photos) puis la vue Plan (PDF) : temps jusqu'à l'image affichée.
3. Modifier un circuit : vérifier qu'aucune latence n'est perceptible (brouillon).
4. Enregistrer (Fichier → Enregistrer) : durée ; rouvrir le fichier obtenu et vérifier qu'il est identique.
5. Ajouter une photo prise avec l'appareil photo : durée jusqu'à l'affichage.
6. Fermer l'onglet pendant la copie en arrière-plan, rouvrir : le brouillon et les documents déjà copiés sont là.
7. Déplacer ou renommer le fichier pendant la session (Android : gestionnaire de fichiers) : les documents déjà
   affichés restent visibles, les autres affichent « document illisible », sans plantage.

**Critères** (SPEC § 9) : ouverture < 3 s jusqu'à 500 Mo, aucun plantage à 500 Mo, enregistrement < 15 s pour
500 Mo, ajout d'une photo < 2 s. Consigner les résultats dans ce document (appareil, système, navigateur, date).

**Non vérifié à ce jour** : tout ce qui précède sur mobile ; Safari iOS et `CompressionStream('deflate-raw')`
(zip.js version native, repli JavaScript inclus) ; quotas IndexedDB réels avec des centaines de Mo de documents.
