# Confidentialité

Voltaplan fonctionne **sur votre appareil** (« local d'abord ») : il n'y a **pas de serveur Voltaplan**, pas de compte, pas de publicité et **aucune mesure d'audience ni télémétrie**. Le site ne fait que livrer les fichiers de l'application ; ensuite, tout se passe dans votre navigateur ou dans l'application de bureau.

Un dossier d'installation électrique contient des données personnelles (nom et adresse du client, adresse du chantier, coordonnées de l'installateur, photos du tableau, plan du logement). Voici où elles vont.

## Ce qui est enregistré, et où

| Donnée | Où | Remarques |
|---|---|---|
| Projets enregistrés « dans le navigateur » et **brouillon automatique** | IndexedDB du navigateur (base `voltaplan`), sur cet appareil | Le brouillon permet de récupérer le travail après une fermeture inattendue ; il est effacé quand le projet est enregistré. |
| Projets enregistrés « sur cet appareil » | Le fichier `.voltaplan` que vous choisissez | Fichier JSON lisible. Les photos et fonds de plan y sont intégrés (images JPEG). |
| Réglages : langue, disposition des panneaux, dépôt GitHub choisi, identifiants d'application Drive / OneDrive / Dropbox, réglages de l'IA | `localStorage` du navigateur (clés `voltaplan.…`) | Aucune donnée de projet. |
| **Clé d'API de l'IA** et **jeton GitHub** | `localStorage`, **chiffrés** (AES-GCM 256 bits, clé dérivée de votre phrase secrète par PBKDF2-SHA-256, 600 000 itérations) | La phrase secrète n'est jamais enregistrée. La clé ou le jeton déchiffré reste en mémoire le temps de la session. |
| Jetons de connexion Google Drive / OneDrive / Dropbox | Mémoire uniquement | Perdus à la fermeture de l'onglet ou de l'application. |
| Fichiers de l'application (hors ligne) | Cache du service worker (version web) | Uniquement le code et les images de l'application, jamais vos projets. |

Dans l'application de bureau, les mêmes réglages sont gardés dans le profil de la fenêtre de l'application, et les projets dans les fichiers que vous choisissez avec la boîte de dialogue du système.

Pour tout effacer : supprimer les données du site dans le navigateur (ou désinstaller l'application de bureau) et supprimer vos fichiers `.voltaplan`.

## Ce qui est envoyé, et à qui

**Rien n'est envoyé sans une action de votre part.** Les seuls envois possibles sont ceux-ci, directement depuis votre appareil vers le service, sans intermédiaire :

| Quand | Vers | Quoi |
|---|---|---|
| Vous activez l'IA, enregistrez **votre** clé d'API et demandez la **lecture d'une photo de tableau** | Anthropic (`api.anthropic.com`) | La photo du tableau (réduite, redressée), le nombre de rangées et de modules, la langue des remarques. Pas le nom ni l'adresse du client. L'IA est désactivée par défaut et chaque usage doit être autorisé dans les réglages. Les conditions d'Anthropic s'appliquent à ces données. |
| Vous choisissez d'enregistrer ou d'ouvrir un projet sur **GitHub** | GitHub (`api.github.com`) | Le projet complet, dans le dépôt et le dossier que vous avez indiqués, avec votre jeton personnel. Attention : un dépôt **public** rend le dossier visible par tous. |
| Vous choisissez **Google Drive**, **OneDrive** ou **Dropbox** | Google (`www.googleapis.com`), Microsoft (`login.microsoftonline.com`, `graph.microsoft.com`), Dropbox (`api.dropboxapi.com`, `content.dropboxapi.com`) | La connexion (fenêtre du service, OAuth ; PKCE pour OneDrive et Dropbox), puis le projet complet que vous enregistrez ou ouvrez. Accès limité : dossier de l'application (OneDrive), fichiers créés par Voltaplan (Google Drive), fichiers de l'application Dropbox enregistrée. |
| Vous ouvrez la version web | L'hébergeur du site (GitHub Pages) | Les requêtes habituelles pour télécharger l'application (adresse IP, navigateur), comme pour tout site. Aucun cookie ni traceur ajouté par Voltaplan. |

La politique de sécurité du contenu de l'application (`src/security/csp.ts`) **bloque toute connexion vers un autre service** que ceux listés ci-dessus.

Les exports (PDF, CSV, `.trik`, `.eds`) sont des fichiers créés sur votre appareil ; ce que vous en faites ensuite (envoi à l'organisme agréé, etc.) ne passe pas par Voltaplan.

## Vos responsabilités

Vous restez responsable des données de vos clients : n'enregistrez un dossier dans un service en ligne (GitHub, Drive…) que si c'est compatible avec vos obligations (RGPD), et préférez un dépôt GitHub **privé**.

## Contact

Question ou problème de confidentialité : ouvrir un ticket sur le dépôt, ou, pour une faille, suivre [SECURITY.md](SECURITY.md).
