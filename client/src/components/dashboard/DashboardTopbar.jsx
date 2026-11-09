import { useState } from 'react';

function TopbarIcon({ name, size = 19 }) {
  const icons = {
    chevron: <path d="m7 10 5 5 5-5" />,
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
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

export default function DashboardTopbar({
  activeSection,
  username,
  onOpenProfile,
}) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const displayName = username || 'User';
  const initials = displayName.trim().slice(0, 2).toUpperCase();

  const pageTitles = {
    dashboard: 'Dashboard',
    history: 'Past meetings',
    profile: 'Profile',
    settings: 'Settings',
  };

  const currentTitle = pageTitles[activeSection] || 'Dashboard';

  const handleProfileClick = () => {
    setProfileMenuOpen(false);
    onOpenProfile?.();
  };

  return (
    <header className="dashboard-topbar">
      <div className="dashboard-topbar-left">
        <div className="dashboard-mobile-brand">
          <span className="dashboard-mobile-brand-mark">P</span>

          <span className="dashboard-mobile-brand-copy">
            ProxiSpeak
            <span>Meet</span>
          </span>
        </div>

        <div className="dashboard-breadcrumb">
          <div className="dashboard-topbar-eyebrow">
            <span className="dashboard-breadcrumb-home">
              YOUR WORKSPACE
            </span>

            <span className="dashboard-breadcrumb-divider">/</span>

            <span className="dashboard-breadcrumb-current">
              {currentTitle}
            </span>
          </div>

          <div className="dashboard-topbar-title">{currentTitle}</div>
        </div>
      </div>

      <div className="dashboard-topbar-right">
        <div className="dashboard-topbar-greeting">
          <span className="dashboard-greeting-label">SIGNED IN AS</span>
          <strong>{displayName}</strong>
        </div>

        <div className="dashboard-topbar-divider" />

        <div className="dashboard-topbar-profile-wrapper">
          <button
            type="button"
            className={`dashboard-topbar-profile ${
              profileMenuOpen ? 'is-open' : ''
            }`}
            onClick={() => setProfileMenuOpen((previous) => !previous)}
            aria-label="Open account menu"
            aria-expanded={profileMenuOpen}
          >
            <span className="dashboard-topbar-avatar">{initials}</span>

            <span className="dashboard-profile-chevron">
              <TopbarIcon name="chevron" size={15} />
            </span>
          </button>

          {profileMenuOpen && (
            <>
              <button
                type="button"
                className="dashboard-menu-backdrop"
                aria-label="Close account menu"
                onClick={() => setProfileMenuOpen(false)}
              />

              <div className="dashboard-profile-dropdown">
                <div className="dashboard-dropdown-user">
                  <span className="dashboard-dropdown-avatar">
                    {initials}
                  </span>

                  <span>
                    <strong>{displayName}</strong>
                    <small>Personal account</small>
                  </span>
                </div>

                <div className="dashboard-dropdown-divider" />

                <button
                  type="button"
                  onClick={handleProfileClick}
                  className="dashboard-dropdown-action"
                >
                  <TopbarIcon name="user" size={17} />
                  View profile
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}