# F2 — Bibliothèque ZIP : comparaison objective

Date : 2026-11-24. Statut : **recommandation à valider** (zip.js). Aucune intégration dans l'application n'est
faite.

## 1. Méthode

- **Versions évaluées** :
  - `@zip.js/zip.js` 2.25.0 (BSD-3-Clause, 381 versions publiées depuis 2021, dernière le 2026-11-12) ;
  - `fflate` 0.8.3 (MIT, 58 versions depuis 2020, dernière modification le 2026-07-20) ;
  - API natives `CompressionStream` et `DecompressionStream` ;
  - une implémentation faite maison (estimation, non écrite).
- **Tailles** : regroupement par esbuild, minifié puis compressé en gzip, avec seulement les fonctions dont
  Voltaplan a besoin.
- **Banc d'essai** (Node 20, Windows 11, disque local) :
  - archive « type v2 » de **252 Mo**, 222 entrées : 200 photos de 12 Mpx, 20 PDF scannés, modèle de 472 ko ;
  - photos et PDF stockés sans compression, modèle en deflate 9 ;
  - scripts dans le scratchpad, aucune donnée de client ;
  - les mesures mobiles restent **à faire** dans un vrai navigateur.

## 2. Résultats mesurés

| Mesure | zip.js | fflate |
|---|---|---|
| Taille, fonctions utiles (gzip) | **49 Ko** (version « native », compression du navigateur) ; 71 Ko (version complète, avec repli en JavaScript) | **7 Ko** |
| Écriture en flux de 252 Mo | 3,1 s, +42 Mo de mémoire | 2,8 s, +30 Mo de mémoire |
| **Lecture du modèle seul** | **74 ms, +6 Mo** (lecture du répertoire central à la fin du fichier, par tranche) | **294 ms, +502 Mo** (`unzipSync` charge tout le fichier) ; ou 136 ms et 0 Mo en flux, mais en **lisant les 252 Mo** du début à la fin |
| Accès à une photo précise | 32 ms (lecture par tranche) | lecture séquentielle de tout ce qui précède |
| Archive tronquée (répertoire central absent) | erreur claire « End of central directory not found », +11 Mo | erreur « invalid zip data », **+497 Mo** |
| Modèle compressé altéré | erreur (« Invalid compressed data ») | erreur (« invalid distance »), +504 Mo |
| **Photo stockée altérée d'un octet** | **détectée** si l'option `checkSignature` est activée (« Invalid CRC32 ») | **non détectée** : fflate ne vérifie pas la somme CRC-32 |
| Archive valide pour 7-Zip et Python `zipfile` | oui | oui |

**Conclusion des mesures** :

- fflate est petit et rapide, mais n'offre **ni lecture sélective par le répertoire central, ni contrôle CRC**.
- Il faudrait donc écrire soi-même la lecture du répertoire central (le cœur d'une implémentation maison) et la
  vérification CRC.
- zip.js couvre ces deux besoins nativement.

## 3. Comparaison par critère

| Critère | zip.js | fflate | Faite maison | API natives seules |
|---|---|---|---|---|
| Lecture sélective (répertoire central, tranches de `Blob`) | **oui** (`BlobReader`, `HttpRangeReader`) | non (tout en mémoire, ou flux séquentiel) | à écrire | non : pas de conteneur ZIP, seulement la (dé)compression |
| Écriture en flux | **oui** (`ZipWriter` vers `WritableStream`) | oui (`Zip`, `ZipPassThrough`) | à écrire | non (conteneur absent) |
| Mémoire | faible, mesurée | faible en écriture ; **élevée en lecture** | dépend de l'implémentation | sans objet |
| Mobile | compression native du navigateur si disponible (Safari 16.4 et plus **[à vérifier]**), repli en JavaScript dans la version complète | JavaScript pur, rapide | idem natif | Safari 16.4 et plus, Firefox 113 et plus **[à vérifier]** |
| Taille | 49 à 71 Ko, **chargés seulement à l'ouverture ou à l'enregistrement d'un projet v2** | 7 Ko | environ 5 à 10 Ko | 0 Ko |
| Maturité | active depuis 2010 (nouvelle API en 2021), mainteneur très régulier, utilisée largement **[ampleur à vérifier]** | stable, rythme lent | aucune | standard du navigateur |
| ZIP64 (au-delà de 4 Go ou 65 535 entrées) | oui | partiel **[à vérifier]** | à écrire | — |
| Contrôle CRC-32 | **oui** (option) | **non** | à écrire | — |
| Archives corrompues | erreurs claires, mémoire maîtrisée | erreurs, mais après chargement complet | à écrire et à tester | — |
| Sécurité (chemins `..`, bombes de décompression) | **à notre charge** (liste blanche, plafonds) ; bibliothèque largement exposée et corrigée | à notre charge | à notre charge, avec plus de code à risque | — |
| Safari et iOS | pris en charge (option sans workers, compatible avec notre CSP) | pris en charge | à tester entièrement | 16.4 et plus |
| Licence compatible avec l'AGPL | **oui** (BSD-3-Clause, mention à conserver) | oui (MIT) | oui | sans objet |
| Maintenance pour Voltaplan | mises à jour Dependabot | idem, plus le code de lecture sélective et de CRC à maintenir | **la plus lourde** (format, ZIP64, CRC, cas limites) | — |

## 4. Recommandation

**zip.js**, version « native » (compression du navigateur, 49 Ko), avec ces réglages :

- `useWebWorkers: false` : pas de worker, aucune modification de la CSP. Les workers pourront venir plus tard si
  les mesures sur mobile le justifient.
- `checkSignature: true` à la lecture, en plus de la vérification SHA-256 du manifest.
- Chargement **à la demande**, uniquement à l'ouverture ou à l'enregistrement d'un projet v2.
- Couche de sécurité **à notre charge**, quelle que soit la bibliothèque (spécification F, § 5) : liste blanche
  des chemins, plafonds, taux de compression, types vérifiés par signature.

**Pourquoi pas les autres :**

- **fflate** oblige à réécrire la lecture sélective et la vérification CRC, soit l'essentiel d'une implémentation
  maison.
- **Une implémentation maison** n'a aucune limite bloquante chez zip.js qui la justifie.
- **Les API natives seules** n'ont pas de conteneur ZIP.

**Point à vérifier avant l'intégration** :

- La version « native » exige `CompressionStream('deflate-raw')`. Si des appareils iOS plus anciens que 16.4
  doivent être pris en charge, il faut la version complète (71 Ko).
- La compatibilité réelle sera mesurée dans Safari iOS selon le plan de tests (SPEC-FORMAT-V2, § 9).

**Réversibilité** : facile. La bibliothèque reste derrière une petite interface interne (`readEntry`,
`listEntries`, `writeArchive`) ; en changer ne modifie pas le format.
