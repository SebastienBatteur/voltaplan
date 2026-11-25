# Audit visuel instrumenté — 2026-11-25

Vérification, sur l'application publiée (https://voltaplan.org/app/, `main` 3b4e675), des hypothèses d'un audit
UI/UX fait par lecture du code (ChatGPT, même jour). Navigateur intégré de Claude, tailles **émulées** ;
mesures par script dans la page (taille de texte, surfaces, cibles, focus). Aucun appareil réel : l'iPhone,
l'iPad et l'Android restent à faire (section 5).

Limite de l'émulation : à 768 px et plus, l'émulateur garde une souris (`pointer: coarse` faux) ; la barre
compacte tactile d'une vraie tablette n'est donc **pas** observée ici. Sous 768 px, le toucher est émulé.

## 1. Mesures

| Taille | Barre du haut | Dessin (colonne ouverte) | Autres mesures |
| --- | --- | --- | --- |
| 1366 × 768 | 42 px, **2 lignes** dès qu'un état long s'affiche (« Erreur d'enregistrement ») | 1026 × 703 (69 %) | Propriétés : **3 champs visibles sur 18** (zone de 160 px) |
| 1920 × 1080 | 42 px | 1580 × 1015 | Propriétés : 7 champs visibles sur 18 (269 px) ; grande zone de dessin vide à droite |
| 768 × 1024 (portrait) | 76 px (2 lignes) | 768 × 509 (**50 %**) | colonne au-dessus : 416 px, ≈ 3 lignes visibles par panneau |
| 1024 × 768 (paysage) | 76 px (2 lignes) | 684 × 669 (58 %) | |
| 375 × 812 | 101 px | 375 × 391 (48 %) ; **375 × 667 (82 %)** colonne repliée | 0 cible tactile < 44 px ; arborescence : **1 ligne** visible ; « Contrôle RGIE » hors écran (onglets défilants) |
| 390 × 844 | 101 px | idem | « Contrôle RGIE » hors écran |

Tailles de texte visibles (hors dessin) à 1366 px : 10 px ×11, 11 px ×9, 12 px ×12, 13 px ×36. Au téléphone,
les libellés de la palette d'éléments (Prise, Interrupteur, Détecteur…) sont en **10 px**.

## 2. Hypothèses de l'audit : verdict

| Hypothèse | Verdict | Constat |
| --- | --- | --- |
| Colonne latérale surchargée (arbre + propriétés + palette) | **Confirmé** | à 1366 × 768, 3 champs de propriétés sur 18 visibles ; il faut faire défiler une zone de 160 px |
| Textes petits (11–13 px) | **Confirmé**, plus marqué que dit | 10 px pour la palette, y compris au téléphone |
| Barre du haut chargée | **Confirmé** | passe sur 2 lignes à 1366 px dès qu'un état long s'affiche, et à 1024 px |
| Bouton « ＋ » de l'arbre peu visible | **Partiellement** | invisible (opacité 0) hors survol ou sélection, mais une aide permanente sous le dessin l'indique (« clic droit… ou ＋ dans l'arborescence ») et « ＋ Ajouter… » apparaît dans Propriétés ; l'ajout contextuel (Protection / Tableau / Barrette de terre) existe déjà |
| Tablette portrait : la colonne prend la moitié du dessin | **Confirmé** | dessin à 50 % de la hauteur |
| Panneau temporaire plutôt que partage d'écran | **Utile, en partie déjà là** | la colonne se replie (« ‹ ») et le dessin passe à 82 % au téléphone |
| Téléphone : propriétés en panneau inférieur | **Confirmé, c'est le défaut le plus gênant** | colonne repliée, toucher un élément le **sélectionne sans rien afficher** ; il faut rouvrir la colonne, qui reprend la moitié de l'écran et ne montre qu'une ligne d'arbre |
| Trop de vues au téléphone | **Confirmé en partie** | 6 onglets défilants ; « Contrôle RGIE » (avec son compteur d'alertes) est hors écran |
| Mode actif du plan peu visible | **Infirmé** | l'outil actif (« Sélection ») est en surbrillance ; le plan vide affiche une aide claire |
| Lignes de l'arbre en `div` sans clavier | **Confirmé** | ni rôle ni `tabindex` ; on ne peut pas sélectionner un élément au clavier |
| Dessin SVG inaccessible au clavier | **Confirmé** | aucun élément focalisable dans le SVG |
| Fenêtres : focus non géré | **Confirmé** | « Enregistrer le projet » : focus resté sur la page, pas d'`aria-modal`, **Échap ne ferme pas** |
| Onglets sans sémantique | **Confirmé** | ni `role="tab"` ni `aria-selected` (vues et onglets de la fenêtre d'enregistrement) ; menu Fichier : entrées sans rôle |
| Enregistrement trop riche au premier usage | **Confirmé** | 4 onglets ; c'est **« Navigateur »** qui est présélectionné (le stockage qui peut être effacé), pas « Cet appareil » |
| Indication des modifications non enregistrées | **Déjà fait** | « • » dans le titre, état d'enregistrement, avertissement à la fermeture (web et bureau) |

## 3. Constats non prévus par l'audit

- **Messages qui se chevauchent** (même famille que O6) : la récupération de brouillon, la nouvelle version et les
  erreurs s'empilent en bas à droite et masquent le bas du dessin ; au téléphone, le bandeau « Nouvelle version »
  recouvre le schéma.
- **Le schéma ne se recadre pas** après un ajout : à 1366 px, l'alimentation sort de l'écran et l'aide du bas
  chevauche le dessin (« Ajuster » existe, mais il faut y penser). Au téléphone, le schéma est petit au départ.
- Message système brut en anglais quand le sélecteur de fichier est refusé (« Failed to execute
  'showSaveFilePicker'… ») : observé sur un clic simulé par script, donc rare en usage réel, mais `errorText` devrait
  le traduire.

## 4. Priorités proposées

1. **Accessibilité (peu coûteux, sans risque)** : arborescence au clavier (rôle `tree`/`treeitem`, flèches,
   Entrée) ; fenêtres avec `aria-modal`, focus initial, focus gardé, Échap, retour du focus ; rôles des onglets et
   du menu Fichier.
2. **Lisibilité** : passer les 10–11 px à 12 px minimum et le texte courant à 14 px, en remesurant les panneaux.
3. **Téléphone : propriétés en panneau inférieur** à la sélection quand la colonne est repliée ; « Contrôle
   RGIE » toujours visible (ou compteur d'alertes dans la barre).
4. **Enregistrement** : présélectionner « Cet appareil » ; regrouper GitHub et les formats sous « Options
   avancées ».
5. **Messages** : une seule pile, au-dessus des boîtes de dialogue (O6), et qui ne cache pas le dessin.
6. Plus tard, après essais utilisateurs : disposition à trois colonnes au-delà de 1600 px ; navigation par tâches
   au téléphone.

## 5. Reste à vérifier sur appareils réels

iPad (portrait/paysage, doigt, stylet, clavier) : barre compacte tactile ; Android (Chrome et PWA installée) ;
iPhone en paysage ; apparition du clavier virtuel dans Propriétés ; rotation pendant l'édition.

## 6. Suite : accessibilité au clavier (même jour, branche `accessibilite`)

Corrigé (point 1 des priorités) :
- **Arborescence** : motif ARIA « tree » (`role="tree"`/`treeitem`, niveau, sélection, état déplié) ; un seul arrêt de
  tabulation ; flèches haut/bas (en sélectionnant, comme un clic), droite/gauche (déplier, premier enfant / replier,
  parent), Début, Fin ; **« + » ou Inser** ouvre le menu d'ajout ; contour de focus visible, le « ＋ » apparaît
  sur la ligne qui a le focus ; aide lue par les lecteurs d'écran.
- **Sept fenêtres** (enregistrement, versions, impression, IA, à propos, synchronisation, assistant) : `aria-modal`,
  focus placé dans la fenêtre, Tab et Maj+Tab gardés dedans, **Échap ferme**, focus rendu à l'élément d'origine
  (`src/ui/a11y.ts`).
- **Menus Fichier et Ajouter** : focus sur la première entrée, flèches (en boucle), Début, Fin ; Échap rend le focus
  au bouton ou à la ligne.
- **Onglets** : vues signalées par `aria-current="page"` dans une navigation nommée ; onglets de la fenêtre
  d'enregistrement et services en ligne avec `aria-pressed`.

Vérifié : 8 tests (`test/a11y.test.tsx`) et, dans un vrai navigateur (serveur local, 1366 × 768), au clavier seul :
arborescence aux flèches, Inser → menu → Échap, Fichier → Entrée → flèches → « Enregistrer sous… » → focus dans la
fenêtre, Tab, Échap → focus revenu sur « Fichier ». Non vérifié : lecteur d'écran réel (NVDA, VoiceOver).
Le dessin SVG reste non focalisable : la sélection au clavier passe par l'arborescence (synchronisée avec le dessin).

## 7. Suite : propriétés au téléphone (même jour, branche `panneau-telephone`)

Corrigé (point 3 des priorités) : colonne masquée (≤ 800 px), toucher un élément ouvre un **panneau sous le
dessin** (`src/ui/PropsSheet.tsx`), avec une contrainte de l'utilisateur : le dessin doit rester grand, pas saturé
par les menus.
- Le panneau est **dans le flux** (le dessin se réduit, rien n'est recouvert ; le schéma garde son cadre, l'élément
  sélectionné reste visible).
- **Replié par défaut** : une ligne (nom de l'élément, « Propriétés ▴ », ✕). Déplié à la demande, choix retenu.
- Déplié : plafonné à 35 % de l'écran et le dessin garde au moins 60 % de la zone sous la barre ; le panneau défile.
- ✕ désélectionne (le panneau disparaît). Sur grand écran, rien ne change.

Mesures (émulation, après correction) :

| Taille | Panneau replié | Panneau déplié |
| --- | --- | --- |
| 375 × 812 | ligne de 45 px ; dessin 622 px (77 %) | — |
| 390 × 844 | — | panneau 253 px (3 champs visibles sur 6, défilement) ; dessin 446 px (53 %) ; aucune page qui déborde |

Avant : colonne ouverte, dessin 391 px (48 %) avec une seule ligne d'arborescence et des propriétés quasi
invisibles ; colonne fermée, aucune propriété.

Reste : vue **Tableau** au téléphone encore chargée (réglages du tableau + message bleu « en réserve » + panneau) —
les réglages se replient, mais le message bleu recouvre le dessin (même famille que O6) ; « Contrôle RGIE » hors
écran dans les onglets ; téléphone en paysage (> 800 px de large) non traité. Non vérifié sur téléphone réel.

## 8. Suite : points 1 à 7 (même jour, branche `ux-suite`)

1. **Lisibilité** : texte courant 13 → 14 px ; plus aucun texte sous 12 px (palette, badges, raccourcis, pied de
   page). Mesuré à 1366 × 768 : tailles visibles 12, 13, 14 et 16 px seulement.
2. **Avis** (`src/ui/Notice.tsx`) : brouillon retrouvé, nouvelle version, reprise, conflit, fin d'import… dans une
   seule bande sous le dessin (au-dessus du pied de page). Ils ne se recouvrent plus entre eux, ne cachent plus le
   dessin (il se réduit : 701 → 658 px avec un avis à 1366 × 768) ni une fenêtre (écart **O6**). Vue Tableau : l'aide
   permanente « appareil(s) en réserve » devient une ligne discrète au-dessus du dessin. Message système brut du
   navigateur (« Failed to execute 'showSaveFilePicker'… ») remplacé par une consigne traduite. « Nouvelle version
   disponible » sur une seule rangée, avec des pictogrammes ⟳ (recharger) et ✕ (plus tard) au lieu des mots (idée de
   l'utilisateur ; mot en infobulle et lu par les lecteurs d'écran) : 58 px de haut à 375 px, boutons de 44 px.
3. **Enregistrement** : « Cet appareil » présélectionné ; « Drive, OneDrive, Dropbox » à côté ; « Navigateur » et
   « GitHub » sous « Autres emplacements ▸ ».
4. **Contrôle RGIE au téléphone** (avec l'idée de l'utilisateur) : sur la barre compacte, l'onglet n'affiche que la
   pastille du nombre d'alertes (« RGIE » s'il n'y en a pas ; nom complet lu par les lecteurs d'écran) et reste collé
   au bord droit si les onglets défilent. Onglets resserrés : les six tiennent sur une ligne à 375 et 390 px (cibles
   de 44 px) ; à 360 px ils défilent, le compteur reste visible.
5. **Barre du haut** : sur une ligne dès 1200 px ; nom du projet et état d'enregistrement raccourcis (…) au lieu de
   passer à la ligne. Mesuré : 44 px à 1366 × 768 avec « Erreur d'enregistrement ».
6. **Recadrage** : en vue d'ensemble (après « Ajuster », sans zoom ni déplacement depuis), le dessin le reste quand il
   grandit (ajout) ou que sa zone change de taille (panneau, rotation, colonne). Vérifié : après l'ajout d'une
   protection à 1366 × 768, tout le schéma reste visible (l'alimentation sortait du champ). Une vue zoomée n'est
   jamais touchée. Au téléphone, le schéma remplit la largeur : sa petite taille vient de la place réservée aux
   libellés, pas du cadrage.
7. **O8** : après un export (v1, Trikker, Eendraadschema), la fenêtre confirme « Fichier « … » créé. » ; rien si
   l'enregistrement est annulé (bureau).

Vérifié : 782 tests (dont `test/uxSuite.test.tsx`), typage, lint, compilation ; mesures en émulation à 1366 × 768,
375 × 812, 390 × 844, 360 × 780. Non vérifié sur appareils réels ni dans l'application de bureau installée (O8).

### Ajouts de l'utilisateur (même jour)

- **Disquette** au lieu du mot « Enregistrer » sur la barre compacte (téléphone, tablette au doigt) : icône dessinée
  (SVG, suit le thème et le bleu « modifications à enregistrer »), mot en infobulle et lu ; bouton 44 × 44 px. Le nom
  du projet passe d'environ 112 à 158 px à 375 px de large. « Fichier » garde son mot (menu d'actions variées).
- Pictogrammes à la place des mots d'onglets et bandeau d'onglets coulissant : **abandonnés** par l'utilisateur
  (onglets réglés par le compteur RGIE et le resserrement).

### Vue Tableau avec photo de fond, au téléphone (375 × 812, constat)

Après « Photo du tableau… », les réglages s'allongent (Caler la photo, rangées, Disposer d'après la photo, Comparer,
Fond, Retirer) : **301 px, 45 % de la zone**, le dessin garde 322 px. Le calage démarre aussitôt et sa consigne
s'affiche en bulle en bas du dessin. Surtout, la **photo n'occupe que 123 × 96 px** (le cadrage montre tout le
tableau et la réserve) : trop petit pour viser au doigt le bord d'un module sans zoomer à deux doigts.

Corrigé (même jour, branche `ux-suite`), mesuré à 375 × 812 :
- **Calage** : les réglages se replient en une ligne (étape en cours + « Annuler », qui rend le calage précédent),
  seul le choix des rangées reste ; la consigne n'est plus une bulle sur le dessin. La vue **cadre la photo** :
  350 × 273 px au lieu de 123 × 96 ; la vue d'ensemble revient à la fin du calage. Dessin 546 px pendant le calage.
- **Menu « Photo ▾ »** sur la barre compacte : changer de photo, caler, disposer, comparer, fond, retirer. Réglages
  avec photo : **105 px au lieu de 301** ; dessin 518 px au lieu de 322. Grand écran inchangé (actions dans la barre).
- Régression corrigée au passage : sur grand écran, l'aide « appareil(s) en réserve » passait sous la barre de
  réglages flottante ; elle est maintenant au coin bas gauche du dessin.
Vérifié avec une photo de test générée et les 4 clics de calage ; non vérifié sur téléphone réel ni avec une vraie
photo de tableau.
