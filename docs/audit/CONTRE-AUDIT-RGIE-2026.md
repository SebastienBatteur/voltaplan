# Contre-audit indépendant de la rubrique « Apprendre » (2026)

Seconde vérification critique des corrections de l'audit `APPRENDRE-RGIE-AUDIT-2026.md`, réalisée le 27/11/2026 sur la
branche `rgie-precisions` (à partir du commit `81cb5b3`), puis reportée dans `rgie-engine-corrections`.

## Méthode

- **Indépendance** : quatre relecteurs distincts de ceux du premier audit, avec la consigne de ne pas tenir ses
  conclusions pour acquises. Lots : (1) contrôles, dossier, schémas ; (2) protections, tableau, bases ; (3) prises,
  éclairage ; (4) câbles, volets, domotique.
- **Exhaustivité des références** : toutes les phrases des 54 articles qui attribuent quelque chose au RGIE ont été
  extraites automatiquement (213 paires « affirmation ↔ référence », 83 références distinctes, script
  `pairs.py`). Chaque paire a été jugée sur le texte de la section citée, son champ d'application et ses exceptions :
  « Soutient », « Partiel » (vrai mais incomplet, trop large, mauvaise sous-référence) ou « Ne soutient pas ».
  L'existence d'un numéro n'a jamais suffi.
- **Corrections P0/P1 du premier audit** : relues une à une (juste / à compléter / erronée).
- **Obligations sans référence** (« le RGIE impose », « obligatoire », « interdit ») : relues.
- **Source** : RGIE, Livre 1, version 07 du 15/09/2026, d'application au 01/11/2026 (texte officiel, pages imprimées).
- **Validateur** : chaque référence de la liste `rgieRefs` (86 numéros au 27/11/2026) existe dans le texte officiel, titre de section
  et lettre de point compris (script `verifrefs.py`) ; cette vérification structurelle complète, sans la remplacer, la
  lecture du contenu par les relecteurs.

## Résultats

| Lot | Paires | Soutient | Partiel | Ne soutient pas | Corrections P0/P1 revues |
|---|---|---|---|---|---|
| 1 — contrôles, dossier, schémas | 53 | 45 | 8 | 0 | 6 : 5 justes, 1 à compléter |
| 2 — protections, tableau, bases | 62 | 48 | 14 | 0 | 17 : 12 justes, 5 à compléter |
| 3 — prises, éclairage | 42 | 36 | 6 | 0 | 8 : 8 justes |
| 4 — câbles, volets, domotique | 56 | 38 | 18 | 0 | 11 : 9 justes (dont 2 sous-références corrigées), 2 à compléter |
| **Total** | **213** | **167** | **46** | **0** | **42 : 34 justes, 8 à compléter, 0 erronée** |

Les 46 paires partielles et les 8 corrections incomplètes ont été corrigées dans les articles (commits « Contre-audit
Apprendre, lot 1 à 4 »). Aucune affirmation ne s'est révélée contraire au texte cité ; les défauts étaient des
champs d'application oubliés, des sous-références inexactes ou des généralisations.

### Exemples significatifs

- Les prises et l'éclairage présentés comme toujours sous 30 mA : exigé pour les installations dont l'exécution a
  commencé à partir du 1/6/2023 (4.2.4.3 b et dispositions transitoires).
- Le minimum de 3 kA étendu à tous les disjoncteurs : il ne vise que ceux visés par 5.3.5.5 e.
- Une règle propre au schéma IT (5.3.5.5 h) appliquée à tout réseau 3 × 230 V.
- Le maximum de 16 A sur 1,5 mm² attribué à 5.2.1.2 au lieu de 4.4.1.4 (tableau 4.11).
- La longueur présentée comme critère du courant admissible (4.4.1.4 cite isolation, pose, environnement, température).
- Des mesures attribuées à l'installateur alors que 6.4.5 vise l'organisme agréé lors du contrôle de conformité.
- Le 100 mA du chauffe-eau quand la terre dépasse 30 Ω (4.2.4.3 b, 10e alinéa) absent.
- « Aucun interrupteur ne commute le neutre » : la règle vise l'interrupteur unipolaire (5.3.3.2 c) ; le bipolaire
  coupe les deux.
- « Un circuit d'éclairage comporte un neutre » : faux en 3 × 230 V.

## Les 15 points à valider

Ils sont repris dans le dossier autonome `docs/audit/VALIDATION-EXTERNE-RGIE.md` (question neutre, texte cité,
interprétations, exemple, conséquences sur les articles et le moteur, décision attendue). Le contre-audit n'en a
tranché aucun : ils restent « À vérifier ». Les relecteurs en ont ajouté quelques-uns, listés à la fin de chaque lot
ci-dessous (ex. portée de 5.3.5.5 e, « appareil fixe » ou « à poste fixe », gaine du câble KNX et 4.2.5.3 c).

## Limites

- Normes NBN, EN, IEC et prescriptions Synergrid non consultées (payantes ou non accessibles).
- Le tableau 5.1 est mal restitué par l'extraction texte du PDF : sa lecture colonne par colonne est à confirmer sur
  la page imprimée.
- Ce contre-audit n'est pas une validation par un spécialiste ni par un organisme agréé ; la rubrique n'est pas
  déclarée conforme au RGIE.

## Détail par lot

## Lot 1

Articles : controle-organisme-agree, continuite, resistance-isolement, resistance-de-terre, test-differentiel,
differentiel-qui-saute, disjoncteur-qui-saute, dossier-installation, lire-unifilaire, plan-de-position, symboles-electriques.
Texte lu : livre1.txt (sections complètes, champ d'application compris). Tableau 2.23 G vérifié sur le PDF officiel (page imprimée 54, rendue en image).

### Paires affirmation ↔ référence
| Article | Ligne | Réf. | Affirmation (extrait) | Verdict | Ce que dit le texte (citation courte, page) | Action |
|---|---|---|---|---|---|---|
| continuite | 90 | 6.4.6.4 | le rapport comprend la continuité des liaisons équipotentielles et des conducteurs de protection des prises et appareils fixes de classe I | Soutient | b.4 : « contrôle de la continuité des connexions équipotentielles (principale et supplémentaire) et des conducteurs de protection » (p. 203) | Aucune |
| controle-organisme-agree | 19 | 9.1.3.1 | une installation neuve, ou la partie ajoutée, ne peut pas être mise en usage tant que les infractions subsistent | Soutient | « Aucune installation ou partie d'installation … infractions … ne peut être mise en usage » (p. 289) | Aucune |
| controle-organisme-agree | 19 | 9.1.3.2 | après une visite périodique, travaux sans retard ; c'est l'organisme qui a fait la visite qui constate la remise en ordre | Soutient | « constatée par l'organisme agréé qui a réalisé la visite de contrôle » (domestique, p. 290) | Aucune |
| controle-organisme-agree | 19 | 8.4.2 | après une vente, l'acheteur fait constater la correction par l'organisme de son choix, 18 mois après l'acte | Partiel | Vrai, mais seulement pour la visite à la vente d'une ancienne installation (8.4.2.1) avec rapport négatif : « au terme du délai de 18 mois … L'acheteur peut choisir librement cet organisme » (p. 283). La FAQ disait « après une vente » sans champ | Corrigé : « Après la visite faite à la vente d'une ancienne installation (avant 1981) … organisme agréé de son choix » |
| controle-organisme-agree | 34 | 6.4.1 | installation neuve : contrôle de conformité avant mise en usage | Soutient | « fait l'objet d'un contrôle de conformité … avant la mise en usage » (p. 201) ; exception TBT continue sur batteries/PV, sans objet ici | Aucune |
| controle-organisme-agree | 34 | 6.4.6.2 | celui qui met la puissance à disposition s'assure de la présence du rapport | Soutient | « la personne qui met à disposition l'alimentation, s'assure de la présence du rapport » (p. 202) | Aucune |
| controle-organisme-agree | 35 | 6.4.7.3 | modification ou extension importante contrôlée avant mise en usage, contrôle limité à la partie ajoutée | Soutient | « Ce contrôle de conformité est limité à la partie ajoutée ou modifiée » (p. 204) ; la dérogation « 30 jours » ne vaut que pour le non domestique | Aucune |
| controle-organisme-agree | 36 | 6.5.2 | installation domestique revue au moins tous les 25 ans | Soutient | « en respectant au moins les périodicités suivantes : − tous les 25 ans pour les installations électriques domestiques » (p. 204-205) | Aucune |
| controle-organisme-agree | 37 | 8.4.2 | vente d'une habitation à ancienne installation : visite par le vendeur, date du rapport dans l'acte, rapport remis | Soutient | 8.4.2.1 (champ : avant 1981, ou partie d'avant 1981 non visitée) et 8.4.2.2 a « faire mentionner dans l'acte authentique, la date du rapport … et le fait de la remise » (p. 282) | Aucune |
| controle-organisme-agree | 38 | 8.4.1 | augmentation de puissance pour une ancienne installation jamais examinée : visite d'abord, rapport joint à la demande | Soutient | « Toute demande de renforcement de la puissance de raccordement est accompagnée du rapport de contrôle » (p. 281) | Aucune |
| controle-organisme-agree | 41 | 8.2.1 | dispositions dérogatoires propres aux installations d'avant 1981 | Soutient | 8.2.1 : parties existantes « dont l'exécution sur place a été réalisée avant le 1er octobre 1981 » (p. 273) | Complété : renvoi à 8.2.2 pour les installations « ancien RGIE » (après 1981), sans quoi le lecteur croit que seules les installations d'avant 1981 ont des dérogations |
| controle-organisme-agree | 44 | 6.4.1 | contrôle sur place par un organisme agréé ou l'autorité habilitée | Soutient | « réalisés sur place soit par un organisme agréé, soit par l'autorité habilitée » (p. 201) | Aucune |
| controle-organisme-agree | 87 | 3.1.2 | documents : numéro, version, date de la version | Soutient | « reprennent de manière univoque le numéro, la version et la date de la version » (p. 61) | Aucune |
| controle-organisme-agree | 87 | 3.1.2.1 | adresse de l'installation et identité du responsable des travaux | Soutient | « Les nom, qualité, numéro de T.V.A. (si d'application) du responsable … L'adresse du lieu » (p. 61) | Aucune |
| controle-organisme-agree | 102 | 4.2.4.3 b (et 4.4.1.4, tableau 4.11) | 300 mA au plus en tête, 30 mA pour les circuits qui l'exigent ; 16 A / 1,5 mm², 20 A / 2,5 mm² | Soutient | « au maximum 300 mA … à l'origine » ; « haute ou très haute sensibilité » (≤ 30 mA, déf. p. 34) (p. 100-101) ; tableau 4.11 (p. 117) | Aucune |
| controle-organisme-agree | 107 | 6.4.1 | « Le contrôle se fait installation hors tension (RGIE, 6.4.1), sauf pour les essais qui demandent la tension » | Partiel | « doit être réalisé hors tension » (p. 201), sans exception : l'exception était attribuée au RGIE | Corrigé : « Le RGIE prévoit que le contrôle de conformité est réalisé hors tension (RGIE, 6.4.1) ; certains essais, comme celui des différentiels, demandent toutefois que l'installation soit alimentée » |
| controle-organisme-agree | 109 | 6.4.5.2 | mesure de la résistance de dispersion de la terre | Soutient | « la résistance de dispersion des prises de terre … est mesurée » (p. 202) | Aucune |
| controle-organisme-agree | 110 | 6.4.5.1 | résistance d'isolement de chaque circuit | Soutient | « est pour chaque circuit, les appareils d'utilisation étant déconnectés, au moins égale à 1000 fois … » (p. 201) | Aucune |
| controle-organisme-agree | 116 | 6.4.6.4 | rapport : terre, isolement général, adéquation différentiels/terre et protections/sections, infractions | Soutient | b.4 « contient la valeur de la résistance de dispersion … ainsi que la valeur du niveau d'isolement général. Il certifie l'adéquation » ; b.5 infractions (p. 203) | Aucune |
| controle-organisme-agree | 116 | 3.1.2.1 | si conforme : date limite de la prochaine visite ; signature et date des schémas | Partiel | La signature et la date sont bien en 3.1.2.1 (p. 61) ; la date limite de la prochaine visite est en 6.4.6.4 b.6 (« la date à laquelle la visite de contrôle … doit au plus tard être faite », p. 203) | Corrigé : ajout de « (RGIE, 6.4.6.4) » après la date limite |
| controle-organisme-agree | 117 | 6.4.6.4 | rapport conservé dans le dossier ; toute modification y est renseignée | Soutient | b.7 : le rapport rappelle « l'obligation de conserver le rapport dans le dossier » et « de renseigner dans le dossier toute modification » (p. 203) ; obligation elle-même en 6.4.6.1 et 9.1.2 | Aucune |
| controle-organisme-agree | 124 | 6.5.1 | installation pouvant être mise hors tension pendant la visite | Soutient | « L'installation électrique doit pouvoir être mise hors tension pendant la visite de contrôle » (p. 204) | Aucune |
| differentiel-qui-saute | 119 | 9.3.4.2 a | couper, empêcher la remise en service, vérifier l'absence de tension sur tous les conducteurs actifs | Soutient | a : « séparer … s'assurer contre la réalimentation … contrôler l'absence de tension » ; e : « sur tous les conducteurs actifs » (p. 294) ; chapitre 9.3 : tous travaux | Aucune |
| differentiel-qui-saute | 122 | 4.2.4.3 b | au plus 8 circuits terminaux par différentiel 30 mA (neuf) | Soutient | « au maximum 8 circuits terminaux par dispositif » à haute ou très haute sensibilité (p. 101) | Aucune |
| disjoncteur-qui-saute | 18 | 4.4.1.4 | 1,5 mm² → 16 A, 2,5 mm² → 20 A (domestique) | Soutient | Tableau 4.11, colonne disjoncteur (p. 117) | Aucune |
| disjoncteur-qui-saute | 124 | 4.4.1.4 | tableau disjoncteur / fusible (16/10, 20/16, 25/20, 40/32, 63/50) | Soutient | Tableau 4.11 identique, ligne par ligne (p. 117) | Aucune |
| disjoncteur-qui-saute | 134 | 4.4.1.4 | courant admissible selon « mode de pose, longueur et température » | Partiel | Iz dépend « de la section …, de l'isolation …, de la constitution …, du mode de pose et de l'environnement …, de la température ambiante » (p. 116) : pas de la longueur (qui relève de la chute de tension) | Corrigé : « selon son isolation, son mode de pose, son environnement et la température ambiante (RGIE, 4.4.1.4) … La longueur compte aussi, pour la chute de tension » (lien) |
| disjoncteur-qui-saute | 132 | 9.3.4.2 a | même phrase de consignation | Soutient | voir ci-dessus (p. 294) | Aucune |
| disjoncteur-qui-saute | 132 | 6.4.7.3 | modification importante (nouveau circuit, remplacement non identique du tableau) contrôlée avant mise en usage | Soutient | 6.4.7.3 (p. 204) ; exemples tirés de la définition « modification importante » (p. 47) | Aucune |
| dossier-installation | 10 | 9.1.2 | dossier : unifilaires, plans, rapport de contrôle | Soutient | 9.1.2 points 1 à 3 (p. 289) | Aucune |
| dossier-installation | 11 | 3.1.2 | numéro, version, date | Soutient | (p. 61) | Aucune |
| dossier-installation | 12 | 3.1.2.1 | nom, qualité, TVA, adresse ; signature si conforme | Soutient | (p. 61) | Aucune |
| dossier-installation | 19 | 3.1.2.1 | duplicata si le contrôle date de moins de cinq ans | Soutient | « conservés par l'organisme agréé … pendant une période de cinq ans … pour obtenir un duplicata » (p. 61) | Aucune |
| dossier-installation | 30 | 9.1.2 | deux exemplaires ; rapports, visites, garanties, descriptions des petites modifications | Soutient | « établi en deux exemplaires » ; points 1 à 7 (p. 289) | Aucune |
| dossier-installation | 59 (tableau) et 63 | 3.1.2.2 a | contenu minimal de l'unifilaire | Soutient | liste de 3.1.2.2 a (p. 64) ; « calibre et courbe … sensibilité et type » = illustration de « type et caractéristiques » | Aucune |
| dossier-installation | 120 | 8.2.1 | schémas simplifiés pour les parties d'avant 1981 | Soutient | 8.2.1 point 7 : liste identique, « le repérage n'est pas nécessaire », « La correspondance … n'est pas exigée » (p. 275) | Aucune |
| dossier-installation | 121 | 8.2.2 | ancien RGIE : absence tolérée de la signature/date du responsable et du propriétaire, de la TVA, du type des protections | Soutient | 8.2.2 point 7 (p. 278) ; champ : parties « réalisée[s] à partir du 1er octobre 1981 et qui ont fait l'objet d'un examen de conformité » | Aucune |
| lire-unifilaire | 19 | 3.1.2.1 | copie gardée cinq ans, duplicata | Soutient | (p. 61) | Aucune |
| lire-unifilaire | 71 | 3.1.2.2 a | contenu minimal de l'unifilaire domestique | Soutient | liste reprise fidèlement (p. 64) | Aucune |
| plan-de-position | 33 | 3.1.2.3 a | liste des éléments du plan | Partiel (léger) | La liste du RGIE : tableaux, boîtes de connexion, boîtes de dérivation, socles, points lumineux, interrupteurs, machines et appareils fixes, sources (p. 65) ; « appliques » et « unités de commande » étaient ajoutées comme si elles y figuraient | Corrigé : « les points lumineux (appliques comprises) » ; « les interrupteurs (boutons-poussoirs compris) » (les unités de commande restent traitées au § repérage, 3.1.2.1) |
| plan-de-position | 94 | 8.2.1 | plan simplifié pour les parties d'avant 1981 | Soutient | 8.2.1 point 7 (p. 275) | Aucune |
| resistance-de-terre | 17 | 4.2.4.3 b | 30 à 100 Ω admis avec les différentiels supplémentaires ; sinon non conforme | Soutient | « Si la résistance de dispersion … est supérieure à 30 ohms, le nombre de dispositifs … est au moins de deux … » (p. 101) | Aucune |
| resistance-de-terre | 19 | 5.4.2.1 | une canalisation n'est pas une prise de terre ; seules les prises de terre décrites | Soutient | a : « réalisée conformément soit aux dispositions du point b. ou du point c. » (p. 174) | Précisé : liste complète des types de b (boucle, conducteur enfoui horizontalement, barres, piquets, conducteur enfoncé verticalement) |
| resistance-de-terre | 66 | 4.2.3.2 | « aussi faible que possible », < 100 Ω en domestique | Soutient | « aussi faible que possible … inférieure à 100 » (p. 84) | Aucune |
| resistance-de-terre | 66 | 4.2.4.3 b | au-delà de 30 Ω, admissible avec différentiels supplémentaires | Soutient | (p. 101) | Aucune |
| resistance-de-terre | 66 | 5.4.2.1 c | prise de terre commune obligatoire pour les immeubles à appartements construits à partir du 1/6/2020, ≤ 30 Ω | Soutient | c.1 « d'application sur chaque immeuble à appartements qui est construit à partir du 1er juin 2020 » ; c.2 « inférieure ou égale à 30 Ohms » (p. 176) | Aucune |
| resistance-de-terre | 72 | 4.2.4.3 b | deux différentiels HS, 16 prises chacun, appareil fixe = prise ; 100 mA par circuit/groupe derrière le général | Soutient | « au maximum seize socles … Un appareil fixe … est assimilable à un socle … maximum 100 mA par circuit ou groupe de circuits » (p. 101) | Aucune |
| resistance-de-terre | 96 | 6.4.6.4 | l'organisme tranche : le rapport certifie l'adéquation différentiels / terre | Soutient | b.4 a (p. 203) | Aucune |
| resistance-de-terre | 101 | 5.4.2.1 b | boucle obligatoire si fondations ≥ 60 cm ; piquet 1,50 m au moins | Soutient | b.1.1 « dont le fond de fouille de tout ou partie des fondations atteint au moins 60 cm » ; b.4.1 « longueur minimale de 1,50 m » (p. 174-175) | Aucune |
| resistance-de-terre | 115 | 6.4.5.2 | mesure « par l'installateur et, lors de chaque contrôle de conformité, par l'organisme agréé (RGIE, 6.4.5.2) » | Partiel | 6.4.5.2 ne vise que la mesure lors du contrôle de conformité (p. 202) ; la mesure par l'installateur était attribuée au RGIE | Corrigé : « Le RGIE prévoit qu'elle soit mesurée lors de chaque contrôle de conformité, par l'organisme agréé (RGIE, 6.4.5.2) ; l'installateur la mesure en général aussi » ; chapeau : « l'une des mesures faites … lors du contrôle » au lieu de « à chaque contrôle » |
| resistance-isolement | 64 | 6.4.5.1 | tableau 6.1 : 250 V/250 kΩ, 500 V/500 kΩ, 1000 V/1000 kΩ ; ≥ 1000 × tension d'essai | Soutient | tableau 6.1 et alinéa 1 (p. 201) | Aucune |
| resistance-isolement | 106 | 6.4.5.1 | appareil 1 à 5 mA ; mesure « par l'installateur et, lors du contrôle, par l'organisme agréé » | Partiel | « avec un courant de 1 mA à 5 mA » ; « Les mesures sont effectuées par l'organisme » (p. 201) : rien sur l'installateur | Corrigé : « Lors du contrôle de conformité, elle est faite par l'organisme agréé (RGIE, 6.4.5.1) ; l'installateur la fait en général aussi avant la visite » |
| test-differentiel | 33 | 4.2.4.3 b | 300 mA en tête ; 30 mA pour prises, éclairage, salle de bain, lave-linge, sèche-linge, lave-vaisselle | Partiel | Point 1 : « les socles de prise de courant non destinés à l'alimentation des appareils et des machines fixes » (p. 101) : l'exception était omise | Corrigé : « circuits de prises (hors prises réservées à des appareils fixes) » |
| test-differentiel | 114 | 6.4.6.4 | le rapport certifie l'adéquation différentiels / terre | Soutient | b.4 a (p. 203) | Aucune |

### Corrections P0/P1 du premier audit
| Article | Correction revue | Verdict (juste / à compléter / erronée) | Action |
|---|---|---|---|
| controle-organisme-agree | #1 : « Cinq situations », ajout de la visite avant renforcement de puissance (8.4.1) | Juste | Aucune (champ correct : ancienne installation d'une unité d'habitation jamais examinée) |
| disjoncteur-qui-saute | #1 : tableau à trois colonnes (disjoncteur RGIE, fusible RGIE, Voltaplan) + courant admissible + fusible 16 A sur 1,5 mm² | Juste, à compléter | Valeurs vérifiées ligne par ligne ; la phrase ajoutée sur le courant admissible citait à tort la « longueur » comme critère de 4.4.1.4 : corrigée |
| lire-unifilaire | #1 : point lumineux dessiné en croix au bout du trait | Juste | Vérifié sur l'image du tableau 2.23 G (p. 54) : « Point lumineux » = croix au bout de la canalisation ; cercle barré = projecteur. Aucune |
| plan-de-position | #1 : point lumineux en croix | Juste | Aucune |
| symboles-electriques | #1 : texte, SVG et aria-label du point lumineux corrigés | Juste | Vérifié (applique = croix + trait, p. 54) ; « cercle barré = lampe témoin ou projecteur » acceptable (projecteur p. 54, lampe de signalisation dans les interrupteurs) |
| dossier-installation | #1 : contenu complet du dossier (9.1.2), deux exemplaires | Juste | Aucune |

### Autres affirmations d'obligation sans référence
| Article | Affirmation | Verdict | Action |
|---|---|---|---|
| controle-organisme-agree | Exemples de modification importante (schéma de terre, tableau non identique, ajout d'un circuit) | Vrai (définition, p. 47) | Aucune |
| controle-organisme-agree | L'installateur ne peut pas contrôler sa propre installation au sens du RGIE | Vrai (6.4.1 : organisme agréé ou autorité habilitée) | Aucune |
| controle-organisme-agree | Retenir : neuf non mis en usage tant que les infractions ne sont pas corrigées et constatées | Vrai (9.1.3.1) | Aucune |
| controle-organisme-agree | Vente : visite omise d'un commun accord si démolition ou rénovation complète, information de la DG Énergie | Vrai (8.4.2.2 a, p. 282) | Aucune |
| resistance-isolement | Retenir : « le RGIE exige au moins 0,5 MΩ, sous 500 V continu, appareils déconnectés » | Vrai (6.4.5.1) | Aucune |
| resistance-de-terre | Retenir : < 100 Ω, différentiels supplémentaires au-delà de 30 Ω ; boucle obligatoire pour un nouveau bâtiment aux fondations assez profondes | Vrai (4.2.3.2, 4.2.4.3 b, 5.4.2.1 b) | Aucune |
| resistance-de-terre | Piquet = prise de terre complémentaire quand la boucle est impossible ou insuffisante | Vrai (5.4.2.1 b.2.1) | Aucune |
| test-differentiel | « Le RGIE ne fixe pas un temps maximal par type de différentiel ; courbe de sécurité générale » | Vrai pour l'usage domestique courant (aucun temps par type ; courbe de sécurité 2.4.1 ; tableau 4.9 ne vise que BE2/BE3/CA2) | Aucune |
| disjoncteur-qui-saute | Retenir : « Ne remplacez jamais un disjoncteur par un calibre plus élevé » | Trop absolu (contredit la FAQ : permis si la section l'autorise, tableau 4.11) | Corrigé : « Ne remplacez jamais de vous-même … » |
| differentiel-qui-saute | Ne jamais remplacer un 30 mA par un 300 mA | Vrai (4.2.4.3 b impose la haute sensibilité pour ces circuits) | Aucune |
| dossier-installation | Modification non importante : description succincte datée et signée ; plan de position toujours mis à jour | Vrai (3.1.2.1, p. 62) | Aucune |
| dossier-installation | Unifilaire : « partie ancienne » pour ce qui date d'avant le 1/10/1981 | Vrai (3.1.2.1, p. 62) | Aucune |
| plan-de-position | Plan « à l'échelle » (chapitre 2.12) ; toute modification reportée sur le plan | Vrai (définition « Plan », p. 48 ; 3.1.2.1) | Aucune |
| symboles-electriques | Tableau 2.23 « non limitatif » ; symbole hors tableau permis s'il est défini dans la légende | Vrai (2.13, p. 50 ; 3.1.2.1) | Aucune |

### Nouvelles références à ajouter
Aucune. Références nouvellement citées, toutes déjà dans `rgieRefs` : 8.2.2 (controle-organisme-agree), 6.4.6.4 (deuxième citation dans controle-organisme-agree). `npm run learn:check -- <11 slugs>` : OK.

### Points incertains (pour un spécialiste)
- controle-organisme-agree, l. 107 : la nouvelle formulation dit que certains essais (différentiels) demandent l'installation alimentée. C'est une évidence technique, mais le RGIE n'écrit que « réalisé hors tension » et renvoie les modalités des essais à un arrêté (6.4.4) : la pratique exacte des organismes n'est pas vérifiée.
- controle-organisme-agree, l. 40 : la limite entre modification importante et non importante pour « une prise ajoutée sur un circuit existant » reste une appréciation (le texte la renvoie déjà à l'électricien ou à l'organisme).
- differentiel-qui-saute, étape 2 : « un conducteur que les disjoncteurs ne coupent pas (un neutre …) » ; en domestique neuf les disjoncteurs coupent aussi le neutre (4.4.4.2) : l'exemple vaut surtout pour une installation ancienne. Non modifié (hors référence, pas d'erreur de sécurité).

### Bilan : nombre de paires Soutient / Partiel / Ne soutient pas ; corrections faites
- 53 paires : **45 Soutient, 8 Partiel, 0 Ne soutient pas**.
- Partiels, tous corrigés : 8.4.2 (champ de la FAQ vente), 6.4.1 (exception « hors tension » attribuée au RGIE), 3.1.2.1 (date limite de la visite = 6.4.6.4), 4.4.1.4 (« longueur » n'est pas un critère du courant admissible), 3.1.2.3 a (éléments ajoutés à la liste), 6.4.5.2 et 6.4.5.1 (mesure par l'installateur attribuée au RGIE), 4.2.4.3 b dans test-differentiel (exception des prises réservées aux appareils fixes).
- Corrections hors paires : renvoi 8.2.2 ajouté (controle-organisme-agree), liste complète des prises de terre (resistance-de-terre FAQ), chapeau de resistance-de-terre, « de vous-même » dans le retenir de disjoncteur-qui-saute.
- P1 du premier audit : 6 revues, toutes justes (une à compléter, faite). Symbole du point lumineux confirmé sur l'image du tableau 2.23.
- Fichiers modifiés : learn/fr/controle-organisme-agree.html, resistance-isolement.html, resistance-de-terre.html, disjoncteur-qui-saute.html, test-differentiel.html, plan-de-position.html. Descriptions SEO inchangées.

## Lot 2

Texte : RGIE Livre 1, version 07 du 15/09/2026 (`livre1.txt`). Pages = pages imprimées. Lignes = lignes des fichiers `learn/fr/<slug>.html` (numérotation du lot ; pour les phrases de `retenir` / `faq`, la ligne du JSON en tête de fichier).

### Paires affirmation ↔ référence
| Article | Ligne | Réf. | Affirmation (extrait) | Verdict | Ce que dit le texte (citation courte, page) | Action |
|---|---|---|---|---|---|---|
| courant | 18 | 5.2.1.2 | « Le four, lui, doit de toute façon avoir son propre circuit » | Partiel | « Dans les installations domestiques, … le four électrique sont aussi alimentés séparément par un circuit dédié » (p. 129-130) : règle domestique, champ non dit | « Dans une habitation, le four doit… » |
| courant | 73 | 4.4.1.4 | Tableau des calibres maximaux (disjoncteur / fusible) pour le domestique | Soutient | « Pour les installations domestiques, l'intensité nominale maximale… est donnée au tableau 4.11 » ; 1,5 → 10/16 A, 2,5 → 16/20, 4 → 20/25, 6 → 32/40, 10 → 50/63 (p. 116-117) | Aucune |
| courant | 99 | 4.2.4.3 b | « les prises, l'éclairage, la salle de bain, le lave-linge… derrière un 30 mA » | Partiel | Liste exacte des points 1 à 4 (p. 100-101), mais les prises et l'éclairage ne sont exigés que pour une exécution entamée à partir du 01/06/2023 (dérogation 6.5.8.1, 1, p. 207 ; 8.2.1, 16 ; 8.2.2) | Réécrit : salle de bain et appareils toujours, « ainsi que les prises et l'éclairage dans les installations commencées depuis le 1er juin 2023 » |
| courbes-disjoncteur | 80 | 4.4.2.1 | Court-circuit franc coupé avant la température limite des conducteurs | Soutient | « le temps de … coupure … d'un court-circuit franc se produisant en un point quelconque du circuit, n'est pas supérieur au temps nécessaire pour élever la température des conducteurs à la limite admissible » (p. 117) | Aucune |
| differentiel | 13 | 4.2.4.3 b | « Au plus 8 circuits terminaux derrière un même 30 mA, dans les installations commencées depuis le 1/6/2023 » | Soutient | « au maximum 8 circuits terminaux par dispositif » (p. 101) ; dérogation avant le 01/06/2023 (6.5.8.1, 1, p. 207) | Aucune |
| differentiel | 14 | 5.3.5.3 a | (Retenir) « le RGIE impose des différentiels au moins de type A » | Soutient | « placés dans les installations domestiques sont au moins du type A » (p. 168) | Aucune |
| differentiel | 67 | 5.3.5.3 a | Différentiel général : calibre d'au moins 40 A | Soutient | « ceux qui sont placés en tête de l'installation électrique ont une intensité nominale au moins égale à 40 A » (p. 168, phrase sur les installations domestiques) | Aucune |
| differentiel | 70 | 2.6.4 | Haute sensibilité > 10 et ≤ 30 mA, très haute ≤ 10 mA ; 300 mA = sensibilité moyenne | Soutient | Quatre catégories, « haute sensibilité … supérieur à 10 mA … au plus égal à 30 mA » (p. 34) | Aucune |
| differentiel | 77 | 7.1.4.3 | « placé immédiatement en aval du différentiel général, et celui de la salle de bain est installé hors de la pièce » | Partiel | 7.1.4.3 : « installés en aval de ceux placés à l'origine », « en dehors du lieu contenant une baignoire » (p. 232) ; le mot « immédiatement » vient de 4.2.4.3 b (p. 100) | Référence complétée : « (RGIE, 4.2.4.3 b et 7.1.4.3) » |
| differentiel | 80 | 4.2.4.3 b | 100 mA pour le chauffage noyé > 25 V ; prises (sauf appareil fixe) et éclairage depuis le 1/6/2023 ; 8 circuits | Soutient | « maximum 100 mA » ; « socles … non destinés à l'alimentation des appareils et des machines fixes ou à poste fixe » (p. 100-101) | Précisé « appareil fixe ou à poste fixe » |
| differentiel | 80 | 6.5.8.1 | Installation commencée avant le 1/6/2023 : prises/éclairage hors 30 mA et plus de 8 circuits admis | Soutient | « pour les installations électriques dont l'exécution sur place a été entamée avant le 01/06/2023, de ne pas protéger les circuits visés aux points 1 et 2… de laisser en service plus de huit circuits » (p. 207 ; champ : exécution entamée depuis le 01/06/2020) | Aucune |
| differentiel | 80 | 8.2.1 | Idem pour les installations plus anciennes (8.2.1 et 8.2.2) | Soutient | 8.2.1, point 16 (p. 276) et 8.2.2 (même dérogation) | Aucune |
| differentiel | 99 | 5.3.5.3 a | Tous les différentiels domestiques au moins type A, le général compris ; AC exclu en neuf | Soutient | Idem p. 168 | Aucune |
| differentiel | 99 | 5.3.5.3 f | Fuite continue : précautions, par ex. type B ou détection | Soutient | « des précautions sont prises… » ; mesures dont DDR « dont le fonctionnement reste garanti » ou « dispositif de détection à courant différentiel-résiduel continu » (p. 168-169) | Aucune |
| disjoncteur | 11 | 4.4.1.4 | (Retenir) 16 A au plus sur 1,5 mm², 20 A sur 2,5 mm² en habitation | Soutient | Tableau 4.11 (p. 117) | Aucune |
| disjoncteur | 12 | 5.3.5.5 e | (Retenir) « en habitation, il vaut au moins 3 kA » | Partiel | Le minimum de 3000 A vise les dispositifs « en amont des bornes de sortie » des premiers dispositifs placés après le ou les différentiels généraux (p. 170-171) ; pour les autres, Icc ≤ 3000 A à cet endroit | « celui des disjoncteurs placés juste après le différentiel général vaut au moins 3 kA » |
| disjoncteur | 69 | 4.4.1.4 | Tableau des calibres maximaux (5 sections) | Soutient | Tableau 4.11 (p. 117) | Aucune |
| disjoncteur | 80 | 4.4.3.2 | Calibre inférieur au courant admissible, qui dépend de la pose, du groupement, de la température | Partiel | 4.4.3.2 : In ≥ IB et « inférieur au courant admissible IZ » (p. 118) ; la dépendance à la pose et à la température est en 4.4.1.4 (p. 116) | « (RGIE, 4.4.1.4 et 4.4.3.2) » |
| disjoncteur | 80 | 5.2.1.2 | Circuit avec prises : 2,5 mm² au moins ; 1,5 mm² réservé aux circuits sans prise | Soutient | Section < 2,5 mm² interdite sauf tableau 5.1 : 1,5 mm² pour les « circuits ne comportant pas de socle » (p. 129) ; exception mineure non citée (socle 2,5 A intégré à un luminaire) | Aucune |
| disjoncteur | 85 | 4.4.2.1 | Pouvoir de coupure ≥ courant de court-circuit présumé au point d'installation | Soutient | « leur pouvoir de coupure est au moins égal au courant de court-circuit présumé… au point où ce dispositif est installé » (p. 117) | Aucune |
| disjoncteur | 85 | 5.3.5.5 e | « les disjoncteurs ont un pouvoir de coupure d'au moins 3 000 A… ceux de première ligne… classe 3 » | Partiel | Icc ≤ 3000 A aux bornes aval des premiers dispositifs après le différentiel général ; en amont, pouvoir de coupure ≥ 3000 A, « marquage 3000 entouré par un rectangle » ; première ligne : classe 3 « à l'exception des disjoncteurs à broches » (p. 170-171) | Phrase réécrite avec ce champ et l'exception des disjoncteurs à broches |
| disjoncteur | 88 | 4.4.4.2 | Mono/biphasé domestique : détection sur les deux conducteurs ; bipolaires | Soutient | « une détection de surintensité est réalisée sur les deux conducteurs actifs sauf si… dispositif DR qui contient également une détection… et assure la coupure des deux » (p. 119) ; l'exception est donnée à la phrase suivante | Aucune |
| disjoncteur | 88 | 5.3.5.5 h | 3 × 230 V : disjoncteurs aptes à couper seuls la tension entre phases sur un pôle | Partiel | « Dans les installations IT, les dispositifs de protection doivent posséder le pouvoir de coupure unipolaire approprié pour la tension entre conducteurs de ligne » (p. 172) : règle du schéma IT, pas de tout 3 × 230 V | « Ces réseaux sont souvent exploités en schéma IT ; dans ce cas, … » |
| disjoncteur | 93 | 5.3.5.5 a | Socles empêchant un calibre plus élevé sur les câbles < 10 mm² (domestique) | Soutient | « pour autant que la canalisation… ait une section inférieure à 10 mm², les coupe-circuits à fusibles et les petits disjoncteurs à broches sont, par construction, tels que le remplacement… ne puisse pas se faire au moyen d'un élément dont le courant nominal est plus élevé » (p. 170) | Aucune |
| electricite-c-est-quoi | 120 | 6.4.7.3 | Installation neuve, modification ou extension importante contrôlée par un organisme agréé avant mise en usage | Partiel | 6.4.7.3 ne vise que la modification ou l'extension importante (p. 204) ; l'installation neuve relève de 6.4.1 : « fait l'objet d'un contrôle de conformité… avant la mise en usage… par un organisme agréé » (p. 201) | « (RGIE, 6.4.1 et 6.4.7.3) » |
| liaisons-equipotentielles | 17 | 7.1.4.4 | Canalisations synthétiques et radiateurs alimentés par elles exclus de la liaison supplémentaire | Soutient | Exceptions 2 et 3 : « les canalisations non conductrices… les radiateurs ou convecteurs alimentés par des canalisations qui sont visées au 2. » (p. 232) | Aucune |
| liaisons-equipotentielles | 59 | 4.2.3.4 a | Liaison principale obligatoire dans chaque bâtiment, habitation comprise | Soutient | a.4 : « Dans chaque bâtiment (tant dans les installations domestiques que dans les installations non-domestiques), une liaison équipotentielle principale est obligatoire » (p. 89) | Aucune |
| liaisons-equipotentielles | 59 | 4.2.3.2 | Éléments à relier (eau, gaz, chauffage, structure, autres canalisations) | Soutient | « les canalisations principales métalliques d'eau et de gaz (gaz naturel ou gaz en bouteille) au bâtiment ; les colonnes principales… » (p. 84) | Aucune |
| liaisons-equipotentielles | 70 | 7.1.4.4 | Salle de bain : masses et éléments conducteurs simultanément accessibles reliés entre eux et au PE | Soutient | « relie localement toutes les masses… et tous les éléments conducteurs étrangers simultanément accessibles » ; 4.2.3.2 : relie aussi « les conducteurs de protection » (p. 232, p. 84) ; exceptions citées dans l'article | Aucune |
| liaisons-equipotentielles | 85 | 5.4.4.1 | Sections : principale ½ du plus gros PE, min. 6 mm², max. utile 25 mm² ; supplémentaire min. 2,5 / 4 mm² | Soutient | 5.4.4.1 a et 5.4.4.2 a (p. 181) | Aucune (5.4.4.2 à ajouter à rgieRefs) |
| liaisons-equipotentielles | 92 | 5.4.4.1 b | Conducteur isolé vert-jaune | Partiel | 5.4.4.1 b ne vise que le conducteur principal ; pour la liaison supplémentaire : 5.4.4.2 b « possèdent une isolation de couleur vert-jaune » (p. 181) | « (RGIE, 5.4.4.1 b et 5.4.4.2 b) » |
| liaisons-equipotentielles | 100 | 8.2.1 | Avant le 1/10/1981 : principale absente admise ; supplémentaire absente si volume 2 porté à 1 m | Soutient | Point 13 et point 15.2 « à condition de porter à 1 m la distance du volume 2 » (p. 276) | Aucune |
| mise-a-la-terre | 14 | 4.2.4.3 b | (Retenir) < 100 Ω exigé ; au-delà de 30 Ω, différentiels supplémentaires | Soutient | « Si la résistance de dispersion… est supérieure à 30 ohms, le nombre de dispositifs… est au moins de deux » (p. 101) | Aucune |
| mise-a-la-terre | 80 | 5.4.2.1 b | Boucle obligatoire pour tout nouveau bâtiment dont les fouilles atteignent 60 cm | Partiel | b. « Règles spécifiques pour les installations domestiques » : « Pour tout nouveau bâtiment, dont le fond de fouille de tout ou partie des fondations atteint au moins 60 cm » (p. 174) ; champ domestique omis | Article et « Retenir » : « pour une installation domestique », « de tout ou partie des fondations » |
| mise-a-la-terre | 85 | 5.4.3.5 | Sectionneur de terre ouvrable seulement avec un outil | Soutient | « un dispositif de coupure (sectionneur de terre) qui est démontable seulement à l'aide d'un outil » (p. 180) | Aucune |
| mise-a-la-terre | 88 | 4.2.3.2 | « aussi faible que possible » et < 100 Ω en domestique | Soutient | « aussi faible que possible » ; « sa résistance de dispersion est inférieure à 100 Ω » (p. 84) | Aucune |
| mise-a-la-terre | 93 | 4.2.4.3 b | > 30 Ω : deux 30 mA, 16 socles par différentiel, 100 mA par circuit sur les DDR d'origine | Partiel | Conforme au 10e alinéa (p. 101), mais la dérogation pour une exécution entamée avant le 01/06/2023 (un 30 mA pour tout l'éclairage, un par groupe de 16 socles) est omise (6.5.8.1, 1, p. 207 ; 8.2.1, 16 ; 8.2.2) | Phrase ajoutée avec (RGIE, 6.5.8.1 ; 8.2.1 et 8.2.2) |
| mise-a-la-terre | 94 | 4.2.3.2 | 100 Ω ou plus : non conforme | Soutient | « inférieure à 100 Ω » (p. 84) | Aucune |
| mise-a-la-terre | 102 | 5.3.5.3 g | Neutre relié à la terre interdit en aval du différentiel | Soutient | « Le conducteur N n'est pas relié à la terre en aval du dispositif de protection » (p. 169) | Aucune |
| mise-a-la-terre | 103 | 5.4.3.6 | Toutes les canalisations domestiques ont un PE sauf interrupteurs, TBTS, amont du général | Soutient | « à l'exception de celles aboutissant aux interrupteurs, de celles à très basse tension de sécurité et de celles en amont du ou des différentiels généraux » (p. 181) | Aucune |
| mise-a-la-terre | 104 | 5.4.3.5 | Pas d'appareil de coupure dans le PE, sauf sectionneur de terre | Soutient | « Sauf spécification contraire, aucun appareil de coupure… n'est inséré dans le circuit des conducteurs de protection » (p. 180) | Aucune |
| organiser-tableau | 34 | 4.2.4.3 b | Général ≤ 300 mA, ≥ 40 A, à l'origine, assure le sectionnement | Soutient | « maximum 300 mA, est placé à l'origine… assure(nt) la fonction de sectionnement » (p. 100) + 5.3.5.3 a (40 A, p. 168) | Aucune |
| organiser-tableau | 88 | 5.3.5.3 a | Tous les différentiels domestiques au moins type A | Soutient | p. 168 | Aucune |
| organiser-tableau | 89 | 4.2.4.3 b | Depuis le 1/6/2023, 8 circuits au plus par 30 mA | Soutient | p. 101 et 6.5.8.1, 1 (p. 207) | Aucune |
| organiser-tableau | 99 | 5.2.1.2 | « tout appareil fixe de 2 600 W ou plus… ainsi que le chauffage électrique fixe » | Partiel | « chaque appareil ou machine (mobile) à poste fixe d'une puissance nominale supérieure ou égale à 2600 W » ; « appareils d'un chauffage électrique à poste fixe… un ou plusieurs circuits dédiés » (p. 129-130), domestique | « dans une habitation, tout appareil à poste fixe… ; les appareils de chauffage électrique à poste fixe ont un ou plusieurs circuits dédiés » |
| organiser-tableau | 99 | 7.22.3 | Chaque point de connexion d'une borne : circuit dédié | Soutient | « Un circuit dédié est prévu pour chaque point de connexion » (p. 248) | Aucune |
| organiser-tableau | 100 | 4.4.4.2 | Détection sur les deux conducteurs, sauf DDR avec détection qui coupe les deux | Soutient | p. 119 | Aucune |
| organiser-tableau | 107 | 3.1.3.1 | Dispositifs de commande, protection, sectionnement repérés de façon claire, visible, indélébile | Soutient | « repérés de manière claire, bien visible et indélébile par des repérages individuels, à moins que toute possibilité de confusion soit écartée » (p. 65) | Aucune |
| organiser-tableau | 107 | 3.1.3.3 a | Tension d'alimentation indiquée sur chaque tableau | Soutient | « La tension d'alimentation est indiquée clairement… sur chaque tableau » (installations domestiques, p. 66) | Aucune |
| parafoudre | 17 | 4.5.1 | (FAQ) protection « d'après les règles de l'art », pas de liste de cas obligatoires | Soutient | « protégés d'après les règles de l'art… contre… des phénomènes atmosphériques ou d'éventuelles surtensions de manœuvre » (p. 120) | Aucune |
| parafoudre | 17 | 4.5.3 | (FAQ) en IT, limiteur à l'origine « si nécessaire » | Soutient | « Dans les schémas IT, un dispositif limiteur de surtension est, si nécessaire, connecté à l'origine » (p. 121) | Aucune |
| parafoudre | 90 | 4.5.1 | Règles de l'art ; fonctionnement sans danger | Soutient | « réalisés et installés de manière que leur fonctionnement ne crée aucun danger » (p. 120) | Aucune |
| parafoudre | 90 | 4.5.3 | Limiteur entre la prise de terre et le neutre ou une phase, si nécessaire | Soutient | « entre la prise de terre… et soit le conducteur neutre, soit un conducteur de ligne » (p. 121) | Aucune |
| puissance-energie | 49 | 5.2.1.2 | Circuits dédiés en habitation (liste, appareil à poste fixe ≥ 2 600 W, chauffage) | Soutient | p. 129-130 | Aucune |
| resistance-loi-ohm | 94 | 4.4.1.4 | 16 A au plus pour un disjoncteur sur 1,5 mm² | Partiel | Tableau 4.11 « Pour les installations domestiques » (p. 116-117) ; champ omis | « dans une habitation, le calibre est plafonné… » |
| surcharge-court-circuit | 33 | 2.6.4 | Courant de non-déclenchement supporté au moins une heure | Soutient | « le courant conventionnel de non-déclenchement… supérieur au courant nominal… temps conventionnel… toujours au moins égal à 1 heure » (p. 34) | Aucune |
| surcharge-court-circuit | 33 | 4.4.3.2 | Le câble est choisi pour supporter ces dépassements | Soutient | Inf ≤ 1,15 IZ et If ≤ 1,45 IZ (p. 118) | Aucune |
| surcharge-court-circuit | 103 | 5.2.1.2 | « tout appareil fixe ou à poste fixe de 2 600 W ou plus » | Partiel | Le texte dit « appareil ou machine (mobile) à poste fixe » (p. 129), en domestique | « tout appareil à poste fixe » et « dans une habitation » |
| surcharge-court-circuit | 103 | 5.3.5.2 b | Huit socles simples ou multiples au plus par circuit | Soutient | « limité à huit par circuit terminal » (règles domestiques, p. 167) | Champ « dans une habitation » ajouté (même phrase) |
| tension | 18 | 2.4.1 | (FAQ) 50 V peau sèche, 25 V mouillée, 12 V immergé (AC) | Soutient | Tableau 2.3 : BB1 50 V, BB2 25 V, BB3 12 V (p. 26) | Aucune |
| tension | 51 | 2.4.1 | Tension limite conventionnelle selon l'état de la peau (tableau 2.3) | Soutient | Tableau 2.3 (p. 26) | Aucune |
| tension | 51 | 4.2.5.3 | TBTS : source de sécurité (transformateur, batterie), circuits séparés du 230 V | Soutient | Sources de 4.2.5.1 (batteries ; transformateurs de séparation de niveau équivalent à un transformateur de sécurité) ; « séparées physiquement les unes des autres et d'autres circuits » (p. 106) | Aucune |

### Corrections P0/P1 du premier audit
| Article | Correction revue | Verdict (juste / à compléter / erronée) | Action |
|---|---|---|---|
| tension #1, #2 | Trois tensions limites UL (2.4.1), « même en cas de défaut » | juste | Aucune |
| tension #4 | Mesures sous tension : appareil CAT III, cordons, formation, sinon électricien | juste (bonne pratique, présentée comme telle) | Aucune |
| courant #1 | Tableau 4.11 (disjoncteur et fusible) ; Voltaplan plus prudent dès 6 mm² | juste | Aucune |
| courant #3 | Four : circuit dédié (5.2.1.2) | juste, champ domestique implicite | « Dans une habitation » ajouté |
| courant #4 | Liste exacte des circuits sous 30 mA (4.2.4.3 b) | à compléter : prises et éclairage présentés comme toujours exigés, alors qu'ils ne le sont que pour une exécution depuis le 01/06/2023 | Corrigé |
| puissance-energie #1 | Circuits dédiés imposés (5.2.1.2) | juste | Aucune |
| alternatif-mono-tri #1 | 133 V en temps normal, jusqu'à 230 V en défaut (IT) | juste | Aucune |
| disjoncteur #1 | Tableau RGIE + In < IZ (4.4.3.2) + 2,5 mm² pour les prises (5.2.1.2) | juste ; la dépendance à la pose relève de 4.4.1.4 | Référence complétée |
| disjoncteur #2 | 4.4.4.2 (deux pôles protégés, exception du disjoncteur différentiel) + 5.3.5.5 h | à compléter : 5.3.5.5 h est une règle du schéma IT, appliquée à tout 3 × 230 V | Corrigé (« en schéma IT ») |
| surcharge-court-circuit #2 | FAQ : four et lave-vaisselle sur circuit dédié | juste | Aucune |
| differentiel #1 | Type A obligatoire pour tous ; précautions 5.3.5.3 f | juste | Aucune |
| differentiel #2 (P0) | « Ce n'est pas une garantie absolue » | juste | Aucune |
| mise-a-la-terre #1 | Boucle obligatoire (5.4.2.1 b.1) | à compléter : règle propre aux installations domestiques, champ omis | Corrigé (article et « Retenir ») |
| mise-a-la-terre #2 | La couleur ne prouve pas la fonction (5.4.3.3, 8.2.1 pt 10) | juste | Aucune |
| organiser-tableau #1 | Type A pour tous les différentiels | juste | Aucune |
| organiser-tableau #2 | Circuits dédiés obligatoires vs bonne pratique | à compléter : « tout appareil fixe » au lieu de « à poste fixe » ; « chauffage fixe » au lieu de « à poste fixe » | Corrigé |
| (commun C5) electricite-c-est-quoi | Contrôle d'une installation neuve ou d'une modification importante (6.4.7.3) | à compléter : l'installation neuve relève de 6.4.1 | Référence 6.4.1 ajoutée |

### Autres affirmations d'obligation sans référence
| Article | Affirmation | Verdict | Action |
|---|---|---|---|
| differentiel l. 29 | Le différentiel est obligatoire dans toute installation domestique | Vrai (4.2.4.3 b ; 8.2.1 ne dispense que de certaines caractéristiques du général) | Aucune |
| organiser-tableau l. 17 (FAQ) | La limite de 8 circuits « ne s'impose pas … ni à leurs modifications non importantes » | Trop large : l'extension aux modifications non importantes n'est prévue que pour la dérogation prises / éclairage (6.5.8.1, 1, 1er alinéa), pas pour celle des 8 circuits | Réécrit : « peut garder en service plus de huit circuits » (RGIE, 6.5.8.1 ; 8.2.1 et 8.2.2) |
| organiser-tableau l. 84 | Prises sous 30 mA | Incomplet : sauf socles destinés à un appareil fixe ou à poste fixe (4.2.4.3 b, point 1) | Précision ajoutée |
| liaisons-equipotentielles l. 79 | Circuits de la salle de bain sous 30 mA au plus | Vrai (7.1.4.3, hors TBTS et séparation) | Aucune |
| liaisons-equipotentielles l. 94 | « chaque connexion reste accessible pour le contrôle », listé parmi les règles | Aucune base trouvée dans le RGIE pour les liaisons (l'accessibilité n'est exigée que pour les connexions de la prise de terre, 5.4.2.1) | Marqué « (bonne pratique) » |
| mise-a-la-terre l. 18 | Une conduite d'eau ne sert pas de prise de terre | Cohérent avec 5.4.2.1 (types de prises de terre domestiques) | Aucune |
| disjoncteur l. 100, courbes l. 90, parafoudre l. 108 | Contrôle avant mise en usage d'une installation neuve ou d'une modification importante | Vrai (6.4.1, 6.4.7.3) | Aucune |
| courant l. 90, surcharge l. 12 et 86 | Délai du thermique « jusqu'à près d'une heure » / « secondes à minutes » | Incohérent avec 2.6.4 (non-déclenchement ≥ 1 h) et avec les autres articles (« plus d'une heure ») | Harmonisé : « parfois plus d'une heure pour un faible dépassement » |
| disjoncteur l. 88 | « Un modèle 1P+N … ne répond pas à cette règle s'il est utilisé seul » | Lecture littérale de 4.4.4.2, déjà signalée au spécialiste par le premier audit | Aucune |

### Nouvelles références à ajouter
- **5.4.4.2** (p. 181) : « La section des conducteurs de la liaison équipotentielle supplémentaire est au moins égale à … 2,5 mm² lorsque les conducteurs sont protégés mécaniquement ; 4 mm² lorsqu'ils ne le sont pas » (déjà citée en seconde position dans liaisons-equipotentielles l. 85).
- **5.4.4.2 b** (p. 181) : « Les conducteurs supplémentaires d'équipotentialité possèdent une isolation de couleur vert-jaune » (liaisons-equipotentielles l. 92).
- Autres références ajoutées en seconde position, déjà présentes dans `rgieRefs` : 4.4.1.4, 4.2.4.3 b, 6.4.1, 6.5.8.1, 8.2.1, 8.2.2.

### Points incertains (pour un spécialiste)
1. **5.3.5.5 e** : le minimum de 3 000 A vise, à la lettre, les dispositifs « en amont des bornes de sortie » des premiers dispositifs après le différentiel général. S'applique-t-il aussi aux disjoncteurs d'un sous-tableau ? L'article ne l'affirme plus.
2. **5.2.1.2** : « appareil ou machine (mobile) à poste fixe ≥ 2 600 W ». Un appareil **fixe** de 2 600 W ou plus (par exemple un chauffe-eau raccordé à demeure) est-il visé ? Les articles suivent la lettre (« à poste fixe »).
3. **6.5.8.1** : dérogation réservée aux installations dont l'exécution a commencé à partir du 01/06/2020 et contrôlées ; avant 2020, 8.2.1 et 8.2.2. Les articles disent « commencée avant le 1er juin 2023 » avec renvoi aux trois sections. La disposition transitoire de 4.2.4.3 b (travaux entamés avant le 01/06/2023, contrôle après, avec information de l'organisme agréé) n'est pas détaillée.
4. **8.2.1 point 13** renvoie à « a.5 » de 4.2.3.4, alors que l'obligation de liaison principale est au point a.4 : incohérence interne du RGIE ; l'article cite a.4.
5. **7.22.3** : le circuit dédié par point de connexion peut être réalisé par des protections placées dans la borne elle-même. L'article ne le précise pas (pas faux).
6. Pratique « 1P+N » (4.4.4.2), déjà signalée par le premier audit.

### Bilan : nombre de paires Soutient / Partiel / Ne soutient pas ; corrections faites
- 62 paires : **48 Soutient**, **14 Partiel**, **0 Ne soutient pas**.
- Les 14 paires partielles sont corrigées dans l'article (champ domestique précisé, date du 01/06/2023, schéma IT, « à poste fixe », bonne sous-référence ou dérogation ajoutée).
- Premier audit : 17 corrections revues, 12 justes, 5 à compléter (toutes complétées), 0 erronée.
- Hors références : 4 corrections (FAQ des 8 circuits trop large, prises d'appareils fixes, « bonne pratique », délais du thermique harmonisés).
- 22 remplacements dans 9 fichiers : differentiel, disjoncteur, courant, organiser-tableau, mise-a-la-terre, liaisons-equipotentielles, surcharge-court-circuit, resistance-loi-ohm, electricite-c-est-quoi (et aucun dans parafoudre, courbes-disjoncteur, tension, puissance-energie, alternatif-mono-tri, serie-et-parallele).
- `npm run learn:check` sur les 15 articles : OK.

## Lot 3

Articles : prise-de-courant, prise-commandee, simple-allumage, double-allumage, va-et-vient, va-et-vient-trois-points, telerupteur, minuterie, detecteur-de-mouvement, variateur, sonnette, contacteur-jour-nuit.
Texte : RGIE Livre 1, version 07 (15/09/2026). Pages = pieds de page imprimés. Lignes = celles de lot3.json.

### Paires affirmation ↔ référence

| Article | Ligne | Réf. | Affirmation (extrait) | Verdict | Ce que dit le texte (citation courte, page) | Action |
|---|---|---|---|---|---|---|
| contacteur-jour-nuit | 103 | 5.2.1.2 | Circuit dédié imposé à tout appareil à poste fixe ≥ 2 600 W (domestique) | Soutient | « chaque appareil ou machine (mobile) à poste fixe d’une puissance nominale supérieure ou égale à 2600 W est alimenté séparément par un circuit dédié » (p. 129) | Aucune |
| contacteur-jour-nuit | 105 | 4.4.1.4 | Domestique : 20 A max pour 2,5 mm², 16 A max pour 1,5 mm² (tableau 4.11) ; calibre plus faible possible | Soutient | Tableau 4.11 : 1,5 mm² → disjoncteur 16 A ; 2,5 mm² → 20 A, « pour les installations domestiques » (p. 116-117) | Aucune |
| contacteur-jour-nuit | 106 | 4.2.4.3 b | 30 mA non imposé pour le chauffe-eau sauf circuit salle de bain/douche | Partiel | Le chauffe-eau relève des circuits du « 8ème alinéa » (appareils fixes) ; mais « Si la résistance de dispersion de la prise de terre est supérieure à 30 ohms […] au moins un dispositif […] de maximum 100 mA par circuit ou groupe de circuits » (p. 100-101) : cas omis | Ajouté : au-delà de 30 ohms, différentiel de 100 mA au plus pour ce circuit |
| contacteur-jour-nuit | 118 | 5.3.5.1 c | Tarif différent (compteur séparé, exclusif nuit) : panneau distinct à 10 cm ou tableau séparé, sauf GRD | Soutient | « circuits dont l’énergie est soumise à des tarifs différents sont groupés sur des panneaux distincts, écartés […] de 10 cm au moins, ou dans des tableaux […] distincts, sauf autorisation du gestionnaire » (p. 166-167). Restriction au compteur séparé = lecture raisonnable | Aucune |
| double-allumage | 97 | 5.1.6.2 | Bleu réservé au neutre (circuit avec neutre), vert-jaune à la terre | Soutient | « isolation de couleur bleue sont réservés au conducteur neutre dans les circuits comportant un tel conducteur » ; vert-jaune proscrit des conducteurs actifs (p. 128) | Aucune |
| double-allumage | 125 | 5.3.3.2 c | Neutre passé par l’interrupteur : interdit | Soutient | « un dispositif de commande unipolaire n’est pas placé sur le conducteur neutre » (p. 159) | Aucune |
| prise-commandee | 18 | 5.2.1.2 | FAQ : le 1,5 mm² est réservé aux circuits sans prise, même sous 16 A | Soutient | Tableau 5.1 : 1,5 mm² pour « circuits ne comportant pas de socle de prise de courant » (p. 129) ; seule exception, socle 2,5 A intégré à un luminaire, sans objet ici | Aucune |
| prise-commandee | 18 | 5.3.5.2 b | Circuit mixte permis, suit les règles des prises | Soutient | « Les prescriptions applicables à ce circuit sont celles relatives aux circuits alimentant des socles de prise de courant » (p. 167) | Aucune |
| prise-commandee | 33 | 5.3.3.2 c | Interdit de placer un appareil de commande unipolaire sur le neutre | Soutient | idem (p. 159) | Aucune |
| prise-commandee | 90 | 4.4.1.4 | Disjoncteur 20 A au plus (tableau 4.11) | Soutient | Tableau 4.11 (p. 116-117) ; contexte 2,5 mm², domestique | Aucune |
| prise-commandee | 18 | 5.2.1.2 | Prise commandée sur circuit d’éclairage 1,5 mm² : interdite | Soutient | Tableau 5.1 (p. 129) | Aucune |
| prise-commandee | 18 | 5.3.5.4 a | Appareils de manœuvre conformes à leur norme et prévus pour l’usage | Soutient | « conformes […] à la norme […] Ils sont prévus pour la catégorie d’emploi définie par la norme correspondant à leur destination » (p. 169) | Aucune |
| prise-de-courant | 18 | 5.3.5.2 b | FAQ : huit « socles simples ou multiples » par circuit ; prise double = 1 point | Partiel | Règle placée sous « b. Règles spécifiques pour les installations domestiques » : « limité à huit par circuit terminal » (p. 167). Champ domestique non dit | Ajouté « Dans une installation domestique » |
| prise-de-courant | 18 | 5.3.5.2 b | FAQ : toute prise nouvelle a un contact de terre, sauf TBTS et transfo de séparation individuel | Soutient | « comportent tous un contact de terre relié au conducteur de protection […] sauf […] transformateur de séparation des circuits individuel » ; « à l’exception de ceux à TBTS » (p. 167) | Aucune |
| prise-de-courant | 20 | 8.2.1 | Avant 1/10/1981 : prises sans terre maintenues si canalisation sans PE et différentiel ≤ 30 mA | Soutient | 8.2.1, 6 b : « socles […] sans contact de terre du fait que la canalisation […] est sans conducteur de protection et à condition […] haute ou très haute sensibilité » (p. 273-274) ; haute sensibilité ≤ 30 mA (définitions de la partie 2, p. 34) | Aucune |
| prise-de-courant | 50 | 5.2.1.2 | Circuit de prises ≥ 2,5 mm² ; 1,5 mm² réservé aux circuits sans prise | Soutient | « l’emploi de conducteurs isolés d’une section inférieure à 2,5 mm² est interdite » + tableau 5.1 (p. 129). Exception socle 2,5 A dans luminaire, marginale | Aucune |
| prise-de-courant | 51 | 4.4.1.4 | Domestique : disjoncteur 20 A ou fusible 16 A au plus pour 2,5 mm² | Soutient | Tableau 4.11 (p. 116-117) | Aucune |
| prise-de-courant | 18 | 5.3.5.2 b | Au plus 8 points de prise par circuit | Partiel | Même règle domestique (p. 167) | Ajouté « dans une installation domestique » |
| prise-de-courant | 18 | 5.3.5.2 b | Circuit mixte : règles des prises ; appareil fixe ou groupe commandé ensemble = une prise | Soutient | « un appareil fixe ou un ensemble d’appareils fixes commandé par un appareil de manœuvre commun étant assimilé à un socle » (p. 167) | Aucune |
| prise-de-courant | 50 | 5.2.1.2 | Domestique : circuit dédié lave-linge, sèche-linge, lave-vaisselle, cuisinière, taque, four, ≥ 2 600 W ; chauffage fixe | Soutient | p. 129-130, liste identique | Aucune |
| prise-de-courant | 58 | 4.2.4.3 b | Installation neuve : prises d’usage général derrière 30 mA depuis le 1/6/2023, 8 circuits max | Partiel | 4.2.4.3 ne vise que les installations domestiques (titre, p. 100) ; liste 1 à 4, « au maximum 8 circuits terminaux » ; date du 01/06/2023 (p. 101 et 6.5.8.1, p. 206) | Ajouté « domestique » (« installation domestique neuve ») |
| prise-de-courant | 18 | 5.3.5.2 a | Toute prise ≥ IPXX-B ; prises conformes à NBN C 61-112-1 (version au 1/3/2025) | Soutient | « au moins IPXX-B » ; ≤ 32 A / 400 V « satisfont à la norme NBN C 61-112-1:2017 » (p. 167) ; maintien des prises posées avant le 01/03/2025 : 6.5.8.1, 2 (p. 206), 8.2.2, 6 et 8.2.1, 6 a | Aucune |
| simple-allumage | 11 | 5.3.3.2 c | Interrupteur sur la phase, jamais sur le neutre | Soutient | p. 159 (interrupteur simple = unipolaire) | Aucune |
| simple-allumage | 11 | 5.3.3.2 c | Formulation RGIE citée | Soutient | Citation exacte (p. 159) | Aucune |
| simple-allumage | 72 | 5.1.6.2 | Bleu réservé au neutre dans un circuit qui en comporte un | Soutient | p. 128 | Aucune |
| simple-allumage | 78 | 4.4.1.4 | Domestique : 1,5 mm² protégé par 16 A (disjoncteur) ou 10 A (fusible) au plus | Soutient | Tableau 4.11 (p. 116-117) | Aucune |
| simple-allumage | 88 | 5.4.3.6 | Domestique : canalisations avec PE sauf celles qui vont à un interrupteur | Soutient | « à l’exception de celles aboutissant aux interrupteurs, de celles à TBTS et de celles en amont du ou des différentiels généraux » (p. 180-181) ; les deux autres exceptions sont sans objet pour un point lumineux | Aucune |
| simple-allumage | 88 | 4.2.4.3 a | Carcasse d’un luminaire de classe I reliée au PE | Soutient | « Les masses du matériel électrique à basse tension de la classe I sont reliées au conducteur de protection » (p. 100) | Aucune |
| simple-allumage | 72 | 5.1.6.2 | Bleu comme retour lampe interdit si le circuit a un neutre | Soutient | p. 128 | Aucune |
| simple-allumage | 88 | 4.2.4.3 b | Domestique neuve : éclairage derrière un différentiel ≤ 30 mA en aval du général ; depuis le 1/6/2023 ; 8 circuits max | Soutient | « Immédiatement en aval […] haute ou très haute sensibilité […] 2. l’éclairage » ; « au maximum 8 circuits terminaux » (p. 100-101) | Aucune |
| simple-allumage | 105 | 5.3.5.2 b | Lampes et prises sur un même circuit ; groupe de lampes commandé ensemble = une prise | Soutient | p. 167 | Aucune |
| simple-allumage | 105 | 8.2.1 | « Dans une installation ancienne, un seul circuit d’éclairage peut être toléré » | Partiel | 8.2.1, 14 : dérogation pour les seules parties existantes des installations domestiques d’avant le 1/10/1981 (p. 273, 275) ; rien d’équivalent en 8.2.2 ni 6.5.8.1 | Précisé : « ancienne installation (exécutée avant le 1er octobre 1981), un seul circuit d’éclairage existant peut être laissé en service » |
| sonnette | 75 | 4.2.2.2 | TBTS ≤ 25 V AC peau sèche, 12 V peau mouillée : pas de protection contre le contact direct | Soutient | Tableau 4.1 : BB1 25 V, BB2 12 V ; protection « considérée comme assurée » en TBTS aux conditions de 4.2.3.3 a (p. 72). Voir aussi 4.2.5.5 a (p. 107) | Aucune |
| sonnette | 88 | 4.2.5.3 c | Trois façons de séparer : 10 mm, isolation supplémentaire, isolation pour la tension la plus élevée | Soutient | p. 106, trois tirets identiques | Aucune |
| telerupteur | 140 | 4.2.5.3 c | Commande TBTS séparée du 230 V : mêmes trois solutions | Soutient | p. 106 | Aucune |
| telerupteur | 140 | 4.2.5.5 c | Circuit TBTS relié ni à la terre ni à un autre circuit | Soutient | « Les parties actives du matériel électrique TBTS ne peuvent pas être reliées galvaniquement : à la prise de terre ; à des parties actives appartenant à d’autres circuits » (p. 107) | Aucune |
| telerupteur | 147 | 5.3.3.2 c | Boutons côté neutre : interdit | Soutient | p. 159 | Aucune |
| va-et-vient-trois-points | 180 | 5.3.3.2 c | « aucun interrupteur ne doit commuter le neutre » | Partiel | La règle vise le dispositif unipolaire sur le neutre ; un interrupteur bipolaire qui coupe phase et neutre est permis (p. 159) | Reformulé : « un interrupteur unipolaire n’est jamais placé sur le neutre (RGIE, 5.3.3.2 c) ; le neutre va directement à la lampe » |
| va-et-vient | 108 | 5.1.6.2 | Navettes et retour : jamais vert-jaune, pas de bleu si neutre | Soutient | p. 128 ; la dérogation jaune ou vert < 1,5 mm² ne vaut que pour les circuits de commande/signalisation, pas pour des navettes | Aucune |
| va-et-vient | 133 | 5.3.3.2 c | Neutre commuté par les interrupteurs : interdit | Soutient | p. 159 | Aucune |
| va-et-vient | 108 | 5.1.6.2 | Bleu réservé au neutre (circuit avec neutre) | Soutient | p. 128 | Aucune |
| variateur | 123 | 5.3.5.4 a | Variateur conforme à sa norme | Soutient | « Les interrupteurs et autres appareils de manœuvre sont conformes […] à la norme » (p. 169) | Aucune |

### Corrections P0/P1 du premier audit

Aucune ligne P0 dans le lot. Lignes P1 :

| Article | Correction revue | Verdict (juste / à compléter / erronée) | Action |
|---|---|---|---|
| simple-allumage | P1-1 : « se place sur la phase, jamais sur le neutre (5.3.3.2 c). Il commande la lampe, mais ne remplace pas la coupure au tableau » | Juste | Aucune |
| simple-allumage | P1-2 : formulation RGIE + paragraphe 3 × 230 V + coupure au tableau | Juste (le cas 3 × 230 V est physiquement exact, non attribué au RGIE) | Aucune |
| prise-de-courant | P1-1 : circuits dédiés imposés, liste complète (5.2.1.2) | Juste, liste conforme au texte p. 129-130 | Aucune |
| prise-de-courant | P1-2 : prises sur circuit 1,5 mm² « interdit, même sous 16 A » | Juste (l’exception socle 2,5 A intégré au luminaire ne concerne pas une prise murale) | Aucune |
| prise-commandee | P1-1 : FAQ, interdit en 1,5 mm², circuit mixte permis aux règles des prises | Juste | Aucune |
| prise-commandee | P1-2 : « et elle est interdite » + 5.2.1.2 | Juste | Aucune |
| prise-commandee | P1-3 : fil de commande 1,5 mm² « interdit sur un circuit de prises, quel que soit le calibre » | Juste : le fil interrupteur → prise transporte le courant de la prise, ce n’est pas un « circuit de commande » au sens du tableau 5.1 | Aucune |
| sonnette | P1-1 : séparation TBTS, trois solutions (4.2.5.3 c) | Juste ; « Un fil de sonnette ordinaire n’est en général pas prévu pour cela » est prudent | Aucune |

### Autres affirmations d’obligation sans référence

| Article | Affirmation | Verdict | Action |
|---|---|---|---|
| prise-de-courant | « toute nouvelle prise a un contact de terre raccordé ; une broche de terre qui n’est reliée à rien est interdite » | Vrai (5.3.5.2 b ; interdiction explicite en 8.2.1, 6 et 8.2.2, et conséquence de 5.3.5.2 b en neuf) | Aucune |
| prise-de-courant | « Les prises de 16 A et 250 V au plus doivent offrir une protection IPXX-D » | Vrai (5.3.5.2 a, p. 167), exceptions signalées juste après | Aucune |
| prise-de-courant | « Le lave-linge, le sèche-linge et le lave-vaisselle sont aussi derrière un 30 mA » | Vrai (4.2.4.3 b, point 4) ; le paragraphe est désormais explicitement domestique | Aucune |
| prise-de-courant, sonnette, contacteur, etc. | Contrôle par un organisme agréé avant mise en service (neuf, modification ou extension importante) | Vrai (chapitre 6.4) | Aucune |
| prise-commandee | « différentiel de 30 mA dans une installation neuve » | Vrai en domestique (4.2.4.3 b, prises point 1) ; l’article est clairement domestique | Aucune |
| simple-allumage | « Un logement de plus de deux locaux compte au moins deux circuits d’éclairage distincts » | Vrai (5.3.5.2 b : « plus de deux locaux et/ou emplacements », p. 167), couvert par la référence en fin de phrase suivante | Aucune |
| simple-allumage | « chaque point lumineux reçoit la terre » (À retenir) | Vrai (5.4.3.6) | Aucune |
| variateur | « différentiel de 30 mA dans une installation neuve » | Partiel : vrai seulement en domestique (4.2.4.3 b) | Corrigé : « installation domestique neuve » |
| contacteur-jour-nuit | « à partir de 2 600 W, le circuit dédié est imposé par le RGIE » (À retenir) | Vrai en domestique ; le corps de l’article précise le champ | Aucune |
| contacteur-jour-nuit | « conducteur de protection vert-jaune raccordé à la cuve » | Vrai (4.2.4.3 a, appareil de classe I) | Aucune |
| double-allumage, prise-commandee | Retours « jamais en bleu » | Plus strict que le RGIE (le bleu n’est réservé que si le circuit a un neutre ; sur 3 × 230 V il ne l’est pas), mais non présenté comme une règle du RGIE : conseil acceptable | Aucune |
| telerupteur, minuterie, detecteur, variateur | Pas d’autre obligation présentée comme réglementaire ; les consignes (notice, charge minimale, neutre du même circuit) sont des bonnes pratiques présentées comme telles | OK | Aucune |

### Nouvelles références à ajouter

Aucune nouvelle référence : les corrections réutilisent des références déjà citées (5.3.5.2 b, 4.2.4.3 b, 8.2.1, 5.3.3.2 c). Pour mémoire, la phrase ajoutée dans contacteur-jour-nuit s’appuie sur 4.2.4.3 b, 10e alinéa, p. 101 : « Si la résistance de dispersion de la prise de terre est supérieure à 30 ohms […] maximum 100 mA par circuit ou groupe de circuits ». `npm run learn:check` sur les 12 slugs : OK.

### Points incertains (pour un spécialiste)

- contacteur-jour-nuit, 5.3.5.1 c : le texte parle de « circuits dont l’énergie est soumise à des tarifs différents ». L’article l’applique au compteur séparé (exclusif nuit), pas au chauffe-eau d’un compteur bihoraire unique ; lecture plausible, à confirmer.
- contacteur-jour-nuit : chauffe-eau placé dans une salle de bain : le chapitre 7.1 peut ajouter des exigences (volumes, 30 mA) au-delà de 4.2.4.3 b ; l’article renvoie seulement au circuit qui « dessert » la salle de bain.
- prise-de-courant : « depuis le 1er juin 2023 » simplifie la règle transitoire (projets entamés avant le 01/06/2023 et contrôlés après pouvant appliquer 6.5.8.1, 1).

### Bilan

42 paires : 36 Soutient, 6 Partiel, 0 Ne soutient pas.
Corrections faites (7 remplacements dans 5 articles) :
- prise-de-courant : champ domestique ajouté à la règle des 8 points (FAQ et liste) et au 30 mA (« installation domestique neuve ») ;
- simple-allumage : dérogation à un seul circuit d’éclairage limitée aux anciennes installations d’avant le 1/10/1981 (parties existantes) ;
- va-et-vient-trois-points : « aucun interrupteur ne doit commuter le neutre » remplacé par la règle exacte (interrupteur unipolaire jamais sur le neutre) ;
- contacteur-jour-nuit : ajout du différentiel de 100 mA au plus si la terre dépasse 30 ohms ;
- variateur : « installation domestique neuve ».
Les 8 corrections P1 du premier audit sont justes.

## Lot 4

Articles : tubes-et-boites, couleurs-des-fils, section-des-cables, types-de-cables, chute-de-tension, volet-roulant, moteur-de-volet, commande-groupee-volets, fenetre-motorisee, volets-domotique, bus-knx, preparer-cablage-domotique, relais-connectes, domotique-introduction, sans-fil-zigbee-wifi, scenarios-home-assistant.

Texte : livre1.txt (RGIE Livre 1, version 07). Pages = pieds de page imprimés. Les numéros de ligne sont ceux de l'article (ceux du lot quand l'extraction pointe la ligne JSON 17-20 des FAQ/retenir).

### Paires affirmation ↔ référence
| Article | Ligne | Réf. | Affirmation (extrait) | Verdict | Ce que dit le texte (citation courte, page) | Action |
|---|---|---|---|---|---|---|
| bus-knx | 17 (FAQ) | 4.2.5.3 c | Bus TBTS séparé des autres circuits : 10 mm, isolation supplémentaire (gaine, conduit) ou isolation pour la tension la plus élevée | Soutient | « une séparation physique d'au moins 10 mm… isolation supplémentaire (gaine, conduit...)… isolés… pour la tension la plus élevée » (p. 105-106) | Aucune. Le caractère TBTS du bus KNX vient des fabricants (signalé comme tel dans l'article). |
| bus-knx | 71 | 4.2.5.5 c | Comme tout circuit TBTS, le bus n'est relié ni à la terre ni aux autres circuits | Soutient | « Les parties actives du matériel électrique TBTS ne peuvent pas être reliées galvaniquement : à la prise de terre ; à des parties actives appartenant à d'autres circuits » (p. 106) | Aucune |
| bus-knx | 79 | 4.2.5.3 c | Le RGIE impose une séparation de protection TBTS / autres circuits (trois solutions) ; tubes distincts en pratique | Soutient | Idem 4.2.5.3 b-c (p. 105-106) ; les tubes distincts sont présentés comme pratique, pas comme obligation | Aucune |
| bus-knx | 84 | 4.2.4.3 b | Éclairage et prises derrière un 30 mA « dans le neuf » | Partiel | 4.2.4.3 = installations domestiques : « au moins les circuits suivants : 1. les socles… 2. l'éclairage » (p. 101) ; l'article parle aussi de KNX en bureaux | Corrigé : « dans une habitation neuve » |
| chute-de-tension | 19 et 96 | 5.2.5 | Le RGIE ne fixe pas de pourcentage ; chute compatible avec un fonctionnement sûr et limitée aux règles de l'art | Partiel | 5.2.5 : « limitées aux valeurs décrites dans les règles de l'art » (p. 138). Le « fonctionnement sûr » est en 5.2.1.2 b : « compatible avec un fonctionnement sûr des machines ou appareils » (p. 129) | Corrigé : « (RGIE, 5.2.1.2 b et 5.2.5) » aux deux endroits |
| commande-groupee-volets | 18 (FAQ) | 5.2.1.2 | Une dizaine de moteurs sous les 16 A d'un circuit 1,5 mm², sans prise | Partiel | 5.2.1.2 / tableau 5.1 soutient « sans socle de prise » (p. 129) ; le 16 A vient du tableau 4.11, domestique (p. 117) | Corrigé : 16 A attribué à 4.4.1.4 tableau 4.11 « dans une habitation », condition sans prise à 5.2.1.2 |
| commande-groupee-volets | 79 | 5.3.3.2 d | Le RGIE admet qu'un même dispositif commande plusieurs appareils à fonctionnement simultané | Soutient | « il est admis : qu'un même dispositif commande plusieurs machines ou appareils électriques dont le fonctionnement est simultané » (p. 159) | Aucune |
| couleurs-des-fils | 17 (FAQ) | 5.1.6.2 | Sans neutre (3 × 230 V), le bleu d'un câble multiconducteur peut servir à autre chose, jamais de terre | Soutient | « Lorsque le circuit ne comporte pas de conducteur neutre, le conducteur d'un câble multipolaire… bleue, peut être utilisé pour un autre usage, sauf comme conducteur de protection ou d'équipotentialité » (p. 128-129) | Aucune |
| couleurs-des-fils | 18 (FAQ) | 5.4.3.3 | Le RGIE impose le vert-jaune pour le PE (5.4.3.3) et le réserve à la terre et aux liaisons | Partiel | 5.4.3.3 impose la couleur du PE (p. 180) ; la réservation (pas d'autre usage) est en 5.1.6.2 (p. 128) | Corrigé : ajout « (RGIE, 5.1.6.2) » après la réservation |
| couleurs-des-fils | 73 (tableau) | 5.1.6.2 | Vert-jaune : exclusivement ; interdit pour une phase, un neutre ou un retour | Partiel | 5.1.6.2 admet le vert-jaune pour PE, équipotentialité « soit comme conducteur actif mis à la terre (PEN, PEM et PEL) » (p. 128) | Corrigé dans le paragraphe qui suit le tableau (l. 79) : mention du PEN, rare dans une maison |
| couleurs-des-fils | 74 (tableau) | 5.1.6.2 | Bleu réservé au neutre quand le circuit en a un | Soutient | « réservés au conducteur neutre dans les circuits comportant un tel conducteur » (p. 128) | Aucune |
| couleurs-des-fils | 84 | 5.1.6.2 | Navettes : bleu interdit car « un circuit d'éclairage comporte un neutre » | Partiel | Règle exacte (p. 128), mais généralisation fausse : sur 3 × 230 V le circuit d'éclairage n'a pas de neutre (et l'article lui-même l'explique plus bas) | Corrigé : « dès que le circuit d'éclairage comporte un neutre, ce qui est le cas sur un réseau 230 V avec neutre » + renvoi au 3 × 230 V |
| couleurs-des-fils | 88 | 5.1.6.2 | Le RGIE admet le bleu à un autre usage sans neutre, sauf terre | Soutient | Idem (p. 129) | Aucune |
| couleurs-des-fils | 89 | 4.4.4.1 | Sur 3 × 230 V, chacun des deux conducteurs doit être protégé contre les surintensités | Soutient | « Une détection de surintensité est prévue sur tous les conducteurs de ligne » (p. 119) ; en 3 × 230 V les deux conducteurs sont des conducteurs de ligne (voir aussi 4.4.4.2, domestique) | Aucune |
| domotique-introduction | 93 | 4.2.4.3 b | Éclairage et prises derrière un 30 mA dans une installation neuve | Soutient | Liste des circuits sous dispositif « haute ou très haute sensibilité » (≤ 30 mA, définition 2.x) (p. 101) ; article centré sur l'habitation | Aucune |
| fenetre-motorisee | 37 | 4.2.5.3 | Très basse tension ≠ TBTS : « cela dépend de la source » | Partiel | 4.2.5.3 a fixe les sources admises, mais 4.2.5.3 b-c (séparation de protection) et 4.2.5.5 c conditionnent aussi la TBTS (p. 105-106) | Corrigé : « de la source qui la produit et de la façon dont le circuit est installé, séparé des autres circuits » |
| fenetre-motorisee | 100 | 5.2.1.3 | Fils TBT mêlés au 230 V dans un câble/tube sans isolation 230 V : interdit | Soutient | « peut contenir des circuits à tensions différentes à condition que les conducteurs soient isolés… pour la tension la plus élevée présente » (p. 130) | Aucune |
| fenetre-motorisee | 102 | 4.2.4.3 a | Masses d'un appareil de classe I reliées au PE | Soutient | « Les masses du matériel électrique à basse tension de la classe I sont reliées au conducteur de protection » (p. 100, domestique) | Aucune |
| fenetre-motorisee | 106 | 5.3.3.2 e | Sauf raison de sécurité prépondérante, pas de redémarrage automatique dangereux après arrêt | Soutient | « Sauf pour des raisons prépondérantes de sécurité… empêchée la réalimentation automatique des moteurs dont le redémarrage est alors susceptible de provoquer un danger » (p. 159) | Aucune |
| fenetre-motorisee | 107 | 5.5.7.3 | Le RGIE consacre des règles particulières aux exutoires (par exemple 5.5.7.3) | Soutient | Dérogation de surcharge pour les moteurs d'installation de sécurité, « Pour exemple : les moteurs utilisés pour le système d'évacuation de la fumée et de la chaleur (EFC) » (p. 187) | Aucune (citée comme exemple, sans détail) |
| moteur-de-volet | 51 | 5.1.6.2 | Bleu normalement neutre, vert-jaune terre, couleurs réservées par le RGIE | Soutient | p. 128-129 ; « normalement » couvre le cas sans neutre | Aucune |
| moteur-de-volet | 96 | 4.2.4.3 a | Corps métallique : masses de classe I reliées au PE | Soutient | p. 100 | Aucune |
| preparer-cablage-domotique | 32 | 3.2.4.1 | Neutre du même circuit que la phase : un circuit ne peut être alimenté involontairement par un autre | Soutient | « Ces circuits sont conçus et réalisés de façon qu'ils ne puissent pas être alimentés involontairement par un autre circuit » (p. 67) ; l'application au neutre est une déduction raisonnable | Aucune |
| preparer-cablage-domotique | 69 | 4.2.4.3 b | Éclairage et prises derrière 30 mA dans le neuf, 8 circuits terminaux au plus par 30 mA | Soutient | « au maximum 8 circuits terminaux par dispositif » (p. 101) ; article sur l'habitation | Aucune |
| preparer-cablage-domotique | 69 | 5.2.1.3 | Plusieurs circuits dans un même câble/conduit si isolés pour la tension la plus élevée | Soutient | p. 130 | Aucune |
| preparer-cablage-domotique | 90 | 3.3.3 | Séparation suffisante entre câbles de télécommunication et canalisations d'énergie | Soutient | « séparation suffisante entre les câbles de télécommunication et les autres canalisations électriques » (p. 68) | Aucune (tubes distincts présentés comme moyen, pas obligation) |
| relais-connectes | 100 | 5.1.5.1 | Les connexions doivent rester accessibles | Soutient | « installés de manière à rendre aisés… l'accès à leurs connexions », y compris en enveloppe (p. 128) | Aucune |
| relais-connectes | 101 | 5.1.3.1 | Matériel présumé sûr s'il est conforme aux règles belges de mise sur le marché | Soutient | « présumé offrir la sécurité requise… s'il est conforme aux critères du Code Economique, en son Livre IX » (p. 127) | Aucune (CE présenté comme conseil) |
| relais-connectes | 117 | 5.1.6.2 | Dans un circuit avec neutre, le bleu lui est réservé | Soutient | p. 128 | Aucune |
| section-des-cables | 17 (FAQ) | 4.4.1.4 | Domestique : disjoncteur limité à 16 A sur 1,5 mm² | Soutient | « Pour les installations domestiques… tableau 4.11 » : 1,5 → 16 A (p. 116-117) | Aucune |
| section-des-cables | 18 (FAQ) | 5.2.1.2 | Conducteur < 2,5 mm² admis seulement dans un circuit sans prise | Partiel | Tableau 5.1 : « à l'exception de socle de prise de courant unique d'une intensité nominale de 2,5 A intégré dans des luminaires » + socle simple en tableau (p. 129) | Corrigé : « à de rares exceptions près comme une petite prise de 2,5 A intégrée à un luminaire (RGIE, 5.2.1.2, tableau 5.1) » |
| section-des-cables | 37 | 4.4.1.4 | Domestique : le RGIE fixe le calibre maximal selon la section (tableau 4.11) | Soutient | p. 116-117 ; valeurs du tableau de l'article vérifiées ligne à ligne | Aucune |
| section-des-cables | 49 | 4.4.1.4 | Courant admissible selon isolant, construction, pose, température | Soutient | « fonction : de la section… de l'isolation… de la constitution… du mode de pose… de la température ambiante » (p. 116) ; Iz ≥ IB : 5.2.1.2 a | Aucune |
| section-des-cables | 87 | 5.2.1.2 | < 2,5 mm² interdit en principe ; 1,5 mm² sans prise ; plus faible pour commande/signalisation/mesure | Soutient | p. 129 | Aucune |
| section-des-cables | 88 | 5.3.5.2 b | Circuit avec prise : 2,5 mm², 20 A au plus, 8 socles au plus | Partiel | 5.3.5.2 b ne contient que les 8 socles simples ou multiples (domestique, p. 167) ; 2,5 mm² vient de 5.2.1.2, 20 A du tableau 4.11 (et n'est un maximum que pour 2,5 mm²) | Corrigé : chaque exigence attribuée à sa référence ; « protégé en 2,5 mm² par 20 A au plus » ; « Dans une habitation » |
| section-des-cables | 89 | 5.2.1.2 | Liste des circuits dédiés | Partiel | « Dans les installations domestiques, chaque appareil… ≥ 2600 W… lave-linge… four… chauffage électrique à poste fixe » (p. 129-130) : champ domestique omis | Corrigé : « dans une habitation, le RGIE cite » |
| tubes-et-boites | 36 | 5.2.9.6 | Goulotte avec fils sans gaine : parois pleines, couvercle à outil | Soutient | « goulottes… à parois pleines et munies d'un couvercle, qu'on ne peut ouvrir qu'à l'aide d'un outil » (hors locaux de service électrique) (p. 146) | Aucune |
| tubes-et-boites | 38 | 5.2.7.4 | Tubes non propagateurs ; propagateur seulement noyé sous 3 cm de matériau non combustible | Soutient | « encastrés dans des matériaux non combustibles avec un recouvrement minimal de 3 cm » (p. 141) | Aucune |
| tubes-et-boites | 39 (et retenir l. 11) | 5.2.9.10 | VOB toujours dans un tube, car interdit de noyer un conducteur à isolation principale | Partiel | Interdiction exacte (5.2.9.10 a et b, p. 146) ; mais « toujours dans un tube » est trop large : goulottes fermées (5.2.9.6) et moulures/plinthes (5.2.9.4) admettent aussi des conducteurs isolés | Corrigé : « encastrés passent toujours dans un tube » ; en surface tube, goulotte fermée ou moulure, jamais à l'air libre (5.2.9.5) ; retenir ajusté |
| tubes-et-boites | 42 | 5.2.9.3 d | Pouvoir tirer et retirer facilement les conducteurs | Soutient | « possible de tirer et de retirer facilement les conducteurs ou câbles après la pose » (p. 144) | Aucune |
| tubes-et-boites | 82 | 5.2.6.1 + 5.2.9.3 f | Connexions dans une boîte ; aucune connexion dans un conduit | Soutient | 5.2.9.3 f : « Il est interdit… d'introduire des connexions, jonctions ou ligatures entre les conducteurs dans les conduits » (p. 145) ; 5.2.6.1 liste les emplacements admis (p. 139) | Aucune |
| tubes-et-boites | 83 (et FAQ 18) | 5.2.9.3 i | Boîte de dérivation accessible, exigé pour les conduits encastrés | Soutient | « Dans les boîtes de jonction, de dérivation et de tirage, les conducteurs ou les câbles restent accessibles » (5.2.9.3 i.2, p. 145) | Aucune |
| tubes-et-boites | 85 (et FAQ 19) | 4.5.4 | Interdit : conducteurs d'énergie et de télécom côte à côte sans écran, sauf câbles | Partiel | Interdiction exacte, mais exception omise : « ne s'applique pas aux conducteurs de télécommunication lorsqu'ils relient le matériel électrique situé dans les lieux de service électrique ou dans des lieux ordinaires qui ne sont pas considérés comme des lieux accessibles au public » (p. 121) | Corrigé : « en règle générale » + mention des exceptions (l. 85 et FAQ) ; tube par usage gardé comme bonne pratique ; portée de l'exception signalée au spécialiste |
| tubes-et-boites | 86 | 5.2.9.10 b | Câble noyé sans tube : tracés 25-35 cm, 10-20 cm du chambranle, à la verticale d'un appareil | Soutient | « entre 25 et 35 cm du plancher ou du plafond… entre 10 et 20 cm des chambranles… à la verticale d'une machine ou appareil électrique visibles » (p. 146) | Aucune |
| types-de-cables | 19 (FAQ) | 5.2.9.3 f | Le RGIE interdit les cordons souples dans des conduits | Partiel | Texte limité : « des cordelières, des fils du type rosette ou des cordons souples CSuB ou similaires » (p. 145) | Corrigé : « les cordons souples légers (type CSuB ou similaires) » ; le « non » pour un circuit fixe repose sur l'usage prévu du câble |
| types-de-cables | 32 | 5.2.9.10 + 5.2.9.5 | Interdit de noyer un conducteur à isolation principale ; seuls des câbles en apparent | Soutient | 5.2.9.10 (p. 146) ; 5.2.9.5 : « seul le placement de câbles est admis pour la pose à l'air libre et le montage en apparent » (sauf PE/PEN indépendants, p. 146) | Aucune |
| types-de-cables | 95 | 5.2.9.2 | Enterré : 0,60 m sauf impossibilité (fourreau) ; armure, ou couverture, ou fourreau | Partiel | 0,60 m et fourreau exacts (p. 142) ; la première option est « munis d'un écran de protection avec mise à la terre et… soit… armure, soit… gaine renforcée » ; la deuxième exige une gaine résistante en plus de la couverture | Corrigé : les trois options décrites exactement |
| volet-roulant | 20 (FAQ) | 5.2.1.2 | Les volets ne font pas partie des appareils qui exigent un circuit dédié | Soutient | Liste p. 129-130 ; un moteur de volet est très loin de 2 600 W | Aucune |
| volet-roulant | 20 (FAQ) | 5.2.1.2 | En 1,5 mm², 16 A au plus en habitation, sans prise | Partiel | Sans prise : tableau 5.1 (p. 129) ; 16 A : tableau 4.11 (p. 117) | Corrigé : ajout « (RGIE, 4.4.1.4, tableau 4.11) » |
| volet-roulant | 20 (FAQ) | 5.3.5.2 b | Circuit avec prises : chaque volet avec sa commande compte comme une prise (limite 8) | Soutient | « un appareil fixe ou un ensemble d'appareils fixes commandé par un appareil de manœuvre commun étant assimilé à un socle » (p. 167) | Aucune |
| volet-roulant | 87 | 5.1.6.2 | Le bleu est réservé au neutre, le vert-jaune à la terre | Partiel | Réservation du bleu « dans les circuits comportant un tel conducteur » (p. 128) | Corrigé : « dans un circuit qui en comporte un » |
| volet-roulant | 93 | 5.2.1.2 | 1,5 mm² admis avec 16 A au plus, sans prise | Partiel | Même remarque que la FAQ | Corrigé : 16 A attribué à 4.4.1.4 tableau 4.11 « dans une habitation » |
| volet-roulant | 117 | 5.3.3.2 c | Commande unipolaire jamais sur le neutre : interdit | Soutient | « Sauf pour l'exécution des mesures, un dispositif de commande unipolaire n'est pas placé sur le conducteur neutre » (p. 159) | Aucune |
| volet-roulant | 118 | 4.2.4.3 a | Fil vert-jaune du moteur (classe I) raccordé au PE | Soutient | p. 100 | Aucune |
| volet-roulant | 120 | 4.2.4.3 b | Derrière un différentiel ; mêlé à l'éclairage → 30 mA au plus | Soutient | Différentiel ≤ 300 mA à l'origine ; éclairage sous ≤ 30 mA (p. 100-101) | Aucune |
| volets-domotique | 114 | 5.2.1.3 | Bus et 230 V dans un même câble/tube seulement si « tous » isolés pour la tension la plus élevée | Partiel | « à condition que les conducteurs soient isolés, soit individuellement, soit collectivement, pour la tension la plus élevée » (p. 130) : l'isolation peut être collective (gaine) ; pour un bus TBTS, 4.2.5.3 c s'ajoute | Corrigé : « si ses conducteurs sont isolés, individuellement ou par sa gaine… » + lien vers bus-knx.html#cable |

### Corrections P0/P1 du premier audit
| Article | Correction revue | Verdict (juste / à compléter / erronée) | Action |
|---|---|---|---|
| couleurs-des-fils | P1 #2 : FAQ bleu comme phase (interdit avec neutre, admis sans neutre, jamais terre) | Juste | Aucune |
| couleurs-des-fils | P1 #3 : repérage interdit pour vert-jaune et pour bleu avec neutre ; 3G1,5 en va-et-vient ne convient pas | Juste (dans un circuit avec neutre) ; une phrase voisine (l. 84) généralisait « un circuit d'éclairage comporte un neutre » | l. 84 corrigée (voir paires) |
| types-de-cables | P1 #1 : VFVB n'est pas le H05VV-F ; VFVB = câble à armure | Juste (8.x, livre1 l. 16248 : « câbles munis d'une armure métallique tels que du type VFVB ») | Aucune |
| types-de-cables | P1 #2 : enterré, 0,60 m et trois protections | À compléter : la première option était réduite à « armure » (écran mis à la terre omis) et la deuxième omettait la gaine résistante | Corrigé (voir paires) |
| section-des-cables | P1 #1 : le RGIE fixe le calibre maximal (domestique, tableau 4.11) | Juste | Aucune |
| section-des-cables | P1 #2 : tableau disjoncteur / fusible | Juste : valeurs vérifiées (1,5 → 16/10 ; 2,5 → 20/16 ; 4 → 25/20 ; 6 → 40/32 ; 10 → 63/50 ; 16 → 80/63), SVG et aria-label cohérents | Aucune |
| tubes-et-boites | P1 #1 : interdiction 4.5.4 au lieu d'une bonne pratique | À compléter : l'exception de 4.5.4 (lieux de service électrique, lieux non accessibles au public) avait été omise, ce qui fait d'une règle à portée discutée une interdiction absolue | Corrigé : « en règle générale » + exceptions ; point pour spécialiste |
| volet-roulant | P1 #1 : FAQ circuit séparé (pas obligatoire ; 1,5 mm² sans prise ; volet = socle sur circuit mixte) | Juste sur le fond ; le 16 A était attribué à 5.2.1.2 au lieu du tableau 4.11 | Référence corrigée |
| volet-roulant | P1 #3 : « 1,5 mm² admis avec 16 A, sans prise, sinon 2,5 mm² » | Juste ; même erreur de sous-référence | Référence corrigée |
| fenetre-motorisee | P1 #2 : erreur ajoutée « fils TBT mêlés au 230 V… interdit (5.2.1.3) » | Juste | Aucune |
| bus-knx | P1 #1 : séparation TBTS (4.2.5.3 c), tubes séparés = bonne pratique | Juste ; pas d'exagération (les tubes séparés restent une pratique) | Aucune |

(Aucune ligne P0 ne concerne les articles du lot.)

### Autres affirmations d'obligation sans référence
| Article | Affirmation | Verdict | Action |
|---|---|---|---|
| tubes-et-boites l. 38 | Tube plastique interdit au-delà de 60 °C | Vrai : 5.2.9.3 f (p. 145) | Aucune |
| tubes-et-boites l. 43 | Rayons de courbure 8 / 5 / 10 fois le diamètre | Vrai : 5.2.9.3 e (p. 144) | Aucune |
| tubes-et-boites l. 83 | Boîtes en métal ou isolant non propagateur | Vrai (5.2.6.1 admet aussi le bois ignifugé, p. 139) | Aucune |
| couleurs-des-fils l. 79 | Vert ou jaune seuls interdits pour un actif, sauf commande/signalisation < 1,5 mm² | Vrai : 5.1.6.2 (p. 128) | Aucune |
| couleurs-des-fils l. 107 | Le RGIE réserve le bleu au neutre mais n'oblige pas le neutre à être bleu | Vrai (5.1.6.2 ne contient pas d'obligation inverse) | Aucune |
| types-de-cables l. 32 | Fil jamais dans un vide de plafond | Vrai : 5.2.9.9 « interdit de placer des conducteurs uniquement pourvus d'une isolation principale dans les vides de construction » (p. 146) | Aucune |
| types-de-cables l. 95 | Un VOB n'est jamais enterré, même sous tube | Vrai : 5.2.9.2 a, seuls des câbles conformes pour cet usage dans le sol et les fourreaux souterrains inaccessibles (p. 142) | Aucune |
| relais-connectes l. 110 | Le RGIE demande que les boîtes de connexion figurent sur l'unifilaire et le plan de position | Vrai : 3.1.2.2 a et 3.1.2.3 a (domestique, p. 64) | Aucune (référence possible : 3.1.2.2 a) |
| relais-connectes / domotique-introduction | Le tableau 2.23 prévoit un symbole d'unité de commande domotique | Vrai : tableau 2.23, « J. Domotique », p. 57 | Aucune |
| fenetre-motorisee l. 32 | Salle de bain : moteur et commande selon les volumes (chapitre 7.1) | Vrai | Aucune |
| bus-knx l. 106, volet-roulant l. 120, etc. | Installation neuve, modification ou extension importante contrôlée par un organisme agréé | Vrai (6.5) | Aucune |
| volets-domotique, commande-groupee-volets l. 106 | « le RGIE ne l'impose pas » (circuit réservé aux volets) | Vrai (5.2.1.2 ne cite pas les volets) | Aucune |
| sans-fil-zigbee-wifi, scenarios-home-assistant | Pas d'affirmation réglementaire ; « doit » = conseils de conception (commande locale, arrêt sûr) | Conseils, non présentés comme RGIE | Aucune |

### Nouvelles références à ajouter
- **5.2.1.2 b** (chute-de-tension), p. 129 : « la chute de tension, dans les conditions normales de service, soit compatible avec un fonctionnement sûr des machines ou appareils électriques alimentés ».
- **5.2.9.5** (tubes-et-boites), p. 146 : « seul le placement de câbles est admis pour la pose à l'air libre et le montage en apparent ».
- (Déjà reconnues par learn:check mais nouvelles dans ces articles : 4.4.1.4 tableau 4.11 dans volet-roulant et commande-groupee-volets, 4.4.1.4 dans la puce 88 de section-des-cables, 5.1.6.2 dans la FAQ 18 de couleurs-des-fils.)

### Points incertains (pour un spécialiste)
1. **4.5.4, portée de l'exception** (p. 121) : « ne s'applique pas aux conducteurs de télécommunication lorsqu'ils relient le matériel électrique situé… dans des lieux ordinaires qui ne sont pas considérés comme des lieux accessibles au public ». Dans une maison privée, cette exception vise-t-elle seulement les liaisons de commande entre matériels électriques, ou aussi les câbles réseau/téléphone ? L'article dit désormais « en règle générale » et mentionne les exceptions, sans trancher.
2. **Bus KNX en TBTS** : le classement TBTS du bus vient des fabricants ; sa gaine compte-t-elle comme « isolation supplémentaire » au sens de 4.2.5.3 c, ce qui permettrait légalement le même tube que des fils 230 V ? L'article renvoie aux fabricants et conseille des tubes séparés.
3. **Tableau 5.1** : l'extraction mélange les colonnes (1,5 / 0,75 / 0,5 mm²). Lecture retenue : 1,5 mm² pour circuits sans socle, 0,75 mm² pour un socle simple intégré à un tableau, 0,5 mm² pour commande/signalisation/mesure. À confirmer sur le PDF (n'affecte que la formulation « sections plus faibles pour les circuits de commande »).
4. **Rallonge/câble souple encastré** : le RGIE n'interdit explicitement que les cordons légers (CSuB ou similaires) dans les conduits ; le « non » de la FAQ de types-de-cables repose sur l'usage prévu des câbles souples (fabricants), pas sur un article précis.

### Bilan : nombre de paires Soutient / Partiel / Ne soutient pas ; corrections faites
- 56 paires : **38 Soutient, 18 Partiel, 0 Ne soutient pas**.
- Corrections faites dans 11 articles : bus-knx, chute-de-tension, commande-groupee-volets, couleurs-des-fils (3), fenetre-motorisee, section-des-cables (3), tubes-et-boites (4 endroits), types-de-cables (2), volet-roulant (3), volets-domotique. Aucune modification pour moteur-de-volet, preparer-cablage-domotique, relais-connectes, domotique-introduction, sans-fil-zigbee-wifi, scenarios-home-assistant.
- Erreurs principales : sous-références fausses pour le 16 A sur 1,5 mm² (attribué à 5.2.1.2 au lieu du tableau 4.11) ; « un circuit d'éclairage comporte un neutre » faux en 3 × 230 V ; exception de 4.5.4 omise par la correction P1 ; protections des câbles enterrés simplifiées (écran mis à la terre omis) ; « VOB toujours dans un tube » trop large ; champ domestique omis (circuits dédiés, 30 mA).
- learn:check sur les 16 slugs : OK sauf les deux références nouvelles 5.2.1.2 b et 5.2.9.5 (à ajouter à rgieRefs).
