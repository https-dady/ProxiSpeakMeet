import React from 'react';

function ProfileAvatar({ username }) {
  const initial = String(username || 'U').trim().charAt(0).toUpperCase() || 'U';

  return (
    <div className="dashboard-profile-avatar" aria-hidden="true">
      {initial}
    </div>
  );
}

function ProfileField({ label, value }) {
  return (
    <div className="dashboard-profile-field">
      <span className="dashboard-profile-field-label">{label}</span>
      <span className="dashboard-profile-field-value">
        {value || 'Not available'}
      </span>
    </div>
  );
}

export default function DashboardProfile({
  profile = null,
  username = '',
  loading = false,
  error = '',
  onRefresh,
}) {
  const displayName =
    profile?.username ||
    profile?.name ||
    username ||
    'User';

  const email =
    profile?.email ||
    profile?.emailAddress ||
    '';

  const accountId =
    profile?._id ||
    profile?.id ||
    '';

  const joinedDate = profile?.createdAt
    ? new Date(profile.createdAt)
    : null;

  const formattedJoinedDate =
    joinedDate && !Number.isNaN(joinedDate.getTime())
      ? new Intl.DateTimeFormat('en-IN', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(joinedDate)
      : 'Not available';

  const accountStatus =
    profile?.isVerified === true ||
    profile?.emailVerified === true
      ? 'Verified'
      : profile?.isVerified === false ||
          profile?.emailVerified === false
        ? 'Pending verification'
        : 'Not available';

  if (loading && !profile) {
    return (
      <section className="dashboard-profile-section">
        <div className="dashboard-profile-heading">
          <span className="dashboard-section-eyebrow">YOUR ACCOUNT</span>
          <h2>My profile</h2>
          <p>Loading your account information...</p>
        </div>

        <div className="dashboard-profile-loading">
          <div className="profile-skeleton-avatar" />
          <div className="profile-skeleton-line" />
          <div className="profile-skeleton-line profile-skeleton-short" />
          <div className="profile-skeleton-fields">
            <div />
            <div />
            <div />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-profile-section">
      <div className="dashboard-profile-heading">
        <div>
          <span className="dashboard-section-eyebrow">YOUR ACCOUNT</span>
          <h2>My profile</h2>
          <p>View your personal and account information.</p>
        </div>

        {onRefresh && (
          <button
            type="button"
            className="dashboard-history-refresh-button"
            onClick={onRefresh}
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
        )}
      </div>

      {error && (
        <div className="dashboard-history-error" role="alert">
          {error}
        </div>
      )}

      <div className="dashboard-profile-card">
        <div className="dashboard-profile-overview">
          <ProfileAvatar username={displayName} />

          <div className="dashboard-profile-identity">
            <h3>{displayName}</h3>
            <p>{email || 'Email not available'}</p>
          </div>

          <span
            className={`dashboard-profile-verification ${
              accountStatus === 'Verified'
                ? 'profile-verified'
                : 'profile-unverified'
            }`}
          >
            <span />
            {accountStatus}
          </span>
        </div>

        <div className="dashboard-profile-divider" />

        <div className="dashboard-profile-information">
          <div className="dashboard-profile-information-heading">
            <div>
              <h3>Personal information</h3>
              <p>Your registered account details.</p>
            </div>
          </div>

          <div className="dashboard-profile-fields">
            <ProfileField
              label="Username"
              value={displayName}
            />

            <ProfileField
              label="Email address"
              value={email}
            />

            <ProfileField
              label="Account ID"
              value={accountId}
            />

            <ProfileField
              label="Member since"
              value={formattedJoinedDate}
            />

            <ProfileField
              label="Account status"
              value={accountStatus}
            />
          </div>
        </div>
      </div>
    </section>
  );
}