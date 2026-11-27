/** Cas des règles du lot g1 (voir types.ts et test/rules.cases.test.ts). */
import { RULE_PACKS } from '../../src/rules';
import { belgium } from '../../src/rules/be/rgie';
import type { Project } from '../../src/model/types';
import { circuit, existing, node, project, type Built } from './fixtures';
import type { RuleCase } from './types';

/** Projet neuf conforme avec un circuit de prises nommé. */
const base = () => project(circuit('mcb', 16, 2.5, [node('socket')], 'Prises séjour'));
const p = (b: Built) => b.p;
/** Applique `f` au projet puis le renvoie. */
const tweak = (b: Built, f: (p: Project) => void) => {
  f(b.p);
  return b.p;
};

/**
 * Référentiel de test qui définit des listes d'options (le référentiel belge n'en définit pas, R-COUNTRY-OPTION y est
 * inactive) : mêmes règles que la Belgique, désignations de câbles néerlandaises. Enregistré une fois, à l'usage, dans
 * le registre des référentiels (tableau exporté, rien d'autre n'est modifié) ; seuls les projets qui le nomment l'utilisent.
 */
const TEST_PACK = 'TEST-NL-OPTIONS';
function withTestPack(b: Built): Built {
  if (!RULE_PACKS.some((x) => x.id === TEST_PACK)) RULE_PACKS.push({ ...belgium, id: TEST_PACK, country: 'NL', options: { cableType: ['VMvK', 'XMvK'] } });
  b.p.meta.ruleset = TEST_PACK;
  return b;
}
/** Projet de test avec un câble de type donné. */
const cableTyped = (type: string) => {
  const b = project(circuit('mcb', 16, 2.5, [node('socket')], 'Prises', {}));
  b.sub.children.at(-1)!.children[0].props.cableType = type;
  return b;
};

/** Projet sans différentiel en amont d'un circuit : un tableau secondaire alimenté directement depuis le compteur. */
const withUnprotectedBoard = (b: Built) => {
  b.p.roots[0].children[0].children.push(node('board', {}, [circuit('mcb', 16, 1.5, [node('light')], 'Garage')]));
  return b;
};
/** Projet sans terre dessinée. */
const withoutEarth = (b: Built) => {
  b.board.children = b.board.children.filter((x) => x.kind !== 'earthBar');
  return b;
};

const DOC_NEW = { status: 'insufficientData', blocking: true } as const;
const DOC_EXISTING = { status: 'insufficientData', blocking: false } as const;
const PRE1981 = 'Partie 8.2.1 point 7 (p. 275) : schéma simplifié des parties d’avant le 1/10/1981';

export const CASES: RuleCase[] = [
  // ---------------------------------------------------------------- R-RULESET-UNKNOWN
  {
    rule: 'R-RULESET-UNKNOWN',
    kind: 'nonCompliant',
    title: 'référentiel inconnu : règle non évaluée, bloquant (jamais « non conforme »)',
    build: () => tweak(base(), (x) => (x.meta.ruleset = 'XX-INCONNU')),
    expect: { status: 'notEvaluated', blocking: true },
  },
  {
    rule: 'R-RULESET-UNKNOWN',
    kind: 'nonCompliant',
    title: 'référentiel inconnu sur une installation existante : toujours bloquant',
    build: () => tweak(existing(base(), '1995'), (x) => (x.meta.ruleset = 'BE-RGIE-2026')),
    expect: { status: 'notEvaluated', blocking: true },
  },
  {
    rule: 'R-RULESET-UNKNOWN',
    kind: 'notApplicable',
    title: 'référentiel belge nommé : contrôle normal',
    build: () => tweak(base(), (x) => (x.meta.ruleset = 'BE-RGIE')),
    expect: 'silent',
  },
  {
    rule: 'R-RULESET-UNKNOWN',
    kind: 'exception',
    title: 'référentiel vide : Belgique (défaut historique)',
    build: () => tweak(base(), (x) => (x.meta.ruleset = '')),
    expect: 'silent',
  },
  {
    rule: 'R-RULESET-UNKNOWN',
    kind: 'missingData',
    title: 'référentiel absent : Belgique (défaut historique documenté)',
    build: () => tweak(base(), (x) => delete x.meta.ruleset),
    expect: 'silent',
  },

  // ---------------------------------------------------------------- R-COUNTRY-OPTION
  {
    rule: 'R-COUNTRY-OPTION',
    kind: 'notApplicable',
    title: 'référentiel belge (sans options) : jamais déclenchée, même avec un câble VOB',
    build: () => p(cableTyped('VOB')),
    expect: 'silent',
  },
  {
    rule: 'R-COUNTRY-OPTION',
    kind: 'nonCompliant',
    title: 'référentiel de test NL : câble VOB absent de la liste → avertissement non bloquant',
    build: () => p(withTestPack(cableTyped('VOB'))),
    expect: { status: 'warning', blocking: false, params: { prop: 'cableType', value: 'VOB', country: 'NL' } },
  },
  {
    rule: 'R-COUNTRY-OPTION',
    kind: 'nonCompliant',
    title: 'référentiel de test NL, installation existante : avertissement, jamais bloquant',
    build: () => p(withTestPack(existing(cableTyped('VOB'), '1995'))),
    expect: { status: 'warning', blocking: false },
  },
  {
    rule: 'R-COUNTRY-OPTION',
    kind: 'compliant',
    title: 'référentiel de test NL : désignation de la liste (XMvK)',
    build: () => p(withTestPack(cableTyped('XMvK'))),
    expect: 'silent',
  },
  {
    rule: 'R-COUNTRY-OPTION',
    kind: 'missingData',
    title: 'référentiel de test NL : type de câble vide → ignoré (pas une désignation étrangère)',
    build: () => p(withTestPack(cableTyped(''))),
    expect: 'silent',
  },

  // ---------------------------------------------------------------- R-OLD-RGIE
  {
    rule: 'R-OLD-RGIE',
    kind: 'notApplicable',
    title: 'installation neuve sous le Livre 1 : pas d’information',
    build: () => p(base()),
    expect: 'silent',
  },
  {
    rule: 'R-OLD-RGIE',
    kind: 'nonCompliant',
    title: 'installation existante de 1990 (ancien RGIE) : information non bloquante',
    build: () => p(existing(base(), '1990-05-01')),
    expect: { status: 'recommendation', blocking: false },
  },
  {
    rule: 'R-OLD-RGIE',
    kind: 'missingData',
    title: 'sans date, ancien modèle rgieVersion « old » : édition 1981 → information',
    build: () =>
      tweak(existing(base()), (x) => {
        x.meta.rgieVersion = 'old';
      }),
    expect: { status: 'recommendation', blocking: false },
  },
  {
    rule: 'R-OLD-RGIE',
    kind: 'missingData',
    title: 'sans date ni « old » : édition en vigueur supposée, pas d’information',
    build: () => p(existing(base())),
    expect: 'silent',
  },
  {
    rule: 'R-OLD-RGIE',
    kind: 'boundary',
    title: 'veille de l’entrée en application du Livre 1 (31/5/2020) : ancien RGIE',
    build: () => p(existing(base(), '2020-05-31')),
    expect: { status: 'recommendation', blocking: false },
  },
  {
    rule: 'R-OLD-RGIE',
    kind: 'boundary',
    title: 'jour de l’entrée en application du Livre 1 (1/6/2020) : pas d’information',
    build: () => p(existing(base(), '2020-06-01')),
    expect: 'silent',
  },
  {
    rule: 'R-OLD-RGIE',
    kind: 'transitional',
    title: 'date partielle « 2020 » (à cheval sur le 1/6/2020) : édition la plus récente, pas d’information',
    build: () => p(existing(base(), '2020')),
    expect: 'silent',
  },
  {
    rule: 'R-OLD-RGIE',
    kind: 'transitional',
    title: 'date partielle « 2020-05 » : entièrement avant le Livre 1 → information',
    build: () => p(existing(base(), '2020-05')),
    expect: { status: 'recommendation', blocking: false },
  },
  {
    rule: 'R-OLD-RGIE',
    kind: 'transitional',
    title: 'projet neuf contenant une partie ancienne (oldPart) : information attendue pour cette partie',
    build: () =>
      tweak(base(), (x) => {
        x.roots[0].children[0].children.push(node('board', { oldPart: true }, [circuit('fuse', 16, 1.5, [node('light')], 'Cave')]));
      }),
    expect: { status: 'recommendation', blocking: false },
    knownIssue: 'contexte du projet seulement : une partie d’une édition antérieure dans un projet récent ne reçoit pas l’information (audit g1, R-OLD-RGIE 7 et verdict c)',
  },

  // ---------------------------------------------------------------- R-INSTALL-DATE
  {
    rule: 'R-INSTALL-DATE',
    kind: 'nonCompliant',
    title: 'installation marquée neuve, exécution commencée en 2019 : vérification non bloquante',
    build: () => tweak(base(), (x) => (x.meta.installationDate = '2019-03-15')),
    expect: { status: 'manualCheck', blocking: false, params: { date: '2019-03-15' } },
  },
  {
    rule: 'R-INSTALL-DATE',
    kind: 'boundary',
    title: 'neuve datée du 31/5/2020 (veille du Livre 1) : à vérifier',
    build: () => tweak(base(), (x) => (x.meta.installationDate = '2020-05-31')),
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-INSTALL-DATE',
    kind: 'boundary',
    title: 'neuve datée du 1/6/2020 (jour du Livre 1) : cohérent',
    build: () => tweak(base(), (x) => (x.meta.installationDate = '2020-06-01')),
    expect: 'silent',
  },
  {
    rule: 'R-INSTALL-DATE',
    kind: 'boundary',
    title: 'neuve datée du 2/6/2020 : cohérent',
    build: () => tweak(base(), (x) => (x.meta.installationDate = '2020-06-02')),
    expect: 'silent',
  },
  {
    rule: 'R-INSTALL-DATE',
    kind: 'transitional',
    title: 'neuve datée « 2020 » seulement (peut précéder le 1/6/2020) : à vérifier',
    build: () => tweak(base(), (x) => (x.meta.installationDate = '2020')),
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-INSTALL-DATE',
    kind: 'transitional',
    title: 'neuve datée « 2020-06 » : entièrement sous le Livre 1, cohérent',
    build: () => tweak(base(), (x) => (x.meta.installationDate = '2020-06')),
    expect: 'silent',
  },
  {
    rule: 'R-INSTALL-DATE',
    kind: 'notApplicable',
    title: 'installation existante datée de 2019 : cohérent, pas de constat',
    build: () => p(existing(base(), '2019-03-15')),
    expect: 'silent',
  },
  {
    rule: 'R-INSTALL-DATE',
    kind: 'missingData',
    title: 'neuve sans date : installation neuve sous l’édition en vigueur, pas de constat',
    build: () => tweak(base(), (x) => delete x.meta.installationDate),
    expect: 'silent',
  },
  {
    rule: 'R-INSTALL-DATE',
    kind: 'missingData',
    title: 'neuve, date dans un format non reconnu (« 15/03/2019 ») : à vérifier',
    build: () => tweak(base(), (x) => (x.meta.installationDate = '15/03/2019')),
    expect: { status: 'manualCheck', blocking: false },
    knownIssue: 'date non reconnue ignorée : rien n’est signalé et le projet reste neuf sous l’édition en vigueur (audit g1, R-INSTALL-DATE 8 et verdict)',
  },
  {
    rule: 'R-INSTALL-DATE',
    kind: 'transitional',
    title: 'partie marquée neuve mais datée de 2019 dans un projet neuf : à vérifier',
    build: () =>
      tweak(base(), (x) => {
        x.roots[0].children[0].children.push(node('board', { installationKind: 'new', installedOn: '2019' }, [circuit('mcb', 16, 1.5, [node('light')], 'Garage')]));
      }),
    expect: { status: 'manualCheck', blocking: false },
    knownIssue: 'ne lit que meta.installationDate : une partie neuve datée d’avant le 1/6/2020 devient existante en silence (audit g1, R-INSTALL-DATE 7)',
  },

  // ---------------------------------------------------------------- R-DOC-INSTALLER
  {
    rule: 'R-DOC-INSTALLER',
    kind: 'compliant',
    title: 'nom du responsable des travaux renseigné',
    build: () => p(base()),
    expect: 'silent',
  },
  {
    rule: 'R-DOC-INSTALLER',
    kind: 'nonCompliant',
    title: 'neuf, nom vide : dossier incomplet bloquant (3.1.2.1 a)',
    build: () => tweak(base(), (x) => (x.meta.installer!.name = '')),
    expect: DOC_NEW,
  },
  {
    rule: 'R-DOC-INSTALLER',
    kind: 'missingData',
    title: 'neuf, responsable non renseigné du tout : bloquant',
    build: () => tweak(base(), (x) => delete (x.meta as Partial<Project['meta']>).installer),
    expect: DOC_NEW,
  },
  {
    rule: 'R-DOC-INSTALLER',
    kind: 'boundary',
    title: 'neuf, nom fait d’espaces : traité comme absent',
    build: () => tweak(base(), (x) => (x.meta.installer!.name = '   ')),
    expect: DOC_NEW,
  },
  {
    rule: 'R-DOC-INSTALLER',
    kind: 'nonCompliant',
    title: 'existant (2010), nom absent : non bloquant',
    build: () => tweak(existing(base(), '2010'), (x) => (x.meta.installer!.name = '')),
    expect: DOC_EXISTING,
  },
  {
    rule: 'R-DOC-INSTALLER',
    kind: 'exception',
    title: 'ancien RGIE (1990) : 8.2.2 point 7 tolère l’absence de la TVA, pas du nom → constat non bloquant',
    build: () => tweak(existing(base(), '1990'), (x) => (x.meta.installer!.name = '')),
    expect: DOC_EXISTING,
  },
  {
    rule: 'R-DOC-INSTALLER',
    kind: 'exception',
    title: 'installation d’avant le 1/10/1981 : le schéma simplifié n’exige pas le nom du responsable',
    build: () => tweak(existing(base(), '1975'), (x) => (x.meta.installer!.name = '')),
    expect: 'silent',
    knownIssue: `${PRE1981} sans le nom du responsable ; le moteur le demande encore (insufficientData non bloquant)`,
  },
  {
    rule: 'R-DOC-INSTALLER',
    kind: 'exception',
    title: 'extension neuve dans un projet existant : mention exigée (extension importante), bloquant',
    build: () =>
      tweak(existing(base(), '2010'), (x) => {
        x.meta.installer!.name = '';
        x.roots[0].children[0].children.push(node('board', { installationKind: 'new', installedOn: '2026-10' }, [circuit('mcb', 20, 2.5, [node('socket')], 'Atelier')]));
      }),
    expect: DOC_NEW,
    knownIssue: 'constat classé selon le projet : une extension neuve dans un projet existant ne rend pas la mention bloquante (3.1.2.1 a ; audit g1, constats transversaux)',
  },

  // ---------------------------------------------------------------- R-DOC-QUALITY
  {
    rule: 'R-DOC-QUALITY',
    kind: 'compliant',
    title: 'qualité du responsable renseignée',
    build: () => p(base()),
    expect: 'silent',
  },
  {
    rule: 'R-DOC-QUALITY',
    kind: 'nonCompliant',
    title: 'neuf, nom présent sans qualité : bloquant (3.1.2.1 a)',
    build: () => tweak(base(), (x) => (x.meta.installer!.quality = '')),
    expect: DOC_NEW,
  },
  {
    rule: 'R-DOC-QUALITY',
    kind: 'missingData',
    title: 'neuf, qualité non renseignée : bloquant',
    build: () => tweak(base(), (x) => delete x.meta.installer!.quality),
    expect: DOC_NEW,
  },
  {
    rule: 'R-DOC-QUALITY',
    kind: 'boundary',
    title: 'neuf, qualité faite d’espaces : traitée comme absente',
    build: () => tweak(base(), (x) => (x.meta.installer!.quality = '  ')),
    expect: DOC_NEW,
  },
  {
    rule: 'R-DOC-QUALITY',
    kind: 'notApplicable',
    title: 'nom absent : seule R-DOC-INSTALLER est émise (pas de doublon)',
    build: () => tweak(base(), (x) => (x.meta.installer = { name: '', quality: '', address: {} })),
    expect: 'silent',
  },
  {
    rule: 'R-DOC-QUALITY',
    kind: 'nonCompliant',
    title: 'existant (2010), qualité absente : non bloquant',
    build: () => tweak(existing(base(), '2010'), (x) => (x.meta.installer!.quality = '')),
    expect: DOC_EXISTING,
  },
  {
    rule: 'R-DOC-QUALITY',
    kind: 'exception',
    title: 'ancien RGIE (1990) : 8.2.2 point 7 ne dispense pas de la qualité → constat non bloquant',
    build: () => tweak(existing(base(), '1990'), (x) => (x.meta.installer!.quality = '')),
    expect: DOC_EXISTING,
  },
  {
    rule: 'R-DOC-QUALITY',
    kind: 'exception',
    title: 'installation d’avant le 1/10/1981 : le schéma simplifié n’exige pas la qualité',
    build: () => tweak(existing(base(), '1975'), (x) => (x.meta.installer!.quality = '')),
    expect: 'silent',
    knownIssue: `${PRE1981} sans la qualité du responsable ; le moteur la demande encore (insufficientData non bloquant)`,
  },

  // ---------------------------------------------------------------- R-DOC-ADDRESS
  {
    rule: 'R-DOC-ADDRESS',
    kind: 'compliant',
    title: 'adresse complète',
    build: () => p(base()),
    expect: 'silent',
  },
  {
    rule: 'R-DOC-ADDRESS',
    kind: 'nonCompliant',
    title: 'neuf, rue absente : bloquant (3.1.2.1 a)',
    build: () => tweak(base(), (x) => (x.meta.site!.street = '')),
    expect: DOC_NEW,
  },
  {
    rule: 'R-DOC-ADDRESS',
    kind: 'nonCompliant',
    title: 'neuf, commune absente : bloquant',
    build: () => tweak(base(), (x) => delete x.meta.site!.city),
    expect: DOC_NEW,
  },
  {
    rule: 'R-DOC-ADDRESS',
    kind: 'boundary',
    title: 'neuf, rue faite d’espaces : traitée comme absente',
    build: () => tweak(base(), (x) => (x.meta.site!.street = '   ')),
    expect: DOC_NEW,
  },
  {
    rule: 'R-DOC-ADDRESS',
    kind: 'missingData',
    title: 'neuf, aucune adresse : bloquant',
    build: () => tweak(base(), (x) => delete (x.meta as Partial<Project['meta']>).site),
    expect: DOC_NEW,
  },
  {
    rule: 'R-DOC-ADDRESS',
    kind: 'nonCompliant',
    title: 'existant (2010), rue absente : non bloquant',
    build: () => tweak(existing(base(), '2010'), (x) => (x.meta.site!.street = '')),
    expect: DOC_EXISTING,
  },
  {
    rule: 'R-DOC-ADDRESS',
    kind: 'exception',
    title: 'avant le 1/10/1981 : l’adresse reste exigée dans le schéma simplifié (8.2.1 point 7) → constat non bloquant',
    build: () => tweak(existing(base(), '1975'), (x) => (x.meta.site!.city = '')),
    expect: DOC_EXISTING,
  },

  // ---------------------------------------------------------------- R-DOC-SUPPLY
  {
    rule: 'R-DOC-SUPPLY',
    kind: 'compliant',
    title: 'tension et nature du courant indiquées (2 × 230 V ~)',
    build: () => tweak(base(), (x) => (x.meta.supply = '2 x 230V ~ 50Hz')),
    expect: 'silent',
  },
  {
    rule: 'R-DOC-SUPPLY',
    kind: 'compliant',
    title: 'réseau 3N × 400 V ~ indiqué',
    build: () => tweak(base(), (x) => (x.meta.supply = '3N x 400V ~ 50Hz')),
    expect: 'silent',
  },
  {
    rule: 'R-DOC-SUPPLY',
    kind: 'nonCompliant',
    title: 'neuf, alimentation vide : bloquant (3.1.2.1 a)',
    build: () => tweak(base(), (x) => (x.meta.supply = '')),
    expect: DOC_NEW,
  },
  {
    rule: 'R-DOC-SUPPLY',
    kind: 'boundary',
    title: 'neuf, alimentation faite d’espaces : traitée comme absente',
    build: () => tweak(base(), (x) => (x.meta.supply = '  ')),
    expect: DOC_NEW,
  },
  {
    rule: 'R-DOC-SUPPLY',
    kind: 'missingData',
    title: 'neuf, champ absent (ancien fichier) : bloquant',
    build: () => tweak(base(), (x) => delete (x.meta as Partial<Project['meta']>).supply),
    expect: DOC_NEW,
  },
  {
    rule: 'R-DOC-SUPPLY',
    kind: 'missingData',
    title: 'neuf, « 230 » sans nature du courant : mention incomplète',
    build: () => tweak(base(), (x) => (x.meta.supply = '230')),
    expect: DOC_NEW,
    knownIssue: 'seul un champ non vide est vérifié : la nature du courant exigée par 3.1.2.1 a (« La tension et la nature du courant ») n’est pas contrôlée (audit g1, R-DOC-SUPPLY 8)',
  },
  {
    rule: 'R-DOC-SUPPLY',
    kind: 'nonCompliant',
    title: 'existant (2010), alimentation vide : non bloquant',
    build: () => tweak(existing(base(), '2010'), (x) => (x.meta.supply = '')),
    expect: DOC_EXISTING,
  },
  {
    rule: 'R-DOC-SUPPLY',
    kind: 'exception',
    title: 'avant le 1/10/1981 : la tension reste exigée (8.2.1 point 7) → constat non bloquant',
    build: () => tweak(existing(base(), '1975'), (x) => (x.meta.supply = '')),
    expect: DOC_EXISTING,
  },

  // ---------------------------------------------------------------- R-DOC-NUMBER
  {
    rule: 'R-DOC-NUMBER',
    kind: 'compliant',
    title: 'numéro du dossier renseigné',
    build: () => p(base()),
    expect: 'silent',
  },
  {
    rule: 'R-DOC-NUMBER',
    kind: 'nonCompliant',
    title: 'neuf, numéro vide : bloquant (3.1.2)',
    build: () => tweak(base(), (x) => (x.meta.docNumber = '')),
    expect: DOC_NEW,
  },
  {
    rule: 'R-DOC-NUMBER',
    kind: 'boundary',
    title: 'neuf, numéro fait d’espaces : traité comme absent',
    build: () => tweak(base(), (x) => (x.meta.docNumber = '  ')),
    expect: DOC_NEW,
  },
  {
    rule: 'R-DOC-NUMBER',
    kind: 'missingData',
    title: 'neuf, numéro non renseigné : bloquant',
    build: () => tweak(base(), (x) => delete (x.meta as Partial<Project['meta']>).docNumber),
    expect: DOC_NEW,
  },
  {
    rule: 'R-DOC-NUMBER',
    kind: 'nonCompliant',
    title: 'existant (2010), numéro vide : non bloquant',
    build: () => tweak(existing(base(), '2010'), (x) => (x.meta.docNumber = '')),
    expect: DOC_EXISTING,
  },
  {
    rule: 'R-DOC-NUMBER',
    kind: 'exception',
    title: 'avant le 1/10/1981 : 3.1.2 vaut pour toutes les installations, aucune dérogation → constat non bloquant',
    build: () => tweak(existing(base(), '1975'), (x) => (x.meta.docNumber = '')),
    expect: DOC_EXISTING,
  },

  // ---------------------------------------------------------------- R-DOC-NOT-DRAWN
  {
    rule: 'R-DOC-NOT-DRAWN',
    kind: 'compliant',
    title: 'terre déclarée présente et dessinée',
    build: () => tweak(base(), (x) => (x.meta.survey = { earth: 'present' })),
    expect: 'silent',
  },
  {
    rule: 'R-DOC-NOT-DRAWN',
    kind: 'notApplicable',
    title: 'existant, terre non dessinée sans déclaration : pas un schéma incomplet (R-EARTH-MISSING s’en charge)',
    build: () => p(withoutEarth(existing(base(), '2010'))),
    expect: 'silent',
  },
  {
    rule: 'R-DOC-NOT-DRAWN',
    kind: 'nonCompliant',
    title: 'neuf, terre déclarée présente mais non dessinée : dossier incomplet bloquant',
    build: () => tweak(withoutEarth(base()), (x) => (x.meta.survey = { earth: 'present' })),
    expect: { ...DOC_NEW, params: { fact: 'earth' } },
  },
  {
    rule: 'R-DOC-NOT-DRAWN',
    kind: 'missingData',
    title: 'existant, différentiel déclaré présent mais non dessiné : schéma incomplet non bloquant',
    build: () => tweak(withUnprotectedBoard(existing(base(), '2010')), (x) => (x.meta.survey = { rcd: 'present' })),
    expect: { ...DOC_EXISTING, params: { fact: 'rcd' } },
  },
  {
    rule: 'R-DOC-NOT-DRAWN',
    kind: 'missingData',
    title: 'existant, 30 mA déclaré présent pour un local humide sans 30 mA dessiné : schéma incomplet',
    build: () => {
      // Circuit sous le différentiel général de 300 mA, à côté du 30 mA
      const b = existing(base(), '2010');
      b.board.children.push(circuit('mcb', 16, 2.5, [node('socket')], 'Salle de bain', { wetRoom: 'yes' }));
      b.p.meta.survey = { rcd30: 'present' };
      return b.p;
    },
    expect: { ...DOC_EXISTING, params: { fact: 'rcd30' } },
  },
  {
    rule: 'R-DOC-NOT-DRAWN',
    kind: 'exception',
    title: 'ancien RGIE (1990) : 8.2.2 point 7 tolère l’absence du type, pas de l’équipement → constat non bloquant',
    build: () => tweak(withUnprotectedBoard(existing(base(), '1990')), (x) => (x.meta.survey = { rcd: 'present' })),
    expect: { ...DOC_EXISTING, params: { fact: 'rcd' } },
  },
  {
    rule: 'R-DOC-NOT-DRAWN',
    kind: 'exception',
    title: 'avant le 1/10/1981 : le schéma simplifié garde les différentiels (8.2.1 point 7) → constat non bloquant',
    build: () => tweak(withUnprotectedBoard(existing(base(), '1975')), (x) => (x.meta.survey = { rcd: 'present' })),
    expect: { ...DOC_EXISTING, params: { fact: 'rcd' } },
  },

  // ---------------------------------------------------------------- R-CIRCUIT-NAME
  {
    rule: 'R-CIRCUIT-NAME',
    kind: 'compliant',
    title: 'tous les circuits nommés',
    build: () => p(base()),
    expect: 'silent',
  },
  {
    rule: 'R-CIRCUIT-NAME',
    kind: 'nonCompliant',
    title: 'circuit au nom vide : recommandation non bloquante (bonne pratique)',
    build: () => p(project(circuit('mcb', 16, 2.5, [node('socket')], ''))),
    expect: { status: 'recommendation', blocking: false },
  },
  {
    rule: 'R-CIRCUIT-NAME',
    kind: 'missingData',
    title: 'nom non renseigné : recommandation non bloquante',
    build: () => {
      const b = project(circuit('mcb', 16, 2.5, [node('socket')], ''));
      delete b.sub.children.at(-1)!.props.circuitName;
      return b.p;
    },
    expect: { status: 'recommendation', blocking: false },
  },
  {
    rule: 'R-CIRCUIT-NAME',
    kind: 'nonCompliant',
    title: 'installation existante, circuit sans nom : recommandation, jamais bloquante',
    build: () => p(existing(project(circuit('mcb', 16, 2.5, [node('socket')], '')), '1995')),
    expect: { status: 'recommendation', blocking: false },
  },
  {
    rule: 'R-CIRCUIT-NAME',
    kind: 'boundary',
    title: 'nom fait d’espaces : traité comme absent',
    build: () => p(project(circuit('mcb', 16, 2.5, [node('socket')], '   '))),
    expect: { status: 'recommendation', blocking: false },
    knownIssue: 'pas de trim() : un nom fait d’espaces est accepté (audit g1, R-CIRCUIT-NAME 8 et verdict)',
  },

  // ---------------------------------------------------------------- R-MEAS-MISSING
  {
    rule: 'R-MEAS-MISSING',
    kind: 'compliant',
    title: 'résistance de terre et isolement encodés',
    build: () => p(base()),
    expect: 'silent',
  },
  {
    rule: 'R-MEAS-MISSING',
    kind: 'missingData',
    title: 'neuf, résistance de terre non encodée : vérification, non bloquante (6.4.5.2)',
    build: () => tweak(base(), (x) => delete x.measurements.earthResistanceOhm),
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-MEAS-MISSING',
    kind: 'missingData',
    title: 'neuf, isolement seul non encodé : vérification, non bloquante (6.4.5.1)',
    build: () => tweak(base(), (x) => delete x.measurements.insulationMOhm),
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-MEAS-MISSING',
    kind: 'missingData',
    title: 'existant, aucune mesure : vérification, non bloquante',
    build: () => tweak(existing(base(), '1995'), (x) => (x.measurements = {})),
    expect: { status: 'manualCheck', blocking: false },
  },
  {
    rule: 'R-MEAS-MISSING',
    kind: 'boundary',
    title: 'valeurs 0 encodées (définies) : pas de rappel de mesure',
    build: () =>
      tweak(base(), (x) => {
        x.measurements.earthResistanceOhm = 0;
        x.measurements.insulationMOhm = 0;
      }),
    expect: 'silent',
  },
  {
    rule: 'R-MEAS-MISSING',
    kind: 'exception',
    title: 'installation entièrement à très basse tension : isolement facultatif (6.4.5.1)',
    build: () => tweak(base(), (x) => delete x.measurements.insulationMOhm),
    expect: 'silent',
    notModelled: 'le modèle ne dit pas qu’une installation est entièrement à très basse tension, ni qu’elle est de mesure et de contrôle (exceptions de 6.4.5.1)',
  },
];
