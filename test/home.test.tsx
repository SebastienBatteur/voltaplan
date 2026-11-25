/**
 * Page d'accueil « Mes projets » et assistant de nouveau projet : projets récents (sur l'appareil, sans contenu),
 * coordonnées de l'installateur reprises, mentions du dossier remplies dès la création.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { forgetRecent, listRecent, loadInstallerProfile, recentKey, rememberRecent, RECENT_MAX, saveInstallerProfile } from '../src/io/recent';
import { emptyProject, localIsoDate } from '../src/model/tree';
import { NewProjectWizard } from '../src/ui/NewProjectWizard';
import { useStore } from '../src/store';
import type { Project } from '../src/model/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mem() {
  const m = new Map<string, string>();
  return { read: (k: string) => m.get(k) ?? null, write: (k: string, v: string) => void m.set(k, v), m };
}

describe('projets récents', () => {
  it('fiche sans contenu du projet, la plus récente en tête, sans doublon, limitée', () => {
    const s = mem();
    const p = emptyProject();
    p.meta.title = 'Maison Test';
    p.meta.client.name = 'Jean Dupont';
    p.meta.site.city = 'Tournai';
    p.meta.status = 'ready';
    rememberRecent(p, 'maison.voltaplan', { kind: 'device' }, new Date('2026-11-26T08:00:00Z'), s.read, s.write);
    const raw = s.m.get('voltaplan.recent')!;
    expect(raw).not.toContain('roots');
    expect(listRecent(s.read)[0]).toMatchObject({ title: 'Maison Test', client: 'Jean Dupont', city: 'Tournai', status: 'ready', loc: { kind: 'device' } });
    rememberRecent(p, 'maison.voltaplan', { kind: 'device' }, new Date('2026-11-26T09:00:00Z'), s.read, s.write);
    expect(listRecent(s.read)).toHaveLength(1);
    for (let i = 0; i < RECENT_MAX + 3; i++) rememberRecent(p, `p${i}.voltaplan`, { kind: 'device' }, new Date(), s.read, s.write);
    expect(listRecent(s.read)).toHaveLength(RECENT_MAX);
    expect(listRecent(s.read)[0].name).toBe(`p${RECENT_MAX + 2}.voltaplan`);
    forgetRecent(recentKey({ kind: 'device' }, `p${RECENT_MAX + 2}.voltaplan`), s.read, s.write);
    expect(listRecent(s.read)[0].name).toBe(`p${RECENT_MAX + 1}.voltaplan`);
  });

  it('projet jamais enregistré ni ouvert (sans nom) : pas de fiche ; liste illisible : vide', () => {
    const s = mem();
    rememberRecent(emptyProject(), '  ', { kind: 'device' }, new Date(), s.read, s.write);
    expect(listRecent(s.read)).toEqual([]);
    s.write('voltaplan.recent', '{pas du json');
    expect(listRecent(s.read)).toEqual([]);
  });

  it('coordonnées de l’installateur : gardées, nettoyées', () => {
    const s = mem();
    saveInstallerProfile({ name: ' Élec SRL ', quality: '', vat: 'BE0123' }, s.write);
    expect(loadInstallerProfile(s.read)).toEqual({ name: 'Élec SRL', quality: undefined, vat: 'BE0123' });
  });

  it('date du projet à l’heure locale', () => {
    expect(localIsoDate(new Date(2026, 10, 26, 0, 30))).toBe('2026-11-26');
    expect(emptyProject().meta.date).toBe(localIsoDate());
  });
});

describe('assistant de nouveau projet', () => {
  let root: Root | null = null;
  let host: HTMLElement | null = null;
  afterEach(() => {
    if (root) act(() => root!.unmount());
    host?.remove();
    root = null;
    localStorage.clear();
  });
  const setv = (el: HTMLInputElement | HTMLSelectElement, v: string) => {
    const proto = Object.getPrototypeOf(el);
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, v);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  };

  it('4 étapes : le projet créé porte l’adresse, l’installateur et l’alimentation ; l’installateur est retenu', () => {
    act(() => useStore.getState().setLang('fr'));
    const onCreate = vi.fn<(p: Project) => void>();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    act(() => root!.render(<NewProjectWizard initialKind="existing" onClose={() => undefined} onCreate={onCreate} />));
    const click = (txt: string) => act(() => [...host!.querySelectorAll('button')].find((b) => b.textContent?.trim().startsWith(txt))!.click());
    const inputs = () => [...host!.querySelectorAll<HTMLInputElement>('input:not([type=checkbox])')];
    act(() => setv(inputs()[0], 'Maison Test'));
    click('Suivant');
    act(() => {
      setv(inputs()[0], 'Jean Dupont');
      setv(inputs()[3], '7500');
      setv(inputs()[4], 'Tournai');
    });
    click('Suivant');
    act(() => {
      setv(inputs()[0], 'Élec SRL');
      setv(inputs()[1], 'Installateur électricien');
    });
    click('Suivant');
    act(() => setv(host!.querySelector('select')!, '3N x 400V ~ 50Hz'));
    click('Créer le projet');
    const p = onCreate.mock.calls[0][0];
    expect(p.meta).toMatchObject({
      title: 'Maison Test',
      installationKind: 'existing',
      client: { name: 'Jean Dupont' },
      site: { postalCode: '7500', city: 'Tournai' },
      installer: { name: 'Élec SRL', quality: 'Installateur électricien' },
      supply: '3N x 400V ~ 50Hz',
      mainCurrent: 40,
    });
    expect(p.meta.docNumber).toMatch(/^\d{4}-\d{2}-\d{2}-/);
    expect(loadInstallerProfile()).toMatchObject({ name: 'Élec SRL' });
  });

  it('« Créer maintenant » dès la première étape : projet vide créé, nom par défaut', () => {
    act(() => useStore.getState().setLang('fr'));
    const onCreate = vi.fn<(p: Project) => void>();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    act(() => root!.render(<NewProjectWizard initialKind="new" onClose={() => undefined} onCreate={onCreate} />));
    act(() => [...host!.querySelectorAll('button')].find((b) => b.textContent === 'Créer maintenant')!.click());
    expect(onCreate.mock.calls[0][0].meta).toMatchObject({ title: 'Nouveau projet', installationKind: 'new' });
  });
});
