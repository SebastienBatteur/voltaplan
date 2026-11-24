# Checklist : les 15 scénarios cloud réels (F1 à F9, D1 à D6)

Date : 2026-11-24. Détail de chaque scénario : [tests-cloud-reels.md](tests-cloud-reels.md). Les résultats vont dans
son tableau « 4. Résultats ».

Qui fait quoi :

- **Toi** : ce qui exige ta main ou ton compte. Connexions OAuth (le navigateur intégré bloque les fenêtres de
  connexion que j'ouvre), consoles Google, Microsoft, Dropbox, second appareil, coupure Wi-Fi, second compte.
- **Moi** : une fois connecté, je pilote l'application dans le navigateur intégré, je prépare les fichiers d'essai et
  je vérifie le résultat sur le site du service (drive.google.com, dropbox.com, onedrive.live.com).
- Chaque scénario est noté **réel** (vrai service, vrai réseau) ou **réel partiel** (vrai service, mais coupure ou
  second appareil remplacé par un second onglet). Les mêmes 15 scénarios existent déjà en **simulé**
  (`test/cloudFolders.test.ts`, `test/driveOpenWith.test.ts`) : ils ne remplacent pas ces essais.

## Séance commune (à jour au 2026-11-25)

Déjà fait en réel : F1 sur les trois services ; F2 et F7 sur Dropbox et Google Drive (avec photo et PDF). Une
séance d'environ 45 minutes couvre le reste ; je prépare tout, tu n'interviens qu'aux étapes marquées **toi**.

1. **toi** : ouvrir `https://voltaplan.org/app/` dans le navigateur intégré, accepter « Recharger » si proposé, me
   dire « go ». **moi** : je place la mesure de la connexion OneDrive (O1) avant ta connexion.
2. **toi**, 3 clics de connexion d'affilée (Google Drive, OneDrive, Dropbox). **moi** : puis, seul :
   - revérifier F2 sur Google Drive (faux conflit corrigé, B1) et le README / les dates sur les trois services ;
   - F1, F2, F7 sur OneDrive ; F8 (transfert Dropbox → Drive) ;
   - surveiller la connexion OneDrive toutes les 5 minutes (O1).
3. **toi**, à mon signal, **couper le Wi-Fi** 10 secondes puis le rétablir, deux fois : F3 (coupure pendant les
   photos) et F5 (gros PDF ; je te demande avant d'envoyer 160 à 260 Mo dans tes comptes).
4. **toi**, sur ton **téléphone** : ouvrir le dossier d'essai Dropbox, ajouter une photo, enregistrer (F4, F9).
5. **toi**, dans **drive.google.com** : clic droit sur un `.voltaplan` → « Ouvrir avec » → Voltaplan (D1, D2), puis
   « Nouveau » → Voltaplan dans un sous-dossier (D5). **moi** : D3 et la vérification.
6. **toi**, avec un **second compte Google** : partager un fichier en lecture seule (D4) et ouvrir depuis ce compte
   (D6).
7. Plus tard, séparément : F6 (compte d'essai presque plein, jamais ton compte principal).

## Avant de commencer (toi)

- [ ] Google Cloud : onglet « Drive UI integration » rempli, `drive.install` déclarée, ton compte dans les
      utilisateurs de test.
- [ ] Microsoft Entra : seule `Files.ReadWrite.AppFolder`, plateforme SPA, redirection
      `https://voltaplan.org/app/oauth.html`.
- [ ] Dropbox : accès « App folder », les 3 permissions cochées, redirection identique, clients publics autorisés.
- [ ] Ouvrir `https://voltaplan.org/app/` dans le navigateur intégré et accepter « Recharger » si proposé.
- [ ] Dire « go » : je prépare le projet d'essai.

## Préparation (moi)

- [ ] Projet « Essai cloud (à supprimer) », **sans aucune donnée de client**, avec trois photos synthétiques
      générées (dont une de plus de 10 Mo).
- [ ] Pour F5 seulement : un PDF synthétique de 160 Mo (Dropbox), 260 Mo (OneDrive). Il occupe cet espace dans ton
      compte jusqu'à ce que tu le supprimes : **je te demande avant**.

## Scénarios

| # | Scénario | Toi | Moi | Type |
|---|---|---|---|---|
| F1 | Premier enregistrement en dossier | cliquer « Enregistrer ici » et accepter la connexion (1 fois par service) | lancer l'enregistrement, vérifier `project.json`, `README.txt`, `assets/` sur le site du service | réel |
| F2 | Modifier le schéma seul | — | modifier un circuit, enregistrer, vérifier que seules les dates de `project.json` changent | réel |
| F3 | Coupure pendant l'envoi des photos | **couper le Wi-Fi** au signal, puis le rétablir | lancer l'envoi, constater « En attente », vérifier que seules les photos manquantes repartent | réel |
| F4 | Deux appareils ajoutent une photo | **ouvrir le dossier sur un 2ᵉ appareil** (téléphone), ajouter une photo, enregistrer | côté ordinateur : ajouter l'autre photo, enregistrer, vérifier les 2 photos et la copie de conflit | réel (ou réel partiel avec 2 onglets, par moi seul) |
| F5 | Gros document | accepter l'espace utilisé ; couper le Wi-Fi pendant l'envoi | importer le PDF, suivre l'envoi par tranches, vérifier la taille finale | réel |
| F6 | Espace plein | fournir un **compte d'essai presque plein** (jamais ton compte principal) et t'y connecter | enregistrer, vérifier le message et que rien n'est perdu | réel |
| F7 | Import d'une archive `.voltaplan` | — | importer l'archive d'essai, comparer avec l'original | réel |
| F8 | Transfert Dropbox → Drive | accepter les 2 connexions | ouvrir le dossier Dropbox, l'enregistrer sur Drive, comparer, vérifier Dropbox intact | réel |
| F9 | Drive : version concurrente | (facultatif) enregistrer en même temps sur ton 2ᵉ appareil | provoquer la course avec 2 onglets, vérifier le conflit ou la copie | réel partiel |
| D1 | Apparition dans « Ouvrir avec » | cliquer « Ajouter à « Ouvrir avec » de Drive » et accepter `drive.install` | vérifier sur drive.google.com (clic droit sur le `.voltaplan`) ; noter si une fiche Marketplace est exigée | réel |
| D2 | Ouvrir depuis Drive | cliquer « Ouvrir avec → Voltaplan » puis le bandeau (fenêtre de connexion) | vérifier le projet ouvert, l'adresse sans `state`, qu'un rechargement ne rouvre rien | réel |
| D3 | Enregistrer après ouverture | — | modifier, enregistrer, vérifier une version de plus, pas de doublon | réel |
| D4 | Fichier v1 ou en lecture seule | partager un fichier en lecture seule depuis **un autre compte** | ouvrir le v1, enregistrer, vérifier un nouveau fichier et l'original intact | réel |
| D5 | « Nouveau » dans un sous-dossier | Drive → Nouveau → Plus → Voltaplan dans un sous-dossier | premier enregistrement, vérifier l'emplacement ; noter toute erreur `drive.file` | réel |
| D6 | Fichier d'un autre compte | ouvrir depuis le **compte B** alors que Voltaplan est connecté au compte A | vérifier le message ou la connexion au bon compte | réel |

## À la fin

- [ ] Moi : remplir le tableau « 4. Résultats » et ouvrir une correction pour chaque écart.
- [ ] Toi : supprimer les fichiers d'essai dans les trois services, si tu le souhaites. **Voltaplan et moi ne
      supprimons rien à distance.**
- [ ] Toi : retirer les accès d'essai si tu veux repartir de zéro (liens dans la politique de confidentialité).

Ordre conseillé, pour regrouper tes interventions : F1 → F2 → F7 → F3 → F5 → F4 → F9 → F8 sur Dropbox et Drive
(OneDrive : F1 à F7), puis D1 → D2 → D3 → D5 → D4 → D6, puis F6 avec le compte d'essai plein.
