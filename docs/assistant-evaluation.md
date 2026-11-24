# Évaluer la lecture des photos de tableaux par l'IA

Statut : outil et protocole prêts, **aucune mesure réelle faite à ce jour**. Date : 2026-11-24.

## 0. À lire d'abord

- **Les tests automatiques de l'assistant et du banc utilisent des lectures simulées** (écrites à la main). Ils
  vérifient la logique déterministe (fusion des photos, contradictions, doublons, questions, fidélité de la
  reconstruction) et le calcul des indicateurs du banc (`test/aiEval*.test.ts`). **Ils ne disent rien de la qualité
  réelle de la reconnaissance** (lire un calibre, une courbe, une étiquette sur une vraie photo), et les chiffres des
  exemples de `tools/ai-eval/examples/` ne valent pas mesure.
- Seul ce banc, lancé **par le propriétaire du projet, avec sa clé ou son modèle local**, sur des **photos réelles**
  avec une **vérité terrain vérifiée sur place**, mesure cette qualité.
- **Aucun appel payant sans l'accord du propriétaire** : par défaut le banc n'appelle rien ; un appel exige
  `--live --i-authorize-costs` (et, en mode matrice, un prix connu, une clé dans une variable d'environnement et un
  plafond `--max-cost`).
- Le banc n'est jamais lancé en intégration continue, aucune photo réelle n'est versée dans le dépôt, et aucun
  résultat n'est envoyé où que ce soit : tout reste sur la machine.

## 1. Constituer un corpus sans données personnelles

Une photo de tableau peut contenir des données personnelles : noms sur les étiquettes (« Chambre Lucas »), adresse
sur un autocollant, visage ou intérieur du logement autour du tableau.

### 1.1 Plan d'échantillonnage (cible : au moins 30 tableaux)

Trente tableaux permettent de comparer deux modèles et de repérer les erreurs graves ; plus de 100 pour une mesure
stable (voir [ASSISTANT.md](strategie/ASSISTANT.md) § 7 et le § 10 ci-dessous). Répartir le corpus par strates, pour
ne pas mesurer seulement des cas faciles :

| Strate | Cible (sur 30) | Pourquoi |
|---|---:|---|
| Anciens tableaux à fusibles (porcelaine, coupe-circuits, avant 1980) | 3 | types rares, calibres sur bague ou absents |
| Tableaux des années 1980–1990 (premiers différentiels, étiquettes manuscrites jaunies) | 5 | étiquettes difficiles, différentiels sans type lisible |
| Tableaux récents (après 2000, étiquettes imprimées) | 6 | cas nominal, base de comparaison |
| Tableaux de 3 rangées ou plus | 5 | décalages de rangée, largeurs, appariements |
| Maisons à plusieurs tableaux (principal + sous-tableau) | 4 installations | rattachement des sous-tableaux (§ 7) |
| Mauvaise lumière, reflets, flou léger | 4 | invention de valeurs sur l'illisible |
| Photos partielles ou plusieurs photos d'un même tableau (gros plans, rangée par rangée) | 3 installations | fusion, contradictions entre photos |

Varier aussi : marques (Hager, Schneider, Legrand, ABB, Siemens…), étiquettes FR et NL, 1 à 4 rangées, appareils
connectés. Un même tableau peut compter dans plusieurs strates ; noter les strates dans `notes` pour pouvoir
découper les résultats.

### 1.2 Sources et consentement

- **Sources acceptables** : ton propre tableau ; des tableaux d'essai (atelier, formation, maquette) ; un tableau de
  client **seulement avec son accord écrit**, après anonymisation.
- **Accord écrit** (courriel ou papier) : « J'accepte que des photos de mon tableau électrique, recadrées et rendues
  anonymes (aucun nom, aucune adresse, aucun visage), servent à évaluer un logiciel de relevé. Elles ne seront pas
  publiées et je peux demander leur suppression à tout moment. » Garder l'accord **hors du corpus**, avec un
  identifiant neutre (ex. `T07`), jamais le nom dans le nom de fichier.
- Retrait de l'accord : supprimer la photo, sa vérité et les lectures enregistrées (`tools/ai-eval/resultats/…`).

### 1.3 Anonymiser avant tout usage

- recadrer sur le tableau (rien autour : pas de visage, pas de pièce, pas de courrier, pas de compteur portant un
  numéro EAN) ;
- **masquer** (rectangle opaque, préférable au flou, qui peut se lire) les étiquettes portant un nom de personne
  (« Ch. Lucas »), une adresse, un numéro de téléphone ou un code EAN ; noter dans la vérité terrain que l'étiquette
  est masquée : `"label": null` et `"unreadable": ["label"]` ;
- garder les étiquettes d'usage (« Prises cuisine », « LL », « Ecl. ch.1 ») : ce sont elles qu'on veut mesurer ;
- retirer les métadonnées EXIF (position GPS) : une réexportation en JPEG depuis un éditeur d'images suffit en
  général ; à vérifier (propriétés du fichier) ;
- nommer les fichiers avec l'identifiant neutre (`T07-r1.jpg`), jamais avec un nom ou une rue.

### 1.4 Ranger le corpus hors du dépôt

Un dossier personnel (recommandé), ou `tools/ai-eval/corpus/` (ignoré par git). Ne jamais le mettre dans
`test/fixtures/` (fichiers de clients, ignorés aussi, mais réservés à d'autres usages). Les résultats vont par défaut
dans `tools/ai-eval/resultats/` (ignoré par git) ; ils contiennent les lectures du modèle, donc les étiquettes : les
traiter comme le corpus.

## 2. Préparer une photo

Deux possibilités pour l'image :

- **Image composée (recommandé, c'est ce que l'application envoie)** : dans Voltaplan, onglet Tableau, ajouter la
  photo, caler les rangées, puis **« Image pour l'IA »** (visible quand l'IA est activée). L'image exacte qui serait
  envoyée est enregistrée, **sans rien envoyer**. Dans la vérité terrain : `"composed": true`, et `rows` = nombre de
  rangées calées.
- **Photo brute** : `"composed": false`. L'IA reçoit la photo telle quelle (le banc ne la réduit pas, contrairement à
  l'application qui la ramène à 1 600 px : réduisez-la vous-même pour comparer à l'identique).

## 3. Vérité terrain (`voltaplan-ai-eval/1`)

Un fichier `<nom>.truth.json` par photo, dans le même dossier que l'image. Modèle :
[tools/ai-eval/template.truth.json](../tools/ai-eval/template.truth.json). Exemples **synthétiques** (inventés, sans
photo) : [tools/ai-eval/examples/](../tools/ai-eval/examples/).

| Champ | Sens |
|---|---|
| `format` | toujours `"voltaplan-ai-eval/1"` |
| `image` | nom du fichier image (relatif au fichier de vérité) : `.jpg`, `.jpeg`, `.png`, `.webp` |
| `composed` | `true` : image composée par Voltaplan ; `false` : photo brute |
| `rows`, `perRow` | rangées montrées et modules par rangée (comme dans l'application) |
| `lang` | langue des remarques demandées au modèle (`fr`, `nl`, `en`) |
| `notes` | libre (strates, date de vérification) — **jamais de nom ni d'adresse** |
| `devices` | un objet par appareil, caches compris (`"kind": "blank"`, ignorés au score) |

Par appareil : `row` (0 = la plus haute), `startModule` (0 = premier module de la rangée), `widthModules`, `kind`
(`mcb`, `rcd`, `rcbo`, `fuse`, `switch`, `spd`, `contactor`, `teleswitch`, `timer`, `transformer`, `meter`,
`domotic`, `other`, `blank`), `ratedCurrentA`, `curve`, `residualCurrentmA`, `rcdType`, `poles` (« 1P », « 1P+N »,
« 2P », « 3P », « 4P »… tel que marqué), `label` (texte exact de l'étiquette), `circuitRef` (repère, ex. « H »), et
deux listes facultatives :

- `unsure` : champs dont l'annotateur **n'est pas sûr** (ex. `["ratedCurrentA"]`) : non évalués, comptés à part ;
- `unreadable` : champs à `null` parce que la valeur **existe mais est illisible** (étiquette masquée, chiffre
  effacé) ; sans cette mention, `null` veut dire **absente** de l'appareil.

**Règle importante** : un champ **absent du fichier** n'est pas évalué ; un champ à **`null`** veut dire « réellement
absent ou illisible sur l'appareil ». Si le modèle donne quand même une valeur, elle est comptée comme **inventée** :
c'est l'erreur la plus grave pour un relevé, car elle passerait pour une observation.

### 3.1 Guide d'annotation

- **Qui annote** : le porteur du projet ou un électricien, **devant le tableau** (capot ouvert si nécessaire, sous
  tension seulement si c'est sûr), jamais d'après la photo seule : la vérité terrain dit ce qui est sur l'appareil,
  pas ce qu'on croit voir sur l'image.
- **Avant tout lancement** : annoter sans avoir vu de lecture d'un modèle (sinon la vérité se cale sur le modèle).
- **Double annotation** : au moins 20 % des tableaux (6 sur 30) annotés indépendamment par deux personnes, puis
  comparés avec le banc lui-même (une annotation servant de « lecture » de l'autre : la réécrire en
  `<nom>.prediction.json` au format d'une lecture, appareils regroupés par rangée, `widthModules` renseigné, champs
  inconnus à `null`, puis `npm run ai-eval -- --dir … --predictions …`). Accord attendu : plus de
  95 % sur le type et le calibre. Chaque désaccord est tranché sur place et la règle qui l'explique est ajoutée ici.
- **Trois états à distinguer** :

  | Situation | À écrire |
  |---|---|
  | La valeur est lisible sur l'appareil | la valeur (`"ratedCurrentA": 16`) |
  | La valeur n'existe pas (pas de courbe sur un différentiel, pas d'étiquette) | `null` |
  | La valeur existe mais ne se lit pas (effacée, masquée, cachée par un câble) | `null` **et** le champ dans `unreadable` |
  | L'annotateur hésite (16 ou 10 ?) | la valeur la plus probable **et** le champ dans `unsure` (non évalué) |
  | Champ qu'on ne veut pas évaluer | ne pas l'écrire |

- **Étiquettes** : recopier caractère par caractère (casse, abréviations, chiffres romains). Le banc compare le texte
  exact et le texte normalisé (sans casse, accents ni ponctuation).
- **Pôles** : ce qui est marqué sur l'appareil, pas ce qu'on déduit de la largeur.

## 4. Lancer (un modèle)

Le banc appelle **exactement** la même fonction que l'application (`readBoardPhoto` de `src/ai/boardPhotoAi.ts` :
même consigne, même schéma, même validation), depuis Node.

```sh
# Anthropic : la clé est lue dans une variable d'environnement, jamais passée en argument
export ANTHROPIC_API_KEY=…            # PowerShell : $env:ANTHROPIC_API_KEY = '…'
npm run ai-eval -- --dir ~/corpus-tableaux --live --i-authorize-costs --provider anthropic --model <modèle> \
  --save-predictions ~/corpus-tableaux/lectures --price-in <prix entrée> --price-out <prix sortie>

# Modèle local (Ollama, LM Studio) : aucune clé, rien ne sort de la machine
npm run ai-eval -- --dir ~/corpus-tableaux --live --i-authorize-costs --provider openaiCompatible \
  --base-url http://localhost:11434/v1 --model <modèle-vision>

# Réévaluer des lectures déjà faites (aucun appel)
npm run ai-eval -- --dir ~/corpus-tableaux --predictions ~/corpus-tableaux/lectures

# Démonstration avec les exemples synthétiques (aucun appel, aucune photo)
npm run ai-eval -- --dir tools/ai-eval/examples --predictions tools/ai-eval/examples --out /tmp/rapport.md
```

Sans `--live --i-authorize-costs`, **aucune requête n'est faite**. Options : `--key-env <VARIABLE>`, `--out
<rapport.md>` (par défaut `<dir>/rapport-evaluation.md`), `--lang`, `--limit <n>`, `--currency`. Les prix
(`--price-in`, `--price-out`) sont par million de jetons, à recopier depuis la page de tarifs du fournisseur : ils
changent souvent et ne sont pas codés dans l'outil. Pour comparer plusieurs modèles : mode matrice (§ 9).

## 5. Rapport

Le rapport Markdown contient :

- **détection** : appareils de la vérité, lus, appariés (même rangée et même module, sinon recouvrement d'au moins la
  moitié), rappel, précision, non lus, en trop ;
- **exactitude par champ** : type, position, largeur, calibre, courbe, sensibilité, type de différentiel, pôles,
  étiquette (texte normalisé et texte exact), **usage et pièce déduits de l'étiquette** (ce que l'assistant en tire
  réellement), repère du circuit ; pour chacun : exact, faux, **inventé**, manqué, incertains (non évalués) ;
- **confusion des types** (vérité → lu), les confusions marquées ⚠ ;
- **par photo** : durée, jetons (entrée / sortie, relevés sur la réponse du fournisseur), coût si les prix sont
  donnés.

## 6. Ce qu'il faut regarder

1. **Inventés** : doit rester à 0 sur le calibre et la sensibilité. Sinon, renforcer la consigne (« null si
   illisible ») ou relever le seuil de confiance avant de proposer.
2. **Manqués** : acceptables (l'assistant pose une question), mais trop nombreux = trop de questions.
3. **Largeur et position** : une erreur décale tout le rang et fausse la structure (différentiel → circuits).
4. **Usage déduit** : si le texte est faux mais l'usage juste, la lecture reste utile.
5. **Coût et durée** par photo, à comparer entre modèles (cloud et local).

Refaire la mesure **avant chaque changement de modèle par défaut ou de consigne** (`BOARD_PROMPT_VERSION` dans
`src/assist/ui.ts`), et garder les rapports datés (hors dépôt s'ils citent des photos privées).

## 7. Installations : plusieurs photos, plusieurs tableaux (`voltaplan-ai-eval-case/1`)

Pour mesurer la **reconstruction complète** (et pas seulement la lecture d'une photo), décrire chaque installation
dans un fichier `<nom>.case.json`, dans le même dossier que les vérités de ses photos. Exemple synthétique :
[tools/ai-eval/examples/installation/maison.case.json](../tools/ai-eval/examples/installation/maison.case.json).

```json
{
  "format": "voltaplan-ai-eval-case/1",
  "boards": [
    {
      "id": "principal", "name": "Tableau principal",
      "photos": [
        { "truth": "T07-r1.truth.json" },
        { "truth": "T07-r2.truth.json", "offset": { "row": 1, "module": 0 } },
        { "truth": "T07-gros-plan.truth.json", "offset": { "row": 0, "module": 2 } }
      ],
      "upstream": { "r0m0": null, "r0m2": "r0m0", "r1m3": "r1m0" }
    },
    { "id": "garage", "name": "Garage", "photos": [{ "truth": "T07-garage.truth.json" }],
      "fedBy": { "board": "principal", "at": "r1m3" } }
  ]
}
```

- Le **premier tableau** est le principal ; les autres sont ajoutés comme dans l'application (« Ajouter un tableau »,
  alimentation inconnue), avec le `name` que l'utilisateur saisirait.
- `offset` : où commence une photo partielle dans le tableau (rangée, module). Les positions de `upstream` et `fedBy`
  sont celles **du tableau** (après décalage) : `r1m3` = rangée 1, module 3.
- `upstream` : pour chaque protection, la position de l'appareil en amont (différentiel…) ou `null` = directement sous
  le tableau. Protection non listée : raccordement non évalué.
- `fedBy` : protection qui alimente le sous-tableau.

Le banc fait passer les lectures du modèle par le code de l'assistant (`addBoardReading` : fusion des photos,
contradictions, doublons ; `addBoard` : sous-tableaux), puis accepte les propositions **comme l'application**
(« Tout accepter » sur ce qui est sûr, puis chaque proposition à voir une par une), **sans aucune correction** : c'est
le cas le plus défavorable, un utilisateur qui valide tout. L'arbre obtenu est comparé à la vérité.

## 8. Indicateurs (définitions)

Sur les appareils **appariés** (même rangée, même module, sinon recouvrement d'au moins la moitié) :

| Indicateur | Définition |
|---|---|
| Détection : rappel | appareils de la vérité appariés / appareils de la vérité (caches exclus) |
| Détection : précision | appareils lus appariés / appareils lus |
| Appareils inventés | appareils lus sans correspondant dans la vérité / appareils lus |
| Exactitude d'un champ | exact / évalués (`null` = `null` compte comme exact) |
| Erreur sur lisible | faux / évalués où la vérité donne une valeur |
| **Taux d'invention** | valeur donnée là où la vérité dit absent ou illisible (`null`) / évalués à `null` ; « dont sur illisible » = vérité marquée `unreadable` |
| Abstention justifiée (précision) | réponses `null` du modèle où la vérité est aussi `null` / toutes les réponses `null` |
| Abstention sur l'illisible (rappel) | `null` justifiés / vérités `null` (= 1 − taux d'invention) |
| Étiquette exacte / normalisée | texte identique (espaces réduits) / identique sans casse, accents ni ponctuation |
| Usage déduit | même usage et même pièce tirés de l'étiquette par l'assistant |

Reconstruction complète (§ 7), sur l'arbre obtenu :

| Indicateur | Définition |
|---|---|
| Protections : rappel / précision | comme la détection, sur les protections créées (disjoncteurs, différentiels, fusibles, interrupteurs) |
| Valeurs dans l'arbre | exactitude et taux d'invention par champ, après fusion (une valeur en désaccord n'est pas écrite : « manqué ») |
| **Différentiel → circuit** | raccordements exacts / raccordements évalués ; détail : faux (autre différentiel), manquant (vérité : sous un différentiel ; arbre : sous le tableau), **inventé** (vérité : sous le tableau ; arbre : sous un différentiel) |
| Sous-tableaux rattachés | exact / faux / absent (non rattaché, rien d'inventé) |
| **Score de structure** | (raccordements exacts + sous-tableaux bien rattachés) / (raccordements évalués + sous-tableaux) |
| Désaccords entre photos | faits où deux photos d'un même appareil donnent des valeurs différentes ; « bonne option proposée » = la vraie valeur figure parmi les options de la question ; « valeur malgré désaccord » doit rester 0 |
| Tableaux en double | nœuds « tableau » créés en plus de ceux du cas (point « sous-tableau » déduit d'une étiquette ET rattachement) |
| Questions par tableau | questions ouvertes après lecture de toutes les photos (charge pour l'utilisateur) |

**Répétabilité** (option `--repetitions N`) : chaque photo est relue N fois par le même modèle. Le rapport donne la
moyenne ± l'écart-type de l'exactitude du calibre et du taux d'invention entre répétitions, et la part des valeurs
(appareil × champ) lues à l'identique à chaque répétition.

## 9. Comparer plusieurs fournisseurs et modèles (mode matrice)

Une configuration JSON (`voltaplan-ai-eval-matrix/1`) liste les entrées à comparer. Exemple :
[tools/ai-eval/examples/matrice.exemple.json](../tools/ai-eval/examples/matrice.exemple.json).

| Champ d'une entrée | Sens |
|---|---|
| `id` | nom court (dossier des résultats) |
| `provider` | `anthropic` ou `openaiCompatible` (OpenAI, Gemini, Mistral… et modèles locaux) |
| `model` | identifiant du modèle chez le fournisseur |
| `baseUrl` | adresse de l'API compatible OpenAI ; `http://localhost…` = **modèle local, gratuit** |
| `keyEnv` | **nom** de la variable d'environnement qui contient la clé (jamais la clé : un champ `apiKey`, `token`… est refusé) |
| `priceInPerMTok`, `priceOutPerMTok` | prix par million de jetons, recopiés de la page de tarifs (`null` : inconnu → lecture réelle refusée) |
| `replayDir` | rejeu de lectures déjà faites (`<nom>.prediction.json`) : aucun appel |

Au niveau du fichier : `currency` (USD, EUR…), `repetitions` (1 à 20).

```sh
# 1. Plan seulement (défaut) : AUCUN appel. Affiche, par entrée, le nombre d'appels, les jetons estimés (taille des
#    images, longueur de la consigne) et le coût estimé et maximal (sortie au plafond de 16 000 jetons par appel).
npm run ai-eval:matrix -- --config ~/corpus-tableaux/matrice.json --dir ~/corpus-tableaux --repetitions 3

# 2. Lancement réel, APRÈS accord du propriétaire sur le plan affiché : les deux drapeaux, et un plafond de dépense
export ANTHROPIC_API_KEY=…
npm run ai-eval:matrix -- --config ~/corpus-tableaux/matrice.json --dir ~/corpus-tableaux --repetitions 3 \
  --live --i-authorize-costs --max-cost 5

# 3. Modèles locaux seulement (gratuits) : les deux drapeaux restent exigés, ni clé ni plafond
npm run ai-eval:matrix -- --config ~/corpus-tableaux/matrice.json --dir ~/corpus-tableaux --only ollama-local \
  --live --i-authorize-costs

# 4. Recalculer le rapport d'un lancement (après correction d'une vérité terrain) : aucun appel
npm run ai-eval:matrix -- --config ~/corpus-tableaux/matrice.json --dir ~/corpus-tableaux \
  --rescore tools/ai-eval/resultats/2026-12-01T10-00-00

# Démonstration sur l'installation synthétique (rejeu de lectures simulées, aucun appel, ne mesure rien)
npm run ai-eval:matrix -- --config tools/ai-eval/examples/matrice.exemple.json \
  --dir tools/ai-eval/examples/installation --only demo-simulee --out /tmp/demo-matrice
```

Règles de sécurité appliquées **avant le premier appel** (toutes les raisons de refus sont listées d'un coup, code de
sortie 3) : `--live` sans `--i-authorize-costs` ; entrée payante sans prix, sans clé dans sa variable, ou sans
`--max-cost` ; coût estimé supérieur au plafond. Pendant le lancement, les appels sont **séquentiels** et le banc
s'arrête dès que la dépense atteint le plafond (le dernier appel peut le dépasser d'au plus un appel : voir le coût
maximal par appel dans le plan). Une erreur du fournisseur est notée et la suite continue.

Options : `--only <id,id>`, `--limit <n>`, `--repetitions <n>`, `--previous <results.json>` (jetons **mesurés** lors
d'un lancement précédent, pour une meilleure estimation), `--out <dossier>`.

Résultats (par défaut `tools/ai-eval/resultats/<date>/`, ignoré par git, jamais envoyés) : `results.json` (plan,
durées, jetons, coûts, erreurs ; aucune clé), les lectures `<entrée>/rep<n>/<photo>.prediction.json`,
`comparaison.md` et un rapport détaillé par entrée (`rapport-<entrée>.md`, format du § 5).

`comparaison.md` contient, par entrée : qualité de lecture (rappel, précision, exactitude par champ), **informations
inventées et abstention** (avec intervalles de confiance), **durée p50 / p95, jetons moyens, coût par photo et pour
100 tableaux** (coût moyen par photo × photos par tableau du corpus × 100), reconstruction complète (§ 7–8),
répétabilité, et les seuils de la bêta (§ 11).

## 10. Prudence statistique

- Chaque proportion est donnée avec son **intervalle de confiance à 95 % (Wilson)** et son dénominateur `n`. Sur un
  petit corpus, **lire la borne haute** : 0 valeur inventée sur 50 laisse un vrai taux possible jusqu'à environ 7 %.
- Pour montrer qu'un taux est sous 2 % avec une borne haute sous 2 %, il faut environ 190 cas sans erreur : avec 30
  tableaux, le banc dit seulement « pas d'erreur grave observée », pas « sûr ».
- Le dénominateur du taux d'invention est le nombre de valeurs **absentes ou illisibles** de la vérité : il est petit
  sur des photos nettes. D'où les strates « mauvaise lumière » et « partielles » (§ 1.1), et l'intérêt de masquer
  certaines étiquettes de noms (elles deviennent des cas « illisible » utiles).
- Les appareils d'un même tableau ne sont pas indépendants (même éclairage, même écriture) : un intervalle calculé par
  appareil est **optimiste**. Regarder aussi le résultat par photo (rapport détaillé) : une erreur concentrée sur un
  seul tableau n'a pas le même sens qu'une erreur répartie.
- Comparer deux modèles **sur les mêmes photos** ; un écart de quelques points n'est pas significatif si les
  intervalles se recouvrent largement. Avec la répétition (`--repetitions 3`), un écart plus petit que l'écart-type
  entre répétitions n'est pas un écart.
- Ne pas ajuster la consigne en regardant les mêmes photos qui servent à la mesure : garder un tiers du corpus de
  côté pour la vérification finale.

## 11. Seuils proposés pour la bêta

À valider par le porteur du projet. Le rapport indique pour chaque entrée « atteint », « non atteint » ou
« échantillon insuffisant » (dénominateur sous le minimum indiqué). **Quels que soient les résultats, chaque valeur
lue reste affichée « proposition, à valider »** dans l'application : aucun seuil ne rend une lecture certaine, et
l'assistant ne remplace pas la vérification sur place.

| Indicateur | Seuil proposé | n minimal |
|---|---|---:|
| Calibre inventé (sur illisible ou absent) | < 2 % | 30 |
| Sensibilité inventée | < 2 % | 20 |
| Valeur inventée, tous champs | < 5 % | 50 |
| Calibre faux (lisible mais mal lu) | < 5 % | 100 |
| Appareils inventés (lus en trop) | < 3 % | 100 |
| Appareils détectés (rappel) | ≥ 90 % | 100 |
| Type exact (disjoncteur, différentiel…) | ≥ 90 % | 100 |
| Structure : différentiel → circuit exact (brouillon accepté tel quel) | ≥ 80 % | 30 |
| Valeur inventée dans l'arbre reconstruit | < 2 % | 30 |

Un seuil non atteint sur les valeurs inventées bloque la bêta pour ce modèle (renforcer la consigne, relever le seuil
de confiance, ou ne pas proposer ce champ) ; un seuil non atteint sur le rappel ou les questions se traite par
l'ergonomie (plus de questions, saisie manuelle).
