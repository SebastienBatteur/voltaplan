# Configuration OAuth : OneDrive, Google Drive, Dropbox

Date : 2026-11-24. **C'est le propriétaire qui crée les applications** avec ses comptes. Les libellés des consoles
changent souvent : ils sont donnés de mémoire, **[à vérifier]** au moment de la création.

## Principes communs

- **Pas de secret.** Voltaplan est une application publique côté navigateur : seul un **identifiant d'application**
  (public) est utilisé, avec PKCE pour OneDrive et Dropbox. Ne créez jamais de « client secret », et ne le mettez
  jamais dans le dépôt.
- **Adresse de redirection** (identique pour les trois services) :
  - production : `https://voltaplan.org/app/oauth.html` ;
  - développement : `http://localhost:5174/oauth.html` (facultatif, pour tester en local).
- **Origine** (Google) : `https://voltaplan.org`, et `http://localhost:5174` en développement.
- **Permissions minimales** : dossier propre à l'application (OneDrive, Dropbox) ou fichiers créés par Voltaplan
  (Google). Voltaplan ne voit jamais le reste du stockage.
- **Après création** : ajoutez les identifiants comme **variables** (pas des secrets, ils sont publics) dans
  *Settings → Secrets and variables → Actions → Variables* du dépôt :
  - `VITE_ONEDRIVE_CLIENT_ID` ;
  - `VITE_GOOGLE_CLIENT_ID` ;
  - `VITE_DROPBOX_CLIENT_ID`.

  Relancez ensuite le workflow **Pages**. Les variables sont déjà câblées dans `.github/workflows/pages.yml`, et le
  build les injecte (vérifié : elles sont présentes, vides, dans le build actuel).
- **Sans ces variables**, chaque utilisateur peut encore saisir son propre identifiant dans la fenêtre
  d'enregistrement (onglet « Drive, OneDrive, Dropbox »).

## OneDrive (Microsoft Entra ID)

1. https://entra.microsoft.com → *Identité → Applications → Inscriptions d'applications → Nouvelle inscription*.
2. **Nom** : Voltaplan.
3. **Types de comptes** : « Comptes dans un annuaire organisationnel et comptes Microsoft personnels ».
4. **URI de redirection** : plateforme **Application monopage (SPA)**, adresse `https://voltaplan.org/app/oauth.html`
   (ajoutez l'adresse locale si besoin). Choisir « SPA » et non « Web » : c'est ce qui autorise PKCE sans secret.
5. **Autorisations d'API** : *Microsoft Graph → Autorisations déléguées → `Files.ReadWrite.AppFolder`*. Retirez
   `User.Read` s'il n'est pas utilisé (Voltaplan n'en a pas besoin).
6. **Aucun secret, aucun certificat.**
7. Copiez l'**ID d'application (client)** dans `VITE_ONEDRIVE_CLIENT_ID`.

Remarques :

- Un compte professionnel dont l'administrateur bloque le consentement des utilisateurs verra une demande
  d'approbation par l'administrateur.
- Sans « vérification de l'éditeur », l'écran de consentement indique « non vérifié ». La vérification est
  gratuite mais demande un compte Microsoft Partner **[à vérifier]**.
- Gros fichiers : la CSP autorise maintenant `*.1drv.com`, `api.onedrive.com` et `*.sharepoint.com`, pour les
  liens de téléchargement et les sessions d'envoi. **[à vérifier avec un vrai compte, personnel et professionnel]**

## Google Drive (Google Cloud)

1. https://console.cloud.google.com → nouveau projet « Voltaplan ».
2. *API et services → Bibliothèque* : activez **Google Drive API**.
3. *Écran de consentement OAuth* :
   - type **Externe** ;
   - nom de l'application, adresse d'assistance (une adresse dédiée, pas personnelle) ;
   - logo facultatif ;
   - domaine de l'application `voltaplan.org` ;
   - politique de confidentialité : `https://voltaplan.org/en/privacy.html` (aussi en français et en néerlandais) ;
   - conditions d'utilisation : `https://voltaplan.org/en/terms.html` ;
   - **domaines autorisés** : `voltaplan.org` ;
   - **portée** : `https://www.googleapis.com/auth/drive.file`, la seule demandée. Elle est classée « non sensible »
     **[à vérifier]**.
4. *Identifiants → Créer → ID client OAuth → Application Web* :
   - origines JavaScript autorisées : `https://voltaplan.org` ;
   - URI de redirection autorisés : `https://voltaplan.org/app/oauth.html`.
5. Copiez l'**ID client** dans `VITE_GOOGLE_CLIENT_ID`.
6. **Statut de publication** :
   - « En test » : limité aux utilisateurs de test que vous ajoutez (100 au plus **[à vérifier]**) ;
   - pour tous, « En production », avec la vérification de la marque. Google demande la preuve de propriété du
     domaine (Search Console, enregistrement DNS TXT — **c'est une modification DNS, à faire par vous**).

### Google Drive : « Ouvrir avec Voltaplan » et « Nouveau → Voltaplan »

Code : `src/io/driveOpenWith.ts` (lecture du paramètre `state`), `DriveOpenPrompt` (src/ui/StorageDialog.tsx),
crochet de démarrage dans `src/App.tsx`. Détails et limites : [google-drive.md § 9](google-drive.md#9-ouvrir-avec-voltaplan-depuis-google-drive).

**Ce que dit la documentation de Google** (pages consultées le 2026-11-24 ; elles ne portent pas de date de mise à
jour visible) :

| Question | Réponse documentée | Source |
|---|---|---|
| Où se configure l'intégration ? | API Google Drive → onglet *Drive UI integration* de la page de configuration de l'API (même projet Cloud que l'ID client) | [Configure a Drive UI integration](https://developers.google.com/workspace/drive/api/guides/enable-sdk) |
| Adresse d'ouverture | « doit contenir un nom de domaine complet ; `localhost` ne fonctionne pas » ; Drive y ajoute `state` (JSON encodé) | même page |
| Que faut-il pour apparaître dans « Ouvrir avec » / « Nouveau » ? | l'application doit demander la portée `https://www.googleapis.com/auth/drive.install` (l'utilisateur la voit dans l'écran de consentement) | même page |
| Marketplace obligatoire ? | **non indiqué comme obligatoire** pour « Ouvrir avec » ; la même configuration est « aussi requise » pour une fiche Google Workspace Marketplace, et la propriété de l'adresse doit être vérifiée avant de publier une fiche | même page |
| Rendre l'application disponible aux autres | « suivre un processus de publication » ; les particuliers installent les applications Drive depuis le Marketplace ou par *Nouveau → Plus → Connecter d'autres applications* | [Publish your Drive app](https://developers.google.com/workspace/drive/api/guides/publish) |
| Fiche privée ou publique | privée : seulement les utilisateurs du **domaine Workspace** de l'éditeur ; publique : tout le monde, après **examen par Google** ; le choix est **définitif** ; un développeur avec un compte grand public (`@gmail.com`) ne peut publier qu'en public | [Configure your app in the Marketplace SDK](https://developers.google.com/workspace/marketplace/sdk), [Publish your Drive app](https://developers.google.com/workspace/drive/api/guides/publish) |
| `drive.file` suffit-elle pour lire le fichier ouvert ? | `drive.file` couvre les fichiers « que vous ouvrez avec une application » ou partagés par le Google Picker | [Choose Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) |
| Format de `state` | ouvrir : `{"ids":[…],"resourceKeys":{…},"action":"open","userId":"…"}` ; documents Google : `exportIds` ; créer : `{"action":"create","folderId":"…","folderResourceKey":"…","userId":"…"}` ; traiter chaque ouverture comme une connexion possible (`userId`) ; envoyer `X-Goog-Drive-Resource-Keys` si des clés sont données | [Integrate with Drive UI's Open with](https://developers.google.com/workspace/drive/api/guides/integrate-open), [Integrate with Drive UI's New button](https://developers.google.com/workspace/drive/api/guides/integrate-create) |

**Conclusion pour Voltaplan** (à confirmer avec de vrais comptes, **[à vérifier]** partout) :

- **Pas de Marketplace pour commencer.** Le propriétaire et les utilisateurs de test font apparaître Voltaplan dans
  « Ouvrir avec » en accordant `drive.install` : bouton « Ajouter à « Ouvrir avec » de Drive » dans Enregistrer
  sous → Drive, OneDrive, Dropbox → Google Drive (`cloudConnect(…, { extraScope: drive.install })`). Cette portée
  ne donne accès à aucun fichier ; elle n'est demandée que par ce bouton, jamais à chaque connexion.
- **Pour le grand public** (comptes `@gmail.com`), une fiche **publique** du Marketplace sera probablement
  nécessaire pour que l'application soit trouvable et installable par *Connecter d'autres applications* ; une
  fiche privée ne sert qu'à un domaine Workspace. Elle implique l'examen de Google, la vérification de l'écran de
  consentement et la preuve de propriété du domaine (modification DNS, **à faire par le propriétaire**).
- **`drive.file` suffit** pour lire et réécrire un fichier ouvert par « Ouvrir avec » (aucune portée plus large
  n'est demandée) ; pour « Nouveau », la création dans le dossier choisi (`parents`) avec `drive.file` est
  **[à vérifier]**.

**Configuration dans la console** (même projet que l'ID client ci-dessus) :

1. *API et services → API activées → Google Drive API → onglet « Drive UI integration »* (libellés **[à vérifier]**).
2. **Nom de l'application** : Voltaplan ; descriptions courte et longue (elles apparaissent dans *Gérer les
   applications* de Drive).
3. **Icônes** : PNG à fond transparent. La documentation actuelle ne donne pas de tailles ; les tailles
   historiquement demandées sont 16, 32, 48, 64, 128 et 256 px **[à vérifier dans le formulaire]**. Partir de
   `public/icon.svg` (le dépôt contient déjà 256 et 512 px : `public/icons/`). Délai d'affichage : jusqu'à 24 h.
4. **URL d'ouverture (Open URL)** : `https://voltaplan.org/app/` — l'application elle-même ; Drive y ajoute
   `?state=…`. Pas de page dédiée : le paramètre est lu au démarrage puis retiré de l'adresse.
5. **Types MIME par défaut** : `application/vnd.voltaplan+zip`. **Extensions par défaut** : `voltaplan` (couvre
   aussi les anciens fichiers v1, enregistrés en `application/json` : Drive les reconnaît par l'extension). Ne
   **pas** déclarer `application/json` ni l'extension `json` (Voltaplan apparaîtrait pour tous les fichiers JSON).
   Les dossiers de projet s'ouvrent depuis Voltaplan (Ouvrir → Drive → Dossiers de projet) ; si Drive transmet
   quand même le `project.json` d'un dossier créé par Voltaplan, il est ouvert comme dossier.
6. **Types et extensions secondaires** : aucun. **Importation** (documents Google) : non cochée. **Disques
   partagés** : facultatif (Voltaplan envoie `supportsAllDrives=true`) **[à vérifier]**.
7. **Création de fichiers** : cocher « Creating files », **URL de création (New URL)** :
   `https://voltaplan.org/app/` (même adresse : `action: "create"`). Laisser vide le champ « Document name » (il
   n'est plus utilisé).
8. **Écran de consentement** : ajouter la portée `https://www.googleapis.com/auth/drive.install` à côté de
   `drive.file` (classement sensible ou non **[à vérifier]**).
9. **Essais** : statut « En test », comptes ajoutés comme utilisateurs de test. L'URL d'ouverture ne peut pas être
   `localhost` : essais sur `https://voltaplan.org/app/` (ou une adresse de préproduction avec un vrai nom de
   domaine). Scénarios : [tests-cloud-reels.md](tests-cloud-reels.md) (D1 à D6).
10. **Marketplace** (plus tard, pour le grand public) : *Google Workspace Marketplace SDK* activé dans le même
    projet → configuration de l'application (intégration « Drive app », portées `drive.file` et `drive.install`),
    puis fiche publique (captures, icônes, conditions, politique de confidentialité) et examen par Google.

Remarque : Voltaplan utilise pour Google le flux « jeton » sans secret. Google recommande le flux « code » avec PKCE ;
pour un client « Application Web », ce flux exige un secret côté serveur, que Voltaplan n'a pas. À réexaminer si
Google restreint le flux jeton **[à vérifier]**.

## Dropbox

1. https://www.dropbox.com/developers/apps → *Create app*.
2. **Scoped access**, puis **App folder** (et non *Full Dropbox*), nom « Voltaplan ».
3. Onglet **Permissions** : cochez **`files.metadata.read`**, **`files.content.read`** et **`files.content.write`**,
   puis *Submit*.
   - `files.metadata.read` est **nécessaire** pour lister les projets et lire la révision d'un fichier : Voltaplan
     la demande désormais explicitement (`src/io/cloud.ts`).
   - Les dossiers de projet (`Applications/Voltaplan/<projet>/`, `src/io/dropboxFolder.ts`) n'ont besoin d'aucune
     autorisation de plus (envoi, sessions d'envoi, liste, métadonnées).
4. Onglet **Settings** :
   - **Redirect URIs** : `https://voltaplan.org/app/oauth.html` ;
   - **Allow public clients (Implicit Grant & PKCE)** : *Allow* ;
   - **App key** : à copier dans `VITE_DROPBOX_CLIENT_ID`. L'*App secret* n'est jamais utilisé.
5. **Statut** : *Development*, limité à un nombre d'utilisateurs **[à vérifier : 500]**. Au-delà, demandez le
   passage en *Production* (revue par Dropbox).

## GitHub (enregistrement dans un dépôt)

Rien à créer côté projet. Chaque utilisateur crée un **jeton personnel à portée fine** (*fine-grained*) :

- limité à **un dépôt privé** ;
- permission *Contents : Read and write* ;
- expiration courte.

Il le colle dans Voltaplan, qui le chiffre localement.

## Après la configuration

Dérouler les scénarios de [tests-cloud-reels.md](tests-cloud-reels.md) avec un **projet d'essai**, jamais un
dossier de client, et noter les résultats dans son tableau.

## Application de bureau

L'application de bureau (Tauri) n'est pas servie depuis `voltaplan.org`. Les redirections OAuth vers
`oauth.html` n'y ont **pas été étudiées ni testées**. En attendant, le stockage cloud y passe par le dossier
synchronisé du client OneDrive, Google Drive ou Dropbox installé sur l'ordinateur.
