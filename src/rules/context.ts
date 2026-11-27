/**
 * Contexte réglementaire d'une partie d'installation : édition applicable et nature (neuve / existante),
 * puis classement d'un constat (statut, caractère bloquant, sévérité affichée).
 *
 * Une installation peut mêler plusieurs générations de circuits (ex. tableau de 1975, circuits ajoutés en 2024).
 * Le contexte se lit de l'élément vers la racine ; le premier renseignement trouvé l'emporte :
 *  1. propriété `oldPart` (partie antérieure au premier référentiel) ;
 *  2. propriété `installedOn` (date de réalisation de la partie : « 2024 », « 2024-03 », « 2024-03-15 ») ;
 *  3. propriété `installationKind` de la partie (« new » / « existing ») ;
 *  4. projet : `meta.installationDate`, sinon `meta.rgieVersion` (ancien modèle « new » / « old »).
 */
import type { ElNode, Project } from '../model/types';
import type { Derogation, Edition, Finding, FindingStatus, RuleMeta, RulePack, Severity } from './types';

export interface PartContext {
  /** Édition applicable à la partie (id de RulePack.editions), ou « current » sans éditions datées. */
  edition: string;
  /**
   * La partie est-elle réalisée sous l'édition en vigueur et soumise à la réception d'une installation neuve ?
   * Une partie neuve est une conception : le dessin y est la référence (un élément non dessiné est absent du
   * projet). Une partie existante est un relevé : non dessiné = inconnu, sauf absence confirmée (ADR-0007).
   */
  isNew: boolean;
  /** L'édition applicable est-elle l'édition en vigueur ? */
  current: boolean;
  /** L'édition vient-elle d'une donnée (date, partie ancienne) et non d'une hypothèse ? */
  dated?: boolean;
}

/** Date ISO normalisée (« 2024 » → « 2024-01-01 ») ou undefined. */
export function normDate(v: unknown): string | undefined {
  const s = String(v ?? '').trim();
  const m = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/.exec(s);
  if (!m) return undefined;
  const pad = (x: string | undefined) => (x ?? '1').padStart(2, '0');
  return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
}

/**
 * Plage d'une date éventuellement partielle : « 2023 » = du 1/1 au 31/12/2023 ; « 2023-06 » = juin 2023. Une date
 * partielle n'est jamais lue comme le premier jour de la période (elle pouvait faire passer une partie sous une
 * dérogation qu'elle ne mérite pas).
 */
export function dateRange(v: unknown): { from: string; to: string } | undefined {
  const s = String(v ?? '').trim();
  const m = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/.exec(s);
  if (!m) return undefined;
  const y = m[1];
  const pad = (x: string) => x.padStart(2, '0');
  if (m[3]) return { from: `${y}-${pad(m[2]!)}-${pad(m[3])}`, to: `${y}-${pad(m[2]!)}-${pad(m[3])}` };
  if (m[2]) {
    const last = new Date(Date.UTC(Number(y), Number(m[2]), 0)).getUTCDate();
    return { from: `${y}-${pad(m[2])}-01`, to: `${y}-${pad(m[2])}-${pad(String(last))}` };
  }
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

/** Date (éventuellement partielle) à partir de `boundary` ? `unknown` si la période chevauche la limite. */
export function onOrAfter(v: unknown, boundary: string): 'yes' | 'no' | 'unknown' | undefined {
  const r = dateRange(v);
  if (!r) return undefined;
  if (r.from >= boundary) return 'yes';
  if (r.to < boundary) return 'no';
  return 'unknown';
}

/** Édition d'une date éventuellement partielle : à cheval sur deux éditions, la plus récente (règles en vigueur). */
function editionOf(editions: Edition[], v: unknown): Edition | undefined {
  const r = dateRange(v);
  if (!r) return undefined;
  return editionAt(editions, r.to) ?? editionAt(editions, r.from);
}

/** Édition en vigueur à une date. */
export function editionAt(editions: Edition[], date: string): Edition | undefined {
  return editions.find((e) => (!e.from || date >= e.from) && (!e.until || date < e.until));
}

function currentEdition(pack: RulePack): Edition | undefined {
  return pack.editions?.at(-1);
}

/** Contexte du projet (sans partie particulière). */
export function projectContext(project: Project, pack: RulePack): PartContext {
  return partContext(project, pack, []);
}

/**
 * Contexte d'une partie : `chain` = l'élément et ses ancêtres (dans n'importe quel ordre, l'élément le plus proche
 * gagne : on passe la chaîne de la racine vers l'élément).
 */
export function partContext(project: Project, pack: RulePack, chain: ElNode[]): PartContext {
  const editions = pack.editions ?? [];
  const cur = currentEdition(pack);
  const meta = project.meta ?? ({} as Project['meta']);
  let edition: string | undefined;
  let kind: 'new' | 'existing' | undefined;
  let dated = false;
  for (const n of [...chain].reverse()) {
    if (edition === undefined) {
      if (n.props.oldPart === true && editions.length) edition = editions[0].id;
      else {
        edition = editionOf(editions, n.props.installedOn)?.id;
      }
      if (edition !== undefined) dated = true;
    }
    if (kind === undefined && (n.props.installationKind === 'new' || n.props.installationKind === 'existing')) kind = n.props.installationKind;
  }
  if (edition === undefined) {
    edition = editionOf(editions, meta.installationDate)?.id;
    if (edition !== undefined) dated = true;
  }
  if (edition === undefined) {
    // Ancien modèle : « new » = édition en vigueur, « old » = édition précédente.
    if (meta.rgieVersion === 'old' && editions.length >= 2) edition = editions[editions.length - 2].id;
    else edition = cur?.id ?? 'current';
  }
  const current = !cur || edition === cur.id;
  // Une partie réalisée sous une édition antérieure est forcément existante.
  const isNew = current && (kind ?? meta.installationKind) === 'new';
  return { edition, isNew, current, dated };
}

/** Dérogation saisie pour ce constat (règle seule, ou règle + élément). */
export function findDerogation(derogations: Derogation[] | undefined, f: Finding): Derogation | undefined {
  return derogations?.find((d) => d.ruleId === f.ruleId && (!d.nodeId || d.nodeId === f.nodeId) && d.reason.trim());
}

/** Sévérité affichée, dérivée du statut. */
export function severityOf(status: FindingStatus, blocking: boolean): Severity {
  if (blocking) return 'error';
  if (status === 'nonCompliant' || status === 'warning' || status === 'insufficientData' || status === 'potential' || status === 'contradictory') return 'warning';
  return 'info';
}

/**
 * Classe un constat brut d'une règle selon le contexte de la partie concernée.
 *  - partie neuve sous l'édition en vigueur : non-conformité bloquante, donnée manquante bloquante ;
 *  - partie existante (ou édition antérieure) : une règle de sécurité (gravité élevée) reste non conforme et bloquante
 *    pour un dossier de réception ; les autres prennent le statut prévu par la règle (`existing`), par défaut
 *    « recommandation » — jamais « conforme » en silence ;
 *  - état de connaissance (ADR-0007) : `unknown` → « Informations insuffisantes » (bloquant seulement pour une partie
 *    neuve, comme une donnée manquante) ; `deduced` → « Anomalie potentielle » (non bloquant) ; `contradictory` →
 *    « Informations contradictoires » (non bloquant) ; `measureNeeded` → « Vérification manuelle nécessaire » ;
 *    `absent` (absence confirmée) et données connues → classement ci-dessus, inchangé ;
 *  - exigence documentaire : jamais « non conforme » au sens de l'installation (statut « Informations insuffisantes »
 *    ou statut prévu) ; peut rester bloquante pour un dossier de réception (« dossier incomplet ») ;
 *  - dérogation saisie : statut « dérogation », non bloquante, motif conservé.
 */
export function classify(raw: Omit<Finding, 'severity'>, rule: RuleMeta | undefined, ctx: PartContext, derogations?: Derogation[]): Finding {
  const kind = rule?.kind ?? 'nonCompliance';
  const hazard = rule?.hazard ?? 'medium';
  let status: FindingStatus;
  let blocking = false;
  switch (kind) {
    case 'nonCompliance':
      if (ctx.isNew) {
        status = 'nonCompliant';
        blocking = true;
      } else {
        // Partie existante : une non-conformité reste une non-conformité. Seule une dérogation du RGIE, appliquée par la
        // règle elle-même (src/regulations/be/derogations.ts), la change. Le caractère bloquant est une décision distincte
        // du statut : dans l'existant, seule une gravité élevée bloque.
        status = rule?.existing ?? 'nonCompliant';
        blocking = status === 'nonCompliant' && hazard === 'high';
      }
      break;
    case 'missingData':
      status = 'insufficientData';
      blocking = ctx.isNew;
      break;
    case 'warning':
      status = 'warning';
      break;
    case 'manualCheck':
      status = 'manualCheck';
      break;
    case 'recommendation':
      status = 'recommendation';
      break;
    default:
      status = 'recommendation';
  }
  if (raw.status) status = raw.status; // statut imposé par la règle
  if (raw.status && raw.status !== 'nonCompliant' && raw.status !== 'insufficientData') blocking = false;
  let inferred = raw.inferred;
  switch (raw.knowledge) {
    case 'unknown':
      if (status !== 'manualCheck') {
        status = 'insufficientData';
        blocking = ctx.isNew;
      }
      break;
    case 'deduced':
      if (status === 'nonCompliant' || status === 'warning' || status === 'manualCheck') status = 'potential';
      blocking = false;
      inferred = true;
      break;
    case 'contradictory':
      status = 'contradictory';
      blocking = false;
      break;
    case 'measureNeeded':
      status = 'manualCheck';
      blocking = false;
      break;
  }
  if (rule?.neverBlocking) blocking = false;
  const requirement = raw.requirement ?? rule?.requirement ?? 'physical';
  // Exigence documentaire : jamais présentée comme une non-conformité de l'installation.
  if (requirement === 'documentary' && status === 'nonCompliant') status = 'insufficientData';
  const f: Finding = { ...raw, status, hazard, blocking, edition: ctx.edition, requirement, severity: 'info' };
  if (inferred) f.inferred = true;
  const d = findDerogation(derogations, f);
  if (d && (status === 'nonCompliant' || status === 'recommendation' || status === 'warning' || status === 'potential')) {
    f.status = 'derogation';
    f.blocking = false;
    f.derogation = { reason: d.reason, reference: d.reference };
  }
  f.severity = severityOf(f.status!, !!f.blocking);
  return f;
}
