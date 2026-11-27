> Annexe du rapport `docs/audit/REGISTRE-RGIE-2026.md`. Document de travail de l’audit (27/11/2026), écrit sur le moteur **avant** les corrections de la branche `regulatory-registry` : les constats corrigés depuis sont listés dans le rapport. Les chemins `scratchpad/…` désignent des fichiers de travail non versionnés (extrait texte du RGIE, sondes).

# Audit des règles — lot g1

Dépôt audité : `scratchpad/wt-engine` (branche `regulatory-registry`, commit `ae52b22`), lecture seule ; numéros de ligne relevés à ce commit. Texte officiel : RGIE Livre 1,
version 07 (15/09/2026, d'application au 01/11/2026), `scratchpad/livre1.txt`. Pages = pages imprimées (pieds de page
« | n »). Quand le pied de page d'une page manque dans l'extrait, la page est donnée d'après la table des matières et
signalée.

## Constats transversaux du lot

- **Classement documentaire.** Les règles `R-DOC-*` sont émises sans nœud : elles prennent le contexte du **projet**
  (`projectContext`, `rgie.ts` l. 227, 497-499). Neuf = `insufficientData` bloquant ; existant = `insufficientData` non
  bloquant (`context.ts`, `classify`, cas `missingData`). Une extension neuve (propriété `installationKind: 'new'` ou
  `installedOn` récent sur une partie) dans un projet « existant » ne rend donc pas ces mentions bloquantes, alors que
  3.1.2.1 a les exige pour toute « modification importante ou extension importante ».
- **Pas de distinction domestique / non domestique** dans le modèle (`ProjectMeta` n'a aucun champ). Or 3.1.2.1 a (nom,
  qualité, TVA, adresse, tension et nature du courant sur l'unifilaire) vise les installations **domestiques** ; 3.1.2.1 b
  (non domestique) énumère des documents sans ces mentions. Seul 3.1.2 (numéro, version, date) vaut pour toutes.
- **Source par défaut erronée.** La fabrique `r()` de `catalog.ts` (l. 47-53) met `source: LIVRE1` à toutes les règles,
  y compris celles qui sont des choix de Voltaplan (`R-CIRCUIT-NAME`, `R-COUNTRY-OPTION`, `R-OLD-RGIE`,
  `R-INSTALL-DATE`). Aucune règle du lot n'a de champ `article` ni `verifiedOn`.
- **Éditions incomplètes.** `BE_EDITIONS` (`catalog.ts` l. 21-45) connaît les amendements du 1/6/2023, du 1/3/2025 et
  du 1/11/2026 (`src/regulations/be/values.ts`, `DATES`) ; le texte liste aussi des versions d'application au
  01/11/2022 et au 01/04/2026 (p. 3), absentes. Le constant `LIVRE1` ne cite que l'AR du 8 septembre 2019.
- **Date à l'année seule.** `normDate('2020')` donne `2020-01-01` : une installation notée « 2020 » est rangée dans
  l'édition 1981 (ancien RGIE), ce qui déclenche à tort `R-OLD-RGIE` et, si elle est neuve, `R-INSTALL-DATE`.
- **Exigence non couverte** relevée en lisant 3.1.2.1 a (p. 62) : « Toute ancienne partie … entamée avant le 1/10/1981 et
  figurant sur les schémas unifilaires est repérée avec la mention « partie ancienne » ». Aucune règle ne la vérifie
  (à confirmer : l'impression ajoute peut-être déjà cette mention pour `oldPart`).

---

## R-RULESET-UNKNOWN

1. **Implémentation.** `src/rules/index.ts` l. 51-55 : si `findRulePack(meta.ruleset)` ne trouve rien (id non vide
   et inconnu ; absent ou vide = Belgique), `checkProject` renvoie **un seul** constat
   `{ status: 'notEvaluated', severity: 'error', blocking: true, hazard: 'none' }` sans passer par `classify` ni
   `withUnconfirmed`. Neuf comme existant. Catalogue (`catalog.ts` l. 66) : `kind: 'nonCompliance'`,
   `existing: 'nonCompliant'`, `requirement: 'physical'`, `source: undefined` — métadonnées **inutilisées et contraires**
   au constat réellement émis. Exclu du comptage `checkedRuleCount` (l. 25).
2. **Exigence prétendue.** Ne jamais présenter un projet comme vérifié quand aucun référentiel connu n'a été appliqué.
   C'est bien ce qu'elle fait.
3. **Référence.** Aucune : garde-fou logiciel (ADR-0001), pas une exigence du RGIE.
4. **Champ.** Tout projet, tout pays, indépendant du réseau et du schéma de liaison à la terre.
5. **Exceptions.** Aucune.
6. **Dates.** Sans objet.
7. **Anciennes / plusieurs périodes.** Sans objet (aucune règle n'est évaluée).
8. **Faux positifs / négatifs.** Faux positif possible : fichier d'une version future de Voltaplan avec un id de
   référentiel renommé (ex. `BE-RGIE-2026`) → tout le contrôle est bloqué ; acceptable, mais une table d'alias de
   migration serait utile. Faux négatif : aucun (vide = Belgique est un choix explicite).
9. **Données.** `meta.ruleset`. Absent → Belgique (défaut historique, documenté).
10. **Tests.** `test/rules.test.ts > référentiel inconnu > n'applique pas en silence les règles belges`. Manquants :
    `ruleset: ''` → Belgique ; constat sans `requirement` (vérifier ce que l'interface en fait) ; `checkedRuleCount` = 0.
11. **Limites.** Le constat n'a ni `requirement`, ni `edition` ; les consommateurs qui prennent « physique » par défaut
    (`classify` l. `requirement = … ?? 'physical'`) pourraient le compter comme une exigence physique.
12. **Classification.** Bonne pratique (garde-fou de Voltaplan).
13. **Verdict.** Corriger les **métadonnées seulement** : dans le catalogue, `kind` cohérent avec « non évaluée » (ou
    retirer la règle du catalogue belge, puisqu'elle est émise hors du référentiel), `source: 'Voltaplan'`, pas de
    `existing: 'nonCompliant'` ; ajouter `requirement` explicite au constat émis. Comportement à garder (bloquant).
    Test : le constat porte `status: 'notEvaluated'` et jamais `nonCompliant`.

---

## R-OLD-RGIE

1. **Implémentation.** `rgie.ts` l. 227-228 : `if (!projCtx.current) add('R-OLD-RGIE')`. Contexte du **projet**
   seulement : `meta.installationDate` → édition (`pre1981` avant le 1/10/1981, `1981` jusqu'au 31/5/2020), sinon
   `rgieVersion: 'old'` → édition 1981. Catalogue l. 67 : `kind: 'info'`, documentaire → statut `recommendation`
   (cas `default` de `classify`), non bloquant, sévérité info. Texte : « Projet établi selon l'ancien RGIE. » ; conseil :
   « Pour une mise en conformité (vente, rénovation), les points signalés … indiquent ce qu'il faut adapter pour
   respecter le nouveau RGIE. »
2. **Exigence prétendue.** Informer que le projet relève d'une édition antérieure. Pas d'exigence vérifiée.
3. **Référence.** 8.1.1, p. 272 : « Ancien RGIE: Règlement Général sur les Installations Electriques approuvé par les
   arrêtés royaux du 10/03/1981 et du 2/09/1981 et ses modifications. » Entrée en application du Livre 1 : p. 3,
   « (D’application à partir du 01/06/2020) ».
4. **Champ.** Domestique et non domestique (pas de distinction), tous réseaux.
5. **Exceptions.** Le texte parle d'« ancien RGIE » ; or l'édition `pre1981` (avant le 1/10/1981) correspond aux
   « anciennes installations » de 8.1.1 / 8.2.1, **pas** à l'ancien RGIE. Par ailleurs, 8.1.1 réserve « installation
   … ancien RGIE » à celle « qui a fait l'objet d'un examen de conformité conformément à l'ancien RGIE » ; une partie
   réalisée entre 1981 et 2020 sans examen n'entre pas dans 8.2.2.
6. **Dates.** 1/10/1981 et 1/6/2020 corrects. Versions du 01/11/2022 et du 01/04/2026 absentes des éditions.
7. **Plusieurs périodes.** Ignorées : un projet neuf contenant une partie `oldPart` ou `installedOn: '1975'` ne reçoit
   pas l'information ; un projet daté 1990 avec une extension 2024 la reçoit globalement.
8. **Faux positifs / négatifs.** FP : `installationDate: '2020'` → `2020-01-01` → édition 1981 → message « ancien RGIE »
   pour une installation peut-être réalisée en septembre 2020 ; partie d'avant 1981 qualifiée d'« ancien RGIE ».
   FN : parties anciennes dans un projet daté récent.
   Conseil trompeur : une installation existante n'a pas à « respecter le nouveau RGIE » en bloc ; la partie 8 prévoit
   des dérogations et la vente donne lieu à une visite de contrôle (chapitre 8.4), pas à un contrôle de conformité
   complet.
9. **Données.** `meta.installationDate`, `meta.rgieVersion`. Sans date et `rgieVersion: 'new'` : édition en vigueur,
   aucune information (correct).
10. **Tests.** `test/rules.matrix.test.ts > ancien RGIE (rgieVersion « old ») : édition 1981 appliquée…` (vérifie
    seulement la présence). Manquants : `pre1981` (libellé distinct), date « 2020 » à l'année seule, projet neuf avec
    parties anciennes, statut non bloquant.
11. **Limites.** Pas de champ « examen de conformité selon l'ancien RGIE effectué », pas de champ « visite de contrôle à
    la vente » ; l'édition est déduite de la seule date.
12. **Classification.** Bonne pratique (information de Voltaplan).
13. **Verdict.** Corriger : (a) deux messages, « partie ancienne (avant le 1/10/1981, 8.2.1) » et « ancien RGIE
    (1981-2020, 8.2.2 si examen de conformité) » ; (b) réécrire le conseil : « les constats tiennent compte des
    dérogations de la partie 8 quand elles sont modélisées ; une rénovation importante suit le Livre 1 pour la partie
    modifiée » ; (c) émettre aussi l'information quand une partie (pas seulement le projet) relève d'une édition
    antérieure ; (d) date à l'année « 2020 » : demander le mois au lieu de supposer janvier. Tests pour chaque cas.
    Question : un projet d'installation existante relevée en 2026 doit-il afficher cette information à chaque contrôle ?

---

## R-INSTALL-DATE

1. **Implémentation.** `rgie.ts` l. 229-230 : `instDate < '2020-06-01' && meta.installationKind === 'new'` →
   catalogue `manualCheck` (l. 68), documentaire, non bloquant. Paramètre `date`. Comme la même date range le projet
   dans l'édition 1981, `partContext` force déjà `isNew = false` : le projet est traité comme existant ; la règle
   signale l'incohérence.
2. **Exigence prétendue.** Une installation « neuve » datée d'avant l'entrée en application du Livre 1 est incohérente :
   vérifier le régime applicable ou la date. C'est un contrôle de cohérence des données, pas une exigence.
3. **Référence.** p. 3 : « (D’application à partir du 01/06/2020) » ; 8.1.1, p. 272 : installation existante = « dont
   l’exécution sur place a été entamée avant la date d’entrée en vigueur du présent Livre et qui n’a pas fait l’objet
   d’un contrôle de conformité ». Le message parle de « dispositions transitoires » sans les nommer ; il n'y a pas, dans
   le Livre 1, de disposition transitoire générale identifiée pour ce cas, seulement cette définition.
4. **Champ.** Tous projets marqués neufs.
5. **Exceptions.** Néant.
6. **Dates.** 2020-06-01 (exact, p. 3).
7. **Plusieurs périodes.** Ne lit que `meta.installationDate` et `meta.installationKind` ; une partie `installationKind:
   'new'` avec `installedOn: '2019'` n'est pas signalée (et devient silencieusement existante).
8. **Faux positifs / négatifs.** FP : date « 2020 » (année seule) → janvier 2020 → signalée alors que l'exécution a pu
   commencer après juin. FN : incohérence au niveau d'une partie ; date dans un format non reconnu (« 15/03/2019 ») →
   `normDate` renvoie `undefined`, rien n'est signalé, le projet reste neuf sous l'édition en vigueur.
9. **Données.** `meta.installationDate` (date de début d'exécution sur place, c'est le critère du texte),
   `meta.installationKind`. Date absente : pas de constat (correct).
10. **Tests.** `test/rules.matrix.test.ts > installation neuve datée d’avant le 1/6/2020 : dispositions transitoires à
    vérifier`. Manquants : 2020-06-01 pile (pas de constat), « 2020 » seul, existant (pas de constat), date non reconnue,
    partie neuve datée d'avant 2020.
11. **Limites.** Pas de date « début d'exécution » distincte de la date de réalisation ; pas d'information « contrôle de
    conformité déjà fait ».
12. **Classification.** Bonne pratique (contrôle de cohérence de Voltaplan).
13. **Verdict.** Corriger le message (« installation marquée neuve mais exécution commencée avant le 1/6/2020 : elle est
    traitée comme existante (8.1.1) ; corrigez la date ou la nature »), étendre aux parties, signaler aussi une date non
    reconnue. Source : « Voltaplan », référence 8.1.1 en information. Question : une installation commencée en 2019,
    jamais contrôlée, contrôlée en 2026 : quel régime l'organisme agréé applique-t-il (8.2.2 suppose un examen selon
    l'ancien RGIE) ?

---

## R-DOC-INSTALLER

1. **Implémentation.** `rgie.ts` l. 234 : `!meta.installer?.name?.trim()` → catalogue `missingData`,
   documentaire (l. 70) → `insufficientData`, bloquant si le projet est neuf, non bloquant sinon. Correction rapide :
   champ du projet (`fixes.ts` l. 125).
2. **Exigence prétendue.** Le nom du responsable de l'exécution des travaux figure sur les schémas et plans. Vérifié :
   oui, pour le nom.
3. **Référence.** 3.1.2.1 a, p. 61 : « Les nom, qualité, numéro de T.V.A. (si d’application) du responsable de
   l’exécution des travaux sont mentionnés sur les schémas unifilaires et les plans de position. » Champ :
   « Pour toute installation électrique domestique nouvelle ou pour toute modification importante ou toute extension
   importante … » (p. 61). Modification non importante (p. 62) : description succincte qui « comporte les nom, qualité et
   adresse de la ou des personnes responsables de l'exécution du travail ».
4. **Champ.** Domestique ; nouvelle installation ou modification / extension importante (définition p. 47). Non
   domestique : 3.1.2.1 b n'impose pas cette mention sur les schémas.
5. **Exceptions.** 8.2.1 point 7 (p. 275) : schémas simplifiés pour les parties d'avant le 1/10/1981 ; le contenu
   minimal n'inclut pas le nom du responsable. 8.2.2 point 7 (p. 276-279, pied de page absent de l'extrait) tolère
   l'absence de la signature et de la date du responsable, du numéro de TVA, du type des protections — **pas** du nom.
6. **Dates.** Livre 1 depuis le 1/6/2020 ; pas de transitoire spécifique.
7. **Plusieurs périodes.** Contexte du projet seulement (voir constats transversaux).
8. **Faux positifs / négatifs.** FP : installation non domestique neuve → bloquant alors que 3.1.2.1 b n'exige pas la
   mention. FN : extension importante neuve dans un projet existant → non bloquant ; nom fantaisiste (« x ») accepté.
9. **Données.** `meta.installer.name`. Absent : constat (jamais conforme par défaut).
10. **Tests.** `test/rules.matrix.test.ts > nom de l’installateur absent : bloquant en neuf, pas en existant` et
    `> catalogue … R-DOC-INSTALLER documentary`. Manquants : nom fait d'espaces, partie neuve dans projet existant,
    partie d'avant 1981.
11. **Limites.** Un seul responsable par projet (le texte admet « la ou des personnes ») ; pas de champ domestique ;
    numéro de TVA non vérifié (« si d’application » : correct de ne pas l'exiger).
12. **Classification.** Exigence RGIE vérifiée.
13. **Verdict.** Corriger (métadonnées et portée) : `article: '3.1.2.1 a'`, `verifiedOn` ; classer selon la partie la
    plus récente (bloquant si une partie neuve existe) ; ne pas bloquer pour un projet non domestique quand ce champ
    existera. Garder documentaire. Question : pour un particulier exécutant lui-même, quelle « qualité » (dossier de
    validation, question déjà posée) ?

---

## R-DOC-ADDRESS

1. **Implémentation.** `rgie.ts` l. 235-236 : `!site.street?.trim() || !site.city?.trim()` → `missingData`,
   documentaire (l. 71), bloquant en neuf.
2. **Exigence prétendue.** L'adresse du lieu de l'installation figure sur les schémas et plans. Vérifié partiellement :
   rue et commune seulement ; numéro, boîte et code postal ignorés.
3. **Référence.** 3.1.2.1 a, p. 61 : « L'adresse du lieu où est placée cette installation électrique est mentionnée sur
   les schémas unifilaires et les plans de position. » 8.2.1 point 7, p. 275 : contenu minimal du schéma simplifié,
   « l’adresse de l’installation électrique; ».
4. **Champ.** Domestique ; neuf et modifications importantes ; aussi les schémas simplifiés des parties d'avant 1981.
5. **Exceptions.** Aucune dérogation à l'adresse (même 8.2.1 point 7 la garde).
6. **Dates.** Sans transitoire.
7. **Plusieurs périodes.** Contexte du projet ; pour l'existant, non bloquant alors que l'adresse reste exigée même dans
   les schémas simplifiés (acceptable : donnée documentaire, mais à dire dans le message).
8. **Faux positifs / négatifs.** FN : rue sans numéro (« Rue de la Station », Bruxelles) acceptée. FP : lieu-dit sans
   rue (rare) → constat bloquant.
9. **Données.** `meta.site.street`, `meta.site.city` (et idéalement `number`, `postalCode`).
10. **Tests.** Aucun : la règle figure dans `KNOWN_UNTESTED` (`test/regulatory-consistency.test.ts` l. 117). Manquants :
    adresse complète (pas de constat), rue manquante, commune manquante, espaces seuls, neuf bloquant / existant non
    bloquant.
11. **Limites.** Adresse libre, pas de validation du code postal.
12. **Classification.** Exigence RGIE vérifiée.
13. **Verdict.** Corriger : exiger aussi le numéro (ou une case « sans numéro ») et le code postal, ajouter
    `article: '3.1.2.1 a ; 8.2.1 7'`, écrire les tests ci-dessus et retirer la règle de `KNOWN_UNTESTED`.

---

## R-DOC-SUPPLY

1. **Implémentation.** `rgie.ts` l. 237 : `!meta.supply?.trim()` → `missingData`, documentaire (l. 72), bloquant en
   neuf. `meta.supply` est un texte libre ; un projet créé par `emptyProject` reçoit d'office `'2 x 230V ~ 50Hz'`
   (`src/model/tree.ts` l. 256) ; un ancien fichier sans valeur reçoit `''` (`migrate.ts` l. 87).
2. **Exigence prétendue.** La tension et la nature du courant figurent sur l'unifilaire. Vérifié seulement « champ non
   vide » : ni la tension, ni la nature du courant ne sont contrôlées.
3. **Référence.** 3.1.2.1 a, p. 61 : « La tension et la nature du courant sont mentionnées sur le schéma unifilaire. »
   8.2.1 point 7, p. 275 : « la tension nominale de l’installation électrique; ». Non domestique : 3.1.2.2 b, p. 64,
   « les tensions nominales et la nature des courants; ».
4. **Champ.** Domestique et non domestique (sous deux articles) ; réseaux 230 V (2 × 230 V), 3 × 230 V, 3N × 400 V.
5. **Exceptions.** Aucune dérogation à la tension.
6. **Dates.** Sans transitoire.
7. **Plusieurs périodes.** Contexte du projet.
8. **Faux positifs / négatifs.** FN majeur : la valeur par défaut `2 x 230V ~ 50Hz` est réputée renseignée ; une
   installation 3N × 400 V dont l'auteur n'a pas changé le champ passe, avec en plus un mauvais nombre de pôles proposé
   (`polesFor`). FN : « 230 » (sans nature du courant) ou « abc » accepté. FP : aucun notable.
9. **Données.** `meta.supply`. Vide : constat ; prérempli : jamais signalé.
10. **Tests.** Aucun (`KNOWN_UNTESTED`). Manquants : vide (bloquant en neuf), valeur par défaut non confirmée, valeur
    sans nature du courant, 3 × 230 V, 3N × 400 V.
11. **Limites.** Texte libre analysé ailleurs par expression régulière (`/3\s*[x×]\s*230/`) ; pas de champ structuré
    tension / nombre de conducteurs / alternatif-continu.
12. **Classification.** Exigence RGIE vérifiée (mais vérification minimale).
13. **Verdict.** Corriger : structurer l'alimentation (liste 2 × 230 V, 3 × 230 V, 3N × 400 V, autre ; « ~ » ou « = ») ou,
    à défaut, exiger un nombre suivi de « V » et un indicateur de nature du courant ; marquer la valeur par défaut comme
    « à confirmer » (constat `insufficientData` non bloquant tant qu'elle n'a pas été confirmée) ; `article:
    '3.1.2.1 a'`. Tests ci-dessus.

---

## R-DOC-NUMBER

1. **Implémentation.** `rgie.ts` l. 238-239 : `!meta.docNumber?.trim()` → `missingData`, documentaire (l. 74),
   bloquant en neuf. `emptyProject` génère un numéro (`autoDocNumber`, `tree.ts` l. 224-255). Le cartouche imprime
   toujours une version (`rev?.version ?? '1'`) et une date (`rev?.date ?? m.date`) : `src/print/PrintDocument.tsx`
   l. 179-194.
2. **Exigence prétendue.** Numéro, version et date de la version sur les schémas, plans et documents. La règle ne
   vérifie que le numéro ; la version et la date sont assurées par l'impression (version « 1 » et date du projet par
   défaut).
3. **Référence.** 3.1.2, p. 61 : « Les schémas, les plans et les documents reprennent de manière univoque le numéro, la
   version et la date de la version. »
4. **Champ.** **Toutes** les installations (section 3.1.2, avant la distinction domestique / non domestique).
5. **Exceptions.** Aucune dérogation à cette phrase dans 8.2.1 point 7 ni 8.2.2 point 7.
6. **Dates.** Sans transitoire.
7. **Plusieurs périodes.** Contexte du projet ; une modification enregistrée sans nouvelle version reste muette
   (3.1.2.1 a : toute modification est reportée sur le plan de position).
8. **Faux positifs / négatifs.** FN : numéro automatique jamais revu, même numéro réutilisé pour deux dossiers
   (« univoque » non vérifiable) ; `meta.date` vide → la date imprimée est vide sans constat. FP : aucun.
9. **Données.** `meta.docNumber`, `meta.revisions`, `meta.date`.
10. **Tests.** `test/rules.matrix.test.ts > mentions RGIE 3.1.2 : numéro du dossier et qualité du responsable exigés`.
    Manquants : neuf bloquant / existant non bloquant, `meta.date` vide, numéro présent sans constat.
11. **Limites.** Unicité impossible à vérifier localement.
12. **Classification.** Exigence RGIE vérifiée.
13. **Verdict.** Corriger (petit) : signaler aussi l'absence de date imprimable (`meta.date` et dernière révision vides) ;
    `article: '3.1.2'`, `verifiedOn`. Garder documentaire.

---

## R-DOC-QUALITY

1. **Implémentation.** `rgie.ts` l. 240 : nom présent et `!meta.installer.quality?.trim()` → `missingData`,
   documentaire (l. 75), bloquant en neuf. Ne double pas `R-DOC-INSTALLER` quand le nom manque (choix sensé).
2. **Exigence prétendue.** La qualité du responsable figure avec son nom. Vérifié.
3. **Référence.** 3.1.2.1 a, p. 61 (même phrase que `R-DOC-INSTALLER` : « Les nom, qualité, numéro de T.V.A. (si
   d’application) … »). Modification non importante, p. 62 : « nom, qualité et adresse ».
4. **Champ.** Domestique ; neuf et modifications importantes.
5. **Exceptions.** 8.2.1 point 7 : non exigée dans les schémas simplifiés des parties d'avant 1981 ; 8.2.2 point 7 ne la
   dispense pas.
6. **Dates.** Sans transitoire.
7. **Plusieurs périodes.** Contexte du projet (idem `R-DOC-INSTALLER`).
8. **Faux positifs / négatifs.** FN : nom absent et qualité absente → seule `R-DOC-INSTALLER` (le message de celle-ci
   ne cite que le nom ; le conseil cite nom, qualité, TVA : acceptable). FP : non domestique.
9. **Données.** `meta.installer.name`, `meta.installer.quality`.
10. **Tests.** `test/rules.matrix.test.ts > mentions RGIE 3.1.2 : numéro du dossier et qualité du responsable exigés`.
    Manquants : existant non bloquant ; qualité présente sans constat ; nom absent → pas de `R-DOC-QUALITY`.
11. **Limites.** « Qualité » non définie par le texte (champ libre).
12. **Classification.** Exigence RGIE vérifiée.
13. **Verdict.** Garder ; ajouter `article: '3.1.2.1 a'` et les tests manquants. Question : formulation de la qualité
    pour un particulier.

---

## R-DOC-NOT-DRAWN

1. **Implémentation.** `rgie.ts` : collecte des faits `earth` (l. 248 : terre non dessinée et `meta.survey.earth ===
   'present'`), `rcd` (l. 426 : aucun différentiel ≤ 300 mA dessiné en amont d'un circuit et `presence()` = présent,
   c.-à-d. déclaration `survey.rcd = 'present'`), `rcd30` (l. 449) ; émission une fois par fait (l. 471), sans nœud →
   contexte du projet. Catalogue l. 77 : `missingData`, documentaire → `insufficientData`, bloquant en neuf.
2. **Exigence prétendue.** Un équipement déclaré présent sur place doit figurer sur le schéma. Vérifié pour trois faits.
3. **Référence.** 3.1.2.2 a, p. 64 : l'unifilaire reprend au moins « le type et les caractéristiques des dispositifs de
   protection à courant différentiel-résiduel; » → fondé pour `rcd` et `rcd30`. Pour `earth`, la liste 3.1.2.2 a
   (domestique) ne cite **pas** la prise de terre ; 3.1.2.1 b la demande pour le non domestique (« plans de position des
   prises de terre ») ; la figure 3.1 n'a pas été lue dans l'extrait texte → à vérifier.
4. **Champ.** Domestique et non domestique ; tous réseaux.
5. **Exceptions.** 8.2.1 point 7 : le schéma simplifié garde « le ou les dispositifs de protection à courant
   différentiel-résiduel avec leurs caractéristiques » → la règle reste fondée pour les parties anciennes (non
   bloquante, correct). 8.2.2 point 7 tolère l'absence du « type des dispositifs de protection » : seul le type, pas
   l'équipement.
6. **Dates.** Sans transitoire.
7. **Plusieurs périodes.** `meta.survey` est **global au projet** : « différentiel présent » vaut pour tous les
   circuits ; impossible de dire quelle partie est concernée ; le classement suit le projet, pas la partie.
8. **Faux positifs / négatifs.** FP : projet neuf où l'auteur a déclaré « 30 mA présent » pour une seule salle de bains :
   `R-RCD30` disparaît pour **tous** les circuits concernés (faux négatif de `R-RCD30`) et `R-DOC-NOT-DRAWN` bloque le
   dossier entier. FN : équipement présent mais mal dessiné (différentiel dessiné sans sensibilité → passe par
   `R-RCD-SENS-MISSING`, pas ici) ; autres équipements de 3.1.2.2 a (boîtes, sources) non couverts.
9. **Données.** `meta.survey.{earth, rcd, rcd30}`, arbre dessiné. Jamais « conforme » par défaut : sans déclaration,
   les règles physiques signalent l'inconnu.
10. **Tests.** `test/rules.matrix.test.ts` : « existant, présence confirmée mais non dessinée : schéma incomplet… »,
    « neuf, présence confirmée mais non dessinée : documentaire bloquant… », « terre dessinée (présente) : aucun constat
    de présence », « existant, absence confirmée : … présence confirmée : schéma incomplet », « 30 mA, local humide
    indiqué… ». Manquants : déclaration globale `rcd: 'present'` avec plusieurs circuits dont un seul protégé ; projet
    neuf contenant une partie existante ; dédoublonnage (un constat par fait).
11. **Limites.** Déclarations de relevé par projet, pas par circuit / tableau.
12. **Classification.** Exigence RGIE vérifiée pour `rcd` / `rcd30` ; interprétation pour `earth`.
13. **Verdict.** Corriger : (a) déclarations de présence par tableau ou circuit (au moins pour `rcd30`), constat attaché au
    nœud concerné pour être classé selon la partie ; (b) `article: '3.1.2.2 a'` pour `rcd` / `rcd30` ; pour `earth`,
    référence à confirmer (figure 3.1 ou 3.1.2.1 b) ou statut non bloquant. Question : la prise de terre doit-elle
    figurer sur l'unifilaire domestique ?

---

## R-CIRCUIT-NAME

1. **Implémentation.** `rgie.ts` l. 381-383 : pour chaque circuit (`isCircuit` : protection non en série avec câble et
   charge), `label = String(circuit.props.circuitName ?? '')` ; vide → `add('R-CIRCUIT-NAME')`. Catalogue l. 113 :
   `kind: 'recommendation'`, documentaire, `source: LIVRE1` (défaut de `r()`) → statut `recommendation`, non bloquant,
   neuf comme existant.
2. **Exigence prétendue.** Donner un nom lisible au circuit (affiché sur le schéma et les étiquettes). Choix de
   Voltaplan.
3. **Référence.** Aucune. Le RGIE impose l'identification des circuits par une **lettre** (3.1.2.1 a, p. 61 : « Chaque
   circuit élémentaire est identifié par une lettre majuscule de l'alphabet. »), assurée par la numérotation
   automatique, et le repérage sur place des dispositifs (3.1.3.1, p. 65 : « … repérés de manière claire, bien visible
   et indélébile par des repérages individuels, à moins que toute possibilité de confusion soit écartée ») — ce n'est
   pas un nom de circuit dans le dossier.
4. **Champ.** Tous projets.
5. **Exceptions.** Sans objet.
6. **Dates.** Sans objet.
7. **Plusieurs périodes.** Recommandation partout : correct.
8. **Faux positifs / négatifs.** FN : nom fait d'espaces (`'  '`) accepté (pas de `trim`). FP : circuit dont la fonction
   est évidente (ex. un seul appareil nommé) : simple recommandation, acceptable.
9. **Données.** `props.circuitName`.
10. **Tests.** `test/rules.matrix.test.ts > pas de correction quand elle n’est pas évidente (circuit sans nom)` (vérifie
    implicitement la présence). Manquants : statut `recommendation` non bloquant, nom d'espaces, nom présent.
11. **Limites.** Aucune notable.
12. **Classification.** Bonne pratique.
13. **Verdict.** Garder (non bloquante) ; corriger les métadonnées : `source: 'Voltaplan (bonne pratique)'` au lieu du
    Livre 1, et ne plus la ranger parmi les exigences documentaires du RGIE dans `REGULATORY-COVERAGE.md` (l. 115) ;
    ajouter `trim()`.

---

## R-COUNTRY-OPTION

1. **Implémentation.** `src/rules/index.ts` l. 67-90 (`countryOptionFindings`) : pour chaque nœud et chaque clé de
   `pack.options`, une valeur non vide absente de la liste → constat classé avec la fiche `R-COUNTRY-OPTION` du
   référentiel (`catalog.ts` l. 122 : `warning`, documentaire) → statut `warning`, non bloquant, contexte de la partie.
   **Le référentiel belge ne définit pas `options`** (`rgie.ts`, objet `belgium`) : la règle ne se déclenche jamais en
   Belgique aujourd'hui.
2. **Exigence prétendue.** Une désignation de matériel d'un autre pays n'est pas interchangeable. Choix de Voltaplan.
3. **Référence.** Aucune (cohérence de saisie multi-pays ; pas d'exigence RGIE).
4. **Champ.** Tout référentiel qui définit `options`.
5. **Exceptions.** Sans objet.
6. **Dates.** Sans objet.
7. **Plusieurs périodes.** Partie ancienne : une désignation d'époque hors liste serait signalée (avertissement) —
   acceptable si les listes incluent les anciennes désignations.
8. **Faux positifs / négatifs.** FP (futur) : valeurs importées (Trikker, Draadwijs) avec casse ou espaces différents
   (`'vob'`, `'VOB '`) ; FN : aucun en Belgique puisque la règle est inactive.
9. **Données.** `node.props[clé]`, `pack.options`.
10. **Tests.** `test/bom.test.ts > matériel propre à un pays > signale une désignation qui n’existe pas dans le pays du
    référentiel` (référentiel factice NL). Manquants : statut `warning` non bloquant, valeur vide ignorée, comparaison
    insensible à la casse si retenue.
11. **Limites.** Listes à maintenir par pays ; aucune pour la Belgique.
12. **Classification.** Bonne pratique.
13. **Verdict.** Garder (non bloquante) ; métadonnées : `source: 'Voltaplan'` ; documenter qu'elle est inactive pour
    BE-RGIE tant que `options` n'est pas défini.

---

## R-MEAS-MISSING

1. **Implémentation.** `rgie.ts` l. 274 : `earthResistanceOhm === undefined || insulationMOhm === undefined` →
   `knowledge: 'measureNeeded'` → `manualCheck`, non bloquant, neuf comme existant. Catalogue l. 86 : `manualCheck`,
   physique. Message : « Mesures non encodées (résistance de terre, isolement) » sans dire laquelle manque.
2. **Exigence prétendue.** La résistance de dispersion de la prise de terre et l'isolement sont mesurés et consignés.
   La règle rappelle que la mesure reste à faire ou à encoder ; elle ne conclut à rien.
3. **Référence.** 6.4.5.2, p. 202 : « … la résistance de dispersion des prises de terre de l’installation électrique
   concernée est mesurée. » 6.4.5.1, p. 201 : « Les mesures sont effectuées par l’organisme, agréé suivant le chapitre
   6.3., et concernent la résistance d’isolement entre chacune des parties actives et la terre. » 6.4.6.4 b.4, p. 203 :
   le rapport « contient la valeur de la résistance de dispersion de la prise de terre ainsi que la valeur du niveau
   d'isolement général ».
4. **Champ.** Domestique (6.4.6.4) ; contrôle de conformité avant mise en usage (neuf, modification importante).
   Tous schémas de liaison à la terre, tous réseaux.
5. **Exceptions.** 6.4.5.1 : mesure d'isolement facultative « sur les installations de mesure et de contrôle » et « sur
   les installations à très basse tension ». Partie 8 : pas de dérogation identifiée sur les mesures.
6. **Dates.** Sans transitoire.
7. **Plusieurs périodes.** Mesures globales au projet ; pas de mesure par partie / par circuit.
8. **Faux positifs / négatifs.** FP : dossier préparé **avant** le contrôle — la mesure est faite par l'organisme agréé,
   le constat est donc attendu (statut « vérification » non bloquant : correct). Installation entièrement TBT → isolement
   non requis mais signalé. FN : valeur encodée sans date ni appareil (`measuredOn`, `instrument`) acceptée.
9. **Données.** `measurements.earthResistanceOhm`, `measurements.insulationMOhm`. Absentes : vérification, jamais
   « conforme ».
10. **Tests.** `test/rules.matrix.test.ts > résistance de terre non mesurée : mesure nécessaire ; valeur mesurée trop
    élevée : non conforme` ; `test/rules.test.ts > mesures > signale un différentiel trop lent…` (absence du constat).
    Manquants : isolement seul manquant ; les deux manquants ; neuf non bloquant ; valeur 0 (définie).
11. **Limites.** Une seule valeur d'isolement (le texte parle d'un contrôle « pour chaque circuit », le rapport d'un
    niveau « général ») ; pas de champ « mesure faite par l'organisme agréé ».
12. **Classification.** Exigence RGIE vérifiée (rappel de mesure, statut adapté).
13. **Verdict.** Corriger (petit) : préciser laquelle manque (paramètre `missing: 'earth' | 'insulation' | 'both'`),
    rappeler dans le conseil que ces mesures sont faites par l'organisme agréé lors du contrôle ; `article: '6.4.5.1 ;
    6.4.5.2 ; 6.4.6.4 b.4'`, `verifiedOn`. Garder non bloquante. Question : faut-il exiger la date et l'appareil de mesure
    pour la page « Mesures » ?
