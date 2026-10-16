/**
 * ProxiSpeak — Office Sidebar
 *
 * UI-only component.
 *
 * LOCKED:
 * - Does not change navigation or routing behavior.
 * - Does not modify Socket.IO, WebRTC, or spatial audio.
 * - Reads the existing user identity from ProxiContext.
 * - Reuses the existing SoundLegend component.
 * - Navigation functionality will be implemented in a later phase.
 */

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
    <span className="office-sidebar__brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function Navigation() {
  return (
    <nav
      className="office-sidebar__navigation"
      aria-label="Office navigation"
    >
      <span className="office-sidebar__section-label">WORKSPACE</span>

      {NAV_ITEMS.map((item) => (
        <div
          key={item.id}
          className={`office-sidebar__nav-item${
            item.id === 'office'
              ? ' office-sidebar__nav-item--active'
              : ''
          }`}
          aria-current={item.id === 'office' ? 'page' : undefined}
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

          {item.id === 'office' && (
            <span
              className="office-sidebar__active-indicator"
              aria-hidden="true"
            />
          )}
        </div>
      ))}
    </nav>
  );
}

function UserProfile() {
  const { state, worldRef } = useProxi();

  const self = worldRef.current.self;
  const displayName = self.name || 'You';
  const avatarColor = self.color || '#4f8cff';

  const statusLabel =
    state.status === 'online'
      ? 'Online'
      : state.status === 'connecting'
        ? 'Connecting'
        : state.status === 'reconnecting'
          ? 'Reconnecting'
          : state.status === 'error'
            ? 'Connection error'
            : 'Offline';

  return (
    <section
      className="office-sidebar__profile"
      aria-label="Current user profile"
    >
      <span
        className="office-sidebar__profile-avatar"
        style={{ '--profile-avatar-color': avatarColor }}
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

      <span
        className="office-sidebar__profile-menu"
        aria-hidden="true"
      >
        ⋯
      </span>
    </section>
  );
}

export function OfficeSidebar() {
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

      <Navigation />

      <div className="office-sidebar__divider" />

      <div className="office-sidebar__audio">
        <SoundLegend />
      </div>

      <UserProfile />
    </aside>
  );
}

export default OfficeSidebar;