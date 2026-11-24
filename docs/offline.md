# Fonctionnement hors ligne (version web)

Voltaplan n'a pas de serveur : la version web est un ensemble de fichiers statiques (GitHub Pages,
`/<dépôt>/app/`). Un service worker garde une copie de ces fichiers dans le navigateur pour que
l'application fonctionne sans Internet. L'application de bureau (Tauri) n'en a pas besoin et n'en installe pas.

## Ce qui fonctionne hors ligne

Tout ce qui ne dépend pas d'un service extérieur, **y compris les fonctions jamais utilisées en ligne** :
schéma unifilaire, plan de position, tableau, contrôle RGIE, calculs, nomenclature, impression du dossier,
fonds de plan PDF (lecteur pdf.js et son « worker »), import et export Trikker, export Eendraadschema,
ouverture et enregistrement de fichiers sur l'appareil, projets gardés dans le navigateur.

Indisponible hors ligne (un repère « Hors ligne » s'affiche près du bouton IA) : l'IA (Anthropic, OpenAI,
Gemini, Mistral ; un modèle local Ollama / LM Studio reste joignable s'il tourne sur la machine), GitHub,
Google Drive, OneDrive, Dropbox.

## Stratégie de cache

- **À la construction** (`npm run build`), le greffon `voltaplan-sw` de `vite.config.ts` liste tous les fichiers
  écrits dans `dist/` (JS, CSS, morceaux chargés à la demande, lecteur PDF, icônes, manifeste, `index.html`,
  `oauth.html` ; sauf `sw.js` et les `.map`), calcule une **version** (empreinte SHA-256 des noms et contenus,
  `src/sw/precache.ts`) et écrit `dist/sw.js` à partir du modèle `src/sw/sw.js`.
- **Installation** : tous les fichiers de la liste sont copiés dans le cache `voltaplan-<version>`
  (environ 2,8 Mo aujourd'hui). Si un seul fichier manque, l'installation échoue et sera retentée : jamais de
  version à moitié en cache.
- **Requêtes** : seules les lectures (GET) de la même origine, dans la portée de l'application, passent par le
  cache. Les appels à l'IA, à GitHub ou aux services en ligne (autres origines) ne sont jamais interceptés ni
  mis en cache. Aucune donnée de projet ne passe par le service worker.
  - page de l'application : celle de la version installée (cohérente avec ses fichiers), réseau en secours ;
  - autres fichiers : copie de la version installée, sinon réseau, sans rien ajouter au cache.
- **Activation** : les caches des autres versions de Voltaplan (`voltaplan-*`) sont supprimés ; plus
  d'accumulation d'anciens fichiers.

## Mises à jour

Une nouvelle version publiée s'installe en arrière-plan (le navigateur vérifie `sw.js` à chaque ouverture,
et l'application le redemande toutes les heures si elle reste ouverte), puis **attend** : la page ouverte
continue avec ses propres fichiers, elle ne peut pas charger un morceau d'une autre version.

Le bandeau « Nouvelle version de Voltaplan disponible — Recharger » s'affiche alors
(`src/ui/UpdateBanner.tsx`, `src/appUpdate.ts`). En cliquant sur Recharger :

1. si le projet a des modifications non enregistrées, il est d'abord gardé comme **brouillon** dans le
   navigateur (le même que l'enregistrement automatique toutes les 20 s), et le bandeau le dit ; si le
   brouillon ne peut pas être gardé, on ne recharge pas et on demande d'enregistrer le projet ;
2. la page demande au nouveau service worker de prendre la main (message `SKIP_WAITING`) ;
3. la page se recharge quand il l'a prise (`controllerchange`), ou après 5 s au plus ;
4. au démarrage, le brouillon est proposé à la récupération comme d'habitude.

Autres onglets ouverts : quand la nouvelle version prend la main, ils affichent le même bandeau.
Fichier de l'ancienne version introuvable (sans service worker, par exemple) : même bandeau, rechargement
direct après le brouillon.

## Protection des données du navigateur

Les projets gardés dans le navigateur et le brouillon sont dans IndexedDB (base `voltaplan`), les réglages dans
`localStorage`. Par défaut, ce stockage est « au mieux » : le navigateur peut l'effacer s'il manque de place.
`src/io/persist.ts` demande un stockage **persistant** (`navigator.storage.persist()`) :

- automatiquement, une seule fois, au démarrage s'il y a déjà des projets ou un brouillon, et après un
  enregistrement dans le navigateur ;
- à la demande, avec le bouton « Protéger » de l'onglet « Navigateur » (Ouvrir / Enregistrer), qui affiche aussi
  la place utilisée et l'état de protection.

Le navigateur décide seul d'accorder ou non la protection. Chrome / Edge l'accordent selon l'usage du site
(application installée, favori, visites…) sans rien demander ; Firefox peut poser la question à l'utilisateur
[à vérifier selon la version]. Tout est facultatif : sans l'API, rien ne s'affiche et rien n'échoue.

**La copie en fichier reste la seule vraie sauvegarde** : vider les données du navigateur efface tout, protégé
ou non.

## Safari, iPhone et iPad

- Safari (macOS) et tous les navigateurs sur iPhone / iPad peuvent effacer les données d'un site (cache hors
  ligne, IndexedDB, localStorage) après quelques jours sans visite lorsqu'il n'est pas installé sur l'écran
  d'accueil [à vérifier : durée et conditions exactes selon la version d'iOS / Safari]. L'onglet « Navigateur »
  affiche donc le conseil : « Installez Voltaplan sur l'écran d'accueil ou enregistrez vos projets en fichier ».
- Application installée sur l'écran d'accueil : stockage séparé de celui de Safari [à vérifier].
- `navigator.storage.persist()` et `estimate()` : disponibles dans les versions récentes de Safari
  [à vérifier : version minimale] ; sinon, l'information n'est simplement pas affichée.
- La taille du cache (≈ 3 Mo) est bien en dessous des limites connues [à vérifier selon l'appareil].

## Vérifier

- `npm run build` affiche `service worker : N fichiers, version …` ; la liste est dans `dist/sw.js`
  (constante `MANIFEST`).
- Tests : `test/precache.test.ts` (liste et version), `test/serviceWorker.test.ts` (service worker exécuté avec
  caches et réseau simulés), `test/appUpdate.test.ts` (bandeau, brouillon, rechargement),
  `test/persist.test.ts` (protection du stockage).
- À la main : `npm run build && npx vite preview`, ouvrir la page, puis dans les outils de développement
  (Application → Service workers → Offline, ou Réseau → Hors ligne) recharger : l'application et les fonctions
  chargées à la demande (fond de plan PDF, import Trikker) doivent fonctionner.
