# ADR-0010 — Provenance des valeurs : une valeur proposée n'est jamais une caractéristique confirmée

Date : 2026-11-28 · Statut : **proposé** (à valider avant toute modification du modèle de données) · Complète
ADR-0007 (états de connaissance) et ADR-0009 (registre réglementaire)

## Contexte

L'audit `docs/audit/provenance/valeurs-par-defaut.md` montre que `createNode` copie dans `node.props` les 49 valeurs
`default:` du schéma (calibre 20 A, 1P+N, courbe C, 3 kA, VOB 3G2,5, prise avec terre et obturateurs…). Une fois
enregistrées, elles ne se distinguent plus d'une saisie. La convention actuelle « pas de provenance = saisie
manuelle » (assist/apply.ts) les range même parmi les saisies.

Sur un **relevé d'installation existante**, c'est une source de faux résultats :

- 7 propriétés à criticité haute (`device`, `ratedCurrent`, `poles`, `curve`, `section`, `earth`, `childSafety`) :
  elles masquent « calibre / section inconnus », inventent « 1P+N sur 3 × 230 V » ou « différentiel de tête 20 A »,
  faussent la colonne fusible / disjoncteur du tableau 4.11, la longueur protégée et la chute de tension ;
- les imports Volter, Condui, Draadwijs, PlanElec et Trikker gardent `installationKind: 'new'` et `2 x 230V` du
  projet vide : un relevé importé est contrôlé comme une installation neuve ; l'import PDF garde un différentiel
  général 300 mA / 40 A / type A qui n'existe peut-être pas ;
- les corrections en un clic (`earth = true`, `childSafety = true`, `ratedCurrent = max`…) réécrivent le fait relevé :
  la non-conformité disparaît du contrôle sans aucun travail.

En **conception**, la valeur par défaut est une proposition que l'auteur accepte en ne la changeant pas : c'est un
choix de conception légitime, qui doit seulement rester visible comme tel.

Il existe déjà un dossier de preuves (`Project.evidence.provenance`, assist/evidence.ts) : une entrée par propriété
`{ nodeId, prop, basis, observations, confidence, at }`, bases `observed | deduced | aiInferred | proposed |
confirmed | manual`, enregistré dans `sources.json`, annulé avec le projet, lu par `assist/unconfirmed.ts`
(constats R-UNCONFIRMED). Seul l'assistant l'alimente.

## Options

**A. Pas de valeur par défaut dans un relevé.** `createNode` ne pose aucun défaut quand la partie est existante ;
l'interface affiche la proposition en grisé (« 20 A ? ») sans l'écrire. Les imports n'appliquent jamais de défaut.
+ simple ; « inconnu » redevient exprimable ; le moteur sait déjà traiter une donnée absente.
− ne dit rien des projets déjà enregistrés ; ne distingue pas observé / mesuré / déclaré ; `earth` et `childSafety`
absents sont aujourd'hui lus comme « présents » (symbole par défaut) : à changer pour les relevés.

**B. Étendre le dossier de preuves existant.** Ajouter les bases `default` (valeur proposée par l'application),
`imported` et `measured`, et faire écrire une entrée par tous les chemins de création (`createNode`, imports, photo,
série, corrections). Le moteur reçoit, pour les propriétés réglementaires, « confirmée ou non ».
+ réutilise un mécanisme testé, enregistré, annulable ; aucune nouvelle structure dans `props` ; couvre conception et
relevé. − la provenance vit à côté du nœud : la duplication doit la copier (elle ne le fait pas aujourd'hui) ; une
entrée par propriété par défaut grossit `sources.json`.

**C. Valeur enrichie dans `props`** (`{ value, source, date, status }` pour chaque propriété). + tout au même endroit.
− casse tous les lecteurs de `props` (moteur, calculs, unifilaire, impression, BOM, exports, photo, 4 langues),
migration lourde du format v2, intégrité et annulation à revoir. Disproportionné.

**D. Liste des clés non confirmées dans `props`** (comme `lengthEstimated` : `_proposed: 'ratedCurrent,section'`).
+ suit le nœud partout (duplication, annulation, export sans perte). − mélange données et métadonnées, contourne le
schéma et l'intégrité ; deux systèmes de provenance en parallèle.

## Décision proposée

**A + B**, par étapes :

1. **Relevé : plus de défaut écrit** (option A). Partie existante (projet existant, ou nœud `oldPart` / `installedOn`
   ancien) : `createNode` ne pose aucune valeur ayant un effet réglementaire ; l'interface montre la proposition comme
   une suggestion à accepter d'un geste. Les imports n'écrivent plus que ce que contient le fichier et posent
   `installationKind: 'existing'` quand le format décrit une installation existante, sinon « inconnu » (jamais
   « neuf » par défaut).
2. **Conception : défaut tracé** (option B). Les défauts restent écrits, avec la base `default` dans le dossier de
   preuves ; l'interface les distingue (« proposé ») tant qu'ils ne sont pas modifiés ou confirmés. Pour le moteur, un
   défaut en conception est un choix de conception (pas de constat supplémentaire).
3. **Vocabulaire minimal**, celui qui change un résultat : *inconnue* (absente), *proposée* (`default`, `proposed`,
   `aiInferred`, `deduced`, `imported` non vérifiée), *déclarée* (`manual`, `observed`), *mesurée* (`measured`),
   *confirmée* (`confirmed`). Source, date et méthode restent dans l'entrée du dossier de preuves. « Documentation
   technique » est une observation (`observed`, méthode `document`) : pas d'état à part.
4. **Moteur.** Sur une partie existante, une propriété réglementaire *proposée* est traitée comme *inconnue* :
   « données insuffisantes » ou « à vérifier », jamais une conformité ni une non-conformité certaine.
5. **Corrections en un clic sur un relevé** : elles ne réécrivent plus le fait relevé ; elles produisent une
   proposition de travaux (dossier « à faire »), et le constat reste jusqu'à la confirmation de l'exécution.
   (À valider : comportement exact et texte de l'interface.)

## Compatibilité et migration

- **Aucune promotion automatique** : une valeur d'un ancien projet n'est jamais marquée « confirmée ».
- **Anciens projets existants** (relevés enregistrés avant cette version, sans entrée de provenance) : une valeur
  égale au défaut du schéma, sur une propriété réglementaire, est marquée *proposée (héritée)* à l'ouverture, en
  mémoire et dans `sources.json` au prochain enregistrement. Le contrôle affiche alors « à confirmer » (non
  bloquant) au lieu de la conclure. Les autres valeurs restent *déclarées* (convention actuelle).
- **Anciens projets en conception** : rien ne change à l'ouverture.
- **Format** : `.voltaplan` v2 inchangé dans sa structure (nouvelles bases dans `sources.json`, champ déjà
  extensible) ; un fichier enregistré s'ouvre dans la version précédente (bases inconnues ignorées par le lecteur
  zod `looseObject`, à vérifier par un test).
- **Annulation, sauvegarde automatique** : la provenance fait partie du projet ; rien à ajouter.
- **Duplication** : copier les entrées de provenance avec les nouveaux identifiants.
- **Rapports PDF** : une valeur *proposée* d'un relevé est imprimée avec une marque (« ? » ou « à confirmer ») ; la
  légende l'explique. Quatre langues.
- **Photo** : une lecture IA reste `aiInferred` jusqu'à confirmation ; la comparaison photo ne compare plus une lecture
  à une valeur par défaut.

## Conséquences

- Plus de « données insuffisantes » sur les relevés : c'est l'effet voulu (le silence d'aujourd'hui est faux).
- Interface : un état visuel de plus (proposé), à concevoir pour rester lisible.
- Tests : migration d'anciens fichiers, provenance par chemin de création, non-régression du moteur sur les cas
  « valeur par défaut » (anomalies connues R-PROT-RATING-MISSING et R-RCD-HEAD-RATING), mutation.

## Non-objectifs

Pas de huit états affichés, pas de valeur enrichie dans `props`, pas de nouvelle règle bloquante.
