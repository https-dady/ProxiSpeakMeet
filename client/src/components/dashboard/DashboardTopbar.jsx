import { useState } from 'react';

/* =========================================
   TOPBAR ICONS
========================================= */

function TopbarIcon({ name, size = 19 }) {
  const icons = {
    chevron: <path d="m7 10 5 5 5-5" />,

    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),

    close: (
      <>
        <path d="m18 6-12 12" />
        <path d="m6 6 12 12" />
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

/* =========================================
   BRAND
========================================= */

function MobileBrand() {
  return (
    <div className="
      flex items-center gap-2.5
      lg:hidden
    ">
      <span className="
        flex h-[37px] w-[37px]
        shrink-0 items-center
        justify-center rounded-[12px]
        bg-[#6252FF]
        text-[19px] font-black
        text-white
        shadow-[0_5px_15px_rgba(98,82,255,0.18)]
      ">
        P
      </span>

      <span className="
        flex items-center gap-1
        text-[15px] font-black
        tracking-[-0.6px]
        text-[#25263A]
      ">
        ProxiSpeak

        <span className="
          mt-1 text-[10px]
          font-extrabold
          text-[#6252FF]
        ">
          Meet
        </span>
      </span>
    </div>
  );
}

/* =========================================
   PROFILE DROPDOWN
========================================= */

function ProfileDropdown({
  username,
  initials,
  onOpenProfile,
  onClose,
}) {
  return (
    <>
      <button
        type="button"
        className="
          fixed inset-0 z-40
          cursor-default appearance-none
          border-0 bg-transparent
        "
        aria-label="Close account menu"
        onClick={onClose}
      />

      <div className="
        absolute right-0 top-[calc(100%+14px)]
        z-50 w-[245px]
        overflow-hidden rounded-[18px]
        border border-[#EBE8F7]
        bg-white
        shadow-[0_16px_45px_rgba(40,35,90,0.13)]
        animate-in fade-in slide-in-from-top-2
        duration-200
      ">
        <div className="
          flex items-center gap-3
          p-4
        ">
          <span className="
            flex h-[42px] w-[42px]
            shrink-0 items-center
            justify-center rounded-[13px]
            bg-[#EFEDFF]
            text-[13px] font-black
            text-[#6252FF]
          ">
            {initials}
          </span>

          <span className="min-w-0 flex-1">
            <strong className="
              block truncate
              text-[12px] font-extrabold
              text-[#303047]
            ">
              {username}
            </strong>

            <small className="
              mt-1 block
              text-[10px] font-medium
              text-[#9292A7]
            ">
              Personal account
            </small>
          </span>
        </div>

        <div className="h-px bg-[#F0EDF8]" />

        <button
          type="button"
          onClick={onOpenProfile}
          className="
            flex min-h-[47px]
            w-full appearance-none
            items-center gap-3
            border-0 bg-white
            px-4 text-left
            text-[11px] font-bold
            text-[#686880]
            transition-colors
            hover:bg-[#F8F6FF]
            hover:text-[#6252FF]
            focus-visible:outline-none
            focus-visible:bg-[#F8F6FF]
          "
        >
          <TopbarIcon name="user" size={17} />

          View profile

          <span className="
            ml-auto text-[16px]
            text-[#A1A0B2]
          ">
            →
          </span>
        </button>
      </div>
    </>
  );
}

/* =========================================
   MAIN TOPBAR
========================================= */

export default function DashboardTopbar({
  activeSection,
  username,
  onOpenProfile,
}) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const displayName = username || 'User';

  const initials = displayName
    .trim()
    .slice(0, 2)
    .toUpperCase();

  const pageTitles = {
    dashboard: 'Dashboard',
    history: 'Past meetings',
    profile: 'Profile',
    settings: 'Settings',
  };

  const currentTitle =
    pageTitles[activeSection] || 'Dashboard';

  const handleProfileClick = () => {
    setProfileMenuOpen(false);
    onOpenProfile?.();
  };

  return (
    <header className="
      relative z-30
      flex min-h-[86px]
      w-full shrink-0
      items-center justify-between
      gap-4 border-b border-[#EBE8F7]
      bg-white px-5
      sm:px-7 lg:px-9
    ">

      {/* LEFT SIDE */}

      <div className="
        flex min-w-0
        items-center gap-5
      ">
        <MobileBrand />

        <div className="
          hidden min-w-0
          sm:block
        ">
          <div className="
            flex items-center gap-2
            text-[9px] font-extrabold
            tracking-[1.5px]
            text-[#A1A0B2]
          ">
            <span>YOUR WORKSPACE</span>

            <span className="text-[#D5D1E4]">
              /
            </span>

            <span className="text-[#6252FF]">
              {currentTitle.toUpperCase()}
            </span>
          </div>

          <h1 className="
            mt-1.5 truncate
            text-[17px] font-black
            tracking-[-0.5px]
            text-[#25263A]
          ">
            {currentTitle}
          </h1>
        </div>
      </div>

      {/* RIGHT SIDE */}

      <div className="
        flex shrink-0
        items-center gap-4
        sm:gap-5
      ">

        {/* USER INFORMATION */}

        <div className="
          hidden text-right
          sm:block
        ">
          <span className="
            block text-[9px]
            font-extrabold
            tracking-[1.4px]
            text-[#A1A0B2]
          ">
            SIGNED IN AS
          </span>

          <strong className="
            mt-1 block max-w-[180px]
            truncate text-[13px]
            font-bold tracking-[-0.2px]
            text-[#303047]
          ">
            {displayName}
          </strong>
        </div>

        {/* DIVIDER */}

        <div className="
          hidden h-[42px] w-px
          bg-[#F0EDF8]
          sm:block
        " />

        {/* PROFILE MENU */}

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setProfileMenuOpen((previous) => !previous);
            }}
            className={`
              group flex min-h-[48px]
              appearance-none items-center
              gap-2 rounded-[15px]
              border-0 bg-transparent
              p-1.5
              transition-colors duration-200
              hover:bg-[#F8F6FF]
              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-[#6252FF]
              ${
                profileMenuOpen
                  ? 'bg-[#F8F6FF]'
                  : ''
              }
            `}
            aria-label="Open account menu"
            aria-expanded={profileMenuOpen}
            aria-haspopup="true"
          >
            <span className="
              flex h-[45px] w-[45px]
              items-center justify-center
              rounded-[15px]
              bg-[#EFEDFF]
              text-[14px] font-black
              text-[#6252FF]
            ">
              {initials}
            </span>

            <span className={`
              text-[#9292A7]
              transition-transform duration-200
              ${
                profileMenuOpen
                  ? 'rotate-180'
                  : ''
              }
            `}>
              <TopbarIcon name="chevron" size={16} />
            </span>
          </button>

          {profileMenuOpen && (
            <ProfileDropdown
              username={displayName}
              initials={initials}
              onOpenProfile={handleProfileClick}
              onClose={() => setProfileMenuOpen(false)}
            />
          )}
        </div>
      </div>
    </header>
  );
}