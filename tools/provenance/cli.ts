/**
 * Outils de provenance, en local comme en CI (aucun service extérieur requis, sauf la vérification d'accès au
 * code source en mode release) :
 *
 *   npm run provenance -- verify [dist] [--release] [--commit <sha>] [--version <v>]
 *   npm run provenance -- well-known <site> <instance>...     écrit <site>/.well-known/oss-provenance.json
 *   npm run provenance -- verify-site <site>
 *   npm run provenance -- schemas                              (re)génère schemas/oss-provenance/*.schema.json
 *   npm run provenance -- history <commit>... [--out <dossier>]  empreintes de commits existants
 *   npm run provenance -- sbom-cargo <cargo-metadata.json> <sortie>
 *   npm run provenance -- sums <dossier> <sortie>             SHA256SUMS (format sha256sum)
 *   npm run provenance -- eval                                 robustesse et faux positifs (tableau Markdown)
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import { sha256hex } from './fingerprints';
import { dependencyBackground, historicFingerprints } from './history';
import { identityOf, readCodeMeta } from './identity';
import { evaluate, markdownTable } from './robustness';
import { cargoSbom, type CargoMetadata } from './sbomCargo';
import { jsonSchemaOf, SCHEMAS } from './schemas';
import { verifyDist, verifyRelease, verifySite, wellKnown } from './verify';

const root = process.cwd();
const [cmd, ...rest] = process.argv.slice(2);
const flag = (n: string) => {
  const i = rest.indexOf(n);
  return i >= 0 ? (rest[i + 1] ?? '') : undefined;
};
const positional = rest.filter((a, i) => !a.startsWith('--') && !rest[i - 1]?.startsWith('--'));
const fail = (errors: string[]) => {
  for (const e of errors) console.error('✗ ' + e);
  process.exit(errors.length ? 1 : 0);
};
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

async function main() {
  switch (cmd) {
    case 'verify': {
      const dir = positional[0] ?? 'dist';
      const { errors, info } = verifyDist(dir);
      const expectedCommit = flag('--commit');
      if (info && expectedCommit && info.repository.commit !== expectedCommit) errors.push(`commit ${info.repository.commit} ≠ commit attendu ${expectedCommit}`);
      if (info && rest.includes('--release')) {
        // Trois essais espacés : une archive demandée AVANT l'envoi du commit reste quelques minutes en 404 (cache
        // de GitHub, constaté le 2026-11-25) ; en CI, le tag est toujours poussé avant.
        const checkUrl = async (u: string) => {
          for (let i = 0; i < 3; i++) {
            try {
              if ((await fetch(u, { method: 'HEAD', redirect: 'follow' })).ok) return true;
            } catch {
              /* réseau : nouvel essai */
            }
            await new Promise((r) => setTimeout(r, 5000));
          }
          return false;
        };
        errors.push(...(await verifyRelease(info, { commit: flag('--commit'), version: flag('--version'), checkUrl })));
      }
      if (!errors.length) console.log(`✓ ${dir} : ${info?.project.name} ${info?.build.version} (${info?.repository.commit ?? 'commit inconnu'}, ${info?.build.status}), ${info?.build.id}`);
      return fail(errors);
    }
    case 'well-known': {
      const [site, ...instances] = positional;
      const doc = wellKnown(site, instances.length ? instances : ['app']);
      mkdirSync(join(site, '.well-known'), { recursive: true });
      writeFileSync(join(site, '.well-known', 'oss-provenance.json'), JSON.stringify(doc, null, 2) + '\n');
      console.log(`✓ ${site}/.well-known/oss-provenance.json (${doc.projects.length} projet)`);
      return;
    }
    case 'verify-site': {
      const errors = verifySite(positional[0] ?? '_site');
      if (!errors.length) console.log('✓ manifeste .well-known cohérent avec les versions servies');
      return fail(errors);
    }
    case 'schemas': {
      mkdirSync('schemas/oss-provenance', { recursive: true });
      for (const n of Object.keys(SCHEMAS) as (keyof typeof SCHEMAS)[]) writeFileSync(`schemas/oss-provenance/${n}.schema.json`, JSON.stringify(jsonSchemaOf(n), null, 2) + '\n');
      console.log('✓ schemas/oss-provenance');
      return;
    }
    case 'history': {
      const out = flag('--out') ?? 'provenance-history';
      mkdirSync(out, { recursive: true });
      const bg = dependencyBackground(root);
      const id = identityOf(readCodeMeta(root)).projectId;
      for (const ref of positional) {
        const doc = historicFingerprints(root, ref, bg, id);
        const f = join(out, `fingerprints-${doc.subject.commit!.slice(0, 12)}.json`);
        writeFileSync(f, JSON.stringify(doc, null, 1) + '\n');
        console.log(`✓ ${f} (${doc.subject.version}, ${doc.sources.files.length} sources)`);
      }
      return;
    }
    case 'sbom-cargo': {
      const [input, output] = positional;
      const meta = JSON.parse(readFileSync(input, 'utf8')) as CargoMetadata;
      const doc = cargoSbom(meta, { serial: 'urn:uuid:' + randomUUID(), timestamp: new Date().toISOString(), projectId: identityOf(readCodeMeta(root)).projectId });
      writeFileSync(output, JSON.stringify(doc, null, 2) + '\n');
      console.log(`✓ ${output} (${doc.components.length} composants)`);
      return;
    }
    case 'sums': {
      const [dir, output] = positional;
      const lines = walk(dir)
        .map((f) => `${sha256hex(readFileSync(f))}  ${relative(dir, f).replace(/\\/g, '/')}`)
        .sort((a, b) => (a.slice(66) < b.slice(66) ? -1 : 1));
      writeFileSync(output, lines.join('\n') + '\n');
      console.log(`✓ ${output} (${lines.length} fichiers)`);
      return;
    }
    case 'eval': {
      const t0 = Date.now();
      const { prints, rows } = await evaluate(root);
      console.log(markdownTable(prints, rows));
      console.log(`\n${prints.map((p) => `${p.name}: ${p.counts.strings} chaînes, ${p.counts.shingles} séquences`).join(' ; ')} — ${Date.now() - t0} ms`);
      return;
    }
    default:
      console.error('Commandes : verify, well-known, verify-site, schemas, history, sbom-cargo, sums, eval');
      process.exit(2);
  }
}
main();
