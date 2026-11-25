/**
 * « À propos de Voltaplan » : version, commit, licence, dépôts, code source correspondant (AGPL §13), licences
 * tierces. Tout vient des constantes de compilation (src/buildInfo.ts) : aucun appel réseau, fonctionne hors ligne.
 */
import { useState } from 'react';
import { BUILD, sourceUrl, technicalInfo } from '../buildInfo';
import { addMessages } from '../i18n';
import { useStore } from '../store';
import type { EmbeddedBuild } from '../../tools/provenance/identity';

addMessages({
  fr: {
    'about.menu': 'À propos de Voltaplan',
    'about.title': 'À propos de {name}',
    'about.version': 'Version',
    'about.commit': 'Commit',
    'about.unknown': 'inconnu',
    'about.license': 'Licence',
    'about.site': 'Site officiel',
    'about.upstream': 'Dépôt d’origine',
    'about.repository': 'Dépôt de cette version',
    'about.source': 'Code source correspondant',
    'about.sourceHelp': 'Le code exact de la version que vous utilisez (AGPL, section 13).',
    'about.thirdParty': 'Licences des composants tiers',
    'about.projectId': 'Identifiant du projet',
    'about.copy': 'Copier les informations techniques',
    'about.copied': 'Copié',
    'about.close': 'Fermer',
    'about.status.clean': 'Construite depuis un commit publié, sans modification locale déclarée.',
    'about.status.modified': 'Construite avec des modifications non commitées : le code source correspondant n’est pas publié en l’état.',
    'about.status.unknown': 'Commit inconnu (compilation sans Git) : code source correspondant non déterminé.',
    'about.status.declared': 'Commit déclaré par l’auteur de la compilation (sans dépôt Git) : l’absence de modification n’est pas vérifiable.',
    'about.derived': 'Version dérivée de {name}, construite depuis un autre dépôt.',
    'about.declared': 'Adresse du code source déclarée par l’auteur de cette version.',
    'about.notAuthenticated': 'Informations déclaratives : elles n’authentifient pas une version officielle.',
  },
  nl: {
    'about.menu': 'Over Voltaplan',
    'about.title': 'Over {name}',
    'about.version': 'Versie',
    'about.commit': 'Commit',
    'about.unknown': 'onbekend',
    'about.license': 'Licentie',
    'about.site': 'Officiële site',
    'about.upstream': 'Oorspronkelijke repository',
    'about.repository': 'Repository van deze versie',
    'about.source': 'Overeenkomstige broncode',
    'about.sourceHelp': 'De exacte code van de versie die u gebruikt (AGPL, artikel 13).',
    'about.thirdParty': 'Licenties van externe componenten',
    'about.projectId': 'Projectidentificatie',
    'about.copy': 'Technische gegevens kopiëren',
    'about.copied': 'Gekopieerd',
    'about.close': 'Sluiten',
    'about.status.clean': 'Gebouwd vanaf een gepubliceerde commit, zonder aangegeven lokale wijzigingen.',
    'about.status.modified': 'Gebouwd met niet-gecommitte wijzigingen: de overeenkomstige broncode is niet als zodanig gepubliceerd.',
    'about.status.unknown': 'Commit onbekend (gebouwd zonder Git): overeenkomstige broncode niet bepaald.',
    'about.status.declared': 'Commit opgegeven door wie de versie bouwde (zonder Git-repository): dat er niets gewijzigd is, kan niet worden nagegaan.',
    'about.derived': 'Afgeleide versie van {name}, gebouwd vanuit een andere repository.',
    'about.declared': 'Adres van de broncode opgegeven door de auteur van deze versie.',
    'about.notAuthenticated': 'Declaratieve gegevens: ze bewijzen niet dat dit een officiële versie is.',
  },
  en: {
    'about.menu': 'About Voltaplan',
    'about.title': 'About {name}',
    'about.version': 'Version',
    'about.commit': 'Commit',
    'about.unknown': 'unknown',
    'about.license': 'License',
    'about.site': 'Official website',
    'about.upstream': 'Original repository',
    'about.repository': 'Repository of this version',
    'about.source': 'Corresponding source code',
    'about.sourceHelp': 'The exact code of the version you are using (AGPL, section 13).',
    'about.thirdParty': 'Third-party licenses',
    'about.projectId': 'Project identifier',
    'about.copy': 'Copy technical information',
    'about.copied': 'Copied',
    'about.close': 'Close',
    'about.status.clean': 'Built from a published commit, with no declared local changes.',
    'about.status.modified': 'Built with uncommitted changes: the corresponding source is not published as is.',
    'about.status.unknown': 'Unknown commit (built without Git): corresponding source not determined.',
    'about.status.declared': 'Commit declared by whoever built this version (no Git repository): the absence of changes cannot be checked.',
    'about.derived': 'Derived version of {name}, built from another repository.',
    'about.declared': 'Source code address declared by the author of this version.',
    'about.notAuthenticated': 'Declarative information: it does not authenticate an official version.',
  },
  de: {
    'about.menu': 'Über Voltaplan',
    'about.title': 'Über {name}',
    'about.version': 'Version',
    'about.commit': 'Commit',
    'about.unknown': 'unbekannt',
    'about.license': 'Lizenz',
    'about.site': 'Offizielle Website',
    'about.upstream': 'Ursprüngliches Repository',
    'about.repository': 'Repository dieser Version',
    'about.source': 'Korrespondierender Quellcode',
    'about.sourceHelp': 'Der genaue Code der von Ihnen verwendeten Version (AGPL, Abschnitt 13).',
    'about.thirdParty': 'Lizenzen von Drittkomponenten',
    'about.projectId': 'Projektkennung',
    'about.copy': 'Technische Angaben kopieren',
    'about.copied': 'Kopiert',
    'about.close': 'Schließen',
    'about.status.clean': 'Aus einem veröffentlichten Commit gebaut, ohne angegebene lokale Änderungen.',
    'about.status.modified': 'Mit nicht committeten Änderungen gebaut: der korrespondierende Quellcode ist so nicht veröffentlicht.',
    'about.status.unknown': 'Commit unbekannt (ohne Git gebaut): korrespondierender Quellcode nicht bestimmt.',
    'about.status.declared': 'Commit vom Ersteller dieser Version angegeben (ohne Git-Repository): das Fehlen von Änderungen ist nicht überprüfbar.',
    'about.derived': 'Abgeleitete Version von {name}, aus einem anderen Repository gebaut.',
    'about.declared': 'Quellcode-Adresse vom Autor dieser Version angegeben.',
    'about.notAuthenticated': 'Deklarative Angaben: sie belegen keine offizielle Version.',
  },
});

export function AboutDialog({ onClose, build = BUILD }: { onClose: () => void; build?: EmbeddedBuild }) {
  const t = useStore((s) => s.t);
  const [copied, setCopied] = useState(false);
  const b = build;
  const link = (href: string | null, text?: string) =>
    href ? (
      <a href={href} target="_blank" rel="noopener">
        {text ?? href.replace(/^https:\/\//, '')}
      </a>
    ) : (
      <span className="muted">{t('about.unknown')}</span>
    );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(technicalInfo(b));
      setCopied(true);
    } catch {
      /* presse-papiers refusé : le texte reste lisible dans la boîte */
    }
  };
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal about-dialog" role="dialog" aria-label={t('about.title', { name: b.name })}>
        <h2 className="about-title">
          <img src="./icon.svg" alt="" width={32} height={32} /> {t('about.title', { name: b.name })}
        </h2>
        <p className={`about-status about-${b.status}`} data-testid="about-status">
          {t('about.status.' + b.status)}
          {b.derived && <> {t('about.derived', { name: 'Voltaplan' })}</>}
        </p>
        <dl className="about-list">
          <dt>{t('about.version')}</dt>
          <dd>{b.version}</dd>
          <dt>{t('about.commit')}</dt>
          <dd>
            <code>{b.commit ? b.commit.slice(0, 12) : t('about.unknown')}</code>
            {b.commitDate ? ` (${b.commitDate.slice(0, 10)})` : ''}
          </dd>
          <dt>{t('about.license')}</dt>
          <dd>
            {link(b.licenseUrl, b.spdx)}
            <br />
            <span className="small">{b.copyright}</span>
          </dd>
          <dt>{t('about.source')}</dt>
          <dd>
            <a className="btn primary about-source" href={sourceUrl(b)} target="_blank" rel="noopener">
              {t('about.source')}
            </a>
            <div className="small muted">
              {t('about.sourceHelp')}
              {b.sourceDeclared ? ' ' + t('about.declared') : ''}
            </div>
          </dd>
          <dt>{t('about.repository')}</dt>
          <dd>{link(b.repository)}</dd>
          <dt>{t('about.upstream')}</dt>
          <dd>{link(b.upstreamRepository)}</dd>
          <dt>{t('about.site')}</dt>
          <dd>{link(b.homepage)}</dd>
          <dt>{t('about.thirdParty')}</dt>
          <dd>{link('./THIRD-PARTY-LICENSES.txt', 'THIRD-PARTY-LICENSES.txt')}</dd>
          <dt>{t('about.projectId')}</dt>
          <dd>
            <code className="small">{b.projectId}</code>
          </dd>
        </dl>
        <p className="small muted">{t('about.notAuthenticated')}</p>
        <div className="row end">
          <button onClick={copy}>{copied ? '✓ ' + t('about.copied') : t('about.copy')}</button>
          <button className="primary" onClick={onClose} autoFocus>
            {t('about.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
