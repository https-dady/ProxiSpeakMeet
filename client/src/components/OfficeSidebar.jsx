import { useProxi } from '../state/ProxiContext.jsx';
import { SoundLegend } from './SoundLegend.jsx';

const NAV_ITEMS = [
  { id: 'office', label: 'Office Floor', icon: '⌂' },
  { id: 'people', label: 'People', icon: '♧' },
  { id: 'audio', label: 'Audio', icon: '♫' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

function BrandMark() {
  return (
    <span
      className="office-sidebar__brand-mark"
      aria-hidden="true"
    >
      <span />
      <span />
      <span />
    </span>
  );
}

function Navigation({ activeView, onNavigate }) {
  return (
    <nav
      className="office-sidebar__navigation"
      aria-label="Office navigation"
    >
      <span className="office-sidebar__section-label">
        WORKSPACE
      </span>

      {NAV_ITEMS.map((item) => {
        const isActive = activeView === item.id;

        return (
          <button
            key={item.id}
            type="button"
            className={`office-sidebar__nav-item${
              isActive
                ? ' office-sidebar__nav-item--active'
                : ''
            }`}
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.label}
            onClick={() => onNavigate?.(item.id)}
          >
            <span
              className="office-sidebar__nav-icon"
              aria-hidden="true"
            >
              {item.icon}
            </span>

            <span className="office-sidebar__nav-label">
              {item.label}
            </span>

            {isActive && (
              <span
                className="office-sidebar__active-indicator"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

function UserProfile() {
  const { state, worldRef } = useProxi();

  const self = worldRef.current.self;

  const displayName = self.name || 'You';
  const avatarColor = self.color || '#4f8cff';

  const statusLabels = {
    online: 'Online',
    connecting: 'Connecting',
    reconnecting: 'Reconnecting',
    error: 'Connection error',
    idle: 'Offline',
  };

  const statusLabel =
    statusLabels[state.status] ?? 'Offline';

  return (
    <section
      className="office-sidebar__profile"
      aria-label="Current user profile"
    >
      <span
        className="office-sidebar__profile-avatar"
        style={{
          '--profile-avatar-color': avatarColor,
        }}
        aria-hidden="true"
      >
        <span />
      </span>

      <span className="office-sidebar__profile-details">
        <strong className="office-sidebar__profile-name">
          {displayName}
        </strong>

        <span className="office-sidebar__profile-status">
          <span
            className={`office-sidebar__status-dot office-sidebar__status-dot--${state.status}`}
            aria-hidden="true"
          />

          {statusLabel}
        </span>
      </span>
    </section>
  );
}

export function OfficeSidebar({
  activeView = 'office',
  onNavigate,
}) {
  return (
    <aside
      className="office-sidebar"
      aria-label="ProxiSpeak workspace sidebar"
    >
      <header className="office-sidebar__brand">
        <BrandMark />

        <span className="office-sidebar__brand-copy">
          <strong>ProxiSpeak</strong>
          <span>VIRTUAL OFFICE</span>
        </span>
      </header>

      <Navigation
        activeView={activeView}
        onNavigate={onNavigate}
      />

      <div className="office-sidebar__divider" />

      <div className="office-sidebar__audio">
        <SoundLegend />
      </div>

      <UserProfile />
    </aside>
  );
}

export default OfficeSidebar;
