# Voltaplan — Registre des décisions stratégiques

Mise à jour : 2026-11-24. Ce document suit [ANALYSE-STRATEGIQUE.md](ANALYSE-STRATEGIQUE.md) et le retour des
porteurs du projet. Phase de **discussion** : rien de ce qui suit n'est encore implémenté.

Documents liés :

- [FORMAT-V2.md](FORMAT-V2.md) : format de projet v2, mesures ZIP / 7z ;
- [STOCKAGE-ET-DOMAINE.md](STOCKAGE-ET-DOMAINE.md) : prévention des pertes, contrôle de version par fournisseur,
  migration de domaine ;
- [ASSISTANT.md](ASSISTANT.md) : assistant de création de projets.

## 1. Décisions validées

| # | Décision | Conséquence immédiate |
|---|---|---|
| D1 | Architecture local-first, sans serveur applicatif, sans stockage des données des utilisateurs | aucune ; c'est déjà le cas |
| D2 | Gratuit, open source, dons volontaires seulement | `FUNDING.yml` et page « Soutenir » plus tard, aucune fonction liée aux dons |
| D3 | Licence AGPL conservée ; DCO adopté | `CONTRIBUTING.md` avec `Signed-off-by` ; contrôle DCO en CI à prévoir |
| D4 | Belgique prioritaire | aucun autre pays implémenté ; architecture préparée seulement |
| D5 | PWA pour smartphones et tablettes ; pas de Tauri mobile | voir § 3.7 de l'analyse |
| D6 | Tauri bureau conservé, à réévaluer | mesurer son usage et sa charge avant de décider |
| D7 | Dépôt public après vérification de l'historique Git (secrets, données confidentielles) | scan complet avant la bascule (étape de maintenance, voir § 4) |
| D8 | Format v2 = archive ; **ZIP retenu**, pas 7z (voir § 2) | ADR à rédiger, puis implémentation |
| D9 | Pas de moteur de synchronisation ; priorité : aucune perte silencieuse | sauvegarde locale, détection des modifications concurrentes, copie en cas de conflit, état visible |
| D10 | Domaine propre envisagé (`voltaplan.org` ou `voltaplan.eu`) ; adresse publique inchangée pour l'instant | plan de migration dans [STOCKAGE-ET-DOMAINE.md](STOCKAGE-ET-DOMAINE.md) |
| D11 | Terminologie réglementaire en 6 niveaux, aucune certification revendiquée | voir § 3 |

## 2. Format : 7z ou ZIP — décision à confirmer

Vous avez demandé 7z avec un niveau de compression élevé. **Après mesure, je recommande de rester sur ZIP.** Le
détail est dans [FORMAT-V2.md § 2](FORMAT-V2.md#2-zip-ou-7z--mesures). En résumé :

- **Le gain est faible.** Photos JPEG et PDF sont déjà compressés. Sur un projet type de 27 Mo (20 photos, 2 PDF
  scannés), un 7z « ultra » solide n'est que **6,5 % plus petit** qu'un ZIP où les médias sont simplement
  stockés. Sur le modèle seul (texte), 7z fait 132 ko contre 152 ko en ZIP : l'écart ne compte pas.
- **Le coût est élevé**, et va à l'encontre de vos propres exigences :
  - « éviter de reconstruire l'archive complète » : un 7z solide doit être **entièrement recompressé** à chaque
    enregistrement (4,2 s pour 27 Mo avec 7-Zip natif multi-cœur ; il faut s'attendre à plusieurs fois plus
    dans un navigateur, et davantage sur téléphone) ;
  - lire le seul modèle dans un 7z solide prend **900 ms**, contre **3 ms** dans le ZIP, car il faut décompresser
    tout le bloc ;
  - « récupération des données indépendamment de Voltaplan » : le ZIP s'ouvre nativement sous Windows, macOS,
    iOS, Android et Linux ; le 7z demande souvent un logiciel tiers **[à vérifier par plateforme]** ;
  - les navigateurs n'ont rien pour lire ou écrire du 7z. Il faudrait embarquer une bibliothèque WebAssembly plus
    lourde, à la licence à examiner **[à vérifier]**.
- **Compromis proposé** : ZIP, avec **deflate niveau 9 pour le modèle et les fichiers texte**, et les **médias
  déjà compressés stockés tels quels**. Si un gain de taille devient important plus tard, il viendra de la
  **réduction des photos** (proposée, jamais imposée, l'original restant gardé), pas de l'algorithme d'archive.

**Décision attendue** : confirmer ZIP, ou maintenir 7z en acceptant ces coûts.

## 3. Terminologie réglementaire

Correspondance entre vos 6 niveaux et le moteur actuel (`src/rules/types.ts`, libellés dans `src/i18n/*.ts`) :

| Niveau demandé | Définition | Statut actuel | Changement |
|---|---|---|---|
| **Non-conformité détectée** | règle vérifiée avec des données suffisantes, et violée | `nonCompliant` sans `inferred` | libellé « Non conforme » → « Non-conformité détectée » |
| **Anomalie potentielle** | résultat incertain (donnée déduite ou par défaut, indice) | `nonCompliant` ou `warning` avec `inferred` | nouveau statut `potential`, attribué automatiquement quand le constat repose sur une valeur déduite |
| **Vérification manuelle nécessaire** | la règle ne peut pas être évaluée par le logiciel | `manualCheck` (« À vérifier ») | libellé seulement |
| **Informations insuffisantes** | la donnée nécessaire manque | `insufficientData` (« Information manquante ») | libellé seulement |
| **Règle non évaluée** | règle du catalogue non appliquée (hors champ, édition non couverte, donnée hors modèle) | absent | nouveau statut `notEvaluated`, listé dans la page « Portée de l'analyse » |
| **Aucune anomalie détectée parmi les règles vérifiées** | résumé final | `check.ok` : « Aucune non-conformité détectée. » | « Aucune anomalie détectée parmi les N règles vérifiées (M non évaluées). » |

**À garder** : `warning`, `recommendation`, `derogation` et `notApplicable`. Ce ne sont pas des résultats de
conformité. La gravité (`hazard`) et le caractère bloquant restent séparés du statut (ADR-0002).

**Autres textes à corriger** :

- slogan `app.tagline` (« Schémas électriques conformes RGIE ») ;
- mention de dossier `print.draft` (« PROJET — NON CONFORME ») → « PROJET — NON-CONFORMITÉS À TRAITER » ;
- traductions nl et en équivalentes, à faire relire par des locuteurs du métier.

**Traçabilité de chaque rapport** (page « Portée de l'analyse ») :

- version de Voltaplan, injectée à la construction ;
- version du catalogue de règles et édition du RGIE appliquée par partie ;
- date de l'analyse ;
- règles vérifiées, non évaluées et à vérifier manuellement ;
- hypothèses (valeurs par défaut ou déduites, avec leur origine) ;
- limites (calculs indicatifs, absence de certification, renvoi à l'organisme agréé).

**Phrase de responsabilité** à placer en pied de chaque rapport :
« Résultat indicatif produit par un logiciel d'aide. Il ne constitue ni une certification ni un contrôle de
conformité au sens du RGIE. »
**[Formulation à faire relire par un juriste.]**

## 4. Priorisation : votre ordre, discuté

Votre ordre :

1. pertes de données ;
2. décisions structurantes ;
3. format v2 ;
4. hors connexion ;
5. qualité belge ;
6. assistant ;
7. mobile ;
8. communauté ;
9. international.

**Je l'approuve dans l'ensemble, avec quatre ajustements :**

1. **Faire les décisions structurantes (2) avant ou avec les pertes de données (1).** Le domaine et le format
   changent la façon dont on protège les données : copies de conflit, sauvegardes en IndexedDB liées à
   l'origine. Les décisions se prennent en quelques jours et ne bloquent pas les protections urgentes, qui peuvent
   commencer tout de suite :
   - détection de conflit ;
   - `persist()` ;
   - versions locales.
2. **Le hors connexion (4) peut se faire tout de suite, en parallèle.** Il est petit (pré-cache, cache versionné,
   message de mise à jour), indépendant du format, et il protège aussi contre une perte : le travail commencé hors
   ligne dans une fonction non mise en cache.
3. **Concevoir la couche « propositions » de l'assistant (6) avant le format v2 (3).** Le format v2 doit pouvoir
   stocker les documents sources, les liens « information → source » et les propositions en attente (voir
   [ASSISTANT.md](ASSISTANT.md)). Sinon, il faudra un format v3. La conception seule suffit : l'implémentation
   de l'assistant reste en position 6.
4. **Une partie du mobile (7) peut venir avec le hors connexion.** Le zoom à deux doigts et la prise de photo
   directe sont petits et indispensables aux tests de terrain, qui nourrissent la qualité belge (5).

**Ordre proposé :**

| Ordre | Chantier | Parallélisable avec |
|---|---|---|
| 1 | **Décisions** : domaine, ZIP ou 7z, terminologie ; conception du modèle « sources et propositions » | 2 |
| 2 | **Pertes de données** : conflits sur les 4 services et le fichier local, versions locales, `persist()`, état visible | 3 |
| 3 | **Hors connexion** (pré-cache, mise à jour) et **tactile de base** (zoom à deux doigts, photo directe) | 2 |
| 4 | **Format v2** (ZIP, documents originaux, sources, propositions, export en répertoire) | 5 |
| 5 | **Qualité belge** : terminologie, portée de l'analyse, relecture par un expert, tests de réception | 4 |
| 6 | **Migration de domaine**, publication du dépôt, communauté (CONTRIBUTING, DCO, FUNDING) | — |
| 7 | **Assistant** : reconstruction de l'existant, puis plans, puis conception de nouvelles installations | — |
| 8 | **Mobile avancé** : écran de relevé | 7 |
| 9 | **International** | — |

**La migration de domaine se fait avant la publication publique.** Plus elle est tardive, plus il y a
d'utilisateurs à migrer.

## 5. Maintenance en cours (déjà autorisée)

- Dependabot :
  - #18 (zustand 4.5.7) et #20 (outils de développement, TypeScript 5.9) **fusionnées** après la correction des
    types (commit `d90f555`) ;
  - #9 et #15 (extensions Tauri) en attente de recréation par Dependabot.
- À faire avant le passage du dépôt en public :
  - scan de **tout l'historique** avec gitleaks ;
  - recherche de fichiers clients (`.trik`, `.jpg`, `.pdf`, `.voltaplan`) dans tous les commits ;
  - vérification des messages de commit et des fichiers de documentation (noms, adresses).
