# Évaluer la lecture des photos de tableaux par l'IA

Statut : outil prêt, **aucune mesure réelle faite à ce jour**. Date : 2026-11-24.

## 0. À lire d'abord

- **Les tests automatiques de l'assistant utilisent des lectures simulées** (écrites à la main). Ils vérifient la
  logique déterministe : fusion des photos, contradictions, doublons, questions, fidélité de la reconstruction. **Ils
  ne disent rien de la qualité réelle de la reconnaissance** (lire un calibre, une courbe, une étiquette sur une vraie
  photo).
- Seul ce banc, lancé **par le propriétaire du projet, avec sa clé ou son modèle local**, sur des **photos réelles**
  avec une **vérité terrain vérifiée sur place**, mesure cette qualité.
- Le banc n'est jamais lancé en intégration continue, et aucune photo réelle n'est versée dans le dépôt.

## 1. Constituer un corpus sans données personnelles

Une photo de tableau peut contenir des données personnelles : noms sur les étiquettes (« Chambre Lucas »), adresse
sur un autocollant, visage ou intérieur du logement autour du tableau.

1. **Sources acceptables** :
   - ton propre tableau ;
   - des tableaux d'essai (atelier, formation, maquette) ;
   - un tableau de client **seulement avec son accord écrit**, et après anonymisation.
2. **Anonymiser avant tout usage** :
   - recadrer sur le tableau (rien autour) ;
   - flouter ou masquer les étiquettes portant un nom de personne, l'adresse, un numéro de téléphone ou un code EAN ;
   - garder les étiquettes d'usage (« Prises cuisine », « LL », « Ecl. ch.1 ») : ce sont elles qu'on veut mesurer ;
   - retirer les métadonnées EXIF (position GPS) : une réexportation en JPEG depuis un éditeur d'images suffit en
     général ; à vérifier.
3. **Ranger le corpus hors du dépôt** : un dossier personnel, ou `tools/ai-eval/corpus/` (ignoré par git). Ne jamais
   le mettre dans `test/fixtures/` (fichiers de clients, ignorés aussi, mais réservés à d'autres usages).
4. **Varier** : marques (Hager, Schneider, Legrand, ABB, Siemens…), anciens et récents, 1 à 4 rangées, étiquettes
   manuscrites et imprimées, FR et NL, photos nettes et moins nettes, éclairage différent.
5. **Taille utile** : une dizaine de tableaux donne une première idée ; une trentaine permet de comparer deux
   modèles ; plus de 100 pour une mesure stable (voir [ASSISTANT.md](strategie/ASSISTANT.md) § 7).

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
| `notes` | libre (origine, date de vérification) — **jamais de nom ni d'adresse** |
| `devices` | un objet par appareil, caches compris (`"kind": "blank"`, ignorés au score) |

Par appareil : `row` (0 = la plus haute), `startModule` (0 = premier module de la rangée), `widthModules`, `kind`
(`mcb`, `rcd`, `rcbo`, `fuse`, `switch`, `spd`, `contactor`, `teleswitch`, `timer`, `transformer`, `meter`,
`domotic`, `other`, `blank`), `ratedCurrentA`, `curve`, `residualCurrentmA`, `rcdType`, `label` (texte exact de
l'étiquette), `circuitRef` (repère, ex. « H »).

**Règle importante** : un champ **absent** n'est pas évalué ; un champ à **`null`** veut dire « réellement absent ou
illisible sur l'appareil ». Si le modèle donne quand même une valeur, elle est comptée comme **inventée** : c'est
l'erreur la plus grave pour un relevé, car elle passerait pour une observation.

## 4. Lancer

Le banc appelle **exactement** la même fonction que l'application (`readBoardPhoto` de `src/ai/boardPhotoAi.ts` :
même consigne, même schéma, même validation), depuis Node.

```sh
# Anthropic : la clé est lue dans une variable d'environnement, jamais passée en argument
export ANTHROPIC_API_KEY=…            # PowerShell : $env:ANTHROPIC_API_KEY = '…'
npm run ai-eval -- --dir ~/corpus-tableaux --live --provider anthropic --model <modèle> \
  --save-predictions ~/corpus-tableaux/lectures --price-in <prix entrée> --price-out <prix sortie>

# Modèle local (Ollama, LM Studio) : aucune clé, rien ne sort de la machine
npm run ai-eval -- --dir ~/corpus-tableaux --live --provider openaiCompatible \
  --base-url http://localhost:11434/v1 --model <modèle-vision>

# Réévaluer des lectures déjà faites (aucun appel)
npm run ai-eval -- --dir ~/corpus-tableaux --predictions ~/corpus-tableaux/lectures

# Démonstration avec les exemples synthétiques (aucun appel, aucune photo)
npm run ai-eval -- --dir tools/ai-eval/examples --predictions tools/ai-eval/examples --out /tmp/rapport.md
```

Sans `--live`, **aucune requête n'est faite**. Options : `--key-env <VARIABLE>`, `--out <rapport.md>` (par défaut
`<dir>/rapport-evaluation.md`), `--lang`, `--limit <n>`, `--currency`. Les prix (`--price-in`, `--price-out`) sont
par million de jetons, à recopier depuis la page de tarifs du fournisseur : ils changent souvent et ne sont pas
codés dans l'outil.

## 5. Rapport

Le rapport Markdown contient :

- **détection** : appareils de la vérité, lus, appariés (même rangée et même module, sinon recouvrement d'au moins la
  moitié), rappel, précision, non lus, en trop ;
- **exactitude par champ** : type, position, largeur, calibre, courbe, sensibilité, type de différentiel, étiquette
  (texte, sans casse ni ponctuation), **usage et pièce déduits de l'étiquette** (ce que l'assistant en tire réellement),
  repère du circuit ; pour chacun : exact, faux, **inventé**, manqué ;
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
