import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { useDerived } from './derived';
import { ALLOWED_CHILDREN } from '../model/schema';
import { ancestors, createNode, findNode, insertChild, walk } from '../model/tree';
import { isSurveyPart } from '../rules';
import { orientSymbols } from '../plan/geometry';
import { isWallMounted } from '../unifilar/symbols';
import { FAMILIES, PLACEABLE } from './families';
import type { ElNode, NodeKind, PlanPage, Pt } from '../model/types';

/** Valeur « nouveau circuit sous ce tableau » dans la liste des emplacements. */
const NEW_CIRCUIT = '__circuit:';

/**
 * Ajout depuis le plan (clic droit, ou outil « Élément » de la palette) : on choisit l'élément et sa place
 * dans l'unifilaire (sous quel câble, quel interrupteur… ou un nouveau circuit d'un tableau). L'élément est
 * ajouté à l'unifilaire et placé sur le plan là où l'on a cliqué, en une seule étape d'annulation.
 */
export function PlanAddDialog({
  at,
  pos,
  page,
  initialKind,
  onClose,
}: {
  at: { x: number; y: number };
  pos: Pt;
  page: PlanPage;
  initialKind: NodeKind | null;
  onClose: () => void;
}) {
  const t = useStore((s) => s.t);
  const project = useStore((s) => s.project);
  const pageIndex = useStore((s) => s.pageIndex);
  const { numbering, labelFn, find } = useDerived();
  const ref = useRef<HTMLFormElement>(null);

  const nodes = useMemo(() => [...walk(project.roots)].map((w) => w.node), [project.roots]);
  const parentsFor = (k: NodeKind) => nodes.filter((n) => ALLOWED_CHILDREN[n.kind].includes(k));
  const boards = nodes.filter((n) => n.kind === 'board');
  const kinds = FAMILIES.map((f) => ({ ...f, kinds: f.kinds.filter((k) => PLACEABLE.has(k) && (parentsFor(k).length > 0 || ALLOWED_CHILDREN.cable.includes(k))) })).filter(
    (f) => f.kinds.length,
  );

  /** Emplacement proposé : là où est branché l'élément le plus proche sur le plan, sinon l'élément sélectionné. */
  const guessParent = (k: NodeKind): string => {
    const allowed = new Set(parentsFor(k).map((n) => n.id));
    const near = [...page.symbols].sort((a, b) => Math.hypot(a.pos.x - pos.x, a.pos.y - pos.y) - Math.hypot(b.pos.x - pos.x, b.pos.y - pos.y));
    for (const s of near) {
      const chain = ancestors(project.roots, s.nodeId).reverse();
      const hit = chain.find((a) => allowed.has(a.id));
      if (hit) return hit.id;
    }
    const selected = useStore.getState().selectedId;
    if (selected && allowed.has(selected)) return selected;
    const first = parentsFor(k)[0];
    if (first) return first.id;
    return boards[0] ? NEW_CIRCUIT + boards[0].id : '';
  };

  const [kind, setKind] = useState<NodeKind>(initialKind && PLACEABLE.has(initialKind) ? initialKind : 'socket');
  const [parent, setParent] = useState<string>(() => guessParent(initialKind && PLACEABLE.has(initialKind) ? initialKind : 'socket'));

  useEffect(() => {
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close, true);
      window.removeEventListener('keydown', close);
    };
  }, [onClose]);

  /** Libellé d'un emplacement : circuit (lettre et nom) › élément. */
  const placeLabel = (n: ElNode) => {
    const circuit = [...ancestors(project.roots, n.id), n].reverse().find((a) => a.kind === 'protection' && numbering.has(a.id));
    const own = [numbering.get(n.id), n.kind === 'cable' ? t('kind.cable') : labelFn.title(n)].filter(Boolean).join(' ');
    const more = n.kind === 'cable' && n.children.length ? ` (${n.children.map((c) => numbering.get(c.id) ?? labelFn.title(c)).slice(0, 3).join(', ')}${n.children.length > 3 ? '…' : ''})` : '';
    if (!circuit || circuit.id === n.id) return own + more;
    return `${numbering.get(circuit.id)} ${labelFn.title(circuit)} › ${own}${more}`;
  };

  const add = () => {
    const cur = useStore.getState().project;
    const parentId = parent.startsWith(NEW_CIRCUIT) ? parent.slice(NEW_CIRCUIT.length) : parent;
    const parentNode = findNode(cur.roots, parentId);
    // Relevé d'une partie existante : pas de valeur par défaut réglementaire (ADR-0010)
    const survey = isSurveyPart(cur, [...ancestors(cur.roots, parentId), ...(parentNode ? [parentNode] : [])]);
    const node = createNode(kind, {}, { survey });
    useStore.getState().applyProject((p) => {
      let roots = p.roots;
      if (parent.startsWith(NEW_CIRCUIT)) {
        // Nouveau circuit : disjoncteur sous le tableau, câble, puis l'élément
        const prot = survey ? createNode('protection', {}, { survey }) : createNode('protection', { device: 'mcb' });
        const cable = createNode('cable', {}, { survey });
        cable.children = [node];
        prot.children = [cable];
        roots = insertChild(roots, parent.slice(NEW_CIRCUIT.length), prot);
      } else roots = insertChild(roots, parent, node);
      return {
        ...p,
        roots,
        plan: {
          ...p.plan,
          pages: p.plan.pages.map((pg, i) =>
            i === pageIndex
              ? orientSymbols({
                  ...pg,
                  symbols: [...pg.symbols, { nodeId: node.id, pos: { x: Math.round(pos.x), y: Math.round(pos.y) }, rotation: 0, autoRotate: isWallMounted(node) || undefined }],
                })
              : pg,
          ),
        },
      };
    });
    useStore.getState().select(node.id);
    onClose();
  };

  const parents = parentsFor(kind);
  const style = { left: Math.min(at.x, window.innerWidth - 360), top: Math.min(at.y, window.innerHeight - 230) };
  return (
    <form
      className="add-menu plan-add"
      ref={ref}
      style={style}
      onSubmit={(e) => {
        e.preventDefault();
        if (parent) add();
      }}
    >
      <div className="add-menu-title">{t('plan.addTitle')}</div>
      <label className="field">
        <span>{t('plan.addKind')}</span>
        <select
          autoFocus
          value={kind}
          onChange={(e) => {
            const k = e.target.value as NodeKind;
            setKind(k);
            setParent(guessParent(k));
          }}
        >
          {kinds.map((f) => (
            <optgroup key={f.key} label={t('family.' + f.key)}>
              {f.kinds.map((k) => (
                <option key={k} value={k}>
                  {t('kind.' + k)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{t('plan.addWhere')}</span>
        <select value={parent} onChange={(e) => setParent(e.target.value)}>
          {parents.map((n) => (
            <option key={n.id} value={n.id}>
              {placeLabel(n)}
            </option>
          ))}
          {ALLOWED_CHILDREN.cable.includes(kind) &&
            boards.map((b) => (
              <option key={b.id} value={NEW_CIRCUIT + b.id}>
                {t('plan.addNewCircuit', { board: labelFn.title(find(b.id) ?? b) })}
              </option>
            ))}
        </select>
      </label>
      <div className="row">
        <button type="submit" className="primary" disabled={!parent}>
          {t('plan.addConfirm')}
        </button>
        <button type="button" onClick={onClose}>
          {t('action.cancel')}
        </button>
      </div>
    </form>
  );
}
