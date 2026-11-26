import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  conduiSupply,
  importCondui,
  isConduiManifest,
} from "../src/import/condui";
import { writeZip } from "../src/format/zip";
import { openProjectData } from "../src/io/projectData";
import { ALLOWED_CHILDREN } from "../src/model/schema";
import { computeNumbering, walk } from "../src/model/tree";
import type { ElNode } from "../src/model/types";

const place = (id: string, x: number, y: number, floorId = "F0") => ({
  id,
  floorId,
  layer: "electrical",
  pos: { x, y },
  rotationDeg: 0,
  scale: 1,
});
const ep = (
  id: string,
  type: string,
  symbol: string,
  label: string,
  extra: Record<string, unknown> = {},
  placements = [place("p" + id, 50, 50)],
) => ({ id, type, symbol, label, placements, ...extra });
const cable = { kind: "XVB", conductors: 3, sectionMm2: 2.5, hasPE: true };
const mcb = (
  id: string,
  label: string,
  amps: number,
  circuit: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) => ({
  id,
  type: "MCB",
  label,
  polesConfig: "2P",
  poles: 2,
  ratingA: amps,
  curve: "C",
  breakingCapacityKa: 3,
  circuits: [{ id: "c" + id, code: label, kind: "other", cable, ...circuit }],
  ...extra,
});

/** Projet Condui fabriqué pour le test (même forme que l'export de démonstration, données inventées). */
function sample() {
  return {
    schemaVersion: "2.3.0",
    project: {
      name: "Essai",
      yearOfConstruction: 2024,
      meterEanCode: "541000000000000000",
      customer: { name: "Client fictif" },
      installerOverride: {
        name: "Électro Fictif",
        address: {
          street: "Rue 1",
          postalCode: "4000",
          city: "Liège",
          country: "BE",
        },
      },
    },
    site: {
      address: {
        street: "Rue Fictive 3",
        postalCode: "4000",
        city: "Liège",
        country: "BE",
      },
    },
    building: { floors: [{ id: "F0", name: "Rez" }] },
    disciplines: {
      electrical: {
        installation: {
          nominalVoltage: {
            system: "2~",
            uLineToNeutral: 230,
            uLineToLine: 230,
          },
          feedTopology: {
            sharedFeed: {
              trunkDevices: [
                {
                  id: "brk",
                  type: "protection",
                  protectionType: "MCB",
                  ratingA: 40,
                },
                {
                  id: "kwh",
                  type: "energy_meter",
                  symbol: "energy_meter",
                  placements: [place("pk", 10, 10)],
                },
              ],
            },
            rootFeeds: [
              {
                panelId: "P1",
                trunkDevices: [
                  {
                    id: "main",
                    type: "protection",
                    protectionType: "RCBO",
                    ratingA: 40,
                    curve: "C",
                    polesConfig: "2P",
                    sensitivityMa: 300,
                    residualCurrentType: "A",
                  },
                ],
              },
            ],
          },
          earthingPlacements: [
            { id: "ea", floorId: "F0", pos: { x: 20, y: 20 } },
          ],
        },
        panels: [
          {
            id: "P1",
            name: "Hoofdbord",
            isMain: true,
            circuits: [
              {
                id: "panel",
                code: "PANEL",
                endpoints: [
                  ep(
                    "bd",
                    "fixed_appliance",
                    "panel_distribution",
                    "Hoofdbord",
                    {},
                    [place("pb", 30, 30)],
                  ),
                ],
              },
            ],
            protections: [
              mcb("a", "A", 32, {
                notes: "Kookvuur",
                endpoints: [
                  ep("a1", "fixed_appliance", "stove", "A1"),
                  ep("a2", "fixed_appliance", "furnace", "A2", {
                    hvacProps: {
                      energySource: "electricity",
                      hvacType: "heat_exchange",
                    },
                  }),
                ],
                trunkDevices: [
                  {
                    id: "jb",
                    type: "junction_box",
                    symbol: "junction_box",
                    trunkPosition: 1,
                  },
                ],
              }),
              {
                id: "rcd",
                type: "RCD",
                label: "",
                polesConfig: "2P",
                sensitivityMa: 30,
                residualCurrentType: "A",
                labelNotes: "Diff",
                circuits: [
                  {
                    id: "crcd",
                    code: "",
                    cable,
                    endpoints: [],
                    subCircuitIds: ["cd", "ce", "cj"],
                  },
                ],
              },
              mcb("d", "D", 16, {
                notes: "Licht",
                branches: [
                  { id: "b1", label: "D1", endpointIds: ["s1", "s2", "l1"] },
                  { id: "b2", label: "D2", endpointIds: ["s3", "t1", "l2"] },
                ],
                endpoints: [
                  ep("s1", "switch", "switch_1p_twoway", "D1"),
                  ep("s2", "switch", "switch_1p_twoway", "D1"),
                  ep("l1", "light_point", "light_point", "D1", {}, [
                    place("pl1", 60, 60),
                    place("pl2", 70, 70),
                  ]),
                  ep("s3", "switch", "switch", "D2"),
                  ep("t1", "fixed_appliance", "transformer", "D2"),
                  ep("l2", "light_point", "light_led", "D2"),
                ],
              }),
              mcb("e", "E", 20, {
                branches: [
                  { id: "b3", label: "E1", endpointIds: ["o1", "w1"] },
                ],
                endpoints: [
                  ep("o1", "socket", "socket_gnd_child", "E1", {
                    socketProps: { socketCount: 2 },
                  }),
                  ep("w1", "fixed_appliance", "washer", "E1"),
                ],
              }),
              mcb(
                "j",
                "J",
                20,
                { notes: "Tuinhuis", endpoints: [] },
                { subPanelId: "SP" },
              ),
              mcb("x", "X", 16, {
                endpoints: [ep("xx", "fixed_appliance", "mystery_thing", "X1")],
              }),
            ],
            subPanels: [
              {
                id: "SP",
                name: "Tuinhuis",
                protections: [
                  mcb("sa", "A", 20, {
                    endpoints: [
                      ep("sa1", "socket", "socket_gnd_child", "A1", {
                        socketProps: { waterproof: true },
                      }),
                    ],
                  }),
                ],
                subPanels: [],
              },
            ],
          },
        ],
      },
    },
    elements: [
      {
        id: "w1",
        kind: "building.wall",
        floorId: "F0",
        geometry: {
          kind: "polyline",
          points: [
            { x: 0, y: 0 },
            { x: 400, y: 0 },
            { x: 400, y: 300 },
            { x: 0, y: 300 },
            { x: 0, y: 0 },
          ],
        },
        properties: { v1: { id: "W1" }, masterWallThickness: 20 },
      },
      {
        id: "w2",
        kind: "building.wall",
        floorId: "F0",
        geometry: {
          kind: "polyline",
          points: [
            { x: 200, y: 0 },
            { x: 200, y: 300 },
          ],
        },
        properties: { v1: { id: "W2" }, masterWallThickness: 10 },
      },
      {
        id: "d1",
        kind: "building.door",
        floorId: "F0",
        geometry: {},
        properties: {
          v1: {
            wallId: "W1",
            segmentIndex: 0,
            centerAlongSegment: 100,
            width: 90,
            swing: "right",
            direction: "out",
          },
        },
      },
      {
        id: "d2",
        kind: "building.door",
        floorId: "F0",
        geometry: {},
        properties: {
          v1: {
            wallId: "W2",
            segmentIndex: 0,
            centerAlongSegment: 150,
            width: 80,
            swing: "left",
            direction: "out",
          },
        },
      },
      {
        id: "g",
        kind: "building.door",
        floorId: "F0",
        geometry: {},
        properties: {
          v1: {
            wallId: "W1",
            segmentIndex: 2,
            centerAlongSegment: 200,
            width: 250,
            swing: "none",
            direction: "out",
          },
        },
      },
      {
        id: "wi",
        kind: "building.window",
        floorId: "F0",
        geometry: {},
        properties: {
          v1: {
            wallId: "W1",
            segmentIndex: 1,
            centerAlongSegment: 150,
            width: 120,
          },
        },
      },
      {
        id: "st",
        kind: "building.stair",
        floorId: "F0",
        geometry: {},
        properties: {
          v1: {
            points: [
              { x: 250, y: 250 },
              { x: 250, y: 100 },
              { x: 350, y: 100 },
            ],
            width: 80,
          },
        },
      },
      {
        id: "car",
        kind: "building.graphic.car",
        floorId: "F0",
        geometry: {
          kind: "rect",
          position: { x: 300, y: 200 },
          width: 470,
          height: 208,
          rotationDeg: -90,
        },
        properties: { v1: {} },
      },
      {
        id: "n",
        kind: "annotation.note",
        floorId: "F0",
        geometry: { kind: "point", position: { x: 100, y: 150 } },
        properties: { v1: { text: "Note" } },
      },
    ],
    assets: [],
  };
}

const all = (ns: ElNode[]) => [...walk(ns)].map((x) => x.node);
const find = (ns: ElNode[], tag: string) =>
  all(ns).find((n) => n.source?.tag === tag)!;

describe("import Condui", () => {
  it("reconnaît le manifeste et le réseau", () => {
    expect(
      isConduiManifest(
        '{"version":"1","projectId":"x","format":"project-with-assets"}',
      ),
    ).toBe(true);
    expect(isConduiManifest('{"format":"voltaplan"}')).toBe(false);
    expect(conduiSupply({ system: "2~", uLineToLine: 230 })).toBe(
      "2 x 230V ~ 50Hz",
    );
    expect(conduiSupply({ system: "3N~", uLineToLine: 400 })).toBe(
      "3N x 400V ~ 50Hz",
    );
    expect(() => importCondui("{}")).toThrow();
  });

  it("schéma : général, différentiel de groupe, circuits, sous-tableau, commandes en chaîne", () => {
    const { project, warnings } = importCondui(JSON.stringify(sample()));
    const m = project.meta;
    expect(m.title).toBe("Essai");
    expect(m.mainCurrent).toBe(40);
    expect(m.installationDate).toBe("2024");
    expect(m.site.city).toBe("Liège");
    const meter = project.roots[0].children[0];
    expect(meter.kind).toBe("meter");
    const main = meter.children[0];
    expect(main.props).toMatchObject({ device: "rcbo", residualCurrent: 300 });
    const board = main.children[0];
    expect(board.props.name).toBe("Hoofdbord");
    // A, différentiel (D, E, J), X, puis la terre
    expect(
      board.children.map(
        (n) => n.props.fixedLetter ?? n.props.device ?? n.kind,
      ),
    ).toEqual(["A", "rcd", "X", "earthBar"]);
    const rcd = board.children[1];
    expect(rcd.props.ratedCurrent).toBeUndefined();
    expect(rcd.props.curve).toBeUndefined();
    expect(rcd.children.map((n) => n.props.fixedLetter)).toEqual([
      "D",
      "E",
      "J",
    ]);
    // A : appareil en ligne (boîte de dérivation) après le premier point
    expect(rcd.children.length).toBe(3);
    expect(board.children[0].children[0].children.map((n) => n.kind)).toEqual([
      "appliance",
      "junctionBox",
      "appliance",
    ]);
    expect(find(project.roots, "furnace").props.applianceType).toBe("heatPump");
    // D1 : va-et-vient → va-et-vient → luminaire (posé deux fois : quantité 2) ; D2 : interrupteur → transformateur → LED
    const s1 = find(project.roots, "switch_1p_twoway");
    expect(s1.children[0].props.switchType).toBe("twoWay");
    expect(s1.children[0].children[0].props).toMatchObject({
      lightType: "standard",
      count: 2,
    });
    const s3 = all(project.roots).find((n) => n.source?.tag === "switch")!;
    expect(s3.children[0].kind).toBe("transformer");
    expect(s3.children[0].children[0].props.lightType).toBe("led");
    // E1 : prise double avec le lave-linge
    const o1 = find(project.roots, "socket_gnd_child");
    expect(o1.props.count).toBe(2);
    expect(o1.children[0].props.applianceType).toBe("washingMachine");
    // Sous-tableau sous le câble de J, repères « J-A »
    const sub = all(project.roots).find(
      (n) => n.kind === "board" && n.props.name === "Tuinhuis",
    )!;
    expect(sub.props.fixedLetter).toBe("J");
    expect(sub.children[0].props.fixedLetter).toBe("J-A");
    expect(sub.children[0].children[0].children[0].props.splashProof).toBe(
      true,
    );
    const num = computeNumbering(project.roots);
    expect(num.get(s3.id)).toBe("D2");
    expect(num.get(sub.children[0].children[0].children[0].id)).toBe("J-A1");
    // Symbole inconnu : « autre » avec avertissement
    expect(find(project.roots, "mystery_thing").kind).toBe("other");
    expect(warnings.some((w) => w.includes("mystery_thing"))).toBe(true);
    // Toujours des enfants permis par le modèle
    for (const { node, parent } of walk(project.roots))
      if (parent)
        expect(
          ALLOWED_CHILDREN[parent.kind],
          `${node.kind} sous ${parent.kind}`,
        ).toContain(node.kind);
  });

  it("plan : murs, ouvertures et sens des portes, escalier, meubles, notes, symboles", () => {
    const { project } = importCondui(JSON.stringify(sample()));
    const pg = project.plan.pages[0];
    expect(pg.name).toBe("Rez");
    expect(pg.walls).toHaveLength(5);
    // cm → mm, origine décalée de 1000 mm
    expect(pg.walls[0]).toMatchObject({
      a: { x: 1000, y: 1000 },
      b: { x: 5000, y: 1000 },
      thickness: 200,
    });
    const doors = pg.openings.filter((o) => o.kind === "door");
    // Mur fermé : la porte « out » s'ouvre vers l'extérieur de la pièce (au-dessus du mur du haut : côté -y local)
    expect(doors[0]).toMatchObject({
      a: { x: 1550, y: 1000 },
      b: { x: 2450, y: 1000 },
      hinge: "left",
      mirrored: true,
    });
    // Cloison seule : à droite du sens de tracé (côté +y local)
    expect(doors[1]).toMatchObject({ hinge: "right", mirrored: false });
    expect(pg.openings.find((o) => o.kind === "garageDoor")).toBeTruthy();
    expect(pg.openings.find((o) => o.kind === "window")).toBeTruthy();
    expect(pg.furniture!.filter((f) => f.kind === "stairs")).toHaveLength(2);
    expect(pg.furniture!.find((f) => f.kind === "car")).toMatchObject({
      w: 4700,
      h: 2080,
      angle: -90,
    });
    expect(pg.labels.map((l) => l.text)).toEqual(["Note"]);
    // Symboles : une pose par page ; tableau, compteur et barrette de terre placés
    const ids = pg.symbols.map((s) => s.nodeId);
    expect(new Set(ids).size).toBe(ids.length);
    const kinds = ids.map(
      (id) => all(project.roots).find((n) => n.id === id)?.kind,
    );
    expect(kinds).toEqual(
      expect.arrayContaining(["board", "meter", "earthBar", "socket", "light"]),
    );
  });

  it("ouverture du .zip exporté par Condui (manifeste + project.json)", async () => {
    const zip = (await writeZip([
      {
        path: "manifest.json",
        data: JSON.stringify({
          version: "1",
          projectId: "demo",
          projectName: "Essai",
          format: "project-with-assets",
        }),
        store: false,
      },
      { path: "project.json", data: JSON.stringify(sample()), store: false },
    ]))!;
    const r = await openProjectData(zip, "Essai_2026-11-26.zip");
    expect(r.format).toBe("condui");
    expect(r.needsNewFile).toBe(true);
    expect(r.project.meta.title).toBe("Essai");
  });

  // Exports réels (données de démonstration Condui), jamais dans le dépôt : CONDUI_SAMPLES=chemin1;chemin2 (project.json)
  const samples = (process.env.CONDUI_SAMPLES ?? "")
    .split(";")
    .filter((p) => p && existsSync(p));
  it.skipIf(!samples.length)(
    "exports réels : import sans symbole inconnu, enfants permis",
    () => {
      for (const p of samples) {
        const { project, warnings } = importCondui(readFileSync(p, "utf-8"), p);
        expect(
          warnings.filter((w) => /non reconnu/.test(w)),
          p,
        ).toEqual([]);
        for (const { node, parent } of walk(project.roots))
          if (parent)
            expect(
              ALLOWED_CHILDREN[parent.kind],
              `${node.kind} sous ${parent.kind}`,
            ).toContain(node.kind);
        expect(project.plan.pages.length).toBeGreaterThan(0);
      }
    },
  );
});
