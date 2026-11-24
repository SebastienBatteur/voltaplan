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
