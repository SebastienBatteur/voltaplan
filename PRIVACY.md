# Confidentialité

Voltaplan fonctionne **sur votre appareil** (« local d'abord ») : il n'y a **pas de serveur Voltaplan**, pas de compte, pas de publicité et **aucune mesure d'audience ni télémétrie**. Le site ne fait que livrer les fichiers de l'application ; ensuite, tout se passe dans votre navigateur ou dans l'application de bureau.

Un dossier d'installation électrique contient des données personnelles (nom et adresse du client, adresse du chantier, coordonnées de l'installateur, photos du tableau, plan du logement). Voici où elles vont.

## Ce qui est enregistré, et où

| Donnée | Où | Remarques |
|---|---|---|
| Projets enregistrés « dans le navigateur », **brouillons automatiques** (un par onglet) et **versions locales** (dernières versions de chaque projet) | IndexedDB du navigateur (base `voltaplan`), sur cet appareil | Ils permettent de récupérer le travail après une fermeture inattendue ou un conflit. Le nombre de versions gardées diminue si l'espace manque. Visibles dans Fichier → Versions locales. |
| Enregistrements **en attente** (pas de réseau, reconnexion nécessaire) | `localStorage` (emplacement visé, nom, date ; pas le contenu, qui est dans les versions locales) | Proposés à la reprise au lancement suivant. |
| **Dossier de l'assistant** (sources, lectures, propositions, questions, historique) | Dans le projet lui-même | Contient ce qui a été lu sur les photos (calibres, étiquettes) et l'empreinte des photos ; il voyage avec le projet. |
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
| Vous activez l'IA, enregistrez **votre** clé d'API (ou un modèle local) et demandez la **lecture d'une photo de tableau** | Le fournisseur que **vous** avez choisi : Anthropic (`api.anthropic.com`), OpenAI (`api.openai.com`), Google Gemini (`generativelanguage.googleapis.com`), Mistral (`api.mistral.ai`), ou un **modèle local** sur votre ordinateur (Ollama, LM Studio : rien ne quitte l'ordinateur) | La photo du tableau (réduite, redressée), le nombre de rangées et de modules, la langue des remarques. Pas le nom ni l'adresse du client. L'IA est désactivée par défaut, chaque usage doit être autorisé, et le service destinataire est affiché avant l'envoi. Les conditions du fournisseur choisi s'appliquent ; son coût est à votre charge. |
| Vous choisissez d'enregistrer ou d'ouvrir un projet sur **GitHub** | GitHub (`api.github.com`) | Le projet complet, dans le dépôt et le dossier que vous avez indiqués, avec votre jeton personnel. Attention : un dépôt **public** rend le dossier visible par tous. |
| Vous choisissez **Google Drive**, **OneDrive** ou **Dropbox** | Google (`www.googleapis.com`), Microsoft (`login.microsoftonline.com`, `graph.microsoft.com`), Dropbox (`api.dropboxapi.com`, `content.dropboxapi.com`) | La connexion (fenêtre du service, OAuth ; PKCE pour OneDrive et Dropbox), puis le projet complet que vous enregistrez ou ouvrez. Accès limité : dossier de l'application (OneDrive), fichiers créés par Voltaplan (Google Drive), fichiers de l'application Dropbox enregistrée. |
| Vous ouvrez la version web | L'hébergeur du site (GitHub Pages) | Les requêtes habituelles pour télécharger l'application (adresse IP, navigateur), comme pour tout site. Aucun cookie ni traceur ajouté par Voltaplan. |

La politique de sécurité du contenu de l'application (`src/security/csp.ts`) **bloque toute connexion vers un autre service** que ceux listés ci-dessus.

Les exports (PDF, CSV, `.trik`, `.eds`) sont des fichiers créés sur votre appareil ; ce que vous en faites ensuite (envoi à l'organisme agréé, etc.) ne passe pas par Voltaplan.

## Autres traitements, hors de l'application

- **Tickets et discussions sur GitHub** : publics. N'y joignez jamais un dossier, une photo ou une adresse de client.
- **Dons** (GitHub Sponsors) : traités par GitHub selon ses propres conditions ; Voltaplan ne reçoit que ce que GitHub transmet aux bénéficiaires.
- **Statistiques** : aucune. Si cela devait changer, ce serait sans cookie, annoncé ici et désactivable.

L'absence de serveur réduit fortement les données traitées, mais ne supprime pas toutes les obligations : chaque service que vous choisissez (hébergeur du site, stockage, IA) traite des données selon ses propres conditions.

## Vos responsabilités

Vous restez responsable des données de vos clients : n'enregistrez un dossier dans un service en ligne (GitHub, Drive…) que si c'est compatible avec vos obligations (RGPD), et préférez un dépôt GitHub **privé**.

## Contact

Question ou problème de confidentialité : ouvrir un ticket sur le dépôt, ou, pour une faille, suivre [SECURITY.md](SECURITY.md).
