/**
 * « Équiper la pièce » (fonction pure, testée) : à partir du nom d'une pièce posé sur le plan, Voltaplan propose
 * l'équipement habituel de ce type de pièce (point lumineux et sa commande, prises, appareils) et, si on le veut,
 * le mobilier type. Les points sont posés à leur place logique : le luminaire au centre, l'interrupteur à côté de
 * la porte (côté poignée), les prises le long des murs, les prises de chevet de part et d'autre du lit.
 *
 * Ce n'est PAS une liste du RGIE : le RGIE ne fixe pas un nombre de prises par pièce. C'est un point de départ,
 * à adapter. Les points ajoutés sont des éléments non raccordés (avec la pièce comme emplacement) : on les
 * raccorde ensuite aux circuits, et le contrôle RGIE s'applique alors comme à tout élément.
 */
import { interpretLabel } from "../assist/labels";
import { createNode, uid } from "../model/tree";
import type {
  ElNode,
  Furniture,
  NodeKind,
  PlanPage,
  Project,
  Pt,
} from "../model/types";
import { FURNITURE, type FurnitureKind } from "./furniture";
import { orientSymbols } from "./geometry";

/** Types de pièce reconnus (noms affichés de src/assist/labels.ts). */
export type RoomType =
  | "bedroom"
  | "living"
  | "dining"
  | "kitchen"
  | "bathroom"
  | "wc"
  | "hall"
  | "stairs"
  | "laundry"
  | "office"
  | "garage"
  | "storage"
  | "workshop"
  | "veranda"
  | "outdoor";

const ROOM_TYPES: Record<string, RoomType> = {
  Chambre: "bedroom",
  Salon: "living",
  "Salle à manger": "dining",
  Cuisine: "kitchen",
  "Salle de bain": "bathroom",
  "Salle de douche": "bathroom",
  WC: "wc",
  Hall: "hall",
  Escalier: "stairs",
  Buanderie: "laundry",
  Bureau: "office",
  Garage: "garage",
  Cave: "storage",
  Grenier: "storage",
  Débarras: "storage",
  Atelier: "workshop",
  Véranda: "veranda",
  Extérieur: "outdoor",
};

/** Type de pièce d'après son nom sur le plan (« Chambre 2 », « Keuken », « SDB »…), ou null. */
export function roomTypeOf(text: string): RoomType | null {
  const r = interpretLabel(text).room;
  if (!r) return null;
  return ROOM_TYPES[r.replace(/ \d+$/, "")] ?? null;
}

/** Où poser un point : centre, près de la porte, le long d'un mur, au chevet, au plan de travail, au miroir. */
type Slot =
  | "center"
  | "door"
  | "door2"
  | "wall"
  | "bedside"
  | "counter"
  | "mirror"
  | "hob";

interface Spec {
  kind: NodeKind;
  props?: ElNode["props"];
  slot: Slot;
  children?: Spec[];
}

export interface KitItem {
  /** Clé de traduction : `kit.item.<key>`. */
  key: string;
  /** Nombre d'exemplaires (prises doubles, etc.). */
  qty: number;
  spec: Spec;
}

const light = (props: ElNode["props"] = {}, slot: Slot = "center"): Spec => ({
  kind: "light",
  props,
  slot,
});
const lightSwitch = (
  lp: ElNode["props"] = {},
  sp: ElNode["props"] = {},
): KitItem => ({
  key: "lightSwitch",
  qty: 1,
  spec: {
    kind: "switch",
    props: { switchType: "single", ...sp },
    slot: "door",
    children: [light(lp)],
  },
});
// Va-et-vient : deux interrupteurs (porte et seconde porte ou mur opposé), le luminaire derrière le second
const twoWay = (): KitItem => ({
  key: "twoWay",
  qty: 1,
  spec: {
    kind: "switch",
    props: { switchType: "twoWay" },
    slot: "door",
    children: [
      {
        kind: "switch",
        props: { switchType: "twoWay" },
        slot: "door2",
        children: [light()],
      },
    ],
  },
});
const sockets = (
  key: string,
  qty: number,
  count: number,
  slot: Slot = "wall",
  props: ElNode["props"] = {},
): KitItem => ({
  key,
  qty,
  spec: { kind: "socket", props: { count, ...props }, slot },
});
const appliance = (
  applianceType: string,
  viaSocket = false,
  slot: Slot = "wall",
): KitItem =>
  viaSocket
    ? {
        key: "app." + applianceType,
        qty: 1,
        spec: {
          kind: "socket",
          props: { count: 1 },
          slot: "wall",
          children: [
            { kind: "appliance", props: { applianceType }, slot: "wall" },
          ],
        },
      }
    : {
        key: "app." + applianceType,
        qty: 1,
        spec: { kind: "appliance", props: { applianceType }, slot },
      };
const other = (otherType: string): KitItem => ({
  key: "other." + otherType,
  qty: 1,
  spec: { kind: "other", props: { otherType }, slot: "wall" },
});

/** Équipement habituel par type de pièce (suggestion de Voltaplan, à adapter ; pas une exigence du RGIE). */
export const ROOM_KITS: Record<RoomType, KitItem[]> = {
  bedroom: [
    lightSwitch(),
    sockets("bedside", 2, 2, "bedside"),
    sockets("socket", 1, 1),
  ],
  living: [
    lightSwitch(),
    sockets("socketDouble", 4, 2),
    other("tvOutlet"),
    other("dataOutlet"),
  ],
  dining: [lightSwitch(), sockets("socketDouble", 2, 2)],
  kitchen: [
    lightSwitch(),
    sockets("counter", 3, 2, "counter"),
    appliance("cooker", false, "hob"),
    appliance("hood", false, "hob"),
    appliance("dishwasher", true),
    appliance("fridge", true),
  ],
  bathroom: [
    lightSwitch({ wetRoom: "yes" }),
    {
      key: "mirrorLight",
      qty: 1,
      spec: light({ lightType: "wall", wetRoom: "yes" }, "mirror"),
    },
    sockets("socketMirror", 1, 1, "mirror", { wetRoom: "yes" }),
  ],
  wc: [lightSwitch()],
  hall: [twoWay(), sockets("socket", 1, 1)],
  stairs: [twoWay()],
  laundry: [
    lightSwitch(),
    appliance("washingMachine", true),
    appliance("dryer", true),
    sockets("socket", 1, 1),
  ],
  office: [lightSwitch(), sockets("socketDouble", 3, 2), other("dataOutlet")],
  garage: [lightSwitch(), sockets("socketDouble", 2, 2)],
  storage: [lightSwitch(), sockets("socket", 1, 1)],
  workshop: [lightSwitch(), sockets("socketDouble", 3, 2)],
  veranda: [lightSwitch(), sockets("socketDouble", 2, 2)],
  outdoor: [
    {
      key: "outdoorLight",
      qty: 1,
      spec: {
        kind: "switch",
        props: { switchType: "single" },
        slot: "door",
        children: [light({ lightType: "wall", splashProof: true }, "wall")],
      },
    },
    sockets("socketOutdoor", 1, 1, "wall", { splashProof: true }),
  ],
};

/** Mobilier type, contre le mur principal (le plus éloigné de la porte). */
export const ROOM_FURNITURE: Partial<Record<RoomType, FurnitureKind[]>> = {
  bedroom: ["bedDouble", "wardrobe"],
  living: ["sofa", "coffeeTable", "tvUnit"],
  dining: ["diningTable"],
  kitchen: ["fridge", "counter", "sink", "counter", "hob", "counter"],
  bathroom: ["bathtub", "washbasin"],
  wc: ["wc"],
  laundry: ["washer"],
  office: ["desk"],
};

// ————— Géométrie de la pièce —————

export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const DOORS = new Set(["door", "doubleDoor", "frenchDoor", "slidingDoor"]);
const MAX_RAY = 15000;
const FALLBACK = 1500;

/** Distance du point au mur le long d'un rayon (direction d), face intérieure du mur ; null si aucun mur. */
function ray(page: PlanPage, p: Pt, d: Pt): number | null {
  let best: number | null = null;
  for (const w of page.walls) {
    const ex = w.b.x - w.a.x;
    const ey = w.b.y - w.a.y;
    const den = d.x * ey - d.y * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((w.a.x - p.x) * ey - (w.a.y - p.y) * ex) / den;
    const s = ((w.a.x - p.x) * d.y - (w.a.y - p.y) * d.x) / den;
    if (t <= 0 || s < -0.001 || s > 1.001) continue;
    const len = Math.hypot(ex, ey) || 1;
    const cos = Math.abs(d.x * ey - d.y * ex) / len; // incidence (1 = perpendiculaire)
    const inner = t - w.thickness / 2 / Math.max(cos, 0.2);
    if (inner > 0 && inner < MAX_RAY && (best === null || inner < best))
      best = inner;
  }
  return best;
}

/** Rectangle intérieur de la pièce autour du point (murs touchés à gauche, à droite, en haut, en bas). */
export function roomBounds(page: PlanPage, p: Pt): Bounds {
  const r = (dx: number, dy: number) =>
    ray(page, p, { x: dx, y: dy }) ?? FALLBACK;
  return {
    x0: p.x - r(-1, 0),
    x1: p.x + r(1, 0),
    y0: p.y - r(0, -1),
    y1: p.y + r(0, 1),
  };
}

const inside = (b: Bounds, p: Pt, m = 0) =>
  p.x >= b.x0 - m && p.x <= b.x1 + m && p.y >= b.y0 - m && p.y <= b.y1 + m;
const clampIn = (b: Bounds, p: Pt, m: number): Pt => ({
  x: Math.min(Math.max(p.x, b.x0 + m), b.x1 - m),
  y: Math.min(Math.max(p.y, b.y0 + m), b.y1 - m),
});
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

type Side = "top" | "bottom" | "left" | "right";
const SIDES: Side[] = ["top", "right", "bottom", "left"];

/** Côté du rectangle le plus proche d'un point. */
function sideOf(b: Bounds, p: Pt): Side {
  const d: [Side, number][] = [
    ["top", Math.abs(p.y - b.y0)],
    ["bottom", Math.abs(p.y - b.y1)],
    ["left", Math.abs(p.x - b.x0)],
    ["right", Math.abs(p.x - b.x1)],
  ];
  return d.sort((a, c) => a[1] - c[1])[0][0];
}
const opposite: Record<Side, Side> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

/** Portes de la pièce, la plus proche du nom d'abord. */
function roomDoors(page: PlanPage, b: Bounds, p: Pt) {
  return page.openings
    .filter(
      (o) =>
        DOORS.has(o.kind) && inside(b, mid(o.a, o.b), (o.width ?? 300) + 150),
    )
    .sort((o, q) => dist(mid(o.a, o.b), p) - dist(mid(q.a, q.b), p));
}

/** Interrupteur près d'une porte, côté poignée (opposé à la charnière), à l'intérieur de la pièce. */
function besideDoor(b: Bounds, o: PlanPage["openings"][number]): Pt {
  const hinge = o.mirrored ? o.b : o.a;
  const latch = o.mirrored ? o.a : o.b;
  const len = dist(hinge, latch) || 1;
  const u = { x: (latch.x - hinge.x) / len, y: (latch.y - hinge.y) / len };
  return clampIn(b, { x: latch.x + u.x * 250, y: latch.y + u.y * 250 }, 150);
}

/** Point du côté `s`, à la position relative `f` (0..1), décalé de `m` vers l'intérieur. */
function onSide(b: Bounds, s: Side, f: number, m: number): Pt {
  switch (s) {
    case "top":
      return { x: b.x0 + (b.x1 - b.x0) * f, y: b.y0 + m };
    case "bottom":
      return { x: b.x1 - (b.x1 - b.x0) * f, y: b.y1 - m };
    case "left":
      return { x: b.x0 + m, y: b.y1 - (b.y1 - b.y0) * f };
    default:
      return { x: b.x1 - m, y: b.y0 + (b.y1 - b.y0) * f };
  }
}
const sideLen = (b: Bounds, s: Side) =>
  s === "top" || s === "bottom" ? b.x1 - b.x0 : b.y1 - b.y0;
/** Rotation d'un meuble dont le dos (−y local) est contre le côté `s`. */
const backAngle: Record<Side, number> = {
  top: 0,
  right: 90,
  bottom: 180,
  left: 270,
};

// ————— Mobilier —————

function placeFurniture(type: RoomType, b: Bounds, main: Side): Furniture[] {
  const kinds = ROOM_FURNITURE[type] ?? [];
  const out: Furniture[] = [];
  const L = sideLen(b, main);
  const depth = sideLen(
    b,
    main === "top" || main === "bottom" ? "left" : "top",
  );
  const put = (k: FurnitureKind, s: Side, f: number, extra = 0) => {
    const { w, h } = FURNITURE[k];
    const p = onSide(b, s, f, h / 2 + 20 + extra);
    out.push({
      id: uid(),
      kind: k,
      center: { x: Math.round(p.x), y: Math.round(p.y) },
      w,
      h,
      angle: backAngle[s],
    });
  };
  const fits = (k: FurnitureKind, s: Side) =>
    FURNITURE[k].w + 200 <= sideLen(b, s) &&
    FURNITURE[k].h + 400 <=
      sideLen(b, s === "top" || s === "bottom" ? "left" : "top");
  if (type === "kitchen" || type === "bathroom" || type === "laundry") {
    // Rangée contre le mur principal, depuis un angle
    let x = 40;
    for (const k of kinds) {
      const { w } = FURNITURE[k];
      if (x + w > L - 40 || FURNITURE[k].h + 300 > depth) break;
      put(k, main, (x + w / 2) / L);
      x += w;
    }
    return out;
  }
  for (const k of kinds) {
    if (k === "coffeeTable") {
      if (out.length) put(k, main, 0.5, FURNITURE.sofa.h + 350);
      continue;
    }
    if (k === "tvUnit") {
      if (fits(k, opposite[main])) put(k, opposite[main], 0.5);
      continue;
    }
    if (k === "diningTable") {
      if (FURNITURE[k].w + 1200 <= L && FURNITURE[k].h + 1200 <= depth) {
        const c = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
        out.push({
          id: uid(),
          kind: k,
          center: { x: Math.round(c.x), y: Math.round(c.y) },
          w: FURNITURE[k].w,
          h: FURNITURE[k].h,
          angle: main === "top" || main === "bottom" ? 0 : 90,
        });
      }
      continue;
    }
    if (k === "wardrobe") {
      // Armoire sur un mur latéral, côté du mur principal
      const side = SIDES[(SIDES.indexOf(main) + 1) % 4];
      if (fits(k, side))
        put(k, side, 0.12 + FURNITURE[k].w / 2 / sideLen(b, side));
      continue;
    }
    if (fits(k, main)) put(k, main, 0.5);
  }
  return out;
}

// ————— Placement des points —————

export interface EquipOptions {
  /** Clés des éléments du kit retenus (toutes par défaut). */
  items?: string[];
  /** Ajouter le mobilier type. */
  furniture?: boolean;
}

export interface EquipResult {
  project: Project;
  /** Nombre de points ajoutés et de meubles posés. */
  points: number;
  furniture: number;
}

/** Éléments du kit d'un nom de pièce (vide si la pièce n'est pas reconnue). */
export function kitFor(text: string): KitItem[] {
  const type = roomTypeOf(text);
  return type ? ROOM_KITS[type] : [];
}

/** Ajoute à la page l'équipement type de la pièce nommée par le texte `labelIndex`. */
export function equipRoom(
  project: Project,
  pageIndex: number,
  labelIndex: number,
  opts: EquipOptions = {},
): EquipResult {
  const page = project.plan.pages[pageIndex];
  const label = page?.labels[labelIndex];
  const type = label ? roomTypeOf(label.text) : null;
  if (!page || !label || !type) return { project, points: 0, furniture: 0 };
  const room = label.text.trim();
  const b = roomBounds(page, label.pos);
  const center = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
  const doors = roomDoors(page, b, label.pos);
  const doorSide = doors.length ? sideOf(b, mid(doors[0].a, doors[0].b)) : null;
  const main = doorSide ? opposite[doorSide] : "top";

  // Mobilier : nouveau, ou déjà présent dans la pièce (lit, plan de travail, lavabo servent de repères)
  const newFurniture = opts.furniture ? placeFurniture(type, b, main) : [];
  const allFurniture = [
    ...(page.furniture ?? []).filter((f) => inside(b, f.center)),
    ...newFurniture,
  ];
  const find = (...kinds: string[]) =>
    allFurniture.find((f) => kinds.includes(f.kind));

  // Positions déjà prises (points existants de la page + ceux qu'on ajoute)
  const taken: Pt[] = page.symbols.map((s) => s.pos);
  const free = (p: Pt) => taken.every((q) => dist(p, q) > 250);
  const avoidDoors = (p: Pt) =>
    doors.every((o) => dist(p, mid(o.a, o.b)) > dist(o.a, o.b) / 2 + 300);
  const take = (p: Pt): Pt => {
    const q = { x: Math.round(p.x), y: Math.round(p.y) };
    taken.push(q);
    return q;
  };

  // Prises le long des murs : on fait le tour de la pièce depuis la porte, positions régulières
  const wallQueue: Pt[] = [];
  const wallSlot = (n: number): Pt => {
    if (!wallQueue.length) {
      const per = SIDES.map((s) => sideLen(b, s));
      const total = per.reduce((a, c) => a + c, 0);
      const start = doorSide ? SIDES.indexOf(doorSide) : 0;
      const steps = Math.max(8, n * 3);
      for (let i = 0; i < steps; i++) {
        let d = ((i + 0.5) / steps) * total;
        for (let k = 0; k < 4; k++) {
          const s = SIDES[(start + k) % 4];
          const len = per[(start + k) % 4];
          if (d <= len) {
            wallQueue.push(onSide(b, s, d / len, 120));
            break;
          }
          d -= len;
        }
      }
      // Ordre : un sur trois d'abord pour bien répartir, puis le reste
      const spread = [
        ...wallQueue.filter((_, i) => i % 3 === 1),
        ...wallQueue.filter((_, i) => i % 3 !== 1),
      ];
      wallQueue.splice(0, wallQueue.length, ...spread);
    }
    const i = wallQueue.findIndex((p) => free(p) && avoidDoors(p));
    return i >= 0
      ? wallQueue.splice(i, 1)[0]
      : clampIn(b, { x: center.x + taken.length * 100, y: b.y0 + 120 }, 120);
  };

  const bed = find("bedDouble", "bedSingle");
  const bedsides: Pt[] = [];
  if (bed) {
    const rad = (bed.angle * Math.PI) / 180;
    const ux = { x: Math.cos(rad), y: Math.sin(rad) };
    const back = { x: Math.sin(rad), y: -Math.cos(rad) }; // −y local
    for (const sgn of [-1, 1]) {
      const p = {
        x:
          bed.center.x +
          back.x * (bed.h / 2 - 100) +
          ux.x * sgn * (bed.w / 2 + 250),
        y:
          bed.center.y +
          back.y * (bed.h / 2 - 100) +
          ux.y * sgn * (bed.w / 2 + 250),
      };
      bedsides.push(clampIn(b, p, 120));
    }
  }
  const counterRow = allFurniture.filter((f) =>
    ["counter", "sink", "hob"].includes(f.kind),
  );
  const counterSlots: Pt[] = counterRow.map((f) => {
    const rad = (f.angle * Math.PI) / 180;
    const back = { x: Math.sin(rad), y: -Math.cos(rad) };
    return clampIn(
      b,
      {
        x: f.center.x + back.x * (f.h / 2 - 80),
        y: f.center.y + back.y * (f.h / 2 - 80),
      },
      100,
    );
  });
  // Cuisinière et hotte : de part et d'autre de la taque
  const hob = find("hob");
  const hobSlots: Pt[] = [];
  if (hob) {
    const rad = (hob.angle * Math.PI) / 180;
    const ux = { x: Math.cos(rad), y: Math.sin(rad) };
    const back = { x: Math.sin(rad), y: -Math.cos(rad) };
    for (const sgn of [-1, 1])
      hobSlots.push(
        clampIn(
          b,
          {
            x:
              hob.center.x +
              back.x * (hob.h / 2 - 80) +
              ux.x * sgn * (hob.w / 2),
            y:
              hob.center.y +
              back.y * (hob.h / 2 - 80) +
              ux.y * sgn * (hob.w / 2),
          },
          100,
        ),
      );
  }
  const basin = find("washbasin", "doubleWashbasin");
  const mirrorSlots: Pt[] = [];
  if (basin) {
    const rad = (basin.angle * Math.PI) / 180;
    const ux = { x: Math.cos(rad), y: Math.sin(rad) };
    const back = { x: Math.sin(rad), y: -Math.cos(rad) };
    const base = {
      x: basin.center.x + back.x * (basin.h / 2 - 60),
      y: basin.center.y + back.y * (basin.h / 2 - 60),
    };
    mirrorSlots.push(
      clampIn(b, base, 100),
      clampIn(
        b,
        {
          x: base.x + ux.x * (basin.w / 2 + 200),
          y: base.y + ux.y * (basin.w / 2 + 200),
        },
        100,
      ),
    );
  }
  let lights = 0;
  let firstSwitch: Pt | null = null;
  const slotPos = (slot: Slot): Pt => {
    switch (slot) {
      case "center": {
        const p = { x: center.x + lights * 600, y: center.y };
        lights++;
        return p;
      }
      case "door": {
        const p = doors.length
          ? besideDoor(b, doors[0])
          : onSide(b, main === "top" ? "bottom" : opposite[main], 0.1, 120);
        firstSwitch = p;
        return free(p) ? p : wallSlot(1);
      }
      case "door2": {
        if (doors[1]) return besideDoor(b, doors[1]);
        const f: Pt = firstSwitch ?? { x: b.x0, y: b.y0 };
        // Mur opposé, à la même hauteur relative
        return clampIn(b, { x: b.x0 + b.x1 - f.x, y: b.y0 + b.y1 - f.y }, 150);
      }
      case "bedside":
        return bedsides.find(free) ?? wallSlot(1);
      case "counter":
        return counterSlots.find(free) ?? wallSlot(1);
      case "mirror":
        return mirrorSlots.find(free) ?? wallSlot(1);
      case "hob":
        return hobSlots.find(free) ?? wallSlot(1);
      default:
        return wallSlot(1);
    }
  };

  const chosen = ROOM_KITS[type].filter(
    (it) => !opts.items || opts.items.includes(it.key),
  );
  const roots: ElNode[] = [];
  const symbols: PlanPage["symbols"] = [];
  const build = (s: Spec): ElNode => {
    const n = createNode(s.kind, s.props ?? {});
    n.location = room;
    const pos = take(slotPos(s.slot));
    // Luminaire au plafond : pas tourné vers un mur ; le reste (prises, interrupteurs, appliques) l'est
    symbols.push({
      nodeId: n.id,
      pos,
      rotation: 0,
      autoRotate: s.slot !== "center",
    });
    n.children = (s.children ?? []).map(build);
    return n;
  };
  for (const it of chosen)
    for (let i = 0; i < it.qty; i++) roots.push(build(it.spec));

  const pages = project.plan.pages.map((pg, i) =>
    i !== pageIndex
      ? pg
      : orientSymbols({
          ...pg,
          symbols: [...pg.symbols, ...symbols],
          furniture: [...(pg.furniture ?? []), ...newFurniture],
        }),
  );
  return {
    project: {
      ...project,
      loose: [...project.loose, ...roots],
      plan: { ...project.plan, pages },
    },
    points: symbols.length,
    furniture: newFurniture.length,
  };
}

/** Points déjà présents dans la pièce (emplacement = nom de la pièce). */
export function pointsInRoom(project: Project, text: string): number {
  const key = text.trim().toLowerCase();
  let n = 0;
  const visit = (xs: ElNode[]) => {
    for (const x of xs) {
      if ((x.location ?? "").trim().toLowerCase() === key) n++;
      visit(x.children);
    }
  };
  visit(project.roots);
  visit(project.loose);
  return n;
}
