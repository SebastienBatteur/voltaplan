# Assistant de démarrage : collecte des documents, première analyse, questions

Statut : **proposition** (26/11/2026), à valider. S'appuie sur le dossier de preuves existant
(`src/assist/evidence.ts`, [SPEC-ASSISTANT-MODELE.md](SPEC-ASSISTANT-MODELE.md)) : sources, observations,
propositions, questions. Rien n'est appliqué à l'arbre sans l'accord de l'utilisateur.

## 1. Parcours

1. **Type** : nouvelle installation ou installation existante (déjà dans l'assistant de la branche `nuit`).
2. **Déposer les documents (facultatif)** : une seule zone « glisser ou choisir » qui accepte tout :
   photos (compteur, tableaux, appareils), plans (PDF, image, DXF), fichiers d'autres logiciels (Trikker…).
   Chaque fichier devient une **source** ; l'utilisateur peut corriger le type deviné d'un clic.
3. **Première analyse** (sans IA, puis avec l'IA si elle est configurée) : chaque source produit des
   **observations** avec leur méthode (`import`, `deterministic`, `ai`) et leur certitude.
4. **Brouillon** : l'arbre est construit à partir des observations (unifilaire, tableau, plan en découlent).
5. **Ce qui manque ou est ambigu** : liste de **questions**, triées par importance.
6. **Questions** : seulement celles dont la réponse n'est pas déjà connue avec certitude.

## 2. Ce que l'application peut lire sans IA

| Document | Lecture sans IA | Certitude |
| --- | --- | --- |
| Fichier Trikker | Tout l'arbre (import existant) | Certaine (fichier structuré) |
| Fichier Eendraadschema | Export seulement aujourd'hui ; import à écrire (format déjà connu par l'export) | Certaine |
| PDF de plan **vectoriel** | Texte : noms de pièces, surfaces (« Cuisine 12,5 m² »), échelle (« 1/50 »), étages (pdf.js `getTextContent`, déjà dans le projet) | Bonne pour le texte ; aucune lecture des symboles |
| PDF scanné / photo de plan | Fond de plan, murs et portes (`src/plan/trace.ts`) | Partielle |
| DXF | Traits (fait) ; textes TEXT/MTEXT (pièces) à ajouter | Bonne pour le texte |
| PDF d'un autre logiciel (unifilaire exporté) | Texte : repères de circuits, calibres, sections, si le PDF est vectoriel | Moyenne (à confirmer) |
| Photo de tableau | Rangées et séparations entre appareils (existant), donc nombre et largeur des modules | Moyenne ; calibres illisibles sans IA |
| Photo du compteur | Rien de fiable (pas d'OCR) ; nom du fichier ou date de la photo seulement | Nulle : **2 questions avec images** (mono/tri, 230/400 V) |

Avec l'IA configurée : lecture du compteur, des étiquettes et des calibres sur les photos, interprétation des
libellés (« PRISES CUIS. » → prises, cuisine), comme prévu dans la spec (§ 8).

## 3. Règle « ne pas poser une question dont on connaît la réponse »

Chaque question porte sur une **clé** (ex. `meta.supply`, `circuit:C3.section`). Elle n'est pas posée si une
observation de méthode `import` (ou confirmée par l'utilisateur) donne déjà la valeur, et qu'**aucune autre
source ne la contredit**. Une lecture `deterministic` de certitude haute vaut confirmation pour les données non
critiques ; pour les données de sécurité (alimentation, différentiels, sections), elle est **présentée pour
confirmation groupée** (« Nous avons lu : 3N × 400 V — correct ? ») plutôt que posée comme une question ouverte.
Une lecture `ai` n'est jamais considérée comme certaine (spec, règle A3).

Ordre des questions : alimentation et schéma de liaison à la terre → tableau(x) et différentiels → circuits →
pièces → détails (marques, hauteurs).

## 4. Étapes de réalisation proposées

| Étape | Contenu | Taille |
| --- | --- | --- |
| C1 | Zone de dépôt unique dans l'assistant + type deviné (extension, nom, contenu) | Moyenne |
| C2 | Texte des PDF et DXF → pièces et surfaces → proposition de pièces sur le plan | Moyenne |
| C3 | Moteur de questions avec la règle du § 3, branché sur le dossier de preuves | Moyenne |
| C4 | Questions illustrées pour le compteur (sans IA) | Petite |
| C5 | Import Eendraadschema | Moyenne |
| C6 | Lecture IA du compteur et des PDF d'autres logiciels (si IA configurée) | Moyenne |

## 5. Tableau : rangement habituel (fait, branche `tableau-rangement`)

Pratique des installateurs, pas une exigence du RGIE : une rangée par différentiel 30 mA suivi de ses
disjoncteurs, réserve en fin de rangée ; une rangée principale (en haut ou en bas, propriété du tableau) avec le
général et ce qui n'est pas sous 30 mA ; un 30 mA triphasé s'y ajoute s'il reste la place.
Code : `conventionalLayout` dans `src/board/model.ts`, tests `test/boardConventional.test.ts`.

## 6. IA locale

Voir la réponse du 26/11 : utile en option (Ollama sur l'ordinateur, sans coût ni envoi de données), pas pour
tester le code déterministe, qui se teste mieux par des tests classiques et des cas réels anonymisés.
