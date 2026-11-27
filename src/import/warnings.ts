/** Avertissements d'import à traduire à l'affichage (clé de src/i18n + paramètres), sans doublon. */
import type { MigrationWarning } from '../model/migrate';

export class Warnings {
  private readonly m = new Map<string, MigrationWarning>();

  add(key: string, params?: Record<string, string | number>): void {
    const w: MigrationWarning = params ? { key, params } : { key };
    this.m.set(JSON.stringify(w), w);
  }

  /** Retire tous les avertissements de cette clé. */
  delete(key: string): void {
    for (const [k, w] of this.m) if (w.key === key) this.m.delete(k);
  }

  get size(): number {
    return this.m.size;
  }

  list(): MigrationWarning[] {
    return [...this.m.values()];
  }
}
