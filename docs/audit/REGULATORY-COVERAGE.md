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

Terminologie : docs/strategie/DECISIONS.md § 3. États de connaissance et exigences : [ADR-0007](../adr/0007-etats-de-connaissance-et-exigences.md).

| Statut | Signification | Bloquant |
|---|---|---|
| Non-conformité détectée | Règle vérifiée sur des données connues (ou une absence confirmée), et violée | partie neuve : oui ; partie existante : oui si danger élevé |
| Anomalie potentielle | Le constat repose sur une information déduite ou non confirmée (assistant, nom de pièce) | non |
| Informations contradictoires | Dessin et déclaration, ou sources de l'assistant, se contredisent | non |
| Informations insuffisantes | Donnée nécessaire inconnue (non dessinée en relevé, non renseignée) | partie neuve : oui (sauf pouvoir de coupure) ; existant : non |
| Vérification manuelle nécessaire | Mesure ou vérification sur place (mesures, essais, borne, PV, dispositions transitoires) | non |
| Règle non évaluée | Référentiel inconnu : aucune règle appliquée | oui |
| Avertissement | Point à examiner (calculs estimés, sélectivité…) | non |
| Recommandation | Mise en conformité conseillée, non exigée pour cette partie | non |
| Dérogation | Saisie et justifiée par l'utilisateur (motif obligatoire) | non |
| Non applicable | Réservé (pas encore émis) | — |

**Inconnu ≠ absent.** En conception (partie neuve sous l'édition en vigueur), le dessin est la référence : un
équipement non dessiné est absent du projet. En relevé (partie existante), un équipement non dessiné est
**inconnu** tant que l'utilisateur n'a pas confirmé son absence (`meta.survey` : prise de terre, différentiel
général, différentiel 30 mA ; boutons « Confirmer présent / Confirmer absent / Je ne sais pas » du contrôle).

**Exigences documentaires** (dossier, schéma, mentions) : jamais présentées comme des non-conformités de
l'installation ; bloquantes pour un dossier de réception d'une installation neuve (mention « PROJET — DOSSIER
INCOMPLET »).

Le document de travail reste toujours exportable. Mention du dossier de réception ou complet : « PROJET —
NON-CONFORMITÉS À TRAITER » (non-conformité physique bloquante), sinon « PROJET — VÉRIFICATIONS À FAIRE »
(inconnu, déduit, contradictoire, mesure), sinon « PROJET — DOSSIER INCOMPLET » (documentaire bloquant).

## Règles automatisées

« Exigence » : D = documentaire, P = physique. « Existant » : statut quand la violation est établie (données
connues ou absence confirmée) dans une partie existante. « Si inconnu » : comportement quand l'information
manque, est déduite ou contradictoire.

| Règle | Contrôle | Exigence | Gravité | Existant | Si inconnu / déduit / contradictoire |
|---|---|---|---|---|---|
| R-DOC-INSTALLER / ADDRESS / SUPPLY | Mentions obligatoires sur les documents | D | — | info insuffisante | (donnée manquante = le constat lui-même) |
| R-DOC-NOT-DRAWN | Équipement confirmé présent mais non dessiné | D | — | info insuffisante | n'existe que sur déclaration « présent » |
| R-EARTH-MISSING | Prise de terre | P | élevée | non conforme (absence confirmée) | relevé non dessiné → inconnu (+ question) ; dessinée et déclarée absente → contradictoire ; conception non dessinée → non conforme |
| R-EARTH-VALUE / R-EARTH-30 | Résistance de terre > 100 Ω / > 30 Ω | P | élevée / modérée | non conforme / avertissement | non mesurée → R-MEAS-MISSING (mesure nécessaire) |
| R-INSULATION | Isolement < 0,5 MΩ | P | élevée | non conforme | non mesuré → R-MEAS-MISSING |
| R-MEAS-MISSING | Résistance de terre ou isolement non notés | P | — | vérification (mesure nécessaire) | — |
| R-BONDING | Liaisons équipotentielles | P | élevée | non conforme (« non » saisi) | non saisi → vérification (mesure nécessaire) |
| R-RCD-TEST / R-RCD-TRIP | Essai des différentiels, temps ≤ 300 ms (500 ms type S) | P | élevée | non conforme | essai non noté → vérification (mesure nécessaire) |
| R-PROT-RATING-MISSING | Calibre non renseigné | D | modérée | info insuffisante | la coordination est signalée à part (R-CABLE-PROT en relevé) |
| R-PROT-KA-MISSING | Pouvoir de coupure non renseigné | D | faible | info insuffisante, jamais bloquant | — |
| R-RCD-SENS-MISSING | Sensibilité de différentiel non renseignée | D | modérée | info insuffisante | R-RCD-MAIN / R-RCD30 deviennent « inconnu » |
| R-RCD-MAIN | Différentiel ≤ 300 mA en tête de chaque circuit | P | élevée | non conforme (absence confirmée, ou sensibilités connues > 300 mA) | sensibilité inconnue → inconnu (neuf et existant) ; relevé sans différentiel dessiné → inconnu (+ question) ; déclaré absent alors qu'un différentiel ≤ 300 mA est dessiné → contradictoire ; valeur non confirmée → anomalie potentielle |
| R-RCD30 | 30 mA : local avec baignoire/douche (indiqué), lave-linge, sèche-linge, lave-vaisselle ; depuis le 1/6/2023 aussi prises (hors prise dédiée à un appareil) et éclairage — RGIE 4.2.4.3 b, 5e al. (PDF Livre 1 2026, p. 101) ; dérogation partie 6 (p. 207) si exécution commencée avant le 1/6/2023 ; existant sans date : question R-RCD30-DATE | P | élevée | non conforme (absence confirmée) | sensibilité inconnue → inconnu ; relevé sans 30 mA dessiné → inconnu (+ question) ; valeur non confirmée → anomalie potentielle ; question « contradiction » → contradictoire |
| R-RCD30-MAX | ≤ 8 circuits terminaux par différentiel 30 mA — RGIE 4.2.4.3 b, 6e al. (p. 101) ; même dérogation avant le 1/6/2023 | P | modérée | non conforme | compte des circuits dessinés (fait connu) |
| R-RCD30-DATE | Existant sans date : « tableau fait ou refait avant ou après le 1/6/2023 ? » (propriété `rgie2023` du tableau), une question par tableau | P | élevée | informations insuffisantes (non bloquant en existant) | réponse ou date → R-RCD30 / R-RCD30-MAX appliquées ou dérogation |
| R-WETROOM-NAME | Nom de pièce évoquant une salle de bain, non confirmé | P | élevée | anomalie potentielle (déduite) | `wetRoom` « oui » / « non » règle le cas ; 30 mA déclaré présent → plus de constat |
| R-RCD-TYPE-A | Type A pour lave-linge / lave-vaisselle / sèche-linge | P | modérée | recommandation | type non renseigné : pas de constat (valeur explicite seulement) |
| R-RCD-SELECTIVITY | Sensibilité aval < amont | P | faible | avertissement | sensibilités connues seulement |
| R-POLES-NO-NEUTRAL | 3 × 230 V : protection 2P | P | élevée | non conforme | pôles et alimentation explicites seulement (alimentation inconnue → R-DOC-SUPPLY) |
| R-CABLE-PROT | Calibre ≤ maximum pour la section | P | élevée | non conforme | relevé : section ou calibre inconnus → inconnu ; conception : la donnée manquante (bloquante) suffit |
| R-CABLE-MIN | Section ≥ 1,5 mm² | P | élevée | non conforme | section connue seulement |
| R-CABLE-SECTION-MISSING / DATA-MISSING | Section / données du câble non renseignées | D | modérée | info insuffisante | — |
| R-CABLE-NO-OVERCURRENT | Protection contre les surintensités en amont | P | élevée | non conforme | protection amont de nature inconnue (appareil non renseigné) → inconnu |
| R-SOCKET-EARTH | Prise avec terre | P | élevée | non conforme (« sans terre » indiqué) | valeur absente = symbole avec terre (présent dans le dessin) ; valeur non confirmée → anomalie potentielle ; contradiction → contradictoire |
| R-SOCKET-CHILD | Sécurité enfant (travaux commencés avant le 1/3/2025 ou date inconnue) | P | modérée | recommandation | idem R-SOCKET-EARTH |
| R-SOCKET-IPXXD | Prise ≤ 16 A sans IPXX-D, travaux commencés le 1/3/2025 ou après (RGIE 5.3.5.2 a, PDF p. 180) ; exception : prise réservée à un appareil précis | P | modérée | non conforme | dispositions transitoires 6.5.8.1, 2 et 6.5.8.2, 3 (prises posées avant le 1/3/2025 conformément au Livre 1 d'alors) |
| R-SOCKET-MAX | ≤ 8 points de prise par circuit | P | faible | recommandation | compte des points dessinés (fait connu) |
| R-SOCKET-SECTION | Prises en 2,5 mm² minimum | P | modérée | non conforme | sections connues seulement |
| R-DEDICATED-CIRCUIT | Circuit spécialisé (four, taque, lave-linge…) | P | faible | recommandation | points dessinés (faits connus) |
| R-CIRCUIT-NAME | Circuit sans nom | D | — | recommandation | — |
| R-VDROP / R-VDROP-RATING / R-ICC-LMAX | Chute de tension, longueur maximale (estimation, voir docs/calc.md) | P | faible / faible / élevée | avertissement | longueurs connues seulement ; hypothèses affichées |
| R-EV-MANUAL / R-PV-MANUAL | Borne de recharge, photovoltaïque | P | modérée | vérification | — |
| R-INSTALL-DATE | Installation neuve datée d'avant le 1/6/2020 | D | — | vérification | — |
| R-OLD-RGIE | Édition antérieure appliquée (information) | D | — | information | — |
| R-COUNTRY-OPTION | Désignation qui n'existe pas dans le pays | D | — | avertissement | — |
| R-RULESET-UNKNOWN | Référentiel inconnu : aucune règle appliquée | P | — | règle non évaluée, bloquant | — |
| R-UNCONFIRMED (assistant) | Valeurs reprises d'une photo, non confirmées | P | — | vérification (déduit) | les constats de l'élément deviennent « anomalie potentielle » |
| R-CONTRADICTION (assistant) | Question « contradiction » ouverte | P | — | informations contradictoires | les constats de l'élément deviennent « contradictoires » |

### Audit « absent du dessin ⇒ violation » (novembre 2026)

Chaque règle de `src/rules/be/rgie.ts` a été relue pour repérer les conclusions tirées de l'absence d'un élément
ou d'une valeur :

| Règle | Motif trouvé | Décision |
|---|---|---|
| R-EARTH-MISSING | aucun nœud « terre » ⇒ non conforme | corrigé : `presence()` (conception : absent ; relevé : inconnu ; déclaration ; contradiction) |
| R-RCD-MAIN | aucun différentiel, ou sensibilité absente (traitée comme infinie) ⇒ non conforme | corrigé : sensibilité absente = inconnu ; aucun différentiel = `presence()` |
| R-RCD30 | idem, sensibilité absente ⇒ non conforme | corrigé : idem, fait `rcd30` |
| R-CABLE-NO-OVERCURRENT | appareil de protection non renseigné ⇒ « pas de protection contre les surintensités » | corrigé : inconnu |
| R-CABLE-PROT | section ou calibre absents ⇒ aucun constat (silence) | corrigé en relevé : « vérification nécessaire » ; en conception, la donnée manquante bloquante suffit |
| R-BONDING | non saisi ⇒ silence | corrigé : mesure nécessaire |
| R-RCD-TEST | essai non noté ⇒ silence | corrigé : mesure nécessaire |
| R-WETROOM-NAME | nom évocateur ⇒ vérification | reclassé : information déduite → anomalie potentielle |
| R-SOCKET-EARTH / CHILD | `false` explicite seulement | conservé (absence déclarée) ; valeur absente = symbole par défaut |
| R-SOCKET-MAX / SECTION, R-DEDICATED-CIRCUIT | points ou sections dessinés | conservé : faits connus, valeurs inconnues ignorées |
| R-POLES-NO-NEUTRAL, R-RCD-TYPE-A, R-RCD-SELECTIVITY, R-CABLE-MIN | valeurs explicites seulement | conservé |
| R-EARTH-VALUE / 30, R-INSULATION, R-RCD-TRIP | mesures saisies seulement | conservé ; mesures absentes → R-MEAS-MISSING (mesure nécessaire) |
| R-DOC-*, R-PROT-*-MISSING, R-RCD-SENS-MISSING, R-CABLE-*-MISSING, R-CIRCUIT-NAME | donnée absente | conservé, classé **documentaire** (schéma incomplet), jamais non conforme |
| R-VDROP / R-ICC-LMAX | longueurs inconnues ignorées | conservé |

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
