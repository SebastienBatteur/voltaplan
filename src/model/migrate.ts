/**
 * Lecture sûre d'un projet venant de l'extérieur (fichier, stockage du navigateur, GitHub, Drive…) :
 *  1. validation de la structure à l'exécution (zod), sans perdre les champs inconnus ;
 *  2. migration pas à pas des anciennes versions du format vers la version courante ;
 *  3. compléments sans risque (listes absentes) et contrôle d'intégrité, dont le résultat est signalé.
 *
 * Rien n'est effacé en silence : une référence orpheline est signalée (validateProject) mais conservée tant que
 * l'utilisateur ne modifie pas l'élément concerné ; un fichier d'une version plus récente est refusé avec un
 * message explicite plutôt qu'ouvert partiellement.
 */
import { parseEvidence } from '../assist/evidence';
import { z } from 'zod';
import { FILE_FORMAT, LEGACY_FORMATS } from '../brand';
import { validateProject, type Issue } from './integrity';
import type { Project } from './types';

/** Version courante du format de fichier (champ `version`). */
export const CURRENT_VERSION = 1;

/** Erreur de lecture d'un projet, traduisible (clé `file.error.<code>`). */
export class ProjectFileError extends Error {
  constructor(
    public code: 'notJson' | 'unknownFormat' | 'newerVersion' | 'invalidStructure',
    public params: Record<string, string | number> = {},
  ) {
    super(
      {
        notJson: "Ce fichier n'est pas un projet lisible (JSON invalide ou tronqué).",
        unknownFormat: 'Format de fichier inconnu.',
        newerVersion: `Ce projet a été enregistré par une version plus récente de l'application (format ${params.version}).`,
        invalidStructure: `Projet invalide : ${params.detail ?? ''}`,
      }[code],
    );
    this.name = 'ProjectFileError';
  }
}

export interface MigrationWarning {
  key: string;
  params?: Record<string, string | number>;
}

const pt = z.looseObject({ x: z.number(), y: z.number() });

interface RawNode {
  id: string;
  kind: string;
  props: Record<string, unknown>;
  children: RawNode[];
}
const node: z.ZodType<RawNode> = z.lazy(() =>
  z.looseObject({
    id: z.string().min(1),
    kind: z.string().min(1),
    props: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()])).default({}),
    children: z.array(node).default([]),
  }),
) as z.ZodType<RawNode>;

const page = z.looseObject({
  id: z.string(),
  name: z.string().default(''),
  walls: z.array(z.looseObject({ a: pt, b: pt, thickness: z.number() })).default([]),
  openings: z.array(z.looseObject({ kind: z.string(), a: pt, b: pt })).default([]),
  rects: z.array(z.looseObject({})).default([]),
  images: z.array(z.looseObject({ href: z.string() })).default([]),
  symbols: z.array(z.looseObject({ nodeId: z.string(), pos: pt, rotation: z.number().default(0) })).default([]),
  labels: z.array(z.looseObject({ id: z.string(), text: z.string(), pos: pt })).default([]),
});

const projectSchema = z.looseObject({
  format: z.string(),
  version: z.number().int().positive().default(1),
  meta: z.looseObject({
    title: z.string().default(''),
    client: z.looseObject({ address: z.looseObject({}).default({}) }).default({ address: {} }),
    site: z.looseObject({}).default({}),
    installer: z.looseObject({ address: z.looseObject({}).default({}) }).default({ address: {} }),
    date: z.string().default(''),
    supply: z.string().default(''),
    earthing: z.enum(['TT', 'TN', 'IT']).default('TT'),
    installationKind: z.enum(['new', 'existing']).default('new'),
    rgieVersion: z.enum(['new', 'old']).default('new'),
  }),
  roots: z.array(node),
  loose: z.array(node).default([]),
  plan: z
    .looseObject({ pages: z.array(page).default([]), width: z.number().default(20000), height: z.number().default(15000) })
    .default({ pages: [], width: 20000, height: 15000 }),
  measurements: z.looseObject({}).default({}),
  boards: z.record(z.string(), z.looseObject({ slots: z.record(z.string(), z.looseObject({ row: z.number(), col: z.number() })).default({}) })).optional(),
});

/**
 * Étapes de migration : MIGRATIONS[n] transforme un projet de la version n en version n + 1.
 * Ajouter une étape à chaque changement incompatible du format, avec un test dans test/migrate.test.ts.
 */
const MIGRATIONS: Record<number, (p: Record<string, unknown>) => Record<string, unknown>> = {};

/** Valide, migre et contrôle un projet lu de l'extérieur. */
export function migrateProject(data: unknown): { project: Project; warnings: MigrationWarning[]; issues: Issue[] } {
  if (!data || typeof data !== 'object') throw new ProjectFileError('invalidStructure', { detail: 'object' });
  const raw = data as Record<string, unknown>;
  const format = String(raw.format ?? '');
  if (format !== FILE_FORMAT && !LEGACY_FORMATS.includes(format)) throw new ProjectFileError('unknownFormat');
  const warnings: MigrationWarning[] = [];
  let version = typeof raw.version === 'number' ? raw.version : 1;
  if (version > CURRENT_VERSION) throw new ProjectFileError('newerVersion', { version });
  let cur: Record<string, unknown> = raw;
  while (version < CURRENT_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new ProjectFileError('invalidStructure', { detail: 'migration ' + version });
    cur = step(cur);
    version++;
    warnings.push({ key: 'file.migrated', params: { version } });
  }
  const parsed = projectSchema.safeParse(cur);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ProjectFileError('invalidStructure', { detail: `${first.path.join('.')} : ${first.message}` });
  }
  // Anciens formats (OpenRGIE) : réenregistrés sous le format courant
  const project = { ...parsed.data, format: FILE_FORMAT, version: CURRENT_VERSION } as unknown as Project;
  // Dossier de preuves de l'assistant illisible : jamais supprimé (il est gardé tel quel sous evidenceRaw et
  // réenregistré), mais pas utilisé ; le projet s'ouvre normalement.
  if (project.evidence !== undefined && !parseEvidence(project.evidence)) {
    const p = project as Project & { evidenceRaw?: unknown };
    p.evidenceRaw = p.evidence;
    delete p.evidence;
    warnings.push({ key: 'file.evidenceUnreadable' });
  }
  if (LEGACY_FORMATS.includes(format)) warnings.push({ key: 'file.legacyFormat', params: { format } });
  const issues = validateProject(project);
  const errors = issues.filter((i) => i.level === 'error').length;
  if (errors) warnings.push({ key: 'file.integrityIssues', params: { n: errors } });
  return { project, warnings, issues };
}

/** Lecture d'un texte JSON de projet. */
export function parseProjectText(text: string): ReturnType<typeof migrateProject> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ProjectFileError('notJson');
  }
  return migrateProject(data);
}
