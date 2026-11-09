import React from 'react';

function formatMeetingDate(dateValue) {
  if (!dateValue) return 'Date unavailable';

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatDuration(durationSeconds) {
  const seconds = Number(durationSeconds);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 'Duration unavailable';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes} min`;
  }

  return `${seconds} sec`;
}

function getMeetingStatus(status) {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'active' || normalized === 'ongoing') {
    return {
      label: 'In progress',
      className: 'meeting-status-active',
    };
  }

  if (normalized === 'completed' || normalized === 'ended') {
    return {
      label: 'Completed',
      className: 'meeting-status-completed',
    };
  }

  if (normalized === 'cancelled' || normalized === 'canceled') {
    return {
      label: 'Cancelled',
      className: 'meeting-status-cancelled',
    };
  }

  return {
    label: status || 'Meeting',
    className: 'meeting-status-default',
  };
}

function HistoryIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 12a9 9 0 1 0 2.64-6.36L3 8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 3v5h5M12 7v5l3.5 2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3.5"
        y="5"
        width="17"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M7.5 3v4M16.5 3v4M3.5 10h17"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M12 7v5l3.2 2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EmptyHistory({ onRefresh }) {
  return (
    <div className="dashboard-history-empty">
      <div className="dashboard-history-empty-icon">
        <HistoryIcon />
      </div>

      <h3>No meetings yet</h3>

      <p>
        Your previous meetings will appear here once you start using
        ProxiSpeakMeet.
      </p>

      {onRefresh && (
        <button
          type="button"
          className="dashboard-history-secondary-button"
          onClick={onRefresh}
        >
          Refresh history
        </button>
      )}
    </div>
  );
}

function HistoryLoading() {
  return (
    <div className="dashboard-history-list" aria-label="Loading meeting history">
      {[1, 2, 3].map((item) => (
        <div className="dashboard-history-skeleton" key={item}>
          <div className="history-skeleton-icon" />

          <div className="history-skeleton-content">
            <div className="history-skeleton-line history-skeleton-title" />
            <div className="history-skeleton-line history-skeleton-subtitle" />
          </div>

          <div className="history-skeleton-line history-skeleton-action" />
        </div>
      ))}
    </div>
  );
}

function MeetingHistoryCard({
  meeting,
  onRejoin,
  joiningMeeting,
}) {
  const meetingId = meeting?._id || meeting?.sessionId || meeting?.roomId;
  const status = getMeetingStatus(meeting?.status);

  const roomName = meeting?.roomName || 'Untitled meeting';
  const roomId = meeting?.roomId || 'ID unavailable';

  const startedAt = meeting?.startedAt;
  const duration = formatDuration(meeting?.durationSeconds);

  const isRejoining = joiningMeeting === roomId;

  return (
    <article className="dashboard-history-card">
      <div className="dashboard-history-card-main">
        <div className="dashboard-history-room-icon">
          <HistoryIcon />
        </div>

        <div className="dashboard-history-details">
          <div className="dashboard-history-title-row">
            <h3>{roomName}</h3>

            <span className={`meeting-status ${status.className}`}>
              <span className="meeting-status-dot" />
              {status.label}
            </span>
          </div>

          <div className="dashboard-history-meta">
            <span className="history-meta-item">
              <CalendarIcon />
              {formatMeetingDate(startedAt)}
            </span>

            <span className="history-meta-item">
              <ClockIcon />
              {duration}
            </span>

            <span className="history-meta-room-id">
              ID: {roomId}
            </span>
          </div>
        </div>
      </div>

      <div className="dashboard-history-card-action">
        <button
          type="button"
          className="dashboard-history-rejoin-button"
          onClick={() => onRejoin?.(roomId, meeting)}
          disabled={!roomId || roomId === 'ID unavailable' || joiningMeeting}
          aria-label={`Rejoin ${roomName}`}
        >
          {isRejoining ? (
            <>
              <span className="dashboard-button-spinner" />
              Joining
            </>
          ) : (
            <>
              Rejoin
              <span aria-hidden="true">↗</span>
            </>
          )}
        </button>
      </div>
    </article>
  );
}

export default function DashboardHistory({
  meetings = [],
  loading = false,
  error = '',
  joiningMeeting = null,
  onRefresh,
  onRejoin,
}) {
  const safeMeetings = Array.isArray(meetings) ? meetings : [];

  return (
    <section className="dashboard-history-section">
      <div className="dashboard-history-heading">
        <div>
          <span className="dashboard-section-eyebrow">
            YOUR ACTIVITY
          </span>

          <h2>Meeting history</h2>

          <p>
            Keep track of your previous conversations and reconnect
            whenever you need.
          </p>
        </div>

        <button
          type="button"
          className="dashboard-history-refresh-button"
          onClick={onRefresh}
          disabled={loading || !onRefresh}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M20 7v5h-5M4 17v-5h5"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5.5 9a7 7 0 0 1 11.8-2L20 12M4 12l2.7 5a7 7 0 0 0 11.8-2"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="dashboard-history-error" role="alert">
          <span>{error}</span>

          {onRefresh && (
            <button type="button" onClick={onRefresh}>
              Try again
            </button>
          )}
        </div>
      )}

      {loading && safeMeetings.length === 0 ? (
        <HistoryLoading />
      ) : safeMeetings.length === 0 ? (
        <EmptyHistory onRefresh={onRefresh} />
      ) : (
        <div className="dashboard-history-list">
          {safeMeetings.map((meeting, index) => (
            <MeetingHistoryCard
              key={
                meeting?._id ||
                meeting?.sessionId ||
                meeting?.roomId ||
                `meeting-${index}`
              }
              meeting={meeting}
              onRejoin={onRejoin}
              joiningMeeting={joiningMeeting}
            />
          ))}
        </div>
      )}
    </section>
  );
}