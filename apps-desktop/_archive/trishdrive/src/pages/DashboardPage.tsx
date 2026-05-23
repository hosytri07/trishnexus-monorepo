/**
 * DEPRECATED — Phase 26.1.D rebuild (TrishDrive User app).
 * DashboardPage là admin-only page, đã chuyển sang TrishAdmin Drive Panel (Phase 24.1).
 * File này stub để TS compile OK; có thể xoá thủ công khi Trí confirm.
 */
export function DashboardPage(): JSX.Element {
  return (
    <div style={{ padding: 24, color: 'var(--color-text-muted)', fontSize: 13 }}>
      Page này đã chuyển sang TrishAdmin Drive Panel (Phase 24.1). TrishDrive User app
      không còn admin features.
    </div>
  );
}
