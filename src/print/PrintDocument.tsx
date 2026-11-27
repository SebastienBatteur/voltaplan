/**
 * Dossier imprimable (A4 ou A3 paysage) : unifilaire, plan(s) de position, tableau(x), liste des circuits,
 * légende des symboles, étiquettes du tableau à l'échelle 1:1, constats du contrôle.
 *
 * Chaque page a le cartouche demandé par le RGIE (3.1.2) et les organismes agréés : numéro, version et date
 * du document, responsable de l'exécution des travaux (nom, qualité, TVA), adresse de l'installation,
 * tension et nature du courant, cases de signature (installateur, organisme agréé, propriétaire).
 * Tout est vectoriel : « Imprimer » puis « Enregistrer en PDF » donne un PDF net à toutes les échelles.
 */
import type { CSSProperties, ReactNode } from 'react';
import type { ElNode, Project } from '../model/types';
import type { LabelFn } from '../unifilar/layout';
import { layoutUnifilar, type Prim } from '../unifilar/layout';
import { abbr, isOffTable, Symbol, symbolSize } from '../unifilar/symbols';
import { walk } from '../model/tree';
import { Walls, PlanSymbol, S, planBounds } from '../ui/PlanView';
import { DeviceFace, DEV_H, LABEL_H, MARGIN, MOD, ROW_PITCH, rowTop } from '../ui/BoardView';
import { boardSize, enclosures, placed } from '../board/model';
import { DRAFT_KEYS, isDocumentary, type DraftLevel, type Finding } from '../rules';
import { blockingText, findingRank, knowledgeText, ruleText } from '../ui/CheckPanel';
import { APP_NAME } from '../brand';
import type { Lang } from '../i18n';
import { billOfMaterials } from '../bom/bom';
import { getRulePack } from '../rules';
import { BomTable } from '../ui/BomPanel';
import { QrCode } from '../ui/QrCode';
import { isHttpsUrl, qrLabelPayload } from './qrLabel';
import { circuitRows } from './circuitList';
import { EARTH_EXTRA_MEASURES_ABOVE, EARTH_MAX, INSULATION_MIN, RCD_TRIP_MAX } from '../regulations/be/values';

export type PaperFormat = 'A4' | 'A3';
export interface PrintSections {
  unifilar: boolean;
  plan: boolean;
  board: boolean;
  circuits: boolean;
  legend: boolean;
  labels: boolean;
  checks: boolean;
  measures: boolean;
  bom: boolean;
  /** Étiquettes QR à coller sur le coffret (lien vers le dossier, ou informations en texte). */
  qrLabel?: boolean;
}

export const PAPER: Record<PaperFormat, { w: number; h: number }> = { A4: { w: 297, h: 210 }, A3: { w: 420, h: 297 } };
const PAD = 8; // marge (mm)
const CART_H = 34; // hauteur du cartouche (mm)

interface Ctx {
  project: Project;
  t: (k: string, p?: Record<string, string | number>) => string;
  labelFn: LabelFn;
  numbering: Map<string, string>;
  findings: Finding[];
  /** Mention en filigrane du dossier de réception ou complet (src/rules/knowledge.ts, draftLevel). */
  draft: DraftLevel;
  lang: Lang;
  /** Type de document : travail, dossier de réception, rapport d'anomalies, dossier complet. */
  docKind?: DocKind;
}

export type DocKind = 'working' | 'reception' | 'anomalies' | 'complete';

interface PageDef {
  kind: string;
  body: ReactNode;
  /** Page à découper et coller (étiquettes QR) : pas de filigrane. */
  noWatermark?: boolean;
}

function addr(a?: { street?: string; number?: string; box?: string; postalCode?: string; city?: string }): string {
  if (!a) return '';
  return [[a.street, a.number, a.box ? 'bte ' + a.box : ''].filter(Boolean).join(' '), [a.postalCode, a.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

/** Primitives de l'unifilaire en SVG statique (sans interaction). */
function UnifilarPrims({ prims }: { prims: Prim[] }) {
  return (
    <>
      {prims.map((p, i) => {
        switch (p.t) {
          case 'line':
            return <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} className="wire" style={p.w ? { strokeWidth: p.w } : undefined} />;
          case 'bus':
            return <line key={i} x1={p.x1} y1={p.y} x2={p.x2} y2={p.y} className="bus" />;
          case 'text':
            return (
              <text key={i} x={p.x} y={p.y} fontSize={p.size ?? 10} textAnchor={p.anchor ?? 'start'} className={(p.bold ? 'bold ' : '') + (p.muted ? 'muted' : '')}>
                {p.text}
              </text>
            );
          case 'sym':
            return (
              <g key={i} transform={`translate(${p.x},${p.y})`} className="sym">
                <Symbol node={p.node} orient={p.orient} up={p.up} />
              </g>
            );
        }
      })}
    </>
  );
}

/** Variantes de symboles présentes dans le projet (pour la légende). */
function legendItems(project: Project, t: Ctx['t']): { node: ElNode; text: string; offTable: boolean }[] {
  const seen = new Map<string, { node: ElNode; text: string; offTable: boolean }>();
  const yes = (v: unknown) => v === true;
  // Tous les éléments, y compris ceux posés sur le plan sans être raccordés
  for (const { node: n } of walk([...project.roots, ...project.loose])) {
    if (n.kind === 'cable' || n.kind === 'board') continue;
    const p = n.props;
    let key = n.kind;
    const parts: string[] = [t('kind.' + n.kind)];
    switch (n.kind) {
      case 'socket': {
        const c = Number(p.count) || 1;
        key += `|${c > 1 ? Math.min(c, 4) : 1}|${p.earth !== false}|${p.childSafety !== false}|${yes(p.splashProof)}|${yes(p.threePhase)}`;
        if (c > 1) parts.push(`× ${c}`);
        if (p.earth !== false) parts.push(t('prop.earth').toLowerCase());
        if (p.childSafety !== false) parts.push(t('prop.childSafety').toLowerCase());
        if (yes(p.splashProof)) parts.push(t('prop.splashProof').toLowerCase());
        break;
      }
      case 'switch':
        key += `|${p.switchType}|${yes(p.pilotLight)}|${yes(p.signalLamp)}`;
        parts.push(t('enum.switchType.' + String(p.switchType ?? 'single')).toLowerCase());
        if (yes(p.pilotLight)) parts.push(t('prop.pilotLight').toLowerCase());
        if (yes(p.signalLamp)) parts.push(t('prop.signalLamp').toLowerCase());
        break;
      case 'light':
        key += `|${p.lightType}`;
        parts.push(t('enum.lightType.' + String(p.lightType ?? 'standard')).toLowerCase());
        break;
      case 'appliance':
        key += `|${p.applianceType}`;
        parts.splice(0, 1, t('enum.applianceType.' + String(p.applianceType ?? 'other')));
        break;
      case 'protection':
        key += `|${p.device}|${Number(p.residualCurrent) > 0}`;
        parts.splice(0, 1, t('enum.device.' + String(p.device ?? 'mcb')));
        break;
      case 'relay':
        key += `|${p.relayType}`;
        parts.splice(0, 1, t('enum.relayType.' + String(p.relayType ?? 'relay')));
        break;
      case 'other':
        key += `|${p.otherType ?? ''}|${p.otherType ? '' : p.name ?? ''}`;
        if (p.otherType) parts.splice(0, 1, t('enum.otherType.' + String(p.otherType)));
        else if (p.name) parts.push(String(p.name));
        break;
      case 'detector':
        key += `|${p.detectorType ?? 'motion'}`;
        parts.splice(0, 1, t('enum.detectorType.' + String(p.detectorType ?? 'motion')));
        break;
      case 'bell':
        key += `|${p.bellType ?? 'bell'}`;
        parts.splice(0, 1, t('enum.bellType.' + String(p.bellType ?? 'bell')));
        break;
    }
    // Variantes du dessin (prises avec interrupteur, installé dans un tableau, domotique, bouton protégé…)
    for (const k of ['socketKind', 'inBoard', 'ctlPush', 'ctlWireless', 'ctlTimer', 'ctlDetection', 'ctlExtension', 'protected'] as const) {
      if (n.kind !== 'socket' && n.kind !== 'switch' && n.kind !== 'pushButton') continue;
      const v = p[k];
      if (v === undefined || v === false || v === '') continue;
      key += `|${k}=${String(v)}`;
      parts.push(k === 'socketKind' ? t('enum.socketKind.' + String(v)).toLowerCase() : t('prop.' + k).toLowerCase());
    }
    const abbrText = isOffTable(n) ? abbr(n) : '';
    if (!seen.has(key)) seen.set(key, { node: n, text: (abbrText && abbrText !== '?' ? `${abbrText} : ` : '') + parts.join(', '), offTable: isOffTable(n) });
  }
  return [...seen.values()];
}

/** Cartouche (bas de page). */
function Cartouche({ ctx, title, page, pages }: { ctx: Ctx; title: string; page: number; pages: number }) {
  const { project: p, t } = ctx;
  const m = p.meta;
  const rev = m.revisions?.[m.revisions.length - 1];
  const sign = <div className="sign-box">{t('print.dateSignature')}</div>;
  return (
    <div className="cartouche" style={{ height: CART_H + 'mm' }}>
      <div className="c-col c-doc">
        <div className="c-title">{title}</div>
        {ctx.docKind && <div className="c-kind">{t('print.kind.' + ctx.docKind)}</div>}
        <div>
          {t('print.page')} {page}/{pages}
        </div>
        {/* RGIE 3.1.2 : numéro, version et date de la version */}
        <div>
          {t('print.docNumber')} {m.docNumber?.trim() || '—'}
        </div>
        <div>
          {t('print.version')} {rev?.version ?? '1'} — {rev?.date ?? m.date}
        </div>
        <div className="c-brand">{APP_NAME}</div>
      </div>
      <div className="c-col">
        <div className="c-head">{t('print.installation')}</div>
        <div>{addr(m.site) || '—'}</div>
        {/* RGIE 3.1.2.1 : tension et nature du courant, mentionnées sur le schéma unifilaire (figure 3.1) */}
        <div>
          {t('print.supply')} : {m.supply || '—'}
          {m.mainCurrent ? ` — ${m.mainCurrent} A` : ''} — {t('project.earthing')} {m.earthing}
        </div>
        {m.ean && <div>EAN {m.ean}</div>}
        {m.earthSwitchLocation && (
          <div>
            {t('project.earthSwitch')} : {m.earthSwitchLocation}
          </div>
        )}
      </div>
      <div className="c-col">
        <div className="c-head">{t('project.installer')}</div>
        <div>
          {m.installer?.name || '—'}
          {m.installer?.quality ? ` (${m.installer.quality})` : ''}
        </div>
        {m.installer?.vat && <div>TVA {m.installer.vat}</div>}
        {sign}
      </div>
      <div className="c-col">
        <div className="c-head">{t('project.inspectionBody')}</div>
        <div>{m.inspectionBodyName || ' '}</div>
        {sign}
      </div>
      <div className="c-col">
        <div className="c-head">{t('print.owner')}</div>
        <div>{m.client?.name || '—'}</div>
        <div>{addr(m.client?.address)}</div>
        {sign}
      </div>
    </div>
  );
}

/** Zone de dessin : contenu SVG ajusté (vectoriel). */
function Drawing({ vb, className, children }: { vb: { x: number; y: number; w: number; h: number }; className: string; children: ReactNode }) {
  return (
    <svg className={'canvas ' + className} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid meet">
      {children}
    </svg>
  );
}

export function buildPages(ctx: Ctx, format: PaperFormat, sec: PrintSections): PageDef[] {
  const { project, t, labelFn, numbering } = ctx;
  const paper = PAPER[format];
  const aw = paper.w - 2 * PAD; // mm
  const ah = paper.h - 2 * PAD - CART_H - 4;
  const pages: PageDef[] = [];

  if (sec.unifilar) {
    const lay = layoutUnifilar(project.roots, labelFn, { up: project.meta.unifilarDirection !== 'down' });
    // Échelle : texte de 10 unités ≥ 2 mm imprimés. Sinon, l'unifilaire est découpé sur plusieurs pages.
    const minScale = 0.2;
    const s = Math.min(ah / lay.h, Math.max(minScale, aw / lay.w));
    const tileW = aw / s;
    const n = Math.max(1, Math.ceil((lay.w - 1) / tileW));
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? 0 : i * tileW;
      const vb = n === 1 ? { x: 0, y: 0, w: lay.w, h: lay.h } : { x, y: 0, w: tileW, h: ah / s };
      pages.push({
        kind: n > 1 ? `${t('print.unifilar')} (${i + 1}/${n})` : t('print.unifilar'),
        body: (
          <Drawing vb={vb} className="unifilar">
            <UnifilarPrims prims={lay.prims} />
          </Drawing>
        ),
      });
    }
  }

  if (sec.plan)
    for (const pg of project.plan.pages) {
      if (!pg.walls.length && !pg.symbols.length && !(pg.furniture ?? []).length) continue;
      const b = planBounds(pg, project.plan);
      pages.push({
        kind: `${t('print.plan')} — ${pg.name}`,
        body: (
          <Drawing vb={b} className="plan">
            <Walls page={{ ...pg, images: pg.images.filter((im) => !im.background) }} sel={null} />
            {pg.symbols.map((s) => {
              const node = [...walk(project.roots)].find((w) => w.node.id === s.nodeId)?.node;
              if (!node) return null;
              const ref = numbering.get(node.id);
              return (
                <g key={s.nodeId} transform={`translate(${s.pos.x},${s.pos.y})`}>
                  <g transform={`scale(${S}) rotate(${s.rotation})`}>
                    <PlanSymbol node={node} selected={false} sev={null} />
                  </g>
                  {ref && (
                    <text x={0} y={-S * 16} fontSize={S * 9} textAnchor="middle" className="plan-ref">
                      {ref}
                    </text>
                  )}
                </g>
              );
            })}
          </Drawing>
        ),
      });
    }

  const encs = enclosures(project.roots);
  if (sec.board)
    for (const enc of encs) {
      const size = boardSize(enc.board);
      const { placed: devs } = placed(enc, project.boards?.[enc.board.id]);
      if (!devs.length) continue;
      const W = size.perRow * MOD + 2 * MARGIN;
      const H = rowTop(size.rows - 1) + DEV_H + MARGIN;
      pages.push({
        kind: `${t('print.board')} — ${labelFn.title(enc.board)}`,
        body: (
          <Drawing vb={{ x: 0, y: 0, w: W, h: H }} className="board">
            <rect x={MARGIN - 12} y={rowTop(0) - LABEL_H - 22} width={size.perRow * MOD + 24} height={size.rows * ROW_PITCH} rx={6} className="board-frame" />
            {Array.from({ length: size.rows }).map((_, r) => (
              <g key={r}>
                <rect x={MARGIN - 4} y={rowTop(r) + DEV_H / 2 - 17.5} width={size.perRow * MOD + 8} height={35} className="rail" />
                <rect x={MARGIN} y={rowTop(r) - LABEL_H - 4} width={size.perRow * MOD} height={LABEL_H} className="label-strip" />
              </g>
            ))}
            {devs.map((d) => (
              <g key={d.node.id}>
                <StripLabel x={MARGIN + d.col * MOD} y={rowTop(d.row) - LABEL_H - 4} w={d.width * MOD} text={labelText(d.node, numbering, t)} />
                <g transform={`translate(${MARGIN + d.col * MOD},${rowTop(d.row)})`}>
                  <DeviceFace n={d.node} width={d.width} ref_={numbering.get(d.node.id)} />
                </g>
              </g>
            ))}
          </Drawing>
        ),
      });
    }

  if (sec.circuits) {
    const rows = circuitRows(project, numbering, labelFn);
    const perPage = format === 'A3' ? 30 : 20;
    for (let i = 0; i < Math.max(1, Math.ceil(rows.length / perPage)); i++) {
      pages.push({
        kind: t('print.circuits'),
        body: (
          <table className="print-table">
            <thead>
              <tr>
                <th>{t('print.col.circuit')}</th>
                <th>{t('print.col.name')}</th>
                <th>{t('print.col.protection')}</th>
                <th>{t('print.col.rcd')}</th>
                <th>{t('print.col.cable')}</th>
                <th>{t('print.col.points')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(i * perPage, (i + 1) * perPage).map((r) => (
                <tr key={r.id}>
                  <td className="b">{r.letter}</td>
                  <td>{r.name}</td>
                  <td>{r.protection}</td>
                  <td>{r.rcd || '—'}</td>
                  <td>{r.cable || '—'}</td>
                  <td>{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ),
      });
    }
  }

  if (sec.legend) {
    const items = legendItems(project, t);
    pages.push({
      kind: t('print.legend'),
      body: (
        <div className="legend-grid">
          {[...items.filter((x) => !x.offTable), ...items.filter((x) => x.offTable)].map((it, i, all) => {
            const orient = ['protection', 'meter', 'origin', 'earth', 'earthBar'].includes(it.node.kind) ? 'v' : 'h';
            const sz = symbolSize(it.node, orient);
            const vb = orient === 'v' ? `${-sz.w / 2 - 4} -2 ${sz.w + 8} ${sz.h + 4}` : `-2 ${-sz.h / 2 - 4} ${sz.w + 8} ${sz.h + 8}`;
            return (
              <div key={i} className={'legend-item' + (it.offTable && (i === 0 || !all[i - 1].offTable) ? ' legend-offtable-first' : '')} data-offtable={it.offTable ? t('print.legendOffTable') : undefined}>
                <svg className="canvas unifilar" viewBox={vb} style={{ width: '14mm', height: '9mm' }}>
                  <g className="sym">
                    <Symbol node={it.node} orient={orient} />
                  </g>
                </svg>
                <span>{it.text}</span>
              </div>
            );
          })}
          <p className="legend-note">{t('print.legendNote')}</p>
        </div>
      ),
    });
  }

  if (sec.labels)
    for (const enc of encs) {
      const size = boardSize(enc.board);
      const { placed: devs } = placed(enc, project.boards?.[enc.board.id]);
      if (!devs.length) continue;
      // Échelle 1:1 : 1 unité = 1 mm sur le papier
      const LH = 12;
      pages.push({
        kind: `${t('print.labels')} — ${labelFn.title(enc.board)}`,
        body: (
          <svg viewBox={`0 0 ${aw} ${ah}`} style={{ width: aw + 'mm', height: ah + 'mm' }} className="labels-sheet">
            <text x={0} y={5} fontSize={3}>
              {t('print.labelsHelp')}
            </text>
            {Array.from({ length: size.rows }).map((_, r) => (
              <g key={r} transform={`translate(0,${10 + r * (LH + 8)})`}>
                <rect x={0} y={0} width={size.perRow * MOD} height={LH} className="lbl-row" />
                {devs
                  .filter((d) => d.row === r)
                  .map((d) => (
                    <g key={d.node.id} transform={`translate(${d.col * MOD},0)`}>
                      <rect x={0} y={0} width={d.width * MOD} height={LH} className="lbl-cell" />
                      <text x={(d.width * MOD) / 2} y={4.6} fontSize={3.4} textAnchor="middle" fontWeight={700}>
                        {numbering.get(d.node.id) ?? ''}
                      </text>
                      <text x={(d.width * MOD) / 2} y={8.6} fontSize={Math.min(2.6, (d.width * MOD) / 7)} textAnchor="middle">
                        {fit(labelText(d.node, numbering, t, true), d.width * 6)}
                      </text>
                    </g>
                  ))}
              </g>
            ))}
          </svg>
        ),
      });
    }

  if (sec.qrLabel) {
    const m = project.meta;
    const payload = qrLabelPayload(m, t);
    const linked = isHttpsUrl(m.dossierUrl);
    const site = [[m.site?.street, m.site?.number].filter(Boolean).join(' '), [m.site?.postalCode, m.site?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    // 4 étiquettes de 90 × 55 mm (format carte de visite, à découper et coller dans la porte du coffret)
    pages.push({
      kind: t('print.qrLabel'),
      noWatermark: true,
      body: (
        <div className="qr-labels">
          <p className="legend-note">{t(linked ? 'print.qrLabelHelpLink' : 'print.qrLabelHelpText')}</p>
          <div className="qr-grid">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="qr-label">
                <div className="qr-label-code">
                  <QrCode text={payload} size="100%" label={t('print.qrLabel')} />
                </div>
                <div className="qr-label-text">
                  <strong>{t('print.qrLabelTitle')}</strong>
                  <div>{site || '—'}</div>
                  <div>
                    {t('print.docNumber')} {m.docNumber?.trim() || '—'}
                  </div>
                  <div>{[m.installer?.name, m.installer?.phone].filter(Boolean).join(' — ') || '—'}</div>
                  <div className="qr-label-scan">{t(linked ? 'print.qrLabelScanLink' : 'print.qrLabelScanText')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }

  if (sec.measures) {
    const m = project.measurements;
    const okKo = (ok: boolean | undefined) => (ok === undefined ? '—' : ok ? t('meas.ok') : t('meas.ko'));
    const rows: [string, string, string, string][] = [
      [t('project.earthResistance'), m.earthResistanceOhm !== undefined ? `${m.earthResistanceOhm} Ω` : '—', t('meas.earthRequirement', { max: EARTH_MAX.value, extra: EARTH_EXTRA_MEASURES_ABOVE.value }), m.earthResistanceOhm === undefined ? '—' : okKo(m.earthResistanceOhm < EARTH_MAX.value)],
      [t('project.insulation'), m.insulationMOhm !== undefined ? `${m.insulationMOhm} MΩ` : '—', `≥ ${String(INSULATION_MIN.value).replace('.', ',')} MΩ`, m.insulationMOhm === undefined ? '—' : okKo(m.insulationMOhm >= INSULATION_MIN.value)],
      [t('project.bonding'), '', '', okKo(m.bondingOk)],
    ];
    const covered = (r: ElNode) => {
      const l = [...walk(r.children)].filter((w) => w.node.kind === 'protection' && numbering.get(w.node.id)).map((w) => numbering.get(w.node.id)!);
      return l.length ? ` (${l.length > 3 ? `${l[0]}–${l[l.length - 1]}` : l.join(', ')})` : '';
    };
    for (const { node } of walk(project.roots)) {
      if (node.kind !== 'protection' || !(Number(node.props.residualCurrent) > 0)) continue;
      const test = m.rcdTests?.[node.id];
      const max = String(node.props.rcdType ?? '').toUpperCase().includes('S') ? RCD_TRIP_MAX.value.selective : RCD_TRIP_MAX.value.general;
      rows.push([
        `${t('meas.rcd')} ${node.props.ratedCurrent ? node.props.ratedCurrent + ' A ' : ''}${node.props.residualCurrent} mA${node.props.rcdType ? ' ' + node.props.rcdType : ''}${covered(node)}`,
        test?.tripMs !== undefined ? `${test.tripMs} ms` : '—',
        `≤ ${max} ms`,
        okKo(test?.ok ?? (test?.tripMs !== undefined ? test.tripMs <= max : undefined)),
      ]);
    }
    pages.push({
      kind: t('print.measures'),
      body: (
        <div style={{ width: '100%', alignSelf: 'flex-start' }}>
          <table className="print-table">
            <thead>
              <tr>
                <th>{t('print.meas.item')}</th>
                <th>{t('print.meas.value')}</th>
                <th>{t('print.meas.limit')}</th>
                <th>{t('print.meas.result')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="legend-note">
            {[m.measuredOn && `${t('project.measuredOn')} : ${m.measuredOn}`, m.instrument && `${t('project.instrument')} : ${m.instrument}`].filter(Boolean).join(' — ')}
          </p>
          <p className="legend-note">{t('print.meas.note')}</p>
        </div>
      ),
    });
  }

  if (sec.bom) {
    const lines = billOfMaterials(project, numbering, ctx.lang, t, getRulePack(project.meta.ruleset).equivalents);
    const perPage = format === 'A3' ? 26 : 16;
    for (let i = 0; i < Math.max(1, Math.ceil(lines.length / perPage)); i++)
      pages.push({
        kind: t('print.bom'),
        body: (
          <div>
            <BomTable lines={lines.slice(i * perPage, (i + 1) * perPage)} compact />
            {i === 0 && <p className="legend-note">{t('bom.help', { country: getRulePack(project.meta.ruleset).country })}</p>}
          </div>
        ),
      });
  }

  if (sec.checks && ctx.findings.length) {
    // Tous les constats, sur autant de pages que nécessaire : « Exigences de l'installation » puis « Exigences
    // documentaires » (ADR-0007 : une lacune du dossier n'est jamais présentée comme une non-conformité physique),
    // bloquants d'abord, puis par statut ; l'état de connaissance (inconnu, déduit, contradictoire…) est indiqué.
    const rows = findingRows(ctx.findings);
    const per = format === 'A3' ? 34 : 22;
    for (let i = 0; i < rows.length; i += per)
      pages.push({
        kind: t('print.checks'),
        body: (
          <>
            <p className="print-note">
              {t('check.disclaimer')} {t('check.liability')}
            </p>
            <table className="print-table">
              <tbody>
                {rows.slice(i, i + per).map((r, j) =>
                  r.head ? (
                    <tr key={j}>
                      <td colSpan={4} className="b">
                        {t('requirement.' + r.head)}
                        {r.head === 'documentary' && <span className="small"> — {t('requirement.documentary.help')}</span>}
                      </td>
                    </tr>
                  ) : (
                    <tr key={j}>
                      <td className="b">
                        {t('status.' + (r.f.status ?? 'warning'))}
                        {blockingText(r.f, t)}
                        {knowledgeText(r.f, t) && <div className="small">{knowledgeText(r.f, t)}</div>}
                      </td>
                      <td>{r.f.nodeId ? numbering.get(r.f.nodeId) ?? '' : ''}</td>
                      <td>
                        {ruleText(r.f, t)}
                        {r.f.derogation ? ' — ' + t('status.derogation') + ' : ' + r.f.derogation.reason + (r.f.derogation.reference ? ' (' + r.f.derogation.reference + ')' : '') : ''}
                      </td>
                      <td className="small">{r.f.ruleId}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </>
        ),
      });
  }
  return pages;
}

/** Lignes de la page des constats : titre de groupe (exigences de l'installation / documentaires) puis constats triés. */
export function findingRows(findings: Finding[]): ({ head: 'physical' | 'documentary'; f?: undefined } | { head?: undefined; f: Finding })[] {
  const sorted = [...findings].sort((a, b) => findingRank(a) - findingRank(b));
  const out: ({ head: 'physical' | 'documentary'; f?: undefined } | { head?: undefined; f: Finding })[] = [];
  for (const head of ['physical', 'documentary'] as const) {
    const list = sorted.filter((f) => isDocumentary(f) === (head === 'documentary'));
    if (!list.length) continue;
    out.push({ head });
    for (const f of list) out.push({ f });
  }
  return out;
}

function labelText(n: ElNode, numbering: Map<string, string>, t: Ctx['t'], nameOnly = false): string {
  if (n.props.circuitName) return nameOnly ? String(n.props.circuitName) : [numbering.get(n.id), String(n.props.circuitName)].filter(Boolean).join(' ');
  if (Number(n.props.residualCurrent) > 0) return `${t('label.diff')} ${n.props.residualCurrent} mA`;
  return nameOnly ? '' : numbering.get(n.id) ?? '';
}

/** Texte de la bande d'étiquettes, coupé sur 2 lignes à la largeur de l'appareil (jamais sur le voisin). */
export function stripLines(text: string, widthMm: number, font: number): string[] {
  const max = Math.max(3, Math.floor((widthMm - 1) / (font * 0.56)));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const cand = cur ? cur + ' ' + w : w;
    if (cand.length <= max) cur = cand;
    else {
      if (cur) lines.push(cur);
      cur = w.length > max ? w.slice(0, max) : w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > 2) lines.splice(1, lines.length - 1, (lines.slice(1).join(' ').slice(0, max - 1) + '…'));
  return lines.map((l) => (l.length > max ? l.slice(0, max - 1) + '…' : l));
}

function StripLabel({ x, y, w, text }: { x: number; y: number; w: number; text: string }) {
  const font = Math.min(5.5, w / 3.2);
  const lines = stripLines(text, w, font);
  const top = y + (LABEL_H - lines.length * font * 1.1) / 2 + font * 0.85;
  return (
    <text x={x + w / 2} y={top} fontSize={font} textAnchor="middle" className="label-text">
      {lines.map((l, i) => (
        <tspan key={i} x={x + w / 2} dy={i ? font * 1.1 : 0}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

function fit(s: string, max: number) {
  return s.length > max ? s.slice(0, Math.max(1, max - 1)) + '…' : s;
}

export function PrintDocument({ ctx, format, sections }: { ctx: Ctx; format: PaperFormat; sections: PrintSections }) {
  const paper = PAPER[format];
  const pages = buildPages(ctx, format, sections);
  const pageStyle: CSSProperties = { width: paper.w + 'mm', height: paper.h + 'mm', padding: PAD + 'mm' };
  return (
    <div className="print-doc">
      {pages.map((pg, i) => (
        <section key={i} className="print-page" style={pageStyle}>
          <div className="print-body">{pg.body}</div>
          {pg.noWatermark ? null : ctx.draft !== 'none' ? (
            <div className={'watermark' + (ctx.draft === 'nonCompliant' ? '' : ' light')}>{ctx.t(DRAFT_KEYS[ctx.draft])}</div>
          ) : (
            ctx.docKind === 'working' && <div className="watermark light">{ctx.t('print.workingDoc')}</div>
          )}
          <Cartouche ctx={ctx} title={pg.kind} page={i + 1} pages={pages.length} />
        </section>
      ))}
    </div>
  );
}
