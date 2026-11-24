import { addMessages, type Lang } from '../i18n';
import { useStore } from '../store';

/** Pages légales publiées sur le site (FR à la racine, autres langues sous /en/ et /nl/). */
const SITE = 'https://voltaplan.org/';
const PREFIX: Record<Lang, string> = { fr: '', nl: 'nl/', en: 'en/', de: 'en/' };

addMessages({
  fr: { 'legal.privacy': 'Confidentialité', 'legal.terms': 'Conditions d’utilisation', 'legal.source': 'Code source' },
  nl: { 'legal.privacy': 'Privacy', 'legal.terms': 'Gebruiksvoorwaarden', 'legal.source': 'Broncode' },
  en: { 'legal.privacy': 'Privacy', 'legal.terms': 'Terms of use', 'legal.source': 'Source code' },
  de: { 'legal.privacy': 'Datenschutz (EN)', 'legal.terms': 'Nutzungsbedingungen (EN)', 'legal.source': 'Quellcode' },
});

export function legalUrls(lang: Lang) {
  const p = SITE + PREFIX[lang];
  return { privacy: p + 'privacy.html', terms: p + 'terms.html' };
}

export function LegalFooter() {
  const t = useStore((s) => s.t);
  const lang = useStore((s) => s.lang);
  const u = legalUrls(lang);
  return (
    <footer className="legal-footer">
      <a href={u.privacy} target="_blank" rel="noopener">
        {t('legal.privacy')}
      </a>
      <a href={u.terms} target="_blank" rel="noopener">
        {t('legal.terms')}
      </a>
      <a href="https://github.com/SebastienBatteur/voltaplan" target="_blank" rel="noopener">
        {t('legal.source')}
      </a>
      <span>AGPL-3.0</span>
    </footer>
  );
}
