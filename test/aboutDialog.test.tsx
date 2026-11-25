/**
 * « À propos » : version, commit, licence, dépôts, code source CORRESPONDANT (celui de la version utilisée, pas
 * systématiquement le dépôt d'origine), état déclaré, copie des informations techniques, traductions.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AboutDialog } from '../src/ui/AboutDialog';
import { BUILD } from '../src/buildInfo';
import { translate, type Lang } from '../src/i18n';
import { useStore } from '../src/store';
import type { EmbeddedBuild } from '../tools/provenance/identity';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SHA = '0123456789abcdef0123456789abcdef01234567';
const base: EmbeddedBuild = {
  ...BUILD,
  version: '0.1.0',
  commit: SHA,
  commitDate: '2026-11-25T10:00:00+01:00',
  dirty: false,
  status: 'clean',
  derived: false,
  repository: 'https://github.com/SebastienBatteur/voltaplan',
  correspondingSource: `https://github.com/SebastienBatteur/voltaplan/tree/${SHA}`,
};

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null;
  vi.unstubAllGlobals();
});
function show(b: EmbeddedBuild, lang: Lang = 'fr') {
  act(() => useStore.getState().setLang(lang));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(<AboutDialog build={b} onClose={() => undefined} />));
  return host;
}

describe('À propos', () => {
  it('version d’origine : version, commit, licence, copyright, source au commit, licences tierces locales', () => {
    const h = show(base);
    expect(h.textContent).toContain('0.1.0');
    expect(h.textContent).toContain(SHA.slice(0, 12));
    expect(h.textContent).toContain('AGPL-3.0-only');
    expect(h.textContent).toContain('Copyright (C) 2026 Sébastien Batteur and VoltaPlan contributors');
    expect(h.querySelector<HTMLAnchorElement>('a.about-source')!.href).toBe(base.correspondingSource);
    expect(h.querySelector('a[href="./THIRD-PARTY-LICENSES.txt"]')).not.toBeNull();
    expect(h.querySelector('[data-testid="about-status"]')!.textContent).toMatch(/commit publié/);
    expect(h.textContent).toMatch(/n’authentifient pas une version officielle/);
  });

  it('fork : signalé comme dérivé ; « Code source » mène au fork, pas au dépôt d’origine', () => {
    const fork = `https://github.com/someone/fork/tree/${SHA}`;
    const h = show({ ...base, derived: true, repository: 'https://github.com/someone/fork', correspondingSource: fork });
    expect(h.querySelector<HTMLAnchorElement>('a.about-source')!.href).toBe(fork);
    expect(h.textContent).toMatch(/Version dérivée/);
  });

  it('modifications non commitées et commit inconnu : état affiché clairement', () => {
    expect(show({ ...base, dirty: true, status: 'modified' }).textContent).toMatch(/modifications non commitées/);
    act(() => root!.unmount());
    root = null;
    const h = show({ ...base, commit: null, status: 'unknown', correspondingSource: null, repository: null });
    expect(h.textContent).toMatch(/Commit inconnu/);
    expect(h.querySelector<HTMLAnchorElement>('a.about-source')!.href).toBe(base.upstreamRepository);
  });

  it('copie des informations techniques', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const h = show(base, 'en');
    const btn = [...h.querySelectorAll('button')].find((b) => b.textContent === 'Copy technical information')!;
    await act(async () => btn.click());
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining(`Commit: ${SHA}`));
    expect(btn.textContent).toBe('✓ Copied');
  });

  it('traduit en français, néerlandais, anglais et allemand', () => {
    const keys = ['about.menu', 'about.title', 'about.source', 'about.sourceHelp', 'about.copy', 'about.status.clean', 'about.status.modified', 'about.status.unknown', 'about.derived', 'about.notAuthenticated'];
    for (const lang of ['fr', 'nl', 'en', 'de'] as Lang[]) {
      const seen = new Set<string>();
      for (const k of keys) {
        const v = translate(lang, k);
        expect(v, `${lang} ${k}`).not.toBe(k);
        seen.add(v);
      }
      expect(seen.size).toBe(keys.length);
    }
    expect(translate('nl', 'about.menu')).toBe('Over Voltaplan');
    expect(translate('de', 'about.menu')).toBe('Über Voltaplan');
  });
});
