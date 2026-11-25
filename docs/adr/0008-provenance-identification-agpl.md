# ADR-0008 — Provenance, identification du projet et conformité AGPL

Date : 2026-11-25 · Statut : proposé, branche `provenance-agpl`, en attente de validation du porteur du projet

## Contexte

Le porteur du projet veut quatre choses :
- identifier les instances officielles et les versions dérivées de Voltaplan ;
- relier une version déployée au commit dont elle vient ;
- faciliter le respect de l'AGPL, en particulier la section 13 (code source proposé aux utilisateurs à distance) ;
- préparer une future plateforme indépendante de surveillance des licences, hébergée sur GitHub Pages, dont
  Voltaplan serait le premier projet.

Les contraintes sont fixées par le projet :
- aucune télémétrie, aucun appel réseau ajouté, aucun identifiant par installation ou par utilisateur ;
- aucun DRM, aucun mécanisme anti-fork ni filigrane caché, aucune restriction ajoutée à l'AGPL ;
- pas de dépendance importante ;
- un coût de CI mesuré.

## Décisions

1. **Licence `AGPL-3.0-only`.** Le dépôt n'a qu'un titulaire des droits (audit dans
   [license-compliance.md](../legal/license-compliance.md)). Le changement est fait dans un commit séparé, que l'on
   peut retirer seul.
2. **Mention générale** « Copyright (C) 2026 Sébastien Batteur and VoltaPlan contributors ». Elle est déclarée dans
   `REUSE.toml` en mode `aggregate`, sans en-tête ajouté à chaque fichier.
3. **Trois identités distinctes**, détaillées dans [project-identification.md](../architecture/project-identification.md) :
   - le projet, identifié de façon permanente par `urn:uuid:55b25e7a-c2a4-4787-bebc-42ecee353f9e` dans
     `codemeta.json` (standard CodeMeta) ;
   - le dépôt et son commit ;
   - la compilation, par un identifiant `sha256:` calculé sur son contenu.
4. **Des standards existants d'abord** : CodeMeta pour l'identité, SPDX pour les licences, REUSE pour le
   copyright, CycloneDX pour les SBOM, attestations in-toto / SLSA de GitHub pour la provenance, `/.well-known/`
   (RFC 8615) pour la découverte, `rel="license"` et `rel="describedby"` pour les liens.
   Le seul format ajouté est « oss-provenance 1.0 » : trois petits schémas génériques en JSON Schema, pour ce
   qu'aucun standard ne couvre (lien entre projet, compilation, commit, code source correspondant et empreintes).
5. **Des métadonnées passives et déclaratives** : `build-info.json`, balises `<meta name="osp:…">`, bandeau
   `/*! … */` dans les fichiers JavaScript, écran « À propos ». Rien n'est envoyé nulle part.
   `verification.authenticated` vaut toujours `false` : seules une attestation ou une signature authentifient un
   artefact.
6. **Des empreintes séparées en trois familles** :
   - intégrité exacte (SHA-256) ;
   - sources caractéristiques ;
   - similarité : chaînes et jetons normalisés de quatre composants métier, hors code des bibliothèques.

   La similarité est un indice, jamais une preuve. Sa robustesse est mesurée et publiée
   ([artifact-integrity.md](../security/artifact-integrity.md)).
7. **Une release officielle est refusée** dans quatre cas : arbre Git modifié, commit ou version différents du tag,
   code source correspondant inaccessible, compilation non reproductible.
   Les compilations locales et les forks restent libres : leur état est simplement affiché (`modified`,
   `declared`, `derived`).
8. **Coût de CI limité** :
   - vérification légère, de quelques secondes, à chaque compilation existante ;
   - SBOM, attestations, double compilation et sommes seulement sur un tag de release.

## Écarté

- **Filigrane caché, code artificiel, obfuscation, vérification de licence en ligne, signalement d'un fork** :
  contraires aux principes du projet et à la liberté de modifier.
- **Analyse AST complète, TLSH, comparaison structurelle** : renvoyées à la future plateforme. Elles demandent des
  dépendances et du calcul que la mesure actuelle ne justifie pas.
- **Signature des tags par une clé du projet** : elle exige la clé du porteur du projet. La procédure est
  documentée ; l'attestation GitHub couvre déjà les artefacts de release.

## Conséquences

- Coût mesuré :
  - environ 3 secondes de compilation en plus ;
  - environ 15 Ko de JavaScript en plus (+0,8 %) ;
  - 47 Ko de licences tierces mis en cache pour le hors-ligne.
- Un fork peut tout retirer : la licence l'y autorise. Les empreintes de similarité restent alors le seul moyen
  de repérer une filiation, avec les limites mesurées.
- La future plateforme peut lire n'importe quel projet qui publie `/.well-known/oss-provenance.json` et
  `build-info.json`, sans connaître son architecture.
