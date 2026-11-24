# Sécurité

*English: please report vulnerabilities privately through GitHub Security Advisories (Security tab → "Report a vulnerability"), never in a public issue. Reports in English, French or Dutch are welcome.*

## Versions suivies

Voltaplan est en version 0.x : seules les corrections de la **dernière version publiée** (et de la branche `main`, déployée sur le site) sont assurées.

| Version | Corrections de sécurité |
|---|---|
| dernière version 0.x publiée, `main` | oui |
| versions plus anciennes | non : mettre à jour |

## Signaler une vulnérabilité

**Ne pas ouvrir de ticket public.** Utiliser le signalement privé de GitHub :

1. onglet **Security** du dépôt ;
2. **Report a vulnerability** (GitHub Security Advisories) ;
3. décrire le problème, la version ou le commit concerné, les étapes pour le reproduire et, si possible, un fichier d'exemple **sans données personnelles**.

Réponse visée : accusé de réception sous 7 jours, puis un avis sur la gravité et un calendrier de correction. Le signalement reste confidentiel jusqu'à la publication du correctif ; l'auteur est cité dans l'avis s'il le souhaite.

## Périmètre

Concerné :

- l'application web (dossier `src/`, publiée sur GitHub Pages) et l'application de bureau Tauri (`src-tauri/`) ;
- l'ouverture de fichiers : projets `.voltaplan`, fichiers Trikker `.trik`, photos et PDF (fichier piégé, injection de script, consommation excessive de mémoire…) ;
- la protection des secrets enregistrés localement (clé d'API de l'IA, jeton GitHub : chiffrés AES-GCM, voir `src/ai/secureStore.ts`) ;
- les échanges avec les services choisis par l'utilisateur (IA, GitHub, Google Drive, OneDrive, Dropbox) et la connexion OAuth ;
- la chaîne de construction et de publication (workflows `.github/workflows/`).

Hors périmètre :

- les services tiers eux-mêmes (Anthropic, GitHub, Google, Microsoft, Dropbox) : à signaler à leur éditeur ;
- les failles qui demandent un accès déjà complet à l'ordinateur ou au profil du navigateur de la victime ;
- l'exactitude des vérifications RGIE (ce sont des erreurs fonctionnelles : ticket public) ;
- les installateurs non signés (limite connue, voir le README).

## Mesures en place

- Politique de sécurité du contenu (CSP) stricte, pour le web et le bureau (`src/security/csp.ts`) : scripts du site uniquement, connexions limitées aux services utilisés.
- Taille maximale des fichiers importés (`src/io/limits.ts`), refus des DTD/entités XML (`src/import/trikker.ts`), images de projet limitées aux images intégrées `data:image/…` (`src/io/sanitize.ts`).
- Permissions minimales de l'application de bureau (`src-tauri/capabilities/default.json`).
- CI : audit des dépendances livrées (`npm audit --omit=dev`), CodeQL, recherche de secrets (gitleaks), ESLint ; mises à jour Dependabot hebdomadaires.

Voir aussi [PRIVACY.md](PRIVACY.md) (données personnelles).
