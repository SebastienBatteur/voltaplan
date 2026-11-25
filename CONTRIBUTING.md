# Contribuer à Voltaplan

Merci de vouloir aider. Voltaplan est une application **gratuite et open source** (AGPL-3.0-only) de schémas
électriques, avec une aide à la vérification du RGIE. Toutes les contributions sont utiles : code, règles
réglementaires, traductions, essais sur le terrain, documentation.

## Règle absolue : aucune donnée de client

Ne joignez **jamais** à un ticket, une demande de fusion ou un commit :

- un dossier `.voltaplan` ou `.trik` de client ;
- une photo de tableau ou de logement d'un client ;
- un nom, une adresse, un numéro EAN.

Pour illustrer un problème, recréez un **petit projet d'essai** et utilisez une photo de **votre** tableau ou d'un
tableau d'essai, en masquant les étiquettes nominatives. Les tickets sont **publics**.

## Signaler

| Quoi | Où |
|---|---|
| Une faille de sécurité | **en privé** : voir [SECURITY.md](SECURITY.md), jamais dans un ticket |
| Un bogue | ticket « Bogue » |
| **Une règle RGIE fausse, manquante ou mal formulée** | ticket « Règle RGIE » : édition (ancien RGIE ou Livre 1), article ou section si vous le connaissez, cas concret, résultat attendu |
| Une traduction (NL, EN, DE) | ticket « Traduction », ou directement une demande de fusion |
| Une idée | ticket « Idée » ou discussion |

Les règles du moteur sont toutes marquées « à relire » (`needsReview`) tant qu'un professionnel ne les a pas
vérifiées. Une contribution réglementaire doit citer sa **source**. **Ne recopiez pas de texte normatif protégé**
(normes NBN, IEC…). Le RGIE, publié au Moniteur belge, peut être cité.

## Proposer du code

1. Créez une branche depuis `main`.
2. Installez et vérifiez :

   ```powershell
   npm ci
   ```

   ```powershell
   npm run typecheck
   ```

   ```powershell
   npm run lint
   ```

   ```powershell
   npm test
   ```

   ```powershell
   npm run build
   ```

3. **Signez vos commits** selon le [Developer Certificate of Origin](https://developercertificate.org/) (DCO) :
   `git commit -s` ajoute la ligne `Signed-off-by: Nom <adresse>`. Vous certifiez ainsi avoir le droit de
   proposer ce code sous la licence du projet.
4. **Signez l'accord de contribution (CLA)** avant votre première contribution (voir ci-dessous).
5. Ouvrez une demande de fusion. Le modèle rappelle les points à vérifier.

### Accord de contribution (CLA)

**Aucune contribution externe n'est acceptée sans CLA signé.** L'accord permet au porteur du projet de garder une
**double licence** possible (l'AGPL pour tous, et éventuellement une autre licence accordée à part) ou de
relicencier le projet. Avec le DCO seul, chaque contributeur garde ses droits et n'accorde que l'AGPL : sans CLA,
ces deux possibilités demanderaient l'accord de chaque contributeur.

Le modèle d'accord n'est **pas encore choisi** : en attendant, aucune contribution externe n'est fusionnée.
Signalez quand même vos idées et bogues par ticket. Pourquoi ce choix, et quels modèles sont étudiés :
[docs/legal/cla.md](docs/legal/cla.md).

### Principes du projet (à respecter dans chaque contribution)

- **Local d'abord** : aucun serveur Voltaplan, aucune télémétrie, aucune donnée envoyée sans action de
  l'utilisateur.
- **L'arbre électrique est la seule source de vérité.** L'assistant et l'IA proposent ; seul l'utilisateur
  confirme.
- **Ne rien inventer** : une information inconnue reste inconnue (question ou vérification), jamais une valeur
  par défaut présentée comme observée.
- **Aide, pas certification** : aucune formulation ne doit laisser croire à une validation officielle.
- **Peu de dépendances** et code testé. Toute nouvelle règle RGIE vient avec son cas dans
  `test/rules.matrix.test.ts`.
- Textes de l'interface en **français, néerlandais et anglais** (`src/i18n`). Un test vérifie que les trois
  restent complets.

Les décisions d'architecture sont dans [docs/adr](docs/adr) ; la stratégie dans [docs/strategie](docs/strategie).

## Conduite

Voir [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
