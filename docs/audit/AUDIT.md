# Audit de Voltaplan — constats vérifiés

Date : 2026-11-24. Base : commit `d51d3d4` (branche `main`).

Ce document confronte l'audit préliminaire (réalisé avec ChatGPT) au code réel. Chaque constat est classé :

- **Confirmé** : vérifié dans le code, à corriger.
- **Risque** : pas d'anomalie observée, mais une fragilité réelle.
- **Limitation** : comportement voulu ou simplification connue, à documenter.
- **Invalidé** : le constat ne correspond pas au code.
- **Expertise** : demande l'avis d'un expert réglementaire (organisme agréé, SPF Économie).

## État initial mesuré

| Contrôle | Résultat |
|---|---|
| `tsc -p .` | OK, 0 erreur |
| `vitest run` | 21 fichiers, 106 tests OK. Sous Windows, le lanceur signale parfois une erreur `UNKNOWN: open …\Temp\…` (cache temporaire de Vite, antivirus) qui fait sauter un ou deux fichiers ; un nouveau lancement passe. |
| `vite build` | OK |
| Lint | **Aucun linter configuré** (pas d'ESLint) |
| CI | `ci.yml` (typage, tests, build sur Windows/macOS/Linux), `pages.yml`, `release.yml` (Tauri). Pas d'analyse de dépendances, pas de CodeQL, pas de Dependabot. |
| Code | ~14 600 lignes TS/TSX, React 18 + zustand, moteurs (`model`, `rules`, `calc`, `export`, `import`) sans dépendance à React. |

## Priorité 1 — Réglementation

| Id | Constat | Statut | Détail |
|---|---|---|---|
| A-1.1 | Deux versions seulement (`new` / `old`) | **Confirmé** | `RgieVersion = 'new' \| 'old'`, `RulePack.versions`. Pas de date d'installation, pas de date d'entrée en vigueur, pas de dérogation, pas de règles par partie d'installation. |
| A-1.2 | Installation ancienne → tout en avertissement | **Confirmé** | `rgie.ts` : `nc = strict ? 'error' : 'warning'` appliqué à toutes les règles. Une terre absente sur une installation existante n'était qu'un avertissement. |
| A-1.3 | Pas de traçabilité des règles | **Confirmé** | L'id stable existe (`R-…`) et le texte est traduit, mais aucun article, source, date de vérification, gravité électrique. |
| A-1.4 | Locaux humides détectés par expression régulière | **Confirmé** | `WET_ROOM` appliqué aux noms (« sdb », « douche », « bad »…). Aucun moyen de l'indiquer explicitement ; faux négatifs (« pièce d'eau ») et faux positifs possibles. |
| A-1.5 | Référentiel inconnu → Belgique en silence | **Confirmé** | `getRulePack(id) ?? belgium`. |
| A-1.6 | Tests réglementaires | **Risque** | `test/rules.test.ts` couvre surtout des cas non conformes ; pas de matrice conforme / limite / ancienne installation / dérogation. |
| A-1.7 | Mention « aide, ne remplace pas l'organisme agréé » | **Partiel** | Présente dans le README et le guide ; à afficher dans l'application et le dossier imprimé. |

## Priorité 2 — Modèle

| Id | Constat | Statut | Détail |
|---|---|---|---|
| A-2.1 | Suppression : références orphelines | **Confirmé** | `store.remove` retire les symboles du plan, mais laisse `boards[*].slots`, `boards[*].checks`, `measurements.rcdTests` et `meta.syncedIds`. Les emplacements orphelins restent dans le tableau et dans les exports. |
| A-2.2 | Pas de validation des fichiers ouverts | **Confirmé** | `JSON.parse(text) as Project` dans `io/files.ts` et `io/storage.ts` ; seul `format` est vérifié. Un fichier tronqué ou modifié à la main plante plus loin. |
| A-2.3 | Pas de migration de format | **Confirmé** | `version: 1` figé, aucune fonction de migration ; seuls `loose` et `.openrgie` sont gérés. |
| A-2.4 | Pas de contrôle d'intégrité (ids dupliqués, parent interdit…) | **Confirmé** | Aucun validateur. |
| A-2.5 | Historique d'annulation | **Risque** | 100 états complets en mémoire ; les images (fonds de plan, photos du tableau, en data URL) sont partagées par référence, donc pas de copie, mais à surveiller. |
| A-2.6 | `Record<string, PropValue>` | **Limitation** | Les schémas `PROP_SCHEMAS` décrivent les propriétés par type ; un typage strict demanderait une refonte. Validation à l'exécution ajoutée à la place (voir plan). |
| A-2.7 | Arbre vs graphe | **Limitation** | L'arbre suffit pour le résidentiel (une source, des sous-tableaux). Plusieurs sources (PV, batterie, inverseur) sont représentées comme branches ; pas de bouclage possible. Voir ADR-0003. |

## Priorité 3 — Calculs

| Id | Constat | Statut | Détail |
|---|---|---|---|
| A-3.1 | Cuivre seulement | **Confirmé** | `RHO_AL` existe mais n'est jamais utilisé ; pas de propriété « matière ». |
| A-3.2 | Chute de tension au calibre seulement | **Confirmé** | Calcul conservateur au courant nominal de la protection ; pas de puissance réelle ni de chute cumulée depuis l'origine (câbles d'alimentation des sous-tableaux ignorés). |
| A-3.3 | Arrondis avant comparaison | **Confirmé** | `dropPct` et `iccMin` arrondis dans `calcCircuit`, puis comparés dans `rgie.ts`. Effet limité (0,01 % / 1 A) mais à corriger. |
| A-3.4 | Méthode de court-circuit | **Limitation** | Méthode conventionnelle (0,8·U, ρ chaud) : valable comme estimation, pas comme étude. Pas d'impédance amont, pas de défaut à la terre (TT : protégé par le différentiel). À afficher comme telle. |

## Priorité 4 — Exports

| Id | Constat | Statut | Détail |
|---|---|---|---|
| A-4.1 | Version RGIE figée dans l'export Trikker | **Invalidé** | `Version="1.5.17.0"` est la version **du format Trikker**, pas du RGIE. Les fichiers Trikker réels n'ont aucun attribut de version réglementaire. |
| A-4.2 | Encodage Trikker | **Vérifié** | Lecture UTF-8 puis repli Windows-1252, écriture Windows-1252 ; aller-retour testé (`trikkerExport.test.ts`). |
| A-4.3 | Données non exportables signalées | **Partiel** | À vérifier pour Eendraadschema (tableaux, photos, mesures non représentables). |
| A-4.4 | PDF : type de dossier | **Confirmé** | Un seul type de dossier ; pas de choix « document de travail / dossier de réception / rapport d'anomalies ». |

## Priorité 6 — Sécurité

| Id | Constat | Statut | Détail |
|---|---|---|---|
| A-6.1 | CSP désactivée dans Tauri | **Confirmé** | `"csp": null` dans `tauri.conf.json` ; pas de CSP dans `index.html`. |
| A-6.2 | Droits Tauri | **Vérifié** | Moindre privilège déjà appliqué (`dialog:allow-save`, écriture de fichier seulement). |
| A-6.3 | Secrets | **Vérifié** | Clé IA et jeton GitHub chiffrés (AES-GCM, PBKDF2) dans le navigateur ; jamais dans le projet. |
| A-6.4 | Taille des fichiers importés | **Risque** | Pas de limite ; un fichier énorme fige l'onglet. |
| A-6.5 | Chaîne d'approvisionnement | **Confirmé** | Pas de Dependabot, pas d'audit npm, pas de CodeQL. Actions référencées par tag (pas par SHA). |

## Priorité 7 — IA et langues

| Id | Constat | Statut | Détail |
|---|---|---|---|
| A-7.1 | Fournisseur unique (Anthropic) | **Confirmé** | `boardPhotoAi.ts` appelle le SDK Anthropic directement. |
| A-7.2 | Résultats IA validés | **Vérifié** | Sortie structurée validée par zod ; tout passe par des propositions confirmées par l'utilisateur, annulables. |
| A-7.3 | Allemand partiel | **Confirmé** | `de.ts` ne couvre qu'une partie ; repli sur l'anglais. Aucun test de cohérence des clés. |
