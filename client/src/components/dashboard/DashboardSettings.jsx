import React from 'react';

/* =========================================
   SETTINGS ICONS
========================================= */

function SettingsIcon({ type, size = 21 }) {
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
      {icons[type]}
    </svg>
  );
}

/* =========================================
   SETTINGS ROW
========================================= */

function SettingsRow({
  icon,
  title,
  description,
  children,
}) {
  return (
    <div className="
      flex flex-wrap
      items-center gap-4
      border-b border-[#F0EDF8]
      px-5 py-5
      last:border-b-0
      sm:px-6
    ">
      <div className="
        flex h-[46px] w-[46px]
        shrink-0 items-center justify-center
        rounded-[15px]
        bg-[#EFEDFF]
        text-[#6252FF]
      ">
        <SettingsIcon type={icon} size={21} />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="
          text-[13px] font-extrabold
          tracking-[-0.2px]
          text-[#303047]
        ">
          {title}
        </h3>

        <p className="
          mt-1.5 break-words
          text-[11px] leading-6
          text-[#9292A7]
        ">
          {description}
        </p>
      </div>

      {children && (
        <div className="
          ml-auto shrink-0
          pl-[62px] sm:pl-0
        ">
          {children}
        </div>
      )}
    </div>
  );
}

/* =========================================
   SETTINGS VALUE BADGE
========================================= */

function SettingsValue({ children, variant = 'default' }) {
  const variants = {
    default: 'bg-[#F5F3FF] text-[#6252FF]',
    protected: 'bg-emerald-50 text-emerald-700',
  };

  return (
    <span className={`
      inline-flex items-center
      rounded-full px-3 py-2
      text-[9px] font-extrabold
      whitespace-nowrap
      ${variants[variant]}
    `}>
      {children}
    </span>
  );
}

/* =========================================
   MAIN COMPONENT
========================================= */

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
    <section className="w-full space-y-7">

      {/* =====================================
          PAGE HEADING
      ===================================== */}

      <div>
        <span className="
          text-[10px] font-extrabold
          tracking-[1.8px]
          text-[#6252FF]
        ">
          PREFERENCES
        </span>

        <h2 className="
          mt-3 text-[26px]
          font-black tracking-[-1px]
          text-[#25263A]
        ">
          Settings
        </h2>

        <p className="
          mt-2 max-w-[550px]
          text-[13px] leading-6
          text-[#9292A7]
        ">
          Manage your account information and application preferences.
        </p>
      </div>

      {/* =====================================
          ACCOUNT PREFERENCES
      ===================================== */}

      <div className="
        overflow-hidden
        rounded-[24px]
        border border-[#EBE8F7]
        bg-white
        shadow-[0_8px_35px_rgba(40,35,90,0.035)]
      ">

        {/* CARD HEADER */}

        <div className="
          flex items-center
          justify-between gap-4
          border-b border-[#F0EDF8]
          px-5 py-6 sm:px-6
        ">
          <div>
            <h3 className="
              text-[16px] font-extrabold
              tracking-[-0.4px]
              text-[#25263A]
            ">
              Account preferences
            </h3>

            <p className="
              mt-1.5 text-[11px]
              leading-5 text-[#9292A7]
            ">
              Information about your ProxiSpeakMeet account.
            </p>
          </div>

          <div className="
            flex h-[45px] w-[45px]
            shrink-0 items-center justify-center
            rounded-[15px]
            bg-[#EFEDFF]
            text-[#6252FF]
          ">
            <SettingsIcon type="account" size={22} />
          </div>
        </div>

        {/* SETTINGS LIST */}

        <div>
          <SettingsRow
            icon="account"
            title="Account information"
            description={`${displayName} · ${email}`}
          >
            <SettingsValue>
              Personal account
            </SettingsValue>
          </SettingsRow>

          <SettingsRow
            icon="appearance"
            title="Application appearance"
            description="ProxiSpeakMeet uses its current lavender and purple interface."
          >
            <SettingsValue>
              Default theme
            </SettingsValue>
          </SettingsRow>

          <SettingsRow
            icon="security"
            title="Account security"
            description="Your account session is managed securely by the application."
          >
            <SettingsValue variant="protected">
              Protected
            </SettingsValue>
          </SettingsRow>
        </div>
      </div>

      {/* =====================================
          LOGOUT CARD
      ===================================== */}

      <div className="
        flex flex-wrap
        items-center gap-5
        rounded-[23px]
        border border-[#E8E4FF]
        bg-white p-5
        shadow-[0_8px_35px_rgba(40,35,90,0.025)]
        sm:p-6
      ">
        <div className="
          flex h-[50px] w-[50px]
          shrink-0 items-center justify-center
          rounded-[16px]
          bg-[#EFEDFF]
          text-[#6252FF]
        ">
          <SettingsIcon type="logout" size={22} />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="
            text-[14px] font-extrabold
            text-[#303047]
          ">
            Sign out
          </h3>

          <p className="
            mt-1.5 text-[11px]
            leading-6 text-[#9292A7]
          ">
            Sign out of your account on this device.
          </p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          disabled={!onLogout}
          className="
            appearance-none border-0
            inline-flex min-h-[43px]
            shrink-0 items-center
            justify-center gap-2
            rounded-[13px]
            bg-[#EFEDFF] px-5
            text-[11px] font-extrabold
            text-[#6252FF]
            transition-all duration-300
            hover:-translate-y-0.5
            hover:bg-[#5546F5]
            hover:text-white
            active:translate-y-0
            disabled:cursor-not-allowed
            disabled:opacity-50
            focus-visible:outline-none
            focus-visible:ring-2
            focus-visible:ring-[#6252FF]
            focus-visible:ring-offset-2
          "
        >
          <SettingsIcon type="logout" size={16} />
          Sign out
        </button>
      </div>

      {/* =====================================
          FOOTER
      ===================================== */}

      <div className="
        flex flex-wrap
        items-center justify-between
        gap-3 px-1 py-2
      ">
        <span className="
          text-[11px] font-extrabold
          tracking-[0.3px]
          text-[#85869D]
        ">
          ProxiSpeakMeet
        </span>

        <span className="
          text-[10px] font-medium
          text-[#A1A0B2]
        ">
          Account settings
        </span>
      </div>
    </section>
  );
}