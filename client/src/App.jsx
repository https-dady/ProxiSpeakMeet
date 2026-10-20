import { useState } from 'react';

import { ProxiProvider, useProxi } from './state/ProxiContext.jsx';
import { WorldCanvas } from './canvas/WorldCanvas.jsx';

import { MicGate } from './components/MicGate.jsx';
import { StatusBar } from './components/StatusBar.jsx';
import { PeerList } from './components/PeerList.jsx';
import { AuditPanel } from './components/AuditPanel.jsx';
import { SoundLegend } from './components/SoundLegend.jsx';
import { OfficeSidebar } from './components/OfficeSidebar.jsx';
import { Notices } from './components/Notices.jsx';

import { useUiTick } from './hooks/useUiTick.js';

function ConnectionAudioPanel() {
  const { state, audioRef, peersRef } = useProxi();

  useUiTick(500);

  const connections = peersRef.current?.snapshot?.() ?? [];

  const connectedPeers = connections.filter(
    (connection) => connection.state === 'connected'
  ).length;

  const socketConnected = state.status === 'online';

  const audioReady = Boolean(
    state.selfId && audioRef.current
  );

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

  const participantCount = state.roster.length + (
    state.selfId ? 1 : 0
  );

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
          <span
            className="room-info__icon"
            aria-hidden="true"
          >
            ⌂
          </span>

          <div className="room-info__copy">
            <span className="room-info__label">
              Room
            </span>

            <strong className="room-info__value">
              {roomName}
            </strong>
          </div>
        </div>

        <div className="room-info__item">
          <span
            className="room-info__icon"
            aria-hidden="true"
          >
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
          <span
            className="room-info__icon"
            aria-hidden="true"
          >
            #
          </span>

          <div className="room-info__copy">
            <span className="room-info__label">
              Room ID
            </span>

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

function Office() {
  const { state } = useProxi();

  if (!state.selfId) {
    return (
      <div className="app app--gate">
        <StatusBar />
        <MicGate />
        <Notices />
      </div>
    );
  }

  return (
    <div className="app">
      <OfficeSidebar />

      <div className="app__workspace">
        <StatusBar />

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