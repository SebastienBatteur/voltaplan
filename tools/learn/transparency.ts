/**
 * Page publique de transparence réglementaire (site/apprendre/regles-rgie.html), produite à partir du registre
 * (src/regulations, ADR-0009) : version du RGIE, champ, méthode, exigences couvertes et leur statut, limites, exigences
 * qui attendent une validation externe. Aucune affirmation de certification : la page le dit explicitement.
 */
import { REGISTRY_REVIEWED_ON, REQUIREMENTS, RGIE_L1_V07 } from '../../src/regulations';
import type { RegRequirement, RequirementNature } from '../../src/regulations';

export const TRANSPARENCY_FILE = 'regles-rgie.html';
export const ISSUE_URL = 'https://github.com/SebastienBatteur/voltaplan/issues/new?template=regle-rgie.yml';
export const REGISTRY_URL = 'https://github.com/SebastienBatteur/voltaplan/blob/main/src/regulations/be/requirements.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const date = (iso: string) => iso.split('-').reverse().join('/');

export const NATURE_LABEL: Record<RequirementNature, string> = {
  rgie: 'Exigence du RGIE (référence vérifiée)',
  normative: 'Exigence d’une norme',
  goodPractice: 'Bonne pratique (pas d’obligation trouvée)',
  recommendation: 'Recommandation de Voltaplan',
  needsExpert: 'Interprétation à confirmer par un spécialiste',
  insufficientlyDocumented: 'Source insuffisante',
  tool: 'Fonctionnement de l’outil',
};
const DOC_LABEL: Record<RegRequirement['docValidation'], string> = {
  verified: 'relue dans le texte officiel',
  partial: 'relue en partie',
  notVerified: 'non vérifiée',
  notApplicable: 'sans objet',
};
const HUMAN_LABEL: Record<RegRequirement['humanValidation'], string> = {
  none: 'aucune',
  requested: 'question posée à un spécialiste',
  validated: 'validée par un spécialiste',
  rejected: 'rejetée par un spécialiste',
};

/**
 * Exigences et situations que Voltaplan ne vérifie pas (ou seulement en partie). Liste tenue à jour avec le rapport
 * docs/audit/REGISTRE-RGIE-2026.md ; elle n'est pas exhaustive : tout ce qui n'est pas dans le tableau ci-dessous
 * n'est pas vérifié.
 */
export const NOT_COVERED = [
  'Installations non domestiques : le contrôle suppose une installation domestique (logement).',
  'Locaux et emplacements particuliers (partie 7 du RGIE) : seuls quelques rappels sont donnés (salle de bain par le nom du circuit, borne de recharge, panneaux photovoltaïques). Les volumes de la salle de bain, piscines, saunas, chantiers et autres ne sont pas vérifiés.',
  'Mesures sur place : Voltaplan contrôle les valeurs saisies (terre, isolement, essais des différentiels), il ne les mesure pas. Une seule résistance d’isolement est saisie pour tout le projet.',
  'Liaisons équipotentielles : une seule réponse (présentes ou non) ; la liaison supplémentaire de la salle de bain n’est pas vérifiée à part.',
  'Prise de terre commune à plusieurs logements, sectionneur de terre, boucle à fond de fouille : non représentés.',
  'Choix des canalisations (mode de pose, groupement, température), au-delà du tableau 4.11 et des sections minimales : à vérifier par l’installateur (le contrôle le signale au-delà de 35 mm²).',
  'Examen de conformité, procès-verbal et visite de contrôle de l’organisme agréé : Voltaplan prépare le dossier, il ne remplace pas le contrôle.',
  'Modification ou extension « importante » d’une installation existante : la notion n’est pas modélisée, l’époque de chaque partie l’est.',
];

function refs(r: RegRequirement): string {
  if (!r.references.length) return '<span class="muted">—</span>';
  const seen = new Set<string>();
  return r.references
    .filter((x) => !seen.has(x.ref) && seen.add(x.ref))
    .map((x) => `${esc(x.ref)}${x.page ? ` <span class="muted">(p. ${esc(x.page)})</span>` : ''}`)
    .join('<br>');
}

/** Corps de la page (le gabarit est celui de la section Apprendre). */
export function transparencyBody(titleOf: (slug: string) => string | undefined): string {
  const rows = REQUIREMENTS.map((r) => {
    const arts = r.articles
      .map((a) => (titleOf(a) ? `<a href="${a}.html">${esc(titleOf(a)!)}</a>` : ''))
      .filter(Boolean)
      .join(', ');
    return `    <tr id="${r.id}"><td><strong>${esc(r.title)}</strong><br><code>${r.id}</code>${arts ? `<br><span class="muted">Voir : ${arts}</span>` : ''}</td><td>${esc(NATURE_LABEL[r.nature])}</td><td>${refs(r)}</td><td>${DOC_LABEL[r.docValidation]}</td><td>${HUMAN_LABEL[r.humanValidation]}</td></tr>`;
  }).join('\n');
  const count = (n: RequirementNature) => REQUIREMENTS.filter((r) => r.nature === n).length;
  const pending = REQUIREMENTS.filter((r) => r.humanValidation === 'requested' || r.nature === 'needsExpert' || r.nature === 'insufficientlyDocumented');
  const rules = REQUIREMENTS.reduce((s, r) => s + r.rules.length, 0);
  return `<main class="learn transparence">
  <nav class="crumbs" aria-label="Fil d’Ariane"><a href="../">Accueil</a> › <a href="./">Apprendre</a></nav>
  <h1>Ce que Voltaplan vérifie du RGIE</h1>
  <p class="lead">Voltaplan est une aide à la conception et à la vérification. Il n’est <strong>ni certifié ni validé</strong> par le SPF Économie, un organisme agréé ou un spécialiste du RGIE, et un contrôle sans remarque n’est pas une attestation de conformité. Seul le contrôle d’un organisme agréé l’établit.</p>

  <h2>Texte de référence</h2>
  <ul>
    <li><strong>${esc(RGIE_L1_V07.title)}</strong>, version ${esc(RGIE_L1_V07.version)} du ${date(RGIE_L1_V07.publishedOn)}, applicable depuis le ${date(RGIE_L1_V07.appliesFrom)} (${esc(RGIE_L1_V07.legal)}).</li>
    <li>Texte officiel : <a href="${RGIE_L1_V07.url}" rel="noopener">publication du SPF Économie (PDF)</a>.</li>
    <li>Dernière révision du registre : ${date(REGISTRY_REVIEWED_ON)}.</li>
    <li>Champ : installations électriques domestiques à basse tension en Belgique, neuves ou existantes (avec l’époque de chaque partie : avant le 1/10/1981, ancien RGIE, Livre 1).</li>
  </ul>

  <h2>Méthode</h2>
  <p>Chaque exigence contrôlée a une fiche dans un registre public (<a href="${REGISTRY_URL}" rel="noopener">code source</a>) : nature, référence exacte et page, conditions, exceptions, dispositions transitoires, valeurs, données nécessaires, règles du contrôle et tests. Les valeurs (100 Ω, 30 mA, tableau 4.11…) n’y sont écrites qu’une fois, et le contrôle comme ces pages les lisent au même endroit.</p>
  <ul>
    <li><strong>Validation documentaire</strong> : chaque référence a été relue dans le texte officiel, avec l’assistance d’une IA, et chaque valeur comparée au texte. Elle dit que la référence existe et dit bien cela ; elle ne garantit pas l’interprétation.</li>
    <li><strong>Validation humaine</strong> : la relecture par un spécialiste du RGIE (organisme agréé, SPF Économie). <strong>Aucune exigence n’a été validée ainsi à ce jour</strong> ; des questions ont été préparées pour ${pending.length} d’entre elles.</li>
    <li>Aucune référence n’est inventée : une exigence sans référence vérifiée est présentée comme une bonne pratique, une recommandation ou une source insuffisante, jamais comme une obligation du RGIE.</li>
  </ul>
  <p>Le résultat de chaque exigence est l’un de ces états : <em>satisfaite</em>, <em>non satisfaite</em>, <em>non applicable</em>, <em>données insuffisantes</em>, <em>à vérifier</em> ou <em>recommandation</em>. Une information absente n’est jamais comptée comme conforme, une exigence non applicable n’est pas comptée comme satisfaite, et un doute (« à vérifier ») n’est jamais présenté comme une non-conformité certaine.</p>

  <h2>Exigences contrôlées</h2>
  <p>${REQUIREMENTS.length} fiches, vérifiées par ${rules} règles du contrôle : ${count('rgie')} exigences du RGIE, ${count('goodPractice')} bonnes pratiques, ${count('recommendation')} recommandations, ${count('needsExpert') + count('insufficientlyDocumented')} à confirmer ou insuffisamment documentées, ${count('tool')} propres à l’outil. Chaque règle est testée sur des cas conformes, non conformes, aux valeurs limites, avec les exceptions, les dates de transition, les données manquantes et les cas non applicables.</p>
  <div class="table-wrap"><table>
    <thead><tr><th>Exigence</th><th>Nature</th><th>Référence</th><th>Validation documentaire</th><th>Validation humaine</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table></div>

  <h2>En attente d’une validation externe</h2>
  <ul>
${pending.map((r) => `    <li><a href="#${r.id}">${esc(r.title)}</a> — ${esc(NATURE_LABEL[r.nature])}</li>`).join('\n')}
  </ul>

  <h2>Ce que Voltaplan ne vérifie pas</h2>
  <ul>
${NOT_COVERED.map((x) => `    <li>${esc(x)}</li>`).join('\n')}
  </ul>
  <p>Cette liste n’est pas exhaustive : ce qui n’est pas dans le tableau ci-dessus n’est pas vérifié.</p>

  <h2>Signaler une erreur</h2>
  <p>Une règle vous semble fausse, manquante ou mal formulée ? <a href="${ISSUE_URL}" rel="noopener">Signalez-la sur GitHub</a>, avec la référence du RGIE si vous la connaissez. Le ticket est public : n’y mettez aucune donnée de client.</p>
</main>`;
}
