/**
 * Join gate (Week 1 + mic-permission UX).
 *
 * UI refinement only:
 * - Preserves the existing join and microphone permission flow.
 * - Preserves name, room, colour and avatar state.
 * - Preserves listen-only joining and existing error handling.
 * - Does not modify WebRTC, Socket.IO or spatial audio behavior.
 */

import { useState } from 'react';
import { useProxi } from '../state/ProxiContext.jsx';
import config from '../config.js';

const AVATARS = ['circle', 'square', 'triangle', 'hex'];

const COLOR_SWATCHES = [
  '#4f8cff',
  '#ff6b6b',
  '#ffd166',
  '#5ad19a',
  '#c77dff',
  '#ff9f45',
];

export function MicGate() {
  const { state, join, requestMicrophone } = useProxi();

  const [roomId, setRoomId] = useState(config.defaultRoom);
  const [name, setName] = useState(
    () => localStorage.getItem('proxispeak:name') ?? ''
  );
  const [color, setColor] = useState(
    () => localStorage.getItem('proxispeak:color') ?? '#4f8cff'
  );
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
    <main className="gate">
      <form
        className="gate__card"
        onSubmit={(event) => {
          event.preventDefault();
          void doJoin(true);
        }}
      >
        <div className="gate__brand">
          <span className="gate__brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>

          <span className="gate__brand-name">ProxiSpeak</span>

          <span className="gate__brand-badge">VIRTUAL OFFICE</span>
        </div>

        <div className="gate__intro">
          <p className="gate__eyebrow">YOUR SPACE. YOUR PEOPLE.</p>

          <h1 className="gate__title">Step into your office.</h1>

          <p className="gate__subtitle">
            A virtual workspace where distance matters. Move closer to
            someone to hear them, and walk away to let the conversation fade.
          </p>
        </div>

        <div className="gate__section-heading">
          <span className="gate__section-number">01</span>
          <span>Set up your profile</span>
        </div>

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
          <span>Office room</span>

          <input
            value={roomId}
            onChange={(event) =>
              setRoomId(event.target.value.toLowerCase())
            }
            maxLength={48}
          />

          <span className="gate__field-hint">
            Join the same room as your teammates to meet them.
          </span>
        </label>

        <div className="field">
          <span>Choose your colour</span>

          <div className="gate__swatches">
            {COLOR_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                className={`swatch${
                  color === swatch ? ' swatch--active' : ''
                }`}
                style={{ background: swatch }}
                onClick={() => setColor(swatch)}
                aria-label={`colour ${swatch}`}
                aria-pressed={color === swatch}
              />
            ))}

            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              aria-label="custom colour"
              title="Choose a custom colour"
            />

            <span className="gate__color-value">{color.toUpperCase()}</span>
          </div>
        </div>

        <div className="field">
          <span>Choose your avatar</span>

          <div className="gate__avatars">
            {AVATARS.map((shape) => (
              <button
                key={shape}
                type="button"
                className={`shape shape--${shape}${
                  avatar === shape ? ' shape--active' : ''
                }`}
                onClick={() => setAvatar(shape)}
                aria-label={`avatar ${shape}`}
                aria-pressed={avatar === shape}
              />
            ))}

            <span className="gate__avatar-label">
              {avatar.charAt(0).toUpperCase() + avatar.slice(1)}
            </span>
          </div>
        </div>

        {state.mic.error && (
          <div className="alert alert--error" role="alert">
            {state.mic.error}
          </div>
        )}

        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}

        <div className="gate__section-heading">
          <span className="gate__section-number">02</span>
          <span>Enter your workspace</span>
        </div>

        <div className="gate__actions">
          <button
            type="submit"
            className="button button--primary"
            disabled={busyState}
          >
            {busyState ? 'Connecting…' : 'Join with microphone'}
          </button>

          <button
            type="button"
            className="button"
            disabled={busyState}
            onClick={() => doJoin(false)}
          >
            Listen only
          </button>
        </div>

        <div className="gate__connection-note">
          <span
            className="gate__connection-indicator"
            aria-hidden="true"
          />

          <p>
            <strong>Your conversations stay direct.</strong>
            <br />
            Audio uses peer-to-peer WebRTC. The server relays connection
            handshakes for people within your{' '}
            {state.room?.width ?? 1920}px office radius.
          </p>
        </div>

        <div className="gate__footer">
          <span>PROXIMITY-BASED AUDIO</span>
          <span aria-hidden="true">•</span>
          <span>BUILT FOR COLLABORATION</span>
        </div>
      </form>
    </main>
  );
}

export default MicGate;