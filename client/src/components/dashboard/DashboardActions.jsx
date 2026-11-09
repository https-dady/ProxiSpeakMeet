const actions = [
  {
    id: 'create',
    title: 'Create a meeting',
    description:
      'Start your own virtual office. Set up a space and invite people to collaborate.',
    buttonLabel: 'Create new meeting',
    icon: 'video',
    accent: 'purple',
  },
  {
    id: 'join',
    title: 'Join a meeting',
    description:
      'Already have a meeting ID? Enter the room and connect with your team.',
    buttonLabel: 'Join existing meeting',
    icon: 'users',
    accent: 'lavender',
  },
];

function ActionIcon({ name, size = 23 }) {
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
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
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

function ActionCard({ action, onClick, disabled }) {
  const isCreate = action.id === 'create';

  return (
    <article
      className={`dashboard-action-card dashboard-action-${action.accent}`}
    >
      <div className="dashboard-action-card-top">
        <span className="dashboard-action-icon">
          <ActionIcon name={action.icon} />
        </span>

        <span className="dashboard-action-card-number">
          {isCreate ? '01' : '02'}
        </span>
      </div>

      <div className="dashboard-action-card-body">
        <h2>{action.title}</h2>
        <p>{action.description}</p>
      </div>

      <button
        type="button"
        className="dashboard-action-button"
        onClick={onClick}
        disabled={disabled}
      >
        <span>
          {isCreate && <ActionIcon name="plus" size={17} />}
          {action.buttonLabel}
        </span>

        <span className="dashboard-action-button-arrow">
          <ActionIcon name="arrow" size={17} />
        </span>
      </button>

      <span className="dashboard-action-decoration" aria-hidden="true" />
    </article>
  );
}

export default function DashboardActions({
  onCreateMeeting,
  onJoinMeeting,
  disabled = false,
}) {
  const handlers = {
    create: onCreateMeeting,
    join: onJoinMeeting,
  };

  return (
    <section
      className="dashboard-action-grid"
      aria-label="Meeting actions"
    >
      {actions.map((action) => (
        <ActionCard
          key={action.id}
          action={action}
          onClick={handlers[action.id]}
          disabled={disabled}
        />
      ))}
    </section>
  );
}