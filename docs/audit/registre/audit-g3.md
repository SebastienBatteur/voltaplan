> Annexe du rapport `docs/audit/REGISTRE-RGIE-2026.md`. Document de travail de l’audit (27/11/2026), écrit sur le moteur **avant** les corrections de la branche `regulatory-registry` : les constats corrigés depuis sont listés dans le rapport. Les chemins `scratchpad/…` désignent des fichiers de travail non versionnés (extrait texte du RGIE, sondes).

# Audit des règles — lot g3 (protections et différentiels)

Dépôt audité : `scratchpad/wt-engine` (branche `regulatory-registry`), lecture seule. **Attention** : le dépôt a été
modifié pendant l'audit (`rgie.ts` et `catalog.ts` réécrits à 22:32-22:33, constantes déplacées vers
`src/regulations/be/values.ts`). La logique des 10 règles n'a pas changé ; les numéros de ligne ci-dessous sont ceux
de la version relue à 22:38. Texte officiel : RGIE Livre 1, version 07 (15/09/2026), `scratchpad/livre1.txt`. Les
pages sont les pages imprimées (pied de page « | n », qui clôt chaque page).

Règles : R-PROT-RATING-MISSING, R-POLES-NO-NEUTRAL, R-PROT-KA-MISSING, R-RCD-SENS-MISSING, R-RCD-SELECTIVITY,
R-RCD-MAIN, R-RCD30, R-RCD30-MAX, R-RCD-TYPE-A, R-RCD-HEAD-RATING.

## Textes de référence lus en entier (résumé fidèle)

**4.2.4.3 b « Protection des circuits en général » (p. 100-101).** Les alinéas, numérotés comme le fait le texte
lui-même dans ses renvois (6.5.8.1 cite le « 5e », le « 6e » et le « 10e » alinéa) :

1. (p. 100) « Au moins un dispositif de protection à courant différentiel-résiduel, dont le courant différentiel de
   fonctionnement est au maximum 300 mA, est placé à l'origine de l'installation électrique. » Il assure aussi le
   sectionnement (5.3.3.1 a.3).
2. (p. 101) Dérogation : il peut être placé dans le tableau principal si la canalisation d'alimentation de ce tableau
   est de classe II ou d'isolation équivalente.
3. Modification ou extension **importante** d'une ancienne installation domestique (partie 8) : toute l'installation
   est protégée par ce différentiel de l'alinéa 1.
4. (5e alinéa dans les renvois) « Immédiatement en aval » du différentiel d'origine, au moins un différentiel à haute
   ou très haute sensibilité auquel sont raccordés au moins : 1. les socles « non destinés à l'alimentation des
   appareils et des machines fixes ou à poste fixe » ; 2. l'éclairage ; 3. les lieux avec baignoire ou douche
   (chapitre 7.1) ; 4. les lave-linges, sèche-linges et lave-vaisselles.
5. (6e) « Il est autorisé de placer au maximum 8 circuits terminaux par dispositif de protection à courant
   différentiel-résiduel mentionné ci-avant. »
6. (7e, 8e) Les circuits du 8e alinéa peuvent être raccordés directement sous le différentiel d'origine ; les
   prescriptions du 5e alinéa ne s'appliquent pas aux différentiels **supplémentaires placés à l'origine** qui
   alimentent : appareils fixes ou à poste fixe (froid, cuisinières, chauffage) ; socles alimentés par un transformateur
   de séparation individuel ; « tout autre circuit non visé au 5ème alinéa ».
7. (9e) Chauffage par résistances noyées > 25 V AC : différentiel séparé de 100 mA maximum.
8. (10e) Résistance de dispersion > 30 Ω : au moins **deux** différentiels haute sensibilité, chacun au plus **seize**
   socles (un appareil fixe ou un groupe commandé ensemble compte pour un socle), plus au moins un 100 mA par circuit
   ou groupe pour les circuits du 8e alinéa.
9. Disposition transitoire (p. 101) : le point 1 de 6.5.8.1 peut être appliqué aux installations et modifications
   importantes « dont la réalisation du projet ou des travaux est entamée avant le 01/06/2023 », si le contrôle a lieu
   à partir du 01/06/2023 ; l'organisme agréé en est informé et le mentionne dans le rapport.

**Ce qui est antérieur à 2023 et ce qui est nouveau** (déduit des dérogations, le texte ne date pas les alinéas) :
6.5.8.1, 1 (p. 207), 8.2.1, 16 (p. 276) et 8.2.2, 10 (p. 278) dispensent l'existant **uniquement** des points 1 et 2
(prises, éclairage) du 5e alinéa, du 6e alinéa (8 circuits) et de la forme du 10e alinéa (> 30 Ω : un 30 mA pour tout
l'éclairage et un par groupe de 16 socles au plus suffisent). Rien ne dispense : le 300 mA d'origine (alinéa 1), le
30 mA des lieux avec baignoire ou douche et des lave-linges / sèche-linges / lave-vaisselles (points 3 et 4), le
100 mA du chauffage noyé, ni le principe de deux 30 mA au-delà de 30 Ω. Pour 6.5.8.1 la dispense vaut pour une exécution
sur place entamée avant le 01/06/2023 ; pour 8.2.1 et 8.2.2 elle est sans date limite (toute l'ancienne installation,
« aussi d'application sur toute modification ou extension non-importante »).

**Définitions 2.6.4 (p. 34)** : haute sensibilité « au plus égal à 30 mA en courant alternatif » (et > 10 mA) ; très
haute sensibilité ≤ 10 mA.

**5.3.5.3 a (p. 168)** : « Les dispositifs de protection à courant différentiel-résiduel placés dans les installations
domestiques sont au moins du type A; ceux qui sont placés en tête de l'installation électrique ont une intensité
nominale au moins égale à 40 A. »

**Dérogations de la partie 8 sur les différentiels** (seules dérogations trouvées) :
- 8.2.1, 2 (p. 273), parties d'avant le 1/10/1981 : sectionnement assuré par un sectionneur en amont ; différentiels
  de moins de 40 A ; différentiels de moins de 40 A sans le marquage « 3000 A, 22,5 kA²s ». Aucune date limite.
- 8.2.2, 2 (p. 277), installations « ancien RGIE » (exécution à partir du 1/10/1981 **et** examen de conformité selon
  l'ancien RGIE) : sectionnement en amont si exécution avant le 2/7/2003 ; moins de 40 A si exécution « entamée avant
  le 16 septembre 1991 » ; sans marquage « 3000 A, 22,5 kA²s » si entamée avant le 7/5/2000 ou conforme à la NBN 819.
- **Aucune dérogation au type A** n'existe dans 8.2.1, 8.2.2 ni 6.5.8.1 ; le point 1 de 8.2.1 et de 8.2.2 (matériel
  construit selon les règles de l'art) exige que « les caractéristiques du matériel électrique répondent aux
  prescriptions des installations domestiques du présent Livre ».

**4.4.4 (p. 119-120)** : 4.4.4.1 « Une détection de surintensité est prévue sur tous les conducteurs de ligne. » ;
4.4.4.2 (domestique, circuits monophasés ou biphasés) détection « sur les deux conducteurs actifs » sauf disjoncteur
différentiel détectant sur un conducteur de ligne et coupant les deux ; 4.4.4.3 (triphasé TT/TN sans N) une phase peut
être sans détection si un différentiel au même niveau coupe toutes les phases ; 4.4.4.4 (triphasé TT/TN, N distribué) N
de section égale : ni détection ni coupure nécessaires ; 4.4.4.5 (IT, N distribué) détection sur N coupant tous les
conducteurs, sauf différentiel ≤ 0,15 × IZ du N ou N protégé en amont.

**5.3.5.5 e (p. 170-171)** : Icc présumé monophasé aux bornes aval des premiers dispositifs de surintensité placés
après les différentiels généraux ≤ 3000 A ; en amont de ces bornes, pouvoir de coupure minimal 3000 A (marquage 3000
encadré pour les petits disjoncteurs) et classe de limitation d'énergie 3 pour les disjoncteurs de première ligne ;
fusibles et disjoncteurs à broches ≥ 3000 A ; différentiels I²t ≥ 22,5 kA²s à 3000 A. Dans l'extrait texte, le signe
de « intensité nominale  40 A » (marquage des différentiels) est perdu : à lire sur le PDF.

**3.1.2.2 a (p. 64)**, unifilaire domestique : « le type et les caractéristiques des dispositifs de protection à
courant différentiel-résiduel » et « le type et les caractéristiques des dispositifs de protection contre les
surintensités ». Le « pouvoir de coupure » n'est nommé que pour le non-domestique (3.1.2.2 b). 8.2.1, 7 (p. 274) :
schéma simplifié avec les différentiels et les protections « avec leurs caractéristiques » ; 8.2.2, 7 (p. 278) :
tolère l'absence du « type des dispositifs de protection ».

## Constats transversaux du lot

- **Valeurs par défaut prises pour des valeurs connues** (contraire à ADR-0007). `createNode` (`src/model/tree.ts`
  l. 10-12) applique `defaultProps` (`src/model/schema.ts` l. 295-299) : toute protection reçoit `device: 'mcb'`,
  `ratedCurrent: 20`, `poles: '1P+N'`, `curve: 'C'`, `breakingCapacity: 3` (schema.ts l. 103-111). Conséquences : un
  différentiel ajouté par `addChild` (`src/store.ts` l. 130-134) puis passé en « rcd » garde 20 A (R-RCD-HEAD-RATING le
  déclare non conforme sur une valeur jamais saisie) ; R-PROT-RATING-MISSING et R-PROT-KA-MISSING ne se déclenchent
  presque jamais pour une protection créée dans l'interface ; l'import Volter (`src/import/volter.ts` l. 168-171 et
  361) supprime les champs absents puis laisse les valeurs par défaut s'appliquer (calibre 20 A, 3 kA, 1P+N inventés),
  alors que l'import PDF (`src/import/pdfDossier.ts` l. 358-361, 391-393) les retire correctement.
- **Pas de distinction domestique / non domestique** : 4.2.4.3, 4.4.4.2, 5.3.5.3 a et 5.3.5.5 e (3000 A) visent les
  installations domestiques ; toutes les règles du lot s'appliquent à tout projet.
- **Schéma de liaison à la terre inutilisé** : `meta.earthing` (TT/TN/IT) n'est lu par aucune règle ; 4.4.4.3 à 4.4.4.5
  en dépendent. Le réseau sans neutre n'est reconnu que par le texte de `meta.supply` (regex `/3\s*[x×]\s*230/i`,
  `rgie.ts` l. 224).
- **Statut « existant » abaissé sans base textuelle** : `classify` (`src/rules/context.ts` l. 118-126) donne
  « recommandation » à toute non-conformité de gravité moyenne dans une partie existante. Pour R-RCD30-MAX,
  R-RCD-TYPE-A et R-RCD-HEAD-RATING, une partie existante **sans dérogation applicable** (exécutée après le 1/6/2023,
  ou après le 16/9/1991 pour le 40 A ; tout existant pour le type A) est donc présentée comme une simple recommandation.
- **Sources de paramètres inexactes** dans `src/regulations/be/values.ts` : `CIRCUITS_PER_RCD30_MAX` cite « 4.2.4.3 b,
  p. 100 » (le 6e alinéa est p. 101) ; `RCD_HIGH_SENSITIVITY` cite « définitions, p. 23 » (2.6.4 est p. 34) ;
  `RCD_ORIGIN_MAX_SENSITIVITY` p. 100 est juste.
- **Type « S » impossible à saisir** : `rcdType` n'accepte que AC, A, F, B (schema.ts l. 111) ; la branche 500 ms de
  R-RCD-TRIP et toute appréciation de sélectivité (R-RCD-SELECTIVITY) ne peuvent pas en tenir compte.

---

## R-PROT-RATING-MISSING

1. **Implémentation** : `rgie.ts` l. 279 : pour tout nœud `protection` (y compris `rcd`, `switch`, protection en série),
   `n(ratedCurrent) === undefined` → constat. Catalogue l. 89 : `missingData`, gravité moyenne, documentaire. Statut
   `insufficientData`, bloquant en partie neuve, non bloquant en existant (`classify`, cas `missingData`).
2. **Exigence** : le calibre de chaque protection figure sur l'unifilaire. C'est bien ce qui est vérifié (présence de la
   donnée), à condition que la donnée ne soit pas un défaut silencieux (voir 9).
3. **Référence** : 3.1.2.2 a, p. 64 : « le type et les caractéristiques des dispositifs de protection contre les
   surintensités » (et des différentiels). Pour l'existant d'avant 1981 : 8.2.1, 7, p. 274 (« les dispositifs de
   protection avec leurs caractéristiques »).
4. **Champ** : installations domestiques (3.1.2.2 b pour le non-domestique : « le courant assigné »), neuf et existant,
   tous réseaux et schémas.
5. **Exceptions** : 8.2.1, 7 (schémas simplifiés, caractéristiques toujours exigées) ; 8.2.2, 7 tolère l'absence du
   « type » des protections, pas de leurs caractéristiques. Aucune dérogation 6.5.8.
6. **Dates** : exigence du Livre 1 (1/6/2020) ; pas de transitoire.
7. **Anciennes / mixtes** : non bloquant pour toute partie existante, bloquant pour une partie neuve ; cohérent.
8. **Faux positifs** : interrupteur (`switch`) : 3.1.2.2 a ne demande que « les interrupteurs » (le courant assigné de
   l'interrupteur-sectionneur général compte pour 5.3.5.1 b / 8.2.1, 4) : constat discutable mais utile.
   **Faux négatifs** : calibre par défaut de 20 A jamais saisi (création dans l'interface, import Volter) → aucun
   constat ; un calibre lu sur photo non confirmé est traité par R-UNCONFIRMED.
9. **Données** : `props.ratedCurrent` (nombre ou texte numérique). Manquante → constat documentaire ; les règles qui en
   dépendent passent en « inconnu » (R-CABLE-PROT en relevé) ou se taisent (R-RCD-HEAD-RATING). Jamais « conforme » par
   défaut dans la règle, mais le **modèle** fournit 20 A par défaut.
10. **Tests** : `rules.matrix.test.ts` > « calibre absent : information manquante, bloquante pour une installation
    neuve » ; `assist.test.ts` > « tout accepter : arbre construit… » (calibre illisible). Manquent : existant non
    bloquant ; protection créée par `createNode` sans calibre saisi ; import Volter sans `ampere` ; interrupteur.
11. **Limites** : impossible de distinguer « 20 A saisi » de « 20 A par défaut ».
12. **Classification** : Exigence RGIE vérifiée (documentaire).
13. **Verdict** : corriger (dans le modèle, pas dans la règle) : retirer `default: 20` de `ratedCurrent` (et
    `default: 3` de `breakingCapacity`) dans `PROP_SCHEMAS.protection`, ou faire porter aux valeurs par défaut une
    marque « non confirmé » ; dans `volter.ts`, supprimer `ratedCurrent` / `breakingCapacity` / `poles` absents après
    `createNode` comme le fait `pdfDossier.ts`. Tests : `createNode('protection', { device: 'rcd' })` → R-PROT-RATING-
    MISSING ; import Volter sans ampère → constat, pas de 20 A.

## R-POLES-NO-NEUTRAL

1. **Implémentation** : `rgie.ts` l. 224 (`noNeutral` = `meta.supply` contient « 3 x 230 ») et l. 281-288 : protection
   d'appareil `mcb`, `rcbo` ou `fuse` (appareil absent = `mcb`) en `1P` ou `1P+N` → constat ; disjoncteur différentiel
   `1P+N` → statut imposé `manualCheck`. Catalogue l. 90 : non-conformité, gravité élevée, physique, sans `existing` →
   non conforme et **bloquant même dans une partie existante ou d'avant 1981**.
2. **Exigence** : sur un réseau sans neutre, les deux conducteurs d'un circuit monophasé sont des phases ; chacune doit
   avoir sa détection de surintensité. Vérifié pour le cas 3 × 230 V déclaré.
3. **Références** : 4.4.4.1, p. 119 : « Une détection de surintensité est prévue sur tous les conducteurs de ligne. » ;
   4.4.4.2, p. 119 : « une détection de surintensité est réalisée sur les deux conducteurs actifs sauf si à ce niveau
   existe un dispositif [différentiel] qui contient également une détection de surintensité d'un des conducteurs de
   ligne et assure la coupure des deux conducteurs actifs » ; 4.4.4.3, p. 119 (triphasé sans N) ; 4.4.4.5, p. 120 (IT).
4. **Champ** : 4.4.4.1 tous types d'installations ; 4.4.4.2 domestique, circuits monophasés ou biphasés ; réseaux sans
   neutre distribué (3 × 230 V, et aussi un raccordement « 2 × 230 V » entre deux phases d'un réseau 3 × 230 V).
5. **Exceptions** : 4.4.4.2 (disjoncteur différentiel détectant sur un conducteur de ligne et coupant les deux) ;
   4.4.4.3 pour les circuits triphasés (une phase sans détection si un différentiel au même niveau coupe toutes les
   phases). Aucune dérogation dans 8.2.1, 8.2.2 ni 6.5.8.1 (le point 1 de 8.2.1 / 8.2.2 exige des caractéristiques
   conformes au Livre 1).
6. **Dates** : Livre 1 (1/6/2020) ; exigence de l'ancien RGIE non vérifiable ici.
7. **Anciennes / mixtes** : bloquant partout ; cohérent avec l'absence de dérogation pour le cas 1P/1P+N simple sur deux
   phases (une phase sans détection, 4.4.4.1).
8. **Faux positifs** : protection dont `poles` vaut `1P+N` **par défaut** (jamais saisi) ; fusibles : un porte-fusible
   par conducteur est courant et `poles` n'a pas de sens clair pour un fusible ; disjoncteur `1P` monté en série derrière
   un 2P (`series: true`) ; disjoncteur différentiel 1P+N (vérification, littéralement couvert par l'exception de
   4.4.4.2 mais tension avec 4.4.4.1, question 1 du dossier de validation).
   **Faux négatifs** : raccordement **2 × 230 V entre phases** sur un réseau 3 × 230 V (fréquent à Bruxelles) : non
   reconnu, 1P+N accepté (le test « 2 × 230 V (monophasé) : 1P+N accepté » fige cette hypothèse) ; libellés
   d'alimentation non standard ; schéma IT (`earthing`) ignoré ; lecture littérale de 4.4.4.2 (1P+N et a fortiori 1P sur
   un réseau avec neutre, domestique) non appliquée.
9. **Données** : `meta.supply` (texte libre), `props.device`, `props.poles`, `series`. Alimentation absente → pas de
   constat (R-DOC-SUPPLY signale l'absence) ; pôles absents → pas de constat.
10. **Tests** : `rules.matrix.test.ts` > « 3 × 230 V : disjoncteur 1P+N non conforme, 2P conforme », « 3N × 400 V :
    1P+N accepté », « 2 × 230 V (monophasé) : 1P+N accepté », « réseau 3 × 230 V : disjoncteur 1P+N → bipolaire »
    (correction) ; `rules.rgie2026.test.ts` > « M9 — 3 × 230 V : disjoncteur 1P+N bloquant ; disjoncteur différentiel
    1P+N à vérifier (4.4.4.2) ». Manquent : `1P` ; fusible ; protection en série ; partie existante / d'avant 1981 ;
    pôles non renseignés ; 2 × 230 V entre phases ; circuit triphasé `3P` sur 3 × 230 V (rien attendu).
11. **Limites** : pas de champ « neutre distribué oui / non » ni « tension entre conducteurs du raccordement » ; `poles`
    ne dit pas combien de pôles sont protégés (convention 1P+N supposée) ; `earthing` non exploité.
12. **Classification** : Exigence RGIE vérifiée (cas 1P / 1P+N simple sur deux phases ; le cas disjoncteur différentiel
    et l'extension aux réseaux avec neutre restent à trancher par un spécialiste).
13. **Verdict** : corriger : (a) déduire l'absence de neutre d'un champ explicite (ex. `meta.neutralDistributed` ou
    type de réseau du gestionnaire) et non du seul libellé, avec question si 2 × 230 V ; (b) ne pas émettre de
    non-conformité sur un `poles` par défaut (supprimer le défaut `1P+N` ou passer en `insufficientData`) ; (c) fusibles :
    `manualCheck` tant que le modèle ne dit pas qu'il y a un fusible par phase ; (d) ignorer `series: true` sous un
    appareil 2P. Tests correspondants. Garder bloquant pour 1P / 1P+N disjoncteur simple quand l'absence de neutre est
    établie.

## R-PROT-KA-MISSING

1. **Implémentation** : `rgie.ts` l. 289 : protection dont l'appareil n'est ni `rcd` ni `switch` (donc `mcb`, `rcbo`,
   `fuse` ou non renseigné) sans `breakingCapacity` numérique → constat. Catalogue l. 91 : `missingData`, gravité faible,
   `neverBlocking`, documentaire → `insufficientData`, jamais bloquant.
2. **Exigence** : le pouvoir de coupure de chaque protection contre les surintensités est connu. Vérifie la présence de
   la donnée seulement, **pas sa valeur**.
3. **Références** : 3.1.2.2 a, p. 64 (« le type et les caractéristiques des dispositifs de protection contre les
   surintensités ») — le pouvoir de coupure n'y est pas nommé, il l'est en 3.1.2.2 b, p. 64 (non-domestique) ; exigence
   de fond : 5.3.5.5 e, p. 171 : « les dispositifs de protection contre les surintensités ont un pouvoir de coupure
   minimal de 3000 A » ; 4.4.2.1, p. 117 (pouvoir de coupure ≥ Icc présumé).
4. **Champ** : domestique (3000 A) ; tous réseaux.
5. **Exceptions** : 4.4.1.3 (p. 116, dispositifs en série) admet un pouvoir de coupure inférieur avec un dispositif amont coordonné ;
   8.2.1, 3 (p. 273) et 8.2.2, 3 (p. 277, exécution avant le 31/12/2007) : absence du marquage de classe de limitation
   d'énergie 3 tolérée.
6. **Dates** : Livre 1 ; 31/12/2007 pour la classe 3 (ancien RGIE).
7. **Anciennes / mixtes** : jamais bloquant ; cohérent pour une donnée documentaire.
8. **Faux positifs** : faibles (constat informatif). **Faux négatifs** : valeur par défaut 3 kA appliquée à toute
   protection créée (aucun constat alors que rien n'a été lu) ; valeur < 3 kA (ex. 1,5 kA d'un vieux disjoncteur) jamais
   signalée ; classe de limitation 3 et marquage « 3000 A, 22,5 kA²s » des différentiels non modélisés.
9. **Données** : `props.breakingCapacity` en kA (3 = 3000 A).
10. **Tests** : `rules.matrix.test.ts` > « pouvoir de coupure absent : information manquante, jamais bloquante ».
    Manquent : fusible, disjoncteur différentiel, appareil non renseigné, interrupteur / différentiel exclus, valeur par
    défaut.
11. **Limites** : pas de champ classe de limitation, pas de marquage I²t, pas de position « première ligne après les
    différentiels généraux ».
12. **Classification** : Recommandation (donnée documentaire non bloquante ; l'exigence de valeur de 5.3.5.5 e n'est pas
    vérifiée par cette règle).
13. **Verdict** : garder (non bloquante). Proposition distincte à faire valider : règle de valeur « pouvoir de coupure
    < 3 kA » sur les dispositifs de première ligne après les différentiels généraux (5.3.5.5 e, p. 171), en tenant compte
    des dérogations de marquage ; et retrait du défaut 3 kA du modèle (voir R-PROT-RATING-MISSING).

## R-RCD-SENS-MISSING

1. **Implémentation** : `rgie.ts` l. 290-292 : tout différentiel (`isRcd` : `rcd`, `rcbo`, ou `residualCurrent > 0`,
   `tree.ts` l. 129-131) sans `residualCurrent` numérique → constat. Catalogue l. 92 : `missingData`, moyenne,
   documentaire → `insufficientData`, bloquant en neuf seulement. R-RCD-MAIN et R-RCD30 passent alors en « inconnu ».
2. **Exigence** : la sensibilité de chaque différentiel figure sur l'unifilaire. Vérifié.
3. **Références** : 3.1.2.2 a, p. 64 (« le type et les caractéristiques des dispositifs de protection à courant
   différentiel-résiduel ») ; 8.2.1, 7, p. 274 (« le ou les dispositifs de protection à courant différentiel-résiduel
   avec leurs caractéristiques »).
4. **Champ** : domestique, neuf et existant, tous réseaux.
5. **Exceptions** : aucune pour les caractéristiques (8.2.2, 7 ne tolère que l'absence du « type des dispositifs de
   protection »).
6. **Dates** : Livre 1.
7. **Anciennes / mixtes** : non bloquant en existant ; cohérent.
8. **Faux positifs** : aucun relevé. **Faux négatifs** : aucun (pas de valeur par défaut pour `residualCurrent`).
9. **Données** : `props.residualCurrent` (mA).
10. **Tests** : `rules.matrix.test.ts` > « sensibilité inconnue : information insuffisante (avant : non conforme),
    bloquante seulement en neuf ». Manquent : disjoncteur différentiel sans sensibilité ; constat non bloquant en
    existant vérifié sur R-RCD-SENS-MISSING lui-même.
11. **Limites** : un disjoncteur (`mcb`) avec `residualCurrent` devient un différentiel (`isRcd`) : cohérent.
12. **Classification** : Exigence RGIE vérifiée (documentaire).
13. **Verdict** : corriger le texte seulement : `advice.R-RCD-SENS-MISSING` (fr.ts l. 1247) dit « 300 mA en tête, 30 mA
    pour les locaux humides » : incomplet (30 mA aussi pour lave-linge, sèche-linge, lave-vaisselle et, depuis le
    1/6/2023, prises et éclairage ; 100 mA pour le chauffage noyé). Ajouter les deux tests manquants.

## R-RCD-SELECTIVITY

1. **Implémentation** : `rgie.ts` l. 293-295 : différentiel dont le premier différentiel en amont a une sensibilité
   connue `up`, et dont la sensibilité `rc` est connue et `rc >= up` → constat. Catalogue l. 93 : `warning`, faible,
   physique → avertissement, jamais bloquant, quel que soit le contexte.
2. **Exigence prétendue** : sélectivité entre différentiels en série. La règle ne vérifie qu'un ordre de sensibilités ;
   la sélectivité réelle dépend aussi du retard (type S ou retardé en amont), que le modèle ne connaît pas.
3. **Référence** : aucune pour les installations domestiques. Le RGIE n'exige la sélectivité que pour les circuits de
   sécurité : 5.5.7.1 a / 5.5.7.2, p. 186 : « Cela exige la sélectivité entre les dispositifs de protection. » (circuits
   et consommateurs de sécurité). 5.3.5.3 d (p. 168, courants de fuite, déclenchements intempestifs) est voisin mais ne
   parle pas de sélectivité. Les règles de sélectivité des différentiels relèvent des normes (IEC 60364-5-53, normes de
   produit) non accessibles. Le seul texte du Livre 1 sur le **retard** des différentiels est 4.3.3.6 d, tableau 4.9,
   p. 114 (lieux à risque d'incendie BE2 / CA2 : retard calculé comme pour la seule protection contre les contacts
   indirects ; BE3 : « non retardé ») : une limite au retard, pas une exigence de sélectivité. Le mot « sélectivité »
   n'apparaît qu'en 5.5.7 (p. 186) et 5.6.2.4 a (p. 191, circuits critiques).
4. **Champ** : tout différentiel en série.
5. **Exceptions** : sans objet.
6. **Dates** : aucune.
7. **Anciennes / mixtes** : avertissement partout.
8. **Faux positifs** : 30 mA sous 30 mA (disjoncteur différentiel 30 mA sous un interrupteur 30 mA) : courant, admis par
   le RGIE, signalé. **Faux négatifs** : 30 mA instantané sous 300 mA instantané non signalé, alors qu'un défaut franc
   peut faire déclencher les deux ; le conseil (fr.ts l. 1249) présente « 30 mA en aval » comme une solution de
   sélectivité, ce qui n'est vrai que pour les défauts de faible intensité.
9. **Données** : `residualCurrent` des deux appareils ; pas de type S / retard.
10. **Tests** : **aucun** (`regulatory-consistency.test.ts` l. 117 range la règle parmi les règles connues sans test).
    Manquent : 300 sous 300 (avertissement), 30 sous 300 (rien), 30 sous 30, sensibilité inconnue (rien).
11. **Limites** : pas de type S ni de retard ; pas de courant de défaut.
12. **Classification** : Bonne pratique.
13. **Verdict** : corriger (texte et tests) : statut « recommandation » plutôt qu'« avertissement » (ou laisser
    l'avertissement non bloquant), message sans référence au RGIE, conseil rectifié (« pour une sélectivité totale, un
    différentiel retardé ou de type S en amont ; à vérifier selon les données du fabricant ») ; ajouter les 4 tests.

## R-RCD-MAIN

1. **Implémentation** : `rgie.ts` l. 372 (`rcd300Drawn`), l. 377-380 (`rcds` = différentiels ancêtres + le circuit s'il
   est un disjoncteur différentiel ; `minRcd`), l. 417-429 : pour chaque circuit terminal (`isCircuit`) sans différentiel
   de sensibilité connue ≤ 300 mA (`RCD_ORIGIN_MAX_SENSITIVITY`, values.ts l. 48) : une sensibilité inconnue dans la
   chaîne → `knowledge: 'unknown'` ; sinon `presence(false, meta.survey.rcd, isNew)` : neuf → absent → non conforme ;
   existant → inconnu, sauf déclaration (absent → non conforme ; présent → R-DOC-NOT-DRAWN ; absent déclaré alors qu'un
   ≤ 300 mA est dessiné ailleurs → contradictoire). Catalogue l. 94 : non-conformité, gravité élevée → non conforme et
   bloquant aussi en existant (absence confirmée).
2. **Exigence** : chaque circuit est protégé par un différentiel ≤ 300 mA placé à l'origine. La règle vérifie « un
   différentiel ≤ 300 mA quelque part en amont du circuit », pas sa place à l'origine.
3. **Références** : 4.2.4.3 b, 1er alinéa, p. 100 : « dont le courant différentiel de fonctionnement est au maximum
   300 mA, est placé à l'origine de l'installation électrique » ; 2e alinéa, p. 101 (tableau principal, alimentation de
   classe II) ; 3e alinéa, p. 101 (modification importante d'une ancienne installation : toute l'installation).
4. **Champ** : domestique ; neuf et existant ; tous réseaux et schémas (aucune distinction dans 4.2.4.3).
5. **Exceptions** : 2e alinéa (emplacement) ; 4.2.4.4 e, p. 104 : parties communes d'un ensemble résidentiel, circuits
   de sécurité et critiques (non domestique, hors champ). **Aucune dérogation** à la présence du 300 mA dans 8.2.1, 8.2.2
   ou 6.5.8.1 (seulement le sectionnement : 8.2.1, 2 ; 8.2.2, 2 avant le 2/7/2003).
6. **Dates** : Livre 1 ; s'impose à l'existant faute de dérogation.
7. **Anciennes / mixtes** : bloquant dans toute partie dès que l'absence est établie ; cohérent avec le texte.
8. **Faux positifs** : circuit alimenté par un transformateur de séparation ou en TBTS (si dessiné sous un
   transformateur sans différentiel) ; circuits de sécurité de parties communes (hors domestique).
   **Faux négatifs** : (a) aucun différentiel à l'origine mais un disjoncteur différentiel 30 mA sur chaque circuit : la
   règle est satisfaite, le 1er alinéa littéralement non (question d'interprétation : plusieurs disjoncteurs
   différentiels au tableau principal peuvent-ils tenir lieu de « dispositif placé à l'origine » ?) ; (b) en relevé, un
   différentiel **dessiné** de sensibilité connue > 300 mA (ex. 500 mA) donne « inconnu », pas « non conforme »
   (`presence(false, …)` ne distingue pas « rien dessiné » de « dessiné mais trop peu sensible ») ; (c) emplacement
   (origine ou tableau principal avec alimentation de classe II) non vérifié ; (d) fonction de sectionnement non
   vérifiée.
9. **Données** : arbre (différentiels ancêtres), `residualCurrent`, `meta.survey.rcd`, contexte neuf / existant.
10. **Tests** : `rules.matrix.test.ts` > « neuf, aucun différentiel dessiné : absent du projet → non-conformité
    bloquante (inchangé) », « existant, aucun différentiel dessiné : inconnu, pas bloquant ; question pour l'assistant »,
    « existant, absence confirmée : non conforme et bloquant ; présence confirmée : schéma incomplet », « différentiel
    dessiné mais déclaré absent : informations contradictoires », « sensibilité inconnue : information insuffisante… ».
    Manquent : limite 300 mA (300 accepté, 301 refusé) ; différentiel 500 mA dessiné en relevé ; partie d'avant 1981
    (bloquant) ; disjoncteurs différentiels seuls sans différentiel de tête ; circuit sous sous-tableau.
11. **Limites** : pas de notion d'« origine » ni de classe II de la canalisation d'alimentation du tableau principal.
12. **Classification** : Exigence RGIE vérifiée.
13. **Verdict** : corriger : en relevé, un différentiel dessiné de sensibilité connue > 300 mA, seul dans la chaîne,
    doit donner une non-conformité (ou au moins « anomalie potentielle »), pas « inconnu » ; ajouter les tests de limite
    et de partie ancienne. Emplacement à l'origine : question pour un spécialiste avant toute règle.

## R-RCD30

1. **Implémentation** : `rgie.ts` l. 430-452. Raisons : `wetRoom === 'yes'` sur le circuit ou son contenu ; appareil
   `washingMachine`, `dryer` ou `dishwasher` dans le circuit (`RCD30_APPLIANCES`, schema.ts l. 99) ; depuis le 1/6/2023
   (`since2023` → `sinceDate`, l. 108-132) socle « général » (un socle dont le seul enfant est un appareil est considéré
   dédié) ou point lumineux. Seuil : `minRcd <= 30` (`RCD_HIGH_SENSITIVITY`). Sensibilité inconnue → inconnu ; sinon
   `presence(false, meta.survey.rcd30, isNew)`. Date inconnue en existant → question `R-RCD30-DATE` par tableau
   (l. 443) ; `sinceDate` : partie d'une édition antérieure → « non » ; puis `installedOn` / `rgie2023` du plus proche
   au plus lointain, date du projet, neuf → « oui », existant → « inconnu ». Nom de pièce évocateur seul →
   R-WETROOM-NAME (déduit). Catalogue l. 95 : non-conformité, élevée → bloquant aussi en existant (absence confirmée).
2. **Exigence** : les circuits du 5e alinéa (prises générales, éclairage, lieux avec baignoire ou douche, lave-linges,
   sèche-linges, lave-vaisselles) sont sous un différentiel ≤ 30 mA ; prises et éclairage seulement pour les
   installations entamées à partir du 1/6/2023. Vérifié, sauf l'emplacement « immédiatement en aval ».
3. **Références** : 4.2.4.3 b, 5e alinéa, p. 101 : « au moins un dispositif […] à haute ou très haute sensibilité est
   placé auquel sont raccordés au moins les circuits suivants » ; 2.6.4, p. 34 (haute sensibilité « au plus égal à
   30 mA en courant alternatif ») ; dérogations 6.5.8.1, 1, p. 207 (« entamée avant le 01/06/2023, de ne pas protéger les
   circuits visés aux points 1 et 2 ») ; 8.2.1, 16, p. 276 ; 8.2.2, 10, p. 278 ; transitoire 4.2.4.3 b, p. 101.
4. **Champ** : domestique ; neuf et existant ; tous réseaux et schémas.
5. **Exceptions** : 8e alinéa (différentiels supplémentaires à l'origine pour appareils fixes, socles sur transformateur
   de séparation individuel, autres circuits) ; socles destinés à des appareils fixes ou à poste fixe ; dérogations
   ci-dessus limitées aux points 1 et 2 ; « aussi d'application sur toute modification ou extension non-importante ».
6. **Dates** : points 3 et 4 : Livre 1 (et sans dérogation pour l'existant) ; points 1 et 2 : exécution entamée à partir
   du 01/06/2023 ; transitoire : projet **ou** travaux entamés avant le 01/06/2023 et contrôle après : dérogation
   possible, à déclarer à l'organisme agréé et mentionnée dans le rapport.
7. **Anciennes / mixtes** : un circuit ajouté avec `installedOn` ≥ 2023 dans un tableau ancien est soumis à la règle
   (correct). Mais la réponse `rgie2023: 'before'` du tableau s'applique à tous ses circuits, y compris un circuit
   ajouté plus tard sans `installedOn` (extension importante non distinguée d'une extension non importante).
8. **Faux positifs** : socle destiné à un appareil fixe non dessiné sous le socle (frigo, congélateur, chaudière) →
   signalé ; socles sur transformateur de séparation individuel (8e al., pt 2) ; transitoire non signalé à l'utilisateur
   quand la date du projet est postérieure mais les travaux antérieurs (ou l'inverse : la règle applique la dérogation
   d'office sur la seule date, sans rappeler qu'elle doit être déclarée à l'organisme agréé).
   **Faux négatifs** : (a) 10e alinéa (> 30 Ω : deux 30 mA au moins, 16 socles chacun, 100 mA pour les circuits du 8e
   alinéa) non implémenté (R-EARTH-30 n'est qu'un avertissement) ; (b) 9e alinéa (chauffage noyé : 100 mA séparé) non
   implémenté ; (c) « immédiatement en aval » du différentiel d'origine non vérifié (30 mA dans un sous-tableau éloigné
   accepté) ; (d) lave-linge identifié seulement par un nœud `appliance` typé (socle nommé « lave-linge » sans appareil
   dessiné non reconnu) ; (e) en relevé, circuit de salle de bain sous un 300 mA **dessiné** seulement → « inconnu », pas
   non conforme ; (f) un socle dont l'unique enfant est un appareil **mobile** est traité comme dédié.
9. **Données** : `wetRoom`, `applianceType`, enfants des socles, nœuds `light`, sensibilités, `installedOn`,
   `rgie2023`, `meta.installationDate`, `meta.installationKind`, `meta.survey.rcd30`.
10. **Tests** : `rules.matrix.test.ts` > « salle de bain indiquée et protégée par un 30 mA : conforme », « salle de bain
    indiquée sans 30 mA : non conforme », « nom évocateur sans indication… », « 30 mA, local humide indiqué : relevé sans
    30 mA dessiné → inconnu ; absence confirmée → non conforme », « 30 mA : sensibilité reprise d'une photo et non
    confirmée → anomalie potentielle », « question « contradiction » ouverte… », « neuf : prises et éclairage sous le
    300 mA seul → non conforme, raison indiquée », « dérogation : installation commencée avant le 1/6/2023 → pas de
    constat », « existant sans date : question sur le tableau… », « prise dédiée à un appareil fixe (frigo)… », les
    trois tests « existant sans date : question… », et les corrections « circuit de prises hors 30 mA… », « 30 mA déjà
    plein… ». Manquent : lave-linge / sèche-linge / lave-vaisselle (raison appareil) en neuf et dans une partie d'avant
    1981 (doit rester exigé) ; salle de bain dans une installation de 1975 (exigé) ; limite 30 / 31 mA ; prises et
    éclairage dans une partie 1981-2020 (dérogation 8.2.2) ; circuit 2024 dans un tableau `rgie2023: 'before'` ;
    partie d'avant 1981 avec prises (dérogation 8.2.1).
11. **Limites** : pas de résistance de terre liée à la règle ; pas de notion d'appareil fixe vs mobile ; pas de champ
    « transformateur de séparation » ; pas de distinction modification importante / non importante ; date unique
    (`installationDate`) sans « date du projet » vs « date des travaux ».
12. **Classification** : Exigence RGIE vérifiée.
13. **Verdict** : corriger : (a) en relevé, sensibilité connue > 30 mA dessinée seule → non conforme (ou potentiel), pas
    inconnu ; (b) signaler (`manualCheck`, non bloquant) l'application de la dérogation transitoire du 1/6/2023 pour une
    installation neuve datée d'avant, en rappelant l'information de l'organisme agréé ; (c) ajouter les tests manquants ;
    (d) créer à part une règle pour le 10e alinéa (> 30 Ω) et le 9e (100 mA chauffage noyé), à faire valider.

## R-RCD30-MAX

1. **Implémentation** : `rgie.ts` l. 454-463 : pour chaque différentiel de sensibilité connue ≤ 30 mA, compte des
   circuits terminaux (`isCircuit`) **dans tout son sous-arbre** (`collect(rcd.children)`) ; > 8
   (`CIRCUITS_PER_RCD30_MAX`) et `since2023` du différentiel = oui → constat ; inconnu → question R-RCD30-DATE.
   Catalogue l. 96 : non-conformité, gravité moyenne → neuf : non conforme bloquant ; existant : recommandation.
2. **Exigence** : au plus 8 circuits terminaux par différentiel haute sensibilité du 5e alinéa. Vérifié, mais appliqué à
   **tout** différentiel ≤ 30 mA.
3. **Références** : 4.2.4.3 b, 6e alinéa, p. 101 : « Il est autorisé de placer au maximum 8 circuits terminaux par
   dispositif de protection à courant différentiel-résiduel mentionné ci-avant. » ; dérogations 6.5.8.1, 1, p. 207
   (« de laisser en service plus de huit circuits terminaux ») ; 8.2.1, 16, p. 276 ; 8.2.2, 10, p. 278.
4. **Champ** : domestique, différentiels du 5e alinéa ; neuf, et existant exécuté à partir du 1/6/2023.
5. **Exceptions** : différentiels supplémentaires placés à l'origine (8e alinéa : « Les prescriptions du 5ème alinéa ne
   sont pas d'application ») : un 30 mA supplémentaire à l'origine pour des appareils fixes n'est pas, littéralement, un
   « dispositif mentionné ci-avant » ; dérogations ci-dessus.
6. **Dates** : exécution entamée à partir du 01/06/2023 ; même transitoire que R-RCD30.
7. **Anciennes / mixtes** : la date est lue sur la chaîne du **différentiel**, pas sur les circuits : un 9e circuit
   ajouté en 2024 (avec `installedOn`) sous un 30 mA de 2021 n'est pas signalé.
8. **Faux positifs** : 30 mA supplémentaire à l'origine (8e alinéa) alimentant plus de 8 circuits d'appareils fixes ;
   circuits comptés deux fois de suite pour des différentiels emboîtés (le différentiel amont compte aussi ceux d'un
   30 mA aval : lecture littérale « circuits terminaux par dispositif », à confirmer). **Faux négatifs** : extension après
   2023 décrite ci-dessus ; différentiel de sensibilité inconnue (pas de constat ni de question).
9. **Données** : arbre, `residualCurrent`, dates.
10. **Tests** : `rules.matrix.test.ts` > « au plus 8 circuits par 30 mA : 8 acceptés, 9 refusés ; dérogation avant le
    1/6/2023 », « réponse « après » : règles 30 mA appliquées… » (indirect), correction « 30 mA déjà plein (8 circuits) ».
    Manquent : existant daté après 2023 (statut attendu) ; 30 mA supplémentaire à l'origine ; différentiels emboîtés ;
    partie 1981-2020 (dérogation 8.2.2) ; 9e circuit ajouté après 2023.
11. **Limites** : le modèle ne distingue pas un différentiel « du 5e alinéa » d'un différentiel « supplémentaire à
    l'origine ».
12. **Classification** : Exigence RGIE vérifiée.
13. **Verdict** : corriger : (a) source du paramètre `CIRCUITS_PER_RCD30_MAX` : p. 101 et non p. 100 ; (b) partie
    existante exécutée après le 1/6/2023 : non conforme non bloquant (`existing: 'nonCompliant'` avec gravité moyenne)
    plutôt que recommandation, à faire confirmer ; (c) dater aussi par circuit (le plus récent des circuits comptés) ;
    (d) 30 mA placé directement à l'origine sans circuit du 5e alinéa : `manualCheck` au lieu de non-conformité. Tests
    correspondants.

## R-RCD-TYPE-A

1. **Implémentation** : `rgie.ts` l. 299 : tout différentiel (`isRcd`) avec `rcdType === 'AC'` → constat ; type absent →
   rien. Catalogue l. 98 : non-conformité, moyenne, `existing: 'recommendation'`, article 5.3.5.3 a vérifié le
   2026-11-27 → neuf : non conforme bloquant ; existant (y compris 2020+ ou d'avant 1981) : recommandation non bloquante.
2. **Exigence** : tout différentiel d'une installation domestique est au moins de type A. Vérifié pour la valeur AC
   saisie.
3. **Référence** : 5.3.5.3 a, p. 168 : « Les dispositifs de protection à courant différentiel-résiduel placés dans les
   installations domestiques sont au moins du type A ».
4. **Champ** : domestique ; tout différentiel (général, 30 mA, disjoncteur différentiel) ; tous réseaux.
5. **Exceptions** : **aucune dérogation trouvée** pour le type A dans 8.2.1, 2 (p. 273), 8.2.2, 2 (p. 277) ni 6.5.8.1
   (p. 207) ; le point 1 de 8.2.1 et 8.2.2 exige des caractéristiques conformes au Livre 1. La « recommandation » en
   existant n'a donc pas de base dans le texte lu (question 2 du dossier de validation, en attente).
6. **Dates** : Livre 1 (1/6/2020) ; exigences de l'ancien RGIE sur le type des différentiels non vérifiables ici.
7. **Anciennes / mixtes** : même statut pour toute partie existante, quelle que soit sa date.
8. **Faux positifs** : aucun pour la valeur AC saisie (l'option `AC` n'a pas de valeur par défaut). **Faux négatifs** :
   type non renseigné → aucun constat, ni documentaire (3.1.2.2 a demande « le type et les caractéristiques » des
   différentiels ; « type » peut viser le type A/AC ou la nature de l'appareil, à confirmer) ; 5.3.5.3 f (composantes
   continues : type B ou mesure équivalente pour certains matériels, ex. bornes de recharge) non couvert.
9. **Données** : `props.rcdType` (AC, A, F, B).
10. **Tests** : `rules.rgie2026.test.ts` > « différentiel général de type AC dans une installation neuve : non
    conforme… », « type A, F ou B : rien ; type non renseigné : pas de constat inventé », « installation existante :
    recommandation, non bloquante… ». Manquent : disjoncteur différentiel AC ; partie d'avant 1981 ; partie existante
    exécutée après 2020 ; correction « type A » (`fixes.ts` l. 84-85) non testée.
11. **Limites** : pas de champ « type non lisible » distinct de « non saisi ».
12. **Classification** : Exigence RGIE vérifiée.
13. **Verdict** : corriger : en partie existante, statut « non conforme » non bloquant (`existing: 'nonCompliant'`,
    gravité moyenne → non bloquant par `classify`) tant qu'un spécialiste n'a pas identifié une dérogation ; adapter le
    test « installation existante » ; type non renseigné : émettre R-RCD-TYPE-A avec `knowledge: 'unknown'` (ADR-0007 :
    « valeur non renseignée » = inconnu) → `classify` donne « Informations insuffisantes », bloquant en conception (comme
    R-RCD-SENS-MISSING), non bloquant en relevé ; jamais le silence (voir contre-audit, point a).

## R-RCD-HEAD-RATING

1. **Implémentation** : `rgie.ts` l. 300-308 : différentiel sans différentiel ancêtre (`!upRcd`) de calibre connu
   < 40 A (`RCD_HEAD_MIN_RATING`) ; `executedSince(…, 1991-09-16)` (l. 194-204 : partie d'édition `pre1981` → non ;
   `installedOn` du plus proche au plus lointain puis `meta.installationDate` ; neuf sans date → oui ; existant sans
   date → inconnu) : oui → constat ; inconnu → `manualCheck`. Catalogue l. 99 : non-conformité, moyenne,
   `existing: 'recommendation'`.
2. **Exigence** : le différentiel placé en tête a une intensité nominale ≥ 40 A, sauf dérogations de la partie 8.
   Vérifié pour le cas courant ; la notion de « tête » est approximée.
3. **Références** : 5.3.5.3 a, p. 168 : « ceux qui sont placés en tête de l'installation électrique ont une intensité
   nominale au moins égale à 40 A » ; 8.2.1, 2, p. 273 (« d'une intensité nominale inférieure à 40 A », sans date) ;
   8.2.2, 2, p. 277 (« pour les installations électriques dont l'exécution sur place a été entamée avant le 16
   septembre 1991 »).
4. **Champ** : domestique ; tous réseaux.
5. **Exceptions** : 8.2.1 (toute partie d'avant le 1/10/1981) ; 8.2.2 (installation ancien RGIE **ayant fait l'objet
   d'un examen de conformité**, exécution entamée avant le 16/9/1991). Aucune pour 6.5.8.1. Le marquage « 3000 A,
   22,5 kA²s » (5.3.5.5 e, p. 171) a ses propres dérogations (8.2.1 ; 8.2.2 avant le 7/5/2000 ou NBN 819), non
   modélisées.
6. **Dates** : 16/09/1991 (ancien RGIE, via 8.2.2) ; Livre 1 ensuite.
7. **Anciennes / mixtes** : date lue sur la chaîne du différentiel. Un différentiel de moins de 40 A **remplacé** après
   1991 dans une installation d'avant 1991 bénéficie de la dérogation (le texte dit « laisser en service » : un appareil
   neuf est-il couvert ? question) ; partie existante exécutée après le 16/9/1991 : constat présenté comme
   recommandation alors qu'aucune dérogation ne s'applique.
8. **Faux positifs** : calibre **par défaut** 20 A (différentiel créé dans l'interface ou importé de Volter sans
   ampérage) ; disjoncteur différentiel (`rcbo`) de 16 ou 20 A sans différentiel en amont (son calibre est celui du
   circuit ; est-il « en tête de l'installation » ?) ; différentiel d'un sous-tableau sans différentiel amont (le
   défaut est alors le 300 mA manquant, déjà signalé par R-RCD-MAIN). **Faux négatifs** : différentiel de tête de
   calibre inconnu (aucun constat ; R-PROT-RATING-MISSING ne le signale que si le défaut de 20 A a été retiré) ;
   condition « examen de conformité » de 8.2.2 non vérifiée.
9. **Données** : `ratedCurrent`, arbre, `installedOn`, `oldPart`, `meta.installationDate`, `meta.installationKind`.
10. **Tests** : `rules.rgie2026.test.ts` > « différentiel général de 25 A : non conforme ; 40 A et 63 A : conformes »,
    « un différentiel en aval (30 mA de 25 A) n'est pas concerné », « dérogations 8.2.1 / 8.2.2 : exécution avant le
    16/9/1991 → rien ; à partir de cette date → signalé ; date inconnue → vérification », « calibre inconnu : pas de
    constat… » ; catalogue : « R-RCD-HEAD-RATING existe, avec ses textes dans les 4 langues ». Manquent : statut exact en
    existant 2005 (le test ne vérifie que `blocking: false`) ; `oldPart: true` ; disjoncteur différentiel sans amont ;
    différentiel créé par `createNode` sans calibre saisi ; limite 39 / 40 A ; partie neuve datée d'avant 1991.
11. **Limites** : pas de notion d'« origine » ; pas de champ « examen de conformité ancien RGIE » ; pas de marquage.
12. **Classification** : Exigence RGIE vérifiée.
13. **Verdict** : corriger : (a) partie existante exécutée à partir du 16/9/1991 : non conforme non bloquant
    (`existing: 'nonCompliant'`) ; (b) limiter la règle aux appareils `rcd` (disjoncteur différentiel sans amont →
    `manualCheck`) ; (c) ne pas conclure sur un calibre par défaut (voir R-PROT-RATING-MISSING) ; tests correspondants.

---

## Points du contre-audit externe (vérifiés indépendamment)

### a. Différentiel de type inconnu

Vérifié : `rgie.ts` l. 299 ne réagit qu'à `rcdType === 'AC'` ; un type absent ne produit **aucun** constat, et aucune
autre règle ne le signale (le test « type A, F ou B : rien ; type non renseigné : pas de constat inventé » fige ce
silence). ADR-0007 (tableau des états) range « valeur non renseignée » dans `unknown`. Comportement attendu :
conception → « Informations insuffisantes », bloquant (le projet doit dire quel type sera posé ; même régime que
R-RCD-SENS-MISSING) ; relevé → « Informations insuffisantes », non bloquant, avec une question (type lu sur l'appareil).
Ne pas conclure « non conforme ». Mise en œuvre la plus simple : `add('R-RCD-TYPE-A', nc, id, undefined, { knowledge:
'unknown' })` quand `rcdType` est vide (texte `.unknown` dans les 4 langues), plutôt qu'une nouvelle règle documentaire :
l'exigence porte sur l'appareil (physique) et 3.1.2.2 a demande de toute façon « le type et les caractéristiques » des
différentiels sur l'unifilaire. Le test cité doit être remplacé (type absent → `insufficientData`, `knowledge:
'unknown'`, bloquant en neuf, non bloquant en existant).

### b. Sélectivité en sensibilité et sélectivité temporelle

- Le moteur ne vérifie que l'ordre des **sensibilités** : constat si IΔn aval ≥ IΔn amont (`rgie.ts` l. 293-295). Il
  ne vérifie aucune sélectivité **temporelle** et ne le peut pas : `rcdType` n'offre ni « S » ni retard (schema.ts
  l. 111).
- Une sensibilité aval plus faible (30 mA sous 300 mA) ne garantit la sélectivité que pour les défauts de faible
  intensité ; pour un défaut franc, deux appareils instantanés peuvent déclencher ensemble. La sélectivité totale
  demande en plus un appareil amont retardé ou de type S (rapport de sensibilités et retard : règles des normes, non
  accessibles ici).
- Le RGIE (Livre 1) n'impose la sélectivité qu'aux circuits de sécurité (5.5.7, p. 186) et critiques (5.6.2.4 a,
  p. 191). Le retard n'est traité qu'au tableau 4.9 (4.3.3.6 d, p. 114) comme **limite** dans les lieux à risque
  d'incendie (BE3 : non retardé). Un différentiel retardé n'est donc pas libre partout : dans un lieu BE3, il serait
  contraire au tableau 4.9.
- Conséquence : R-RCD-SELECTIVITY reste une bonne pratique, jamais une exigence RGIE ; message et conseil à corriger
  (ne pas dire que 30 mA sous 300 mA « fait » la sélectivité ; mentionner le type S / retardé en amont et la limite du
  tableau 4.9 en lieu à risque d'incendie). Ajouter au modèle une option « S / retardé » serait nécessaire pour toute
  vérification temporelle, et utile aussi à R-RCD-TRIP (branche 500 ms aujourd'hui inatteignable).

### c. Régime « existant » : dérogations réellement applicables, règle par règle

Rappel du mécanisme : `classify` (context.ts l. 118-126) donne en partie existante `rule.existing`, sinon
« non conforme » si gravité élevée, sinon « recommandation » ; bloquant seulement si non conforme **et** gravité
élevée. Les dérogations par date sont, elles, appliquées dans `rgie.ts` (le constat n'est pas émis), ce qui est la bonne
place : le régime `existing` ne devrait servir qu'aux cas **sans** dérogation.

| Règle | Dérogation applicable (conditions exactes) | Où elle est appliquée aujourd'hui | Régime actuel en existant | Régime proposé |
|---|---|---|---|---|
| R-PROT-RATING-MISSING | aucune pour les caractéristiques : 8.2.1, 7 (p. 274) les exige sur le schéma simplifié ; 8.2.2, 7 (p. 278) tolère seulement l'absence du « type » | — | info insuffisante, non bloquant | inchangé (documentaire) |
| R-POLES-NO-NEUTRAL | aucune (8.2.1 / 8.2.2, point 1 : caractéristiques conformes au Livre 1) | — | non conforme, bloquant | inchangé ; mais `manualCheck` tant que l'absence de neutre ou les pôles ne sont pas établis |
| R-PROT-KA-MISSING | marquage classe 3 : 8.2.1, 3 (p. 273, sans date) ; 8.2.2, 3 (p. 277, exécution avant le 31/12/2007) — concerne la valeur, pas la donnée | — | info insuffisante, jamais bloquant | inchangé |
| R-RCD-SENS-MISSING | aucune (caractéristiques exigées par 8.2.1, 7) | — | info insuffisante, non bloquant | inchangé |
| R-RCD-SELECTIVITY | sans objet (pas d'exigence) | — | avertissement | recommandation partout |
| R-RCD-MAIN | aucune sur la présence du ≤ 300 mA ; seul le sectionnement est dérogé (8.2.1, 2 sans date ; 8.2.2, 2 avant le 2/7/2003) | — | non conforme, bloquant | inchangé |
| R-RCD30 | points 1 et 2 (prises, éclairage) seulement : 6.5.8.1, 1 (p. 207 : parties 2020+ contrôlées, exécution avant le 01/06/2023) ; 8.2.1, 16 (p. 276, avant 1/10/1981, sans date limite) ; 8.2.2, 10 (p. 278, ancien RGIE avec examen de conformité, sans date limite) ; extension aux modifications non importantes ; transitoire 4.2.4.3 b (p. 101). Points 3 et 4 (bain/douche, lave-linge, sèche-linge, lave-vaisselle) : aucune | `since2023` (édition antérieure → non ; date < 1/6/2023 → non) | non conforme, bloquant | inchangé ; la condition « examen de conformité » (8.2.2) et « contrôle de conformité » (6.5.8.1) n'est pas vérifiée : à documenter |
| R-RCD30-MAX | mêmes textes, 6e alinéa : 6.5.8.1, 1 (avant le 01/06/2023) ; 8.2.1, 16 ; 8.2.2, 10 | `since2023` | **recommandation** (gravité moyenne) | `existing: 'nonCompliant'` : un constat émis en existant concerne une partie exécutée après le 1/6/2023, sans dérogation ; bloquant ou non selon la gravité retenue (moyenne → non bloquant) |
| R-RCD-TYPE-A | **aucune** dans 8.2.1, 8.2.2, 6.5.8.1 | — | **recommandation** | `existing: 'nonCompliant'` (non bloquant avec gravité moyenne), à confirmer (question 2 du dossier de validation) |
| R-RCD-HEAD-RATING | 8.2.1, 2 (p. 273 : parties d'avant le 1/10/1981, sans date limite) ; 8.2.2, 2 (p. 277 : installation ancien RGIE ayant fait l'objet d'un examen de conformité, exécution entamée avant le 16/9/1991) ; aucune pour 6.5.8.1 | `executedSince` | **recommandation** | `existing: 'nonCompliant'` : le constat n'est émis qu'après le 16/9/1991, donc sans dérogation (non bloquant avec gravité moyenne) |

Les trois règles à régime « recommandation » du lot (R-RCD30-MAX par défaut, R-RCD-TYPE-A et R-RCD-HEAD-RATING
explicitement) abaissent donc une non-conformité que le texte ne dispense pas. La question de savoir si ces constats
doivent **bloquer** un dossier de réception en existant reste une décision de Voltaplan (ADR-0002), à faire valider ;
le statut, lui, devrait être « non conforme ».
