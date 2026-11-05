import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { ProxiProvider, useProxi } from './state/ProxiContext.jsx';
import { WorldCanvas } from './canvas/WorldCanvas.jsx';

import { MicGate } from './components/MicGate.jsx';
import { StatusBar } from './components/StatusBar.jsx';
import { PeerList } from './components/PeerList.jsx';
import { AuditPanel } from './components/AuditPanel.jsx';
import { OfficeSidebar } from './components/OfficeSidebar.jsx';
import { Notices } from './components/Notices.jsx';
import { OfficeBlueprintImporter } from './components/OfficeBlueprintImport.jsx';

import Login from './components/Login.jsx';
import Signup from './components/Signup.jsx';
import ForgotPassword from './components/ForgotPassword.jsx';
import ResetPassword from './components/ResetPassword.jsx';
import VerifyEmail from './components/VerifyEmail.jsx';

import Dashboard from './components/Dashboard.jsx';

import config from './config.js';
import { useUiTick } from './hooks/useUiTick.js';
import { useAuthSession } from './hooks/useAuthSession.js';

const ROOM_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,47}$/;

function LoadingScreen({
  message = 'Loading your workspace…',
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#080b14] px-6 text-[#edf2ff]">
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#8175ff] text-xl font-bold">
          P
        </div>

        <h1 className="text-xl font-bold">
          ProxiSpeak Meet
        </h1>

        <p className="mt-3 text-sm text-[#9ba9c2]">
          {message}
        </p>
      </div>
    </main>
  );
}

function SessionErrorScreen({
  message,
  onRetry,
  onSignOut,
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#080b14] px-5 py-10 text-[#edf2ff]">
      <section className="w-full max-w-md rounded-2xl border border-[#263149] bg-[#101625] p-7">
        <h1 className="text-xl font-bold">
          Unable to verify your session
        </h1>

        <p className="mt-4 text-sm leading-7 text-[#9ba9c2]">
          {message}
        </p>

        <p className="mt-3 text-xs leading-6 text-[#71809a]">
          Check your connection to the server and try again.
        </p>

        <div className="mt-7 flex gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="flex-1 rounded-xl bg-[#8175ff] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#7164f0]"
          >
            Retry
          </button>

          <button
            type="button"
            onClick={onSignOut}
            className="flex-1 rounded-xl border border-[#263149] px-4 py-3 text-sm font-semibold text-[#edf2ff] transition hover:bg-[#151e30]"
          >
            Sign in again
          </button>
        </div>
      </section>
    </main>
  );
}

/* -------------------------------------------------------
   OFFICE CONNECTION AND AUDIO STATUS
------------------------------------------------------- */

function ConnectionAudioPanel() {
  const {
    state,
    audioRef,
    peersRef,
  } = useProxi();

  useUiTick(500);

  const connections =
    peersRef.current?.snapshot?.() ?? [];

  const connectedPeers = connections.filter(
    (connection) =>
      connection.state === 'connected',
  ).length;

  const socketConnected =
    state.status === 'online';

  const audioReady = Boolean(
    state.selfId && audioRef.current,
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

  const items = [
    {
      label: 'Socket.IO',
      value: socketConnected
        ? 'Connected'
        : state.status === 'connecting'
          ? 'Connecting'
          : state.status === 'reconnecting'
            ? 'Reconnecting'
            : state.status === 'error'
              ? 'Connection error'
              : 'Offline',
      active: socketConnected,
    },
    {
      label: 'WebRTC',
      value:
        connections.length === 0
          ? 'No peer connections'
          : `${connectedPeers}/${connections.length} connected`,
      active: connectedPeers > 0,
    },
    {
      label: 'Spatial Audio',
      value: audioReady
        ? 'Initialized'
        : 'Waiting',
      active: audioReady,
    },
    {
      label: 'Microphone',
      value: microphoneLabel,
      active:
        state.mic.state === 'ready' &&
        !state.muted,
    },
  ];

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
        {items.map((item) => (
          <li
            key={item.label}
            className="connection-panel__item"
          >
            <span
              className={`connection-panel__indicator ${
                item.active
                  ? 'connection-panel__indicator--online'
                  : ''
              }`}
              aria-hidden="true"
            />

            <span className="connection-panel__label">
              {item.label}
            </span>

            <span className="connection-panel__value">
              {item.value}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------
   ROOM INFORMATION
------------------------------------------------------- */

function RoomInfoPanel() {
  const {
    state,
    dispatch,
  } = useProxi();

  const [copyState, setCopyState] = useState('idle');

  const roomId =
    state.room?.roomId ?? config.defaultRoom;

  const roomName =
    state.room?.name || roomId;

  const participantCount =
    state.roster.length + (state.selfId ? 1 : 0);

  const copyInvite = async () => {
    const inviteUrl = new URL(window.location.href);

    inviteUrl.searchParams.set('room', roomId);

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error(
          'Clipboard access is unavailable.',
        );
      }

      await navigator.clipboard.writeText(
        inviteUrl.toString(),
      );

      setCopyState('copied');

      dispatch({
        type: 'notice',
        notice: {
          level: 'success',
          message: 'Invite link copied.',
        },
      });

      window.setTimeout(
        () => setCopyState('idle'),
        2000,
      );
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
            <span className="room-info__label">
              Room
            </span>

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

/* -------------------------------------------------------
   OFFICE SETTINGS
------------------------------------------------------- */

function SettingsPanel() {
  const {
    state,
    toggleMute,
    setVolume,
  } = useProxi();

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
                {Math.round(
                  state.masterVolume * 100,
                )}%
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

      <OfficeBlueprintImporter />
      <RoomInfoPanel />
    </>
  );
}

/* -------------------------------------------------------
   OFFICE WORKSPACE VIEWS
------------------------------------------------------- */

function WorkspaceView({ activeView }) {
  switch (activeView) {
    case 'people':
      return (
        <main
          className="app__body"
          aria-label="People workspace"
          style={{
            gridTemplateColumns: 'minmax(0, 1fr)',
          }}
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
          style={{
            gridTemplateColumns: 'minmax(0, 1fr)',
          }}
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
          style={{
            gridTemplateColumns: 'minmax(0, 1fr)',
          }}
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

/* -------------------------------------------------------
   VIRTUAL OFFICE
------------------------------------------------------- */

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
      description:
        'Your virtual workspace and spatial environment.',
    },

    people: {
      title: 'People',
      description:
        'Discover participants in your current room.',
    },

    audio: {
      title: 'Audio & Connections',
      description:
        'Monitor live connectivity and spatial audio.',
    },

    settings: {
      title: 'Settings',
      description:
        'Manage your audio preferences and workspace.',
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
            style={{
              padding: '16px 20px 0',
            }}
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

/* -------------------------------------------------------
   MEETING HEADER

   This component is inside ProxiProvider so it can call
   the real leave() function before returning to Dashboard.
------------------------------------------------------- */

function MeetingHeader({
  roomId,
  onLeave,
}) {
  const { leave } = useProxi();

  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');

  const handleLeave = async () => {
    if (leaving) return;

    setLeaving(true);
    setError('');

    try {
      await leave();
      onLeave();
    } catch (err) {
      setError(
        err.message || 'Unable to leave the meeting.',
      );
      setLeaving(false);
    }
  };

  return (
    <header className="relative z-[1000] flex flex-wrap items-center justify-between gap-3 border-b border-[#263149] bg-[#0d131c] px-4 py-3 sm:px-6">
      <div className="min-w-0">
        <p className="text-[10px] font-bold tracking-[0.18em] text-[#9ba9c2]">
          CURRENT MEETING
        </p>

        <p className="mt-1 truncate text-sm font-semibold text-[#edf2ff]">
          {roomId}
        </p>

        {error && (
          <p role="alert" className="mt-1 text-xs text-red-300">
            {error}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={handleLeave}
        disabled={leaving}
        className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2.5 text-xs font-semibold text-red-300 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {leaving ? 'Leaving meeting…' : 'Leave meeting'}
      </button>
    </header>
  );
}

/* -------------------------------------------------------
   AUTHENTICATION ROUTES
------------------------------------------------------- */

function AuthRoutes({ onLogin }) {
  const location = useLocation();

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to="/login" replace />}
      />

      <Route
        path="/login"
        element={<Login onLogin={onLogin} />}
      />

      <Route
        path="/signup"
        element={<Signup />}
      />

      <Route
        path="/verify-email"
        element={<VerifyEmail />}
      />

      <Route
        path="/forgot-password"
        element={<ForgotPassword />}
      />

      <Route
        path="/reset-password"
        element={<ResetPassword />}
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/login"
            replace
            state={{
              from: location.pathname,
            }}
          />
        }
      />
    </Routes>
  );
}

/* -------------------------------------------------------
   MAIN APPLICATION
------------------------------------------------------- */

export function App() {
  const {
    user,
    loading,
    error,
    login,
    logout,
    verifySession,
  } = useAuthSession();

  const navigate = useNavigate();
  const location = useLocation();

  /*
   * Preserve invite-link behavior:
   * A valid room query can open the invited room after
   * the authenticated session has been restored.
   *
   * Normal login without a room query opens Dashboard.
   */
  const [currentRoom, setCurrentRoom] = useState(() => {
    const roomId = new URLSearchParams(
      window.location.search,
    ).get('room');

    const normalizedRoomId =
      typeof roomId === 'string'
        ? roomId.trim().toLowerCase()
        : '';

    return ROOM_ID_PATTERN.test(normalizedRoomId)
      ? normalizedRoomId
      : null;
  });

  const currentUser = user?.username ?? null;

  /*
   * Establish the session after Login.jsx successfully
   * stores the token and returns the username.
   */
  const handleLogin = useCallback(
    (username) => {
      const token = localStorage.getItem('token');

      if (
        !token ||
        typeof username !== 'string' ||
        !username.trim()
      ) {
        throw new Error(
          'Login did not return a valid session.',
        );
      }

      login({
        token,
        username: username.trim(),
      });

      setCurrentRoom(null);

      const url = new URL(window.location.href);
      url.searchParams.delete('room');

      window.history.replaceState({}, '', url);

      navigate('/dashboard', {
        replace: true,
      });
    },
    [login, navigate],
  );

  /*
   * Logout clears the existing authentication session
   * and removes any active room from the URL.
   */
  const handleLogout = useCallback(() => {
    logout();
    setCurrentRoom(null);

    const url = new URL(window.location.href);

    url.searchParams.delete('room');

    window.history.replaceState({}, '', url);

    navigate('/login', {
      replace: true,
    });
  }, [logout, navigate]);

  /*
   * Called by Dashboard after successful room creation
   * or room verification.
   */
  const handleJoinRoom = useCallback(
    (roomId) => {
      const normalizedRoomId =
        typeof roomId === 'string'
          ? roomId.trim().toLowerCase()
          : '';

      if (
        !ROOM_ID_PATTERN.test(normalizedRoomId)
      ) {
        return;
      }

      const url = new URL(window.location.href);

      url.searchParams.set(
        'room',
        normalizedRoomId,
      );

      window.history.pushState(
        {},
        '',
        url,
      );

      setCurrentRoom(normalizedRoomId);
    },
    [],
  );

  /*
   * After the actual ProxiContext leave() operation,
   * return the user to Dashboard.
   */
  const handleLeaveMeeting = useCallback(() => {
    setCurrentRoom(null);

    const url = new URL(window.location.href);

    url.searchParams.delete('room');

    window.history.replaceState(
      {},
      '',
      url,
    );

    navigate('/dashboard', {
      replace: true,
    });
  }, [navigate]);

  /*
   * Keep React state synchronized with browser back/forward.
   */
  useEffect(() => {
    const handlePopState = () => {
      const roomId = new URLSearchParams(
        window.location.search,
      ).get('room');

      const normalizedRoomId =
        typeof roomId === 'string'
          ? roomId.trim().toLowerCase()
          : '';

      setCurrentRoom(
        ROOM_ID_PATTERN.test(normalizedRoomId)
          ? normalizedRoomId
          : null,
      );
    };

    window.addEventListener(
      'popstate',
      handlePopState,
    );

    return () => {
      window.removeEventListener(
        'popstate',
        handlePopState,
      );
    };
  }, []);

  /*
   * A restored authenticated session should land on
   * Dashboard instead of the old /login route.
   */
  useEffect(() => {
    if (
      currentUser &&
      !currentRoom &&
      location.pathname !== '/dashboard'
    ) {
      navigate('/dashboard', {
        replace: true,
      });
    }
  }, [
    currentUser,
    currentRoom,
    location.pathname,
    navigate,
  ]);

  if (loading) {
    return (
      <LoadingScreen
        message="Verifying your login session…"
      />
    );
  }

  if (
    error &&
    !currentUser &&
    localStorage.getItem('token')
  ) {
    return (
      <SessionErrorScreen
        message={error}
        onRetry={() => void verifySession()}
        onSignOut={handleLogout}
      />
    );
  }

  /*
   * Authentication pages are accessible only when
   * the user does not have a verified active session.
   */
  if (!currentUser) {
    return (
      <AuthRoutes onLogin={handleLogin} />
    );
  }

  /*
   * Main authenticated landing page.
   */
  if (!currentRoom) {
    return (
      <Dashboard
        username={currentUser}
        onJoinRoom={handleJoinRoom}
        onLogout={handleLogout}
      />
    );
  }

  /*
   * Existing virtual office.
   *
   * ProxiProvider is mounted only while a meeting is
   * active. Leaving the meeting first calls leave(),
   * then unmounts this provider and its resources.
   */
  return (
    <ProxiProvider>
      <div className="min-h-screen bg-[#080b14]">
        <MeetingHeader
          roomId={currentRoom}
          onLeave={handleLeaveMeeting}
        />

        <Office />
      </div>
    </ProxiProvider>
  );
}

export default App;