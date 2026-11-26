# Format de sauvegarde Volter (`.vschema`)

**Import réalisé** : menu Fichier → « Importer Volter (.vschema)… » (branche `import-volter`).

Examen d'un projet d'essai fictif exporté par l'utilisateur le 26/11/2026 (Volter bêta, `"version": 2`).
Le fichier d'exemple n'est **pas** versionné (il reste dans le dossier personnel de l'utilisateur).

## Verdict

**Import faisable et simple** : JSON lisible (UTF-8, indenté), sans chiffrement ni compression, clés en
néerlandais ou en anglais. Le tableau, les circuits, les points du plan **et** les murs, portes et fenêtres
sont tous présents, avec des liens par identifiant. Aucune dépendance n'est nécessaire.

## Structure

```text
version: 2
metadata    : thumbnail(s) JPEG base64, address, werfNaam, updatedAt, floorCount
project     : id, name, address, createdAt, updatedAt, notes, werfnotities[]
              installateur {naam, straat, gemeente, btw, datum, telefoon, email}
              werf {naam, straat, postcode, gemeente}
              spanning ("3x230V" …), eanCodes[], keuringStatus ("in-opmaak" …)
              crossFloorConnections[], wachtlijst {componenten[], verbindingen[]}
              floors[] : id, name, level
                walls[]   {id, start{x,y}, end{x,y}, thickness}        ← unité = 1 cm
                doors[]   {id, wallId, position 0..1, width, openDirection, hingeSide}
                windows[] {id, wallId, position 0..1, width}
                rooms[], labels[], buitenvlakken[]
                components[] {id, type, position{x,y}, rotation, roomId, circuitId,
                              label, labelOffset, quantity, scale, + propres au type}
                connections[] {id, fromId, toId}   ← commande : interrupteur → lampe, etc.
                architecturalElements[] (escalier…), meubels[] (mobilier)
boards[]    : id, naam, modules[]
```

### Modules du tableau

| `moduleType` | Champs | Voltaplan |
| --- | --- | --- |
| `hoofddifferentieel` | ampere, polen, kortsluitstroom (kA), foutstroom (mA), rcdType | `protection` différentiel général |
| `differentieel` | idem + `ouderId` (différentiel parent), `automaatIds[]` | `protection` différentiel, enfant de `ouderId` ou du général |
| `automaat` | ampere, polen, kortsluitstroom, breakerCurve, draaddikte (mm²), aantalAders, kabelType, cprClass, kabelLocatie, inBuis, aantalLeidingen, `differentieelId` | `protection` disjoncteur + `cable` du circuit |

`rijIndex`, `kolom`, `position` : placement dans le tableau (rangée, colonne).
`naam` du disjoncteur (« Circuit 4 ») = nom du circuit. Le repère A, B, C… du PDF est calculé par Volter.

### Composants (`type`) vus dans l'exemple

| Volter | Voltaplan |
| --- | --- |
| lightPoint (option `ledmaat` strip/tegel), wallLight, spotLight, fluorescentLight | `light` (standard / led / wall / spot / fluo) |
| singleSwitch, toggleSwitch (va-et-vient), crossSwitch, twoPoleSwitch, dimmer | `switch` (single / twoWay / intermediate / bipolar / dimmer) |
| pushButton, impulseSwitch (télérupteur) | `pushButton`, `relay` |
| childSafeGroundedOutlet | `socket` (terre + sécurité enfant) |
| cooktop, boiler, washingMachine, dryer, dishwasher, fridge, freezer, microwave, fan, laadpaal, airco | `appliance` (hob, waterHeater, washingMachine, dryer, dishwasher, fridge, freezer, microwave, fan, evCharger, other/airco) |
| solarPanel (`wattpiek`), inverterAcDc (`maximaalVermogen` kW), battery | `solarPanel`, `inverter`, batterie (à ajouter ou `other`) |

Chaque composant porte son `circuitId` (= id du disjoncteur). Les `connections` donnent l'ordre de commande
(interrupteur → lampe, télérupteur → bouton-poussoir, batterie → onduleur → panneaux) : l'unifilaire de Volter
en déduit les groupes 1, 2, 3… du circuit.

## Catalogue complet des symboles de Volter (captures d'écran du 26/11)

Noms affichés par Volter (interface française). Toutes les clés internes (`type`) ont été relevées sur un
2e projet d'essai contenant chaque symbole : la correspondance complète est dans `src/import/volter.ts` (`VOLTER_TYPES`).

| Catégorie Volter | Symboles | Voltaplan aujourd'hui | Manque dans Voltaplan |
| --- | --- | --- | --- |
| Éclairage | **Point lumineux**, **Applique murale**, Ruban LED, Dalle LED (**ledmaat** strip/tegel), **Projecteur**, **Luminaire fluorescent**, Projecteur divergent / peu divergent, Éclairage de secours autonome / sur circuit dédié, Luminaire avec interrupteur, Ballast | `light` standard, led, wall, spot, fluo, emergency | secours autonome vs circuit dédié, projecteur (peu) divergent, luminaire avec interrupteur, ballast |
| Interrupteurs | **Interrupteur**, **va-et-vient**, unipolaire double allumage, **croisé**, **variateur**, **bouton-poussoir**, bouton-poussoir avec voyant / protégé, détecteur de mouvement / de présence, tripolaire, **bipolaire**, bipolaire avec voyant, bipolaire va-et-vient, à tirette, temporisé, **télérupteur**, minuterie, horloge programmatrice, thermostat, serrure de verrouillage, interrupteur avec lampe de signalisation, interrupteur avec voyant | `switch` (single, double, twoWay, intermediate, dimmer, bipolar, shutter, pullCord) + voyant ; `pushButton` ; `detector` ; `relay` (télérupteur, minuterie) | tripolaire, bipolaire va-et-vient, temporisé, horloge programmatrice, thermostat, serrure de verrouillage |
| Prises | Prise de courant, avec terre, **avec terre et protection enfant**, avec protection enfant, étanche, hermétique avec terre et protection enfant, avec transformateur de sécurité, avec interrupteur bipolaire (verrouillable), CEE 2P+T / 3P+T / 3P+N+T, data, télédistribution | `socket` (terre, protection enfant, étanche, triphasée) | transformateur de sécurité, interrupteur bipolaire (verrouillable), CEE 2P+T vs 3P+T vs 3P+N+T, prises data et télédistribution (courant faible) |
| Appareils | Four, **Plaque de cuisson**, **Chauffe-eau**, **Machine à laver**, **Sèche-linge**, **Lave-vaisselle**, Appareil ménager, **Réfrigérateur**, **Congélateur**, **Micro-ondes**, **Ventilateur**, Appareil de chauffage, **Climatisation**, chauffage à accumulation (avec ventilateur), Chauffe-eau à accumulation, **Borne de recharge** | `appliance` : tous sauf ci-contre | climatisation, chauffage à accumulation (± ventilateur) |
| Panneaux solaires et batteries | **Panneau solaire** (`wattpiek`), Onduleur DC/AC, **Onduleur AC/DC** (`maximaalVermogen`), **Batterie** | `solarPanel`, `inverter` (dcAc, acDc) | batterie |
| Autres | Sonnette, Avertisseur, Sirène, Ronfleur, Serrure électrique, Horloge, Horloge mère, Compteur kWh, Moteur, Transformateur, Boîte de connexion, Boîte de dérivation, Centrale d'alarme, Centrale incendie, Tableau de distribution | `bell`, `meter`, `motor`, `transformer`, `junctionBox`, `board` | serrure électrique, horloge (mère), centrales d'alarme et d'incendie (→ `other` en attendant) |

Hors électricité, également enregistrés dans le fichier : **Aménagement** (escaliers droit, quart tournant,
colimaçon ; lits, placard ; canapé, fauteuil, tables, chaise ; plan de travail, plaque, évier ; baignoire, douche,
lavabo, WC ; clim extérieure / murale / cassette ; ascenseur) dans `meubels` et `architecturalElements`, et
**Extérieur** (jardin, terrasse, allée, chemin ; rectangle, forme libre, cercle) sans doute dans `buitenvlakken`.
Voltaplan n'a pas de mobilier : à l'import, on peut les dessiner en simple contour gris sur le plan, ou les ignorer.

Interface : vues « Rail / Arbre / Les deux » du tableau, compteur « 5/8 » circuits par différentiel 30 mA,
bouton « Attribuer des symboles » (rattacher les points du plan à un circuit), repères A, B, C… par disjoncteur.

## Ce que le fichier ne contient pas (dans l'exemple)

- Ni compteur ni mise à la terre (résistance, type de prise de terre) : à demander dans l'assistant.
- `rooms` vide : les pièces ne sont pas tracées dans l'exemple, seulement les murs. Le composant a `roomId: null`.
- Date d'installation / version du RGIE choisie : absente du fichier exemple.

## Points à confirmer avec d'autres exemples

Arrivée triphasée 3N400, disjoncteurs 3P/4P, fusibles, sous-tableau, plusieurs étages
(`crossFloorConnections`), pièces tracées, étiquettes, prises simples/doubles/sans terre, circuit sans
disjoncteur différentiel 30 mA, liste d'attente (`wachtlijst`), codes EAN.

## Relevé du 2e projet d'essai

- `spanning` : `3x400V+N` ; `installatiePeriode` : `tot2020` (autres valeurs inconnues) ; `eanCodes[] {id, label, code}`.
- `labels[] {id, type: "label", position, text}` ; `buitenvlakken[] {soort: tuin/terras/oprit…, materiaal, naam,
  vorm {soort: "veelhoek", punten[]} ou autre forme, toonOppervlakte}`.
- `architecturalElements` : `stairStraight {width, length}`, `stairQuarterTurn {width, legALength, legBLength, turn}`,
  `stairSpiral {radius, sweepDeg, turn}`.
- Symboles posés sans circuit : `circuitId: null` (repris comme éléments non raccordés).
- `roundControl` : seul symbole dont le libellé n'est pas certain (pris pour « Serrure de verrouillage »).

## Relevé du 3e projet d'essai (étage et sous-tableau)

- Sous-tableau : un disjoncteur du tableau parent porte `feedsBoardId` (id du sous-tableau) ; le sous-tableau a
  `naam` et un repère `code` (« E »). Import : sous-tableau placé sous le câble de ce disjoncteur, repère repris.
- `crossFloorConnections[] {id, fromId, fromFloorId, toId, toFloorId}` : liaison de commande entre deux étages
  (bouton-poussoir de l'étage → télérupteur du rez). Import : traitée comme une liaison ordinaire.
- Les modules d'un sous-tableau peuvent n'avoir ni `kolom` ni `position`.
