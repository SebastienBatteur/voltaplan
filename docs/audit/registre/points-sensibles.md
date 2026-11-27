> Annexe du rapport `docs/audit/REGISTRE-RGIE-2026.md`. Document de travail de l’audit (27/11/2026), écrit sur le moteur **avant** les corrections de la branche `regulatory-registry` : les constats corrigés depuis sont listés dans le rapport. Les chemins `scratchpad/…` désignent des fichiers de travail non versionnés (extrait texte du RGIE, sondes).

# Points sensibles du moteur réglementaire : contre-vérification

Date : 27/11/2026. Seule source réglementaire : RGIE, Livre 1, version 07 (15/09/2026, d'application au 01/11/2026),
extrait texte `scratchpad/livre1.txt`. Les numéros de page sont ceux imprimés en pied de page. Le tableau 5.1 et la
sous-section 4.2.4.3 b (p. 100-101) ont en plus été contrôlés sur le rendu image des pages du PDF officiel (pages PDF
141, 112 et 113).

Code relu (dépôt en lecture seule, `wt-engine`) : `src/rules/be/rgie.ts`, `src/rules/be/catalog.ts`,
`src/rules/context.ts`, `src/assist/project.ts` ; décisions : `docs/audit/MOTEUR-CORRECTIONS-2026.md`,
`docs/audit/VALIDATION-EXTERNE-RGIE.md`. Aucun fichier du dépôt n'a été modifié. Le comportement réel a été vérifié en
exécutant le moteur sur de petits projets (scripts `scratchpad/probe/probe.ts` et `probe2.ts`, compilés avec l'esbuild
du dépôt, hors dépôt) ; les résultats sont cités sous la mention « Essai ».

Vocabulaire des statuts (moteur) : `nonCompliant` = non conforme ; `recommendation` = recommandation ;
`manualCheck` = vérification à faire ; `insufficientData` = informations insuffisantes ; `derogation` = dérogation.

---

## 0. Constats transversaux (à lire d'abord)

Ils commandent la plupart des recommandations qui suivent.

**T1. Le régime « existant » du moteur mélange trois régimes juridiques différents.** `classify` (context.ts) donne à
toute partie non neuve le statut `rule.existing ?? (hazard high ? nonCompliant : recommendation)`. Or le Livre 1
distingue :

- les parties d'avant le 1/10/1981 (8.2.1, p. 273-276), avec ou sans visite de contrôle ;
- les parties ancien RGIE, exécutées à partir du 1/10/1981 **et** ayant fait l'objet d'un examen de conformité
  selon l'ancien RGIE (8.2.2, p. 276-278), avec des dates limites propres à chaque dérogation ;
- les parties réalisées à partir du 1/6/2020 et contrôlées selon le chapitre 6.4 (6.5.8.1, p. 207-209), qui n'ont
  que trois familles de dérogations (30 mA et 8 circuits avant le 01/06/2023, prises avant le 01/03/2025, salles de bain
  et piscines avant le 01/03/2025).

Hors de ces dérogations, l'exigence s'applique. Le statut générique « recommandation » est donc faux chaque fois que le
texte ne prévoit aucune dérogation. Essai (partie existante datée 2021, différentiel général type AC de 25 A, circuit de
10 prises) : `R-RCD-TYPE-A`, `R-RCD-HEAD-RATING` et `R-SOCKET-MAX` sortent tous trois en `recommendation`, non
bloquants. Aucune de ces trois exigences n'a de dérogation en 6.5.8.1 : ce sont des infractions.

**T2. L'examen de conformité conditionne 8.2.2, et le moteur ne le connaît pas.** 8.2.2 (p. 276) : « parties
existantes des installations électriques domestiques ancien RGIE dont l'exécution sur place a été réalisée à partir du
1er octobre 1981 et qui ont fait l'objet d'un examen de conformité conformément à l'ancien RGIE ». Une partie de 1981 à
2020 jamais examinée ne bénéficie pas de 8.2.2. De même, 6.5.8.1 vise des parties « qui ont fait l'objet d'un contrôle
de conformité avant la mise en usage conformément au chapitre 6.4 » (p. 207). Le moteur applique les dates seules.

**T3. Défaut de l'assistant et de l'import : édition « ancienne » supposée.** `newExistingProject` (assist/project.ts)
et l'import eendraadschema posent `rgieVersion: 'old'`. `partContext` en déduit l'édition `1981`, et `sinceDate`
renvoie « non » dès que l'édition n'est pas l'édition en vigueur, **avant** de lire la réponse `rgie2023` du tableau.
Essai :

- existant sans date, `rgieVersion: 'new'` : question `R-RCD30-DATE` posée (correct) ;
- existant sans date, `rgieVersion: 'old'` (cas de l'assistant) : **aucun constat** pour un circuit de prises sans
  30 mA ;
- même cas, tableau répondu « fait ou refait après le 1/6/2023 » : **toujours aucun constat** (la réponse est ignorée).

Un relevé fait avec l'assistant ne signale donc jamais l'absence de 30 mA sur des prises ou l'éclairage d'un tableau
récent, sauf si une date `installedOn` est saisie. C'est un faux négatif de sécurité, sans lien avec une
interprétation du texte.

**T4. Éditions incomplètes.** Aperçu des versions (p. 3 du PDF) : version 01 (d'application au 01/06/2020), 03
(01/11/2022), 04 (01/06/2023), 05 (01/03/2025), 06 (01/04/2026), 07 (01/11/2026). `BE_EDITIONS` ne connaît que 2020
et l'amendement de 2023 ; 2025 est une constante isolée (`RGIE_2025`) ; 2022, 2026-04 et 2026-11 sont absents. Le texte
consolidé ne contient pas l'ancien libellé des articles modifiés : ce qui était exigé avant une modification ne se lit
qu'au travers des dérogations et dispositions transitoires.

**T5. Dérogations appliquées en silence.** Les dispositions transitoires (4.2.4.3 b dernier alinéa avant les figures,
p. 101 ; 5.3.5.2 c, p. 167 ; 7.1.1.2, p. 215 ; 4.2.3.4 e, p. 99) disent que la dérogation n'est permise, pour un
projet entamé avant la date mais contrôlé après, que si l'organisme agréé « est informé » et en « fait mention dans le
rapport ». 6.5.7.2 b.5 (p. 206) : « Les éventuelles dérogations (sections 6.5.8., 8.2.1. et 8.2.2.) qui sont
d'application pour l'installation électrique sont également mentionnées dans le rapport de visite de contrôle. » Le
moteur, lui, n'émet aucun constat quand une dérogation de date s'applique (règle 30 mA, 8 circuits, 40 A).

**T6. Autres dérogations de la partie 8 non prises en compte (hors des 8 questions, relevées en passant).** Essai sur
une partie de 1975 :

- prise sans contact de terre derrière un 30 mA → `R-SOCKET-EARTH` non conforme **bloquant**, alors que 8.2.1 point 6 b
  (p. 274-275) permet de « laisser en service les socles de prise de courant qui ne comportent pas de contact de terre
  du fait que la canalisation électrique est sans conducteur de protection et à condition que ces socles de prise de
  courant soient protégés par un dispositif de protection à courant différentiel-résiduel à haute ou très haute
  sensibilité » ;
- câble de 1 mm² protégé par un fusible de 6 A → `R-CABLE-MIN` non conforme **bloquant**, alors que 8.2.1 point 5
  (p. 274) l'admet (voir point 5 ci-dessous) ;
- 8.2.1 point 13 (p. 276) : « Il est admis, en dérogation aux prescriptions du point a.5 de la sous-section 4.2.3.4.
  que la liaison équipotentielle principale ne soit pas présente. » `R-BONDING` reste bloquant dans une partie
  d'avant 1981 (non essayé, déduit du catalogue : `hazard: 'high'`, pas de régime `existing`).

---

## 1. Type AC laissé non bloquant (« recommandation ») dans l'existant

### Texte cité

- 5.3.5.3 a, p. 168 : « Les dispositifs de protection à courant différentiel-résiduel placés dans les installations
  domestiques sont au moins du type A; ceux qui sont placés en tête de l'installation électrique ont une intensité
  nominale au moins égale à 40 A. »
- 8.2.1 point 2, p. 273 (parties d'avant le 1/10/1981), dérogations au point a. de 5.3.5.3 : seulement « de laisser en
  service les dispositifs de protection à courant différentiel-résiduel d'une intensité nominale inférieure à 40 A ».
- 8.2.2 point 2, p. 277 : idem, « pour les installations électriques dont l'exécution sur place a été entamée avant le
  16 septembre 1991 ».
- 8.2.1 et 8.2.2 point 1 (p. 273, p. 276) : maintien du matériel ancien en dérogation à 5.1.3.1 « à condition que les
  caractéristiques du matériel électrique répondent aux prescriptions des installations domestiques du présent Livre,
  moyennant l'application des dérogations de la présente section ».
- 6.5.8.1 (p. 207-209, parties réalisées à partir du 1/6/2020) : points 1 (30 mA), 2 (prises), 3 (salles de bain) ;
  rien sur 5.3.5.3. 6.5.8.2 (non domestique) : rien non plus.

### Analyse

Recherche exhaustive dans le texte : « 5.3.5.3 » n'apparaît hors de l'article lui-même et du sommaire que dans les deux
dérogations sur l'intensité de 40 A. Aucune dérogation ne porte sur le type, ni en 8.2.1, ni en 8.2.2, ni en 6.5.8.1,
ni en 6.5.8.2, ni dans une disposition transitoire. La même phrase de 5.3.5.3 a fait l'objet d'une dérogation pour le
calibre et pas pour le type : l'omission paraît délibérée. Le point 1 de 8.2.1 / 8.2.2 ne sauve pas le type AC : il
exige que les caractéristiques du matériel répondent au Livre 1, sous réserve des dérogations de la section (aucune ne
vise le type).

Il faut toutefois distinguer :

- **parties de 2020 et après** (contrôlées selon 6.4) : aucune lecture ne permet de garder un type AC ; c'est une
  infraction, sans doute possible au vu du texte ;
- **parties d'avant 2020** : la lecture littérale donne aussi une infraction. La seule incertitude est extérieure au
  texte (pratique des organismes agréés), c'est la question 2 du dossier de validation.

La décision actuelle (« recommandation » pour tout l'existant) est donc trop large : elle est fausse pour les parties de
2020 et après, et présente comme facultatif ce que le texte, lu littéralement, exige pour les parties plus anciennes.

### Décision actuelle du moteur

`R-RCD-TYPE-A` : `hazard: medium`, `existing: 'recommendation'`. Tout différentiel `rcdType === 'AC'` est signalé ;
partie neuve : non conforme bloquant ; partie existante : recommandation non bloquante (essai : partie 2021 →
`recommendation`).

### Recommandation

Règle conditionnelle, pas d'exception générale :

| Partie | Statut attendu | Bloquant |
|---|---|---|
| neuve (conception) | non conforme | oui |
| existante, exécution entamée le 1/6/2020 ou après | non conforme (aucune dérogation en 6.5.8.1) | selon la politique produit des parties existantes ; ne jamais descendre au statut « recommandation » |
| existante avant le 1/6/2020 (8.2.1 / 8.2.2) | « vérification à faire » avec le motif « aucune dérogation au type A en 8.2.1 / 8.2.2 ; lecture littérale : infraction » ; passe à non conforme si l'expert retient la lecture A de la question 2 | non |
| différentiel AC en amont d'un circuit ajouté ou modifié de façon importante (6.4.7.3) | non conforme pour la partie ajoutée : la protection du nouveau circuit fait partie du contrôle | comme une partie neuve |
| date inconnue | informations insuffisantes, message conditionnel (« non conforme si la partie date du 1/6/2020 ou après ») | non |

Pour le dernier cas de figure (différentiel ancien protégeant un circuit neuf), la date à retenir est la plus récente des
dates de la chaîne aval, pas seulement celle du différentiel.

### Tests à prévoir

- AC, partie existante `installedOn: '2021-03'` → `nonCompliant` (aujourd'hui `recommendation`).
- AC, partie existante `installedOn: '2019'` → `manualCheck` (et non `recommendation`).
- AC, partie de 1975 → `manualCheck`.
- AC existant 1998 avec un circuit enfant `installedOn: '2026-05'` → constat sur la partie neuve.
- AC, date inconnue → `insufficientData`, non bloquant.
- type A, F, B, type inconnu → aucun constat (inchangé).

### Incertitude restante

Pour les parties d'avant 2020, la pratique des organismes agréés (question 2 du dossier de validation). Le libellé de
5.3.5.3 a dans la version 01 (2020) n'est pas consultable ici ; l'absence de toute disposition transitoire le citant
laisse penser qu'il n'a pas changé depuis 2020, sans certitude.

---

## 2. Différentiels 30 mA : avant et après le 1/6/2023

### Texte cité

- 4.2.4.3 b, p. 101 : « Immédiatement en aval du dispositif de protection placé à l'origine de l'installation
  électrique, au moins un dispositif de protection à courant différentiel-résiduel à haute ou très haute sensibilité est
  placé auquel sont raccordés au moins les circuits suivants: 1. les socles de prise de courant non destinés à
  l'alimentation des appareils et des machines fixes ou à poste fixe; 2. l'éclairage; 3. les lieux contenant une
  baignoire et/ou une douche tels que visés au chapitre 7.1.; 4. les lave-linges, les sèche-linges et les
  lave-vaisselles. » Puis : « Il est autorisé de placer au maximum 8 circuits terminaux par dispositif de protection à
  courant différentiel-résiduel mentionné ci-avant. »
- 6.5.8.1 point 1, p. 207 (parties réalisées à partir du 1/6/2020, contrôlées selon 6.4) : « Il est autorisé, en
  dérogation aux prescriptions du 5ème alinéa du point b. de la sous-section 4.2.4.3. pour les installations
  électriques dont l'exécution sur place a été entamée avant le 01/06/2023, de ne pas protéger les circuits visés aux
  points 1 et 2 par un dispositif de protection à courant différentiel-résiduel à haute ou très haute sensibilité.
  Cette dérogation est aussi d'application sur toute modification ou extension non-importante apportée sur ces
  circuits. » Deux autres alinéas : plus de huit circuits par 30 mA (6e alinéa) ; « un dispositif […] pour l'ensemble
  des circuits d'éclairage et un dispositif […] pour chaque autre circuit ou groupe de circuit comportant au maximum
  seize socles » (10e alinéa).
- 8.2.1 point 16 (p. 276) et 8.2.2 point 10 (p. 278) : mêmes trois dérogations, **sans date limite**, pour les parties
  d'avant 2020 (8.2.2 : sous réserve de l'examen de conformité).
- Disposition transitoire, 4.2.4.3 b, p. 101 : « L'application du point 1 de la sous-section 6.5.8.1. est autorisée
  pour les installations électriques et les modifications ou extensions importantes dont la réalisation du projet ou
  des travaux est entamée avant le 01/06/2023, à condition que le contrôle de conformité avant la mise en usage aura
  lieu à partir du 01/06/2023. L'organisme agréé qui est chargé avec le contrôle de conformité avant la mise en usage
  est informé de l'application du point 1 de la sous-section 6.5.8.1. L'organisme agréé fait mention dans le rapport
  de contrôle de l'application du point 1 de la sous-section 6.5.8.1. »
- Définition, p. 47 : « Exemples de modification importante ou d'extension importante: […] ajout d'un circuit dans une
  installation domestique, … »

### Analyse

**Numérotation des alinéas.** Compté naïvement sur le PDF (p. 100-101), le paragraphe des circuits 1 à 4 est le 4e. Les
renvois internes du texte (« Les prescriptions du 5ème alinéa ne sont pas d'application aux éventuels dispositifs […]
supplémentaires », « tout autre circuit non visé au 5ème alinéa », « visé au 8ème alinéa » dans le paragraphe des
30 Ω) ne sont cohérents que si ce paragraphe est le 5e : le texte compte avec un décalage d'une unité. Avec ce
décalage : 5e = circuits 1 à 4 ; 6e = 8 circuits ; 8e = circuits raccordables à l'origine (appareils fixes…) ;
10e = règle des 30 Ω. C'est la lecture du moteur ; elle est la seule cohérente (le 5e alinéa naïf n'a pas de « points
1 et 2 »).

**Avant le 1/6/2023** (déduit des dérogations, le texte antérieur n'étant pas dans la version 07) :

- les dérogations ne visent que les points 1 et 2 → les points 3 (lieux avec baignoire ou douche) et 4 (lave-linge,
  sèche-linge, lave-vaisselle) sous 30 mA étaient déjà exigés, et le restent **pour toutes les parties, même d'avant
  1981** (aucune dérogation en 8.2.1 point 16 ni en 8.2.2 point 10 sur ces points) ;
- pas de limite de 8 circuits par 30 mA ;
- en cas de terre > 30 Ω : un 30 mA pour l'ensemble de l'éclairage et un 30 mA par circuit ou groupe d'au plus 16
  socles (forme conservée par la dérogation du 10e alinéa, voir point 6).

**Nouveau depuis le 1/6/2023** : prises non destinées à un appareil fixe (point 1) et éclairage (point 2) sous 30 mA ;
8 circuits terminaux au plus par 30 mA ; nouvelle règle des 30 Ω (au moins deux 30 mA, 16 socles au plus chacun, plus
un 100 mA pour les circuits du 8e alinéa).

**Ce que « date » veut dire.** C'est la date à laquelle l'exécution sur place a été « entamée », pas la date de fin ni
celle du contrôle. Pour un projet entamé avant et contrôlé après le 1/6/2023, la dérogation est un choix qui doit être
signalé à l'organisme agréé et mentionné au rapport (T5).

**Modifications.** La dérogation s'étend aux modifications « non-importantes » des circuits concernés. Un circuit
ajouté est une modification importante (définition p. 47) : il suit la règle de 2023, même s'il est raccordé à un
tableau ancien. Et un 30 mA ancien qui reçoit un 9e circuit après le 1/6/2023 n'est plus « laissé en service » tel
quel : le circuit ajouté est en infraction (lecture à confirmer, mais la seule compatible avec « laisser en service »).

### Décision actuelle du moteur

- Salle de bain et lave-linge / sèche-linge / lave-vaisselle : 30 mA exigé quelle que soit la date (conforme au texte).
- Prises et éclairage, 8 circuits : `since2023` (date de la partie, réponse `rgie2023` du tableau, date du projet) ;
  avant → rien ; inconnu → une question par tableau (`R-RCD30-DATE`, `insufficientData`, non bloquant en existant).
- Défauts constatés : T3 (la question n'est jamais posée et la réponse « après » est ignorée quand le projet est en
  « ancien RGIE », ce que l'assistant pose par défaut) ; T5 (dérogation silencieuse pour un projet neuf daté d'avant
  2023 : test existant `installationDate = '2022-01-10'` → `R-RCD30-MAX` disparaît sans mention) ; `R-RCD30-MAX` est
  évalué sur la date du différentiel, pas sur celle des circuits ajoutés en aval.

### Recommandation

1. **Partie de date inconnue** : ne jamais conclure « pas d'exigence ». Statut « informations insuffisantes », non
   bloquant pour une partie existante, avec un message conditionnel (« si l'exécution a été entamée le 1/6/2023 ou après,
   ces prises / cet éclairage doivent être sous un 30 mA : RGIE 4.2.4.3 b ») et une question par tableau (déjà prévu).
   L'hypothèse « ancien RGIE » posée par défaut par l'assistant et l'import doit devenir « inconnu » : seule une
   réponse de l'utilisateur peut fixer l'édition.
2. **Réponse `rgie2023`** : la lire avant le test d'édition ; si elle contredit l'édition du projet (« après 2023 »
   dans un projet déclaré « ancien RGIE »), statut « informations contradictoires ».
3. **Dérogation appliquée** : émettre un constat `derogation` (non bloquant) citant 6.5.8.1 point 1, ou 8.2.1 point 16,
   ou 8.2.2 point 10, pour qu'elle figure au dossier ; pour un projet neuf entamé avant le 1/6/2023, ajouter
   « à signaler à l'organisme agréé (4.2.4.3 b) ».
4. **8 circuits** : compter les circuits sous le 30 mA ; si au moins un circuit de la chaîne aval est daté du 1/6/2023
   ou après et que le total dépasse 8 → non conforme sur ce circuit (et pas « rien »).
5. **Salle de bain / lave-linge** : garder l'exigence sans date, y compris avant 1981.
6. **8.2.2 sans examen de conformité** (T2) : la dérogation ne s'applique pas ; prévoir un fait « partie contrôlée »
   (oui / non / inconnu). Inconnu → vérification à faire.

### Tests à prévoir

- Projet de l'assistant (`rgieVersion: 'old'`), sans date, prises sans 30 mA → `R-RCD30-DATE` (aujourd'hui : rien).
- Même projet, tableau `rgie2023: 'after'` → `R-RCD30` (aujourd'hui : rien) ; `rgie2023: 'before'` → `derogation`.
- Partie 1975 : salle de bain sans 30 mA → non conforme ; prises sans 30 mA → `derogation` (8.2.1 point 16).
- Partie 1998 examinée : prises sans 30 mA → `derogation` (8.2.2 point 10) ; non examinée → vérification.
- Partie 2022 (contrôlée 2022) : 9 circuits sous un 30 mA → `derogation` ; 9e circuit `installedOn: '2024'` → non
  conforme.
- Projet neuf entamé le 2023-05-01, contrôle après : constat `derogation` mentionnant l'information de l'organisme
  agréé.
- Limites : 2023-05-31 → dérogation ; 2023-06-01 → règle de 2023.

### Incertitude restante

Le libellé exact d'avant le 1/6/2023 n'est pas dans la version 07 ; la répartition avant / après est déduite des
dérogations (fiable pour les points 1 et 2, plus fragile pour la règle des 30 Ω). Le cas du 9e circuit ajouté sous un
30 mA ancien est une lecture, pas un texte explicite.

---

## 3. Réseau 3 × 230 V sans neutre

### Texte cité

- Le Livre 1 ne mentionne nulle part un réseau « 3 × 230 V » (recherche sur « 3 x 230 », « 3 × 230 », « 230 V », « sans
  neutre »).
- 2.2.1.2 b.3, p. 13 : « Le schéma IT soit n'a aucun point du réseau (N ou L) relié directement à la terre, soit a un
  point du réseau (N ou L) relié à la terre à travers une impédance suffisamment élevée, les masses de l'installation
  électrique étant mises à la terre soit individuellement, soit en groupes, soit ensemble. »
- 4.4.4.1, p. 119 : « Une détection de surintensité est prévue sur tous les conducteurs de ligne. Elle provoque la
  coupure du conducteur dans lequel la surintensité est détectée mais ne provoque pas nécessairement la coupure des
  autres conducteurs actifs. »
- 4.4.4.2, p. 119 : « Dans les circuits monophasés ou biphasés des installations domestiques, une détection de
  surintensité est réalisée sur les deux conducteurs actifs sauf si à ce niveau existe un dispositif de protection à
  courant différentiel-résiduel qui contient également une détection de surintensité d'un des conducteurs de ligne et
  assure la coupure des deux conducteurs actifs. Ce dispositif a le pouvoir de coupure requis. »
- 4.4.4.3, p. 119 : en schéma **TT ou TN** sans N distribué, la détection peut manquer sur un conducteur de ligne si, au
  même niveau, un différentiel coupe tous les conducteurs de ligne.
- 4.4.4.5, p. 120 : « Dans les installations électriques selon un schéma IT, le conducteur N n'est en principe pas
  distribué. Si toutefois, pour des raisons d'exploitation, il est nécessaire de distribuer le conducteur N, une
  détection de surintensité est prévue sur le conducteur N de tout circuit […] »
- 5.3.5.3 c, p. 168 : « Le dispositif de protection à courant différentiel-résiduel assure la coupure de tous les
  conducteurs actifs du circuit. »
- 5.3.5.5 h, p. 171 : choix des dispositifs contre les courts-circuits (fusibles : « Le courant de court-circuit Icc ne
  doit pas être inférieur à IF » ; disjoncteurs : courant de court-circuit minimal au moins égal à Ia, courant présumé
  inférieur à Ib). **Rien sur le 3 × 230 V, le neutre ou la coupure des deux phases.**
- 4.2.3.4 d.2, p. 95 : coupure non obligatoire au premier défaut si Id × RE ≤ UL ; « S'il est satisfait à la condition
  visée au 1er alinéa, une surveillance permanente est prévue pour indiquer l'existence d'un premier défaut » ; et
  « Lors de l'ajout d'un circuit sur une installation électrique selon un schéma IT et alimenté par une même source
  d'énergie, les prescriptions du point d.2. sont d'application sur l'ensemble de cette installation électrique. »
- 4.2.4.1 a, p. 100 : « Les règles à appliquer dans les installations domestiques sont données à la sous-section
  4.2.4.3. »
- 6.5.8.2 point 5.2, p. 210 (non domestique uniquement) : maintien d'un IT sans surveillance de l'isolement si
  l'exécution a été entamée avant le 01/04/2026, sous conditions ; disposition transitoire 4.2.3.4 e, p. 99.

### Analyse

- Le schéma (IT, TT) dépend de la mise à la terre du réseau du gestionnaire, que le Livre 1 ne décrit pas. Déduire
  « IT » du seul libellé « 3 × 230 V » est une hypothèse.
- **Détection sur les deux conducteurs** : sur ce réseau, les deux conducteurs d'un circuit « monophasé » sont des
  conducteurs de ligne ; 4.4.4.1 impose une détection sur chacun. 4.4.4.2 est plus précis pour le domestique : son
  exception (disjoncteur différentiel qui détecte sur « un des conducteurs de ligne » et coupe les deux) vise
  expressément aussi les circuits « biphasés ». Lu à la lettre, un disjoncteur différentiel 1P+N est donc admis sur un
  circuit biphasé, à condition que l'appareil ait « le pouvoir de coupure requis » sur le pôle « N » raccordé à une
  phase (question de produit, non tranchée par le RGIE). Le choix du moteur (vérification à faire) est cohérent.
- **Disjoncteur 1P+N ou 1P simple, fusible unique** : une seule détection sur deux conducteurs de ligne → infraction à
  4.4.4.1 et 4.4.4.2, quel que soit le schéma. Non conforme bloquant : justifié.
- **Coupure des deux phases** : imposée pour le différentiel (5.3.5.3 c). Pour le disjoncteur, 4.4.4.1 n'impose pas la
  coupure des autres conducteurs ; l'exigence d'une coupure omnipolaire viendrait du sectionnement (5.3.3), non relu
  ici.
- **Circuits triphasés sur 3 × 230 V** : si le schéma est IT, l'allègement de 4.4.4.3 (réservé au TT / TN) ne s'applique
  pas → détection sur les trois conducteurs de ligne. Le moteur ne vérifie pas les circuits 3P sur ce réseau.
- **4.4.4.5** concerne un IT **avec** N distribué ; il ne s'applique pas à un 3 × 230 V sans neutre, sauf par sa première
  phrase (le N n'est en principe pas distribué).
- **Contrôle de l'isolement** : 4.2.3.4 d.2 l'exige en IT si l'on ne coupe pas au premier défaut. Mais 4.2.4.1 a renvoie
  le domestique à 4.2.4.3 (différentiel 300 mA et 30 mA), et la seule dérogation explicite pour un IT sans surveillance
  (6.5.8.2 point 5.2) est non domestique : rien ne dit en clair si d.2 s'impose à une habitation. Non tranché.
- **Différentiels** : 4.2.4.3 b s'applique sans condition de schéma (300 mA à l'origine, 30 mA en aval).

### Décision actuelle du moteur

`noNeutral` = expression régulière sur `meta.supply`. `R-POLES-NO-NEUTRAL` (high) : 1P ou 1P+N sur disjoncteur ou fusible
→ non conforme bloquant ; disjoncteur différentiel 1P+N → `manualCheck`. Essai : conforme à cette description ;
rien sur 3N × 400 V. Le champ `meta.earthing` (TT / TN / IT, TT par défaut) n'est utilisé par aucune règle.

### Recommandation

1. Garder `R-POLES-NO-NEUTRAL` : 1P / 1P+N simples → non conforme (4.4.4.1, 4.4.4.2) ; disjoncteur différentiel 1P+N →
   vérification à faire, motif « 4.4.4.2 admet une détection sur un seul conducteur de ligne pour ce dispositif ;
   vérifier qu'il est prévu pour être raccordé entre deux phases ».
2. Ne pas déduire le schéma du texte « 3 × 230 » : remplacer l'expression régulière par un champ structuré (tension,
   neutre distribué oui / non) et utiliser `meta.earthing`. Si « 3 × 230 V » avec schéma déclaré TT → vérification à
   faire « schéma à confirmer auprès du gestionnaire de réseau » (non bloquant).
3. Si `earthing === 'IT'` : circuit triphasé protégé en 3P sans détection sur chaque phase → non conforme (4.4.4.1 ;
   4.4.4.3 non applicable) ; surveillance du premier défaut → vérification à faire (4.2.3.4 d.2, applicabilité au
   domestique non tranchée), non bloquante ; ajout d'un circuit → rappel que d.2 vaut pour toute l'installation.
4. Ne rien rendre bloquant sur le schéma lui-même tant que la question 3 du dossier de validation est ouverte.

### Tests à prévoir

- 3 × 230 V : 1P+N disjoncteur → non conforme ; 1P → non conforme ; fusible 1P+N → non conforme ; 2P → rien ;
  disjoncteur différentiel 1P+N → vérification ; 3 × 230 écrit « 3x230 », « 3 × 230 V », « 230V 3F » (aujourd'hui non
  reconnu : à couvrir par le champ structuré).
- `earthing: 'IT'` + circuit triphasé 3P → rien ; protection 2 pôles sur un circuit triphasé → non conforme.
- `earthing: 'TT'` + 3 × 230 V → vérification « schéma à confirmer ».

### Incertitude restante

Schéma réel des réseaux 3 × 230 V (prescriptions des gestionnaires non consultées) ; application de 4.2.3.4 d.2 au
domestique ; aptitude des disjoncteurs différentiels 1P+N à être raccordés entre deux phases (normes produit).

---

## 4. Disjoncteurs 1P+N (4.4.4.1, 4.4.4.2)

### Texte cité

- 4.4.4.1 et 4.4.4.2, p. 119 : voir point 3.
- 2.4.1, p. 22 : « Conducteur actif: conducteur affecté à la transmission de l'énergie électrique. Les conducteurs de
  ligne et neutre, même si ces conducteurs sont utilisés comme conducteurs de protection (conducteur PEN, PEM ou PEL)
  sont couverts par cette définition. »
- 4.4.4.4, p. 120, titre : « Circuits triphasés en schéma TT et TN à conducteur N distribué en courant alternatif –
  Protection du conducteur N » ; premier tiret : pas de détection sur le N si sa section est au moins égale à celle des
  conducteurs de ligne.
- 4.2.3.4 c.4 (schéma TT), p. 94 : « Lorsque dans le circuit considéré, aucun dispositif de protection à courant
  différentiel-résiduel n'est présent, une détection de surintensité est prévue sur le conducteur neutre à l'exception
  des cas particuliers mentionnés à la sous-section 4.4.4.4. »

### Analyse

Deux lectures (déjà exposées dans la question 1 du dossier de validation), avec deux éléments que ce dossier ne cite
pas :

- **Contre la lecture d'usage (B)** : l'argument tiré de 4.4.4.4 est faible, car 4.4.4.4 est intitulé « Circuits
  triphasés » ; il ne vise pas un circuit monophasé, que 4.4.4.2 traite spécialement pour le domestique.
- **Pour la lecture d'usage (B)** : 4.2.3.4 c.4 (TT) n'exige une détection sur le neutre que « lorsque dans le circuit
  considéré, aucun dispositif de protection à courant différentiel-résiduel n'est présent ». Or tout circuit domestique
  est en aval d'un différentiel (4.2.4.3 b). Mais 4.4.4.2 exige, pour l'exception, un différentiel « à ce niveau » et
  qui « contient également une détection de surintensité » : c'est plus strict et propre au domestique.

Conclusion : la lecture littérale (A : détection sur la phase et le neutre, sauf disjoncteur différentiel) reste la
plus solide pour le domestique, en tant que disposition spéciale. Ses conséquences (un très grand nombre
d'installations récentes non conformes) justifient de ne pas la rendre bloquante sans avis. Un 1P (neutre ni protégé ni
coupé) échoue aux deux lectures pour 4.4.4.2 et mérite au moins une vérification.

### Décision actuelle du moteur

Rien sur un réseau avec neutre ; pôle par défaut d'un nouveau disjoncteur : « 1P+N ». Aucune règle bloquante ajoutée
(M9).

### Recommandation

1. **Conception (partie neuve)** : proposer 2P (deux pôles protégés) ou un disjoncteur différentiel par défaut, ce qui
   satisfait les deux lectures sans rien affirmer de contestable.
2. **Réseau avec neutre, disjoncteur 1P+N non différentiel** : une seule vérification à faire par tableau (pas un constat
   par disjoncteur), non bloquante, citant 4.4.4.2 et 2.4.1, en attendant la réponse à la question 1 du dossier.
3. **1P (sans coupure du neutre)** sur un circuit monophasé domestique : vérification à faire, non bloquante.
4. Si l'expert retient la lecture A : non conforme pour une partie neuve ; pour l'existant, suivre sa réponse.

### Tests à prévoir

- 3N × 400 V, partie neuve, 1P+N derrière un 30 mA → une vérification par tableau, non bloquante ; disjoncteur
  différentiel 1P+N → rien ; 2P → rien ; 1P → vérification.
- Pôle par défaut d'un nouveau disjoncteur en conception : 2P.
- Non-régression 3 × 230 V (point 3).

### Incertitude restante

Forte : interprétation de 4.4.4.2 face à 4.2.3.4 c.4 et pratique des organismes agréés (question 1).

---

## 5. Sections des circuits de commande (5.2.1.2, tableau 5.1)

### Texte cité

5.2.1.2, p. 129 : « Pour les canalisations électriques qui ne font pas partie intégrante d'une machine ou d'un
appareil électrique, l'emploi de conducteurs isolés d'une section inférieure à 2,5 mm² est interdite. Toutefois, des
exceptions sont admises pour les conducteurs des canalisations électriques reprises dans le tableau 5.1. »

Tableau 5.1, p. 129. **L'extraction texte est désordonnée** (les trois sections sont empilées à gauche, les descriptions
sont fusionnées). Reconstitution, puis **vérification sur le rendu image de la page PDF 141** : la correspondance est
certaine, une ligne par section.

| Section minimale (mm²) | Canalisations électriques |
|---|---|
| 1,5 | « Canalisations électriques appartenant à des circuits ne comportant pas de socle de prise de courant, à l'exception de socle de prise de courant unique d'une intensité nominale de 2,5 A intégré dans des luminaires. » |
| 0,75 | « Canalisations électriques appartenant à des circuits intégrés dans des tableaux de répartition et de manoeuvre et alimentant un socle de prise de courant simple. Les dispositifs de protection de ces canalisations électriques sont adaptés pour la section de ces canalisations électriques. » |
| 0,5 | « Canalisations électriques appartenant à des circuits de commande, contrôle, signalisation et mesure. » |

Dérogations pour l'existant :

- 8.2.1 point 5, p. 274 (avant le 1/10/1981) : « de laisser en service les canalisations électriques dont les
  conducteurs isolés ont une section inférieure à 2,5 mm², mais au moins égale à 1 mm². Les conducteurs de 1 mm² sont
  protégés contre les surintensités, soit par un dispositif fusible d'intensité nominale au plus égale à 6 A, soit par
  un disjoncteur de taille 12 au maximum ou de courant nominal de 10 A au maximum » ; point 3 (p. 274) : présence d'un
  circuit de moins de 1,5 mm² « signalée au moyen d'une affichette » (figure 8.1) sur la porte du tableau.
- 8.2.2 point 5, p. 277-278 : « du tableau 5.1. de la sous-section 5.2.1.2., de laisser en service les canalisations
  électriques EMCB et EMCVB d'une section de 1 mm² et les canalisations électriques CTLB et VTLB d'une section de 0,75 mm²
  à condition qu'elles font partie de circuits sans socles de prise de courant, pour les installations électriques dont
  l'exécution sur place a été entamée avant le 17 mai 1986. Les dispositifs de protection de ces canalisations
  électriques sont adaptés pour la section de ces canalisations électriques ».

### Analyse

- Le tableau 5.1 fixe trois minima selon l'usage, pas un minimum unique de 1,5 mm². La protection doit être adaptée à la
  section (tableau 4.11 : 0,5 mm² → fusible 2 A / disjoncteur 4 A ; 0,75 mm² → 4 A / 6 A).
- Un circuit qui alimente un socle (hors socle unique de 2,5 A intégré dans un luminaire, et hors circuit interne au
  tableau vers un socle simple) reste à 2,5 mm² minimum.
- La description de M7 (« 0,75 / 0,5 mm² pour certains circuits, dont commande… ») est imprécise : la commande, le
  contrôle, la signalisation et la mesure sont à **0,5 mm²** ; 0,75 mm² ne vaut que pour le circuit interne au tableau
  qui alimente un socle simple.

### Décision actuelle du moteur

`R-CABLE-MIN` : section < 1,5 → non conforme, `hazard: high`, bloquant même dans l'existant. `R-SOCKET-SECTION` :
< 2,5 sur un circuit avec prise → non conforme (existant : recommandation, `hazard: medium`). Essais : circuit de
commande en 0,5 mm² protégé à 2 A (neuf) → non conforme bloquant (faux positif) ; partie de 1975, 1 mm² sur fusible
6 A → non conforme bloquant (faux positif au regard de 8.2.1 point 5).

### Recommandation

1. Ajouter au câble (ou au circuit) une propriété d'usage : `puissance` (défaut), `commande` (commande, contrôle,
   signalisation, mesure), `tableau-socle` (circuit interne au tableau alimentant un socle simple). Défaut prudent :
   `puissance`.
2. Minima : puissance sans socle 1,5 ; avec socle 2,5 (sauf socle unique de 2,5 A intégré au luminaire) ; `tableau-socle`
   0,75 ; `commande` 0,5. En dessous → non conforme (partie neuve). Calibre au-delà du tableau 4.11 → `R-CABLE-PROT`
   (déjà en place pour 0,5 et 0,75).
3. Partie d'avant le 1/10/1981 : 1 mm² ≤ section < 1,5 avec fusible ≤ 6 A ou disjoncteur ≤ 10 A → `derogation`
   (8.2.1 point 5) + vérification documentaire de l'affichette (8.2.1 point 3) ; au-delà de ces calibres → non conforme.
   Moins de 1 mm² (hors commande) → non conforme.
4. Partie ancien RGIE entamée avant le 17/5/1986, examinée : 1 mm² (EMCB / EMCVB) ou 0,75 mm² (CTLB / VTLB) sur un
   circuit sans socle → `derogation` (8.2.2 point 5) ; le type de câble étant rarement connu → vérification à faire si
   le type n'est pas renseigné.
5. Usage inconnu et section < 1,5 dans un relevé : vérification à faire plutôt que non conforme bloquant.

### Tests à prévoir

- Neuf : commande 0,5 mm² / 2 A → rien ; commande 0,5 / 6 A → `R-CABLE-PROT` ; puissance 0,75 → non conforme ;
  `tableau-socle` 0,75 / 6 A → rien ; circuit avec socle en 1,5 → `R-SOCKET-SECTION` ; luminaire avec socle 2,5 A intégré
  en 1,5 → rien.
- 1975 : 1 mm² / fusible 6 A → `derogation` + vérification affichette ; 1 mm² / fusible 10 A → non conforme ;
  0,75 mm² puissance → non conforme.
- 1984 examiné : VTLB 0,75 sans socle → `derogation` ; même câble en 1987 → non conforme.

### Incertitude restante

Faible sur le tableau (vérifié sur l'image). Reste à définir comment l'utilisateur qualifie un circuit de « commande »
(bus domotique en TBTS, retour de télérupteur…), ce qui relève du modèle et non du texte.

---

## 6. Limites de résistance de terre

### Texte cité

- 4.2.3.2, p. 84 : « Pour les installations domestiques et les parties communes d'un ensemble résidentiel, la prise de
  terre est réalisée conformément aux dispositions de la sous-section 5.4.2.1. et sa résistance de dispersion est
  inférieure à 100 Ω. » (le symbole Ω est perdu dans l'extraction texte : « inférieure à 100 . »)
- 4.2.4.3 b, p. 101 (10e alinéa selon la numérotation du texte) : « Si la résistance de dispersion de la prise de terre
  est supérieure à 30 ohms, le nombre de dispositifs de protection à courant différentiel-résiduel à haute ou très
  haute sensibilité visé au 5ème alinéa est au moins de deux. Chaque dispositif de protection à courant
  différentiel-résiduel reprend au maximum seize socles de prise de courant simples ou multiples. Un appareil fixe ou un
  ensemble d'appareils fixes commandé par un appareil de manœuvre commun est assimilable à un socle de prise de courant.
  Pour protéger les circuits visés au 8ème alinéa, les dispositifs de protection à courant différentiel-résiduel placés
  à l'origine de l'installation électrique sont aussi complétés par au moins un dispositif de protection à courant
  différentiel-résiduel d'un courant différentiel de fonctionnement de maximum 100 mA par circuit ou groupe de
  circuits. »
- Dérogations au 10e alinéa : 6.5.8.1 point 1 (exécution entamée avant le 01/06/2023, p. 207), 8.2.1 point 16 (p. 276),
  8.2.2 point 10 (p. 278) : « laisser en service un dispositif de protection à courant différentiel-résiduel à haute ou
  très haute sensibilité pour l'ensemble des circuits d'éclairage et un dispositif de protection à courant
  différentiel-résiduel à haute ou très haute sensibilité pour chaque autre circuit ou groupe de circuit comportant au
  maximum seize socles de prise de courant simples ou multiples ».
- 6.4.6.4 b.4, p. 203 : le rapport de contrôle « certifie l'adéquation: a) entre les dispositifs de protection à courant
  différentiel-résiduel installés et la valeur de la résistance de dispersion de la prise de terre ».

### Analyse

- **100 Ω** : aucune dérogation. Le mot « dispersion » n'apparaît pas dans la partie 8 ; 6.5.8.1 et 6.5.8.2 n'en parlent
  pas. La limite s'applique à toutes les parties, de toutes les dates. Strictement « inférieure à » : 100 Ω pile est
  non conforme (correction M8 juste).
- **Au-dessus de 30 Ω** : ce n'est pas un simple avertissement, c'est une exigence de configuration des différentiels.
  - Partie entamée le 1/6/2023 ou après : au moins deux 30 mA, chacun au plus 16 socles (un appareil fixe ou un groupe
    commandé ensemble compte pour un socle), et au moins un ≤ 100 mA par circuit ou groupe pour les circuits raccordés à
    l'origine (appareils fixes, etc.).
  - Partie antérieure (6.5.8.1, 8.2.1, 8.2.2) : la dérogation conserve une configuration qui comporte quand même des
    30 mA : un pour tout l'éclairage, un par circuit ou groupe d'au plus 16 socles. Combinée à la dérogation du 5e alinéa
    (pas de 30 mA obligatoire sur prises et éclairage avant 2023), la lecture la plus probable est : avec une terre
    > 30 Ω, même une partie ancienne doit avoir l'éclairage et les prises sous 30 mA (groupes de 16 socles au plus).
    C'est une lecture, à confirmer.
- **Avant / après 2023** : seule la forme de la règle des 30 Ω change à cette date ; le seuil de 30 Ω lui-même existait
  déjà (il figure dans la dérogation qui conserve l'ancienne forme).

### Décision actuelle du moteur

`R-EARTH-VALUE` : ≥ 100 Ω → non conforme, `hazard: high`, bloquant partout (conforme au texte). `R-EARTH-30` : > 30 et
< 100 → avertissement non bloquant, sans examen des différentiels. Essai : RE = 50 Ω, partie neuve, un seul 30 mA →
seulement l'avertissement. Faux négatif.

### Recommandation

1. Garder `R-EARTH-VALUE` tel quel (aucune dérogation à créer).
2. Nouvelle règle (ex. `R-EARTH-30-RCD`), quand RE mesurée > 30 Ω et < 100 Ω :
   - partie du 1/6/2023 ou après : moins de deux 30 mA, ou plus de 16 points (socles + appareils fixes / groupes) sous
     un même 30 mA, ou circuit raccordé à l'origine hors 30 mA sans différentiel ≤ 100 mA → non conforme ;
   - partie antérieure : éclairage non entièrement sous un 30 mA, ou groupe de plus de 16 socles par 30 mA → vérification
     à faire (lecture à confirmer), avec citation de la dérogation ;
   - date inconnue → informations insuffisantes.
3. Mesure absente : le constat `R-MEAS-MISSING` existant suffit ; ne rien déduire.
4. Garder l'avertissement `R-EARTH-30` comme rappel de l'adéquation exigée par 6.4.6.4 b.4.

### Tests à prévoir

- 99,9 Ω → règle des 30 Ω ; 100 Ω → non conforme (déjà) ; 30 Ω pile → rien (« supérieure à 30 ohms ») ; 30,1 Ω → règle.
- RE 50 Ω, partie 2024 : un seul 30 mA → non conforme ; deux 30 mA avec 17 socles sur l'un → non conforme ; deux 30 mA
  avec 16 et 10 → rien ; chauffe-eau raccordé à l'origine sans ≤ 100 mA → non conforme.
- RE 50 Ω, partie 1998 : éclairage hors 30 mA → vérification ; partie de 1975 : idem.

### Incertitude restante

Moyenne : combinaison des dérogations des 5e et 10e alinéas pour les parties d'avant 2023 ; comptage des « points »
(un appareil fixe compte pour un socle, comme en 5.3.5.2 b).

---

## 7. Calibres maximaux et courant admissible (4.4.1.4, tableau 4.11)

### Texte cité

- 4.4.1.4, p. 116 : « Le courant admissible IZ d'une canalisation électrique est fonction: de la section des
  conducteurs; de l'isolation des conducteurs; de la constitution de la canalisation électrique; du mode de pose et de
  l'environnement des canalisations électriques; de la température ambiante. » Puis, p. 117 : « Pour les installations
  domestiques, l'intensité nominale maximale des coupe-circuit à fusibles ou l'intensité maximale du disjoncteur qui
  protègent une canalisation électrique est donnée au tableau 4.11., en fonction de la section des conducteurs ».
- Tableau 4.11, p. 117 (extraction propre, deux colonnes) : 0,5 → 2 / 4 A ; 0,75 → 4 / 6 ; 1 → 6 / 10 ; 1,5 → 10 / 16 ;
  2,5 → 16 / 20 ; 4 → 20 / 25 ; 6 → 32 / 40 ; 10 → 50 / 63 ; 16 → 63 / 80 ; 25 → 80 / 100 ; 35 → 100 / 125.
- 4.4.3.2, p. 118 : le courant nominal In est « égal ou supérieur au courant d'emploi IB du circuit et inférieur au
  courant admissible IZ dans la canalisation électrique qu'ils protègent ».
- Définition, p. 9 : sont non domestiques « les parties communes et les locaux techniques d'un ensemble résidentiel ».

### Analyse

- Le tableau 4.11 est un plafond **pour le domestique**. Il ne dispense pas de la condition In < IZ (4.4.3.2), qui
  dépend du mode de pose : un 2,5 mm² sous 20 A peut être trop protégé au regard du tableau mais insuffisant selon le
  mode de pose (isolation thermique, groupement, température).
- Le moteur reprend exactement le tableau (`TABLE_4_11`, valeurs vérifiées ligne par ligne) et choisit la bonne colonne
  (fusible / disjoncteur, disjoncteur différentiel compris). Section intermédiaire → ligne inférieure : prudent.
  Au-delà de 35 mm² : rien (pas de valeur inventée) : correct.
- Champ « domestique » : le moteur n'a pas d'indicateur domestique / non domestique ; il applique le tableau partout.
  Pour des parties communes ou locaux techniques (non domestiques), le tableau ne s'applique pas ; seule la condition
  In < IZ compte.
- 8.2.1 point 5 (1 mm² : fusible ≤ 6 A, disjoncteur ≤ 10 A) coïncide avec la ligne 1 mm² du tableau : pas de conflit.

### Décision actuelle du moteur

`R-CABLE-PROT` (corrigé, M1 / M2) : non conforme si le calibre dépasse le tableau, `hazard: high`, bloquant y compris
dans l'existant. IZ selon le mode de pose : non calculé.

### Recommandation

1. Garder `R-CABLE-PROT` tel quel pour le domestique (statut non conforme justifié dans toutes les parties ; aucune
   dérogation de la partie 8 ne vise la coordination section / protection, sinon pour la confirmer).
2. Ajouter un indicateur de domaine (`domestique` / `non domestique`, au niveau du projet et surchargeable par partie,
   ex. parties communes). Non domestique → ne pas appliquer le tableau ; vérification à faire « In < IZ selon le mode
   de pose (4.4.3.2) ».
3. Quand le mode de pose est renseigné et défavorable (encastré dans un isolant, groupement, ambiance chaude) :
   vérification à faire « IZ à confirmer », non bloquante, même si le tableau est respecté. Ne jamais afficher
   « conforme » pour la coordination sans réserve : préciser « conforme au tableau 4.11 ».
4. Section > 35 mm² : vérification à faire (IZ), au lieu de rien.

### Tests à prévoir

- Déjà couverts : 11 lignes × 2 colonnes, limites, > 35 mm².
- Nouveaux : partie non domestique, 2,5 mm² / disjoncteur 25 A → pas de `R-CABLE-PROT`, vérification IZ ; 50 mm² →
  vérification ; mode de pose « isolant » sur 2,5 / 20 A → `R-CABLE-PROT` absent, vérification IZ présente.

### Incertitude restante

Faible sur le tableau ; le calcul d'IZ dépend de règles de l'art que le Livre 1 ne donne pas (« calculée conformément
aux règles de l'art », p. 117).

---

## 8. Installations à plusieurs périodes de réalisation ou de modification

### Texte cité

- 8.1.1, p. 272 : « Installation électrique existante: toute installation électrique ou partie d'une installation
  électrique dont l'exécution sur place a été entamée avant la date d'entrée en vigueur du présent Livre et qui n'a pas
  fait l'objet d'un contrôle de conformité conformément au chapitre 6.4. du présent Livre. » Catégories : ancienne
  installation domestique (réalisation « entamée avant le 1/10/1981 », contrôlée ou non) ; installation domestique
  ancien RGIE (« qui a fait l'objet d'un examen de conformité conformément à l'ancien RGIE »).
- 8.2.1, p. 273 ; 8.2.2, p. 276 : « Certaines dispositions dérogatoires peuvent s'appliquer seulement jusqu'à une date
  limite de réalisation sur place telle que définie dans les dispositions dérogatoires concernées ». Dates de 8.2.2 :
  17/5/1986 (tableau 5.1), 22/7/1986 (câbles armés en salle de bain), 16/9/1991 (différentiel et interrupteur général
  < 40 A), 7/5/2000 (marquage 3000 A), 2/7/2003 (sectionnement), 31/12/2007 (classe de limitation 3), 4/9/2013
  (réaction au feu).
- 6.5.8.1, p. 207 : dérogations pour les parties « dont l'exécution sur place a été entamée à partir du 1er juin 2020
  et qui ont fait l'objet d'un contrôle de conformité avant la mise en usage » ; dates 01/06/2023 et 01/03/2025.
- 6.4.7.3, p. 204 : « Toute modification importante ou extension importante […] fait l'objet d'un contrôle de
  conformité aux prescriptions du présent Livre avant la mise en usage de la dite modification ou extension. Ce
  contrôle de conformité est limité à la partie ajoutée ou modifiée de l'installation. » et « Toute modification ou
  extension ayant un impact sur la partie non modifiée doit être mentionnée dans le rapport de contrôle. Cette partie
  non modifiée doit faire l'objet d'un contrôle de conformité en ce qui concerne les caractéristiques modifiées. »
- Définition, p. 47 : modification importante = « modification ou extension d'une installation électrique qui a un
  impact supplémentaire (pas encore couvert par un contrôle de conformité) sur la sécurité des personnes ou des biens »,
  exemples dont « remplacement non-identique d'un tableau de répartition et de manœuvre, ajout d'un circuit dans une
  installation domestique ».
- 4.2.4.3 b, 3e alinéa, p. 101 : « Dans le cas d'une modification importante ou d'une extension importante dans une
  ancienne installation électrique domestique visée dans la partie 8, l'ensemble de l'installation électrique est
  protégé par au moins un dispositif de protection à courant différentiel-résiduel exigé au 1er alinéa. »
- 8.4.1, p. 280-281 (visite avant renforcement du raccordement) : conformité au Livre 1 « à l'exception de la partie 8
  pour la partie dont l'exécution a été entamée après la date d'entrée en vigueur du présent Livre » et « y compris la
  partie 8, pour la partie dont l'exécution a été entamée avant ».
- 7.22.1, p. 247-248 : le chapitre des bornes de recharge s'applique aux bornes « dont leur réalisation ou leur
  remplacement est entamé(e) à partir du 1/11/2022 ».
- Aperçu des versions (p. 3 du PDF) : 01/06/2020, 01/11/2022, 01/06/2023, 01/03/2025, 01/04/2026, 01/11/2026.

### Analyse

Le texte raisonne **par partie et par date de début d'exécution sur place**, avec deux conditions supplémentaires :
avoir été contrôlée (8.2.2 : examen selon l'ancien RGIE ; 6.5.8.1 : contrôle selon 6.4) et la nature de la
modification (importante : la partie ajoutée suit les règles en vigueur ; non importante : la dérogation 30 mA s'étend
expressément à elle). Il n'existe pas de « régime existant » unique : chaque exigence a ses propres dérogations, avec
leurs dates.

Comparaison avec `context.ts` :

| Point | Texte | Moteur | Écart |
|---|---|---|---|
| Unité d'analyse | la partie | la chaîne de l'élément, la plus proche gagne | correct |
| Date | « entamée » (début d'exécution) ; 8.2.1 / 8.2.2 disent aussi « réalisée » dans leur phrase d'introduction | `installedOn` = « date de réalisation », sens non précisé | à préciser : début d'exécution |
| Éditions | 6 versions datées | 3 éditions + constante 2025 | 2022 (bornes, 7.22), 2026-04 (IT, PEN non domestique), 2026-11 absents |
| Partie 1981-2020 | dérogations 8.2.2 seulement si examen de conformité | dates seules | T2 |
| Partie 2020+ existante | Livre 1 complet sauf 6.5.8.1 | « recommandation » pour tout ce qui n'est pas `hazard: high` | T1 (faux négatifs) |
| Projet sans date (assistant, import) | inconnu | édition 1981 supposée | T3 (faux négatifs) |
| Dérogation de date | à mentionner au rapport, et à signaler à l'organisme agréé pour un projet entamé avant et contrôlé après | silencieuse | T5 |
| Modification importante | la partie ajoutée suit les règles du moment ; impact sur la partie non modifiée à contrôler | rien de spécifique ; règles portant sur un appareil commun (30 mA, 8 circuits) évaluées à la date de l'appareil | voir point 2, recommandation 4 |
| Partie d'avant 1981 + modification importante | tout l'ensemble sous un différentiel ≤ 300 mA | `R-RCD-MAIN` exigé partout (plus strict) | acceptable (sens de la sécurité) ; voir incertitude |

### Recommandation

1. **Modèle de partie** : `executionStart` (début d'exécution, AAAA, AAAA-MM ou AAAA-MM-JJ), `controlled` (oui / non /
   inconnu : examen ancien RGIE ou contrôle 6.4 selon la date), `modification` (`none` / `nonImportant` / `important`) ;
   héritage par la chaîne, comme aujourd'hui. Pas d'édition supposée par défaut : sans réponse → inconnu.
2. **Régime calculé par partie** : `pre1981` (8.2.1) ; `ancienRGIE` (8.2.2, si `controlled`) ; `ancienRGIE-non-controle`
   (aucune dérogation de 8.2.2 ; texte complet ; à signaler) ; `livre1` (6.5.8.1, si contrôlée) ; `conception` (neuf) ;
   `inconnu`.
3. **Table des dérogations** (données, pas code dispersé) : `{ id, article, page, règles visées, régimes, date limite
   d'exécution, s'étend aux modifications non importantes, condition (ex. 30 mA présent, calibre ≤ 6 A) }`. Une règle
   violée devient : `derogation` si une dérogation s'applique (avec sa référence, pour le rapport) ; `manualCheck` ou
   `insufficientData` si son applicabilité dépend d'un fait inconnu (date, contrôle, type de câble) ; sinon
   `nonCompliant`. Le statut `recommendation` est réservé à ce qui n'est pas une exigence.
4. **Bloquant** : décision de produit distincte du statut ; ne jamais changer le statut pour éviter le blocage.
5. **Appareil commun à plusieurs périodes** (différentiel, tableau) : évaluer chaque exigence qui dépend de ce qu'il
   protège avec la date la plus récente des parties concernées (8 circuits, type A pour un circuit neuf, 30 Ω).
6. **Éditions** : compléter `BE_EDITIONS` (ou mieux, dater chaque exigence) avec les six versions ; 7.22 (bornes) à
   partir du 1/11/2022.
7. **Assistant et import** : ne plus poser `rgieVersion: 'old'` ; poser la question de la date par tableau.

### Tests à prévoir

- Projet mixte : tableau de 1975 (8.2.1), circuit ajouté en 2024 → le circuit 2024 suit toutes les règles (30 mA prises,
  type A, 8 circuits) ; le reste suit 8.2.1, avec constats `derogation` cités.
- Partie 1998 non examinée → pas de dérogation 8.2.2 ; vérification « contrôle ancien RGIE inconnu » si inconnu.
- Partie 2021 existante contrôlée : prises > 8 → non conforme (aucune dérogation) ; prises sans 30 mA → `derogation`
  (6.5.8.1 point 1).
- Modification non importante d'un circuit de 2021 en 2024 → dérogation 30 mA maintenue ; ajout d'un circuit en 2024 →
  règle de 2023.
- Projet de l'assistant sans date → aucune édition supposée, questions posées.
- Borne de recharge de 2021 → pas de 7.22.3 ; de 2023 → 7.22.3.
- Limites de chaque date de 8.2.2 (veille / jour même).

### Incertitude restante

- Sens de « réalisée » (introductions de 8.2.1 et 8.2.2) face à « entamée » (8.1.1 et chaque dérogation) : la note
  retient le début d'exécution.
- Statut d'une partie de 1981-2020 jamais examinée : le texte ne lui donne pas de régime propre ; « texte complet » est
  la lecture littérale, sévère.
- 4.2.4.3 b, 3e alinéa : il suggère qu'une ancienne installation non modifiée pourrait ne pas avoir de différentiel
  général, mais 8.2.1 ne contient aucune dérogation explicite au 1er alinéa ; le moteur, plus strict, est du côté de la
  sécurité.
- Contenu exact des versions 03, 06 et 07 hors dispositions transitoires : non lisible dans le texte consolidé.

---

## 9. Régime « existant » du catalogue (`existing`, `classify`)

### Mécanisme actuel

`classify` (context.ts), constat de type `nonCompliance` dans une partie non neuve :
`status = rule.existing ?? (hazard === 'high' ? 'nonCompliant' : 'recommendation')` ; bloquant seulement si
`nonCompliant` **et** `hazard: high`. Donc **oui** : toute règle de gravité `medium` ou `low` sans champ `existing`
devient automatiquement une recommandation dans l'existant, et une règle `high` reste non conforme et bloquante, sans
qu'aucune des deux issues dépende d'une dérogation du texte. La gravité (`hazard`) est, d'après le catalogue lui-même,
« une appréciation de Voltaplan, pas une classification du RGIE ».

### Règle par règle (non-conformités physiques du catalogue)

| Règle | Gravité / `existing` | Résultat actuel en existant | Dérogation réelle | Statut attendu en existant |
|---|---|---|---|---|
| R-EARTH-MISSING | high | non conforme, bloquant | aucune (8.2.1 point 11 vise la section du conducteur de terre, point 12 les canalisations sans conducteur de protection non destinées à du matériel de classe I) | non conforme : justifié |
| R-EARTH-VALUE | high | non conforme, bloquant | aucune (point 6) | non conforme : justifié |
| R-INSULATION | high | non conforme, bloquant | aucune trouvée (non approfondi) | non conforme |
| R-BONDING | high | non conforme, bloquant | **8.2.1 point 13** (p. 276) : liaison équipotentielle principale non exigée avant le 1/10/1981 ; 8.2.1 point 15.2 (salle de bain, à condition de porter le volume 2 à 1 m) | conditionnel : `derogation` pour une partie d'avant 1981 (liaison principale) ; non conforme sinon |
| R-RCD-TEST | high | non conforme, bloquant | aucune | non conforme : justifié |
| R-POLES-NO-NEUTRAL | high | non conforme, bloquant | aucune | non conforme : justifié (point 3) |
| R-RCD-MAIN | high | non conforme, bloquant | aucune explicite (incertitude du 4.2.4.3 b, 3e alinéa, point 8) | non conforme |
| R-RCD30 | high | non conforme, bloquant | salle de bain, lave-linge : aucune ; prises et éclairage : 6.5.8.1 point 1, 8.2.1 point 16, 8.2.2 point 10 (déjà traitées par la date) | conditionnel par point (déjà en place, sauf T2, T3, T5) |
| R-RCD30-MAX | medium, — | **recommandation** | 6.5.8.1 point 1, 8.2.1 point 16, 8.2.2 point 10 (avant le 1/6/2023) ; la règle n'est émise qu'après cette date | **non conforme** (une partie du 1/6/2023 ou après n'a aucune dérogation) |
| R-RCD-TYPE-A | medium, recommendation | recommandation | aucune | voir point 1 : non conforme dès 2020 ; vérification avant |
| R-RCD-HEAD-RATING | medium, recommendation | recommandation (après le 16/9/1991) | 8.2.1 point 2 ; 8.2.2 point 2 (avant le 16/9/1991, examen requis) ; déjà filtrées par la date | **non conforme** pour ce qui reste après filtrage (exécution du 16/9/1991 ou après) ; vérification si examen inconnu |
| R-CABLE-MIN | high | non conforme, bloquant | 8.2.1 point 5 (≥ 1 mm², protection ≤ 6 A / ≤ 10 A) ; 8.2.2 point 5 (EMCB / EMCVB 1 mm², CTLB / VTLB 0,75 mm², sans socle, avant le 17/5/1986) ; tableau 5.1 | conditionnel (point 5) |
| R-CABLE-PROT | high | non conforme, bloquant | aucune | non conforme : justifié |
| R-CABLE-NO-OVERCURRENT | high | non conforme, bloquant | aucune | non conforme : justifié |
| R-SOCKET-EARTH | high | non conforme, bloquant | **8.2.1 point 6 b** (avant 1981 : socle sans contact de terre si canalisation sans conducteur de protection et 30 mA) ; rien en 8.2.2 ni 6.5.8.1. Le même point interdit les socles dont la broche de terre n'est pas reliée à la terre | conditionnel : `derogation` avant 1981 sous 30 mA ; non conforme sinon (et toujours si broche de terre non reliée) |
| R-SOCKET-CHILD | medium, recommendation | recommandation | 8.2.1 point 6 a, 8.2.2 point 6, 6.5.8.1 point 2 : socles conformes au Livre 1 applicable avant le 01/03/2025 | dépend de ce qu'exigeait le texte d'avant 2025 (question 14 du dossier) : vérification à faire |
| R-SOCKET-IPXXD | medium, — | **recommandation** | aucune pour une partie du 01/03/2025 ou après (règle émise seulement dans ce cas) | **non conforme** |
| R-SOCKET-MAX | low, recommendation | recommandation | 8.2.1 point 6 b et 8.2.2 point 6 : plus de 8 socles admis « à condition que la puissance des appareils fixes et à poste fixe raccordés ne dépasse pas la puissance admissible » ; **rien en 6.5.8.1** | avant 2020 : `derogation` si la condition de puissance est vérifiée, sinon vérification à faire ; 2020 et après : **non conforme** |
| R-SOCKET-SECTION | medium, — | **recommandation** | 8.2.1 point 5 (≥ 1 mm², avant 1981) ; 8.2.2 point 5 ne vise que des circuits **sans** socle | avant 1981 : `derogation` (≥ 1 mm², protection adaptée) ; ancien RGIE et 2020+ : **non conforme** |
| R-DEDICATED-CIRCUIT | low, recommendation | recommandation | 8.2.1 point 5 et 8.2.2 point 5 : circuits non dédiés admis ; rien en 6.5.8.1 ; 7.22 seulement pour les bornes entamées à partir du 1/11/2022 | avant 2020 : `derogation` ; 2020 et après : **non conforme** ; borne d'avant le 1/11/2022 : 7.22.3 non applicable |

Constat : seules R-RCD-TYPE-A, R-RCD-HEAD-RATING, R-SOCKET-CHILD, R-SOCKET-MAX et R-DEDICATED-CIRCUIT ont un régime
`existing` explicite, et aucune ne le relie à une dérogation datée. À l'inverse, plusieurs règles `high` (R-BONDING,
R-SOCKET-EARTH, R-CABLE-MIN) restent bloquantes là où une dérogation réelle existe.

### Régime conditionnel proposé

1. Supprimer le défaut implicite (`hazard` → statut). Pour une partie existante, une règle violée est **non conforme**
   sauf si une dérogation de la table (point 8, recommandation 3) s'applique à sa période, à son état de contrôle et à
   sa condition ; alors `derogation`, avec l'article cité pour le rapport (6.5.7.2 b.5).
2. Applicabilité incertaine (date, contrôle, type de câble, puissance inconnus) → `manualCheck` ou `insufficientData`,
   jamais `recommendation`.
3. `recommendation` réservé aux règles qui ne sont pas des exigences du texte (bonnes pratiques Voltaplan, ex. nom de
   circuit) ; une règle « interprétative » en attente d'avis (ex. 1P+N sur réseau avec neutre) prend `manualCheck`.
4. Le caractère bloquant est une politique séparée (ex. : bloquant pour une partie neuve ; pour une partie existante,
   bloquant si gravité élevée), appliquée **après** le statut et sans le modifier.

### Tests à prévoir

Une matrice par règle × régime (`pre1981`, `ancienRGIE` examiné, `ancienRGIE` non examiné, `livre1` 2020-2023,
`livre1` après 2023, `conception`, date inconnue), vérifiant statut, bloquant et référence de dérogation. Cas
prioritaires : R-RCD30-MAX et R-SOCKET-IPXXD en existant récent → non conforme ; R-SOCKET-EARTH avant 1981 sous 30 mA →
dérogation ; R-SOCKET-SECTION en 1998 → non conforme ; R-SOCKET-MAX en 2021 → non conforme.

### Incertitude restante

Contenu des exigences d'avant 2025 pour les socles (question 14) ; vérification de la condition de puissance de 8.2.1
point 6 b (le modèle ne connaît pas toujours la puissance des appareils) ; R-INSULATION non approfondi.

---

## 10. Sélectivité différentielle : en sensibilité ou temporelle (différentiel « S »)

### Texte cité

- Le Livre 1 n'exige nulle part, pour une installation domestique, une sélectivité entre différentiels ; il ne
  mentionne pas de différentiel « S » ou « sélectif » (recherche sur « sélectiv », « type S », « retard »).
- Les seules mentions de la sélectivité concernent les circuits de sécurité, 5.5.7.1 (p. 186) et 5.5.7.2 (p. 186),
  ainsi que 5.6.2.4 (p. 191) : « Le fonctionnement correct d'un circuit de sécurité ne peut pas être affecté par un
  défaut électrique dans un autre circuit. Cela exige la sélectivité entre les dispositifs de protection. »
- Différentiels retardés : 4.3.3.6 d (p. 114), lieux BE2, BE3 ou CA2 : différentiel ≤ 300 mA ; « Le temps maximal de
  retard du différentiel autorisé est indiqué dans le tableau 4.9. » Tableau 4.9 : BE2 et / ou CA2 : « temps de retard
  calculé comme si le différentiel était utilisé comme seule protection active contre les chocs électriques par
  contact indirect » ; BE3 : « non retardé ».
- Zones à risque d'explosion, 7.102.9.2 (p. 263) : différentiel de 300 mA au plus et « un temps de déclenchement non
  retardé ».
- 4.2.4.3 b (p. 100-101) : 300 mA au plus à l'origine, 30 mA immédiatement en aval ; aucune condition de temps ni de
  sélectivité.

### Analyse

- La sélectivité en sensibilité (30 mA sous 300 mA) découle de la structure exigée par 4.2.4.3 b, mais le RGIE ne
  l'exige pas comme telle et n'en fait pas une condition de conformité.
- La sélectivité temporelle (différentiel retardé « S » en amont) est une règle de l'art. Le RGIE ne l'impose pas ; il
  **la limite** dans les lieux BE3 (interdite : non retardé) et BE2 / CA2 (retard calculé), et l'interdit en zone à
  risque d'explosion.
- Les temps de 300 / 500 ms du moteur viennent des normes de produit (déjà relevé en M10).

### Décision actuelle du moteur

- `R-RCD-SELECTIVITY` (`warning`, `low`) : différentiel aval de sensibilité ≥ à celle de l'amont → avertissement non
  bloquant ; conseil : sensibilité plus faible en aval ou différentiel « S » en amont. Présentation correcte (avertissement,
  pas de citation du RGIE) à condition que le message ne parle pas d'une exigence.
- `R-RCD-TRIP` : 500 ms si `rcdType` contient « S ». **Défaut** : le schéma du modèle n'offre pour `rcdType` que
  `AC`, `A`, `F`, `B` (src/model/schema.ts) ; un différentiel « S » ne peut pas être saisi, le seuil de 500 ms n'est
  jamais utilisé (sauf valeur importée hors liste) et un sélectif correct dépassant 300 ms serait signalé. Le type
  (AC / A / F / B) et le caractère retardé (S) sont deux propriétés distinctes et doivent être deux champs.
- Remarque : dans la copie de travail actuelle, rgie.ts lit ces seuils dans `src/regulations/be/values.ts`
  (`RCD_TRIP_MAX`) ; la copie a donc évolué pendant la relecture, sans effet sur ce constat.

### Recommandation

1. Ajouter une propriété distincte « retardé / sélectif (S) » au différentiel.
2. Garder `R-RCD-SELECTIVITY` comme avertissement de bonne pratique, sans référence au RGIE ; ajouter une information
   (non bloquante) quand deux différentiels non retardés de sensibilités différentes sont en série : sélectivité
   seulement partielle (règle de l'art).
3. Nouvelle vérification quand le lieu est déclaré BE3 (ou zone explosive) : différentiel retardé → non conforme
   (tableau 4.9 ; 7.102.9.2) ; BE2 / CA2 : différentiel retardé → vérification à faire (retard calculé).
4. Circuits de sécurité (5.5.7) : hors périmètre domestique, vérification manuelle si le modèle les représente.

### Tests à prévoir

30 mA sous 300 mA → rien ; 300 mA sous 300 mA → avertissement ; 300 mA S en amont d'un 30 mA → rien ; essai 400 ms
sur un S → pas d'avertissement, sur un non retardé → avertissement ; différentiel S dans un lieu BE3 → non conforme.

### Incertitude restante

Faible sur le texte ; les temps de déclenchement relèvent des normes de produit non consultées.

---

## 11. Tableau 5.1 : vérification visuelle

Le rendu `scratchpad/audit/pages/p141.png` (page PDF 141 = page imprimée 129) a été examiné, en plus du rendu
fait pour cette note : le tableau 5.1 a trois lignes, 1,5 mm² (circuits sans socle, sauf socle unique de 2,5 A intégré
dans un luminaire), 0,75 mm² (circuits intégrés dans les tableaux alimentant un socle simple, protection adaptée à la
section), 0,5 mm² (commande, contrôle, signalisation et mesure). La reconstitution du point 5 est confirmée ;
vérification visuelle faite, aucune incertitude restante sur le tableau lui-même.

---

## Synthèse

| N° | Sujet | Décision actuelle | Recommandation | Priorité |
|---|---|---|---|---|
| 1 | Type AC existant | recommandation pour tout l'existant | non conforme dès 2020 ; vérification avant 2020 ; partie ajoutée = neuf | haute |
| 2 | 30 mA avant / après 2023 | correct sur le principe ; question non posée en « ancien RGIE » (T3) ; dérogations silencieuses | corriger T3, constats `derogation`, 8 circuits selon la partie la plus récente | **très haute (T3)** |
| 3 | 3 × 230 V | expression régulière ; 1P / 1P+N non conformes ; disjoncteur différentiel 1P+N à vérifier | garder ; champ structuré ; utiliser `earthing` ; IT : vérifications non bloquantes | moyenne |
| 4 | 1P+N sur réseau avec neutre | rien | 2P par défaut en conception ; une vérification par tableau | moyenne |
| 5 | Tableau 5.1 | < 1,5 bloquant partout | usage du câble (0,5 commande ; 0,75 tableau-socle) ; dérogations 8.2.1 / 8.2.2 | haute (faux positifs bloquants) |
| 6 | Terre | 100 Ω correct ; > 30 Ω avertissement seul | nouvelle règle des 30 Ω (deux 30 mA, 16 socles, 100 mA) | haute |
| 7 | Tableau 4.11 | correct, domestique supposé | indicateur domestique ; vérification IZ | basse |
| 8 | Plusieurs périodes | régime « existant » unique, dates seules | régime par partie, contrôle, table des dérogations | haute (structurelle) |
| 9 | Régime `existing` | gravité ≠ high → recommandation automatique ; high → bloquant même avec dérogation | non conforme sauf dérogation tabulée ; `derogation` citée ; bloquant à part | haute |
| 10 | Sélectivité | avertissement en sensibilité ; « S » non saisissable | champ « retardé » ; BE3 / zone explosive : retardé interdit | basse |
| 11 | Tableau 5.1 (visuel) | — | vérifié sur l'image de la page 129 | fait |
