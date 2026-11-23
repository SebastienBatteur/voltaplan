import { STORAGE_PREFIX } from '../brand';
import { fr, type Dict, type DictKey } from './fr';
import { nl } from './nl';
import { en } from './en';
import { de } from './de';

export type Lang = 'fr' | 'nl' | 'en' | 'de';
export const LANGS: { code: Lang; label: string }[] = [
  { code: 'fr', label: 'Français' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
];

const DICTS: Record<Lang, Partial<Dict>> = { fr, nl, en, de };
const FALLBACK: Record<Lang, Lang[]> = { fr: [], nl: ['fr'], en: ['fr'], de: ['en', 'fr'] };

/** Textes ajoutés par les référentiels (src/rules) ; ils priment sur les traductions de base. */
const EXTRA: Partial<Record<Lang, Record<string, string>>> = {};

export function addMessages(m: Partial<Record<Lang, Record<string, string>>>) {
  for (const [lang, dict] of Object.entries(m) as [Lang, Record<string, string>][]) EXTRA[lang] = { ...EXTRA[lang], ...dict };
}

export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const look = (l: Lang) => EXTRA[l]?.[key] ?? (DICTS[l] as Record<string, string>)[key];
  let s: string | undefined = look(lang);
  for (const fb of FALLBACK[lang]) if (s === undefined) s = look(fb);
  if (s === undefined) s = key;
  if (params) s = s.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
  return s;
}

export function detectLang(): Lang {
  // Lien depuis le site (app/?lang=nl) : la langue de la page d'où l'on vient, retenue pour la suite
  try {
    const q = new URLSearchParams(location.search).get('lang') as Lang | null;
    if (q && q in DICTS) {
      localStorage.setItem(STORAGE_PREFIX + 'lang', q);
      return q;
    }
  } catch {
    /* hors navigateur */
  }
  try {
    const saved = localStorage.getItem(STORAGE_PREFIX + 'lang') as Lang | null;
    if (saved && saved in DICTS) return saved;
  } catch {
    /* stockage indisponible */
  }
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'fr').slice(0, 2);
  return (['fr', 'nl', 'en', 'de'] as Lang[]).includes(nav as Lang) ? (nav as Lang) : 'fr';
}

export type { DictKey };
