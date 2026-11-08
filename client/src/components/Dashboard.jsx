import { useCallback, useEffect, useState } from 'react';

import config from '../config.js';
import CreateMeetingModal from './CreateMeetingModal.jsx';

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
          ? 'border border-[#F3184C]/20 bg-[#F3184C]/15 text-[#F3184C]'
          : 'border border-transparent text-[#B8B8B8] hover:bg-[#303030] hover:text-[#F6F6F6]'
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
      <p className="mb-2 text-[10px] font-bold tracking-[0.22em] text-[#F3184C]">
        {eyebrow}
      </p>

      <h1 className="text-2xl font-bold tracking-tight text-[#F6F6F6] sm:text-3xl">
        {title}
      </h1>

      {description && (
        <p className="mt-2 text-sm leading-6 text-[#B8B8B8]">
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
    <article className="group rounded-2xl border border-[#303030] bg-[#252525] p-6 transition hover:border-[#F3184C]/40">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-[#F3184C]/20 bg-[#F3184C]/10 text-xl text-[#F3184C]">
        {icon}
      </div>

      <h3 className="text-lg font-semibold text-[#F6F6F6]">
        {title}
      </h3>

      <p className="mt-2 min-h-12 text-sm leading-6 text-[#B8B8B8]">
        {description}
      </p>

      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
          secondary
            ? 'border border-[#303030] bg-[#303030] text-[#F6F6F6] hover:border-[#F3184C]/50'
            : 'bg-[#F3184C] text-white shadow-lg shadow-[#F3184C]/10 hover:bg-[#D91443]'
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
  const [meetings, setMeetings] = useState([]);

  const [roomId, setRoomId] = useState('');

  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);

  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [notice, setNotice] = useState('');

  const busy = joiningRoom;

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

      if (
        !profilePayload.user ||
        !Array.isArray(roomsPayload.rooms)
      ) {
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
      if (err.name === 'AbortError' || signal?.aborted) return;

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

  const loadMeetingHistory = useCallback(async (signal) => {
    setHistoryLoading(true);
    setHistoryError('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/meetings/history?page=1&limit=20`,
        {
          method: 'GET',
          headers: getAuthHeaders(),
          signal,
        },
      );

      const payload = await readResponse(response);
      const records = payload.data?.meetings;

      if (!Array.isArray(records)) {
        throw new Error('The server returned invalid meeting history.');
      }

      if (signal?.aborted) return;

      setMeetings(records);
    } catch (err) {
      if (err.name === 'AbortError' || signal?.aborted) return;

      setHistoryError(
        err.message ||
        'Unable to load meeting history. Please try again.',
      );
    } finally {
      if (!signal?.aborted) {
        setHistoryLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void loadMeetingHistory(controller.signal);

    return () => controller.abort();
  }, [loadMeetingHistory]);

  useEffect(() => {
    const controller = new AbortController();

    void loadDashboardData(controller.signal);

    return () => controller.abort();
  }, [loadDashboardData]);

  /**
   * Called only after CreateMeetingModal successfully creates a room.
   * The modal owns the creation request and its validation state.
   */
  const handleMeetingCreated = ({ roomId: createdRoomId }) => {
    setShowCreateModal(false);
    setNotice(`Meeting ${createdRoomId} created successfully.`);
    setError('');

    onJoinRoom(createdRoomId);
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

  const rejoinMeeting = async (id) => {
    if (busy || !id) return;

    setJoiningRoom(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/rooms/${encodeURIComponent(id)}`,
        {
          method: 'GET',
          headers: getAuthHeaders(),
        },
      );

      await readResponse(response);

      onJoinRoom(id);
    } catch (err) {
      setError(err.message || 'Unable to rejoin this meeting.');
    } finally {
      setJoiningRoom(false);
    }
  };

  const displayName =
    profile?.username || username || 'User';

  const initials = displayName
    .trim()
    .slice(0, 2)
    .toUpperCase();

  const scrollToJoin = () => {
    document
      .getElementById('join-meeting')
      ?.scrollIntoView({ behavior: 'smooth' });
  };

  const renderDashboard = () => (
    <>
      <SectionHeading
        eyebrow="YOUR WORKSPACE"
        title={`Welcome back, ${displayName}`}
        description="Your space for meaningful conversations and collaboration."
      />

      <section className="mb-8 overflow-hidden rounded-2xl border border-[#F3184C]/20 bg-gradient-to-br from-[#303030] via-[#252525] to-[#1E1E1E] p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
          <div className="max-w-xl">
            <span className="inline-flex rounded-full border border-[#F3184C]/30 bg-[#F3184C]/10 px-3 py-1.5 text-[10px] font-semibold tracking-[0.18em] text-[#F3184C]">
              PROXISPEAK MEET
            </span>

            <h2 className="mt-5 text-2xl font-bold leading-tight text-[#F6F6F6] sm:text-3xl">
              Conversations feel better when everyone is connected.
            </h2>

            <p className="mt-3 text-sm leading-7 text-[#B8B8B8]">
              Create a new meeting or join an existing workspace
              and connect with people through proximity-powered audio.
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-3 sm:flex-row md:flex-col">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              disabled={loading || busy}
              className="rounded-xl bg-[#F3184C] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#F3184C]/20 transition hover:bg-[#D91443] disabled:opacity-50"
            >
              + Create meeting
            </button>

            <button
              type="button"
              onClick={scrollToJoin}
              className="rounded-xl border border-[#686868] bg-[#303030]/70 px-6 py-3.5 text-sm font-semibold text-[#F6F6F6] transition hover:border-[#F3184C]"
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
          description="Start a new virtual office, choose its visibility and authorize participants."
          buttonText="Create meeting"
          onClick={() => setShowCreateModal(true)}
          disabled={busy || loading}
        />

        <ActionCard
          icon="↗"
          title="Join a meeting"
          description="Have a meeting ID? Enter it and join an existing virtual office."
          buttonText="Enter meeting ID"
          onClick={scrollToJoin}
          secondary
        />
      </div>

      <section
        id="join-meeting"
        className="mb-8 rounded-2xl border border-[#303030] bg-[#252525] p-6"
      >
        <div className="mb-5">
          <p className="text-[10px] font-bold tracking-[0.2em] text-[#F3184C]">
            HAVE AN INVITATION?
          </p>

          <h2 className="mt-2 text-lg font-semibold text-[#F6F6F6]">
            Join with a meeting ID
          </h2>

          <p className="mt-1 text-sm text-[#B8B8B8]">
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
            className="min-w-0 flex-1 rounded-xl border border-[#303030] bg-[#1E1E1E] px-4 py-3.5 text-sm text-[#F6F6F6] outline-none transition placeholder:text-[#8A8A8A] focus:border-[#F3184C] focus:ring-2 focus:ring-[#F3184C]/20 disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={busy || !roomId.trim()}
            className="rounded-xl bg-[#F3184C] px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-[#D91443] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {joiningRoom ? 'Joining…' : 'Join meeting'}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-[#303030] bg-[#252525] p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] text-[#F3184C]">
              DISCOVER
            </p>

            <h2 className="mt-2 text-lg font-semibold text-[#F6F6F6]">
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
            className="text-xs font-semibold text-[#F3184C] transition hover:text-white disabled:opacity-50"
          >
            Refresh list
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-[#B8B8B8]">
            Loading available rooms…
          </p>
        ) : rooms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#303030] px-5 py-8 text-center">
            <p className="text-sm font-medium text-[#F6F6F6]">
              No rooms available yet
            </p>

            <p className="mt-2 text-xs text-[#B8B8B8]">
              Create a new meeting to start your first virtual office.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => (
              <div
                key={room.roomId}
                className="flex flex-col justify-between gap-4 rounded-xl border border-[#303030] bg-[#303030]/60 p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-[#F6F6F6]">
                    {room.name || room.roomId}
                  </h3>

                  <p className="mt-1 text-xs text-[#8A8A8A]">
                    ID: {room.roomId}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <span className="text-xs text-[#B8B8B8]">
                    {room.liveUsers ?? 0} online
                  </span>

                  <button
                    type="button"
                    onClick={() => openMeeting(room.roomId)}
                    disabled={busy}
                    className="rounded-lg border border-[#F3184C]/30 px-4 py-2 text-xs font-semibold text-[#F3184C] transition hover:bg-[#F3184C]/10 disabled:opacity-50"
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

  const formatMeetingDate = (value) => {
    if (!value) return 'Date unavailable';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return 'Date unavailable';
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  const formatDuration = (seconds) => {
    const safeSeconds = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const remainingSeconds = safeSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;

    return `${remainingSeconds}s`;
  };

  const renderHistory = () => (
    <>
      <SectionHeading
        eyebrow="YOUR ACTIVITY"
        title="Past meetings"
        description="Your previous meetings and participation history."
      />

      <section className="rounded-2xl border border-[#303030] bg-[#252525] p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#F6F6F6]">
              Recent activity
            </h2>

            <p className="mt-1 text-sm text-[#B8B8B8]">
              Your latest 20 meeting records.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadMeetingHistory()}
            disabled={historyLoading}
            className="rounded-lg border border-[#F3184C]/40 px-4 py-2 text-xs font-semibold text-[#F3184C] transition hover:bg-[#F3184C]/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {historyLoading ? 'Refreshing…' : 'Refresh history'}
          </button>
        </div>

        {historyError && (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300"
          >
            <span>{historyError}</span>

            <button
              type="button"
              onClick={() => void loadMeetingHistory()}
              className="font-semibold underline underline-offset-4"
            >
              Retry
            </button>
          </div>
        )}

        {historyLoading && meetings.length === 0 ? (
          <div
            className="py-12 text-center text-sm text-[#B8B8B8]"
            role="status"
          >
            Loading your meeting history…
          </div>
        ) : meetings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#686868] px-5 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F3184C]/10 text-2xl text-[#F3184C]">
              ◷
            </div>

            <h3 className="mt-4 text-base font-semibold text-[#F6F6F6]">
              No meetings yet
            </h3>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#B8B8B8]">
              Meetings you join will appear here, so you can revisit your recent activity.
            </p>

            <button
              type="button"
              onClick={() => setActiveSection('dashboard')}
              className="mt-5 rounded-xl bg-[#F3184C] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#D91443]"
            >
              Start a meeting
            </button>
          </div>
        ) : (
          <div className="space-y-3" aria-live="polite">
            {meetings.map((meeting) => {
              const meetingId =
                meeting.roomId ||
                meeting.sessionId ||
                String(meeting._id);

              const status = meeting.status || 'unknown';

              const statusClass =
                status === 'active'
                  ? 'bg-emerald-400/10 text-emerald-300'
                  : status === 'completed'
                    ? 'bg-[#F3184C]/10 text-[#F3184C]'
                    : 'bg-white/10 text-[#B8B8B8]';

              return (
                <article
                  key={meeting._id || meeting.sessionId || meetingId}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-[#303030] bg-[#1E1E1E] p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-[#F6F6F6]">
                      {meeting.roomName || `Meeting ${meeting.roomId || ''}`}
                    </h3>

                    <p className="mt-1 text-xs text-[#B8B8B8]">
                      ID: {meeting.roomId || 'Unavailable'}
                    </p>

                    <p className="mt-1 text-xs text-[#8A8A8A]">
                      {formatMeetingDate(meeting.startedAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold capitalize ${statusClass}`}
                    >
                      {status}
                    </span>

                    <span className="text-xs text-[#B8B8B8]">
                      {formatDuration(meeting.durationSeconds)}
                    </span>

                    <button
                      type="button"
                      onClick={() => void rejoinMeeting(meeting.roomId)}
                      disabled={!meeting.roomId || busy}
                      className="rounded-lg border border-[#F3184C]/40 px-4 py-2 text-xs font-semibold text-[#F3184C] transition hover:bg-[#F3184C]/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Rejoin
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
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

      <section className="rounded-2xl border border-[#303030] bg-[#252525] p-6 sm:p-8">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#F3184C]/15 text-2xl font-bold text-[#F3184C]">
            {initials}
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#F6F6F6]">
              {displayName}
            </h2>

            <p className="mt-1 text-sm text-[#B8B8B8]">
              ProxiSpeak Meet member
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-[#303030] pt-6">
          <p className="text-xs font-semibold tracking-wider text-[#8A8A8A]">
            USERNAME
          </p>

          <p className="mt-2 text-sm text-[#F6F6F6]">
            {profile?.username || username || '—'}
          </p>
        </div>

        <p className="mt-6 text-xs leading-6 text-[#8A8A8A]">
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

      <section className="rounded-2xl border border-[#303030] bg-[#252525] p-6">
        <h2 className="text-base font-semibold text-[#F6F6F6]">
          Account session
        </h2>

        <p className="mt-2 text-sm leading-6 text-[#B8B8B8]">
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

  const activeContent =
    sectionContent[activeSection] || renderDashboard;

  return (
    <div className="min-h-screen bg-[#1E1E1E] text-[#F6F6F6]">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-[#303030] bg-[#1E1E1E] px-5 py-7 lg:flex">
          <div className="mb-12 flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3184C] text-lg font-bold text-white">
              P
            </div>

            <div>
              <p className="text-sm font-bold tracking-tight">
                ProxiSpeak
              </p>

              <p className="text-xs text-[#F3184C]">
                Meet
              </p>
            </div>
          </div>

          <p className="mb-3 px-3 text-[10px] font-bold tracking-[0.2em] text-[#8A8A8A]">
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

          <p className="mb-3 mt-10 px-3 text-[10px] font-bold tracking-[0.2em] text-[#8A8A8A]">
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

          <div className="mt-auto border-t border-[#303030] pt-6">
            <div className="mb-5 flex items-center gap-3 px-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F3184C]/15 text-xs font-bold text-[#F3184C]">
                {initials}
              </div>

              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-[#F6F6F6]">
                  {displayName}
                </p>

                <p className="text-[10px] text-[#8A8A8A]">
                  Account
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="w-full rounded-xl px-4 py-3 text-left text-xs font-semibold text-[#B8B8B8] transition hover:bg-red-400/10 hover:text-red-300"
            >
              ↪ Sign out
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#303030] bg-[#1E1E1E]/90 px-5 py-4 backdrop-blur-xl sm:px-8 lg:px-10">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F3184C] font-bold text-white">
                P
              </div>

              <span className="text-sm font-bold">
                ProxiSpeak <span className="text-[#F3184C]">Meet</span>
              </span>
            </div>

            <div className="hidden lg:block">
              <p className="text-xs text-[#8A8A8A]">
                YOUR WORKSPACE
              </p>

              <p className="mt-1 text-sm font-semibold text-[#F6F6F6]">
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
              <span className="hidden text-xs text-[#B8B8B8] sm:block">
                {displayName}
              </span>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#F3184C]/20 bg-[#F3184C]/10 text-xs font-bold text-[#F3184C]">
                {initials}
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-6xl px-5 py-8 pb-28 sm:px-8 lg:px-10 lg:py-10">
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

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-[#303030] bg-[#1E1E1E]/95 px-2 py-2 backdrop-blur-xl lg:hidden">
        <button
          type="button"
          onClick={() => setActiveSection('dashboard')}
          className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-semibold ${
            activeSection === 'dashboard'
              ? 'text-[#F3184C]'
              : 'text-[#8A8A8A]'
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
              ? 'text-[#F3184C]'
              : 'text-[#8A8A8A]'
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
              ? 'text-[#F3184C]'
              : 'text-[#8A8A8A]'
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
              ? 'text-[#F3184C]'
              : 'text-[#8A8A8A]'
          }`}
        >
          <span className="text-lg">⚙</span>
          Settings
        </button>
      </nav>

      {showCreateModal && (
        <CreateMeetingModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleMeetingCreated}
        />
      )}
    </div>
  );
}