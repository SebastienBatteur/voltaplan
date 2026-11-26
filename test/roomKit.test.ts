import { describe, expect, it } from "vitest";
import { emptyProject } from "../src/model/tree";
import type { ElNode, PlanPage, Project } from "../src/model/types";
import {
  equipRoom,
  kitFor,
  pointsInRoom,
  roomBounds,
  roomTypeOf,
} from "../src/plan/roomKit";

/** Pièce de 4 × 3 m (murs de 200 mm), porte en bas à gauche, nom au centre. */
function room(name: string): Project {
  const p = emptyProject();
  const W = 4000;
  const H = 3000;
  const T = 200;
  const page: PlanPage = {
    ...p.plan.pages[0],
    walls: [
      { a: { x: 0, y: 0 }, b: { x: W, y: 0 }, thickness: T },
      { a: { x: W, y: 0 }, b: { x: W, y: H }, thickness: T },
      { a: { x: W, y: H }, b: { x: 0, y: H }, thickness: T },
      { a: { x: 0, y: H }, b: { x: 0, y: 0 }, thickness: T },
    ],
    openings: [
      {
        kind: "door",
        a: { x: 300, y: H },
        b: { x: 1200, y: H },
        width: T,
        hinge: "right",
      },
    ],
    labels: [{ id: "l1", text: name, pos: { x: 2000, y: 1500 }, size: 3 }],
    symbols: [],
    furniture: [],
  };
  return { ...p, plan: { ...p.plan, pages: [page] } };
}

const all = (xs: ElNode[]): ElNode[] =>
  xs.flatMap((x) => [x, ...all(x.children)]);

describe("équiper la pièce", () => {
  it("reconnaît le type de pièce dans les trois langues", () => {
    expect(roomTypeOf("Chambre 2")).toBe("bedroom");
    expect(roomTypeOf("Keuken")).toBe("kitchen");
    expect(roomTypeOf("SDB")).toBe("bathroom");
    expect(roomTypeOf("Living room")).toBe("living");
    expect(roomTypeOf("Toto")).toBeNull();
    expect(kitFor("Toto")).toEqual([]);
  });

  it("trouve le rectangle intérieur de la pièce", () => {
    const b = roomBounds(room("Chambre").plan.pages[0], { x: 2000, y: 1500 });
    expect(b.x0).toBeCloseTo(100, 0);
    expect(b.x1).toBeCloseTo(3900, 0);
    expect(b.y0).toBeCloseTo(100, 0);
    expect(b.y1).toBeCloseTo(2900, 0);
  });

  it("chambre : luminaire au centre, interrupteur côté poignée, prises de chevet, lit contre le mur du fond", () => {
    const r = equipRoom(room("Chambre 1"), 0, 0, { furniture: true });
    const pg = r.project.plan.pages[0];
    const nodes = all(r.project.loose);
    expect(nodes.every((n) => n.location === "Chambre 1")).toBe(true);
    const pos = (n: ElNode) => pg.symbols.find((s) => s.nodeId === n.id)!.pos;
    const sw = nodes.find((n) => n.kind === "switch")!;
    const lt = nodes.find((n) => n.kind === "light")!;
    // Luminaire commandé par l'interrupteur (enfant), au centre
    expect(sw.children[0]).toBe(lt);
    expect(pos(lt)).toEqual({ x: 2000, y: 1500 });
    // Charnière en a (x = 300) : interrupteur au-delà de b (x = 1200), dans la pièce, près du mur du bas
    expect(pos(sw).x).toBeGreaterThan(1200);
    expect(pos(sw).y).toBeGreaterThan(2500);
    // Lit contre le mur opposé à la porte (en haut), dos au mur
    const bed = pg.furniture!.find((f) => f.kind === "bedDouble")!;
    expect(bed.angle).toBe(0);
    expect(bed.center.y).toBeLessThan(1500);
    // Deux prises de chevet de part et d'autre de la tête du lit
    const socks = nodes.filter((n) => n.kind === "socket");
    expect(socks).toHaveLength(3);
    const bs = socks.filter((n) => n.props.count === 2).map(pos);
    expect(bs).toHaveLength(2);
    expect(bs.every((p) => p.y < bed.center.y)).toBe(true);
    expect(Math.min(...bs.map((p) => p.x))).toBeLessThan(
      bed.center.x - bed.w / 2,
    );
    expect(Math.max(...bs.map((p) => p.x))).toBeGreaterThan(
      bed.center.x + bed.w / 2,
    );
    expect(r.points).toBe(nodes.length);
  });

  it("tous les points restent dans la pièce, sans doublon de position, prises tournées vers le mur", () => {
    for (const name of [
      "Salon",
      "Cuisine",
      "Salle de bain",
      "Hall",
      "Buanderie",
      "Bureau",
      "Garage",
      "WC",
      "Extérieur",
    ]) {
      const r = equipRoom(room(name), 0, 0, { furniture: true });
      const syms = r.project.plan.pages[0].symbols;
      expect(syms.length, name).toBeGreaterThan(0);
      for (const s of syms) {
        expect(s.pos.x, name).toBeGreaterThanOrEqual(100);
        expect(s.pos.x, name).toBeLessThanOrEqual(3900);
        expect(s.pos.y, name).toBeGreaterThanOrEqual(100);
        expect(s.pos.y, name).toBeLessThanOrEqual(2900);
      }
      const keys = new Set(syms.map((s) => `${s.pos.x},${s.pos.y}`));
      expect(keys.size, name).toBe(syms.length);
      for (const f of r.project.plan.pages[0].furniture ?? []) {
        expect(f.center.x - f.w / 2, name + " " + f.kind).toBeGreaterThan(50);
      }
    }
  });

  it("hall : va-et-vient (deux interrupteurs, le luminaire derrière le second)", () => {
    const r = equipRoom(room("Hall"), 0, 0);
    const sw = r.project.loose.find((n) => n.kind === "switch")!;
    expect(sw.props.switchType).toBe("twoWay");
    expect(sw.children[0].kind).toBe("switch");
    expect(sw.children[0].children[0].kind).toBe("light");
  });

  it("cuisine : prises au plan de travail, appareils ; salle de bain : points en local humide", () => {
    const k = all(
      equipRoom(room("Cuisine"), 0, 0, { furniture: true }).project.loose,
    );
    expect(
      k
        .filter((n) => n.kind === "appliance")
        .map((n) => n.props.applianceType)
        .sort(),
    ).toEqual(["cooker", "dishwasher", "fridge", "hood"]);
    // Cuisinière et hotte posées contre la taque
    const kr = equipRoom(room("Cuisine"), 0, 0, { furniture: true });
    const hob = kr.project.plan.pages[0].furniture!.find(
      (f) => f.kind === "hob",
    )!;
    for (const t of ["cooker", "hood"]) {
      const n = all(kr.project.loose).find((x) => x.props.applianceType === t)!;
      const pos = kr.project.plan.pages[0].symbols.find(
        (s) => s.nodeId === n.id,
      )!.pos;
      expect(
        Math.hypot(pos.x - hob.center.x, pos.y - hob.center.y),
        t,
      ).toBeLessThan(600);
    }
    const b = all(equipRoom(room("Salle de bain"), 0, 0).project.loose);
    expect(
      b
        .filter((n) => n.kind !== "switch")
        .every((n) => n.props.wetRoom === "yes"),
    ).toBe(true);
  });

  it("ne garde que les éléments cochés ; sans mobilier par défaut ; compte les points déjà présents", () => {
    const p = room("Chambre");
    const r = equipRoom(p, 0, 0, { items: ["lightSwitch"] });
    expect(
      all(r.project.loose)
        .map((n) => n.kind)
        .sort(),
    ).toEqual(["light", "switch"]);
    expect(r.furniture).toBe(0);
    expect(pointsInRoom(r.project, "chambre ")).toBe(2);
    expect(pointsInRoom(p, "Chambre")).toBe(0);
    // Pièce non reconnue : rien ne change
    expect(equipRoom(room("Toto"), 0, 0).points).toBe(0);
  });
});
