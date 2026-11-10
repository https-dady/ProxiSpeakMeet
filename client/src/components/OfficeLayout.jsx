import PropTypes from 'prop-types';

/**
 * OfficeLayout
 *
 * Provides the full-height virtual office layout:
 * - Main workspace on the left.
 * - Independently scrollable information sidebar on the right.
 * - No page-level scrolling on desktop.
 *
 * Existing workspace components remain responsible
 * for their own functionality and internal content.
 */
export default function OfficeLayout({
  children,
  sidebar,
  className = '',
}) {
  return (
    <main
      className={`app__body ${className}`.trim()}
    >
      <section className="world">
        {children}
      </section>

      {sidebar && (
        <aside
          className="app__sidebar"
          aria-label="Workspace information"
        >
          {sidebar}
        </aside>
      )}
    </main>
  );
}

OfficeLayout.propTypes = {
  children: PropTypes.node.isRequired,
  sidebar: PropTypes.node,
  className: PropTypes.string,
};