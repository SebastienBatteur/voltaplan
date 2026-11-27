/** Fabriques de projets pour les cas de test des règles (voir types.ts). */
import { createNode as baseNode, emptyProject } from '../../src/model/tree';
import type { ElNode, NodeKind, Project } from '../../src/model/types';

/** Nœud avec ses enfants. */
export const node = (kind: NodeKind, props: ElNode['props'] = {}, children: ElNode[] = []): ElNode => ({ ...baseNode(kind, props), children });

/** Circuit : protection → câble → charges. */
export const circuit = (device: string, rating: number, section: number, loads: ElNode[] = [node('socket', {})], name = 'Circuit', extra: ElNode['props'] = {}) =>
  node('protection', { device, ratedCurrent: rating, curve: 'C', poles: '1P+N', circuitName: name, breakingCapacity: 6, ...extra }, [node('cable', { section, length: 10 }, loads)]);

export interface Built {
  p: Project;
  /** Différentiel général (300 mA, 40 A, type A) à l'origine. */
  main: ElNode;
  /** Tableau principal. */
  board: ElNode;
  /** Différentiel 30 mA du tableau (8 circuits au plus). */
  rcd30: ElNode;
  /** Tableau sous le 30 mA (où ajouter les circuits). */
  sub: ElNode;
}

/**
 * Projet neuf complet et conforme : documents, terre (20 Ω), mesures, liaisons, essais des différentiels ; `circuits`
 * sont ajoutés sous le différentiel 30 mA. Modifier ensuite `p` ou les nœuds pour construire le cas.
 */
export function project(...circuits: ElNode[]): Built {
  const p = emptyProject();
  p.meta.installer = { name: 'Installateur', quality: 'Installateur électricien', address: {} };
  p.meta.docNumber = '2026-001';
  p.meta.site = { street: 'Rue de test', number: '1', postalCode: '1000', city: 'Bruxelles', country: 'Belgique' };
  p.measurements = { earthResistanceOhm: 20, insulationMOhm: 10, bondingOk: true };
  const main = p.roots[0].children[0].children[0];
  const board = main.children[0];
  board.children.push(node('earthBar', {}, [node('earth')]));
  const rcd30 = board.children.find((c) => c.kind === 'protection')!;
  const sub = rcd30.children[0];
  sub.children.push(...circuits);
  p.measurements.rcdTests = { [rcd30.id]: { tripMs: 20, ok: true }, [main.id]: { tripMs: 30, ok: true } };
  return { p, main, board, rcd30, sub };
}

/** Installation existante datée (exécution entamée à cette date). */
export function existing(b: Built, date?: string): Built {
  b.p.meta.installationKind = 'existing';
  if (date) b.p.meta.installationDate = date;
  else delete b.p.meta.installationDate;
  return b;
}
