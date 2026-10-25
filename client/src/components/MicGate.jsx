/**
 * ProxiSpeak — Join Office
 *
 * Features:
 * - Premium split-layout join experience.
 * - Profile, avatar, colour and microphone selection.
 * - Room prefill from invite URLs.
 * - Room suggestions from the backend room catalogue.
 * - Free-text room IDs remain supported.
 * - Catalogue failures never block joining an office.
 *
 * Socket.IO, WebRTC and spatial-audio behavior remain unchanged.
 */

import { useEffect, useState } from 'react';
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

const FEATURES = [
  {
    icon: '◉',
    title: 'Real-time voice',
    description: 'Talk naturally with teammates nearby.',
  },
  {
    icon: '⌁',
    title: 'Spatial audio',
    description: 'Hear conversations change with distance.',
  },
  {
    icon: '⌖',
    title: 'Virtual office',
    description: 'Move around a shared workspace.',
  },
];

const ROOM_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,47}$/;

function getInitialRoom() {
  try {
    const invitedRoom = new URLSearchParams(
      window.location.search,
    ).get('room');

    return invitedRoom?.trim().toLowerCase() || config.defaultRoom;
  } catch {
    return config.defaultRoom;
  }
}

function getApiBaseUrl() {
  return String(config.serverUrl).replace(/\/+$/, '');
}

export function MicGate() {
  const { state, join, requestMicrophone } = useProxi();

  const [roomId, setRoomId] = useState(getInitialRoom);
  const [rooms, setRooms] = useState([]);
  const [catalogueStatus, setCatalogueStatus] = useState('loading');

  const [name, setName] = useState(
    () => localStorage.getItem('proxispeak:name') ?? '',
  );

  const [color, setColor] = useState(
    () => localStorage.getItem('proxispeak:color') ?? '#4f8cff',
  );

  const [avatar, setAvatar] = useState('circle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const busyState = busy || state.status === 'connecting';

  // Room discovery is helpful, but must never block manual room joining.
  useEffect(() => {
    const controller = new AbortController();

    async function loadRooms() {
      setCatalogueStatus('loading');

      try {
        const response = await fetch(
          `${getApiBaseUrl()}/api/rooms`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
            },
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(
            `Room catalogue request failed (${response.status})`,
          );
        }

        const payload = await response.json();
        const availableRooms = Array.isArray(payload?.rooms)
          ? payload.rooms.filter(
              (room) =>
                room &&
                typeof room.roomId === 'string' &&
                ROOM_ID_PATTERN.test(room.roomId),
            )
          : [];

        setRooms(availableRooms);
        setCatalogueStatus('loaded');
      } catch (err) {
        if (err.name === 'AbortError') {
          return;
        }

        // Keep manual room entry available when the API is unavailable.
        setRooms([]);
        setCatalogueStatus('unavailable');
      }
    }

    void loadRooms();

    return () => controller.abort();
  }, []);

  const normalizedRoomId = roomId.trim().toLowerCase();

  const selectedRoom = rooms.find(
    (room) => room.roomId === normalizedRoomId,
  );

  const doJoin = async (withMic) => {
    setBusy(true);
    setError(null);

    const normalizedName = name.trim();

    if (!normalizedName) {
      setError('Please enter your name.');
      setBusy(false);
      return;
    }

    if (!ROOM_ID_PATTERN.test(normalizedRoomId)) {
      setError(
        'Room ID must start with a letter or number and contain only letters, numbers, hyphens or underscores.',
      );
      setBusy(false);
      return;
    }

    localStorage.setItem('proxispeak:name', normalizedName);
    localStorage.setItem('proxispeak:color', color);

    try {
      if (withMic) {
        await requestMicrophone();
      }

      await join({
        roomId: normalizedRoomId,
        name: normalizedName,
        color,
        avatar,
        withMic,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="gate gate--split">
      <div className="gate__layout">
        <section
          className="gate__hero"
          aria-labelledby="gate-hero-title"
        >
          <div className="gate__hero-scene" aria-hidden="true">
            <div className="gate__scene-glow gate__scene-glow--one" />
            <div className="gate__scene-glow gate__scene-glow--two" />

            <div className="gate__scene-orbit gate__scene-orbit--outer" />
            <div className="gate__scene-orbit gate__scene-orbit--inner" />

            <div className="gate__scene-avatar gate__scene-avatar--one">
              <span>●</span>
            </div>

            <div className="gate__scene-avatar gate__scene-avatar--two">
              <span>●</span>
            </div>

            <div className="gate__scene-avatar gate__scene-avatar--three">
              <span>●</span>
            </div>

            <div className="gate__scene-center">
              <span className="gate__scene-mark">
                <span />
                <span />
                <span />
              </span>

              <span className="gate__scene-center-label">
                YOUR OFFICE
              </span>
            </div>

            <div className="gate__scene-caption gate__scene-caption--left">
              Lounge
            </div>

            <div className="gate__scene-caption gate__scene-caption--right">
              Team space
            </div>

            <div className="gate__scene-caption gate__scene-caption--bottom">
              Connected by proximity
            </div>
          </div>

          <div className="gate__hero-content">
            <div className="gate__brand">
              <span className="gate__brand-mark" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>

              <span className="gate__brand-name">
                ProxiSpeak
              </span>

              <span className="gate__brand-badge">
                VIRTUAL OFFICE
              </span>
            </div>

            <p className="gate__eyebrow">
              YOUR SPACE. YOUR PEOPLE.
            </p>

            <h1
              className="gate__title"
              id="gate-hero-title"
            >
              Work together,
              <br />
              wherever you are.
            </h1>

            <p className="gate__subtitle">
              Step into a shared virtual office where conversations
              happen naturally. Move closer to teammates to hear them,
              and walk away when it is time to focus.
            </p>

            <div className="gate__feature-list">
              {FEATURES.map((feature) => (
                <div
                  className="gate__feature"
                  key={feature.title}
                >
                  <span
                    className="gate__feature-icon"
                    aria-hidden="true"
                  >
                    {feature.icon}
                  </span>

                  <span className="gate__feature-copy">
                    <strong>{feature.title}</strong>
                    <span>{feature.description}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="gate__hero-footer">
              <span className="gate__connection-indicator" />

              <span>
                Peer-to-peer audio powered by WebRTC
              </span>
            </div>
          </div>
        </section>

        <section
          className="gate__form-panel"
          aria-labelledby="gate-form-title"
        >
          <form
            className="gate__card"
            onSubmit={(event) => {
              event.preventDefault();
              void doJoin(true);
            }}
          >
            <div className="gate__form-heading">
              <span className="gate__form-kicker">
                GET STARTED
              </span>

              <h2 id="gate-form-title">
                Join the office
              </h2>

              <p>
                Set up your profile and step into your workspace.
              </p>
            </div>

            <div className="gate__section-heading">
              <span className="gate__section-number">01</span>
              <span>Your profile</span>
            </div>

            <label className="field">
              <span>Your name</span>

              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your name"
                maxLength={24}
                autoComplete="name"
                required
              />
            </label>

            <label className="field">
              <span>Office room</span>

              <input
                value={roomId}
                onChange={(event) =>
                  setRoomId(event.target.value.toLowerCase())
                }
                list="proxispeak-room-options"
                maxLength={48}
                pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{0,47}"
                title="Use letters, numbers, hyphens or underscores. Start with a letter or number."
                autoComplete="off"
                aria-describedby="office-room-hint"
                required
              />

              <datalist id="proxispeak-room-options">
                {rooms.map((room) => (
                  <option
                    key={room.roomId}
                    value={room.roomId}
                    label={`${room.name} · ${room.liveUsers ?? 0} online`}
                  />
                ))}
              </datalist>

              <span
                className="gate__field-hint"
                id="office-room-hint"
                aria-live="polite"
              >
                {selectedRoom
                  ? `${selectedRoom.name} · ${selectedRoom.liveUsers ?? 0} online`
                  : catalogueStatus === 'loading'
                    ? 'Loading available offices… You can still enter a room ID.'
                    : catalogueStatus === 'loaded'
                      ? 'Choose a suggested office or enter a new room ID.'
                      : 'Enter your team room ID. Existing room suggestions are temporarily unavailable.'}
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
                    aria-label={`Colour ${swatch}`}
                    aria-pressed={color === swatch}
                  />
                ))}

                <input
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  aria-label="Custom colour"
                  title="Choose a custom colour"
                />

                <span className="gate__color-value">
                  {color.toUpperCase()}
                </span>
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
                    aria-label={`Avatar ${shape}`}
                    aria-pressed={avatar === shape}
                  />
                ))}

                <span className="gate__avatar-label">
                  {avatar.charAt(0).toUpperCase() + avatar.slice(1)}
                </span>
              </div>
            </div>

            {(state.mic.error || error) && (
              <div className="alert alert--error" role="alert">
                {error || state.mic.error}
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
                {busyState
                  ? 'Connecting…'
                  : 'Join with microphone'}
              </button>

              <button
                type="button"
                className="button"
                disabled={busyState}
                onClick={() => void doJoin(false)}
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
                Audio uses peer-to-peer WebRTC. The server relays
                connection handshakes for people within your{' '}
                {state.room?.width ?? 1920}px office radius.
              </p>
            </div>

            <div className="gate__footer">
              <span>PROXIMITY-BASED AUDIO</span>
              <span aria-hidden="true">•</span>
              <span>BUILT FOR COLLABORATION</span>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

export default MicGate;