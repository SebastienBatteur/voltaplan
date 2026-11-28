/**
 * Propriétés d'un élément d'un ancien relevé (ADR-0010, décision 2) : les valeurs reprises d'un enregistrement
 * antérieur sont signalées « à confirmer » ; seul le bouton « Vérifié sur place » les confirme.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { PropsPanel } from '../src/ui/PropsPanel';
import { useStore } from '../src/store';
import { createNode, emptyProject } from '../src/model/tree';
import { parseProjectText } from '../src/model/migrate';
import type { Project } from '../src/model/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null;
  act(() => useStore.getState().select(null));
});

/** Ancien projet (sans marqueur de suivi) avec une prise de relevé. */
function oldProject(kind: 'existing' | 'new'): { project: Project; socketId: string } {
  const p = emptyProject();
  delete p.meta.provenanceSince;
  p.meta.installationKind = kind;
  if (kind === 'existing') p.meta.installationDate = '1998-01-01';
  const sock = createNode('socket', { earth: true, childSafety: true });
  const prot = createNode('protection', { device: 'mcb', ratedCurrent: 16, curve: 'C', poles: '1P+N' });
  prot.children.push({ ...createNode('cable', { section: 2.5 }), children: [sock] });
  p.roots[0].children[0].children[0].children[0].children.push(prot);
  return { project: parseProjectText(JSON.stringify(p)).project, socketId: sock.id };
}

function mount(project: Project, id: string) {
  act(() => {
    useStore.getState().setLang('fr');
    useStore.getState().loadProject(project, 'ancien.voltaplan');
    useStore.getState().select(id);
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(<PropsPanel />));
  return host;
}

describe('Propriétés : valeurs reprises d’un ancien relevé', () => {
  it('encart « à confirmer » ; « Vérifié sur place » confirme et le retire (une étape d’annulation)', () => {
    const { project, socketId } = oldProject('existing');
    const el = mount(project, socketId);
    const note = el.querySelector('.props-historic');
    expect(note?.textContent).toContain('à confirmer sur place');
    expect(note?.textContent).toMatch(/terre/i);
    const pastBefore = useStore.getState().past.length;
    act(() => (note!.querySelector('button') as HTMLButtonElement).click());
    expect(el.querySelector('.props-historic')).toBeNull();
    const e = useStore.getState().project.evidence!.provenance.filter((x) => x.nodeId === socketId);
    expect(e.length).toBeGreaterThan(0);
    expect(e.every((x) => x.basis === 'confirmed' && x.origin === 'historicUnknown')).toBe(true);
    expect(useStore.getState().past.length).toBe(pastBefore + 1);
  });

  it('ancien projet en conception : pas d’encart', () => {
    const { project, socketId } = oldProject('new');
    const el = mount(project, socketId);
    expect(el.querySelector('.props-historic')).toBeNull();
  });
});
