import { useCallback, useEffect, useState } from 'react';

import config from '../config.js';
import CreateMeetingModal from './CreateMeetingModal.jsx';

import DashboardSidebar from './dashboard/DashboardSidebar.jsx';
import DashboardTopbar from './dashboard/DashboardTopbar.jsx';
import DashboardHero from './dashboard/DashboardHero.jsx';
import DashboardStats from './dashboard/DashboardStats.jsx';
import DashboardActions from './dashboard/DashboardActions.jsx';
import DashboardRooms from './dashboard/DashboardRooms.jsx';
import DashboardHistory from './dashboard/DashboardHistory.jsx';
import DashboardProfile from './dashboard/DashboardProfile.jsx';
import DashboardSettings from './dashboard/DashboardSettings.jsx';
import DashboardMobileNav from './dashboard/DashboardMobileNav.jsx';

import './dashboard/dashboard.css';

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

const SECTION_TITLES = {
  dashboard: 'Dashboard',
  history: 'Past meetings',
  profile: 'Profile',
  settings: 'Settings',
};

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
  const [profileLoading, setProfileLoading] = useState(false);

  const [joiningRoom, setJoiningRoom] = useState(false);
  const [joiningMeetingId, setJoiningMeetingId] = useState(null);

  const [showCreateModal, setShowCreateModal] = useState(false);

  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [notice, setNotice] = useState('');

  const busy = joiningRoom;

  const displayName =
    profile?.username ||
    profile?.name ||
    username ||
    'User';

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

    void loadDashboardData(controller.signal);

    return () => controller.abort();
  }, [loadDashboardData]);

  useEffect(() => {
    const controller = new AbortController();

    void loadMeetingHistory(controller.signal);

    return () => controller.abort();
  }, [loadMeetingHistory]);

  const refreshDashboard = useCallback(() => {
    const controller = new AbortController();
    void loadDashboardData(controller.signal);
  }, [loadDashboardData]);

  const refreshHistory = useCallback(() => {
    const controller = new AbortController();
    void loadMeetingHistory(controller.signal);
  }, [loadMeetingHistory]);

  const handleMeetingCreated = ({ roomId: createdRoomId }) => {
    if (!createdRoomId) return;

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
    setNotice('');
    setActiveSection('dashboard');
  };

  const rejoinMeeting = async (id) => {
    if (busy || !id) return;

    setJoiningRoom(true);
    setJoiningMeetingId(id);
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
      setError(
        err.message ||
          'Unable to rejoin this meeting.',
      );
    } finally {
      setJoiningRoom(false);
      setJoiningMeetingId(null);
    }
  };

  const scrollToJoin = () => {
    document
      .getElementById('join-meeting')
      ?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
  };

  const openProfile = () => {
    setActiveSection('profile');
  };

  const renderDashboardContent = () => (
    <div className="dashboard-page-content">
      <DashboardHero
        username={displayName}
        onCreateMeeting={() => setShowCreateModal(true)}
        onJoinMeeting={scrollToJoin}
        disabled={loading || busy}
      />

      <DashboardStats
        roomCount={rooms.length}
        meetingCount={meetings.length}
      />

      <DashboardActions
        onCreateMeeting={() => setShowCreateModal(true)}
        onJoinMeeting={scrollToJoin}
        disabled={loading || busy}
      />

      <section
        id="join-meeting"
        className="dashboard-join-section"
      >
        <div className="dashboard-join-heading">
          <div>
            <span className="dashboard-section-eyebrow">
              HAVE AN INVITATION?
            </span>

            <h2>Join a meeting</h2>

            <p>
              Enter the meeting ID shared by your host.
            </p>
          </div>
        </div>

        <form
          onSubmit={joinMeeting}
          className="dashboard-join-form"
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
            aria-label="Meeting ID"
          />

          <button
            type="submit"
            disabled={busy || !roomId.trim()}
          >
            {joiningRoom ? 'Joining...' : 'Join meeting'}
            <span aria-hidden="true">↗</span>
          </button>
        </form>
      </section>

      <DashboardRooms
        rooms={rooms}
        loading={loading}
        joiningRoom={busy}
        onRefresh={refreshDashboard}
        onSelectRoom={openMeeting}
        onCreateMeeting={() => setShowCreateModal(true)}
      />
    </div>
  );

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'history':
        return (
          <DashboardHistory
            meetings={meetings}
            loading={historyLoading}
            error={historyError}
            joiningMeeting={joiningMeetingId}
            onRefresh={refreshHistory}
            onRejoin={rejoinMeeting}
          />
        );

      case 'profile':
        return (
          <DashboardProfile
            profile={profile}
            username={username}
            loading={profileLoading}
            error={error}
            onRefresh={async () => {
              setProfileLoading(true);

              try {
                const response = await fetch(
                  `${API_BASE_URL}/api/auth/me`,
                  {
                    method: 'GET',
                    headers: getAuthHeaders(),
                  },
                );

                const payload = await readResponse(response);

                if (!payload.user) {
                  throw new Error('Invalid profile response.');
                }

                setProfile(payload.user);
                setError('');
              } catch (err) {
                setError(
                  err.message || 'Unable to refresh your profile.',
                );
              } finally {
                setProfileLoading(false);
              }
            }}
          />
        );

      case 'settings':
        return (
          <DashboardSettings
            profile={profile}
            username={username}
            onLogout={onLogout}
          />
        );

      case 'dashboard':
      default:
        return renderDashboardContent();
    }
  };

  return (
    <div className="dashboard-shell">
      <DashboardSidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        username={displayName}
        onLogout={onLogout}
      />

      <div className="dashboard-main">
        <DashboardTopbar
          activeSection={SECTION_TITLES[activeSection] ? activeSection : 'dashboard'}
          username={displayName}
          onOpenProfile={openProfile}
        />

        <main
          className="dashboard-content-scroll"
          id="dashboard-main-content"
        >
          <div className="dashboard-content-inner">
            {(error && activeSection !== 'profile') && (
              <div
                className="dashboard-global-alert"
                role="alert"
              >
                <span>{error}</span>

                <button
                  type="button"
                  onClick={refreshDashboard}
                  disabled={loading}
                >
                  Retry
                </button>
              </div>
            )}

            {notice && (
              <div
                className="dashboard-global-notice"
                role="status"
              >
                <span>{notice}</span>

                <button
                  type="button"
                  onClick={() => setNotice('')}
                  aria-label="Dismiss notification"
                >
                  ×
                </button>
              </div>
            )}

            {renderActiveSection()}
          </div>
        </main>
      </div>

      <DashboardMobileNav
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />

      {showCreateModal && (
        <CreateMeetingModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleMeetingCreated}
        />
      )}
    </div>
  );
}