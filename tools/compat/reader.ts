/**
 * Lecteur de l'essai de compatibilité (tools/compat/previous.ts) : exécuté tel quel par la version courante ET par
 * une version précédente (copié dans un arbre de travail temporaire de celle-ci). N'utilise donc que des fonctions
 * présentes dans les deux : ouverture, enregistrement, contrôle.
 *
 *   vite-node tools/compat/reader.ts <fichier.voltaplan> <ids.json> <rapport.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { AssetStore, MemoryAssetBackend } from '../../src/format/assets';
import { AssetSession } from '../../src/format/session';
import { openProjectData, serializeProject } from '../../src/io/projectData';
import { checkProject } from '../../src/rules';
import { findNode } from '../../src/model/tree';
import type { Project } from '../../src/model/types';

const [file, idsFile, out] = process.argv.slice(2).filter((x) => x !== '--');
const ids = JSON.parse(readFileSync(idsFile, 'utf8')) as { emptyProt: string; unsetSocket: string; socketNoEarth: string; confirmedSocket: string };
const session = () => new AssetSession(() => new AssetStore(new MemoryAssetBackend()));

type Entry = { nodeId: string; prop: string; basis: string; origin?: string; by?: string };
const prov = (p: Project) => ((p as { evidence?: { provenance: Entry[] } }).evidence?.provenance ?? []) as Entry[];
const historicList = (p: Project) => ((p as { evidence?: { historic?: unknown[] } }).evidence?.historic ?? []) as unknown[];
const meta = (p: Project) => p.meta as Project['meta'] & { provenanceSince?: string };

function describe(p: Project) {
  const e = prov(p);
  const f = checkProject(p);
  const nc = f.find((x) => x.ruleId === 'R-SOCKET-EARTH' && x.nodeId === ids.socketNoEarth);
  const emptyProt = findNode(p.roots, ids.emptyProt);
  return {
    supply: p.meta.supply,
    installationKind: p.meta.installationKind,
    provenanceSince: meta(p).provenanceSince ?? null,
    historicUnknown: historicList(p).length,
    confirmedWithOrigin: e.filter((x) => x.basis === 'confirmed' && x.origin === 'historicUnknown').length,
    confirmedBy: [...new Set(e.filter((x) => x.by).map((x) => x.by))],
    emptyProtProps: emptyProt ? Object.keys(emptyProt.props).sort() : null,
    findings: {
      unconfirmed: f.filter((x) => x.ruleId === 'R-UNCONFIRMED').length,
      historic: f.filter((x) => x.ruleId === 'R-HISTORIC').length,
      potential: f.filter((x) => x.status === 'potential').length,
      blockingNonCompliant: f.filter((x) => x.blocking && x.status === 'nonCompliant').length,
      socketNoEarth: nc ? { status: nc.status, blocking: nc.blocking, knowledge: nc.knowledge ?? null } : null,
      unsetSocket: f.filter((x) => x.nodeId === ids.unsetSocket).map((x) => `${x.ruleId}:${x.status}`).sort(),
    },
  };
}

async function main() {
  const report: Record<string, unknown> = {};
  try {
    const blob = new Blob([readFileSync(file)]);
    const first = await openProjectData(blob, 'compat.voltaplan', session(), { background: false });
    report.opened = true;
    report.warnings = first.warnings.map((w) => (typeof w === 'string' ? w : w.key));
    report.read = describe(first.project);
    // Enregistré par cette version, puis rouvert : ce que la version garde du fichier
    const again = (await serializeProject(first.project, undefined, session()))!;
    const second = await openProjectData(again, 'compat.voltaplan', session(), { background: false });
    report.resaved = describe(second.project);
    writeFileSync(file + '.resaved', Buffer.from(await again.arrayBuffer()));
  } catch (e) {
    report.opened = false;
    report.error = String((e as Error)?.message ?? e);
  }
  writeFileSync(out, JSON.stringify(report, null, 2));
}
void main();
