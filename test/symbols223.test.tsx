/**
 * Symboles du tableau 2.23 du RGIE : chaque variante proposée se dessine, sur l'unifilaire et sur le plan, et les
 * variantes ajoutées se distinguent bien du symbole de base (dessin différent).
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PROP_SCHEMAS } from '../src/model/schema';
import { createNode } from '../src/model/tree';
import type { NodeKind, PropValue } from '../src/model/types';
import { abbr, isOffTable, Symbol, symbolSize } from '../src/unifilar/symbols';

const draw = (kind: NodeKind, props: Record<string, PropValue> = {}, bare?: boolean) =>
  renderToStaticMarkup(
    <svg>
      <Symbol node={createNode(kind, props)} orient="h" bare={bare} />
    </svg>,
  );

describe('symboles du tableau 2.23', () => {
  it('chaque option de chaque type se dessine (unifilaire et plan)', () => {
    for (const [kind, defs] of Object.entries(PROP_SCHEMAS) as [NodeKind, typeof PROP_SCHEMAS.socket][]) {
      for (const d of defs ?? []) {
        const values: PropValue[] = d.type === 'enum' ? (d.options ?? []) : d.type === 'bool' ? [true] : [];
        for (const v of values) {
          expect(() => draw(kind, { [d.key]: v }), `${kind}.${d.key}=${String(v)}`).not.toThrow();
          expect(() => draw(kind, { [d.key]: v }, true)).not.toThrow();
          expect(() => renderToStaticMarkup(<svg><Symbol node={createNode(kind, { [d.key]: v })} orient="v" /></svg>)).not.toThrow();
        }
      }
    }
  });

  it('les variantes ajoutées ont un dessin propre', () => {
    const cases: [NodeKind, Record<string, PropValue>][] = [
      ['switch', { switchType: 'tripolar' }],
      ['switch', { switchType: 'twoWayBipolar' }],
      ['switch', { switchType: 'delayed' }],
      ['pushButton', { protected: true }],
      ['relay', { relayType: 'timeSwitch' }],
      ['relay', { relayType: 'thermostat' }],
      ['relay', { relayType: 'lockControl' }],
      ['socket', { socketKind: 'switched' }],
      ['socket', { socketKind: 'switchedLocked' }],
      ['socket', { socketKind: 'shaver' }],
      ['light', { lightType: 'floodNarrow' }],
      ['light', { lightType: 'floodWide' }],
      ['light', { lightType: 'withSwitch' }],
      ['light', { lightType: 'emergencyUnit' }],
      ['light', { lightType: 'auxiliary' }],
      ['bell', { bellType: 'buzzer' }],
      ['bell', { bellType: 'horn' }],
      ['bell', { bellType: 'siren' }],
      ['other', { otherType: 'clock' }],
      ['other', { otherType: 'masterClock' }],
      ['other', { otherType: 'doorStrike' }],
      ['other', { otherType: 'dataOutlet' }],
      ['appliance', { applianceType: 'electricWaterHeater' }],
      ['appliance', { applianceType: 'storageHeater' }],
      ['appliance', { applianceType: 'storageHeaterFan' }],
      ['switch', { inBoard: true }],
      ['socket', { ctlPush: true, ctlTimer: true, ctlExtension: true }],
    ];
    for (const [kind, props] of cases) expect(draw(kind, props), `${kind} ${JSON.stringify(props)}`).not.toBe(draw(kind));
  });

  it('unité de commande domotique : plus haute, extension à droite', () => {
    const base = symbolSize(createNode('switch'), 'h');
    const dom = symbolSize(createNode('switch', { ctlWireless: true, ctlExtension: true }), 'h');
    expect(dom.h).toBeGreaterThan(base.h);
    expect(dom.w).toBeGreaterThan(base.w);
  });

  it('caractéristiques des sources sur l’unifilaire seulement (pas sur le plan)', () => {
    const inv = createNode('inverter', { power: 5000 });
    const uni = renderToStaticMarkup(<svg><Symbol node={inv} orient="h" /></svg>);
    const plan = renderToStaticMarkup(<svg><Symbol node={inv} orient="h" bare /></svg>);
    expect(uni).toContain('Pmax 5000 W');
    expect(plan).not.toContain('Pmax');
    expect(renderToStaticMarkup(<svg><Symbol node={createNode('transformer', { uPrimary: 230, uSecondary: 12, power: 60 })} orient="h" /></svg>)).toContain('230/12 V');
  });

  it('symboles hors tableau 2.23 : abréviation dans un cadre, repérés pour la légende', () => {
    const cases: [NodeKind, Record<string, PropValue>, string][] = [
      ['appliance', { applianceType: 'airConditioner' }, 'AC'],
      ['appliance', { applianceType: 'hood' }, 'HT'],
      ['other', { otherType: 'tvOutlet' }, 'TV'],
      ['other', { otherType: 'emergencyStop' }, 'AU'],
      ['other', { otherType: 'alarmPanel' }, 'CA'],
      ['detector', { detectorType: 'smoke' }, 'DF'],
    ];
    for (const [kind, props, ab] of cases) {
      const n = createNode(kind, props);
      expect(isOffTable(n), `${kind} ${JSON.stringify(props)}`).toBe(true);
      expect(abbr(n)).toBe(ab);
      expect(draw(kind, props)).toContain(ab);
    }
    // Symboles du tableau : pas dans la partie « hors tableau »
    expect(isOffTable(createNode('appliance', { applianceType: 'washingMachine' }))).toBe(false);
    expect(isOffTable(createNode('detector', { detectorType: 'motion' }))).toBe(false);
    expect(isOffTable(createNode('other', { otherType: 'clock' }))).toBe(false);
  });
});
