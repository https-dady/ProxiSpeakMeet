import React from 'react';

/* =========================================
   SIDEBAR NAVIGATION
========================================= */

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

/* =========================================
   SIDEBAR ICON
========================================= */

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

/* =========================================
   BRAND
========================================= */

function SidebarBrand() {
  return (
    <div className="
      flex h-[86px]
      shrink-0 items-center
      gap-3 border-b border-[#F0EDF8]
      px-7
    ">
      <div className="
        relative flex h-[43px] w-[43px]
        shrink-0 items-center justify-center
        overflow-hidden rounded-[14px]
        bg-[#6252FF]
        text-[23px] font-black
        text-white
        shadow-[0_7px_18px_rgba(98,82,255,0.22)]
      ">
        P

        <span className="
          pointer-events-none absolute
          -right-2 -top-2
          h-7 w-7 rounded-full
          bg-white/20 blur-md
        " />
      </div>

      <div className="flex items-center gap-1">
        <span className="
          text-[18px] font-black
          tracking-[-0.8px]
          text-[#25263A]
        ">
          ProxiSpeak
        </span>

        <span className="
          mt-1 text-[11px]
          font-extrabold tracking-[0.3px]
          text-[#6252FF]
        ">
          Meet
        </span>
      </div>
    </div>
  );
}

/* =========================================
   NAVIGATION ITEM
========================================= */

function SidebarNavigationItem({
  item,
  active,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`
        group relative flex min-h-[49px]
        w-full appearance-none
        items-center gap-3
        overflow-hidden rounded-[13px]
        border-0 px-4
        text-left
        transition-all duration-200
        focus-visible:outline-none
        focus-visible:ring-2
        focus-visible:ring-[#6252FF]
        focus-visible:ring-offset-2
        ${
          active
            ? 'bg-[#EFEDFF] text-[#6252FF]'
            : 'bg-transparent text-[#85869D] hover:bg-[#F8F6FF] hover:text-[#6252FF]'
        }
      `}
    >
      <span className={`
        flex h-[34px] w-[34px]
        shrink-0 items-center justify-center
        rounded-[10px]
        transition-all duration-200
        ${
          active
            ? 'bg-white text-[#6252FF] shadow-[0_3px_10px_rgba(98,82,255,0.08)]'
            : 'bg-transparent text-current group-hover:bg-white'
        }
      `}>
        <SidebarIcon name={item.icon} size={19} />
      </span>

      <span className={`
        flex-1 text-[12px]
        font-bold tracking-[-0.1px]
        ${active ? 'text-[#5142DC]' : 'text-current'}
      `}>
        {item.label}
      </span>

      {active && (
        <span className="
          absolute right-0 top-1/2
          h-6 w-[3px]
          -translate-y-1/2
          rounded-l-full
          bg-[#6252FF]
        " />
      )}
    </button>
  );
}

/* =========================================
   SIDEBAR ACCOUNT
========================================= */

function SidebarAccount({
  username,
  onLogout,
  onOpenProfile,
}) {
  const displayName = username || 'User';

  const initials = displayName
    .trim()
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="
      shrink-0 border-t
      border-[#F0EDF8]
      p-5
    ">
      <button
        type="button"
        onClick={onOpenProfile}
        className="
          group flex w-full
          appearance-none items-center
          gap-3 rounded-[14px]
          border-0 bg-transparent
          p-2 text-left
          transition-colors duration-200
          hover:bg-[#F8F6FF]
          focus-visible:outline-none
          focus-visible:ring-2
          focus-visible:ring-[#6252FF]
        "
      >
        <span className="
          flex h-[39px] w-[39px]
          shrink-0 items-center justify-center
          rounded-[12px]
          bg-[#EFEDFF]
          text-[12px] font-black
          text-[#6252FF]
        ">
          {initials}
        </span>

        <span className="min-w-0 flex-1">
          <strong className="
            block truncate
            text-[11px] font-extrabold
            text-[#303047]
          ">
            {displayName}
          </strong>

          <small className="
            mt-1 block
            text-[10px] font-medium
            text-[#A1A0B2]
          ">
            Personal account
          </small>
        </span>

        <span className="
          text-[17px] font-bold
          text-[#A1A0B2]
          transition-colors
          group-hover:text-[#6252FF]
        ">
          ···
        </span>
      </button>

      <button
        type="button"
        onClick={onLogout}
        disabled={!onLogout}
        className="
          mt-3 flex min-h-[43px]
          w-full appearance-none
          items-center gap-3
          rounded-[12px]
          border-0 bg-transparent
          px-4 text-left
          text-[11px] font-bold
          text-[#9292A7]
          transition-all duration-200
          hover:bg-[#EFEDFF]
          hover:text-[#6252FF]
          disabled:cursor-not-allowed
          disabled:opacity-50
          focus-visible:outline-none
          focus-visible:ring-2
          focus-visible:ring-[#6252FF]
        "
      >
        <SidebarIcon name="logout" size={18} />

        <span>Sign out</span>
      </button>
    </div>
  );
}

/* =========================================
   MAIN SIDEBAR
========================================= */

export default function DashboardSidebar({
  activeSection,
  setActiveSection,
  username,
  onLogout,
}) {
  const groups = ['WORKSPACE', 'ACCOUNT'];

  return (
    <aside
      className="
        sticky top-0 z-30
        hidden h-screen
        w-[260px] min-w-[260px]
        shrink-0 self-start
        flex-col
        border-r border-[#EBE8F7]
        bg-white
        lg:flex
      "
    >
      {/* BRAND */}

      <SidebarBrand />

      {/* NAVIGATION */}

      <div className="
        min-h-0 flex-1
        overflow-y-auto
        px-5 py-8
      ">
        {groups.map((group) => (
          <div
            key={group}
            className="mb-9 last:mb-0"
          >
            <div className="
              mb-3 px-4
              text-[9px] font-extrabold
              tracking-[1.7px]
              text-[#B0AEC0]
            ">
              {group}
            </div>

            <nav
              className="space-y-1.5"
              aria-label={group}
            >
              {navigation
                .filter((item) => item.group === group)
                .map((item) => (
                  <SidebarNavigationItem
                    key={item.id}
                    item={item}
                    active={activeSection === item.id}
                    onClick={() => setActiveSection(item.id)}
                  />
                ))}
            </nav>
          </div>
        ))}
      </div>

      {/* ACCOUNT FOOTER */}

      <SidebarAccount
        username={username}
        onLogout={onLogout}
        onOpenProfile={() => setActiveSection('profile')}
      />
    </aside>
  );
}