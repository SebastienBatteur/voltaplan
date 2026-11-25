import { useStore } from '../store';
import { useDerived } from './derived';
import { findNode } from '../model/tree';
import { circuitLegend, setCircuitColors, useCircuitColorsOn, type CircuitColor } from './circuitColors';

/** Bouton « Couleurs des circuits » (même réglage pour le plan et l'unifilaire). */
export function CircuitColorsToggle() {
  const t = useStore((s) => s.t);
  const on = useCircuitColorsOn();
  return (
    <button aria-pressed={on} className={on ? 'active' : ''} onClick={() => setCircuitColors(!on)} title={t('circuits.colorsHelp')}>
      {t('circuits.colors')}
    </button>
  );
}

/** Légende : lettre et nom de chaque circuit, avec sa couleur. */
export function CircuitLegend({ map }: { map: Map<string, CircuitColor> }) {
  const project = useStore((s) => s.project);
  const select = useStore((s) => s.select);
  const t = useStore((s) => s.t);
  const { numbering } = useDerived();
  const items = circuitLegend(project.roots, map);
  if (!items.length) return null;
  return (
    <ul className="circuit-legend" aria-label={t('circuits.legend')}>
      {items.map(({ id, color }) => {
        const n = findNode(project.roots, id);
        const name = String(n?.props.circuitName ?? '').trim();
        return (
          <li key={id}>
            <button onClick={() => select(id)} title={name || undefined}>
              <span className="swatch" style={{ background: color }} aria-hidden="true" />
              <strong>{numbering.get(id) ?? '?'}</strong>
              {name && <span className="muted"> {name}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
