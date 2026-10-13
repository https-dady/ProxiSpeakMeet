/** Connection status, instance routing and frame-rate readout. */
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
  const inEarshot = peers.filter((peer) => Math.hypot(peer.x - world.self.x, peer.y - world.self.y) <= world.earshotRadiusPx).length;

  return (
    <header className="statusbar">
      <div className="statusbar__left">
        <span className={`dot dot--${state.status}`} />
        <strong>{LABELS[state.status] ?? state.status}</strong>
        {state.statusDetail && <span className="statusbar__detail">{state.statusDetail}</span>}
      </div>

      <div className="statusbar__stats">
        <span title="Avatars in the office">{peers.length} peers</span>
        <span title="Peers inside the 100px earshot radius">{inEarshot} in earshot</span>
        <span title="requestAnimationFrame rate">{world.fps ?? 0} FPS</span>
        <span title="Instance handling this socket">{state.server.instanceId || 'n/a'}</span>
        <span className={`badge badge--${state.server.scaleMode || 'single'}`}>{state.server.scaleMode || 'single'}</span>
      </div>

      <div className="statusbar__right">
        <label className="volume" title="Master output volume">
          <span aria-hidden>🔊</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={state.masterVolume}
            onChange={(event) => setVolume(Number(event.target.value))}
          />
        </label>
        <button className={`button button--toggle${state.muted ? ' button--active' : ''}`} onClick={toggleMute}>
          {state.muted ? 'Unmute' : 'Mute'}
        </button>
        <button className="button" onClick={leave}>
          Leave
        </button>
      </div>
    </header>
  );
}

export default StatusBar;