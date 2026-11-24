# ADR-0005 — Dossier de preuves de l'assistant à côté de l'arbre électrique

Date : 2026-11-24 · Statut : accepté (décisions A1 à A6 validées par le porteur du projet)

## Contexte

L'assistant doit reconstruire une installation à partir de photos et de documents, avec des informations sûres,
probables ou inconnues. L'arbre électrique doit rester la seule source de vérité. Rien ne doit être inventé, et les
décisions de l'utilisateur doivent être tracées. Spécification : [SPEC-ASSISTANT-MODELE.md](../strategie/SPEC-ASSISTANT-MODELE.md).

## Décision

- `Project.evidence` (facultatif) contient les sources, les observations, les propositions, les questions, la
  provenance et l'historique (`src/assist/evidence.ts`). Le moteur RGIE, les calculs et les exports ne le lisent
  jamais.
- **L'IA produit des observations.** La fusion déterministe (`src/assist/boardDraft.ts`) en tire des propositions
  et des questions. L'application (`src/assist/apply.ts`) est contrôlée, se fait en une seule étape d'annulation, et
  n'a lieu qu'après une décision de l'utilisateur.
- **Inconnu = absent de l'arbre, plus une question ouverte.** Les nœuds proposés ne reçoivent aucune valeur par
  défaut.
- **`confirmed` uniquement sur une action de l'utilisateur** : acceptation individuelle, réponse à une question ou
  confirmation. Une acceptation groupée garde la base d'origine.
- **Validation groupée** : seulement les propositions non critiques, d'une confiance d'au moins 0,8, et dont le
  parent n'attend pas une décision individuelle. Le groupe « probables » (non critiques, confiance d'au moins 0,5)
  s'accepte en un clic, mais ses valeurs restent signalées comme non confirmées.
- **Valeurs non confirmées utiles au contrôle** : constat `R-UNCONFIRMED`, et constats du référentiel marqués
  « déduits » (`src/assist/unconfirmed.ts`). Elles sont visibles dans le contrôle et dans le dossier.
- **Relevé figé** : une révision datée « tel que relevé, non certifié », plus une entrée dans l'historique. Les
  corrections ultérieures sont tracées.
- **Nœud supprimé** : ses provenances sont retirées, ses propositions passent à `superseded` et ses questions à
  `dismissed`. L'historique et les sources ne sont jamais supprimés.
- **Purge** : uniquement les propositions rejetées ou remplacées, et les observations que plus rien ne cite.
- **Dossier illisible à la lecture** : conservé sous `evidenceRaw`, réenregistré tel quel, jamais supprimé.

## Conséquences

- Les anciennes versions de Voltaplan conservent `evidence`. Les versions d'avant l'audit gardaient déjà les
  champs inconnus du JSON (copie d'objets) ; depuis l'audit, la validation zod les conserve explicitement. Cette
  conservation est testée pour la version actuelle.
- Le format v2 rangera `evidence` dans `sources.json` (spécification F).
