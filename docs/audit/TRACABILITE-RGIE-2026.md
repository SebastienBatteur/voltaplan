# Matrice de traçabilité réglementaire (RGIE, Livre 1, version 07)

Générée le 27/11/2026 à partir des articles (`learn/fr`), du catalogue (`src/rules/be/catalog.ts`) et des tests.
Statut de validation humaine : aucune exigence n'est encore validée par un spécialiste ; les points en débat sont
listés dans `VALIDATION-EXTERNE-RGIE.md`. « Vérifiée (texte) » = contenu relu dans le texte officiel par l'audit et
le contre-audit de 2026.

## 1. Par référence

| Référence | Articles qui la citent | Règles du moteur | Tests | Statut |
|---|---|---|---|---|
| 2.4.1 | tension | — | — | Vérifiée (texte) |
| 2.6.4 | differentiel, surcharge-court-circuit | — | — | Vérifiée (texte) |
| 3.1.2 | controle-organisme-agree, dossier-installation | — | — | Vérifiée (texte) |
| 3.1.2.1 | controle-organisme-agree, dossier-installation, lire-unifilaire | — | — | Vérifiée (texte) |
| 3.1.2.2 a | dossier-installation, lire-unifilaire | — | — | Vérifiée (texte) |
| 3.1.2.3 a | plan-de-position | — | — | Vérifiée (texte) |
| 3.1.3.1 | organiser-tableau | — | — | Vérifiée (texte) |
| 3.1.3.3 a | organiser-tableau | — | — | Vérifiée (texte) |
| 3.2.4.1 | preparer-cablage-domotique | — | — | Vérifiée (texte) |
| 3.3.3 | preparer-cablage-domotique | — | — | Vérifiée (texte) |
| 4.2.2.2 | sonnette | — | — | Vérifiée (texte) |
| 4.2.3.2 | liaisons-equipotentielles, mise-a-la-terre, resistance-de-terre | R-EARTH-VALUE | rules.matrix.test.ts, rules.rgie2026.test.ts | Vérifiée (texte) |
| 4.2.3.4 a | liaisons-equipotentielles | — | — | Vérifiée (texte) |
| 4.2.4.3 a | fenetre-motorisee, moteur-de-volet, simple-allumage, volet-roulant | — | — | Vérifiée (texte) |
| 4.2.4.3 b | bus-knx, contacteur-jour-nuit, controle-organisme-agree, courant, differentiel, differentiel-qui-saute, domotique-introduction, mise-a-la-terre, organiser-tableau, preparer-cablage-domotique, prise-de-courant, resistance-de-terre, simple-allumage, test-differentiel, volet-roulant | — | — | Vérifiée (texte) |
| 4.2.5.3 | fenetre-motorisee, tension | — | — | Vérifiée (texte) |
| 4.2.5.3 c | bus-knx, sonnette, telerupteur | — | — | Vérifiée (texte) |
| 4.2.5.5 c | bus-knx, telerupteur | — | — | Vérifiée (texte) |
| 4.4.1.4 | commande-groupee-volets, contacteur-jour-nuit, courant, disjoncteur, disjoncteur-qui-saute, prise-commandee, prise-de-courant, resistance-loi-ohm, section-des-cables, simple-allumage, volet-roulant | R-CABLE-PROT | rules.matrix.test.ts, rules.rgie2026.test.ts | Vérifiée (texte) |
| 4.4.2.1 | courbes-disjoncteur, disjoncteur | — | — | Vérifiée (texte) |
| 4.4.3.2 | surcharge-court-circuit | — | — | Vérifiée (texte) |
| 4.4.4.1 | couleurs-des-fils | — | — | Vérifiée (texte) |
| 4.4.4.2 | disjoncteur, organiser-tableau | — | — | Vérifiée (texte) |
| 4.5.1 | parafoudre | — | — | Vérifiée (texte) |
| 4.5.3 | parafoudre | — | — | Vérifiée (texte) |
| 4.5.4 | tubes-et-boites | — | — | Vérifiée (texte) |
| 5.1.3.1 | relais-connectes | — | — | Vérifiée (texte) |
| 5.1.5.1 | relais-connectes | — | — | Vérifiée (texte) |
| 5.1.6.2 | couleurs-des-fils, double-allumage, moteur-de-volet, relais-connectes, simple-allumage, va-et-vient, volet-roulant | — | — | Vérifiée (texte) |
| 5.2.1.2 | commande-groupee-volets, contacteur-jour-nuit, courant, disjoncteur, organiser-tableau, prise-commandee, prise-de-courant, puissance-energie, section-des-cables, surcharge-court-circuit, volet-roulant | R-DEDICATED-CIRCUIT | rules.rgie2026.test.ts, trikker.test.ts | Vérifiée (texte) |
| 5.2.1.2 b | chute-de-tension | — | — | Vérifiée (texte) |
| 5.2.1.3 | fenetre-motorisee, preparer-cablage-domotique, volets-domotique | — | — | Vérifiée (texte) |
| 5.2.5 | — | — | — | Vérifiée (texte) |
| 5.2.6.1 | tubes-et-boites | — | — | Vérifiée (texte) |
| 5.2.7.4 | tubes-et-boites | — | — | Vérifiée (texte) |
| 5.2.9.2 | types-de-cables | — | — | Vérifiée (texte) |
| 5.2.9.3 d | tubes-et-boites | — | — | Vérifiée (texte) |
| 5.2.9.3 f | types-de-cables | — | — | Vérifiée (texte) |
| 5.2.9.3 i | tubes-et-boites | — | — | Vérifiée (texte) |
| 5.2.9.5 | tubes-et-boites | — | — | Vérifiée (texte) |
| 5.2.9.6 | tubes-et-boites | — | — | Vérifiée (texte) |
| 5.2.9.10 | tubes-et-boites, types-de-cables | — | — | Vérifiée (texte) |
| 5.2.9.10 b | tubes-et-boites | — | — | Vérifiée (texte) |
| 5.3.3.2 c | double-allumage, prise-commandee, simple-allumage, telerupteur, va-et-vient, va-et-vient-trois-points, volet-roulant | — | — | Vérifiée (texte) |
| 5.3.3.2 d | commande-groupee-volets | — | — | Vérifiée (texte) |
| 5.3.3.2 e | fenetre-motorisee | — | — | Vérifiée (texte) |
| 5.3.5.1 c | contacteur-jour-nuit | — | — | Vérifiée (texte) |
| 5.3.5.2 a | prise-de-courant | — | — | Vérifiée (texte) |
| 5.3.5.2 b | prise-commandee, prise-de-courant, section-des-cables, simple-allumage, surcharge-court-circuit, volet-roulant | R-SOCKET-MAX | rules.matrix.test.ts, rules.rgie2026.test.ts | Vérifiée (texte) |
| 5.3.5.3 a | differentiel, organiser-tableau | R-RCD-TYPE-A, R-RCD-HEAD-RATING | rules.rgie2026.test.ts | Vérifiée (texte) |
| 5.3.5.3 f | differentiel | — | — | Vérifiée (texte) |
| 5.3.5.3 g | mise-a-la-terre | — | — | Vérifiée (texte) |
| 5.3.5.4 a | prise-commandee, variateur | — | — | Vérifiée (texte) |
| 5.3.5.5 a | disjoncteur | — | — | Vérifiée (texte) |
| 5.3.5.5 e | disjoncteur | — | — | Vérifiée (texte) |
| 5.3.5.5 h | disjoncteur | — | — | Vérifiée (texte) |
| 5.4.2.1 | resistance-de-terre | — | — | Vérifiée (texte) |
| 5.4.2.1 b | mise-a-la-terre, resistance-de-terre | — | — | Vérifiée (texte) |
| 5.4.2.1 c | resistance-de-terre | — | — | Vérifiée (texte) |
| 5.4.3.3 | couleurs-des-fils | — | — | Vérifiée (texte) |
| 5.4.3.5 | mise-a-la-terre | — | — | Vérifiée (texte) |
| 5.4.3.6 | mise-a-la-terre, simple-allumage | — | — | Vérifiée (texte) |
| 5.4.4.1 | liaisons-equipotentielles | — | — | Vérifiée (texte) |
| 5.4.4.1 b | liaisons-equipotentielles | — | — | Vérifiée (texte) |
| 5.5.7.3 | fenetre-motorisee | — | — | Vérifiée (texte) |
| 6.4.1 | controle-organisme-agree, electricite-c-est-quoi | — | — | Vérifiée (texte) |
| 6.4.5.1 | controle-organisme-agree, resistance-isolement | — | — | Vérifiée (texte) |
| 6.4.5.2 | controle-organisme-agree, resistance-de-terre | — | — | Vérifiée (texte) |
| 6.4.6.2 | controle-organisme-agree | — | — | Vérifiée (texte) |
| 6.4.6.4 | continuite, controle-organisme-agree, resistance-de-terre, test-differentiel | — | — | Vérifiée (texte) |
| 6.4.7.3 | controle-organisme-agree, disjoncteur-qui-saute | — | — | Vérifiée (texte) |
| 6.5.1 | controle-organisme-agree | — | — | Vérifiée (texte) |
| 6.5.2 | controle-organisme-agree | — | — | Vérifiée (texte) |
| 6.5.8.1 | differentiel, mise-a-la-terre | — | — | Vérifiée (texte) |
| 7.1.4.3 | — | — | — | Vérifiée (texte) |
| 7.1.4.4 | liaisons-equipotentielles | — | — | Vérifiée (texte) |
| 7.22.3 | organiser-tableau | R-DEDICATED-CIRCUIT | rules.rgie2026.test.ts, trikker.test.ts | Vérifiée (texte) |
| 8.2.1 | controle-organisme-agree, differentiel, dossier-installation, liaisons-equipotentielles, plan-de-position, prise-de-courant, simple-allumage | — | — | Vérifiée (texte) |
| 8.2.2 | controle-organisme-agree, dossier-installation | — | — | Vérifiée (texte) |
| 8.4.1 | controle-organisme-agree | — | — | Vérifiée (texte) |
| 8.4.2 | controle-organisme-agree | — | — | Vérifiée (texte) |
| 9.1.2 | dossier-installation | — | — | Vérifiée (texte) |
| 9.1.3.1 | controle-organisme-agree | — | — | Vérifiée (texte) |
| 9.1.3.2 | controle-organisme-agree | — | — | Vérifiée (texte) |
| 9.3.4.2 a | differentiel-qui-saute, disjoncteur-qui-saute | — | — | Vérifiée (texte) |
| 9.3.4.2 d | — | — | — | Vérifiée (texte) |

## 2. Par règle du moteur

| Règle | Article RGIE renseigné | Tests qui la citent | Articles pédagogiques liés (même référence) | Validation |
|---|---|---|---|---|
| R-BONDING | à renseigner | rules.matrix.test.ts, rules.test.ts | — | needsReview |
| R-CABLE-DATA-MISSING | à renseigner | **aucun** | — | needsReview |
| R-CABLE-MIN | à renseigner | rules.matrix.test.ts | — | needsReview |
| R-CABLE-NO-OVERCURRENT | à renseigner | rules.matrix.test.ts | — | needsReview |
| R-CABLE-PROT | 4.4.1.4 (tableau 4.11) | rules.matrix.test.ts, rules.rgie2026.test.ts | commande-groupee-volets, contacteur-jour-nuit, courant, disjoncteur, disjoncteur-qui-saute, prise-commandee, prise-de-courant, resistance-loi-ohm, section-des-cables, simple-allumage, volet-roulant | needsReview |
| R-CABLE-SECTION-MISSING | à renseigner | rules.matrix.test.ts | — | needsReview |
| R-CIRCUIT-NAME | à renseigner | rules.matrix.test.ts | — | needsReview |
| R-COUNTRY-OPTION | à renseigner | bom.test.ts | — | needsReview |
| R-DEDICATED-CIRCUIT | 5.2.1.2 ; 7.22.3 | rules.rgie2026.test.ts, trikker.test.ts | commande-groupee-volets, contacteur-jour-nuit, courant, disjoncteur, organiser-tableau, prise-commandee, prise-de-courant, puissance-energie, section-des-cables, surcharge-court-circuit, volet-roulant | needsReview |
| R-DOC-ADDRESS | à renseigner | **aucun** | — | needsReview |
| R-DOC-INSTALLER | à renseigner | rules.matrix.test.ts | — | needsReview |
| R-DOC-NOT-DRAWN | à renseigner | rules.matrix.test.ts | — | needsReview |
| R-DOC-NUMBER | à renseigner | rules.matrix.test.ts | — | needsReview |
| R-DOC-QUALITY | à renseigner | rules.matrix.test.ts | — | needsReview |
| R-DOC-SUPPLY | à renseigner | **aucun** | — | needsReview |
| R-EARTH-30 | à renseigner | rules.rgie2026.test.ts | — | needsReview |
| R-EARTH-MISSING | à renseigner | rules.matrix.test.ts, rules.test.ts | — | needsReview |
| R-EARTH-VALUE | 4.2.3.2 | rules.matrix.test.ts, rules.rgie2026.test.ts | liaisons-equipotentielles, mise-a-la-terre, resistance-de-terre | needsReview |
| R-EV-MANUAL | à renseigner | rules.matrix.test.ts | — | needsReview |
| R-ICC-LMAX | à renseigner | **aucun** | — | needsReview |
| R-INSTALL-DATE | à renseigner | rules.matrix.test.ts | — | needsReview |
| R-INSULATION | à renseigner | **aucun** | — | needsReview |
| R-MEAS-MISSING | à renseigner | rules.matrix.test.ts, rules.test.ts | — | needsReview |
| R-OLD-RGIE | à renseigner | rules.matrix.test.ts | — | needsReview |
| R-POLES-NO-NEUTRAL | à renseigner | rules.matrix.test.ts | — | needsReview |
| R-PROT-KA-MISSING | à renseigner | rules.matrix.test.ts | — | needsReview |
| R-PROT-RATING-MISSING | à renseigner | assist.test.ts, rules.matrix.test.ts | — | needsReview |
| R-PV-MANUAL | à renseigner | rules.matrix.test.ts | — | needsReview |
| R-RCD-HEAD-RATING | 5.3.5.3 a | rules.rgie2026.test.ts | differentiel, organiser-tableau | needsReview |
| R-RCD-MAIN | à renseigner | rules.matrix.test.ts | — | needsReview |
| R-RCD-SELECTIVITY | à renseigner | **aucun** | — | needsReview |
| R-RCD-SENS-MISSING | à renseigner | rules.matrix.test.ts | — | needsReview |
| R-RCD-TEST | à renseigner | rules.matrix.test.ts | — | needsReview |
| R-RCD-TRIP | à renseigner | rules.test.ts | — | needsReview |
| R-RCD-TYPE-A | 5.3.5.3 a | rules.rgie2026.test.ts | differentiel, organiser-tableau | needsReview |
| R-RCD30 | à renseigner | rules.matrix.test.ts | — | needsReview |
| R-RCD30-DATE | à renseigner | rules.matrix.test.ts | — | needsReview |
| R-RCD30-MAX | à renseigner | rules.matrix.test.ts | — | needsReview |
| R-RULESET-UNKNOWN | à renseigner | rules.test.ts | — | needsReview |
| R-SOCKET-CHILD | à renseigner | rules.matrix.test.ts | — | needsReview |
| R-SOCKET-EARTH | à renseigner | rules.matrix.test.ts | — | needsReview |
| R-SOCKET-IPXXD | à renseigner | rules.matrix.test.ts | — | needsReview |
| R-SOCKET-MAX | 5.3.5.2 b | rules.matrix.test.ts, rules.rgie2026.test.ts | prise-commandee, prise-de-courant, section-des-cables, simple-allumage, surcharge-court-circuit, volet-roulant | needsReview |
| R-SOCKET-SECTION | à renseigner | rules.matrix.test.ts | — | needsReview |
| R-VDROP | à renseigner | calc.test.ts | — | needsReview |
| R-VDROP-RATING | à renseigner | calc.test.ts | — | needsReview |
| R-WETROOM-NAME | à renseigner | rules.matrix.test.ts | — | needsReview |

## 3. Couverture

- Références citées dans les articles : 83 ; dans la liste vérifiée : 86.
- Règles du moteur : 47, dont 6 avec un article RGIE renseigné et vérifié ; les autres restent à documenter.
- Règles sans aucun test qui les cite : 6.
