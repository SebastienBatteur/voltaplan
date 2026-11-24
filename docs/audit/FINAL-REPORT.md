# Rapport final de l'audit — Voltaplan

Date : 2026-11-24. Branche `main`, de `d51d3d4` (début) à la fin de la mission. Tout est poussé sur GitHub.

## 1. Résumé exécutif

L'audit préliminaire a été vérifié dans le code (voir [AUDIT.md](AUDIT.md)) ; ses constats étaient confirmés,
sauf celui sur la version du RGIE exportée vers Trikker, qui est invalidé. Les priorités 1, 2, 3, 4, 6 et 7 ont été
traitées, testées et poussées. La priorité 5 (ergonomie) ne l'a été que partiellement : la navigation entre les
vues depuis un constat est faite ; les modèles de projets, la sélection multiple et le copier-coller sont planifiés
plus bas.

Points forts obtenus :

- **Moteur réglementaire versionné** : éditions datées, appliquées partie par partie. Statut, gravité et caractère
  bloquant sont séparés. Les dérogations sont motivées. Une installation ancienne n'est plus jamais déclarée
  acceptable en silence. Un référentiel inconnu est signalé.
- **Intégrité** : nettoyage centralisé des références à la suppression. Contrôle de cohérence. Lecture des projets
  validée, migrable, sans perte des champs inconnus.
- **Calculs** : matière du conducteur, valeurs non arrondies avant comparaison, chute de tension cumulée depuis
  l'origine, méthode détaillée quand les puissances sont connues, bilan de puissance et équilibrage des phases.
- **Sécurité** : CSP (web et bureau), tailles maximales à l'import, refus des DTD XML, filtrage des images, ESLint,
  audit npm, CodeQL, Dependabot et recherche de secrets en CI.
- **IA** : interface indépendante du fournisseur (Anthropic, API compatible OpenAI, modèles locaux), réponses
  validées par schéma, délai et annulation, destinataire affiché avant tout envoi.

## 2. État initial

- 21 fichiers de tests, 106 tests (avec des erreurs intermittentes sous Windows), typage et build OK.
- Pas de linter.
- CI : typage, tests et build sur les trois systèmes ; aucun contrôle de sécurité.

## 3. Anomalies confirmées → corrigées

| Constat | Correction | Commit |
|---|---|---|
| A-1.1 Deux versions réglementaires seulement | Éditions datées, contexte par partie (`src/rules/context.ts`) | 40eac1f |
| A-1.2 Existant = tout en avertissement | Statut, gravité, bloquant séparés ; sécurité toujours non conforme | 40eac1f |
| A-1.3 Pas de traçabilité | Catalogue `src/rules/be/catalog.ts` (source, gravité, `needsReview`, tests) | 40eac1f |
| A-1.4 Locaux humides par expression régulière | Propriété explicite ; le nom n'est plus qu'un indice « à vérifier » | 40eac1f |
| A-1.5 Référentiel inconnu → Belgique | `R-RULESET-UNKNOWN`, aucune règle appliquée | 40eac1f |
| A-2.1 Références orphelines à la suppression | `pruneReferences` (plan, tableau, vérifications photo, essais, synchro, dérogations) | bcac547, e318031 |
| A-2.2 / A-2.3 Fichiers non validés, pas de migration | `src/model/migrate.ts` (zod, étapes, version plus récente refusée) | bcac547 |
| A-2.4 Pas de contrôle d'intégrité | `validateProject` (erreurs / remarques) | bcac547 |
| A-3.1 Cuivre seulement | Propriété `material` (Cu / Al) | 4e716d4 |
| A-3.2 Chute de tension au calibre seulement | Chute cumulée depuis l'origine, méthode détaillée | 4e716d4 |
| A-3.3 Arrondis avant comparaison | Valeurs brutes, arrondi à l'affichage seulement | 4e716d4 |
| A-4.4 Un seul type de dossier | Travail, réception, anomalies, complet | c911c24 |
| Constats imprimés coupés à 22 lignes (trouvé pendant l'audit) | Pagination de tous les constats | 40eac1f |
| A-6.1 CSP absente | CSP web (balise ajoutée à la construction) et Tauri, test de cohérence | 6297a2a |
| A-6.4 Taille des fichiers | `src/io/limits.ts` | 1b722a5 |
| A-6.5 Chaîne d'approvisionnement | Dependabot, CodeQL, `npm audit`, gitleaks, ESLint | 423d4e1, 971fe90, 2690877 |
| A-7.1 Fournisseur d'IA unique | `src/ai/provider.ts` | f8e93aa |
| A-7.3 Aucun contrôle des traductions | `test/i18n.test.ts` | 530fef6 |
| Publication Pages en échec intermittent (trouvé pendant l'audit) | Construction et publication en deux jobs | 4648a90, 5b3c6de |

## 4. Constats invalidés

- **A-4.1** : `Version="1.5.17.0"` dans l'export Trikker est la version du **format Trikker**, pas celle du RGIE.
  Les fichiers Trikker réels n'ont aucun champ de version réglementaire.
- **A-6.2** : les droits Tauri étaient déjà minimaux (boîte « Enregistrer » et écriture du fichier choisi).
- **A-6.3** : les secrets étaient déjà chiffrés localement et jamais enregistrés dans les projets.
- **A-7.2** : les résultats de l'IA étaient déjà des propositions à confirmer, validées par schéma et annulables.

## 5. Décisions d'architecture

- [ADR-0001](../adr/0001-moteur-reglementaire-versionne.md) : moteur réglementaire versionné par partie
  d'installation.
- [ADR-0002](../adr/0002-statut-gravite-bloquant.md) : statut, gravité et caractère bloquant séparés.
- [ADR-0003](../adr/0003-modele-arborescent.md) : le modèle arborescent est conservé (pas de graphe sans besoin
  démontré).
- Fournisseurs d'IA derrière une interface commune ; sortie toujours validée par le même schéma zod.
- Lecture des fichiers en une seule chaîne : taille → JSON → migration → validation → filtrage des images →
  intégrité.

## 6. Tests et builds

| | Avant | Après |
|---|---|---|
| Fichiers de tests | 21 | 29 |
| Tests | 106 | 201 |
| Typage (`tsc`) | OK | OK |
| Lint (`eslint`) | absent | OK, 0 erreur |
| Build web | OK | OK |
| CI GitHub (Windows, macOS, Linux) | typage, tests, build | + lint, audit npm, gitleaks, CodeQL |
| Build Tauri | non lancé | **non lancé** (pas de Rust dans cet environnement ; `release.yml` inchangé sur le fond) |

Nouveaux tests :

- matrice réglementaire (25 cas) et tests du moteur ;
- intégrité, suppression, annuler / rétablir, migration ;
- calculs sur exemples calculés à la main ;
- CSP, tailles et sécurité de l'import ;
- fournisseurs d'IA (réponses simulées) ;
- cohérence des traductions.

**Performance mesurée** (400 circuits, 3 600 éléments) :

- contrôle complet : 52 ms ;
- calculs : 29 ms ;
- validation : 10 ms ;
- nettoyage : 2,5 ms.

## 7. Sécurité

- `npm audit --omit=dev` : **0 vulnérabilité** en production (étape bloquante en CI).
- `npm audit` complet : 5 alertes dans les outils de développement (vite 5, vitest 2). Les corriger demande des
  versions majeures : migration à faire à la main.
- Aucune télémétrie. Les données ne partent qu'à la demande de l'utilisateur, vers le service qu'il a choisi
  (voir [PRIVACY.md](../../PRIVACY.md)).
- CodeQL (requêtes `security-extended`) : **1 alerte**, examinée et classée faux positif (`js/xss-through-dom`, lecture
  XML inerte de l'import Trikker). Elle est justifiée dans `.github/codeql-accepted.txt` ; toute nouvelle alerte fait
  échouer le job. Le dépôt privé n'a pas le « code scanning » : les résultats sont joints au run.

## 8. Couverture réglementaire

Voir [REGULATORY-COVERAGE.md](REGULATORY-COVERAGE.md). Toutes les règles sont marquées `needsReview` ; aucun
numéro d'article n'est renseigné tant qu'il n'a pas été vérifié dans le texte consolidé.

Points d'expertise prioritaires :

1. calibres maximaux par section, avec la distinction fusible / disjoncteur ;
2. statut des règles pour les installations existantes ;
3. terre entre 30 et 100 Ω ;
4. volumes de la salle de bain.

## 9. Limitations restantes

- **Calculs** : estimation conventionnelle. Ce n'est pas une étude de protection : ni sélectivité, ni impédance du
  réseau, ni courant admissible des câbles (voir [docs/calc.md](../calc.md)).
- **Exports** : la liste des données non exportées vers Eendraadschema n'est pas encore montrée à l'utilisateur. Le
  PDF n'a pas de test visuel automatisé.
- **IA** : OpenAI, Gemini et Ollama sont testés avec des réponses simulées seulement. Une adresse d'API hors de la
  liste de la CSP est bloquée dans la version publiée.
- **Langues** : l'allemand reste partiel (repli sur l'anglais) ; les textes réglementaires ne sont pas traduits en
  allemand.
- **Plateformes** : l'application de bureau (Tauri) et sa CSP n'ont pas été testées dans la fenêtre native. macOS et
  Linux ne sont couverts que par la CI.
- **Tests sous Windows** : le lanceur de tests saute parfois un fichier (erreur `UNKNOWN: open` sur le cache
  temporaire de Vite, probablement l'antivirus) ; un nouveau lancement passe.

## 10. Dette technique

- Propriétés en `Record<string, PropValue>` : la validation à l'exécution (zod, `validateProject`) compense ; un
  typage par type d'élément reste à faire progressivement.
- `src/ui/BoardView.tsx` (≈ 950 lignes) et `src/ui/PlanView.tsx` (≈ 880 lignes) sont à découper.
- Paramètre de sévérité ignoré dans les appels `add()` de `src/rules/be/rgie.ts`, gardé pour limiter les conflits
  pendant la mission ; à retirer.
- Dépendances de développement à migrer : vite 5 → 8, vitest 2 → 5, plugin React.

## 11. Recommandations pour les prochaines versions

1. **Relecture réglementaire** par un organisme agréé du catalogue et de la matrice de tests ; numéros d'articles.
2. **Ergonomie (P5)** :
   - modèles de projets (maison, appartement, monophasé, triphasé, PV, batterie, borne), entièrement modifiables ;
   - sélection multiple et modification groupée ;
   - copier-coller de circuits ;
   - recherche d'éléments ;
   - favoris.
3. **Corrections assistées** : proposer, depuis un constat, la correction (ex. calibre réduit) avec aperçu et
   annulation, jamais en silence.
4. **Export Eendraadschema** : afficher les données non représentables.
5. **Bureau** : un `tauri build` par plateforme et des installateurs signés (certificats à acquérir).
6. **Autres pays** : seulement avec des sources fiables et le droit d'utiliser les normes.

## 12. Maturité avant publication

| Domaine | Appréciation |
|---|---|
| Modèle et intégrité | solide (tests, validation, migration) |
| Contrôle RGIE | bon outil d'aide ; **à faire relire** avant de le présenter comme fiable |
| Calculs | corrects pour une estimation documentée |
| Exports et dossier | utilisables ; tests visuels à ajouter |
| Sécurité | bon niveau pour une application locale |
| IA | optionnelle, encadrée, multi-fournisseur |
| Ergonomie | fonctionnelle ; productivité des installateurs à améliorer |

**Avis** : publiable comme **version bêta d'aide au dessin et à la vérification**, avec la mention claire qu'elle ne
remplace pas le contrôle par un organisme agréé. Pas encore comme outil de conformité certifiant.

## Décisions qui reviennent au propriétaire du dépôt

- Activer le **code scanning** (dépôt public, ou GitHub Advanced Security) : passer alors `upload: never` à
  `upload: always` dans `codeql.yml`.
- Les **15 demandes de fusion Dependabot** ouvertes avant le réglage « mineures et correctifs seulement ». Elles
  contiennent des versions majeures (React 19, Vite 8, Vitest 5, zustand 5, actions) ; aucune n'a été fusionnée.
- La **relecture réglementaire** par un expert.
