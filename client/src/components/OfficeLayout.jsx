/**
 * OfficeLayout
 *
 * Preserves the existing WorldCanvas DOM structure.
 * Keeps the information sidebar as a separate grid column.
 */

export default function OfficeLayout({
  children,
  sidebar,
  className = '',
}) {
  return (
    <main className={`app__body ${className}`.trim()}>
      {children}

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