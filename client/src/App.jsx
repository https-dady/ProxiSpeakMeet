import { useCallback, useEffect, useState } from 'react';

import { ProxiProvider, useProxi } from './state/ProxiContext.jsx';
import { WorldCanvas } from './canvas/WorldCanvas.jsx';

import { MicGate } from './components/MicGate.jsx';
import { StatusBar } from './components/StatusBar.jsx';
import { PeerList } from './components/PeerList.jsx';
import { AuditPanel } from './components/AuditPanel.jsx';
import { OfficeSidebar } from './components/OfficeSidebar.jsx';
import { Notices } from './components/Notices.jsx';

import config from './config.js';
import { useUiTick } from './hooks/useUiTick.js';

const ROOM_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,47}$/;

function getApiBaseUrl() {
  return String(config.serverUrl).replace(/\/+$/, '');
}

function ConnectionAudioPanel() {
  const { state, audioRef, peersRef } = useProxi();

  useUiTick(500);

  const connections = peersRef.current?.snapshot?.() ?? [];

  const connectedPeers = connections.filter(
    (connection) => connection.state === 'connected',
  ).length;

  const socketConnected = state.status === 'online';
  const audioReady = Boolean(state.selfId && audioRef.current);

  const microphoneLabel = state.muted
    ? 'Muted'
    : state.mic.state === 'ready'
      ? 'Microphone ready'
      : state.mic.state === 'listen-only'
        ? 'Listen only'
        : state.mic.state === 'denied'
          ? 'Microphone unavailable'
          : 'Microphone pending';

  return (
    <section
      className="panel connection-panel"
      aria-labelledby="connection-panel-title"
    >
      <header className="panel__header connection-panel__header">
        <div>
          <span className="connection-panel__eyebrow">
            LIVE STATUS
          </span>
          <h2 id="connection-panel-title">
            Connection &amp; Audio
          </h2>
        </div>
      </header>

      <ul className="connection-panel__list">
        <li className="connection-panel__item">
          <span
            className={`connection-panel__indicator ${
              socketConnected
                ? 'connection-panel__indicator--online'
                : ''
            }`}
            aria-hidden="true"
          />
          <span className="connection-panel__label">
            Socket.IO
          </span>
          <span className="connection-panel__value">
            {socketConnected
              ? 'Connected'
              : state.status === 'connecting'
                ? 'Connecting'
                : state.status === 'reconnecting'
                  ? 'Reconnecting'
                  : state.status === 'error'
                    ? 'Connection error'
                    : 'Offline'}
          </span>
        </li>

        <li className="connection-panel__item">
          <span
            className={`connection-panel__indicator ${
              connectedPeers > 0
                ? 'connection-panel__indicator--online'
                : ''
            }`}
            aria-hidden="true"
          />
          <span className="connection-panel__label">
            WebRTC
          </span>
          <span className="connection-panel__value">
            {connections.length === 0
              ? 'No peer connections'
              : `${connectedPeers}/${connections.length} connected`}
          </span>
        </li>

        <li className="connection-panel__item">
          <span
            className={`connection-panel__indicator ${
              audioReady
                ? 'connection-panel__indicator--online'
                : ''
            }`}
            aria-hidden="true"
          />
          <span className="connection-panel__label">
            Spatial Audio
          </span>
          <span className="connection-panel__value">
            {audioReady ? 'Initialized' : 'Waiting'}
          </span>
        </li>

        <li className="connection-panel__item">
          <span
            className={`connection-panel__indicator ${
              state.mic.state === 'ready' && !state.muted
                ? 'connection-panel__indicator--online'
                : ''
            }`}
            aria-hidden="true"
          />
          <span className="connection-panel__label">
            Microphone
          </span>
          <span className="connection-panel__value">
            {microphoneLabel}
          </span>
        </li>
      </ul>
    </section>
  );
}

function RoomInfoPanel() {
  const { state, dispatch } = useProxi();

  const [copyState, setCopyState] = useState('idle');

  const roomId = state.room?.roomId ?? config.defaultRoom;
  const roomName = state.room?.name || roomId;
  const participantCount =
    state.roster.length + (state.selfId ? 1 : 0);

  const copyInvite = async () => {
    const inviteUrl = new URL(window.location.href);
    inviteUrl.searchParams.set('room', roomId);

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard access is unavailable.');
      }

      await navigator.clipboard.writeText(inviteUrl.toString());
      setCopyState('copied');

      dispatch({
        type: 'notice',
        notice: {
          level: 'success',
          message: 'Invite link copied.',
        },
      });

      window.setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');

      dispatch({
        type: 'notice',
        notice: {
          level: 'warning',
          message:
            'Could not copy the invite link. Check clipboard permissions.',
        },
      });
    }
  };

  return (
    <section
      className="panel room-info"
      aria-labelledby="room-info-title"
    >
      <header className="panel__header room-info__header">
        <div>
          <span className="room-info__eyebrow">
            YOUR WORKSPACE
          </span>
          <h2 id="room-info-title">Room Info</h2>
        </div>
      </header>

      <div className="room-info__details">
        <div className="room-info__item">
          <span className="room-info__icon" aria-hidden="true">
            ⌂
          </span>
          <div className="room-info__copy">
            <span className="room-info__label">Room</span>
            <strong className="room-info__value">
              {roomName}
            </strong>
          </div>
        </div>

        <div className="room-info__item">
          <span className="room-info__icon" aria-hidden="true">
            ♙
          </span>
          <div className="room-info__copy">
            <span className="room-info__label">
              Participants
            </span>
            <strong className="room-info__value">
              {participantCount}
            </strong>
          </div>
        </div>

        <div className="room-info__item">
          <span className="room-info__icon" aria-hidden="true">
            #
          </span>
          <div className="room-info__copy">
            <span className="room-info__label">Room ID</span>
            <strong className="room-info__value">
              {roomId}
            </strong>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="button button--primary room-info__invite"
        onClick={copyInvite}
        disabled={!state.selfId}
      >
        {copyState === 'copied'
          ? 'Invite copied'
          : copyState === 'error'
            ? 'Try copying again'
            : 'Copy Invite'}
      </button>
    </section>
  );
}

/**
 * Loads real rooms from GET /api/rooms and switches rooms through the
 * existing ProxiContext join() flow.
 */
function RoomSwitcher() {
  const { state, join, dispatch } = useProxi();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState('');

  const currentRoomId =
    state.room?.roomId ??
    state.sessionIntent?.roomId ??
    config.defaultRoom;

  const loadRooms = useCallback(async (signal) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/api/rooms`,
        {
          headers: { Accept: 'application/json' },
          signal,
        },
      );

      if (!response.ok) {
        throw new Error(
          `Room catalogue request failed (${response.status}).`,
        );
      }

      const payload = await response.json();

      if (!Array.isArray(payload?.rooms)) {
        throw new Error('The server returned an invalid room catalogue.');
      }

      const validRooms = payload.rooms.filter(
        (room) =>
          room &&
          typeof room.roomId === 'string' &&
          ROOM_ID_PATTERN.test(room.roomId),
      );

      setRooms(validRooms);
    } catch (err) {
      if (err.name === 'AbortError') return;

      setError(
        err.message || 'Unable to load available rooms.',
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void loadRooms(controller.signal);

    return () => controller.abort();
  }, [loadRooms]);

  const handleRoomChange = async (event) => {
    const nextRoomId = event.target.value;

    if (
      !nextRoomId ||
      nextRoomId === currentRoomId ||
      switching
    ) {
      return;
    }

    const selectedRoom = rooms.find(
      (room) => room.roomId === nextRoomId,
    );

    if (!selectedRoom) {
      setError('Select a room from the available room catalogue.');
      return;
    }

    const intent = state.sessionIntent;

    if (!intent || !state.selfId) {
      setError('Join the office before switching rooms.');
      return;
    }

    setSwitching(true);
    setError('');

    try {
      await join({
        ...intent,
        roomId: nextRoomId,
        // Keep the current microphone stream and avoid requesting it again.
        withMic: false,
      });

      dispatch({
        type: 'notice',
        notice: {
          level: 'success',
          message: `Switched to ${selectedRoom.name || nextRoomId}.`,
        },
      });

      // Refresh live-user counts after the room change.
      void loadRooms();
    } catch (err) {
      setError(err.message || 'Could not switch rooms.');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <section
      className="panel room-switcher"
      aria-labelledby="room-switcher-title"
    >
      <header className="panel__header">
        <div>
          <span className="room-info__eyebrow">
            WORKSPACE
          </span>
          <h2 id="room-switcher-title">Switch room</h2>
        </div>

        <button
          type="button"
          className="button button--small"
          disabled={loading || switching}
          onClick={() => void loadRooms()}
        >
          Refresh
        </button>
      </header>

      <div className="room-info__details">
        <label
          className="room-info__copy"
          htmlFor="workspace-room-select"
        >
          <span className="room-info__label">
            Available rooms
          </span>

          <select
            id="workspace-room-select"
            className="room-switcher__select"
            value={currentRoomId}
            onChange={handleRoomChange}
            disabled={
              loading ||
              switching ||
              state.status !== 'online'
            }
          >
            {!rooms.some(
              (room) => room.roomId === currentRoomId,
            ) && (
              <option value={currentRoomId}>
                {currentRoomId} (current)
              </option>
            )}

            {rooms.map((room) => (
              <option key={room.roomId} value={room.roomId}>
                {room.name || room.roomId}
                {' · '}
                {room.liveUsers ?? 0} online
              </option>
            ))}
          </select>
        </label>

        <p className="room-info__label" role="status">
          {loading
            ? 'Loading rooms from the server…'
            : switching
              ? 'Switching room…'
              : state.status !== 'online'
                ? 'Connect to the server to switch rooms.'
                : `${rooms.length} rooms available`}
        </p>

        {error && (
          <div role="alert" className="room-switcher__error">
            <p>{error}</p>

            <button
              type="button"
              className="button button--small"
              disabled={loading || switching}
              onClick={() => void loadRooms()}
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function SettingsPanel() {
  const { state, toggleMute, setVolume } = useProxi();

  return (
    <>
      <section
        className="panel"
        aria-labelledby="settings-panel-title"
      >
        <header className="panel__header">
          <div>
            <span className="connection-panel__eyebrow">
              PREFERENCES
            </span>
            <h2 id="settings-panel-title">Audio settings</h2>
          </div>
        </header>

        <div className="room-info__details">
          <div className="room-info__item">
            <span className="room-info__icon" aria-hidden="true">
              ♫
            </span>

            <div className="room-info__copy">
              <span className="room-info__label">
                Microphone
              </span>
              <strong className="room-info__value">
                {state.muted ? 'Muted' : 'Unmuted'}
              </strong>
            </div>

            <button
              type="button"
              className="button button--small"
              onClick={toggleMute}
              aria-pressed={state.muted}
            >
              {state.muted ? 'Unmute' : 'Mute'}
            </button>
          </div>

          <div className="room-info__item">
            <span className="room-info__icon" aria-hidden="true">
              🔊
            </span>

            <div className="room-info__copy">
              <label
                className="room-info__label"
                htmlFor="settings-master-volume"
              >
                Master output volume
              </label>

              <strong className="room-info__value">
                {Math.round(state.masterVolume * 100)}%
              </strong>
            </div>

            <input
              id="settings-master-volume"
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
          </div>
        </div>
      </section>

      <RoomSwitcher />
      <RoomInfoPanel />
    </>
  );
}

function WorkspaceView({ activeView }) {
  switch (activeView) {
    case 'people':
      return (
        <main
          className="app__body"
          aria-label="People workspace"
          style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}
        >
          <div className="app__sidebar">
            <PeerList />
            <RoomInfoPanel />
          </div>
        </main>
      );

    case 'audio':
      return (
        <main
          className="app__body"
          aria-label="Audio and diagnostics workspace"
          style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}
        >
          <div className="app__sidebar">
            <ConnectionAudioPanel />
            <AuditPanel />
          </div>
        </main>
      );

    case 'settings':
      return (
        <main
          className="app__body"
          aria-label="Workspace settings"
          style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}
        >
          <div className="app__sidebar">
            <SettingsPanel />
          </div>
        </main>
      );

    case 'office':
    default:
      return (
        <main
          className="app__body"
          aria-label="Virtual office workspace"
        >
          <WorldCanvas />

          <aside
            className="app__sidebar"
            aria-label="Workspace information and diagnostics"
          >
            <PeerList />
            <ConnectionAudioPanel />
            <RoomInfoPanel />
            <AuditPanel />
          </aside>
        </main>
      );
  }
}

function Office() {
  const { state } = useProxi();
  const [activeView, setActiveView] = useState('office');

  if (!state.selfId) {
    return (
      <div className="app app--gate">
        <StatusBar />
        <MicGate />
        <Notices />
      </div>
    );
  }

  const viewDetails = {
    office: {
      title: 'Office Floor',
      description: 'Your virtual workspace and spatial environment.',
    },
    people: {
      title: 'People',
      description: 'Discover participants in your current room.',
    },
    audio: {
      title: 'Audio & Connections',
      description: 'Monitor live connectivity and spatial audio.',
    },
    settings: {
      title: 'Settings',
      description: 'Manage your audio preferences and workspace.',
    },
  };

  const currentView =
    viewDetails[activeView] || viewDetails.office;

  return (
    <div className="app">
      <OfficeSidebar
        activeView={activeView}
        onNavigate={setActiveView}
      />

      <div className="app__workspace">
        <StatusBar />

        {activeView !== 'office' && (
          <header
            className="panel__header"
            style={{ padding: '16px 20px 0' }}
          >
            <div>
              <h1>{currentView.title}</h1>
              <p>{currentView.description}</p>
            </div>
          </header>
        )}

        <WorkspaceView activeView={activeView} />
      </div>

      <Notices />
    </div>
  );
}

export function App() {
  return (
    <ProxiProvider>
      <Office />
    </ProxiProvider>
  );
}

export default App;