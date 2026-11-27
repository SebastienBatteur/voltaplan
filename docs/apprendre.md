# Section « Apprendre l'électricité » du site

Cours gratuits sur l'électricité de la maison (en français pour l'instant), publiés sous
`https://voltaplan.org/apprendre/` : 8 rubriques, de la tension et du courant jusqu'à la domotique, un lexique, et un
exercice de câblage interactif pour chaque montage, avec le schéma unifilaire dessiné par le moteur de Voltaplan.

## Où se trouve quoi

| Chemin | Rôle |
|---|---|
| `learn/fr/plan.json` | Plan : articles (slug, rubrique, ordre, exercice), mots du lexique, références RGIE vérifiées |
| `learn/fr/rubriques.json` | Titres et introductions des rubriques |
| `learn/fr/<slug>.html` | Un article : en-tête JSON (titre, description, « À retenir », FAQ, sources…) puis le corps HTML |
| `learn/fr/lexique.json` | Lexique : `id`, mot, définition, articles où il est expliqué |
| `tools/learn/exercices/<id>.ts` | Un exercice : appareils, cas attendus, une solution, et le même circuit pour l'unifilaire |
| `tools/learn/build.tsx` | Générateur des pages (`npm run learn:build`) |
| `tools/learn/validate.ts`, `check.ts` | Vérifications (`npm run learn:check -- [slug…]`) |
| `site/apprendre/*.html` | Pages produites, versionnées (ne pas les modifier à la main) |
| `site/apprendre/cablage-sim.js` | Simulateur de câblage (fonction pure, testée) |
| `site/apprendre/cablage.js`, `lexique.js` | Interface des exercices et filtre du lexique |

## Ajouter ou modifier un article

1. Ajouter l'article dans `learn/fr/plan.json` (et son exercice, s'il y en a un).
2. Écrire `learn/fr/<slug>.html` sur le modèle de `simple-allumage.html`.
3. `npm run learn:check -- <slug>` jusqu'à `OK`, puis `npm run learn:build`.
4. `npm test` : `test/learn.test.ts` vérifie que tout est complet et que les pages produites sont à jour ;
   `test/site.test.ts` vérifie titres, descriptions, H1, canonical, liens et ancres.

## Règles de contenu

- **Exactitude avant tout.** Un numéro d'article du RGIE n'est cité que s'il a été vérifié dans le texte officiel et
  ajouté à `rgieRefs` dans `plan.json` ; le validateur refuse les autres. Les valeurs belges (sections, calibres,
  différentiels, terre) doivent rester cohérentes avec les règles de l'application (`src/rules/be/rgie.ts`).
- Les pages expliquent les principes ; chaque page rappelle qu'elles ne remplacent ni le RGIE ni un électricien, et
  qu'une installation neuve ou modifiée se fait contrôler par un organisme agréé.
- Pas de note, d'avis ni de statistique inventés ; liens externes seulement vers des pages existantes.

## Exercices de câblage

On relie des bornes par des fils de couleur (deux touchers : marche au doigt), on manœuvre les commandes (la lampe
s'allume, le volet monte), puis « Vérifier ». La vérification **simule** le circuit au lieu de comparer à une solution
unique : tout câblage juste est accepté. Elle signale court-circuit, défaut à la terre, neutre relié à la terre, moteur
alimenté dans les deux sens, interrupteur sur le neutre, terre manquante et couleurs (vert-jaune réservé à la terre,
bleu au neutre). Attendus possibles : `cases` (positions → état), `toggle` (chaque commande inverse la lampe : va-et-vient,
inverseurs) ou `sequence` (appuis successifs : télérupteur). Appareils disponibles : voir `site/apprendre/cablage-sim.js`
et `tools/learn/types.ts`.

## Traductions

La section n'existe qu'en français pour l'instant : pas de `hreflang` sur ces pages, et le menu des langues renvoie
vers l'accueil de chaque langue. Une traduction se ferait avec un dossier `learn/<langue>/` et le même générateur.
