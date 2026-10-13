/**
 * Who is around me right now.
 *
 * Each row shows the live spatial-audio state: distance, the gain the mixer is
 * actually applying, which ear the voice sits in, and whether furniture is
 * blocking it.
 */
import { useProxi } from '../state/ProxiContext.jsx';
import { useUiTick } from '../hooks/useUiTick.js';
import { gainAtDistance, panAtDistance } from '../audio/spatialMath.js';

export function PeerList() {
  const { state, worldRef, audioRef } = useProxi();
  useUiTick(200);

  const world = worldRef.current;
  const self = world.self;
  const rows = [...world.peers.values()]
    .map((peer) => {
      const dx = peer.x - self.x;
      const dy = peer.y - self.y;
      const distancePx = Math.hypot(dx, dy);
      const soundFactor = peer.soundFactor ?? 1;
      const gain = gainAtDistance(distancePx, {
        earshotPx: world.earshotRadiusPx,
        fullVolumePx: 35,
        soundFactor,
      });
      const pan = panAtDistance({ dx, dy, distancePx, listenerAngle: self.angle, earshotPx: world.earshotRadiusPx });
      return { peer, distancePx, gain, pan, soundFactor, level: audioRef.current?.getLevel(peer.id) ?? 0 };
    })
    .sort((a, b) => b.gain - a.gain || a.distancePx - b.distancePx);

  const inEarshot = rows.filter((row) => row.distancePx <= world.earshotRadiusPx).length;

  return (
    <section className="panel peers">
      <header className="panel__header">
        <h2>Nearby</h2>
        <span className="panel__meta">
          {inEarshot}/{rows.length} in earshot · {world.earshotRadiusPx}px
        </span>
      </header>

      {rows.length === 0 && <p className="panel__empty">Nobody else is in this room yet.</p>}

      <ul className="peers__list">
        {rows.map(({ peer, distancePx, gain, pan, soundFactor, level }) => (
          <li key={peer.id} className={`peer${gain > 0 ? ' peer--live' : ''}`}>
            <span className="peer__avatar" style={{ background: peer.color }} />
            <div className="peer__body">
              <div className="peer__title">
                <span className="peer__name">{peer.name}</span>
                {peer.micEnabled === false && <span className="chip chip--muted">muted</span>}
                {soundFactor < 0.5 && <span className="chip chip--blocked">through a wall</span>}
                {peer.speaking && <span className="chip chip--speaking">speaking</span>}
              </div>
              <div className="peer__meter">
                <div className="peer__gain" style={{ width: `${Math.round(gain * 100)}%` }} />
                <div className="peer__level" style={{ width: `${Math.min(100, level * 400)}%` }} />
              </div>
            </div>
            <div className="peer__numbers">
              <span title="distance">{Math.round(distancePx)}px</span>
              <span title="stereo position">
                {pan > 0.05 ? `R ${Math.round(pan * 100)}%` : pan < -0.05 ? `L ${Math.round(-pan * 100)}%` : 'C'}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default PeerList;