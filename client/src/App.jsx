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
import OfficeLayout from './components/OfficeLayout.jsx';

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

/* -------------------------------------------------------
   LOADING AND SESSION SCREENS
------------------------------------------------------- */

function LoadingScreen({
  message = 'Loading your workspace…',
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#1E1E1E] px-6 text-[#F6F6F6]">
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#6252FF] text-xl font-bold">
          P
        </div>

        <h1 className="text-xl font-bold">
          ProxiSpeak Meet
        </h1>

        <p className="mt-3 text-sm text-[#BDBDBD]">
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
    <main className="grid min-h-screen place-items-center bg-[#1E1E1E] px-5 py-10 text-[#F6F6F6]">
      <section className="w-full max-w-md rounded-2xl border border-[#454545] bg-[#303030] p-7">
        <h1 className="text-xl font-bold">
          Unable to verify your session
        </h1>

        <p className="mt-4 text-sm leading-7 text-[#BDBDBD]">
          {message}
        </p>

        <p className="mt-3 text-xs leading-6 text-[#B0B0B0]">
          Check your connection to the server and try again.
        </p>

        <div className="mt-7 flex gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="flex-1 rounded-xl bg-[#6252FF] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#5546F5]"
          >
            Retry
          </button>

          <button
            type="button"
            onClick={onSignOut}
            className="flex-1 rounded-xl border border-[#454545] px-4 py-3 text-sm font-semibold text-[#F6F6F6] transition hover:bg-[#3A3A3A]"
          >
            Sign in again
          </button>
        </div>
      </section>
    </main>
  );
}

/* -------------------------------------------------------
   CONNECTION AND AUDIO STATUS
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
    (connection) => connection.state === 'connected',
  ).length;

  const socketConnected = state.status === 'online';

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
      value: connections.length === 0
        ? 'No peer connections'
        : `${connectedPeers}/${connections.length} connected`,
      active: connectedPeers > 0,
    },
    {
      label: 'Spatial Audio',
      value: audioReady ? 'Initialized' : 'Waiting',
      active: audioReady,
    },
    {
      label: 'Microphone',
      value: microphoneLabel,
      active: state.mic.state === 'ready' && !state.muted,
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
        throw new Error('Clipboard access is unavailable.');
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
   SETTINGS
------------------------------------------------------- */

function SettingsPanel() {
  const {
    state,
    toggleMute,
    setVolume,
  } = useProxi();

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
            ◉
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
            className="button button--secondary"
            onClick={toggleMute}
          >
            {state.muted ? 'Unmute' : 'Mute'}
          </button>
        </div>

        <div className="room-info__item">
          <span className="room-info__icon" aria-hidden="true">
            ◖
          </span>

          <div className="room-info__copy">
            <label
              className="room-info__label"
              htmlFor="master-volume"
            >
              Master volume
            </label>

            <strong className="room-info__value">
              {Math.round(state.volume * 100)}%
            </strong>
          </div>
        </div>

        <input
          id="master-volume"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={state.volume}
          onChange={(event) =>
            setVolume(Number(event.target.value))
          }
        />
      </div>
    </section>
  );
}

/* -------------------------------------------------------
   MAIN PAGE CONTENT
------------------------------------------------------- */

function WorkspaceView({ activeView }) {
  if (activeView === 'people') {
    return (
      <div className="min-h-0 w-full overflow-y-auto">
        <PeerList />
      </div>
    );
  }

  if (activeView === 'audio') {
    return (
      <div className="min-h-0 w-full overflow-y-auto">
        <ConnectionAudioPanel />
        <RoomInfoPanel />
      </div>
    );
  }

  if (activeView === 'settings') {
    return (
      <div className="min-h-0 w-full overflow-y-auto">
        <SettingsPanel />
        <OfficeBlueprintImporter />
      </div>
    );
  }

  return <WorldCanvas />;
}

/* -------------------------------------------------------
   RIGHT SIDEBAR CONTENT
------------------------------------------------------- */

function OfficeInformationSidebar() {
  return (
    <>
      <RoomInfoPanel />

      {/* Live participant list with spatial audio indicators */}
      <PeerList />

      <ConnectionAudioPanel />

      <AuditPanel />
    </>
  );
}

/* -------------------------------------------------------
   OFFICE APPLICATION
------------------------------------------------------- */

function Office({
  initialProfile,
  onLeave,
}) {
  const {
    state,
    join,
  } = useProxi();

  const [activeView, setActiveView] = useState('office');

  const [autoJoinError, setAutoJoinError] = useState('');
  const [autoJoining, setAutoJoining] = useState(false);
  const [joinAttempt, setJoinAttempt] = useState(0);

  useEffect(() => {
    if (
      !initialProfile ||
      state.selfId ||
      autoJoining
    ) {
      return;
    }

    let cancelled = false;

    setAutoJoining(true);
    setAutoJoinError('');

    const roomId = new URLSearchParams(
      window.location.search,
    ).get('room');

    join({
      roomId,
      name: initialProfile.name,
      color: initialProfile.color,
      avatar: initialProfile.avatar,
      withMic: initialProfile.withMic !== false,
    })
      .catch((err) => {
        if (!cancelled) {
          setAutoJoinError(
            err.message || 'Unable to enter the office.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAutoJoining(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    initialProfile,
    state.selfId,
    join,
    joinAttempt,
  ]);

  if (!state.selfId) {
    if (initialProfile) {
      return (
        <main className="grid min-h-screen place-items-center bg-[#1E1E1E] px-5 text-[#F6F6F6]">
          <section className="w-full max-w-md rounded-2xl border border-[#454545] bg-[#303030] p-7 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#6252FF] text-xl font-bold">
              P
            </div>

            <h1 className="mt-5 text-xl font-bold">
              {autoJoinError
                ? 'Unable to enter office'
                : 'Entering your office…'}
            </h1>

            <p className="mt-3 text-sm leading-6 text-[#BDBDBD]">
              {autoJoinError ||
                `Preparing your workspace, ${initialProfile.name}…`}
            </p>

            {autoJoinError && (
              <button
                type="button"
                onClick={() => {
                  setAutoJoinError('');
                  setAutoJoining(false);
                  setJoinAttempt((attempt) => attempt + 1);
                }}
                className="mt-6 rounded-xl bg-[#6252FF] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#5546F5]"
              >
                Try again
              </button>
            )}
          </section>
        </main>
      );
    }

    return (
      <div className="app app--gate">
        <StatusBar onLeave={onLeave} />
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
    <div className="app office-app">
      <OfficeSidebar
        activeView={activeView}
        onNavigate={setActiveView}
      />

      <div className="app__workspace">
        <StatusBar onLeave={onLeave} />

        {activeView !== 'office' && (
          <header className="panel__header office-view-header">
            <div>
              <h1>{currentView.title}</h1>
              <p>{currentView.description}</p>
            </div>
          </header>
        )}

        <OfficeLayout
          sidebar={<OfficeInformationSidebar />}
          className={`office-layout office-layout--${activeView}`}
        >
          <WorkspaceView activeView={activeView} />
        </OfficeLayout>
      </div>

      <Notices />
    </div>
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

  const [currentProfile, setCurrentProfile] = useState(() => {
    const roomId = new URLSearchParams(
      window.location.search,
    ).get('room');

    if (!roomId) return null;

    const name =
      localStorage.getItem('proxispeak:name') ?? '';

    if (!name.trim()) return null;

    return {
      name: name.trim(),
      color:
        localStorage.getItem('proxispeak:color') ??
        '#4f8cff',
      avatar:
        localStorage.getItem('proxispeak:avatar') ??
        'circle',
      withMic:
        localStorage.getItem('proxispeak:withMic') !==
        'false',
    };
  });

  const currentUser = user?.username ?? null;

  const handleLogin = useCallback(
    async (username) => {
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

      try {
        await login({
          token,
          username: username.trim(),
        });

        setCurrentRoom(null);
        setCurrentProfile(null);

        localStorage.removeItem(
          'proxispeak:withMic',
        );

        const url = new URL(window.location.href);
        url.searchParams.delete('room');

        window.history.replaceState({}, '', url);

        navigate('/dashboard', {
          replace: true,
        });

        return true;
      } catch (error) {
        console.error(
          'Login session initialization failed:',
          error.message,
        );

        throw error;
      }
    },
    [login, navigate],
  );

  const handleLogout = useCallback(() => {
    logout();

    setCurrentRoom(null);
    setCurrentProfile(null);

    const url = new URL(window.location.href);

    url.searchParams.delete('room');

    window.history.replaceState({}, '', url);

    navigate('/login', {
      replace: true,
    });
  }, [logout, navigate]);

  const handleJoinRoom = useCallback(
    (roomId, meetingProfile = null) => {
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

      if (
        meetingProfile &&
        typeof meetingProfile.name === 'string'
      ) {
        const nextProfile = {
          name: meetingProfile.name.trim(),
          color: meetingProfile.color || '#4f8cff',
          avatar: meetingProfile.avatar || 'circle',
          withMic: meetingProfile.withMic !== false,
        };

        setCurrentProfile(nextProfile);

        localStorage.setItem(
          'proxispeak:name',
          nextProfile.name,
        );

        localStorage.setItem(
          'proxispeak:color',
          nextProfile.color,
        );

        localStorage.setItem(
          'proxispeak:avatar',
          nextProfile.avatar,
        );

        localStorage.setItem(
          'proxispeak:withMic',
          String(nextProfile.withMic),
        );
      } else {
        setCurrentProfile(null);
      }
    },
    [],
  );

  const handleLeaveMeeting = useCallback(() => {
    setCurrentRoom(null);
    setCurrentProfile(null);

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

  useEffect(() => {
    const handlePopState = () => {
      const roomId = new URLSearchParams(
        window.location.search,
      ).get('room');

      const normalizedRoomId =
        typeof roomId === 'string'
          ? roomId.trim().toLowerCase()
          : '';

      const validRoom =
        ROOM_ID_PATTERN.test(normalizedRoomId);

      setCurrentRoom(
        validRoom ? normalizedRoomId : null,
      );

      if (validRoom) {
        const name =
          localStorage.getItem('proxispeak:name') ?? '';

        setCurrentProfile(
          name.trim()
            ? {
                name: name.trim(),
                color:
                  localStorage.getItem('proxispeak:color') ??
                  '#4f8cff',
                avatar:
                  localStorage.getItem('proxispeak:avatar') ??
                  'circle',
                withMic:
                  localStorage.getItem('proxispeak:withMic') !==
                  'false',
              }
            : null,
        );
      } else {
        setCurrentProfile(null);
      }
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

  if (!currentUser) {
    return (
      <AuthRoutes onLogin={handleLogin} />
    );
  }

  if (!currentRoom) {
    return (
      <Dashboard
        username={currentUser}
        onJoinRoom={handleJoinRoom}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <ProxiProvider>
      <div className="min-h-screen bg-[#1E1E1E]">
        <Office
          initialProfile={currentProfile}
          onLeave={handleLeaveMeeting}
        />
      </div>
    </ProxiProvider>
  );
}

export default App;