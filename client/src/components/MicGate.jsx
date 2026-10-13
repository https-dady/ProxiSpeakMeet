/**
 * Join gate (Week 1 + mic-permission UX).
 *
 * Microphone access is requested inside the click handler so it is a genuine
 * user gesture, and a denial is explained in plain language with a retry and a
 * listen-only escape hatch.
 */
import { useState } from 'react';
import { useProxi } from '../state/ProxiContext.jsx';
import config from '../config.js';

const AVATARS = ['circle', 'square', 'triangle', 'hex'];

export function MicGate() {
  const { state, join, requestMicrophone } = useProxi();
  const [roomId, setRoomId] = useState(config.defaultRoom);
  const [name, setName] = useState(() => localStorage.getItem('proxispeak:name') ?? '');
  const [color, setColor] = useState(() => localStorage.getItem('proxispeak:color') ?? '#4f8cff');
  const [avatar, setAvatar] = useState('circle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const busyState = busy || state.status === 'connecting';

  const doJoin = async (withMic) => {
    setBusy(true);
    setError(null);
    localStorage.setItem('proxispeak:name', name);
    localStorage.setItem('proxispeak:color', color);
    try {
      if (withMic) await requestMicrophone();
      await join({ roomId, name, color, avatar, withMic });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gate">
      <form
        className="gate__card"
        onSubmit={(event) => {
          event.preventDefault();
          void doJoin(true);
        }}
      >
        <h1 className="gate__title">ProxiSpeak</h1>
        <p className="gate__subtitle">
          A virtual office where audio is spatial: walk closer to hear people, walk away to lose them.
        </p>

        <label className="field">
          <span>Your name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ada Lovelace"
            maxLength={24}
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span>Room</span>
          <input value={roomId} onChange={(event) => setRoomId(event.target.value.toLowerCase())} maxLength={48} />
        </label>

        <div className="field">
          <span>Colour</span>
          <div className="gate__swatches">
            {['#4f8cff', '#ff6b6b', '#ffd166', '#5ad19a', '#c77dff', '#ff9f45'].map((swatch) => (
              <button
                key={swatch}
                type="button"
                className={`swatch${color === swatch ? ' swatch--active' : ''}`}
                style={{ background: swatch }}
                onClick={() => setColor(swatch)}
                aria-label={`colour ${swatch}`}
              />
            ))}
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="custom colour" />
          </div>
        </div>

        <div className="field">
          <span>Shape</span>
          <div className="gate__avatars">
            {AVATARS.map((shape) => (
              <button
                key={shape}
                type="button"
                className={`shape shape--${shape}${avatar === shape ? ' shape--active' : ''}`}
                onClick={() => setAvatar(shape)}
                aria-label={`avatar ${shape}`}
              />
            ))}
          </div>
        </div>

        {state.mic.error && <div className="alert alert--error">{state.mic.error}</div>}
        {error && <div className="alert alert--error">{error}</div>}

        <div className="gate__actions">
          <button type="submit" className="button button--primary" disabled={busyState}>
            {busyState ? 'Connecting…' : 'Join with microphone'}
          </button>
          <button type="button" className="button" disabled={busyState} onClick={() => doJoin(false)}>
            Listen only
          </button>
        </div>

        <p className="gate__note">
          Audio is peer-to-peer (WebRTC) and never touches the server. The server only relays the
          handshake for people inside your {state.room?.width ?? 1920}px office radius.
        </p>
      </form>
    </div>
  );
}

export default MicGate;