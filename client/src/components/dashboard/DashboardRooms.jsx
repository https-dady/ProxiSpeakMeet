function RoomIcon({ name, size = 20 }) {
  const icons = {
    video: (
      <>
        <rect x="3" y="5" width="13" height="14" rx="2" />
        <path d="m16 10 5-3v10l-5-3" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="10" cy="7" r="4" />
        <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5" />
        <path d="M4 17v-5h5" />
        <path d="M5.6 9a7 7 0 0 1 11.8-2L20 12" />
        <path d="M4 12l2.6 5a7 7 0 0 0 11.8-2" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    sparkle: (
      <>
        <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name]}
    </svg>
  );
}

function LoadingRooms() {
  return (
    <div className="dashboard-rooms-loading" role="status">
      <span className="dashboard-rooms-spinner" />
      <span>Finding available rooms...</span>
    </div>
  );
}

function EmptyRooms({ onCreateMeeting }) {
  return (
    <div className="dashboard-rooms-empty">
      <div className="dashboard-rooms-empty-visual">
        <span className="dashboard-rooms-empty-orbit orbit-one" />
        <span className="dashboard-rooms-empty-orbit orbit-two" />
        <span className="dashboard-rooms-empty-icon">
          <RoomIcon name="video" size={26} />
        </span>
      </div>

      <h3>No rooms available yet</h3>

      <p>
        Your workspace is waiting. Create your first virtual office
        and invite people to connect.
      </p>

      {onCreateMeeting && (
        <button
          type="button"
          className="dashboard-rooms-create-button"
          onClick={onCreateMeeting}
        >
          Create your first room
          <RoomIcon name="arrow" size={16} />
        </button>
      )}
    </div>
  );
}

function RoomCard({ room, onSelect, disabled }) {
  const roomName = room.name || room.roomId;
  const liveUsers = Number(room.liveUsers) || 0;

  return (
    <article className="dashboard-room-card">
      <div className="dashboard-room-card-main">
        <div className="dashboard-room-card-icon">
          <RoomIcon name="video" size={21} />
          <span className="dashboard-room-card-icon-glow" />
        </div>

        <div className="dashboard-room-card-info">
          <h3 title={roomName}>{roomName}</h3>

          <div className="dashboard-room-card-id">
            <span>MEETING ID</span>
            <span>{room.roomId}</span>
          </div>
        </div>
      </div>

      <div className="dashboard-room-card-footer">
        <div className="dashboard-room-live">
          <span className="dashboard-room-live-dot" />
          <strong>{liveUsers}</strong>
          <span>{liveUsers === 1 ? 'person online' : 'people online'}</span>
        </div>

        <button
          type="button"
          className="dashboard-room-join-button"
          onClick={() => onSelect(room.roomId)}
          disabled={disabled}
        >
          Join room
          <RoomIcon name="arrow" size={16} />
        </button>
      </div>
    </article>
  );
}

export default function DashboardRooms({
  rooms = [],
  loading = false,
  joiningRoom = false,
  onRefresh,
  onSelectRoom,
  onCreateMeeting,
}) {
  const validRooms = Array.isArray(rooms) ? rooms : [];

  return (
    <section className="dashboard-rooms-section">
      <div className="dashboard-rooms-heading">
        <div className="dashboard-rooms-heading-copy">
          <div className="dashboard-mini-label">
            <span className="dashboard-rooms-heading-dot" />
            DISCOVER YOUR SPACE
          </div>

          <h2>Available rooms</h2>

          <p>
            Find a workspace and join the conversation.
          </p>
        </div>

        <div className="dashboard-rooms-heading-actions">
          <span className="dashboard-rooms-count">
            {validRooms.length} {validRooms.length === 1 ? 'ROOM' : 'ROOMS'}
          </span>

          <button
            type="button"
            className="dashboard-rooms-refresh"
            onClick={onRefresh}
            disabled={loading || !onRefresh}
            aria-label="Refresh available rooms"
            title="Refresh rooms"
          >
            <RoomIcon name="refresh" size={17} />
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingRooms />
      ) : validRooms.length === 0 ? (
        <EmptyRooms onCreateMeeting={onCreateMeeting} />
      ) : (
        <div className="dashboard-rooms-grid">
          {validRooms.map((room) => (
            <RoomCard
              key={room.roomId}
              room={room}
              onSelect={onSelectRoom}
              disabled={joiningRoom}
            />
          ))}
        </div>
      )}
    </section>
  );
}