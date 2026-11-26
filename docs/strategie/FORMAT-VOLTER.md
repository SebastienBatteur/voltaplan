# Format de sauvegarde Volter (`.vschema`)

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

## Ce que le fichier ne contient pas (dans l'exemple)

- Ni compteur ni mise à la terre (résistance, type de prise de terre) : à demander dans l'assistant.
- `rooms` vide : les pièces ne sont pas tracées dans l'exemple, seulement les murs. Le composant a `roomId: null`.
- Date d'installation / version du RGIE choisie : absente du fichier exemple.

## Points à confirmer avec d'autres exemples

Arrivée triphasée 3N400, disjoncteurs 3P/4P, fusibles, sous-tableau, plusieurs étages
(`crossFloorConnections`), pièces tracées, étiquettes, prises simples/doubles/sans terre, circuit sans
disjoncteur différentiel 30 mA, liste d'attente (`wachtlijst`), codes EAN.
