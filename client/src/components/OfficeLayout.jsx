/**
 * OfficeLayout
 *
 * Full-height virtual office layout.
 * Main workspace and right sidebar have independent scrolling.
 */

export default function OfficeLayout({
  children,
  sidebar,
  className = '',
}) {
  return (
    <main className={`app__body ${className}`.trim()}>
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