# Avancement de l'audit

Statuts : À analyser · Confirmé · En cours · Implémenté · Testé · Terminé · Non applicable · Bloqué · Reporté.

| Tâche | Prio | Constat | Statut | Commit | Limitations restantes |
|---|---|---|---|---|---|
| T-0 Audit et plan | — | — | Terminé | 1f4e013 | — |
| T-1.1 Éditions et contexte réglementaire | P1 | A-1.1 | Testé | 40eac1f| |
| T-1.2 Statuts des constats | P1 | A-1.2 | Testé | 40eac1f| |
| T-1.3 Catalogue des règles | P1 | A-1.3 | Testé | 40eac1f| |
| T-1.4 Locaux humides structurés | P1 | A-1.4 | Testé | 40eac1f| |
| T-1.5 Référentiel inconnu | P1 | A-1.5 | Testé | 40eac1f| |
| T-1.6 Matrice de tests réglementaires | P1 | A-1.6 | Testé | 40eac1f| |
| T-2.1 Références orphelines | P2 | A-2.1 | Testé | bcac547 | — |
| T-2.2 Validation et migration des fichiers | P2 | A-2.2, A-2.3 | Testé | bcac547 | Aucune migration réelle encore (format v1) ; cadre et tests prêts |
| T-2.3 Contrôle d'intégrité | P2 | A-2.4 | Testé | bcac547 | Branchements inhabituels des fichiers Trikker réels = remarques, pas erreurs |
| T-3 Calculs | P3 | A-3.1 à A-3.4 | Testé | 4e716d4, 3785c87 | Estimation, pas une étude de protection (docs/calc.md) |
| T-4 Exports et dossier | P4 | A-4.3, A-4.4 | Implémenté | c911c24 | Liste des données non exportées vers Eendraadschema à afficher ; pas de test visuel du PDF |
| T-6 Sécurité et CI | P6 | A-6.1, A-6.4, A-6.5 | Testé | 6297a2a…113b5ec, 4648a90 | CSP Tauri non testée dans la fenêtre native ; vulnérabilités dev (vite 5, vitest 2) laissées à Dependabot |
| T-7 IA et langues | P7 | A-7.1, A-7.3 | Testé | f8e93aa | Fournisseurs OpenAI/Gemini/Ollama testés avec réponses simulées seulement ; allemand toujours partiel (repli anglais) |
| T-5 Ergonomie (navigation constat → vues) | P5 | — | Implémenté | 40eac1f | Modèles de projets, sélection multiple, copier-coller : reportés (FINAL-REPORT §11) |
| T-8 Traductions : contrôle automatique | P7 | A-7.3 | Testé | 530fef6 | Allemand partiel |
| T-9 Rapport final | — | — | Terminé | (ce commit) | — |
