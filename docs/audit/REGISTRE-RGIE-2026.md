# Qualification du moteur réglementaire et registre des exigences (RGIE 2026)

Date : 27/11/2026 · Branche : `regulatory-registry` (créée depuis `rgie-engine-corrections`, **non fusionnée** dans
`main`) · Texte de référence : RGIE, Livre 1, version 07 du 15/09/2026, d'application au 01/11/2026 (SPF Économie)

> Voltaplan n'est ni certifié ni validé par le SPF Économie, un organisme agréé ou un spécialiste du RGIE. Ce rapport
> décrit une **validation documentaire** (relecture du texte officiel, assistée par une IA). **Aucune validation
> humaine** n'a eu lieu : 100 % de validation documentaire ne vaut pas 100 % de validation humaine.

## 1. Résumé

| Objectif | Résultat |
|---|---|
| Règles classées | 48 / 48 (les 47 règles auditées + R-CABLE-IZ, créée par l'audit) |
| Règles documentées (fiche du registre : nature, source, référence, conditions, exceptions, transitoire, données) | 48 / 48, dans 35 exigences |
| Règles testées (cas fonctionnels : déclenche / muet, et types imposés par la fiche) | 48 / 48 — 455 cas |
| Références inventées | aucune : chaque référence d'une exigence « RGIE » a une page et une citation relues dans le texte officiel ; les autres natures n'en forcent pas |
| Incertitude cachée | aucune : 6 états de résultat par exigence ; absence d'information ≠ conformité, « non applicable » ≠ satisfait, doute ≠ non-conformité certaine |
| Règle connue fausse laissée active sans traitement | aucune : chaque écart connu est corrigé ou décrit par un cas « anomalie connue » exécuté par la CI (section 6) |
| Validation humaine | 0 / 35 ; questions préparées pour 10 exigences (`VALIDATION-EXTERNE-RGIE.md`) |
| Tests de mutation (règles de sécurité) | 39 / 39 mutants tués (un survivant au premier passage a révélé une date écrite en dur, corrigée) |

Ce qui reste faux ou incomplet est dit section 6 (anomalies connues) et section 10 (risques résiduels).

## 2. Méthode

1. **Audit des 47 règles** (annexes `registre/audit-g1.md` à `audit-g4.md`) : pour chaque règle, implémentation,
   exigence, référence exacte et page, champ, exceptions, dates, régime de l'existant, faux positifs et faux négatifs,
   données nécessaires, tests, limites du modèle. Classement : RGIE vérifiée, normative, bonne pratique, recommandation,
   expertise requise, insuffisamment documentée, erronée. Aucune règle n'a été classée « erronée » dans son principe ;
   plusieurs avaient des comportements faux, corrigés (section 5).
2. **Contre-vérification des points sensibles** (annexe `registre/points-sensibles.md`) : type AC dans l'existant,
   30 mA de 2023, réseau 3 × 230 V, disjoncteurs 1P+N, sections des circuits de commande, limites de la terre, calibre
   au-delà du tableau 4.11, installations de plusieurs époques. Le tableau 5.1 et 4.2.4.3 b (p. 100-101) ont été
   contrôlés sur le rendu image des pages du PDF officiel, pas seulement sur l'extraction texte.
3. **Contre-audit externe du commit 50bba5c** : chaque point vérifié de façon indépendante dans le texte et le code
   avant d'être intégré (section 7).
4. **Registre** (ADR-0009, accepté) puis **tests** : cas fonctionnels par règle, cohérence registre ↔ moteur ↔
   articles ↔ lexique ↔ exercices, mutation ciblée.

La relecture du texte a été faite avec l'assistance d'une IA (Claude), sur le PDF officiel. Elle établit que chaque
référence existe et dit ce que la fiche lui fait dire ; elle ne tranche pas les interprétations, qui sont marquées
« expertise requise » ou portées au dossier de validation externe.

## 3. Modèle de données et architecture

Ajouts (aucune dépendance, aucun serveur, aucune télémétrie) :

- `src/regulations/types.ts`, `be/source.ts`, `be/values.ts` (chaque valeur une seule fois, avec unité et source),
  `be/requirements.ts` (35 fiches), `be/derogations.ts` (8.2.1 et 8.2.2), `be/applicability.ts`, `evaluate.ts`
  (résultat par exigence), `index.ts`.
- Catalogue des règles : retrait des champs `article`, `verifiedOn`, `tests` (en double avec le registre).
- Propriété de câble `current: 'ac' | 'dc'` (facultative) : la nature du courant saisie prime sur l'heuristique
  « en aval d'un panneau, d'un onduleur ou d'une batterie ».
- Contexte de partie : `dated`, dates partielles traitées comme des intervalles (`2023` est à cheval sur le 1/6/2023 :
  « à vérifier », jamais une dérogation acquise), dernière édition applicable retenue.
- Panneau de contrôle : compteur par exigence (satisfaites, non satisfaites, non applicables, à compléter,
  recommandations) au lieu d'un nombre de règles « vérifiées ».

### Les six états d'une exigence

| État | Quand | Compté comme conforme ? |
|---|---|---|
| satisfaite | applicable, données présentes, aucun constat | oui |
| non satisfaite | constat de non-conformité certaine | non |
| non applicable | hors champ, ou dérogation applicable (avec sa référence) | non (compté à part) |
| données insuffisantes | une donnée nécessaire manque, ou applicabilité inconnue | non |
| à vérifier | doute (date à cheval, condition non modélisée, interprétation à confirmer) | non |
| recommandation | bonne pratique ou recommandation de Voltaplan | non |

Une exigence sans contrôle d'applicabilité est « données insuffisantes », jamais satisfaite par défaut ; la CI exige
un contrôle pour chaque fiche.

## 4. Matrice des 48 règles

Colonnes « Cas » : conformes / non conformes / limites / exceptions / transitoires / données manquantes / non
applicables.

| Règle | Exigence | Nature | Références | Cas (C/NC/L/E/T/D/NA) | Anomalies connues | Non modélisés | Validation humaine |
|---|---|---|---|---|---|---|---|
| R-RULESET-UNKNOWN | BE-TOOL-RULESET | outil | — | 5 (0/2/0/1/0/1/1) | — | — | aucune |
| R-OLD-RGIE | BE-TOOL-EDITION | outil | 8.1.1 | 9 (0/1/2/0/3/2/1) | 1 | — | aucune |
| R-INSTALL-DATE | BE-TOOL-EDITION | outil | 8.1.1 | 10 (0/1/3/0/3/2/1) | 2 | — | aucune |
| R-DOC-INSTALLER | BE-DOC-MENTIONS | RGIE vérifiée | 3.1.2.1 a ; 8.2.1 point 7 ; 3.1.2.2 b ; 3.1.2 | 8 (1/2/1/3/0/1/0) | 1 | — | question posée |
| R-DOC-ADDRESS | BE-DOC-MENTIONS | RGIE vérifiée | 3.1.2.1 a ; 8.2.1 point 7 ; 3.1.2.2 b ; 3.1.2 | 7 (1/3/1/1/0/1/0) | — | — | question posée |
| R-DOC-SUPPLY | BE-DOC-MENTIONS | RGIE vérifiée | 3.1.2.1 a ; 8.2.1 point 7 ; 3.1.2.2 b ; 3.1.2 | 8 (2/2/1/1/0/2/0) | 1 | — | question posée |
| R-DOC-NUMBER | BE-DOC-MENTIONS | RGIE vérifiée | 3.1.2.1 a ; 8.2.1 point 7 ; 3.1.2.2 b ; 3.1.2 | 6 (1/2/1/1/0/1/0) | — | — | question posée |
| R-DOC-QUALITY | BE-DOC-MENTIONS | RGIE vérifiée | 3.1.2.1 a ; 8.2.1 point 7 ; 3.1.2.2 b ; 3.1.2 | 8 (1/2/1/2/0/1/1) | — | — | question posée |
| R-DOC-NOT-DRAWN | BE-DOC-SCHEMA-CONTENT | RGIE vérifiée | 3.1.2.2 a ; 8.2.1 point 7 ; 8.2.1, 7 | 7 (1/1/0/2/0/2/1) | — | — | question posée |
| R-EARTH-MISSING | BE-EARTH-ELECTRODE | RGIE vérifiée | 4.2.3.2 ; 5.4.2.1 a | 10 (1/2/0/3/2/1/1) | — | 2 | aucune |
| R-EARTH-VALUE | BE-EARTH-RESISTANCE | RGIE vérifiée | 4.2.3.2 ; 6.4.5.2 ; 6.5.6 | 7 (1/0/3/2/0/1/0) | — | 1 | aucune |
| R-EARTH-30 | BE-EARTH-ABOVE-30 | RGIE vérifiée | 4.2.4.3 b, 10e al. ; 5.4.2.1 c.2 1° ; 6.5.8.1, 1, 3e al. | 21 (1/1/8/2/5/2/2) | — | 2 | aucune |
| R-INSULATION | BE-INSULATION | RGIE vérifiée | 6.4.5.1 ; 6.4.5.1, tableau 6.1 ; 6.4.6.4 b.5 | 8 (1/0/3/2/0/2/0) | — | 2 | aucune |
| R-BONDING | BE-BONDING | RGIE vérifiée | 4.2.3.4 a.4 ; 7.1.4.4 ; 8.2.1, 13 | 9 (1/2/0/2/3/1/0) | — | 1 | aucune |
| R-RCD-TEST | BE-RCD-TESTS | RGIE vérifiée | 6.5.7.2 b.4 e ; 7.112.3 ; 6.4.4 | 6 (1/1/0/1/0/2/1) | — | — | question posée |
| R-RCD-TRIP | BE-RCD-TRIP-TIME | insuffisamment documentée | — | 6 (1/0/2/1/0/1/1) | — | 1 | question posée |
| R-MEAS-MISSING | BE-MEASUREMENTS | RGIE vérifiée | 6.4.5.2 ; 6.4.5.1 ; 6.4.6.4 b.4 | 6 (1/0/1/1/0/3/0) | — | 1 | question posée |
| R-PROT-RATING-MISSING | BE-DOC-SCHEMA-CONTENT | RGIE vérifiée | 3.1.2.2 a ; 8.2.1 point 7 ; 8.2.1, 7 | 7 (2/0/0/1/0/4/0) | 1 | — | question posée |
| R-POLES-NO-NEUTRAL | BE-OVERCURRENT-CONDUCTORS | RGIE vérifiée | 4.4.4.1 ; 4.4.4.2 ; 4.4.4.3 ; 4.4.4.5 | 11 (1/3/0/2/0/2/3) | — | 1 | question posée |
| R-PROT-KA-MISSING | BE-DOC-BREAKING-CAPACITY | recommandation | 3.1.2.2 a ; 3.1.2.2 b ; 5.3.5.5 e | 7 (1/0/0/1/0/3/2) | — | — | aucune |
| R-RCD-SENS-MISSING | BE-DOC-SCHEMA-CONTENT | RGIE vérifiée | 3.1.2.2 a ; 8.2.1 point 7 ; 8.2.1, 7 | 6 (1/0/0/1/0/3/1) | — | — | question posée |
| R-RCD-SELECTIVITY | BE-RCD-SELECTIVITY | bonne pratique | 5.5.7.2 ; 4.3.3.6 d, tableau 4.9 | 8 (1/2/3/0/0/2/0) | — | 1 | aucune |
| R-RCD-MAIN | BE-RCD-ORIGIN | RGIE vérifiée | 4.2.4.3 b, 1er alinéa ; 4.2.4.3 b, 2e alinéa ; 4.2.4.3 b, 3e alinéa | 10 (1/2/2/2/0/3/0) | — | 1 | aucune |
| R-RCD30 | BE-RCD-HIGH-SENSITIVITY | RGIE vérifiée | 4.2.4.3 b, 5e alinéa ; 2.6.4 ; 6.5.8.1, 1 ; 8.2.1, 16 ; 8.2.2, 10 ; 4.2.4.3 b (transitoire) ; 4.2.4.3 b, dernier al. | 23 (1/5/3/6/5/2/1) | — | — | aucune |
| R-RCD30-MAX | BE-RCD-HIGH-SENS-MAX-CIRCUITS | RGIE vérifiée | 4.2.4.3 b, 6e alinéa ; 6.5.8.1, 1 ; 8.2.1, 16 ; 8.2.2, 10 | 12 (0/1/2/4/3/1/1) | 1 | 1 | aucune |
| R-RCD30-DATE | BE-RCD-HIGH-SENSITIVITY | RGIE vérifiée | 4.2.4.3 b, 5e alinéa ; 2.6.4 ; 6.5.8.1, 1 ; 8.2.1, 16 ; 8.2.2, 10 ; 4.2.4.3 b (transitoire) ; 4.2.4.3 b, dernier al. | 17 (1/0/2/2/6/5/1) | 1 | 1 | aucune |
| R-RCD-TYPE-A | BE-RCD-TYPE-A | RGIE vérifiée | 5.3.5.3 a | 13 (2/2/0/3/2/3/1) | — | — | question posée |
| R-CABLE-IZ | BE-SECTION-RATING | RGIE vérifiée | 4.4.1.4 ; 4.4.3.2 | 4 (0/0/2/1/0/1/0) | — | — | aucune |
| R-RCD-HEAD-RATING | BE-RCD-HEAD-RATING | RGIE vérifiée | 5.3.5.3 a ; 8.2.1, 2 ; 8.2.2, 2 | 13 (1/0/2/5/1/3/1) | 1 | — | aucune |
| R-CABLE-SECTION-MISSING | BE-DOC-SCHEMA-CONTENT | RGIE vérifiée | 3.1.2.2 a ; 8.2.1 point 7 ; 8.2.1, 7 | 6 (1/0/0/1/0/2/2) | — | — | question posée |
| R-CABLE-DATA-MISSING | BE-DOC-SCHEMA-CONTENT | RGIE vérifiée | 3.1.2.2 a ; 8.2.1 point 7 ; 8.2.1, 7 | 6 (1/0/0/1/0/4/0) | — | — | question posée |
| R-CABLE-MIN | BE-SECTION-MIN | RGIE vérifiée | 5.2.1.2 ; tableau 5.1 ; 8.2.1 point 5 ; 8.2.2 point 5 | 17 (0/2/3/6/3/2/1) | — | — | aucune |
| R-CABLE-PROT | BE-SECTION-RATING | RGIE vérifiée | 4.4.1.4 ; 4.4.3.2 | 17 (0/3/7/3/0/3/1) | — | 1 | aucune |
| R-CABLE-NO-OVERCURRENT | BE-OVERCURRENT-PRESENT | RGIE vérifiée | 4.4.2.2 a ; 4.4.4.1 | 7 (1/1/0/2/0/1/2) | — | 1 | aucune |
| R-SOCKET-EARTH | BE-SOCKET-EARTH | RGIE vérifiée | 5.3.5.2 b ; 8.2.1 point 6 b ; 8.2.1 point 6 | 7 (1/1/0/4/0/1/0) | — | — | aucune |
| R-SOCKET-CHILD | BE-SOCKET-CHILD-OLD | insuffisamment documentée | 6.5.8.1 point 2 ; 8.2.1 point 6 a ; 5.3.5.2 c | 9 (1/1/1/1/3/1/1) | — | — | question posée |
| R-SOCKET-IPXXD | BE-SOCKET-SHUTTERS | RGIE vérifiée | 5.3.5.2 a ; 5.3.5.2 c ; 6.5.8.1 point 2 | 10 (1/1/1/2/3/1/1) | — | — | aucune |
| R-SOCKET-MAX | BE-SOCKETS-PER-CIRCUIT | RGIE vérifiée | 5.3.5.2 b ; 8.2.2 point 6 | 11 (3/2/2/2/0/1/1) | — | — | question posée |
| R-SOCKET-SECTION | BE-SECTION-MIN | RGIE vérifiée | 5.2.1.2 ; tableau 5.1 ; 8.2.1 point 5 ; 8.2.2 point 5 | 12 (0/2/2/5/1/1/1) | — | — | aucune |
| R-DEDICATED-CIRCUIT | BE-DEDICATED-CIRCUITS | RGIE vérifiée | 5.2.1.2 ; 7.22.3 ; 8.2.2 point 5 | 14 (2/5/2/2/0/2/1) | — | — | aucune |
| R-CIRCUIT-NAME | BE-DOC-CIRCUIT-NAME | bonne pratique | — | 5 (1/2/1/0/0/1/0) | — | — | aucune |
| R-WETROOM-NAME | BE-WETROOM-HINT | recommandation | 4.2.4.3 b, 5e al., 3° ; 7.1.4.3 | 13 (1/1/0/2/1/5/3) | 1 | 1 | aucune |
| R-EV-MANUAL | BE-EV-CHARGER | recommandation | 7.22.1 ; 7.22.3 ; 7.22.4.1 | 8 (0/1/2/1/2/1/1) | — | — | aucune |
| R-PV-MANUAL | BE-PV | recommandation | 7.112.1 ; 7.112.2 | 9 (0/2/2/1/0/1/3) | — | — | aucune |
| R-VDROP | BE-VOLTAGE-DROP | bonne pratique | 5.2.5 ; 5.2.1.2 b | 12 (1/2/6/1/0/2/0) | 1 | 1 | question posée |
| R-VDROP-RATING | BE-VOLTAGE-DROP-RATING | recommandation | — | 5 (1/2/0/0/0/1/1) | — | — | aucune |
| R-ICC-LMAX | BE-SHORT-CIRCUIT-LMAX | expertise requise | 4.4.2.1 point 2 ; 4.4.2.2 c ; 5.2.1.2 e | 10 (2/2/4/1/0/1/0) | 2 | — | aucune |
| R-COUNTRY-OPTION | BE-TOOL-RULESET | outil | — | 5 (1/2/0/0/0/1/1) | — | — | aucune |

Total : 455 cas ; anomalies connues : 13 ; non modélisés : 19.

## 5. Corrections apportées au moteur (branche `regulatory-registry`)

| Commit | Correction | Effet |
|---|---|---|
| 2d8163f | Icc min et longueur protégée calculées sur le défaut le plus faible (phase-neutre ou phase-phase à 230 V) | en triphasé, Lmax était surestimée d'un facteur 2 (faux négatif) |
| 10e0983 | Dates : dates partielles = intervalles ; l'assistant et l'import ne supposent plus l'« ancien RGIE » | **faux négatif de sécurité** : un relevé fait avec l'assistant ne signalait jamais l'absence de 30 mA sur prises et éclairage |
| 734026e | Existant : une non-conformité ne devient plus « recommandation » d'office ; seules les dérogations réelles de 8.2.1 / 8.2.2 / 6.5.8.1 changent le constat | type AC, différentiel de tête, 8 socles, circuits dédiés : non conformes dans une partie de 2020 et après |
| 734026e | Terre au-delà de 30 Ω : les mesures complémentaires de 4.2.4.3 b sont évaluées (deux 30 mA, 16 points chacun, 100 mA) | auparavant simple rappel |
| 734026e | Type de différentiel inconnu → données insuffisantes ; AC → non conforme (Livre 1), à vérifier (avant) | |
| 734026e | Différentiel de sensibilité connue > 300 mA à l'origine → non conforme | |
| 734026e | Circuits de commande (≥ 0,5 mm², sans charge de puissance) → à vérifier ; au-delà de 35 mm² : R-CABLE-IZ | |
| (cette branche) | Terre > 30 Ω : appareils fixes comptés comme des socles ; sensibilité inconnue → données insuffisantes | faux négatif et faux constat certain |
| (cette branche) | Prise rasoir sur transformateur de séparation (5.3.5.2 b) ; socle dans un tableau ou à verrouillage dispensé d'IPXX-D (5.3.5.2 a) ; socle simple dans un tableau en 0,75 mm² (tableau 5.1) | faux positifs bloquants |
| (cette branche) | Câble au secondaire d'un transformateur non comparé au calibre du primaire | faux positif bloquant (sonnerie) |
| (cette branche) | 8.2.2 point 5 : date du 17/5/1986 et circuit sans socle | faux « à vérifier » |
| (cette branche) | Type et nombre de conducteurs exigés (3.1.2.2 a) ; schéma simplifié d'avant 1981 | donnée manquante non signalée |
| (cette branche) | Moteurs ≥ 2 600 W : circuit dédié (5.2.1.2) | faux négatif |
| (cette branche) | Borne de recharge : 7.22 à partir du 1/11/2022 ; photovoltaïque ≤ 10 kVA (7.112.1) | rappels hors champ |
| (cette branche) | 3 × 230 V, pôles inconnus → données insuffisantes ; responsable non exigé avant 1981 (8.2.1 point 7) ; nom de circuit vide | |
| (cette branche) | Date du 1/10/1981 lue dans le registre (révélé par la mutation) | |

## 6. Anomalies connues restantes

Chaque anomalie ci-dessous est un cas de test « doit échouer » : la CI échoue si le moteur change de comportement sur ce
cas (corrigé ou aggravé), ce qui oblige à mettre le cas à jour. Aucune n'est cachée.

- **R-OLD-RGIE** — projet neuf contenant une partie ancienne (oldPart) : information attendue pour cette partie : contexte du projet seulement : une partie d’une édition antérieure dans un projet récent ne reçoit pas l’information (audit g1, R-OLD-RGIE 7 et verdict c)
- **R-INSTALL-DATE** — neuve, date dans un format non reconnu (« 15/03/2019 ») : à vérifier : date non reconnue ignorée : rien n’est signalé et le projet reste neuf sous l’édition en vigueur (audit g1, R-INSTALL-DATE 8 et verdict)
- **R-INSTALL-DATE** — partie marquée neuve mais datée de 2019 dans un projet neuf : à vérifier : ne lit que meta.installationDate : une partie neuve datée d’avant le 1/6/2020 devient existante en silence (audit g1, R-INSTALL-DATE 7)
- **R-DOC-INSTALLER** — extension neuve dans un projet existant : mention exigée (extension importante), bloquant : constat classé selon le projet : une extension neuve dans un projet existant ne rend pas la mention bloquante (3.1.2.1 a ; audit g1, constats transversaux)
- **R-DOC-SUPPLY** — neuf, « 230 » sans nature du courant : mention incomplète : seul un champ non vide est vérifié : la nature du courant exigée par 3.1.2.1 a (« La tension et la nature du courant ») n’est pas contrôlée (audit g1, R-DOC-SUPPLY 8)
- **R-WETROOM-NAME** — 30 mA déclaré présent « quelque part », circuit dessiné hors 30 mA → l’indice reste : la déclaration globale meta.survey.rcd30 supprime l’indice pour tous les circuits, même ceux dessinés hors 30 mA
- **R-RCD30-DATE** — circuit de prises sans tableau dans sa chaîne (sous le différentiel général), sans date → constat quand même : sans tableau dans la chaîne, askDate ne pose aucune question : la date inconnue reste muette
- **R-PROT-RATING-MISSING** — différentiel ajouté sans calibre saisi (valeur par défaut du modèle) → informations insuffisantes : calibre par défaut de 20 A appliqué par createNode (schema.ts) : aucune donnée manquante signalée (ADR-0007)
- **R-RCD30-MAX** — tableau de 2021 avec 8 circuits, 9e circuit ajouté en 2024 (nouvelle exécution, plus de dérogation) → non conforme, non bloquant : la date est lue sur la chaîne du différentiel, pas sur les circuits comptés : le 9e circuit de 2024 n’est pas signalé (audit g3, R-RCD30-MAX point 7)
- **R-RCD-HEAD-RATING** — différentiel de tête créé sans calibre saisi (20 A par défaut du modèle) : ne pas conclure sur une valeur jamais saisie : calibre par défaut de 20 A appliqué par createNode : non-conformité déclarée sur une valeur jamais saisie (audit g3, verdict c)
- **R-VDROP** — longueur inconnue : chute non calculée → signalée (vérification), jamais passée sous silence : circuit non calculable (longueur manquante) : aucun constat, ce qui peut se lire comme « conforme »
- **R-ICC-LMAX** — protection par fusible (pas de seuil magnétique) : longueur protégée non vérifiée → vérification : fusible : aucun calcul et aucun constat ; attendu une information « longueur protégée non vérifiée » (4.4.2.2 c)
- **R-ICC-LMAX** — longueur inconnue : Icc non calculé → signalé (vérification), pas silencieux : circuit non calculable (longueur manquante) : aucun constat de longueur protégée

Traitement : les valeurs par défaut (calibre de 20 A) demandent de distinguer dans le modèle une valeur saisie d’une valeur par défaut ; les dates par partie (R-OLD-RGIE, R-INSTALL-DATE, R-RCD30-MAX) et la nature du courant (R-DOC-SUPPLY) sont des évolutions du modèle ; pour R-VDROP et R-ICC-LMAX sans longueur, le registre donne déjà « données insuffisantes » à l’exigence (jamais « satisfaite »), seule la règle reste muette.

### Cas non modélisés (non exécutés, limites du modèle de données)
- **R-MEAS-MISSING** — installation entièrement à très basse tension : isolement facultatif (6.4.5.1) : le modèle ne dit pas qu’une installation est entièrement à très basse tension, ni qu’elle est de mesure et de contrôle (exceptions de 6.4.5.1)
- **R-EARTH-MISSING** — appartement sur prise de terre commune (5.4.2.1 c) : liaison au sectionneur commun acceptée : pas de notion de prise de terre commune ni de sectionneur de terre dans le modèle
- **R-EARTH-MISSING** — immeuble à appartements construit depuis le 1/6/2020 : prise de terre commune obligatoire : ni type de bâtiment, ni prise de terre commune, ni boucle à fond de fouille dans le modèle
- **R-EARTH-VALUE** — prise de terre commune à 45 Ω : seuil de 30 Ω (5.4.2.1 c.2 1°) → non conforme : pas de propriété « prise de terre commune » : le seuil de 30 Ω ne peut pas être choisi
- **R-EARTH-30** — projet entamé avant le 1/6/2023 et contrôlé après, organisme agréé informé (4.2.4.3 b, dernier al.) : ni date de début des travaux distincte de la date de contrôle, ni information de l’organisme agréé
- **R-EARTH-30** — prise de terre commune (immeubles depuis le 1/6/2020) à 31 Ω → non conforme (5.4.2.1 c.2 1°) : pas de propriété « prise de terre commune »
- **R-INSULATION** — circuit TBTS sur transformateur de sécurité : seuil de 0,25 MΩ sous 250 V (tableau 6.1) : une seule valeur d’isolement pour le projet : ni valeur par circuit, ni tension nominale ou tension d’essai
- **R-INSULATION** — valeur générale (circuits en parallèle) < 0,5 MΩ : mesure par circuit nécessaire plutôt que non-conformité : le modèle ne distingue pas la valeur générale d’une valeur par circuit
- **R-BONDING** — salle de bain d’avant le 1/3/2025, liaison supplémentaire incomplète (6.5.8.1, 3.4) → à vérifier : un seul booléen pour la liaison principale, les supplémentaires et la continuité
- **R-RCD-TRIP** — différentiel sélectif (S) à 400 ms : limite de 500 ms : rcdType n’accepte que AC, A, F, B : pas d’option « sélectif (S) »
- **R-WETROOM-NAME** — circuit TBTS ou en séparation de sécurité (7.1.4.3) : pas de 30 mA exigé : pas de propriété TBTS / séparation de sécurité sur un circuit
- **R-RCD30-DATE** — modification ou extension importante après le 1/6/2023 : dérogation perdue pour les circuits concernés : pas de notion de modification ou d’extension importante
- **R-POLES-NO-NEUTRAL** — raccordement 2 × 230 V entre deux phases d’un réseau 3 × 230 V : pas de champ « neutre distribué » ni « tension entre conducteurs » : l’absence de neutre ne se lit que dans le libellé 3 × 230 V
- **R-RCD-SELECTIVITY** — différentiel amont retardé ou de type S (sélectivité temporelle) : rcdType n’accepte que AC, A, F, B : ni type S ni retard représentables
- **R-RCD-MAIN** — différentiel au tableau principal, canalisation d’alimentation de classe II (2e alinéa) : ni l’« origine » ni la classe II de la canalisation d’alimentation du tableau ne sont représentées
- **R-RCD30-MAX** — 30 mA supplémentaire à l’origine alimentant plus de 8 circuits d’appareils fixes (8e alinéa) : le modèle ne distingue pas un différentiel du 5e alinéa d’un différentiel supplémentaire placé à l’origine
- **R-CABLE-PROT** — canalisations en parallèle (4.4.3.4 : IZ = somme) : pas de notion de canalisations en parallèle dans le modèle (method « parallel » à clarifier)
- **R-CABLE-NO-OVERCURRENT** — liaison courte d’une génératrice ou d’une batterie (4.4.2.2 b) : les dispenses de 4.4.2.2 b et 4.4.3.3 (liaisons courtes, sources limitées) ne sont pas représentées
- **R-VDROP** — alimentation par poste privé (limites différentes selon la norme) : le modèle ne distingue pas une alimentation par poste privé ; limites de la norme non consultées

## 7. Contre-audit externe du commit 50bba5c : intégration

| Point | Vérification indépendante | Traitement |
|---|---|---|
| Heuristique `dcSide` | confirmée : un câble AC en aval d'un onduleur était exclu des règles | propriété `current` (734026e) ; l'heuristique ne vaut qu'à défaut |
| Protections au-delà de 30 Ω non évaluées | confirmé (4.2.4.3 b, 10e alinéa, p. 101) | évaluées (734026e) ; appareils fixes comptés et sensibilité inconnue traitée (section 5) |
| Sections > 35 mm² sans contrôle | confirmé (tableau 4.11 s'arrête à 35 mm²) | R-CABLE-IZ (vérification du courant admissible) |
| Isolement et tension d'essai, tableau 6.1 | confirmé : 0,5 MΩ sous 500 V continu pour une tension nominale ≤ 500 V (p. 201) | valeur et source dans `values.ts` ; seuil TBTS (0,25 MΩ) non modélisé (cas non modélisé) |
| Type de différentiel inconnu | confirmé : traité comme conforme | données insuffisantes |
| Existant changé en recommandation | confirmé (constat T1 de l'audit) | supprimé ; dérogations réelles seulement |
| Sensibilité contre sélectivité temporelle | confirmé : la règle compare des sensibilités ; un différentiel S n'est pas représentable | règle classée « bonne pratique », non bloquante ; type S : cas non modélisé |
| Tableau 5.1 | vérifié visuellement (page PDF 141) | 0,5 / 0,75 / 1,5 mm² et leurs conditions ; exception « socle simple dans un tableau » appliquée (section 5) |
| Test de cohérence : présence textuelle d'un identifiant ≠ couverture | confirmé | remplacé par les cas fonctionnels (`test/rules.cases.test.ts`) |
| 100 Ω codé en dur | confirmé | lu dans `values.ts` |
| Contrôles qui réussissent sur zéro correspondance | confirmé (puissance, terre) | chaque contrôle exige au moins une occurrence |
| Couverture du tableau 4.11 non exhaustive | confirmé | toutes les lignes de 1,5 à 16 mm², colonnes disjoncteur et fusible |
| Tests de mutation | étudiés et mis en place | section 8 |

## 8. Couverture

- **Documentaire** : 35 fiches ; 22 exigences du RGIE avec références relues (page et citation) ; 8 exigences relues en partie (bonnes pratiques et recommandations qui citent un passage du RGIE) et 3 non vérifiées (normes non consultées, outil) ; les
  bonnes pratiques et recommandations n'ont pas de référence forcée.
- **Tests** : 1 683 tests réussis, 24 ignorés (19 cas non modélisés, 5 tests préexistants) ; 455 cas fonctionnels sur les 48 règles, dont 13 anomalies connues exécutées comme « doit échouer » ; chaque exigence a les types de cas que sa fiche impose (vérifié par la CI).
- **Cohérence** : valeurs des articles et du lexique (tableau 4.11 complet de 1,5 à 16 mm², 2 600 W, 100 Ω, 30 Ω,
  30 / 300 mA), règles citées par les articles ↔ fiches, 10 exercices de câblage passés au moteur.
- **Mutation** (`npm run test:mutation`, lancé à la main, environ 50 min) : premier passage sur 34 mutants : 33 tués ; le survivant (date du 1/10/1981) a montré que la date était écrite en dur dans le catalogue, au lieu d’être lue dans le registre ; corrigé. 5 mutants ajoutés pour les corrections (dates de 7.22.1 et de 8.2.2 point 5, 10 kVA, prise rasoir, sensibilité inconnue) ; second passage sur les 7 mutants concernés : 7 tués. Total : 39 / 39. Les 32 mutants du premier passage n’ont pas été relancés après les corrections (mêmes motifs, toujours présents une fois chacun).

## 9. Questions externes

Le dossier `VALIDATION-EXTERNE-RGIE.md` (15 questions) reste à soumettre à un organisme agréé ou au SPF Économie.
Questions ajoutées par cet audit (à y reporter lors de l'envoi) :

1. Partie de 1981-2020 jamais soumise à un examen de conformité : 8.2.2 s'applique-t-il ? (le moteur répond « à
   vérifier »).
2. Partie neuve ajoutée dans une installation existante : les mentions du dossier sont-elles exigées pour la seule
   extension ? (anomalie connue R-DOC-INSTALLER).
3. Différentiel de type AC dans une partie d'avant 2020 : infraction (lecture littérale) ou toléré ?
4. Projet entamé avant le 1/6/2023 et contrôlé après : comment l'information de l'organisme agréé doit-elle figurer au
   dossier ?

## 10. Risques résiduels

- **Valeurs par défaut** : un différentiel ou un disjoncteur créé reçoit 20 A, 1P+N, 3 kA, 2,5 mm² par défaut ; le
  moteur ne distingue pas une valeur saisie d'une valeur par défaut (anomalies connues R-PROT-RATING-MISSING,
  R-RCD-HEAD-RATING). Correction : marquer les valeurs saisies dans le modèle (migration de données à prévoir).
- **Déclarations globales du relevé** (`meta.survey`) : une réponse vaut pour tout le projet.
- **Non domestique** : non modélisé ; le contrôle suppose un logement.
- **Locaux particuliers** (partie 7) : rappels seulement.
- **Examen de conformité** (condition de 8.2.2 et de 6.5.8.1) : inconnu du modèle → « à vérifier ».
- **Interprétation** : aucune validation humaine ; les natures « expertise requise » et « source insuffisante » ne
  produisent jamais de non-conformité bloquante.

## 11. Impact sur les projets existants et les exports

- **Plus de constats** sur les projets existants : parties de 2020 et après (type AC, 40 A, 8 socles, circuits
  dédiés), relevés faits avec l'assistant (30 mA), terre entre 30 et 100 Ω, fusibles (colonne fusible du tableau 4.11).
  Ce sont des corrections : l'ancien silence était faux.
- **Moins de faux constats** : dérogations de 8.2.1 (terre des socles, sections, liaison principale), circuits de
  commande, prise rasoir, socle dans un tableau, câble au secondaire d'un transformateur.
- **Fichiers** : aucun changement de format. `rgieVersion: 'old'` reste lu, mais sans date il ne vaut plus dérogation
  (« inconnu »). La propriété `current` est facultative. Aucune migration nécessaire.
- **Exports** (PDF, dossier) : le texte de l'exigence de terre devient « < 100 Ω (au-delà de 30 Ω : mesures
  complémentaires) » ; le résumé du contrôle compte des exigences au lieu de règles.

## 12. Retour arrière

La branche est linéaire au-dessus de `rgie-engine-corrections` ; rien n'est fusionné. Pour revenir en arrière après une
éventuelle fusion : `git revert` des commits de la branche, dans l'ordre inverse. Le registre (`src/regulations`) et la
page publique sont additifs ; aucune donnée de projet n'est migrée, un projet enregistré avec cette version s'ouvre
avec la précédente (la propriété `current` est ignorée).

## 13. Résultats de la CI

Validations **réelles** (exécutées sur cette machine, Windows, le 27/11/2026, commit de tête de la branche) :

- `npx tsc -p .` : aucune erreur ; `npx eslint .` : aucune erreur ;
- `npx vitest run` : 106 fichiers, 1 683 tests réussis, 24 ignorés ;
- `npm run build` : réussi ;
- `npm run test:mutation` : voir section 8 (39 / 39).

CI GitHub (`CI` et `CI multi-OS`) sur la branche poussée : voir le message de fin de travail (résultat ajouté après
l'exécution). Rien n'est **simulé** dans ce rapport : les comportements cités ont été obtenus en exécutant le moteur
(cas de test, sondes de l'audit) ; la seule partie non exécutée est la validation humaine, qui n'a pas eu lieu.

Annexes : `registre/audit-g1.md` à `audit-g4.md`, `registre/points-sensibles.md`.
