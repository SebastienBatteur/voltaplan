import type { ElNode, Project } from '../model/types';
import type { LabelFn } from '../unifilar/layout';
import type { Lang } from '../i18n';

export function fmtNum(v: unknown, lang: Lang): string {
  if (v === undefined || v === null || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  const s = String(n);
  return lang === 'en' ? s : s.replace('.', ',');
}

export function cableLabel(n: ElNode, lang: Lang): string {
  const type = n.props.cableType ? String(n.props.cableType) : '';
  const sec = fmtNum(n.props.section, lang);
  const cond = n.props.conductors ? String(n.props.conductors) : '';
  let spec = '';
  if (cond && sec) spec = `${cond}G${sec}`;
  else if (sec) spec = `${sec} mm²`;
  else if (cond) spec = `${cond}G`;
  return [type, spec].filter(Boolean).join(' ') || '—';
}

export function protectionLines(n: ElNode, ref: string | undefined, lang: Lang, t: (k: string) => string): string[] {
  const lines: string[] = [];
  const name = String(n.props.circuitName ?? '');
  const head = [ref, name].filter(Boolean).join(' · ');
  if (head) lines.push(head.length > 30 ? head.slice(0, 29) + '…' : head);
  const device = String(n.props.device ?? 'mcb');
  const parts: string[] = [];
  if (n.props.curve && device !== 'rcd') parts.push(String(n.props.curve) + (n.props.ratedCurrent ? fmtNum(n.props.ratedCurrent, lang) + ' A' : ''));
  else if (n.props.ratedCurrent) parts.push(fmtNum(n.props.ratedCurrent, lang) + ' A');
  if (n.props.poles) parts.push(String(n.props.poles));
  if (parts.length) lines.push(parts.join(' · '));
  const p2: string[] = [];
  if (n.props.residualCurrent) p2.push(`${n.props.residualCurrent} mA${n.props.rcdType ? ' type ' + n.props.rcdType : ''}`);
  // Pouvoir de coupure en ampères (« 3000 A ») : forme attendue par certains contrôleurs, sans ambiguïté
  if (n.props.breakingCapacity) {
    const bc = Number(n.props.breakingCapacity);
    p2.push(`${bc >= 100 ? bc : Math.round(bc * 1000)} A`);
  }
  if (n.props.phase) p2.push(String(n.props.phase));
  if (p2.length) lines.push(p2.join(' · '));
  if (!lines.length) lines.push(t('enum.device.' + device));
  // RGIE 3.1.2.1 : partie réalisée avant le 1/10/1981
  if (n.props.oldPart === true) lines.push(t('label.oldPart'));
  return lines;
}

export function nodeTitle(n: ElNode, project: Project, t: (k: string) => string, ref?: string): string {
  if (n.kind === 'origin') return project.meta.supply || t('kind.origin');
  const name = n.props.name ?? n.props.circuitName;
  if (n.kind === 'appliance') return String(name ?? t('enum.applianceType.' + String(n.props.applianceType ?? 'other')));
  if (name) return String(name);
  if (n.kind === 'board' && ref) return `${t('kind.board')} ${ref}`;
  return t('kind.' + n.kind);
}

export function makeLabelFn(project: Project, numbering: Map<string, string>, lang: Lang, t: (k: string) => string): LabelFn {
  return {
    ref: (id) => numbering.get(id),
    protection: (n) => protectionLines(n, numbering.get(n.id), lang, t),
    cable: (n) => cableLabel(n, lang),
    title: (n) => nodeTitle(n, project, t),
  };
}

/** Libellé court d'un nœud pour les listes : « A3 Prise (Chambre 1) ». */
export function shortLabel(n: ElNode, project: Project, numbering: Map<string, string>, lang: Lang, t: (k: string) => string): string {
  const ref = numbering.get(n.id);
  let main: string;
  if (n.kind === 'cable') main = `${t('kind.cable')} ${cableLabel(n, lang)}`;
  else if (n.kind === 'protection') {
    const dev = t('enum.device.' + String(n.props.device ?? 'mcb'));
    main = `${dev} ${n.props.ratedCurrent ? fmtNum(n.props.ratedCurrent, lang) + 'A' : ''}${n.props.residualCurrent ? ' ' + n.props.residualCurrent + 'mA' : ''}${n.props.circuitName ? ' — ' + n.props.circuitName : ''}`;
  } else if (n.kind === 'socket') main = `${t('kind.socket')}${Number(n.props.count) > 1 ? ' ×' + n.props.count : ''}`;
  else if (n.kind === 'switch') main = t('enum.switchType.' + String(n.props.switchType ?? 'single'));
  else main = nodeTitle(n, project, t);
  return [ref && n.kind !== 'protection' ? ref : ref ? `[${ref}]` : '', main, n.location ? `(${n.location})` : ''].filter(Boolean).join(' ');
}
