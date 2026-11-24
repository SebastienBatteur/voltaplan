# Assistant de création de projets — état du code et plan

Statut : **analyse**, rien n'est implémenté. Objectif fixé : un premier **brouillon** de dossier en quelques
minutes, à partir des documents dont dispose l'utilisateur.

## 0. L'essentiel

**Atout majeur déjà présent : tout part de l'arbre électrique.** L'unifilaire est calculé automatiquement à partir
de l'arbre (`src/unifilar/layout.ts`), le tableau se dispose automatiquement (`autoLayout` dans
`src/board/model.ts`), et « Mettre à jour » pose les nouveaux points sur le plan près du nom de leur pièce
(`src/model/sync.ts`). Le contrôle RGIE et les calculs suivent d'office.

**L'assistant n'a donc qu'une chose difficile à produire : un arbre électrique fiable**, avec des emplacements
(pièce, position sur le plan). Les trois vues en découlent sans travail supplémentaire. C'est ce qui rend
l'objectif « quelques minutes » atteignable.

**Ce qui manque structurellement**, avant toute nouvelle IA :

1. un **modèle de sources** : les documents importés, conservés en original ;
2. un modèle de **propositions** : des modifications en attente, chacune liée à sa source et à son degré de
   certitude, acceptées ou refusées par l'utilisateur ;
3. un **journal des questions** à poser à l'utilisateur.

Ces trois éléments doivent être conçus **avant** le format v2 (voir [DECISIONS.md § 4](DECISIONS.md)).

## 1. État du code, point par point

| # | Sujet | Existant | Manque |
|---|---|---|---|
| 1 | **Photos de tableaux** | **Le plus avancé.** Calage des rangées à la main (`src/board/photo.ts`), détection des séparations entre appareils **sans IA** par les bords verticaux, image composée redressée avec une règle de modules (`src/ai/boardImage.ts`) qui rend la lecture par l'IA plus fiable et moins chère, schéma de réponse strict (`src/ai/boardPhotoAi.ts`), affectation aux appareils du projet, comparaison, propositions de valeurs et **création d'appareils** à partir de la photo (`src/ai/boardPhoto.ts`, `src/ui/BoardView.tsx` : `createFromPhoto`) | les circuits **en aval** (prises, points lumineux) ne sont pas créés ; une seule photo par tableau ; pas de lien durable entre une valeur et la photo ; lecture des étiquettes en texte brut, sans interprétation (« PRISES CUISINE » → pièce cuisine, type prises) |
| 2 | **Plans d'architecte** | import d'un fond de plan, photo ou PDF (**1re page seulement**, réduite à 2 400 px en JPEG : `src/io/background.ts`) ; redressement par 4 points et détection des murs et portes **sans IA** (`src/plan/trace.ts`) | lecture des **pièces** (noms, surfaces), des étages, du **texte vectoriel** des PDF (pdf.js le permet : `getTextContent`, non utilisé), des symboles ; plusieurs pages ; conservation de l'original |
| 3 | **Plusieurs documents par projet** | plusieurs pages de plan, chacune avec ses images de fond ; une photo par tableau | pas de bibliothèque de documents (PDF, rapports, anciens schémas, notes) ; pas de conservation des originaux |
| 4 | **Croisement des sources** | uniquement photo ↔ projet (comparaison des appareils) | aucun croisement entre plan, photo, ancien schéma et rapport ; aucune résolution de contradictions |
| 5 | **Symboles électriques** | aucun | reconnaissance des symboles sur un plan d'implantation ou un ancien unifilaire |
| 6 | **Modèle structuré généré** | **import Trikker** (`src/import/trikker.ts`) : reconstruction déterministe complète depuis un fichier Trikker, avec `source` gardée par élément ; création d'appareils depuis la photo | pas de génération d'arbre à partir de documents non structurés |
| 7 | **Génération simultanée des trois vues** | **oui, dès que l'arbre existe** (unifilaire automatique, disposition automatique du tableau, pose sur le plan par pièce) | placement sur le plan à partir de coordonnées détectées, et non seulement du nom de pièce |
| 8 | **Fidélité à l'existant non conforme** | le modèle accepte tout (aucune correction automatique) ; le contrôle signale sans modifier ; règles « existant » et dérogations ; `inferred` pour les valeurs déduites | garantie explicite dans l'assistant : « état des lieux » et « propositions de correction » séparés ; interdiction testée de « corriger » pendant la reconstruction |
| 9 | **Conception d'une installation neuve** | moteur RGIE et calculs (chute de tension, bilan, équilibrage) ; listes `DEDICATED_CIRCUIT_APPLIANCES`, `RCD30_APPLIANCES` | aucun générateur : regroupement en circuits, choix des sections, protections, organisation des différentiels, phases |
| 10 | **Inconnues et questions** | valeurs vides acceptées ; constats « information manquante » | pas de liste de questions ordonnée ; pas d'état « inconnu, à confirmer » distinct de « vide » |
| 11 | **Traçabilité vers les sources** | `source` pour Trikker seulement ; `inferred` sur les constats | lien « propriété → document, page, zone, méthode (IA, détection, saisie), certitude » |
| 12 | **Coûts IA** | image composée petite, photo réduite à 1 600 px, détection sans IA d'abord, schéma strict, fournisseurs au choix, modèles locaux | cache des réponses par empreinte ; texte des PDF extrait localement ; recadrage par zone ; estimation du coût avant l'envoi |
| 13 | **Simplicité** | parcours photo de tableau guidé (calage, lecture, propositions à accepter une par une) | parcours unique « Nouveau projet à partir de documents » ; écran de relevé sur téléphone |

**Permissions déjà déclarées mais sans fonction derrière** (`src/ai/settings.ts`) :

- `planFromPhoto` (murs depuis une photo ou un PDF par l'IA) ;
- `unifilarFromDocument` (unifilaire depuis un ancien dossier) ;
- `fixSuggestions` (suggestions de correction).

Seule `boardFromPhoto` est utilisée. À clarifier dans l'interface : soit les masquer, soit les marquer « bientôt ».

## 2. Architecture proposée

```
Documents (originaux, format v2 : assets/ + sources.json)
   │
   ├─ Extraction locale, sans IA, gratuite
   │    texte PDF (pdf.js) · rendu des pages · détection murs/portes · séparations du tableau
   │    lecture déterministe de l'import Trikker
   │
   ├─ Extraction par IA (optionnelle, ciblée)
   │    image composée du tableau · zones de plan recadrées · ancien unifilaire page par page
   │    → réponses validées par schéma, mises en cache par empreinte (image + consigne + modèle)
   │
   ▼
Observations   : « sur le document X, page 2, zone (x,y,w,h), méthode M, certitude C : disjoncteur 16 A, courbe C, étiquette "PRISES CUISINE" »
   │
   ▼
Fusion déterministe (sans IA) : regroupe les observations d'un même objet, détecte les contradictions
   │
   ▼
Propositions   : « créer circuit B (prises, cuisine), protection 16 A — sources : photo tableau, plan p.1 »
Questions      : « Section du câble du circuit B ? (inconnue) » · « Photo : 20 A, ancien schéma : 16 A — lequel ? »
   │
   ▼
Validation humaine (accepter, modifier ou refuser, une par une ou en bloc par niveau de certitude)
   │
   ▼
Arbre électrique ──► unifilaire, tableau, plan (existant) ──► contrôle RGIE et calculs (existant)
   │
   ▼  (installation existante seulement, et sur demande)
Propositions de correction, séparées de l'état des lieux, jamais appliquées automatiquement
```

**Principes** :

- **Observation, puis fusion, puis proposition.** L'IA ne modifie jamais le projet ; elle produit des observations.
  La fusion et le contrôle restent déterministes et testés.
- **« Inconnu » est une valeur.** Une propriété peut être `unknown`, avec la question associée. Ce n'est pas la
  même chose qu'une propriété vide. Le contrôle traite `unknown` comme une information insuffisante, jamais comme
  une non-conformité.
- **État des lieux et corrections sont séparés.** Pour une installation existante, l'état reconstruit est figé
  comme « relevé du JJ/MM/AAAA ». Les corrections sont des propositions à part, avec la règle qui les motive.
- **Chaque valeur garde sa source** : document, page, zone, méthode, certitude. L'interface montre la zone source au
  survol ou au toucher. Le dossier peut lister les sources.

## 3. Développements nécessaires

| Étape | Contenu | Complexité | Dépend de |
|---|---|---|---|
| A | Modèle `sources` / `observations` / `propositions` / `questions` (types, zod, tests) | M | — (à concevoir avant le format v2) |
| B | Bibliothèque de documents dans le projet (originaux, pages, aperçus) | M | format v2 |
| C | Valeur « inconnu » et liste de questions, prises en compte par le contrôle | S à M | A |
| D | Écran de validation des propositions (en bloc par certitude, détail par source) | M | A |
| E | Photo de tableau → **circuits complets** : interpréter les étiquettes (pièce, usage), créer les circuits en aval comme propositions | M | A, D |
| F | Texte vectoriel des plans PDF (noms et surfaces des pièces, étages) via pdf.js, **sans IA** | S à M | B |
| G | Plan raster : pièces et symboles par l'IA sur des **zones recadrées**, avec cache | M à L | A, B |
| H | Ancien unifilaire (PDF ou photo) → arbre, par l'IA page par page | L | A, D |
| I | Fusion multi-sources, contradictions transformées en questions | M | A, E à H |
| J | **Parcours « Nouveau projet à partir de documents »** : déposer les documents, extraction, validation, dossier brouillon | M | D, E, F |
| K | Conception neuve : regroupement en circuits, sections, protections, différentiels, phases, par des **règles déterministes** guidées par le moteur RGIE ; l'IA ne sert qu'à lire le plan | L | A, F/G, relecture par un expert |

**Premier jalon conseillé (le plus de valeur, le moins de risque)** : A, C, D, E et J, limités à la **photo du
tableau et ses étiquettes**.

- Un électricien photographie son tableau et obtient en quelques minutes un unifilaire, un tableau et une liste
  de circuits en brouillon, avec des questions pour ce qui manque.
- On s'appuie sur la partie la plus aboutie du code.
- Estimation : **6 à 10 semaines** à temps partiel.

**Deuxième jalon** : F puis G (plans), pour placer les points sur le plan de position.

**Troisième jalon** : H et I (anciens schémas, croisement des sources).

**La conception neuve (K) vient en dernier.** C'est la plus exposée réglementairement : elle doit reposer sur des
règles relues par un expert, pas sur un modèle de langage.

## 4. Réduction des coûts et des appels à l'IA

1. **D'abord les traitements locaux gratuits** :
   - texte des PDF vectoriels ;
   - détection des murs et des séparations ;
   - lecture des fichiers structurés (Trikker).
   - L'IA n'intervient que pour ce qui reste.
2. **Images petites et ciblées** :
   - image composée du tableau, déjà en place ;
   - zones de plan recadrées, et non des pages entières ;
   - niveaux de gris quand la couleur n'apporte rien.
3. **Cache par empreinte** : image, consigne, modèle et version du schéma. On ne repaie jamais la même lecture,
   même après une réouverture. Le cache est stocké dans le projet (`sources.json`) et réutilisable sur un autre
   appareil.
4. **Lecture et contrôle par l'IA séparés** : le modèle lit seulement. Calculs, fusion et contrôle sont toujours
   locaux.
5. **Estimation affichée avant l'envoi** : nombre d'images, taille, fournisseur, coût indicatif. Le prix par modèle
   change souvent : soit on l'omet, soit l'utilisateur le saisit **[à décider]**.
6. **Modèles locaux** pour les lectures simples, documentés (Ollama, LM Studio). Leur qualité sur la lecture de
   tableaux est **[à mesurer]** avant de les recommander.

## 5. Risques

| Risque | Impact | Réponse |
|---|---|---|
| Lecture IA fausse mais plausible (calibre, courbe) | dossier erroné | certitude affichée ; valeurs IA toujours en proposition ; comparaison avec la détection locale ; tests sur un corpus de photos réelles anonymisées |
| L'utilisateur accepte tout en bloc sans lire | erreurs validées | acceptation en bloc limitée aux certitudes élevées ; questions obligatoires pour les contradictions ; mention « relevé assisté, non vérifié » tant que des propositions n'ont pas été vues |
| Reconstruction « embellie » (conforme sur papier) | grave : faux état des lieux | séparation testée entre état des lieux et corrections ; aucune règle RGIE appliquée pendant la reconstruction |
| Coût IA élevé chez l'utilisateur | rejet | traitements locaux d'abord, cache, estimation affichée |
| Dérive des modèles (un fournisseur change son modèle) | régression silencieuse | schéma strict ; corpus de non-régression à relancer à la main avant chaque changement de modèle par défaut |
| Conception neuve présentée comme conforme | responsabilité | règles déterministes relues par un expert ; terminologie (« proposition », « résultat indicatif ») |
| Complexité de l'interface | perte de la cible « peu à l'aise avec l'informatique » | un seul parcours guidé ; vocabulaire du métier ; tests avec de vrais électriciens |
| Données personnelles envoyées à l'IA (plans, adresses) | confidentialité | consentement par envoi déjà en place ; recadrage (on n'envoie pas le cartouche du plan avec l'adresse) ; modèles locaux possibles |

## 6. Simplicité d'utilisation (cible : électricien peu à l'aise avec l'informatique)

- **Un seul bouton** : « Nouveau projet à partir de photos et documents ».
- **Étapes visibles**, sans jargon informatique : 1. Ajouter les documents · 2. Vérifier ce qui a été lu · 3.
  Répondre aux questions · 4. Dossier brouillon.
- **Questions une par une**, dans le vocabulaire du métier, avec la zone de la photo affichée : « Ce disjoncteur
  est-il un 16 A ? ».
- **Tout se fait aussi sans IA** : le même parcours fonctionne avec une saisie manuelle guidée, et l'IA n'est
  qu'un accélérateur.
- **Sur téléphone** : photographier, répondre aux questions. Sur ordinateur : finaliser le dossier.

## 7. Estimations précisées et niveaux de maturité (2026-11-24)

**Nature de l'estimation initiale « 6 à 10 semaines »** : c'était une estimation de **développement humain
classique**, à temps partiel. Avec Claude Code en autonomie, l'écriture du code se compresse fortement. Le délai
réel est alors dominé par :

- les validations du porteur du projet (spécifications, essais) ;
- la constitution d'un **corpus de photos réelles anonymisées** ;
- l'itération sur la qualité de lecture de l'IA (mesures, réglage des consignes) ;
- les essais de terrain et la relecture réglementaire.

Aucun de ces facteurs ne s'accélère avec plus de code.

| Niveau | Contenu | Claude Code (délai réel) | Développement humain classique |
|---|---|---|---|
| **Prototype minimal** | photo du tableau → calage (existant) → lecture IA (existante) → **« Tout créer depuis la photo »** : tableau, appareils et circuits proposés d'après les étiquettes, unifilaire automatique ; propositions de la session seulement, sans dossier de preuves persistant | **2 à 4 jours** | 1 à 2 semaines |
| **Première version utilisable** | dossier de preuves (spécification A) en v1, questions, écran de validation, cache de l'IA, interprétation des étiquettes (pièce, usage), test de fidélité, essais sur environ 20 photos réelles | **1 à 2 semaines**, dont environ la moitié d'attente de validations et de photos | 4 à 6 semaines |
| **Bêta** | format v2 (originaux), plusieurs photos par tableau, texte des plans PDF, essais chez 5 à 10 électriciens, modèles locaux mesurés | **3 à 6 semaines** | 2 à 3 mois |
| **Professionnelle** | corpus de plus de 100 tableaux avec taux de lecture mesuré, non-régression par modèle, documentation, support, relecture par un expert des propositions de conception | **3 à 6 mois**, limités par le terrain et l'expertise, pas par le code | 4 à 8 mois |

### Chemin le plus court vers un premier brouillon à partir d'une photo de tableau

Ce chemin s'appuie sur ce qui existe déjà :

1. **Nouveau projet → « Depuis une photo du tableau »** : un tableau vide est créé, et la photo est importée
   (existant).
2. **Calage des rangées** : 2 clics par rangée (existant ; la détection des séparations aide déjà).
3. **Lecture par l'IA** (existante) : type, calibre, courbe, sensibilité, étiquette et repère de chaque appareil.
4. **Nouveau** :
   - les appareils sont créés dans l'arbre, dans l'ordre du tableau ; `createFromPhoto` existe pour un appareil,
     il suffit de l'appliquer à tous ;
   - les différentiels deviennent parents des disjoncteurs qu'ils protègent (repères « A-F » déjà lus) ;
   - **un circuit par disjoncteur**, nommé d'après son étiquette. Une analyse déterministe de l'étiquette
     (« PRISES CUISINE » → prises, cuisine ; « ÉCLAIRAGE » → points lumineux) propose le contenu, en quantité
     **inconnue**, donc avec une question.
5. L'unifilaire, le tableau et la liste des circuits s'affichent aussitôt (existant), ainsi que le contrôle RGIE
   avec les « informations manquantes ». Ce n'est pas une reconstruction embellie : rien n'est corrigé.

**Ce que ce chemin ne fait pas** :

- placer les points sur le plan : il faut un plan, c'est le deuxième jalon ;
- connaître les sections des câbles et le nombre de points par circuit : questions à l'utilisateur.

**Sa condition** : que la spécification du modèle de l'assistant soit validée d'abord, pour que le prototype n'ait
pas à être réécrit.

## 8. Prototype du premier parcours : état (2026-11-24)

**Implémenté**, testé automatiquement (28 tests) et parcouru dans le navigateur avec une lecture de photo
**simulée** :

1. **Fichier → Nouveau relevé (installation existante)** : origine, compteur et tableau seulement, sans protection
   générale inventée.
2. **Tableau** : rangées et modules, photo, calage des rangées (existant), puis « Lire avec l'IA ». Quand le tableau
   est vide, la lecture devient un **brouillon** : rien n'est appliqué.
3. **Assistant**, en 4 étapes :
   - accepter ce qui est sûr ;
   - vérifier une par une les propositions critiques (différentiels, raccordements devinés, lectures incertaines) ;
     les « probables » (usages déduits des étiquettes) s'acceptent ensemble mais restent « à vérifier » ;
   - répondre aux questions (calibre, courbe, sensibilité, section, raccordement, usage), toujours avec
     « Je ne sais pas » ;
   - figer le relevé.
4. **Analyse RGIE** : les valeurs non confirmées sont signalées et les constats qui en dépendent sont marqués
   « à vérifier ».

**Ce que le prototype ne fait pas encore :**

- plusieurs photos d'un même tableau, tableaux divisionnaires, plans ou documents (objectifs 2 et 3) ;
- placement des points sur le plan de position ;
- appareils non protecteurs (télérupteurs, parafoudres) : signalés, mais pas ajoutés au schéma, car leur
  raccordement est inconnu ;
- cache des lectures de l'IA (le dossier de preuves garde déjà l'empreinte de la photo) ;
- partie « Sources et hypothèses » détaillée dans le dossier imprimé. Les valeurs non confirmées y figurent déjà
  par les constats.

**Constat lors de l'essai : la règle « Aucune prise de terre n'est dessinée »** est bloquante. Dans un relevé, elle
reflète l'absence dans le dessin, pas forcément dans la réalité. Pour une installation existante relevée par photo,
il faudrait plutôt une **question** (« prise de terre vue sur place ? »). C'est à décider : cela touche le moteur
RGIE et la terminologie.

## 9. Tester sur une vraie installation (procédure)

**Prérequis** : IA activée avec ta clé (ou un modèle local) et autorisation « Disposition des modules depuis une
photo du tableau ». Utilise une photo de ton propre tableau, ou d'un tableau d'essai, jamais celle d'un client sans
son accord.

1. Fichier → **Nouveau relevé (installation existante)**.
2. Onglet **Tableau** : nombre de rangées et de modules par rangée ; **ajouter la photo** ; **caler** chaque
   rangée (2 clics par rangée).
3. **Lire avec l'IA** : l'assistant s'ouvre avec le brouillon.
4. Suivre les 4 étapes, puis **Analyse RGIE**.
5. **À noter** pour chaque essai :
   - nombre d'appareils lus ;
   - erreurs de lecture (calibre, type, étiquette) ;
   - raccordements faux ;
   - questions inutiles ou manquantes ;
   - temps total ;
   - points d'ergonomie gênants.

Ces retours servent à régler les seuils de confiance, les mots-clés des étiquettes et les questions.
