const navigation = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'home',
    group: 'WORKSPACE',
  },
  {
    id: 'history',
    label: 'Past meetings',
    icon: 'history',
    group: 'WORKSPACE',
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: 'profile',
    group: 'ACCOUNT',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'settings',
    group: 'ACCOUNT',
  },
];

function SidebarIcon({ name, size = 19 }) {
  const icons = {
    home: (
      <>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v11h14V9" />
        <path d="M9 20v-6h6v6" />
      </>
    ),
    history: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
        <path d="M3 4v5h5" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a8 8 0 0 0 0-6l1.2-1-1.5-2.6-1.5.5a8 8 0 0 0-3-1.7L14.3 2h-3l-.3 2.2a8 8 0 0 0-3 1.7l-1.5-.5L5 8l1.2 1a8 8 0 0 0 0 6L5 16l1.5 2.6 1.5-.5a8 8 0 0 0 3 1.7l.3 2.2h3l.3-2.2a8 8 0 0 0 3-1.7l1.5.5 1.5-2.6z" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H3" />
        <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" />
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
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name]}
    </svg>
  );
}

export default function DashboardSidebar({
  activeSection,
  setActiveSection,
  username,
  onLogout,
}) {
  const displayName = username || 'User';
  const initials = displayName.trim().slice(0, 2).toUpperCase();

  const groups = ['WORKSPACE', 'ACCOUNT'];

  return (
    <aside className="dashboard-sidebar">
      <div className="dashboard-brand">
        <div className="dashboard-brand-mark">
          P
          <span className="dashboard-brand-mark-glow" />
        </div>

        <div className="dashboard-brand-copy">
          <span className="dashboard-brand-name">ProxiSpeak</span>
          <span className="dashboard-brand-sub">Meet</span>
        </div>
      </div>

      <div className="dashboard-sidebar-content">
        {groups.map((group) => (
          <div className="dashboard-sidebar-group" key={group}>
            <div className="dashboard-nav-label">{group}</div>

            <nav className="dashboard-nav-group" aria-label={group}>
              {navigation
                .filter((item) => item.group === group)
                .map((item) => {
                  const active = activeSection === item.id;

                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={`dashboard-nav-item ${
                        active ? 'is-active' : ''
                      }`}
                      onClick={() => setActiveSection(item.id)}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span className="dashboard-nav-icon">
                        <SidebarIcon name={item.icon} />
                      </span>

                      <span className="dashboard-nav-text">
                        {item.label}
                      </span>

                      {active && (
                        <span className="dashboard-nav-indicator" />
                      )}

                      <span className="dashboard-nav-hover-indicator" />
                    </button>
                  );
                })}
            </nav>
          </div>
        ))}
      </div>

      <div className="dashboard-sidebar-footer">
        <button
          type="button"
          className="dashboard-sidebar-account"
          onClick={() => setActiveSection('profile')}
        >
          <span className="dashboard-avatar-small">{initials}</span>

          <span className="dashboard-account-details">
            <strong>{displayName}</strong>
            <small>Personal account</small>
          </span>

          <span className="dashboard-account-menu">•••</span>
        </button>

        <button
          type="button"
          className="dashboard-signout"
          onClick={onLogout}
        >
          <SidebarIcon name="logout" size={18} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}