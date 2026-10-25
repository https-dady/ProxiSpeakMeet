import { useState } from 'react';

import { ProxiProvider, useProxi } from './state/ProxiContext.jsx';
import { WorldCanvas } from './canvas/WorldCanvas.jsx';

import { MicGate } from './components/MicGate.jsx';
import { StatusBar } from './components/StatusBar.jsx';
import { PeerList } from './components/PeerList.jsx';
import { AuditPanel } from './components/AuditPanel.jsx';
import { OfficeSidebar } from './components/OfficeSidebar.jsx';
import { Notices } from './components/Notices.jsx';

const WORKSPACE_VIEWS = {
  office: {
    title: 'Office Floor',
    description: 'Your virtual workspace and spatial environment.',
  },
  people: {
    title: 'People',
    description: 'Discover nearby participants and their spatial audio status.',
  },
  audio: {
    title: 'Audio & Connections',
    description: 'Monitor live connectivity and spatial audio diagnostics.',
  },
  settings: {
    title: 'Settings',
    description: 'Manage your audio preferences and workspace information.',
  },
};

function ConnectionAudioPanel() {
  const { state, audioRef, peersRef } = useProxi();

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

          <span
            className={`connection-panel__value ${
              socketConnected
                ? 'connection-panel__value--online'
                : ''
            }`}
          >
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

  const roomId = state.room?.roomId ?? 'lobby';

  const roomName =
    state.room?.name ||
    state.room?.roomId ||
    'Office room';

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

      window.setTimeout(() => {
        setCopyState('idle');
      }, 2000);
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

          <h2 id="room-info-title">
            Room Info
          </h2>
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
            <span className="room-info__label">Participants</span>

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

function SettingsPanel() {
  const { state, toggleMute, setVolume } = useProxi();

  return (
    <section
      className="panel"
      aria-labelledby="settings-panel-title"
    >
      <header className="panel__header">
        <div>
          <span className="connection-panel__eyebrow">
            PREFERENCES
          </span>

          <h2 id="settings-panel-title">
            Audio settings
          </h2>
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
            <RoomInfoPanel />
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

  const currentView = WORKSPACE_VIEWS[activeView] ?? WORKSPACE_VIEWS.office;

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