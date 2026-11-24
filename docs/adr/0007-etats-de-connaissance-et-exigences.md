# ADR-0007 — États de connaissance et exigences documentaires / physiques (« inconnu ≠ absent »)

Date : 2026-11-24 · Statut : accepté (décision du porteur du projet) · Complète ADR-0001, ADR-0002 et ADR-0005

## Contexte

Le moteur RGIE contrôlait l'arbre tel qu'il est dessiné : ce qui n'était pas dessiné était traité comme absent.
Exemple déclencheur : « R-EARTH-MISSING — Aucune prise de terre n'est dessinée » sortait « non conforme » et
bloquant même pour une installation existante relevée d'après une photo du tableau, où la prise de terre n'est
simplement pas visible.

Décision du porteur du projet :

> Une information absente du dessin ne signifie pas que l'équipement est absent de l'installation réelle.
> Distinguer systématiquement : présence confirmée ; absence confirmée ; information inconnue ; information
> déduite mais non confirmée ; informations contradictoires ; vérification ou mesure nécessaire. Une absence
> confirmée peut conduire à une non-conformité quand une règle applicable est violée. Une information inconnue
> doit conduire à une question ou à une vérification. Distinguer aussi les exigences documentaires des exigences
> physiques : un schéma incomplet peut montrer une insuffisance documentaire sans démontrer une non-conformité
> physique.

## Décision

### 1. États de connaissance (`Knowledge`, src/rules/types.ts)

| État | Sens | Sources |
|---|---|---|
| `present` | présence confirmée | élément dessiné dans l'arbre ; déclaration `meta.survey[fait] = 'present'` |
| `absent` | absence confirmée | déclaration `meta.survey[fait] = 'absent'` ; valeur explicite d'une propriété (ex. prise `earth: false`) ; **conception** : non dessiné |
| `unknown` | information inconnue | **relevé** : non dessiné et non déclaré ; valeur non renseignée (sensibilité, section, calibre, nature de la protection) |
| `deduced` | déduite, non confirmée | provenance de l'assistant `observed` / `deduced` / `aiInferred` / `proposed` non confirmée (`unconfirmed()`, A6) ; local humide reconnu au nom de la pièce |
| `contradictory` | informations contradictoires | élément dessiné mais déclaré absent ; question `contradiction` ouverte dans le dossier de preuves |
| `measureNeeded` | mesure ou vérification sur place | résistance de terre, isolement, liaisons équipotentielles, essai des différentiels non notés |

Un constat sans `knowledge` repose sur des données connues (valeurs saisies, éléments dessinés).

**L'arbre reste la seule source de vérité** (ADR-0003, ADR-0005). Le seul ajout au modèle est un marqueur explicite,
facultatif et rétrocompatible : `meta.survey?: { earth?, rcd?, rcd30? : 'present' | 'absent' }` (clé absente =
inconnu). Il ne concerne que les faits qu'on ne dessine pas forcément : prise de terre, différentiel général
(300 mA maximum), différentiel 30 mA des circuits qui l'exigent. `meta` est validé en objet ouvert : les anciens
fichiers s'ouvrent sans migration, les versions antérieures conservent le champ, l'import / export Trikker l'ignore.
Les propriétés tri-états existantes (`wetRoom: '' | 'yes' | 'no'`) et booléennes (`earth`, `childSafety` d'une prise :
valeur absente = symbole par défaut, dessiné avec terre) ne changent pas.

### 2. Conception (neuf) ou relevé (existant)

`PartContext.isNew` (ADR-0001) décide :

- **partie neuve sous l'édition en vigueur = conception** : le dessin est la référence ; un équipement non dessiné
  est absent du projet → la règle reste une non-conformité (résultat inchangé pour les installations neuves) ;
- **partie existante (ou édition antérieure) = relevé** : non dessiné = `unknown`, sauf absence confirmée.

Fonction : `presence(drawn, stated, design)` (src/rules/knowledge.ts). Une déclaration explicite l'emporte sur le
défaut de conception (ex. une terre existante réutilisée, confirmée présente mais non dessinée).

### 3. Résultat d'une règle selon l'état (`classify`, src/rules/context.ts)

| État | Statut | Bloquant |
|---|---|---|
| données connues / `absent` | classement d'ADR-0002, inchangé (neuf : non conforme ; existant : sécurité non conforme, le reste selon `existing`) | inchangé |
| `unknown` | « Informations insuffisantes » (`insufficientData`) + `fact` (boutons, question) | seulement en conception (donnée manquante du projet) |
| `deduced` | « Anomalie potentielle » (`potential`), `inferred` | non |
| `contradictory` | « Informations contradictoires » (`contradictory`) | non |
| `measureNeeded` | « Vérification manuelle nécessaire » (`manualCheck`) | non |

Les constats déduits et contradictoires venant de l'assistant sont reclassés après coup par
`src/assist/unconfirmed.ts` (le moteur ne lit toujours pas le dossier de preuves) ; s'y ajoutent `R-UNCONFIRMED`
(valeurs non confirmées) et `R-CONTRADICTION` (question « contradiction » ouverte). `surveyQuestions()` est le
crochet par lequel l'assistant peut poser une question par fait inconnu (`q_survey_<fait>`, réponse écrite dans
`meta.survey`) ; il n'écrit rien lui-même dans le dossier de preuves.

### 4. Exigences documentaires et physiques (`RuleMeta.requirement`, `Finding.requirement`)

Chaque règle du catalogue déclare `requirement: 'documentary' | 'physical'` (src/rules/be/catalog.ts, liste dans
docs/audit/REGULATORY-COVERAGE.md). Documentaires : mentions du dossier (installateur, adresse, alimentation, date),
schéma incomplet (valeurs non renseignées, `R-DOC-NOT-DRAWN` : équipement confirmé présent mais non dessiné), nom de
circuit, désignations hors pays.

- Une exigence documentaire n'est **jamais** présentée comme une non-conformité de l'installation : un statut
  `nonCompliant` est ramené à `insufficientData`, et elle est listée à part (« Exigences documentaires »).
- Elle **peut bloquer un dossier de réception** (installation neuve), comme avant : le dossier porte alors la
  mention « PROJET — DOSSIER INCOMPLET », pas « non conforme ». Pour l'existant, elle n'est pas bloquante.
- Une valeur non renseignée a deux faces : documentaire (le schéma est incomplet) et physique (la règle qui en
  dépend n'est pas évaluable). En relevé, la règle physique signale en plus « vérification nécessaire »
  (ex. `R-CABLE-PROT` inconnu) ; en conception, la donnée manquante, déjà bloquante, suffit.

### 5. Terminologie et dossier

Statuts : « Non-conformité détectée », « Anomalie potentielle », « Vérification manuelle nécessaire »,
« Informations insuffisantes », « Règle non évaluée » (référentiel inconnu), « Informations contradictoires »,
plus avertissement, recommandation, dérogation. Résumé : « Aucune anomalie détectée parmi les N règles vérifiées »
(N = règles du catalogue hors informations).

Mention en filigrane du dossier de réception ou complet (`draftLevel`, src/rules/knowledge.ts) :

| Situation | Mention |
|---|---|
| au moins une non-conformité **physique** bloquante (données connues ou absence confirmée) | « PROJET — NON-CONFORMITÉS À TRAITER » |
| sinon, information physique inconnue, déduite, contradictoire, mesure à faire, ou donnée physique manquante bloquante | « PROJET — VÉRIFICATIONS À FAIRE » |
| sinon, exigence documentaire bloquante | « PROJET — DOSSIER INCOMPLET » |
| rien | aucune |

Le document de travail garde « Document de travail » et le rapport d'anomalies n'a pas de mention. Les pages
« Contrôle » séparent « Exigences de l'installation » et « Exigences documentaires », indiquent l'état de
connaissance, et portent l'avertissement existant et la phrase de responsabilité (« ni une certification ni un
contrôle de conformité au sens du RGIE », formulation à faire relire par un juriste).

Interface (panneau Contrôle) : les deux groupes, l'état de connaissance à côté du statut, et pour un fait du relevé
inconnu ou contradictoire les boutons « Confirmer présent / Confirmer absent / Je ne sais pas », qui écrivent ou
effacent `meta.survey[fait]` (annulable comme toute modification du projet).

## Conséquences

- Installations neuves : les non-conformités et le caractère bloquant ne changent pas pour les éléments non dessinés.
  Changements voulus : un différentiel dessiné **sans sensibilité** n'est plus « non conforme » mais « informations
  insuffisantes » (toujours bloquant en neuf) ; nouveaux constats non bloquants « mesure nécessaire » pour les
  liaisons équipotentielles et l'essai des différentiels non notés ; local humide déduit du nom → « Anomalie
  potentielle » au lieu de « À vérifier ».
- Installations existantes : terre, différentiel général et différentiel 30 mA non dessinés ne sont plus des
  non-conformités bloquantes tant que leur absence n'est pas confirmée. Une absence confirmée redonne exactement le
  classement précédent (sécurité : non conforme et bloquant).
- Toutes les règles restent `needsReview` ; aucune référence d'article n'est ajoutée.
- Reste à faire : poser réellement les questions `surveyQuestions()` dans l'Assistant (fichiers d'autres lots),
  étendre les faits du relevé si besoin (liaison équipotentielle principale, conducteur de protection par circuit),
  page « Portée de l'analyse » listant les règles non évaluées.
