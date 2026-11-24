# ADR-0004 — Format de projet v2 : archive ZIP

Date : 2026-11-24 · Statut : accepté (principe) ; la spécification détaillée est à valider avant l'implémentation.

## Contexte

Le format v1 est un JSON unique qui intègre les photos et les fonds de plan en base64. Ce choix a plusieurs
inconvénients :

- les fichiers grossissent de 33 % ;
- leur taille est plafonnée à 50 Mo ;
- le fichier est entièrement réécrit à chaque enregistrement ;
- il n'y a pas de place pour des documents joints ;
- les originaux sont perdus (PDF réduit à sa première page en JPEG).

Un 7z avec une compression élevée a été envisagé. Les mesures sur un projet de test de 27 Mo (20 photos, 2 PDF)
sont dans [docs/strategie/FORMAT-V2.md](../strategie/FORMAT-V2.md) :

- le 7z solide n'est que 6,5 % plus petit ;
- il est environ 50 fois plus lent à écrire ;
- il est environ 350 fois plus lent pour lire le modèle seul ;
- il n'est pas lisible nativement par les navigateurs ni par plusieurs systèmes.

## Décision

- Un `.voltaplan` v2 est une **archive ZIP standard**.
- Le modèle JSON est compressé (deflate). Les photos et PDF, déjà compressés, sont **stockés sans
  recompression**.
- Les **documents originaux sont conservés**. Les images d'affichage en sont dérivées et peuvent être régénérées.
- L'archive contient un **manifest** : format, version du format, version de Voltaplan, liste des fichiers avec
  taille, SHA-256 et rôle.
- **Rétrocompatibilité** : le JSON v1 (`.voltaplan`, `.openrgie`) reste lisible indéfiniment. Le type du fichier
  est détecté par sa signature, pas par son extension.
- Les données restent **récupérables sans Voltaplan** (n'importe quel outil ZIP, plus un `README.txt`). Sur
  ordinateur, le projet peut être **exporté sous forme de répertoire**.
- Les **archives importées sont validées** : liste blanche des chemins, plafonds de taille et de taux de
  compression, CRC et SHA-256, refus des liens et des entrées chiffrées, mode de récupération partielle.
- Une modification ordinaire ne reconstruit pas les médias. L'état de travail est gardé par fichier (IndexedDB ou
  OPFS) ; l'archive est assemblée en flux à l'enregistrement.

## Conséquences

- Une dépendance de lecture et d'écriture ZIP, petite et sans dépendance (candidate : `fflate`, à vérifier).
- Une migration v1 → v2 dans `src/model/migrate.ts`.
- Des tests de performance sur des projets de 10, 50, 100, 250 et 500 Mo, y compris sur un appareil disposant de peu
  de mémoire.
- La structure interne doit prévoir les sources, observations, propositions et questions de l'assistant
  (spécification séparée).
