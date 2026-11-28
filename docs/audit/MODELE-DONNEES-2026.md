# Fiabilité du modèle de données : analyse et plan (version courte)

Date : 28/11/2026 · Branche `data-provenance` (depuis `main` à 9b4e30d) · Analyse seulement : **aucune modification du
modèle avant validation de l'ADR-0010**.

## 1. Constat principal

Les valeurs par défaut du schéma sont écrites dans le projet et ne se distinguent plus d'une saisie (annexe
`provenance/valeurs-par-defaut.md`, 49 propriétés tracées fichier:ligne). Sur un relevé d'installation existante :

| Criticité | Propriétés | Effet type |
|---|---|---|
| Haute (7) | protection `device`, `ratedCurrent`, `poles`, `curve` ; câble `section` ; prise `earth`, `childSafety` | masque « calibre / section inconnus » ; fusible traité comme disjoncteur (tableau 4.11) ; Lmax et chute faussés ; prise sans terre ni obturateurs non signalée |
| Moyenne (6) | `breakingCapacity`, `cableType`, `conductors`, `light.count`, `applianceType`, `inverterType` | mentions du schéma inventées ; charge sous-estimée ; PV confondu avec une batterie |
| Basse (36) | symboles, placement, domotique | affichage seulement |

Défauts posés hors du schéma, criticité haute : imports Volter, Condui, Draadwijs, PlanElec et Trikker contrôlés comme
du **neuf** (`installationKind: 'new'` du projet vide) ; import PDF qui garde un différentiel général 300 mA / 40 A /
type A inventé ; corrections en un clic qui **réécrivent le fait relevé** (la non-conformité disparaît sans travaux).

Architecture proposée : `docs/adr/0010-provenance-des-valeurs.md` (relevé sans défaut écrit + dossier de preuves
existant étendu ; quatre options comparées).

## 2. Les 13 anomalies connues

FN = faux négatif (non-conformité masquée), FP = faux positif. « Modèle » : la correction dépend de l'ADR-0010.

| # | Règle | Cause | Risque | Criticité | Correction envisagée | Dépend du modèle |
|---|---|---|---|---|---|---|
| 1 | R-RCD30-DATE | sans tableau dans la chaîne, aucune question de date n'est posée | **FN** : prises sans 30 mA non signalées sur un relevé non daté | **Haute** | poser la question au niveau du projet quand aucun tableau n'est dans la chaîne | non — **corrigée le 28/11 (1fae249)** |
| 2 | R-WETROOM-NAME | la déclaration globale « 30 mA présent » efface l'indice pour tous les circuits | **FN** : salle de bain hors 30 mA non signalée | **Haute** | ne retenir la déclaration que pour les circuits sans 30 mA dessiné… à condition qu'elle les vise ; sinon indice maintenu | non — **corrigée le 28/11 (1fae249)** |
| 3 | R-ICC-LMAX | fusible : aucun calcul, aucun constat | **FN** : longueur protégée non vérifiée en silence | Haute | constat « à vérifier » (fusible : caractéristique non modélisée) | non — **corrigée le 28/11 (1fae249)** |
| 4 | R-ICC-LMAX | longueur inconnue : aucun constat | FN silencieux (le registre dit déjà « données insuffisantes ») | Moyenne | constat « données insuffisantes » non bloquant, regroupé | non — **corrigée le 28/11 (1fae249)** |
| 5 | R-VDROP | longueur inconnue : aucun constat | idem (avertissement, pas sécurité) | Basse | idem #4 | non — **corrigée le 28/11 (1fae249)** |
| 6 | R-RCD30-MAX | date lue sur le différentiel, pas sur les circuits comptés | **FN** : 9e circuit ajouté après 2023 non signalé | Moyenne | date la plus récente des circuits comptés | non — **corrigée le 28/11 (1fae249)** |
| 7 | R-PROT-RATING-MISSING | calibre par défaut 20 A | **FN** : calibre inconnu non signalé | **Haute** | ADR-0010 | **oui** |
| 8 | R-RCD-HEAD-RATING | calibre par défaut 20 A | **FP** : « < 40 A » sur une valeur jamais saisie | Moyenne | ADR-0010 | **oui** |
| 9 | R-OLD-RGIE | contexte du projet seulement | information manquante sur une partie ancienne | Basse | contexte par partie | non |
| 10 | R-INSTALL-DATE | date au format non reconnu ignorée | projet supposé neuf (plutôt FP) | Basse | constat « date non reconnue » | non |
| 11 | R-INSTALL-DATE | partie « neuve » datée d'avant 2020 | partie basculée en existant sans avertissement | Basse | constat sur la partie | non |
| 12 | R-DOC-INSTALLER | constat classé selon le projet | mention non bloquante pour une extension neuve | Basse (documentaire) | classement par partie | non |
| 13 | R-DOC-SUPPLY | seul un champ non vide est vérifié | nature du courant non contrôlée (3.1.2.1) | Basse (documentaire) | valeur structurée (réseau + nature) | **oui** (format de `supply`) |

**Priorité (peuvent masquer une non-conformité, sans dépendre du modèle)** : #1, #2, #3, puis #6, #4 — **corrigées le 28/11** avec #5 (commit 1fae249), cas devenus tests de non-régression, 6 mutants tués. Effet visible : un projet sans longueurs de câbles reçoit « vérifications à faire ». Corrigé aussi : un transformateur ne suffit plus à conclure (TBTS ou secondaire protégé non établis → « à vérifier »), voir ADR-0010, décision 5. Ce sont des
corrections du moteur seul ; elles peuvent être faites avant ou pendant l'ADR-0010. Limite du runner (corrigée le 28/11, commit 762b56c) : un cas « doit échouer » était exécuté avec `it.fails`, aussi satisfait par une exception pendant la
construction du projet, pas seulement par l'écart documenté. Les auteurs des cas ont vérifié l'échec par sondage, mais
rien ne le garantissait. Désormais, le projet est construit hors de toute attente d’échec et seul le résultat comparé
peut différer : une exception fait échouer le test.

## 3. Les 19 cas non modélisés, par priorité

Aucun ne justifie une règle bloquante sur une interprétation non établie. Fréquence : estimation pour les logements
belges.

| Priorité | Cas (nombre) | Risque électrique | Fréquence | Effet sur la fiabilité | Complexité | Validation humaine |
|---|---|---|---|---|---|---|
| 1 | **Prise de terre commune** des immeubles (4 : seuil de 30 Ω, sectionneur commun, obligation depuis le 1/6/2020) | élevé (protection contre les contacts indirects) | élevée (appartements) | élevée : seuil 100 / 30 Ω faux pour un appartement | faible : une propriété de projet « terre commune » | non (texte clair, 5.4.2.1 c) |
| 2 | **Isolement par circuit** (2 : valeur générale vs par circuit ; TBTS 0,25 MΩ) | moyen | élevée (tout contrôle) | moyenne : faux « non conforme » sur une valeur générale | moyenne : mesures par circuit | non |
| 3 | **Liaison équipotentielle supplémentaire** de la salle de bain avant le 1/3/2025 (1) | élevé | moyenne | moyenne | faible : deux booléens au lieu d'un | non |
| 4 | **Différentiels sélectifs / retardés** (2 : temps 500 ms, sélectivité temporelle) | faible (sélectivité) | moyenne (tête 300 mA S) | faible : faux avertissement | faible : option « S » de `rcdType` | non |
| 5 | **Circuits TBTS / séparation** (1 : salle de bain sans 30 mA) | faible | faible | faible | faible : propriété de circuit | non |
| 6 | **Modification ou extension importante** (1 : dérogation 2023 perdue) | moyen | moyenne | moyenne | moyenne : notion de chantier, liée aux dates par partie | **oui** (notion d'« importante ») |
| 7 | Projet entamé avant 2023, contrôlé après, organisme informé (1) | faible | faible | faible | faible | oui |
| 8 | 2 × 230 V entre deux phases d'un réseau 3 × 230 V (1) | moyen | faible | faible | faible : tension entre conducteurs | non |
| 9 | Canalisations en parallèle (1) | moyen | très faible (logement) | faible | moyenne | non |
| 10 | Liaison courte génératrice / batterie (4.4.2.2 b) (1) | moyen | croissante (batteries) | faible : FP « sans protection » | moyenne : dépend de la modélisation AC/DC | oui |
| 11 | Différentiel à l'origine avec alimentation classe II (1) ; 30 mA supplémentaire à l'origine (1) | faible | faible | faible | moyenne | oui |
| 12 | Alimentation par poste privé (chute de tension) (1) | faible | très faible (logement) | faible | faible | oui (norme non consultée) |
| 13 | Installation entièrement en TBT (isolement facultatif) (1) | nul | très faible | nul | faible | non |

**AC / DC, photovoltaïque, batteries.** La propriété de câble `current` (ac / dc) existe depuis la branche
`regulatory-registry`. Elle est saisie à la main, sinon déduite (en aval d'un panneau, d'un onduleur ou d'une
batterie). La suite logique est de déduire la nature du courant des **ports** des appareils (onduleur : entrée DC,
sortie AC ; batterie : DC), plutôt que de la position dans l'arbre. Cela supprime l'heuristique et prépare le cas 10.
Les règles propres au côté DC (sectionnement, IP, câbles PV) relèvent de normes non consultées : ce sont des
rappels, pas des règles bloquantes.

**Courant admissible.** Au-delà du tableau 4.11 (35 mm²), R-CABLE-IZ demande une vérification. Calculer IZ
(mode de pose, groupement, température) relève de la norme HD 60364-5-52, non consultée : à ne pas automatiser sans
cette source.

## 4. Les 24 tests ignorés

| Nombre | Tests | Pourquoi ignorés | Justifié ? |
|---|---|---|---|
| 19 | `test/rules.cases.test.ts`, cas `notModelled` (§3) | l'information n'est pas représentable dans le modèle ; le cas documente la limite | oui ; chaque cas disparaîtra quand le modèle le permettra |
| 1 | `importCondui.test.ts` « exports réels » | fichiers réels d'un autre logiciel, lus seulement si `CONDUI_SAMPLES` désigne des fichiers locaux | oui : ces fichiers ne doivent pas être versionnés (droits, données de clients) ; des fichiers d'essai synthétiques couvrent le format |
| 1 | `importDraadwijs.test.ts` « fichiers d'exemple réels » | idem, `DRAADWIJS_SAMPLES` | oui |
| 1 | `importPlanelec.test.ts` « exports réels » | idem, `PLANELEC_SAMPLES` | oui |
| 1 | `importVolter.test.ts` « fichiers d'essai réels » | idem, `VOLTER_SAMPLES` | oui |
| 1 | `importPdfDossier.test.ts` « dossiers réels » | idem, `PDF_TEXT_SAMPLES` (dossiers de clients) | oui |

## 5. Plan

| Étape | Contenu | Modifie le modèle ? |
|---|---|---|
| 1 | Validation de l'ADR-0010 | — |
| 2 | Anomalies #1, #2, #3, #6, #4 (moteur seul) ; le runner vérifie aussi qu'un cas « doit échouer » construit son projet sans erreur | non |
| 3 | Relevé : plus de défaut écrit ; imports : `installationKind` jamais « neuf » par défaut, plus de différentiel général inventé | **oui** |
| 4 | Dossier de preuves : base `default` / `imported` / `measured`, écrite par tous les chemins ; duplication ; migration des anciens relevés (« proposée (héritée) ») | **oui** |
| 5 | Corrections en un clic sur un relevé : proposition de travaux au lieu de réécrire le fait | **oui** (comportement à valider) |
| 6 | Interface et PDF : état « proposé » lisible, 4 langues ; le résumé du contrôle dit « aucun constat ≠ conformité » | non |
| 7 | Terre commune, isolement par circuit, liaison supplémentaire (priorités 1 à 3 du §3) | **oui** |
| 8 | Tests : migration d'anciens fichiers, provenance par chemin de création, photo, non-régression, mutation | — |

## 6. Risques résiduels de cette analyse

- Les références fichier:ligne de l'annexe datent du commit 9b4e30d.
- Fréquences du §3 : estimations, pas des statistiques.
- L'effet de l'étape 4 sur les anciens relevés (nombre de « à confirmer ») n'est pas mesuré : à mesurer sur des
  projets d'essai avant la publication.

## 7. Retour arrière

Ce document et l'ADR ne changent pas le code. Pour les étapes suivantes : chaque étape sur des commits séparés ; la
migration n'écrit la provenance qu'au prochain enregistrement et ne modifie jamais une valeur, de sorte qu'un retour
à la version précédente relit les fichiers (bases inconnues ignorées, à couvrir par un test).
