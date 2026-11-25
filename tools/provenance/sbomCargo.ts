/**
 * SBOM CycloneDX 1.5 de l'application de bureau (dépendances Rust et Tauri), d'après `cargo metadata` : aucune
 * dépendance à installer (cargo-cyclonedx n'est pas nécessaire). La version web a la sienne (`npm sbom`).
 */
export interface CargoMetadata {
  packages: { id: string; name: string; version: string; license?: string | null; source?: string | null; repository?: string | null }[];
  resolve?: { root?: string | null; nodes: { id: string }[] } | null;
  workspace_members?: string[];
}

export function cargoSbom(meta: CargoMetadata, opts: { serial: string; timestamp: string; projectId: string }) {
  const used = new Set((meta.resolve?.nodes ?? meta.packages).map((n) => n.id));
  const members = new Set(meta.workspace_members ?? []);
  const root = meta.packages.find((p) => p.id === (meta.resolve?.root ?? meta.workspace_members?.[0]));
  const purl = (p: { name: string; version: string }) => `pkg:cargo/${p.name}@${p.version}`;
  const lic = (l?: string | null) => (l ? [{ expression: l.replace(/\//g, ' OR ') }] : undefined);
  return {
    $schema: 'http://cyclonedx.org/schema/bom-1.5.schema.json',
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: opts.serial,
    version: 1,
    metadata: {
      timestamp: opts.timestamp,
      tools: [{ name: 'oss-provenance sbomCargo', version: '1.0.0' }],
      component: root
        ? { type: 'application', 'bom-ref': purl(root), name: root.name, version: root.version, purl: purl(root), licenses: lic(root.license), properties: [{ name: 'osp:project-id', value: opts.projectId }] }
        : undefined,
    },
    components: meta.packages
      .filter((p) => used.has(p.id) && !members.has(p.id))
      .sort((a, b) => (a.name === b.name ? (a.version < b.version ? -1 : 1) : a.name < b.name ? -1 : 1))
      .map((p) => ({
        type: 'library',
        'bom-ref': purl(p),
        name: p.name,
        version: p.version,
        purl: purl(p),
        licenses: lic(p.license),
        ...(p.repository ? { externalReferences: [{ type: 'vcs', url: p.repository }] } : {}),
      })),
  };
}
