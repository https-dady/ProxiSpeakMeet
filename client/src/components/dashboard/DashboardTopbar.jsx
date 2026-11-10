import { useState } from 'react';

function TopbarIcon({ name, size = 19 }) {
  const icons = {
    chevron: <path d="m7 10 5 5 5-5" />,

    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),

    workspace: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
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

const pageTitles = {
  dashboard: 'Dashboard',
  history: 'Past meetings',
  profile: 'Profile',
  settings: 'Settings',
};

export default function DashboardTopbar({
  activeSection,
  username,
  onOpenProfile,
}) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const displayName = username || 'User';

  const initials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();

  const currentTitle = pageTitles[activeSection] || 'Dashboard';

  const handleProfileClick = () => {
    setProfileMenuOpen(false);
    onOpenProfile?.();
  };

  const buttonReset = `
    appearance-none border-0 outline-none
    shadow-none font-inherit cursor-pointer
  `;

  return (
    <header className="
      sticky top-0 z-30
      flex h-[96px] w-full shrink-0
      items-center justify-between
      border-b border-[#EEEAF7]
      bg-white/95 px-6 backdrop-blur-xl
      sm:px-8 lg:px-12
    ">

      {/* LEFT SECTION */}

      <div className="
        flex min-w-0 items-center
        gap-4 sm:gap-6
      ">

        {/* MOBILE BRAND */}

        <div className="
          flex shrink-0 items-center gap-2.5
          lg:hidden
        ">
          <div className="
            flex h-[38px] w-[38px]
            items-center justify-center
            rounded-[13px]
            bg-gradient-to-br
            from-[#6252FF] to-[#8878FF]
            text-[18px] font-black text-white
            shadow-[0_5px_15px_rgba(98,82,255,0.2)]
          ">
            P
          </div>

          <div className="flex flex-col">
            <span className="
              text-[15px] font-extrabold
              tracking-[-0.5px] text-[#202235]
            ">
              ProxiSpeak
            </span>

            <span className="
              text-[11px] font-semibold
              text-[#6554FF]
            ">
              Meet
            </span>
          </div>
        </div>

        {/* BREADCRUMB */}

        <div className="
          flex min-w-0 flex-col
          justify-center gap-1
        ">

          <div className="
            flex items-center gap-2
            overflow-hidden text-[11px]
            font-extrabold tracking-[1.5px]
            text-[#A1A0B2]
          ">
            <span className="hidden sm:inline">
              YOUR WORKSPACE
            </span>

            <span className="hidden text-[#D0CDDC] sm:inline">
              /
            </span>

            <span className="
              truncate text-[#6454FF]
            ">
              {currentTitle.toUpperCase()}
            </span>
          </div>

          <h1 className="
            truncate text-[18px]
            font-extrabold tracking-[-0.5px]
            text-[#222337]
          ">
            {currentTitle}
          </h1>

        </div>
      </div>

      {/* RIGHT SECTION */}

      <div className="
        relative flex shrink-0
        items-center gap-3 sm:gap-5
      ">

        {/* SIGNED IN USER */}

        <div className="
          hidden flex-col items-end
          gap-1 sm:flex
        ">
          <span className="
            text-[10px] font-bold
            tracking-[1.4px]
            text-[#A1A0B2]
          ">
            SIGNED IN AS
          </span>

          <span className="
            max-w-[180px] truncate
            text-[13px] font-bold
            text-[#343449]
          ">
            {displayName}
          </span>
        </div>

        {/* SEPARATOR */}

        <div className="
          hidden h-9 w-px
          bg-[#EEEAF7] sm:block
        " />

        {/* PROFILE MENU */}

        <div className="relative">

          <button
            type="button"
            onClick={() => {
              setProfileMenuOpen((previous) => !previous);
            }}
            aria-label="Open account menu"
            aria-expanded={profileMenuOpen}
            aria-haspopup="menu"
            className={`
              ${buttonReset}
              group flex h-[50px]
              items-center gap-2
              rounded-[16px]
              bg-transparent p-1.5
              transition-all duration-300
              hover:bg-[#F7F5FF]
              focus-visible:ring-2
              focus-visible:ring-[#6858FF]
              focus-visible:ring-offset-2
            `}
          >

            <span className="
              flex h-[40px] w-[40px]
              items-center justify-center
              rounded-[14px]
              bg-[#F0EEFF]
              text-[14px] font-extrabold
              text-[#5D4CFF]
              transition-all duration-300
              group-hover:bg-[#E8E4FF]
              group-hover:scale-[1.04]
            ">
              {initials || 'U'}
            </span>

            <span className="
              hidden text-[#8E8DA2]
              transition-transform duration-300
              sm:block
            ">
              <span className={`
                block transition-transform duration-300
                ${profileMenuOpen ? 'rotate-180' : ''}
              `}>
                <TopbarIcon name="chevron" size={16} />
              </span>
            </span>

          </button>

          {/* DROPDOWN */}

          {profileMenuOpen && (
            <>
              {/* BACKDROP */}

              <button
                type="button"
                aria-label="Close account menu"
                onClick={() => setProfileMenuOpen(false)}
                className="
                  appearance-none border-0
                  fixed inset-0 z-40
                  h-screen w-screen
                  cursor-default bg-transparent
                  shadow-none
                "
              />

              {/* MENU PANEL */}

              <div
                role="menu"
                className="
                  absolute right-0 top-[calc(100%+12px)]
                  z-50 w-[260px]
                  overflow-hidden
                  rounded-[20px]
                  border border-[#EEEAF7]
                  bg-white
                  p-2
                  shadow-[0_18px_55px_rgba(35,30,75,0.13)]
                  animate-in fade-in slide-in-from-top-2
                  duration-200
                "
              >

                {/* USER INFORMATION */}

                <div className="
                  flex items-center gap-3
                  rounded-[14px]
                  bg-[#F8F7FF]
                  p-3
                ">
                  <span className="
                    flex h-[43px] w-[43px]
                    shrink-0 items-center justify-center
                    rounded-[13px]
                    bg-[#EAE7FF]
                    text-[13px] font-extrabold
                    text-[#5D4CFF]
                  ">
                    {initials || 'U'}
                  </span>

                  <span className="
                    flex min-w-0 flex-col
                  ">
                    <strong className="
                      truncate text-[13px]
                      font-bold text-[#29293D]
                    ">
                      {displayName}
                    </strong>

                    <small className="
                      mt-1 text-[11px]
                      font-medium text-[#9695AA]
                    ">
                      Personal account
                    </small>
                  </span>
                </div>

                {/* DIVIDER */}

                <div className="
                  my-2 h-px bg-[#F0EDF7]
                " />

                {/* PROFILE ACTION */}

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleProfileClick}
                  className={`
                    ${buttonReset}
                    flex min-h-[44px]
                    w-full items-center gap-3
                    rounded-[12px]
                    bg-transparent px-3
                    text-left text-[13px]
                    font-semibold text-[#77778F]
                    transition-colors duration-200
                    hover:bg-[#F5F3FF]
                    hover:text-[#5D4CFF]
                    focus-visible:ring-2
                    focus-visible:ring-[#6858FF]
                  `}
                >
                  <TopbarIcon name="user" size={18} />

                  <span>View profile</span>
                </button>

              </div>
            </>
          )}

        </div>

      </div>

    </header>
  );
}