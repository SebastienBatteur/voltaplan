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

const SOURCE = 'https://github.com/SebastienBatteur/voltaplan';

/** Liens légaux ; `menu` : entrées du menu « ⋯ » de la barre compacte (le pied de page y est masqué). */
export function LegalLinks({ menu }: { menu?: boolean }) {
  const t = useStore((s) => s.t);
  const lang = useStore((s) => s.lang);
  const u = legalUrls(lang);
  const role = menu ? 'menuitem' : undefined;
  return (
    <>
      <a href={u.privacy} target="_blank" rel="noopener" role={role}>
        {t('legal.privacy')}
      </a>
      <a href={u.terms} target="_blank" rel="noopener" role={role}>
        {t('legal.terms')}
      </a>
      <a href={SOURCE} target="_blank" rel="noopener" role={role}>
        {t('legal.source')}
        {menu ? ' (AGPL-3.0)' : ''}
      </a>
    </>
  );
}

/** Pied de page de l'application sur grand écran ; masqué par la feuille de style quand la barre est compacte. */
export function LegalFooter() {
  return (
    <footer className="legal-footer">
      <LegalLinks />
      <span>AGPL-3.0</span>
    </footer>
  );
}
