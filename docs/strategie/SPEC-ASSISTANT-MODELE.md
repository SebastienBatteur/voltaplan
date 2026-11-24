# Spécification — Modèle « sources, observations, propositions, questions »

Statut : **à valider** avant toute implémentation. Date : 2026-11-24.
Contexte : [ASSISTANT.md](ASSISTANT.md) ; décisions : [DECISIONS.md](DECISIONS.md).

## 1. Principe directeur

**L'arbre électrique (`Project.roots`) reste la seule source de vérité de l'installation.** Tout ce que l'assistant
sait (d'où vient une valeur, avec quelle certitude, ce qui est proposé, ce qui reste à demander) est rangé dans un
**dossier de preuves** (`Project.evidence`), à côté de l'arbre et **jamais dedans**.

| | Arbre électrique | Dossier de preuves |
|---|---|---|
| Rôle | ce qu'est l'installation, validé par l'utilisateur | d'où viennent les informations, ce qui est proposé, ce qui manque |
| Lu par | unifilaire, plan, tableau, calculs, contrôle RGIE, exports | interface de l'assistant, dossier (liste des sources), traçabilité |
| Modifié par | l'utilisateur (directement, ou en acceptant une proposition) | l'assistant (observations, propositions, questions) et l'utilisateur (décisions) |
| Absent ou vide | projet normal | aucun impact : l'application fonctionne comme aujourd'hui |

**Conséquences :**

- Le contrôle RGIE, les calculs et les vues ne changent pas. Ils ne lisent jamais le dossier de preuves, et une
  proposition non acceptée n'a **aucun effet** sur le dossier électrique.
- Accepter une proposition, c'est appliquer un changement à l'arbre et noter la décision dans le dossier de preuves,
  **en une seule étape d'annulation**. C'est pour cela que le dossier de preuves vit dans l'objet `Project`
  (« annuler » restaure les deux ensemble).
- **Pas de valeur « inconnue » dans l'arbre.** Une propriété inconnue reste vide dans l'arbre ; le dossier de
  preuves y attache une question ouverte. Le moteur RGIE la traite déjà comme une information manquante.

## 2. Types (TypeScript, validés par zod comme le reste du format)

```ts
/** Identifiants stables : préfixe + 16 caractères aléatoires (base32), jamais réutilisés. */
type SourceId = `src_${string}`;
type ObsId = `obs_${string}`;
type PropId = `prp_${string}`;
type QId = `q_${string}`;

interface Evidence {
  version: 1;
  sources: SourceDoc[];
  observations: Observation[];
  proposals: Proposal[];
  questions: Question[];
  /** Provenance de chaque valeur de l'arbre issue de l'assistant (ou confirmée par l'utilisateur). */
  provenance: Provenance[];
  /** Historique des décisions et corrections (append-only). */
  history: HistoryEntry[];
}

/** Document source, conservé en original (format v2 : assets/<sha256>.<ext>). */
interface SourceDoc {
  id: SourceId;
  sha256: string;            // empreinte de l'original : identité, dédoublonnage, cache de l'IA
  kind: 'boardPhoto' | 'equipmentPhoto' | 'planPdf' | 'planImage' | 'oldSchema' | 'report' | 'datasheet' | 'note' | 'trikker' | 'other';
  name: string;              // nom d'origine du fichier
  mime: string;
  size: number;
  pages?: number;
  addedAt: string;           // ISO
  takenAt?: string;          // date de prise de vue (EXIF) si connue
  label?: string;            // libellé libre (« Tableau cave »)
  /** Lien vers l'objet de l'arbre concerné (ex. la photo du tableau → nœud « tableau »). */
  about?: { nodeId: string };
}

/** Zone d'un document (coordonnées normalisées 0..1, indépendantes de la résolution). */
interface Region { sourceId: SourceId; page?: number; box?: [x: number, y: number, w: number, h: number] }

/** Ce qui a été lu, tel quel, sans interprétation. */
interface Observation {
  id: ObsId;
  region: Region;
  method: 'manual' | 'deterministic' | 'ai' | 'import';
  /** Pour l'IA : fournisseur, modèle, version de la consigne et du schéma ; empreinte de l'entrée (cache). */
  engine?: { provider: string; model: string; promptVersion: string; inputHash: string };
  at: string;
  /** Objet observé : clé locale (« rangée 1, module 4 ») pour regrouper les observations d'un même objet. */
  subject: { kind: 'device' | 'circuit' | 'room' | 'label' | 'symbol' | 'cable' | 'board'; key: string };
  /** Faits lus : valeur (ou null si illisible), certitude 0..1, texte brut lu. */
  facts: Record<string, { value: string | number | boolean | null; confidence: number; raw?: string }>;
}

/** Statut épistémique d'une valeur. */
type Basis =
  | 'observed'   // lue telle quelle sur une source
  | 'deduced'    // déduite par une règle déterministe (ex. étiquette « PRISES CUISINE » → usage prises, pièce cuisine)
  | 'proposed'   // proposée (conception neuve ou correction), jamais observée
  | 'confirmed'  // acceptée ou saisie par l'utilisateur
  | 'manual';    // saisie par l'utilisateur sans source

/** Modification proposée à l'arbre. Rien n'est appliqué sans décision de l'utilisateur. */
interface Proposal {
  id: PropId;
  batch: string;             // lot (« lecture photo tableau du 24/11 ») : accepter / refuser par lot
  purpose: 'reconstruction' | 'design' | 'correction';
  change:
    | { op: 'createNode'; tempKey: string; parent: { nodeId: string } | { tempKey: string }; kind: string; props: Record<string, unknown>; location?: string }
    | { op: 'setProp'; target: { nodeId: string } | { tempKey: string }; prop: string; value: unknown; previous?: unknown }
    | { op: 'move'; target: { nodeId: string }; newParent: { nodeId: string } | { tempKey: string } }
    | { op: 'removeNode'; target: { nodeId: string } };
  basis: Basis;
  confidence: number;        // la plus faible des certitudes des observations utilisées
  observations: ObsId[];
  /** Correction : règle RGIE qui la motive (jamais pour une reconstruction). */
  ruleId?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'superseded';
  decidedAt?: string;
  /** Après acceptation d'une création : identifiant du nœud créé. */
  createdNodeId?: string;
}

/** Question à l'utilisateur : inconnue, contradiction, confirmation, choix. */
interface Question {
  id: QId;
  kind: 'unknown' | 'contradiction' | 'confirm' | 'choice';
  about: { nodeId?: string; tempKey?: string; prop?: string; proposalId?: PropId };
  /** Texte traduisible (clé + paramètres) : la question reste lisible dans les trois langues. */
  text: { key: string; params?: Record<string, string | number> };
  options?: { value: unknown; observations: ObsId[]; label?: string }[];
  /** Priorité : bloquante pour le dossier (ex. calibre d'une protection) ou de confort. */
  priority: 'high' | 'normal' | 'low';
  status: 'open' | 'answered' | 'dismissed';
  answer?: unknown;
  answeredAt?: string;
}

/** Provenance d'une valeur de l'arbre. */
interface Provenance {
  nodeId: string;
  prop: string | '@node';    // '@node' : l'existence même du nœud
  basis: Basis;
  observations: ObsId[];
  confidence: number;
  at: string;
}

/** Historique des corrections (jamais réécrit). */
interface HistoryEntry {
  at: string;
  actor: 'user' | 'assistant';
  action: 'accept' | 'reject' | 'answer' | 'dismiss' | 'edit' | 'revert' | 'snapshot';
  refs: { proposal?: PropId; question?: QId; nodeId?: string; prop?: string };
  before?: unknown;
  after?: unknown;
  note?: string;
}
```

**Le texte des sources n'est jamais dupliqué dans le JSON.** Les observations gardent le texte brut lu (quelques
mots) ; les originaux sont dans les assets.

## 3. Règles de fonctionnement

1. **L'IA produit uniquement des observations.** Elle ne modifie jamais l'arbre et ne crée pas de propositions :
   les propositions sont produites par la **fusion déterministe** (code testé) à partir des observations.
2. **Fusion** : regroupe les observations par sujet, puis :
   - accord : la valeur est proposée avec la certitude minimale des observations ;
   - désaccord : une **question de contradiction**, avec une option par valeur et ses sources ;
   - valeur absente ou illisible : une **question d'inconnue** si la valeur est utile au dossier, sinon rien.
3. **Reconstruction** (installation existante) :
   - les propositions sont `purpose: 'reconstruction'` et ne contiennent **que** ce qui a été observé ou déduit ;
   - le moteur RGIE **n'est jamais consulté** pendant la reconstruction ;
   - un test automatique le garantit : une installation non conforme reconstruite reste non conforme.
4. **Fin du relevé** :
   - à la demande de l'utilisateur, une révision « Relevé du JJ/MM/AAAA » est ajoutée au projet
     (`meta.revisions`, déjà existant), et une entrée `snapshot` est ajoutée à l'historique ;
   - les corrections proposées ensuite (`purpose: 'correction'`, avec `ruleId`) sont séparées et apparaissent comme
     telles dans le dossier.
5. **Conception neuve** :
   - `purpose: 'design'`, `basis: 'proposed'` ;
   - le regroupement en circuits, les sections et les protections viennent de **règles déterministes**, relues
     par un expert avant d'être activées ;
   - l'IA ne sert qu'à lire les plans.
6. **Acceptation** :
   - applique le changement à l'arbre ;
   - pose `status: 'accepted'`, la provenance (`basis: 'confirmed'` si l'utilisateur a modifié la valeur, sinon la
     base d'origine) et une entrée d'historique ;
   - tout cela en une seule étape d'annulation.
7. **Modification manuelle ultérieure** d'une valeur provenant de l'assistant : la provenance devient `manual`, et
   l'historique garde l'ancienne valeur.
8. **Suppression d'un nœud** :
   - `pruneReferences` (déjà centralisé) retire ses provenances ;
   - ses propositions en attente passent à `superseded` et ses questions ouvertes à `dismissed`.
9. **Cache de l'IA** :
   - une observation `ai` dont l'`inputHash` (image, consigne, modèle, schéma) existe déjà n'est **jamais
     redemandée** ;
   - le cache voyage avec le projet.

## 4. Stockage et compatibilité

- **En mémoire** : `Project.evidence?: Evidence`, facultatif. Un projet sans assistant n'a pas ce champ.
- **Format v1 (JSON)** : champ `evidence` facultatif. Les fichiers v1 actuels le gardent intact à la lecture, car
  le schéma zod conserve les champs inconnus. Les anciennes versions de Voltaplan l'ignorent sans le perdre.
- **Format v2 (ZIP)** :
  - `sources.json` contient `evidence` ;
  - `assets/<sha256>.<ext>` contient les originaux ;
  - `project.json` ne contient plus `evidence`. Ils sont fusionnés à la lecture et séparés à l'écriture.
- **Plafonds** : 20 000 observations et 5 000 propositions par projet **[à ajuster]**. Les observations d'un lot
  rejeté entièrement peuvent être purgées (sauf leur cache).
- **Dossier imprimé** : nouvelle partie facultative « Sources et hypothèses ». Elle contient la liste des
  documents, les valeurs non confirmées et les questions restées ouvertes.

## 5. Ce que cela ne change pas

- `ElNode`, `PROP_SCHEMAS`, le moteur RGIE, les calculs, l'unifilaire, le plan, le tableau, les exports Trikker et
  Eendraadschema.
- Le parcours manuel : on peut tout faire sans assistant, et sans dossier de preuves.

## 6. Décisions à valider

| # | Question | Recommandation |
|---|---|---|
| A1 | Dossier de preuves dans `Project` (annulation commune) ou à part | **Dans `Project`**, champ facultatif |
| A2 | Valeur « inconnue » dans l'arbre, ou seulement via des questions | **Seulement via des questions** (arbre inchangé) |
| A3 | L'IA crée des observations seulement (fusion déterministe) | **Oui** |
| A4 | Révision « Relevé du… » obligatoire avant toute proposition de correction | **Oui** pour une installation existante |
| A5 | Plafonds de taille du dossier de preuves | 20 000 observations, 5 000 propositions, ajustables |
| A6 | Partie « Sources et hypothèses » dans le dossier imprimé | facultative, cochée par défaut dans le « Dossier complet » |

## 7. Tests prévus

- Validation zod, migration et conservation du champ `evidence` en v1.
- Fusion :
  - accord, contradiction, valeur illisible, objet vu sur deux photos ;
  - certitude minimale retenue.
- Acceptation et refus : arbre, provenance, historique et annulation, en une seule étape.
- Suppression d'un nœud : propositions `superseded`, questions `dismissed`, provenances retirées.
- **Fidélité** : une installation non conforme (différentiel absent, calibre trop fort) reconstruite depuis des
  observations reste non conforme. Aucune proposition `correction` dans un lot `reconstruction`.
- Cache : même entrée, pas de nouvel appel (fetch compté).

## 8. Révision après le retour du 2026-11-24 : rôle de l'IA élargi

Principes validés : arbre seule source de vérité, sources conservées à part, traçabilité, aucune modification
directe par l'IA, application contrôlée, reconstruction fidèle, RGIE après la reconstruction (et pendant la
conception pour une installation neuve).

**Changement** : l'IA ne se limite pas à lire. Elle peut aussi produire des **hypothèses**, toujours sous forme
typée et jamais comme des faits.

| Ce que l'IA fournit | Type dans le dossier de preuves | Contrôle déterministe avant d'en faire une proposition |
|---|---|---|
| Lecture d'un document | `Observation` (`kind: 'reading'`) | schéma zod, valeurs dans les listes du modèle |
| Interprétation d'une étiquette (« PRISES CUIS. » → prises, cuisine) | `Observation` (`kind: 'interpretation'`, avec le texte brut) | usage et pièce dans les listes connues, sinon question |
| Correspondance entre sources (ce disjoncteur = ce circuit du plan) | `Observation` (`kind: 'match'`, références des deux observations) | les deux observations existent ; une observation n'a pas deux correspondances contradictoires |
| Déduction probable (section 2,5 mm² probable pour 20 A en prises) | `Observation` (`kind: 'inference'`, `basis: 'aiInferred'`, justification) | jamais appliquée sans confirmation ; signalée « probable » ; plafonnée à une confiance moyenne |
| Regroupement de circuits proposé | `Observation` (`kind: 'grouping'`) | membres existants, pas de cycle, structure d'arbre valide |
| Contradiction repérée | `Observation` (`kind: 'contradiction'`) | transformée en `Question` avec les options sourcées |
| Question pertinente | `Question` brouillon | dédoublonnée ; pas de question sur une valeur déjà confirmée |
| Solution technique suggérée (installation neuve, correction) | `Proposal` brouillon (`purpose: 'design'` ou `'correction'`) | **vérifiée par le moteur RGIE avant d'être montrée** ; refusée si elle crée une non-conformité ; jamais dans un lot de reconstruction |

**Nouvelle base de connaissance** : `Basis` gagne `aiInferred` (déduit par l'IA, à confirmer), distinct de
`deduced` (déduit par une règle du code).

**Règle invariante** : `confirmed` ne peut être attribué que par une action de l'utilisateur. Cette règle est
garantie par un test : aucune fonction de l'assistant n'écrit `basis: 'confirmed'`.

**Ce que fait le code déterministe** :

- valider la structure et les références ;
- refuser ce qui est incohérent (circuit sous un appareil qui ne peut pas en avoir, valeur hors liste, cycle) ;
- calculer la confiance affichée (jamais supérieure à celle annoncée par l'IA ; plafonnée pour `aiInferred`) ;
- appliquer les propositions acceptées ;
- faire vérifier par le moteur RGIE les propositions de conception et de correction.
