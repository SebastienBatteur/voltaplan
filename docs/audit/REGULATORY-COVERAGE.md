# Couverture réglementaire — Belgique (RGIE / AREI)

> Voltaplan est une **aide à la vérification**. Ses contrôles ne remplacent ni le texte officiel du RGIE
> ni le contrôle par un organisme agréé. Toutes les règles ci-dessous sont marquées `needsReview` dans
> `src/rules/be/catalog.ts` : leur interprétation (seuils, applicabilité aux installations existantes, gravité)
> doit être confirmée par un expert.

## Éditions modélisées

| Id | Période | Texte | Statut de la source |
|---|---|---|---|
| `pre1981` | avant le 1/10/1981 | « parties anciennes » (régime des installations existantes) | dates vérifiées, régime détaillé **à confirmer** |
| `1981` | 1/10/1981 → 31/5/2020 | Ancien RGIE, AR du 10 mars 1981 | vérifié (remplacé le 1/6/2020) |
| `2020` | depuis le 1/6/2020 | RGIE Livre 1, AR du 8 septembre 2019 ; modifications en vigueur le 1/6/2023 | vérifié (SPF Économie, presse spécialisée) |

L'édition se déduit, de l'élément vers la racine, de : `oldPart`, `installedOn`, puis la date du projet
(`meta.installationDate`), puis l'ancien choix `meta.rgieVersion`. Une installation peut donc mêler plusieurs générations.

## Statuts

| Statut | Signification | Bloquant |
|---|---|---|
| Non conforme | Non-conformité à l'édition applicable | partie neuve : oui ; partie existante : oui si danger élevé |
| Information manquante | Donnée nécessaire absente | partie neuve : oui (sauf pouvoir de coupure) |
| Avertissement | Point à examiner (calculs estimés, sélectivité…) | non |
| À vérifier | Vérification manuelle (indice d'un local humide, borne, PV, mesures, dispositions transitoires) | non |
| Recommandation | Mise en conformité conseillée, non exigée pour cette partie | non |
| Dérogation | Saisie et justifiée par l'utilisateur (motif obligatoire) | non |
| Non applicable | Réservé (pas encore émis) | — |

Le document de travail reste toujours exportable. Un constat bloquant fait apparaître la mention « PROJET — NON CONFORME » sur le dossier.

## Règles automatisées

| Règle | Contrôle | Gravité | Existant |
|---|---|---|---|
| R-DOC-INSTALLER / ADDRESS / SUPPLY | Mentions obligatoires sur les documents | — | info manquante |
| R-EARTH-MISSING | Prise de terre dessinée | élevée | non conforme |
| R-EARTH-VALUE / R-EARTH-30 | Résistance de terre > 100 Ω / > 30 Ω | élevée / modérée | non conforme / avertissement |
| R-INSULATION | Isolement < 0,5 MΩ | élevée | non conforme |
| R-BONDING | Liaisons équipotentielles | élevée | non conforme |
| R-RCD-TEST / R-RCD-TRIP | Essai des différentiels, temps ≤ 300 ms (500 ms type S) | élevée | non conforme |
| R-RCD-MAIN | Différentiel ≤ 300 mA en tête de chaque circuit | élevée | non conforme |
| R-RCD30 | 30 mA : local avec baignoire/douche (indiqué), lave-linge, sèche-linge, lave-vaisselle | élevée | non conforme |
| R-RCD-TYPE-A | Type A pour lave-linge / lave-vaisselle / sèche-linge | modérée | recommandation |
| R-RCD-SELECTIVITY | Sensibilité aval < amont | faible | avertissement |
| R-POLES-NO-NEUTRAL | 3 × 230 V : protection 2P | élevée | non conforme |
| R-CABLE-PROT | Calibre ≤ maximum pour la section | élevée | non conforme |
| R-CABLE-MIN | Section ≥ 1,5 mm² | élevée | non conforme |
| R-CABLE-NO-OVERCURRENT | Protection contre les surintensités en amont | élevée | non conforme |
| R-SOCKET-EARTH | Prise avec terre | élevée | non conforme |
| R-SOCKET-CHILD | Sécurité enfant | modérée | recommandation |
| R-SOCKET-MAX | ≤ 8 points de prise par circuit | faible | recommandation |
| R-SOCKET-SECTION | Prises en 2,5 mm² minimum | modérée | non conforme |
| R-DEDICATED-CIRCUIT | Circuit spécialisé (four, taque, lave-linge…) | faible | recommandation |
| R-VDROP / R-ICC-LMAX | Chute de tension, longueur maximale (estimation, voir docs/calc.md) | faible / élevée | avertissement |
| R-WETROOM-NAME | Nom de pièce évoquant une salle de bain, non confirmé | — | à vérifier |
| R-EV-MANUAL / R-PV-MANUAL | Borne de recharge, photovoltaïque | — | à vérifier |
| R-INSTALL-DATE | Installation neuve datée d'avant le 1/6/2020 | — | à vérifier |
| R-RULESET-UNKNOWN | Référentiel inconnu : aucune règle appliquée | — | bloquant |

## Points nécessitant une expertise réglementaire

1. **Calibres maximaux par section** (`MAX_PROTECTION_BY_SECTION`) : valeurs prudentes usuelles, sans distinction
   **fusible / disjoncteur** ni mode de pose. Le RGIE distingue ces cas ; un fichier réel (4 mm² protégé par 32 A)
   est signalé alors qu'il peut être admis pour un disjoncteur. À valider avant de passer ces règles en « vérifiées ».
2. **Applicabilité aux installations existantes** : la colonne « Existant » est une décision de Voltaplan
   (sécurité = non conforme, conception = recommandation), pas une lecture article par article des dispositions
   pour installations existantes du Livre 1.
3. **Résistance de terre** entre 30 et 100 Ω : conditions complémentaires à préciser.
4. **Locaux humides** : volumes 0 à 3, liaison équipotentielle supplémentaire, IP des appareils : non vérifiés.
5. **Numéros d'articles** : aucun n'est encore renseigné dans le catalogue ; ils seront ajoutés après vérification
   dans le texte consolidé.

## Non couvert (à faire)

- Installations 3N × 400 V : équilibrage (bilan de puissance disponible, sans règle), section du neutre.
- Batteries domestiques, onduleurs hybrides, sources multiples, inverseurs de source.
- Tableaux secondaires : protection du câble d'alimentation par rapport au courant total.
- Circuits mixtes prises / éclairage (nombre de points, section).
- Nombre de circuits par différentiel 30 mA.
- Mentions obligatoires complètes du schéma (pouvoir de coupure, type de différentiel affichés).
