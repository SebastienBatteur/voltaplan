> Annexe du rapport `docs/audit/REGISTRE-RGIE-2026.md`. Document de travail de l’audit (27/11/2026), écrit sur le moteur **avant** les corrections de la branche `regulatory-registry` : les constats corrigés depuis sont listés dans le rapport. Les chemins `scratchpad/…` désignent des fichiers de travail non versionnés (extrait texte du RGIE, sondes).

# Audit des règles — lot g4 (canalisations, prises, circuits dédiés, calculs)

Dépôt audité : `wt-engine` (branche `regulatory-registry`), lecture seule. Texte de référence : RGIE Livre 1, version 07
du 15/09/2026 (`livre1.txt`) ; numéros de page = pieds de page imprimés (« … | 117 »). Les normes NBN / EN / IEC ne sont
pas accessibles : toute valeur qui en vient est signalée comme **non vérifiée**.

Fichiers : `src/rules/be/rgie.ts` (logique), `src/rules/be/catalog.ts` (fiches), `src/rules/context.ts` (classement),
`src/calc/electrical.ts` + `docs/calc.md` (calculs), `src/model/schema.ts` (propriétés), `src/i18n/fr.ts` (textes).

## Constats transversaux (valent pour plusieurs règles du lot)

1. **« Existant » ne distingue pas les éditions.** `classify` (context.ts l. 118-125) applique le statut `existing` du
   catalogue (souvent « recommandation ») à toute partie non neuve, y compris une partie réalisée **après le 1/6/2020**
   (édition en vigueur, `installationKind: 'existing'`). Or les dérogations qui justifient cette indulgence (8.2.1,
   8.2.2 : > 8 socles, circuits non dédiés, sections < 2,5 mm², socles d'avant le 1/3/2025) ne visent que les parties
   d'avant le 1/10/1981 ou de 1981-2020 ; 6.5.8.1 (parties réalisées depuis le 1/6/2020) n'en contient aucune pour les
   socles en surnombre, les circuits dédiés, la terre des socles ou les sections. Concerne R-SOCKET-MAX,
   R-DEDICATED-CIRCUIT, R-SOCKET-SECTION, R-SOCKET-IPXXD, R-SOCKET-CHILD. Correction proposée : n'appliquer `existing`
   que si `ctx.edition` est `pre1981` ou `1981` (ou si une dérogation datée s'applique) ; une partie existante de
   l'édition `2020` garde « non conforme » (bloquant selon la gravité).
2. **Aucune distinction domestique / non domestique** dans le modèle (`ProjectMeta` n'a pas ce champ). Le tableau 4.11,
   5.3.5.2 b (terre des socles, 8 socles), la liste des circuits dédiés de 5.2.1.2 ne valent que pour les installations
   domestiques. Toutes les règles du lot supposent une installation domestique.
3. **Schéma de liaison à la terre** (`meta.earthing`) jamais lu par ces règles (sans effet pour elles, sauf
   R-ICC-LMAX : boucle de défaut TN / IT non calculée, voir docs/calc.md).
4. **Circuits TBT / de commande non identifiés.** Le modèle n'a ni propriété « TBTS » ni « circuit de commande » ; les
   câbles sous un `transformer` (sonnerie, TBT) ou d'un bus domotique sont traités comme des canalisations BT :
   faux positifs R-CABLE-MIN, R-CABLE-PROT, R-SOCKET-SECTION.

---

## R-CABLE-SECTION-MISSING

1. **Implémentation** : rgie.ts l. 309-320. Pour chaque `cable` dont le parent est absent, une `protection`, un
   `board`, un `meter` ou une `origin` (`isStart`), hors côté continu PV (`dcSide` : ancêtre `inverter`, `solarPanel`,
   `battery`) : si `section` n'est pas un nombre **et** que `cableType` ou `conductors` est renseigné →
   R-CABLE-SECTION-MISSING. Catalogue (catalog.ts l. 96) : `missingData`, gravité `medium`, exigence documentaire.
   Classement : « Informations insuffisantes », bloquant en partie neuve, non bloquant en existant ; jamais « non
   conforme » (documentaire).
2. **Exigence** : la section des canalisations figure sur le schéma unifilaire. C'est bien ce qui est vérifié, mais
   seulement pour le premier câble d'un départ.
3. **Référence** : 3.1.2.2 a, p. 64 : « les caractéristiques des canalisations électriques: type, section, nombre des
   conducteurs; ». Parties anciennes : 8.2.1 point 7, p. 275 : « le type et la section des différents départs; ».
4. **Champ** : installations domestiques (3.1.2.2 a) ; tous réseaux et schémas ; neuf et existant.
5. **Exceptions** : 8.2.1 point 7 (schémas simplifiés, la section des départs reste exigée) ; 8.2.2 point 7 ne dispense
   pas de la section.
6. **Dates** : aucune date propre dans le texte 2026 ; `effectiveFrom` inconnu (provision du Livre 1, en vigueur depuis
   le 1/6/2020 selon 6.5.8 ; texte antérieur non consulté).
7. **Anciennes / mixtes** : non bloquant pour une partie existante, quelle que soit l'époque : cohérent.
8. **Faux positifs / négatifs** : FN — câble en aval d'une boîte, d'une prise ou d'un interrupteur sans section (réputé
   « hériter » du départ ; une réduction de section non dessinée passe inaperçue) ; FN — câbles côté continu PV
   (3.1.2.3 pour le PV non examinée ici). FP : aucun identifié.
9. **Données** : `cable.section`, `cableType`, `conductors`, `parent.kind`. Manquante → constat documentaire (jamais
   « conforme »).
10. **Tests** : `rules.matrix.test.ts > relevé : section inconnue → vérification nécessaire (physique) et schéma
    incomplet (documentaire)` ; `> conception : section inconnue → donnée manquante bloquante seulement`. Manquants :
    câble non initial sans section ; câble DC ; partie pre1981 (non bloquant).
11. **Limites** : pas de notion de « départ » distincte du premier câble.
12. **Classification** : Exigence RGIE vérifiée (documentaire).
13. **Verdict** : garder. Suggestion : fusionner avec R-CABLE-DATA-MISSING en une règle « caractéristiques de la
    canalisation incomplètes » (voir ci-dessous).

## R-CABLE-DATA-MISSING

1. **Implémentation** : rgie.ts l. 320, même branche que ci-dessus : section absente **et** ni `cableType` ni
   `conductors` → R-CABLE-DATA-MISSING. Catalogue l. 97 : `missingData`, `medium`, documentaire. Même classement.
2. **Exigence** : type, section et nombre de conducteurs sur le schéma. **Partiellement vérifiée** : la règle ne se
   déclenche que si la section manque ; un câble avec section mais sans type (ou sans nombre de conducteurs) ne donne
   rien. Le mode de pose, également exigé par 3.1.2.2 a, n'est pas contrôlé (la propriété `method` a une valeur par
   défaut).
3. **Référence** : 3.1.2.2 a, p. 64 : « les caractéristiques des canalisations électriques: type, section, nombre des
   conducteurs; » et « le mode de pose des canalisations électriques; ».
4. **Champ** : domestique, tous réseaux, neuf et existant.
5. **Exceptions** : 8.2.1 point 7 (p. 275 : seuls « le type et la section des différents départs » sont exigés) ;
   8.2.2 point 7 (p. 278) tolère l'absence du type des **dispositifs de protection**, pas celle des câbles.
6. **Dates** : non déterminable depuis le texte 2026.
7. **Anciennes** : non bloquant en existant ; pour une partie pre1981 le nombre de conducteurs n'est pas exigé
   (8.2.1 point 7) — la règle ne le distingue pas, mais elle ne se déclenche que sans section, donc sans effet notable.
8. **FP / FN** : FN — `cableType` absent avec section connue (type exigé) ; FN — `conductors` absent ; FN — mode de
   pose. FP : aucun.
9. **Données** : `section`, `cableType`, `conductors` (et `method` non lu). Valeur absente → constat documentaire.
10. **Tests** : aucun test nominatif de R-CABLE-DATA-MISSING trouvé (seulement listée dans
    `regulatory-consistency.test.ts` l. 117). Manquants : câble sans aucune donnée ; câble avec section sans type ;
    partie pre1981.
11. **Limites** : la valeur par défaut `cableType: 'VOB'` / `conductors: 3` du schéma rend la règle inopérante pour les
    câbles créés dans l'éditeur ; elle sert surtout aux imports.
12. **Classification** : Exigence RGIE vérifiée (documentaire).
13. **Verdict** : corriger — déclencher sur chaque donnée manquante (`cableType`, `conductors`, section) indépendamment,
    avec la liste des données manquantes en paramètre ; pour une partie pre1981 n'exiger que type et section. Tests :
    section seule, type seul, conducteurs seuls, pre1981 sans conducteurs (pas de constat).

## R-CABLE-MIN

1. **Implémentation** : rgie.ts l. 321-322 : tout `cable` non DC dont `section < 1.5` → R-CABLE-MIN (params
   `section`). Catalogue l. 98 : `nonCompliance`, gravité `high`, physique, pas de statut `existing`. Classement : neuf →
   non conforme bloquant ; existant (toute édition) → non conforme **bloquant** (gravité élevée).
2. **Exigence revendiquée** : section minimale 1,5 mm². Le RGIE pose en réalité un minimum de **2,5 mm²** avec les
   exceptions du tableau 5.1 : 1,5 mm² (circuits sans socle), 0,75 mm² (circuits intégrés dans un tableau alimentant un
   socle simple), 0,5 mm² (circuits de commande, contrôle, signalisation, mesure). La règle ne vérifie que le seuil le
   plus courant et ignore les deux exceptions inférieures.
3. **Références** : 5.2.1.2, p. 129 : « l’emploi de conducteurs isolés d’une section inférieure à 2,5 mm² est
   interdite. » ; tableau 5.1, p. 129 : « Canalisations électriques appartenant à des circuits de commande, contrôle,
   signalisation et mesure. ». Les colonnes sont entremêlées dans l'extrait texte, mais le coordinateur a vérifié
   l'association à l'œil sur le rendu de la page PDF 141 (page imprimée 129, `audit/pages/p141.png`) : 1,5 mm² pour les
   circuits sans socle (sauf un socle unique de 2,5 A intégré dans un luminaire) ; 0,75 mm² pour les circuits intégrés
   dans un tableau qui alimentent un socle simple (protections adaptées à la section) ; 0,5 mm² pour les circuits de
   commande, contrôle, signalisation et mesure.
4. **Champ** : canalisations ne faisant pas partie d'un appareil ; tous types d'installations (5.2.1.2 n'est pas limité
   au domestique) ; tous réseaux.
5. **Exceptions** : tableau 5.1 (0,75 / 0,5 mm²) ; **8.2.1 point 5** (p. 274) : « les canalisations électriques dont les
   conducteurs isolés ont une section inférieure à 2,5 mm², mais au moins égale à 1 mm² » (1 mm² protégé par fusible
   ≤ 6 A ou disjoncteur ≤ 10 A / taille 12) ; **8.2.2 point 5** (p. 277-278) : EMCB / EMCVB 1 mm² et CTLB / VTLB 0,75 mm²
   dans des circuits sans socle, exécution entamée avant le 17 mai 1986.
6. **Dates** : pas de date propre ; dérogation 8.2.2 bornée au 17/5/1986.
7. **Anciennes / mixtes** : **faux positif bloquant** pour une partie d'avant 1981 en 1 mm² correctement protégée
   (dérogation 8.2.1 point 5), et pour les câbles 0,75 / 1 mm² d'avant le 17/5/1986 visés par 8.2.2.
8. **FP / FN** : FP — fil de sonnerie 0,5 / 0,8 mm² sous un transformateur ; câble bus domotique ; circuit de
   commande ; 1 mm² pre1981 sur 10 A. FN — aucun pour la règle telle qu'énoncée (le cas « 1,5 mm² sur circuit de
   prises » relève de R-SOCKET-SECTION).
9. **Données** : `section` ; manquante → pas de constat (R-CABLE-SECTION-MISSING couvre). Pas de propriété « circuit de
   commande / TBTS ».
10. **Tests** : `rules.matrix.test.ts > corrections en un clic > section des prises trop faible et câble sous 1,5 mm² :
    corrigées`. Manquants : 1,5 mm² pile (conforme) ; 1 mm² pre1981 + 10 A (dérogation) ; 1 mm² pre1981 + 16 A (non
    conforme) ; circuit de sonnerie 0,5 mm² ; 0,75 mm² 1985 CTLB.
11. **Limites** : pas de type de circuit (commande, signalisation), pas de TBTS, pas de date par câble.
12. **Classification** : Exigence RGIE vérifiée (seuil 1,5 mm² du tableau 5.1), avec exceptions manquantes.
13. **Verdict** : corriger — (a) exclure les câbles en aval d'un `transformer` et des éléments `bell` / `domotic`
    (ou ajouter une propriété « circuit de commande / signalisation ») et y appliquer 0,5 mm² ; (b) partie `pre1981` :
    1 mm² accepté si protection ≤ 6 A fusible / ≤ 10 A disjoncteur, sinon constat ; (c) partie `1981` avant le
    17/5/1986, circuit sans socle : 1 mm² (EMCB/EMCVB) et 0,75 mm² (CTLB/VTLB) acceptés ; (d) message : « minimum
    1,5 mm² pour un circuit sans prise (RGIE 5.2.1.2, tableau 5.1) ». Tests correspondants.

## R-CABLE-PROT

1. **Implémentation** : rgie.ts l. 27-58 (`TABLE_4_11`, `maxProtectionFor`) et l. 323-332. Pour chaque câble non DC
   de section connue : protection contre les surintensités la plus proche au-dessus (`device` ∈ mcb, rcbo, fuse) ;
   `max` = colonne fusible si `device === 'fuse'`, sinon disjoncteur ; section intermédiaire → ligne inférieure ;
   > 35 mm² → pas de maximum. `rating > max` → constat (params section, rating, max). En relevé (partie non neuve),
   départ alimentant des charges dont la section ou le calibre est inconnu → même règle avec `knowledge: 'unknown'`
   (« Informations insuffisantes », non bloquant). Catalogue l. 99 : `nonCompliance`, `high`, physique, article
   « 4.4.1.4 (tableau 4.11) », vérifié le 2026-11-27. Neuf et existant : non conforme bloquant.
2. **Exigence** : pour les installations domestiques, le calibre de la protection ne dépasse pas le maximum du tableau
   4.11 pour la section. Vérifié fidèlement (valeurs du tableau contrôlées : identiques au texte).
3. **Références** : 4.4.1.4, p. 117 : « Pour les installations domestiques, l'intensité nominale maximale des
   coupe-circuit à fusibles ou l’intensité maximale du disjoncteur qui protègent une canalisation électrique est donnée
   au tableau 4.11. » ; tableau 4.11, p. 117. Contexte : 4.4.1.4, p. 116 (IZ dépend « du mode de pose et de
   l’environnement des canalisations électriques ») ; 4.4.3.2, p. 118 : « leur courant nominal In doit être égal ou
   supérieur au courant d’emploi IB du circuit et inférieur au courant admissible IZ ».
4. **Champ** : installations **domestiques** seulement (le tableau ne vaut pas en non domestique : IZ « calculée
   conformément aux règles de l’art ») ; tous réseaux ; neuf et existant.
5. **Exceptions** : 4.4.3.3 (dispenses de protection contre les surcharges : appareil à protection incorporée, source
   limitée, dérivations protégées individuellement…) — non modélisées ; 4.4.3.4 (canalisations en parallèle : IZ =
   somme) — non modélisé. 8.2.1 point 5 (1 mm² ≤ 6 A / 10 A) est cohérent avec la ligne 1 mm² du tableau. Parties
   existantes : 8.2.1 / 8.2.2 point 1 exigent que les caractéristiques du matériel répondent « aux prescriptions des
   installations domestiques du présent Livre » : appliquer le tableau 4.11 à l'existant est défendable.
6. **Dates** : non déterminable depuis le texte 2026 (anciennes valeurs de Voltaplan corrigées en 2026, voir tests M1-M2).
7. **Anciennes / mixtes** : même tableau pour toutes les éditions ; non conforme bloquant en existant (gravité élevée).
8. **FP / FN** : FN (inhérent, documenté) — le tableau est un maximum ; mode de pose, groupement, température peuvent
   imposer moins (non calculé) ; FN — section > 35 mm² : **aucun constat**, ni vérification (silence) ; FP — câble 0,5 mm²
   sous un transformateur de sonnerie protégé en amont par 10-16 A (le secondaire est un autre circuit) ; FP possible —
   `method: 'parallel'` (si cela désigne des câbles en parallèle, 4.4.3.4) ; FP — appareil à protection incorporée
   (4.4.3.3) : rare en domestique.
9. **Données** : `cable.section`, protection amont `device`, `ratedCurrent` ; inconnu en relevé → « Informations
   insuffisantes » ; en conception → la donnée manquante (bloquante) suffit, pas de second constat.
10. **Tests** : `rules.rgie2026.test.ts > M1-M2 …` (6 tests : colonnes exactes, > 35 mm², section intermédiaire,
    fusibles limites, faux positifs corrigés 6/10/16 mm², disjoncteurs juste au-dessus, message) ;
    `rules.matrix.test.ts > câble 2,5 mm² protégé par 25 A : non conforme, bloquant, danger élevé`, `> limite : 20 A sur
    2,5 mm² est accepté, 21 A ne l’est pas`, `> existante : une règle de sécurité reste non conforme et bloquante`,
    `> date de réalisation : 1995 → édition 1981, 2022 → Livre 1`, dérogations (3 tests), `> relevé : section inconnue
    …`, `> calibre trop grand pour la section : « Choisir 20 A » …`. Manquants : rcbo (colonne disjoncteur) ; câble aval
    à section réduite sous la même protection ; câble sous transformateur ; > 35 mm² (attendu : vérification) ;
    partie pre1981 1 mm² + 10 A (conforme).
11. **Limites** : pas de courant admissible IZ, pas de mode de pose exploité, pas de domestique / non domestique.
12. **Classification** : Exigence RGIE vérifiée.
13. **Verdict** : corriger (mineur) — (a) section > 35 mm² : constat `manualCheck` « courant admissible à vérifier selon
    les règles de l'art (4.4.1.4) » au lieu du silence ; (b) ignorer les câbles en aval d'un `transformer` ; (c)
    clarifier `method: 'parallel'`. Tests : 50 mm² + 160 A → vérification ; sonnerie → rien ; rcbo 2,5 mm² 25 A → non
    conforme.

## R-CABLE-NO-OVERCURRENT

1. **Implémentation** : rgie.ts l. 333-338. Câble non DC alimentant des charges (`feedsLoads`), avec **au moins une**
   `protection` au-dessus mais **aucune** de type mcb / rcbo / fuse → constat ; si une protection amont a `device`
   vide → `knowledge: 'unknown'`. Catalogue l. 100 : `nonCompliance`, `high`, physique. Neuf et existant : non
   conforme bloquant ; inconnu → « Informations insuffisantes » (bloquant en neuf).
2. **Exigence** : tout circuit est protégé contre les surintensités (courts-circuits et surcharges) à son origine ; un
   interrupteur différentiel seul ne suffit pas. Vérifié pour le cas « seulement différentiel / interrupteur au-dessus ».
3. **Références** : 4.4.2.2 a, p. 117 : « Un dispositif de protection contre les courts-circuits est placé à l’origine
   de tout circuit constitué de canalisations électriques ayant des caractéristiques équivalentes. » ; 4.4.3.1, p. 118
   (protection contre les surcharges) ; 4.4.4.1, p. 119 : « Une détection de surintensité est prévue sur tous les
   conducteurs de ligne. ».
4. **Champ** : toutes installations ; tous réseaux.
5. **Exceptions** : 4.4.2.2 a, 2e alinéa (protection amont qui « puisse encore assurer sa fonction ») ; 4.4.2.2 b
   (dispositif jusqu'à 3 m de l'origine ; dispense pour liaisons courtes génératrice / transformateur / batterie →
   tableau) ; 4.4.3.3 (dispenses de protection contre les surcharges). Aucune n'est modélisée ; seule la liaison
   batterie / PV côté DC est exclue.
6. **Dates** : non déterminable.
7. **Anciennes** : même traitement.
8. **FP / FN** : **FN important** — câble alimentant des charges directement sous un `board` sans aucune protection
   (`anyProtection` faux) : aucun constat, et le câble n'étant pas un « circuit » (`isCircuit` exige une protection),
   aucune autre règle ne le voit ; FN — liaison compteur → tableau non protégée (supposée protégée par le GRD) ; FP —
   liaison batterie → onduleur côté AC ou cas 4.4.2.2 b ; doublons : un constat par câble du circuit (chaque tronçon).
9. **Données** : `protection.device` des ancêtres, enfants du câble ; appareil inconnu → inconnu (correct, ADR-0007).
10. **Tests** : `rules.matrix.test.ts > protection amont de nature inconnue : protection contre les surintensités
    inconnue, pas absente`. Manquants : différentiel seul au-dessus d'un circuit de prises (non conforme) ; câble
    directement sous un tableau sans protection ; dédoublonnage par circuit ; existant.
11. **Limites** : l'origine du réseau (protection du GRD) n'est pas modélisée.
12. **Classification** : Exigence RGIE vérifiée.
13. **Verdict** : corriger — (a) signaler aussi un câble alimentant des charges dont le parent (direct ou via des boîtes)
    est un `board` sans aucune protection entre les deux ; (b) un seul constat par départ (premier câble), pas par
    tronçon. Tests : différentiel seul → non conforme ; tableau → câble → prise sans protection → non conforme ;
    compteur → câble → tableau → rien.

## R-SOCKET-EARTH

1. **Implémentation** : rgie.ts l. 345-348 : `socket` avec `earth === false` → constat `knowledge: 'absent'` (une
   valeur reprise d'une photo devient « déduite » par le mécanisme de provenance). Valeur absente = symbole par défaut
   « avec terre » → rien. Catalogue l. 102 : `nonCompliance`, `high`, physique, pas de statut `existing`. Neuf et
   existant (toute édition) : non conforme bloquant.
2. **Exigence** : dans une installation domestique, tout socle BT comporte un contact de terre relié au conducteur de
   protection. Vérifié pour la seule information « sans terre ».
3. **Références** : 5.3.5.2 b, p. 167 : « Les socles de prise de courant, à l’exception de ceux à TBTS, comportent tous
   un contact de terre relié au conducteur de protection de la canalisation électrique » ; exception : « sauf si le socle
   de prise de courant est alimenté à travers un transformateur de séparation des circuits individuel ».
4. **Champ** : installations domestiques ; tous réseaux.
5. **Exceptions** : TBTS ; transformateur de séparation individuel (prise rasoir : `socketKind: 'shaver'`) ;
   **8.2.1 point 6 b** (p. 274-275) : parties d'avant le 1/10/1981, socles sans contact de terre « du fait que la
   canalisation électrique est sans conducteur de protection », à condition d'être protégés par un différentiel
   « à haute ou très haute sensibilité » (≤ 30 mA, définitions p. 34). Aucune dérogation équivalente en 8.2.2 ni 6.5.8.1.
   Interdiction connexe (8.2.1, p. 275) : « Les socles de prise de courant disposant d’une broche de terre qui n’est pas
   effectivement en liaison galvanique avec la prise de terre de l’installation électrique sont interdits. »
6. **Dates** : non déterminable depuis le texte 2026.
7. **Anciennes / mixtes** : **faux positif bloquant** pour une partie pre1981 sans conducteur de protection, protégée par
   un 30 mA (dérogation 8.2.1 point 6 b). Correct pour 1981-2020 et après 2020.
8. **FP / FN** : FP — prise rasoir à transformateur (`shaver`) déclarée sans terre ; FP — socle TBTS ; FP — pre1981 +
   30 mA. FN — broche de terre présente mais non raccordée (non modélisable : pas de propriété « terre raccordée ») ;
   FN — valeur absente (symbole par défaut) dans un relevé : la présence de la terre est supposée.
9. **Données** : `socket.earth`, (à ajouter : `socketKind`, `oldPart` / édition, sensibilité du différentiel amont,
   présence d'un PE dans la canalisation `conductors`).
10. **Tests** : `rules.matrix.test.ts > prise « sans terre » reprise d’une photo, non confirmée : anomalie potentielle,
    non bloquante` ; `> prise sans obturateurs, sans terre : corrigées`. Manquants : neuf sans terre (bloquant) ;
    shaver ; pre1981 + 30 mA (dérogation) ; pre1981 sans 30 mA (non conforme) ; partie 1990 sans terre (non conforme).
11. **Limites** : pas de TBTS, pas de « terre raccordée / non raccordée », pas de présence du PE par câble.
12. **Classification** : Exigence RGIE vérifiée.
13. **Verdict** : corriger — (a) `socketKind === 'shaver'` → pas de constat ; (b) édition `pre1981` : si tous les
    différentiels amont ont une sensibilité ≤ 30 mA → statut « dérogation 8.2.1 point 6 b » (non bloquant, référence
    affichée), sensibilité inconnue → « Informations insuffisantes » ; (c) envisager une propriété « broche de terre
    non raccordée » (interdite partout). Tests correspondants.

## R-SOCKET-CHILD

1. **Implémentation** : rgie.ts l. 349-357 : `socket` avec `childSafety === false` et non `threePhase` ; si
   `sinceDate(…, '2025-03-01')` ≠ `yes` (partie avant le 1/3/2025, édition antérieure, ou date inconnue en existant) →
   R-SOCKET-CHILD `knowledge: 'absent'`. Catalogue l. 103 : `nonCompliance`, `medium`, `existing: 'recommendation'`.
   Neuf (date < 1/3/2025) → non conforme **bloquant** ; existant → recommandation non bloquante.
2. **Exigence revendiquée** : prise avec « sécurité enfant (obturateurs) » selon les règles d'avant le 1/3/2025.
   **Non vérifiable** : le texte de référence (2026) ne contient plus cette exigence ; elle relève du « livre 1
   d’application avant le 01/03/2025 » (et de l'ancien RGIE pour 1981-2020), textes non fournis.
3. **Références** : aucune exigence directe dans le texte 2026. Renvois seulement : 6.5.8.1 point 2, p. 207 : « de
   laisser en service les socles de prise de courant qui étaient installés conformément au livre 1 avant le
   01/03/2025. » ; 8.2.1 point 6 a, p. 274 ; 8.2.2 point 6, p. 278 ; 5.3.5.2 c, p. 167.
4. **Champ** : prises ≤ 16 A (monophasées) ; domestique supposé.
5. **Exceptions / transitoires** : 5.3.5.2 c (travaux entamés avant le 1/3/2025, contrôle après cette date : 6.5.8.1
   point 2 applicable) ; 8.2.1 6 a (socles d'avant 1981 conformes au Livre 1 d'avant 2025) ; 8.2.2 6 (socles posés du
   1/10/1981 au 31/5/2020, idem). Le contenu de « conformes au Livre 1 d'avant 2025 » n'est pas vérifiable ici.
6. **Dates** : règle appliquée aux parties d'avant le 1/3/2025 ou de date inconnue.
7. **Anciennes / mixtes** : parties pre1981 / 1981 → recommandation ; on ne sait pas si l'ancien RGIE exigeait la
   sécurité enfant pour toutes ces époques.
8. **FP / FN** : FP possible si l'exigence n'existait pas à l'époque de la partie (pre1981 surtout) ; FP — socle réservé
   à un appareil, dans un tableau, ou à verrouillage (exceptions non appliquées à cette branche, sans base vérifiable
   dans un sens ou l'autre).
9. **Données** : `childSafety`, `threePhase`, dates (`installedOn`, `installationDate`, `rgie2023`).
10. **Tests** : `rules.matrix.test.ts > travaux commencés avant le 1/3/2025 : la vérification d’avant reste (prise sans
    sécurité enfant)`. Manquants : existant sans date (recommandation) ; pre1981 ; neuf daté 2024 (bloquant ?).
11. **Limites** : pas de courant assigné du socle (≤ 16 A supposé hors `threePhase`).
12. **Classification** : Exigence insuffisamment documentée.
13. **Verdict** : rendre non bloquante (aussi en neuf) tant que l'exigence d'avant 2025 n'a pas été vérifiée dans le
    texte du Livre 1 d'avant le 1/3/2025 et de l'ancien RGIE ; ensuite fixer la référence et les époques concernées.
    Test : neuf daté 2024 → non bloquant.

## R-SOCKET-IPXXD

1. **Implémentation** : rgie.ts l. 352-356 : `childSafety === false`, non `threePhase`, `sinceDate(…, '2025-03-01') ===
   'yes'`, et pas d'enfant `appliance` sous la prise (`reserved`) → constat `knowledge: 'absent'`. Catalogue l. 104 :
   `nonCompliance`, `medium`, physique. Neuf → non conforme bloquant ; existant → **recommandation** (gravité moyenne,
   défaut de `classify`).
2. **Exigence** : socles ≤ 16 A / ≤ 250 V au moins IPXX-D (obturateurs), sauf exceptions. Bien vérifié pour le cas
   courant ; deux exceptions sur six modélisées seulement en partie.
3. **Références** : 5.3.5.2 a, p. 167 : « Les socles de prise de courant dont le courant assigné ne dépasse 16A et la
   tension assignée ne dépasse pas 250V ont un degré de protection d’au moins IPXX-D. » ; exceptions (même page) :
   socles « exclusivement destinés pour l’alimentation d’un ou plusieurs appareils d’utilisation pour un usage
   spécifique », « placés dans ou sur des tableaux de répartition et de manœuvre », « munis d’un verrouillage mécanique
   ou électrique » ; points de raccordement camping / marinas / véhicules ; installations temporaires ; lieux du service
   électrique ; 5.3.5.2 c (transitoire).
4. **Champ** : toutes installations à courant alternatif (5.3.5.2 a n'est pas limité au domestique) ; tous réseaux
   (3 × 230 V : un socle monophasé entre phases reste ≤ 250 V).
5. **Exceptions / transitoires** : ci-dessus ; 5.3.5.2 c, p. 167 : travaux « dont l’exécution sur place est entamée
   avant le 01/03/2025 » contrôlés à partir du 1/3/2025 → 6.5.8.1 point 2 applicable ; 6.5.8.1 point 2 (p. 207),
   8.2.1 6 a (p. 274), 8.2.2 6 (p. 278), 8.3.2 point 5 (non domestique, p. 281).
6. **Dates** : exécution sur place entamée le 1/3/2025 ou après (date tirée de 5.3.5.2 c).
7. **Anciennes / mixtes** : bonne lecture de la date propre à une partie (`installedOn`). Mais une partie **existante**
   réalisée après le 1/3/2025 sans IPXX-D devient une simple recommandation alors qu'aucune dérogation ne la couvre
   (constat transversal 1).
8. **FP / FN** : FP — socle dans un tableau (`inBoard: true`) ; FP — socle à verrouillage (`socketKind:
   'switchedLocked'`, si c'est bien un verrouillage qui met hors tension les parties actives : à confirmer) ; FP —
   socle monophasé 32 A (CEE) non marqué `threePhase`. FN — l'exception « appareil dessiné sous la prise » est plus
   large que le texte : une prise ordinaire où l'on dessine un lave-linge n'est pas forcément un socle « exclusivement
   destiné à un usage spécifique » (interprétation à confirmer).
9. **Données** : `childSafety`, `threePhase`, enfants `appliance`, dates ; à exploiter : `inBoard`, `socketKind`.
   Pas de courant ni de tension assignés du socle.
10. **Tests** : `rules.matrix.test.ts > travaux commencés après le 1/3/2025 : prise sans obturateurs → IPXX-D exigé`,
    `> prise réservée à un appareil précis …`, `> travaux commencés avant le 1/3/2025 …`, `> date propre à une partie
    (installedOn) …`, `> prise sans obturateurs, sans terre : corrigées`. Manquants : `inBoard` ; `switchedLocked` ;
    existant daté 2025-06 (attendu non conforme) ; triphasé (rien) ; date exactement 2025-03-01 (applicable).
11. **Limites** : pas de courant / tension assignés, pas de « usage spécifique » explicite.
12. **Classification** : Exigence RGIE vérifiée.
13. **Verdict** : corriger — (a) exclure `inBoard === true` ; (b) exclure `socketKind === 'switchedLocked'` après
    confirmation de la sémantique ; (c) remplacer l'indice « appareil dessiné » par une propriété explicite « socle
    réservé à un usage spécifique » (l'appareil dessiné restant un indice → anomalie potentielle) ; (d) partie existante
    réalisée depuis le 1/3/2025 : statut non conforme. Tests correspondants.

## R-SOCKET-MAX

1. **Implémentation** : rgie.ts l. 150-180 (`fixedPoints`) et l. 381-388 : pour chaque circuit (`isCircuit`) contenant
   au moins une prise, compte = nombre de nœuds `socket` + points fixes (chaque charge non prise, hors charge branchée
   sur une prise ; les charges sous une même chaîne de commandes `switch`/`pushButton`/`relay`/`detector`/`domotic`
   comptent pour un) ; `count > 8` → constat. Catalogue l. 105 : `nonCompliance`, `low`, `existing: 'recommendation'`,
   article « 5.3.5.2 b », vérifié le 2026-11-27. Neuf → non conforme bloquant ; existant → recommandation.
2. **Exigence** : au plus huit socles simples ou multiples par circuit terminal ; dans un circuit mixte, un appareil fixe
   ou un ensemble commandé par un même appareil de manœuvre compte pour un socle. Vérifié.
3. **Références** : 5.3.5.2 b, p. 167 : « Le nombre de socles de prise de courant simples ou multiples est limité à huit
   par circuit terminal. » et « un appareil fixe ou un ensemble d’appareils fixes commandé par un appareil de manœuvre
   commun étant assimilé à un socle de prise de courant. ».
4. **Champ** : installations domestiques ; tous réseaux.
5. **Exceptions** : 8.2.1 6 b (p. 275) et 8.2.2 6 (p. 278) : plus de huit socles laissés en service « à condition que la
   puissance des appareils fixes et à poste fixe raccordés ne dépasse pas la puissance admissible dans la canalisation
   électrique ». Rien en 6.5.8.1.
6. **Dates** : non déterminable depuis le texte 2026.
7. **Anciennes / mixtes** : pre1981 / 1981 → recommandation : acceptable (la condition de puissance n'est pas
   vérifiée ; un statut « dérogation conditionnelle » serait plus juste). Partie existante de l'édition 2020 →
   recommandation : **trop indulgent** (constat transversal 1). Test mixte 2024 dans un existant de 1990 correct.
8. **FP / FN** : questions ouvertes du dossier de validation (Q7 volets centralisés, Q8 deux socles simples sous une
   plaque double) ; FP — éléments `bell`, `inverter`, `battery`, `solarPanel` comptés comme points fixes (discutable) ;
   FP / FN — un appareil d'un circuit dédié dessiné dans un circuit de prises est compté (il est en outre signalé par
   R-DEDICATED-CIRCUIT).
9. **Données** : nœuds dessinés (faits connus) ; un relevé incomplet sous-compte (FN inhérent, non signalé).
10. **Tests** : `rules.rgie2026.test.ts > M5 …` (6 tests) ; `rules.matrix.test.ts > limite : 8 points de prise acceptés,
    9 refusés`, `> existante : une règle de conception devient une recommandation`, `> circuit ancien (partie ancienne)
    dans une installation neuve …`, `> circuit ajouté en 2024 à une installation existante de 1990 …`. Manquants :
    existant de 2022 avec 9 socles (attendu non conforme) ; partie 1981-2020 (dérogation conditionnelle).
11. **Limites** : pas de notion de boîte (Q8), pas de puissance admissible de la canalisation pour la condition 8.2.x.
12. **Classification** : Exigence RGIE vérifiée.
13. **Verdict** : corriger — statut selon l'édition (pre1981 / 1981 : dérogation conditionnelle « à vérifier : puissance
    des appareils fixes ≤ puissance admissible », non bloquante ; 2020 existant : non conforme) ; trancher Q7 / Q8 avec un
    spécialiste.

## R-SOCKET-SECTION

1. **Implémentation** : rgie.ts l. 389-392 : circuit contenant au moins une prise ; plus petite section connue parmi
   tous les câbles du circuit ; `< 2.5` → constat (params section). Catalogue l. 106 : `nonCompliance`, `medium`,
   physique. Neuf → non conforme bloquant ; existant (toute édition) → recommandation.
2. **Exigence** : un circuit comportant un socle a des conducteurs d'au moins 2,5 mm² (l'exception 1,5 mm² du tableau 5.1
   ne vaut que pour les circuits sans socle). Vérifié, y compris pour un circuit mixte (logique « tous les câbles »).
3. **Références** : 5.2.1.2, p. 129 (interdiction sous 2,5 mm²) ; tableau 5.1, p. 129 : « Canalisations électriques
   appartenant à des circuits ne comportant pas de socle de prise de courant, à l’exception de socle de prise de courant
   unique d’une intensité nominale de 2,5 A intégré dans des luminaires. ».
4. **Champ** : toutes installations (5.2.1.2) ; tous réseaux.
5. **Exceptions** : tableau 5.1 : socle unique 2,5 A intégré dans un luminaire (circuit 1,5 mm² admis) ; circuits
   intégrés dans un tableau alimentant un socle simple (0,75 mm², protection adaptée) ; circuits de commande ;
   8.2.1 point 5 (pre1981 : ≥ 1 mm²) ; 8.2.2 ne contient pas d'exception pour les circuits **avec** socles.
6. **Dates** : non déterminable.
7. **Anciennes / mixtes** : pre1981 → recommandation (la dérogation 8.2.1 point 5 l'autoriserait même sans constat) ;
   **1981-2020 → recommandation alors qu'aucune dérogation n'existe** : trop indulgent (le risque thermique reste couvert
   par R-CABLE-PROT si le calibre dépasse 16 A disjoncteur / 10 A fusible).
8. **FP / FN** : FP — prise dans un tableau (`inBoard`) alimentée en 0,75-1,5 mm² ; FP — fil de sonnerie / TBT sous un
   transformateur dans un circuit de prises (min = 0,5) ; FP — luminaire avec prise 2,5 A intégrée. FN — section
   inconnue d'un tronçon : ignoré (couvert par R-CABLE-PROT en relevé seulement au départ). Doublon avec R-CABLE-MIN
   pour un circuit de prises en 1 mm². Le conseil « protégés par 20 A maximum » est faux pour un fusible (16 A selon le
   tableau 4.11).
9. **Données** : `section` des câbles du circuit, présence de `socket`.
10. **Tests** : `rules.matrix.test.ts > circuit ancien (partie ancienne) dans une installation neuve …` (constat
    `R-SOCKET-SECTION` sur 1,5 mm² neuf), `> section des prises trop faible et câble sous 1,5 mm² : corrigées`.
    Manquants : 2,5 mm² pile ; prise `inBoard` ; transformateur ; partie 1990 (attendu non conforme).
11. **Limites** : pas d'identification des luminaires à prise intégrée ni des circuits TBT.
12. **Classification** : Exigence RGIE vérifiée.
13. **Verdict** : corriger — exclure les câbles en aval d'un `transformer`, les socles `inBoard` (minimum 0,75 mm²) ;
    statut selon l'édition (pre1981 : dérogation 8.2.1 point 5 si ≥ 1 mm² ; 1981 et 2020 existant : non conforme) ;
    conseil : « 20 A au plus en disjoncteur, 16 A en fusible (tableau 4.11) ».

## R-DEDICATED-CIRCUIT

1. **Implémentation** : rgie.ts l. 133-148 (`dedicatedNeed`) et l. 394-411. Pour chaque `appliance` d'un circuit :
   `yes` si type ∈ {oven, cooker, hob, washingMachine, dryer, dishwasher, evCharger} ∪ chauffage fixe {heater,
   storageHeater, storageHeaterFan} ou `power ≥ 2600` ; `ifPowerKnown` si puissance inconnue et type ∈ {waterHeater,
   electricWaterHeater, heatPump, boiler, airConditioner, sauna, other}. Autres charges du circuit (hors prise qui porte
   l'appareil ; les appareils de chauffage fixe entre eux) → constat ; `ifPowerKnown` → `manualCheck` non bloquant.
   Catalogue l. 107 : `nonCompliance`, `low`, `existing: 'recommendation'`, article « 5.2.1.2 ; 7.22.3 ». Neuf → non
   conforme bloquant ; existant → recommandation.
2. **Exigence** : en domestique, les appareils nommés, tout appareil à poste fixe ≥ 2 600 W et le chauffage électrique
   fixe ont un circuit dédié ; borne de recharge : un circuit dédié par point de connexion. Vérifié.
3. **Références** : 5.2.1.2, p. 129 : « chaque appareil ou machine (mobile) à poste fixe d’une puissance nominale
   supérieure ou égale à 2600 W est alimenté séparément par un circuit dédié. » ; p. 129-130 : « Le lave-linge, le
   lave-vaisselle, le sèche-linge, la cuisinière électrique, la taque de cuisson électrique et le four électrique sont
   aussi alimentés séparément par un circuit dédié. » ; p. 130 : « Les appareils d’un chauffage électrique à poste fixe
   sont alimentés par un ou plusieurs circuits dédiés. » ; 7.22.3, p. 248 : « Un circuit dédié est prévu pour chaque
   point de connexion. ».
4. **Champ** : 5.2.1.2 : installations domestiques ; 7.22.3 : toute borne de recharge ; tous réseaux.
5. **Exceptions** : 8.2.1 point 5 (p. 274) et 8.2.2 point 5 (p. 277) : « de laisser en service des circuits qui ne sont
   pas dédiés pour l’alimentation des machines ou appareils électriques visés dans le dernier alinéa. ». Rien en 6.5.8.1.
6. **Dates** : non déterminable depuis le texte 2026 (le fait que 8.2.2 contienne la dérogation indique que l'ancien
   RGIE ne l'imposait pas).
7. **Anciennes / mixtes** : pre1981 / 1981 : la dérogation autorise le maintien → recommandation acceptable (voire
   « dérogation »). Partie existante de l'édition 2020 → recommandation : **trop indulgent** (constat transversal 1).
8. **FP / FN** : FN — `motor` de 2 600 W ou plus (seul `appliance` est examiné) ; FN — deux bornes de recharge… (couvert :
   l'autre borne est une autre charge) ; FN — borne branchée par une prise (7.22.3 l'interdit, non vérifié ici) ; FP /
   bruit — `other` de puissance inconnue partageant un circuit → vérification systématique ; interprétation — « appareil
   ou machine (mobile) à poste fixe » : un appareil dessiné branché sur une prise est-il « à poste fixe » ? (oui pour les
   appareils nommés, la question vaut pour le seuil de 2 600 W).
9. **Données** : `applianceType`, `power`, structure du circuit ; puissance inconnue → vérification (jamais conforme
   en silence pour la liste `DEDICATED_IF_POWERFUL`).
10. **Tests** : `rules.rgie2026.test.ts > M6 …` (6 tests : liste, borne, seuil 2 600 / 2 599 W, chauffe-eau, puissance
    inconnue, chauffage fixe, appareil seul ou sur sa prise) ; `trikker.test.ts` l. 47-52 (lave-vaisselle importé,
    recommandation en existant). Manquants : moteur ≥ 2 600 W ; existant de 2022 (attendu non conforme) ; deux lave-linge
    sur un même circuit.
11. **Limites** : pas de « à poste fixe » explicite, pas de point de connexion de borne.
12. **Classification** : Exigence RGIE vérifiée.
13. **Verdict** : corriger — inclure `motor` (seuil de puissance) ; statut selon l'édition (pre1981 / 1981 : dérogation
    8.2.1 / 8.2.2 point 5, non bloquant ; 2020 existant : non conforme) ; borne de recharge alimentée par une prise →
    constat 7.22.3 (nouvelle règle ou paramètre).

## R-VDROP

1. **Implémentation** : rgie.ts l. 469-476 + calc/electrical.ts. Pour chaque circuit calculable (toutes longueurs et
   sections connues) : `checkDropPct` = chute détaillée totale (si toutes les puissances sont connues), sinon chute
   conservative au calibre depuis l'origine (compteur), sinon chute du circuit seul ; comparée brute à `dropLimit`
   (3 % si le circuit ne contient que de l'éclairage, 5 % sinon). Dépassement → R-VDROP (`warning`). Catalogue l. 114 :
   `warning`, `low`. Jamais bloquant, neuf ou existant.
2. **Exigence** : chute de tension limitée « aux valeurs décrites dans les règles de l'art ». Le RGIE **ne fixe aucune
   valeur** ; 3 % / 5 % viennent de l'IEC 60364-5-52 annexe G (non consultée ici : non vérifié).
3. **Références** : 5.2.5, p. 138 : « Les chutes de tension dans les canalisations électriques doivent être limitées
   aux valeurs décrites dans les règles de l’art. » ; 5.2.1.2 b, p. 129 : « la chute de tension, dans les conditions
   normales de service, soit compatible avec un fonctionnement sûr des machines ou appareils électriques alimentés; ».
4. **Champ** : toutes installations ; 230 V, 3 × 230 V (b = 2 entre phases, √3 en triphasé, U = 230 V) et 3N × 400 V
   (U = 400 V en triphasé) : formules correctes pour une charge équilibrée.
5. **Exceptions** : aucune dans le RGIE. Annexe G (non vérifiée) : limites différentes pour une alimentation par
   poste privé ; majoration pour les grandes longueurs — non implémentées.
6. **Dates** : sans objet.
7. **Anciennes** : même calcul (avertissement) : cohérent.
8. **FP / FN** : FP fréquent en méthode conservative (tout le calibre supposé au point le plus éloigné : un circuit de
   prises 20 A de 30 m en 2,5 mm² donne 4,7 % hors amont) — atténué par le statut « avertissement » ; FN — circuit
   **mixte** prises + éclairage : limite 5 % appliquée aux points lumineux (3 % selon la même annexe) ; FN — longueur ou
   section manquante : aucun calcul et **aucun constat** (silence qui peut se lire comme « conforme ») ; FN — amont
   inconnu : contrôle sur le circuit seul (hypothèse affichée).
9. **Données** : `length`, `section`, `material`, `ratedCurrent`, `poles`, `meta.supply`, `mainCurrent`, puissances,
   `cosPhi`.
10. **Tests** : `calc.test.ts > 2,5 mm² Cu, 20 A, 30 m …`, `> aluminium …`, `> triphasé 3N × 400 V …`, `> longueur
    manquante : pas de calcul`, `> comparaison sur la valeur brute : 5,004 % dépasse 5 % …`, `chute cumulée depuis
    l’origine > …` (3 tests), `méthode détaillée > …` (3 tests), `> contrôle : dépassement au calibre non confirmé par le
    détail …`. Manquants : circuit mixte (limite) ; éclairage seul à 3,01 % ; 3 × 230 V ; constat « calcul impossible ».
11. **Limites** : courant d'emploi inconnu sans puissances ; harmoniques, déséquilibre non pris en compte.
12. **Classification** : Bonne pratique (le RGIE renvoie aux règles de l'art sans valeur ; valeurs normatives non
    vérifiées).
13. **Verdict** : garder (avertissement), avec corrections : (a) appliquer 3 % au trajet de chaque point lumineux d'un
    circuit mixte ; (b) circuit non calculable : information « chute de tension non calculée (longueur ou section
    manquante) », non bloquante ; (c) message : citer 5.2.5 (« règles de l'art ») et l'origine normative des 3 / 5 %
    comme valeurs usuelles, pas comme exigence du RGIE.

## R-VDROP-RATING

1. **Implémentation** : rgie.ts l. 477-481 : méthode détaillée sans dépassement, mais chute conservative au calibre
   (totale si connue) > limite → R-VDROP-RATING (`info`). Catalogue l. 115 : `recommendation`, `low`. Jamais bloquant.
2. **Exigence** : signaler que la conformité de la chute dépend des puissances saisies. Information de conception ;
   cohérente avec le principe « jamais passé sous silence ».
3. **Références** : aucune exigence propre ; contexte 5.2.5, p. 138 et 5.2.1.2 b, p. 129.
4. **Champ** : comme R-VDROP.
5. **Exceptions** : aucune.
6. **Dates** : sans objet.
7. **Anciennes** : idem.
8. **FP / FN** : pas de FP au sens propre (information) ; FN — si l'amont est inconnu, compare la chute du circuit seul.
9. **Données** : comme R-VDROP + puissances.
10. **Tests** : `calc.test.ts > contrôle : dépassement au calibre non confirmé par le détail → information, pas de
    R-VDROP`. Manquant : amont connu qui fait basculer le total.
11. **Limites** : comme R-VDROP.
12. **Classification** : Recommandation.
13. **Verdict** : garder.

## R-ICC-LMAX

1. **Implémentation** : rgie.ts l. 482-483 + calc/electrical.ts l. 338-347. Si la protection du circuit est un mcb ou
   rcbo de courbe B / C / D et de calibre connu : seuil magnétique = 5 / 10 / 20 × In (borne haute, IEC 60898-1, non
   vérifiée) ; Icc min = 0,8·U / (b·(R amont + R circuit)), R = Σ ρL/S par conducteur (ρ = 1,25 × ρ20) ; `iccMin <
   magnetic` → R-ICC-LMAX (`warning`) avec Lmax. Catalogue l. 116 : `warning`, `high`. Jamais bloquant.
2. **Exigence** : un court-circuit franc en bout de circuit est coupé assez vite (déclenchement magnétique du
   disjoncteur), donc la longueur protégée est limitée. Méthode conventionnelle (règles de l'art), pas un texte du RGIE.
3. **Références** : 4.4.2.1 point 2, p. 117 : le temps de coupure « n’est pas supérieur au temps nécessaire pour élever
   la température des conducteurs à la limite admissible » ; 4.4.2.2 c, p. 118 : « Les longueurs maxima des
   canalisations électriques protégées sont déterminées conformément aux règles de l’art. » ; 5.2.1.2 e, p. 129 :
   « la valeur de l’impédance du circuit soit compatible avec le fonctionnement des protections imposées par le présent
   Livre. ». Le facteur 0,8, ρ = 1,25 ρ20 et les seuils B/C/D viennent de normes / guides non consultés.
4. **Champ** : toutes installations ; schéma TT : seule la boucle phase-neutre est estimée (correct, le défaut à la
   terre relève du différentiel) ; TN / IT : boucle de défaut non calculée (documenté).
5. **Exceptions** : 4.4.2.2 b (dispenses de protection contre les courts-circuits) — sans objet ici.
6. **Dates** : sans objet.
7. **Anciennes** : même calcul.
8. **FP / FN** : **erreur de formule en triphasé (FN)** — pour un circuit 3P+N / 4P sur 3N × 400 V, le code prend
   U = 400 V et b = √3, soit Icc ≈ 0,8·231/R ; le défaut minimal d'un circuit avec neutre est phase-neutre :
   0,8·230/(2R) (si S neutre = S phase), **deux fois plus faible**. Lmax est donc surestimé d'un facteur 2 (exemple du
   test `calc.test.ts` « triphasé 3N × 400 V, 6 mm², 32 A, 50 m » : 154 m calculés, environ 77 m par la méthode
   conventionnelle avec neutre). Sans neutre (3P sur 3N × 400 V ou sur 3 × 230 V), le défaut minimal est biphasé :
   0,8·U/(2R), le code surestime d'un facteur 2/√3 ≈ 1,15. Le monophasé (230 V, b = 2) et le biphasé sur 3 × 230 V sont
   corrects. Autres FN : fusibles (`device: 'fuse'`) jamais vérifiés ; courbe absente → silence ; amont incomplet → R
   amont = 0 (Icc surestimé, hypothèse affichée) ; impédance du réseau ignorée (couverte conventionnellement par 0,8,
   non vérifié) ; contrainte thermique (k²S²) et pouvoir de coupure (4.4.2.1 point 1) non vérifiés.
9. **Données** : `length`, `section`, `material`, `ratedCurrent`, `curve`, `device`, `poles`, `meta.supply`, câbles
   amont ; manquant → pas de calcul, pas de constat.
10. **Tests** : `calc.test.ts > 2,5 mm² Cu, 20 A, 30 m …` (Icc, Lmax), `> courbe B …`, `> aluminium …`, `> triphasé 3N ×
    400 V …` (**fige la formule suspecte**), `> trop long : Icc min sous le seuil magnétique`. Aucun test de la règle
    R-ICC-LMAX elle-même (constat émis). Manquants : constat émis / non émis à la limite ; 3P+N ; 3P sans neutre ;
    3 × 230 V ; fusible (attendu : vérification manuelle) ; courbe inconnue.
11. **Limites** : section du neutre non modélisée (m = Sph/SN) ; impédance réseau ; boucle de défaut TN / IT.
12. **Classification** : Interprétation nécessitant une expertise (exigence RGIE renvoyant aux règles de l'art ;
    méthode et coefficients normatifs non vérifiés ; formule triphasée suspecte).
13. **Verdict** : corriger — circuit triphasé avec neutre : Icc min = 0,8·U0/((1+m)·R_phase) avec U0 = 230 V (m = 1 faute
    de donnée) ; sans neutre : 0,8·U/(2·R_phase) ; mettre à jour `docs/calc.md` § 5 et le test triphasé ; fusible ou
    courbe inconnue → information « longueur protégée non vérifiée » ; ajouter des tests de la règle. Faire valider la
    méthode (0,8, seuils B/C/D) par un spécialiste.

---

## Compléments demandés après le contre-audit externe (vérifiés de façon indépendante)

### a. `dcSide` : « un ancêtre onduleur, batterie ou panneau » ne prouve pas qu'un câble est en courant continu

Code : rgie.ts l. 312 : `dcSide = ancestors.some((a) => a.kind === 'inverter' || a.kind === 'solarPanel' || a.kind ===
'battery')`. Les câbles concernés sont exclus de R-CABLE-SECTION-MISSING, R-CABLE-DATA-MISSING, R-CABLE-MIN,
R-CABLE-PROT et R-CABLE-NO-OVERCURRENT. Le modèle (schema.ts, `ALLOWED_CHILDREN`) se lit du tableau vers les
extrémités : `inverter` admet comme enfants `cable`, `solarPanel`, `battery`, `other` ; `battery` admet `cable` ;
`solarPanel` admet `cable` et `solarPanel`. Dans le dessin habituel (protection → câble AC → onduleur → câble →
panneaux), le câble sous l'onduleur est bien en continu : l'heuristique est juste dans ce cas. Elle se trompe dans les
autres :

- **Faux négatifs (règles AC muettes sur un câble AC)** : onduleur hybride ou batterie AC-couplée avec **sortie de
  secours (backup / EPS)** dessinée sous l'onduleur ou sous la batterie (onduleur → câble → prises ou tableau de
  secours) : ce circuit AC n'est contrôlé ni en section, ni en protection, ni en surintensité ; micro-onduleur dessiné
  « à l'envers » (panneau → câble → onduleur → câble AC) ; câble AC d'un élément `other` placé sous un onduleur ;
  hacheur `dcDc` sans incidence (continu des deux côtés), mais un onduleur `acDc` (batterie) suivi d'un tableau AC est
  mal classé.
- **Faux positifs** : peu par cette heuristique elle-même (elle exclut plutôt qu'elle n'ajoute). En revanche, les
  **calculs** (src/calc/electrical.ts, `paths` et `inCircuit`) descendent sous l'onduleur : les câbles DC des chaînes de
  panneaux sont comptés dans le trajet AC du circuit, ce qui gonfle la chute de tension et abaisse l'Icc → **faux
  positifs R-VDROP et R-ICC-LMAX** sur un circuit d'onduleur (et un onduleur sans puissance empêche la méthode
  détaillée). R-SOCKET-SECTION et R-SOCKET-MAX ne lisent pas `dcSide` : une prise de secours sous un onduleur est
  comptée dans le circuit amont.
- **Ce que le modèle devrait porter** : une propriété explicite de nature du câble, `current: 'ac' | 'dc'` (ou
  `side: 'ac' | 'dc'`), proposée par défaut d'après le contexte (sous un panneau ou entre panneau et onduleur `dcAc` →
  `dc` ; sous une batterie ou un onduleur sans indication → **inconnu**) et modifiable. Règles AC : exécutées si `ac`,
  exclues si `dc`, et si inconnu → constat « nature AC/DC du câble à préciser » (information / vérification, non
  bloquant) au lieu d'une exclusion silencieuse. Calculs : arrêter le trajet AC à un nœud `inverter` / `battery`
  (sauf câble marqué `ac`). Tests : sortie de secours sous onduleur hybride en 1 mm² → R-CABLE-MIN ; câble de chaîne PV
  → rien ; câble sous batterie sans nature → information ; chute de tension d'un circuit d'onduleur sans les câbles DC.

### b. Section au-delà de 35 mm² (hors tableau 4.11)

Confirmé : `maxProtectionFor` renvoie `undefined` au-delà de 35 mm² (rgie.ts l. 54) et la condition de R-CABLE-PROT
(l. 325) n'émet alors rien : aucun constat, ce qu'une interface lit comme « conforme ». Le texte n'en dit rien : le
tableau s'arrête à 35 mm² / 125 A ; au-delà, seules restent les exigences générales (4.4.1.4 : IZ « calculée
conformément aux règles de l’art » ; 4.4.3.2 : In ≤ IZ). Comportement attendu : si une protection contre les
surintensités de calibre connu est trouvée au-dessus d'un câble de plus de 35 mm², émettre R-CABLE-PROT avec le
statut `manualCheck` (« Vérification manuelle nécessaire », non bloquant, ni en neuf ni en existant), paramètres
section et calibre, message : « Section hors du tableau 4.11 : le courant admissible IZ (mode de pose, groupement,
température) est à vérifier selon les règles de l'art (RGIE 4.4.1.4, 4.4.3.2). » Même traitement pour une section
inférieure à 0,5 mm² (aussi hors tableau, `undefined` aujourd'hui ; R-CABLE-MIN se déclenche déjà). Tests : 50 mm² +
160 A → vérification non bloquante ; 35 mm² + 125 A → rien ; 35 mm² + 160 A → non conforme.

### c. Tableau 5.1

Vérifié à l'œil par le coordinateur sur la page PDF 141 (imprimée 129) : voir R-CABLE-MIN, point 3. Les conclusions de
l'audit sur 1,5 / 0,75 / 0,5 mm² sont confirmées.

### d. Existant : dérogations réellement applicables (une non-conformité ne devient pas d'office une recommandation)

Rappel du code : `classify` donne à toute partie existante le statut `existing` du catalogue, sinon « non conforme »
si la gravité est élevée et « recommandation » sinon (context.ts l. 122-124). Ce passage automatique n'a pas de base
dans le RGIE : le Livre 1 accorde des dérogations précises, datées et souvent conditionnelles. Pour les règles du lot :

| Règle | Dérogation applicable (texte) | Condition | Statut attendu en existant |
|---|---|---|---|
| R-CABLE-MIN | 8.2.1 point 5 (p. 274), parties d'avant le 1/10/1981 | section ≥ 1 mm² ; 1 mm² protégé par fusible ≤ 6 A ou disjoncteur ≤ 10 A (taille 12) | dérogation si la condition est vérifiée, sinon non conforme |
| R-CABLE-MIN | 8.2.2 point 5 (p. 277-278), exécution entamée avant le 17/5/1986 | EMCB / EMCVB 1 mm², CTLB / VTLB 0,75 mm², circuit sans socle, protection adaptée | idem ; type de câble et date nécessaires, sinon vérification |
| R-CABLE-PROT | aucune (8.2.1 / 8.2.2 point 1 exigent les caractéristiques du Livre actuel) | — | non conforme (aujourd'hui : correct) |
| R-CABLE-NO-OVERCURRENT | aucune en partie 8 ; seules les dispenses 4.4.2.2 b / 4.4.3.3, valables à toute époque | — | non conforme (correct) |
| R-SOCKET-EARTH | 8.2.1 point 6 b (p. 274-275), parties d'avant 1981 | canalisation sans conducteur de protection **et** différentiel ≤ 30 mA | dérogation si les deux sont connus, vérification si inconnu, sinon non conforme ; aucune dérogation pour 1981-2020 ni après |
| R-SOCKET-CHILD | 6.5.8.1 point 2, 8.2.1 6 a, 8.2.2 6 : maintien des socles conformes au Livre 1 d'avant le 1/3/2025 | contenu de l'exigence antérieure non vérifiable | « à vérifier » (insuffisamment documentée) |
| R-SOCKET-IPXXD | mêmes textes + 8.3.2 point 5 : socles posés avant le 1/3/2025 conformes aux règles d'alors | date de pose | déjà traduit par la date (règle CHILD avant, IPXXD après) ; partie posée depuis le 1/3/2025 : non conforme (aujourd'hui : recommandation, à corriger) |
| R-SOCKET-MAX | 8.2.1 point 6 b, 8.2.2 point 6 | puissance des appareils fixes et à poste fixe ≤ puissance admissible de la canalisation | vérification manuelle (condition non calculée), pas une recommandation ; partie de l'édition 2020 : non conforme |
| R-SOCKET-SECTION | 8.2.1 point 5 (avant 1981) | section ≥ 1 mm² (1 mm² : ≤ 6 A / 10 A) | dérogation si vérifiée ; parties 1981-2020 et après 2020 : non conforme (aucune dérogation) |
| R-DEDICATED-CIRCUIT | 8.2.1 point 5 et 8.2.2 point 5 (p. 274, 277), sans condition | partie d'avant le 1/6/2020 | statut « dérogation » avec la référence ; partie de l'édition 2020 : non conforme |
| R-CABLE-*-MISSING | 8.2.1 point 7 (schéma simplifié, avant 1981) | type et section des départs seulement | documentaire, réduit au contenu minimal |
| R-VDROP / R-VDROP-RATING / R-ICC-LMAX | sans objet (avertissements, pas d'exigence chiffrée du RGIE) | — | inchangé |

Correction proposée (moteur) : remplacer le champ `existing` du catalogue par une liste de dérogations par règle
(`{ ref, editions, before?, condition? }`). Le moteur applique « dérogation » (non bloquant, référence affichée) si la
condition est vérifiée, « vérification manuelle » si elle n'est pas vérifiable avec les données, et « non conforme »
sinon. Le caractère bloquant d'une non-conformité de gravité faible ou moyenne dans l'existant reste à trancher avec
un spécialiste (question 5). Une partie existante de l'édition 2020 n'a, pour ces règles, aucune dérogation (6.5.8.1
n'en contient pas).

## Questions ouvertes pour un spécialiste

1. (Tableau 5.1 : vérifié à l'œil sur le PDF par le coordinateur, voir R-CABLE-MIN ; plus de question.)
2. Le Livre 1 d'avant le 1/3/2025 et l'ancien RGIE exigeaient-ils la « sécurité enfant » sur les socles, et depuis
   quand ? (R-SOCKET-CHILD.)
3. 5.3.5.2 a : une prise ordinaire réservée à un appareil courant (lave-linge, frigo) est-elle un socle « exclusivement
   destiné … pour un usage spécifique » dispensé d'IPXX-D ?
4. Le symbole « prise à verrouillage » (`switchedLocked`) correspond-il au « verrouillage mécanique ou électrique mettant
   hors tension les parties actives » de 5.3.5.2 a ?
5. Une partie existante réalisée après le 1/6/2020 (édition en vigueur) sans dérogation de 6.5.8.1 : les écarts aux
   règles « de conception » (8 socles, circuit dédié, section des prises) restent-ils des infractions ? (Constat
   transversal 1.)
6. Dossier de validation Q7 (volets centralisés) et Q8 (deux socles simples sous une plaque double) pour R-SOCKET-MAX.
7. R-ICC-LMAX : confirmer la méthode conventionnelle (facteur 0,8, seuils 5 / 10 / 20 In, défaut phase-neutre pour un
   circuit triphasé avec neutre) et la façon de traiter les fusibles.
8. Chute de tension : les valeurs 3 % / 5 % sont-elles celles attendues par les organismes agréés belges au titre des
   « règles de l'art » de 5.2.5, et s'appliquent-elles depuis le compteur ?
