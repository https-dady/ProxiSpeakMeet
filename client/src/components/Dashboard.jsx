import { useCallback, useEffect, useState } from 'react';

import config from '../config.js';

const API_BASE_URL = String(config.serverUrl).replace(/\/+$/, '');
const ROOM_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,47}$/;

function getAuthHeaders() {
  const token = localStorage.getItem('token');

  return {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload.error ||
        payload.message ||
        `Request failed with status ${response.status}.`,
    );
  }

  return payload;
}

function NavItem({ active, icon, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
        active
          ? 'border border-[#8175ff]/20 bg-[#8175ff]/15 text-[#a69cff]'
          : 'border border-transparent text-[#9ba9c2] hover:bg-[#151e30] hover:text-[#edf2ff]'
      }`}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-base">
        {icon}
      </span>

      {children}
    </button>
  );
}

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="mb-8">
      <p className="mb-2 text-[10px] font-bold tracking-[0.22em] text-[#a69cff]">
        {eyebrow}
      </p>

      <h1 className="text-2xl font-bold tracking-tight text-[#edf2ff] sm:text-3xl">
        {title}
      </h1>

      {description && (
        <p className="mt-2 text-sm leading-6 text-[#9ba9c2]">
          {description}
        </p>
      )}
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  buttonText,
  onClick,
  secondary = false,
  disabled = false,
}) {
  return (
    <article className="group rounded-2xl border border-[#263149] bg-[#101625] p-6 transition hover:border-[#8175ff]/40">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-[#8175ff]/20 bg-[#8175ff]/10 text-xl text-[#a69cff]">
        {icon}
      </div>

      <h3 className="text-lg font-semibold text-[#edf2ff]">
        {title}
      </h3>

      <p className="mt-2 min-h-12 text-sm leading-6 text-[#9ba9c2]">
        {description}
      </p>

      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
          secondary
            ? 'border border-[#263149] bg-[#151e30] text-[#edf2ff] hover:border-[#8175ff]/50'
            : 'bg-[#8175ff] text-white shadow-lg shadow-[#8175ff]/10 hover:bg-[#7164f0]'
        }`}
      >
        {buttonText}
        <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}

export default function Dashboard({
  username,
  onJoinRoom,
  onLogout,
}) {
  const [activeSection, setActiveSection] = useState('dashboard');

  const [profile, setProfile] = useState(null);
  const [rooms, setRooms] = useState([]);

  const [roomId, setRoomId] = useState('');

  const [loading, setLoading] = useState(true);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const busy = creatingRoom || joiningRoom;

  const loadDashboardData = useCallback(async (signal) => {
    setLoading(true);
    setError('');

    try {
      const [profileResponse, roomsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/auth/me`, {
          method: 'GET',
          headers: getAuthHeaders(),
          signal,
        }),

        fetch(`${API_BASE_URL}/api/rooms`, {
          method: 'GET',
          headers: getAuthHeaders(),
          signal,
        }),
      ]);

      const [profilePayload, roomsPayload] = await Promise.all([
        readResponse(profileResponse),
        readResponse(roomsResponse),
      ]);

      if (!profilePayload.user || !Array.isArray(roomsPayload.rooms)) {
        throw new Error('The server returned invalid dashboard data.');
      }

      if (signal?.aborted) return;

      setProfile(profilePayload.user);

      setRooms(
        roomsPayload.rooms.filter(
          (room) =>
            room &&
            typeof room.roomId === 'string' &&
            ROOM_ID_PATTERN.test(room.roomId),
        ),
      );
    } catch (err) {
      if (err.name === 'AbortError' || signal?.aborted) {
        return;
      }

      setError(
        err.message ||
          'Unable to load your dashboard. Please try again.',
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void loadDashboardData(controller.signal);

    return () => controller.abort();
  }, [loadDashboardData]);

  const createMeeting = async () => {
    if (busy) return;

    setCreatingRoom(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/rooms`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const payload = await readResponse(response);
      const createdRoomId = payload.roomId ?? payload.room?.roomId;

      if (
        typeof createdRoomId !== 'string' ||
        !ROOM_ID_PATTERN.test(createdRoomId)
      ) {
        throw new Error('The server returned an invalid meeting ID.');
      }

      setNotice(`Meeting ${createdRoomId} created successfully.`);

      onJoinRoom(createdRoomId);
    } catch (err) {
      setError(
        err.message ||
          'Unable to create a meeting. Please try again.',
      );
    } finally {
      setCreatingRoom(false);
    }
  };

  const joinMeeting = async (event) => {
    event.preventDefault();

    if (busy) return;

    const normalizedRoomId = roomId.trim().toLowerCase();

    if (!ROOM_ID_PATTERN.test(normalizedRoomId)) {
      setError(
        'Enter a valid meeting ID using letters, numbers, hyphens or underscores.',
      );
      return;
    }

    setJoiningRoom(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/rooms/${encodeURIComponent(normalizedRoomId)}`,
        {
          method: 'GET',
          headers: getAuthHeaders(),
        },
      );

      await readResponse(response);

      onJoinRoom(normalizedRoomId);
    } catch (err) {
      setError(
        err.message ||
          'Unable to join this meeting. Check the meeting ID.',
      );
    } finally {
      setJoiningRoom(false);
    }
  };

  const openMeeting = (id) => {
    setRoomId(id);
    setError('');

    setActiveSection('dashboard');
  };

  const displayName =
    profile?.username || username || 'User';

  const initials = displayName
    .trim()
    .slice(0, 2)
    .toUpperCase();

  const renderDashboard = () => (
    <>
      <SectionHeading
        eyebrow="YOUR WORKSPACE"
        title={`Welcome back, ${displayName}`}
        description="Your space for meaningful conversations and collaboration."
      />

      <section className="mb-8 overflow-hidden rounded-2xl border border-[#8175ff]/20 bg-gradient-to-br from-[#1b2140] via-[#151e30] to-[#101625] p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
          <div className="max-w-xl">
            <span className="inline-flex rounded-full border border-[#8175ff]/30 bg-[#8175ff]/10 px-3 py-1.5 text-[10px] font-semibold tracking-[0.18em] text-[#a69cff]">
              PROXISPEAK MEET
            </span>

            <h2 className="mt-5 text-2xl font-bold leading-tight text-[#edf2ff] sm:text-3xl">
              Conversations feel better when everyone is connected.
            </h2>

            <p className="mt-3 text-sm leading-7 text-[#9ba9c2]">
              Create a new meeting or join an existing workspace
              and connect with people through proximity-powered audio.
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-3 sm:flex-row md:flex-col">
            <button
              type="button"
              onClick={createMeeting}
              disabled={busy || loading}
              className="rounded-xl bg-[#8175ff] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#8175ff]/20 transition hover:bg-[#7164f0] disabled:opacity-50"
            >
              {creatingRoom ? 'Creating…' : '+ Create meeting'}
            </button>

            <button
              type="button"
              onClick={() => {
                document
                  .getElementById('join-meeting')
                  ?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="rounded-xl border border-[#526080] bg-[#151e30]/70 px-6 py-3.5 text-sm font-semibold text-[#edf2ff] transition hover:border-[#a69cff]"
            >
              Join a meeting
            </button>
          </div>
        </div>
      </section>

      <div className="mb-8 grid gap-5 sm:grid-cols-2">
        <ActionCard
          icon="✦"
          title="Create a meeting"
          description="Start a new virtual office and invite people to join your conversation."
          buttonText={creatingRoom ? 'Creating meeting…' : 'Create meeting'}
          onClick={createMeeting}
          disabled={busy || loading}
        />

        <ActionCard
          icon="↗"
          title="Join a meeting"
          description="Have a meeting ID? Enter it and join an existing virtual office."
          buttonText="Enter meeting ID"
          onClick={() =>
            document
              .getElementById('join-meeting')
              ?.scrollIntoView({ behavior: 'smooth' })
          }
          secondary
        />
      </div>

      <section
        id="join-meeting"
        className="mb-8 rounded-2xl border border-[#263149] bg-[#101625] p-6"
      >
        <div className="mb-5">
          <p className="text-[10px] font-bold tracking-[0.2em] text-[#a69cff]">
            HAVE AN INVITATION?
          </p>

          <h2 className="mt-2 text-lg font-semibold text-[#edf2ff]">
            Join with a meeting ID
          </h2>

          <p className="mt-1 text-sm text-[#9ba9c2]">
            Enter the meeting ID shared by your host.
          </p>
        </div>

        <form
          onSubmit={joinMeeting}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <input
            type="text"
            value={roomId}
            onChange={(event) => {
              setRoomId(event.target.value);
              setError('');
            }}
            placeholder="Enter meeting ID"
            maxLength={48}
            autoComplete="off"
            disabled={busy}
            className="min-w-0 flex-1 rounded-xl border border-[#263149] bg-[#080b14] px-4 py-3.5 text-sm text-[#edf2ff] outline-none transition placeholder:text-[#71809a] focus:border-[#8175ff] focus:ring-2 focus:ring-[#8175ff]/20 disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={busy || !roomId.trim()}
            className="rounded-xl bg-[#8175ff] px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-[#7164f0] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {joiningRoom ? 'Joining…' : 'Join meeting'}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-[#263149] bg-[#101625] p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] text-[#a69cff]">
              DISCOVER
            </p>

            <h2 className="mt-2 text-lg font-semibold text-[#edf2ff]">
              Available rooms
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              const controller = new AbortController();
              void loadDashboardData(controller.signal);
            }}
            disabled={loading}
            className="text-xs font-semibold text-[#a69cff] transition hover:text-white disabled:opacity-50"
          >
            Refresh list
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-[#9ba9c2]">
            Loading available rooms…
          </p>
        ) : rooms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#263149] px-5 py-8 text-center">
            <p className="text-sm font-medium text-[#edf2ff]">
              No rooms available yet
            </p>

            <p className="mt-2 text-xs text-[#9ba9c2]">
              Create a new meeting to start your first virtual office.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => (
              <div
                key={room.roomId}
                className="flex flex-col justify-between gap-4 rounded-xl border border-[#263149] bg-[#151e30]/60 p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-[#edf2ff]">
                    {room.name || room.roomId}
                  </h3>

                  <p className="mt-1 text-xs text-[#71809a]">
                    ID: {room.roomId}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <span className="text-xs text-[#9ba9c2]">
                    {room.liveUsers ?? 0} online
                  </span>

                  <button
                    type="button"
                    onClick={() => openMeeting(room.roomId)}
                    disabled={busy}
                    className="rounded-lg border border-[#8175ff]/30 px-4 py-2 text-xs font-semibold text-[#a69cff] transition hover:bg-[#8175ff]/10 disabled:opacity-50"
                  >
                    Select
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );

  const renderHistory = () => (
    <>
      <SectionHeading
        eyebrow="YOUR ACTIVITY"
        title="Past meetings"
        description="Your previous meetings and participation history."
      />

      <section className="rounded-2xl border border-[#263149] bg-[#101625] p-8">
        <div className="mx-auto max-w-md py-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#8175ff]/20 bg-[#8175ff]/10 text-2xl text-[#a69cff]">
            ◷
          </div>

          <h2 className="mt-6 text-lg font-semibold text-[#edf2ff]">
            Meeting history is being prepared
          </h2>

          <p className="mt-3 text-sm leading-7 text-[#9ba9c2]">
            Your meeting history will be saved to your account and
            available across your devices. No meeting records will
            be displayed until the persistent history service is ready.
          </p>
        </div>
      </section>
    </>
  );

  const renderProfile = () => (
    <>
      <SectionHeading
        eyebrow="YOUR ACCOUNT"
        title="Profile"
        description="Your ProxiSpeak Meet account information."
      />

      <section className="rounded-2xl border border-[#263149] bg-[#101625] p-6 sm:p-8">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#8175ff]/15 text-2xl font-bold text-[#a69cff]">
            {initials}
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#edf2ff]">
              {displayName}
            </h2>

            <p className="mt-1 text-sm text-[#9ba9c2]">
              ProxiSpeak Meet member
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-[#263149] pt-6">
          <p className="text-xs font-semibold tracking-wider text-[#71809a]">
            USERNAME
          </p>

          <p className="mt-2 text-sm text-[#edf2ff]">
            {profile?.username || username || '—'}
          </p>
        </div>

        <p className="mt-6 text-xs leading-6 text-[#71809a]">
          Additional profile details can be added when the account
          profile API exposes them.
        </p>
      </section>
    </>
  );

  const renderSettings = () => (
    <>
      <SectionHeading
        eyebrow="PREFERENCES"
        title="Settings"
        description="Manage your account session and application preferences."
      />

      <section className="rounded-2xl border border-[#263149] bg-[#101625] p-6">
        <h2 className="text-base font-semibold text-[#edf2ff]">
          Account session
        </h2>

        <p className="mt-2 text-sm leading-6 text-[#9ba9c2]">
          Sign out of your ProxiSpeak Meet account on this device.
        </p>

        <button
          type="button"
          onClick={onLogout}
          className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 px-5 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-400/15"
        >
          Sign out
        </button>
      </section>
    </>
  );

  const sectionContent = {
    dashboard: renderDashboard,
    history: renderHistory,
    profile: renderProfile,
    settings: renderSettings,
  };

  const activeContent = sectionContent[activeSection] || renderDashboard;

  return (
    <div className="min-h-screen bg-[#080b14] text-[#edf2ff]">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-[#263149] bg-[#0d131c] px-5 py-7 lg:flex">
          <div className="mb-12 flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8175ff] text-lg font-bold text-white">
              P
            </div>

            <div>
              <p className="text-sm font-bold tracking-tight">
                ProxiSpeak
              </p>

              <p className="text-xs text-[#a69cff]">
                Meet
              </p>
            </div>
          </div>

          <p className="mb-3 px-3 text-[10px] font-bold tracking-[0.2em] text-[#71809a]">
            WORKSPACE
          </p>

          <nav className="space-y-2">
            <NavItem
              active={activeSection === 'dashboard'}
              icon="⌂"
              onClick={() => setActiveSection('dashboard')}
            >
              Dashboard
            </NavItem>

            <NavItem
              active={activeSection === 'history'}
              icon="◷"
              onClick={() => setActiveSection('history')}
            >
              Past meetings
            </NavItem>
          </nav>

          <p className="mb-3 mt-10 px-3 text-[10px] font-bold tracking-[0.2em] text-[#71809a]">
            ACCOUNT
          </p>

          <nav className="space-y-2">
            <NavItem
              active={activeSection === 'profile'}
              icon="◎"
              onClick={() => setActiveSection('profile')}
            >
              Profile
            </NavItem>

            <NavItem
              active={activeSection === 'settings'}
              icon="⚙"
              onClick={() => setActiveSection('settings')}
            >
              Settings
            </NavItem>
          </nav>

          <div className="mt-auto border-t border-[#263149] pt-6">
            <div className="mb-5 flex items-center gap-3 px-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#8175ff]/15 text-xs font-bold text-[#a69cff]">
                {initials}
              </div>

              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-[#edf2ff]">
                  {displayName}
                </p>

                <p className="text-[10px] text-[#71809a]">
                  Account
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="w-full rounded-xl px-4 py-3 text-left text-xs font-semibold text-[#9ba9c2] transition hover:bg-red-400/10 hover:text-red-300"
            >
              ↪ Sign out
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#263149] bg-[#080b14]/90 px-5 py-4 backdrop-blur-xl sm:px-8 lg:px-10">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#8175ff] font-bold text-white">
                P
              </div>

              <span className="text-sm font-bold">
                ProxiSpeak <span className="text-[#a69cff]">Meet</span>
              </span>
            </div>

            <div className="hidden lg:block">
              <p className="text-xs text-[#71809a]">
                YOUR WORKSPACE
              </p>

              <p className="mt-1 text-sm font-semibold text-[#edf2ff]">
                {activeSection === 'dashboard'
                  ? 'Dashboard'
                  : activeSection === 'history'
                    ? 'Past meetings'
                    : activeSection === 'profile'
                      ? 'Profile'
                      : 'Settings'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-[#9ba9c2] sm:block">
                {displayName}
              </span>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#8175ff]/20 bg-[#8175ff]/10 text-xs font-bold text-[#a69cff]">
                {initials}
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
            {error && (
              <div
                role="alert"
                className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300"
              >
                <span>{error}</span>

                <button
                  type="button"
                  onClick={() => {
                    const controller = new AbortController();
                    void loadDashboardData(controller.signal);
                  }}
                  className="font-semibold underline underline-offset-4"
                >
                  Retry
                </button>
              </div>
            )}

            {notice && (
              <div
                role="status"
                className="mb-6 rounded-xl border border-[#5ad19a]/20 bg-[#5ad19a]/10 px-4 py-3 text-sm text-[#5ad19a]"
              >
                {notice}
              </div>
            )}

            {activeContent()}
          </div>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-[#263149] bg-[#0d131c]/95 px-2 py-2 backdrop-blur-xl lg:hidden">
        <button
          type="button"
          onClick={() => setActiveSection('dashboard')}
          className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-semibold ${
            activeSection === 'dashboard'
              ? 'text-[#a69cff]'
              : 'text-[#71809a]'
          }`}
        >
          <span className="text-lg">⌂</span>
          Home
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('history')}
          className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-semibold ${
            activeSection === 'history'
              ? 'text-[#a69cff]'
              : 'text-[#71809a]'
          }`}
        >
          <span className="text-lg">◷</span>
          History
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('profile')}
          className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-semibold ${
            activeSection === 'profile'
              ? 'text-[#a69cff]'
              : 'text-[#71809a]'
          }`}
        >
          <span className="text-lg">◎</span>
          Profile
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('settings')}
          className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-semibold ${
            activeSection === 'settings'
              ? 'text-[#a69cff]'
              : 'text-[#71809a]'
          }`}
        >
          <span className="text-lg">⚙</span>
          Settings
        </button>
      </nav>
    </div>
  );
}