import React from 'react';

function SettingsIcon({ type }) {
  const icons = {
    account: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.6-3.2 3.2-5 7-5s6.4 1.8 7 5" />
      </>
    ),
    appearance: (
      <>
        <path d="M12 3a9 9 0 1 0 0 18h1.2a2.3 2.3 0 0 0 1.5-4c-.7-.6-.4-1.8.6-1.8H17a4 4 0 0 0 4-4c0-4.5-4-8.2-9-8.2Z" />
        <path d="M7.5 10h.01M10 7h.01M15 7.5h.01M17 11h.01" />
      </>
    ),
    security: (
      <>
        <path d="M12 3 19 6v5c0 4.7-2.8 8-7 10-4.2-2-7-5.3-7-10V6l7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    logout: (
      <>
        <path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5" />
        <path d="M15 16l5-4-5-4M20 12H9" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[type]}
    </svg>
  );
}

function SettingsRow({ icon, title, description, children }) {
  return (
    <div className="dashboard-settings-row">
      <div className="dashboard-settings-row-icon">
        <SettingsIcon type={icon} />
      </div>

      <div className="dashboard-settings-row-content">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      {children && (
        <div className="dashboard-settings-row-action">
          {children}
        </div>
      )}
    </div>
  );
}

export default function DashboardSettings({
  profile = null,
  username = '',
  onLogout,
}) {
  const displayName =
    profile?.username ||
    profile?.name ||
    username ||
    'User';

  const email =
    profile?.email ||
    profile?.emailAddress ||
    'Not available';

  return (
    <section className="dashboard-settings-section">
      <div className="dashboard-settings-heading">
        <span className="dashboard-section-eyebrow">
          PREFERENCES
        </span>

        <h2>Settings</h2>

        <p>
          Manage your account information and application preferences.
        </p>
      </div>

      <div className="dashboard-settings-card">
        <div className="dashboard-settings-card-heading">
          <div>
            <h3>Account preferences</h3>
            <p>Information about your ProxiSpeakMeet account.</p>
          </div>

          <div className="dashboard-settings-heading-badge">
            <SettingsIcon type="account" />
          </div>
        </div>

        <div className="dashboard-settings-list">
          <SettingsRow
            icon="account"
            title="Account information"
            description={`${displayName} · ${email}`}
          >
            <span className="dashboard-settings-value">
              Personal account
            </span>
          </SettingsRow>

          <SettingsRow
            icon="appearance"
            title="Application appearance"
            description="ProxiSpeakMeet uses its current lavender and purple interface."
          >
            <span className="dashboard-settings-value">
              Default theme
            </span>
          </SettingsRow>

          <SettingsRow
            icon="security"
            title="Account security"
            description="Your account session is managed securely by the application."
          >
            <span className="dashboard-settings-value">
              Protected
            </span>
          </SettingsRow>
        </div>
      </div>

      <div className="dashboard-settings-logout-card">
        <div className="dashboard-settings-logout-icon">
          <SettingsIcon type="logout" />
        </div>

        <div className="dashboard-settings-logout-content">
          <h3>Sign out</h3>
          <p>
            Sign out of your account on this device.
          </p>
        </div>

        <button
          type="button"
          className="dashboard-settings-logout-button"
          onClick={onLogout}
          disabled={!onLogout}
        >
          <SettingsIcon type="logout" />
          Sign out
        </button>
      </div>

      <div className="dashboard-settings-footer">
        <span>ProxiSpeakMeet</span>
        <span>Account settings</span>
      </div>
    </section>
  );
}