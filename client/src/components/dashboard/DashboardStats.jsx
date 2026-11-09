const statItems = [
  {
    id: 'rooms',
    label: 'Available rooms',
    icon: 'video',
    color: 'purple',
  },
  {
    id: 'meetings',
    label: 'Recent meetings',
    icon: 'history',
    color: 'green',
  },
  {
    id: 'workspace',
    label: 'Your workspace',
    icon: 'sparkle',
    color: 'yellow',
  },
];

function StatIcon({ name }) {
  const icons = {
    video: (
      <>
        <rect x="3" y="5" width="13" height="14" rx="2" />
        <path d="m16 10 5-3v10l-5-3" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
        <path d="M3 3v5h5" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    sparkle: (
      <>
        <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z" />
        <path d="m19 14 1 2.5 2 1-2 1L19 21l-1-2.5-2-1 2-1 1-2.5Z" />
      </>
    ),
  };

  return (
    <svg
      width="21"
      height="21"
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

export default function DashboardStats({
  roomCount = 0,
  meetingCount = 0,
}) {
  const values = {
    rooms: roomCount,
    meetings: meetingCount,
    workspace: 'Ready',
  };

  return (
    <section
      className="dashboard-stats"
      aria-label="Workspace overview"
    >
      {statItems.map((item, index) => (
        <article
          key={item.id}
          className={`dashboard-stat-card stat-${item.color}`}
          style={{ '--stat-index': index }}
        >
          <div className={`dashboard-stat-icon ${item.color}`}>
            <StatIcon name={item.icon} />
          </div>

          <div className="dashboard-stat-content">
            <strong>{values[item.id]}</strong>
            <span>{item.label}</span>
          </div>

          <span className="dashboard-stat-decoration" aria-hidden="true" />
        </article>
      ))}
    </section>
  );
}