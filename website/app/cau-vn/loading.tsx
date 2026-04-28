/**
 * Loading skeleton for /cau-vn — fetches 1.8MB JSON of 7,549 bridges.
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
          className="h-8 w-72 rounded animate-pulse"
          style={{ background: 'var(--color-surface-muted)' }}
        />
      </div>
      <div
        className="h-12 rounded mb-4 animate-pulse"
        style={{ background: 'var(--color-surface-muted)' }}
      />
      <div className="flex gap-2 mb-6">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-7 w-24 rounded-full animate-pulse"
            style={{ background: 'var(--color-surface-muted)' }}
          />
        ))}
      </div>
      <p
        className="text-xs italic mb-4 text-center"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Đang nạp dữ liệu 7,549 cây cầu...
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(9)].map((_, i) => (
          <div
            key={i}
            className="rounded-lg border p-4 animate-pulse"
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
