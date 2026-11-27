# Audit réglementaire et technique de la rubrique « Apprendre » (2026)

Branche `rgie-precisions`, à partir du commit `c6cf810`. Audit réalisé le 27/11/2026.

## Résumé

- **Périmètre** : les 54 articles de `learn/fr/` (corps, en-têtes : titres, descriptions, « À retenir », FAQ, sources), leurs 58 schémas SVG, les 12 exercices (`tools/learn/exercices/`) et le simulateur de câblage, le lexique (152 mots), l'encadré de sécurité commun et les données structurées produites par `tools/learn/build.tsx`.
- **Affirmations vérifiées dans les articles** : 1739, une à une, dans leur contexte.
- **Anomalies relevées dans les articles** : P0 = 1, P1 = 41, P2 = 136, P3 = 142 Lexique (152 définitions) : P2 = 11, P3 = 28, 39 définitions corrigées. Parties communes (simulateur, exercices, gabarit) : P1 = 3, P2 = 1, P3 = 3. Presque toutes les anomalies sont corrigées ; les rares exceptions sont signalées « Proposé » ou « À valider » dans chaque rubrique.
- **Statut** : 3 articles « Validé », 51 « Validé avec réserves », 0 « Non validé ». « Avec réserves » signifie qu'au moins une affirmation repose sur une norme non consultée, une interprétation ou une pratique à faire confirmer par un spécialiste (listées plus bas).
- **Ce que cet audit n'est pas** : une certification. La rubrique n'est **pas** déclarée conforme au RGIE dans son ensemble : plusieurs points dépendent de normes payantes (NBN, EN, IEC) ou de prescriptions de gestionnaires de réseau non consultées, et d'interprétations à trancher par un spécialiste.

## Sources et méthode

- **Source principale** : RGIE, Livre 1 « Installations à basse et à très basse tension », version 07 du 15/09/2026, d'application à partir du 01/11/2026 (texte officiel du SPF Économie). Chaque référence citée dans un article a été retrouvée dans le texte (section, point, page imprimée) ; le validateur `npm run learn:check` refuse tout numéro qui n'est pas dans la liste vérifiée `learn/fr/plan.json` → `rgieRefs`, et chaque numéro de cette liste a été contrôlé automatiquement (titre de section et lettre de point présents dans le texte officiel).
- **Autres sources** : documentation de fabricants lorsqu'elle est citée (fiches Eupen et Prysmian pour l'XVB, Somfy pour les moteurs de volets, ABB et Siemens pour KNX) ; principes physiques. Les normes NBN, EN, IEC (HD 308, IEC 60364-5-52, EN 60898, EN 61008/61009, EN 60669-2-1, EN 61558-2-8, IEC 60617, EN 50090, IEC 60479, IEC 61010) et les prescriptions Synergrid **n'ont pas été consultées** : les affirmations qui en dépendent sont présentées comme telles dans les articles et listées comme « à valider ».
- **Le code de Voltaplan n'a pas servi de source** : quand il diverge du RGIE, l'article suit le RGIE et l'écart est noté dans « Anomalies du moteur ».
- **Classification** de chaque affirmation : obligation, interdiction ou dérogation réglementaire ; exigence normative ; bonne pratique ; recommandation du fabricant ; principe physique ; simplification pédagogique ; choix de Voltaplan.
- **Criticité** : P0 danger pour une personne ; P1 erreur réglementaire ou technique importante ; P2 imprécision ou bonne pratique présentée comme obligation ; P3 forme, terminologie.

## Matrice de couverture (54 articles)

| Rubrique | Article | Affirmations vérifiées | P0 | P1 | P2 | P3 | Statut |
|---|---|---|---|---|---|---|---|
| Les bases | `electricite-c-est-quoi` | 34 | 0 | 0 | 2 | 3 | Validé avec réserves |
| Les bases | `tension` | 36 | 0 | 3 | 2 | 2 | Validé avec réserves |
| Les bases | `courant` | 38 | 0 | 3 | 1 | 4 | Validé avec réserves |
| Les bases | `resistance-loi-ohm` | 32 | 0 | 0 | 1 | 3 | Validé avec réserves |
| Les bases | `puissance-energie` | 33 | 0 | 1 | 0 | 2 | Validé avec réserves |
| Les bases | `alternatif-mono-tri` | 40 | 0 | 1 | 2 | 3 | Validé avec réserves |
| Les bases | `serie-et-parallele` | 30 | 0 | 0 | 0 | 2 | Validé |
| Câbles | `couleurs-des-fils` | 34 | 0 | 2 | 3 | 5 | Validé avec réserves |
| Câbles | `types-de-cables` | 30 | 0 | 2 | 2 | 4 | Validé avec réserves |
| Câbles | `section-des-cables` | 32 | 0 | 2 | 3 | 4 | Validé avec réserves |
| Câbles | `chute-de-tension` | 26 | 0 | 0 | 1 | 2 | Validé avec réserves |
| Câbles | `tubes-et-boites` | 28 | 0 | 1 | 2 | 6 | Validé avec réserves |
| Protections | `disjoncteur` | 34 | 0 | 2 | 4 | 3 | Validé avec réserves |
| Protections | `courbes-disjoncteur` | 22 | 0 | 0 | 1 | 3 | Validé avec réserves |
| Protections | `surcharge-court-circuit` | 26 | 0 | 1 | 2 | 0 | Validé avec réserves |
| Protections | `differentiel` | 38 | 1 | 1 | 3 | 3 | Validé avec réserves |
| Protections | `mise-a-la-terre` | 32 | 0 | 2 | 2 | 3 | Validé avec réserves |
| Protections | `liaisons-equipotentielles` | 30 | 0 | 0 | 3 | 3 | Validé avec réserves |
| Protections | `parafoudre` | 28 | 0 | 0 | 0 | 3 | Validé avec réserves |
| Contrôles | `controle-organisme-agree` | 46 | 0 | 1 | 4 | 8 | Validé avec réserves |
| Contrôles | `continuite` | 24 | 0 | 0 | 1 | 2 | Validé avec réserves |
| Contrôles | `resistance-isolement` | 27 | 0 | 0 | 2 | 2 | Validé |
| Contrôles | `resistance-de-terre` | 30 | 0 | 0 | 3 | 5 | Validé avec réserves |
| Contrôles | `test-differentiel` | 28 | 0 | 0 | 4 | 2 | Validé avec réserves |
| Contrôles | `differentiel-qui-saute` | 26 | 0 | 0 | 1 | 2 | Validé |
| Contrôles | `disjoncteur-qui-saute` | 30 | 0 | 1 | 4 | 2 | Validé avec réserves |
| Câblages (éclairage) | `simple-allumage` | 38 | 0 | 2 | 5 | 4 | Validé avec réserves |
| Câblages (éclairage) | `double-allumage` | 34 | 0 | 0 | 2 | 2 | Validé avec réserves |
| Câblages (éclairage) | `va-et-vient` | 36 | 0 | 0 | 2 | 2 | Validé avec réserves |
| Câblages (éclairage) | `va-et-vient-trois-points` | 32 | 0 | 0 | 1 | 4 | Validé avec réserves |
| Câblages (éclairage) | `telerupteur` | 40 | 0 | 0 | 2 | 4 | Validé avec réserves |
| Câblages (éclairage) | `minuterie` | 26 | 0 | 0 | 1 | 1 | Validé avec réserves |
| Câblages (éclairage) | `detecteur-de-mouvement` | 34 | 0 | 0 | 3 | 0 | Validé avec réserves |
| Câblages (prises et divers) | `variateur` | 34 | 0 | 0 | 2 | 1 | Validé avec réserves |
| Câblages (prises et divers) | `prise-de-courant` | 46 | 0 | 2 | 9 | 2 | Validé avec réserves |
| Câblages (prises et divers) | `prise-commandee` | 33 | 0 | 3 | 2 | 2 | Validé avec réserves |
| Câblages (prises et divers) | `sonnette` | 30 | 0 | 1 | 2 | 2 | Validé avec réserves |
| Câblages (prises et divers) | `contacteur-jour-nuit` | 32 | 0 | 0 | 4 | 2 | Validé avec réserves |
| Volets | `volet-roulant` | 46 | 0 | 2 | 4 | 4 | Validé avec réserves |
| Volets | `moteur-de-volet` | 34 | 0 | 0 | 3 | 3 | Validé avec réserves |
| Volets | `commande-groupee-volets` | 30 | 0 | 0 | 4 | 1 | Validé avec réserves |
| Volets | `fenetre-motorisee` | 40 | 0 | 1 | 4 | 3 | Validé avec réserves |
| Volets | `volets-domotique` | 32 | 0 | 0 | 3 | 1 | Validé avec réserves |
| Domotique et schémas | `domotique-introduction` | 24 | 0 | 0 | 4 | 0 | Validé avec réserves |
| Domotique et schémas | `relais-connectes` | 30 | 0 | 0 | 4 | 1 | Validé avec réserves |
| Domotique et schémas | `bus-knx` | 32 | 0 | 1 | 1 | 5 | Validé avec réserves |
| Domotique et schémas | `sans-fil-zigbee-wifi` | 26 | 0 | 0 | 1 | 0 | Validé avec réserves |
| Domotique et schémas | `preparer-cablage-domotique` | 27 | 0 | 0 | 2 | 2 | Validé avec réserves |
| Domotique et schémas | `scenarios-home-assistant` | 25 | 0 | 0 | 2 | 0 | Validé avec réserves |
| Domotique et schémas | `lire-unifilaire` | 34 | 0 | 1 | 2 | 5 | Validé avec réserves |
| Domotique et schémas | `plan-de-position` | 27 | 0 | 1 | 4 | 1 | Validé avec réserves |
| Domotique et schémas | `symboles-electriques` | 40 | 0 | 1 | 1 | 3 | Validé avec réserves |
| Domotique et schémas | `organiser-tableau` | 33 | 0 | 2 | 5 | 3 | Validé avec réserves |
| Domotique et schémas | `dossier-installation` | 30 | 0 | 1 | 4 | 3 | Validé avec réserves |
| **Total** | **54** | **1739** | **1** | **41** | **136** | **142** | |

## Parties communes (exercices, simulateur, gabarit, données structurées)

| # | Fichier | Texte initial | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| C1 | `site/apprendre/cablage-sim.js` | bleu hors neutre : simple remarque | Interdiction réglementaire | Le bleu est réservé au neutre dans un circuit qui en comporte : c'est une interdiction, pas un conseil | P1 | RGIE 5.1.6.2, p. 128 | Devient une erreur ; un neutre d'une autre couleur reste une remarque (bonne pratique) | Corrigé, testé |
| C2 | `site/apprendre/cablage-sim.js` | seuls les interrupteurs sont contrôlés « sur le neutre » | Interdiction réglementaire | Un contact de télérupteur ou la sortie d'un détecteur placés sur le neutre étaient acceptés | P1 | RGIE 5.3.3.2 c, p. 159 (« un dispositif de commande unipolaire n'est pas placé sur le conducteur neutre ») | Bornes de commande listées par appareil (contact 1-2 du télérupteur, L et sortie du détecteur ; bobine A2 et alimentation N exclues) | Corrigé, testé |
| C3 | `site/apprendre/cablage.js` | « le montage fonctionne et respecte les règles de sécurité » | Choix Voltaplan | Fausse assurance : la simulation ne vérifie que quelques règles | P2 | Sécurité pédagogique | « respecte les règles vérifiées par cet exercice. Ce n'est pas un contrôle de conformité. » | Corrigé |
| C4 | `site/apprendre/cablage.js` | messages d'erreur sans source | Obligation réglementaire | Les règles vérifiées n'étaient pas rattachées au RGIE | P3 | RGIE 5.1.6.2, 5.3.3.2 c, 5.4.3.3 | Messages sourcés ; « conducteur de protection » au lieu de « conducteur de terre » | Corrigé |
| C5 | `tools/learn/build.tsx` (encadré de chaque page) | « coupez toujours le courant avant d'intervenir, et faites contrôler toute installation neuve ou modifiée » | Obligation réglementaire | Ni la prévention de la remise sous tension ni la vérification d'absence de tension ; contrôle étendu à « toute » modification | P1 | RGIE 5.3.3.1 a.4, 9.3.4.2 ; 6.4.7.3 | Couper, empêcher la remise en service, vérifier l'absence de tension ; contrôle pour une installation neuve ou une modification / extension importante ; un exercice réussi n'est pas un contrôle | Corrigé |
| C6 | Schémas et exercices (pictogrammes) | lampe dessinée en cercle barré | Simplification pédagogique | Dans le tableau 2.23 G du RGIE, le point lumineux est une croix ; le cercle barré désigne une lampe témoin ou un projecteur. Les articles de la rubrique « schémas » sont corrigés ; les dessins de câblage multifilaires et les exercices gardent un pictogramme de lampe | P3 | RGIE tableau 2.23 G ; figures 3.1 et 3.2 | Les articles qui enseignent les symboles utilisent la croix ; pictogramme conservé ailleurs, à revoir si l'on veut une cohérence stricte | Proposé |
| C7 | Données structurées (`build.tsx`) | `Article`, `BreadcrumbList`, `CollectionPage`, `DefinedTermSet` | Choix Voltaplan | Vérifiées : informations factuelles seulement (titre, description, date, éditeur, gratuité), aucune note ni avis ; les définitions du lexique y sont reprises après correction | — | — | Aucune | Validé |
| C8 | Exercices (12) | solutions, cas attendus, unifilaires | — | Toutes les solutions passent le simulateur renforcé ; exercice télérupteur : neutre de la lampe repris du tableau (et non de la borne A2) | P3 | — | Corrigé (voir rubrique câblages) | Validé |

Remarque restante sur le simulateur (P2, proposée) : la polarité des bornes de la lampe (phase sur L) n'est pas vérifiée ; aucune règle du RGIE trouvée, ce serait un avertissement de bonne pratique.

## Anomalies du moteur réglementaire de Voltaplan (non corrigées)

Conformément à la demande, le moteur (`src/rules/`, `src/model/`) n'a pas été modifié et les articles n'ont pas été alignés sur lui.

| # | Emplacement | Anomalie | Criticité | Source | Correction proposée | Tests de non-régression proposés |
|---|---|---|---|---|---|---|
| M1 | `src/rules/be/rgie.ts` l. 31-41 et 216-225 (`MAX_PROTECTION_BY_SECTION`, `R-CABLE-PROT`) | Les fusibles sont jugés avec la colonne des disjoncteurs : un fusible trop fort est accepté (2,5 mm² + fusible 20 A ; 1,5 mm² + fusible 16 A) | P1 | RGIE 4.4.1.4, tableau 4.11, p. 116-117 | Deux colonnes (fusible, disjoncteur) reprises du tableau 4.11 ; choix selon `device` (`fuse` ou `mcb`/`rcbo`) | 2,5 mm² + fusible 20 A → non conforme ; 1,5 mm² + fusible 10 A → conforme ; 1,5 mm² + fusible 16 A → non conforme |
| M2 | même table | Valeurs des disjoncteurs plus sévères que le RGIE à partir de 6 mm² (6 → 32 A au lieu de 40 ; 10 → 50 au lieu de 63 ; 16 → 63 au lieu de 80 ; 25 → 80 au lieu de 100 ; 35 → 100 au lieu de 125) : fausses non-conformités | P2 | idem | Reprendre le tableau 4.11 ; éventuellement garder un avertissement « mode de pose à vérifier » (IZ, 4.4.1.4) | 6 mm² + disjoncteur 40 A → conforme ; 6 mm² + 50 A → non conforme ; 10 mm² + 63 A → conforme |
| M3 | `rgie.ts` l. 334-337 (`R-RCD-TYPE-A`) | Ne vise que les 30 mA des appareils de lavage ; le RGIE impose au moins le type A à **tous** les différentiels domestiques, général compris | P1 | RGIE 5.3.5.3 a, p. 168 | Signaler tout différentiel domestique de type AC (ou inconnu en conception) ; pour l'existant, vérifier d'abord l'absence de dérogation (aucune trouvée en 8.2.1 / 8.2.2) | Différentiel général 300 mA type AC → non conforme (partie neuve) ; type A → conforme |
| M4 | `rgie.ts` | Pas de contrôle du calibre minimal de 40 A du différentiel placé en tête | P2 | RGIE 5.3.5.3 a | Nouvelle règle sur le différentiel d'origine | Différentiel général 25 A → non conforme ; 40 A → conforme |
| M5 | `rgie.ts` l. ~281 (`R-SOCKET-MAX`) | Ne compte que les prises ; un appareil fixe (ou un groupe sous une même commande) et, dans un circuit mixte, un point d'éclairage commandé comptent comme un socle | P2 | RGIE 5.3.5.2 b, p. 167 | Compter ces points dans la limite de 8 | Circuit de 6 prises + 3 points lumineux → non conforme |
| M6 | `src/model/schema.ts` l. 85-96 (`DEDICATED_CIRCUIT_APPLIANCES`) | Circuit dédié imposé au chauffe-eau, à la pompe à chaleur et à la chaudière quelle que soit leur puissance ; règle générique « appareil à poste fixe ≥ 2 600 W » absente | P2 | RGIE 5.2.1.2, p. 129 ; 7.22.3 (borne de recharge) | Liste du RGIE (lave-linge, lave-vaisselle, sèche-linge, cuisinière, taque, four, chauffage électrique fixe, borne) + seuil 2 600 W ; le reste en recommandation | Chauffe-eau 2 000 W partagé → recommandation ; appareil fixe 3 000 W partagé → non conforme |
| M7 | `rgie.ts` (`R-CABLE-MIN`) | Minimum unique de 1,5 mm² : le RGIE impose 2,5 mm² en règle générale, 1,5 mm² seulement sans socle de prise, et admet moins pour les circuits de commande (tableau 5.1) | P2 | RGIE 5.2.1.2, tableau 5.1, p. 129 | Minimum selon le type de circuit (vérifier le recoupement avec `R-SOCKET-SECTION`) | Circuit de prises en 1,5 mm² → non conforme ; circuit de commande en 0,75 mm² → conforme |
| M8 | `rgie.ts` l. ~167 (`R-EARTH-VALUE`) | `re > 100` accepte 100 Ω pile ; le RGIE exige « inférieure à 100 Ω » | P3 | RGIE 4.2.3.2, p. 84 | `re >= 100` | 100 Ω → non conforme ; 99,9 Ω → règle des 30 Ω |
| M9 | `rgie.ts` (`R-POLES-NO-NEUTRAL`, `polesFor`) | Seul le réseau 3 × 230 V est contrôlé ; le texte de 4.4.4.2 demande une détection de surintensité sur les deux conducteurs actifs des circuits monophasés domestiques (sauf disjoncteur différentiel qui détecte sur une phase et coupe les deux) | P2, à trancher | RGIE 4.4.4.2, p. 119 | **Ne rien changer avant l'avis d'un spécialiste** sur le cas des disjoncteurs 1P+N (pratique courante) | — |
| M10 | `rgie.ts` l. 175-182 (`R-RCD-TRIP`) | Temps de 300 ms / 500 ms (« S ») présentés comme des seuils de conformité ; ils viennent des normes de produit (EN 61008/61009), non retrouvés dans le RGIE (le tableau 4.9 concerne les lieux BE2/BE3/CA2) | P3, à valider | — | Libeller la règle comme exigence normative, ou la sourcer | — |

## Points à faire valider par un spécialiste

1. **Disjoncteurs 1P+N** au regard de RGIE 4.4.4.2 (détection sur les deux conducteurs actifs) : lecture littérale ou pratique admise ?
2. **Différentiels de type AC** dans une installation existante : aucune dérogation au type A (5.3.5.3 a) trouvée en 8.2.1 / 8.2.2.
3. **Réseau public 3 × 230 V** : classement en schéma IT pour l'installation intérieure ; tension phase-terre en cas de défaut.
4. **3G1,5 en va-et-vient avec le bleu en navette** : interdit par la lecture littérale de 5.1.6.2 (circuit comportant un neutre), alors que la pratique est répandue.
5. **Exception de 4.5.4** (« lieux ordinaires non accessibles au public ») : s'applique-t-elle à une habitation ? La séparation des circuits TBTS est fondée sur 4.2.5.3 c.
6. **Modules domotiques cachés** : comptent-ils comme « unité de commande » à représenter (3.1.2.1) ?
7. **Groupe de volets sous une même commande** : un ou plusieurs points dans la limite de 8 (5.3.5.2 b) ?
8. **Prise double faite de deux socles simples** dans une boîte double : un ou deux points ?
9. **5.3.3.2 e** (pas de redémarrage automatique d'un moteur dangereux) appliqué à un ouvrant domestique.
10. **Contrôle d'une installation réalisée par un particulier** : plausible d'après 3.1.2.1, non explicite.
11. **Essai des différentiels sous tension** alors que le contrôle se fait « hors tension » (6.4.1) ; contenu des contrôles par essais (6.4.4) fixé par arrêtés non consultés.
12. **Exception de 5.4.3.6** (pas de terre vers les interrupteurs) appliquée à un détecteur de mouvement.
13. **Normes non consultées** : courbes B/C/D (EN 60898), temps de déclenchement (EN 61008/61009), couleurs harmonisées (HD 308), chute de tension 3 % / 5 % (IEC 60364-5-52 annexe G, informative), variateurs (EN 60669-2-1), transformateurs de sonnette (EN 61558-2-8), obturateurs (NBN C 61-112-1), KNX (EN 50090), effets du courant (IEC 60479), catégories de mesure (IEC 61010), symboles (IEC 60617), XVB (NBN HD 604) ; désignations VTLB / H05VV-F ; prescriptions Synergrid (disjoncteur de branchement, signal heures creuses des compteurs numériques).
14. **Exigence d'obturateurs** (sécurité enfants) avant le 01/03/2025 dans les éditions précédentes du RGIE.
15. **Seuil de très basse tension** pour un bouton de sonnette extérieur (classement BB1 ou BB2 : 25 V ou 12 V).

## Références réglementaires utilisées

RGIE, Livre 1, version 07 (15/09/2026), d'application au 01/11/2026. Numéros cités dans les articles (tous retrouvés dans le
texte officiel, liste `learn/fr/plan.json` → `rgieRefs`) :

2.4.1, 2.6.4, 3.1.2, 3.1.2.1, 3.1.2.2 a, 3.1.2.3 a, 3.1.3.1, 3.1.3.3 a, 3.2.4.1, 3.3.3, 4.2.2.2, 4.2.3.2, 4.2.3.4 a, 4.2.4.3 a, 4.2.4.3 b, 4.2.5.3, 4.2.5.3 c, 4.2.5.5 c, 4.4.1.4, 4.4.2.1, 4.4.3.2, 4.4.4.1, 4.4.4.2, 4.5.1, 4.5.3, 4.5.4, 5.1.3.1, 5.1.5.1, 5.1.6.2, 5.2.1.2, 5.2.1.3, 5.2.5, 5.2.6.1, 5.2.7.4, 5.2.9.2, 5.2.9.3 d, 5.2.9.3 f, 5.2.9.3 i, 5.2.9.6, 5.2.9.10, 5.2.9.10 b, 5.3.3.2 c, 5.3.3.2 d, 5.3.3.2 e, 5.3.5.1 c, 5.3.5.2 a, 5.3.5.2 b, 5.3.5.3 a, 5.3.5.3 f, 5.3.5.3 g, 5.3.5.4 a, 5.3.5.5 a, 5.3.5.5 e, 5.3.5.5 h, 5.4.2.1, 5.4.2.1 b, 5.4.2.1 c, 5.4.3.3, 5.4.3.5, 5.4.3.6, 5.4.4.1, 5.4.4.1 b, 5.5.7.3, 6.4.1, 6.4.5.1, 6.4.5.2, 6.4.6.2, 6.4.6.4, 6.4.7.3, 6.5.1, 6.5.2, 6.5.8.1, 7.1.4.3, 7.1.4.4, 7.22.3, 8.2.1, 8.2.2, 8.4.1, 8.4.2, 9.1.2, 9.1.3.1, 9.1.3.2, 9.3.4.2 a, 9.3.4.2 d (84 références).


## Détail par rubrique

Les tableaux ci-dessous sont ceux des auditeurs de chaque rubrique (lignes : numéros de ligne au moment de l'audit).

## Rubrique : Les bases de l’électricité (bases)

Source réglementaire : RGIE Livre 1 v07 (15/09/2026), extrait `scratchpad/livre1.txt`. Pages = pages imprimées.
Tous les calculs des sept articles ont été refaits (résultats exacts ou arrondis corrects, sauf mention).

### electricite-c-est-quoi — Qu’est-ce que l’électricité ?

Fichiers : learn/fr/electricite-c-est-quoi.html
Affirmations vérifiées : 34 (dont réglementaires : 4)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 18 (FAQ) | « les installations ont des différentiels de 30 mA et une mise à la terre » | Obligation réglementaire | Généralisation : le RGIE impose un différentiel général ≤ 300 mA à l’origine, puis ≥ 1 différentiel haute sensibilité (≤ 30 mA) pour prises, éclairage, salle de bain, lave-linge/sèche-linge/lave-vaisselle ; les installations anciennes peuvent ne pas en avoir. Le texte laissait entendre que le 30 mA suffit. | P2 | RGIE 4.2.4.3 b, p. 100-101 : « Au moins un dispositif […] au maximum 300 mA, est placé à l’origine » | Reformulé : terre + différentiel général + 30 mA pour prises, éclairage, salle de bain ; « réduisent fortement le risque sans le supprimer » | Corrigé |
| 2 | 117 | « chacun protégé par un disjoncteur, et les personnes sont protégées par un ou plusieurs différentiels » | Simplification pédagogique | Oublie les fusibles (installations anciennes) ; « les personnes sont protégées » sonne comme une garantie | P3 | RGIE 4.4.1.4, tableau 4.11 (fusible ou disjoncteur), p. 117 | « protégé contre les surintensités par un disjoncteur (ou un fusible) […] des différentiels ajoutent une protection des personnes » | Corrigé |
| 3 | 120 | « coupez le circuit au tableau et vérifiez l’absence de tension » | Bonne pratique professionnelle | Procédure incomplète : manque la prévention de la remise sous tension (consignation) | P2 | Principe de consignation (RGIE Livre 3 / prescriptions de travail, non relu ici) | Ajout « empêchez qu’on le remette sous tension pendant le travail » | Corrigé |
| 4 | 120 | « Une installation neuve, comme toute modification ou extension importante, doit ensuite être contrôlée » | Obligation réglementaire | Exact, mais sans moment ni référence | P3 | RGIE 6.4.7.3, p. 204 : « fait l’objet d’un contrôle de conformité […] avant la mise en usage » | Ajout « avant sa mise en usage (RGIE, 6.4.7.3) » | Corrigé |
| 5 | 22, 77 | Lien et source sbg-energy.com | — | Site tiers non officiel cité comme source (hiérarchie des sources : rang bas, non réglementaire) | P3 | Consigne, hiérarchie des sources | Laissé (choix éditorial du site, liens partenaires probables) ; à arbitrer par le responsable | Proposé |

Affirmations vérifiées sans problème : électrons libres du cuivre, conducteurs/isolants (eau du robinet, corps humain conducteurs) → physique ; circuit fermé, aller phase / retour neutre, réseau sans neutre = deuxième phase → physique, réseaux belges ; court-circuit, électrisation → définitions ; tableau U/I/R/P et unités → SI ; U = R × I, P = U × I (P = U × I exact pour charge résistive, cos φ traité dans alternatif-mono-tri) → physique ; changement de sens 100 fois par seconde à 50 Hz → physique ; vitesse de dérive ≪ 1 mm/s (≈ 0,02 à 0,1 mm/s pour quelques A/mm²) → physique ; oiseau sur un fil → physique ; « quelques dizaines de mA peuvent être mortels » → ordre de grandeur (IEC 60479, non relue : présenté comme ordre de grandeur, acceptable) ; 230 V / 50 Hz → réseau public ; illustrations (circuit fermé, analogie de l’eau) → correctes.
Incertitudes : aucune bloquante.

### tension — La tension (U, en volts)

Fichiers : learn/fr/tension.html
Affirmations vérifiées : 36 (dont réglementaires : 6)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 18 (FAQ) | « on considère comme sûres les TBTS, jusqu’à 50 V en alternatif en conditions normales » | Exigence réglementaire (définition) | Faux sentiment de sécurité : 50 V n’est la limite que pour peau sèche (BB1) ; 25 V peau mouillée, 12 V immergée. « Conditions normales » est ambigu (la TBTS doit tenir aussi en défaut). | P1 | RGIE 2.4.1, tableau 2.3, p. 26 : BB1 50 V, BB2 25 V, BB3 12 V (AC) ; définition TBTS p. 21 | Remplacé par les trois limites UL et le renvoi (RGIE, 2.4.1) | Corrigé |
| 2 | 50 | « TBTS […] qui va jusqu’à 50 V en alternatif » ; « ne peut pas faire passer […] dans des conditions normales » | Exigence réglementaire | Même problème ; de plus la TBTS ne dépasse pas UL « dans des conditions de défauts » aussi | P1 | RGIE 2.3.1 (définition TBTS), p. 21 ; 2.4.1 tableau 2.3, p. 26 | Paragraphe réécrit : tension limite conventionnelle selon l’état de la peau, « même en cas de défaut » | Corrigé |
| 3 | 50 | « La TBTS est produite par un transformateur de sécurité » | Exigence réglementaire | Trop restrictif : batteries et dispositifs équivalents admis ; omet la séparation des circuits | P2 | RGIE 4.2.5.1 p. 105 (batteries, transformateurs de séparation…), 4.2.5.3 a-c p. 106 (« séparées physiquement les unes des autres et d’autres circuits ») | « source de sécurité, par exemple un transformateur de sécurité ou une batterie, et ses circuits sont séparés des circuits 230 V (RGIE, 4.2.5.3) » | Corrigé |
| 4 | 73-77 | Mesures phase-neutre, phase-terre, neutre-terre sur une prise | Bonne pratique professionnelle | Mesure sous tension décrite à des lecteurs non qualifiés sans aucune condition de sécurité | P1 | Bonne pratique (catégories de mesure de l’IEC 61010, norme non relue : citée seulement comme marquage de l’appareil) | Ajout : appareil prévu pour le réseau (CAT III ou plus indiqué sur l’appareil), cordons en bon état, formation, sinon électricien | Corrigé |
| 5 | 76 | « phase – terre : environ 230 V sur un réseau 3N × 400 V » | Principe physique | Incomplet pour le 3 × 230 V | P3 | Physique des réseaux IT | Ajout « en 3 × 230 V, environ 133 V en temps normal, mais variable » ; « neutre – terre ≈ 0 V (3N × 400 V) » | Corrigé |
| 6 | 79, 85 | Vérification d’absence de tension | Bonne pratique professionnelle | Manque la prévention de la remise sous tension et la vérification de tous les conducteurs | P2 | Principe de consignation | Ajout « on vérifie tous les conducteurs, et on empêche la remise sous tension (disjoncteur verrouillé ou signalé) » et idem § danger | Corrigé |
| 7 | 21-24 | Sources sans le RGIE | — | Le RGIE est désormais cité dans le texte | P3 | — | Source RGIE ajoutée | Corrigé |

Affirmations vérifiées sans problème : tension = différence de potentiel entre deux points → physique ; 230 V phase-neutre, 400 V entre phases en 3N × 400 V, 3 × 230 V sans neutre → réseaux belges ; tableau des tensions usuelles (1,5 V, 5 V USB, 12/24 V, 230 V, 400 V, MT/HT de quelques kV à 380 kV) → exact ; valeur efficace (définition par effet thermique) → physique ; 230 × √2 = 325,3 V → recalculé ; SVG : crête à 100 px, efficace à 70,8 px (rapport 0,707) et un cycle complet entre x = 80 et 340 → exact ; isolants dimensionnés au-delà de la crête → physique ; voltmètre en parallèle → physique ; tournevis testeur insuffisant, contrôle du VAT avant/après → bonne pratique correcte ; « le danger dépend du courant, donc de la tension et de la résistance du corps (humidité de la peau) » → RGIE 2.4.1 a, p. 26 ; variation de quelques % autour de 230 V → acceptable (EN 50160 admet ± 10 %, norme non relue).
Incertitudes : la mention « CAT III ou plus » relève de l’IEC 61010 (non lue) : présentée comme indication portée sur l’appareil, pas comme exigence.

### courant — Le courant (I, en ampères)

Fichiers : learn/fr/courant.html
Affirmations vérifiées : 38 (dont réglementaires : 7)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 74-83 | Tableau « Les valeurs utilisées par Voltaplan » : 6 mm² → 32 A, 10 mm² → 50 A | Obligation réglementaire présentée comme choix Voltaplan | Le RGIE fixe lui-même ce tableau pour le domestique ; 6 mm² → 40 A (disjoncteur) / 32 A (fusible), 10 mm² → 63 A / 50 A. Les valeurs 32 / 50 A sont celles de Voltaplan (plus prudentes), pas du RGIE. Le moteur n’est pas une source réglementaire. | P1 | RGIE 4.4.1.4, tableau 4.11, p. 117 : « Pour les installations domestiques, l’intensité nominale maximale […] est donnée au tableau 4.11 » | Tableau remplacé par les valeurs RGIE (disjoncteur et fusible), ajout : maxima, courant admissible selon la pose, Voltaplan plus prudent dès 6 mm² ; « borne de recharge » retirée de l’exemple 6 mm² | Corrigé |
| 2 | 23 (sources) | « Correspondance section ↔ calibre maximal utilisée par l’application Voltaplan » | — | Le code n’est pas une source réglementaire | P2 | Consigne | Remplacée par RGIE tableau 4.11 | Corrigé |
| 3 | 18 (FAQ), 66 | « four et bouilloire en même temps » sur le circuit de prises | Obligation réglementaire (omise) | Exemple contraire au RGIE : le four doit avoir un circuit dédié | P1 | RGIE 5.2.1.2, p. 129-130 : « le four électrique sont aussi alimentés séparément par un circuit dédié » | Exemple remplacé : radiateur d’appoint 2 000 W + bouilloire 2 000 W + grille-pain 900 W = 21,3 A ; « Le four doit avoir son propre circuit (RGIE, 5.2.1.2) » | Corrigé |
| 4 | 98 | « les circuits des pièces de vie sont protégés par des différentiels de 30 mA, qui coupent avant que le courant ne devienne mortel » | Obligation réglementaire + fausse sécurité | (a) Le RGIE vise des circuits (prises, éclairage, salle de bain, lave-linge/sèche-linge/lave-vaisselle), pas des « pièces de vie » ; (b) un différentiel ne limite pas le courant et ne protège pas d’un contact phase-neutre ou phase-phase : présentation comme garantie | P1 | RGIE 4.2.4.3 b, p. 101 (liste des points 1 à 4) ; principe de fonctionnement du différentiel | Reformulé : liste exacte des circuits (RGIE, 4.2.4.3 b), « réduit fortement le risque, mais ne protège pas d’un contact entre deux conducteurs » ; consignation ajoutée | Corrigé |
| 5 | 14 (retenir) | « d’où les différentiels de 30 mA » | Simplification pédagogique | Même risque de lecture « garantie » | P3 | idem | « qui réduisent ce risque sans le supprimer » | Corrigé |
| 6 | 12 (retenir) | « 1,5 mm² → 16 A, 2,5 mm² → 20 A » | Obligation réglementaire | Exact pour le disjoncteur seulement (fusible : 10 A / 16 A) | P3 | RGIE tableau 4.11, p. 117 | « maximum en disjoncteur : … » | Corrigé |
| 7 | 89 | Surcharge : « coupe après quelques secondes ou minutes » | Principe physique / norme produit | Sous-estimé : à faible surcharge le déclenchement peut prendre jusqu’à environ une heure (temps conventionnel des disjoncteurs, EN 60898 non relue) | P3 | Norme produit (non relue) | « quelques secondes à près d’une heure, d’autant plus vite que la surcharge est forte » | Corrigé |
| 8 | 69 | « Celui qui part par la phase revient entièrement par le neutre » | Simplification pédagogique | En 3 × 230 V, retour par une seconde phase ; l’article renvoie déjà à alternatif-mono-tri ailleurs | P3 | Réseaux belges | Laissé (renvoi existant dans electricite-c-est-quoi ; ajout jugé alourdissant) | Proposé |

Affirmations vérifiées sans problème : 1 A ≈ 6,24 × 10¹⁸ électrons/s (« six milliards de milliards ») → physique ; 1 A = 1 000 mA ; I = P ÷ U : 8/230 = 0,035 A, 100/230 = 0,43 A, 800/230 = 3,5 A, 2 000/230 = 8,7 A, 3 000/230 = 13,0 A, 4 × 0,035 = 0,14 A, 20 W < 0,1 A → recalculés ; SVG (0,035 A / 8,7 A) cohérent ; remarque cos φ des moteurs → correcte ; courants des branches en parallèle s’additionnent → physique ; principe du différentiel (comparaison aller/retour, coupe à quelques dizaines de mA de fuite) → correct ; échauffement, dégradation de l’isolant, risque d’incendie → physique ; ne pas surcalibrer le disjoncteur (FAQ 3) → RGIE 4.4.1.4 ; court-circuit : centaines à milliers d’ampères, coupure instantanée (magnétique) → correct ; ampèremètre en série, pince autour d’un seul conducteur (annulation aller/retour) → physique ; quelques mA perceptibles, quelques dizaines de mA tétanisation/fibrillation → ordres de grandeur (IEC 60479 non relue).
Incertitudes : la valeur réelle du courant admissible selon le mode de pose (4.4.1.4 renvoie aux « règles de l’art », non accessibles ici).

### resistance-loi-ohm — La résistance et la loi d’Ohm

Fichiers : learn/fr/resistance-loi-ohm.html
Affirmations vérifiées : 32 (dont réglementaires : 2)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 88 | Corps humain : « Retenons un ordre de grandeur de 1 000 Ω » | Principe physique (ordre de grandeur) | Valeur non sourçable comme valeur fixe ; le RGIE dit seulement qu’elle dépend de l’humidité de la peau. Risque qu’un lecteur la prenne pour une valeur sûre. | P2 | RGIE 2.4.1 a, p. 26 (« dépend de la résistance du corps humain […] humidité de la peau ») ; IEC 60479 non relue | « Ce n’est qu’un ordre de grandeur, pas une valeur sûre » | Corrigé |
| 2 | 93 | « c’est pour cela qu’un câble de 1,5 mm² est limité à 16 A » | Obligation réglementaire | Exact (disjoncteur) mais sans source ni précision du dispositif | P3 | RGIE 4.4.1.4, tableau 4.11, p. 117 | « 16 A au plus pour un disjoncteur sur un circuit en 1,5 mm² (RGIE, 4.4.1.4) » | Corrigé |
| 3 | 75 | Résistivité « 0,0175 Ω pour 1 m et 1 mm² » | Principe physique | Valeur à 20 °C (0,0172 Ω·mm²/m pour le cuivre recuit, 0,0175 usuel) ; elle augmente d’environ 20 % à 70 °C | P3 | Physique | Ajout « à 20 °C » (la hausse avec la température est déjà mentionnée l. 80) | Corrigé |
| 4 | 72 | « quatre fois plus de temps à chauffer » | Simplification pédagogique | Approximatif (pertes thermiques) | P3 | Physique | « environ quatre fois » | Corrigé |

Affirmations vérifiées sans problème : U = R × I et ses deux formes → physique ; triangle SVG → correct ; ordres de grandeur (câbles : centièmes à dixièmes d’Ω ; élément chauffant : dizaines d’Ω ; isolant : MΩ) → physique ; 230 ÷ 8,7 = 26,4 Ω (230²/2 000 = 26,45) → recalculé ; sous 115 V : 4,35 A et puissance ÷ 4 → recalculé ; 0,0175 × 40 ÷ 1,5 = 0,467 Ω, chute 4,7 V, ≈ 225 V → recalculés ; aller + retour = 40 m → correct ; court-circuit 230 ÷ 0,5 = 460 A, ≈ 29 × 16 A (« des dizaines de fois ») → recalculé ; 230 ÷ 1 000 = 230 mA → recalculé ; P = R × I² : 0,467 × 100 = 47 W, × 400 = 187 W (« près de 190 W ») → recalculés ; « deux fois plus résistant chauffe deux fois plus à courant égal » → physique ; loi d’Ohm non applicable telle quelle aux LED/chargeurs/moteurs → correct ; mesure de résistance uniquement hors tension, continuité et isolement (appareil spécial) → correct.
Incertitudes : aucune.

### puissance-energie — Puissance et énergie (W, kWh)

Fichiers : learn/fr/puissance-energie.html
Affirmations vérifiées : 33 (dont réglementaires : 2)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 48 | « les gros appareils (four, lave-linge, lave-vaisselle) ont souvent leur propre circuit » | Obligation réglementaire affaiblie en pratique | Le RGIE impose un circuit dédié (domestique) pour lave-linge, lave-vaisselle, sèche-linge, cuisinière, taque, four et tout appareil à poste fixe ≥ 2 600 W ; chauffage fixe sur circuit(s) dédié(s) | P1 | RGIE 5.2.1.2, p. 129-130 : « d’une puissance nominale supérieure ou égale à 2600 W est alimenté séparément par un circuit dédié » | « le RGIE impose un circuit dédié pour … (RGIE, 5.2.1.2) » | Corrigé |
| 2 | 19 (FAQ) | « La puissance indiquée sur l’étiquette est un maximum » | Simplification pédagogique | C’est la puissance nominale (pas toujours un maximum strict) | P3 | — | « puissance nominale, souvent atteinte seulement par moments » | Corrigé |
| 3 | 90 | « puissance maximale, fixée par le calibre du disjoncteur de branchement » ; lien sbg-energy | Prescription GRD | Exact dans le principe (calibre fixé par le gestionnaire de réseau, prescriptions Synergrid non relues) | P3 | — | Laissé | Proposé |

Affirmations vérifiées sans problème : P = U × I, I = P ÷ U ; 2 200/230 = 9,6 A ; 2 500/230 = 10,9 A ; P = R × I², P = U²/R → physique ; 230 × 20 = 4 600 W ; 2 000 + 900 + 1 200 = 4 100 W ; + 2 000 W = 6 100 W > 4 600 W → recalculés ; E = P × t ; 2 kW × 0,05 h = 0,1 kWh ; 1 L de 15 à 100 °C ≈ 0,099 kWh, donc ≈ 3 min à 2 kW (sans pertes) → recalculé ; 0,3 kWh × 365 = 110 kWh ; 8 W × 5 h × 365 = 14,6 kWh ; 60 W → 109,5 kWh, rapport 7,5 ; 0,1 kWh ÷ 8 W = 12,5 h ; 5 W × 8 760 h = 43,8 kWh ; coûts 4,38 € et 32,85 € à 0,30 €/kWh (prix présenté comme hypothétique) → recalculés ; SVG 1 kW × 1 h = 100 W × 10 h → correct ; 230 × 40 = 9 200 VA → recalculé ; 3 000 W → 13 A → recalculé ; distinction puissance/énergie, compteur bihoraire et injection → correct.
Incertitudes : aucune.

### alternatif-mono-tri — Courant alternatif, monophasé et triphasé

Fichiers : learn/fr/alternatif-mono-tri.html
Affirmations vérifiées : 40 (dont réglementaires : 3)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 17 (FAQ), 104 | « environ 133 V entre une phase et la terre » (3 × 230 V) | Principe physique | Présenté comme une valeur fixe. Le 3 × 230 V belge est en général un schéma IT : la tension phase-terre n’est pas imposée et peut atteindre 230 V lors d’un premier défaut sur le réseau. Risque de sous-estimer le danger. | P1 | RGIE 2.2.1.2 b.3 (schéma IT, « n’a aucun point du réseau […] relié directement à la terre »), p. 13 ; physique des réseaux IT | « en temps normal environ 133 V […] jusqu’à 230 V lors d’un défaut sur le réseau » (FAQ et tableau) | Corrigé |
| 2 | 109 | Conséquences pratiques du 3 × 230 V | Principe physique | Le schéma IT n’était pas nommé ni expliqué | P2 | RGIE p. 13 (définition IT) | Ajout : « en général exploité en schéma IT […] la tension entre une phase et la terre n’est pas fixe » | Corrigé |
| 3 | 13 (retenir) | « 16 A par phase donnent environ 11 kW » | Principe physique | Hypothèse cos φ = 1 non dite | P3 | Physique | « avec cos φ = 1, … » | Corrigé |
| 4 | 123 | « certains appareils électroniques, le courant est légèrement décalé » | Simplification pédagogique | Pour l’électronique, le facteur de puissance inclut la déformation (harmoniques), pas seulement le déphasage ; « légèrement » minimisant | P3 | Physique | Ajout du facteur de puissance (deux effets), suppression de « légèrement » | Corrigé |
| 5 | 129 | « il ne fournit que 920 W de puissance active » | Principe physique | 920 W est la puissance absorbée ; la puissance mécanique est plus faible (rendement) | P3 | Physique | « il n’absorbe que 920 W […] (puissance mécanique un peu plus faible) » | Corrigé |
| 6 | 132 | « coupez le circuit au tableau et vérifiez l’absence de tension » | Bonne pratique | Consignation absente | P2 | Principe de consignation | Ajout « empêchez sa remise sous tension », « avec un appareil adapté » | Corrigé |

Affirmations vérifiées sans problème : 50 Hz, 100 changements de sens/s, cycle de 20 ms → physique ; continu (piles, PV avant onduleur) → correct ; transformation de tension, transport à haute tension → physique ; 325 V crête → recalculé ; monophasé = deux conducteurs actifs (phase + neutre ou deux phases) → réseaux belges ; triphasé décalé d’un tiers de cycle, facteur √3 entre tension composée et simple, champ tournant → physique ; SVG des trois phases : crêtes de L1, L2, L3 à x = 210, 370, 530 (90°, 210°, 330°) et valeurs initiales 130 / 199,3 / 60,7 → recalculées, exact ; SVG et tableau des deux réseaux (400/230 V, 230 V, pas de neutre) → exact ; protections coupant les deux conducteurs en 3 × 230 V, appareil 400 V non raccordable tel quel → correct ; P = √3 × U × I × cos φ : 1,732 × 400 × 16 = 11 085 W, 1,732 × 230 × 16 = 6 374 W → recalculés ; borne 11 kW → cohérent ; équilibrage des phases → bonne pratique ; S = U × I (VA), P = U × I × cos φ, cos φ entre 0 et 1, 230 × 5 = 1 150 VA, × 0,8 = 920 W, 9,2 kVA pour 40 A → recalculés.
Incertitudes : le RGIE ne dit pas que le réseau public 3 × 230 V est IT (il définit seulement les schémas) ; l’affirmation « en général exploité en schéma IT » vient de la pratique des gestionnaires de réseau (prescriptions Synergrid non relues) : à faire confirmer. Les affirmations « 3N × 400 V le plus répandu en Europe » et « 3 × 230 V encore très présent dans de nombreuses communes belges » ne sont pas sourcées (connaissance générale, plausible).

### serie-et-parallele — Circuits en série et en parallèle

Fichiers : learn/fr/serie-et-parallele.html
Affirmations vérifiées : 30 (dont réglementaires : 0)
Statut : Validé

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 90 | « en parallèle entre la phase et le neutre » | Simplification pédagogique | Oublie le réseau 3 × 230 V (entre deux phases) | P3 | Réseaux belges | Ajout « (entre deux phases sur un réseau 3 × 230 V) » | Corrigé |
| 2 | 96 | « phase avec phase, neutre avec neutre, terre avec terre » | Simplification pédagogique | Correct ; précisé « chaque conducteur avec le conducteur de même fonction » pour ne pas suggérer une identification par la couleur | P3 | Consigne (sécurité pédagogique) | Reformulé | Corrigé |

Affirmations vérifiées sans problème : propriétés série (même courant, tensions qui s’additionnent, ouverture = arrêt) et parallèle (même tension, courants qui s’additionnent, branches indépendantes) → lois de Kirchhoff ; R série = somme ; 1/R = Σ 1/Ri → physique ; 230²/60 = 881,7 Ω ; 60/230 = 0,26 A ; série : 230/1 763 = 0,13 A, puissance ÷ 4 (approximation signalée, filament) → recalculés ; LED non résistives → correct ; deux 26 Ω en parallèle = 13 Ω, 230/13 = 17,7 A → recalculé ; 8,7 + 3,9 + 5,2 = 17,8 A (« près de 18 A ») → recalculé ; interrupteur, disjoncteur, fusible, différentiel en série → correct ; câbles en série (chute de tension) → physique ; voltmètre en parallèle, ampèremètre en série, court-circuit = chemin parallèle de résistance quasi nulle → physique ; schéma unifilaire ≠ série → correct ; FAQ guirlande, multiprise (surcharge du cordon), deux lampes 115 V en série déconseillées → correct ; SVG série/parallèle → topologies exactes.
Incertitudes : aucune.

### Anomalies du moteur de Voltaplan

1. **`src/rules/be/rgie.ts`, l. 26-42, `MAX_PROTECTION_BY_SECTION` + règle `R-CABLE-PROT` (catalogue `src/rules/be/catalog.ts` l. 98, `kind: 'nonCompliance'`)**.
   Ce qui ne va pas : les valeurs dès 6 mm² sont plus basses que le tableau 4.11 du RGIE (domestique, disjoncteur) : 6 → 32 A (RGIE 40 A), 10 → 50 A (63 A), 16 → 63 A (80 A), 25 → 80 A (100 A), 35 → 100 A (125 A) ; 50 mm² → 125 A n’est pas dans le tableau. Le commentaire les présente à juste titre comme « valeurs prudentes usuelles », et le message `rule.R-CABLE-PROT` (src/i18n/fr.ts l. 1255) dit « maximum conseillé », mais la règle est classée `nonCompliance` : un 6 mm² protégé par 40 A est donc signalé non conforme alors que le RGIE l’autorise dans une installation domestique (sous réserve du courant admissible selon la pose). Les fusibles ne sont pas distingués non plus (RGIE : 1,5 → 10 A, 2,5 → 16 A, 4 → 20 A, 6 → 32 A, 10 → 50 A…) : un fusible de 16 A sur 1,5 mm² passe sans remarque alors que le tableau 4.11 le refuse.
   Source : RGIE 4.4.1.4, tableau 4.11, p. 117.
   Correction proposée : deux tables (disjoncteur / fusible) recopiées du tableau 4.11 pour la non-conformité ; garder les valeurs prudentes actuelles comme seuil d’une recommandation distincte (ex. `R-CABLE-PROT-PRUDENT`, `kind: 'recommendation'`) signalant le courant admissible à vérifier selon la pose.
   Tests de non-régression : 6 mm² + disjoncteur 40 A → pas de non-conformité (recommandation seule) ; 6 mm² + disjoncteur 50 A → non-conformité ; 1,5 mm² + fusible 16 A → non-conformité ; 1,5 mm² + fusible 10 A → OK ; 2,5 mm² + disjoncteur 20 A → OK.
2. Hors de ma rubrique, signalé pour coordination : `learn/fr/section-des-cables.html` l. 48 affirme « Ce ne sont pas des valeurs fixées telles quelles par le RGIE », ce que contredit le tableau 4.11 (RGIE 4.4.1.4, p. 117) pour les installations domestiques. À transmettre à l’auditeur de cette rubrique.

### Références à ajouter à rgieRefs

| Numéro | Page | Citation |
|---|---|---|
| 2.4.1 | 26 | Tableau 2.3 : « BB1 Peau sèche ou humide par sueur 50 » ; « BB2 Peau mouillée 25 » ; « BB3 Peau immergée 12 » (V, alternatif) |
| 4.2.5.3 | 106 | « Les parties actives des circuits TBTS et TBTP sont séparées physiquement les unes des autres et d’autres circuits. » |
| 4.4.1.4 | 116-117 | « Pour les installations domestiques, l’intensité nominale maximale […] est donnée au tableau 4.11. » |
| 5.2.1.2 | 129-130 | « d’une puissance nominale supérieure ou égale à 2600 W est alimenté séparément par un circuit dédié » |

Utilisées : 2.4.1 et 4.2.5.3 (tension), 4.4.1.4 (courant, resistance-loi-ohm), 5.2.1.2 (courant, puissance-energie). Références existantes réutilisées : 4.2.4.3 b (courant), 6.4.7.3 (electricite-c-est-quoi).
`npm run learn:check` sur les 7 articles : seules erreurs restantes = ces 4 références non encore listées.

### Couverture

electricite-c-est-quoi | 34 | 0/0/2/3 | Validé avec réserves
tension | 36 | 0/3/2/2 | Validé avec réserves
courant | 38 | 0/3/1/4 | Validé avec réserves
resistance-loi-ohm | 32 | 0/0/1/3 | Validé avec réserves
puissance-energie | 33 | 0/1/0/2 | Validé avec réserves
alternatif-mono-tri | 40 | 0/1/2/3 | Validé avec réserves
serie-et-parallele | 30 | 0/0/0/2 | Validé

## Rubrique : Câbles et canalisations

Source : RGIE Livre 1 v07 (livre1.txt). Pages imprimées d'après les pieds de page. Numéros de ligne : ceux des fichiers **avant** correction (commit c6cf810).

### couleurs-des-fils — Les couleurs des fils

Fichiers : learn/fr/couleurs-des-fils.html
Affirmations vérifiées : 34 (dont réglementaires : 14)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 10, 18, 50, 72 | « Le vert-jaune est réservé à la terre (conducteur de protection), sans aucune exception » | Interdiction réglementaire | Le RGIE réserve le vert-jaune au PE, aux conducteurs d'équipotentialité et aux PEN/PEM/PEL ; il prévoit des exceptions de repérage (cordons méplats 3 conducteurs sans gaine, canalisations préassemblées, coloration techniquement impossible). « sans aucune exception » est faux à la lettre. | P2 | RGIE 5.1.6.2, p. 128 : « utilisés soit comme conducteur de protection (PE) soit comme conducteur d'équipotentialité » ; 5.4.3.3, p. 180 | « terre et liaisons équipotentielles » dans À retenir, tableau, SVG (texte et aria-label) ; FAQ terre réécrite avec mention des exceptions de câbles particuliers | Corrigé |
| 2 | 17 (FAQ) | « Peut-on utiliser un fil bleu comme phase ? C'est à éviter … repérez clairement le fil » | Interdiction réglementaire | Obligation affaiblie en conseil : dans un circuit qui comporte un neutre, le bleu est réservé au neutre, le repérage n'est pas une dérogation. La seule dérogation est le circuit sans neutre (câble multipolaire, sauf PE). | P1 | RGIE 5.1.6.2, p. 128-129 : « réservés au conducteur neutre dans les circuits comportant un tel conducteur » | FAQ réécrite : interdit si le circuit a un neutre, admis sans neutre (3 × 230 V), jamais en terre | Corrigé |
| 3 | 94 | « un câble 3G1,5 utilisé pour un va-et-vient … On repère alors les fils … Ce repérage se pratique couramment pour les conducteurs actifs » | Interdiction réglementaire | Revient à utiliser le bleu comme navette dans un circuit d'éclairage (qui a un neutre) : non admis par le RGIE. | P1 | RGIE 5.1.6.2, p. 128 | Paragraphe réécrit : repérage admis pour brun/noir/gris, jamais pour vert-jaune, ni pour le bleu si le circuit a un neutre ; le 3G1,5 entre interrupteurs de va-et-vient ne convient pas | Corrigé |
| 4 | 82, 12 | « Le bleu et le vert-jaune sont à proscrire » (retours, navettes) | Interdiction réglementaire | Présenté comme recommandation, c'est une interdiction | P2 | RGIE 5.1.6.2, p. 128 | « interdit », avec la raison (circuit d'éclairage = circuit avec neutre) | Corrigé |
| 5 | 102 | « Bleu détourné sans repérage » (erreur fréquente) | Interdiction réglementaire | Laisse entendre qu'avec repérage c'est correct | P2 | RGIE 5.1.6.2 | « interdit, même repéré » dans un circuit qui a un neutre | Corrigé |
| 6 | 11, 67, 74 | « la phase est en brun, noir ou gris » | Exigence normative / convention fabricants | Le RGIE n'impose aucune couleur de phase (il interdit seulement vert/jaune et, avec neutre, le bleu). Brun/noir/gris = convention des câbles harmonisés (HD 308, non consultée). | P3 | RGIE 5.1.6.2 (silence sur les phases) | « le plus souvent » + paragraphe ajouté après le tableau : ce que le RGIE fixe et ce qui est convention | Corrigé |
| 7 | — | (absent) vert ou jaune seuls | Interdiction réglementaire | Omission : vert et/ou jaune interdits pour tout conducteur actif, sauf circuits de commande/signalisation < 1,5 mm² | P3 | RGIE 5.1.6.2, p. 128 et 5.2.6.2 a, p. 139 | Ajouté dans le paragraphe après le tableau | Corrigé |
| 8 | 13, 86 | Réseau 3 × 230 V : bleu relié à une phase | Dérogation réglementaire | Exact, mais non rattaché au RGIE ; risque de contradiction apparente avec « bleu réservé au neutre » | P3 | RGIE 5.1.6.2, p. 129 : « Lorsque le circuit ne comporte pas de conducteur neutre … peut être utilisé pour un autre usage » | Dérogation citée, avec rappel de sécurité | Corrigé |
| 9 | 87 | « les disjoncteurs doivent couper les deux conducteurs (disjoncteurs bipolaires) » | Obligation réglementaire | Le RGIE exige une détection de surintensité sur chaque conducteur de ligne (les deux, en 3 × 230 V) ; « couper » est approximatif | P3 | RGIE 4.4.4.1, p. 119 : « Une détection de surintensité est prévue sur tous les conducteurs de ligne » | « chacun des deux conducteurs doit être protégé … disjoncteurs bipolaires dont les deux pôles sont protégés » | Corrigé |
| 10 | 104 | « le simulateur signale … un neutre qui n'est pas en bleu » | Choix d'implémentation | Imprécis : cablage-sim.js traite le neutre non bleu en avertissement et l'usage détourné du bleu/vert-jaune en erreur, ce qui est conforme au RGIE (le bleu est réservé au neutre, le neutre n'est pas obligé d'être bleu) | P3 | site/apprendre/cablage-sim.js l. 214-223 ; RGIE 5.1.6.2 | Phrase précisée | Corrigé |

Affirmations vérifiées sans problème : rôles phase/neutre/terre → principe physique ; 3G2,5 = brun, bleu, vert-jaune et 5G ajoute noir et gris → documentation fabricants (convention harmonisée) ; ordre brun-noir-gris en triphasé → convention ; retour lampe et navettes (définitions) → lexique ; simple allumage brun/noir/bleu/vert-jaune → conforme 5.1.6.2 ; 3 × 230 V à Bruxelles et anciens réseaux, bleu sous tension → principe physique ; « la couleur informe, elle ne prouve rien », couper et vérifier l'absence de tension sur chaque conducteur, tournevis testeur insuffisant → sécurité pédagogique (correct) ; phase/neutre inversés → interrupteur sur le neutre → principe ; vieilles installations (rouge, blanc) → mesure par électricien (correct) ; contrôle par organisme agréé des installations neuves et modifications importantes → hors périmètre précis, formulation générale acceptable.
Incertitudes : la norme de couleurs harmonisées (NBN HD 308 S2) n'a pas été lue ; l'interprétation « circuit comportant un neutre » appliquée au câble entre deux interrupteurs de va-et-vient est littérale (le circuit d'éclairage a un neutre) mais mérite confirmation par un organisme agréé, car elle condamne une pratique répandue (3G1,5 en navettes avec bleu repéré).

### types-de-cables — Les types de câbles (XVB, VOB…)

Fichiers : learn/fr/types-de-cables.html
Affirmations vérifiées : 30 (dont réglementaires : 9)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 75 | « H05VV-F … (désigné VFVB en Belgique) » | Désignation fabricant | Faux : le RGIE cite le VFVB comme câble « muni d'une armure métallique ». Aucune source vérifiable trouvée pour la désignation belge du H05VV-F (VTMB couramment cité, non vérifié). | P1 | RGIE 8.x dispositions transitoires (livre1.txt l. 16247-16249) : « des câbles munis d'une armure métallique tels que du type VFVB » | Remplacé par « désignation harmonisée européenne » ; VFVB ajouté aux variantes comme câble à armure métallique | Corrigé |
| 2 | 94 | Enterré : « posé selon les conditions indiquées par le fabricant (profondeur, protection mécanique, grillage avertisseur) » | Obligation réglementaire | Obligations RGIE omises et renvoyées au fabricant : câble prévu pour la pose enterrée, profondeur ≥ 0,60 m sauf impossibilité (alors fourreau), et armure+écran, ou gaine résistante + couverture, ou fourreau. Le « grillage avertisseur » n'est pas une exigence du RGIE. | P1 | RGIE 5.2.9.2 a, p. 141-142 : « à une profondeur minimale de 0,60 m » | Puce réécrite (0,60 m, trois options de protection, VOB jamais enterré) | Corrigé |
| 3 | 13 | « Les câbles souples (H05VV-F, H07V-K) … pas aux circuits fixes encastrés » | Simplification | Incohérent avec le tableau (H07V-K dans un tube) : le H07V-K est un conducteur isolé qui peut être posé sous conduit comme le VOB (RGIE 5.2.9.3 b admet les conducteurs isolés en conduit) | P2 | RGIE 5.2.9.3 b, p. 143 | À retenir réécrit : H05VV-F pour le mobile ; H07V-K sous tube ou en tableau | Corrigé |
| 4 | 19 (FAQ) | « Peut-on encastrer une rallonge ou un câble souple ? Non. » | Interdiction réglementaire / bonne pratique | Justification ajoutée : interdiction de placer des cordons souples (« CSuB ou similaires ») dans des conduits | P3 | RGIE 5.2.9.3 f, p. 145 | Référence ajoutée | Corrigé |
| 5 | 31 | « jamais directement dans le plâtre ou à l'air libre » | Interdiction réglementaire | Exact mais non sourcé ; omission du vide de construction (interdit aussi) | P3 | RGIE 5.2.9.10 a/b, p. 146-147 ; 5.2.9.5, p. 146 ; 5.2.9.9, p. 146 | Complété et sourcé ; goulotte précisée « fermée » | Corrigé |
| 6 | 106 | « un 3G pour un va-et-vient oblige à détourner une couleur » | Interdiction réglementaire | Le « détournement » serait le bleu en navette, interdit dans un circuit avec neutre | P2 | RGIE 5.1.6.2, p. 128 | Précisé | Corrigé |
| 7 | 88 | « La section se choisit selon le calibre du disjoncteur et la longueur » | Obligation réglementaire | Omet le mode de pose (courant admissible) | P3 | RGIE 4.4.1.4, p. 115-116 | « le mode de pose » ajouté | Corrigé |
| 8 | 17 (FAQ) | XVB « enterré selon les conditions de pose » | Obligation réglementaire | Idem #2 | P3 | RGIE 5.2.9.2 | « avec les protections exigées par le RGIE » | Corrigé |

Affirmations vérifiées sans problème : fil = un conducteur isolé, câble = conducteurs sous gaine → définitions ; VOB fil rigide PVC ≈ H07V-U/R → documentation fabricants (non contredit) ; XVB : isolant XLPE, gaine PVC, 0,6/1 kV → fiches Eupen et Prysmian (marquage « CEBEC … XVB 0,6/1 kV Cca-s3,d2,a3 ») ; RGIE tableau 2.23 cite « Câble XVB Cca » et « H07V-U Eca » (p. 50-51) ; H07V-K fil souple PVC → harmonisé ; notation 3G2,5 / 3x2,5 (G = vert-jaune, x = sans) → convention HD 308 ; XVB 3G2,5 typique des prises → cohérent avec 5.2.1.2 ; pose apparente : seulement des câbles → 5.2.9.5 ; câble rigide pour appareil mobile à proscrire → principe mécanique ; l'unifilaire porte type, conducteurs, section, pose → 3.1.2 (rgieRefs) ; ce que fait Voltaplan (types, BOM, équivalents) → code (src/model/schema.ts, src/bom/bom.ts) ; câble non prévu pour l'extérieur → 5.2.3.7 (AN) ; coupure + VAT → sécurité.
Incertitudes : désignation belge exacte du H05VV-F (VTMB ?) non vérifiable sans la norme NBN ; la norme belge de l'XVB (NBN HD 604 selon Eupen, pas lue) ; 5.2.9.3 f vise « cordons souples CSuB ou similaires » : l'assimilation du H05VV-F à « similaires » est une interprétation.

### section-des-cables — La section des câbles

Fichiers : learn/fr/section-des-cables.html
Affirmations vérifiées : 32 (dont réglementaires : 13)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 48 | « Ce ne sont pas des valeurs fixées telles quelles par le RGIE » | Obligation réglementaire | FAUX : pour les installations domestiques, le RGIE fixe le calibre maximal selon la section (tableau 4.11) | P1 | RGIE 4.4.1.4, tableau 4.11, p. 116-117 : « l'intensité maximale du disjoncteur qui protègent une canalisation électrique est donnée au tableau 4.11 » | Paragraphe réécrit : maxima du RGIE + courant admissible selon la pose | Corrigé |
| 2 | 36-47, 12, SVG 50-80 | Tableau et schéma : 6 mm² → 32 A, 10 → 50 A, 16 → 63 A (disjoncteur) | Obligation réglementaire | Valeurs de la colonne fusibles, présentées comme maxima disjoncteur. RGIE (disjoncteur) : 6 → 40, 10 → 63, 16 → 80 | P1 | RGIE tableau 4.11, p. 117 | Tableau à deux colonnes (disjoncteur / fusible), SVG (textes, aria-label, figcaption, libellé « Disj. max. »), À retenir corrigés ; écart de Voltaplan signalé dans l'article | Corrigé |
| 3 | 85 | « 1,5 mm² est la section minimale pour un circuit d'une installation domestique (éclairage, commandes) » | Obligation réglementaire | Imprécis : règle générale 2,5 mm² ; 1,5 mm² admis seulement pour un circuit sans prise ; sections plus faibles admises pour commande/signalisation | P2 | RGIE 5.2.1.2 et tableau 5.1, p. 128-129 : « l'emploi de conducteurs isolés d'une section inférieure à 2,5 mm² est interdite » | Réécrit | Corrigé |
| 4 | 18 (FAQ), 86 | Prises en 2,5 mm² : justifié par l'usage seul | Obligation réglementaire | Obligation présentée comme choix pratique | P2 | RGIE 5.2.1.2, tableau 5.1, p. 129 | FAQ : « C'est une obligation du RGIE » | Corrigé |
| 5 | 86 | « 8 points de prise au plus (une prise double compte pour un point) » | Obligation réglementaire | Exact (« socles simples ou multiples ») ; ajout : un circuit mixte prises + éclairage suit les règles des prises | P3 | RGIE 5.3.5.2 b, p. 167 | Sourcé et complété | Corrigé |
| 6 | 87 | Circuit dédié : « chauffe-eau, pompe à chaleur, borne de recharge… » | Obligation réglementaire | Liste RGIE : lave-linge, lave-vaisselle, sèche-linge, cuisinière, taque, four, chauffage électrique fixe, et tout appareil à poste fixe ≥ 2 600 W. Chauffe-eau / PAC / borne ne sont dédiés par le RGIE que via le seuil de 2 600 W (sauf règles propres à la borne, non auditées ici) | P2 | RGIE 5.2.1.2, p. 129-130 : « d'une puissance nominale supérieure ou égale à 2600 W est alimenté séparément par un circuit dédié » | Réécrit avec la liste exacte | Corrigé |
| 7 | 91 | « le total dépasse 26 A : le disjoncteur finira par couper » | Principe physique | À 1,3 × In, un disjoncteur peut mettre longtemps (courant conventionnel de déclenchement 1,45 In en 1 h) ; « finira par » est plausible mais la durée était passée sous silence | P3 | IEC 60898-1 (non consultée, connaissance générale) | Précision : d'autant plus vite que la surcharge est forte | Corrigé |
| 8 | 23 (sources) | « valeurs prudentes pour une pose encastrée sous tube » | Choix d'implémentation | Source réglementaire absente | P3 | — | Source RGIE ajoutée (4.4.1.4, 5.2.1.2, 5.3.5.2 b) | Corrigé |
| 9 | 100-102 | Liste « Ce que vérifie Voltaplan » | Choix d'implémentation | Alignée sur le moteur ; signalé que le moteur est plus strict que le RGIE pour 6/10/16 mm² | P3 | src/rules/be/rgie.ts l. 31-41, 222 | Formulation ajustée | Corrigé |

Affirmations vérifiées sans problème : section = surface de cuivre en mm² → définition ; effet Joule, vieillissement de l'isolant → principe physique ; le disjoncteur protège le câble → RGIE 4.4.1.1 ; calibre ≤ capacité de la section → 4.4.1.4 ; courant admissible fonction de la pose, de l'isolant, de la température → 4.4.1.4 (texte exact) ; 2 000 W / 230 V ≈ 8,7 A, 17,4 A → calcul exact ; ne jamais augmenter le calibre → 4.4.1.4 ; longueur → chute de tension et déclenchement en court-circuit → 5.2.1.2 b et e ; section plus grosse sans risque, bornes à vérifier → bonne pratique ; contrôles Voltaplan ≠ contrôle agréé, couper et vérifier → sécurité.
Incertitudes : le tableau 4.11 ne précise pas la nature du conducteur (cuivre supposé) ni le mode de pose ; la règle de vérification du courant admissible (Iz ≥ IB, 5.2.1.2 a) renvoie aux règles de l'art (tableaux IEC 60364-5-52, non consultés).

### chute-de-tension — La chute de tension

Fichiers : learn/fr/chute-de-tension.html
Affirmations vérifiées : 26 (dont réglementaires : 3)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 93 | « Voltaplan compare le résultat à 3 % … et à 5 % … valeurs de référence de l'annexe G » | Exigence normative (informative) | Ne dit pas que le RGIE ne fixe aucune limite chiffrée ; un lecteur peut croire à un seuil réglementaire belge | P2 | RGIE 5.2.5, p. 138 : « doivent être limitées aux valeurs décrites dans les règles de l'art » ; 5.2.1.2 b, p. 129 | Paragraphe ajouté (pas de chiffre RGIE, annexe G informative, avertissement et non infraction), FAQ ajoutée, À retenir remplacé | Corrigé |
| 2 | 11, 41 | « ΔU = 2 × ρ × L × I ÷ S » | Simplification pédagogique | Formule valable pour cos φ = 1 et réactance négligeable ; non dit | P3 | IEC 60364-5-52 annexe G (via docs/calc.md ; norme non relue) | Précisé dans À retenir et paragraphe ajouté | Corrigé |
| 3 | 18 (FAQ) | « En triphasé équilibré, on utilise √3 au lieu de 2 » | Principe physique | Exact si on compare à 400 V ; sinon le pourcentage est faux | P3 | Principe physique ; annexe G (b = 1, rapport à U0) | « et on compare le résultat à 400 V » | Corrigé |

Affirmations vérifiées sans problème : exemple 2 × 0,0225 × 30 × 8,7 ÷ 2,5 = 4,70 V ≈ 2,04 % → calcul ; 10,8 V = 4,70 % → calcul et docs/calc.md ; 4 mm² au lieu de 2,5 : −37,5 % (« plus d'un tiers ») → calcul ; proportionnalité longueur / section → principe ; ρ = 0,0225 Ω·mm²/m (1,25 × 0,018) → docs/calc.md, annexe G ; 3 % / 5 % pour une installation alimentée par le réseau public BT → annexe G (via docs/calc.md, src/calc/electrical.ts VDROP_LIMIT) ; cumul depuis le compteur → principe ; calculs Voltaplan (au calibre, cumulé, puissances saisies, R-VDROP en avertissement, R-VDROP-RATING en information) → src/rules/be/rgie.ts l. 358-369 et fr.ts l. 666-690 ; estimation des longueurs + 10 % → docs ; long câble = courant de court-circuit faible → principe et RGIE 5.2.1.2 e ; remèdes → bonnes pratiques ; SVG (−4,7 V / −10,8 V) cohérent.
Incertitudes : texte de l'IEC 60364-5-52 annexe G non consulté directement (payant) : valeurs reprises de docs/calc.md.

### tubes-et-boites — Tubes, gaines et boîtes

Fichiers : learn/fr/tubes-et-boites.html
Affirmations vérifiées : 28 (dont réglementaires : 12)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 83 | « Un tube par usage quand c'est possible : séparer l'installation 230 V des câbles réseau … évite les perturbations » | Interdiction réglementaire | Obligation présentée comme bonne pratique : le RGIE interdit les conducteurs d'énergie et de télécommunication côte à côte sans écran, sauf si les deux sont des câbles | P1 | RGIE 4.5.4, p. 121 : « Il est interdit de placer côte à côte, sans interposition d'un écran, des conducteurs d'énergie et des conducteurs de télécommunication, sauf si les uns et les autres sont constitués de câbles » | Puce réécrite (interdiction + bonne pratique pour les câbles) ; rappel dans la FAQ des tubes vides | Corrigé |
| 2 | 13, 18, 81 | Boîte de dérivation accessible ; « un point refusé lors du contrôle » | Obligation réglementaire | Exact mais présenté comme « bon sens » ; le RGIE l'exige (conduits encastrés). « Derrière un meuble fixe / carrelé » : interprétation | P2 | RGIE 5.2.9.3 i.2, p. 145 : « les conducteurs ou les câbles restent accessibles » | Sourcé ; « refusé » adouci en « peut la refuser » | Corrigé (interprétation meuble/carrelage à valider) |
| 3 | 80 | Connexions jamais dans un tube | Interdiction réglementaire | Exact, non sourcé | P3 | RGIE 5.2.9.3 f, p. 145 ; 5.2.6.1, p. 139 | Sourcé | Corrigé |
| 4 | 84 | « Des trajets lisibles : on pose couramment les tubes à la verticale ou à l'horizontale » | Bonne pratique / obligation | Pour les câbles noyés sans conduit, le gabarit est une obligation (25-35 cm, 10-20 cm des chambranles) ; absence d'avertissement : un tracé deviné n'est pas une garantie avant de percer | P2 | RGIE 5.2.9.10 b, p. 146-147 | Obligation ajoutée + paragraphe de sécurité (détecteur, couper) | Corrigé |
| 5 | 40-41 | Diamètre et courbes larges comme habitudes | Obligation réglementaire | Le RGIE exige de pouvoir tirer et retirer les conducteurs et fixe des rayons de courbure minimaux | P3 | RGIE 5.2.9.3 d et e, p. 143-144 | Ajouté (8×, 5×, 10× le diamètre) | Corrigé |
| 6 | — | (absent) matériau des tubes | Obligation réglementaire | Omission : conduits non propagateurs de la flamme, sauf noyés sous 3 cm de matériau non combustible ; pas de plastique au-delà de 60 °C | P3 | RGIE 5.2.7.4, p. 141 ; 5.2.9.3 f, p. 145 | Paragraphe ajouté | Corrigé |
| 7 | 35 | Goulotte « profilé à couvercle » | Obligation réglementaire | Avec des fils sans gaine : parois pleines et couvercle à outil (hors locaux de service électrique) | P3 | RGIE 5.2.9.6, p. 146 | Ajouté | Corrigé |
| 8 | 37 | VOB : « isolant unique pas fait pour être noyé » | Interdiction réglementaire | Exact, non sourcé | P3 | RGIE 5.2.9.10, p. 146 | Sourcé | Corrigé |
| 9 | 92 | « Les boîtes de dérivation y figurent aussi, dessinées comme un petit cercle avec un point » (tableau 2.23) | Obligation réglementaire (symbole) | Le tableau 2.23 contient bien « Boîte de connexion, de dérivation, de raccordement » ; la forme du symbole n'est pas lisible dans l'extraction texte | P3 | RGIE tableau 2.23, p. 50-52 | Non modifié | À valider par un spécialiste (vérifier le dessin dans le PDF) |

Affirmations vérifiées sans problème : rôles du tube (protection, remplacement) → 5.2.9.3 e ; tube souple annelé / rigide / TAL-TAF → 5.2.9.3 a ; montage sous conduit autorisé partout → 5.2.9.3 c ; XVB en tube → 5.2.9.3 b ; boîtes : métal ou matière non propagatrice → 5.2.6.1 (ajouté) ; logements de volume suffisant → 5.2.6.1 ; rôle de la boîte de dérivation (simple allumage, neutre sans passer par l'interrupteur) → principe ; connecteurs serrés, connexion lâche qui chauffe → principe ; couper et vérifier avant d'ouvrir une boîte → sécurité ; tubes en attente, tire-fil → bonne pratique ; Voltaplan (propriétés « sous tube », boîte de dérivation) → code.
Incertitudes : portée de l'exception de 4.5.4 (« conducteurs de télécommunication lorsqu'ils relient le matériel électrique situé … dans des lieux ordinaires qui ne sont pas considérés comme des lieux accessibles au public ») : elle pourrait couvrir une habitation pour certains conducteurs ; l'article retient la règle générale, à faire confirmer. Par ailleurs, l'interdiction des raccords en T et en L dans les boîtes (5.2.9.3 i.2) n'a pas été ajoutée (sens technique incertain : pièces de conduit ou connexions).

### Anomalies du moteur de Voltaplan

1. **src/rules/be/rgie.ts, l. 31-41, `MAX_PROTECTION_BY_SECTION`** : 6 → 32 A, 10 → 50 A, 16 → 63 A, 25 → 80 A, 35 → 100 A, 50 → 125 A. Ce sont les valeurs de la colonne **fusible** du RGIE pour 6 à 35 mm² ; pour un disjoncteur, le RGIE (4.4.1.4, tableau 4.11, p. 117, installations domestiques) admet 40, 63, 80, 100, 125 A. Le moteur ne distingue pas fusible et disjoncteur : (a) faux positif R-CABLE-PROT pour un disjoncteur de 40 A sur 6 mm² ; (b) **faux négatif** pour un fusible sur 1,5 / 2,5 / 4 mm² (16 / 20 / 25 A admis par le moteur alors que le RGIE limite les fusibles à 10 / 16 / 20 A). Le commentaire « valeurs prudentes usuelles » est donc inexact. Correction proposée : deux tables issues du tableau 4.11 (disjoncteur / fusible), choix selon `prot.props.device`, en gardant une possibilité de réduction selon le mode de pose. Tests : 6 mm² + disjoncteur 40 A → aucun constat ; 6 mm² + disjoncteur 50 A → R-CABLE-PROT (max 40) ; 2,5 mm² + fusible 20 A → R-CABLE-PROT (max 16) ; 1,5 mm² + disjoncteur 16 A → aucun constat. La ligne 50 mm² n'existe pas dans le tableau 4.11 (à justifier ou retirer).
2. **src/rules/be/rgie.ts l. 222 + fr.ts l. 1253 `R-CABLE-MIN`** : « minimum de 1,5 mm² ». Le RGIE (5.2.1.2, tableau 5.1, p. 129) pose 2,5 mm² en règle générale, 1,5 mm² pour les circuits sans socle, et 0,5 / 0,75 mm² pour des circuits de commande, de signalisation et de mesure (et certains circuits en tableau). Le message est correct pour les circuits d'utilisation sans prise, mais (a) peut produire un faux positif pour un circuit de commande en 0,75 ou 0,5 mm² (sonnerie, commande de contacteur) si le moteur les modélise ; (b) R-SOCKET-SECTION (l. 284) ne couvre que les circuits « de prises » : vérifier qu'un circuit mixte (prises + éclairage, RGIE 5.3.5.2 b) est bien traité comme circuit de prises. Tests proposés : circuit mixte 1,5 mm² avec 1 prise → R-SOCKET-SECTION ; circuit de commande 0,75 mm² → pas de R-CABLE-MIN.
3. Chute de tension (R-VDROP) : conforme (avertissement, pas une règle RGIE). Aucune anomalie, mais `advice.R-VDROP` / docs pourraient préciser que le RGIE (5.2.5) ne fixe pas de chiffre.
4. Simulateur cablage-sim.js (l. 214-223) : conforme au RGIE 5.1.6.2 (bleu détourné = erreur ; neutre non bleu = avertissement). Aucune anomalie.

### Références à ajouter à rgieRefs

- 4.4.1.4 — p. 115-117 — tableau 4.11 : « l'intensité maximale du disjoncteur qui protègent une canalisation électrique est donnée au tableau 4.11 »
- 4.4.4.1 — p. 119 — « Une détection de surintensité est prévue sur tous les conducteurs de ligne. »
- 4.5.4 — p. 121 — « Il est interdit de placer côte à côte, sans interposition d'un écran, des conducteurs d'énergie et des conducteurs de télécommunication »
- 5.1.6.2 — p. 128-129 — « Les matériaux d'isolation de couleur bleue sont réservés au conducteur neutre dans les circuits comportant un tel conducteur. »
- 5.2.1.2 — p. 128-130 — « l'emploi de conducteurs isolés d'une section inférieure à 2,5 mm² est interdite » (+ tableau 5.1, circuits dédiés ≥ 2600 W)
- 5.2.5 — p. 138 — « Les chutes de tension … doivent être limitées aux valeurs décrites dans les règles de l'art. »
- 5.2.6.1 — p. 139 — « Les connexions pour jonctions, raccordements ou dérivations sont exécutées … dans des … boîtes de jonction ou de dérivation »
- 5.2.7.4 — p. 141 — « Les conduits thermoplastiques propagateurs de la flamme ne sont utilisés que lorsqu'ils sont encastrés dans des matériaux non combustibles »
- 5.2.9.2 — p. 141-142 — « à une profondeur minimale de 0,60 m mesurée à partir de la surface du sol »
- 5.2.9.3 d — p. 143 — « possible de tirer et de retirer facilement les conducteurs ou câbles »
- 5.2.9.3 f — p. 145 — « Il est interdit … d'introduire des connexions, jonctions ou ligatures entre les conducteurs dans les conduits »
- 5.2.9.3 i — p. 145 — « Dans les boîtes de jonction, de dérivation et de tirage, les conducteurs ou les câbles restent accessibles »
- 5.2.9.5 — p. 146 — « seul le placement de câbles est admis pour la pose à l'air libre et le montage en apparent »
- 5.2.9.6 — p. 146 — goulottes « à parois pleines et munies d'un couvercle, qu'on ne peut ouvrir qu'à l'aide d'un outil »
- 5.2.9.10 — p. 146-147 — « Il est interdit de placer des conducteurs uniquement pourvus d'une isolation principale noyés dans les murs des locaux. »
- 5.2.9.10 b — p. 147 — « les parcours horizontaux se trouvent entre 25 et 35 cm du plancher ou du plafond »
- 5.4.3.3 — p. 180 — « celle-ci est de couleur vert-jaune »

### Couverture

couleurs-des-fils | 34 | P0 0 / P1 2 / P2 3 / P3 5 | Validé avec réserves
types-de-cables | 30 | P0 0 / P1 2 / P2 2 / P3 4 | Validé avec réserves
section-des-cables | 32 | P0 0 / P1 2 / P2 3 / P3 4 | Validé avec réserves
chute-de-tension | 26 | P0 0 / P1 0 / P2 1 / P3 2 | Validé avec réserves
tubes-et-boites | 28 | P0 0 / P1 1 / P2 2 / P3 6 | Validé avec réserves

## Rubrique : Protections

Source : RGIE Livre 1 v07 (15/09/2026), texte extrait `scratchpad/livre1.txt`. Pages = pages imprimées (pied de page).
Aucun exercice n'est rattaché à ces articles (pas de fichier `tools/learn/exercices/` concerné).
Scripts d'édition (traçabilité) : `scratchpad/audit/ed_*.py`.

### disjoncteur — Le disjoncteur (et le fusible)

Fichiers : learn/fr/disjoncteur.html
Affirmations vérifiées : 34 (dont réglementaires : 12)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 69-79 | « Voltaplan utilise les correspondances prudentes suivantes » ; 6 mm² → 32 A, 10 mm² → 50 A | Obligation réglementaire | Le tableau était présenté comme un choix Voltaplan, et 6 mm²/10 mm² ne correspondaient pas au RGIE (40 A / 63 A pour un disjoncteur ; 32/50 A sont les valeurs fusible) | P1 | RGIE 4.4.1.4, tableau 4.11, p. 116-117 : « l'intensité maximale du disjoncteur qui protègent une canalisation […] est donnée au tableau 4.11 » | Tableau RGIE (colonnes disjoncteur et fusible) + paragraphe : ce sont des maxima ; In < Iz selon le mode de pose (4.4.3.2) ; circuit avec prises ≥ 2,5 mm², 1,5 mm² seulement sans prise (5.2.1.2) | Corrigé |
| 2 | 87 | « En monophasé, on utilise couramment des disjoncteurs 1P+N (une phase protégée, neutre coupé) ou bipolaires » | Obligation réglementaire | Le RGIE exige la détection de surintensité sur les deux conducteurs des circuits mono/biphasés domestiques, sauf disjoncteur différentiel coupant les deux | P1 | RGIE 4.4.4.2, p. 119 : « une détection de surintensité est réalisée sur les deux conducteurs actifs » | Paragraphe réécrit (bipolaire à deux pôles protégés ; exception du disjoncteur différentiel ; 1P+N seul ne répond pas) ; ajout pouvoir de coupure unipolaire sous la tension entre phases en IT (5.3.5.5 h, p. 172) | Corrigé (à valider par un spécialiste pour la pratique « 1P+N ») |
| 3 | 80 | « Ajoutez un radiateur […] vous dépassez 20 A : après un moment, le thermique déclenche » | Principe physique | À ~22 A sur 20 A (1,1 In), le disjoncteur peut ne pas déclencher avant plus d'une heure (courant conventionnel de non-déclenchement, temps ≥ 1 h) | P2 | RGIE 2.6.4, p. 34 : temps conventionnel « toujours au moins égal à 1 heure » | Exemple réécrit (dépassement faible = longtemps, voulu) | Corrigé |
| 4 | 64 | « quelques minutes pour un léger dépassement » | Principe physique | Même raison | P2 | RGIE 2.6.4, p. 34 | « de plusieurs minutes à plus d'une heure » | Corrigé |
| 5 | 83-84 | Pouvoir de coupure : « C'est à l'installateur de le vérifier » | Obligation réglementaire | Omission des exigences chiffrées du RGIE (3 000 A minimum, classe 3 en première ligne, Icc ≥ pouvoir de coupure) | P2 | RGIE 4.4.2.1, p. 117 ; 5.3.5.5 e, p. 170-171 : « pouvoir de coupure minimal de 3000 A (marquage 3000 entouré par un rectangle » | Ajout ; « Retenir » complété (≥ 3 kA) | Corrigé |
| 6 | 11 | « 16 A au plus pour du 1,5 mm², 20 A au plus pour du 2,5 mm² » | Obligation réglementaire | Exact, mais attribué implicitement à Voltaplan | P3 | RGIE 4.4.1.4, p. 117 | Ajout « le RGIE fixe… (RGIE, 4.4.1.4) » | Corrigé |
| 7 | 24 | Source « Voltaplan : correspondance section ↔ calibre (rgie.ts) » | Choix d'implémentation | Le code n'est pas une source réglementaire (et il diverge, voir anomalies) | P2 | Consigne | Remplacée par les références RGIE | Corrigé |
| 8 | 14 | « Le disjoncteur ne protège pas les personnes contre l'électrisation : c'est le rôle du différentiel » | Simplification pédagogique | Trop absolu | P3 | Principe | « par une fuite de courant : c'est le rôle du différentiel, associé à la terre » | Corrigé |
| 9 | 92 | Fusible remplacé par le même calibre | Obligation réglementaire | Compléter : ininterchangeabilité par construction (< 10 mm²) | P3 | RGIE 5.3.5.5 a, p. 170 | Ajout | Corrigé |

Affirmations vérifiées sans problème : rôle (protection des canalisations) → RGIE 4.4.1.1 ; thermique/magnétique → principe ; calibre In marqué « C16 » → fabricants ; fusible même rôle, ne jamais surcalibrer → 5.3.5.5 a ; pouvoir de coupure (définition) → 2.6.4 p. 34 ; valeur sur l'unifilaire → 3.1.2.2, p. 65 (« le pouvoir de coupure ») ; 3 × 230 V : deux phases à protéger → 4.4.4.2 ; fusibles du GRD avant le compteur (≥ 6 000 A) → 5.3.5.5 e ; contrôle après modification importante → définition p. 47 ; sécurité (coupure + VAT) → bonne pratique.
Incertitudes : pratique courante du « 1P+N » en Belgique face au texte de 4.4.4.2 (le moteur et les modèles Voltaplan utilisent 1P+N en monophasé) ; les valeurs 3/4,5/6/10 kA « courantes » relèvent des fabricants.

### courbes-disjoncteur — Les courbes B, C et D des disjoncteurs

Fichiers : learn/fr/courbes-disjoncteur.html
Affirmations vérifiées : 22 (dont réglementaires : 3)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 156-165 | Seuils B 3-5, C 5-10, D 10-20 In | Exigence normative | Valeurs exactes mais l'origine (norme produit, non RGIE) n'était pas dite ; le RGIE ne fixe aucune courbe | P3 | RGIE : aucune mention des courbes B/C/D (recherche « courbe ») ; norme produit non consultée | Ajout « fixées par la norme de fabrication, pas par le RGIE » | Corrigé |
| 2 | 112 | « la D est réservée aux appareils à fort courant de démarrage » | Bonne pratique | « réservée » sonne comme une règle | P3 | — | « s'emploie surtout » + « Le RGIE n'impose pas de courbe… » | Corrigé |
| 3 | 179 | Court-circuit en bout de ligne coupé tardivement par le thermique | Obligation réglementaire | Exigence RGIE non citée | P3 | RGIE 4.4.2.1, p. 117 ; 5.3.5.5 h, p. 171 (Icc min ≥ Ia) | Ajout de l'exigence | Corrigé |
| 4 | 189 | « une modification importante du tableau (remplacement non identique, circuit ajouté…) » | Obligation réglementaire | Le RGIE cite « remplacement non-identique d'un tableau » et « ajout d'un circuit » ; le changement d'un disjoncteur n'est pas classé | P2 | RGIE ch. 2 (définition), p. 47 | Reformulé avec les exemples exacts ; renvoi à l'installateur pour un changement de courbe | Corrigé |

Affirmations vérifiées sans problème : thermique identique pour B16/C16/D16 → principe/norme ; appel de courant (moteurs, transformateurs, drivers LED) → principe ; C la plus courante, défaut Voltaplan C → `src/model/templates.ts` l. 25 ; caractéristiques sur l'unifilaire → 3.1.2.2 p. 65 ; coupure + VAT avant intervention → bonne pratique.
Incertitudes : plages exactes des courbes (EN 60898-1 non consultée ; valeurs reprises de la documentation des fabricants) ; qualification « modification importante » d'un changement de courbe.

### surcharge-court-circuit — Surcharge et court-circuit

Fichiers : learn/fr/surcharge-court-circuit.html
Affirmations vérifiées : 26 (dont réglementaires : 4)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 32 | « dans l'exemple, il peut laisser passer plusieurs minutes avant de couper » | Principe physique | 23 A sur 20 A (1,15 In) : peut dépasser une heure | P2 | RGIE 2.6.4, p. 34 ; 4.4.3.2, p. 118 (If ≤ 1,45 Iz) | Réécrit avec la logique RGIE | Corrigé |
| 2 | 16 | « à terme, chaque gros appareil devrait avoir son propre circuit » | Obligation réglementaire | Présenté comme conseil : four et lave-vaisselle ont un circuit dédié obligatoire | P1 | RGIE 5.2.1.2, p. 128-129 : « Le lave-linge, le lave-vaisselle […] le four électrique sont aussi alimentés séparément par un circuit dédié » | FAQ réécrite | Corrigé |
| 3 | 102 | « un circuit dédié pour chaque gros appareil (four, lave-linge, lave-vaisselle, cuisinière), […] (8 points au plus en Belgique) » | Obligation réglementaire | Obligation présentée comme « bonne conception » ; liste incomplète (sèche-linge, taque, ≥ 2 600 W) ; « points » imprécis (8 socles simples ou multiples) | P2 | RGIE 5.2.1.2, p. 129 ; 5.3.5.2 b, p. 167 : « limité à huit par circuit terminal » | Réécrit | Corrigé |

Affirmations vérifiées sans problème : définitions surcharge/court-circuit → principe ; 5 200 W ≈ 23 A → calcul ; magnétique en ms, pouvoir de coupure → 4.4.2.1 ; défaut à la terre détecté par le différentiel → principe ; diagnostic (immédiat = court-circuit, appeler un électricien) → bonne pratique ; multiprise → recommandation fabricant ; SVG cohérent (20 A, 23 A, thermique/magnétique).
Incertitudes : aucune réglementaire.

### differentiel — Le différentiel (30 mA, 300 mA)

Fichiers : learn/fr/differentiel.html
Affirmations vérifiées : 38 (dont réglementaires : 20)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 116, 199 | « Voltaplan recommande le type A pour le lave-linge… » | Obligation réglementaire | Le type A minimum est une OBLIGATION pour tous les différentiels domestiques (général compris) ; présenté comme recommandation limitée | P1 | RGIE 5.3.5.3 a, p. 168 : « placés dans les installations domestiques sont au moins du type A » | « Retenir » et section Types réécrits ; fuites continues : précautions obligatoires (5.3.5.3 f, p. 168-169), type B ou détection selon fabricant | Corrigé |
| 2 | 169, 112 | « le 30 mA coupe avant » ; « protège les personnes » | Sécurité pédagogique | Présenté comme garantie : ne voit pas un contact phase-neutre, courant pendant la coupure | P0 | Principe physique ; consigne | Paragraphe « Ce n'est pas une garantie absolue » + « Retenir » nuancé | Corrigé |
| 3 | 169 | « 30 mA : une sensibilité élevée » | Obligation réglementaire | Définitions RGIE absentes : haute (> 10 et ≤ 30 mA) / très haute (≤ 10 mA) ; 300 mA = sensibilité moyenne | P2 | RGIE 2.6.4, p. 34 | Paragraphe ajouté ; « 30 mA au plus » | Corrigé |
| 4 | 115, 180 | « Au plus 8 circuits » | Obligation réglementaire | RGIE : « 8 circuits terminaux » ; « Retenir » sans la date d'application | P2 | RGIE 4.2.4.3 b, p. 100 ; 6.5.8.1 point 1, p. 207 | « terminaux » + date + dérogations pour installations antérieures (6.5.8.1, 8.2.1 point 16, 8.2.2) | Corrigé |
| 5 | 178 | Chauffage noyé « alimenté au-delà de la très basse tension » | Obligation réglementaire | Le seuil RGIE est 25 V alternatif (36 V continu non lisse, 60 V lisse), pas la TBT | P3 | RGIE 4.2.4.3 b, p. 100 | « sous plus de 25 V en alternatif » | Corrigé |
| 6 | 168 | Différentiel général : calibre | Obligation réglementaire | Omission : intensité nominale ≥ 40 A | P3 | RGIE 5.3.5.3 a, p. 168 | Ajout | Corrigé |
| 7 | 177 | 30 mA de salle de bain | Obligation réglementaire | Omis : placé immédiatement en aval du général et hors du local | P3 | RGIE 4.2.4.3 b ; 7.1.4.3, p. 231 | Ajout | Corrigé |
| 8 | 202, 121 | « l'organisme agréé mesure le temps de déclenchement au courant nominal […] 300 ms (500 ms S) » | Exigence normative / Choix Voltaplan | Le RGIE ne fixe pas ces temps ; en visite, il décrit l'essai par bouton de test et courant de défaut de 2,5 à 2,75 IΔn | P2 | RGIE 6.5.7.2 d) e), p. 206 | Reformulé ; 300/500 ms attribués aux normes produits | Corrigé |

Affirmations vérifiées sans problème : principe du tore → physique ; obligation d'un différentiel ≤ 300 mA à l'origine → 4.2.4.3 b p. 100 ; circuits sous 30 mA (prises non destinées à un appareil fixe, éclairage, baignoire/douche, lave-linge, sèche-linge, lave-vaisselle) → 4.2.4.3 b 5e al. ; exceptions exactes (appareils fixes, transfo de séparation individuel, autres circuits, sur différentiels supplémentaires à l'origine) → 8e al. p. 100 ; 100 mA chauffage noyé → 9e al. ; > 30 Ω renvoyé à mise-a-la-terre → 10e al. p. 100 ; date 1/6/2023 → 6.5.8.1 p. 207 ; sélectivité non garantie, type S temporisé → principe/fabricants ; bouton T, essai périodique selon fabricant → 5.3.5.3 k p. 169 ; interrupteur vs disjoncteur différentiel → fabricants.
Incertitudes : un différentiel de type AC existant peut-il rester en service dans une installation existante ? Aucune dérogation explicite en partie 8 ni 6.5.8 ; 8.2.1 point 1 n'admet le matériel ancien que si ses caractéristiques répondent au Livre : à faire trancher par un spécialiste (l'article renvoie à l'organisme agréé). Valeurs 300/500 ms (EN 61008/61009 non consultées).

### mise-a-la-terre — La mise à la terre

Fichiers : learn/fr/mise-a-la-terre.html
Affirmations vérifiées : 32 (dont réglementaires : 14)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 79, 12 | Boucle de terre « c'est la solution couramment réalisée » | Obligation réglementaire | Obligation affaiblie : boucle obligatoire pour tout nouveau bâtiment dont la fouille atteint 60 cm ; détails (35 mm², verticale des murs extérieurs, sans contact avec le béton, extrémités visitables) | P1 | RGIE 5.4.2.1 b.1, p. 174 : « la prise de terre comporte au moins une boucle disposée à fond de fouille » | Réécrit ; « Retenir » ; SVG (aria-label) et légende « à fond de fouille » | Corrigé |
| 2 | 19 | FAQ : « le conducteur de protection est toujours vert-jaune » | Sécurité pédagogique | Couleur présentée comme preuve ; exceptions RGIE (câbles souples méplats, préassemblés) et installations anciennes (8.2.1 point 10) | P1 | RGIE 5.4.3.3, p. 180 ; 8.2.1 point 10, p. 275 | Réponse réécrite : la couleur ne prouve jamais la fonction | Corrigé |
| 3 | 14, 87-95 | « Repères utilisés par Voltaplan : au-delà de 30 Ω… au-delà de 100 Ω » ; tableau « Ce que signale Voltaplan » ; « Plus de 100 Ω » | Obligation réglementaire | Exigences RGIE présentées comme repères Voltaplan ; seuil : RGIE exige < 100 Ω, donc 100 Ω exactement non conforme | P2 | RGIE 4.2.3.2, p. 84 : « sa résistance de dispersion est inférieure à 100 » ; 4.2.4.3 b 10e al., p. 100 | « Retenir », en-tête et lignes du tableau corrigés ; « aussi faible que possible » ; comportement Voltaplan dit à part | Corrigé |
| 4 | 92 | Ligne > 30 Ω : deux 30 mA, 16 socles, appareil fixe = socle, 100 mA par circuit ou groupe | Obligation réglementaire | Vérifié mot à mot : exact | — | RGIE 4.2.4.3 b, p. 100 | — | Sans objet |
| 5 | 80 | Piquet « surtout dans les bâtiments existants » | Obligation réglementaire | Statut RGIE de « prise de terre complémentaire » et longueur ≥ 1,50 m non dits | P3 | RGIE 5.4.2.1 b.2, b.4, p. 174-175 | Complété | Corrigé |
| 6 | 102 | « Oublier la terre sur un point lumineux » (argument de prudence) | Obligation réglementaire | C'est une obligation : toutes les canalisations domestiques ont un PE sauf vers interrupteurs, TBTS, amont du différentiel général | P2 | RGIE 5.4.3.6, p. 180-181 | Réécrit | Corrigé |
| 7 | 101, 103 | Terre reliée au neutre ; PE interrompu | Interdiction réglementaire | Interdictions non sourcées | P3 | RGIE 5.3.5.3 g, p. 169 ; 5.4.3.5, p. 180 | Sources + exception du sectionneur | Corrigé |
| 8 | 84 | Sectionneur « Il doit rester accessible » | Bonne pratique | Accessibilité explicitement imposée par le RGIE seulement pour la prise de terre commune (5.4.2.1 c.2 4°) ; ouverture à l'outil = obligation | P3 | RGIE 5.4.3.5, p. 180 | « Il faut qu'il reste accessible » + ouverture à l'outil sourcée | Corrigé |

Affirmations vérifiées sans problème : principe terre + différentiel → 4.2.3.4 / physique ; éléments (prise, conducteur de terre, borne principale/barrette, PE) → définitions p. 31 ; sectionneur fait partie du conducteur de terre → déf. p. 31 ; conduite d'eau non admise comme prise de terre → 5.4.2.1 a (prises admises limitativement) et 5.2.1.2 ; sol humide meilleur → physique ; FAQ maison sans terre (30 mA ne remplace pas la terre) → principe, 8.2.1 points 6 et 12 ; travaux hors tension → bonne pratique.
Incertitudes : aucune réglementaire majeure.

### liaisons-equipotentielles — Les liaisons équipotentielles

Fichiers : learn/fr/liaisons-equipotentielles.html
Affirmations vérifiées : 30 (dont réglementaires : 15)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 187 | « une section minimale fixée par le RGIE, différente […]. L'installateur la détermine » | Obligation réglementaire | Valeurs omises | P2 | RGIE 5.4.4.1 a et 5.4.4.2 a, p. 181 : « minimum de 6 mm² en cuivre » ; « 2,5 mm² lorsque les conducteurs sont protégés mécaniquement ; 4 mm² » | Liste des sections ajoutée ; « Retenir » complété | Corrigé |
| 2 | 116, 163-169 | Liste de la liaison principale (eau, gaz, chauffage, structure) | Obligation réglementaire | Caractère obligatoire non dit ; manquaient climatisation, « autres canalisations », gaz en bouteille, modalités (conducteur unique ou un par élément) | P2 | RGIE 4.2.3.4 a.4, p. 89 : « une liaison équipotentielle principale est obligatoire » ; 4.2.3.2, p. 84 | Liste et texte alignés | Corrigé |
| 3 | 173-181 | Liaison supplémentaire de la salle de bain | Obligation réglementaire | Non présentée comme obligation ; exclusions RGIE omises ; masses du matériel électrique omises | P2 | RGIE 7.1.4.4, p. 231-232 | Réécrit (obligation, masses, exclusions, huisseries) | Corrigé |
| 4 | 123 | Gaz : « en aval du compteur » | Bonne pratique | Le RGIE dit seulement « canalisations principales métalliques […] de gaz au bâtiment » ; « en aval du compteur » relève des règles du gestionnaire | P3 | RGIE 4.2.3.2, p. 84 | Reformulé (pratique, gestionnaire) | Corrigé |
| 5 | 135 | « Aucun courant ne cherche alors à passer par le corps » | Simplification pédagogique | Trop absolu | P3 | Physique | « La tension reste trop faible pour un courant dangereux » | Corrigé |
| 6 | 196 | Contrôle | Dérogation réglementaire | Omis : dérogations des anciennes installations (principale absente admise ; supplémentaire absente si volume 2 porté à 1 m) | P3 | RGIE 8.2.1 points 13 et 15.2, p. 275 | Paragraphe ajouté | Corrigé |

Affirmations vérifiées sans problème : principe équipotentiel → 4.2.3.2 ; vert-jaune → 5.4.4.1 b / 5.4.4.2 b ; continuité vérifiée en visite → 6.5.7.2 f) p. 206 ; baignoire acrylique, PER/multicouche non reliés → 7.1.4.4 exclusions ; exemple du chauffe-eau → physique ; 30 mA en salle de bain → 7.1.4.3 ; ne jamais déconnecter une liaison → bonne pratique.
Incertitudes : le texte de 8.2.1 point 13 renvoie au « point a.5 » de 4.2.3.4 alors que l'obligation figure au point a.4 (incohérence de numérotation du RGIE, sans effet sur le fond).

### parafoudre — Le parafoudre

Fichiers : learn/fr/parafoudre.html
Affirmations vérifiées : 28 (dont réglementaires : 3)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 217, 290 | Pas de cas obligatoire, « d'après les règles de l'art » | Obligation réglementaire | Exact (aucun cas obligatoire dans le Livre 1, ni « foudre » ni « parafoudre » dans le texte), mais omission de 4.5.3 (limiteur de surtension en schéma IT « si nécessaire ») et de l'exigence de sécurité du dispositif | P3 | RGIE 4.5.1, p. 120 ; 4.5.3, p. 121 : « un dispositif limiteur de surtension est, si nécessaire, connecté à l'origine » | Ajout dans la FAQ et la section « Quand » | Corrigé (lien IT ↔ 3 × 230 V à valider) |
| 2 | 211, 268 | « un parafoudre sans bonne terre ne sert à rien » | Simplification pédagogique | Excessif (le mode phase-neutre reste actif) | P3 | Physique / fabricants | « perd l'essentiel de son efficacité » | Corrigé |
| 3 | 271 | Types 1, 2, 3 | Exigence normative | Origine (norme produit, pas RGIE) non dite | P3 | Norme non consultée | Précisé | Corrigé |

Affirmations vérifiées sans problème : origine des surtensions → 4.5.1 (phénomènes atmosphériques, manœuvres) ; trop bref pour disjoncteur/différentiel → physique ; protection amont, conducteurs courts, témoin de fin de vie → fabricants ; ne protège ni contre surcharges, ni personnes, ni impact direct, ni surtension durable (neutre coupé) → physique ; ajout = modification à faire évaluer → définition p. 47.
Incertitudes : partie 7 (photovoltaïque, bornes) : aucune obligation de parafoudre trouvée dans le Livre 1 (recherche « surtension », « foudre », « parafoudre ») ; les prescriptions Synergrid/fabricants d'onduleurs n'ont pas été consultées. Classement des réseaux 3 × 230 V en schéma IT à confirmer pour l'installation intérieure.

### Anomalies du moteur de Voltaplan

1. `src/rules/be/rgie.ts` l. 336 (R-RCD-TYPE-A) : ne signale un type AC que sur un 30 mA protégeant lave-linge/sèche-linge/lave-vaisselle. RGIE 5.3.5.3 a (p. 168) impose le type A au moins pour TOUS les différentiels domestiques (300 mA compris). Correction : signaler tout `rcdType === 'AC'` en installation domestique (partie neuve) ; en partie existante, « à vérifier ». Test : général 300 mA type AC sans appareil de lavage → R-RCD-TYPE-A. (Déjà noté par le coordinateur.)
2. RGIE 5.3.5.3 a : différentiel en tête ≥ 40 A : pas de règle trouvée dans rgie.ts (à vérifier). Test : général 25 A en neuf → constat ; existant d'avant 16/9/1991 → dérogation 8.2.2.
3. `rgie.ts` l. 192-197 (R-POLES-NO-NEUTRAL) et `src/model/templates.ts` l. 20 (`polesFor` → '1P+N' hors 3 × 230 V) : RGIE 4.4.4.2 (p. 119) exige la détection de surintensité sur les deux conducteurs des circuits monophasés domestiques aussi (sauf disjoncteur différentiel coupant les deux). Correction proposée (après validation d'un spécialiste) : modèles en 2P ; constat sur '1P'/'1P+N' (disjoncteur seul) aussi en 230 V mono. Test : circuit 230 V mono protégé par MCB 1P+N → constat.
4. `rgie.ts` l. 167 (R-EARTH-VALUE `re > 100`) : RGIE 4.2.3.2 exige « inférieure à 100 Ω », donc 100 Ω exactement est non conforme. Correction : `re >= 100`. Test : 100 Ω → R-EARTH-VALUE.
5. `maxProtectionFor` (rgie.ts) : 6 → 32, 10 → 50, 16 → 63 A au lieu de 40/63/80 A (tableau 4.11, p. 117) — déjà signalé par le coordinateur. L'article ne s'y aligne pas.
6. R-RCD-TRIP (l. 179-182) : 300/500 ms ne viennent pas du RGIE (normes produits) ; le libellé `rule.R-RCD-TRIP` ne doit pas les présenter comme une exigence RGIE (non vérifié dans fr.ts).

### Références à ajouter à rgieRefs

- 2.6.4 — p. 34 — « les dispositifs à haute sensibilité pour lesquels le courant différentiel de fonctionnement est supérieur à 10 mA »
- 4.2.3.2 — p. 84 — « sa résistance de dispersion est inférieure à 100 » (Ω)
- 4.2.3.4 a (point a.4) — p. 89 — « une liaison équipotentielle principale est obligatoire »
- 4.4.2.1 — p. 117 — « leur pouvoir de coupure est au moins égal au courant de court-circuit présumé »
- 4.4.3.2 — p. 118 — « inférieur au courant admissible IZ dans la canalisation électrique qu'ils protègent »
- 4.4.4.2 — p. 119 — « une détection de surintensité est réalisée sur les deux conducteurs actifs »
- 4.5.1 — p. 120 — « protégés d'après les règles de l'art en la matière contre les conséquences nuisibles »
- 4.5.3 — p. 121 — « un dispositif limiteur de surtension est, si nécessaire, connecté à l'origine »
- 5.3.5.3 a — p. 168 — « placés dans les installations domestiques sont au moins du type A »
- 5.3.5.3 f — p. 168-169 — « des précautions sont prises pour qu'en cas de défaut à la terre, les composantes continues »
- 5.3.5.3 g — p. 169 — « Le conducteur N n'est pas relié à la terre en aval du dispositif »
- 5.3.5.5 a — p. 170 — « le remplacement d'un élément ne puisse pas se faire au moyen d'un élément dont le courant nominal est plus élevé »
- 5.3.5.5 e — p. 170-171 — « pouvoir de coupure minimal de 3000 A (marquage 3000 entouré par un rectangle »
- 5.3.5.5 h — p. 172 — « posséder le pouvoir de coupure unipolaire approprié pour la tension entre conducteurs de ligne »
- 5.4.2.1 b — p. 174 — « la prise de terre comporte au moins une boucle disposée à fond de fouille »
- 5.4.3.5 — p. 180 — « un dispositif de coupure (sectionneur de terre) qui est démontable seulement à l'aide d'un outil »
- 5.4.3.6 — p. 180-181 — « les canalisations électriques comportent un conducteur de protection, à l'exception »
- 5.4.4.1 (et 5.4.4.1 b) — p. 181 — « avec un minimum de 6 mm² en cuivre » ; « possède une isolation de couleur vert-jaune »
- 6.5.8.1 — p. 207 — « dont l'exécution sur place a été entamée avant le 01/06/2023 »
- 7.1.4.3 — p. 231 — « Ces dispositifs sont installés en dehors du lieu contenant une baignoire »
- 7.1.4.4 — p. 231 — « relie localement toutes les masses du matériel électrique et tous les éléments conducteurs étrangers »
(Cités aussi dans le texte sans préfixe validé : 8.2.2 p. 276-278 ; 5.4.4.2 p. 181.)

### Couverture

disjoncteur | 34 | 0/2/4/3 | Validé avec réserves
courbes-disjoncteur | 22 | 0/0/1/3 | Validé avec réserves
surcharge-court-circuit | 26 | 0/1/2/0 | Validé avec réserves
differentiel | 38 | 1/1/3/3 | Validé avec réserves
mise-a-la-terre | 32 | 0/2/2/3 | Validé avec réserves
liaisons-equipotentielles | 30 | 0/0/3/3 | Validé avec réserves
parafoudre | 28 | 0/0/0/3 | Validé avec réserves

## Rubrique : Contrôles et dépannage

### controle-organisme-agree — Le contrôle par un organisme agréé

Fichiers : learn/fr/controle-organisme-agree.html
Affirmations vérifiées : 46 (dont réglementaires : 31)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 32-37 | « Quatre situations concernent un particulier » | Obligation réglementaire | Situation omise : la visite d'une ancienne installation (avant 1981) jamais examinée, avant toute demande de renforcement de la puissance de raccordement | P1 | RGIE 8.4.1, p. 281 : « fait l'objet d'une visite de contrôle réalisée par un organisme agréé » | « Cinq situations » ; puce ajoutée (rapport joint à la demande) | Corrigé |
| 2 | 34 | « le gestionnaire de réseau demande ce rapport avant de raccorder ou d'ouvrir le compteur » | Obligation réglementaire | Exact sur le fond, sans source ; le RGIE vise « la personne qui met à disposition l'alimentation » | P3 | RGIE 6.4.1, p. 200 ; 6.4.6.2, p. 202 : « s'assure de la présence du rapport » | Reformulé et sourcé (6.4.1, 6.4.6.2) | Corrigé |
| 3 | 19 (FAQ) / 14 (À retenir) | « Il faut les faire corriger, puis faire revenir un organisme agréé » | Obligation réglementaire | Incomplet : pas de mise en usage tant que subsistent les infractions (contrôle de conformité) ; après une visite périodique domestique, c'est l'organisme qui a fait la visite qui constate la remise en ordre (pas « un » organisme quelconque) | P2 | RGIE 9.1.3.1 et 9.1.3.2, p. 289 : « constatée par l'organisme agréé qui a réalisé la visite de contrôle » | FAQ et À retenir réécrits (neuf / périodique / vente) | Corrigé |
| 4 | 11 | « revue tous les 25 ans » | Obligation réglementaire | Le RGIE dit « au moins » | P3 | RGIE 6.5.2, p. 204-205 | « au moins tous les 25 ans » | Corrigé |
| 5 | 37 | Vente : omission d'un commun accord | Dérogation réglementaire | Omis : l'acheteur doit informer la DG Énergie, et la nouvelle installation passe le chapitre 6.4 | P3 | RGIE 8.4.2.2 a et b, p. 282 | Phrase ajoutée | Corrigé |
| 6 | 44 | « réalisé par un organisme agréé » | Obligation réglementaire | Ajout de « sur place » et de l'autorité habilitée, avec la source | P3 | RGIE 6.4.1, p. 200 | Sourcé | Corrigé |
| 7 | 87 | « Le RGIE (3.1.2) exige... adresse... identité du responsable » | Obligation réglementaire | Adresse et identité figurent au 3.1.2.1 a, pas au 3.1.2 | P3 | RGIE 3.1.2 et 3.1.2.1 a, p. 61 | Double référence | Corrigé |
| 8 | 101 | « dans Voltaplan : 1,5 mm² → 16 A, 2,5 mm² → 20 A » | Obligation réglementaire | Obligation présentée comme un choix de Voltaplan | P2 | RGIE 4.4.1.4, tableau 4.11, p. 117 | Attribué au RGIE (tableau 4.11) | Corrigé |
| 9 | 107-109 | « Les mesures. Avec des appareils dédiés... » | Obligation réglementaire | Contrôle « réalisé hors tension » non mentionné ; mesures sans source | P3 | RGIE 6.4.1 (p. 200), 6.4.5.1 (p. 201), 6.4.5.2 (p. 202) | Phrase hors tension + références | Corrigé |
| 10 | 116 | « les figures du RGIE prévoient une place pour la signature » | Obligation réglementaire | Déduction à partir des figures ; la signature et la date sont une obligation explicite. Contenu réglementaire du rapport absent | P2 | RGIE 3.1.2.1 a, p. 61 : « signent et datent les schémas unifilaires et les plans de position » ; 6.4.6.4 b.4 à b.6, p. 203 | Paragraphe réécrit (terre, isolement, adéquation différentiels/terre et protections/sections, infractions, date de la prochaine visite, signatures) | Corrigé |
| 11 | 117 | « Gardez ce rapport » | Obligation réglementaire | Une obligation présentée comme un conseil | P2 | RGIE 6.4.6.1 (p. 202) ; 6.4.6.4 b.7, p. 203 | « doit être conservé... toute modification doit y être renseignée » | Corrigé |
| 12 | 124 | Liste « Bien préparer la visite » | Obligation réglementaire | Omis : l'installation doit pouvoir être mise hors tension pendant la visite | P3 | RGIE 6.5.1, p. 204 | Puce ajoutée | Corrigé |
| 13 | 13 / 112 | « essai des différentiels » | Simplification pédagogique | Le RGIE prévoit des « contrôles par essais » sans en fixer le détail (modalités à fixer par arrêté) | P3 | RGIE 6.4.4, p. 200 | Laissé tel quel (c'est l'usage) | À valider par un spécialiste |

Affirmations vérifiées sans problème : modification importante = impact supplémentaire, exemples (ajout de circuit, tableau non identique, schéma de terre) → définitions p. 47 ; contrôle limité à la partie ajoutée → 6.4.7.3, p. 204 ; 25 ans → 6.5.2 ; vente : installation d'avant le 01/10/1981 ou partie d'avant 1981 jamais visitée, date du rapport dans l'acte, remise à l'acheteur, 18 mois à partir de l'acte → 8.4.2.1 et 8.4.2.2, p. 281-282 ; dérogations des anciennes installations → 8.2.1, p. 272 ; différentiel général 300 mA, 30 mA → 4.2.4.3 b, p. 100 ; numéro, version, date → 3.1.2 ; continuité des liaisons et des conducteurs de protection → 6.4.6.4 b.4 ; le contrôleur ne répare rien (seule la constatation relève de l'organisme) → 6.3 ; remplacement à l'identique sans nouveau contrôle (pas d'impact supplémentaire) → définition p. 47 ; Voltaplan ne remplace pas le contrôle (FAQ) → correct.
Incertitudes : la FAQ « on peut faire contrôler une installation réalisée soi-même » est cohérente avec le RGIE (« numéro de T.V.A. si d'application » du responsable des travaux, 3.1.2.1 a), mais ne figure pas en toutes lettres : à confirmer. Le détail des contrôles par essais (6.4.4) dépend d'arrêtés ministériels non consultés.

### continuite — La mesure de continuité

Fichiers : learn/fr/continuite.html
Affirmations vérifiées : 24 (dont réglementaires : 5)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 86 | « après avoir coupé le courant et vérifié l'absence de tension » | Bonne pratique professionnelle / Obligation (travaux) | Il manque l'étape « empêcher la remise sous tension » (consignation) ; ne dit pas qu'il s'agit d'un travail d'électricien | P2 | RGIE 9.3.4.2 a, d et e, p. 294 : « s'assurer contre la réalimentation » | « C'est un travail d'électricien : couper, empêcher la remise en service, vérifier l'absence de tension avec un appareil adapté » | Corrigé |
| 2 | 90 | « L'organisme agréé mesure la continuité... » | Obligation réglementaire | Sans source ; le RGIE en précise le champ (liaisons principale et supplémentaires, conducteurs de protection des prises et des appareils fixes de classe I) | P3 | RGIE 6.4.6.4 b.4, p. 203 | Reformulé et sourcé | Corrigé |
| 3 | 39 | « Les liaisons locales » | Terminologie | Le RGIE parle de liaisons équipotentielles supplémentaires | P3 | RGIE 6.4.6.4 b.4 | Terme corrigé | Corrigé |

Affirmations vérifiées sans problème : la mesure se fait hors tension → 6.4.1 ; quelques fractions d'ohm (2,5 mm² sur 30 m ≈ 0,22 Ω, 1,5 mm² ≈ 0,36 Ω) → principe physique (ρ cuivre) ; un testeur de prise ne remplace pas la mesure (FAQ) → correct ; un multimètre en position « bip » ne donne qu'une indication grossière → principe physique ; le neutre n'est jamais utilisé comme terre → principe ; une canalisation remplacée par du synthétique rompt la liaison → principe ; une terre coupée reste invisible en usage normal → principe.
Incertitudes : le courant d'essai minimal de la mesure de continuité (200 mA selon la série IEC 61557 / HD 60364-6) n'a pas pu être vérifié dans une norme ; il n'est pas cité.

### resistance-isolement — La résistance d'isolement

Fichiers : learn/fr/resistance-isolement.html
Affirmations vérifiées : 27 (dont réglementaires : 7)
Statut : Validé

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 12, 5 | « Voltaplan considère comme insuffisante une valeur inférieure à 0,5 MΩ » | Obligation réglementaire | Exigence du RGIE présentée comme un choix de Voltaplan ; tension d'essai et conditions de mesure absentes | P2 | RGIE 6.4.5.1, tableau 6.1, p. 201 : « au moins égale à 1000 fois la valeur en V de la tension de test » | À retenir, description et nouvelle section avec le tableau 6.1 (250 V / 0,25 MΩ ; 500 V / 0,5 MΩ ; 1 000 V / 1 MΩ), par circuit, appareils déconnectés, courant continu | Corrigé |
| 2 | 99 | « par l'installateur ou l'organisme agréé » | Obligation réglementaire | Le RGIE confie la mesure du contrôle à l'organisme agréé ; appareil 1 à 5 mA | P3 | RGIE 6.4.5.1, p. 201 | Précisé et sourcé | Corrigé |
| 3 | 101 | « l'installation doit être coupée et l'absence de tension vérifiée » | Bonne pratique / Obligation (travaux) | Consignation manquante | P2 | RGIE 9.3.4.2 a, p. 294 | « coupée, protégée contre une remise sous tension, absence de tension vérifiée » | Corrigé |
| 4 | 103-104 | « certains éléments (parafoudre, appareils fixes) doivent être isolés » | Obligation réglementaire / Principe physique | Le RGIE impose de déconnecter les appareils d'utilisation ; danger résiduel de la charge capacitive après l'essai non mentionné | P3 | RGIE 6.4.5.1 ; principe physique (capacité des câbles) | Reformulé + puce sur la décharge | Corrigé |

Affirmations vérifiées sans problème : mesure entre conducteurs actifs et terre, et entre conducteurs actifs → 6.4.5.1 (« prises deux à deux ») ; en mégohms, 1 MΩ = 10⁶ Ω → physique ; un multimètre ne convient pas (FAQ) → principe ; débrancher les appareils (FAQ) → 6.4.5.1 ; causes (humidité, câble abîmé, isolant vieilli, résistance chauffante, brin qui dépasse) → principe/pratique ; un défaut d'isolement fait déclencher le différentiel → principe ; niveau d'isolement général dans le rapport → 6.4.6.4 b.4 ; Voltaplan : seuil < 0,5 MΩ (rgie.ts l. 171, `iso < 0.5`) cohérent avec « au moins égale ».
Incertitudes : aucune.

### resistance-de-terre — La résistance de dispersion de la terre

Fichiers : learn/fr/resistance-de-terre.html
Affirmations vérifiées : 30 (dont réglementaires : 12)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 12 | « Dans Voltaplan : jusqu'à 30 Ω, conforme... au-delà de 100 Ω » | Obligation réglementaire | Les deux seuils sont réglementaires, présentés comme des seuils de Voltaplan | P2 | RGIE 4.2.3.2, p. 84 : « sa résistance de dispersion est inférieure à 100 Ω » ; 4.2.4.3 b, p. 101 | À retenir réécrit et nouvelle introduction à la section des seuils | Corrigé |
| 2 | 17 (FAQ) | « entre 30 et 100 Ω n'est pas une non-conformité mais un avertissement » | Obligation réglementaire | Trompeur : sans les différentiels supplémentaires exigés, l'installation n'est pas conforme | P2 | RGIE 4.2.4.3 b, 8e et 9e alinéas, p. 101 | FAQ réécrite | Corrigé |
| 3 | 101 | Boucle de terre « solution habituelle en construction neuve » | Obligation réglementaire | C'est une obligation pour tout nouveau bâtiment dont les fondations descendent à 60 cm au moins | P2 | RGIE 5.4.2.1 b.1.1, p. 174 : « la prise de terre comporte au moins une boucle disposée à fond de fouille » | Corrigé (35 mm², verticale des murs extérieurs, piquets = prises de terre complémentaires, 1,50 m) | Corrigé |
| 4 | 65-66 | — | Obligation réglementaire | Omis : la prise de terre commune d'un immeuble à appartements (obligatoire depuis le 01/06/2020) doit être ≤ 30 Ω | P3 | RGIE 5.4.2.1 c.1 et c.2 1°, p. 176 | Phrase ajoutée | Corrigé |
| 5 | 19 (FAQ) | « une canalisation n'est pas une prise de terre » | Obligation réglementaire | Exact ; source ajoutée | P3 | RGIE 5.4.2.1 a et b, p. 174-175 | Sourcé | Corrigé |
| 6 | 96, 115 | « c'est l'organisme agréé qui tranche » ; « par l'installateur ou l'organisme agréé » | Obligation réglementaire | Fondement : le rapport certifie l'adéquation entre différentiels et terre ; mesure obligatoire à chaque contrôle | P3 | RGIE 6.4.6.4 b.4 (p. 203) ; 6.4.5.2 (p. 202) | Sourcé | Corrigé |
| 7 | 70-72 | Tableau Voltaplan : « Plus de 30 Ω, jusqu'à 100 Ω » / « Plus de 100 Ω » | Choix d'implémentation Voltaplan | Une valeur de 100,0 Ω exactement n'est pas conforme au RGIE (« inférieure à 100 »), alors que le moteur la classe en avertissement | P3 | RGIE 4.2.3.2, p. 84 | Article laissé décrivant le moteur ; anomalie signalée ci-dessous | Proposé (correction du moteur) |
| 8 | 71 | « exigence affichée : ≤ 30 Ω » | Choix d'implémentation Voltaplan | La page « Mesures et essais » affiche ≤ 30 Ω comme exigence, alors que l'exigence est < 100 Ω (30 Ω conditionne le nombre de différentiels) | P3 | RGIE 4.2.3.2 et 4.2.4.3 b | Non modifié (décrit l'application) ; signalé | Proposé |

Affirmations vérifiées sans problème : exemple 0,3 A × 30 Ω = 9 V, × 100 Ω = 30 V → loi d'Ohm ; tension de la carcasse ≈ R × I → simplification pédagogique correcte ; 2 différentiels HS au moins, 16 prises au plus chacun, appareil fixe ou groupe sous une même commande = une prise, 100 mA par circuit ou groupe pour les circuits en aval directe du général → 4.2.4.3 b, p. 101 ; sectionneur de terre faisant partie du conducteur de terre → définitions, partie 2 (p. 31 à 34) ; ouvrir le sectionneur prive l'installation de protection → principe ; variations saisonnières, nature du sol → physique ; liaisons équipotentielles ≠ prise de terre → 4.2.3.2.
Incertitudes : les méthodes de mesure (électrodes auxiliaires, pince) relèvent des normes de mesure (IEC 61557-5), non consultées ; formulation générale gardée.

### test-differentiel — Tester un différentiel

Fichiers : learn/fr/test-differentiel.html
Affirmations vérifiées : 28 (dont réglementaires : 5)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 29 | « la protection qui sauve des vies en cas de contact avec une pièce sous tension » | Simplification pédagogique | Présente le différentiel comme une garantie ; il ne réagit pas à un contact phase-neutre | P2 | Principe physique (mesure du courant différentiel) | Reformulé : réduit fortement le risque, sans garantie absolue | Corrigé |
| 2 | 14 | « L'organisme agréé teste chaque différentiel lors du contrôle » | Obligation réglementaire | Non vérifiable tel quel : le RGIE prévoit des contrôles par essais sans détail ; le rapport certifie l'adéquation différentiels / terre | P2 | RGIE 6.4.4, p. 200 ; 6.4.6.4 b.4 a, p. 203 | « vérifie les différentiels et leur adéquation avec la résistance de terre » | Corrigé |
| 3 | 96 | « Voltaplan vérifie... dans le temps prescrit » | Exigence normative | « Temps prescrit » laisse croire à une valeur du RGIE ; 300 / 500 ms viennent des normes de produit (non consultées) | P2 | RGIE tableau 2.4 (courbe de sécurité, p. 27) ; normes produit non lues | Phrase explicative ajoutée | Corrigé |
| 4 | 93 | « Cet essai se fait sous tension » | Sécurité pédagogique | Ne dit pas qu'un testeur de prise (même avec bouton « RCD ») ne remplace pas l'essai | P2 | Principe | Phrase ajoutée | Corrigé |
| 5 | 33 | « différentiels de 30 mA pour les circuits de prises, d'éclairage, de la salle de bain, du lave-linge… » | Obligation réglementaire | Liste incomplète (sèche-linge, lave-vaisselle) ; « haute sensibilité » | P3 | RGIE 4.2.4.3 b, p. 100 ; définitions, partie 2 (p. 31 à 34) | Liste complétée | Corrigé |
| 6 | 114 | « c'est l'organisme agréé qui fait l'essai officiel » | Obligation réglementaire | Même réserve que n° 2 | P3 | RGIE 6.4.6.4 | Reformulé et sourcé | Corrigé |

Affirmations vérifiées sans problème : principe phase / neutre → physique ; bouton test = fuite interne, mécanisme seulement, pas la sensibilité ni le temps → principe / fabricants ; fréquence selon la notice → recommandation du fabricant ; sélectif « S » retardé pour laisser couper les 30 mA en aval → principe de sélectivité ; remplacement par un appareil équivalent par un électricien, jamais de contournement → sécurité ; Voltaplan 300 ms / 500 ms → rgie.ts l. 175-182 cohérent avec l'article.
Incertitudes : les valeurs 300 ms (général) et 500 ms (sélectif) au courant nominal sont celles, connues, des normes EN 61008/61009, que je n'ai pas pu lire : à confirmer. Le RGIE impose un contrôle « hors tension » (6.4.1) alors que l'essai d'un différentiel exige la tension : interprétation (essais hors du champ « mesures » ?) à confirmer par un organisme agréé.

### differentiel-qui-saute — Le différentiel saute : que faire ?

Fichiers : learn/fr/differentiel-qui-saute.html
Affirmations vérifiées : 26 (dont réglementaires : 3)
Statut : Validé

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 119 | « après avoir coupé le courant et vérifié l'absence de tension » | Obligation (travaux) / Bonne pratique | Consignation manquante ; « sur tous les conducteurs actifs » | P2 | RGIE 9.3.4.2 a, d, e, p. 294 | Complété et sourcé | Corrigé |
| 2 | 96 | « le défaut est en amont ou dans le différentiel lui-même » | Principe physique | Incomplet : un défaut neutre-terre sur un circuit dont le disjoncteur ne coupe pas le neutre fait aussi refuser le réarmement | P3 | Principe physique | Complété (conclusion inchangée : électricien) | Corrigé |
| 3 | 122 | « au plus 8 circuits par différentiel » | Obligation réglementaire | Précision : circuits terminaux, par différentiel 30 mA | P3 | RGIE 4.2.4.3 b, p. 100 : « au maximum 8 circuits terminaux » | Reformulé | Corrigé |

Affirmations vérifiées sans problème : jamais contourner ni remplacer par un modèle moins sensible → sécurité ; démarche sans ouverture (appareils puis disjoncteurs, manœuvres d'appareillage destinées aux personnes BA1) → sûre pour un non-professionnel ; causes (humidité, résistances chauffantes, travaux, fuites électroniques cumulées, orage) → principe / pratique ; un 300 mA ne protège pas les personnes comme un 30 mA (FAQ) → 4.2.4.3 b ; pièces sous tension en amont du différentiel → physique ; renvoi vers la mesure d'isolement → 6.4.5.1.
Incertitudes : aucune.

### disjoncteur-qui-saute — Le disjoncteur saute : que faire ?

Fichiers : learn/fr/disjoncteur-qui-saute.html
Affirmations vérifiées : 30 (dont réglementaires : 7)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 111-122 | Tableau « Les valeurs utilisées par Voltaplan » : 6 mm² → 32 A, 10 mm² → 50 A | Obligation réglementaire | Pas le tableau du RGIE : pour les disjoncteurs, le RGIE autorise 40 A (6 mm²) et 63 A (10 mm²) ; les valeurs 32 / 50 A sont celles des fusibles. Les maxima des fusibles (1,5 mm² → 10 A !) sont absents, alors que les vieux tableaux en ont | P1 | RGIE 4.4.1.4, tableau 4.11, p. 117 | Tableau à trois colonnes (disjoncteur RGIE, fusible RGIE, Voltaplan) + rappel du courant admissible selon la pose + exemple du fusible de 16 A sur 1,5 mm² | Corrigé |
| 2 | 18 (FAQ) | « Dans Voltaplan, un câble de 1,5 mm² est protégé par 16 A au plus » | Obligation réglementaire | Obligation présentée comme un choix de Voltaplan ; ne dit pas que c'est une décision d'électricien | P2 | RGIE 4.4.1.4, tableau 4.11 | Attribué au RGIE ; « décision d'électricien » | Corrigé |
| 3 | 42-43 | « la phase touche directement le neutre (ou la terre) » ; surcharge « quelques instants, voire quelques minutes » | Principe physique | En TT (cas courant en Belgique), le défaut phase-terre est limité par la résistance de terre : c'est le différentiel qui réagit, pas le disjoncteur | P2 | Principe physique (230 V / 30 Ω ≈ 8 A) | Corrigé : « ou une autre phase » ; renvoi au différentiel ; surcharge : plus le dépassement est fort, plus la coupure est rapide | Corrigé |
| 4 | 93 | Exemple : 4 000 W, « plus de 17 A. Le disjoncteur finit par couper » | Principe physique / Exigence normative | 17,4 A ≈ 1,09 × 16 A : un disjoncteur peut ne pas couper avant longtemps, voire pas du tout (zone de non-déclenchement) | P2 | Caractéristique temps-courant des disjoncteurs (norme produit non consultée) | Exemple porté à 5 500 W ≈ 24 A (1,5 × In) + phrase sur le faible dépassement | Corrigé |
| 5 | 128 | « coupé le courant et vérifié l'absence de tension » | Obligation (travaux) / Bonne pratique | Consignation manquante | P2 | RGIE 9.3.4.2 a, p. 294 | Complété et sourcé | Corrigé |
| 6 | 132 | « si l'installation est modifiée (nouveau circuit, nouveau tableau), elle devra être contrôlée » | Obligation réglementaire | Précision : modification importante (tableau remplacé de façon non identique) ; contrôle limité à la partie modifiée, avant la mise en usage | P3 | RGIE 6.4.7.3, p. 204 ; définitions p. 47 | Reformulé | Corrigé |
| 7 | 23 (sources) | « calibre maximal des disjoncteurs » | Forme | Voltaplan ne distingue pas les fusibles | P3 | — | « des protections » | Corrigé |

Affirmations vérifiées sans problème : 230 × 16 = 3 680 W ; 5 500 / 230 ≈ 23,9 A → calcul ; ne jamais augmenter le calibre, bloquer ou shunter → sécurité ; ne pas relever à répétition après un court-circuit → bonne pratique ; courant de démarrage des moteurs → principe ; ampoule à filament qui claque → principe ; calibre choisi pour protéger le câble → 4.4.1.4 ; 1,5 → 16 A, 2,5 → 20 A, 4 → 25 A (disjoncteurs) → tableau 4.11.
Incertitudes : les seuils de déclenchement thermique (1,13 et 1,45 In) viennent de la norme EN 60898, non consultée ; l'article les décrit qualitativement sans les citer.

### Anomalies du moteur de Voltaplan

1. **Fusibles : maxima trop élevés (P1).** `src/rules/be/rgie.ts` l. 31-41 (`MAX_PROTECTION_BY_SECTION`) et l. 216-225 : `prot` peut être un fusible (`OVERCURRENT` contient `'fuse'`, l. 51), mais le même tableau (valeurs de disjoncteurs) lui est appliqué. Le RGIE (4.4.1.4, tableau 4.11, p. 117) fixe pour les fusibles : 1,5 mm² → 10 A, 2,5 → 16 A, 4 → 20 A, 6 → 32 A, 10 → 50 A, 16 → 63 A, 25 → 80 A, 35 → 100 A. Un câble de 1,5 mm² protégé par un fusible de 16 A n'est donc pas signalé. Correction : deux tableaux (disjoncteur / fusible) choisis selon `prot.props.device`. Test : 1,5 mm² + fusible 16 A → R-CABLE-PROT ; 1,5 mm² + fusible 10 A → rien ; 1,5 mm² + disjoncteur 16 A → rien.
2. **Disjoncteurs des grosses sections plus stricts que le RGIE (P2).** Même tableau : 6 mm² → 32 A, 10 → 50, 16 → 63, 25 → 80, 35 → 100, alors que le tableau 4.11 autorise pour les disjoncteurs 40, 63, 80, 100 et 125 A. R-CABLE-PROT est une `nonCompliance` (catalog.ts l. 98) dont le texte dit « maximum conseillé » (fr.ts l. 1255) : un 6 mm² sur 40 A est déclaré non conforme alors que le RGIE l'admet (sous réserve du courant admissible selon la pose, 4.4.1.4). Correction : appliquer le tableau 4.11 pour la non-conformité ; garder les valeurs prudentes, au besoin, comme avertissement « courant admissible à vérifier ». Test : 6 mm² + disjoncteur 40 A → pas de non-conformité ; 6 mm² + 50 A → non-conformité.
3. **Résistance de terre de 100 Ω exactement (P3).** `rgie.ts` l. 167 : `if (re > 100)` ; le RGIE exige « inférieure à 100 Ω » (4.2.3.2, p. 84). Correction : `re >= 100`. Test : 100 → R-EARTH-VALUE ; 99,9 → R-EARTH-30.
4. **Exigence affichée ≤ 30 Ω (P3).** La page « Mesures et essais » affiche « exigence : ≤ 30 Ω » pour la terre. L'exigence réglementaire est < 100 Ω ; 30 Ω est le seuil au-delà duquel des différentiels supplémentaires sont nécessaires (4.2.4.3 b). Proposition : afficher « < 100 Ω (≤ 30 Ω sans différentiels supplémentaires) ». Non vérifié dans le code de la page imprimée (fichier non localisé), seulement d'après l'article.
5. Pour information (pas une erreur) : `rgie.ts` l. 180, détection du sélectif par `rcdType.includes('S')` : fragile si un futur type contient la lettre S sans être sélectif.

### Références à ajouter à rgieRefs

- 4.2.3.2 — p. 84 — « sa résistance de dispersion est inférieure à 100 Ω » (installations domestiques).
- 4.4.1.4 — p. 116-117 — tableau 4.11 « Calibre du dispositif de protection en fonction de la section des conducteurs » (cité sous la forme « RGIE, 4.4.1.4, tableau 4.11 », peut-être non détecté par le validateur).
- 5.4.2.1 (et 5.4.2.1 b, 5.4.2.1 c) — p. 174-176 — « la prise de terre comporte au moins une boucle disposée à fond de fouille » ; c.2 1° : « inférieure ou égale à 30 Ohms ».
- 6.4.1 — p. 200 — « doit être réalisé hors tension » ; « sur place soit par un organisme agréé ».
- 6.4.5.1 — p. 201 — « au moins égale à 1000 fois la valeur en V de la tension de test ».
- 6.4.5.2 — p. 202 — « la résistance de dispersion des prises de terre... est mesurée ».
- 6.4.6.2 — p. 202 — « s'assure de la présence du rapport dans lequel la conformité... est confirmée ».
- 6.4.6.4 — p. 202-203 — « contient la valeur de la résistance de dispersion de la prise de terre ainsi que la valeur du niveau d'isolement général ».
- 6.5.1 — p. 204 — « L'installation électrique doit pouvoir être mise hors tension pendant la visite de contrôle. »
- 8.4.1 — p. 281 — visite « avant tout renforcement de la puissance de raccordement ».
- 9.1.3.1 — p. 289 — « ne peut être mise en usage ».
- 9.1.3.2 — p. 289 — « constatée par l'organisme agréé qui a réalisé la visite de contrôle ».
- 9.3.4.2 a — p. 294 — « s'assurer contre la réalimentation de l'installation électrique ; contrôler l'absence de tension ».

`npm run learn:check -- <les 7 slugs>` : seules erreurs restantes = ces références non encore dans rgieRefs.

### Couverture

controle-organisme-agree | 46 | 0/1/4/8 | Validé avec réserves
continuite | 24 | 0/0/1/2 | Validé avec réserves
resistance-isolement | 27 | 0/0/2/2 | Validé
resistance-de-terre | 30 | 0/0/3/5 | Validé avec réserves
test-differentiel | 28 | 0/0/4/2 | Validé avec réserves
differentiel-qui-saute | 26 | 0/0/1/2 | Validé
disjoncteur-qui-saute | 30 | 0/1/4/2 | Validé avec réserves

## Rubrique : Câblages (articles 1 à 7 : éclairage)

Source : RGIE Livre 1 v07 (15/09/2026), texte extrait `scratchpad/livre1.txt`. Pages = pages imprimées (le pied de page suit le texte de la page).
Simulateur testé en direct (copie de `site/apprendre/cablage-sim.js` exécutée sous Node avec des câblages fautifs construits à la main).

### simple-allumage — Le simple allumage

Fichiers : learn/fr/simple-allumage.html (+ tools/learn/exercices/simple-allumage.ts)
Affirmations vérifiées : 38 (dont réglementaires : 9)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 11 | « L’interrupteur coupe toujours la phase, jamais le neutre : la lampe éteinte n’est plus sous tension. » | Interdiction réglementaire | Fausse sécurité : sur un réseau 3 × 230 V (sans neutre), la lampe est entre deux phases et l’interrupteur unipolaire n’en coupe qu’une ; même en 230 V + N, voyants et couplages laissent la lampe reliée au réseau. Le RGIE dit seulement qu’un dispositif de commande unipolaire n’est pas placé sur le neutre. | P1 | RGIE 5.3.3.2 c, p. 159 : « un dispositif de commande unipolaire n’est pas placé sur le conducteur neutre » | Reformulé : « se place sur la phase, jamais sur le neutre (RGIE, 5.3.3.2 c). Il commande la lampe, mais ne remplace pas la coupure au tableau » | Corrigé |
| 2 | 31-32 | « On coupe la phase et non le neutre pour une raison de sécurité… » | Interdiction réglementaire + principe physique | Pas de référence ; cas 3 × 230 V absent | P1 | RGIE 5.3.3.2 c, p. 159 ; principe physique (réseau IT 3 × 230 V) | Ajout de la formulation RGIE et d’un paragraphe 3 × 230 V avec lien vers couleurs-des-fils.html#reseau-3x230 ; rappel que l’on coupe au tableau pour intervenir | Corrigé |
| 3 | 18 (FAQ) | « Si l’interrupteur coupe bien la phase, la lampe n’est pas dangereuse » | Simplification pédagogique | Rassurance excessive : la lueur prouve justement que la lampe reste reliée au réseau | P2 | Principe physique | « Ce n’est pas en soi le signe d’un défaut […] Mais cette lueur montre que la lampe reste reliée au réseau : avant de la toucher, coupez le circuit au tableau » | Corrigé |
| 4 | 66, 71 | « jamais bleu ni vert-jaune » ; « Le bleu est réservé au neutre » | Interdiction réglementaire | Le bleu n’est réservé au neutre que dans les circuits qui en comportent un (sinon le bleu d’un câble multipolaire peut servir à autre chose, sauf PE) ; pas de référence ; ne disait pas que la couleur ne prouve rien | P3 | RGIE 5.1.6.2, p. 128-129 | Précisé « dans un circuit qui a un neutre (RGIE, 5.1.6.2) » + « la couleur ne prouve jamais à elle seule le rôle d’un fil » | Corrigé |
| 5 | 77 | « 1,5 mm², protégé par un disjoncteur de 16 A au plus » | Obligation réglementaire | Juste mais non sourcé ; omettait le fusible (10 A) | P3 | RGIE 4.4.1.4, tableau 4.11, p. 117 (1,5 mm² : fusible 10 A, disjoncteur 16 A, installations domestiques) | Ajout de la référence et du calibre fusible | Corrigé |
| 6 | 83 | « Couper le circuit au tableau et vérifier l’absence de tension » | Bonne pratique professionnelle | Procédure incomplète : pas de prévention de la réalimentation (consignation) | P2 | Bonne pratique (consignation) | « empêcher qu’on le remette par erreur (étiquette, cadenas si le disjoncteur le permet) » | Corrigé |
| 7 | 87 | « Amener la terre… un futur luminaire métallique en aura besoin » | Obligation réglementaire | Obligation présentée comme une précaution | P2 | RGIE 5.4.3.6, p. 181 : canalisations domestiques avec conducteur de protection « à l’exception de celles aboutissant aux interrupteurs » ; RGIE 4.2.4.3 a, p. 100 (masses de classe I reliées au PE) | Reformulé en obligation avec les deux références | Corrigé |
| 8 | 92 | « En série… éclaireraient faiblement » | Principe physique | Beaucoup de LED ne s’allument pas du tout | P3 | Principe physique | « ou pas du tout pour beaucoup de lampes LED » | Corrigé |
| 9 | 96, 99 | Erreurs « interrupteur sur le neutre », « fil bleu comme retour » | Interdiction réglementaire | Présentées comme simples maladresses | P2 | RGIE 5.3.3.2 c, p. 159 ; 5.1.6.2, p. 128 | Ajout « interdite par le RGIE » avec références | Corrigé |
| 10 | 103 | « circuits d’éclairage placés derrière un différentiel de 30 mA depuis le 1er juin 2023 » | Obligation réglementaire | Imprécis : « haute sensibilité » = 30 mA au plus ; en aval du différentiel général ; 8 circuits max ; date = début d’exécution (disposition transitoire) | P3 | RGIE 4.2.4.3 b, p. 100-101 ; définition des sensibilités p. 33 | Reformulé avec ces précisions | Corrigé |
| 11 | 103 | (absent) Nombre de circuits d’éclairage, circuits mixtes | Obligation réglementaire | Omission utile au lecteur | P2 | RGIE 5.3.5.2 b, p. 167 (au moins deux circuits d’éclairage si > 2 locaux ; circuit mixte = règles des prises, ensemble commandé par un même appareil = une prise, 8 max) ; RGIE 8.2.1 point 14, p. 276 (un seul circuit toléré en installation ancienne) | Paragraphe ajouté | Corrigé |
| 12 | exercice | Solution, cas, unifilaire 16 A / 3G1,5, légende | Choix d’implémentation | Solution électriquement juste et sûre ; deux cas (off/on) suffisants ; unifilaire et légende cohérents avec le tableau 4.11 | — | Simulation exécutée | — | Validé |

Affirmations vérifiées sans problème : rôle phase/neutre (principe) ; retour lampe ; bornes L/1 (fabricants) ; lampes en parallèle à 230 V (principe) ; court-circuit si phase et neutre aux deux bornes (principe) ; terre oubliée sur luminaire métallique (4.2.4.3 a) ; vert-jaune réservé au PE (5.1.6.2, 5.4.3.3 p. 180) ; FAQ deux lampes ; FAQ couper avant de changer une ampoule ; SVG (phase seule dans l’interrupteur, N et PE directs) conforme.
Incertitudes : aucune bloquante.

### double-allumage — Le double allumage

Fichiers : learn/fr/double-allumage.html (+ tools/learn/exercices/double-allumage.ts)
Affirmations vérifiées : 34 (dont réglementaires : 4)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 126 | « Phase sur une borne de sortie : la touche correspondante n’a plus d’effet et l’autre lampe ne s’allume jamais. » | Principe physique | Faux : la lampe de cette sortie reste allumée en permanence, et l’autre s’allume quand les deux touches sont enfoncées (vérifié au simulateur : états 00/10/01 → lampe 1 seule, 11 → les deux) | P2 | Principe physique, simulation | Reformulé en conséquence | Corrigé |
| 2 | 125 | « Neutre passé par l’interrupteur… » | Interdiction réglementaire | Interdiction non signalée | P3 | RGIE 5.3.3.2 c, p. 159 | Ajout « Le RGIE l’interdit » | Corrigé |
| 3 | 97 | « Le bleu reste réservé au neutre et le vert-jaune à la terre » | Interdiction réglementaire | Non sourcé, condition « circuit avec neutre » absente | P3 | RGIE 5.1.6.2, p. 128 | Précisé et sourcé | Corrigé |
| 4 | 101 | Procédure de coupure | Bonne pratique | Pas de prévention de la réalimentation | P2 | Bonne pratique | Ajout | Corrigé |
| 5 | exercice | Solution, 4 cas, unifilaire | Choix d’implémentation | Juste et sûr ; les 4 combinaisons couvrent le montage ; neutre et terre en guirlande lampe 1 → lampe 2 acceptables | — | Simulation | — | Validé |

Affirmations vérifiées sans problème : interrupteur double = deux simples avec phase commune (RGIE 2.13 « commutateur unipolaire (double allumage) », p. 52) ; trois bornes L/1/2 (fabricants) ; trois conducteurs phase + 2 retours ; neutre direct ; un seul disjoncteur ; variantes (groupes en parallèle, extracteur avec phase permanente selon notice, double va-et-vient) ; contrôle par organisme agréé ; SVG conforme.
Incertitudes : aucune.

### va-et-vient — Le va-et-vient

Fichiers : learn/fr/va-et-vient.html (+ tools/learn/exercices/va-et-vient.ts)
Affirmations vérifiées : 36 (dont réglementaires : 4)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 135 | « Navettes en bleu : le montage fonctionne, mais ce fil sous tension passe pour un neutre. » | Interdiction réglementaire | Interdiction affaiblie en simple inconvénient | P2 | RGIE 5.1.6.2, p. 128 : bleu « réservé au conducteur neutre dans les circuits comportant un tel conducteur » | Ajout de l’interdiction sourcée | Corrigé |
| 2 | 133 | « Neutre envoyé dans les interrupteurs » | Interdiction réglementaire | Interdiction non signalée | P3 | RGIE 5.3.3.2 c, p. 159 | « C’est interdit (RGIE, 5.3.3.2 c) » | Corrigé |
| 3 | 108 | Couleurs des navettes « Noir et gris, par exemple » | Bonne pratique | Ne disait pas ce qui est imposé ou non | P3 | RGIE 5.1.6.2 | Phrase ajoutée : seules règles RGIE = pas de vert-jaune, pas de bleu si neutre | Corrigé |
| 4 | 112 | Procédure de coupure | Bonne pratique | Pas de prévention de la réalimentation ni de testeur adapté | P2 | Bonne pratique | Ajout | Corrigé |
| 5 | exercice | toggle s1/s2, solution, unifilaire | Choix d’implémentation | Juste et sûr ; le critère « chaque commande inverse la lampe » accepte navettes croisées (correct) | — | Simulation | — | Validé |

Affirmations vérifiées sans problème : commun + deux bornes ; table de vérité ; navettes croisées équivalentes ; va-et-vient utilisable en simple (commun + une borne) ; diagnostic commun mal repéré ; variantes de cheminement (3 conducteurs vers chaque interrupteur ; PE non requis vers un interrupteur, 5.4.3.6 p. 181) ; court-circuit phase/neutre ; inverseur au-delà de 2 points (RGIE 2.13 « commutateur intermédiaire », p. 52) ; SVG conforme.
Incertitudes : aucune.

### va-et-vient-trois-points — Commander depuis trois endroits ou plus (inverseur)

Fichiers : learn/fr/va-et-vient-trois-points.html (+ tools/learn/exercices/va-et-vient-trois-points.ts)
Affirmations vérifiées : 32 (dont réglementaires : 2)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 180 | « aucun interrupteur ne doit commuter le neutre » | Interdiction réglementaire | Non sourcé | P3 | RGIE 5.3.3.2 c, p. 159 | Référence ajoutée | Corrigé |
| 2 | 17 (FAQ) | inverseur / permutateur / croisement | Terminologie | Nom RGIE absent | P3 | RGIE 2.13, p. 52 : « Commutateur intermédiaire pour va-et-vient » | Ajouté | Corrigé |
| 3 | 150-151 | Navettes « Noir et gris » | Bonne pratique | Couleur présentée comme fixe | P3 | RGIE 5.1.6.2 | « par exemple ; jamais bleu ni vert-jaune » | Corrigé |
| 4 | 159 | Procédure de coupure | Bonne pratique | Pas de prévention de la réalimentation | P2 | Bonne pratique | Ajout | Corrigé |
| 5 | 173 | « Un bouton-poussoir coûte aussi en général moins cher qu’un inverseur » | Simplification | Affirmation commerciale non vérifiable, prudente (« en général ») | P3 | — | Laissé | Proposé (non corrigé : sans enjeu de sécurité) |
| 6 | exercice | toggle s1/inv/s2 (8 combinaisons), solution, unifilaire | Choix d’implémentation | Juste et sûr ; positions de l’inverseur (1-3/2-4, 1-4/2-3) conformes au SVG et au texte | — | Simulation | — | Validé |

Affirmations vérifiées sans problème : principe droite/croisée ; 4 bornes en paires ; inverseurs uniquement entre deux va-et-vient ; un inverseur par point supplémentaire ; erreurs « paires mal identifiées » et « inverseur en bout de chaîne » (vérifiées par raisonnement) ; télérupteur au-delà de 3 points (pratique) ; SVG conformes.
Incertitudes : aucune.

### telerupteur — Boutons-poussoirs et télérupteur

Fichiers : learn/fr/telerupteur.html (+ tools/learn/exercices/telerupteur.ts)
Affirmations vérifiées : 40 (dont réglementaires : 5)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 140 | « bobine basse tension, alimentée par un transformateur de sécurité (TBTS) : les boutons ne sont alors pas en 230 V » | Obligation réglementaire | Omission : séparation obligatoire entre circuit TBTS et 230 V (même boîte, même tube, même appareil) ; « basse tension » impropre (c’est de la très basse tension) | P2 | RGIE 4.2.5.3 b-c, p. 106 (10 mm, isolation supplémentaire, ou isolation pour la tension la plus élevée) ; 4.2.5.5 c, p. 107 (pas de liaison à la terre ni à d’autres circuits) | Paragraphe complété | Corrigé |
| 2 | 140 | « Le contact, lui, coupe toujours la phase de la lampe. » | Simplification | « toujours » faux en 3 × 230 V (une des deux phases) | P3 | Principe physique | « se place sur la phase de la lampe, comme un interrupteur » | Corrigé |
| 3 | 124 | Procédure de coupure | Bonne pratique | Pas de consignation ; la commande peut venir d’un autre circuit | P2 | Bonne pratique | Ajout (vérifier aussi les boutons) | Corrigé |
| 4 | 146 | (absent) boutons côté neutre | Interdiction réglementaire | Erreur fréquente non signalée ; le simulateur la refuse en citant le RGIE sans que l’article l’explique | P3 | RGIE 5.3.3.2 c, p. 159 | Puce ajoutée dans « Les erreurs fréquentes » | Corrigé |
| 5 | exercice l. 31 | `{ a: 'tl.A2', b: 'lamp.N' }` | Choix d’implémentation | Le neutre de la lampe repiqué sur la borne de bobine A2 : électriquement équivalent, mais mauvaise pratique (borne de bobine utilisée comme distribution du neutre de la charge) et incohérent avec le SVG (neutre depuis le tableau) | P3 | Bonne pratique | Remplacé par `{ a: 'src.N', b: 'lamp.N' }` ; test « la solution fonctionne » toujours vert | Corrigé |
| 6 | exercice | séquence p1/p2/p2/p1 | Choix d’implémentation | Couvre bien le basculement et rejette la lampe sur le circuit de commande | — | Simulation | — | Validé |
| 7 | exercice | unifilaire : poussoirs puis télérupteur puis lampe ; légende « le télérupteur (dans le tableau) » | Choix d’implémentation | La chaîne dessinée place le télérupteur après les poussoirs, ce qui peut suggérer qu’il est sur le terrain ; à vérifier sur le rendu | P3 | — | — | À valider par un spécialiste (rendu du générateur, que je ne modifie pas) |

Affirmations vérifiées sans problème : relais à mémoire ; bobine A1-A2, contact 1-2 (fabricants) ; poussoirs en parallèle, 2 conducteurs chacun ; commande/puissance ; poussoirs lumineux limités (notice) ; diagnostic « claque mais n’allume pas » ; impulsions parasites ; levier manuel ; symbole télérupteur au RGIE (2.13, p. 53) ; contrôle par organisme agréé ; SVG conforme (A2 au neutre, phase sur l’entrée du contact).
Incertitudes : aucune réglementaire.

### minuterie — La minuterie d’escalier

Fichiers : learn/fr/minuterie.html
Affirmations vérifiées : 26 (dont réglementaires : 2)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 91 | « Le RGIE prévoit un symbole propre pour la minuterie installée au tableau » | Obligation réglementaire (symbole) | Le RGIE prévoit un symbole « Minuterie », sans la mention « installée au tableau » | P3 | RGIE 2.13, tableau E, p. 53 | « Parmi ses symboles graphiques, le RGIE prévoit un symbole propre pour la minuterie, distinct de celui du télérupteur et du bouton-poussoir » | Corrigé |
| 2 | 77 | Procédure de coupure | Bonne pratique | Pas de consignation | P2 | Bonne pratique | Ajout | Corrigé |

Affirmations vérifiées sans problème : principe et frise ; redéclenchement ; neutralisation du bouton bloqué (fabricants, présenté avec réserve) ; comparaison télérupteur/minuterie ; alimentation L+N ; montages 3 et 4 fils (notice) ; boutons d’immeuble sur un autre circuit ; réglages ; LED et courant d’appel ; 10 × 6 W = 60 W.
Incertitudes : aucune.

### detecteur-de-mouvement — Le détecteur de mouvement

Fichiers : learn/fr/detecteur-de-mouvement.html (+ tools/learn/exercices/detecteur-de-mouvement.ts)
Affirmations vérifiées : 34 (dont réglementaires : 2)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 84-85 | Détecteur 2 fils : « petit courant permanent à travers la lampe, même éteinte » | Principe physique | Conséquence de sécurité non tirée : lampe éteinte reliée à la phase | P2 | Principe physique ; documentation fabricants | Paragraphe ajouté : couper au tableau avant de toucher la lampe | Corrigé |
| 2 | 79 | « (et la terre si son boîtier en demande une) » | Obligation réglementaire | RGIE 5.4.3.6 impose le PE dans les canalisations domestiques sauf celles aboutissant aux interrupteurs ; un détecteur est-il un « interrupteur » au sens de cette exception ? | P2 | RGIE 5.4.3.6, p. 181 | Reformulé : prévoir la terre dans le câble, indispensable en classe I | Corrigé (interprétation à valider) |
| 3 | 106 | Procédure de coupure | Bonne pratique | Pas de consignation | P2 | Bonne pratique | Ajout | Corrigé |
| 4 | exercice | Solution 3 fils, 2 cas, unifilaire « Éclairage extérieur » 16 A 3G1,5 | Choix d’implémentation | Juste et sûr ; le simulateur exige l’alimentation L-N du détecteur (bien) | — | Simulation | — | Validé |

Affirmations vérifiées sans problème : principe infrarouge passif et détection transversale ; bornes L, N, sortie ; neutre nécessaire en 3 fils ; charge minimale et module de compensation (fabricants) ; interrupteur en parallèle sur la sortie (notice) ; détecteur de présence plus sensible ; réglages ; IP en extérieur ; charge maximale LED ; symbole détecteur de mouvement au RGIE (2.13, p. 53) ; SVG conforme.
Incertitudes : le classement du détecteur dans l’exception « canalisations aboutissant aux interrupteurs » de 5.4.3.6 relève de l’interprétation (à faire confirmer par un organisme agréé).

### Anomalies du moteur de Voltaplan

1. **P1 — `site/apprendre/cablage-sim.js`, l. 44 (`SWITCHING`) et l. 200-206 : un contact de télérupteur (`relay`) ou un détecteur (`detector`) placé sur le neutre est accepté.** `relay` et `detector` ne figurent pas dans `SWITCHING`, donc la règle `switchOnNeutral` ne leur est pas appliquée. Vérifié : dans l’exercice télérupteur, `src.L → lamp.L`, `lamp.N → tl.1`, `tl.2 → N` donne `{ok:true}` (lampe éteinte en permanence sous tension) ; dans l’exercice détecteur, L et N du détecteur inversés (`src.N → det.L`, `src.L → det.N`, `det.N → lamp.N` en brun) donne `{ok:true}` (le détecteur commute le neutre). Source : RGIE 5.3.3.2 c, p. 159. Correction proposée : pour `relay`, vérifier que les bornes `1` et `2` ne sont jamais sur le réseau N ; pour `detector`, vérifier que `L` et `out` ne sont jamais sur N (la borne `N` y est légitimement). Ne pas ajouter `detector` tel quel à `SWITCHING` (sa borne N déclencherait l’erreur sur toute solution juste). Tests de non-régression : les deux câblages ci-dessus doivent donner `switchOnNeutral` ; les solutions des exercices `telerupteur` et `detecteur-de-mouvement` doivent rester `{ok:true}`.
2. **P2 — `cablage-sim.js`, l. 99-103 (`live`) : la polarité des bornes de la lampe n’est pas vérifiée.** `s1.1 → lamp.N`, `src.N → lamp.L` (interrupteur bien sur la phase, mais phase arrivant sur la borne N du luminaire) est accepté sans remarque. Le RGIE Livre 1 ne contient pas, à ma connaissance, de règle explicite de polarité des bornes de luminaire (je n’en ai pas trouvé ; les normes de douilles et de luminaires ne sont pas accessibles ici) : c’est une bonne pratique (culot à vis côté neutre). Correction proposée : un *avertissement* (pas une erreur) « borne L de la lampe sur le neutre », sans référence RGIE. Test : ce câblage → `ok:true` avec l’avertissement.
3. **P3 — `site/apprendre/cablage.js`, l. 30 (`peColor`) : « Le conducteur de terre est isolé en vert-jaune (RGIE 5.4.3.3) ».** La référence est juste (5.4.3.3, p. 180), mais le RGIE parle du *conducteur de protection* ; le « conducteur de terre » est celui qui va à la prise de terre. Correction : « Le conducteur de protection (la terre) est isolé en vert-jaune (RGIE 5.4.3.3). »
4. Vérifié sans anomalie : `switchOnNeutral` cite correctement 5.3.3.2 c (et s’applique à juste titre aux boutons-poussoirs côté neutre) ; `gyMisuse` et `blueMisuse` citent correctement 5.1.6.2 (« bleu réservé au neutre dans un circuit qui en comporte ») ; `neutralColor` est à juste titre un simple avertissement de bonne pratique (le RGIE réserve le bleu au neutre, il n’impose pas que le neutre soit bleu) ; aucune couleur n’est imposée à la phase (juste) ; le message de réussite précise que ce n’est pas un contrôle de conformité. Note : `cablage-sim.js`, `cablage.js` et `test/learn.test.ts` ont été modifiés par un autre intervenant pendant mon audit (`blueMisuse` passé d’avertissement à erreur) ; mes essais ont été refaits sur la dernière version.

### Références à ajouter à rgieRefs

| Numéro | Page | Citation |
|---|---|---|
| 5.3.3.2 c | 159 | « un dispositif de commande unipolaire n’est pas placé sur le conducteur neutre » |
| 5.1.6.2 | 128 | « Les matériaux d’isolation de couleur bleue sont réservés au conducteur neutre dans les circuits comportant un tel conducteur » |
| 4.4.1.4 | 116-117 | Tableau 4.11 : 1,5 mm² → fusible 10 A, disjoncteur 16 A (installations domestiques) |
| 5.4.3.6 | 181 | « les canalisations électriques comportent un conducteur de protection, à l’exception de celles aboutissant aux interrupteurs » |
| 4.2.4.3 a | 100 | « Les masses du matériel électrique à basse tension de la classe I sont reliées au conducteur de protection » |
| 4.2.5.3 c | 106 | « une séparation physique d’au moins 10 mm entre les conducteurs des circuits TBTS et TBTP et les conducteurs d’autres circuits » |
| 4.2.5.5 c | 107 | « Les parties actives du matériel électrique TBTS ne peuvent pas être reliées galvaniquement » (à la terre, à d’autres circuits) |

### Couverture

simple-allumage | 38 | 0/2/5/4 | Validé avec réserves
double-allumage | 34 | 0/0/2/2 | Validé avec réserves
va-et-vient | 36 | 0/0/2/2 | Validé avec réserves
va-et-vient-trois-points | 32 | 0/0/1/4 | Validé avec réserves
telerupteur | 40 | 0/0/2/4 | Validé avec réserves
minuterie | 26 | 0/0/1/1 | Validé avec réserves
detecteur-de-mouvement | 34 | 0/0/3/0 | Validé avec réserves

## Rubrique : Câblages (articles 8 à 12 : variateur, prises, sonnette, contacteur jour/nuit)

Source : RGIE Livre 1 v07 (15/09/2026), texte `scratchpad/livre1.txt`. Pages = pages imprimées.

### variateur — Le variateur de lumière

Fichiers : learn/fr/variateur.html
Affirmations vérifiées : 34 (dont réglementaires : 3)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 95 | « tirer un fil bleu supplémentaire jusqu’à l’interrupteur » | Bonne pratique professionnelle | Ne précise pas que le neutre doit venir du même circuit ; un neutre pris sur un autre circuit reste sous tension quand on coupe le circuit et perturbe les différentiels. | P2 | RGIE 5.2.1.3, p. 130 (« conducteurs isolés, appartenant à un même circuit, sont posés à proximité immédiate ») ; principe physique | « le neutre du même circuit … jamais celui d’un autre circuit », avec la raison | Corrigé |
| 2 | 108 | « Couper le circuit … vérifier l’absence de tension avec un testeur adapté » | Bonne pratique professionnelle | Il manque la prévention de la remise sous tension (consignation). | P2 | Bonne pratique (consignation) | Ajout « empêcher sa remise en service », « détecteur de tension adapté », « sur chaque fil » | Corrigé |
| 3 | 123 | (absent) normes des variateurs | Obligation réglementaire | Rien sur la conformité du matériel. | P3 | RGIE 5.3.5.4 a, p. 169 (« conformes soit à la norme y relative homologuée par le Roi ou enregistrée par le NBN ») | Phrase ajoutée : le variateur doit être conforme à sa norme (RGIE, 5.3.5.4 a). Norme produit non citée (IEC/EN 60669-2-1 non lue). | Corrigé |

Affirmations vérifiées sans problème : variateur sur la phase (5.3.3.2 c, p. 159, interdit sur le neutre) ; coupure début / fin de phase et usages (principe physique, documentation des fabricants) ; variateur 2 fils alimenté à travers la lampe, 3 fils entre phase et neutre (principe) ; lampes « dimmables », puissance LED, charge minimale, seuil bas, déclassement si plusieurs variateurs côte à côte (recommandations des fabricants, présentées comme telles) ; pas de variateur sur une prise (5.3.5.4 a : « prévus pour la catégorie d’emploi ») ; circuit d’éclairage sous 30 mA en neuf (4.2.4.3 b point 2, p. 101) ; schéma SVG 2 fils / 3 fils exact (neutre direct à la lampe ; N au variateur en 3 fils) ; FAQ (clignotements, va-et-vient, échauffement) cohérente avec les notices.
Incertitudes : norme produit des variateurs (IEC/EN 60669-2-1) non accessible, non citée. Sur un réseau 3 × 230 V, la borne « N » d’un variateur 3 fils reçoit la seconde phase : fonctionnement admis par la plupart des fabricants, à confirmer modèle par modèle (non écrit dans l’article).

### prise-de-courant — La prise de courant

Fichiers : learn/fr/prise-de-courant.html (+ tools/learn/exercices/prise-de-courant.ts)
Affirmations vérifiées : 46 (dont réglementaires : 17)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 53 | « Les gros appareils (lave-linge, sèche-linge, lave-vaisselle, four) sont en pratique placés chacun sur un circuit qui leur est réservé » | Obligation réglementaire | Obligation présentée comme une pratique ; liste incomplète (cuisinière, taque, tout appareil à poste fixe ≥ 2 600 W, chauffage électrique fixe). | P1 | RGIE 5.2.1.2, p. 129-130 (« ≥ 2600 W est alimenté séparément par un circuit dédié. Le lave-linge, le lave-vaisselle, le sèche-linge… ») | Paragraphe réécrit : le RGIE impose un circuit dédié + liste complète ; ajout d’une « erreur fréquente » | Corrigé |
| 2 | 119 | « Prises ajoutées sur un circuit d’éclairage en 1,5 mm² : le câble est trop fin pour une prise protégée par 20 A » | Interdiction réglementaire | Laisse croire que c’est acceptable sous 16 A. Le 1,5 mm² n’est admis que pour les circuits sans socle de prise (sauf socle 2,5 A intégré à un luminaire). | P1 | RGIE 5.2.1.2, tableau 5.1, p. 129 (« circuits ne comportant pas de socle de prise de courant ») | « interdit, même si ce circuit est protégé par 16 A » | Corrigé |
| 3 | 21 (FAQ) | « ajoutez un four de 2 500 W et le disjoncteur déclenchera » | Simplification pédagogique | Exemple contraire à l’obligation de circuit dédié du four ; « déclenchera » : le déclenchement thermique n’est pas immédiat. | P2 | RGIE 5.2.1.2, p. 130 ; principe (courbe thermique) | Aspirateur 1 000 W, « finira par déclencher », rappel des circuits dédiés | Corrigé |
| 4 | 14, 57 | « les prises de 16 A ont des obturateurs (IPXX-D) depuis le 1er mars 2025 » | Obligation réglementaire | La rédaction actuelle de 5.3.5.2 a s’applique depuis le 01/03/2025 (5.3.5.2 c, 6.5.8.1 point 2, 8.2.2 point 6), mais le texte ne permet pas d’affirmer que l’IPXX-D n’était pas exigé avant (Voltaplan signale déjà l’absence de sécurité enfant avant cette date). Omis : seuil 250 V, IPXX-B pour toute prise, conformité NBN C 61-112-1:2017, maintien en service des prises posées avant selon les règles d’alors. | P2 | RGIE 5.3.5.2 a et c, p. 167 ; 6.5.8.1 point 2, p. 207 ; 8.2.2 point 6, p. 278 | Réécrit : obligation sans présenter la date comme le début de l’exigence ; « dans sa version applicable depuis le 1er mars 2025 » ; exceptions et maintien de l’existant | Corrigé (historique à valider) |
| 5 | 50 | « un disjoncteur de 20 A au plus pour du 2,5 mm² » | Obligation réglementaire | Exact, mais sans source, sans l’équivalent fusible (16 A) et sans dire que c’est un maximum (le courant admissible dépend du mode de pose). | P2 | RGIE 4.4.1.4, tableau 4.11, p. 117 | Source, fusible 16 A, « c’est un maximum : selon la pose… » ; « À retenir » complété | Corrigé |
| 6 | 51 | (absent) circuits mixtes | Obligation réglementaire | Pas dit qu’un circuit mixte prises + éclairage suit les règles des prises et que chaque point d’éclairage commandé compte comme un socle. | P2 | RGIE 5.3.5.2 b, p. 167 (« un appareil fixe … commandé par un appareil de manœuvre commun étant assimilé à un socle ») | Paragraphe ajouté | Corrigé |
| 7 | 18 (FAQ) | « comme l’indique aussi la vérification de Voltaplan » | Choix d’implémentation Voltaplan | Voltaplan cité comme appui d’une règle. « dans une même boîte » n’est pas le critère du RGIE (socle multiple). | P3 | RGIE 5.3.5.2 b, p. 167 (« simples ou multiples est limité à huit par circuit terminal ») | Citation du RGIE à la place de Voltaplan | Corrigé |
| 8 | 56 | « les circuits de prises sont placés derrière un différentiel de 30 mA » | Obligation réglementaire | Imprécis : l’obligation vise les prises « non destinées à l’alimentation des appareils fixes » ; lave-linge, sèche-linge et lave-vaisselle aussi sous 30 mA. | P2 | RGIE 4.2.4.3 b, p. 101 | Précision ajoutée | Corrigé |
| 9 | 33 | « Une prise met à disposition la phase et le neutre » | Simplification pédagogique | Sur le réseau 3 × 230 V (IT), il n’y a pas de neutre : deux phases, les deux bornes sont sous tension par rapport à la terre (important pour la sécurité). | P2 | Principe physique (réseaux belges) | Paragraphe ajouté | Corrigé |
| 10 | 34 | « le différentiel coupe le circuit » | Principe physique | Pas de fausse garantie explicite, mais aucune nuance. | P3 | Consigne de sécurité pédagogique | « réduisent fortement le risque, sans le supprimer complètement » | Corrigé |
| 11 | 40-45 | Tableau des couleurs | Exigence réglementaire / sécurité | Il manque l’avertissement : la couleur ne prouve pas la fonction. | P2 | Consigne de sécurité pédagogique | Phrase ajoutée | Corrigé |
| 12 | 108 | « Couper le circuit … testeur adapté » | Bonne pratique | Consignation absente ; « testeur » ambigu (tournevis testeur). | P2 | Bonne pratique | Consignation + détecteur bipolaire | Corrigé |
| 13 | 113 | « vérifier la prise avec un testeur de prise » | Bonne pratique | Un testeur de prise n’est pas une preuve de conformité ni de la qualité de la terre. | P2 | Consigne de sécurité pédagogique | Phrase ajoutée | Corrigé |

Affirmations vérifiées sans problème : contact de terre obligatoire en domestique sauf TBTS et transformateur de séparation individuel (5.3.5.2 b, p. 167) ; dérogation 8.2.1 point 6 b (avant le 01/10/1981, prises sans contact de terre si canalisation sans PE et différentiel haute ou très haute sensibilité, p. 274-275) ; « haute sensibilité » = 30 mA au plus (2.6.4, p. 34) ; broche de terre non reliée interdite (8.2.1 point 6, p. 275) ; 8 socles par circuit, socle multiple = 1 (5.3.5.2 b) ; > 8 toléré seulement dans l’existant (8.2.1 et 8.2.2 point 6) ; 2,5 mm² minimum avec prises (5.2.1.2) ; 30 mA depuis le 01/06/2023, 8 circuits par 30 mA (4.2.4.3 b ; 6.5.8.1 point 1) ; 20 A × 230 V ≈ 4 600 W ; repiquage et boîte de dérivation équivalents électriquement (principe) ; contrôle par organisme agréé avant mise en usage (chapitre 6.4). Pas de hauteur de prise imposée par le RGIE hors lieux particuliers (aucune occurrence trouvée) : l’article n’en parle pas, correct.
Exercice : solution (L, N, PE de l’arrivée à P1, repiquage vers P2), cas attendu (P1 et P2 alimentées), unifilaire (disjoncteur 20 A 1P+N, XVB 3G2,5, deux points de prise) et légende exacts ; `learn:check` OK.
Incertitudes : (a) exigence de sécurité enfant / IPXX-D avant le 01/03/2025 (ancien RGIE et Livre 1 de 2020) à confirmer par un spécialiste ; (b) qu’une prise double formée de deux socles simples juxtaposés dans une boîte double compte pour un ou deux points : le RGIE dit « socles simples ou multiples », l’interprétation courante est « un point » pour un socle multiple ; à faire confirmer ; (c) NBN C 61-112-1:2017 non lue.

### prise-commandee — La prise commandée par un interrupteur

Fichiers : learn/fr/prise-commandee.html (+ tools/learn/exercices/prise-commandee.ts)
Affirmations vérifiées : 33 (dont réglementaires : 10)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 18 (FAQ) | « Ce n’est pas une bonne idée si le circuit d’éclairage est en 1,5 mm² protégé par 16 A … le câble serait trop juste » | Interdiction réglementaire | Interdiction présentée comme un conseil ; n’indique pas que le circuit mixte en 2,5 mm² est permis. | P1 | RGIE 5.2.1.2, tableau 5.1, p. 129 ; 5.3.5.2 b, p. 167 | FAQ réécrite : interdit en 1,5 mm² ; circuit mixte permis s’il suit les règles des prises | Corrigé |
| 2 | 94 | « erreur classique : le câble serait trop fin pour une prise » | Interdiction réglementaire | Même point : c’est interdit. | P1 | RGIE 5.2.1.2, p. 129 | « et elle est interdite » + source | Corrigé |
| 3 | 126 | « Fil de commande en 1,5 mm² sur un circuit protégé par 20 A » | Interdiction réglementaire | Laisse croire que c’est permis sous 16 A. | P1 | RGIE 5.2.1.2, p. 129 | « interdit sur un circuit de prises, quel que soit le calibre » | Corrigé |
| 4 | 33 | « On ne coupe jamais le neutre seul » | Interdiction réglementaire | Exact mais présenté sans source. | P3 | RGIE 5.3.3.2 c, p. 159 (« un dispositif de commande unipolaire n’est pas placé sur le conducteur neutre ») | Source ajoutée | Corrigé |
| 5 | 97 | « 10 A ou 16 A, parfois suivi de la lettre X pour les charges difficiles » | Recommandation du fabricant | Pas de conseil concret alors qu’une prise peut débiter 16 A ; « AX » simplifié à l’excès. | P2 | RGIE 5.3.5.4 a, p. 169 (« prévus pour la catégorie d’emploi ») ; notices | « un interrupteur de 16 A est le choix le plus sûr », renvoi à la notice | Corrigé |
| 6 | 90 | « disjoncteur de 20 A au plus » | Obligation réglementaire | Exact, sans source. | P3 | RGIE 4.4.1.4, tableau 4.11, p. 117 | Source ajoutée | Corrigé |
| 7 | 102 | « Couper le circuit … testeur adapté » | Bonne pratique | Consignation absente. | P2 | Bonne pratique | Ajouté | Corrigé |

Affirmations vérifiées sans problème : interrupteur sur la phase, neutre et PE directs (5.3.3.2 c) ; 2,5 mm² sur tout le trajet y compris le retour (5.2.1.2) ; 30 mA en neuf (4.2.4.3 b) ; terre et obturateurs (5.3.5.2 a et b) ; un point de prise dans la limite de 8 (5.3.5.2 b) ; retour noir ou gris, jamais bleu ni vert-jaune (cohérent avec les règles de couleurs, détail traité dans couleurs-des-fils) ; repérage sur le plan de position et dans le dossier (bonne pratique, présentée comme telle) ; variantes va-et-vient, télérupteur, module radio ; SVG exact (phase vers interrupteur et prise permanente, retour vers prise commandée, N et PE directs).
Exercice : solution correcte (phase à l’interrupteur puis repiquée vers P2, retour noir vers P1, N et PE en repiquage) ; cas attendus (off : P1 éteinte, P2 alimentée ; on : les deux) ; unifilaire (20 A, XVB 3G2,5 vers l’interrupteur puis vers la prise commandée ; un 3G suffit : L, retour, PE) et légende exacts ; `learn:check` OK.
Incertitudes : sur un réseau 3 × 230 V, un interrupteur unipolaire laisse la prise commandée reliée à l’autre phase ; admis par 5.3.3.2 c (« Si des dangers ne peuvent en résulter, il est permis de ne pas couper tous les conducteurs actifs ») et usuel en Belgique, mais non écrit dans l’article : à décider (renvoi possible au paragraphe 3 × 230 V de prise-de-courant).

### sonnette — La sonnette et son transformateur

Fichiers : learn/fr/sonnette.html
Affirmations vérifiées : 30 (dont réglementaires : 7)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 88 | « En pratique, on ne fait pas passer les fils de sonnette dans le même tube que les conducteurs à 230 V, sauf si leur isolation est prévue pour la tension la plus élevée » | Obligation réglementaire | Obligation de séparation de protection présentée comme une pratique ; deux des trois solutions admises manquent (10 mm, isolation supplémentaire). | P1 | RGIE 4.2.5.3 b et c, p. 105-106 (« une séparation physique d’au moins 10 mm … isolation supplémentaire … isolés … pour la tension la plus élevée ») | Réécrit avec les trois solutions et la source ; « À retenir » complété | Corrigé |
| 2 | 75 | « C’est ce qui permet d’utiliser un bouton simple … et du fil fin » | Obligation réglementaire | La dispense de protection contre le contact direct n’existe que sous les valeurs du tableau 4.1 (25 V alternatif peau sèche, 12 V peau mouillée) ; interdiction de relier la TBTS à la terre ou à d’autres circuits non dite. | P2 | RGIE 4.2.2.2, tableau 4.1, p. 73 ; 4.2.5.5 a et c, p. 107 | Précisions ajoutées | Corrigé |
| 3 | 74 | « très basse tension en dessous de 50 V » | Obligation réglementaire (définition) | Le domaine TBT est U ≤ 50 V. | P3 | RGIE 2.3.2, tableau 2.1, p. 22 | « jusqu’à 50 V » | Corrigé |
| 4 | 11 | « le bouton à l’extérieur ne porte pas de 230 V » | Principe physique | Absolu ; vrai en fonctionnement normal et si l’installation est conforme. | P3 | Sécurité pédagogique | « en fonctionnement normal » | Corrigé |
| 5 | 92 | « Couper le circuit … vérifier l’absence de tension » | Bonne pratique | Consignation absente. | P2 | Bonne pratique | Ajouté | Corrigé |

Affirmations vérifiées sans problème : TBTS = séparée du réseau et de la terre (définition, p. 21 ; 4.2.5.5 c) ; source TBTS = transformateur de sécurité ou équivalent (4.2.5.3 a, 4.2.5.1, p. 105) ; ne pas remplacer par un chargeur quelconque (cohérent avec 4.2.5.3 a) ; primaire = circuit protégé au tableau (4.2.5.3 e : chapitres 4.3 et 4.4 restent d’application) ; fil fin admis pour les circuits de commande et de signalisation (5.2.1.2, tableau 5.1 : 0,5 mm²) ; bouton et sonnerie en série, boutons en parallèle pour deux portes (principe) ; pannes courantes ; SVG exact (primaire L/N, double barrière, boucle secondaire en série).
Incertitudes : norme des transformateurs de sonnette (IEC/EN 61558-2-8) non lue, non citée ; classement d’un bouton extérieur sous la pluie en BB1 ou BB2 (seuil 25 V ou 12 V) à apprécier par un spécialiste — l’article reste valable avec les sorties usuelles 8 / 12 V ; une sortie 24 V à l’extérieur mérite vérification.

### contacteur-jour-nuit — Le contacteur jour/nuit du chauffe-eau

Fichiers : learn/fr/contacteur-jour-nuit.html
Affirmations vérifiées : 32 (dont réglementaires : 6)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 106 | « un différentiel en amont, comme pour tout circuit » | Obligation réglementaire | Ambigu : le lecteur peut croire à un 30 mA obligatoire, ou ignorer le cas salle de bain. Le chauffe-eau (appareil fixe) peut être derrière le seul différentiel général ≤ 300 mA, sauf circuit desservant une salle de bain / douche. | P2 | RGIE 4.2.4.3 b, p. 100-101 | Précision ajoutée | Corrigé |
| 2 | 12, 103 | « Le chauffe-eau est sur un circuit dédié » | Obligation / bonne pratique | Le RGIE n’impose le circuit dédié qu’à partir de 2 600 W (appareil à poste fixe) ; en dessous c’est une pratique, mais le contacteur l’impose de fait. | P2 | RGIE 5.2.1.2, p. 129-130 ; définitions « appareil installé à poste fixe », p. 39 | Distinction obligation (≥ 2 600 W) / pratique | Corrigé |
| 3 | 105 | « 2,5 mm² et 20 A au plus, ou 1,5 mm² et 16 A au plus » | Obligation réglementaire | Exact, sans source ni mention du mode de pose. | P3 | RGIE 4.4.1.4, tableau 4.11, p. 117 | Source + « calibre plus faible selon la pose » | Corrigé |
| 4 | 116 | (absent) circuits à tarifs différents | Obligation réglementaire | Avec un compteur séparé (exclusif nuit), le RGIE impose des panneaux distincts écartés de 10 cm ou un tableau séparé, sauf autorisation du GRD. | P2 | RGIE 5.3.5.1 c, p. 167 (« groupés sur des panneaux distincts, écartés les uns des autres de 10 cm au moins ») | Paragraphe ajouté | Corrigé |
| 5 | 114 | « Couper le bon circuit et vérifier » | Bonne pratique | Consignation absente. | P2 | Bonne pratique | Ajouté | Corrigé |
| 6 | 24, 88 | Lien vers sbg-energy.com | Source | Source commerciale tierce, pas un gestionnaire de réseau ; place faible dans la hiérarchie des sources (niveau 4 attendu : Synergrid, Fluvius, Sibelga, ORES, RESA). | P3 | Consigne (hiérarchie des sources) | Non modifié : à remplacer par une page officielle d’un gestionnaire de réseau si le propriétaire du site le souhaite | Proposé |

Affirmations vérifiées sans problème : contacteur = bobine A1-A2 + contacts de puissance, sans mémoire (principe, documentation des fabricants) ; 2 400 W ≈ 10,4 A ; signal tarifaire donné par le gestionnaire de réseau, via récepteur, contact du compteur ou relais du compteur communicant (présenté de façon générale, renvoi au GRD) ; ne pas modifier soi-même le raccordement côté compteur ; positions auto / I / 0 selon le fabricant ; thermostat et contacteur en série ; PE à la cuve métallique (4.2.3.4, protection par coupure automatique, principe) ; chauffe-eau qui ne chauffe pas pas forcément hors tension ; contrôle par organisme agréé (6.4). SVG exact (commande de bobine séparée, contact sur la phase, N direct, PE à la cuve).
Incertitudes : modalités actuelles du signal heures creuses sur les compteurs numériques belges (Fluvius, Sibelga, ORES, RESA : relais intégré, contact sec, module séparé) non vérifiées dans des documents officiels ; l’article reste général et renvoie au GRD. Règles propres aux chauffe-eau placés dans une salle de bain (chapitre 7.1) non traitées.

### Anomalies du moteur de Voltaplan

1. **Circuits mixtes : les points d’éclairage ne comptent pas dans la limite de 8** — `src/rules/be/rgie.ts`, l. 281 : `if (sockets.length > 8) add('R-SOCKET-MAX', …)` ne compte que les nœuds `socket`. RGIE 5.3.5.2 b (p. 167) : sur un circuit mixte, « un appareil fixe ou un ensemble d’appareils fixes commandé par un appareil de manœuvre commun étant assimilé à un socle de prise de courant ». Correction proposée : quand le circuit contient au moins un socle, compter sockets + groupes de lampes / appareils fixes par interrupteur (hors appareils des circuits dédiés). Test : circuit avec 6 prises et 3 points d’éclairage commandés par 3 interrupteurs → R-SOCKET-MAX attendu ; circuit d’éclairage seul avec 10 points → pas de R-SOCKET-MAX.
2. **Circuit dédié : seuil de 2 600 W absent, liste figée** — `src/model/schema.ts`, l. 85-96 (`DEDICATED_CIRCUIT_APPLIANCES`) et `rgie.ts` l. 288-296. RGIE 5.2.1.2 (p. 129-130) impose le circuit dédié à tout appareil à poste fixe ≥ 2 600 W, plus une liste nommée (lave-linge, lave-vaisselle, sèche-linge, cuisinière, taque, four) et le chauffage électrique fixe. Le moteur l’impose à `waterHeater`, `heatPump`, `boiler`, `evCharger` quelle que soit leur puissance (au-delà du RGIE si < 2 600 W ; acceptable comme recommandation, mais le texte `R-DEDICATED-CIRCUIT` est une non-conformité), et ignore tout autre appareil ≥ 2 600 W. Correction proposée : liste RGIE + test de puissance (`power >= 2600`) ; appareils hors liste et < 2 600 W → info/recommandation. Test : chauffe-eau 2 000 W partagé avec une prise → pas de non-conformité ; appareil « autre » 3 000 W partagé → R-DEDICATED-CIRCUIT. (À faire valider : le RGIE parle de chauffage électrique fixe ; la pompe à chaleur de chauffage en relève probablement.)
3. **R-SOCKET-SECTION** : vérifié correct (2,5 mm² dès qu’il y a une prise, conforme au tableau 5.1). Le cas du socle unique de 2,5 A intégré à un luminaire (exception du tableau 5.1) n’est pas modélisé : sans conséquence pratique, signalé pour mémoire.

### Références à ajouter à rgieRefs

- **4.4.1.4** — p. 116-117 — « l’intensité maximale du disjoncteur qui protègent une canalisation électrique est donnée au tableau 4.11 » (prise-de-courant, prise-commandee, contacteur-jour-nuit)
- **5.2.1.2** — p. 129-130 — « ≥ 2600 W est alimenté séparément par un circuit dédié » ; tableau 5.1 : 1,5 mm² pour « circuits ne comportant pas de socle de prise de courant » (prise-de-courant, prise-commandee, contacteur-jour-nuit)
- **5.3.3.2 c** — p. 159 — « un dispositif de commande unipolaire n’est pas placé sur le conducteur neutre » (prise-commandee)
- **5.3.5.4 a** — p. 169 — « conformes soit à la norme y relative homologuée par le Roi ou enregistrée par le NBN » ; « prévus pour la catégorie d’emploi » (prise-commandee, variateur)
- **5.3.5.1 c** — p. 167 — « circuits dont l’énergie est soumise à des tarifs différents sont groupés sur des panneaux distincts, écartés … de 10 cm au moins » (contacteur-jour-nuit). Remarque : ce paragraphe suit le point c « Emplacement » dans le texte extrait ; si la mise en page du PDF le rattache à un autre point, citer simplement « 5.3.5.1 ».
- **4.2.2.2** — p. 73 — tableau 4.1 « Tension nominale maximale lors de l’emploi de la TBTS » : 25 V (BB1), 12 V (BB2) en alternatif (sonnette)
- **4.2.5.3 c** — p. 106 — « une séparation physique d’au moins 10 mm entre les conducteurs des circuits TBTS et TBTP et les conducteurs d’autres circuits » (sonnette)

### Couverture

variateur | 34 | P0 0 / P1 0 / P2 2 / P3 1 | Validé avec réserves
prise-de-courant | 46 | P0 0 / P1 2 / P2 9 / P3 2 | Validé avec réserves
prise-commandee | 33 | P0 0 / P1 3 / P2 2 / P3 2 | Validé avec réserves
sonnette | 30 | P0 0 / P1 1 / P2 2 / P3 2 | Validé avec réserves
contacteur-jour-nuit | 32 | P0 0 / P1 0 / P2 4 / P3 2 | Validé avec réserves

## Rubrique : Volets et ouvrants motorisés

Source principale : RGIE Livre 1, version 07 (15/09/2026), texte extrait `scratchpad/livre1.txt`. Pages = pages imprimées
(pied de page suivant le texte). Source fabricant consultée : brochure commerciale Somfy Oximo RTS (réf. 1041538),
tableau « Performances » : moteurs de 50 mm, 6 à 40 Nm, 90 à 270 W, 0,45 à 1,20 A, 230 V 50 Hz, « 3 fils : 0.75 mm2 ».
Recherche web complémentaire (notices Somfy LT, Kaiser Nienhaus, Becker, Elero) : le raccordement en parallèle est
exclu pour les moteurs à fins de course mécaniques et permis pour certains moteurs électroniques, selon la notice.

Constat général : le RGIE ne contient **aucune disposition propre aux volets roulants** ni d'exigence d'interverrouillage
des deux sens d'un moteur de volet. L'interverrouillage (mécanique ou électrique) relève de la conception du produit et
des notices des fabricants ; les articles le présentent correctement comme tel (jamais comme obligation RGIE). Les
dispositions RGIE applicables sont générales : 5.3.3.2 (commande fonctionnelle, p. 159), 4.2.4.3 a (classe I, p. 100),
5.1.6.2 (couleurs, p. 128), 5.2.1.2 + tableau 5.1 (sections, p. 129), tableau 4.11 (calibres, p. 117), 5.3.5.2 b (p. 167).
Pas de protection de surcharge spécifique imposée aux petits moteurs domestiques (4.4.3.3, p. 118-119, dispense possible
pour moteurs dont le courant à rotor calé ≤ Iz ; la protection thermique intégrée relève du fabricant).

### volet-roulant — Câbler un volet roulant

Fichiers : learn/fr/volet-roulant.html (+ tools/learn/exercices/volet-roulant.ts)
Affirmations vérifiées : 46 (dont réglementaires : 11)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 20 | « Ce n’est pas obligatoire … circuit dédié en 1,5 mm² protégé par un disjoncteur de 16 A au plus » | Obligation réglementaire | Vrai mais incomplet : le 1,5 mm² n'est admis que sur un circuit sans prise de courant ; sur un circuit mixte, un appareil fixe commandé par un appareil de manœuvre commun compte comme une prise (limite 8). Absence d'obligation de circuit dédié non sourcée. | P1 | RGIE 5.2.1.2 + tableau 5.1, p. 129 (« circuits ne comportant pas de socle de prise de courant ») ; tableau 4.11, p. 117 (1,5 mm² → 16 A) ; 5.3.5.2 b, p. 167 (« commandé par un appareil de manœuvre commun étant assimilé à un socle ») | FAQ réécrite avec ces trois conditions et les références | Corrigé |
| 2 | 92 | « puissance électrique … de l’ordre de 100 à 250 W, soit environ 0,5 à 1 A » | Recommandation du fabricant | Chiffre non sourcé, et sous-estimé (jusqu'à 270 W / 1,2 A pour un moteur de 50 mm courant) | P2 | Brochure Somfy Oximo RTS : 90-270 W, 0,45-1,20 A | « de l’ordre de 100 à 300 W, environ 0,5 à 1,2 A … ordre de grandeur tiré de fiches de fabricants ; la valeur exacte figure sur l’étiquette » + source ajoutée | Corrigé |
| 3 | 93 | « Sur un circuit protégé par un disjoncteur de 16 A, on utilise du 1,5 mm² » | Obligation réglementaire | Présenté comme règle générale ; faux si le circuit comporte une prise (2,5 mm² obligatoire) | P1 | RGIE 5.2.1.2, tableau 5.1, p. 129 ; tableau 4.11, p. 117 | « admis avec un disjoncteur de 16 A au plus, sur un circuit sans prise de courant … sinon 2,5 mm² » | Corrigé |
| 4 | 99 | « Couper le circuit … et vérifier l’absence de tension » | Bonne pratique professionnelle | Prévention de la remise sous tension (consignation) absente | P2 | Consigne commune (procédure de sécurité) | Ajout « empêcher sa remise sous tension (disjoncteur signalé ou verrouillé) … appareil adapté » | Corrigé |
| 5 | 87 | Tableau des couleurs (brun, noir, gris…) sans mise en garde | Simplification pédagogique | Risque de lire la couleur comme preuve de fonction ; règle RGIE des couleurs non distinguée de l'habitude | P2 | RGIE 5.1.6.2, p. 128 (bleu réservé au neutre, vert-jaune au PE) | Phrase ajoutée : bleu et vert-jaune réservés (RGIE), couleurs des fils de sens = habitude, une couleur ne prouve jamais la fonction | Corrigé |
| 6 | 117 | « Commande placée sur le neutre : le moteur reste sous tension » | Interdiction réglementaire | Interdiction RGIE non mentionnée (présentée seulement comme erreur) | P2 | RGIE 5.3.3.2 c, p. 159 : « un dispositif de commande unipolaire n’est pas placé sur le conducteur neutre » | « C’est interdit … (RGIE, 5.3.3.2 c) » | Corrigé |
| 7 | 118 | « Terre oubliée : … il doit être raccordé à la terre » | Obligation réglementaire | Obligation juste mais non sourcée ; précision classe I | P3 | RGIE 4.2.4.3 a, p. 100 : « Les masses du matériel … de la classe I sont reliées au conducteur de protection » | Référence et précision « moteur de classe I, cas habituel » ajoutées | Corrigé |
| 8 | 123 | « se trouve derrière un différentiel » | Obligation réglementaire | Imprécis : si les volets sont sur un circuit d'éclairage, différentiel haute sensibilité (≤ 30 mA) requis | P3 | RGIE 4.2.4.3 b, p. 100-101 ; définition haute sensibilité ≤ 30 mA (partie 2) | Précision ajoutée | Corrigé |
| 9 | 15 | « Un seul moteur par commande, sauf indication contraire du fabricant » | Recommandation du fabricant | Formulation ambiguë | P3 | Notices fabricants | « sauf si la notice du fabricant autorise le raccordement en parallèle » | Corrigé |
| 10 | 23-25 | Sources génériques | — | Sections RGIE et source fabricant non identifiées | P3 | — | Sources détaillées ajoutées | Corrigé |

Affirmations vérifiées sans problème : 2 entrées de phase + neutre commun + terre → principe physique (moteur à condensateur permanent réversible) et brochure fabricant ; commande verrouillée mécaniquement ou électriquement, double interrupteur à proscrire → conception produit / notices (pas une règle RGIE, non présentée comme telle) ; deux sens simultanés = enroulements en opposition, condensateur court-circuité, échauffement → principe physique ; fins de course arrêtent le moteur → fabricant ; inversion des fils de sens si le sens est inversé, hors tension → bonne pratique ; sortie de commande sur le neutre = court-circuit → principe physique ; 4 conducteurs commande → moteur → principe ; vert-jaune uniquement pour la terre → RGIE 5.1.6.2, p. 128 ; contrôle par organisme agréé d'une installation neuve ou modification importante → RGIE 6.4.7.3, p. 204 ; message de l'exercice cité (« … reçoit montée et descente en même temps : le moteur peut être endommagé ») → identique à `site/apprendre/cablage.js` l. 27 ; symbole unifilaire (interrupteur à deux flèches, M dans un cercle) → cohérent avec le générateur.
Exercice `volet-roulant.ts` : cas attendus (arrêt : aucun sens ; montée ; descente) justes ; solution sûre (phase seule commutée, N et PE directs, PE vert-jaune, N bleu) et validée par le simulateur (pas de défaut `bothDirections`, `switchOnNeutral`, `noEarth`) ; unifilaire 16 A / 1,5 mm² conforme au tableau 4.11 (circuit « Volets » sans prise) ; légende exacte.
Incertitudes : « certaines notices demandent un court arrêt avant inversion » (non relevé dans une notice précise ici) ; limite pratique de 8 « points » sur un circuit mixte : interprétation de 5.3.5.2 b à faire confirmer (un groupe de volets sur une commande commune = un seul point ?).

### moteur-de-volet — Le moteur de volet et ses fins de course

Fichiers : learn/fr/moteur-de-volet.html
Affirmations vérifiées : 34 (dont réglementaires : 4)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 39 | « 100 à 250 W, soit … 0,5 à 1 A » | Recommandation du fabricant | Non sourcé, sous-estimé | P2 | Brochure Somfy Oximo RTS (90-270 W, 0,45-1,20 A) | Ordre de grandeur 100-300 W / 0,5-1,2 A, renvoi à l'étiquette, source ajoutée | Corrigé |
| 2 | 51 | « Le bleu reste le neutre et le vert-jaune reste la terre, comme partout » | Obligation réglementaire / simplification | Présente la couleur comme garantie de fonction | P2 | RGIE 5.1.6.2, p. 128 ; consigne de sécurité pédagogique | « normalement … couleurs que le RGIE réserve … une couleur ne prouve jamais la fonction d’un fil : repérez hors tension » | Corrigé |
| 3 | 89 | « Les fabricants recommandent aussi souvent de marquer un court arrêt » | Recommandation du fabricant | Généralisation non vérifiée | P3 | — | « Certaines notices demandent… » | Corrigé |
| 4 | 90 | « on ne branche pas deux moteurs en parallèle » | Recommandation du fabricant | Absolu, contredit l'article commande groupée (exception fabricant) | P3 | Notices Somfy LT (parallèle exclu), Kaiser Nienhaus Electronic (parallèle permis) | « sauf si la notice l’autorise explicitement » | Corrigé |
| 5 | 94 | « Couper le circuit … vérifier l’absence de tension » | Bonne pratique | Consignation absente | P2 | Consigne commune | Ajout « empêcher sa remise sous tension … appareil adapté » | Corrigé |
| 6 | 96 | « Raccorder la terre : le corps du moteur est métallique » | Obligation réglementaire | Non sourcé | P3 | RGIE 4.2.4.3 a, p. 100 | Référence ajoutée | Corrigé |

Affirmations vérifiées sans problème : contenu du tube (moteur monophasé à deux enroulements, condensateur, réducteur, frein, fins de course, protection thermique fréquente) → principe physique / fabricant ; condensateur entre les deux fils de sens, court-circuité si les deux sens sont alimentés → principe physique ; sens dépendant du côté de montage → fabricant ; fins de course mécaniques (vis) ou électroniques (procédure, câble ou outil) → notices ; fin de course coupe un seul sens, l'autre reste possible → principe ; rétro-alimentation par le condensateur en parallèle → principe physique (cohérent avec notices Somfy LT) ; moteurs radio à 3 fils (phase, neutre, terre) → brochure Oximo RTS « 3 fils » ; boîte de raccordement accessible → bonne pratique ; protection thermique (attendre le refroidissement) → fabricant.
Incertitudes : aucune réglementaire ; le « frein » n'existe pas sur tous les moteurs (formulation « classique » acceptable).

### commande-groupee-volets — Commander plusieurs volets ensemble

Fichiers : learn/fr/commande-groupee-volets.html
Affirmations vérifiées : 30 (dont réglementaires : 4)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 18 | « un moteur … 0,5 à 1 A. Dix moteurs restent sous la limite d’un circuit en 1,5 mm² … 16 A » | Principe physique + obligation | Chiffre non sourcé ; omet la condition « sans prise » du 1,5 mm² | P2 | Brochure Oximo RTS ; RGIE 5.2.1.2 tableau 5.1, p. 129 | « 0,5 à 1,2 A (voir l’étiquette) ; additionnez … une dizaine de moteurs reste en général sous 16 A … circuit sans prise » | Corrigé |
| 2 | 77-79 | Interdiction du parallèle (sans source réglementaire) | Recommandation du fabricant | Le lecteur pourrait croire à une interdiction RGIE ; le RGIE admet expressément qu'un dispositif commande plusieurs appareils simultanés | P2 | RGIE 5.3.3.2 d, p. 159 : « un même dispositif commande plusieurs machines … dont le fonctionnement est simultané » | Paragraphe ajouté : ce n'est pas le RGIE qui l'interdit, c'est la construction des moteurs, la notice tranche | Corrigé |
| 3 | 106 | « Un circuit dédié aux volets, protégé … 16 A en 1,5 mm² » | Bonne pratique / obligation | Condition « sans prise » absente ; non obligatoire non dit | P2 | RGIE 5.2.1.2, tableau 5.1, p. 129 ; tableau 4.11, p. 117 | « 16 A au plus (sans prise de courant sur ce circuit) … le RGIE ne l’impose pas » | Corrigé |
| 4 | 106 | « coupez le circuit et vérifiez l’absence de tension » | Bonne pratique | Consignation absente | P2 | Consigne commune | Ajout « empêchez sa remise sous tension » | Corrigé |
| 5 | 21-22 | Sources génériques | — | — | P3 | — | Sources précisées | Corrigé |

Affirmations vérifiées sans problème : mécanisme de rétro-alimentation par condensateur quand un moteur atteint sa fin de course → principe physique, cohérent avec notices (Somfy LT : jamais en parallèle, 2 relais par moteur) ; certains moteurs électroniques autorisés en parallèle si la notice le dit → notices Kaiser Nienhaus / Becker / Elero ; relais de centralisation par moteur, verrouillage, commande générale par fils d'ordre → fabricants ; priorité de la commande générale selon modèle → fabricants ; moteurs radio, modules Wi-Fi/Zigbee, KNX → fabricants ; illustration (faux : parallèle ; juste : un relais par moteur) → exacte ; contrôle par organisme agréé → RGIE 6.4.7.3, p. 204.
Incertitudes : « le contact de la commande est dimensionné pour un moteur » : plausible (pouvoir de coupure sur charge inductive), non vérifié dans une fiche précise.

### fenetre-motorisee — Fenêtres, coupoles et ouvrants motorisés

Fichiers : learn/fr/fenetre-motorisee.html (+ tools/learn/exercices/fenetre-motorisee.ts)
Affirmations vérifiées : 40 (dont réglementaires : 7)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 37 | « fonctionnent en <a lexique#tbts>très basse tension</a> » | Simplification trompeuse | Le lien vers « TBTS » assimile toute très basse tension d'un boîtier fabricant à la TBTS, qui exige une source de sécurité et une séparation de protection | P2 | RGIE 4.2.5.3 a et b, p. 106 ; définitions TBTS / TBTP / TBTF, partie 2 | « Très basse tension ne veut pas forcément dire TBTS : cela dépend de la source (RGIE, 4.2.5.3) » | Corrigé |
| 2 | 99-100 | (absent) séparation TBT / 230 V | Interdiction réglementaire | Omission : fils TBT dans le même câble ou tube que le 230 V sans isolation pour 230 V | P1 | RGIE 5.2.1.3, p. 130 : « … à condition que les conducteurs soient isolés … pour la tension la plus élevée présente » | Erreur ajoutée à la liste avec la référence | Corrigé |
| 3 | 99 | « il est détruit immédiatement » | Principe physique | Formulation absolue | P3 | — | « il est détruit » | Corrigé |
| 4 | 106 | (absent) redémarrage automatique | Obligation réglementaire | Omission utile pour un ouvrant à fermeture automatique | P2 | RGIE 5.3.3.2 e, p. 159 : « soit empêchée la réalimentation automatique des moteurs dont le redémarrage est … susceptible de provoquer un danger » | Phrase ajoutée dans « Sécurité d’usage » | Corrigé (interprétation à valider, voir incertitudes) |
| 5 | 107 | « Les exutoires de désenfumage obéissent à des règles propres » | — | Rien de faux ; ajout d'une référence vérifiée sans rien affirmer de plus | P3 | RGIE 5.5.7.3, p. 187 (moteurs du système d'évacuation de fumée et de chaleur, circuits de sécurité) | « font partie des installations de sécurité : le RGIE leur consacre des règles particulières (par exemple RGIE, 5.5.7.3), et d’autres réglementations s’y ajoutent » | Corrigé |
| 6 | 88 | « Couper le circuit … vérifier l’absence de tension » | Bonne pratique | Consignation absente | P2 | Consigne commune | Ajout | Corrigé |
| 7 | 102 | « Terre oubliée sur un moteur qui en a une » | Obligation réglementaire | Non sourcé | P3 | RGIE 4.2.4.3 a, p. 100 | Référence ajoutée | Corrigé |
| 8 | 32 | « Coupole … Fréquent en salle de bain » | Obligation réglementaire (omise) | Aucune mention des volumes de la salle de bain pour moteur et commande | P2 | RGIE chapitre 7.1 (lieux contenant une baignoire ou une douche) | Phrase ajoutée renvoyant au chapitre 7.1 | Corrigé |

Affirmations vérifiées sans problème : ouvrant 230 V deux sens câblé comme un volet → principe ; commande verrouillée → fabricant ; moteurs TBT continus dont le sens dépend de la polarité, à raccorder au boîtier du fabricant, jamais au 230 V → notices / principe ; tableau des connexions en boîte (brun, noir, gris, bleu, vert-jaune) → couleurs habituelles, bleu et vert-jaune conformes à RGIE 5.1.6.2 ; capteur de pluie, anti-pincement → fabricants ; parallèle sans accord fabricant → renvoi correct ; contrôle par organisme agréé → RGIE 6.4.7.3.
Exercice `fenetre-motorisee.ts` : cas attendus justes (arrêt, ouvrir = borne montée, fermer = borne descente, explicité dans la consigne et l'article) ; solution sûre (phase seule commutée via la boîte, N et PE directs, couleurs correctes) ; unifilaire 16 A / 1,5 mm² (circuit « Coupole » sans prise, conforme au tableau 4.11 et au tableau 5.1) ; légende exacte (boîte non dessinée, signalée).
Incertitudes : portée de 5.3.3.2 e pour un ouvrant domestique (s'applique aux moteurs « dont le redémarrage est susceptible de provoquer un danger pour les personnes » : interprétation à confirmer par un spécialiste) ; règles de désenfumage hors RGIE (réglementation incendie, normes NBN/EN des EFC) non consultées : rien n'est affirmé à leur sujet.

### volets-domotique — Volets et domotique

Fichiers : learn/fr/volets-domotique.html
Affirmations vérifiées : 32 (dont réglementaires : 3)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 13 | « une commande locale doit toujours rester possible » | Bonne pratique présentée comme obligation | Aucune exigence RGIE en ce sens | P2 | RGIE : rien de tel trouvé (recherche « volet », « commande locale ») | « il est prudent de garder une commande locale qui fonctionne sans la box ni le réseau » | Corrigé |
| 2 | 114 | « un tube libre pour un câble de bus » | Obligation réglementaire (omise) | Partage d'un tube bus / 230 V non encadré | P2 | RGIE 5.2.1.3, p. 130 | Précision ajoutée (isolation pour la tension la plus élevée, sinon tube séparé) | Corrigé |
| 3 | 85 | « coupez toujours le circuit et vérifiez l’absence de tension » | Bonne pratique | Consignation absente | P2 | Consigne commune | Ajout | Corrigé |
| 4 | 22-23 | Sources génériques | — | — | P3 | — | Sources précisées | Corrigé |

Affirmations vérifiées sans problème : trois solutions (module derrière la commande, moteur radio à alimentation permanente, bus filaire avec actionneurs au tableau et câble 4 conducteurs par moteur) → fabricants ; moteur inchangé, verrouillage intégré aux modules volets → fabricants ; neutre nécessaire à la plupart des modules → fabricants ; calibrage par durées → fabricants ; capteur de vent surtout pour stores bannes et BSO → bonne pratique ; gel et détection d'obstacle → fabricants ; neutre et terre en boîte, boîtes profondes → bonne pratique ; contrôle par organisme agréé → RGIE 6.4.7.3.
Incertitudes : aucune réglementaire.

### Anomalies du moteur de Voltaplan

1. `src/rules/be/rgie.ts`, règle par circuit (vers la ligne 280) : `if (sockets.length > 8) add('R-SOCKET-MAX', …)` ne compte que les nœuds `socket`. Or, sur un circuit qui alimente des prises et d'autres appareils fixes, « un appareil fixe ou un ensemble d’appareils fixes commandé par un appareil de manœuvre commun » est assimilé à un socle (RGIE 5.3.5.2 b, p. 167). Un circuit avec 7 prises + 3 moteurs de volet (chacun sur sa commande) passe donc sans constat alors qu'il compte 10 points. Correction proposée : quand le circuit contient au moins un `socket`, compter aussi chaque `motor` / `appliance` fixe (ou groupe sous un même `switch`) dans le total ; test : circuit 2,5 mm² 20 A avec 7 prises + 2 volets (chacun derrière un `switch` shutter) → `R-SOCKET-MAX` attendu ; 8 prises seules → aucun constat ; 3 volets sans prise → aucun constat. À faire valider (interprétation de « appareil de manœuvre commun »).
2. Aucune autre anomalie relevée pour la rubrique : le simulateur `site/apprendre/cablage-sim.js` (moteur `motor`, défaut `bothDirections`, `switchOnNeutral`, `noEarth`, couleurs) donne les bons verdicts sur les deux exercices.

### Références à ajouter à rgieRefs

- **4.2.4.3 a** — p. 100 — « Les masses du matériel électrique à basse tension de la classe I sont reliées au conducteur de protection »
- **5.1.6.2** — p. 128 — « Les matériaux d’isolation de couleur bleue sont réservés au conducteur neutre »
- **5.2.1.2** — p. 129 (avec le tableau 5.1) — « l’emploi de conducteurs isolés d’une section inférieure à 2,5 mm² est interdite », sauf tableau 5.1 (1,5 mm² : « circuits ne comportant pas de socle de prise de courant »)
- **5.2.1.3** — p. 130 — « peut contenir des circuits à tensions différentes à condition que les conducteurs soient isolés … pour la tension la plus élevée »
- **5.3.3.2 c** — p. 159 — « un dispositif de commande unipolaire n’est pas placé sur le conducteur neutre »
- **5.3.3.2 d** — p. 159 — « il est admis qu’un même dispositif commande plusieurs machines ou appareils électriques dont le fonctionnement est simultané »
- **5.3.3.2 e** — p. 159 — « soit empêchée la réalimentation automatique des moteurs dont le redémarrage est alors susceptible de provoquer un danger »
- **4.2.5.3** — p. 106 — « La TBTS et la TBTP peuvent uniquement être fournies par l’une des sources d’énergie de très basse tension mentionnée »
- **5.5.7.3** — p. 187 — « Pour exemple: les moteurs utilisés pour le système d’évacuation de la fumée et de la chaleur (EFC) »

### Couverture

volet-roulant | 46 | 0/2/4/4 | Validé avec réserves
moteur-de-volet | 34 | 0/0/3/3 | Validé avec réserves
commande-groupee-volets | 30 | 0/0/4/1 | Validé avec réserves
fenetre-motorisee | 40 | 0/1/4/3 | Validé avec réserves
volets-domotique | 32 | 0/0/3/1 | Validé avec réserves

## Rubrique : Domotique et Schémas

Source principale : RGIE Livre 1 v07 (texte extrait `livre1.txt`, et pages du PDF officiel rendues en image pour le
tableau 2.23 et les figures 3.1 et 3.2 : pages imprimées 50 à 57, 62 et 63). Les numéros de ligne renvoient au fichier
AVANT correction (commit c6cf810).

Remarque générale (toutes les pages de la rubrique) : les consignes de sécurité disaient « coupez et vérifiez l’absence
de tension » sans la prévention de la remise sous tension. Le RGIE (5.3.3.1 a.4, p. 157) demande des mesures contre la
« remise sous tension intempestive » (cadenas, pancartes…). Ajouté partout (« empêchez la remise en service »). P2, Corrigé.

### domotique-introduction — La domotique : les principes

Fichiers : learn/fr/domotique-introduction.html
Affirmations vérifiées : 24 (dont réglementaires : 8)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 18 | « Les relais, modules et circuits domotiques doivent figurer sur les schémas » | Obligation réglementaire | Le RGIE n’énumère pas les relais ; il exige interrupteurs, boîtes, points, appareils fixes (3.1.2.2 a) et prévoit un symbole d’« unité de commande » domotique (tableau 2.23 J) | P2 | RGIE 3.1.2.2 a, p. 64 ; tableau 2.23 J, p. 57 | Reformulé : circuits commandés, boîtes contenant un module, unités de commande (symbole 2.23 J) | Corrigé |
| 2 | 87 | « un câble dédié à basse tension » (bus) | Principe physique | Le bus est en très basse tension (TBT), pas en basse tension | P2 | RGIE 2.3.2 (définitions TBT/BT) ; doc. fabricants KNX | « en très basse tension » | Corrigé |
| 3 | 97 | « l’unifilaire montre les relais, télérupteurs et modules » | Obligation présentée | Mélange obligation / bonne pratique | P2 | RGIE 3.1.2.2 a, p. 64 ; 2.23 J | Distinction : unités de commande (symbole J) + relais = bonne pratique | Corrigé |
| 4 | 108 | « Coupez … vérifiez l’absence de tension » | Sécurité | Pas de prévention de la remise en service | P2 | RGIE 5.3.3.1 a.4, p. 157 | Ajout étiquette/cadenas, détecteur adapté | Corrigé |

Affirmations vérifiées sans problème : 16 A max en 1,5 mm², 20 A max en 2,5 mm² → RGIE tableau 4.11 (4.4.1.4, p. 117) ; éclairage et prises sous 30 mA dans le neuf → 4.2.4.3 b, p. 100 ; contrôle des installations neuves et modifications importantes, « ajout d’un circuit » cité comme exemple → définition « Modification importante », p. 47 ; 3 000 W ≈ 13 A (230 V) → calcul ; commande/puissance séparées, télérupteur, minuterie → principe ; panne réseau → bonne pratique.
Incertitudes : aucune.

### relais-connectes — Relais et modules connectés

Fichiers : learn/fr/relais-connectes.html
Affirmations vérifiées : 30 (dont réglementaires : 6)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 100 | « un module enfermé dans une boîte … chauffe » | Recommandation du fabricant | Incomplet : pas de renvoi aux conditions de montage (déclassement en température) ; accessibilité des connexions non mentionnée | P2 | RGIE 5.1.5.1, p. 128 (accès aux connexions) ; notices fabricants | Ajout : respecter notice (boîte, température, charge), connexions accessibles | Corrigé |
| 2 | — | (absent) conformité des produits | Obligation réglementaire | Aucun mot sur la conformité du matériel (modules sans marque fréquents) | P2 | RGIE 5.1.3.1, p. 127 | Ajout puce « Matériel conforme » (marquage CE, notice) | Corrigé |
| 3 | 109 | « il doit apparaître sur le schéma unifilaire … la position du module sur le plan » | Obligation réglementaire | Justification à préciser : boîtes de connexion obligatoires sur unifilaire et plan, symbole 2.23 J ; le module lui-même = bonne pratique | P2 | RGIE 3.1.2.2 a, 3.1.2.3 a, p. 64-65 ; tableau 2.23 J, p. 57 | Reformulé avec ces références | Corrigé |
| 4 | 116 | « le bleu est réservé au neutre, même pour quelques centimètres » | Obligation réglementaire | Vrai seulement dans un circuit avec neutre (en 3×230 V sans neutre, le bleu d’un câble multipolaire peut servir à autre chose, sauf PE) | P3 | RGIE 5.1.6.2, p. 128-129 | Précisé + « la couleur ne prouve pas la fonction » | Corrigé |
| 5 | 94 | « coupez … vérifiez l’absence de tension » | Sécurité | Pas de prévention de la remise en service | P2 | RGIE 5.3.3.1 a.4, p. 157 | Ajouté | Corrigé |

Affirmations vérifiées sans problème : besoin de phase + neutre, module sans neutre (puissance minimale, scintillement, bypass) → principe / doc. fabricants ; schéma SVG (L, N, S, O, PE direct au luminaire) cohérent avec la légende et le tableau ; 16 A max en 1,5 mm² → tableau 4.11, p. 117 ; module 10 A sur circuit 20 A → principe ; contacteur pour fortes charges → bonne pratique ; câblage en étoile pour modules DIN → principe ; mélange de deux circuits → RGIE 3.2.4.1, p. 67 ; contrôle des modifications importantes → définition p. 47.
Incertitudes : le classement d’un module caché comme « unité de commande » au sens de 3.1.2.1 est une interprétation (à valider par un organisme agréé).

### bus-knx — Les bus filaires (KNX et autres)

Fichiers : learn/fr/bus-knx.html
Affirmations vérifiées : 32 (dont réglementaires : 7)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 17, 79 | « Cela dépend de l’isolation du câble bus et des consignes du fabricant » (même tube que le 230 V) | Obligation réglementaire | La règle existe dans le RGIE et n’était pas citée : séparation de protection TBTS (10 mm, isolation supplémentaire, ou isolation pour la tension la plus élevée) | P1 | RGIE 4.2.5.3 b et c, p. 105-106 ; 3.3.3, p. 68 | FAQ et puce réécrites avec 4.2.5.3 c ; tubes séparés = bonne pratique | Corrigé |
| 2 | 28 | « Le plus répandu des bus ouverts … une norme internationale » | Affirmation non sourcée | Superlatif invérifiable ; numéro de norme non cité | P3 | — | « L’un des bus ouverts les plus répandus, un système normalisé » | Corrigé |
| 3 | 68 | « un appareil en panne n’empêche pas les autres de fonctionner » | Principe | Absolu : un court-circuit du câble met la ligne hors service | P3 | Principe physique | « en général » + exception | Corrigé |
| 4 | 71 | « alimenté en très basse tension de sécurité, environ 30 V » | Recommandation du fabricant | Source non dite ; conséquence RGIE (pas de liaison à la terre) absente | P3 | Doc. ABB / Siemens (SELV 30 V DC, bus non mis à la terre) ; RGIE 4.2.5.5 c, p. 107 | Attribué aux fabricants + 4.2.5.5 c | Corrigé |
| 5 | 77 | « pas de boucle » | Recommandation du fabricant | Source à dire | P3 | Doc. ABB (ligne, arbre, étoile), Siemens (anneau interdit) | « selon les fabricants » | Corrigé |
| 6 | 85, 106 | « Le schéma unifilaire doit montrer ces actionneurs » ; « l’organisme agréé demandera des schémas où figurent les actionneurs » | Obligation présentée | Les actionneurs ne sont pas listés en 3.1.2.2 a ; c’est une nécessité pratique (symbole hors tableau avec légende, 3.1.2.1) | P2 | RGIE 3.1.2.1, 3.1.2.2 a, p. 61-64 | Reformulé | Corrigé |
| 7 | 23 | Source « Documentation de l’association KNX » | Source | Non consultée ; vérification faite sur la doc. ABB et Siemens | P3 | — | Libellé de source corrigé | Corrigé |

Affirmations vérifiées sans problème : paire rouge (+) / noire (−) pour le bus, jaune/blanc en réserve, câble 2×2×0,8 → doc. fabricants (ABB, Siemens, câbliers) ; gaine souvent verte → catalogues de câbles (pratique courante) ; adresses physiques et de groupe, ETS de l’association KNX → doc. KNX/fabricants ; actionneurs au tableau et circuits en étoile → principe ; 16 A/1,5 mm², 20 A/2,5 mm² → tableau 4.11 ; 30 mA (4.2.4.3 b) ; four 3 500 W > 10 A → calcul ; DALI, Modbus, Niko Home Control, Loxone → descriptions génériques correctes.
Incertitudes : longueurs maximales de ligne (non chiffrées dans l’article, à juste titre) ; l’exception de 4.5.4 (« lieux ordinaires … non accessibles au public ») rendrait 4.5.4 inapplicable dans un logement : interprétation à faire valider ; seule 4.2.5.3 c est citée. Norme EN 50090 non consultée (non citée).

### sans-fil-zigbee-wifi — Zigbee, Z-Wave, Wi-Fi : le sans-fil

Fichiers : learn/fr/sans-fil-zigbee-wifi.html
Affirmations vérifiées : 26 (dont réglementaires : 3)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 76 (corps l. 50) | « Les relais ajoutés doivent figurer sur le schéma unifilaire » + sécurité sans prévention de remise en service | Obligation présentée | Voir relais-connectes #3 ; consignation | P2 | RGIE 2.23 J, 3.1.2.3 a ; 5.3.3.1 a.4 | Symbole « commande sans fil » du tableau 2.23 J, boîte sur le plan, consignation | Corrigé |

Affirmations vérifiées sans problème : Zigbee 2,4 GHz, Z-Wave bande 868 MHz en Europe, Thread 2,4 GHz IP avec routeur de bordure, Matter au-dessus de Wi-Fi/Thread/Ethernet, appareils sur pile non routeurs → spécifications publiques des alliances (CSA, Z-Wave Alliance, Thread Group) ; équipements radio soumis aux règles européennes → directive RED (principe) ; schéma SVG maillé/étoile cohérent.
Incertitudes : affirmations comparatives (portée Z-Wave, prix) = simplifications pédagogiques, non sourcées précisément.

### preparer-cablage-domotique — Préparer le câblage pour la domotique

Fichiers : learn/fr/preparer-cablage-domotique.html
Affirmations vérifiées : 27 (dont réglementaires : 7)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 32 | « mélanger le neutre d’un circuit et la phase d’un autre provoque des déclenchements » | Principe / obligation | Formulation absolue ; obligation RGIE non citée | P3 | RGIE 3.2.4.1, p. 67 | « peut faire déclencher » + 3.2.4.1 | Corrigé |
| 2 | 69 | « ne mélangez pas des circuits différents dans un même câble sans y avoir réfléchi » | Bonne pratique | Vague ; la règle réelle est l’isolation pour la tension la plus élevée | P2 | RGIE 5.2.1.3, p. 130 | Reformulé + repérage aux deux extrémités | Corrigé |
| 3 | 90 | « câbles réseau séparés des câbles 230 V » | Bonne pratique | Exigence générale du RGIE non citée | P3 | RGIE 3.3.3, p. 68 | Ajout | Corrigé |
| 4 | 98 | Sécurité | Sécurité | Consignation absente | P2 | RGIE 5.3.3.1 a.4 | Ajouté | Corrigé |

Affirmations vérifiées sans problème : 16 A/1,5 mm², 20 A/2,5 mm² → tableau 4.11 ; 30 mA, 8 circuits terminaux → 4.2.4.3 b, p. 100 ; tout reporter sur plan et unifilaire, boîtes → 3.1.2.2 a / 3.1.2.3 a ; contrôle → p. 47 ; neutre en attente, boîtes profondes, tubes de réserve, tire-fil, Cat 6 → bonnes pratiques ; port de données du compteur numérique → GRD.
Incertitudes : aucune.

### scenarios-home-assistant — Scénarios, capteurs et Home Assistant

Fichiers : learn/fr/scenarios-home-assistant.html
Affirmations vérifiées : 25 (dont réglementaires : 2)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 107 | « une borne de recharge … on utilise un contacteur au tableau, piloté par le module » | Bonne pratique | Couper une borne par contacteur n’est pas la méthode prévue ; la borne se module par son interface (courant de charge) | P2 | Doc. fabricants de bornes ; RGIE 7.22.3 (circuit dédié), p. 248 | Distinction chauffe-eau (contacteur) / borne (interface du fabricant) | Corrigé |
| 2 | 114 | Sécurité | Sécurité | Consignation absente | P2 | RGIE 5.3.3.1 a.4 | Ajouté | Corrigé |

Affirmations vérifiées sans problème : 2 400 W ≈ 10 A → calcul ; port P1 activé auprès du GRD → pratique des GRD belges ; local vs cloud, vie privée → bonnes pratiques ; Home Assistant logiciel libre local → doc. officielle ; protections jamais remplacées par un logiciel → principe.
Incertitudes : modalités exactes d’activation du port P1 par région (Fluvius, ORES, RESA, Sibelga) non revérifiées.

### lire-unifilaire — Lire un schéma unifilaire

Fichiers : learn/fr/lire-unifilaire.html
Affirmations vérifiées : 34 (dont réglementaires : 16)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 79-80 (SVG) | Point lumineux D1 dessiné en cercle barré | Symbole RGIE | Dans le tableau 2.23 (G) et la figure 3.1, le point lumineux est une croix au bout de la canalisation ; le cercle barré = lampe témoin/projecteur. Voltaplan (symbols.tsx) dessine bien une croix | P1 | Tableau 2.23 G, p. 54 ; figure 3.1, p. 62 | Croix au bout du trait | Corrigé |
| 2 | 62-66 (SVG) | Prises C1–C5 dessinées en simples points | Symbole RGIE | Texte et aria-label parlent de « symboles de prises » | P3 | Tableau 2.23 F, p. 53 | Symboles de socle avec terre | Corrigé |
| 3 | 97-106 | Liste des étiquettes | Obligation réglementaire | Contenu minimal de l’unifilaire (3.1.2.2 a) incomplet : boîtes de connexion/dérivation, interrupteurs, appareils fixes, sources, type des protections | P2 | RGIE 3.1.2.2 a, p. 64 | Paragraphe ajouté | Corrigé |
| 4 | 19 | FAQ « remis lors du contrôle » | Obligation réglementaire | Imprécis : signés si conforme, remis au propriétaire ; copie gardée 5 ans par l’OA, duplicata possible | P3 | RGIE 3.1.2.1, p. 61 | FAQ complétée | Corrigé |
| 5 | 27 | « premier document que regarde l’organisme agréé » | Affirmation non sourcée | Invérifiable | P3 | — | « L’organisme agréé le compare à l’installation » | Corrigé |
| 6 | 94 | « Un interrupteur … porte le numéro du point qu’il commande » | Obligation réglementaire | Le texte le dit pour le plan de position ; la figure 3.1 l’applique à l’unifilaire | P3 | RGIE 3.1.2.1, p. 61 ; figure 3.1 | Précisé | Corrigé |
| 7 | 30 | « une barre oblique suivie d’un chiffre » | Symbole RGIE | Variante « /// » pour 3 conducteurs non citée ; n = nombre total | P3 | Tableau 2.23 C, p. 51 | Complété | Corrigé |
| 8 | 114 | Sécurité | Sécurité | Consignation absente | P2 | 5.3.3.1 a.4 | Ajouté | Corrigé |

Affirmations vérifiées sans problème : unifilaire de bas en haut comme la figure 3.1 (vérifié sur l’image, alimentation en bas) et sens non imposé par le texte → 3.1.2.1, figure 3.1 ; lettre par circuit, numéro d’ordre depuis la protection, tension et nature du courant → 3.1.2.1, p. 61 ; différentiel général ≤ 300 mA → 4.2.4.3 b, p. 100 ; sectionneur de terre et prise de terre figurés → figure 3.1 ; « partie ancienne » avant le 1/10/1981 → 3.1.2.1, p. 62 ; étiquettes « C20 », « 40/0.3A type A », « XVB 3G2,5 » → tableau 2.23 D/C, p. 51-52 ; symboles du tableau 2.23 → 3.1.2.1 ; 1,5 mm² derrière 20 A incohérent → tableau 4.11.
Incertitudes : aucune.

### plan-de-position — Le plan de position

Fichiers : learn/fr/plan-de-position.html
Affirmations vérifiées : 27 (dont réglementaires : 12)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 64-65 (SVG) | Point lumineux D1 en cercle barré | Symbole RGIE | Doit être une croix (voir lire-unifilaire #1) ; la figure 3.2 dessine des croix | P1 | Tableau 2.23 G, p. 54 ; figure 3.2, p. 63 | Croix | Corrigé |
| 2 | 33-42 | Liste des éléments du plan | Obligation réglementaire | Boîtes de connexion et unités de commande manquantes ; « à l’échelle » est dans la définition RGIE d’un plan | P2 | RGIE 3.1.2.3 a, p. 65 ; chapitre 2.12 (définition « Plan »), p. 48 | Complété | Corrigé |
| 3 | 97 | Mise à jour du plan | Obligation réglementaire | Ne disait pas que même une modification non importante se reporte sur le plan | P2 | RGIE 3.1.2.1, p. 62 | Ajouté | Corrigé |
| 4 | 93-94 | Installation existante | Dérogation réglementaire | Dérogation 8.2.1 point 7 (plan simplifié, repérage non nécessaire, correspondance non exigée) absente | P2 | RGIE 8.2.1 point 7, p. 275 | Paragraphe ajouté | Corrigé |
| 5 | 94 | « on identifie son circuit en coupant les disjoncteurs un par un » | Sécurité | Méthode d’identification à préciser pour un non-qualifié | P3 | Principe | Avec testeur ou lampe, sans démonter | Corrigé |
| 6 | 98 | Sécurité | Sécurité | Consignation absente | P2 | 5.3.3.1 a.4 | Ajouté | Corrigé |

Affirmations vérifiées sans problème : même repère que l’unifilaire, interrupteur au numéro du point commandé → 3.1.2.1, p. 61 ; numéro, version, date → 3.1.2, p. 61 ; symboles orientés selon le mur, aucune protection dessinée → figure 3.2 (vérifiée sur l’image) ; légende pour les symboles hors tableau → 3.1.2.1 ; symbole de prise avec terre du SVG conforme (tableau 2.23 F) ; une page par niveau, trajets indicatifs → bonnes pratiques.
Incertitudes : aucune.

### symboles-electriques — Les symboles électriques

Fichiers : learn/fr/symboles-electriques.html
Affirmations vérifiées : 40 (dont réglementaires : 30)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 51-56, 91 | « Point lumineux : un cercle barré d’une croix » (texte, SVG, aria-label) | Symbole RGIE | Faux : croix au bout de la canalisation (tableau 2.23 G et figures 3.1/3.2) ; le cercle barré = lampe témoin, projecteur | P1 | Tableau 2.23 G, p. 54 ; E, p. 52 | Texte, dessin et aria-label corrigés | Corrigé |
| 2 | 92 | « un trait : unipolaire » | Symbole RGIE | Le symbole général du tableau n’a pas de trait ; un trait apparaît sur l’unipolaire à ouverture retardée, deux sur le bipolaire, trois sur le tripolaire | P3 | Tableau 2.23 E, p. 52 | Précisé | Corrigé |
| 3 | 17, 23, 31 | « s’inspire de la norme IEC 60617 » | Affirmation non sourcée | Le RGIE ne se réfère pas à l’IEC 60617 ; norme non consultée | P2 | Chapitre 2.13, p. 50 | « ressemblent à » ; source requalifiée ; ajout « liste non limitative » | Corrigé |
| 4 | 38-46 | Familles du tableau | Symbole RGIE | Incomplètes (prise data, avec interrupteur, borne de recharge, redresseur, hacheur, extension par bouton-poussoir) ; « variateur » = « gradateur » dans le tableau | P3 | Tableau 2.23 E-J, p. 52-57 | Complété | Corrigé |
| 5 | 96 | Différentiel « tore … pointillés » | Symbole RGIE | Correct, mais l’exemple du tableau est un disjoncteur avec « 40/0.3A type A » | P3 | Tableau 2.23 D, p. 51 | Précisé | Corrigé |

Affirmations vérifiées sans problème (sur les images du PDF) : socle de prise (arc relié à un trait), multiple (arcs empilés), terre (barre), étanche (« h »), protection enfant ; boîte de dérivation (cercle à point noir), boîte (cercle seul) ; disjoncteur (levier à carré noir) ; fusible (rectangle sur le fil) ; prise de terre (barres décroissantes) ; moteur (cercle et M) ; va-et-vient (levier des deux côtés) ; minuterie (« t ») ; télérupteur (deux équerres) ; taque (trois points) ; symboles orientés selon le dessin (figures 3.1/3.2) ; symbole hors tableau permis avec légende → 3.1.2.1, p. 61 ; pôles en texte (« M₂ + 0 ») et type de différentiel en texte → tableau 2.23 D. Le dessin des 8 symboles du SVG correspond maintenant à leur description.
Incertitudes : aucune pour le tableau 2.23 ; IEC 60617 non consultée.

### organiser-tableau — Organiser le tableau électrique

Fichiers : learn/fr/organiser-tableau.html
Affirmations vérifiées : 33 (dont réglementaires : 18)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 86 | « lave-linge … avec un différentiel de type A plutôt que AC » | Obligation réglementaire | Obligation affaiblie en conseil et restreinte : en domestique, TOUS les différentiels sont au moins de type A | P1 | RGIE 5.3.5.3 a, p. 168 | Phrase dédiée « au moins de type A » | Corrigé |
| 2 | 98 | Circuits dédiés : « four … chauffe-eau, pompe à chaleur, chaudière, borne » | Obligation réglementaire | Liste mélangée : obligatoires = appareil ≥ 2 600 W, lave-linge, lave-vaisselle, sèche-linge, cuisinière, taque, four, chauffage électrique fixe ; borne (par point de connexion) ; le reste = bonne pratique | P1 | RGIE 5.2.1.2, p. 129-130 ; 7.22.3, p. 248 | Réécrit en distinguant | Corrigé |
| 3 | 99 | « Sur un réseau 3 × 230 V, les disjoncteurs doivent être bipolaires » | Obligation réglementaire | Incomplet : en domestique, détection de surintensité sur les deux conducteurs de tout circuit monophasé (sauf différentiel à détection de surintensité coupant les deux) | P2 | RGIE 4.4.4.2, p. 119 | Réécrit | Corrigé (à valider, voir anomalie moteur 3) |
| 4 | 34 | Différentiel général « 300 mA au plus » | Obligation réglementaire | Manquaient : à l’origine, ≥ 40 A, fonction de sectionnement | P2 | RGIE 4.2.4.3 b, p. 100 ; 5.3.5.3 a, p. 168 ; 5.3.3.1 a.3 | Complété | Corrigé |
| 5 | 13, 106 | Étiquettes = bonne pratique | Obligation réglementaire | Le repérage clair et indélébile des protections et la tension sur chaque tableau sont obligatoires | P2 | RGIE 3.1.3.1, p. 65 ; 3.1.3.3 a, p. 66 | Ajouté | Corrigé |
| 6 | 17 | FAQ « tableau fait ou refait depuis le 1er juin 2023 » | Dérogation réglementaire | La date porte sur l’exécution de l’installation ; la dérogation couvre aussi les modifications non importantes | P2 | RGIE 4.2.4.3 b, p. 100 ; dérogation « juin 2020 », p. 219 | Reformulé | Corrigé |
| 7 | 89 | « un différentiel placé derrière un autre doit être plus sensible » ; « déclencheraient ensemble » | Bonne pratique | Présenté comme règle ; le RGIE domestique ne fixe pas la sélectivité des différentiels | P3 | RGIE (absence de règle en 4.2.4.3) | « règle de l’art », « risquent de » | Corrigé |
| 8 | 79 | « un différentiel quatre pôles en occupe quatre » | Simplification | Dépend du produit | P3 | Fiches fabricants | « souvent » | Corrigé |
| 9 | 23 | Source « src/rules/be/rgie.ts » | Source | Le code n’est pas une source réglementaire | P3 | Consigne | Requalifiée | Corrigé |
| 10 | 107 | Sécurité | Sécurité | Consignation | P2 | 5.3.3.1 a.4 | Ajouté | Corrigé |

Affirmations vérifiées sans problème : circuits sous 30 mA (prises, éclairage, salle de bain, lave-linge, sèche-linge, lave-vaisselle) et 8 circuits terminaux depuis le 1/6/2023 → 4.2.4.3 b et dérogation p. 219 ; 300 mA en amont non sélectif sauf type S → principe ; modules de 17,5 mm → pratique (DIN) ; répartition éclairage, congélateur, extérieur → bonnes pratiques ; SVG (arbre général → 30 mA → disjoncteurs, « au plus huit circuits ») cohérent.
Incertitudes : interprétation de 4.4.4.2 pour les disjoncteurs 1P+N en réseau avec neutre (voir anomalie 3).

### dossier-installation — Le dossier de l’installation

Fichiers : learn/fr/dossier-installation.html
Affirmations vérifiées : 30 (dont réglementaires : 22)
Statut : Validé avec réserves

| # | Lignes | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | 10, 30 | « Le dossier réunit au minimum le schéma unifilaire et les plans » | Obligation réglementaire | Le dossier domestique comprend aussi le(s) rapport(s) de contrôle, éventuellement rapports de visite, garanties du matériel, descriptions des petites modifications ; deux exemplaires | P1 | RGIE 9.1.2, p. 289 | Retenir et corps réécrits | Corrigé |
| 2 | 14, 102 | « chaque modification donne une nouvelle version » | Obligation réglementaire | Modification non importante : pas de nouvel unifilaire obligatoire, description succincte datée et signée, mais plan de position toujours à jour | P2 | RGIE 3.1.2.1, p. 62 | Réécrit (deux cas) | Corrigé |
| 3 | 18, 101 | « Le numéro est donné par celui qui établit le dossier, pas par l’organisme agréé » | Choix présenté comme règle | Le RGIE ne dit pas qui numérote | P2 | RGIE 3.1.2, p. 61 | « en pratique » | Corrigé |
| 4 | 12, 17, 93 | Date et signature de l’OA | Obligation réglementaire | Conditionnelle : seulement « en cas de conformité » | P3 | RGIE 3.1.2.1, p. 61 | Précisé | Corrigé |
| 5 | 98 | Caractéristiques sur l’unifilaire | Obligation réglementaire | Manquaient : type des protections, interrupteurs, boîtes, appareils fixes, sources | P2 | RGIE 3.1.2.2 a, p. 64 | Complété | Corrigé |
| 6 | 19 | Schémas perdus | Obligation réglementaire | Duplicata possible pendant 5 ans auprès de l’OA non mentionné | P3 | RGIE 3.1.2.1, p. 61 | Ajouté | Corrigé |
| 7 | — | (absent) installations anciennes | Dérogation réglementaire | Dérogations 8.2.1 point 7 (schémas simplifiés, contenu minimal) et 8.2.2 point 7 (mentions tolérées absentes) absentes | P2 | RGIE 8.2.1 point 7, p. 275 ; 8.2.2 point 7, p. 278 | Section ajoutée | Corrigé |
| 8 | 115 | « avant sa mise en service » | Terminologie | Le RGIE dit « mise en usage » | P3 | Définition p. 47 | Corrigé | Corrigé |

Affirmations vérifiées sans problème : numéro, version et date → 3.1.2, p. 61 ; nom, qualité, TVA, adresse → 3.1.2.1, p. 61 ; tension et nature du courant ; lettres et numéros → 3.1.2.1 ; symboles 2.23 et légende → 3.1.2.1 ; « partie ancienne » → p. 62 ; responsable de l’exécution établit les schémas → 3.1.2.1 ; transmettre le dossier au nouveau propriétaire → 9.1.2 point 3 ; cartouche du SVG cohérent.
Incertitudes : « un particulier peut réaliser lui-même son installation » : aucune interdiction trouvée dans le Livre 1 pour le domestique, mais d’autres réglementations (régionales, assurances) ne sont pas couvertes.

### Anomalies du moteur de Voltaplan

1. **Type A pour tous les différentiels domestiques** — `src/rules/be/rgie.ts` l. 334-337 : `R-RCD-TYPE-A` n’est émis que pour un 30 mA de type AC protégeant un lave-linge / sèche-linge / lave-vaisselle. RGIE 5.3.5.3 a (p. 168) : « Les dispositifs … placés dans les installations domestiques sont au moins du type A ». Correction proposée : signaler tout différentiel `rcdType === 'AC'` d’une partie neuve (non-conformité) ; pour l’existant, aucune dérogation au type A n’apparaît en 8.2.1/8.2.2 (seulement < 40 A et marquage) → à valider par un spécialiste avant d’en faire une non-conformité. Texte `rule.R-RCD-TYPE-A` (fr.ts l. 1275) à généraliser. Test : projet neuf avec un différentiel général 300 mA type AC sans appareil de lavage → `R-RCD-TYPE-A` attendu.
2. **Circuits dédiés** — `src/model/schema.ts` l. 85-96 : `DEDICATED_CIRCUIT_APPLIANCES` inclut `waterHeater`, `heatPump`, `boiler` comme obligation (non-conformité `R-DEDICATED-CIRCUIT`), alors que le RGIE 5.2.1.2 (p. 129-130) impose un circuit dédié aux appareils fixes ≥ 2 600 W, au lave-linge, lave-vaisselle, sèche-linge, cuisinière, taque, four et au chauffage électrique fixe ; et 7.22.3 (p. 248) à chaque point de connexion de borne. Correction proposée : rendre l’obligation dépendante de la puissance (≥ 2 600 W) pour chauffe-eau, PAC, chaudière (sinon simple conseil) et ajouter la règle générique ≥ 2 600 W. Tests : chauffe-eau 2 000 W partagé → pas de non-conformité ; chauffe-eau 3 000 W partagé → non-conformité.
3. **Détection de surintensité sur les deux conducteurs (4.4.4.2)** — `src/rules/be/rgie.ts` l. 192-196 : `R-POLES-NO-NEUTRAL` ne vise que les réseaux sans neutre. RGIE 4.4.4.2 (p. 119) : « Dans les circuits monophasés … des installations domestiques, une détection de surintensité est réalisée sur les deux conducteurs actifs » (sauf différentiel à détection de surintensité coupant les deux). Un disjoncteur 1P+N à un seul pôle protégé sur un réseau avec neutre serait donc aussi visé. À faire valider par un spécialiste (pratique des 1P+N en Belgique) avant d’étendre la règle. Test proposé : réseau 3N×400 V, circuit monophasé avec disjoncteur `poles: '1P+N'` (pôle N non protégé) → constat attendu.
4. **Différentiel général ≥ 40 A** — RGIE 5.3.5.3 a : « ceux qui sont placés en tête de l’installation … au moins égale à 40 A » ; je n’ai pas trouvé de règle correspondante dans `rgie.ts` (recherche non exhaustive). À vérifier ; dérogations en 8.2.1/8.2.2 point 2 pour l’existant.

### Références à ajouter à rgieRefs

Les références suivantes, vérifiées, sont citées dans les articles et refusées par le validateur (les autres citées étaient déjà dans la liste mise à jour) :
- **3.1.3.1** — p. 65 — « Les dispositifs de commande, de protection et de sectionnement des circuits sont repérés de manière claire, bien visible et indélébile ».
- **3.1.3.3 a** — p. 66 — « La tension d’alimentation est indiquée clairement de manière apparente sur chaque tableau ».
- **7.22.3** — p. 248 — « Un circuit dédié est prévu pour chaque point de connexion. »
- **8.2.2** — p. 278 (point 7) — « tolérer l’absence des informations suivantes sur les schémas unifilaires et les plans de position ».
- **9.1.2** — p. 289 — « Le dossier de l’installation électrique domestique comporte : 1. le ou les schémas unifilaires ».

Aussi cités sous la forme « (3.1.2.3 a) », « (RGIE, 4.2.4.3 b et 5.3.5.3 a) » : déjà dans la liste. Références utilisées dans ce rapport sans être citées dans les articles : 5.3.3.1 a.4 (p. 157, consignation), 2.12 (définition « Plan », p. 48), 2.13 (p. 50).

### Couverture

domotique-introduction | 24 | 0/0/4/0 | Validé avec réserves
relais-connectes | 30 | 0/0/4/1 | Validé avec réserves
bus-knx | 32 | 0/1/1/5 | Validé avec réserves
sans-fil-zigbee-wifi | 26 | 0/0/1/0 | Validé avec réserves
preparer-cablage-domotique | 27 | 0/0/2/2 | Validé avec réserves
scenarios-home-assistant | 25 | 0/0/2/0 | Validé avec réserves
lire-unifilaire | 34 | 0/1/2/5 | Validé avec réserves
plan-de-position | 27 | 0/1/4/1 | Validé avec réserves
symboles-electriques | 40 | 0/1/1/3 | Validé avec réserves
organiser-tableau | 33 | 0/2/5/3 | Validé avec réserves
dossier-installation | 30 | 0/1/4/3 | Validé avec réserves

## Lexique

### Rubrique : Lexique

### lexique — Lexique de l’électricité (152 définitions)

Fichiers : learn/fr/lexique.json (dépôt wt-tauri)
Affirmations vérifiées : 152 définitions, environ 330 affirmations (dont réglementaires : 41)
Statut : Validé avec réserves (39 définitions corrigées, 4 points à faire valider par un spécialiste)

Source : RGIE Livre 1 v07 (livre1.txt). Les pages sont les numéros imprimés. Les termes de la partie 2 (chapitre « Termes et définitions ») ont été recherchés un par un (p. 8 à 48).

| # | id | Texte initial (extrait) | Classe | Problème | Criticité | Source | Correction | Statut |
|---|---|---|---|---|---|---|---|---|
| 1 | electrocution | « Le différentiel à haute sensibilité sert précisément à l’éviter en coupant très vite un courant de fuite » | Simplification pédagogique | Fausse sécurité : laisse croire que le différentiel garantit contre l’électrocution. Il ne réagit pas à un contact phase-neutre. « Courant de fuite » désigne, dans le RGIE, le courant d’un circuit sain | P2 | RGIE 2.6.4, p. 34 (haute sensibilité ≤ 30 mA) ; 2.4.1, p. 24 (courant de fuite : « s’écoule dans un circuit électriquement sain ») | « réduit fortement ce risque en coupant très vite, mais il ne protège pas de tout, par exemple d’un contact entre phase et neutre » | Corrigé |
| 2 | differentiel | « compare le courant qui part par la phase et celui qui revient par le neutre » | Principe physique | Il manque la limite essentielle (pas de réaction à un contact phase-neutre) et le cas des réseaux sans neutre | P3 | RGIE 2.6.2, p. 33 (courant différentiel résiduel : somme sur « tous les conducteurs actifs ») | Ajout de « (ou par les autres phases) » et de « Il ne réagit pas à un contact entre phase et neutre » | Corrigé |
| 3 | boucle-de-terre | « C’est la solution habituelle en construction neuve en Belgique » | Obligation réglementaire | Une obligation est présentée comme une simple habitude | P2 | RGIE 5.4.2.1 b.1.1, p. 174 : « Pour tout nouveau bâtiment, dont le fond de fouille […] atteint au moins 60 cm » | La boucle est imposée pour tout nouveau bâtiment d’habitation dont les fondations atteignent au moins 60 cm ; position « à la verticale des murs extérieurs » | Corrigé |
| 4 | differentiel-type-a | (aucune mention de l’obligation) | Obligation réglementaire | L’obligation domestique du type A minimum est omise | P2 | RGIE 5.3.5.3 a, p. 168 : « placés dans les installations domestiques sont au moins du type A » | Ajout : le RGIE impose au moins le type A, le type AC ne suffit pas | Corrigé |
| 5 | monophase | « ou par deux phases sur les anciens réseaux 230 V sans neutre » | Simplification pédagogique | Les réseaux 3 × 230 V ne sont pas « anciens » : ils sont encore présents dans une partie de la Belgique | P2 | RGIE 2.2.1.2 b.3, p. 13 (schéma IT) ; consigne (réseaux belges) | « entre une phase et le neutre (réseau 3N × 400 V) ou entre deux phases (réseau 3 × 230 V sans neutre, encore présent…) ; 230 V dans les deux cas » | Corrigé |
| 6 | neutre | « Il est relié à la terre au niveau du transformateur dans la plupart des réseaux » | Principe physique | Imprécis : vrai pour les réseaux 3N × 400 V (TT/TN) ; les réseaux 3 × 230 V (IT) ne distribuent pas de neutre. Ne dit pas que le neutre est un conducteur actif et peut être sous tension (risque pour un débutant) | P2 | RGIE 2.4.1, p. 22 (conducteur actif : « les conducteurs de ligne et neutre ») ; 2.2.1.2 b, p. 13 ; 5.1.6.2, p. 128 (bleu réservé au neutre) | Réécrit : conducteur actif repéré en bleu ; relié à la terre au transformateur en 3N × 400 V ; pas de neutre distribué en 3 × 230 V ; peut être sous tension ; ne remplace jamais le PE en installation domestique | Corrigé |
| 7 | phase | « repéré en brun, noir ou gris. C’est lui que l’interrupteur doit couper » | Exigence normative | Les couleurs de phase ne sont pas fixées par le RGIE (seuls le vert-jaune et le bleu le sont) ; il manque l’avertissement « la couleur ne prouve pas la fonction » | P2 | RGIE 2.4.1, p. 22 (conducteur de ligne) ; 5.1.6.2, p. 128 | « en général repéré en brun, noir ou gris […] La couleur d’un fil ne prouve pas sa fonction : on vérifie avec un appareil adapté » | Corrigé |
| 8 | consignation | « couper, verrouiller ou signaler, puis vérifier l’absence de tension » | Obligation réglementaire | « ou » affaiblit l’exigence : le RGIE demande de verrouiller de préférence ET de poser des panneaux d’interdiction | P2 | RGIE 9.3.4.2 d, p. 293-294 : « de préférence par verrouillage » ; « Des panneaux d’interdiction doivent être mis en place » | « couper (séparer), verrouiller l’organe de coupure si possible et le signaler par un panneau, puis vérifier l’absence de tension » | Corrigé |
| 9 | absence-de-tension | « C’est le geste obligatoire avant toute intervention » | Obligation réglementaire | Exact sur le fond, mais incomplet : la vérification porte sur tous les conducteurs actifs, neutre compris, après séparation et protection contre la remise sous tension | P3 | RGIE 9.3.4.2 e, p. 294 : « sur tous les conducteurs actifs » | « qu’aucun conducteur actif (phases et neutre) n’est sous tension, après avoir coupé le courant et empêché sa remise. Le RGIE l’impose avant tout travail hors tension » | Corrigé |
| 10 | tbts | « produite par un transformateur de sécurité […] qui ne présente pas de danger d’électrisation au contact » | Simplification pédagogique | Formulation absolue. Le RGIE définit la TBTS comme une tension qui ne dépasse pas la tension limite UL, même en cas de défaut. UL dépend de l’état de la peau (BB1/BB2/BB3) ; il existe d’autres sources que le transformateur | P2 | RGIE 2.3.1, p. 21 (définition TBTS) ; 2.4.1 tableau 2.3, p. 26 (UL) ; 4.2.5.3 a, p. 106 (sources) | « reste sous un seuil jugé non dangereux (fixé par le RGIE selon que la peau est sèche, mouillée ou immergée), même en cas de défaut ; source séparée, le plus souvent un transformateur de sécurité » | Corrigé |
| 11 | sensibilite | « (30 mA, 300 mA…) » | Obligation réglementaire (définition) | Les classes de sensibilité définies par le RGIE ne sont pas données (consigne : définitions RGIE) | P3 | RGIE 2.6.4, p. 34 : haute sensibilité « au plus égal à 30 mA » ; moyenne > 30 mA et ≤ 1000 mA | Ajout : haute sensibilité ≤ 30 mA (en alternatif) ; moyenne > 30 mA jusqu’à 1 000 mA (ex. 300 mA) | Corrigé |
| 12 | circuit-specialise | « Circuit réservé à un seul gros appareil (cuisinière, lave-linge, chauffe-eau, borne de recharge…) » | Obligation réglementaire | Le RGIE parle de « circuit dédié », qui peut alimenter un ou plusieurs appareils d’un même usage. Les cas imposés ne sont pas cités | P3 | RGIE 2.6.1, p. 32 (circuit dédié : « un ou plusieurs appareils […] usage spécifique ») ; 5.2.1.2, p. 129-130 (≥ 2 600 W, lave-linge, lave-vaisselle, sèche-linge, cuisinière, taque, four, chauffage fixe) | Réécrit avec le terme RGIE et la liste des cas imposés dans un logement | Corrigé |
| 13 | prise-de-courant | « ses alvéoles sont protégées par des obturateurs » | Obligation réglementaire | Présenté comme un fait général. Le RGIE impose en logement le contact de terre (sauf TBTS ou transformateur de séparation individuel) et IPXX-D pour les socles ≤ 16 A / 250 V, ce que l’on obtient en pratique avec des obturateurs | P3 | RGIE 5.3.5.2 a et b, p. 167 : « un degré de protection d’au moins IPXX-D » ; « comportent tous un contact de terre » | « Dans un logement, le RGIE impose ce contact de terre et une protection contre l’accès aux parties sous tension, obtenue en pratique par des obturateurs » | Corrigé |
| 14 | interrupteur | « il coupe toujours la phase, jamais le neutre » | Interdiction réglementaire | Trop absolu : un interrupteur bipolaire coupe aussi le neutre. La règle porte sur la commande unipolaire. Le cas 3 × 230 V manque | P3 | RGIE 5.3.3.2 c, p. 159 : « un dispositif de commande unipolaire n’est pas placé sur le conducteur neutre » | « Un interrupteur unipolaire ne doit jamais être placé sur le neutre : […] il coupe la phase (ou l’une des deux phases sur un réseau 3 × 230 V) » | Corrigé |
| 15 | unipolaire | « ne coupe qu’un seul conducteur, la phase » | Simplification pédagogique | Le cas 3 × 230 V manque | P3 | RGIE 5.3.3.2 c, p. 159 | Ajout de « (ou l’une des deux phases sur un réseau 3 × 230 V) » | Corrigé |
| 16 | boite-de-derivation | « Elle doit rester accessible » | Bonne pratique professionnelle | Présenté comme une obligation : aucune exigence du RGIE trouvée en ce sens pour les boîtes de dérivation. Le RGIE impose qu’elles figurent sur le schéma unifilaire | P2 | RGIE 3.1.2.2 a, p. 64 (schéma unifilaire : « les boîtes de dérivation ») ; 5.2.6.1, p. 139 (aucune exigence d’accessibilité) | « Elle figure sur le schéma unifilaire ; la laisser accessible facilite les contrôles et les dépannages » | Corrigé |
| 17 | test-differentiel | « Il faut l’actionner régulièrement » | Recommandation du fabricant | Présenté comme une obligation. Le RGIE impose seulement que le bouton soit facilement accessible (l’organisme agréé le teste lors des visites) | P2 | RGIE 5.3.5.3 b, p. 168 : « le bouton d’essai soit facilement accessible » ; 6.5.7.2, p. 206 | « Le RGIE demande qu’il reste facilement accessible ; les fabricants recommandent de l’actionner régulièrement » | Corrigé |
| 18 | barrette-de-terre | « Bornier du tableau où se rejoignent le conducteur venant de la prise de terre et tous les conducteurs de protection » | Simplification pédagogique | Confond le sectionneur de terre (la barrette qu’on ouvre pour mesurer) avec la borne principale de terre (où se rejoignent les conducteurs). N’indique pas qu’il faut un outil pour l’ouvrir | P3 | RGIE 2.5, p. 31 (conducteur de terre, sectionneur de terre, borne principale de terre) ; 5.4.3.5, p. 180 : « démontable seulement à l’aide d’un outil » | Réécrit : pièce démontable sur le conducteur de terre, appelée sectionneur de terre par le RGIE, qui ne s’ouvre qu’avec un outil | Corrigé |
| 19 | conducteur-de-protection | « il évacue le courant pour que le différentiel coupe » | Simplification pédagogique | La coupure peut venir d’un autre dispositif (schéma TN, disjoncteur) | P3 | RGIE 2.5, p. 31 (définition du conducteur de protection) | « pour que la protection (dans une maison, en général le différentiel) coupe l’alimentation » | Corrigé |
| 20 | courant-de-defaut | « Courant qui s’échappe du circuit normal, par exemple vers la terre » | Simplification pédagogique | Confond « courant de défaut » (qui résulte d’un défaut) et « courant de défaut à la terre » | P3 | RGIE 2.4.1, p. 24 : « Courant de défaut : le courant résultant d’un défaut » ; « Courant de défaut à la terre » | Réécrit avec les deux définitions RGIE | Corrigé |
| 21 | court-circuit | « le disjoncteur doit couper immédiatement » | Simplification pédagogique | La protection peut être un fusible ; il manque la notion RGIE d’impédance négligeable | P3 | RGIE 2.6.2, p. 33 : « défaut franc ou d’impédance négligeable » | « Contact direct, presque sans résistance […] la protection (disjoncteur ou fusible) doit couper très rapidement » | Corrigé |
| 22 | pouvoir-de-coupure | « Il doit être supérieur au courant de court-circuit possible » | Obligation réglementaire | Le RGIE dit « au moins égal », et admet une protection de pouvoir de coupure inférieur si un dispositif en amont la couvre | P3 | RGIE 4.4.2.1, p. 116-117 : « au moins égal au courant de court-circuit présumé » | « au moins égal […] sauf si une protection placée en amont le couvre » ; étendu au fusible | Corrigé |
| 23 | cable | « Ensemble de plusieurs conducteurs isolés » | Simplification pédagogique | Le RGIE définit le câble avec un ou plusieurs conducteurs (câble unipolaire) | P3 | RGIE 2.7.1, p. 35 : « un ou plusieurs conducteurs isolés » | « Ensemble d’un ou de plusieurs conducteurs isolés » | Corrigé |
| 24 | goulotte | « Profilé en plastique avec couvercle » | Simplification pédagogique | Une goulotte peut être métallique. La règle pour les fils sans gaine manque | P3 | RGIE 2.7.2, p. 37 (définition) ; 5.2.9.6, p. 146 : « à parois pleines et munies d’un couvercle, qu’on ne peut ouvrir qu’à l’aide d’un outil » | « en plastique ou en métal […] pour des fils sans gaine (VOB) hors d’un local électrique : parois pleines et couvercle qui ne s’ouvre qu’avec un outil » | Corrigé |
| 25 | vob | « Il se pose toujours dans des tubes ou des goulottes, jamais directement dans le plâtre » | Interdiction réglementaire | Exact sur le fond (conducteurs à isolation principale seule interdits noyés dans les murs, en apparent ou dans les vides de construction) ; ajout de « ni en apparent » et précision « goulottes fermées » | P3 | RGIE 5.2.9.10 b, p. 147 : « Il est interdit de placer des conducteurs uniquement pourvus d’une isolation principale noyés dans les murs » ; 5.2.9.5, p. 146 ; 5.2.9.9, p. 146 | « dans des tubes (conduits) ou dans des goulottes fermées, jamais directement dans le plâtre ni en apparent » | Corrigé |
| 26 | xvb | « l’enterrer s’il est protégé comme il convient » | Obligation réglementaire | Trop vague, et l’aptitude à la pose en terre dépend de la norme du câble : le RGIE n’admet en terre que des câbles conformes pour cet usage, à 0,60 m, avec une protection adaptée | P2 | RGIE 5.2.9.2 a, p. 142 : « seuls des câbles conformes […] pour cet usage » ; profondeur 0,60 m | « pour l’enterrer, il faut respecter les règles de pose en terre du RGIE (profondeur, protection mécanique) et l’usage prévu par le fabricant » | À valider par un spécialiste (aptitude exacte du XVB à la pose en terre selon sa norme, non consultée) |
| 27 | vtlb | « utilisé pour les rallonges et le raccordement d’appareils mobiles » | Exigence normative | Le VTLB est un câble souple léger (0,75 mm² cité par le RGIE) ; pour les rallonges, on utilise plutôt des câbles souples plus robustes. Désignation belge non définie par le RGIE | P3 | RGIE 8.x, p. 277 (VTLB 0,75 mm² cité) ; norme du câble non consultée | Réécrit : câble souple léger sous gaine PVC, pour petits appareils mobiles ; câble plus robuste pour les usages exigeants | À valider par un spécialiste (correspondance VTLB / norme harmonisée) |
| 28 | code-ean | « du point de raccordement (le compteur) » | Simplification pédagogique | L’EAN identifie le point de raccordement, pas le compteur, qui a son propre numéro ; le RGIE le fait figurer dans les rapports de contrôle | P3 | RGIE 6.5.7.2, p. 206 et 6.4, p. 202 (« code EAN » dans le rapport) ; 6.3, p. 199 | « point de raccordement d’un logement au réseau (et non du compteur lui-même…) […] et dans les rapports de contrôle » | Corrigé |
| 29 | disjoncteur-general | « placé en tête de l’installation […] Son calibre limite la puissance » | Simplification pédagogique | Il fait partie du raccordement du gestionnaire de réseau. Risque de confusion avec une protection des personnes | P3 | Prescriptions Synergrid / GRD (non consultées) ; RGIE 6.5.7.2 b.2, p. 206 (« protection du branchement ») | « placé en tête du raccordement […] la protection des personnes est assurée par les différentiels de l’installation » | À valider par un spécialiste (prescriptions de raccordement Synergrid non consultées) |
| 30 | organisme-agree | « Organisme reconnu par les autorités […] réalise la visite de contrôle » | Obligation réglementaire (définition) | Incomplet par rapport à la définition RGIE (contrôle de conformité avant mise en usage + visites de contrôle ; agrément ministériel) | P3 | RGIE 2.11.2, p. 47 : « chargé des contrôles de conformité avant la mise en usage et des visites de contrôle » ; 6.3, p. 197 (agréés par le Ministre de l’Énergie) | Réécrit selon la définition RGIE | Corrigé |
| 31 | zone-salle-de-bain | « Zones définies autour de la baignoire et de la douche » | Obligation réglementaire (définition) | Les volumes du RGIE ne sont pas nommés ; le volume 2 n’existe pas pour une douche ; des règles s’appliquent à tout le lieu | P3 | RGIE 7.1.3.2, p. 217-218 (volumes 0, 1, 2 ; « Le volume 2 n’est pas défini pour une douche ») ; 7.1.1.1, p. 215 (délimitation du lieu) | « Volumes 0, 1 et 2 définis par le RGIE […] (le volume 2 n’existe pas pour une douche) […] Des règles s’appliquent aussi au reste de la pièce » | Corrigé |
| 32 | tension | « environ 230 V entre phase et neutre dans un logement belge » | Principe physique | Le cas 3 × 230 V manque | P3 | RGIE 2.2.1.2, p. 13 | Ajout de « ou entre deux phases sur un réseau 3 × 230 V » | Corrigé |
| 33 | triphase | « avec ou sans neutre » | Principe physique | Il manque les réseaux belges | P3 | Consigne (réseaux belges) ; RGIE 2.2.1.2 | Ajout de « (en Belgique, 3N × 400 V ou 3 × 230 V) » | Corrigé |
| 34 | alternatif | « change de sens régulièrement, plusieurs dizaines de fois par seconde » | Principe physique | À 50 Hz, le courant change de sens 100 fois par seconde | P3 | Principe physique (2 inversions par période) | « 100 fois par seconde sur le réseau » | Corrigé |
| 35 | fusible | « par un modèle du même calibre » | Bonne pratique professionnelle | Il manque l’avertissement de sécurité (ne jamais mettre un calibre plus fort) | P3 | RGIE 5.2.1.2 a (Iz ≥ IB) ; principe de protection du câble | Ajout de « jamais plus fort » | Corrigé |
| 36 | gaine | « le mot désigne aussi le tube flexible » | Simplification pédagogique | Dans le RGIE, « gaine » a aussi le sens de passage technique ; le tube s’appelle un conduit | P3 | RGIE 2.7.1, p. 35 (gaine d’un câble) ; 2.7.2, p. 37 (gaine : enceinte) | Ajout du sens RGIE | Corrigé |
| 37 | knx | « Norme internationale de domotique filaire » | Simplification pédagogique | KNX existe aussi en radio et sur IP | P3 | Documentation KNX (principe établi) | « surtout filaire » | Corrigé |
| 38 | modulaire | « en modules de 18 mm » | Exigence normative | La valeur courante est de 17,5 à 18 mm selon les fabricants ; norme non consultée | P3 | Documentation de fabricants ; norme DIN/EN non consultée | « modules d’environ 18 mm (17,5 mm chez certains fabricants) » | Corrigé |
| 39 | differentiel-type-b | « Le fabricant de l’appareil indique s’il est nécessaire » | Recommandation du fabricant | Correct ; précision que c’est la notice qui le dit (pas d’exigence du RGIE pour le type B en général) | P3 | RGIE 5.3.5.3 a, p. 168 (seul le type A minimum est imposé) | « C’est la notice du fabricant de l’appareil qui indique s’il est nécessaire » | Corrigé |

Affirmations vérifiées sans problème (113 définitions) :
- Définitions conformes au RGIE, partie 2 : masse (2.4.1, p. 23) ; classe I et classe II, symbole double carré (2.4.3, p. 28) ; indice de protection IP, premier chiffre = solides et accès, second = liquides (2.4.1, p. 26) ; prise de terre (2.5, p. 31) ; liaison équipotentielle, liaison équipotentielle supplémentaire (2.5, p. 32) ; résistance de dispersion de la terre (2.5, p. 32 : « entre la prise de terre et la terre de référence ») ; surintensité, surcharge (2.6.2, p. 33) ; calibre = courant nominal (2.6.2, p. 33) ; conduit (2.7.2, p. 36) ; conducteur, âme (2.7.1, p. 34-35) ; bipolaire (2.9, p. 39, coupure omnipolaire) ; interrupteur-sectionneur (2.9, p. 39, sectionnement) ; plan de position (2.12, p. 48) ; schéma unifilaire, « indispensable au contrôle » (2.12, p. 48 ; 3.1.2.2, p. 64 ; contrôle : 6.4, p. 61) ; transformateur (2.6.3, p. 33).
- Obligations exactes : dossier de l’installation (schéma unifilaire, plan de position, rapport ; transmis au nouveau propriétaire : 9.1.2, p. 289) ; étiquetage et tableau électrique, repérage des protections (3.1.3.1, p. 65) ; rapport de contrôle, infractions et délai (6.4 / 6.5 ; 8.4.2.2, p. 282, 18 mois après une vente) ; conducteur de protection et liaison équipotentielle vert-jaune (5.1.6.2, p. 128) ; RGIE, Livre 1 = basse et très basse tension (titre du Livre) ; multimètre / détecteur adapté pour la VAT (9.3.4.2 e, p. 294, « dispositifs appropriés ») ; ohmmètre hors tension (principe).
- Principes physiques et vocabulaire exacts : ampère (exemple 2 000 W / 230 V ≈ 8,7 A, arrondi « environ 9 A » correct), ampèremètre, chute de tension, courant, cos φ (simplification acceptable), énergie, kilowattheure, fréquence 50 Hz, ohm, résistance, résistance d’isolement, puissance, puissance apparente, voltampère, volt (pile 1,5 V), voltmètre, watt, section, isolant, électrisation, en série, en parallèle, terre, courbe de déclenchement (B, C, D), disjoncteur, disjoncteur différentiel, sélectivité, surtension, parafoudre, piquet de terre (prise de terre complémentaire : 5.4.2.1 b.2, p. 174), compteur, contacteur, contacteur jour/nuit, relais, contact sec, télérupteur, minuterie, temporisation, horloge, bouton-poussoir, voyant, détecteur de mouvement, variateur, sonnette, va-et-vient, navette, inverseur, double allumage, retour lampe, point lumineux, point de commande, prise commandée, obturateur, boîte d’encastrement, borne, borne de connexion, embout, fil (VOB), protection mécanique, rail DIN, tableau divisionnaire, circuit (simplification de « circuit élémentaire », 2.6.1, p. 32), étiquetage, symbole électrique (tableau 2.23, p. 49), précâblage, gestionnaire de réseau (Fluvius, ORES, Sibelga, RESA : exemples exacts, liste non exhaustive).
- Volets et ouvrants : volet roulant, moteur tubulaire, fin de course, inverseur de volet (verrouillage = recommandation du fabricant, présentée sans référence au RGIE), commande centralisée, ouvrant motorisé.
- Domotique : actionneur, capteur, centrale domotique, domotique, bus, Home Assistant, Matter, Thread, Zigbee, Z-Wave, Wi-Fi, maillage, passerelle, module connecté, scène.

Incertitudes (à faire valider par un spécialiste) :
- XVB en pose enterrée : le RGIE (5.2.9.2, p. 142) n’admet en terre que des câbles conformes pour cet usage. L’aptitude du XVB dépend de sa norme (NBN, non consultée) ; la définition renvoie aux règles du RGIE et à la notice du fabricant.
- VTLB : correspondance avec la désignation harmonisée (câble souple léger) non vérifiée dans une norme ; le RGIE cite seulement le VTLB 0,75 mm² (partie 8, p. 277).
- Disjoncteur général (de branchement) : il relève des prescriptions Synergrid et des gestionnaires de réseau (propriété, scellé, calibres), non consultées ; formulation volontairement prudente.
- Prise de courant : le lien IPXX-D / obturateurs et la norme NBN C 61-112-1:2017 (citée en 5.3.5.2 a) n’ont pas été lus dans la norme elle-même.
- Modules de 17,5 / 18 mm : valeur de fabricants, norme non consultée.

### Anomalies du moteur de Voltaplan

- src/rules/be/rgie.ts, ligne 336 : la règle R-RCD-TYPE-A n’est déclenchée que pour un différentiel 30 mA de type AC qui protège un lave-linge, un lave-vaisselle ou un sèche-linge (texte `rule.R-RCD-TYPE-A`, src/i18n/fr.ts ligne 1275). Or le RGIE 5.3.5.3 a (p. 168) impose « au moins du type A » pour **tous** les différentiels des installations domestiques, y compris le différentiel général de 300 mA. Correction proposée : signaler tout différentiel de type AC dans une installation domestique (installation neuve, ou modification importante), en tenant compte des éventuelles dispositions transitoires pour l’existant (partie 8 / 6.5.8, à vérifier). Test de non-régression proposé : une installation domestique neuve dont le différentiel général 300 mA est de type AC, sans appareil humide, doit lever R-RCD-TYPE-A. Point à confirmer par un spécialiste avant de modifier le moteur (dérogations pour l’existant).

### Références à ajouter à rgieRefs

Sans objet pour le lexique (le validateur des références ne s’applique pas à lexique.json). Références citées dans les définitions, en texte libre : 5.4.2.1 (p. 174), 5.3.5.3 (p. 168), 5.3.3.2 (p. 159), 5.3.5.2 (p. 167), 5.2.1.2 (p. 129-130), 9.3.4.2 (p. 293-294), 7.1.3.2 (p. 217-218), 2.11.2 (p. 47).

### Couverture

lexique | 152 définitions (environ 330 affirmations, dont 41 réglementaires) | P0 : 0 / P1 : 0 / P2 : 11 / P3 : 28 | Validé avec réserves
