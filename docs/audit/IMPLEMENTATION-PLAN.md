# Plan d'exécution de l'audit

Ordre : priorités de l'audit, chaque lot testé, commité et poussé sur `main` (CI verte avant de passer au lot suivant).
Les constats sont détaillés dans [AUDIT.md](AUDIT.md) ; l'avancement est suivi dans [PROGRESS.md](PROGRESS.md).

## Lot 1 — Moteur réglementaire (P1)

- **Contexte réglementaire** (`src/rules/context.ts`) : pays, référentiel, édition (`BE-RGIE:2020`, `BE-RGIE:1981`), dates d'entrée en vigueur, date de réalisation de l'installation, date propre à une partie (tableau, circuit), dérogations saisies par l'utilisateur.
  Compatibilité : `meta.rgieVersion` (`new` / `old`) reste lu et écrit ; il est traduit en édition.
- **Statut par constat** : `nonCompliant`, `warning`, `recommendation`, `derogation`, `notApplicable`, `insufficientData`, `manualCheck`, plus `blocking` et `hazard` (gravité électrique) séparés. `severity` (error / warning / info) reste dérivé pour l'interface et les anciens appels.
- **Catalogue des règles** (`src/rules/be/catalog.ts`) : id, articles, éditions, gravité, statut pour une installation existante, source, date de vérification, interprétation incertaine signalée.
  Aucune référence d'article n'est inventée : quand l'article exact n'a pas été vérifié, le champ reste vide et la règle est marquée `needsReview`.
- **Installation existante** : une règle de sécurité (terre, différentiel, protection des câbles) reste une **non-conformité** ; elle n'est simplement pas bloquante pour un document de travail. Les règles qui relèvent de la conception récente deviennent des **recommandations**.
- **Locaux humides** : propriété structurée « Local avec baignoire ou douche » sur les circuits et les points (oui / non / non précisé) ; le nom de la pièce ne sert plus que de détection à confirmer (`manualCheck`).
- **Référentiel inconnu** : constat bloquant `R-RULESET-UNKNOWN`, aucune règle d'un autre pays appliquée.
- **Tests** : matrice `test/rules.matrix.test.ts` (conforme, non conforme, limite, ancienne installation, dérogation, données manquantes, 230 V / 3 × 230 V / 3N × 400 V), séparée des tests du moteur.

## Lot 2 — Intégrité du modèle (P2)

- `src/model/integrity.ts` : `pruneReferences` (symboles, emplacements du tableau, vérifications photo, essais des différentiels, ids synchronisés) appelé par toute suppression ; `validateProject` (ids dupliqués, références inexistantes, enfants interdits, valeurs incohérentes).
- `src/model/migrate.ts` : version du format, migration pas à pas, validation zod des fichiers, du stockage local et du stockage distant. Les fichiers `.openrgie` restent pris en charge. Une réparation incertaine n'efface rien : elle est signalée.
- Tests de migration, de suppression et d'aller-retour annuler / rétablir.

## Lot 3 — Calculs (P3)

- Matière du conducteur (cuivre / aluminium), résultats non arrondis avant comparaison, hypothèses explicites, chute de tension cumulée depuis l'origine (câbles d'alimentation des sous-tableaux), chute de tension détaillée quand la puissance est connue, bilan de puissance et équilibrage des phases.

## Lot 4 — Exports (P4)

- Dossier : type de document (travail, réception, rapport d'anomalies, dossier complet) et choix des pages ; mention d'assistance ; statut des constats.
- Eendraadschema / Trikker : liste des données non exportées affichée à l'utilisateur ; tests d'aller-retour avec caractères spéciaux.

## Lot 5 — Sécurité et chaîne de développement (P6)

- CSP (web et Tauri), limites de taille à l'import, Dependabot, CodeQL, `npm audit` en CI, permissions minimales des workflows, `SECURITY.md`, `PRIVACY.md`.

## Lot 6 — IA, langues, ergonomie (P7, P5)

- Interface de fournisseur IA (Anthropic, API compatible OpenAI, modèles locaux de type Ollama) ; information avant envoi.
- Test automatique de cohérence des clés de traduction ; allemand complété sur les textes réglementaires.
- Navigation d'un constat vers l'élément dans chaque vue ; mention d'assistance dans le panneau de contrôle.

## Hors de portée de cette mission (plan détaillé dans FINAL-REPORT.md)

- Règles d'autres pays (NF C 15-100, NEN 1010, VDE) : pas de source vérifiée ni de droits d'utilisation des normes.
- Signature des installateurs (certificats payants).
- Modèle en graphe (plusieurs sources bouclées) : pas de besoin démontré pour le résidentiel.
