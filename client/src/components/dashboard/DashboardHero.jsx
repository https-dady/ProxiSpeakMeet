function HeroIcon({ name, size = 19 }) {
  const icons = {
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
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

export default function DashboardHero({
  username,
  onCreateMeeting,
  onJoinMeeting,
  disabled = false,
}) {
  const displayName = username || 'there';

  return (
    <section className="dashboard-welcome">
      <div className="dashboard-welcome-heading">
        <div className="dashboard-eyebrow">
          <span className="dashboard-eyebrow-dot" />
          YOUR WORKSPACE
        </div>

        <h1>
          Welcome back, <span>{displayName}</span>
        </h1>

        <p>
          Your space for meaningful conversations and collaboration.
        </p>
      </div>

      <div className="dashboard-hero">
        <div className="dashboard-hero-decoration dashboard-hero-decoration-one" />
        <div className="dashboard-hero-decoration dashboard-hero-decoration-two" />
        <div className="dashboard-hero-decoration dashboard-hero-decoration-three" />

        <div className="dashboard-hero-content">
          <div className="dashboard-hero-badge">
            <span className="dashboard-hero-live-dot" />
            PROXISPEAK MEET
          </div>

          <h2>
            Your virtual office.
            <br />
            Your people. Your space.
          </h2>

          <p>
            Create a meeting or join an existing workspace and connect
            with people through proximity-powered audio.
          </p>

          <div className="dashboard-hero-actions">
            <button
              type="button"
              className="dashboard-hero-primary"
              onClick={onCreateMeeting}
              disabled={disabled}
            >
              <HeroIcon name="plus" size={19} />
              Create meeting
            </button>

            <button
              type="button"
              className="dashboard-hero-secondary"
              onClick={onJoinMeeting}
              disabled={disabled}
            >
              Join a meeting
              <HeroIcon name="arrow" size={17} />
            </button>
          </div>
        </div>

        <div className="dashboard-hero-visual" aria-hidden="true">
          <div className="dashboard-hero-orbit orbit-one" />
          <div className="dashboard-hero-orbit orbit-two" />
          <div className="dashboard-hero-orbit orbit-three" />

          <div className="dashboard-hero-connection connection-top" />
          <div className="dashboard-hero-connection connection-right" />
          <div className="dashboard-hero-connection connection-bottom" />
          <div className="dashboard-hero-connection connection-left" />

          <div className="dashboard-hero-center">
            <HeroIcon name="users" size={37} />
          </div>

          <span className="dashboard-hero-person person-top">T</span>
          <span className="dashboard-hero-person person-right">A</span>
          <span className="dashboard-hero-person person-bottom">M</span>
          <span className="dashboard-hero-person person-left">S</span>

          <span className="dashboard-hero-floating-dot dot-one" />
          <span className="dashboard-hero-floating-dot dot-two" />
          <span className="dashboard-hero-floating-dot dot-three" />
        </div>

        <div className="dashboard-hero-bottom-label">
          <span className="dashboard-hero-bottom-dot" />
          CONNECT. COLLABORATE. BELONG.
        </div>
      </div>
    </section>
  );
}
