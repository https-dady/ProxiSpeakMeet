import React from 'react';

/* =========================================
   PROFILE AVATAR
========================================= */

function ProfileAvatar({ username }) {
  const initial =
    String(username || 'U').trim().charAt(0).toUpperCase() || 'U';

  return (
    <div
      className="
        flex h-[76px] w-[76px] shrink-0
        items-center justify-center
        rounded-[24px]
        bg-[#EFEDFF]
        text-[30px] font-black
        text-[#6252FF]
        ring-1 ring-inset ring-[#E4DFFF]
        shadow-[0_8px_24px_rgba(98,82,255,0.08)]
      "
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}

/* =========================================
   PROFILE FIELD
========================================= */

function ProfileField({ label, value }) {
  return (
    <div className="
      min-w-0 rounded-[17px]
      border border-[#EBE8F7]
      bg-[#FCFBFF] p-4
      transition-all duration-300
      hover:border-[#DCD5FF]
      hover:bg-[#F9F7FF]
    ">
      <span className="
        block text-[10px]
        font-extrabold uppercase
        tracking-[1.2px]
        text-[#A1A0B2]
      ">
        {label}
      </span>

      <span className="
        mt-2 block break-words
        text-[13px] font-bold
        leading-6 text-[#33334A]
      ">
        {value || 'Not available'}
      </span>
    </div>
  );
}

/* =========================================
   REFRESH ICON
========================================= */

function RefreshIcon({ loading = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      aria-hidden="true"
      className={loading ? 'animate-spin' : ''}
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
  );
}

/* =========================================
   LOADING SKELETON
========================================= */

function ProfileLoading() {
  return (
    <div
      className="
        rounded-[25px]
        border border-[#EBE8F7]
        bg-white p-6 sm:p-8
      "
      role="status"
      aria-label="Loading profile"
    >
      <div className="flex items-center gap-5">
        <div className="
          h-[76px] w-[76px] shrink-0
          animate-pulse rounded-[24px]
          bg-[#EFEDFF]
        " />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="
            h-5 w-40 max-w-full
            animate-pulse rounded-full
            bg-[#EFEDFF]
          " />

          <div className="
            h-3 w-52 max-w-full
            animate-pulse rounded-full
            bg-[#F3F1FA]
          " />
        </div>
      </div>

      <div className="
        mt-9 grid grid-cols-1
        gap-4 sm:grid-cols-2
      ">
        {[1, 2, 3, 4, 5].map((item) => (
          <div
            key={item}
            className="
              h-[83px] animate-pulse
              rounded-[17px]
              bg-[#F5F3FB]
            "
          />
        ))}
      </div>

      <span className="sr-only">
        Loading account information...
      </span>
    </div>
  );
}

/* =========================================
   MAIN COMPONENT
========================================= */

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

  const isVerified = accountStatus === 'Verified';

  /* Loading State */

  if (loading && !profile) {
    return (
      <section className="w-full space-y-7">
        <div>
          <span className="
            text-[10px] font-extrabold
            tracking-[1.8px] text-[#6252FF]
          ">
            YOUR ACCOUNT
          </span>

          <h2 className="
            mt-3 text-[26px] font-black
            tracking-[-1px] text-[#25263A]
          ">
            My profile
          </h2>

          <p className="
            mt-2 text-[13px]
            leading-6 text-[#9292A7]
          ">
            Loading your account information...
          </p>
        </div>

        <ProfileLoading />
      </section>
    );
  }

  return (
    <section className="w-full space-y-7">

      {/* =====================================
          PROFILE HEADER
      ===================================== */}

      <div className="
        flex flex-wrap
        items-end justify-between
        gap-5
      ">
        <div>
          <span className="
            text-[10px] font-extrabold
            tracking-[1.8px] text-[#6252FF]
          ">
            YOUR ACCOUNT
          </span>

          <h2 className="
            mt-3 text-[26px]
            font-black tracking-[-1px]
            text-[#25263A]
          ">
            My profile
          </h2>

          <p className="
            mt-2 max-w-[500px]
            text-[13px] leading-6
            text-[#9292A7]
          ">
            View your personal and account information.
          </p>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="
              appearance-none border-0
              inline-flex min-h-[43px]
              items-center justify-center
              gap-2.5 rounded-[13px]
              bg-white px-4
              text-[11px] font-extrabold
              text-[#6252FF]
              ring-1 ring-inset ring-[#EBE8F7]
              transition-all duration-300
              hover:-translate-y-0.5
              hover:bg-[#F6F4FF]
              disabled:cursor-not-allowed
              disabled:opacity-50
              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-[#6252FF]
            "
          >
            <RefreshIcon loading={loading} />

            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        )}
      </div>

      {/* =====================================
          ERROR MESSAGE
      ===================================== */}

      {error && (
        <div
          role="alert"
          className="
            flex items-start gap-3
            rounded-[15px]
            border border-rose-100
            bg-rose-50 px-5 py-4
            text-[12px] font-medium
            leading-6 text-rose-700
          "
        >
          <span className="
            mt-0.5 flex h-5 w-5
            shrink-0 items-center
            justify-center rounded-full
            bg-rose-100 font-black
          ">
            !
          </span>

          <span>{error}</span>
        </div>
      )}

      {/* =====================================
          PROFILE CARD
      ===================================== */}

      <div className="
        overflow-hidden rounded-[25px]
        border border-[#EBE8F7]
        bg-white
        shadow-[0_8px_35px_rgba(40,35,90,0.035)]
      ">

        {/* PROFILE OVERVIEW */}

        <div className="
          relative overflow-hidden
          p-6 sm:p-8
        ">
          <div className="
            pointer-events-none absolute
            -right-16 -top-24
            h-64 w-64 rounded-full
            bg-[#EFEDFF]/60
          " />

          <div className="
            pointer-events-none absolute
            -bottom-28 right-28
            h-48 w-48 rounded-full
            bg-[#F8F6FF]
          " />

          <div className="
            relative z-10
            flex flex-wrap
            items-center gap-5
          ">
            <ProfileAvatar username={displayName} />

            <div className="min-w-0 flex-1">
              <h3 className="
                truncate text-[21px]
                font-black tracking-[-0.7px]
                text-[#25263A]
              ">
                {displayName}
              </h3>

              <p className="
                mt-1.5 break-all
                text-[12px] font-medium
                text-[#9292A7]
              ">
                {email || 'Email not available'}
              </p>
            </div>

            <span className={`
              inline-flex shrink-0
              items-center gap-2
              rounded-full px-3.5 py-2
              text-[10px] font-extrabold
              ${
                isVerified
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }
            `}>
              <span className="
                h-1.5 w-1.5
                rounded-full bg-current
              " />

              {accountStatus}
            </span>
          </div>
        </div>

        {/* DIVIDER */}

        <div className="mx-6 h-px bg-[#F0EDF8] sm:mx-8" />

        {/* PERSONAL INFORMATION */}

        <div className="p-6 sm:p-8">
          <div className="
            flex flex-wrap
            items-center justify-between
            gap-3
          ">
            <div>
              <h3 className="
                text-[16px] font-extrabold
                tracking-[-0.4px]
                text-[#25263A]
              ">
                Personal information
              </h3>

              <p className="
                mt-1.5 text-[12px]
                text-[#9292A7]
              ">
                Your registered account details.
              </p>
            </div>

            <span className="
              rounded-full
              bg-[#F5F3FF] px-3 py-1.5
              text-[9px] font-extrabold
              tracking-[1px] text-[#6252FF]
            ">
              ACCOUNT DETAILS
            </span>
          </div>

          <div className="
            mt-6 grid grid-cols-1
            gap-3 sm:grid-cols-2
          ">
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