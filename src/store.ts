import { STORAGE_PREFIX } from './brand';
import { create } from 'zustand';
import type { BoardLayout, ElNode, NodeKind, Project, ProjectMeta, Measurements, PlanPage, Pt, PropValue } from './model/types';
import { cloneWithNewIds, createNode, emptyPage, emptyProject, findNode, findParent, insertChild, insertInSeries, moveSibling, removeNode, updateNode, autoDocNumber } from './model/tree';
import { detectLang, translate, type Lang } from './i18n';
import { pruneReferences } from './model/integrity';
import { orientSymbols } from './plan/geometry';
import { isWallMounted } from './unifilar/symbols';

export type View = 'unifilar' | 'plan' | 'board' | 'bom' | 'project' | 'check';

interface State {
  project: Project;
  fileName: string;
  dirty: boolean;
  /** Augmenté à chaque projet chargé (ouvert, créé, récupéré) : la page d'accueil se ferme. */
  loadSeq: number;
  selectedId: string | null;
  view: View;
  lang: Lang;
  pageIndex: number;
  /** Nœud en attente de placement sur le plan (clic sur le plan pour le poser). */
  placingId: string | null;
  past: Project[];
  future: Project[];

  t: (key: string, params?: Record<string, string | number>) => string;
  setLang: (l: Lang) => void;
  setView: (v: View) => void;
  setPage: (i: number) => void;
  select: (id: string | null) => void;
  loadProject: (p: Project, fileName: string) => void;
  markSaved: (fileName?: string) => void;

  setProps: (id: string, patch: Record<string, PropValue>) => void;
  setLocation: (id: string, location: string) => void;
  addChild: (parentId: string, kind: NodeKind) => void;
  /** Protection en série sous une protection (même circuit) : reprend les câbles en dessous. */
  insertSeries: (protectionId: string, props?: ElNode['props']) => string;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  move: (id: string, delta: number) => void;
  setMeta: (patch: Partial<ProjectMeta>) => void;
  setMeasurements: (patch: Partial<Measurements>) => void;
  startPlacing: (id: string | null) => void;
  placeSymbol: (nodeId: string, pos: Pt) => void;
  moveSymbol: (nodeId: string, pos: Pt) => void;
  rotateSymbol: (nodeId: string, deg: number) => void;
  /** Retire le symbole du plan (le nœud reste dans l'installation). */
  unplaceSymbol: (nodeId: string) => void;
  /** Modifie la page de plan affichée (murs, ouvertures, textes, fond de plan). */
  editPage: (fn: (page: PlanPage) => PlanPage) => void;
  addPage: (name: string) => void;
  /** Disposition d'un tableau (id du nœud tableau). */
  setBoardLayout: (boardId: string, layout: BoardLayout) => void;
  /** Modification globale du projet (une seule étape d'annulation). */
  applyProject: (fn: (p: Project) => Project) => void;
  undo: () => void;
  redo: () => void;
}

const HISTORY = 100;

/** Élément posé au mur (trait de raccordement orienté vers le mur sur le plan). */
const wallMounted = (p: Project, nodeId: string) => {
  const n = findNode(p.roots, nodeId) ?? findNode(p.loose, nodeId);
  return !!n && isWallMounted(n);
};

export const useStore = create<State>((set, get) => {
  /** Applique une modification du projet en l'ajoutant à l'historique. */
  const commit = (fn: (p: Project) => Project) => {
    const { project, past } = get();
    const next = fn(project);
    if (next === project) return;
    set({ project: next, past: [...past.slice(-HISTORY + 1), project], future: [], dirty: true });
  };
  const lang = detectLang();

  return {
    project: emptyProject(),
    fileName: '',
    dirty: false,
    loadSeq: 0,
    selectedId: null,
    view: 'unifilar',
    lang,
    pageIndex: 0,
    placingId: null,
    past: [],
    future: [],

    t: (key, params) => translate(get().lang, key, params),
    setLang: (l) => {
      try {
        localStorage.setItem(STORAGE_PREFIX + 'lang', l);
      } catch {
        /* ignore */
      }
      document.documentElement.lang = l;
      set({ lang: l, t: (key, params) => translate(l, key, params) });
    },
    setView: (view) => set({ view }),
    setPage: (pageIndex) => set({ pageIndex }),
    select: (selectedId) => set({ selectedId }),
    loadProject: (project, fileName) =>
      set({
        // Projet sans numéro de dossier (fichier ancien, import) : numéro proposé, sans marquer le projet modifié
        project: project.meta.docNumber?.trim() ? project : { ...project, meta: { ...project.meta, docNumber: autoDocNumber(project.meta.date) } },
        fileName,
        loadSeq: get().loadSeq + 1, dirty: false, selectedId: null, past: [], future: [], pageIndex: 0, placingId: null }),
    markSaved: (fileName) => set((s) => ({ dirty: false, fileName: fileName ?? s.fileName })),

    setProps: (id, patch) =>
      commit((p) => {
        const upd = (list: ElNode[]) =>
          updateNode(list, id, (n) => {
            const props = { ...n.props, ...patch };
            // Longueur saisie à la main : ce n'est plus une estimation d'après le plan
            if ('length' in patch && !('lengthEstimated' in patch)) delete props.lengthEstimated;
            for (const k of Object.keys(props)) if (props[k] === undefined || props[k] === '') delete props[k];
            return { ...n, props };
          });
        return { ...p, roots: upd(p.roots), loose: upd(p.loose) };
      }),
    setLocation: (id, location) =>
      commit((p) => {
        const upd = (list: ElNode[]) => updateNode(list, id, (n) => ({ ...n, location: location || undefined }));
        return { ...p, roots: upd(p.roots), loose: upd(p.loose) };
      }),
    addChild: (parentId, kind) => {
      const node = createNode(kind);
      commit((p) => ({ ...p, roots: insertChild(p.roots, parentId, node) }));
      set({ selectedId: node.id });
    },
    insertSeries: (protectionId, props = {}) => {
      const up = findNode(get().project.roots, protectionId);
      const node = createNode('protection', {
        device: 'mcb',
        poles: up?.props.poles,
        ratedCurrent: up?.props.ratedCurrent,
        curve: up?.props.curve,
        phase: up?.props.phase,
        ...props,
        series: true,
      });
      commit((p) => ({ ...p, roots: insertInSeries(p.roots, protectionId, node) }));
      set({ selectedId: node.id });
      return node.id;
    },
    remove: (id) => {
      const parent = findParent(get().project.roots, id);
      commit((p) => {
        // Retire aussi tout ce qui référence l'élément et ses descendants (plan, tableau, mesures, dérogations…)
        return pruneReferences({ ...p, roots: removeNode(p.roots, id), loose: removeNode(p.loose, id) });
      });
      set({ selectedId: parent?.id ?? null });
    },
    duplicate: (id) => {
      const { project } = get();
      const n = findNode(project.roots, id);
      const parent = findParent(project.roots, id);
      if (!n || !parent) return;
      const copy = cloneWithNewIds(n);
      const idx = parent.children.findIndex((c) => c.id === id);
      commit((p) => ({ ...p, roots: insertChild(p.roots, parent.id, copy, idx + 1) }));
      set({ selectedId: copy.id });
    },
    move: (id, delta) => commit((p) => ({ ...p, roots: moveSibling(p.roots, id, delta) })),
    setMeta: (patch) => commit((p) => ({ ...p, meta: { ...p.meta, ...patch } })),
    setMeasurements: (patch) => commit((p) => ({ ...p, measurements: { ...p.measurements, ...patch } })),
    startPlacing: (placingId) => set({ placingId }),
    placeSymbol: (nodeId, pos) => {
      const { pageIndex } = get();
      commit((p) => ({
        ...p,
        plan: {
          ...p.plan,
          pages: p.plan.pages.map((pg, i) =>
            i === pageIndex
              ? orientSymbols({ ...pg, symbols: [...pg.symbols.filter((s) => s.nodeId !== nodeId), { nodeId, pos, rotation: 0, autoRotate: wallMounted(p, nodeId) || undefined }] })
              : { ...pg, symbols: pg.symbols.filter((s) => s.nodeId !== nodeId) },
          ),
        },
      }));
      set({ placingId: null, selectedId: nodeId });
    },
    moveSymbol: (nodeId, pos) =>
      commit((p) => ({
        ...p,
        plan: { ...p.plan, pages: p.plan.pages.map((pg) => orientSymbols({ ...pg, symbols: pg.symbols.map((s) => (s.nodeId === nodeId ? { ...s, pos } : s)) })) },
      })),
    rotateSymbol: (nodeId, deg) =>
      commit((p) => ({
        ...p,
        plan: { ...p.plan, pages: p.plan.pages.map((pg) => ({ ...pg, symbols: pg.symbols.map((s) => (s.nodeId === nodeId ? { ...s, rotation: (s.rotation + deg) % 360, autoRotate: undefined } : s)) })) },
      })),
    setBoardLayout: (boardId, layout) => commit((p) => ({ ...p, boards: { ...p.boards, [boardId]: layout } })),
    unplaceSymbol: (nodeId) =>
      commit((p) => ({
        ...p,
        plan: { ...p.plan, pages: p.plan.pages.map((pg) => ({ ...pg, symbols: pg.symbols.filter((s) => s.nodeId !== nodeId) })) },
      })),
    editPage: (fn) => {
      const { pageIndex } = get();
      // Murs modifiés : les éléments posés au mur suivent
      commit((p) => ({ ...p, plan: { ...p.plan, pages: p.plan.pages.map((pg, i) => (i === pageIndex ? orientSymbols(fn(pg)) : pg)) } }));
    },
    addPage: (name) => {
      commit((p) => ({ ...p, plan: { ...p.plan, pages: [...p.plan.pages, emptyPage(name)] } }));
      set({ pageIndex: get().project.plan.pages.length - 1 });
    },
    applyProject: (fn) => commit(fn),
    undo: () => {
      const { past, project, future } = get();
      if (!past.length) return;
      set({ project: past[past.length - 1], past: past.slice(0, -1), future: [project, ...future], dirty: true });
    },
    redo: () => {
      const { past, project, future } = get();
      if (!future.length) return;
      set({ project: future[0], future: future.slice(1), past: [...past, project], dirty: true });
    },
  };
});
