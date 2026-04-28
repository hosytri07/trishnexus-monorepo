/**
 * Loading skeleton for /bien-bao — fetches QC41:2024 sign database.
 */
export default function Loading() {
  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div
          className="w-7 h-7 rounded animate-pulse"
          style={{ background: 'var(--color-surface-muted)' }}
        />
        <div
          className="h-8 w-64 rounded animate-pulse"
          style={{ background: 'var(--color-surface-muted)' }}
        />
      </div>
      <div
        className="h-12 rounded mb-4 animate-pulse"
        style={{ background: 'var(--color-surface-muted)' }}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[...Array(18)].map((_, i) => (
          <div
            key={i}
            className="rounded-lg border p-3 animate-pulse"
            style={{
              background: 'var(--color-surface-card)',
              borderColor: 'var(--color-border-subtle)',
              height: 140,
            }}
          />
        ))}
      </div>
    </main>
  );
}
