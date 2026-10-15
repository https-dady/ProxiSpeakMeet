
/**
 * Short legend explaining the spatial-audio rules shown on the canvas.
 *
 * UI-only refinement:
 * - Preserves the live earshot radius from world state.
 * - Preserves the existing spatial-audio meanings and colours.
 * - Does not modify audio processing or canvas rendering.
 */

import { useProxi } from '../state/ProxiContext.jsx';

const LEGEND_ITEMS = [
  {
    color: '#78c8ff',
    title: 'Full volume',
    description: 'Full volume inside 35px',
    variant: 'legend__item--full',
  },
  {
    color: '#4f8cff',
    title: 'Distance fall-off',
    description: 'Smooth fall-off to silence at',
    variant: 'legend__item--distance',
  },
  {
    color: '#5ad19a',
    title: 'Speaking',
    description: 'Green halo indicates a speaking peer',
    variant: 'legend__item--speaking',
  },
  {
    color: '#ff8c78',
    title: 'Sound obstruction',
    description: 'Dashed link means furniture blocks the voice',
    variant: 'legend__item--blocked',
  },
];

export function SoundLegend() {
  const { worldRef } = useProxi();
  const earshot = worldRef.current.earshotRadiusPx;

  return (
    <section className="panel legend">
      <header className="panel__header legend__header">
        <div className="legend__heading">
          <span className="legend__eyebrow">HOW IT WORKS</span>
          <h2>Spatial audio</h2>
        </div>

        <span className="legend__badge">LIVE WORLD</span>
      </header>

      <ul className="legend__list">
        {LEGEND_ITEMS.map((item, index) => (
          <li
            key={item.variant}
            className={`legend__item ${item.variant}`}
          >
            <span
              className="legend__marker"
              style={{ '--legend-color': item.color }}
              aria-hidden="true"
            >
              <span />
            </span>

            <div className="legend__content">
              <strong>{item.title}</strong>

              <span>
                {item.description}
                {index === 1 ? ` ${earshot}px` : ''}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="legend__footnote">
        <span className="legend__footnote-dot" aria-hidden="true" />
        Move closer to hear conversations more clearly.
      </div>
    </section>
  );
}

export default SoundLegend;
