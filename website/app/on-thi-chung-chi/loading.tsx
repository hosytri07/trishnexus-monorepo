/**
 * Loading skeleton — fetches 3.7MB cert-bxd163.json.
 */
export default function Loading() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <div
          className="w-7 h-7 rounded animate-pulse"
          style={{ background: 'var(--color-surface-muted)' }}
        />
        <div
          className="h-8 w-96 rounded animate-pulse"
          style={{ background: 'var(--color-surface-muted)' }}
        />
      </div>
      <p
        className="text-xs italic mb-6 text-center"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Đang nạp ngân hàng 8,081 câu hỏi BXD 163/2025...
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="rounded-lg border p-4 animate-pulse"
            style={{
              background: 'var(--color-surface-card)',
              borderColor: 'var(--color-border-subtle)',
              height: 80,
            }}
          />
        ))}
      </div>
    </main>
  );
}
