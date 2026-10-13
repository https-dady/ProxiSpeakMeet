/** Short legend explaining the spatial-audio rules shown on the canvas. */
import { useProxi } from '../state/ProxiContext.jsx';

export function SoundLegend() {
  const { worldRef } = useProxi();
  const earshot = worldRef.current.earshotRadiusPx;

  return (
    <section className="panel legend">
      <header className="panel__header">
        <h2>Spatial audio</h2>
      </header>
      <ul className="legend__list">
        <li>
          <span className="swatch-dot" style={{ background: '#78c8ff' }} /> full volume inside 35px
        </li>
        <li>
          <span className="swatch-dot" style={{ background: '#4f8cff' }} /> smooth fall-off to silence at {earshot}px
        </li>
        <li>
          <span className="swatch-dot" style={{ background: '#5ad19a' }} /> green halo = peer is speaking
        </li>
        <li>
          <span className="swatch-dot" style={{ background: '#ff8c78' }} /> dashed link = voice blocked by furniture
        </li>
      </ul>
    </section>
  );
}

export default SoundLegend;