# Format de fichier Voltaplan (`.voltaplan`)

JSON lisible, encodé en UTF-8. Les fichiers `.openrgie` (ancien nom de l'application) s'ouvrent toujours et sont
réenregistrés au format `voltaplan`.

```jsonc
{
  "format": "voltaplan",        // ou "openrgie" (ancien), toujours lisible
  "version": 1,                 // version du format (src/model/migrate.ts : CURRENT_VERSION)
  "meta": { … },                // projet : client, adresse, installateur, alimentation, référentiel, dates, dérogations
  "roots": [ … ],               // arbre de l'installation : { id, kind, props, children, location?, source? }
  "loose": [ … ],               // éléments non raccordés
  "plan": { "pages": [ … ], "width": 20000, "height": 15000 },   // millimètres
  "measurements": { … },        // terre, isolement, essais des différentiels (par id de nœud)
  "boards": { "<id du tableau>": { "slots": { "<id>": { "row": 0, "col": 0 } }, "photo": …, "checks": … } }
}
```

Le modèle complet et commenté est dans `src/model/types.ts`. Les propriétés de chaque type d'élément
(`props`) sont décrites dans `src/model/schema.ts` (`PROP_SCHEMAS`).

## Références entre parties

Un élément existe une seule fois dans l'arbre ; les autres parties le désignent par son `id` :
symboles du plan, emplacements et vérifications du tableau, essais des différentiels, éléments connus à la dernière
mise à jour (`meta.syncedIds`), dérogations. La liste à jour est en tête de `src/model/integrity.ts` ; supprimer un
élément retire toutes ces références (`pruneReferences`).

## Lecture et migration

À l'ouverture (fichier, navigateur, GitHub, Drive, OneDrive, Dropbox, brouillon), `parseProjectText` :

1. refuse un JSON invalide ou tronqué, un format inconnu, ou une **version plus récente** que l'application
   (message explicite, rien n'est ouvert à moitié) ;
2. applique les étapes de migration `MIGRATIONS[n]` (version n → n + 1) ;
3. valide la structure (zod) en **conservant les champs inconnus** (un fichier d'une version future mineure ne
   perd rien) et complète les listes absentes ;
4. contrôle l'intégrité (`validateProject`) et **signale** les incohérences sans rien supprimer.

Changer le format de façon incompatible = incrémenter `CURRENT_VERSION`, ajouter l'étape de migration et son test.

## Données sensibles

Un projet contient des données personnelles (nom et adresse du client, plans, photos). Les fichiers de test réels
(`test/fixtures/*.trik`, `*.jpg`) ne sont jamais publiés (`.gitignore`). Aucun secret (clé d'IA, jeton) n'est
enregistré dans le projet.
