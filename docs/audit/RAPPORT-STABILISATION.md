# Rapport de stabilisation avant la bêta publique

Date : 2026-11-24. Base : `main` (historique linéaire). Liste de contrôle :
[PUBLICATION-CHECKLIST.md](PUBLICATION-CHECKLIST.md).

**Légende des niveaux de preuve** :

- **CI** : exécuté par GitHub Actions ;
- **local** : exécuté sur l'ordinateur de développement ;
- **simulé** : réponses de service, pannes ou appareils simulés dans les tests ;
- **émulation** : navigateur intégré en taille téléphone ;
- **réel** : vérifié avec de vrais comptes ou appareils.

## 1. CI/CD et sécurité

| Contrôle | Résultat | Niveau |
|---|---|---|
| CI (typage, lint, tests, build, audit npm) | vert sur `main` | CI |
| CI multi-OS (Windows, macOS) | vert | CI |
| Secrets (gitleaks, historique complet) | vert | CI |
| Desktop build (Tauri, 3 systèmes) | vert sur `main` | CI |
| Pages (déploiement de voltaplan.org) | vert ; certificat validé (`voltaplan.org`, `www.voltaplan.org`), HTTPS forcé | CI et API GitHub |
| CodeQL | **vert** depuis `23d0c3b`. Résultats désormais publiés dans l'onglet Security (dépôt public) | CI |

**Alertes CodeQL** (3 nouvelles, examinées une par une) :

| Alerte | Décision |
|---|---|
| `js/insecure-temporary-file` dans `tools/perf-v2/run.ts` | **corrigée** : dossier temporaire créé par `mkdtemp` |
| `js/http-to-file-access` dans `tools/ai-eval/run.ts` | **atténuée et justifiée** : réponse revalidée par le schéma avant écriture, nom de fichier local ; outil de développement seulement |
| `js/file-access-to-http` dans `src/ai/provider.ts` | **justifiée** : c'est la fonction (la photo choisie part vers le fournisseur configuré par l'utilisateur, après son accord, dans les limites de la CSP) |

Une quatrième alerte, apparue sur une branche de travail (`js/incomplete-sanitization`, dans un test), a été
corrigée. Les justifications sont dans `.github/codeql-accepted.txt` : toute nouvelle alerte fait échouer le job.

**Historique linéaire** : une règle GitHub interdit les commits de fusion sur `main`. Toutes les intégrations ont
été faites par rebase, sans réécrire l'historique publié.

## 2. Format v2 et intégrité

Tests ajoutés (**simulé**, tous verts en local et en CI) :

| Scénario | Résultat |
|---|---|
| Interruption pendant l'enregistrement (fichier, archive annulée, dossier cloud coupé) | l'original reste intact, rien n'est publié à moitié, la reprise ne renvoie que ce qui manque. **Défaut corrigé** : un fichier vide laissé dans un répertoire local bloquait définitivement le dossier |
| Disque plein, navigateur plein | erreurs claires (« plus de place sur le disque ») ; aucun document supprimé ; les images d'affichage sont libérées d'abord |
| Quota cloud dépassé (OneDrive 507, Dropbox `insufficient_space`, Drive `storageQuotaExceeded`, GitHub au-delà de 100 Mo) | erreur typée, version gardée localement, **pas de boucle de nouvel essai** |
| Fermeture brutale (mise à niveau de la base interrompue, panne entre un document et le modèle, entre le brouillon et le fichier) | aucune perte ; brouillon et enregistrement en attente proposés au lancement suivant |
| Deux appareils (photos ajoutées en même temps, suppression d'un côté) | les deux photos sont conservées, le perdant devient une copie de conflit complète, aucune suppression distante |
| Migration v1 → v2 | lecture en flux : mémoire maximale ramenée de **+184 Mo à environ +34 Mo** pour un fichier v1 de 47 Mo (Node sur ordinateur, **pas sur mobile**) ; durée de 0,6 à 1,9 s |

**Écriture atomique sous Tauri** (branche `tauri-ecriture-atomique-v2`) :

- **compilée** sur Windows, macOS et Linux, `cargo test` 12/12 sur les trois (**CI**) ;
- écriture par morceaux de 4 Mo (le projet n'est jamais entièrement en mémoire), fichier temporaire vérifié, copie
  `.bak`, remplacement atomique ;
- installateurs de test produits en artefacts, **sans release** ;
- **pas encore intégrée dans `main`** : jamais essayée dans l'application installée (voir B6 de la liste de
  contrôle).

## 3. Assistant IA

- **Protocole d'évaluation reproductible** ([assistant-evaluation.md](../assistant-evaluation.md)) :
  - corpus d'au moins 30 tableaux répartis par type, règles d'anonymisation et de consentement ;
  - guide d'annotation, double annotation sur 20 % des tableaux ;
  - métriques : détection, champs, **taux d'informations inventées**, abstention, contradictions, reconstruction de
    plusieurs tableaux ;
  - intervalles de confiance à 95 % ; seuils proposés pour la bêta.
- **Comparaison de fournisseurs** (`npm run ai-eval:matrix`) :
  - simulation à blanc par défaut, avec estimation des appels, des jetons et du coût ;
  - aucun appel sans `--live --i-authorize-costs` et un budget maximal ;
  - rapport : qualité, latence (p50 et p95), coût par photo et pour 100 tableaux ; répétabilité.
- **Aucun appel à une IA n'a été fait.** Les tests de l'assistant utilisent des lectures simulées : ils valident la
  logique déterministe, **pas la qualité de reconnaissance**.
- **Deux défauts trouvés par le banc et corrigés** :
  - sous-tableau en double après une nouvelle photo ;
  - enfants abandonnés lors d'une acceptation en un seul lot.
- L'assistant est désormais affiché comme **expérimental**.

## 4. Domaine et stockage cloud

| Point | Résultat | Niveau |
|---|---|---|
| voltaplan.org, chemin `/app/` | l'artefact publié contient le site, `app/`, `oauth.html`, le manifest et le service worker ; certificat validé selon l'API | CI et API |
| Accès depuis ce poste | **bloqué par le filtre web FortiClient** (certificat Fortinet présenté, page « Web Page Blocked! ») : ce n'est pas un défaut du site, **à vérifier depuis un autre réseau** | réel (diagnostic) |
| Redirection OAuth | `https://voltaplan.org/app/oauth.html`, calculée depuis l'adresse de la page | code |
| Variables du build | `VITE_ONEDRIVE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID` et `VITE_DROPBOX_CLIENT_ID` câblées et présentes (vides) dans le build publié | CI |
| Permissions | OneDrive `Files.ReadWrite.AppFolder` ; Google `drive.file` ; Dropbox : **`files.metadata.read` ajoutée** (nécessaire pour lister et lire les révisions), avec `files.content.read` et `files.content.write` | code |
| CSP pour les gros transferts OneDrive | `*.1drv.com`, `api.onedrive.com` et `*.sharepoint.com` ajoutés, web et bureau ; le test interdit toujours toute source générique | local et CI ; **réel à vérifier** |
| Procédure OAuth | [oauth-configuration.md](../oauth-configuration.md) (OneDrive, Google, Dropbox, variables, GitHub) | — |
| Ancienne adresse | `sebastienbatteur.github.io/voltaplan/` redirige vers voltaplan.org ; les données gardées dans le navigateur sous l'ancienne adresse ne sont plus accessibles (cela ne concerne que les essais du propriétaire) | réel (HTTP 301) |

## 5. Compatibilité mobile

| Point | Résultat | Niveau |
|---|---|---|
| Mise en page à 375 × 812 (agent Android, tactile) | utilisable, sans défilement horizontal. **Corrigé** : la colonne latérale est repliée par défaut sur petit écran | émulation |
| Défauts restants | barre d'outils sur 3 lignes ; réglages du tableau qui se superposent au dessin ; **17 boutons** sous la taille tactile recommandée ; indication « clic droit » ; pas de zoom à deux doigts | émulation |
| Prise de photo | sélecteur `accept="image/*"` (iOS et Android proposent l'appareil photo) | code, **pas testé sur appareil** |
| PWA (installation, hors ligne, mise à jour sans perte) | testé dans Chrome sans interface lors d'une étape précédente ; impossible dans le panneau intégré (pas de service worker) | **non testé sur Android ni iOS** |
| Appareils à peu de mémoire | non testé | — |

## 6. Risques résiduels

1. **Qualité réelle de l'IA inconnue** : aucun essai sur de vraies photos. L'assistant reste expérimental.
2. **Cloud jamais testé avec de vrais comptes** : erreurs réelles, limites, CSP OneDrive, révisions Drive et quota.
3. **Aucun test sur un vrai téléphone** : stockage, éviction iOS, appareil photo, mise à jour de la PWA.
4. **Bureau** : écriture atomique non essayée dans l'application installée ; installateurs non signés.
5. **Réglementaire et juridique** : règles « à relire », conditions d'utilisation à faire relire.
6. **Accès au site depuis ce poste** bloqué par FortiClient : le comportement réel de voltaplan.org n'a pas pu être
   observé directement.

## 7. Validations manuelles nécessaires (propriétaire)

1. Ouvrir https://voltaplan.org depuis un réseau sans filtrage (téléphone en 4G, par exemple) ; ou demander
   l'autorisation du domaine dans FortiClient.
2. Dérouler la liste A de [PUBLICATION-CHECKLIST.md](PUBLICATION-CHECKLIST.md) : navigateurs, téléphones,
   enregistrement et réouverture.
3. Créer les applications OAuth ([oauth-configuration.md](../oauth-configuration.md)), puis faire les essais cloud.
4. Installer les artefacts de la branche Tauri et suivre [desktop-tauri.md](../desktop-tauri.md), § 11.
5. Constituer le corpus de photos anonymisées et lancer l'évaluation IA, **après avoir validé le coût**.
