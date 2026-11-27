import { addMessages, type Lang } from '../i18n';
import { useStore } from '../store';
import { BUILD, sourceUrl } from '../buildInfo';

/** Pages légales publiées sur le site (FR à la racine, autres langues sous /en/ et /nl/). */
const SITE = 'https://voltaplan.org/';
const PREFIX: Record<Lang, string> = { fr: '', nl: 'nl/', en: 'en/', de: 'de/' };

addMessages({
  fr: { 'legal.privacy': 'Confidentialité', 'legal.terms': 'Conditions d’utilisation', 'legal.source': 'Code source', 'legal.sponsor': 'Soutenir', 'legal.sponsorHelp': 'Soutenir Voltaplan sur GitHub Sponsors (facultatif, ne débloque rien)' },
  nl: { 'legal.privacy': 'Privacy', 'legal.terms': 'Gebruiksvoorwaarden', 'legal.source': 'Broncode', 'legal.sponsor': 'Steunen', 'legal.sponsorHelp': 'Voltaplan steunen via GitHub Sponsors (vrijblijvend, ontgrendelt niets)' },
  en: { 'legal.privacy': 'Privacy', 'legal.terms': 'Terms of use', 'legal.source': 'Source code', 'legal.sponsor': 'Sponsor', 'legal.sponsorHelp': 'Sponsor Voltaplan on GitHub Sponsors (optional, unlocks nothing)' },
  de: { 'legal.privacy': 'Datenschutz', 'legal.terms': 'Nutzungsbedingungen', 'legal.source': 'Quellcode', 'legal.sponsor': 'Unterstützen', 'legal.sponsorHelp': 'Voltaplan über GitHub Sponsors unterstützen (freiwillig, schaltet nichts frei)' },
});

export function legalUrls(lang: Lang) {
  const p = SITE + PREFIX[lang];
  return { privacy: p + 'privacy.html', terms: p + 'terms.html' };
}

const SPONSOR = 'https://github.com/sponsors/SebastienBatteur';

/**
 * Liens légaux ; `menu` : entrées du menu « ⋯ » de la barre compacte (le pied de page y est masqué).
 * « Code source » : celui de CETTE version (dépôt et commit de la compilation, ou adresse déclarée par un fork),
 * jamais systématiquement le dépôt d'origine (AGPL §13). `onAbout` : ouvre « À propos ».
 */
export function LegalLinks({ menu, onAbout }: { menu?: boolean; onAbout?: () => void }) {
  const t = useStore((s) => s.t);
  const lang = useStore((s) => s.lang);
  const u = legalUrls(lang);
  const role = menu ? 'menuitem' : undefined;
  return (
    <>
      {onAbout && (
        <button type="button" className="legal-about" role={role} onClick={onAbout}>
          {t('about.menu')}
        </button>
      )}
      <a href={u.privacy} target="_blank" rel="noopener" role={role}>
        {t('legal.privacy')}
      </a>
      <a href={u.terms} target="_blank" rel="noopener" role={role}>
        {t('legal.terms')}
      </a>
      <a href={sourceUrl()} target="_blank" rel="noopener" role={role}>
        {t('legal.source')}
        {menu ? ` (${BUILD.spdx})` : ''}
      </a>
      {/* Lien simple (pas de cadre GitHub intégré) : aucune requête vers un tiers avant le clic */}
      <a className="sponsor-link" href={SPONSOR} target="_blank" rel="noopener" role={role} title={t('legal.sponsorHelp')}>
        <span aria-hidden="true">♥</span> {t('legal.sponsor')}
      </a>
    </>
  );
}

/** Pied de page de l'application sur grand écran ; masqué par la feuille de style quand la barre est compacte. */
export function LegalFooter({ onAbout }: { onAbout?: () => void }) {
  return (
    <footer className="legal-footer">
      <LegalLinks onAbout={onAbout} />
      <span>
        {BUILD.spdx} · {BUILD.version}
      </span>
    </footer>
  );
}
