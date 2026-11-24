# Bêta publique et version stable : liste de contrôle

Mise à jour : 2026-11-24.

**État actuel** :

- dépôt **public** ;
- site sur **https://voltaplan.org** : certificat Let's Encrypt validé pour `voltaplan.org` et `www.voltaplan.org`,
  HTTPS forcé ; l'ancienne adresse `sebastienbatteur.github.io/voltaplan/` redirige vers le domaine ;
- CI, CI multi-OS, CodeQL, Secrets, Desktop build et Pages verts sur `main` ;
- aucune release publiée.

Rapport de la phase de stabilisation : [RAPPORT-STABILISATION.md](RAPPORT-STABILISATION.md). Audit de publication
(GO, sans point bloquant) : [PUBLICATION-AUDIT.md](PUBLICATION-AUDIT.md).

**Rien de ce qui suit n'est fait sans l'autorisation explicite du propriétaire** : release, dépense, suppression de
données distantes, DNS.

## A. Bloquant pour la bêta publique

| # | Point | État | Qui |
|---|---|---|---|
| A1 | Le site s'ouvre en HTTPS depuis un réseau **sans** filtrage (le filtre FortiClient de ce poste bloque `voltaplan.org`), application sur `/app/`, guide, installation en PWA | à vérifier | propriétaire |
| A2 | **Enregistrer, rouvrir et réenregistrer** un projet v2 dans un vrai Chrome (Windows), puis un vrai Firefox et un vrai Safari ; ouvrir un ancien fichier v1 et vérifier la conversion (l'original n'est pas écrasé) | à faire (simulé et testé automatiquement seulement) | propriétaire |
| A3 | **Un téléphone Android et un iPhone** : ouverture, installation en PWA, prise de photo du tableau, hors ligne, mise à jour de la PWA sans perte (procédure [validation-plateformes.md](../validation-plateformes.md)) | à faire (émulation seulement) | propriétaire |
| A4 | Mentions de la bêta : « aide au dessin et à la vérification, pas de certification » visible (README, site, application, dossier) | **fait** | — |
| A5 | Assistant IA affiché comme **expérimental** tant que l’évaluation réelle n’est pas faite (A6) | **fait** (titre et menu, FR, NL, EN) | — |
| A6 | **Évaluation réelle minimale** de la lecture des photos : au moins 10 tableaux anonymisés, 1 ou 2 modèles, taux d'informations inventées mesuré ([assistant-evaluation.md](../assistant-evaluation.md)) | à faire (aucun appel payant sans accord) | propriétaire |
| A7 | **Installateurs de bureau** : soit présentés comme « aperçu non signé, non testé », soit retirés de l'annonce. Les artefacts de test non signés expirent seuls d'ici au 24/12 ; leur suppression anticipée demande ton accord | décision | propriétaire |
| A8 | **Stockage cloud** : présenté comme expérimental, ou au moins un fournisseur (OneDrive) validé avec de vrais comptes (scénarios C1 à C10 de [tests-cloud-reels.md](../tests-cloud-reels.md)) après création des applications OAuth ([oauth-configuration.md](../oauth-configuration.md)) | à faire | propriétaire |
| A9 | Bouton « Sponsor » : inscription à GitHub Sponsors faite, sinon retirer ou remplacer la ligne de `FUNDING.yml` | à vérifier | propriétaire |
| A10 | Activer *Private vulnerability reporting*, *Secret scanning* et *Push protection* dans les réglages du dépôt | à vérifier | propriétaire |

## B. Bloquant pour la version stable

| # | Point |
|---|---|
| B1 | **Relecture réglementaire** du catalogue et de la matrice par un expert RGIE ou un organisme agréé ; numéros d'articles vérifiés ; règles sorties de « à relire » |
| B2 | **Relecture juridique** de [CONDITIONS.md](../CONDITIONS.md) et de la phrase de responsabilité des rapports (juriste belge) ; RGPD (rôle du projet) |
| B3 | **Évaluation IA complète** : au moins 30 tableaux, comparaison de fournisseurs, seuils validés (proposition dans assistant-evaluation.md, § 11) |
| B4 | **Validation par plateforme** complète : 7 plateformes de [validation-plateformes.md](../validation-plateformes.md), dont l'éviction des données sur Safari et iOS |
| B5 | **Cloud** : les 4 fournisseurs testés avec de vrais comptes, dont les erreurs réelles de quota, les gros fichiers et la CSP OneDrive (`*.1drv.com`, `*.sharepoint.com`) ; vérification de la marque Google pour une publication hors mode test |
| B6 | **Bureau (Tauri)** : écriture atomique (branche `tauri-ecriture-atomique-v2`, compilée et `cargo test` 12/12 sur 3 systèmes) **testée dans l'application installée** puis intégrée ; installateurs signés au moins pour Windows (SignPath Foundation, gratuit pour l'open source **[à vérifier]**) |
| B7 | **Performances mobiles** du format v2 (ouverture, enregistrement, migration) sur un appareil d'entrée de gamme ; plafonds F5 ajustés aux mesures |
| B8 | **Dossier PDF** : vérifié par un organisme agréé sur une vraie réception ; page « Portée de l'analyse » (règles non évaluées, hypothèses) |
| B9 | **Ergonomie mobile** : écran de relevé pour téléphone, zoom à deux doigts, cibles tactiles d'au moins 44 px (17 boutons trop petits relevés en émulation), réglages du tableau qui se superposent au dessin |

## C. Amélioration ultérieure

- Plans d'architecte, documents existants (anciens schémas, PDF) et génération du plan de position par l'assistant.
- Dossiers cloud (F8) pour Google Drive, Dropbox et GitHub ; ouverture d'un répertoire local.
- Interface « Vérifier l'intégrité » et indicateur de progression des copies.
- Message à l'utilisateur quand le navigateur est plein pendant l'ajout d'une photo (aujourd'hui, seule l'image
  réduite est gardée, sans le dire).
- Nettoyage des fichiers temporaires laissés par une interruption sous Tauri.
- Allemand complet ; autres pays (architecture prête).
- Accessibilité (lecteurs d'écran, contrastes) à évaluer.
- Indication « appui long » au lieu de « clic droit » sur un écran tactile.

## Réglages GitHub et branches (pour mémoire)

- Ruleset `main` actif : historique linéaire (aucun commit de fusion). Toutes les intégrations sont faites par
  rebase.
- Branches conservées :
  - `tauri-ecriture-atomique-v2` : en attente du test dans l'application installée ;
  - `tauri-ecriture-atomique` : ancienne version, remplacée, à supprimer **avec ton accord**.
- Branches de travail des agents (`worktree-agent-…`, `eval/…`) : intégrées, à supprimer **avec ton accord**.
