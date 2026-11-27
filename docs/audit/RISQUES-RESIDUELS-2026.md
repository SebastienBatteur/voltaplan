# Bilan des risques résiduels (27/11/2026)

Après l'audit de la rubrique « Apprendre », le contre-audit et les corrections du moteur (branches `rgie-precisions`
et `rgie-engine-corrections`, non fusionnées dans `main`). **Voltaplan n'est pas certifié conforme au RGIE** : c'est
une aide, dont les règles restent toutes `needsReview` tant qu'un spécialiste ne les a pas validées.

| # | Risque | Gravité | Probabilité | Mesures en place | Reste à faire |
|---|---|---|---|---|---|
| 1 | Une interprétation encore débattue (15 points) est fausse dans un article ou dans le moteur | Élevée pour 1P+N (4.4.4.2), type AC existant, 3 × 230 V ; moyenne ailleurs | Moyenne | Points signalés « à vérifier » dans les articles ; aucune règle bloquante tirée d'une interprétation incertaine | Faire répondre `VALIDATION-EXTERNE-RGIE.md` par un spécialiste ou un organisme agréé |
| 2 | Affirmation reposant sur une norme non consultée (EN 60898, EN 61008/61009, HD 308, IEC 60364-5-52, EN 50090…) | Moyenne | Moyenne | Présentée comme exigence normative ou ordre de grandeur, jamais comme une obligation du RGIE | Consulter les normes (NBN) ou retirer les chiffres qui en dépendent |
| 3 | Lecteur non qualifié qui intervient sous tension malgré les avertissements | Élevée | Faible à moyenne | Encadré commun (couper, empêcher la remise en service, vérifier l'absence de tension) ; aucune mesure sous tension conseillée à un particulier ; un exercice réussi n'est pas un contrôle | Relecture par un formateur ou un électricien |
| 4 | Le moteur signale désormais davantage de non-conformités (fusibles du tableau 4.11, type AC, différentiel de tête < 40 A, circuits mixtes, appareils ≥ 2 600 W) sur des projets existants | Moyenne (gêne, pas danger) | Élevée pour les vieux tableaux à fusibles | Parties existantes : recommandation non bloquante pour type A, 40 A, 8 points, circuits dédiés ; fusibles : non conforme (sécurité) | Prévenir les utilisateurs dans le journal des modifications ; vérifier sur des projets réels |
| 5 | Courant admissible selon le mode de pose (IZ) non calculé : un câble conforme au tableau 4.11 peut être insuffisant | Moyenne | Faible | Articles et message de la règle : « le tableau donne un maximum, la pose peut imposer moins » | Calcul de IZ (tables normatives) si on veut l'automatiser |
| 6 | Règles sans article RGIE renseigné (41 sur 47) ou sans test dédié (6) | Moyenne | — | Matrice de traçabilité ; contrôle CI qui bloque toute nouvelle règle sans test | Renseigner et vérifier les articles des 41 règles ; tests pour les 6 |
| 7 | Divergence future entre moteur et articles | Moyenne | Moyenne | Contrôle CI pour le tableau 4.11, 2 600 W, 100 Ω ; `learn:check` pour les références | Registre unique (ADR-0009) |
| 8 | Nouvelle version du RGIE (après la version 07) | Moyenne | Certaine à terme | Version et date citées ; références vérifiées sur la version 07 | Script de comparaison des extraits cités (proposé) ; catalogue des éditions à compléter (M12) |
| 9 | Extraction texte du PDF imparfaite (tableaux, dont 5.1) | Faible à moyenne | Faible | Pages imprimées vérifiées en image pour le tableau 2.23 et les figures 3.1 / 3.2 | Vérifier le tableau 5.1 sur la page imprimée |
| 10 | Circuits de commande en petite section signalés à tort (R-CABLE-MIN, M7) | Faible | Faible | Documenté | Marquer un câble « circuit de commande » |
| 11 | Traductions de la rubrique : seule la version française existe ; les messages du moteur sont en 4 langues | Faible | — | Messages des règles corrigées traduits en nl, en, de | Relecture des traductions par des locuteurs du métier |
| 12 | Liens externes (fabricants, sbg-energy.com) qui changent | Faible | Moyenne | Peu nombreux | Vérification périodique des liens |
