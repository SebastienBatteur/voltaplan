> Annexe du rapport `docs/audit/REGISTRE-RGIE-2026.md`. Document de travail de l’audit (27/11/2026), écrit sur le moteur **avant** les corrections de la branche `regulatory-registry` : les constats corrigés depuis sont listés dans le rapport. Les chemins `scratchpad/…` désignent des fichiers de travail non versionnés (extrait texte du RGIE, sondes).

# Audit des règles, lot g2 (terre, isolement, liaisons, essais des différentiels, salles de bain, borne, photovoltaïque, date de 2023)

Dépôt audité : `scratchpad/wt-engine` (branche `regulatory-registry`), lecture seule. Texte officiel : `scratchpad/livre1.txt`
(RGIE Livre 1, version 07 du 15/09/2026). Les pages indiquées sont les pages imprimées (pied de page « … | n » : le texte qui
précède un pied de page « | n » est sur la page n). Dans l'extrait texte, le symbole Ω est perdu à certains endroits
(« inférieure à 100 . ») ; il est rétabli dans les citations.

Points communs (valables pour les 11 règles) :

- Classement final : `classify()` (`src/rules/context.ts` l. 112-181). `nonCompliance` : partie neuve → non conforme,
  bloquant ; partie existante → `existing` du catalogue, sinon « non conforme » bloquant si gravité `high`.
  `missingData` → informations insuffisantes, bloquant seulement en neuf. `warning` / `manualCheck` → jamais bloquant.
  `knowledge` : `unknown` → informations insuffisantes ; `deduced` → anomalie potentielle ; `measureNeeded` → vérification.
- Le modèle ne distingue pas installation domestique / non domestique (`src/model/types.ts`) : tout le moteur suppose une
  installation domestique.
- Les mesures (`project.measurements`) sont **globales au projet** : une résistance de terre, une valeur d'isolement, un
  booléen pour les liaisons, un essai par différentiel (`src/model/types.ts` l. 132-141).
- Sondage d'exécution (`scratchpad/g2probe/probe.ts`, exécuté avec `vite-node` sans toucher au dépôt) : résultats cités
  ci-dessous comme « vérifié par exécution ».

---

## R-EARTH-MISSING — prise de terre absente

1. **Implémentation.** `src/rules/be/rgie.ts` l. 241-244 : `earthDrawn` = un nœud `kind === 'earth'` existe n'importe où ;
   `earthStated` = `meta.survey.earth` ; `presence(drawn, stated, projCtx.isNew)` (`src/rules/knowledge.ts` l. 35-39).
   Catalogue l. 74 : `nonCompliance`, gravité `high`, physique. Résultat : partie neuve non dessinée → non conforme,
   bloquant ; existante non dessinée → informations insuffisantes (non bloquant) + question ; absence confirmée → non
   conforme bloquant (neuf comme existant, toutes éditions) ; dessinée et déclarée absente → contradictoire (non
   bloquant) ; déclarée présente non dessinée → pas de constat, `R-DOC-NOT-DRAWN` à la place. Contexte = celui du
   projet (pas de nœud).
2. **Exigence.** L'installation domestique comporte une prise de terre. La règle vérifie la présence d'un symbole « prise
   de terre » dans le dessin (ou une déclaration), pas sa nature ni sa réalisation.
3. **Références.**
   - 4.2.3.2, p. 84 : « la prise de terre est réalisée conformément aux dispositions de la sous-section 5.4.2.1. »
   - 5.4.2.1 a, p. 174 : « La prise de terre est réalisée conformément soit aux dispositions du point b. ou du point c.
     pour les installations domestiques. »
   - 4.2.4.3 a, p. 100 : « Les masses du matériel électrique à basse tension de la classe I sont reliées au conducteur de
     protection ».
4. **Champ.** Domestique (le non-domestique relève des « règles de l'art », 5.4.2.1 a). Neuf et existant. Schéma TT
   (cas belge courant) et IT (3 × 230 V) : une prise de terre locale est nécessaire dans les deux cas. Indépendant du
   réseau (230 V, 3 × 230 V, 3N × 400 V).
5. **Exceptions.** Aucune dérogation à l'existence de la prise de terre trouvée dans la partie 8 ni en 6.5.8. 8.2.1, 12
   (p. 275) admet des canalisations sans conducteur de protection (pas d'appareil de classe I), pas l'absence de prise de
   terre. Prise de terre commune (5.4.2.1 c, p. 176, immeubles à appartements construits à partir du 1/6/2020) :
   l'unité d'habitation n'a pas de prise de terre propre ; elle est reliée au sectionneur de terre commun.
6. **Dates.** Exigence permanente. Boucle à fond de fouille pour tout nouveau bâtiment (5.4.2.1 b.1.1) ; prise de terre
   commune à partir du 1/6/2020.
7. **Anciennes / plusieurs périodes.** Une seule prise de terre pour tout le projet : le contexte est celui du projet. Une
   absence confirmée est bloquante même pour une partie d'avant 1981, ce qui est cohérent avec l'absence de dérogation.
8. **Faux positifs / négatifs.**
   - FP : appartement neuf raccordé à une prise de terre commune, l'utilisateur ne dessine que la barrette → non conforme
     bloquant.
   - FP : barrette de terre dessinée sans symbole « prise de terre » sous elle (neuf) → non conforme.
   - FN : un symbole de prise de terre suffit, quelle qu'en soit la nature (piquet seul dans un nouveau bâtiment aux
     fondations ≥ 60 cm alors que la boucle est obligatoire, 5.4.2.1 b.1.1) ; le nœud `earth` n'a aucune propriété.
   - Message `rule.R-EARTH-MISSING` (« Aucune prise de terre n'est dessinée ») inexact quand l'absence est confirmée.
9. **Données.** Nœud `earth` ; `meta.survey.earth` ; `installationKind`. Manquant en existant → inconnu (correct, ADR-0007).
10. **Tests.** `test/rules.matrix.test.ts` : « ancien RGIE (rgieVersion « old ») … », et tout le bloc « matrice RGIE —
    terre : inconnu ≠ absent » (7 cas) ; `test/rules.test.ts` > « référentiels par pays > Belgique (RGIE) par défaut ».
    Manquants : partie d'avant 1981 avec absence confirmée ; barrette sans prise de terre ; prise de terre commune.
11. **Limites du modèle.** Pas de type de prise de terre (boucle, piquet, conducteur horizontal, commune), pas de
    sectionneur de terre, pas de conducteur de terre (section 8.2.1, 11 : 6 mm² admis pour l'ancien).
12. **Classification.** Exigence RGIE vérifiée.
13. **Verdict.** Garder (correction mineure) : texte du message pour le cas « absence confirmée » ; à terme, propriété
    « prise de terre commune » sur le nœud (ou le projet) pour accepter une liaison au sectionneur commun, et type de prise
    de terre (vérification de la boucle pour un nouveau bâtiment). Question ouverte : un appartement neuf sur prise de
    terre commune doit-il dessiner la prise de terre commune elle-même ?

---

## R-EARTH-VALUE — résistance de dispersion ≥ 100 Ω

1. **Implémentation.** `rgie.ts` l. 245-250 : si `measurements.earthResistanceOhm` est défini et `re >= 100` →
   constat (paramètre `value`). Catalogue l. 75 : `nonCompliance`, `high`, `article: '4.2.3.2'`, vérifié le 2026-11-27.
   Non conforme et bloquant en neuf **et** en existant (gravité élevée), toutes éditions. Mesure absente → rien ici,
   `R-MEAS-MISSING` (vérification) l. 270.
2. **Exigence.** Résistance de dispersion de la prise de terre domestique strictement inférieure à 100 Ω. C'est bien ce
   qui est vérifié (100 Ω pile → non conforme).
3. **Références.** 4.2.3.2, p. 84 : « sa résistance de dispersion est inférieure à 100 Ω ». 6.4.5.2, p. 202 : la
   résistance de dispersion « est mesurée » lors du contrôle de conformité ; 6.5.6, p. 205 : les visites de contrôle
   comprennent « au moins les mesures définies à la section 6.4.5. ».
4. **Champ.** Domestique et parties communes d'un ensemble résidentiel. Non-domestique avec différentiel : renvoi à
   4.2.4.4 d (formule), non modélisé. Neuf et existant ; tous réseaux.
5. **Exceptions.** Aucune dérogation au seuil trouvée en partie 8 ni en 6.5.8. Seuil plus sévère (≤ 30 Ω) pour la prise
   de terre commune (5.4.2.1 c.2 1°, p. 176).
6. **Dates.** Seuil de 100 Ω présent dans la version 2026 ; aucune disposition transitoire.
7. **Anciennes / plusieurs périodes.** Mesure unique au niveau du projet : une installation à plusieurs bâtiments ou
   plusieurs prises de terre n'est pas représentable.
8. **FP / FN.** FN : prise de terre commune entre 30 et 100 Ω (voir R-EARTH-30). FP : installation non domestique
   (hors champ de l'application, non signalé). Valeur saisie dans une autre unité (kΩ) : non détectable.
9. **Données.** `measurements.earthResistanceOhm`. Manquante → `R-MEAS-MISSING`, jamais « conforme ».
10. **Tests.** `test/rules.matrix.test.ts` > « matrice RGIE — terre : inconnu ≠ absent > résistance de terre non mesurée :
    mesure nécessaire ; valeur mesurée trop élevée : non conforme » ; `test/rules.rgie2026.test.ts` > « M8 — résistance de
    terre « inférieure à 100 Ω » (RGIE 4.2.3.2) > 100 Ω pile : non conforme ; 99,9 Ω : règle des 30 Ω seulement ».
    Manquants : partie existante d'avant 1981 (bloquant attendu, vérifié par exécution : non conforme, bloquant) ; valeur
    négative ou nulle (saisie aberrante).
11. **Limites.** Une seule valeur ; pas de date ni de méthode de mesure liée ; pas de champ domestique / non domestique.
12. **Classification.** Exigence RGIE vérifiée.
13. **Verdict.** Garder. Option : refuser une valeur ≤ 0 à la saisie.

---

## R-EARTH-30 — résistance de dispersion > 30 Ω

1. **Implémentation.** `rgie.ts` l. 249 : `else if (re > 30)` (donc 30 < re < 100) → constat `warning` (catalogue l. 76 :
   `warning`, `medium`). Toujours « avertissement », jamais bloquant, quel que soit l'équipement différentiel dessiné.
2. **Exigence prétendue.** Au-delà de 30 Ω, des dispositions complémentaires sont exigées. La règle **ne vérifie pas** ces
   dispositions : elle rappelle seulement le seuil. Le conseil (« différentiels 30 mA supplémentaires ») est incomplet.
3. **Références.**
   - 4.2.4.3 b, 10e alinéa, p. 101 : « Chaque dispositif de protection à courant différentiel-résiduel reprend au maximum
     seize socles de prise de courant simples ou multiples. » Le même alinéa exige au moins deux différentiels à haute ou
     très haute sensibilité, l'assimilation d'un appareil fixe (ou d'un ensemble sous une même commande) à un socle, et
     un différentiel de 100 mA au plus par circuit ou groupe pour les circuits du 8e alinéa (raccordés aux différentiels
     supplémentaires d'origine).
   - 5.4.2.1 c.2 1°, p. 176 : « La prise de terre commune a une valeur de résistance de dispersion inférieure ou égale à
     30 Ohms. »
4. **Champ.** Domestique ; neuf et existant ; tous réseaux.
5. **Exceptions / dérogations.** Exécution entamée avant le 1/6/2023 : 6.5.8.1, 1, 3e alinéa (p. 207) ; 8.2.1, 16
   (p. 276) ; 8.2.2, 10 (p. 278) : un différentiel haute sensibilité pour tout l'éclairage et un par circuit ou groupe de
   seize socles au plus. Dernier alinéa de 4.2.4.3 b (p. 101) : application du point 1 de 6.5.8.1 aux projets entamés
   avant le 1/6/2023 et contrôlés à partir de cette date (organisme agréé informé).
6. **Dates.** Règle « deux différentiels + 100 mA » : exécution entamée à partir du 1/6/2023 ; prise de terre commune :
   immeubles à appartements construits à partir du 1/6/2020.
7. **Anciennes / plusieurs périodes.** Non pris en compte : la règle ne regarde pas la date.
8. **FP / FN.**
   - FN (important) : terre à 50 Ω, un seul différentiel 30 mA pour 20 socles → simple avertissement au lieu d'une non-
     conformité ; circuits du 8e alinéa sans 100 mA → rien.
   - FN : prise de terre commune à 45 Ω → avertissement au lieu d'une non-conformité (5.4.2.1 c.2 1°).
   - FP (bruit) : terre à 50 Ω avec une configuration conforme (deux 30 mA, ≤ 16 socles chacun, 100 mA) → avertissement
     persistant, sans moyen de le lever autrement que par une dérogation saisie.
   - Bornes : 30 Ω pile → rien (correct : « supérieure à 30 ohms ») ; vérifié par exécution.
9. **Données.** `earthResistanceOhm` ; pour une vraie vérification : différentiels (sensibilité ≤ 30 / ≤ 100 mA),
   socles et appareils fixes par différentiel (comme `fixedPoints`, l. 157-180), date d'exécution (`sinceDate`),
   prise de terre commune (absent du modèle).
10. **Tests.** `test/rules.rgie2026.test.ts` > « M8 … > 100 Ω pile : non conforme ; 99,9 Ω : règle des 30 Ω seulement ».
    Manquants : 30 Ω pile (rien), 30,1 Ω (avertissement), statut non bloquant, configuration conforme / non conforme,
    dérogation avant le 1/6/2023, prise de terre commune.
11. **Limites.** Pas de propriété « prise de terre commune » ; pas d'association explicite circuit ↔ différentiel
    d'origine supplémentaire (déductible de l'arbre).
12. **Classification.** Exigence RGIE vérifiée (seuil et conditions trouvés dans le texte) ; la règle actuelle n'en vérifie
    que le seuil.
13. **Verdict.** Corriger. Garder l'avertissement quand les données manquent ; quand `re > 30` et date connue ≥ 1/6/2023 :
    (a) moins de deux différentiels ≤ 30 mA en aval de l'origine → non conforme ; (b) un différentiel ≤ 30 mA alimentant
    plus de 16 points (socles + appareils fixes, même décompte que R-SOCKET-MAX) → non conforme ; (c) circuit sous un
    différentiel d'origine seul (min > 30 mA) sans différentiel ≤ 100 mA → non conforme. Date < 1/6/2023 : variante de
    la dérogation (un 30 mA pour l'éclairage, un par groupe ≤ 16 socles). Date inconnue → question R-RCD30-DATE. Prise de
    terre commune > 30 Ω → non conforme. Corriger `advice.R-EARTH-30` (seize socles, 100 mA). Tests : chaque cas
    ci-dessus, bornes 30 / 30,1 Ω et 16 / 17 socles. Question ouverte : les circuits du 8e alinéa sont-ils tous ceux qui ne
    sont pas sous un différentiel haute sensibilité (lecture proposée) ?

---

## R-INSULATION — résistance d'isolement < 0,5 MΩ

1. **Implémentation.** `rgie.ts` l. 251-252 : `measurements.insulationMOhm` défini et `< 0.5` → constat. Catalogue l. 77 :
   `nonCompliance`, `high` → non conforme bloquant en neuf et en existant (vérifié par exécution pour une partie de 1975).
   Valeur absente → `R-MEAS-MISSING`.
2. **Exigence.** Résistance d'isolement de chaque circuit ≥ 1000 × la tension d'essai, soit 0,5 MΩ sous 500 V continu
   pour un circuit de tension nominale ≤ 500 V. La règle compare **une valeur unique** (souvent le « niveau d'isolement
   général ») à 0,5 MΩ.
3. **Références.** 6.4.5.1, p. 201 : « est pour chaque circuit, les appareils d'utilisation étant déconnectés, au moins
   égale à 1000 fois la valeur en V de la tension de test précitée. » Tableau 6.1 (p. 201) : TBTS par transformateur de
   sécurité → 250 V / 250 kΩ ; tension ≤ 500 V → 500 V / 500 kΩ ; 500 V < U ≤ 1000 V → 1000 V / 1000 kΩ ; courant de
   1 à 5 mA. 6.5.6, p. 205 : mêmes mesures en visite de contrôle. 6.4.6.4 b.4-b.5, p. 203 : le rapport donne « la valeur
   du niveau d'isolement général » et mentionne « les éventuels circuits dont le niveau d'isolement est insuffisant ».
4. **Champ.** Tous réseaux domestiques usuels (230 V, 3 × 230 V, 3N × 400 V : tous ≤ 500 V → 0,5 MΩ correct). Neuf et
   existant. Mesure non exigée sur la très basse tension ni sur les installations de mesure et de contrôle (6.4.5.1).
5. **Exceptions.** Aucune dérogation au seuil en partie 8 ni en 6.5.8.
6. **Dates.** Permanente.
7. **Anciennes / plusieurs périodes.** Valeur unique pour tout le projet.
8. **FP / FN.**
   - FP : valeur « générale » mesurée sur tous les circuits en parallèle (1/R = Σ 1/Ri) : dix circuits à 2 MΩ chacun
     (tous conformes) donnent environ 0,2 MΩ → non conforme bloquant à tort. Le libellé des imports le confirme
     (`src/import/draadwijs.ts` l. 164 : `isolatieAlgemeen`).
   - FP : mesure faite appareils raccordés, ou sous une autre tension d'essai (non enregistrée).
   - FN : aucun si la valeur est la valeur générale ≥ 0,5 MΩ (chaque circuit est alors ≥ 0,5 MΩ) ; FN si la valeur saisie
     est celle d'un seul bon circuit.
   - Borne : 0,5 MΩ pile → rien (correct : « au moins égale ») ; vérifié par exécution.
9. **Données.** `measurements.insulationMOhm` (une valeur) ; il faudrait des valeurs par circuit et la tension d'essai.
10. **Tests.** **Aucun** : `R-INSULATION` est dans la liste `KNOWN()` des règles non testées
    (`test/regulatory-consistency.test.ts` l. 117). Manquants : 0,49 / 0,5 MΩ, existant, valeur absente.
11. **Limites.** Pas de mesure par circuit, pas de tension d'essai, pas de date de mesure par valeur.
12. **Classification.** Exigence RGIE vérifiée (seuil et tension d'essai exacts pour ≤ 500 V).
13. **Verdict.** Corriger : (a) ajouter les tests (et retirer `R-INSULATION` de `KNOWN()`) ; (b) distinguer la valeur
    générale d'une valeur par circuit : valeur générale < 0,5 MΩ → « vérification nécessaire » (mesure par circuit à
    faire), non bloquante, avec un message qui l'explique ; valeur par circuit < 0,5 MΩ (circuit ≤ 500 V) → non conforme
    bloquant ; (c) à terme, propriété `insulationMOhm` par circuit et seuil selon la tension nominale (0,25 MΩ en TBTS de
    sécurité). Question ouverte : l'organisme agréé considère-t-il la valeur générale < 0,5 MΩ comme une infraction en
    soi ?

---

## R-BONDING — liaisons équipotentielles

1. **Implémentation.** `rgie.ts` l. 253-255 : `measurements.bondingOk === false` → constat (non conforme ; catalogue
   l. 78 : `nonCompliance`, `high` → bloquant en neuf et en existant, toutes éditions) ; `undefined` → même règle avec
   `knowledge: 'measureNeeded'` → vérification, non bloquant.
2. **Exigence.** Liaison équipotentielle principale présente et conforme, liaisons supplémentaires là où elles sont
   imposées (salles de bain), continuité vérifiée. Un seul booléen global représente les trois.
3. **Références.**
   - 4.2.3.4 a.4, p. 89 : « Dans chaque bâtiment (tant dans les installations domestiques que dans les installations non-
     domestiques), une liaison équipotentielle principale est obligatoire. »
   - 4.2.3.2, p. 84 (éléments à relier) ; 5.4.4.1, p. 181 (section ≥ moitié du plus gros conducteur de protection, 6 mm²
     minimum, plafond 25 mm² Cu ; vert-jaune) ; 5.4.4.2, p. 181 (supplémentaires : 2,5 / 4 mm²).
   - 7.1.4.4, p. 232 : liaison équipotentielle supplémentaire dans le lieu contenant une baignoire ou une douche.
   - 6.4.6.4 b.4, p. 203 et 6.5.7.2 b.4 f, p. 206 : contrôle de la continuité des liaisons (principale et supplémentaire).
4. **Champ.** Domestique et non domestique ; neuf et existant ; tous réseaux.
5. **Exceptions.**
   - 8.2.1, 13, p. 276 (parties d'avant le 1/10/1981) : « la liaison équipotentielle principale ne soit pas présente »
     est admis. Le texte renvoie au « point a.5 de la sous-section 4.2.3.4. », alors que l'obligation est au point a.4
     dans la version 2026 (renvoi apparemment non mis à jour).
   - 8.2.1, 15.2, p. 276 : absence de la liaison supplémentaire de salle de bain admise (pré-1981, volume 2 porté à 1 m).
   - 6.5.8.1, 3.4, p. 209 (appliqué aussi par 8.2.1, 15.1 et 8.2.2, 11) : liaison supplémentaire incomplète admise pour
     les salles de bain dont l'exécution a été entamée avant le 1/3/2025.
6. **Dates.** 1/10/1981 (principale) ; 1/3/2025 (supplémentaire de salle de bain).
7. **Anciennes / plusieurs périodes.** Le constat est classé avec le contexte du projet : une partie d'avant 1981 reste
   bloquante. Vérifié par exécution : installation de 1975, `bondingOk: false` → non conforme, bloquant.
8. **FP / FN.**
   - FP : installation d'avant 1981 sans liaison principale (« non » saisi) → non conforme bloquant, alors que 8.2.1, 13 le
     permet.
   - FP : salle de bain d'avant le 1/3/2025 à liaison supplémentaire incomplète → bloquant (6.5.8.1, 3.4).
   - FN : « oui » global alors qu'une salle de bain n'a pas de liaison supplémentaire.
   - Message : `rule.R-BONDING` (« notées non conformes ») est aussi affiché pour le cas « non vérifié ».
9. **Données.** `measurements.bondingOk` ; manquant → vérification (correct).
10. **Tests.** `test/rules.matrix.test.ts` > « matrice RGIE — différentiels : inconnu ≠ absent > liaisons équipotentielles
    non vérifiées : mesure nécessaire ; « non » saisi : non conforme » ; `test/rules.test.ts` > « mesures > signale un
    différentiel trop lent et une liaison équipotentielle non conforme ». Manquants : partie d'avant 1981, salle de bain
    d'avant 2025, installation neuve avec « non ».
11. **Limites.** Un booléen pour trois exigences ; pas de section du conducteur d'équipotentialité ; pas de lien avec les
    locaux `wetRoom`.
12. **Classification.** Exigence RGIE vérifiée.
13. **Verdict.** Corriger : scinder en trois données (principale présente / supplémentaire des salles de bain / continuité
    mesurée) ; pour l'absence de la liaison principale dans une partie `pre1981` → statut « dérogation possible » (non
    bloquant, référence 8.2.1, 13) ; pour la supplémentaire d'une salle de bain d'avant le 1/3/2025 → vérification non
    bloquante (6.5.8.1, 3.4) ; continuité défaillante → non conforme bloquant partout. Texte distinct pour le cas « non
    vérifié ». Tests pour chaque cas. Question ouverte : le renvoi « a.5 » de 8.2.1, 13 vise-t-il bien l'obligation a.4 ?

---

## R-RCD-TEST — essai du différentiel

1. **Implémentation.** `rgie.ts` l. 258-263 : pour chaque entrée de `measurements.rcdTests` dont le nœud existe,
   `ok === false` → constat (catalogue l. 79 : `nonCompliance`, `high` → bloquant neuf et existant). l. 268-269 : chaque
   différentiel (`isRcd` : `device` `rcd`/`rcbo` ou `residualCurrent > 0`, `src/model/tree.ts` l. 129-131) sans entrée →
   même règle, `measureNeeded` → vérification, non bloquant. Une entrée dont l'id ne correspond plus à aucun nœud est
   ignorée.
2. **Exigence.** Chaque différentiel fonctionne (bouton de test et déclenchement sur courant de défaut). Ce que vérifie la
   règle : le résultat déclaré par l'utilisateur.
3. **Références.**
   - 6.5.7.2 b.4 d et e, p. 206 (rapport de visite de contrôle) : contrôle « via leur propre bouton de test » et via « la
     création d'un courant de défaut entre 2,5 et 2,75 fois la sensibilité de l'appareil ».
   - 7.112.3, p. 270 (photovoltaïque) : courant de défaut « de minimum une fois la sensibilité nominale de l'appareil ».
   - 6.4.4, p. 201 : les modalités des contrôles par essais lors du contrôle de conformité sont fixées par arrêté
     ministériel (non contenu dans le Livre 1).
   - 4.2.4.3 b, p. 100-101 : les différentiels exigés (un différentiel qui ne fonctionne pas n'assure pas la protection).
4. **Champ.** Domestique ; neuf et existant ; tous réseaux.
5. **Exceptions.** Aucune.
6. **Dates.** Permanente.
7. **Anciennes / plusieurs périodes.** Classement selon la partie du différentiel (constat par nœud) ; reste bloquant en
   existant (gravité élevée), ce qui est cohérent.
8. **FP / FN.** FN : essai ancien enregistré pour un différentiel remplacé par un autre (nouvel id → essai demandé, correct ;
   même nœud modifié → ancien essai conservé). FN : essai noté sans mention du courant d'essai ni du bouton de test. FP :
   aucun connu.
9. **Données.** `measurements.rcdTests[id].ok` ; absent → vérification (correct).
10. **Tests.** `test/rules.matrix.test.ts` > « matrice RGIE — différentiels : inconnu ≠ absent > essai du différentiel non
    noté : mesure nécessaire ; essai noté : plus de constat » ; `test/rules.rgie2026.test.ts` > « Interprétations
    incertaines : jamais bloquantes (dossier de validation externe) > essai déclaré non conforme par l'installateur : reste
    bloquant ». Manquants : disjoncteur différentiel (`rcbo`), partie existante, entrée orpheline (id inconnu).
11. **Limites.** Pas de champ « bouton de test » / « courant de défaut » séparés, pas de date d'essai par différentiel.
12. **Classification.** Exigence RGIE vérifiée (essai de fonctionnement prévu au rapport de visite et pour le PV ;
    modalités du contrôle de conformité hors Livre 1).
13. **Verdict.** Garder. Option : distinguer « bouton de test » et « courant de défaut » ; signaler les entrées orphelines
    (essai d'un différentiel supprimé) dans l'interface.

---

## R-RCD-TRIP — temps de déclenchement

1. **Implémentation.** `rgie.ts` l. 261, 265 : `max = 500` si `rcdType` contient « S », sinon 300 ; si `ok !== false` et
   `tripMs > max` → constat avec `status: 'warning'` imposé → avertissement, jamais bloquant (catalogue l. 80 dit
   `nonCompliance`, mais le statut imposé l'emporte, `context.ts` l. 143-144).
2. **Exigence prétendue.** Déclenchement au courant nominal différentiel en 300 ms au plus (500 ms pour un sélectif).
3. **Références.** **Aucune dans le RGIE.** Aucune occurrence de « 300 ms » ou « 500 ms » dans le Livre 1 (recherche dans
   tout l'extrait). Les essais exigés (6.5.7.2 b.4 d-e, p. 206 ; 7.112.3, p. 270) ne fixent pas de temps. Les valeurs
   viennent des normes de produit (EN 61008 / EN 61009, citées dans le code, non accessibles ici : non vérifiées).
4. **Champ.** Tous différentiels avec un temps saisi.
5. **Exceptions.** Différentiel sélectif (type S) : **non représentable** — `rcdType` n'accepte que `AC`, `A`, `F`, `B`
   (`src/model/schema.ts` l. 111) : la branche 500 ms est du code mort.
6. **Dates.** Aucune.
7. **Anciennes.** Sans objet.
8. **FP / FN.**
   - FP : différentiel sélectif de tête à 400 ms (valeur plausible pour un type S selon la norme, non vérifiée) →
     avertissement « temps trop long » ; vérifié par exécution (type A, 400 ms → avertissement, max 300).
   - FP / FN : le courant d'essai n'est pas enregistré (un temps mesuré à 5 × IΔn n'a pas le même seuil normatif).
   - Le conseil (`advice.R-RCD-TRIP` : « dans le temps prescrit : remplacez-le ») présente une valeur normative comme une
     prescription et recommande un remplacement pour un simple avertissement.
9. **Données.** `rcdTests[id].tripMs`, `rcdType`. Absent → rien (R-RCD-TEST demande déjà l'essai).
10. **Tests.** `test/rules.rgie2026.test.ts` > « Interprétations incertaines … > M10 — temps de déclenchement au-delà de
    300 ms : avertissement, pas une non-conformité (valeur normative, non RGIE) » ; `test/rules.test.ts` > « mesures >
    signale un différentiel trop lent et une liaison équipotentielle non conforme ». Manquants : 300 ms pile (rien),
    sélectif (impossible aujourd'hui), essai `ok: false` avec temps long (seul R-RCD-TEST attendu).
11. **Limites.** Pas de type S / retardé, pas de courant d'essai.
12. **Classification.** Exigence insuffisamment documentée (valeurs normatives non vérifiées, absentes du RGIE).
13. **Verdict.** Rendre non bloquante (c'est déjà le cas en pratique) et corriger : mettre le catalogue en `kind: 'warning'`
    (cohérence), ajouter une propriété « sélectif (S) » (ou l'option dans une propriété distincte de `rcdType`, qui
    décrit la forme d'onde), enregistrer le courant d'essai, reformuler le message et le conseil (« valeur indicative des
    normes de produit, à confirmer ») sans « remplacez-le ». Tests : 300 / 301 ms, sélectif 400 / 501 ms. Question ouverte
    (déjà la question 13 du dossier de validation) : quelle valeur l'organisme agréé applique-t-il ?

---

## R-WETROOM-NAME — nom évoquant une salle de bain

1. **Implémentation.** `rgie.ts` l. 426-448 ; regex `WET_ROOM` l. 61 :
   `/salle\s*de\s*bain|sdb|douche|badkamer|bathroom|\bbad\b|wellness|sauna|piscine|zwembad/i`. Par circuit : si aucun
   nœud n'a `wetRoom: 'yes'`, qu'un nœud sans `wetRoom: 'no'` a un nom/emplacement qui correspond, que le circuit n'est
   pas sous un différentiel ≤ 30 mA, que R-RCD30 ne s'applique pas déjà, et que `meta.survey.rcd30 !== 'present'` →
   constat `knowledge: 'deduced'` → anomalie potentielle, non bloquante, `inferred`. Catalogue l. 109 : `manualCheck`,
   `high`.
2. **Exigence sous-jacente.** Les circuits d'un lieu contenant une baignoire ou une douche sont sous un différentiel à
   haute ou très haute sensibilité. La règle ne vérifie pas l'exigence : elle signale une information probablement
   manquante (`wetRoom`).
3. **Références.** 4.2.4.3 b, 5e alinéa, point 3, p. 101 : « les lieux contenant une baignoire et/ou une douche tels que
   visés au chapitre 7.1. » ; 7.1.4.3, p. 232 : les circuits alimentant ce lieu « sont protégés par un ou plusieurs
   dispositifs de protection à courant différentiel-résiduel à haute ou à très haute sensibilité. » Haute sensibilité :
   ≤ 30 mA en alternatif (définitions, chapitre 2). Délimitation du lieu : 7.1.1.1, p. 215 (4 m des arrivées d'eau
   fixes, 3 m de haut, parois ≥ 2,25 m).
4. **Champ.** Domestique ; neuf et existant ; tous réseaux.
5. **Exceptions.** 7.1.4.3 : circuits en TBTS, en séparation de sécurité ou d'installation de sécurité. Les dérogations des
   salles de bain (6.5.8.1, 3 ; 8.2.1, 15 ; 8.2.2, 11) portent sur les volumes, les canalisations et les liaisons, **pas**
   sur le différentiel haute sensibilité ; 8.2.1, 16 et 8.2.2, 10 ne dérogent qu'aux points 1 et 2 du 5e alinéa (prises,
   éclairage). Le 30 mA de salle de bain vaut donc aussi pour l'existant.
6. **Dates.** Délimitation du lieu modifiée au 1/3/2025 (7.1.1.2, p. 215 ; 6.5.8.1, 3) : sans effet sur le 30 mA.
7. **Anciennes / plusieurs périodes.** Correct (pas de date).
8. **FP / FN** (vérifié par exécution) :
   - FN : « Salle d'eau », « Shower », « Badezimmer », « Dusche » → aucun constat (l'application existe en allemand et en
     anglais ; « salle d'eau » est le terme français courant pour une pièce avec douche).
   - FP de fond : « Sauna », « Piscine », « Zwembad », « Wellness » → anomalie « salle de bain » ; saunas (7.3) et piscines
     (7.2) ont leurs propres règles ; le conseil (« Si oui, un différentiel de 30 mA est exigé ») est alors inexact.
   - FN : `meta.survey.rcd30 = 'present'` (un 30 mA existe quelque part) supprime le constat pour **tous** les circuits,
     même ceux qui ne sont pas sous ce 30 mA.
   - `\bbad\b` peut correspondre à l'anglais « bad » (rare).
9. **Données.** `circuitName`, `name`, `location`, `wetRoom`, sensibilité des différentiels, `meta.survey.rcd30`.
10. **Tests.** `test/rules.matrix.test.ts` > « matrice RGIE — locaux humides > nom évocateur sans indication : anomalie
    potentielle (information déduite), pas une non-conformité » et « … > nom évocateur mais « non » indiqué : plus de
    constat ». Manquants : nom sous un 30 mA (rien), variantes de langue, sauna / piscine, interaction avec
    `survey.rcd30`.
11. **Limites.** Pas de notion de pièce ; l'indice repose sur du texte libre.
12. **Classification.** Recommandation (invite à confirmer une donnée, exigence sous-jacente RGIE vérifiée par R-RCD30).
13. **Verdict.** Corriger : regex complétée (`salle\s*d['’]\s*eau`, `shower`, `dusche`, `badezimmer`, `baignoire`) ; sauna,
    piscine, zwembad, wellness retirés (ou dirigés vers un rappel « emplacement spécial, chapitres 7.2 / 7.3 » distinct) ;
    ne plus supprimer le constat sur la seule déclaration globale `survey.rcd30` (ou seulement si le circuit est sous un
    différentiel de sensibilité inconnue). Tests pour chaque variante.

---

## R-EV-MANUAL — borne de recharge

1. **Implémentation.** `rgie.ts` l. 342 : tout nœud `appliance` de type `evCharger` → constat (catalogue l. 111 :
   `manualCheck`, `medium`) → vérification manuelle, jamais bloquante, sans condition de date ni de configuration.
2. **Exigence.** Rappel : les exigences du chapitre 7.22 ne sont pas vérifiées automatiquement (sauf le circuit dédié,
   R-DEDICATED-CIRCUIT).
3. **Références.**
   - 7.22.1, p. 248 : chapitre applicable aux bornes « dont leur réalisation ou leur remplacement est entamé(e) à partir
     du 1/11/2022 ».
   - 7.22.3, p. 248 : « Il est interdit de connecter une borne de charge sur une installation électrique fixe au moyen
     d'une prise de courant. » ; « Un circuit dédié est prévu pour chaque point de connexion. »
   - 7.22.4.1, p. 251 : chaque circuit dédié en alternatif est protégé individuellement par un différentiel de 30 mA au
     plus ; fonctionnement garanti avec une composante continue, ou différentiel associé à un dispositif de détection de
     courant continu ; TN-C interdit.
   - 7.22.4.2 (surintensités par circuit), 7.22.5.1 (IP44 à ciel ouvert), 7.22.5.2 (coupure d'urgence dans un bâtiment, sauf
     unité d'habitation), 7.22.5.4 (réinjection : avertissement), 7.22.5.5 (pas en BE3), p. 251-252.
4. **Champ.** Domestique et non domestique ; bornes réalisées ou remplacées à partir du 1/11/2022 ; avant : règles
   générales.
5. **Exceptions.** Schéma IT (7.22.4.1) ; bornes antérieures au 1/11/2022.
6. **Dates.** 1/11/2022.
7. **Anciennes / plusieurs périodes.** Ignoré : une borne de 2015 reçoit le même rappel (vérifié par exécution).
8. **FP / FN.**
   - FN : borne raccordée par une prise (dessinée sous un socle) dans une installation postérieure au 1/11/2022 → simple
     rappel, alors que c'est interdit (vérifié par exécution : `R-DEDICATED-CIRCUIT` ne se déclenche pas si la borne est
     seule).
   - FN : circuit de borne sans différentiel ≤ 30 mA individuel → non vérifié.
   - Le conseil cite « type A avec détection des courants continus, ou type B » : le RGIE formule l'exigence autrement
     (fonctionnement garanti avec composante continue, ou différentiel + détection continue) ; « sectionnement » dans le
     message ne correspond pas exactement à 7.22.5.2 (coupure d'urgence).
   - Une borne dessinée autrement qu'en `appliance/evCharger` n'est pas reconnue.
9. **Données.** `applianceType`, date de la partie ; pour automatiser : parent `socket`, différentiel individuel, sensibilité.
10. **Tests.** `test/rules.matrix.test.ts` > « matrice RGIE — installations particulières > borne de recharge et
    photovoltaïque : vérifications manuelles signalées ». Manquants : borne sous une prise, borne d'avant le 1/11/2022.
11. **Limites.** Pas de type de borne, de points de connexion, d'emplacement extérieur, de détecteur de courant continu.
12. **Classification.** Recommandation (rappel de vérification ; chapitre 7.22 vérifié dans le texte).
13. **Verdict.** Garder le rappel et corriger : (a) nouvelle vérification automatique « borne raccordée par une prise »
    (7.22.3) pour une partie réalisée à partir du 1/11/2022 (date inconnue → vérification) ; (b) différentiel ≤ 30 mA
    propre au circuit de la borne (7.22.4.1), même date ; (c) conseil reformulé selon 7.22.4.1, mention de la date du
    1/11/2022. Tests correspondants.

---

## R-PV-MANUAL — installation photovoltaïque

1. **Implémentation.** `rgie.ts` l. 462-464 : premier nœud `solarPanel`, ou `inverter` dont `inverterType` vaut `dcAc`
   (valeur par défaut) → un seul constat pour le projet (catalogue l. 112 : `manualCheck`, `medium`) → vérification
   manuelle, jamais bloquante.
2. **Exigence.** Rappel des mesures propres aux installations photovoltaïques domestiques.
3. **Références.** 7.112.1, p. 270 : installations photovoltaïques domestiques « à basse tension (≤ 10 kVA) ». 7.112.2,
   p. 270 : documents (9.1.2), repérage des conducteurs continu / alternatif, panneaux « Ne pas déconnecter en charge » et
   « Installation électrique toujours sous tension », mise à la terre des cadres (sauf interdiction du fabricant), section
   ≥ celle du conducteur de protection alternatif, minimum 2,5 / 4 mm². 7.112.3, p. 270 : essais (découplage en moins de
   5 secondes, absence de production sans réseau, essais des différentiels). 7.112.4 : données du rapport. 8.2.2, 7,
   p. 277 : description écrite simplifiée admise pour l'existant.
4. **Champ.** Domestique ≤ 10 kVA (au-delà, ou non domestique : règles générales). Neuf et existant (essais aussi en
   visite de contrôle).
5. **Exceptions.** 8.2.2, 7 (documents simplifiés). Aucune date d'entrée en vigueur propre au chapitre 7.112 trouvée.
6. **Dates.** Aucune.
7. **Anciennes.** Sans objet.
8. **FP / FN.** Onduleur hybride dessiné sans type → traité comme PV (défaut `dcAc`, acceptable). Le conseil cite la
   « déclaration au gestionnaire de réseau » (exigence hors RGIE, prescriptions du gestionnaire : non vérifiable ici) et
   un « sectionneur » que 7.112 ne cite pas expressément ; il omet la mise à la terre des cadres et les panneaux
   d'avertissement. Puissance > 10 kVA : même rappel, chapitre non applicable.
9. **Données.** `kind`, `inverterType` ; puissance AC de l'onduleur pour le seuil 10 kVA (absente ou non utilisée).
10. **Tests.** `test/rules.matrix.test.ts` > « matrice RGIE — installations particulières > borne de recharge et
    photovoltaïque : vérifications manuelles signalées » ; `test/converters.test.tsx` > « convertisseurs (RGIE tableau 2.23,
    H. Sources) > le rappel photovoltaïque ne vise pas un convertisseur de batterie ». Manquants : panneaux sans onduleur,
    > 10 kVA.
11. **Limites.** Pas de puissance d'onduleur exploitée, pas de conducteur de protection des cadres, pas d'étiquetage.
12. **Classification.** Recommandation (rappel de vérification ; chapitre 7.112 vérifié dans le texte).
13. **Verdict.** Garder et corriger le texte : conseil aligné sur 7.112.2-7.112.3 (repérage, deux panneaux
    d'avertissement, mise à la terre des cadres 2,5 / 4 mm², essais de découplage < 5 s) ; « déclaration au gestionnaire »
    présentée comme hors RGIE ; préciser « domestique ≤ 10 kVA ».

---

## R-RCD30-DATE — date du tableau inconnue (règles 30 mA du 1/6/2023)

1. **Implémentation.** `rgie.ts` : `sinceDate` l. 116-128 (ordre : `installedOn` du plus proche au plus lointain ;
   `rgie2023` du tableau ; `meta.installationDate` ; neuf → oui ; sinon inconnu ; partie d'une édition antérieure → non),
   `boardOf` l. 131, `askDate` l. 364-367. Question posée (l. 439) pour un circuit de prises « générales » ou d'éclairage
   pas sous ≤ 30 mA quand la date est inconnue, et (l. 458) pour un 30 mA de plus de 8 circuits. l. 460 : un constat par
   tableau, `params { count, board2023 }`, `knowledge: 'unknown'`. Catalogue l. 92 : `missingData`, `high` →
   informations insuffisantes, bloquant seulement en neuf (jamais atteint : neuf → date « oui »). Question de l'assistant :
   `src/assist/unconfirmed.ts` l. 138-152.
2. **Exigence.** Savoir si la partie relève des 5e et 6e alinéas de 4.2.4.3 b (prises et éclairage sous 30 mA ; 8 circuits
   au plus par 30 mA) ou de la dérogation pour une exécution entamée avant le 1/6/2023.
3. **Références.**
   - 6.5.8.1, 1, p. 207 : « pour les installations électriques dont l'exécution sur place a été entamée avant le
     01/06/2023, de ne pas protéger les circuits visés aux points 1 et 2 » par un différentiel haute sensibilité ; idem
     pour plus de huit circuits par différentiel ; dérogation étendue aux « modification ou extension non-importante ».
   - 4.2.4.3 b, dernier alinéa, p. 101 : application du point 1 de 6.5.8.1 aux projets entamés avant le 01/06/2023 dont le
     contrôle a lieu à partir de cette date, l'organisme agréé étant informé.
   - 8.2.1, 16, p. 276 et 8.2.2, 10, p. 278 : mêmes dérogations pour les parties d'avant 2020, sans date.
4. **Champ.** Domestique ; parties existantes réalisées depuis le 1/6/2020 (6.5.8.1 vise les parties « qui ont fait l'objet
   d'un contrôle de conformité avant la mise en usage ») et projets entamés avant le 1/6/2023.
5. **Exceptions.** Modification ou extension **importante** après le 1/6/2023 : dérogation perdue pour les circuits concernés.
6. **Dates.** 1/6/2023 (exécution sur place entamée).
7. **Anciennes / plusieurs périodes.** Bien géré par `installedOn` par partie et par la réponse par tableau.
8. **FP / FN** (vérifiés par exécution) :
   - FN (important) : `installationDate = '2023'` (année seule) → normalisée en 2023-01-01 (`normDate`, `context.ts`
     l. 29-35) → dérogation appliquée **en silence** : ni R-RCD30, ni question. Même défaut pour toute date-année égale
     à l'année d'une date pivot (2025 pour `RGIE_2025`).
   - FN (important) : circuit dont la chaîne ne contient aucun tableau (protection directement sous le compteur ou le
     différentiel de tête, ce que le modèle permet : `origin`/`meter`/`protection` acceptent des `protection`) → date
     inconnue, `askDate` ne trouve pas de tableau → **aucun constat** ; l'information inconnue devient « conforme ».
   - Libellé : la question « tableau fait ou refait avant ou après le 1/6/2023 » ne correspond pas exactement au critère
     du RGIE (début de l'exécution sur place de l'installation ou de la modification importante) : un tableau remplacé en
     2024 dans une installation de 2021 (modification non importante) relève encore de la dérogation.
   - FP : aucun (constat non bloquant en existant).
9. **Données.** `installedOn` (par nœud), `rgie2023` (tableau), `meta.installationDate`, `installationKind`.
10. **Tests.** `test/rules.matrix.test.ts` > « matrice RGIE — existant sans date : question « tableau fait ou refait avant /
    après le 1/6/2023 » » (3 cas : une question par tableau ; réponse « après » / « avant » ; question pour l'assistant) ;
    > « matrice RGIE — 30 mA depuis le 1/6/2023 … > au plus 8 circuits par 30 mA … dérogation avant le 1/6/2023 ».
    Manquants : date « 2023 » (année seule), circuit sans tableau, question déclenchée par R-RCD30-MAX seul, partie neuve
    dans une installation existante (pas de question), 31/05/2023 / 01/06/2023 aux bornes.
11. **Limites.** Pas de distinction « date de début d'exécution » / « date de contrôle » ; pas de notion de modification
    importante ; `installationDate` sans sémantique précise.
12. **Classification.** Exigence RGIE vérifiée (date pivot et dérogations trouvées dans le texte).
13. **Verdict.** Corriger : (a) date à l'année seule égale à l'année pivot (ou au mois du pivot si le jour manque, à
    vérifier selon le pivot) → « inconnu », donc question ; plus généralement, faire renvoyer à `normDate` la précision de
    la date ; (b) sans tableau dans la chaîne → constat rattaché au circuit (ou au projet) au lieu de rien ; (c) reformuler
    la question : « l'exécution sur place de ce tableau et de ses circuits a-t-elle commencé avant ou après le
    1/6/2023 ? » ; (d) mentionner la condition « organisme agréé informé » (dernier alinéa de 4.2.4.3 b) pour un projet
    entamé avant et contrôlé après. Tests : « 2023 » → question ; « 2023-05-31 » → dérogation ; « 2023-06-01 » → règles ;
    circuit sans tableau → constat. Question ouverte : le remplacement d'un tableau est-il une « modification importante »
    au sens du RGIE ?

---

## Annexe : points du contre-audit externe (vérifiés indépendamment dans le texte)

### a) R-INSULATION : valeur minimale selon la tension

Confirmé. 6.4.5.1, p. 201 : la résistance d'isolement de chaque circuit (appareils déconnectés, mesure en courant
continu, appareil capable de fournir la tension d'essai sous 1 à 5 mA) est « au moins égale à 1000 fois la valeur en V de
la tension de test ». **Tableau 6.1, p. 201** (« Valeurs minimales de la résistance d'isolement ») :

| Tension nominale du circuit | Tension d'essai (V continu) | Résistance minimale |
| --- | --- | --- |
| TBT alimentée par un transformateur de sécurité | 250 | 250 kΩ |
| ≤ 500 V (hors cas ci-dessus) | 500 | 500 kΩ (0,5 MΩ) |
| 500 V < U ≤ 1000 V | 1000 | 1000 kΩ (1 MΩ) |

La mesure n'est pas exigée sur la très basse tension ni sur les installations de mesure et de contrôle (même sous-section).
Le tableau fixe la tension d'essai **d'après la tension nominale** : ce n'est pas un choix de l'opérateur. Tous les
réseaux domestiques du modèle (230 V, 3 × 230 V, 3N × 400 V) sont « ≤ 500 V » → essai à 500 V, seuil 0,5 MΩ : le seuil
du moteur est exact pour eux.

Tension d'essai inconnue, proposition : (1) déduire la tension d'essai attendue de la tension nominale (`meta.supply`) :
réseau connu ≤ 500 V → seuil 0,5 MΩ appliqué ; (2) si une tension d'essai est enregistrée et diffère de celle du tableau
(par exemple 250 V sur un circuit 230 V), la mesure ne permet pas de conclure → « vérification nécessaire », non
bloquante, quelle que soit la valeur ; (3) réseau inconnu ou > 500 V → pas de conclusion automatique, vérification ;
(4) ne jamais conclure « conforme » sans valeur. À ajouter au modèle : tension d'essai et valeur par circuit (voir la
section R-INSULATION pour la valeur générale en parallèle).

### b) R-EARTH-30 : protections supplémentaires réellement évaluées ?

**Non.** `rgie.ts` l. 249 émet un avertissement générique dès que 30 < R < 100 Ω ; rien dans le moteur ne compte les
différentiels haute sensibilité, les socles par différentiel ou les 100 mA. L'évaluation proposée est détaillée dans la
section R-EARTH-30 (point 13). En résumé :

- Déclenchement : `earthResistanceOhm > 30` (strict).
- Date (`sinceDate(…, '2023-06-01')` par tableau) : « oui » → règle du 10e alinéa ; « non » → variante dérogatoire
  (6.5.8.1, 1, 3e al. ; 8.2.1, 16 ; 8.2.2, 10) ; « inconnu » → question R-RCD30-DATE, constat en informations
  insuffisantes.
- Règle du 10e alinéa (exécution ≥ 1/6/2023) : (1) au moins deux différentiels ≤ 30 mA en aval de l'origine ; (2) pour
  chacun, socles + appareils fixes (un ensemble sous une même commande = un point) ≤ 16 ; (3) tout circuit qui n'est
  sous aucun différentiel ≤ 30 mA (circuits du 8e alinéa, raccordés aux différentiels d'origine) a un différentiel
  ≤ 100 mA sur son circuit ou son groupe. Chaque manquement → non conforme (bloquant en neuf ; en existant, gravité
  élevée → non conforme bloquant, sauf dérogation datée).
- Variante dérogatoire (exécution < 1/6/2023) : tout l'éclairage sous un différentiel ≤ 30 mA, et chaque autre circuit
  ou groupe sous un différentiel ≤ 30 mA de 16 socles au plus. Pas de condition des 100 mA dans le texte de la dérogation.
- Données : sensibilité des différentiels (inconnue → informations insuffisantes, jamais conforme), socles et appareils
  fixes par différentiel, date par tableau, propriété « prise de terre commune » (> 30 Ω → non conforme, 5.4.2.1 c.2 1°).
- Garder l'avertissement actuel uniquement quand la configuration ne peut pas être évaluée.
- Tests : 30 / 30,1 Ω ; un seul 30 mA → non conforme ; deux 30 mA, 16 / 17 points ; circuit d'origine sans 100 mA ;
  dérogation pré-2023 (éclairage groupé + groupes de 16) ; date inconnue → question ; sensibilité inconnue ; prise de
  terre commune à 31 Ω.

### c) Existant : une non-conformité ne devient pas automatiquement une recommandation

Vérifié dans le code : aucune règle du lot n'a `existing: 'recommendation'` dans le catalogue ; les règles
`nonCompliance` de gravité `high` (R-EARTH-MISSING, R-EARTH-VALUE, R-INSULATION, R-BONDING, R-RCD-TEST) restent
**non conformes et bloquantes** en existant et pour toute édition (`context.ts` l. 122-125 ; vérifié par exécution pour
une installation de 1975 : R-EARTH-VALUE, R-INSULATION, R-BONDING non conformes, bloquants). Le défaut est l'inverse :
aucune dérogation datée n'est appliquée. Dérogations réellement présentes dans le texte :

| Règle | Dérogation | Condition | Référence |
| --- | --- | --- | --- |
| R-EARTH-MISSING | aucune pour la prise de terre elle-même | — | partie 8 et 6.5.8 parcourues |
| R-EARTH-VALUE (< 100 Ω) | aucune | — | idem |
| R-EARTH-30 (conditions > 30 Ω) | un 30 mA pour tout l'éclairage + un 30 mA par circuit ou groupe ≤ 16 socles | exécution entamée avant le 1/6/2023 (parties 2020-2023 contrôlées selon 6.4) ; parties d'avant 1981 ; parties ancien RGIE ; projets entamés avant le 1/6/2023 et contrôlés après (organisme agréé informé) | 6.5.8.1, 1, p. 207 ; 8.2.1, 16, p. 276 ; 8.2.2, 10, p. 278 ; 4.2.4.3 b dernier al., p. 101 |
| R-INSULATION | aucune | — | — |
| R-BONDING (principale) | absence admise | partie d'avant le 1/10/1981 | 8.2.1, 13, p. 276 (renvoi « a.5 », obligation en a.4) |
| R-BONDING (supplémentaire, salle de bain) | absence admise si volume 2 porté à 1 m | partie d'avant le 1/10/1981 | 8.2.1, 15.2, p. 276 |
| R-BONDING (supplémentaire, salle de bain) | liaison incomplète admise (volumes 0 à 3) | exécution entamée avant le 1/3/2025 (6.5.8.1) ; repris pour 8.2.1 (15.1) et 8.2.2 (11) | 6.5.8.1, 3.4, p. 209 |
| R-RCD-TEST / R-RCD-TRIP | aucune (un différentiel défaillant n'est couvert par aucune dérogation) | — | — |
| R-RCD30-DATE (règles 30 mA prises / éclairage, 8 circuits) | prises et éclairage hors 30 mA ; plus de 8 circuits par 30 mA | mêmes conditions que la ligne R-EARTH-30 ; perdue pour une modification ou extension importante | 6.5.8.1, 1 ; 8.2.1, 16 ; 8.2.2, 10 |
| R-WETROOM-NAME / R-RCD30 (salle de bain) | aucune pour le 30 mA (les dérogations portent sur volumes, canalisations, liaisons) | — | 6.5.8.1, 3 ; 8.2.1, 15 ; 8.2.2, 11 |
| R-EV-MANUAL | chapitre 7.22 non applicable | borne réalisée ou remplacée avant le 1/11/2022 | 7.22.1, p. 248 |
| R-PV-MANUAL | documents simplifiés | parties ancien RGIE, PV ≤ 10 kVA | 8.2.2, 7, p. 277 |

Proposition : appliquer ces dérogations par condition explicite (date de la partie, édition), en statut « dérogation
applicable » non bloquant avec la référence, et quand la date est inconnue → informations insuffisantes (jamais
recommandation ni conforme par défaut).
