# ADR-0010 — Provenance des valeurs : une valeur proposée n'est jamais une caractéristique confirmée

Date : 2026-11-28 · Statut : **accepté dans son principe (A + B)** le 28/11/2026, révisé après relecture (décisions
1 à 10 ci-dessous) ; implémentation progressive sur la branche `data-provenance` · Complète
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


## Décision

**A + B**, par étapes : un relevé n'écrit plus de valeur par défaut réglementaire ; le dossier de preuves existant
(`Project.evidence.provenance`) est étendu à tous les chemins de création. Décisions précisées après relecture :

1. **Origine et confirmation sont deux axes distincts.** Chaque entrée garde son *origine* (`basis` et `method`
   existants, étendus : `default`, `imported`, `measured`, `calculated`, `historicUnknown`) et un *statut de
   confirmation* séparé (`unconfirmed` | `confirmed`, avec auteur et date de la confirmation). Une lecture photo, un
   import ou une mesure n'ont pas le même niveau de confirmation : une mesure est « mesurée » mais peut rester à
   confirmer (appareil, date). On réutilise les champs existants (`observations`, `confidence`, `at`) ; pas de
   nouvelle structure dans `props`.
   Pour le moteur, il n'y a que trois lectures : *inconnue*, *non confirmée* (traitée comme inconnue sur une partie
   existante), *établie* (déclarée, mesurée ou confirmée).
   *Réalisé (étape 4)* : `basis` garde l'état en vigueur (lu par les versions précédentes) ; une confirmation écrit
   `basis: confirmed` **et** garde l'origine dans `origin`, avec l'auteur (`by`, nom de l'installateur s'il est
   renseigné) et la date. Une correction à la main rend l'origine « manuelle ».
2. **Migration : provenance historique inconnue.** Une valeur d'un projet enregistré avant cette version, sans entrée
   de provenance, reçoit l'origine `historicUnknown`, **quelle que soit sa valeur** (égale ou non au défaut : on ne sait
   pas si elle a été saisie). Elle n'est jamais promue en « confirmée ». Sur une partie existante, une propriété
   réglementaire `historicUnknown` donne « à confirmer » (non bloquant). Toutes les valeurs sont conservées. L'impact
   (nombre de constats avant / après) est mesuré sur les projets d'essai avant publication.
   *Réalisé (étape 4), avec deux précisions :*
   - les valeurs historiques sont rangées dans une liste à part (`evidence.historic`), **pas** dans `provenance` :
     l'essai réel (décision 4) a montré qu'une version précédente lirait une entrée `historicUnknown` de
     `provenance` comme une valeur non confirmée de l'assistant et rétrograderait une non-conformité bloquante en
     « anomalie potentielle ». Avec la liste à part, la version précédente présente ces valeurs exactement comme
     avant ;
   - un seul signalement « à confirmer » (R-HISTORIC, nombre d'éléments et de valeurs), non bloquant, qui empêche
     toute conclusion silencieuse ; les constats des éléments concernés **ne sont pas reclassés** : une
     non-conformité établie sur une valeur du fichier reste une non-conformité (le danger est le silence, pas
     l'excès de prudence). La confirmation se fait élément par élément (« Vérifié sur place » dans les propriétés),
     jamais en bloc.
3. **Relevé et travaux sont séparés.** Le modèle distingue : *état relevé* (ce qui existe), *correction proposée*
   (par le contrôle ou l'utilisateur), *état projeté* (relevé + corrections retenues), *travaux réalisés*, *exécution
   confirmée*. Une correction en un clic sur un relevé ne modifie jamais l'état relevé : elle crée une correction
   proposée ; le constat reste sur l'état relevé jusqu'à la confirmation de l'exécution. Ce découpage prépare un
   rapport avant / après et une liste de travaux de mise en conformité (étape ultérieure).
4. **Compatibilité des fichiers vérifiée, pas supposée.** Avant publication, un fichier écrit par la nouvelle version
   est ouvert par la version précédente (test automatisé sur un commit antérieur, pas une hypothèse sur zod). On
   distingue la compatibilité **technique** (le fichier s'ouvre sans erreur) de la compatibilité **sémantique** (la
   version précédente ignore la provenance et peut présenter une valeur non confirmée comme une saisie). Si ce second
   risque est jugé inacceptable, le manifeste relève `minReaderVersion` : une ancienne version refuse alors d'ouvrir
   le fichier plutôt que de l'analyser à tort.
   *Réalisé (étape 4)* : `npm run test:compat [-- <ref>]` écrit un fichier avec la version courante, le fait ouvrir,
   contrôler, réenregistrer et rouvrir par la version précédente (arbre de travail git temporaire), puis compare.
   Résultat contre `main` (002b23a) : compatibilité technique vérifiée (ouverture, aucune valeur inventée ni
   perdue, provenance et marqueur conservés après réenregistrement). Écart sémantique constaté : une prise de
   relevé dont la terre n'est pas renseignée (étape 3) est silencieuse dans la version précédente (absence lue
   comme « présente ») et « informations insuffisantes » dans la version courante. Relever `minReaderVersion` est
   **à décider** avant publication (aucune version publiée à ce jour).
5. **Transformateurs.** La présence d'un transformateur ne suffit jamais à conclure qu'un circuit relève de la TBTS
   ni que le secondaire est protégé (corrigé le 28/11 : « à vérifier », non bloquant). Le type sera modélisé :
   transformateur de sécurité, d'isolement, autotransformateur, inconnu (défaut : inconnu). Le booléen `safety`
   (défaut `true` aujourd'hui) est remplacé par ce type, migré en « inconnu » pour les anciens projets.
6. **Différentiels sélectifs.** La caractéristique temporelle (instantané, sélectif S, retardé) est une propriété
   **indépendante** du type de courant résiduel détecté (AC, A, F, B), pas une valeur de plus de `rcdType`.
7. **Valeurs implicites à la lecture.** Les remplacements à la lecture (`device ?? 'mcb'`, `inverterType ?? 'dcAc'`,
   booléens absents lus comme vrais — terre, obturateurs —, caractéristiques supposées dans les calculs, valeurs
   inventées dans les symboles, rapports et exports) sont audités et supprimés : une donnée inconnue reste inconnue de
   bout en bout. Le dessin peut garder un symbole neutre mais montre l'inconnu ; un calcul qui suppose une valeur la
   déclare dans `assumptions` (mécanisme existant).
8. **Criticité.** Ordre de traitement : différentiel général inventé par l'import PDF ; terre et obturateurs supposés
   présents ; corrections automatiques qui effacent une non-conformité ; section, calibre, courbe et nature de
   protection supposés ; perte de provenance à la duplication ; mauvaise identification du réseau (imports en
   `2 x 230V` et « neuf ») ; transformateurs assimilés à la TBTS (fait). Une propriété classée basse ou moyenne est
   remontée quand elle décide de l'applicabilité d'une exception réglementaire (`inBoard`, `socketKind`, `count`,
   `threePhase`, `applianceType`).
9. **Tests.** Runner des anomalies connues renforcé (fait : une exception ne satisfait plus un cas « doit échouer »).
   Tests par chemin : création, chaque import, photo, série, duplication, modification, correction, sauvegarde et
   relecture `.voltaplan` (une donnée inconnue reste inconnue après un aller-retour), migration, export, impression.
   Mutation étendue à chaque nouvelle protection contre un faux résultat.
10. **Exécution.** Étapes et commits atomiques sur `data-provenance`, chacune documentée avec son impact ; typage,
    lint, tests, build, CI et CI multi-OS à chaque étape ; aucune fusion dans `main` sans accord. La relecture
    documentaire assistée par IA n'est jamais présentée comme une validation humaine.

## Compatibilité et migration

- **Aucune promotion automatique** : aucune valeur d'un ancien projet n'est marquée « confirmée ».
- **Anciens projets** : les valeurs utiles au contrôle des parties existantes, sans provenance, sont inscrites
  dans `evidence.historic` à l'ouverture (décision 2), avec le marqueur `meta.provenanceSince` (un projet créé par
  cette version le porte dès sa création ; l'opération n'est jamais refaite). En conception, le contrôle ne change
  pas (un défaut de conception est un choix) ; sur une partie existante : « à confirmer ». Limite : un élément
  ajouté ensuite par une version précédente n'est pas reconnu comme tel (cette version n'écrit pas de provenance).
- **Format** : `.voltaplan` v2 ; provenance dans `sources.json`. Compatibilité technique testée sur la version
  précédente ; compatibilité sémantique : décision 4.
- **Annulation, sauvegarde automatique** : la provenance fait partie du projet (instantanés complets) ; à tester.
- **Duplication** : les entrées de provenance et les valeurs historiques sont copiées avec les nouveaux
  identifiants (fait, étape 4).
- **Rapports PDF, unifilaire, liste de matériel** : une valeur non confirmée d'un relevé porte une marque (« ? »)
  expliquée en légende, dans les quatre langues. Le résumé distingue non-conformités établies, recommandations,
  données manquantes et exigences non évaluées ; l'absence de constat n'est jamais présentée comme une preuve de
  conformité globale.
- **Photo** : une lecture reste `aiInferred` non confirmée jusqu'à confirmation ; elle n'est plus comparée à une
  valeur par défaut.

## Conséquences

- Plus de « données insuffisantes » et de « à confirmer » sur les relevés : c'est l'effet voulu (le silence était
  faux). Déjà visible : un projet sans longueurs de câbles reçoit « vérifications à faire » (longueur protégée et
  chute de tension non calculées).
- Interface : deux états visuels de plus (non confirmée, correction proposée), à concevoir pour rester lisibles.

## Non-objectifs

Pas de valeur enrichie dans `props`, pas de huit états affichés à l'utilisateur, pas de nouvelle règle bloquante
fondée sur une interprétation non établie.
