# Journal des modifications

## Non publié (audit de fiabilisation, novembre 2026)

Détail : [docs/audit/FINAL-REPORT.md](docs/audit/FINAL-REPORT.md).

### Contrôle RGIE
- Éditions datées (avant 1981, ancien RGIE de 1981, Livre 1 depuis le 1/6/2020), appliquées partie par partie (date de réalisation d'un tableau ou d'un circuit).
- Statut de chaque constat (non conforme, information manquante, avertissement, à vérifier, recommandation, dérogation), gravité et caractère bloquant séparés. Installation existante : les règles de sécurité restent non conformes et bloquantes.
- Dérogations motivées, visibles dans le dossier. « Local avec baignoire ou douche » explicite. Référentiel inconnu signalé.
- Vérifications manuelles signalées : bornes de recharge, photovoltaïque, dispositions transitoires.

### Contrôle RGIE : inconnu ≠ absent
- Un élément absent du dessin n'est plus considéré comme absent de l'installation réelle. Installation existante (relevé) : prise de terre, différentiel général ou différentiel 30 mA non dessinés → « Informations insuffisantes », non bloquant, avec les boutons « Confirmer présent / Confirmer absent / Je ne sais pas ». Une absence confirmée redonne une non-conformité (bloquante pour la sécurité). Installation neuve (conception) : le dessin reste la référence, résultats inchangés.
- Nouveaux statuts : « Anomalie potentielle » (information déduite ou non confirmée), « Informations contradictoires » (dessin et déclaration, ou sources de l'assistant, en désaccord), « Règle non évaluée ». Libellés : « Non-conformité détectée », « Informations insuffisantes », « Vérification manuelle nécessaire » ; résumé « Aucune anomalie détectée parmi les N règles vérifiées ».
- Exigences documentaires (mentions, schéma incomplet, valeurs non renseignées) séparées des exigences de l'installation, dans le contrôle et dans le dossier : jamais présentées comme des non-conformités de l'installation.
- Sensibilité d'un différentiel non renseignée : « Informations insuffisantes » au lieu de « non conforme ». Mesures à faire signalées : liaisons équipotentielles, essai des différentiels.
- Dossier de réception : mention « PROJET — NON-CONFORMITÉS À TRAITER », « PROJET — VÉRIFICATIONS À FAIRE » ou « PROJET — DOSSIER INCOMPLET » selon la situation ; phrase « ni une certification ni un contrôle de conformité » sur les pages de constats. Voir [ADR-0007](docs/adr/0007-etats-de-connaissance-et-exigences.md).

### Assistant de relevé (prototype)
- Fichier → Nouveau relevé (installation existante) ; photo du tableau lue par l'IA → brouillon de tableau, protections, circuits et unifilaire, avec des questions pour ce qui n'est pas lisible. Rien n'est inventé ni appliqué sans accord ; acceptation groupée de ce qui est sûr ; relevé figé daté (non certifié).
- Valeurs reprises d'une photo et non confirmées : signalées au contrôle RGIE ; les constats qui en dépendent sont marqués « à vérifier ».
- « Créer depuis la photo » n'ajoute plus de valeurs par défaut (calibre, courbe, pouvoir de coupure) aux valeurs lues.
- Plusieurs photos d'un même tableau (une par rangée, ou des prises qui se recouvrent) : fusion par position ; valeurs d'accord plus sûres ; désaccord → une seule question avec les valeurs de chaque photo ; même photo relue → lecture réutilisée sans nouvel appel à l'IA ; lecture identique à une autre photo → doublon signalé, rien d'ajouté. Une nouvelle photo ne repropose pas ce qui est déjà accepté et ne repose aucune question.
- Plusieurs tableaux : « Ajouter un tableau » (sous-tableau, alimentation inconnue) ; un brouillon par tableau ; rattachement proposé sous le circuit étiqueté « sous-tableau … » (à vérifier une par une).
- Étiquettes : abréviations belges FR, NL, EN reconnues (PC, Ecl., SDB, Ch.1, Slpk, LL, LV, Stopc., Verl.…), étiquettes à plusieurs usages, réserve et général.
- Questions : section groupée par usage (une réponse pour tous, ou chacun séparément), rien pour une réserve ou un appareil non protecteur, « Tout à vérifier plus tard ».
- Correction d'une proposition avant de l'accepter : calibre, courbe, sensibilité, usage, pièce, différentiel amont.
- Banc d'évaluation de la lecture par l'IA, à lancer avec sa propre clé ou un modèle local (`tools/ai-eval/`, [docs/assistant-evaluation.md](docs/assistant-evaluation.md)). Les tests automatiques utilisent des lectures simulées et ne mesurent pas la qualité réelle de la reconnaissance.

### Modèle et fichiers
- **Aucun écrasement silencieux** : « Enregistrer » vérifie que le fichier n'a pas été modifié ailleurs depuis son ouverture (OneDrive : eTag ; Dropbox : révision ; Google Drive : version ; GitHub : SHA ; navigateur : révision ; fichier local : date et taille). En cas de conflit, votre version est enregistrée en copie datée, au même endroit ; les deux versions sont conservées.
- Versions locales (20 dernières par projet) et brouillon automatique par onglet, récupérable après une fermeture ou un plantage. Pas de réseau : l'enregistrement est mis en attente et repris au retour de la connexion.
- État de l'enregistrement affiché en permanence (enregistré, en attente, conflit, erreur).
- Enregistrement en attente gardé après fermeture et proposé à la reprise ; brouillon écrit avant chaque enregistrement (récupération après interruption) ; jeton expiré : reconnexion, version gardée ; Google Drive : modification concurrente pendant l'envoi détectée et recopiée ; rétention des versions adaptée à l'espace du navigateur.
- Hors ligne : fonctions indisponibles signalées sur place (IA en ligne, GitHub, services en ligne) ; un modèle d'IA local reste utilisable. Procédure de validation par plateforme : [docs/validation-plateformes.md](docs/validation-plateformes.md).
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
