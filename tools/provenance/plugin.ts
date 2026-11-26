/**
 * Greffon Vite « provenance » : métadonnées passives et transparentes, aucun appel réseau, rien dans l'application
 * hormis des constantes affichées par « À propos ».
 *
 *  - constante __OSP_BUILD__ (EmbeddedBuild) : version, commit, dépôt, code source correspondant, licence ;
 *  - balises <meta name="osp:…">, <link rel="license"> et <link rel="describedby"> dans index.html ;
 *  - bandeau légal « /*! … *\/ » en tête de chaque fichier JavaScript (conservé par la minification) ;
 *  - THIRD-PARTY-LICENSES.txt (paquets réellement inclus) ;
 *  - après l'écriture : fingerprints.json puis build-info.json (dans cet ordre : pas de dépendance circulaire).
 * OSP_FINGERPRINTS=0 : pas d'empreintes de similarité (intégrité et métadonnées seulement).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { HtmlTagDescriptor, Plugin } from 'vite';
import { buildIdOf, fingerprintsDoc, sha256hex, type FileEntry } from './fingerprints';
import { buildInfo, embeddedBuild, identityOf, legalBanner, readCodeMeta, readGit, type EmbeddedBuild } from './identity';
import { collectThirdParty, thirdPartyText } from './licenses';
import { ocrFiles } from '../ocr/plugin';
import { background, type Background } from './similarity';

export const THIRD_PARTY_FILE = 'THIRD-PARTY-LICENSES.txt';

/** Module tiers : node_modules ou module virtuel (préfixe \0 de Rollup, aides de Vite). */
const isThirdParty = (m: string) => /[\\/]node_modules[\\/]/.test(m) || m.startsWith('\0') || m.startsWith('vite/');
const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));

/** Balises d'identification (valeurs publiques seulement, chemins relatifs : déploiement en sous-répertoire). */
export function provenanceTags(e: EmbeddedBuild): HtmlTagDescriptor[] {
  const meta = (name: string, content: string | null) => (content ? [{ tag: 'meta', attrs: { name, content }, injectTo: 'head' as const }] : []);
  return [
    ...meta('generator', `${e.name} ${e.version}`),
    ...meta('application-name', e.name),
    ...meta('osp:project-id', e.projectId),
    ...meta('osp:upstream-id', e.upstreamId !== e.projectId ? e.upstreamId : null),
    ...meta('osp:version', e.version),
    ...meta('osp:commit', e.commit),
    ...meta('osp:status', e.status),
    ...meta('osp:license', e.spdx),
    ...meta('osp:source', e.correspondingSource),
    { tag: 'link', attrs: { rel: 'license', href: e.licenseUrl }, injectTo: 'head' },
    { tag: 'link', attrs: { rel: 'describedby', type: 'application/json', href: './build-info.json' }, injectTo: 'head' },
  ];
}

export function provenance(opts: { root?: string; env?: Record<string, string | undefined>; version: string }): Plugin {
  const root = opts.root ?? process.cwd();
  const env = opts.env ?? process.env;
  const id = identityOf(readCodeMeta(root), env);
  const embedded = embeddedBuild(id, opts.version, readGit(root), env);
  let outDir = '';
  let bg: Background | null = null;
  let bgModules = 0;
  return {
    name: 'osp-provenance',
    config() {
      return {
        define: { __OSP_BUILD__: JSON.stringify(embedded) },
        build: { rollupOptions: { output: { banner: (chunk: { fileName: string; moduleIds: string[] }) =>
                chunk.fileName.endsWith('.js') ? legalBanner(embedded, chunk.moduleIds.length > 0 && chunk.moduleIds.every(isThirdParty)) : '' } } },
      };
    },
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    transformIndexHtml() {
      return provenanceTags(embedded);
    },
    generateBundle() {
      const ids = [...this.getModuleIds()].filter((m) => /[\\/]node_modules[\\/]/.test(m));
      // Fichiers du moteur OCR copiés tels quels (pas des modules) : leurs paquets sont aussi distribués
      const list = collectThirdParty([...ids, ...Object.values(ocrFiles())]);
      this.emitFile({ type: 'asset', fileName: THIRD_PARTY_FILE, source: thirdPartyText(embedded.name, list) });
      if (env.OSP_FINGERPRINTS !== '0') {
        // Corpus de fond : code des bibliothèques réellement incluses (jamais caractéristique de ce projet)
        const codes = ids.map((m) => this.getModuleInfo(m)?.code).filter((c): c is string => !!c);
        bgModules = codes.length;
        bg = background(codes);
      }
    },
    closeBundle() {
      if (!outDir || this.meta.watchMode) return;
      const t0 = Date.now();
      let dist: FileEntry[];
      try {
        dist = walk(outDir).map((f) => ({ path: relative(outDir, f).replace(/\\/g, '/'), content: readFileSync(f) }));
      } catch {
        return; // rien d'écrit (erreur de compilation)
      }
      const sources = walk(resolve(root, 'src'))
        .filter((f) => statSync(f).isFile())
        .map((f) => ({ path: relative(root, f).replace(/\\/g, '/'), content: readFileSync(f, 'utf8') }));
      const fp = fingerprintsDoc({
        build: embedded,
        kind: 'build',
        dist,
        sources,
        background: bg ?? { strings: new Set(), shingles: new Set() },
        backgroundMethod: bg ? `third-party modules bundled in this build (${bgModules} modules)` : 'disabled (OSP_FINGERPRINTS=0)',
      });
      if (!bg) fp.similarity.components = [];
      const fpText = JSON.stringify(fp, null, 1) + '\n';
      writeFileSync(join(outDir, 'fingerprints.json'), fpText);
      const tp = dist.find((f) => f.path === THIRD_PARTY_FILE);
      const info = buildInfo(embedded, id, env, {
        timestamp: new Date().toISOString(),
        buildId: buildIdOf(fp.integrity!.files),
        artifacts: {
          fingerprints: { path: 'fingerprints.json', sha256: sha256hex(fpText) },
          ...(tp ? { thirdPartyLicenses: { path: THIRD_PARTY_FILE, sha256: sha256hex(tp.content) } } : {}),
        },
      });
      writeFileSync(join(outDir, 'build-info.json'), JSON.stringify(info, null, 2) + '\n');
      this.info?.(`provenance : ${fp.integrity!.files.length} fichiers, ${info.build.id}, ${embedded.status}, ${Date.now() - t0} ms`);
    },
  };
}
