/**
 * ProxiSpeak — Status Bar
 *
 * UI-only refinement.
 *
 * LOCKED:
 * - Connection status logic
 * - Peer and earshot calculations
 * - FPS and server instance reporting
 * - Volume control behavior
 * - Mute and Leave actions
 * - ProxiContext integration
 */

import { useProxi } from '../state/ProxiContext.jsx';
import { useUiTick } from '../hooks/useUiTick.js';

const LABELS = {
  idle: 'idle',
  connecting: 'connecting…',
  online: 'connected',
  reconnecting: 'reconnecting…',
  error: 'connection error',
};

export function StatusBar() {
  const { state, worldRef, leave, toggleMute, setVolume } = useProxi();

  useUiTick(500);

  const world = worldRef.current;
  const peers = [...world.peers.values()];

  const inEarshot = peers.filter(
    (peer) =>
      Math.hypot(peer.x - world.self.x, peer.y - world.self.y) <=
      world.earshotRadiusPx
  ).length;

  const connectionLabel = LABELS[state.status] ?? state.status;

  return (
    <header className="statusbar">
      <div className="statusbar__left">
        <span
          className={`dot dot--${state.status}`}
          aria-hidden="true"
        />

        <strong
          className="statusbar__connection"
          aria-live="polite"
        >
          {connectionLabel}
        </strong>

        {state.statusDetail && (
          <span className="statusbar__detail">
            {state.statusDetail}
          </span>
        )}
      </div>

      <div
        className="statusbar__stats"
        aria-label="Workspace statistics"
      >
        <span
          className="statusbar__stat"
          title="Avatars in the office"
        >
          {peers.length} peers
        </span>

        <span
          className="statusbar__stat"
          title="Peers inside the 100px earshot radius"
        >
          {inEarshot} in earshot
        </span>

        <span
          className="statusbar__stat"
          title="requestAnimationFrame rate"
        >
          {world.fps ?? 0} FPS
        </span>

        <span
          className="statusbar__stat"
          title="Instance handling this socket"
        >
          {state.server.instanceId || 'n/a'}
        </span>

        <span
          className={`badge badge--${state.server.scaleMode || 'single'}`}
        >
          {state.server.scaleMode || 'single'}
        </span>
      </div>

      <div className="statusbar__right">
        <label
          className="volume"
          title="Master output volume"
        >
          <span aria-hidden="true">🔊</span>

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={state.masterVolume}
            onChange={(event) =>
              setVolume(Number(event.target.value))
            }
            aria-label="Master output volume"
          />
        </label>

        <button
          type="button"
          className={`button button--toggle${
            state.muted ? ' button--active' : ''
          }`}
          onClick={toggleMute}
        >
          {state.muted ? 'Unmute' : 'Mute'}
        </button>

        <button
          type="button"
          className="button"
          onClick={leave}
        >
          Leave
        </button>
      </div>
    </header>
  );
}

export default StatusBar;