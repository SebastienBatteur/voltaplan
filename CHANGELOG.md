# Journal des modifications

## Non publié (audit de fiabilisation, novembre 2026)

Détail : [docs/audit/FINAL-REPORT.md](docs/audit/FINAL-REPORT.md).

### Contrôle RGIE
- Éditions datées (avant 1981, ancien RGIE de 1981, Livre 1 depuis le 1/6/2020), appliquées partie par partie (date de réalisation d'un tableau ou d'un circuit).
- Statut de chaque constat (non conforme, information manquante, avertissement, à vérifier, recommandation, dérogation), gravité et caractère bloquant séparés. Installation existante : les règles de sécurité restent non conformes et bloquantes.
- Dérogations motivées, visibles dans le dossier. « Local avec baignoire ou douche » explicite. Référentiel inconnu signalé.
- Vérifications manuelles signalées : bornes de recharge, photovoltaïque, dispositions transitoires.

### Modèle et fichiers
- **Aucun écrasement silencieux** : « Enregistrer » vérifie que le fichier n'a pas été modifié ailleurs depuis son ouverture (OneDrive : eTag ; Dropbox : révision ; Google Drive : version ; GitHub : SHA ; navigateur : révision ; fichier local : date et taille). En cas de conflit, votre version est enregistrée en copie datée, au même endroit ; les deux versions sont conservées.
- Versions locales (20 dernières par projet) et brouillon automatique par onglet, récupérable après une fermeture ou un plantage. Pas de réseau : l'enregistrement est mis en attente et repris au retour de la connexion.
- État de l'enregistrement affiché en permanence (enregistré, en attente, conflit, erreur).
- Suppression : plus de références orphelines (tableau, mesures, dérogations…).
- Ouverture validée et migrable ; message clair pour un fichier tronqué, inconnu ou d'une version plus récente.

### Calculs
- Câbles en aluminium, chute de tension cumulée depuis l'origine, méthode détaillée avec les puissances, bilan de puissance et équilibrage des phases.

### Dossier
- Types de document : travail, réception, rapport d'anomalies, dossier complet. Tous les constats imprimés (plus de coupure).

### IA
- Fournisseur au choix : Anthropic, API compatible OpenAI (OpenAI, Gemini, Mistral), modèles locaux (Ollama, LM Studio) sans clé.

### Hors ligne
- Toute l'application est copiée pour un usage hors ligne dès la première visite, y compris les fonctions jamais utilisées en ligne (fond de plan PDF, import/export Trikker, Eendraadschema…). Liste des fichiers et version calculées à la construction ; les anciennes versions sont supprimées du cache.
- Mises à jour annoncées par un bandeau « Nouvelle version disponible — Recharger », jamais imposées pendant le travail ; les modifications non enregistrées sont gardées comme brouillon avant de recharger.
- Protection des projets gardés dans le navigateur contre l'effacement automatique (stockage persistant), place utilisée affichée, conseil pour Safari / iPhone / iPad.
- Repère « Hors ligne » près du bouton IA. Voir [docs/offline.md](docs/offline.md).

### Application de bureau (Tauri)
- Première compilation réelle (CI) : Windows, macOS (Apple Silicon et Intel) et Linux. État, risques et recommandations : [docs/desktop-tauri.md](docs/desktop-tauri.md).
- `release.yml` échouait avant toute compilation (script npm `tauri` absent) : corrigé.
- Nouveau workflow `desktop-build.yml` : construction sans publication (manuelle et sur les demandes de fusion touchant `src-tauri` ou les paquets npm), cache Rust.
- `Cargo.lock` versionné et vérifié ; `@tauri-apps/plugin-fs` aligné sur la crate (2.7.1) ; Dependabot regroupe les mises à jour Tauri.
- Droit `core:webview:allow-print` : sur macOS, l'impression du dossier était refusée sans lui.

### Sécurité
- CSP, tailles maximales à l'import, fichiers XML avec DTD refusés, images limitées aux images intégrées, ESLint, audit des dépendances, CodeQL, Dependabot, recherche de secrets.

## 0.1.0
- Première version : unifilaire, plan de position, tableau, contrôle RGIE, import/export Trikker, export Eendraadschema, dossier PDF.
