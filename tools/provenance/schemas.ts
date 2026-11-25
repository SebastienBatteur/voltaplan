/**
 * Schémas « oss-provenance » 1.0 : génériques (aucun champ propre à Voltaplan), versionnés, publiés en JSON Schema
 * (schemas/oss-provenance/*.schema.json, générés depuis ces définitions : `npm run provenance:schemas`).
 *
 *  - build-info : une compilation (projet permanent, projet d'origine, dépôt, commit, licence, code source
 *    correspondant, artefacts liés) ;
 *  - well-known : découverte depuis la racine d'un site (/.well-known/oss-provenance.json) ;
 *  - fingerprints : intégrité (SHA-256) et similarité (indices) d'une compilation ou d'un commit.
 * Ce qu'un standard existant couvre déjà n'est pas redéfini : identité du projet (CodeMeta, codemeta.json), liste
 * des composants (SBOM CycloneDX), provenance vérifiable (attestations in-toto / SLSA de GitHub).
 */
import { z } from 'zod';

const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const commit = z.string().regex(/^[0-9a-f]{40}$/);
const url = z.string().url();
const projectId = z.string().regex(/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/).describe('Permanent project identifier (urn:uuid), independent of name, repository and domain');
const spdx = z.string().regex(/^[A-Za-z0-9.+-]+( (AND|OR|WITH) [A-Za-z0-9.+-]+)*$/).describe('SPDX license expression');
const artifactRef = z.object({ path: z.string().describe('Path relative to this file'), sha256 }).strict();

export const buildInfoSchema = z
  .object({
    $schema: url,
    schemaVersion: z.literal('1.0'),
    project: z
      .object({ id: projectId, aliases: z.array(z.string()), name: z.string(), homepage: url.nullable(), metadata: z.string().describe('CodeMeta file, relative to the repository root') })
      .strict(),
    upstream: z.object({ id: projectId, repository: url }).strict().describe('Original project this build descends from (kept by forks that keep their lineage)'),
    repository: z.object({ url: url.nullable(), commit: commit.nullable(), commitDate: z.string().nullable(), dirty: z.boolean().nullable() }).strict(),
    build: z
      .object({
        id: z.string().regex(/^sha256:[0-9a-f]{64}$/).nullable().describe('Content-addressed build identifier (hash of the integrity list)'),
        version: z.string(),
        timestamp: z.string(),
        environment: z.enum(['ci', 'local']),
        ci: z.object({ provider: z.string(), workflow: z.string().nullable(), runId: z.string().nullable(), runAttempt: z.string().nullable(), runUrl: url.nullable() }).strict().nullable(),
        status: z.enum(['clean', 'modified', 'declared', 'unknown']),
        derived: z.boolean(),
      })
      .strict(),
    license: z.object({ spdx, url, copyright: z.string() }).strict(),
    source: z.object({ correspondingSource: url.nullable(), archive: url.nullable(), declared: z.boolean() }).strict(),
    artifacts: z.record(z.string(), artifactRef),
    verification: z.object({ authenticated: z.literal(false), note: z.string(), attestations: url.nullable() }).strict(),
  })
  .strict();

export const wellKnownSchema = z
  .object({
    $schema: url,
    schemaVersion: z.literal('1.0'),
    projects: z.array(
      z
        .object({
          id: projectId,
          name: z.string(),
          license: spdx,
          upstreamRepository: url,
          metadata: url.describe('CodeMeta file of the project'),
          instances: z.array(z.object({ url: z.string().describe('Instance URL, relative to the site root'), buildInfo: z.string(), buildInfoSha256: sha256 }).strict()),
        })
        .strict(),
    ),
  })
  .strict();

const printSchema = z
  .object({
    name: z.string(),
    description: z.string(),
    paths: z.array(z.string()),
    strings: z.array(z.string().regex(/^[0-9a-f]{16}$/)),
    tokens: z.array(z.string().regex(/^[0-9a-f]{16}$/)),
    counts: z.object({ strings: z.number().int(), shingles: z.number().int() }).strict(),
  })
  .strict();

export const fingerprintsSchema = z
  .object({
    $schema: url,
    schemaVersion: z.literal('1.0'),
    project: z.object({ id: projectId, name: z.string() }).strict(),
    subject: z.object({ version: z.string(), commit: commit.nullable(), kind: z.enum(['build', 'source']) }).strict(),
    integrity: z
      .object({
        algorithm: z.literal('sha256'),
        note: z.string(),
        files: z.array(z.object({ path: z.string(), sha256, size: z.number().int() }).strict()),
      })
      .strict()
      .nullable(),
    sources: z.object({ algorithm: z.literal('sha256'), files: z.array(z.object({ path: z.string(), sha256 }).strict()) }).strict(),
    similarity: z
      .object({
        algorithm: z.string().describe('Identifier of the normalisation and hashing algorithm'),
        shingle: z.number().int(),
        sketch: z.number().int(),
        background: z.string().describe('How generic code was excluded'),
        disclaimer: z.string(),
        components: z.array(printSchema),
      })
      .strict(),
  })
  .strict();

export type BuildInfoDoc = z.infer<typeof buildInfoSchema>;
export type FingerprintsDoc = z.infer<typeof fingerprintsSchema>;
export type WellKnownDoc = z.infer<typeof wellKnownSchema>;

export const SCHEMAS = { 'build-info-1.0': buildInfoSchema, 'well-known-1.0': wellKnownSchema, 'fingerprints-1.0': fingerprintsSchema } as const;

/** JSON Schema (draft 2020-12) publié pour les scanners. */
export function jsonSchemaOf(name: keyof typeof SCHEMAS): Record<string, unknown> {
  const s = z.toJSONSchema(SCHEMAS[name], { target: 'draft-2020-12' }) as Record<string, unknown>;
  return { ...s, $id: `https://voltaplan.org/schemas/oss-provenance/${name}.schema.json`, title: `oss-provenance ${name}` };
}
