# Prévention des pertes de données, contrôle de version, migration de domaine

Statut : **proposition**, rien n'est implémenté. Les comportements des fournisseurs sont décrits d'après leur
documentation, que j'ai consultée de mémoire **[à vérifier sur les pages officielles avant l'implémentation]**.

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

### 5.3 Conséquences sur les autres chantiers

- Les identifiants OAuth « officiels » du projet ne doivent être enregistrés **qu'une fois le domaine choisi**.
- La CSP et le manifest ne changent pas : ils utilisent des chemins relatifs.
- Le guide, les liens du README et `site/` doivent être mis à jour au moment de la bascule.
