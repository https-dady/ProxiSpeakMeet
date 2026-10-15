/**
 * Who is around me right now.
 *
 * UI-only refinement:
 * - Preserves live spatial-audio calculations.
 * - Preserves distance, gain, stereo pan and audio-level data.
 * - Preserves speaking, muted and obstruction indicators.
 * - Does not modify WebRTC, Socket.IO or world movement behavior.
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

      const pan = panAtDistance({
        dx,
        dy,
        distancePx,
        listenerAngle: self.angle,
        earshotPx: world.earshotRadiusPx,
      });

      return {
        peer,
        distancePx,
        gain,
        pan,
        soundFactor,
        level: audioRef.current?.getLevel(peer.id) ?? 0,
      };
    })
    .sort((a, b) => b.gain - a.gain || a.distancePx - b.distancePx);

  const inEarshot = rows.filter(
    (row) => row.distancePx <= world.earshotRadiusPx
  ).length;

  return (
    <section className="panel peers">
      <header className="panel__header">
        <div className="peers__heading">
          <span className="peers__eyebrow">LIVE CONNECTIONS</span>
          <h2>Nearby</h2>
        </div>

        <span
          className="panel__meta peers__count"
          aria-label={`${inEarshot} of ${rows.length} peers in earshot`}
        >
          <span className="peers__count-dot" aria-hidden="true" />
          {inEarshot}/{rows.length} in earshot · {world.earshotRadiusPx}px
        </span>
      </header>

      {rows.length === 0 && (
        <div className="panel__empty peers__empty">
          <span className="peers__empty-icon" aria-hidden="true">
            ◌
          </span>
          <strong>Nobody nearby yet</strong>
          <span>Nobody else is in this room yet.</span>
        </div>
      )}

      <ul className="peers__list">
        {rows.map(({ peer, distancePx, gain, pan, soundFactor, level }) => (
          <li
            key={peer.id}
            className={`peer${gain > 0 ? ' peer--live' : ''}`}
          >
            <span
              className="peer__avatar"
              style={{ background: peer.color }}
              aria-hidden="true"
            />

            <div className="peer__body">
              <div className="peer__title">
                <span className="peer__name">{peer.name}</span>

                {peer.micEnabled === false && (
                  <span className="chip chip--muted">muted</span>
                )}

                {soundFactor < 0.5 && (
                  <span className="chip chip--blocked">
                    through a wall
                  </span>
                )}

                {peer.speaking && (
                  <span className="chip chip--speaking">speaking</span>
                )}
              </div>

              <div
                className="peer__meter"
                role="img"
                aria-label={`Spatial gain ${Math.round(
                  gain * 100
                )} percent; audio level ${Math.round(
                  Math.min(100, level * 400)
                )} percent`}
              >
                <div
                  className="peer__gain"
                  style={{ width: `${Math.round(gain * 100)}%` }}
                />

                <div
                  className="peer__level"
                  style={{ width: `${Math.min(100, level * 400)}%` }}
                />
              </div>
            </div>

            <div className="peer__numbers">
              <span title="Distance from you">
                {Math.round(distancePx)}px
              </span>

              <span title="Stereo position">
                {pan > 0.05
                  ? `R ${Math.round(pan * 100)}%`
                  : pan < -0.05
                    ? `L ${Math.round(-pan * 100)}%`
                    : 'C'}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default PeerList;
