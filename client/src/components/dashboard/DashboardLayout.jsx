import React from 'react';
import DashboardSidebar from './DashboardSidebar';
import DashboardTopbar from './DashboardTopbar';

export default function DashboardLayout({
  activeSection,
  setActiveSection,
  username,
  onLogout,
  onOpenProfile,
  children,
}) {
  return (
    <div className="dashboard-layout">
      <DashboardSidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        username={username}
        onLogout={onLogout}
      />

      <div className="dashboard-main">
        <DashboardTopbar
          activeSection={activeSection}
          username={username}
          onOpenProfile={onOpenProfile}
        />

        <main
          className="dashboard-content"
          key={activeSection}
          aria-label={`${activeSection} section`}
        >
          <div className="dashboard-content-inner">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}