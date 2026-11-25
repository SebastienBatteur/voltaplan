# Identification du projet

Comment un humain ou un scanner identifie une instance de Voltaplan, ou d'un projet dérivé, **sans connaître son
architecture interne**. Le format est générique (« oss-provenance 1.0 ») : tout autre projet peut l'adopter.

## Trois identités, à ne pas confondre

| Identité | Valeur pour Voltaplan | Stabilité | Où |
|---|---|---|---|
| **Projet** (permanent) | `urn:uuid:55b25e7a-c2a4-4787-bebc-42ecee353f9e` (alias historique `org.voltaplan`) | ne change jamais ; indépendant du nom commercial, du dépôt GitHub et du domaine | `codemeta.json` (`identifier`), `build-info.json` (`project.id`, `upstream.id`), balise `osp:project-id`, bandeau JS |
| **Dépôt et commit** | `https://github.com/SebastienBatteur/voltaplan` + SHA-1 du commit | change pour un fork et à chaque commit | `build-info.json` (`repository`), balise `osp:commit` |
| **Compilation** | `sha256:…`, calculé sur la liste des fichiers publiés | change dès qu'un octet publié change ; identique pour deux compilations reproductibles | `build-info.json` (`build.id`) |

Règles :
- **Aucun identifiant par installation, par appareil ou par utilisateur.** Deux personnes qui ouvrent la même
  version voient exactement les mêmes valeurs.
- **Filiation d'un fork.** Un fork qui garde `codemeta.json` garde `upstream.id`. S'il prend sa propre identité
  (`OSP_PROJECT_ID`), `upstream.id` désigne toujours Voltaplan, et `build.derived` vaut `true`.
- L'identifiant est **déclaratif** : n'importe qui peut le recopier. Il sert à relier, pas à authentifier.

## Découverte depuis une adresse quelconque

1. `https://<site>/.well-known/oss-provenance.json` ([schéma](../../schemas/oss-provenance/well-known-1.0.schema.json)).
   Il liste les projets et les instances du site, chacune avec l'adresse de son `build-info.json` et l'empreinte
   SHA-256 de ce fichier. La cohérence avec la version réellement servie est donc vérifiable.
2. Sans `.well-known` (application déployée dans un sous-répertoire d'un site qu'on ne contrôle pas) :
   - `<link rel="describedby" type="application/json" href="./build-info.json">` dans la page de l'application ;
   - balises `<meta name="osp:project-id|osp:version|osp:commit|osp:status|osp:license|osp:source">` ;
   - `<link rel="license">`.
3. Sans aucune métadonnée (supprimées) : bandeau `/*! … Project-ID … SPDX-License-Identifier … */` en tête des
   fichiers JavaScript. Ensuite, empreintes de similarité ([artifact-integrity.md](../security/artifact-integrity.md)).

Pour voltaplan.org :
- `https://voltaplan.org/.well-known/oss-provenance.json`
- `https://voltaplan.org/app/build-info.json`
- `https://voltaplan.org/app/fingerprints.json`
- `https://voltaplan.org/app/THIRD-PARTY-LICENSES.txt`
- `https://voltaplan.org/schemas/oss-provenance/*.schema.json`

Ces adresses ne seront servies qu'après la fusion dans `main`.

## Schémas (JSON Schema 2020-12)

| Fichier | Rôle |
|---|---|
| [`build-info-1.0`](../../schemas/oss-provenance/build-info-1.0.schema.json) | une compilation : `project`, `upstream`, `repository` (url, commit, date, dirty), `build` (id, version, timestamp, environment, ci, status, derived), `license` (spdx, url, copyright), `source` (correspondingSource, archive, declared), `artifacts` (chemin et SHA-256 des fichiers liés), `verification` (`authenticated: false`, attestations) |
| [`well-known-1.0`](../../schemas/oss-provenance/well-known-1.0.schema.json) | découverte : projets, instances, `build-info.json` et leur empreinte |
| [`fingerprints-1.0`](../../schemas/oss-provenance/fingerprints-1.0.schema.json) | intégrité, sources, similarité (voir artifact-integrity.md) |

- Les schémas sont générés depuis `tools/provenance/schemas.ts` (`npm run provenance -- schemas`). Un test vérifie
  que les fichiers publiés sont à jour.
- **Versionnement** :
  - `schemaVersion` majeur.mineur ;
  - ajout d'un champ facultatif = version mineure ;
  - tout autre changement = nouvelle version majeure, avec un nouveau fichier de schéma (l'ancien reste publié).
- Valeurs de `build.status` :
  - `clean` : commit connu, arbre vérifié sans modification ;
  - `modified` : modifications non commitées ;
  - `declared` : commit déclaré sans dépôt Git, absence de modification invérifiable ;
  - `unknown` : commit inconnu.

## Interopérabilité et limites

- `codemeta.json` est du JSON-LD, lisible par les outils CodeMeta, Software Heritage et Zenodo. L'`identifier` en
  `urn:uuid` n'y est pas encore une pratique répandue, mais rien ne l'interdit.
- Les balises `osp:` ne sont pas enregistrées auprès du WHATWG (MetaExtensions). Un scanner doit les traiter comme
  une convention de ce format.
- `/.well-known/oss-provenance.json` n'est pas enregistré à l'IANA. L'enregistrement serait à demander une fois le
  format stabilisé par la plateforme.
- Les adresses `archive` et `tree/<commit>` suivent la forme de GitHub. Pour un autre hébergeur, `archive` vaut
  `null` et `correspondingSource` suit la forme `<dépôt>/tree/<commit>`, ou l'adresse déclarée (`OSP_SOURCE_URL`).
