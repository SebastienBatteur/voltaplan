# Accord de contribution (CLA)

> **Document préparatoire, pas un texte juridique.** Il ne contient aucune clause rédigée pour Voltaplan. Il présente
> des modèles existants et reconnus. Le choix du modèle et son adaptation sont **[à choisir et faire relire par un
> juriste]** avant la première contribution externe.

## Décision (porteur du projet, 2026-11-25)

- Voltaplan reste sous `AGPL-3.0-only` pour tout le monde.
- Le porteur du projet veut **garder la possibilité d'une double licence** : l'AGPL pour tous, et éventuellement
  une autre licence (commerciale, par exemple) accordée à part.
- Règle : **un CLA signé est exigé avant d'accepter toute contribution externe.** Tant que le modèle n'est pas
  choisi, aucune contribution externe n'est fusionnée.

## Pourquoi un CLA

- Seul le **titulaire des droits** peut accorder une licence autre que l'AGPL sur un code. Aujourd'hui, c'est le
  porteur du projet, seul auteur humain du dépôt (audit dans [license-compliance.md](license-compliance.md)).
- Le **DCO** (`Signed-off-by`) certifie l'origine du code et le droit de le proposer sous la licence du projet. Ce
  n'est ni une cession ni une licence élargie : le contributeur garde ses droits et n'accorde que l'AGPL. Avec le
  DCO seul, une contribution externe **ne pourrait pas** être incluse dans une version sous double licence, ni
  passer sous une autre licence (par exemple une future AGPL v4), sans l'accord de son auteur.
- Le CLA règle ce point **avant** la contribution. Le recueillir après coup suppose de retrouver chaque
  contributeur, et ceux qui refusent ou ne répondent pas bloquent le changement.

**Contrepartie à annoncer clairement aux contributeurs :** un CLA qui permet une licence commerciale donne au
porteur du projet un droit que les contributeurs n'ont pas sur son code. Certains contributeurs refusent de signer
pour cette raison. L'analyse stratégique (`docs/strategie/ANALYSE-STRATEGIQUE.md`, §3.15) le notait déjà ; la
décision ci-dessus la remplace sur ce point.

## Modèles candidats [à choisir et faire relire par un juriste]

Faits relevés le 2026-11-25 sur les sites des modèles. Le texte officiel de chaque accord fait foi.

| | Apache ICLA | Harmony CLA | Contributor Agreements (contributoragreements.org) |
|---|---|---|---|
| Éditeur | Apache Software Foundation | Project Harmony | contributoragreements.org (FSFE pour le FLA) |
| Version | non relevée [à vérifier sur le texte] | 1.0 (2011-07-04) | 1.2 |
| Nature | licence accordée, le contributeur garde ses droits (« contributors retain full rights ») | **au choix** : licence, ou cession avec licence en retour | licence exclusive ou non exclusive, au choix |
| Licences de sortie (*outbound*) | aucune option dans le modèle ; portée exacte de la licence accordée [à vérifier sur le texte] | 5 options. L'option 5 : « any license », avec la promesse que la contribution reste aussi sous la licence d'origine | 5 options. L'option 5 : aucun engagement sur la licence de sortie |
| Double licence possible | [à vérifier sur le texte] | oui, avec l'option 5 (ou une liste fermée, option 2) | oui, avec l'option 5 |
| Brevets | clause de brevets (portée décrite dans la FAQ de l'ASF) | licence de brevets incluse | au choix : licence classique ou engagement ciblé |
| Variante pour une entreprise | oui (CCLA), mais chaque développeur signe aussi son ICLA | oui (« Entity ») | oui (« Entity ») |
| Réutilisation du modèle | autorisée, modifiable, sans le nom de l'ASF (FAQ) | site sous CC BY 3.0 | site, texte compris, sous CC BY-SA 4.0 |

Sources :
- <https://www.apache.org/licenses/contributor-agreements.html> et <https://www.apache.org/licenses/cla-faq.html>
- <https://www.harmonyagreements.org/guide> et <https://www.harmonyagreements.org/agreements>
- <https://contributoragreements.org/ca-cla-chooser/> et <https://fsfe.org/activities/fla/>

**Écarté : le FLA de la FSFE (Fiduciary License Agreement).** Il confie les droits à un fiduciaire qui s'engage à
rester dans le logiciel libre, et il est conçu pour empêcher une reprise propriétaire. Il ne permet donc pas la
double licence commerciale voulue.

**Différences utiles pour choisir :**
- **Harmony, option 5**, et **Contributor Agreements, option 5** : les deux permettent la double licence. Harmony
  garantit en plus que la contribution reste disponible sous la licence d'origine (AGPL). Cette garantie rassure
  les contributeurs.
- **Licence ou cession** : une licence laisse le contributeur propriétaire de son code ; une cession transfère les
  droits. La licence est généralement mieux acceptée, et suffit pour une double licence si elle autorise la
  sous-licence ou toute licence de sortie [à vérifier par le juriste].
- **Apache ICLA** : le plus connu, mais conçu pour une fondation et des licences Apache ; à adapter (bénéficiaire,
  sans le nom de l'ASF).

## Points à trancher avec le juriste

- **Bénéficiaire** : le porteur du projet en personne, ou une future structure (association, société). Le CLA doit
  permettre de transmettre les droits si la structure change.
- **Contributeurs employés** : accord de l'employeur (variante « Entity » ou CCLA).
- **Code écrit avec un assistant IA** : déjà noté **[à faire relire]** dans
  [license-compliance.md](license-compliance.md). Une licence commerciale ne peut porter que sur ce qui est
  protégé par le droit d'auteur.
- **Mises à jour de Dependabot** : numéros de version produits automatiquement, sans apport original. Proposition :
  dispensées de CLA.

## Signature : options, non installées

Aucun mécanisme n'est installé dans le dépôt. Le porteur du projet choisit et installe lui-même, car chaque option
traite des **données personnelles** des contributeurs (nom, adresse électronique, compte GitHub, date). Il faut donc
la mentionner dans [PRIVACY.md](../../PRIVACY.md) et préciser la durée de conservation.

| Option | Fonctionnement | Points d'attention |
|---|---|---|
| **CLA Assistant** (cla-assistant.io, service hébergé) | application GitHub : à l'ouverture d'une PR, le contributeur signe en un clic avec son compte GitHub | service tiers, qui conserve les signatures ; accès à accorder au dépôt |
| **Action GitHub de signature** (type « CLA Assistant Lite ») | une Action vérifie la signature à chaque PR et enregistre les signatures dans un fichier, souvent du dépôt | un dépôt public rend les signatures **publiques** ; minutes de CI ; maintenance de l'Action [à vérifier] |
| **Signature manuelle** | accord signé (PDF ou courriel) envoyé au porteur du projet, registre privé | aucun service tiers, aucune CI ; plus lent, mais adapté à un petit nombre de contributeurs |

## Question ouverte : garder le DCO ?

Le DCO et le CLA ne répondent pas à la même question :
- le **CLA** accorde les droits, une fois par contributeur ;
- le **DCO** certifie l'origine de **chaque commit**.

Deux possibilités, **à décider** :
1. **Garder les deux** : le CLA pour les droits, le DCO pour l'origine (`git commit -s`, case de la PR). C'est
   l'état actuel de `CONTRIBUTING.md`.
2. **CLA seul** : moins de formalités pour les contributeurs ; la certification d'origine doit alors figurer dans
   le CLA choisi [à vérifier selon le modèle].
