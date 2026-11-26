/**
 * Informations de l'assistant ayant une incidence sur le contrôle (A6, ADR-0007 « inconnu ≠ absent »).
 *
 * Le moteur RGIE ne lit jamais le dossier de preuves : il contrôle l'arbre tel qu'il est. Ici, après coup :
 *  - valeurs DÉDUITES : chaque élément dont une valeur utile au contrôle vient de l'assistant (photo, document,
 *    déduction) sans avoir été confirmée reçoit un constat « R-UNCONFIRMED » (vérification, jamais bloquant) ; les
 *    constats du référentiel portant sur cet élément deviennent des « anomalies potentielles » (knowledge `deduced`) :
 *    une non-conformité qui repose sur une valeur non confirmée n'est pas établie ;
 *  - informations CONTRADICTOIRES : une question « contradiction » encore ouverte sur un élément donne un constat
 *    « R-CONTRADICTION », et les constats de cet élément passent au statut « Informations contradictoires » ;
 *  - informations INCONNUES : les constats « inconnu » portant sur un fait du relevé (terre, différentiel général,
 *    différentiel 30 mA) peuvent devenir des questions de l'assistant (`surveyQuestions`, crochet pour l'assistant ;
 *    rien n'est écrit ici dans le dossier de preuves).
 * Ces signalements apparaissent dans le contrôle et dans le dossier, même si la partie « Sources et hypothèses »
 * détaillée n'est pas imprimée.
 */
import type { Project } from '../model/types';
import type { Finding, FindingStatus, SurveyFact } from '../rules/types';
import { severityOf } from '../rules/context';
import type { Question } from './evidence';
import { unconfirmed } from './apply';

/** Propriétés qui influencent le contrôle réglementaire ou les calculs. */
export const REGULATORY_PROPS = new Set([
  'device',
  'ratedCurrent',
  'curve',
  'poles',
  'breakingCapacity',
  'residualCurrent',
  'rcdType',
  'section',
  'material',
  'cableType',
  'conductors',
  'length',
  'earth',
  'childSafety',
  'threePhase',
  'wetRoom',
  'power',
  'applianceType',
  '@parent',
]);

/** Propriétés non confirmées par élément (seulement celles qui comptent pour le contrôle). */
export function unconfirmedByNode(project: Project): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const p of unconfirmed(project)) {
    if (!REGULATORY_PROPS.has(p.prop)) continue;
    out.set(p.nodeId, [...(out.get(p.nodeId) ?? []), p.prop]);
  }
  return out;
}

/** Questions « contradiction » encore ouvertes, par élément (propriétés concernées ; « @node » si non précisée). */
export function contradictionsByNode(project: Project): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const q of project.evidence?.questions ?? []) {
    if (q.kind !== 'contradiction' || q.status !== 'open' || !q.about.nodeId) continue;
    const prop = q.about.prop ?? '@node';
    if (prop !== '@node' && !REGULATORY_PROPS.has(prop)) continue;
    out.set(q.about.nodeId, [...(out.get(q.about.nodeId) ?? []), prop]);
  }
  return out;
}

/** Statuts qu'une information déduite ou contradictoire ne permet pas d'établir. */
const UNSETTLED: FindingStatus[] = ['nonCompliant', 'warning', 'recommendation', 'insufficientData', 'potential', 'manualCheck'];

function reclassify(f: Finding, status: FindingStatus, knowledge: 'deduced' | 'contradictory'): Finding {
  const g: Finding = { ...f, status, blocking: false, knowledge, inferred: true };
  g.severity = severityOf(status, false);
  return g;
}

/** Ajoute les signalements et reclasse les constats concernés. Sans dossier de preuves : inchangé. */
export function withUnconfirmed(project: Project, findings: Finding[]): Finding[] {
  if (!project.evidence) return findings;
  const deduced = unconfirmedByNode(project);
  const contra = contradictionsByNode(project);
  if (!deduced.size && !contra.size) return findings;
  const marked = findings.map((f) => {
    if (!f.nodeId || f.status === 'derogation' || f.requirement === 'documentary') return f;
    if (contra.has(f.nodeId) && UNSETTLED.includes(f.status ?? 'warning')) return reclassify(f, 'contradictory', 'contradictory');
    if (deduced.has(f.nodeId)) {
      // Une non-conformité (ou un avertissement) qui repose sur une valeur non confirmée devient une anomalie potentielle.
      if (f.status === 'nonCompliant' || f.status === 'warning') return reclassify(f, 'potential', 'deduced');
      return f.inferred ? f : { ...f, inferred: true };
    }
    return f;
  });
  const extra: Finding[] = [
    ...[...deduced].map(
      ([nodeId, props]): Finding => ({
        ruleId: 'R-UNCONFIRMED',
        severity: 'info',
        status: 'manualCheck',
        hazard: 'none',
        blocking: false,
        requirement: 'physical',
        knowledge: 'deduced',
        nodeId,
        params: { props: props.join(', ') },
      }),
    ),
    ...[...contra].map(
      ([nodeId, props]): Finding => ({
        ruleId: 'R-CONTRADICTION',
        severity: 'warning',
        status: 'contradictory',
        hazard: 'none',
        blocking: false,
        requirement: 'physical',
        knowledge: 'contradictory',
        nodeId,
        params: { props: props.join(', ') },
      }),
    ),
  ];
  return [...marked, ...extra];
}

/** Identifiant stable de la question de relevé d'un fait (une seule question par fait). */
export const surveyQuestionId = (fact: SurveyFact) => 'q_survey_' + fact;

/**
 * Crochet pour l'assistant : questions à poser pour les faits du relevé restés inconnus (ou contradictoires) d'après
 * le contrôle. Seulement pour un projet avec dossier de preuves ; une question déjà présente (même ouverte, répondue
 * ou écartée) n'est jamais reproposée. La réponse s'écrit dans `meta.survey[fact]` (« present » / « absent ») ; « je
 * ne sais pas » laisse l'information inconnue. Rien n'est ajouté ici au dossier : l'assistant décide.
 */
export function surveyQuestions(project: Project, findings: Finding[]): Question[] {
  if (!project.evidence) return [];
  const known = new Set(project.evidence.questions.map((q) => q.id));
  const facts = new Set<SurveyFact>();
  for (const f of findings) if (f.fact && (f.knowledge === 'unknown' || f.knowledge === 'contradictory')) facts.add(f.fact);
  // Tableau fait ou refait avant ou après le 1/6/2023 (règles 30 mA de 2023) : une question par tableau
  const boards: Question[] = findings
    .filter((f) => f.ruleId === 'R-RCD30-DATE' && typeof f.params?.board2023 === 'string')
    .map((f) => String(f.params!.board2023))
    .filter((id) => !known.has('q_board2023_' + id))
    .map((id) => ({
      id: 'q_board2023_' + id,
      kind: 'choice' as const,
      about: { nodeId: id, prop: 'rgie2023' },
      text: { key: 'survey.question.board2023' },
      options: [
        { value: 'before', observations: [], label: 'enum.rgie2023.before' },
        { value: 'after', observations: [], label: 'enum.rgie2023.after' },
      ],
      priority: 'high' as const,
      status: 'open' as const,
    }));
  const factQuestions: Question[] = [...facts]
    .filter((fact) => !known.has(surveyQuestionId(fact)))
    .map((fact) => ({
      id: surveyQuestionId(fact),
      kind: 'unknown' as const,
      about: { prop: 'survey.' + fact },
      text: { key: 'survey.question.' + fact },
      options: [
        { value: 'present', observations: [], label: 'survey.present' },
        { value: 'absent', observations: [], label: 'survey.absent' },
      ],
      priority: 'high' as const,
      status: 'open' as const,
    }));
  return [...factQuestions, ...boards];
}
