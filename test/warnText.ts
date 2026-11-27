/** Avertissements d'import rendus en français (clé + paramètres → texte), pour les tests. */
import { translate } from '../src/i18n';
import type { MigrationWarning } from '../src/model/migrate';

export const frWarnings = (ws: (string | MigrationWarning)[]): string[] => ws.map((w) => (typeof w === 'string' ? w : translate('fr', w.key, w.params)));
