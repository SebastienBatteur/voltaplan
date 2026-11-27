/**
 * Erreur dont le message affiché est traduit (clé de src/i18n + paramètres). Le texte français reste dans
 * `message`, pour les journaux et les écrans qui ne passent pas par errorText (src/ui/errors.ts).
 */
export class I18nError extends Error {
  constructor(
    readonly key: string,
    readonly params: Record<string, string | number> | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'I18nError';
  }
}
