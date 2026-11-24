# Validation par plateforme : hors ligne, stockage, application installée

Date : 2026-11-24. **Seul l'état « testé » prouve quelque chose** ; tout le reste est marqué « non testé ».
Complète [offline.md](offline.md) (fonctionnement) et [desktop-tauri.md](desktop-tauri.md) (application de bureau).

## 1. Trois catégories de fonctions

| Catégorie | Fonctions | Hors ligne |
|---|---|---|
| **A. Entièrement disponibles** | unifilaire, plan de position, tableau, liste du matériel, calculs, contrôle RGIE, dossier imprimé / PDF (impression du navigateur), import et export Trikker, export Eendraadschema, fond de plan depuis une image ou un PDF, détection des murs, calage de la photo du tableau, ouverture et enregistrement de fichiers sur l'appareil, projets du navigateur, versions locales, brouillons, langues | **oui**, dès la première visite (tout est mis en cache à l'installation) |
| **B. Interface disponible, service nécessaire** | IA en ligne (Anthropic, OpenAI, Gemini, Mistral), GitHub, Google Drive, OneDrive, Dropbox | la fenêtre s'ouvre ; l'action est **désactivée ou mise en attente** avec le message « Nécessite une connexion Internet » ; un enregistrement vers ces services est **mis en attente** (gardé dans le navigateur, repris au retour du réseau ou au prochain lancement) |
| **C. Service local** | IA locale (Ollama, LM Studio sur le même ordinateur) | **oui**, si le service tourne sur l'ordinateur ; le bouton de lecture IA reste actif hors ligne dans ce cas |

**Comment l'utilisateur le sait** :

- un repère « Hors ligne » dans la barre, dont l'info-bulle liste ce qui est disponible et ce qui ne l'est pas ;
- le bouton IA grisé, avec l'explication en info-bulle ;
- l'avertissement dans les onglets GitHub et services en ligne ;
- l'état d'enregistrement « En attente d'envoi ».

## 2. Procédure de validation (à dérouler par plateforme)

**Préparation** : ouvrir https://voltaplan.org/app/ (domaine définitif ; l'ancienne adresse
`sebastienbatteur.github.io/voltaplan/` y redirige). Ouvrir un projet d'exemple et l'enregistrer dans le navigateur.

| # | Étape | Résultat attendu |
|---|---|---|
| 1 | Première visite en ligne, attendre 10 s | aucune erreur ; dans les outils de développement (si disponibles), le cache `voltaplan-<version>` contient environ 22 fichiers |
| 2 | Passer en mode avion, recharger | l'application s'affiche ; repère « Hors ligne » |
| 3 | Catégorie A : dessiner un circuit, ouvrir le plan, le tableau, le contrôle, imprimer le dossier en PDF, importer un `.trik`, ajouter un fond de plan PDF | tout fonctionne |
| 4 | Catégorie B : bouton « Lire avec l'IA », onglet OneDrive | désactivé ou avertissement ; aucune erreur brute |
| 5 | Enregistrer un projet ouvert depuis OneDrive, toujours hors ligne | « En attente d'envoi (OneDrive) » ; message clair |
| 6 | Fermer complètement l'application, la rouvrir hors ligne | bandeau « Enregistrement en attente… Reprendre » et/ou « Travail non enregistré retrouvé » |
| 7 | Revenir en ligne, « Reprendre » | envoi fait, état « Enregistré (OneDrive, hh:mm) » |
| 8 | Fichier → Versions locales | les versions apparaissent ; « Ouvrir » charge un nouveau projet |
| 9 | Fenêtre Enregistrer → onglet Navigateur | place utilisée affichée ; « Protégé » après acceptation |
| 10 | Publier une nouvelle version du site pendant que l'application est ouverte | bandeau « Nouvelle version disponible » ; « Recharger » garde les modifications |
| 11 | Ne pas ouvrir l'application pendant 8 jours (Safari seulement) | les projets du navigateur sont toujours là (PWA installée) ; **sinon, noter la perte** |

## 3. État par plateforme

| Plateforme | Installation | 1–2 hors ligne | 3 cat. A | 4–5 cat. B | 6–7 reprise | 9 persistance | 10 mise à jour | 11 éviction | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Chrome Windows | — (onglet) | **testé** (Chrome sans interface, 2026-11-24) | **partiel** : chargement de tous les modules testé ; parcours complet non testé | **testé** par simulation dans le panneau de navigateur | **testé** (simulation, panneau de navigateur) | non testé | **testé** (Chrome sans interface) | sans objet | |
| PWA installée Chrome / Edge Windows | non testé | non testé | non testé | non testé | non testé | non testé | non testé | sans objet | ouverture des `.voltaplan` par double-clic (`file_handlers`) non testée |
| Firefox (Windows, macOS, Linux) | sans objet (pas d'installation PWA sur ordinateur) | non testé | non testé | non testé | non testé | non testé (Firefox peut demander l'autorisation) | non testé | sans objet | pas de File System Access : « Enregistrer » télécharge un fichier |
| Safari macOS | non testé (« Ajouter au Dock », macOS 14 et plus **[à vérifier]**) | non testé | non testé | non testé | non testé | non testé | non testé | non testé | pas de File System Access |
| Safari iOS (onglet) | sans objet | non testé | non testé | non testé | non testé | non testé | non testé | **risque** : éviction après 7 jours sans visite **[à vérifier]** | conseiller l'installation |
| PWA iPhone / iPad (écran d'accueil) | non testé | non testé | non testé | non testé | non testé | non testé | non testé | non testé | stockage séparé de Safari : un projet du navigateur Safari n'est **pas** visible dans la PWA **[à vérifier]** |
| Chrome Android (onglet) | sans objet | non testé | non testé | non testé | non testé | non testé | non testé | sans objet | |
| PWA installée Android | non testé | non testé | non testé | non testé | non testé | non testé | non testé | sans objet | |

« Testé » signifie : vérifié pendant le développement, dans un Chrome sans interface ou dans le panneau de
navigateur de l'outil, souvent par simulation (événement hors ligne, révision IndexedDB modifiée). Ce n'est **pas**
une validation sur un appareil réel.

## 4. Priorités de validation

1. **PWA iPhone** : la plateforme la plus restrictive (stockage, éviction, fichiers, appareil photo).
2. **Chrome Android** et sa PWA : la cible principale du relevé sur chantier.
3. **Safari macOS** et **Firefox** : ils n'ont pas File System Access, donc l'enregistrement se fait par
   téléchargement.
4. **PWA Windows** : ouverture par double-clic.
