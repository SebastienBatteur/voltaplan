# Calculs électriques de Voltaplan

Code : `src/calc/electrical.ts` (chute de tension, court-circuit), `src/calc/balance.ts` (bilan de
puissance, phases) et `src/calc/cableLength.ts` (longueur des câbles estimée d'après le plan, § 7). Fonctions
pures, sans React, testées dans `test/calc.test.ts` et `test/cableLength.test.ts` (exemples calculés
à la main dans les commentaires). Affichage : onglet Contrôle (`src/ui/CheckPanel.tsx`). Contrôles
réglementaires : bloc `R-VDROP` / `R-ICC-LMAX` de `src/rules/be/rgie.ts`.

> **Ce sont des estimations par la méthode conventionnelle, pas une étude de protection.** Elles
> aident à repérer un circuit trop long ou une section trop faible ; elles ne remplacent ni une note
> de calcul réalisée avec un logiciel (impédance du réseau, sélectivité, contraintes thermiques), ni
> l'avis de l'organisme agréé.

## Constantes et sources

| Grandeur | Valeur | Source |
|---|---|---|
| Résistivité du cuivre en service | ρ = 0,0225 Ω·mm²/m | IEC 60364-5-52 annexe G, UTE C 15-105 : résistivité conventionnelle = 1,25 × ρ à 20 °C (0,018) |
| Résistivité de l'aluminium en service | ρ = 0,036 Ω·mm²/m | idem (1,25 × 0,029) |
| Réactance linéique | λ = 0,08 mΩ/m | IEC 60364-5-52 annexe G, UTE C 15-105 (valeur par défaut) |
| Seuil magnétique des disjoncteurs | B : 5 In, C : 10 In, D : 20 In | IEC 60898-1 (borne haute de la plage de déclenchement instantané) |
| Limites de chute de tension depuis l'origine | éclairage 3 %, autres usages 5 % | IEC 60364-5-52 annexe G (installation alimentée par le réseau public BT) |
| Facteur de tension pour le court-circuit minimal | 0,8 | méthode conventionnelle (IEC 60364-4-43 / UTE C 15-105) |

Matière du câble : propriété `material` (`Cu` ou `Al`). Si elle n'est pas renseignée, le cuivre est
supposé et le résultat porte l'hypothèse `copperAssumed`.

## Notations

- L : longueur (m), S : section (mm²), ρ : résistivité (Ω·mm²/m).
- b = 2 en monophasé (230 V entre phase et neutre, ou entre deux phases d'un réseau 3 × 230 V) ;
  b = √3 en triphasé (pôles 3P, 3P+N, 4P).
- U = 230 V en monophasé et en triphasé sur un réseau 3 × 230 V ; 400 V en triphasé sur un réseau
  3N × 400 V (propriété « Alimentation » du projet).
- Le trajet d'un circuit va de sa protection à une extrémité ; on retient le trajet le plus défavorable
  (plus grande somme ρ·L/S). Les sous-tableaux et les autres protections (sauf en série) arrêtent le circuit.

## 1. Chute de tension conservative (toujours calculée)

    ΔU = b · Σ(ρ·L/S) · I        ΔU % = 100 · ΔU / U

avec I = calibre de la protection (cas le plus défavorable, cos φ = 1, hypothèse `ratingCurrent`).

Exemple : 2,5 mm² Cu, 20 A, 30 m, monophasé : ΔU = 2 × 0,0225 × 30 × 20 / 2,5 = 10,8 V = 4,70 %.

## 2. Chute cumulée depuis l'origine

L'origine de l'installation est le compteur : les câbles **au-dessus de la protection du circuit et
après le compteur** (liaison compteur → tableau, alimentation d'un sous-tableau) sont ajoutés. Pour
chacun :

- I = calibre de la protection la plus proche au-dessus de ce câble (celle qui le protège), ou, à
  défaut, le courant du raccordement (`mainCurrent` du projet) ;
- b et U selon les pôles de cette protection (ou l'alimentation du projet).

Les pourcentages s'additionnent (même tension de référence phase-neutre, à 1 % près dans le cas
triphasé → monophasé). Résultat : `upstreamDropPct` et `totalDropPct = upstreamDropPct + dropPct`.
Si un câble amont n'a pas de longueur, de section ou de courant, l'amont est inconnu (hypothèse
`upstreamUnknown`) : pas de total, le contrôle porte sur le circuit seul. Sans câble amont, la chute
amont vaut 0.

Exemple : différentiel 40 A → 10 mm² 25 m → sous-tableau → C20, 2,5 mm² 30 m :
amont 2 × 0,0225 × 25 × 40 / 10 = 4,5 V = 1,96 % ; total 1,96 + 4,70 = 6,65 % > 5 %.

## 3. Chute détaillée (quand toutes les puissances sont connues)

Si chaque charge du circuit a une puissance connue, la chute est aussi calculée avec le courant réel
(`method: 'detailed'`) :

- charge : Ia = P / (k·U) (courant actif), Ir = Ia · tan φ (courant réactif), k = 1 en monophasé,
  √3 en triphasé (charges supposées équilibrées, hypothèse `balancedThreePhase`) ; cos φ = propriété
  `cosPhi`, 1 si absente (charge résistive, hypothèse `cosPhiOne`) ;
- chaque tronçon de câble porte la somme des courants des charges en aval :
  ΔU tronçon = b · L · (ρ/S · ΣIa + λ · ΣIr) ;
- la chute d'une extrémité est la somme sur son trajet ; on retient la plus grande.
- `designCurrent` = courant d'emploi du circuit √(ΣIa² + ΣIr²).

Puissance connue : appareil et moteur (`power`), point lumineux (`power` par luminaire × `count`).
Une prise n'est connue que si chacun de ses socles porte un appareil désigné (sinon on ne sait pas ce
qui y sera branché). Interrupteurs, boîtes, relais, détecteurs, modules domotiques, transformateurs et
sonneries sont considérés comme de simples passages (consommation propre négligeable ; leurs
charges en aval sont comptées). « Autre », panneaux solaires et onduleurs rendent la méthode
détaillée indisponible. L'amont reste calculé de façon conservative.

Exemple : C20 → 2,5 mm² 10 m → [four 2300 W ; 2,5 mm² 20 m → appareil 1150 W] :
10 A + 5 A ; 2 × 0,0225 × 10 × 15 / 2,5 = 2,7 V ; 2 × 0,0225 × 20 × 5 / 2,5 = 1,8 V ; total 4,5 V = 1,96 %
(4,70 % au calibre).

## 4. Valeur contrôlée (R-VDROP)

`checkDropPct` est :

1. la chute détaillée depuis l'origine si la méthode détaillée est complète (l'annexe G de
   l'IEC 60364-5-52 se base sur le courant d'emploi) ;
2. sinon la chute conservative depuis l'origine ;
3. sinon (amont inconnu) la chute du circuit seul.

Elle est comparée **non arrondie** à la limite (3 % éclairage seul, 5 % sinon) ; le message affiche la
valeur arrondie à 0,01 %. Un dépassement au calibre que la méthode détaillée ne confirme pas n'est
jamais passé sous silence : il donne une information `R-VDROP-RATING` (le circuit n'est conforme que
tant que les charges ne dépassent pas les puissances saisies).

## 5. Court-circuit minimal et longueur maximale protégée

    Icc min = 0,8 · 230 / (2 · (R amont + R circuit))        R = Σ ρ·L/S (par conducteur)

Le défaut retenu est le plus faible du circuit : phase-neutre (230 V, boucle de deux conducteurs) en monophasé et en
3N × 400 V, phase-phase (230 V entre phases) en 3 × 230 V sans neutre ; dans tous ces cas U = 230 V et b = 2. Jusqu'au
27/11/2026, le calcul triphasé prenait U = 400 V et b = √3 (défaut triphasé symétrique), ce qui surestimait Icc min et
Lmax d'un facteur 2 (2/√3 sans neutre). Le neutre est supposé de même section que les phases.

Le disjoncteur (mcb, rcbo, courbe B/C/D) doit déclencher magnétiquement : Icc min ≥ Ia = k · In
(k = 5, 10, 20). Sinon `R-ICC-LMAX` (comparaison sur la valeur brute).

    Lmax = (S/ρ) · (0,8 · 230 / (2 · Ia) − R amont)

avec le ρ/S le plus défavorable du circuit ; sans amont : Lmax = 0,8·230·S / (2·ρ·Ia).

Exemples (2,5 mm² Cu, 20 A, monophasé) : courbe C (Ia = 200 A) Lmax = 0,8 × 230 × 2,5 / (2 × 0,0225 ×
200) = 51,1 m ; courbe B (Ia = 100 A) 102,2 m. Avec 10 mm² 25 m en amont (R = 0,05625 Ω) : courbe C
Lmax = (0,46 − 0,05625) × 2,5 / 0,0225 = 44,9 m.

Les câbles amont connus (alimentation de sous-tableau) sont inclus dans R ; l'impédance du réseau, du
transformateur et du raccordement ne l'est pas (hypothèse `noUpstreamImpedance`, couverte
conventionnellement par le facteur 0,8).

## 6. Bilan de puissance et équilibre des phases

Par tableau (circuits dont le tableau le plus proche au-dessus est celui-ci ; « hors tableau » sinon) :

- puissance installée = somme des puissances saisies ; les charges sans puissance (prises sans appareil
  désigné, points lumineux ou appareils sans puissance, « autre ») sont comptées à part : le total est
  alors un minimum ;
- phase : propriété `phase` (L1/L2/L3) de la protection du circuit ou de la plus proche protection
  au-dessus ; circuit triphasé : un tiers sur chaque phase ; monophasé sans phase : « sans phase » ;
- déséquilibre (réseau triphasé, toute la puissance attribuée) : 100 · max |P phase − P moyenne| / P moyenne ;
- **aucun facteur de simultanéité n'est supposé** : la puissance appelée n'est affichée que si un facteur
  est saisi sur le tableau (`simultaneity`, entre 0 et 1).

Sur un réseau 3 × 230 V sans neutre, L1/L2/L3 sont les repères saisis par l'utilisateur (une charge
monophasée y est raccordée entre deux phases).

## 7. Longueur des câbles estimée d'après le plan

Les calculs ci-dessus ont besoin de la longueur L de chaque câble. Quand elle n'est pas saisie,
`estimateCableLengths` l'estime d'après le plan de position (« ⟳ Mettre à jour » et bouton « Estimer les
longueurs » de l'onglet Matériel) :

- trajet : du tableau du circuit (s'il est posé sur le plan) aux points du câble, dans l'ordre du schéma, à
  **angles droits** (|Δx| + |Δy|, le long des murs plutôt qu'à vol d'oiseau) ;
- montée et descente aller-retour selon la hauteur de pose (plafond à 2,60 m) : interrupteur et bouton-poussoir à
  1,10 m alimentés par le plafond, interrupteur à tirette à 2,30 m, prise basse à 0,25 m reliée par le bas,
  applique à 1,90 m, point lumineux au plafond 0,30 m de raccordement ; départ du tableau 1,50 m ; changement
  d'étage 3 m par page ;
- tracés de câbles dessinés entre deux points (`plan.pages[].wires`, repris de Condui) : suivis par leurs points de
  passage au lieu du trajet à angles droits ; le départ du tableau, que Condui ne trace pas, reste estimé ;
- marge de raccordement et de cheminement : + 10 % ; résultat arrondi au mètre supérieur.

La longueur obtenue est marquée « estimée » (`lengthEstimated`, « ≈ » dans la liste du matériel) ; une longueur
saisie n'est jamais remplacée, et la saisir enlève la marque. Câble sans point posé : pas d'estimation ; tableau
absent du plan : trajet compté depuis le premier point (trop court, signalé).

Import sans tracés (PDF, Trikker, Volter, Draadwijs, PlanElec, Eendraadschema, circuits non tracés de Condui) :
`autoWires` crée des tracés d'après l'unifilaire, du tableau au premier point puis de point en point dans l'ordre du
schéma, avec un coude à angle droit, sur une même page. Ils sont marqués `auto`, dessinés plus pâles et signalés
« à ajuster » ; leur longueur est celle de l'estimation.

C'est une **estimation** pour la chute de tension et la liste du matériel, pas un relevé : le trajet réel (gaines,
passages, boîtes) peut être plus long.

## Limites

- Estimation conventionnelle, **pas une étude de protection** : pas d'impédance du réseau ni du
  transformateur (sauf câbles amont saisis), pas de sélectivité, pas de contrainte thermique (I²t),
  pas de vérification du pouvoir de coupure face à l'Icc maximal.
- Défaut à la terre en schéma TT : non calculé ; la protection des personnes est assurée par le
  différentiel (contrôlé par d'autres règles). En TN/IT, la boucle de défaut n'est pas calculée.
- Courant admissible des câbles (mode de pose, groupement, température) : non calculé ici ; la règle
  `R-CABLE-PROT` utilise le tableau 4.11 du RGIE (4.4.1.4 : calibre maximal du fusible ou du disjoncteur selon la
  section, installations domestiques), qui reste un maximum : le mode de pose peut imposer moins.
- Réactance négligée dans la méthode conservative (cos φ = 1, cas le plus défavorable pour les petites
  sections) ; réactance par défaut 0,08 mΩ/m dans la méthode détaillée.
- Charges triphasées supposées équilibrées ; harmoniques et courant de neutre non pris en compte.
- Les valeurs du résultat sont brutes ; elles ne sont arrondies qu'à l'affichage.
