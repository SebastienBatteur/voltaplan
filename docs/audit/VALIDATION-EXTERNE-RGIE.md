# Dossier de validation externe : 15 questions d'interprétation du RGIE

Dossier destiné à un spécialiste belge du RGIE ou à un organisme agréé. Établi le 27/11/2026 à partir de l'audit de la rubrique « Apprendre » de Voltaplan (`docs/audit/APPRENDRE-RGIE-AUDIT-2026.md`).

## 1. Introduction

### Voltaplan en deux mots

Voltaplan est une application libre (open source) qui aide à dessiner les schémas unifilaires et les plans de position d'une installation électrique domestique belge. Elle comprend :

- **un moteur de contrôle d'aide à la conformité** : à partir du schéma dessiné, il relève des constats (« non conforme », « recommandation », « informations insuffisantes »…). Un constat peut être **bloquant** : il empêche alors de présenter le dossier comme prêt pour la réception. En règle générale, une non-conformité est bloquante dans une partie neuve ; dans une partie existante, seule une règle classée « gravité élevée » reste bloquante, les autres deviennent des recommandations ;
- **une rubrique pédagogique « Apprendre »** de 54 articles (bases, câbles, protections, contrôles, câblages, volets, domotique, schémas), un lexique et 12 exercices de câblage avec simulateur.

**Voltaplan n'est pas certifié conforme au RGIE.** Ses contrôles sont une aide ; ils ne remplacent ni le texte officiel ni le contrôle de conformité par un organisme agréé.

### Pourquoi ce dossier

Un audit des 54 articles (1 739 affirmations vérifiées une à une contre le texte officiel) a laissé 15 points où le texte se prête à plusieurs lectures, où il renvoie à des normes que l'auditeur n'a pas pu consulter, ou où la pratique courante semble s'écarter de la lettre du texte. Ni les articles ni le moteur ne seront modifiés sur ces points avant votre avis.

Vous n'avez pas besoin de lire le code source : pour chaque question, ce que disent les articles et ce que fait le moteur est décrit en langage courant.

### Texte de référence

**RGIE, Livre 1 « Installations à basse tension et à très basse tension », version 07 du 15/09/2026 (arrêté royal du 13/08/2026, réf. C- 2026/006432), d'application à partir du 01/11/2026**, texte publié par le SPF Économie.

- Les citations sont **reprises mot pour mot** de ce texte, y compris ses coquilles éventuelles ; seuls les retours à la ligne de la mise en page ont été joints. Les dessins (symboles, figures) ne sont pas reproduits ; quand un tableau a dû être remis en forme, c'est signalé.
- Les numéros de page sont les **pages imprimées** en pied de page du document (elles correspondent à son sommaire).
- Quand une affirmation dépend d'une **norme** (NBN, EN, IEC, HD) ou d'une prescription de gestionnaire de réseau (Synergrid) que nous n'avons pas consultée, c'est dit explicitement : rien n'est attribué à une norme sans l'avoir lue.

### Comment répondre

Pour chaque question, une zone « Réponse du spécialiste » est prévue. Il suffit :

1. de cocher **A**, **B**, ou **Autre** (et dans ce dernier cas de préciser) ;
2. d'ajouter un commentaire libre si utile (référence, pratique des organismes, nuance) ;
3. d'indiquer votre degré de certitude (« certain », « probable », « à confirmer par le SPF Économie ») si vous le souhaitez.

La page finale « Synthèse des réponses » permet de tout reporter sur une page. Vos réponses peuvent être citées dans le dépôt du projet ; dites-le si vous préférez qu'elles restent anonymes.

**Contact** : _à compléter (nom, adresse électronique, lien vers le dépôt)._

## 2. Tableau récapitulatif

Priorité selon l'impact principal : **Sécurité** (une lecture erronée pourrait conduire à une installation dangereuse ou à sous-estimer un danger), **Conformité** (risque de faux constat ou de non-conformité non détectée, sans danger direct), **Pédagogie** (précision de l'explication).

| N° | Sujet | Référence RGIE | Priorité |
|---|---|---|---|
| 1 | Disjoncteurs « 1P+N » et détection de surintensité sur les deux conducteurs actifs | 4.4.4.1, 4.4.4.2 | Sécurité |
| 2 | Différentiels de type AC dans une installation existante | 5.3.5.3 a ; 8.2.1 ; 8.2.2 | Sécurité |
| 3 | Réseau public 3 × 230 V : schéma IT et tension phase-terre | 2.2.1.2 b.3 ; 4.2.3.4 d ; 4.5.3 | Sécurité |
| 4 | Câble 3G1,5 en va-et-vient avec le conducteur bleu en navette | 5.1.6.2 ; définitions 2.6.1 | Conformité |
| 5 | Exception de 4.5.4 (télécommunication) dans une habitation | 4.5.4 ; 4.2.5.3 c | Conformité |
| 6 | Module domotique caché : « unité de commande » à représenter ? | 3.1.2.1 a ; tableau 2.23 J | Conformité |
| 7 | Groupe de volets sous une même commande : combien de points ? | 5.3.5.2 b ; 4.2.4.3 b | Conformité |
| 8 | Prise double faite de deux socles simples : un ou deux points ? | 5.3.5.2 b ; tableau 2.23 F | Conformité |
| 9 | Redémarrage automatique d'un ouvrant motorisé domestique | 5.3.3.2 e ; 4.6.1 | Sécurité |
| 10 | Contrôle d'une installation réalisée par un particulier | 3.1.2.1 a ; 6.4.1 ; 6.4.6.4 | Pédagogie |
| 11 | Essai des différentiels alors que le contrôle se fait « hors tension » | 6.4.1 ; 6.4.4 ; 6.4.6.4 b.4 | Pédagogie |
| 12 | Conducteur de protection vers un détecteur de mouvement | 5.4.3.6 ; tableau 2.23 E | Conformité |
| 13 | Valeurs tirées de normes non consultées | 5.2.5 ; 5.3.5.2 a ; 5.2.1.1 ; normes | Conformité |
| 14 | Obturateurs (sécurité enfant) avant le 01/03/2025 | 5.3.5.2 a et c ; 6.5.8.1 ; 8.2.1 ; 8.2.2 | Conformité |
| 15 | Tension d'un bouton de sonnette extérieur (BB1 ou BB2) | 4.2.2.2, tableau 4.1 ; 2.10.12 | Sécurité |

---

## Question 1 — Disjoncteurs « 1P+N » et détection de surintensité sur les deux conducteurs

### Question

Dans un circuit terminal monophasé d'une installation domestique alimentée en 230 V entre une phase et le neutre, un disjoncteur « 1P+N » (un pôle protégé sur la phase, le neutre étant seulement coupé, sans détection de surintensité) répond-il, utilisé seul, à la sous-section 4.4.4.2 ?

### Texte réglementaire

RGIE, Livre 1, 4.4.4.1 et 4.4.4.2, p. 119 :

> Sous-section 4.4.4.1. Coupure du conducteur affecté
>
> Une détection de surintensité est prévue sur tous les conducteurs de ligne. Elle provoque la coupure du conducteur dans lequel la surintensité est détectée mais ne provoque pas nécessairement la coupure des autres conducteurs actifs.
>
> Si la coupure d’un conducteur de ligne peut entraîner un danger, par exemple dans le cas de moteurs triphasés, des dispositions appropriées sont prises.
>
> Sous-section 4.4.4.2. Protection des circuits monophasés ou biphasés en courant alternatif
>
> Dans les circuits monophasés ou biphasés des installations domestiques, une détection de surintensité est réalisée sur les deux conducteurs actifs sauf si à ce niveau existe un dispositif de protection à courant différentiel-résiduel qui contient également une détection de surintensité d’un des conducteurs de ligne et assure la coupure des deux conducteurs actifs. Ce dispositif a le pouvoir de coupure requis.

RGIE, Livre 1, 4.4.4.4 (premier tiret), p. 120 :

> Sous-section 4.4.4.4. Circuits triphasés en schéma TT et TN à conducteur N distribué en courant alternatif – Protection du conducteur N
>
> Dans les installations électriques selon un schéma TT ou TN dans lesquelles le conducteur N est distribué, la protection du conducteur N se fait comme suit:
>
> − lorsque la section de ce conducteur N est au moins équivalente à celle des conducteurs de ligne, il n’est pas nécessaire de prévoir une détection de surintensité ni un dispositif de coupure sur le conducteur N, sous réserve du respect de la prescription de la sous-section 4.4.4.8.;

Définitions, 2.4.1, p. 22 :

> Conducteur actif: conducteur affecté à la transmission de l’énergie électrique. Les conducteurs de ligne et neutre, même si ces conducteurs sont utilisés comme conducteurs de protection (conducteur PEN, PEM ou PEL) sont couverts par cette définition.
>
> Conducteur de ligne: conducteur actif ou partie active (L) qui participe à la distribution de l’énergie électrique à l’exception du conducteur neutre.

### Interprétations possibles

**A. Lecture littérale : détection sur la phase et sur le neutre.** Le texte dit « les deux conducteurs actifs », et la définition de « conducteur actif » inclut expressément le neutre. Dans un circuit monophasé phase-neutre d'une installation domestique, une détection de surintensité est donc requise sur le neutre aussi. Seule exception écrite : un dispositif différentiel qui détecte la surintensité sur un conducteur de ligne et coupe les deux conducteurs (disjoncteur différentiel). Un disjoncteur 1P+N seul, en aval d'un interrupteur différentiel, ne suffirait pas ; il faudrait un disjoncteur bipolaire à deux pôles protégés (2P), ou un disjoncteur différentiel. Argument : la règle vise précisément les installations domestiques, ce qui la distingue de la règle générale de 4.4.4.1 et de 4.4.4.4.

**B. Lecture d'usage : le 1P+N est admis lorsque le neutre est un vrai neutre.** La règle générale (4.4.4.1) ne vise que les « conducteurs de ligne », et 4.4.4.4 dispense le neutre d'une détection lorsque sa section est au moins égale à celle des conducteurs de ligne. La sous-section 4.4.4.2 viserait surtout les circuits dont les deux conducteurs peuvent être des conducteurs de ligne (circuits biphasés, réseau 3 × 230 V), ou garantirait la protection quand la phase et le neutre ne sont pas identifiables avec certitude. Argument : le 1P+N est d'usage très courant dans les tableaux domestiques belges (l'audit le relève comme pratique courante, sans pouvoir dire comment les organismes agréés le traitent) ; la lecture A rendrait non conformes un grand nombre d'installations récentes.

**Point annexe (si vous le jugez utile).** Sur un réseau 3 × 230 V, les deux conducteurs d'un circuit monophasé sont des conducteurs de ligne. L'exception de 4.4.4.2 (disjoncteur différentiel qui détecte sur « un des conducteurs de ligne ») semble alors entrer en tension avec 4.4.4.1 (« sur tous les conducteurs de ligne »). Un disjoncteur différentiel 1P+N est-il admis sur un réseau 3 × 230 V ?

### Exemple concret d'installation

- Réseau 3N × 400 V, raccordement monophasé 230 V, 40 A ; schéma TT.
- Tableau : interrupteur différentiel général 300 mA type A, 40 A ; en aval, interrupteur différentiel 30 mA type A, 40 A.
- Circuit A (éclairage) : disjoncteur **1P+N** 16 A courbe C, 6 kA ; câble XVB 3G1,5.
- Circuit B (prises) : disjoncteur **1P+N** 20 A courbe C, 6 kA ; câble XVB 3G2,5 ; 6 socles.
- Variante B' : circuit B protégé par un **disjoncteur différentiel 1P+N** 20 A, 30 mA.
- Variante B'' : même tableau sur un réseau **3 × 230 V**, circuit B en disjoncteur différentiel 1P+N.

Lecture A : A et B non conformes, B' conforme. Lecture B : A, B et B' conformes. B'' dépend du point annexe.

### Conséquences sur les articles

- **`disjoncteur`** : suit actuellement la lecture A (« Un modèle « 1P+N », qui ne surveille que la phase, ne répond pas à cette règle s'il est utilisé seul »). En lecture B, ce paragraphe serait réécrit pour présenter le 1P+N comme admis sur un réseau avec neutre.
- **`organiser-tableau`** : même lecture A (« chaque circuit monophasé a une détection de surintensité sur ses deux conducteurs »). À adapter en lecture B.
- Lexique (« 1P+N », « bipolaire ») : à aligner.

### Conséquences sur le moteur

- Règle **R-POLES-NO-NEUTRAL** (non-conformité, gravité élevée, **bloquante**, y compris dans une partie existante). Aujourd'hui elle ne se déclenche que si l'alimentation déclarée est un réseau 3 × 230 V : tout disjoncteur, disjoncteur différentiel ou fusible en 1P ou 1P+N est alors signalé. Sur un réseau 3N × 400 V, rien n'est signalé. Le pôle proposé par défaut pour un nouveau disjoncteur est « 1P+N ».
- **Lecture A** : la règle serait étendue à tout circuit monophasé domestique protégé par un disjoncteur 1P+N seul (disjoncteur différentiel 1P+N excepté) ; le pôle par défaut passerait à 2P. Effet important : beaucoup d'installations existantes deviendraient « non conformes » et bloquantes, sauf si vous indiquez que ce point ne relève pas de la gravité élevée.
- **Lecture B** : règle inchangée sur 3N × 400 V.
- Point annexe : selon votre réponse, le disjoncteur différentiel 1P+N serait accepté ou non sur un réseau 3 × 230 V (aujourd'hui : signalé).

### Décision attendue

A ou B (ou autre) ; si A, indiquer si un constat dans une installation existante doit être bloquant ou une simple recommandation ; réponse au point annexe (oui / non).

### Réponse du spécialiste

- [ ] A  [ ] B  [ ] Autre : …
- Existant (si A) : [ ] bloquant  [ ] recommandation
- Point annexe (disjoncteur différentiel 1P+N sur 3 × 230 V) : [ ] admis  [ ] non admis
- Commentaire :

&nbsp;

---

## Question 2 — Différentiels de type AC dans une installation existante

### Question

Un dispositif différentiel de type AC posé dans une installation domestique existante (réalisée avant le 01/06/2020 et contrôlée selon les règles alors applicables) peut-il rester en service, ou doit-il être considéré comme une infraction à 5.3.5.3 a lors d'une visite de contrôle ou d'un contrôle après modification ?

### Texte réglementaire

RGIE, Livre 1, 5.3.5.3 a, p. 168 :

> Sous-section 5.3.5.3. Dispositifs de protection à courant différentiel-résiduel en courant alternatif
>
> a. Choix de dispositifs
>
> Les dispositifs de protection à courant différentiel-résiduel sont choisis et installés conformément aux dispositions du présent Livre. Ils présentent une résistance aux courts-circuits correspondant à la puissance de court-circuit à l'endroit de leur installation.
>
> Les dispositifs de protection à courant différentiel-résiduel placés dans les installations domestiques sont au moins du type A; ceux qui sont placés en tête de l’installation électrique ont une intensité nominale au moins égale à 40 A.

RGIE, Livre 1, 8.2.1 (introduction, points 1 et 2), p. 273 :

> Section 8.2.1. Parties existantes des anciennes installations électriques domestiques
>
> Les dispositions dérogatoires suivantes sont applicables aux parties existantes des anciennes installations électriques domestiques dont l’exécution sur place a été réalisée avant le 1er octobre 1981 et qui ont fait l’objet ou non d’une visite de contrôle conformément à l’ancien RGIE:
>
> 1. Conformité du matériel électrique dans l’installation électrique
>
> Il est autorisé, en dérogation aux prescriptions de la sous-section 5.1.3.1., de laisser en service du matériel électrique dans une installation électrique tel que des boites de dérivation, des canalisations électriques, des dispositifs de protection, … qui a été construit conformément aux règles de l’art au moment de son installation, à condition que les caractéristiques du matériel électrique répondent aux prescriptions des installations domestiques du présent Livre, moyennant l’application des dérogations de la présente section. Le matériel électrique ne compromet pas la sécurité des personnes, en cas d’installation et d’entretien corrects et d’utilisation conforme à sa destination. Il est ou bien par sa construction ou bien par une protection supplémentaire adapté aux influences externes et aux conditions d'utilisation présentes ou raisonnablement prévisibles. Il est tenu compte des instructions éventuelles du fabricant du matériel électrique, relatives à l'installation, l'entretien et l'utilisation sûre de ce matériel.
>
> 2. Choix des dispositifs de protection à courant différentiel-résiduel
>
> Il est autorisé, en dérogation aux prescriptions:
>
> − du point a.3. de la sous-section 5.3.3.1., de laisser en service à l’origine de l’installation électrique un dispositif de protection à courant différentiel-résiduel dont la fonction de sectionnement est assurée par un dispositif sectionneur général installé dans le tableau principal et en amont du dispositif de protection à courant différentiel-résiduel;
>
> − du point a. de la sous-section 5.3.5.3., de laisser en service les dispositifs de protection à courant différentiel-résiduel d’une intensité nominale inférieure à 40 A;
>
> − du point e. de la sous-section 5.3.5.5., de laisser en service les dispositifs de protection à courant différentiel-résiduel d’une intensité nominale inférieure à 40 A ne portant pas le marquage spécifique ≪3000 A, 22,5 kA²s≫.

RGIE, Livre 1, 8.2.2 (introduction et point 2), p. 276-277 :

> Section 8.2.2. Parties existantes des installations électriques domestiques ancien RGIE
>
> Les dispositions dérogatoires suivantes sont applicables aux parties existantes des installations électriques domestiques ancien RGIE dont l’exécution sur place a été réalisée à partir du 1er octobre 1981 et qui ont fait l’objet d’un examen de conformité conformément à l’ancien RGIE. Certaines dispositions dérogatoires peuvent s’appliquer seulement jusqu’à une date limite de réalisation sur place telle que définie dans les dispositions dérogatoires concernées :

> 2. Choix des dispositifs de protection à courant différentiel-résiduel
>
> Il est autorisé, en dérogation aux prescriptions:
>
> − du point a.3. de la sous-section 5.3.3.1., de laisser en service à l’origine de l’installation électrique un dispositif de protection à courant différentiel-résiduel dont la fonction de sectionnement est assurée par un dispositif sectionneur général installé dans le tableau principal et en amont du dispositif de protection à courant différentiel-résiduel, pour les installations électriques dont l’exécution sur place a été réalisée avant le 2 juillet 2003;
>
> − du point a. de la sous-section 5.3.5.3., de laisser en service les dispositifs de protection à courant différentiel-résiduel d’une intensité nominale inférieure à 40 A pour les installations électriques dont l’exécution sur place a été entamée avant le 16 septembre 1991;
>
> − du point e. de la sous-section 5.3.5.5., de laisser en service les dispositifs de protection à courant différentiel-résiduel d’une intensité nominale inférieure à 40 A ne portant pas le marquage spécifique ≪3000 A, 22,5 kA²s≫, pour les installations électriques dont l’exécution sur place a été entamée avant le 7 mai 2000 ou qui sont conformes à la NBN 819.

Définition, 8.1.1, p. 272 :

> Installation électrique existante: toute installation électrique ou partie d’une installation électrique dont l’exécution sur place a été entamée avant la date d’entrée en vigueur du présent Livre et qui n’a pas fait l’objet d’un contrôle de conformité conformément au chapitre 6.4. du présent Livre.

Constat de recherche : dans le texte intégral, « 5.3.5.3 » n'apparaît en dehors du sommaire et de la sous-section elle-même que dans les deux dérogations ci-dessus, qui portent sur l'intensité nominale (40 A) et non sur le type. Nous n'avons trouvé aucune dérogation portant sur le type A, ni en 8.2.1, ni en 8.2.2, ni en 6.5.8.

### Interprétations possibles

**A. Pas de dérogation, donc infraction.** Le Livre 1 énumère les dérogations admises pour l'existant ; le type A n'y figure pas, alors que la même phrase de 5.3.5.3 a (calibre de 40 A) fait l'objet d'une dérogation explicite. Le point 1 de 8.2.1 et de 8.2.2 n'admet le matériel ancien qu'« à condition que les caractéristiques du matériel électrique répondent aux prescriptions des installations domestiques du présent Livre ». Un type AC serait donc à remplacer.

**B. Maintien admis par le régime de l'existant.** Le matériel posé conformément aux règles de son époque peut rester en service (point 1 de 8.2.1 / 8.2.2 : « construit conformément aux règles de l'art au moment de son installation »), et l'exigence du type A ne s'appliquerait qu'aux installations neuves, aux modifications et extensions importantes (pour la partie concernée). Argument : l'absence de dérogation explicite viendrait de ce que l'exigence était déjà connue de la pratique, ou qu'elle n'est pas contrôlée sur l'existant.

**C. Selon la situation.** Infraction pour la partie neuve ou modifiée, maintien pour le reste ; ou infraction seulement si un appareil en aval peut produire des fuites à composante continue (5.3.5.3 f).

### Exemple concret d'installation

- Maison réalisée en 1998, examen de conformité selon l'ancien RGIE en 1998 (« installation électrique domestique ancien RGIE »).
- Tableau : interrupteur différentiel général 300 mA **type AC**, 40 A ; interrupteur différentiel 30 mA **type AC**, 40 A pour la salle de bain et le lave-linge.
- 2026 : ajout d'un circuit pour une pompe à chaleur (modification importante, contrôle limité à la partie ajoutée selon 6.4.7.3) ; visite de contrôle à la vente la même année.
- Questions pratiques : le différentiel général AC (en amont du nouveau circuit) est-il relevé comme infraction au contrôle de la partie ajoutée ? À la visite de contrôle ?

### Conséquences sur les articles

- **`differentiel`** : affirme que tous les différentiels domestiques sont au moins de type A (5.3.5.3 a), que le type AC ne convient pas dans une installation neuve et, pour l'existant, renvoie le lecteur à l'installateur ou à l'organisme agréé. En lecture A, l'article dirait que le type AC est à remplacer ; en lecture B, qu'il peut rester en service ; en lecture C, il distinguerait les cas.
- `organiser-tableau`, `lire-unifilaire`, `symboles-electriques` (mention du type sur le schéma) : à aligner si nécessaire.

### Conséquences sur le moteur

- Règle **R-RCD-TYPE-A** : aujourd'hui, elle ne signale qu'un différentiel 30 mA de type AC protégeant un lave-linge, un sèche-linge ou un lave-vaisselle. Partie neuve : non-conformité bloquante. Partie existante : recommandation, non bloquante.
- Correction déjà prévue indépendamment de votre réponse : signaler tout différentiel de type AC d'une **partie neuve** (général compris).
- Pour une **partie existante** : lecture A → non-conformité (bloquante ou non selon la gravité que vous retiendriez) ; lecture B → recommandation ; lecture C → selon la condition retenue.

### Décision attendue

A, B ou C (préciser la condition si C) ; pour l'existant, gravité souhaitée (infraction bloquante / infraction non bloquante / recommandation).

### Réponse du spécialiste

- [ ] A  [ ] B  [ ] C : …  [ ] Autre : …
- Existant : [ ] infraction bloquante  [ ] infraction non bloquante  [ ] recommandation
- Commentaire :

&nbsp;

---

## Question 3 — Réseau public 3 × 230 V : schéma IT et tension phase-terre

### Question

Une installation domestique alimentée par un réseau public 3 × 230 V (sans neutre distribué), dont les masses sont reliées à la prise de terre de l'habitation, doit-elle être considérée comme une installation en schéma IT au sens du RGIE ? Et, sur ce réseau, la tension entre un conducteur de ligne et la terre peut-elle atteindre 230 V lors d'un premier défaut à la terre ailleurs sur le réseau ?

### Texte réglementaire

RGIE, Livre 1, 2.2.1.2 b, p. 10 :

> b. Description des schémas mis à la terre en courant alternatif
>
> Les types de schémas mis à la terre suivants sont pris en considération dans le cadre de ce Livre:
>
> − le schéma TN avec ses trois variantes (TN-S, TN-C et TN-C-S);
>
> − le schéma TT;
>
> − le schéma IT.
>
> Lorsqu’un point du réseau est mis directement ou indirectement à la terre, le point neutre est de préférence mis à la terre.

RGIE, Livre 1, 2.2.1.2 b.3, p. 13-14 :

> b.3. Schéma IT
>
> Le schéma IT soit n’a aucun point du réseau (N ou L) relié directement à la terre, soit a un point du réseau (N ou L) relié à la terre à travers une impédance suffisamment élevée, les masses de l’installation électrique étant mises à la terre soit individuellement, soit en groupes, soit ensemble. Toutefois, les masses qui sont simultanément accessibles sont reliées au même conducteur de protection.

> En cas d’utilisation d’un point neutre artificiel, celui-ci peut être relié à la terre si l’impédance entre ce point neutre artificiel et la terre a une valeur suffisamment élevée.

RGIE, Livre 1, 4.2.3.4 d.1 et d.2, p. 94-95 :

> d. Mesures de protection dans les installations électriques selon un schéma IT
>
> d.1. Schéma IT
>
> Au moins un des dispositifs ou appareils suivants sont utilisés, à savoir:
>
> − les dispositifs de protection contre les surintensités;
>
> − les dispositifs de protection à courant différentiel-résiduel;
>
> − les dispositifs de protection sensibles à la tension de défaut;
>
> − les contrôleurs permanents d’isolement qui peuvent être associés à un système de localisation de défaut d’isolement;
>
> − les contrôleurs d'isolement à courant différentiel-résiduel;
>
> − les dispositifs de contrôle équipés d’une technologie assurant un niveau de contrôle au moins équivalent aux contrôleurs visés aux tirets 4 et 5.
>
> Le conducteur neutre éventuel est isolé et installé dans les mêmes conditions qu’un conducteur de ligne.
>
> Le matériel électrique alimenté entre les conducteurs de ligne et neutre est choisi de manière telle que son isolation corresponde au moins à la tension entre les conducteurs de ligne.
>
> d.2. Mesures à prendre en cas d'existence d'un premier défaut à la masse ou à la terre
>
> La coupure automatique de l'alimentation n'est pas obligatoire en cas de premier défaut franc entre un conducteur de ligne et une masse ou la terre, à condition que la formule suivante est satisfaite: Id× RE ≤ UL
>
> où: RE en Ω: résistance de dispersion de la prise de terre des masses de l’installation électrique; UL en V: tension limite conventionnelle absolue définie au tableau 2.3. à la section 2.4.1.; Id en A: courant de défaut en cas de premier défaut franc entre un conducteur de ligne et une masse ou la terre et tient compte des courants de fuite et de l'impédance globale de mise à la terre de l'installation électrique.
>
> S’il est satisfait à la condition visée au 1er alinéa, une surveillance permanente est prévue pour indiquer l’existence d'un premier défaut à la masse ou à la terre. Cette surveillance est réalisée par:
>
> − soit un contrôleur permanent d’isolement;
>
> − soit un contrôleur d'isolement à courant différentiel-résiduel;
>
> − soit un dispositif de contrôle équipé d’une technologie assurant un niveau de sécurité au moins équivalent à celui des contrôleurs mentionnés ci-avant.
>
> Cet appareil actionne un signal d’avertissement jusqu’à ce que les mesures nécessaires pour la recherche d’un premier défaut à la masse ou à la terre soient prises. Dès le moment où cet appareil a signalé l’existence de ce défaut, les mesures nécessaires sont prises sans retard pour remédier à la situation fautive.

RGIE, Livre 1, 4.4.4.5 (premier alinéa), p. 120 :

> Sous-section 4.4.4.5. Schéma IT à conducteur N distribué en courant alternatif – Protection du conducteur N
>
> Dans les installations électriques selon un schéma IT, le conducteur N n’est en principe pas distribué. Si toutefois, pour des raisons d’exploitation, il est nécessaire de distribuer le conducteur N, une détection de surintensité est prévue sur le conducteur N de tout circuit, cette détection devant entraîner la coupure de tous les conducteurs actifs du circuit correspondant, y compris le conducteur N.

RGIE, Livre 1, 4.5.3, p. 121 :

> Section 4.5.3. Limiteurs de surtensions en schéma IT
>
> Dans les schémas IT, un dispositif limiteur de surtension est, si nécessaire, connecté à l’origine de l’installation électrique entre la prise de terre de l’installation électrique et soit le conducteur neutre, soit un conducteur de ligne.

Le Livre 1 définit les schémas mais **ne dit pas** dans quel schéma le réseau public 3 × 230 V est exploité. Les prescriptions de raccordement des gestionnaires de réseau (Synergrid) n'ont pas été consultées.

### Interprétations possibles

**A. Schéma IT.** Le réseau 3 × 230 V n'a en général aucun point relié directement à la terre (ou un point relié par une impédance élevée) ; les masses de l'habitation sont mises à la terre localement. C'est la définition de 2.2.1.2 b.3. Conséquences : les dispositions de 4.2.3.4 d, 4.4.4.5 et 4.5.3 sont pertinentes ; la tension phase-terre n'est pas fixée par l'installation (de l'ordre de 230/√3 ≈ 133 V en régime équilibré sans défaut, jusqu'à environ 230 V en cas de défaut franc d'une autre phase sur le réseau).

**B. Schéma assimilé TT pour l'installation intérieure.** Du point de vue de l'installation domestique, protégée par un différentiel général de 300 mA au plus et des 30 mA (4.2.4.3 b), et sans contrôleur permanent d'isolement, l'installation serait traitée comme un TT : le réseau public relève du gestionnaire, et les exigences propres à l'IT (surveillance d'un premier défaut, 4.2.3.4 d.2) ne s'appliqueraient pas à l'installation intérieure.

**C. Selon le réseau.** Le mode de liaison à la terre du réseau 3 × 230 V varie selon le gestionnaire ou le quartier ; il faut le demander au gestionnaire, et le schéma déclaré sur l'unifilaire doit le refléter.

### Exemple concret d'installation

- Habitation à Bruxelles, réseau **3 × 230 V**, raccordement entre deux conducteurs de ligne, 40 A.
- Prise de terre : boucle de terre, 25 Ω ; différentiel général 300 mA type A, 40 A ; deux différentiels 30 mA.
- Question pratique : quel schéma (TT ou IT) faut-il inscrire sur le schéma unifilaire ? Un premier défaut d'une autre phase à la terre, sur le réseau, peut-il porter un conducteur de ligne de l'habitation à environ 230 V par rapport à la terre locale ?

### Conséquences sur les articles

- **`alternatif-mono-tri`** : dit que ce réseau « est en général exploité en schéma IT » et que la tension phase-terre « n'est pas fixe (environ 133 V en temps normal, jusqu'à 230 V si une autre phase est en défaut à la terre quelque part sur le réseau) ». Lecture A : confirmé. Lecture B ou C : à nuancer (« selon le gestionnaire de réseau »), tout en gardant l'avertissement de danger si vous le jugez fondé.
- **`parafoudre`** : relie le 3 × 230 V au schéma IT pour mentionner le limiteur de surtension « si nécessaire » de 4.5.3. À retirer ou nuancer en lecture B.
- `couleurs-des-fils`, `disjoncteur` : parlent du 3 × 230 V « sans neutre » (sans référence au schéma) ; non concernés sauf avis contraire.

### Conséquences sur le moteur

- Le projet comporte un champ « schéma de liaison à la terre » (TT, TN ou IT ; **TT par défaut**) qui est imprimé sur le dossier mais **n'est utilisé par aucune règle**. Le moteur reconnaît le 3 × 230 V uniquement par le texte de l'alimentation déclarée (pour la règle R-POLES-NO-NEUTRAL, question 1).
- Lecture A : proposer IT par défaut quand l'alimentation est 3 × 230 V, et éventuellement un constat non bloquant « schéma déclaré TT sur un réseau 3 × 230 V : à vérifier ». Lecture B : laisser TT. Lecture C : laisser le choix à l'utilisateur, avec une aide.
- Aucune règle bloquante n'est envisagée sur ce point.

### Décision attendue

A, B ou C ; confirmation (oui / non / ordre de grandeur différent) des valeurs « environ 133 V en régime normal, jusqu'à 230 V lors d'un premier défaut sur le réseau ».

### Réponse du spécialiste

- [ ] A  [ ] B  [ ] C  [ ] Autre : …
- Tensions phase-terre citées : [ ] exactes  [ ] inexactes : …
- Commentaire :

&nbsp;

---

## Question 4 — Câble 3G1,5 en va-et-vient avec le conducteur bleu en navette

### Question

Dans un circuit d'éclairage qui comporte un neutre, peut-on utiliser le conducteur bleu d'un câble multipolaire comme navette (ou comme retour de lampe) sur un tronçon qui ne transporte pas le neutre, par exemple le câble qui relie deux interrupteurs va-et-vient ?

### Texte réglementaire

RGIE, Livre 1, 5.1.6.2, p. 128-129 :

> Sous-section 5.1.6.2. Code de couleurs des conducteurs isolés
>
> Dans les systèmes de pose (conduits, gaines, gouttières, chambranles, goulottes, caniveaux...) et les canalisations électriques, les conducteurs isolés à l’aide de matériaux d’isolation solides repérés par la combinaison des couleurs verte et jaune sont utilisés soit comme conducteur de protection (PE) soit comme conducteur d’équipotentialité soit comme conducteur actif mis à la terre (PEN, PEM et PEL).
>
> La combinaison des couleurs précitées est présente sur toute la longueur du conducteur.
>
> L’utilisation des couleurs verte et/ou jaune, de même que l’emploi d’une de ces couleurs dans une combinaison multicolore est proscrite des matériaux d’isolation des conducteurs actifs à l’exclusion du conducteur actif mis à la terre (PEN, PEM et PEL).
>
> En dérogation aux prescriptions de l’alinéa précédent, les matériaux d’isolation de couleur jaune ou verte sont autorisés dans les canalisations électriques qui font partie des circuits de commande, contrôle, signalisation et mesure, pour autant que leur section soit inférieure à 1,5 mm².
>
> Les matériaux d’isolation de couleur bleue sont réservés au conducteur neutre dans les circuits comportant un tel conducteur.
>
> Lorsque le circuit ne comporte pas de conducteur neutre, le conducteur d’un câble multipolaire, dont le matériau d’isolation est de couleur bleue, peut être utilisé pour un autre usage, sauf comme conducteur de protection ou d’équipotentialité.

Définitions, 2.6.1, p. 32 :

> Circuit élémentaire: portion d’une installation électrique comprise entre deux dispositifs successifs de protection contre les surintensités (circuit principal ou circuit divisionnaire) ou existant en aval du dernier de ces dispositifs (circuit terminal).
>
> Circuit exclusivement dédié (aussi dénommé dans ce Livre circuit dédié): circuit élémentaire (circuit principal ou circuit terminal) destiné à l’alimentation exclusive d’un ou plusieurs appareils d’utilisation destiné(s) à un usage spécifique.
>
> Circuit: ensemble constitué de un ou plusieurs circuits élémentaires.

RGIE, Livre 1, 5.4.3.6 (dernier alinéa), p. 181 :

> Dans les installations domestiques, les canalisations électriques comportent un conducteur de protection, à l’exception de celles aboutissant aux interrupteurs, de celles à très basse tension de sécurité et de celles en amont du ou des différentiels généraux. Les interrupteurs pour usages domestiques doivent répondre soit aux normes y relatives homologuées par le Roi ou enregistrées par le NBN soit à des dispositions assurant au moins un niveau de sécurité équivalent à celui défini dans ces normes.

### Interprétations possibles

**A. Interdiction pour tout le circuit.** « Circuit » s'entend de l'ensemble du circuit élémentaire (définition de 2.6.1), de la protection jusqu'aux points d'utilisation. Un circuit d'éclairage phase-neutre « comporte » un neutre ; le bleu y est réservé au neutre dans toutes les canalisations du circuit, y compris le tronçon entre interrupteurs. La dérogation du dernier alinéa ne vise que les circuits sans neutre (par exemple sur un réseau 3 × 230 V). Il faut alors un câble sans bleu (par exemple trois conducteurs brun, noir, gris, admis sans conducteur de protection vers les interrupteurs par 5.4.3.6) ou un câble à plus de conducteurs.

**B. Appréciation par canalisation.** Le tronçon entre deux interrupteurs ne contient pas le neutre ; vu de ce câble, le « circuit » qu'il porte ne comporte pas de neutre, et le bleu peut y servir de navette (jamais de conducteur de protection). Argument : pratique répandue (câble 3G1,5 posé partout), et le risque de confusion est limité à l'intérieur d'une boîte d'interrupteur ; un repérage du conducteur (ruban) pourrait être exigé.

**C. Admis avec repérage.** Lecture A en principe, mais toléré si le conducteur bleu est repéré à ses extrémités (manchon, ruban) pour lever la confusion. Nous n'avons trouvé dans le Livre 1 aucune disposition qui prévoie un tel repérage pour un conducteur bleu (5.1.6.1 vise le repérage des machines, appareils fixes et ensembles d'appareillage) : cette lecture reposerait sur la pratique.

### Exemple concret d'installation

- Réseau 3N × 400 V ; circuit B (éclairage d'un couloir) : disjoncteur 16 A, câble XVB 3G1,5 depuis la boîte de dérivation.
- La lampe est au plafond ; un va-et-vient à chaque extrémité. Le câble entre les deux interrupteurs est un **XVB 3G1,5** : brun = navette 1, **bleu = navette 2**, vert-jaune = terre (ou non utilisé).
- Le neutre de la lampe arrive par un autre câble, directement depuis la boîte de dérivation.

### Conséquences sur les articles

- **`va-et-vient`**, **`va-et-vient-trois-points`**, **`couleurs-des-fils`**, `relais-connectes` : suivent la lecture A (« pas de bleu dans un circuit qui comporte un neutre »). En lecture B, il faudrait préciser que le bleu est admis comme navette sur un tronçon sans neutre ; en lecture C, ajouter le repérage.
- Exercices de câblage : le simulateur traite aujourd'hui un bleu utilisé hors neutre comme une **erreur** (exercice échoué).

### Conséquences sur le moteur

- Le moteur de contrôle des schémas **ne connaît pas les couleurs** des conducteurs : aucune règle n'est concernée.
- Seul le **simulateur des exercices** est concerné : lecture A → erreur (inchangé) ; lecture B → admis ; lecture C → avertissement « bleu non repéré ».

### Décision attendue

A, B ou C ; si C, quel repérage est attendu.

### Réponse du spécialiste

- [ ] A  [ ] B  [ ] C (repérage : …)  [ ] Autre : …
- Commentaire :

&nbsp;

---

## Question 5 — Exception de 4.5.4 (télécommunication) dans une habitation

### Question

L'exception du second alinéa de 4.5.4 (« lieux ordinaires qui ne sont pas considérés comme des lieux accessibles au public ») s'applique-t-elle aux pièces d'une habitation, de sorte que des conducteurs de télécommunication (câble réseau informatique, téléphone, bus domotique) puissent y être posés côte à côte avec des conducteurs d'énergie sans écran ? Et un bus domotique en TBTS relève-t-il de 4.5.4, de 4.2.5.3 c, ou des deux ?

### Texte réglementaire

RGIE, Livre 1, 4.5.4, p. 121 :

> Section 4.5.4. Conduits communs aux conducteurs d'énergie et de télécommunication
>
> Il est interdit de placer côte à côte, sans interposition d’un écran, des conducteurs d’énergie et des conducteurs de télécommunication, sauf si les uns et les autres sont constitués de câbles. Cette exigence ne s’applique pas aux conducteurs de télécommunication lorsqu’ils relient le matériel électrique situé dans les lieux de service électrique ou dans des lieux ordinaires qui ne sont pas considérés comme des lieux accessibles au public.

Définitions, 2.2.1.1, p. 10 :

> Lieu du service électrique: soit un local, soit un emplacement clôturé qui sert essentiellement ou exclusivement à l’exploitation des installations électriques.

> Lieu ordinaire: soit un local, soit un emplacement qui n’est pas un lieu du service électrique.
>
> Lieu accessible au public (local ou emplacement): un lieu accessible à tous, sans autorisation préalable, que l’accès en soit permanent, temporaire ou subordonné à certaines conditions.

Définition, 2.7.1, p. 35 :

> Lignes ou câbles de télécommunication: on entend par lignes ou câbles de télécommunication les lignes ou câbles servant exclusivement à la téléphonie, à la télégraphie, à la télésignalisation, aux télémesures, aux télécommandes, à la télédistribution (y compris l’alimentation des amplificateurs) et en général à la transmission d’informations ou de données ainsi qu’à tout système de télécommunication de quelque nature qu’il soit.

RGIE, Livre 1, 4.2.5.3 b et c, p. 106 :

> b. Parties actives
>
> Les parties actives des circuits TBTS et TBTP sont séparées physiquement les unes des autres et d’autres circuits.
>
> Des mesures sont prises pour réaliser une séparation de protection; cette règle n’est pas d’application à la liaison de la TBTP à la terre.
>
> c. Canalisations électriques
>
> Afin de réaliser la séparation de protection mentionnée au point b., une des dispositions suivantes est prise:
>
> − une séparation physique d’au moins 10 mm entre les conducteurs des circuits TBTS et TBTP et les conducteurs d’autres circuits;
>
> − les conducteurs des circuits TBTS et TBTP doivent être munis, en plus de leur isolation principale, d’une isolation supplémentaire (gaine, conduit...);
>
> − un câble multiconducteur ou un groupement de conducteurs peut contenir des circuits à des tensions différentes pourvu que les conducteurs des circuits TBTS et TBTP soient isolés, soit individuellement, soit collectivement, pour la tension la plus élevée mise en jeu.

RGIE, Livre 1, 5.2.1.3 (deux premiers alinéas), p. 130 :

> Sous-section 5.2.1.3. Pose des conducteurs
>
> Un câble multipolaire ou un groupement de conducteurs peut contenir des circuits à tensions différentes à condition que les conducteurs soient isolés, soit individuellement, soit collectivement, pour la tension la plus élevée présente.
>
> Dans ce cas, des dispositions conformes aux règles de l’art sont prises pour éviter qu’un éventuel contact galvanique entre des conducteurs appartenant à des circuits différents ne compromette la sécurité des personnes ainsi que la conservation des biens.

### Interprétations possibles

**A. L'exception couvre l'habitation.** Une pièce d'habitation est un « lieu ordinaire » (elle n'est pas un lieu du service électrique) et n'est pas « accessible à tous, sans autorisation préalable ». L'interdiction de 4.5.4 ne s'appliquerait donc pas aux conducteurs de télécommunication qui relient du matériel situé dans le logement. Restent applicables : 4.2.5.3 c pour un circuit TBTS (séparation de protection) et 5.2.1.3 (isolation pour la tension la plus élevée).

**B. L'exception est plus étroite.** Elle viserait les liaisons internes à des locaux techniques ou professionnels non ouverts au public, pas les logements ; en habitation, conducteurs d'énergie et de télécommunication ne seraient posés côte à côte qu'avec un écran ou si les uns et les autres sont des câbles.

**C. Question de qualification.** Un bus domotique alimenté en TBTS est d'abord un circuit TBTS (4.2.5.3 c s'applique quoi qu'il arrive) ; 4.5.4 viserait les lignes de télécommunication extérieures à l'installation électrique (téléphonie, télédistribution, réseau informatique). La réponse à la première question ne changerait donc rien pour le bus.

### Exemple concret d'installation

- Maison unifamiliale. Un tube annelé de 20 mm contient trois conducteurs **H07V-U 2,5 mm²** (circuit de prises, 20 A) et un **câble réseau informatique** catégorie 6 non blindé.
- Dans un autre tube : un câble **bus KNX** (TBTS, environ 30 V continu selon les fabricants) avec trois conducteurs H07V-U 1,5 mm² d'un circuit d'éclairage.
- Ces deux tubes sont-ils admis sans écran ni séparation ?

### Conséquences sur les articles

- **`bus-knx`** et **`preparer-cablage-domotique`** : ne citent que 4.2.5.3 c (séparation de protection du circuit TBTS) et recommandent, par bonne pratique, des tubes distincts. En lecture B, il faudrait ajouter l'interdiction de 4.5.4 pour les câbles de données en logement ; en lecture A ou C, préciser que 4.5.4 ne s'applique pas en habitation.
- `sonnette` (fils de sonnette en TBTS, 4.2.5.3 b et c) : non concerné par 4.5.4 sauf en lecture B si les fils de sonnette sont vus comme « télésignalisation ».

### Conséquences sur le moteur

- Aucune règle du moteur ne porte sur le contenu des tubes ni sur les circuits de télécommunication. Pas de changement envisagé, quelle que soit la réponse (le contenu des conduits n'est pas modélisé).

### Décision attendue

A, B ou C ; et, pour le bus domotique : 4.5.4 / 4.2.5.3 c / les deux.

### Réponse du spécialiste

- [ ] A  [ ] B  [ ] C  [ ] Autre : …
- Bus domotique TBTS : [ ] 4.5.4  [ ] 4.2.5.3 c  [ ] les deux
- Commentaire :

&nbsp;

---

## Question 6 — Module domotique caché : une « unité de commande » à représenter ?

### Question

Un module domotique encastré (micro-module relais connecté placé derrière un interrupteur, dans une boîte ou dans un luminaire) qui commande un point lumineux constitue-t-il une « unité de commande » au sens de 3.1.2.1 a, à identifier et numéroter sur le schéma unifilaire et le plan de position ? Sinon, que faut-il représenter ?

### Texte réglementaire

RGIE, Livre 1, 3.1.2.1 a, p. 61 :

> Sous-section 3.1.2.1. Prescriptions générales
>
> a. Installations électriques domestiques
>
> Pour toute installation électrique domestique nouvelle ou pour toute modification importante ou toute extension importante d'une installation électrique domestique existante, le responsable de l’exécution des travaux établit les schémas unifilaires et les plans de position de l’installation électrique.

> Les symboles à utiliser pour établir les schémas unifilaires et les plans de position d'une installation électrique domestique sont mentionnés dans le chapitre 2.13. S’il n’y a aucun symbole enregistré dans le tableau 2.23., tout autre symbole clairement identifiable et défini dans la légende des schémas unifilaires et des plans de position, peut être utilisé sur les schémas unifilaires et les plans de position d’une installation électrique domestique.
>
> Pour le schéma unifilaire (figure 3.1.): Chaque circuit élémentaire est identifié par une lettre majuscule de l'alphabet. Chaque point lumineux, chaque socle de prise de courant et chaque unité de commande sont identifiés par un numéro donnant l'ordre dans lequel on rencontre ces éléments dans le circuit élémentaire en partant du dispositif de protection contre les surintensités, situé en amont du circuit. La tension et la nature du courant sont mentionnées sur le schéma unifilaire.
>
> Pour le plan de position (figure 3.2.): Chaque point lumineux, chaque socle de prise de courant et chaque unité de commande sont identifiés par la lettre attribuée au circuit élémentaire dans lequel ces éléments sont insérés et par le numéro d'ordre qui est attribué à ces éléments au schéma unifilaire de l'installation électrique. Chaque interrupteur et chaque unité de commande sont identifiés par la lettre du circuit dans lequel ils se trouvent et le numéro d'ordre du point lumineux ou de l'appareil qu'il commande.

RGIE, Livre 1, tableau 2.23, rubrique J « Domotique », p. 57 (texte seul ; les dessins des symboles ne sont pas reproduits) :

> J. Domotique
>
> L’unité de commande est représentée par un rectangle Ex. : qui comprend deux parties :
>
> - partie inférieure : le symbole de base
>
> Ex. : un interrupteur, un socle de prise de courant avec interrupteur
>
> - partie supérieure : le type de commande de l’unité
>
> Ex. :

RGIE, Livre 1, 3.1.2.2 a, p. 64 :

> a. Installations électriques domestiques
>
> Les schémas unifilaires reprennent au moins:
>
> − les caractéristiques des canalisations électriques: type, section, nombre des conducteurs;
>
> − le mode de pose des canalisations électriques;
>
> − le type et les caractéristiques des dispositifs de protection à courant différentiel-résiduel;
>
> − le type et les caractéristiques des dispositifs de protection contre les surintensités;
>
> − les interrupteurs;
>
> − les boîtes de connexion;
>
> − les boîtes de dérivation;
>
> − les socles de prise de courant;
>
> − les points lumineux;
>
> − les machines et appareils fixes;
>
> − les sources (transformateur, panneau solaire, onduleur, batterie, …).

RGIE, Livre 1, 3.1.2.3 a, p. 65 :

> a. Installations électriques domestiques
>
> Les plans de position indiquent la position:
>
> − des tableaux de répartition et de manoeuvre;
>
> − des boîtes de connexion;
>
> − des boîtes de dérivation;
>
> − des socles de prise de courant;
>
> − des points lumineux;
>
> − des interrupteurs;
>
> − des machines et appareils fixes;
>
> − des sources (transformateur, panneau solaire, onduleur, batterie, …), dont mention est faite sur le schéma unifilaire.

Le Livre 1 ne contient pas de définition de « unité de commande » en dehors de ces passages (recherche dans le texte intégral).

### Interprétations possibles

**A. Oui, unité de commande.** Le module modifie la commande du point lumineux (commande sans fil, programmée, par détection) : c'est précisément ce que la rubrique J représente. Il reçoit la lettre du circuit et un numéro, et figure sur le plan de position à son emplacement réel.

**B. Non : seul le point de commande visible est représenté.** L'unité de commande de la rubrique J est un appareil de commande apparent (interrupteur, socle avec interrupteur) dont on indique le type de commande. Le module caché est représenté par le symbole de l'interrupteur surmonté du type de commande ; la boîte qui le contient figure comme boîte de connexion (3.1.2.2 a, 3.1.2.3 a) ; le module lui-même n'est pas exigé.

**C. Non exigé, mais recommandé.** Ni A ni B n'est imposé ; le texte laisse le choix, la représentation du module étant une bonne pratique pour le dépannage.

### Exemple concret d'installation

- Circuit C (éclairage du séjour), disjoncteur 16 A, XVB 3G1,5 ; point lumineux C3 commandé par l'interrupteur C3.
- Un **micro-module relais Wi-Fi** (230 V, 10 A) est ajouté dans la boîte d'encastrement de l'interrupteur : la lampe se commande par l'interrupteur et par une application.
- Que doit montrer l'unifilaire : seulement « interrupteur C3 » avec le type de commande « sans fil » ? Un élément supplémentaire numéroté (C4) ? La boîte de connexion ?

### Conséquences sur les articles

- **`relais-connectes`** : recommande de représenter le point commandé avec le symbole d'« unité de commande » de la rubrique J et, par bonne pratique, le module ; sur le plan, la boîte qui le contient. Lecture A : le module devient obligatoire. Lecture B : supprimer « le module lui-même » des obligations. Lecture C : inchangé.
- `domotique-introduction`, `volets-domotique`, `lire-unifilaire`, `plan-de-position`, `symboles-electriques` : à aligner.

### Conséquences sur le moteur

- L'éditeur dispose d'un élément « domotique » et d'options « type de commande » (bouton-poussoir, sans fil, programmée, détection, extension) sur les interrupteurs et les prises. La numérotation automatique donne à un élément « domotique » un **numéro propre** dans le circuit, comme à un point lumineux ; un interrupteur prend le numéro du point qu'il commande.
- Aucune règle ne vérifie la présence des modules. Lecture A : conserver la numérotation propre ; éventuellement constat documentaire non bloquant si un point « sans fil » n'a pas d'unité dessinée. Lecture B : un module caché devrait prendre le numéro du point commandé (comme un interrupteur) plutôt qu'un numéro propre. Lecture C : rien.

### Décision attendue

A, B ou C ; en lecture A, indiquer si le module reçoit un numéro propre ou celui du point commandé.

### Réponse du spécialiste

- [ ] A (numéro : [ ] propre  [ ] celui du point commandé)  [ ] B  [ ] C  [ ] Autre : …
- Commentaire :

&nbsp;

---

## Question 7 — Groupe de volets sous une même commande : combien de points ?

### Question

Sur un circuit terminal qui alimente des socles de prise de courant et des volets roulants, comment compte-t-on les volets dans la limite de huit de 5.3.5.2 b : un point par volet, ou un point par « appareil de manœuvre commun », lorsque plusieurs volets sont commandés ensemble par une commande centrale tout en gardant chacun sa commande individuelle ?

### Texte réglementaire

RGIE, Livre 1, 5.3.5.2 b, p. 167 :

> Les socles de prise de courant, à l’exception de ceux à TBTS, comportent tous un contact de terre relié au conducteur de protection de la canalisation électrique, sauf si le socle de prise de courant est alimenté à travers un transformateur de séparation des circuits individuel conforme aux dispositions de la sous-section 4.2.3.3., c. Ils sont d’un type tel que mentionné au point a.
>
> Le nombre de socles de prise de courant simples ou multiples est limité à huit par circuit terminal.
>
> Les circuits alimentant les appareils d’éclairage sont au moins au nombre de deux circuits distincts pour les unités d’habitation qui comprennent plus de deux locaux et/ou emplacements.
>
> Les socles de prise de courant, les appareils d’éclairage et d’autres appareils fixes, à l’exception des appareils fixes des circuits dédiés et visés dans la sous-section 5.2.1.2., peuvent être alimentés par un même circuit terminal. Les prescriptions applicables à ce circuit sont celles relatives aux circuits alimentant des socles de prise de courant, un appareil fixe ou un ensemble d’appareils fixes commandé par un appareil de manœuvre commun étant assimilé à un socle de prise de courant.

RGIE, Livre 1, 4.2.4.3 b (neuvième alinéa, extrait), p. 101 :

> Si la résistance de dispersion de la prise de terre est supérieure à 30 ohms, le nombre de dispositifs de protection à courant différentiel-résiduel à haute ou très haute sensibilité visé au 5ème alinéa est au moins de deux. Chaque dispositif de protection à courant différentiel-résiduel reprend au maximum seize socles de prise de courant simples ou multiples. Un appareil fixe ou un ensemble d’appareils fixes commandé par un appareil de manœuvre commun est assimilable à un socle de prise de courant.

RGIE, Livre 1, 5.3.3.2 d, p. 159 :

> d. Emplacement
>
> En particulier, tout appareil d’utilisation ou machine électrique est manœuvré par un dispositif de commande.
>
> Ce dispositif est nécessaire même lorsque le fonctionnement de la machine électrique ou de l’appareil d’utilisation électrique est dépendant d’un relais, d’un thermostat ou de tout autre organe analogue.
>
> Toutefois, il est admis:
>
> − qu’un même dispositif commande plusieurs machines ou appareils électriques dont le fonctionnement est simultané;
>
> − qu’un dispositif de commande sur le circuit d’alimentation d’une machine ou d’un appareil électrique ne soit pas prévu si cette machine ou cet appareil comportent eux-mêmes un interrupteur général;
>
> − qu’un tel dispositif ne soit pas requis pour un appareil domestique comportant plusieurs éléments, chauffants ou non, commandés chacun par un interrupteur.

RGIE, Livre 1, 8.2.2 point 6 (premier alinéa), p. 278 (dérogation pour les installations ancien RGIE) :

> Il est autorisé, en dérogation aux prescriptions du point b. de la sous-section 5.3.5.2., de laisser en service, par circuit terminal, un nombre supérieur à huit socles de prise de courant simples ou multiples à condition que la puissance des appareils fixes et à poste fixe raccordés ne dépasse pas la puissance admissible dans la canalisation électrique.

### Interprétations possibles

**A. Un point par volet.** Chaque volet a son propre inverseur : c'est un « appareil fixe » avec son appareil de manœuvre ; la commande centrale s'ajoute sans fusionner les volets. Quatre volets = quatre points.

**B. Un point par groupe.** Les volets reliés à une même commande centrale forment « un ensemble d'appareils fixes commandé par un appareil de manœuvre commun » : un seul point, même si chacun garde une commande individuelle.

**C. Un point par groupe seulement sans commande individuelle.** Le groupe compte pour un point s'il n'est commandé que par l'appareil commun ; dès qu'un volet a sa propre commande, il compte pour un point.

### Exemple concret d'installation

- Circuit D : disjoncteur 20 A, câble XVB 3G2,5, derrière un différentiel 30 mA.
- Sur ce circuit : **5 socles de prise** et **4 volets roulants** (moteur 230 V, environ 1 A), chacun avec son inverseur de volet ; un **relais de centralisation** permet de les monter ou descendre tous ensemble depuis un bouton à l'entrée.
- Total : 9 points (A), 6 points (B), 9 points (C). La limite de 8 est dépassée en A et C, respectée en B.

### Conséquences sur les articles

- **`volet-roulant`** : dit que « chaque volet avec sa commande compte comme une prise dans la limite de huit » (proche de A ou C). À ajuster en lecture B.
- `commande-groupee-volets` : ne traite pas du comptage ; une phrase serait ajoutée.

### Conséquences sur le moteur

- Règle **R-SOCKET-MAX** (non-conformité, gravité faible ; bloquante dans une partie neuve, recommandation dans une partie existante) : aujourd'hui elle **ne compte que les prises** ; les volets, appareils fixes et points lumineux d'un circuit mixte ne sont pas comptés (anomalie M5 de l'audit, à corriger).
- La correction prévue comptera les appareils fixes d'un circuit qui comporte au moins une prise. Votre réponse décide comment compter un groupe : A → un par moteur ; B → un par commande commune ; C → selon la présence de commandes individuelles.

### Décision attendue

A, B ou C.

### Réponse du spécialiste

- [ ] A  [ ] B  [ ] C  [ ] Autre : …
- Commentaire :

&nbsp;

---

## Question 8 — Prise double faite de deux socles simples : un ou deux points ?

### Question

Dans la limite de huit « socles de prise de courant simples ou multiples » par circuit terminal (5.3.5.2 b), deux socles simples juxtaposés dans une boîte double (deux mécanismes distincts sous une plaque double) comptent-ils pour un point ou pour deux ? La réponse est-elle la même qu'un socle double monobloc ?

### Texte réglementaire

RGIE, Livre 1, 5.3.5.2 b (deuxième alinéa), p. 167 :

> Le nombre de socles de prise de courant simples ou multiples est limité à huit par circuit terminal.

RGIE, Livre 1, tableau 2.23, rubrique F « Socles de prise de courant », p. 53 (texte seul) :

> Socle de prise de courant
>
> Symbole général
>
> Socle pour plusieurs prises de courant (figuré pour trois)

La même formule « socles de prise de courant simples ou multiples » figure en 4.2.4.3 b (seize socles par différentiel lorsque la résistance de terre dépasse 30 Ω, p. 101), en 6.5.8.1 point 1 et en 8.2.1 / 8.2.2. Le Livre 1 ne définit pas « socle multiple ».

### Interprétations possibles

**A. Un point par emplacement.** Ce qui compte est l'emplacement (une boîte, une plaque) : deux socles simples juxtaposés forment, comme un socle double monobloc, un « socle multiple ». Un point.

**B. Un point par appareil.** Un « socle multiple » est un appareil unique comportant plusieurs prises (monobloc) ; deux mécanismes distincts sont deux socles simples, donc deux points, même sous une plaque commune.

### Exemple concret d'installation

- Cuisine, circuit E : disjoncteur 20 A, XVB 3G2,5, derrière un différentiel 30 mA.
- 4 **prises doubles monobloc**, 3 **boîtes doubles** avec deux socles simples chacune, 1 socle simple.
- Total : 8 points (A) ou 11 points (B). Le circuit est conforme en A, non conforme en B.

### Conséquences sur les articles

- **`prise-de-courant`** : dit qu'« une prise double ou triple, qui forme un seul socle multiple, compte donc pour un point », avec l'exemple d'une cuisine « avec six prises doubles et deux simples ». Lecture B : préciser que cela ne vaut que pour un socle monobloc.
- `organiser-tableau`, lexique (« socle ») : à aligner.

### Conséquences sur le moteur

- Règle **R-SOCKET-MAX** (voir question 7) : le moteur compte un point par **symbole de prise dessiné** ; un symbole peut porter un nombre de prises (« prise double » = 1 point). Deux symboles distincts dessinés dans la même boîte comptent pour deux. Lecture A : il faudrait regrouper les socles d'une même boîte (donnée de boîte à ajouter) ou conseiller de les dessiner comme une prise multiple. Lecture B : inchangé.

### Décision attendue

A ou B.

### Réponse du spécialiste

- [ ] A  [ ] B  [ ] Autre : …
- Commentaire :

&nbsp;

---

## Question 9 — Redémarrage automatique d'un ouvrant motorisé domestique

### Question

Le second alinéa de 5.3.3.2 e (empêcher la réalimentation automatique d'un moteur dont le redémarrage peut provoquer un danger) s'applique-t-il aux volets roulants, fenêtres, coupoles et portes motorisés d'une habitation ? Si oui, une fermeture programmée (horloge, capteur de pluie, scénario domotique) qui reprend son mouvement au retour de la tension est-elle visée ?

### Texte réglementaire

RGIE, Livre 1, 5.3.3.2 e, p. 159 :

> e. Dispositifs de commande
>
> En plus des dispositions prévues ci-avant, les moteurs sont munis, d’après les règles de l’art, des dispositifs appropriés de commande si leur démarrage sans ces dispositifs perturbe anormalement le fonctionnement des autres utilisations.
>
> Sauf pour des raisons prépondérantes de sécurité, les dispositifs de commande des moteurs sont tels qu’après un arrêt, soit empêchée la réalimentation automatique des moteurs dont le redémarrage est alors susceptible de provoquer un danger pour les personnes.

RGIE, Livre 1, 4.6.1 (premier alinéa), p. 121 :

> Section 4.6.1. Protection contre les effets de la baisse de tension
>
> Des dispositions sont prises pour qu’une baisse de tension importante ou sa disparition et son rétablissement ne puissent créer un danger pour les personnes et les biens.

Les normes de produit des moteurs et automatismes d'ouvrants (et, pour le désenfumage, la réglementation incendie) n'ont pas été consultées.

### Interprétations possibles

**A. Applicable.** Un ouvrant motorisé exerce une force réelle ; un redémarrage inattendu (fermeture sur une main, un enfant) est un danger pour les personnes. L'installation doit empêcher la reprise automatique après une coupure, sauf « raisons prépondérantes de sécurité » (par exemple désenfumage). Une fermeture programmée ou par capteur après rétablissement serait visée, sauf sécurité anti-pincement intégrée reconnue.

**B. Non applicable aux ouvrants domestiques courants.** La disposition viserait les machines (moteurs industriels, outils) ; un volet ou une coupole domestique, à faible force et à mouvement lent, souvent muni de fins de course et d'une détection d'obstacle, relève des normes de produit. Le danger d'un redémarrage n'est pas « susceptible » au sens visé ; l'installation n'a rien à prévoir.

**C. Appréciation au cas par cas.** Applicable seulement si l'ouvrant peut blesser (porte de garage, coupole à portée de main, fenêtre accessible) et si le produit n'a pas de protection intégrée ; à apprécier par l'installateur selon la notice.

### Exemple concret d'installation

- Coupole de toit motorisée 230 V (moteur 60 W) dans une salle de bain, commandée par un inverseur et par un **capteur de pluie** qui la ferme automatiquement ; volet roulant de chambre d'enfant fermé par une **horloge** à 20 h.
- Coupure secteur à 19 h 55, retour à 20 h 05 : la coupole se ferme (pluie), le volet descend (rattrapage de l'horloge).
- Faut-il un dispositif qui empêche ces mouvements au rétablissement de la tension ?

### Conséquences sur les articles

- **`fenetre-motorisee`** : cite déjà 5.3.3.2 e (« un moteur dont le redémarrage peut mettre une personne en danger ne se remette pas en marche tout seul après un arrêt ») et conseille d'y penser pour une fermeture automatique. Lecture B : supprimer ou réduire à une recommandation de bonne pratique. Lecture A : renforcer et étendre à `volet-roulant`, `moteur-de-volet`, `volets-domotique`.

### Conséquences sur le moteur

- Aucune règle du moteur n'est concernée ; aucun constat n'est envisagé (le comportement des automatismes n'est pas modélisé). Au plus, en lecture A, un rappel non bloquant pour les moteurs commandés par un relais, une horloge ou un module domotique.

### Décision attendue

A, B ou C ; en A ou C, préciser si une fermeture programmée au retour de la tension est visée.

### Réponse du spécialiste

- [ ] A  [ ] B  [ ] C  [ ] Autre : …
- Fermeture programmée au retour de la tension visée : [ ] oui  [ ] non
- Commentaire :

&nbsp;

---

## Question 10 — Contrôle d'une installation réalisée par un particulier

### Question

Un particulier qui réalise lui-même l'installation électrique de son habitation (sans entreprise, sans numéro de TVA) peut-il la faire soumettre au contrôle de conformité avant mise en usage par un organisme agréé ? Que doit alors mentionner la rubrique « qualité » du responsable de l'exécution des travaux sur les schémas ?

### Texte réglementaire

RGIE, Livre 1, 3.1.2.1 a (deuxième et troisième alinéas), p. 61 :

> Les nom, qualité, numéro de T.V.A. (si d’application) du responsable de l’exécution des travaux sont mentionnés sur les schémas unifilaires et les plans de position. L'adresse du lieu où est placée cette installation électrique est mentionnée sur les schémas unifilaires et les plans de position.
>
> En cas de conformité de l’installation électrique lors du contrôle au présent Livre, le responsable de l’exécution des travaux, de même que l'organisme agréé, signent et datent les schémas unifilaires et les plans de position pour réception et pour approbation.

RGIE, Livre 1, 6.4.1, p. 201 :

> Section 6.4.1. Généralités
>
> Toute installation à basse tension ou très basse tension telle que définie dans les parties 1. et 2. du présent Livre, même celle alimentée par une installation privée comme les groupes électrogènes fixes, transportables ou mobiles, excepté toutefois les installations à très basse tension continue alimentées exclusivement par des piles, accumulateurs, batteries d’accumulateurs qui ne sont pas visées au chapitre 7.103., cellules photovoltaïques ou autres sources similaires, fait l’objet d’un contrôle de conformité aux prescriptions du présent Livre avant la mise en usage de l’installation.
>
> Ces contrôles de conformité sont réalisés sur place soit par un organisme agréé, soit par l’autorité habilitée ou chargée de le faire selon les prescriptions du chapitre 6.3.
>
> Le contrôle de conformité des installations électriques doit être réalisé hors tension et comprend:
>
> − les contrôles administratifs;
>
> − les contrôles visuels;
>
> − les contrôles par essais;
>
> − les contrôles par mesures.

RGIE, Livre 1, 6.4.6.4 b.1 d, p. 202 :

> d) les nom, prénom, numéro de T.V.A. (si d’application) de la ou des personnes responsables de l'exécution du travail;

RGIE, Livre 1, 6.4.7.3 (premier alinéa), p. 204 :

> Sous-section 6.4.7.3. Modification ou extension
>
> Toute modification importante ou extension importante d’une installation à basse ou très basse tension alternative ou continue fait l’objet d’un contrôle de conformité aux prescriptions du présent Livre avant la mise en usage de la dite modification ou extension. Ce contrôle de conformité est limité à la partie ajoutée ou modifiée de l’installation.

Définition, 2.11.2, p. 47 :

> Modification importante ou extension importante: modification ou extension d’une installation électrique qui a un impact supplémentaire (pas encore couvert par un contrôle de conformité) sur la sécurité des personnes ou des biens.
>
> Exemples de modification importante ou d’extension importante: modification du schéma mis à la terre, dépassement de la puissance de court-circuit admissible pour le matériel installé, remplacement non-identique d’un tableau de répartition et de manœuvre, ajout d’un circuit dans une installation domestique, …

Nous n'avons trouvé dans le Livre 1 ni exigence de qualification de la personne qui exécute une installation domestique, ni mention explicite du cas du particulier.

### Interprétations possibles

**A. Oui, explicitement compatible.** Le contrôle porte sur l'installation ; toute installation y est soumise (6.4.1) ; la mention « numéro de T.V.A. (si d'application) » montre que le responsable peut ne pas être assujetti. Le particulier signe comme responsable de l'exécution ; « qualité » = par exemple « propriétaire, exécution personnelle ».

**B. Oui en pratique, mais hors du texte.** Le Livre 1 ne l'interdit pas mais ne l'organise pas non plus ; l'acceptation et les modalités (schémas, signature, qualité) dépendent de l'organisme agréé et éventuellement d'autres réglementations (assurances, réglementations régionales) non couvertes ici. L'article devrait le dire avec prudence.

### Exemple concret d'installation

- Maison rénovée entièrement par son propriétaire, salarié, sans activité d'indépendant ; installation neuve complète (tableau, 14 circuits), schémas faits avec Voltaplan.
- Il demande le contrôle de conformité à un organisme agréé. Sur les schémas : nom du propriétaire ; qualité : ? ; numéro de TVA : sans objet.

### Conséquences sur les articles

- **`controle-organisme-agree`** : la FAQ répond « Oui : le contrôle porte sur l'installation, pas sur la personne qui l'a réalisée », en demandant des schémas complets et une installation conforme. Lecture A : inchangé, avec la référence 3.1.2.1 a. Lecture B : réponse nuancée (« le RGIE ne l'interdit pas ; renseignez-vous auprès de l'organisme »).
- `dossier-installation` : rubrique « qualité » à illustrer.

### Conséquences sur le moteur

- Règles documentaires **R-DOC-INSTALLER** (nom du responsable) et **R-DOC-QUALITY** (qualité du responsable) : « informations insuffisantes », bloquantes pour un dossier de partie neuve si le champ est vide. Elles n'exigent pas de numéro de TVA. Votre réponse ne change pas la règle ; elle permet d'adapter l'aide (exemple de qualité pour un particulier).

### Décision attendue

A ou B ; formulation recommandée pour la « qualité ».

### Réponse du spécialiste

- [ ] A  [ ] B  [ ] Autre : …
- Formulation de la qualité : …
- Commentaire :

&nbsp;

---

## Question 11 — Essai des différentiels alors que le contrôle se fait « hors tension »

### Question

Le contrôle de conformité « doit être réalisé hors tension » (6.4.1) et comprend des « contrôles par essais » dont les modalités peuvent être fixées par arrêté (6.4.4). Un essai de déclenchement des dispositifs différentiels (à l'appareil de mesure, sous tension) fait-il partie du contrôle de conformité ou de la visite de contrôle, et comment concilier cet essai avec la mention « hors tension » ? Quels arrêtés fixent aujourd'hui le contenu des contrôles par essais ?

### Texte réglementaire

RGIE, Livre 1, 6.4.1 à 6.4.4, p. 201 :

> Section 6.4.1. Généralités
>
> Toute installation à basse tension ou très basse tension telle que définie dans les parties 1. et 2. du présent Livre, même celle alimentée par une installation privée comme les groupes électrogènes fixes, transportables ou mobiles, excepté toutefois les installations à très basse tension continue alimentées exclusivement par des piles, accumulateurs, batteries d’accumulateurs qui ne sont pas visées au chapitre 7.103., cellules photovoltaïques ou autres sources similaires, fait l’objet d’un contrôle de conformité aux prescriptions du présent Livre avant la mise en usage de l’installation.
>
> Ces contrôles de conformité sont réalisés sur place soit par un organisme agréé, soit par l’autorité habilitée ou chargée de le faire selon les prescriptions du chapitre 6.3.
>
> Le contrôle de conformité des installations électriques doit être réalisé hors tension et comprend:
>
> − les contrôles administratifs;
>
> − les contrôles visuels;
>
> − les contrôles par essais;
>
> − les contrôles par mesures.
>
> Section 6.4.2. Contrôles administratifs
>
> Les Ministres ayant l’Énergie et le bien-être des travailleurs lors de l’exécution de leur travail dans leurs attributions peuvent fixer, par arrêté et chacun en ce qui le concerne, des modalités relatives à l’exécution des contrôles administratifs.
>
> Section 6.4.3. Contrôles visuels
>
> Les Ministres ayant l’Énergie et le bien-être des travailleurs lors de l’exécution de leur travail dans leurs attributions peuvent fixer, par arrêté et chacun en ce qui le concerne, des modalités relatives à l’exécution des contrôles visuels.
>
> Section 6.4.4. Contrôles par essais
>
> Les Ministres ayant l’Énergie et le bien-être des travailleurs lors de l’exécution de leur travail dans leurs attributions peuvent fixer, par arrêté et chacun en ce qui le concerne, des modalités relatives à l’exécution des contrôles par essais.

RGIE, Livre 1, 6.4.6.4 b.4 (premier alinéa), p. 203 (mise en forme des retraits rétablie) :

> b.4. Contrôle
>
> Le rapport de contrôle de conformité contient la valeur de la résistance de dispersion de la prise de terre ainsi que la valeur du niveau d'isolement général. Il certifie l'adéquation:
>
> a) entre les dispositifs de protection à courant différentiel-résiduel installés et la valeur de la résistance de dispersion de la prise de terre;
>
> b) entre les dispositifs de protection contre les surintensités installés et les sections des circuits respectifs qu'ils protègent;
>
> c) de l’exécution de l’installation électrique conformément aux schémas unifilaires et plans de position.

RGIE, Livre 1, 6.5.1, p. 204 :

> Section 6.5.1. Généralités
>
> Toute installation à basse tension ou très basse tension telle que définie au chapitre 6.4.fait l’objet d’une visite de contrôle sur place soit par un organisme agréé, soit par l’autorité habilitée ou chargée de la faire selon les prescriptions du chapitre 6.3.
>
> La visite de contrôle porte sur le maintien de la conformité aux prescriptions du présent Livre. L’installation électrique doit pouvoir être mise hors tension pendant la visite de contrôle.
>
> La visite de contrôle comprend:
>
> − les contrôles administratifs;
>
> − les contrôles visuels;
>
> − les contrôles par essais;
>
> − les contrôles par mesures.

RGIE, Livre 1, 5.3.5.3 b, p. 168 :

> b. Mise en œuvre
>
> Les dispositifs de protection à courant différentiel-résiduel sont montés dans un endroit où leur fonctionnement sûr et efficace ne puisse être perturbé soit par des vibrations mécaniques, soit par des champs magnétiques extérieurs, soit par toute autre influence.
>
> Ils sont installés dans des lieux secs ou sont protégés efficacement contre l’humidité.
>
> Si le dispositif de protection à courant différentiel-résiduel est incorporé à un tableau de répartition et de manoeuvre, les dispositions sont prises pour que le bouton d’essai soit facilement accessible sans moyens spéciaux et sans danger de contact accidentel avec des pièces sous tension.

Les arrêtés ministériels prévus en 6.4.2 à 6.4.4 n'ont pas été consultés (nous ignorons s'ils existent pour la version 07).

### Interprétations possibles

**A. « Hors tension » vise l'état de l'installation pendant l'essentiel du contrôle, pas chaque essai.** Les essais fonctionnels (dont le déclenchement des différentiels) se font sous tension, de façon ponctuelle et maîtrisée ; ils font partie des « contrôles par essais ». Les articles peuvent dire que l'organisme agréé « vérifie les différentiels ».

**B. Le contrôle de conformité ne comporte pas d'essai sous tension.** « Hors tension » s'applique à tout le contrôle ; la vérification des différentiels se limite à leur choix et à leur adéquation avec la résistance de terre (6.4.6.4 b.4 a) ; l'essai de déclenchement relève de l'installateur ou de la pratique, pas d'une exigence du Livre 1.

**C. Selon les modalités fixées par arrêté** (à préciser par le spécialiste).

### Exemple concret d'installation

- Installation neuve : différentiel général 300 mA type A, 40 A ; deux différentiels 30 mA type A.
- L'organisme agréé mesure la résistance de terre (28 Ω) et l'isolement (hors tension). Puis, installation remise sous tension, il injecte 30 mA et mesure un temps de déclenchement de 25 ms, et appuie sur le bouton d'essai de chaque différentiel. Ces deux gestes font-ils partie du contrôle de conformité ?

### Conséquences sur les articles

- **`controle-organisme-agree`** : décrit l'« essai des différentiels » parmi les contrôles et précise que le contrôle se fait hors tension. **`test-differentiel`** : dit que l'organisme agréé « vérifie les différentiels et leur adéquation avec la résistance de terre » et que l'essai à l'appareil se fait sous tension. Lecture B : retirer l'essai sous tension de la description du contrôle officiel.

### Conséquences sur le moteur

- Règle **R-RCD-TEST** : essai noté « non conforme » → non-conformité (gravité élevée, bloquante) ; essai non noté → « vérification manuelle nécessaire », non bloquant. Règle **R-RCD-TRIP** : temps mesuré supérieur à 300 ms (500 ms pour un sélectif « S ») → non-conformité bloquante ; ces seuils viennent des normes de produit (question 13), pas du Livre 1.
- Lecture B : les essais resteraient proposés comme vérification de l'installateur, avec un libellé qui ne les présente pas comme une exigence du contrôle officiel.

### Décision attendue

A, B ou C ; références des arrêtés en vigueur si vous les connaissez.

### Réponse du spécialiste

- [ ] A  [ ] B  [ ] C  [ ] Autre : …
- Arrêtés applicables : …
- Commentaire :

&nbsp;

---

## Question 12 — Conducteur de protection vers un détecteur de mouvement

### Question

L'exception de 5.4.3.6 (« à l'exception de celles aboutissant aux interrupteurs ») couvre-t-elle la canalisation qui aboutit à un détecteur de mouvement (appareil électronique alimenté en phase et neutre, qui commande un point lumineux) ?

### Texte réglementaire

RGIE, Livre 1, 5.4.3.6, p. 180-181 :

> Sous-section 5.4.3.6. Connexion des conducteurs au matériel électrique
>
> Les machines et appareils électriques de la classe I sont pourvus de bornes qui peuvent admettre les conducteurs de protection.
>
> L’enlèvement d’une machine ou d’un appareil électrique ne peut interrompre la continuité du circuit de protection.
>
> Dans les installations domestiques, les canalisations électriques comportent un conducteur de protection, à l’exception de celles aboutissant aux interrupteurs, de celles à très basse tension de sécurité et de celles en amont du ou des différentiels généraux. Les interrupteurs pour usages domestiques doivent répondre soit aux normes y relatives homologuées par le Roi ou enregistrées par le NBN soit à des dispositions assurant au moins un niveau de sécurité équivalent à celui défini dans ces normes.

RGIE, Livre 1, 4.2.4.3 a (premier alinéa), p. 100 :

> a. Matériel électrique
>
> L’utilisation de machines et d’appareils électriques de classe 0 et 0I est interdite. Les masses du matériel électrique à basse tension de la classe I sont reliées au conducteur de protection des canalisations électriques qui les alimentent.

RGIE, Livre 1, tableau 2.23, rubrique E « Interrupteurs », p. 53 (texte seul, extrait) :

> E. Interrupteurs
>
> Bouton-poussoir
>
> […]
>
> Minuterie
>
> Interrupteur horaire
>
> Télérupteur
>
> Thermostat
>
> […]
>
> Détecteur de mouvement
>
> Symbole général
>
> * Mention technologie utilisée : IR, radar ou combinaison

### Interprétations possibles

**A. Exception applicable.** Le détecteur joue le rôle d'un interrupteur (il coupe la phase du point lumineux) et le tableau 2.23 le range dans la rubrique « Interrupteurs ». La canalisation qui y aboutit peut être sans conducteur de protection, sauf si le détecteur est de classe I (4.2.4.3 a impose alors de relier sa masse).

**B. Exception non applicable.** L'exception vise les interrupteurs au sens strict (appareils de commande mécaniques sans alimentation propre). Un détecteur alimenté en phase et neutre est un appareil d'utilisation ; la canalisation doit comporter un conducteur de protection, comme toute canalisation domestique, quelle que soit la classe du détecteur.

### Exemple concret d'installation

- Circuit F (éclairage extérieur), disjoncteur 16 A ; détecteur de mouvement infrarouge 230 V, **classe II** (sans borne de terre), en façade ; il commande un projecteur LED **classe I**.
- Câble de la boîte de dérivation au détecteur : **XVB 3 × 1,5 sans vert-jaune** (phase, neutre, retour lampe) ; du détecteur au projecteur : XVB 3G1,5 ; le conducteur de protection du projecteur vient directement de la boîte.
- Le câble vers le détecteur, sans conducteur de protection, est-il admis ?

### Conséquences sur les articles

- **`detecteur-de-mouvement`** : recommande de « prévoir aussi la terre dans le câble », indispensable pour un détecteur de classe I. Lecture B : présenter la terre comme obligatoire dans tous les cas. Lecture A : préciser qu'elle n'est obligatoire que pour un détecteur de classe I.
- `minuterie`, `telerupteur` (appareils de la même rubrique E placés hors tableau) : à aligner le cas échéant.

### Conséquences sur le moteur

- Aucune règle du moteur ne vérifie la présence du conducteur de protection vers un interrupteur ou un détecteur.
- Simulateur des exercices : le détecteur n'y a pas de borne de terre ; aucune erreur n'est signalée en l'absence de conducteur de protection. Lecture B : ajouter une borne de terre au détecteur et une erreur si elle n'est pas raccordée.

### Décision attendue

A ou B.

### Réponse du spécialiste

- [ ] A  [ ] B  [ ] Autre : …
- Commentaire :

&nbsp;

---

## Question 13 — Valeurs tirées de normes non consultées

### Question

Les valeurs ci-dessous, utilisées dans les articles ou dans le moteur, viennent de normes ou de prescriptions que l'auditeur n'a pas pu consulter. Pour chacune : la valeur et son attribution sont-elles exactes, et la façon dont Voltaplan l'utilise (exigence, avertissement, simple information) est-elle appropriée ?

### Texte réglementaire

Le Livre 1 renvoie à ces normes sans en reproduire le contenu. Passages utiles :

RGIE, Livre 1, 5.2.5, p. 138 :

> Section 5.2.5. Chute de tension
>
> Les chutes de tension dans les canalisations électriques doivent être limitées aux valeurs décrites dans les règles de l’art.

RGIE, Livre 1, 5.2.1.2 b, p. 129 :

> b) la chute de tension, dans les conditions normales de service, soit compatible avec un fonctionnement sûr des machines ou appareils électriques alimentés;

RGIE, Livre 1, 5.2.1.1, p. 129 :

> Sous-section 5.2.1.1. Code d'identification des canalisations électriques
>
> Le code d’identification des canalisations électriques est donné à la norme y relative homologuée par le Roi ou enregistrée par le NBN ou répond à des dispositions qui offrent un niveau de sécurité au moins équivalent à celui défini dans cette norme.

RGIE, Livre 1, 5.3.5.2 a (troisième alinéa), p. 167 :

> Les socles de prise de courant dont le courant assigné ne dépasse pas 32A et la tension assignée ne dépasse pas 400V satisfont à la norme NBN C 61-112-1:2017 concernant les prises de courant pour usages domestiques et analogues.

**Contenu des normes elles-mêmes : non accessible pour ce dossier.** Aucune des normes ci-dessous n'a été lue ; les valeurs indiquées sont celles qui figurent dans les articles ou le moteur, à confirmer.

### Interprétations possibles

Pour chaque ligne du tableau : **A** = valeur et attribution exactes, usage approprié ; **B** = valeur ou attribution à corriger (préciser) ; **C** = valeur exacte mais usage inapproprié (par exemple présentée comme exigence alors qu'elle n'est qu'indicative).

| Réf. | Affirmation de Voltaplan | Source supposée | Où | Usage par Voltaplan |
|---|---|---|---|---|
| 13.1 | Seuils de déclenchement magnétique : courbe B 3 à 5 × In, C 5 à 10 × In, D 10 à 20 × In (calcul de longueur maximale avec 5, 10, 20 × In) | EN 60898 | `courbes-disjoncteur`, calcul R-ICC-LMAX | Avertissement (non bloquant) |
| 13.2 | Différentiel : déclenchement au courant différentiel nominal en 300 ms au plus, 500 ms pour un sélectif « S » | EN 61008 / EN 61009 | `test-differentiel`, règle R-RCD-TRIP | **Non-conformité bloquante** |
| 13.3 | Phases en brun, noir ou gris (convention des câbles harmonisés) | HD 308 | `couleurs-des-fils` | Information (le RGIE n'impose pas de couleur aux phases) |
| 13.4 | Chute de tension : 3 % éclairage, 5 % autres usages | IEC 60364-5-52, annexe G (informative) | `chute-de-tension`, règle R-VDROP | Avertissement (non bloquant) |
| 13.5 | Charge minimale des variateurs, compatibilité LED | EN 60669-2-1 ; notices | `variateur` | Information |
| 13.6 | Transformateur de sonnette = transformateur de sécurité | EN 61558-2-8 | `sonnette` | Information |
| 13.7 | Obturateurs : conformité des prises domestiques à NBN C 61-112-1:2017 | NBN C 61-112-1 (citée par le RGIE, non lue) | `prise-de-courant`, règle R-SOCKET-IPXXD | Non-conformité (partie neuve) |
| 13.8 | Bus KNX alimenté en TBTS, environ 30 V continu | EN 50090 ; documentation des fabricants | `bus-knx` | Information |
| 13.9 | « Quelques dizaines de milliampères à travers le corps peuvent tuer » | IEC 60479 | `courant`, `differentiel` | Information |
| 13.10 | Catégories de mesure (CAT) des appareils de mesure | IEC 61010 | `continuite`, `resistance-isolement` | Information |
| 13.11 | Symboles hors tableau 2.23 | IEC 60617 | `symboles-electriques` | Information |
| 13.12 | Câble XVB : construction, usages (dont pose en terre) | NBN HD 604 ; fiches fabricants | `types-de-cables`, lexique | Information |
| 13.13 | Désignations VTLB / H05VV-F (correspondance) | normes de câbles ; le RGIE cite le VTLB en 8.2.2 | `types-de-cables`, lexique | Information |
| 13.14 | Disjoncteur de branchement : calibre fixé par le gestionnaire de réseau ; signal heures creuses des compteurs numériques | Prescriptions Synergrid / gestionnaires | `puissance-energie`, `contacteur-jour-nuit`, lexique | Information |

### Exemple concret d'installation

- Circuit G : prises de la buanderie, disjoncteur 20 A courbe C, câble 2,5 mm² de 32 m. Voltaplan calcule une chute de tension de 4,2 % (sous 5 % : rien) et une longueur maximale compatible avec un déclenchement magnétique à 10 × 20 A = 200 A.
- Essai du différentiel 30 mA de ce circuit : 340 ms au courant nominal. Voltaplan affiche une **non-conformité bloquante** (seuil de 300 ms). Est-ce justifié, et sur quelle base ?

### Conséquences sur les articles

- Chaque article cité dans le tableau : correction des valeurs ou de leur attribution si B ; reformulation (« valeur indicative », « selon la norme de produit ») si C.

### Conséquences sur le moteur

- **13.2 (R-RCD-TRIP)** est la seule ligne où une valeur non trouvée dans le Livre 1 produit une non-conformité bloquante. Si C : le constat deviendrait un avertissement libellé « exigence de la norme de produit ». Si B : seuils corrigés.
- 13.1 et 13.4 : avertissements non bloquants ; valeurs ajustées si B.
- 13.7 : la règle cite la norme comme le RGIE ; inchangée sauf B.

### Décision attendue

Pour chaque ligne : A, B (valeur correcte) ou C (usage recommandé). Les lignes que vous ne pouvez pas trancher peuvent rester vides.

### Réponse du spécialiste

| Réf. | A | B (correction) | C (usage recommandé) | Commentaire |
|---|---|---|---|---|
| 13.1 | | | | |
| 13.2 | | | | |
| 13.3 | | | | |
| 13.4 | | | | |
| 13.5 | | | | |
| 13.6 | | | | |
| 13.7 | | | | |
| 13.8 | | | | |
| 13.9 | | | | |
| 13.10 | | | | |
| 13.11 | | | | |
| 13.12 | | | | |
| 13.13 | | | | |
| 13.14 | | | | |

&nbsp;

---

## Question 14 — Obturateurs (sécurité enfant) avant le 01/03/2025

### Question

Avant le 01/03/2025 (ancien RGIE, puis Livre 1 dans ses versions 01 à 04), les socles de prise de courant d'une installation domestique devaient-ils déjà être munis d'obturateurs (« sécurité enfant ») ? Autrement dit, une prise sans obturateurs posée par exemple en 2015 ou en 2022, et contrôlée alors, était-elle conforme à l'époque ?

### Texte réglementaire

RGIE, Livre 1, version 07, 5.3.5.2 a, p. 167 :

> Sous-section 5.3.5.2. Socles de prise de courant et éclairage
>
> a. Socles de prise de courant à basse tension dans des installations électriques à courant alternatif
>
> Les socles de prise de courant ont un degré de protection d’au moins IPXX-B. Les socles de prise de courant dont le courant assigné ne dépasse 16A et la tension assignée ne dépasse pas 250V ont un degré de protection d’au moins IPXX-D.
>
> Les socles de prise de courant dont le courant assigné ne dépasse pas 32A et la tension assignée ne dépasse pas 400V satisfont à la norme NBN C 61-112-1:2017 concernant les prises de courant pour usages domestiques et analogues.
>
> En dérogation des alinéas 2 et 3, d’autres socles de prise de courant peuvent être utilisés dans les cas suivants:
>
> − les socles de prise de courant qui sont exclusivement destinés pour l’alimentation d’un ou plusieurs appareils d’utilisation pour un usage spécifique;
>
> − les socles de prise de courant placés dans ou sur des tableaux de répartition et de manœuvre ;
>
> − le point de raccordement fixe pour l’alimentation:
>
> • des campings visés au chapitre 7.8.;
>
> • des marinas visées au chapitre 7.9.;
>
> • des véhicules ou remorques routières pendant leur stationnement visés au chapitre 7.101.;
>
> − les installations temporaires, mobiles ou transportables telles que définies à la sous-section 2.2.1.1.;
>
> − les lieux du service électrique;
>
> − les socles de prise de courant munis d’un verrouillage mécanique ou électrique mettant hors tension les parties actives du socle de prise de courant après l’enlèvement de la fiche.
>
> Les socles de prise de courant qui sont encastrés dans les parois (sol, plafond, mur), sont logés soit dans des boîtes métalliques soit dans des boîtes en matière isolante.

RGIE, Livre 1, 5.3.5.2 c, p. 167 :

> c. Dispositions transitoires
>
> En dérogation du point a, la sous-section 6.5.8.1., 2. et la sous-section 6.5.8.2., 3. peuvent être appliquées sur les projets ou les travaux dont l’exécution sur place est entamée avant le 01/03/2025, à condition que le contrôle de conformité avant la mise en usage a lieu à partir du 01/03/2025. L’organisme agréé qui est chargé avec le contrôle de conformité avant la mise en usage est informé par le demandeur du contrôle de l’application de la sous-section 6.5.8.1., 2. ou de la sous-section 6.5.8.2., 3. L’organisme agréé fait mention dans le rapport de contrôle de l’application de la sous-section 6.5.8.1., 2. ou de la sous-section 6.5.8.2., 3.

RGIE, Livre 1, 6.5.8.1 (introduction et point 2), p. 207 :

> Sous-section 6.5.8.1. Parties existantes des installations domestiques réalisées à partir du 1er juin 2020
>
> Les dispositions dérogatoires suivantes sont d’application sur les parties existantes d’installations domestiques dont l’exécution sur place a été entamée à partir du 1er juin 2020 et qui ont fait l’objet d’un contrôle de conformité avant la mise en usage conformément au chapitre 6.4. Certaines dispositions dérogatoires peuvent s’appliquer seulement jusqu’à une date limite de réalisation sur place telle que définie dans les dispositions dérogatoires concernées:

> 2. Socles de prise de courant
>
> Il est autorisé, par dérogation aux prescriptions de la sous-section 5.1.3.1. et de la sous-section 5.3.5.2., a., de laisser en service les socles de prise de courant qui étaient installés conformément au livre 1 avant le 01/03/2025.

RGIE, Livre 1, 8.2.1 point 6 a, p. 274 :

> 6. Socles de prise de courant
>
> Il est autorisé:
>
> a) en dérogation aux prescriptions de la sous-section 5.1.3.1. et de la sous-section 5.3.5.2., a., de laisser en service les socles de prise de courant installés avant le 1er octobre 1981 et répondant aux prescriptions du livre 1 d’application avant le 01/03/2025;

RGIE, Livre 1, 8.2.2 point 6 (second alinéa), p. 278 :

> Il est autorisé, par dérogation aux prescriptions de la sous-section 5.1.3.1. et de la sous-section 5.3.5.2., a., de laisser en service les socles de prise de courant installés entre le 1er octobre 1981 et le 31 mai 2020 et répondant aux prescriptions de du livre 1 d’application avant le 01/03/2025.

Le tableau 2.23 F (p. 53) comporte un symbole « Socle de prise de courant avec protection « enfant » », distinct du symbole général.

**Les éditions antérieures (ancien RGIE de 1981 et versions 01 à 04 du Livre 1) n'ont pas été consultées** : la version 07 renvoie aux « prescriptions du livre 1 d’application avant le 01/03/2025 » sans les reproduire.

### Interprétations possibles

**A. Les obturateurs étaient déjà exigés avant le 01/03/2025** (sous une autre formulation) ; la modification de 2025 a surtout introduit la référence IPXX-D et la norme NBN C 61-112-1:2017. Une prise sans obturateurs posée avant 2025 était déjà non conforme.

**B. Les obturateurs n'étaient pas exigés avant le 01/03/2025** pour les installations domestiques en général. Une prise sans obturateurs posée et contrôlée avant cette date était conforme et peut rester en service (6.5.8.1 point 2, 8.2.1 point 6 a, 8.2.2 point 6).

**C. Exigence partielle** (par exemple seulement pour certains lieux ou certains types de socles) : préciser laquelle et la référence.

### Exemple concret d'installation

- Maison neuve : travaux entamés en 2022, contrôle de conformité en 2023, conforme. Les 24 socles de prise 16 A sont sans obturateurs.
- Maison de 2010 (installation contrôlée selon l'ancien RGIE), prises sans obturateurs.
- En 2026, visite de contrôle pour chacune : ces prises sont-elles des infractions ?

### Conséquences sur les articles

- **`prise-de-courant`** : dit que les prises de 16 A et 250 V au plus doivent être IPXX-D depuis la version applicable au 1er mars 2025, et que « les prises posées avant le 1er mars 2025 selon les règles d'alors peuvent rester en service ». Il ne dit pas si les obturateurs étaient exigés avant. Lecture A ou C : ajouter que l'exigence existait déjà (avec la référence). Lecture B : préciser qu'elle est nouvelle.
- Lexique (« obturateur », « IPXX-D ») : à aligner.

### Conséquences sur le moteur

- Pour une prise dessinée sans sécurité enfant (prise triphasée exceptée) :
  - partie dont la date est postérieure au 01/03/2025 : règle **R-SOCKET-IPXXD** (non-conformité, sauf prise réservée à un appareil dessiné) ;
  - partie antérieure au 01/03/2025 : règle **R-SOCKET-CHILD**, qui signale **déjà** la prise sans sécurité enfant — non-conformité bloquante si la partie est neuve, recommandation si elle est existante.
- Lecture B : R-SOCKET-CHILD donnerait une fausse non-conformité pour un projet antérieur à 2025 ; elle deviendrait une recommandation (ou serait supprimée) avant cette date. Lecture A : inchangée. Lecture C : limitée aux cas que vous indiquerez.

### Décision attendue

A, B ou C, avec si possible la référence de l'édition antérieure (article de l'ancien RGIE ou sous-section du Livre 1 avant 2025).

### Réponse du spécialiste

- [ ] A  [ ] B  [ ] C : …  [ ] Autre : …
- Référence de l'édition antérieure : …
- Commentaire :

&nbsp;

---

## Question 15 — Tension d'un bouton de sonnette extérieur (BB1 ou BB2)

### Question

Pour un bouton de sonnette placé à l'extérieur (façade exposée à la pluie), alimenté en TBTS par un transformateur de sonnette, faut-il retenir l'état du corps humain BB1 (peau sèche ou humide par sueur : tension nominale maximale de 25 V alternatif pour être dispensé de protection contre les contacts directs) ou BB2 (peau mouillée : 12 V alternatif) ?

### Texte réglementaire

RGIE, Livre 1, 4.2.2.2 et tableau 4.1, p. 73 (tableau remis en forme ; valeurs reprises telles quelles) :

> Sous-section 4.2.2.2. Lors de l’emploi de la très basse tension et de la très basse tension de sécurité
>
> La protection contre les chocs électriques par contact direct est considérée comme assurée par l’utilisation de la très basse tension de sécurité aux conditions mentionnées au 4.2.3.3.a., sous réserve que la tension nominale maximale entre deux parties actives nues simultanément accessibles ne dépasse pas la valeur mentionnée dans le tableau 4.1.

> Tableau 4.1. Tension nominale maximale lors de l’emploi de la TBTS

| Code | Etat du corps humain | Courant alternatif | Courant continu non lisse | Courant continu lisse |
|---|---|---|---|---|
| BB1 | Peau sèche ou humide par sueur | 25 | 36 | 60 |
| BB2 | Peau mouillée | 12 | 18 | 30 |
| BB3 | Peau immergée dans l’eau | 6 | 12 | 20 |

> Cette règle n’est pas d’application pour les installations électriques des piscines (chapitre 7.2.) et saunas (chapitre 7.3.).

RGIE, Livre 1, 2.10.12 et tableau 2.16, p. 43 (tableau remis en forme) :

> Section 2.10.12. Etat du corps humain (BB)
>
> Pour caractériser l’influence externe « humidité de la peau », on utilise un code composé des lettres BB suivies d’un chiffre allant de 1 à 3, comme le mentionne le tableau 2.16.

| Code | Etat du corps humain |
|---|---|
| BB1 | Peau sèche ou humide par sueur |
| BB2 | Peau mouillée |
| BB3 | Peau immergée dans l’eau |

Autre passage où le Livre 1 associe les codes BB à des tensions TBTS, pour les lampes baladeuses (5.3.4.2 e, p. 162) :

> e. Lampes baladeuses
>
> Etant donné leur application dans des circonstances les plus diverses au point de vue des influences externes, la tension d’alimentation de la lampe baladeuse est limitée aux valeurs maximales suivantes:
>
> − en basse tension à 250 V pour l’association des influences externes: BB1/BC1 ou BC2;
>
> − en très basse tension de sécurité à 25 V en courant alternatif, 36 V en courant continu non lisse ou 60 V en courant continu lisse pour l’association des influences externes: BB1/BC3 ou BC4; BB2/BC1 ou BC2 ou BC3; BB3/BC1 ou BC2;
>
> − en très basse tension de sécurité à 12 V en courant alternatif, 18 V en courant continu non lisse ou 30 V en courant continu lisse pour l’association des influences externes: BB2/BC4; BB3/BC3
>
> − en très basse tension de sécurité à 6 V en courant alternatif, 12 V en courant continu non lisse ou 18 V en courant continu lisse pour l’association des influences externes: BB3/BC4.

Le tableau 2.16 ne donne pas d'exemple de lieu ; nous n'avons pas trouvé dans le Livre 1 de classement d'un emplacement extérieur en BB1 ou BB2. La norme des transformateurs de sonnette (EN 61558-2-8) n'a pas été consultée.

### Interprétations possibles

**A. BB1.** Le visiteur touche le bouton du doigt, brièvement ; la « peau mouillée » (BB2) vise des situations où la peau est durablement mouillée (douche, travaux sous la pluie). Une tension jusqu'à 25 V alternatif est admise ; les sorties usuelles de 8, 12 et 24 V conviennent.

**B. BB2.** Un bouton exposé à la pluie est touché avec des mains mouillées ; il faut retenir 12 V alternatif au plus. Une sortie de 24 V ne dispenserait pas de protection contre les contacts directs (degré de protection du bouton, par exemple).

**C. Selon l'exposition.** BB1 sous un auvent ou un porche abrité, BB2 pour un bouton directement exposé ; ou bien sans objet si le bouton lui-même assure la protection contre les contacts directs (parties actives non accessibles).

### Exemple concret d'installation

- Transformateur de sonnette modulaire au tableau, primaire 230 V protégé par un disjoncteur 10 A ; secondaire 8 / 12 / 24 V alternatif.
- Carillon 24 V dans le hall ; bouton-poussoir en façade, sans auvent, à 1,20 m du sol ; fil de sonnette 2 × 0,8 mm.
- Le choix de la sortie 24 V est-il admis pour ce bouton ? Et la sortie 12 V ?

### Conséquences sur les articles

- **`sonnette`** : cite les deux valeurs (« au plus 25 V en alternatif sur peau sèche, 12 V sur peau mouillée ») sans dire laquelle s'applique au bouton extérieur ; l'audit note qu'une sortie de 24 V à l'extérieur « mérite vérification ». Lecture A : préciser que 24 V convient. Lecture B : recommander 12 V au plus pour un bouton exposé. Lecture C : distinguer abrité / exposé.

### Conséquences sur le moteur

- Le transformateur dessiné peut porter ses tensions primaire et secondaire, mais **aucune règle** ne vérifie la tension TBTS selon l'emplacement, et le bouton-poussoir n'a pas de donnée « extérieur / exposé ». En lecture B ou C, un avertissement non bloquant serait possible, après ajout de cette donnée.

### Décision attendue

A, B ou C.

### Réponse du spécialiste

- [ ] A  [ ] B  [ ] C  [ ] Autre : …
- Commentaire :

&nbsp;

---

## Synthèse des réponses

À remplir par le spécialiste.

| N° | Sujet | Réponse (A / B / C / autre) | Précision (bloquant, valeur, référence…) | Certitude |
|---|---|---|---|---|
| 1 | Disjoncteurs 1P+N (4.4.4.2) | | | |
| 2 | Différentiels type AC dans l'existant | | | |
| 3 | 3 × 230 V et schéma IT | | | |
| 4 | Bleu en navette (5.1.6.2) | | | |
| 5 | Exception de 4.5.4 en habitation | | | |
| 6 | Module domotique caché | | | |
| 7 | Groupe de volets : nombre de points | | | |
| 8 | Prise double de deux socles simples | | | |
| 9 | Redémarrage d'un ouvrant (5.3.3.2 e) | | | |
| 10 | Installation réalisée par un particulier | | | |
| 11 | Essai des différentiels « hors tension » | | | |
| 12 | Terre vers un détecteur (5.4.3.6) | | | |
| 13 | Normes non consultées (voir tableau 13) | | | |
| 14 | Obturateurs avant le 01/03/2025 | | | |
| 15 | Bouton de sonnette extérieur (BB1 / BB2) | | | |

Nom, qualité et organisme du spécialiste : …

Date : …

Signature (facultative) : …

Accord pour citer les réponses dans le dépôt du projet : [ ] avec mon nom  [ ] sans mon nom  [ ] non

## Références

**Texte réglementaire**

- RGIE, Livre 1 « Installations à basse tension et à très basse tension », version 07 du 15/09/2026, arrêté royal du 13/08/2026 (réf. C- 2026/006432), d'application à partir du 01/11/2026 ; SPF Économie, P.M.E., Classes moyennes et Énergie. Passages cités : 2.2.1.1 ; 2.2.1.2 b ; 2.4.1 ; 2.6.1 ; 2.7.1 ; 2.10.12 (tableau 2.16) ; 2.11.2 ; tableau 2.23 (rubriques E, F, J) ; 3.1.2.1 a ; 3.1.2.2 a ; 3.1.2.3 a ; 4.2.2.2 (tableau 4.1) ; 4.2.3.4 d ; 4.2.4.3 a et b ; 4.2.5.3 b et c ; 4.4.4.1 ; 4.4.4.2 ; 4.4.4.4 ; 4.4.4.5 ; 4.5.3 ; 4.5.4 ; 4.6.1 ; 5.1.6.2 ; 5.2.1.1 ; 5.2.1.2 b ; 5.2.1.3 ; 5.2.5 ; 5.3.3.2 d et e ; 5.3.4.2 e ; 5.3.5.2 a, b et c ; 5.3.5.3 a et b ; 5.4.3.6 ; 6.4.1 à 6.4.4 ; 6.4.6.4 b.1 et b.4 ; 6.4.7.3 ; 6.5.1 ; 6.5.8.1 ; 8.1.1 ; 8.2.1 ; 8.2.2.

**Documents non consultés (cités pour mémoire, contenu non vérifié)**

- Ancien RGIE (arrêtés royaux du 10/03/1981 et du 02/09/1981) et versions 01 à 06 du Livre 1.
- Arrêtés ministériels prévus en 6.4.2 à 6.4.4 (modalités des contrôles).
- Normes : EN 60898 ; EN 61008 ; EN 61009 ; HD 308 ; IEC 60364-5-52 ; EN 60669-2-1 ; EN 61558-2-8 ; NBN C 61-112-1:2017 ; EN 50090 ; IEC 60479 ; IEC 61010 ; IEC 60617 ; NBN HD 604.
- Prescriptions techniques de raccordement Synergrid et des gestionnaires de réseau.

**Documents du projet Voltaplan**

- Audit de la rubrique « Apprendre » : `docs/audit/APPRENDRE-RGIE-AUDIT-2026.md` (sections « Anomalies du moteur réglementaire » et « Points à faire valider par un spécialiste »).
- Articles : `learn/fr/<article>.html` (noms d'articles cités entre accents graves dans ce dossier).
- Moteur de contrôle : `src/rules/be/rgie.ts`, classement des constats `src/rules/context.ts`, données des éléments `src/model/schema.ts` (décrits ici sans code).
