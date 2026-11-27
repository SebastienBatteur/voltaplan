# Corrections du moteur réglementaire (novembre 2026)

Branche `rgie-engine-corrections`, créée à partir de `rgie-precisions`. Source : RGIE, Livre 1, version 07 du
15/09/2026, d'application au 01/11/2026 (texte officiel du SPF Économie), relu indépendamment pour chaque anomalie.
Méthode : pour chaque anomalie de `docs/audit/APPRENDRE-RGIE-AUDIT-2026.md`, un test qui la reproduit a d'abord été
écrit (`test/rules.rgie2026.test.ts` : 18 tests en échec avant correction), puis la correction, puis des tests aux
valeurs limites et pour les exceptions du texte. Résultat : 34 tests de la nouvelle série et 6 de cohérence
(`test/regulatory-consistency.test.ts`), 1 157 tests au total, verts.

Rien de ce qui suit ne fait de Voltaplan un outil certifié : toutes les règles restent `needsReview` dans le catalogue
tant qu'un spécialiste ne les a pas validées.

| # | Règle | Statut |
|---|---|---|
| M1 | R-CABLE-PROT, colonne des fusibles | **Corrigé** |
| M2 | R-CABLE-PROT, valeurs des disjoncteurs ≥ 6 mm² | **Corrigé** |
| M3 | R-RCD-TYPE-A, tous les différentiels | **Corrigé** (existant : non bloquant, à vérifier) |
| M4 | Différentiel de tête ≥ 40 A (nouvelle règle R-RCD-HEAD-RATING) | **Corrigé** (dérogations 8.2.1 / 8.2.2 appliquées) |
| M5 | R-SOCKET-MAX, circuits mixtes | **Corrigé** |
| M6 | R-DEDICATED-CIRCUIT, liste et seuil de 2 600 W | **Corrigé** (puissance inconnue : vérification) |
| M7 | R-CABLE-MIN, circuits de commande | **À vérifier** (non modifié) |
| M8 | R-EARTH-VALUE, 100 Ω pile | **Corrigé** |
| M9 | Détection sur les deux conducteurs (4.4.4.2), disjoncteurs 1P+N | **À vérifier** ; disjoncteur différentiel 1P+N en 3 × 230 V ramené à « vérification » |
| M10 | R-RCD-TRIP, 300 ms / 500 ms | **Non bloquant** (avertissement) en attendant une source |
| M11 | Équivalence « VFVB = H05VV-F » (nomenclature) | **Corrigé** (retirée) |
| M12 | Éditions du catalogue (versions de 2025 et 2026 non listées) | **Ouvert** (documentaire) |

---

## M1 et M2 — Calibre maximal selon la section

- **Texte** : RGIE 4.4.1.4, p. 116 : « Pour les installations domestiques, l'intensité nominale maximale des
  coupe-circuit à fusibles ou l'intensité maximale du disjoncteur qui protègent une canalisation électrique est donnée
  au tableau 4.11 ». Tableau 4.11, p. 117 : deux colonnes (fusible / disjoncteur), de 0,5 à 35 mm². Le même article
  rappelle que le courant admissible IZ dépend du mode de pose, de l'isolation, de la température.
- **Cause** : `MAX_PROTECTION_BY_SECTION` était un tableau « prudent » propre à Voltaplan, d'une seule colonne, utilisé
  pour toutes les protections.
- **Faux négatifs (M1, grave)** : fusibles trop forts acceptés : 1,5 mm² + fusible 16 A (max 10 A), 2,5 mm² + fusible
  20 A (max 16 A), 6 mm² + fusible 40 A (max 32 A). Danger : échauffement du câble avant fusion du fusible.
- **Faux positifs (M2)** : disjoncteurs déclarés non conformes alors qu'autorisés : 6 mm² + 40 A, 10 mm² + 63 A,
  16 mm² + 80 A, 25 mm² + 100 A, 35 mm² + 125 A.
- **Correction** : `TABLE_4_11` (les deux colonnes) et `maxProtectionFor(section, device)` : `fuse` → colonne des
  fusibles, autre protection contre les surintensités (`mcb`, `rcbo`) → colonne des disjoncteurs. Au-delà de 35 mm²,
  aucun maximum n'est inventé. Section intermédiaire : ligne inférieure (prudent). Message sourcé (« RGIE 4.4.1.4,
  tableau 4.11 ») au lieu de « maximum conseillé ».
- **Installations existantes** : la règle n'a pas de régime propre dans le catalogue (`hazard: high` → non conforme
  aussi dans l'existant) ; les vieux tableaux à fusibles, jusqu'ici acceptés à tort, seront désormais signalés : c'est
  voulu (sécurité). Les dérogations de la partie 8 (8.2.1) ne visent pas la coordination section / protection.
- **Limite** : le mode de pose (IZ) n'est pas calculé ; le tableau reste un maximum.
- **Tests** : les 11 lignes des deux colonnes ; > 35 mm² ; section intermédiaire ; fusibles aux limites (2,5/16, 1,5/10,
  1,5/16) ; disjoncteurs aux limites (6/40, 10/63, 16/80 conformes ; 6/50, 4/32 non conformes) ; message.

## M3 — Différentiels au moins de type A

- **Texte** : RGIE 5.3.5.3 a, p. 168 : « Les dispositifs de protection à courant différentiel-résiduel placés dans les
  installations domestiques sont au moins du type A ».
- **Cause** : la règle ne visait que le 30 mA d'un circuit de lave-linge, lave-vaisselle ou sèche-linge.
- **Faux négatifs** : différentiel général 300 mA de type AC, ou 30 mA de type AC sur un circuit de prises : non signalés.
- **Correction** : tout différentiel dont le type est AC est signalé. Type non renseigné : aucun constat (pas de
  violation inventée). Le correctif automatique existant (« passer en type A ») s'applique.
- **Installations existantes** : aucune dérogation au type A n'a été trouvée en 8.2.1 / 8.2.2, mais l'absence de
  disposition transitoire n'est pas certaine : la règle garde le régime `existing: recommendation` (non bloquante dans
  une partie existante). Point n° 2 du dossier de validation externe.
- **Tests** : général AC → non conforme et bloquant (neuf) ; A, F, B, inconnu → rien ; existant → recommandation.

## M4 — Différentiel placé en tête : au moins 40 A

- **Texte** : RGIE 5.3.5.3 a : « … ceux qui sont placés en tête de l'installation électrique ont une intensité nominale
  au moins égale à 40 A ».
- **Cause** : exigence non implémentée.
- **Correction** : nouvelle règle `R-RCD-HEAD-RATING` : différentiel sans différentiel en amont, de calibre connu
  < 40 A. Calibre inconnu : rien (déjà signalé par R-PROT-RATING-MISSING). Textes dans les 4 langues.
- **Hypothèse** : « en tête » = premier différentiel de la chaîne. Un différentiel placé directement à l'origine mais
  derrière un autre dispositif de protection non différentiel reste considéré « en tête ».
- **Dérogations** : 8.2.1 (parties d'avant le 1/10/1981) et 8.2.2 (« installations électriques dont l'exécution sur
  place a été entamée avant le 16 septembre 1991 ») laissent en service un différentiel de moins de 40 A (p. 272 et
  277). La règle ne signale donc rien pour une partie exécutée avant le 16/9/1991 ; date inconnue d'une partie
  existante → vérification non bloquante ; après cette date, dans l'existant → recommandation (catalogue).
- **Tests** : 25 A → non conforme ; 40 et 63 A → rien ; 30 mA en aval de 25 A → rien ; calibre inconnu → rien ;
  exécution 1975 et 15/9/1991 → rien ; 16/9/1991 → signalé ; date inconnue → vérification ; catalogue et textes.

## M5 — 8 points par circuit, circuits mixtes

- **Texte** : RGIE 5.3.5.2 b, p. 167 : « Le nombre de socles de prise de courant simples ou multiples est limité à
  huit par circuit terminal. » et « Les socles de prise de courant, les appareils d'éclairage et d'autres appareils
  fixes, à l'exception des appareils fixes des circuits dédiés […], peuvent être alimentés par un même circuit
  terminal. Les prescriptions applicables à ce circuit sont celles relatives aux circuits alimentant des socles de
  prise de courant, un appareil fixe ou un ensemble d'appareils fixes commandé par un appareil de manœuvre commun
  étant assimilé à un socle de prise de courant. »
- **Cause** : seules les prises étaient comptées.
- **Faux négatifs** : circuit de 6 prises + 3 points lumineux à commandes séparées (9 points) non signalé.
- **Correction** : dans un circuit qui comporte au moins une prise, chaque appareil fixe (éclairage, appareil, moteur…)
  compte pour un point, sauf ceux commandés ensemble par une même chaîne de commande (interrupteur, va-et-vient,
  poussoirs et télérupteur, détecteur, module domotique), qui comptent pour un seul ; un appareil branché sur une prise
  est compté avec sa prise. Un circuit sans prise n'a pas cette limite.
- **Interprétation** : « appareil d'éclairage » assimilé à un appareil fixe ; groupe = chaîne de commande. Le cas d'un
  groupe de volets sous une commande générale est au dossier de validation (point 7).
- **Installations existantes** : recommandation (inchangé) ; 8.2.1 point 6 autorise plus de 8 socles dans les
  anciennes installations sous condition de puissance.
- **Tests** : 6 + 3 → 9 non conforme ; 6 + un interrupteur pour 3 lampes → conforme ; va-et-vient = 1 point (7+1 ok,
  8+1 non) ; éclairage seul (12 points) → rien ; 8 / 9 prises ; appareil sur prise.

## M6 — Circuits dédiés

- **Texte** : RGIE 5.2.1.2, p. 129 : « chaque appareil ou machine (mobile) à poste fixe d'une puissance nominale
  supérieure ou égale à 2600 W est alimenté séparément par un circuit dédié. Le lave-linge, le lave-vaisselle, le
  sèche-linge, la cuisinière électrique, la taque de cuisson électrique et le four électrique sont aussi alimentés
  séparément par un circuit dédié. Les appareils d'un chauffage électrique à poste fixe sont alimentés par un ou
  plusieurs circuits dédiés. » ; 7.22.3 pour la borne de recharge.
- **Cause** : liste propre à Voltaplan incluant chauffe-eau, pompe à chaleur et chaudière quelle que soit leur
  puissance, sans seuil de 2 600 W ni chauffage fixe.
- **Faux positifs** : chauffe-eau de 2 000 W partageant un circuit : déclaré non conforme.
- **Faux négatifs** : tout appareil fixe ≥ 2 600 W hors liste (climatiseur…) ; radiateurs électriques fixes sur un
  circuit de prises.
- **Correction** : liste nommée + borne + chauffage fixe (`FIXED_HEATING`, qui peut partager son ou ses circuits) +
  seuil de 2 600 W (inclus). Chauffe-eau, pompe à chaleur, chaudière, climatiseur, sauna, « autre » de puissance
  inconnue : constat « vérification à faire », jamais bloquant.
- **Installations existantes** : recommandation (inchangé).
- **Tests** : 6 appareils nommés, borne, 2 600 / 2 599 W, chauffe-eau 2 000 / 3 000 W, puissance inconnue, radiateurs
  qui partagent leur circuit, appareil seul ou sur sa prise dédiée.

## M7 — Section minimale et circuits de commande (à vérifier)

- **Texte** : RGIE 5.2.1.2, tableau 5.1 : section < 2,5 mm² interdite sauf exceptions (1,5 mm² sans socle de prise ;
  0,75 / 0,5 mm² pour certains circuits, dont commande, contrôle, signalisation et mesure).
- **État** : `R-SOCKET-SECTION` signale déjà moins de 2,5 mm² sur un circuit de prises ; `R-CABLE-MIN` (< 1,5 mm²)
  donne un faux positif pour un circuit de commande en 0,75 mm². Le modèle ne sait pas distinguer de façon fiable un
  circuit de commande : la règle n'est pas modifiée.
- **Proposition** : permettre de marquer un câble « circuit de commande » et appliquer alors le tableau 5.1.

## M8 — Résistance de terre de 100 Ω pile

- **Texte** : RGIE 4.2.3.2, p. 84 : pour les installations domestiques, la résistance de dispersion « est inférieure à
  100 Ω ».
- **Cause** : comparaison `> 100`. **Correction** : `>= 100`. **Tests** : 100 Ω → non conforme ; 99,9 Ω → règle des 30 Ω.

## M9 — Détection sur les deux conducteurs (à vérifier)

- **Texte** : RGIE 4.4.4.2, p. 119 : « Dans les circuits monophasés ou biphasés des installations domestiques, une
  détection de surintensité est réalisée sur les deux conducteurs actifs sauf si à ce niveau existe un dispositif de
  protection à courant différentiel-résiduel qui contient également une détection de surintensité d'un des conducteurs
  de ligne et assure la coupure des deux conducteurs actifs. »
- **État** : seul le réseau 3 × 230 V est contrôlé (R-POLES-NO-NEUTRAL). Une lecture littérale rendrait non conformes
  les disjoncteurs 1P+N courants (une seule détection) derrière un simple différentiel : conséquence trop large pour
  être appliquée sans avis. **Aucune règle bloquante ajoutée** ; point n° 1 du dossier de validation externe.
- **Ajustement** : sur un réseau 3 × 230 V, R-POLES-NO-NEUTRAL déclarait non conforme un disjoncteur différentiel 1P+N,
  alors que 4.4.4.2 admet une détection sur un seul conducteur de ligne pour un tel dispositif qui coupe les deux
  conducteurs. Ce cas devient une vérification non bloquante (le disjoncteur 1P+N simple reste non conforme en
  3 × 230 V). Test ajouté.

## M10 — Temps de déclenchement des différentiels (à vérifier)

- **État** : 300 ms (500 ms pour un sélectif « S ») proviennent des normes de produit (EN 61008 / 61009, non
  consultées) ; le RGIE (tableau 4.9) ne fixe des temps de retard que pour des lieux à risque d'incendie (BE2, BE3,
  CA2). La règle ne transforme plus cette valeur en non-conformité bloquante : un temps mesuré au-delà donne un
  avertissement ; un essai déclaré « non conforme » par l'installateur (R-RCD-TEST) reste bloquant. Tests ajoutés.

## M11 — Équivalence de désignation VFVB

- **Texte** : le RGIE cite le VFVB parmi les « câbles munis d'une armure métallique » (partie 8, p. 278).
- **Cause** : la liste d'équivalences présentait le VFVB comme le H05VV-F (câble souple non armé).
- **Correction** : équivalence retirée (liste du matériel). **Test** : absence de l'équivalence.

## M12 — Éditions du catalogue (ouvert)

Le catalogue (`BE_EDITIONS`) connaît le Livre 1 de 2020 et ses modifications du 1/6/2023 ; les modifications du
1/3/2025 sont gérées par une constante (`RGIE_2025`), et la version 07 (d'application au 01/11/2026) n'y figure pas.
Aucune règle corrigée ici ne dépend d'une date nouvelle ; à traiter avec la proposition d'architecture
(docs/adr/0009-source-de-verite-reglementaire.md).
