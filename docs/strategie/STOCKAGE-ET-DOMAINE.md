# Prévention des pertes de données, contrôle de version, migration de domaine

Statut :

- **§ 1 à 4 implémentés le 2026-11-24** (voir § 6) ;
- **§ 5 (domaine) reste une proposition** : aucune migration n'est faite.

Les comportements des fournisseurs sont décrits d'après leur documentation, consultée de mémoire et testée avec des
réponses simulées **[à vérifier sur les pages officielles et avec de vrais comptes]**.

## 1. Principe

**Aucune écriture n'écrase une version que l'utilisateur n'a pas vue.** Chaque enregistrement se fait en
quatre temps :

1. il est d'abord **sauvé localement**, dans les versions IndexedDB ;
2. puis il est **conditionnel**, sur la version lue à l'ouverture ;
3. en cas de refus, Voltaplan crée une **copie de conflit** et prévient l'utilisateur ;
4. l'**état** est toujours affiché.

## 2. État actuel (code)

| Emplacement | Écriture actuelle | Risque |
|---|---|---|
| Fichier local, File System Access (`src/io/files.ts`) | réécrit le fichier choisi | écrase une modification faite ailleurs (autre onglet, autre appareil, client de synchronisation) |
| Fichier, Tauri | écriture directe | idem, et un fichier tronqué en cas d'interruption pendant l'écriture |
| Navigateur (`src/io/storage.ts`) | IndexedDB ; **un seul** brouillon automatique | deux onglets se remplacent mutuellement le brouillon **[à confirmer par un test]** ; éviction possible sans `persist()` |
| Dropbox (`src/io/cloud.ts`) | `mode: overwrite` | écrasement silencieux |
| OneDrive | `PUT …:/content`, sans condition | écrasement silencieux |
| Google Drive | `PATCH`, sans condition | écrasement silencieux |
| GitHub | relit le `sha` juste avant d'écrire | revient à écraser : le `sha` utilisé n'est pas celui de l'ouverture |

## 3. Mécanismes de contrôle de version par fournisseur

| Fournisseur | Identifiant de version | Écriture conditionnelle | En cas de conflit |
|---|---|---|---|
| **OneDrive / Microsoft Graph** | `eTag` (contenu et métadonnées), `cTag` (contenu) | en-tête `If-Match: <eTag>` sur `PUT /content` et sur la création d'une session d'envoi (fichiers volumineux) ; `@microsoft.graph.conflictBehavior` = `fail` / `rename` / `replace` | réponse **412 Precondition Failed** ; on enregistre alors une copie, avec `conflictBehavior: rename` ou un nom explicite |
| **Dropbox** | `rev` (révision), `content_hash` | `files/upload` avec `mode: {".tag": "update", "update": "<rev>"}` ; `autorename: true` possible | erreur `path/conflict` ; avec `autorename`, Dropbox crée lui-même « nom (conflit…) » |
| **Google Drive (API v3)** | `version` (entier croissant), `headRevisionId`, `md5Checksum`, `modifiedTime` | **pas d'écriture conditionnelle fiable** dans l'API v3 **[à vérifier : les ETag de la v2 ne sont plus garantis]** | relire `version` juste avant l'envoi et comparer à celle de l'ouverture ; si différent, créer une copie. Il reste une petite fenêtre de course : relire après l'envoi, et si une version intermédiaire est apparue, le signaler (Drive garde l'historique des révisions, rien n'est perdu côté Drive) |
| **GitHub (API Contents)** | `sha` du blob | `PUT /contents/{path}` avec le `sha` **mémorisé à l'ouverture** | **409 Conflict** (ou 422) : enregistrer dans une copie, ou dans une branche dédiée |
| **Fichier local (File System Access)** | `File.lastModified` et taille | relire `getFile()` avant d'écrire et comparer à la valeur de l'ouverture (pas d'écriture atomique conditionnelle) | proposer « Enregistrer sous… » ou une copie à côté ; écriture via `createWritable()` (fichier temporaire, remplacement au `close()`) |
| **Fichier local (Tauri)** | date de modification et taille (`stat`) | même comparaison, puis écriture dans `.tmp` et renommage atomique | copie à côté |
| **Navigateur (IndexedDB)** | compteur de révision dans l'enregistrement | transaction `readwrite` qui compare la révision | copie ; avertissement entre onglets (`BroadcastChannel`) |

**Copie de conflit** : `Maison Dupont (conflit 2026-11-24 14h02 — Tablette).voltaplan`, dans le même dossier.
L'utilisateur voit les deux fichiers et choisit. **Aucune fusion automatique.**

## 4. Sauvegarde locale et état visible

- **Versions locales** : les 20 dernières versions de chaque projet ouvert, plus une par jour sur 30 jours **[à
  ajuster]**, dans IndexedDB. Avec le format v2, seul `project.json` est versionné ; les assets sont partagés.
- `navigator.storage.persist()` est demandé à la première sauvegarde. L'espace utilisé est affiché, avec
  `storage.estimate()`.
- Fenêtre « Historique » : restaurer une version, ou l'enregistrer comme copie.
- **Indicateur d'état** permanent dans la barre :
  - « Enregistré sur cet appareil » ;
  - « Enregistré dans OneDrive à 14h02 » ;
  - « Modifications non envoyées (hors ligne) » ;
  - « Conflit : copie créée » ;
  - « Erreur d'enregistrement ».
- **Fermeture avec des modifications non enregistrées dans un fichier** : avertissement (`beforeunload`), et
  rappel de l'existence de la version locale.
- **Envoi en attente** : la dernière version non envoyée reste dans IndexedDB. Elle est envoyée au retour du réseau
  (`online`) ou à la réouverture, toujours de façon conditionnelle. Pas de Background Sync : indisponible sur
  iOS **[à vérifier]**.

**Complexité** :

- détection de conflit sur les 6 emplacements, avec ses tests : S à M (1 à 2 semaines) ;
- versions locales et historique : S à M ;
- indicateur d'état : S.

## 5. Migration de domaine (voltaplan.org ou voltaplan.eu)

### 5.1 Le problème

Le stockage du navigateur est lié à l'**origine** (schéma, hôte, port). Ce stockage comprend l'IndexedDB (projets
du navigateur et brouillon), le `localStorage` (langue, réglages, réglages de l'IA, clé d'IA chiffrée, jeton
GitHub chiffré, identifiants OAuth), la PWA installée et le service worker.

Passer de `https://sebastienbatteur.github.io` à `https://voltaplan.org` **ne transfère rien automatiquement**. Les
fichiers `.voltaplan` enregistrés sur disque ou dans le cloud ne sont pas concernés.

**Point de vigilance** : quand on configure un domaine personnalisé sur un site GitHub Pages, l'ancienne adresse
`github.io/voltaplan` est **redirigée** vers le nouveau domaine **[à vérifier]**. Si c'est le cas, l'ancienne
origine n'affiche plus jamais Voltaplan, et ses données deviennent inaccessibles depuis l'application. Il faut donc
**garder l'ancienne origine active** pendant la transition.

### 5.2 Stratégie proposée

1. **Choisir le domaine maintenant, migrer avant la publication publique** : le nombre d'utilisateurs à migrer
   reste faible.
   - Enregistrer `voltaplan.org` **et** `voltaplan.eu` (une dizaine d'euros chacun par an **[à vérifier]**), l'un
     redirigeant vers l'autre. Le `.eu` exige un titulaire établi dans l'Union européenne, ce qui convient.
   - Recommandation : `.org` comme adresse principale, plus neutre pour l'international.
2. **Héberger le nouveau domaine sans toucher à l'ancien site**, au choix :
   - (a) un second dépôt GitHub Pages, par exemple `voltaplan/voltaplan.github.io` dans une organisation GitHub
     `voltaplan`, avec le domaine personnalisé ;
   - (b) Cloudflare Pages ou Netlify (gratuits), qui permettent aussi de vrais en-têtes HTTP de sécurité.
   - L'ancien site `sebastienbatteur.github.io/voltaplan` continue d'être publié par le dépôt actuel, **dans une
     version de transition**.
3. **Version de transition sur l'ancienne origine** : au lancement, un bandeau annonce que Voltaplan déménage et
   propose « Transférer mes projets et réglages ». Le transfert se fait **de navigateur à navigateur**, sans
   serveur :
   - l'ancienne page ouvre `https://voltaplan.org/#transfert` dans une nouvelle fenêtre ;
   - la nouvelle page envoie « prête » à `window.opener`, avec l'origine cible exacte ;
   - l'ancienne page envoie, **uniquement** à l'origine `https://voltaplan.org`, les projets IndexedDB, le
     brouillon et les réglages. La clé d'IA et le jeton GitHub partent **toujours chiffrés**, la phrase secrète
     restant la même ;
   - la nouvelle page vérifie `event.origin`, puis passe **chaque projet par la chaîne de validation habituelle**
     (taille, migration, zod, nettoyage des images). Elle refuse tout le reste ;
   - elle affiche le résultat, par exemple « 12 projets transférés, réglages repris », et l'ancienne page marque le
     transfert comme fait.
   - **Solution de secours** : « Tout exporter dans un fichier » sur l'ancienne origine, puis « Importer » sur la
     nouvelle. Elle fonctionne même si une fenêtre est bloquée.
4. **PWA installée** : l'ancienne application installée affiche le bandeau et un lien pour installer la nouvelle.
   On ne peut pas déplacer une PWA installée d'une origine à l'autre.
5. **OAuth** : enregistrer la nouvelle adresse de redirection **en plus** de l'ancienne chez Microsoft, Google et
   Dropbox, et retirer l'ancienne après la transition. Google demande une page de confidentialité et la
   vérification du domaine.
6. **Durée** : garder l'ancienne origine active **au moins 12 mois**. Ensuite, page fixe « Voltaplan a déménagé »,
   avec le bouton d'export toujours fonctionnel. On ne supprime jamais une origine qui peut contenir des données.
7. **Service worker de l'ancienne origine** : la version de transition doit être servie même aux PWA hors ligne.
   Le service worker actuel prend la page en « réseau d'abord », donc la mise à jour arrive dès la prochaine
   ouverture en ligne.

**Complexité** :

- domaine et hébergement : S (administratif) ;
- page de transfert et tests : S à M (environ 1 semaine) ;
- suivi : faible, sur 12 mois.

### 5.3 Options de migration comparées

| Option | Fonctionnement | Données du navigateur | Risque | Coût |
|---|---|---|---|---|
| **A. Domaine personnalisé sur le dépôt actuel** | réglage « Custom domain » de GitHub Pages | **perdues pour l'application** si GitHub redirige l'ancienne adresse **[à vérifier]** : l'ancienne origine n'exécute plus Voltaplan, donc rien ne peut lire ses données | élevé | minimal |
| **B. Nouveau site à part, ancien site en transition** (recommandé) | nouveau domaine servi par un second dépôt Pages ou par Cloudflare Pages ; l'ancien site publie une version de transition | **transférées** par l'utilisateur (§ 5.2), ou exportées en fichier | faible | un second déploiement à maintenir 12 mois |
| **C. Rester sur `github.io`** | aucun changement | conservées | origine partagée avec les autres sites du compte ; adresse liée à un compte personnel | nul |
| **D. Redirection seule (`voltaplan.org` → `github.io`)** | le domaine renvoie vers l'adresse actuelle | conservées | ne règle ni l'origine partagée ni la dépendance au compte | environ 10 € par an |

**Risques liés au stockage du navigateur, quelle que soit l'option :**

- **Un stockage par origine.** Rien ne passe d'une origine à l'autre sans action de la page.
- **Éviction.** Le stockage non persistant peut être effacé si le disque manque de place. Sur Safari, il peut l'être
  après 7 jours sans visite pour un site non installé **[à vérifier]**.
- **Navigation privée et effacement des données de site** : tout est perdu.
- **PWA installée** : elle reste liée à l'ancienne origine ; il faut la réinstaller.
- **Clés et jetons chiffrés** : le transfert garde le chiffrement, mais l'utilisateur doit se souvenir de sa phrase
  secrète.

**Mécanismes de transfert sans serveur, du plus simple au plus confortable :**

1. **Export en fichier** : un `.voltaplan` par projet, ou une archive de sauvegarde globale. Il fonctionne partout,
   y compris quand l'ancienne origine ne peut plus ouvrir de fenêtre.
2. **`postMessage` entre fenêtres** (§ 5.2) : un clic. L'origine cible et l'origine source sont vérifiées
   strictement, et chaque projet passe par la validation habituelle.
3. **Fragment d'URL** (`#données`) : à exclure. La taille est limitée, et les données pourraient se retrouver dans
   l'historique du navigateur.
4. **BroadcastChannel ou stockage partagé** : impossible entre origines différentes.

### 5.4 Conséquences sur les autres chantiers

- Les identifiants OAuth « officiels » du projet ne doivent être enregistrés **qu'une fois le domaine choisi**.
- La CSP et le manifest ne changent pas : ils utilisent des chemins relatifs.
- Le guide, les liens du README et `site/` doivent être mis à jour au moment de la bascule.

## 6. État d'implémentation (2026-11-24)

| Élément | Où | Testé |
|---|---|---|
| Erreur de conflit, nom de copie daté | `src/io/conflict.ts` | `test/saveFlow.test.ts` |
| OneDrive : `If-Match` (eTag), création en `conflictBehavior=fail` | `src/io/cloud.ts` | fetch simulé |
| Dropbox : mode `update` avec `rev`, création en `add`, sans renommage automatique | `src/io/cloud.ts` | fetch simulé |
| Google Drive : version comparée juste avant l'envoi | `src/io/cloud.ts` | fetch simulé |
| GitHub : SHA mémorisé à l'ouverture ; création sans écrasement ; remplacement seulement après confirmation | `src/io/storage.ts`, `src/ui/StorageDialog.tsx` | fetch simulé |
| Navigateur : révision par entrée, contrôlée dans la même transaction IndexedDB | `src/io/storage.ts` | **navigateur réel** (conflit simulé entre onglets) |
| Fichier local : date et taille comparées avant de réécrire (Chrome et Edge, Tauri) | `src/io/files.ts` | logique testée ; Tauri non compilé ici |
| Orchestration : copie de conflit au même endroit, attente hors ligne, version locale | `src/io/saveFlow.ts` | `test/saveFlow.test.ts` |
| Versions locales (20 par projet, 300 au total), fenêtre « Versions locales » | `src/io/storage.ts`, `src/ui/VersionsDialog.tsx` | navigateur réel |
| Brouillons par onglet, signal de vie, récupération après fermeture ou plantage ; « Mettre de côté » ne supprime rien | `src/io/storage.ts`, `src/App.tsx` | navigateur réel (mise à niveau de la base v1 → v2 sans perte) |
| Indicateur d'état (enregistré, en attente, conflit, erreur) | `src/App.tsx`, `src/styles.css` | navigateur réel |
| Nouvel essai automatique au retour du réseau | `src/App.tsx` | non testé automatiquement |

**Non vérifié** :

- comportement réel des API avec de vrais comptes (OneDrive, Dropbox, Drive, GitHub), en particulier
  l'exposition CORS de l'en-tête `Dropbox-API-Result` (une solution de repli est prévue) ;
- détection sur Tauri (droit `fs:allow-stat` ajouté, à compiler) ;
- sauvegarde sur un fichier local quand un client de synchronisation modifie la date sans changer le contenu (faux
  conflit possible, sans perte).

## 7. Vérification des six points demandés (2026-11-24)

### 7.1 Écritures conditionnelles : atomiques ou non ?

| Emplacement | Vérification et écriture en une opération côté serveur ? | Fenêtre de course | Si elle se produit |
|---|---|---|---|
| OneDrive | **oui** : `If-Match` est évalué par le serveur au moment de l'écriture | aucune | 412 : copie de conflit |
| Dropbox | **oui** : `mode: update` avec `rev` est évalué par le serveur | aucune | 409 : copie de conflit |
| GitHub | **oui** : le `sha` est évalué par le serveur | aucune | 409 : copie de conflit |
| Navigateur (IndexedDB) | **oui** : lecture et écriture dans la même transaction | aucune | conflit : copie |
| Google Drive | **non** : l'API v3 n'a pas d'écriture conditionnelle **[à vérifier]** | entre la vérification et la fin de l'envoi | stratégie conservatrice : la révision remplacée et la nôtre sont marquées « à conserver indéfiniment » avant et pendant l'envoi (sinon, pas d'envoi) ; une course est détectée après coup et la version de l'autre appareil recopiée. **Aucune garantie d'absence d'écrasement tant que ce n'est pas vérifié avec de vrais comptes**, voir [tests-cloud-reels.md](../tests-cloud-reels.md) |
| Fichier local (Chrome, Edge) | **non** : aucune écriture conditionnelle sur un fichier | entre la lecture de la date et l'écriture (quelques millisecondes) | risque résiduel accepté ; écriture atomique par `createWritable` |
| Fichier local (Tauri) | **non** | idem | idem ; écriture **non atomique** (pas de renommage, car les droits Tauri limitent l'écriture au fichier choisi) : protégée par le brouillon écrit **avant** chaque enregistrement |

### 7.2 Attente persistante après fermeture

**Corrigé.** Un enregistrement en attente (pas de réseau, ou reconnexion nécessaire) est mémorisé dans le stockage
local : emplacement visé, nom et date, sans le contenu, qui est dans les versions locales.

Au lancement suivant, le bandeau « Enregistrement en attente depuis le… — Reprendre / Plus tard » s'affiche.
« Reprendre » rouvre la dernière version locale de cet emplacement et l'envoie, toujours de façon conditionnelle :
un conflit donne une copie, jamais un écrasement.

Testé : simulation dans le navigateur, et tests automatiques.

### 7.3 Interruption pendant l'enregistrement

**Corrigé.** Le brouillon de l'onglet est écrit **avant** chaque enregistrement ; il est supprimé seulement après la
réussite.

| Destination | Fermeture, plantage ou coupure pendant l'écriture |
|---|---|
| Chrome et Edge (fichier) | l'original reste intact (fichier temporaire, remplacé seulement à la fin) |
| Tauri (fichier) | le fichier peut rester incomplet ; le brouillon est proposé au lancement suivant |
| OneDrive, Dropbox, Drive, GitHub | l'envoi est atomique côté serveur : l'ancienne version reste en place ; le brouillon est proposé |
| Navigateur | transaction IndexedDB : tout ou rien |
| Dossier de projet (format v2) | documents d'abord, modèle en dernier : jamais de modèle publié qui référence un document absent ; reprise sans renvoyer les documents présents ; dossier local : fichier vide laissé par la coupure complété ensuite |

Format v2 (2026-11-24) : une erreur pendant l'écriture d'un fichier (Chrome, Edge) ne ferme jamais le fichier
temporaire (l'original n'est pas remplacé) ; l'écriture d'une archive peut être interrompue (`AbortSignal`) sans
rien publier. Testé avec des pannes simulées (`test/formatIntegrity.test.ts`).

### 7.4 Jetons expirés

**Corrigé.** Un 401 (jeton expiré ou révoqué) efface le jeton, puis la connexion est refaite **une fois**.

Si le navigateur bloque la fenêtre de connexion, ce qui arrive lors d'une reprise automatique sans clic :

- la version est gardée et l'envoi mis en attente ;
- le message « Connexion à OneDrive à refaire… cliquez sur Enregistrer » s'affiche ;
- le clic suivant ouvre la connexion.

Pour GitHub, un 401 donne le même comportement, et la fenêtre de déverrouillage s'ouvre si le jeton est verrouillé.

### 7.5 Conservation des deux versions en cas de conflit

| Cas | Leur version | Notre version |
|---|---|---|
| Conflit détecté avant l'écriture (tous les services) | intacte, au même endroit | copie datée au même endroit, plus une version locale « Conflit » |
| Google Drive, détecté après l'envoi | recopiée en copie datée (aussi dans l'historique Drive) | à sa place, plus une version locale |
| Copie impossible (réseau coupé entre-temps) | intacte | version locale « Conflit », envoi en attente |
| Fichier local | intacte | choix de l'utilisateur : copie ou remplacement confirmé ; version locale dans les deux cas |

### 7.6 Quotas du navigateur

**Corrigé.**

- **Rétention adaptée à l'espace utilisé** (`storage.estimate()`) :
  - moins de 50 % utilisé : 20 versions par projet (300 au total) ;
  - de 50 à 80 % : 10 (150) ;
  - au-delà de 80 % : 3 (50).
- **Stockage plein pendant l'ajout d'une version** : on ne garde qu'une version par **autre** projet, puis on
  réessaie. Les projets du navigateur et les brouillons ne sont **jamais** supprimés pour faire de la place.
- **Stockage plein pendant un enregistrement dans le navigateur** : message clair (« enregistrez le projet en
  fichier ou supprimez d'anciennes versions »).

Avec le format v2, les versions ne dupliqueront plus les photos ni les PDF (voir la séparation du stockage dans
[SPEC-FORMAT-V2.md § 11](SPEC-FORMAT-V2.md)).

- **Format v2, stockage plein pendant l'ajout d'un document** (photo, migration d'un ancien projet) : les images
  d'affichage (cache régénérable) sont libérées d'abord, puis un seul nouvel essai ; jamais un document. Toujours
  plein : migration → image laissée intégrée au projet (signalé) ; ajout d'une photo → image réduite intégrée
  (comme au format v1 ; l'utilisateur n'en est pas encore prévenu **[à ajouter dans l'interface]**).

### 7.7 Destination pleine (disque, espace du service, fichier trop gros)

**Corrigé (2026-11-24), testé avec des réponses simulées [à vérifier avec de vrais comptes].**

| Destination | Signal reconnu | Résultat |
|---|---|---|
| Fichier de l'appareil (Chrome, Edge) | `QuotaExceededError` pendant `write()` | « Plus de place sur le disque » ; original intact |
| OneDrive (fichier ou dossier) | 507 Insufficient Storage, `quotaLimitReached` | « Espace OneDrive plein » |
| Dropbox | 409 `path/insufficient_space` | « Espace Dropbox plein » (un 409 `conflict` reste un conflit) |
| Google Drive | 403 `storageQuotaExceeded` (pas `rateLimitExceeded`) | « Espace Google Drive plein » |
| GitHub | archive > 100 Mo (refusée avant envoi), 413, 422 « too large » | « Projet trop volumineux pour GitHub » |

Dans tous les cas : la version est gardée dans le navigateur (versions locales), rien n'est remplacé, et l'envoi
n'est **pas** mis en attente : une reprise automatique échouerait en boucle. L'utilisateur libère de la place puis
clique sur « Enregistrer ». Dossier de projet : les documents déjà envoyés restent (immuables), le modèle n'est
pas publié ; l'essai suivant reprend sans les renvoyer.

### 7.8 Fermeture brutale et deux appareils : garanties

Testé par simulation (`test/formatRecovery.test.ts`, `test/formatConflicts.test.ts`) ; tableau complet dans
[ADR-0006 § 13](../adr/0006-format-v2-implementation.md).

- **Mise à niveau d'IndexedDB interrompue** : annulée en entier par le navigateur, refaite au lancement suivant, sans
  perte.
- **Entre un document et le modèle** : un document est écrit et relu avant que le modèle le référence ; un modèle
  gardé (projet, brouillon, version) ne référence donc jamais un document absent. Un document orphelin est gardé
  7 jours.
- **Entre le brouillon et le fichier** : le brouillon de l'onglet fermé est proposé au lancement ; un envoi en
  attente aussi (« Reprendre »).
- **Deux appareils, dossier** : chacun ajoute sa photo en même temps → les deux photos sont dans le dossier, le
  perdant devient une copie de conflit qui référence la sienne. L'un retire une photo que l'autre référence encore
  → rien n'est supprimé à distance (l'interface n'a pas d'opération de suppression), la copie de conflit la
  retrouve.
- **Deux appareils, archive** (OneDrive, Dropbox, Google Drive, GitHub) : la copie de conflit est une archive
  complète, documents compris ; l'original de l'autre appareil n'est jamais réécrit.
- **Non garanti** : Tauri (écriture non atomique, autre chantier) ; Google Drive pendant l'envoi (§ 7.1) ;
  comportement réel des services et navigateurs **[à vérifier avec de vrais comptes et appareils]**.
