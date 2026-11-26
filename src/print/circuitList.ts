/**
 * Liste des circuits : une ligne par circuit (lettre, nom, protection, différentiel en amont, câble, nombre de points,
 * pièces desservies). Même contenu dans le dossier PDF et dans l'export CSV (tableur, devis).
 */
import type { ElNode, Project } from '../model/types';
import { ancestors, isCircuit, walk } from '../model/tree';
/** Libellés des protections et des câbles (ceux de l'unifilaire). */
export interface CircuitLabels {
  protection: (n: ElNode) => string[];
  cable: (n: ElNode) => string;
}

type T = (k: string, p?: Record<string, string | number>) => string;

export interface CircuitRow {
  id: string;
  letter: string;
  name: string;
  protection: string;
  rcd: string;
  cable: string;
  points: number;
  rooms: string;
}

const COMMANDS = new Set(['switch', 'pushButton', 'relay', 'cable']);

export function circuitRows(project: Project, numbering: Map<string, string>, labels: CircuitLabels): CircuitRow[] {
  const rows: CircuitRow[] = [];
  for (const { node: c } of walk(project.roots)) {
    if (!isCircuit(c)) continue;
    const rcd = [...ancestors(project.roots, c.id)].reverse().find((a) => a.kind === 'protection' && Number(a.props.residualCurrent) > 0);
    const cable = c.children.find((k) => k.kind === 'cable');
    const letter = numbering.get(c.id) ?? '';
    // Points du circuit (hors sous-tableau : ils ont leur propre lettre)
    const all: ElNode[] = [...walk(c.children)].map(({ node }) => node).filter((n) => numbering.get(n.id)?.startsWith(letter));
    const items = all.filter((n) => !COMMANDS.has(n.kind));
    // Pièces : notées sur les points ou sur leurs commandes (interrupteur « Séjour » de la maison type)
    const rooms = [...new Set(all.map((n) => n.location?.trim()).filter((x): x is string => !!x))];
    rows.push({
      id: c.id,
      letter,
      name: String(c.props.circuitName ?? ''),
      protection: labels.protection(c).slice(1).join(' · '),
      rcd: rcd ? `${rcd.props.residualCurrent} mA${rcd.props.rcdType ? ' type ' + rcd.props.rcdType : ''}` : '',
      cable: cable ? labels.cable(cable) : '',
      points: items.length,
      rooms: rooms.join(', '),
    });
  }
  return rows;
}

/** CSV (séparateur « ; », UTF-8 avec BOM : ouvert tel quel par Excel en français et en néerlandais). */
export function circuitCsv(rows: CircuitRow[], t: T): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const head = [t('print.col.circuit'), t('print.col.name'), t('print.col.protection'), t('print.col.rcd'), t('print.col.cable'), t('print.col.points'), t('print.col.rooms')];
  const body = rows.map((r) => [r.letter, r.name, r.protection, r.rcd, r.cable, r.points, r.rooms]);
  return '﻿' + [head, ...body].map((r) => r.map(esc).join(';')).join('\r\n') + '\r\n';
}
