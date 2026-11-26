# Assistant de démarrage : collecte des documents, première analyse, questions

Statut : **proposition** (26/11/2026, révisée après le retour du même jour), à valider. S'appuie sur le dossier
de preuves existant (`src/assist/evidence.ts`, [SPEC-ASSISTANT-MODELE.md](SPEC-ASSISTANT-MODELE.md)) : sources,
observations, propositions, questions. Rien n'est appliqué à l'arbre sans l'accord de l'utilisateur.

## 1. Parcours

1. **Type** : nouvelle installation ou installation existante (déjà dans l'assistant de la branche `nuit`).
2. **Déposer les documents (facultatif)** : une seule zone « glisser ou choisir » qui accepte tout :
   photos (compteur, tableaux, appareils), plans (PDF, image, DXF), fichiers d'autres logiciels (Trikker…).
   Chaque fichier devient une **source** ; l'utilisateur peut corriger le type deviné d'un clic.
3. **Analyse — une seule étape, transparente** : un seul bouton / une seule barre de progression. L'application
   lit d'abord tout ce qu'elle peut sans IA, puis, **si l'IA est configurée**, complète automatiquement ce qui
   reste illisible ou incertain, dans la même étape. L'utilisateur ne choisit pas « avec ou sans IA » ; il voit
   seulement, sur chaque information, sa provenance (fichier, lecture automatique, IA, vous).
4. **Brouillon** : l'arbre est construit à partir des observations (unifilaire, tableau, plan en découlent).
5. **Questions** : seulement celles dont la réponse n'est pas déjà connue avec certitude (§ 4).

## 2. Ce que l'application peut lire sans IA

| Document | Lecture sans IA | Certitude |
| --- | --- | --- |
| Fichier Trikker | Tout l'arbre (import existant) | Certaine (fichier structuré) |
| Fichier Eendraadschema | Export seulement aujourd'hui ; import à écrire (format déjà connu par l'export) | Certaine |
| DXF | Traits (fait). **Murs** : calques nommés (MUR, WALL, MUUR…) ou paires de lignes parallèles proches. **Ouvertures** : blocs nommés (PORTE, DOOR, DEUR, FENETRE…) ou arcs d'un quart de tour. **Symboles électriques** : blocs (INSERT) dont le nom ou le dessin correspond à une bibliothèque connue. **Pièces** : textes TEXT/MTEXT | Bonne si le dessinateur a utilisé des calques et des blocs (cas courant en DAO) ; faible sinon |
| PDF de plan **vectoriel** | Texte (pièces, surfaces, échelle « 1/50 ») via pdf.js. Traits via la liste des opérations de dessin de pdf.js : **murs** (traits épais ou paires parallèles, hachures), **portes** (arcs d'un quart de tour à côté d'une interruption de mur). **Symboles** : comparaison des formes dessinées avec les symboles du tableau 2.23 (cercle barré, cercle avec croix…) | Moyenne : aucune structure (ni calques ni blocs), tout est déduit des formes ; à confirmer |
| PDF scanné / photo de plan | Murs et portes (`src/plan/trace.ts`, existant) ; pas de symboles | Partielle |
| PDF d'un autre logiciel (unifilaire exporté) | Texte : repères de circuits, calibres, sections, si le PDF est vectoriel | Moyenne |
| Photo de tableau | Rangées et séparations entre appareils (existant), donc nombre et largeur des modules ; texte imprimé par OCR (C16, C20, 30 mA…) | Moyenne |
| Photo du compteur | **OCR local** (§ 3) : plaque signalétique (3 × 230/400 V, 10(60) A, nombre de phases), numéro du compteur | Moyenne ; à confirmer d'un clic |

Avec l'IA configurée, dans la même étape : ce que l'OCR ou les formes n'ont pas pu lire, l'interprétation des
libellés (« PRISES CUIS. » → prises, cuisine), les symboles d'un plan scanné.

## 3. OCR local pour le compteur (et les étiquettes)

- Moteur : **Tesseract** compilé pour le navigateur (tesseract.js, licence Apache 2.0, compatible AGPL), exécuté
  sur l'appareil, sans serveur ni envoi de données. Les fichiers de langue (≈ 2 à 4 Mo en version « fast »)
  seraient **livrés avec l'application** (aucun téléchargement depuis un service tiers ; fonctionne hors ligne).
- Lecture ciblée : recherche de motifs connus dans le texte reconnu (`3 x 230`, `400 V`, `10(60) A`, `50 Hz`,
  `C16`, `30 mA`), jamais de valeur inventée : un motif non trouvé reste une question.
- Limites : écrans LCD des compteurs numériques, reflets, photos floues → lecture souvent incomplète.
- À évaluer sur de vraies photos de compteurs avant de décider (poids ajouté à l'application : quelques Mo).

## 4. Règle « ne pas poser une question dont on connaît la réponse »

Chaque question porte sur une **clé** (ex. `meta.supply`, `circuit:C3.section`). Elle n'est pas posée si une
observation de méthode `import` (ou confirmée par l'utilisateur) donne déjà la valeur, et qu'**aucune autre
source ne la contredit**. Une lecture automatique sûre vaut confirmation pour les données non critiques ; pour
les données de sécurité (alimentation, différentiels, sections), elle est **présentée pour confirmation groupée**
(« Nous avons lu : 3N × 400 V — correct ? »). Une lecture de l'IA n'est jamais considérée comme certaine
(spec, règle A3).

Ordre des questions : alimentation et schéma de liaison à la terre → tableau(x) et différentiels → circuits →
pièces → détails.

## 5. Étapes de réalisation proposées

| Étape | Contenu | Taille |
| --- | --- | --- |
| C1 | Zone de dépôt unique + type deviné + analyse en une étape (sans IA puis IA si configurée) | Moyenne |
| C2 | Texte des PDF et DXF → pièces et surfaces | Moyenne |
| C3 | Moteur de questions avec la règle du § 4 | Moyenne |
| C4 | DXF : murs, ouvertures, blocs de symboles | Moyenne |
| C5 | PDF vectoriel : murs, portes, symboles par comparaison de formes | Grande |
| C6 | OCR local (compteur, étiquettes du tableau), après essai sur de vraies photos | Moyenne |
| C7 | Import Eendraadschema | Moyenne |

## 6. Tableau : rangement habituel (fait, branche `tableau-rangement`)

Pratique des installateurs : une rangée par différentiel 30 mA suivi de ses disjoncteurs, réserve en fin de
rangée ; une rangée principale (en haut ou en bas, propriété du tableau) avec le général et ce qui n'est pas sous
30 mA ; un 30 mA triphasé s'y ajoute s'il reste la place.
Code : `conventionalLayout` dans `src/board/model.ts`, tests `test/boardConventional.test.ts`.

**RGIE vérifié** (Livre 1, 2026, sous-section 4.2.4.3 b, p. 101 imprimée / PDF 113) :

- 5e alinéa : immédiatement en aval du différentiel d'origine, au moins un différentiel à haute ou très haute
  sensibilité (≤ 30 mA) protège au moins les prises non destinées à des appareils fixes, l'éclairage, les locaux
  avec baignoire ou douche, les lave-linge, sèche-linge et lave-vaisselle ;
- 6e alinéa : **au maximum 8 circuits terminaux par différentiel 30 mA** ;
- les appareils fixes (froid, cuisinière, chauffage) et les autres circuits peuvent rester directement sous le
  différentiel d'origine ;
- dérogation (partie 6, p. 207 imprimée / PDF 219) : pour une installation dont l'exécution sur place a commencé
  **avant le 01/06/2023**, les prises et l'éclairage peuvent ne pas être sous 30 mA et plus de 8 circuits par
  30 mA restent admis.

**Écart constaté dans Voltaplan** : le contrôle n'exige aujourd'hui le 30 mA que pour les locaux humides et les
appareils de lavage, et ne compte pas les circuits par 30 mA. Le projet vide par défaut et la « maison type »
mettent prises et éclairage sous le 300 mA seul. À corriger (règles, matrice de tests, modèle).

## 7. IA locale

Utile en option (Ollama sur l'ordinateur, sans coût ni envoi de données), pas pour tester le code déterministe,
qui se teste mieux par des tests classiques et des cas réels anonymisés.
