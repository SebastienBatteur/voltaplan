# Journal des modifications

## Non publié (audit de fiabilisation, novembre 2026)

Détail : [docs/audit/FINAL-REPORT.md](docs/audit/FINAL-REPORT.md).

### Contrôle RGIE
- Éditions datées (avant 1981, ancien RGIE de 1981, Livre 1 depuis le 1/6/2020), appliquées partie par partie (date de réalisation d'un tableau ou d'un circuit).
- Statut de chaque constat (non conforme, information manquante, avertissement, à vérifier, recommandation, dérogation), gravité et caractère bloquant séparés. Installation existante : les règles de sécurité restent non conformes et bloquantes.
- Dérogations motivées, visibles dans le dossier. « Local avec baignoire ou douche » explicite. Référentiel inconnu signalé.
- Vérifications manuelles signalées : bornes de recharge, photovoltaïque, dispositions transitoires.

### Modèle et fichiers
- Suppression : plus de références orphelines (tableau, mesures, dérogations…).
- Ouverture validée et migrable ; message clair pour un fichier tronqué, inconnu ou d'une version plus récente.

### Calculs
- Câbles en aluminium, chute de tension cumulée depuis l'origine, méthode détaillée avec les puissances, bilan de puissance et équilibrage des phases.

### Dossier
- Types de document : travail, réception, rapport d'anomalies, dossier complet. Tous les constats imprimés (plus de coupure).

### IA
- Fournisseur au choix : Anthropic, API compatible OpenAI (OpenAI, Gemini, Mistral), modèles locaux (Ollama, LM Studio) sans clé.

### Sécurité
- CSP, tailles maximales à l'import, fichiers XML avec DTD refusés, images limitées aux images intégrées, ESLint, audit des dépendances, CodeQL, Dependabot, recherche de secrets.

## 0.1.0
- Première version : unifilaire, plan de position, tableau, contrôle RGIE, import/export Trikker, export Eendraadschema, dossier PDF.
