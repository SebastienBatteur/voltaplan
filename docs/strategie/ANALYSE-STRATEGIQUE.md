# Voltaplan — Analyse stratégique et architecturale

Date : 2026-11-24. Base : dépôt `SebastienBatteur/voltaplan`, branche `main` (commit `d90f555`).
Document de discussion : **aucune implémentation** n'a été faite pour ces orientations.

> **Suite** : les décisions prises après ce document sont dans [DECISIONS.md](DECISIONS.md). Études détaillées :
> - [FORMAT-V2.md](FORMAT-V2.md) : format v2 ; ZIP plutôt que 7z, avec mesures ;
> - [STOCKAGE-ET-DOMAINE.md](STOCKAGE-ET-DOMAINE.md) : conflits, versions, migration de domaine ;
> - [ASSISTANT.md](ASSISTANT.md) : assistant de création de projets.

Convention : les points marqués **[à vérifier]** sont des faits externes (navigateurs, fournisseurs, prix, droit)
que je n'ai pas vérifiés à la source pendant cette analyse. Ils doivent l'être avant toute décision ou
communication publique.

---

## 0. Synthèse en une page

**La vision est réaliste, et une grande partie existe déjà.** Voltaplan est aujourd'hui une application 100 %
locale. Elle n'a aucun serveur : stockage dans le navigateur (IndexedDB), fichier local, GitHub, Google Drive,
OneDrive et Dropbox en direct depuis le navigateur. L'IA est optionnelle et multi-fournisseur, avec des modèles
locaux possibles. Elle a déjà un manifest PWA, un service worker et une application de bureau Tauri. Le moteur
RGIE est indépendant de l'interface et de l'IA.

**Le vrai travail n'est donc pas d'ajouter des briques, mais de fiabiliser ce qui existe.** Cinq faiblesses
comptent davantage que les nouvelles fonctions :

1. **Le format de fichier** : un seul JSON avec les photos et plans encodés en base64. Il est portable, mais lourd
   (+33 %), plafonné à 50 Mo, entièrement réécrit à chaque enregistrement, et sans place pour les documents
   joints (PDF, rapports).
2. **L'enregistrement dans le cloud écrase sans contrôle** (OneDrive, Dropbox, Google Drive). Si deux appareils
   modifient le même projet, le dernier enregistrement écrase le premier, sans avertissement. C'est le principal
   risque de perte de données.
3. **Le hors-ligne est incomplet** : le service worker ne met en cache à l'installation que la page d'accueil.
   Une fonction jamais utilisée en ligne (lecture PDF, export Trikker, IA) ne marche pas hors ligne. Rien ne
   demande au navigateur de protéger les données contre l'éviction.
4. **L'adresse du site** : `sebastienbatteur.github.io/voltaplan/` est une origine **partagée** avec tout autre
   site Pages du même compte. Changer d'adresse plus tard ferait perdre aux utilisateurs leurs projets gardés dans
   le navigateur, leurs réglages et leur PWA installée. **C'est la décision la plus urgente** (§ 13).
5. **La terminologie et la traçabilité** : « Schémas électriques conformes RGIE » (slogan) et « Aucune
   non-conformité détectée » promettent trop. Les dossiers n'indiquent ni la version de Voltaplan, ni la version
   des règles, ni les règles vérifiées.

**Mes principales remises en question de vos propositions :**

- **Pas de « un projet = un répertoire » comme format principal.** Un répertoire ne fonctionne ni sur iOS, ni dans
  Firefox et Safari, ni en pièce jointe d'un courriel, ni simplement dans un cloud par API. Je recommande
  **un seul fichier `.voltaplan` qui devient une archive ZIP** (projet + photos + documents). Il reste lisible avec
  n'importe quel outil ZIP. Les anciens fichiers JSON restent lisibles. Un mode « dossier décompressé » pourra
  venir plus tard, sur ordinateur seulement.
- **Pas de moteur de synchronisation.** Une file de synchronisation, une fusion et une gestion fine des conflits,
  c'est la fonction la plus coûteuse à maintenir de toute la liste. Je recommande plutôt un enregistrement
  « fichier » avec **détection de conflit** : si le fichier distant a changé, on le dit et on enregistre une
  copie, sans jamais écraser. Plus tard seulement, éventuellement, une file d'envois en attente.
- **Pas de Tauri mobile, et Tauri bureau à reconsidérer.** La PWA couvre le relevé sur chantier : appareil photo,
  hors ligne, fichiers via la feuille de partage. Tauri mobile ajouterait les magasins d'applications, la
   signature, Rust et deux chaînes de compilation, pour un gain limité.
- **OneDrive en premier : d'accord, mais il existe déjà.** Il faut le fiabiliser (conflits, gros fichiers,
  reconnexion), pas le construire. Et rappeler l'alternative à zéro code : un projet rangé dans le dossier OneDrive
  synchronisé de l'ordinateur.
- **La roadmap doit commencer par une « phase 0 » de décisions** : domaine, dépôt public, format v2, terminologie.
  Ce sont des choix peu coûteux maintenant et très coûteux plus tard.

---

## 1. État actuel du projet (constats dans le code)

| Domaine | Existe | Où |
|---|---|---|
| Aucun serveur Voltaplan | oui | aucun backend ; seuls des appels directs aux services choisis par l'utilisateur |
| Stockage navigateur | oui, IndexedDB, plus un brouillon automatique | `src/io/storage.ts` (`AUTOSAVE_ID`), `src/App.tsx:146-151` |
| Fichier local | oui : File System Access (Chrome, Edge), sinon téléchargement ; dialogue natif sous Tauri | `src/io/files.ts` |
| GitHub | oui, jeton personnel chiffré localement | `src/io/storage.ts` |
| Google Drive, OneDrive, Dropbox | oui, OAuth depuis le navigateur (PKCE pour OneDrive et Dropbox), jeton en mémoire seulement | `src/io/cloud.ts`, `public/oauth.html` |
| PWA | manifest (installable, `file_handlers`), service worker | `public/manifest.webmanifest`, `public/sw.js`, `src/main.tsx:16` |
| Bureau | Tauri 2, droits minimaux | `src-tauri/` |
| Format de projet | JSON versionné, migrations, validation zod, champs inconnus conservés | `src/model/migrate.ts`, `docs/file-format.md` |
| Images | intégrées au JSON en `data:` URL (fonds de plan, photo du tableau) | `src/model/types.ts:143-171` |
| Historique | annuler / rétablir en mémoire (copies du projet) | `src/store.ts:34-99` |
| Moteur RGIE | versionné, statuts, dérogations ; aucun import de l'interface ni de l'IA | `src/rules/` |
| Registre des pays | `RULE_PACKS = [belgium]`, ajout d'un pays par un module | `src/rules/index.ts` |
| Calculs | indépendants des règles (chute de tension, bilan, équilibrage) | `src/calc/` |
| Dossier PDF | rendu HTML puis `window.print()` du navigateur | `src/print/PrintDialog.tsx:45`, `src/print/PrintDocument.tsx` |
| IA | Anthropic, API compatibles OpenAI, modèles locaux ; clé chiffrée par phrase secrète | `src/ai/provider.ts`, `src/ai/secureStore.ts` |
| Analyse locale des plans | lecture PDF (pdf.js), détection déterministe des murs | `src/plan/trace.ts`, `pdfjs-dist` |
| Langues | fr, nl, en complets ; de partiel (58 lignes) | `src/i18n/` |
| Interopérabilité | import et export Trikker, export Eendraadschema | `src/import/`, `src/export/` |
| Tactile | appui long pour déplacer la vue, styles `hover: none` | `src/ui/usePanZoom.ts`, `src/styles.css:1409` |
| Licence | AGPL-3.0-or-later | `LICENSE`, `package.json` |
| Dépôt | **privé** | GitHub |

**Taille** : environ 16 600 lignes de TypeScript, 29 fichiers de tests, 201 tests. Le site construit pèse 2,8 Mo.

---

## 2. Faisabilité globale

**Faisable, sans serveur, avec un coût d'exploitation proche de zéro.** Aucune des fonctions demandées n'exige un
backend Voltaplan. Seule exception partielle : les identifiants OAuth des services de stockage. Ce ne sont pas
des serveurs, mais des inscriptions d'application, gratuites, à faire une fois au nom du projet.

Les vrais facteurs limitants sont ailleurs :

1. **La validation réglementaire.** Elle demande des experts et du temps humain ; aucun outil ne la remplace.
2. **iOS et Safari** : stockage, accès aux fichiers et PWA y sont plus restreints que partout ailleurs.
3. **Le temps de maintenance** d'une personne seule, surtout le support aux utilisateurs.

---

## 3. Analyse des écarts, orientation par orientation

Pour chaque thème : existant, manques, risques, complexité (S : jours, M : semaines, L : mois), coût, charge de
maintenance, et recommandation.

### 3.1 Positionnement et fonctions indispensables

- **Existant** : unifilaire, plan de position, tableau, contrôle RGIE transparent (statuts, sources, dérogations),
  dossier imprimé, import et export Trikker, export Eendraadschema, IA multi-fournisseur, bureau et web.
- **Ce qui rendra Voltaplan réellement compétitif**, par ordre d'importance :
  1. **Un dossier accepté sans discussion par les organismes agréés.** C'est le critère n°1 des électriciens, bien
     avant l'IA. Il passe par des tests sur de vraies réceptions.
  2. **La vitesse de saisie** : modèles de projets, copier-coller de circuits, sélection multiple. Ces trois
     fonctions sont planifiées dans l'audit (§ 11 du rapport final).
  3. **Le relevé sur téléphone** : photos, notes et identification des circuits, hors ligne.
  4. **La migration depuis Trikker** : elle existe déjà, c'est un atout rare à mettre en avant.
  5. **La transparence du contrôle**, déjà là : c'est un vrai différenciateur face à des outils qui « valident ».
- **Les comparaisons de prix et de fonctions des concurrents** (Trikker, PlanElec, Amperio, Volter, Voltuno,
  QElectroTech) sont **[à vérifier]** avant tout comparatif public. Je ne les ai pas vérifiées.
- **Recommandation** : ne pas courir après l'IA des concurrents. L'avantage durable est de faire « gratuit, fiable,
  rapide à saisir, document accepté ». L'IA vient en confort.

### 3.2 Socle universel et modules nationaux

- **Existant** :
  - `src/model` (arbre électrique) et `src/calc` (physique) sont indépendants du pays ;
  - `src/rules/<pays>` expose un `RulePack` (éditions, catalogue, contrôle, options, messages) ;
  - `meta.ruleset` est enregistré dans le projet ;
  - un référentiel inconnu est signalé, jamais remplacé en silence ;
  - `countryOptionFindings` signale le matériel d'un autre pays.
- **Couplages à défaire** (refactorisation S à M) :
  - `src/model/schema.ts` contient des listes belges (`DEDICATED_CIRCUIT_APPLIANCES`, `RCD30_APPLIANCES`) et des
    désignations de câbles. Elles doivent aller dans `src/rules/be/` ou dans `RulePack.options`.
  - **Symboles** : `src/unifilar/symbols.tsx` contient une seule convention graphique. Pour l'international, il
    faudra un jeu de symboles par pack, avec la convention IEC 60617 comme base générique. Il ne faut pas
    reproduire les planches normatives : dessiner nos propres symboles conformes aux principes est la voie
    prudente **[à vérifier juridiquement]**.
  - **Dossier** : le cartouche « RGIE 3.1.2 » est écrit en dur dans `src/print/PrintDocument.tsx`. Il faut un
    modèle de dossier par pack (pages, mentions obligatoires, cartouche) au-dessus d'un moteur commun, qui existe
    déjà.
- **Mode international générique** : un pack `generic` qui ne fait que les vérifications physiques (chute de
  tension, surcharge, équilibrage) et affiche « aucune réglementation locale vérifiée ». Coût S. Il apporte
  beaucoup de sens à la vision pour très peu de code.
- **Recommandation** : faire maintenant **la séparation des données belges hors de `schema.ts`** et définir
  l'**interface `RulePack` v2** (symboles, modèle de dossier, mentions). N'implémenter aucun autre pays.

### 3.3 Local-first et absence de backend

- **Réponse à « Peut-on fonctionner sans backend ? »** : **oui, c'est déjà le cas.**
- **Traitements résiduels hors appareil** : hébergement du site (GitHub), connexion aux services de stockage
  (Microsoft, Google, Dropbox), IA si choisie, GitHub si choisi. Aucun ne transite par Voltaplan.
- **Manques** :
  - historique des versions au-delà de la session : l'annulation est en mémoire seulement ;
  - sauvegardes automatiques : il n'y a qu'**un seul** brouillon automatique, partagé entre les onglets
    **[à vérifier : deux onglets ouverts s'écrasent-ils ?]**.
- **Recommandation** :
  - plusieurs brouillons, un par projet, avec les N dernières versions gardées en IndexedDB ;
  - une copie `.bak` à côté du fichier, sur bureau et Chromium.
  - Coût S. Gain fort contre la perte de données.

### 3.4 Format et organisation des projets

Comparaison des options :

| Option | Pour | Contre |
|---|---|---|
| **Répertoire** (votre proposition) | lisible dans l'explorateur, photos d'origine visibles, gros projets | **impossible sur iOS et dans Firefox et Safari** (pas d'accès aux dossiers) ; ne s'envoie pas par courriel ; un cloud par API doit synchroniser N fichiers ; liens internes cassables à la main |
| **JSON unique** (actuel) | simple, déjà migrable | base64 (+33 %), plafond de 50 Mo, réécriture complète, pas de documents joints |
| **ZIP unique** | un seul fichier partout (courriel, clé USB, cloud, mobile) ; photos en binaire ; documents joints ; ouvrable par n'importe quel outil ZIP | réécriture du fichier entier à l'enregistrement (acceptable jusqu'à quelques centaines de Mo) ; une petite dépendance de compression |
| **Hybride** (ZIP par défaut, dossier décompressé en option sur ordinateur) | le meilleur des deux | deux chemins à tester ; à garder pour plus tard |

**Recommandation : `.voltaplan` v2 = ZIP**, avec le contenu suivant :

```
project.json          ← modèle (le JSON actuel, sans base64)
assets/<hash>.jpg     ← photos, fonds de plan (nom = empreinte : dédoublonnage, pas de chemins absolus)
documents/…           ← PDF joints, rapports (nouveau)
thumbnail.png         ← aperçu (facultatif)
```

- **Compatibilité** : à l'ouverture, un fichier qui commence par `PK` est une archive, un fichier qui commence par
  `{` est l'ancien JSON. On ajoute une migration de format 1 vers 2 dans `src/model/migrate.ts`. L'ancien format
  reste lisible indéfiniment.
- **Dépendance** : `fflate` (petite, sans dépendance) **[à vérifier : taille et licence MIT]**.
- **Mémoire** : les images deviennent des `Blob` ou des URL d'objet au lieu de chaînes base64.
- **Exports** (PDF, Trikker, Eendraadschema) : ce sont des fichiers produits, pas des parties du projet. Ils ne
  vont pas dans l'archive, ce qui évite de la grossir. Un « Exporter tout dans un dossier » est possible sur bureau.
- **Ce qu'il ne faut pas faire** : imposer l'arborescence `photos/tableaux/…` proposée. Une organisation par types
  de fichiers fige des choix et casse dès qu'un utilisateur range autrement. Les catégories doivent être des
  **métadonnées** dans `project.json`, pas des dossiers.
- **Complexité** : M. Surtout tester la migration, les limites de taille et le comportement mémoire sur mobile.

### 3.5 Hors connexion

- **Existant** : `public/sw.js` (réseau d'abord pour la page, cache d'abord pour les fichiers) ; projets et
  brouillon en IndexedDB.
- **Défauts constatés** :
  1. **Pas de pré-cache complet** : seuls `./`, `index.html`, le manifest et l'icône sont mis en cache à
     l'installation. Les modules chargés à la demande (`pdf-*.js`, `pdf.worker`, `trikker-*.js`,
     `boardPhotoAi-*.js`, `eendraadschema-*.js`) ne sont disponibles hors ligne que s'ils ont déjà été utilisés en
     ligne.
  2. **Nom de cache fixe** (`voltaplan-v1`) : les anciens fichiers versionnés s'accumulent et ne sont jamais
     supprimés.
  3. **Pas de message « nouvelle version disponible »** : la mise à jour se fait au rechargement suivant, sans le
     dire.
  4. **Pas d'appel à `navigator.storage.persist()`** ni d'affichage de l'espace utilisé : les données peuvent être
     évincées. Sur Safari, un site non installé peut perdre ses données de script après 7 jours sans visite
     **[à vérifier : règles actuelles de WebKit ; une PWA installée sur l'écran d'accueil en serait exemptée]**.
- **Recommandation** (S, quelques jours) :
  - générer à la construction la liste des fichiers à pré-cacher, avec un nom de cache lié à la version ;
  - afficher une bannière « nouvelle version, recharger » ;
  - appeler `persist()` et afficher l'état du stockage.
  - Ne pas adopter Workbox : le service worker actuel est court et lisible, une liste générée suffit.
- **OPFS** (Origin Private File System) : utile **plus tard** pour stocker les photos en binaire hors du JSON.
  Inutile tant que le format ZIP n'existe pas. IndexedDB stocke déjà des `Blob`.

### 3.6 Stockage distant et synchronisation

- **Existant** : `src/io/cloud.ts` gère Google Drive, OneDrive et Dropbox sans serveur. Le jeton d'accès est gardé
  en mémoire seulement. Les permissions sont minimales : dossier d'application pour OneDrive et Dropbox,
  `drive.file` pour Google.
- **Défauts** :
  1. **Écrasement silencieux** :
     - Dropbox : `mode: 'overwrite'` ;
     - OneDrive : `PUT …:/content` sans `If-Match` ;
     - Google Drive : `PATCH` sans contrôle ;
     - GitHub : relit l'identifiant de version (`sha`) juste avant d'écrire, ce qui revient aussi à écraser.
  2. **Identifiants OAuth** : à saisir par l'utilisateur ou à fixer à la compilation. Pour une utilisation grand
     public, le projet doit enregistrer **ses** applications Microsoft, Google et Dropbox (gratuit), avec une
     adresse de redirection **stable**, d'où l'importance du domaine.
  3. **Reconnexion** : le jeton n'est pas gardé, il faut se reconnecter à chaque session. Les jetons de
     rafraîchissement des applications monopages Microsoft durent environ 24 h **[à vérifier]**. C'est
     acceptable : une connexion par jour, sans secret stocké.
  4. **Gros fichiers** : l'envoi simple OneDrive a une limite **[à vérifier : 4 Mo selon l'ancienne
     documentation, 250 Mo selon la récente]**. Au-delà, il faut une session d'envoi. C'est à prévoir dès que les
     photos sont dans le projet.
  5. **Google** : le flux par jeton direct, sans PKCE, est déconseillé par Google **[à vérifier]**. Une
     application publique demande une vérification de la marque (page de confidentialité, domaine vérifié).
- **Recommandation** :
  - **Contrôle de conflit** sur chaque service : `If-Match` avec l'eTag pour OneDrive, `mode: update` avec la
    révision pour Dropbox, comparaison de `version` ou `modifiedTime` pour Drive, `sha` mémorisé à l'ouverture
    pour GitHub. Si le fichier distant a changé : enregistrer une copie `Projet (conflit 2026-11-24 14h02).voltaplan`
    et prévenir. **Jamais de fusion automatique.** Complexité S à M.
  - **État visible** : « enregistré sur cet appareil » / « envoyé sur OneDrive à 14h02 » / « en attente d'envoi
    (hors ligne) » / « conflit : copie créée » / « erreur ». Cela demande un modèle d'état du document, pas une
    file complexe.
  - **Envoi en attente hors ligne** : garder la dernière version à envoyer en IndexedDB et l'envoyer au retour du
    réseau ou à la réouverture. Pas de Background Sync, indisponible sur iOS **[à vérifier]**.
  - **Alternative à zéro code**, à documenter : sur ordinateur, ranger les projets dans le dossier OneDrive, Google
    Drive ou Dropbox synchronisé, et utiliser « Enregistrer » sur le fichier. Le client du service gère tout. Sur
    mobile, l'application Fichiers (iOS) ou le sélecteur Android donne accès à OneDrive pour **ouvrir** un fichier.
    Pour **enregistrer**, la feuille de partage (`navigator.share` avec fichiers, absent aujourd'hui) permet
    « Enregistrer dans Fichiers » ou « OneDrive ».
- **OneDrive en premier** : d'accord, car c'est le plus répandu chez les indépendants belges (Microsoft 365)
  **[à vérifier]**. Il faut tester aussi les comptes professionnels : un administrateur Entra peut bloquer le
  consentement des utilisateurs.

### 3.7 PWA et mobile

- **Existant** :
  - manifest installable, avec `file_handlers` pour Chromium sur ordinateur ;
  - service worker ;
  - styles adaptés aux petits écrans (`@media max-width 800px / 700px`) et aux écrans tactiles (`hover: none`) ;
  - déplacement de la vue par appui long.
- **Manques** :
  - **pas de zoom à deux doigts** : seule la molette est gérée dans `usePanZoom.ts`. Indispensable sur tablette ;
  - pas de saisie directe par l'appareil photo : `<input capture>` n'est pas utilisé pour la photo du tableau ;
  - pas de partage de fichiers (`navigator.share`) ;
  - pas de balises iOS : `apple-touch-icon`, et `apple-mobile-web-app-*` **[à vérifier : encore utiles avec iOS
    récent]** ;
  - pas d'**écran de relevé** pensé pour le téléphone.
- **Une PWA suffit-elle ?** **Oui, pour les usages décrits.**
  - Appareil photo : `<input type="file" accept="image/*" capture>` fonctionne sur iOS et Android.
  - Hors ligne : oui, avec les corrections du § 3.5.
  - Fichiers : ouvrir partout ; enregistrer par la feuille de partage sur mobile ; File System Access sur Chromium
    pour ordinateur.
  - Installation sans magasin d'applications.
  - Limites réelles : sur iOS, pas de dossier de projet, éviction possible si la PWA n'est pas installée,
    notifications et Background Sync limités.
- **Ce qui justifierait Tauri mobile** : seulement un besoin avéré d'accès au système de fichiers natif sur iOS,
  ou une exigence de présence dans les magasins d'applications. Coûts **[à vérifier]** :
  - Apple Developer Program, environ 99 $ par an ;
  - Google Play, environ 25 $ une fois ;
  - revue des magasins ;
  - deux chaînes de compilation mobiles (Xcode, Android SDK) à maintenir en CI.
  - **Recommandation : non, pour l'instant.** À réévaluer après des tests de terrain sur iPhone.
- **Tauri bureau, à challenger** :
  - Une PWA installée dans Chrome ou Edge offre déjà le même confort de fichiers (« Enregistrer » réécrit le
    fichier) et l'ouverture par double-clic.
  - Tauri ajoute la chaîne Rust et la signature des installeurs (Windows : certificat payant, sinon alerte
    SmartScreen ; macOS : 99 $ par an et notarisation) **[à vérifier : prix]**.
  - Il ajoute aussi un risque sur l'impression : `window.print()` dans la vue web de macOS (WKWebView) a
    historiquement posé problème sous Tauri **[à vérifier]**. Or le dossier PDF dépend de l'impression.
  - **Recommandation** : faire de la PWA la voie principale sur toutes les plateformes. Garder Tauri bureau comme
    option construite par la CI, sans signature au début, et décider dans 6 mois s'il apporte assez d'usage.
- **Usages par appareil** : d'accord pour ne rien interdire. Il suffit d'un **écran de relevé** simple sur
  téléphone : photo du tableau, liste des circuits, notes, photos d'équipements. Il s'ouvre par défaut sur un
  petit écran, tout en gardant l'accès aux autres vues.

### 3.8 Assistance par l'IA, sans infrastructure

- **Existant** :
  - interface commune aux fournisseurs, réponses validées par schéma, délai et annulation ;
  - destinataire affiché avant l'envoi ;
  - modèles locaux sans clé ;
  - lecture de la photo du tableau ;
  - détection déterministe des murs ;
  - pdf.js pour lire les PDF localement.
- **Coût pour Voltaplan : zéro.** L'utilisateur apporte sa clé ou son modèle local. Il ne faut **jamais** de clé
  commune dans le code distribué. C'est respecté aujourd'hui.
- **Sécurité des clés personnelles** :
  - la clé est chiffrée par une phrase secrète (PBKDF2 avec 600 000 itérations, puis AES-GCM) ;
  - elle est déchiffrée en mémoire pour la session.
  - Le risque résiduel est une faille XSS pendant la session ; la CSP stricte le réduit.
  - **Le partage d'origine sur `*.github.io` est un vrai risque** : un autre site Pages du même compte pourrait lire
    le stockage local, donc les projets du navigateur et la clé chiffrée. Le domaine dédié le supprime.
  - Recommander aux utilisateurs des clés à **plafond de dépense** chez leur fournisseur.
- **Modèles locaux, deux limites à documenter** :
  - Ollama refuse par défaut les requêtes venant d'un site web : il faut régler `OLLAMA_ORIGINS` **[à vérifier]**.
  - Un site en HTTPS qui appelle `http://localhost` peut être bloqué par Safari ou soumis aux règles « Private
    Network Access » de Chrome **[à vérifier]**.
  - En pratique, les modèles locaux marchent surtout depuis l'application de bureau ou Chrome.
- **Réduire les appels** : la stratégie proposée est la bonne.
  - Texte des PDF vectoriels extrait localement, avec pdf.js déjà présent ; reconnaissance déterministe d'abord.
  - Recadrer les images sur la zone utile.
  - **Garder les résultats** de l'IA dans le projet, avec l'empreinte de l'image, pour ne jamais redemander.
  - Calculs et contrôle toujours faits par le moteur local.
- **Création assistée** (§ 9 de votre document) : c'est la partie la plus lourde (L).
  - Le principe « état réel d'abord, conformité ensuite, propositions séparées » est sain.
  - Il impose une **notion de proposition** dans le modèle : des modifications en attente, acceptées ou refusées
    une par une.
  - Cette notion sert aussi aux corrections assistées. **Elle doit être conçue une fois, avant les assistants.**

### 3.9 Moteur RGIE et responsabilité

- **Indépendance** : le moteur et les calculs n'importent ni React, ni le store, ni l'IA. Ils sont testables seuls
  (matrice de 25 cas). C'est conforme à la vision.
- **Terminologie à corriger** (S) :
  - `app.tagline` : « Schémas électriques conformes RGIE » → « Schémas électriques et aide à la vérification RGIE » ;
  - `check.ok` : « Aucune non-conformité détectée. » → « Aucune anomalie détectée parmi les N règles vérifiées. » ;
  - `severity.error` et `status.nonCompliant` : « Non conforme » → « Anomalie potentielle (non-conformité) » ou
    garder le terme avec une note. À trancher, car un électricien comprend « non conforme » ;
  - `print.draft` : « PROJET — NON CONFORME » → « PROJET — ANOMALIES À TRAITER » ;
  - ajouter les statuts « Règle non couverte » et « Résultat indicatif ».
- **Traçabilité des rapports** (S) : il manque la version de Voltaplan, la version du catalogue de règles, la date
  de l'analyse, la liste des règles appliquées et non appliquées, les hypothèses (valeurs par défaut utilisées)
  et les limites. Les données existent presque toutes (`BE_RULES`, `edition`, `inferred`). Il reste à injecter la
  version à la construction et à ajouter une page « Portée de l'analyse » au dossier.
- **Conditions d'utilisation** : l'AGPL contient déjà une exclusion de garantie (sections 15-16). Une page « Limites
  et responsabilité » en langage clair est utile, mais **la qualité technique reste la vraie protection**. Il faut
  faire relire par un juriste belge la portée d'une exclusion de responsabilité pour un outil gratuit
  **[validation externe]**.

### 3.10 Données personnelles (RGPD)

- **Situation** : Voltaplan ne collecte rien pour son compte, sans télémétrie ni compte, comme le documente
  `PRIVACY.md`. Le projet n'est donc a priori pas responsable du traitement des dossiers. Ce n'est pas une
  exemption de principe **[à vérifier juridiquement]**.
- **Traitements résiduels à documenter** :
  - GitHub Pages : journaux du serveur, adresses IP, gérés par GitHub ;
  - inscriptions OAuth : Microsoft, Google et Dropbox voient l'application Voltaplan ;
  - IA : l'utilisateur devient responsable de ce qu'il envoie, éventuellement des données de son client ;
  - rapports de bugs : les issues GitHub sont publiques, il faut un avertissement sur les données de clients ;
  - dons : la plateforme traite les données des donateurs ;
  - statistiques : **ne pas en mettre**. Si un jour il en faut, choisir un outil sans cookies, auto-hébergé ou
    agrégé, et l'annoncer.
- **Recommandation** : compléter `PRIVACY.md` avec ces points et ajouter un avertissement dans le modèle d'issue.

### 3.11 Dossier PDF

- **Existant** :
  - rendu HTML commun et impression par le navigateur ;
  - quatre types de dossier ;
  - cartouche, révisions, constats paginés.
- **Limites** :
  - le rendu dépend du navigateur (marges, polices) ;
  - pas de fichier PDF produit directement ;
  - pas de test visuel ;
  - cartouche belge en dur (§ 3.2).
- **Recommandation** :
  - garder l'impression du navigateur : zéro dépendance, texte vectoriel, et elle fonctionne aussi sur mobile ;
  - ajouter des **tests de structure** (pages, cartouche, mentions) en jsdom, peu coûteux ;
  - ajouter 2 ou 3 **captures de référence** par Playwright sous Linux seulement, pour limiter la charge ;
  - séparer « moteur de pages » et « modèle de dossier par pays ».
  - **Documents légalement exigés ou complémentaires** : la liste exacte (schéma unifilaire, plan de position,
    mentions, symboles) doit être établie **à partir du texte consolidé du RGIE Livre 1**, que je n'ai pas
    vérifié ici **[validation externe]**.

### 3.12 Gratuité et dons

- **Recommandation** :
  - `.github/FUNDING.yml` (bouton « Sponsor » natif de GitHub) ;
  - une page « Soutenir » sur le site ;
  - un lien discret dans le menu « À propos », sans fenêtre surgissante ni rappel ;
  - aucune fonction liée aux dons.
- **Prérequis** : GitHub Sponsors demande un **dépôt public** pour avoir du sens, et un compte bancaire et des
  informations fiscales **[à vérifier : fiscalité belge des dons reçus à titre personnel ou par une ASBL]**.

### 3.13 Hébergement (GitHub Pages)

- **Limites connues** **[à vérifier sur la documentation actuelle]** :
  - site publié de 1 Go au plus ;
  - bande passante « souple » d'environ 100 Go par mois ;
  - environ 10 constructions par heure ;
  - pas de service commercial ;
  - **pas d'en-têtes HTTP personnalisés**. La CSP passe par une balise `<meta>`, qui ne gère ni `frame-ancestors` ni
    les rapports. COOP et COEP sont impossibles, ce qui empêcherait par exemple certains usages de
    `SharedArrayBuffer` pour de l'IA locale dans le navigateur.
- **Pages publiées depuis un dépôt privé** : cela demande un forfait payant **[à vérifier sur votre compte]**.
  Passer le dépôt en public supprime ce coût.
- **Suffisant à long terme ?** Oui, tant que l'application reste statique et que le trafic reste raisonnable : le
  site fait 2,8 Mo et tout est mis en cache par le service worker.
- **Raisons de migrer** vers Cloudflare Pages ou Netlify (gratuits aussi) : besoin d'en-têtes de sécurité complets,
  dépassement de bande passante, ou besoin de COOP et COEP.
- **Un domaine dédié rend cette migration transparente** : l'origine ne change plus.

### 3.14 Maintenance

- **Automatisation existante** :
  - CI sur trois systèmes : typage, lint, tests, build ;
  - `npm audit`, gitleaks, CodeQL avec exceptions justifiées ;
  - Dependabot limité aux versions mineures et correctifs ;
  - publication Pages ; workflow de release Tauri.
- **Manques** :
  - mesure de la couverture : aucun outil configuré, il faut `@vitest/coverage-v8` avec un seuil sur `src/rules`,
    `src/calc`, `src/model` et `src/io` ;
  - tests de bout en bout et tests visuels ;
  - vérification des licences des dépendances ;
  - changelog et releases automatiques (Release Please, par exemple) ;
  - tests de migration sur un **corpus de vieux fichiers anonymisés**, à constituer.
- **4 à 8 h par mois, réaliste ?** Pour la maintenance technique seule, une fois stabilisée, oui, à condition de :
  - traiter les versions majeures une à deux fois par an, en bloc (React 19, Vite 8, Vitest 5 : 1 à 3 jours au
    prochain passage) ;
  - **ne pas** ajouter Tauri mobile ni un moteur de synchronisation ;
  - garder peu de dépendances (8 en production aujourd'hui, c'est excellent).
  - **Non compris** : le support aux utilisateurs, souvent le premier poste dès qu'il y a une communauté ; les
    évolutions du RGIE ; les changements d'API des services de stockage (environ 1 incident par an et par service
    **[estimation]**). Une estimation honnête « tout compris » se situe plutôt entre **10 et 20 h par mois** après la
    publication.
- **Maintenance réglementaire** : le catalogue `src/rules/be/catalog.ts` a déjà `source`, `verifiedOn`,
  `needsReview` et `tests`. Il manque :
  - un `CHANGELOG` des règles ;
  - un modèle d'issue « anomalie réglementaire » qui demande l'article et l'édition ;
  - une revue par un expert avant de retirer `needsReview` ;
  - une veille du Moniteur belge pour les arrêtés modifiant le RGIE, manuelle et annuelle.

### 3.15 Gouvernance et licence

- **Licence AGPL-3.0** : **elle correspond bien à votre philosophie.**
  - Elle autorise tout usage, y compris commercial, mais oblige quiconque distribue **ou héberge** une version
    modifiée à en publier le code. Elle empêche une reprise fermée en service payant.
  - **Inconvénient** : certaines entreprises évitent l'AGPL pour l'intégrer à leurs produits. Ce n'est pas votre
    cible.
  - **MIT ou Apache** permettraient une reprise fermée.
  - Si vous voulez un jour proposer une licence commerciale à côté (double licence), il faudrait un accord de
    contribution (CLA) **dès les premières contributions extérieures**. Je ne le recommande pas : c'est
    contraire à l'esprit et cela freine les contributions.
  - Je recommande l'AGPL avec un **DCO** (signature `Signed-off-by` des commits), simple et sans transfert de droits.
- **Contenus réglementaires** :
  - le catalogue des règles est du code, sous AGPL ;
  - les textes explicatifs peuvent rester sous AGPL ;
  - **ne jamais copier de texte normatif protégé** (normes NBN, IEC, NEN, DIN). Le RGIE, publié au Moniteur
    belge, est un texte officiel, a priori réutilisable **[à vérifier]**.
- **À ajouter** :
  - `CONTRIBUTING.md` ;
  - modèles d'issues (bug, anomalie réglementaire, traduction) et de pull requests ;
  - une roadmap publique (GitHub Projects ou `ROADMAP.md`) ;
  - `CODE_OF_CONDUCT.md`.
  - Les ADR et `SECURITY.md` existent déjà.
- **Dépôt privé** : c'est incohérent avec « open source ». Le rendre public débloque le code scanning gratuit,
  GitHub Sponsors, Pages gratuit et les contributions. **Avant** de le rendre public :
  - un scan de l'historique complet avec gitleaks ;
  - la vérification qu'aucun fichier de client n'a été commité par le passé (les fixtures `.trik` et `.jpg` sont
    ignorées, mais l'historique est à contrôler).

---

## 4. Architecture cible

```
┌─────────────────────────── Application (une seule base de code, PWA) ───────────────────────────┐
│ Interface React : vues Unifilaire / Plan / Tableau / Relevé (mobile) / Contrôle / Dossier      │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Document : état du projet, annuler/rétablir, propositions en attente (IA, corrections)          │
├───────────────┬───────────────────┬──────────────────┬──────────────────┬────────────────────────┤
│ Modèle        │ Calculs           │ Règles (packs)   │ Dossier          │ Assistants (option)    │
│ universel     │ universels        │ be / generic /…  │ moteur de pages  │ IA : interface commune │
│ (src/model)   │ (src/calc)        │ éditions,        │ + modèle par     │ + analyse locale       │
│               │                   │ catalogue,       │ pack (cartouche, │ (pdf.js, trace)        │
│               │                   │ symboles, textes │ mentions)        │                        │
├───────────────┴───────────────────┴──────────────────┴──────────────────┴────────────────────────┤
│ Format : .voltaplan v2 (ZIP : project.json + assets + documents), lecture v1 (JSON) maintenue    │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Stockage (interface commune, détection de conflit, jamais d'écrasement silencieux)               │
│  Appareil (FS Access / téléchargement / partage) · Navigateur (IndexedDB, versions) ·            │
│  OneDrive · Google Drive · Dropbox · GitHub                    → tous côté client, aucun serveur  │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Coquille : service worker (pré-cache complet, mise à jour annoncée) · Tauri bureau (optionnel)   │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
Hébergement : fichiers statiques (GitHub Pages) sous un domaine dédié. Aucune donnée utilisateur.
```

Ce schéma garde la structure actuelle. Les seuls ajouts structurants sont :

- la couche **Document**, avec les propositions en attente ;
- le **format v2** ;
- l'**interface de stockage avec conflits** ;
- les **modèles de dossier par pack**.

---

## 5. Gestion des projets et des fichiers (proposition)

1. **Un projet = un fichier `.voltaplan`** (ZIP v2). Il se copie, s'envoie et se sauvegarde sur clé USB d'un bloc.
   Il ne contient aucun chemin absolu : les ressources sont nommées par empreinte.
2. **Documents joints** (rapports, fiches techniques, plans d'origine) dans `documents/`, avec métadonnées dans
   `project.json` : catégorie, date, source. On conserve toujours l'original.
3. **Exports** produits à la demande, hors du projet. Sur bureau, l'option « Exporter le dossier complet »
   écrit un répertoire `Projet/exports/…`.
4. **Versions** : à chaque enregistrement, garder les N dernières versions dans le navigateur ; sur bureau, un
   fichier `.voltaplan.bak`.
5. **Compatibilité** : lecture des anciens formats (`.openrgie`, JSON v1) indéfiniment ; écriture en v2 seulement
   après confirmation à la première ouverture (« ce fichier sera enregistré dans le nouveau format »).

---

## 6. Stratégie de stockage

| Étape | Contenu | Complexité |
|---|---|---|
| 1 | `persist()`, affichage de l'espace utilisé, plusieurs brouillons avec versions | S |
| 2 | État du document visible (local, envoyé, en attente, conflit, erreur) | S |
| 3 | Détection de conflit sur les 4 services, copie en cas de conflit | S-M |
| 4 | Enregistrement par la feuille de partage sur mobile (`navigator.share`) | S |
| 5 | Inscription des applications OAuth du projet (OneDrive d'abord), sous le domaine définitif | S (administratif) |
| 6 | Sessions d'envoi pour gros fichiers (OneDrive, Dropbox, Drive) | M |
| 7 | Envoi en attente hors ligne, repris à la reconnexion ou à la réouverture | M |
| — | Moteur de synchronisation bidirectionnelle avec fusion | **déconseillé** |

---

## 7. Stratégie PWA et mobile

1. Corriger le service worker : pré-cache généré, cache versionné, message de mise à jour (S).
2. Zoom à deux doigts, cibles tactiles de 44 px, appareil photo direct, partage de fichiers, icônes iOS (S-M).
3. **Écran de relevé** sur téléphone : photo du tableau, puis circuits, notes et photos d'équipements (M).
4. Tests de terrain sur iPhone et Android, hors ligne, dans une cave (gratuit, indispensable).
5. Tauri mobile : **non**, sauf si l'étape 4 révèle un blocage iOS impossible à contourner.

---

## 8. IA sans infrastructure centralisée

- Garder le modèle actuel : clé personnelle, services compatibles, modèles locaux, ou mode manuel.
- Ajouter :
  - une estimation du coût avant l'envoi (taille de l'image et prix indicatif du modèle **[à tenir à jour ou à
    omettre]**) ;
  - le cache des résultats par empreinte ;
  - le recadrage des images ;
  - la documentation des modèles locaux (Ollama, `OLLAMA_ORIGINS`).
- Concevoir les **propositions en attente** avant d'étendre l'IA aux plans d'architecte et à la conception de
  nouvelles installations.

---

## 9. Coûts de fonctionnement (estimation)

| Poste | Coût annuel | Remarque |
|---|---|---|
| Hébergement GitHub Pages | 0 € si dépôt public | sinon forfait GitHub payant **[à vérifier]** |
| Nom de domaine (`.be` ou `.app`) | environ 10 à 25 € | **recommandé dès maintenant** |
| Inscriptions OAuth Microsoft, Google, Dropbox | 0 € | vérification Google : page de confidentialité, domaine |
| IA | 0 € pour Voltaplan | à la charge de l'utilisateur |
| CI GitHub Actions | 0 € si public | minutes limitées si privé |
| Signature Windows (facultatif) | environ 100 à 400 € | seulement si Tauri bureau distribué largement **[à vérifier]** |
| Apple Developer (facultatif) | environ 99 $ | seulement pour macOS signé ou iOS natif |
| **Total minimal** | **environ 10 à 25 €** | avec PWA seule et dépôt public |

---

## 10. Charge de maintenance

- **Technique stabilisée** : 4 à 8 h par mois, plausible, avec deux rattrapages de versions majeures par an
  (1 à 3 jours chacun).
- **Avec support et communauté** : 10 à 20 h par mois après la publication publique.
- **Réglementaire** : ponctuel, mais dépendant d'experts externes.
- **Ce qui ferait exploser la charge** : Tauri mobile, synchronisation bidirectionnelle, plusieurs pays avant
  d'avoir des contributeurs, fonctions d'IA liées à un seul fournisseur.

---

## 11. Risques

| Risque | Probabilité | Impact | Réponse |
|---|---|---|---|
| Écrasement d'un projet entre deux appareils (cloud) | élevée dès qu'on utilise deux appareils | perte de travail | détection de conflit (§ 3.6) |
| Éviction des données du navigateur (iOS, espace disque) | moyenne | perte des projets non enregistrés en fichier | `persist()`, PWA installée, rappel d'export |
| Changement d'origine (domaine) après la publication | certaine si non traité | perte des projets locaux, des réglages et des inscriptions OAuth | domaine dès maintenant |
| Partage d'origine `*.github.io` | faible | lecture du stockage par un autre site du compte | domaine dédié |
| Fichiers trop gros (photos en base64) | moyenne | lenteur, plafond de 50 Mo | format ZIP v2 |
| Règle RGIE fausse présentée comme fiable | moyenne | responsabilité, réputation | relecture par un expert, terminologie, traçabilité |
| Hors ligne partiel (modules non mis en cache) | élevée | fonction indisponible sur chantier | pré-cache complet |
| Impression différente selon le navigateur ou Tauri macOS | moyenne | dossier mal formé | tests visuels, test sur macOS |
| Épuisement du mainteneur | moyenne | projet abandonné | périmètre limité, automatisation, contributeurs |
| API de stockage modifiée ou application OAuth bloquée | faible à moyenne | stockage distant indisponible | fichier local toujours disponible |
| Contenu normatif reproduit sans droit | faible | juridique | ne jamais copier de normes, sources citées |

---

## 12. Roadmap priorisée (proposition révisée)

**Phase 0 — Décisions structurantes (1 à 2 semaines)**

- Choisir et brancher le **domaine** ; inscrire les applications OAuth sur ce domaine.
- Scanner l'historique, puis **rendre le dépôt public**.
- Valider le **format v2 (ZIP)** par une ADR, sans l'implémenter encore.
- Corriger la terminologie et ajouter la traçabilité des rapports (version, règles vérifiées, portée).
- Ajouter `FUNDING.yml`, `CONTRIBUTING.md`, les modèles d'issues et le DCO.

**Phase 1 — Stabilisation Belgique, avec protection des données (6 à 10 semaines)**

- Relecture réglementaire par un expert ; tests sur de vraies réceptions.
- Service worker complet, `persist()`, brouillons multiples avec versions.
- **Détection de conflit** sur le stockage distant et état du document visible.
- Modèles de projets, copier-coller, sélection multiple (vitesse de saisie).
- Mesure de la couverture, tests de structure du dossier.

**Phase 2 — Format v2 et mobilité (6 à 10 semaines)**

- `.voltaplan` en ZIP, migration, documents joints.
- Zoom à deux doigts, appareil photo, partage de fichiers, écran de relevé.
- Tests de terrain sur iOS et Android.

**Phase 3 — Publication bêta et communauté (en continu)**

- Site, guide, page « Soutenir ».
- Annonce auprès d'électriciens, d'écoles et d'organismes.

**Phase 4 — Propositions et assistants**

- Couche « propositions en attente » ; corrections assistées.
- Reconstruction d'installations existantes à partir de photos et de documents.
- Analyse de plans d'architecte, puis conception assistée de nouvelles installations.

**Phase 5 — Stockage distant avancé** (si la demande est avérée) : gros fichiers, envoi en attente hors ligne.

**Phase 6 — Internationalisation**

- Pack `generic`, puis symboles et modèles de dossier par pack.
- Pays suivants seulement avec des contributeurs et des sources fiables.

**Ce qui change par rapport à votre ordre** :

- la publication et la communauté passent plus tôt, car la relecture réglementaire et les retours de terrain en
  dépendent ;
- la protection contre la perte de données passe avant la mobilité ;
- le stockage distant n'est plus une phase de construction, car il existe : il est fiabilisé dès la phase 1 ;
- les assistants arrivent après la couche de propositions.

---

## 13. Décisions à prendre maintenant (pour éviter une refonte)

1. **Domaine et origine définitifs** de l'application web (exemples : `voltaplan.be`, `app.voltaplan.be`). Cette
   décision conditionne le stockage local, la PWA installée et les adresses de redirection OAuth.
2. **Dépôt public** (et date), après le scan de l'historique.
3. **Format v2** : ZIP unique, ou autre.
4. **Statut de Tauri bureau** : maintenu, en sommeil, ou abandonné au profit de la PWA.
5. **Politique de synchronisation** : « enregistrement avec détection de conflit, jamais de fusion » (recommandé),
   ou une synchronisation complète.
6. **Terminologie officielle** : « non conforme » ou « anomalie potentielle ».
7. **Licence** : maintien de l'AGPL avec DCO (recommandé), sans CLA.
8. **Structure juridique pour les dons** : personne physique ou ASBL.

---

## 14. Réalisable rapidement (jours, réutilise l'existant)

- Terminologie, page « Portée de l'analyse » et version de Voltaplan dans le dossier.
- Pré-cache complet, cache versionné, message de mise à jour.
- `navigator.storage.persist()` et affichage de l'espace utilisé.
- Plusieurs brouillons, versions récentes dans IndexedDB.
- Détection de conflit sur GitHub (le `sha` existe déjà), puis OneDrive, Dropbox et Drive.
- Appareil photo direct (`capture`), partage de fichiers, icônes iOS.
- Zoom à deux doigts.
- `FUNDING.yml`, `CONTRIBUTING.md`, modèles d'issues et de pull requests, DCO.
- Pack `generic` (calculs seulement, aucune règle nationale).
- Déplacer les listes belges de `schema.ts` vers `rules/be`.
- Couverture de tests avec seuils.

## 15. Développements importants (semaines à mois)

- Format v2 (ZIP), documents joints, migration, gestion mémoire des images.
- Écran de relevé mobile complet.
- Sessions d'envoi pour gros fichiers, envoi en attente hors ligne.
- Couche « propositions en attente » et corrections assistées.
- Reconstruction d'une installation à partir de sources multiples (photos, plans, anciens schémas).
- Conception assistée d'une nouvelle installation à partir d'un plan.
- Jeux de symboles et modèles de dossier par pays.
- Tests de bout en bout et tests visuels.

## 16. Validations externes nécessaires

| Point | Qui |
|---|---|
| Catalogue des règles, matrice de tests, articles du RGIE | organisme agréé ou expert RGIE |
| Documents exigés pour la réception, mentions, symboles | organisme agréé, texte consolidé du RGIE |
| Acceptation du dossier imprimé | 2 ou 3 organismes agréés, sur de vraies réceptions |
| Clause de responsabilité, conditions d'utilisation | juriste belge |
| RGPD (rôle du projet, de l'IA, des dons) | juriste ou DPO |
| Droit d'usage des symboles et des normes (IEC, NBN) | juriste ou organisme de normalisation |
| Fiscalité des dons (personne physique ou ASBL) | comptable belge |
| Prix et fonctions des concurrents | vérification directe avant toute publication |
| Comportement iOS et Android (stockage, hors ligne, appareil photo) | tests de terrain sur appareils réels |
| Limites actuelles de GitHub Pages et des API de stockage | documentation officielle, à jour |
