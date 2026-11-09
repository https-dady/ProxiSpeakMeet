import React from 'react';

const navigationItems = [
  {
    id: 'dashboard',
    label: 'Home',
    icon: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
  },
  {
    id: 'history',
    label: 'History',
    icon: (
      <>
        <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
        <path d="M3 3v5h5M12 7v5l3.5 2" />
      </>
    ),
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.6-3.2 3.2-5 7-5s6.4 1.8 7 5" />
      </>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="m19.4 15 .1.1 1.4 1.1-1.5 2.6-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-3l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.5-2.6 1.4-1.1a8 8 0 0 1 0-2l-1.4-1.1 1.5-2.6 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h3l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.5 2.6-1.4 1.1a8 8 0 0 1 0 2Z" />
      </>
    ),
  },
];

export default function DashboardMobileNav({
  activeSection = 'dashboard',
  setActiveSection,
}) {
  return (
    <nav
      className="dashboard-mobile-nav"
      aria-label="Mobile dashboard navigation"
    >
      {navigationItems.map((item) => {
        const isActive = activeSection === item.id;

        return (
          <button
            key={item.id}
            type="button"
            className={`dashboard-mobile-nav-item ${
              isActive ? 'active' : ''
            }`}
            onClick={() => setActiveSection?.(item.id)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.label}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {item.icon}
            </svg>

            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}