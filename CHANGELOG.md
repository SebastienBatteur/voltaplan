# Journal des modifications

## Non publié (audit de fiabilisation, novembre 2026)

### Règles du 1/3/2025 et liste des circuits (2026-11-26)

- Contrôle RGIE selon la date de début des travaux, comme pour le 1/6/2023 : depuis le **1/3/2025**, prises de 16 A
  au plus avec protection IPXX-D (obturateurs), sauf prise réservée à un appareil précis (RGIE 5.3.5.2 a). Les
  règles de salle de bain de 2025 (volumes) suivront avec le dessin des volumes sur le plan.
- **Bouton « corriger »** sur les remarques du contrôle quand la correction est évidente : calibre maximal pour la
  section (« Choisir 20 A »), section minimale, prise avec obturateurs ou avec terre, disjoncteur bipolaire sur un
  réseau 3 × 230 V, différentiel type A, circuit rangé sous un 30 mA du tableau qui a de la place (ou nouveau 30 mA).
  Annulable comme toute modification. Les mentions manquantes du dossier mènent à l'onglet Projet.
- Lien « Demander une simulation photovoltaïque » vers le formulaire de SBG Energy (https://sbg-energy.com/sim/new/) ;
  le préremplissage depuis Voltaplan est annoncé « bientôt ».
- Palette « Éléments » : **recherche de pictogrammes** dans toutes les langues de l'application et ses variantes
  (« lave-linge », « stopcontact », « Steckdose », « colimaçon ») ; plus de doublon des outils Mur, Porte, Fenêtre,
  Texte (ils restent dans la barre du plan) ; le mobilier y a le même catalogue que le menu « Mobilier ».
- **Liste des circuits en CSV** (onglet Matériel) : lettre, nom, protection, différentiel, câble, nombre de points
  et pièces, pour un tableur ou un devis ; même liste que dans le dossier PDF.

### Import Volter (2026-11-26)

- Fichier → « Importer Volter (.vschema)… » : tableau (différentiel général, différentiels imbriqués, disjoncteurs
  et câbles), points groupés par liaison de commande, étages, murs, portes, fenêtres, mobilier, escaliers,
  surfaces extérieures, EAN et réseau. Ce que Volter n'enregistre pas (compteur, terre) est signalé.
- Repères des circuits repris de Volter (A, B, C…, « E-A » dans un sous-tableau), sous-tableaux sous leur disjoncteur,
  liaisons entre étages, portes de garage et coulissantes.
- Nouvel élément **Batterie** (stockage) : symbole d'accumulateur, capacité (kWh) et puissance ; mobilier
  **escalier en colimaçon** ; symbole du congélateur carré (trois étoiles).
- Le logo « Voltaplan » ramène à « Mes projets ». Un fichier importé n'apparaît plus dans « Projets récents » avant
  d'avoir été enregistré.

### Lecture locale des photos (OCR, sans IA) (2026-11-26)

- **Moteur OCR local** (Tesseract 5 en WebAssembly, tesseract.js 7.0.0 ; langues française, néerlandaise et anglaise)
  livré avec Voltaplan : aucune image envoyée, aucun service tiers, fonctionne hors ligne après une première lecture
  (≈ 18 Mo, chargés seulement à la première lecture, pas à l'installation).
- **Compteur** (onglet Projet) : la plaque est lue (tension, phases, « 3x10(40) A ») et l'alimentation **proposée**
  (3N x 400V, 3 x 230V ou 2 x 230V) ; triphasé sans tension lue : les deux choix sont proposés.
- **Plan** : « Lire les noms de pièces » pose les pièces lues sur le fond de plan, à leur place (vocabulaire
  FR/NL/EN, mots mal lus corrigés : « baing » → Bains) ; plan photographié de travers : relu tourné.
- **Tableau** : un seul bouton « Lire la photo » — l'IA si elle est configurée et déverrouillée, sinon la lecture
  locale : appareils découpés sans IA, étiquettes (aussi verticales), calibres et sensibilités lisibles, proposés
  avec une confiance faible, par le même chemin que la lecture par l'IA (brouillon ou comparaison).
- **L'IA après l'OCR, jamais à sa place** : compteur — l'IA n'est appelée que si la lecture locale n'a pas trouvé
  l'alimentation (nouvel usage « Compteur » dans les réglages de l'IA) ; plan — l'IA (usage « Plan ») repère les
  pictogrammes électriques, que l'OCR ne lit pas, et les pièces manquées ; ils sont posés sur le plan comme éléments
  non raccordés, à rattacher à leurs circuits.
- **Photo insuffisante** : raison et solution pour la refaire (floue, sombre, reflets, texte trop petit, voilée,
  mal cadrée), mesurées sur la photo et seulement quand la lecture est incomplète (seuils réglés sur les photos réelles).
- Mesuré sur 18 photos réelles : bon pour plaques de compteurs, étiquettes imprimées et noms de pièces ; insuffisant
  pour les calibres des petits modules depuis une photo du tableau entier (docs/strategie/ASSISTANT-COLLECTE.md § 8).
### Import Eendraadschema (2026-11-26)

- **Import des fichiers Eendraadschema (`.eds`)**, compressés ou non, versions 1 à 4 du format : menu Fichier et
  écran « Mes projets ». Raccordement, tableaux, protections, câbles, prises, points lumineux, interrupteurs
  (va-et-vient, permutateurs), appareils et infos du dossier sont repris ; une valeur absente reste absente ;
  l'installation importée est une installation existante. Le plan de situation n'est pas repris (avertissement).
  Fichier endommagé, trop gros ou de version inconnue : message clair (FR, NL, EN).

### Accueil, couleurs de circuits, matériel par pièce, étiquettes QR, DXF (2026-11-26)

- **Mes projets** : écran d'accueil avec les actions principales et les derniers projets (navigateur, appareil,
  nuage) ; un clic les rouvre. **Assistant de nouveau projet** en 4 étapes, chacune facultative ; l'installateur
  peut être retenu sur l'appareil. **Statut du dossier** : en cours, prêt pour le contrôle, contrôlé.
- **Couleurs des circuits** sur le plan et l'unifilaire, avec légende (affichage seulement ; l'impression reste
  en noir). Palette sans bleu, orange ni rouge, réservés à la sélection et aux constats.
- **Matériel par pièce** (bouton « Par pièce », colonne « Pièce » dans le CSV).
- **Étiquettes QR du coffret** (dossier imprimé) : lien vers le dossier partagé par l'installateur, ou texte
  lisible sans connexion. Aucun hébergement par Voltaplan.
- **Fond de plan DXF** : lecteur DXF texte intégré (lignes, polylignes, arcs, cercles, blocs) ; posé à
  l'échelle réelle quand le fichier indique son unité.
- **Maison type** dans l'assistant (installation neuve) : circuits courants déjà en place, à adapter ;
  vérifié par un test qui exige zéro constat du contrôle RGIE (hors adresse et installateur).
- **Convertisseurs** : type au choix (onduleur DC → AC, redresseur/onduleur AC ↔ DC pour une batterie, hacheur
  DC → DC), avec les symboles du tableau 2.23 du RGIE (H. Sources). Le rappel photovoltaïque ne vise plus un
  convertisseur de batterie.
- **Borne de recharge** : symbole redessiné d'après le tableau 2.23 du RGIE (colonne avec écran, « VE | EV »,
  socle, câble et fiche), au lieu d'un carré « VE ».
- Analyse des outils concurrents et des améliorations possibles : `docs/strategie/CONCURRENCE-2026-11.md`.
- Guides FR, NL et EN mis à jour ; site : démarrage guidé, sans compte, hors connexion, sans mesure d'audience.

### IA : configuration transférable entre appareils ; iPhone (2026-11-25)

- Réglages de l'IA → « Autres appareils » : un **QR code** (ou un lien à copier) transfère la configuration vers
  le téléphone, un autre ordinateur ou l'application de bureau (coller le lien). La clé reste chiffrée par la
  phrase secrète, que l'appareil qui reçoit demande ; aucun serveur (partie « # » du lien, jamais envoyée).
  Bibliothèque ajoutée : `qrcode-generator` 2.0.4 (MIT).
- iPhone : plus de zoom de la page au double-tap ; bas de l'écran dégagé sous la barre de Safari ; aide « Pour
  ajouter » sous le dessin ; colonne repliée sans grand vide.

### Lisibilité, avis et barre (2026-11-25)

- Texte courant en 14 px, aucun texte sous 12 px.
- Les avis (brouillon retrouvé, nouvelle version, conflit, fin d'import…) s'affichent dans une seule bande sous le
  dessin : ils ne se recouvrent plus et ne cachent plus le dessin ni une fenêtre (O6).
- Enregistrer : « Cet appareil » proposé d'abord ; navigateur et GitHub sous « Autres emplacements ».
- Téléphone : l'onglet « Contrôle RGIE » se réduit à son compteur d'alertes, toujours visible ; les six onglets
  tiennent sur une ligne.
- Barre du haut sur une seule ligne sur grand écran ; le schéma reste entièrement visible après un ajout.
- Exports (v1, Trikker, Eendraadschema) : confirmation « Fichier … créé » (O8).

### Dossier imprimé : mentions RGIE 3.1.2 (2026-11-25)

- Numéro du dossier (onglet Projet) imprimé dans le cartouche de chaque page, avec la version et la date ; donné
  par l'installateur, il est proposé automatiquement (date du projet + code) et reste modifiable.
- Cartouche : « Tension et nature du courant » libellé explicitement.
- Contrôle RGIE : numéro du dossier et qualité du responsable des travaux exigés (mentions documentaires).
- Bilan des mentions exigées : `docs/dossier-imprime-rgie.md`.

### Symboles : même rendu sur toutes les plateformes (2026-11-25)

- Arborescence : vrais symboles RGIE en miniature au lieu de caractères Unicode (absents de certaines polices
  Android, en emoji couleur sur téléphone).
- Textes du dessin dans la police de l'impression (Arial ou équivalent) ; pictogrammes d'interface en version texte.
- `npm run symbols:sheet` : planche de contrôle de tous les symboles et variantes (`docs/symboles/`).
- Comparés au tableau 2.23 du RGIE (édition 2026) : sectionneur de terre ─┤├──┤├─, cuisinière à 3 points et
  télérupteur ┘ └ corrigés ; détail et variantes manquantes dans `docs/symboles/README.md`.

### Plan au téléphone, tablette en portrait, aide au doigt (2026-11-25)

- Plan : outils rares dans un menu « Fond ▾ » ; le catalogue du mobilier s'affiche enfin au téléphone (il s'ouvrait
  hors de l'écran) et se ferme en touchant ailleurs.
- Tablette en portrait : colonne repliée et propriétés sous le dessin, comme au téléphone (dessin sur toute la
  largeur).
- Au doigt, un appui long sur un bouton montre son explication sans le déclencher.

### Téléphone à l'horizontale (2026-11-25)

- Disposition propre au téléphone tenu à l'horizontale : barre du haut sur une ligne, colonne repliée, propriétés
  dans un panneau à droite (bande verticale quand il est replié), réglages repliés au départ. Le dessin passe
  d'environ 472 × 272 à 790 × 332 px (812 × 375).
- Tableau au téléphone : calage cadré sur la photo, réglages repliés pendant le calage, menu « Photo ▾ ».
- Barre compacte : disquette à la place du mot « Enregistrer ».

### Téléphone : propriétés sous le dessin (2026-11-25)

- Colonne masquée, toucher un élément affiche ses propriétés dans un panneau sous le dessin : replié (une ligne)
  par défaut, déplié à la demande (choix retenu), plafonné pour que le dessin garde plus de la moitié de l'écran ;
  ✕ désélectionne. Auparavant, la sélection n'affichait rien.

### Accessibilité au clavier (2026-11-25)

- **Arborescence** utilisable au clavier : flèches pour parcourir et sélectionner, gauche/droite pour replier ou
  déplier, « + » ou Inser pour ajouter un élément dedans ; rôles ARIA pour les lecteurs d'écran.
- **Fenêtres** : le focus entre dans la fenêtre, y reste (Tab), **Échap ferme** et le focus revient d'où il venait.
- **Menus** Fichier et Ajouter : flèches, Début, Fin, Échap. Onglets de vue et de stockage signalés aux lecteurs
  d'écran. Constats et mesures : `docs/audit/ux-audit-visuel-2026-11-25.md`.

### Licence, provenance et identification (branche provenance-agpl, 2026-11-25)

- **Licence `AGPL-3.0-only`** (auparavant `-or-later`), titulaire unique des droits ; mention « Copyright (C) 2026
  Sébastien Batteur and Voltaplan contributors » ; `REUSE.toml`. Les versions déjà publiées restent sous
  `-or-later` pour qui les a obtenues.
- **Accord de contribution (CLA)** exigé avant toute contribution externe, pour garder une double licence
  possible ; modèle à choisir (`docs/legal/cla.md`), aucune contribution externe fusionnée d'ici là.
- **Identifiant permanent du projet** `urn:uuid:55b25e7a-c2a4-4787-bebc-42ecee353f9e` (`codemeta.json`).
- **À chaque compilation** : `build-info.json`, `fingerprints.json`, `THIRD-PARTY-LICENSES.txt`, balises
  d'identification, bandeau légal dans les fichiers JavaScript ; schémas génériques « oss-provenance 1.0 ».
- **« À propos de Voltaplan »** : version, commit, licence, code source correspondant (celui de la version
  utilisée, fork compris), licences tierces, copie des informations techniques.
- **Releases** : arbre propre exigé, compilation reproductible vérifiée, SBOM web et bureau, `SHA256SUMS`,
  attestations de provenance.
- Aucune télémétrie, aucun appel réseau ajouté. Documentation : `docs/architecture/`, `docs/legal/`,
  `docs/security/artifact-integrity.md`, ADR-0008.

### Stockage en ligne : corrections issues des essais réels (2026-11-25)

- **Google Drive : faux conflit corrigé.** Le 2ᵉ enregistrement d'un projet créé dans la session créait une copie
  de conflit : Drive change le numéro de version sans changer le contenu. Seule la révision de tête compte.
- **README.txt des dossiers de projet** : texte propre aux dossiers (et non plus à l'archive), envoyé seulement
  s'il manque ou si son texte a changé, au lieu de repartir à chaque enregistrement.
- **Enregistrement sur l'appareil sans sélecteur de fichiers** : l'archive téléchargée porte son type propre
  (`application/vnd.voltaplan+zip`, au lieu de `application/zip`) et son nom finit toujours par `.voltaplan`, même
  pour une copie de conflit.
- **Dates des dossiers** : même présentation pour Google Drive, OneDrive et Dropbox (date du projet, le plus
  récent d'abord), sans une requête par dossier.
- **iPhone, iPad : connexion à Dropbox et OneDrive.** Safari bloquait la fenêtre de connexion, ouverte après un
  calcul de sécurité (PKCE). Elle s'ouvre maintenant tout de suite, puis reçoit l'adresse de connexion.
- **iPhone, iPad : rouvrir un fichier `.voltaplan`.** Le fichier était grisé dans le sélecteur d'iOS, qui ne
  connaît pas cette extension. Sur ces appareils, le sélecteur ne filtre plus ; le fichier choisi est toujours
  reconnu par son contenu.
- **Reprise automatique d'un envoi en attente**, même quand le navigateur ne signale pas le retour du réseau
  (Windows avec une autre carte réseau active) : nouvel essai à 10 s, 30 s, 1 min, 2 min, puis toutes les 5 min.
  Jamais deux envois à la fois : un second clic sur « Enregistrer » pendant un envoi est ignoré.
- **Application de bureau : enregistrement atomique.** Le projet est écrit dans un fichier temporaire du même
  dossier, vérifié, puis il remplace l'ancien ; la version précédente est gardée en `.bak`. Une coupure, un disque
  plein ou un fichier verrouillé ne laissent jamais un projet vide ou tronqué (essai réel sous Windows, dossier
  OneDrive compris). « Ouvrir » passe par la boîte du système : « Enregistrer » réécrit ensuite le fichier ouvert.
  Message clair quand le fichier est utilisé par un autre logiciel (ces deux points revérifiés dans l'application
  installée) ; avertissement à la fermeture de la fenêtre s'il reste des modifications non enregistrées, géré côté
  Rust (la version côté page ne s'affichait pas dans l'application installée ; revérifié).
- **Reconnexion avant l'expiration de la session (R2).** Cinq minutes avant la fin de la session du service où est
  enregistré le projet, un repère discret apparaît dans la barre : « Session … : fin dans N min · Reconnecter ». Un
  clic rouvre la connexion sans recharger la page ; un enregistrement en attente part aussitôt. Fermé, il ne revient
  qu'à l'échéance suivante.
- **Google Drive : une mise à jour ne fait plus perdre la demande de Drive.** Si « Recharger » est cliqué avant de
  répondre au bandeau « Ouvrir » ou « Créer », le bandeau revient après le rechargement (même onglet, 10 minutes au
  plus).
- **OneDrive (comptes personnels) : rouvrir un projet** échouait (« Failed to fetch ») : le contenu est servi par
  `my.microsoftpersonalcontent.com`, maintenant autorisé dans la politique de sécurité (CSP).
- **Google Drive, « Nouveau → Voltaplan »** : la demande de Drive est acceptée même quand la clé du dossier est
  vide (dossier de « Mon Drive ») ; une demande non reconnue est signalée ; « Enregistrer » avant d'avoir répondu au
  bandeau Drive renvoie au bandeau au lieu de proposer l'appareil ; le bandeau Drive s'affiche en haut.
- **Messages plus justes** : une première connexion bloquée ne parle plus de « session expirée » ; les messages de
  réussite (autorisation donnée, jeton prêt) sont en vert ; ouvrir un projet affiche « Projet ouvert » (« Import
  terminé » reste réservé aux fichiers Trikker).
- **Google Drive : un gros document interrompu reprend où il s'était arrêté** à l'essai suivant (au lieu de repartir
  de zéro), tant que l'onglet reste ouvert.

### Site et publication

- **GitHub Sponsors** : bouton « ♥ Soutenir » dans l'en-tête du site, encart sur la page d'accueil (FR, NL, EN),
  lien dans le pied de page et le menu « ⋯ » de l'application. Simples liens : aucun contenu de GitHub n'est
  chargé par les pages (pas de cadre intégré, donc ni cookie ni requête vers un tiers avant le clic).
- Pages publiques Confidentialité et Conditions d'utilisation (FR, NL, EN) sur voltaplan.org, liées depuis toutes les pages ; mention « utilisation limitée » des données Google.
- Liens « Code source » corrigés sur le domaine voltaplan.org (ils pointaient vers github.com sans dépôt) ; plus de bouton « Télécharger » tant qu'aucune version de bureau n'est publiée (installation de la version web comme application expliquée).
- Dossier de validation OAuth Google (`docs/google-oauth-verification.md`) et logo 120 × 120.

Détail : [docs/audit/FINAL-REPORT.md](docs/audit/FINAL-REPORT.md).

### Contrôle RGIE
- Éditions datées (avant 1981, ancien RGIE de 1981, Livre 1 depuis le 1/6/2020), appliquées partie par partie (date de réalisation d'un tableau ou d'un circuit).
- Statut de chaque constat (non conforme, information manquante, avertissement, à vérifier, recommandation, dérogation), gravité et caractère bloquant séparés. Installation existante : les règles de sécurité restent non conformes et bloquantes.
- Dérogations motivées, visibles dans le dossier. « Local avec baignoire ou douche » explicite. Référentiel inconnu signalé.
- Vérifications manuelles signalées : bornes de recharge, photovoltaïque, dispositions transitoires.

### Contrôle RGIE : inconnu ≠ absent
- Un élément absent du dessin n'est plus considéré comme absent de l'installation réelle. Installation existante (relevé) : prise de terre, différentiel général ou différentiel 30 mA non dessinés → « Informations insuffisantes », non bloquant, avec les boutons « Confirmer présent / Confirmer absent / Je ne sais pas ». Une absence confirmée redonne une non-conformité (bloquante pour la sécurité). Installation neuve (conception) : le dessin reste la référence, résultats inchangés.
- Nouveaux statuts : « Anomalie potentielle » (information déduite ou non confirmée), « Informations contradictoires » (dessin et déclaration, ou sources de l'assistant, en désaccord), « Règle non évaluée ». Libellés : « Non-conformité détectée », « Informations insuffisantes », « Vérification manuelle nécessaire » ; résumé « Aucune anomalie détectée parmi les N règles vérifiées ».
- Exigences documentaires (mentions, schéma incomplet, valeurs non renseignées) séparées des exigences de l'installation, dans le contrôle et dans le dossier : jamais présentées comme des non-conformités de l'installation.
- Sensibilité d'un différentiel non renseignée : « Informations insuffisantes » au lieu de « non conforme ». Mesures à faire signalées : liaisons équipotentielles, essai des différentiels.
- Dossier de réception : mention « PROJET — NON-CONFORMITÉS À TRAITER », « PROJET — VÉRIFICATIONS À FAIRE » ou « PROJET — DOSSIER INCOMPLET » selon la situation ; phrase « ni une certification ni un contrôle de conformité » sur les pages de constats. Voir [ADR-0007](docs/adr/0007-etats-de-connaissance-et-exigences.md).

### Assistant de relevé (prototype)
- Fichier → Nouveau relevé (installation existante) ; photo du tableau lue par l'IA → brouillon de tableau, protections, circuits et unifilaire, avec des questions pour ce qui n'est pas lisible. Rien n'est inventé ni appliqué sans accord ; acceptation groupée de ce qui est sûr ; relevé figé daté (non certifié).
- Valeurs reprises d'une photo et non confirmées : signalées au contrôle RGIE ; les constats qui en dépendent sont marqués « à vérifier ».
- « Créer depuis la photo » n'ajoute plus de valeurs par défaut (calibre, courbe, pouvoir de coupure) aux valeurs lues.
- Plusieurs photos d'un même tableau (une par rangée, ou des prises qui se recouvrent) : fusion par position ; valeurs d'accord plus sûres ; désaccord → une seule question avec les valeurs de chaque photo ; même photo relue → lecture réutilisée sans nouvel appel à l'IA ; lecture identique à une autre photo → doublon signalé, rien d'ajouté. Une nouvelle photo ne repropose pas ce qui est déjà accepté et ne repose aucune question.
- Plusieurs tableaux : « Ajouter un tableau » (sous-tableau, alimentation inconnue) ; un brouillon par tableau ; rattachement proposé sous le circuit étiqueté « sous-tableau … » (à vérifier une par une).
- Étiquettes : abréviations belges FR, NL, EN reconnues (PC, Ecl., SDB, Ch.1, Slpk, LL, LV, Stopc., Verl.…), étiquettes à plusieurs usages, réserve et général.
- Questions : section groupée par usage (une réponse pour tous, ou chacun séparément), rien pour une réserve ou un appareil non protecteur, « Tout à vérifier plus tard ».
- Correction d'une proposition avant de l'accepter : calibre, courbe, sensibilité, usage, pièce, différentiel amont.
- Banc d'évaluation de la lecture par l'IA, à lancer avec sa propre clé ou un modèle local (`tools/ai-eval/`, [docs/assistant-evaluation.md](docs/assistant-evaluation.md)). Les tests automatiques utilisent des lectures simulées et ne mesurent pas la qualité réelle de la reconnaissance.
- Protocole d'évaluation sur photos réelles anonymisées (corpus stratifié d'au moins 30 tableaux, guide d'annotation, indicateurs, prudence statistique, seuils proposés pour la bêta) et mode matrice du banc (`npm run ai-eval:matrix`) : comparaison de plusieurs fournisseurs et modèles (qualité, valeurs inventées, abstention, durée p50/p95, jetons, coût par photo et pour 100 tableaux), répétitions, reconstruction complète de plusieurs photos et tableaux par le code de l'assistant. Plan et coût estimé seulement par défaut ; aucun appel sans `--live --i-authorize-costs` (et, pour un fournisseur payant, prix, clé et plafond `--max-cost`) ; résultats gardés hors suivi git.

### Modèle et fichiers
- **Aucun écrasement silencieux** : « Enregistrer » vérifie que le fichier n'a pas été modifié ailleurs depuis son ouverture (OneDrive : eTag ; Dropbox : révision ; Google Drive : version ; GitHub : SHA ; navigateur : révision ; fichier local : date et taille). En cas de conflit, votre version est enregistrée en copie datée, au même endroit ; les deux versions sont conservées.
- Versions locales (20 dernières par projet) et brouillon automatique par onglet, récupérable après une fermeture ou un plantage. Pas de réseau : l'enregistrement est mis en attente et repris au retour de la connexion.
- État de l'enregistrement affiché en permanence (enregistré, en attente, conflit, erreur).
- Enregistrement en attente gardé après fermeture et proposé à la reprise ; brouillon écrit avant chaque enregistrement (récupération après interruption) ; jeton expiré : reconnexion, version gardée ; Google Drive : modification concurrente pendant l'envoi détectée et recopiée ; rétention des versions adaptée à l'espace du navigateur.
- Hors ligne : fonctions indisponibles signalées sur place (IA en ligne, GitHub, services en ligne) ; un modèle d'IA local reste utilisable. Procédure de validation par plateforme : [docs/validation-plateformes.md](docs/validation-plateformes.md).
- Suppression : plus de références orphelines (tableau, mesures, dérogations…).
- Ouverture validée et migrable ; message clair pour un fichier tronqué, inconnu ou d'une version plus récente.

### Format v2
- Projet enregistré en **archive `.voltaplan` (ZIP)** : modèle, documents originaux (photos, PDF) gardés tels quels, manifest avec empreintes SHA-256, README pour récupérer les données sans Voltaplan ([docs/file-format.md](docs/file-format.md), [ADR-0006](docs/adr/0006-format-v2-implementation.md)).
- Ouverture rapide quelle que soit la taille (seul le modèle est lu ; documents lus et vérifiés à la demande), écriture en flux ; mesures de 10 à 500 Mo dans [docs/format-v2-performance.md](docs/format-v2-performance.md) (ordinateur ; mobile à mesurer).
- Archives importées validées : chemins en liste blanche, tailles et taux de compression plafonnés, liens et entrées chiffrées refusés, type vérifié par signature (SVG et HTML refusés), CRC et SHA-256 ; un élément invalide est isolé, le reste s'ouvre (mode de récupération, archive tronquée).
- Anciens projets (JSON) toujours lisibles, convertis à l'ouverture sans jamais réécrire l'original ; « Exporter au format v1 » liste ce qui ne peut pas être gardé.
- Documents rangés une seule fois sur l'appareil (stockage de travail dédoublonné) ; un document utilisé par un projet, un brouillon ou une version n'est jamais supprimé. Fichier déplacé pendant le travail : documents déjà copiés disponibles, message clair pour les autres.
- Fonds de plan PDF et photos : l'original est conservé (avant : première page réduite seulement).
- OneDrive : « Enregistrer comme dossier de projet » (chaque document envoyé une fois, puis seul le modèle) ; « Exporter en dossier » sur ordinateur (Chrome, Edge).
- Google Drive : révisions conservées limitées en nombre et en taille.
- Pannes pendant l'enregistrement (tests avec pannes et réponses simulées, [à vérifier avec de vrais comptes]) : disque plein, espace OneDrive, Dropbox ou Google Drive épuisé, archive trop grosse pour GitHub (100 Mo) → message clair, version gardée dans le navigateur, original intact, et plus de reprise automatique en boucle. Écriture interrompue : jamais de fichier ou de modèle incomplet publié ; dossier de projet repris sans renvoyer les documents déjà envoyés ; un fichier vide laissé par une coupure dans un dossier local ne bloque plus.
- Stockage du navigateur plein à l'ajout d'une photo : les images d'affichage (régénérables) sont libérées d'abord.
- Ouverture d'un ancien projet (JSON) avec photos : mémoire nettement réduite (lecture par tranches, images décodées au fil de l'eau ; +184 Mo → +34 Mo pour 47 Mo, mesure sur ordinateur).
- Garanties après une fermeture brutale et entre deux appareils décrites dans [ADR-0006](docs/adr/0006-format-v2-implementation.md) § 13.
- Dossier de projet aussi sur Dropbox et Google Drive (mêmes garanties que OneDrive : documents envoyés une fois et vérifiés avant le modèle, modèle conditionnel, copie de conflit dans le même dossier, reprise après coupure, gros documents par tranches, aucune suppression). Pour chaque service, choix « dossier de projet » ou « fichier unique », avec une courte explication ; import d'un fichier `.voltaplan` dans un nouveau dossier ; passage d'un service à l'autre. Tests avec des services simulés [à vérifier avec de vrais comptes].
- Google Drive : « Ouvrir avec Voltaplan » et « Nouveau → Voltaplan » (paramètre de Drive validé, ouverture seulement après un clic, adresse nettoyée, fichier rouvert à sa version pour un enregistrement sans écrasement ; lecture seule ou ancien format : nouveau fichier). Configuration à faire dans la console Google : [docs/oauth-configuration.md](docs/oauth-configuration.md).
- Un seul type MIME pour l'archive : `application/vnd.voltaplan+zip` (envois Drive, « Enregistrer sous », manifeste de l'application installée) ; les anciens fichiers JSON restent acceptés.

### Calculs
- Câbles en aluminium, chute de tension cumulée depuis l'origine, méthode détaillée avec les puissances, bilan de puissance et équilibrage des phases.

### Dossier
- Types de document : travail, réception, rapport d'anomalies, dossier complet. Tous les constats imprimés (plus de coupure).

### IA
- Fournisseur au choix : Anthropic, API compatible OpenAI (OpenAI, Gemini, Mistral), modèles locaux (Ollama, LM Studio) sans clé.

### Hors ligne
- Toute l'application est copiée pour un usage hors ligne dès la première visite, y compris les fonctions jamais utilisées en ligne (fond de plan PDF, import/export Trikker, Eendraadschema…). Liste des fichiers et version calculées à la construction ; les anciennes versions sont supprimées du cache.
- Mises à jour annoncées par un bandeau « Nouvelle version disponible — Recharger », jamais imposées pendant le travail ; les modifications non enregistrées sont gardées comme brouillon avant de recharger.
- Protection des projets gardés dans le navigateur contre l'effacement automatique (stockage persistant), place utilisée affichée, conseil pour Safari / iPhone / iPad.
- Repère « Hors ligne » près du bouton IA. Voir [docs/offline.md](docs/offline.md).

### Téléphone et tablette (ergonomie tactile)
- Au doigt, chaque bouton, champ, liste et case fait au moins 44 × 44 px (lignes de l'arborescence, « ＋ », dépliage, titres et bande de la colonne, séparation à glisser, menus, fenêtres). Champs en 16 px : iOS ne zoome plus à la saisie. Rien ne change à la souris.
- Barre d'outils compacte sur petit écran (et sur tablette au doigt) : deux lignes au lieu de trois ; « Annuler », « Rétablir », « Mettre à jour », « IA » et la langue passent dans un menu « ⋯ » ; « Enregistrer » reste visible ; onglets des vues sur une ligne qui défile ; nom du fichier tronqué.
- Plan et tableau : réglages empilés au-dessus du dessin au lieu de le recouvrir, repliables (« Réglages du tableau », « Outils du plan ») ; restent ouverts pendant le calage de la photo.
- Appui long au doigt : ouvre le menu « Ajouter » sur un élément de l'unifilaire, et « Ajouter ici » sur le plan (comme le clic droit, absent sur iPhone et iPad). Indications « appui long » au lieu de « clic droit » sur écran tactile.
- Zoom à deux doigts (pincement) sur l'unifilaire, le plan et le tableau.
- Vérifié en émulation seulement (Chrome, 375 × 812 et 767 × 1024 tactiles) : [docs/validation-plateformes.md](docs/validation-plateformes.md#5-ergonomie-tactile-émulation).

### Application de bureau (Tauri)
- Première compilation réelle (CI) : Windows, macOS (Apple Silicon et Intel) et Linux. État, risques et recommandations : [docs/desktop-tauri.md](docs/desktop-tauri.md).
- `release.yml` échouait avant toute compilation (script npm `tauri` absent) : corrigé.
- Nouveau workflow `desktop-build.yml` : construction sans publication (manuelle et sur les demandes de fusion touchant `src-tauri` ou les paquets npm), cache Rust.
- `Cargo.lock` versionné et vérifié ; `@tauri-apps/plugin-fs` aligné sur la crate (2.7.1) ; Dependabot regroupe les mises à jour Tauri.
- Enregistrement atomique et vérifié : l'archive est écrite en flux (morceaux de 4 Mo) dans un fichier temporaire du même dossier, relue et vérifiée, puis renommée ; la version précédente d'un projet est gardée en `<nom>.voltaplan.bak`. Une coupure ou un disque plein laisse l'ancien fichier intact. Boîte « Enregistrer » ouverte côté Rust : la page ne peut écrire qu'aux chemins choisis par l'utilisateur et aux extensions de l'application (`.voltaplan`, `.trik`, `.eds`, `.csv`, `.jpg`) ; droits `dialog` et `fs` retirés de la page. Compilé et testé (`cargo test`) sur Windows, macOS et Linux ; essai dans l'application installée à faire. Détails : [docs/desktop-tauri.md](docs/desktop-tauri.md), section 13.
- Droit `core:webview:allow-print` : sur macOS, l'impression du dossier était refusée sans lui.

### Sécurité
- CSP, tailles maximales à l'import, fichiers XML avec DTD refusés, images limitées aux images intégrées, ESLint, audit des dépendances, CodeQL, Dependabot, recherche de secrets.

## 0.1.0
- Première version : unifilaire, plan de position, tableau, contrôle RGIE, import/export Trikker, export Eendraadschema, dossier PDF.
